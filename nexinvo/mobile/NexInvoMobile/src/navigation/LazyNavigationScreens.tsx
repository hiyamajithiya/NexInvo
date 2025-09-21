import { createLazyScreen, BundleSplitter } from '../utils/lazyLoading';

// Lazy load all screens for better performance and smaller initial bundle
export const LazyDashboardScreen = createLazyScreen(
  () => BundleSplitter.loadBundle('dashboard', () => import('../screens/dashboard/DashboardScreen')),
  'Dashboard'
);

export const LazyInvoiceListScreen = createLazyScreen(
  () => BundleSplitter.loadBundle('invoice-list', () => import('../screens/invoices/InvoiceListScreen')),
  'Invoice List'
);

export const LazyCreateInvoiceScreen = createLazyScreen(
  () => BundleSplitter.loadBundle('create-invoice', () => import('../screens/invoices/CreateInvoiceScreen')),
  'Create Invoice'
);

export const LazyInvoiceDetailScreen = createLazyScreen(
  () => BundleSplitter.loadBundle('invoice-detail', () => import('../screens/invoices/InvoiceDetailScreen')),
  'Invoice Details'
);

export const LazyClientListScreen = createLazyScreen(
  () => BundleSplitter.loadBundle('client-list', () => import('../screens/clients/ClientListScreen')),
  'Client List'
);

export const LazyCreateClientScreen = createLazyScreen(
  () => BundleSplitter.loadBundle('create-client', () => import('../screens/clients/CreateClientScreen')),
  'Create Client'
);

export const LazyClientDetailScreen = createLazyScreen(
  () => BundleSplitter.loadBundle('client-detail', () => import('../screens/clients/ClientDetailScreen')),
  'Client Details'
);

export const LazyPaymentScreen = createLazyScreen(
  () => BundleSplitter.loadBundle('payments', () => import('../screens/payments/PaymentScreen')),
  'Payments'
);

export const LazyReportsScreen = createLazyScreen(
  () => BundleSplitter.loadBundle('reports', () => import('../screens/reports/ReportsScreen')),
  'Reports'
);

export const LazySettingsScreen = createLazyScreen(
  () => BundleSplitter.loadBundle('settings', () => import('../screens/settings/SettingsScreen')),
  'Settings'
);

export const LazyProfileScreen = createLazyScreen(
  () => BundleSplitter.loadBundle('profile', () => import('../screens/profile/ProfileScreen')),
  'Profile'
);

export const LazyNotificationsScreen = createLazyScreen(
  () => BundleSplitter.loadBundle('notifications', () => import('../screens/notifications/NotificationsScreen')),
  'Notifications'
);

// Integration screens (larger bundles)
export const LazyIntegrationsScreen = createLazyScreen(
  () => BundleSplitter.loadBundle('integrations', () => import('../screens/integrations/IntegrationsScreen')),
  'Integrations'
);

export const LazyWebhookMonitorScreen = createLazyScreen(
  () => BundleSplitter.loadBundle('webhook-monitor', () => import('../screens/integrations/WebhookMonitorScreen')),
  'Webhook Monitor'
);

export const LazyIntegrationDashboard = createLazyScreen(
  () => BundleSplitter.loadBundle('integration-dashboard', () => import('../screens/integrations/IntegrationDashboard')),
  'Integration Dashboard'
);

export const LazyTroubleshootingScreen = createLazyScreen(
  () => BundleSplitter.loadBundle('troubleshooting', () => import('../screens/integrations/TroubleshootingScreen')),
  'Troubleshooting'
);

// Authentication screens (always preloaded)
export const LazyLoginScreen = createLazyScreen(
  () => import('../screens/auth/LoginScreen'),
  'Login'
);

export const LazyRegisterScreen = createLazyScreen(
  () => import('../screens/auth/RegisterScreen'),
  'Register'
);

export const LazyForgotPasswordScreen = createLazyScreen(
  () => import('../screens/auth/ForgotPasswordScreen'),
  'Forgot Password'
);

// Preloading strategy
export class NavigationPreloader {
  private static preloadedRoutes = new Set<string>();

  // Preload essential screens on app startup
  static preloadEssentialScreens(): void {
    const essentialBundles = [
      { name: 'dashboard', loader: () => import('../screens/dashboard/DashboardScreen') },
      { name: 'invoice-list', loader: () => import('../screens/invoices/InvoiceListScreen') },
      { name: 'client-list', loader: () => import('../screens/clients/ClientListScreen') },
    ];

    essentialBundles.forEach(({ name, loader }) => {
      if (!this.preloadedRoutes.has(name)) {
        BundleSplitter.preloadBundle(name, loader);
        this.preloadedRoutes.add(name);
      }
    });
  }

