import {
  ITaskPlanner,
  TaskUnderstanding,
  TaskIntent,
  ActionPlan,
  PlannedAction,
  PlanningContext,
  MultiSiteStrategy,
  PendingAction,
  PrioritizedActions,
  PlanValidation,
  ContingencyPlan,
  TimeoutStrategy,
  DataRequirement,
  TimeConstraint,
  ResourceRequirement,
  SiteTask,
  CoordinationPlan,
  DataFlowPlan,
  MultiSiteFailureHandling,
  AggregationStrategy
} from '../interfaces/ITaskPlanner.js';
import { AIProvider } from './ai/AIProvider.js';
import { MemorySystem } from './MemorySystem.js';
import { ElementDiscoveryService } from './ElementDiscoveryService.js';
import { Logger } from './Logger.js';
import { AutomationAction } from '../../shared/types.js';

export class TaskPlanner implements ITaskPlanner {
  private aiProvider: AIProvider;
  private memorySystem: MemorySystem;
  private elementDiscovery: ElementDiscoveryService;
  private logger: Logger;

  constructor(
    aiProvider: AIProvider,
    memorySystem: MemorySystem,
    elementDiscovery: ElementDiscoveryService
  ) {
    this.aiProvider = aiProvider;
    this.memorySystem = memorySystem;
    this.elementDiscovery = elementDiscovery;
    this.logger = new Logger();
  }

  async parseNaturalLanguageTask(task: string): Promise<TaskUnderstanding> {
    try {
      this.logger.info(`Parsing natural language task: ${task}`);
      
      const prompt = this.createTaskParsingPrompt(task);
      const response = await this.aiProvider.generateCompletion(prompt, {
        temperature: 0.1,
        maxTokens: 1000
      });

      const parsed = JSON.parse(response);
      
      const understanding: TaskUnderstanding = {
        intent: {
          type: parsed.intent?.type || 'search',
          description: parsed.intent?.description || task,
          confidence: parsed.intent?.confidence || 0.7,
          subIntents: parsed.intent?.subIntents || []
        },
        objectives: parsed.objectives || [task],
        constraints: parsed.constraints || [],
        expectedOutcome: parsed.expectedOutcome || 'Complete the requested task',
        complexity: parsed.complexity || 'medium',
        estimatedSteps: parsed.estimatedSteps || 5,
        requiredSites: parsed.requiredSites || [],
        dataRequirements: parsed.dataRequirements || [],
        timeConstraints: parsed.timeConstraints || []
      };

      this.logger.info(`Task understanding completed: ${understanding.intent.type} with ${understanding.estimatedSteps} steps`);
      return understanding;
    } catch (error) {
      this.logger.error('Failed to parse natural language task:', error);
      return this.createFallbackTaskUnderstanding(task);
    }
  }

  async generateInitialPlan(understanding: TaskUnderstanding): Promise<ActionPlan> {
    try {
      this.logger.info(`Generating initial plan for: ${understanding.intent.type}`);
      
      // Get relevant patterns from memory
      const relevantPatterns = await this.memorySystem.retrieveRelevantPatterns({
        taskId: `task_${Date.now()}`,
        objective: understanding.intent.description,
        currentUrl: understanding.requiredSites[0] || 'https://www.google.com',
        pageType: understanding.intent.type,
        userIntent: understanding.intent.description,
        constraints: [],
        priority: 'medium'
      });

      const prompt = this.createPlanGenerationPrompt(understanding, relevantPatterns);
      const response = await this.aiProvider.generateCompletion(prompt, {
        temperature: 0.2,
        maxTokens: 1500
      });

      const planData = JSON.parse(response);
      
      const plan: ActionPlan = {
        id: `plan_${Date.now()}`,
        objective: understanding.intent.description,
        steps: await this.createPlannedActions(planData.steps || []),
        contingencies: planData.contingencies || [],
        successCriteria: planData.successCriteria || ['Task completed successfully'],
        timeoutStrategy: planData.timeoutStrategy || this.createDefaultTimeoutStrategy(),
        confidence: planData.confidence || 0.7,
        estimatedDuration: planData.estimatedDuration || 30000,
        resourceRequirements: planData.resourceRequirements || []
      };

      this.logger.info(`Generated plan with ${plan.steps.length} steps`);
      return plan;
    } catch (error) {
      this.logger.error('Failed to generate initial plan:', error);
      return this.createFallbackPlan(understanding);
    }
  }

