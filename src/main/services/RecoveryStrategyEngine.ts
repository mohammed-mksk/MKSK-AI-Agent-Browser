/**
 * Recovery Strategy Engine
 * 
 * Purpose: Implements AI-generated recovery strategies with success probability estimation,
 * fallback strategy chaining, and recovery execution monitoring.
 * This engine focuses specifically on creating and managing recovery strategies.
 */

import {
  RecoveryStrategy,
  RecoveryStep,
  RecoveryActionType,
  ErrorClassification,
  ErrorType,
  RecoveryResult
} from '../interfaces/IErrorRecovery.js';
import { ActionContext } from '../../shared/types.js';
import { AIProviderManager } from './AIProviderManager.js';

export interface IRecoveryStrategyEngine {
  /**
   * Generate AI-powered recovery strategies for a classified error
   * @param classification - The classified error
   * @param context - Current action context
   * @returns Promise resolving to array of recovery strategies
   */
  generateStrategies(classification: ErrorClassification, context: ActionContext): Promise<RecoveryStrategy[]>;

  /**
   * Estimate success probability for a recovery strategy
   * @param strategy - The recovery strategy
   * @param classification - The error classification
   * @param context - Current context
   * @returns Promise resolving to success probability (0-1)
   */
  estimateSuccessProbability(strategy: RecoveryStrategy, classification: ErrorClassification, context: ActionContext): Promise<number>;

  /**
   * Create fallback strategy chains
   * @param primaryStrategy - The primary recovery strategy
   * @param classification - The error classification
   * @returns Promise resolving to strategy with fallback chain
   */
  createFallbackChain(primaryStrategy: RecoveryStrategy, classification: ErrorClassification): Promise<RecoveryStrategy>;

  /**
   * Monitor recovery execution and adapt strategies
   * @param strategy - The strategy being executed
   * @param executionProgress - Current execution progress
   * @returns Promise resolving to execution recommendations
   */
  monitorExecution(strategy: RecoveryStrategy, executionProgress: RecoveryExecutionProgress): Promise<ExecutionRecommendation>;

  /**
   * Learn from recovery results to improve future strategies
   * @param result - The recovery result
   * @returns Promise resolving to learning insights
   */
  learnFromResult(result: RecoveryResult): Promise<StrategyLearning>;
}

export interface RecoveryExecutionProgress {
  strategy: RecoveryStrategy;
  currentStepIndex: number;
  completedSteps: RecoveryStep[];
  failedSteps: RecoveryStep[];
  elapsedTime: number;
  currentContext: ActionContext;
}

export interface ExecutionRecommendation {
  shouldContinue: boolean;
  shouldSwitchStrategy: boolean;
  alternativeStrategy?: RecoveryStrategy;
  adjustedParameters?: Record<string, any>;
  reasoning: string;
}

export interface StrategyLearning {
  strategyId: string;
  successFactors: string[];
  failureFactors: string[];
  contextPatterns: string[];
  recommendedAdjustments: string[];
  confidenceAdjustment: number;
}

export class RecoveryStrategyEngine implements IRecoveryStrategyEngine {
  private aiProvider: AIProviderManager;
  private strategyHistory: Map<string, RecoveryResult[]> = new Map();
  private strategyEffectiveness: Map<string, StrategyEffectiveness> = new Map();
  private contextPatterns: Map<string, ContextPattern[]> = new Map();

  constructor(aiProvider: AIProviderManager) {
    this.aiProvider = aiProvider;
  }

