import React, { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { configureStore, EnhancedStore } from '@reduxjs/toolkit';
import { authSlice } from '../../store/slices/authSlice';
import { invoiceSlice } from '../../store/slices/invoiceSlice';
import { clientSlice } from '../../store/slices/clientSlice';
import { uiSlice } from '../../store/slices/uiSlice';
import { integrationSlice } from '../../store/slices/integrationSlice';

// Mock initial states
export const mockAuthState = {
  user: {
    id: 'test-user-id',
    email: 'test@example.com',
    name: 'Test User',
    role: 'admin' as const,
  },
  token: 'mock-jwt-token',
  isAuthenticated: true,
  isLoading: false,
  error: null,
  biometricEnabled: true,
};

export const mockInvoiceState = {
  invoices: [
    {
      id: 'invoice-1',
      invoice_number: 'INV-001',
      client_id: 'client-1',
      client_name: 'Test Client',
      issue_date: '2023-01-01',
      due_date: '2023-01-31',
      status: 'pending' as const,
      subtotal: 1000,
      tax_amount: 180,
      grand_total: 1180,
      items: [
        {
          id: 'item-1',
          description: 'Test Service',
          quantity: 1,
          rate: 1000,
          amount: 1000,
        },
      ],
    },
  ],
  currentInvoice: null,
  isLoading: false,
  error: null,
  pagination: {
    page: 1,
    limit: 10,
    total: 1,
    totalPages: 1,
  },
  filters: {
    status: 'all',
    dateRange: null,
    clientId: null,
  },
  offlineQueue: [],
};

export const mockClientState = {
  clients: [
    {
      id: 'client-1',
      name: 'Test Client',
      email: 'client@example.com',
      phone: '+1234567890',
      address: '123 Test Street',
      city: 'Test City',
      state: 'Test State',
      pincode: '12345',
      gst_number: 'GST123456789',
      created_at: '2023-01-01T00:00:00Z',
      updated_at: '2023-01-01T00:00:00Z',
    },
  ],
  currentClient: null,
  isLoading: false,
  error: null,
  pagination: {
    page: 1,
    limit: 10,
    total: 1,
    totalPages: 1,
  },
};

export const mockUiState = {
  theme: 'light' as const,
  notifications: [],
  isOnline: true,
  loading: {},
  errors: {},
};

export const mockIntegrationState = {
  integrations: [
    {
      id: 'integration-1',
      name: 'Tally Integration',
      integration_type: 'tally' as const,
      is_active: true,
      configuration: {
        server_url: 'http://localhost:9000',
        company_name: 'Test Company',
      },
      last_sync_at: '2023-01-01T00:00:00Z',
      sync_status: 'completed',
    },
  ],
  isLoading: false,
  error: null,
  syncStatus: {},
};

// Create mock store
export function createMockStore(initialState?: any): EnhancedStore {
  return configureStore({
    reducer: {
      auth: authSlice.reducer,
      invoices: invoiceSlice.reducer,
      clients: clientSlice.reducer,
      ui: uiSlice.reducer,
      integrations: integrationSlice.reducer,
    },
    preloadedState: {
      auth: mockAuthState,
      invoices: mockInvoiceState,
      clients: mockClientState,
      ui: mockUiState,
      integrations: mockIntegrationState,
      ...initialState,
    },
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({
        serializableCheck: false,
      }),
  });
}

// All the providers wrapper
interface AllTheProvidersProps {
  children: React.ReactNode;
  store?: EnhancedStore;
  initialRoute?: string;
}

export function AllTheProviders({
  children,
  store = createMockStore(),
  initialRoute = 'Dashboard'
}: AllTheProvidersProps) {
  return (
    <Provider store={store}>
      <SafeAreaProvider
        initialMetrics={{
          frame: { x: 0, y: 0, width: 375, height: 812 },
          insets: { top: 44, left: 0, right: 0, bottom: 34 },
        }}
      >
        <NavigationContainer>
          {children}
        </NavigationContainer>
      </SafeAreaProvider>
    </Provider>
  );
}

// Custom render function
interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  store?: EnhancedStore;
  initialRoute?: string;
}

export function renderWithProviders(
  ui: ReactElement,
  options: CustomRenderOptions = {}
) {
  const { store = createMockStore(), initialRoute, ...renderOptions } = options;

  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <AllTheProviders store={store} initialRoute={initialRoute}>
        {children}
      </AllTheProviders>
    );
  }

  return {
    store,
    ...render(ui, { wrapper: Wrapper, ...renderOptions }),
  };
}

// Mock navigation helpers
export const mockNavigation = {
  navigate: jest.fn(),
  goBack: jest.fn(),
  setOptions: jest.fn(),
  addListener: jest.fn(() => jest.fn()),
  removeListener: jest.fn(),
  isFocused: jest.fn(() => true),
  canGoBack: jest.fn(() => true),
  getId: jest.fn(() => 'test-screen-id'),
  getParent: jest.fn(),
  dispatch: jest.fn(),
  reset: jest.fn(),
  setParams: jest.fn(),
  push: jest.fn(),
  pop: jest.fn(),
  popToTop: jest.fn(),
  replace: jest.fn(),
};

export const mockRoute = {
  key: 'test-route-key',
  name: 'TestScreen',
  params: {},
  path: undefined,
};