  async adaptPlan(currentPlan: ActionPlan, newContext: PlanningContext): Promise<ActionPlan> {
    try {
      this.logger.info(`Adapting plan ${currentPlan.id} for new context`);
      
      const prompt = this.createPlanAdaptationPrompt(currentPlan, newContext);
      const response = await this.aiProvider.generateCompletion(prompt, {
        temperature: 0.2,
        maxTokens: 1200
      });

      const adaptation = JSON.parse(response);
      
      if (!adaptation.needsAdaptation) {
        return currentPlan;
      }

      const adaptedPlan: ActionPlan = {
        ...currentPlan,
        id: `adapted_${Date.now()}`,
        steps: await this.createPlannedActions(adaptation.adaptedSteps || currentPlan.steps),
        contingencies: adaptation.contingencies || currentPlan.contingencies,
        confidence: Math.max(0.1, currentPlan.confidence - 0.1), // Slightly lower confidence for adapted plans
        estimatedDuration: adaptation.estimatedDuration || currentPlan.estimatedDuration
      };

      this.logger.info(`Plan adapted with ${adaptedPlan.steps.length} steps`);
      return adaptedPlan;
    } catch (error) {
      this.logger.error('Failed to adapt plan:', error);
      return currentPlan; // Return original plan if adaptation fails
    }
  }

  async coordinateMultiSiteTasks(sites: string[], objective: string): Promise<MultiSiteStrategy> {
    try {
      this.logger.info(`Coordinating multi-site tasks across ${sites.length} sites`);
      
      const prompt = this.createMultiSiteCoordinationPrompt(sites, objective);
      const response = await this.aiProvider.generateCompletion(prompt, {
        temperature: 0.2,
        maxTokens: 1500
      });

      const coordination = JSON.parse(response);
      
      const strategy: MultiSiteStrategy = {
        id: `multisite_${Date.now()}`,
        objective: objective,
        sites: await this.createSiteTasks(sites, coordination.siteTasks || []),
        coordinationPlan: coordination.coordinationPlan || this.createDefaultCoordinationPlan(),
        dataFlow: coordination.dataFlow || this.createDefaultDataFlowPlan(),
        dataFlowPlan: coordination.dataFlow || this.createDefaultDataFlowPlan(),
        failureHandling: coordination.failureHandling || this.createDefaultFailureHandling(),
        aggregationStrategy: coordination.aggregationStrategy || this.createDefaultAggregationStrategy(),
        estimatedDuration: coordination.estimatedDuration || sites.length * 15000,
        successProbability: coordination.successProbability || 0.8
      };

      this.logger.info(`Multi-site strategy created for ${strategy.sites.length} sites`);
      return strategy;
    } catch (error) {
      this.logger.error('Failed to coordinate multi-site tasks:', error);
      return this.createFallbackMultiSiteStrategy(sites, objective);
    }
  }

  async prioritizeActions(actions: PendingAction[]): Promise<PrioritizedActions> {
    try {
      this.logger.info(`Prioritizing ${actions.length} actions`);
      
      const prompt = this.createActionPrioritizationPrompt(actions);
      const response = await this.aiProvider.generateCompletion(prompt, {
        temperature: 0.1,
        maxTokens: 800
      });

      const prioritization = JSON.parse(response);
      
      const prioritizedActions: PrioritizedActions = {
        actions: actions.map((action, index) => ({
          action,
          finalPriority: prioritization.priorities?.[index] || action.priority,
          reasoning: prioritization.reasoning?.[index] || 'Default prioritization'
        })),
        executionOrder: prioritization.executionOrder || actions.map((_, i) => i.toString()),
        reasoning: {
          factors: prioritization.factors || [],
          algorithm: prioritization.algorithm || 'weighted_scoring',
          confidence: prioritization.confidence || 0.7
        }
      };

      // Sort by final priority
      prioritizedActions.actions.sort((a, b) => b.finalPriority - a.finalPriority);

      this.logger.info(`Actions prioritized with algorithm: ${prioritizedActions.reasoning.algorithm}`);
      return prioritizedActions;
    } catch (error) {
      this.logger.error('Failed to prioritize actions:', error);
      return this.createFallbackPrioritization(actions);
    }
  }

