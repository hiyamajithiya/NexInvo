import React, { useState, useEffect } from 'react';
import type { Tenant, CreateTenantRequest, TenantStats } from '../../types/tenant';

const BUSINESS_TYPES = [
  { value: 'professional', label: 'Professional Services (CA, Consultant, Lawyer, Doctor)' },
  { value: 'trader', label: 'Trader (Goods Trading)' },
  { value: 'manufacturer', label: 'Manufacturer (Production/Manufacturing)' },
  { value: 'contractor', label: 'Contractor (Service Contractor)' },
  { value: 'epc_contractor', label: 'EPC Contractor (Engineering, Procurement, Construction)' },
  { value: 'manpower_supplier', label: 'Manpower Supplier (HR/Staffing Services)' },
  { value: 'software_it', label: 'Software/IT Services' },
  { value: 'transport_logistics', label: 'Transport/Logistics' },
  { value: 'real_estate', label: 'Real Estate' },
  { value: 'retail', label: 'Retail Business' },
  { value: 'hospitality', label: 'Hospitality (Hotels, Restaurants)' },
  { value: 'healthcare', label: 'Healthcare Services' },
  { value: 'education', label: 'Education Services' },
  { value: 'agriculture', label: 'Agriculture/Farming' },
  { value: 'other', label: 'Other Business Type' }
];

