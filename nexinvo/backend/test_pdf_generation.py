#!/usr/bin/env python3
"""
Test script for PDF generation functionality
"""
import os
import sys
import django
from pathlib import Path

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'nexinvo.settings')
django.setup()

from django.contrib.auth import get_user_model
from tenants.models import Tenant, Client, TenantMembership
from invoices.models import Invoice, Item
from invoices.pdf_generator import PDFGenerator

User = get_user_model()


def test_qr_code_generation():
    """Test QR code generation"""
    print("Testing QR Code Generation")
    print("=" * 40)

    pdf_generator = PDFGenerator()

    # Test GST QR code data format
    test_data = "1:27ABCDE1234F1Z5|2:27XYZPQ9876R1Z1|3:INV001|4:20/09/2025|5:11800.00|6:27|7:False|8:Y|9:1800.00"

    try:
        qr_image = pdf_generator._generate_qr_code(test_data, 200)
        print(f"SUCCESS: QR code generated")
        print(f"Format: {'PNG' if qr_image.startswith('data:image/png') else 'Unknown'}")
        print(f"Size: ~{len(qr_image)} characters (base64)")
        print()
        return True
    except Exception as e:
        print(f"FAILED: QR code generation error: {e}")
        print()
        return False


def test_amount_to_words():
    """Test amount to words conversion"""
    print("Testing Amount to Words Conversion")
    print("=" * 40)

    pdf_generator = PDFGenerator()

    test_amounts = [
        0,
        1,
        25,
        100,
        1000,
        10000,
        100000,  # 1 Lakh
        1000000,  # 10 Lakh
        10000000,  # 1 Crore
        11850.75,  # With paise
        250000.50  # 2.5 Lakh with paise
    ]

    success_count = 0
    for amount in test_amounts:
        try:
            words = pdf_generator._amount_to_words(amount)
            print(f"Rs.{amount:,.2f} -> {words}")
            success_count += 1
        except Exception as e:
            print(f"Rs.{amount:,.2f} -> ERROR: {e}")

    print(f"\nSuccessful conversions: {success_count}/{len(test_amounts)}")
    print()
    return success_count == len(test_amounts)


def test_template_loading():
    """Test template loading and basic rendering"""
    print("Testing Template Loading")
    print("=" * 40)

    pdf_generator = PDFGenerator()

    templates = ['professional', 'minimal', 'classic']
    success_count = 0

    for template_name in templates:
        try:
            template = pdf_generator._get_template(template_name)
            print(f"SUCCESS: Template '{template_name}' loaded")
            print(f"  Name: {template['name']}")
            print(f"  Features: {len(template.get('features', []))} features")
            print(f"  Has CSS: {'Yes' if template.get('css_styles') else 'No'}")
            success_count += 1
        except Exception as e:
            print(f"FAILED: Template '{template_name}' error: {e}")

    print(f"\nLoaded templates: {success_count}/{len(templates)}")
    print()
    return success_count == len(templates)


def test_invoice_data_preparation():
    """Test invoice data preparation for PDF"""
    print("Testing Invoice Data Preparation")
    print("=" * 40)

    try:
        # Create test data (reuse from previous test)
        user = User.objects.filter(email='test@example.com').first()
        if not user:
            print("No test user found. Run invoice test first.")
            return False

        tenant = user.tenant_memberships.first().tenant
        invoice = Invoice.objects.filter(tenant=tenant).first()

        if not invoice:
            print("No test invoice found. Run invoice test first.")
            return False

        pdf_generator = PDFGenerator()
        invoice_data = pdf_generator._prepare_invoice_data(invoice)

        print(f"SUCCESS: Invoice data prepared")
        print(f"  Invoice: {invoice_data['invoice']['number']}")
        print(f"  Supplier: {invoice_data['supplier']['name']}")
        print(f"  Client: {invoice_data['client']['name']}")
        print(f"  Lines: {len(invoice_data['lines'])} items")
        print(f"  Tax Groups: {len(invoice_data['tax_rate_summary'])} groups")
        print(f"  Total in Words: {invoice_data['total_in_words'][:50]}...")
        print()
        return True

    except Exception as e:
        print(f"FAILED: Invoice data preparation error: {e}")
        print()
        return False


def test_pdf_generation():
    """Test actual PDF generation"""
    print("Testing PDF Generation")
    print("=" * 40)

    try:
        # Get test invoice
        user = User.objects.filter(email='test@example.com').first()
        if not user:
            print("No test user found. Create test data first.")
            return False

        tenant = user.tenant_memberships.first().tenant
        invoice = Invoice.objects.filter(tenant=tenant).first()

        if not invoice:
            print("No test invoice found. Create test data first.")
            return False

        pdf_generator = PDFGenerator()

        # Test different templates
        templates = ['professional', 'minimal', 'classic']
        success_count = 0

        for template_name in templates:
            try:
                pdf_bytes = pdf_generator.generate_invoice_pdf(
                    invoice=invoice,
                    template_name=template_name,
                    include_qr=True,
                    watermark=f"TEST-{template_name.upper()}"
                )

                # Save PDF for manual inspection
                output_file = Path(f"test_invoice_{template_name}.pdf")
                with open(output_file, 'wb') as f:
                    f.write(pdf_bytes)

                print(f"SUCCESS: {template_name} template PDF generated")
                print(f"  File size: {len(pdf_bytes):,} bytes")
                print(f"  Saved as: {output_file}")
                success_count += 1

            except Exception as e:
                print(f"FAILED: {template_name} template error: {e}")

        print(f"\nGenerated PDFs: {success_count}/{len(templates)}")
        print()
        return success_count > 0

    except Exception as e:
        print(f"FAILED: PDF generation error: {e}")
        print()
        return False


def test_template_features():
    """Test template-specific features"""
    print("Testing Template Features")
    print("=" * 40)

    pdf_generator = PDFGenerator()

    # Test available templates
    templates = pdf_generator.get_available_templates()
    print(f"Available templates: {len(templates)}")

    for template in templates:
        print(f"\nTemplate: {template['name']}")
        print(f"  Display Name: {template['display_name']}")
        print(f"  Description: {template['description']}")

    # Test CSS styles
    styles = {
        'professional': pdf_generator._get_professional_css(),
        'minimal': pdf_generator._get_minimal_css(),
        'classic': pdf_generator._get_classic_css()
    }

    print(f"\nCSS Styles:")
    for name, css in styles.items():
        lines = css.count('\n')
        print(f"  {name}: {lines} lines of CSS")

    print()
    return True


def main():
    print("PDF Generation Test Suite")
    print("=" * 60)
    print()

    tests = [
        ("QR Code Generation", test_qr_code_generation),
        ("Amount to Words", test_amount_to_words),
        ("Template Loading", test_template_loading),
        ("Invoice Data Preparation", test_invoice_data_preparation),
        ("PDF Generation", test_pdf_generation),
        ("Template Features", test_template_features),
    ]

    results = []

    for test_name, test_func in tests:
        try:
            result = test_func()
            results.append((test_name, result))
        except Exception as e:
            print(f"ERROR in {test_name}: {e}")
            results.append((test_name, False))

    # Summary
    print("=" * 60)
    print("Test Results Summary:")
    passed = 0
    for test_name, result in results:
        status = "PASS" if result else "FAIL"
        print(f"  {status}: {test_name}")
        if result:
            passed += 1

    print(f"\nOverall: {passed}/{len(results)} tests passed")

    if passed == len(results):
        print("🎉 All PDF generation tests passed!")
    else:
        print("⚠️  Some tests failed. Check the output above.")

    print("\nNote: Check generated PDF files for visual inspection:")
    for template in ['professional', 'minimal', 'classic']:
        pdf_file = f"test_invoice_{template}.pdf"
        if Path(pdf_file).exists():
            print(f"  - {pdf_file}")


if __name__ == '__main__':
    main()