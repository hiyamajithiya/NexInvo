import React, { useState, useEffect } from 'react';
import { apiClient } from '../../services/api';

interface WebhookEvent {
  id: string;
  event_type: string;
  entity_id: string;
  payload: Record<string, any>;
  delivery_status: string;
  delivery_attempts: number;
  response_status_code: number | null;
  response_body: string;
  error_message: string;
  created_at: string;
  last_delivery_attempt: string | null;
}

interface WebhookIntegration {
  id: string;
  name: string;
  configuration: {
    webhook_url: string;
    enabled_events: string[];
    platform?: string;
  };
  is_active: boolean;
}

const WebhookManager: React.FC = () => {
  const [webhooks, setWebhooks] = useState<WebhookIntegration[]>([]);
  const [events, setEvents] = useState<WebhookEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('webhooks');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newWebhook, setNewWebhook] = useState({
    name: '',
    webhook_url: '',
    platform: 'generic',
    enabled_events: [] as string[]
  });

  useEffect(() => {
    fetchWebhooks();
    fetchEvents();
  }, []);

  const fetchWebhooks = async () => {
    try {
      const response = await apiClient.get('/api/v1/integrations/integrations/', {
        params: { integration_type: 'webhook' }
      });
      setWebhooks(response.data.results || []);
    } catch (error) {
      console.error('Error fetching webhooks:', error);
    }
  };

  const fetchEvents = async () => {
    try {
      setLoading(true);
      // This would be a webhook events endpoint
      // For now, we'll use mock data
      setEvents([]);
    } catch (error) {
      console.error('Error fetching webhook events:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateWebhook = async () => {
    try {
      await apiClient.post('/api/v1/integrations/integrations/', {
        name: newWebhook.name,
        integration_type: 'webhook',
        configuration: {
          webhook_url: newWebhook.webhook_url,
          platform: newWebhook.platform,
          enabled_events: newWebhook.enabled_events
        },
        is_active: true
      });

      setShowCreateModal(false);
      setNewWebhook({
        name: '',
        webhook_url: '',
        platform: 'generic',
        enabled_events: []
      });
      fetchWebhooks();
    } catch (error) {
      console.error('Error creating webhook:', error);
      alert('Failed to create webhook');
    }
  };

  const handleTestWebhook = async (webhookId: string) => {
    try {
      const response = await apiClient.post(`/api/v1/integrations/integrations/${webhookId}/test_connection/`);

      if (response.data.success) {
        alert(`Webhook test successful! Status: ${response.data.status_code}`);
      } else {
        alert(`Webhook test failed: ${response.data.error}`);
      }
    } catch (error) {
      console.error('Webhook test failed:', error);
      alert('Webhook test failed');
    }
  };

  const handleTriggerTestEvent = async () => {
    try {
      await apiClient.post('/api/v1/integrations/webhooks/trigger/', {
        event_type: 'test.event',
        entity_id: 'test-123',
        entity_data: {
          message: 'This is a test webhook event',
          timestamp: new Date().toISOString()
        }
      });
      alert('Test event triggered successfully!');
      fetchEvents();
    } catch (error) {
      console.error('Failed to trigger test event:', error);
      alert('Failed to trigger test event');
    }
  };

  const handleEventChange = (event: string, checked: boolean) => {
    setNewWebhook(prev => ({
      ...prev,
      enabled_events: checked
        ? [...prev.enabled_events, event]
        : prev.enabled_events.filter(e => e !== event)
    }));
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'delivered': return 'text-green-600 bg-green-100';
      case 'failed': return 'text-red-600 bg-red-100';
      case 'pending': return 'text-yellow-600 bg-yellow-100';
      case 'retrying': return 'text-blue-600 bg-blue-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case 'make': return '🔧';
      case 'zapier': return '⚡';
      case 'n8n': return '🔀';
      default: return '🔗';
    }
  };

  const availableEvents = [
    'invoice.created',
    'invoice.updated',
    'invoice.paid',
    'client.created',
    'payment.received'
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Webhook Manager</h2>
        <div className="flex space-x-2">
          <button
            onClick={handleTriggerTestEvent}
            className="btn-secondary"
          >
            Trigger Test Event
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn-primary"
          >
            Create Webhook
          </button>
        </div>
      </div>

      <div className="flex space-x-1 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('webhooks')}
          className={`px-4 py-2 font-medium text-sm ${
            activeTab === 'webhooks'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Webhooks ({webhooks.length})
        </button>
        <button
          onClick={() => setActiveTab('events')}
          className={`px-4 py-2 font-medium text-sm ${
            activeTab === 'events'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Event Log ({events.length})
        </button>
      </div>

      {activeTab === 'webhooks' && (
        <div className="space-y-4">
          {webhooks.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-gray-400 text-6xl mb-4">🔗</div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Webhooks Configured</h3>
              <p className="text-gray-600 mb-4">Create your first webhook to start receiving events</p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="btn-primary"
              >
                Create First Webhook
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {webhooks.map((webhook) => (
                <div key={webhook.id} className="card p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center">
                      <span className="text-2xl mr-3">
                        {getPlatformIcon(webhook.configuration.platform || 'generic')}
                      </span>
                      <div>
                        <h3 className="font-semibold text-gray-900">{webhook.name}</h3>
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          webhook.is_active ? 'text-green-600 bg-green-100' : 'text-gray-600 bg-gray-100'
                        }`}>
                          {webhook.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2 mb-4">
                    <div className="text-sm">
                      <span className="font-medium text-gray-900">URL:</span>
                      <p className="text-gray-600 truncate">{webhook.configuration.webhook_url}</p>
                    </div>
                    <div className="text-sm">
                      <span className="font-medium text-gray-900">Events:</span>
                      <p className="text-gray-600">
                        {webhook.configuration.enabled_events?.length || 0} events subscribed
                      </p>
                    </div>
                  </div>

                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleTestWebhook(webhook.id)}
                      className="flex-1 py-2 px-3 text-sm font-medium text-blue-600 bg-blue-50 rounded-md hover:bg-blue-100"
                    >
                      Test
                    </button>
                    <button className="flex-1 py-2 px-3 text-sm font-medium text-gray-600 bg-gray-50 rounded-md hover:bg-gray-100">
                      Edit
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'events' && (
        <div className="space-y-4">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          ) : events.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-gray-400 text-6xl mb-4">📋</div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Events Yet</h3>
              <p className="text-gray-600">Webhook events will appear here once they start firing</p>
            </div>
          ) : (
            <div className="bg-white shadow overflow-hidden sm:rounded-md">
              <ul className="divide-y divide-gray-200">
                {events.map((event) => (
                  <li key={event.id} className="px-6 py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="text-sm font-medium text-gray-900">
                              {event.event_type}
                            </h3>
                            <p className="text-sm text-gray-600">
                              Entity ID: {event.entity_id}
                            </p>
                          </div>
                          <div className="text-right">
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(event.delivery_status)}`}>
                              {event.delivery_status}
                            </span>
                          </div>
                        </div>
                        <div className="mt-2 text-sm text-gray-500">
                          <span>Created: {new Date(event.created_at).toLocaleString()}</span>
                          {event.last_delivery_attempt && (
                            <span className="ml-4">
                              Last attempt: {new Date(event.last_delivery_attempt).toLocaleString()}
                            </span>
                          )}
                        </div>
                        <div className="mt-1 text-sm text-gray-600">
                          Attempts: {event.delivery_attempts}
                          {event.response_status_code && (
                            <span className="ml-4">Status: {event.response_status_code}</span>
                          )}
                        </div>
                        {event.error_message && (
                          <div className="mt-1 text-sm text-red-600">
                            Error: {event.error_message}
                          </div>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {showCreateModal && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-lg w-full">
            <h3 className="text-lg font-semibold mb-4">Create New Webhook</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Name</label>
                <input
                  type="text"
                  value={newWebhook.name}
                  onChange={(e) => setNewWebhook(prev => ({ ...prev, name: e.target.value }))}
                  className="input-field"
                  placeholder="Enter webhook name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Webhook URL</label>
                <input
                  type="url"
                  value={newWebhook.webhook_url}
                  onChange={(e) => setNewWebhook(prev => ({ ...prev, webhook_url: e.target.value }))}
                  className="input-field"
                  placeholder="https://hooks.make.com/..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Platform</label>
                <select
                  value={newWebhook.platform}
                  onChange={(e) => setNewWebhook(prev => ({ ...prev, platform: e.target.value }))}
                  className="input-field"
                >
                  <option value="generic">Generic Webhook</option>
                  <option value="make">Make.com</option>
                  <option value="zapier">Zapier</option>
                  <option value="n8n">n8n</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Events to Subscribe</label>
                <div className="space-y-2">
                  {availableEvents.map(event => (
                    <label key={event} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={newWebhook.enabled_events.includes(event)}
                        onChange={(e) => handleEventChange(event, e.target.checked)}
                        className="mr-2"
                      />
                      <span className="text-sm">{event}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-4 mt-6">
              <button
                onClick={() => setShowCreateModal(false)}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateWebhook}
                className="btn-primary"
                disabled={!newWebhook.name || !newWebhook.webhook_url}
              >
                Create Webhook
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WebhookManager;