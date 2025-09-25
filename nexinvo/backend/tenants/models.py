from django.db import models
from django.contrib.auth import get_user_model
from django.core.validators import MinValueValidator
import uuid

User = get_user_model()


class Tenant(models.Model):
    BUSINESS_TYPES = [
        ('professional', 'Professional Services (CA, Consultant, Lawyer, Doctor)'),
        ('trader', 'Trader (Goods Trading)'),
        ('manufacturer', 'Manufacturer (Production/Manufacturing)'),
        ('contractor', 'Contractor (Service Contractor)'),
        ('epc_contractor', 'EPC Contractor (Engineering, Procurement, Construction)'),
        ('manpower_supplier', 'Manpower Supplier (HR/Staffing Services)'),
        ('software_it', 'Software/IT Services'),
        ('transport_logistics', 'Transport/Logistics'),
        ('real_estate', 'Real Estate'),
        ('retail', 'Retail Business'),
        ('hospitality', 'Hospitality (Hotels, Restaurants)'),
        ('healthcare', 'Healthcare Services'),
        ('education', 'Education Services'),
        ('agriculture', 'Agriculture/Farming'),
        ('other', 'Other Business Type'),
    ]

    SUBSCRIPTION_PLANS = [
        ('free', 'Free'),
        ('basic', 'Basic'),
        ('professional', 'Professional'),
        ('enterprise', 'Enterprise'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    business_type = models.CharField(max_length=25, choices=BUSINESS_TYPES)
    aato_threshold = models.BigIntegerField(default=5000000, validators=[MinValueValidator(0)])
    e_invoice_enabled = models.BooleanField(default=False)
    b2c_qr_enabled = models.BooleanField(default=True)

    company_details = models.JSONField(default=dict)
    gst_settings = models.JSONField(default=dict)
    business_config = models.JSONField(default=dict)  # Business-specific configurations

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

    def get_business_config(self):
        """Get business-specific configuration based on business type"""
        configs = {
            'professional': {
                'invoice_format': 'service_based',
                'item_master': {
                    'type': 'service',
                    'fields': ['service_name', 'description', 'hsn_sac', 'rate', 'unit'],
                    'required_fields': ['service_name', 'hsn_sac', 'rate']
                },
                'client_fields': ['name', 'email', 'phone', 'gstin', 'pan', 'address', 'contact_person'],
                'invoice_fields': ['client', 'service_details', 'professional_fee', 'gst', 'total'],
                'gst_compliance': {
                    'reverse_charge': False,
                    'tds_applicable': True,
                    'quarterly_gstr': True
                },
                'calculations': {
                    'discount_type': 'percentage',
                    'tax_calculation': 'exclusive',
                    'round_off': True
                },
                'reports': ['service_register', 'client_wise_revenue', 'tds_report']
            },
            'trader': {
                'invoice_format': 'goods_based',
                'item_master': {
                    'type': 'product',
                    'fields': ['item_name', 'description', 'hsn_code', 'mrp', 'selling_price', 'purchase_price', 'stock_qty', 'unit', 'brand'],
                    'required_fields': ['item_name', 'hsn_code', 'selling_price']
                },
                'client_fields': ['name', 'trading_name', 'gstin', 'pan', 'email', 'phone', 'billing_address', 'shipping_address', 'credit_terms'],
                'invoice_fields': ['client', 'items', 'quantity', 'rate', 'discount', 'taxable_value', 'gst', 'total'],
                'gst_compliance': {
                    'reverse_charge': True,
                    'e_invoice_mandatory': True,
                    'gstr1_monthly': True
                },
                'calculations': {
                    'discount_type': 'amount_or_percentage',
                    'tax_calculation': 'exclusive',
                    'round_off': True,
                    'freight_charges': True
                },
                'reports': ['sales_register', 'purchase_register', 'stock_report', 'gst_summary']
            },
            'manufacturer': {
                'invoice_format': 'manufacturing',
                'item_master': {
                    'type': 'manufactured_goods',
                    'fields': ['product_name', 'product_code', 'description', 'hsn_code', 'manufacturing_cost', 'selling_price', 'raw_materials', 'finished_goods_stock', 'unit', 'batch_no'],
                    'required_fields': ['product_name', 'product_code', 'hsn_code', 'selling_price']
                },
                'client_fields': ['company_name', 'gstin', 'pan', 'email', 'phone', 'billing_address', 'shipping_address', 'credit_terms', 'buyer_type'],
                'invoice_fields': ['client', 'products', 'batch_details', 'quantity', 'rate', 'excise_duty', 'gst', 'total'],
                'gst_compliance': {
                    'reverse_charge': True,
                    'e_invoice_mandatory': True,
                    'job_work_applicable': True,
                    'gstr1_monthly': True
                },
                'calculations': {
                    'discount_type': 'amount_or_percentage',
                    'tax_calculation': 'exclusive',
                    'round_off': True,
                    'packing_forwarding': True,
                    'freight_charges': True
                },
                'reports': ['production_report', 'raw_material_consumption', 'finished_goods_report', 'job_work_report']
            },
            'contractor': {
                'invoice_format': 'contract_based',
                'item_master': {
                    'type': 'service',
                    'fields': ['work_description', 'contract_type', 'hsn_sac', 'rate', 'unit', 'labour_charges', 'material_charges'],
                    'required_fields': ['work_description', 'hsn_sac', 'rate']
                },
                'client_fields': ['client_name', 'project_name', 'gstin', 'pan', 'email', 'phone', 'site_address', 'contract_value', 'work_order_no'],
                'invoice_fields': ['client', 'work_details', 'labour_charges', 'material_charges', 'tds', 'gst', 'total'],
                'gst_compliance': {
                    'reverse_charge': True,
                    'tds_applicable': True,
                    'composition_scheme_eligible': False
                },
                'calculations': {
                    'discount_type': 'amount',
                    'tax_calculation': 'exclusive',
                    'round_off': True,
                    'retention_money': True,
                    'advance_adjustment': True
                },
                'reports': ['work_completion_report', 'project_wise_billing', 'tds_deducted_report']
            },
            'epc_contractor': {
                'invoice_format': 'epc_project',
                'item_master': {
                    'type': 'epc_service',
                    'fields': ['project_component', 'engineering_cost', 'procurement_cost', 'construction_cost', 'hsn_sac', 'milestone', 'completion_percentage'],
                    'required_fields': ['project_component', 'hsn_sac', 'milestone']
                },
                'client_fields': ['client_name', 'project_name', 'contract_no', 'gstin', 'pan', 'email', 'phone', 'project_site', 'contract_value', 'project_timeline'],
                'invoice_fields': ['client', 'project_details', 'milestone_billing', 'engineering_charges', 'procurement_charges', 'construction_charges', 'performance_guarantee', 'gst', 'total'],
                'gst_compliance': {
                    'reverse_charge': True,
                    'tds_applicable': True,
                    'works_contract_tax': True
                },
                'calculations': {
                    'milestone_based_billing': True,
                    'retention_money': True,
                    'performance_guarantee': True,
                    'advance_adjustment': True
                },
                'reports': ['milestone_report', 'project_progress_report', 'retention_money_report']
            },
            'manpower_supplier': {
                'invoice_format': 'manpower_supply',
                'item_master': {
                    'type': 'manpower',
                    'fields': ['designation', 'skill_category', 'hourly_rate', 'daily_rate', 'monthly_rate', 'hsn_sac'],
                    'required_fields': ['designation', 'hsn_sac', 'hourly_rate']
                },
                'client_fields': ['company_name', 'contact_person', 'gstin', 'pan', 'email', 'phone', 'work_location', 'contract_period'],
                'invoice_fields': ['client', 'manpower_details', 'working_days', 'overtime_hours', 'basic_charges', 'overtime_charges', 'gst', 'total'],
                'gst_compliance': {
                    'reverse_charge': False,
                    'tds_applicable': False,
                    'pf_esi_applicable': True
                },
                'calculations': {
                    'overtime_calculation': True,
                    'attendance_based': True,
                    'statutory_deductions': True
                },
                'reports': ['manpower_deployment_report', 'attendance_report', 'statutory_compliance_report']
            },
            'software_it': {
                'invoice_format': 'it_services',
                'item_master': {
                    'type': 'it_service',
                    'fields': ['service_type', 'technology', 'description', 'hourly_rate', 'fixed_price', 'hsn_sac', 'duration'],
                    'required_fields': ['service_type', 'hsn_sac', 'hourly_rate']
                },
                'client_fields': ['company_name', 'contact_person', 'gstin', 'pan', 'email', 'phone', 'project_type', 'technology_stack'],
                'invoice_fields': ['client', 'project_details', 'development_hours', 'hourly_rate', 'fixed_components', 'maintenance_charges', 'gst', 'total'],
                'gst_compliance': {
                    'export_services': True,
                    'lut_applicable': True,
                    'place_of_supply_rules': True
                },
                'calculations': {
                    'time_and_material': True,
                    'fixed_price_projects': True,
                    'milestone_billing': True
                },
                'reports': ['project_billing_report', 'resource_utilization_report', 'export_services_report']
            }
        }

        # Default configuration for other business types
        default_config = {
            'invoice_format': 'general',
            'item_master': {
                'type': 'general',
                'fields': ['item_name', 'description', 'hsn_sac', 'rate', 'unit'],
                'required_fields': ['item_name', 'rate']
            },
            'client_fields': ['name', 'gstin', 'email', 'phone', 'address'],
            'invoice_fields': ['client', 'items', 'quantity', 'rate', 'gst', 'total'],
            'gst_compliance': {
                'reverse_charge': False,
                'composition_eligible': True
            },
            'calculations': {
                'tax_calculation': 'exclusive',
                'round_off': True
            },
            'reports': ['sales_register', 'gst_summary']
        }

        return configs.get(self.business_type, default_config)

    def save(self, *args, **kwargs):
        """Override save to set business config automatically"""
        if not self.business_config:
            self.business_config = self.get_business_config()
        super().save(*args, **kwargs)


class TenantMembership(models.Model):
    ROLES = [
        ('owner', 'Business Owner'),
        ('admin', 'Admin'),
        ('finance_user', 'Finance User'),
        ('manager', 'Manager'),
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