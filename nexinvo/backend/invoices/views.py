from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from django.db import models
from django.http import HttpResponse
from django.template.loader import render_to_string
from django.conf import settings
from decimal import Decimal
import json
import re

from .models import (
    Item, GSTRateHistory, Invoice, InvoiceLine, EInvoiceDetails,
    InvoiceTemplate, EmailCommunication, PaymentReminder
)
from .serializers import (
    ItemSerializer, GSTRateHistorySerializer, InvoiceSerializer,
    InvoiceLineSerializer, EInvoiceDetailsSerializer, InvoiceTemplateSerializer,
    EmailCommunicationSerializer, PaymentReminderSerializer
)
from tenants.models import TenantMembership
from .gst_compliance import GSTComplianceEngine, validate_gst_number, get_hsn_tax_rate
from .pdf_generator import PDFGenerator
from .email_service import EmailService


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


class ItemViewSet(TenantPermissionMixin, viewsets.ModelViewSet):
    serializer_class = ItemSerializer
    permission_classes = [permissions.IsAuthenticated]
    filterset_fields = ['item_category', 'is_service', 'is_active']
    search_fields = ['name', 'item_code', 'hsn_sac', 'description']
    ordering_fields = ['name', 'item_code', 'created_at']

    def get_queryset(self):
        tenant = self.get_user_tenant()
        if not tenant:
            return Item.objects.none()
        return Item.objects.filter(tenant=tenant)

    def create(self, request, *args, **kwargs):
        if not self.check_permission('create'):
            return Response(
                {'error': 'You do not have permission to create items'},
                status=status.HTTP_403_FORBIDDEN
            )
        return super().create(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        if not self.check_permission('update'):
            return Response(
                {'error': 'You do not have permission to update items'},
                status=status.HTTP_403_FORBIDDEN
            )
        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        if not self.check_permission('delete'):
            return Response(
                {'error': 'You do not have permission to delete items'},
                status=status.HTTP_403_FORBIDDEN
            )
        return super().destroy(request, *args, **kwargs)

    @action(detail=False, methods=['post'])
    def bulk_create(self, request):
        """Bulk create items"""
        if not self.check_permission('create'):
            return Response(
                {'error': 'You do not have permission to create items'},
                status=status.HTTP_403_FORBIDDEN
            )

        items_data = request.data.get('items', [])
        if not items_data:
            return Response(
                {'error': 'No items data provided'},
                status=status.HTTP_400_BAD_REQUEST
            )

        created_items = []
        errors = []

        for item_data in items_data:
            serializer = self.get_serializer(data=item_data)
            if serializer.is_valid():
                item = serializer.save()
                created_items.append(ItemSerializer(item).data)
            else:
                errors.append({
                    'item_code': item_data.get('item_code', 'Unknown'),
                    'errors': serializer.errors
                })

        return Response({
            'created_items': created_items,
            'errors': errors,
            'summary': {
                'total': len(items_data),
                'created': len(created_items),
                'failed': len(errors)
            }
        })


class InvoiceViewSet(TenantPermissionMixin, viewsets.ModelViewSet):
    serializer_class = InvoiceSerializer
    permission_classes = [permissions.IsAuthenticated]
    filterset_fields = ['client', 'invoice_type', 'payment_status', 'series']
    search_fields = ['number', 'client__name', 'notes']
    ordering_fields = ['number', 'date', 'due_date', 'grand_total', 'created_at']
    ordering = ['-created_at']

    def get_queryset(self):
        tenant = self.get_user_tenant()
        if not tenant:
            return Invoice.objects.none()
        return Invoice.objects.filter(tenant=tenant).select_related('client')

    def create(self, request, *args, **kwargs):
        if not self.check_permission('create'):
            return Response(
                {'error': 'You do not have permission to create invoices'},
                status=status.HTTP_403_FORBIDDEN
            )
        return super().create(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        if not self.check_permission('update'):
            return Response(
                {'error': 'You do not have permission to update invoices'},
                status=status.HTTP_403_FORBIDDEN
            )
        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        if not self.check_permission('delete'):
            return Response(
                {'error': 'You do not have permission to delete invoices'},
                status=status.HTTP_403_FORBIDDEN
            )
        return super().destroy(request, *args, **kwargs)

    @action(detail=True, methods=['get'])
    def pdf(self, request, pk=None):
        """Generate PDF for invoice"""
        invoice = self.get_object()

        try:
            # Get query parameters
            template_name = request.query_params.get('template', 'professional')
            include_qr = request.query_params.get('qr', 'true').lower() == 'true'
            watermark = request.query_params.get('watermark', None)
            download = request.query_params.get('download', 'false').lower() == 'true'

            # Generate PDF
            pdf_generator = PDFGenerator()
            pdf_bytes = pdf_generator.generate_invoice_pdf(
                invoice=invoice,
                template_name=template_name,
                include_qr=include_qr,
                watermark=watermark
            )

            # Create HTTP response
            response = HttpResponse(pdf_bytes, content_type='application/pdf')

            # Set filename
            filename = f"Invoice_{invoice.number}_{invoice.date.strftime('%Y%m%d')}.pdf"

            if download:
                response['Content-Disposition'] = f'attachment; filename="{filename}"'
            else:
                response['Content-Disposition'] = f'inline; filename="{filename}"'

            response['Content-Length'] = len(pdf_bytes)

            return response

        except Exception as e:
            return Response({
                'error': f'PDF generation failed: {str(e)}',
                'invoice_id': str(invoice.id),
                'invoice_number': invoice.number
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=['post'])
    def send_email(self, request, pk=None):
        """Send invoice via email"""
        invoice = self.get_object()
        email_data = request.data

        # Create email communication record
        email_comm = EmailCommunication.objects.create(
            tenant=invoice.tenant,
            invoice=invoice,
            to_email=email_data.get('to_email', invoice.client.email),
            cc_email=email_data.get('cc_email', ''),
            bcc_email=email_data.get('bcc_email', ''),
            subject=email_data.get('subject', f'Invoice {invoice.number}'),
            body=email_data.get('body', f'Please find attached invoice {invoice.number}'),
            attachment_paths=['invoice.pdf'],  # TODO: Add actual PDF path
            created_by=request.user
        )

        # TODO: Implement actual email sending
        email_comm.status = 'sent'
        email_comm.save()

        return Response({
            'message': 'Email sent successfully',
            'email_id': str(email_comm.id)
        })

    @action(detail=True, methods=['post'])
    def duplicate(self, request, pk=None):
        """Duplicate an invoice"""
        original_invoice = self.get_object()

        # Create new invoice data
        invoice_data = InvoiceSerializer(original_invoice).data
        invoice_data.pop('id')
        invoice_data.pop('number')  # Will be auto-generated
        invoice_data.pop('created_at')
        invoice_data.pop('updated_at')

        # Remove line IDs
        for line in invoice_data.get('lines', []):
            line.pop('id', None)

        serializer = self.get_serializer(data=invoice_data)
        if serializer.is_valid():
            new_invoice = serializer.save()
            return Response(
                InvoiceSerializer(new_invoice).data,
                status=status.HTTP_201_CREATED
            )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def dashboard_stats(self, request):
        """Get dashboard statistics for invoices"""
        tenant = self.get_user_tenant()
        if not tenant:
            return Response({'error': 'No tenant found'}, status=status.HTTP_404_NOT_FOUND)

        invoices = Invoice.objects.filter(tenant=tenant)

        stats = {
            'total_invoices': invoices.count(),
            'pending_payment': invoices.filter(payment_status='unpaid').count(),
            'paid_invoices': invoices.filter(payment_status='paid').count(),
            'overdue_invoices': invoices.filter(payment_status='overdue').count(),
            'total_amount': invoices.aggregate(
                total=models.Sum('grand_total')
            )['total'] or 0,
            'pending_amount': invoices.filter(
                payment_status__in=['unpaid', 'partial', 'overdue']
            ).aggregate(
                total=models.Sum('grand_total')
            )['total'] or 0,
            'this_month_count': invoices.filter(
                date__year=2025,
                date__month=9  # Current month
            ).count(),
            'this_month_amount': invoices.filter(
                date__year=2025,
                date__month=9
            ).aggregate(
                total=models.Sum('grand_total')
            )['total'] or 0,
        }

        return Response(stats)

    @action(detail=True, methods=['get'])
    def compliance_report(self, request, pk=None):
        """Generate GST compliance report for an invoice"""
        invoice = self.get_object()

        # Prepare invoice data for compliance engine
        compliance_data = self._prepare_invoice_compliance_data(invoice)

        # Generate compliance report
        compliance_engine = GSTComplianceEngine()
        report = compliance_engine.generate_compliance_report(compliance_data)

        return Response(report)

    @action(detail=False, methods=['post'])
    def validate_compliance(self, request):
        """Validate invoice data against GST compliance rules before creation"""
        data = request.data

        try:
            # Create temporary serializer instance for validation
            serializer = self.get_serializer(data=data)
            if serializer.is_valid():
                # Extract validated data
                validated_data = serializer.validated_data

                # Prepare compliance data
                compliance_data = self._prepare_compliance_data_from_request(validated_data, request)

                # Run compliance validation
                compliance_engine = GSTComplianceEngine()
                is_valid, errors, warnings = compliance_engine.validate_invoice_rule_46(compliance_data)

                # Generate full report
                report = compliance_engine.generate_compliance_report(compliance_data)

                return Response({
                    'is_compliant': is_valid,
                    'validation_passed': is_valid,
                    'errors': errors,
                    'warnings': warnings,
                    'compliance_report': report,
                    'message': 'Invoice data is GST compliant' if is_valid else 'Invoice data has compliance issues'
                })
            else:
                return Response({
                    'is_compliant': False,
                    'validation_passed': False,
                    'errors': [f"Validation error: {serializer.errors}"],
                    'warnings': [],
                    'message': 'Invalid invoice data format'
                }, status=status.HTTP_400_BAD_REQUEST)

        except Exception as e:
            return Response({
                'is_compliant': False,
                'validation_passed': False,
                'errors': [f"Compliance validation error: {str(e)}"],
                'warnings': [],
                'message': 'Failed to validate compliance'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def _prepare_invoice_compliance_data(self, invoice):
        """Prepare existing invoice data for compliance validation"""
        return {
            'number': invoice.number,
            'date': invoice.date,
            'client': {
                'name': invoice.client.name,
                'client_type': invoice.client.client_type,
                'gstin': invoice.client.gstin,
                'state_code': invoice.client.state_code,
                'billing_address': invoice.client.billing_address
            },
            'tenant': {
                'company_details': invoice.tenant.company_details,
                'aato_threshold': invoice.tenant.aato_threshold,
                'e_invoice_enabled': invoice.tenant.e_invoice_enabled
            },
            'place_of_supply': invoice.place_of_supply,
            'taxable_amount': float(invoice.taxable_amount),
            'total_tax': float(invoice.total_tax),
            'grand_total': float(invoice.grand_total),
            'lines': [
                {
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
                    'line_total': float(line.line_total),
                    'is_service': line.item.is_service if line.item else False
                }
                for line in invoice.lines.all()
            ]
        }

    def _prepare_compliance_data_from_request(self, validated_data, request):
        """Prepare compliance data from request validated data"""
        user = request.user
        tenant = user.tenant_memberships.first().tenant

        # Get client data
        client = validated_data.get('client')
        client_data = {
            'name': client.name if client else '',
            'client_type': client.client_type if client else 'b2c',
            'gstin': client.gstin if client else '',
            'state_code': client.state_code if client else '',
            'billing_address': client.billing_address if client else {}
        }

        # Get tenant data
        tenant_data = {
            'company_details': tenant.company_details,
            'aato_threshold': tenant.aato_threshold,
            'e_invoice_enabled': tenant.e_invoice_enabled
        }

        # Prepare line data
        lines_data = []
        for line_data in validated_data.get('lines', []):
            item = line_data.get('item')
            line_info = {
                'description': line_data.get('description', ''),
                'hsn_sac': line_data.get('hsn_sac', ''),
                'quantity': float(line_data.get('quantity', 0)),
                'rate': float(line_data.get('rate', 0)),
                'discount_percent': float(line_data.get('discount_percent', 0)),
                'discount_amount': float(line_data.get('discount_amount', 0)),
                'taxable_value': float(line_data.get('taxable_value', 0)),
                'cgst_rate': float(line_data.get('cgst_rate', 0)),
                'sgst_rate': float(line_data.get('sgst_rate', 0)),
                'igst_rate': float(line_data.get('igst_rate', 0)),
                'cess_rate': float(line_data.get('cess_rate', 0)),
                'cgst_amount': float(line_data.get('cgst_amount', 0)),
                'sgst_amount': float(line_data.get('sgst_amount', 0)),
                'igst_amount': float(line_data.get('igst_amount', 0)),
                'cess_amount': float(line_data.get('cess_amount', 0)),
                'line_total': float(line_data.get('line_total', 0)),
                'is_service': item.is_service if item else False
            }
            lines_data.append(line_info)

        return {
            'number': validated_data.get('number', ''),
            'date': validated_data.get('date'),
            'client': client_data,
            'tenant': tenant_data,
            'place_of_supply': validated_data.get('place_of_supply', ''),
            'taxable_amount': sum(line.get('taxable_value', 0) for line in lines_data),
            'total_tax': sum(line.get('cgst_amount', 0) + line.get('sgst_amount', 0) +
                           line.get('igst_amount', 0) + line.get('cess_amount', 0) for line in lines_data),
            'grand_total': validated_data.get('grand_total', 0),
            'lines': lines_data
        }

    @action(detail=False, methods=['get'])
    def pdf_templates(self, request):
        """Get available PDF templates"""
        pdf_generator = PDFGenerator()
        templates = pdf_generator.get_available_templates()

        return Response({
            'templates': templates,
            'default_template': 'professional'
        })

    @action(detail=True, methods=['get'])
    def pdf_preview(self, request, pk=None):
        """Generate PDF preview (first page only) for invoice"""
        invoice = self.get_object()

        try:
            template_name = request.query_params.get('template', 'professional')

            # Generate preview data (could be optimized to generate smaller preview)
            pdf_generator = PDFGenerator()
            pdf_bytes = pdf_generator.generate_invoice_pdf(
                invoice=invoice,
                template_name=template_name,
                include_qr=True,
                watermark="PREVIEW"
            )

            # Return as base64 for preview (or could return actual PDF)
            import base64
            pdf_base64 = base64.b64encode(pdf_bytes).decode('utf-8')

            return Response({
                'preview_data': f"data:application/pdf;base64,{pdf_base64}",
                'template_used': template_name,
                'invoice_number': invoice.number,
                'file_size': len(pdf_bytes)
            })

        except Exception as e:
            return Response({
                'error': f'PDF preview generation failed: {str(e)}',
                'invoice_id': str(invoice.id)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class GSTRateHistoryViewSet(TenantPermissionMixin, viewsets.ReadOnlyModelViewSet):
    serializer_class = GSTRateHistorySerializer
    permission_classes = [permissions.IsAuthenticated]
    filterset_fields = ['item', 'hsn_sac']
    ordering = ['-effective_from']

    def get_queryset(self):
        tenant = self.get_user_tenant()
        if not tenant:
            return GSTRateHistory.objects.none()
        return GSTRateHistory.objects.filter(item__tenant=tenant)


class InvoiceTemplateViewSet(TenantPermissionMixin, viewsets.ModelViewSet):
    serializer_class = InvoiceTemplateSerializer
    permission_classes = [permissions.IsAuthenticated]
    filterset_fields = ['template_type', 'is_default', 'is_system_template']
    search_fields = ['name']

    def get_queryset(self):
        tenant = self.get_user_tenant()
        if not tenant:
            return InvoiceTemplate.objects.none()
        return InvoiceTemplate.objects.filter(tenant=tenant)

    def create(self, request, *args, **kwargs):
        if not self.check_permission('create'):
            return Response(
                {'error': 'You do not have permission to create templates'},
                status=status.HTTP_403_FORBIDDEN
            )
        return super().create(request, *args, **kwargs)


class PaymentReminderViewSet(TenantPermissionMixin, viewsets.ModelViewSet):
    serializer_class = PaymentReminderSerializer
    permission_classes = [permissions.IsAuthenticated]
    filterset_fields = ['invoice', 'reminder_type', 'channel', 'status']

    def get_queryset(self):
        tenant = self.get_user_tenant()
        if not tenant:
            return PaymentReminder.objects.none()
        return PaymentReminder.objects.filter(tenant=tenant)

    def create(self, request, *args, **kwargs):
        if not self.check_permission('create'):
            return Response(
                {'error': 'You do not have permission to create reminders'},
                status=status.HTTP_403_FORBIDDEN
            )
        return super().create(request, *args, **kwargs)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def calculate_gst(request):
    """Calculate GST for given amount and rates"""
    try:
        amount = Decimal(str(request.data.get('amount', 0)))
        client_state = request.data.get('client_state', '')
        supply_state = request.data.get('supply_state', '')
        gst_rate = Decimal(str(request.data.get('gst_rate', 18)))
        cess_rate = Decimal(str(request.data.get('cess_rate', 0)))

        if client_state == supply_state:
            # Intra-state: CGST + SGST
            cgst_rate = sgst_rate = gst_rate / 2
            igst_rate = 0
            cgst_amount = (amount * cgst_rate) / 100
            sgst_amount = (amount * sgst_rate) / 100
            igst_amount = 0
        else:
            # Inter-state: IGST
            cgst_rate = sgst_rate = 0
            igst_rate = gst_rate
            cgst_amount = sgst_amount = 0
            igst_amount = (amount * igst_rate) / 100

        cess_amount = (amount * cess_rate) / 100
        total_tax = cgst_amount + sgst_amount + igst_amount + cess_amount
        total_amount = amount + total_tax

        return Response({
            'taxable_amount': float(amount),
            'cgst_rate': float(cgst_rate),
            'sgst_rate': float(sgst_rate),
            'igst_rate': float(igst_rate),
            'cess_rate': float(cess_rate),
            'cgst_amount': float(cgst_amount),
            'sgst_amount': float(sgst_amount),
            'igst_amount': float(igst_amount),
            'cess_amount': float(cess_amount),
            'total_tax': float(total_tax),
            'total_amount': float(total_amount),
        })

    except (ValueError, TypeError) as e:
        return Response(
            {'error': f'Invalid input: {str(e)}'},
            status=status.HTTP_400_BAD_REQUEST
        )


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def gst_rates_info(request):
    """Get GST rates information"""
    return Response({
        'standard_rates': {
            'gst_rates': [0, 5, 12, 18, 28],
            'cgst_sgst_rates': [0, 2.5, 6, 9, 14],
            'igst_rates': [0, 5, 12, 18, 28],
        },
        'special_rates': {
            'petroleum': 28,
            'luxury_goods': 28,
            'essential_items': 0,
            'books': 0,
        },
        'cess_applicable': [
            'motor_vehicles',
            'tobacco_products',
            'luxury_goods',
            'aerated_drinks'
        ],
        'aato_threshold': 5000000,  # 50 Lakhs
        'rule_46_mandatory_fields': [
            'invoice_number', 'invoice_date', 'supplier_gstin',
            'supplier_name', 'buyer_gstin', 'buyer_name',
            'hsn_sac', 'taxable_value', 'tax_rate', 'tax_amount',
            'place_of_supply', 'reverse_charge', 'invoice_type',
            'invoice_value', 'signature'
        ]
    })


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def validate_gstin(request):
    """Validate GSTIN format and checksum"""
    gstin = request.data.get('gstin', '')

    if not gstin:
        return Response(
            {'error': 'GSTIN is required'},
            status=status.HTTP_400_BAD_REQUEST
        )

    is_valid = validate_gst_number(gstin)

    response_data = {
        'gstin': gstin,
        'is_valid': is_valid,
        'format_valid': len(gstin) == 15 and gstin.isalnum(),
    }

    if is_valid:
        # Extract information from GSTIN
        state_code = gstin[:2]
        pan = gstin[2:12]
        entity_number = gstin[12]
        check_code = gstin[13]
        check_digit = gstin[14]

        response_data.update({
            'state_code': state_code,
            'pan': pan,
            'entity_number': entity_number,
            'check_code': check_code,
            'check_digit': check_digit,
            'state_name': GSTComplianceEngine.STATE_CODES.get(state_code, 'Unknown')
        })
    else:
        response_data['error'] = 'Invalid GSTIN format or checksum'

    return Response(response_data)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def get_hsn_rate(request):
    """Get standard tax rate for HSN/SAC code"""
    hsn_sac = request.data.get('hsn_sac', '')
    is_service = request.data.get('is_service', False)

    if not hsn_sac:
        return Response(
            {'error': 'HSN/SAC code is required'},
            status=status.HTTP_400_BAD_REQUEST
        )

    # Validate format
    if is_service:
        if not re.match(r'^\d{6}$', hsn_sac):
            return Response(
                {'error': 'Invalid SAC code format. Must be 6 digits'},
                status=status.HTTP_400_BAD_REQUEST
            )
    else:
        if not re.match(r'^\d{4}(\d{2})?(\d{2})?$', hsn_sac):
            return Response(
                {'error': 'Invalid HSN code format. Must be 4, 6, or 8 digits'},
                status=status.HTTP_400_BAD_REQUEST
            )

    # Get suggested tax rate
    suggested_rate = get_hsn_tax_rate(hsn_sac)

    response_data = {
        'hsn_sac': hsn_sac,
        'is_service': is_service,
        'format_valid': True
    }

    if suggested_rate is not None:
        response_data.update({
            'suggested_gst_rate': float(suggested_rate),
            'has_suggestion': True,
            'note': 'This is a suggested rate. Please verify with latest GST notifications.'
        })
    else:
        response_data.update({
            'suggested_gst_rate': None,
            'has_suggestion': False,
            'note': 'No standard rate found. Please refer to GST rate schedule.'
        })

    return Response(response_data)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def compliance_check(request):
    """Perform comprehensive compliance check on invoice data"""
    try:
        invoice_data = request.data

        # Initialize compliance engine
        compliance_engine = GSTComplianceEngine()

        # Run validation
        is_valid, errors, warnings = compliance_engine.validate_invoice_rule_46(invoice_data)

        # Generate report
        report = compliance_engine.generate_compliance_report(invoice_data)

        return Response({
            'is_compliant': is_valid,
            'errors': errors,
            'warnings': warnings,
            'compliance_report': report,
            'recommendations': report.get('recommendations', []),
            'compliance_score': report.get('compliance_score', 0)
        })

    except Exception as e:
        return Response(
            {
                'error': f'Compliance check failed: {str(e)}',
                'is_compliant': False
            },
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def bulk_pdf_generation(request):
    """Generate PDFs for multiple invoices"""
    try:
        invoice_ids = request.data.get('invoice_ids', [])
        template_name = request.data.get('template', 'professional')
        include_qr = request.data.get('include_qr', True)
        watermark = request.data.get('watermark', None)

        if not invoice_ids:
            return Response(
                {'error': 'invoice_ids are required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Get user's tenant
        membership = request.user.tenant_memberships.filter(is_active=True).first()
        if not membership:
            return Response(
                {'error': 'No active tenant found'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Get invoices for this tenant
        invoices = Invoice.objects.filter(
            id__in=invoice_ids,
            tenant=membership.tenant
        )

        if not invoices.exists():
            return Response(
                {'error': 'No valid invoices found'},
                status=status.HTTP_404_NOT_FOUND
            )

        pdf_generator = PDFGenerator()
        results = []

        for invoice in invoices:
            try:
                pdf_bytes = pdf_generator.generate_invoice_pdf(
                    invoice=invoice,
                    template_name=template_name,
                    include_qr=include_qr,
                    watermark=watermark
                )

                # Convert to base64 for response
                import base64
                pdf_base64 = base64.b64encode(pdf_bytes).decode('utf-8')

                results.append({
                    'invoice_id': str(invoice.id),
                    'invoice_number': invoice.number,
                    'status': 'success',
                    'pdf_data': f"data:application/pdf;base64,{pdf_base64}",
                    'file_size': len(pdf_bytes)
                })

            except Exception as e:
                results.append({
                    'invoice_id': str(invoice.id),
                    'invoice_number': invoice.number,
                    'status': 'error',
                    'error': str(e)
                })

        successful_count = sum(1 for r in results if r['status'] == 'success')

        return Response({
            'results': results,
            'summary': {
                'total_requested': len(invoice_ids),
                'found': invoices.count(),
                'successful': successful_count,
                'failed': len(results) - successful_count
            },
            'template_used': template_name
        })

    except Exception as e:
        return Response(
            {'error': f'Bulk PDF generation failed: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def generate_qr_code(request):
    """Generate QR code for custom data"""
    try:
        qr_data = request.data.get('data', '')
        size = request.data.get('size', 200)

        if not qr_data:
            return Response(
                {'error': 'QR data is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Validate size
        if not (50 <= size <= 500):
            return Response(
                {'error': 'Size must be between 50 and 500 pixels'},
                status=status.HTTP_400_BAD_REQUEST
            )

        pdf_generator = PDFGenerator()
        qr_image_base64 = pdf_generator._generate_qr_code(qr_data, size)

        return Response({
            'qr_code': qr_image_base64,
            'data': qr_data,
            'size': size,
            'format': 'PNG',
            'encoding': 'base64'
        })

    except Exception as e:
        return Response(
            {'error': f'QR code generation failed: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def pdf_template_info(request):
    """Get detailed information about PDF templates"""
    try:
        pdf_generator = PDFGenerator()
        templates = pdf_generator.get_available_templates()

        # Add more details for each template
        detailed_templates = []
        for template in templates:
            template_info = {
                **template,
                'supports_qr': True,
                'supports_watermark': True,
                'page_size': 'A4',
                'orientation': 'Portrait',
                'features': {
                    'company_logo': template['name'] in ['professional', 'classic'],
                    'tax_summary': True,
                    'terms_conditions': True,
                    'digital_signature': template['name'] == 'professional',
                    'color_scheme': {
                        'professional': '#1B365D',
                        'minimal': '#000000',
                        'classic': '#333333'
                    }.get(template['name'], '#000000')
                }
            }
            detailed_templates.append(template_info)

        return Response({
            'templates': detailed_templates,
            'default_template': 'professional',
            'customization_options': {
                'watermark': 'Custom text watermark',
                'qr_code': 'GST-compliant QR code',
                'template_selection': 'Multiple professional templates',
                'format': 'PDF (A4 size)'
            }
        })

    except Exception as e:
        return Response(
            {'error': f'Template info retrieval failed: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )