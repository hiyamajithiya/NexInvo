"""
Models for Reports and GST Returns
"""

from django.db import models
from django.contrib.auth import get_user_model
from django.core.validators import MinValueValidator, MaxValueValidator
import uuid

from tenants.models import Tenant

User = get_user_model()


class GSTReturn(models.Model):
    """
    Model for storing GST return data and filing status
    """

    RETURN_TYPES = [
        ('GSTR1', 'GSTR-1 (Outward Supplies)'),
        ('GSTR3B', 'GSTR-3B (Summary Return)'),
        ('GSTR2A', 'GSTR-2A (Auto-drafted ITC)'),
        ('GSTR2B', 'GSTR-2B (Auto-generated ITC)'),
        ('GSTR9', 'GSTR-9 (Annual Return)'),
    ]

    FILING_STATUS = [
        ('draft', 'Draft'),
        ('generated', 'Generated'),
        ('validated', 'Validated'),
        ('filed', 'Filed'),
        ('acknowledged', 'Acknowledged'),
        ('failed', 'Failed'),
    ]

    FILING_FREQUENCY = [
        ('MONTHLY', 'Monthly'),
        ('QUARTERLY', 'Quarterly'),
        ('ANNUAL', 'Annual'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name='gst_returns')

    return_type = models.CharField(max_length=10, choices=RETURN_TYPES)
    return_period = models.CharField(max_length=6)  # MMYYYY format
    filing_frequency = models.CharField(max_length=10, choices=FILING_FREQUENCY, default='MONTHLY')

    filing_status = models.CharField(max_length=20, choices=FILING_STATUS, default='draft')
    return_data = models.JSONField(default=dict)  # Store the generated return JSON
    validation_result = models.JSONField(default=dict, blank=True)  # Validation errors/warnings

    # Filing details
    acknowledgment_number = models.CharField(max_length=50, blank=True)
    reference_id = models.CharField(max_length=50, blank=True)
    filed_date = models.DateTimeField(null=True, blank=True)
    due_date = models.DateTimeField(null=True, blank=True)

    # Summary statistics
    total_invoices = models.IntegerField(default=0)
    total_taxable_value = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    total_tax_amount = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    total_invoice_value = models.DecimalField(max_digits=15, decimal_places=2, default=0)

    # Audit fields
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='gst_returns_created')
    updated_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='gst_returns_updated')

    class Meta:
        db_table = 'gst_returns'
        verbose_name = 'GST Return'
        verbose_name_plural = 'GST Returns'
        unique_together = ['tenant', 'return_type', 'return_period']
        ordering = ['-return_period', '-created_at']

    def __str__(self):
        return f"{self.return_type} - {self.return_period} ({self.tenant.name})"

    @property
    def return_period_display(self):
        """Get human-readable return period"""
        if len(self.return_period) == 6:
            month = self.return_period[:2]
            year = self.return_period[2:]
            return f"{month}/{year}"
        return self.return_period

    @property
    def is_overdue(self):
        """Check if return is overdue"""
        from django.utils import timezone
        return self.due_date and timezone.now() > self.due_date and self.filing_status not in ['filed', 'acknowledged']


class ReportTemplate(models.Model):
    """
    Model for storing custom report templates
    """

    REPORT_TYPES = [
        ('financial', 'Financial Report'),
        ('sales', 'Sales Report'),
        ('tax', 'Tax Report'),
        ('client', 'Client Report'),
        ('inventory', 'Inventory Report'),
        ('custom', 'Custom Report'),
    ]

    OUTPUT_FORMATS = [
        ('pdf', 'PDF'),
        ('excel', 'Excel'),
        ('csv', 'CSV'),
        ('json', 'JSON'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name='report_templates')

    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    report_type = models.CharField(max_length=20, choices=REPORT_TYPES)

    # Template configuration
    query_config = models.JSONField(default=dict)  # SQL query or filter configuration
    layout_config = models.JSONField(default=dict)  # Layout and formatting
    chart_config = models.JSONField(default=dict, blank=True)  # Chart configurations

    # Output settings
    default_format = models.CharField(max_length=10, choices=OUTPUT_FORMATS, default='pdf')
    include_charts = models.BooleanField(default=False)
    include_summary = models.BooleanField(default=True)

    # Scheduling
    is_scheduled = models.BooleanField(default=False)
    schedule_config = models.JSONField(default=dict, blank=True)  # Cron expression, recipients

    # Template status
    is_active = models.BooleanField(default=True)
    is_system_template = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='report_templates_created')

    class Meta:
        db_table = 'report_templates'
        verbose_name = 'Report Template'
        verbose_name_plural = 'Report Templates'
        ordering = ['name']

    def __str__(self):
        return f"{self.name} ({self.report_type})"


