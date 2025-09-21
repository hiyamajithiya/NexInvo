#!/usr/bin/env python3
"""
Test script for GST Compliance Engine
"""
import os
import sys
import django
import json
from decimal import Decimal

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'nexinvo.settings')
django.setup()

from invoices.gst_compliance import GSTComplianceEngine, validate_gst_number, get_hsn_tax_rate


def test_gstin_validation():
    """Test GSTIN validation functionality"""
    print("Testing GSTIN Validation")
    print("=" * 40)

    test_cases = [
        {
            'gstin': '27ABCDE1234F1Z5',
            'description': 'Valid GSTIN format',
            'expected': True
        },
        {
            'gstin': '07AABCU9603R1ZX',
            'description': 'Valid GSTIN (real format)',
            'expected': True
        },
        {
            'gstin': '123456789012345',
            'description': 'Invalid GSTIN (all numbers)',
            'expected': False
        },
        {
            'gstin': '27ABCDE1234F1Z',
            'description': 'Invalid GSTIN (short)',
            'expected': False
        },
        {
            'gstin': '99ABCDE1234F1Z5',
            'description': 'Invalid state code',
            'expected': False
        }
    ]

    for test_case in test_cases:
        result = validate_gst_number(test_case['gstin'])
        status = "PASS" if result == test_case['expected'] else "FAIL"
        print(f"{status}: {test_case['description']} - {test_case['gstin']} -> {result}")

    print()


def test_hsn_rate_lookup():
    """Test HSN/SAC rate lookup"""
    print("Testing HSN/SAC Rate Lookup")
    print("=" * 40)

    test_cases = [
        ('1001', 'Wheat - should be 0%'),
        ('8523', 'Software media - should be 28%'),
        ('9983', 'Professional services - should be 18%'),
        ('0000', 'Unknown HSN - should be None')
    ]

    for hsn, description in test_cases:
        rate = get_hsn_tax_rate(hsn)
        print(f"{description}: {hsn} -> {rate}%")

    print()


def test_compliance_validation():
    """Test comprehensive compliance validation"""
    print("Testing GST Compliance Validation")
    print("=" * 40)

    # Test case 1: Valid B2B Invoice
    valid_invoice = {
        'number': 'INV001',
        'date': '2025-09-20',
        'client': {
            'name': 'Valid Client Ltd',
            'client_type': 'b2b',
            'gstin': '27ABCDE1234F1Z5',
            'state_code': '27',
            'billing_address': {
                'address_line1': '123 Test Street',
                'city': 'Mumbai',
                'state': 'Maharashtra',
                'pincode': '400001'
            }
        },
        'tenant': {
            'company_details': {
                'gstin': '27XYZPQ9876R1Z1',
                'state_code': '27'
            },
            'aato_threshold': 5000000,
            'e_invoice_enabled': True
        },
        'place_of_supply': '27',
        'taxable_amount': 10000,
        'total_tax': 1800,
        'grand_total': 11800,
        'lines': [
            {
                'description': 'Software Development Service',
                'hsn_sac': '998314',
                'quantity': 1,
                'rate': 10000,
                'discount_percent': 0,
                'discount_amount': 0,
                'taxable_value': 10000,
                'cgst_rate': 9,
                'sgst_rate': 9,
                'igst_rate': 0,
                'cess_rate': 0,
                'cgst_amount': 900,
                'sgst_amount': 900,
                'igst_amount': 0,
                'cess_amount': 0,
                'line_total': 11800,
                'is_service': True
            }
        ]
    }

    # Test case 2: Invalid invoice with multiple issues
    invalid_invoice = {
        'number': '',  # Missing invoice number
        'date': '2025-09-20',
        'client': {
            'name': '',  # Missing client name
            'client_type': 'b2b',
            'gstin': 'INVALID_GSTIN',  # Invalid GSTIN
            'state_code': '27',
            'billing_address': {}  # Incomplete address
        },
        'tenant': {
            'company_details': {
                'gstin': '27XYZPQ9876R1Z1',
                'state_code': '27'
            },
            'aato_threshold': 5000000,
            'e_invoice_enabled': True
        },
        'place_of_supply': '27',
        'taxable_amount': 10000,
        'total_tax': 2800,  # Wrong tax calculation
        'grand_total': 12800,
        'lines': [
            {
                'description': '',  # Missing description
                'hsn_sac': '',  # Missing HSN
                'quantity': 1,
                'rate': 10000,
                'discount_percent': 0,
                'discount_amount': 0,
                'taxable_value': 10000,
                'cgst_rate': 15,  # Invalid rate
                'sgst_rate': 13,  # Invalid rate combination
                'igst_rate': 0,
                'cess_rate': 0,
                'cgst_amount': 1500,
                'sgst_amount': 1300,
                'igst_amount': 0,
                'cess_amount': 0,
                'line_total': 12800,
                'is_service': True
            }
        ]
    }

    engine = GSTComplianceEngine()

    print("Test 1: Valid Invoice")
    is_valid, errors, warnings = engine.validate_invoice_rule_46(valid_invoice)
    print(f"Valid: {is_valid}")
    if errors:
        print("Errors:")
        for error in errors:
            print(f"  - {error}")
    if warnings:
        print("Warnings:")
        for warning in warnings:
            print(f"  - {warning}")

    print("\nTest 2: Invalid Invoice")
    is_valid, errors, warnings = engine.validate_invoice_rule_46(invalid_invoice)
    print(f"Valid: {is_valid}")
    if errors:
        print("Errors:")
        for error in errors:
            print(f"  - {error}")
    if warnings:
        print("Warnings:")
        for warning in warnings:
            print(f"  - {warning}")

    print()


