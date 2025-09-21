import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';

interface KPIData {
  revenue: {
    total_revenue: number;
    paid_revenue: number;
    outstanding_revenue: number;
    invoice_count: number;
    avg_invoice_value: number;
    revenue_growth_rate: number;
    invoice_growth_rate: number;
    collection_efficiency: number;
  };
  tax: {
    total_tax_collected: number;
    total_taxable_amount: number;
    effective_tax_rate: number;
    tax_breakdown: {
      cgst: number;
      sgst: number;
      igst: number;
      cess: number;
    };
  };
  clients: {
    active_clients: number;
    new_clients: number;
    avg_revenue_per_client: number;
    top_clients: Array<{
      id: string;
      name: string;
      total_revenue: number;
      invoice_count: number;
    }>;
  };
  payments: {
    payment_status_distribution: Array<{
      status: string;
      count: number;
      amount: number;
    }>;
    total_overdue_amount: number;
    overdue_invoice_count: number;
    aging_analysis: {
      '0_30_days': number;
      '30_60_days': number;
      '60_plus_days': number;
    };
    average_payment_days: number;
  };
}

interface ChartData {
  revenue_trend: {
    success: boolean;
    labels: string[];
    datasets: Array<{
      label: string;
      data: number[];
      borderColor: string;
      backgroundColor: string;
    }>;
  };
  tax_breakdown: {
    success: boolean;
    labels: string[];
    datasets: Array<{
      data: number[];
      backgroundColor: string[];
    }>;
    total_tax: number;
  };
  client_revenue: {
    success: boolean;
    labels: string[];
    datasets: Array<{
      label: string;
      data: number[];
      backgroundColor: string;
    }>;
  };
  payment_status: {
    success: boolean;
    labels: string[];
    datasets: Array<{
      data: number[];
      backgroundColor: string[];
    }>;
    total_invoices: number;
    total_amount: number;
  };
}