  async generateStrategies(classification: ErrorClassification, context: ActionContext): Promise<RecoveryStrategy[]> {
    try {
      console.log(`Generating recovery strategies for error type: ${classification.type}`);

      // Generate AI-powered strategies
      const aiStrategies = await this.generateAIStrategies(classification, context);
      
      // Generate template-based strategies
      const templateStrategies = await this.generateTemplateStrategies(classification, context);
      
      // Combine and prioritize strategies
      const allStrategies = [...aiStrategies, ...templateStrategies];
      
      // Estimate success probabilities
      for (const strategy of allStrategies) {
        strategy.successProbability = await this.estimateSuccessProbability(strategy, classification, context);
      }
      
      // Sort by priority and success probability
      allStrategies.sort((a, b) => {
        if (a.priority !== b.priority) {
          return b.priority - a.priority;
        }
        return b.successProbability - a.successProbability;
      });

      // Create fallback chains for top strategies
      const strategiesWithFallbacks = await Promise.all(
        allStrategies.slice(0, 3).map(strategy => this.createFallbackChain(strategy, classification))
      );

      return strategiesWithFallbacks;
    } catch (error) {
      console.error('Error generating recovery strategies:', error);
      return this.getFallbackStrategies(classification.type);
    }
  }

  async estimateSuccessProbability(
    strategy: RecoveryStrategy, 
    classification: ErrorClassification, 
    context: ActionContext
  ): Promise<number> {
    try {
      // Get historical effectiveness
      const historicalEffectiveness = this.getHistoricalEffectiveness(strategy.id, classification.type);
      
      // Use AI to analyze strategy fit for current context
      const aiEstimate = await this.getAISuccessEstimate(strategy, classification, context);
      
      // Combine historical and AI estimates
      const combinedEstimate = (historicalEffectiveness * 0.6) + (aiEstimate * 0.4);
      
      // Apply context-specific adjustments
      const contextAdjustment = this.getContextAdjustment(strategy, context);
      
      return Math.max(0.1, Math.min(0.95, combinedEstimate + contextAdjustment));
    } catch (error) {
      console.error('Error estimating success probability:', error);
      return strategy.successProbability || 0.5;
    }
  }

  async createFallbackChain(primaryStrategy: RecoveryStrategy, classification: ErrorClassification): Promise<RecoveryStrategy> {
    try {
      // Generate fallback strategies
      const fallbackStrategies = await this.generateFallbackStrategies(primaryStrategy, classification);
      
      if (fallbackStrategies.length === 0) {
        return primaryStrategy;
      }

      // Create the chain
      let currentStrategy = primaryStrategy;
      for (let i = 0; i < fallbackStrategies.length; i++) {
        const fallback = fallbackStrategies[i];
        currentStrategy.fallbackStrategy = fallback;
        currentStrategy = fallback;
      }

      return primaryStrategy;
    } catch (error) {
      console.error('Error creating fallback chain:', error);
      return primaryStrategy;
    }
  }

  async monitorExecution(strategy: RecoveryStrategy, progress: RecoveryExecutionProgress): Promise<ExecutionRecommendation> {
    try {
      // Analyze execution progress
      const progressAnalysis = this.analyzeExecutionProgress(progress);
      
      // Check if strategy is performing as expected
      const performanceCheck = await this.checkStrategyPerformance(strategy, progress);
      
      // Generate recommendation
      if (performanceCheck.isUnderperforming && progress.currentStepIndex < strategy.steps.length / 2) {
        // Switch to alternative strategy early if underperforming
        const alternativeStrategy = await this.findAlternativeStrategy(strategy, progress);
        
        return {
          shouldContinue: false,
          shouldSwitchStrategy: true,
          alternativeStrategy,
          reasoning: `Strategy underperforming: ${performanceCheck.reason}. Switching to alternative.`
        };
      }

      if (progressAnalysis.isStuck) {
        // Adjust parameters if stuck
        const adjustedParameters = await this.generateParameterAdjustments(strategy, progress);
        
        return {
          shouldContinue: true,
          shouldSwitchStrategy: false,
          adjustedParameters,
          reasoning: 'Execution appears stuck. Adjusting parameters to improve progress.'
        };
      }

      return {
        shouldContinue: true,
        shouldSwitchStrategy: false,
        reasoning: 'Strategy execution proceeding normally.'
      };
    } catch (error) {
      console.error('Error monitoring execution:', error);
      return {
        shouldContinue: true,
        shouldSwitchStrategy: false,
        reasoning: 'Monitoring error occurred, continuing with current strategy.'
      };
    }
  }

