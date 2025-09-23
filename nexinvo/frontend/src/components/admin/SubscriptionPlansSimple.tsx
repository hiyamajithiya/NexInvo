import React, { useState } from 'react';

interface PlanForm {
  name: string;
  description: string;
  price: number;
  currency: string;
  billingCycle: string;
  maxUsers: number;
  maxInvoices: number;
  storageLimit: number;
}

const SubscriptionPlansSimple: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'plans' | 'create'>('plans');
  const [formData, setFormData] = useState<PlanForm>({
    name: '',
    description: '',
    price: 999,
    currency: 'INR',
    billingCycle: 'monthly',
    maxUsers: 1,
    maxInvoices: 50,
    storageLimit: 1
  });

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Subscription Plans</h1>
        <p className="text-gray-600 mt-2">Manage subscription plans for your platform</p>
      </div>

      {/* Tabs */}
      <div className="mb-6">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('plans')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'plans'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              All Plans
            </button>
            <button
              onClick={() => setActiveTab('create')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'create'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Create Plan
            </button>
          </nav>
        </div>
      </div>

      {/* Plans Tab */}
      {activeTab === 'plans' && (
        <div>
          <p className="text-gray-600">Plans list will be here...</p>
        </div>
      )}

      {/* Create Plan Tab */}
      {activeTab === 'create' && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-6">Create New Plan</h2>

          <div className="space-y-6">
            {/* Plan Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Plan Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter plan name"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter plan description"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Price */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Price</label>
                <input
                  type="number"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  min="0"
                />
              </div>

              {/* Currency */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Currency</label>
                <select
                  value={formData.currency}
                  onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="INR">INR - Indian Rupee</option>
                  <option value="USD">USD - US Dollar</option>
                  <option value="EUR">EUR - Euro</option>
                </select>
              </div>

              {/* Billing Cycle */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Billing Cycle</label>
                <select
                  value={formData.billingCycle}
                  onChange={(e) => setFormData({ ...formData, billingCycle: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="monthly">Monthly</option>
                  <option value="yearly">Yearly</option>
                </select>
              </div>

              {/* Max Users */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Max Users</label>
                <input
                  type="number"
                  value={formData.maxUsers}
                  onChange={(e) => setFormData({ ...formData, maxUsers: parseInt(e.target.value) || 1 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  min="1"
                />
              </div>

              {/* Max Invoices */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Max Invoices</label>
                <input
                  type="number"
                  value={formData.maxInvoices}
                  onChange={(e) => setFormData({ ...formData, maxInvoices: parseInt(e.target.value) || 1 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  min="1"
                />
              </div>

              {/* Storage Limit */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Storage Limit (GB)</label>
                <input
                  type="number"
                  value={formData.storageLimit}
                  onChange={(e) => setFormData({ ...formData, storageLimit: parseInt(e.target.value) || 1 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  min="1"
                />
              </div>
            </div>

            {/* Save Button */}
            <div className="flex justify-end pt-6">
              <button
                type="button"
                className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 focus:ring-2 focus:ring-blue-500"
              >
                Create Plan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SubscriptionPlansSimple;