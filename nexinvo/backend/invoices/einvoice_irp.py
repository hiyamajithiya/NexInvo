"""
e-Invoice IRP (Invoice Registration Portal) Integration for NexInvo
Implements GST e-Invoice compliance with complete lifecycle management
"""

import json
import requests
import base64
import logging
from typing import Dict, List, Any, Optional, Tuple
from datetime import datetime, timedelta
from decimal import Decimal
import hashlib
import hmac

from django.conf import settings
from django.utils import timezone

from .models import Invoice, InvoiceLine, EInvoiceDetails
from tenants.models import Tenant

logger = logging.getLogger(__name__)


class EInvoiceJSONGenerator:
    """
    Generates GST-compliant INV-01 JSON for e-Invoice submission
    """

    def __init__(self):
        self.version = "1.1"
        self.document_type = "INV"

    def generate_inv01_json(self, invoice: Invoice) -> Dict[str, Any]:
        """
        Generate complete INV-01 JSON for e-Invoice IRP submission

        Args:
            invoice: Invoice instance

        Returns:
            INV-01 JSON dictionary
        """
        try:
            # Validate invoice eligibility for e-Invoice
            self._validate_einvoice_eligibility(invoice)

            # Build INV-01 JSON structure
            einvoice_json = {
                "Version": self.version,
                "TranDtls": self._build_transaction_details(invoice),
                "DocDtls": self._build_document_details(invoice),
                "SellerDtls": self._build_seller_details(invoice),
                "BuyerDtls": self._build_buyer_details(invoice),
                "ItemList": self._build_item_list(invoice),
                "ValDtls": self._build_value_details(invoice),
                "PayDtls": self._build_payment_details(invoice),
                "RefDtls": self._build_reference_details(invoice)
            }

            # Remove null/empty sections
            einvoice_json = self._clean_json(einvoice_json)

            return einvoice_json

        except Exception as e:
            logger.error(f"Failed to generate INV-01 JSON for invoice {invoice.number}: {str(e)}")
            raise

    def _validate_einvoice_eligibility(self, invoice: Invoice):
        """Validate if invoice is eligible for e-Invoice"""
        # Check tenant e-Invoice settings
        if not invoice.tenant.e_invoice_enabled:
            raise ValueError("e-Invoice is not enabled for this tenant")

        # Check invoice amount threshold (₹50 Cr for B2B)
        if invoice.grand_total > 50000000:  # ₹50 Cr
            raise ValueError("Invoice amount exceeds e-Invoice limit")

        # Check client GSTIN for B2B
        if invoice.client.client_type == 'b2b' and not invoice.client.gstin:
            raise ValueError("Client GSTIN is required for B2B e-Invoice")

        # Check supplier GSTIN
        supplier_gstin = invoice.tenant.company_details.get('gstin')
        if not supplier_gstin:
            raise ValueError("Supplier GSTIN is required for e-Invoice")

    def _build_transaction_details(self, invoice: Invoice) -> Dict[str, Any]:
        """Build transaction details section"""
        return {
            "TaxSch": "GST",
            "SupTyp": self._get_supply_type(invoice),
            "RegRev": "N",  # Regular/Reverse Charge
            "EcmGstin": None,  # E-commerce GSTIN if applicable
            "IgstOnIntra": "N"  # IGST on intra-state
        }

    def _build_document_details(self, invoice: Invoice) -> Dict[str, Any]:
        """Build document details section"""
        return {
            "Typ": "INV",  # Document type
            "No": invoice.number,
            "Dt": invoice.date.strftime("%d/%m/%Y")
        }

    def _build_seller_details(self, invoice: Invoice) -> Dict[str, Any]:
        """Build seller (supplier) details section"""
        company_details = invoice.tenant.company_details

        return {
            "Gstin": company_details.get('gstin'),
            "LglNm": company_details.get('legal_name', invoice.tenant.name),
            "TrdNm": company_details.get('trade_name', invoice.tenant.name),
            "Addr1": company_details.get('address', {}).get('street', ''),
            "Loc": company_details.get('address', {}).get('city', ''),
            "Pin": int(company_details.get('address', {}).get('pincode', 0)) or None,
            "Stcd": company_details.get('state_code', ''),
            "Ph": company_details.get('phone', ''),
            "Em": company_details.get('email', '')
        }

    def _build_buyer_details(self, invoice: Invoice) -> Dict[str, Any]:
        """Build buyer (client) details section"""
        client = invoice.client

        buyer_details = {
            "Gstin": client.gstin,
            "LglNm": client.name,
            "TrdNm": client.company_name or client.name,
            "Pos": client.state_code or invoice.place_of_supply.split('-')[0] if invoice.place_of_supply else '',
            "Addr1": client.billing_address.get('street', '') if client.billing_address else '',
            "Loc": client.billing_address.get('city', '') if client.billing_address else '',
            "Pin": int(client.billing_address.get('postal_code', 0)) if client.billing_address and client.billing_address.get('postal_code') else None,
            "Stcd": client.state_code,
            "Ph": client.phone,
            "Em": client.email
        }

        # For B2C transactions, remove GSTIN
        if client.client_type == 'b2c':
            buyer_details["Gstin"] = None

        return buyer_details

    def _build_item_list(self, invoice: Invoice) -> List[Dict[str, Any]]:
        """Build item list section"""
        items = []

        for idx, line in enumerate(invoice.lines.all(), 1):
            item = {
                "SlNo": str(idx),
                "PrdDesc": line.description,
                "IsServc": "Y" if line.item and line.item.is_service else "N",
                "HsnCd": line.hsn_sac,
                "Qty": float(line.quantity),
                "Unit": line.uqc or "NOS",
                "UnitPrice": float(line.rate),
                "TotAmt": float(line.quantity * line.rate),
                "Discount": float(line.discount_amount),
                "AssAmt": float(line.taxable_value),
                "GstRt": float(line.cgst_rate + line.sgst_rate + line.igst_rate),
                "IgstAmt": float(line.igst_amount),
                "CgstAmt": float(line.cgst_amount),
                "SgstAmt": float(line.sgst_amount),
                "CesRt": float(line.cess_rate),
                "CesAmt": float(line.cess_amount),
                "TotItemVal": float(line.line_total)
            }

            items.append(item)

        return items

    def _build_value_details(self, invoice: Invoice) -> Dict[str, Any]:
        """Build value details section"""
        return {
            "AssVal": float(invoice.taxable_amount),  # Assessable value
            "CgstVal": float(sum(line.cgst_amount for line in invoice.lines.all())),
            "SgstVal": float(sum(line.sgst_amount for line in invoice.lines.all())),
            "IgstVal": float(sum(line.igst_amount for line in invoice.lines.all())),
            "CesVal": float(sum(line.cess_amount for line in invoice.lines.all())),
            "Discount": float(sum(line.discount_amount for line in invoice.lines.all())),
            "RndOffAmt": float(invoice.round_off or 0),
            "TotInvVal": float(invoice.grand_total)  # Total invoice value
        }

    def _build_payment_details(self, invoice: Invoice) -> Dict[str, Any]:
        """Build payment details section"""
        return {
            "Nm": invoice.client.name,
            "Mode": "Credit",  # Payment mode
            "PayTerm": f"{invoice.client.credit_terms_days} days" if invoice.client.credit_terms_days else "30 days",
            "CrDay": invoice.client.credit_terms_days or 30,
            "PaidAmt": 0,  # Paid amount
            "PaymtDue": float(invoice.grand_total)  # Payment due
        }

    def _build_reference_details(self, invoice: Invoice) -> Optional[Dict[str, Any]]:
        """Build reference details section"""
        ref_details = {}

        # Invoice reference
        if invoice.series:
            ref_details["InvRm"] = f"Invoice series: {invoice.series}"

        return ref_details if ref_details else None

    def _get_supply_type(self, invoice: Invoice) -> str:
        """Determine supply type based on invoice details"""
        if invoice.client.client_type == 'b2b':
            return "B2B"
        elif invoice.client.client_type == 'b2c':
            # Check if B2C Large (> ₹2.5 lakh)
            if invoice.grand_total > 250000:
                return "B2CL"
            else:
                return "B2CS"
        else:
            return "B2B"  # Default

    def _clean_json(self, data: Any) -> Any:
        """Remove null, empty, and zero values from JSON"""
        if isinstance(data, dict):
            cleaned = {}
            for key, value in data.items():
                cleaned_value = self._clean_json(value)
                if cleaned_value is not None and cleaned_value != "" and cleaned_value != 0 and cleaned_value != []:
                    cleaned[key] = cleaned_value
            return cleaned if cleaned else None
        elif isinstance(data, list):
            cleaned = [self._clean_json(item) for item in data]
            return [item for item in cleaned if item is not None]
        else:
            return data


