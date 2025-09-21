"""
QR Code Placement and Embedding System for NexInvo
Handles automatic placement of QR codes in invoices and documents
"""

import base64
import io
import logging
from typing import Dict, Any, Optional, Tuple, List
from decimal import Decimal
from datetime import datetime
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont
from django.conf import settings
from django.template.loader import render_to_string
from django.utils import timezone

from .models import Invoice, QRCodePayment
from .qr_code_system import DynamicQRService
from .pdf_generator import InvoicePDFGenerator

logger = logging.getLogger(__name__)


class QRPlacementConfig:
    """Configuration for QR code placement in different document types"""

    PLACEMENT_POSITIONS = {
        'top_right': {'x': 0.75, 'y': 0.1},
        'top_left': {'x': 0.1, 'y': 0.1},
        'bottom_right': {'x': 0.75, 'y': 0.85},
        'bottom_left': {'x': 0.1, 'y': 0.85},
        'footer_center': {'x': 0.5, 'y': 0.9},
        'payment_section': {'x': 0.8, 'y': 0.7},
        'sidebar': {'x': 0.85, 'y': 0.5}
    }

    DOCUMENT_TEMPLATES = {
        'standard_invoice': {
            'qr_position': 'payment_section',
            'qr_size': (120, 120),
            'show_instructions': True,
            'background_color': 'white',
            'border': True
        },
        'minimal_invoice': {
            'qr_position': 'footer_center',
            'qr_size': (100, 100),
            'show_instructions': False,
            'background_color': 'transparent',
            'border': False
        },
        'professional_invoice': {
            'qr_position': 'sidebar',
            'qr_size': (140, 140),
            'show_instructions': True,
            'background_color': '#f8f9fa',
            'border': True
        },
        'compact_invoice': {
            'qr_position': 'bottom_right',
            'qr_size': (80, 80),
            'show_instructions': False,
            'background_color': 'white',
            'border': False
        }
    }