const TenantManagement: React.FC = () => {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [stats, setStats] = useState<TenantStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterPlan, setFilterPlan] = useState('all');
  const [filterType, setFilterType] = useState('all');

  const [newTenant, setNewTenant] = useState<CreateTenantRequest>({
    name: '',
    business_type: 'professional',
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
      // Load from localStorage first
      const savedTenants = localStorage.getItem('tenants');
      if (savedTenants) {
        setTenants(JSON.parse(savedTenants));
      } else {
        // Initial mock data
        const mockTenants: Tenant[] = [
          {
            id: '1',
            name: 'ABC Professional Services',
            business_type: 'professional',
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
            name: 'XYZ Manufacturing Ltd',
            business_type: 'manufacturer',
            subscription_plan: 'enterprise',
            aato_threshold: 10000000,
            e_invoice_enabled: true,
            b2c_qr_enabled: true,
            company_details: {},
            gst_settings: {},
            billing_details: {},
            created_at: '2024-02-01T00:00:00Z',
            updated_at: '2024-02-01T00:00:00Z'
          },
          {
            id: '3',
            name: 'PQR Traders',
            business_type: 'trader',
            subscription_plan: 'basic',
            aato_threshold: 5000000,
            e_invoice_enabled: false,
            b2c_qr_enabled: true,
            company_details: {},
            gst_settings: {},
            billing_details: {},
            created_at: '2024-03-01T00:00:00Z',
            updated_at: '2024-03-01T00:00:00Z'
          }
        ];
        setTenants(mockTenants);
        localStorage.setItem('tenants', JSON.stringify(mockTenants));
      }
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
          professional: 8,
          trader: 5,
          manufacturer: 3,
          contractor: 2,
          software_it: 2,
          retail: 2,
          other: 3
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
      // Create new tenant with unique ID
      const newTenantWithId: Tenant = {
        ...newTenant,
        id: Date.now().toString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      // Add to existing tenants list
      setTenants(prevTenants => [newTenantWithId, ...prevTenants]);

      // Update stats
      setStats(prevStats => prevStats ? {
        ...prevStats,
        total_tenants: prevStats.total_tenants + 1,
        active_tenants: prevStats.active_tenants + 1,
        subscription_breakdown: {
          ...prevStats.subscription_breakdown,
          [newTenant.subscription_plan]: (prevStats.subscription_breakdown[newTenant.subscription_plan as keyof typeof prevStats.subscription_breakdown] || 0) + 1
        },
        business_type_breakdown: {
          ...prevStats.business_type_breakdown,
          [newTenant.business_type]: (prevStats.business_type_breakdown[newTenant.business_type as keyof typeof prevStats.business_type_breakdown] || 0) + 1
        }
      } : null);

      // Store in localStorage for persistence
      const existingTenants = JSON.parse(localStorage.getItem('tenants') || '[]');
      localStorage.setItem('tenants', JSON.stringify([newTenantWithId, ...existingTenants]));

      // Close form and reset
      setShowCreateForm(false);
      setNewTenant({
        name: '',
        business_type: 'professional',
        subscription_plan: 'free',
        aato_threshold: 5000000,
        e_invoice_enabled: false,
        b2c_qr_enabled: true,
        company_details: {},
        gst_settings: {},
        billing_details: {}
      });

      // Show success message (you can add a notification here)
      alert('Tenant created successfully!');
    } catch (error) {
      console.error('Error creating tenant:', error);
      alert('Failed to create tenant. Please try again.');
    }
  };

  const handleEditTenant = (tenant: Tenant) => {
    setSelectedTenant(tenant);
    setNewTenant({
      name: tenant.name,
      business_type: tenant.business_type,
      subscription_plan: tenant.subscription_plan,
      aato_threshold: tenant.aato_threshold,
      e_invoice_enabled: tenant.e_invoice_enabled,
      b2c_qr_enabled: tenant.b2c_qr_enabled,
      company_details: tenant.company_details,
      gst_settings: tenant.gst_settings,
      billing_details: tenant.billing_details
    });
    setShowEditForm(true);
  };

  const handleUpdateTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTenant) return;

    try {
      const updatedTenant: Tenant = {
        ...selectedTenant,
        ...newTenant,
        updated_at: new Date().toISOString()
      };

      // Update in state
      setTenants(prevTenants =>
        prevTenants.map(t => t.id === selectedTenant.id ? updatedTenant : t)
      );

      // Update in localStorage
      const existingTenants = JSON.parse(localStorage.getItem('tenants') || '[]');
      const updatedTenants = existingTenants.map((t: Tenant) =>
        t.id === selectedTenant.id ? updatedTenant : t
      );
      localStorage.setItem('tenants', JSON.stringify(updatedTenants));

      // Close form and reset
      setShowEditForm(false);
      setSelectedTenant(null);
      setNewTenant({
        name: '',
        business_type: 'professional',
        subscription_plan: 'free',
        aato_threshold: 5000000,
        e_invoice_enabled: false,
        b2c_qr_enabled: true,
        company_details: {},
        gst_settings: {},
        billing_details: {}
      });

      alert('Tenant updated successfully!');
    } catch (error) {
      console.error('Error updating tenant:', error);
      alert('Failed to update tenant. Please try again.');
    }
  };

  const handleViewTenant = (tenant: Tenant) => {
    setSelectedTenant(tenant);
    setShowViewModal(true);
  };

  const handleDeleteTenant = (tenant: Tenant) => {
    if (confirm(`Are you sure you want to delete "${tenant.name}"? This action cannot be undone.`)) {
      // Remove from state
      setTenants(prevTenants => prevTenants.filter(t => t.id !== tenant.id));

      // Update stats
      setStats(prevStats => prevStats ? {
        ...prevStats,
        total_tenants: Math.max(0, prevStats.total_tenants - 1),
        active_tenants: Math.max(0, prevStats.active_tenants - 1),
        subscription_breakdown: {
          ...prevStats.subscription_breakdown,
          [tenant.subscription_plan]: Math.max(0, (prevStats.subscription_breakdown[tenant.subscription_plan as keyof typeof prevStats.subscription_breakdown] || 0) - 1)
        },
        business_type_breakdown: {
          ...prevStats.business_type_breakdown,
          [tenant.business_type]: Math.max(0, (prevStats.business_type_breakdown[tenant.business_type as keyof typeof prevStats.business_type_breakdown] || 0) - 1)
        }
      } : null);

      // Update localStorage
      const existingTenants = JSON.parse(localStorage.getItem('tenants') || '[]');
      const filteredTenants = existingTenants.filter((t: Tenant) => t.id !== tenant.id);
      localStorage.setItem('tenants', JSON.stringify(filteredTenants));

      alert(`Tenant "${tenant.name}" deleted successfully!`);
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
      professional: 'bg-blue-100 text-blue-800',
      trader: 'bg-green-100 text-green-800',
      manufacturer: 'bg-purple-100 text-purple-800',
      contractor: 'bg-orange-100 text-orange-800',
      epc_contractor: 'bg-red-100 text-red-800',
      manpower_supplier: 'bg-yellow-100 text-yellow-800',
      software_it: 'bg-indigo-100 text-indigo-800',
      transport_logistics: 'bg-teal-100 text-teal-800',
      real_estate: 'bg-pink-100 text-pink-800',
      retail: 'bg-cyan-100 text-cyan-800',
      hospitality: 'bg-amber-100 text-amber-800',
      healthcare: 'bg-emerald-100 text-emerald-800',
      education: 'bg-violet-100 text-violet-800',
      agriculture: 'bg-lime-100 text-lime-800',
      other: 'bg-gray-100 text-gray-800'
    };
    return colors[type as keyof typeof colors] || colors.other;
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
                <p className="text-sm font-medium text-gray-600">Professional Services</p>
                <p className="text-2xl font-bold text-gray-900">{stats.business_type_breakdown.professional || 0}</p>
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
              {BUSINESS_TYPES.map(type => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
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
                    <button
                      onClick={() => handleEditTenant(tenant)}
                      className="text-blue-600 hover:text-blue-700 mr-3"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleViewTenant(tenant)}
                      className="text-green-600 hover:text-green-700 mr-3"
                    >
                      View
                    </button>
                    <button
                      onClick={() => handleDeleteTenant(tenant)}
                      className="text-red-600 hover:text-red-700"
                    >
                      Delete
                    </button>
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
                    {BUSINESS_TYPES.map(type => (
                      <option key={type.value} value={type.value}>{type.label}</option>
                    ))}
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

      {/* Edit Modal */}
      {showEditForm && selectedTenant && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full p-8 max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold mb-6 text-gray-900">Edit Tenant</h2>
            <form onSubmit={handleUpdateTenant} className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tenant Name *
                  </label>
                  <input
                    type="text"
                    value={newTenant.name}
                    onChange={(e) => setNewTenant({ ...newTenant, name: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Business Type *
                  </label>
                  <select
                    value={newTenant.business_type}
                    onChange={(e) => setNewTenant({ ...newTenant, business_type: e.target.value as any })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  >
                    {BUSINESS_TYPES.map(type => (
                      <option key={type.value} value={type.value}>{type.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Subscription Plan *
                  </label>
                  <select
                    value={newTenant.subscription_plan}
                    onChange={(e) => setNewTenant({ ...newTenant, subscription_plan: e.target.value as any })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  >
                    <option value="free">Free</option>
                    <option value="basic">Basic</option>
                    <option value="professional">Professional</option>
                    <option value="enterprise">Enterprise</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    AATO Threshold
                  </label>
                  <input
                    type="number"
                    value={newTenant.aato_threshold}
                    onChange={(e) => setNewTenant({ ...newTenant, aato_threshold: Number(e.target.value) })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div className="space-y-4">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={newTenant.e_invoice_enabled}
                    onChange={(e) => setNewTenant({ ...newTenant, e_invoice_enabled: e.target.checked })}
                    className="mr-2"
                  />
                  <span className="text-sm font-medium text-gray-700">E-Invoice Enabled</span>
                </label>

                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={newTenant.b2c_qr_enabled}
                    onChange={(e) => setNewTenant({ ...newTenant, b2c_qr_enabled: e.target.checked })}
                    className="mr-2"
                  />
                  <span className="text-sm font-medium text-gray-700">B2C QR Enabled</span>
                </label>
              </div>

              <div className="flex justify-end space-x-4 pt-6 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditForm(false);
                    setSelectedTenant(null);
                  }}
                  className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg hover:from-blue-600 hover:to-purple-700 font-medium transition-all"
                >
                  Update Tenant
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Modal */}
      {showViewModal && selectedTenant && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full p-8 max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold mb-6 text-gray-900">Tenant Details</h2>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-500">Name</label>
                  <p className="mt-1 text-lg font-semibold text-gray-900">{selectedTenant.name}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500">Business Type</label>
                  <p className="mt-1 text-lg capitalize text-gray-900">{selectedTenant.business_type.replace('_', ' ')}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500">Subscription Plan</label>
                  <p className="mt-1">
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusBadge(selectedTenant.subscription_plan)}`}>
                      {selectedTenant.subscription_plan}
                    </span>
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500">AATO Threshold</label>
                  <p className="mt-1 text-lg text-gray-900">₹{selectedTenant.aato_threshold.toLocaleString()}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500">E-Invoice</label>
                  <p className="mt-1">
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                      selectedTenant.e_invoice_enabled ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                    }`}>
                      {selectedTenant.e_invoice_enabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500">B2C QR</label>
                  <p className="mt-1">
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                      selectedTenant.b2c_qr_enabled ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                    }`}>
                      {selectedTenant.b2c_qr_enabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500">Created At</label>
                  <p className="mt-1 text-gray-900">{new Date(selectedTenant.created_at).toLocaleString()}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500">Updated At</label>
                  <p className="mt-1 text-gray-900">{new Date(selectedTenant.updated_at).toLocaleString()}</p>
                </div>
              </div>
            </div>

            <div className="flex justify-end mt-8 pt-6 border-t border-gray-200">
              <button
                onClick={() => {
                  setShowViewModal(false);
                  setSelectedTenant(null);
                }}
                className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 font-medium transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TenantManagement;