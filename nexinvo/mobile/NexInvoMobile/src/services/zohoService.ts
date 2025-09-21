import { api } from './api';
import { Invoice, Client } from '../types';

export interface ZohoCredentials {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  accessToken?: string;
  organizationId?: string;
  dataCenter: 'com' | 'eu' | 'in' | 'com.au';
}

export interface ZohoSyncOptions {
  syncCustomers: boolean;
  syncInvoices: boolean;
  syncItems: boolean;
  syncPayments: boolean;
  overwriteExisting: boolean;
  dateFilter?: {
    startDate: string;
    endDate: string;
  };
}

export interface ZohoSyncResult {
  success: boolean;
  syncedCustomers: number;
  syncedInvoices: number;
  syncedItems: number;
  syncedPayments: number;
  errors: string[];
  warnings: string[];
}

export interface ZohoConnectionStatus {
  isConnected: boolean;
  lastSyncTime?: Date;
  organizationName?: string;
  currency?: string;
  error?: string;
}

class ZohoService {
  private baseUrl = 'https://www.zohoapis';

  async authenticate(credentials: Omit<ZohoCredentials, 'accessToken'>): Promise<{
    success: boolean;
    accessToken?: string;
    error?: string;
  }> {
    try {
      const response = await api.post('/integrations/zoho/authenticate', credentials);
      return {
        success: true,
        accessToken: response.data.accessToken,
      };
    } catch (error: any) {
      console.error('Zoho authentication failed:', error);
      return {
        success: false,
        error: error.response?.data?.message || 'Authentication failed',
      };
    }
  }

  async testConnection(credentials: ZohoCredentials): Promise<ZohoConnectionStatus> {
    try {
      const response = await api.post('/integrations/zoho/test-connection', credentials);
      return {
        isConnected: response.data.success,
        lastSyncTime: new Date(),
        organizationName: response.data.organizationName,
        currency: response.data.currency,
      };
    } catch (error: any) {
      console.error('Zoho connection test failed:', error);
      return {
        isConnected: false,
        error: error.response?.data?.message || 'Connection failed',
      };
    }
  }

  async saveCredentials(credentials: ZohoCredentials): Promise<boolean> {
    try {
      await api.post('/integrations/zoho/configure', credentials);
      return true;
    } catch (error) {
      console.error('Failed to save Zoho credentials:', error);
      return false;
    }
  }

  async getConfiguration(): Promise<ZohoCredentials | null> {
    try {
      const response = await api.get('/integrations/zoho/configuration');
      return response.data;
    } catch (error) {
      console.error('Failed to get Zoho configuration:', error);
      return null;
    }
  }

  async syncToZoho(options: ZohoSyncOptions): Promise<ZohoSyncResult> {
    try {
      const response = await api.post('/integrations/zoho/sync', options);
      return {
        success: true,
        syncedCustomers: response.data.syncedCustomers || 0,
        syncedInvoices: response.data.syncedInvoices || 0,
        syncedItems: response.data.syncedItems || 0,
        syncedPayments: response.data.syncedPayments || 0,
        errors: response.data.errors || [],
        warnings: response.data.warnings || [],
      };
    } catch (error: any) {
      console.error('Zoho sync failed:', error);
      return {
        success: false,
        syncedCustomers: 0,
        syncedInvoices: 0,
        syncedItems: 0,
        syncedPayments: 0,
        errors: [error.response?.data?.message || 'Sync failed'],
        warnings: [],
      };
    }
  }

  async syncFromZoho(options: {
    syncCustomers: boolean;
    syncInvoices: boolean;
    syncItems: boolean;
    lastSyncTime?: Date;
  }): Promise<ZohoSyncResult> {
    try {
      const response = await api.post('/integrations/zoho/sync-from', options);
      return {
        success: true,
        syncedCustomers: response.data.syncedCustomers || 0,
        syncedInvoices: response.data.syncedInvoices || 0,
        syncedItems: response.data.syncedItems || 0,
        syncedPayments: response.data.syncedPayments || 0,
        errors: response.data.errors || [],
        warnings: response.data.warnings || [],
      };
    } catch (error: any) {
      console.error('Zoho sync from failed:', error);
      return {
        success: false,
        syncedCustomers: 0,
        syncedInvoices: 0,
        syncedItems: 0,
        syncedPayments: 0,
        errors: [error.response?.data?.message || 'Sync failed'],
        warnings: [],
      };
    }
  }

