/**
 * Error Recovery System
 * 
 * Purpose: Implements intelligent error recovery for browser automation.
 * Uses AI-driven analysis to classify errors, generate recovery strategies,
 * and execute progressive fallback mechanisms.
 */

import {
  IErrorRecovery,
  ErrorClassification,
  ErrorType,
  ErrorSeverity,
  ErrorContext,
  RecoveryStrategy,
  RecoveryStep,
  RecoveryActionType,
  RecoveryResult,
  CaptchaType,
  CaptchaHandlingResult,
  CaptchaHandlingMethod,
  TimeoutContext,
  TimeoutType,
  TimeoutResolution,
  TimeoutResolutionMethod,
  RecoveryStats
} from '../interfaces/IErrorRecovery.js';
import { AutomationError, ActionContext } from '../../shared/types.js';
import { AIProviderManager } from './AIProviderManager.js';
import { RecoveryStrategyEngine, IRecoveryStrategyEngine } from './RecoveryStrategyEngine.js';

export class ErrorRecoverySystem implements IErrorRecovery {
  private aiProvider: AIProviderManager;
  private strategyEngine: IRecoveryStrategyEngine;
  private recoveryHistory: Map<string, RecoveryResult[]> = new Map();
  private errorPatterns: Map<string, ErrorClassification[]> = new Map();
  private strategyEffectiveness: Map<string, number> = new Map();

  constructor(aiProvider: AIProviderManager) {
    this.aiProvider = aiProvider;
    this.strategyEngine = new RecoveryStrategyEngine(aiProvider);
  }

  async classifyError(error: AutomationError, context: ActionContext): Promise<ErrorClassification> {
    try {
      // First, try pattern matching against known errors
      const knownClassification = await this.matchKnownErrorPattern(error, context);
      if (knownClassification) {
        return knownClassification;
      }

      // Use AI to classify the error
      const aiClassification = await this.aiClassifyError(error, context);
      
      // Store the classification for future pattern matching
      await this.storeErrorPattern(error, aiClassification);
      
      return aiClassification;
    } catch (classificationError) {
      console.error('Error during error classification:', classificationError);
      
      // Fallback to basic classification
      return this.basicErrorClassification(error, context);
    }
  }

  async generateRecoveryStrategies(classification: ErrorClassification, context?: ActionContext): Promise<RecoveryStrategy[]> {
    try {
      // Use the new RecoveryStrategyEngine for enhanced strategy generation
      if (context) {
        const strategies = await this.strategyEngine.generateStrategies(classification, context);
        console.log(`Generated ${strategies.length} recovery strategies using RecoveryStrategyEngine`);
        return strategies;
      }
      
      // Fallback to original implementation if no context provided
      const strategies: RecoveryStrategy[] = [];
      
      // Generate AI-powered strategies
      const aiStrategies = await this.generateAIRecoveryStrategies(classification);
      strategies.push(...aiStrategies);
      
      // Add predefined strategies based on error type
      const predefinedStrategies = this.getPredefinedStrategies(classification.type);
      strategies.push(...predefinedStrategies);
      
      // Sort strategies by priority and success probability
      return strategies.sort((a, b) => {
        if (a.priority !== b.priority) {
          return b.priority - a.priority; // Higher priority first
        }
        return b.successProbability - a.successProbability; // Higher probability first
      });
    } catch (strategyError) {
      console.error('Error generating recovery strategies:', strategyError);
      
      // Fallback to basic strategies
      return this.getBasicRecoveryStrategies(classification.type);
    }
  }

