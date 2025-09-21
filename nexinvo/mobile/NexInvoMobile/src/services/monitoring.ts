/**
 * Monitoring and Logging Service for NexInvo Mobile App
 * Comprehensive monitoring, performance tracking, and logging infrastructure
 */

import { Platform, AppState, NetInfo } from 'react-native';
import DeviceInfo from 'react-native-device-info';
import { appConfig, isProduction, isDevelopment } from '../config/environment';
import { createLogger } from '../config/environment';
import { analyticsService } from './analytics';
import { crashReportingService } from './crashReporting';

const logger = createLogger('Monitoring');

export interface LogEntry {
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  timestamp: string;
  module: string;
  data?: any;
  userId?: string;
  sessionId?: string;
}

export interface PerformanceMetric {
  name: string;
  value: number;
  unit: string;
  timestamp: string;
  context?: Record<string, any>;
}

export interface SystemHealth {
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  storage: {
    used: number;
    free: number;
    total: number;
    percentage: number;
  };
  battery: {
    level: number;
    isCharging: boolean;
  };
  network: {
    isConnected: boolean;
    type: string;
    effectiveType?: string;
  };
  device: {
    platform: string;
    version: string;
    model: string;
    brand: string;
  };
}

export interface AppMetrics {
  sessionId: string;
  startTime: string;
  lastActivity: string;
  screenViews: number;
  apiCalls: number;
  errors: number;
  crashes: number;
  memoryWarnings: number;
}

class MonitoringService {
  private static instance: MonitoringService;
  private isInitialized = false;
  private sessionId: string;
  private sessionStartTime: string;
  private logBuffer: LogEntry[] = [];
  private performanceBuffer: PerformanceMetric[] = [];
  private appMetrics: AppMetrics;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private logFlushInterval: NodeJS.Timeout | null = null;
  private networkState: any = null;

  private constructor() {
    this.sessionId = this.generateSessionId();
    this.sessionStartTime = new Date().toISOString();
    this.appMetrics = this.initializeAppMetrics();
    this.initialize();
  }

  public static getInstance(): MonitoringService {
    if (!MonitoringService.instance) {
      MonitoringService.instance = new MonitoringService();
    }
    return MonitoringService.instance;
  }

  private async initialize(): Promise<void> {
    try {
      // Set up app state monitoring
      this.setupAppStateMonitoring();

      // Set up network monitoring
      await this.setupNetworkMonitoring();

      // Set up memory warnings
      this.setupMemoryWarnings();

      // Start health checks
      this.startHealthChecks();

      // Start log flushing
      this.startLogFlushing();

      // Log initial system information
      await this.logSystemInformation();

      this.isInitialized = true;
      logger.info('Monitoring service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize monitoring service', error);
    }
  }

  private initializeAppMetrics(): AppMetrics {
    return {
      sessionId: this.sessionId,
      startTime: this.sessionStartTime,
      lastActivity: new Date().toISOString(),
      screenViews: 0,
      apiCalls: 0,
      errors: 0,
      crashes: 0,
      memoryWarnings: 0,
    };
  }

  private generateSessionId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private setupAppStateMonitoring(): void {
    AppState.addEventListener('change', (nextAppState) => {
      this.log('info', 'App state changed', 'AppState', { state: nextAppState });

      if (nextAppState === 'active') {
        this.appMetrics.lastActivity = new Date().toISOString();
        this.trackEvent('app_foreground');
      } else if (nextAppState === 'background') {
        this.trackEvent('app_background');
        this.flushLogs(); // Flush logs when app goes to background
      } else if (nextAppState === 'inactive') {
        this.trackEvent('app_inactive');
      }
    });
  }

  private async setupNetworkMonitoring(): Promise<void> {
    try {
      // Initial network state
      this.networkState = await NetInfo.fetch();
      this.log('info', 'Network state initialized', 'Network', this.networkState);

      // Monitor network changes
      NetInfo.addEventListener((state) => {
        const wasConnected = this.networkState?.isConnected;
        const isConnected = state.isConnected;

        this.networkState = state;
        this.log('info', 'Network state changed', 'Network', state);

        if (wasConnected && !isConnected) {
          this.trackEvent('network_disconnected');
        } else if (!wasConnected && isConnected) {
          this.trackEvent('network_reconnected');
          this.flushLogs(); // Flush buffered logs when reconnected
        }
      });
    } catch (error) {
      logger.error('Failed to setup network monitoring', error);
    }
  }

