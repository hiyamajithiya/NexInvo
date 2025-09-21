import { createSlice, PayloadAction, createAsyncThunk } from '@reduxjs/toolkit';
import { integrationService } from '../../services/integrationService';

export interface Integration {
  id: string;
  name: string;
  integration_type: 'tally' | 'zoho' | 'dynamics365' | 'webhook';
  is_active: boolean;
  configuration: Record<string, any>;
  last_sync_at: string | null;
  sync_status: string;
}

interface IntegrationState {
  integrations: Integration[];
  isLoading: boolean;
  error: string | null;
  syncStatus: Record<string, boolean>;
}

const initialState: IntegrationState = {
  integrations: [],
  isLoading: false,
  error: null,
  syncStatus: {},
};

// Async thunks
export const fetchIntegrations = createAsyncThunk(
  'integrations/fetchAll',
  async () => {
    const response = await integrationService.getIntegrations();
    return response;
  }
);

export const testConnection = createAsyncThunk(
  'integrations/testConnection',
  async (integrationId: string) => {
    const response = await integrationService.testConnection(integrationId);
    return { integrationId, result: response };
  }
);

export const exportToTally = createAsyncThunk(
  'integrations/exportTally',
  async (invoiceIds: string[]) => {
    const response = await integrationService.exportToTally(invoiceIds);
    return response;
  }
);

const integrationSlice = createSlice({
  name: 'integrations',
  initialState,
  reducers: {
    setSyncStatus: (state, action: PayloadAction<{ id: string; status: boolean }>) => {
      state.syncStatus[action.payload.id] = action.payload.status;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchIntegrations.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchIntegrations.fulfilled, (state, action) => {
        state.isLoading = false;
        state.integrations = action.payload;
      })
      .addCase(fetchIntegrations.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message || 'Failed to fetch integrations';
      });
  },
});

export const { setSyncStatus } = integrationSlice.actions;
export default integrationSlice.reducer;