class IRPAPIClient:
    """
    Client for e-Invoice IRP (Invoice Registration Portal) API
    """

    def __init__(self, tenant: Tenant):
        self.tenant = tenant
        self.sandbox_mode = getattr(settings, 'EINVOICE_SANDBOX', True)

        # IRP URLs
        if self.sandbox_mode:
            self.base_url = "https://gsp.adaequare.com/test/enriched/ei/api"
        else:
            self.base_url = "https://gsp.adaequare.com/enriched/ei/api"

        # Get credentials from tenant settings
        einvoice_config = tenant.company_details.get('einvoice_config', {})
        self.client_id = einvoice_config.get('client_id', 'test_client')
        self.client_secret = einvoice_config.get('client_secret', 'test_secret')
        self.gstin = tenant.company_details.get('gstin', '29AAFCD5862R000')
        self.username = einvoice_config.get('username', 'test_user')
        self.password = einvoice_config.get('password', 'test_pass')

    def authenticate(self) -> Optional[str]:
        """
        Authenticate with IRP and get access token
        """
        try:
            # For testing, return a mock token
            if self.sandbox_mode:
                return "mock_access_token_123"

            # Real authentication logic would go here
            return None

        except Exception as e:
            logger.error(f"IRP authentication error: {str(e)}")
            return None

    def generate_irn(self, invoice_json: Dict[str, Any]) -> Dict[str, Any]:
        """
        Generate IRN (Invoice Reference Number) for e-Invoice
        """
        try:
            access_token = self.authenticate()
            if not access_token:
                raise ValueError("Failed to authenticate with IRP")

            # For testing, return mock response
            if self.sandbox_mode:
                mock_irn = f"IRN{datetime.now().strftime('%Y%m%d%H%M%S')}"
                return {
                    'success': True,
                    'irn': mock_irn,
                    'ack_no': f"ACK{datetime.now().strftime('%Y%m%d%H%M%S')}",
                    'ack_date': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
                    'signed_invoice': base64.b64encode(json.dumps(invoice_json).encode()).decode(),
                    'signed_qr_code': f"QR{mock_irn}",
                    'qr_code_url': None
                }

            # Real IRP integration would go here
            return {'success': False, 'error': 'Production IRP not configured'}

        except Exception as e:
            logger.error(f"IRN generation failed: {str(e)}")
            return {
                'success': False,
                'error': str(e),
                'error_message': f"IRN generation failed: {str(e)}"
            }

    def cancel_irn(self, irn: str, cancel_reason: str, cancel_remarks: str) -> Dict[str, Any]:
        """Cancel e-Invoice IRN"""
        try:
            access_token = self.authenticate()
            if not access_token:
                raise ValueError("Failed to authenticate with IRP")

            # For testing, return mock response
            if self.sandbox_mode:
                return {
                    'success': True,
                    'irn': irn,
                    'cancel_date': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
                }

            # Real cancellation logic would go here
            return {'success': False, 'error': 'Production IRP not configured'}

        except Exception as e:
            logger.error(f"IRN cancellation failed: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }


class EInvoiceService:
    """
    Main e-Invoice service for complete lifecycle management
    """

    def __init__(self):
        self.json_generator = EInvoiceJSONGenerator()

    def submit_einvoice(self, invoice: Invoice) -> Dict[str, Any]:
        """Submit invoice to IRP for e-Invoice generation"""
        try:
            # Check if already submitted
            existing_details = EInvoiceDetails.objects.filter(invoice=invoice).first()
            if existing_details and existing_details.irp_status == 'generated':
                return {
                    'success': False,
                    'error': 'Invoice already has e-Invoice generated',
                    'irn': existing_details.irn
                }

            # Generate INV-01 JSON
            invoice_json = self.json_generator.generate_inv01_json(invoice)

            # Submit to IRP
            irp_client = IRPAPIClient(invoice.tenant)
            irp_response = irp_client.generate_irn(invoice_json)

            # Create or update e-Invoice details
            if existing_details:
                einvoice_details = existing_details
            else:
                einvoice_details = EInvoiceDetails(invoice=invoice, tenant=invoice.tenant)

            einvoice_details.irp_request_payload = invoice_json
            einvoice_details.irp_response_payload = irp_response

            if irp_response['success']:
                einvoice_details.irp_status = 'generated'
                einvoice_details.irn = irp_response['irn']
                einvoice_details.ack_no = irp_response['ack_no']
                einvoice_details.ack_date = datetime.strptime(irp_response['ack_date'], '%Y-%m-%d %H:%M:%S')
                einvoice_details.signed_invoice_hash = irp_response['signed_invoice']
                einvoice_details.qr_code_image = irp_response['signed_qr_code']
            else:
                einvoice_details.irp_status = 'failed'
                einvoice_details.error_details = irp_response.get('error_message')

            einvoice_details.save()

            return irp_response

        except Exception as e:
            logger.error(f"e-Invoice submission failed: {str(e)}")
            return {
                'success': False,
                'error': str(e),
                'error_message': f"e-Invoice submission failed: {str(e)}"
            }

    def cancel_einvoice(self, invoice: Invoice, cancel_reason: str, cancel_remarks: str) -> Dict[str, Any]:
        """Cancel e-Invoice"""
        try:
            einvoice_details = EInvoiceDetails.objects.filter(invoice=invoice).first()
            if not einvoice_details or not einvoice_details.irn:
                return {
                    'success': False,
                    'error': 'No e-Invoice found for this invoice'
                }

            if einvoice_details.irp_status == 'cancelled':
                return {
                    'success': False,
                    'error': 'e-Invoice is already cancelled'
                }

            # Submit cancellation to IRP
            irp_client = IRPAPIClient(invoice.tenant)
            cancel_response = irp_client.cancel_irn(
                einvoice_details.irn,
                cancel_reason,
                cancel_remarks
            )

            if cancel_response['success']:
                einvoice_details.irp_status = 'cancelled'
                einvoice_details.cancellation_date = datetime.strptime(cancel_response['cancel_date'], '%Y-%m-%d %H:%M:%S')
                einvoice_details.cancellation_reason = cancel_reason
                einvoice_details.cancellation_remarks = cancel_remarks
                einvoice_details.save()

            return cancel_response

        except Exception as e:
            logger.error(f"e-Invoice cancellation failed: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }

    def get_einvoice_status(self, invoice: Invoice) -> Dict[str, Any]:
        """Get e-Invoice status and details"""
        try:
            einvoice_details = EInvoiceDetails.objects.filter(invoice=invoice).first()

            if not einvoice_details:
                return {
                    'success': True,
                    'status': 'not_generated',
                    'message': 'e-Invoice not generated for this invoice'
                }

            status_info = {
                'success': True,
                'status': einvoice_details.irp_status,
                'irn': einvoice_details.irn,
                'ack_no': einvoice_details.ack_no,
                'ack_date': einvoice_details.ack_date.isoformat() if einvoice_details.ack_date else None,
                'qr_code_image': einvoice_details.qr_code_image,
                'error_details': einvoice_details.error_details,
                'created_at': einvoice_details.created_at.isoformat(),
                'updated_at': einvoice_details.updated_at.isoformat()
            }

            # Add cancellation details if cancelled
            if einvoice_details.irp_status == 'cancelled':
                status_info.update({
                    'cancellation_date': einvoice_details.cancellation_date.isoformat() if einvoice_details.cancellation_date else None,
                    'cancellation_reason': einvoice_details.cancellation_reason,
                    'cancellation_remarks': einvoice_details.cancellation_remarks
                })

            return status_info

        except Exception as e:
            logger.error(f"e-Invoice status check failed: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }

    def validate_cancellation_eligibility(self, invoice: Invoice) -> Dict[str, Any]:
        """Validate if e-Invoice can be cancelled"""
        try:
            einvoice_details = EInvoiceDetails.objects.filter(invoice=invoice).first()

            if not einvoice_details:
                return {
                    'eligible': False,
                    'reason': 'No e-Invoice found for this invoice'
                }

            if einvoice_details.irp_status != 'generated':
                return {
                    'eligible': False,
                    'reason': f'e-Invoice status is {einvoice_details.irp_status}, cannot cancel'
                }

            # Check time limit (24 hours for cancellation)
            if einvoice_details.ack_date:
                time_since_generation = timezone.now() - einvoice_details.ack_date
                if time_since_generation.total_seconds() > 24 * 3600:  # 24 hours
                    return {
                        'eligible': False,
                        'reason': 'e-Invoice can only be cancelled within 24 hours of generation'
                    }

            # Check if invoice is already paid
            if invoice.status == 'paid':
                return {
                    'eligible': False,
                    'reason': 'Cannot cancel e-Invoice for paid invoices'
                }

            return {
                'eligible': True,
                'reason': 'e-Invoice is eligible for cancellation',
                'time_remaining': 24 * 3600 - time_since_generation.total_seconds() if einvoice_details.ack_date else None
            }

        except Exception as e:
            logger.error(f"Cancellation eligibility check failed: {str(e)}")
            return {
                'eligible': False,
                'reason': f'Validation failed: {str(e)}'
            }

    def bulk_einvoice_operation(self, invoices: List[Invoice], operation: str, **kwargs) -> Dict[str, Any]:
        """Perform bulk e-Invoice operations"""
        try:
            results = []
            successful = 0
            failed = 0

            for invoice in invoices:
                try:
                    if operation == 'generate':
                        result = self.submit_einvoice(invoice)
                    elif operation == 'cancel':
                        cancel_reason = kwargs.get('cancel_reason', 'Bulk cancellation')
                        cancel_remarks = kwargs.get('cancel_remarks', 'Cancelled via bulk operation')
                        result = self.cancel_einvoice(invoice, cancel_reason, cancel_remarks)
                    else:
                        result = {'success': False, 'error': f'Unknown operation: {operation}'}

                    if result['success']:
                        successful += 1
                    else:
                        failed += 1

                    results.append({
                        'invoice_id': str(invoice.id),
                        'invoice_number': invoice.number,
                        'result': result
                    })

                except Exception as e:
                    failed += 1
                    results.append({
                        'invoice_id': str(invoice.id),
                        'invoice_number': invoice.number,
                        'result': {'success': False, 'error': str(e)}
                    })

            return {
                'success': True,
                'operation': operation,
                'total_processed': len(invoices),
                'successful': successful,
                'failed': failed,
                'results': results
            }

        except Exception as e:
            logger.error(f"Bulk e-Invoice operation failed: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }


class EInvoiceCancellationWorkflow:
    """
    Workflow manager for e-Invoice cancellation process
    """

    CANCELLATION_REASONS = {
        '1': 'Duplicate',
        '2': 'Data Entry Mistake',
        '3': 'Order Cancelled',
        '4': 'Other'
    }

    def __init__(self):
        self.einvoice_service = EInvoiceService()

    def initiate_cancellation(self, invoice: Invoice,
                            reason_code: str,
                            remarks: str,
                            initiated_by: str) -> Dict[str, Any]:
        """Initiate e-Invoice cancellation workflow"""
        try:
            # Validate cancellation eligibility
            eligibility = self.einvoice_service.validate_cancellation_eligibility(invoice)

            if not eligibility['eligible']:
                return {
                    'success': False,
                    'error': eligibility['reason'],
                    'workflow_status': 'rejected'
                }

            # Validate reason code
            if reason_code not in self.CANCELLATION_REASONS:
                return {
                    'success': False,
                    'error': 'Invalid cancellation reason code',
                    'workflow_status': 'rejected'
                }

            # Create cancellation request record
            cancellation_record = self._create_cancellation_record(
                invoice, reason_code, remarks, initiated_by
            )

            # For auto-approval (no workflow needed for simple cases)
            if self._should_auto_approve(invoice, reason_code):
                return self._auto_approve_cancellation(cancellation_record)

            # For manual approval workflow
            return self._start_approval_workflow(cancellation_record)

        except Exception as e:
            logger.error(f"Cancellation workflow initiation failed: {str(e)}")
            return {
                'success': False,
                'error': str(e),
                'workflow_status': 'error'
            }

    def approve_cancellation(self, cancellation_id: str,
                           approved_by: str,
                           approval_remarks: str = '') -> Dict[str, Any]:
        """Approve pending cancellation request"""
        try:
            # This would integrate with a workflow system
            # For now, simulate approval

            # Execute the actual cancellation
            cancellation_record = self._get_cancellation_record(cancellation_id)

            if not cancellation_record:
                return {
                    'success': False,
                    'error': 'Cancellation request not found'
                }

            # Perform the cancellation
            result = self.einvoice_service.cancel_einvoice(
                cancellation_record['invoice'],
                cancellation_record['reason_code'],
                cancellation_record['remarks']
            )

            if result['success']:
                # Update cancellation record
                self._update_cancellation_record(
                    cancellation_id,
                    'approved',
                    approved_by,
                    approval_remarks
                )

                return {
                    'success': True,
                    'message': 'e-Invoice cancelled successfully',
                    'workflow_status': 'completed',
                    'cancellation_result': result
                }
            else:
                self._update_cancellation_record(
                    cancellation_id,
                    'failed',
                    approved_by,
                    f"Cancellation failed: {result['error']}"
                )

                return {
                    'success': False,
                    'error': result['error'],
                    'workflow_status': 'failed'
                }

        except Exception as e:
            logger.error(f"Cancellation approval failed: {str(e)}")
            return {
                'success': False,
                'error': str(e),
                'workflow_status': 'error'
            }

    def reject_cancellation(self, cancellation_id: str,
                          rejected_by: str,
                          rejection_reason: str) -> Dict[str, Any]:
        """Reject pending cancellation request"""
        try:
            self._update_cancellation_record(
                cancellation_id,
                'rejected',
                rejected_by,
                rejection_reason
            )

            return {
                'success': True,
                'message': 'Cancellation request rejected',
                'workflow_status': 'rejected'
            }

        except Exception as e:
            logger.error(f"Cancellation rejection failed: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }

    def get_cancellation_status(self, cancellation_id: str) -> Dict[str, Any]:
        """Get status of cancellation workflow"""
        try:
            cancellation_record = self._get_cancellation_record(cancellation_id)

            if not cancellation_record:
                return {
                    'success': False,
                    'error': 'Cancellation request not found'
                }

            return {
                'success': True,
                'cancellation_id': cancellation_id,
                'status': cancellation_record['status'],
                'invoice_number': cancellation_record['invoice_number'],
                'reason_code': cancellation_record['reason_code'],
                'reason_description': self.CANCELLATION_REASONS.get(cancellation_record['reason_code']),
                'remarks': cancellation_record['remarks'],
                'initiated_by': cancellation_record['initiated_by'],
                'initiated_at': cancellation_record['initiated_at'],
                'approved_by': cancellation_record.get('approved_by'),
                'approved_at': cancellation_record.get('approved_at'),
                'approval_remarks': cancellation_record.get('approval_remarks')
            }

        except Exception as e:
            logger.error(f"Cancellation status check failed: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }

    def _create_cancellation_record(self, invoice: Invoice,
                                  reason_code: str,
                                  remarks: str,
                                  initiated_by: str) -> Dict[str, Any]:
        """Create cancellation request record"""
        # In a real implementation, this would be stored in database
        cancellation_id = f"CANC_{invoice.number}_{timezone.now().strftime('%Y%m%d%H%M%S')}"

        record = {
            'id': cancellation_id,
            'invoice': invoice,
            'invoice_number': invoice.number,
            'reason_code': reason_code,
            'remarks': remarks,
            'initiated_by': initiated_by,
            'initiated_at': timezone.now().isoformat(),
            'status': 'pending'
        }

        # Store in session or cache for demo
        # In production, use proper database storage

        return record

    def _should_auto_approve(self, invoice: Invoice, reason_code: str) -> bool:
        """Determine if cancellation should be auto-approved"""
        # Auto-approve for data entry mistakes within 1 hour
        einvoice_details = EInvoiceDetails.objects.filter(invoice=invoice).first()

        if (reason_code == '2' and einvoice_details and einvoice_details.ack_date):
            time_since_generation = timezone.now() - einvoice_details.ack_date
            if time_since_generation.total_seconds() < 3600:  # 1 hour
                return True

        return False

    def _auto_approve_cancellation(self, cancellation_record: Dict[str, Any]) -> Dict[str, Any]:
        """Auto-approve and execute cancellation"""
        try:
            result = self.einvoice_service.cancel_einvoice(
                cancellation_record['invoice'],
                cancellation_record['reason_code'],
                cancellation_record['remarks']
            )

            if result['success']:
                return {
                    'success': True,
                    'message': 'e-Invoice cancelled successfully (auto-approved)',
                    'workflow_status': 'auto_approved',
                    'cancellation_id': cancellation_record['id'],
                    'cancellation_result': result
                }
            else:
                return {
                    'success': False,
                    'error': result['error'],
                    'workflow_status': 'failed'
                }

        except Exception as e:
            return {
                'success': False,
                'error': str(e),
                'workflow_status': 'error'
            }

    def _start_approval_workflow(self, cancellation_record: Dict[str, Any]) -> Dict[str, Any]:
        """Start manual approval workflow"""
        # In real implementation, integrate with workflow engine
        return {
            'success': True,
            'message': 'Cancellation request submitted for approval',
            'workflow_status': 'pending_approval',
            'cancellation_id': cancellation_record['id'],
            'requires_approval': True
        }

    def _get_cancellation_record(self, cancellation_id: str) -> Optional[Dict[str, Any]]:
        """Get cancellation record (placeholder implementation)"""
        # In real implementation, fetch from database
        return None

    def _update_cancellation_record(self, cancellation_id: str,
                                  status: str,
                                  updated_by: str,
                                  remarks: str):
        """Update cancellation record status"""
        # In real implementation, update database record
        pass