import {
  IMemorySystem,
  InteractionPattern,
  TaskContext,
  TaskProgress,
  ActionFailure,
  LearningInsight,
  GeneralPattern,
  SiteSpecificLearning,
  MemoryStats,
  ActionSequence,
  ContextCondition,
  Obstacle,
  Adaptation,
  ApplicabilityScope,
  Evidence,
  CommonIssue,
  Optimization,
  DomainStats,
  PatternType,
  LearningType
} from '../interfaces/IMemorySystem.js';
import { AIProvider } from './ai/AIProvider.js';
import { Logger } from './Logger.js';
import { DatabaseService } from './DatabaseService.js';

export class MemorySystem implements IMemorySystem {
  private aiProvider: AIProvider;
  private logger: Logger;
  private database: DatabaseService;
  private memoryCache: Map<string, any> = new Map();
  private readonly CACHE_TTL = 300000; // 5 minutes
  private readonly MAX_PATTERNS_PER_DOMAIN = 100;
  private readonly RELIABILITY_THRESHOLD = 0.7;

  constructor(aiProvider: AIProvider, database: DatabaseService) {
    this.aiProvider = aiProvider;
    this.logger = new Logger();
    this.database = database;
    this.initializeDatabase();
  }

  private async initializeDatabase(): Promise<void> {
    try {
      // Create tables for memory system
      await this.database.run(`
        CREATE TABLE IF NOT EXISTS interaction_patterns (
          id TEXT PRIMARY KEY,
          site_pattern TEXT NOT NULL,
          task_type TEXT NOT NULL,
          successful_actions TEXT NOT NULL,
          context_conditions TEXT NOT NULL,
          reliability REAL NOT NULL,
          last_used TEXT NOT NULL,
          usage_count INTEGER NOT NULL,
          created_at TEXT NOT NULL,
          tags TEXT NOT NULL
        )
      `);

      await this.database.run(`
        CREATE TABLE IF NOT EXISTS task_progress (
          task_id TEXT PRIMARY KEY,
          current_step INTEGER NOT NULL,
          total_steps INTEGER NOT NULL,
          completed_objectives TEXT NOT NULL,
          pending_objectives TEXT NOT NULL,
          encountered_obstacles TEXT NOT NULL,
          adaptations_made TEXT NOT NULL,
          start_time TEXT NOT NULL,
          last_updated TEXT NOT NULL,
          estimated_completion TEXT,
          confidence REAL NOT NULL
        )
      `);

      await this.database.run(`
        CREATE TABLE IF NOT EXISTS learning_insights (
          id TEXT PRIMARY KEY,
          type TEXT NOT NULL,
          insight TEXT NOT NULL,
          confidence REAL NOT NULL,
          applicability TEXT NOT NULL,
          evidence TEXT NOT NULL,
          timestamp TEXT NOT NULL,
          validated INTEGER NOT NULL
        )
      `);

      await this.database.run(`
        CREATE TABLE IF NOT EXISTS site_specific_learnings (
          id TEXT PRIMARY KEY,
          domain TEXT NOT NULL,
          subdomain TEXT,
          patterns TEXT NOT NULL,
          common_issues TEXT NOT NULL,
          optimizations TEXT NOT NULL,
          last_updated TEXT NOT NULL,
          reliability REAL NOT NULL,
          usage_frequency INTEGER NOT NULL
        )
      `);

      await this.database.run(`
        CREATE TABLE IF NOT EXISTS general_patterns (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          description TEXT NOT NULL,
          applicable_scenarios TEXT NOT NULL,
          action_template TEXT NOT NULL,
          success_predictors TEXT NOT NULL,
          reliability REAL NOT NULL,
          created_from TEXT NOT NULL,
          last_validated TEXT NOT NULL
        )
      `);

      this.logger.info('Memory system database initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize memory system database:', error);
    }
  }

