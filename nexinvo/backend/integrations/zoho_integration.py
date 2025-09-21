"""
Zoho Books Integration for NexInvo
Implements OAuth2 authentication and data synchronization
"""

import requests
import json
import logging
from typing import Dict, List, Any, Optional
from datetime import datetime, timedelta
from decimal import Decimal
from urllib.parse import urlencode

from django.conf import settings
from django.core.cache import cache

from invoices.models import Invoice, InvoiceLine, Item
from .models import Integration

logger = logging.getLogger(__name__)


class ZohoBooksOAuth2:
    """
    Handles OAuth2 authentication for Zoho Books
    """

    def __init__(self, integration: Integration):
        self.integration = integration
        self.config = integration.configuration or {}
        self.credentials = integration.credentials_encrypted or {}

        # Zoho OAuth URLs
        self.auth_base_url = "https://accounts.zoho.com/oauth/v2"
        self.api_base_url = "https://books.zoho.com/api/v3"

        # OAuth credentials
        self.client_id = self.credentials.get('client_id')
        self.client_secret = self.credentials.get('client_secret')
        self.redirect_uri = self.config.get('redirect_uri', 'http://localhost:8000/api/v1/integrations/zoho/callback')

    def get_authorization_url(self) -> str:
        """
        Generate OAuth2 authorization URL

        Returns:
            Authorization URL for user consent
        """
        params = {
            'scope': 'ZohoBooks.fullaccess.all',
            'client_id': self.client_id,
            'state': str(self.integration.id),
            'response_type': 'code',
            'redirect_uri': self.redirect_uri,
            'access_type': 'offline',
            'prompt': 'consent'
        }

        return f"{self.auth_base_url}/auth?{urlencode(params)}"

    def exchange_code_for_token(self, code: str) -> Dict[str, Any]:
        """
        Exchange authorization code for access token

        Args:
            code: Authorization code from callback

        Returns:
            Token response dictionary
        """
        try:
            url = f"{self.auth_base_url}/token"
            data = {
                'code': code,
                'client_id': self.client_id,
                'client_secret': self.client_secret,
                'redirect_uri': self.redirect_uri,
                'grant_type': 'authorization_code'
            }

            response = requests.post(url, data=data)
            response.raise_for_status()

            token_data = response.json()

            # Store tokens securely
            self.credentials['access_token'] = token_data['access_token']
            self.credentials['refresh_token'] = token_data.get('refresh_token')
            self.credentials['token_expires_at'] = datetime.now().isoformat()

            # Update integration
            self.integration.credentials_encrypted = self.credentials
            self.integration.is_active = True
            self.integration.save()

            return {
                'success': True,
                'access_token': token_data['access_token'],
                'expires_in': token_data.get('expires_in', 3600)
            }

        except Exception as e:
            logger.error(f"Failed to exchange code for token: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }

    def refresh_access_token(self) -> Optional[str]:
        """
        Refresh access token using refresh token

        Returns:
            New access token or None on failure
        """
        try:
            refresh_token = self.credentials.get('refresh_token')
            if not refresh_token:
                raise ValueError("No refresh token available")

            url = f"{self.auth_base_url}/token"
            data = {
                'refresh_token': refresh_token,
                'client_id': self.client_id,
                'client_secret': self.client_secret,
                'grant_type': 'refresh_token'
            }

            response = requests.post(url, data=data)
            response.raise_for_status()

            token_data = response.json()

            # Update stored token
            self.credentials['access_token'] = token_data['access_token']
            self.credentials['token_expires_at'] = datetime.now().isoformat()

            self.integration.credentials_encrypted = self.credentials
            self.integration.save()

            return token_data['access_token']

        except Exception as e:
            logger.error(f"Failed to refresh token: {str(e)}")
            return None

    def get_valid_token(self) -> Optional[str]:
        """
        Get valid access token, refreshing if necessary

        Returns:
            Valid access token or None
        """
        access_token = self.credentials.get('access_token')

        # Check if token needs refresh (implement proper expiry check)
        # For now, we'll try to use the token and refresh on 401

        return access_token


class ZohoBooksAPI:
    """
    Zoho Books API client for data operations
    """

    def __init__(self, integration: Integration):
        self.integration = integration
        self.oauth = ZohoBooksOAuth2(integration)
        self.organization_id = integration.configuration.get('organization_id')

    def _make_request(self, method: str, endpoint: str, data: Optional[Dict] = None) -> Dict[str, Any]:
        """
        Make authenticated API request to Zoho Books

        Args:
            method: HTTP method
            endpoint: API endpoint
            data: Request data (optional)

        Returns:
            API response dictionary
        """
        try:
            token = self.oauth.get_valid_token()
            if not token:
                raise ValueError("No valid access token")

            url = f"{self.oauth.api_base_url}/{endpoint}"
            headers = {
                'Authorization': f'Zoho-oauthtoken {token}',
                'Content-Type': 'application/json'
            }

            params = {'organization_id': self.organization_id} if self.organization_id else {}

            if method == 'GET':
                response = requests.get(url, headers=headers, params=params)
            elif method == 'POST':
                response = requests.post(url, headers=headers, params=params, json=data)
            elif method == 'PUT':
                response = requests.put(url, headers=headers, params=params, json=data)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers, params=params)
            else:
                raise ValueError(f"Unsupported method: {method}")

            # Handle 401 - try refresh token
            if response.status_code == 401:
                token = self.oauth.refresh_access_token()
                if token:
                    headers['Authorization'] = f'Zoho-oauthtoken {token}'
                    # Retry request
                    if method == 'GET':
                        response = requests.get(url, headers=headers, params=params)
                    elif method == 'POST':
                        response = requests.post(url, headers=headers, params=params, json=data)

            response.raise_for_status()
            return response.json()

        except Exception as e:
            logger.error(f"Zoho API request failed: {str(e)}")
            return {'error': str(e)}

    def get_organizations(self) -> List[Dict]:
        """
        Get list of organizations

        Returns:
            List of organization dictionaries
        """
        result = self._make_request('GET', 'organizations')
        return result.get('organizations', [])

    def sync_customer(self, client_data: Dict) -> Dict[str, Any]:
        """
        Sync customer to Zoho Books

        Args:
            client_data: Client data dictionary

        Returns:
            Sync result dictionary
        """
        try:
            # Prepare customer data for Zoho
            customer = {
                'contact_name': client_data['name'],
                'company_name': client_data.get('company_name', client_data['name']),
                'contact_type': 'customer',
                'customer_sub_type': 'business' if client_data['client_type'] == 'b2b' else 'individual',
                'email': client_data.get('email'),
                'phone': client_data.get('phone'),
                'gst_no': client_data.get('gstin'),
                'gst_treatment': 'business_gst' if client_data.get('gstin') else 'consumer',
                'payment_terms': client_data.get('credit_terms_days', 30),
                'billing_address': {
                    'address': client_data.get('billing_address', {}).get('street', ''),
                    'city': client_data.get('billing_address', {}).get('city', ''),
                    'state': client_data.get('billing_address', {}).get('state', ''),
                    'zip': client_data.get('billing_address', {}).get('postal_code', ''),
                    'country': client_data.get('billing_address', {}).get('country', 'India')
                }
            }

            # Check if customer exists
            existing = self._find_customer_by_email(client_data.get('email'))

            if existing:
                # Update existing customer
                result = self._make_request('PUT', f"contacts/{existing['contact_id']}", {'contact': customer})
                return {
                    'success': True,
                    'zoho_id': existing['contact_id'],
                    'action': 'updated',
                    'data': result.get('contact', {})
                }
            else:
                # Create new customer
                result = self._make_request('POST', 'contacts', {'contact': customer})
                return {
                    'success': True,
                    'zoho_id': result.get('contact', {}).get('contact_id'),
                    'action': 'created',
                    'data': result.get('contact', {})
                }

        except Exception as e:
            logger.error(f"Failed to sync customer: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }

    def sync_item(self, item: Item) -> Dict[str, Any]:
        """
        Sync item to Zoho Books

        Args:
            item: Item instance

        Returns:
            Sync result dictionary
        """
        try:
            # Prepare item data for Zoho
            zoho_item = {
                'name': item.name,
                'sku': item.item_code,
                'description': item.description,
                'rate': float(item.default_rate),
                'hsn_or_sac': item.hsn_sac,
                'item_type': 'service' if item.is_service else 'goods',
                'product_type': 'service' if item.is_service else 'goods',
                'gst_percentage': float(item.current_gst_rate),
                'is_taxable': True if item.current_gst_rate > 0 else False
            }

            # Check if item exists
            existing = self._find_item_by_sku(item.item_code)

            if existing:
                # Update existing item
                result = self._make_request('PUT', f"items/{existing['item_id']}", {'item': zoho_item})
                return {
                    'success': True,
                    'zoho_id': existing['item_id'],
                    'action': 'updated',
                    'data': result.get('item', {})
                }
            else:
                # Create new item
                result = self._make_request('POST', 'items', {'item': zoho_item})
                return {
                    'success': True,
                    'zoho_id': result.get('item', {}).get('item_id'),
                    'action': 'created',
                    'data': result.get('item', {})
                }

        except Exception as e:
            logger.error(f"Failed to sync item: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }

    def sync_invoice(self, invoice: Invoice) -> Dict[str, Any]:
        """
        Sync invoice to Zoho Books

        Args:
            invoice: Invoice instance

        Returns:
            Sync result dictionary
        """
        try:
            # Get or create customer in Zoho
            customer_result = self.sync_customer({
                'name': invoice.client.name,
                'email': invoice.client.email,
                'phone': invoice.client.phone,
                'gstin': invoice.client.gstin,
                'client_type': invoice.client.client_type,
                'credit_terms_days': invoice.client.credit_terms_days,
                'billing_address': invoice.client.billing_address
            })

            if not customer_result.get('success'):
                raise ValueError(f"Failed to sync customer: {customer_result.get('error')}")

            customer_id = customer_result.get('zoho_id')

            # Prepare line items
            line_items = []
            for line in invoice.lines.all():
                # Sync item first if it exists
                if line.item:
                    item_result = self.sync_item(line.item)

                line_items.append({
                    'description': line.description,
                    'rate': float(line.rate),
                    'quantity': float(line.quantity),
                    'discount': float(line.discount_percent),
                    'tax_percentage': float(line.cgst_rate + line.sgst_rate + line.igst_rate),
                    'hsn_or_sac': line.hsn_sac,
                    'item_order': line.line_number
                })

            # Prepare invoice data for Zoho
            zoho_invoice = {
                'customer_id': customer_id,
                'invoice_number': invoice.number,
                'date': invoice.date.strftime('%Y-%m-%d'),
                'due_date': invoice.due_date.strftime('%Y-%m-%d'),
                'place_of_supply': invoice.place_of_supply,
                'gst_treatment': 'business_gst' if invoice.client.gstin else 'consumer',
                'line_items': line_items,
                'notes': invoice.notes,
                'terms': invoice.terms_conditions
            }

            # Check if invoice exists
            existing = self._find_invoice_by_number(invoice.number)

            if existing:
                # Update existing invoice
                result = self._make_request('PUT', f"invoices/{existing['invoice_id']}", {'invoice': zoho_invoice})
                return {
                    'success': True,
                    'zoho_id': existing['invoice_id'],
                    'action': 'updated',
                    'data': result.get('invoice', {})
                }
            else:
                # Create new invoice
                result = self._make_request('POST', 'invoices', {'invoice': zoho_invoice})
                return {
                    'success': True,
                    'zoho_id': result.get('invoice', {}).get('invoice_id'),
                    'action': 'created',
                    'data': result.get('invoice', {})
                }

        except Exception as e:
            logger.error(f"Failed to sync invoice: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }

    def _find_customer_by_email(self, email: str) -> Optional[Dict]:
        """Find customer in Zoho by email"""
        if not email:
            return None

        result = self._make_request('GET', f'contacts?email={email}')
        contacts = result.get('contacts', [])
        return contacts[0] if contacts else None

    def _find_item_by_sku(self, sku: str) -> Optional[Dict]:
        """Find item in Zoho by SKU"""
        if not sku:
            return None

        result = self._make_request('GET', f'items?sku={sku}')
        items = result.get('items', [])
        return items[0] if items else None

    def _find_invoice_by_number(self, invoice_number: str) -> Optional[Dict]:
        """Find invoice in Zoho by number"""
        if not invoice_number:
            return None

        result = self._make_request('GET', f'invoices?invoice_number={invoice_number}')
        invoices = result.get('invoices', [])
        return invoices[0] if invoices else None


class ZohoBooksIntegration:
    """
    Main Zoho Books integration class
    """

    def __init__(self, integration: Integration):
        self.integration = integration
        self.api = ZohoBooksAPI(integration)

    def setup_oauth(self) -> str:
        """
        Initialize OAuth2 setup

        Returns:
            Authorization URL for user consent
        """
        oauth = ZohoBooksOAuth2(self.integration)
        return oauth.get_authorization_url()

    def handle_oauth_callback(self, code: str) -> Dict[str, Any]:
        """
        Handle OAuth2 callback

        Args:
            code: Authorization code from callback

        Returns:
            Result dictionary
        """
        oauth = ZohoBooksOAuth2(self.integration)
        result = oauth.exchange_code_for_token(code)

        if result.get('success'):
            # Get and store organization info
            orgs = self.api.get_organizations()
            if orgs:
                self.integration.configuration['organization_id'] = orgs[0]['organization_id']
                self.integration.configuration['organization_name'] = orgs[0]['name']
                self.integration.save()

        return result

    def sync_all_invoices(self, start_date: Optional[datetime] = None) -> Dict[str, Any]:
        """
        Sync all invoices to Zoho Books

        Args:
            start_date: Only sync invoices after this date

        Returns:
            Sync result summary
        """
        try:
            from invoices.models import Invoice

            query = Invoice.objects.filter(tenant=self.integration.tenant)
            if start_date:
                query = query.filter(created_at__gte=start_date)

            invoices = query.order_by('created_at')

            results = {
                'total': invoices.count(),
                'success': 0,
                'failed': 0,
                'errors': []
            }

            for invoice in invoices:
                try:
                    result = self.api.sync_invoice(invoice)
                    if result.get('success'):
                        results['success'] += 1

                        # Store Zoho ID in invoice metadata
                        invoice.metadata = invoice.metadata or {}
                        invoice.metadata['zoho_invoice_id'] = result.get('zoho_id')
                        invoice.save(update_fields=['metadata'])
                    else:
                        results['failed'] += 1
                        results['errors'].append({
                            'invoice': invoice.number,
                            'error': result.get('error')
                        })

                except Exception as e:
                    results['failed'] += 1
                    results['errors'].append({
                        'invoice': invoice.number,
                        'error': str(e)
                    })

            # Update integration sync status
            self.integration.last_sync_at = datetime.now()
            self.integration.sync_status = f"Synced {results['success']}/{results['total']} invoices"
            self.integration.save()

            return results

        except Exception as e:
            logger.error(f"Bulk sync failed: {str(e)}")
            return {
                'total': 0,
                'success': 0,
                'failed': 0,
                'error': str(e)
            }