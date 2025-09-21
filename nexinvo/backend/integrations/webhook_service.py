"""
Webhook Service for External Automation Platforms
Supports Make, Zapier, n8n and custom webhook integrations
"""

import requests
import json
import hmac
import hashlib
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
from urllib.parse import urlparse

from django.conf import settings
from django.db import transaction
from django.utils import timezone
from django.core.serializers.json import DjangoJSONEncoder

from invoices.models import Invoice
from tenants.models import Client
from .models import Integration, WebhookEvent

logger = logging.getLogger(__name__)


class WebhookService:
    """
    Service for managing webhook events and deliveries
    """

    def __init__(self, tenant):
        self.tenant = tenant

    @transaction.atomic
    def trigger_webhook(self, event_type: str, entity_id: str, entity_data: Dict,
                       integration: Integration = None) -> List[WebhookEvent]:
        """Trigger webhook for a specific event"""

        webhook_events = []

        # Get active webhook integrations
        webhook_integrations = self._get_webhook_integrations(integration)

        for integration in webhook_integrations:
            # Check if integration handles this event type
            if self._should_trigger_webhook(integration, event_type):
                event = self._create_webhook_event(
                    integration, event_type, entity_id, entity_data
                )
                webhook_events.append(event)

        # Schedule immediate delivery for urgent events
        urgent_events = ['payment.received', 'invoice.paid']
        if event_type in urgent_events:
            self._deliver_webhooks_immediately(webhook_events)

        return webhook_events

    def _get_webhook_integrations(self, specific_integration: Integration = None) -> List[Integration]:
        """Get active webhook integrations"""

        if specific_integration:
            return [specific_integration] if specific_integration.integration_type == 'webhook' else []

        return Integration.objects.filter(
            tenant=self.tenant,
            integration_type='webhook',
            is_active=True
        )

    def _should_trigger_webhook(self, integration: Integration, event_type: str) -> bool:
        """Check if webhook should be triggered for this event"""

        config = integration.configuration
        enabled_events = config.get('enabled_events', [])

        # If no specific events configured, trigger all
        if not enabled_events:
            return True

        return event_type in enabled_events

    @transaction.atomic
    def _create_webhook_event(self, integration: Integration, event_type: str,
                            entity_id: str, entity_data: Dict) -> WebhookEvent:
        """Create a new webhook event"""

        # Prepare payload
        payload = self._prepare_webhook_payload(event_type, entity_id, entity_data)

        # Create event
        event = WebhookEvent.objects.create(
            tenant=self.tenant,
            integration=integration,
            event_type=event_type,
            entity_id=entity_id,
            payload=payload,
            delivery_status='pending',
            next_delivery_attempt=timezone.now()
        )

        logger.info(f"Created webhook event {event.id} for {event_type}")
        return event

    def _prepare_webhook_payload(self, event_type: str, entity_id: str, entity_data: Dict) -> Dict:
        """Prepare webhook payload with standard structure"""

        return {
            'event': event_type,
            'tenant_id': str(self.tenant.id),
            'timestamp': datetime.now().isoformat(),
            'data': {
                'id': entity_id,
                **entity_data
            },
            'webhook_version': '1.0'
        }

    def deliver_webhook(self, event: WebhookEvent) -> bool:
        """Deliver a single webhook event"""

        if event.delivery_status == 'delivered':
            return True

        config = event.integration.configuration
        webhook_url = config.get('webhook_url')

        if not webhook_url:
            self._mark_webhook_failed(event, "No webhook URL configured")
            return False

        try:
            # Prepare headers
            headers = {
                'Content-Type': 'application/json',
                'User-Agent': f'NexInvo-Webhooks/1.0',
                'X-NexInvo-Event': event.event_type,
                'X-NexInvo-Delivery': str(event.id),
                'X-NexInvo-Timestamp': str(int(event.created_at.timestamp()))
            }

            # Add signature if secret is configured
            secret = event.integration.webhook_secret
            if secret:
                payload_bytes = json.dumps(event.payload, cls=DjangoJSONEncoder).encode('utf-8')
                signature = hmac.new(
                    secret.encode('utf-8'),
                    payload_bytes,
                    hashlib.sha256
                ).hexdigest()
                headers['X-NexInvo-Signature'] = f'sha256={signature}'

            # Make request
            response = requests.post(
                webhook_url,
                json=event.payload,
                headers=headers,
                timeout=config.get('timeout', 30)
            )

            # Update event with response
            event.delivery_attempts += 1
            event.last_delivery_attempt = timezone.now()
            event.response_status_code = response.status_code
            event.response_body = response.text[:1000]  # Limit response body size

            # Check if delivery was successful
            if 200 <= response.status_code < 300:
                event.delivery_status = 'delivered'
                logger.info(f"Webhook {event.id} delivered successfully")
                event.save()
                return True
            else:
                self._handle_webhook_failure(event, f"HTTP {response.status_code}: {response.text}")
                return False

        except requests.exceptions.RequestException as e:
            self._handle_webhook_failure(event, f"Request failed: {str(e)}")
            return False
        except Exception as e:
            self._handle_webhook_failure(event, f"Unexpected error: {str(e)}")
            return False

    def _handle_webhook_failure(self, event: WebhookEvent, error_message: str) -> None:
        """Handle webhook delivery failure with retry logic"""

        event.delivery_attempts += 1
        event.last_delivery_attempt = timezone.now()
        event.error_message = error_message

        # Calculate next retry time (exponential backoff)
        max_retries = event.integration.configuration.get('max_retries', 5)

        if event.delivery_attempts < max_retries:
            # Exponential backoff: 1min, 5min, 25min, 2hrs, 10hrs
            backoff_minutes = min(5 ** (event.delivery_attempts - 1), 600)
            event.next_delivery_attempt = timezone.now() + timedelta(minutes=backoff_minutes)
            event.delivery_status = 'retrying'

            logger.warning(f"Webhook {event.id} failed, retrying in {backoff_minutes} minutes")
        else:
            event.delivery_status = 'failed'
            event.next_delivery_attempt = None

            logger.error(f"Webhook {event.id} failed permanently after {event.delivery_attempts} attempts")

        event.save()

    def _mark_webhook_failed(self, event: WebhookEvent, error_message: str) -> None:
        """Mark webhook as failed without retry"""

        event.delivery_status = 'failed'
        event.error_message = error_message
        event.delivery_attempts += 1
        event.last_delivery_attempt = timezone.now()
        event.save()

    def _deliver_webhooks_immediately(self, events: List[WebhookEvent]) -> None:
        """Deliver webhooks immediately for urgent events"""

        from celery import current_app

        for event in events:
            try:
                # Use Celery to deliver webhook asynchronously
                current_app.send_task(
                    'integrations.tasks.deliver_webhook',
                    args=[str(event.id)],
                    countdown=1  # Deliver after 1 second
                )
            except Exception as e:
                logger.error(f"Failed to schedule webhook delivery: {str(e)}")

    def retry_failed_webhooks(self, hours: int = 24) -> Dict[str, Any]:
        """Retry failed webhooks from the last N hours"""

        since = timezone.now() - timedelta(hours=hours)

        failed_events = WebhookEvent.objects.filter(
            tenant=self.tenant,
            delivery_status__in=['retrying', 'failed'],
            next_delivery_attempt__lte=timezone.now(),
            created_at__gte=since
        )

        results = {'retried': 0, 'success': 0, 'failed': 0}

        for event in failed_events:
            results['retried'] += 1
            if self.deliver_webhook(event):
                results['success'] += 1
            else:
                results['failed'] += 1

        return results

    def get_webhook_stats(self, days: int = 7) -> Dict[str, Any]:
        """Get webhook delivery statistics"""

        since = timezone.now() - timedelta(days=days)

        events = WebhookEvent.objects.filter(
            tenant=self.tenant,
            created_at__gte=since
        )

        total = events.count()
        delivered = events.filter(delivery_status='delivered').count()
        failed = events.filter(delivery_status='failed').count()
        pending = events.filter(delivery_status__in=['pending', 'retrying']).count()

        return {
            'total_webhooks': total,
            'delivered': delivered,
            'failed': failed,
            'pending': pending,
            'delivery_rate': (delivered / total * 100) if total > 0 else 0,
            'avg_delivery_time': self._calculate_avg_delivery_time(events.filter(delivery_status='delivered'))
        }

    def _calculate_avg_delivery_time(self, delivered_events) -> Optional[float]:
        """Calculate average delivery time in seconds"""

        if not delivered_events.exists():
            return None

        total_time = 0
        count = 0

        for event in delivered_events:
            if event.last_delivery_attempt:
                delivery_time = (event.last_delivery_attempt - event.created_at).total_seconds()
                total_time += delivery_time
                count += 1

        return total_time / count if count > 0 else None


