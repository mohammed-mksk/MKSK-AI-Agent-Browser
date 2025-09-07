import { EventEmitter } from 'events';
import { PerformanceOptimizationSystem, PerformanceMetrics } from './PerformanceOptimizationSystem';

export interface CacheStrategy {
  name: string;
  description: string;
  shouldCache: (key: string, value: any, context: CacheContext) => boolean;
  getTTL: (key: string, value: any, context: CacheContext) => number;
  getPriority: (key: string, value: any, context: CacheContext) => number;
}

export interface CacheContext {
  taskType: string;
  sitePattern: string;
  frequency: number;
  lastAccess: number;
  size: number;
}

export interface OptimizationRule {
  name: string;
  condition: (metrics: PerformanceMetrics, cache: Map<string, any>) => boolean;
  action: (system: CachingOptimizationSystem) => Promise<OptimizationResult>;
  cooldown: number;
  lastExecuted: number;
}

export interface OptimizationResult {
  success: boolean;
  description: string;
  metricsImprovement: Partial<PerformanceMetrics>;
  resourcesFreed: number;
}

export interface CacheInvalidationRule {
  pattern: RegExp;
  condition: (entry: any, age: number) => boolean;
  reason: string;
}

export class CachingOptimizationSystem extends EventEmitter {
  private performanceSystem: PerformanceOptimizationSystem;
  private cacheStrategies: Map<string, CacheStrategy> = new Map();
  private optimizationRules: OptimizationRule[] = [];
  private invalidationRules: CacheInvalidationRule[] = [];
  private cacheStats: Map<string, CacheStatistics> = new Map();
  private optimizationHistory: OptimizationResult[] = [];

  constructor(performanceSystem: PerformanceOptimizationSystem) {
    super();
    this.performanceSystem = performanceSystem;
    this.setupDefaultStrategies();
    this.setupOptimizationRules();
    this.setupInvalidationRules();
    this.startOptimizationLoop();
  }

  private setupDefaultStrategies(): void {
    // Element Discovery Cache Strategy
    this.cacheStrategies.set('element-discovery', {
      name: 'Element Discovery Cache',
      description: 'Cache element discovery results for pages',
      shouldCache: (key, value, context) => {
        return context.taskType === 'element-discovery' && 
               value && 
               Object.keys(value).length > 0;
      },
      getTTL: (key, value, context) => {
        // Dynamic pages get shorter TTL
        if (context.sitePattern.includes('dynamic') || 
            context.sitePattern.includes('spa')) {
          return 300000; // 5 minutes
        }
        return 1800000; // 30 minutes for static pages
      },
      getPriority: (key, value, context) => {
        return context.frequency * 10 + (context.size > 1000 ? 5 : 0);
      }
    });

    // Page Structure Cache Strategy
    this.cacheStrategies.set('page-structure', {
      name: 'Page Structure Cache',
      description: 'Cache page structure analysis results',
      shouldCache: (key, value, context) => {
        return context.taskType === 'page-analysis' && 
               value.pageType && 
               value.mainSections;
      },
      getTTL: (key, value, context) => {
        return 3600000; // 1 hour - page structures change less frequently
      },
      getPriority: (key, value, context) => {
        return context.frequency * 15; // Higher priority for structure
      }
    });

    // Action Pattern Cache Strategy
    this.cacheStrategies.set('action-patterns', {
      name: 'Action Pattern Cache',
      description: 'Cache successful action patterns',
      shouldCache: (key, value, context) => {
        return context.taskType === 'action-pattern' && 
               value.success && 
               value.reliability > 0.8;
      },
      getTTL: (key, value, context) => {
        return 7200000; // 2 hours - patterns are valuable
      },
      getPriority: (key, value, context) => {
        return context.frequency * 20 + value.reliability * 10;
      }
    });

    // AI Reasoning Cache Strategy
    this.cacheStrategies.set('ai-reasoning', {
      name: 'AI Reasoning Cache',
      description: 'Cache AI reasoning results for similar contexts',
      shouldCache: (key, value, context) => {
        return context.taskType === 'ai-reasoning' && 
               value.confidence > 0.7;
      },
      getTTL: (key, value, context) => {
        return 1800000; // 30 minutes - reasoning can become stale
      },
      getPriority: (key, value, context) => {
        return context.frequency * 25 + value.confidence * 10;
      }
    });
  }

