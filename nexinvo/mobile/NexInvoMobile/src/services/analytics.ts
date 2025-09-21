/**
 * Analytics Service for NexInvo Mobile App
 * Integrates with Firebase Analytics, Mixpanel, and custom analytics
 */

import analytics from '@react-native-firebase/analytics';
import crashlytics from '@react-native-firebase/crashlytics';
import { Mixpanel } from 'mixpanel-react-native';
import { Platform } from 'react-native';
import { appConfig, isProduction } from '../config/environment';
import { createLogger } from '../config/environment';

const logger = createLogger('Analytics');

// Event types
export interface AnalyticsEvent {
  name: string;
  parameters?: Record<string, any>;
}

export interface UserProperties {
  userId?: string;
  email?: string;
  name?: string;
  company?: string;
  plan?: string;
  role?: string;
  registrationDate?: string;
  lastLoginDate?: string;
}

export interface ScreenViewEvent {
  screenName: string;
  screenClass?: string;
  parameters?: Record<string, any>;
}

class AnalyticsService {
  private static instance: AnalyticsService;
  private mixpanel: any;
  private isInitialized = false;

  private constructor() {
    this.initialize();
  }

  public static getInstance(): AnalyticsService {
    if (!AnalyticsService.instance) {
      AnalyticsService.instance = new AnalyticsService();
    }
    return AnalyticsService.instance;
  }

  private async initialize(): Promise<void> {
    if (!appConfig.analytics.enabled) {
      logger.info('Analytics disabled in configuration');
      return;
    }

    try {
      // Initialize Firebase Analytics
      await this.initializeFirebase();

      // Initialize Mixpanel
      await this.initializeMixpanel();

      // Initialize Crashlytics
      await this.initializeCrashlytics();

      this.isInitialized = true;
      logger.info('Analytics service initialized successfully');

      // Set default properties
      await this.setDefaultProperties();
    } catch (error) {
      logger.error('Failed to initialize analytics service', error);
    }
  }

  private async initializeFirebase(): Promise<void> {
    try {
      // Firebase Analytics is auto-initialized with React Native Firebase
      await analytics().setAnalyticsCollectionEnabled(appConfig.analytics.enabled);

      // Set default event parameters
      await analytics().setDefaultEventParameters({
        app_platform: Platform.OS,
        app_version: appConfig.app.version,
        environment: appConfig.environment,
      });

      logger.info('Firebase Analytics initialized');
    } catch (error) {
      logger.error('Failed to initialize Firebase Analytics', error);
    }
  }

  private async initializeMixpanel(): Promise<void> {
    try {
      if (appConfig.analytics.mixpanel?.token) {
        this.mixpanel = new Mixpanel(appConfig.analytics.mixpanel.token, true);
        await this.mixpanel.init();

        // Set default properties
        this.mixpanel.registerSuperProperties({
          platform: Platform.OS,
          app_version: appConfig.app.version,
          environment: appConfig.environment,
        });

        logger.info('Mixpanel initialized');
      }
    } catch (error) {
      logger.error('Failed to initialize Mixpanel', error);
    }
  }

  private async initializeCrashlytics(): Promise<void> {
    try {
      await crashlytics().setCrashlyticsCollectionEnabled(isProduction());

      // Set custom keys
      await crashlytics().setAttributes({
        environment: appConfig.environment,
        app_version: appConfig.app.version,
        platform: Platform.OS,
      });

      logger.info('Crashlytics initialized');
    } catch (error) {
      logger.error('Failed to initialize Crashlytics', error);
    }
  }

  private async setDefaultProperties(): Promise<void> {
    const defaultProperties = {
      platform: Platform.OS,
      app_version: appConfig.app.version,
      environment: appConfig.environment,
      timestamp: new Date().toISOString(),
    };

    await this.setUserProperties(defaultProperties);
  }

  // Public methods

  /**
   * Track custom events
   */
  public async trackEvent(event: AnalyticsEvent): Promise<void> {
    if (!this.isInitialized || !appConfig.analytics.enabled) {
      return;
    }

    try {
      const sanitizedParameters = this.sanitizeParameters(event.parameters);

      // Firebase Analytics
      await analytics().logEvent(event.name, sanitizedParameters);

      // Mixpanel
      if (this.mixpanel) {
        this.mixpanel.track(event.name, sanitizedParameters);
      }

      logger.debug(`Event tracked: ${event.name}`, sanitizedParameters);
    } catch (error) {
      logger.error(`Failed to track event: ${event.name}`, error);
    }
  }