  private setupMemoryWarnings(): void {
    // Note: React Native doesn't have built-in memory warning events
    // This would be implemented using native modules for iOS/Android
    this.log('info', 'Memory warning monitoring setup', 'Memory');
  }

  private startHealthChecks(): void {
    this.healthCheckInterval = setInterval(async () => {
      try {
        const health = await this.getSystemHealth();
        this.recordPerformanceMetric('system_health_check', 1, 'count', health);

        // Check for critical conditions
        if (health.memory.percentage > 90) {
          this.log('warn', 'High memory usage detected', 'Health', health.memory);
          this.trackEvent('high_memory_usage', health.memory);
        }

        if (health.storage.percentage > 95) {
          this.log('warn', 'Low storage space detected', 'Health', health.storage);
          this.trackEvent('low_storage_space', health.storage);
        }

        if (health.battery.level < 10 && !health.battery.isCharging) {
          this.log('warn', 'Low battery detected', 'Health', health.battery);
          this.trackEvent('low_battery', health.battery);
        }
      } catch (error) {
        this.log('error', 'Health check failed', 'Health', { error: error.message });
      }
    }, appConfig.healthCheck?.interval || 60000); // Default 1 minute
  }

  private startLogFlushing(): void {
    this.logFlushInterval = setInterval(() => {
      this.flushLogs();
      this.flushPerformanceMetrics();
    }, 30000); // Flush every 30 seconds
  }

  private async logSystemInformation(): Promise<void> {
    try {
      const deviceInfo = {
        platform: Platform.OS,
        version: Platform.Version,
        model: await DeviceInfo.getModel(),
        brand: await DeviceInfo.getBrand(),
        deviceId: await DeviceInfo.getDeviceId(),
        systemVersion: await DeviceInfo.getSystemVersion(),
        buildNumber: await DeviceInfo.getBuildNumber(),
        appVersion: await DeviceInfo.getVersion(),
        bundleId: await DeviceInfo.getBundleId(),
        isEmulator: await DeviceInfo.isEmulator(),
        hasNotch: await DeviceInfo.hasNotch(),
        totalMemory: await DeviceInfo.getTotalMemory(),
        usedMemory: await DeviceInfo.getUsedMemory(),
      };

      this.log('info', 'System information logged', 'System', deviceInfo);
    } catch (error) {
      this.log('error', 'Failed to log system information', 'System', { error: error.message });
    }
  }

  // Public methods

  /**
   * Log a message with specified level
   */
  public log(level: LogEntry['level'], message: string, module: string, data?: any): void {
    const logEntry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      module,
      data,
      sessionId: this.sessionId,
    };

    // Add to buffer
    this.logBuffer.push(logEntry);

    // Console output in development
    if (isDevelopment()) {
      const consoleMethod = level === 'debug' ? 'log' : level;
      console[consoleMethod](`[${module}] ${message}`, data);
    }

    // Immediate flush for errors
    if (level === 'error') {
      this.flushLogs();
    }