  private setupOptimizationRules(): void {
    this.optimizationRules = [
      {
        name: 'Low Hit Rate Cleanup',
        condition: (metrics, cache) => {
          return metrics.cacheHitRate < 0.3 && cache.size > 100;
        },
        action: async (system) => await system.cleanupLowHitRateEntries(),
        cooldown: 300000, // 5 minutes
        lastExecuted: 0
      },
      {
        name: 'Memory Pressure Relief',
        condition: (metrics, cache) => {
          return metrics.memoryUsage > 800 && cache.size > 50;
        },
        action: async (system) => await system.performMemoryPressureCleanup(),
        cooldown: 60000, // 1 minute
        lastExecuted: 0
      },
      {
        name: 'Stale Entry Removal',
        condition: (metrics, cache) => {
          return cache.size > 200;
        },
        action: async (system) => await system.removeStaleEntries(),
        cooldown: 600000, // 10 minutes
        lastExecuted: 0
      },
      {
        name: 'Cache Prewarming',
        condition: (metrics, cache) => {
          return metrics.cacheHitRate > 0.8 && 
                 metrics.actionSuccessRate > 0.9 && 
                 cache.size < 50;
        },
        action: async (system) => await system.prewarmFrequentPatterns(),
        cooldown: 1800000, // 30 minutes
        lastExecuted: 0
      }
    ];
  }

  private setupInvalidationRules(): void {
    this.invalidationRules = [
      {
        pattern: /^element-discovery:.+/,
        condition: (entry, age) => {
          return age > 1800000 || // 30 minutes
                 (entry.dynamic && age > 300000); // 5 minutes for dynamic
        },
        reason: 'Element discovery data expired'
      },
      {
        pattern: /^page-structure:.+/,
        condition: (entry, age) => {
          return age > 3600000; // 1 hour
        },
        reason: 'Page structure analysis expired'
      },
      {
        pattern: /^action-pattern:.+/,
        condition: (entry, age) => {
          return age > 7200000 || // 2 hours
                 entry.reliability < 0.5;
        },
        reason: 'Action pattern unreliable or expired'
      },
      {
        pattern: /^ai-reasoning:.+/,
        condition: (entry, age) => {
          return age > 1800000 || // 30 minutes
                 entry.confidence < 0.6;
        },
        reason: 'AI reasoning result expired or low confidence'
      }
    ];
  }

  private startOptimizationLoop(): void {
    setInterval(async () => {
      await this.runOptimizationCycle();
    }, 30000); // Run every 30 seconds
  }

  private async runOptimizationCycle(): Promise<void> {
    try {
      const metrics = this.performanceSystem.getMetrics();
      const cache = this.getCacheReference();

      for (const rule of this.optimizationRules) {
        const now = Date.now();
        
        if (now - rule.lastExecuted < rule.cooldown) {
          continue; // Still in cooldown
        }

        if (rule.condition(metrics, cache)) {
          console.log(`Applying optimization rule: ${rule.name}`);
          
          const result = await rule.action(this);
          rule.lastExecuted = now;
          
          this.optimizationHistory.push(result);
          this.emit('optimizationApplied', { rule: rule.name, result });
          
          // Keep only last 100 optimization results
          if (this.optimizationHistory.length > 100) {
            this.optimizationHistory.shift();
          }
        }
      }

      await this.applyInvalidationRules();
    } catch (error) {
      console.error('Error in optimization cycle:', error);
      this.emit('optimizationError', error);
    }
  }

  private async applyInvalidationRules(): Promise<void> {
    const cache = this.getCacheReference();
    const now = Date.now();
    let invalidatedCount = 0;

    for (const [key, entry] of cache.entries()) {
      const age = now - entry.timestamp;

      for (const rule of this.invalidationRules) {
        if (rule.pattern.test(key) && rule.condition(entry.value, age)) {
          await this.performanceSystem.cacheDelete(key);
          invalidatedCount++;
          
          console.log(`Invalidated cache entry: ${key} - ${rule.reason}`);
          break;
        }
      }
    }

    if (invalidatedCount > 0) {
      this.emit('cacheInvalidated', { count: invalidatedCount });
    }
  }

  // Smart caching methods
  public async smartCacheSet(
    key: string, 
    value: any, 
    context: CacheContext
  ): Promise<boolean> {
    const strategy = this.cacheStrategies.get(context.taskType);
    
    if (!strategy) {
      // Use default caching
      await this.performanceSystem.cacheSet(key, value);
      return true;
    }

    if (!strategy.shouldCache(key, value, context)) {
      return false; // Don't cache this item
    }

    const ttl = strategy.getTTL(key, value, context);
    const priority = strategy.getPriority(key, value, context);

    // Store with enhanced metadata
    const enhancedValue = {
      ...value,
      _cacheMetadata: {
        strategy: strategy.name,
        priority,
        context,
        cachedAt: Date.now()
      }
    };

    await this.performanceSystem.cacheSet(key, enhancedValue, ttl);
    this.updateCacheStatistics(key, context);
    
    return true;
  }

  public async smartCacheGet<T>(key: string): Promise<T | null> {
    const result = await this.performanceSystem.cacheGet<T>(key);
    
    if (result) {
      this.updateAccessStatistics(key);
    }
    
    return result;
  }