  async createCustomer(client: Client): Promise<{
    success: boolean;
    zohoCustomerId?: string;
    error?: string;
  }> {
    try {
      const customerData = {
        contact_name: client.name,
        company_name: client.companyName || client.name,
        email: client.email,
        phone: client.phone,
        billing_address: {
          address: client.address,
          city: client.city,
          state: client.state,
          zip: client.pincode,
          country: client.country || 'India',
        },
        shipping_address: {
          address: client.address,
          city: client.city,
          state: client.state,
          zip: client.pincode,
          country: client.country || 'India',
        },
        currency_code: 'INR',
      };

      const response = await api.post('/integrations/zoho/customers', customerData);
      return {
        success: true,
        zohoCustomerId: response.data.customer.customer_id,
      };
    } catch (error: any) {
      console.error('Failed to create Zoho customer:', error);
      return {
        success: false,
        error: error.response?.data?.message || 'Customer creation failed',
      };
    }
  }

  async createInvoice(invoice: Invoice, zohoCustomerId: string): Promise<{
    success: boolean;
    zohoInvoiceId?: string;
    invoiceNumber?: string;
    error?: string;
  }> {
    try {
      const invoiceData = {
        customer_id: zohoCustomerId,
        invoice_number: invoice.number,
        date: invoice.issueDate,
        due_date: invoice.dueDate,
        reference_number: invoice.number,
        notes: invoice.notes,
        terms: invoice.terms,
        line_items: invoice.items.map(item => ({
          name: item.description,
          description: item.description,
          rate: item.rate,
          quantity: item.quantity,
          unit: item.unit || 'qty',
          tax_id: item.taxRate > 0 ? 'default_tax' : undefined,
        })),
        tax_id: invoice.taxRate > 0 ? 'default_tax' : undefined,
        discount: invoice.discount || 0,
        is_discount_before_tax: true,
        discount_type: 'amount',
      };

      const response = await api.post('/integrations/zoho/invoices', invoiceData);
      return {
        success: true,
        zohoInvoiceId: response.data.invoice.invoice_id,
        invoiceNumber: response.data.invoice.invoice_number,
      };
    } catch (error: any) {
      console.error('Failed to create Zoho invoice:', error);
      return {
        success: false,
        error: error.response?.data?.message || 'Invoice creation failed',
      };
    }
  }

  async getCustomers(): Promise<Array<{
    customer_id: string;
    contact_name: string;
    company_name: string;
    email: string;
    phone: string;
    currency_code: string;
  }>> {
    try {
      const response = await api.get('/integrations/zoho/customers');
      return response.data.customers || [];
    } catch (error) {
      console.error('Failed to get Zoho customers:', error);
      return [];
    }
  }

  async getInvoices(params?: {
    customer_id?: string;
    status?: string;
    date_start?: string;
    date_end?: string;
  }): Promise<Array<{
    invoice_id: string;
    invoice_number: string;
    customer_name: string;
    date: string;
    due_date: string;
    status: string;
    total: number;
    balance: number;
  }>> {
    try {
      const response = await api.get('/integrations/zoho/invoices', { params });
      return response.data.invoices || [];
    } catch (error) {
      console.error('Failed to get Zoho invoices:', error);
      return [];
    }
  }

  async getItems(): Promise<Array<{
    item_id: string;
    name: string;
    rate: number;
    description: string;
    tax_id: string;
    tax_name: string;
    tax_percentage: number;
  }>> {
    try {
      const response = await api.get('/integrations/zoho/items');
      return response.data.items || [];
    } catch (error) {
      console.error('Failed to get Zoho items:', error);
      return [];
    }
  }