  /**
   * Track screen views
   */
  public async trackScreenView(screen: ScreenViewEvent): Promise<void> {
    if (!this.isInitialized || !appConfig.analytics.enabled) {
      return;
    }

    try {
      // Firebase Analytics
      await analytics().logScreenView({
        screen_name: screen.screenName,
        screen_class: screen.screenClass || screen.screenName,
        ...this.sanitizeParameters(screen.parameters),
      });

      // Mixpanel
      if (this.mixpanel) {
        this.mixpanel.track('Screen View', {
          screen_name: screen.screenName,
          screen_class: screen.screenClass,
          ...this.sanitizeParameters(screen.parameters),
        });
      }

      logger.debug(`Screen view tracked: ${screen.screenName}`);
    } catch (error) {
      logger.error(`Failed to track screen view: ${screen.screenName}`, error);
    }
  }

  /**
   * Set user properties
   */
  public async setUserProperties(properties: UserProperties): Promise<void> {
    if (!this.isInitialized || !appConfig.analytics.enabled) {
      return;
    }

    try {
      const sanitizedProperties = this.sanitizeParameters(properties);

      // Firebase Analytics
      for (const [key, value] of Object.entries(sanitizedProperties)) {
        await analytics().setUserProperty(key, String(value));
      }

      // Mixpanel
      if (this.mixpanel && properties.userId) {
        this.mixpanel.identify(properties.userId);
        this.mixpanel.getPeople().set(sanitizedProperties);
      }

      // Crashlytics
      if (properties.userId) {
        await crashlytics().setUserId(properties.userId);
      }

      logger.debug('User properties set', sanitizedProperties);
    } catch (error) {
      logger.error('Failed to set user properties', error);
    }
  }

  /**
   * Track user login
   */
  public async trackLogin(method: string, userId: string): Promise<void> {
    await this.trackEvent({
      name: 'login',
      parameters: {
        method,
        user_id: userId,
      },
    });

    await this.setUserProperties({
      userId,
      lastLoginDate: new Date().toISOString(),
    });
  }

  /**
   * Track user registration
   */
  public async trackRegistration(method: string, userId: string): Promise<void> {
    await this.trackEvent({
      name: 'sign_up',
      parameters: {
        method,
        user_id: userId,
      },
    });

    await this.setUserProperties({
      userId,
      registrationDate: new Date().toISOString(),
    });
  }

  /**
   * Track purchase/subscription events
   */
  public async trackPurchase(transactionId: string, value: number, currency: string): Promise<void> {
    await this.trackEvent({
      name: 'purchase',
      parameters: {
        transaction_id: transactionId,
        value,
        currency,
      },
    });
  }

  /**
   * Track invoice-related events
   */
  public async trackInvoiceEvent(action: string, invoiceId: string, amount?: number): Promise<void> {
    await this.trackEvent({
      name: `invoice_${action}`,
      parameters: {
        invoice_id: invoiceId,
        amount,
        timestamp: new Date().toISOString(),
      },
    });
  }

  /**
   * Track client-related events
   */
  public async trackClientEvent(action: string, clientId: string): Promise<void> {
    await this.trackEvent({
      name: `client_${action}`,
      parameters: {
        client_id: clientId,
        timestamp: new Date().toISOString(),
      },
    });
  }

  /**
   * Track feature usage
   */
  public async trackFeatureUsage(feature: string, context?: Record<string, any>): Promise<void> {
    await this.trackEvent({
      name: 'feature_used',
      parameters: {
        feature_name: feature,
        ...context,
      },
    });
  }

  /**
   * Track errors (non-fatal)
   */
  public async trackError(error: Error, context?: Record<string, any>): Promise<void> {
    try {
      // Log to Crashlytics
      await crashlytics().recordError(error);

      // Track as analytics event
      await this.trackEvent({
        name: 'app_error',
        parameters: {
          error_message: error.message,
          error_stack: error.stack?.substring(0, 500), // Limit stack trace length
          ...context,
        },
      });

      logger.error('Error tracked', { error, context });
    } catch (trackingError) {
      logger.error('Failed to track error', trackingError);
    }
  }

