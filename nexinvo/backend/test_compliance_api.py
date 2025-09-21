#!/usr/bin/env python3
"""
Test script for GST Compliance API endpoints
"""
import requests
import json

# API base URL
BASE_URL = "http://localhost:8000/api/v1/invoices"

# Test authentication (using dummy token for now)
headers = {
    "Authorization": "Bearer dummy_token_for_testing",
    "Content-Type": "application/json"
}

def test_gstin_validation():
    """Test GSTIN validation endpoint"""
    print("Testing GSTIN Validation API")
    print("=" * 40)

    test_cases = [
        {
            "gstin": "27ABCDE1234F1Z5",
            "description": "Valid GSTIN"
        },
        {
            "gstin": "99INVALID1234F1Z5",
            "description": "Invalid GSTIN"
        }
    ]

    for test_case in test_cases:
        try:
            response = requests.post(
                f"{BASE_URL}/validate-gstin/",
                headers=headers,
                json={"gstin": test_case["gstin"]},
                timeout=10
            )

            print(f"{test_case['description']}: {test_case['gstin']}")
            print(f"Status: {response.status_code}")
            if response.status_code == 200:
                data = response.json()
                print(f"Valid: {data.get('is_valid')}")
                if data.get('state_name'):
                    print(f"State: {data.get('state_name')}")
            else:
                print(f"Error: {response.text}")
            print()

        except requests.exceptions.ConnectionError:
            print("Could not connect to server. Is Django server running?")
            return False
        except Exception as e:
            print(f"Error testing GSTIN: {str(e)}")
            return False

    return True

def test_hsn_rate_lookup():
    """Test HSN rate lookup endpoint"""
    print("Testing HSN Rate Lookup API")
    print("=" * 40)

    test_cases = [
        {
            "hsn_sac": "8523",
            "is_service": False,
            "description": "Software media HSN"
        },
        {
            "hsn_sac": "998314",
            "is_service": True,
            "description": "Professional services SAC"
        }
    ]

    for test_case in test_cases:
        try:
            response = requests.post(
                f"{BASE_URL}/get-hsn-rate/",
                headers=headers,
                json={
                    "hsn_sac": test_case["hsn_sac"],
                    "is_service": test_case["is_service"]
                },
                timeout=10
            )

            print(f"{test_case['description']}: {test_case['hsn_sac']}")
            print(f"Status: {response.status_code}")
            if response.status_code == 200:
                data = response.json()
                print(f"Format Valid: {data.get('format_valid')}")
                if data.get('has_suggestion'):
                    print(f"Suggested Rate: {data.get('suggested_gst_rate')}%")
                else:
                    print("No suggested rate found")
            else:
                print(f"Error: {response.text}")
            print()

        except requests.exceptions.ConnectionError:
            print("Could not connect to server. Is Django server running?")
            return False
        except Exception as e:
            print(f"Error testing HSN: {str(e)}")
            return False

    return True

def test_compliance_check():
    """Test compliance check endpoint"""
    print("Testing Compliance Check API")
    print("=" * 40)

    sample_invoice = {
        "number": "TEST001",
        "date": "2025-09-20",
        "client": {
            "name": "Test Client Ltd",
            "client_type": "b2b",
            "gstin": "27ABCDE1234F1Z5",
            "state_code": "27",
            "billing_address": {
                "address_line1": "123 Test Street",
                "city": "Mumbai",
                "state": "Maharashtra",
                "pincode": "400001"
            }
        },
        "tenant": {
            "company_details": {
                "gstin": "27XYZPQ9876R1Z1",
                "state_code": "27"
            },
            "aato_threshold": 5000000,
            "e_invoice_enabled": True
        },
        "place_of_supply": "27",
        "taxable_amount": 100000,
        "total_tax": 18000,
        "grand_total": 118000,
        "lines": [
            {
                "description": "Software Development Service",
                "hsn_sac": "998314",
                "quantity": 1,
                "rate": 100000,
                "discount_percent": 0,
                "discount_amount": 0,
                "taxable_value": 100000,
                "cgst_rate": 9,
                "sgst_rate": 9,
                "igst_rate": 0,
                "cess_rate": 0,
                "cgst_amount": 9000,
                "sgst_amount": 9000,
                "igst_amount": 0,
                "cess_amount": 0,
                "line_total": 118000,
                "is_service": True
            }
        ]
    }

    try:
        response = requests.post(
            f"{BASE_URL}/compliance-check/",
            headers=headers,
            json=sample_invoice,
            timeout=10
        )

        print(f"Status: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"Is Compliant: {data.get('is_compliant')}")
            print(f"Compliance Score: {data.get('compliance_score', {}).get('compliance_score', 'N/A')}")

            errors = data.get('errors', [])
            if errors:
                print(f"Errors ({len(errors)}):")
                for error in errors[:3]:  # Show first 3 errors
                    print(f"  - {error}")
                if len(errors) > 3:
                    print(f"  ... and {len(errors) - 3} more")

            warnings = data.get('warnings', [])
            if warnings:
                print(f"Warnings ({len(warnings)}):")
                for warning in warnings[:3]:  # Show first 3 warnings
                    print(f"  - {warning}")
                if len(warnings) > 3:
                    print(f"  ... and {len(warnings) - 3} more")

        else:
            print(f"Error: {response.text}")
        print()

    except requests.exceptions.ConnectionError:
        print("Could not connect to server. Is Django server running on localhost:8000?")
        return False
    except Exception as e:
        print(f"Error testing compliance: {str(e)}")
        return False

    return True

def main():
    print("GST Compliance API Test Suite")
    print("=" * 50)
    print()

    # Test without authentication first
    print("Note: Testing API endpoints without authentication")
    print("This may return 401/403 errors, which is expected behavior")
    print()

    try:
        success = True

        # Test all endpoints
        success &= test_gstin_validation()
        success &= test_hsn_rate_lookup()
        success &= test_compliance_check()

        if success:
            print("=" * 50)
            print("API endpoints are accessible and responding!")
            print("Note: Actual functionality requires proper authentication")
        else:
            print("=" * 50)
            print("Some tests failed. Check server status and endpoints.")

    except Exception as e:
        print(f"Test suite failed: {str(e)}")

if __name__ == '__main__':
    main()