class GeneratedReport(models.Model):
    """
    Model for tracking generated reports
    """

    GENERATION_STATUS = [
        ('pending', 'Pending'),
        ('processing', 'Processing'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
        ('expired', 'Expired'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name='generated_reports')
    template = models.ForeignKey(ReportTemplate, on_delete=models.CASCADE, related_name='generated_reports')

    # Report parameters
    report_name = models.CharField(max_length=200)
    date_range_start = models.DateField()
    date_range_end = models.DateField()
    filters_applied = models.JSONField(default=dict, blank=True)

    # Generation details
    generation_status = models.CharField(max_length=20, choices=GENERATION_STATUS, default='pending')
    file_path = models.CharField(max_length=500, blank=True)
    file_size = models.BigIntegerField(null=True, blank=True)  # Size in bytes
    output_format = models.CharField(max_length=10)

    # Metrics
    total_records = models.IntegerField(null=True, blank=True)
    generation_time_seconds = models.FloatField(null=True, blank=True)

    # Access tracking
    download_count = models.IntegerField(default=0)
    last_downloaded = models.DateTimeField(null=True, blank=True)
    expires_at = models.DateTimeField(null=True, blank=True)

    # Error handling
    error_message = models.TextField(blank=True)
    retry_count = models.IntegerField(default=0)

    # Audit fields
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    generated_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='reports_generated')

    class Meta:
        db_table = 'generated_reports'
        verbose_name = 'Generated Report'
        verbose_name_plural = 'Generated Reports'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.report_name} - {self.created_at.strftime('%Y-%m-%d')}"

    @property
    def is_expired(self):
        """Check if report file has expired"""
        from django.utils import timezone
        return self.expires_at and timezone.now() > self.expires_at

    @property
    def file_size_mb(self):
        """Get file size in MB"""
        return round(self.file_size / (1024 * 1024), 2) if self.file_size else 0


class ReportSchedule(models.Model):
    """
    Model for managing scheduled report generation
    """

    SCHEDULE_FREQUENCY = [
        ('daily', 'Daily'),
        ('weekly', 'Weekly'),
        ('monthly', 'Monthly'),
        ('quarterly', 'Quarterly'),
        ('annually', 'Annually'),
        ('custom', 'Custom'),
    ]

    SCHEDULE_STATUS = [
        ('active', 'Active'),
        ('paused', 'Paused'),
        ('stopped', 'Stopped'),
        ('failed', 'Failed'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name='report_schedules')
    template = models.ForeignKey(ReportTemplate, on_delete=models.CASCADE, related_name='schedules')

    # Schedule configuration
    name = models.CharField(max_length=100)
    frequency = models.CharField(max_length=20, choices=SCHEDULE_FREQUENCY)
    cron_expression = models.CharField(max_length=100, blank=True)  # For custom schedules

    # Date range configuration
    relative_date_range = models.CharField(max_length=50, default='last_month')  # last_week, last_month, etc.

    # Recipients
    email_recipients = models.JSONField(default=list)  # List of email addresses
    include_creator = models.BooleanField(default=True)

    # Output settings
    output_formats = models.JSONField(default=list)  # ['pdf', 'excel']
    include_summary_email = models.BooleanField(default=True)

    # Schedule status
    status = models.CharField(max_length=20, choices=SCHEDULE_STATUS, default='active')
    last_run_at = models.DateTimeField(null=True, blank=True)
    next_run_at = models.DateTimeField(null=True, blank=True)
    last_run_status = models.CharField(max_length=20, blank=True)

    # Error handling
    consecutive_failures = models.IntegerField(default=0)
    max_failures = models.IntegerField(default=3)
    failure_notification_sent = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='schedules_created')

    class Meta:
        db_table = 'report_schedules'
        verbose_name = 'Report Schedule'
        verbose_name_plural = 'Report Schedules'
        ordering = ['name']

    def __str__(self):
        return f"{self.name} ({self.frequency})"

    @property
    def is_overdue(self):
        """Check if schedule is overdue"""
        from django.utils import timezone
        return self.next_run_at and timezone.now() > self.next_run_at and self.status == 'active'


class ReportAnalytics(models.Model):
    """
    Model for tracking report usage analytics
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name='report_analytics')

    # Analytics data (daily aggregation)
    date = models.DateField()

    # Report generation metrics
    reports_generated = models.IntegerField(default=0)
    reports_downloaded = models.IntegerField(default=0)
    total_generation_time = models.FloatField(default=0)  # Total time in seconds

    # Report type breakdown
    report_type_breakdown = models.JSONField(default=dict)  # {report_type: count}

    # User activity
    active_users = models.IntegerField(default=0)

    # Storage metrics
    total_file_size = models.BigIntegerField(default=0)  # Total bytes

    # Template usage
    template_usage = models.JSONField(default=dict)  # {template_id: usage_count}

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'report_analytics'
        verbose_name = 'Report Analytics'
        verbose_name_plural = 'Report Analytics'
        unique_together = ['tenant', 'date']
        ordering = ['-date']

    def __str__(self):
        return f"Analytics for {self.date} ({self.tenant.name})"