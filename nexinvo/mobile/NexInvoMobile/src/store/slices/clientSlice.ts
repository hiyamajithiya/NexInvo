import { createSlice, PayloadAction, createAsyncThunk } from '@reduxjs/toolkit';
import { clientService } from '../../services/clientService';

export interface Client {
  id: string;
  client_code: string;
  name: string;
  email: string;
  phone: string;
  client_type: 'individual' | 'business';
  gstin?: string;
  pan?: string;
  billing_address: string;
  shipping_address?: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
}

interface ClientState {
  clients: Client[];
  currentClient: Client | null;
  isLoading: boolean;
  error: string | null;
  searchQuery: string;
}

const initialState: ClientState = {
  clients: [],
  currentClient: null,
  isLoading: false,
  error: null,
  searchQuery: '',
};

// Async thunks
export const fetchClients = createAsyncThunk(
  'clients/fetchAll',
  async () => {
    const response = await clientService.getClients();
    return response;
  }
);

export const createClient = createAsyncThunk(
  'clients/create',
  async (clientData: Partial<Client>) => {
    const response = await clientService.createClient(clientData);
    return response;
  }
);

const clientSlice = createSlice({
  name: 'clients',
  initialState,
  reducers: {
    setCurrentClient: (state, action: PayloadAction<Client | null>) => {
      state.currentClient = action.payload;
    },
    setSearchQuery: (state, action: PayloadAction<string>) => {
      state.searchQuery = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchClients.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchClients.fulfilled, (state, action) => {
        state.isLoading = false;
        state.clients = action.payload;
      })
      .addCase(fetchClients.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message || 'Failed to fetch clients';
      })
      .addCase(createClient.fulfilled, (state, action) => {
        state.clients.push(action.payload);
      });
  },
});

export const { setCurrentClient, setSearchQuery } = clientSlice.actions;
export default clientSlice.reducer;