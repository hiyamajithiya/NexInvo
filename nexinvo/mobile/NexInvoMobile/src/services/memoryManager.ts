import { AppState, DeviceEventEmitter, Platform } from 'react-native';
import { cacheManager } from './cacheManager';
import { imageOptimization } from './imageOptimization';

interface MemoryUsage {
  used: number;
  available: number;
  total: number;
  percentage: number;
  timestamp: number;
}

interface MemoryThresholds {
  warning: number; // Percentage
  critical: number; // Percentage
  cleanup: number; // Percentage
}

interface MemoryCleanupStrategy {
  id: string;
  name: string;
  priority: number;
  execute: () => Promise<number>; // Returns bytes freed
  canExecute: () => boolean;
}

interface MemoryAlert {
  level: 'info' | 'warning' | 'critical';
  message: string;
  timestamp: number;
  memoryUsage: MemoryUsage;
  action?: string;
}

class MemoryManager {
  private memoryUsageHistory: MemoryUsage[] = [];
  private cleanupStrategies: MemoryCleanupStrategy[] = [];
  private isMonitoring = false;
  private monitoringInterval?: NodeJS.Timeout;
  private alertHandlers: Array<(alert: MemoryAlert) => void> = [];

  private thresholds: MemoryThresholds = {
    warning: 75, // 75% memory usage
    critical: 85, // 85% memory usage
    cleanup: 90, // 90% memory usage - trigger aggressive cleanup
  };

  private readonly maxHistoryLength = 100;
  private readonly monitoringIntervalMs = 10000; // 10 seconds

  async initialize(): Promise<void> {
    this.registerCleanupStrategies();
    this.setupAppStateHandlers();
    this.startMonitoring();
    console.log('Memory manager initialized');
  }

  private registerCleanupStrategies(): void {
    this.cleanupStrategies = [
      {
        id: 'image_cache',
        name: 'Clear Image Cache',
        priority: 1,
        execute: async () => {
          const statsBefore = imageOptimization.getStats();
          imageOptimization.clearCache();
          const statsAfter = imageOptimization.getStats();
          return statsBefore.totalCacheSize - statsAfter.totalCacheSize;
        },
        canExecute: () => imageOptimization.getStats().cachedImages > 0,
      },
      {
        id: 'app_cache_cleanup',
        name: 'Cache Cleanup',
        priority: 2,
        execute: async () => {
          const statsBefore = cacheManager.getStats();
          await this.cleanupOldCacheEntries();
          const statsAfter = cacheManager.getStats();
          return (statsBefore.totalSize - statsAfter.totalSize);
        },
        canExecute: () => cacheManager.getStats().totalItems > 10,
      },
      {
        id: 'force_garbage_collection',
        name: 'Force Garbage Collection',
        priority: 3,
        execute: async () => {
          if (global.gc) {
            global.gc();
            return 0; // Can't measure GC impact directly
          }
          return 0;
        },
        canExecute: () => !!global.gc,
      },
      {
        id: 'clear_redux_history',
        name: 'Clear Redux History',
        priority: 4,
        execute: async () => {
          // Clear Redux action history if using Redux DevTools
          DeviceEventEmitter.emit('CLEAR_REDUX_HISTORY');
          return 500000; // Estimate: ~500KB
        },
        canExecute: () => __DEV__, // Only in development
      },
      {
        id: 'clear_console_logs',
        name: 'Clear Console Logs',
        priority: 5,
        execute: async () => {
          if (__DEV__) {
            console.clear();
            return 100000; // Estimate: ~100KB
          }
          return 0;
        },
        canExecute: () => __DEV__,
      },
    ];

    console.log(`Registered ${this.cleanupStrategies.length} cleanup strategies`);
  }

