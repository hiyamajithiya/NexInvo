"""
GST Return Filing System for NexInvo
Implements GSTR-1, GSTR-3B, and other GST return generation and filing
"""

import json
import logging
from typing import Dict, Any, List, Optional, Tuple
from decimal import Decimal
from datetime import datetime, timedelta
from calendar import monthrange
import pandas as pd
from django.utils import timezone
from django.db.models import Sum, Q, Count
from django.conf import settings

from invoices.models import Invoice, InvoiceLine, EInvoiceDetails
from tenants.models import Tenant, Client

logger = logging.getLogger(__name__)


class GSTR1Generator:
    """
    Generator for GSTR-1 (Outward Supplies) return
    """

    def __init__(self, tenant: Tenant):
        self.tenant = tenant
        self.gstin = tenant.company_details.get('gstin', '')

    def generate_gstr1_json(self,
                           return_period: str,
                           filing_frequency: str = 'MONTHLY') -> Dict[str, Any]:
        """
        Generate GSTR-1 JSON for the specified return period

        Args:
            return_period: Period in format 'MMYYYY' (e.g., '032024' for March 2024)
            filing_frequency: 'MONTHLY' or 'QUARTERLY'

        Returns:
            GSTR-1 JSON structure
        """
        try:
            # Parse return period
            month = int(return_period[:2])
            year = int(return_period[2:])

            # Get date range for the period
            start_date, end_date = self._get_period_dates(year, month, filing_frequency)

            # Get invoices for the period
            invoices = Invoice.objects.filter(
                tenant=self.tenant,
                date__range=[start_date, end_date],
                status__in=['sent', 'paid']
            )

            # Build GSTR-1 JSON structure
            gstr1_json = {
                'gstin': self.gstin,
                'ret_period': return_period,
                'b2b': self._generate_b2b_section(invoices),
                'b2cl': self._generate_b2cl_section(invoices),
                'b2cs': self._generate_b2cs_section(invoices),
                'cdnr': self._generate_cdnr_section(invoices),
                'exp': self._generate_export_section(invoices),
                'hsn': self._generate_hsn_summary(invoices),
                'doc_issue': self._generate_document_issued_summary(invoices)
            }

            # Remove empty sections
            gstr1_json = self._clean_gstr1_json(gstr1_json)

            return {
                'success': True,
                'gstr1_json': gstr1_json,
                'return_period': return_period,
                'filing_frequency': filing_frequency,
                'invoice_count': invoices.count(),
                'generated_at': timezone.now().isoformat()
            }

        except Exception as e:
            logger.error(f"GSTR-1 generation failed: {str(e)}")
            return {
                'success': False,
                'error': str(e),
                'error_message': f"GSTR-1 generation failed: {str(e)}"
            }

    def _generate_b2b_section(self, invoices) -> List[Dict[str, Any]]:
        """Generate B2B (Business to Business) section"""
        b2b_data = []

        # Group by client GSTIN
        b2b_invoices = invoices.filter(
            client__client_type='b2b',
            client__gstin__isnull=False
        ).exclude(client__gstin='')

        clients_data = {}

        for invoice in b2b_invoices:
            client_gstin = invoice.client.gstin
            if client_gstin not in clients_data:
                clients_data[client_gstin] = {
                    'ctin': client_gstin,
                    'inv': []
                }

            # Build invoice data
            invoice_data = {
                'inum': invoice.number,
                'idt': invoice.date.strftime('%d-%m-%Y'),
                'val': float(invoice.grand_total),
                'pos': invoice.place_of_supply.split('-')[0] if invoice.place_of_supply else '',
                'rchrg': 'N',  # Reverse charge
                'etin': None,  # E-commerce GSTIN
                'itms': self._get_invoice_items_for_gstr1(invoice)
            }

            clients_data[client_gstin]['inv'].append(invoice_data)

        # Convert to list format
        for client_data in clients_data.values():
            b2b_data.append(client_data)

        return b2b_data

    def _generate_b2cl_section(self, invoices) -> List[Dict[str, Any]]:
        """Generate B2CL (B2C Large - above ₹2.5 lakh) section"""
        b2cl_data = []

        b2cl_invoices = invoices.filter(
            client__client_type='b2c',
            grand_total__gt=250000  # Above ₹2.5 lakh
        )

        pos_data = {}

        for invoice in b2cl_invoices:
            pos = invoice.place_of_supply.split('-')[0] if invoice.place_of_supply else '29'  # Default Karnataka

            if pos not in pos_data:
                pos_data[pos] = {
                    'pos': pos,
                    'inv': []
                }

            invoice_data = {
                'inum': invoice.number,
                'idt': invoice.date.strftime('%d-%m-%Y'),
                'val': float(invoice.grand_total),
                'etin': None,
                'itms': self._get_invoice_items_for_gstr1(invoice)
            }

            pos_data[pos]['inv'].append(invoice_data)

        for pos_entry in pos_data.values():
            b2cl_data.append(pos_entry)

        return b2cl_data

    def _generate_b2cs_section(self, invoices) -> List[Dict[str, Any]]:
        """Generate B2CS (B2C Small - below ₹2.5 lakh) section"""
        b2cs_data = []

        b2cs_invoices = invoices.filter(
            client__client_type='b2c',
            grand_total__lte=250000  # Below or equal to ₹2.5 lakh
        )

        # Aggregate by POS, rate, and type
        aggregated_data = {}

        for invoice in b2cs_invoices:
            pos = invoice.place_of_supply.split('-')[0] if invoice.place_of_supply else '29'

            for line in invoice.lines.all():
                total_tax_rate = line.cgst_rate + line.sgst_rate + line.igst_rate
                supply_type = 'INTER' if line.igst_rate > 0 else 'INTRA'

                key = f"{pos}_{total_tax_rate}_{supply_type}"

                if key not in aggregated_data:
                    aggregated_data[key] = {
                        'sply_ty': supply_type,
                        'pos': pos,
                        'typ': 'OE',  # Outward Exempt
                        'txval': 0,
                        'iamt': 0,  # IGST amount
                        'camt': 0,  # CGST amount
                        'samt': 0,  # SGST amount
                        'csamt': 0  # Cess amount
                    }

                # Aggregate values
                aggregated_data[key]['txval'] += float(line.taxable_value)
                aggregated_data[key]['iamt'] += float(line.igst_amount)
                aggregated_data[key]['camt'] += float(line.cgst_amount)
                aggregated_data[key]['samt'] += float(line.sgst_amount)
                aggregated_data[key]['csamt'] += float(line.cess_amount)

        return list(aggregated_data.values())

    def _generate_cdnr_section(self, invoices) -> List[Dict[str, Any]]:
        """Generate CDNR (Credit/Debit Notes - Registered) section"""
        # For now, return empty as we don't have credit/debit note functionality yet
        return []

    def _generate_export_section(self, invoices) -> List[Dict[str, Any]]:
        """Generate Export section"""
        # For now, return empty as we don't have export functionality yet
        return []

    def _generate_hsn_summary(self, invoices) -> List[Dict[str, Any]]:
        """Generate HSN-wise summary"""
        hsn_data = {}

        for invoice in invoices:
            for line in invoice.lines.all():
                hsn_code = line.hsn_sac or 'UNCLASSIFIED'

                if hsn_code not in hsn_data:
                    hsn_data[hsn_code] = {
                        'num': 1,  # HSN number
                        'hsn_sc': hsn_code,
                        'desc': line.description[:30] if line.description else '',
                        'uqc': line.uqc or 'NOS',
                        'qty': 0,
                        'val': 0,
                        'txval': 0,
                        'iamt': 0,
                        'camt': 0,
                        'samt': 0,
                        'csamt': 0
                    }

                # Aggregate values
                hsn_data[hsn_code]['qty'] += float(line.quantity)
                hsn_data[hsn_code]['val'] += float(line.line_total)
                hsn_data[hsn_code]['txval'] += float(line.taxable_value)
                hsn_data[hsn_code]['iamt'] += float(line.igst_amount)
                hsn_data[hsn_code]['camt'] += float(line.cgst_amount)
                hsn_data[hsn_code]['samt'] += float(line.sgst_amount)
                hsn_data[hsn_code]['csamt'] += float(line.cess_amount)

        # Convert to list and add serial numbers
        hsn_list = []
        for idx, hsn_entry in enumerate(hsn_data.values(), 1):
            hsn_entry['num'] = idx
            hsn_list.append(hsn_entry)

        return hsn_list

    def _generate_document_issued_summary(self, invoices) -> List[Dict[str, Any]]:
        """Generate document issued summary"""
        # Get invoice number ranges
        invoice_numbers = [inv.number for inv in invoices]

        return [{
            'doc_num': 1,
            'doc_typ': 'Invoices for outward supply',
            'docs': [{
                'num': 1,
                'from': min(invoice_numbers) if invoice_numbers else '',
                'to': max(invoice_numbers) if invoice_numbers else '',
                'totnum': len(invoice_numbers),
                'cancel': 0,
                'net_issue': len(invoice_numbers)
            }]
        }]

    def _get_invoice_items_for_gstr1(self, invoice) -> List[Dict[str, Any]]:
        """Get invoice items formatted for GSTR-1"""
        items = []

        # Group by tax rate
        tax_groups = {}

        for line in invoice.lines.all():
            total_tax_rate = line.cgst_rate + line.sgst_rate + line.igst_rate

            if total_tax_rate not in tax_groups:
                tax_groups[total_tax_rate] = {
                    'num': len(tax_groups) + 1,
                    'itm_det': {
                        'txval': 0,
                        'rt': float(total_tax_rate),
                        'iamt': 0,
                        'camt': 0,
                        'samt': 0,
                        'csamt': 0
                    }
                }

            # Aggregate tax values
            tax_groups[total_tax_rate]['itm_det']['txval'] += float(line.taxable_value)
            tax_groups[total_tax_rate]['itm_det']['iamt'] += float(line.igst_amount)
            tax_groups[total_tax_rate]['itm_det']['camt'] += float(line.cgst_amount)
            tax_groups[total_tax_rate]['itm_det']['samt'] += float(line.sgst_amount)
            tax_groups[total_tax_rate]['itm_det']['csamt'] += float(line.cess_amount)

        return list(tax_groups.values())

    def _get_period_dates(self, year: int, month: int, frequency: str) -> Tuple[datetime, datetime]:
        """Get start and end dates for the return period"""
        if frequency == 'MONTHLY':
            start_date = datetime(year, month, 1)
            _, last_day = monthrange(year, month)
            end_date = datetime(year, month, last_day)
        else:  # QUARTERLY
            if month in [4, 5, 6]:  # Q1
                start_date = datetime(year, 4, 1)
                end_date = datetime(year, 6, 30)
            elif month in [7, 8, 9]:  # Q2
                start_date = datetime(year, 7, 1)
                end_date = datetime(year, 9, 30)
            elif month in [10, 11, 12]:  # Q3
                start_date = datetime(year, 10, 1)
                end_date = datetime(year, 12, 31)
            else:  # Q4 (Jan-Mar)
                start_date = datetime(year, 1, 1)
                end_date = datetime(year, 3, 31)

        return start_date, end_date

    def _clean_gstr1_json(self, gstr1_json: Dict[str, Any]) -> Dict[str, Any]:
        """Remove empty sections from GSTR-1 JSON"""
        cleaned = {}

        for key, value in gstr1_json.items():
            if value:  # Only include non-empty sections
                cleaned[key] = value

        return cleaned


