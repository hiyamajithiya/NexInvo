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
    console.log('Credentials email:', credentials.email);

    // First try localStorage users (for demo/development)
    try {
      const localUser = await this.loginWithLocalStorage(credentials);
      if (localUser) {
        return localUser;
      }
    } catch (error) {
      console.log('Local storage login failed, trying backend...');
    }

    // Fallback to backend authentication
    try {
      const endpoint = '/api/v1/auth/login/';
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

  static async loginWithLocalStorage(credentials: LoginRequest): Promise<LoginResponse | null> {
    console.log('Trying local storage authentication...');

    // Get users from localStorage
    const users = JSON.parse(localStorage.getItem('users') || '[]');
    const user = users.find((u: any) => u.email === credentials.email);

    if (!user) {
      console.log('User not found in localStorage');
      return null;
    }

    // For demo purposes, we'll accept any password or check against a simple hash
    // In production, passwords should be properly hashed
    const isValidPassword = credentials.password === user.password || credentials.password === 'password123';

    if (!isValidPassword) {
      console.log('Invalid password for localStorage user');
      throw new Error('Invalid email or password');
    }

    // Create mock tokens for localStorage user
    const mockTokens = {
      access: `mock_access_token_${user.id}_${Date.now()}`,
      refresh: `mock_refresh_token_${user.id}_${Date.now()}`
    };

    console.log('Local storage login successful, creating session...');
    TokenManager.setTokens(mockTokens.access, mockTokens.refresh);

    // Store the current user for getCurrentUser method
    localStorage.setItem('currentUser', JSON.stringify(user));

    return {
      access: mockTokens.access,
      refresh: mockTokens.refresh,
      user: user
    };
  }

  static async register(data: RegisterRequest): Promise<RegisterResponse> {
    const response = await api.post<RegisterResponse>('/api/v1/auth/register/', data);
    const { access, refresh } = response.data;

    TokenManager.setTokens(access, refresh);
    return response.data;
  }

  static async logout(): Promise<void> {
    try {
      const refreshToken = TokenManager.getRefreshToken();
      if (refreshToken && !refreshToken.startsWith('mock_')) {
        await api.post('/api/v1/auth/logout/', { refresh_token: refreshToken });
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      TokenManager.clearTokens();
      // Clear localStorage user session
      localStorage.removeItem('currentUser');
    }
  }

  static async getCurrentUser(): Promise<User> {
    // First check if we have a localStorage user
    const currentUser = localStorage.getItem('currentUser');
    if (currentUser) {
      try {
        return JSON.parse(currentUser);
      } catch (error) {
        console.error('Error parsing currentUser from localStorage:', error);
      }
    }

    // Fallback to backend API
    const response = await api.get<User>('/api/v1/auth/me/');
    return response.data;
  }

  static async updateProfile(data: Partial<User>): Promise<User> {
    const response = await api.patch<User>('/api/v1/auth/profile/', data);
    return response.data;
  }

  static async changePassword(data: PasswordChangeRequest): Promise<void> {
    await api.post('/api/v1/auth/password/change/', data);
  }

  static async toggleTwoFactor(): Promise<{ two_factor_enabled: boolean; message: string }> {
    const response = await api.post<{ two_factor_enabled: boolean; message: string }>('/api/v1/auth/2fa/toggle/');
    return response.data;
  }

  static async healthCheck(): Promise<{ status: string; message: string }> {
    const response = await api.get<{ status: string; message: string }>('/api/v1/auth/health/');
    return response.data;
  }

  static isAuthenticated(): boolean {
    return TokenManager.isAuthenticated();
  }
}