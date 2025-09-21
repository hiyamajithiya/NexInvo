import { api } from './api';

export interface WebhookEndpoint {
  id: string;
  name: string;
  url: string;
  method: 'POST' | 'PUT' | 'PATCH';
  headers: Record<string, string>;
  events: WebhookEvent[];
  isActive: boolean;
  secret?: string;
  retryPolicy: {
    maxRetries: number;
    retryDelay: number; // in milliseconds
    backoffMultiplier: number;
  };
  authentication?: {
    type: 'none' | 'basic' | 'bearer' | 'api_key';
    credentials: Record<string, string>;
  };
  createdAt: Date;
  lastTriggered?: Date;
  lastSuccess?: Date;
  lastFailure?: Date;
}

export interface WebhookEvent {
  id: string;
  name: string;
  description: string;
  payload: {
    event: string;
    data: any;
    timestamp: Date;
    version: string;
  };
}

export interface WebhookLog {
  id: string;
  webhookId: string;
  event: string;
  url: string;
  method: string;
  requestHeaders: Record<string, string>;
  requestBody: any;
  responseStatus: number;
  responseHeaders: Record<string, string>;
  responseBody: any;
  duration: number; // in milliseconds
  success: boolean;
  error?: string;
  timestamp: Date;
  retryCount: number;
}

export interface WebhookStats {
  totalEndpoints: number;
  activeEndpoints: number;
  totalDeliveries: number;
  successfulDeliveries: number;
  failedDeliveries: number;
  averageResponseTime: number;
  lastDelivery?: Date;
}

export const WEBHOOK_EVENTS = {
  INVOICE_CREATED: 'invoice.created',
  INVOICE_UPDATED: 'invoice.updated',
  INVOICE_DELETED: 'invoice.deleted',
  INVOICE_PAID: 'invoice.paid',
  INVOICE_OVERDUE: 'invoice.overdue',
  CLIENT_CREATED: 'client.created',
  CLIENT_UPDATED: 'client.updated',
  CLIENT_DELETED: 'client.deleted',
  PAYMENT_RECEIVED: 'payment.received',
  PAYMENT_UPDATED: 'payment.updated',
  USER_LOGIN: 'user.login',
  USER_LOGOUT: 'user.logout',
  BACKUP_COMPLETED: 'backup.completed',
  SYNC_COMPLETED: 'sync.completed',
} as const;

class WebhookService {
  async getWebhooks(): Promise<WebhookEndpoint[]> {
    try {
      const response = await api.get('/webhooks');
      return response.data.map((webhook: any) => ({
        ...webhook,
        createdAt: new Date(webhook.createdAt),
        lastTriggered: webhook.lastTriggered ? new Date(webhook.lastTriggered) : undefined,
        lastSuccess: webhook.lastSuccess ? new Date(webhook.lastSuccess) : undefined,
        lastFailure: webhook.lastFailure ? new Date(webhook.lastFailure) : undefined,
      }));
    } catch (error) {
      console.error('Failed to get webhooks:', error);
      return [];
    }
  }

