"""
Email Service for NexInvo
Handles invoice email delivery, templates, and communication tracking
"""

import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.application import MIMEApplication
from email.utils import formataddr
from typing import Dict, List, Optional, Tuple, Any
from pathlib import Path
import logging
from datetime import datetime, timedelta

from django.conf import settings
from django.template.loader import render_to_string
from django.utils import timezone
from django.core.mail import EmailMultiAlternatives, get_connection
from django.core.mail.backends.smtp import EmailBackend

from .models import Invoice, EmailCommunication
from .pdf_generator import PDFGenerator

logger = logging.getLogger(__name__)


class EmailService:
    """
    Professional email service for invoice delivery with tracking and templates
    """

    def __init__(self):
        self.pdf_generator = PDFGenerator()
        self.templates_dir = Path(__file__).parent / 'templates' / 'email'
        self.templates_dir.mkdir(parents=True, exist_ok=True)

        # Email configuration
        self.smtp_config = {
            'host': getattr(settings, 'EMAIL_HOST', 'smtp.gmail.com'),
            'port': getattr(settings, 'EMAIL_PORT', 587),
            'use_tls': getattr(settings, 'EMAIL_USE_TLS', True),
            'username': getattr(settings, 'EMAIL_HOST_USER', ''),
            'password': getattr(settings, 'EMAIL_HOST_PASSWORD', ''),
            'from_email': getattr(settings, 'DEFAULT_FROM_EMAIL', ''),
        }

    def send_invoice_email(
        self,
        invoice: Invoice,
        recipient_emails: List[str],
        template_name: str = 'invoice_delivery',
        subject: Optional[str] = None,
        custom_message: Optional[str] = None,
        include_pdf: bool = True,
        pdf_template: str = 'professional',
        cc_emails: Optional[List[str]] = None,
        bcc_emails: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """
        Send invoice via email with PDF attachment

        Args:
            invoice: Invoice instance to send
            recipient_emails: List of recipient email addresses
            template_name: Email template to use
            subject: Custom email subject (optional)
            custom_message: Custom message to include
            include_pdf: Whether to attach PDF
            pdf_template: PDF template to use
            cc_emails: CC email addresses
            bcc_emails: BCC email addresses

        Returns:
            Dict with success status and details
        """
        try:
            # Prepare email data
            email_data = self._prepare_email_data(invoice, custom_message)

            # Generate subject if not provided
            if not subject:
                subject = f"Invoice {invoice.number} from {invoice.tenant.name}"

            # Load email template
            html_content, text_content = self._render_email_template(
                template_name, email_data
            )

            # Create email message
            msg = EmailMultiAlternatives(
                subject=subject,
                body=text_content,
                from_email=self._get_from_email(invoice),
                to=recipient_emails,
                cc=cc_emails or [],
                bcc=bcc_emails or []
            )

            # Add HTML alternative
            if html_content:
                msg.attach_alternative(html_content, "text/html")

            # Attach PDF if requested
            pdf_attachment = None
            if include_pdf:
                pdf_bytes = self.pdf_generator.generate_invoice_pdf(
                    invoice=invoice,
                    template_name=pdf_template,
                    include_qr=True
                )

                filename = f"Invoice_{invoice.number}.pdf"
                msg.attach(filename, pdf_bytes, 'application/pdf')
                pdf_attachment = filename

            # Send email
            connection = get_connection()
            sent_count = msg.send()

            # Log communication
            communication = self._log_email_communication(
                invoice=invoice,
                recipient_emails=recipient_emails,
                subject=subject,
                template_name=template_name,
                pdf_attachment=pdf_attachment,
                status='sent' if sent_count > 0 else 'failed',
                cc_emails=cc_emails,
                bcc_emails=bcc_emails
            )

            return {
                'success': sent_count > 0,
                'sent_count': sent_count,
                'communication_id': communication.id,
                'message': f"Invoice email sent to {len(recipient_emails)} recipients"
            }

        except Exception as e:
            logger.error(f"Failed to send invoice email: {str(e)}")

            # Log failed communication
            communication = self._log_email_communication(
                invoice=invoice,
                recipient_emails=recipient_emails,
                subject=subject or f"Invoice {invoice.number}",
                template_name=template_name,
                status='failed',
                error_message=str(e)
            )

            return {
                'success': False,
                'error': str(e),
                'communication_id': communication.id,
                'message': f"Failed to send invoice email: {str(e)}"
            }

    def send_payment_reminder(
        self,
        invoice: Invoice,
        reminder_type: str = 'gentle',
        days_overdue: int = 0
    ) -> Dict[str, Any]:
        """
        Send payment reminder email

        Args:
            invoice: Overdue invoice
            reminder_type: Type of reminder (gentle, firm, final)
            days_overdue: Number of days overdue

        Returns:
            Dict with success status and details
        """
        try:
            # Determine email template and subject based on reminder type
            template_map = {
                'gentle': 'payment_reminder_gentle',
                'firm': 'payment_reminder_firm',
                'final': 'payment_reminder_final'
            }

            subject_map = {
                'gentle': f"Payment Reminder - Invoice {invoice.number}",
                'firm': f"Urgent: Payment Required - Invoice {invoice.number}",
                'final': f"Final Notice - Invoice {invoice.number}"
            }

            template_name = template_map.get(reminder_type, 'payment_reminder_gentle')
            subject = subject_map.get(reminder_type, f"Payment Reminder - Invoice {invoice.number}")

            # Prepare reminder data
            email_data = self._prepare_email_data(invoice)
            email_data.update({
                'reminder_type': reminder_type,
                'days_overdue': days_overdue,
                'overdue_amount': float(invoice.grand_total),
                'due_date': invoice.due_date,
                'reminder_date': timezone.now().date()
            })

            # Send email to client
            client_emails = [invoice.client.email] if invoice.client.email else []

            if not client_emails:
                return {
                    'success': False,
                    'error': 'No client email address available',
                    'message': 'Cannot send payment reminder - no client email'
                }

            return self.send_invoice_email(
                invoice=invoice,
                recipient_emails=client_emails,
                template_name=template_name,
                subject=subject,
                include_pdf=True
            )

        except Exception as e:
            logger.error(f"Failed to send payment reminder: {str(e)}")
            return {
                'success': False,
                'error': str(e),
                'message': f"Failed to send payment reminder: {str(e)}"
            }

    def send_bulk_invoices(
        self,
        invoices: List[Invoice],
        template_name: str = 'invoice_delivery',
        pdf_template: str = 'professional'
    ) -> Dict[str, Any]:
        """
        Send multiple invoices in bulk

        Args:
            invoices: List of invoices to send
            template_name: Email template to use
            pdf_template: PDF template to use

        Returns:
            Dict with bulk send results
        """
        results = {
            'total_invoices': len(invoices),
            'successful_sends': 0,
            'failed_sends': 0,
            'results': []
        }

        for invoice in invoices:
            try:
                # Get client email
                client_emails = [invoice.client.email] if invoice.client.email else []

                if not client_emails:
                    results['results'].append({
                        'invoice_id': invoice.id,
                        'invoice_number': invoice.number,
                        'success': False,
                        'error': 'No client email address'
                    })
                    results['failed_sends'] += 1
                    continue

                # Send invoice
                result = self.send_invoice_email(
                    invoice=invoice,
                    recipient_emails=client_emails,
                    template_name=template_name,
                    pdf_template=pdf_template
                )

                results['results'].append({
                    'invoice_id': invoice.id,
                    'invoice_number': invoice.number,
                    'success': result['success'],
                    'communication_id': result.get('communication_id'),
                    'error': result.get('error')
                })

                if result['success']:
                    results['successful_sends'] += 1
                else:
                    results['failed_sends'] += 1

            except Exception as e:
                logger.error(f"Bulk send failed for invoice {invoice.number}: {str(e)}")
                results['results'].append({
                    'invoice_id': invoice.id,
                    'invoice_number': invoice.number,
                    'success': False,
                    'error': str(e)
                })
                results['failed_sends'] += 1

        return results

    def _prepare_email_data(self, invoice: Invoice, custom_message: Optional[str] = None) -> Dict[str, Any]:
        """Prepare data for email template rendering"""

        return {
            'invoice': {
                'id': str(invoice.id),
                'number': invoice.number,
                'date': invoice.date,
                'due_date': invoice.due_date,
                'grand_total': float(invoice.grand_total),
                'currency': invoice.currency,
                'payment_status': invoice.get_payment_status_display(),
                'notes': invoice.notes,
                'terms_conditions': invoice.terms_conditions
            },
            'supplier': {
                'name': invoice.tenant.name,
                'company_details': invoice.tenant.company_details,
                'email': invoice.tenant.company_details.get('email', ''),
                'phone': invoice.tenant.company_details.get('phone', ''),
                'website': invoice.tenant.company_details.get('website', '')
            },
            'client': {
                'name': invoice.client.name,
                'email': invoice.client.email,
                'phone': invoice.client.phone,
                'company': invoice.client.company_name
            },
            'custom_message': custom_message,
            'current_date': timezone.now().date(),
            'system_info': {
                'company_name': 'NexInvo',
                'support_email': 'support@nexinvo.com'
            }
        }

    def _render_email_template(self, template_name: str, data: Dict[str, Any]) -> Tuple[Optional[str], str]:
        """Render email template with data"""

        try:
            # Try to load custom template
            html_template_path = self.templates_dir / f"{template_name}.html"
            text_template_path = self.templates_dir / f"{template_name}.txt"

            html_content = None
            text_content = ""

            # Load HTML template if exists
            if html_template_path.exists():
                html_content = render_to_string(f"email/{template_name}.html", data)

            # Load text template if exists, otherwise use default
            if text_template_path.exists():
                text_content = render_to_string(f"email/{template_name}.txt", data)
            else:
                text_content = self._get_default_text_template(template_name, data)

            return html_content, text_content

        except Exception as e:
            logger.error(f"Failed to render email template {template_name}: {str(e)}")
            # Fallback to default template
            return None, self._get_default_text_template(template_name, data)

    def _get_default_text_template(self, template_name: str, data: Dict[str, Any]) -> str:
        """Get default text email template"""

        invoice = data['invoice']
        supplier = data['supplier']
        client = data['client']

        if template_name.startswith('payment_reminder'):
            reminder_type = data.get('reminder_type', 'gentle')
            days_overdue = data.get('days_overdue', 0)

            if reminder_type == 'gentle':
                return f"""
Dear {client['name']},

This is a gentle reminder that your payment for Invoice {invoice['number']} is now due.

Invoice Details:
- Invoice Number: {invoice['number']}
- Invoice Date: {invoice['date']}
- Due Date: {invoice['due_date']}
- Amount Due: {invoice['currency']} {invoice['grand_total']:,.2f}
- Days Overdue: {days_overdue}

Please arrange payment at your earliest convenience. If you have already made this payment, please disregard this reminder.

If you have any questions about this invoice, please don't hesitate to contact us.

Best regards,
{supplier['name']}
{supplier['email']}
{supplier['phone']}
"""
            elif reminder_type == 'firm':
                return f"""
Dear {client['name']},

This is an urgent reminder that your payment for Invoice {invoice['number']} is now {days_overdue} days overdue.

Invoice Details:
- Invoice Number: {invoice['number']}
- Invoice Date: {invoice['date']}
- Due Date: {invoice['due_date']}
- Amount Due: {invoice['currency']} {invoice['grand_total']:,.2f}
- Days Overdue: {days_overdue}

Please arrange immediate payment to avoid any service interruption or additional charges.

If you have any questions or payment arrangements to discuss, please contact us immediately.

Regards,
{supplier['name']}
{supplier['email']}
{supplier['phone']}
"""
            else:  # final
                return f"""
Dear {client['name']},

FINAL NOTICE: Your payment for Invoice {invoice['number']} is now {days_overdue} days overdue.

Invoice Details:
- Invoice Number: {invoice['number']}
- Invoice Date: {invoice['date']}
- Due Date: {invoice['due_date']}
- Amount Due: {invoice['currency']} {invoice['grand_total']:,.2f}
- Days Overdue: {days_overdue}

This is your final notice before we take further action. Please arrange immediate payment or contact us to discuss payment arrangements.

Failure to respond within 7 days may result in additional collection actions.

{supplier['name']}
{supplier['email']}
{supplier['phone']}
"""

        else:  # invoice_delivery
            return f"""
Dear {client['name']},

Please find attached Invoice {invoice['number']} for your recent purchase.

Invoice Details:
- Invoice Number: {invoice['number']}
- Invoice Date: {invoice['date']}
- Due Date: {invoice['due_date']}
- Amount: {invoice['currency']} {invoice['grand_total']:,.2f}

Payment is due by {invoice['due_date']}. Please review the attached invoice and contact us if you have any questions.

Thank you for your business!

Best regards,
{supplier['name']}
{supplier['email']}
{supplier['phone']}

---
This invoice was generated by NexInvo
"""

    def _get_from_email(self, invoice: Invoice) -> str:
        """Get the from email address for the invoice"""

        # Try to use tenant's email first
        tenant_email = invoice.tenant.company_details.get('email')
        if tenant_email:
            return formataddr((invoice.tenant.name, tenant_email))

        # Fallback to system default
        return self.smtp_config['from_email']

    def _log_email_communication(
        self,
        invoice: Invoice,
        recipient_emails: List[str],
        subject: str,
        template_name: str,
        status: str,
        pdf_attachment: Optional[str] = None,
        error_message: Optional[str] = None,
        cc_emails: Optional[List[str]] = None,
        bcc_emails: Optional[List[str]] = None
    ) -> EmailCommunication:
        """Log email communication for tracking"""

        communication = EmailCommunication.objects.create(
            tenant=invoice.tenant,
            invoice=invoice,
            communication_type='email',
            direction='outbound',
            status=status,
            subject=subject,
            content=f"Template: {template_name}",
            recipient_emails=recipient_emails,
            cc_emails=cc_emails or [],
            bcc_emails=bcc_emails or [],
            attachments=[pdf_attachment] if pdf_attachment else [],
            error_message=error_message,
            sent_at=timezone.now() if status == 'sent' else None
        )

        return communication

    def get_email_templates(self) -> List[Dict[str, str]]:
        """Get list of available email templates"""

        return [
            {
                'name': 'invoice_delivery',
                'display_name': 'Invoice Delivery',
                'description': 'Standard invoice delivery email with PDF attachment'
            },
            {
                'name': 'payment_reminder_gentle',
                'display_name': 'Gentle Payment Reminder',
                'description': 'Polite reminder for overdue payments'
            },
            {
                'name': 'payment_reminder_firm',
                'display_name': 'Firm Payment Reminder',
                'description': 'Urgent reminder for significantly overdue payments'
            },
            {
                'name': 'payment_reminder_final',
                'display_name': 'Final Payment Notice',
                'description': 'Final notice before collection actions'
            },
            {
                'name': 'invoice_correction',
                'display_name': 'Invoice Correction',
                'description': 'Email for sending corrected or updated invoices'
            },
            {
                'name': 'payment_confirmation',
                'display_name': 'Payment Confirmation',
                'description': 'Confirmation email when payment is received'
            }
        ]

    def test_email_configuration(self) -> Dict[str, Any]:
        """Test email configuration and connectivity"""

        try:
            connection = get_connection()
            connection.open()
            connection.close()

            return {
                'success': True,
                'message': 'Email configuration is working correctly',
                'smtp_host': self.smtp_config['host'],
                'smtp_port': self.smtp_config['port']
            }

        except Exception as e:
            return {
                'success': False,
                'error': str(e),
                'message': f'Email configuration test failed: {str(e)}'
            }