  async learnFromResult(result: RecoveryResult): Promise<StrategyLearning> {
    try {
      const strategyId = result.strategy.id;
      
      // Store result in history
      if (!this.strategyHistory.has(strategyId)) {
        this.strategyHistory.set(strategyId, []);
      }
      this.strategyHistory.get(strategyId)!.push(result);

      // Analyze success/failure factors
      const successFactors = result.success ? this.extractSuccessFactors(result) : [];
      const failureFactors = !result.success ? this.extractFailureFactors(result) : [];
      
      // Identify context patterns
      const contextPatterns = this.identifyContextPatterns(result);
      
      // Generate improvement recommendations
      const recommendations = await this.generateImprovementRecommendations(result);
      
      // Update strategy effectiveness
      this.updateStrategyEffectiveness(strategyId, result);
      
      const learning: StrategyLearning = {
        strategyId,
        successFactors,
        failureFactors,
        contextPatterns,
        recommendedAdjustments: recommendations,
        confidenceAdjustment: this.calculateConfidenceAdjustment(result)
      };

      console.log(`Learning from strategy ${strategyId}:`, learning);
      return learning;
    } catch (error) {
      console.error('Error learning from result:', error);
      return {
        strategyId: result.strategy.id,
        successFactors: [],
        failureFactors: [],
        contextPatterns: [],
        recommendedAdjustments: [],
        confidenceAdjustment: 0
      };
    }
  }

  // Private helper methods

  private async generateAIStrategies(classification: ErrorClassification, context: ActionContext): Promise<RecoveryStrategy[]> {
    const prompt = `
      Generate intelligent recovery strategies for this browser automation error:
      
      Error Details:
      - Type: ${classification.type}
      - Severity: ${classification.severity}
      - Causes: ${classification.possibleCauses.join(', ')}
      - Recoverable: ${classification.recoverable}
      - Context URL: ${classification.context.url}
      
      Current Context:
      - Objective: ${context.objective || 'Unknown'}
      - Current URL: ${context.currentUrl}
      - Target Element: ${JSON.stringify(context.targetElement)}
      
      Generate 2-3 innovative recovery strategies that:
      1. Address the root cause of the error
      2. Have high success probability
      3. Include specific, actionable steps
      4. Consider the current context and objective
      
      For each strategy, provide:
      - Unique name and clear description
      - Specific recovery steps with parameters
      - Estimated success probability (0.1-0.9)
      - Priority level (1-10, higher = more important)
      - Time estimate in milliseconds
      
      Respond with JSON array:
      [
        {
          "name": "strategy_name",
          "description": "detailed description",
          "steps": [
            {
              "type": "action_type",
              "description": "step description", 
              "parameters": {"key": "value"},
              "timeout": 5000,
              "optional": false
            }
          ],
          "successProbability": 0.8,
          "priority": 8,
          "timeEstimate": 15000,
          "applicableConditions": ["condition1", "condition2"]
        }
      ]
    `;

    try {
      const response = await this.aiProvider.generateCompletion(prompt, {
        temperature: 0.3,
        maxTokens: 1500
      });

      const aiStrategies = JSON.parse(response);
      
      return aiStrategies.map((strategy: any, index: number) => ({
        id: `ai_strategy_${classification.type}_${Date.now()}_${index}`,
        name: strategy.name,
        description: strategy.description,
        steps: strategy.steps.map((step: any) => ({
          type: step.type as RecoveryActionType,
          description: step.description,
          parameters: step.parameters || {},
          timeout: step.timeout || 10000,
          optional: step.optional || false
        })),
        successProbability: strategy.successProbability,
        timeEstimate: strategy.timeEstimate,
        priority: strategy.priority,
        applicableConditions: strategy.applicableConditions || []
      }));
    } catch (error) {
      console.error('Error generating AI strategies:', error);
      return [];
    }
  }

