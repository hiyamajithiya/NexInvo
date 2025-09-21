"""
e-Invoice API Views for NexInvo
Handles e-Invoice generation, cancellation, and status management
"""

from rest_framework import status, permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from django.utils import timezone
import json
import logging

from .models import Invoice, EInvoiceDetails
from .einvoice_irp import EInvoiceService, EInvoiceCancellationWorkflow
from .einvoice_monitoring import EInvoiceMonitoringService, EInvoiceStatusTracker, EInvoiceAnalytics
from tenants.models import TenantMembership

logger = logging.getLogger(__name__)


def get_user_tenant(request):
    """Get the user's active tenant"""
    membership = request.user.tenant_memberships.filter(is_active=True).first()
    if not membership:
        return None
    return membership.tenant


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def generate_einvoice(request, invoice_id):
    """Generate e-Invoice for invoice"""
    try:
        # Get user's tenant
        tenant = get_user_tenant(request)
        if not tenant:
            return Response(
                {'error': 'No active tenant found'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Get invoice
        invoice = get_object_or_404(
            Invoice,
            id=invoice_id,
            tenant=tenant
        )

        # Generate e-Invoice
        einvoice_service = EInvoiceService()
        result = einvoice_service.submit_einvoice(invoice)

        if result['success']:
            return Response(result, status=status.HTTP_201_CREATED)
        else:
            return Response(result, status=status.HTTP_400_BAD_REQUEST)

    except Exception as e:
        logger.error(f"e-Invoice generation failed: {str(e)}")
        return Response(
            {'error': f'e-Invoice generation failed: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def get_einvoice_status(request, invoice_id):
    """Get e-Invoice status for invoice"""
    try:
        # Get user's tenant
        tenant = get_user_tenant(request)
        if not tenant:
            return Response(
                {'error': 'No active tenant found'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Get invoice
        invoice = get_object_or_404(
            Invoice,
            id=invoice_id,
            tenant=tenant
        )

        # Get e-Invoice status
        einvoice_service = EInvoiceService()
        result = einvoice_service.get_einvoice_status(invoice)

        return Response(result)

    except Exception as e:
        logger.error(f"e-Invoice status check failed: {str(e)}")
        return Response(
            {'error': f'Status check failed: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def cancel_einvoice(request, invoice_id):
    """Cancel e-Invoice for invoice"""
    try:
        # Get user's tenant
        tenant = get_user_tenant(request)
        if not tenant:
            return Response(
                {'error': 'No active tenant found'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Get invoice
        invoice = get_object_or_404(
            Invoice,
            id=invoice_id,
            tenant=tenant
        )

        # Get cancellation parameters
        cancel_reason = request.data.get('cancel_reason', '4')  # Default: Other
        cancel_remarks = request.data.get('cancel_remarks', 'Invoice cancelled by user')

        # Cancel e-Invoice
        einvoice_service = EInvoiceService()
        result = einvoice_service.cancel_einvoice(
            invoice=invoice,
            cancel_reason=cancel_reason,
            cancel_remarks=cancel_remarks
        )

        if result['success']:
            return Response(result)
        else:
            return Response(result, status=status.HTTP_400_BAD_REQUEST)

    except Exception as e:
        logger.error(f"e-Invoice cancellation failed: {str(e)}")
        return Response(
            {'error': f'e-Invoice cancellation failed: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def initiate_einvoice_cancellation(request, invoice_id):
    """Initiate e-Invoice cancellation workflow"""
    try:
        # Get user's tenant
        tenant = get_user_tenant(request)
        if not tenant:
            return Response(
                {'error': 'No active tenant found'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Get invoice
        invoice = get_object_or_404(
            Invoice,
            id=invoice_id,
            tenant=tenant
        )

        # Get workflow parameters
        reason_code = request.data.get('reason_code', '4')
        remarks = request.data.get('remarks', 'Cancellation requested')
        initiated_by = f"{request.user.first_name} {request.user.last_name}"

        # Initiate cancellation workflow
        cancellation_workflow = EInvoiceCancellationWorkflow()
        result = cancellation_workflow.initiate_cancellation(
            invoice=invoice,
            reason_code=reason_code,
            remarks=remarks,
            initiated_by=initiated_by
        )

        if result['success']:
            return Response(result, status=status.HTTP_201_CREATED)
        else:
            return Response(result, status=status.HTTP_400_BAD_REQUEST)

    except Exception as e:
        logger.error(f"Cancellation workflow initiation failed: {str(e)}")
        return Response(
            {'error': f'Workflow initiation failed: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def approve_cancellation(request, cancellation_id):
    """Approve e-Invoice cancellation request"""
    try:
        # Get approval parameters
        approval_remarks = request.data.get('approval_remarks', '')
        approved_by = f"{request.user.first_name} {request.user.last_name}"

        # Approve cancellation
        cancellation_workflow = EInvoiceCancellationWorkflow()
        result = cancellation_workflow.approve_cancellation(
            cancellation_id=cancellation_id,
            approved_by=approved_by,
            approval_remarks=approval_remarks
        )

        if result['success']:
            return Response(result)
        else:
            return Response(result, status=status.HTTP_400_BAD_REQUEST)

    except Exception as e:
        logger.error(f"Cancellation approval failed: {str(e)}")
        return Response(
            {'error': f'Approval failed: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def reject_cancellation(request, cancellation_id):
    """Reject e-Invoice cancellation request"""
    try:
        # Get rejection parameters
        rejection_reason = request.data.get('rejection_reason', 'Request rejected')
        rejected_by = f"{request.user.first_name} {request.user.last_name}"

        # Reject cancellation
        cancellation_workflow = EInvoiceCancellationWorkflow()
        result = cancellation_workflow.reject_cancellation(
            cancellation_id=cancellation_id,
            rejected_by=rejected_by,
            rejection_reason=rejection_reason
        )

        return Response(result)

    except Exception as e:
        logger.error(f"Cancellation rejection failed: {str(e)}")
        return Response(
            {'error': f'Rejection failed: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def get_cancellation_status(request, cancellation_id):
    """Get e-Invoice cancellation workflow status"""
    try:
        # Get cancellation status
        cancellation_workflow = EInvoiceCancellationWorkflow()
        result = cancellation_workflow.get_cancellation_status(cancellation_id)

        if result['success']:
            return Response(result)
        else:
            return Response(result, status=status.HTTP_404_NOT_FOUND)

    except Exception as e:
        logger.error(f"Cancellation status check failed: {str(e)}")
        return Response(
            {'error': f'Status check failed: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def validate_cancellation_eligibility(request, invoice_id):
    """Validate if invoice is eligible for e-Invoice cancellation"""
    try:
        # Get user's tenant
        tenant = get_user_tenant(request)
        if not tenant:
            return Response(
                {'error': 'No active tenant found'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Get invoice
        invoice = get_object_or_404(
            Invoice,
            id=invoice_id,
            tenant=tenant
        )

        # Validate eligibility
        einvoice_service = EInvoiceService()
        result = einvoice_service.validate_cancellation_eligibility(invoice)

        return Response(result)

    except Exception as e:
        logger.error(f"Cancellation eligibility validation failed: {str(e)}")
        return Response(
            {'error': f'Validation failed: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def bulk_einvoice_operation(request):
    """Perform bulk e-Invoice operations"""
    try:
        # Get user's tenant
        tenant = get_user_tenant(request)
        if not tenant:
            return Response(
                {'error': 'No active tenant found'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Get operation parameters
        invoice_ids = request.data.get('invoice_ids', [])
        operation = request.data.get('operation')  # 'generate' or 'cancel'

        if not invoice_ids:
            return Response(
                {'error': 'No invoice IDs provided'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if operation not in ['generate', 'cancel']:
            return Response(
                {'error': 'Invalid operation. Must be "generate" or "cancel"'},
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

        # Perform bulk operation
        einvoice_service = EInvoiceService()

        if operation == 'cancel':
            # Get cancellation parameters
            cancel_reason = request.data.get('cancel_reason', '4')
            cancel_remarks = request.data.get('cancel_remarks', 'Bulk cancellation')

            result = einvoice_service.bulk_einvoice_operation(
                invoices=list(invoices),
                operation=operation,
                cancel_reason=cancel_reason,
                cancel_remarks=cancel_remarks
            )
        else:
            result = einvoice_service.bulk_einvoice_operation(
                invoices=list(invoices),
                operation=operation
            )

        if result['success']:
            return Response(result)
        else:
            return Response(result, status=status.HTTP_400_BAD_REQUEST)

    except Exception as e:
        logger.error(f"Bulk e-Invoice operation failed: {str(e)}")
        return Response(
            {'error': f'Bulk operation failed: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def get_einvoice_summary(request):
    """Get e-Invoice summary statistics for tenant"""
    try:
        # Get user's tenant
        tenant = get_user_tenant(request)
        if not tenant:
            return Response(
                {'error': 'No active tenant found'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Get date range from query parameters
        from_date = request.GET.get('from_date')
        to_date = request.GET.get('to_date')

        # Build query filters
        filters = {'invoice__tenant': tenant}

        if from_date:
            filters['created_at__gte'] = from_date

        if to_date:
            filters['created_at__lte'] = to_date

        # Get e-Invoice statistics
        einvoice_details = EInvoiceDetails.objects.filter(**filters)

        total_count = einvoice_details.count()
        generated_count = einvoice_details.filter(irp_status='generated').count()
        cancelled_count = einvoice_details.filter(irp_status='cancelled').count()
        failed_count = einvoice_details.filter(irp_status='failed').count()
        pending_count = einvoice_details.filter(irp_status='pending').count()

        # Calculate success rate
        success_rate = (generated_count / total_count * 100) if total_count > 0 else 0

        # Get recent e-Invoices
        recent_einvoices = einvoice_details.order_by('-created_at')[:10]
        recent_data = []

        for detail in recent_einvoices:
            recent_data.append({
                'invoice_number': detail.invoice.number,
                'irn': detail.irn,
                'status': detail.irp_status,
                'ack_date': detail.ack_date.isoformat() if detail.ack_date else None,
                'created_at': detail.created_at.isoformat()
            })

        return Response({
            'success': True,
            'summary': {
                'total_einvoices': total_count,
                'generated': generated_count,
                'cancelled': cancelled_count,
                'failed': failed_count,
                'pending': pending_count,
                'success_rate': round(success_rate, 2)
            },
            'recent_einvoices': recent_data
        })

    except Exception as e:
        logger.error(f"e-Invoice summary retrieval failed: {str(e)}")
        return Response(
            {'error': f'Summary retrieval failed: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def get_cancellation_reasons(request):
    """Get available e-Invoice cancellation reasons"""
    try:
        cancellation_workflow = EInvoiceCancellationWorkflow()
        reasons = cancellation_workflow.CANCELLATION_REASONS

        return Response({
            'success': True,
            'reasons': [
                {'code': code, 'description': description}
                for code, description in reasons.items()
            ]
        })

    except Exception as e:
        logger.error(f"Cancellation reasons retrieval failed: {str(e)}")
        return Response(
            {'error': f'Reasons retrieval failed: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def download_einvoice_json(request, invoice_id):
    """Download e-Invoice JSON for invoice"""
    try:
        # Get user's tenant
        tenant = get_user_tenant(request)
        if not tenant:
            return Response(
                {'error': 'No active tenant found'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Get invoice
        invoice = get_object_or_404(
            Invoice,
            id=invoice_id,
            tenant=tenant
        )

        # Get e-Invoice details
        einvoice_details = EInvoiceDetails.objects.filter(invoice=invoice).first()

        if not einvoice_details or not einvoice_details.irp_request_payload:
            return Response(
                {'error': 'e-Invoice JSON not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Return JSON data
        return Response({
            'success': True,
            'invoice_number': invoice.number,
            'irn': einvoice_details.irn,
            'einvoice_json': einvoice_details.irp_request_payload,
            'generated_at': einvoice_details.created_at.isoformat()
        })

    except Exception as e:
        logger.error(f"e-Invoice JSON download failed: {str(e)}")
        return Response(
            {'error': f'Download failed: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def get_monitoring_dashboard(request):
    """Get comprehensive monitoring dashboard for e-Invoice operations"""
    try:
        # Get user's tenant
        tenant = get_user_tenant(request)
        if not tenant:
            return Response(
                {'error': 'No active tenant found'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Get monitoring dashboard data
        monitoring_service = EInvoiceMonitoringService()
        result = monitoring_service.get_monitoring_dashboard(tenant)

        if result['success']:
            return Response(result)
        else:
            return Response(result, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    except Exception as e:
        logger.error(f"Monitoring dashboard failed: {str(e)}")
        return Response(
            {'error': f'Dashboard generation failed: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def get_comprehensive_status(request, invoice_id):
    """Get comprehensive status for a specific invoice"""
    try:
        # Get user's tenant
        tenant = get_user_tenant(request)
        if not tenant:
            return Response(
                {'error': 'No active tenant found'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Get invoice
        invoice = get_object_or_404(
            Invoice,
            id=invoice_id,
            tenant=tenant
        )

        # Get comprehensive status
        status_tracker = EInvoiceStatusTracker()
        result = status_tracker.get_comprehensive_status(invoice)

        if result['success']:
            return Response(result)
        else:
            return Response(result, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    except Exception as e:
        logger.error(f"Comprehensive status check failed: {str(e)}")
        return Response(
            {'error': f'Status check failed: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def get_real_time_alerts(request):
    """Get real-time alerts for e-Invoice operations"""
    try:
        # Get user's tenant
        tenant = get_user_tenant(request)
        if not tenant:
            return Response(
                {'error': 'No active tenant found'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Get real-time alerts
        status_tracker = EInvoiceStatusTracker()
        result = status_tracker.get_real_time_alerts(tenant)

        if result['success']:
            return Response(result)
        else:
            return Response(result, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    except Exception as e:
        logger.error(f"Alert generation failed: {str(e)}")
        return Response(
            {'error': f'Alert generation failed: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def monitor_bulk_status(request):
    """Monitor status of multiple invoices"""
    try:
        # Get user's tenant
        tenant = get_user_tenant(request)
        if not tenant:
            return Response(
                {'error': 'No active tenant found'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Get invoice IDs
        invoice_ids = request.data.get('invoice_ids', [])

        if not invoice_ids:
            return Response(
                {'error': 'No invoice IDs provided'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Monitor bulk status
        status_tracker = EInvoiceStatusTracker()
        result = status_tracker.monitor_bulk_status(tenant, invoice_ids)

        if result['success']:
            return Response(result)
        else:
            return Response(result, status=status.HTTP_400_BAD_REQUEST)

    except Exception as e:
        logger.error(f"Bulk status monitoring failed: {str(e)}")
        return Response(
            {'error': f'Bulk monitoring failed: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def get_analytics_dashboard(request):
    """Get analytics dashboard metrics"""
    try:
        # Get user's tenant
        tenant = get_user_tenant(request)
        if not tenant:
            return Response(
                {'error': 'No active tenant found'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Get date range from query parameters
        start_date = request.GET.get('start_date')
        end_date = request.GET.get('end_date')

        date_range = None
        if start_date and end_date:
            date_range = {
                'start_date': start_date,
                'end_date': end_date
            }

        # Get analytics
        analytics = EInvoiceAnalytics()
        result = analytics.get_dashboard_metrics(tenant, date_range)

        if result['success']:
            return Response(result)
        else:
            return Response(result, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    except Exception as e:
        logger.error(f"Analytics dashboard failed: {str(e)}")
        return Response(
            {'error': f'Analytics generation failed: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )