#!/usr/bin/env python3
"""
Test script for invoice creation and GST calculations
"""
import os
import sys
import django
import json
from decimal import Decimal

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'nexinvo.settings')
django.setup()

from django.contrib.auth import get_user_model
from tenants.models import Tenant, Client, TenantMembership
from invoices.models import Invoice, Item
from invoices.serializers import InvoiceSerializer, ItemSerializer

User = get_user_model()

def create_test_data():
    """Create test user, tenant, client, and items"""
    print("Creating test data...")

    # Create user
    user, created = User.objects.get_or_create(
        email='test@example.com',
        defaults={
            'first_name': 'Test',
            'last_name': 'User',
            'phone': '+919876543210'
        }
    )
    if created:
        user.set_password('password123')
        user.save()
        print(f"Created user: {user.email}")
    else:
        print(f"Using existing user: {user.email}")

    # Create tenant
    tenant, created = Tenant.objects.get_or_create(
        name='Test CA Firm',
        defaults={
            'business_type': 'ca_firm',
            'company_details': {
                'gstin': '27ABCDE1234F1Z5',
                'pan': 'ABCDE1234F',
                'address_line1': '123 Main Street',
                'city': 'Mumbai',
                'state': 'Maharashtra',
                'state_code': '27',
                'pincode': '400001',
                'phone': '+919876543210',
                'email': 'test@testcafirm.com'
            },
            'created_by': user,
            'updated_by': user
        }
    )
    if created:
        print(f"Created tenant: {tenant.name}")
    else:
        print(f"Using existing tenant: {tenant.name}")

    # Create membership
    membership, created = TenantMembership.objects.get_or_create(
        user=user,
        tenant=tenant,
        defaults={'role': 'ca_owner', 'is_active': True}
    )
    if created:
        print(f"Created membership for {user.email} in {tenant.name}")

    # Create clients
    # Client 1: Same state (Intra-state - CGST + SGST)
    client1, created = Client.objects.get_or_create(
        tenant=tenant,
        client_code='CLI001',
        defaults={
            'name': 'Intra State Client',
            'client_type': 'b2b',
            'gstin': '27XYZAB5678M1N2',
            'pan': 'XYZAB5678M',
            'email': 'client1@example.com',
            'phone': '+919876543211',
            'billing_address': {
                'address_line1': '456 Client Street',
                'city': 'Pune',
                'state': 'Maharashtra',
                'pincode': '411001'
            },
            'state_code': '27',
            'credit_terms_days': 30,
            'created_by': user,
            'updated_by': user
        }
    )

    # Client 2: Different state (Inter-state - IGST)
    client2, created = Client.objects.get_or_create(
        tenant=tenant,
        client_code='CLI002',
        defaults={
            'name': 'Inter State Client',
            'client_type': 'b2b',
            'gstin': '06PQRST9012C3D4',
            'pan': 'PQRST9012C',
            'email': 'client2@example.com',
            'phone': '+919876543212',
            'billing_address': {
                'address_line1': '789 Client Avenue',
                'city': 'Chandigarh',
                'state': 'Haryana',
                'pincode': '160001'
            },
            'state_code': '06',
            'credit_terms_days': 45,
            'created_by': user,
            'updated_by': user
        }
    )

    print(f"Created/Found clients: {client1.name}, {client2.name}")

    # Create items
    item1, created = Item.objects.get_or_create(
        tenant=tenant,
        item_code='SERV001',
        defaults={
            'name': 'GST Compliance Service',
            'description': 'Monthly GST compliance and filing service',
            'hsn_sac': '998314',
            'uqc': 'OTH',
            'default_rate': Decimal('5000.00'),
            'current_gst_rate': Decimal('18.00'),
            'current_cess_rate': Decimal('0.00'),
            'item_category': 'Professional Services',
            'is_service': True,
            'created_by': user,
            'updated_by': user
        }
    )

    item2, created = Item.objects.get_or_create(
        tenant=tenant,
        item_code='PROD001',
        defaults={
            'name': 'Software License',
            'description': 'Annual software license for accounting',
            'hsn_sac': '8523',
            'uqc': 'NOS',
            'default_rate': Decimal('12000.00'),
            'current_gst_rate': Decimal('28.00'),
            'current_cess_rate': Decimal('0.00'),
            'item_category': 'Software',
            'is_service': False,
            'created_by': user,
            'updated_by': user
        }
    )

    print(f"Created/Found items: {item1.name}, {item2.name}")

    return user, tenant, client1, client2, item1, item2

def test_intra_state_invoice(user, tenant, client, item1, item2):
    """Test intra-state invoice creation (CGST + SGST)"""
    print("\n" + "="*50)
    print("Testing INTRA-STATE Invoice (CGST + SGST)")
    print("="*50)

    class MockRequest:
        def __init__(self, user):
            self.user = user

    request = MockRequest(user)

    invoice_data = {
        'client': client.id,
        'invoice_type': 'taxable',
        'series': 'INV',
        'lines': [
            {
                'item': item1.id,
                'description': item1.name,
                'hsn_sac': item1.hsn_sac,
                'quantity': Decimal('1.000'),
                'uqc': item1.uqc,
                'rate': item1.default_rate,
                'discount_percent': Decimal('0.00'),
                'discount_amount': Decimal('0.00')
            },
            {
                'item': item2.id,
                'description': item2.name,
                'hsn_sac': item2.hsn_sac,
                'quantity': Decimal('2.000'),
                'uqc': item2.uqc,
                'rate': item2.default_rate,
                'discount_percent': Decimal('10.00'),
                'discount_amount': Decimal('0.00')  # Will be calculated
            }
        ]
    }

    serializer = InvoiceSerializer(data=invoice_data, context={'request': request})

    if serializer.is_valid():
        invoice = serializer.save()
        print(f"SUCCESS: Invoice created successfully: {invoice.number}")
        print(f"Date: {invoice.date}")
        print(f"Due Date: {invoice.due_date}")
        print(f"Client: {invoice.client.name} (State: {invoice.client.state_code})")
        print(f"Place of Supply: {invoice.place_of_supply}")
        print(f"Grand Total: Rs.{invoice.grand_total}")

        print("\nInvoice Lines:")
        for line in invoice.lines.all():
            print(f"  Line {line.line_number}: {line.description}")
            print(f"    Quantity: {line.quantity} x Rs.{line.rate}")
            print(f"    Discount: {line.discount_percent}% (Rs.{line.discount_amount})")
            print(f"    Taxable Value: Rs.{line.taxable_value}")
            print(f"    CGST ({line.cgst_rate}%): Rs.{line.cgst_amount}")
            print(f"    SGST ({line.sgst_rate}%): Rs.{line.sgst_amount}")
            print(f"    IGST ({line.igst_rate}%): Rs.{line.igst_amount}")
            print(f"    CESS ({line.cess_rate}%): Rs.{line.cess_amount}")
            print(f"    Line Total: Rs.{line.line_total}")
            print()

        # Verify calculations
        expected_line1_taxable = Decimal('5000.00')
        expected_line1_cgst = expected_line1_taxable * Decimal('9.00') / 100  # 18% / 2
        expected_line1_sgst = expected_line1_taxable * Decimal('9.00') / 100  # 18% / 2

        expected_line2_gross = Decimal('24000.00')  # 2 * 12000
        expected_line2_discount = expected_line2_gross * Decimal('10.00') / 100
        expected_line2_taxable = expected_line2_gross - expected_line2_discount
        expected_line2_cgst = expected_line2_taxable * Decimal('14.00') / 100  # 28% / 2
        expected_line2_sgst = expected_line2_taxable * Decimal('14.00') / 100  # 28% / 2

        line1 = invoice.lines.get(line_number=1)
        line2 = invoice.lines.get(line_number=2)

        print("Verification:")
        print(f"Line 1 - Expected CGST: Rs.{expected_line1_cgst}, Actual: Rs.{line1.cgst_amount}")
        print(f"Line 1 - Expected SGST: Rs.{expected_line1_sgst}, Actual: Rs.{line1.sgst_amount}")
        print(f"Line 2 - Expected Taxable: Rs.{expected_line2_taxable}, Actual: Rs.{line2.taxable_value}")
        print(f"Line 2 - Expected CGST: Rs.{expected_line2_cgst}, Actual: Rs.{line2.cgst_amount}")
        print(f"Line 2 - Expected SGST: Rs.{expected_line2_sgst}, Actual: Rs.{line2.sgst_amount}")

        return invoice
    else:
        print("FAILED: Invoice creation failed:")
        for field, errors in serializer.errors.items():
            print(f"  {field}: {errors}")
        return None

