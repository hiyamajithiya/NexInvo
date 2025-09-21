from django.db import models
from django.contrib.auth import get_user_model
from django.utils import timezone
import uuid

from tenants.models import Tenant

User = get_user_model()


class Integration(models.Model):
    INTEGRATION_TYPES = [
        ('tally', 'Tally Prime'),
        ('zoho', 'Zoho Books'),
        ('d365', 'Dynamics 365'),
        ('smtp', 'SMTP Email'),
        ('webhook', 'Webhook'),
    ]

    SYNC_STATUS = [
        ('active', 'Active'),
        ('inactive', 'Inactive'),
        ('error', 'Error'),
        ('syncing', 'Syncing'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name='integrations')

    integration_type = models.CharField(max_length=20, choices=INTEGRATION_TYPES)
    name = models.CharField(max_length=100)

    credentials_encrypted = models.JSONField(default=dict, blank=True)
    configuration = models.JSONField(default=dict, blank=True)

    is_active = models.BooleanField(default=True)
    last_sync_at = models.DateTimeField(null=True, blank=True)
    sync_status = models.CharField(max_length=20, choices=SYNC_STATUS, default='inactive')

    error_log = models.JSONField(default=list, blank=True)
    webhook_secret = models.CharField(max_length=100, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='integrations_created')
    updated_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='integrations_updated')

    class Meta:
        db_table = 'integrations'
        verbose_name = 'Integration'
        verbose_name_plural = 'Integrations'
        unique_together = ['tenant', 'integration_type', 'name']

    def __str__(self):
        return f"{self.tenant.name} - {self.get_integration_type_display()}"


class TallyExport(models.Model):
    EXPORT_STATUS = [
        ('pending', 'Pending'),
        ('processing', 'Processing'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name='tally_exports')
    integration = models.ForeignKey(Integration, on_delete=models.CASCADE, related_name='tally_exports')

    export_type = models.CharField(max_length=20, choices=[
        ('vouchers', 'Vouchers'),
        ('ledgers', 'Ledgers'),
        ('items', 'Items'),
    ])

    date_from = models.DateField()
    date_to = models.DateField()

    xml_content = models.TextField(blank=True)
    file_path = models.CharField(max_length=500, blank=True)

    status = models.CharField(max_length=20, choices=EXPORT_STATUS, default='pending')
    export_metadata = models.JSONField(default=dict)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='tally_exports_created')

    class Meta:
        db_table = 'tally_exports'
        verbose_name = 'Tally Export'
        verbose_name_plural = 'Tally Exports'

    def __str__(self):
        return f"Tally {self.export_type} export for {self.tenant.name}"


class ZohoSyncLog(models.Model):
    SYNC_ACTIONS = [
        ('push', 'Push to Zoho'),
        ('pull', 'Pull from Zoho'),
        ('update', 'Update in Zoho'),
    ]

    SYNC_STATUS = [
        ('pending', 'Pending'),
        ('success', 'Success'),
        ('failed', 'Failed'),
        ('partial', 'Partial'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name='zoho_sync_logs')
    integration = models.ForeignKey(Integration, on_delete=models.CASCADE, related_name='zoho_sync_logs')

    entity_type = models.CharField(max_length=50)  # customer, item, invoice
    entity_id = models.CharField(max_length=50)
    zoho_id = models.CharField(max_length=50, blank=True)

    action = models.CharField(max_length=10, choices=SYNC_ACTIONS)
    status = models.CharField(max_length=10, choices=SYNC_STATUS)

    request_payload = models.JSONField(default=dict, blank=True)
    response_payload = models.JSONField(default=dict, blank=True)

    error_message = models.TextField(blank=True)
    retry_count = models.IntegerField(default=0)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'zoho_sync_logs'
        verbose_name = 'Zoho Sync Log'
        verbose_name_plural = 'Zoho Sync Logs'
        indexes = [
            models.Index(fields=['tenant', 'entity_type', 'entity_id']),
        ]

    def __str__(self):
        return f"Zoho {self.action} {self.entity_type} - {self.status}"


class WebhookEvent(models.Model):
    EVENT_TYPES = [
        ('invoice.created', 'Invoice Created'),
        ('invoice.updated', 'Invoice Updated'),
        ('invoice.paid', 'Invoice Paid'),
        ('client.created', 'Client Created'),
        ('client.updated', 'Client Updated'),
        ('payment.received', 'Payment Received'),
    ]

    DELIVERY_STATUS = [
        ('pending', 'Pending'),
        ('delivered', 'Delivered'),
        ('failed', 'Failed'),
        ('retrying', 'Retrying'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name='webhook_events')
    integration = models.ForeignKey(Integration, on_delete=models.CASCADE, related_name='webhook_events')

    event_type = models.CharField(max_length=50, choices=EVENT_TYPES)
    entity_id = models.CharField(max_length=50)

    payload = models.JSONField(default=dict)
    delivery_status = models.CharField(max_length=20, choices=DELIVERY_STATUS, default='pending')

    delivery_attempts = models.IntegerField(default=0)
    last_delivery_attempt = models.DateTimeField(null=True, blank=True)
    next_delivery_attempt = models.DateTimeField(null=True, blank=True)

    response_status_code = models.IntegerField(null=True, blank=True)
    response_body = models.TextField(blank=True)
    error_message = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'webhook_events'
        verbose_name = 'Webhook Event'
        verbose_name_plural = 'Webhook Events'
        indexes = [
            models.Index(fields=['tenant', 'event_type']),
            models.Index(fields=['delivery_status', 'next_delivery_attempt']),
        ]

    def __str__(self):
        return f"{self.event_type} for {self.entity_id}"


class GSTRExport(models.Model):
    EXPORT_TYPES = [
        ('gstr1', 'GSTR-1'),
        ('gstr3b', 'GSTR-3B'),
    ]

    EXPORT_STATUS = [
        ('pending', 'Pending'),
        ('processing', 'Processing'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name='gstr_exports')

    export_type = models.CharField(max_length=10, choices=EXPORT_TYPES)
    month = models.IntegerField()
    year = models.IntegerField()

    date_from = models.DateField()
    date_to = models.DateField()

    export_data = models.JSONField(default=dict)
    csv_content = models.TextField(blank=True)
    json_content = models.JSONField(default=dict, blank=True)

    status = models.CharField(max_length=20, choices=EXPORT_STATUS, default='pending')
    file_path = models.CharField(max_length=500, blank=True)

    total_invoices = models.IntegerField(default=0)
    total_taxable_value = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    total_tax_amount = models.DecimalField(max_digits=15, decimal_places=2, default=0)

    reconciliation_data = models.JSONField(default=dict, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='gstr_exports_created')

    class Meta:
        db_table = 'gstr_exports'
        verbose_name = 'GSTR Export'
        verbose_name_plural = 'GSTR Exports'
        unique_together = ['tenant', 'export_type', 'month', 'year']

    def __str__(self):
        return f"{self.export_type.upper()} for {self.month}/{self.year}"


class EmailProvider(models.Model):
    PROVIDER_TYPES = [
        ('smtp', 'SMTP'),
        ('sendgrid', 'SendGrid'),
        ('mailgun', 'Mailgun'),
        ('ses', 'Amazon SES'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name='email_providers')

    provider_type = models.CharField(max_length=20, choices=PROVIDER_TYPES)
    name = models.CharField(max_length=100)

    configuration = models.JSONField(default=dict)
    credentials_encrypted = models.JSONField(default=dict)

    is_active = models.BooleanField(default=True)
    is_default = models.BooleanField(default=False)

    daily_limit = models.IntegerField(default=1000)
    monthly_limit = models.IntegerField(default=30000)

    emails_sent_today = models.IntegerField(default=0)
    emails_sent_this_month = models.IntegerField(default=0)

    last_reset_date = models.DateField(default=timezone.now)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='email_providers_created')

    class Meta:
        db_table = 'email_providers'
        verbose_name = 'Email Provider'
        verbose_name_plural = 'Email Providers'

    def __str__(self):
        return f"{self.name} ({self.provider_type})"