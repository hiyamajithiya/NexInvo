import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
import LoginForm from './components/auth/LoginForm';
import Dashboard from './components/dashboard/Dashboard';
import InvoiceList from './components/invoices/InvoiceList';
import InvoiceForm from './components/invoices/InvoiceForm';
import ClientList from './components/clients/ClientList';
import Reports from './components/reports/Reports';
import IntegrationHub from './components/integrations/IntegrationHub';
import EInvoiceManagement from './components/einvoice/EInvoiceManagement';
import TenantManagement from './components/admin/TenantManagement';
import UserManagement from './components/admin/UserManagement';
import PlatformSettings from './components/admin/PlatformSettings';
import SubscriptionPlansSimple from './components/admin/SubscriptionPlansSimple';
import SystemAnalytics from './components/admin/SystemAnalytics';
import BillingRevenue from './components/admin/BillingRevenue';
import SupportTickets from './components/admin/SupportTickets';
import TestInput from './components/test/TestInput';

const PrivateRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return isAuthenticated ? <>{children}</> : <Navigate to="/login" />;
};

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, logout } = useAuth();
  const location = useLocation();

  const getNavigationItems = () => {
    // For superuser (platform owner), show SaaS management interface
    // Updated navigation for admin dashboard
    console.log('Current user object:', user);
    console.log('Is superuser?', user?.is_superuser);
    console.log('User email:', user?.email);

    // Check if user is superuser OR is the platform admin email
    if (user?.is_superuser || user?.email === 'admin@nexinvo.com') {
      return [
        { name: 'Platform Overview', href: '/dashboard', icon: '🏠' },
        { name: 'Tenant Management', href: '/admin/tenants', icon: '🏢' },
        { name: 'User Management', href: '/admin/users', icon: '👥' },
        { name: 'Subscription Plans', href: '/admin/plans', icon: '💳' },
        { name: 'System Analytics', href: '/admin/analytics', icon: '📊' },
        { name: 'Platform Settings', href: '/admin/settings', icon: '⚙️' },
        { name: 'Billing & Revenue', href: '/admin/billing', icon: '💰' },
        { name: 'Support Tickets', href: '/admin/support', icon: '🎫' },
      ];
    }

    // For regular tenant users
    const baseNavigation = [
      { name: 'Dashboard', href: '/dashboard', icon: '📊' },
      { name: 'Invoices', href: '/invoices', icon: '📄' },
      { name: 'Clients', href: '/clients', icon: '👥' },
      { name: 'e-Invoice', href: '/einvoice', icon: '🧾' },
      { name: 'Reports', href: '/reports', icon: '📈' },
      { name: 'Integrations', href: '/integrations', icon: '🔗' },
    ];

    return baseNavigation;
  };

  const navigation = getNavigationItems();

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const getRoleDisplayName = () => {
    if (user?.is_superuser || user?.email === 'admin@nexinvo.com') {
      return 'Platform Owner';
    }
    if (user?.is_ca_user) {
      return 'CA User';
    }
    return 'Regular User';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="flex">

        {/* Left Sidebar */}
        <div className="w-72 min-h-screen bg-gradient-to-b from-indigo-900 to-purple-900 text-white shadow-2xl">

          {/* Logo & Brand */}
          <div className="flex items-center space-x-3 p-6 pb-4 border-b border-purple-700">
            <div className="w-10 h-10 bg-white/20 backdrop-blur rounded-lg flex items-center justify-center">
              <span className="text-xl">{(user?.is_superuser || user?.email === 'admin@nexinvo.com') ? '👑' : '📄'}</span>
            </div>
            <div>
              <h1 className="text-xl font-bold">NexInvo</h1>
              <p className="text-purple-200 text-sm">
                {(user?.is_superuser || user?.email === 'admin@nexinvo.com') ? 'SaaS Platform Admin' : 'GST Invoice Platform'}
              </p>
            </div>
          </div>

          {/* Navigation Menu */}
          <nav className="px-6 py-6">
            <div className="space-y-2 mb-6">
              {navigation.map((item) => (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`flex items-center space-x-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                    location.pathname === item.href
                      ? 'bg-indigo-600 text-white shadow-lg'
                      : 'text-purple-200 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <span className="text-lg">{item.icon}</span>
                  <span>{item.name}</span>
                </Link>
              ))}
            </div>

            {/* Logout Button - Fixed position right after navigation */}
            <div className="border-t border-purple-700 pt-4">
              <button
                onClick={handleLogout}
                className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
              >
                <span>🔓</span>
                <span>Logout</span>
              </button>
            </div>
          </nav>
        </div>

        {/* Main Content */}
        <main className="flex-1 flex flex-col">
          {/* Top Header Bar */}
          <div className="bg-white shadow-sm border-b border-gray-200 px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-800">
                  Welcome back, {user?.first_name}!
                </h2>
                <p className="text-gray-600 text-sm">
                  {(user?.is_superuser || user?.email === 'admin@nexinvo.com') ? 'Platform Owner Dashboard' : 'Your Invoice Management Dashboard'}
                </p>
              </div>

              {/* User Profile in Top Right */}
              <div className="flex items-center space-x-4">
                <div className="text-right">
                  <p className="font-semibold text-gray-800 text-sm">{user?.first_name} {user?.last_name}</p>
                  <p className="text-gray-500 text-xs">{user?.email}</p>
                  <span className="inline-block mt-1 px-2 py-1 bg-indigo-100 text-indigo-800 text-xs rounded-full font-medium">
                    {getRoleDisplayName()}
                  </span>
                </div>
                <div className="w-12 h-12 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-lg">
                  {user?.first_name?.[0]}{user?.last_name?.[0]}
                </div>
              </div>
            </div>
          </div>

          {/* Main Content Area */}
          <div className="flex-1">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

const AppContent: React.FC = () => {
  const { isAuthenticated } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={!isAuthenticated ? <LoginForm /> : <Navigate to="/dashboard" />} />
      <Route
        path="/dashboard"
        element={
          <PrivateRoute>
            <Layout>
              <Dashboard />
            </Layout>
          </PrivateRoute>
        }
      />
      <Route
        path="/invoices"
        element={
          <PrivateRoute>
            <Layout>
              <InvoiceList />
            </Layout>
          </PrivateRoute>
        }
      />
      <Route
        path="/invoices/new"
        element={
          <PrivateRoute>
            <Layout>
              <InvoiceForm />
            </Layout>
          </PrivateRoute>
        }
      />
      <Route
        path="/clients"
        element={
          <PrivateRoute>
            <Layout>
              <ClientList />
            </Layout>
          </PrivateRoute>
        }
      />
      <Route
        path="/reports"
        element={
          <PrivateRoute>
            <Layout>
              <Reports />
            </Layout>
          </PrivateRoute>
        }
      />
      <Route
        path="/integrations"
        element={
          <PrivateRoute>
            <Layout>
              <IntegrationHub />
            </Layout>
          </PrivateRoute>
        }
      />
      <Route
        path="/einvoice"
        element={
          <PrivateRoute>
            <Layout>
              <EInvoiceManagement />
            </Layout>
          </PrivateRoute>
        }
      />
      <Route
        path="/admin/tenants"
        element={
          <PrivateRoute>
            <Layout>
              <TenantManagement />
            </Layout>
          </PrivateRoute>
        }
      />
      <Route
        path="/admin/users"
        element={
          <PrivateRoute>
            <Layout>
              <UserManagement />
            </Layout>
          </PrivateRoute>
        }
      />
      <Route
        path="/admin/settings"
        element={
          <PrivateRoute>
            <Layout>
              <PlatformSettings />
            </Layout>
          </PrivateRoute>
        }
      />
      <Route
        path="/admin/plans"
        element={
          <PrivateRoute>
            <Layout>
              <SubscriptionPlansSimple />
            </Layout>
          </PrivateRoute>
        }
      />
      <Route
        path="/admin/analytics"
        element={
          <PrivateRoute>
            <Layout>
              <SystemAnalytics />
            </Layout>
          </PrivateRoute>
        }
      />
      <Route
        path="/admin/billing"
        element={
          <PrivateRoute>
            <Layout>
              <BillingRevenue />
            </Layout>
          </PrivateRoute>
        }
      />
      <Route
        path="/admin/support"
        element={
          <PrivateRoute>
            <Layout>
              <SupportTickets />
            </Layout>
          </PrivateRoute>
        }
      />
      <Route
        path="/test"
        element={
          <PrivateRoute>
            <Layout>
              <TestInput />
            </Layout>
          </PrivateRoute>
        }
      />
      <Route path="/" element={<Navigate to="/dashboard" />} />
    </Routes>
  );
};

const AppRouter: React.FC = () => {
  return (
    <Router>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </Router>
  );
};

export default AppRouter;