import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  return (
    <div>
        <div className="px-4 py-6 sm:px-0">
          <div className="border-4 border-dashed border-gray-200 rounded-lg p-8">
            <div className="text-center">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                Welcome to NexInvo Dashboard
              </h2>
              <p className="text-gray-600 mb-6">
                Your GST-Ready Invoicing Platform is ready to use.
              </p>

              {/* User Info Card */}
              <div className="card max-w-md mx-auto p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">User Information</h3>
                <div className="space-y-2 text-left">
                  <p><span className="font-medium">Email:</span> {user?.email}</p>
                  <p><span className="font-medium">Name:</span> {user?.first_name} {user?.last_name}</p>
                  {user?.phone && <p><span className="font-medium">Phone:</span> {user.phone}</p>}
                  {user?.designation && <p><span className="font-medium">Designation:</span> {user.designation}</p>}
                  {user?.ca_registration_no && (
                    <p><span className="font-medium">CA Registration:</span> {user.ca_registration_no}</p>
                  )}
                  <p>
                    <span className="font-medium">Account Type:</span>{' '}
                    {user?.is_ca_user ? 'CA User' : 'Regular User'}
                  </p>
                  <p>
                    <span className="font-medium">2FA:</span>{' '}
                    <span className={user?.two_factor_enabled ? 'text-green-600' : 'text-gray-500'}>
                      {user?.two_factor_enabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </p>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="card p-4">
                  <h4 className="font-medium text-gray-900">Create Invoice</h4>
                  <p className="text-sm text-gray-600 mt-1">Generate GST-compliant invoices</p>
                  <button onClick={() => navigate('/invoices/new')} className="btn-primary mt-3 w-full">Create Now</button>
                </div>
                <div className="card p-4">
                  <h4 className="font-medium text-gray-900">Manage Clients</h4>
                  <p className="text-sm text-gray-600 mt-1">Add and manage your clients</p>
                  <button onClick={() => navigate('/clients')} className="btn-primary mt-3 w-full">View Clients</button>
                </div>
                <div className="card p-4">
                  <h4 className="font-medium text-gray-900">Reports</h4>
                  <p className="text-sm text-gray-600 mt-1">Generate GSTR reports</p>
                  <button onClick={() => navigate('/reports')} className="btn-primary mt-3 w-full">View Reports</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;