  private async generateTemplateStrategies(classification: ErrorClassification, context: ActionContext): Promise<RecoveryStrategy[]> {
    const strategies: RecoveryStrategy[] = [];
    
    switch (classification.type) {
      case ErrorType.ELEMENT_NOT_FOUND:
        strategies.push(
          this.createWaitAndRetryStrategy(),
          this.createAlternativeSelectorStrategy(),
          this.createScrollAndSearchStrategy()
        );
        break;
        
      case ErrorType.PAGE_LOAD_TIMEOUT:
        strategies.push(
          this.createRefreshAndRetryStrategy(),
          this.createNetworkOptimizationStrategy()
        );
        break;
        
      case ErrorType.JAVASCRIPT_ERROR:
        strategies.push(
          this.createJavaScriptRecoveryStrategy(),
          this.createFallbackActionStrategy()
        );
        break;
        
      default:
        strategies.push(this.createGenericRetryStrategy());
    }
    
    return strategies;
  }

  private createWaitAndRetryStrategy(): RecoveryStrategy {
    return {
      id: 'wait_and_retry_enhanced',
      name: 'Enhanced Wait and Retry',
      description: 'Wait with progressive delays and retry with improved element detection',
      steps: [
        {
          type: RecoveryActionType.WAIT,
          description: 'Initial wait for dynamic content',
          parameters: { duration: 2000 },
          timeout: 3000,
          optional: false
        },
        {
          type: RecoveryActionType.SCROLL_TO_ELEMENT,
          description: 'Scroll to bring element into view',
          parameters: { behavior: 'smooth' },
          timeout: 5000,
          optional: true
        },
        {
          type: RecoveryActionType.RETRY_ACTION,
          description: 'Retry with enhanced element detection',
          parameters: { enhancedDetection: true },
          timeout: 10000,
          optional: false
        }
      ],
      successProbability: 0.75,
      timeEstimate: 15000,
      priority: 8,
      applicableConditions: ['error_type:element_not_found']
    };
  }

  private createAlternativeSelectorStrategy(): RecoveryStrategy {
    return {
      id: 'alternative_selector_ai',
      name: 'AI-Powered Alternative Selector',
      description: 'Use AI to find alternative selectors for the target element',
      steps: [
        {
          type: RecoveryActionType.ALTERNATIVE_SELECTOR,
          description: 'Generate alternative selectors using AI',
          parameters: { useAI: true, maxAlternatives: 5 },
          timeout: 8000,
          optional: false
        },
        {
          type: RecoveryActionType.RETRY_ACTION,
          description: 'Retry with best alternative selector',
          parameters: { useAlternativeSelector: true },
          timeout: 10000,
          optional: false
        }
      ],
      successProbability: 0.65,
      timeEstimate: 18000,
      priority: 7,
      applicableConditions: ['error_type:element_not_found']
    };
  }

  private createScrollAndSearchStrategy(): RecoveryStrategy {
    return {
      id: 'scroll_and_search',
      name: 'Scroll and Search Strategy',
      description: 'Systematically scroll through page to find element',
      steps: [
        {
          type: RecoveryActionType.SCROLL_TO_ELEMENT,
          description: 'Scroll to top of page',
          parameters: { position: 'top' },
          timeout: 3000,
          optional: false
        },
        {
          type: RecoveryActionType.WAIT,
          description: 'Wait for content to stabilize',
          parameters: { duration: 1500 },
          timeout: 2000,
          optional: false
        },
        {
          type: RecoveryActionType.RETRY_ACTION,
          description: 'Search for element while scrolling',
          parameters: { scrollSearch: true, maxScrolls: 10 },
          timeout: 20000,
          optional: false
        }
      ],
      successProbability: 0.55,
      timeEstimate: 25000,
      priority: 6,
      applicableConditions: ['error_type:element_not_found']
    };
  }

