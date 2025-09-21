"""
QR Code API Views for NexInvo
Handles QR code generation, payment tracking, and embedding
"""

from rest_framework import status, permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from decimal import Decimal
import json
import logging

from .models import Invoice, QRCodePayment
from .qr_code_system import DynamicQRService
from .qr_placement import QRPlacementEngine, QRTemplateManager
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
def generate_qr_code(request, invoice_id):
    """Generate QR code for invoice payment"""
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

        # Get request parameters
        payment_method = request.data.get('payment_method', 'upi')
        expiry_hours = int(request.data.get('expiry_hours', 24))
        custom_amount = request.data.get('custom_amount')

        if custom_amount:
            custom_amount = Decimal(str(custom_amount))

        # Generate QR code
        qr_service = DynamicQRService()
        result = qr_service.create_payment_qr(
            invoice=invoice,
            payment_method=payment_method,
            expiry_hours=expiry_hours,
            custom_amount=custom_amount
        )

        if result['success']:
            return Response(result, status=status.HTTP_201_CREATED)
        else:
            return Response(result, status=status.HTTP_400_BAD_REQUEST)

    except Exception as e:
        logger.error(f"QR generation failed: {str(e)}")
        return Response(
            {'error': f'QR generation failed: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def get_qr_status(request, qr_payment_id):
    """Get QR code payment status"""
    try:
        # Get user's tenant
        tenant = get_user_tenant(request)
        if not tenant:
            return Response(
                {'error': 'No active tenant found'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Check QR payment status
        qr_service = DynamicQRService()
        result = qr_service.check_payment_status(qr_payment_id)

        # Verify tenant ownership
        if result['success']:
            try:
                qr_payment = QRCodePayment.objects.get(id=qr_payment_id)
                if qr_payment.tenant != tenant:
                    return Response(
                        {'error': 'QR payment not found'},
                        status=status.HTTP_404_NOT_FOUND
                    )
            except QRCodePayment.DoesNotExist:
                return Response(
                    {'error': 'QR payment not found'},
                    status=status.HTTP_404_NOT_FOUND
                )

        return Response(result)

    except Exception as e:
        logger.error(f"QR status check failed: {str(e)}")
        return Response(
            {'error': f'Status check failed: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def expire_qr_code(request, qr_payment_id):
    """Manually expire QR code"""
    try:
        # Get user's tenant
        tenant = get_user_tenant(request)
        if not tenant:
            return Response(
                {'error': 'No active tenant found'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Verify ownership
        qr_payment = get_object_or_404(
            QRCodePayment,
            id=qr_payment_id,
            tenant=tenant
        )

        # Expire QR code
        qr_service = DynamicQRService()
        result = qr_service.expire_qr_code(qr_payment_id)

        return Response(result)

    except Exception as e:
        logger.error(f"QR expiration failed: {str(e)}")
        return Response(
            {'error': f'QR expiration failed: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def regenerate_qr_code(request, invoice_id):
    """Regenerate QR code for invoice"""
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

        # Get old QR payment ID
        old_qr_payment_id = request.data.get('old_qr_payment_id')
        expiry_hours = int(request.data.get('expiry_hours', 24))

        if not old_qr_payment_id:
            return Response(
                {'error': 'old_qr_payment_id is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Regenerate QR code
        qr_service = DynamicQRService()
        result = qr_service.regenerate_qr_code(
            invoice=invoice,
            old_qr_payment_id=old_qr_payment_id,
            expiry_hours=expiry_hours
        )

        if result['success']:
            return Response(result, status=status.HTTP_201_CREATED)
        else:
            return Response(result, status=status.HTTP_400_BAD_REQUEST)

    except Exception as e:
        logger.error(f"QR regeneration failed: {str(e)}")
        return Response(
            {'error': f'QR regeneration failed: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def embed_qr_in_invoice(request, invoice_id):
    """Generate invoice HTML with embedded QR code"""
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

        # Get request parameters
        template_name = request.data.get('template_name', 'standard_invoice')
        payment_method = request.data.get('payment_method', 'upi')
        custom_position = request.data.get('custom_position')

        # Embed QR code in invoice
        placement_engine = QRPlacementEngine()
        result = placement_engine.embed_qr_in_invoice_html(
            invoice=invoice,
            template_name=template_name,
            payment_method=payment_method,
            custom_position=custom_position
        )

        if result['success']:
            return Response(result)
        else:
            return Response(result, status=status.HTTP_400_BAD_REQUEST)

    except Exception as e:
        logger.error(f"QR embedding failed: {str(e)}")
        return Response(
            {'error': f'QR embedding failed: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def generate_invoice_pdf_with_qr(request, invoice_id):
    """Generate PDF invoice with embedded QR code"""
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

        # Get request parameters
        template_name = request.data.get('template_name', 'standard_invoice')
        payment_method = request.data.get('payment_method', 'upi')

        # Generate PDF with QR code
        placement_engine = QRPlacementEngine()
        result = placement_engine.embed_qr_in_pdf(
            invoice=invoice,
            template_name=template_name,
            payment_method=payment_method
        )

        if result['success']:
            return Response(result)
        else:
            return Response(result, status=status.HTTP_400_BAD_REQUEST)

    except Exception as e:
        logger.error(f"PDF generation with QR failed: {str(e)}")
        return Response(
            {'error': f'PDF generation failed: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def get_qr_templates(request):
    """Get available QR code templates"""
    try:
        template_manager = QRTemplateManager()

        # Return available templates
        templates = {
            'standard_invoice': {
                'name': 'Standard Invoice',
                'description': 'QR code in payment section with full instructions',
                'position': 'payment_section',
                'size': [120, 120],
                'show_instructions': True
            },
            'minimal_invoice': {
                'name': 'Minimal Invoice',
                'description': 'Small QR code in footer without instructions',
                'position': 'footer_center',
                'size': [100, 100],
                'show_instructions': False
            },
            'professional_invoice': {
                'name': 'Professional Invoice',
                'description': 'Large QR code in sidebar with styled background',
                'position': 'sidebar',
                'size': [140, 140],
                'show_instructions': True
            },
            'compact_invoice': {
                'name': 'Compact Invoice',
                'description': 'Small QR code in bottom corner',
                'position': 'bottom_right',
                'size': [80, 80],
                'show_instructions': False
            }
        }

        return Response({
            'success': True,
            'templates': templates
        })

    except Exception as e:
        logger.error(f"Template retrieval failed: {str(e)}")
        return Response(
            {'error': f'Template retrieval failed: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def create_custom_template(request):
    """Create custom QR code template"""
    try:
        # Get request data
        name = request.data.get('name')
        position = request.data.get('position', 'payment_section')
        size = request.data.get('size', [120, 120])
        styling = request.data.get('styling', {})

        if not name:
            return Response(
                {'error': 'Template name is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Create template
        template_manager = QRTemplateManager()
        result = template_manager.create_template(
            name=name,
            position=position,
            size=tuple(size),
            styling=styling
        )

        return Response(result, status=status.HTTP_201_CREATED)

    except Exception as e:
        logger.error(f"Template creation failed: {str(e)}")
        return Response(
            {'error': f'Template creation failed: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def preview_template(request):
    """Preview QR code template"""
    try:
        # Get template configuration
        template_config = request.data.get('template_config', {})

        # Generate preview
        template_manager = QRTemplateManager()
        result = template_manager.get_template_preview(template_config)

        return Response(result)

    except Exception as e:
        logger.error(f"Template preview failed: {str(e)}")
        return Response(
            {'error': f'Template preview failed: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def get_invoice_qr_codes(request, invoice_id):
    """Get all QR codes for an invoice"""
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

        # Get QR codes for invoice
        qr_payments = QRCodePayment.objects.filter(
            invoice=invoice,
            tenant=tenant
        ).order_by('-created_at')

        qr_codes = []
        for qr_payment in qr_payments:
            qr_codes.append({
                'id': str(qr_payment.id),
                'payment_method': qr_payment.payment_method,
                'amount': float(qr_payment.amount),
                'transaction_reference': qr_payment.transaction_reference,
                'status': qr_payment.qr_status,
                'expiry_time': qr_payment.expiry_time.isoformat(),
                'created_at': qr_payment.created_at.isoformat(),
                'scan_count': qr_payment.scan_count,
                'is_active': qr_payment.is_active,
                'is_expired': qr_payment.is_expired
            })

        return Response({
            'success': True,
            'qr_codes': qr_codes,
            'count': len(qr_codes)
        })

    except Exception as e:
        logger.error(f"QR codes retrieval failed: {str(e)}")
        return Response(
            {'error': f'QR codes retrieval failed: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def track_qr_scan(request, qr_payment_id):
    """Track QR code scan (public endpoint for analytics)"""
    try:
        # Get QR payment
        qr_payment = get_object_or_404(QRCodePayment, id=qr_payment_id)

        # Increment scan count
        qr_payment.increment_scan_count()

        return Response({
            'success': True,
            'message': 'Scan tracked successfully',
            'scan_count': qr_payment.scan_count
        })

    except Exception as e:
        logger.error(f"QR scan tracking failed: {str(e)}")
        return Response(
            {'error': 'Tracking failed'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def qr_payment_redirect(request, qr_payment_id):
    """Redirect to payment URL from QR code scan"""
    try:
        # Get QR payment
        qr_payment = get_object_or_404(QRCodePayment, id=qr_payment_id)

        # Check if QR is active
        if not qr_payment.is_active:
            return Response({
                'error': 'QR code is expired or inactive',
                'status': qr_payment.qr_status
            }, status=status.HTTP_410_GONE)

        # Track scan
        qr_payment.increment_scan_count()

        # Return payment data for app handling
        return Response({
            'success': True,
            'payment_url': qr_payment.qr_code_data,
            'amount': float(qr_payment.amount),
            'merchant_name': qr_payment.metadata.get('merchant_name', ''),
            'transaction_reference': qr_payment.transaction_reference,
            'invoice_number': qr_payment.invoice.number
        })

    except Exception as e:
        logger.error(f"QR redirect failed: {str(e)}")
        return Response(
            {'error': 'Redirect failed'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )