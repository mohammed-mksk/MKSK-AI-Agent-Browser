import { 
  IReasoningEngine,
  BrowserState,
  ActionHistory,
  ExecutedAction,
  ActionResult,
  ReasoningContext,
  ReasoningResult,
  ActionEvaluation,
  ActionPlan,
  StuckDetection,
  DecisionExplanation,
  ActionDecision,
  LearningInsight,
  MemoryContext,
  AlternativeAction,
  PlannedAction,
  ActionPattern,
  ContingencyPlan,
  TimeoutStrategy
} from '../../interfaces/IReasoningEngine.js';
import { AIProvider } from './AIProvider.js';
import { Logger } from '../Logger.js';
import { AutomationAction } from '../../../shared/types.js';

export class ReasoningEngine implements IReasoningEngine {
  private aiProvider: AIProvider;
  private logger: Logger;
  private memoryStore: Map<string, any> = new Map();
  private patternDetectionThreshold = 3; // Number of repetitions to consider a pattern

  constructor(aiProvider: AIProvider) {
    this.aiProvider = aiProvider;
    this.logger = new Logger();
  }

  async analyzeCurrentState(state: BrowserState, history: ActionHistory): Promise<ReasoningResult> {
    try {
      const prompt = this.createStateAnalysisPrompt(state, history);
      const response = await this.aiProvider.generateCompletion(prompt, {
        temperature: 0.1,
        maxTokens: 1000
      });

      const parsed = JSON.parse(response);
      
      return {
        thinking: parsed.thinking || 'Analyzing current state and context',
        evaluation: parsed.evaluation || 'State analysis completed',
        memory: parsed.memory || 'No specific memory insights',
        nextGoal: parsed.nextGoal || 'Continue with planned actions',
        confidence: parsed.confidence || 0.7,
        alternatives: parsed.alternatives || []
      };
    } catch (error) {
      this.logger.error('Failed to analyze current state:', error);
      return this.createFallbackStateAnalysis(state, history);
    }
  }

  async evaluatePreviousAction(action: ExecutedAction, result: ActionResult): Promise<ActionEvaluation> {
    try {
      const prompt = this.createActionEvaluationPrompt(action, result);
      const response = await this.aiProvider.generateCompletion(prompt, {
        temperature: 0.1,
        maxTokens: 800
      });

      const parsed = JSON.parse(response);
      
      return {
        success: result.success,
        reasoning: parsed.reasoning || 'Action evaluation completed',
        lessons: parsed.lessons || [],
        nextRecommendations: parsed.nextRecommendations || [],
        confidence: parsed.confidence || 0.7,
        shouldRetry: parsed.shouldRetry || false,
        alternativeApproaches: parsed.alternativeApproaches || []
      };
    } catch (error) {
      this.logger.error('Failed to evaluate previous action:', error);
      return this.createFallbackActionEvaluation(action, result);
    }
  }

  async generateNextSteps(context: ReasoningContext): Promise<ActionPlan> {
    try {
      const prompt = this.createNextStepsPrompt(context);
      const response = await this.aiProvider.generateCompletion(prompt, {
        temperature: 0.2,
        maxTokens: 1200
      });

      const parsed = JSON.parse(response);
      
      return {
        id: `plan_${Date.now()}`,
        objective: context.taskObjective,
        steps: parsed.steps || [],
        contingencies: parsed.contingencies || [],
        successCriteria: parsed.successCriteria || [],
        timeoutStrategy: parsed.timeoutStrategy || this.createDefaultTimeoutStrategy(),
        confidence: parsed.confidence || 0.7
      };
    } catch (error) {
      this.logger.error('Failed to generate next steps:', error);
      return this.createFallbackActionPlan(context);
    }
  }

