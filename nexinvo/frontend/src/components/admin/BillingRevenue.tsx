import React, { useState } from 'react';

const BillingRevenue: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'overview' | 'transactions' | 'invoices' | 'reports'>('overview');
  const [timeRange, setTimeRange] = useState('30d');

  // Mock data
  const revenueMetrics = [
    { label: 'Total Revenue', value: '₹12,45,890', change: '+18.5%', trend: 'up', icon: '💰' },
    { label: 'Monthly Recurring Revenue', value: '₹8,67,500', change: '+12.3%', trend: 'up', icon: '🔄' },
    { label: 'Active Subscriptions', value: '156', change: '+8.7%', trend: 'up', icon: '📋' },
    { label: 'Churn Rate', value: '2.1%', change: '-0.5%', trend: 'up', icon: '📉' }
  ];

  const recentTransactions = [
    { id: 'TXN-001', tenant: 'ABC CA Associates', amount: '₹25,000', plan: 'Enterprise', status: 'completed', date: '2024-03-15' },
    { id: 'TXN-002', tenant: 'XYZ Chartered', amount: '₹15,000', plan: 'Professional', status: 'completed', date: '2024-03-14' },
    { id: 'TXN-003', tenant: 'PQR Financial', amount: '₹8,500', plan: 'Standard', status: 'pending', date: '2024-03-14' },
    { id: 'TXN-004', tenant: 'MNO Tax Consultants', amount: '₹12,000', plan: 'Professional', status: 'completed', date: '2024-03-13' },
    { id: 'TXN-005', tenant: 'DEF Business Solutions', amount: '₹5,000', plan: 'Starter', status: 'failed', date: '2024-03-13' }
  ];

  const planRevenue = [
    { plan: 'Enterprise', subscribers: 23, revenue: '₹5,75,000', percentage: 46 },
    { plan: 'Professional', subscribers: 67, revenue: '₹4,02,000', percentage: 32 },
    { plan: 'Standard', subscribers: 45, revenue: '₹1,80,000', percentage: 15 },
    { plan: 'Starter', subscribers: 21, revenue: '₹88,890', percentage: 7 }
  ];

  const getStatusBadge = (status: string) => {
    const styles = {
      completed: 'bg-green-100 text-green-800',
      pending: 'bg-yellow-100 text-yellow-800',
      failed: 'bg-red-100 text-red-800'
    };
    return styles[status as keyof typeof styles] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Billing & Revenue</h1>
            <p className="text-gray-600 mt-2">Manage subscriptions, payments and revenue tracking</p>
          </div>
          <div className="flex items-center space-x-4">
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
              <option value="90d">Last 90 Days</option>
              <option value="1y">Last Year</option>
            </select>
            <button className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700">
              Generate Invoice
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-8">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            {[
              { key: 'overview', label: 'Overview' },
              { key: 'transactions', label: 'Transactions' },
              { key: 'invoices', label: 'Invoices' },
              { key: 'reports', label: 'Reports' }
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.key
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="space-y-8">
          {/* Revenue Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {revenueMetrics.map((metric, index) => (
              <div key={index} className="bg-white rounded-xl shadow-lg border border-gray-100 p-6 hover:shadow-xl transition-shadow">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">{metric.label}</p>
                    <p className="text-2xl font-bold text-gray-900 mt-1">{metric.value}</p>
                    <div className="flex items-center mt-2">
                      <span className={`text-sm font-medium ${
                        metric.trend === 'up' ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {metric.trend === 'up' ? '↗' : '↘'} {metric.change}
                      </span>
                    </div>
                  </div>
                  <div className="text-3xl opacity-70">{metric.icon}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Plan Revenue Breakdown */}
          <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
            <h3 className="text-xl font-semibold text-gray-900 mb-6">Revenue by Plan</h3>
            <div className="space-y-4">
              {planRevenue.map((plan, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-semibold text-gray-900">{plan.plan}</span>
                      <span className="text-sm text-gray-600">{plan.subscribers} subscribers</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${plan.percentage}%` }}
                      ></div>
                    </div>
                  </div>
                  <div className="ml-6 text-right">
                    <p className="font-bold text-gray-900">{plan.revenue}</p>
                    <p className="text-sm text-gray-600">{plan.percentage}%</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Transactions Tab */}
      {activeTab === 'transactions' && (
        <div className="bg-white rounded-xl shadow-lg border border-gray-100">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-semibold text-gray-900">Recent Transactions</h3>
              <button className="text-indigo-600 hover:text-indigo-700 font-medium">View All</button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Transaction ID</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tenant</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Plan</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {recentTransactions.map((transaction) => (
                  <tr key={transaction.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{transaction.id}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{transaction.tenant}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">{transaction.amount}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{transaction.plan}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadge(transaction.status)}`}>
                        {transaction.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{transaction.date}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button className="text-indigo-600 hover:text-indigo-900 mr-3">View</button>
                      <button className="text-gray-600 hover:text-gray-900">Refund</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Invoices Tab */}
      {activeTab === 'invoices' && (
        <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-8 text-center">
          <div className="text-6xl mb-4">📄</div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">Invoice Management</h3>
          <p className="text-gray-600 mb-6">Manage and generate invoices for tenant subscriptions</p>
          <button className="bg-indigo-600 text-white px-6 py-3 rounded-lg hover:bg-indigo-700">
            Create Invoice
          </button>
        </div>
      )}

      {/* Reports Tab */}
      {activeTab === 'reports' && (
        <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-8 text-center">
          <div className="text-6xl mb-4">📊</div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">Financial Reports</h3>
          <p className="text-gray-600 mb-6">Generate detailed financial and revenue reports</p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-2xl mx-auto">
            <button className="bg-indigo-600 text-white px-4 py-3 rounded-lg hover:bg-indigo-700">
              Revenue Report
            </button>
            <button className="bg-green-600 text-white px-4 py-3 rounded-lg hover:bg-green-700">
              Subscription Report
            </button>
            <button className="bg-purple-600 text-white px-4 py-3 rounded-lg hover:bg-purple-700">
              Tax Report
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default BillingRevenue;