"""
Microsoft Dynamics 365 API Integration Service
Enterprise ERP integration for D365 Finance and Operations
"""

import requests
import json
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Tuple
from urllib.parse import urlencode
import base64

from django.conf import settings
from django.db import transaction
from django.utils import timezone
from django.core.cache import cache

from invoices.models import Invoice, InvoiceLine, Item
from tenants.models import Client
from .models import Integration, ZohoSyncLog  # Reusing sync log model

logger = logging.getLogger(__name__)


class Dynamics365APIClient:
    """
    Microsoft Dynamics 365 API client with OAuth2 authentication
    """

    def __init__(self, integration: Integration):
        self.integration = integration
        self.config = integration.configuration
        self.credentials = integration.credentials_encrypted

        # D365 specific configuration
        self.tenant_id = self.config.get('tenant_id')
        self.environment_url = self.config.get('environment_url')
        self.base_url = f"{self.environment_url}/data"

        # OAuth endpoints
        self.auth_url = f"https://login.microsoftonline.com/{self.tenant_id}/oauth2/v2.0"

    def get_access_token(self) -> Optional[str]:
        """Get valid access token for D365"""

        # Check if current token is valid
        access_token = self.credentials.get('access_token')
        expires_at = self.credentials.get('expires_at')

        if access_token and expires_at:
            if datetime.fromisoformat(expires_at) > datetime.now():
                return access_token

        # Get new token using client credentials flow
        return self._get_client_credentials_token()

    def _get_client_credentials_token(self) -> Optional[str]:
        """Get access token using client credentials flow"""

        try:
            data = {
                'grant_type': 'client_credentials',
                'client_id': self.config.get('client_id'),
                'client_secret': self.config.get('client_secret'),
                'scope': f"{self.environment_url}/.default"
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
                logger.error(f"D365 token request failed: {response.text}")

        except Exception as e:
            logger.error(f"D365 token request error: {str(e)}")

        return None

    def make_request(self, method: str, endpoint: str, data: Dict = None,
                    params: Dict = None) -> Tuple[bool, Dict]:
        """Make authenticated API request to D365"""

        access_token = self.get_access_token()
        if not access_token:
            return False, {'error': 'No valid access token'}

        headers = {
            'Authorization': f'Bearer {access_token}',
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'OData-MaxVersion': '4.0',
            'OData-Version': '4.0'
        }

        url = f"{self.base_url}/{endpoint}"

        try:
            if method.upper() == 'GET':
                response = requests.get(url, headers=headers, params=params, timeout=30)
            elif method.upper() == 'POST':
                response = requests.post(url, headers=headers, json=data, params=params, timeout=30)
            elif method.upper() == 'PUT':
                response = requests.put(url, headers=headers, json=data, params=params, timeout=30)
            elif method.upper() == 'PATCH':
                response = requests.patch(url, headers=headers, json=data, params=params, timeout=30)
            elif method.upper() == 'DELETE':
                response = requests.delete(url, headers=headers, params=params, timeout=30)
            else:
                return False, {'error': f'Unsupported method: {method}'}

            # Handle rate limiting
            if response.status_code == 429:
                retry_after = int(response.headers.get('Retry-After', 60))
                logger.warning(f"D365 rate limited, retry after {retry_after} seconds")
                return False, {'error': 'Rate limited', 'retry_after': retry_after}

            if 200 <= response.status_code < 300:
                try:
                    return True, response.json()
                except json.JSONDecodeError:
                    return True, {'message': 'Success', 'status_code': response.status_code}
            else:
                logger.error(f"D365 API error {response.status_code}: {response.text}")
                return False, {'error': response.text, 'status_code': response.status_code}

        except requests.exceptions.RequestException as e:
            logger.error(f"D365 API request failed: {str(e)}")
            return False, {'error': str(e)}


class Dynamics365SyncService:
    """
    Service for syncing data with Microsoft Dynamics 365
    """

    def __init__(self, tenant, integration: Integration):
        self.tenant = tenant
        self.integration = integration
        self.api_client = Dynamics365APIClient(integration)

    @transaction.atomic
    def sync_customer(self, client: Client, action: str = 'push') -> ZohoSyncLog:
        """Sync customer data with D365"""

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
                success, result = self._push_customer_to_d365(client, sync_log)
            elif action == 'pull':
                success, result = self._pull_customer_from_d365(client, sync_log)
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
            logger.error(f"D365 customer sync failed: {str(e)}")

        sync_log.save()
        return sync_log

    def _push_customer_to_d365(self, client: Client, sync_log: ZohoSyncLog) -> Tuple[bool, Dict]:
        """Push customer data to D365"""

        # Check if customer already exists
        existing_d365_id = self._get_customer_d365_id(client)

        # Prepare customer data for D365 Customer entity
        customer_data = {
            'CustomerAccount': client.client_code,
            'CustomerName': client.name,
            'CustomerType': 'Organization' if client.client_type == 'b2b' else 'Person',
            'TaxRegistrationNumber': client.gstin if client.gstin else '',
            'PrimaryContactEmail': client.email if client.email else '',
            'PrimaryContactPhone': client.phone if client.phone else '',
            'InvoiceAccount': client.client_code,
            'PaymentTerms': f"{client.credit_terms_days}Net" if client.credit_terms_days else '30Net',
            'CurrencyCode': 'INR',
            'LanguageId': 'en-in'
        }

        # Add address information
        if client.billing_address:
            customer_data.update({
                'AddressStreet': client.billing_address.get('address_line_1', ''),
                'AddressCity': client.billing_address.get('city', ''),
                'AddressState': client.billing_address.get('state', ''),
                'AddressZipCode': client.billing_address.get('pincode', ''),
                'AddressCountryRegionId': 'IN'
            })

        sync_log.request_payload = customer_data

        if existing_d365_id:
            # Update existing customer
            success, result = self.api_client.make_request(
                'PATCH',
                f"CustomersV3(dataAreaId='USMF',CustomerAccount='{client.client_code}')",
                data=customer_data
            )
        else:
            # Create new customer
            customer_data['dataAreaId'] = 'USMF'  # Default company
            success, result = self.api_client.make_request(
                'POST',
                'CustomersV3',
                data=customer_data
            )

        if success:
            # Store D365 ID for future reference
            d365_id = client.client_code  # D365 uses CustomerAccount as ID
            sync_log.zoho_id = d365_id  # Reusing zoho_id field for D365 ID

            # Cache the mapping
            cache.set(f"d365_customer_{self.tenant.id}_{client.id}", d365_id, 86400)

        return success, result

    def _pull_customer_from_d365(self, client: Client, sync_log: ZohoSyncLog) -> Tuple[bool, Dict]:
        """Pull customer data from D365"""

        d365_id = self._get_customer_d365_id(client)
        if not d365_id:
            return False, {'error': 'Customer not found in D365'}

        success, result = self.api_client.make_request(
            'GET',
            f"CustomersV3(dataAreaId='USMF',CustomerAccount='{d365_id}')"
        )

        if success and 'value' in result:
            # Update local customer with D365 data
            d365_customer = result['value'][0] if result['value'] else result

            # Handle conflicts - D365 data takes precedence
            if d365_customer.get('CustomerName'):
                client.name = d365_customer['CustomerName']

            if d365_customer.get('TaxRegistrationNumber'):
                client.gstin = d365_customer['TaxRegistrationNumber']

            if d365_customer.get('PrimaryContactEmail'):
                client.email = d365_customer['PrimaryContactEmail']

            client.save()

        return success, result

    def _get_customer_d365_id(self, client: Client) -> Optional[str]:
        """Get D365 customer ID from cache or database"""

        # Check cache first
        cache_key = f"d365_customer_{self.tenant.id}_{client.id}"
        d365_id = cache.get(cache_key)

        if d365_id:
            return d365_id

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
        """Sync item data with D365"""

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
                success, result = self._push_item_to_d365(item, sync_log)
            elif action == 'pull':
                success, result = self._pull_item_from_d365(item, sync_log)
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
            logger.error(f"D365 item sync failed: {str(e)}")

        sync_log.save()
        return sync_log

    def _push_item_to_d365(self, item: Item, sync_log: ZohoSyncLog) -> Tuple[bool, Dict]:
        """Push item data to D365"""

        # Prepare item data for D365 Products entity
        item_data = {
            'ProductNumber': item.item_code,
            'ProductName': item.name,
            'ProductDescription': item.description,
            'ProductType': 'Service' if item.is_service else 'Item',
            'StorageDimensionGroup': 'SiteWH' if not item.is_service else '',
            'TrackingDimensionGroup': 'None',
            'ItemModelGroup': 'STD' if not item.is_service else '',
            'ItemGroup': item.item_category if item.item_category else 'Default',
            'SalesUnitSymbol': item.uqc if item.uqc else 'Pcs',
            'PurchaseUnitSymbol': item.uqc if item.uqc else 'Pcs',
            'InventoryUnitSymbol': item.uqc if item.uqc else 'Pcs',
            'SalesPrice': float(item.default_rate),
            'SalesTaxItemGroup': self._get_d365_tax_group(item.current_gst_rate),
            'PurchaseTaxItemGroup': self._get_d365_tax_group(item.current_gst_rate)
        }

        # Add HSN/SAC code if available
        if item.hsn_sac:
            item_data['HSNCode'] = item.hsn_sac

        sync_log.request_payload = item_data

        # Check if item exists
        existing_d365_id = self._get_item_d365_id(item)

        if existing_d365_id:
            success, result = self.api_client.make_request(
                'PATCH',
                f"ProductsV2(dataAreaId='USMF',ProductNumber='{item.item_code}')",
                data=item_data
            )
        else:
            item_data['dataAreaId'] = 'USMF'
            success, result = self.api_client.make_request(
                'POST',
                'ProductsV2',
                data=item_data
            )

        if success:
            d365_id = item.item_code
            sync_log.zoho_id = d365_id
            cache.set(f"d365_item_{self.tenant.id}_{item.id}", d365_id, 86400)

        return success, result

    def _get_item_d365_id(self, item: Item) -> Optional[str]:
        """Get D365 item ID"""
        cache_key = f"d365_item_{self.tenant.id}_{item.id}"
        return cache.get(cache_key)

    def _get_d365_tax_group(self, gst_rate: float) -> str:
        """Map GST rate to D365 tax group"""
        tax_mapping = {
            0: 'EXEMPT',
            5: 'GST5',
            12: 'GST12',
            18: 'GST18',
            28: 'GST28'
        }
        return tax_mapping.get(int(gst_rate), 'GST18')

    @transaction.atomic
    def sync_invoice(self, invoice: Invoice, action: str = 'push') -> ZohoSyncLog:
        """Sync invoice data with D365"""

        sync_log = ZohoSyncLog.objects.create(
            tenant=self.tenant,
            integration=self.integration,
            entity_type='invoice',
            entity_id=str(invoice.id),
            action=action,
            status='pending'
        )

        try:
            if action == 'push':
                success, result = self._push_invoice_to_d365(invoice, sync_log)
            else:
                success, result = False, {'error': 'Pull not supported for invoices'}

            if success:
                sync_log.status = 'success'
                sync_log.response_payload = result
            else:
                sync_log.status = 'failed'
                sync_log.error_message = result.get('error', 'Unknown error')

        except Exception as e:
            sync_log.status = 'failed'
            sync_log.error_message = str(e)
            logger.error(f"D365 invoice sync failed: {str(e)}")

        sync_log.save()
        return sync_log

    def _push_invoice_to_d365(self, invoice: Invoice, sync_log: ZohoSyncLog) -> Tuple[bool, Dict]:
        """Push invoice data to D365 as Sales Order"""

        # Prepare sales order header
        sales_order_data = {
            'CustomerAccount': invoice.client.client_code,
            'InvoiceAccount': invoice.client.client_code,
            'CurrencyCode': invoice.currency,
            'OrderDate': invoice.date.isoformat(),
            'RequestedReceiptDate': invoice.due_date.isoformat(),
            'SalesOrderNumber': f"{invoice.series}{invoice.number}",
            'PurchaseOrderNumber': f"INV-{invoice.number}",
            'PaymentTerms': f"{invoice.client.credit_terms_days}Net",
            'SalesTaxGroup': 'STANDARD',
            'DeliveryAddress': self._format_d365_address(invoice.client.shipping_address),
            'InvoiceAddress': self._format_d365_address(invoice.client.billing_address)
        }

        sync_log.request_payload = {
            'header': sales_order_data,
            'lines': []
        }

        # Create sales order header
        sales_order_data['dataAreaId'] = 'USMF'
        success, result = self.api_client.make_request(
            'POST',
            'SalesOrderHeaders',
            data=sales_order_data
        )

        if not success:
            return success, result

        # Get created sales order ID
        sales_order_id = result.get('SalesOrderNumber') or sales_order_data['SalesOrderNumber']

        # Create sales order lines
        for line_num, line in enumerate(invoice.lines.all(), 1):
            line_data = {
                'dataAreaId': 'USMF',
                'SalesOrderNumber': sales_order_id,
                'LineNumber': line_num,
                'ItemNumber': line.item.item_code if line.item else 'MISC',
                'ProductName': line.description,
                'SalesQuantity': float(line.quantity),
                'SalesUnit': line.uqc if line.uqc else 'Pcs',
                'SalesPrice': float(line.rate),
                'LineAmount': float(line.line_total),
                'SalesTaxGroup': 'STANDARD',
                'ItemSalesTaxGroup': self._get_d365_tax_group(line.cgst_rate + line.sgst_rate + line.igst_rate)
            }

            sync_log.request_payload['lines'].append(line_data)

            line_success, line_result = self.api_client.make_request(
                'POST',
                'SalesOrderLines',
                data=line_data
            )

            if not line_success:
                logger.warning(f"Failed to create sales order line {line_num}: {line_result}")

        sync_log.zoho_id = sales_order_id
        return True, {'SalesOrderNumber': sales_order_id, 'message': 'Sales order created successfully'}

    def _format_d365_address(self, address_data: Dict) -> Dict:
        """Format address data for D365"""
        if not address_data:
            return {}

        return {
            'Street': address_data.get('address_line_1', ''),
            'City': address_data.get('city', ''),
            'State': address_data.get('state', ''),
            'ZipCode': address_data.get('pincode', ''),
            'CountryRegionId': 'IN'
        }

    def get_sync_status(self) -> Dict[str, Any]:
        """Get overall D365 sync status"""

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

    def test_connection(self) -> Tuple[bool, str]:
        """Test D365 API connection"""

        try:
            success, result = self.api_client.make_request('GET', 'Companies')

            if success:
                company_count = len(result.get('value', []))
                return True, f"Connection successful. Found {company_count} companies."
            else:
                return False, result.get('error', 'Connection failed')

        except Exception as e:
            return False, f"Connection test failed: {str(e)}"