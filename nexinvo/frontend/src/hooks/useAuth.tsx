import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { AuthService } from '../services/auth';
import type { AuthContextType, AuthState, LoginRequest, RegisterRequest, User, PasswordChangeRequest } from '../types/auth';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true,
  });

  // Initialize auth state - only run once
  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
      try {
        if (AuthService.isAuthenticated()) {
          const user = await AuthService.getCurrentUser();
          if (mounted) {
            setState({
              user,
              isAuthenticated: true,
              isLoading: false,
            });
          }
        } else {
          if (mounted) {
            setState({
              user: null,
              isAuthenticated: false,
              isLoading: false,
            });
          }
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
        if (mounted) {
          setState({
            user: null,
            isAuthenticated: false,
            isLoading: false,
          });
        }
      }
    };

    initializeAuth();

    return () => {
      mounted = false;
    };
  }, []);

  // Stable login function
  const login = useCallback(async (credentials: LoginRequest): Promise<void> => {
    try {
      setState(prev => ({ ...prev, isLoading: true }));
      const response = await AuthService.login(credentials);

      if (response && response.user) {
        setState({
          user: response.user,
          isAuthenticated: true,
          isLoading: false,
        });
        // Force a page reload to ensure navigation works
        setTimeout(() => {
          window.location.href = '/dashboard';
        }, 100);
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (error: any) {
      console.error('Auth login error:', error);
      setState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
      });
      throw error;
    }
  }, []);

  // Stable register function
  const register = useCallback(async (data: RegisterRequest): Promise<void> => {
    try {
      setState(prev => ({ ...prev, isLoading: true }));
      const response = await AuthService.register(data);
      setState({
        user: response.user,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (error) {
      setState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
      });
      throw error;
    }
  }, []);

  // Stable logout function
  const logout = useCallback(async (): Promise<void> => {
    try {
      await AuthService.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
      });
    }
  }, []);

  // Stable updateProfile function
  const updateProfile = useCallback(async (data: Partial<User>): Promise<void> => {
    try {
      const updatedUser = await AuthService.updateProfile(data);
      setState(prev => ({
        ...prev,
        user: updatedUser,
      }));
    } catch (error) {
      throw error;
    }
  }, []);

  // Stable changePassword function
  const changePassword = useCallback(async (data: PasswordChangeRequest): Promise<void> => {
    try {
      await AuthService.changePassword(data);
    } catch (error) {
      throw error;
    }
  }, []);

  // Memoized context value to prevent unnecessary re-renders
  const contextValue = useMemo<AuthContextType>(() => ({
    user: state.user,
    isAuthenticated: state.isAuthenticated,
    isLoading: state.isLoading,
    login,
    register,
    logout,
    updateProfile,
    changePassword,
  }), [state, login, register, logout, updateProfile, changePassword]);

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

// Custom hook with proper Fast Refresh support
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}