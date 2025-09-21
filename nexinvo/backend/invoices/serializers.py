from rest_framework import serializers
from django.db import transaction
from decimal import Decimal
from datetime import date, timedelta

from .models import (
    Item, GSTRateHistory, Invoice, InvoiceLine, EInvoiceDetails,
    InvoiceTemplate, EmailCommunication, PaymentReminder
)
from tenants.models import Tenant, Client
from .gst_compliance import GSTComplianceEngine


class ItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = Item
        fields = [
            'id', 'tenant', 'name', 'item_code', 'sku', 'description',
            'hsn_sac', 'uqc', 'default_rate', 'current_gst_rate',
            'current_cess_rate', 'item_category', 'is_service', 'is_active',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'tenant', 'created_at', 'updated_at']

    def validate_item_code(self, value):
        tenant = self.context['request'].user.tenant_memberships.first().tenant
        if self.instance:
            # Update - exclude current instance
            if Item.objects.filter(tenant=tenant, item_code=value).exclude(id=self.instance.id).exists():
                raise serializers.ValidationError("Item code already exists in this tenant")
        else:
            # Create - check if exists
            if Item.objects.filter(tenant=tenant, item_code=value).exists():
                raise serializers.ValidationError("Item code already exists in this tenant")
        return value

    def create(self, validated_data):
        user = self.context['request'].user
        tenant = user.tenant_memberships.first().tenant
        validated_data['tenant'] = tenant
        validated_data['created_by'] = user
        validated_data['updated_by'] = user
        return super().create(validated_data)

    def update(self, instance, validated_data):
        validated_data['updated_by'] = self.context['request'].user
        return super().update(instance, validated_data)


class GSTRateHistorySerializer(serializers.ModelSerializer):
    class Meta:
        model = GSTRateHistory
        fields = [
            'id', 'item', 'hsn_sac', 'effective_from', 'effective_to',
            'cgst_rate', 'sgst_rate', 'igst_rate', 'cess_rate',
            'notification_reference', 'change_reason', 'created_at'
        ]
        read_only_fields = ['id', 'created_at']


class InvoiceLineSerializer(serializers.ModelSerializer):
    item_name = serializers.CharField(source='item.name', read_only=True)

    class Meta:
        model = InvoiceLine
        fields = [
            'id', 'line_number', 'item', 'item_name', 'description', 'hsn_sac',
            'quantity', 'uqc', 'rate', 'discount_percent', 'discount_amount',
            'taxable_value', 'cgst_rate', 'sgst_rate', 'igst_rate', 'cess_rate',
            'cgst_amount', 'sgst_amount', 'igst_amount', 'cess_amount', 'line_total'
        ]
        read_only_fields = [
            'id', 'item_name', 'line_number', 'taxable_value', 'cgst_amount', 'sgst_amount',
            'igst_amount', 'cess_amount', 'line_total'
        ]

    def validate(self, attrs):
        # Calculate taxable value
        quantity = attrs.get('quantity', 0)
        rate = attrs.get('rate', 0)
        discount_percent = attrs.get('discount_percent', 0)
        discount_amount = attrs.get('discount_amount', 0)

        line_amount = quantity * rate
        if discount_percent > 0:
            discount_amount = (line_amount * discount_percent) / 100

        attrs['discount_amount'] = discount_amount
        attrs['taxable_value'] = line_amount - discount_amount

        return attrs


