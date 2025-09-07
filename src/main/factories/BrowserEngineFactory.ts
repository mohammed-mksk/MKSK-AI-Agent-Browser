/**
 * Browser Engine Factory
 * 
 * Purpose: Factory pattern implementation for creating browser automation engines.
 * This factory provides a centralized way to create and configure different
 * browser engines (Puppeteer, BrowserUse) based on user preferences and
 * system capabilities.
 * 
 * The factory handles engine-specific configurations, error handling for
 * unsupported engines, and provides a consistent interface for engine creation.
 */

import { IBrowserEngine, BrowserEngineConfig, BrowserEngineType, IBrowserEngineFactory } from '../interfaces/IBrowserEngine.js';
import { BrowserUseService } from '../services/BrowserUseService.js';
import { PuppeteerEngineWrapper } from '../services/PuppeteerEngineWrapper.js';
import { AIBrowserEngine, AIBrowserEngineConfig } from '../services/AIBrowserEngine.js';
import { Logger } from '../services/Logger.js';

export class BrowserEngineFactory implements IBrowserEngineFactory {
  private static logger = new Logger();

  /**
   * Create a browser engine instance based on the specified type
   * @param engineType The type of browser engine to create
   * @param config Configuration options for the engine
   * @returns Promise resolving to a browser engine instance
   */
  async createEngine(
    engineType: BrowserEngineType, 
    config: BrowserEngineConfig = {}
  ): Promise<IBrowserEngine> {
    
    BrowserEngineFactory.logger.info(`Creating browser engine: ${engineType}`);

    try {
      switch (engineType) {
        case BrowserEngineType.AI_BROWSER:
          return await BrowserEngineFactory.createAIBrowserEngine(config);
          
        case BrowserEngineType.BROWSER_USE:
          return await BrowserEngineFactory.createBrowserUseEngine(config);
          
        case BrowserEngineType.PUPPETEER:
          return await BrowserEngineFactory.createPuppeteerEngine(config);
          
        default:
          throw new Error(`Unsupported browser engine type: ${engineType}`);
      }
    } catch (error) {
      BrowserEngineFactory.logger.error(`Failed to create browser engine ${engineType}:`, error);
      throw error;
    }
  }

  /**
   * Create a BrowserUse engine instance
   * @param config Configuration for BrowserUse
   * @returns Promise resolving to BrowserUse service
   */
  private static async createBrowserUseEngine(config: BrowserEngineConfig): Promise<IBrowserEngine> {
    try {
      const browserUseConfig: BrowserEngineConfig = {
        headless: false,
        timeout: 30000,
        viewport: { width: 1366, height: 768 },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        enableStealth: true,
        ...config
      };

      const engine = new BrowserUseService(browserUseConfig);
      
      // Test if BrowserUse is available
      try {
        await engine.initialize();
        this.logger.info('BrowserUse engine created successfully');
        return engine;
      } catch (initError) {
        this.logger.error('BrowserUse initialization failed:', initError);
        await engine.cleanup();
        throw new Error(`BrowserUse not available: ${initError instanceof Error ? initError.message : 'Unknown error'}`);
      }
      
    } catch (error) {
      this.logger.error('Failed to create BrowserUse engine:', error);
      throw error;
    }
  }

  /**
   * Create a Puppeteer engine instance (wrapper around existing service)
   * @param config Configuration for Puppeteer
   * @returns Promise resolving to Puppeteer service
   */
  private static async createPuppeteerEngine(config: BrowserEngineConfig): Promise<IBrowserEngine> {
    try {
      // Import the existing BrowserAutomationService and wrap it
      const { PuppeteerEngineWrapper } = await import('../services/PuppeteerEngineWrapper.js');
      
      const puppeteerConfig: BrowserEngineConfig = {
        headless: false,
        timeout: 30000,
        viewport: { width: 1366, height: 768 },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        enableStealth: true,
        ...config
      };

      const engine = new PuppeteerEngineWrapper(puppeteerConfig);
      await engine.initialize();
      
      this.logger.info('Puppeteer engine created successfully');
      return engine;
      
    } catch (error) {
      this.logger.error('Failed to create Puppeteer engine:', error);
      throw error;
    }
  }

  /**
   * Create an AI Browser engine instance
   * @param config Configuration for AI Browser
   * @returns Promise resolving to AI Browser service
   */
  private static async createAIBrowserEngine(config: BrowserEngineConfig): Promise<IBrowserEngine> {
    try {
      const aiConfig: AIBrowserEngineConfig = {
        headless: false,
        timeout: 60000,
        viewport: { width: 1366, height: 768 },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        enableStealth: true,
        aiProvider: 'openai',
        fallbackEngine: 'puppeteer',
        enableLearning: true,
        enableMultiSite: true,
        performanceOptimization: true,
        ...config
      };

      // Pass the aiProviderManager to the AIBrowserEngine constructor
      const engine = config.aiProviderManager 
        ? new AIBrowserEngine(aiConfig, config.aiProviderManager)
        : new AIBrowserEngine(aiConfig);
      
      await engine.initialize();
      
      this.logger.info('AI Browser engine created successfully');
      return engine;
      
    } catch (error) {
      this.logger.error('Failed to create AI Browser engine:', error);
      throw error;
    }
  }

