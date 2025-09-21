import React, { useState, useEffect } from 'react';
import { apiClient } from '../../services/api';

interface Client {
  id: string;
  name: string;
  gstin: string;
  state_code: string;
  email: string;
}

interface Item {
  id: string;
  name: string;
  item_code: string;
  hsn_sac: string;
  current_gst_rate: number;
  default_rate: number;
  is_service: boolean;
}

interface InvoiceLine {
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
}

const InvoiceForm: React.FC = () => {
  const [clients, setClients] = useState<Client[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    client_id: '',
    invoice_type: 'taxable',
    series: 'INV',
    date: new Date().toISOString().split('T')[0],
    due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    place_of_supply: '',
    currency: 'INR',
    notes: '',
    terms_conditions: 'Payment within 30 days of invoice date.',
  });

  const [invoiceLines, setInvoiceLines] = useState<InvoiceLine[]>([
    {
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
    },
  ]);

  useEffect(() => {
    fetchClients();
    fetchItems();
  }, []);

  const fetchClients = async () => {
    try {
      const response = await apiClient.get('/api/v1/invoices/clients/');
      setClients(response.data.results || []);
    } catch (error) {
      console.error('Error fetching clients:', error);
    }
  };

  const fetchItems = async () => {
    try {
      const response = await apiClient.get('/api/v1/invoices/items/');
      setItems(response.data.results || []);
    } catch (error) {
      console.error('Error fetching items:', error);
    }
  };

  const calculateLineTotal = (line: InvoiceLine, index: number) => {
    const amount = line.quantity * line.rate;
    const discountAmount = line.discount_percent ? (amount * line.discount_percent) / 100 : line.discount_amount;
    const taxableValue = amount - discountAmount;

    // Determine GST based on place of supply
    const selectedClient = clients.find(c => c.id === formData.client_id);
    const isInterState = selectedClient && selectedClient.state_code !== formData.place_of_supply;

    let cgstRate = 0, sgstRate = 0, igstRate = 0;
    const gstRate = 18; // Default GST rate

    if (isInterState) {
      igstRate = gstRate;
    } else {
      cgstRate = gstRate / 2;
      sgstRate = gstRate / 2;
    }

    const cgstAmount = (taxableValue * cgstRate) / 100;
    const sgstAmount = (taxableValue * sgstRate) / 100;
    const igstAmount = (taxableValue * igstRate) / 100;
    const cessAmount = (taxableValue * line.cess_rate) / 100;

    const lineTotal = taxableValue + cgstAmount + sgstAmount + igstAmount + cessAmount;

    const updatedLine = {
      ...line,
      discount_amount: discountAmount,
      taxable_value: taxableValue,
      cgst_rate: cgstRate,
      sgst_rate: sgstRate,
      igst_rate: igstRate,
      cgst_amount: cgstAmount,
      sgst_amount: sgstAmount,
      igst_amount: igstAmount,
      cess_amount: cessAmount,
      line_total: lineTotal,
    };

    const newLines = [...invoiceLines];
    newLines[index] = updatedLine;
    setInvoiceLines(newLines);
  };

  const addNewLine = () => {
    setInvoiceLines([
      ...invoiceLines,
      {
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
      },
    ]);
  };

  const removeLine = (index: number) => {
    if (invoiceLines.length > 1) {
      const newLines = invoiceLines.filter((_, i) => i !== index);
      setInvoiceLines(newLines);
    }
  };

  const handleItemSelect = (itemId: string, index: number) => {
    const item = items.find(i => i.id === itemId);
    if (item) {
      const newLines = [...invoiceLines];
      newLines[index] = {
        ...newLines[index],
        item_id: item.id,
        description: item.name,
        hsn_sac: item.hsn_sac,
        rate: item.default_rate,
      };
      setInvoiceLines(newLines);
      calculateLineTotal(newLines[index], index);
    }
  };

  const calculateTotals = () => {
    const subtotal = invoiceLines.reduce((sum, line) => sum + line.taxable_value, 0);
    const totalTax = invoiceLines.reduce((sum, line) =>
      sum + line.cgst_amount + line.sgst_amount + line.igst_amount + line.cess_amount, 0);
    const grandTotal = invoiceLines.reduce((sum, line) => sum + line.line_total, 0);

    return { subtotal, totalTax, grandTotal };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const totals = calculateTotals();
      const invoiceData = {
        ...formData,
        taxable_amount: totals.subtotal,
        total_tax: totals.totalTax,
        grand_total: totals.grandTotal,
        lines: invoiceLines,
      };

      const response = await apiClient.post('/api/v1/invoices/invoices/', invoiceData);
      alert('Invoice created successfully!');
      window.location.href = `/invoices/${response.data.id}`;
    } catch (error: any) {
      console.error('Error creating invoice:', error);
      alert('Failed to create invoice: ' + (error.response?.data?.detail || error.message));
    } finally {
      setLoading(false);
    }
  };

  const { subtotal, totalTax, grandTotal } = calculateTotals();

  return (
    <div className="max-w-6xl mx-auto p-6">
      <h2 className="text-2xl font-bold mb-6">Create New Invoice</h2>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="card p-6">
          <h3 className="text-lg font-semibold mb-4">Invoice Details</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Client *</label>
              <select
                value={formData.client_id}
                onChange={(e) => setFormData({ ...formData, client_id: e.target.value })}
                className="input-field"
                required
              >
                <option value="">Select Client</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name} {client.gstin && `(${client.gstin})`}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Invoice Type</label>
              <select
                value={formData.invoice_type}
                onChange={(e) => setFormData({ ...formData, invoice_type: e.target.value })}
                className="input-field"
              >
                <option value="taxable">Tax Invoice</option>
                <option value="proforma">Proforma Invoice</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Invoice Date *</label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="input-field"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Due Date *</label>
              <input
                type="date"
                value={formData.due_date}
                onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                className="input-field"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Place of Supply *</label>
              <input
                type="text"
                value={formData.place_of_supply}
                onChange={(e) => setFormData({ ...formData, place_of_supply: e.target.value })}
                className="input-field"
                placeholder="e.g., 27-Maharashtra"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Currency</label>
              <select
                value={formData.currency}
                onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                className="input-field"
              >
                <option value="INR">INR - Indian Rupee</option>
                <option value="USD">USD - US Dollar</option>
                <option value="EUR">EUR - Euro</option>
              </select>
            </div>
          </div>
        </div>

        <div className="card p-6">
          <h3 className="text-lg font-semibold mb-4">Invoice Items</h3>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Item</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">HSN/SAC</th>
                  <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase">Qty</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Rate</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Discount %</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Taxable</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                  <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase">Action</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {invoiceLines.map((line, index) => (
                  <tr key={index}>
                    <td className="px-3 py-2">
                      <select
                        value={line.item_id || ''}
                        onChange={(e) => handleItemSelect(e.target.value, index)}
                        className="input-field text-sm"
                      >
                        <option value="">Select Item</option>
                        {items.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={line.description}
                        onChange={(e) => {
                          const newLines = [...invoiceLines];
                          newLines[index].description = e.target.value;
                          setInvoiceLines(newLines);
                        }}
                        className="input-field text-sm"
                        required
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={line.hsn_sac}
                        onChange={(e) => {
                          const newLines = [...invoiceLines];
                          newLines[index].hsn_sac = e.target.value;
                          setInvoiceLines(newLines);
                        }}
                        className="input-field text-sm"
                        required
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        value={line.quantity}
                        onChange={(e) => {
                          const newLines = [...invoiceLines];
                          newLines[index].quantity = parseFloat(e.target.value) || 0;
                          setInvoiceLines(newLines);
                          calculateLineTotal(newLines[index], index);
                        }}
                        className="input-field text-sm text-center"
                        min="0"
                        step="0.01"
                        required
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        value={line.rate}
                        onChange={(e) => {
                          const newLines = [...invoiceLines];
                          newLines[index].rate = parseFloat(e.target.value) || 0;
                          setInvoiceLines(newLines);
                          calculateLineTotal(newLines[index], index);
                        }}
                        className="input-field text-sm text-right"
                        min="0"
                        step="0.01"
                        required
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        value={line.discount_percent}
                        onChange={(e) => {
                          const newLines = [...invoiceLines];
                          newLines[index].discount_percent = parseFloat(e.target.value) || 0;
                          setInvoiceLines(newLines);
                          calculateLineTotal(newLines[index], index);
                        }}
                        className="input-field text-sm text-right"
                        min="0"
                        max="100"
                        step="0.01"
                      />
                    </td>
                    <td className="px-3 py-2 text-right">
                      ₹{line.taxable_value.toFixed(2)}
                    </td>
                    <td className="px-3 py-2 text-right font-semibold">
                      ₹{line.line_total.toFixed(2)}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <button
                        type="button"
                        onClick={() => removeLine(index)}
                        className="text-red-600 hover:text-red-800"
                        disabled={invoiceLines.length === 1}
                      >
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button
            type="button"
            onClick={addNewLine}
            className="mt-4 btn-secondary"
          >
            Add Line Item
          </button>
        </div>

        <div className="card p-6">
          <h3 className="text-lg font-semibold mb-4">Summary</h3>

          <div className="space-y-2">
            <div className="flex justify-between">
              <span>Subtotal:</span>
              <span className="font-semibold">₹{subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>Total Tax:</span>
              <span className="font-semibold">₹{totalTax.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-lg font-bold">
              <span>Grand Total:</span>
              <span>₹{grandTotal.toFixed(2)}</span>
            </div>
          </div>
        </div>

        <div className="card p-6">
          <h3 className="text-lg font-semibold mb-4">Additional Information</h3>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Notes</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="input-field"
                rows={3}
                placeholder="Additional notes for the invoice..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Terms & Conditions</label>
              <textarea
                value={formData.terms_conditions}
                onChange={(e) => setFormData({ ...formData, terms_conditions: e.target.value })}
                className="input-field"
                rows={3}
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end space-x-4">
          <button
            type="button"
            onClick={() => window.history.back()}
            className="btn-secondary"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn-primary"
            disabled={loading}
          >
            {loading ? 'Creating...' : 'Create Invoice'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default InvoiceForm;