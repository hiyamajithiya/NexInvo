"""
Tally Prime XML Integration for NexInvo
Generates Tally-compliant XML for invoice export
"""

import xml.etree.ElementTree as ET
from xml.dom import minidom
from typing import Dict, List, Any, Optional
from decimal import Decimal
from datetime import datetime
import logging

from invoices.models import Invoice, InvoiceLine
from tenants.models import Tenant

logger = logging.getLogger(__name__)


class TallyXMLGenerator:
    """
    Generates Tally Prime compatible XML for invoice export
    """

    def __init__(self):
        self.version = "1.0"
        self.encoding = "UTF-8"

    def generate_invoice_xml(self, invoice: Invoice) -> str:
        """
        Generate Tally XML for a single invoice

        Args:
            invoice: Invoice instance to export

        Returns:
            XML string in Tally format
        """
        try:
            # Create root envelope
            envelope = ET.Element("ENVELOPE")

            # Add header
            self._add_header(envelope)

            # Add body with voucher
            body = ET.SubElement(envelope, "BODY")
            import_data = ET.SubElement(body, "IMPORTDATA")
            request_desc = ET.SubElement(import_data, "REQUESTDESC")
            report_name = ET.SubElement(request_desc, "REPORTNAME")
            report_name.text = "Vouchers"

            request_data = ET.SubElement(import_data, "REQUESTDATA")

            # Add voucher
            self._add_voucher(request_data, invoice)

            # Convert to string with proper formatting
            xml_str = self._prettify_xml(envelope)

            return xml_str

        except Exception as e:
            logger.error(f"Error generating Tally XML for invoice {invoice.number}: {str(e)}")
            raise

    def generate_bulk_xml(self, invoices: List[Invoice]) -> str:
        """
        Generate Tally XML for multiple invoices

        Args:
            invoices: List of Invoice instances

        Returns:
            XML string with all invoices
        """
        try:
            # Create root envelope
            envelope = ET.Element("ENVELOPE")

            # Add header
            self._add_header(envelope)

            # Add body
            body = ET.SubElement(envelope, "BODY")
            import_data = ET.SubElement(body, "IMPORTDATA")
            request_desc = ET.SubElement(import_data, "REQUESTDESC")
            report_name = ET.SubElement(request_desc, "REPORTNAME")
            report_name.text = "Vouchers"

            request_data = ET.SubElement(import_data, "REQUESTDATA")

            # Add all vouchers
            for invoice in invoices:
                self._add_voucher(request_data, invoice)

            # Convert to string
            xml_str = self._prettify_xml(envelope)

            return xml_str

        except Exception as e:
            logger.error(f"Error generating bulk Tally XML: {str(e)}")
            raise

    def _add_header(self, envelope: ET.Element):
        """Add Tally XML header elements"""
        header = ET.SubElement(envelope, "HEADER")

        tally_request = ET.SubElement(header, "TALLYREQUEST")
        tally_request.text = "Import Data"

        version = ET.SubElement(header, "VERSION")
        version.text = "1"

    def _add_voucher(self, parent: ET.Element, invoice: Invoice):
        """
        Add voucher element for an invoice

        Args:
            parent: Parent XML element
            invoice: Invoice instance
        """
        tallymessage = ET.SubElement(parent, "TALLYMESSAGE")
        tallymessage.set("xmlns:UDF", "TallyUDF")

        voucher = ET.SubElement(tallymessage, "VOUCHER")
        voucher.set("REMOTEID", f"INV-{invoice.id}")
        voucher.set("VCHTYPE", "Sales")
        voucher.set("ACTION", "Create")
        voucher.set("OBJVIEW", "Invoice Voucher View")

        # Basic voucher details
        date_elem = ET.SubElement(voucher, "DATE")
        date_elem.text = invoice.date.strftime("%Y%m%d")

        guid = ET.SubElement(voucher, "GUID")
        guid.text = str(invoice.id)

        narration = ET.SubElement(voucher, "NARRATION")
        narration.text = f"Invoice {invoice.number} - {invoice.notes or ''}"

        vouchertypename = ET.SubElement(voucher, "VOUCHERTYPENAME")
        vouchertypename.text = "Sales"

        reference = ET.SubElement(voucher, "REFERENCE")
        reference.text = invoice.number

        vouchernumber = ET.SubElement(voucher, "VOUCHERNUMBER")
        vouchernumber.text = invoice.number

        # Party details
        partyname = ET.SubElement(voucher, "PARTYNAME")
        partyname.text = self._get_party_ledger_name(invoice.client.name, invoice.client.gstin)

        # GST details if applicable
        if invoice.client.gstin:
            self._add_gst_details(voucher, invoice)

        # Effective date
        effectivedate = ET.SubElement(voucher, "EFFECTIVEDATE")
        effectivedate.text = invoice.date.strftime("%Y%m%d")

        # Persisted view
        persistedview = ET.SubElement(voucher, "PERSISTEDVIEW")
        persistedview.text = "Invoice Voucher View"

        # Place of supply
        placeofsupply = ET.SubElement(voucher, "PLACEOFSUPPLY")
        placeofsupply.text = invoice.place_of_supply or ""

        # Basic buyer details
        basicbuyername = ET.SubElement(voucher, "BASICBUYERNAME")
        basicbuyername.text = invoice.client.name

        # Add ledger entries
        self._add_ledger_entries(voucher, invoice)

        # Add inventory entries for items
        self._add_inventory_entries(voucher, invoice)

    def _add_gst_details(self, voucher: ET.Element, invoice: Invoice):
        """Add GST-specific details to voucher"""

        # GST registration details
        gstin = ET.SubElement(voucher, "GSTIN")
        gstin.text = invoice.client.gstin

        # State code
        statename = ET.SubElement(voucher, "STATENAME")
        state_name = self._get_state_name(invoice.client.state_code)
        statename.text = state_name

        # GST registration type
        gstregistrationtype = ET.SubElement(voucher, "GSTREGISTRATIONTYPE")
        gstregistrationtype.text = "Regular" if invoice.client.client_type == "b2b" else "Consumer"

        # Consignee details (same as buyer for regular sales)
        consigneename = ET.SubElement(voucher, "CONSIGNEENAME")
        consigneename.text = invoice.client.name

        consigneegstin = ET.SubElement(voucher, "CONSIGNEEGSTIN")
        consigneegstin.text = invoice.client.gstin or ""

    def _add_ledger_entries(self, voucher: ET.Element, invoice: Invoice):
        """Add ledger entries for the invoice"""

        # Customer ledger (debit entry)
        all_ledger_entries = ET.SubElement(voucher, "ALLLEDGERENTRIES.LIST")

        ledgername = ET.SubElement(all_ledger_entries, "LEDGERNAME")
        ledgername.text = self._get_party_ledger_name(invoice.client.name, invoice.client.gstin)

        isdeemedpositive = ET.SubElement(all_ledger_entries, "ISDEEMEDPOSITIVE")
        isdeemedpositive.text = "Yes"

        ledgerfromitem = ET.SubElement(all_ledger_entries, "LEDGERFROMITEM")
        ledgerfromitem.text = "No"

        amount = ET.SubElement(all_ledger_entries, "AMOUNT")
        amount.text = str(-float(invoice.grand_total))  # Negative for debit

        # Sales ledger (credit entry)
        sales_ledger = ET.SubElement(voucher, "ALLLEDGERENTRIES.LIST")

        sales_ledgername = ET.SubElement(sales_ledger, "LEDGERNAME")
        sales_ledgername.text = "Sales Account"

        sales_isdeemedpositive = ET.SubElement(sales_ledger, "ISDEEMEDPOSITIVE")
        sales_isdeemedpositive.text = "No"

        sales_amount = ET.SubElement(sales_ledger, "AMOUNT")
        sales_amount.text = str(float(invoice.taxable_amount))

        # Add tax ledgers
        self._add_tax_ledgers(voucher, invoice)

    def _add_tax_ledgers(self, voucher: ET.Element, invoice: Invoice):
        """Add tax ledger entries (CGST, SGST, IGST)"""

        # Calculate total taxes
        total_cgst = Decimal('0')
        total_sgst = Decimal('0')
        total_igst = Decimal('0')
        total_cess = Decimal('0')

        for line in invoice.lines.all():
            total_cgst += line.cgst_amount
            total_sgst += line.sgst_amount
            total_igst += line.igst_amount
            total_cess += line.cess_amount

        # Add CGST ledger if applicable
        if total_cgst > 0:
            cgst_ledger = ET.SubElement(voucher, "ALLLEDGERENTRIES.LIST")
            cgst_name = ET.SubElement(cgst_ledger, "LEDGERNAME")
            cgst_name.text = "Output CGST"
            cgst_deemed = ET.SubElement(cgst_ledger, "ISDEEMEDPOSITIVE")
            cgst_deemed.text = "No"
            cgst_amount = ET.SubElement(cgst_ledger, "AMOUNT")
            cgst_amount.text = str(float(total_cgst))

        # Add SGST ledger if applicable
        if total_sgst > 0:
            sgst_ledger = ET.SubElement(voucher, "ALLLEDGERENTRIES.LIST")
            sgst_name = ET.SubElement(sgst_ledger, "LEDGERNAME")
            sgst_name.text = "Output SGST"
            sgst_deemed = ET.SubElement(sgst_ledger, "ISDEEMEDPOSITIVE")
            sgst_deemed.text = "No"
            sgst_amount = ET.SubElement(sgst_ledger, "AMOUNT")
            sgst_amount.text = str(float(total_sgst))

        # Add IGST ledger if applicable
        if total_igst > 0:
            igst_ledger = ET.SubElement(voucher, "ALLLEDGERENTRIES.LIST")
            igst_name = ET.SubElement(igst_ledger, "LEDGERNAME")
            igst_name.text = "Output IGST"
            igst_deemed = ET.SubElement(igst_ledger, "ISDEEMEDPOSITIVE")
            igst_deemed.text = "No"
            igst_amount = ET.SubElement(igst_ledger, "AMOUNT")
            igst_amount.text = str(float(total_igst))

        # Add Cess ledger if applicable
        if total_cess > 0:
            cess_ledger = ET.SubElement(voucher, "ALLLEDGERENTRIES.LIST")
            cess_name = ET.SubElement(cess_ledger, "LEDGERNAME")
            cess_name.text = "Output Cess"
            cess_deemed = ET.SubElement(cess_ledger, "ISDEEMEDPOSITIVE")
            cess_deemed.text = "No"
            cess_amount = ET.SubElement(cess_ledger, "AMOUNT")
            cess_amount.text = str(float(total_cess))

    def _add_inventory_entries(self, voucher: ET.Element, invoice: Invoice):
        """Add inventory entries for invoice line items"""

        for line in invoice.lines.all():
            inventory_entry = ET.SubElement(voucher, "ALLINVENTORYENTRIES.LIST")

            # Stock item name
            stockitemname = ET.SubElement(inventory_entry, "STOCKITEMNAME")
            stockitemname.text = line.description

            # HSN/SAC code
            if line.hsn_sac:
                hsn = ET.SubElement(inventory_entry, "HSNCODE")
                hsn.text = line.hsn_sac

            # Quantity
            actualqty = ET.SubElement(inventory_entry, "ACTUALQTY")
            actualqty.text = f"{float(line.quantity)} {line.uqc or 'NOS'}"

            billedqty = ET.SubElement(inventory_entry, "BILLEDQTY")
            billedqty.text = f"{float(line.quantity)} {line.uqc or 'NOS'}"

            # Rate
            rate = ET.SubElement(inventory_entry, "RATE")
            rate.text = f"{float(line.rate)}/{line.uqc or 'NOS'}"

            # Amount
            amount = ET.SubElement(inventory_entry, "AMOUNT")
            amount.text = str(-float(line.taxable_value))  # Negative for sales

            # Discount if applicable
            if line.discount_amount > 0:
                discount = ET.SubElement(inventory_entry, "DISCOUNT")
                discount.text = str(float(line.discount_amount))

            # Tax details
            if line.cgst_amount > 0 or line.sgst_amount > 0 or line.igst_amount > 0:
                self._add_item_tax_details(inventory_entry, line)

    def _add_item_tax_details(self, inventory_entry: ET.Element, line: InvoiceLine):
        """Add tax details for inventory item"""

        # Batch allocations for tax
        batch_allocations = ET.SubElement(inventory_entry, "BATCHALLOCATIONS.LIST")

        if line.cgst_rate > 0:
            cgst = ET.SubElement(batch_allocations, "CGSTRATE")
            cgst.text = str(float(line.cgst_rate))

        if line.sgst_rate > 0:
            sgst = ET.SubElement(batch_allocations, "SGSTRATE")
            sgst.text = str(float(line.sgst_rate))

        if line.igst_rate > 0:
            igst = ET.SubElement(batch_allocations, "IGSTRATE")
            igst.text = str(float(line.igst_rate))

        if line.cess_rate > 0:
            cess = ET.SubElement(batch_allocations, "CESSRATE")
            cess.text = str(float(line.cess_rate))

    def _get_party_ledger_name(self, name: str, gstin: Optional[str]) -> str:
        """
        Get formatted party ledger name for Tally

        Args:
            name: Client name
            gstin: Client GSTIN (optional)

        Returns:
            Formatted ledger name
        """
        if gstin:
            return f"{name} ({gstin})"
        return name

    def _get_state_name(self, state_code: str) -> str:
        """
        Get state name from state code

        Args:
            state_code: 2-digit state code

        Returns:
            State name
        """
        state_mapping = {
            "01": "Jammu and Kashmir",
            "02": "Himachal Pradesh",
            "03": "Punjab",
            "04": "Chandigarh",
            "05": "Uttarakhand",
            "06": "Haryana",
            "07": "Delhi",
            "08": "Rajasthan",
            "09": "Uttar Pradesh",
            "10": "Bihar",
            "11": "Sikkim",
            "12": "Arunachal Pradesh",
            "13": "Nagaland",
            "14": "Manipur",
            "15": "Mizoram",
            "16": "Tripura",
            "17": "Meghalaya",
            "18": "Assam",
            "19": "West Bengal",
            "20": "Jharkhand",
            "21": "Odisha",
            "22": "Chattisgarh",
            "23": "Madhya Pradesh",
            "24": "Gujarat",
            "25": "Daman and Diu",
            "26": "Dadra and Nagar Haveli",
            "27": "Maharashtra",
            "28": "Andhra Pradesh",
            "29": "Karnataka",
            "30": "Goa",
            "31": "Lakshadweep",
            "32": "Kerala",
            "33": "Tamil Nadu",
            "34": "Puducherry",
            "35": "Andaman and Nicobar Islands",
            "36": "Telangana",
            "37": "Andhra Pradesh (New)",
        }

        return state_mapping.get(state_code, "Unknown State")

    def _prettify_xml(self, elem: ET.Element) -> str:
        """
        Return a pretty-printed XML string for the Element

        Args:
            elem: XML Element

        Returns:
            Pretty-printed XML string
        """
        rough_string = ET.tostring(elem, encoding='unicode')
        reparsed = minidom.parseString(rough_string)

        # Add XML declaration
        xml_declaration = '<?xml version="1.0" encoding="UTF-8"?>\n'
        pretty_xml = reparsed.toprettyxml(indent="  ", encoding=None)

        # Remove extra blank lines
        lines = pretty_xml.split('\n')
        non_empty_lines = [line for line in lines if line.strip()]

        return xml_declaration + '\n'.join(non_empty_lines[1:])  # Skip the first declaration line


