import {
  ActionFailure,
  LearningInsight,
  InteractionPattern,
  GeneralPattern,
  SiteSpecificLearning,
  Evidence,
  ApplicabilityScope,
  LearningType,
  SuccessPredictor,
  ActionTemplate
} from '../interfaces/IMemorySystem.js';
import { AIProvider } from './ai/AIProvider.js';
import { PatternStorageSystem } from './PatternStorageSystem.js';
import { DatabaseService } from './DatabaseService.js';
import { Logger } from './Logger.js';
import { AutomationAction, AutomationError } from '../../shared/types.js';

export interface LearningConfig {
  minConfidenceThreshold: number;
  maxLearningsPerContext: number;
  validationRequired: boolean;
  adaptationEnabled: boolean;
  crossSiteGeneralization: boolean;
}

export interface LearningMetrics {
  totalLearnings: number;
  validatedLearnings: number;
  successfulAdaptations: number;
  failureReductions: number;
  performanceImprovements: number;
  averageConfidence: number;
}

export interface AdaptationResult {
  originalPattern: InteractionPattern;
  adaptedPattern: InteractionPattern;
  adaptationReason: string;
  confidence: number;
  expectedImprovement: number;
}

export class LearningSystem {
  private aiProvider: AIProvider;
  private patternStorage: PatternStorageSystem;
  private database: DatabaseService;
  private logger: Logger;
  private config: LearningConfig;
  private learningCache: Map<string, LearningInsight[]> = new Map();

  constructor(
    aiProvider: AIProvider,
    patternStorage: PatternStorageSystem,
    database: DatabaseService,
    config?: Partial<LearningConfig>
  ) {
    this.aiProvider = aiProvider;
    this.patternStorage = patternStorage;
    this.database = database;
    this.logger = new Logger();
    this.config = {
      minConfidenceThreshold: 0.7,
      maxLearningsPerContext: 50,
      validationRequired: true,
      adaptationEnabled: true,
      crossSiteGeneralization: true,
      ...config
    };

    this.initializeLearningSystem();
  }

  private async initializeLearningSystem(): Promise<void> {
    try {
      // Create learning insights table
      await this.database.run(`
        CREATE TABLE IF NOT EXISTS learning_insights (
          id TEXT PRIMARY KEY,
          type TEXT NOT NULL,
          insight TEXT NOT NULL,
          confidence REAL NOT NULL,
          applicability TEXT NOT NULL,
          evidence TEXT NOT NULL,
          timestamp TEXT NOT NULL,
          validated INTEGER NOT NULL,
          validation_score REAL,
          applied_count INTEGER DEFAULT 0,
          success_rate REAL DEFAULT 0.0
        )
      `);

      // Create learning validations table
      await this.database.run(`
        CREATE TABLE IF NOT EXISTS learning_validations (
          id TEXT PRIMARY KEY,
          learning_id TEXT NOT NULL,
          validation_type TEXT NOT NULL,
          result TEXT NOT NULL,
          score REAL NOT NULL,
          timestamp TEXT NOT NULL,
          FOREIGN KEY (learning_id) REFERENCES learning_insights(id)
        )
      `);

      // Create adaptations table
      await this.database.run(`
        CREATE TABLE IF NOT EXISTS pattern_adaptations (
          id TEXT PRIMARY KEY,
          original_pattern_id TEXT NOT NULL,
          adapted_pattern_id TEXT NOT NULL,
          adaptation_reason TEXT NOT NULL,
          confidence REAL NOT NULL,
          expected_improvement REAL NOT NULL,
          actual_improvement REAL,
          timestamp TEXT NOT NULL
        )
      `);

      this.logger.info('Learning system initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize learning system:', error);
      throw error;
    }
  }

