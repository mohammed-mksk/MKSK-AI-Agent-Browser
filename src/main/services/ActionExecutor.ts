import { Page, ElementHandle } from 'puppeteer-core';
import { 
  AutomationStep, 
  StepResult, 
  ElementSelector, 
  ExtractedData 
} from '../../shared/types.js';
import { STEP_TYPES } from '../../shared/constants.js';
import { Logger } from './Logger.js';
import { ErrorHandler, ErrorType } from './ErrorHandler.js';
import { NotificationService } from './NotificationService.js';
import { DebugManager } from './DebugManager.js';
import { nanoid } from 'nanoid';

export class ActionExecutor {
  private logger: Logger;
  private errorHandler: ErrorHandler;
  private notificationService: NotificationService;
  private debugManager?: DebugManager;

  constructor(notificationService?: NotificationService, debugManager?: DebugManager) {
    this.logger = new Logger();
    this.notificationService = notificationService || new NotificationService();
    this.errorHandler = new ErrorHandler(this.notificationService);
    this.debugManager = debugManager;
  }

  async executeStep(step: AutomationStep, page: Page): Promise<StepResult> {
    const startTime = Date.now();
    
    return this.errorHandler.executeWithRecovery(
      async () => {
        this.logger.info(`Executing step: ${step.description}`);
        
        let result: any;
        let screenshot: Buffer | undefined;

        switch (step.type) {
          case STEP_TYPES.NAVIGATE:
            result = await this.navigateToUrl(step.value!, page, step.timeout);
            break;
          case STEP_TYPES.CLICK:
            result = await this.clickElement(step.target, page, step.timeout);
            break;
          case STEP_TYPES.TYPE:
            result = await this.typeText(step.target, step.value!, page, step.timeout);
            break;
          case STEP_TYPES.EXTRACT:
            result = await this.extractData(step.target, page, step.timeout);
            break;
          case STEP_TYPES.WAIT:
            result = await this.waitForElement(step.target, page, step.timeout);
            break;
          case STEP_TYPES.SCREENSHOT:
            screenshot = await this.takeScreenshot(page);
            result = { screenshotTaken: true };
            break;
          default:
            throw new Error(`Unsupported step type: ${step.type}`);
        }

        const duration = Date.now() - startTime;
        
        const stepResult: StepResult = {
          success: true,
          data: result,
          screenshot,
          duration
        };

        // Log debug step if debug manager is available
        if (this.debugManager) {
          await this.debugManager.logStep(step, stepResult, page);
        }

        // Log automation activity
        this.logger.logAutomationActivity(
          `Step completed: ${step.description}`,
          step.type,
          {
            duration,
            success: true,
            url: page.url(),
            stepId: step.id
          }
        );
        
        return stepResult;
      },
      {
        operation: `executeStep:${step.type}`,
        url: page.url(),
        selector: step.target ? JSON.stringify(step.target) : undefined,
        command: step.description,
        timestamp: new Date(),
        metadata: { stepType: step.type, timeout: step.timeout }
      },
      {
        type: 'retry',
        maxAttempts: step.retryCount || 3,
        delay: 1000
      }
    ).catch(async error => {
      const duration = Date.now() - startTime;
      this.logger.error(`Step execution failed: ${step.description}`, error);
      
      const stepResult: StepResult = {
        success: false,
        error: error as Error,
        duration
      };

      // Log debug step if debug manager is available
      if (this.debugManager) {
        await this.debugManager.logStep(step, stepResult, page);
      }

      // Log automation activity
      this.logger.logAutomationActivity(
        `Step failed: ${step.description}`,
        step.type,
        {
          duration,
          success: false,
          error: (error as Error).message,
          url: page.url(),
          stepId: step.id
        }
      );
      
      // Notify user about step failure with recovery options
      this.notificationService.notifyAutomationError(
        step.description || `${step.type} operation`,
        error as Error,
        () => this.executeStep(step, page), // Retry callback
        () => this.logger.info(`Skipped step: ${step.description}`) // Skip callback
      );
      
      return stepResult;
    });
  }

  private async navigateToUrl(url: string, page: Page, timeout: number): Promise<any> {
    await page.goto(url, { 
      waitUntil: 'networkidle2', 
      timeout 
    });
    
    return { 
      url: page.url(),
      title: await page.title()
    };
  }

