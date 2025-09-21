import { createSlice, PayloadAction, createAsyncThunk } from '@reduxjs/toolkit';
import { authService } from '../../services/authService';
import * as Keychain from 'react-native-keychain';

interface User {
  id: string;
  email: string;
  name: string;
  tenant_id: string;
  role: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  biometricEnabled: boolean;
  isBiometricAvailable: boolean;
}

const initialState: AuthState = {
  user: null,
  token: null,
  refreshToken: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,
  biometricEnabled: false,
  isBiometricAvailable: false,
};

// Async thunks
export const login = createAsyncThunk(
  'auth/login',
  async ({ email, password }: { email: string; password: string }) => {
    const response = await authService.login(email, password);

    // Store tokens securely
    await Keychain.setInternetCredentials(
      'nexinvo',
      email,
      response.access
    );

    return response;
  }
);

export const logout = createAsyncThunk(
  'auth/logout',
  async () => {
    await authService.logout();
    await Keychain.resetInternetCredentials('nexinvo');
  }
);

export const refreshAccessToken = createAsyncThunk(
  'auth/refreshToken',
  async (refreshToken: string) => {
    const response = await authService.refreshToken(refreshToken);
    return response;
  }
);

export const checkBiometricAvailability = createAsyncThunk(
  'auth/checkBiometric',
  async () => {
    return await authService.isBiometricAvailable();
  }
);

export const loginWithBiometric = createAsyncThunk(
  'auth/loginWithBiometric',
  async () => {
    const result = await authService.loginWithBiometric();
    if (!result) {
      throw new Error('Biometric authentication failed');
    }
    return result;
  }
);

export const verifyBiometric = createAsyncThunk(
  'auth/verifyBiometric',
  async () => {
    const credentials = await Keychain.getInternetCredentials('nexinvo');
    if (credentials) {
      return {
        username: credentials.username,
        password: credentials.password,
      };
    }
    throw new Error('No credentials found');
  }
);

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setUser: (state, action: PayloadAction<User>) => {
      state.user = action.payload;
    },
    setToken: (state, action: PayloadAction<string>) => {
      state.token = action.payload;
    },
    setBiometricEnabled: (state, action: PayloadAction<boolean>) => {
      state.biometricEnabled = action.payload;
    },
    clearAuth: (state) => {
      state.user = null;
      state.token = null;
      state.refreshToken = null;
      state.isAuthenticated = false;
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Login
      .addCase(login.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(login.fulfilled, (state, action) => {
        state.isLoading = false;
        state.isAuthenticated = true;
        state.token = action.payload.access;
        state.refreshToken = action.payload.refresh;
        state.user = action.payload.user;
      })
      .addCase(login.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message || 'Login failed';
      })
      // Logout
      .addCase(logout.fulfilled, (state) => {
        state.user = null;
        state.token = null;
        state.refreshToken = null;
        state.isAuthenticated = false;
        state.error = null;
      })
      // Refresh token
      .addCase(refreshAccessToken.fulfilled, (state, action) => {
        state.token = action.payload.access;
      })
      // Check biometric availability
      .addCase(checkBiometricAvailability.fulfilled, (state, action) => {
        state.isBiometricAvailable = action.payload;
      })
      // Biometric login
      .addCase(loginWithBiometric.fulfilled, (state, action) => {
        state.isLoading = false;
        state.isAuthenticated = true;
        state.token = action.payload.access;
        state.refreshToken = action.payload.refresh;
        state.user = action.payload.user;
      })
      .addCase(loginWithBiometric.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message || 'Biometric login failed';
      })
      // Biometric verification
      .addCase(verifyBiometric.fulfilled, (state) => {
        state.isAuthenticated = true;
      });
  },
});

export const { setUser, setToken, setBiometricEnabled, clearAuth } = authSlice.actions;
export default authSlice.reducer;