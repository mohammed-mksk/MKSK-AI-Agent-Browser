import { CommandParameters, ExtractedData, AutomationStep, ExecutionPlan } from '../../../shared/types';
import { BrowserManager } from '../BrowserManager';
import { Page } from 'puppeteer-core';

/**
 * Base interface for all automation tasks
 */
export interface AutomationTask {
  name: string;
  type: string;
  description: string;
  
  /**
   * Execute the automation task
   */
  execute(parameters: CommandParameters, browserManager: BrowserManager): Promise<ExtractedData[]>;
  
  /**
   * Validate if the task can handle the given parameters
   */
  canHandle(parameters: CommandParameters): boolean;
  
  /**
   * Generate execution plan for the task
   */
  generateExecutionPlan(parameters: CommandParameters): Promise<ExecutionPlan>;
  
  /**
   * Get estimated execution time in milliseconds
   */
  getEstimatedDuration(parameters: CommandParameters): number;
}

/**
 * Abstract base class for automation tasks
 */
export abstract class BaseAutomationTask implements AutomationTask {
  abstract name: string;
  abstract type: string;
  abstract description: string;

  abstract execute(parameters: CommandParameters, browserManager: BrowserManager): Promise<ExtractedData[]>;
  abstract canHandle(parameters: CommandParameters): boolean;
  abstract generateExecutionPlan(parameters: CommandParameters): Promise<ExecutionPlan>;

  /**
   * Default implementation for duration estimation
   */
  getEstimatedDuration(parameters: CommandParameters): number {
    // Base estimation: 30 seconds per URL, 10 seconds per form field
    const urlCount = parameters.urls?.length || 1;
    const formFieldCount = Object.keys(parameters.formData || {}).length;
    return (urlCount * 30000) + (formFieldCount * 10000);
  }

  /**
   * Helper method to create automation steps
   */
  protected createStep(
    id: string,
    type: AutomationStep['type'],
    target: AutomationStep['target'],
    value?: string,
    timeout: number = 30000,
    description: string = ''
  ): AutomationStep {
    return {
      id,
      type,
      target,
      value,
      timeout,
      retryCount: 3,
      description
    };
  }

  /**
   * Helper method to wait for element with multiple strategies
   */
  protected async waitForElement(page: Page, selector: AutomationStep['target'], timeout: number = 30000): Promise<void> {
    const strategies = [
      () => selector.css ? page.waitForSelector(selector.css, { timeout }) : null,
      () => selector.xpath ? page.waitForXPath(selector.xpath, { timeout }) : null,
      () => selector.text ? page.waitForFunction(
        (text) => Array.from(document.querySelectorAll('*')).find(el => el.textContent?.includes(text)),
        { timeout },
        selector.text
      ) : null
    ];

    for (const strategy of strategies) {
      try {
        const result = strategy();
        if (result) {
          await result;
          return;
        }
      } catch (error) {
        // Try next strategy
        continue;
      }
    }

    throw new Error(`Element not found with selector: ${JSON.stringify(selector)}`);
  }

  /**
   * Helper method to extract data with confidence scoring
   */
  protected createExtractedData(
    id: string,
    type: ExtractedData['type'],
    content: any,
    url: string,
    selector: string,
    confidence: number = 0.8
  ): ExtractedData {
    return {
      id,
      type,
      content,
      source: {
        url,
        selector,
        timestamp: new Date()
      },
      confidence
    };
  }
}