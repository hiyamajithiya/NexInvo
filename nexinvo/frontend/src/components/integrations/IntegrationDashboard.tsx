import React, { useState, useEffect } from 'react';
import { apiClient } from '../../services/api';

interface DashboardStats {
  total_integrations: number;
  active_integrations: number;
  integrations_by_type: Record<string, {
    total: number;
    active: number;
    last_sync: string | null;
  }>;
  recent_sync_status: Record<string, any>;
  webhook_stats: {
    total_webhooks: number;
    delivered: number;
    failed: number;
    pending: number;
    delivery_rate: number;
    avg_delivery_time: number | null;
  };
}

const IntegrationDashboard: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardStats();
  }, []);

  const fetchDashboardStats = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get('/api/v1/integrations/dashboard/');
      setStats(response.data);
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="text-center py-12">
        <div className="text-gray-400 text-6xl mb-4">📊</div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">Dashboard Unavailable</h3>
        <p className="text-gray-600">Unable to load integration dashboard data</p>
      </div>
    );
  }

  const getIntegrationIcon = (type: string) => {
    switch (type) {
      case 'tally': return '📊';
      case 'zoho': return '📚';
      case 'webhook': return '🔗';
      case 'dynamics365': return '🏢';
      default: return '🔌';
    }
  };

  const getIntegrationName = (type: string) => {
    switch (type) {
      case 'tally': return 'Tally Prime';
      case 'zoho': return 'Zoho Books';
      case 'webhook': return 'Webhooks';
      case 'dynamics365': return 'Dynamics 365';
      default: return type.charAt(0).toUpperCase() + type.slice(1);
    }
  };

  return (
    <div className="space-y-6">
      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="card p-6">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-blue-100 text-blue-600">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Integrations</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.total_integrations}</p>
            </div>
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-green-100 text-green-600">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Active Integrations</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.active_integrations}</p>
            </div>
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-purple-100 text-purple-600">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4V2a1 1 0 011-1h8a1 1 0 011 1v2m-9 3v10a2 2 0 002 2h6a2 2 0 002-2V7M7 7h10M10 11v6M14 11v6" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Webhook Events</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.webhook_stats.total_webhooks}</p>
            </div>
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-yellow-100 text-yellow-600">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Delivery Rate</p>
              <p className="text-2xl font-semibold text-gray-900">
                {stats.webhook_stats.delivery_rate.toFixed(1)}%
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Integration Types Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Integrations by Type</h3>
          <div className="space-y-4">
            {Object.entries(stats.integrations_by_type).map(([type, data]) => (
              <div key={type} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center">
                  <span className="text-2xl mr-3">{getIntegrationIcon(type)}</span>
                  <div>
                    <p className="font-medium text-gray-900">{getIntegrationName(type)}</p>
                    <p className="text-sm text-gray-600">
                      {data.active} of {data.total} active
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-gray-600">
                    {data.last_sync ? (
                      <>Last sync: {new Date(data.last_sync).toLocaleDateString()}</>
                    ) : (
                      'No sync data'
                    )}
                  </div>
                  <div className={`text-sm font-medium ${
                    data.active > 0 ? 'text-green-600' : 'text-gray-400'
                  }`}>
                    {data.active > 0 ? 'Connected' : 'Not connected'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Webhook Performance</h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
              <span className="text-sm font-medium text-gray-900">Delivered</span>
              <span className="text-sm font-semibold text-green-600">
                {stats.webhook_stats.delivered}
              </span>
            </div>
            <div className="flex justify-between items-center p-3 bg-red-50 rounded-lg">
              <span className="text-sm font-medium text-gray-900">Failed</span>
              <span className="text-sm font-semibold text-red-600">
                {stats.webhook_stats.failed}
              </span>
            </div>
            <div className="flex justify-between items-center p-3 bg-yellow-50 rounded-lg">
              <span className="text-sm font-medium text-gray-900">Pending</span>
              <span className="text-sm font-semibold text-yellow-600">
                {stats.webhook_stats.pending}
              </span>
            </div>
            <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
              <span className="text-sm font-medium text-gray-900">Avg. Delivery Time</span>
              <span className="text-sm font-semibold text-blue-600">
                {stats.webhook_stats.avg_delivery_time
                  ? `${stats.webhook_stats.avg_delivery_time.toFixed(2)}s`
                  : 'N/A'
                }
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button className="flex items-center justify-center p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-primary-400 hover:bg-primary-50 transition-colors">
            <div className="text-center">
              <svg className="w-8 h-8 text-gray-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              <p className="text-sm font-medium text-gray-900">Add Integration</p>
            </div>
          </button>

          <button className="flex items-center justify-center p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-primary-400 hover:bg-primary-50 transition-colors">
            <div className="text-center">
              <svg className="w-8 h-8 text-gray-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm font-medium text-gray-900">Test Connections</p>
            </div>
          </button>

          <button className="flex items-center justify-center p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-primary-400 hover:bg-primary-50 transition-colors">
            <div className="text-center">
              <svg className="w-8 h-8 text-gray-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2v0a2 2 0 01-2-2v-2a2 2 0 00-2-2H8z" />
              </svg>
              <p className="text-sm font-medium text-gray-900">Export Data</p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};

export default IntegrationDashboard;