// Test data factories
export class TestDataFactory {
  static createInvoice(overrides = {}) {
    return {
      id: `invoice-${Date.now()}`,
      invoice_number: `INV-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`,
      client_id: 'client-1',
      client_name: 'Test Client',
      issue_date: '2023-01-01',
      due_date: '2023-01-31',
      status: 'pending' as const,
      subtotal: 1000,
      tax_amount: 180,
      grand_total: 1180,
      items: [
        {
          id: 'item-1',
          description: 'Test Service',
          quantity: 1,
          rate: 1000,
          amount: 1000,
        },
      ],
      notes: 'Test invoice notes',
      terms: 'Test terms and conditions',
      ...overrides,
    };
  }

  static createClient(overrides = {}) {
    return {
      id: `client-${Date.now()}`,
      name: 'Test Client',
      email: 'client@example.com',
      phone: '+1234567890',
      address: '123 Test Street',
      city: 'Test City',
      state: 'Test State',
      pincode: '12345',
      country: 'Test Country',
      gst_number: 'GST123456789',
      created_at: '2023-01-01T00:00:00Z',
      updated_at: '2023-01-01T00:00:00Z',
      ...overrides,
    };
  }

  static createUser(overrides = {}) {
    return {
      id: `user-${Date.now()}`,
      email: 'test@example.com',
      name: 'Test User',
      role: 'admin' as const,
      created_at: '2023-01-01T00:00:00Z',
      updated_at: '2023-01-01T00:00:00Z',
      ...overrides,
    };
  }

  static createIntegration(overrides = {}) {
    return {
      id: `integration-${Date.now()}`,
      name: 'Test Integration',
      integration_type: 'tally' as const,
      is_active: true,
      configuration: {
        server_url: 'http://localhost:9000',
        company_name: 'Test Company',
      },
      last_sync_at: '2023-01-01T00:00:00Z',
      sync_status: 'completed',
      ...overrides,
    };
  }
}

// Mock API responses
export const mockApiResponses = {
  login: {
    success: true,
    data: {
      user: mockAuthState.user,
      token: mockAuthState.token,
    },
  },
  invoices: {
    success: true,
    data: {
      invoices: mockInvoiceState.invoices,
      pagination: mockInvoiceState.pagination,
    },
  },
  clients: {
    success: true,
    data: {
      clients: mockClientState.clients,
      pagination: mockClientState.pagination,
    },
  },
  integrations: {
    success: true,
    data: {
      integrations: mockIntegrationState.integrations,
    },
  },
};

// Async testing utilities
export const waitFor = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const flushPromises = () => new Promise(setImmediate);

// Mock fetch responses
export function mockFetch(response: any, status = 200) {
  (global.fetch as jest.Mock).mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(response),
    text: () => Promise.resolve(JSON.stringify(response)),
  });
}

export function mockFetchError(error: string) {
  (global.fetch as jest.Mock).mockRejectedValueOnce(new Error(error));
}

// Performance testing utilities
export class PerformanceTestUtils {
  static measureRenderTime(renderFn: () => any): number {
    const start = performance.now();
    renderFn();
    return performance.now() - start;
  }

  static async measureAsyncOperation(operation: () => Promise<any>): Promise<number> {
    const start = performance.now();
    await operation();
    return performance.now() - start;
  }

  static createLargeDataset(size: number, factory: () => any): any[] {
    return Array.from({ length: size }, factory);
  }
}

// Accessibility testing utilities
export const accessibilityMatchers = {
  toBeAccessible: (element: any) => {
    const hasAccessibilityLabel = element.props.accessibilityLabel;
    const hasAccessibilityHint = element.props.accessibilityHint;
    const hasAccessibilityRole = element.props.accessibilityRole;

    return {
      pass: hasAccessibilityLabel || hasAccessibilityHint || hasAccessibilityRole,
      message: () =>
        hasAccessibilityLabel || hasAccessibilityHint || hasAccessibilityRole
          ? 'Element is accessible'
          : 'Element lacks accessibility properties',
    };
  },
};

// Snapshot testing utilities
export function createSnapshotTest(component: ReactElement, name: string) {
  return () => {
    const { toJSON } = renderWithProviders(component);
    expect(toJSON()).toMatchSnapshot(name);
  };
}

// Form testing utilities
export class FormTestUtils {
  static async fillForm(getByTestId: any, formData: Record<string, string>) {
    for (const [field, value] of Object.entries(formData)) {
      const input = getByTestId(field);
      if (input) {
        // Simulate text input
        input.props.onChangeText?.(value);
      }
    }
  }

  static async submitForm(getByTestId: any, submitButtonId = 'submit-button') {
    const submitButton = getByTestId(submitButtonId);
    if (submitButton) {
      submitButton.props.onPress?.();
    }
  }
}

// Network testing utilities
export class NetworkTestUtils {
  static mockOnlineState() {
    jest.mock('@react-native-community/netinfo', () => ({
      fetch: jest.fn(() =>
        Promise.resolve({
          isConnected: true,
          isInternetReachable: true,
          type: 'wifi',
        })
      ),
      addEventListener: jest.fn(() => jest.fn()),
    }));
  }

  static mockOfflineState() {
    jest.mock('@react-native-community/netinfo', () => ({
      fetch: jest.fn(() =>
        Promise.resolve({
          isConnected: false,
          isInternetReachable: false,
          type: 'none',
        })
      ),
      addEventListener: jest.fn(() => jest.fn()),
    }));
  }
}

// Error boundary testing
export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('Error boundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return <div>Something went wrong.</div>;
    }

    return this.props.children;
  }
}

// Re-export everything from React Native Testing Library
export * from '@testing-library/react-native';