  async executeRecoveryStrategy(strategy: RecoveryStrategy, context: ActionContext): Promise<RecoveryResult> {
    const startTime = Date.now();
    const completedSteps: RecoveryStep[] = [];
    let newContext = { ...context };

    try {
      console.log(`Executing recovery strategy: ${strategy.name}`);
      
      // Monitor execution progress using the strategy engine
      let currentStepIndex = 0;
      
      for (const step of strategy.steps) {
        try {
          // Check execution progress before each step
          const progress = {
            strategy,
            currentStepIndex,
            completedSteps,
            failedSteps: [],
            elapsedTime: Date.now() - startTime,
            currentContext: newContext
          };
          
          const recommendation = await this.strategyEngine.monitorExecution(strategy, progress);
          
          if (recommendation.shouldSwitchStrategy && recommendation.alternativeStrategy) {
            console.log(`Switching to alternative strategy: ${recommendation.reasoning}`);
            return await this.executeRecoveryStrategy(recommendation.alternativeStrategy, context);
          }
          
          if (recommendation.adjustedParameters) {
            // Apply parameter adjustments
            Object.assign(step.parameters, recommendation.adjustedParameters);
          }
          
          const stepResult = await this.executeRecoveryStep(step, newContext);
          
          if (stepResult.success) {
            completedSteps.push(step);
            if (stepResult.newContext) {
              newContext = stepResult.newContext;
            }
          } else if (!step.optional) {
            // Required step failed, strategy failed
            throw new Error(`Required recovery step failed: ${step.description}`);
          }
          
          currentStepIndex++;
        } catch (stepError) {
          if (!step.optional) {
            throw stepError;
          }
          console.warn(`Optional recovery step failed: ${step.description}`, stepError);
          currentStepIndex++;
        }
      }

      const result: RecoveryResult = {
        success: true,
        strategy,
        completedSteps,
        duration: Date.now() - startTime,
        newContext,
        learnings: [`Successfully executed ${strategy.name}`]
      };

      // Learn from the successful result
      await this.strategyEngine.learnFromResult(result);
      
      // Update strategy effectiveness
      await this.updateStrategyEffectiveness(strategy.id, true);
      
      return result;
    } catch (executionError) {
      console.error(`Recovery strategy ${strategy.name} failed:`, executionError);
      
      const result: RecoveryResult = {
        success: false,
        strategy,
        completedSteps,
        duration: Date.now() - startTime,
        error: {
          id: `recovery_error_${Date.now()}`,
          type: 'ai_error',
          message: `Recovery strategy failed: ${executionError.message}`,
          context: { strategy: strategy.name },
          timestamp: new Date()
        },
        learnings: [`Strategy ${strategy.name} failed: ${executionError.message}`]
      };

      // Learn from the failed result
      await this.strategyEngine.learnFromResult(result);
      
      // Update strategy effectiveness
      await this.updateStrategyEffectiveness(strategy.id, false);
      
      // Try fallback strategy if available
      if (strategy.fallbackStrategy) {
        console.log(`Trying fallback strategy: ${strategy.fallbackStrategy.name}`);
        return await this.executeRecoveryStrategy(strategy.fallbackStrategy, context);
      }
      
      return result;
    }
  }

  async handleCaptcha(captchaType: CaptchaType, context: ActionContext): Promise<CaptchaHandlingResult> {
    const startTime = Date.now();
    
    try {
      console.log(`Handling CAPTCHA type: ${captchaType}`);
      
      switch (captchaType) {
        case CaptchaType.RECAPTCHA_V2:
        case CaptchaType.RECAPTCHA_V3:
          return await this.handleRecaptcha(captchaType, context);
        
        case CaptchaType.HCAPTCHA:
          return await this.handleHCaptcha(context);
        
        case CaptchaType.IMAGE_CAPTCHA:
          return await this.handleImageCaptcha(context);
        
        case CaptchaType.TEXT_CAPTCHA:
          return await this.handleTextCaptcha(context);
        
        default:
          return {
            success: false,
            method: CaptchaHandlingMethod.SKIP,
            duration: Date.now() - startTime,
            confidence: 0,
            error: `Unsupported CAPTCHA type: ${captchaType}`
          };
      }
    } catch (captchaError) {
      console.error('CAPTCHA handling failed:', captchaError);
      
      return {
        success: false,
        method: CaptchaHandlingMethod.SKIP,
        duration: Date.now() - startTime,
        confidence: 0,
        error: captchaError.message
      };
    }
  }