  private updateCacheStatistics(key: string, context: CacheContext): void {
    const stats = this.cacheStats.get(key) || {
      key,
      hits: 0,
      misses: 0,
      lastAccess: Date.now(),
      context
    };

    this.cacheStats.set(key, stats);
  }

  private updateAccessStatistics(key: string): void {
    const stats = this.cacheStats.get(key);
    if (stats) {
      stats.hits++;
      stats.lastAccess = Date.now();
    }
  }

  // Optimization actions
  private async cleanupLowHitRateEntries(): Promise<OptimizationResult> {
    const cache = this.getCacheReference();
    let removedCount = 0;
    let freedMemory = 0;

    for (const [key, stats] of this.cacheStats.entries()) {
      const hitRate = stats.hits / (stats.hits + stats.misses + 1);
      
      if (hitRate < 0.2 && cache.has(key)) {
        const entry = cache.get(key);
        freedMemory += entry?.size || 0;
        
        await this.performanceSystem.cacheDelete(key);
        this.cacheStats.delete(key);
        removedCount++;
      }
    }

    return {
      success: true,
      description: `Removed ${removedCount} low hit rate entries`,
      metricsImprovement: {
        cacheHitRate: 0.1 // Expected improvement
      },
      resourcesFreed: freedMemory
    };
  }

  private async performMemoryPressureCleanup(): Promise<OptimizationResult> {
    const cache = this.getCacheReference();
    const entries = Array.from(cache.entries());
    
    // Sort by priority (lowest first) and remove bottom 25%
    const sortedEntries = entries
      .filter(([, entry]) => entry.value._cacheMetadata)
      .sort(([, a], [, b]) => {
        const priorityA = a.value._cacheMetadata?.priority || 0;
        const priorityB = b.value._cacheMetadata?.priority || 0;
        return priorityA - priorityB;
      });

    const toRemove = Math.floor(sortedEntries.length * 0.25);
    let freedMemory = 0;

    for (let i = 0; i < toRemove; i++) {
      const [key, entry] = sortedEntries[i];
      freedMemory += entry.size || 0;
      
      await this.performanceSystem.cacheDelete(key);
      this.cacheStats.delete(key);
    }

    return {
      success: true,
      description: `Removed ${toRemove} low priority entries under memory pressure`,
      metricsImprovement: {
        memoryUsage: -freedMemory / 1024 / 1024 // MB freed
      },
      resourcesFreed: freedMemory
    };
  }

  private async removeStaleEntries(): Promise<OptimizationResult> {
    const cache = this.getCacheReference();
    const now = Date.now();
    let removedCount = 0;
    let freedMemory = 0;

    for (const [key, entry] of cache.entries()) {
      const age = now - entry.timestamp;
      const maxAge = entry.ttl || 3600000; // Default 1 hour

      if (age > maxAge * 1.5) { // 50% past TTL
        freedMemory += entry.size || 0;
        await this.performanceSystem.cacheDelete(key);
        this.cacheStats.delete(key);
        removedCount++;
      }
    }

    return {
      success: true,
      description: `Removed ${removedCount} stale entries`,
      metricsImprovement: {},
      resourcesFreed: freedMemory
    };
  }

  private async prewarmFrequentPatterns(): Promise<OptimizationResult> {
    // This would typically involve pre-loading frequently accessed patterns
    // For now, we'll simulate by identifying high-value cache candidates
    
    const highValuePatterns = Array.from(this.cacheStats.entries())
      .filter(([, stats]) => stats.hits > 10)
      .sort(([, a], [, b]) => b.hits - a.hits)
      .slice(0, 10);

    return {
      success: true,
      description: `Identified ${highValuePatterns.length} patterns for prewarming`,
      metricsImprovement: {
        cacheHitRate: 0.05 // Expected improvement
      },
      resourcesFreed: 0
    };
  }

  // Utility methods
  private getCacheReference(): Map<string, any> {
    // This is a simplified way to access the cache
    // In a real implementation, you'd need proper access to the cache
    return new Map();
  }

  public getCacheStatistics(): Map<string, CacheStatistics> {
    return new Map(this.cacheStats);
  }

  public getOptimizationHistory(): OptimizationResult[] {
    return [...this.optimizationHistory];
  }

  public addCacheStrategy(name: string, strategy: CacheStrategy): void {
    this.cacheStrategies.set(name, strategy);
  }

  public removeCacheStrategy(name: string): boolean {
    return this.cacheStrategies.delete(name);
  }

  public addOptimizationRule(rule: OptimizationRule): void {
    this.optimizationRules.push(rule);
  }

  public addInvalidationRule(rule: CacheInvalidationRule): void {
    this.invalidationRules.push(rule);
  }

  public async shutdown(): Promise<void> {
    this.removeAllListeners();
    this.cacheStats.clear();
    this.optimizationHistory.length = 0;
  }
}

interface CacheStatistics {
  key: string;
  hits: number;
  misses: number;
  lastAccess: number;
  context: CacheContext;
}