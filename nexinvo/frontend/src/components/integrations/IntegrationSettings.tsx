import React, { useState, useEffect } from 'react';
import { apiClient } from '../../services/api';

interface Integration {
  id: string;
  name: string;
  integration_type: string;
  is_active: boolean;
  configuration: Record<string, any>;
  credentials_encrypted: Record<string, any>;
  last_sync_at: string | null;
  sync_status: string;
  created_at: string;
}

interface IntegrationSettingsProps {
  integrationId: string;
  onClose: () => void;
  onSave: () => void;
}

const IntegrationSettings: React.FC<IntegrationSettingsProps> = ({
  integrationId,
  onClose,
  onSave
}) => {
  const [integration, setIntegration] = useState<Integration | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('general');
  const [formData, setFormData] = useState<any>({});

  useEffect(() => {
    fetchIntegration();
  }, [integrationId]);

  const fetchIntegration = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get(`/api/v1/integrations/integrations/${integrationId}/`);
      setIntegration(response.data);
      setFormData({
        name: response.data.name,
        is_active: response.data.is_active,
        configuration: { ...response.data.configuration }
      });
    } catch (error) {
      console.error('Error fetching integration:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await apiClient.patch(`/api/v1/integrations/integrations/${integrationId}/`, formData);
      onSave();
      onClose();
    } catch (error) {
      console.error('Error saving integration:', error);
      alert('Failed to save integration settings');
    } finally {
      setSaving(false);
    }
  };

  const handleConfigChange = (key: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      configuration: {
        ...prev.configuration,
        [key]: value
      }
    }));
  };

  const renderZohoSettings = () => (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Client ID
        </label>
        <input
          type="text"
          value={formData.configuration?.client_id || ''}
          onChange={(e) => handleConfigChange('client_id', e.target.value)}
          className="input-field"
          placeholder="Enter Zoho Books Client ID"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Client Secret
        </label>
        <input
          type="password"
          value={formData.configuration?.client_secret || ''}
          onChange={(e) => handleConfigChange('client_secret', e.target.value)}
          className="input-field"
          placeholder="Enter Zoho Books Client Secret"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Redirect URI
        </label>
        <input
          type="url"
          value={formData.configuration?.redirect_uri || ''}
          onChange={(e) => handleConfigChange('redirect_uri', e.target.value)}
          className="input-field"
          placeholder="https://your-app.com/callback"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Organization ID
        </label>
        <input
          type="text"
          value={formData.configuration?.organization_id || ''}
          onChange={(e) => handleConfigChange('organization_id', e.target.value)}
          className="input-field"
          placeholder="Zoho Organization ID"
        />
      </div>

      <div className="flex items-center">
        <input
          type="checkbox"
          id="auto_sync"
          checked={formData.configuration?.auto_sync || false}
          onChange={(e) => handleConfigChange('auto_sync', e.target.checked)}
          className="mr-2"
        />
        <label htmlFor="auto_sync" className="text-sm text-gray-700">
          Enable automatic synchronization
        </label>
      </div>
    </div>
  );

  const renderWebhookSettings = () => (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Webhook URL
        </label>
        <input
          type="url"
          value={formData.configuration?.webhook_url || ''}
          onChange={(e) => handleConfigChange('webhook_url', e.target.value)}
          className="input-field"
          placeholder="https://hooks.make.com/..."
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Secret Key (Optional)
        </label>
        <input
          type="password"
          value={formData.configuration?.secret_key || ''}
          onChange={(e) => handleConfigChange('secret_key', e.target.value)}
          className="input-field"
          placeholder="Enter webhook secret for verification"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Timeout (seconds)
        </label>
        <input
          type="number"
          min="1"
          max="60"
          value={formData.configuration?.timeout || 30}
          onChange={(e) => handleConfigChange('timeout', parseInt(e.target.value))}
          className="input-field"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Max Retries
        </label>
        <input
          type="number"
          min="0"
          max="10"
          value={formData.configuration?.max_retries || 5}
          onChange={(e) => handleConfigChange('max_retries', parseInt(e.target.value))}
          className="input-field"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Events to Subscribe
        </label>
        <div className="space-y-2">
          {['invoice.created', 'invoice.updated', 'invoice.paid', 'client.created', 'payment.received'].map(event => (
            <label key={event} className="flex items-center">
              <input
                type="checkbox"
                checked={formData.configuration?.enabled_events?.includes(event) || false}
                onChange={(e) => {
                  const events = formData.configuration?.enabled_events || [];
                  if (e.target.checked) {
                    handleConfigChange('enabled_events', [...events, event]);
                  } else {
                    handleConfigChange('enabled_events', events.filter(e => e !== event));
                  }
                }}
                className="mr-2"
              />
              <span className="text-sm text-gray-700">{event}</span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );

  const renderDynamics365Settings = () => (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Environment URL
        </label>
        <input
          type="url"
          value={formData.configuration?.environment_url || ''}
          onChange={(e) => handleConfigChange('environment_url', e.target.value)}
          className="input-field"
          placeholder="https://your-org.crm.dynamics.com"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Tenant ID
        </label>
        <input
          type="text"
          value={formData.configuration?.tenant_id || ''}
          onChange={(e) => handleConfigChange('tenant_id', e.target.value)}
          className="input-field"
          placeholder="Azure AD Tenant ID"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Client ID
        </label>
        <input
          type="text"
          value={formData.configuration?.client_id || ''}
          onChange={(e) => handleConfigChange('client_id', e.target.value)}
          className="input-field"
          placeholder="Application Client ID"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Client Secret
        </label>
        <input
          type="password"
          value={formData.configuration?.client_secret || ''}
          onChange={(e) => handleConfigChange('client_secret', e.target.value)}
          className="input-field"
          placeholder="Application Client Secret"
        />
      </div>

      <div className="flex items-center">
        <input
          type="checkbox"
          id="enable_advanced_mapping"
          checked={formData.configuration?.enable_advanced_mapping || false}
          onChange={(e) => handleConfigChange('enable_advanced_mapping', e.target.checked)}
          className="mr-2"
        />
        <label htmlFor="enable_advanced_mapping" className="text-sm text-gray-700">
          Enable advanced field mapping
        </label>
      </div>
    </div>
  );

  const renderTallySettings = () => (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Company Name
        </label>
        <input
          type="text"
          value={formData.configuration?.company_name || ''}
          onChange={(e) => handleConfigChange('company_name', e.target.value)}
          className="input-field"
          placeholder="Company name in Tally"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          GST Registration Type
        </label>
        <select
          value={formData.configuration?.gst_registration_type || 'regular'}
          onChange={(e) => handleConfigChange('gst_registration_type', e.target.value)}
          className="input-field"
        >
          <option value="regular">Regular</option>
          <option value="composition">Composition</option>
          <option value="unregistered">Unregistered</option>
        </select>
      </div>

      <div className="flex items-center">
        <input
          type="checkbox"
          id="include_gst_details"
          checked={formData.configuration?.include_gst_details || true}
          onChange={(e) => handleConfigChange('include_gst_details', e.target.checked)}
          className="mr-2"
        />
        <label htmlFor="include_gst_details" className="text-sm text-gray-700">
          Include GST details in export
        </label>
      </div>

      <div className="flex items-center">
        <input
          type="checkbox"
          id="auto_ledger_creation"
          checked={formData.configuration?.auto_ledger_creation || true}
          onChange={(e) => handleConfigChange('auto_ledger_creation', e.target.checked)}
          className="mr-2"
        />
        <label htmlFor="auto_ledger_creation" className="text-sm text-gray-700">
          Automatically create ledgers
        </label>
      </div>
    </div>
  );

  const renderConfigurationTab = () => {
    if (!integration) return null;

    switch (integration.integration_type) {
      case 'zoho':
        return renderZohoSettings();
      case 'webhook':
        return renderWebhookSettings();
      case 'dynamics365':
        return renderDynamics365Settings();
      case 'tally':
        return renderTallySettings();
      default:
        return (
          <div className="text-center py-8">
            <p className="text-gray-500">No configuration options available for this integration type.</p>
          </div>
        );
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 max-w-4xl w-full max-h-screen overflow-y-auto">
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!integration) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-screen overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">
              Integration Settings - {integration.name}
            </h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="flex">
          {/* Sidebar */}
          <div className="w-64 bg-gray-50 border-r border-gray-200">
            <nav className="p-4 space-y-2">
              <button
                onClick={() => setActiveTab('general')}
                className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium ${
                  activeTab === 'general'
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                General
              </button>
              <button
                onClick={() => setActiveTab('configuration')}
                className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium ${
                  activeTab === 'configuration'
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                Configuration
              </button>
              <button
                onClick={() => setActiveTab('sync')}
                className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium ${
                  activeTab === 'sync'
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                Sync History
              </button>
            </nav>
          </div>

          {/* Main Content */}
          <div className="flex-1 p-6 overflow-y-auto" style={{ maxHeight: '80vh' }}>
            {activeTab === 'general' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Integration Name
                  </label>
                  <input
                    type="text"
                    value={formData.name || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    className="input-field"
                    placeholder="Enter integration name"
                  />
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="is_active"
                    checked={formData.is_active || false}
                    onChange={(e) => setFormData(prev => ({ ...prev, is_active: e.target.checked }))}
                    className="mr-2"
                  />
                  <label htmlFor="is_active" className="text-sm text-gray-700">
                    Enable this integration
                  </label>
                </div>

                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="text-sm font-medium text-gray-900 mb-2">Integration Info</h4>
                  <dl className="space-y-2">
                    <div className="flex justify-between">
                      <dt className="text-sm text-gray-600">Type:</dt>
                      <dd className="text-sm text-gray-900">{integration.integration_type}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-sm text-gray-600">Created:</dt>
                      <dd className="text-sm text-gray-900">
                        {new Date(integration.created_at).toLocaleDateString()}
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-sm text-gray-600">Last Sync:</dt>
                      <dd className="text-sm text-gray-900">
                        {integration.last_sync_at
                          ? new Date(integration.last_sync_at).toLocaleString()
                          : 'Never'
                        }
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-sm text-gray-600">Status:</dt>
                      <dd className="text-sm text-gray-900">{integration.sync_status || 'Unknown'}</dd>
                    </div>
                  </dl>
                </div>
              </div>
            )}

            {activeTab === 'configuration' && renderConfigurationTab()}

            {activeTab === 'sync' && (
              <div className="space-y-4">
                <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
                  <h4 className="text-sm font-medium text-blue-900 mb-2">Sync History</h4>
                  <p className="text-sm text-blue-700">
                    Sync history and logs will be displayed here once the integration has been used.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end space-x-4">
          <button
            onClick={onClose}
            className="btn-secondary"
            disabled={saving}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="btn-primary"
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default IntegrationSettings;