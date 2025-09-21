"""
Zoho Books OAuth2 Integration Service
Bidirectional sync of customers, items, and invoices with conflict resolution
"""

import requests
import json
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Tuple
from urllib.parse import urlencode
import hashlib

from django.conf import settings
from django.db import transaction
from django.utils import timezone
from django.core.cache import cache

from invoices.models import Invoice, InvoiceLine, Item
from tenants.models import Client
from .models import Integration, ZohoSyncLog

logger = logging.getLogger(__name__)


class ZohoAPIClient:
    """
    Zoho Books API client with OAuth2 authentication
    """

    def __init__(self, integration: Integration):
        self.integration = integration
        self.base_url = "https://www.zohoapis.com/books/v3"
        self.auth_url = "https://accounts.zoho.com/oauth/v2"
        self.config = integration.configuration
        self.credentials = integration.credentials_encrypted

    def get_access_token(self) -> Optional[str]:
        """Get valid access token, refresh if needed"""

        # Check if current token is valid
        access_token = self.credentials.get('access_token')
        expires_at = self.credentials.get('expires_at')

        if access_token and expires_at:
            if datetime.fromisoformat(expires_at) > datetime.now():
                return access_token

        # Refresh token if needed
        refresh_token = self.credentials.get('refresh_token')
        if refresh_token:
            return self._refresh_access_token(refresh_token)

        return None

    def _refresh_access_token(self, refresh_token: str) -> Optional[str]:
        """Refresh access token using refresh token"""

        try:
            data = {
                'refresh_token': refresh_token,
                'client_id': self.config.get('client_id'),
                'client_secret': self.config.get('client_secret'),
                'grant_type': 'refresh_token'
            }

            response = requests.post(f"{self.auth_url}/token", data=data, timeout=30)

            if response.status_code == 200:
                token_data = response.json()

                # Update credentials
                self.credentials.update({
                    'access_token': token_data['access_token'],
                    'expires_at': (datetime.now() + timedelta(seconds=token_data.get('expires_in', 3600))).isoformat(),
                    'token_type': token_data.get('token_type', 'Bearer')
                })

                # Save updated credentials
                self.integration.credentials_encrypted = self.credentials
                self.integration.save()

                return token_data['access_token']
            else:
                logger.error(f"Token refresh failed: {response.text}")

        except Exception as e:
            logger.error(f"Token refresh error: {str(e)}")

        return None

    def make_request(self, method: str, endpoint: str, data: Dict = None,
                    params: Dict = None) -> Tuple[bool, Dict]:
        """Make authenticated API request to Zoho Books"""

        access_token = self.get_access_token()
        if not access_token:
            return False, {'error': 'No valid access token'}

        headers = {
            'Authorization': f'Zoho-oauthtoken {access_token}',
            'Content-Type': 'application/json'
        }

        url = f"{self.base_url}/{endpoint}"

        # Add organization_id to params
        if params is None:
            params = {}
        params['organization_id'] = self.config.get('organization_id')

        try:
            if method.upper() == 'GET':
                response = requests.get(url, headers=headers, params=params, timeout=30)
            elif method.upper() == 'POST':
                response = requests.post(url, headers=headers, json=data, params=params, timeout=30)
            elif method.upper() == 'PUT':
                response = requests.put(url, headers=headers, json=data, params=params, timeout=30)
            elif method.upper() == 'DELETE':
                response = requests.delete(url, headers=headers, params=params, timeout=30)
            else:
                return False, {'error': f'Unsupported method: {method}'}

            # Handle rate limiting
            if response.status_code == 429:
                retry_after = int(response.headers.get('Retry-After', 60))
                logger.warning(f"Rate limited, retry after {retry_after} seconds")
                return False, {'error': 'Rate limited', 'retry_after': retry_after}

            if response.status_code == 200:
                return True, response.json()
            else:
                logger.error(f"Zoho API error {response.status_code}: {response.text}")
                return False, {'error': response.text, 'status_code': response.status_code}

        except requests.exceptions.RequestException as e:
            logger.error(f"Zoho API request failed: {str(e)}")
            return False, {'error': str(e)}


class ZohoSyncService:
    """
    Service for syncing data with Zoho Books
    """

    def __init__(self, tenant, integration: Integration):
        self.tenant = tenant
        self.integration = integration
        self.api_client = ZohoAPIClient(integration)

    @transaction.atomic
    def sync_customer(self, client: Client, action: str = 'push') -> ZohoSyncLog:
        """Sync customer data with Zoho Books"""

        sync_log = ZohoSyncLog.objects.create(
            tenant=self.tenant,
            integration=self.integration,
            entity_type='customer',
            entity_id=str(client.id),
            action=action,
            status='pending'
        )

        try:
            if action == 'push':
                success, result = self._push_customer_to_zoho(client, sync_log)
            elif action == 'pull':
                success, result = self._pull_customer_from_zoho(client, sync_log)
            else:
                success, result = False, {'error': 'Invalid action'}

            if success:
                sync_log.status = 'success'
                sync_log.response_payload = result
            else:
                sync_log.status = 'failed'
                sync_log.error_message = result.get('error', 'Unknown error')

        except Exception as e:
            sync_log.status = 'failed'
            sync_log.error_message = str(e)
            logger.error(f"Customer sync failed: {str(e)}")

        sync_log.save()
        return sync_log

    def _push_customer_to_zoho(self, client: Client, sync_log: ZohoSyncLog) -> Tuple[bool, Dict]:
        """Push customer data to Zoho Books"""

        # Check if customer already exists in Zoho
        existing_zoho_id = self._get_customer_zoho_id(client)

        # Prepare customer data
        customer_data = {
            'contact_name': client.name,
            'company_name': client.name,
            'contact_type': 'customer',
            'customer_sub_type': 'business' if client.client_type == 'b2b' else 'individual',
            'gst_no': client.gstin if client.gstin else '',
            'pan': client.pan if client.pan else '',
            'contact_persons': [
                {
                    'first_name': contact.get('name', '').split(' ')[0] if contact.get('name') else '',
                    'last_name': ' '.join(contact.get('name', '').split(' ')[1:]) if contact.get('name') else '',
                    'email': contact.get('email', ''),
                    'phone': contact.get('phone', '')
                }
                for contact in client.contact_persons
            ] if client.contact_persons else [],
            'billing_address': {
                'address': client.billing_address.get('address_line_1', '') if client.billing_address else '',
                'street2': client.billing_address.get('address_line_2', '') if client.billing_address else '',
                'city': client.billing_address.get('city', '') if client.billing_address else '',
                'state': client.billing_address.get('state', '') if client.billing_address else '',
                'zip': client.billing_address.get('pincode', '') if client.billing_address else '',
                'country': 'India'
            },
            'shipping_address': {
                'address': client.shipping_address.get('address_line_1', '') if client.shipping_address else '',
                'street2': client.shipping_address.get('address_line_2', '') if client.shipping_address else '',
                'city': client.shipping_address.get('city', '') if client.shipping_address else '',
                'state': client.shipping_address.get('state', '') if client.shipping_address else '',
                'zip': client.shipping_address.get('pincode', '') if client.shipping_address else '',
                'country': 'India'
            }
        }

        sync_log.request_payload = customer_data

        if existing_zoho_id:
            # Update existing customer
            success, result = self.api_client.make_request(
                'PUT',
                f'contacts/{existing_zoho_id}',
                data=customer_data
            )
        else:
            # Create new customer
            success, result = self.api_client.make_request(
                'POST',
                'contacts',
                data=customer_data
            )

        if success and 'contact' in result:
            # Store Zoho ID for future reference
            zoho_id = result['contact']['contact_id']
            sync_log.zoho_id = zoho_id

            # Cache the mapping
            cache.set(f"zoho_customer_{self.tenant.id}_{client.id}", zoho_id, 86400)

        return success, result

    def _pull_customer_from_zoho(self, client: Client, sync_log: ZohoSyncLog) -> Tuple[bool, Dict]:
        """Pull customer data from Zoho Books"""

        zoho_id = self._get_customer_zoho_id(client)
        if not zoho_id:
            return False, {'error': 'Customer not found in Zoho'}

        success, result = self.api_client.make_request('GET', f'contacts/{zoho_id}')

        if success and 'contact' in result:
            # Update local customer with Zoho data
            zoho_customer = result['contact']

            # Handle conflicts - for now, Zoho data takes precedence
            client.name = zoho_customer.get('contact_name', client.name)
            if zoho_customer.get('gst_no'):
                client.gstin = zoho_customer['gst_no']

            client.save()

        return success, result

    def _get_customer_zoho_id(self, client: Client) -> Optional[str]:
        """Get Zoho customer ID from cache or database"""

        # Check cache first
        cache_key = f"zoho_customer_{self.tenant.id}_{client.id}"
        zoho_id = cache.get(cache_key)

        if zoho_id:
            return zoho_id

        # Check sync logs
        recent_sync = ZohoSyncLog.objects.filter(
            tenant=self.tenant,
            integration=self.integration,
            entity_type='customer',
            entity_id=str(client.id),
            status='success',
            zoho_id__isnull=False
        ).order_by('-created_at').first()

        if recent_sync and recent_sync.zoho_id:
            # Update cache
            cache.set(cache_key, recent_sync.zoho_id, 86400)
            return recent_sync.zoho_id

        return None

    @transaction.atomic
    def sync_item(self, item: Item, action: str = 'push') -> ZohoSyncLog:
        """Sync item data with Zoho Books"""

        sync_log = ZohoSyncLog.objects.create(
            tenant=self.tenant,
            integration=self.integration,
            entity_type='item',
            entity_id=str(item.id),
            action=action,
            status='pending'
        )

        try:
            if action == 'push':
                success, result = self._push_item_to_zoho(item, sync_log)
            elif action == 'pull':
                success, result = self._pull_item_from_zoho(item, sync_log)
            else:
                success, result = False, {'error': 'Invalid action'}

            if success:
                sync_log.status = 'success'
                sync_log.response_payload = result
            else:
                sync_log.status = 'failed'
                sync_log.error_message = result.get('error', 'Unknown error')

        except Exception as e:
            sync_log.status = 'failed'
            sync_log.error_message = str(e)
            logger.error(f"Item sync failed: {str(e)}")

        sync_log.save()
        return sync_log

    def _push_item_to_zoho(self, item: Item, sync_log: ZohoSyncLog) -> Tuple[bool, Dict]:
        """Push item data to Zoho Books"""

        item_data = {
            'name': item.name,
            'sku': item.item_code,
            'description': item.description,
            'rate': float(item.default_rate),
            'product_type': 'service' if item.is_service else 'goods',
            'hsn_or_sac': item.hsn_sac,
            'is_taxable': True,
            'tax_id': self._get_zoho_tax_id(item.current_gst_rate),
            'item_tax_preferences': [
                {
                    'tax_id': self._get_zoho_tax_id(item.current_gst_rate),
                    'tax_specification': 'taxable'
                }
            ]
        }

        sync_log.request_payload = item_data

        # Check if item exists
        existing_zoho_id = self._get_item_zoho_id(item)

        if existing_zoho_id:
            success, result = self.api_client.make_request(
                'PUT',
                f'items/{existing_zoho_id}',
                data=item_data
            )
        else:
            success, result = self.api_client.make_request(
                'POST',
                'items',
                data=item_data
            )

        if success and 'item' in result:
            zoho_id = result['item']['item_id']
            sync_log.zoho_id = zoho_id
            cache.set(f"zoho_item_{self.tenant.id}_{item.id}", zoho_id, 86400)

        return success, result

    def _get_item_zoho_id(self, item: Item) -> Optional[str]:
        """Get Zoho item ID"""
        cache_key = f"zoho_item_{self.tenant.id}_{item.id}"
        return cache.get(cache_key)

    def _get_zoho_tax_id(self, gst_rate: float) -> str:
        """Map GST rate to Zoho tax ID"""
        # This would need to be configured based on Zoho Books tax setup
        tax_mapping = {
            0: 'exempt',
            5: 'gst_5',
            12: 'gst_12',
            18: 'gst_18',
            28: 'gst_28'
        }
        return tax_mapping.get(int(gst_rate), 'gst_18')

    def get_sync_status(self) -> Dict[str, Any]:
        """Get overall sync status"""

        recent_logs = ZohoSyncLog.objects.filter(
            tenant=self.tenant,
            integration=self.integration,
            created_at__gte=timezone.now() - timedelta(hours=24)
        )

        return {
            'total_syncs_24h': recent_logs.count(),
            'successful_syncs_24h': recent_logs.filter(status='success').count(),
            'failed_syncs_24h': recent_logs.filter(status='failed').count(),
            'last_sync': recent_logs.order_by('-created_at').first().created_at if recent_logs.exists() else None,
            'sync_health': 'good' if recent_logs.filter(status='failed').count() < recent_logs.count() * 0.1 else 'issues'
        }

    def bulk_sync_customers(self, limit: int = 50) -> Dict[str, Any]:
        """Bulk sync customers to Zoho"""

        customers = Client.objects.filter(tenant=self.tenant)[:limit]
        results = {'success': 0, 'failed': 0, 'logs': []}

        for customer in customers:
            try:
                sync_log = self.sync_customer(customer, 'push')
                if sync_log.status == 'success':
                    results['success'] += 1
                else:
                    results['failed'] += 1
                results['logs'].append(str(sync_log.id))
            except Exception as e:
                results['failed'] += 1
                logger.error(f"Bulk customer sync failed for {customer.id}: {str(e)}")

        return results


class ZohoAuthService:
    """
    Service for handling Zoho OAuth2 authentication
    """

    @staticmethod
    def get_authorization_url(client_id: str, redirect_uri: str, state: str) -> str:
        """Generate OAuth2 authorization URL"""

        params = {
            'scope': 'ZohoBooks.fullaccess.all',
            'client_id': client_id,
            'response_type': 'code',
            'redirect_uri': redirect_uri,
            'access_type': 'offline',
            'state': state
        }

        return f"https://accounts.zoho.com/oauth/v2/auth?{urlencode(params)}"

    @staticmethod
    def exchange_code_for_tokens(code: str, client_id: str, client_secret: str,
                                redirect_uri: str) -> Tuple[bool, Dict]:
        """Exchange authorization code for access tokens"""

        try:
            data = {
                'grant_type': 'authorization_code',
                'client_id': client_id,
                'client_secret': client_secret,
                'redirect_uri': redirect_uri,
                'code': code
            }

            response = requests.post(
                'https://accounts.zoho.com/oauth/v2/token',
                data=data,
                timeout=30
            )

            if response.status_code == 200:
                token_data = response.json()
                return True, {
                    'access_token': token_data['access_token'],
                    'refresh_token': token_data['refresh_token'],
                    'expires_at': (datetime.now() + timedelta(seconds=token_data.get('expires_in', 3600))).isoformat(),
                    'token_type': token_data.get('token_type', 'Bearer'),
                    'scope': token_data.get('scope', '')
                }
            else:
                return False, {'error': response.text}

        except Exception as e:
            return False, {'error': str(e)}