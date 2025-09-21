# NexInvo Mobile - Technical Documentation

## Table of Contents
1. [Architecture Overview](#architecture-overview)
2. [Technology Stack](#technology-stack)
3. [Project Structure](#project-structure)
4. [Development Setup](#development-setup)
5. [Component Architecture](#component-architecture)
6. [State Management](#state-management)
7. [Navigation](#navigation)
8. [API Integration](#api-integration)
9. [Security Implementation](#security-implementation)
10. [Performance Optimization](#performance-optimization)
11. [Testing Strategy](#testing-strategy)
12. [Build and Deployment](#build-and-deployment)
13. [Monitoring and Analytics](#monitoring-and-analytics)
14. [Troubleshooting](#troubleshooting)

## Architecture Overview

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Presentation Layer                       │
├─────────────────────────────────────────────────────────────┤
│  React Native Components │  Screens │  Navigation           │
├─────────────────────────────────────────────────────────────┤
│                    Business Logic Layer                     │
├─────────────────────────────────────────────────────────────┤
│  Redux Store │  Custom Hooks │  Utils │  Validation         │
├─────────────────────────────────────────────────────────────┤
│                     Service Layer                           │
├─────────────────────────────────────────────────────────────┤
│  API Client │  Auth Service │  Cache │  Offline Support     │
├─────────────────────────────────────────────────────────────┤
│                      Data Layer                             │
├─────────────────────────────────────────────────────────────┤
│  AsyncStorage │  Keychain │  Local Database │  File System  │
└─────────────────────────────────────────────────────────────┘
```

### Design Patterns
- **MVVM (Model-View-ViewModel)**: Clear separation of concerns
- **Observer Pattern**: Redux for state management
- **Factory Pattern**: Service creation and configuration
- **Singleton Pattern**: API client and cache management
- **Repository Pattern**: Data access abstraction

## Technology Stack

### Core Technologies
- **React Native**: 0.81.4
- **TypeScript**: 5.8.3
- **React**: 19.1.0

### State Management
- **Redux Toolkit**: 2.9.0
- **React Redux**: 9.2.0
- **Redux Persist**: 6.0.0

### Navigation
- **React Navigation**: 7.x
- **Stack Navigator**: Native stack navigation
- **Tab Navigator**: Bottom tab navigation
- **Drawer Navigator**: Side menu navigation

### UI Components
- **React Native Paper**: 5.14.5
- **React Native Elements**: 3.4.3
- **React Native Vector Icons**: 10.3.0
- **React Native Reanimated**: 4.1.0
- **React Native Gesture Handler**: 2.28.0

### Storage and Security
- **AsyncStorage**: 2.2.0
- **Keychain**: 10.0.0
- **React Native Biometrics**: 3.0.1

### Development Tools
- **Metro Bundler**: React Native's JavaScript bundler
- **ESLint**: Code linting
- **Prettier**: Code formatting
- **TypeScript**: Type checking
- **Jest**: Unit testing
- **Detox**: E2E testing

## Project Structure

```
NexInvoMobile/
├── src/
│   ├── components/           # Reusable UI components
│   │   ├── ui/              # Basic UI components
│   │   ├── forms/           # Form components
│   │   └── common/          # Common components
│   ├── screens/             # Screen components
│   │   ├── auth/            # Authentication screens
│   │   ├── dashboard/       # Dashboard screens
│   │   ├── invoices/        # Invoice management
│   │   ├── clients/         # Client management
│   │   └── settings/        # Settings screens
│   ├── navigation/          # Navigation configuration
│   ├── store/               # Redux store setup
│   │   ├── slices/          # Redux slices
│   │   └── middleware/      # Custom middleware
│   ├── services/            # API and external services
│   ├── utils/               # Utility functions
│   ├── hooks/               # Custom React hooks
│   ├── types/               # TypeScript type definitions
│   ├── constants/           # App constants
│   └── assets/              # Static assets
├── __tests__/               # Test files
├── e2e/                     # End-to-end tests
├── docs/                    # Documentation
├── android/                 # Android native code
├── ios/                     # iOS native code
└── scripts/                 # Build and utility scripts
```

### File Naming Conventions
- **Components**: PascalCase (e.g., `Button.tsx`)
- **Screens**: PascalCase (e.g., `DashboardScreen.tsx`)
- **Services**: camelCase (e.g., `apiService.ts`)
- **Utils**: camelCase (e.g., `dateUtils.ts`)
- **Types**: PascalCase (e.g., `Invoice.ts`)
- **Constants**: UPPER_SNAKE_CASE (e.g., `API_ENDPOINTS.ts`)

## Development Setup

### Prerequisites
```bash
# Node.js (v18 or higher)
node --version

# React Native CLI
npm install -g @react-native-community/cli

# iOS development (macOS only)
xcode-select --install
sudo gem install cocoapods

# Android development
# Install Android Studio and Android SDK
```

### Environment Setup
```bash
# Clone repository
git clone <repository-url>
cd NexInvoMobile

# Install dependencies
npm install

# iOS setup (macOS only)
cd ios && pod install && cd ..

# Environment configuration
cp .env.example .env
# Edit .env with your configuration
```

### Running the Application
```bash
# Start Metro bundler
npm start

# Run on iOS (macOS only)
npm run ios

# Run on Android
npm run android

# Run specific device
npm run ios -- --simulator="iPhone 14"
npm run android -- --deviceId="device-id"
```

## Component Architecture

### Component Hierarchy
```
App
├── NavigationContainer
│   ├── AuthStack (Conditional)
│   │   ├── LoginScreen
│   │   ├── RegisterScreen
│   │   └── ForgotPasswordScreen
│   └── MainStack (Conditional)
│       ├── TabNavigator
│       │   ├── DashboardScreen
│       │   ├── InvoicesScreen
│       │   ├── ClientsScreen
│       │   ├── ReportsScreen
│       │   └── SettingsScreen
│       └── ModalStack
│           ├── CreateInvoiceScreen
│           ├── EditInvoiceScreen
│           └── CreateClientScreen
```

### Component Design Principles
1. **Single Responsibility**: Each component has one clear purpose
2. **Reusability**: Components are designed for reuse across screens
3. **Composability**: Complex components are built from simpler ones
4. **Props Interface**: Clear TypeScript interfaces for all props
5. **Error Boundaries**: Proper error handling at component level

### Example Component Structure
```typescript
// src/components/ui/Button.tsx
import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline';
  disabled?: boolean;
  loading?: boolean;
  size?: 'small' | 'medium' | 'large';
  testID?: string;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  size = 'medium',
  testID,
}) => {
  return (
    <TouchableOpacity
      style={[
        styles.button,
        styles[variant],
        styles[size],
        disabled && styles.disabled,
      ]}
      onPress={onPress}
      disabled={disabled || loading}
      testID={testID}
    >
      <Text style={[styles.text, styles[`text_${variant}`]]}>
        {loading ? 'Loading...' : title}
      </Text>
    </TouchableOpacity>
  );
};
```

## State Management

### Redux Store Structure
```typescript
interface RootState {
  auth: AuthState;
  invoices: InvoiceState;
  clients: ClientState;
  ui: UIState;
  integrations: IntegrationState;
}
```

### Redux Slices

#### Auth Slice
```typescript
interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  biometricEnabled: boolean;
}

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    loginStart: (state) => {
      state.isLoading = true;
      state.error = null;
    },
    loginSuccess: (state, action) => {
      state.isLoading = false;
      state.user = action.payload.user;
      state.token = action.payload.token;
      state.isAuthenticated = true;
    },
    loginFailure: (state, action) => {
      state.isLoading = false;
      state.error = action.payload;
      state.isAuthenticated = false;
    },
    logout: (state) => {
      state.user = null;
      state.token = null;
      state.isAuthenticated = false;
    },
  },
});
```

### Async Actions with Redux Toolkit
```typescript
export const loginUser = createAsyncThunk(
  'auth/login',
  async (credentials: LoginCredentials, { rejectWithValue }) => {
    try {
      const response = await authService.login(credentials);
      await secureStorage.setToken(response.token);
      return response;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);
```

### State Persistence
```typescript
const persistConfig = {
  key: 'root',
  storage: AsyncStorage,
  whitelist: ['auth', 'settings'],
  blacklist: ['ui'],
};

export const persistor = persistStore(store);
```

## Navigation

### Navigation Structure
```typescript
// Types
type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
  CreateInvoice: { clientId?: string };
  EditInvoice: { invoiceId: string };
  InvoiceDetail: { invoiceId: string };
};

type TabParamList = {
  Dashboard: undefined;
  Invoices: undefined;
  Clients: undefined;
  Reports: undefined;
  Settings: undefined;
};
```

### Navigation Service
```typescript
class NavigationService {
  private static instance: NavigationService;
  private navigationRef: any;

  static getInstance(): NavigationService {
    if (!NavigationService.instance) {
      NavigationService.instance = new NavigationService();
    }
    return NavigationService.instance;
  }

  navigate(name: string, params?: any) {
    this.navigationRef?.navigate(name, params);
  }

  goBack() {
    this.navigationRef?.goBack();
  }

  reset(routeName: string) {
    this.navigationRef?.reset({
      index: 0,
      routes: [{ name: routeName }],
    });
  }
}
```

### Deep Linking
```typescript
const linking: LinkingOptions<RootStackParamList> = {
  prefixes: ['nexinvo://'],
  config: {
    screens: {
      Main: {
        screens: {
          Invoices: 'invoices',
          InvoiceDetail: 'invoice/:invoiceId',
          Clients: 'clients',
        },
      },
    },
  },
};
```

## API Integration

### API Client Configuration
```typescript
class ApiClient {
  private static instance: ApiClient;
  private axiosInstance: AxiosInstance;

  constructor() {
    this.axiosInstance = axios.create({
      baseURL: Config.API_BASE_URL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors() {
    // Request interceptor
    this.axiosInstance.interceptors.request.use(
      async (config) => {
        const token = await secureStorage.getToken();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor
    this.axiosInstance.interceptors.response.use(
      (response) => response,
      async (error) => {
        if (error.response?.status === 401) {
          await this.handleTokenRefresh();
        }
        return Promise.reject(error);
      }
    );
  }
}
```

### Service Layer
```typescript
class InvoiceService {
  async getInvoices(params: InvoiceFilters): Promise<InvoiceResponse> {
    const response = await apiClient.get('/invoices', { params });
    return response.data;
  }

  async createInvoice(invoice: CreateInvoiceDto): Promise<Invoice> {
    const response = await apiClient.post('/invoices', invoice);
    return response.data.invoice;
  }

  async updateInvoice(id: string, updates: UpdateInvoiceDto): Promise<Invoice> {
    const response = await apiClient.put(`/invoices/${id}`, updates);
    return response.data.invoice;
  }

  async deleteInvoice(id: string): Promise<void> {
    await apiClient.delete(`/invoices/${id}`);
  }
}
```

### Error Handling
```typescript
class ApiError extends Error {
  public statusCode: number;
  public code: string;

  constructor(message: string, statusCode: number, code: string) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

const handleApiError = (error: any): ApiError => {
  if (error.response) {
    return new ApiError(
      error.response.data.error.message,
      error.response.status,
      error.response.data.error.code
    );
  }
  return new ApiError('Network error', 0, 'NETWORK_ERROR');
};
```

## Security Implementation

### Authentication Security
```typescript
class AuthenticationService {
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    // Implement rate limiting
    await this.checkRateLimit(credentials.email);

    const response = await apiClient.post('/auth/login', credentials);

    // Store tokens securely
    await secureStorage.setToken(response.data.token);
    await secureStorage.setRefreshToken(response.data.refreshToken);

    return response.data;
  }

  async enableBiometric(): Promise<boolean> {
    const isAvailable = await biometrics.isSensorAvailable();
    if (isAvailable) {
      const credentials = await keychain.getInternetCredentials('nexinvo_auth');
      if (credentials) {
        await biometrics.createKeys();
        return true;
      }
    }
    return false;
  }
}
```

### Data Encryption
```typescript
class SecureStorage {
  async setToken(token: string): Promise<void> {
    await keychain.setInternetCredentials(
      'nexinvo_token',
      'user',
      token
    );
  }

  async getToken(): Promise<string | null> {
    try {
      const credentials = await keychain.getInternetCredentials('nexinvo_token');
      return credentials ? credentials.password : null;
    } catch {
      return null;
    }
  }

  async clearAllData(): Promise<void> {
    await keychain.resetInternetCredentials('nexinvo_token');
    await keychain.resetInternetCredentials('nexinvo_refresh');
    await AsyncStorage.clear();
  }
}
```

### Input Validation
```typescript
const validationSchemas = {
  email: yup.string().email('Invalid email').required('Email is required'),
  password: yup
    .string()
    .min(8, 'Password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Password must contain uppercase, lowercase, and number')
    .required('Password is required'),
  invoiceAmount: yup
    .number()
    .positive('Amount must be positive')
    .required('Amount is required'),
};
```

## Performance Optimization

### Component Optimization
```typescript
// Memoization
const InvoiceItem = React.memo<InvoiceItemProps>(({ invoice, onPress }) => {
  const handlePress = useCallback(() => {
    onPress(invoice.id);
  }, [invoice.id, onPress]);

  return (
    <TouchableOpacity onPress={handlePress}>
      {/* Component content */}
    </TouchableOpacity>
  );
});

// Virtualized Lists
const InvoiceList: React.FC = () => {
  const renderItem = useCallback(({ item }: { item: Invoice }) => (
    <InvoiceItem invoice={item} onPress={handleInvoicePress} />
  ), [handleInvoicePress]);

  return (
    <FlatList
      data={invoices}
      renderItem={renderItem}
      keyExtractor={(item) => item.id}
      windowSize={10}
      maxToRenderPerBatch={5}
      updateCellsBatchingPeriod={100}
      removeClippedSubviews={true}
    />
  );
};
```

### Image Optimization
```typescript
const OptimizedImage: React.FC<ImageProps> = ({ source, style }) => {
  return (
    <Image
      source={source}
      style={style}
      resizeMode="cover"
      progressiveRenderingEnabled={true}
      cache="force-cache"
    />
  );
};
```

### Bundle Optimization
```typescript
// Code splitting with lazy loading
const LazyInvoiceScreen = lazy(() => import('./screens/InvoiceScreen'));
const LazyReportsScreen = lazy(() => import('./screens/ReportsScreen'));

// Conditional imports
const loadHeavyLibrary = async () => {
  if (Platform.OS === 'ios') {
    return import('./ios-specific-library');
  } else {
    return import('./android-specific-library');
  }
};
```

## Testing Strategy

### Unit Testing
```typescript
// Component testing
describe('Button Component', () => {
  it('should render with correct title', () => {
    const { getByText } = render(
      <Button title="Test Button" onPress={jest.fn()} />
    );
    expect(getByText('Test Button')).toBeTruthy();
  });

  it('should call onPress when pressed', () => {
    const onPressMock = jest.fn();
    const { getByText } = render(
      <Button title="Test" onPress={onPressMock} />
    );

    fireEvent.press(getByText('Test'));
    expect(onPressMock).toHaveBeenCalledTimes(1);
  });
});
```

### Integration Testing
```typescript
// Redux integration testing
describe('Auth Integration', () => {
  it('should login user successfully', async () => {
    const store = createTestStore();
    const credentials = { email: 'test@example.com', password: 'password' };

    await store.dispatch(loginUser(credentials));

    const state = store.getState();
    expect(state.auth.isAuthenticated).toBe(true);
    expect(state.auth.user).toBeDefined();
  });
});
```

### E2E Testing
```typescript
// Detox E2E testing
describe('Invoice Flow', () => {
  beforeAll(async () => {
    await device.launchApp();
  });

  it('should create a new invoice', async () => {
    await TestHelpers.login();
    await element(by.id('create-invoice-button')).tap();
    await element(by.id('client-selector')).tap();
    await element(by.text('Test Client')).tap();
    await element(by.id('save-invoice-button')).tap();

    await expect(element(by.text('Invoice created successfully'))).toBeVisible();
  });
});
```

## Build and Deployment

### Build Configuration
```typescript
// Environment-specific configurations
const config = {
  development: {
    API_BASE_URL: 'http://localhost:3000/api',
    SENTRY_DSN: '',
    ANALYTICS_ENABLED: false,
  },
  staging: {
    API_BASE_URL: 'https://staging-api.nexinvo.com/api',
    SENTRY_DSN: 'staging-sentry-dsn',
    ANALYTICS_ENABLED: true,
  },
  production: {
    API_BASE_URL: 'https://api.nexinvo.com/api',
    SENTRY_DSN: 'production-sentry-dsn',
    ANALYTICS_ENABLED: true,
  },
};
```

### Build Scripts
```bash
# Development build
npm run build:dev

# Staging build
npm run build:staging

# Production build
npm run build:prod

# Build for specific platform
npm run build:ios:release
npm run build:android:release
```

### Code Signing
```bash
# iOS code signing
security unlock-keychain -p "$KEYCHAIN_PASSWORD" "$KEYCHAIN_PATH"
xcodebuild -workspace ios/NexInvoMobile.xcworkspace \
  -scheme NexInvoMobile \
  -configuration Release \
  -archivePath "NexInvoMobile.xcarchive" \
  archive

# Android signing
./gradlew assembleRelease \
  -Pandroid.injected.signing.store.file="$KEYSTORE_PATH" \
  -Pandroid.injected.signing.store.password="$KEYSTORE_PASSWORD"
```

## Monitoring and Analytics

### Crash Reporting
```typescript
import { Sentry } from '@sentry/react-native';

Sentry.init({
  dsn: Config.SENTRY_DSN,
  environment: Config.ENVIRONMENT,
});

// Custom error boundary
class ErrorBoundary extends React.Component {
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    Sentry.captureException(error, {
      contexts: {
        react: {
          componentStack: errorInfo.componentStack,
        },
      },
    });
  }
}
```

### Analytics
```typescript
import analytics from '@react-native-firebase/analytics';

class AnalyticsService {
  async trackEvent(eventName: string, parameters?: any) {
    if (Config.ANALYTICS_ENABLED) {
      await analytics().logEvent(eventName, parameters);
    }
  }

  async trackScreen(screenName: string) {
    if (Config.ANALYTICS_ENABLED) {
      await analytics().logScreenView({
        screen_name: screenName,
        screen_class: screenName,
      });
    }
  }
}
```

### Performance Monitoring
```typescript
class PerformanceMonitor {
  private static startTimes: Map<string, number> = new Map();

  static startTimer(label: string) {
    this.startTimes.set(label, Date.now());
  }

  static endTimer(label: string) {
    const startTime = this.startTimes.get(label);
    if (startTime) {
      const duration = Date.now() - startTime;
      analytics().logEvent('performance_metric', {
        label,
        duration,
      });
      this.startTimes.delete(label);
    }
  }
}
```

## Troubleshooting

### Common Development Issues

#### Metro Bundler Issues
```bash
# Clear Metro cache
npx react-native start --reset-cache

# Clear all caches
npm run clean:all
```

#### iOS Build Issues
```bash
# Clean iOS build
cd ios && xcodebuild clean && cd ..

# Reinstall pods
cd ios && rm -rf Pods && pod install && cd ..

# Reset iOS simulator
xcrun simctl erase all
```

#### Android Build Issues
```bash
# Clean Android build
cd android && ./gradlew clean && cd ..

# Reset Android emulator
emulator -avd Pixel_3_API_30 -wipe-data
```

### Debugging Tools
```typescript
// React Native Debugger
if (__DEV__) {
  import('./ReactotronConfig').then(() => console.log('Reactotron Configured'));
}

// Flipper integration
import { logger } from 'flipper-plugin';

const debug = {
  log: (message: string, data?: any) => {
    if (__DEV__) {
      logger.info(message, data);
    }
  },
};
```

### Performance Profiling
```bash
# iOS performance profiling
npx react-native run-ios --configuration Release

# Android performance profiling
npx react-native run-android --variant=release

# Bundle analyzer
npx react-native bundle --platform ios --dev false --entry-file index.js --bundle-output ios-bundle.js --assets-dest ios-assets
```

This technical documentation provides comprehensive information for developers working on the NexInvo Mobile application, covering architecture, implementation details, and best practices.