import React, { ComponentType, lazy, Suspense, useState, useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet, Text } from 'react-native';
import { colors, spacing, typography } from '../theme';

interface LazyLoadingOptions {
  fallback?: ComponentType;
  preload?: boolean;
  timeout?: number;
  retryCount?: number;
}

interface LazyComponentState {
  isLoaded: boolean;
  error: Error | null;
  retryAttempts: number;
}

// Enhanced loading fallback component
const DefaultLoadingFallback: React.FC<{
  message?: string;
  showProgress?: boolean;
  error?: Error | null;
  onRetry?: () => void;
}> = ({
  message = 'Loading...',
  showProgress = false,
  error,
  onRetry
}) => {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!showProgress) return;

    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 90) return prev; // Don't complete until actually loaded
        return prev + Math.random() * 10;
      });
    }, 100);

    return () => clearInterval(interval);
  }, [showProgress]);

  if (error) {
    return (
      <View style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>Failed to Load</Text>
          <Text style={styles.errorMessage}>{error.message}</Text>
          {onRetry && (
            <Text style={styles.retryButton} onPress={onRetry}>
              Tap to Retry
            </Text>
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={styles.loadingText}>{message}</Text>
      {showProgress && (
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                { width: `${progress}%` }
              ]}
            />
          </View>
          <Text style={styles.progressText}>{Math.round(progress)}%</Text>
        </View>
      )}
    </View>
  );
};

// Enhanced lazy loading wrapper with error boundaries and retry logic
export function createLazyComponent<T extends ComponentType<any>>(
  importFunction: () => Promise<{ default: T }>,
  options: LazyLoadingOptions = {}
): ComponentType<any> {
  const {
    fallback: CustomFallback = DefaultLoadingFallback,
    preload = false,
    timeout = 10000,
    retryCount = 3
  } = options;

  // Preload the component if requested
  if (preload) {
    importFunction().catch(() => {
      // Silently fail on preload
    });
  }

  const LazyComponent = lazy(() => {
    return Promise.race([
      importFunction(),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Component loading timeout')), timeout);
      })
    ]);
  });

  return function WrappedLazyComponent(props: any) {
    const [state, setState] = useState<LazyComponentState>({
      isLoaded: false,
      error: null,
      retryAttempts: 0
    });

    const handleRetry = () => {
      if (state.retryAttempts < retryCount) {
        setState(prev => ({
          ...prev,
          error: null,
          retryAttempts: prev.retryAttempts + 1
        }));
      }
    };

    const handleError = (error: Error) => {
      setState(prev => ({
        ...prev,
        error,
        isLoaded: false
      }));
    };

    return (
      <Suspense
        fallback={
          <CustomFallback
            message="Loading component..."
            showProgress={true}
            error={state.error}
            onRetry={state.retryAttempts < retryCount ? handleRetry : undefined}
          />
        }
      >
        <ErrorBoundary onError={handleError}>
          <LazyComponent {...props} />
        </ErrorBoundary>
      </Suspense>
    );
  };
}

// Error boundary for lazy components
class ErrorBoundary extends React.Component<
  { children: React.ReactNode; onError?: (error: Error) => void },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('Lazy component error:', error, errorInfo);
    this.props.onError?.(error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <DefaultLoadingFallback
          message="Component Error"
          error={this.state.error}
          onRetry={() => this.setState({ hasError: false, error: null })}
        />
      );
    }

    return this.props.children;
  }
}

// Screen-specific lazy loading utilities
export const createLazyScreen = (
  importFunction: () => Promise<{ default: ComponentType<any> }>,
  screenName?: string
) => {
  return createLazyComponent(importFunction, {
    fallback: () => (
      <DefaultLoadingFallback
        message={screenName ? `Loading ${screenName}...` : 'Loading screen...'}
        showProgress={true}
      />
    ),
    timeout: 15000, // Longer timeout for screens
    retryCount: 2
  });
};