class WebhookEventTrigger:
    """
    Utility class for triggering webhooks from model changes
    """

    @staticmethod
    def invoice_created(invoice: Invoice) -> None:
        """Trigger webhook when invoice is created"""

        webhook_service = WebhookService(invoice.tenant)

        entity_data = {
            'invoice_number': f"{invoice.series}{invoice.number}",
            'client_name': invoice.client.name,
            'amount': float(invoice.grand_total),
            'currency': invoice.currency,
            'date': invoice.date.isoformat(),
            'due_date': invoice.due_date.isoformat(),
            'status': invoice.payment_status,
            'type': invoice.invoice_type
        }

        webhook_service.trigger_webhook('invoice.created', str(invoice.id), entity_data)

    @staticmethod
    def invoice_updated(invoice: Invoice) -> None:
        """Trigger webhook when invoice is updated"""

        webhook_service = WebhookService(invoice.tenant)

        entity_data = {
            'invoice_number': f"{invoice.series}{invoice.number}",
            'client_name': invoice.client.name,
            'amount': float(invoice.grand_total),
            'currency': invoice.currency,
            'status': invoice.payment_status,
            'updated_at': invoice.updated_at.isoformat()
        }

        webhook_service.trigger_webhook('invoice.updated', str(invoice.id), entity_data)

    @staticmethod
    def invoice_paid(invoice: Invoice) -> None:
        """Trigger webhook when invoice is paid"""

        webhook_service = WebhookService(invoice.tenant)

        entity_data = {
            'invoice_number': f"{invoice.series}{invoice.number}",
            'client_name': invoice.client.name,
            'amount': float(invoice.grand_total),
            'currency': invoice.currency,
            'paid_date': datetime.now().isoformat()
        }

        webhook_service.trigger_webhook('invoice.paid', str(invoice.id), entity_data)

    @staticmethod
    def client_created(client: Client) -> None:
        """Trigger webhook when client is created"""

        webhook_service = WebhookService(client.tenant)

        entity_data = {
            'client_code': client.client_code,
            'name': client.name,
            'type': client.client_type,
            'gstin': client.gstin,
            'email': client.email,
            'phone': client.phone
        }

        webhook_service.trigger_webhook('client.created', str(client.id), entity_data)

    @staticmethod
    def payment_received(invoice: Invoice, amount: float, payment_method: str = None) -> None:
        """Trigger webhook when payment is received"""

        webhook_service = WebhookService(invoice.tenant)

        entity_data = {
            'invoice_number': f"{invoice.series}{invoice.number}",
            'client_name': invoice.client.name,
            'payment_amount': amount,
            'payment_method': payment_method,
            'remaining_balance': float(invoice.grand_total - amount),
            'currency': invoice.currency,
            'payment_date': datetime.now().isoformat()
        }

        webhook_service.trigger_webhook('payment.received', str(invoice.id), entity_data)


class WebhookValidator:
    """
    Utility for validating incoming webhook signatures
    """

    @staticmethod
    def validate_signature(payload: bytes, signature: str, secret: str) -> bool:
        """Validate webhook signature"""

        if not signature or not secret:
            return False

        try:
            # Extract algorithm and signature
            if signature.startswith('sha256='):
                algorithm = 'sha256'
                provided_signature = signature[7:]
            else:
                return False

            # Calculate expected signature
            expected_signature = hmac.new(
                secret.encode('utf-8'),
                payload,
                getattr(hashlib, algorithm)
            ).hexdigest()

            # Compare signatures
            return hmac.compare_digest(expected_signature, provided_signature)

        except Exception as e:
            logger.error(f"Signature validation error: {str(e)}")
            return False

    @staticmethod
    def is_valid_webhook_url(url: str) -> bool:
        """Validate webhook URL"""

        try:
            parsed = urlparse(url)
            return all([
                parsed.scheme in ['http', 'https'],
                parsed.netloc,
                not parsed.netloc.startswith('localhost'),
                not parsed.netloc.startswith('127.'),
                not parsed.netloc.startswith('192.168.'),
                not parsed.netloc.startswith('10.')
            ])
        except Exception:
            return False