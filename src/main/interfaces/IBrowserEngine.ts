/**
 * Browser Engine Interface
 * 
 * Purpose: Defines a common interface for different browser automation engines
 * (Puppeteer, BrowserUse, etc.) to ensure consistent API across implementations.
 * 
 * This interface abstracts browser automation functionality allowing the application
 * to switch between different engines without changing the core automation logic.
 * It supports both traditional automation (Puppeteer) and AI-powered automation (BrowserUse).
 */

import { ExecutionPlan, AutomationResult } from '../../shared/types.js';

export interface IBrowserEngine {
  /**
   * Initialize the browser engine
   * Sets up the browser instance and prepares it for automation
   */
  initialize(): Promise<void>;

  /**
   * Execute an automation plan using the browser engine
   * @param executionPlan - The plan containing steps to execute
   * @returns Promise resolving to automation results
   */
  executeAutomation(executionPlan: ExecutionPlan): Promise<AutomationResult>;

  /**
   * Clean up resources and close browser instances
   */
  cleanup(): Promise<void>;

  /**
   * Check if the browser engine is currently running
   */
  isRunning(): boolean;

  /**
   * Get the name/type of the browser engine
   */
  getEngineType(): string;

  /**
   * Stop any currently running automation
   */
  stopAutomation(): Promise<void>;

  /**
   * Test if the engine is working correctly
   */
  testEngine(): Promise<boolean>;
}

/**
 * Browser Engine Configuration
 * Common configuration options that can be used by different engines
 */
export interface BrowserEngineConfig {
  headless?: boolean;
  timeout?: number;
  userDataDir?: string;
  viewport?: {
    width: number;
    height: number;
  };
  userAgent?: string;
  enableStealth?: boolean;
  apiKey?: string; // For AI-powered engines like BrowserUse
  aiProviderManager?: any; // AI Provider Manager instance for dependency injection (avoiding circular import)
}

/**
 * Browser Engine Types
 * Supported browser automation engines
 */
export enum BrowserEngineType {
  PUPPETEER = 'puppeteer',
  BROWSER_USE = 'browseruse',
  AI_BROWSER = 'ai-browser'
}

/**
 * Browser Engine Factory Interface
 * Defines the contract for creating browser engine instances
 */
export interface IBrowserEngineFactory {
  /**
   * Create a browser engine instance based on the specified type
   * @param engineType - The type of engine to create
   * @param config - Optional configuration for the engine
   */
  createEngine(engineType: BrowserEngineType, config?: BrowserEngineConfig): Promise<IBrowserEngine>;

  /**
   * Get list of supported engine types
   */
  getSupportedEngines(): BrowserEngineType[];

  /**
   * Check if a specific engine type is available
   */
  isEngineAvailable(engineType: BrowserEngineType): Promise<boolean>;
}