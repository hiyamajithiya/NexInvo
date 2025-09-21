"""
GST Compliance Engine for NexInvo
Implements Rule-46 validation and other GST compliance requirements
"""

from decimal import Decimal
from datetime import date, datetime
from typing import Dict, List, Any, Optional, Tuple
from django.core.exceptions import ValidationError
import re


class GSTComplianceEngine:
    """
    GST Compliance Engine implementing Rule-46 and other GST regulations
    """

    # GST Rate validations
    VALID_GST_RATES = [0, 0.25, 3, 5, 12, 18, 28]
    VALID_CESS_RATES = [0, 1, 2, 3, 4, 5, 10, 15, 20, 25, 50, 100, 200, 290, 400]

    # AATO (Aggregate Annual Turnover) threshold - 50 Lakhs
    AATO_THRESHOLD = 5000000

    # State codes mapping
    STATE_CODES = {
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
        '37': 'Andhra Pradesh', '38': 'Ladakh'
    }

    def __init__(self):
        self.errors = []
        self.warnings = []

    def validate_invoice_rule_46(self, invoice_data: Dict[str, Any]) -> Tuple[bool, List[str], List[str]]:
        """
        Validate invoice against GST Rule-46 mandatory requirements

        Args:
            invoice_data: Complete invoice data dictionary

        Returns:
            Tuple of (is_valid, errors, warnings)
        """
        self.errors = []
        self.warnings = []

        # Rule 46 mandatory fields validation
        self._validate_mandatory_fields(invoice_data)

        # GSTIN validations
        self._validate_gstin_format(invoice_data)

        # Invoice number and date validations
        self._validate_invoice_details(invoice_data)

        # Tax rate validations
        self._validate_tax_rates(invoice_data)

        # Place of supply validations
        self._validate_place_of_supply(invoice_data)

        # HSN/SAC validations
        self._validate_hsn_sac_codes(invoice_data)

        # Value validations
        self._validate_invoice_values(invoice_data)

        # B2B specific validations
        if invoice_data.get('client', {}).get('client_type') == 'b2b':
            self._validate_b2b_requirements(invoice_data)

        # AATO threshold checks
        self._validate_aato_compliance(invoice_data)

        return len(self.errors) == 0, self.errors, self.warnings

    def _validate_mandatory_fields(self, invoice_data: Dict[str, Any]):
        """Validate Rule-46 mandatory fields"""
        mandatory_fields = [
            'number', 'date', 'client', 'place_of_supply',
            'taxable_amount', 'total_tax', 'grand_total'
        ]

        for field in mandatory_fields:
            if not invoice_data.get(field):
                self.errors.append(f"Rule-46 violation: Missing mandatory field '{field}'")

        # Validate client details
        client = invoice_data.get('client', {})
        if client:
            if client.get('client_type') == 'b2b' and not client.get('gstin'):
                self.errors.append("Rule-46 violation: GSTIN required for B2B clients")

            if not client.get('name'):
                self.errors.append("Rule-46 violation: Client name is mandatory")

        # Validate invoice lines
        lines = invoice_data.get('lines', [])
        if not lines:
            self.errors.append("Rule-46 violation: Invoice must have at least one line item")

        for i, line in enumerate(lines, 1):
            if not line.get('description'):
                self.errors.append(f"Rule-46 violation: Line {i} missing description")
            if not line.get('hsn_sac'):
                self.errors.append(f"Rule-46 violation: Line {i} missing HSN/SAC code")
            if line.get('taxable_value', 0) <= 0:
                self.errors.append(f"Rule-46 violation: Line {i} taxable value must be positive")

    def _validate_gstin_format(self, invoice_data: Dict[str, Any]):
        """Validate GSTIN format compliance"""

        def validate_gstin(gstin: str, entity_name: str) -> bool:
            if not gstin:
                return True  # Optional for B2C

            # GSTIN format: 2 digits state code + 10 chars PAN + 1 char entity number + 1 char Z + 1 check digit
            gstin_pattern = r'^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}[Z]{1}[0-9A-Z]{1}$'

            if not re.match(gstin_pattern, gstin):
                self.errors.append(f"Invalid GSTIN format for {entity_name}: {gstin}")
                return False

            # Validate state code
            state_code = gstin[:2]
            if state_code not in self.STATE_CODES:
                self.errors.append(f"Invalid state code in GSTIN for {entity_name}: {state_code}")
                return False

            return True

        # Validate supplier GSTIN (tenant)
        tenant = invoice_data.get('tenant', {})
        if tenant and tenant.get('company_details', {}).get('gstin'):
            validate_gstin(tenant['company_details']['gstin'], 'Supplier')

        # Validate buyer GSTIN (client)
        client = invoice_data.get('client', {})
        if client and client.get('gstin'):
            validate_gstin(client['gstin'], 'Buyer')

    def _validate_invoice_details(self, invoice_data: Dict[str, Any]):
        """Validate invoice number and date"""

        # Invoice number validation
        invoice_number = invoice_data.get('number', '')
        if invoice_number:
            # Invoice number should not exceed 16 characters
            if len(invoice_number) > 16:
                self.errors.append("Invoice number exceeds 16 character limit")

            # Check for valid characters (alphanumeric and some special chars)
            if not re.match(r'^[A-Za-z0-9\-\/\\]+$', invoice_number):
                self.errors.append("Invoice number contains invalid characters")

        # Date validation
        invoice_date = invoice_data.get('date')
        if invoice_date:
            if isinstance(invoice_date, str):
                try:
                    invoice_date = datetime.strptime(invoice_date, '%Y-%m-%d').date()
                except ValueError:
                    self.errors.append("Invalid invoice date format")
                    return

            # Invoice date should not be in future
            if invoice_date > date.today():
                self.errors.append("Invoice date cannot be in future")

            # Check if invoice is older than permissible limit (typically 2 years)
            from datetime import timedelta
            if invoice_date < date.today() - timedelta(days=730):
                self.warnings.append("Invoice date is older than 2 years")

    def _validate_tax_rates(self, invoice_data: Dict[str, Any]):
        """Validate GST rates compliance"""

        lines = invoice_data.get('lines', [])
        for i, line in enumerate(lines, 1):
            # Validate individual tax rates
            cgst_rate = Decimal(str(line.get('cgst_rate', 0)))
            sgst_rate = Decimal(str(line.get('sgst_rate', 0)))
            igst_rate = Decimal(str(line.get('igst_rate', 0)))
            cess_rate = Decimal(str(line.get('cess_rate', 0)))

            # Check if rates are valid
            total_gst = cgst_rate + sgst_rate + igst_rate

            if total_gst not in [Decimal(str(rate)) for rate in self.VALID_GST_RATES]:
                self.errors.append(f"Line {i}: Invalid GST rate {total_gst}%")

            if float(cess_rate) not in self.VALID_CESS_RATES:
                self.errors.append(f"Line {i}: Invalid CESS rate {cess_rate}%")

            # Validate CGST+SGST vs IGST logic
            client_state = invoice_data.get('client', {}).get('state_code', '')
            place_of_supply = invoice_data.get('place_of_supply', '')

            if client_state == place_of_supply:
                # Intra-state: CGST + SGST, no IGST
                if igst_rate > 0:
                    self.errors.append(f"Line {i}: IGST not applicable for intra-state supply")
                if cgst_rate != sgst_rate:
                    self.errors.append(f"Line {i}: CGST and SGST rates must be equal for intra-state supply")
            else:
                # Inter-state: IGST only, no CGST/SGST
                if cgst_rate > 0 or sgst_rate > 0:
                    self.errors.append(f"Line {i}: CGST/SGST not applicable for inter-state supply")
                if igst_rate == 0 and total_gst > 0:
                    self.errors.append(f"Line {i}: IGST required for inter-state supply")

    def _validate_place_of_supply(self, invoice_data: Dict[str, Any]):
        """Validate place of supply rules"""

        place_of_supply = invoice_data.get('place_of_supply', '')

        if not place_of_supply:
            self.errors.append("Place of supply is mandatory")
            return

        if place_of_supply not in self.STATE_CODES:
            self.errors.append(f"Invalid place of supply code: {place_of_supply}")

        # For B2B transactions, validate against client's location
        client = invoice_data.get('client', {})
        if client and client.get('client_type') == 'b2b':
            client_state = client.get('state_code', '')

            # For goods supply, place of supply is typically delivery location
            # For services, it's typically recipient's location
            lines = invoice_data.get('lines', [])
            has_goods = any(not line.get('is_service', False) for line in lines)
            has_services = any(line.get('is_service', False) for line in lines)

            if has_goods and has_services:
                self.warnings.append("Mixed supply (goods + services) requires careful place of supply determination")

    def _validate_hsn_sac_codes(self, invoice_data: Dict[str, Any]):
        """Validate HSN/SAC code compliance"""

        lines = invoice_data.get('lines', [])
        for i, line in enumerate(lines, 1):
            hsn_sac = line.get('hsn_sac', '')
            is_service = line.get('is_service', False)

            if not hsn_sac:
                self.errors.append(f"Line {i}: HSN/SAC code is mandatory")
                continue

            # HSN for goods (minimum 4 digits, can be 6 or 8)
            # SAC for services (6 digits)
            if is_service:
                if not re.match(r'^\d{6}$', hsn_sac):
                    self.errors.append(f"Line {i}: Invalid SAC code format. Must be 6 digits")
            else:
                if not re.match(r'^\d{4}(\d{2})?(\d{2})?$', hsn_sac):
                    self.errors.append(f"Line {i}: Invalid HSN code format. Must be 4, 6, or 8 digits")

                # For turnover > 5 crores, 6-digit HSN is mandatory
                tenant = invoice_data.get('tenant', {})
                if tenant and tenant.get('aato_threshold', 0) > 50000000:  # 5 crores
                    if len(hsn_sac) < 6:
                        self.errors.append(f"Line {i}: 6-digit HSN mandatory for turnover > 5 crores")

    def _validate_invoice_values(self, invoice_data: Dict[str, Any]):
        """Validate invoice value calculations"""

        # Validate individual line calculations
        lines = invoice_data.get('lines', [])
        calculated_subtotal = Decimal('0')
        calculated_tax_total = Decimal('0')

        for i, line in enumerate(lines, 1):
            quantity = Decimal(str(line.get('quantity', 0)))
            rate = Decimal(str(line.get('rate', 0)))
            discount_percent = Decimal(str(line.get('discount_percent', 0)))
            discount_amount = Decimal(str(line.get('discount_amount', 0)))

            # Calculate expected values
            line_amount = quantity * rate
            if discount_percent > 0:
                expected_discount = line_amount * discount_percent / 100
            else:
                expected_discount = discount_amount

            expected_taxable = line_amount - expected_discount

            # Validate against actual values
            actual_taxable = Decimal(str(line.get('taxable_value', 0)))
            if abs(expected_taxable - actual_taxable) > Decimal('0.01'):
                self.errors.append(f"Line {i}: Taxable value calculation error. Expected: {expected_taxable}, Actual: {actual_taxable}")

            # Calculate tax amounts
            cgst_amount = Decimal(str(line.get('cgst_amount', 0)))
            sgst_amount = Decimal(str(line.get('sgst_amount', 0)))
            igst_amount = Decimal(str(line.get('igst_amount', 0)))
            cess_amount = Decimal(str(line.get('cess_amount', 0)))

            line_tax_total = cgst_amount + sgst_amount + igst_amount + cess_amount
            expected_line_total = actual_taxable + line_tax_total
            actual_line_total = Decimal(str(line.get('line_total', 0)))

            if abs(expected_line_total - actual_line_total) > Decimal('0.01'):
                self.errors.append(f"Line {i}: Line total calculation error")

            calculated_subtotal += actual_taxable
            calculated_tax_total += line_tax_total

        # Validate invoice totals
        invoice_subtotal = Decimal(str(invoice_data.get('taxable_amount', 0)))
        invoice_tax_total = Decimal(str(invoice_data.get('total_tax', 0)))

        if abs(calculated_subtotal - invoice_subtotal) > Decimal('0.01'):
            self.errors.append("Invoice subtotal calculation error")

        if abs(calculated_tax_total - invoice_tax_total) > Decimal('0.01'):
            self.errors.append("Invoice tax total calculation error")

    def _validate_b2b_requirements(self, invoice_data: Dict[str, Any]):
        """Validate B2B specific requirements"""

        client = invoice_data.get('client', {})

        # GSTIN mandatory for B2B
        if not client.get('gstin'):
            self.errors.append("GSTIN is mandatory for B2B transactions")

        # Complete address required
        billing_address = client.get('billing_address', {})
        required_address_fields = ['address_line1', 'city', 'state', 'pincode']

        for field in required_address_fields:
            if not billing_address.get(field):
                self.errors.append(f"B2B requirement: Client {field} is mandatory")

        # State code validation
        if not client.get('state_code'):
            self.errors.append("B2B requirement: Client state code is mandatory")

    def _validate_aato_compliance(self, invoice_data: Dict[str, Any]):
        """Validate AATO (Aggregate Annual Turnover) compliance"""

        tenant = invoice_data.get('tenant', {})
        aato_threshold = tenant.get('aato_threshold', self.AATO_THRESHOLD)

        invoice_value = Decimal(str(invoice_data.get('grand_total', 0)))

        # High-value transaction warnings
        if invoice_value > 50000:  # 50K threshold for additional scrutiny
            self.warnings.append("High-value transaction: Additional documentation may be required")

        if invoice_value > 200000:  # 2 Lakh threshold
            self.warnings.append("Transaction above Rs.2 Lakh: Enhanced compliance requirements apply")

        # E-invoice mandatory check
        if invoice_value >= 50000 and tenant.get('e_invoice_enabled', False):
            if not invoice_data.get('einvoice_details'):
                self.warnings.append("E-invoice generation recommended for transactions >= Rs.50,000")

    def generate_compliance_report(self, invoice_data: Dict[str, Any]) -> Dict[str, Any]:
        """Generate comprehensive compliance report"""

        is_valid, errors, warnings = self.validate_invoice_rule_46(invoice_data)

        report = {
            'invoice_number': invoice_data.get('number', 'Unknown'),
            'validation_timestamp': datetime.now().isoformat(),
            'is_compliant': is_valid,
            'compliance_score': self._calculate_compliance_score(errors, warnings),
            'rule_46_status': 'COMPLIANT' if is_valid else 'NON_COMPLIANT',
            'errors': errors,
            'warnings': warnings,
            'recommendations': self._generate_recommendations(errors, warnings),
            'applicable_regulations': self._get_applicable_regulations(invoice_data),
            'next_review_date': self._calculate_next_review_date(invoice_data)
        }

        return report

    def _calculate_compliance_score(self, errors: List[str], warnings: List[str]) -> int:
        """Calculate compliance score (0-100)"""
        error_penalty = len(errors) * 10
        warning_penalty = len(warnings) * 2

        score = max(0, 100 - error_penalty - warning_penalty)
        return score

    def _generate_recommendations(self, errors: List[str], warnings: List[str]) -> List[str]:
        """Generate actionable recommendations"""
        recommendations = []

        if any('GSTIN' in error for error in errors):
            recommendations.append("Verify and update GSTIN details for all parties")

        if any('HSN' in error or 'SAC' in error for error in errors):
            recommendations.append("Review and correct HSN/SAC codes as per latest GST classification")

        if any('rate' in error.lower() for error in errors):
            recommendations.append("Verify GST rates against current rate notifications")

        if any('calculation' in error.lower() for error in errors):
            recommendations.append("Review calculation logic and ensure accuracy")

        if warnings:
            recommendations.append("Address warnings to improve compliance posture")

        return recommendations

    def _get_applicable_regulations(self, invoice_data: Dict[str, Any]) -> List[str]:
        """Get list of applicable GST regulations"""
        regulations = ['GST Rule 46', 'CGST Act 2017']

        invoice_value = Decimal(str(invoice_data.get('grand_total', 0)))

        if invoice_value >= 50000:
            regulations.append('E-invoice Rules')

        if invoice_data.get('client', {}).get('client_type') == 'b2b':
            regulations.append('B2B Transaction Rules')

        return regulations

    def _calculate_next_review_date(self, invoice_data: Dict[str, Any]) -> str:
        """Calculate next compliance review date"""
        from datetime import timedelta

        # High-value invoices need more frequent review
        invoice_value = Decimal(str(invoice_data.get('grand_total', 0)))

        if invoice_value >= 200000:
            next_review = date.today() + timedelta(days=30)
        elif invoice_value >= 50000:
            next_review = date.today() + timedelta(days=90)
        else:
            next_review = date.today() + timedelta(days=180)

        return next_review.isoformat()