  async validatePlan(plan: ActionPlan): Promise<PlanValidation> {
    try {
      this.logger.info(`Validating plan ${plan.id}`);
      
      const prompt = this.createPlanValidationPrompt(plan);
      const response = await this.aiProvider.generateCompletion(prompt, {
        temperature: 0.1,
        maxTokens: 600
      });

      const validation = JSON.parse(response);
      
      const planValidation: PlanValidation = {
        isValid: validation.isValid !== false,
        confidence: validation.confidence || 0.7,
        issues: validation.issues || [],
        recommendations: validation.recommendations || [],
        estimatedSuccessRate: validation.estimatedSuccessRate || 0.7
      };

      this.logger.info(`Plan validation completed: ${planValidation.isValid ? 'valid' : 'invalid'} with ${planValidation.issues.length} issues`);
      return planValidation;
    } catch (error) {
      this.logger.error('Failed to validate plan:', error);
      return {
        isValid: true,
        confidence: 0.5,
        issues: [],
        recommendations: ['Plan validation failed - proceed with caution'],
        estimatedSuccessRate: 0.5
      };
    }
  }

  async optimizePlan(plan: ActionPlan): Promise<ActionPlan> {
    try {
      this.logger.info(`Optimizing plan ${plan.id}`);
      
      const prompt = this.createPlanOptimizationPrompt(plan);
      const response = await this.aiProvider.generateCompletion(prompt, {
        temperature: 0.2,
        maxTokens: 1000
      });

      const optimization = JSON.parse(response);
      
      if (!optimization.canOptimize) {
        return plan;
      }

      const optimizedPlan: ActionPlan = {
        ...plan,
        id: `optimized_${Date.now()}`,
        steps: await this.createPlannedActions(optimization.optimizedSteps || plan.steps),
        estimatedDuration: optimization.estimatedDuration || plan.estimatedDuration,
        confidence: Math.min(1.0, plan.confidence + 0.1) // Slightly higher confidence for optimized plans
      };

      this.logger.info(`Plan optimized: duration ${plan.estimatedDuration}ms -> ${optimizedPlan.estimatedDuration}ms`);
      return optimizedPlan;
    } catch (error) {
      this.logger.error('Failed to optimize plan:', error);
      return plan; // Return original plan if optimization fails
    }
  }



  // Private helper methods
  private async createPlannedActions(stepData: any[]): Promise<PlannedAction[]> {
    const actions: PlannedAction[] = [];
    
    for (let i = 0; i < stepData.length; i++) {
      const step = stepData[i];
      const action: PlannedAction = {
        id: step.id || `step_${i}`,
        action: {
          type: step.action?.type || 'navigate',
          target: step.action?.target || { css: 'body' },
          value: step.action?.value || '',
          timeout: step.action?.timeout || 10000,
          retryCount: step.action?.retryCount || 3
        } as AutomationAction,
        reasoning: step.reasoning || 'Generated action',
        dependencies: step.dependencies || [],
        successCriteria: step.successCriteria || [],
        fallbacks: step.fallbacks || [],
        priority: step.priority || 1,
        estimatedDuration: step.estimatedDuration || 5000,
        retryStrategy: {
          maxRetries: step.retryStrategy?.maxRetries || 3,
          backoffMs: step.retryStrategy?.backoffMs || 1000,
          conditions: step.retryStrategy?.conditions || [],
          adaptiveRetry: step.retryStrategy?.adaptiveRetry || true
        }
      };
      
      actions.push(action);
    }
    
    return actions;
  }

