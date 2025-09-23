"""
Celery tasks for invoice processing.
"""
from celery import shared_task
from datetime import datetime, timedelta
from django.utils import timezone
from django.db import models
import logging

logger = logging.getLogger(__name__)

@shared_task
def cleanup_old_drafts():
    """
    Clean up draft invoices older than 30 days.
    """
    from .models import Invoice

    thirty_days_ago = timezone.now() - timedelta(days=30)
    old_drafts = Invoice.objects.filter(
        status='DRAFT',
        created_at__lt=thirty_days_ago
    )

    count = old_drafts.count()
    old_drafts.delete()

    logger.info(f"Cleaned up {count} old draft invoices")
    return f"Deleted {count} old draft invoices"

@shared_task
def generate_invoice_pdf(invoice_id):
    """
    Generate PDF for an invoice asynchronously.
    """
    from .models import Invoice
    from .services.pdf_generator import InvoicePDFGenerator

    try:
        invoice = Invoice.objects.get(id=invoice_id)
        generator = InvoicePDFGenerator()
        pdf_path = generator.generate(invoice)

        invoice.pdf_path = pdf_path
        invoice.save(update_fields=['pdf_path'])

        logger.info(f"PDF generated for invoice {invoice.invoice_number}")
        return f"PDF generated: {pdf_path}"
    except Invoice.DoesNotExist:
        logger.error(f"Invoice {invoice_id} not found")
        return f"Invoice {invoice_id} not found"
    except Exception as e:
        logger.error(f"Error generating PDF for invoice {invoice_id}: {str(e)}")
        raise

@shared_task
def send_invoice_email(invoice_id):
    """
    Send invoice email to customer.
    """
    from .models import Invoice
    from django.core.mail import EmailMessage
    from django.conf import settings

    try:
        invoice = Invoice.objects.get(id=invoice_id)

        if not invoice.customer.email:
            logger.warning(f"No email for customer {invoice.customer.name}")
            return "No customer email"

        subject = f"Invoice {invoice.invoice_number} from {invoice.tenant.business_name}"
        body = f"""
        Dear {invoice.customer.name},

        Please find attached your invoice {invoice.invoice_number} dated {invoice.invoice_date}.

        Amount Due: ₹{invoice.grand_total}
        Due Date: {invoice.due_date}

        Thank you for your business!

        Regards,
        {invoice.tenant.business_name}
        """

        email = EmailMessage(
            subject=subject,
            body=body,
            from_email=settings.DEFAULT_FROM_EMAIL,
            to=[invoice.customer.email],
        )

        # Attach PDF if available
        if invoice.pdf_path:
            email.attach_file(invoice.pdf_path)

        email.send()

        invoice.email_sent = True
        invoice.email_sent_at = timezone.now()
        invoice.save(update_fields=['email_sent', 'email_sent_at'])

        logger.info(f"Email sent for invoice {invoice.invoice_number}")
        return f"Email sent to {invoice.customer.email}"
    except Invoice.DoesNotExist:
        logger.error(f"Invoice {invoice_id} not found")
        return f"Invoice {invoice_id} not found"
    except Exception as e:
        logger.error(f"Error sending email for invoice {invoice_id}: {str(e)}")
        raise

@shared_task
def bulk_invoice_processing(invoice_ids):
    """
    Process multiple invoices in bulk.
    """
    results = []
    for invoice_id in invoice_ids:
        try:
            # Generate PDF
            generate_invoice_pdf.delay(invoice_id)
            # Send email
            send_invoice_email.delay(invoice_id)
            results.append(f"Processing started for invoice {invoice_id}")
        except Exception as e:
            results.append(f"Error processing invoice {invoice_id}: {str(e)}")

    return results

@shared_task
def calculate_tenant_statistics(tenant_id):
    """
    Calculate and cache statistics for a tenant.
    """
    from .models import Invoice
    from tenants.models import Tenant
    from django.db.models import Sum, Count
    from django.core.cache import cache

    try:
        tenant = Tenant.objects.get(id=tenant_id)

        stats = Invoice.objects.filter(tenant=tenant).aggregate(
            total_invoices=Count('id'),
            total_revenue=Sum('grand_total'),
            pending_amount=Sum('grand_total', filter=models.Q(payment_status='PENDING')),
            paid_amount=Sum('grand_total', filter=models.Q(payment_status='PAID'))
        )

        # Cache for 1 hour
        cache.set(f'tenant_stats_{tenant_id}', stats, 3600)

        logger.info(f"Statistics calculated for tenant {tenant.business_name}")
        return stats
    except Tenant.DoesNotExist:
        logger.error(f"Tenant {tenant_id} not found")
        return None