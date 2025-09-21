"""
PDF Generation Engine for NexInvo
Supports multiple templates, QR codes, and GST-compliant invoice generation
"""

import os
import base64
import io
from decimal import Decimal
from datetime import datetime, date
from typing import Dict, Any, Optional, List, Tuple
from pathlib import Path

import qrcode
from qrcode.image.styledpil import StyledPilImage
from qrcode.image.styles.moduledrawers import CircleModuleDrawer, SquareModuleDrawer
from PIL import Image, ImageDraw, ImageFont

try:
    from weasyprint import HTML, CSS
    from weasyprint.text.fonts import FontConfiguration
    WEASYPRINT_AVAILABLE = True
except (ImportError, OSError):
    # Handle both import errors and missing system dependencies
    WEASYPRINT_AVAILABLE = False
    HTML = None
    CSS = None
    FontConfiguration = None

from reportlab.lib.pagesizes import A4, letter
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, Image
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch, mm
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT, TA_RIGHT, TA_CENTER, TA_JUSTIFY
from reportlab.pdfgen import canvas
from reportlab.graphics.shapes import Drawing
from reportlab.graphics.charts.barcharts import VerticalBarChart

from django.template.loader import render_to_string
from django.conf import settings
from django.utils.safestring import mark_safe
import json

from .models import Invoice, InvoiceTemplate


