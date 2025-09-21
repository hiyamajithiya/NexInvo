# NexInvo Mobile API Documentation

## Overview

This document provides comprehensive API documentation for the NexInvo Mobile application. The app communicates with a RESTful API backend for all data operations including authentication, invoice management, client management, and integrations.

## Base Configuration

```typescript
// API Base Configuration
const API_CONFIG = {
  baseURL: process.env.API_BASE_URL || 'https://api.nexinvo.com/v1',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  }
};
```

## Authentication

### Authentication Flow

The app uses JWT (JSON Web Token) based authentication with automatic token refresh.

#### Login
```typescript
POST /auth/login
Content-Type: application/json

Request Body:
{
  "email": "user@example.com",
  "password": "securePassword123"
}

Response (200 OK):
{
  "success": true,
  "data": {
    "user": {
      "id": "user-uuid",
      "email": "user@example.com",
      "name": "John Doe",
      "role": "admin",
      "profile": {
        "phone": "+1234567890",
        "company": "Acme Corp",
        "address": "123 Business St"
      }
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "refresh-token-string",
    "expiresIn": 3600
  }
}

Error Response (401 Unauthorized):
{
  "success": false,
  "error": {
    "code": "INVALID_CREDENTIALS",
    "message": "Invalid email or password"
  }
}
```

#### Register
```typescript
POST /auth/register
Content-Type: application/json

Request Body:
{
  "email": "newuser@example.com",
  "password": "securePassword123",
  "name": "New User",
  "company": "User Company"
}

Response (201 Created):
{
  "success": true,
  "data": {
    "user": { /* user object */ },
    "token": "jwt-token",
    "refreshToken": "refresh-token"
  }
}
```

#### Token Refresh
```typescript
POST /auth/refresh
Authorization: Bearer <refresh-token>

Response (200 OK):
{
  "success": true,
  "data": {
    "token": "new-jwt-token",
    "expiresIn": 3600
  }
}
```

#### Logout
```typescript
POST /auth/logout
Authorization: Bearer <jwt-token>

Response (200 OK):
{
  "success": true,
  "message": "Logged out successfully"
}
```

## Invoice Management

### Get Invoices
```typescript
GET /invoices
Authorization: Bearer <jwt-token>
Query Parameters:
  - page: number (default: 1)
  - limit: number (default: 10, max: 100)
  - status: string (pending|sent|paid|overdue|draft)
  - client_id: string
  - date_from: string (ISO date)
  - date_to: string (ISO date)
  - search: string

Response (200 OK):
{
  "success": true,
  "data": {
    "invoices": [
      {
        "id": "invoice-uuid",
        "invoice_number": "INV-001",
        "client_id": "client-uuid",
        "client_name": "Client Name",
        "issue_date": "2023-01-01",
        "due_date": "2023-01-31",
        "status": "pending",
        "subtotal": 1000.00,
        "tax_amount": 180.00,
        "grand_total": 1180.00,
        "currency": "INR",
        "items": [
          {
            "id": "item-uuid",
            "description": "Service Description",
            "quantity": 2,
            "rate": 500.00,
            "amount": 1000.00
          }
        ],
        "notes": "Payment terms and conditions",
        "created_at": "2023-01-01T00:00:00Z",
        "updated_at": "2023-01-01T00:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 25,
      "totalPages": 3,
      "hasNext": true,
      "hasPrev": false
    }
  }
}
```

### Create Invoice
```typescript
POST /invoices
Authorization: Bearer <jwt-token>
Content-Type: application/json

Request Body:
{
  "client_id": "client-uuid",
  "issue_date": "2023-01-01",
  "due_date": "2023-01-31",
  "items": [
    {
      "description": "Consulting Service",
      "quantity": 5,
      "rate": 100.00,
      "amount": 500.00
    }
  ],
  "subtotal": 500.00,
  "tax_rate": 18.0,
  "tax_amount": 90.00,
  "grand_total": 590.00,
  "notes": "Thank you for your business",
  "terms": "Payment due within 30 days"
}

Response (201 Created):
{
  "success": true,
  "data": {
    "invoice": { /* complete invoice object */ }
  }
}
```

### Update Invoice
```typescript
PUT /invoices/:id
Authorization: Bearer <jwt-token>
Content-Type: application/json

Request Body: {
  /* same as create invoice, partial updates allowed */
}

Response (200 OK):
{
  "success": true,
  "data": {
    "invoice": { /* updated invoice object */ }
  }
}
```

### Delete Invoice
```typescript
DELETE /invoices/:id
Authorization: Bearer <jwt-token>

Response (200 OK):
{
  "success": true,
  "message": "Invoice deleted successfully"
}
```

### Send Invoice
```typescript
POST /invoices/:id/send
Authorization: Bearer <jwt-token>
Content-Type: application/json

Request Body:
{
  "email": "client@example.com",
  "subject": "Invoice INV-001",
  "message": "Please find your invoice attached."
}

Response (200 OK):
{
  "success": true,
  "data": {
    "sent_at": "2023-01-01T10:00:00Z",
    "email": "client@example.com"
  }
}
```

### Mark Invoice as Paid
```typescript
POST /invoices/:id/payments
Authorization: Bearer <jwt-token>
Content-Type: application/json

Request Body:
{
  "amount": 1180.00,
  "payment_date": "2023-01-15",
  "payment_method": "bank_transfer",
  "reference": "TXN123456",
  "notes": "Payment received via bank transfer"
}

Response (200 OK):
{
  "success": true,
  "data": {
    "payment": {
      "id": "payment-uuid",
      "invoice_id": "invoice-uuid",
      "amount": 1180.00,
      "payment_date": "2023-01-15",
      "payment_method": "bank_transfer",
      "reference": "TXN123456"
    },
    "invoice": { /* updated invoice with new status */ }
  }
}
```

## Client Management

### Get Clients
```typescript
GET /clients
Authorization: Bearer <jwt-token>
Query Parameters:
  - page: number
  - limit: number
  - search: string

Response (200 OK):
{
  "success": true,
  "data": {
    "clients": [
      {
        "id": "client-uuid",
        "name": "Client Company Ltd",
        "email": "contact@client.com",
        "phone": "+1234567890",
        "address": "123 Client Street",
        "city": "Client City",
        "state": "Client State",
        "pincode": "12345",
        "country": "India",
        "gst_number": "22ABCDE1234F1Z5",
        "created_at": "2023-01-01T00:00:00Z",
        "updated_at": "2023-01-01T00:00:00Z"
      }
    ],
    "pagination": { /* pagination object */ }
  }
}
```

### Create Client
```typescript
POST /clients
Authorization: Bearer <jwt-token>
Content-Type: application/json

Request Body:
{
  "name": "New Client Ltd",
  "email": "newclient@example.com",
  "phone": "+1234567890",
  "address": "456 New Street",
  "city": "New City",
  "state": "New State",
  "pincode": "54321",
  "country": "India",
  "gst_number": "22NEWCL1234F1Z5"
}

Response (201 Created):
{
  "success": true,
  "data": {
    "client": { /* complete client object */ }
  }
}
```

## Reports and Analytics

### Dashboard Statistics
```typescript
GET /dashboard/stats
Authorization: Bearer <jwt-token>
Query Parameters:
  - period: string (week|month|quarter|year)

Response (200 OK):
{
  "success": true,
  "data": {
    "overview": {
      "total_invoices": 150,
      "total_revenue": 250000.00,
      "pending_amount": 45000.00,
      "overdue_amount": 8000.00,
      "active_clients": 45
    },
    "monthly_stats": [
      {
        "month": "2023-01",
        "invoices_count": 25,
        "revenue": 42000.00,
        "collections": 38000.00
      }
    ],
    "status_breakdown": {
      "draft": 5,
      "sent": 12,
      "paid": 120,
      "overdue": 8,
      "cancelled": 5
    }
  }
}
```

### Revenue Reports
```typescript
GET /reports/revenue
Authorization: Bearer <jwt-token>
Query Parameters:
  - from_date: string (ISO date)
  - to_date: string (ISO date)
  - group_by: string (day|week|month)

Response (200 OK):
{
  "success": true,
  "data": {
    "total_revenue": 125000.00,
    "total_invoices": 75,
    "average_invoice_value": 1666.67,
    "revenue_by_period": [
      {
        "period": "2023-01",
        "revenue": 42000.00,
        "invoices": 25,
        "average": 1680.00
      }
    ]
  }
}
```

## Integration Management