  async createItem(item: {
    name: string;
    rate: number;
    description?: string;
    tax_id?: string;
  }): Promise<{
    success: boolean;
    itemId?: string;
    error?: string;
  }> {
    try {
      const response = await api.post('/integrations/zoho/items', item);
      return {
        success: true,
        itemId: response.data.item.item_id,
      };
    } catch (error: any) {
      console.error('Failed to create Zoho item:', error);
      return {
        success: false,
        error: error.response?.data?.message || 'Item creation failed',
      };
    }
  }

  async recordPayment(params: {
    invoice_id: string;
    customer_id: string;
    payment_mode: string;
    amount: number;
    date: string;
    reference_number?: string;
    notes?: string;
  }): Promise<{
    success: boolean;
    paymentId?: string;
    error?: string;
  }> {
    try {
      const response = await api.post('/integrations/zoho/payments', params);
      return {
        success: true,
        paymentId: response.data.payment.payment_id,
      };
    } catch (error: any) {
      console.error('Failed to record Zoho payment:', error);
      return {
        success: false,
        error: error.response?.data?.message || 'Payment recording failed',
      };
    }
  }

  async getSyncHistory(): Promise<Array<{
    id: string;
    syncType: 'to_zoho' | 'from_zoho';
    startTime: Date;
    endTime?: Date;
    status: 'in_progress' | 'completed' | 'failed';
    syncedRecords: number;
    errors: string[];
  }>> {
    try {
      const response = await api.get('/integrations/zoho/sync-history');
      return response.data.map((item: any) => ({
        ...item,
        startTime: new Date(item.startTime),
        endTime: item.endTime ? new Date(item.endTime) : undefined,
      }));
    } catch (error) {
      console.error('Failed to get sync history:', error);
      return [];
    }
  }

  async webhookHandler(eventType: string, data: any): Promise<void> {
    try {
      // Handle Zoho webhooks for real-time sync
      switch (eventType) {
        case 'invoice_created':
        case 'invoice_updated':
          await this.handleInvoiceWebhook(data);
          break;
        case 'customer_created':
        case 'customer_updated':
          await this.handleCustomerWebhook(data);
          break;
        case 'payment_created':
          await this.handlePaymentWebhook(data);
          break;
        default:
          console.log('Unhandled webhook event:', eventType);
      }
    } catch (error) {
      console.error('Error handling Zoho webhook:', error);
    }
  }

  private async handleInvoiceWebhook(data: any): Promise<void> {
    // Sync invoice changes from Zoho to local database
    await api.post('/integrations/zoho/webhook/invoice', data);
  }

  private async handleCustomerWebhook(data: any): Promise<void> {
    // Sync customer changes from Zoho to local database
    await api.post('/integrations/zoho/webhook/customer', data);
  }

  private async handlePaymentWebhook(data: any): Promise<void> {
    // Sync payment changes from Zoho to local database
    await api.post('/integrations/zoho/webhook/payment', data);
  }

  async setupWebhooks(): Promise<{
    success: boolean;
    webhookUrls?: string[];
    error?: string;
  }> {
    try {
      const response = await api.post('/integrations/zoho/setup-webhooks');
      return {
        success: true,
        webhookUrls: response.data.webhookUrls,
      };
    } catch (error: any) {
      console.error('Failed to setup Zoho webhooks:', error);
      return {
        success: false,
        error: error.response?.data?.message || 'Webhook setup failed',
      };
    }
  }

  async validateMapping(localData: any[], zohoData: any[]): Promise<{
    matched: Array<{ local: any; zoho: any; confidence: number }>;
    unmatched: { local: any[]; zoho: any[] };
    duplicates: any[];
  }> {
    try {
      const response = await api.post('/integrations/zoho/validate-mapping', {
        localData,
        zohoData,
      });
      return response.data;
    } catch (error) {
      console.error('Failed to validate mapping:', error);
      return {
        matched: [],
        unmatched: { local: localData, zoho: zohoData },
        duplicates: [],
      };
    }
  }

  async getOrganizationInfo(): Promise<{
    organization_id: string;
    name: string;
    currency_code: string;
    timezone: string;
    date_format: string;
  } | null> {
    try {
      const response = await api.get('/integrations/zoho/organization');
      return response.data.organization;
    } catch (error) {
      console.error('Failed to get organization info:', error);
      return null;
    }
  }
}

export const zohoService = new ZohoService();