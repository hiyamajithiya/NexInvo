/**
 * Environment Configuration Manager
 * Dynamically loads the appropriate configuration based on the current environment
 */

import { Platform } from 'react-native';
import Config from 'react-native-config';

// Environment types
export type Environment = 'development' | 'staging' | 'production';

// Base configuration interface
export interface AppConfig {
  environment: Environment;
  api: {
    baseURL: string;
    timeout: number;
    retryAttempts: number;
    retryDelay: number;
    headers: Record<string, string>;
  };
  security: {
    tokenRefreshThreshold: number;
    maxLoginAttempts: number;
    lockoutDuration: number;
    biometricTimeout: number;
    sessionTimeout: number;
    encryptionEnabled: boolean;
    certificatePinning: boolean;
  };
  app: {
    name: string;
    version: string;
    bundleId: {
      ios: string;
      android: string;
    };
    deepLinkScheme: string;
    universalLinkDomain: string;
  };
  analytics: {
    enabled: boolean;
    firebaseConfig?: any;
    sentry?: any;
    mixpanel?: any;
  };
  features: Record<string, boolean>;
  logging: {
    level: 'error' | 'warn' | 'info' | 'debug';
    enableRemoteLogging: boolean;
    maxLogSize: number;
    logRetentionDays: number;
    sensitiveFields: string[];
    logEndpoint?: string;
  };
}

// Development configuration
const developmentConfig: AppConfig = {
  environment: 'development',
  api: {
    baseURL: Config.DEV_API_URL || 'http://localhost:3000/api',
    timeout: 10000,
    retryAttempts: 2,
    retryDelay: 1000,
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'X-App-Version': '1.0.0-dev',
      'X-Platform': 'mobile',
    },
  },
  security: {
    tokenRefreshThreshold: 600, // 10 minutes
    maxLoginAttempts: 10, // More lenient for development
    lockoutDuration: 300, // 5 minutes
    biometricTimeout: 60,
    sessionTimeout: 7200, // 2 hours
    encryptionEnabled: false, // Disabled for easier debugging
    certificatePinning: false,
  },
  app: {
    name: 'NexInvo Dev',
    version: '1.0.0-dev',
    bundleId: {
      ios: 'com.nexinvo.mobile.dev',
      android: 'com.nexinvo.mobile.dev',
    },
    deepLinkScheme: 'nexinvo-dev',
    universalLinkDomain: 'dev.nexinvo.com',
  },
  analytics: {
    enabled: false, // Disabled in development
  },
  features: {
    biometricAuth: true,
    offlineMode: true,
    darkMode: true,
    exportFeatures: true,
    advancedReports: true,
    integrations: true,
    multiCurrency: true,
    recurringInvoices: true,
    templates: true,
    timeTracking: true, // Enable experimental features
    inventory: true,
    projectManagement: true,
  },
  logging: {
    level: 'debug',
    enableRemoteLogging: false,
    maxLogSize: 10 * 1024 * 1024, // 10MB
    logRetentionDays: 3,
    sensitiveFields: ['password', 'token'],
  },
};

// Staging configuration
const stagingConfig: AppConfig = {
  environment: 'staging',
  api: {
    baseURL: Config.STAGING_API_URL || 'https://staging-api.nexinvo.com/api',
    timeout: 12000,
    retryAttempts: 3,
    retryDelay: 1000,
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'X-App-Version': '1.0.0-staging',
      'X-Platform': 'mobile',
    },
  },
  security: {
    tokenRefreshThreshold: 300,
    maxLoginAttempts: 5,
    lockoutDuration: 600, // 10 minutes
    biometricTimeout: 30,
    sessionTimeout: 3600,
    encryptionEnabled: true,
    certificatePinning: false, // Disabled for staging
  },
  app: {
    name: 'NexInvo Staging',
    version: '1.0.0-staging',
    bundleId: {
      ios: 'com.nexinvo.mobile.staging',
      android: 'com.nexinvo.mobile.staging',
    },
    deepLinkScheme: 'nexinvo-staging',
    universalLinkDomain: 'staging.nexinvo.com',
  },
  analytics: {
    enabled: true,
    firebaseConfig: {
      apiKey: Config.FIREBASE_API_KEY_STAGING,
      authDomain: 'nexinvo-staging.firebaseapp.com',
      projectId: 'nexinvo-staging',
      storageBucket: 'nexinvo-staging.appspot.com',
      messagingSenderId: Config.FIREBASE_SENDER_ID_STAGING,
      appId: Config.FIREBASE_APP_ID_STAGING,
    },
    sentry: {
      dsn: Config.SENTRY_DSN_STAGING,
      environment: 'staging',
      debug: true,
      tracesSampleRate: 1.0, // 100% for staging
    },
  },
  features: {
    biometricAuth: true,
    offlineMode: true,
    darkMode: true,
    exportFeatures: true,
    advancedReports: true,
    integrations: true,
    multiCurrency: true,
    recurringInvoices: true,
    templates: true,
    timeTracking: false,
    inventory: false,
    projectManagement: false,
  },
  logging: {
    level: 'info',
    enableRemoteLogging: true,
    maxLogSize: 5 * 1024 * 1024,
    logRetentionDays: 7,
    sensitiveFields: ['password', 'token', 'ssn', 'creditCard'],
    logEndpoint: 'https://logs-staging.nexinvo.com/mobile',
  },
};

