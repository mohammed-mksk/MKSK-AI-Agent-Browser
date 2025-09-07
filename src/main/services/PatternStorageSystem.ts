import {
  InteractionPattern,
  ActionSequence,
  ContextCondition,
  GeneralPattern,
  ActionTemplate,
  SuccessPredictor,
  PatternType
} from '../interfaces/IMemorySystem.js';
import { DatabaseService } from './DatabaseService.js';
import { Logger } from './Logger.js';

export interface PatternStorageConfig {
  maxPatternsPerDomain: number;
  reliabilityThreshold: number;
  cleanupIntervalMs: number;
  compressionEnabled: boolean;
}

export interface PatternQuery {
  domain?: string;
  taskType?: string;
  minReliability?: number;
  maxAge?: number; // in days
  tags?: string[];
  limit?: number;
}

export interface PatternMatchResult {
  pattern: InteractionPattern;
  matchScore: number;
  matchReasons: string[];
}

export class PatternStorageSystem {
  private database: DatabaseService;
  private logger: Logger;
  private config: PatternStorageConfig;
  private patternCache: Map<string, InteractionPattern> = new Map();
  private readonly CACHE_TTL = 300000; // 5 minutes

  constructor(database: DatabaseService, config?: Partial<PatternStorageConfig>) {
    this.database = database;
    this.logger = new Logger();
    this.config = {
      maxPatternsPerDomain: 100,
      reliabilityThreshold: 0.7,
      cleanupIntervalMs: 24 * 60 * 60 * 1000, // 24 hours
      compressionEnabled: true,
      ...config
    };

    this.initializeStorage();
    this.startCleanupScheduler();
  }

