from django.db import models
from django.contrib.auth import get_user_model
from django.core.validators import MinValueValidator, MaxValueValidator
from decimal import Decimal
import uuid

from tenants.models import Tenant, Client

User = get_user_model()


class Item(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name='items')

    name = models.CharField(max_length=255)
    item_code = models.CharField(max_length=50)
    sku = models.CharField(max_length=50, blank=True)
    description = models.TextField(blank=True)

    hsn_sac = models.CharField(max_length=10, blank=True)
    uqc = models.CharField(max_length=10, blank=True)
    default_rate = models.DecimalField(max_digits=10, decimal_places=2, validators=[MinValueValidator(0)])

    current_gst_rate = models.DecimalField(max_digits=5, decimal_places=2, default=18.0, validators=[MinValueValidator(0), MaxValueValidator(100)])
    current_cess_rate = models.DecimalField(max_digits=5, decimal_places=2, default=0, validators=[MinValueValidator(0), MaxValueValidator(100)])

    item_category = models.CharField(max_length=100, blank=True)
    is_service = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='items_created')
    updated_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='items_updated')

    class Meta:
        db_table = 'items'
        verbose_name = 'Item'
        verbose_name_plural = 'Items'
        unique_together = ['tenant', 'item_code']

    def __str__(self):
        return f"{self.name} ({self.item_code})"


class GSTRateHistory(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    item = models.ForeignKey(Item, on_delete=models.CASCADE, related_name='rate_history')
    hsn_sac = models.CharField(max_length=10)

    effective_from = models.DateField()
    effective_to = models.DateField(null=True, blank=True)

    cgst_rate = models.DecimalField(max_digits=5, decimal_places=2, validators=[MinValueValidator(0), MaxValueValidator(50)])
    sgst_rate = models.DecimalField(max_digits=5, decimal_places=2, validators=[MinValueValidator(0), MaxValueValidator(50)])
    igst_rate = models.DecimalField(max_digits=5, decimal_places=2, validators=[MinValueValidator(0), MaxValueValidator(100)])
    cess_rate = models.DecimalField(max_digits=5, decimal_places=2, default=0, validators=[MinValueValidator(0), MaxValueValidator(100)])

    notification_reference = models.CharField(max_length=100, blank=True)
    change_reason = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'gst_rate_history'
        verbose_name = 'GST Rate History'
        verbose_name_plural = 'GST Rate Histories'
        indexes = [
            models.Index(fields=['item', 'effective_from']),
        ]

    def __str__(self):
        return f"{self.hsn_sac} - {self.effective_from}"


class Invoice(models.Model):
    INVOICE_TYPES = [
        ('proforma', 'Proforma'),
        ('taxable', 'Taxable'),
    ]

    PAYMENT_STATUS = [
        ('unpaid', 'Unpaid'),
        ('partial', 'Partially Paid'),
        ('paid', 'Paid'),
        ('overdue', 'Overdue'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name='invoices')
    client = models.ForeignKey(Client, on_delete=models.PROTECT, related_name='invoices')

    invoice_type = models.CharField(max_length=20, choices=INVOICE_TYPES)
    series = models.CharField(max_length=20, blank=True)
    number = models.CharField(max_length=50)
    date = models.DateField()
    due_date = models.DateField()

    place_of_supply = models.CharField(max_length=2)
    reverse_charge = models.BooleanField(default=False)

    currency = models.CharField(max_length=3, default='INR')
    exchange_rate = models.DecimalField(max_digits=10, decimal_places=4, default=1.0000)

    subtotal = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    discount_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    taxable_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    total_tax = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    round_off = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    grand_total = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    payment_status = models.CharField(max_length=20, choices=PAYMENT_STATUS, default='unpaid')
    notes = models.TextField(blank=True)
    terms_conditions = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='invoices_created')
    updated_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='invoices_updated')

    class Meta:
        db_table = 'invoices'
        verbose_name = 'Invoice'
        verbose_name_plural = 'Invoices'
        unique_together = ['tenant', 'series', 'number']
        indexes = [
            models.Index(fields=['tenant', 'date']),
            models.Index(fields=['tenant', 'client', 'date']),
        ]

    def __str__(self):
        return f"{self.series}{self.number} - {self.client.name}"

    def calculate_totals(self):
        lines = self.lines.all()
        self.subtotal = sum(line.line_total for line in lines)
        self.taxable_amount = sum(line.taxable_value for line in lines)
        self.total_tax = sum(
            line.cgst_amount + line.sgst_amount + line.igst_amount + line.cess_amount
            for line in lines
        )
        self.grand_total = self.taxable_amount + self.total_tax - self.discount_amount + self.round_off
        self.save()