  async manageTimeout(timeoutContext: TimeoutContext): Promise<TimeoutResolution> {
    try {
      console.log(`Managing timeout: ${timeoutContext.timeoutType}`);
      
      // Analyze the timeout situation
      const analysis = await this.analyzeTimeoutSituation(timeoutContext);
      
      // Determine the best resolution method
      const method = this.determineTimeoutResolutionMethod(analysis);
      
      // Execute the resolution
      const resolution = await this.executeTimeoutResolution(method, timeoutContext);
      
      return resolution;
    } catch (timeoutError) {
      console.error('Timeout management failed:', timeoutError);
      
      return {
        resolved: false,
        method: TimeoutResolutionMethod.ABORT_TASK,
        duration: 0,
        shouldRetry: false
      };
    }
  }

  async isRecoverable(error: AutomationError): Promise<boolean> {
    try {
      // Quick check for obviously non-recoverable errors
      const nonRecoverableTypes = ['permission_denied', 'authentication_required'];
      if (nonRecoverableTypes.includes(error.type)) {
        return false;
      }

      // Use AI to assess recoverability
      const prompt = `
        Analyze this automation error and determine if it's recoverable:
        
        Error Type: ${error.type}
        Message: ${error.message}
        Context: ${JSON.stringify(error.context, null, 2)}
        
        Consider factors like:
        - Error type and severity
        - Available recovery options
        - Context and environment
        
        Respond with a JSON object:
        {
          "recoverable": boolean,
          "confidence": number (0-1),
          "reasoning": "explanation"
        }
      `;

      const response = await this.aiProvider.generateCompletion(prompt, {
        temperature: 0.1,
        maxTokens: 200
      });

      const analysis = JSON.parse(response);
      return analysis.recoverable && analysis.confidence > 0.6;
    } catch (assessmentError) {
      console.error('Error recoverability assessment failed:', assessmentError);
      
      // Conservative fallback - assume recoverable unless proven otherwise
      return !['permission_denied', 'authentication_required'].includes(error.type);
    }
  }

  async getRecoveryStats(): Promise<RecoveryStats> {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    let totalErrors = 0;
    let successfulRecoveries = 0;
    let totalRecoveryTime = 0;
    const errorTypeCounts = new Map<ErrorType, number>();
    const strategySuccessRates = new Map<string, { successes: number; total: number }>();

    // Aggregate statistics from recovery history
    for (const [errorId, results] of this.recoveryHistory) {
      for (const result of results) {
        totalErrors++;
        
        if (result.success) {
          successfulRecoveries++;
          totalRecoveryTime += result.duration;
        }

        // Count error types (would need to store this info)
        // For now, we'll use placeholder logic
        
        // Track strategy effectiveness
        const strategyId = result.strategy.id;
        if (!strategySuccessRates.has(strategyId)) {
          strategySuccessRates.set(strategyId, { successes: 0, total: 0 });
        }
        
        const stats = strategySuccessRates.get(strategyId)!;
        stats.total++;
        if (result.success) {
          stats.successes++;
        }
      }
    }

    const successRate = totalErrors > 0 ? (successfulRecoveries / totalErrors) * 100 : 0;
    const averageRecoveryTime = successfulRecoveries > 0 ? totalRecoveryTime / successfulRecoveries : 0;

    // Convert maps to arrays for the result
    const commonErrorTypes = Array.from(errorTypeCounts.entries())
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const effectiveStrategies = Array.from(strategySuccessRates.entries())
      .map(([strategy, stats]) => ({
        strategy,
        successRate: stats.total > 0 ? (stats.successes / stats.total) * 100 : 0
      }))
      .sort((a, b) => b.successRate - a.successRate)
      .slice(0, 5);

    return {
      totalErrors,
      successfulRecoveries,
      successRate,
      commonErrorTypes,
      effectiveStrategies,
      averageRecoveryTime,
      timePeriod: {
        start: thirtyDaysAgo,
        end: now
      }
    };
  }

