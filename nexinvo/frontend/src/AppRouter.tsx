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
import SystemSettings from './components/admin/SystemSettings';

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
    const baseNavigation = [
      { name: 'Dashboard', href: '/dashboard', icon: '📊' },
      { name: 'Invoices', href: '/invoices', icon: '📄' },
      { name: 'Clients', href: '/clients', icon: '👥' },
      { name: 'e-Invoice', href: '/einvoice', icon: '🧾' },
      { name: 'Reports', href: '/reports', icon: '📈' },
      { name: 'Integrations', href: '/integrations', icon: '🔗' },
    ];

    // Add admin-only navigation items
    if (user?.is_superuser) {
      baseNavigation.push(
        { name: 'Tenant Management', href: '/admin/tenants', icon: '🏢' },
        { name: 'User Management', href: '/admin/users', icon: '👤' },
        { name: 'System Settings', href: '/admin/settings', icon: '⚙️' }
      );
    }

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

  const getRoleDisplayName = (role?: string) => {
    switch (role) {
      case 'ca_owner': return 'CA Owner';
      case 'admin': return 'Administrator';
      case 'finance_user': return 'Finance User';
      case 'viewer': return 'Viewer';
      case 'client_readonly': return 'Client (Read-Only)';
      default: return user?.is_ca_user ? 'CA User' : 'Regular User';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      <div className="flex">

        {/* Left Sidebar */}
        <div className="w-80 min-h-screen bg-gradient-to-b from-blue-900 to-indigo-900 text-white shadow-2xl">

          {/* Logo & Brand */}
          <div className="flex items-center space-x-3 p-6 pb-4 border-b border-blue-700">
            <div className="w-10 h-10 bg-white/20 backdrop-blur rounded-lg flex items-center justify-center">
              <span className="text-xl">📄</span>
            </div>
            <div>
              <h1 className="text-xl font-bold">NexInvo</h1>
              <p className="text-blue-200 text-sm">GST Invoice Platform</p>
            </div>
          </div>

          {/* User Profile */}
          <div className="p-6 pb-4">
            <div className="bg-white/10 backdrop-blur rounded-xl p-4">
              <div className="flex items-center space-x-3 mb-3">
                <div className="w-10 h-10 bg-gradient-to-r from-blue-400 to-purple-500 rounded-full flex items-center justify-center text-white font-bold">
                  {user?.first_name?.[0]}{user?.last_name?.[0]}
                </div>
                <div>
                  <p className="font-semibold text-white text-sm">{user?.first_name} {user?.last_name}</p>
                  <p className="text-blue-200 text-xs">{user?.email}</p>
                </div>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-blue-200">Role:</span>
                <span className="px-2 py-1 bg-blue-500/30 rounded-full font-medium">
                  {getRoleDisplayName(user?.role)}
                </span>
              </div>
            </div>
          </div>

          {/* Navigation Menu */}
          <nav className="px-6 pb-6">
            <div className="space-y-2">
              {navigation.map((item) => (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`flex items-center space-x-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                    location.pathname === item.href
                      ? 'bg-blue-600 text-white shadow-lg'
                      : 'text-blue-200 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <span className="text-lg">{item.icon}</span>
                  <span>{item.name}</span>
                </Link>
              ))}
            </div>
          </nav>

          {/* Bottom Section */}
          <div className="absolute bottom-0 left-0 right-0 w-80 p-6 border-t border-blue-700">
            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
            >
              <span>🔓</span>
              <span>Logout</span>
            </button>
          </div>
        </div>

        {/* Main Content */}
        <main className="flex-1">
          {children}
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
              <SystemSettings />
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