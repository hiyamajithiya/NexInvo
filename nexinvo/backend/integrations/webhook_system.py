"""
Webhook System for NexInvo
Supports integration with automation platforms like Make, Zapier, n8n
"""

import requests
import json
import hmac
import hashlib
import logging
from typing import Dict, List, Any, Optional
from datetime import datetime
from django.conf import settings
from django.core.serializers.json import DjangoJSONEncoder

from invoices.models import Invoice, InvoiceLine
from .models import Integration

logger = logging.getLogger(__name__)


class WebhookPayloadBuilder:
    """
    Builds webhook payloads for different events
    """

    @staticmethod
    def build_invoice_payload(invoice: Invoice, event: str) -> Dict[str, Any]:
        """
        Build webhook payload for invoice events

        Args:
            invoice: Invoice instance
            event: Event type (created, updated, deleted, paid, overdue)

        Returns:
            Webhook payload dictionary
        """
        return {
            'event': f'invoice.{event}',
            'timestamp': datetime.now().isoformat(),
            'data': {
                'invoice': {
                    'id': str(invoice.id),
                    'number': invoice.number,
                    'date': invoice.date.isoformat(),
                    'due_date': invoice.due_date.isoformat(),
                    'status': invoice.payment_status,
                    'currency': invoice.currency,
                    'subtotal': float(invoice.taxable_amount),
                    'tax_amount': float(invoice.total_tax),
                    'total': float(invoice.grand_total),
                    'invoice_type': invoice.invoice_type,
                    'place_of_supply': invoice.place_of_supply,
                    'notes': invoice.notes,
                    'terms_conditions': invoice.terms_conditions,
                    'client': {
                        'id': str(invoice.client.id),
                        'name': invoice.client.name,
                        'email': invoice.client.email,
                        'phone': invoice.client.phone,
                        'gstin': invoice.client.gstin,
                        'client_type': invoice.client.client_type,
                        'state_code': invoice.client.state_code
                    },
                    'lines': [
                        {
                            'id': str(line.id),
                            'description': line.description,
                            'hsn_sac': line.hsn_sac,
                            'quantity': float(line.quantity),
                            'rate': float(line.rate),
                            'discount_percent': float(line.discount_percent),
                            'discount_amount': float(line.discount_amount),
                            'taxable_value': float(line.taxable_value),
                            'cgst_rate': float(line.cgst_rate),
                            'sgst_rate': float(line.sgst_rate),
                            'igst_rate': float(line.igst_rate),
                            'cess_rate': float(line.cess_rate),
                            'cgst_amount': float(line.cgst_amount),
                            'sgst_amount': float(line.sgst_amount),
                            'igst_amount': float(line.igst_amount),
                            'cess_amount': float(line.cess_amount),
                            'line_total': float(line.line_total)
                        }
                        for line in invoice.lines.all()
                    ],
                    'created_at': invoice.created_at.isoformat(),
                    'updated_at': invoice.updated_at.isoformat()
                }
            }
        }

    @staticmethod
    def build_client_payload(client_data: Dict, event: str) -> Dict[str, Any]:
        """
        Build webhook payload for client events

        Args:
            client_data: Client data dictionary
            event: Event type (created, updated, deleted)

        Returns:
            Webhook payload dictionary
        """
        return {
            'event': f'client.{event}',
            'timestamp': datetime.now().isoformat(),
            'data': {
                'client': client_data
            }
        }

    @staticmethod
    def build_payment_payload(payment_data: Dict, event: str) -> Dict[str, Any]:
        """
        Build webhook payload for payment events

        Args:
            payment_data: Payment data dictionary
            event: Event type (received, failed, reminder_sent)

        Returns:
            Webhook payload dictionary
        """
        return {
            'event': f'payment.{event}',
            'timestamp': datetime.now().isoformat(),
            'data': {
                'payment': payment_data
            }
        }


class WebhookSigner:
    """
    Handles webhook signature generation and verification
    """

    @staticmethod
    def generate_signature(payload: str, secret: str) -> str:
        """
        Generate HMAC SHA256 signature for webhook payload

        Args:
            payload: JSON payload string
            secret: Webhook secret

        Returns:
            Hex digest signature
        """
        return hmac.new(
            secret.encode('utf-8'),
            payload.encode('utf-8'),
            hashlib.sha256
        ).hexdigest()

    @staticmethod
    def verify_signature(payload: str, signature: str, secret: str) -> bool:
        """
        Verify webhook signature

        Args:
            payload: JSON payload string
            signature: Received signature
            secret: Webhook secret

        Returns:
            True if signature is valid
        """
        expected_signature = WebhookSigner.generate_signature(payload, secret)
        return hmac.compare_digest(signature, expected_signature)


