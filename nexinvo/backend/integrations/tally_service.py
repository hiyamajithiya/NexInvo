"""
Tally Prime XML Export Service
Generates compliant Tally XML with complete GST breakdown and ledger mappings
"""

import xml.etree.ElementTree as ET
from datetime import datetime
from decimal import Decimal
from typing import Dict, List, Optional, Any
import logging

from django.db import transaction
from django.conf import settings

from invoices.models import Invoice, InvoiceLine
from tenants.models import Client
from .models import Integration, TallyExport

logger = logging.getLogger(__name__)


class TallyXMLGenerator:
    """
    Generate Tally Prime compatible XML for invoice data
    Supports voucher export with complete GST breakdown
    """

    def __init__(self, tenant, integration: Integration):
        self.tenant = tenant
        self.integration = integration
        self.company_name = tenant.company_details.get('name', 'Company')
        self.gstin = tenant.company_details.get('gstin', '')

    def generate_voucher_xml(self, invoices: List[Invoice]) -> str:
        """Generate Tally XML for invoice vouchers"""

        # Create root element
        envelope = ET.Element("ENVELOPE")

        # Add header
        header = ET.SubElement(envelope, "HEADER")
        ET.SubElement(header, "TALLYREQUEST").text = "Import Data"

        # Add body
        body = ET.SubElement(envelope, "BODY")
        import_data = ET.SubElement(body, "IMPORTDATA")

        # Add request description
        request_desc = ET.SubElement(import_data, "REQUESTDESC")
        ET.SubElement(request_desc, "REPORTNAME").text = "Vouchers"

        # Add static variables
        static_vars = ET.SubElement(request_desc, "STATICVARIABLES")
        ET.SubElement(static_vars, "SVCURRENTCOMPANY").text = self.company_name

        # Add request data
        request_data = ET.SubElement(import_data, "REQUESTDATA")

        # Process each invoice
        for invoice in invoices:
            self._add_voucher_to_xml(request_data, invoice)

        return self._format_xml(envelope)

    def _add_voucher_to_xml(self, parent: ET.Element, invoice: Invoice) -> None:
        """Add a single invoice voucher to XML"""

        # Create TALLYMESSAGE for voucher
        tally_message = ET.SubElement(parent, "TALLYMESSAGE")
        ET.SubElement(tally_message, "UDF:VOUCHERTYPE.LIST").text = "Sales"

        # Create VOUCHER element
        voucher = ET.SubElement(tally_message, "VOUCHER")
        voucher.set("REMOTEID", str(invoice.id))
        voucher.set("VCHTYPE", "Sales")
        voucher.set("ACTION", "Create")
        voucher.set("OBJVIEW", "Invoice Voucher View")

        # Basic voucher details
        ET.SubElement(voucher, "DATE").text = invoice.date.strftime("%Y%m%d")
        ET.SubElement(voucher, "VOUCHERTYPENAME").text = "Sales"
        ET.SubElement(voucher, "VOUCHERNUMBER").text = f"{invoice.series}{invoice.number}"
        ET.SubElement(voucher, "REFERENCE").text = f"INV-{invoice.number}"
        ET.SubElement(voucher, "BASICDATEFORNEWENTRYFORMAT").text = invoice.date.strftime("%d-%b-%Y")

        # Party ledger (Customer)
        ET.SubElement(voucher, "PARTYLEDGERNAME").text = self._get_party_ledger_name(invoice.client)

        # GST related fields
        if invoice.client.gstin:
            ET.SubElement(voucher, "PARTYGSTIN").text = invoice.client.gstin

        ET.SubElement(voucher, "PLACEOFSUPPLY").text = f"{invoice.place_of_supply}-{self._get_state_name(invoice.place_of_supply)}"
        ET.SubElement(voucher, "GSTREGISTRATIONTYPE").text = "Regular" if invoice.client.gstin else "Unregistered"

        # Voucher amounts
        ET.SubElement(voucher, "BASICBUYERNAME").text = invoice.client.name

        # Add ledger entries
        self._add_ledger_entries(voucher, invoice)

        # Add inventory entries if items exist
        self._add_inventory_entries(voucher, invoice)

    def _add_ledger_entries(self, voucher: ET.Element, invoice: Invoice) -> None:
        """Add ledger entries for the voucher"""

        # Party ledger (Debit - Customer Account)
        party_ledger = ET.SubElement(voucher, "ALLLEDGERENTRIES.LIST")
        ET.SubElement(party_ledger, "LEDGERNAME").text = self._get_party_ledger_name(invoice.client)
        ET.SubElement(party_ledger, "GSTCLASS")
        ET.SubElement(party_ledger, "ISDEEMEDPOSITIVE").text = "Yes"
        ET.SubElement(party_ledger, "AMOUNT").text = str(invoice.grand_total)

        # Sales ledger (Credit - Sales Account)
        sales_ledger = ET.SubElement(voucher, "ALLLEDGERENTRIES.LIST")
        ET.SubElement(sales_ledger, "LEDGERNAME").text = "Sales Account"
        ET.SubElement(sales_ledger, "GSTCLASS")
        ET.SubElement(sales_ledger, "ISDEEMEDPOSITIVE").text = "No"
        ET.SubElement(sales_ledger, "AMOUNT").text = f"-{invoice.taxable_amount}"

        # Tax ledger entries
        self._add_tax_ledgers(voucher, invoice)

    def _add_tax_ledgers(self, voucher: ET.Element, invoice: Invoice) -> None:
        """Add GST tax ledger entries"""

        # Calculate total tax amounts
        total_cgst = sum(line.cgst_amount for line in invoice.lines.all())
        total_sgst = sum(line.sgst_amount for line in invoice.lines.all())
        total_igst = sum(line.igst_amount for line in invoice.lines.all())
        total_cess = sum(line.cess_amount for line in invoice.lines.all())

        # CGST Ledger
        if total_cgst > 0:
            cgst_ledger = ET.SubElement(voucher, "ALLLEDGERENTRIES.LIST")
            ET.SubElement(cgst_ledger, "LEDGERNAME").text = "CGST"
            ET.SubElement(cgst_ledger, "GSTCLASS")
            ET.SubElement(cgst_ledger, "ISDEEMEDPOSITIVE").text = "No"
            ET.SubElement(cgst_ledger, "AMOUNT").text = f"-{total_cgst}"

        # SGST Ledger
        if total_sgst > 0:
            sgst_ledger = ET.SubElement(voucher, "ALLLEDGERENTRIES.LIST")
            ET.SubElement(sgst_ledger, "LEDGERNAME").text = "SGST"
            ET.SubElement(sgst_ledger, "GSTCLASS")
            ET.SubElement(sgst_ledger, "ISDEEMEDPOSITIVE").text = "No"
            ET.SubElement(sgst_ledger, "AMOUNT").text = f"-{total_sgst}"

        # IGST Ledger
        if total_igst > 0:
            igst_ledger = ET.SubElement(voucher, "ALLLEDGERENTRIES.LIST")
            ET.SubElement(igst_ledger, "LEDGERNAME").text = "IGST"
            ET.SubElement(igst_ledger, "GSTCLASS")
            ET.SubElement(igst_ledger, "ISDEEMEDPOSITIVE").text = "No"
            ET.SubElement(igst_ledger, "AMOUNT").text = f"-{total_igst}"

        # CESS Ledger
        if total_cess > 0:
            cess_ledger = ET.SubElement(voucher, "ALLLEDGERENTRIES.LIST")
            ET.SubElement(cess_ledger, "LEDGERNAME").text = "CESS"
            ET.SubElement(cess_ledger, "GSTCLASS")
            ET.SubElement(cess_ledger, "ISDEEMEDPOSITIVE").text = "No"
            ET.SubElement(cess_ledger, "AMOUNT").text = f"-{total_cess}"

    def _add_inventory_entries(self, voucher: ET.Element, invoice: Invoice) -> None:
        """Add inventory allocation entries for items"""

        for line in invoice.lines.all():
            if line.item:
                inv_entry = ET.SubElement(voucher, "ALLINVENTORYENTRIES.LIST")
                ET.SubElement(inv_entry, "STOCKITEMNAME").text = line.item.name
                ET.SubElement(inv_entry, "ISDEEMEDPOSITIVE").text = "No"
                ET.SubElement(inv_entry, "RATE").text = f"{line.rate}/{line.uqc if line.uqc else 'Nos'}"
                ET.SubElement(inv_entry, "AMOUNT").text = f"-{line.taxable_value}"

                # Add batch allocations
                batch_alloc = ET.SubElement(inv_entry, "BATCHALLOCATIONS.LIST")
                ET.SubElement(batch_alloc, "GODOWNNAME").text = "Main Location"
                ET.SubElement(batch_alloc, "BATCHNAME").text = "Primary Batch"
                ET.SubElement(batch_alloc, "QUANTITY").text = f"-{line.quantity}"
                ET.SubElement(batch_alloc, "AMOUNT").text = f"-{line.taxable_value}"

    def _get_party_ledger_name(self, client: Client) -> str:
        """Generate party ledger name for Tally"""
        return f"{client.name} ({client.client_code})"

    def _get_state_name(self, state_code: str) -> str:
        """Get state name from code"""
        state_mapping = {
            '01': 'Jammu and Kashmir', '02': 'Himachal Pradesh', '03': 'Punjab',
            '04': 'Chandigarh', '05': 'Uttarakhand', '06': 'Haryana',
            '07': 'Delhi', '08': 'Rajasthan', '09': 'Uttar Pradesh',
            '10': 'Bihar', '11': 'Sikkim', '12': 'Arunachal Pradesh',
            '13': 'Nagaland', '14': 'Manipur', '15': 'Mizoram',
            '16': 'Tripura', '17': 'Meghalaya', '18': 'Assam',
            '19': 'West Bengal', '20': 'Jharkhand', '21': 'Odisha',
            '22': 'Chhattisgarh', '23': 'Madhya Pradesh', '24': 'Gujarat',
            '25': 'Daman and Diu', '26': 'Dadra and Nagar Haveli',
            '27': 'Maharashtra', '28': 'Andhra Pradesh', '29': 'Karnataka',
            '30': 'Goa', '31': 'Lakshadweep', '32': 'Kerala',
            '33': 'Tamil Nadu', '34': 'Puducherry', '35': 'Andaman and Nicobar Islands',
            '36': 'Telangana', '37': 'Andhra Pradesh', '38': 'Ladakh'
        }
        return state_mapping.get(state_code, 'Unknown')

    def _format_xml(self, element: ET.Element) -> str:
        """Format XML with proper indentation"""
        self._indent(element)
        return ET.tostring(element, encoding='unicode', xml_declaration=True)

    def _indent(self, elem: ET.Element, level: int = 0) -> None:
        """Add indentation to XML elements"""
        i = "\n" + level * "  "
        if len(elem):
            if not elem.text or not elem.text.strip():
                elem.text = i + "  "
            if not elem.tail or not elem.tail.strip():
                elem.tail = i
            for elem in elem:
                self._indent(elem, level + 1)
            if not elem.tail or not elem.tail.strip():
                elem.tail = i
        else:
            if level and (not elem.tail or not elem.tail.strip()):
                elem.tail = i


