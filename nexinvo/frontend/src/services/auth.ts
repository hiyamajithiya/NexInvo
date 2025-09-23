import api, { TokenManager } from './api';
import type {
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  RegisterResponse,
  User,
  PasswordChangeRequest
} from '../types/auth';

export class AuthService {
  static async login(credentials: LoginRequest): Promise<LoginResponse> {
    console.log('Starting login request...');
    console.log('API Base URL:', api.defaults.baseURL);
    console.log('Credentials email:', credentials.email);

    try {
      const endpoint = '/v1/auth/login/';
      const fullUrl = `${api.defaults.baseURL}${endpoint}`;
      console.log('Full URL:', fullUrl);

      const response = await api.post<LoginResponse>(endpoint, credentials);

      console.log('Login response received:', response);
      console.log('Response data:', response.data);

      if (!response.data) {
        throw new Error('Empty response from server');
      }

      const { access, refresh, user } = response.data;

      if (!access || !refresh) {
        throw new Error('No tokens received from server');
      }

      console.log('Tokens received, storing...');
      TokenManager.setTokens(access, refresh);
      console.log('Tokens stored successfully');

      return response.data;
    } catch (error: any) {
      console.error('=== AUTH SERVICE ERROR ===');
      console.error('Full error object:', error);

      if (error.code === 'ERR_NETWORK') {
        console.error('Network error - cannot reach backend');
        console.error('Check if backend is running at:', api.defaults.baseURL);
      }

      if (error.response) {
        console.error('Response error:');
        console.error('- Status:', error.response.status);
        console.error('- Data:', error.response.data);
        console.error('- Headers:', error.response.headers);
      } else if (error.request) {
        console.error('Request made but no response received');
        console.error('- Request:', error.request);
      } else {
        console.error('Error setting up the request');
        console.error('- Message:', error.message);
      }

      if (error.config) {
        console.error('Request config:');
        console.error('- URL:', error.config.url);
        console.error('- Method:', error.config.method);
        console.error('- Base URL:', error.config.baseURL);
      }

      throw error;
    }
  }

  static async register(data: RegisterRequest): Promise<RegisterResponse> {
    const response = await api.post<RegisterResponse>('/auth/register/', data);
    const { access, refresh } = response.data;

    TokenManager.setTokens(access, refresh);
    return response.data;
  }

  static async logout(): Promise<void> {
    try {
      const refreshToken = TokenManager.getRefreshToken();
      if (refreshToken) {
        await api.post('/auth/logout/', { refresh_token: refreshToken });
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      TokenManager.clearTokens();
    }
  }

  static async getCurrentUser(): Promise<User> {
    const response = await api.get<User>('/v1/auth/me/');
    return response.data;
  }

  static async updateProfile(data: Partial<User>): Promise<User> {
    const response = await api.patch<User>('/auth/profile/', data);
    return response.data;
  }

  static async changePassword(data: PasswordChangeRequest): Promise<void> {
    await api.post('/auth/password/change/', data);
  }

  static async toggleTwoFactor(): Promise<{ two_factor_enabled: boolean; message: string }> {
    const response = await api.post<{ two_factor_enabled: boolean; message: string }>('/auth/2fa/toggle/');
    return response.data;
  }

  static async healthCheck(): Promise<{ status: string; message: string }> {
    const response = await api.get<{ status: string; message: string }>('/auth/health/');
    return response.data;
  }

  static isAuthenticated(): boolean {
    return TokenManager.isAuthenticated();
  }
}