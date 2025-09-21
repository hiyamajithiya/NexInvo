import { Image, Dimensions, Platform } from 'react-native';
import { cacheManager } from './cacheManager';

interface ImageOptimizationOptions {
  quality: number; // 0-100
  maxWidth?: number;
  maxHeight?: number;
  format?: 'JPEG' | 'PNG' | 'WEBP';
  progressive?: boolean;
  allowUpscaling?: boolean;
  maintainAspectRatio?: boolean;
}

interface OptimizedImage {
  uri: string;
  width: number;
  height: number;
  size: number;
  originalSize: number;
  compressionRatio: number;
  format: string;
}

interface ImageLoadingState {
  loading: boolean;
  progress: number;
  error: Error | null;
  retryCount: number;
}

interface ImageCacheItem {
  uri: string;
  optimizedUri?: string;
  width: number;
  height: number;
  size: number;
  lastUsed: number;
  downloadTime: number;
}

class ImageOptimizationService {
  private imageCache = new Map<string, ImageCacheItem>();
  private loadingStates = new Map<string, ImageLoadingState>();
  private downloadQueue = new Set<string>();
  private readonly maxConcurrentDownloads = 3;
  private activeDownloads = 0;

  private readonly screenDimensions = Dimensions.get('window');
  private readonly devicePixelRatio = Platform.OS === 'ios' ? 2 : 3;

  // Optimize image for device and usage context
  async optimizeImage(
    imageUri: string,
    options: ImageOptimizationOptions = {}
  ): Promise<OptimizedImage> {
    const {
      quality = 80,
      maxWidth = this.screenDimensions.width * this.devicePixelRatio,
      maxHeight = this.screenDimensions.height * this.devicePixelRatio,
      format = 'JPEG',
      progressive = true,
      allowUpscaling = false,
      maintainAspectRatio = true,
    } = options;

    try {
      // Check if already optimized and cached
      const cacheKey = this.generateCacheKey(imageUri, options);
      const cachedOptimized = await cacheManager.get<OptimizedImage>(cacheKey);

      if (cachedOptimized) {
        console.log(`Using cached optimized image: ${imageUri}`);
        return cachedOptimized;
      }

      // Get original image dimensions
      const originalDimensions = await this.getImageDimensions(imageUri);
      const originalSize = await this.getImageSize(imageUri);

      // Calculate optimal dimensions
      const targetDimensions = this.calculateOptimalDimensions(
        originalDimensions,
        { maxWidth, maxHeight, allowUpscaling, maintainAspectRatio }
      );

      // Only optimize if necessary
      const needsOptimization = this.shouldOptimize(
        originalDimensions,
        targetDimensions,
        originalSize,
        quality
      );

      if (!needsOptimization) {
        const result: OptimizedImage = {
          uri: imageUri,
          width: originalDimensions.width,
          height: originalDimensions.height,
          size: originalSize,
          originalSize,
          compressionRatio: 1,
          format: this.getImageFormat(imageUri),
        };

        // Cache the result
        await cacheManager.set(cacheKey, result, {
          ttl: 24 * 60 * 60 * 1000, // 24 hours
          priority: 'medium',
        });

        return result;
      }

      // Perform optimization
      const optimizedUri = await this.performImageOptimization(
        imageUri,
        targetDimensions,
        quality,
        format,
        progressive
      );

      const optimizedSize = await this.getImageSize(optimizedUri);
      const compressionRatio = originalSize > 0 ? optimizedSize / originalSize : 1;

      const result: OptimizedImage = {
        uri: optimizedUri,
        width: targetDimensions.width,
        height: targetDimensions.height,
        size: optimizedSize,
        originalSize,
        compressionRatio,
        format,
      };

      // Cache the optimized result
      await cacheManager.set(cacheKey, result, {
        ttl: 7 * 24 * 60 * 60 * 1000, // 7 days for optimized images
        priority: 'high',
      });

      console.log(
        `Optimized image: ${imageUri} -> ${this.formatSize(originalSize)} to ${this.formatSize(optimizedSize)} (${Math.round(compressionRatio * 100)}%)`
      );

      return result;
    } catch (error) {
      console.error('Image optimization failed:', error);
      throw error;
    }
  }

