import React, { useState, useCallback, useMemo } from 'react';
import { useAuth } from '../../hooks/useAuth';

interface Feature {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
}

interface Plan {
  id: string;
  name: string;
  description: string;
  price: number;
  billingCycle: 'monthly' | 'yearly';
  currency: string;
  features: Feature[];
  maxUsers: number;
  maxInvoices: number;
  storageLimit: number; // in GB
  isActive: boolean;
  visibility: 'all' | 'specific';
  targetTenants: string[];
  createdAt: string;
  updatedAt: string;
}

const SubscriptionPlans: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'plans' | 'create' | 'targeting'>('plans');
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Sample data - would come from API
  const [plans, setPlans] = useState<Plan[]>([
    {
      id: '1',
      name: 'Starter',
      description: 'Perfect for small CA firms and freelancers',
      price: 999,
      billingCycle: 'monthly',
      currency: 'INR',
      features: [
        { id: '1', name: 'Basic Invoicing', description: 'Create and send GST invoices', enabled: true },
        { id: '2', name: 'Client Management', description: 'Manage up to 50 clients', enabled: true },
        { id: '3', name: 'Basic Reports', description: 'GSTR-1 and basic analytics', enabled: true },
        { id: '4', name: 'Email Support', description: '24/7 email support', enabled: true },
        { id: '5', name: 'Advanced Analytics', description: 'Detailed business insights', enabled: false },
        { id: '6', name: 'API Access', description: 'Third-party integrations', enabled: false }
      ],
      maxUsers: 2,
      maxInvoices: 100,
      storageLimit: 1,
      isActive: true,
      visibility: 'all',
      targetTenants: [],
      createdAt: '2024-01-15',
      updatedAt: '2024-02-20'
    },
    {
      id: '2',
      name: 'Professional',
      description: 'Ideal for growing CA practices',
      price: 2999,
      billingCycle: 'monthly',
      currency: 'INR',
      features: [
        { id: '1', name: 'Basic Invoicing', description: 'Create and send GST invoices', enabled: true },
        { id: '2', name: 'Client Management', description: 'Manage unlimited clients', enabled: true },
        { id: '3', name: 'Basic Reports', description: 'GSTR-1 and basic analytics', enabled: true },
        { id: '4', name: 'Email Support', description: '24/7 email support', enabled: true },
        { id: '5', name: 'Advanced Analytics', description: 'Detailed business insights', enabled: true },
        { id: '6', name: 'API Access', description: 'Third-party integrations', enabled: true }
      ],
      maxUsers: 10,
      maxInvoices: 1000,
      storageLimit: 10,
      isActive: true,
      visibility: 'specific',
      targetTenants: ['tenant-1', 'tenant-2'],
      createdAt: '2024-01-15',
      updatedAt: '2024-02-20'
    }
  ]);

  // Form state for new plan - separate state object to prevent re-renders
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: 999,
    billingCycle: 'monthly' as 'monthly' | 'yearly',
    currency: 'INR',
    maxUsers: 1,
    maxInvoices: 50,
    storageLimit: 1,
    features: [
      { id: '1', name: 'Basic Invoicing', description: 'Create and send GST invoices', enabled: true },
      { id: '2', name: 'Client Management', description: 'Manage clients', enabled: true },
      { id: '3', name: 'Basic Reports', description: 'GSTR-1 and basic analytics', enabled: true },
      { id: '4', name: 'Email Support', description: '24/7 email support', enabled: true },
      { id: '5', name: 'Advanced Analytics', description: 'Detailed business insights', enabled: false },
      { id: '6', name: 'API Access', description: 'Third-party integrations', enabled: false },
      { id: '7', name: 'White Label', description: 'Custom branding', enabled: false },
      { id: '8', name: 'Multi-location', description: 'Multiple office support', enabled: false }
    ]
  });

  // Simple inline handlers work best - no useCallback needed

  const handleFeatureToggle = useCallback((featureId: string) => {
    return () => {
      setFormData(prev => ({
        ...prev,
        features: prev.features.map(feature =>
          feature.id === featureId
            ? { ...feature, enabled: !feature.enabled }
            : feature
        )
      }));
    };
  }, []);

  const resetForm = useCallback(() => {
    setFormData({
      name: '',
      description: '',
      price: 999,
      billingCycle: 'monthly',
      currency: 'INR',
      maxUsers: 1,
      maxInvoices: 50,
      storageLimit: 1,
      features: [
        { id: '1', name: 'Basic Invoicing', description: 'Create and send GST invoices', enabled: true },
        { id: '2', name: 'Client Management', description: 'Manage clients', enabled: true },
        { id: '3', name: 'Basic Reports', description: 'GSTR-1 and basic analytics', enabled: true },
        { id: '4', name: 'Email Support', description: '24/7 email support', enabled: true },
        { id: '5', name: 'Advanced Analytics', description: 'Detailed business insights', enabled: false },
        { id: '6', name: 'API Access', description: 'Third-party integrations', enabled: false },
        { id: '7', name: 'White Label', description: 'Custom branding', enabled: false },
        { id: '8', name: 'Multi-location', description: 'Multiple office support', enabled: false }
      ]
    });
  }, []);

  const handleCreatePlan = useCallback(() => {
    const newPlan: Plan = {
      id: Date.now().toString(),
      name: formData.name,
      description: formData.description,
      price: formData.price,
      billingCycle: formData.billingCycle,
      currency: formData.currency,
      features: formData.features,
      maxUsers: formData.maxUsers,
      maxInvoices: formData.maxInvoices,
      storageLimit: formData.storageLimit,
      isActive: false,
      visibility: 'all',
      targetTenants: [],
      createdAt: new Date().toISOString().split('T')[0],
      updatedAt: new Date().toISOString().split('T')[0]
    };

    setPlans(prev => [...prev, newPlan]);
    resetForm();
    setActiveTab('plans');
  }, [formData, resetForm]);

  const togglePlanStatus = useCallback((planId: string) => {
    setPlans(prev => prev.map(plan =>
      plan.id === planId
        ? { ...plan, isActive: !plan.isActive, updatedAt: new Date().toISOString().split('T')[0] }
        : plan
    ));
  }, []);

  const deletePlan = useCallback((planId: string) => {
    setPlans(prev => prev.filter(plan => plan.id !== planId));
  }, []);

  const getCurrencySymbol = useCallback((currency: string) => {
    switch (currency) {
      case 'INR': return '₹';
      case 'USD': return '$';
      case 'EUR': return '€';
      default: return '₹';
    }
  }, []);

  // No more individual handlers needed - using single stable handler with name attribute

  const PlansTab = () => (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Subscription Plans</h2>
          <p className="text-gray-600">Manage and configure subscription plans for your tenants</p>
        </div>
        <button
          onClick={() => setActiveTab('create')}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors flex items-center space-x-2"
        >
          <span>➕</span>
          <span>Create New Plan</span>
        </button>
      </div>

      {/* Plans Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {plans.map((plan) => (
          <div key={plan.id} className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6 hover:shadow-xl transition-all duration-300">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-xl font-bold text-gray-900">{plan.name}</h3>
                <p className="text-gray-600 text-sm mt-1">{plan.description}</p>
              </div>
              <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                plan.isActive
                  ? 'bg-green-100 text-green-800'
                  : 'bg-gray-100 text-gray-800'
              }`}>
                {plan.isActive ? 'Active' : 'Inactive'}
              </div>
            </div>

            <div className="mb-4">
              <div className="flex items-baseline">
                <span className="text-3xl font-bold text-gray-900">{getCurrencySymbol(plan.currency)}{plan.price}</span>
                <span className="text-gray-600 ml-2">/{plan.billingCycle}</span>
              </div>
            </div>

            <div className="space-y-3 mb-6">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Max Users:</span>
                <span className="font-medium">{plan.maxUsers}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Max Invoices:</span>
                <span className="font-medium">{plan.maxInvoices}/month</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Storage:</span>
                <span className="font-medium">{plan.storageLimit} GB</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Visibility:</span>
                <span className={`font-medium ${plan.visibility === 'all' ? 'text-green-600' : 'text-blue-600'}`}>
                  {plan.visibility === 'all' ? 'All Tenants' : 'Specific Tenants'}
                </span>
              </div>
            </div>

            <div className="border-t pt-4">
              <div className="flex space-x-2">
                <button
                  onClick={() => {
                    setSelectedPlan(plan);
                    setIsModalOpen(true);
                  }}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-800 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  View Details
                </button>
                <button
                  onClick={() => togglePlanStatus(plan.id)}
                  className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    plan.isActive
                      ? 'bg-red-100 hover:bg-red-200 text-red-800'
                      : 'bg-green-100 hover:bg-green-200 text-green-800'
                  }`}
                >
                  {plan.isActive ? 'Deactivate' : 'Activate'}
                </button>
                <button
                  onClick={() => deletePlan(plan.id)}
                  className="bg-red-100 hover:bg-red-200 text-red-800 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  🗑️
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const CreatePlanTab = () => (
    <div className="max-w-6xl mx-auto">
      {/* Header Section */}
      <div className="mb-8">
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl p-8 text-white">
          <div className="flex items-center space-x-4 mb-4">
            <div className="w-16 h-16 bg-white/20 backdrop-blur rounded-2xl flex items-center justify-center">
              <span className="text-3xl">🏷️</span>
            </div>
            <div>
              <h1 className="text-3xl font-bold">Create New Subscription Plan</h1>
              <p className="text-blue-100 mt-2">Design a custom subscription plan with flexible features and pricing for your tenants</p>
            </div>
          </div>
          <div className="flex space-x-4 text-sm">
            <div className="bg-white/10 backdrop-blur rounded-lg px-4 py-2">
              <span className="text-blue-100">Step 1:</span> <span className="font-medium">Plan Details</span>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-lg px-4 py-2">
              <span className="text-blue-100">Step 2:</span> <span className="font-medium">Features & Limits</span>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-lg px-4 py-2">
              <span className="text-blue-100">Step 3:</span> <span className="font-medium">Pricing & Billing</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column - Plan Details */}
        <div className="lg:col-span-2 space-y-8">
          {/* Basic Information */}
          <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-8">
            <div className="flex items-center space-x-3 mb-6">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <span className="text-blue-600 text-lg">📋</span>
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">Basic Information</h2>
                <p className="text-gray-600 text-sm">Define the core details of your subscription plan</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-gray-700 mb-3">Plan Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-4 py-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 text-lg font-medium"
                  placeholder="e.g., Professional Plan, Enterprise Suite, Starter Package"
                  autoComplete="off"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-gray-700 mb-3">Plan Description *</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  rows={4}
                  className="w-full px-4 py-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                  placeholder="Describe what this plan offers and who it's designed for..."
                  autoComplete="off"
                />
              </div>
            </div>
          </div>

          {/* Pricing & Billing */}
          <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-8">
            <div className="flex items-center space-x-3 mb-6">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <span className="text-green-600 text-lg">💰</span>
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">Pricing & Billing</h2>
                <p className="text-gray-600 text-sm">Set the pricing structure and billing frequency</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">Price *</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-500 text-lg">{getCurrencySymbol(formData.currency)}</span>
                  <input
                    type="number"
                    value={formData.price}
                    onChange={(e) => setFormData(prev => ({ ...prev, price: parseInt(e.target.value) || 0 }))}
                    className="w-full pl-10 pr-4 py-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 text-lg font-bold"
                    placeholder="2999"
                    min="0"
                    autoComplete="off"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">Billing Cycle *</label>
                <select
                  value={formData.billingCycle}
                  onChange={(e) => setFormData(prev => ({ ...prev, billingCycle: e.target.value as 'monthly' | 'yearly' }))}
                  className="w-full px-4 py-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 text-lg"
                >
                  <option value="monthly">Monthly</option>
                  <option value="yearly">Yearly</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">Currency</label>
                <select
                  value={formData.currency}
                  onChange={(e) => setFormData(prev => ({ ...prev, currency: e.target.value }))}
                  className="w-full px-4 py-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 text-lg"
                >
                  <option value="INR">INR - Indian Rupee</option>
                  <option value="USD">USD - US Dollar</option>
                  <option value="EUR">EUR - Euro</option>
                </select>
              </div>
            </div>

            <div className="mt-6 p-4 bg-blue-50 rounded-xl border border-blue-200">
              <div className="flex items-center space-x-2">
                <span className="text-blue-600">💡</span>
                <span className="text-blue-800 font-medium">Pricing Preview:</span>
              </div>
              <p className="text-blue-700 mt-1">
                {getCurrencySymbol(formData.currency)}{formData.price} per {formData.billingCycle}
                {formData.billingCycle === 'yearly' && formData.price > 0 && ` (${getCurrencySymbol(formData.currency)}${Math.round(formData.price / 12)} per month)`}
              </p>
            </div>
          </div>

          {/* Resource Limits */}
          <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-8">
            <div className="flex items-center space-x-3 mb-6">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <span className="text-purple-600 text-lg">⚡</span>
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">Resource Limits</h2>
                <p className="text-gray-600 text-sm">Define usage limits and quotas for this plan</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">Maximum Users</label>
                <input
                  type="number"
                  value={formData.maxUsers}
                  onChange={(e) => setFormData(prev => ({ ...prev, maxUsers: parseInt(e.target.value) || 1 }))}
                  className="w-full px-4 py-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 text-lg font-medium"
                  min="1"
                  autoComplete="off"
                />
                <p className="text-xs text-gray-500 mt-2">Number of users allowed in this plan</p>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">Monthly Invoices</label>
                <input
                  type="number"
                  value={formData.maxInvoices}
                  onChange={(e) => setFormData(prev => ({ ...prev, maxInvoices: parseInt(e.target.value) || 1 }))}
                  className="w-full px-4 py-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 text-lg font-medium"
                  min="1"
                  autoComplete="off"
                />
                <p className="text-xs text-gray-500 mt-2">Maximum invoices per month</p>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">Storage Limit (GB)</label>
                <input
                  type="number"
                  value={formData.storageLimit}
                  onChange={(e) => setFormData(prev => ({ ...prev, storageLimit: parseInt(e.target.value) || 1 }))}
                  className="w-full px-4 py-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 text-lg font-medium"
                  min="1"
                  autoComplete="off"
                />
                <p className="text-xs text-gray-500 mt-2">Cloud storage allocation</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column - Features */}
        <div className="space-y-8">
          {/* Plan Preview */}
          <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl p-6 border border-gray-200">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Plan Preview</h3>
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <h4 className="text-xl font-bold text-gray-900">{formData.name || 'Plan Name'}</h4>
              <p className="text-gray-600 text-sm mt-1">{formData.description || 'Plan description will appear here...'}</p>
              <div className="mt-4">
                <div className="flex items-baseline">
                  <span className="text-3xl font-bold text-gray-900">{getCurrencySymbol(formData.currency)}{formData.price}</span>
                  <span className="text-gray-600 ml-2">/{formData.billingCycle}</span>
                </div>
              </div>
              <div className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Users:</span>
                  <span className="font-medium">{formData.maxUsers}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Invoices:</span>
                  <span className="font-medium">{formData.maxInvoices}/month</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Storage:</span>
                  <span className="font-medium">{formData.storageLimit} GB</span>
                </div>
              </div>
            </div>
          </div>

          {/* Features Selection */}
          <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6">
            <div className="flex items-center space-x-3 mb-6">
              <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                <span className="text-orange-600 text-lg">🎯</span>
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">Plan Features</h3>
                <p className="text-gray-600 text-sm">Select features to include</p>
              </div>
            </div>

            <div className="space-y-4">
              {formData.features.map((feature) => {
                const toggleHandler = handleFeatureToggle(feature.id);
                return (
                  <div key={feature.id} className={`group p-4 rounded-xl border-2 transition-all duration-200 cursor-pointer ${
                    feature.enabled
                      ? 'border-blue-200 bg-blue-50'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3">
                          <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-sm ${
                            feature.enabled
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-200 text-gray-600'
                          }`}>
                            {feature.enabled ? '✓' : '+'}
                          </div>
                          <h4 className={`font-semibold ${
                            feature.enabled ? 'text-blue-900' : 'text-gray-900'
                          }`}>{feature.name}</h4>
                        </div>
                        <p className={`text-sm mt-2 ml-9 ${
                          feature.enabled ? 'text-blue-700' : 'text-gray-600'
                        }`}>{feature.description}</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={feature.enabled}
                          onChange={toggleHandler}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                      </label>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="mt-12 bg-white rounded-2xl shadow-lg border border-gray-200 p-8">
        <div className="flex flex-col sm:flex-row justify-between items-center space-y-4 sm:space-y-0">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Ready to create your plan?</h3>
            <p className="text-gray-600 text-sm">Review all details before publishing to your tenants</p>
          </div>
          <div className="flex space-x-4">
            <button
              onClick={() => {
                resetForm();
                setActiveTab('plans');
              }}
              className="bg-gray-100 hover:bg-gray-200 text-gray-800 px-8 py-4 rounded-xl font-semibold transition-all duration-200 border border-gray-300"
            >
              Cancel
            </button>
            <button
              onClick={handleCreatePlan}
              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-8 py-4 rounded-xl font-semibold transition-all duration-200 shadow-lg hover:shadow-xl"
            >
              Create Plan
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const PlanDetailsModal = () => {
    if (!isModalOpen || !selectedPlan) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
          <div className="p-6 border-b border-gray-200">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold text-gray-900">{selectedPlan.name} Plan Details</h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 text-2xl"
              >
                ×
              </button>
            </div>
          </div>

          <div className="p-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Plan Information</h3>
                <div className="space-y-4">
                  <div>
                    <span className="text-sm text-gray-600">Description:</span>
                    <p className="text-gray-900">{selectedPlan.description}</p>
                  </div>
                  <div>
                    <span className="text-sm text-gray-600">Price:</span>
                    <p className="text-2xl font-bold text-gray-900">{getCurrencySymbol(selectedPlan.currency)}{selectedPlan.price}/{selectedPlan.billingCycle}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">Max Users:</span>
                      <p className="font-medium">{selectedPlan.maxUsers}</p>
                    </div>
                    <div>
                      <span className="text-gray-600">Max Invoices:</span>
                      <p className="font-medium">{selectedPlan.maxInvoices}/month</p>
                    </div>
                    <div>
                      <span className="text-gray-600">Storage:</span>
                      <p className="font-medium">{selectedPlan.storageLimit} GB</p>
                    </div>
                    <div>
                      <span className="text-gray-600">Status:</span>
                      <p className={`font-medium ${selectedPlan.isActive ? 'text-green-600' : 'text-red-600'}`}>
                        {selectedPlan.isActive ? 'Active' : 'Inactive'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Features Included</h3>
                <div className="space-y-3">
                  {selectedPlan.features.map((feature) => (
                    <div key={feature.id} className="flex items-center space-x-3">
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center ${
                        feature.enabled ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'
                      }`}>
                        {feature.enabled ? '✓' : '×'}
                      </div>
                      <div>
                        <p className={`font-medium ${feature.enabled ? 'text-gray-900' : 'text-gray-400'}`}>
                          {feature.name}
                        </p>
                        <p className={`text-sm ${feature.enabled ? 'text-gray-600' : 'text-gray-400'}`}>
                          {feature.description}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-8 pt-6 border-t border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Targeting & Visibility</h3>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                  <span className="text-sm text-gray-600">Visibility:</span>
                  <p className="font-medium text-gray-900">
                    {selectedPlan.visibility === 'all' ? 'Available to All Tenants' : 'Specific Tenants Only'}
                  </p>
                </div>
                <div>
                  <span className="text-sm text-gray-600">Created:</span>
                  <p className="font-medium text-gray-900">{selectedPlan.createdAt}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="p-6 border-t border-gray-200 bg-gray-50 rounded-b-2xl">
            <div className="flex justify-end space-x-4">
              <button
                onClick={() => setIsModalOpen(false)}
                className="bg-gray-100 hover:bg-gray-200 text-gray-800 px-6 py-2 rounded-lg font-medium transition-colors"
              >
                Close
              </button>
              <button
                onClick={() => {
                  setIsModalOpen(false);
                  setActiveTab('targeting');
                }}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition-colors"
              >
                Manage Targeting
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="p-8">
      {/* Tab Navigation */}
      <div className="mb-8">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('plans')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'plans'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              All Plans
            </button>
            <button
              onClick={() => setActiveTab('create')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'create'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Create Plan
            </button>
          </nav>
        </div>
      </div>

      {/* Tab Content */}
      <div className={activeTab === 'plans' ? 'block' : 'hidden'}>
        <PlansTab />
      </div>
      <div className={activeTab === 'create' ? 'block' : 'hidden'}>
        <CreatePlanTab />
      </div>

      {/* Modal */}
      <PlanDetailsModal />
    </div>
  );
};

export default SubscriptionPlans;