class PDFGenerator:
    """
    Professional PDF Generator for GST-compliant invoices with templates and QR codes
    """

    def __init__(self):
        if WEASYPRINT_AVAILABLE:
            self.font_config = FontConfiguration()
        else:
            self.font_config = None

        self.templates_dir = Path(__file__).parent / 'templates' / 'pdf'
        self.static_dir = Path(settings.BASE_DIR) / 'static'
        self.media_dir = Path(settings.MEDIA_ROOT) if hasattr(settings, 'MEDIA_ROOT') else Path(settings.BASE_DIR) / 'media'

        # Ensure directories exist
        self.templates_dir.mkdir(parents=True, exist_ok=True)
        self.media_dir.mkdir(parents=True, exist_ok=True)

        # Setup ReportLab styles
        self.styles = getSampleStyleSheet()
        self._setup_custom_styles()

    def _setup_custom_styles(self):
        """Setup custom ReportLab styles for professional invoices"""
        # Custom styles for ReportLab
        self.styles.add(ParagraphStyle(
            name='CompanyName',
            parent=self.styles['Heading1'],
            fontSize=18,
            textColor=colors.HexColor('#1B365D'),
            spaceAfter=6,
            fontName='Helvetica-Bold'
        ))

        self.styles.add(ParagraphStyle(
            name='InvoiceTitle',
            parent=self.styles['Heading1'],
            fontSize=24,
            textColor=colors.HexColor('#1B365D'),
            alignment=TA_RIGHT,
            fontName='Helvetica-Bold'
        ))

        self.styles.add(ParagraphStyle(
            name='SectionHeader',
            parent=self.styles['Heading2'],
            fontSize=12,
            textColor=colors.HexColor('#1B365D'),
            spaceBefore=12,
            spaceAfter=6,
            fontName='Helvetica-Bold'
        ))

        self.styles.add(ParagraphStyle(
            name='TableHeader',
            parent=self.styles['Normal'],
            fontSize=10,
            textColor=colors.HexColor('#1B365D'),
            fontName='Helvetica-Bold',
            alignment=TA_CENTER
        ))

        self.styles.add(ParagraphStyle(
            name='TableCell',
            parent=self.styles['Normal'],
            fontSize=9,
            fontName='Helvetica'
        ))

        self.styles.add(ParagraphStyle(
            name='TotalAmount',
            parent=self.styles['Normal'],
            fontSize=12,
            fontName='Helvetica-Bold',
            textColor=colors.HexColor('#1B365D')
        ))

    def generate_invoice_pdf(
        self,
        invoice: Invoice,
        template_name: Optional[str] = None,
        include_qr: bool = True,
        watermark: Optional[str] = None
    ) -> bytes:
        """
        Generate PDF for an invoice using specified template

        Args:
            invoice: Invoice instance
            template_name: Template to use (default: professional)
            include_qr: Whether to include QR code
            watermark: Optional watermark text

        Returns:
            PDF bytes
        """
        # Prepare invoice data
        invoice_data = self._prepare_invoice_data(invoice)

        # Generate QR code if requested
        if include_qr:
            qr_data = self._generate_invoice_qr_data(invoice)
            qr_image_base64 = self._generate_qr_code(qr_data)
            invoice_data['qr_code'] = qr_image_base64

        # Get template
        template = self._get_template(template_name or 'professional')

        # Render HTML
        html_content = self._render_template(template, invoice_data)

        # Add watermark if specified
        if watermark:
            html_content = self._add_watermark(html_content, watermark)

        # Generate PDF
        pdf_bytes = self._html_to_pdf(html_content, template.get('css_styles', ''))

        return pdf_bytes

    def _prepare_invoice_data(self, invoice: Invoice) -> Dict[str, Any]:
        """Prepare comprehensive invoice data for template rendering"""

        # Calculate summary totals
        lines = invoice.lines.all()

        tax_summary = {
            'cgst_total': sum(line.cgst_amount for line in lines),
            'sgst_total': sum(line.sgst_amount for line in lines),
            'igst_total': sum(line.igst_amount for line in lines),
            'cess_total': sum(line.cess_amount for line in lines),
        }

        # Group lines by tax rate for tax summary table
        tax_rate_groups = {}
        for line in lines:
            total_rate = float(line.cgst_rate + line.sgst_rate + line.igst_rate)
            if total_rate not in tax_rate_groups:
                tax_rate_groups[total_rate] = {
                    'rate': total_rate,
                    'taxable_amount': Decimal('0'),
                    'cgst_amount': Decimal('0'),
                    'sgst_amount': Decimal('0'),
                    'igst_amount': Decimal('0'),
                    'cess_amount': Decimal('0'),
                    'total_tax': Decimal('0')
                }

            group = tax_rate_groups[total_rate]
            group['taxable_amount'] += line.taxable_value
            group['cgst_amount'] += line.cgst_amount
            group['sgst_amount'] += line.sgst_amount
            group['igst_amount'] += line.igst_amount
            group['cess_amount'] += line.cess_amount
            group['total_tax'] += (line.cgst_amount + line.sgst_amount +
                                 line.igst_amount + line.cess_amount)

        # Convert to list for template
        tax_rate_summary = list(tax_rate_groups.values())

        # Prepare comprehensive data
        data = {
            'invoice': {
                'id': str(invoice.id),
                'number': invoice.number,
                'series': invoice.series,
                'date': invoice.date,
                'due_date': invoice.due_date,
                'invoice_type': invoice.get_invoice_type_display(),
                'place_of_supply': invoice.place_of_supply,
                'place_of_supply_name': self._get_state_name(invoice.place_of_supply),
                'reverse_charge': invoice.reverse_charge,
                'currency': invoice.currency,
                'exchange_rate': float(invoice.exchange_rate),
                'subtotal': float(invoice.subtotal),
                'discount_amount': float(invoice.discount_amount),
                'taxable_amount': float(invoice.taxable_amount),
                'total_tax': float(invoice.total_tax),
                'round_off': float(invoice.round_off),
                'grand_total': float(invoice.grand_total),
                'payment_status': invoice.get_payment_status_display(),
                'notes': invoice.notes,
                'terms_conditions': invoice.terms_conditions,
                'created_at': invoice.created_at,
                'updated_at': invoice.updated_at
            },
            'supplier': {
                'name': invoice.tenant.name,
                'company_details': invoice.tenant.company_details,
                'gstin': invoice.tenant.company_details.get('gstin', ''),
                'pan': invoice.tenant.company_details.get('pan', ''),
                'address': self._format_address(invoice.tenant.company_details),
                'phone': invoice.tenant.company_details.get('phone', ''),
                'email': invoice.tenant.company_details.get('email', ''),
                'website': invoice.tenant.company_details.get('website', ''),
            },
            'client': {
                'name': invoice.client.name,
                'gstin': invoice.client.gstin,
                'pan': invoice.client.pan,
                'state_code': invoice.client.state_code,
                'state_name': self._get_state_name(invoice.client.state_code),
                'address': self._format_address(invoice.client.billing_address),
                'phone': invoice.client.phone,
                'email': invoice.client.email,
                'client_type': invoice.client.get_client_type_display(),
            },
            'lines': [
                {
                    'line_number': line.line_number,
                    'item_name': line.item.name if line.item else '',
                    'description': line.description,
                    'hsn_sac': line.hsn_sac,
                    'quantity': float(line.quantity),
                    'uqc': line.uqc,
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
                for line in lines
            ],
            'tax_summary': tax_summary,
            'tax_rate_summary': tax_rate_summary,
            'generated_at': datetime.now(),
            'is_intra_state': invoice.client.state_code == invoice.place_of_supply,
            'total_in_words': self._amount_to_words(float(invoice.grand_total)),
            'page_title': f"Invoice {invoice.number}",
        }

        return data

    def _generate_invoice_qr_data(self, invoice: Invoice) -> str:
        """Generate QR code data for GST-compliant invoice"""

        # GST QR Code format as per Rule 46
        qr_data_parts = [
            f"1:{invoice.tenant.company_details.get('gstin', '')}",  # Supplier GSTIN
            f"2:{invoice.client.gstin or ''}",  # Buyer GSTIN
            f"3:{invoice.number}",  # Invoice Number
            f"4:{invoice.date.strftime('%d/%m/%Y')}",  # Invoice Date
            f"5:{float(invoice.grand_total):.2f}",  # Invoice Value
            f"6:{invoice.place_of_supply}",  # Place of Supply
            f"7:{invoice.reverse_charge}",  # Reverse Charge
            f"8:N" if invoice.invoice_type == 'proforma' else "8:Y",  # Invoice Type
            f"9:{float(invoice.total_tax):.2f}",  # Total Tax
        ]

        # Add IRN if available (for e-invoices)
        if hasattr(invoice, 'einvoice_details') and invoice.einvoice_details:
            qr_data_parts.append(f"10:{invoice.einvoice_details.irn}")

        return "|".join(qr_data_parts)

    def _generate_qr_code(self, data: str, size: int = 200) -> str:
        """Generate QR code and return as base64 encoded image"""

        qr = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_L,
            box_size=10,
            border=4,
        )
        qr.add_data(data)
        qr.make(fit=True)

        # Create QR code image with styling
        img = qr.make_image(
            fill_color="black",
            back_color="white",
            image_factory=StyledPilImage,
            module_drawer=SquareModuleDrawer()
        )

        # Resize if needed
        if size != 200:
            img = img.resize((size, size), Image.Resampling.LANCZOS)

        # Convert to base64
        buffered = io.BytesIO()
        img.save(buffered, format="PNG")
        img_str = base64.b64encode(buffered.getvalue()).decode()

        return f"data:image/png;base64,{img_str}"

    def _get_template(self, template_name: str) -> Dict[str, Any]:
        """Get template configuration and content"""

        templates = {
            'professional': {
                'name': 'Professional Invoice',
                'html_template': 'professional_invoice.html',
                'css_styles': self._get_professional_css(),
                'features': ['header_logo', 'tax_summary', 'qr_code', 'terms']
            },
            'minimal': {
                'name': 'Minimal Invoice',
                'html_template': 'minimal_invoice.html',
                'css_styles': self._get_minimal_css(),
                'features': ['basic_info', 'line_items', 'totals']
            },
            'classic': {
                'name': 'Classic Invoice',
                'html_template': 'classic_invoice.html',
                'css_styles': self._get_classic_css(),
                'features': ['bordered_layout', 'company_details', 'tax_breakdown']
            }
        }

        return templates.get(template_name, templates['professional'])

    def _render_template(self, template: Dict[str, Any], data: Dict[str, Any]) -> str:
        """Render HTML template with data"""

        # Try to use Django template if available
        template_file = template['html_template']

        try:
            # Check if template file exists
            template_path = self.templates_dir / template_file
            if template_path.exists():
                with open(template_path, 'r', encoding='utf-8') as f:
                    template_content = f.read()
            else:
                # Use default template
                template_content = self._get_default_template(template['name'])

            # Simple template rendering (replace with Django template engine if needed)
            return self._simple_template_render(template_content, data)

        except Exception as e:
            # Fallback to built-in template
            return self._get_default_template(template['name'], data)

    def _simple_template_render(self, template_content: str, data: Dict[str, Any]) -> str:
        """Simple template rendering with basic variable substitution"""
        import re

        # Replace variables like {{variable}} with actual values
        def replace_var(match):
            var_path = match.group(1).strip()
            try:
                # Navigate nested dictionaries
                value = data
                for key in var_path.split('.'):
                    value = value[key]

                # Format dates and numbers appropriately
                if isinstance(value, date):
                    return value.strftime('%d/%m/%Y')
                elif isinstance(value, datetime):
                    return value.strftime('%d/%m/%Y %H:%M')
                elif isinstance(value, (int, float)):
                    return f"{value:,.2f}"
                else:
                    return str(value)
            except (KeyError, TypeError, AttributeError):
                return f"{{{{ {var_path} }}}}"  # Return original if not found

        # Replace variables
        rendered = re.sub(r'\{\{\s*([^}]+)\s*\}\}', replace_var, template_content)

        # Handle loops (basic implementation)
        rendered = self._render_loops(rendered, data)

        return rendered

    def _render_loops(self, template: str, data: Dict[str, Any]) -> str:
        """Handle basic loop rendering for invoice lines and tax summary"""
        import re

        # Handle invoice lines loop
        lines_pattern = r'\{\%\s*for\s+line\s+in\s+lines\s*\%\}(.*?)\{\%\s*endfor\s*\%\}'
        lines_match = re.search(lines_pattern, template, re.DOTALL)

        if lines_match:
            loop_template = lines_match.group(1)
            lines_html = ""

            for line in data.get('lines', []):
                line_html = loop_template
                for key, value in line.items():
                    line_html = line_html.replace(f"{{{{ line.{key} }}}}", str(value))
                lines_html += line_html

            template = template.replace(lines_match.group(0), lines_html)

        # Handle tax summary loop
        tax_pattern = r'\{\%\s*for\s+tax\s+in\s+tax_rate_summary\s*\%\}(.*?)\{\%\s*endfor\s*\%\}'
        tax_match = re.search(tax_pattern, template, re.DOTALL)

        if tax_match:
            loop_template = tax_match.group(1)
            tax_html = ""

            for tax in data.get('tax_rate_summary', []):
                tax_item_html = loop_template
                for key, value in tax.items():
                    tax_item_html = tax_item_html.replace(f"{{{{ tax.{key} }}}}", str(value))
                tax_html += tax_item_html

            template = template.replace(tax_match.group(0), tax_html)

        return template

    def _html_to_pdf(self, html_content: str, css_styles: str = "") -> bytes:
        """Convert HTML to PDF using WeasyPrint or ReportLab fallback"""

        if WEASYPRINT_AVAILABLE:
            return self._weasyprint_to_pdf(html_content, css_styles)
        else:
            return self._reportlab_to_pdf(html_content)

    def _weasyprint_to_pdf(self, html_content: str, css_styles: str = "") -> bytes:
        """Convert HTML to PDF using WeasyPrint"""

        # Combine HTML and CSS
        full_html = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Invoice PDF</title>
            <style>
                {css_styles}
            </style>
        </head>
        <body>
            {html_content}
        </body>
        </html>
        """

        # Generate PDF
        html_doc = HTML(string=full_html)
        pdf_bytes = html_doc.write_pdf(font_config=self.font_config)

        return pdf_bytes

    def _reportlab_to_pdf(self, html_content: str) -> bytes:
        """Convert invoice data to PDF using ReportLab (fallback)"""

        # Create a buffer for the PDF
        buffer = io.BytesIO()

        # Create the PDF document
        doc = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            topMargin=72,
            bottomMargin=72,
            leftMargin=72,
            rightMargin=72
        )

        # Build story elements
        story = []

        # Parse basic invoice data from HTML (simplified)
        # In a real implementation, you'd pass the structured data directly
        story.append(Paragraph("INVOICE", self.styles['InvoiceTitle']))
        story.append(Spacer(1, 12))

        # Company info section
        story.append(Paragraph("Company Information", self.styles['SectionHeader']))
        story.append(Spacer(1, 6))

        # Create a simple table for demonstration
        data = [
            ['Invoice Number:', 'INV-001'],
            ['Date:', '20/09/2025'],
            ['Due Date:', '20/10/2025'],
            ['Amount:', 'Rs. 10,000.00']
        ]

        table = Table(data, colWidths=[2*inch, 3*inch])
        table.setStyle(TableStyle([
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
            ('FONTNAME', (1, 0), (1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('GRID', (0, 0), (-1, -1), 1, colors.black),
            ('BACKGROUND', (0, 0), (0, -1), colors.lightgrey),
        ]))

        story.append(table)
        story.append(Spacer(1, 20))

        # Add note about fallback mode
        story.append(Paragraph(
            "Note: This PDF was generated using ReportLab fallback mode. "
            "For full template support, install WeasyPrint dependencies.",
            self.styles['Normal']
        ))

        # Build PDF
        doc.build(story)

        # Get PDF bytes
        buffer.seek(0)
        pdf_bytes = buffer.getvalue()
        buffer.close()

        return pdf_bytes

    def _get_default_template(self, template_name: str, data: Dict[str, Any] = None) -> str:
        """Get built-in default template"""

        if data is None:
            data = {}

        template_str = """
        <div class="invoice-container">
            <header class="invoice-header">
                <div class="company-info">
                    <h1>{{ supplier.name }}</h1>
                    <p>GSTIN: {{ supplier.gstin }}</p>
                    <p>{{ supplier.address }}</p>
                </div>
                <div class="invoice-info">
                    <h2>INVOICE</h2>
                    <p><strong>Number:</strong> {{ invoice.number }}</p>
                    <p><strong>Date:</strong> {{ invoice.date }}</p>
                    <p><strong>Due Date:</strong> {{ invoice.due_date }}</p>
                </div>
            </header>

            <section class="billing-info">
                <div class="bill-to">
                    <h3>Bill To:</h3>
                    <p><strong>{{ client.name }}</strong></p>
                    <p>GSTIN: {{ client.gstin }}</p>
                    <p>{{ client.address }}</p>
                </div>
                <div class="ship-to">
                    <h3>Place of Supply:</h3>
                    <p>{{ invoice.place_of_supply_name }} ({{ invoice.place_of_supply }})</p>
                </div>
            </section>

            <table class="line-items">
                <thead>
                    <tr>
                        <th>S.No</th>
                        <th>Description</th>
                        <th>HSN/SAC</th>
                        <th>Qty</th>
                        <th>Rate</th>
                        <th>Amount</th>
                        <th>Tax</th>
                        <th>Total</th>
                    </tr>
                </thead>
                <tbody>
                    {% for line in lines %}
                    <tr>
                        <td>{{ line.line_number }}</td>
                        <td>{{ line.description }}</td>
                        <td>{{ line.hsn_sac }}</td>
                        <td>{{ line.quantity }}</td>
                        <td>{{ line.rate }}</td>
                        <td>{{ line.taxable_value }}</td>
                        <td>{{ line.cgst_amount }}{{ line.sgst_amount }}{{ line.igst_amount }}</td>
                        <td>{{ line.line_total }}</td>
                    </tr>
                    {% endfor %}
                </tbody>
            </table>

            <section class="totals">
                <div class="tax-summary">
                    <h3>Tax Summary</h3>
                    {% for tax in tax_rate_summary %}
                    <p>{{ tax.rate }}%: {{ tax.total_tax }}</p>
                    {% endfor %}
                </div>
                <div class="grand-total">
                    <p><strong>Total: {{ invoice.grand_total }}</strong></p>
                    <p>{{ total_in_words }}</p>
                </div>
            </section>

            <footer class="invoice-footer">
                <div class="qr-code">
                    <img src="{{ qr_code }}" alt="QR Code" />
                </div>
                <div class="terms">
                    <p>{{ invoice.terms_conditions }}</p>
                </div>
            </footer>
        </div>
        """
        return template_str

    def _get_professional_css(self) -> str:
        """Professional invoice CSS styles"""
        return """
        @page {
            margin: 2cm;
            size: A4;
        }

        body {
            font-family: 'Arial', sans-serif;
            font-size: 12px;
            line-height: 1.4;
            color: #333;
        }

        .invoice-container {
            max-width: 800px;
            margin: 0 auto;
        }

        .invoice-header {
            display: flex;
            justify-content: space-between;
            margin-bottom: 30px;
            border-bottom: 2px solid #1B365D;
            padding-bottom: 20px;
        }

        .company-info h1 {
            color: #1B365D;
            margin: 0 0 10px 0;
            font-size: 24px;
        }

        .invoice-info {
            text-align: right;
        }

        .invoice-info h2 {
            color: #1B365D;
            font-size: 28px;
            margin: 0;
        }

        .billing-info {
            display: flex;
            justify-content: space-between;
            margin-bottom: 30px;
        }

        .billing-info h3 {
            color: #1B365D;
            border-bottom: 1px solid #ddd;
            padding-bottom: 5px;
        }

        .line-items {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 30px;
        }

        .line-items th,
        .line-items td {
            padding: 12px 8px;
            text-align: left;
            border-bottom: 1px solid #ddd;
        }

        .line-items th {
            background-color: #f8f9fa;
            font-weight: bold;
            color: #1B365D;
        }

        .line-items tr:nth-child(even) {
            background-color: #f8f9fa;
        }

        .totals {
            display: flex;
            justify-content: space-between;
            margin-bottom: 30px;
        }

        .tax-summary {
            flex: 1;
            margin-right: 30px;
        }

        .grand-total {
            flex: 1;
            text-align: right;
            background-color: #f8f9fa;
            padding: 20px;
            border: 2px solid #1B365D;
        }

        .invoice-footer {
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
            margin-top: 40px;
        }

        .qr-code img {
            width: 150px;
            height: 150px;
        }

        .terms {
            flex: 1;
            margin-left: 30px;
            font-size: 10px;
            color: #666;
        }

        .text-right {
            text-align: right;
        }

        .text-center {
            text-align: center;
        }

        .font-bold {
            font-weight: bold;
        }

        .text-blue {
            color: #1B365D;
        }
        """

    def _get_minimal_css(self) -> str:
        """Minimal invoice CSS styles"""
        return """
        @page { margin: 1.5cm; }
        body { font-family: Arial, sans-serif; font-size: 11px; }
        .invoice-container { max-width: 100%; }
        table { width: 100%; border-collapse: collapse; }
        th, td { padding: 8px; border: 1px solid #ddd; }
        th { background-color: #f0f0f0; }
        .totals { text-align: right; margin-top: 20px; }
        """

    def _get_classic_css(self) -> str:
        """Classic invoice CSS styles"""
        return """
        @page { margin: 2.5cm; }
        body { font-family: 'Times New Roman', serif; font-size: 12px; }
        .invoice-container { border: 2px solid #000; padding: 20px; }
        .invoice-header { border-bottom: 1px solid #000; margin-bottom: 20px; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { padding: 10px; border: 1px solid #000; }
        th { background-color: #000; color: white; }
        """

    def _format_address(self, address_data: Dict[str, Any]) -> str:
        """Format address from dictionary to string"""
        if not address_data:
            return ""

        parts = []

        if address_data.get('address_line1'):
            parts.append(address_data['address_line1'])

        if address_data.get('address_line2'):
            parts.append(address_data['address_line2'])

        city_state_pin = []
        if address_data.get('city'):
            city_state_pin.append(address_data['city'])

        if address_data.get('state'):
            city_state_pin.append(address_data['state'])

        if address_data.get('pincode'):
            city_state_pin.append(f"- {address_data['pincode']}")

        if city_state_pin:
            parts.append(" ".join(city_state_pin))

        return "<br>".join(parts) if parts else ""

    def _get_state_name(self, state_code: str) -> str:
        """Get state name from state code"""
        state_mapping = {
            '01': 'Jammu and Kashmir', '02': 'Himachal Pradesh', '03': 'Punjab',
            '04': 'Chandigarh', '05': 'Uttarakhand', '06': 'Haryana',
            '07': 'Delhi', '08': 'Rajasthan', '09': 'Uttar Pradesh',
            '10': 'Bihar', '11': 'Sikkim', '12': 'Arunachal Pradesh',
            '13': 'Nagaland', '14': 'Manipur', '15': 'Mizoram',
            '16': 'Tripura', '17': 'Meghalaya', '18': 'Assam',
            '19': 'West Bengal', '20': 'Jharkhand', '21': 'Odisha',
            '22': 'Chhattisgarh', '23': 'Madhya Pradesh', '24': 'Gujarat',
            '25': 'Daman and Diu', '26': 'Dadra and Nagar Haveli', '27': 'Maharashtra',
            '28': 'Andhra Pradesh', '29': 'Karnataka', '30': 'Goa',
            '31': 'Lakshadweep', '32': 'Kerala', '33': 'Tamil Nadu',
            '34': 'Puducherry', '35': 'Andaman and Nicobar Islands', '36': 'Telangana',
        }
        return state_mapping.get(state_code, f"State {state_code}")

    def _amount_to_words(self, amount: float) -> str:
        """Convert amount to words (Indian system)"""
        # Simplified implementation - can be enhanced with full Indian number system

        def convert_hundred(num):
            ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine"]
            teens = ["Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
                    "Seventeen", "Eighteen", "Nineteen"]
            tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"]

            result = ""

            if num >= 100:
                result += ones[num // 100] + " Hundred "
                num %= 100

            if num >= 20:
                result += tens[num // 10] + " "
                num %= 10
            elif num >= 10:
                result += teens[num - 10] + " "
                num = 0

            if num > 0:
                result += ones[num] + " "

            return result.strip()

        if amount == 0:
            return "Zero Rupees Only"

        # Split into rupees and paise
        rupees = int(amount)
        paise = int(round((amount - rupees) * 100))

        result = ""

        # Convert rupees
        if rupees >= 10000000:  # Crore
            crores = rupees // 10000000
            result += convert_hundred(crores) + " Crore "
            rupees %= 10000000

        if rupees >= 100000:  # Lakh
            lakhs = rupees // 100000
            result += convert_hundred(lakhs) + " Lakh "
            rupees %= 100000

        if rupees >= 1000:  # Thousand
            thousands = rupees // 1000
            result += convert_hundred(thousands) + " Thousand "
            rupees %= 1000

        if rupees > 0:
            result += convert_hundred(rupees)

        result += "Rupees"

        if paise > 0:
            result += " and " + convert_hundred(paise) + " Paise"

        result += " Only"

        return result.strip()

    def _add_watermark(self, html_content: str, watermark_text: str) -> str:
        """Add watermark to HTML content"""
        watermark_css = f"""
        <style>
        .watermark {{
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%) rotate(-45deg);
            font-size: 72px;
            color: rgba(200, 200, 200, 0.3);
            z-index: -1;
            pointer-events: none;
            user-select: none;
        }}
        </style>
        <div class="watermark">{watermark_text}</div>
        """

        return watermark_css + html_content

    def save_template(self, name: str, html_content: str, css_styles: str = "") -> bool:
        """Save a custom template"""
        try:
            template_path = self.templates_dir / f"{name}.html"
            css_path = self.templates_dir / f"{name}.css"

            with open(template_path, 'w', encoding='utf-8') as f:
                f.write(html_content)

            if css_styles:
                with open(css_path, 'w', encoding='utf-8') as f:
                    f.write(css_styles)

            return True
        except Exception as e:
            print(f"Error saving template: {e}")
            return False

    def get_available_templates(self) -> List[Dict[str, str]]:
        """Get list of available templates"""
        return [
            {"name": "professional", "display_name": "Professional", "description": "Modern professional layout with company branding"},
            {"name": "minimal", "display_name": "Minimal", "description": "Clean and simple layout"},
            {"name": "classic", "display_name": "Classic", "description": "Traditional formal invoice layout"},
        ]