  /**
   * Track performance metrics
   */
  public async trackPerformance(metric: string, value: number, unit: string): Promise<void> {
    await this.trackEvent({
      name: 'performance_metric',
      parameters: {
        metric_name: metric,
        metric_value: value,
        metric_unit: unit,
      },
    });
  }

  /**
   * Track timing events
   */
  public async trackTiming(category: string, variable: string, time: number): Promise<void> {
    await this.trackEvent({
      name: 'timing_complete',
      parameters: {
        timing_category: category,
        timing_variable: variable,
        timing_value: time,
      },
    });
  }

  /**
   * Set custom dimensions
   */
  public async setCustomDimension(index: number, value: string): Promise<void> {
    if (!this.isInitialized || !appConfig.analytics.enabled) {
      return;
    }

    try {
      // Firebase Analytics custom dimensions are set via user properties
      await analytics().setUserProperty(`custom_dimension_${index}`, value);

      logger.debug(`Custom dimension ${index} set to: ${value}`);
    } catch (error) {
      logger.error(`Failed to set custom dimension ${index}`, error);
    }
  }

  /**
   * Sanitize parameters to ensure they meet analytics platform requirements
   */
  private sanitizeParameters(parameters?: Record<string, any>): Record<string, any> {
    if (!parameters) {
      return {};
    }

    const sanitized: Record<string, any> = {};

    for (const [key, value] of Object.entries(parameters)) {
      // Skip sensitive fields
      if (appConfig.logging.sensitiveFields.includes(key.toLowerCase())) {
        continue;
      }

      // Convert key to valid format (lowercase, underscores)
      const sanitizedKey = key.toLowerCase().replace(/[^a-z0-9_]/g, '_');

      // Limit string length
      if (typeof value === 'string') {
        sanitized[sanitizedKey] = value.substring(0, 100);
      } else if (typeof value === 'number' || typeof value === 'boolean') {
        sanitized[sanitizedKey] = value;
      } else if (value !== null && value !== undefined) {
        sanitized[sanitizedKey] = String(value).substring(0, 100);
      }
    }

    return sanitized;
  }

  /**
   * Enable/disable analytics collection
   */
  public async setAnalyticsEnabled(enabled: boolean): Promise<void> {
    try {
      await analytics().setAnalyticsCollectionEnabled(enabled);

      if (this.mixpanel) {
        if (enabled) {
          this.mixpanel.optInTracking();
        } else {
          this.mixpanel.optOutTracking();
        }
      }

      logger.info(`Analytics collection ${enabled ? 'enabled' : 'disabled'}`);
    } catch (error) {
      logger.error('Failed to set analytics enabled state', error);
    }
  }

  /**
   * Reset analytics data (GDPR compliance)
   */
  public async resetAnalyticsData(): Promise<void> {
    try {
      await analytics().resetAnalyticsData();

      if (this.mixpanel) {
        this.mixpanel.reset();
      }

      logger.info('Analytics data reset');
    } catch (error) {
      logger.error('Failed to reset analytics data', error);
    }
  }
}

// Export singleton instance
export const analyticsService = AnalyticsService.getInstance();

// Convenience functions
export const trackEvent = (event: AnalyticsEvent) => analyticsService.trackEvent(event);
export const trackScreenView = (screen: ScreenViewEvent) => analyticsService.trackScreenView(screen);
export const setUserProperties = (properties: UserProperties) => analyticsService.setUserProperties(properties);
export const trackLogin = (method: string, userId: string) => analyticsService.trackLogin(method, userId);
export const trackRegistration = (method: string, userId: string) => analyticsService.trackRegistration(method, userId);
export const trackInvoiceEvent = (action: string, invoiceId: string, amount?: number) =>
  analyticsService.trackInvoiceEvent(action, invoiceId, amount);
export const trackClientEvent = (action: string, clientId: string) =>
  analyticsService.trackClientEvent(action, clientId);
export const trackFeatureUsage = (feature: string, context?: Record<string, any>) =>
  analyticsService.trackFeatureUsage(feature, context);
export const trackError = (error: Error, context?: Record<string, any>) =>
  analyticsService.trackError(error, context);
export const trackPerformance = (metric: string, value: number, unit: string) =>
  analyticsService.trackPerformance(metric, value, unit);

export default analyticsService;