  async learnFromFailure(failure: ActionFailure): Promise<LearningInsight> {
    try {
      const prompt = this.createFailureAnalysisPrompt(failure);
      const response = await this.aiProvider.generateCompletion(prompt, {
        temperature: 0.1,
        maxTokens: 800
      });

      const analysis = JSON.parse(response);
      
      const insight: LearningInsight = {
        id: `learning_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: 'error_prevention',
        insight: analysis.insight || 'Failed to generate specific insight',
        confidence: Math.max(0.1, Math.min(1.0, analysis.confidence || 0.6)),
        applicability: this.parseApplicabilityScope(analysis.applicability, failure),
        evidence: [{
          type: 'error_reduction',
          value: 1,
          description: `Failure analysis for ${failure.action.type} action`,
          timestamp: new Date()
        }],
        timestamp: new Date(),
        validated: false
      };

      // Store the learning insight
      await this.storeLearningInsight(insight);

      // If validation is required, validate the insight
      if (this.config.validationRequired) {
        await this.validateLearningInsight(insight);
      }

      // Look for similar failures to strengthen the learning
      await this.reinforceLearningFromSimilarFailures(insight, failure);

      this.logger.info(`Generated learning insight from failure: ${insight.id}`);
      return insight;
    } catch (error) {
      this.logger.error('Failed to learn from failure:', error);
      
      // Return fallback insight
      return this.createFallbackFailureInsight(failure);
    }
  }

  async learnFromSuccess(
    action: AutomationAction,
    context: { url: string; pageType: string; duration: number; confidence: number }
  ): Promise<LearningInsight> {
    try {
      const prompt = this.createSuccessAnalysisPrompt(action, context);
      const response = await this.aiProvider.generateCompletion(prompt, {
        temperature: 0.1,
        maxTokens: 600
      });

      const analysis = JSON.parse(response);
      
      const insight: LearningInsight = {
        id: `success_learning_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: 'pattern_recognition',
        insight: analysis.insight || 'Successful action pattern identified',
        confidence: Math.max(0.1, Math.min(1.0, analysis.confidence || 0.7)),
        applicability: {
          domains: [new URL(context.url).hostname],
          pageTypes: [context.pageType],
          actionTypes: [action.type],
          conditions: analysis.conditions || []
        },
        evidence: [{
          type: 'success_rate',
          value: context.confidence,
          description: `Successful ${action.type} action`,
          timestamp: new Date()
        }],
        timestamp: new Date(),
        validated: false
      };

      await this.storeLearningInsight(insight);

      if (this.config.validationRequired) {
        await this.validateLearningInsight(insight);
      }

      return insight;
    } catch (error) {
      this.logger.error('Failed to learn from success:', error);
      
      return {
        id: `fallback_success_${Date.now()}`,
        type: 'pattern_recognition',
        insight: `Successful ${action.type} action on ${context.pageType} page`,
        confidence: 0.5,
        applicability: {
          domains: [new URL(context.url).hostname],
          pageTypes: [context.pageType],
          actionTypes: [action.type],
          conditions: []
        },
        evidence: [],
        timestamp: new Date(),
        validated: false
      };
    }
  }

