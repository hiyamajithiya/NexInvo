import React, { useState, useEffect } from 'react';
import type { Tenant, CreateTenantRequest, TenantStats } from '../../types/tenant';

const TenantManagement: React.FC = () => {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [stats, setStats] = useState<TenantStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterPlan, setFilterPlan] = useState('all');
  const [filterType, setFilterType] = useState('all');

  const [newTenant, setNewTenant] = useState<CreateTenantRequest>({
    name: '',
    business_type: 'ca_firm',
    subscription_plan: 'free',
    aato_threshold: 5000000,
    e_invoice_enabled: false,
    b2c_qr_enabled: true,
    company_details: {},
    gst_settings: {},
    billing_details: {}
  });

  useEffect(() => {
    fetchTenants();
    fetchStats();
  }, []);

  const fetchTenants = async () => {
    setIsLoading(true);
    try {
      // Mock data for now - replace with actual API call
      const mockTenants: Tenant[] = [
        {
          id: '1',
          name: 'ABC CA Firm',
          business_type: 'ca_firm',
          subscription_plan: 'professional',
          aato_threshold: 5000000,
          e_invoice_enabled: true,
          b2c_qr_enabled: true,
          company_details: {},
          gst_settings: {},
          billing_details: {},
          created_at: '2024-01-15T00:00:00Z',
          updated_at: '2024-01-15T00:00:00Z'
        },
        {
          id: '2',
          name: 'XYZ Enterprise',
          business_type: 'enterprise',
          subscription_plan: 'enterprise',
          aato_threshold: 10000000,
          e_invoice_enabled: true,
          b2c_qr_enabled: true,
          company_details: {},
          gst_settings: {},
          billing_details: {},
          created_at: '2024-02-01T00:00:00Z',
          updated_at: '2024-02-01T00:00:00Z'
        }
      ];
      setTenants(mockTenants);
    } catch (error) {
      console.error('Error fetching tenants:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      // Mock stats - replace with actual API call
      const mockStats: TenantStats = {
        total_tenants: 25,
        active_tenants: 22,
        total_users: 150,
        active_users: 142,
        subscription_breakdown: {
          free: 8,
          basic: 12,
          professional: 4,
          enterprise: 1
        },
        business_type_breakdown: {
          ca_firm: 18,
          sme: 5,
          enterprise: 2
        }
      };
      setStats(mockStats);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const handleCreateTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Mock creation - replace with actual API call
      console.log('Creating tenant:', newTenant);
      await fetchTenants();
      setShowCreateForm(false);
      setNewTenant({
        name: '',
        business_type: 'ca_firm',
        subscription_plan: 'free',
        aato_threshold: 5000000,
        e_invoice_enabled: false,
        b2c_qr_enabled: true,
        company_details: {},
        gst_settings: {},
        billing_details: {}
      });
    } catch (error) {
      console.error('Error creating tenant:', error);
    }
  };

  const filteredTenants = tenants.filter(tenant => {
    const matchesSearch = tenant.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesPlan = filterPlan === 'all' || tenant.subscription_plan === filterPlan;
    const matchesType = filterType === 'all' || tenant.business_type === filterType;
    return matchesSearch && matchesPlan && matchesType;
  });

  const getStatusBadge = (plan: string) => {
    const colors = {
      free: 'bg-gray-100 text-gray-800',
      basic: 'bg-blue-100 text-blue-800',
      professional: 'bg-green-100 text-green-800',
      enterprise: 'bg-purple-100 text-purple-800'
    };
    return colors[plan as keyof typeof colors] || colors.free;
  };

  const getBusinessTypeBadge = (type: string) => {
    const colors = {
      ca_firm: 'bg-indigo-100 text-indigo-800',
      sme: 'bg-orange-100 text-orange-800',
      enterprise: 'bg-red-100 text-red-800'
    };
    return colors[type as keyof typeof colors] || colors.ca_firm;
  };

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="flex items-center justify-center min-h-96">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <div className="bg-white/70 backdrop-blur rounded-2xl p-6 shadow-lg border border-white/50">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Tenant Management</h1>
              <p className="text-gray-600 mt-1">Manage SaaS tenants and their subscriptions</p>
            </div>
            <div className="mt-4 sm:mt-0">
              <button
                onClick={() => setShowCreateForm(true)}
                className="px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg shadow-lg hover:from-blue-600 hover:to-purple-700 font-medium transition-all"
              >
                + Add New Tenant
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white/80 backdrop-blur rounded-2xl shadow-lg border border-white/50 p-6">
            <div className="flex items-center">
              <div className="text-3xl mr-4">🏢</div>
              <div>
                <p className="text-sm font-medium text-gray-600">Total Tenants</p>
                <p className="text-2xl font-bold text-gray-900">{stats.total_tenants}</p>
                <p className="text-xs text-green-600">{stats.active_tenants} active</p>
              </div>
            </div>
          </div>

          <div className="bg-white/80 backdrop-blur rounded-2xl shadow-lg border border-white/50 p-6">
            <div className="flex items-center">
              <div className="text-3xl mr-4">👥</div>
              <div>
                <p className="text-sm font-medium text-gray-600">Total Users</p>
                <p className="text-2xl font-bold text-gray-900">{stats.total_users}</p>
                <p className="text-xs text-green-600">{stats.active_users} active</p>
              </div>
            </div>
          </div>

          <div className="bg-white/80 backdrop-blur rounded-2xl shadow-lg border border-white/50 p-6">
            <div className="flex items-center">
              <div className="text-3xl mr-4">💎</div>
              <div>
                <p className="text-sm font-medium text-gray-600">Enterprise Plans</p>
                <p className="text-2xl font-bold text-gray-900">{stats.subscription_breakdown.enterprise}</p>
                <p className="text-xs text-purple-600">Premium customers</p>
              </div>
            </div>
          </div>

          <div className="bg-white/80 backdrop-blur rounded-2xl shadow-lg border border-white/50 p-6">
            <div className="flex items-center">
              <div className="text-3xl mr-4">🎯</div>
              <div>
                <p className="text-sm font-medium text-gray-600">CA Firms</p>
                <p className="text-2xl font-bold text-gray-900">{stats.business_type_breakdown.ca_firm}</p>
                <p className="text-xs text-indigo-600">Primary market</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white/80 backdrop-blur rounded-2xl shadow-lg border border-white/50 p-6 mb-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Search Tenants</label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by name..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Subscription Plan</label>
            <select
              value={filterPlan}
              onChange={(e) => setFilterPlan(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All Plans</option>
              <option value="free">Free</option>
              <option value="basic">Basic</option>
              <option value="professional">Professional</option>
              <option value="enterprise">Enterprise</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Business Type</label>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All Types</option>
              <option value="ca_firm">CA Firm</option>
              <option value="sme">SME</option>
              <option value="enterprise">Enterprise</option>
            </select>
          </div>
        </div>
      </div>

      {/* Tenants Table */}
      <div className="bg-white/80 backdrop-blur rounded-2xl shadow-lg border border-white/50 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50/80 border-b border-gray-200/50">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tenant</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Business Type</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Plan</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">E-Invoice</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200/50">
              {filteredTenants.map((tenant) => (
                <tr key={tenant.id} className="hover:bg-blue-50/30 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">{tenant.name}</div>
                      <div className="text-sm text-gray-500">ID: {tenant.id}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getBusinessTypeBadge(tenant.business_type)}`}>
                      {tenant.business_type.replace('_', ' ').toUpperCase()}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadge(tenant.subscription_plan)}`}>
                      {tenant.subscription_plan.charAt(0).toUpperCase() + tenant.subscription_plan.slice(1)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      tenant.e_invoice_enabled ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {tenant.e_invoice_enabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(tenant.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button className="text-blue-600 hover:text-blue-700 mr-3">Edit</button>
                    <button className="text-green-600 hover:text-green-700 mr-3">View</button>
                    <button className="text-red-600 hover:text-red-700">Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Tenant Modal */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900">Create New Tenant</h2>
              <p className="text-gray-600 mt-1">Add a new tenant to the SaaS platform</p>
            </div>

            <form onSubmit={handleCreateTenant} className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Tenant Name *</label>
                  <input
                    type="text"
                    required
                    value={newTenant.name}
                    onChange={(e) => setNewTenant({ ...newTenant, name: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter tenant name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Business Type *</label>
                  <select
                    required
                    value={newTenant.business_type}
                    onChange={(e) => setNewTenant({ ...newTenant, business_type: e.target.value as any })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="ca_firm">CA Firm</option>
                    <option value="sme">SME</option>
                    <option value="enterprise">Enterprise</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Subscription Plan *</label>
                  <select
                    required
                    value={newTenant.subscription_plan}
                    onChange={(e) => setNewTenant({ ...newTenant, subscription_plan: e.target.value as any })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="free">Free</option>
                    <option value="basic">Basic</option>
                    <option value="professional">Professional</option>
                    <option value="enterprise">Enterprise</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">AATO Threshold</label>
                  <input
                    type="number"
                    value={newTenant.aato_threshold}
                    onChange={(e) => setNewTenant({ ...newTenant, aato_threshold: Number(e.target.value) })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="5000000"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="e_invoice_enabled"
                    checked={newTenant.e_invoice_enabled}
                    onChange={(e) => setNewTenant({ ...newTenant, e_invoice_enabled: e.target.checked })}
                    className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <label htmlFor="e_invoice_enabled" className="ml-2 text-sm font-medium text-gray-700">
                    Enable E-Invoice
                  </label>
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="b2c_qr_enabled"
                    checked={newTenant.b2c_qr_enabled}
                    onChange={(e) => setNewTenant({ ...newTenant, b2c_qr_enabled: e.target.checked })}
                    className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <label htmlFor="b2c_qr_enabled" className="ml-2 text-sm font-medium text-gray-700">
                    Enable B2C QR Code
                  </label>
                </div>
              </div>

              <div className="flex justify-end space-x-4 pt-6 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg hover:from-blue-600 hover:to-purple-700 font-medium transition-all"
                >
                  Create Tenant
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default TenantManagement;