import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

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

  const getQuickActions = () => {
    const role = user?.role;
    const actions = [];

    // Super Admin Dashboard - SaaS Management
    if (user?.is_superuser) {
      actions.push(
        {
          title: 'Manage Tenants',
          description: 'Add and manage SaaS tenants',
          icon: '🏢',
          onClick: () => navigate('/admin/tenants'),
          color: 'from-blue-500 to-blue-600'
        },
        {
          title: 'Manage Users',
          description: 'Manage users across all tenants',
          icon: '👤',
          onClick: () => navigate('/admin/users'),
          color: 'from-emerald-500 to-emerald-600'
        },
        {
          title: 'System Settings',
          description: 'Configure platform settings',
          icon: '⚙️',
          onClick: () => navigate('/admin/settings'),
          color: 'from-purple-500 to-purple-600'
        },
        {
          title: 'Platform Analytics',
          description: 'View platform performance',
          icon: '📊',
          onClick: () => navigate('/reports'),
          color: 'from-orange-500 to-orange-600'
        }
      );
      return actions;
    }

    // Regular User Dashboard - Invoice Management
    if (role === 'ca_owner' || role === 'admin' || role === 'finance_user') {
      actions.push({
        title: 'Create Invoice',
        description: 'Generate GST-compliant invoices',
        icon: '📄',
        onClick: () => navigate('/invoices/new'),
        color: 'from-blue-500 to-blue-600'
      });
    }

    if (role === 'ca_owner' || role === 'admin') {
      actions.push({
        title: 'Manage Clients',
        description: 'Add and manage your clients',
        icon: '👥',
        onClick: () => navigate('/clients'),
        color: 'from-emerald-500 to-emerald-600'
      });
    }

    actions.push({
      title: 'View Reports',
      description: 'Generate GSTR reports & analytics',
      icon: '📊',
      onClick: () => navigate('/reports'),
      color: 'from-purple-500 to-purple-600'
    });

    if (role === 'ca_owner') {
      actions.push({
        title: 'User Management',
        description: 'Manage team & permissions',
        icon: '⚙️',
        onClick: () => navigate('/settings/users'),
        color: 'from-orange-500 to-orange-600'
      });
    }

    return actions;
  };

  const getKpiData = () => {
    if (user?.is_superuser) {
      // Super Admin KPIs - SaaS Platform Metrics
      return [
        { label: 'Total Tenants', value: '25', change: '+8%', trend: 'up', icon: '🏢' },
        { label: 'Platform Revenue', value: '₹15,45,000', change: '+15.2%', trend: 'up', icon: '💰' },
        { label: 'Active Users', value: '142', change: '+12%', trend: 'up', icon: '👥' },
        { label: 'System Uptime', value: '99.9%', change: '+0.1%', trend: 'up', icon: '⚡' }
      ];
    }

    // Regular User KPIs - Invoice Management
    return [
      { label: 'Total Invoices', value: '1,247', change: '+12%', trend: 'up', icon: '📄' },
      { label: 'Monthly Revenue', value: '₹8,45,000', change: '+8.2%', trend: 'up', icon: '💰' },
      { label: 'Active Clients', value: '156', change: '+5%', trend: 'up', icon: '👥' },
      { label: 'GST Compliance', value: '98.5%', change: '+2.1%', trend: 'up', icon: '✅' }
    ];
  };

  const getRecentActivities = () => {
    if (user?.is_superuser) {
      // Super Admin Activities - Platform Management
      return [
        { action: 'New tenant "XYZ Corp" added', time: '5 minutes ago', type: 'tenant' },
        { action: 'User john.doe@company.com created', time: '20 minutes ago', type: 'user' },
        { action: 'System backup completed successfully', time: '1 hour ago', type: 'system' },
        { action: 'Enterprise plan upgraded for ABC Firm', time: '2 hours ago', type: 'subscription' }
      ];
    }

    // Regular User Activities - Invoice Management
    return [
      { action: 'Invoice #INV-2024-001247 created', time: '2 minutes ago', type: 'invoice' },
      { action: 'New client "ABC Corp" added', time: '15 minutes ago', type: 'client' },
      { action: 'GSTR-1 report generated for March', time: '1 hour ago', type: 'report' },
      { action: 'Payment received for INV-2024-001245', time: '2 hours ago', type: 'payment' }
    ];
  };

  const kpiData = getKpiData();
  const recentActivities = getRecentActivities();

  return (
    <div className="p-8">

      {/* Header */}
      <div className="mb-8">
        <div className="bg-white/70 backdrop-blur rounded-2xl p-6 shadow-lg border border-white/50">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Welcome back, {user?.first_name}
              </h1>
              <p className="text-gray-600 mt-1">
                {getRoleDisplayName(user?.role)} • {new Date().toLocaleDateString('en-IN', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </p>
            </div>
            <div className="mt-4 sm:mt-0">
              <div className="px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg shadow-lg">
                <span className="text-sm font-medium">Dashboard Overview</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {kpiData.map((kpi, index) => (
          <div key={index} className="bg-white/80 backdrop-blur rounded-2xl shadow-lg border border-white/50 p-6 hover:bg-white/90 transition-all duration-300 hover:scale-105">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">{kpi.label}</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{kpi.value}</p>
                <div className="flex items-center mt-2">
                  <span className={`text-sm font-medium ${
                    kpi.trend === 'up' ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {kpi.trend === 'up' ? '↗' : '↘'} {kpi.change}
                  </span>
                  <span className="text-xs text-gray-500 ml-1">vs last month</span>
                </div>
              </div>
              <div className="text-3xl opacity-70">{kpi.icon}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* Quick Actions - Takes 2 columns */}
        <div className="lg:col-span-2">
          <div className="bg-white/80 backdrop-blur rounded-2xl shadow-lg border border-white/50 p-6 mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Quick Actions</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {getQuickActions().map((action, index) => (
                <div
                  key={index}
                  className={`group relative overflow-hidden rounded-xl bg-gradient-to-r ${action.color} p-6 text-white cursor-pointer transform transition-all duration-300 hover:scale-105 hover:shadow-xl`}
                  onClick={action.onClick}
                >
                  <div className="flex items-center">
                    <div className="text-3xl mr-4 filter drop-shadow-lg">{action.icon}</div>
                    <div className="flex-1">
                      <h3 className="text-lg font-bold">{action.title}</h3>
                      <p className="text-sm opacity-90 mt-1">{action.description}</p>
                    </div>
                    <div className="text-2xl opacity-70 group-hover:opacity-100 transition-opacity group-hover:translate-x-1 transform duration-200">
                      →
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Activity */}
          <div className="bg-white/80 backdrop-blur rounded-2xl shadow-lg border border-white/50 p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Recent Activity</h2>
            <div className="space-y-4">
              {recentActivities.map((activity, index) => (
                <div key={index} className="flex items-center space-x-4 p-4 rounded-xl hover:bg-blue-50/50 transition-colors">
                  <div className={`w-3 h-3 rounded-full ${
                    activity.type === 'invoice' ? 'bg-blue-500' :
                    activity.type === 'client' ? 'bg-green-500' :
                    activity.type === 'report' ? 'bg-purple-500' :
                    activity.type === 'tenant' ? 'bg-indigo-500' :
                    activity.type === 'user' ? 'bg-cyan-500' :
                    activity.type === 'system' ? 'bg-gray-500' :
                    activity.type === 'subscription' ? 'bg-yellow-500' :
                    'bg-orange-500'
                  } shadow-lg`}></div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-900">{activity.action}</p>
                    <p className="text-xs text-gray-500">{activity.time}</p>
                  </div>
                </div>
              ))}
            </div>
            <button className="w-full mt-6 py-3 text-sm text-blue-600 hover:text-blue-700 font-semibold bg-blue-50 hover:bg-blue-100 rounded-xl transition-colors">
              View all activities →
            </button>
          </div>
        </div>

        {/* Right Sidebar Info */}
        <div className="space-y-6">

          {/* Quick Stats */}
          <div className="bg-white/80 backdrop-blur rounded-2xl shadow-lg border border-white/50 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Stats</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">This Month</span>
                <span className="font-medium text-gray-900">47 Invoices</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Pending Payments</span>
                <span className="font-medium text-orange-600">₹2,45,000</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Overdue</span>
                <span className="font-medium text-red-600">₹45,000</span>
              </div>
              <div className="border-t pt-3">
                <button className="w-full text-sm text-blue-600 hover:text-blue-700 font-medium">
                  View detailed analytics →
                </button>
              </div>
            </div>
          </div>

          {/* GST Compliance Status */}
          <div className="bg-gradient-to-r from-green-50/80 to-emerald-50/80 backdrop-blur rounded-2xl border border-green-200/50 p-6 shadow-lg">
            <div className="flex items-center space-x-3 mb-3">
              <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center shadow-lg">
                <span className="text-white text-sm">✓</span>
              </div>
              <h3 className="text-lg font-semibold text-green-800">GST Compliant</h3>
            </div>
            <p className="text-sm text-green-700 mb-3">
              All your invoices are GST compliant and ready for filing.
            </p>
            <div className="text-xs text-green-600">
              Last updated: {new Date().toLocaleDateString()}
            </div>
          </div>

          {/* Performance Chart Placeholder */}
          <div className="bg-white/80 backdrop-blur rounded-2xl shadow-lg border border-white/50 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Monthly Performance</h3>
            <div className="h-32 bg-gradient-to-r from-blue-100 to-purple-100 rounded-lg flex items-center justify-center">
              <span className="text-gray-600 text-sm">Chart Coming Soon</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;