  private createRefreshAndRetryStrategy(): RecoveryStrategy {
    return {
      id: 'refresh_and_retry_smart',
      name: 'Smart Refresh and Retry',
      description: 'Intelligently refresh page and retry with optimizations',
      steps: [
        {
          type: RecoveryActionType.REFRESH_PAGE,
          description: 'Refresh page with cache bypass',
          parameters: { bypassCache: true },
          timeout: 30000,
          optional: false
        },
        {
          type: RecoveryActionType.WAIT,
          description: 'Wait for page to fully load',
          parameters: { duration: 5000, waitForNetworkIdle: true },
          timeout: 15000,
          optional: false
        },
        {
          type: RecoveryActionType.RETRY_ACTION,
          description: 'Retry original action',
          parameters: {},
          timeout: 10000,
          optional: false
        }
      ],
      successProbability: 0.70,
      timeEstimate: 45000,
      priority: 7,
      applicableConditions: ['error_type:page_load_timeout']
    };
  }

  private createNetworkOptimizationStrategy(): RecoveryStrategy {
    return {
      id: 'network_optimization',
      name: 'Network Optimization Strategy',
      description: 'Optimize network conditions and retry',
      steps: [
        {
          type: RecoveryActionType.ADD_DELAY,
          description: 'Add delay for network stabilization',
          parameters: { duration: 3000 },
          timeout: 5000,
          optional: false
        },
        {
          type: RecoveryActionType.RETRY_ACTION,
          description: 'Retry with network optimizations',
          parameters: { networkOptimization: true },
          timeout: 20000,
          optional: false
        }
      ],
      successProbability: 0.60,
      timeEstimate: 25000,
      priority: 6,
      applicableConditions: ['error_type:page_load_timeout', 'error_type:network_error']
    };
  }

  private createJavaScriptRecoveryStrategy(): RecoveryStrategy {
    return {
      id: 'javascript_recovery',
      name: 'JavaScript Error Recovery',
      description: 'Handle JavaScript errors and retry',
      steps: [
        {
          type: RecoveryActionType.WAIT,
          description: 'Wait for JavaScript to stabilize',
          parameters: { duration: 2000 },
          timeout: 3000,
          optional: false
        },
        {
          type: RecoveryActionType.RETRY_ACTION,
          description: 'Retry with JavaScript error handling',
          parameters: { ignoreJSErrors: true },
          timeout: 10000,
          optional: false
        }
      ],
      successProbability: 0.50,
      timeEstimate: 12000,
      priority: 5,
      applicableConditions: ['error_type:javascript_error']
    };
  }

  private createFallbackActionStrategy(): RecoveryStrategy {
    return {
      id: 'fallback_action',
      name: 'Fallback Action Strategy',
      description: 'Use alternative action methods',
      steps: [
        {
          type: RecoveryActionType.RETRY_ACTION,
          description: 'Try alternative action method',
          parameters: { useAlternativeMethod: true },
          timeout: 15000,
          optional: false
        }
      ],
      successProbability: 0.45,
      timeEstimate: 15000,
      priority: 4,
      applicableConditions: ['error_type:javascript_error']
    };
  }

  private createGenericRetryStrategy(): RecoveryStrategy {
    return {
      id: 'generic_retry',
      name: 'Generic Retry Strategy',
      description: 'Basic retry with progressive delays',
      steps: [
        {
          type: RecoveryActionType.WAIT,
          description: 'Wait before retry',
          parameters: { duration: 3000 },
          timeout: 5000,
          optional: false
        },
        {
          type: RecoveryActionType.RETRY_ACTION,
          description: 'Retry original action',
          parameters: {},
          timeout: 10000,
          optional: false
        }
      ],
      successProbability: 0.40,
      timeEstimate: 13000,
      priority: 3,
      applicableConditions: []
    };
  }

  private getFallbackStrategies(errorType: ErrorType): RecoveryStrategy[] {
    return [this.createGenericRetryStrategy()];
  }

  private getHistoricalEffectiveness(strategyId: string, errorType: ErrorType): number {
    const effectiveness = this.strategyEffectiveness.get(strategyId);
    if (!effectiveness) {
      return 0.5; // Default for new strategies
    }
    
    const typeSpecificEffectiveness = effectiveness.byErrorType.get(errorType);
    return typeSpecificEffectiveness || effectiveness.overall;
  }

