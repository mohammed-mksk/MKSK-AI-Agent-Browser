/**
 * Browser Provider Interface
 * 
 * Purpose: Defines a common interface for different browser automation providers
 * (Puppeteer, Browser-use, etc.) to enable seamless switching between implementations
 * while maintaining consistent functionality across the application.
 */

import { ExecutionPlan, AutomationResult } from '../types.js';

export interface IBrowserProvider {
  /**
   * Initialize the browser provider
   */
  initialize(): Promise<void>;

  /**
   * Execute an automation plan
   * @param executionPlan - The plan containing steps to execute
   * @returns Promise resolving to automation results
   */
  executeAutomation(executionPlan: ExecutionPlan): Promise<AutomationResult>;

  /**
   * Check if the provider is currently running
   */
  isRunning(): boolean;

  /**
   * Get the provider name/type
   */
  getProviderName(): string;

  /**
   * Clean up resources and close browser
   */
  cleanup(): Promise<void>;

  /**
   * Stop current automation execution
   */
  stopExecution(): Promise<void>;

  /**
   * Test if the provider is working correctly
   */
  testProvider(): Promise<boolean>;
}

export interface BrowserProviderConfig {
  provider: 'puppeteer' | 'browser-use';
  headless?: boolean;
  timeout?: number;
  userDataDir?: string;
  additionalArgs?: string[];
}