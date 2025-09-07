import { Logger } from './Logger.js';
import { NotificationService } from './NotificationService.js';

export enum ErrorType {
  NETWORK = 'network',
  TIMEOUT = 'timeout',
  PARSING = 'parsing',
  BROWSER = 'browser',
  ELEMENT_NOT_FOUND = 'element_not_found',
  VALIDATION = 'validation',
  AI_PROVIDER = 'ai_provider',
  DATABASE = 'database',
  UNKNOWN = 'unknown'
}

export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export interface ErrorContext {
  operation: string;
  url?: string;
  selector?: string;
  command?: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface RecoveryStrategy {
  type: 'retry' | 'fallback' | 'skip' | 'abort';
  maxAttempts?: number;
  delay?: number;
  fallbackAction?: () => Promise<any>;
  condition?: (error: Error, attempt: number) => boolean;
}

export interface ErrorInfo {
  type: ErrorType;
  severity: ErrorSeverity;
  message: string;
  originalError: Error;
  context: ErrorContext;
  recoveryStrategy: RecoveryStrategy;
  timestamp: Date;
  stackTrace?: string;
}

export class ErrorHandler {
  private logger: Logger;
  private notificationService: NotificationService;
  private errorHistory: ErrorInfo[] = [];
  private maxHistorySize: number = 1000;
  private unavailableWebsites: Map<string, Date> = new Map();
  private websiteRetryDelay: number = 300000; // 5 minutes

  constructor(notificationService?: NotificationService) {
    this.logger = new Logger();
    this.notificationService = notificationService || new NotificationService();
  }

  /**
   * Classify an error and determine its type and severity
   */
  classifyError(error: Error, context: ErrorContext): ErrorInfo {
    let type = ErrorType.UNKNOWN;
    let severity = ErrorSeverity.MEDIUM;
    let recoveryStrategy: RecoveryStrategy = { type: 'retry', maxAttempts: 3, delay: 1000 };

    const errorMessage = error.message.toLowerCase();

    // Network-related errors
    if (errorMessage.includes('network') || 
        errorMessage.includes('connection') || 
        errorMessage.includes('fetch') ||
        errorMessage.includes('cors')) {
      type = ErrorType.NETWORK;
      severity = ErrorSeverity.HIGH;
      recoveryStrategy = {
        type: 'retry',
        maxAttempts: 5,
        delay: 2000,
        condition: (err, attempt) => attempt < 3 || !errorMessage.includes('cors')
      };
    }

    // Timeout errors
    else if (errorMessage.includes('timeout') || 
             errorMessage.includes('waiting for') ||
             errorMessage.includes('timed out')) {
      type = ErrorType.TIMEOUT;
      severity = ErrorSeverity.MEDIUM;
      recoveryStrategy = {
        type: 'retry',
        maxAttempts: 3,
        delay: 3000
      };
    }

    // Element not found errors
    else if (errorMessage.includes('element not found') ||
             errorMessage.includes('no such element') ||
             errorMessage.includes('selector') ||
             errorMessage.includes('not found')) {
      type = ErrorType.ELEMENT_NOT_FOUND;
      severity = ErrorSeverity.MEDIUM;
      recoveryStrategy = {
        type: 'fallback',
        maxAttempts: 2,
        delay: 1000
      };
    }

    // Browser-related errors
    else if (errorMessage.includes('browser') ||
             errorMessage.includes('page') ||
             errorMessage.includes('puppeteer') ||
             errorMessage.includes('chrome')) {
      type = ErrorType.BROWSER;
      severity = ErrorSeverity.HIGH;
      recoveryStrategy = {
        type: 'retry',
        maxAttempts: 2,
        delay: 5000
      };
    }

    // Parsing errors
    else if (errorMessage.includes('parse') ||
             errorMessage.includes('json') ||
             errorMessage.includes('syntax') ||
             errorMessage.includes('invalid')) {
      type = ErrorType.PARSING;
      severity = ErrorSeverity.LOW;
      recoveryStrategy = {
        type: 'fallback',
        maxAttempts: 1
      };
    }

    // AI Provider errors
    else if (errorMessage.includes('api') ||
             errorMessage.includes('openai') ||
             errorMessage.includes('claude') ||
             errorMessage.includes('rate limit') ||
             errorMessage.includes('quota')) {
      type = ErrorType.AI_PROVIDER;
      severity = ErrorSeverity.HIGH;
      recoveryStrategy = {
        type: 'retry',
        maxAttempts: 3,
        delay: 5000,
        condition: (err, attempt) => !errorMessage.includes('quota') || attempt < 2
      };
    }

    // Database errors
    else if (errorMessage.includes('database') ||
             errorMessage.includes('sqlite') ||
             errorMessage.includes('sql')) {
      type = ErrorType.DATABASE;
      severity = ErrorSeverity.CRITICAL;
      recoveryStrategy = {
        type: 'retry',
        maxAttempts: 2,
        delay: 1000
      };
    }

    const errorInfo: ErrorInfo = {
      type,
      severity,
      message: error.message,
      originalError: error,
      context,
      recoveryStrategy,
      timestamp: new Date(),
      stackTrace: error.stack
    };

    this.logError(errorInfo);
    this.addToHistory(errorInfo);

    return errorInfo;
  }

  /**
   * Execute an operation with automatic error handling and recovery
   */
  async executeWithRecovery<T>(
    operation: () => Promise<T>,
    context: ErrorContext,
    customStrategy?: Partial<RecoveryStrategy>
  ): Promise<T> {
    let lastError: Error | null = null;
    let attempt = 0;

    while (true) {
      attempt++;
      
      try {
        this.logger.debug(`Executing operation: ${context.operation} (attempt ${attempt})`);
        const result = await operation();
        
        if (attempt > 1) {
          this.logger.info(`Operation succeeded after ${attempt} attempts: ${context.operation}`);
        }
        
        return result;
      } catch (error) {
        lastError = error as Error;
        const errorInfo = this.classifyError(lastError, context);
        
        // Apply custom strategy if provided
        if (customStrategy) {
          errorInfo.recoveryStrategy = { ...errorInfo.recoveryStrategy, ...customStrategy };
        }

        const strategy = errorInfo.recoveryStrategy;
        
        // Check if we should continue retrying
        if (strategy.type === 'abort' || 
            (strategy.maxAttempts && attempt >= strategy.maxAttempts) ||
            (strategy.condition && !strategy.condition(lastError, attempt))) {
          
          this.logger.error(`Operation failed after ${attempt} attempts: ${context.operation}`, lastError);
          throw this.createEnhancedError(lastError, errorInfo);
        }

        // Handle different recovery strategies
        switch (strategy.type) {
          case 'retry':
            if (strategy.delay) {
              this.logger.info(`Retrying operation in ${strategy.delay}ms: ${context.operation}`);
              await this.delay(strategy.delay * Math.pow(1.5, attempt - 1)); // Exponential backoff
            }
            break;

          case 'fallback':
            if (strategy.fallbackAction) {
              try {
                this.logger.info(`Executing fallback action for: ${context.operation}`);
                return await strategy.fallbackAction();
              } catch (fallbackError) {
                this.logger.warn('Fallback action also failed:', fallbackError);
                // Continue with retry logic
              }
            }
            break;

          case 'skip':
            this.logger.warn(`Skipping failed operation: ${context.operation}`);
            return null as T;
        }
      }
    }
  }

  /**
   * Handle network-specific errors with appropriate recovery
   */
  async handleNetworkError<T>(
    operation: () => Promise<T>,
    context: ErrorContext
  ): Promise<T> {
    return this.executeWithRecovery(operation, context, {
      type: 'retry',
      maxAttempts: 5,
      delay: 2000,
      condition: (error, attempt) => {
        // Don't retry CORS errors after first attempt
        if (error.message.toLowerCase().includes('cors') && attempt > 1) {
          return false;
        }
        return true;
      }
    });
  }

  /**
   * Handle timeout errors with progressive timeout increases
   */
  async handleTimeoutError<T>(
    operation: (timeout: number) => Promise<T>,
    context: ErrorContext,
    initialTimeout: number = 30000
  ): Promise<T> {
    let currentTimeout = initialTimeout;
    
    return this.executeWithRecovery(
      () => operation(currentTimeout),
      context,
      {
        type: 'retry',
        maxAttempts: 3,
        delay: 1000,
        condition: (error, attempt) => {
          if (error.message.toLowerCase().includes('timeout')) {
            currentTimeout = Math.min(currentTimeout * 1.5, 120000); // Max 2 minutes
            return true;
          }
          return attempt < 3;
        }
      }
    );
  }

  /**
   * Handle element not found errors with alternative selectors
   */
  async handleElementNotFound<T>(
    operation: (selector: string) => Promise<T>,
    context: ErrorContext,
    selectors: string[]
  ): Promise<T> {
    let selectorIndex = 0;
    
    return this.executeWithRecovery(
      () => operation(selectors[selectorIndex]),
      context,
      {
        type: 'fallback',
        maxAttempts: selectors.length,
        delay: 1000,
        condition: (error, attempt) => {
          if (error.message.toLowerCase().includes('not found') && selectorIndex < selectors.length - 1) {
            selectorIndex++;
            this.logger.info(`Trying alternative selector: ${selectors[selectorIndex]}`);
            return true;
          }
          return false;
        }
      }
    );
  }

  /**
   * Create graceful degradation for non-critical operations
   */
  async executeWithGracefulDegradation<T>(
    operation: () => Promise<T>,
    context: ErrorContext,
    fallbackValue: T
  ): Promise<T> {
    try {
      return await this.executeWithRecovery(operation, context, {
        type: 'retry',
        maxAttempts: 2,
        delay: 1000
      });
    } catch (error) {
      this.logger.warn(`Operation failed, using fallback value: ${context.operation}`, error);
      return fallbackValue;
    }
  }

  /**
   * Get error statistics and patterns
   */
  getErrorStatistics(): {
    totalErrors: number;
    errorsByType: Record<ErrorType, number>;
    errorsBySeverity: Record<ErrorSeverity, number>;
    recentErrors: ErrorInfo[];
    commonPatterns: string[];
  } {
    const errorsByType = {} as Record<ErrorType, number>;
    const errorsBySeverity = {} as Record<ErrorSeverity, number>;
    
    // Initialize counters
    Object.values(ErrorType).forEach(type => errorsByType[type] = 0);
    Object.values(ErrorSeverity).forEach(severity => errorsBySeverity[severity] = 0);
    
    // Count errors
    this.errorHistory.forEach(error => {
      errorsByType[error.type]++;
      errorsBySeverity[error.severity]++;
    });
    
    // Get recent errors (last 10)
    const recentErrors = this.errorHistory.slice(-10);
    
    // Find common error patterns
    const messageFrequency = new Map<string, number>();
    this.errorHistory.forEach(error => {
      const key = error.message.substring(0, 50); // First 50 chars
      messageFrequency.set(key, (messageFrequency.get(key) || 0) + 1);
    });
    
    const commonPatterns = Array.from(messageFrequency.entries())
      .filter(([, count]) => count > 1)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([pattern]) => pattern);

    return {
      totalErrors: this.errorHistory.length,
      errorsByType,
      errorsBySeverity,
      recentErrors,
      commonPatterns
    };
  }

  /**
   * Clear error history
   */
  clearHistory(): void {
    this.errorHistory = [];
    this.logger.info('Error history cleared');
  }

  /**
   * Check if a website is currently marked as unavailable
   */
  isWebsiteUnavailable(url: string): boolean {
    const domain = this.extractDomain(url);
    const unavailableTime = this.unavailableWebsites.get(domain);
    
    if (!unavailableTime) return false;
    
    const now = new Date();
    const timeDiff = now.getTime() - unavailableTime.getTime();
    
    if (timeDiff > this.websiteRetryDelay) {
      // Retry delay has passed, remove from unavailable list
      this.unavailableWebsites.delete(domain);
      return false;
    }
    
    return true;
  }

  /**
   * Mark a website as temporarily unavailable
   */
  markWebsiteUnavailable(url: string): void {
    const domain = this.extractDomain(url);
    this.unavailableWebsites.set(domain, new Date());
    this.logger.warn(`Website marked as unavailable: ${domain}`);
    this.notificationService.notifyWebsiteUnavailable(domain);
  }

  /**
   * Handle website-specific errors with graceful degradation
   */
  async handleWebsiteError<T>(
    operation: () => Promise<T>,
    context: ErrorContext,
    fallbackWebsites?: string[]
  ): Promise<T> {
    // Check if website is already marked as unavailable
    if (context.url && this.isWebsiteUnavailable(context.url)) {
      if (fallbackWebsites && fallbackWebsites.length > 0) {
        this.logger.info(`Website unavailable, trying fallback: ${context.url}`);
        // Try fallback websites
        for (const fallbackUrl of fallbackWebsites) {
          if (!this.isWebsiteUnavailable(fallbackUrl)) {
            try {
              const fallbackContext = { ...context, url: fallbackUrl };
              return await this.executeWithRecovery(operation, fallbackContext);
            } catch (error) {
              this.logger.warn(`Fallback website also failed: ${fallbackUrl}`);
              continue;
            }
          }
        }
      }
      throw new Error(`Website unavailable and no working fallbacks: ${context.url}`);
    }

    try {
      return await this.executeWithRecovery(operation, context, {
        type: 'retry',
        maxAttempts: 3,
        delay: 2000,
        condition: (error, attempt) => {
          // Mark website as unavailable on certain errors
          if (context.url && this.shouldMarkWebsiteUnavailable(error)) {
            this.markWebsiteUnavailable(context.url);
            return false; // Don't retry
          }
          return attempt < 3;
        }
      });
    } catch (error) {
      // Try fallback websites if available
      if (fallbackWebsites && fallbackWebsites.length > 0) {
        this.logger.info(`Primary website failed, trying fallbacks`);
        for (const fallbackUrl of fallbackWebsites) {
          if (!this.isWebsiteUnavailable(fallbackUrl)) {
            try {
              const fallbackContext = { ...context, url: fallbackUrl };
              return await this.executeWithRecovery(operation, fallbackContext);
            } catch (fallbackError) {
              this.logger.warn(`Fallback website failed: ${fallbackUrl}`);
              continue;
            }
          }
        }
      }
      throw error;
    }
  }

  /**
   * Detect and handle CAPTCHA challenges
   */
  async detectCaptcha(page: any): Promise<boolean> {
    try {
      // Common CAPTCHA indicators
      const captchaSelectors = [
        '.g-recaptcha',
        '#recaptcha',
        '.captcha',
        '.hcaptcha',
        '[data-captcha]',
        'iframe[src*="recaptcha"]',
        'iframe[src*="hcaptcha"]',
        '.cf-challenge-form', // Cloudflare
        '#challenge-form'
      ];

      for (const selector of captchaSelectors) {
        const element = await page.$(selector);
        if (element) {
          this.logger.warn(`CAPTCHA detected: ${selector}`);
          return true;
        }
      }

      // Check for CAPTCHA-related text
      const captchaTexts = [
        'verify you are human',
        'complete the captcha',
        'security check',
        'prove you are not a robot',
        'i am not a robot'
      ];

      const pageText = await page.evaluate(() => document.body.textContent?.toLowerCase() || '');
      
      for (const text of captchaTexts) {
        if (pageText.includes(text)) {
          this.logger.warn(`CAPTCHA detected by text: ${text}`);
          return true;
        }
      }

      return false;
    } catch (error) {
      this.logger.error('Error detecting CAPTCHA:', error);
      return false;
    }
  }

  /**
   * Handle CAPTCHA challenges
   */
  async handleCaptcha(page: any, context: ErrorContext): Promise<void> {
    this.logger.warn('CAPTCHA challenge detected, attempting to handle...');
    
    // Notify user about CAPTCHA detection
    const domain = context.url ? this.extractDomain(context.url) : 'unknown website';
    this.notificationService.notifyCaptchaDetected(domain);
    
    try {
      // Wait for user to solve CAPTCHA manually (in non-headless mode)
      // This is a simple implementation - in production, you might want to:
      // 1. Use CAPTCHA solving services
      // 2. Implement more sophisticated detection
      // 3. Provide user notifications
      
      const isHeadless = await page.browser().isConnected();
      
      if (!isHeadless) {
        this.logger.info('Waiting for manual CAPTCHA resolution...');
        
        // Wait up to 2 minutes for CAPTCHA to be resolved
        const maxWaitTime = 120000; // 2 minutes
        const checkInterval = 2000; // 2 seconds
        let waitTime = 0;
        
        while (waitTime < maxWaitTime) {
          await this.delay(checkInterval);
          waitTime += checkInterval;
          
          // Check if CAPTCHA is still present
          const captchaStillPresent = await this.detectCaptcha(page);
          if (!captchaStillPresent) {
            this.logger.info('CAPTCHA resolved successfully');
            this.notificationService.notifySuccess('CAPTCHA Resolved', 'CAPTCHA was successfully resolved, continuing automation.');
            return;
          }
        }
        
        throw new Error('CAPTCHA resolution timeout');
      } else {
        // In headless mode, we can't solve CAPTCHAs manually
        throw new Error('CAPTCHA detected in headless mode - cannot proceed');
      }
    } catch (error) {
      this.logger.error('Failed to handle CAPTCHA:', error);
      this.notificationService.notifyError('CAPTCHA Error', `Failed to resolve CAPTCHA: ${error.message}`);
      throw error;
    }
  }

  /**
   * Handle popup and modal dialogs
   */
  async handlePopups(page: any): Promise<void> {
    try {
      // Common popup selectors
      const popupSelectors = [
        '.modal',
        '.popup',
        '.overlay',
        '.dialog',
        '[role="dialog"]',
        '.cookie-banner',
        '.newsletter-popup',
        '.age-verification'
      ];

      for (const selector of popupSelectors) {
        const popup = await page.$(selector);
        if (popup) {
          // Try to find and click close button
          const closeSelectors = [
            `${selector} .close`,
            `${selector} .x`,
            `${selector} [aria-label="close"]`,
            `${selector} [aria-label="Close"]`,
            `${selector} button[title="Close"]`,
            `${selector} .dismiss`,
            `${selector} .cancel`
          ];

          for (const closeSelector of closeSelectors) {
            const closeButton = await page.$(closeSelector);
            if (closeButton) {
              await closeButton.click();
              this.logger.info(`Closed popup: ${selector}`);
              await this.delay(1000); // Wait for popup to close
              break;
            }
          }
        }
      }

      // Handle cookie consent banners specifically
      const cookieSelectors = [
        'button[id*="accept"]',
        'button[class*="accept"]',
        'button[id*="cookie"]',
        'button[class*="cookie"]',
        '.cookie-accept',
        '#cookie-accept'
      ];

      for (const selector of cookieSelectors) {
        const button = await page.$(selector);
        if (button) {
          await button.click();
          this.logger.info(`Accepted cookies: ${selector}`);
          await this.delay(1000);
          break;
        }
      }
    } catch (error) {
      this.logger.warn('Error handling popups:', error);
      // Don't throw error - popups are not critical
    }
  }

  /**
   * Implement circuit breaker pattern for failing operations
   */
  private circuitBreakers: Map<string, {
    failures: number;
    lastFailure: Date;
    state: 'closed' | 'open' | 'half-open';
  }> = new Map();

  async executeWithCircuitBreaker<T>(
    operation: () => Promise<T>,
    context: ErrorContext,
    circuitKey: string,
    failureThreshold: number = 5,
    timeout: number = 60000 // 1 minute
  ): Promise<T> {
    const circuit = this.circuitBreakers.get(circuitKey) || {
      failures: 0,
      lastFailure: new Date(0),
      state: 'closed' as const
    };

    // Check circuit state
    const now = new Date();
    const timeSinceLastFailure = now.getTime() - circuit.lastFailure.getTime();

    if (circuit.state === 'open') {
      if (timeSinceLastFailure > timeout) {
        // Try to close circuit
        circuit.state = 'half-open';
        this.logger.info(`Circuit breaker half-open: ${circuitKey}`);
      } else {
        throw new Error(`Circuit breaker open: ${circuitKey}`);
      }
    }

    try {
      const result = await operation();
      
      // Success - reset circuit
      if (circuit.state === 'half-open') {
        circuit.state = 'closed';
        circuit.failures = 0;
        this.logger.info(`Circuit breaker closed: ${circuitKey}`);
      }
      
      this.circuitBreakers.set(circuitKey, circuit);
      return result;
    } catch (error) {
      circuit.failures++;
      circuit.lastFailure = now;
      
      if (circuit.failures >= failureThreshold) {
        circuit.state = 'open';
        this.logger.warn(`Circuit breaker opened: ${circuitKey} (${circuit.failures} failures)`);
      }
      
      this.circuitBreakers.set(circuitKey, circuit);
      throw error;
    }
  }

  private logError(errorInfo: ErrorInfo): void {
    const logMessage = `[${errorInfo.type.toUpperCase()}] ${errorInfo.message}`;
    
    switch (errorInfo.severity) {
      case ErrorSeverity.LOW:
        this.logger.debug(logMessage);
        break;
      case ErrorSeverity.MEDIUM:
        this.logger.warn(logMessage);
        break;
      case ErrorSeverity.HIGH:
        this.logger.error(logMessage);
        break;
      case ErrorSeverity.CRITICAL:
        this.logger.error(`CRITICAL: ${logMessage}`, errorInfo.originalError);
        break;
    }
  }

  private addToHistory(errorInfo: ErrorInfo): void {
    this.errorHistory.push(errorInfo);
    
    // Maintain history size limit
    if (this.errorHistory.length > this.maxHistorySize) {
      this.errorHistory = this.errorHistory.slice(-this.maxHistorySize);
    }
  }

  private createEnhancedError(originalError: Error, errorInfo: ErrorInfo): Error {
    const enhancedError = new Error(
      `${errorInfo.type.toUpperCase()}: ${originalError.message} (Operation: ${errorInfo.context.operation})`
    );
    
    enhancedError.stack = originalError.stack;
    (enhancedError as any).errorInfo = errorInfo;
    
    return enhancedError;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private extractDomain(url: string): string {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname;
    } catch {
      return url;
    }
  }

  private shouldMarkWebsiteUnavailable(error: Error): boolean {
    const errorMessage = error.message.toLowerCase();
    
    // Mark website as unavailable for these error types
    const unavailableIndicators = [
      'net::err_name_not_resolved',
      'net::err_connection_refused',
      'net::err_connection_timed_out',
      'net::err_internet_disconnected',
      'server error',
      'service unavailable',
      '503',
      '502',
      '504',
      'cloudflare',
      'too many requests',
      'rate limit'
    ];

    return unavailableIndicators.some(indicator => 
      errorMessage.includes(indicator)
    );
  }
}