import React, { useState } from 'react';

const PlatformSettings: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'general' | 'security' | 'notifications' | 'system' | 'integrations'>('general');

  // General Settings
  const [generalSettings, setGeneralSettings] = useState({
    platform_name: 'NexInvo',
    platform_description: 'GST Invoice Management Platform',
    maintenance_mode: false,
    registration_enabled: true,
    default_subscription: 'starter',
    time_zone: 'Asia/Kolkata',
    currency: 'INR',
    language: 'en'
  });

  // Security Settings
  const [securitySettings, setSecuritySettings] = useState({
    session_timeout: 30,
    password_min_length: 8,
    require_two_factor: false,
    login_attempts: 5,
    lockout_duration: 30,
    password_expiry: 90,
    enforce_https: true
  });

  // Notification Settings
  const [notificationSettings, setNotificationSettings] = useState({
    email_notifications: true,
    sms_notifications: false,
    system_alerts: true,
    user_registration_notify: true,
    payment_notifications: true,
    maintenance_alerts: true,
    daily_reports: false
  });

  // System Settings
  const [systemSettings, setSystemSettings] = useState({
    backup_frequency: 'daily',
    backup_retention: 30,
    max_file_size: 10,
    max_users_per_tenant: 50,
    api_rate_limit: 1000,
    log_level: 'info',
    cache_duration: 24
  });

  // Integration Settings
  const [integrationSettings, setIntegrationSettings] = useState({
    razorpay_enabled: true,
    stripe_enabled: false,
    gstn_api_enabled: true,
    email_provider: 'sendgrid',
    sms_provider: 'twilio',
    storage_provider: 'aws_s3',
    cdn_enabled: true
  });

  const handleSave = (tab: string) => {
    console.log(`Saving ${tab} settings...`);
    // Implement save logic here
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Platform Settings</h1>
        <p className="text-gray-600 text-sm mt-1">Configure global platform settings and preferences</p>
      </div>

      {/* Tabs */}
      <div className="mb-6">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-6">
            {[
              { key: 'general', label: 'General', icon: '⚙️' },
              { key: 'security', label: 'Security', icon: '🔒' },
              { key: 'notifications', label: 'Notifications', icon: '🔔' },
              { key: 'system', label: 'System', icon: '🖥️' },
              { key: 'integrations', label: 'Integrations', icon: '🔗' }
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                className={`flex items-center space-x-2 py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.key
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* General Settings Tab */}
      {activeTab === 'general' && (
        <div className="bg-white rounded-lg shadow border border-gray-100 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">General Settings</h3>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Platform Name</label>
              <input
                type="text"
                value={generalSettings.platform_name}
                onChange={(e) => setGeneralSettings({ ...generalSettings, platform_name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Default Subscription</label>
              <select
                value={generalSettings.default_subscription}
                onChange={(e) => setGeneralSettings({ ...generalSettings, default_subscription: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="starter">Starter</option>
                <option value="professional">Professional</option>
                <option value="enterprise">Enterprise</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Time Zone</label>
              <select
                value={generalSettings.time_zone}
                onChange={(e) => setGeneralSettings({ ...generalSettings, time_zone: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="Asia/Kolkata">Asia/Kolkata</option>
                <option value="UTC">UTC</option>
                <option value="America/New_York">America/New_York</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
              <select
                value={generalSettings.currency}
                onChange={(e) => setGeneralSettings({ ...generalSettings, currency: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="INR">INR - Indian Rupee</option>
                <option value="USD">USD - US Dollar</option>
                <option value="EUR">EUR - Euro</option>
              </select>
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Platform Description</label>
            <textarea
              value={generalSettings.platform_description}
              onChange={(e) => setGeneralSettings({ ...generalSettings, platform_description: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div>
                <h4 className="font-medium text-gray-900">Maintenance Mode</h4>
                <p className="text-xs text-gray-600">Disable user access during updates</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={generalSettings.maintenance_mode}
                  onChange={(e) => setGeneralSettings({ ...generalSettings, maintenance_mode: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
              </label>
            </div>

            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div>
                <h4 className="font-medium text-gray-900">User Registration</h4>
                <p className="text-xs text-gray-600">Allow new user signups</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={generalSettings.registration_enabled}
                  onChange={(e) => setGeneralSettings({ ...generalSettings, registration_enabled: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
              </label>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              onClick={() => handleSave('general')}
              className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 text-sm"
            >
              Save General Settings
            </button>
          </div>
        </div>
      )}

      {/* Security Settings Tab */}
      {activeTab === 'security' && (
        <div className="bg-white rounded-lg shadow border border-gray-100 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Security Settings</h3>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Session Timeout (minutes)</label>
              <input
                type="number"
                value={securitySettings.session_timeout}
                onChange={(e) => setSecuritySettings({ ...securitySettings, session_timeout: parseInt(e.target.value) || 30 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password Min Length</label>
              <input
                type="number"
                value={securitySettings.password_min_length}
                onChange={(e) => setSecuritySettings({ ...securitySettings, password_min_length: parseInt(e.target.value) || 8 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Login Attempts Limit</label>
              <input
                type="number"
                value={securitySettings.login_attempts}
                onChange={(e) => setSecuritySettings({ ...securitySettings, login_attempts: parseInt(e.target.value) || 5 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Lockout Duration (minutes)</label>
              <input
                type="number"
                value={securitySettings.lockout_duration}
                onChange={(e) => setSecuritySettings({ ...securitySettings, lockout_duration: parseInt(e.target.value) || 30 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div>
                <h4 className="font-medium text-gray-900">Require Two-Factor Auth</h4>
                <p className="text-xs text-gray-600">Mandatory 2FA for all users</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={securitySettings.require_two_factor}
                  onChange={(e) => setSecuritySettings({ ...securitySettings, require_two_factor: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
              </label>
            </div>

            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div>
                <h4 className="font-medium text-gray-900">Enforce HTTPS</h4>
                <p className="text-xs text-gray-600">Redirect all HTTP to HTTPS</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={securitySettings.enforce_https}
                  onChange={(e) => setSecuritySettings({ ...securitySettings, enforce_https: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
              </label>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              onClick={() => handleSave('security')}
              className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 text-sm"
            >
              Save Security Settings
            </button>
          </div>
        </div>
      )}

      {/* Notifications Tab */}
      {activeTab === 'notifications' && (
        <div className="bg-white rounded-lg shadow border border-gray-100 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Notification Settings</h3>

          <div className="grid grid-cols-2 gap-4 mb-6">
            {Object.entries({
              'Email Notifications': 'email_notifications',
              'SMS Notifications': 'sms_notifications',
              'System Alerts': 'system_alerts',
              'User Registration Alerts': 'user_registration_notify',
              'Payment Notifications': 'payment_notifications',
              'Maintenance Alerts': 'maintenance_alerts'
            }).map(([label, key]) => (
              <div key={key} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <h4 className="font-medium text-gray-900">{label}</h4>
                  <p className="text-xs text-gray-600">Enable {label.toLowerCase()}</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={notificationSettings[key as keyof typeof notificationSettings]}
                    onChange={(e) => setNotificationSettings({ ...notificationSettings, [key]: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                </label>
              </div>
            ))}
          </div>

          <div className="flex justify-end">
            <button
              onClick={() => handleSave('notifications')}
              className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 text-sm"
            >
              Save Notification Settings
            </button>
          </div>
        </div>
      )}

      {/* System Tab */}
      {activeTab === 'system' && (
        <div className="bg-white rounded-lg shadow border border-gray-100 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">System Settings</h3>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Backup Frequency</label>
              <select
                value={systemSettings.backup_frequency}
                onChange={(e) => setSystemSettings({ ...systemSettings, backup_frequency: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="hourly">Hourly</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Backup Retention (days)</label>
              <input
                type="number"
                value={systemSettings.backup_retention}
                onChange={(e) => setSystemSettings({ ...systemSettings, backup_retention: parseInt(e.target.value) || 30 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Max File Size (MB)</label>
              <input
                type="number"
                value={systemSettings.max_file_size}
                onChange={(e) => setSystemSettings({ ...systemSettings, max_file_size: parseInt(e.target.value) || 10 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">API Rate Limit (per hour)</label>
              <input
                type="number"
                value={systemSettings.api_rate_limit}
                onChange={(e) => setSystemSettings({ ...systemSettings, api_rate_limit: parseInt(e.target.value) || 1000 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="p-3 bg-blue-50 rounded-lg text-center">
              <h4 className="font-medium text-blue-900">Version</h4>
              <p className="text-lg font-bold text-blue-800">v2.1.0</p>
            </div>
            <div className="p-3 bg-green-50 rounded-lg text-center">
              <h4 className="font-medium text-green-900">Database</h4>
              <p className="text-lg font-bold text-green-800">Healthy</p>
            </div>
            <div className="p-3 bg-purple-50 rounded-lg text-center">
              <h4 className="font-medium text-purple-900">Uptime</h4>
              <p className="text-lg font-bold text-purple-800">24.5h</p>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              onClick={() => handleSave('system')}
              className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 text-sm"
            >
              Save System Settings
            </button>
          </div>
        </div>
      )}

      {/* Integrations Tab */}
      {activeTab === 'integrations' && (
        <div className="bg-white rounded-lg shadow border border-gray-100 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Integration Settings</h3>

          <div className="grid grid-cols-2 gap-4 mb-6">
            {Object.entries({
              'Razorpay Payment Gateway': 'razorpay_enabled',
              'Stripe Payment Gateway': 'stripe_enabled',
              'GSTN API Integration': 'gstn_api_enabled',
              'CDN Service': 'cdn_enabled'
            }).map(([label, key]) => (
              <div key={key} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <h4 className="font-medium text-gray-900">{label}</h4>
                  <p className="text-xs text-gray-600">Enable {label.toLowerCase()}</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={integrationSettings[key as keyof typeof integrationSettings]}
                    onChange={(e) => setIntegrationSettings({ ...integrationSettings, [key]: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                </label>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email Provider</label>
              <select
                value={integrationSettings.email_provider}
                onChange={(e) => setIntegrationSettings({ ...integrationSettings, email_provider: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="sendgrid">SendGrid</option>
                <option value="mailgun">Mailgun</option>
                <option value="ses">Amazon SES</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">SMS Provider</label>
              <select
                value={integrationSettings.sms_provider}
                onChange={(e) => setIntegrationSettings({ ...integrationSettings, sms_provider: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="twilio">Twilio</option>
                <option value="textlocal">TextLocal</option>
                <option value="msg91">MSG91</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              onClick={() => handleSave('integrations')}
              className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 text-sm"
            >
              Save Integration Settings
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default PlatformSettings;