def test_inter_state_invoice(user, tenant, client, item1, item2):
    """Test inter-state invoice creation (IGST)"""
    print("\n" + "="*50)
    print("Testing INTER-STATE Invoice (IGST)")
    print("="*50)

    class MockRequest:
        def __init__(self, user):
            self.user = user

    request = MockRequest(user)

    invoice_data = {
        'client': client.id,
        'invoice_type': 'taxable',
        'series': 'INT',
        'lines': [
            {
                'item': item1.id,
                'description': item1.name,
                'hsn_sac': item1.hsn_sac,
                'quantity': Decimal('1.000'),
                'uqc': item1.uqc,
                'rate': item1.default_rate,
                'discount_percent': Decimal('5.00'),
                'discount_amount': Decimal('0.00')
            }
        ]
    }

    serializer = InvoiceSerializer(data=invoice_data, context={'request': request})

    if serializer.is_valid():
        invoice = serializer.save()
        print(f"SUCCESS: Invoice created successfully: {invoice.number}")
        print(f"Date: {invoice.date}")
        print(f"Due Date: {invoice.due_date}")
        print(f"Client: {invoice.client.name} (State: {invoice.client.state_code})")
        print(f"Place of Supply: {invoice.place_of_supply}")
        print(f"Grand Total: Rs.{invoice.grand_total}")

        print("\nInvoice Lines:")
        for line in invoice.lines.all():
            print(f"  Line {line.line_number}: {line.description}")
            print(f"    Quantity: {line.quantity} x Rs.{line.rate}")
            print(f"    Discount: {line.discount_percent}% (Rs.{line.discount_amount})")
            print(f"    Taxable Value: Rs.{line.taxable_value}")
            print(f"    CGST ({line.cgst_rate}%): Rs.{line.cgst_amount}")
            print(f"    SGST ({line.sgst_rate}%): Rs.{line.sgst_amount}")
            print(f"    IGST ({line.igst_rate}%): Rs.{line.igst_amount}")
            print(f"    CESS ({line.cess_rate}%): Rs.{line.cess_amount}")
            print(f"    Line Total: Rs.{line.line_total}")
            print()

        # Verify calculations
        line1 = invoice.lines.get(line_number=1)
        expected_gross = Decimal('5000.00')
        expected_discount = expected_gross * Decimal('5.00') / 100
        expected_taxable = expected_gross - expected_discount
        expected_igst = expected_taxable * Decimal('18.00') / 100

        print("Verification:")
        print(f"Expected Taxable: Rs.{expected_taxable}, Actual: Rs.{line1.taxable_value}")
        print(f"Expected IGST: Rs.{expected_igst}, Actual: Rs.{line1.igst_amount}")
        print(f"CGST should be 0: Rs.{line1.cgst_amount}")
        print(f"SGST should be 0: Rs.{line1.sgst_amount}")
        print(f"DEBUG: Client state: {invoice.client.state_code}, Place of supply: {invoice.place_of_supply}")
        print(f"DEBUG: IGST Rate: {line1.igst_rate}%, CGST Rate: {line1.cgst_rate}%, SGST Rate: {line1.sgst_rate}%")

        return invoice
    else:
        print("FAILED: Invoice creation failed:")
        for field, errors in serializer.errors.items():
            print(f"  {field}: {errors}")
        return None

def main():
    print("Starting Invoice Creation and GST Calculation Tests")
    print("="*60)

    try:
        # Create test data
        user, tenant, client1, client2, item1, item2 = create_test_data()

        # Test intra-state invoice (Maharashtra to Maharashtra)
        intra_invoice = test_intra_state_invoice(user, tenant, client1, item1, item2)

        # Test inter-state invoice (Maharashtra to Haryana)
        inter_invoice = test_inter_state_invoice(user, tenant, client2, item1, item2)

        print("\n" + "="*60)
        print("Test Summary:")
        if intra_invoice:
            print(f"SUCCESS: Intra-state invoice: {intra_invoice.number} - Rs.{intra_invoice.grand_total}")
        else:
            print("FAILED: Intra-state invoice failed")

        if inter_invoice:
            print(f"SUCCESS: Inter-state invoice: {inter_invoice.number} - Rs.{inter_invoice.grand_total}")
        else:
            print("FAILED: Inter-state invoice failed")

        print("="*60)

    except Exception as e:
        print(f"Test failed with error: {str(e)}")
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    main()