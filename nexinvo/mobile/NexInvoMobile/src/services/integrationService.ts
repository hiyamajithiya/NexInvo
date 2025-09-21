import apiClient from './api';
import { API_ENDPOINTS } from './api';
import { Integration } from '../store/slices/integrationSlice';

class IntegrationService {
  async getIntegrations(): Promise<Integration[]> {
    const response = await apiClient.get(API_ENDPOINTS.INTEGRATIONS);
    return response.data.results || response.data;
  }

  async getIntegrationById(id: string): Promise<Integration> {
    const response = await apiClient.get(API_ENDPOINTS.INTEGRATION_DETAIL(id));
    return response.data;
  }

  async testConnection(id: string): Promise<{ success: boolean; message: string }> {
    const response = await apiClient.post(API_ENDPOINTS.INTEGRATION_TEST(id));
    return response.data;
  }

  async exportToTally(invoiceIds: string[]): Promise<{ success: boolean; message: string }> {
    const response = await apiClient.post(API_ENDPOINTS.TALLY_EXPORT, {
      invoice_ids: invoiceIds,
    });
    return response.data;
  }

  async syncZohoCustomers(): Promise<{ success: boolean; message: string; count?: number }> {
    const response = await apiClient.post(API_ENDPOINTS.ZOHO_SYNC);
    return response.data;
  }

  async getWebhooks(): Promise<any[]> {
    const response = await apiClient.get(API_ENDPOINTS.WEBHOOKS);
    return response.data.results || response.data;
  }

  async triggerWebhook(webhookId: string, data: any): Promise<{ success: boolean; message: string }> {
    const response = await apiClient.post(API_ENDPOINTS.WEBHOOK_TRIGGER, {
      webhook_id: webhookId,
      data,
    });
    return response.data;
  }

  async updateIntegration(id: string, config: Record<string, any>): Promise<Integration> {
    const response = await apiClient.patch(API_ENDPOINTS.INTEGRATION_DETAIL(id), {
      configuration: config,
    });
    return response.data;
  }

  async toggleIntegration(id: string, isActive: boolean): Promise<Integration> {
    const response = await apiClient.patch(API_ENDPOINTS.INTEGRATION_DETAIL(id), {
      is_active: isActive,
    });
    return response.data;
  }
}

export const integrationService = new IntegrationService();