class GSTR3BGenerator:
    """
    Generator for GSTR-3B (Summary Return)
    """

    def __init__(self, tenant: Tenant):
        self.tenant = tenant
        self.gstin = tenant.company_details.get('gstin', '')

    def generate_gstr3b_json(self, return_period: str) -> Dict[str, Any]:
        """
        Generate GSTR-3B JSON for the specified return period

        Args:
            return_period: Period in format 'MMYYYY' (e.g., '032024')

        Returns:
            GSTR-3B JSON structure
        """
        try:
            # Parse return period
            month = int(return_period[:2])
            year = int(return_period[2:])

            # Get date range
            start_date = datetime(year, month, 1)
            _, last_day = monthrange(year, month)
            end_date = datetime(year, month, last_day)

            # Get outward supplies (from invoices)
            outward_invoices = Invoice.objects.filter(
                tenant=self.tenant,
                date__range=[start_date, end_date],
                status__in=['sent', 'paid']
            )

            # Build GSTR-3B JSON structure
            gstr3b_json = {
                'gstin': self.gstin,
                'ret_period': return_period,
                'inward_sup': self._generate_inward_supplies_section(),
                'intr_ltfee': self._generate_interest_late_fee_section(),
                'itc_elg': self._generate_itc_eligible_section(),
                'itc_rev': self._generate_itc_reversal_section(),
                'itc_net': self._generate_itc_net_section(),
                'inward_sup_liable': self._generate_inward_supplies_liable_section(),
                'sup_details': self._generate_supplies_details_section(outward_invoices),
                'tax_pay': self._generate_tax_payment_section(outward_invoices),
                'status': 1  # Filed
            }

            return {
                'success': True,
                'gstr3b_json': gstr3b_json,
                'return_period': return_period,
                'generated_at': timezone.now().isoformat()
            }

        except Exception as e:
            logger.error(f"GSTR-3B generation failed: {str(e)}")
            return {
                'success': False,
                'error': str(e),
                'error_message': f"GSTR-3B generation failed: {str(e)}"
            }

    def _generate_supplies_details_section(self, invoices) -> Dict[str, Any]:
        """Generate supplies details section 3.1"""
        # Calculate totals from invoices
        total_taxable = invoices.aggregate(
            taxable=Sum('taxable_amount')
        )['taxable'] or 0

        total_igst = invoices.aggregate(
            igst=Sum('igst_amount')
        )['igst'] or 0

        total_cgst = invoices.aggregate(
            cgst=Sum('cgst_amount')
        )['cgst'] or 0

        total_sgst = invoices.aggregate(
            sgst=Sum('sgst_amount')
        )['sgst'] or 0

        total_cess = invoices.aggregate(
            cess=Sum('cess_amount')
        )['cess'] or 0

        return {
            'osup_det': {
                'txval': float(total_taxable),
                'iamt': float(total_igst),
                'camt': float(total_cgst),
                'samt': float(total_sgst),
                'csamt': float(total_cess)
            },
            'osup_zero': {
                'txval': 0.0,
                'iamt': 0.0,
                'csamt': 0.0
            },
            'osup_nil_exmp': {
                'txval': 0.0
            },
            'isup_rev': {
                'txval': 0.0,
                'iamt': 0.0,
                'camt': 0.0,
                'samt': 0.0,
                'csamt': 0.0
            },
            'osup_nongst': {
                'txval': 0.0
            }
        }

    def _generate_tax_payment_section(self, invoices) -> Dict[str, Any]:
        """Generate tax payment section 5"""
        # For now, assume tax liability equals tax collected
        total_igst = invoices.aggregate(igst=Sum('igst_amount'))['igst'] or 0
        total_cgst = invoices.aggregate(cgst=Sum('cgst_amount'))['cgst'] or 0
        total_sgst = invoices.aggregate(sgst=Sum('sgst_amount'))['sgst'] or 0
        total_cess = invoices.aggregate(cess=Sum('cess_amount'))['cess'] or 0

        return {
            'tax_pay': {
                'iamt': float(total_igst),
                'camt': float(total_cgst),
                'samt': float(total_sgst),
                'csamt': float(total_cess)
            },
            'int_pay': {
                'iamt': 0.0,
                'camt': 0.0,
                'samt': 0.0,
                'csamt': 0.0
            },
            'fee_pay': {
                'camt': 0.0,
                'samt': 0.0
            }
        }

    def _generate_inward_supplies_section(self) -> Dict[str, Any]:
        """Generate inward supplies section 3.1 (placeholder)"""
        return {
            'isup_det': [{
                'ty': 'GST',
                'intra': 0.0,
                'inter': 0.0
            }]
        }

    def _generate_interest_late_fee_section(self) -> Dict[str, Any]:
        """Generate interest and late fee section (placeholder)"""
        return {
            'intr_det': {
                'tx': 0.0,
                'intr': 0.0,
                'pen': 0.0,
                'fee': 0.0,
                'oth': 0.0
            }
        }

    def _generate_itc_eligible_section(self) -> Dict[str, Any]:
        """Generate ITC eligible section (placeholder)"""
        return {
            'itc_avl': [{
                'ty': 'IMPG',
                'iamt': 0.0,
                'camt': 0.0,
                'samt': 0.0,
                'csamt': 0.0
            }]
        }

    def _generate_itc_reversal_section(self) -> Dict[str, Any]:
        """Generate ITC reversal section (placeholder)"""
        return {
            'itc_rev': [{
                'ty': 'RUL',
                'iamt': 0.0,
                'camt': 0.0,
                'samt': 0.0,
                'csamt': 0.0
            }]
        }

    def _generate_itc_net_section(self) -> Dict[str, Any]:
        """Generate ITC net section (placeholder)"""
        return {
            'itc_net': {
                'iamt': 0.0,
                'camt': 0.0,
                'samt': 0.0,
                'csamt': 0.0
            }
        }

    def _generate_inward_supplies_liable_section(self) -> Dict[str, Any]:
        """Generate inward supplies liable to reverse charge (placeholder)"""
        return {
            'inward_sup': {
                'ty': 'GST',
                'txval': 0.0,
                'iamt': 0.0,
                'camt': 0.0,
                'samt': 0.0,
                'csamt': 0.0
            }
        }


