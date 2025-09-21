import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';

interface EInvoiceDetails {
  invoice_id: string;
  invoice_number: string;
  status: string;
  irn: string;
  ack_no: string;
  ack_date: string;
  qr_code_image: string;
  error_details?: string;
  cancellation_date?: string;
  cancellation_reason?: string;
  created_at: string;
}

interface EInvoiceSummary {
  total_einvoices: number;
  generated: number;
  cancelled: number;
  failed: number;
  pending: number;
  success_rate: number;
}

interface CancellationReason {
  code: string;
  description: string;
}

const EInvoiceManagement: React.FC = () => {
  const { token } = useAuth();
  const [activeTab, setActiveTab] = useState<'overview' | 'invoices' | 'qr-codes' | 'bulk'>('overview');
  const [summary, setSummary] = useState<EInvoiceSummary | null>(null);
  const [recentEInvoices, setRecentEInvoices] = useState<EInvoiceDetails[]>([]);
  const [cancellationReasons, setCancellationReasons] = useState<CancellationReason[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedInvoices, setSelectedInvoices] = useState<string[]>([]);

  // Modal states
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<string | null>(null);

  // Form states
  const [cancelForm, setCancelForm] = useState({
    reason_code: '4',
    remarks: ''
  });

  const [qrForm, setQRForm] = useState({
    payment_method: 'upi',
    template_name: 'standard_invoice',
    expiry_hours: 24
  });

  useEffect(() => {
    loadEInvoiceSummary();
    loadCancellationReasons();
  }, []);

  const loadEInvoiceSummary = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/einvoice/summary/', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setSummary(data.summary);
        setRecentEInvoices(data.recent_einvoices);
      }
    } catch (error) {
      console.error('Failed to load e-Invoice summary:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadCancellationReasons = async () => {
    try {
      const response = await fetch('/api/einvoice/cancellation-reasons/', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setCancellationReasons(data.reasons);
      }
    } catch (error) {
      console.error('Failed to load cancellation reasons:', error);
    }
  };

  const generateEInvoice = async (invoiceId: string) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/einvoice/generate/${invoiceId}/`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (response.ok) {
        alert('e-Invoice generated successfully!');
        loadEInvoiceSummary();
        setShowGenerateModal(false);
      } else {
        alert(`Failed to generate e-Invoice: ${data.error}`);
      }
    } catch (error) {
      console.error('e-Invoice generation failed:', error);
      alert('Failed to generate e-Invoice');
    } finally {
      setLoading(false);
    }
  };

  const cancelEInvoice = async () => {
    if (!selectedInvoice) return;

    try {
      setLoading(true);
      const response = await fetch(`/api/einvoice/cancel/${selectedInvoice}/`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(cancelForm),
      });

      const data = await response.json();

      if (response.ok) {
        alert('e-Invoice cancelled successfully!');
        loadEInvoiceSummary();
        setShowCancelModal(false);
        setCancelForm({ reason_code: '4', remarks: '' });
      } else {
        alert(`Failed to cancel e-Invoice: ${data.error}`);
      }
    } catch (error) {
      console.error('e-Invoice cancellation failed:', error);
      alert('Failed to cancel e-Invoice');
    } finally {
      setLoading(false);
    }
  };

  const generateQRCode = async () => {
    if (!selectedInvoice) return;

    try {
      setLoading(true);
      const response = await fetch(`/api/qr/generate/${selectedInvoice}/`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(qrForm),
      });

      const data = await response.json();

      if (response.ok) {
        alert('QR Code generated successfully!');
        setShowQRModal(false);
        setQRForm({ payment_method: 'upi', template_name: 'standard_invoice', expiry_hours: 24 });
      } else {
        alert(`Failed to generate QR Code: ${data.error}`);
      }
    } catch (error) {
      console.error('QR Code generation failed:', error);
      alert('Failed to generate QR Code');
    } finally {
      setLoading(false);
    }
  };

  const bulkOperation = async (operation: 'generate' | 'cancel') => {
    if (selectedInvoices.length === 0) {
      alert('Please select invoices for bulk operation');
      return;
    }

    try {
      setLoading(true);
      const payload: any = {
        invoice_ids: selectedInvoices,
        operation: operation
      };

      if (operation === 'cancel') {
        payload.cancel_reason = cancelForm.reason_code;
        payload.cancel_remarks = cancelForm.remarks || 'Bulk cancellation';
      }

      const response = await fetch('/api/einvoice/bulk/', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (response.ok) {
        alert(`Bulk ${operation} completed! Successful: ${data.successful}, Failed: ${data.failed}`);
        setSelectedInvoices([]);
        loadEInvoiceSummary();
      } else {
        alert(`Bulk operation failed: ${data.error}`);
      }
    } catch (error) {
      console.error('Bulk operation failed:', error);
      alert('Bulk operation failed');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusColors = {
      'generated': 'bg-green-100 text-green-800',
      'cancelled': 'bg-red-100 text-red-800',
      'failed': 'bg-red-100 text-red-800',
      'pending': 'bg-yellow-100 text-yellow-800',
      'not_generated': 'bg-gray-100 text-gray-800'
    };

    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusColors[status] || 'bg-gray-100 text-gray-800'}`}>
        {status.replace('_', ' ').toUpperCase()}
      </span>
    );
  };

  const renderOverviewTab = () => (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-sm font-medium text-gray-500">Total e-Invoices</h3>
          <p className="text-2xl font-bold text-gray-900">{summary?.total_einvoices || 0}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-sm font-medium text-gray-500">Generated</h3>
          <p className="text-2xl font-bold text-green-600">{summary?.generated || 0}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-sm font-medium text-gray-500">Cancelled</h3>
          <p className="text-2xl font-bold text-red-600">{summary?.cancelled || 0}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-sm font-medium text-gray-500">Failed</h3>
          <p className="text-2xl font-bold text-red-600">{summary?.failed || 0}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-sm font-medium text-gray-500">Success Rate</h3>
          <p className="text-2xl font-bold text-blue-600">{summary?.success_rate || 0}%</p>
        </div>
      </div>

      {/* Recent e-Invoices */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Recent e-Invoices</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Invoice
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  IRN
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {recentEInvoices.map((einvoice) => (
                <tr key={einvoice.invoice_id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {einvoice.invoice_number}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {einvoice.irn || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {getStatusBadge(einvoice.status)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(einvoice.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <div className="flex space-x-2">
                      {einvoice.status === 'not_generated' && (
                        <button
                          onClick={() => {
                            setSelectedInvoice(einvoice.invoice_id);
                            setShowGenerateModal(true);
                          }}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          Generate
                        </button>
                      )}
                      {einvoice.status === 'generated' && (
                        <button
                          onClick={() => {
                            setSelectedInvoice(einvoice.invoice_id);
                            setShowCancelModal(true);
                          }}
                          className="text-red-600 hover:text-red-900"
                        >
                          Cancel
                        </button>
                      )}
                      <button
                        onClick={() => {
                          setSelectedInvoice(einvoice.invoice_id);
                          setShowQRModal(true);
                        }}
                        className="text-green-600 hover:text-green-900"
                      >
                        QR Code
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderBulkTab = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Bulk Operations</h3>

        {/* Invoice Selection */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select Invoices
          </label>
          <div className="grid grid-cols-3 gap-2">
            {recentEInvoices.map((invoice) => (
              <label key={invoice.invoice_id} className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={selectedInvoices.includes(invoice.invoice_id)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedInvoices([...selectedInvoices, invoice.invoice_id]);
                    } else {
                      setSelectedInvoices(selectedInvoices.filter(id => id !== invoice.invoice_id));
                    }
                  }}
                  className="rounded border-gray-300"
                />
                <span className="text-sm text-gray-700">{invoice.invoice_number}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Bulk Actions */}
        <div className="flex space-x-4">
          <button
            onClick={() => bulkOperation('generate')}
            disabled={selectedInvoices.length === 0 || loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            Bulk Generate e-Invoice
          </button>
          <button
            onClick={() => bulkOperation('cancel')}
            disabled={selectedInvoices.length === 0 || loading}
            className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
          >
            Bulk Cancel e-Invoice
          </button>
        </div>

        {selectedInvoices.length > 0 && (
          <div className="mt-4 p-3 bg-blue-50 rounded-md">
            <p className="text-sm text-blue-700">
              {selectedInvoices.length} invoice(s) selected for bulk operation
            </p>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">e-Invoice Management</h1>
        <p className="mt-2 text-gray-600">
          Manage GST e-Invoices, QR codes, and compliance workflows
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 mb-8">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'overview', label: 'Overview', icon: '📊' },
            { id: 'invoices', label: 'e-Invoices', icon: '📄' },
            { id: 'qr-codes', label: 'QR Codes', icon: '📱' },
            { id: 'bulk', label: 'Bulk Operations', icon: '⚡' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <span className="mr-2">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {loading && (
        <div className="flex justify-center items-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      )}

      {!loading && (
        <>
          {activeTab === 'overview' && renderOverviewTab()}
          {activeTab === 'bulk' && renderBulkTab()}
          {/* Other tabs would be implemented similarly */}
        </>
      )}

      {/* Generate e-Invoice Modal */}
      {showGenerateModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Generate e-Invoice</h3>
            <p className="text-sm text-gray-600 mb-6">
              This will generate an e-Invoice and submit it to the IRP portal.
            </p>
            <div className="flex justify-end space-x-4">
              <button
                onClick={() => setShowGenerateModal(false)}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
              >
                Cancel
              </button>
              <button
                onClick={() => selectedInvoice && generateEInvoice(selectedInvoice)}
                disabled={loading}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                Generate
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel e-Invoice Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Cancel e-Invoice</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Cancellation Reason
                </label>
                <select
                  value={cancelForm.reason_code}
                  onChange={(e) => setCancelForm({ ...cancelForm, reason_code: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                >
                  {cancellationReasons.map((reason) => (
                    <option key={reason.code} value={reason.code}>
                      {reason.description}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Remarks
                </label>
                <textarea
                  value={cancelForm.remarks}
                  onChange={(e) => setCancelForm({ ...cancelForm, remarks: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  rows={3}
                  placeholder="Enter cancellation remarks..."
                />
              </div>
            </div>
            <div className="flex justify-end space-x-4 mt-6">
              <button
                onClick={() => setShowCancelModal(false)}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
              >
                Cancel
              </button>
              <button
                onClick={cancelEInvoice}
                disabled={loading}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
              >
                Cancel e-Invoice
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QR Code Modal */}
      {showQRModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Generate Payment QR Code</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Payment Method
                </label>
                <select
                  value={qrForm.payment_method}
                  onChange={(e) => setQRForm({ ...qrForm, payment_method: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="upi">UPI</option>
                  <option value="card">Credit/Debit Card</option>
                  <option value="netbanking">Net Banking</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Template
                </label>
                <select
                  value={qrForm.template_name}
                  onChange={(e) => setQRForm({ ...qrForm, template_name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="standard_invoice">Standard Invoice</option>
                  <option value="minimal_invoice">Minimal Invoice</option>
                  <option value="professional_invoice">Professional Invoice</option>
                  <option value="compact_invoice">Compact Invoice</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Expiry Hours
                </label>
                <input
                  type="number"
                  value={qrForm.expiry_hours}
                  onChange={(e) => setQRForm({ ...qrForm, expiry_hours: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  min="1"
                  max="168"
                />
              </div>
            </div>
            <div className="flex justify-end space-x-4 mt-6">
              <button
                onClick={() => setShowQRModal(false)}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
              >
                Cancel
              </button>
              <button
                onClick={generateQRCode}
                disabled={loading}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
              >
                Generate QR Code
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EInvoiceManagement;