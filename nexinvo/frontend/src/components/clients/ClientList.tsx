import React, { useState, useEffect } from 'react';
import { apiClient } from '../../services/api';

interface Client {
  id: string;
  name: string;
  client_code: string;
  client_type: string;
  gstin: string;
  pan: string;
  email: string;
  phone: string;
  state_code: string;
  credit_terms_days: number;
  billing_address: {
    street: string;
    city: string;
    state: string;
    postal_code: string;
    country: string;
  };
}

const ClientList: React.FC = () => {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    client_code: '',
    client_type: 'b2b',
    gstin: '',
    pan: '',
    email: '',
    phone: '',
    state_code: '',
    credit_terms_days: 30,
    billing_address: {
      street: '',
      city: '',
      state: '',
      postal_code: '',
      country: 'India'
    }
  });

  useEffect(() => {
    fetchClients();
  }, []);

  const fetchClients = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get('/api/v1/invoices/clients/');
      setClients(response.data.results || []);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch clients');
      console.error('Error fetching clients:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (editingClient) {
        await apiClient.patch(`/api/v1/invoices/clients/${editingClient.id}/`, formData);
        alert('Client updated successfully!');
      } else {
        await apiClient.post('/api/v1/invoices/clients/', formData);
        alert('Client created successfully!');
      }

      setShowForm(false);
      resetForm();
      fetchClients();
    } catch (err: any) {
      console.error('Error saving client:', err);
      alert('Failed to save client: ' + (err.response?.data?.detail || err.message));
    }
  };

  const handleEdit = (client: Client) => {
    setEditingClient(client);
    setFormData({
      name: client.name,
      client_code: client.client_code,
      client_type: client.client_type,
      gstin: client.gstin,
      pan: client.pan,
      email: client.email,
      phone: client.phone,
      state_code: client.state_code,
      credit_terms_days: client.credit_terms_days,
      billing_address: client.billing_address || {
        street: '',
        city: '',
        state: '',
        postal_code: '',
        country: 'India'
      }
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this client?')) {
      try {
        await apiClient.delete(`/api/v1/invoices/clients/${id}/`);
        fetchClients();
        alert('Client deleted successfully!');
      } catch (err: any) {
        console.error('Error deleting client:', err);
        alert('Failed to delete client');
      }
    }
  };

  const validateGSTIN = async () => {
    if (!formData.gstin) return;

    try {
      const response = await apiClient.post('/api/v1/invoices/validate_gstin/', {
        gstin: formData.gstin
      });

      if (response.data.is_valid) {
        alert('GSTIN is valid!');
        setFormData({
          ...formData,
          state_code: response.data.state_code,
          pan: response.data.pan
        });
      } else {
        alert('Invalid GSTIN: ' + response.data.error);
      }
    } catch (err) {
      console.error('Error validating GSTIN:', err);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      client_code: '',
      client_type: 'b2b',
      gstin: '',
      pan: '',
      email: '',
      phone: '',
      state_code: '',
      credit_terms_days: 30,
      billing_address: {
        street: '',
        city: '',
        state: '',
        postal_code: '',
        country: 'India'
      }
    });
    setEditingClient(null);
  };

  const filteredClients = clients.filter(client => {
    const matchesSearch = client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          client.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          client.gstin?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === 'all' || client.client_type === filterType;
    return matchesSearch && matchesType;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
        <p className="font-medium">Error loading clients</p>
        <p className="text-sm">{error}</p>
        <button onClick={fetchClients} className="mt-2 text-sm underline">
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Clients</h2>
        <button
          onClick={() => {
            resetForm();
            setShowForm(true);
          }}
          className="btn-primary"
        >
          Add New Client
        </button>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">
              {editingClient ? 'Edit Client' : 'Add New Client'}
            </h3>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Name *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="input-field"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Client Code</label>
                  <input
                    type="text"
                    value={formData.client_code}
                    onChange={(e) => setFormData({ ...formData, client_code: e.target.value })}
                    className="input-field"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Client Type</label>
                  <select
                    value={formData.client_type}
                    onChange={(e) => setFormData({ ...formData, client_type: e.target.value })}
                    className="input-field"
                  >
                    <option value="b2b">B2B</option>
                    <option value="b2c">B2C</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">GSTIN</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={formData.gstin}
                      onChange={(e) => setFormData({ ...formData, gstin: e.target.value.toUpperCase() })}
                      className="input-field flex-1"
                      maxLength={15}
                      placeholder="15-digit GSTIN"
                    />
                    <button
                      type="button"
                      onClick={validateGSTIN}
                      className="btn-secondary px-3"
                    >
                      Validate
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">PAN</label>
                  <input
                    type="text"
                    value={formData.pan}
                    onChange={(e) => setFormData({ ...formData, pan: e.target.value.toUpperCase() })}
                    className="input-field"
                    maxLength={10}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">State Code</label>
                  <input
                    type="text"
                    value={formData.state_code}
                    onChange={(e) => setFormData({ ...formData, state_code: e.target.value })}
                    className="input-field"
                    placeholder="e.g., 27"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Email *</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="input-field"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Phone</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="input-field"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Credit Terms (Days)</label>
                  <input
                    type="number"
                    value={formData.credit_terms_days}
                    onChange={(e) => setFormData({ ...formData, credit_terms_days: parseInt(e.target.value) || 0 })}
                    className="input-field"
                    min="0"
                  />
                </div>
              </div>

              <div>
                <h4 className="font-medium mb-2">Billing Address</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <input
                      type="text"
                      value={formData.billing_address.street}
                      onChange={(e) => setFormData({
                        ...formData,
                        billing_address: { ...formData.billing_address, street: e.target.value }
                      })}
                      className="input-field"
                      placeholder="Street Address"
                    />
                  </div>

                  <div>
                    <input
                      type="text"
                      value={formData.billing_address.city}
                      onChange={(e) => setFormData({
                        ...formData,
                        billing_address: { ...formData.billing_address, city: e.target.value }
                      })}
                      className="input-field"
                      placeholder="City"
                    />
                  </div>

                  <div>
                    <input
                      type="text"
                      value={formData.billing_address.state}
                      onChange={(e) => setFormData({
                        ...formData,
                        billing_address: { ...formData.billing_address, state: e.target.value }
                      })}
                      className="input-field"
                      placeholder="State"
                    />
                  </div>

                  <div>
                    <input
                      type="text"
                      value={formData.billing_address.postal_code}
                      onChange={(e) => setFormData({
                        ...formData,
                        billing_address: { ...formData.billing_address, postal_code: e.target.value }
                      })}
                      className="input-field"
                      placeholder="Postal Code"
                    />
                  </div>

                  <div>
                    <input
                      type="text"
                      value={formData.billing_address.country}
                      onChange={(e) => setFormData({
                        ...formData,
                        billing_address: { ...formData.billing_address, country: e.target.value }
                      })}
                      className="input-field"
                      placeholder="Country"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    resetForm();
                  }}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  {editingClient ? 'Update' : 'Create'} Client
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="flex gap-4 mb-4">
        <input
          type="text"
          placeholder="Search clients..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="input-field flex-1"
        />
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="input-field"
        >
          <option value="all">All Types</option>
          <option value="b2b">B2B</option>
          <option value="b2c">B2C</option>
        </select>
      </div>

      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <ul className="divide-y divide-gray-200">
          {filteredClients.length === 0 ? (
            <li className="px-6 py-4 text-center text-gray-500">
              No clients found
            </li>
          ) : (
            filteredClients.map((client) => (
              <li key={client.id} className="px-6 py-4 hover:bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-lg font-medium text-gray-900">
                          {client.name}
                        </h3>
                        <p className="text-sm text-gray-600">
                          {client.email} • {client.phone || 'No phone'}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          client.client_type === 'b2b'
                            ? 'text-blue-600 bg-blue-100'
                            : 'text-green-600 bg-green-100'
                        }`}>
                          {client.client_type.toUpperCase()}
                        </span>
                      </div>
                    </div>
                    <div className="mt-2 text-sm text-gray-500">
                      {client.gstin && <span>GSTIN: {client.gstin} • </span>}
                      {client.pan && <span>PAN: {client.pan} • </span>}
                      <span>Credit Terms: {client.credit_terms_days} days</span>
                    </div>
                  </div>
                  <div className="ml-4 flex items-center space-x-2">
                    <button
                      onClick={() => handleEdit(client)}
                      className="text-blue-600 hover:text-blue-700"
                      title="Edit"
                    >
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDelete(client.id)}
                      className="text-red-600 hover:text-red-700"
                      title="Delete"
                    >
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
};

export default ClientList;