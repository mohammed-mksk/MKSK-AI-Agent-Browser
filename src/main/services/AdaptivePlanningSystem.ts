import {
  ActionPlan,
  PlannedAction,
  PlanningContext,
  ContingencyPlan,
  TriggerCondition,
  PlanValidation,
  ValidationIssue
} from '../interfaces/ITaskPlanner.js';
import { AIProvider } from './ai/AIProvider.js';
import { MemorySystem } from './MemorySystem.js';
import { Logger } from './Logger.js';
import { AutomationAction, InteractionPattern, TaskContext } from '../../shared/types.js';

export enum AdaptationTrigger {
  CONTEXT_CHANGE = 'context_change',
  ELEMENT_UNAVAILABLE = 'element_unavailable',
  PERFORMANCE_CONSTRAINT = 'performance_constraint',
  TIMEOUT = 'timeout',
  USER_INTERVENTION = 'user_intervention'
}

export enum AdaptationStrategy {
  MODIFY_STEPS = 'modify_steps',
  ADD_WAIT_STEP = 'add_wait_step',
  INCREASE_TIMEOUTS = 'increase_timeouts',
  CHANGE_SELECTORS = 'change_selectors',
  REORDER_STEPS = 'reorder_steps'
}

export interface PlanAdaptationResult {
  adaptationMade: boolean;
  trigger: AdaptationTrigger;
  strategy: AdaptationStrategy;
  modifiedPlan: ActionPlan;
  reasoning: string;
  confidence: number;
  executionTime: number;
}

export interface PlanOptimizationResult {
  optimizations: Array<{
    type: string;
    description: string;
    affectedSteps: string[];
    estimatedTimeReduction?: number;
    estimatedResourceReduction?: number;
  }>;
  optimizedPlan: ActionPlan;
  estimatedImprovement: number;
}

export interface AdaptationStatistics {
  totalAdaptations: number;
  averageExecutionTime: number;
  successRate: number;
  commonTriggers: Array<{ trigger: AdaptationTrigger; count: number }>;
}

export interface AdaptationTriggerConfig {
  id: string;
  type: 'context_change' | 'failure' | 'timeout' | 'user_intervention' | 'performance_degradation';
  condition: string;
  threshold: number;
  priority: 'low' | 'medium' | 'high' | 'critical';
  adaptationStrategy: AdaptationStrategyConfig;
}

export interface AdaptationStrategyConfig {
  name: string;
  description: string;
  actions: AdaptationAction[];
  confidence: number;
  expectedImprovement: number;
}

export interface AdaptationAction {
  type: 'modify_step' | 'add_step' | 'remove_step' | 'reorder_steps' | 'change_timeout' | 'add_fallback';
  target: string; // Step ID or plan section
  parameters: Record<string, any>;
  reasoning: string;
}

export interface ContextMonitor {
  id: string;
  type: 'page_state' | 'element_availability' | 'performance' | 'error_rate' | 'user_behavior';
  threshold: number;
  checkInterval: number;
  isActive: boolean;
  lastCheck: Date;
  currentValue: number;
}

export interface PlanOptimization {
  type: 'performance' | 'reliability' | 'resource_usage' | 'user_experience';
  description: string;
  impact: number;
  implementation: OptimizationStep[];
  prerequisites: string[];
}

export interface OptimizationStep {
  action: string;
  parameters: Record<string, any>;
  expectedBenefit: number;
  riskLevel: 'low' | 'medium' | 'high';
}

export class AdaptivePlanningSystem {
  private aiProvider: AIProvider;
  private memorySystem: MemorySystem;
  private logger: Logger;
  private adaptationTriggers: Map<string, AdaptationTriggerConfig> = new Map();
  private contextMonitors: Map<string, ContextMonitor> = new Map();
  private adaptationHistory: PlanAdaptationResult[] = [];
  private adaptationStats: AdaptationStatistics = {
    totalAdaptations: 0,
    averageExecutionTime: 0,
    successRate: 1.0,
    commonTriggers: []
  };

  constructor(aiProvider: AIProvider, memorySystem: MemorySystem) {
    this.aiProvider = aiProvider;
    this.memorySystem = memorySystem;
    this.logger = new Logger();
    this.initializeDefaultTriggers();
    this.initializeContextMonitors();
  }

  async adaptPlan(plan: ActionPlan, context: PlanningContext): Promise<PlanAdaptationResult> {
    const startTime = Date.now();
    
    try {
      this.logger.info(`Adapting plan ${plan.id} to current context`);
      
      const prompt = this.createAdaptationPrompt(plan, context);
      const response = await this.aiProvider.generateCompletion(prompt);
      
      const adaptationData = JSON.parse(response);
      
      let modifiedPlan = plan;
      let adaptationMade = false;
      let trigger = AdaptationTrigger.CONTEXT_CHANGE;
      let strategy = AdaptationStrategy.MODIFY_STEPS;
      
      if (adaptationData.adaptationNeeded) {
        adaptationMade = true;
        trigger = adaptationData.trigger || AdaptationTrigger.CONTEXT_CHANGE;
        strategy = adaptationData.strategy || AdaptationStrategy.MODIFY_STEPS;
        
        // Apply modifications
        modifiedPlan = await this.applyModifications(plan, adaptationData.modifications || []);
      }
      
      const executionTime = Date.now() - startTime;
      
      const result: PlanAdaptationResult = {
        adaptationMade,
        trigger,
        strategy,
        modifiedPlan,
        reasoning: adaptationData.reasoning || 'Plan adapted based on context',
        confidence: adaptationData.confidence || 0.8,
        executionTime
      };
      
      // Update statistics
      this.updateAdaptationStatistics(result);
      
      return result;
    } catch (error) {
      this.logger.error('Failed to adapt plan:', error);
      return {
        adaptationMade: false,
        trigger: AdaptationTrigger.CONTEXT_CHANGE,
        strategy: AdaptationStrategy.MODIFY_STEPS,
        modifiedPlan: plan,
        reasoning: 'Adaptation failed due to error',
        confidence: 0.5,
        executionTime: Date.now() - startTime
      };
    }
  }

  async generateContingencyPlans(plan: ActionPlan, context: PlanningContext): Promise<ContingencyPlan[]> {
    try {
      this.logger.info(`Generating contingency plans for ${plan.id}`);
      
      const prompt = this.createContingencyGenerationPrompt(plan, context);
      const response = await this.aiProvider.generateCompletion(prompt);
      
      const contingencyData = JSON.parse(response);
      const contingencies: ContingencyPlan[] = [];

      for (const contingency of contingencyData.contingencies || []) {
        const contingencyPlan: ContingencyPlan = {
          condition: contingency.triggerCondition || 'Unknown condition',
          actions: await this.createPlannedActions(contingency.alternativeSteps || []),
          reasoning: contingency.reasoning || 'Generated contingency plan',
          triggerConditions: contingency.triggerConditions?.map((tc: any) => ({
            type: tc.type || 'error',
            condition: tc.condition || '',
            threshold: tc.threshold || 1
          })) || []
        };
        
        contingencies.push(contingencyPlan);
      }

      // Sort by estimated success rate
      contingencies.sort((a, b) => {
        const aRate = (contingency: any) => contingency.estimatedSuccessRate || 0.5;
        const bRate = (contingency: any) => contingency.estimatedSuccessRate || 0.5;
        return bRate(contingencyData.contingencies?.find((c: any) => c.id === 'contingency_2')) - 
               aRate(contingencyData.contingencies?.find((c: any) => c.id === 'contingency_1'));
      });

      this.logger.info(`Generated ${contingencies.length} contingency plans`);
      return contingencies;
    } catch (error) {
      this.logger.error('Failed to generate contingency plans:', error);
      return [];
    }
  }

  async validatePlan(plan: ActionPlan, context: PlanningContext): Promise<PlanValidation> {
    try {
      this.logger.info(`Validating plan ${plan.id}`);
      
      const prompt = this.createValidationPrompt(plan, context);
      const response = await this.aiProvider.generateCompletion(prompt);
      
      const validation = JSON.parse(response);
      
      const result: PlanValidation = {
        isValid: validation.isValid !== false,
        confidence: validation.confidence || 0.7,
        issues: validation.issues?.map((issue: any) => ({
          type: issue.type || 'warning',
          severity: issue.severity || 'medium',
          message: issue.description || issue.message || 'Validation issue',
          affectedSteps: issue.affectedSteps || [],
          suggestedFix: issue.suggestedFix
        })) || [],
        recommendations: validation.recommendations || [],
        estimatedSuccessRate: validation.estimatedSuccessRate || 0.7
      };

      this.logger.info(`Plan validation completed: ${result.isValid ? 'valid' : 'invalid'} with ${result.issues.length} issues`);
      return result;
    } catch (error) {
      this.logger.error('Failed to validate plan:', error);
      return {
        isValid: true,
        confidence: 0.5,
        issues: [],
        recommendations: ['Validation failed - proceed with caution'],
        estimatedSuccessRate: 0.5
      };
    }
  }

  async optimizePlan(plan: ActionPlan, context: PlanningContext): Promise<PlanOptimizationResult> {
    try {
      this.logger.info(`Optimizing plan ${plan.id}`);
      
      const prompt = this.createOptimizationPrompt(plan);
      const response = await this.aiProvider.generateCompletion(prompt);
      
      const optimization = JSON.parse(response);
      
      const optimizations = optimization.optimizations?.map((opt: any) => ({
        type: opt.type || 'performance',
        description: opt.description || 'Performance optimization',
        affectedSteps: opt.affectedSteps || [],
        estimatedTimeReduction: opt.estimatedTimeReduction,
        estimatedResourceReduction: opt.estimatedResourceReduction
      })) || [];
      
      const optimizedPlan = optimization.optimizedPlan || plan;
      const estimatedImprovement = optimization.estimatedImprovement || 
        optimizations.reduce((sum, opt) => sum + (opt.estimatedTimeReduction || 0), 0);
      
      return {
        optimizations,
        optimizedPlan,
        estimatedImprovement
      };
    } catch (error) {
      this.logger.error('Failed to optimize plan:', error);
      return {
        optimizations: [],
        optimizedPlan: plan,
        estimatedImprovement: 0
      };
    }
  }

  async storeAdaptationPattern(result: PlanAdaptationResult, context: PlanningContext): Promise<void> {
    try {
      const pattern: InteractionPattern = {
        id: `adaptation_${Date.now()}`,
        sitePattern: new URL(context.currentUrl).hostname,
        taskType: 'plan_adaptation',
        successfulActions: [],
        contextConditions: [],
        reliability: result.confidence,
        lastUsed: new Date(),
        usageCount: 1
      };
      
      await this.memorySystem.storeSuccessfulPattern(pattern);
    } catch (error) {
      this.logger.error('Failed to store adaptation pattern:', error);
    }
  }

  async getRelevantAdaptationPatterns(context: PlanningContext): Promise<InteractionPattern[]> {
    try {
      const taskContext: TaskContext = {
        taskType: 'plan_adaptation',
        currentUrl: context.currentUrl,
        pageState: context.pageState,
        userObjective: 'plan_adaptation'
      };
      
      return await this.memorySystem.retrieveRelevantPatterns(taskContext);
    } catch (error) {
      this.logger.error('Failed to retrieve adaptation patterns:', error);
      return [];
    }
  }

  getAdaptationStatistics(): AdaptationStatistics {
    return { ...this.adaptationStats };
  }

  async adaptPlanToContext(plan: ActionPlan, context: PlanningContext): Promise<PlanAdaptationResult> {
    try {
      this.logger.info(`Adapting plan ${plan.id} to current context`);
      
      // Analyze context changes
      const contextAnalysis = await this.analyzeContextChanges(plan, context);
      
      // Determine if adaptation is needed
      const adaptationNeeded = await this.shouldAdaptPlan(plan, context, contextAnalysis);
      
      if (!adaptationNeeded.needed) {
        return {
          originalPlan: plan,
          adaptedPlan: plan,
          adaptationReason: 'No adaptation needed',
          adaptationsApplied: [],
          confidence: 1.0,
          expectedImprovement: 0,
          validationResult: { isValid: true, confidence: 1.0, issues: [], recommendations: [], estimatedSuccessRate: plan.confidence }
        };
      }

      // Generate adaptation strategy
      const adaptationStrategy = await this.generateAdaptationStrategy(plan, context, adaptationNeeded.reasons);
      
      // Apply adaptations
      const adaptedPlan = await this.applyAdaptations(plan, adaptationStrategy);
      
      // Validate adapted plan
      const validationResult = await this.validateAdaptedPlan(adaptedPlan, context);
      
      const result: PlanAdaptationResult = {
        originalPlan: plan,
        adaptedPlan,
        adaptationReason: adaptationNeeded.reasons.join('; '),
        adaptationsApplied: adaptationStrategy.actions,
        confidence: adaptationStrategy.confidence,
        expectedImprovement: adaptationStrategy.expectedImprovement,
        validationResult
      };

      // Store adaptation in history
      this.adaptationHistory.push(result);
      
      // Learn from adaptation
      await this.learnFromAdaptation(result);
      
      this.logger.info(`Plan adaptation completed with ${adaptationStrategy.actions.length} changes`);
      return result;
    } catch (error) {
      this.logger.error('Failed to adapt plan to context:', error);
      throw error;
    }
  }

  async generateContingencyPlans(plan: ActionPlan, context: PlanningContext): Promise<ContingencyPlan[]> {
    try {
      this.logger.info(`Generating contingency plans for ${plan.id}`);
      
      const prompt = this.createContingencyGenerationPrompt(plan, context);
      const response = await this.aiProvider.generateCompletion(prompt, {
        temperature: 0.2,
        maxTokens: 1200
      });

      const contingencyData = JSON.parse(response);
      const contingencies: ContingencyPlan[] = [];

      for (const contingency of contingencyData.contingencies || []) {
        const contingencyPlan: ContingencyPlan = {
          condition: contingency.condition || 'Unknown condition',
          actions: await this.createPlannedActions(contingency.actions || []),
          reasoning: contingency.reasoning || 'Generated contingency plan',
          triggerConditions: contingency.triggerConditions?.map((tc: any) => ({
            type: tc.type || 'error',
            condition: tc.condition || '',
            threshold: tc.threshold || 1
          })) || []
        };
        
        contingencies.push(contingencyPlan);
      }

      this.logger.info(`Generated ${contingencies.length} contingency plans`);
      return contingencies;
    } catch (error) {
      this.logger.error('Failed to generate contingency plans:', error);
      return [];
    }
  }