  // Private helper methods

  private async matchKnownErrorPattern(error: AutomationError, context: ActionContext): Promise<ErrorClassification | null> {
    const errorKey = `${error.type}_${error.message.substring(0, 50)}`;
    const knownPatterns = this.errorPatterns.get(errorKey);
    
    if (knownPatterns && knownPatterns.length > 0) {
      // Return the most recent classification
      return knownPatterns[knownPatterns.length - 1];
    }
    
    return null;
  }

  private async aiClassifyError(error: AutomationError, context: ActionContext): Promise<ErrorClassification> {
    const prompt = `
      Classify this browser automation error:
      
      Error Details:
      - Type: ${error.type}
      - Message: ${error.message}
      - Stack: ${error.stack || 'N/A'}
      - Context: ${JSON.stringify(error.context, null, 2)}
      
      Action Context:
      - URL: ${context.currentUrl}
      - Objective: ${context.objective || 'N/A'}
      - Target Element: ${JSON.stringify(context.targetElement, null, 2)}
      
      Provide a detailed classification with:
      1. Specific error type
      2. Severity level (low/medium/high/critical)
      3. Possible causes
      4. Whether it's recoverable
      5. Confidence in classification (0-1)
      
      Respond with JSON:
      {
        "type": "error_type",
        "severity": "severity_level",
        "possibleCauses": ["cause1", "cause2"],
        "recoverable": boolean,
        "confidence": number,
        "metadata": {}
      }
    `;

    const response = await this.aiProvider.generateCompletion(prompt, {
      temperature: 0.1,
      maxTokens: 500
    });

    const aiResult = JSON.parse(response);
    
    return {
      type: aiResult.type as ErrorType,
      severity: aiResult.severity as ErrorSeverity,
      context: {
        url: context.currentUrl,
        currentStep: context.objective,
        failedSelector: JSON.stringify(context.targetElement),
        pageState: {},
        browserState: {},
        timestamp: new Date(),
        actionHistory: context.previousActions || []
      },
      possibleCauses: aiResult.possibleCauses,
      recoverable: aiResult.recoverable,
      confidence: aiResult.confidence,
      metadata: aiResult.metadata || {}
    };
  }

  private basicErrorClassification(error: AutomationError, context: ActionContext): ErrorClassification {
    let type: ErrorType;
    let severity: ErrorSeverity;
    
    // Basic classification based on error type
    switch (error.type) {
      case 'element_not_found':
        type = ErrorType.ELEMENT_NOT_FOUND;
        severity = ErrorSeverity.MEDIUM;
        break;
      case 'timeout':
        type = ErrorType.PAGE_LOAD_TIMEOUT;
        severity = ErrorSeverity.MEDIUM;
        break;
      case 'network':
        type = ErrorType.NETWORK_ERROR;
        severity = ErrorSeverity.HIGH;
        break;
      default:
        type = ErrorType.UNKNOWN;
        severity = ErrorSeverity.LOW;
    }

    return {
      type,
      severity,
      context: {
        url: context.currentUrl,
        currentStep: context.objective,
        failedSelector: JSON.stringify(context.targetElement),
        pageState: {},
        browserState: {},
        timestamp: new Date(),
        actionHistory: context.previousActions || []
      },
      possibleCauses: ['Unknown cause'],
      recoverable: true,
      confidence: 0.5,
      metadata: {}
    };
  }

  private async generateAIRecoveryStrategies(classification: ErrorClassification): Promise<RecoveryStrategy[]> {
    const prompt = `
      Generate recovery strategies for this classified error:
      
      Error Classification:
      - Type: ${classification.type}
      - Severity: ${classification.severity}
      - Causes: ${classification.possibleCauses.join(', ')}
      - Context: ${JSON.stringify(classification.context, null, 2)}
      
      Generate 2-3 recovery strategies with:
      1. Strategy name and description
      2. Specific steps to execute
      3. Success probability estimate
      4. Priority level (1-10)
      5. Time estimate in milliseconds
      
      Respond with JSON array of strategies:
      [
        {
          "name": "strategy_name",
          "description": "what this strategy does",
          "steps": [
            {
              "type": "action_type",
              "description": "step description",
              "parameters": {},
              "timeout": 5000,
              "optional": false
            }
          ],
          "successProbability": 0.8,
          "priority": 8,
          "timeEstimate": 10000
        }
      ]
    `;

    const response = await this.aiProvider.generateCompletion(prompt, {
      temperature: 0.3,
      maxTokens: 1000
    });

    const aiStrategies = JSON.parse(response);
    
    return aiStrategies.map((strategy: any, index: number) => ({
      id: `ai_strategy_${Date.now()}_${index}`,
      name: strategy.name,
      description: strategy.description,
      steps: strategy.steps.map((step: any) => ({
        type: step.type as RecoveryActionType,
        description: step.description,
        parameters: step.parameters,
        timeout: step.timeout,
        optional: step.optional
      })),
      successProbability: strategy.successProbability,
      timeEstimate: strategy.timeEstimate,
      priority: strategy.priority,
      applicableConditions: [`error_type:${classification.type}`]
    }));
  }

  private getPredefinedStrategies(errorType: ErrorType): RecoveryStrategy[] {
    const strategies: RecoveryStrategy[] = [];
    
    switch (errorType) {
      case ErrorType.ELEMENT_NOT_FOUND:
        strategies.push({
          id: 'element_not_found_wait_retry',
          name: 'Wait and Retry',
          description: 'Wait for element to appear and retry',
          steps: [
            {
              type: RecoveryActionType.WAIT,
              description: 'Wait for element to load',
              parameters: { duration: 3000 },
              timeout: 5000,
              optional: false
            },
            {
              type: RecoveryActionType.RETRY_ACTION,
              description: 'Retry the original action',
              parameters: {},
              timeout: 10000,
              optional: false
            }
          ],
          successProbability: 0.7,
          timeEstimate: 8000,
          priority: 7,
          applicableConditions: ['error_type:element_not_found']
        });
        break;
        
      case ErrorType.PAGE_LOAD_TIMEOUT:
        strategies.push({
          id: 'page_timeout_refresh',
          name: 'Refresh and Retry',
          description: 'Refresh the page and retry',
          steps: [
            {
              type: RecoveryActionType.REFRESH_PAGE,
              description: 'Refresh the current page',
              parameters: {},
              timeout: 30000,
              optional: false
            },
            {
              type: RecoveryActionType.WAIT,
              description: 'Wait for page to load',
              parameters: { duration: 5000 },
              timeout: 10000,
              optional: false
            }
          ],
          successProbability: 0.6,
          timeEstimate: 35000,
          priority: 6,
          applicableConditions: ['error_type:page_load_timeout']
        });
        break;
    }
    
    return strategies;
  }

  private getBasicRecoveryStrategies(errorType: ErrorType): RecoveryStrategy[] {
    return [{
      id: 'basic_retry',
      name: 'Basic Retry',
      description: 'Simple retry with delay',
      steps: [
        {
          type: RecoveryActionType.WAIT,
          description: 'Wait before retry',
          parameters: { duration: 2000 },
          timeout: 3000,
          optional: false
        },
        {
          type: RecoveryActionType.RETRY_ACTION,
          description: 'Retry the action',
          parameters: {},
          timeout: 10000,
          optional: false
        }
      ],
      successProbability: 0.5,
      timeEstimate: 5000,
      priority: 5,
      applicableConditions: [`error_type:${errorType}`]
    }];
  }