def test_compliance_report():
    """Test compliance report generation"""
    print("Testing Compliance Report Generation")
    print("=" * 40)

    sample_invoice = {
        'number': 'INV001',
        'date': '2025-09-20',
        'client': {
            'name': 'Test Client',
            'client_type': 'b2b',
            'gstin': '27ABCDE1234F1Z5',
            'state_code': '06',  # Different state for inter-state
            'billing_address': {
                'address_line1': '123 Test Street',
                'city': 'Delhi',
                'state': 'Delhi',
                'pincode': '110001'
            }
        },
        'tenant': {
            'company_details': {
                'gstin': '27XYZPQ9876R1Z1',
                'state_code': '27'
            },
            'aato_threshold': 5000000,
            'e_invoice_enabled': True
        },
        'place_of_supply': '27',
        'taxable_amount': 250000,  # High value invoice
        'total_tax': 45000,
        'grand_total': 295000,
        'lines': [
            {
                'description': 'Consulting Service',
                'hsn_sac': '998314',
                'quantity': 1,
                'rate': 250000,
                'discount_percent': 0,
                'discount_amount': 0,
                'taxable_value': 250000,
                'cgst_rate': 0,
                'sgst_rate': 0,
                'igst_rate': 18,  # Inter-state
                'cess_rate': 0,
                'cgst_amount': 0,
                'sgst_amount': 0,
                'igst_amount': 45000,
                'cess_amount': 0,
                'line_total': 295000,
                'is_service': True
            }
        ]
    }

    engine = GSTComplianceEngine()
    report = engine.generate_compliance_report(sample_invoice)

    print("Generated Compliance Report:")
    print(f"Invoice Number: {report['invoice_number']}")
    print(f"Compliance Status: {report['rule_46_status']}")
    print(f"Compliance Score: {report['compliance_score']}/100")
    print(f"Is Compliant: {report['is_compliant']}")

    if report['errors']:
        print("\nErrors:")
        for error in report['errors']:
            print(f"  - {error}")

    if report['warnings']:
        print("\nWarnings:")
        for warning in report['warnings']:
            print(f"  - {warning}")

    if report['recommendations']:
        print("\nRecommendations:")
        for rec in report['recommendations']:
            print(f"  - {rec}")

    print(f"\nApplicable Regulations: {', '.join(report['applicable_regulations'])}")
    print(f"Next Review Date: {report['next_review_date']}")

    print()


def test_edge_cases():
    """Test edge cases and boundary conditions"""
    print("Testing Edge Cases")
    print("=" * 40)

    # Test zero value invoice
    zero_value_invoice = {
        'number': 'INV002',
        'date': '2025-09-20',
        'client': {
            'name': 'Test Client',
            'client_type': 'b2c',
            'gstin': '',
            'state_code': '27',
            'billing_address': {}
        },
        'tenant': {
            'company_details': {
                'gstin': '27XYZPQ9876R1Z1',
                'state_code': '27'
            },
            'aato_threshold': 5000000,
            'e_invoice_enabled': False
        },
        'place_of_supply': '27',
        'taxable_amount': 0,
        'total_tax': 0,
        'grand_total': 0,
        'lines': []  # No lines
    }

    engine = GSTComplianceEngine()

    print("Test: Zero Value Invoice with No Lines")
    is_valid, errors, warnings = engine.validate_invoice_rule_46(zero_value_invoice)
    print(f"Valid: {is_valid}")
    print(f"Error Count: {len(errors)}")
    print(f"Warning Count: {len(warnings)}")

    # Test future date invoice
    future_date_invoice = {
        'number': 'INV003',
        'date': '2026-01-01',  # Future date
        'client': {
            'name': 'Future Client',
            'client_type': 'b2b',
            'gstin': '27ABCDE1234F1Z5',
            'state_code': '27',
            'billing_address': {
                'address_line1': '123 Future Street',
                'city': 'Mumbai',
                'state': 'Maharashtra',
                'pincode': '400001'
            }
        },
        'tenant': {
            'company_details': {
                'gstin': '27XYZPQ9876R1Z1',
                'state_code': '27'
            },
            'aato_threshold': 5000000,
            'e_invoice_enabled': True
        },
        'place_of_supply': '27',
        'taxable_amount': 1000,
        'total_tax': 180,
        'grand_total': 1180,
        'lines': [
            {
                'description': 'Future Service',
                'hsn_sac': '998314',
                'quantity': 1,
                'rate': 1000,
                'discount_percent': 0,
                'discount_amount': 0,
                'taxable_value': 1000,
                'cgst_rate': 9,
                'sgst_rate': 9,
                'igst_rate': 0,
                'cess_rate': 0,
                'cgst_amount': 90,
                'sgst_amount': 90,
                'igst_amount': 0,
                'cess_amount': 0,
                'line_total': 1180,
                'is_service': True
            }
        ]
    }

    print("\nTest: Future Date Invoice")
    is_valid, errors, warnings = engine.validate_invoice_rule_46(future_date_invoice)
    print(f"Valid: {is_valid}")
    future_date_errors = [e for e in errors if 'future' in e.lower()]
    if future_date_errors:
        print("Future date error detected:", future_date_errors[0])

    print()


def main():
    print("GST Compliance Engine Test Suite")
    print("=" * 50)
    print()

    try:
        # Run all tests
        test_gstin_validation()
        test_hsn_rate_lookup()
        test_compliance_validation()
        test_compliance_report()
        test_edge_cases()

        print("=" * 50)
        print("All tests completed successfully!")

    except Exception as e:
        print(f"Test failed with error: {str(e)}")
        import traceback
        traceback.print_exc()


if __name__ == '__main__':
    main()