  /**
   * Get list of supported engine types
   */
  getSupportedEngines(): BrowserEngineType[] {
    return [BrowserEngineType.AI_BROWSER, BrowserEngineType.PUPPETEER, BrowserEngineType.BROWSER_USE];
  }

  /**
   * Check if a specific engine type is available
   */
  async isEngineAvailable(engineType: BrowserEngineType): Promise<boolean> {
    try {
      switch (engineType) {
        case BrowserEngineType.AI_BROWSER:
          const testAI = new AIBrowserEngine();
          await testAI.initialize();
          const aiTest = await testAI.testEngine();
          await testAI.cleanup();
          return aiTest;
          
        case BrowserEngineType.BROWSER_USE:
          const testBrowserUse = new BrowserUseService();
          await testBrowserUse.testEngine();
          await testBrowserUse.cleanup();
          return true;
          
        case BrowserEngineType.PUPPETEER:
          const testPuppeteer = new PuppeteerEngineWrapper();
          await testPuppeteer.testEngine();
          await testPuppeteer.cleanup();
          return true;
          
        default:
          return false;
      }
    } catch (error) {
      BrowserEngineFactory.logger.warn(`Engine ${engineType} is not available:`, error);
      return false;
    }
  }

  /**
   * Get available browser engines on the current system
   * @returns Promise resolving to array of available engine types
   */
  static async getAvailableEngines(): Promise<BrowserEngineType[]> {
    const availableEngines: BrowserEngineType[] = [];

    // Test AI Browser availability
    try {
      const testAI = new AIBrowserEngine();
      await testAI.initialize();
      const aiTest = await testAI.testEngine();
      await testAI.cleanup();
      
      if (aiTest) {
        availableEngines.push(BrowserEngineType.AI_BROWSER);
        this.logger.info('AI Browser is available');
      }
    } catch (error) {
      this.logger.warn('AI Browser is not available:', error);
    }

    // Test BrowserUse availability
    try {
      const testEngine = new BrowserUseService();
      await testEngine.initialize();
      await testEngine.cleanup();
      availableEngines.push(BrowserEngineType.BROWSER_USE);
      this.logger.info('BrowserUse is available');
    } catch (error) {
      this.logger.warn('BrowserUse is not available:', error);
    }

    // Puppeteer should always be available (it's our fallback)
    availableEngines.push(BrowserEngineType.PUPPETEER);
    this.logger.info('Puppeteer is available');

    return availableEngines;
  }

  /**
   * Get the recommended engine based on system capabilities and preferences
   * @returns Promise resolving to recommended engine type
   */
  static async getRecommendedEngine(): Promise<BrowserEngineType> {
    const availableEngines = await this.getAvailableEngines();
    
    // Prefer AI Browser if available (most advanced)
    if (availableEngines.includes(BrowserEngineType.AI_BROWSER)) {
      this.logger.info('Recommending AI Browser engine');
      return BrowserEngineType.AI_BROWSER;
    }
    
    // Prefer BrowserUse if available (better cookie handling)
    if (availableEngines.includes(BrowserEngineType.BROWSER_USE)) {
      this.logger.info('Recommending BrowserUse engine');
      return BrowserEngineType.BROWSER_USE;
    }
    
    // Fallback to Puppeteer
    this.logger.info('Recommending Puppeteer engine');
    return BrowserEngineType.PUPPETEER;
  }

  /**
   * Validate engine configuration
   * @param engineType The engine type to validate config for
   * @param config The configuration to validate
   * @returns Boolean indicating if config is valid
   */
  static validateConfig(engineType: BrowserEngineType, config: BrowserEngineConfig): boolean {
    try {
      // Basic validation
      if (config.timeout && (config.timeout < 1000 || config.timeout > 300000)) {
        this.logger.warn('Invalid timeout value, should be between 1000-300000ms');
        return false;
      }

      if (config.viewport) {
        if (config.viewport.width < 100 || config.viewport.width > 4000) {
          this.logger.warn('Invalid viewport width, should be between 100-4000px');
          return false;
        }
        if (config.viewport.height < 100 || config.viewport.height > 4000) {
          this.logger.warn('Invalid viewport height, should be between 100-4000px');
          return false;
        }
      }

      // Engine-specific validation
      switch (engineType) {
        case BrowserEngineType.AI_BROWSER:
          // AI Browser specific validation
          if (config.apiKey && typeof config.apiKey !== 'string') {
            this.logger.warn('Invalid API key format for AI Browser');
            return false;
          }
          break;
          
        case BrowserEngineType.BROWSER_USE:
          // BrowserUse specific validation
          break;
          
        case BrowserEngineType.PUPPETEER:
          // Puppeteer specific validation
          break;
      }

      return true;
    } catch (error) {
      this.logger.error('Config validation failed:', error);
      return false;
    }
  }
}