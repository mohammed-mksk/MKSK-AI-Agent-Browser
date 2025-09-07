/**
 * Browser Automation Service
 * 
 * Purpose: Main service for browser automation that uses the factory pattern
 * to switch between different browser engines (Puppeteer, BrowserUse) based
 * on user preferences. This service maintains backward compatibility while
 * providing access to advanced AI-powered automation capabilities.
 * 
 * Features:
 * - Factory pattern for browser engine selection
 * - Settings-based engine switching
 * - Backward compatibility with existing code
 * - Comprehensive error handling and logging
 */

import { Logger } from './Logger.js';
import { ExecutionPlan, AutomationResult } from '../../shared/types.js';
import { IBrowserEngine, BrowserEngineType } from '../interfaces/IBrowserEngine.js';
import { BrowserEngineFactory } from '../factories/BrowserEngineFactory.js';
import { AIProviderManager } from './AIProviderManager.js';

export class BrowserAutomationService {
  private browserEngine: IBrowserEngine | null = null;
  private logger: Logger;
  private _isRunning: boolean = false;
  private factory: BrowserEngineFactory;
  private aiProviderManager: AIProviderManager;

  constructor(aiProviderManager: AIProviderManager) {
    this.logger = new Logger();
    this.factory = new BrowserEngineFactory();
    this.aiProviderManager = aiProviderManager;
    
    this.logger.info(`BrowserAutomationService initialized with AIProviderManager: ${aiProviderManager ? 'provided' : 'missing'}`);
  }

  async initialize(): Promise<void> {
    try {
      this.logger.info('Starting browser automation service initialization...');
      
      // Clean up any existing browser engine
      if (this.browserEngine) {
        await this.cleanup();
      }
      
      // Get browser engine preference from settings (with fallback to Puppeteer)
      const selectedEngine = await this.getSelectedBrowserEngine();
      this.logger.info(`Using browser engine: ${selectedEngine}`);
      
      // Create engine using factory with proper AIProviderManager injection
      const config = {
        headless: false,
        timeout: 60000,
        viewport: { width: 1366, height: 768 },
        apiKey: process.env['OPENAI_API_KEY'] || process.env['ANTHROPIC_API_KEY'] || process.env['GEMINI_API_KEY'],
        aiProviderManager: this.aiProviderManager
      };
      
      this.logger.info(`Creating ${selectedEngine} engine with AIProviderManager: ${this.aiProviderManager ? 'available' : 'not available'}`);
      
      this.browserEngine = await this.factory.createEngine(selectedEngine, config);
      
      // Initialize the browser engine
      await this.browserEngine.initialize();
      
      this.logger.info('Browser automation service initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize browser automation service:', error);
      throw error;
    }
  }

  private async getSelectedBrowserEngine(): Promise<BrowserEngineType> {
    try {
      // Try to get the setting from the database (used by the Settings page)
      const { DatabaseService } = await import('./DatabaseService.js');
      const db = new DatabaseService();
      await db.initialize();
      
      const browserEngine = await db.getSetting('browserEngine');
      await db.close();
      
      if (browserEngine) {
        this.logger.info(`Using browser engine from settings: ${browserEngine}`);
        switch (browserEngine) {
          case 'ai-browser':
            return BrowserEngineType.AI_BROWSER;
          case 'browseruse':
            return BrowserEngineType.BROWSER_USE;
          default:
            return BrowserEngineType.PUPPETEER;
        }
      }
      
      // Fallback: Use factory recommendation
      const recommendedEngine = await BrowserEngineFactory.getRecommendedEngine();
      this.logger.info(`No engine setting found, using recommended: ${recommendedEngine}`);
      return recommendedEngine;
      
    } catch (error) {
      this.logger.warn('Failed to determine browser engine preference, using Puppeteer:', error);
      return BrowserEngineType.PUPPETEER;
    }
  }

  async executeAutomation(executionPlan: ExecutionPlan): Promise<AutomationResult> {
    if (!this.browserEngine) {
      throw new Error('Browser automation service not initialized');
    }

    try {
      this._isRunning = true;
      this.logger.info(`Starting automation with ${this.browserEngine.getEngineType()} engine`);
      
      const result = await this.browserEngine.executeAutomation(executionPlan);
      
      this.logger.info(`Automation completed successfully with ${this.browserEngine.getEngineType()}`);
      return result;
      
    } catch (error) {
      this.logger.error('Automation execution failed:', error);
      throw error;
    } finally {
      this._isRunning = false;
    }
  }

  async cleanup(): Promise<void> {
    try {
      this._isRunning = false;
      
      if (this.browserEngine) {
        await this.browserEngine.cleanup();
        this.browserEngine = null;
      }
      
      this.logger.info('Browser automation service cleaned up');
    } catch (error) {
      this.logger.error('Error during cleanup:', error);
    }
  }

  async stopExecution(): Promise<void> {
    try {
      this._isRunning = false;
      
      if (this.browserEngine) {
        await this.browserEngine.stopAutomation();
      }
      
      this.logger.info('Automation execution stopped');
    } catch (error) {
      this.logger.error('Error stopping execution:', error);
    }
  }

  isRunning(): boolean {
    return this._isRunning;
  }

  getEngineType(): string {
    return this.browserEngine?.getEngineType() || 'none';
  }

  /**
   * Test the current browser engine
   */
  async testEngine(): Promise<boolean> {
    if (!this.browserEngine) {
      return false;
    }

    try {
      return await this.browserEngine.testEngine();
    } catch (error) {
      this.logger.error('Engine test failed:', error);
      return false;
    }
  }

  /**
   * Switch to a different browser engine
   */
  async switchEngine(engineType: BrowserEngineType): Promise<void> {
    try {
      this.logger.info(`Switching to ${engineType} engine...`);
      
      // Clean up current engine
      if (this.browserEngine) {
        await this.browserEngine.cleanup();
      }
      
      // Create new engine using factory with proper AIProviderManager injection
      const config = {
        headless: false,
        timeout: 60000,
        viewport: { width: 1366, height: 768 },
        apiKey: process.env['OPENAI_API_KEY'] || process.env['ANTHROPIC_API_KEY'] || process.env['GEMINI_API_KEY'],
        aiProviderManager: this.aiProviderManager
      };
      
      this.logger.info(`Switching to ${engineType} engine with AIProviderManager: ${this.aiProviderManager ? 'available' : 'not available'}`);
      
      this.browserEngine = await this.factory.createEngine(engineType, config);
      
      // Initialize new engine
      await this.browserEngine.initialize();
      
      this.logger.info(`Successfully switched to ${engineType} engine`);
    } catch (error) {
      this.logger.error(`Failed to switch to ${engineType} engine:`, error);
      throw error;
    }
  }

  /**
   * Get available browser engines
   */
  async getAvailableEngines(): Promise<BrowserEngineType[]> {
    return await BrowserEngineFactory.getAvailableEngines();
  }

  /**
   * Get recommended browser engine
   */
  async getRecommendedEngine(): Promise<BrowserEngineType> {
    return await BrowserEngineFactory.getRecommendedEngine();
  }

  /**
   * Check if a specific engine is available
   */
  async isEngineAvailable(engineType: BrowserEngineType): Promise<boolean> {
    return await this.factory.isEngineAvailable(engineType);
  }

  /**
   * Get current engine instance (for AI-specific features)
   */
  getCurrentEngine(): IBrowserEngine | null {
    return this.browserEngine;
  }
}