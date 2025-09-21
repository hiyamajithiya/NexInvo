import React, { useState, useEffect } from 'react';
import { apiClient } from '../../services/api';

interface DashboardStats {
  total_invoices: number;
  pending_payment: number;
  paid_invoices: number;
  overdue_invoices: number;
  total_amount: number;
  pending_amount: number;
  this_month_count: number;
  this_month_amount: number;
}

interface ComplianceInfo {
  standard_rates: {
    gst_rates: number[];
    cgst_sgst_rates: number[];
    igst_rates: number[];
  };
  special_rates: {
    petroleum: number;
    luxury_goods: number;
    essential_items: number;
    books: number;
  };
  cess_applicable: string[];
  aato_threshold: number;
  rule_46_mandatory_fields: string[];
}

const Reports: React.FC = () => {
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);
  const [complianceInfo, setComplianceInfo] = useState<ComplianceInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [dateRange, setDateRange] = useState({
    start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [statsResponse, complianceResponse] = await Promise.all([
        apiClient.get('/api/v1/invoices/invoices/dashboard_stats/'),
        apiClient.get('/api/v1/invoices/gst_rates_info/')
      ]);

      setDashboardStats(statsResponse.data);
      setComplianceInfo(complianceResponse.data);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const exportGSTR = async (type: 'gstr1' | 'gstr3b') => {
    try {
      const response = await apiClient.get('/api/v1/invoices/gstr/export/', {
        params: {
          type,
          start_date: dateRange.start,
          end_date: dateRange.end
        },
        responseType: 'blob'
      });

      const blob = new Blob([response.data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${type.toUpperCase()}_${dateRange.start}_${dateRange.end}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      alert(`${type.toUpperCase()} exported successfully!`);
    } catch (error) {
      console.error('Error exporting GSTR:', error);
      alert('Failed to export GSTR data');
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Reports & Compliance</h2>

      <div className="flex space-x-1 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`px-4 py-2 font-medium text-sm ${
            activeTab === 'dashboard'
              ? 'text-primary-600 border-b-2 border-primary-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Dashboard
        </button>
        <button
          onClick={() => setActiveTab('gst')}
          className={`px-4 py-2 font-medium text-sm ${
            activeTab === 'gst'
              ? 'text-primary-600 border-b-2 border-primary-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          GST Returns
        </button>
        <button
          onClick={() => setActiveTab('compliance')}
          className={`px-4 py-2 font-medium text-sm ${
            activeTab === 'compliance'
              ? 'text-primary-600 border-b-2 border-primary-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Compliance Info
        </button>
      </div>

      {activeTab === 'dashboard' && dashboardStats && (
        <div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="card p-6">
              <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide">Total Invoices</h3>
              <p className="mt-2 text-3xl font-semibold text-gray-900">{dashboardStats.total_invoices}</p>
              <p className="mt-1 text-sm text-gray-600">This month: {dashboardStats.this_month_count}</p>
            </div>

            <div className="card p-6">
              <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide">Total Revenue</h3>
              <p className="mt-2 text-3xl font-semibold text-gray-900">
                {formatCurrency(dashboardStats.total_amount)}
              </p>
              <p className="mt-1 text-sm text-gray-600">
                This month: {formatCurrency(dashboardStats.this_month_amount)}
              </p>
            </div>

            <div className="card p-6">
              <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide">Pending Payments</h3>
              <p className="mt-2 text-3xl font-semibold text-yellow-600">{dashboardStats.pending_payment}</p>
              <p className="mt-1 text-sm text-gray-600">
                Amount: {formatCurrency(dashboardStats.pending_amount)}
              </p>
            </div>

            <div className="card p-6">
              <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide">Overdue Invoices</h3>
              <p className="mt-2 text-3xl font-semibold text-red-600">{dashboardStats.overdue_invoices}</p>
              <p className="mt-1 text-sm text-gray-600">Requires attention</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="card p-6">
              <h3 className="text-lg font-semibold mb-4">Payment Status Overview</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Paid</span>
                  <div className="flex items-center space-x-2">
                    <div className="w-32 bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-green-600 h-2 rounded-full"
                        style={{ width: `${(dashboardStats.paid_invoices / dashboardStats.total_invoices) * 100}%` }}
                      ></div>
                    </div>
                    <span className="text-sm text-gray-600">{dashboardStats.paid_invoices}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Pending</span>
                  <div className="flex items-center space-x-2">
                    <div className="w-32 bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-yellow-600 h-2 rounded-full"
                        style={{ width: `${(dashboardStats.pending_payment / dashboardStats.total_invoices) * 100}%` }}
                      ></div>
                    </div>
                    <span className="text-sm text-gray-600">{dashboardStats.pending_payment}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Overdue</span>
                  <div className="flex items-center space-x-2">
                    <div className="w-32 bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-red-600 h-2 rounded-full"
                        style={{ width: `${(dashboardStats.overdue_invoices / dashboardStats.total_invoices) * 100}%` }}
                      ></div>
                    </div>
                    <span className="text-sm text-gray-600">{dashboardStats.overdue_invoices}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="card p-6">
              <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
              <div className="space-y-3">
                <button
                  onClick={() => window.location.href = '/invoices'}
                  className="w-full btn-secondary text-left"
                >
                  View All Invoices
                </button>
                <button
                  onClick={() => window.location.href = '/invoices/new'}
                  className="w-full btn-primary text-left"
                >
                  Create New Invoice
                </button>
                <button
                  onClick={() => setActiveTab('gst')}
                  className="w-full btn-secondary text-left"
                >
                  Generate GST Returns
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'gst' && (
        <div className="card p-6">
          <h3 className="text-lg font-semibold mb-4">GST Returns Export</h3>

          <div className="space-y-4">
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="block text-sm font-medium mb-1">Start Date</label>
                <input
                  type="date"
                  value={dateRange.start}
                  onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                  className="input-field"
                />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium mb-1">End Date</label>
                <input
                  type="date"
                  value={dateRange.end}
                  onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                  className="input-field"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="card p-4 border border-gray-200">
                <h4 className="font-medium mb-2">GSTR-1 (Sales)</h4>
                <p className="text-sm text-gray-600 mb-4">
                  Export all outward supplies for filing GSTR-1 return
                </p>
                <button
                  onClick={() => exportGSTR('gstr1')}
                  className="btn-primary w-full"
                >
                  Export GSTR-1
                </button>
              </div>

              <div className="card p-4 border border-gray-200">
                <h4 className="font-medium mb-2">GSTR-3B (Summary)</h4>
                <p className="text-sm text-gray-600 mb-4">
                  Export summary for filing GSTR-3B return
                </p>
                <button
                  onClick={() => exportGSTR('gstr3b')}
                  className="btn-primary w-full"
                >
                  Export GSTR-3B
                </button>
              </div>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
              <h4 className="text-sm font-medium text-yellow-800">Important Notes:</h4>
              <ul className="mt-2 text-sm text-yellow-700 list-disc list-inside">
                <li>Ensure all invoices are finalized before export</li>
                <li>Verify GSTIN details for all B2B transactions</li>
                <li>Check HSN/SAC codes comply with AATO requirements</li>
                <li>Review exported data before filing on GST portal</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'compliance' && complianceInfo && (
        <div className="space-y-6">
          <div className="card p-6">
            <h3 className="text-lg font-semibold mb-4">GST Rate Information</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-medium mb-2">Standard GST Rates</h4>
                <div className="space-y-1">
                  {complianceInfo.standard_rates.gst_rates.map(rate => (
                    <div key={rate} className="flex justify-between text-sm">
                      <span>GST @ {rate}%</span>
                      <span className="text-gray-500">
                        CGST: {rate / 2}% + SGST: {rate / 2}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="font-medium mb-2">Special Category Rates</h4>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>Petroleum Products</span>
                    <span>{complianceInfo.special_rates.petroleum}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Luxury Goods</span>
                    <span>{complianceInfo.special_rates.luxury_goods}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Essential Items</span>
                    <span>{complianceInfo.special_rates.essential_items}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Books & Printed Materials</span>
                    <span>{complianceInfo.special_rates.books}%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="card p-6">
            <h3 className="text-lg font-semibold mb-4">Compliance Requirements</h3>

            <div className="space-y-4">
              <div>
                <h4 className="font-medium mb-2">AATO Threshold</h4>
                <p className="text-sm text-gray-600">
                  Annual Aggregate Turnover (AATO) threshold: {formatCurrency(complianceInfo.aato_threshold)}
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  HSN code becomes mandatory for all items when turnover exceeds this limit
                </p>
              </div>

              <div>
                <h4 className="font-medium mb-2">Cess Applicable Categories</h4>
                <div className="flex flex-wrap gap-2 mt-2">
                  {complianceInfo.cess_applicable.map(category => (
                    <span key={category} className="px-3 py-1 text-sm bg-gray-100 rounded-full">
                      {category.replace(/_/g, ' ').toUpperCase()}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="font-medium mb-2">Rule 46 Mandatory Fields</h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2">
                  {complianceInfo.rule_46_mandatory_fields.map(field => (
                    <div key={field} className="text-sm text-gray-600">
                      ✓ {field.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="card p-6 bg-blue-50 border border-blue-200">
            <h3 className="text-lg font-semibold mb-2 text-blue-900">Compliance Status</h3>
            <div className="space-y-2 text-sm">
              <div className="flex items-center text-green-700">
                <svg className="h-5 w-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                GST Rule-46 compliant invoice format
              </div>
              <div className="flex items-center text-green-700">
                <svg className="h-5 w-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                HSN/SAC validation enabled
              </div>
              <div className="flex items-center text-green-700">
                <svg className="h-5 w-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                Automatic GST calculation based on place of supply
              </div>
              <div className="flex items-center text-green-700">
                <svg className="h-5 w-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                Complete audit trail maintenance
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Reports;