### Get Integrations
```typescript
GET /integrations
Authorization: Bearer <jwt-token>

Response (200 OK):
{
  "success": true,
  "data": {
    "integrations": [
      {
        "id": "integration-uuid",
        "name": "Tally Integration",
        "integration_type": "tally",
        "is_active": true,
        "configuration": {
          "server_url": "http://localhost:9000",
          "company_name": "My Company"
        },
        "last_sync_at": "2023-01-01T12:00:00Z",
        "sync_status": "completed",
        "created_at": "2023-01-01T00:00:00Z"
      }
    ]
  }
}
```

### Test Integration
```typescript
POST /integrations/:id/test
Authorization: Bearer <jwt-token>

Response (200 OK):
{
  "success": true,
  "data": {
    "result": {
      "success": true,
      "message": "Connection successful",
      "response_time": 150,
      "server_info": {
        "version": "7.2",
        "companies": ["Company 1", "Company 2"]
      }
    }
  }
}
```

### Sync Data
```typescript
POST /integrations/:id/sync
Authorization: Bearer <jwt-token>
Content-Type: application/json

Request Body:
{
  "sync_type": "full", // or "incremental"
  "entities": ["clients", "invoices"] // optional
}

Response (202 Accepted):
{
  "success": true,
  "data": {
    "sync_job_id": "job-uuid",
    "status": "queued",
    "estimated_duration": 300
  }
}
```

## File Management

### Upload File
```typescript
POST /files/upload
Authorization: Bearer <jwt-token>
Content-Type: multipart/form-data

Form Data:
  - file: File (max 10MB)
  - type: string (invoice_attachment|client_document|logo)

Response (200 OK):
{
  "success": true,
  "data": {
    "file": {
      "id": "file-uuid",
      "filename": "document.pdf",
      "url": "https://cdn.nexinvo.com/files/file-uuid.pdf",
      "size": 1024000,
      "mime_type": "application/pdf",
      "uploaded_at": "2023-01-01T12:00:00Z"
    }
  }
}
```

### Generate PDF
```typescript
POST /invoices/:id/pdf
Authorization: Bearer <jwt-token>

Response (200 OK):
{
  "success": true,
  "data": {
    "pdf_url": "https://cdn.nexinvo.com/pdfs/invoice-uuid.pdf",
    "expires_at": "2023-01-01T18:00:00Z"
  }
}
```

## Error Handling

### Error Response Format
```typescript
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable error message",
    "details": {
      // Additional error details
    }
  }
}
```

### Common Error Codes
- `INVALID_CREDENTIALS` - Authentication failed
- `TOKEN_EXPIRED` - JWT token has expired
- `UNAUTHORIZED` - Insufficient permissions
- `VALIDATION_ERROR` - Request validation failed
- `NOT_FOUND` - Resource not found
- `RATE_LIMIT_EXCEEDED` - Too many requests
- `SERVER_ERROR` - Internal server error

### HTTP Status Codes
- `200` - OK
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `422` - Unprocessable Entity
- `429` - Too Many Requests
- `500` - Internal Server Error

## Rate Limiting

The API implements rate limiting to ensure fair usage:

- **Authentication endpoints**: 5 requests per minute per IP
- **General API endpoints**: 100 requests per minute per authenticated user
- **File upload endpoints**: 10 requests per minute per user
- **PDF generation**: 20 requests per minute per user

Rate limit headers are included in responses:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1640995200
```

## Webhooks

The API supports webhooks for real-time notifications:

### Webhook Events
- `invoice.created`
- `invoice.updated`
- `invoice.sent`
- `invoice.paid`
- `client.created`
- `client.updated`
- `payment.received`

### Webhook Payload Example
```typescript
{
  "event": "invoice.paid",
  "timestamp": "2023-01-01T12:00:00Z",
  "data": {
    "invoice": { /* invoice object */ },
    "payment": { /* payment object */ }
  }
}
```

## SDK Usage Examples

### TypeScript/JavaScript Client
```typescript
import { NexInvoAPI } from '@nexinvo/api-client';

const api = new NexInvoAPI({
  baseURL: 'https://api.nexinvo.com/v1',
  apiKey: 'your-api-key'
});

// Login
const { user, token } = await api.auth.login({
  email: 'user@example.com',
  password: 'password'
});

// Get invoices
const invoices = await api.invoices.list({
  status: 'pending',
  limit: 20
});

// Create invoice
const invoice = await api.invoices.create({
  client_id: 'client-uuid',
  items: [/* items */]
});
```

This API documentation provides a comprehensive reference for integrating with the NexInvo backend services from the mobile application.