  async optimizePlanPerformance(plan: ActionPlan): Promise<ActionPlan> {
    try {
      this.logger.info(`Optimizing performance for plan ${plan.id}`);
      
      const optimizations = await this.identifyOptimizations(plan);
      
      if (optimizations.length === 0) {
        return plan;
      }

      const optimizedPlan = await this.applyOptimizations(plan, optimizations);
      
      this.logger.info(`Applied ${optimizations.length} optimizations to plan`);
      return optimizedPlan;
    } catch (error) {
      this.logger.error('Failed to optimize plan performance:', error);
      return plan;
    }
  }

  async validatePlanFeasibility(plan: ActionPlan, context: PlanningContext): Promise<PlanValidation> {
    try {
      this.logger.info(`Validating feasibility of plan ${plan.id}`);
      
      const prompt = this.createValidationPrompt(plan, context);
      const response = await this.aiProvider.generateCompletion(prompt, {
        temperature: 0.1,
        maxTokens: 800
      });

      const validation = JSON.parse(response);
      
      const result: PlanValidation = {
        isValid: validation.isValid !== false,
        confidence: validation.confidence || 0.7,
        issues: validation.issues?.map((issue: any) => ({
          type: issue.type || 'warning',
          severity: issue.severity || 'medium',
          message: issue.message || 'Validation issue',
          affectedSteps: issue.affectedSteps || [],
          suggestedFix: issue.suggestedFix
        })) || [],
        recommendations: validation.recommendations || [],
        estimatedSuccessRate: validation.estimatedSuccessRate || 0.7
      };

      this.logger.info(`Plan validation completed: ${result.isValid ? 'valid' : 'invalid'} with ${result.issues.length} issues`);
      return result;
    } catch (error) {
      this.logger.error('Failed to validate plan feasibility:', error);
      return {
        isValid: true,
        confidence: 0.5,
        issues: [],
        recommendations: ['Validation failed - proceed with caution'],
        estimatedSuccessRate: 0.5
      };
    }
  }

  async monitorPlanExecution(plan: ActionPlan, context: PlanningContext): Promise<void> {
    try {
      this.logger.info(`Starting execution monitoring for plan ${plan.id}`);
      
      // Update context monitors
      for (const [id, monitor] of this.contextMonitors) {
        if (monitor.isActive) {
          await this.updateContextMonitor(monitor, context);
        }
      }

      // Check adaptation triggers
      for (const [id, trigger] of this.adaptationTriggers) {
        const shouldTrigger = await this.evaluateAdaptationTrigger(trigger, context);
        if (shouldTrigger) {
          this.logger.info(`Adaptation trigger activated: ${trigger.type}`);
          // Trigger adaptation would be handled by the calling system
        }
      }
    } catch (error) {
      this.logger.error('Failed to monitor plan execution:', error);
    }
  }

  // Private helper methods
  private async analyzeContextChanges(plan: ActionPlan, context: PlanningContext): Promise<any> {
    try {
      const prompt = this.createContextAnalysisPrompt(plan, context);
      const response = await this.aiProvider.generateCompletion(prompt, {
        temperature: 0.1,
        maxTokens: 600
      });

      return JSON.parse(response);
    } catch (error) {
      this.logger.error('Failed to analyze context changes:', error);
      return { changes: [], significance: 'low' };
    }
  }

  private async shouldAdaptPlan(plan: ActionPlan, context: PlanningContext, analysis: any): Promise<{ needed: boolean; reasons: string[] }> {
    try {
      // Check if significant context changes occurred
      const significantChanges = analysis.changes?.filter((change: any) => change.significance === 'high') || [];
      
      // Check if current plan is still feasible
      const validation = await this.validatePlanFeasibility(plan, context);
      const criticalIssues = validation.issues.filter(issue => issue.severity === 'critical' || issue.severity === 'high');
      
      const reasons: string[] = [];
      
      if (significantChanges.length > 0) {
        reasons.push(`Significant context changes detected: ${significantChanges.map((c: any) => c.type).join(', ')}`);
      }
      
      if (criticalIssues.length > 0) {
        reasons.push(`Critical validation issues found: ${criticalIssues.map(i => i.message).join(', ')}`);
      }
      
      if (context.timeRemaining < plan.estimatedDuration * 0.5) {
        reasons.push('Insufficient time remaining for current plan');
      }
      
      return {
        needed: reasons.length > 0,
        reasons
      };
    } catch (error) {
      this.logger.error('Failed to determine if adaptation is needed:', error);
      return { needed: false, reasons: [] };
    }
  }

  private async generateAdaptationStrategy(plan: ActionPlan, context: PlanningContext, reasons: string[]): Promise<AdaptationStrategy> {
    try {
      const prompt = this.createAdaptationStrategyPrompt(plan, context, reasons);
      const response = await this.aiProvider.generateCompletion(prompt, {
        temperature: 0.2,
        maxTokens: 1000
      });

      const strategy = JSON.parse(response);
      
      return {
        name: strategy.name || 'Context Adaptation',
        description: strategy.description || 'Adapt plan to current context',
        actions: strategy.actions?.map((action: any) => ({
          type: action.type || 'modify_step',
          target: action.target || '',
          parameters: action.parameters || {},
          reasoning: action.reasoning || 'Adaptation action'
        })) || [],
        confidence: strategy.confidence || 0.7,
        expectedImprovement: strategy.expectedImprovement || 0.1
      };
    } catch (error) {
      this.logger.error('Failed to generate adaptation strategy:', error);
      return {
        name: 'Fallback Adaptation',
        description: 'Basic adaptation due to error',
        actions: [],
        confidence: 0.5,
        expectedImprovement: 0.05
      };
    }
  }

  private async applyAdaptations(plan: ActionPlan, strategy: AdaptationStrategy): Promise<ActionPlan> {
    try {
      let adaptedPlan = { ...plan, id: `adapted_${Date.now()}` };
      
      for (const action of strategy.actions) {
        switch (action.type) {
          case 'modify_step':
            adaptedPlan = await this.modifyPlanStep(adaptedPlan, action);
            break;
          case 'add_step':
            adaptedPlan = await this.addPlanStep(adaptedPlan, action);
            break;
          case 'remove_step':
            adaptedPlan = await this.removePlanStep(adaptedPlan, action);
            break;
          case 'reorder_steps':
            adaptedPlan = await this.reorderPlanSteps(adaptedPlan, action);
            break;
          case 'change_timeout':
            adaptedPlan = await this.changeStepTimeout(adaptedPlan, action);
            break;
          case 'add_fallback':
            adaptedPlan = await this.addStepFallback(adaptedPlan, action);
            break;
        }
      }
      
      // Update plan confidence based on adaptations
      adaptedPlan.confidence = Math.max(0.1, plan.confidence - 0.1 + strategy.expectedImprovement);
      
      return adaptedPlan;
    } catch (error) {
      this.logger.error('Failed to apply adaptations:', error);
      return plan;
    }
  }

  private async validateAdaptedPlan(plan: ActionPlan, context: PlanningContext): Promise<PlanValidation> {
    return await this.validatePlanFeasibility(plan, context);
  }

  private async learnFromAdaptation(result: PlanAdaptationResult): Promise<void> {
    try {
      // Store adaptation learning in memory system
      const learning = {
        type: 'adaptation' as const,
        context: `Plan adaptation: ${result.adaptationReason}`,
        insight: `Applied ${result.adaptationsApplied.length} adaptations with ${result.confidence} confidence`,
        confidence: result.confidence,
        applicability: [result.originalPlan.objective],
        timestamp: new Date()
      };

      await this.memorySystem.updateMemory(learning);
    } catch (error) {
      this.logger.error('Failed to learn from adaptation:', error);
    }
  }

  private async identifyOptimizations(plan: ActionPlan): Promise<PlanOptimization[]> {
    try {
      const prompt = this.createOptimizationPrompt(plan);
      const response = await this.aiProvider.generateCompletion(prompt, {
        temperature: 0.2,
        maxTokens: 800
      });

      const optimization = JSON.parse(response);
      
      return optimization.optimizations?.map((opt: any) => ({
        type: opt.type || 'performance',
        description: opt.description || 'Performance optimization',
        impact: opt.impact || 0.1,
        implementation: opt.implementation || [],
        prerequisites: opt.prerequisites || []
      })) || [];
    } catch (error) {
      this.logger.error('Failed to identify optimizations:', error);
      return [];
    }
  }

  private async applyOptimizations(plan: ActionPlan, optimizations: PlanOptimization[]): Promise<ActionPlan> {
    let optimizedPlan = { ...plan, id: `optimized_${Date.now()}` };
    
    for (const optimization of optimizations) {
      for (const step of optimization.implementation) {
        // Apply optimization step
        // This would involve modifying the plan based on the optimization
      }
    }
    
    return optimizedPlan;
  }

  private async createPlannedActions(actionData: any[]): Promise<PlannedAction[]> {
    const actions: PlannedAction[] = [];
    
    for (let i = 0; i < actionData.length; i++) {
      const data = actionData[i];
      const action: PlannedAction = {
        id: data.id || `action_${i}`,
        action: {
          type: data.action?.type || 'navigate',
          target: data.action?.target || { css: 'body' },
          value: data.action?.value || '',
          timeout: data.action?.timeout || 10000,
          retryCount: data.action?.retryCount || 3
        } as AutomationAction,
        reasoning: data.reasoning || 'Generated action',
        dependencies: data.dependencies || [],
        successCriteria: data.successCriteria || [],
        fallbacks: data.fallbacks || [],
        priority: data.priority || 1,
        estimatedDuration: data.estimatedDuration || 5000,
        retryStrategy: {
          maxRetries: data.retryStrategy?.maxRetries || 3,
          backoffMs: data.retryStrategy?.backoffMs || 1000,
          conditions: data.retryStrategy?.conditions || [],
          adaptiveRetry: data.retryStrategy?.adaptiveRetry || true
        }
      };
      
      actions.push(action);
    }
    
    return actions;
  }

  private async modifyPlanStep(plan: ActionPlan, action: AdaptationAction): Promise<ActionPlan> {
    const stepIndex = plan.steps.findIndex(step => step.id === action.target);
    if (stepIndex !== -1) {
      const modifiedStep = { ...plan.steps[stepIndex] };
      
      // Apply modifications based on parameters
      if (action.parameters.timeout) {
        modifiedStep.action.timeout = action.parameters.timeout;
      }
      if (action.parameters.retryCount) {
        modifiedStep.action.retryCount = action.parameters.retryCount;
      }
      
      plan.steps[stepIndex] = modifiedStep;
    }
    
    return plan;
  }

  private async addPlanStep(plan: ActionPlan, action: AdaptationAction): Promise<ActionPlan> {
    const newStep: PlannedAction = {
      id: `added_${Date.now()}`,
      action: action.parameters.action || {
        type: 'wait',
        target: {},
        value: '',
        timeout: 5000,
        retryCount: 1
      } as AutomationAction,
      reasoning: action.reasoning,
      dependencies: [],
      successCriteria: [],
      fallbacks: [],
      priority: 1,
      estimatedDuration: 5000,
      retryStrategy: {
        maxRetries: 3,
        backoffMs: 1000,
        conditions: [],
        adaptiveRetry: true
      }
    };
    
    const insertIndex = action.parameters.insertIndex || plan.steps.length;
    plan.steps.splice(insertIndex, 0, newStep);
    
    return plan;
  }

  private async removePlanStep(plan: ActionPlan, action: AdaptationAction): Promise<ActionPlan> {
    const stepIndex = plan.steps.findIndex(step => step.id === action.target);
    if (stepIndex !== -1) {
      plan.steps.splice(stepIndex, 1);
    }
    
    return plan;
  }

  private async reorderPlanSteps(plan: ActionPlan, action: AdaptationAction): Promise<ActionPlan> {
    if (action.parameters.newOrder && Array.isArray(action.parameters.newOrder)) {
      const reorderedSteps: PlannedAction[] = [];
      
      for (const stepId of action.parameters.newOrder) {
        const step = plan.steps.find(s => s.id === stepId);
        if (step) {
          reorderedSteps.push(step);
        }
      }
      
      plan.steps = reorderedSteps;
    }
    
    return plan;
  }

  private async changeStepTimeout(plan: ActionPlan, action: AdaptationAction): Promise<ActionPlan> {
    const stepIndex = plan.steps.findIndex(step => step.id === action.target);
    if (stepIndex !== -1 && action.parameters.timeout) {
      plan.steps[stepIndex].action.timeout = action.parameters.timeout;
    }
    
    return plan;
  }

  private async addStepFallback(plan: ActionPlan, action: AdaptationAction): Promise<ActionPlan> {
    const stepIndex = plan.steps.findIndex(step => step.id === action.target);
    if (stepIndex !== -1 && action.parameters.fallback) {
      plan.steps[stepIndex].fallbacks.push(action.parameters.fallback);
    }
    
    return plan;
  }

  private async updateContextMonitor(monitor: ContextMonitor, context: PlanningContext): Promise<void> {
    // Update monitor based on current context
    monitor.lastCheck = new Date();
    
    switch (monitor.type) {
      case 'page_state':
        monitor.currentValue = context.pageState.loaded ? 1 : 0;
        break;
      case 'element_availability':
        monitor.currentValue = context.availableElements.length;
        break;
      case 'performance':
        monitor.currentValue = context.pageState.performance.loadTime;
        break;
    }
  }

