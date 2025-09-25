import React, { useState, useEffect } from 'react';
import { useBusinessConfig } from '../../hooks/useBusinessConfig';
import { apiClient } from '../../services/api';

interface Client {
  id: string;
  name: string;
  gstin: string;
  state_code: string;
  email: string;
  [key: string]: any;
}

interface Item {
  id: string;
  name: string;
  item_code: string;
  hsn_sac: string;
  current_gst_rate: number;
  default_rate: number;
  is_service: boolean;
  [key: string]: any;
}

interface BusinessSpecificInvoiceLine {
  item_id?: string;
  description: string;
  hsn_sac: string;
  quantity: number;
  rate: number;
  discount_percent: number;
  discount_amount: number;
  taxable_value: number;
  cgst_rate: number;
  sgst_rate: number;
  igst_rate: number;
  cess_rate: number;
  cgst_amount: number;
  sgst_amount: number;
  igst_amount: number;
  cess_amount: number;
  line_total: number;
  // Business-specific fields
  batch_no?: string;
  work_order_no?: string;
  project_component?: string;
  milestone?: string;
  labour_charges?: number;
  material_charges?: number;
  overtime_hours?: number;
  designation?: string;
  technology?: string;
  hourly_rate?: number;
  [key: string]: any;
}

const BusinessSpecificInvoiceForm: React.FC = () => {
  const { businessConfig, currentTenant, loading: configLoading } = useBusinessConfig();
  const [clients, setClients] = useState<Client[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);

  // Base form data
  const [formData, setFormData] = useState({
    client_id: '',
    invoice_type: 'taxable',
    series: getInvoiceSeries(),
    date: new Date().toISOString().split('T')[0],
    due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    place_of_supply: '',
    currency: 'INR',
    notes: '',
    terms_conditions: getDefaultTerms(),
    // Business-specific fields
    project_name: '',
    contract_no: '',
    work_order_no: '',
    milestone: '',
    po_number: '',
    delivery_date: '',
    transport_mode: '',
    vehicle_number: '',
    retention_percent: 0,
    advance_amount: 0,
    tds_percent: 0,
    performance_guarantee: 0,
  });

  const [invoiceLines, setInvoiceLines] = useState<BusinessSpecificInvoiceLine[]>([
    getDefaultInvoiceLine()
  ]);

  function getInvoiceSeries() {
    if (!businessConfig) return 'INV';

    const seriesMap: Record<string, string> = {
      service_based: 'SRV',
      goods_based: 'SAL',
      manufacturing: 'MFG',
      contract_based: 'WRK',
      epc_project: 'EPC',
      manpower_supply: 'MAN',
      it_services: 'IT',
    };

    return seriesMap[businessConfig.invoice_format] || 'INV';
  }

  function getDefaultTerms() {
    if (!businessConfig) return 'Payment within 30 days of invoice date.';

    const termsMap: Record<string, string> = {
      service_based: 'Payment within 30 days. TDS applicable as per Income Tax Act.',
      goods_based: 'Payment within 30 days. Any dispute should be resolved within 7 days.',
      manufacturing: 'Payment within 30 days. Quality warranty: 12 months from delivery.',
      contract_based: 'Payment within 15 days after work completion. TDS and retention as per agreement.',
      epc_project: 'Payment as per milestone completion. Performance guarantee applicable.',
      manpower_supply: 'Monthly payment within 7 days. Statutory compliance by supplier.',
      it_services: 'Payment within 30 days. Maintenance support included for 3 months.',
    };

    return termsMap[businessConfig?.invoice_format] || 'Payment within 30 days of invoice date.';
  }

  function getDefaultInvoiceLine(): BusinessSpecificInvoiceLine {
    const baseLine: BusinessSpecificInvoiceLine = {
      description: '',
      hsn_sac: '',
      quantity: 1,
      rate: 0,
      discount_percent: 0,
      discount_amount: 0,
      taxable_value: 0,
      cgst_rate: 0,
      sgst_rate: 0,
      igst_rate: 0,
      cess_rate: 0,
      cgst_amount: 0,
      sgst_amount: 0,
      igst_amount: 0,
      cess_amount: 0,
      line_total: 0,
    };

    // Add business-specific fields based on invoice format
    if (businessConfig?.invoice_format === 'manufacturing') {
      baseLine.batch_no = '';
    }

    if (businessConfig?.invoice_format === 'contract_based') {
      baseLine.work_order_no = '';
      baseLine.labour_charges = 0;
      baseLine.material_charges = 0;
    }

    if (businessConfig?.invoice_format === 'epc_project') {
      baseLine.project_component = '';
      baseLine.milestone = '';
    }

    if (businessConfig?.invoice_format === 'manpower_supply') {
      baseLine.designation = '';
      baseLine.overtime_hours = 0;
    }

    if (businessConfig?.invoice_format === 'it_services') {
      baseLine.technology = '';
      baseLine.hourly_rate = 0;
    }

    return baseLine;
  }

  useEffect(() => {
    fetchClients();
    fetchItems();
  }, []);

  useEffect(() => {
    // Update form when business config changes
    if (businessConfig) {
      setFormData(prev => ({
        ...prev,
        series: getInvoiceSeries(),
        terms_conditions: getDefaultTerms(),
      }));

      // Reset invoice lines with business-specific fields
      setInvoiceLines([getDefaultInvoiceLine()]);
    }
  }, [businessConfig]);

  const fetchClients = async () => {
    try {
      const response = await apiClient.get('/api/v1/tenants/clients/');
      setClients(response.data.results || []);
    } catch (error) {
      console.error('Error fetching clients:', error);
      // Use demo data
      setClients([
        { id: '1', name: 'Demo Client 1', gstin: '29AABCU9603R1ZX', state_code: '29', email: 'client1@demo.com' },
        { id: '2', name: 'Demo Client 2', gstin: '07AABCU9603R1ZX', state_code: '07', email: 'client2@demo.com' },
      ]);
    }
  };

  const fetchItems = async () => {
    try {
      const response = await apiClient.get('/api/v1/invoices/items/');
      setItems(response.data.results || []);
    } catch (error) {
      console.error('Error fetching items:', error);
      // Use demo data based on business type
      const demoItems = getDemoItems();
      setItems(demoItems);
    }
  };

  const getDemoItems = (): Item[] => {
    if (!businessConfig) return [];

    const itemsMap: Record<string, Item[]> = {
      service_based: [
        { id: '1', name: 'Professional Consultation', item_code: 'PROF001', hsn_sac: '998314', current_gst_rate: 18, default_rate: 5000, is_service: true },
        { id: '2', name: 'Tax Advisory Service', item_code: 'TAX001', hsn_sac: '998314', current_gst_rate: 18, default_rate: 3000, is_service: true },
      ],
      goods_based: [
        { id: '1', name: 'Product A', item_code: 'PRD001', hsn_sac: '84145990', current_gst_rate: 18, default_rate: 1000, is_service: false },
        { id: '2', name: 'Product B', item_code: 'PRD002', hsn_sac: '84145990', current_gst_rate: 12, default_rate: 2000, is_service: false },
      ],
      manufacturing: [
        { id: '1', name: 'Manufactured Component A', item_code: 'MFG001', hsn_sac: '84839090', current_gst_rate: 18, default_rate: 5000, is_service: false },
        { id: '2', name: 'Assembly Unit B', item_code: 'MFG002', hsn_sac: '84839090', current_gst_rate: 12, default_rate: 8000, is_service: false },
      ],
      contract_based: [
        { id: '1', name: 'Construction Work', item_code: 'CONST001', hsn_sac: '995411', current_gst_rate: 18, default_rate: 50000, is_service: true },
        { id: '2', name: 'Material Supply', item_code: 'MAT001', hsn_sac: '2307', current_gst_rate: 5, default_rate: 10000, is_service: false },
      ]
    };

    return itemsMap[businessConfig.invoice_format] || itemsMap.service_based;
  };

  const handleFormChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleLineItemChange = (index: number, field: string, value: any) => {
    const newLines = [...invoiceLines];
    newLines[index] = {
      ...newLines[index],
      [field]: value
    };

    // Recalculate line totals
    const line = newLines[index];
    const baseAmount = line.quantity * line.rate;
    const discountAmount = line.discount_percent > 0
      ? (baseAmount * line.discount_percent / 100)
      : line.discount_amount;

    line.discount_amount = discountAmount;
    line.taxable_value = baseAmount - discountAmount;

    // Calculate taxes
    line.cgst_amount = (line.taxable_value * line.cgst_rate) / 100;
    line.sgst_amount = (line.taxable_value * line.sgst_rate) / 100;
    line.igst_amount = (line.taxable_value * line.igst_rate) / 100;
    line.cess_amount = (line.taxable_value * line.cess_rate) / 100;

    line.line_total = line.taxable_value + line.cgst_amount + line.sgst_amount + line.igst_amount + line.cess_amount;

    setInvoiceLines(newLines);
  };

  const addLineItem = () => {
    setInvoiceLines([...invoiceLines, getDefaultInvoiceLine()]);
  };

  const removeLineItem = (index: number) => {
    if (invoiceLines.length > 1) {
      const newLines = invoiceLines.filter((_, i) => i !== index);
      setInvoiceLines(newLines);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const invoiceData = {
        ...formData,
        lines: invoiceLines,
        business_type: currentTenant?.business_type,
        invoice_format: businessConfig?.invoice_format,
      };

      // For demo purposes, just show success message
      console.log('Invoice data:', invoiceData);
      alert('Invoice created successfully! (Demo mode)');

      // Reset form
      setFormData({
        ...formData,
        client_id: '',
        notes: '',
        project_name: '',
        contract_no: '',
        work_order_no: '',
        milestone: '',
        po_number: '',
        delivery_date: '',
        transport_mode: '',
        vehicle_number: '',
        retention_percent: 0,
        advance_amount: 0,
        tds_percent: 0,
        performance_guarantee: 0,
      });
      setInvoiceLines([getDefaultInvoiceLine()]);

    } catch (error) {
      console.error('Error creating invoice:', error);
      alert('Error creating invoice. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (configLoading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!businessConfig) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Unable to load business configuration</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <h1 className="text-2xl font-bold text-gray-900">
            Create {getInvoiceTypeLabel()} Invoice
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            Business Type: {currentTenant?.business_type?.replace('_', ' ').toUpperCase()}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          {/* Header Information */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Client *
              </label>
              <select
                value={formData.client_id}
                onChange={(e) => handleFormChange('client_id', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="">Select Client</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name} ({client.gstin})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Series
              </label>
              <input
                type="text"
                value={formData.series}
                onChange={(e) => handleFormChange('series', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Invoice Date *
              </label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => handleFormChange('date', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
          </div>

          {/* Business-Specific Header Fields */}
          {renderBusinessSpecificHeaderFields()}

          {/* Line Items */}
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Line Items</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full border border-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    {renderLineItemHeaders()}
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {invoiceLines.map((line, index) => (
                    <tr key={index} className="border-t">
                      {renderLineItemFields(line, index)}
                      <td className="px-4 py-2">
                        <div className="flex space-x-2">
                          {invoiceLines.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeLineItem(index)}
                              className="text-red-600 hover:text-red-800"
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <button
              type="button"
              onClick={addLineItem}
              className="mt-4 px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
            >
              Add Line Item
            </button>
          </div>

          {/* Summary */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Notes
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => handleFormChange('notes', e.target.value)}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Additional notes..."
              />
            </div>

            <div>
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-semibold mb-2">Invoice Summary</h4>
                {renderInvoiceSummary()}
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create Invoice'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  function getInvoiceTypeLabel(): string {
    const labels: Record<string, string> = {
      service_based: 'Professional Service',
      goods_based: 'Sales',
      manufacturing: 'Manufacturing',
      contract_based: 'Work Contract',
      epc_project: 'EPC Project',
      manpower_supply: 'Manpower Supply',
      it_services: 'IT Services',
    };
    return labels[businessConfig?.invoice_format || ''] || 'Standard';
  }

  function renderBusinessSpecificHeaderFields() {
    const format = businessConfig?.invoice_format;

    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {/* Common fields for all contract-based businesses */}
        {(['contract_based', 'epc_project'].includes(format || '')) && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Project Name
              </label>
              <input
                type="text"
                value={formData.project_name}
                onChange={(e) => handleFormChange('project_name', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter project name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Work Order No.
              </label>
              <input
                type="text"
                value={formData.work_order_no}
                onChange={(e) => handleFormChange('work_order_no', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Work order number"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Retention %
              </label>
              <input
                type="number"
                value={formData.retention_percent}
                onChange={(e) => handleFormChange('retention_percent', parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                min="0"
                max="20"
                step="0.1"
              />
            </div>
          </>
        )}

        {/* Trader/Manufacturing specific */}
        {(['goods_based', 'manufacturing'].includes(format || '')) && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                PO Number
              </label>
              <input
                type="text"
                value={formData.po_number}
                onChange={(e) => handleFormChange('po_number', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Purchase order number"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Delivery Date
              </label>
              <input
                type="date"
                value={formData.delivery_date}
                onChange={(e) => handleFormChange('delivery_date', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Vehicle Number
              </label>
              <input
                type="text"
                value={formData.vehicle_number}
                onChange={(e) => handleFormChange('vehicle_number', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Transport vehicle number"
              />
            </div>
          </>
        )}

        {/* Professional services */}
        {(format === 'service_based') && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              TDS %
            </label>
            <select
              value={formData.tds_percent}
              onChange={(e) => handleFormChange('tds_percent', parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="0">No TDS</option>
              <option value="10">10% - Professional Services</option>
              <option value="2">2% - Contractor</option>
              <option value="1">1% - Others</option>
            </select>
          </div>
        )}
      </div>
    );
  }

  function renderLineItemHeaders() {
    const format = businessConfig?.invoice_format;

    const commonHeaders = [
      <th key="desc" className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Description</th>,
      <th key="hsn" className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">HSN/SAC</th>,
      <th key="qty" className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Qty</th>,
      <th key="rate" className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Rate</th>,
    ];

    // Add business-specific headers
    if (format === 'manufacturing') {
      commonHeaders.push(
        <th key="batch" className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Batch No</th>
      );
    }

    if (format === 'contract_based') {
      commonHeaders.push(
        <th key="labour" className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Labour</th>,
        <th key="material" className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Material</th>
      );
    }

    if (format === 'manpower_supply') {
      commonHeaders.push(
        <th key="designation" className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Role</th>,
        <th key="overtime" className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">OT Hrs</th>
      );
    }

    commonHeaders.push(
      <th key="total" className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Total</th>
    );

    return commonHeaders;
  }

  function renderLineItemFields(line: BusinessSpecificInvoiceLine, index: number) {
    const format = businessConfig?.invoice_format;

    const commonFields = [
      <td key="desc" className="px-4 py-2">
        <input
          type="text"
          value={line.description}
          onChange={(e) => handleLineItemChange(index, 'description', e.target.value)}
          className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
          placeholder="Item description"
        />
      </td>,
      <td key="hsn" className="px-4 py-2">
        <input
          type="text"
          value={line.hsn_sac}
          onChange={(e) => handleLineItemChange(index, 'hsn_sac', e.target.value)}
          className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
          placeholder="HSN/SAC"
        />
      </td>,
      <td key="qty" className="px-4 py-2">
        <input
          type="number"
          value={line.quantity}
          onChange={(e) => handleLineItemChange(index, 'quantity', parseFloat(e.target.value) || 0)}
          className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
          min="0"
          step="0.01"
        />
      </td>,
      <td key="rate" className="px-4 py-2">
        <input
          type="number"
          value={line.rate}
          onChange={(e) => handleLineItemChange(index, 'rate', parseFloat(e.target.value) || 0)}
          className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
          min="0"
          step="0.01"
        />
      </td>,
    ];

    // Add business-specific fields
    if (format === 'manufacturing') {
      commonFields.push(
        <td key="batch" className="px-4 py-2">
          <input
            type="text"
            value={line.batch_no || ''}
            onChange={(e) => handleLineItemChange(index, 'batch_no', e.target.value)}
            className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
            placeholder="Batch number"
          />
        </td>
      );
    }

    if (format === 'contract_based') {
      commonFields.push(
        <td key="labour" className="px-4 py-2">
          <input
            type="number"
            value={line.labour_charges || 0}
            onChange={(e) => handleLineItemChange(index, 'labour_charges', parseFloat(e.target.value) || 0)}
            className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
            min="0"
            step="0.01"
          />
        </td>,
        <td key="material" className="px-4 py-2">
          <input
            type="number"
            value={line.material_charges || 0}
            onChange={(e) => handleLineItemChange(index, 'material_charges', parseFloat(e.target.value) || 0)}
            className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
            min="0"
            step="0.01"
          />
        </td>
      );
    }

    if (format === 'manpower_supply') {
      commonFields.push(
        <td key="designation" className="px-4 py-2">
          <input
            type="text"
            value={line.designation || ''}
            onChange={(e) => handleLineItemChange(index, 'designation', e.target.value)}
            className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
            placeholder="Role/Designation"
          />
        </td>,
        <td key="overtime" className="px-4 py-2">
          <input
            type="number"
            value={line.overtime_hours || 0}
            onChange={(e) => handleLineItemChange(index, 'overtime_hours', parseFloat(e.target.value) || 0)}
            className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
            min="0"
            step="0.5"
          />
        </td>
      );
    }

    commonFields.push(
      <td key="total" className="px-4 py-2 font-medium">
        ₹{line.line_total.toFixed(2)}
      </td>
    );

    return commonFields;
  }

  function renderInvoiceSummary() {
    const subtotal = invoiceLines.reduce((sum, line) => sum + line.taxable_value, 0);
    const totalTax = invoiceLines.reduce((sum, line) =>
      sum + line.cgst_amount + line.sgst_amount + line.igst_amount + line.cess_amount, 0);
    const total = subtotal + totalTax;

    const retentionAmount = (total * formData.retention_percent) / 100;
    const tdsAmount = (subtotal * formData.tds_percent) / 100;
    const finalTotal = total - retentionAmount - tdsAmount;

    return (
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span>Subtotal:</span>
          <span>₹{subtotal.toFixed(2)}</span>
        </div>
        <div className="flex justify-between">
          <span>Total Tax:</span>
          <span>₹{totalTax.toFixed(2)}</span>
        </div>
        <div className="flex justify-between font-semibold">
          <span>Gross Total:</span>
          <span>₹{total.toFixed(2)}</span>
        </div>

        {formData.retention_percent > 0 && (
          <div className="flex justify-between text-red-600">
            <span>Retention ({formData.retention_percent}%):</span>
            <span>-₹{retentionAmount.toFixed(2)}</span>
          </div>
        )}

        {formData.tds_percent > 0 && (
          <div className="flex justify-between text-red-600">
            <span>TDS ({formData.tds_percent}%):</span>
            <span>-₹{tdsAmount.toFixed(2)}</span>
          </div>
        )}

        <div className="border-t pt-2 flex justify-between font-bold text-lg">
          <span>Final Total:</span>
          <span>₹{finalTotal.toFixed(2)}</span>
        </div>
      </div>
    );
  }
};

export default BusinessSpecificInvoiceForm;