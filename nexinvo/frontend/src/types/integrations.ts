export interface Integration {
  id: string;
  name: string;
  integration_type: string;
  is_active: boolean;
  configuration: Record<string, any>;
  credentials_encrypted: Record<string, any>;
  last_sync_at: string | null;
  sync_status: string;
  error_log: string;
  created_at: string;
  updated_at: string;
}

export interface WebhookEvent {
  id: string;
  event_type: string;
  entity_id: string;
  payload: Record<string, any>;
  delivery_status: 'pending' | 'delivered' | 'failed' | 'retrying';
  delivery_attempts: number;
  response_status_code: number | null;
  response_body: string;
  error_message: string;
  created_at: string;
  last_delivery_attempt: string | null;
  next_delivery_attempt: string | null;
}

export interface IntegrationDashboardStats {
  total_integrations: number;
  active_integrations: number;
  integrations_by_type: Record<string, {
    total: number;
    active: number;
    last_sync: string | null;
  }>;
  recent_sync_status: Record<string, any>;
  webhook_stats: {
    total_webhooks: number;
    delivered: number;
    failed: number;
    pending: number;
    delivery_rate: number;
    avg_delivery_time: number | null;
  };
}

export interface TallyExport {
  id: string;
  integration: string;
  export_type: string;
  date_from: string;
  date_to: string;
  invoice_count: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  xml_content: string;
  export_metadata: Record<string, any>;
  created_by: string;
  created_at: string;
}

export interface SyncLog {
  id: string;
  integration: string;
  entity_type: string;
  entity_id: string;
  action: 'create' | 'update' | 'delete' | 'sync';
  status: 'pending' | 'success' | 'failed';
  local_data: Record<string, any>;
  remote_data: Record<string, any>;
  error_message: string;
  sync_direction: 'push' | 'pull' | 'bidirectional';
  created_at: string;
}

export type IntegrationType = 'tally' | 'zoho' | 'dynamics365' | 'webhook' | 'generic';

export interface IntegrationCard {
  type: IntegrationType;
  title: string;
  description: string;
  icon: string;
  features: string[];
  status: 'connected' | 'available' | 'coming_soon';
  setupAction: () => void;
}

export interface WebhookConfiguration {
  webhook_url: string;
  platform?: 'make' | 'zapier' | 'n8n' | 'generic';
  enabled_events: string[];
  secret_key?: string;
  timeout?: number;
  max_retries?: number;
}

export interface ZohoConfiguration {
  client_id: string;
  client_secret: string;
  redirect_uri: string;
  organization_id: string;
  auto_sync?: boolean;
}

export interface Dynamics365Configuration {
  environment_url: string;
  tenant_id: string;
  client_id: string;
  client_secret: string;
  enable_advanced_mapping?: boolean;
}

export interface TallyConfiguration {
  company_name: string;
  gst_registration_type: 'regular' | 'composition' | 'unregistered';
  include_gst_details?: boolean;
  auto_ledger_creation?: boolean;
}