class TallyExportService:
    """
    Service for managing Tally Prime exports
    """

    def __init__(self, tenant):
        self.tenant = tenant

    @transaction.atomic
    def create_voucher_export(self, integration: Integration, date_from, date_to,
                            user=None) -> TallyExport:
        """Create a new Tally voucher export"""

        # Get invoices in date range
        invoices = Invoice.objects.filter(
            tenant=self.tenant,
            date__gte=date_from,
            date__lte=date_to,
            invoice_type='taxable'
        ).select_related('client').prefetch_related('lines__item')

        # Create export record
        export = TallyExport.objects.create(
            tenant=self.tenant,
            integration=integration,
            export_type='vouchers',
            date_from=date_from,
            date_to=date_to,
            status='processing',
            created_by=user,
            export_metadata={
                'total_invoices': invoices.count(),
                'total_amount': sum(inv.grand_total for inv in invoices),
                'company_gstin': self.tenant.company_details.get('gstin', ''),
                'export_timestamp': datetime.now().isoformat()
            }
        )

        try:
            # Generate XML
            xml_generator = TallyXMLGenerator(self.tenant, integration)
            xml_content = xml_generator.generate_voucher_xml(list(invoices))

            # Save XML content
            export.xml_content = xml_content
            export.status = 'completed'
            export.save()

            logger.info(f"Tally export {export.id} completed for {invoices.count()} invoices")

        except Exception as e:
            export.status = 'failed'
            export.export_metadata['error'] = str(e)
            export.save()
            logger.error(f"Tally export {export.id} failed: {str(e)}")
            raise

        return export

    def get_export_status(self, export_id: str) -> Dict[str, Any]:
        """Get export status and metadata"""
        try:
            export = TallyExport.objects.get(id=export_id, tenant=self.tenant)
            return {
                'id': str(export.id),
                'status': export.status,
                'export_type': export.export_type,
                'date_from': export.date_from,
                'date_to': export.date_to,
                'metadata': export.export_metadata,
                'created_at': export.created_at,
                'updated_at': export.updated_at,
                'has_xml': bool(export.xml_content)
            }
        except TallyExport.DoesNotExist:
            return None

    def download_xml(self, export_id: str) -> Optional[str]:
        """Get XML content for download"""
        try:
            export = TallyExport.objects.get(id=export_id, tenant=self.tenant)
            if export.status == 'completed' and export.xml_content:
                return export.xml_content
        except TallyExport.DoesNotExist:
            pass
        return None

    def list_exports(self, limit: int = 20) -> List[Dict[str, Any]]:
        """List recent exports"""
        exports = TallyExport.objects.filter(
            tenant=self.tenant
        ).order_by('-created_at')[:limit]

        return [
            {
                'id': str(export.id),
                'export_type': export.export_type,
                'status': export.status,
                'date_from': export.date_from,
                'date_to': export.date_to,
                'metadata': export.export_metadata,
                'created_at': export.created_at
            }
            for export in exports
        ]