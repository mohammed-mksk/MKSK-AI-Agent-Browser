/**
 * Resource management service for browser pooling and caching
 */
import { Browser, Page } from 'puppeteer';
import { Logger } from './Logger.js';
import { PerformanceMonitor } from './PerformanceMonitor.js';

export interface BrowserPool {
  browsers: Browser[];
  availableBrowsers: Browser[];
  busyBrowsers: Set<Browser>;
  maxBrowsers: number;
}

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
  accessCount: number;
}

export interface ResourceStats {
  browserPool: {
    total: number;
    available: number;
    busy: number;
  };
  cache: {
    entries: number;
    hitRate: number;
    totalSize: number; // Estimated size in bytes
  };
  memory: {
    used: number;
    available: number;
  };
}

export class ResourceManager {
  private logger: Logger;
  private performanceMonitor: PerformanceMonitor;
  private browserPool: BrowserPool;
  private cache: Map<string, CacheEntry<any>> = new Map();
  private cacheHits: number = 0;
  private cacheMisses: number = 0;
  private maxCacheSize: number = 1000;
  private defaultTTL: number = 300000; // 5 minutes
  private cleanupInterval: NodeJS.Timeout | null = null;
  
  constructor(performanceMonitor: PerformanceMonitor) {
    this.logger = new Logger();
    this.performanceMonitor = performanceMonitor;
    this.browserPool = {
      browsers: [],
      availableBrowsers: [],
      busyBrowsers: new Set(),
      maxBrowsers: 3
    };
    
    // Start cleanup interval
    this.startCleanupInterval();
  }
  
  /**
   * Initialize the resource manager
   */
  async initialize(): Promise<void> {
    this.logger.info('Initializing ResourceManager...');
    
    // Pre-warm the browser pool with one browser
    try {
      await this.ensureMinimumBrowsers(1);
      this.logger.info('ResourceManager initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize ResourceManager:', error);
      throw error;
    }
  }
  
  /**
   * Get a browser from the pool
   */
  async getBrowser(): Promise<Browser> {
    // Check if we can create a new browser instance
    if (!this.performanceMonitor.canCreateBrowserInstance()) {
      throw new Error('Browser instance limit reached');
    }
    
    // Try to get an available browser
    let browser = this.browserPool.availableBrowsers.pop();
    
    if (!browser) {
      // Create a new browser if we haven't reached the limit
      if (this.browserPool.browsers.length < this.browserPool.maxBrowsers) {
        browser = await this.createBrowser();
        this.browserPool.browsers.push(browser);
      } else {
        // Wait for a browser to become available
        browser = await this.waitForAvailableBrowser();
      }
    }
    
    // Mark browser as busy
    this.browserPool.busyBrowsers.add(browser);
    
    // Update performance monitor
    this.performanceMonitor.trackBrowsers(
      this.browserPool.browsers.length,
      await this.getTotalPageCount()
    );
    
    return browser;
  }
  
  /**
   * Return a browser to the pool
   */
  async releaseBrowser(browser: Browser): Promise<void> {
    if (!this.browserPool.busyBrowsers.has(browser)) {
      this.logger.warn('Attempting to release browser that is not marked as busy');
      return;
    }
    
    // Mark browser as available
    this.browserPool.busyBrowsers.delete(browser);
    
    // Check if browser is still valid
    if (browser.isConnected()) {
      // Close any extra pages (keep only one)
      const pages = await browser.pages();
      for (let i = 1; i < pages.length; i++) {
        try {
          await pages[i].close();
        } catch (error) {
          this.logger.warn('Failed to close page:', error);
        }
      }
      
      this.browserPool.availableBrowsers.push(browser);
    } else {
      // Remove disconnected browser from pool
      const index = this.browserPool.browsers.indexOf(browser);
      if (index > -1) {
        this.browserPool.browsers.splice(index, 1);
      }
      
      this.logger.info('Removed disconnected browser from pool');
    }
    
    // Update performance monitor
    this.performanceMonitor.trackBrowsers(
      this.browserPool.browsers.length,
      await this.getTotalPageCount()
    );
  }
  
  /**
   * Cache data with optional TTL
   */
  setCache<T>(key: string, data: T, ttl?: number): void {
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl: ttl || this.defaultTTL,
      accessCount: 0
    };
    
    this.cache.set(key, entry);
    
    // Cleanup if cache is too large
    if (this.cache.size > this.maxCacheSize) {
      this.cleanupCache();
    }
  }
  
  /**
   * Get data from cache
   */
  getCache<T>(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.cacheMisses++;
      return null;
    }
    
    // Check if entry has expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      this.cacheMisses++;
      return null;
    }
    
    // Update access count and return data
    entry.accessCount++;
    this.cacheHits++;
    return entry.data as T;
  }
  
  /**
   * Clear cache entry
   */
  clearCache(key: string): boolean {
    return this.cache.delete(key);
  }
  
  /**
   * Clear all cache
   */
  clearAllCache(): void {
    this.cache.clear();
    this.cacheHits = 0;
    this.cacheMisses = 0;
    this.logger.info('Cache cleared');
  }
  
  /**
   * Get resource statistics
   */
  async getStats(): Promise<ResourceStats> {
    const totalRequests = this.cacheHits + this.cacheMisses;
    const hitRate = totalRequests > 0 ? (this.cacheHits / totalRequests) * 100 : 0;
    
    return {
      browserPool: {
        total: this.browserPool.browsers.length,
        available: this.browserPool.availableBrowsers.length,
        busy: this.browserPool.busyBrowsers.size
      },
      cache: {
        entries: this.cache.size,
        hitRate: Math.round(hitRate * 100) / 100,
        totalSize: this.estimateCacheSize()
      },
      memory: {
        used: process.memoryUsage().heapUsed,
        available: process.memoryUsage().heapTotal - process.memoryUsage().heapUsed
      }
    };
  }
  
  /**
   * Optimize resources
   */
  async optimize(): Promise<void> {
    this.logger.info('Optimizing resources...');
    
    // Clean up cache
    this.cleanupCache();
    
    // Close excess browsers
    await this.closeExcessBrowsers();
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
    
    this.logger.info('Resource optimization completed');
  }
  
  /**
   * Shutdown and cleanup all resources
   */
  async shutdown(): Promise<void> {
    this.logger.info('Shutting down ResourceManager...');
    
    // Stop cleanup interval
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    
    // Close all browsers
    const closePromises = this.browserPool.browsers.map(async (browser) => {
      try {
        await browser.close();
      } catch (error) {
        this.logger.warn('Failed to close browser during shutdown:', error);
      }
    });
    
    await Promise.all(closePromises);
    
    // Clear all data
    this.browserPool.browsers = [];
    this.browserPool.availableBrowsers = [];
    this.browserPool.busyBrowsers.clear();
    this.clearAllCache();
    
    this.logger.info('ResourceManager shutdown completed');
  }
  
  /**
   * Create a new browser instance
   */
  private async createBrowser(): Promise<Browser> {
    const puppeteer = await import('puppeteer');
    
    const browser = await puppeteer.launch({
      headless: true,
      args: [
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu'
      ]
    });
    
    this.logger.info('Created new browser instance');
    return browser;
  }
  
  /**
   * Wait for an available browser
   */
  private async waitForAvailableBrowser(timeout: number = 30000): Promise<Browser> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      const browser = this.browserPool.availableBrowsers.pop();
      if (browser) {
        return browser;
      }
      
      // Wait a bit before checking again
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    throw new Error('Timeout waiting for available browser');
  }
  
  /**
   * Ensure minimum number of browsers in pool
   */
  private async ensureMinimumBrowsers(minimum: number): Promise<void> {
    while (this.browserPool.browsers.length < minimum) {
      try {
        const browser = await this.createBrowser();
        this.browserPool.browsers.push(browser);
        this.browserPool.availableBrowsers.push(browser);
      } catch (error) {
        this.logger.error('Failed to create browser for minimum pool:', error);
        break;
      }
    }
  }
  
  /**
   * Get total page count across all browsers
   */
  private async getTotalPageCount(): Promise<number> {
    let totalPages = 0;
    
    for (const browser of this.browserPool.browsers) {
      try {
        if (browser.isConnected()) {
          const pages = await browser.pages();
          totalPages += pages.length;
        }
      } catch (error) {
        // Browser might be disconnected
      }
    }
    
    return totalPages;
  }
  
  /**
   * Close excess browsers to free resources
   */
  private async closeExcessBrowsers(): Promise<void> {
    const maxBrowsers = Math.max(1, this.browserPool.maxBrowsers - 1);
    
    while (this.browserPool.availableBrowsers.length > maxBrowsers) {
      const browser = this.browserPool.availableBrowsers.pop();
      if (browser) {
        try {
          await browser.close();
          const index = this.browserPool.browsers.indexOf(browser);
          if (index > -1) {
            this.browserPool.browsers.splice(index, 1);
          }
          this.logger.info('Closed excess browser');
        } catch (error) {
          this.logger.warn('Failed to close excess browser:', error);
        }
      }
    }
  }
  
  /**
   * Cleanup expired cache entries
   */
  private cleanupCache(): void {
    const now = Date.now();
    let removedCount = 0;
    
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
        removedCount++;
      }
    }
    
    // If still too large, remove least recently used entries
    if (this.cache.size > this.maxCacheSize) {
      const entries = Array.from(this.cache.entries());
      entries.sort((a, b) => a[1].accessCount - b[1].accessCount);
      
      const toRemove = this.cache.size - this.maxCacheSize;
      for (let i = 0; i < toRemove; i++) {
        this.cache.delete(entries[i][0]);
        removedCount++;
      }
    }
    
    if (removedCount > 0) {
      this.logger.info(`Cleaned up ${removedCount} cache entries`);
    }
  }
  
  /**
   * Estimate cache size in bytes
   */
  private estimateCacheSize(): number {
    let totalSize = 0;
    
    for (const entry of this.cache.values()) {
      // Rough estimation - in a real implementation you'd use a proper size calculation
      totalSize += JSON.stringify(entry.data).length * 2; // Rough estimate for UTF-16
    }
    
    return totalSize;
  }
  
  /**
   * Start cleanup interval
   */
  private startCleanupInterval(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupCache();
    }, 60000); // Cleanup every minute
  }
}