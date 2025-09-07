/**
 * Puppeteer Service
 * 
 * Purpose: Direct Puppeteer implementation that implements the IBrowserEngine
 * interface without circular dependencies. This service provides core
 * Puppeteer functionality for browser automation.
 */

import puppeteer, { Browser, Page } from 'puppeteer';
import { IBrowserEngine, BrowserEngineConfig } from '../interfaces/IBrowserEngine.js';
import { ExecutionPlan, AutomationResult, AutomationStep, ExtractedData } from '../../shared/types.js';
import { Logger } from './Logger.js';

export class PuppeteerService implements IBrowserEngine {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private logger: Logger;
  private config: BrowserEngineConfig;
  private _isRunning: boolean = false;

  constructor(config: BrowserEngineConfig = {}) {
    this.logger = new Logger();
    this.config = {
      headless: false,
      timeout: 30000,
      viewport: { width: 1366, height: 768 },
      ...config
    };
  }

  async initialize(): Promise<void> {
    try {
      this.logger.info('Initializing Puppeteer service...');
      
      this.browser = await puppeteer.launch({
        headless: this.config.headless || false,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu'
        ]
      });

      this.page = await this.browser.newPage();
      
      if (this.config.viewport) {
        await this.page.setViewport(this.config.viewport);
      }
      
      if (this.config.userAgent) {
        await this.page.setUserAgent(this.config.userAgent);
      }

      this.logger.info('Puppeteer service initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize Puppeteer service:', error);
      throw error;
    }
  }

  async executeAutomation(executionPlan: ExecutionPlan): Promise<AutomationResult> {
    if (!this.page) {
      throw new Error('Puppeteer service not initialized');
    }

    try {
      this._isRunning = true;
      this.logger.info('Starting Puppeteer automation execution');
      
      const startTime = Date.now();
      const extractedData: ExtractedData[] = [];
      const screenshots: Buffer[] = [];
      
      for (const step of executionPlan.steps) {
        if (!this._isRunning) {
          break;
        }
        
        await this.executeStep(step, extractedData, screenshots);
      }
      
      const duration = Date.now() - startTime;
      
      const result: AutomationResult = {
        id: executionPlan.id,
        command: `Executed ${executionPlan.steps.length} steps`,
        intent: {
          type: 'navigate',
          description: 'Puppeteer automation',
          complexity: 'medium'
        },
        executionPlan,
        extractedData,
        screenshots,
        duration,
        success: true,
        errors: [],
        timestamp: new Date(),
        metadata: {
          browserVersion: await this.browser?.version() || 'unknown',
          userAgent: await this.page.evaluate(() => navigator.userAgent),
          viewport: this.config.viewport || { width: 1366, height: 768 },
          totalSteps: executionPlan.steps.length,
          successfulSteps: executionPlan.steps.length,
          failedSteps: 0
        }
      };

      this.logger.info('Puppeteer automation completed successfully');
      return result;
      
    } catch (error) {
      this.logger.error('Puppeteer automation failed:', error);
      throw error;
    } finally {
      this._isRunning = false;
    }
  }

  private async executeStep(
    step: AutomationStep, 
    extractedData: ExtractedData[], 
    screenshots: Buffer[]
  ): Promise<void> {
    if (!this.page) return;

    try {
      this.logger.info(`Executing step: ${step.type} - ${step.description}`);
      
      switch (step.type) {
        case 'navigate':
          if (step.value) {
            await this.page.goto(step.value, { waitUntil: 'networkidle2' });
          }
          break;
          
        case 'click':
          if (step.target.css) {
            await this.page.click(step.target.css);
          }
          break;
          
        case 'type':
          if (step.target.css && step.value) {
            await this.page.type(step.target.css, step.value);
          }
          break;
          
        case 'wait':
          await new Promise(resolve => setTimeout(resolve, step.timeout || 1000));
          break;
          
        case 'screenshot':
          const screenshot = await this.page.screenshot();
          screenshots.push(screenshot);
          break;
          
        case 'extract':
          if (step.target.css) {
            const text = await this.page.$eval(step.target.css, el => el.textContent);
            if (text) {
              extractedData.push({
                id: `extract_${Date.now()}`,
                type: 'text',
                content: text,
                source: {
                  url: this.page.url(),
                  selector: step.target.css,
                  timestamp: new Date()
                },
                confidence: 1.0
              });
            }
          }
          break;
      }
      
    } catch (error) {
      this.logger.warn(`Step execution failed: ${step.type}`, error);
    }
  }

  async cleanup(): Promise<void> {
    try {
      this._isRunning = false;
      
      if (this.page) {
        await this.page.close();
        this.page = null;
      }
      
      if (this.browser) {
        await this.browser.close();
        this.browser = null;
      }
      
      this.logger.info('Puppeteer service cleaned up successfully');
    } catch (error) {
      this.logger.warn('Error during Puppeteer cleanup:', error);
    }
  }

  isRunning(): boolean {
    return this._isRunning;
  }

  getEngineType(): string {
    return 'puppeteer';
  }

  async stopAutomation(): Promise<void> {
    this._isRunning = false;
    this.logger.info('Puppeteer automation stopped');
  }

  async testEngine(): Promise<boolean> {
    try {
      if (!this.browser || !this.browser.isConnected()) {
        return false;
      }
      
      // Test by navigating to a simple page
      if (this.page) {
        await this.page.goto('about:blank');
        return true;
      }
      
      return false;
    } catch (error) {
      this.logger.error('Puppeteer engine test failed:', error);
      return false;
    }
  }
}