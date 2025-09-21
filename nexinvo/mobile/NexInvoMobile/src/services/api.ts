import axios, { AxiosInstance, AxiosRequestConfig, AxiosError } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { store } from '../store';
import { clearAuth, refreshAccessToken } from '../store/slices/authSlice';
import { addNotification } from '../store/slices/uiSlice';

// API Configuration
const API_BASE_URL = __DEV__
  ? 'http://10.0.2.2:8000/api/v1' // Android emulator
  : 'https://api.nexinvo.com/api/v1'; // Production URL

// Create axios instance
const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

// Request interceptor
apiClient.interceptors.request.use(
  async (config) => {
    // Check network connectivity
    const netState = await NetInfo.fetch();
    if (!netState.isConnected) {
      throw new Error('No internet connection');
    }

    // Add auth token to requests
    const token = await AsyncStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean };

    // Handle 401 Unauthorized - Token expired
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = await AsyncStorage.getItem('refresh_token');

        if (refreshToken) {
          // Attempt to refresh token
          const result = await store.dispatch(refreshAccessToken(refreshToken));

          if (refreshAccessToken.fulfilled.match(result)) {
            // Retry original request with new token
            const newToken = result.payload.access;
            await AsyncStorage.setItem('access_token', newToken);

            if (originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${newToken}`;
            }

            return apiClient(originalRequest);
          }
        }
      } catch (refreshError) {
        // Refresh failed, logout user
        store.dispatch(clearAuth());
        store.dispatch(
          addNotification({
            type: 'error',
            message: 'Session expired. Please login again.',
          })
        );
        throw refreshError;
      }
    }

    // Handle network errors
    if (!error.response) {
      store.dispatch(
        addNotification({
          type: 'error',
          message: 'Network error. Please check your connection.',
        })
      );
    }

    return Promise.reject(error);
  }
);

// API helper functions
export const setAuthToken = async (token: string) => {
  await AsyncStorage.setItem('access_token', token);
};

export const clearAuthToken = async () => {
  await AsyncStorage.removeItem('access_token');
  await AsyncStorage.removeItem('refresh_token');
};

export const isNetworkAvailable = async (): Promise<boolean> => {
  const state = await NetInfo.fetch();
  return state.isConnected || false;
};

// Export configured client
export default apiClient;

// API Endpoints
export const API_ENDPOINTS = {
  // Auth
  LOGIN: '/auth/login/',
  LOGOUT: '/auth/logout/',
  REGISTER: '/auth/register/',
  REFRESH_TOKEN: '/auth/refresh/',
  VERIFY_EMAIL: '/auth/verify-email/',
  RESET_PASSWORD: '/auth/reset-password/',

  // Invoices
  INVOICES: '/invoices/',
  INVOICE_DETAIL: (id: string) => `/invoices/${id}/`,
  INVOICE_PDF: (id: string) => `/invoices/${id}/generate_pdf/`,
  INVOICE_SEND: (id: string) => `/invoices/${id}/send_email/`,

  // Clients
  CLIENTS: '/tenants/clients/',
  CLIENT_DETAIL: (id: string) => `/tenants/clients/${id}/`,

  // Items
  ITEMS: '/invoices/items/',
  ITEM_DETAIL: (id: string) => `/invoices/items/${id}/`,

  // Integrations
  INTEGRATIONS: '/integrations/integrations/',
  INTEGRATION_DETAIL: (id: string) => `/integrations/integrations/${id}/`,
  INTEGRATION_TEST: (id: string) => `/integrations/integrations/${id}/test_connection/`,
  TALLY_EXPORT: '/integrations/tally/export/',
  ZOHO_SYNC: '/integrations/zoho/sync/customers/',

  // Reports
  DASHBOARD: '/reports/dashboard/',
  GST_REPORT: '/reports/gst-return/',
  SALES_REPORT: '/reports/sales-report/',

  // Webhooks
  WEBHOOKS: '/integrations/webhooks/',
  WEBHOOK_TRIGGER: '/integrations/webhooks/trigger/',
};