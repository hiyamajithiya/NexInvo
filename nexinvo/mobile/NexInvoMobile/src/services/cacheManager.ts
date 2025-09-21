import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';

interface CacheItem<T = any> {
  data: T;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
  version: string;
  size: number; // Estimated size in bytes
  accessCount: number;
  lastAccessed: number;
  priority: 'high' | 'medium' | 'low';
}

interface CacheConfig {
  maxSize: number; // Maximum cache size in bytes
  defaultTTL: number; // Default TTL in milliseconds
  maxItems: number; // Maximum number of items
  compressionThreshold: number; // Compress items larger than this
  enablePersistence: boolean;
  enableCompression: boolean;
}

interface CacheStats {
  totalItems: number;
  totalSize: number;
  hitRate: number;
  missRate: number;
  evictionCount: number;
  compressionRatio: number;
}

class CacheManager {
  private cache = new Map<string, CacheItem>();
  private cacheHits = 0;
  private cacheMisses = 0;
  private evictionCount = 0;
  private compressionStats = { originalSize: 0, compressedSize: 0 };

  private config: CacheConfig = {
    maxSize: 50 * 1024 * 1024, // 50MB
    defaultTTL: 30 * 60 * 1000, // 30 minutes
    maxItems: 1000,
    compressionThreshold: 10 * 1024, // 10KB
    enablePersistence: true,
    enableCompression: true,
  };

  private persistenceKeys = {
    cache: 'cache_data',
    metadata: 'cache_metadata',
  };

  async initialize(): Promise<void> {
    try {
      await this.loadCacheFromStorage();
      await this.setupPeriodicCleanup();
      console.log('Cache manager initialized');
    } catch (error) {
      console.error('Failed to initialize cache manager:', error);
    }
  }

  // Core cache operations
  async set<T>(
    key: string,
    data: T,
    options: {
      ttl?: number;
      priority?: 'high' | 'medium' | 'low';
      persist?: boolean;
    } = {}
  ): Promise<void> {
    const {
      ttl = this.config.defaultTTL,
      priority = 'medium',
      persist = this.config.enablePersistence,
    } = options;

    try {
      const serializedData = JSON.stringify(data);
      const size = this.calculateSize(serializedData);
      const now = Date.now();

      // Compress large items if enabled
      const finalData = this.config.enableCompression && size > this.config.compressionThreshold
        ? await this.compressData(serializedData)
        : serializedData;

      const cacheItem: CacheItem<T> = {
        data: data,
        timestamp: now,
        ttl,
        version: '1.0',
        size: this.calculateSize(finalData),
        accessCount: 0,
        lastAccessed: now,
        priority,
      };

      // Check if we need to evict items
      await this.ensureCapacity(cacheItem.size);

      // Store in memory cache
      this.cache.set(key, cacheItem);

      // Persist to storage if enabled
      if (persist) {
        await this.persistCacheItem(key, cacheItem);
      }

      console.log(`Cached item: ${key} (${this.formatSize(size)})`);
    } catch (error) {
      console.error(`Failed to cache item ${key}:`, error);
    }
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      let cacheItem = this.cache.get(key);

      // Try loading from persistent storage if not in memory
      if (!cacheItem && this.config.enablePersistence) {
        cacheItem = await this.loadCacheItemFromStorage(key);
        if (cacheItem) {
          this.cache.set(key, cacheItem);
        }
      }

      if (!cacheItem) {
        this.cacheMisses++;
        return null;
      }

      // Check if item has expired
      const now = Date.now();
      if (now - cacheItem.timestamp > cacheItem.ttl) {
        await this.delete(key);
        this.cacheMisses++;
        return null;
      }

      // Update access statistics
      cacheItem.accessCount++;
      cacheItem.lastAccessed = now;

      this.cacheHits++;
      return cacheItem.data as T;
    } catch (error) {
      console.error(`Failed to get cached item ${key}:`, error);
      this.cacheMisses++;
      return null;
    }
  }

  async delete(key: string): Promise<boolean> {
    try {
      const deleted = this.cache.delete(key);

      if (this.config.enablePersistence) {
        await AsyncStorage.removeItem(`${this.persistenceKeys.cache}_${key}`);
      }

      return deleted;
    } catch (error) {
      console.error(`Failed to delete cached item ${key}:`, error);
      return false;
    }
  }

  async clear(): Promise<void> {
    try {
      this.cache.clear();

      if (this.config.enablePersistence) {
        const keys = await AsyncStorage.getAllKeys();
        const cacheKeys = keys.filter(key =>
          key.startsWith(this.persistenceKeys.cache) ||
          key.startsWith(this.persistenceKeys.metadata)
        );
        await AsyncStorage.multiRemove(cacheKeys);
      }

      this.resetStats();
      console.log('Cache cleared');
    } catch (error) {
      console.error('Failed to clear cache:', error);
    }
  }

  // Advanced cache operations
  async getOrFetch<T>(
    key: string,
    fetchFunction: () => Promise<T>,
    options: {
      ttl?: number;
      priority?: 'high' | 'medium' | 'low';
      staleWhileRevalidate?: boolean;
    } = {}
  ): Promise<T> {
    const { staleWhileRevalidate = false } = options;

    // Try to get from cache first
    const cachedData = await this.get<T>(key);

    if (cachedData) {
      // If stale-while-revalidate is enabled, update in background
      if (staleWhileRevalidate) {
        this.backgroundRefresh(key, fetchFunction, options);
      }
      return cachedData;
    }

    // Fetch new data
    try {
      const freshData = await fetchFunction();
      await this.set(key, freshData, options);
      return freshData;
    } catch (error) {
      console.error(`Failed to fetch data for key ${key}:`, error);
      throw error;
    }
  }

  async invalidatePattern(pattern: string): Promise<number> {
    const regex = new RegExp(pattern);
    const keysToDelete: string[] = [];

    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      await this.delete(key);
    }

    console.log(`Invalidated ${keysToDelete.length} items matching pattern: ${pattern}`);
    return keysToDelete.length;
  }

  async prefetch<T>(
    key: string,
    fetchFunction: () => Promise<T>,
    options: { ttl?: number; priority?: 'high' | 'medium' | 'low' } = {}
  ): Promise<void> {
    // Only prefetch if not already cached
    const existingData = await this.get<T>(key);
    if (existingData) {
      return;
    }

    try {
      const data = await fetchFunction();
      await this.set(key, data, { ...options, priority: 'low' });
      console.log(`Prefetched data for key: ${key}`);
    } catch (error) {
      console.error(`Failed to prefetch data for key ${key}:`, error);
    }
  }

  // Cache maintenance
  private async ensureCapacity(newItemSize: number): Promise<void> {
    const currentSize = this.getCurrentCacheSize();
    const currentItems = this.cache.size;

    // Check size limit
    if (currentSize + newItemSize > this.config.maxSize) {
      await this.evictLRU(newItemSize);
    }

    // Check item count limit
    if (currentItems >= this.config.maxItems) {
      await this.evictLRU(0);
    }
  }

  private async evictLRU(sizeNeeded: number): Promise<void> {
    const items = Array.from(this.cache.entries())
      .map(([key, item]) => ({ key, ...item }))
      .sort((a, b) => {
        // Sort by priority first, then by last accessed time
        const priorityOrder = { high: 3, medium: 2, low: 1 };
        const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];

        if (priorityDiff !== 0) {
          return priorityDiff; // Higher priority items last
        }

        return a.lastAccessed - b.lastAccessed; // Older items first
      });

    let freedSpace = 0;
    let evicted = 0;

    for (const item of items) {
      if (freedSpace >= sizeNeeded && this.cache.size < this.config.maxItems) {
        break;
      }

      await this.delete(item.key);
      freedSpace += item.size;
      evicted++;
      this.evictionCount++;
    }

    console.log(`Evicted ${evicted} items, freed ${this.formatSize(freedSpace)}`);
  }

  private async backgroundRefresh<T>(
    key: string,
    fetchFunction: () => Promise<T>,
    options: { ttl?: number; priority?: 'high' | 'medium' | 'low' } = {}
  ): Promise<void> {
    setTimeout(async () => {
      try {
        const freshData = await fetchFunction();
        await this.set(key, freshData, options);
        console.log(`Background refresh completed for key: ${key}`);
      } catch (error) {
        console.error(`Background refresh failed for key ${key}:`, error);
      }
    }, 0);
  }

  // Persistence layer
  private async loadCacheFromStorage(): Promise<void> {
    if (!this.config.enablePersistence) return;

    try {
      const metadataJson = await AsyncStorage.getItem(this.persistenceKeys.metadata);
      if (!metadataJson) return;

      const metadata = JSON.parse(metadataJson);
      const keys = metadata.keys || [];

      for (const key of keys) {
        const cacheItem = await this.loadCacheItemFromStorage(key);
        if (cacheItem) {
          // Check if item is still valid
          const now = Date.now();
          if (now - cacheItem.timestamp <= cacheItem.ttl) {
            this.cache.set(key, cacheItem);
          }
        }
      }

      console.log(`Loaded ${this.cache.size} items from persistent cache`);
    } catch (error) {
      console.error('Failed to load cache from storage:', error);
    }
  }

  private async loadCacheItemFromStorage(key: string): Promise<CacheItem | null> {
    try {
      const itemJson = await AsyncStorage.getItem(`${this.persistenceKeys.cache}_${key}`);
      if (!itemJson) return null;

      const item = JSON.parse(itemJson);

      // Decompress if needed
      if (typeof item.data === 'string' && item.data.startsWith('compressed:')) {
        item.data = await this.decompressData(item.data);
      }

      return item;
    } catch (error) {
      console.error(`Failed to load cache item ${key} from storage:`, error);
      return null;
    }
  }

  private async persistCacheItem(key: string, cacheItem: CacheItem): Promise<void> {
    try {
      const itemJson = JSON.stringify(cacheItem);
      await AsyncStorage.setItem(`${this.persistenceKeys.cache}_${key}`, itemJson);

      // Update metadata
      const metadataJson = await AsyncStorage.getItem(this.persistenceKeys.metadata);
      const metadata = metadataJson ? JSON.parse(metadataJson) : { keys: [] };

      if (!metadata.keys.includes(key)) {
        metadata.keys.push(key);
        await AsyncStorage.setItem(this.persistenceKeys.metadata, JSON.stringify(metadata));
      }
    } catch (error) {
      console.error(`Failed to persist cache item ${key}:`, error);
    }
  }

  // Compression utilities
  private async compressData(data: string): Promise<string> {
    try {
      // Simple compression using LZ-string could be implemented here
      // For now, we'll use base64 encoding as a placeholder
      const compressed = `compressed:${btoa(data)}`;

      this.compressionStats.originalSize += data.length;
      this.compressionStats.compressedSize += compressed.length;

      return compressed;
    } catch (error) {
      console.error('Compression failed:', error);
      return data;
    }
  }

  private async decompressData(compressedData: string): Promise<any> {
    try {
      if (compressedData.startsWith('compressed:')) {
        const base64Data = compressedData.substring('compressed:'.length);
        const decompressed = atob(base64Data);
        return JSON.parse(decompressed);
      }
      return JSON.parse(compressedData);
    } catch (error) {
      console.error('Decompression failed:', error);
      return null;
    }
  }

  // Utility methods
  private calculateSize(data: string): number {
    return new Blob([data]).size;
  }

  private getCurrentCacheSize(): number {
    let totalSize = 0;
    for (const item of this.cache.values()) {
      totalSize += item.size;
    }
    return totalSize;
  }

  private formatSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(1)} ${units[unitIndex]}`;
  }

  private async setupPeriodicCleanup(): Promise<void> {
    // Clean up expired items every 5 minutes
    setInterval(async () => {
      await this.cleanupExpiredItems();
    }, 5 * 60 * 1000);

    // Full cache maintenance every hour
    setInterval(async () => {
      await this.performMaintenance();
    }, 60 * 60 * 1000);
  }

  private async cleanupExpiredItems(): Promise<void> {
    const now = Date.now();
    const expiredKeys: string[] = [];

    for (const [key, item] of this.cache.entries()) {
      if (now - item.timestamp > item.ttl) {
        expiredKeys.push(key);
      }
    }

    for (const key of expiredKeys) {
      await this.delete(key);
    }

    if (expiredKeys.length > 0) {
      console.log(`Cleaned up ${expiredKeys.length} expired cache items`);
    }
  }

  private async performMaintenance(): Promise<void> {
    console.log('Performing cache maintenance...');

    await this.cleanupExpiredItems();

    // Check if cache size is within limits
    const currentSize = this.getCurrentCacheSize();
    if (currentSize > this.config.maxSize * 0.8) { // 80% threshold
      await this.evictLRU(0);
    }

    console.log('Cache maintenance completed');
  }

  private resetStats(): void {
    this.cacheHits = 0;
    this.cacheMisses = 0;
    this.evictionCount = 0;
    this.compressionStats = { originalSize: 0, compressedSize: 0 };
  }

  // Analytics and monitoring
  getStats(): CacheStats {
    const totalRequests = this.cacheHits + this.cacheMisses;
    const hitRate = totalRequests > 0 ? this.cacheHits / totalRequests : 0;
    const compressionRatio = this.compressionStats.originalSize > 0
      ? this.compressionStats.compressedSize / this.compressionStats.originalSize
      : 1;

    return {
      totalItems: this.cache.size,
      totalSize: this.getCurrentCacheSize(),
      hitRate: Math.round(hitRate * 100) / 100,
      missRate: Math.round((1 - hitRate) * 100) / 100,
      evictionCount: this.evictionCount,
      compressionRatio: Math.round(compressionRatio * 100) / 100,
    };
  }

  getCacheKeys(): string[] {
    return Array.from(this.cache.keys());
  }

  updateConfig(newConfig: Partial<CacheConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log('Cache configuration updated:', this.config);
  }

  // Network-aware caching
  async getWithNetworkFallback<T>(
    key: string,
    fetchFunction: () => Promise<T>,
    options: { ttl?: number; priority?: 'high' | 'medium' | 'low' } = {}
  ): Promise<T> {
    const cachedData = await this.get<T>(key);

    // Return cached data if available
    if (cachedData) {
      return cachedData;
    }

    // Check network connectivity
    const netInfo = await NetInfo.fetch();

    if (!netInfo.isConnected) {
      throw new Error('No cached data available and device is offline');
    }

    // Fetch fresh data
    const freshData = await fetchFunction();
    await this.set(key, freshData, options);
    return freshData;
  }
}

export const cacheManager = new CacheManager();