  private async createSiteTasks(sites: string[], taskData: any[]): Promise<SiteTask[]> {
    const siteTasks: SiteTask[] = [];
    
    for (let i = 0; i < sites.length; i++) {
      const site = sites[i];
      const data = taskData[i] || {};
      
      const siteTask: SiteTask = {
        id: `site_${i}`,
        url: site,
        siteUrl: site,
        objective: data.objective || 'Extract data',
        actions: [],
        taskPlan: await this.createBasicPlan(data.objective || 'Extract data'),
        priority: data.priority || 1,
        dependencies: data.dependencies || [],
        expectedData: data.expectedData || [],
        dataRequirements: data.expectedData || [],
        timeConstraints: data.timeConstraints || [],
        fallbackSites: data.fallbackSites || []
      };
      
      siteTasks.push(siteTask);
    }
    
    return siteTasks;
  }

  private async createBasicPlan(objective: string): Promise<ActionPlan> {
    return {
      id: `basic_plan_${Date.now()}`,
      objective,
      steps: [],
      contingencies: [],
      successCriteria: [objective],
      timeoutStrategy: this.createDefaultTimeoutStrategy(),
      confidence: 0.7,
      estimatedDuration: 15000,
      resourceRequirements: []
    };
  }

  private createDefaultTimeoutStrategy(): TimeoutStrategy {
    return {
      maxDuration: 30000,
      checkpoints: [10000, 20000],
      fallbackActions: [],
      escalationStrategy: {
        levels: [],
        maxRetries: 3,
        backoffStrategy: 'exponential'
      }
    };
  }

  private createDefaultCoordinationPlan(): CoordinationPlan {
    return {
      executionOrder: {
        type: 'sequential',
        sequence: [],
        parallelGroups: [],
        dependencies: {}
      },
      parallelization: {
        maxConcurrent: 3,
        resourceLimits: [],
        loadBalancing: {
          type: 'round_robin',
          parameters: {}
        }
      },
      parallelizationStrategy: {
        maxConcurrent: 3,
        resourceLimits: [],
        loadBalancing: {
          type: 'round_robin',
          parameters: {}
        }
      },
      synchronizationPoints: [],
      resourceSharing: {
        sharedResources: [],
        accessControl: []
      }
    };
  }

  private createDefaultDataFlowPlan(): DataFlowPlan {
    return {
      dataExchanges: [],
      aggregationPoints: [],
      validationRules: []
    };
  }

  private createDefaultFailureHandling(): MultiSiteFailureHandling {
    return {
      failureStrategies: [],
      fallbackChain: {
        primary: '',
        fallbacks: []
      },
      recoveryPlan: {
        steps: [],
        timeout: 30000,
        successCriteria: []
      }
    };
  }

  private createDefaultAggregationStrategy(): AggregationStrategy {
    return {
      type: 'merge',
      parameters: {},
      conflictResolution: {
        strategy: 'highest_confidence',
        parameters: {}
      }
    };
  }

  private createFallbackTaskUnderstanding(task: string): TaskUnderstanding {
    return {
      intent: {
        type: 'search',
        description: task,
        confidence: 0.5,
        subIntents: []
      },
      objectives: [task],
      constraints: [],
      expectedOutcome: 'Complete the requested task',
      complexity: 'medium',
      estimatedSteps: 3,
      requiredSites: [],
      dataRequirements: [],
      timeConstraints: []
    };
  }

  private createFallbackPlan(understanding: TaskUnderstanding): ActionPlan {
    return {
      id: `fallback_plan_${Date.now()}`,
      objective: understanding.intent.description,
      steps: [],
      contingencies: [],
      successCriteria: ['Task completed'],
      timeoutStrategy: this.createDefaultTimeoutStrategy(),
      confidence: 0.5,
      estimatedDuration: 20000,
      resourceRequirements: []
    };
  }