  private async getAISuccessEstimate(
    strategy: RecoveryStrategy, 
    classification: ErrorClassification, 
    context: ActionContext
  ): Promise<number> {
    try {
      const prompt = `
        Estimate the success probability of this recovery strategy:
        
        Strategy: ${strategy.name}
        Description: ${strategy.description}
        Steps: ${strategy.steps.map(s => s.description).join(', ')}
        
        Error Context:
        - Type: ${classification.type}
        - Severity: ${classification.severity}
        - Causes: ${classification.possibleCauses.join(', ')}
        - URL: ${classification.context.url}
        
        Current Situation:
        - Objective: ${context.objective}
        - Current URL: ${context.currentUrl}
        
        Provide a success probability estimate (0.1-0.9) based on:
        1. How well the strategy addresses the error type
        2. Appropriateness of steps for the context
        3. Likelihood of success given the error causes
        
        Respond with just a number between 0.1 and 0.9.
      `;

      const response = await this.aiProvider.generateCompletion(prompt, {
        temperature: 0.1,
        maxTokens: 50
      });

      const estimate = parseFloat(response.trim());
      return isNaN(estimate) ? 0.5 : Math.max(0.1, Math.min(0.9, estimate));
    } catch (error) {
      console.error('Error getting AI success estimate:', error);
      return 0.5;
    }
  }

  private getContextAdjustment(strategy: RecoveryStrategy, context: ActionContext): number {
    let adjustment = 0;
    
    // Adjust based on context patterns
    const contextKey = `${context.currentUrl}_${context.objective}`;
    const patterns = this.contextPatterns.get(contextKey);
    
    if (patterns) {
      const relevantPattern = patterns.find(p => p.strategyId === strategy.id);
      if (relevantPattern) {
        adjustment += relevantPattern.successRate - 0.5;
      }
    }
    
    return Math.max(-0.3, Math.min(0.3, adjustment));
  }

  private async generateFallbackStrategies(primaryStrategy: RecoveryStrategy, classification: ErrorClassification): Promise<RecoveryStrategy[]> {
    // Generate simpler, more basic strategies as fallbacks
    const fallbacks: RecoveryStrategy[] = [];
    
    if (primaryStrategy.id !== 'generic_retry') {
      fallbacks.push(this.createGenericRetryStrategy());
    }
    
    // Add error-type specific fallbacks
    switch (classification.type) {
      case ErrorType.ELEMENT_NOT_FOUND:
        if (!primaryStrategy.id.includes('wait_and_retry')) {
          fallbacks.push(this.createWaitAndRetryStrategy());
        }
        break;
    }
    
    return fallbacks.slice(0, 2); // Limit to 2 fallback strategies
  }

  private analyzeExecutionProgress(progress: RecoveryExecutionProgress): { isStuck: boolean; reason?: string } {
    const expectedTimePerStep = progress.strategy.timeEstimate / progress.strategy.steps.length;
    const actualTimePerStep = progress.elapsedTime / Math.max(1, progress.currentStepIndex);
    
    if (actualTimePerStep > expectedTimePerStep * 2) {
      return { isStuck: true, reason: 'Steps taking longer than expected' };
    }
    
    if (progress.failedSteps.length > progress.completedSteps.length) {
      return { isStuck: true, reason: 'More steps failing than succeeding' };
    }
    
    return { isStuck: false };
  }

  private async checkStrategyPerformance(
    strategy: RecoveryStrategy, 
    progress: RecoveryExecutionProgress
  ): Promise<{ isUnderperforming: boolean; reason?: string }> {
    const completionRate = progress.completedSteps.length / strategy.steps.length;
    const expectedCompletionRate = progress.elapsedTime / strategy.timeEstimate;
    
    if (completionRate < expectedCompletionRate * 0.5) {
      return { isUnderperforming: true, reason: 'Completion rate below expectations' };
    }
    
    return { isUnderperforming: false };
  }