class GSTReturnService:
    """
    Main service for GST return generation and management
    """

    def __init__(self, tenant: Tenant):
        self.tenant = tenant
        self.gstr1_generator = GSTR1Generator(tenant)
        self.gstr3b_generator = GSTR3BGenerator(tenant)

    def generate_return(self, return_type: str, return_period: str, **kwargs) -> Dict[str, Any]:
        """
        Generate GST return based on type

        Args:
            return_type: 'GSTR1' or 'GSTR3B'
            return_period: Period in format 'MMYYYY'
            **kwargs: Additional parameters

        Returns:
            Generated return data
        """
        try:
            if return_type == 'GSTR1':
                filing_frequency = kwargs.get('filing_frequency', 'MONTHLY')
                return self.gstr1_generator.generate_gstr1_json(return_period, filing_frequency)
            elif return_type == 'GSTR3B':
                return self.gstr3b_generator.generate_gstr3b_json(return_period)
            else:
                return {
                    'success': False,
                    'error': f'Unsupported return type: {return_type}'
                }

        except Exception as e:
            logger.error(f"GST return generation failed: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }

    def validate_return_data(self, return_type: str, return_data: Dict[str, Any]) -> Dict[str, Any]:
        """Validate GST return data before filing"""
        try:
            validation_errors = []
            warnings = []

            if return_type == 'GSTR1':
                # Validate GSTR-1 specific requirements
                if not return_data.get('gstin'):
                    validation_errors.append('GSTIN is required')

                if not return_data.get('ret_period'):
                    validation_errors.append('Return period is required')

                # Check if at least one section has data
                sections_with_data = sum(1 for section in ['b2b', 'b2cl', 'b2cs']
                                       if return_data.get(section))

                if sections_with_data == 0:
                    warnings.append('No transaction data found for the period')

            elif return_type == 'GSTR3B':
                # Validate GSTR-3B specific requirements
                if not return_data.get('gstin'):
                    validation_errors.append('GSTIN is required')

                if not return_data.get('ret_period'):
                    validation_errors.append('Return period is required')

            return {
                'success': True,
                'is_valid': len(validation_errors) == 0,
                'validation_errors': validation_errors,
                'warnings': warnings
            }

        except Exception as e:
            logger.error(f"Return validation failed: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }

    def get_return_summary(self, return_period: str) -> Dict[str, Any]:
        """Get summary of returns for a period"""
        try:
            # Parse return period
            month = int(return_period[:2])
            year = int(return_period[2:])

            # Get date range
            start_date = datetime(year, month, 1)
            _, last_day = monthrange(year, month)
            end_date = datetime(year, month, last_day)

            # Get invoices for the period
            invoices = Invoice.objects.filter(
                tenant=self.tenant,
                date__range=[start_date, end_date],
                status__in=['sent', 'paid']
            )

            # Calculate summary metrics
            total_invoices = invoices.count()
            total_taxable_value = invoices.aggregate(Sum('taxable_amount'))['taxable_amount__sum'] or 0
            total_tax_amount = invoices.aggregate(
                total_tax=Sum('cgst_amount') + Sum('sgst_amount') + Sum('igst_amount')
            )['total_tax'] or 0
            total_invoice_value = invoices.aggregate(Sum('grand_total'))['grand_total__sum'] or 0

            # Get client-wise breakdown
            b2b_count = invoices.filter(client__client_type='b2b').count()
            b2c_count = invoices.filter(client__client_type='b2c').count()
            b2cl_count = invoices.filter(
                client__client_type='b2c',
                grand_total__gt=250000
            ).count()

            return {
                'success': True,
                'return_period': return_period,
                'period_range': {
                    'start_date': start_date.strftime('%Y-%m-%d'),
                    'end_date': end_date.strftime('%Y-%m-%d')
                },
                'summary': {
                    'total_invoices': total_invoices,
                    'total_taxable_value': float(total_taxable_value),
                    'total_tax_amount': float(total_tax_amount),
                    'total_invoice_value': float(total_invoice_value),
                    'b2b_transactions': b2b_count,
                    'b2c_transactions': b2c_count,
                    'b2cl_transactions': b2cl_count
                },
                'generated_at': timezone.now().isoformat()
            }

        except Exception as e:
            logger.error(f"Return summary generation failed: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }