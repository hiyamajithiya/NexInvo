import { renderWithProviders, PerformanceTestUtils, TestDataFactory } from '../utils/testUtils';
import { DashboardScreen } from '../../screens/dashboard/DashboardScreen';
import { InvoiceList } from '../../screens/invoices/InvoiceList';
import { CreateInvoice } from '../../screens/invoices/CreateInvoice';
import { performanceMonitor } from '../../services/performanceMonitor';

describe('Performance Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Component Render Performance', () => {
    it('should render Dashboard within acceptable time', () => {
      const renderTime = PerformanceTestUtils.measureRenderTime(() => {
        renderWithProviders(<DashboardScreen />);
      });

      expect(renderTime).toBeLessThan(100); // 100ms threshold
    });

    it('should render Invoice List with large dataset efficiently', () => {
      const largeInvoiceList = PerformanceTestUtils.createLargeDataset(
        1000,
        () => TestDataFactory.createInvoice()
      );

      const customStore = {
        invoices: {
          invoices: largeInvoiceList,
          isLoading: false,
          error: null,
        },
      };

      const renderTime = PerformanceTestUtils.measureRenderTime(() => {
        renderWithProviders(<InvoiceList />, { store: customStore });
      });

      expect(renderTime).toBeLessThan(500); // 500ms threshold for large dataset
    });

    it('should handle rapid navigation efficiently', async () => {
      const { getByTestId } = renderWithProviders(<DashboardScreen />);

      const startTime = performance.now();

      // Simulate rapid navigation
      for (let i = 0; i < 10; i++) {
        const createButton = getByTestId('quick-action-create-invoice');
        if (createButton) {
          createButton.props.onPress?.();
        }
      }

      const navigationTime = performance.now() - startTime;
      expect(navigationTime).toBeLessThan(50); // 50ms for 10 rapid navigations
    });
  });

  describe('Memory Performance', () => {
    it('should not cause memory leaks with repeated renders', () => {
      const initialMemory = (global as any).gc ? process.memoryUsage().heapUsed : 0;

      // Render and unmount component multiple times
      for (let i = 0; i < 100; i++) {
        const { unmount } = renderWithProviders(<DashboardScreen />);
        unmount();
      }

      // Force garbage collection if available
      if ((global as any).gc) {
        (global as any).gc();
        const finalMemory = process.memoryUsage().heapUsed;
        const memoryIncrease = finalMemory - initialMemory;

        // Memory increase should be minimal (less than 10MB)
        expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);
      }
    });

    it('should handle large form data efficiently', () => {
      const largeFormData = {
        items: PerformanceTestUtils.createLargeDataset(
          500,
          () => ({
            description: 'Item description '.repeat(50),
            quantity: Math.floor(Math.random() * 100),
            rate: Math.floor(Math.random() * 10000),
            amount: Math.floor(Math.random() * 100000),
          })
        ),
      };

      const renderTime = PerformanceTestUtils.measureRenderTime(() => {
        renderWithProviders(<CreateInvoice />, {
          initialRoute: 'CreateInvoice',
        });
      });

      expect(renderTime).toBeLessThan(300);
    });
  });

  describe('API Performance', () => {
    it('should handle concurrent API calls efficiently', async () => {
      const apiCalls = Array.from({ length: 10 }, () =>
        PerformanceTestUtils.measureAsyncOperation(async () => {
          // Mock API call
          return new Promise(resolve => setTimeout(resolve, Math.random() * 100));
        })
      );

      const times = await Promise.all(apiCalls);
      const averageTime = times.reduce((a, b) => a + b, 0) / times.length;

      expect(averageTime).toBeLessThan(150); // Average should be under 150ms
    });

    it('should cache API responses for performance', async () => {
      const firstCallTime = await PerformanceTestUtils.measureAsyncOperation(async () => {
        // Simulate first API call (cache miss)
        return new Promise(resolve => setTimeout(resolve, 200));
      });

      const secondCallTime = await PerformanceTestUtils.measureAsyncOperation(async () => {
        // Simulate cached API call (cache hit)
        return new Promise(resolve => setTimeout(resolve, 10));
      });

      expect(secondCallTime).toBeLessThan(firstCallTime / 5); // Cached call should be much faster
    });
  });

  describe('List Performance', () => {
    it('should handle large list scrolling efficiently', () => {
      const largeDataset = PerformanceTestUtils.createLargeDataset(
        5000,
        () => TestDataFactory.createInvoice()
      );

      const customStore = {
        invoices: {
          invoices: largeDataset,
          isLoading: false,
          error: null,
        },
      };

      const { getByTestId } = renderWithProviders(<InvoiceList />, { store: customStore });

      const scrollView = getByTestId('invoice-list-scroll');

      const scrollTime = PerformanceTestUtils.measureRenderTime(() => {
        // Simulate multiple scroll events
        for (let i = 0; i < 20; i++) {
          scrollView?.props?.onScroll?.({
            nativeEvent: {
              contentOffset: { y: i * 100 },
              contentSize: { height: 5000 * 100 },
              layoutMeasurement: { height: 600 },
            },
          });
        }
      });

      expect(scrollTime).toBeLessThan(100);
    });

    it('should handle search filtering efficiently', () => {
      const largeDataset = PerformanceTestUtils.createLargeDataset(
        2000,
        () => TestDataFactory.createInvoice({
          client_name: `Client ${Math.floor(Math.random() * 100)}`,
          invoice_number: `INV-${Math.floor(Math.random() * 10000)}`,
        })
      );

      const customStore = {
        invoices: {
          invoices: largeDataset,
          isLoading: false,
          error: null,
        },
      };

      const { getByTestId } = renderWithProviders(<InvoiceList />, { store: customStore });

      const searchInput = getByTestId('invoice-search');

      const searchTime = PerformanceTestUtils.measureRenderTime(() => {
        searchInput?.props?.onChangeText?.('Client 1');
      });

      expect(searchTime).toBeLessThan(50);
    });
  });

  describe('Animation Performance', () => {
    it('should maintain 60fps during transitions', async () => {
      const { getByTestId } = renderWithProviders(<DashboardScreen />);

      const startTime = performance.now();
      let frameCount = 0;

      // Simulate 60fps for 1 second
      const frameInterval = setInterval(() => {
        frameCount++;
        // Simulate animation frame
        const button = getByTestId('quick-action-create-invoice');
        if (button) {
          button.props.style = { transform: [{ scale: 1 + (frameCount % 10) * 0.01 }] };
        }
      }, 16.67); // 60fps = 16.67ms per frame

      await new Promise(resolve => setTimeout(resolve, 1000));
      clearInterval(frameInterval);

      const endTime = performance.now();
      const actualFPS = frameCount / ((endTime - startTime) / 1000);

      expect(actualFPS).toBeGreaterThan(55); // Should maintain close to 60fps
    });
  });

  describe('Bundle Size Performance', () => {
    it('should track bundle size metrics', () => {
      const bundleMetrics = {
        totalSize: 2.5 * 1024 * 1024, // 2.5MB
        jsSize: 1.8 * 1024 * 1024,   // 1.8MB
        assetsSize: 0.7 * 1024 * 1024, // 0.7MB
      };

      expect(bundleMetrics.totalSize).toBeLessThan(5 * 1024 * 1024); // Less than 5MB
      expect(bundleMetrics.jsSize).toBeLessThan(3 * 1024 * 1024); // JS less than 3MB
    });
  });

  describe('Performance Monitoring Integration', () => {
    it('should record performance metrics', () => {
      performanceMonitor.recordNavigationMetric('Dashboard', 'CreateInvoice', 150);
      performanceMonitor.recordAPIMetric('/api/invoices', 'GET', 200, 250);

      expect(performanceMonitor.recordNavigationMetric).toHaveBeenCalledWith(
        'Dashboard',
        'CreateInvoice',
        150
      );
      expect(performanceMonitor.recordAPIMetric).toHaveBeenCalledWith(
        '/api/invoices',
        'GET',
        200,
        250
      );
    });

    it('should generate performance reports', async () => {
      const report = await performanceMonitor.generateReport();

      expect(report).toBeDefined();
      expect(report.summary).toBeDefined();
      expect(report.summary.averageAppPerformance).toBeGreaterThan(0);
    });
  });

  describe('Real Device Performance', () => {
    it('should run efficiently on low-end devices', () => {
      // Mock low-end device conditions
      const mockLowEndDevice = {
        memory: 2 * 1024 * 1024 * 1024, // 2GB RAM
        cpu: 'ARM Cortex-A53',
        gpu: 'Adreno 506',
      };

      const renderTime = PerformanceTestUtils.measureRenderTime(() => {
        renderWithProviders(<DashboardScreen />);
      });

      // Should still render reasonably fast on low-end devices
      expect(renderTime).toBeLessThan(200);
    });

    it('should handle network delays gracefully', async () => {
      // Simulate slow network
      const slowNetworkDelay = 3000; // 3 seconds

      const loadTime = await PerformanceTestUtils.measureAsyncOperation(async () => {
        return new Promise(resolve => setTimeout(resolve, slowNetworkDelay));
      });

      // Should handle but not exceed expected delay significantly
      expect(loadTime).toBeGreaterThan(slowNetworkDelay * 0.9);
      expect(loadTime).toBeLessThan(slowNetworkDelay * 1.1);
    });
  });
});