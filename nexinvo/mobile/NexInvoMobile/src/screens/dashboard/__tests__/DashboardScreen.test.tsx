import React from 'react';
import { fireEvent, waitFor } from '@testing-library/react-native';
import { renderWithProviders, TestDataFactory, mockNavigation } from '../../../__tests__/utils/testUtils';
import DashboardScreen from '../DashboardScreen';

// Mock the navigation hook
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => mockNavigation,
}));

describe('DashboardScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render dashboard with all main sections', async () => {
      const { getByText, getByTestId } = renderWithProviders(<DashboardScreen />);

      // Wait for async content to load
      await waitFor(() => {
        expect(getByText('Dashboard')).toBeTruthy();
      });

      // Check for main dashboard sections
      expect(getByText('Recent Invoices')).toBeTruthy();
      expect(getByText('Quick Actions')).toBeTruthy();
      expect(getByText('Performance Overview')).toBeTruthy();
    });

    it('should display user greeting', async () => {
      const customStore = {
        auth: {
          user: { name: 'John Doe', email: 'john@example.com' },
          isAuthenticated: true,
        },
      };

      const { getByText } = renderWithProviders(<DashboardScreen />, {
        store: customStore,
      });

      await waitFor(() => {
        expect(getByText(/Hello, John/)).toBeTruthy();
      });
    });

    it('should show loading state initially', () => {
      const loadingStore = {
        invoices: { isLoading: true, invoices: [] },
        clients: { isLoading: true, clients: [] },
      };

      const { getByTestId } = renderWithProviders(<DashboardScreen />, {
        store: loadingStore,
      });

      expect(getByTestId('loading-indicator')).toBeTruthy();
    });

    it('should display statistics cards', async () => {
      const { getByText } = renderWithProviders(<DashboardScreen />);

      await waitFor(() => {
        expect(getByText('Total Invoices')).toBeTruthy();
        expect(getByText('Pending Amount')).toBeTruthy();
        expect(getByText('This Month')).toBeTruthy();
        expect(getByText('Active Clients')).toBeTruthy();
      });
    });
  });

  describe('Data Loading', () => {
    it('should load dashboard data on mount', async () => {
      const { getByTestId } = renderWithProviders(<DashboardScreen />);

      // Should trigger data loading
      await waitFor(() => {
        expect(getByTestId('dashboard-content')).toBeTruthy();
      });
    });

    it('should handle empty invoice state', async () => {
      const emptyStore = {
        invoices: { invoices: [], isLoading: false },
        clients: { clients: [], isLoading: false },
      };

      const { getByText } = renderWithProviders(<DashboardScreen />, {
        store: emptyStore,
      });

      await waitFor(() => {
        expect(getByText('No invoices yet')).toBeTruthy();
      });
    });

    it('should display recent invoices', async () => {
      const invoicesStore = {
        invoices: {
          invoices: [
            TestDataFactory.createInvoice({
              invoice_number: 'INV-001',
              client_name: 'Test Client',
              status: 'pending',
            }),
            TestDataFactory.createInvoice({
              invoice_number: 'INV-002',
              client_name: 'Another Client',
              status: 'paid',
            }),
          ],
          isLoading: false,
        },
      };

      const { getByText } = renderWithProviders(<DashboardScreen />, {
        store: invoicesStore,
      });

      await waitFor(() => {
        expect(getByText('INV-001')).toBeTruthy();
        expect(getByText('INV-002')).toBeTruthy();
        expect(getByText('Test Client')).toBeTruthy();
        expect(getByText('Another Client')).toBeTruthy();
      });
    });
  });

  describe('Quick Actions', () => {
    it('should navigate to create invoice on action press', async () => {
      const { getByTestId } = renderWithProviders(<DashboardScreen />);

      await waitFor(() => {
        const createInvoiceButton = getByTestId('quick-action-create-invoice');
        fireEvent.press(createInvoiceButton);
      });

      expect(mockNavigation.navigate).toHaveBeenCalledWith('CreateInvoice');
    });

    it('should navigate to add client on action press', async () => {
      const { getByTestId } = renderWithProviders(<DashboardScreen />);

      await waitFor(() => {
        const addClientButton = getByTestId('quick-action-add-client');
        fireEvent.press(addClientButton);
      });

      expect(mockNavigation.navigate).toHaveBeenCalledWith('CreateClient');
    });

    it('should navigate to view reports on action press', async () => {
      const { getByTestId } = renderWithProviders(<DashboardScreen />);

      await waitFor(() => {
        const viewReportsButton = getByTestId('quick-action-view-reports');
        fireEvent.press(viewReportsButton);
      });

      expect(mockNavigation.navigate).toHaveBeenCalledWith('Reports');
    });

    it('should navigate to settings on action press', async () => {
      const { getByTestId } = renderWithProviders(<DashboardScreen />);

      await waitFor(() => {
        const settingsButton = getByTestId('quick-action-settings');
        fireEvent.press(settingsButton);
      });

      expect(mockNavigation.navigate).toHaveBeenCalledWith('Settings');
    });
  });

  describe('Statistics Display', () => {
    it('should calculate and display correct statistics', async () => {
      const statsStore = {
        invoices: {
          invoices: [
            TestDataFactory.createInvoice({ grand_total: 1000, status: 'pending' }),
            TestDataFactory.createInvoice({ grand_total: 2000, status: 'paid' }),
            TestDataFactory.createInvoice({ grand_total: 1500, status: 'pending' }),
          ],
          isLoading: false,
        },
        clients: {
          clients: [
            TestDataFactory.createClient(),
            TestDataFactory.createClient(),
            TestDataFactory.createClient(),
          ],
          isLoading: false,
        },
      };

      const { getByText } = renderWithProviders(<DashboardScreen />, {
        store: statsStore,
      });

      await waitFor(() => {
        expect(getByText('3')).toBeTruthy(); // Total invoices
        expect(getByText('₹2,500')).toBeTruthy(); // Pending amount
        expect(getByText('3')).toBeTruthy(); // Active clients
      });
    });

    it('should handle zero values in statistics', async () => {
      const emptyStatsStore = {
        invoices: { invoices: [], isLoading: false },
        clients: { clients: [], isLoading: false },
      };

      const { getByText } = renderWithProviders(<DashboardScreen />, {
        store: emptyStatsStore,
      });

      await waitFor(() => {
        expect(getByText('0')).toBeTruthy(); // Should show zero values
      });
    });
  });

  describe('Pull to Refresh', () => {
    it('should refresh data when pulled down', async () => {
      const { getByTestId } = renderWithProviders(<DashboardScreen />);

      const scrollView = getByTestId('dashboard-scroll-view');

      // Simulate pull to refresh
      fireEvent(scrollView, 'onRefresh');

      await waitFor(() => {
        // Verify refresh was triggered (implementation dependent)
        expect(getByTestId('dashboard-content')).toBeTruthy();
      });
    });
  });

  describe('Recent Invoices Section', () => {
    it('should show "View All" button when there are invoices', async () => {
      const { getByTestId } = renderWithProviders(<DashboardScreen />);

      await waitFor(() => {
        const viewAllButton = getByTestId('view-all-invoices');
        expect(viewAllButton).toBeTruthy();
      });
    });

    it('should navigate to invoice list on "View All" press', async () => {
      const { getByTestId } = renderWithProviders(<DashboardScreen />);

      await waitFor(() => {
        const viewAllButton = getByTestId('view-all-invoices');
        fireEvent.press(viewAllButton);
      });

      expect(mockNavigation.navigate).toHaveBeenCalledWith('InvoiceList');
    });

    it('should navigate to invoice detail on invoice press', async () => {
      const { getByTestId } = renderWithProviders(<DashboardScreen />);

      await waitFor(() => {
        const invoiceItem = getByTestId('invoice-item-invoice-1');
        fireEvent.press(invoiceItem);
      });

      expect(mockNavigation.navigate).toHaveBeenCalledWith('InvoiceDetail', {
        invoiceId: 'invoice-1',
      });
    });
  });

  describe('Performance Overview', () => {
    it('should display performance metrics', async () => {
      const { getByText } = renderWithProviders(<DashboardScreen />);

      await waitFor(() => {
        expect(getByText('This Month')).toBeTruthy();
        expect(getByText('Revenue')).toBeTruthy();
        expect(getByText('Growth')).toBeTruthy();
      });
    });

    it('should handle performance data loading error', async () => {
      const errorStore = {
        ui: {
          errors: {
            dashboard: 'Failed to load performance data',
          },
        },
      };

      const { getByText } = renderWithProviders(<DashboardScreen />, {
        store: errorStore,
      });

      await waitFor(() => {
        expect(getByText('Unable to load performance data')).toBeTruthy();
      });
    });
  });

  describe('Accessibility', () => {
    it('should have proper accessibility labels', async () => {
      const { getByA11yLabel } = renderWithProviders(<DashboardScreen />);

      await waitFor(() => {
        expect(getByA11yLabel('Dashboard overview')).toBeTruthy();
        expect(getByA11yLabel('Create new invoice')).toBeTruthy();
        expect(getByA11yLabel('Add new client')).toBeTruthy();
      });
    });

    it('should support screen reader navigation', async () => {
      const { getByA11yRole } = renderWithProviders(<DashboardScreen />);

      await waitFor(() => {
        expect(getByA11yRole('button')).toBeTruthy(); // Quick action buttons
        expect(getByA11yRole('text')).toBeTruthy(); // Statistics text
      });
    });
  });

  describe('Error Handling', () => {
    it('should display error message when data loading fails', async () => {
      const errorStore = {
        invoices: {
          isLoading: false,
          error: 'Failed to load invoices',
          invoices: [],
        },
      };

      const { getByText } = renderWithProviders(<DashboardScreen />, {
        store: errorStore,
      });

      await waitFor(() => {
        expect(getByText('Failed to load invoices')).toBeTruthy();
      });
    });

    it('should show retry option on error', async () => {
      const errorStore = {
        invoices: {
          isLoading: false,
          error: 'Network error',
          invoices: [],
        },
      };

      const { getByTestId } = renderWithProviders(<DashboardScreen />, {
        store: errorStore,
      });

      await waitFor(() => {
        const retryButton = getByTestId('retry-button');
        expect(retryButton).toBeTruthy();
      });
    });
  });

  describe('Network Status', () => {
    it('should show offline indicator when offline', async () => {
      const offlineStore = {
        ui: {
          isOnline: false,
        },
      };

      const { getByTestId } = renderWithProviders(<DashboardScreen />, {
        store: offlineStore,
      });

      await waitFor(() => {
        expect(getByTestId('offline-indicator')).toBeTruthy();
      });
    });

    it('should hide offline indicator when online', async () => {
      const onlineStore = {
        ui: {
          isOnline: true,
        },
      };

      const { queryByTestId } = renderWithProviders(<DashboardScreen />, {
        store: onlineStore,
      });

      await waitFor(() => {
        expect(queryByTestId('offline-indicator')).toBeNull();
      });
    });
  });

  describe('Snapshot Testing', () => {
    it('should match snapshot with data', async () => {
      const { toJSON } = renderWithProviders(<DashboardScreen />);

      await waitFor(() => {
        expect(toJSON()).toMatchSnapshot('DashboardScreen-with-data');
      });
    });

    it('should match snapshot in loading state', () => {
      const loadingStore = {
        invoices: { isLoading: true, invoices: [] },
        clients: { isLoading: true, clients: [] },
      };

      const { toJSON } = renderWithProviders(<DashboardScreen />, {
        store: loadingStore,
      });

      expect(toJSON()).toMatchSnapshot('DashboardScreen-loading');
    });

    it('should match snapshot in error state', async () => {
      const errorStore = {
        invoices: {
          isLoading: false,
          error: 'Test error',
          invoices: [],
        },
      };

      const { toJSON } = renderWithProviders(<DashboardScreen />, {
        store: errorStore,
      });

      await waitFor(() => {
        expect(toJSON()).toMatchSnapshot('DashboardScreen-error');
      });
    });
  });
});