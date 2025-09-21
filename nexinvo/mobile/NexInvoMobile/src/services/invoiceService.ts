import apiClient from './api';
import { API_ENDPOINTS } from './api';
import { Invoice } from '../store/slices/invoiceSlice';

class InvoiceService {
  async getInvoices(filters?: any): Promise<Invoice[]> {
    const params = new URLSearchParams();
    
    if (filters) {
      Object.keys(filters).forEach(key => {
        if (filters[key]) {
          params.append(key, filters[key]);
        }
      });
    }

    const response = await apiClient.get(`${API_ENDPOINTS.INVOICES}?${params}`);
    return response.data.results || response.data;
  }

  async getInvoiceById(id: string): Promise<Invoice> {
    const response = await apiClient.get(API_ENDPOINTS.INVOICE_DETAIL(id));
    return response.data;
  }

  async createInvoice(invoiceData: Partial<Invoice>): Promise<Invoice> {
    const response = await apiClient.post(API_ENDPOINTS.INVOICES, invoiceData);
    return response.data;
  }

  async updateInvoice(id: string, invoiceData: Partial<Invoice>): Promise<Invoice> {
    const response = await apiClient.patch(API_ENDPOINTS.INVOICE_DETAIL(id), invoiceData);
    return response.data;
  }

  async deleteInvoice(id: string): Promise<void> {
    await apiClient.delete(API_ENDPOINTS.INVOICE_DETAIL(id));
  }

  async generatePDF(id: string): Promise<{ pdf_url: string }> {
    const response = await apiClient.post(API_ENDPOINTS.INVOICE_PDF(id));
    return response.data;
  }

  async sendEmail(id: string, email?: string): Promise<void> {
    const data = email ? { email } : {};
    await apiClient.post(API_ENDPOINTS.INVOICE_SEND(id), data);
  }

  async getDashboardStats(): Promise<{
    total_invoices: number;
    pending_amount: number;
    paid_amount: number;
    overdue_amount: number;
    monthly_revenue: number;
  }> {
    const response = await apiClient.get(API_ENDPOINTS.DASHBOARD);
    return response.data;
  }

  async getInvoicesByStatus(status: string): Promise<Invoice[]> {
    return this.getInvoices({ payment_status: status });
  }

  async searchInvoices(query: string): Promise<Invoice[]> {
    return this.getInvoices({ search: query });
  }

  async markAsPaid(id: string): Promise<Invoice> {
    return this.updateInvoice(id, { payment_status: 'paid' });
  }

  async markAsOverdue(id: string): Promise<Invoice> {
    return this.updateInvoice(id, { payment_status: 'overdue' });
  }
}

export const invoiceService = new InvoiceService();