class TallyPrimeIntegration:
    """
    Main Tally Prime integration class
    """

    def __init__(self):
        self.xml_generator = TallyXMLGenerator()

    def export_invoice(self, invoice: Invoice) -> Dict[str, Any]:
        """
        Export single invoice to Tally XML format

        Args:
            invoice: Invoice instance

        Returns:
            Dictionary with XML content and metadata
        """
        try:
            xml_content = self.xml_generator.generate_invoice_xml(invoice)

            return {
                'success': True,
                'xml_content': xml_content,
                'filename': f"Invoice_{invoice.number}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xml",
                'invoice_number': invoice.number,
                'invoice_id': str(invoice.id)
            }

        except Exception as e:
            logger.error(f"Failed to export invoice {invoice.number}: {str(e)}")
            return {
                'success': False,
                'error': str(e),
                'invoice_number': invoice.number
            }

    def export_bulk(self, invoices: List[Invoice]) -> Dict[str, Any]:
        """
        Export multiple invoices to Tally XML format

        Args:
            invoices: List of Invoice instances

        Returns:
            Dictionary with XML content and metadata
        """
        try:
            xml_content = self.xml_generator.generate_bulk_xml(invoices)

            invoice_numbers = [inv.number for inv in invoices]

            return {
                'success': True,
                'xml_content': xml_content,
                'filename': f"Invoices_Bulk_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xml",
                'invoice_count': len(invoices),
                'invoice_numbers': invoice_numbers
            }

        except Exception as e:
            logger.error(f"Failed to export bulk invoices: {str(e)}")
            return {
                'success': False,
                'error': str(e),
                'invoice_count': 0
            }

    def validate_export(self, xml_content: str) -> Dict[str, Any]:
        """
        Validate Tally XML content

        Args:
            xml_content: XML string to validate

        Returns:
            Validation result dictionary
        """
        try:
            # Parse XML to check validity
            root = ET.fromstring(xml_content)

            # Check for required elements
            vouchers = root.findall(".//VOUCHER")

            return {
                'valid': True,
                'voucher_count': len(vouchers),
                'message': f"Valid Tally XML with {len(vouchers)} vouchers"
            }

        except ET.ParseError as e:
            return {
                'valid': False,
                'error': f"XML parsing error: {str(e)}",
                'message': "Invalid XML format"
            }
        except Exception as e:
            return {
                'valid': False,
                'error': str(e),
                'message': "Validation failed"
            }