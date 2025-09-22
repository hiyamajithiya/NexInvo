import React, { useState, useEffect } from 'react';
import type { User } from '../../types/auth';
import type { TenantMembership, CreateUserRequest, Tenant } from '../../types/tenant';

const UserManagement: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [memberships, setMemberships] = useState<TenantMembership[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTenant, setFilterTenant] = useState('all');
  const [filterRole, setFilterRole] = useState('all');

  const [newUser, setNewUser] = useState<CreateUserRequest>({
    email: '',
    first_name: '',
    last_name: '',
    password: '',
    phone: '',
    designation: '',
    ca_registration_no: '',
    is_ca_user: false,
    tenant_id: '',
    role: 'viewer'
  });

  useEffect(() => {
    fetchUsers();
    fetchTenants();
    fetchMemberships();
  }, []);

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      // Mock data - replace with actual API call
      const mockUsers: User[] = [
        {
          id: '1',
          email: 'john.doe@example.com',
          first_name: 'John',
          last_name: 'Doe',
          phone: '+91 9876543210',
          designation: 'CA',
          ca_registration_no: 'CA12345',
          is_ca_user: true,
          is_superuser: false,
          two_factor_enabled: true,
          date_joined: '2024-01-15T00:00:00Z',
          last_login: '2024-03-15T10:30:00Z',
          role: 'ca_owner'
        },
        {
          id: '2',
          email: 'jane.smith@company.com',
          first_name: 'Jane',
          last_name: 'Smith',
          designation: 'Finance Manager',
          is_ca_user: false,
          is_superuser: false,
          two_factor_enabled: false,
          date_joined: '2024-02-01T00:00:00Z',
          last_login: '2024-03-14T15:45:00Z',
          role: 'finance_user'
        }
      ];
      setUsers(mockUsers);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchTenants = async () => {
    try {
      // Mock tenants - replace with actual API call
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
    }
  };

  const fetchMemberships = async () => {
    try {
      // Mock memberships - replace with actual API call
      const mockMemberships: TenantMembership[] = [
        {
          id: '1',
          user_id: '1',
          tenant_id: '1',
          role: 'ca_owner',
          permissions: {},
          joined_at: '2024-01-15T00:00:00Z',
          is_active: true,
          created_at: '2024-01-15T00:00:00Z',
          updated_at: '2024-01-15T00:00:00Z',
          user: {
            id: '1',
            email: 'john.doe@example.com',
            first_name: 'John',
            last_name: 'Doe'
          },
          tenant: {
            id: '1',
            name: 'ABC CA Firm'
          }
        }
      ];
      setMemberships(mockMemberships);
    } catch (error) {
      console.error('Error fetching memberships:', error);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Mock creation - replace with actual API call
      console.log('Creating user:', newUser);
      await fetchUsers();
      setShowCreateForm(false);
      setNewUser({
        email: '',
        first_name: '',
        last_name: '',
        password: '',
        phone: '',
        designation: '',
        ca_registration_no: '',
        is_ca_user: false,
        tenant_id: '',
        role: 'viewer'
      });
    } catch (error) {
      console.error('Error creating user:', error);
    }
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch =
      user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      `${user.first_name} ${user.last_name}`.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = filterRole === 'all' || user.role === filterRole;
    return matchesSearch && matchesRole;
  });

  const getRoleBadge = (role?: string) => {
    const colors = {
      ca_owner: 'bg-purple-100 text-purple-800',
      admin: 'bg-red-100 text-red-800',
      finance_user: 'bg-green-100 text-green-800',
      viewer: 'bg-blue-100 text-blue-800',
      client_readonly: 'bg-gray-100 text-gray-800'
    };
    return colors[role as keyof typeof colors] || colors.viewer;
  };

  const getUserTenants = (userId: string) => {
    return memberships
      .filter(m => m.user_id === userId && m.is_active)
      .map(m => m.tenant.name);
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
              <h1 className="text-3xl font-bold text-gray-900">User Management</h1>
              <p className="text-gray-600 mt-1">Manage users across all tenants</p>
            </div>
            <div className="mt-4 sm:mt-0">
              <button
                onClick={() => setShowCreateForm(true)}
                className="px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg shadow-lg hover:from-blue-600 hover:to-purple-700 font-medium transition-all"
              >
                + Add New User
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white/80 backdrop-blur rounded-2xl shadow-lg border border-white/50 p-6">
          <div className="flex items-center">
            <div className="text-3xl mr-4">👥</div>
            <div>
              <p className="text-sm font-medium text-gray-600">Total Users</p>
              <p className="text-2xl font-bold text-gray-900">{users.length}</p>
              <p className="text-xs text-green-600">{users.filter(u => u.last_login).length} active</p>
            </div>
          </div>
        </div>

        <div className="bg-white/80 backdrop-blur rounded-2xl shadow-lg border border-white/50 p-6">
          <div className="flex items-center">
            <div className="text-3xl mr-4">👑</div>
            <div>
              <p className="text-sm font-medium text-gray-600">CA Users</p>
              <p className="text-2xl font-bold text-gray-900">{users.filter(u => u.is_ca_user).length}</p>
              <p className="text-xs text-indigo-600">Professional users</p>
            </div>
          </div>
        </div>

        <div className="bg-white/80 backdrop-blur rounded-2xl shadow-lg border border-white/50 p-6">
          <div className="flex items-center">
            <div className="text-3xl mr-4">🔐</div>
            <div>
              <p className="text-sm font-medium text-gray-600">2FA Enabled</p>
              <p className="text-2xl font-bold text-gray-900">{users.filter(u => u.two_factor_enabled).length}</p>
              <p className="text-xs text-green-600">Secure accounts</p>
            </div>
          </div>
        </div>

        <div className="bg-white/80 backdrop-blur rounded-2xl shadow-lg border border-white/50 p-6">
          <div className="flex items-center">
            <div className="text-3xl mr-4">⚡</div>
            <div>
              <p className="text-sm font-medium text-gray-600">Admin Users</p>
              <p className="text-2xl font-bold text-gray-900">{users.filter(u => u.role === 'admin' || u.role === 'ca_owner').length}</p>
              <p className="text-xs text-red-600">Privileged access</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white/80 backdrop-blur rounded-2xl shadow-lg border border-white/50 p-6 mb-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Search Users</label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by name or email..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Role</label>
            <select
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All Roles</option>
              <option value="ca_owner">CA Owner</option>
              <option value="admin">Admin</option>
              <option value="finance_user">Finance User</option>
              <option value="viewer">Viewer</option>
              <option value="client_readonly">Client Read-Only</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Tenant</label>
            <select
              value={filterTenant}
              onChange={(e) => setFilterTenant(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All Tenants</option>
              {tenants.map(tenant => (
                <option key={tenant.id} value={tenant.id}>{tenant.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white/80 backdrop-blur rounded-2xl shadow-lg border border-white/50 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50/80 border-b border-gray-200/50">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tenants</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Login</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200/50">
              {filteredUsers.map((user) => (
                <tr key={user.id} className="hover:bg-blue-50/30 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="w-10 h-10 bg-gradient-to-r from-blue-400 to-purple-500 rounded-full flex items-center justify-center text-white font-bold text-sm mr-4">
                        {user.first_name[0]}{user.last_name[0]}
                      </div>
                      <div>
                        <div className="text-sm font-medium text-gray-900">{user.first_name} {user.last_name}</div>
                        <div className="text-sm text-gray-500">{user.email}</div>
                        {user.designation && (
                          <div className="text-xs text-gray-400">{user.designation}</div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getRoleBadge(user.role)}`}>
                      {user.role?.replace('_', ' ').toUpperCase() || 'VIEWER'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1">
                      {getUserTenants(user.id).map((tenantName, index) => (
                        <span key={index} className="inline-flex px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full">
                          {tenantName}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center space-x-2">
                      {user.is_ca_user && (
                        <span className="inline-flex px-2 py-1 text-xs bg-indigo-100 text-indigo-800 rounded-full">
                          CA User
                        </span>
                      )}
                      {user.two_factor_enabled && (
                        <span className="inline-flex px-2 py-1 text-xs bg-green-100 text-green-800 rounded-full">
                          2FA
                        </span>
                      )}
                      {user.is_superuser && (
                        <span className="inline-flex px-2 py-1 text-xs bg-red-100 text-red-800 rounded-full">
                          Super Admin
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {user.last_login ? new Date(user.last_login).toLocaleDateString() : 'Never'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button className="text-blue-600 hover:text-blue-700 mr-3">Edit</button>
                    <button className="text-green-600 hover:text-green-700 mr-3">View</button>
                    <button className="text-orange-600 hover:text-orange-700 mr-3">Reset</button>
                    <button className="text-red-600 hover:text-red-700">Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create User Modal */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900">Create New User</h2>
              <p className="text-gray-600 mt-1">Add a new user and assign to tenant</p>
            </div>

            <form onSubmit={handleCreateUser} className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Email *</label>
                  <input
                    type="email"
                    required
                    value={newUser.email}
                    onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="user@example.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Password *</label>
                  <input
                    type="password"
                    required
                    value={newUser.password}
                    onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter password"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">First Name *</label>
                  <input
                    type="text"
                    required
                    value={newUser.first_name}
                    onChange={(e) => setNewUser({ ...newUser, first_name: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="John"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Last Name *</label>
                  <input
                    type="text"
                    required
                    value={newUser.last_name}
                    onChange={(e) => setNewUser({ ...newUser, last_name: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Doe"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Phone</label>
                  <input
                    type="tel"
                    value={newUser.phone}
                    onChange={(e) => setNewUser({ ...newUser, phone: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="+91 9876543210"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Designation</label>
                  <input
                    type="text"
                    value={newUser.designation}
                    onChange={(e) => setNewUser({ ...newUser, designation: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Finance Manager"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Assign to Tenant</label>
                  <select
                    value={newUser.tenant_id}
                    onChange={(e) => setNewUser({ ...newUser, tenant_id: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Select Tenant</option>
                    {tenants.map(tenant => (
                      <option key={tenant.id} value={tenant.id}>{tenant.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Role</label>
                  <select
                    value={newUser.role}
                    onChange={(e) => setNewUser({ ...newUser, role: e.target.value as any })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="viewer">Viewer</option>
                    <option value="finance_user">Finance User</option>
                    <option value="admin">Admin</option>
                    <option value="ca_owner">CA Owner</option>
                    <option value="client_readonly">Client Read-Only</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">CA Registration No.</label>
                  <input
                    type="text"
                    value={newUser.ca_registration_no}
                    onChange={(e) => setNewUser({ ...newUser, ca_registration_no: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="CA12345"
                  />
                </div>

                <div className="flex items-center pt-6">
                  <input
                    type="checkbox"
                    id="is_ca_user"
                    checked={newUser.is_ca_user}
                    onChange={(e) => setNewUser({ ...newUser, is_ca_user: e.target.checked })}
                    className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <label htmlFor="is_ca_user" className="ml-2 text-sm font-medium text-gray-700">
                    CA User
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
                  Create User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;