  async storeSuccessfulPattern(pattern: InteractionPattern): Promise<void> {
    try {
      const query = `
        INSERT OR REPLACE INTO interaction_patterns 
        (id, site_pattern, task_type, successful_actions, context_conditions, 
         reliability, last_used, usage_count, created_at, tags)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      await this.database.run(query, [
        pattern.id,
        pattern.sitePattern,
        pattern.taskType,
        JSON.stringify(pattern.successfulActions),
        JSON.stringify(pattern.contextConditions),
        pattern.reliability,
        pattern.lastUsed.toISOString(),
        pattern.usageCount,
        pattern.createdAt.toISOString(),
        JSON.stringify(pattern.tags)
      ]);

      // Update cache
      this.memoryCache.set(`pattern_${pattern.id}`, {
        data: pattern,
        timestamp: Date.now()
      });

      this.logger.info(`Stored successful pattern: ${pattern.id} for ${pattern.sitePattern}`);
    } catch (error) {
      this.logger.error('Failed to store successful pattern:', error);
      throw error;
    }
  }

  async retrieveRelevantPatterns(context: TaskContext): Promise<InteractionPattern[]> {
    try {
      // Check cache first
      const cacheKey = `patterns_${context.currentUrl}_${context.taskId}`;
      const cached = this.memoryCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
        return cached.data;
      }

      const domain = new URL(context.currentUrl).hostname;
      const query = `
        SELECT * FROM interaction_patterns 
        WHERE site_pattern LIKE ? OR site_pattern LIKE ?
        ORDER BY reliability DESC, usage_count DESC, last_used DESC
        LIMIT 20
      `;

      const rows = await this.database.all(query, [`%${domain}%`, `%${context.pageType}%`]);
      
      const patterns: InteractionPattern[] = rows.map(row => ({
        id: row.id,
        sitePattern: row.site_pattern,
        taskType: row.task_type,
        successfulActions: JSON.parse(row.successful_actions),
        contextConditions: JSON.parse(row.context_conditions),
        reliability: row.reliability,
        lastUsed: new Date(row.last_used),
        usageCount: row.usage_count,
        createdAt: new Date(row.created_at),
        tags: JSON.parse(row.tags)
      }));

      // Filter patterns using AI for better relevance
      const relevantPatterns = await this.filterPatternsByRelevance(patterns, context);

      // Cache results
      this.memoryCache.set(cacheKey, {
        data: relevantPatterns,
        timestamp: Date.now()
      });

      return relevantPatterns;
    } catch (error) {
      this.logger.error('Failed to retrieve relevant patterns:', error);
      return [];
    }
  }

  async updateTaskProgress(taskId: string, progress: TaskProgress): Promise<void> {
    try {
      const query = `
        INSERT OR REPLACE INTO task_progress 
        (task_id, current_step, total_steps, completed_objectives, pending_objectives,
         encountered_obstacles, adaptations_made, start_time, last_updated, 
         estimated_completion, confidence)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      await this.database.run(query, [
        progress.taskId,
        progress.currentStep,
        progress.totalSteps,
        JSON.stringify(progress.completedObjectives),
        JSON.stringify(progress.pendingObjectives),
        JSON.stringify(progress.encounteredObstacles),
        JSON.stringify(progress.adaptationsMade),
        progress.startTime.toISOString(),
        progress.lastUpdated.toISOString(),
        progress.estimatedCompletion.toISOString(),
        progress.confidence
      ]);

      // Update cache
      this.memoryCache.set(`progress_${taskId}`, {
        data: progress,
        timestamp: Date.now()
      });

      this.logger.info(`Updated task progress for: ${taskId}`);
    } catch (error) {
      this.logger.error('Failed to update task progress:', error);
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
        insight: analysis.insight || 'Failed to generate insight',
        confidence: analysis.confidence || 0.6,
        applicability: analysis.applicability || {
          domains: [new URL(failure.context.url).hostname],
          pageTypes: [failure.context.pageType],
          actionTypes: [failure.action.type],
          conditions: []
        },
        evidence: [{
          type: 'error_reduction',
          value: 1,
          description: `Failure analysis for ${failure.action.type}`,
          timestamp: new Date()
        }],
        timestamp: new Date(),
        validated: false
      };

      // Store the learning insight
      await this.storeLearningInsight(insight);

      return insight;
    } catch (error) {
      this.logger.error('Failed to learn from failure:', error);
      
      // Return fallback insight
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
        evidence: [],
        timestamp: new Date(),
        validated: false
      };
    }
  }

  async generalizePattern(specificPattern: InteractionPattern): Promise<GeneralPattern> {
    try {
      const prompt = this.createPatternGeneralizationPrompt(specificPattern);
      const response = await this.aiProvider.generateCompletion(prompt, {
        temperature: 0.2,
        maxTokens: 1000
      });

      const generalization = JSON.parse(response);
      
      const generalPattern: GeneralPattern = {
        id: `general_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: generalization.name || `Generalized ${specificPattern.taskType}`,
        description: generalization.description || 'Generalized pattern',
        applicableScenarios: generalization.applicableScenarios || [specificPattern.taskType],
        actionTemplate: generalization.actionTemplate || [],
        successPredictors: generalization.successPredictors || [],
        reliability: Math.max(0.5, specificPattern.reliability - 0.1), // Slightly lower reliability for generalized patterns
        createdFrom: [specificPattern.id],
        lastValidated: new Date()
      };

      // Store the general pattern
      await this.storeGeneralPattern(generalPattern);

      return generalPattern;
    } catch (error) {
      this.logger.error('Failed to generalize pattern:', error);
      throw error;
    }
  }

  async getTaskProgress(taskId: string): Promise<TaskProgress | null> {
    try {
      // Check cache first
      const cached = this.memoryCache.get(`progress_${taskId}`);
      if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
        return cached.data;
      }

      const query = 'SELECT * FROM task_progress WHERE task_id = ?';
      const row = await this.database.get(query, [taskId]);

      if (!row) {
        return null;
      }

      const progress: TaskProgress = {
        taskId: row.task_id,
        currentStep: row.current_step,
        totalSteps: row.total_steps,
        completedObjectives: JSON.parse(row.completed_objectives),
        pendingObjectives: JSON.parse(row.pending_objectives),
        encounteredObstacles: JSON.parse(row.encountered_obstacles),
        adaptationsMade: JSON.parse(row.adaptations_made),
        startTime: new Date(row.start_time),
        lastUpdated: new Date(row.last_updated),
        estimatedCompletion: new Date(row.estimated_completion),
        confidence: row.confidence
      };

      // Cache result
      this.memoryCache.set(`progress_${taskId}`, {
        data: progress,
        timestamp: Date.now()
      });

      return progress;
    } catch (error) {
      this.logger.error('Failed to get task progress:', error);
      return null;
    }
  }

  async storeSiteSpecificLearning(learning: SiteSpecificLearning): Promise<void> {
    try {
      const query = `
        INSERT OR REPLACE INTO site_specific_learnings 
        (id, domain, subdomain, patterns, common_issues, optimizations,
         last_updated, reliability, usage_frequency)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      await this.database.run(query, [
        learning.id,
        learning.domain,
        learning.subdomain || null,
        JSON.stringify(learning.patterns),
        JSON.stringify(learning.commonIssues),
        JSON.stringify(learning.optimizations),
        learning.lastUpdated.toISOString(),
        learning.reliability,
        learning.usageFrequency
      ]);

      this.logger.info(`Stored site-specific learning for: ${learning.domain}`);
    } catch (error) {
      this.logger.error('Failed to store site-specific learning:', error);
      throw error;
    }
  }

  async getSiteSpecificLearnings(domain: string): Promise<SiteSpecificLearning[]> {
    try {
      const query = 'SELECT * FROM site_specific_learnings WHERE domain = ? OR domain LIKE ?';
      const rows = await this.database.all(query, [domain, `%.${domain}`]);

      return rows.map(row => ({
        id: row.id,
        domain: row.domain,
        subdomain: row.subdomain,
        patterns: JSON.parse(row.patterns),
        commonIssues: JSON.parse(row.common_issues),
        optimizations: JSON.parse(row.optimizations),
        lastUpdated: new Date(row.last_updated),
        reliability: row.reliability,
        usageFrequency: row.usage_frequency
      }));
    } catch (error) {
      this.logger.error('Failed to get site-specific learnings:', error);
      return [];
    }
  }

  async cleanupMemory(): Promise<void> {
    try {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      
      // Remove old, low-reliability patterns
      await this.database.run(`
        DELETE FROM interaction_patterns 
        WHERE reliability < ? AND last_used < ?
      `, [this.RELIABILITY_THRESHOLD, thirtyDaysAgo.toISOString()]);

      // Remove old task progress entries
      await this.database.run(`
        DELETE FROM task_progress 
        WHERE last_updated < ?
      `, [thirtyDaysAgo.toISOString()]);

      // Clear cache
      this.memoryCache.clear();

      this.logger.info('Memory cleanup completed');
    } catch (error) {
      this.logger.error('Failed to cleanup memory:', error);
    }
  }

  async getMemoryStats(): Promise<MemoryStats> {
    try {
      const patternCount = await this.database.get('SELECT COUNT(*) as count FROM interaction_patterns');
      const learningCount = await this.database.get('SELECT COUNT(*) as count FROM learning_insights');
      const taskCount = await this.database.get('SELECT COUNT(*) as count FROM task_progress');
      
      const avgReliability = await this.database.get(`
        SELECT AVG(reliability) as avg FROM interaction_patterns
      `);

      const oldestEntry = await this.database.get(`
        SELECT MIN(created_at) as oldest FROM interaction_patterns
      `);

      const newestEntry = await this.database.get(`
        SELECT MAX(created_at) as newest FROM interaction_patterns
      `);

      const topDomains = await this.database.all(`
        SELECT site_pattern as domain, COUNT(*) as pattern_count, 
               AVG(reliability) as reliability, MAX(last_used) as last_accessed
        FROM interaction_patterns 
        GROUP BY site_pattern 
        ORDER BY pattern_count DESC 
        LIMIT 10
      `);

      return {
        totalPatterns: patternCount?.count || 0,
        totalLearnings: learningCount?.count || 0,
        totalTasks: taskCount?.count || 0,
        memoryUsage: this.memoryCache.size * 1024, // Rough estimate
        oldestEntry: oldestEntry?.oldest ? new Date(oldestEntry.oldest) : new Date(),
        newestEntry: newestEntry?.newest ? new Date(newestEntry.newest) : new Date(),
        averageReliability: avgReliability?.avg || 0,
        topDomains: topDomains.map(row => ({
          domain: row.domain,
          patternCount: row.pattern_count,
          successRate: row.reliability,
          lastAccessed: new Date(row.last_accessed),
          reliability: row.reliability
        })),
        cleanupRecommended: (patternCount?.count || 0) > this.MAX_PATTERNS_PER_DOMAIN * 10
      };
    } catch (error) {
      this.logger.error('Failed to get memory stats:', error);
      return {
        totalPatterns: 0,
        totalLearnings: 0,
        totalTasks: 0,
        memoryUsage: 0,
        oldestEntry: new Date(),
        newestEntry: new Date(),
        averageReliability: 0,
        topDomains: [],
        cleanupRecommended: false
      };
    }
  }

  // Private helper methods
  private async filterPatternsByRelevance(patterns: InteractionPattern[], context: TaskContext): Promise<InteractionPattern[]> {
    try {
      if (patterns.length === 0) return patterns;

      const prompt = this.createRelevanceFilterPrompt(patterns, context);
      const response = await this.aiProvider.generateCompletion(prompt, {
        temperature: 0.1,
        maxTokens: 500
      });

      const analysis = JSON.parse(response);
      const relevantIds = analysis.relevantPatternIds || patterns.map(p => p.id);

      return patterns.filter(pattern => relevantIds.includes(pattern.id));
    } catch (error) {
      this.logger.error('Failed to filter patterns by relevance:', error);
      return patterns; // Return all patterns if filtering fails
    }
  }

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
  }

  private async storeGeneralPattern(pattern: GeneralPattern): Promise<void> {
    const query = `
      INSERT OR REPLACE INTO general_patterns 
      (id, name, description, applicable_scenarios, action_template, 
       success_predictors, reliability, created_from, last_validated)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    await this.database.run(query, [
      pattern.id,
      pattern.name,
      pattern.description,
      JSON.stringify(pattern.applicableScenarios),
      JSON.stringify(pattern.actionTemplate),
      JSON.stringify(pattern.successPredictors),
      pattern.reliability,
      JSON.stringify(pattern.createdFrom),
      pattern.lastValidated.toISOString()
    ]);
  }

  private createFailureAnalysisPrompt(failure: ActionFailure): string {
    return `
Analyze this automation failure and provide learning insights.

Failure Details:
- Action: ${failure.action.type}
- Target: ${JSON.stringify(failure.action.target)}
- Error: ${failure.error.message}
- Context: ${failure.context.url}
- Attempt: ${failure.attemptNumber}

Provide analysis in JSON format:
{
  "insight": "Key learning from this failure",
  "confidence": 0.8,
  "applicability": {
    "domains": ["domain.com"],
    "pageTypes": ["form"],
    "actionTypes": ["click"],
    "conditions": []
  }
}`;
  }

  private createPatternGeneralizationPrompt(pattern: InteractionPattern): string {
    return `
Generalize this specific interaction pattern for broader applicability.

Pattern Details:
- Site: ${pattern.sitePattern}
- Task: ${pattern.taskType}
- Actions: ${JSON.stringify(pattern.successfulActions)}
- Reliability: ${pattern.reliability}

Create a generalized pattern in JSON format:
{
  "name": "Generalized pattern name",
  "description": "What this pattern accomplishes",
  "applicableScenarios": ["scenario1", "scenario2"],
  "actionTemplate": [
    {
      "step": 1,
      "actionType": "click",
      "targetPattern": "button[type='submit']",
      "conditions": [],
      "alternatives": []
    }
  ],
  "successPredictors": [
    {
      "factor": "element_visibility",
      "weight": 0.8,
      "threshold": 0.9,
      "operator": "greater_than"
    }
  ]
}`;
  }

  private createRelevanceFilterPrompt(patterns: InteractionPattern[], context: TaskContext): string {
    return `
Filter these patterns by relevance to the current task context.

Context:
- URL: ${context.currentUrl}
- Task: ${context.objective}
- Page Type: ${context.pageType}

Patterns:
${patterns.map(p => `- ${p.id}: ${p.taskType} on ${p.sitePattern}`).join('\n')}

Return JSON with relevant pattern IDs:
{
  "relevantPatternIds": ["pattern1", "pattern2"]
}`;
  }
}