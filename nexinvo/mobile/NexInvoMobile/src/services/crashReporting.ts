/**
 * Crash Reporting Service for NexInvo Mobile App
 * Integrates with Firebase Crashlytics and Sentry for comprehensive error tracking
 */

import crashlytics from '@react-native-firebase/crashlytics';
import * as Sentry from '@sentry/react-native';
import { Platform } from 'react-native';
import { appConfig, isProduction } from '../config/environment';
import { createLogger } from '../config/environment';

const logger = createLogger('CrashReporting');

export interface CrashContext {
  userId?: string;
  userEmail?: string;
  screenName?: string;
  action?: string;
  extra?: Record<string, any>;
}

export interface PerformanceTrace {
  name: string;
  attributes?: Record<string, string>;
}

export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

class CrashReportingService {
  private static instance: CrashReportingService;
  private isInitialized = false;
  private performanceTraces: Map<string, any> = new Map();

  private constructor() {
    this.initialize();
  }

  public static getInstance(): CrashReportingService {
    if (!CrashReportingService.instance) {
      CrashReportingService.instance = new CrashReportingService();
    }
    return CrashReportingService.instance;
  }

  private async initialize(): Promise<void> {
    try {
      // Initialize Crashlytics
      await this.initializeCrashlytics();

      // Initialize Sentry
      await this.initializeSentry();

      this.isInitialized = true;
      logger.info('Crash reporting service initialized successfully');

      // Set default context
      await this.setDefaultContext();
    } catch (error) {
      logger.error('Failed to initialize crash reporting service', error);
    }
  }

  private async initializeCrashlytics(): Promise<void> {
    try {
      // Enable Crashlytics collection in production only
      await crashlytics().setCrashlyticsCollectionEnabled(isProduction());

      // Set initial attributes
      await crashlytics().setAttributes({
        platform: Platform.OS,
        app_version: appConfig.app.version,
        environment: appConfig.environment,
        build_type: isProduction() ? 'release' : 'debug',
      });

      logger.info('Firebase Crashlytics initialized');
    } catch (error) {
      logger.error('Failed to initialize Firebase Crashlytics', error);
    }
  }

  private async initializeSentry(): Promise<void> {
    try {
      if (appConfig.analytics.sentry?.dsn) {
        Sentry.init({
          dsn: appConfig.analytics.sentry.dsn,
          environment: appConfig.environment,
          debug: !isProduction(),
          enableAutoSessionTracking: true,
          enableOutOfMemoryTracking: true,
          enableNativeCrashHandling: true,
          attachStacktrace: true,
          tracesSampleRate: appConfig.analytics.sentry.tracesSampleRate || 0.1,
          beforeSend: (event) => {
            // Filter out sensitive data
            return this.sanitizeSentryEvent(event);
          },
          integrations: [
            new Sentry.ReactNativeTracing({
              enableNativeFramesTracking: true,
              enableStallTracking: true,
            }),
          ],
        });

        // Set default context
        Sentry.setContext('app', {
          name: appConfig.app.name,
          version: appConfig.app.version,
          platform: Platform.OS,
          environment: appConfig.environment,
        });

        logger.info('Sentry initialized');
      }
    } catch (error) {
      logger.error('Failed to initialize Sentry', error);
    }
  }

  private async setDefaultContext(): Promise<void> {
    const defaultContext = {
      platform: Platform.OS,
      app_version: appConfig.app.version,
      environment: appConfig.environment,
      timestamp: new Date().toISOString(),
    };

    await this.setContext('app_info', defaultContext);
  }

  // Public methods

  /**
   * Record a non-fatal error
   */
  public async recordError(error: Error, context?: CrashContext): Promise<void> {
    if (!this.isInitialized) {
      return;
    }

    try {
      // Add context if provided
      if (context) {
        await this.setContext('error_context', context);
      }

      // Firebase Crashlytics
      await crashlytics().recordError(error);

      // Sentry
      Sentry.withScope((scope) => {
        if (context) {
          scope.setContext('error_context', context);
          if (context.userId) scope.setUser({ id: context.userId, email: context.userEmail });
          if (context.screenName) scope.setTag('screen', context.screenName);
          if (context.action) scope.setTag('action', context.action);
          if (context.extra) {
            Object.entries(context.extra).forEach(([key, value]) => {
              scope.setExtra(key, value);
            });
          }
        }
        Sentry.captureException(error);
      });

      logger.error('Error recorded', { error: error.message, context });
    } catch (recordingError) {
      logger.error('Failed to record error', recordingError);
    }
  }