class InvoiceLine(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    invoice = models.ForeignKey(Invoice, on_delete=models.CASCADE, related_name='lines')
    item = models.ForeignKey(Item, on_delete=models.PROTECT, related_name='invoice_lines', null=True, blank=True)

    line_number = models.IntegerField()
    description = models.TextField()
    hsn_sac = models.CharField(max_length=10, blank=True)

    quantity = models.DecimalField(max_digits=10, decimal_places=3)
    uqc = models.CharField(max_length=10, blank=True)
    rate = models.DecimalField(max_digits=10, decimal_places=2)

    discount_percent = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    discount_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    taxable_value = models.DecimalField(max_digits=12, decimal_places=2)

    cgst_rate = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    sgst_rate = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    igst_rate = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    cess_rate = models.DecimalField(max_digits=5, decimal_places=2, default=0)

    cgst_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    sgst_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    igst_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    cess_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)

    line_total = models.DecimalField(max_digits=12, decimal_places=2)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'invoice_lines'
        verbose_name = 'Invoice Line'
        verbose_name_plural = 'Invoice Lines'
        ordering = ['invoice', 'line_number']
        unique_together = ['invoice', 'line_number']

    def __str__(self):
        return f"Line {self.line_number} - {self.description[:50]}"

    def calculate_taxes(self):
        if self.invoice.place_of_supply == self.invoice.client.state_code:
            self.cgst_amount = (self.taxable_value * self.cgst_rate) / 100
            self.sgst_amount = (self.taxable_value * self.sgst_rate) / 100
            self.igst_amount = 0
        else:
            self.cgst_amount = 0
            self.sgst_amount = 0
            self.igst_amount = (self.taxable_value * self.igst_rate) / 100

        self.cess_amount = (self.taxable_value * self.cess_rate) / 100
        self.line_total = self.taxable_value + self.cgst_amount + self.sgst_amount + self.igst_amount + self.cess_amount


