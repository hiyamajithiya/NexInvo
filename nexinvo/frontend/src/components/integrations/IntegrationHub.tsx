import React, { useState, useEffect } from 'react';
import { apiClient } from '../../services/api';
import IntegrationDashboard from './IntegrationDashboard';
import IntegrationSettings from './IntegrationSettings';
import WebhookManager from './WebhookManager';

interface Integration {
  id: string;
  name: string;
  integration_type: string;
  is_active: boolean;
  configuration: Record<string, any>;
  last_sync_at: string | null;
  sync_status: string;
  error_log: string;
}

const IntegrationHub: React.FC = () => {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [showSetupModal, setShowSetupModal] = useState(false);
  const [selectedIntegrationType, setSelectedIntegrationType] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [selectedIntegrationId, setSelectedIntegrationId] = useState('');

  useEffect(() => {
    fetchIntegrations();
  }, []);

  const fetchIntegrations = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get('/api/v1/integrations/integrations/');
      setIntegrations(response.data.results || []);
    } catch (error) {
      console.error('Error fetching integrations:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSetupIntegration = (type: string) => {
    setSelectedIntegrationType(type);
    setShowSetupModal(true);
  };

  const handleTestConnection = async (integrationId: string) => {
    try {
      const response = await apiClient.post(
        `/api/v1/integrations/integrations/${integrationId}/test_connection/`
      );

      if (response.data.success) {
        alert('Connection test successful!');
      } else {
        alert(`Connection test failed: ${response.data.error}`);
      }
    } catch (error) {
      console.error('Connection test failed:', error);
      alert('Connection test failed');
    }
  };

  const handleExportToTally = async () => {
    try {
      const invoiceIds = prompt('Enter invoice IDs (comma-separated):');
      if (!invoiceIds) return;

      const response = await apiClient.post('/api/v1/integrations/tally/export/', {
        invoice_ids: invoiceIds.split(',').map(id => id.trim()),
        export_type: 'bulk'
      });

      // Trigger download
      const blob = new Blob([response.data], { type: 'application/xml' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `tally_export_${new Date().getTime()}.xml`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      alert('Tally XML exported successfully!');
    } catch (error) {
      console.error('Tally export failed:', error);
      alert('Tally export failed');
    }
  };

  const handleZohoSetup = async () => {
    try {
      const response = await apiClient.get('/api/v1/integrations/zoho/setup/');
      window.open(response.data.authorization_url, '_blank');
      alert('Please complete the authorization in the new window');
    } catch (error) {
      console.error('Zoho setup failed:', error);
      alert('Zoho setup failed');
    }
  };

  const integrationCards = [
    {
      type: 'tally',
      title: 'Tally Prime',
      description: 'Export invoices to Tally Prime format with GST compliance',
      icon: '📊',
      features: ['XML Export', 'GST Vouchers', 'Automated Mapping'],
      status: 'available',
      setupAction: () => handleExportToTally()
    },
    {
      type: 'zoho',
      title: 'Zoho Books',
      description: 'Bidirectional sync with Zoho Books for customers and invoices',
      icon: '📚',
      features: ['OAuth2 Authentication', 'Real-time Sync', 'Customer Management'],
      status: integrations.find(i => i.integration_type === 'zoho')?.is_active ? 'connected' : 'available',
      setupAction: () => handleZohoSetup()
    },
    {
      type: 'webhook',
      title: 'Automation Platforms',
      description: 'Connect with Make, Zapier, n8n and other automation tools',
      icon: '🔗',
      features: ['Webhook Triggers', 'Event-based', 'Multi-platform'],
      status: integrations.filter(i => i.integration_type === 'webhook' && i.is_active).length > 0 ? 'connected' : 'available',
      setupAction: () => handleSetupIntegration('webhook')
    },
    {
      type: 'dynamics365',
      title: 'Dynamics 365',
      description: 'Enterprise integration with Microsoft Dynamics 365',
      icon: '🏢',
      features: ['Enterprise Grade', 'Advanced Mapping', 'Real-time Updates'],
      status: 'coming_soon',
      setupAction: () => alert('Coming soon!')
    }
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected': return 'text-green-600 bg-green-100';
      case 'available': return 'text-blue-600 bg-blue-100';
      case 'coming_soon': return 'text-gray-600 bg-gray-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'connected': return 'Connected';
      case 'available': return 'Available';
      case 'coming_soon': return 'Coming Soon';
      default: return 'Unknown';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Integration Hub</h2>
        <button
          onClick={() => setShowSetupModal(true)}
          className="btn-primary"
        >
          Add Integration
        </button>
      </div>

      <div className="flex space-x-1 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`px-4 py-2 font-medium text-sm ${
            activeTab === 'dashboard'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Dashboard
        </button>
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2 font-medium text-sm ${
            activeTab === 'overview'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Overview
        </button>
        <button
          onClick={() => setActiveTab('connected')}
          className={`px-4 py-2 font-medium text-sm ${
            activeTab === 'connected'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Connected ({integrations.filter(i => i.is_active).length})
        </button>
        <button
          onClick={() => setActiveTab('webhooks')}
          className={`px-4 py-2 font-medium text-sm ${
            activeTab === 'webhooks'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Webhooks
        </button>
      </div>

      {activeTab === 'dashboard' && (
        <IntegrationDashboard />
      )}

      {activeTab === 'overview' && (
        <div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {integrationCards.map((card) => (
              <div key={card.type} className="card p-6 hover:shadow-lg transition-shadow">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center">
                    <span className="text-3xl mr-3">{card.icon}</span>
                    <div>
                      <h3 className="font-semibold text-gray-900">{card.title}</h3>
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(card.status)}`}>
                        {getStatusText(card.status)}
                      </span>
                    </div>
                  </div>
                </div>

                <p className="text-sm text-gray-600 mb-4">{card.description}</p>

                <div className="space-y-2 mb-4">
                  <h4 className="text-sm font-medium text-gray-900">Features:</h4>
                  <ul className="text-sm text-gray-600 space-y-1">
                    {card.features.map((feature, index) => (
                      <li key={index} className="flex items-center">
                        <svg className="h-4 w-4 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                        {feature}
                      </li>
                    ))}
                  </ul>
                </div>

                <button
                  onClick={card.setupAction}
                  className={`w-full py-2 px-4 rounded-md text-sm font-medium ${
                    card.status === 'connected'
                      ? 'bg-green-100 text-green-700 hover:bg-green-200'
                      : card.status === 'coming_soon'
                      ? 'bg-gray-100 text-gray-500 cursor-not-allowed'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                  disabled={card.status === 'coming_soon'}
                >
                  {card.status === 'connected' ? 'Manage' : card.status === 'coming_soon' ? 'Coming Soon' : 'Setup'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'connected' && (
        <div className="space-y-4">
          {integrations.filter(i => i.is_active).length === 0 ? (
            <div className="text-center py-12">
              <div className="text-gray-400 text-6xl mb-4">🔌</div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Connected Integrations</h3>
              <p className="text-gray-600 mb-4">Connect your favorite tools to automate your workflow</p>
              <button
                onClick={() => setShowSetupModal(true)}
                className="btn-primary"
              >
                Add First Integration
              </button>
            </div>
          ) : (
            <div className="bg-white shadow overflow-hidden sm:rounded-md">
              <ul className="divide-y divide-gray-200">
                {integrations.filter(i => i.is_active).map((integration) => (
                  <li key={integration.id} className="px-6 py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="text-lg font-medium text-gray-900">
                              {integration.name}
                            </h3>
                            <p className="text-sm text-gray-600">
                              Type: {integration.integration_type.charAt(0).toUpperCase() + integration.integration_type.slice(1)}
                            </p>
                          </div>
                          <div className="text-right">
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                              integration.sync_status === 'success'
                                ? 'text-green-600 bg-green-100'
                                : integration.sync_status === 'failed'
                                ? 'text-red-600 bg-red-100'
                                : 'text-gray-600 bg-gray-100'
                            }`}>
                              {integration.sync_status || 'Not synced'}
                            </span>
                          </div>
                        </div>
                        <div className="mt-2 text-sm text-gray-500">
                          {integration.last_sync_at && (
                            <span>Last sync: {new Date(integration.last_sync_at).toLocaleString()}</span>
                          )}
                          {integration.error_log && (
                            <div className="mt-1 text-red-600">
                              Error: {integration.error_log}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="ml-4 flex items-center space-x-2">
                        <button
                          onClick={() => handleTestConnection(integration.id)}
                          className="text-blue-600 hover:text-blue-700"
                          title="Test Connection"
                        >
                          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => {
                            setSelectedIntegrationId(integration.id);
                            setShowSettings(true);
                          }}
                          className="text-gray-600 hover:text-gray-700"
                          title="Settings"
                        >
                          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {activeTab === 'webhooks' && (
        <WebhookManager />
      )}

      {showSetupModal && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-lg w-full">
            <h3 className="text-lg font-semibold mb-4">Add Integration</h3>
            <p className="text-gray-600 mb-4">
              Choose the type of integration you want to set up.
            </p>

            <div className="space-y-3">
              {integrationCards.filter(card => card.status !== 'coming_soon').map(card => (
                <button
                  key={card.type}
                  onClick={() => {
                    card.setupAction();
                    setShowSetupModal(false);
                  }}
                  className="w-full p-4 text-left border border-gray-200 rounded-lg hover:bg-gray-50"
                >
                  <div className="flex items-center">
                    <span className="text-2xl mr-3">{card.icon}</span>
                    <div>
                      <div className="font-medium">{card.title}</div>
                      <div className="text-sm text-gray-600">{card.description}</div>
                    </div>
                  </div>
                </button>
              ))}
            </div>

            <div className="flex justify-end space-x-4 mt-6">
              <button
                onClick={() => setShowSetupModal(false)}
                className="btn-secondary"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showSettings && selectedIntegrationId && (
        <IntegrationSettings
          integrationId={selectedIntegrationId}
          onClose={() => {
            setShowSettings(false);
            setSelectedIntegrationId('');
          }}
          onSave={() => {
            fetchIntegrations();
          }}
        />
      )}
    </div>
  );
};

export default IntegrationHub;