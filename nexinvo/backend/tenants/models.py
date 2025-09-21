from django.db import models
from django.contrib.auth import get_user_model
from django.core.validators import MinValueValidator
import uuid

User = get_user_model()


class Tenant(models.Model):
    BUSINESS_TYPES = [
        ('ca_firm', 'CA Firm'),
        ('sme', 'SME'),
        ('enterprise', 'Enterprise'),
    ]

    SUBSCRIPTION_PLANS = [
        ('free', 'Free'),
        ('basic', 'Basic'),
        ('professional', 'Professional'),
        ('enterprise', 'Enterprise'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    business_type = models.CharField(max_length=20, choices=BUSINESS_TYPES)
    aato_threshold = models.BigIntegerField(default=5000000, validators=[MinValueValidator(0)])
    e_invoice_enabled = models.BooleanField(default=False)
    b2c_qr_enabled = models.BooleanField(default=True)

    company_details = models.JSONField(default=dict)
    gst_settings = models.JSONField(default=dict)

    subscription_plan = models.CharField(max_length=20, choices=SUBSCRIPTION_PLANS, default='free')
    billing_details = models.JSONField(default=dict)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='tenants_created')
    updated_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='tenants_updated')

    class Meta:
        db_table = 'tenants'
        verbose_name = 'Tenant'
        verbose_name_plural = 'Tenants'

    def __str__(self):
        return self.name


class TenantMembership(models.Model):
    ROLES = [
        ('ca_owner', 'CA Owner'),
        ('admin', 'Admin'),
        ('finance_user', 'Finance User'),
        ('viewer', 'Viewer'),
        ('client_readonly', 'Client Read-Only'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='tenant_memberships')
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name='memberships')
    role = models.CharField(max_length=20, choices=ROLES)
    permissions = models.JSONField(default=dict)
    joined_at = models.DateTimeField(auto_now_add=True)
    invited_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='invitations_sent')
    is_active = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'tenant_memberships'
        verbose_name = 'Tenant Membership'
        verbose_name_plural = 'Tenant Memberships'
        unique_together = ['user', 'tenant']

    def __str__(self):
        return f"{self.user.email} - {self.tenant.name} ({self.role})"


class Client(models.Model):
    CLIENT_TYPES = [
        ('b2b', 'B2B'),
        ('b2c', 'B2C'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name='clients')
    name = models.CharField(max_length=255)
    client_code = models.CharField(max_length=50)
    client_type = models.CharField(max_length=10, choices=CLIENT_TYPES)

    gstin = models.CharField(max_length=15, blank=True)
    pan = models.CharField(max_length=10, blank=True)
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=20, blank=True)

    billing_address = models.JSONField(default=dict)
    shipping_address = models.JSONField(default=dict)
    state_code = models.CharField(max_length=2, blank=True)
    pos_default = models.CharField(max_length=2, blank=True)

    credit_terms_days = models.IntegerField(default=30, validators=[MinValueValidator(0)])
    bank_details = models.JSONField(default=dict)
    contact_persons = models.JSONField(default=list)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='clients_created')
    updated_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='clients_updated')

    class Meta:
        db_table = 'clients'
        verbose_name = 'Client'
        verbose_name_plural = 'Clients'
        unique_together = ['tenant', 'client_code']

    def __str__(self):
        return f"{self.name} ({self.client_code})"


class AuditLog(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name='audit_logs')
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='audit_logs')

    entity_type = models.CharField(max_length=50)
    entity_id = models.CharField(max_length=50)
    action = models.CharField(max_length=50)

    before_data = models.JSONField(default=dict, blank=True)
    after_data = models.JSONField(default=dict, blank=True)

    ip_address = models.GenericIPAddressField(blank=True, null=True)
    user_agent = models.TextField(blank=True)
    session_id = models.CharField(max_length=50, blank=True)

    is_financial_transaction = models.BooleanField(default=False)
    compliance_relevant = models.BooleanField(default=False)

    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'audit_logs'
        verbose_name = 'Audit Log'
        verbose_name_plural = 'Audit Logs'
        indexes = [
            models.Index(fields=['tenant', 'entity_type', 'entity_id']),
            models.Index(fields=['tenant', 'user', 'timestamp']),
        ]

    def __str__(self):
        return f"{self.action} on {self.entity_type} by {self.user.email if self.user else 'System'}"