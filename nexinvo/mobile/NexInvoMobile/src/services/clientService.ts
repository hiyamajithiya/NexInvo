import apiClient from './api';
import { API_ENDPOINTS } from './api';
import { Client } from '../store/slices/clientSlice';

class ClientService {
  async getClients(): Promise<Client[]> {
    const response = await apiClient.get(API_ENDPOINTS.CLIENTS);
    return response.data.results || response.data;
  }

  async getClientById(id: string): Promise<Client> {
    const response = await apiClient.get(API_ENDPOINTS.CLIENT_DETAIL(id));
    return response.data;
  }

  async createClient(clientData: Partial<Client>): Promise<Client> {
    const response = await apiClient.post(API_ENDPOINTS.CLIENTS, clientData);
    return response.data;
  }

  async updateClient(id: string, clientData: Partial<Client>): Promise<Client> {
    const response = await apiClient.patch(API_ENDPOINTS.CLIENT_DETAIL(id), clientData);
    return response.data;
  }

  async deleteClient(id: string): Promise<void> {
    await apiClient.delete(API_ENDPOINTS.CLIENT_DETAIL(id));
  }

  async searchClients(query: string): Promise<Client[]> {
    const response = await apiClient.get(`${API_ENDPOINTS.CLIENTS}?search=${query}`);
    return response.data.results || response.data;
  }

  async getClientInvoices(clientId: string): Promise<any[]> {
    const response = await apiClient.get(`${API_ENDPOINTS.INVOICES}?client=${clientId}`);
    return response.data.results || response.data;
  }
}

export const clientService = new ClientService();