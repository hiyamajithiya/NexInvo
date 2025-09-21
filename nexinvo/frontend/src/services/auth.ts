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
    const response = await api.post<LoginResponse>('/auth/login/', credentials);
    const { access, refresh, user } = response.data;

    TokenManager.setTokens(access, refresh);
    return response.data;
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
    const response = await api.get<User>('/auth/me/');
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