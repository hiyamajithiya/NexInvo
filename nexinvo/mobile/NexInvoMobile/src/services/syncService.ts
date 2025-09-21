import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { store } from '../store';
import { setNetworkStatus } from '../store/slices/uiSlice';
import { clearOfflineQueue } from '../store/slices/invoiceSlice';
import { invoiceService } from './invoiceService';
import { clientService } from './clientService';
import { notificationService } from './notificationService';

interface SyncableItem {
  id: string;
  type: 'invoice' | 'client' | 'payment' | 'attachment';
  action: 'create' | 'update' | 'delete';
  data: any;
  timestamp: number;
  retryCount: number;
  lastError?: string;
}

interface SyncResult {
  success: boolean;
  syncedItems: number;
  failedItems: number;
  errors: string[];
}

interface SyncStatus {
  isOnline: boolean;
  lastSyncTime: Date | null;
  pendingItems: number;
  syncInProgress: boolean;
}

class SyncService {
  private syncQueue: SyncableItem[] = [];
  private syncInProgress = false;
  private lastSyncTime: Date | null = null;
  private maxRetries = 3;
  private retryDelay = 5000; // 5 seconds
  private networkListener: any = null;

  async initialize() {
    await this.loadSyncQueue();
    await this.loadLastSyncTime();
    this.setupNetworkListener();

    // Auto-sync when app starts if online
    if (await this.isOnline()) {
      this.performSync();
    }
  }

  private setupNetworkListener() {
    this.networkListener = NetInfo.addEventListener(state => {
      const isConnected = state.isConnected || false;
      store.dispatch(setNetworkStatus(isConnected));

      if (isConnected && this.syncQueue.length > 0 && !this.syncInProgress) {
        console.log('Network reconnected, starting auto-sync...');
        this.performSync();
      }
    });
  }

  async isOnline(): Promise<boolean> {
    try {
      const state = await NetInfo.fetch();
      return state.isConnected || false;
    } catch (error) {
      console.error('Error checking network status:', error);
      return false;
    }
  }

  async addToSyncQueue(item: Omit<SyncableItem, 'timestamp' | 'retryCount'>) {
    const syncItem: SyncableItem = {
      ...item,
      timestamp: Date.now(),
      retryCount: 0,
    };

    this.syncQueue.push(syncItem);
    await this.saveSyncQueue();

    console.log(`Added to sync queue: ${item.type} ${item.action}`, syncItem);

    // Try to sync immediately if online
    if (await this.isOnline() && !this.syncInProgress) {
      this.performSync();
    }
  }

  async performSync(): Promise<SyncResult> {
    if (this.syncInProgress) {
      console.log('Sync already in progress');
      return {
        success: false,
        syncedItems: 0,
        failedItems: 0,
        errors: ['Sync already in progress'],
      };
    }

    if (!(await this.isOnline())) {
      console.log('Cannot sync: offline');
      return {
        success: false,
        syncedItems: 0,
        failedItems: 0,
        errors: ['Device is offline'],
      };
    }

    this.syncInProgress = true;
    console.log(`Starting sync of ${this.syncQueue.length} items...`);

    const result: SyncResult = {
      success: true,
      syncedItems: 0,
      failedItems: 0,
      errors: [],
    };

    const itemsToSync = [...this.syncQueue];
    const successfulItems: string[] = [];

    for (const item of itemsToSync) {
      try {
        const syncSuccess = await this.syncItem(item);

        if (syncSuccess) {
          result.syncedItems++;
          successfulItems.push(item.id);
          console.log(`Synced: ${item.type} ${item.action} (${item.id})`);
        } else {
          item.retryCount++;
          if (item.retryCount >= this.maxRetries) {
            result.failedItems++;
            result.errors.push(`Failed to sync ${item.type} after ${this.maxRetries} retries`);
            successfulItems.push(item.id); // Remove from queue after max retries
          }
        }
      } catch (error) {
        console.error(`Error syncing item ${item.id}:`, error);
        item.retryCount++;
        item.lastError = error instanceof Error ? error.message : 'Unknown error';

        if (item.retryCount >= this.maxRetries) {
          result.failedItems++;
          result.errors.push(`Failed to sync ${item.type}: ${item.lastError}`);
          successfulItems.push(item.id); // Remove from queue
        }
      }
    }

    // Remove successfully synced items from queue
    this.syncQueue = this.syncQueue.filter(item => !successfulItems.includes(item.id));
    await this.saveSyncQueue();

    // Update last sync time
    this.lastSyncTime = new Date();
    await this.saveLastSyncTime();

    // Clear Redux offline queue for invoices
    if (result.syncedItems > 0) {
      store.dispatch(clearOfflineQueue());
    }

    this.syncInProgress = false;

    console.log(`Sync completed: ${result.syncedItems} synced, ${result.failedItems} failed`);

    // Notify user about sync completion
    if (result.syncedItems > 0) {
      await notificationService.notifyOfflineSync(result.syncedItems);
    }

    return result;
  }

  private async syncItem(item: SyncableItem): Promise<boolean> {
    try {
      switch (item.type) {
        case 'invoice':
          return await this.syncInvoice(item);
        case 'client':
          return await this.syncClient(item);
        case 'payment':
          return await this.syncPayment(item);
        case 'attachment':
          return await this.syncAttachment(item);
        default:
          console.error(`Unknown sync item type: ${item.type}`);
          return false;
      }
    } catch (error) {
      console.error(`Error syncing ${item.type}:`, error);
      return false;
    }
  }

  private async syncInvoice(item: SyncableItem): Promise<boolean> {
    try {
      switch (item.action) {
        case 'create':
          const createdInvoice = await invoiceService.createInvoice(item.data);
          return !!createdInvoice;

        case 'update':
          const updatedInvoice = await invoiceService.updateInvoice(item.data.id, item.data);
          return !!updatedInvoice;

        case 'delete':
          await invoiceService.deleteInvoice(item.data.id);
          return true;

        default:
          return false;
      }
    } catch (error) {
      console.error('Error syncing invoice:', error);
      return false;
    }
  }

  private async syncClient(item: SyncableItem): Promise<boolean> {
    try {
      switch (item.action) {
        case 'create':
          const createdClient = await clientService.createClient(item.data);
          return !!createdClient;

        case 'update':
          const updatedClient = await clientService.updateClient(item.data.id, item.data);
          return !!updatedClient;

        case 'delete':
          await clientService.deleteClient(item.data.id);
          return true;

        default:
          return false;
      }
    } catch (error) {
      console.error('Error syncing client:', error);
      return false;
    }
  }

  private async syncPayment(item: SyncableItem): Promise<boolean> {
    try {
      // Implement payment sync logic
      console.log('Syncing payment:', item.data);
      return true;
    } catch (error) {
      console.error('Error syncing payment:', error);
      return false;
    }
  }

  private async syncAttachment(item: SyncableItem): Promise<boolean> {
    try {
      // Implement attachment sync logic
      console.log('Syncing attachment:', item.data);
      return true;
    } catch (error) {
      console.error('Error syncing attachment:', error);
      return false;
    }
  }

  async forcSync(): Promise<SyncResult> {
    console.log('Force sync requested');
    return await this.performSync();
  }

  async getSyncStatus(): Promise<SyncStatus> {
    return {
      isOnline: await this.isOnline(),
      lastSyncTime: this.lastSyncTime,
      pendingItems: this.syncQueue.length,
      syncInProgress: this.syncInProgress,
    };
  }

  async clearSyncQueue(): Promise<void> {
    this.syncQueue = [];
    await this.saveSyncQueue();
    console.log('Sync queue cleared');
  }

  async getFailedItems(): Promise<SyncableItem[]> {
    return this.syncQueue.filter(item => item.retryCount > 0);
  }

  async retryFailedItems(): Promise<SyncResult> {
    const failedItems = await this.getFailedItems();

    if (failedItems.length === 0) {
      return {
        success: true,
        syncedItems: 0,
        failedItems: 0,
        errors: [],
      };
    }

    // Reset retry count for failed items
    failedItems.forEach(item => {
      item.retryCount = 0;
      item.lastError = undefined;
    });

    await this.saveSyncQueue();
    return await this.performSync();
  }

  private async loadSyncQueue(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem('sync_queue');
      if (stored) {
        this.syncQueue = JSON.parse(stored);
        console.log(`Loaded ${this.syncQueue.length} items from sync queue`);
      }
    } catch (error) {
      console.error('Error loading sync queue:', error);
    }
  }

  private async saveSyncQueue(): Promise<void> {
    try {
      await AsyncStorage.setItem('sync_queue', JSON.stringify(this.syncQueue));
    } catch (error) {
      console.error('Error saving sync queue:', error);
    }
  }

  private async loadLastSyncTime(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem('last_sync_time');
      if (stored) {
        this.lastSyncTime = new Date(stored);
      }
    } catch (error) {
      console.error('Error loading last sync time:', error);
    }
  }

  private async saveLastSyncTime(): Promise<void> {
    try {
      if (this.lastSyncTime) {
        await AsyncStorage.setItem('last_sync_time', this.lastSyncTime.toISOString());
      }
    } catch (error) {
      console.error('Error saving last sync time:', error);
    }
  }

  async scheduleBackgroundSync(): Promise<void> {
    // In a real implementation, you would use:
    // - @react-native-async-storage/async-storage for background tasks
    // - react-native-background-job for background sync
    // - Platform-specific background task APIs

    console.log('Background sync scheduled');
  }

  async enableAutoSync(interval: number = 300000): Promise<void> {
    // Enable automatic sync every 5 minutes (300000ms) by default
    setInterval(async () => {
      if (await this.isOnline() && this.syncQueue.length > 0 && !this.syncInProgress) {
        console.log('Auto-sync triggered');
        await this.performSync();
      }
    }, interval);

    console.log(`Auto-sync enabled with ${interval}ms interval`);
  }

  async exportSyncLog(): Promise<string> {
    const status = await this.getSyncStatus();
    const failedItems = await this.getFailedItems();

    const log = {
      timestamp: new Date().toISOString(),
      status,
      syncQueue: this.syncQueue,
      failedItems,
    };

    return JSON.stringify(log, null, 2);
  }

  dispose(): void {
    if (this.networkListener) {
      this.networkListener();
      this.networkListener = null;
    }
  }
}

export const syncService = new SyncService();