  // Progressive image loading with placeholders
  async loadImageProgressively(
    imageUri: string,
    onProgress?: (progress: number) => void,
    onError?: (error: Error) => void
  ): Promise<OptimizedImage> {
    const cacheKey = `progressive_${imageUri}`;

    try {
      // Set initial loading state
      this.setLoadingState(imageUri, {
        loading: true,
        progress: 0,
        error: null,
        retryCount: 0,
      });

      // First, try to load a low-quality placeholder
      const placeholderOptions: ImageOptimizationOptions = {
        quality: 30,
        maxWidth: 50,
        maxHeight: 50,
      };

      onProgress?.(10);

      // Generate and cache placeholder
      const placeholderKey = this.generateCacheKey(imageUri, placeholderOptions);
      let placeholder = await cacheManager.get<OptimizedImage>(placeholderKey);

      if (!placeholder) {
        try {
          placeholder = await this.optimizeImage(imageUri, placeholderOptions);
          onProgress?.(30);
        } catch (error) {
          console.warn('Failed to generate placeholder:', error);
        }
      }

      // Load full-quality image
      onProgress?.(50);

      const fullQualityOptions: ImageOptimizationOptions = {
        quality: 85,
        maxWidth: this.screenDimensions.width * this.devicePixelRatio,
        maxHeight: this.screenDimensions.height * this.devicePixelRatio,
      };

      const optimizedImage = await this.optimizeImage(imageUri, fullQualityOptions);

      onProgress?.(100);

      // Update loading state
      this.setLoadingState(imageUri, {
        loading: false,
        progress: 100,
        error: null,
        retryCount: 0,
      });

      return optimizedImage;
    } catch (error) {
      const loadingState = this.loadingStates.get(imageUri);
      const newRetryCount = (loadingState?.retryCount || 0) + 1;

      this.setLoadingState(imageUri, {
        loading: false,
        progress: 0,
        error: error instanceof Error ? error : new Error('Unknown error'),
        retryCount: newRetryCount,
      });

      onError?.(error instanceof Error ? error : new Error('Unknown error'));
      throw error;
    }
  }

  // Batch image optimization
  async optimizeBatch(
    imageUris: string[],
    options: ImageOptimizationOptions = {},
    onProgress?: (completed: number, total: number) => void
  ): Promise<OptimizedImage[]> {
    const results: OptimizedImage[] = [];
    const batchSize = 5; // Process 5 images at a time

    for (let i = 0; i < imageUris.length; i += batchSize) {
      const batch = imageUris.slice(i, i + batchSize);

      const batchPromises = batch.map(async (uri) => {
        try {
          const optimized = await this.optimizeImage(uri, options);
          return optimized;
        } catch (error) {
          console.error(`Failed to optimize image ${uri}:`, error);
          // Return original image info as fallback
          return {
            uri,
            width: 0,
            height: 0,
            size: 0,
            originalSize: 0,
            compressionRatio: 1,
            format: 'JPEG',
          } as OptimizedImage;
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      onProgress?.(results.length, imageUris.length);
    }

    return results;
  }

  // Smart image preloading based on screen visibility
  async preloadVisibleImages(
    imageUris: string[],
    viewportHeight: number,
    itemHeight: number,
    scrollOffset: number
  ): Promise<void> {
    const visibleStartIndex = Math.floor(scrollOffset / itemHeight);
    const visibleEndIndex = Math.ceil((scrollOffset + viewportHeight) / itemHeight);

    // Preload visible images + buffer
    const bufferSize = 5;
    const startIndex = Math.max(0, visibleStartIndex - bufferSize);
    const endIndex = Math.min(imageUris.length - 1, visibleEndIndex + bufferSize);

    const imagesToPreload = imageUris.slice(startIndex, endIndex + 1);

    for (const imageUri of imagesToPreload) {
      if (!this.imageCache.has(imageUri) && !this.downloadQueue.has(imageUri)) {
        this.queueImageDownload(imageUri);
      }
    }
  }

  // Adaptive quality based on network conditions
  getAdaptiveQuality(): number {
    // This would integrate with network monitoring
    // For now, return default based on platform
    if (Platform.OS === 'ios') {
      return 85; // Higher quality for iOS
    } else {
      return 75; // Slightly lower for Android to save memory
    }
  }

  // Image format detection and conversion
  private getImageFormat(uri: string): string {
    const extension = uri.split('.').pop()?.toLowerCase();
    switch (extension) {
      case 'jpg':
      case 'jpeg':
        return 'JPEG';
      case 'png':
        return 'PNG';
      case 'webp':
        return 'WEBP';
      default:
        return 'JPEG';
    }
  }

  // Calculate optimal dimensions maintaining aspect ratio
  private calculateOptimalDimensions(
    original: { width: number; height: number },
    constraints: {
      maxWidth?: number;
      maxHeight?: number;
      allowUpscaling?: boolean;
      maintainAspectRatio?: boolean;
    }
  ): { width: number; height: number } {
    const {
      maxWidth = original.width,
      maxHeight = original.height,
      allowUpscaling = false,
      maintainAspectRatio = true,
    } = constraints;

    let { width, height } = original;

    if (!allowUpscaling) {
      width = Math.min(width, maxWidth);
      height = Math.min(height, maxHeight);
    }

    if (maintainAspectRatio) {
      const aspectRatio = original.width / original.height;

      if (width / height > aspectRatio) {
        width = height * aspectRatio;
      } else {
        height = width / aspectRatio;
      }

      // Ensure we don't exceed constraints
      if (width > maxWidth) {
        width = maxWidth;
        height = width / aspectRatio;
      }

      if (height > maxHeight) {
        height = maxHeight;
        width = height * aspectRatio;
      }
    }

    return {
      width: Math.round(width),
      height: Math.round(height),
    };
  }

  // Check if image needs optimization
  private shouldOptimize(
    original: { width: number; height: number },
    target: { width: number; height: number },
    originalSize: number,
    quality: number
  ): boolean {
    // Optimize if dimensions are significantly different
    const dimensionChange = Math.abs(original.width - target.width) / original.width;
    if (dimensionChange > 0.1) return true;

    // Optimize if file is large
    const sizeMB = originalSize / (1024 * 1024);
    if (sizeMB > 1) return true;

    // Optimize if quality is below 90
    if (quality < 90) return true;

    return false;
  }

  // Mock image optimization (replace with actual implementation)
  private async performImageOptimization(
    uri: string,
    dimensions: { width: number; height: number },
    quality: number,
    format: string,
    progressive: boolean
  ): Promise<string> {
    // In a real implementation, you would use:
    // - react-native-image-manipulator
    // - react-native-image-resizer
    // - Native image processing APIs

    // For now, return the original URI as we can't actually process
    console.log(`Mock optimization: ${uri} -> ${dimensions.width}x${dimensions.height} @ ${quality}%`);
    return uri;
  }

  // Get image dimensions
  private async getImageDimensions(uri: string): Promise<{ width: number; height: number }> {
    return new Promise((resolve, reject) => {
      Image.getSize(
        uri,
        (width, height) => resolve({ width, height }),
        (error) => reject(error)
      );
    });
  }

  // Estimate image file size
  private async getImageSize(uri: string): Promise<number> {
    try {
      // In a real implementation, you would fetch the actual file size
      // For now, estimate based on dimensions and format
      const dimensions = await this.getImageDimensions(uri);
      const pixels = dimensions.width * dimensions.height;

      // Rough estimates in bytes
      const format = this.getImageFormat(uri);
      switch (format) {
        case 'JPEG':
          return pixels * 0.5; // Compressed
        case 'PNG':
          return pixels * 2; // Lossless
        case 'WEBP':
          return pixels * 0.3; // Highly compressed
        default:
          return pixels;
      }
    } catch (error) {
      console.error('Failed to get image size:', error);
      return 0;
    }
  }

  // Queue management for downloads
  private async queueImageDownload(uri: string): Promise<void> {
    if (this.downloadQueue.has(uri) || this.activeDownloads >= this.maxConcurrentDownloads) {
      return;
    }

    this.downloadQueue.add(uri);
    this.activeDownloads++;

    try {
      await this.optimizeImage(uri, {
        quality: this.getAdaptiveQuality(),
        maxWidth: this.screenDimensions.width,
        maxHeight: this.screenDimensions.height,
      });
    } catch (error) {
      console.error(`Failed to preload image ${uri}:`, error);
    } finally {
      this.downloadQueue.delete(uri);
      this.activeDownloads--;

      // Process next item in queue
      if (this.downloadQueue.size > 0 && this.activeDownloads < this.maxConcurrentDownloads) {
        const nextUri = this.downloadQueue.values().next().value;
        if (nextUri) {
          this.queueImageDownload(nextUri);
        }
      }
    }
  }

  // Utility methods
  private generateCacheKey(uri: string, options: ImageOptimizationOptions): string {
    const optionsHash = JSON.stringify(options);
    return `optimized_image_${btoa(uri)}_${btoa(optionsHash)}`;
  }

  private setLoadingState(uri: string, state: ImageLoadingState): void {
    this.loadingStates.set(uri, state);
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

  // Public API methods
  getLoadingState(uri: string): ImageLoadingState | null {
    return this.loadingStates.get(uri) || null;
  }

  clearCache(): void {
    this.imageCache.clear();
    this.loadingStates.clear();
    this.downloadQueue.clear();
  }

  getStats(): {
    cachedImages: number;
    activeDownloads: number;
    queuedDownloads: number;
    totalCacheSize: number;
  } {
    let totalSize = 0;
    for (const item of this.imageCache.values()) {
      totalSize += item.size;
    }

    return {
      cachedImages: this.imageCache.size,
      activeDownloads: this.activeDownloads,
      queuedDownloads: this.downloadQueue.size,
      totalCacheSize: totalSize,
    };
  }
}

export const imageOptimization = new ImageOptimizationService();