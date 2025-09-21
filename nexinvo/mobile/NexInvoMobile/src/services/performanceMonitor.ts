import { Platform, InteractionManager, Dimensions } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';

interface PerformanceMetric {
  id: string;
  name: string;
  value: number;
  unit: string;
  timestamp: number;
  category: 'memory' | 'network' | 'rendering' | 'navigation' | 'api' | 'user_interaction';
  metadata?: Record<string, any>;
}

interface RenderingMetrics {
  frameDrops: number;
  averageFPS: number;
  renderTime: number;
  viewsRendered: number;
}

interface NavigationMetrics {
  screenLoadTime: number;
  transitionDuration: number;
  bundleLoadTime?: number;
  routeName: string;
}

interface APIMetrics {
  endpoint: string;
  method: string;
  responseTime: number;
  statusCode: number;
  dataSize: number;
  cacheHit: boolean;
}

interface UserInteractionMetrics {
  type: 'tap' | 'scroll' | 'swipe' | 'long_press';
  responseTime: number;
  element: string;
  coordinates?: { x: number; y: number };
}

interface PerformanceReport {
  period: {
    start: Date;
    end: Date;
  };
  summary: {
    totalMetrics: number;
    averageAppPerformance: number; // 0-100 score
    topBottlenecks: string[];
    memoryLeaks: boolean;
  };
  categories: {
    memory: PerformanceMetric[];
    network: PerformanceMetric[];
    rendering: PerformanceMetric[];
    navigation: PerformanceMetric[];
    api: PerformanceMetric[];
    user_interaction: PerformanceMetric[];
  };
  recommendations: string[];
}

interface PerformanceThresholds {
  maxRenderTime: number; // milliseconds
  maxNavigationTime: number; // milliseconds
  maxAPIResponseTime: number; // milliseconds
  minFPS: number;
  maxMemoryUsage: number; // percentage
}

class PerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  private isMonitoring = false;
  private startTime = Date.now();
  private frameDropCounter = 0;
  private renderingMetrics: RenderingMetrics = {
    frameDrops: 0,
    averageFPS: 60,
    renderTime: 0,
    viewsRendered: 0,
  };

  private thresholds: PerformanceThresholds = {
    maxRenderTime: 16, // 60 FPS = 16ms per frame
    maxNavigationTime: 300, // 300ms
    maxAPIResponseTime: 2000, // 2 seconds
    minFPS: 45,
    maxMemoryUsage: 80, // 80%
  };

  private readonly maxMetricsCount = 1000;
  private readonly reportingInterval = 60000; // 1 minute

  async initialize(): Promise<void> {
    try {
      await this.loadStoredMetrics();
      this.setupPerformanceObservers();
      this.startMonitoring();
      this.scheduleReporting();
      console.log('Performance monitor initialized');
    } catch (error) {
      console.error('Failed to initialize performance monitor:', error);
    }
  }

  private setupPerformanceObservers(): void {
    // Monitor React Native bridge performance
    if (__DEV__) {
      this.setupRNBridgeMonitoring();
    }

    // Monitor frame drops and rendering performance
    this.setupRenderingMonitoring();

    // Monitor memory pressure
    this.setupMemoryMonitoring();
  }

  private setupRNBridgeMonitoring(): void {
    // In development, we can monitor React Native bridge calls
    const originalBridgeCall = (global as any).__fbBatchedBridge?.callFunctionReturnFlushedQueue;

    if (originalBridgeCall) {
      (global as any).__fbBatchedBridge.callFunctionReturnFlushedQueue = (...args: any[]) => {
        const startTime = performance.now();
        const result = originalBridgeCall.apply((global as any).__fbBatchedBridge, args);
        const endTime = performance.now();

        this.recordMetric({
          id: `bridge_call_${Date.now()}`,
          name: 'React Native Bridge Call',
          value: endTime - startTime,
          unit: 'ms',
          timestamp: Date.now(),
          category: 'rendering',
          metadata: {
            module: args[0],
            method: args[1],
            args: args[2]?.length || 0,
          },
        });

        return result;
      };
    }
  }

  private setupRenderingMonitoring(): void {
    // Monitor frame drops using RAF
    let lastFrameTime = performance.now();
    let frameCount = 0;

    const monitorFrame = (currentTime: number) => {
      if (this.isMonitoring) {
        const frameDuration = currentTime - lastFrameTime;
        frameCount++;

        // Detect frame drops (more than 16.67ms for 60 FPS)
        if (frameDuration > this.thresholds.maxRenderTime * 1.5) {
          this.frameDropCounter++;
          this.renderingMetrics.frameDrops++;

          this.recordMetric({
            id: `frame_drop_${Date.now()}`,
            name: 'Frame Drop',
            value: frameDuration,
            unit: 'ms',
            timestamp: Date.now(),
            category: 'rendering',
            metadata: {
              expectedFrameTime: this.thresholds.maxRenderTime,
              actualFrameTime: frameDuration,
            },
          });
        }

        // Calculate FPS every second
        if (frameCount % 60 === 0) {
          const fps = 1000 / frameDuration;
          this.renderingMetrics.averageFPS = fps;

          if (fps < this.thresholds.minFPS) {
            this.recordMetric({
              id: `low_fps_${Date.now()}`,
              name: 'Low FPS',
              value: fps,
              unit: 'fps',
              timestamp: Date.now(),
              category: 'rendering',
              metadata: {
                minExpected: this.thresholds.minFPS,
              },
            });
          }
        }

        lastFrameTime = currentTime;
        requestAnimationFrame(monitorFrame);
      }
    };

    requestAnimationFrame(monitorFrame);
  }

  private setupMemoryMonitoring(): void {
    // Monitor memory usage periodically
    setInterval(() => {
      if (this.isMonitoring) {
        this.checkMemoryUsage();
      }
    }, 30000); // Every 30 seconds
  }

  private async checkMemoryUsage(): Promise<void> {
    try {
      // In a real implementation, you would get actual memory usage
      // For now, we'll simulate it
      const mockMemoryUsage = Math.random() * 100;

      if (mockMemoryUsage > this.thresholds.maxMemoryUsage) {
        this.recordMetric({
          id: `high_memory_${Date.now()}`,
          name: 'High Memory Usage',
          value: mockMemoryUsage,
          unit: '%',
          timestamp: Date.now(),
          category: 'memory',
          metadata: {
            threshold: this.thresholds.maxMemoryUsage,
          },
        });
      }
    } catch (error) {
      console.error('Memory monitoring error:', error);
    }
  }

  // Public API for recording metrics
  recordNavigationMetric(metrics: NavigationMetrics): void {
    this.recordMetric({
      id: `navigation_${Date.now()}`,
      name: 'Screen Navigation',
      value: metrics.screenLoadTime,
      unit: 'ms',
      timestamp: Date.now(),
      category: 'navigation',
      metadata: {
        routeName: metrics.routeName,
        transitionDuration: metrics.transitionDuration,
        bundleLoadTime: metrics.bundleLoadTime,
      },
    });

    // Check if navigation is slow
    if (metrics.screenLoadTime > this.thresholds.maxNavigationTime) {
      this.recordMetric({
        id: `slow_navigation_${Date.now()}`,
        name: 'Slow Navigation',
        value: metrics.screenLoadTime,
        unit: 'ms',
        timestamp: Date.now(),
        category: 'navigation',
        metadata: {
          routeName: metrics.routeName,
          threshold: this.thresholds.maxNavigationTime,
        },
      });
    }
  }

  recordAPIMetric(metrics: APIMetrics): void {
    this.recordMetric({
      id: `api_${Date.now()}`,
      name: 'API Call',
      value: metrics.responseTime,
      unit: 'ms',
      timestamp: Date.now(),
      category: 'api',
      metadata: {
        endpoint: metrics.endpoint,
        method: metrics.method,
        statusCode: metrics.statusCode,
        dataSize: metrics.dataSize,
        cacheHit: metrics.cacheHit,
      },
    });

    // Check if API call is slow
    if (metrics.responseTime > this.thresholds.maxAPIResponseTime) {
      this.recordMetric({
        id: `slow_api_${Date.now()}`,
        name: 'Slow API Call',
        value: metrics.responseTime,
        unit: 'ms',
        timestamp: Date.now(),
        category: 'api',
        metadata: {
          endpoint: metrics.endpoint,
          threshold: this.thresholds.maxAPIResponseTime,
        },
      });
    }
  }

  recordUserInteractionMetric(metrics: UserInteractionMetrics): void {
    this.recordMetric({
      id: `interaction_${Date.now()}`,
      name: 'User Interaction',
      value: metrics.responseTime,
      unit: 'ms',
      timestamp: Date.now(),
      category: 'user_interaction',
      metadata: {
        type: metrics.type,
        element: metrics.element,
        coordinates: metrics.coordinates,
      },
    });
  }

  recordCustomMetric(
    name: string,
    value: number,
    unit: string,
    category: PerformanceMetric['category'],
    metadata?: Record<string, any>
  ): void {
    this.recordMetric({
      id: `custom_${Date.now()}`,
      name,
      value,
      unit,
      timestamp: Date.now(),
      category,
      metadata,
    });
  }

  // Timing utilities
  startTimer(id: string): void {
    const timerMetric: PerformanceMetric = {
      id: `timer_start_${id}`,
      name: `Timer Start: ${id}`,
      value: performance.now(),
      unit: 'ms',
      timestamp: Date.now(),
      category: 'user_interaction',
      metadata: { timerId: id, type: 'timer_start' },
    };

    this.recordMetric(timerMetric);
  }

  endTimer(id: string, category: PerformanceMetric['category'] = 'user_interaction'): number {
    const endTime = performance.now();
    const startMetric = this.metrics.find(
      m => m.metadata?.timerId === id && m.metadata?.type === 'timer_start'
    );

    if (startMetric) {
      const duration = endTime - startMetric.value;

      this.recordMetric({
        id: `timer_end_${id}`,
        name: `Timer Duration: ${id}`,
        value: duration,
        unit: 'ms',
        timestamp: Date.now(),
        category,
        metadata: { timerId: id, type: 'timer_end' },
      });

      return duration;
    }

    return 0;
  }

  // Automated performance profiling
  async profileFunction<T>(
    fn: () => Promise<T> | T,
    name: string,
    category: PerformanceMetric['category'] = 'user_interaction'
  ): Promise<T> {
    const startTime = performance.now();

    try {
      const result = await fn();
      const endTime = performance.now();
      const duration = endTime - startTime;

      this.recordMetric({
        id: `profile_${Date.now()}`,
        name: `Function Profile: ${name}`,
        value: duration,
        unit: 'ms',
        timestamp: Date.now(),
        category,
        metadata: {
          functionName: name,
          success: true,
        },
      });

      return result;
    } catch (error) {
      const endTime = performance.now();
      const duration = endTime - startTime;

      this.recordMetric({
        id: `profile_error_${Date.now()}`,
        name: `Function Profile Error: ${name}`,
        value: duration,
        unit: 'ms',
        timestamp: Date.now(),
        category,
        metadata: {
          functionName: name,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      });

      throw error;
    }
  }

  // Analytics and reporting
  async generateReport(
    startDate?: Date,
    endDate?: Date
  ): Promise<PerformanceReport> {
    const start = startDate || new Date(Date.now() - 24 * 60 * 60 * 1000); // Last 24 hours
    const end = endDate || new Date();

    const filteredMetrics = this.metrics.filter(
      m => m.timestamp >= start.getTime() && m.timestamp <= end.getTime()
    );

    const categorizedMetrics = {
      memory: filteredMetrics.filter(m => m.category === 'memory'),
      network: filteredMetrics.filter(m => m.category === 'network'),
      rendering: filteredMetrics.filter(m => m.category === 'rendering'),
      navigation: filteredMetrics.filter(m => m.category === 'navigation'),
      api: filteredMetrics.filter(m => m.category === 'api'),
      user_interaction: filteredMetrics.filter(m => m.category === 'user_interaction'),
    };

    // Calculate performance score
    const averageAppPerformance = this.calculatePerformanceScore(filteredMetrics);

    // Identify bottlenecks
    const topBottlenecks = this.identifyBottlenecks(filteredMetrics);

    // Check for memory leaks
    const memoryLeaks = this.detectMemoryLeaks(categorizedMetrics.memory);

    // Generate recommendations
    const recommendations = this.generateRecommendations(filteredMetrics);

    return {
      period: { start, end },
      summary: {
        totalMetrics: filteredMetrics.length,
        averageAppPerformance,
        topBottlenecks,
        memoryLeaks,
      },
      categories: categorizedMetrics,
      recommendations,
    };
  }

  private calculatePerformanceScore(metrics: PerformanceMetric[]): number {
    if (metrics.length === 0) return 100;

    let score = 100;

    // Penalize for performance issues
    const slowNavigations = metrics.filter(
      m => m.category === 'navigation' && m.value > this.thresholds.maxNavigationTime
    ).length;

    const slowAPIs = metrics.filter(
      m => m.category === 'api' && m.value > this.thresholds.maxAPIResponseTime
    ).length;

    const frameDrops = metrics.filter(
      m => m.category === 'rendering' && m.name === 'Frame Drop'
    ).length;

    const memoryIssues = metrics.filter(
      m => m.category === 'memory' && m.value > this.thresholds.maxMemoryUsage
    ).length;

    // Apply penalties
    score -= slowNavigations * 5;
    score -= slowAPIs * 3;
    score -= frameDrops * 2;
    score -= memoryIssues * 4;

    return Math.max(0, Math.min(100, score));
  }

  private identifyBottlenecks(metrics: PerformanceMetric[]): string[] {
    const bottlenecks: string[] = [];

    // Group metrics by name and find the worst performers
    const metricGroups = metrics.reduce((groups, metric) => {
      if (!groups[metric.name]) {
        groups[metric.name] = [];
      }
      groups[metric.name].push(metric);
      return groups;
    }, {} as Record<string, PerformanceMetric[]>);

    Object.entries(metricGroups).forEach(([name, groupMetrics]) => {
      const averageValue = groupMetrics.reduce((sum, m) => sum + m.value, 0) / groupMetrics.length;
      const maxValue = Math.max(...groupMetrics.map(m => m.value));

      // Check if this metric group is consistently slow
      if (groupMetrics.length > 5) {
        if (name.includes('Navigation') && averageValue > this.thresholds.maxNavigationTime) {
          bottlenecks.push(`Slow navigation: ${name} (avg: ${averageValue.toFixed(1)}ms)`);
        } else if (name.includes('API') && averageValue > this.thresholds.maxAPIResponseTime) {
          bottlenecks.push(`Slow API calls: ${name} (avg: ${averageValue.toFixed(1)}ms)`);
        } else if (name.includes('Frame') && groupMetrics.length > 10) {
          bottlenecks.push(`Frequent frame drops: ${groupMetrics.length} occurrences`);
        }
      }
    });

    return bottlenecks.slice(0, 5); // Top 5 bottlenecks
  }

  private detectMemoryLeaks(memoryMetrics: PerformanceMetric[]): boolean {
    if (memoryMetrics.length < 10) return false;

    // Simple trend analysis - if memory usage is consistently increasing
    const sortedMetrics = memoryMetrics.sort((a, b) => a.timestamp - b.timestamp);
    const firstHalf = sortedMetrics.slice(0, Math.floor(sortedMetrics.length / 2));
    const secondHalf = sortedMetrics.slice(Math.floor(sortedMetrics.length / 2));

    const firstHalfAvg = firstHalf.reduce((sum, m) => sum + m.value, 0) / firstHalf.length;
    const secondHalfAvg = secondHalf.reduce((sum, m) => sum + m.value, 0) / secondHalf.length;

    // If memory usage increased by more than 20% over time, flag as potential leak
    return (secondHalfAvg - firstHalfAvg) / firstHalfAvg > 0.2;
  }

  private generateRecommendations(metrics: PerformanceMetric[]): string[] {
    const recommendations: string[] = [];

    const navigationMetrics = metrics.filter(m => m.category === 'navigation');
    const apiMetrics = metrics.filter(m => m.category === 'api');
    const renderingMetrics = metrics.filter(m => m.category === 'rendering');
    const memoryMetrics = metrics.filter(m => m.category === 'memory');

    // Navigation recommendations
    const slowNavigations = navigationMetrics.filter(m => m.value > this.thresholds.maxNavigationTime);
    if (slowNavigations.length > 0) {
      recommendations.push('Consider implementing code splitting and lazy loading for faster navigation');
      recommendations.push('Optimize bundle sizes to reduce screen load times');
    }

    // API recommendations
    const slowAPIs = apiMetrics.filter(m => m.value > this.thresholds.maxAPIResponseTime);
    if (slowAPIs.length > 0) {
      recommendations.push('Implement caching strategies for frequently accessed data');
      recommendations.push('Consider implementing request debouncing and pagination');
    }

    // Rendering recommendations
    const frameDrops = renderingMetrics.filter(m => m.name === 'Frame Drop');
    if (frameDrops.length > 10) {
      recommendations.push('Optimize component rendering with React.memo and useMemo');
      recommendations.push('Consider virtualizing long lists to improve scrolling performance');
    }

    // Memory recommendations
    if (memoryMetrics.some(m => m.value > this.thresholds.maxMemoryUsage)) {
      recommendations.push('Implement proper memory cleanup in useEffect hooks');
      recommendations.push('Consider reducing image cache sizes and implementing progressive loading');
    }

    return recommendations;
  }

  // Data management
  private recordMetric(metric: PerformanceMetric): void {
    this.metrics.push(metric);

    // Keep only the last N metrics to prevent memory bloat
    if (this.metrics.length > this.maxMetricsCount) {
      this.metrics.shift();
    }

    // Store metrics periodically
    if (this.metrics.length % 50 === 0) {
      this.storeMetrics();
    }
  }

  private async storeMetrics(): Promise<void> {
    try {
      const recentMetrics = this.metrics.slice(-100); // Store last 100 metrics
      await AsyncStorage.setItem('performance_metrics', JSON.stringify(recentMetrics));
    } catch (error) {
      console.error('Failed to store performance metrics:', error);
    }
  }

  private async loadStoredMetrics(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem('performance_metrics');
      if (stored) {
        const storedMetrics = JSON.parse(stored);
        this.metrics = storedMetrics;
        console.log(`Loaded ${storedMetrics.length} stored performance metrics`);
      }
    } catch (error) {
      console.error('Failed to load stored performance metrics:', error);
    }
  }

  private startMonitoring(): void {
    this.isMonitoring = true;
    this.startTime = Date.now();
    console.log('Performance monitoring started');
  }

  private scheduleReporting(): void {
    setInterval(() => {
      if (this.isMonitoring) {
        this.generateAndLogReport();
      }
    }, this.reportingInterval);
  }

  private async generateAndLogReport(): Promise<void> {
    try {
      const report = await this.generateReport();
      console.log('Performance Report:', {
        period: report.period,
        summary: report.summary,
        recommendations: report.recommendations,
      });
    } catch (error) {
      console.error('Failed to generate performance report:', error);
    }
  }

  // Public API
  getMetrics(): PerformanceMetric[] {
    return [...this.metrics];
  }

  getRenderingMetrics(): RenderingMetrics {
    return { ...this.renderingMetrics };
  }

  updateThresholds(newThresholds: Partial<PerformanceThresholds>): void {
    this.thresholds = { ...this.thresholds, ...newThresholds };
    console.log('Performance thresholds updated:', this.thresholds);
  }

  clearMetrics(): void {
    this.metrics = [];
    this.renderingMetrics = {
      frameDrops: 0,
      averageFPS: 60,
      renderTime: 0,
      viewsRendered: 0,
    };
    console.log('Performance metrics cleared');
  }

  stopMonitoring(): void {
    this.isMonitoring = false;
    console.log('Performance monitoring stopped');
  }

  dispose(): void {
    this.stopMonitoring();
    this.storeMetrics();
    console.log('Performance monitor disposed');
  }
}

export const performanceMonitor = new PerformanceMonitor();