  private async executeRecoveryStep(step: RecoveryStep, context: ActionContext): Promise<{ success: boolean; newContext?: ActionContext }> {
    console.log(`Executing recovery step: ${step.description}`);
    
    switch (step.type) {
      case RecoveryActionType.WAIT:
        await new Promise(resolve => setTimeout(resolve, step.parameters.duration || 1000));
        return { success: true };
        
      case RecoveryActionType.REFRESH_PAGE:
        // This would need to be implemented with actual browser control
        console.log('Refreshing page...');
        return { success: true };
        
      case RecoveryActionType.RETRY_ACTION:
        // This would retry the original failed action
        console.log('Retrying original action...');
        return { success: true };
        
      default:
        console.warn(`Unsupported recovery action type: ${step.type}`);
        return { success: false };
    }
  }

  private async handleRecaptcha(captchaType: CaptchaType, context: ActionContext): Promise<CaptchaHandlingResult> {
    // Placeholder implementation - would need actual CAPTCHA solving logic
    return {
      success: false,
      method: CaptchaHandlingMethod.SKIP,
      duration: 1000,
      confidence: 0,
      error: 'CAPTCHA handling not implemented'
    };
  }

  private async handleHCaptcha(context: ActionContext): Promise<CaptchaHandlingResult> {
    // Placeholder implementation
    return {
      success: false,
      method: CaptchaHandlingMethod.SKIP,
      duration: 1000,
      confidence: 0,
      error: 'hCaptcha handling not implemented'
    };
  }

  private async handleImageCaptcha(context: ActionContext): Promise<CaptchaHandlingResult> {
    // Placeholder implementation
    return {
      success: false,
      method: CaptchaHandlingMethod.SKIP,
      duration: 1000,
      confidence: 0,
      error: 'Image CAPTCHA handling not implemented'
    };
  }

  private async handleTextCaptcha(context: ActionContext): Promise<CaptchaHandlingResult> {
    // Placeholder implementation
    return {
      success: false,
      method: CaptchaHandlingMethod.SKIP,
      duration: 1000,
      confidence: 0,
      error: 'Text CAPTCHA handling not implemented'
    };
  }

  private async analyzeTimeoutSituation(timeoutContext: TimeoutContext): Promise<any> {
    // Analyze the timeout situation to determine best resolution
    return {
      severity: timeoutContext.actualWaitTime > timeoutContext.expectedWaitTime * 2 ? 'high' : 'medium',
      likelyResolution: 'extend_timeout'
    };
  }

  private determineTimeoutResolutionMethod(analysis: any): TimeoutResolutionMethod {
    // Determine the best method based on analysis
    return TimeoutResolutionMethod.EXTEND_TIMEOUT;
  }

  private async executeTimeoutResolution(method: TimeoutResolutionMethod, context: TimeoutContext): Promise<TimeoutResolution> {
    switch (method) {
      case TimeoutResolutionMethod.EXTEND_TIMEOUT:
        return {
          resolved: true,
          method,
          newTimeout: context.expectedWaitTime * 2,
          duration: 100,
          shouldRetry: true
        };
        
      default:
        return {
          resolved: false,
          method,
          duration: 0,
          shouldRetry: false
        };
    }
  }

  private async storeErrorPattern(error: AutomationError, classification: ErrorClassification): Promise<void> {
    const errorKey = `${error.type}_${error.message.substring(0, 50)}`;
    
    if (!this.errorPatterns.has(errorKey)) {
      this.errorPatterns.set(errorKey, []);
    }
    
    this.errorPatterns.get(errorKey)!.push(classification);
    
    // Keep only the last 10 classifications for each pattern
    const patterns = this.errorPatterns.get(errorKey)!;
    if (patterns.length > 10) {
      patterns.splice(0, patterns.length - 10);
    }
  }

  private async updateStrategyEffectiveness(strategyId: string, success: boolean): Promise<void> {
    const currentEffectiveness = this.strategyEffectiveness.get(strategyId) || 0.5;
    
    // Simple learning rate adjustment
    const learningRate = 0.1;
    const newEffectiveness = success 
      ? currentEffectiveness + (1 - currentEffectiveness) * learningRate
      : currentEffectiveness - currentEffectiveness * learningRate;
    
    this.strategyEffectiveness.set(strategyId, Math.max(0, Math.min(1, newEffectiveness)));
  }
}