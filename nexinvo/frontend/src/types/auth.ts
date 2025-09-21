export interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone?: string;
  designation?: string;
  ca_registration_no?: string;
  is_ca_user: boolean;
  two_factor_enabled: boolean;
  date_joined: string;
  last_login?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  access: string;
  refresh: string;
  user: User;
}

export interface RegisterRequest {
  email: string;
  password: string;
  password_confirm: string;
  first_name: string;
  last_name: string;
  phone?: string;
  designation?: string;
  ca_registration_no?: string;
}

export interface RegisterResponse {
  user: User;
  access: string;
  refresh: string;
  message: string;
}

export interface PasswordChangeRequest {
  current_password: string;
  new_password: string;
  new_password_confirm: string;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export interface AuthContextType extends AuthState {
  login: (credentials: LoginRequest) => Promise<void>;
  register: (data: RegisterRequest) => Promise<void>;
  logout: () => void;
  updateProfile: (data: Partial<User>) => Promise<void>;
  changePassword: (data: PasswordChangeRequest) => Promise<void>;
}