  async detectStuckPattern(history: ActionHistory): Promise<StuckDetection> {
    try {
      // Analyze recent actions for patterns
      const recentActions = history.actions.slice(-10); // Last 10 actions
      const patterns = this.findActionPatterns(recentActions);
      
      const problematicPattern = patterns.find(p => 
        p.frequency >= this.patternDetectionThreshold && p.isProblematic
      );

      if (problematicPattern) {
        const prompt = this.createStuckDetectionPrompt(problematicPattern, history);
        const response = await this.aiProvider.generateCompletion(prompt, {
          temperature: 0.1,
          maxTokens: 600
        });

        const parsed = JSON.parse(response);
        
        return {
          isStuck: true,
          pattern: problematicPattern,
          confidence: parsed.confidence || 0.8,
          suggestedBreakout: parsed.suggestedBreakout || [],
          reasoning: parsed.reasoning || 'Detected repetitive pattern in actions'
        };
      }

      return {
        isStuck: false,
        pattern: { id: '', actions: [], frequency: 0, lastOccurrence: new Date(), isProblematic: false },
        confidence: 0.9,
        suggestedBreakout: [],
        reasoning: 'No problematic patterns detected'
      };
    } catch (error) {
      this.logger.error('Failed to detect stuck pattern:', error);
      return {
        isStuck: false,
        pattern: { id: '', actions: [], frequency: 0, lastOccurrence: new Date(), isProblematic: false },
        confidence: 0.5,
        suggestedBreakout: [],
        reasoning: 'Pattern detection failed'
      };
    }
  }

  async explainDecision(decision: ActionDecision): Promise<DecisionExplanation> {
    try {
      const prompt = this.createDecisionExplanationPrompt(decision);
      const response = await this.aiProvider.generateCompletion(prompt, {
        temperature: 0.1,
        maxTokens: 800
      });

      const parsed = JSON.parse(response);
      
      return {
        decision: decision.reasoning,
        reasoning: parsed.reasoning || 'Decision explanation generated',
        factors: parsed.factors || [],
        confidence: parsed.confidence || 0.7,
        alternatives: parsed.alternatives || [],
        riskAssessment: parsed.riskAssessment || { level: 'medium', factors: [], mitigation: [] }
      };
    } catch (error) {
      this.logger.error('Failed to explain decision:', error);
      return this.createFallbackDecisionExplanation(decision);
    }
  }

  async updateMemory(learning: LearningInsight): Promise<void> {
    try {
      const key = `${learning.type}_${learning.context}`;
      const existingLearnings = this.memoryStore.get(key) || [];
      existingLearnings.push(learning);
      
      // Keep only the most recent 50 learnings per context
      if (existingLearnings.length > 50) {
        existingLearnings.splice(0, existingLearnings.length - 50);
      }
      
      this.memoryStore.set(key, existingLearnings);
      this.logger.info(`Updated memory with ${learning.type} learning for context: ${learning.context}`);
    } catch (error) {
      this.logger.error('Failed to update memory:', error);
    }
  }

  async getRelevantMemory(context: string): Promise<MemoryContext> {
    try {
      const relevantLearnings: LearningInsight[] = [];
      
      // Search for relevant learnings
      for (const [key, learnings] of this.memoryStore.entries()) {
        if (key.includes(context) || context.includes(key.split('_')[1])) {
          relevantLearnings.push(...learnings);
        }
      }

      // Sort by relevance and recency
      relevantLearnings.sort((a, b) => {
        const relevanceA = a.applicability.some(app => context.includes(app)) ? 1 : 0;
        const relevanceB = b.applicability.some(app => context.includes(app)) ? 1 : 0;
        
        if (relevanceA !== relevanceB) {
          return relevanceB - relevanceA;
        }
        
        return b.timestamp.getTime() - a.timestamp.getTime();
      });

      return {
        recentPatterns: [],
        successfulStrategies: [],
        failedAttempts: [],
        siteSpecificLearnings: []
      };
    } catch (error) {
      this.logger.error('Failed to get relevant memory:', error);
      return {
        recentPatterns: [],
        successfulStrategies: [],
        failedAttempts: [],
        siteSpecificLearnings: []
      };
    }
  }

  // Private helper methods
  private createStateAnalysisPrompt(state: BrowserState, history: ActionHistory): string {
    return `
Analyze the current browser automation state and provide reasoning insights.

Current State:
- URL: ${state.url}
- Title: ${state.title}
- Page Type: ${state.pageType}
- Load State: ${state.loadState}
- Elements Found: ${state.elementMap?.indexed?.size || 0}
- Recent Errors: ${state.errors?.length || 0}

Action History:
- Total Actions: ${history.totalActions}
- Successful: ${history.successfulActions}
- Failed: ${history.failedActions}
- Recent Actions: ${history.actions.slice(-3).map(a => a.action.type).join(', ')}

Provide analysis in JSON format:
{
  "thinking": "Current situation analysis and context understanding",
  "evaluation": "Assessment of current state and progress",
  "memory": "Relevant insights from past experiences",
  "nextGoal": "Recommended next objective or focus",
  "confidence": 0.8,
  "alternatives": [
    {
      "action": {"type": "action_type", "target": {"css": "selector"}, "value": "", "timeout": 10000, "retryCount": 3},
      "reasoning": "Why this alternative might be better",
      "confidence": 0.7,
      "estimatedSuccess": 0.8
    }
  ]
}`;
  }

  private createActionEvaluationPrompt(action: ExecutedAction, result: ActionResult): string {
    return `
Evaluate the success/failure of a browser automation action and provide learning insights.

Action Executed:
- Type: ${action.action.type}
- Target: ${JSON.stringify(action.action.target)}
- Value: ${action.action.value || 'N/A'}
- Duration: ${action.duration}ms
- Success: ${action.success}

Result:
- Success: ${result.success}
- Data Extracted: ${result.extractedData?.length || 0} items
- State Changes: ${result.stateChanges?.length || 0}
- Error: ${result.error?.message || 'None'}

Provide evaluation in JSON format:
{
  "reasoning": "Analysis of why the action succeeded or failed",
  "lessons": ["Key learning point 1", "Key learning point 2"],
  "nextRecommendations": ["Recommendation 1", "Recommendation 2"],
  "confidence": 0.8,
  "shouldRetry": false,
  "alternativeApproaches": ["Alternative approach 1", "Alternative approach 2"]
}`;
  }

  private createNextStepsPrompt(context: ReasoningContext): string {
    return `
Generate the next steps for browser automation based on current context.

Task Objective: ${context.taskObjective}
Current URL: ${context.currentState.url}
Time Remaining: ${context.timeRemaining}ms
Constraints: ${context.constraints.map(c => c.description).join(', ')}

Recent Actions: ${context.actionHistory.actions.slice(-3).map(a => 
  `${a.action.type} (${a.success ? 'success' : 'failed'})`
).join(', ')}

Generate action plan in JSON format:
{
  "steps": [
    {
      "id": "step_1",
      "action": {"type": "navigate", "target": {"css": "selector"}, "value": "", "timeout": 10000, "retryCount": 3},
      "reasoning": "Why this step is needed",
      "dependencies": [],
      "successCriteria": ["Criteria 1", "Criteria 2"],
      "fallbacks": []
    }
  ],
  "contingencies": [
    {
      "condition": "If step fails",
      "actions": [],
      "reasoning": "Fallback strategy"
    }
  ],
  "successCriteria": ["Overall success criteria"],
  "timeoutStrategy": {
    "maxDuration": 30000,
    "checkpoints": [10000, 20000],
    "fallbackActions": []
  },
  "confidence": 0.8
}`;
  }

  private createStuckDetectionPrompt(pattern: ActionPattern, history: ActionHistory): string {
    return `
Analyze a detected action pattern to determine if automation is stuck and suggest breakout strategies.

Detected Pattern:
- Actions: ${pattern.actions.join(' -> ')}
- Frequency: ${pattern.frequency}
- Last Occurrence: ${pattern.lastOccurrence}

Recent History: ${history.actions.slice(-5).map(a => a.action.type).join(' -> ')}

Provide analysis in JSON format:
{
  "reasoning": "Why this pattern indicates being stuck",
  "confidence": 0.9,
  "suggestedBreakout": [
    {
      "action": {"type": "wait", "target": {}, "value": "", "timeout": 5000, "retryCount": 1},
      "reasoning": "Wait for page to stabilize",
      "confidence": 0.8,
      "estimatedSuccess": 0.7
    }
  ]
}`;
  }

  private createDecisionExplanationPrompt(decision: ActionDecision): string {
    return `
Explain the reasoning behind an automation decision in detail.

Decision: ${decision.reasoning}
Action: ${decision.action.type} on ${JSON.stringify(decision.action.target)}
Context: ${decision.context.taskObjective}

Provide explanation in JSON format:
{
  "reasoning": "Detailed explanation of the decision logic",
  "factors": [
    {
      "factor": "Factor name",
      "weight": 0.8,
      "value": "Factor value",
      "impact": "positive"
    }
  ],
  "confidence": 0.8,
  "alternatives": [
    {
      "decision": "Alternative decision",
      "reasoning": "Why this alternative was considered",
      "confidence": 0.6,
      "tradeoffs": ["Tradeoff 1", "Tradeoff 2"]
    }
  ],
  "riskAssessment": {
    "level": "medium",
    "factors": ["Risk factor 1"],
    "mitigation": ["Mitigation strategy 1"]
  }
}`;
  }

  private findActionPatterns(actions: ExecutedAction[]): ActionPattern[] {
    const patterns: ActionPattern[] = [];
    const actionSequences = actions.map(a => a.action.type);
    
    // Look for repeating sequences of length 2-4
    for (let length = 2; length <= 4; length++) {
      for (let i = 0; i <= actionSequences.length - length * 2; i++) {
        const sequence = actionSequences.slice(i, i + length);
        let frequency = 1;
        
        // Count how many times this sequence repeats
        for (let j = i + length; j <= actionSequences.length - length; j += length) {
          const nextSequence = actionSequences.slice(j, j + length);
          if (JSON.stringify(sequence) === JSON.stringify(nextSequence)) {
            frequency++;
          } else {
            break;
          }
        }
        
        if (frequency >= this.patternDetectionThreshold) {
          patterns.push({
            id: `pattern_${Date.now()}_${i}`,
            actions: sequence,
            frequency,
            lastOccurrence: actions[i + (frequency - 1) * length]?.timestamp || new Date(),
            isProblematic: frequency >= this.patternDetectionThreshold
          });
        }
      }
    }
    
    return patterns;
  }

  private createFallbackStateAnalysis(state: BrowserState, history: ActionHistory): ReasoningResult {
    return {
      thinking: `Analyzing state: ${state.url} with ${history.totalActions} total actions`,
      evaluation: `Current success rate: ${((history.successfulActions / history.totalActions) * 100).toFixed(1)}%`,
      memory: 'Using fallback analysis due to AI provider error',
      nextGoal: 'Continue with planned automation steps',
      confidence: 0.6,
      alternatives: []
    };
  }

  private createFallbackActionEvaluation(action: ExecutedAction, result: ActionResult): ActionEvaluation {
    return {
      success: result.success,
      reasoning: `Action ${action.action.type} ${result.success ? 'succeeded' : 'failed'}`,
      lessons: result.success ? ['Action completed successfully'] : ['Action failed - may need retry'],
      nextRecommendations: result.success ? ['Continue to next step'] : ['Retry with different approach'],
      confidence: 0.6,
      shouldRetry: !result.success,
      alternativeApproaches: ['Try different selector', 'Wait longer', 'Use different action type']
    };
  }

  private createFallbackActionPlan(context: ReasoningContext): ActionPlan {
    return {
      id: `fallback_plan_${Date.now()}`,
      objective: context.taskObjective,
      steps: [],
      contingencies: [],
      successCriteria: ['Complete task objective'],
      timeoutStrategy: this.createDefaultTimeoutStrategy(),
      confidence: 0.5
    };
  }

  private createFallbackDecisionExplanation(decision: ActionDecision): DecisionExplanation {
    return {
      decision: decision.reasoning,
      reasoning: 'Fallback explanation due to AI provider error',
      factors: [],
      confidence: 0.5,
      alternatives: [],
      riskAssessment: { level: 'medium', factors: [], mitigation: [] }
    };
  }

  private createDefaultTimeoutStrategy(): TimeoutStrategy {
    return {
      maxDuration: 30000,
      checkpoints: [10000, 20000],
      fallbackActions: []
    };
  }
}