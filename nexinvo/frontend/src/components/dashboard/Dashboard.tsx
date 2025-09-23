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

    // Super Admin Dashboard - Essential SaaS Management
    if (user?.is_superuser || user?.email === 'admin@nexinvo.com') {
      actions.push(
        {
          title: 'Tenant Management',
          description: 'Manage SaaS customers',
          icon: '🏢',
          onClick: () => navigate('/admin/tenants'),
          color: 'from-indigo-500 to-indigo-600'
        },
        {
          title: 'Platform Analytics',
          description: 'Revenue & usage insights',
          icon: '📊',
          onClick: () => navigate('/admin/analytics'),
          color: 'from-green-500 to-green-600'
        },
        {
          title: 'Billing & Revenue',
          description: 'Subscription management',
          icon: '💰',
          onClick: () => navigate('/admin/billing'),
          color: 'from-purple-500 to-purple-600'
        },
        {
          title: 'System Settings',
          description: 'Platform configuration',
          icon: '⚙️',
          onClick: () => navigate('/admin/settings'),
          color: 'from-gray-500 to-gray-600'
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
        color: 'from-indigo-500 to-indigo-600'
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
    if (user?.is_superuser || user?.email === 'admin@nexinvo.com') {
      // Super Admin KPIs - Essential SaaS Metrics
      return [
        { label: 'Active Tenants', value: '23', change: '+3 this month', trend: 'up', icon: '🏢' },
        { label: 'Monthly Revenue', value: '₹12,45,000', change: '+18.5%', trend: 'up', icon: '💰' },
        { label: 'Total Users', value: '156', change: '+24 this month', trend: 'up', icon: '👥' }
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
    if (user?.is_superuser || user?.email === 'admin@nexinvo.com') {
      // Super Admin Activities - Essential Platform Events
      return [
        { action: 'New tenant "ABC Chartered Accountants" onboarded', time: '2 hours ago', type: 'tenant' },
        { action: 'Monthly subscription payment received ₹25,000', time: '4 hours ago', type: 'payment' },
        { action: 'Enterprise plan upgraded - XYZ Associates', time: '1 day ago', type: 'subscription' },
        { action: 'Platform maintenance completed successfully', time: '2 days ago', type: 'system' }
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

      {/* KPI Cards */}
      <div className={`grid gap-6 mb-8 ${
        (user?.is_superuser || user?.email === 'admin@nexinvo.com')
          ? 'grid-cols-1 md:grid-cols-3'
          : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4'
      }`}>
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
                </div>
              </div>
              <div className="text-3xl opacity-70">{kpi.icon}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

        {/* Quick Actions */}
        <div className="bg-white/80 backdrop-blur rounded-2xl shadow-lg border border-white/50 p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">
            {(user?.is_superuser || user?.email === 'admin@nexinvo.com') ? 'Platform Management' : 'Quick Actions'}
          </h2>
          <div className="grid grid-cols-1 gap-4">
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
          <h2 className="text-2xl font-bold text-gray-900 mb-6">
            {(user?.is_superuser || user?.email === 'admin@nexinvo.com') ? 'Platform Activity' : 'Recent Activity'}
          </h2>
          <div className="space-y-4">
            {recentActivities.map((activity, index) => (
              <div key={index} className="flex items-center space-x-4 p-4 rounded-xl hover:bg-indigo-50/50 transition-colors">
                <div className={`w-3 h-3 rounded-full ${
                  activity.type === 'invoice' ? 'bg-indigo-500' :
                  activity.type === 'client' ? 'bg-green-500' :
                  activity.type === 'report' ? 'bg-purple-500' :
                  activity.type === 'tenant' ? 'bg-indigo-500' :
                  activity.type === 'user' ? 'bg-cyan-500' :
                  activity.type === 'system' ? 'bg-gray-500' :
                  activity.type === 'subscription' ? 'bg-yellow-500' :
                  activity.type === 'payment' ? 'bg-green-600' :
                  'bg-orange-500'
                } shadow-lg`}></div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-gray-900">{activity.action}</p>
                  <p className="text-xs text-gray-500">{activity.time}</p>
                </div>
              </div>
            ))}
          </div>
          <button className="w-full mt-6 py-3 text-sm text-indigo-600 hover:text-indigo-700 font-semibold bg-indigo-50 hover:bg-indigo-100 rounded-xl transition-colors">
            View all activities →
          </button>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;