  private async evaluateAdaptationTrigger(trigger: AdaptationTriggerConfig, context: PlanningContext): Promise<boolean> {
    // Evaluate if trigger condition is met
    switch (trigger.type) {
      case 'context_change':
        return context.timeRemaining < trigger.threshold;
      case 'performance_degradation':
        return context.pageState.performance.loadTime > trigger.threshold;
      default:
        return false;
    }
  }

  private async applyModifications(plan: ActionPlan, modifications: any[]): Promise<ActionPlan> {
    let modifiedPlan = { ...plan };
    
    for (const mod of modifications) {
      if (mod.stepId && mod.newAction) {
        const stepIndex = modifiedPlan.steps.findIndex(step => step.id === mod.stepId);
        if (stepIndex !== -1) {
          modifiedPlan.steps[stepIndex] = {
            ...modifiedPlan.steps[stepIndex],
            action: { ...mod.newAction, id: mod.newAction.id || `modified_${Date.now()}` }
          };
        }
      }
      
      if (mod.stepId && mod.timeoutIncrease) {
        const stepIndex = modifiedPlan.steps.findIndex(step => step.id === mod.stepId);
        if (stepIndex !== -1) {
          modifiedPlan.steps[stepIndex].action.timeout += mod.timeoutIncrease;
        }
      }
      
      if (mod.insertBefore && mod.newStep) {
        const insertIndex = modifiedPlan.steps.findIndex(step => step.id === mod.insertBefore);
        if (insertIndex !== -1) {
          modifiedPlan.steps.splice(insertIndex, 0, {
            ...mod.newStep,
            action: { ...mod.newStep.action, id: mod.newStep.action.id || `inserted_${Date.now()}` }
          });
        }
      }
    }
    
    return modifiedPlan;
  }

  private updateAdaptationStatistics(result: PlanAdaptationResult): void {
    this.adaptationStats.totalAdaptations++;
    
    // Update average execution time
    const totalTime = this.adaptationStats.averageExecutionTime * (this.adaptationStats.totalAdaptations - 1) + result.executionTime;
    this.adaptationStats.averageExecutionTime = totalTime / this.adaptationStats.totalAdaptations;
    
    // Update success rate (assuming adaptation was successful if confidence > 0.5)
    const successCount = this.adaptationHistory.filter(h => h.confidence > 0.5).length + (result.confidence > 0.5 ? 1 : 0);
    this.adaptationStats.successRate = successCount / this.adaptationStats.totalAdaptations;
    
    // Update common triggers
    const existingTrigger = this.adaptationStats.commonTriggers.find(t => t.trigger === result.trigger);
    if (existingTrigger) {
      existingTrigger.count++;
    } else {
      this.adaptationStats.commonTriggers.push({ trigger: result.trigger, count: 1 });
    }
    
    // Sort triggers by count
    this.adaptationStats.commonTriggers.sort((a, b) => b.count - a.count);
    
    this.adaptationHistory.push(result);
  }

  private createAdaptationPrompt(plan: ActionPlan, context: PlanningContext): string {
    return `
Analyze if this automation plan needs adaptation based on the current context.

Plan Details:
- Objective: ${plan.objective}
- Steps: ${plan.steps.length}
- Estimated Duration: ${plan.estimatedDuration}ms

Current Context:
- URL: ${context.currentUrl}
- Page Loaded: ${context.pageState.loaded}
- Available Elements: ${context.availableElements.length}
- Time Remaining: ${context.timeRemaining}ms
- Page Errors: ${context.pageState.errors?.length || 0}

Respond in JSON format:
{
  "adaptationNeeded": boolean,
  "trigger": "context_change|element_unavailable|performance_constraint",
  "strategy": "modify_steps|add_wait_step|increase_timeouts",
  "reasoning": "Explanation of why adaptation is needed",
  "confidence": 0.8,
  "modifications": [
    {
      "stepId": "step_2",
      "newAction": {
        "id": "action_2_modified",
        "type": "click",
        "target": { "css": ".alternative-button" },
        "value": "",
        "timeout": 5000,
        "retryCount": 2
      },
      "reasoning": "Original button not found, using alternative selector"
    }
  ]
}`;
  }

  private initializeDefaultTriggers(): void {
    const defaultTriggers: AdaptationTriggerConfig[] = [
      {
        id: 'time_pressure',
        type: 'context_change',
        condition: 'time_remaining < estimated_duration * 0.5',
        threshold: 0.5,
        priority: 'high',
        adaptationStrategy: {
          name: 'Time Optimization',
          description: 'Optimize plan for faster execution',
          actions: [],
          confidence: 0.8,
          expectedImprovement: 0.2
        }
      },
      {
        id: 'performance_degradation',
        type: 'performance_degradation',
        condition: 'page_load_time > 10000',
        threshold: 10000,
        priority: 'medium',
        adaptationStrategy: {
          name: 'Performance Recovery',
          description: 'Adapt to slow page performance',
          actions: [],
          confidence: 0.7,
          expectedImprovement: 0.15
        }
      }
    ];

    defaultTriggers.forEach(trigger => {
      this.adaptationTriggers.set(trigger.id, trigger);
    });
  }