  private createFallbackMultiSiteStrategy(sites: string[], objective: string): MultiSiteStrategy {
    return {
      id: `fallback_multisite_${Date.now()}`,
      objective,
      sites: sites.map((site, index) => ({
        id: `fallback_site_${index}`,
        url: site,
        siteUrl: site,
        objective: `Execute ${objective} on ${site}`,
        actions: [],
        taskPlan: {
          id: `fallback_plan_${index}`,
          objective: `Execute ${objective} on ${site}`,
          steps: [],
          contingencies: [],
          successCriteria: ['Task completed'],
          timeoutStrategy: this.createDefaultTimeoutStrategy(),
          confidence: 0.5,
          estimatedDuration: 20000,
          resourceRequirements: []
        },
        priority: 1,
        dependencies: [],
        expectedData: [],
        dataRequirements: [],
        timeConstraints: [],
        fallbackSites: []
      })),
      coordinationPlan: this.createDefaultCoordinationPlan(),
      dataFlow: this.createDefaultDataFlowPlan(),
      dataFlowPlan: this.createDefaultDataFlowPlan(),
      failureHandling: this.createDefaultFailureHandling(),
      aggregationStrategy: this.createDefaultAggregationStrategy(),
      estimatedDuration: sites.length * 15000,
      successProbability: 0.5
    };
  }

  private createFallbackPrioritization(actions: PendingAction[]): PrioritizedActions {
    return {
      actions: actions.map(action => ({
        action,
        finalPriority: action.priority,
        reasoning: 'Fallback prioritization'
      })),
      executionOrder: actions.map((_, i) => i.toString()),
      reasoning: {
        factors: [],
        algorithm: 'fallback',
        confidence: 0.5
      }
    };
  }

  // Prompt creation methods
  private createTaskParsingPrompt(task: string): string {
    return `
Parse this natural language task into structured understanding for browser automation.

Task: "${task}"

Analyze the task and provide structured understanding in JSON format:
{
  "intent": {
    "type": "search|form_fill|data_extract|navigate|monitor|research|comparison|booking",
    "description": "Clear description of what needs to be done",
    "confidence": 0.9,
    "subIntents": []
  },
  "objectives": ["Primary objective", "Secondary objective"],
  "constraints": ["Time constraint", "Quality constraint"],
  "expectedOutcome": "What the user expects to achieve",
  "complexity": "simple|medium|complex",
  "estimatedSteps": 5,
  "requiredSites": ["https://site1.com", "https://site2.com"],
  "dataRequirements": [
    {
      "type": "input|output",
      "name": "flight_dates",
      "format": "date",
      "required": true
    }
  ],
  "timeConstraints": []
}

Focus on:
- Identifying if this is a flight search, hotel booking, or other travel-related task
- Extracting specific requirements like dates, locations, preferences
- Understanding the complexity and required sites
- Determining data input/output requirements`;
  }

  private createPlanGenerationPrompt(understanding: TaskUnderstanding, patterns: any[]): string {
    return `
Generate an action plan for this browser automation task.

Task Understanding:
- Intent: ${understanding.intent.type}
- Description: ${understanding.intent.description}
- Complexity: ${understanding.complexity}
- Required Sites: ${understanding.requiredSites.join(', ')}

Relevant Patterns from Memory:
${patterns.map(p => `- ${p.taskType} on ${p.sitePattern} (reliability: ${p.reliability})`).join('\n')}

Generate a detailed action plan in JSON format:
{
  "steps": [
    {
      "id": "step_1",
      "action": {
        "type": "navigate",
        "target": {"css": "body"},
        "value": "https://www.google.com/flights",
        "timeout": 15000,
        "retryCount": 3
      },
      "reasoning": "Navigate to flight search site",
      "dependencies": [],
      "successCriteria": ["Page loaded successfully"],
      "fallbacks": [],
      "priority": 1,
      "estimatedDuration": 5000,
      "retryStrategy": {
        "maxRetries": 3,
        "backoffMs": 1000,
        "conditions": ["timeout", "network_error"],
        "adaptiveRetry": true
      }
    }
  ],
  "contingencies": [],
  "successCriteria": ["Task completed successfully"],
  "timeoutStrategy": {
    "maxDuration": 60000,
    "checkpoints": [20000, 40000],
    "fallbackActions": []
  },
  "confidence": 0.8,
  "estimatedDuration": 30000,
  "resourceRequirements": []
}

For flight searches:
- Start with navigation to flight booking sites
- Include form filling for departure/arrival cities and dates
- Add search execution and result extraction
- Handle potential loading delays and dynamic content`;
  }