class InvoiceSerializer(serializers.ModelSerializer):
    lines = InvoiceLineSerializer(many=True, required=False)
    client_name = serializers.CharField(source='client.name', read_only=True)
    number = serializers.CharField(required=False, allow_blank=True)
    date = serializers.DateField(required=False)
    due_date = serializers.DateField(required=False)
    place_of_supply = serializers.CharField(required=False, allow_blank=True)

    class Meta:
        model = Invoice
        fields = [
            'id', 'tenant', 'client', 'client_name', 'invoice_type', 'series',
            'number', 'date', 'due_date', 'place_of_supply', 'reverse_charge',
            'currency', 'exchange_rate', 'subtotal', 'discount_amount',
            'taxable_amount', 'total_tax', 'round_off', 'grand_total',
            'payment_status', 'notes', 'terms_conditions', 'lines',
            'created_at', 'updated_at'
        ]
        read_only_fields = [
            'id', 'tenant', 'client_name', 'subtotal', 'taxable_amount',
            'total_tax', 'grand_total', 'created_at', 'updated_at'
        ]

    def validate(self, attrs):
        # Set default date if not provided
        if not attrs.get('date'):
            attrs['date'] = date.today()

        # Auto-generate invoice number if not provided
        if not attrs.get('number'):
            tenant = self.context['request'].user.tenant_memberships.first().tenant
            series = attrs.get('series', 'INV')

            # Get the last invoice number for this series
            last_invoice = Invoice.objects.filter(
                tenant=tenant,
                series=series
            ).order_by('-created_at').first()

            if last_invoice and last_invoice.number:
                try:
                    # Extract number from invoice number (remove series prefix)
                    last_num = int(last_invoice.number.replace(series, ''))
                    next_num = last_num + 1
                except:
                    next_num = 1
            else:
                next_num = 1

            attrs['number'] = f"{series}{next_num:04d}"

        # Set due date if not provided
        if not attrs.get('due_date'):
            invoice_date = attrs.get('date')
            client = attrs.get('client')
            if client and hasattr(client, 'credit_terms_days') and client.credit_terms_days:
                credit_days = client.credit_terms_days
            else:
                credit_days = 30
            attrs['due_date'] = invoice_date + timedelta(days=credit_days)

        # Set default place of supply if not provided (should be supplier's state)
        if not attrs.get('place_of_supply'):
            # For supply from tenant to client, place of supply is typically the supplier's (tenant's) state
            # unless specifically overridden for special cases like online services
            tenant = self.context['request'].user.tenant_memberships.first().tenant
            if tenant and tenant.company_details.get('state_code'):
                attrs['place_of_supply'] = tenant.company_details['state_code']
            else:
                attrs['place_of_supply'] = '27'  # Default to Maharashtra

        # GST Compliance validation
        self._validate_gst_compliance(attrs)

        return attrs

    def _validate_gst_compliance(self, attrs):
        """Validate GST compliance using Rule-46 engine"""
        # Prepare data for compliance engine
        compliance_data = self._prepare_compliance_data(attrs)

        # Run compliance validation
        compliance_engine = GSTComplianceEngine()
        is_valid, errors, warnings = compliance_engine.validate_invoice_rule_46(compliance_data)

        # Store compliance report for later use
        self._compliance_report = compliance_engine.generate_compliance_report(compliance_data)

        # Raise validation errors if compliance fails
        if not is_valid:
            error_message = "GST Compliance validation failed:\n" + "\n".join(errors)
            raise serializers.ValidationError({"gst_compliance": error_message})

        # Store warnings for informational purposes
        if warnings:
            self._compliance_warnings = warnings

    def _prepare_compliance_data(self, attrs):
        """Prepare data in format expected by compliance engine"""
        user = self.context['request'].user
        tenant = user.tenant_memberships.first().tenant

        # Get client data
        client = attrs.get('client')
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

        # Prepare line data with item information
        lines_data = []
        for line_data in attrs.get('lines', []):
            item = line_data.get('item')
            line_info = {
                'description': line_data.get('description', ''),
                'hsn_sac': line_data.get('hsn_sac', ''),
                'quantity': line_data.get('quantity', 0),
                'rate': line_data.get('rate', 0),
                'discount_percent': line_data.get('discount_percent', 0),
                'discount_amount': line_data.get('discount_amount', 0),
                'taxable_value': line_data.get('taxable_value', 0),
                'cgst_rate': line_data.get('cgst_rate', 0),
                'sgst_rate': line_data.get('sgst_rate', 0),
                'igst_rate': line_data.get('igst_rate', 0),
                'cess_rate': line_data.get('cess_rate', 0),
                'cgst_amount': line_data.get('cgst_amount', 0),
                'sgst_amount': line_data.get('sgst_amount', 0),
                'igst_amount': line_data.get('igst_amount', 0),
                'cess_amount': line_data.get('cess_amount', 0),
                'line_total': line_data.get('line_total', 0),
                'is_service': item.is_service if item else False
            }
            lines_data.append(line_info)

        return {
            'number': attrs.get('number', ''),
            'date': attrs.get('date'),
            'client': client_data,
            'tenant': tenant_data,
            'place_of_supply': attrs.get('place_of_supply', ''),
            'taxable_amount': sum(line.get('taxable_value', 0) for line in lines_data),
            'total_tax': sum(line.get('cgst_amount', 0) + line.get('sgst_amount', 0) +
                           line.get('igst_amount', 0) + line.get('cess_amount', 0) for line in lines_data),
            'grand_total': attrs.get('grand_total', 0),
            'lines': lines_data
        }

    def create(self, validated_data):
        lines_data = validated_data.pop('lines', [])
        user = self.context['request'].user
        tenant = user.tenant_memberships.first().tenant

        validated_data['tenant'] = tenant
        validated_data['created_by'] = user
        validated_data['updated_by'] = user

        with transaction.atomic():
            invoice = super().create(validated_data)

            # Create invoice lines
            for i, line_data in enumerate(lines_data, 1):
                line_data['line_number'] = i
                line_data['invoice'] = invoice
                self._create_invoice_line(line_data, invoice)

            # Calculate totals
            invoice.calculate_totals()

            return invoice

    def update(self, instance, validated_data):
        lines_data = validated_data.pop('lines', [])
        validated_data['updated_by'] = self.context['request'].user

        with transaction.atomic():
            invoice = super().update(instance, validated_data)

            # Delete existing lines and create new ones
            instance.lines.all().delete()

            for i, line_data in enumerate(lines_data, 1):
                line_data['line_number'] = i
                line_data['invoice'] = invoice
                self._create_invoice_line(line_data, invoice)

            # Recalculate totals
            invoice.calculate_totals()

            return invoice

    def _create_invoice_line(self, line_data, invoice):
        """Create an invoice line with proper GST calculations"""
        # Calculate taxes based on place of supply
        client_state = invoice.client.state_code
        supply_state = invoice.place_of_supply

        # Get tax rates
        cgst_rate = line_data.get('cgst_rate', 0)
        sgst_rate = line_data.get('sgst_rate', 0)
        igst_rate = line_data.get('igst_rate', 0)
        cess_rate = line_data.get('cess_rate', 0)

        # If no rates provided, use item's current rates
        if not any([cgst_rate, sgst_rate, igst_rate]) and line_data.get('item'):
            item = line_data['item']
            total_gst = item.current_gst_rate
            cess_rate = item.current_cess_rate

            if client_state == supply_state:
                # Intra-state: CGST + SGST
                cgst_rate = sgst_rate = total_gst / 2
                igst_rate = 0
            else:
                # Inter-state: IGST
                igst_rate = total_gst
                cgst_rate = sgst_rate = 0

        # Calculate tax amounts
        taxable_value = line_data['taxable_value']

        if client_state == supply_state:
            cgst_amount = (taxable_value * cgst_rate) / 100
            sgst_amount = (taxable_value * sgst_rate) / 100
            igst_amount = 0
        else:
            cgst_amount = 0
            sgst_amount = 0
            igst_amount = (taxable_value * igst_rate) / 100

        cess_amount = (taxable_value * cess_rate) / 100
        line_total = taxable_value + cgst_amount + sgst_amount + igst_amount + cess_amount

        # Update line data with calculated values
        line_data.update({
            'cgst_rate': cgst_rate,
            'sgst_rate': sgst_rate,
            'igst_rate': igst_rate,
            'cess_rate': cess_rate,
            'cgst_amount': cgst_amount,
            'sgst_amount': sgst_amount,
            'igst_amount': igst_amount,
            'cess_amount': cess_amount,
            'line_total': line_total,
        })

        return InvoiceLine.objects.create(**line_data)


class EInvoiceDetailsSerializer(serializers.ModelSerializer):
    class Meta:
        model = EInvoiceDetails
        fields = [
            'id', 'invoice', 'irp_status', 'irn', 'ack_no', 'ack_date',
            'qr_code_image', 'signed_invoice_hash', 'irp_request_payload',
            'irp_response_payload', 'cancellation_date', 'cancellation_reason',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class InvoiceTemplateSerializer(serializers.ModelSerializer):
    class Meta:
        model = InvoiceTemplate
        fields = [
            'id', 'tenant', 'name', 'template_type', 'html_template',
            'css_styles', 'json_layout', 'is_default', 'is_system_template',
            'mandatory_fields', 'preview_image', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'tenant', 'created_at', 'updated_at']

    def create(self, validated_data):
        user = self.context['request'].user
        tenant = user.tenant_memberships.first().tenant
        validated_data['tenant'] = tenant
        validated_data['created_by'] = user
        validated_data['updated_by'] = user
        return super().create(validated_data)


class EmailCommunicationSerializer(serializers.ModelSerializer):
    class Meta:
        model = EmailCommunication
        fields = [
            'id', 'tenant', 'invoice', 'to_email', 'cc_email', 'bcc_email',
            'subject', 'body', 'attachment_paths', 'status', 'provider_message_id',
            'sent_at', 'delivered_at', 'opened_at', 'bounce_reason', 'retry_count',
            'created_at', 'updated_at'
        ]
        read_only_fields = [
            'id', 'tenant', 'status', 'provider_message_id', 'sent_at',
            'delivered_at', 'opened_at', 'bounce_reason', 'retry_count',
            'created_at', 'updated_at'
        ]


class PaymentReminderSerializer(serializers.ModelSerializer):
    class Meta:
        model = PaymentReminder
        fields = [
            'id', 'tenant', 'invoice', 'reminder_type', 'schedule_rule',
            'channel', 'template', 'status', 'last_sent_at', 'next_send_at',
            'auto_stop_enabled', 'max_attempts', 'custom_message',
            'created_at', 'updated_at'
        ]
        read_only_fields = [
            'id', 'tenant', 'last_sent_at', 'next_send_at',
            'created_at', 'updated_at'
        ]

    def create(self, validated_data):
        user = self.context['request'].user
        tenant = user.tenant_memberships.first().tenant
        validated_data['tenant'] = tenant
        validated_data['created_by'] = user
        return super().create(validated_data)