  private setupAppStateHandlers(): void {
    AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'background') {
        this.handleAppBackground();
      } else if (nextAppState === 'active') {
        this.handleAppForeground();
      }
    });
  }

  private startMonitoring(): void {
    if (this.isMonitoring) return;

    this.isMonitoring = true;
    this.monitoringInterval = setInterval(async () => {
      await this.checkMemoryUsage();
    }, this.monitoringIntervalMs);

    console.log('Memory monitoring started');
  }

  private stopMonitoring(): void {
    if (!this.isMonitoring) return;

    this.isMonitoring = false;
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }

    console.log('Memory monitoring stopped');
  }

  private async checkMemoryUsage(): Promise<void> {
    try {
      const memoryUsage = await this.getCurrentMemoryUsage();
      this.recordMemoryUsage(memoryUsage);

      // Check thresholds and trigger appropriate actions
      if (memoryUsage.percentage >= this.thresholds.cleanup) {
        await this.triggerEmergencyCleanup(memoryUsage);
      } else if (memoryUsage.percentage >= this.thresholds.critical) {
        await this.triggerCriticalCleanup(memoryUsage);
      } else if (memoryUsage.percentage >= this.thresholds.warning) {
        this.triggerWarning(memoryUsage);
      }
    } catch (error) {
      console.error('Memory monitoring error:', error);
    }
  }

  private async getCurrentMemoryUsage(): Promise<MemoryUsage> {
    try {
      // In a real implementation, you would use native modules to get actual memory usage
      // For React Native, you might use react-native-device-info or custom native modules

      // Mock implementation - in real app, replace with actual memory API
      const mockUsed = Math.random() * 1024 * 1024 * 1024; // Random up to 1GB
      const mockTotal = 2 * 1024 * 1024 * 1024; // 2GB total
      const mockAvailable = mockTotal - mockUsed;

      return {
        used: mockUsed,
        available: mockAvailable,
        total: mockTotal,
        percentage: (mockUsed / mockTotal) * 100,
        timestamp: Date.now(),
      };
    } catch (error) {
      console.error('Failed to get memory usage:', error);
      // Return safe defaults
      return {
        used: 0,
        available: 1024 * 1024 * 1024, // 1GB
        total: 1024 * 1024 * 1024,
        percentage: 0,
        timestamp: Date.now(),
      };
    }
  }

  private recordMemoryUsage(usage: MemoryUsage): void {
    this.memoryUsageHistory.push(usage);

    // Keep only the last N readings
    if (this.memoryUsageHistory.length > this.maxHistoryLength) {
      this.memoryUsageHistory.shift();
    }
  }

  private triggerWarning(memoryUsage: MemoryUsage): void {
    const alert: MemoryAlert = {
      level: 'warning',
      message: `Memory usage is high (${memoryUsage.percentage.toFixed(1)}%)`,
      timestamp: Date.now(),
      memoryUsage,
      action: 'Consider closing unused screens or clearing cache',
    };

    this.notifyAlertHandlers(alert);
    console.warn('Memory warning:', alert.message);
  }

  private async triggerCriticalCleanup(memoryUsage: MemoryUsage): Promise<void> {
    const alert: MemoryAlert = {
      level: 'critical',
      message: `Critical memory usage (${memoryUsage.percentage.toFixed(1)}%)`,
      timestamp: Date.now(),
      memoryUsage,
      action: 'Performing automatic cleanup',
    };

    this.notifyAlertHandlers(alert);
    console.error('Critical memory usage:', alert.message);

    // Execute high-priority cleanup strategies
    const highPriorityStrategies = this.cleanupStrategies
      .filter(s => s.priority <= 2 && s.canExecute())
      .sort((a, b) => a.priority - b.priority);

    for (const strategy of highPriorityStrategies) {
      try {
        const freedBytes = await strategy.execute();
        console.log(`Executed cleanup strategy "${strategy.name}", freed ${this.formatBytes(freedBytes)}`);
      } catch (error) {
        console.error(`Cleanup strategy "${strategy.name}" failed:`, error);
      }
    }
  }

  private async triggerEmergencyCleanup(memoryUsage: MemoryUsage): Promise<void> {
    const alert: MemoryAlert = {
      level: 'critical',
      message: `Emergency memory cleanup (${memoryUsage.percentage.toFixed(1)}%)`,
      timestamp: Date.now(),
      memoryUsage,
      action: 'Performing aggressive cleanup',
    };

    this.notifyAlertHandlers(alert);
    console.error('Emergency memory cleanup triggered');

    // Execute all available cleanup strategies
    const availableStrategies = this.cleanupStrategies
      .filter(s => s.canExecute())
      .sort((a, b) => a.priority - b.priority);

    let totalFreed = 0;

    for (const strategy of availableStrategies) {
      try {
        const freedBytes = await strategy.execute();
        totalFreed += freedBytes;
        console.log(`Emergency cleanup: "${strategy.name}" freed ${this.formatBytes(freedBytes)}`);
      } catch (error) {
        console.error(`Emergency cleanup strategy "${strategy.name}" failed:`, error);
      }
    }

    console.log(`Emergency cleanup completed, total freed: ${this.formatBytes(totalFreed)}`);
  }

  private async handleAppBackground(): Promise<void> {
    console.log('App backgrounded - performing cleanup');

    // Reduce monitoring frequency
    this.stopMonitoring();

    // Perform background cleanup
    await this.performBackgroundCleanup();

    // Restart with reduced frequency
    this.monitoringIntervalMs = 30000; // 30 seconds
    this.startMonitoring();
  }

  private async handleAppForeground(): Promise<void> {
    console.log('App foregrounded - resuming normal monitoring');

    // Resume normal monitoring
    this.stopMonitoring();
    this.monitoringIntervalMs = 10000; // 10 seconds
    this.startMonitoring();
  }

  private async performBackgroundCleanup(): Promise<void> {
    // When app goes to background, proactively clean up
    const strategies = this.cleanupStrategies
      .filter(s => s.canExecute() && s.priority <= 3)
      .sort((a, b) => a.priority - b.priority);

    for (const strategy of strategies) {
      try {
        const freedBytes = await strategy.execute();
        console.log(`Background cleanup: "${strategy.name}" freed ${this.formatBytes(freedBytes)}`);
      } catch (error) {
        console.error(`Background cleanup strategy "${strategy.name}" failed:`, error);
      }
    }
  }

  private async cleanupOldCacheEntries(): Promise<void> {
    // Clean up cache entries that haven't been accessed recently
    const cacheKeys = cacheManager.getCacheKeys();
    const cutoffTime = Date.now() - (24 * 60 * 60 * 1000); // 24 hours ago

    for (const key of cacheKeys) {
      try {
        const item = await cacheManager.get(key);
        if (item && typeof item === 'object' && 'lastAccessed' in item) {
          if ((item as any).lastAccessed < cutoffTime) {
            await cacheManager.delete(key);
          }
        }
      } catch (error) {
        // Ignore errors during cleanup
      }
    }
  }

  private notifyAlertHandlers(alert: MemoryAlert): void {
    this.alertHandlers.forEach(handler => {
      try {
        handler(alert);
      } catch (error) {
        console.error('Memory alert handler error:', error);
      }
    });
  }

  // Public API
  async performManualCleanup(): Promise<{
    strategiesExecuted: number;
    totalFreed: number;
    errors: string[];
  }> {
    console.log('Performing manual cleanup...');

    const availableStrategies = this.cleanupStrategies
      .filter(s => s.canExecute())
      .sort((a, b) => a.priority - b.priority);

    let totalFreed = 0;
    let strategiesExecuted = 0;
    const errors: string[] = [];

    for (const strategy of availableStrategies) {
      try {
        const freedBytes = await strategy.execute();
        totalFreed += freedBytes;
        strategiesExecuted++;
        console.log(`Manual cleanup: "${strategy.name}" freed ${this.formatBytes(freedBytes)}`);
      } catch (error) {
        const errorMessage = `Strategy "${strategy.name}" failed: ${error}`;
        errors.push(errorMessage);
        console.error(errorMessage);
      }
    }

    console.log(`Manual cleanup completed: ${strategiesExecuted} strategies, ${this.formatBytes(totalFreed)} freed`);

    return {
      strategiesExecuted,
      totalFreed,
      errors,
    };
  }

  getMemoryStats(): {
    current: MemoryUsage | null;
    average: number;
    peak: number;
    trend: 'increasing' | 'decreasing' | 'stable';
    cleanupStrategies: number;
  } {
    const current = this.memoryUsageHistory[this.memoryUsageHistory.length - 1] || null;

    const percentages = this.memoryUsageHistory.map(h => h.percentage);
    const average = percentages.length > 0
      ? percentages.reduce((sum, p) => sum + p, 0) / percentages.length
      : 0;

    const peak = percentages.length > 0 ? Math.max(...percentages) : 0;

    // Calculate trend (last 10 readings)
    const recentReadings = percentages.slice(-10);
    let trend: 'increasing' | 'decreasing' | 'stable' = 'stable';

    if (recentReadings.length >= 5) {
      const firstHalf = recentReadings.slice(0, Math.floor(recentReadings.length / 2));
      const secondHalf = recentReadings.slice(Math.floor(recentReadings.length / 2));

      const firstAvg = firstHalf.reduce((sum, p) => sum + p, 0) / firstHalf.length;
      const secondAvg = secondHalf.reduce((sum, p) => sum + p, 0) / secondHalf.length;

      const difference = secondAvg - firstAvg;

      if (difference > 5) trend = 'increasing';
      else if (difference < -5) trend = 'decreasing';
    }

    return {
      current,
      average,
      peak,
      trend,
      cleanupStrategies: this.cleanupStrategies.length,
    };
  }

  addAlertHandler(handler: (alert: MemoryAlert) => void): void {
    this.alertHandlers.push(handler);
  }

  removeAlertHandler(handler: (alert: MemoryAlert) => void): void {
    const index = this.alertHandlers.indexOf(handler);
    if (index > -1) {
      this.alertHandlers.splice(index, 1);
    }
  }

  updateThresholds(newThresholds: Partial<MemoryThresholds>): void {
    this.thresholds = { ...this.thresholds, ...newThresholds };
    console.log('Memory thresholds updated:', this.thresholds);
  }

  getMemoryHistory(): MemoryUsage[] {
    return [...this.memoryUsageHistory];
  }

  private formatBytes(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(1)} ${units[unitIndex]}`;
  }

  dispose(): void {
    this.stopMonitoring();
    this.alertHandlers.length = 0;
    this.memoryUsageHistory.length = 0;
    console.log('Memory manager disposed');
  }
}

export const memoryManager = new MemoryManager();