  private createPlanAdaptationPrompt(plan: ActionPlan, context: PlanningContext): string {
    return `
Adapt this action plan based on the current context.

Current Plan:
- Objective: ${plan.objective}
- Steps: ${plan.steps.length}
- Confidence: ${plan.confidence}

Current Context:
- URL: ${context.currentUrl}
- Page Loaded: ${context.pageState.loaded}
- Available Elements: ${context.availableElements.length}
- Time Remaining: ${context.timeRemaining}ms

Analyze if adaptation is needed and provide response in JSON format:
{
  "needsAdaptation": true,
  "reason": "Why adaptation is needed",
  "adaptedSteps": [],
  "contingencies": [],
  "estimatedDuration": 25000
}`;
  }

  private createMultiSiteCoordinationPrompt(sites: string[], objective: string): string {
    return `
Create a coordination strategy for multi-site browser automation.

Sites: ${sites.join(', ')}
Objective: ${objective}

Generate coordination strategy in JSON format:
{
  "siteTasks": [
    {
      "objective": "Search flights on site 1",
      "priority": 1,
      "dependencies": [],
      "expectedData": [],
      "fallbackSites": []
    }
  ],
  "coordinationPlan": {
    "executionOrder": {
      "type": "parallel",
      "sequence": [],
      "parallelGroups": [["site1", "site2"]],
      "dependencies": {}
    }
  },
  "aggregationStrategy": {
    "type": "compare",
    "parameters": {"sortBy": "price"},
    "conflictResolution": {"strategy": "lowest_price"}
  }
}`;
  }

  private createActionPrioritizationPrompt(actions: PendingAction[]): string {
    return `
Prioritize these browser automation actions.

Actions:
${actions.map((a, i) => `${i}: ${a.action.type} (current priority: ${a.priority})`).join('\n')}

Provide prioritization in JSON format:
{
  "priorities": [3, 1, 2],
  "reasoning": ["High impact action", "Low priority", "Medium priority"],
  "executionOrder": ["0", "2", "1"],
  "factors": [
    {"name": "impact", "weight": 0.4},
    {"name": "dependencies", "weight": 0.3},
    {"name": "duration", "weight": 0.3}
  ],
  "algorithm": "weighted_scoring",
  "confidence": 0.8
}`;
  }

  private createPlanValidationPrompt(plan: ActionPlan): string {
    return `
Validate this browser automation plan for feasibility and potential issues.

Plan:
- Objective: ${plan.objective}
- Steps: ${plan.steps.length}
- Estimated Duration: ${plan.estimatedDuration}ms

Provide validation in JSON format:
{
  "isValid": true,
  "confidence": 0.8,
  "issues": [
    {
      "type": "warning",
      "severity": "medium",
      "message": "Step 3 may timeout on slow connections",
      "affectedSteps": ["step_3"],
      "suggestedFix": "Increase timeout to 15000ms"
    }
  ],
  "recommendations": ["Add more fallback options"],
  "estimatedSuccessRate": 0.85
}`;
  }

  private createPlanOptimizationPrompt(plan: ActionPlan): string {
    return `
Optimize this browser automation plan for better performance and reliability.

Current Plan:
- Steps: ${plan.steps.length}
- Duration: ${plan.estimatedDuration}ms
- Confidence: ${plan.confidence}

Provide optimization in JSON format:
{
  "canOptimize": true,
  "optimizations": ["Combine steps 2 and 3", "Reduce timeout for step 1"],
  "optimizedSteps": [],
  "estimatedDuration": 25000,
  "expectedImprovement": 0.15
}`;
  }
}