  private async findAlternativeStrategy(
    currentStrategy: RecoveryStrategy, 
    progress: RecoveryExecutionProgress
  ): Promise<RecoveryStrategy | undefined> {
    // Return the fallback strategy if available
    return currentStrategy.fallbackStrategy;
  }

  private async generateParameterAdjustments(
    strategy: RecoveryStrategy, 
    progress: RecoveryExecutionProgress
  ): Promise<Record<string, any>> {
    // Generate parameter adjustments based on current progress
    const adjustments: Record<string, any> = {};
    
    // Increase timeouts if steps are taking longer
    if (progress.elapsedTime > strategy.timeEstimate * 0.8) {
      adjustments.timeoutMultiplier = 1.5;
    }
    
    // Reduce delays if moving too slowly
    if (progress.currentStepIndex < strategy.steps.length * 0.3) {
      adjustments.delayReduction = 0.5;
    }
    
    return adjustments;
  }

  private extractSuccessFactors(result: RecoveryResult): string[] {
    const factors: string[] = [];
    
    if (result.duration < result.strategy.timeEstimate) {
      factors.push('Completed faster than expected');
    }
    
    if (result.completedSteps.length === result.strategy.steps.length) {
      factors.push('All steps completed successfully');
    }
    
    return factors;
  }

  private extractFailureFactors(result: RecoveryResult): string[] {
    const factors: string[] = [];
    
    if (result.error) {
      factors.push(`Failed with error: ${result.error.message}`);
    }
    
    if (result.duration > result.strategy.timeEstimate * 1.5) {
      factors.push('Took significantly longer than expected');
    }
    
    const incompleteSteps = result.strategy.steps.length - result.completedSteps.length;
    if (incompleteSteps > 0) {
      factors.push(`${incompleteSteps} steps not completed`);
    }
    
    return factors;
  }

  private identifyContextPatterns(result: RecoveryResult): string[] {
    const patterns: string[] = [];
    
    if (result.newContext?.currentUrl) {
      patterns.push(`url_pattern:${new URL(result.newContext.currentUrl).hostname}`);
    }
    
    if (result.strategy.applicableConditions) {
      patterns.push(...result.strategy.applicableConditions);
    }
    
    return patterns;
  }

  private async generateImprovementRecommendations(result: RecoveryResult): Promise<string[]> {
    const recommendations: string[] = [];
    
    if (!result.success && result.completedSteps.length > 0) {
      recommendations.push('Consider breaking strategy into smaller, more focused steps');
    }
    
    if (result.duration > result.strategy.timeEstimate * 2) {
      recommendations.push('Increase timeout values for individual steps');
    }
    
    return recommendations;
  }

  private calculateConfidenceAdjustment(result: RecoveryResult): number {
    if (result.success) {
      return result.duration < result.strategy.timeEstimate ? 0.1 : 0.05;
    } else {
      return result.completedSteps.length > 0 ? -0.05 : -0.1;
    }
  }

  private updateStrategyEffectiveness(strategyId: string, result: RecoveryResult): void {
    if (!this.strategyEffectiveness.has(strategyId)) {
      this.strategyEffectiveness.set(strategyId, {
        overall: 0.5,
        byErrorType: new Map(),
        totalExecutions: 0,
        successfulExecutions: 0
      });
    }
    
    const effectiveness = this.strategyEffectiveness.get(strategyId)!;
    effectiveness.totalExecutions++;
    
    if (result.success) {
      effectiveness.successfulExecutions++;
    }
    
    effectiveness.overall = effectiveness.successfulExecutions / effectiveness.totalExecutions;
  }
}

interface StrategyEffectiveness {
  overall: number;
  byErrorType: Map<ErrorType, number>;
  totalExecutions: number;
  successfulExecutions: number;
}

interface ContextPattern {
  strategyId: string;
  contextKey: string;
  successRate: number;
  executionCount: number;
}