// Bundle splitting utilities
export class BundleSplitter {
  private static loadedBundles = new Set<string>();
  private static loadingPromises = new Map<string, Promise<any>>();

  static async loadBundle(bundleName: string, importFunction: () => Promise<any>): Promise<any> {
    // Return immediately if already loaded
    if (this.loadedBundles.has(bundleName)) {
      return Promise.resolve();
    }

    // Return existing promise if currently loading
    if (this.loadingPromises.has(bundleName)) {
      return this.loadingPromises.get(bundleName);
    }

    // Start loading the bundle
    const loadingPromise = importFunction()
      .then(result => {
        this.loadedBundles.add(bundleName);
        this.loadingPromises.delete(bundleName);
        return result;
      })
      .catch(error => {
        this.loadingPromises.delete(bundleName);
        throw error;
      });

    this.loadingPromises.set(bundleName, loadingPromise);
    return loadingPromise;
  }

  static preloadBundle(bundleName: string, importFunction: () => Promise<any>): void {
    // Only preload if not already loaded or loading
    if (!this.loadedBundles.has(bundleName) && !this.loadingPromises.has(bundleName)) {
      this.loadBundle(bundleName, importFunction).catch(() => {
        // Silently fail on preload
      });
    }
  }

  static isBundleLoaded(bundleName: string): boolean {
    return this.loadedBundles.has(bundleName);
  }

  static clearCache(): void {
    this.loadedBundles.clear();
    this.loadingPromises.clear();
  }
}

// React hook for progressive loading
export function useProgressiveLoading<T>(
  loadFunction: () => Promise<T>,
  dependencies: any[] = []
): {
  data: T | null;
  loading: boolean;
  error: Error | null;
  progress: number;
  retry: () => void;
} {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [progress, setProgress] = useState(0);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    setProgress(0);

    // Simulate progress updates
    const progressInterval = setInterval(() => {
      setProgress(prev => Math.min(prev + Math.random() * 20, 90));
    }, 100);

    try {
      const result = await loadFunction();
      setData(result);
      setProgress(100);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      clearInterval(progressInterval);
      setLoading(false);
    }
  }, dependencies);

  React.useEffect(() => {
    load();
  }, [load]);

  return {
    data,
    loading,
    error,
    progress,
    retry: load
  };
}

// Memory-efficient component loader
export class ComponentCache {
  private static cache = new Map<string, ComponentType<any>>();
  private static maxCacheSize = 20;

  static getComponent(key: string): ComponentType<any> | undefined {
    return this.cache.get(key);
  }

  static setComponent(key: string, component: ComponentType<any>): void {
    // Implement LRU cache
    if (this.cache.size >= this.maxCacheSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }

    this.cache.set(key, component);
  }

  static clearCache(): void {
    this.cache.clear();
  }

  static getCacheSize(): number {
    return this.cache.size;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
    padding: spacing.xl,
  },
  loadingText: {
    fontSize: typography.fontSizes.md,
    color: colors.textSecondary,
    marginTop: spacing.lg,
    textAlign: 'center',
  },
  progressContainer: {
    marginTop: spacing.lg,
    width: '80%',
    alignItems: 'center',
  },
  progressBar: {
    width: '100%',
    height: 6,
    backgroundColor: colors.gray200,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 3,
  },
  progressText: {
    fontSize: typography.fontSizes.sm,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  errorContainer: {
    alignItems: 'center',
    padding: spacing.lg,
  },
  errorTitle: {
    fontSize: typography.fontSizes.lg,
    fontWeight: typography.fontWeights.semibold,
    color: colors.error,
    marginBottom: spacing.sm,
  },
  errorMessage: {
    fontSize: typography.fontSizes.md,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  retryButton: {
    fontSize: typography.fontSizes.md,
    color: colors.primary,
    fontWeight: typography.fontWeights.medium,
    textDecorationLine: 'underline',
  },
});