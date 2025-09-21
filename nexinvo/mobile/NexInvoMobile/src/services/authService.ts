import apiClient from './api';
import { API_ENDPOINTS } from './api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Keychain from 'react-native-keychain';
import TouchID from 'react-native-touch-id';

interface LoginResponse {
  access: string;
  refresh: string;
  user: {
    id: string;
    email: string;
    username: string;
    first_name: string;
    last_name: string;
    tenant: string;
  };
}

interface RegisterResponse {
  user: {
    id: string;
    email: string;
    username: string;
  };
  message: string;
}

class AuthService {
  async login(email: string, password: string): Promise<LoginResponse> {
    const response = await apiClient.post(API_ENDPOINTS.LOGIN, {
      email,
      password,
    });

    // Store tokens
    await AsyncStorage.setItem('access_token', response.data.access);
    await AsyncStorage.setItem('refresh_token', response.data.refresh);
    await AsyncStorage.setItem('user', JSON.stringify(response.data.user));

    // Store credentials securely for biometric login
    await Keychain.setInternetCredentials(
      'nexinvo',
      email,
      password
    );

    return response.data;
  }

  async logout(): Promise<void> {
    try {
      await apiClient.post(API_ENDPOINTS.LOGOUT);
    } catch (error) {
      // Continue with local logout even if API fails
      console.error('Logout API error:', error);
    }

    // Clear stored data
    await AsyncStorage.multiRemove([
      'access_token',
      'refresh_token',
      'user',
    ]);

    // Clear keychain
    await Keychain.resetInternetCredentials('nexinvo');
  }

  async register(data: {
    email: string;
    password: string;
    username: string;
    first_name?: string;
    last_name?: string;
  }): Promise<RegisterResponse> {
    const response = await apiClient.post(API_ENDPOINTS.REGISTER, data);
    return response.data;
  }

  async refreshToken(refreshToken: string): Promise<{ access: string; refresh: string }> {
    const response = await apiClient.post(API_ENDPOINTS.REFRESH_TOKEN, {
      refresh: refreshToken,
    });

    // Update stored tokens
    await AsyncStorage.setItem('access_token', response.data.access);
    if (response.data.refresh) {
      await AsyncStorage.setItem('refresh_token', response.data.refresh);
    }

    return response.data;
  }

  async verifyEmail(token: string): Promise<void> {
    await apiClient.post(API_ENDPOINTS.VERIFY_EMAIL, { token });
  }

  async resetPassword(email: string): Promise<void> {
    await apiClient.post(API_ENDPOINTS.RESET_PASSWORD, { email });
  }

  async getCurrentUser() {
    const userStr = await AsyncStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
  }

  async isAuthenticated(): Promise<boolean> {
    const token = await AsyncStorage.getItem('access_token');
    return !!token;
  }

  // Biometric authentication
  async isBiometricAvailable(): Promise<boolean> {
    try {
      const biometryType = await TouchID.isSupported();
      return !!biometryType;
    } catch (error) {
      return false;
    }
  }

  async authenticateWithBiometric(): Promise<boolean> {
    try {
      const result = await TouchID.authenticate('Authenticate to access NexInvo', {
        title: 'Authentication Required',
        cancelText: 'Cancel',
        fallbackLabel: 'Use Passcode',
      });
      return result;
    } catch (error) {
      console.error('Biometric authentication failed:', error);
      return false;
    }
  }

  async loginWithBiometric(): Promise<LoginResponse | null> {
    try {
      // First authenticate with biometric
      const authenticated = await this.authenticateWithBiometric();
      if (!authenticated) {
        return null;
      }

      // Get stored credentials
      const credentials = await Keychain.getInternetCredentials('nexinvo');
      if (!credentials) {
        return null;
      }

      // Login with stored credentials
      return await this.login(credentials.username, credentials.password);
    } catch (error) {
      console.error('Biometric login failed:', error);
      return null;
    }
  }

  async enableBiometric(email: string, password: string): Promise<void> {
    // Store credentials securely
    await Keychain.setInternetCredentials('nexinvo', email, password);
  }

  async disableBiometric(): Promise<void> {
    await Keychain.resetInternetCredentials('nexinvo');
  }
}

export const authService = new AuthService();