  // Preload screens based on user navigation patterns
  static preloadByUserJourney(currentScreen: string): void {
    const journeyMap: Record<string, string[]> = {
      'Dashboard': ['invoice-list', 'create-invoice', 'client-list'],
      'InvoiceList': ['create-invoice', 'invoice-detail'],
      'ClientList': ['create-client', 'client-detail'],
      'CreateInvoice': ['client-list', 'invoice-list'],
      'Integrations': ['integration-dashboard', 'webhook-monitor'],
    };

    const routesToPreload = journeyMap[currentScreen] || [];

    routesToPreload.forEach(route => {
      if (!this.preloadedRoutes.has(route)) {
        this.preloadRoute(route);
      }
    });
  }

  // Preload specific route
  static preloadRoute(route: string): void {
    const routeLoaders: Record<string, () => Promise<any>> = {
      'dashboard': () => import('../screens/dashboard/DashboardScreen'),
      'invoice-list': () => import('../screens/invoices/InvoiceListScreen'),
      'create-invoice': () => import('../screens/invoices/CreateInvoiceScreen'),
      'invoice-detail': () => import('../screens/invoices/InvoiceDetailScreen'),
      'client-list': () => import('../screens/clients/ClientListScreen'),
      'create-client': () => import('../screens/clients/CreateClientScreen'),
      'client-detail': () => import('../screens/clients/ClientDetailScreen'),
      'payments': () => import('../screens/payments/PaymentScreen'),
      'reports': () => import('../screens/reports/ReportsScreen'),
      'settings': () => import('../screens/settings/SettingsScreen'),
      'profile': () => import('../screens/profile/ProfileScreen'),
      'notifications': () => import('../screens/notifications/NotificationsScreen'),
      'integrations': () => import('../screens/integrations/IntegrationsScreen'),
      'webhook-monitor': () => import('../screens/integrations/WebhookMonitorScreen'),
      'integration-dashboard': () => import('../screens/integrations/IntegrationDashboard'),
      'troubleshooting': () => import('../screens/integrations/TroubleshootingScreen'),
    };

    const loader = routeLoaders[route];
    if (loader && !this.preloadedRoutes.has(route)) {
      BundleSplitter.preloadBundle(route, loader);
      this.preloadedRoutes.add(route);
    }
  }

  // Preload based on time of day (business hours = business screens)
  static preloadByTimeContext(): void {
    const hour = new Date().getHours();

    if (hour >= 9 && hour <= 17) {
      // Business hours - preload business screens
      this.preloadRoute('invoice-list');
      this.preloadRoute('create-invoice');
      this.preloadRoute('client-list');
      this.preloadRoute('reports');
    } else {
      // Off hours - preload settings and profile
      this.preloadRoute('settings');
      this.preloadRoute('profile');
      this.preloadRoute('notifications');
    }
  }

  // Preload based on device capabilities
  static preloadByDeviceCapability(): void {
    // Only preload heavy screens on devices with good performance
    const isHighPerformanceDevice = true; // You can implement device detection

    if (isHighPerformanceDevice) {
      this.preloadRoute('integrations');
      this.preloadRoute('integration-dashboard');
      this.preloadRoute('reports');
    }
  }

  // Intelligent preloading based on usage patterns
  static intelligentPreload(userPreferences: {
    frequentlyUsedScreens: string[];
    lastUsedScreens: string[];
    timeOfLastUse: Record<string, number>;
  }): void {
    // Preload frequently used screens
    userPreferences.frequentlyUsedScreens.slice(0, 3).forEach(screen => {
      this.preloadRoute(screen);
    });

    // Preload recently used screens
    userPreferences.lastUsedScreens.slice(0, 2).forEach(screen => {
      this.preloadRoute(screen);
    });

    // Preload screens based on time patterns
    this.preloadByTimeContext();

    // Preload based on device capability
    this.preloadByDeviceCapability();
  }

  static getPreloadedRoutes(): string[] {
    return Array.from(this.preloadedRoutes);
  }

  static clearPreloadCache(): void {
    this.preloadedRoutes.clear();
    BundleSplitter.clearCache();
  }
}

// Hook for navigation preloading
export function useNavigationPreloading(): {
  preloadRoute: (route: string) => void;
  preloadedRoutes: string[];
  isRoutePreloaded: (route: string) => boolean;
} {
  const preloadRoute = (route: string) => {
    NavigationPreloader.preloadRoute(route);
  };

  const preloadedRoutes = NavigationPreloader.getPreloadedRoutes();

  const isRoutePreloaded = (route: string) => {
    return BundleSplitter.isBundleLoaded(route);
  };

  return {
    preloadRoute,
    preloadedRoutes,
    isRoutePreloaded,
  };
}