  async createWebhook(webhook: Omit<WebhookEndpoint, 'id' | 'createdAt' | 'lastTriggered' | 'lastSuccess' | 'lastFailure'>): Promise<{
    success: boolean;
    webhook?: WebhookEndpoint;
    error?: string;
  }> {
    try {
      const response = await api.post('/webhooks', webhook);
      return {
        success: true,
        webhook: {
          ...response.data,
          createdAt: new Date(response.data.createdAt),
        },
      };
    } catch (error: any) {
      console.error('Failed to create webhook:', error);
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to create webhook',
      };
    }
  }

  async updateWebhook(id: string, updates: Partial<WebhookEndpoint>): Promise<{
    success: boolean;
    webhook?: WebhookEndpoint;
    error?: string;
  }> {
    try {
      const response = await api.put(`/webhooks/${id}`, updates);
      return {
        success: true,
        webhook: {
          ...response.data,
          createdAt: new Date(response.data.createdAt),
          lastTriggered: response.data.lastTriggered ? new Date(response.data.lastTriggered) : undefined,
          lastSuccess: response.data.lastSuccess ? new Date(response.data.lastSuccess) : undefined,
          lastFailure: response.data.lastFailure ? new Date(response.data.lastFailure) : undefined,
        },
      };
    } catch (error: any) {
      console.error('Failed to update webhook:', error);
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to update webhook',
      };
    }
  }

  async deleteWebhook(id: string): Promise<boolean> {
    try {
      await api.delete(`/webhooks/${id}`);
      return true;
    } catch (error) {
      console.error('Failed to delete webhook:', error);
      return false;
    }
  }

  async testWebhook(id: string): Promise<{
    success: boolean;
    status?: number;
    responseTime?: number;
    error?: string;
  }> {
    try {
      const response = await api.post(`/webhooks/${id}/test`);
      return {
        success: true,
        status: response.data.status,
        responseTime: response.data.responseTime,
      };
    } catch (error: any) {
      console.error('Failed to test webhook:', error);
      return {
        success: false,
        error: error.response?.data?.message || 'Test failed',
      };
    }
  }

  async triggerWebhook(eventType: string, data: any): Promise<void> {
    try {
      await api.post('/webhooks/trigger', {
        event: eventType,
        data,
        timestamp: new Date().toISOString(),
        version: '1.0',
      });
    } catch (error) {
      console.error('Failed to trigger webhook:', error);
    }
  }

  async getWebhookLogs(webhookId: string, params?: {
    limit?: number;
    offset?: number;
    startDate?: Date;
    endDate?: Date;
    success?: boolean;
  }): Promise<{
    logs: WebhookLog[];
    total: number;
  }> {
    try {
      const queryParams = {
        ...params,
        startDate: params?.startDate?.toISOString(),
        endDate: params?.endDate?.toISOString(),
      };

      const response = await api.get(`/webhooks/${webhookId}/logs`, { params: queryParams });
      return {
        logs: response.data.logs.map((log: any) => ({
          ...log,
          timestamp: new Date(log.timestamp),
        })),
        total: response.data.total,
      };
    } catch (error) {
      console.error('Failed to get webhook logs:', error);
      return { logs: [], total: 0 };
    }
  }

  async retryFailedDelivery(logId: string): Promise<{
    success: boolean;
    newLogId?: string;
    error?: string;
  }> {
    try {
      const response = await api.post(`/webhooks/logs/${logId}/retry`);
      return {
        success: true,
        newLogId: response.data.logId,
      };
    } catch (error: any) {
      console.error('Failed to retry webhook delivery:', error);
      return {
        success: false,
        error: error.response?.data?.message || 'Retry failed',
      };
    }
  }

  async getWebhookStats(webhookId?: string): Promise<WebhookStats> {
    try {
      const url = webhookId ? `/webhooks/${webhookId}/stats` : '/webhooks/stats';
      const response = await api.get(url);
      return {
        ...response.data,
        lastDelivery: response.data.lastDelivery ? new Date(response.data.lastDelivery) : undefined,
      };
    } catch (error) {
      console.error('Failed to get webhook stats:', error);
      return {
        totalEndpoints: 0,
        activeEndpoints: 0,
        totalDeliveries: 0,
        successfulDeliveries: 0,
        failedDeliveries: 0,
        averageResponseTime: 0,
      };
    }
  }

  async getAvailableEvents(): Promise<Array<{
    id: string;
    name: string;
    description: string;
    payloadExample: any;
  }>> {
    try {
      const response = await api.get('/webhooks/events');
      return response.data;
    } catch (error) {
      console.error('Failed to get available events:', error);
      return [];
    }
  }

  async validateWebhookUrl(url: string): Promise<{
    isValid: boolean;
    isReachable: boolean;
    responseTime?: number;
    error?: string;
  }> {
    try {
      const response = await api.post('/webhooks/validate-url', { url });
      return response.data;
    } catch (error: any) {
      console.error('Failed to validate webhook URL:', error);
      return {
        isValid: false,
        isReachable: false,
        error: error.response?.data?.message || 'Validation failed',
      };
    }
  }

  async generateSecret(): Promise<string> {
    try {
      const response = await api.post('/webhooks/generate-secret');
      return response.data.secret;
    } catch (error) {
      console.error('Failed to generate webhook secret:', error);
      return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    }
  }

  async verifySignature(payload: string, signature: string, secret: string): Promise<boolean> {
    try {
      const response = await api.post('/webhooks/verify-signature', {
        payload,
        signature,
        secret,
      });
      return response.data.isValid;
    } catch (error) {
      console.error('Failed to verify webhook signature:', error);
      return false;
    }
  }

  // Event-specific trigger methods
  async triggerInvoiceCreated(invoice: any): Promise<void> {
    await this.triggerWebhook(WEBHOOK_EVENTS.INVOICE_CREATED, {
      invoice: {
        id: invoice.id,
        number: invoice.number,
        clientId: invoice.clientId,
        clientName: invoice.clientName,
        amount: invoice.total,
        issueDate: invoice.issueDate,
        dueDate: invoice.dueDate,
        status: invoice.status,
      },
    });
  }

  async triggerInvoiceUpdated(invoice: any, changes: any): Promise<void> {
    await this.triggerWebhook(WEBHOOK_EVENTS.INVOICE_UPDATED, {
      invoice: {
        id: invoice.id,
        number: invoice.number,
        clientId: invoice.clientId,
        clientName: invoice.clientName,
        amount: invoice.total,
        status: invoice.status,
      },
      changes,
    });
  }

  async triggerInvoicePaid(invoice: any, payment: any): Promise<void> {
    await this.triggerWebhook(WEBHOOK_EVENTS.INVOICE_PAID, {
      invoice: {
        id: invoice.id,
        number: invoice.number,
        clientId: invoice.clientId,
        clientName: invoice.clientName,
        amount: invoice.total,
      },
      payment: {
        id: payment.id,
        amount: payment.amount,
        method: payment.method,
        date: payment.date,
      },
    });
  }

  async triggerClientCreated(client: any): Promise<void> {
    await this.triggerWebhook(WEBHOOK_EVENTS.CLIENT_CREATED, {
      client: {
        id: client.id,
        name: client.name,
        email: client.email,
        phone: client.phone,
        company: client.companyName,
      },
    });
  }

  async triggerPaymentReceived(payment: any): Promise<void> {
    await this.triggerWebhook(WEBHOOK_EVENTS.PAYMENT_RECEIVED, {
      payment: {
        id: payment.id,
        invoiceId: payment.invoiceId,
        invoiceNumber: payment.invoiceNumber,
        amount: payment.amount,
        method: payment.method,
        date: payment.date,
        clientId: payment.clientId,
        clientName: payment.clientName,
      },
    });
  }

  async triggerSyncCompleted(syncResult: any): Promise<void> {
    await this.triggerWebhook(WEBHOOK_EVENTS.SYNC_COMPLETED, {
      sync: {
        type: syncResult.type,
        syncedItems: syncResult.syncedItems,
        failedItems: syncResult.failedItems,
        duration: syncResult.duration,
        timestamp: new Date().toISOString(),
      },
    });
  }

  async bulkRetryFailedDeliveries(webhookId: string, timeRange?: {
    startDate: Date;
    endDate: Date;
  }): Promise<{
    success: boolean;
    retriedCount: number;
    error?: string;
  }> {
    try {
      const response = await api.post(`/webhooks/${webhookId}/bulk-retry`, {
        timeRange: timeRange ? {
          startDate: timeRange.startDate.toISOString(),
          endDate: timeRange.endDate.toISOString(),
        } : undefined,
      });
      return {
        success: true,
        retriedCount: response.data.retriedCount,
      };
    } catch (error: any) {
      console.error('Failed to bulk retry webhook deliveries:', error);
      return {
        success: false,
        retriedCount: 0,
        error: error.response?.data?.message || 'Bulk retry failed',
      };
    }
  }

  async exportWebhookLogs(webhookId: string, format: 'json' | 'csv' = 'json'): Promise<{
    success: boolean;
    downloadUrl?: string;
    error?: string;
  }> {
    try {
      const response = await api.get(`/webhooks/${webhookId}/logs/export`, {
        params: { format },
      });
      return {
        success: true,
        downloadUrl: response.data.downloadUrl,
      };
    } catch (error: any) {
      console.error('Failed to export webhook logs:', error);
      return {
        success: false,
        error: error.response?.data?.message || 'Export failed',
      };
    }
  }
}

export const webhookService = new WebhookService();