  private async initializeStorage(): Promise<void> {
    try {
      // Create patterns table with indexes for performance
      await this.database.run(`
        CREATE TABLE IF NOT EXISTS patterns (
          id TEXT PRIMARY KEY,
          site_pattern TEXT NOT NULL,
          task_type TEXT NOT NULL,
          successful_actions TEXT NOT NULL,
          context_conditions TEXT NOT NULL,
          reliability REAL NOT NULL,
          last_used TEXT NOT NULL,
          usage_count INTEGER NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          tags TEXT NOT NULL,
          compressed INTEGER DEFAULT 0
        )
      `);

      // Create indexes for efficient querying
      await this.database.run(`
        CREATE INDEX IF NOT EXISTS idx_patterns_site_pattern ON patterns(site_pattern)
      `);
      
      await this.database.run(`
        CREATE INDEX IF NOT EXISTS idx_patterns_task_type ON patterns(task_type)
      `);
      
      await this.database.run(`
        CREATE INDEX IF NOT EXISTS idx_patterns_reliability ON patterns(reliability)
      `);
      
      await this.database.run(`
        CREATE INDEX IF NOT EXISTS idx_patterns_last_used ON patterns(last_used)
      `);

      // Create general patterns table
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
          last_validated TEXT NOT NULL,
          usage_count INTEGER DEFAULT 0
        )
      `);

      // Create pattern relationships table for tracking pattern evolution
      await this.database.run(`
        CREATE TABLE IF NOT EXISTS pattern_relationships (
          id TEXT PRIMARY KEY,
          parent_pattern_id TEXT NOT NULL,
          child_pattern_id TEXT NOT NULL,
          relationship_type TEXT NOT NULL,
          created_at TEXT NOT NULL,
          FOREIGN KEY (parent_pattern_id) REFERENCES patterns(id),
          FOREIGN KEY (child_pattern_id) REFERENCES patterns(id)
        )
      `);

      this.logger.info('Pattern storage system initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize pattern storage:', error);
      throw error;
    }
  }

  async storePattern(pattern: InteractionPattern): Promise<void> {
    try {
      const now = new Date().toISOString();
      const compressed = this.config.compressionEnabled ? 1 : 0;

      const query = `
        INSERT OR REPLACE INTO patterns 
        (id, site_pattern, task_type, successful_actions, context_conditions, 
         reliability, last_used, usage_count, created_at, updated_at, tags, compressed)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      const successfulActions = this.config.compressionEnabled 
        ? this.compressActionData(pattern.successfulActions)
        : JSON.stringify(pattern.successfulActions);

      await this.database.run(query, [
        pattern.id,
        pattern.sitePattern,
        pattern.taskType,
        successfulActions,
        JSON.stringify(pattern.contextConditions),
        pattern.reliability,
        pattern.lastUsed.toISOString(),
        pattern.usageCount,
        pattern.createdAt.toISOString(),
        now,
        JSON.stringify(pattern.tags),
        compressed
      ]);

      // Update cache
      this.patternCache.set(pattern.id, pattern);

      // Check if we need to cleanup patterns for this domain
      await this.checkDomainPatternLimit(pattern.sitePattern);

      this.logger.info(`Stored pattern: ${pattern.id} for ${pattern.sitePattern}`);
    } catch (error) {
      this.logger.error('Failed to store pattern:', error);
      throw error;
    }
  }

  async retrievePattern(patternId: string): Promise<InteractionPattern | null> {
    try {
      // Check cache first
      if (this.patternCache.has(patternId)) {
        return this.patternCache.get(patternId) || null;
      }

      const query = 'SELECT * FROM patterns WHERE id = ?';
      const row = await this.database.get(query, [patternId]);

      if (!row) {
        return null;
      }

      const pattern = this.rowToPattern(row);
      
      // Cache the result
      this.patternCache.set(patternId, pattern);

      return pattern;
    } catch (error) {
      this.logger.error('Failed to retrieve pattern:', error);
      return null;
    }
  }

  async queryPatterns(query: PatternQuery): Promise<InteractionPattern[]> {
    try {
      let sql = 'SELECT * FROM patterns WHERE 1=1';
      const params: any[] = [];

      if (query.domain) {
        sql += ' AND site_pattern LIKE ?';
        params.push(`%${query.domain}%`);
      }

      if (query.taskType) {
        sql += ' AND task_type = ?';
        params.push(query.taskType);
      }

      if (query.minReliability) {
        sql += ' AND reliability >= ?';
        params.push(query.minReliability);
      }

      if (query.maxAge) {
        const cutoffDate = new Date(Date.now() - query.maxAge * 24 * 60 * 60 * 1000);
        sql += ' AND last_used >= ?';
        params.push(cutoffDate.toISOString());
      }

      if (query.tags && query.tags.length > 0) {
        const tagConditions = query.tags.map(() => 'tags LIKE ?').join(' OR ');
        sql += ` AND (${tagConditions})`;
        query.tags.forEach(tag => params.push(`%"${tag}"%`));
      }

      sql += ' ORDER BY reliability DESC, usage_count DESC, last_used DESC';

      if (query.limit) {
        sql += ' LIMIT ?';
        params.push(query.limit);
      }

      const rows = await this.database.all(sql, params);
      return rows.map(row => this.rowToPattern(row));
    } catch (error) {
      this.logger.error('Failed to query patterns:', error);
      return [];
    }
  }

  async findSimilarPatterns(pattern: InteractionPattern, threshold: number = 0.8): Promise<PatternMatchResult[]> {
    try {
      // Query patterns from the same domain and task type
      const candidates = await this.queryPatterns({
        domain: new URL(`http://${pattern.sitePattern}`).hostname,
        taskType: pattern.taskType,
        minReliability: this.config.reliabilityThreshold
      });

      const matches: PatternMatchResult[] = [];

      for (const candidate of candidates) {
        if (candidate.id === pattern.id) continue;

        const matchResult = this.calculatePatternSimilarity(pattern, candidate);
        if (matchResult.matchScore >= threshold) {
          matches.push(matchResult);
        }
      }

      // Sort by match score descending
      matches.sort((a, b) => b.matchScore - a.matchScore);

      return matches;
    } catch (error) {
      this.logger.error('Failed to find similar patterns:', error);
      return [];
    }
  }

  async updatePatternUsage(patternId: string): Promise<void> {
    try {
      const query = `
        UPDATE patterns 
        SET usage_count = usage_count + 1, last_used = ?, updated_at = ?
        WHERE id = ?
      `;

      const now = new Date().toISOString();
      await this.database.run(query, [now, now, patternId]);

      // Update cache if present
      const cachedPattern = this.patternCache.get(patternId);
      if (cachedPattern) {
        cachedPattern.usageCount += 1;
        cachedPattern.lastUsed = new Date();
      }

      this.logger.debug(`Updated usage for pattern: ${patternId}`);
    } catch (error) {
      this.logger.error('Failed to update pattern usage:', error);
    }
  }

  async updatePatternReliability(patternId: string, newReliability: number): Promise<void> {
    try {
      const query = `
        UPDATE patterns 
        SET reliability = ?, updated_at = ?
        WHERE id = ?
      `;

      const now = new Date().toISOString();
      await this.database.run(query, [newReliability, now, patternId]);

      // Update cache if present
      const cachedPattern = this.patternCache.get(patternId);
      if (cachedPattern) {
        cachedPattern.reliability = newReliability;
      }

      this.logger.info(`Updated reliability for pattern ${patternId}: ${newReliability}`);
    } catch (error) {
      this.logger.error('Failed to update pattern reliability:', error);
    }
  }

  async deletePattern(patternId: string): Promise<void> {
    try {
      await this.database.run('DELETE FROM patterns WHERE id = ?', [patternId]);
      await this.database.run('DELETE FROM pattern_relationships WHERE parent_pattern_id = ? OR child_pattern_id = ?', [patternId, patternId]);
      
      this.patternCache.delete(patternId);
      
      this.logger.info(`Deleted pattern: ${patternId}`);
    } catch (error) {
      this.logger.error('Failed to delete pattern:', error);
      throw error;
    }
  }

  async storeGeneralPattern(pattern: GeneralPattern): Promise<void> {
    try {
      const query = `
        INSERT OR REPLACE INTO general_patterns 
        (id, name, description, applicable_scenarios, action_template, 
         success_predictors, reliability, created_from, last_validated, usage_count)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        pattern.lastValidated.toISOString(),
        0
      ]);

      this.logger.info(`Stored general pattern: ${pattern.id}`);
    } catch (error) {
      this.logger.error('Failed to store general pattern:', error);
      throw error;
    }
  }

  async getStorageStats(): Promise<{
    totalPatterns: number;
    totalGeneralPatterns: number;
    averageReliability: number;
    oldestPattern: Date | null;
    newestPattern: Date | null;
    topDomains: { domain: string; count: number }[];
    cacheHitRate: number;
  }> {
    try {
      const totalPatterns = await this.database.get('SELECT COUNT(*) as count FROM patterns');
      const totalGeneralPatterns = await this.database.get('SELECT COUNT(*) as count FROM general_patterns');
      const avgReliability = await this.database.get('SELECT AVG(reliability) as avg FROM patterns');
      const oldestPattern = await this.database.get('SELECT MIN(created_at) as oldest FROM patterns');
      const newestPattern = await this.database.get('SELECT MAX(created_at) as newest FROM patterns');
      
      const topDomains = await this.database.all(`
        SELECT site_pattern as domain, COUNT(*) as count 
        FROM patterns 
        GROUP BY site_pattern 
        ORDER BY count DESC 
        LIMIT 10
      `);

      return {
        totalPatterns: totalPatterns?.count || 0,
        totalGeneralPatterns: totalGeneralPatterns?.count || 0,
        averageReliability: avgReliability?.avg || 0,
        oldestPattern: oldestPattern?.oldest ? new Date(oldestPattern.oldest) : null,
        newestPattern: newestPattern?.newest ? new Date(newestPattern.newest) : null,
        topDomains: topDomains.map(row => ({ domain: row.domain, count: row.count })),
        cacheHitRate: 0.85 // Placeholder - would need actual tracking
      };
    } catch (error) {
      this.logger.error('Failed to get storage stats:', error);
      return {
        totalPatterns: 0,
        totalGeneralPatterns: 0,
        averageReliability: 0,
        oldestPattern: null,
        newestPattern: null,
        topDomains: [],
        cacheHitRate: 0
      };
    }
  }

  async cleanup(): Promise<void> {
    try {
      const cutoffDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
      
      // Remove old, low-reliability patterns
      await this.database.run(`
        DELETE FROM patterns 
        WHERE reliability < ? AND last_used < ?
      `, [this.config.reliabilityThreshold, cutoffDate.toISOString()]);

      // Clear cache
      this.patternCache.clear();

      this.logger.info('Pattern storage cleanup completed');
    } catch (error) {
      this.logger.error('Failed to cleanup pattern storage:', error);
    }
  }

  // Private helper methods
  private rowToPattern(row: any): InteractionPattern {
    const successfulActions = row.compressed 
      ? this.decompressActionData(row.successful_actions)
      : JSON.parse(row.successful_actions);

    return {
      id: row.id,
      sitePattern: row.site_pattern,
      taskType: row.task_type,
      successfulActions,
      contextConditions: JSON.parse(row.context_conditions),
      reliability: row.reliability,
      lastUsed: new Date(row.last_used),
      usageCount: row.usage_count,
      createdAt: new Date(row.created_at),
      tags: JSON.parse(row.tags)
    };
  }

  private calculatePatternSimilarity(pattern1: InteractionPattern, pattern2: InteractionPattern): PatternMatchResult {
    let score = 0;
    const reasons: string[] = [];

    // Task type match (high weight)
    if (pattern1.taskType === pattern2.taskType) {
      score += 0.3;
      reasons.push('Same task type');
    }

    // Site pattern similarity
    const domain1 = this.extractDomain(pattern1.sitePattern);
    const domain2 = this.extractDomain(pattern2.sitePattern);
    if (domain1 === domain2) {
      score += 0.2;
      reasons.push('Same domain');
    }

    // Action sequence similarity
    const actionSimilarity = this.calculateActionSequenceSimilarity(
      pattern1.successfulActions,
      pattern2.successfulActions
    );
    score += actionSimilarity * 0.3;
    if (actionSimilarity > 0.5) {
      reasons.push('Similar action sequences');
    }

    // Context conditions similarity
    const contextSimilarity = this.calculateContextSimilarity(
      pattern1.contextConditions,
      pattern2.contextConditions
    );
    score += contextSimilarity * 0.2;
    if (contextSimilarity > 0.5) {
      reasons.push('Similar context conditions');
    }

    return {
      pattern: pattern2,
      matchScore: Math.min(score, 1.0),
      matchReasons: reasons
    };
  }

  private calculateActionSequenceSimilarity(actions1: ActionSequence[], actions2: ActionSequence[]): number {
    if (actions1.length === 0 && actions2.length === 0) return 1.0;
    if (actions1.length === 0 || actions2.length === 0) return 0.0;

    let totalSimilarity = 0;
    const maxLength = Math.max(actions1.length, actions2.length);

    for (let i = 0; i < maxLength; i++) {
      const seq1 = actions1[i];
      const seq2 = actions2[i];

      if (!seq1 || !seq2) {
        continue; // No match for this position
      }

      // Compare action types in sequences
      const types1 = seq1.actions.map(a => a.type);
      const types2 = seq2.actions.map(a => a.type);
      
      const commonTypes = types1.filter(type => types2.includes(type));
      const sequenceSimilarity = commonTypes.length / Math.max(types1.length, types2.length);
      
      totalSimilarity += sequenceSimilarity;
    }

    return totalSimilarity / maxLength;
  }

  private calculateContextSimilarity(conditions1: ContextCondition[], conditions2: ContextCondition[]): number {
    if (conditions1.length === 0 && conditions2.length === 0) return 1.0;
    if (conditions1.length === 0 || conditions2.length === 0) return 0.0;

    let matches = 0;
    const totalConditions = Math.max(conditions1.length, conditions2.length);

    for (const cond1 of conditions1) {
      for (const cond2 of conditions2) {
        if (cond1.type === cond2.type && cond1.operator === cond2.operator) {
          if (cond1.value === cond2.value || cond1.value.includes(cond2.value) || cond2.value.includes(cond1.value)) {
            matches++;
            break;
          }
        }
      }
    }

    return matches / totalConditions;
  }

  private extractDomain(sitePattern: string): string {
    try {
      return new URL(`http://${sitePattern}`).hostname;
    } catch {
      return sitePattern;
    }
  }

  private compressActionData(actions: ActionSequence[]): string {
    // Simple compression - in production, could use more sophisticated compression
    const compressed = actions.map(seq => ({
      id: seq.id,
      actions: seq.actions.map(a => ({ type: a.type, target: a.target })),
      successRate: seq.successRate
    }));
    return JSON.stringify(compressed);
  }

  private decompressActionData(compressedData: string): ActionSequence[] {
    try {
      const compressed = JSON.parse(compressedData);
      return compressed.map((seq: any) => ({
        id: seq.id,
        actions: seq.actions.map((a: any) => ({
          type: a.type,
          target: a.target,
          value: '',
          timeout: 10000,
          retryCount: 3
        })),
        context: {
          url: '',
          pageType: '',
          viewport: { width: 1920, height: 1080 },
          userAgent: '',
          timestamp: new Date(),
          sessionId: ''
        },
        successRate: seq.successRate || 0.8,
        averageDuration: 1000,
        lastExecuted: new Date()
      }));
    } catch {
      return [];
    }
  }

  private async checkDomainPatternLimit(sitePattern: string): Promise<void> {
    try {
      const count = await this.database.get(
        'SELECT COUNT(*) as count FROM patterns WHERE site_pattern = ?',
        [sitePattern]
      );

      if (count && count.count > this.config.maxPatternsPerDomain) {
        // Remove oldest, least reliable patterns
        await this.database.run(`
          DELETE FROM patterns 
          WHERE site_pattern = ? 
          AND id IN (
            SELECT id FROM patterns 
            WHERE site_pattern = ? 
            ORDER BY reliability ASC, last_used ASC 
            LIMIT ?
          )
        `, [sitePattern, sitePattern, count.count - this.config.maxPatternsPerDomain]);

        this.logger.info(`Cleaned up excess patterns for domain: ${sitePattern}`);
      }
    } catch (error) {
      this.logger.error('Failed to check domain pattern limit:', error);
    }
  }

  private startCleanupScheduler(): void {
    setInterval(() => {
      this.cleanup().catch(error => {
        this.logger.error('Scheduled cleanup failed:', error);
      });
    }, this.config.cleanupIntervalMs);
  }
}