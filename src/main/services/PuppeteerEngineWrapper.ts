/**
 * Puppeteer Engine Wrapper
 * 
 * Purpose: Wraps the PuppeteerService to implement the IBrowserEngine
 * interface, allowing Puppeteer to be used interchangeably with other
 * browser engines through the factory pattern.
 * 
 * This wrapper provides a consistent interface for the new browser
 * engine architecture without circular dependencies.
 */

import { IBrowserEngine, BrowserEngineConfig } from '../interfaces/IBrowserEngine.js';
import { PuppeteerService } from './PuppeteerService.js';
import { ExecutionPlan, AutomationResult } from '../../shared/types.js';
import { Logger } from './Logger.js';

export class PuppeteerEngineWrapper implements IBrowserEngine {
  private puppeteerService: PuppeteerService;
  private logger: Logger;
  private config: BrowserEngineConfig;

  constructor(config: BrowserEngineConfig = {}) {
    this.logger = new Logger();
    this.config = config;
    this.puppeteerService = new PuppeteerService(config);
  }

  async initialize(): Promise<void> {
    try {
      this.logger.info('Initializing Puppeteer engine wrapper...');
      await this.puppeteerService.initialize();
      this.logger.info('Puppeteer engine wrapper initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize Puppeteer engine wrapper:', error);
      throw error;
    }
  }

  async executeAutomation(executionPlan: ExecutionPlan): Promise<AutomationResult> {
    try {
      this.logger.info('Executing automation with Puppeteer engine');
      const result = await this.puppeteerService.executeAutomation(executionPlan);
      
      // Add engine metadata
      if (result.metadata) {
        (result.metadata as any).engine = 'puppeteer';
      }
      
      return result;
    } catch (error) {
      this.logger.error('Puppeteer automation execution failed:', error);
      throw error;
    }
  }

  async cleanup(): Promise<void> {
    try {
      this.logger.info('Cleaning up Puppeteer engine wrapper...');
      await this.puppeteerService.cleanup();
      this.logger.info('Puppeteer engine wrapper cleaned up successfully');
    } catch (error) {
      this.logger.warn('Error during Puppeteer cleanup:', error);
    }
  }

  isRunning(): boolean {
    return this.puppeteerService.isRunning();
  }

  getEngineType(): string {
    return 'puppeteer';
  }

  async stopAutomation(): Promise<void> {
    try {
      this.logger.info('Stopping Puppeteer automation...');
      await this.puppeteerService.stopAutomation();
      this.logger.info('Puppeteer automation stopped');
    } catch (error) {
      this.logger.warn('Error stopping Puppeteer automation:', error);
    }
  }

  async testEngine(): Promise<boolean> {
    try {
      this.logger.info('Testing Puppeteer engine...');
      return await this.puppeteerService.testEngine();
    } catch (error) {
      this.logger.error('Puppeteer engine test failed:', error);
      return false;
    }
  }
}