  private async clickElement(selector: ElementSelector, page: Page, timeout: number): Promise<any> {
    const element = await this.findElement(selector, page, timeout);
    
    if (!element) {
      throw new Error(`Element not found: ${JSON.stringify(selector)}`);
    }

    // Scroll element into view
    await page.evaluate((el) => {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, element);

    // Wait a bit for scroll to complete
    await new Promise(resolve => setTimeout(resolve, 500));

    // Click the element
    await element.click();
    
    return { 
      clicked: true,
      elementInfo: await this.getElementInfo(element)
    };
  }

  private async typeText(selector: ElementSelector, text: string, page: Page, timeout: number): Promise<any> {
    const element = await this.findElement(selector, page, timeout);
    
    if (!element) {
      throw new Error(`Element not found: ${JSON.stringify(selector)}`);
    }

    // Clear existing text
    await element.click({ clickCount: 3 });
    await element.press('Backspace');
    
    // Type new text
    await element.type(text, { delay: 50 });
    
    return { 
      typed: true,
      text,
      elementInfo: await this.getElementInfo(element)
    };
  }

  private async extractData(selector: ElementSelector, page: Page, timeout: number): Promise<ExtractedData[]> {
    try {
      // Wait for elements to be present
      await this.waitForElement(selector, page, timeout);
      
      const extractedData: ExtractedData[] = [];
      
      // Extract based on selector type
      if (selector.css) {
        const elements = await page.$$(selector.css);
        
        for (const element of elements) {
          const data = await this.extractElementData(element, page);
          if (data) {
            extractedData.push({
              id: nanoid(),
              type: this.determineDataType(data),
              content: data,
              source: {
                url: page.url(),
                selector: selector.css,
                timestamp: new Date()
              },
              confidence: 0.8
            });
          }
        }
      }
      
      // Special handling for tables
      const tables = await page.$$('table');
      for (const table of tables) {
        const tableData = await this.extractTableData(table);
        if (tableData.length > 0) {
          extractedData.push({
            id: nanoid(),
            type: 'table',
            content: tableData,
            source: {
              url: page.url(),
              selector: 'table',
              timestamp: new Date()
            },
            confidence: 0.9
          });
        }
      }
      
      return extractedData;
    } catch (error) {
      this.logger.error('Data extraction failed:', error);
      return [];
    }
  }

  private async extractElementData(element: ElementHandle, page: Page): Promise<any> {
    return await page.evaluate((el) => {
      const tagName = el.tagName.toLowerCase();
      const result: any = {
        tagName,
        text: el.textContent?.trim(),
        html: el.innerHTML
      };
      
      // Extract attributes
      const attributes: Record<string, string> = {};
      for (const attr of el.attributes) {
        attributes[attr.name] = attr.value;
      }
      result.attributes = attributes;
      
      // Special handling for different element types
      switch (tagName) {
        case 'a':
          result.href = el.getAttribute('href');
          break;
        case 'img':
          result.src = el.getAttribute('src');
          result.alt = el.getAttribute('alt');
          break;
        case 'input':
          result.value = (el as HTMLInputElement).value;
          result.type = el.getAttribute('type');
          break;
        case 'select':
          result.value = (el as HTMLSelectElement).value;
          result.options = Array.from((el as HTMLSelectElement).options).map(opt => ({
            value: opt.value,
            text: opt.text
          }));
          break;
      }
      
      return result;
    }, element);
  }

  private async extractTableData(table: ElementHandle): Promise<any[]> {
    return await table.evaluate((tableEl) => {
      const rows = Array.from(tableEl.querySelectorAll('tr'));
      const data: any[] = [];
      
      let headers: string[] = [];
      
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const cells = Array.from(row.querySelectorAll('td, th'));
        
        if (i === 0 && cells.some(cell => cell.tagName.toLowerCase() === 'th')) {
          // Header row
          headers = cells.map(cell => cell.textContent?.trim() || '');
        } else {
          // Data row
          const rowData: any = {};
          cells.forEach((cell, index) => {
            const key = headers[index] || `column_${index}`;
            rowData[key] = cell.textContent?.trim();
          });
          data.push(rowData);
        }
      }
      
      return data;
    });
  }

  private determineDataType(data: any): 'text' | 'table' | 'form' | 'image' | 'link' | 'structured' {
    if (data.tagName === 'a' && data.href) return 'link';
    if (data.tagName === 'img') return 'image';
    if (data.tagName === 'form' || data.tagName === 'input' || data.tagName === 'select') return 'form';
    if (Array.isArray(data)) return 'table';
    if (typeof data === 'object' && data.attributes) return 'structured';
    return 'text';
  }

