import { createSlice, PayloadAction, createAsyncThunk } from '@reduxjs/toolkit';
import { invoiceService } from '../../services/invoiceService';

export interface Invoice {
  id: string;
  invoice_number: string;
  series: string;
  number: string;
  client: string;
  client_name: string;
  date: string;
  due_date: string;
  items: InvoiceItem[];
  subtotal: number;
  tax_amount: number;
  grand_total: number;
  payment_status: 'pending' | 'partial' | 'paid' | 'overdue';
  invoice_type: 'standard' | 'proforma' | 'credit_note' | 'debit_note';
  currency: string;
}

export interface InvoiceItem {
  id: string;
  description: string;
  hsn_code?: string;
  quantity: number;
  unit_price: number;
  tax_rate: number;
  total: number;
}

interface InvoiceState {
  invoices: Invoice[];
  currentInvoice: Invoice | null;
  isLoading: boolean;
  error: string | null;
  filters: {
    status?: string;
    client?: string;
    dateFrom?: string;
    dateTo?: string;
  };
  offlineQueue: Invoice[];
}

const initialState: InvoiceState = {
  invoices: [],
  currentInvoice: null,
  isLoading: false,
  error: null,
  filters: {},
  offlineQueue: [],
};

// Async thunks
export const fetchInvoices = createAsyncThunk(
  'invoices/fetchAll',
  async (filters?: any) => {
    const response = await invoiceService.getInvoices(filters);
    return response;
  }
);

export const fetchInvoiceById = createAsyncThunk(
  'invoices/fetchById',
  async (id: string) => {
    const response = await invoiceService.getInvoiceById(id);
    return response;
  }
);

export const createInvoice = createAsyncThunk(
  'invoices/create',
  async (invoiceData: Partial<Invoice>) => {
    const response = await invoiceService.createInvoice(invoiceData);
    return response;
  }
);

export const updateInvoice = createAsyncThunk(
  'invoices/update',
  async ({ id, data }: { id: string; data: Partial<Invoice> }) => {
    const response = await invoiceService.updateInvoice(id, data);
    return response;
  }
);

export const deleteInvoice = createAsyncThunk(
  'invoices/delete',
  async (id: string) => {
    await invoiceService.deleteInvoice(id);
    return id;
  }
);

const invoiceSlice = createSlice({
  name: 'invoices',
  initialState,
  reducers: {
    setCurrentInvoice: (state, action: PayloadAction<Invoice | null>) => {
      state.currentInvoice = action.payload;
    },
    setFilters: (state, action: PayloadAction<typeof initialState.filters>) => {
      state.filters = action.payload;
    },
    clearFilters: (state) => {
      state.filters = {};
    },
    addToOfflineQueue: (state, action: PayloadAction<Invoice>) => {
      state.offlineQueue.push(action.payload);
    },
    clearOfflineQueue: (state) => {
      state.offlineQueue = [];
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch invoices
      .addCase(fetchInvoices.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchInvoices.fulfilled, (state, action) => {
        state.isLoading = false;
        state.invoices = action.payload;
      })
      .addCase(fetchInvoices.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message || 'Failed to fetch invoices';
      })
      // Fetch single invoice
      .addCase(fetchInvoiceById.fulfilled, (state, action) => {
        state.currentInvoice = action.payload;
      })
      // Create invoice
      .addCase(createInvoice.fulfilled, (state, action) => {
        state.invoices.unshift(action.payload);
      })
      // Update invoice
      .addCase(updateInvoice.fulfilled, (state, action) => {
        const index = state.invoices.findIndex(inv => inv.id === action.payload.id);
        if (index !== -1) {
          state.invoices[index] = action.payload;
        }
        if (state.currentInvoice?.id === action.payload.id) {
          state.currentInvoice = action.payload;
        }
      })
      // Delete invoice
      .addCase(deleteInvoice.fulfilled, (state, action) => {
        state.invoices = state.invoices.filter(inv => inv.id !== action.payload);
      });
  },
});

export const {
  setCurrentInvoice,
  setFilters,
  clearFilters,
  addToOfflineQueue,
  clearOfflineQueue,
} = invoiceSlice.actions;

export default invoiceSlice.reducer;