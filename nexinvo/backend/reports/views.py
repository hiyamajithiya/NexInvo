"""
API Views for Reports and GST Returns
"""

from rest_framework import status, permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.http import HttpResponse
import json
import logging

from .models import GSTReturn, ReportTemplate, GeneratedReport, ReportSchedule
from .gst_returns import GSTReturnService
from .financial_dashboard import FinancialDashboardService
from tenants.models import TenantMembership
from datetime import datetime

logger = logging.getLogger(__name__)


def get_user_tenant(request):
    """Get the user's active tenant"""
    membership = request.user.tenant_memberships.filter(is_active=True).first()
    if not membership:
        return None
    return membership.tenant


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def generate_gst_return(request):
    """Generate GST return (GSTR-1 or GSTR-3B)"""
    try:
        # Get user's tenant
        tenant = get_user_tenant(request)
        if not tenant:
            return Response(
                {'error': 'No active tenant found'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Get request parameters
        return_type = request.data.get('return_type')  # 'GSTR1' or 'GSTR3B'
        return_period = request.data.get('return_period')  # 'MMYYYY'
        filing_frequency = request.data.get('filing_frequency', 'MONTHLY')

        if not return_type or not return_period:
            return Response(
                {'error': 'return_type and return_period are required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Validate return type
        if return_type not in ['GSTR1', 'GSTR3B']:
            return Response(
                {'error': 'Invalid return_type. Must be GSTR1 or GSTR3B'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Generate GST return
        gst_service = GSTReturnService(tenant)
        result = gst_service.generate_return(
            return_type=return_type,
            return_period=return_period,
            filing_frequency=filing_frequency
        )

        if result['success']:
            # Save return to database
            gst_return, created = GSTReturn.objects.get_or_create(
                tenant=tenant,
                return_type=return_type,
                return_period=return_period,
                defaults={
                    'filing_frequency': filing_frequency,
                    'return_data': result.get('gstr1_json') or result.get('gstr3b_json'),
                    'filing_status': 'generated',
                    'total_invoices': result.get('invoice_count', 0),
                    'created_by': request.user
                }
            )

            if not created:
                # Update existing return
                gst_return.return_data = result.get('gstr1_json') or result.get('gstr3b_json')
                gst_return.filing_status = 'generated'
                gst_return.total_invoices = result.get('invoice_count', 0)
                gst_return.updated_by = request.user
                gst_return.save()

            return Response({
                'success': True,
                'return_id': str(gst_return.id),
                'return_type': return_type,
                'return_period': return_period,
                'filing_status': gst_return.filing_status,
                'return_data': gst_return.return_data,
                'created_at': gst_return.created_at.isoformat()
            }, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)

        else:
            return Response(result, status=status.HTTP_400_BAD_REQUEST)

    except Exception as e:
        logger.error(f"GST return generation failed: {str(e)}")
        return Response(
            {'error': f'Return generation failed: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def get_gst_return(request, return_id):
    """Get specific GST return details"""
    try:
        # Get user's tenant
        tenant = get_user_tenant(request)
        if not tenant:
            return Response(
                {'error': 'No active tenant found'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Get GST return
        gst_return = get_object_or_404(
            GSTReturn,
            id=return_id,
            tenant=tenant
        )

        return Response({
            'success': True,
            'return_id': str(gst_return.id),
            'return_type': gst_return.return_type,
            'return_period': gst_return.return_period,
            'return_period_display': gst_return.return_period_display,
            'filing_frequency': gst_return.filing_frequency,
            'filing_status': gst_return.filing_status,
            'return_data': gst_return.return_data,
            'validation_result': gst_return.validation_result,
            'total_invoices': gst_return.total_invoices,
            'total_taxable_value': float(gst_return.total_taxable_value),
            'total_tax_amount': float(gst_return.total_tax_amount),
            'total_invoice_value': float(gst_return.total_invoice_value),
            'acknowledgment_number': gst_return.acknowledgment_number,
            'filed_date': gst_return.filed_date.isoformat() if gst_return.filed_date else None,
            'due_date': gst_return.due_date.isoformat() if gst_return.due_date else None,
            'is_overdue': gst_return.is_overdue,
            'created_at': gst_return.created_at.isoformat(),
            'updated_at': gst_return.updated_at.isoformat()
        })

    except Exception as e:
        logger.error(f"GST return retrieval failed: {str(e)}")
        return Response(
            {'error': f'Return retrieval failed: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def list_gst_returns(request):
    """List all GST returns for tenant"""
    try:
        # Get user's tenant
        tenant = get_user_tenant(request)
        if not tenant:
            return Response(
                {'error': 'No active tenant found'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Get query parameters
        return_type = request.GET.get('return_type')
        filing_status = request.GET.get('filing_status')
        limit = int(request.GET.get('limit', 20))

        # Build query
        query = GSTReturn.objects.filter(tenant=tenant)

        if return_type:
            query = query.filter(return_type=return_type)

        if filing_status:
            query = query.filter(filing_status=filing_status)

        # Get returns
        returns = query[:limit]

        return_list = []
        for gst_return in returns:
            return_list.append({
                'id': str(gst_return.id),
                'return_type': gst_return.return_type,
                'return_period': gst_return.return_period,
                'return_period_display': gst_return.return_period_display,
                'filing_frequency': gst_return.filing_frequency,
                'filing_status': gst_return.filing_status,
                'total_invoices': gst_return.total_invoices,
                'total_taxable_value': float(gst_return.total_taxable_value),
                'total_invoice_value': float(gst_return.total_invoice_value),
                'acknowledgment_number': gst_return.acknowledgment_number,
                'filed_date': gst_return.filed_date.isoformat() if gst_return.filed_date else None,
                'due_date': gst_return.due_date.isoformat() if gst_return.due_date else None,
                'is_overdue': gst_return.is_overdue,
                'created_at': gst_return.created_at.isoformat()
            })

        return Response({
            'success': True,
            'returns': return_list,
            'count': len(return_list),
            'total_count': query.count()
        })

    except Exception as e:
        logger.error(f"GST returns listing failed: {str(e)}")
        return Response(
            {'error': f'Returns listing failed: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def validate_gst_return(request, return_id):
    """Validate GST return before filing"""
    try:
        # Get user's tenant
        tenant = get_user_tenant(request)
        if not tenant:
            return Response(
                {'error': 'No active tenant found'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Get GST return
        gst_return = get_object_or_404(
            GSTReturn,
            id=return_id,
            tenant=tenant
        )

        # Validate return
        gst_service = GSTReturnService(tenant)
        validation_result = gst_service.validate_return_data(
            gst_return.return_type,
            gst_return.return_data
        )

        if validation_result['success']:
            # Update return status and validation result
            gst_return.validation_result = validation_result
            gst_return.filing_status = 'validated' if validation_result['is_valid'] else 'failed'
            gst_return.updated_by = request.user
            gst_return.save()

            return Response({
                'success': True,
                'return_id': str(gst_return.id),
                'is_valid': validation_result['is_valid'],
                'validation_errors': validation_result['validation_errors'],
                'warnings': validation_result['warnings'],
                'filing_status': gst_return.filing_status
            })
        else:
            return Response(validation_result, status=status.HTTP_400_BAD_REQUEST)

    except Exception as e:
        logger.error(f"GST return validation failed: {str(e)}")
        return Response(
            {'error': f'Validation failed: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def get_return_summary(request, return_period):
    """Get summary for a return period"""
    try:
        # Get user's tenant
        tenant = get_user_tenant(request)
        if not tenant:
            return Response(
                {'error': 'No active tenant found'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Get return summary
        gst_service = GSTReturnService(tenant)
        result = gst_service.get_return_summary(return_period)

        if result['success']:
            return Response(result)
        else:
            return Response(result, status=status.HTTP_400_BAD_REQUEST)

    except Exception as e:
        logger.error(f"Return summary failed: {str(e)}")
        return Response(
            {'error': f'Summary generation failed: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def download_gst_return(request, return_id):
    """Download GST return JSON"""
    try:
        # Get user's tenant
        tenant = get_user_tenant(request)
        if not tenant:
            return Response(
                {'error': 'No active tenant found'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Get GST return
        gst_return = get_object_or_404(
            GSTReturn,
            id=return_id,
            tenant=tenant
        )

        # Get download format
        download_format = request.data.get('format', 'json')

        if download_format == 'json':
            # Return JSON response
            response = HttpResponse(
                json.dumps(gst_return.return_data, indent=2),
                content_type='application/json'
            )
            filename = f"{gst_return.return_type}_{gst_return.return_period}.json"
            response['Content-Disposition'] = f'attachment; filename="{filename}"'
            return response

        elif download_format == 'excel':
            # TODO: Implement Excel export
            return Response(
                {'error': 'Excel format not yet implemented'},
                status=status.HTTP_501_NOT_IMPLEMENTED
            )

        else:
            return Response(
                {'error': 'Invalid format. Supported formats: json, excel'},
                status=status.HTTP_400_BAD_REQUEST
            )

    except Exception as e:
        logger.error(f"GST return download failed: {str(e)}")
        return Response(
            {'error': f'Download failed: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def get_gst_dashboard(request):
    """Get GST dashboard with summary metrics"""
    try:
        # Get user's tenant
        tenant = get_user_tenant(request)
        if not tenant:
            return Response(
                {'error': 'No active tenant found'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Get recent returns
        recent_returns = GSTReturn.objects.filter(tenant=tenant)[:10]

        # Get filing status summary
        filing_status_summary = {}
        for status_choice in GSTReturn.FILING_STATUS:
            status_code = status_choice[0]
            count = GSTReturn.objects.filter(
                tenant=tenant,
                filing_status=status_code
            ).count()
            filing_status_summary[status_code] = count

        # Get return type summary
        return_type_summary = {}
        for return_type in GSTReturn.RETURN_TYPES:
            type_code = return_type[0]
            count = GSTReturn.objects.filter(
                tenant=tenant,
                return_type=type_code
            ).count()
            return_type_summary[type_code] = count

        # Get overdue returns
        overdue_returns = GSTReturn.objects.filter(
            tenant=tenant,
            due_date__lt=timezone.now(),
            filing_status__in=['draft', 'generated', 'validated']
        ).count()

        # Build recent returns data
        recent_returns_data = []
        for gst_return in recent_returns:
            recent_returns_data.append({
                'id': str(gst_return.id),
                'return_type': gst_return.return_type,
                'return_period_display': gst_return.return_period_display,
                'filing_status': gst_return.filing_status,
                'total_invoices': gst_return.total_invoices,
                'total_invoice_value': float(gst_return.total_invoice_value),
                'is_overdue': gst_return.is_overdue,
                'created_at': gst_return.created_at.isoformat()
            })

        return Response({
            'success': True,
            'summary': {
                'total_returns': GSTReturn.objects.filter(tenant=tenant).count(),
                'overdue_returns': overdue_returns,
                'filing_status_summary': filing_status_summary,
                'return_type_summary': return_type_summary
            },
            'recent_returns': recent_returns_data,
            'generated_at': timezone.now().isoformat()
        })

    except Exception as e:
        logger.error(f"GST dashboard failed: {str(e)}")
        return Response(
            {'error': f'Dashboard generation failed: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def file_gst_return(request, return_id):
    """File GST return (mock implementation)"""
    try:
        # Get user's tenant
        tenant = get_user_tenant(request)
        if not tenant:
            return Response(
                {'error': 'No active tenant found'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Get GST return
        gst_return = get_object_or_404(
            GSTReturn,
            id=return_id,
            tenant=tenant
        )

        # Check if return is validated
        if gst_return.filing_status not in ['validated', 'generated']:
            return Response(
                {'error': 'Return must be validated before filing'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Mock filing process (in real implementation, this would integrate with GST portal)
        # For demo purposes, we'll simulate successful filing

        # Update return status
        gst_return.filing_status = 'filed'
        gst_return.filed_date = timezone.now()
        gst_return.acknowledgment_number = f"ACK{timezone.now().strftime('%Y%m%d%H%M%S')}"
        gst_return.reference_id = f"REF{timezone.now().strftime('%Y%m%d%H%M%S')}"
        gst_return.updated_by = request.user
        gst_return.save()

        return Response({
            'success': True,
            'message': 'GST return filed successfully',
            'return_id': str(gst_return.id),
            'filing_status': gst_return.filing_status,
            'acknowledgment_number': gst_return.acknowledgment_number,
            'reference_id': gst_return.reference_id,
            'filed_date': gst_return.filed_date.isoformat()
        })

    except Exception as e:
        logger.error(f"GST return filing failed: {str(e)}")
        return Response(
            {'error': f'Filing failed: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def get_financial_dashboard(request):
    """Get financial dashboard data with KPIs and charts"""
    try:
        # Get user's tenant
        tenant = get_user_tenant(request)
        if not tenant:
            return Response(
                {'error': 'No active tenant found'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Get date range from query parameters
        start_date_str = request.GET.get('start_date')
        end_date_str = request.GET.get('end_date')

        # Default to last 30 days if not provided
        if not start_date_str or not end_date_str:
            end_date = timezone.now().date()
            start_date = end_date - timedelta(days=30)
        else:
            start_date = datetime.strptime(start_date_str, '%Y-%m-%d').date()
            end_date = datetime.strptime(end_date_str, '%Y-%m-%d').date()

        # Convert to datetime for service
        start_datetime = datetime.combine(start_date, datetime.min.time())
        end_datetime = datetime.combine(end_date, datetime.max.time())

        # Get dashboard data
        dashboard_service = FinancialDashboardService(tenant)
        result = dashboard_service.get_dashboard_data(start_datetime, end_datetime)

        if result['success']:
            return Response(result)
        else:
            return Response(result, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    except Exception as e:
        logger.error(f"Financial dashboard failed: {str(e)}")
        return Response(
            {'error': f'Dashboard generation failed: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def get_revenue_chart(request):
    """Get revenue trend chart data"""
    try:
        # Get user's tenant
        tenant = get_user_tenant(request)
        if not tenant:
            return Response(
                {'error': 'No active tenant found'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Get parameters
        start_date_str = request.GET.get('start_date')
        end_date_str = request.GET.get('end_date')
        period = request.GET.get('period', 'daily')  # daily, weekly, monthly

        if not start_date_str or not end_date_str:
            return Response(
                {'error': 'start_date and end_date are required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        start_date = datetime.strptime(start_date_str, '%Y-%m-%d')
        end_date = datetime.strptime(end_date_str, '%Y-%m-%d')

        # Generate chart data
        dashboard_service = FinancialDashboardService(tenant)
        chart_data = dashboard_service.chart_generator.generate_revenue_trend_chart(
            start_date, end_date, period
        )

        if chart_data['success']:
            return Response(chart_data)
        else:
            return Response(chart_data, status=status.HTTP_400_BAD_REQUEST)

    except Exception as e:
        logger.error(f"Revenue chart generation failed: {str(e)}")
        return Response(
            {'error': f'Chart generation failed: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def get_kpi_summary(request):
    """Get KPI summary for quick overview"""
    try:
        # Get user's tenant
        tenant = get_user_tenant(request)
        if not tenant:
            return Response(
                {'error': 'No active tenant found'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Get current month data
        now = timezone.now()
        start_of_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        end_of_month = now

        # Calculate KPIs
        dashboard_service = FinancialDashboardService(tenant)
        kpi_calculator = dashboard_service.kpi_calculator

        revenue_metrics = kpi_calculator.calculate_revenue_metrics(start_of_month, end_of_month)
        payment_metrics = kpi_calculator.calculate_payment_metrics(start_of_month, end_of_month)

        # Get year-to-date comparison
        start_of_year = now.replace(month=1, day=1, hour=0, minute=0, second=0, microsecond=0)
        ytd_revenue = kpi_calculator.calculate_revenue_metrics(start_of_year, end_of_month)

        return Response({
            'success': True,
            'period': 'current_month',
            'current_month': {
                'total_revenue': revenue_metrics['total_revenue'],
                'outstanding_amount': revenue_metrics['outstanding_revenue'],
                'invoice_count': revenue_metrics['invoice_count'],
                'collection_efficiency': revenue_metrics['collection_efficiency'],
                'overdue_amount': payment_metrics['total_overdue_amount']
            },
            'year_to_date': {
                'total_revenue': ytd_revenue['total_revenue'],
                'invoice_count': ytd_revenue['invoice_count']
            },
            'generated_at': timezone.now().isoformat()
        })

    except Exception as e:
        logger.error(f"KPI summary failed: {str(e)}")
        return Response(
            {'error': f'KPI summary failed: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )