import puppeteer, { Browser, Page } from 'puppeteer-core';
import { BrowserOptions, ScreenshotOptions } from '../../shared/types.js';
import { BROWSER_DEFAULTS } from '../../shared/constants.js';
import { Logger } from './Logger.js';
import { ErrorHandler } from './ErrorHandler.js';
import { ResourceManager } from './ResourceManager.js';
import { PerformanceMonitor } from './PerformanceMonitor.js';

interface BrowserInstance {
  id: string;
  browser: Browser;
  pages: Page[];
  createdAt: Date;
  lastUsed: Date;
}

export class BrowserManager {
  private browsers: Map<string, BrowserInstance> = new Map();
  private logger: Logger;
  private errorHandler: ErrorHandler;
  private resourceManager: ResourceManager;
  private performanceMonitor: PerformanceMonitor;
  private maxConcurrentBrowsers: number;

  constructor(maxConcurrent: number = BROWSER_DEFAULTS.MAX_CONCURRENT) {
    this.logger = new Logger();
    this.errorHandler = new ErrorHandler();
    this.performanceMonitor = new PerformanceMonitor();
    this.resourceManager = new ResourceManager(this.performanceMonitor);
    this.maxConcurrentBrowsers = maxConcurrent;
  }

  async initialize(): Promise<void> {
    await this.resourceManager.initialize();
    this.performanceMonitor.startMonitoring();
  }

  async createBrowser(options?: BrowserOptions): Promise<Browser> {
    return this.errorHandler.executeWithRecovery(
      async () => {
        // Use ResourceManager to get a browser from the pool
        const browser = await this.resourceManager.getBrowser();
        const browserId = `browser_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

        const instance: BrowserInstance = {
          id: browserId,
          browser,
          pages: [],
          createdAt: new Date(),
          lastUsed: new Date()
        };

        this.browsers.set(browserId, instance);
        
        this.logger.info(`Browser obtained from pool: ${browserId}`);
        return browser;
      },
      {
        operation: 'createBrowser',
        timestamp: new Date(),
        metadata: { options }
      },
      {
        type: 'retry',
        maxAttempts: 3,
        delay: 2000
      }
    );
  }

  async createPage(browser: Browser): Promise<Page> {
    return this.errorHandler.executeWithRecovery(
      async () => {
        const page = await browser.newPage();
        
        // Set default timeout
        page.setDefaultTimeout(BROWSER_DEFAULTS.TIMEOUT);
        
        // Set viewport
        await page.setViewport(BROWSER_DEFAULTS.VIEWPORT);
        
        // Block unnecessary resources to improve performance
        await page.setRequestInterception(true);
        page.on('request', (request) => {
          const resourceType = request.resourceType();
          if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
            request.abort();
          } else {
            request.continue();
          }
        });

        // Add page to browser instance tracking
        const browserInstance = this.findBrowserInstance(browser);
        if (browserInstance) {
          browserInstance.pages.push(page);
          browserInstance.lastUsed = new Date();
        }

        // Handle popups and CAPTCHA detection
        page.on('load', async () => {
          try {
            await this.errorHandler.handlePopups(page);
            
            const hasCaptcha = await this.errorHandler.detectCaptcha(page);
            if (hasCaptcha) {
              await this.errorHandler.handleCaptcha(page, {
                operation: 'handleCaptcha',
                url: page.url(),
                timestamp: new Date()
              });
            }
          } catch (error) {
            this.logger.warn('Error in page load handler:', error);
          }
        });

        this.logger.debug('Page created successfully');
        return page;
      },
      {
        operation: 'createPage',
        timestamp: new Date()
      },
      {
        type: 'retry',
        maxAttempts: 2,
        delay: 1000
      }
    );
  }

  async closeBrowser(browser: Browser): Promise<void> {
    try {
      const browserInstance = this.findBrowserInstance(browser);
      
      if (browserInstance) {
        // Close all pages first
        for (const page of browserInstance.pages) {
          try {
            await page.close();
          } catch (error) {
            this.logger.warn('Failed to close page:', error);
          }
        }
        
        // Return browser to resource manager pool instead of closing
        await this.resourceManager.releaseBrowser(browser);
        
        // Remove from tracking
        this.browsers.delete(browserInstance.id);
        
        this.logger.info(`Browser returned to pool: ${browserInstance.id}`);
      } else {
        // Browser not tracked, return to pool anyway
        await this.resourceManager.releaseBrowser(browser);
        this.logger.info('Untracked browser returned to pool');
      }
    } catch (error) {
      this.logger.error('Failed to close browser:', error);
    }
  }

  async takeScreenshot(url: string, options?: ScreenshotOptions): Promise<Buffer> {
    let browser: Browser | null = null;
    let page: Page | null = null;

    try {
      browser = await this.createBrowser();
      page = await this.createPage(browser);
      
      await page.goto(url, { waitUntil: 'networkidle2' });
      
      const screenshotOptions: any = {
        fullPage: options?.fullPage ?? true,
        type: options?.type ?? 'png'
      };
      
      if (options?.quality !== undefined) {
        screenshotOptions.quality = options.quality;
      }
      
      const screenshot = await page.screenshot(screenshotOptions);
      return Buffer.from(screenshot);
    } catch (error) {
      this.logger.error('Failed to take screenshot:', error);
      throw error;
    } finally {
      if (browser) {
        await this.closeBrowser(browser);
      }
    }
  }

  async getStatus(): Promise<any> {
    const status = {
      totalBrowsers: this.browsers.size,
      maxConcurrent: this.maxConcurrentBrowsers,
      browsers: Array.from(this.browsers.values()).map(instance => ({
        id: instance.id,
        pageCount: instance.pages.length,
        createdAt: instance.createdAt,
        lastUsed: instance.lastUsed,
        uptime: Date.now() - instance.createdAt.getTime()
      }))
    };

    return status;
  }

  async cleanup(): Promise<void> {
    this.logger.info('Starting browser cleanup...');
    
    const closePromises = Array.from(this.browsers.values()).map(async (instance) => {
      try {
        await this.closeBrowser(instance.browser);
      } catch (error) {
        this.logger.error(`Failed to close browser ${instance.id}:`, error);
      }
    });

    await Promise.all(closePromises);
    this.browsers.clear();
    
    this.logger.info('Browser cleanup completed');
  }

  private findBrowserInstance(browser: Browser): BrowserInstance | undefined {
    for (const instance of this.browsers.values()) {
      if (instance.browser === browser) {
        return instance;
      }
    }
    return undefined;
  }

  private async cleanupOldestBrowser(): Promise<void> {
    if (this.browsers.size === 0) return;

    // Find the oldest browser
    let oldestInstance: BrowserInstance | null = null;
    let oldestTime = Date.now();

    for (const instance of this.browsers.values()) {
      if (instance.lastUsed.getTime() < oldestTime) {
        oldestTime = instance.lastUsed.getTime();
        oldestInstance = instance;
      }
    }

    if (oldestInstance) {
      this.logger.info(`Cleaning up oldest browser: ${oldestInstance.id}`);
      await this.closeBrowser(oldestInstance.browser);
    }
  }

  // Utility method to handle timeouts
  async handleTimeout(page: Page, timeout: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Operation timed out after ${timeout}ms`));
      }, timeout);

      // Clear timeout when page is ready
      page.once('load', () => {
        clearTimeout(timer);
        resolve();
      });
    });
  }

  // Method to configure page for specific use cases
  async configurePage(page: Page, config: {
    blockImages?: boolean;
    blockCSS?: boolean;
    userAgent?: string;
    viewport?: { width: number; height: number };
  }): Promise<void> {
    if (config.userAgent) {
      await page.setUserAgent(config.userAgent);
    }

    if (config.viewport) {
      await page.setViewport(config.viewport);
    }

    if (config.blockImages || config.blockCSS) {
      await page.setRequestInterception(true);
      page.on('request', (request) => {
        const resourceType = request.resourceType();
        
        if (config.blockImages && resourceType === 'image') {
          request.abort();
        } else if (config.blockCSS && resourceType === 'stylesheet') {
          request.abort();
        } else {
          request.continue();
        }
      });
    }
  }
}