  /**
   * Log a custom error message
   */
  public async logError(message: string, context?: CrashContext): Promise<void> {
    const error = new Error(message);
    await this.recordError(error, context);
  }

  /**
   * Record a fatal crash (should rarely be used manually)
   */
  public async recordFatalError(error: Error, context?: CrashContext): Promise<void> {
    if (!this.isInitialized) {
      return;
    }

    try {
      if (context) {
        await this.setContext('fatal_error_context', context);
      }

      // Firebase Crashlytics
      await crashlytics().crash();

      // Sentry
      Sentry.withScope((scope) => {
        scope.setLevel('fatal');
        if (context) {
          scope.setContext('fatal_error_context', context);
        }
        Sentry.captureException(error);
      });

      logger.error('Fatal error recorded', { error: error.message, context });
    } catch (recordingError) {
      logger.error('Failed to record fatal error', recordingError);
    }
  }

  /**
   * Set user information
   */
  public async setUser(userId: string, userEmail?: string, userName?: string): Promise<void> {
    if (!this.isInitialized) {
      return;
    }

    try {
      // Firebase Crashlytics
      await crashlytics().setUserId(userId);

      // Sentry
      Sentry.setUser({
        id: userId,
        email: userEmail,
        username: userName,
      });

      logger.debug('User information set', { userId, userEmail, userName });
    } catch (error) {
      logger.error('Failed to set user information', error);
    }
  }

  /**
   * Set custom context/attributes
   */
  public async setContext(key: string, value: any): Promise<void> {
    if (!this.isInitialized) {
      return;
    }

    try {
      // Firebase Crashlytics (flatten objects for attributes)
      if (typeof value === 'object' && value !== null) {
        const flattened = this.flattenObject(value);
        await crashlytics().setAttributes(flattened);
      } else {
        await crashlytics().setAttribute(key, String(value));
      }

      // Sentry
      Sentry.setContext(key, value);

      logger.debug(`Context set: ${key}`, value);
    } catch (error) {
      logger.error(`Failed to set context: ${key}`, error);
    }
  }

  /**
   * Log a breadcrumb (navigation trail)
   */
  public async addBreadcrumb(message: string, category?: string, level?: string, data?: any): Promise<void> {
    if (!this.isInitialized) {
      return;
    }

    try {
      // Firebase Crashlytics
      await crashlytics().log(message);

      // Sentry
      Sentry.addBreadcrumb({
        message,
        category: category || 'navigation',
        level: (level as any) || 'info',
        data,
        timestamp: Date.now() / 1000,
      });

      logger.debug(`Breadcrumb added: ${message}`, { category, level, data });
    } catch (error) {
      logger.error('Failed to add breadcrumb', error);
    }
  }

  /**
   * Record a handled exception with severity
   */
  public async recordHandledException(
    error: Error,
    severity: ErrorSeverity = ErrorSeverity.MEDIUM,
    context?: CrashContext
  ): Promise<void> {
    if (!this.isInitialized) {
      return;
    }

    try {
      // Add severity to context
      const enhancedContext = {
        ...context,
        severity,
        handled: true,
      };

      await this.setContext('exception_context', enhancedContext);

      // Firebase Crashlytics
      await crashlytics().recordError(error);

      // Sentry
      Sentry.withScope((scope) => {
        scope.setLevel(this.mapSeverityToSentryLevel(severity));
        scope.setTag('handled', 'true');
        scope.setTag('severity', severity);

        if (context) {
          scope.setContext('exception_context', enhancedContext);
        }

        Sentry.captureException(error);
      });

      logger.warn(`Handled exception recorded: ${error.message}`, enhancedContext);
    } catch (recordingError) {
      logger.error('Failed to record handled exception', recordingError);
    }
  }

  /**
   * Start performance monitoring trace
   */
  public async startTrace(traceName: string, attributes?: Record<string, string>): Promise<void> {
    if (!this.isInitialized) {
      return;
    }

    try {
      // Firebase Performance Monitoring
      const trace = await crashlytics().perf().startTrace(traceName);
      if (attributes) {
        for (const [key, value] of Object.entries(attributes)) {
          trace.putAttribute(key, value);
        }
      }
      this.performanceTraces.set(traceName, trace);

      // Sentry Performance Monitoring
      const sentryTransaction = Sentry.startTransaction({
        name: traceName,
        data: attributes,
      });
      this.performanceTraces.set(`sentry_${traceName}`, sentryTransaction);

      logger.debug(`Performance trace started: ${traceName}`, attributes);
    } catch (error) {
      logger.error(`Failed to start trace: ${traceName}`, error);
    }
  }