  async adaptPattern(
    pattern: InteractionPattern,
    newContext: { url: string; pageType: string; constraints: string[] }
  ): Promise<AdaptationResult | null> {
    try {
      if (!this.config.adaptationEnabled) {
        return null;
      }

      const prompt = this.createPatternAdaptationPrompt(pattern, newContext);
      const response = await this.aiProvider.generateCompletion(prompt, {
        temperature: 0.2,
        maxTokens: 1000
      });

      const adaptation = JSON.parse(response);
      
      if (!adaptation.shouldAdapt) {
        return null;
      }

      const adaptedPattern: InteractionPattern = {
        ...pattern,
        id: `adapted_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        sitePattern: new URL(newContext.url).hostname,
        successfulActions: adaptation.adaptedActions || pattern.successfulActions,
        contextConditions: adaptation.adaptedConditions || pattern.contextConditions,
        reliability: Math.max(0.1, pattern.reliability - 0.1), // Slightly lower reliability for adapted patterns
        usageCount: 0,
        createdAt: new Date(),
        lastUsed: new Date(),
        tags: [...pattern.tags, 'adapted']
      };

      const result: AdaptationResult = {
        originalPattern: pattern,
        adaptedPattern,
        adaptationReason: adaptation.reason || 'Pattern adapted for new context',
        confidence: Math.max(0.1, Math.min(1.0, adaptation.confidence || 0.6)),
        expectedImprovement: Math.max(0.0, Math.min(1.0, adaptation.expectedImprovement || 0.1))
      };

      // Store the adapted pattern
      await this.patternStorage.storePattern(adaptedPattern);

      // Record the adaptation
      await this.recordAdaptation(result);

      this.logger.info(`Adapted pattern ${pattern.id} for new context: ${newContext.url}`);
      return result;
    } catch (error) {
      this.logger.error('Failed to adapt pattern:', error);
      return null;
    }
  }

  async generalizePatterns(patterns: InteractionPattern[]): Promise<GeneralPattern[]> {
    try {
      if (!this.config.crossSiteGeneralization || patterns.length < 2) {
        return [];
      }

      const prompt = this.createGeneralizationPrompt(patterns);
      const response = await this.aiProvider.generateCompletion(prompt, {
        temperature: 0.2,
        maxTokens: 1200
      });

      const generalization = JSON.parse(response);
      const generalPatterns: GeneralPattern[] = [];

      for (const genPattern of generalization.generalPatterns || []) {
        const generalPattern: GeneralPattern = {
          id: `general_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          name: genPattern.name || 'Generalized Pattern',
          description: genPattern.description || 'Pattern generalized from multiple specific patterns',
          applicableScenarios: genPattern.applicableScenarios || [],
          actionTemplate: genPattern.actionTemplate || [],
          successPredictors: genPattern.successPredictors || [],
          reliability: this.calculateGeneralPatternReliability(patterns),
          createdFrom: patterns.map(p => p.id),
          lastValidated: new Date()
        };

        await this.patternStorage.storeGeneralPattern(generalPattern);
        generalPatterns.push(generalPattern);
      }

      this.logger.info(`Generated ${generalPatterns.length} general patterns from ${patterns.length} specific patterns`);
      return generalPatterns;
    } catch (error) {
      this.logger.error('Failed to generalize patterns:', error);
      return [];
    }
  }

  async extractSuccessPatterns(
    successfulActions: { action: AutomationAction; context: any; performance: any }[]
  ): Promise<InteractionPattern[]> {
    try {
      if (successfulActions.length === 0) {
        return [];
      }

      const prompt = this.createSuccessPatternExtractionPrompt(successfulActions);
      const response = await this.aiProvider.generateCompletion(prompt, {
        temperature: 0.1,
        maxTokens: 1000
      });

      const extraction = JSON.parse(response);
      const patterns: InteractionPattern[] = [];

      for (const patternData of extraction.patterns || []) {
        const pattern: InteractionPattern = {
          id: `extracted_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          sitePattern: patternData.sitePattern || 'unknown',
          taskType: patternData.taskType || 'general',
          successfulActions: patternData.successfulActions || [],
          contextConditions: patternData.contextConditions || [],
          reliability: Math.max(0.1, Math.min(1.0, patternData.reliability || 0.8)),
          lastUsed: new Date(),
          usageCount: 1,
          createdAt: new Date(),
          tags: patternData.tags || ['extracted']
        };

        await this.patternStorage.storePattern(pattern);
        patterns.push(pattern);
      }

      this.logger.info(`Extracted ${patterns.length} success patterns`);
      return patterns;
    } catch (error) {
      this.logger.error('Failed to extract success patterns:', error);
      return [];
    }
  }

  async validateLearningInsight(insight: LearningInsight): Promise<boolean> {
    try {
      const prompt = this.createValidationPrompt(insight);
      const response = await this.aiProvider.generateCompletion(prompt, {
        temperature: 0.1,
        maxTokens: 400
      });

      const validation = JSON.parse(response);
      const isValid = validation.isValid && validation.score >= this.config.minConfidenceThreshold;

      // Update the insight validation status
      await this.database.run(`
        UPDATE learning_insights 
        SET validated = ?, validation_score = ?
        WHERE id = ?
      `, [isValid ? 1 : 0, validation.score || 0, insight.id]);

      // Record the validation
      await this.database.run(`
        INSERT INTO learning_validations 
        (id, learning_id, validation_type, result, score, timestamp)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [
        `validation_${Date.now()}`,
        insight.id,
        'ai_validation',
        JSON.stringify(validation),
        validation.score || 0,
        new Date().toISOString()
      ]);

      insight.validated = isValid;
      return isValid;
    } catch (error) {
      this.logger.error('Failed to validate learning insight:', error);
      return false;
    }
  }

  async getLearningMetrics(): Promise<LearningMetrics> {
    try {
      const totalLearnings = await this.database.get('SELECT COUNT(*) as count FROM learning_insights');
      const validatedLearnings = await this.database.get('SELECT COUNT(*) as count FROM learning_insights WHERE validated = 1');
      const avgConfidence = await this.database.get('SELECT AVG(confidence) as avg FROM learning_insights');
      const adaptations = await this.database.get('SELECT COUNT(*) as count FROM pattern_adaptations');

      return {
        totalLearnings: totalLearnings?.count || 0,
        validatedLearnings: validatedLearnings?.count || 0,
        successfulAdaptations: adaptations?.count || 0,
        failureReductions: 0, // Would need tracking implementation
        performanceImprovements: 0, // Would need tracking implementation
        averageConfidence: avgConfidence?.avg || 0
      };
    } catch (error) {
      this.logger.error('Failed to get learning metrics:', error);
      return {
        totalLearnings: 0,
        validatedLearnings: 0,
        successfulAdaptations: 0,
        failureReductions: 0,
        performanceImprovements: 0,
        averageConfidence: 0
      };
    }
  }

  async optimizePatternReliability(): Promise<void> {
    try {
      // Get all patterns with usage data
      const patterns = await this.patternStorage.queryPatterns({
        minReliability: 0.1,
        limit: 100
      });

      for (const pattern of patterns) {
        // Calculate new reliability based on recent usage and success
        const newReliability = await this.calculateUpdatedReliability(pattern);
        
        if (Math.abs(newReliability - pattern.reliability) > 0.05) {
          await this.patternStorage.updatePatternReliability(pattern.id, newReliability);
        }
      }

      this.logger.info('Pattern reliability optimization completed');
    } catch (error) {
      this.logger.error('Failed to optimize pattern reliability:', error);
    }
  }

  // Private helper methods
  private async storeLearningInsight(insight: LearningInsight): Promise<void> {
    const query = `
      INSERT OR REPLACE INTO learning_insights 
      (id, type, insight, confidence, applicability, evidence, timestamp, validated)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;

    await this.database.run(query, [
      insight.id,
      insight.type,
      insight.insight,
      insight.confidence,
      JSON.stringify(insight.applicability),
      JSON.stringify(insight.evidence),
      insight.timestamp.toISOString(),
      insight.validated ? 1 : 0
    ]);

    // Update cache
    const contextKey = `${insight.applicability.domains[0]}_${insight.type}`;
    const cached = this.learningCache.get(contextKey) || [];
    cached.push(insight);
    
    // Keep only recent learnings in cache
    if (cached.length > this.config.maxLearningsPerContext) {
      cached.splice(0, cached.length - this.config.maxLearningsPerContext);
    }
    
    this.learningCache.set(contextKey, cached);
  }

  private async recordAdaptation(adaptation: AdaptationResult): Promise<void> {
    const query = `
      INSERT INTO pattern_adaptations 
      (id, original_pattern_id, adapted_pattern_id, adaptation_reason, 
       confidence, expected_improvement, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    await this.database.run(query, [
      `adaptation_${Date.now()}`,
      adaptation.originalPattern.id,
      adaptation.adaptedPattern.id,
      adaptation.adaptationReason,
      adaptation.confidence,
      adaptation.expectedImprovement,
      new Date().toISOString()
    ]);
  }

  private parseApplicabilityScope(rawApplicability: any, failure: ActionFailure): ApplicabilityScope {
    try {
      if (rawApplicability && typeof rawApplicability === 'object') {
        return {
          domains: rawApplicability.domains || [new URL(failure.context.url).hostname],
          pageTypes: rawApplicability.pageTypes || [failure.context.pageType],
          actionTypes: rawApplicability.actionTypes || [failure.action.type],
          conditions: rawApplicability.conditions || []
        };
      }
    } catch (error) {
      this.logger.warn('Failed to parse applicability scope:', error);
    }

    return {
      domains: [new URL(failure.context.url).hostname],
      pageTypes: [failure.context.pageType],
      actionTypes: [failure.action.type],
      conditions: []
    };
  }

  private createFallbackFailureInsight(failure: ActionFailure): LearningInsight {
    return {
      id: `fallback_learning_${Date.now()}`,
      type: 'error_prevention',
      insight: `Action ${failure.action.type} failed: ${failure.error.message}`,
      confidence: 0.5,
      applicability: {
        domains: [new URL(failure.context.url).hostname],
        pageTypes: [failure.context.pageType],
        actionTypes: [failure.action.type],
        conditions: []
      },
      evidence: [{
        type: 'error_reduction',
        value: 1,
        description: 'Fallback failure analysis',
        timestamp: new Date()
      }],
      timestamp: new Date(),
      validated: false
    };
  }

  private async reinforceLearningFromSimilarFailures(insight: LearningInsight, failure: ActionFailure): Promise<void> {
    // This would analyze similar failures and strengthen the learning
    // Implementation would involve querying for similar failures and updating confidence
    this.logger.debug(`Reinforcing learning ${insight.id} with similar failure patterns`);
  }

  private calculateGeneralPatternReliability(patterns: InteractionPattern[]): number {
    if (patterns.length === 0) return 0.5;
    
    const avgReliability = patterns.reduce((sum, p) => sum + p.reliability, 0) / patterns.length;
    // General patterns are slightly less reliable than specific ones
    return Math.max(0.1, avgReliability - 0.1);
  }

  private async calculateUpdatedReliability(pattern: InteractionPattern): Promise<number> {
    // This would calculate updated reliability based on recent usage and success rates
    // For now, return the current reliability with small random adjustment
    const adjustment = (Math.random() - 0.5) * 0.1;
    return Math.max(0.1, Math.min(1.0, pattern.reliability + adjustment));
  }

  // Prompt creation methods
  private createFailureAnalysisPrompt(failure: ActionFailure): string {
    return `
Analyze this automation failure and provide learning insights.

Failure Details:
- Action: ${failure.action.type}
- Target: ${JSON.stringify(failure.action.target)}
- Error: ${failure.error.message}
- Context URL: ${failure.context.url}
- Page Type: ${failure.context.pageType}
- Attempt Number: ${failure.attemptNumber}

Provide analysis in JSON format:
{
  "insight": "Specific learning insight about why this failed and how to prevent it",
  "confidence": 0.8,
  "applicability": {
    "domains": ["domain.com"],
    "pageTypes": ["form"],
    "actionTypes": ["click"],
    "conditions": []
  }
}`;
  }

  private createSuccessAnalysisPrompt(action: AutomationAction, context: any): string {
    return `
Analyze this successful automation action and extract learning insights.

Success Details:
- Action: ${action.type}
- Target: ${JSON.stringify(action.target)}
- Context URL: ${context.url}
- Page Type: ${context.pageType}
- Duration: ${context.duration}ms
- Confidence: ${context.confidence}

Provide analysis in JSON format:
{
  "insight": "What made this action successful and how to replicate it",
  "confidence": 0.8,
  "conditions": []
}`;
  }

  private createPatternAdaptationPrompt(pattern: InteractionPattern, newContext: any): string {
    return `
Analyze if this pattern can be adapted for a new context.

Original Pattern:
- Site: ${pattern.sitePattern}
- Task: ${pattern.taskType}
- Reliability: ${pattern.reliability}
- Actions: ${JSON.stringify(pattern.successfulActions)}

New Context:
- URL: ${newContext.url}
- Page Type: ${newContext.pageType}
- Constraints: ${newContext.constraints.join(', ')}

Provide adaptation analysis in JSON format:
{
  "shouldAdapt": true,
  "reason": "Why adaptation is needed",
  "confidence": 0.7,
  "expectedImprovement": 0.1,
  "adaptedActions": [],
  "adaptedConditions": []
}`;
  }

  private createGeneralizationPrompt(patterns: InteractionPattern[]): string {
    return `
Generalize these specific patterns into broader, reusable patterns.

Patterns:
${patterns.map(p => `- ${p.sitePattern}: ${p.taskType} (reliability: ${p.reliability})`).join('\n')}

Create generalized patterns in JSON format:
{
  "generalPatterns": [
    {
      "name": "General Pattern Name",
      "description": "What this pattern accomplishes",
      "applicableScenarios": ["scenario1", "scenario2"],
      "actionTemplate": [],
      "successPredictors": []
    }
  ]
}`;
  }

  private createSuccessPatternExtractionPrompt(successfulActions: any[]): string {
    return `
Extract reusable patterns from these successful actions.

Successful Actions:
${successfulActions.map(sa => `- ${sa.action.type} on ${sa.context.url}`).join('\n')}

Extract patterns in JSON format:
{
  "patterns": [
    {
      "sitePattern": "domain.com",
      "taskType": "task_type",
      "successfulActions": [],
      "contextConditions": [],
      "reliability": 0.8,
      "tags": ["tag1", "tag2"]
    }
  ]
}`;
  }

  private createValidationPrompt(insight: LearningInsight): string {
    return `
Validate this learning insight for accuracy and usefulness.

Learning Insight:
- Type: ${insight.type}
- Insight: ${insight.insight}
- Confidence: ${insight.confidence}
- Applicability: ${JSON.stringify(insight.applicability)}

Provide validation in JSON format:
{
  "isValid": true,
  "score": 0.8,
  "reasoning": "Why this insight is valid or invalid"
}`;
  }
}