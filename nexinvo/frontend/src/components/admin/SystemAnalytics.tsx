import React, { useState } from 'react';

const SystemAnalytics: React.FC = () => {
  const [timeRange, setTimeRange] = useState('7d');

  // Mock data - replace with actual API calls
  const kpiData = [
    { label: 'Total Revenue', value: '₹45,67,890', change: '+18.5%', trend: 'up', icon: '💰' },
    { label: 'Active Tenants', value: '234', change: '+12.3%', trend: 'up', icon: '🏢' },
    { label: 'Total Users', value: '1,456', change: '+8.7%', trend: 'up', icon: '👥' },
    { label: 'System Uptime', value: '99.97%', change: '+0.02%', trend: 'up', icon: '⚡' }
  ];

  const usageStats = [
    { metric: 'API Calls', current: '2.4M', limit: '5M', percentage: 48 },
    { metric: 'Storage Used', current: '1.2TB', limit: '5TB', percentage: 24 },
    { metric: 'Bandwidth', current: '340GB', limit: '1TB', percentage: 34 },
    { metric: 'Database Size', current: '45GB', limit: '100GB', percentage: 45 }
  ];

  const topTenants = [
    { name: 'ABC CA Associates', revenue: '₹1,25,000', users: 45, plan: 'Enterprise' },
    { name: 'XYZ Chartered Accountants', revenue: '₹89,500', users: 23, plan: 'Professional' },
    { name: 'PQR Financial Services', revenue: '₹67,800', users: 18, plan: 'Professional' },
    { name: 'MNO Tax Consultants', revenue: '₹45,600', users: 12, plan: 'Standard' },
    { name: 'DEF Business Solutions', revenue: '₹34,200', users: 8, plan: 'Standard' }
  ];

  const recentActivity = [
    { action: 'New tenant onboarded - "RST Associates"', time: '2 minutes ago', type: 'tenant' },
    { action: 'Payment received ₹25,000 from ABC CA Associates', time: '15 minutes ago', type: 'payment' },
    { action: 'System backup completed successfully', time: '1 hour ago', type: 'system' },
    { action: 'Enterprise plan upgraded - XYZ Chartered', time: '2 hours ago', type: 'upgrade' },
    { action: 'Database optimization completed', time: '4 hours ago', type: 'system' }
  ];

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">System Analytics</h1>
            <p className="text-gray-600 mt-2">Platform performance and usage insights</p>
          </div>
          <div className="flex items-center space-x-4">
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="24h">Last 24 Hours</option>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
              <option value="90d">Last 90 Days</option>
            </select>
            <button className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700">
              Export Report
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {kpiData.map((kpi, index) => (
          <div key={index} className="bg-white rounded-xl shadow-lg border border-gray-100 p-6 hover:shadow-xl transition-shadow">
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

      {/* Usage Statistics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
          <h3 className="text-xl font-semibold text-gray-900 mb-6">System Usage</h3>
          <div className="space-y-4">
            {usageStats.map((stat, index) => (
              <div key={index}>
                <div className="flex justify-between text-sm font-medium text-gray-700 mb-2">
                  <span>{stat.metric}</span>
                  <span>{stat.current} / {stat.limit}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${stat.percentage}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top Tenants */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
          <h3 className="text-xl font-semibold text-gray-900 mb-6">Top Revenue Tenants</h3>
          <div className="space-y-4">
            {topTenants.map((tenant, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-semibold text-gray-900">{tenant.name}</p>
                  <p className="text-sm text-gray-600">{tenant.users} users • {tenant.plan}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-green-600">{tenant.revenue}</p>
                  <p className="text-xs text-gray-500">this month</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
        <h3 className="text-xl font-semibold text-gray-900 mb-6">Recent Platform Activity</h3>
        <div className="space-y-4">
          {recentActivity.map((activity, index) => (
            <div key={index} className="flex items-center space-x-4 p-4 rounded-lg hover:bg-gray-50 transition-colors">
              <div className={`w-3 h-3 rounded-full ${
                activity.type === 'tenant' ? 'bg-indigo-500' :
                activity.type === 'payment' ? 'bg-green-500' :
                activity.type === 'system' ? 'bg-gray-500' :
                activity.type === 'upgrade' ? 'bg-purple-500' :
                'bg-orange-500'
              }`}></div>
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
  );
};

export default SystemAnalytics;