// Production configuration (imported from production.ts)
import productionConfig from './production';

// Configuration selector
class EnvironmentConfig {
  private static instance: EnvironmentConfig;
  private currentConfig: AppConfig;

  private constructor() {
    this.currentConfig = this.loadConfiguration();
  }

  public static getInstance(): EnvironmentConfig {
    if (!EnvironmentConfig.instance) {
      EnvironmentConfig.instance = new EnvironmentConfig();
    }
    return EnvironmentConfig.instance;
  }

  private loadConfiguration(): AppConfig {
    const environment = this.getEnvironment();

    switch (environment) {
      case 'production':
        return productionConfig as AppConfig;
      case 'staging':
        return stagingConfig;
      case 'development':
      default:
        return developmentConfig;
    }
  }

  private getEnvironment(): Environment {
    // Priority order: Config.ENVIRONMENT > __DEV__ > 'production'
    if (Config.ENVIRONMENT) {
      return Config.ENVIRONMENT as Environment;
    }

    if (__DEV__) {
      return 'development';
    }

    return 'production';
  }

  public getConfig(): AppConfig {
    return this.currentConfig;
  }

  public isProduction(): boolean {
    return this.currentConfig.environment === 'production';
  }

  public isDevelopment(): boolean {
    return this.currentConfig.environment === 'development';
  }

  public isStaging(): boolean {
    return this.currentConfig.environment === 'staging';
  }

  public getApiUrl(): string {
    return this.currentConfig.api.baseURL;
  }

  public isFeatureEnabled(feature: string): boolean {
    return this.currentConfig.features[feature] || false;
  }

  public getBundleId(): string {
    return Platform.OS === 'ios'
      ? this.currentConfig.app.bundleId.ios
      : this.currentConfig.app.bundleId.android;
  }

  public getLogLevel(): string {
    return this.currentConfig.logging.level;
  }

  public isAnalyticsEnabled(): boolean {
    return this.currentConfig.analytics.enabled;
  }
}

// Export singleton instance
export const envConfig = EnvironmentConfig.getInstance();
export const appConfig = envConfig.getConfig();

// Utility functions
export const isProduction = () => envConfig.isProduction();
export const isDevelopment = () => envConfig.isDevelopment();
export const isStaging = () => envConfig.isStaging();
export const getApiUrl = () => envConfig.getApiUrl();
export const isFeatureEnabled = (feature: string) => envConfig.isFeatureEnabled(feature);
export const getBundleId = () => envConfig.getBundleId();
export const getLogLevel = () => envConfig.getLogLevel();
export const isAnalyticsEnabled = () => envConfig.isAnalyticsEnabled();

// Environment-specific logger
export const createLogger = (module: string) => {
  const logLevel = getLogLevel();
  const levels = ['error', 'warn', 'info', 'debug'];
  const currentLevelIndex = levels.indexOf(logLevel);

  return {
    error: (message: string, data?: any) => {
      if (currentLevelIndex >= 0) {
        console.error(`[${module}] ${message}`, data);
      }
    },
    warn: (message: string, data?: any) => {
      if (currentLevelIndex >= 1) {
        console.warn(`[${module}] ${message}`, data);
      }
    },
    info: (message: string, data?: any) => {
      if (currentLevelIndex >= 2) {
        console.info(`[${module}] ${message}`, data);
      }
    },
    debug: (message: string, data?: any) => {
      if (currentLevelIndex >= 3) {
        console.log(`[${module}] ${message}`, data);
      }
    },
  };
};

// Runtime configuration validation
export const validateConfiguration = (): boolean => {
  const config = appConfig;
  const errors: string[] = [];

  // Validate API configuration
  if (!config.api.baseURL) {
    errors.push('API base URL is required');
  }

  if (!config.app.name) {
    errors.push('App name is required');
  }

  if (!config.app.version) {
    errors.push('App version is required');
  }

  // Validate production-specific requirements
  if (isProduction()) {
    if (config.analytics.enabled && !config.analytics.firebaseConfig) {
      errors.push('Firebase configuration is required in production');
    }

    if (!config.security.encryptionEnabled) {
      errors.push('Encryption must be enabled in production');
    }

    if (config.logging.level === 'debug') {
      errors.push('Debug logging should not be enabled in production');
    }
  }

  if (errors.length > 0) {
    console.error('Configuration validation failed:', errors);
    return false;
  }

  return true;
};

// Initialize configuration validation
if (!validateConfiguration()) {
  throw new Error('Invalid configuration detected. Please check your environment settings.');
}

export default appConfig;