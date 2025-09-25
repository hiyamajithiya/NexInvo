export type BusinessType =
  | 'professional'
  | 'trader'
  | 'manufacturer'
  | 'contractor'
  | 'epc_contractor'
  | 'manpower_supplier'
  | 'software_it'
  | 'transport_logistics'
  | 'real_estate'
  | 'retail'
  | 'hospitality'
  | 'healthcare'
  | 'education'
  | 'agriculture'
  | 'other';

export interface Tenant {
  id: string;
  name: string;
  business_type: BusinessType;
  aato_threshold: number;
  e_invoice_enabled: boolean;
  b2c_qr_enabled: boolean;
  company_details: Record<string, any>;
  gst_settings: Record<string, any>;
  business_config?: Record<string, any>;
  subscription_plan: 'free' | 'basic' | 'professional' | 'enterprise';
  billing_details: Record<string, any>;
  created_at: string;
  updated_at: string;
  created_by?: string;
  updated_by?: string;
}

export interface TenantMembership {
  id: string;
  user_id: string;
  tenant_id: string;
  role: 'owner' | 'admin' | 'manager' | 'finance_user' | 'viewer' | 'client_readonly';
  permissions: Record<string, any>;
  joined_at: string;
  invited_by?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  user: {
    id: string;
    email: string;
    first_name: string;
    last_name: string;
  };
  tenant: {
    id: string;
    name: string;
  };
}

export interface CreateTenantRequest {
  name: string;
  business_type: BusinessType;
  subscription_plan: 'free' | 'basic' | 'professional' | 'enterprise';
  aato_threshold?: number;
  e_invoice_enabled?: boolean;
  b2c_qr_enabled?: boolean;
  company_details?: Record<string, any>;
  gst_settings?: Record<string, any>;
  business_config?: Record<string, any>;
  billing_details?: Record<string, any>;
}

export interface CreateUserRequest {
  email: string;
  first_name: string;
  last_name: string;
  password: string;
  phone?: string;
  designation?: string;
  tenant_id?: string;
  role?: 'owner' | 'admin' | 'manager' | 'finance_user' | 'viewer' | 'client_readonly';
}

export interface TenantStats {
  total_tenants: number;
  active_tenants: number;
  total_users: number;
  active_users: number;
  subscription_breakdown: Record<string, number>;
  business_type_breakdown: Record<string, number>;
}