# Utility functions for compliance checks
def validate_gst_number(gstin: str) -> bool:
    """Validate GSTIN using checksum algorithm"""
    if not gstin or len(gstin) != 15:
        return False

    # Check basic format first
    pattern = r'^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}[Z]{1}[0-9A-Z]{1}$'
    if not re.match(pattern, gstin):
        return False

    # Validate state code
    state_code = gstin[:2]
    valid_state_codes = GSTComplianceEngine.STATE_CODES.keys()
    if state_code not in valid_state_codes:
        return False

    return True


def get_hsn_tax_rate(hsn_code: str) -> Optional[Decimal]:
    """Get standard tax rate for HSN code (simplified mapping)"""

    # This is a simplified mapping - production would use comprehensive HSN database
    hsn_tax_mapping = {
        '1001': 0,      # Wheat
        '1006': 0,      # Rice
        '8523': 28,     # Software media
        '9983': 18,     # Professional services
        '9984': 18,     # Legal services
        '9985': 18,     # Accounting services
    }

    # Try exact match first
    if hsn_code in hsn_tax_mapping:
        return Decimal(str(hsn_tax_mapping[hsn_code]))

    # Try 4-digit match for 6/8 digit codes
    if len(hsn_code) > 4:
        hsn_4 = hsn_code[:4]
        if hsn_4 in hsn_tax_mapping:
            return Decimal(str(hsn_tax_mapping[hsn_4]))

    return None


def is_exempt_category(hsn_sac: str) -> bool:
    """Check if HSN/SAC falls under exempt category"""

    exempt_categories = [
        '1001', '1002', '1003', '1004', '1005', '1006',  # Basic food grains
        '0401', '0402', '0403', '0404',  # Milk and dairy (basic)
        '9991',  # Services by Government
    ]

    return hsn_sac in exempt_categories or hsn_sac.startswith(tuple(exempt_categories))