class EInvoiceDetails(models.Model):
    IRP_STATUS = [
        ('pending', 'Pending'),
        ('submitted', 'Submitted'),
        ('success', 'Success'),
        ('failed', 'Failed'),
        ('cancelled', 'Cancelled'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    invoice = models.OneToOneField(Invoice, on_delete=models.CASCADE, related_name='einvoice_details')

    irp_status = models.CharField(max_length=20, choices=IRP_STATUS, default='pending')
    irn = models.CharField(max_length=64, blank=True)
    ack_no = models.CharField(max_length=50, blank=True)
    ack_date = models.DateTimeField(null=True, blank=True)

    qr_code_image = models.TextField(blank=True)
    signed_invoice_hash = models.TextField(blank=True)

    irp_request_payload = models.JSONField(default=dict, blank=True)
    irp_response_payload = models.JSONField(default=dict, blank=True)

    cancellation_date = models.DateTimeField(null=True, blank=True)
    cancellation_reason = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'einvoice_details'
        verbose_name = 'E-Invoice Details'
        verbose_name_plural = 'E-Invoice Details'

    def __str__(self):
        return f"E-Invoice for {self.invoice}"


class InvoiceTemplate(models.Model):
    TEMPLATE_TYPES = [
        ('invoice', 'Invoice'),
        ('email', 'Email'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name='invoice_templates')

    name = models.CharField(max_length=100)
    template_type = models.CharField(max_length=20, choices=TEMPLATE_TYPES)

    html_template = models.TextField()
    css_styles = models.TextField(blank=True)
    json_layout = models.JSONField(default=dict)

    is_default = models.BooleanField(default=False)
    is_system_template = models.BooleanField(default=False)

    mandatory_fields = models.JSONField(default=list)
    preview_image = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='templates_created')
    updated_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='templates_updated')

    class Meta:
        db_table = 'invoice_templates'
        verbose_name = 'Invoice Template'
        verbose_name_plural = 'Invoice Templates'

    def __str__(self):
        return f"{self.name} ({self.template_type})"


class EmailCommunication(models.Model):
    EMAIL_STATUS = [
        ('pending', 'Pending'),
        ('sent', 'Sent'),
        ('delivered', 'Delivered'),
        ('opened', 'Opened'),
        ('bounced', 'Bounced'),
        ('failed', 'Failed'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name='email_communications')
    invoice = models.ForeignKey(Invoice, on_delete=models.CASCADE, related_name='email_communications')

    to_email = models.EmailField()
    cc_email = models.TextField(blank=True)
    bcc_email = models.TextField(blank=True)

    subject = models.CharField(max_length=255)
    body = models.TextField()
    attachment_paths = models.JSONField(default=list)

    status = models.CharField(max_length=20, choices=EMAIL_STATUS, default='pending')
    provider_message_id = models.CharField(max_length=100, blank=True)

    sent_at = models.DateTimeField(null=True, blank=True)
    delivered_at = models.DateTimeField(null=True, blank=True)
    opened_at = models.DateTimeField(null=True, blank=True)
    bounce_reason = models.TextField(blank=True)
    retry_count = models.IntegerField(default=0)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='emails_sent')

    class Meta:
        db_table = 'email_communications'
        verbose_name = 'Email Communication'
        verbose_name_plural = 'Email Communications'

    def __str__(self):
        return f"Email to {self.to_email} for Invoice {self.invoice.number}"


class PaymentReminder(models.Model):
    REMINDER_TYPES = [
        ('gentle', 'Gentle'),
        ('firm', 'Firm'),
        ('final', 'Final'),
        ('custom', 'Custom'),
    ]

    CHANNELS = [
        ('email', 'Email'),
        ('sms', 'SMS'),
        ('whatsapp', 'WhatsApp'),
    ]

    STATUS = [
        ('active', 'Active'),
        ('paused', 'Paused'),
        ('stopped', 'Stopped'),
        ('completed', 'Completed'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name='payment_reminders')
    invoice = models.ForeignKey(Invoice, on_delete=models.CASCADE, related_name='payment_reminders')

    reminder_type = models.CharField(max_length=20, choices=REMINDER_TYPES)
    schedule_rule = models.JSONField(default=dict)
    channel = models.CharField(max_length=20, choices=CHANNELS)
    template = models.ForeignKey(InvoiceTemplate, on_delete=models.SET_NULL, null=True, blank=True)

    status = models.CharField(max_length=20, choices=STATUS, default='active')

    last_sent_at = models.DateTimeField(null=True, blank=True)
    next_send_at = models.DateTimeField(null=True, blank=True)

    auto_stop_enabled = models.BooleanField(default=True)
    max_attempts = models.IntegerField(default=5)
    custom_message = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='reminders_created')

    class Meta:
        db_table = 'payment_reminders'
        verbose_name = 'Payment Reminder'
        verbose_name_plural = 'Payment Reminders'

    def __str__(self):
        return f"{self.reminder_type} reminder for {self.invoice}"


class QRCodePayment(models.Model):
    """
    Model for dynamic QR code payments
    Tracks UPI and other payment QR codes for invoices
    """

    PAYMENT_METHODS = [
        ('upi', 'UPI'),
        ('card', 'Card'),
        ('netbanking', 'Net Banking'),
        ('wallet', 'Mobile Wallet'),
    ]

    QR_STATUS = [
        ('active', 'Active'),
        ('expired', 'Expired'),
        ('used', 'Used'),
        ('cancelled', 'Cancelled'),
        ('replaced', 'Replaced'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name='qr_payments')
    invoice = models.ForeignKey(Invoice, on_delete=models.CASCADE, related_name='qr_payments')

    payment_method = models.CharField(max_length=20, choices=PAYMENT_METHODS)
    amount = models.DecimalField(max_digits=12, decimal_places=2, validators=[MinValueValidator(0)])

    transaction_reference = models.CharField(max_length=100, unique=True)
    qr_code_data = models.TextField()  # UPI string or payment URL
    qr_image_data = models.TextField(blank=True)  # Base64 encoded image

    qr_status = models.CharField(max_length=20, choices=QR_STATUS, default='active')
    expiry_time = models.DateTimeField()

    # Payment gateway response
    gateway_payment_id = models.CharField(max_length=100, blank=True)
    gateway_response = models.JSONField(default=dict, blank=True)

    # QR code metadata
    metadata = models.JSONField(default=dict, blank=True)

    # Tracking
    scan_count = models.IntegerField(default=0)
    last_scanned_at = models.DateTimeField(null=True, blank=True)

    paid_at = models.DateTimeField(null=True, blank=True)
    payment_reference = models.CharField(max_length=100, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='qr_payments_created')

    class Meta:
        db_table = 'qr_code_payments'
        verbose_name = 'QR Code Payment'
        verbose_name_plural = 'QR Code Payments'
        ordering = ['-created_at']

    def __str__(self):
        return f"QR Payment {self.transaction_reference} for {self.invoice}"

    @property
    def is_expired(self):
        """Check if QR code is expired"""
        from django.utils import timezone
        return timezone.now() > self.expiry_time

    @property
    def is_active(self):
        """Check if QR code is active and usable"""
        return self.qr_status == 'active' and not self.is_expired

    def mark_as_used(self, payment_reference: str = ''):
        """Mark QR code as used after successful payment"""
        self.qr_status = 'used'
        self.paid_at = timezone.now()
        self.payment_reference = payment_reference
        self.save()

    def increment_scan_count(self):
        """Increment scan count and update last scanned time"""
        from django.utils import timezone
        self.scan_count += 1
        self.last_scanned_at = timezone.now()
        self.save(update_fields=['scan_count', 'last_scanned_at'])