class WebhookDelivery:
    """
    Handles webhook delivery and retry logic
    """

    def __init__(self, webhook_url: str, secret: Optional[str] = None):
        self.webhook_url = webhook_url
        self.secret = secret
        self.max_retries = 3
        self.timeout = 30

    def deliver(self, payload: Dict[str, Any], retry_count: int = 0) -> Dict[str, Any]:
        """
        Deliver webhook payload to endpoint

        Args:
            payload: Webhook payload
            retry_count: Current retry attempt

        Returns:
            Delivery result dictionary
        """
        try:
            # Serialize payload
            payload_str = json.dumps(payload, cls=DjangoJSONEncoder)

            # Prepare headers
            headers = {
                'Content-Type': 'application/json',
                'User-Agent': 'NexInvo-Webhook/1.0',
                'X-NexInvo-Event': payload.get('event', 'unknown'),
                'X-NexInvo-Timestamp': payload.get('timestamp', ''),
                'X-NexInvo-Delivery': str(retry_count + 1)
            }

            # Add signature if secret is provided
            if self.secret:
                signature = WebhookSigner.generate_signature(payload_str, self.secret)
                headers['X-NexInvo-Signature'] = f'sha256={signature}'

            # Make request
            response = requests.post(
                self.webhook_url,
                data=payload_str,
                headers=headers,
                timeout=self.timeout
            )

            # Check response
            if response.status_code in [200, 201, 202, 204]:
                return {
                    'success': True,
                    'status_code': response.status_code,
                    'response_time': response.elapsed.total_seconds(),
                    'retry_count': retry_count
                }
            else:
                return {
                    'success': False,
                    'status_code': response.status_code,
                    'error': f'HTTP {response.status_code}: {response.text[:200]}',
                    'retry_count': retry_count
                }

        except requests.exceptions.Timeout:
            return {
                'success': False,
                'error': 'Request timeout',
                'retry_count': retry_count
            }
        except requests.exceptions.ConnectionError:
            return {
                'success': False,
                'error': 'Connection error',
                'retry_count': retry_count
            }
        except Exception as e:
            return {
                'success': False,
                'error': str(e),
                'retry_count': retry_count
            }

    def deliver_with_retry(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """
        Deliver webhook with retry logic

        Args:
            payload: Webhook payload

        Returns:
            Final delivery result
        """
        last_result = None

        for attempt in range(self.max_retries):
            result = self.deliver(payload, attempt)

            if result['success']:
                return result

            last_result = result

            # Exponential backoff for retries
            if attempt < self.max_retries - 1:
                import time
                time.sleep(2 ** attempt)

        return last_result or {'success': False, 'error': 'All retries failed'}


class WebhookManager:
    """
    Manages webhook registrations and delivery
    """

    def __init__(self, tenant_id: str):
        self.tenant_id = tenant_id

    def get_active_webhooks(self, event_type: str) -> List[Integration]:
        """
        Get active webhook integrations for event type

        Args:
            event_type: Event type (e.g., 'invoice.created')

        Returns:
            List of active webhook integrations
        """
        try:
            webhooks = Integration.objects.filter(
                tenant_id=self.tenant_id,
                integration_type='webhook',
                is_active=True
            )

            # Filter by event subscriptions
            filtered_webhooks = []
            for webhook in webhooks:
                config = webhook.configuration or {}
                subscribed_events = config.get('events', [])

                if not subscribed_events or event_type in subscribed_events:
                    filtered_webhooks.append(webhook)

            return filtered_webhooks

        except Exception as e:
            logger.error(f"Error getting webhooks for tenant {self.tenant_id}: {str(e)}")
            return []

    def trigger_event(self, event_type: str, payload: Dict[str, Any]) -> Dict[str, Any]:
        """
        Trigger webhook event for all registered endpoints

        Args:
            event_type: Event type
            payload: Event payload

        Returns:
            Delivery results summary
        """
        webhooks = self.get_active_webhooks(event_type)

        if not webhooks:
            return {
                'triggered': 0,
                'successful': 0,
                'failed': 0,
                'results': []
            }

        results = {
            'triggered': len(webhooks),
            'successful': 0,
            'failed': 0,
            'results': []
        }

        for webhook in webhooks:
            try:
                webhook_url = webhook.configuration.get('webhook_url')
                webhook_secret = webhook.webhook_secret

                if not webhook_url:
                    continue

                delivery = WebhookDelivery(webhook_url, webhook_secret)
                result = delivery.deliver_with_retry(payload)

                if result['success']:
                    results['successful'] += 1
                else:
                    results['failed'] += 1

                results['results'].append({
                    'webhook_id': str(webhook.id),
                    'webhook_name': webhook.name,
                    'webhook_url': webhook_url,
                    'success': result['success'],
                    'status_code': result.get('status_code'),
                    'error': result.get('error'),
                    'retry_count': result.get('retry_count', 0),
                    'response_time': result.get('response_time')
                })

                # Update webhook status
                webhook.last_sync_at = datetime.now()
                if result['success']:
                    webhook.sync_status = 'success'
                    webhook.error_log = ''
                else:
                    webhook.sync_status = 'failed'
                    webhook.error_log = result.get('error', '')

                webhook.save(update_fields=['last_sync_at', 'sync_status', 'error_log'])

            except Exception as e:
                logger.error(f"Error triggering webhook {webhook.id}: {str(e)}")
                results['failed'] += 1
                results['results'].append({
                    'webhook_id': str(webhook.id),
                    'webhook_name': webhook.name,
                    'success': False,
                    'error': str(e)
                })

        return results


class AutomationPlatforms:
    """
    Specific integrations for popular automation platforms
    """

    @staticmethod
    def make_compatible_payload(platform: str, payload: Dict[str, Any]) -> Dict[str, Any]:
        """
        Transform payload for specific automation platforms

        Args:
            platform: Platform name (make, zapier, n8n)
            payload: Original payload

        Returns:
            Platform-compatible payload
        """
        if platform == 'make':
            return AutomationPlatforms._make_payload(payload)
        elif platform == 'zapier':
            return AutomationPlatforms._zapier_payload(payload)
        elif platform == 'n8n':
            return AutomationPlatforms._n8n_payload(payload)
        else:
            return payload

    @staticmethod
    def _make_payload(payload: Dict[str, Any]) -> Dict[str, Any]:
        """Transform payload for Make.com (formerly Integromat)"""
        # Make prefers flatter structures
        if 'data' in payload and 'invoice' in payload['data']:
            invoice_data = payload['data']['invoice']
            return {
                **payload,
                'invoice_id': invoice_data.get('id'),
                'invoice_number': invoice_data.get('number'),
                'invoice_total': invoice_data.get('total'),
                'client_name': invoice_data.get('client', {}).get('name'),
                'client_email': invoice_data.get('client', {}).get('email')
            }
        return payload

    @staticmethod
    def _zapier_payload(payload: Dict[str, Any]) -> Dict[str, Any]:
        """Transform payload for Zapier"""
        # Zapier works well with nested structures but prefers consistent naming
        if 'data' in payload:
            return {
                **payload,
                'trigger_data': payload['data']
            }
        return payload

    @staticmethod
    def _n8n_payload(payload: Dict[str, Any]) -> Dict[str, Any]:
        """Transform payload for n8n"""
        # n8n is flexible, minimal transformation needed
        return payload


# Event decorators for automatic webhook triggering
def trigger_webhook(event_type: str):
    """
    Decorator to automatically trigger webhooks for model events

    Args:
        event_type: Event type string

    Usage:
        @trigger_webhook('invoice.created')
        def create_invoice(invoice_data):
            # create invoice logic
            pass
    """
    def decorator(func):
        def wrapper(*args, **kwargs):
            result = func(*args, **kwargs)

            # Extract tenant from context or arguments
            tenant_id = None
            if hasattr(kwargs.get('instance'), 'tenant_id'):
                tenant_id = kwargs['instance'].tenant_id

            if tenant_id:
                try:
                    webhook_manager = WebhookManager(tenant_id)

                    # Build appropriate payload based on event type
                    if event_type.startswith('invoice.'):
                        if hasattr(kwargs.get('instance'), 'id'):
                            payload = WebhookPayloadBuilder.build_invoice_payload(
                                kwargs['instance'],
                                event_type.split('.')[1]
                            )
                            webhook_manager.trigger_event(event_type, payload)

                except Exception as e:
                    logger.error(f"Webhook trigger failed for {event_type}: {str(e)}")

            return result
        return wrapper
    return decorator


class WebhookTestRunner:
    """
    Utility class for testing webhook endpoints
    """

    @staticmethod
    def test_endpoint(webhook_url: str, secret: Optional[str] = None) -> Dict[str, Any]:
        """
        Test webhook endpoint with sample payload

        Args:
            webhook_url: Webhook URL to test
            secret: Webhook secret (optional)

        Returns:
            Test result dictionary
        """
        test_payload = {
            'event': 'webhook.test',
            'timestamp': datetime.now().isoformat(),
            'data': {
                'message': 'This is a test webhook from NexInvo',
                'test_id': f'test_{int(datetime.now().timestamp())}'
            }
        }

        delivery = WebhookDelivery(webhook_url, secret)
        result = delivery.deliver(test_payload)

        return {
            'endpoint': webhook_url,
            'test_payload': test_payload,
            'result': result
        }