  private async waitForElement(selector: ElementSelector, page: Page, timeout: number): Promise<ElementHandle | null> {
    try {
      if (selector.css) {
        await page.waitForSelector(selector.css, { timeout });
        return await page.$(selector.css);
      }
      
      if (selector.xpath) {
        await page.waitForSelector(`xpath/${selector.xpath}`, { timeout });
        const elements = await page.$$(`xpath/${selector.xpath}`);
        return elements[0] || null;
      }
      
      if (selector.text) {
        await page.waitForFunction(
          (text) => {
            const walker = document.createTreeWalker(
              document.body,
              NodeFilter.SHOW_TEXT,
              null,
              false
            );
            
            let node;
            while (node = walker.nextNode()) {
              if (node.textContent?.includes(text)) {
                return true;
              }
            }
            return false;
          },
          { timeout },
          selector.text
        );
        
        // Find element containing the text
        const element = await page.evaluateHandle((text) => {
          const walker = document.createTreeWalker(
            document.body,
            NodeFilter.SHOW_TEXT,
            null,
            false
          );
          
          let node;
          while (node = walker.nextNode()) {
            if (node.textContent?.includes(text)) {
              return node.parentElement;
            }
          }
          return null;
        }, selector.text);
        
        return element.asElement();
      }
      
      return null;
    } catch (error) {
      this.logger.warn(`Element not found within timeout: ${JSON.stringify(selector)}`);
      return null;
    }
  }

  private async findElement(selector: ElementSelector, page: Page, timeout: number): Promise<ElementHandle | null> {
    // Build array of alternative selectors
    const selectors: string[] = [];
    
    if (selector.css) selectors.push(selector.css);
    if (selector.xpath) selectors.push(`xpath/${selector.xpath}`);
    if (selector.text) {
      // Generate common text-based selectors
      selectors.push(
        `*:contains("${selector.text}")`,
        `[aria-label*="${selector.text}"]`,
        `[title*="${selector.text}"]`,
        `[alt*="${selector.text}"]`
      );
    }
    if (selector.placeholder) {
      selectors.push(
        `input[placeholder*="${selector.placeholder}"]`,
        `textarea[placeholder*="${selector.placeholder}"]`
      );
    }

    // Use ErrorHandler's element not found handling with alternative selectors
    return this.errorHandler.handleElementNotFound(
      async (currentSelector: string) => {
        if (currentSelector.startsWith('xpath/')) {
          const xpath = currentSelector.substring(6);
          await page.waitForXPath(xpath, { timeout: Math.min(timeout, 5000) });
          const elements = await page.$x(xpath);
          return elements[0] || null;
        } else if (currentSelector.includes(':contains')) {
          // Handle text-based selection
          const text = selector.text!;
          const element = await page.evaluateHandle((searchText) => {
            const elements = Array.from(document.querySelectorAll('*'));
            return elements.find(el => 
              el.textContent?.includes(searchText) && 
              el.children.length === 0 // Prefer leaf nodes
            ) || null;
          }, text);
          
          return element.asElement();
        } else {
          // Regular CSS selector
          await page.waitForSelector(currentSelector, { timeout: Math.min(timeout, 5000) });
          return await page.$(currentSelector);
        }
      },
      {
        operation: 'findElement',
        url: page.url(),
        selector: JSON.stringify(selector),
        timestamp: new Date()
      },
      selectors
    );
  }

  private async getElementInfo(element: ElementHandle): Promise<any> {
    return await element.evaluate((el) => ({
      tagName: el.tagName,
      id: el.id,
      className: el.className,
      textContent: el.textContent?.trim().substring(0, 100)
    }));
  }

  private async takeScreenshot(page: Page): Promise<Buffer> {
    return await page.screenshot({
      fullPage: true,
      type: 'png'
    });
  }

  async handleDynamicContent(page: Page): Promise<void> {
    // Wait for common dynamic content indicators
    try {
      await Promise.race([
        page.waitForSelector('.loading', { hidden: true, timeout: 10000 }),
        page.waitForSelector('[data-loading="false"]', { timeout: 10000 }),
        page.waitForFunction(() => !document.querySelector('.spinner'), { timeout: 10000 }),
        page.waitForTimeout(3000) // Fallback timeout
      ]);
    } catch {
      // Continue if no loading indicators found
    }
    
    // Wait for network to be idle
    try {
      await page.waitForLoadState?.('networkidle', { timeout: 5000 });
    } catch {
      // Continue if method not available or timeout
    }
  }

  async retryStep(step: AutomationStep, page: Page, maxRetries: number = 3): Promise<StepResult> {
    let lastError: Error | undefined;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        this.logger.info(`Executing step (attempt ${attempt}/${maxRetries}): ${step.description}`);
        
        const result = await this.executeStep(step, page);
        
        if (result.success) {
          return result;
        }
        
        lastError = result.error;
        
        // Wait before retry
        if (attempt < maxRetries) {
          await page.waitForTimeout(1000 * attempt);
        }
      } catch (error) {
        lastError = error as Error;
        
        if (attempt < maxRetries) {
          await page.waitForTimeout(1000 * attempt);
        }
      }
    }
    
    return {
      success: false,
      error: lastError || new Error('Max retries exceeded'),
      duration: 0
    };
  }
}