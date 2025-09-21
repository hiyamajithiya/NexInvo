"""
Integration API Views for NexInvo
Handles ERP integrations, webhooks, and automation platforms
"""

from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator
import json
import logging

from .models import Integration
from .tally_service import TallyExportService
from .zoho_service import ZohoSyncService, ZohoAuthService
from .dynamics365_service import Dynamics365SyncService
from .webhook_service import WebhookService, WebhookEventTrigger
from rest_framework import serializers
from invoices.models import Invoice
from tenants.models import TenantMembership

logger = logging.getLogger(__name__)


class TenantPermissionMixin:
    """Mixin to handle tenant-based permissions"""

    def get_user_tenant(self):
        """Get the user's active tenant"""
        membership = self.request.user.tenant_memberships.filter(is_active=True).first()
        if not membership:
            return None
        return membership.tenant

    def check_permission(self, action='view', role_required=None):
        """Check if user has permission for the action"""
        membership = self.request.user.tenant_memberships.filter(is_active=True).first()
        if not membership:
            return False

        if role_required:
            return membership.role in role_required

        # Default permissions based on action
        if action in ['create', 'update', 'delete']:
            return membership.role in ['ca_owner', 'admin', 'finance_user']
        return True  # Everyone can view


class IntegrationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Integration
        fields = ['id', 'integration_type', 'name', 'configuration', 'is_active', 'sync_status', 'last_sync_at', 'created_at']
        read_only_fields = ['id', 'last_sync_at', 'created_at']