  /**
   * Stop performance monitoring trace
   */
  public async stopTrace(traceName: string): Promise<void> {
    if (!this.isInitialized) {
      return;
    }

    try {
      // Firebase Performance Monitoring
      const trace = this.performanceTraces.get(traceName);
      if (trace) {
        await trace.stop();
        this.performanceTraces.delete(traceName);
      }

      // Sentry Performance Monitoring
      const sentryTransaction = this.performanceTraces.get(`sentry_${traceName}`);
      if (sentryTransaction) {
        sentryTransaction.finish();
        this.performanceTraces.delete(`sentry_${traceName}`);
      }

      logger.debug(`Performance trace stopped: ${traceName}`);
    } catch (error) {
      logger.error(`Failed to stop trace: ${traceName}`, error);
    }
  }

  /**
   * Record custom metrics
   */
  public async recordMetric(name: string, value: number, unit?: string): Promise<void> {
    if (!this.isInitialized) {
      return;
    }

    try {
      // Record as custom event in Sentry
      Sentry.addBreadcrumb({
        message: `Metric: ${name}`,
        category: 'metric',
        level: 'info',
        data: {
          metric_name: name,
          metric_value: value,
          metric_unit: unit,
        },
      });

      logger.debug(`Metric recorded: ${name} = ${value} ${unit || ''}`);
    } catch (error) {
      logger.error(`Failed to record metric: ${name}`, error);
    }
  }

  /**
   * Test crash reporting (development only)
   */
  public async testCrash(): Promise<void> {
    if (isProduction()) {
      logger.warn('Test crash ignored in production');
      return;
    }

    try {
      // Test Crashlytics
      crashlytics().crash();

      // Test Sentry
      throw new Error('Test crash for Sentry');
    } catch (error) {
      logger.info('Test crash executed', error);
    }
  }

  /**
   * Enable/disable crash reporting
   */
  public async setCrashReportingEnabled(enabled: boolean): Promise<void> {
    try {
      await crashlytics().setCrashlyticsCollectionEnabled(enabled);
      logger.info(`Crash reporting ${enabled ? 'enabled' : 'disabled'}`);
    } catch (error) {
      logger.error('Failed to set crash reporting enabled state', error);
    }
  }

  // Private helper methods

  private sanitizeSentryEvent(event: any): any {
    // Remove sensitive data from Sentry events
    if (event.user) {
      delete event.user.ip_address;
    }

    // Remove sensitive extra data
    if (event.extra) {
      appConfig.logging.sensitiveFields.forEach((field) => {
        delete event.extra[field];
      });
    }

    return event;
  }

  private flattenObject(obj: any, prefix = ''): Record<string, string> {
    const flattened: Record<string, string> = {};

    for (const [key, value] of Object.entries(obj)) {
      const newKey = prefix ? `${prefix}_${key}` : key;

      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        Object.assign(flattened, this.flattenObject(value, newKey));
      } else {
        flattened[newKey] = String(value);
      }
    }

    return flattened;
  }

  private mapSeverityToSentryLevel(severity: ErrorSeverity): any {
    switch (severity) {
      case ErrorSeverity.LOW:
        return 'info';
      case ErrorSeverity.MEDIUM:
        return 'warning';
      case ErrorSeverity.HIGH:
        return 'error';
      case ErrorSeverity.CRITICAL:
        return 'fatal';
      default:
        return 'error';
    }
  }
}

// Export singleton instance
export const crashReportingService = CrashReportingService.getInstance();

// Convenience functions
export const recordError = (error: Error, context?: CrashContext) =>
  crashReportingService.recordError(error, context);
export const logError = (message: string, context?: CrashContext) =>
  crashReportingService.logError(message, context);
export const setUser = (userId: string, userEmail?: string, userName?: string) =>
  crashReportingService.setUser(userId, userEmail, userName);
export const setContext = (key: string, value: any) => crashReportingService.setContext(key, value);
export const addBreadcrumb = (message: string, category?: string, level?: string, data?: any) =>
  crashReportingService.addBreadcrumb(message, category, level, data);
export const recordHandledException = (error: Error, severity?: ErrorSeverity, context?: CrashContext) =>
  crashReportingService.recordHandledException(error, severity, context);
export const startTrace = (traceName: string, attributes?: Record<string, string>) =>
  crashReportingService.startTrace(traceName, attributes);
export const stopTrace = (traceName: string) => crashReportingService.stopTrace(traceName);
export const recordMetric = (name: string, value: number, unit?: string) =>
  crashReportingService.recordMetric(name, value, unit);

export default crashReportingService;