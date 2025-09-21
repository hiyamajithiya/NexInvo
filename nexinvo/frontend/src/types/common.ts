export interface ApiResponse<T> {
  data: T;
  message?: string;
  status: 'success' | 'error';
}

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface ErrorResponse {
  message: string;
  errors?: Record<string, string[]>;
  status: number;
}

export interface SelectOption {
  value: string;
  label: string;
}

export interface Toast {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  description?: string;
  duration?: number;
}

export interface LoadingState {
  isLoading: boolean;
  error: string | null;
}

export type BusinessType = 'ca_firm' | 'sme' | 'enterprise';
export type SubscriptionPlan = 'free' | 'basic' | 'professional' | 'enterprise';
export type TenantRole = 'ca_owner' | 'admin' | 'finance_user' | 'viewer' | 'client_readonly';