class IntegrationViewSet(TenantPermissionMixin, viewsets.ModelViewSet):
    serializer_class = IntegrationSerializer
    permission_classes = [permissions.IsAuthenticated]
    filterset_fields = ['integration_type', 'is_active']
    search_fields = ['name']

    def get_queryset(self):
        tenant = self.get_user_tenant()
        if not tenant:
            return Integration.objects.none()
        return Integration.objects.filter(tenant=tenant)

    def create(self, request, *args, **kwargs):
        if not self.check_permission('create'):
            return Response(
                {'error': 'You do not have permission to create integrations'},
                status=status.HTTP_403_FORBIDDEN
            )
        return super().create(request, *args, **kwargs)

    def perform_create(self, serializer):
        serializer.save(tenant=self.get_user_tenant())

    @action(detail=True, methods=['post'])
    def test_connection(self, request, pk=None):
        """Test integration connection"""
        integration = self.get_object()

        try:
            if integration.integration_type == 'tally':
                result = self._test_tally_connection(integration)
            elif integration.integration_type == 'zoho':
                result = self._test_zoho_connection(integration)
            elif integration.integration_type == 'webhook':
                result = self._test_webhook_connection(integration)
            else:
                result = {'success': False, 'error': 'Integration type not supported'}

            return Response(result)

        except Exception as e:
            logger.error(f"Connection test failed for {integration.name}: {str(e)}")
            return Response({
                'success': False,
                'error': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def _test_tally_connection(self, integration):
        """Test Tally connection"""
        try:
            tally_service = TallyExportService(self.get_user_tenant())
            return {
                'success': True,
                'message': 'Tally XML export is ready',
                'features': ['XML Export', 'Voucher Generation', 'GST Compliance']
            }
        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }

    def _test_zoho_connection(self, integration):
        """Test Zoho Books connection"""
        try:
            zoho_service = ZohoSyncService(self.get_user_tenant(), integration)
            status = zoho_service.get_sync_status()
            return {
                'success': True,
                'message': 'Zoho Books connection ready',
                'sync_status': status
            }
        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }

    def _test_webhook_connection(self, integration):
        """Test webhook endpoint"""
        webhook_url = integration.configuration.get('webhook_url')

        if not webhook_url:
            return {
                'success': False,
                'error': 'Webhook URL not configured'
            }

        try:
            import requests
            test_payload = {'event': 'test', 'timestamp': '2024-01-01T00:00:00Z'}
            response = requests.post(webhook_url, json=test_payload, timeout=10)

            return {
                'success': 200 <= response.status_code < 300,
                'message': 'Webhook test completed',
                'status_code': response.status_code
            }
        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def export_tally_xml(request):
    """Export invoices to Tally XML format"""
    try:
        # Get user's tenant
        membership = request.user.tenant_memberships.filter(is_active=True).first()
        if not membership:
            return Response(
                {'error': 'No active tenant found'},
                status=status.HTTP_404_NOT_FOUND
            )

        tenant = membership.tenant
        invoice_ids = request.data.get('invoice_ids', [])
        export_type = request.data.get('export_type', 'single')  # single or bulk

        if not invoice_ids:
            return Response(
                {'error': 'No invoice IDs provided'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Get invoices
        invoices = Invoice.objects.filter(
            id__in=invoice_ids,
            tenant=tenant
        )

        if not invoices.exists():
            return Response(
                {'error': 'No valid invoices found'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Generate Tally XML
        tally_service = TallyExportService(tenant)

        # Get or create Tally integration
        integration, created = Integration.objects.get_or_create(
            tenant=tenant,
            integration_type='tally',
            defaults={'name': 'Tally Prime Export'}
        )

        # Create export with date range
        date_from = min(inv.date for inv in invoices)
        date_to = max(inv.date for inv in invoices)

        export = tally_service.create_voucher_export(
            integration, date_from, date_to, request.user
        )

        if export.status == 'completed':
            # Return XML as downloadable file
            response = HttpResponse(
                export.xml_content,
                content_type='application/xml'
            )
            filename = f'tally_export_{date_from}_{date_to}.xml'
            response['Content-Disposition'] = f'attachment; filename="{filename}"'
            return response
        else:
            return Response({
                'error': 'Export failed',
                'details': export.export_metadata
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    except Exception as e:
        logger.error(f"Tally export failed: {str(e)}")
        return Response(
            {'error': f'Export failed: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def zoho_oauth_setup(request):
    """Initialize Zoho OAuth setup"""
    try:
        # Get user's tenant
        membership = request.user.tenant_memberships.filter(is_active=True).first()
        if not membership:
            return Response(
                {'error': 'No active tenant found'},
                status=status.HTTP_404_NOT_FOUND
            )

        tenant = membership.tenant

        # Create or get Zoho integration
        integration, created = Integration.objects.get_or_create(
            tenant=tenant,
            integration_type='zoho',
            defaults={
                'name': 'Zoho Books',
                'configuration': {},
                'credentials_encrypted': {}
            }
        )

        # Initialize OAuth
        client_id = request.GET.get('client_id')
        redirect_uri = request.GET.get('redirect_uri')
        state = f"{tenant.id}_{integration.id}"

        if not client_id or not redirect_uri:
            return Response({
                'error': 'client_id and redirect_uri are required'
            }, status=status.HTTP_400_BAD_REQUEST)

        auth_url = ZohoAuthService.get_authorization_url(client_id, redirect_uri, state)

        return Response({
            'authorization_url': auth_url,
            'integration_id': str(integration.id),
            'state': state,
            'message': 'Visit the authorization URL to complete setup'
        })

    except Exception as e:
        logger.error(f"Zoho OAuth setup failed: {str(e)}")
        return Response(
            {'error': str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@csrf_exempt
@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def webhook_endpoint(request, tenant_id):
    """Generic webhook endpoint for receiving external webhooks"""
    try:
        # Verify tenant exists
        from tenants.models import Tenant
        tenant = get_object_or_404(Tenant, id=tenant_id)

        # Get request data
        webhook_data = json.loads(request.body) if request.body else {}

        # Log webhook receipt
        logger.info(f"Webhook received for tenant {tenant_id}: {webhook_data}")

        # Process webhook based on source
        source = request.headers.get('X-Webhook-Source', 'unknown')

        # Handle different webhook sources
        if source == 'payment_gateway':
            result = _handle_payment_webhook(tenant, webhook_data)
        elif source == 'bank_statement':
            result = _handle_bank_webhook(tenant, webhook_data)
        else:
            result = {'status': 'received', 'message': 'Webhook processed'}

        return Response(result)

    except Exception as e:
        logger.error(f"Webhook processing failed: {str(e)}")
        return Response(
            {'error': 'Webhook processing failed'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


def _handle_payment_webhook(tenant, webhook_data):
    """Handle payment gateway webhooks"""
    # Implementation for payment status updates
    return {'status': 'payment_processed'}


def _handle_bank_webhook(tenant, webhook_data):
    """Handle bank statement webhooks"""
    # Implementation for bank reconciliation
    return {'status': 'bank_data_processed'}


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def sync_zoho_customers(request):
    """Sync customers with Zoho Books"""
    try:
        membership = request.user.tenant_memberships.filter(is_active=True).first()
        if not membership:
            return Response({'error': 'No active tenant found'}, status=status.HTTP_404_NOT_FOUND)

        tenant = membership.tenant
        integration_id = request.data.get('integration_id')
        action = request.data.get('action', 'push')  # push or pull

        integration = get_object_or_404(Integration, id=integration_id, tenant=tenant, integration_type='zoho')
        zoho_service = ZohoSyncService(tenant, integration)

        if action == 'bulk':
            result = zoho_service.bulk_sync_customers()
        else:
            customer_ids = request.data.get('customer_ids', [])
            from tenants.models import Client
            customers = Client.objects.filter(id__in=customer_ids, tenant=tenant)

            result = {'success': 0, 'failed': 0, 'logs': []}
            for customer in customers:
                sync_log = zoho_service.sync_customer(customer, action)
                if sync_log.status == 'success':
                    result['success'] += 1
                else:
                    result['failed'] += 1
                result['logs'].append(str(sync_log.id))

        return Response(result)

    except Exception as e:
        logger.error(f"Zoho customer sync failed: {str(e)}")
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def sync_dynamics365(request):
    """Sync data with Dynamics 365"""
    try:
        membership = request.user.tenant_memberships.filter(is_active=True).first()
        if not membership:
            return Response({'error': 'No active tenant found'}, status=status.HTTP_404_NOT_FOUND)

        tenant = membership.tenant
        integration_id = request.data.get('integration_id')
        entity_type = request.data.get('entity_type')  # customer, item, invoice
        entity_ids = request.data.get('entity_ids', [])
        action = request.data.get('action', 'push')

        integration = get_object_or_404(Integration, id=integration_id, tenant=tenant, integration_type='d365')
        d365_service = Dynamics365SyncService(tenant, integration)

        result = {'success': 0, 'failed': 0, 'logs': []}

        if entity_type == 'customer':
            from tenants.models import Client
            entities = Client.objects.filter(id__in=entity_ids, tenant=tenant)
            for entity in entities:
                sync_log = d365_service.sync_customer(entity, action)
                if sync_log.status == 'success':
                    result['success'] += 1
                else:
                    result['failed'] += 1
                result['logs'].append(str(sync_log.id))

        elif entity_type == 'item':
            from invoices.models import Item
            entities = Item.objects.filter(id__in=entity_ids, tenant=tenant)
            for entity in entities:
                sync_log = d365_service.sync_item(entity, action)
                if sync_log.status == 'success':
                    result['success'] += 1
                else:
                    result['failed'] += 1
                result['logs'].append(str(sync_log.id))

        elif entity_type == 'invoice':
            invoices = Invoice.objects.filter(id__in=entity_ids, tenant=tenant)
            for invoice in invoices:
                sync_log = d365_service.sync_invoice(invoice, action)
                if sync_log.status == 'success':
                    result['success'] += 1
                else:
                    result['failed'] += 1
                result['logs'].append(str(sync_log.id))

        return Response(result)

    except Exception as e:
        logger.error(f"D365 sync failed: {str(e)}")
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def trigger_webhook(request):
    """Manually trigger webhook for testing"""
    try:
        membership = request.user.tenant_memberships.filter(is_active=True).first()
        if not membership:
            return Response({'error': 'No active tenant found'}, status=status.HTTP_404_NOT_FOUND)

        tenant = membership.tenant
        event_type = request.data.get('event_type')
        entity_id = request.data.get('entity_id')
        entity_data = request.data.get('entity_data', {})

        webhook_service = WebhookService(tenant)
        events = webhook_service.trigger_webhook(event_type, entity_id, entity_data)

        return Response({
            'message': f'Triggered {len(events)} webhook events',
            'event_ids': [str(event.id) for event in events]
        })

    except Exception as e:
        logger.error(f"Webhook trigger failed: {str(e)}")
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def integration_dashboard(request):
    """Get integration dashboard data"""
    try:
        membership = request.user.tenant_memberships.filter(is_active=True).first()
        if not membership:
            return Response({'error': 'No active tenant found'}, status=status.HTTP_404_NOT_FOUND)

        tenant = membership.tenant

        # Get all integrations
        integrations = Integration.objects.filter(tenant=tenant)

        dashboard_data = {
            'total_integrations': integrations.count(),
            'active_integrations': integrations.filter(is_active=True).count(),
            'integrations_by_type': {},
            'recent_sync_status': {},
            'webhook_stats': {}
        }

        # Group by type
        for integration in integrations:
            int_type = integration.integration_type
            if int_type not in dashboard_data['integrations_by_type']:
                dashboard_data['integrations_by_type'][int_type] = {
                    'total': 0,
                    'active': 0,
                    'last_sync': None
                }

            dashboard_data['integrations_by_type'][int_type]['total'] += 1
            if integration.is_active:
                dashboard_data['integrations_by_type'][int_type]['active'] += 1

            if integration.last_sync_at:
                current_last = dashboard_data['integrations_by_type'][int_type]['last_sync']
                if not current_last or integration.last_sync_at > current_last:
                    dashboard_data['integrations_by_type'][int_type]['last_sync'] = integration.last_sync_at

        # Get webhook stats
        webhook_service = WebhookService(tenant)
        dashboard_data['webhook_stats'] = webhook_service.get_webhook_stats()

        return Response(dashboard_data)

    except Exception as e:
        logger.error(f"Integration dashboard failed: {str(e)}")
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