  private initializeContextMonitors(): void {
    const defaultMonitors: ContextMonitor[] = [
      {
        id: 'page_state_monitor',
        type: 'page_state',
        threshold: 1,
        checkInterval: 1000,
        isActive: true,
        lastCheck: new Date(),
        currentValue: 0
      },
      {
        id: 'element_availability_monitor',
        type: 'element_availability',
        threshold: 5,
        checkInterval: 2000,
        isActive: true,
        lastCheck: new Date(),
        currentValue: 0
      }
    ];

    defaultMonitors.forEach(monitor => {
      this.contextMonitors.set(monitor.id, monitor);
    });
  }

  // Prompt creation methods
  private createContextAnalysisPrompt(plan: ActionPlan, context: PlanningContext): string {
    return `
Analyze context changes that might affect plan execution.

Original Plan:
- Objective: ${plan.objective}
- Steps: ${plan.steps.length}
- Estimated Duration: ${plan.estimatedDuration}ms

Current Context:
- URL: ${context.currentUrl}
- Page Loaded: ${context.pageState.loaded}
- Time Remaining: ${context.timeRemaining}ms
- Available Elements: ${context.availableElements.length}

Analyze changes in JSON format:
{
  "changes": [
    {
      "type": "time_constraint",
      "description": "Time remaining is less than estimated duration",
      "significance": "high",
      "impact": 0.8
    }
  ],
  "significance": "high|medium|low"
}`;
  }

  private createAdaptationStrategyPrompt(plan: ActionPlan, context: PlanningContext, reasons: string[]): string {
    return `
Generate adaptation strategy for plan based on context changes.

Plan: ${plan.objective}
Context Issues: ${reasons.join(', ')}
Time Remaining: ${context.timeRemaining}ms

Generate strategy in JSON format:
{
  "name": "Time Optimization Strategy",
  "description": "Adapt plan for time constraints",
  "actions": [
    {
      "type": "modify_step|add_step|remove_step|reorder_steps|change_timeout|add_fallback",
      "target": "step_id",
      "parameters": {"timeout": 5000},
      "reasoning": "Reduce timeout to save time"
    }
  ],
  "confidence": 0.8,
  "expectedImprovement": 0.2
}`;
  }

  private createContingencyGenerationPrompt(plan: ActionPlan, context: PlanningContext): string {
    return `
Generate contingency plans for potential failures.

Plan: ${plan.objective}
Context: ${context.currentUrl}

Generate contingencies in JSON format:
{
  "contingencies": [
    {
      "condition": "Element not found",
      "actions": [
        {
          "id": "fallback_1",
          "action": {
            "type": "wait",
            "target": {},
            "value": "",
            "timeout": 5000,
            "retryCount": 1
          },
          "reasoning": "Wait for element to appear"
        }
      ],
      "reasoning": "Handle missing elements",
      "triggerConditions": [
        {
          "type": "error",
          "condition": "ElementNotFoundError",
          "threshold": 1
        }
      ]
    }
  ]
}`;
  }

  private createValidationPrompt(plan: ActionPlan, context: PlanningContext): string {
    return `
Validate plan feasibility in current context.

Plan: ${plan.objective} (${plan.steps.length} steps)
Context: ${context.currentUrl}
Time Available: ${context.timeRemaining}ms
Elements Available: ${context.availableElements.length}

Validate in JSON format:
{
  "isValid": true,
  "confidence": 0.8,
  "issues": [
    {
      "type": "warning|error",
      "severity": "low|medium|high|critical",
      "message": "Issue description",
      "affectedSteps": ["step_1"],
      "suggestedFix": "How to fix this issue"
    }
  ],
  "recommendations": ["Add more error handling"],
  "estimatedSuccessRate": 0.85
}`;
  }

  private createOptimizationPrompt(plan: ActionPlan): string {
    return `
Identify performance optimizations for this plan.

Plan: ${plan.objective}
Steps: ${plan.steps.length}
Duration: ${plan.estimatedDuration}ms

Identify optimizations in JSON format:
{
  "optimizations": [
    {
      "type": "performance|reliability|resource_usage",
      "description": "Combine sequential actions",
      "impact": 0.2,
      "implementation": [
        {
          "action": "merge_steps",
          "parameters": {"steps": ["step_1", "step_2"]},
          "expectedBenefit": 0.15,
          "riskLevel": "low"
        }
      ],
      "prerequisites": []
    }
  ]
}`;
  }
}