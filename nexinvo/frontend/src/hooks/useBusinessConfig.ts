import { useState, useEffect } from 'react';
import { apiClient } from '../services/api';

interface BusinessConfig {
  invoice_format: string;
  item_master: {
    type: string;
    fields: string[];
    required_fields: string[];
  };
  client_fields: string[];
  invoice_fields: string[];
  gst_compliance: Record<string, any>;
  calculations: Record<string, any>;
  reports: string[];
}

interface Tenant {
  id: string;
  name: string;
  business_type: string;
  business_config: BusinessConfig;
}

export const useBusinessConfig = () => {
  const [businessConfig, setBusinessConfig] = useState<BusinessConfig | null>(null);
  const [currentTenant, setCurrentTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTenantConfig = async () => {
    try {
      setLoading(true);
      setError(null);

      // Try to get current tenant from API
      try {
        const response = await apiClient.get('/api/v1/tenants/me/');
        const tenant = response.data.tenant;
        setCurrentTenant(tenant);
        setBusinessConfig(tenant.business_config || null);
      } catch (apiError) {
        // Fallback to localStorage for demo purposes
        console.log('API not available, using localStorage fallback');

        const savedTenant = localStorage.getItem('currentTenant');
        if (savedTenant) {
          const tenant = JSON.parse(savedTenant);
          setCurrentTenant(tenant);
          setBusinessConfig(tenant.business_config || getDefaultConfig(tenant.business_type));
        } else {
          // Default tenant for demo
          const defaultTenant = {
            id: 'demo-tenant',
            name: 'Demo Tenant',
            business_type: 'professional',
            business_config: getDefaultConfig('professional')
          };
          setCurrentTenant(defaultTenant);
          setBusinessConfig(defaultTenant.business_config);
        }
      }
    } catch (error) {
      console.error('Error fetching tenant config:', error);
      setError('Failed to load business configuration');
      // Set default configuration
      setBusinessConfig(getDefaultConfig('professional'));
    } finally {
      setLoading(false);
    }
  };

  const getDefaultConfig = (businessType: string): BusinessConfig => {
    const configs: Record<string, BusinessConfig> = {
      professional: {
        invoice_format: 'service_based',
        item_master: {
          type: 'service',
          fields: ['service_name', 'description', 'hsn_sac', 'rate', 'unit'],
          required_fields: ['service_name', 'hsn_sac', 'rate']
        },
        client_fields: ['name', 'email', 'phone', 'gstin', 'pan', 'address', 'contact_person'],
        invoice_fields: ['client', 'service_details', 'professional_fee', 'gst', 'total'],
        gst_compliance: {
          reverse_charge: false,
          tds_applicable: true,
          quarterly_gstr: true
        },
        calculations: {
          discount_type: 'percentage',
          tax_calculation: 'exclusive',
          round_off: true
        },
        reports: ['service_register', 'client_wise_revenue', 'tds_report']
      },
      trader: {
        invoice_format: 'goods_based',
        item_master: {
          type: 'product',
          fields: ['item_name', 'description', 'hsn_code', 'mrp', 'selling_price', 'purchase_price', 'stock_qty', 'unit', 'brand'],
          required_fields: ['item_name', 'hsn_code', 'selling_price']
        },
        client_fields: ['name', 'trading_name', 'gstin', 'pan', 'email', 'phone', 'billing_address', 'shipping_address', 'credit_terms'],
        invoice_fields: ['client', 'items', 'quantity', 'rate', 'discount', 'taxable_value', 'gst', 'total'],
        gst_compliance: {
          reverse_charge: true,
          e_invoice_mandatory: true,
          gstr1_monthly: true
        },
        calculations: {
          discount_type: 'amount_or_percentage',
          tax_calculation: 'exclusive',
          round_off: true,
          freight_charges: true
        },
        reports: ['sales_register', 'purchase_register', 'stock_report', 'gst_summary']
      },
      manufacturer: {
        invoice_format: 'manufacturing',
        item_master: {
          type: 'manufactured_goods',
          fields: ['product_name', 'product_code', 'description', 'hsn_code', 'manufacturing_cost', 'selling_price', 'raw_materials', 'finished_goods_stock', 'unit', 'batch_no'],
          required_fields: ['product_name', 'product_code', 'hsn_code', 'selling_price']
        },
        client_fields: ['company_name', 'gstin', 'pan', 'email', 'phone', 'billing_address', 'shipping_address', 'credit_terms', 'buyer_type'],
        invoice_fields: ['client', 'products', 'batch_details', 'quantity', 'rate', 'excise_duty', 'gst', 'total'],
        gst_compliance: {
          reverse_charge: true,
          e_invoice_mandatory: true,
          job_work_applicable: true,
          gstr1_monthly: true
        },
        calculations: {
          discount_type: 'amount_or_percentage',
          tax_calculation: 'exclusive',
          round_off: true,
          packing_forwarding: true,
          freight_charges: true
        },
        reports: ['production_report', 'raw_material_consumption', 'finished_goods_report', 'job_work_report']
      },
      contractor: {
        invoice_format: 'contract_based',
        item_master: {
          type: 'service',
          fields: ['work_description', 'contract_type', 'hsn_sac', 'rate', 'unit', 'labour_charges', 'material_charges'],
          required_fields: ['work_description', 'hsn_sac', 'rate']
        },
        client_fields: ['client_name', 'project_name', 'gstin', 'pan', 'email', 'phone', 'site_address', 'contract_value', 'work_order_no'],
        invoice_fields: ['client', 'work_details', 'labour_charges', 'material_charges', 'tds', 'gst', 'total'],
        gst_compliance: {
          reverse_charge: true,
          tds_applicable: true,
          composition_scheme_eligible: false
        },
        calculations: {
          discount_type: 'amount',
          tax_calculation: 'exclusive',
          round_off: true,
          retention_money: true,
          advance_adjustment: true
        },
        reports: ['work_completion_report', 'project_wise_billing', 'tds_deducted_report']
      }
    };

    return configs[businessType] || configs.professional;
  };

  useEffect(() => {
    fetchTenantConfig();
  }, []);

  const refreshConfig = () => {
    fetchTenantConfig();
  };

  return {
    businessConfig,
    currentTenant,
    loading,
    error,
    refreshConfig
  };
};

export default useBusinessConfig;