    // Limit buffer size
    if (this.logBuffer.length > 1000) {
      this.logBuffer = this.logBuffer.slice(-500);
    }
  }

  /**
   * Record a performance metric
   */
  public recordPerformanceMetric(
    name: string,
    value: number,
    unit: string,
    context?: Record<string, any>
  ): void {
    const metric: PerformanceMetric = {
      name,
      value,
      unit,
      timestamp: new Date().toISOString(),
      context,
    };

    this.performanceBuffer.push(metric);

    // Send to analytics
    analyticsService.trackPerformance(name, value, unit);

    // Log significant metrics
    if (this.isSignificantMetric(name, value, unit)) {
      this.log('info', `Performance metric: ${name}`, 'Performance', metric);
    }

    // Limit buffer size
    if (this.performanceBuffer.length > 500) {
      this.performanceBuffer = this.performanceBuffer.slice(-250);
    }
  }

  /**
   * Track an event for analytics
   */
  public trackEvent(eventName: string, parameters?: Record<string, any>): void {
    this.appMetrics.lastActivity = new Date().toISOString();

    // Send to analytics service
    analyticsService.trackEvent({
      name: eventName,
      parameters: {
        session_id: this.sessionId,
        ...parameters,
      },
    });

    this.log('debug', `Event tracked: ${eventName}`, 'Analytics', parameters);
  }

  /**
   * Track screen view
   */
  public trackScreenView(screenName: string, parameters?: Record<string, any>): void {
    this.appMetrics.screenViews++;
    this.appMetrics.lastActivity = new Date().toISOString();

    analyticsService.trackScreenView({
      screenName,
      parameters: {
        session_id: this.sessionId,
        ...parameters,
      },
    });

    this.log('debug', `Screen view: ${screenName}`, 'Navigation', parameters);
  }

  /**
   * Track API call metrics
   */
  public trackApiCall(
    endpoint: string,
    method: string,
    statusCode: number,
    duration: number,
    size?: number
  ): void {
    this.appMetrics.apiCalls++;

    const apiMetric = {
      endpoint,
      method,
      status_code: statusCode,
      duration_ms: duration,
      response_size: size,
      session_id: this.sessionId,
    };

    this.recordPerformanceMetric('api_call_duration', duration, 'ms', apiMetric);

    if (statusCode >= 400) {
      this.log('warn', `API error: ${method} ${endpoint}`, 'API', apiMetric);
    } else {
      this.log('debug', `API call: ${method} ${endpoint}`, 'API', apiMetric);
    }
  }

  /**
   * Track error occurrence
   */
  public trackError(error: Error, context?: Record<string, any>): void {
    this.appMetrics.errors++;

    this.log('error', `Error tracked: ${error.message}`, 'Error', {
      error: error.message,
      stack: error.stack,
      context,
    });

    // Send to crash reporting
    crashReportingService.recordError(error, context);
  }

  /**
   * Track user interaction
   */
  public trackUserInteraction(action: string, component: string, details?: Record<string, any>): void {
    this.appMetrics.lastActivity = new Date().toISOString();

    this.trackEvent('user_interaction', {
      action,
      component,
      ...details,
    });
  }

  /**
   * Get current system health
   */
  public async getSystemHealth(): Promise<SystemHealth> {
    try {
      const [
        totalMemory,
        usedMemory,
        batteryLevel,
        isCharging,
        totalDiskCapacity,
        freeDiskStorage,
      ] = await Promise.all([
        DeviceInfo.getTotalMemory(),
        DeviceInfo.getUsedMemory(),
        DeviceInfo.getBatteryLevel(),
        DeviceInfo.isBatteryCharging(),
        DeviceInfo.getTotalDiskCapacity(),
        DeviceInfo.getFreeDiskStorage(),
      ]);

      return {
        memory: {
          used: usedMemory,
          total: totalMemory,
          percentage: Math.round((usedMemory / totalMemory) * 100),
        },
        storage: {
          used: totalDiskCapacity - freeDiskStorage,
          free: freeDiskStorage,
          total: totalDiskCapacity,
          percentage: Math.round(((totalDiskCapacity - freeDiskStorage) / totalDiskCapacity) * 100),
        },
        battery: {
          level: Math.round(batteryLevel * 100),
          isCharging,
        },
        network: {
          isConnected: this.networkState?.isConnected || false,
          type: this.networkState?.type || 'unknown',
          effectiveType: this.networkState?.details?.effectiveType,
        },
        device: {
          platform: Platform.OS,
          version: Platform.Version.toString(),
          model: await DeviceInfo.getModel(),
          brand: await DeviceInfo.getBrand(),
        },
      };
    } catch (error) {
      this.log('error', 'Failed to get system health', 'Health', { error: error.message });
      throw error;
    }
  }

  /**
   * Get current app metrics
   */
  public getAppMetrics(): AppMetrics {
    return { ...this.appMetrics };
  }

  /**
   * Get session information
   */
  public getSessionInfo(): { sessionId: string; startTime: string; duration: number } {
    return {
      sessionId: this.sessionId,
      startTime: this.sessionStartTime,
      duration: Date.now() - new Date(this.sessionStartTime).getTime(),
    };
  }

  /**
   * Flush logs to remote service
   */
  public async flushLogs(): Promise<void> {
    if (this.logBuffer.length === 0 || !appConfig.logging.enableRemoteLogging) {
      return;
    }

    try {
      const logsToSend = [...this.logBuffer];
      this.logBuffer = [];

      if (appConfig.logging.logEndpoint) {
        await this.sendLogsToRemote(logsToSend);
      }

      logger.debug(`Flushed ${logsToSend.length} log entries`);
    } catch (error) {
      logger.error('Failed to flush logs', error);
      // Re-add logs to buffer on failure
      this.logBuffer.unshift(...this.logBuffer.slice(0, 100)); // Keep only recent logs
    }
  }

  /**
   * Flush performance metrics
   */
  public async flushPerformanceMetrics(): Promise<void> {
    if (this.performanceBuffer.length === 0) {
      return;
    }

    try {
      const metricsToSend = [...this.performanceBuffer];
      this.performanceBuffer = [];

      // Process metrics for analytics
      for (const metric of metricsToSend) {
        analyticsService.trackPerformance(metric.name, metric.value, metric.unit);
      }

      logger.debug(`Flushed ${metricsToSend.length} performance metrics`);
    } catch (error) {
      logger.error('Failed to flush performance metrics', error);
    }
  }

  /**
   * Generate monitoring report
   */
  public async generateReport(): Promise<{
    session: any;
    health: SystemHealth;
    metrics: AppMetrics;
    recentLogs: LogEntry[];
    recentMetrics: PerformanceMetric[];
  }> {
    return {
      session: this.getSessionInfo(),
      health: await this.getSystemHealth(),
      metrics: this.getAppMetrics(),
      recentLogs: this.logBuffer.slice(-50),
      recentMetrics: this.performanceBuffer.slice(-50),
    };
  }

  // Private helper methods

  private async sendLogsToRemote(logs: LogEntry[]): Promise<void> {
    if (!appConfig.logging.logEndpoint) {
      return;
    }

    try {
      const response = await fetch(appConfig.logging.logEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-App-Version': appConfig.app.version,
          'X-Session-ID': this.sessionId,
        },
        body: JSON.stringify({
          logs,
          session: this.getSessionInfo(),
          device: {
            platform: Platform.OS,
            version: Platform.Version,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      throw new Error(`Failed to send logs to remote: ${error.message}`);
    }
  }

  private isSignificantMetric(name: string, value: number, unit: string): boolean {
    // Define thresholds for significant metrics
    const thresholds = {
      api_call_duration: 5000, // ms
      screen_render_time: 1000, // ms
      memory_usage: 80, // percentage
      crash_count: 1, // count
    };

    return value >= (thresholds[name] || Number.MAX_SAFE_INTEGER);
  }

  /**
   * Cleanup resources
   */
  public cleanup(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    if (this.logFlushInterval) {
      clearInterval(this.logFlushInterval);
    }

    // Flush remaining data
    this.flushLogs();
    this.flushPerformanceMetrics();
  }
}

// Export singleton instance
export const monitoringService = MonitoringService.getInstance();

// Convenience functions
export const log = (level: LogEntry['level'], message: string, module: string, data?: any) =>
  monitoringService.log(level, message, module, data);
export const recordPerformanceMetric = (name: string, value: number, unit: string, context?: Record<string, any>) =>
  monitoringService.recordPerformanceMetric(name, value, unit, context);
export const trackEvent = (eventName: string, parameters?: Record<string, any>) =>
  monitoringService.trackEvent(eventName, parameters);
export const trackScreenView = (screenName: string, parameters?: Record<string, any>) =>
  monitoringService.trackScreenView(screenName, parameters);
export const trackApiCall = (endpoint: string, method: string, statusCode: number, duration: number, size?: number) =>
  monitoringService.trackApiCall(endpoint, method, statusCode, duration, size);
export const trackError = (error: Error, context?: Record<string, any>) =>
  monitoringService.trackError(error, context);
export const trackUserInteraction = (action: string, component: string, details?: Record<string, any>) =>
  monitoringService.trackUserInteraction(action, component, details);

export default monitoringService;