const FinancialDashboard: React.FC = () => {
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState<KPIData | null>(null);
  const [charts, setCharts] = useState<ChartData | null>(null);
  const [dateRange, setDateRange] = useState({
    start_date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // Last 30 days
    end_date: new Date().toISOString().split('T')[0]
  });
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadDashboardData();
  }, [dateRange]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/reports/financial-dashboard/?start_date=${dateRange.start_date}&end_date=${dateRange.end_date}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setKpis(data.kpis);
          setCharts(data.charts);
        }
      }
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const refreshData = async () => {
    setRefreshing(true);
    await loadDashboardData();
    setRefreshing(false);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatPercentage = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  const getGrowthIcon = (growthRate: number) => {
    if (growthRate > 0) {
      return <span className="text-green-500">↗️</span>;
    } else if (growthRate < 0) {
      return <span className="text-red-500">↘️</span>;
    }
    return <span className="text-gray-500">→</span>;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Financial Dashboard</h1>
          <p className="mt-2 text-gray-600">
            Comprehensive financial analytics and KPIs
          </p>
        </div>
        <div className="flex items-center space-x-4">
          {/* Date Range Selector */}
          <div className="flex items-center space-x-2">
            <input
              type="date"
              value={dateRange.start_date}
              onChange={(e) => setDateRange({ ...dateRange, start_date: e.target.value })}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm"
            />
            <span className="text-gray-500">to</span>
            <input
              type="date"
              value={dateRange.end_date}
              onChange={(e) => setDateRange({ ...dateRange, end_date: e.target.value })}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm"
            />
          </div>
          <button
            onClick={refreshData}
            disabled={refreshing}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {refreshing ? '🔄' : '↻'} Refresh
          </button>
        </div>
      </div>

      {/* Revenue KPI Cards */}
      {kpis && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500">Total Revenue</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {formatCurrency(kpis.revenue.total_revenue)}
                  </p>
                  <p className="text-xs text-gray-500 flex items-center">
                    {getGrowthIcon(kpis.revenue.revenue_growth_rate)}
                    {formatPercentage(Math.abs(kpis.revenue.revenue_growth_rate))} vs previous period
                  </p>
                </div>
                <div className="text-3xl">💰</div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500">Outstanding Amount</p>
                  <p className="text-2xl font-bold text-orange-600">
                    {formatCurrency(kpis.revenue.outstanding_revenue)}
                  </p>
                  <p className="text-xs text-gray-500">
                    Collection Rate: {formatPercentage(kpis.revenue.collection_efficiency)}
                  </p>
                </div>
                <div className="text-3xl">⏰</div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500">Total Invoices</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {kpis.revenue.invoice_count.toLocaleString()}
                  </p>
                  <p className="text-xs text-gray-500 flex items-center">
                    {getGrowthIcon(kpis.revenue.invoice_growth_rate)}
                    {formatPercentage(Math.abs(kpis.revenue.invoice_growth_rate))} vs previous period
                  </p>
                </div>
                <div className="text-3xl">📄</div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500">Avg Invoice Value</p>
                  <p className="text-2xl font-bold text-green-600">
                    {formatCurrency(kpis.revenue.avg_invoice_value)}
                  </p>
                  <p className="text-xs text-gray-500">
                    Active Clients: {kpis.clients.active_clients}
                  </p>
                </div>
                <div className="text-3xl">📊</div>
              </div>
            </div>
          </div>

          {/* Tax & Payment Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Tax Collection</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Total Tax Collected</span>
                  <span className="font-medium">{formatCurrency(kpis.tax.total_tax_collected)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Effective Tax Rate</span>
                  <span className="font-medium">{formatPercentage(kpis.tax.effective_tax_rate)}</span>
                </div>
                <div className="border-t pt-3">
                  <div className="flex justify-between text-xs">
                    <span>CGST: {formatCurrency(kpis.tax.tax_breakdown.cgst)}</span>
                    <span>SGST: {formatCurrency(kpis.tax.tax_breakdown.sgst)}</span>
                  </div>
                  <div className="flex justify-between text-xs mt-1">
                    <span>IGST: {formatCurrency(kpis.tax.tax_breakdown.igst)}</span>
                    <span>CESS: {formatCurrency(kpis.tax.tax_breakdown.cess)}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Client Metrics</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Active Clients</span>
                  <span className="font-medium">{kpis.clients.active_clients}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">New Clients</span>
                  <span className="font-medium text-green-600">+{kpis.clients.new_clients}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Avg Revenue/Client</span>
                  <span className="font-medium">{formatCurrency(kpis.clients.avg_revenue_per_client)}</span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Payment Status</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Overdue Amount</span>
                  <span className="font-medium text-red-600">{formatCurrency(kpis.payments.total_overdue_amount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Overdue Invoices</span>
                  <span className="font-medium">{kpis.payments.overdue_invoice_count}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Avg Payment Time</span>
                  <span className="font-medium">{kpis.payments.average_payment_days} days</span>
                </div>
              </div>
            </div>
          </div>

          {/* Charts Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* Revenue Trend Chart */}
            {charts?.revenue_trend?.success && (
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Revenue Trend</h3>
                <div className="h-64 flex items-center justify-center">
                  {/* Placeholder for Chart.js or similar library */}
                  <div className="text-center">
                    <div className="text-4xl mb-2">📈</div>
                    <p className="text-gray-500">Revenue Trend Chart</p>
                    <p className="text-sm text-gray-400">
                      {charts.revenue_trend.datasets[0]?.data.length || 0} data points
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Tax Breakdown Chart */}
            {charts?.tax_breakdown?.success && (
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Tax Breakdown</h3>
                <div className="h-64 flex items-center justify-center">
                  <div className="text-center">
                    <div className="text-4xl mb-2">🥧</div>
                    <p className="text-gray-500">Tax Distribution</p>
                    <p className="text-sm text-gray-400">
                      Total: {formatCurrency(charts.tax_breakdown.total_tax)}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Top Clients Table */}
          <div className="bg-white rounded-lg shadow mb-8">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">Top Clients by Revenue</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Client
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total Revenue
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Invoices
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Avg Invoice Value
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {kpis.clients.top_clients.map((client, index) => (
                    <tr key={client.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-8 w-8 bg-blue-100 rounded-full flex items-center justify-center">
                            <span className="text-sm font-medium text-blue-600">
                              {client.name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div className="ml-3">
                            <div className="text-sm font-medium text-gray-900">{client.name}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatCurrency(client.total_revenue)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {client.invoice_count}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatCurrency(client.total_revenue / client.invoice_count)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Aging Analysis */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Accounts Receivable Aging</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">
                  {formatCurrency(kpis.payments.aging_analysis['0_30_days'])}
                </div>
                <div className="text-sm text-gray-600">0-30 Days</div>
              </div>
              <div className="text-center p-4 bg-yellow-50 rounded-lg">
                <div className="text-2xl font-bold text-yellow-600">
                  {formatCurrency(kpis.payments.aging_analysis['30_60_days'])}
                </div>
                <div className="text-sm text-gray-600">30-60 Days</div>
              </div>
              <div className="text-center p-4 bg-red-50 rounded-lg">
                <div className="text-2xl font-bold text-red-600">
                  {formatCurrency(kpis.payments.aging_analysis['60_plus_days'])}
                </div>
                <div className="text-sm text-gray-600">60+ Days</div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default FinancialDashboard;