class QRPlacementEngine:
    """
    Engine for placing QR codes in invoices with various positioning strategies
    """

    def __init__(self):
        self.qr_service = DynamicQRService()
        self.config = QRPlacementConfig()

    def embed_qr_in_invoice_html(self, invoice: Invoice,
                                template_name: str = 'standard_invoice',
                                payment_method: str = 'upi',
                                custom_position: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Embed QR code in invoice HTML template

        Args:
            invoice: Invoice instance
            template_name: Template configuration to use
            payment_method: Payment method for QR code
            custom_position: Custom positioning override

        Returns:
            Result with embedded HTML and QR data
        """

        try:
            # Generate QR code for payment
            qr_result = self.qr_service.create_payment_qr(
                invoice=invoice,
                payment_method=payment_method,
                expiry_hours=24
            )

            if not qr_result['success']:
                return qr_result

            # Get template configuration
            template_config = self.config.DOCUMENT_TEMPLATES.get(
                template_name,
                self.config.DOCUMENT_TEMPLATES['standard_invoice']
            )

            # Override with custom position if provided
            if custom_position:
                template_config.update(custom_position)

            # Prepare QR code data for HTML embedding
            qr_data = {
                'qr_image_base64': qr_result['qr_image_base64'],
                'payment_amount': float(qr_result['amount']),
                'transaction_reference': qr_result['transaction_reference'],
                'expiry_time': qr_result['expiry_time'],
                'payment_url': qr_result.get('payment_url', ''),
                'config': template_config
            }

            # Generate enhanced invoice context
            invoice_context = self._prepare_invoice_context(invoice, qr_data)

            # Render HTML with embedded QR code
            html_content = render_to_string(
                'invoices/invoice_with_qr.html',
                invoice_context
            )

            return {
                'success': True,
                'html_content': html_content,
                'qr_payment_id': qr_result['qr_payment_id'],
                'qr_data': qr_data,
                'template_config': template_config
            }

        except Exception as e:
            logger.error(f"QR embedding failed for invoice {invoice.number}: {str(e)}")
            return {
                'success': False,
                'error': str(e),
                'error_message': f"QR embedding failed: {str(e)}"
            }

    def embed_qr_in_pdf(self, invoice: Invoice,
                       existing_pdf_path: Optional[str] = None,
                       template_name: str = 'standard_invoice',
                       payment_method: str = 'upi') -> Dict[str, Any]:
        """
        Embed QR code in PDF invoice

        Args:
            invoice: Invoice instance
            existing_pdf_path: Path to existing PDF to modify
            template_name: Template configuration
            payment_method: Payment method for QR code

        Returns:
            Result with PDF path and QR data
        """

        try:
            # Generate QR code
            qr_result = self.qr_service.create_payment_qr(
                invoice=invoice,
                payment_method=payment_method,
                expiry_hours=24
            )

            if not qr_result['success']:
                return qr_result

            # Get template configuration
            template_config = self.config.DOCUMENT_TEMPLATES.get(
                template_name,
                self.config.DOCUMENT_TEMPLATES['standard_invoice']
            )

            if existing_pdf_path:
                # Modify existing PDF
                result = self._modify_existing_pdf(
                    existing_pdf_path,
                    qr_result,
                    template_config
                )
            else:
                # Generate new PDF with QR code
                result = self._generate_pdf_with_qr(
                    invoice,
                    qr_result,
                    template_config
                )

            if result['success']:
                result.update({
                    'qr_payment_id': qr_result['qr_payment_id'],
                    'transaction_reference': qr_result['transaction_reference']
                })

            return result

        except Exception as e:
            logger.error(f"PDF QR embedding failed for invoice {invoice.number}: {str(e)}")
            return {
                'success': False,
                'error': str(e),
                'error_message': f"PDF QR embedding failed: {str(e)}"
            }

    def create_qr_overlay(self, qr_image_base64: str,
                         position: str,
                         size: Tuple[int, int],
                         canvas_size: Tuple[int, int],
                         show_instructions: bool = True,
                         background_color: str = 'white',
                         border: bool = True) -> bytes:
        """
        Create QR code overlay for documents

        Args:
            qr_image_base64: Base64 encoded QR image
            position: Position identifier
            size: QR code size (width, height)
            canvas_size: Canvas size (width, height)
            show_instructions: Whether to show payment instructions
            background_color: Background color
            border: Whether to add border

        Returns:
            QR overlay image as bytes
        """

        try:
            # Decode QR image
            qr_image_data = base64.b64decode(qr_image_base64)
            qr_image = Image.open(io.BytesIO(qr_image_data))

            # Resize QR code
            qr_image = qr_image.resize(size, Image.LANCZOS)

            # Calculate overlay size (QR + padding + instructions)
            overlay_width = size[0] + 40  # 20px padding on each side
            overlay_height = size[1] + (80 if show_instructions else 40)

            # Create overlay canvas
            if background_color == 'transparent':
                overlay = Image.new('RGBA', (overlay_width, overlay_height), (255, 255, 255, 0))
            else:
                bg_color = self._parse_color(background_color)
                overlay = Image.new('RGB', (overlay_width, overlay_height), bg_color)

            draw = ImageDraw.Draw(overlay)

            # Add border if enabled
            if border:
                border_color = (200, 200, 200)
                draw.rectangle(
                    [(0, 0), (overlay_width - 1, overlay_height - 1)],
                    outline=border_color,
                    width=1
                )

            # Paste QR code
            qr_x = (overlay_width - size[0]) // 2
            qr_y = 20
            overlay.paste(qr_image, (qr_x, qr_y))

            # Add instructions if enabled
            if show_instructions:
                try:
                    font = ImageFont.truetype("arial.ttf", 12)
                except:
                    font = ImageFont.load_default()

                instruction_text = "Scan to Pay"
                text_bbox = draw.textbbox((0, 0), instruction_text, font=font)
                text_width = text_bbox[2] - text_bbox[0]
                text_x = (overlay_width - text_width) // 2
                text_y = qr_y + size[1] + 10

                draw.text((text_x, text_y), instruction_text, fill='black', font=font)

            # Convert to bytes
            overlay_bytes = io.BytesIO()
            if background_color == 'transparent':
                overlay.save(overlay_bytes, format='PNG')
            else:
                overlay.save(overlay_bytes, format='PNG', optimize=True)

            return overlay_bytes.getvalue()

        except Exception as e:
            logger.error(f"QR overlay creation failed: {str(e)}")
            raise

    def get_optimal_placement(self, document_type: str,
                            content_analysis: Dict[str, Any]) -> Dict[str, Any]:
        """
        Analyze document and suggest optimal QR placement

        Args:
            document_type: Type of document (invoice, receipt, etc.)
            content_analysis: Analysis of document content and layout

        Returns:
            Optimal placement configuration
        """

        # Default configurations by document type
        defaults = {
            'invoice': 'payment_section',
            'receipt': 'bottom_right',
            'quotation': 'footer_center',
            'delivery_note': 'top_right'
        }

        base_position = defaults.get(document_type, 'payment_section')

        # Analyze content to refine placement
        if content_analysis.get('has_payment_section'):
            position = 'payment_section'
        elif content_analysis.get('has_footer_space'):
            position = 'footer_center'
        elif content_analysis.get('has_sidebar'):
            position = 'sidebar'
        else:
            position = base_position

        # Determine size based on available space
        available_space = content_analysis.get('available_space', {'width': 150, 'height': 150})
        qr_size = self._calculate_qr_size(available_space)

        return {
            'position': position,
            'coordinates': self.config.PLACEMENT_POSITIONS[position],
            'size': qr_size,
            'show_instructions': content_analysis.get('show_instructions', True),
            'background_color': 'white',
            'border': True
        }

    def _prepare_invoice_context(self, invoice: Invoice, qr_data: Dict[str, Any]) -> Dict[str, Any]:
        """Prepare comprehensive invoice context with QR data"""

        return {
            'invoice': invoice,
            'tenant': invoice.tenant,
            'client': invoice.client,
            'invoice_lines': invoice.lines.all(),
            'qr_data': qr_data,
            'generation_date': timezone.now(),
            'company_details': invoice.tenant.company_details,
            'payment_instructions': self._get_payment_instructions(invoice, qr_data)
        }

    def _get_payment_instructions(self, invoice: Invoice, qr_data: Dict[str, Any]) -> List[str]:
        """Generate payment instructions based on QR code type"""

        instructions = [
            "Scan the QR code with any UPI app to pay instantly",
            f"Payment Amount: ₹{qr_data['payment_amount']:,.2f}",
            f"Reference: {qr_data['transaction_reference']}"
        ]

        # Add expiry information
        try:
            expiry_dt = datetime.fromisoformat(qr_data['expiry_time'].replace('Z', '+00:00'))
            instructions.append(f"Valid until: {expiry_dt.strftime('%d %b %Y, %I:%M %p')}")
        except:
            pass

        return instructions

    def _modify_existing_pdf(self, pdf_path: str,
                           qr_result: Dict[str, Any],
                           template_config: Dict[str, Any]) -> Dict[str, Any]:
        """Modify existing PDF to add QR code"""

        try:
            # This would require PyPDF2 or similar library
            # For now, return a placeholder implementation
            return {
                'success': False,
                'error': 'PDF modification not yet implemented',
                'message': 'Use HTML to PDF generation instead'
            }

        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }

    def _generate_pdf_with_qr(self, invoice: Invoice,
                            qr_result: Dict[str, Any],
                            template_config: Dict[str, Any]) -> Dict[str, Any]:
        """Generate new PDF with embedded QR code"""

        try:
            # Prepare QR data for PDF
            qr_data = {
                'qr_image_base64': qr_result['qr_image_base64'],
                'payment_amount': float(qr_result['amount']),
                'transaction_reference': qr_result['transaction_reference'],
                'config': template_config
            }

            # Generate PDF with QR code
            pdf_generator = InvoicePDFGenerator()
            pdf_result = pdf_generator.generate_invoice_pdf_with_qr(invoice, qr_data)

            return pdf_result

        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }

    def _parse_color(self, color_str: str) -> Tuple[int, int, int]:
        """Parse color string to RGB tuple"""

        color_map = {
            'white': (255, 255, 255),
            'black': (0, 0, 0),
            'gray': (128, 128, 128),
            'light_gray': (211, 211, 211),
            'blue': (0, 123, 255)
        }

        if color_str in color_map:
            return color_map[color_str]

        # Parse hex color
        if color_str.startswith('#'):
            hex_color = color_str[1:]
            if len(hex_color) == 6:
                return tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4))

        # Default to white
        return (255, 255, 255)

    def _calculate_qr_size(self, available_space: Dict[str, int]) -> Tuple[int, int]:
        """Calculate optimal QR code size based on available space"""

        max_width = min(available_space.get('width', 150), 200)
        max_height = min(available_space.get('height', 150), 200)

        # QR codes are square, use the smaller dimension
        size = min(max_width, max_height)

        # Ensure minimum readable size
        size = max(size, 80)

        return (size, size)


class QRTemplateManager:
    """
    Manager for QR code templates and styling
    """

    def __init__(self):
        self.placement_engine = QRPlacementEngine()

    def create_template(self, name: str,
                       position: str,
                       size: Tuple[int, int],
                       styling: Dict[str, Any]) -> Dict[str, Any]:
        """Create custom QR template"""

        template = {
            'name': name,
            'qr_position': position,
            'qr_size': size,
            'show_instructions': styling.get('show_instructions', True),
            'background_color': styling.get('background_color', 'white'),
            'border': styling.get('border', True),
            'custom_css': styling.get('custom_css', ''),
            'created_at': timezone.now().isoformat()
        }

        return {
            'success': True,
            'template': template,
            'template_id': f"custom_{name.lower().replace(' ', '_')}"
        }

    def get_template_preview(self, template_config: Dict[str, Any]) -> Dict[str, Any]:
        """Generate preview of QR template"""

        try:
            # Create sample QR code for preview
            sample_qr_base64 = "iVBORw0KGgoAAAANSUhEUgAAAMgAAADI..." # Sample QR image data

            # Create overlay with template config
            overlay_image = self.placement_engine.create_qr_overlay(
                qr_image_base64=sample_qr_base64,
                position=template_config.get('qr_position', 'payment_section'),
                size=template_config.get('qr_size', (120, 120)),
                canvas_size=(400, 600),
                show_instructions=template_config.get('show_instructions', True),
                background_color=template_config.get('background_color', 'white'),
                border=template_config.get('border', True)
            )

            preview_base64 = base64.b64encode(overlay_image).decode()

            return {
                'success': True,
                'preview_image': preview_base64,
                'template_config': template_config
            }

        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }