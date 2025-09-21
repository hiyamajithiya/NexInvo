"""
Dynamic QR Code Generation System for UPI Payments
Implements NPCI UPI QR Code specifications for B2C transactions
"""

import base64
import io
import json
import logging
from typing import Dict, Any, Optional, Union
from decimal import Decimal
from datetime import datetime, timedelta
import hashlib
import hmac

import qrcode
from qrcode.image.styledpil import StyledPilImage
from qrcode.image.styles.moduledrawers import RoundedModuleDrawer
from qrcode.image.styles.colorfills import SolidFillColorMask
from PIL import Image, ImageDraw, ImageFont
from django.conf import settings
from django.utils import timezone

from .models import Invoice, QRCodePayment
from tenants.models import Tenant

logger = logging.getLogger(__name__)


class UPIQRGenerator:
    """
    Generates UPI QR codes compliant with NPCI specifications
    Supports both static and dynamic QR codes for payments
    """

    def __init__(self):
        self.version = "01"
        self.init_method = "11"  # Dynamic QR Code
        self.static_method = "12"  # Static QR Code

    def generate_upi_qr_string(self,
                              merchant_vpa: str,
                              merchant_name: str,
                              transaction_id: str,
                              amount: Decimal,
                              merchant_code: Optional[str] = None,
                              purpose_code: str = "00",
                              note: Optional[str] = None) -> str:
        """
        Generate UPI QR string according to NPCI specification

        Args:
            merchant_vpa: UPI VPA (e.g., merchant@paytm)
            merchant_name: Merchant display name
            transaction_id: Unique transaction reference
            amount: Transaction amount
            merchant_code: Merchant category code
            purpose_code: Transaction purpose code
            note: Additional note/description

        Returns:
            UPI QR string for encoding
        """

        # Build UPI URL
        upi_url = f"upi://pay?pa={merchant_vpa}&pn={merchant_name}"

        if transaction_id:
            upi_url += f"&tr={transaction_id}"

        if amount and amount > 0:
            upi_url += f"&am={amount}"

        if merchant_code:
            upi_url += f"&mc={merchant_code}"

        if purpose_code:
            upi_url += f"&purpose={purpose_code}"

        if note:
            upi_url += f"&tn={note}"

        # Add currency (INR)
        upi_url += "&cu=INR"

        return upi_url

    def generate_qr_code_image(self,
                              upi_string: str,
                              size: int = 300,
                              border: int = 4,
                              error_correction: str = 'M',
                              style: str = 'basic') -> bytes:
        """
        Generate QR code image from UPI string

        Args:
            upi_string: UPI payment string
            size: QR code size in pixels
            border: Border size
            error_correction: Error correction level (L, M, Q, H)
            style: QR code style (basic, rounded, styled)

        Returns:
            QR code image as bytes
        """

        # Error correction mapping
        error_levels = {
            'L': qrcode.constants.ERROR_CORRECT_L,
            'M': qrcode.constants.ERROR_CORRECT_M,
            'Q': qrcode.constants.ERROR_CORRECT_Q,
            'H': qrcode.constants.ERROR_CORRECT_H
        }

        # Create QR code instance
        qr = qrcode.QRCode(
            version=1,
            error_correction=error_levels.get(error_correction, qrcode.constants.ERROR_CORRECT_M),
            box_size=10,
            border=border,
        )

        qr.add_data(upi_string)
        qr.make(fit=True)

        # Generate image based on style
        if style == 'rounded':
            img = qr.make_image(
                image_factory=StyledPilImage,
                module_drawer=RoundedModuleDrawer(),
                fill_color="black",
                back_color="white"
            )
        elif style == 'styled':
            img = qr.make_image(
                image_factory=StyledPilImage,
                module_drawer=RoundedModuleDrawer(),
                color_mask=SolidFillColorMask(back_color=(255, 255, 255), front_color=(0, 0, 0))
            )
        else:
            img = qr.make_image(fill_color="black", back_color="white")

        # Resize if needed
        if size != img.size[0]:
            img = img.resize((size, size), Image.LANCZOS)

        # Convert to bytes
        img_bytes = io.BytesIO()
        img.save(img_bytes, format='PNG', optimize=True)
        return img_bytes.getvalue()

    def generate_branded_qr(self,
                           upi_string: str,
                           merchant_name: str,
                           amount: Decimal,
                           logo_path: Optional[str] = None,
                           size: int = 400) -> bytes:
        """
        Generate branded QR code with merchant info and styling

        Args:
            upi_string: UPI payment string
            merchant_name: Merchant name for display
            amount: Payment amount
            logo_path: Path to merchant logo
            size: Final image size

        Returns:
            Branded QR code image as bytes
        """

        # Generate base QR code
        qr_img_bytes = self.generate_qr_code_image(
            upi_string,
            size=int(size * 0.7),  # QR takes 70% of space
            style='rounded'
        )

        # Create branded image
        final_img = Image.new('RGB', (size, size), 'white')
        draw = ImageDraw.Draw(final_img)

        # Load QR code
        qr_img = Image.open(io.BytesIO(qr_img_bytes))

        # Calculate positions
        qr_size = qr_img.size[0]
        qr_x = (size - qr_size) // 2
        qr_y = int(size * 0.1)  # 10% from top

        # Paste QR code
        final_img.paste(qr_img, (qr_x, qr_y))

        try:
            # Try to load a font
            font_large = ImageFont.truetype("arial.ttf", 24)
            font_medium = ImageFont.truetype("arial.ttf", 18)
            font_small = ImageFont.truetype("arial.ttf", 14)
        except:
            # Fallback to default font
            font_large = ImageFont.load_default()
            font_medium = ImageFont.load_default()
            font_small = ImageFont.load_default()

        # Add merchant name
        text_y = qr_y + qr_size + 20
        text_bbox = draw.textbbox((0, 0), merchant_name, font=font_large)
        text_width = text_bbox[2] - text_bbox[0]
        text_x = (size - text_width) // 2
        draw.text((text_x, text_y), merchant_name, fill='black', font=font_large)

        # Add amount
        amount_text = f"₹{amount:,.2f}"
        text_y += 35
        text_bbox = draw.textbbox((0, 0), amount_text, font=font_medium)
        text_width = text_bbox[2] - text_bbox[0]
        text_x = (size - text_width) // 2
        draw.text((text_x, text_y), amount_text, fill='#2563eb', font=font_medium)

        # Add scan instruction
        instruction = "Scan to Pay with any UPI app"
        text_y += 40
        text_bbox = draw.textbbox((0, 0), instruction, font=font_small)
        text_width = text_bbox[2] - text_bbox[0]
        text_x = (size - text_width) // 2
        draw.text((text_x, text_y), instruction, fill='#6b7280', font=font_small)

        # Add logo if provided
        if logo_path:
            try:
                logo = Image.open(logo_path)
                logo_size = 60
                logo = logo.resize((logo_size, logo_size), Image.LANCZOS)

                # Create circular mask
                mask = Image.new('L', (logo_size, logo_size), 0)
                draw_mask = ImageDraw.Draw(mask)
                draw_mask.ellipse((0, 0, logo_size, logo_size), fill=255)

                # Apply mask and paste logo
                logo.putalpha(mask)
                logo_x = (size - logo_size) // 2
                logo_y = qr_y + (qr_size - logo_size) // 2
                final_img.paste(logo, (logo_x, logo_y), logo)
            except Exception as e:
                logger.warning(f"Failed to add logo: {str(e)}")

        # Convert to bytes
        img_bytes = io.BytesIO()
        final_img.save(img_bytes, format='PNG', optimize=True, quality=95)
        return img_bytes.getvalue()


class DynamicQRService:
    """
    Service for managing dynamic QR codes for invoice payments
    """

    def __init__(self):
        self.qr_generator = UPIQRGenerator()

    def create_payment_qr(self, invoice: Invoice,
                         payment_method: str = 'upi',
                         expiry_hours: int = 24,
                         custom_amount: Optional[Decimal] = None) -> Dict[str, Any]:
        """
        Create dynamic QR code for invoice payment

        Args:
            invoice: Invoice instance
            payment_method: Payment method (upi, card, netbanking)
            expiry_hours: QR code expiry in hours
            custom_amount: Custom amount (if different from invoice total)

        Returns:
            QR code details including image data and metadata
        """

        try:
            # Validate invoice
            if invoice.status == 'paid':
                raise ValueError("Invoice is already paid")

            if invoice.status == 'cancelled':
                raise ValueError("Cannot create QR for cancelled invoice")

            # Get payment configuration
            payment_config = self._get_payment_config(invoice.tenant, payment_method)
            if not payment_config:
                raise ValueError(f"Payment method {payment_method} not configured")

            # Calculate amount
            amount = custom_amount or invoice.grand_total

            # Generate transaction reference
            transaction_ref = self._generate_transaction_ref(invoice)

            # Create QR payment record
            qr_payment = QRCodePayment.objects.create(
                invoice=invoice,
                tenant=invoice.tenant,
                payment_method=payment_method,
                amount=amount,
                transaction_reference=transaction_ref,
                expiry_time=timezone.now() + timedelta(hours=expiry_hours),
                qr_status='active'
            )

            # Generate QR based on payment method
            if payment_method == 'upi':
                qr_result = self._generate_upi_qr(invoice, qr_payment, payment_config)
            else:
                raise ValueError(f"Payment method {payment_method} not yet supported")

            # Update QR payment record
            qr_payment.qr_code_data = qr_result['qr_string']
            qr_payment.qr_image_data = base64.b64encode(qr_result['qr_image']).decode()
            qr_payment.metadata = {
                'merchant_vpa': payment_config.get('merchant_vpa'),
                'merchant_name': payment_config.get('merchant_name'),
                'generated_at': timezone.now().isoformat(),
                'expiry_time': qr_payment.expiry_time.isoformat()
            }
            qr_payment.save()

            return {
                'success': True,
                'qr_payment_id': str(qr_payment.id),
                'transaction_reference': transaction_ref,
                'qr_string': qr_result['qr_string'],
                'qr_image_base64': qr_payment.qr_image_data,
                'amount': float(amount),
                'expiry_time': qr_payment.expiry_time.isoformat(),
                'payment_url': qr_result.get('payment_url'),
                'status': 'active'
            }

        except Exception as e:
            logger.error(f"QR code generation failed for invoice {invoice.number}: {str(e)}")
            return {
                'success': False,
                'error': str(e),
                'error_message': f"QR code generation failed: {str(e)}"
            }

    def _generate_upi_qr(self, invoice: Invoice,
                        qr_payment: QRCodePayment,
                        payment_config: Dict[str, Any]) -> Dict[str, Any]:
        """Generate UPI QR code"""

        # Get UPI configuration
        merchant_vpa = payment_config.get('merchant_vpa')
        merchant_name = payment_config.get('merchant_name', invoice.tenant.name)

        if not merchant_vpa:
            raise ValueError("Merchant UPI VPA not configured")

        # Generate UPI string
        upi_string = self.qr_generator.generate_upi_qr_string(
            merchant_vpa=merchant_vpa,
            merchant_name=merchant_name,
            transaction_id=qr_payment.transaction_reference,
            amount=qr_payment.amount,
            merchant_code=payment_config.get('merchant_code'),
            note=f"Payment for Invoice {invoice.number}"
        )

        # Generate QR image
        qr_image = self.qr_generator.generate_branded_qr(
            upi_string=upi_string,
            merchant_name=merchant_name,
            amount=qr_payment.amount,
            size=400
        )

        return {
            'qr_string': upi_string,
            'qr_image': qr_image,
            'payment_url': upi_string  # For mobile deep links
        }

    def _get_payment_config(self, tenant: Tenant, payment_method: str) -> Optional[Dict[str, Any]]:
        """Get payment configuration for tenant"""

        payment_settings = tenant.company_details.get('payment_settings', {})
        return payment_settings.get(payment_method, {})

    def _generate_transaction_ref(self, invoice: Invoice) -> str:
        """Generate unique transaction reference"""

        timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
        invoice_hash = hashlib.md5(f"{invoice.id}-{invoice.number}".encode()).hexdigest()[:8]
        return f"NX{timestamp}{invoice_hash}".upper()

    def check_payment_status(self, qr_payment_id: str) -> Dict[str, Any]:
        """Check payment status for QR code"""

        try:
            qr_payment = QRCodePayment.objects.get(id=qr_payment_id)

            # Check if expired
            if timezone.now() > qr_payment.expiry_time:
                qr_payment.qr_status = 'expired'
                qr_payment.save()

            return {
                'success': True,
                'payment_id': str(qr_payment.id),
                'transaction_reference': qr_payment.transaction_reference,
                'status': qr_payment.qr_status,
                'amount': float(qr_payment.amount),
                'payment_method': qr_payment.payment_method,
                'expiry_time': qr_payment.expiry_time.isoformat(),
                'metadata': qr_payment.metadata
            }

        except QRCodePayment.DoesNotExist:
            return {
                'success': False,
                'error': 'QR payment not found'
            }

    def expire_qr_code(self, qr_payment_id: str) -> Dict[str, Any]:
        """Manually expire QR code"""

        try:
            qr_payment = QRCodePayment.objects.get(id=qr_payment_id)
            qr_payment.qr_status = 'expired'
            qr_payment.save()

            return {
                'success': True,
                'message': 'QR code expired successfully'
            }

        except QRCodePayment.DoesNotExist:
            return {
                'success': False,
                'error': 'QR payment not found'
            }

    def regenerate_qr_code(self, invoice: Invoice,
                          old_qr_payment_id: str,
                          expiry_hours: int = 24) -> Dict[str, Any]:
        """Regenerate QR code (expire old and create new)"""

        try:
            # Expire old QR code
            old_qr = QRCodePayment.objects.get(id=old_qr_payment_id)
            old_qr.qr_status = 'replaced'
            old_qr.save()

            # Create new QR code
            return self.create_payment_qr(
                invoice=invoice,
                payment_method=old_qr.payment_method,
                expiry_hours=expiry_hours
            )

        except QRCodePayment.DoesNotExist:
            return {
                'success': False,
                'error': 'Original QR payment not found'
            }