import { EventEmitter } from 'events';

export interface PerformanceMetrics {
  taskExecutionTime: number;
  memoryUsage: number;
  cpuUsage: number;
  cacheHitRate: number;
  actionSuccessRate: number;
  averageResponseTime: number;
  concurrentTasks: number;
  resourceUtilization: number;
}

export interface CacheEntry<T> {
  key: string;
  value: T;
  timestamp: number;
  accessCount: number;
  lastAccessed: number;
  ttl: number;
  size: number;
}

export interface ResourceLimits {
  maxMemoryUsage: number;
  maxConcurrentTasks: number;
  maxCacheSize: number;
  maxExecutionTime: number;
}

export interface OptimizationStrategy {
  name: string;
  description: string;
  condition: (metrics: PerformanceMetrics) => boolean;
  action: (system: PerformanceOptimizationSystem) => Promise<void>;
  priority: number;
}

export class PerformanceOptimizationSystem extends EventEmitter {
  private cache: Map<string, CacheEntry<any>> = new Map();
  private metrics: PerformanceMetrics;
  private resourceLimits: ResourceLimits;
  private optimizationStrategies: OptimizationStrategy[] = [];
  private monitoringInterval: NodeJS.Timeout | null = null;
  private isOptimizing = false;

  constructor(resourceLimits: ResourceLimits) {
    super();
    this.resourceLimits = resourceLimits;
    this.metrics = this.initializeMetrics();
    this.setupOptimizationStrategies();
    this.startMonitoring();
  }

  private initializeMetrics(): PerformanceMetrics {
    return {
      taskExecutionTime: 0,
      memoryUsage: 0,
      cpuUsage: 0,
      cacheHitRate: 0,
      actionSuccessRate: 0,
      averageResponseTime: 0,
      concurrentTasks: 0,
      resourceUtilization: 0
    };
  }

  private setupOptimizationStrategies(): void {
    this.optimizationStrategies = [
      {
        name: 'Memory Cleanup',
        description: 'Clean up unused cache entries and free memory',
        condition: (metrics) => metrics.memoryUsage > this.resourceLimits.maxMemoryUsage * 0.8,
        action: async (system) => await system.performMemoryCleanup(),
        priority: 1
      },
      {
        name: 'Cache Optimization',
        description: 'Optimize cache by removing least used entries',
        condition: (metrics) => this.cache.size > this.resourceLimits.maxCacheSize * 0.9,
        action: async (system) => await system.optimizeCache(),
        priority: 2
      },
      {
        name: 'Task Throttling',
        description: 'Throttle concurrent tasks to prevent resource exhaustion',
        condition: (metrics) => metrics.concurrentTasks > this.resourceLimits.maxConcurrentTasks * 0.8,
        action: async (system) => await system.throttleTasks(),
        priority: 3
      },
      {
        name: 'Resource Rebalancing',
        description: 'Rebalance resource allocation for optimal performance',
        condition: (metrics) => metrics.resourceUtilization > 0.85,
        action: async (system) => await system.rebalanceResources(),
        priority: 4
      }
    ];
  }

  private startMonitoring(): void {
    this.monitoringInterval = setInterval(async () => {
      await this.updateMetrics();
      await this.checkOptimizationNeeds();
    }, 5000); // Monitor every 5 seconds
  }

  private async updateMetrics(): Promise<void> {
    const memoryUsage = process.memoryUsage();
    
    this.metrics = {
      ...this.metrics,
      memoryUsage: memoryUsage.heapUsed / 1024 / 1024, // MB
      cacheHitRate: this.calculateCacheHitRate(),
      resourceUtilization: this.calculateResourceUtilization()
    };

    this.emit('metricsUpdated', this.metrics);
  }

  private calculateCacheHitRate(): number {
    if (this.cache.size === 0) return 0;
    
    const totalAccess = Array.from(this.cache.values())
      .reduce((sum, entry) => sum + entry.accessCount, 0);
    
    return totalAccess > 0 ? (totalAccess / this.cache.size) : 0;
  }

  private calculateResourceUtilization(): number {
    const memoryUtil = this.metrics.memoryUsage / this.resourceLimits.maxMemoryUsage;
    const taskUtil = this.metrics.concurrentTasks / this.resourceLimits.maxConcurrentTasks;
    const cacheUtil = this.cache.size / this.resourceLimits.maxCacheSize;
    
    return Math.max(memoryUtil, taskUtil, cacheUtil);
  }

  private async checkOptimizationNeeds(): Promise<void> {
    if (this.isOptimizing) return;

    const applicableStrategies = this.optimizationStrategies
      .filter(strategy => strategy.condition(this.metrics))
      .sort((a, b) => a.priority - b.priority);

    if (applicableStrategies.length > 0) {
      this.isOptimizing = true;
      
      try {
        for (const strategy of applicableStrategies) {
          console.log(`Applying optimization strategy: ${strategy.name}`);
          await strategy.action(this);
          this.emit('optimizationApplied', strategy);
        }
      } catch (error) {
        console.error('Error during optimization:', error);
        this.emit('optimizationError', error);
      } finally {
        this.isOptimizing = false;
      }
    }
  }

  // Cache Management Methods
  public async cacheSet<T>(key: string, value: T, ttl: number = 300000): Promise<void> {
    const entry: CacheEntry<T> = {
      key,
      value,
      timestamp: Date.now(),
      accessCount: 0,
      lastAccessed: Date.now(),
      ttl,
      size: this.estimateSize(value)
    };

    this.cache.set(key, entry);
    await this.enforceCacheLimits();
  }

  public async cacheGet<T>(key: string): Promise<T | null> {
    const entry = this.cache.get(key);
    
    if (!entry) return null;
    
    // Check TTL
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    // Update access statistics
    entry.accessCount++;
    entry.lastAccessed = Date.now();
    
    return entry.value as T;
  }

  public async cacheDelete(key: string): Promise<boolean> {
    return this.cache.delete(key);
  }

  public async cacheClear(): Promise<void> {
    this.cache.clear();
  }

  private async enforceCacheLimits(): Promise<void> {
    if (this.cache.size <= this.resourceLimits.maxCacheSize) return;

    // Remove expired entries first
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
      }
    }

    // If still over limit, remove least recently used entries
    if (this.cache.size > this.resourceLimits.maxCacheSize) {
      const entries = Array.from(this.cache.entries())
        .sort(([, a], [, b]) => a.lastAccessed - b.lastAccessed);

      const toRemove = entries.slice(0, this.cache.size - this.resourceLimits.maxCacheSize);
      toRemove.forEach(([key]) => this.cache.delete(key));
    }
  }

  private estimateSize(value: any): number {
    try {
      return JSON.stringify(value).length * 2; // Rough estimate in bytes
    } catch {
      return 1000; // Default size estimate
    }
  }

  // Optimization Actions
  private async performMemoryCleanup(): Promise<void> {
    // Clear expired cache entries
    const now = Date.now();
    let removedCount = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
        removedCount++;
      }
    }

    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }

    console.log(`Memory cleanup completed. Removed ${removedCount} expired cache entries.`);
  }

  private async optimizeCache(): Promise<void> {
    // Remove least frequently used entries
    const entries = Array.from(this.cache.entries())
      .sort(([, a], [, b]) => a.accessCount - b.accessCount);

    const targetSize = Math.floor(this.resourceLimits.maxCacheSize * 0.7);
    const toRemove = entries.slice(0, this.cache.size - targetSize);

    toRemove.forEach(([key]) => this.cache.delete(key));

    console.log(`Cache optimized. Removed ${toRemove.length} least used entries.`);
  }

  private async throttleTasks(): Promise<void> {
    // Emit event to signal task throttling needed
    this.emit('taskThrottlingRequired', {
      currentTasks: this.metrics.concurrentTasks,
      maxTasks: this.resourceLimits.maxConcurrentTasks
    });

    console.log('Task throttling signal sent.');
  }

  private async rebalanceResources(): Promise<void> {
    // Perform comprehensive resource rebalancing
    await this.performMemoryCleanup();
    await this.optimizeCache();
    
    // Adjust resource limits based on current usage patterns
    const avgMemoryUsage = this.metrics.memoryUsage;
    if (avgMemoryUsage < this.resourceLimits.maxMemoryUsage * 0.5) {
      // Can potentially increase cache size
      this.resourceLimits.maxCacheSize = Math.min(
        this.resourceLimits.maxCacheSize * 1.1,
        10000
      );
    }

    console.log('Resource rebalancing completed.');
  }

  // Performance Monitoring Methods
  public recordTaskExecution(executionTime: number, success: boolean): void {
    this.metrics.taskExecutionTime = 
      (this.metrics.taskExecutionTime + executionTime) / 2; // Moving average
    
    // Update success rate (moving average)
    const successValue = success ? 1 : 0;
    this.metrics.actionSuccessRate = 
      (this.metrics.actionSuccessRate * 0.9) + (successValue * 0.1);
  }

  public recordResponseTime(responseTime: number): void {
    this.metrics.averageResponseTime = 
      (this.metrics.averageResponseTime + responseTime) / 2;
  }

  public setConcurrentTasks(count: number): void {
    this.metrics.concurrentTasks = count;
  }

  public getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  public getResourceLimits(): ResourceLimits {
    return { ...this.resourceLimits };
  }

  public updateResourceLimits(limits: Partial<ResourceLimits>): void {
    this.resourceLimits = { ...this.resourceLimits, ...limits };
  }

  // Parallel Processing Support
  public async executeInParallel<T>(
    tasks: (() => Promise<T>)[],
    maxConcurrency: number = this.resourceLimits.maxConcurrentTasks
  ): Promise<T[]> {
    const results: T[] = [];
    const executing: Promise<void>[] = [];

    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];
      
      const promise = this.executeWithMonitoring(task, i).then(result => {
        results[i] = result;
      });

      executing.push(promise);

      if (executing.length >= maxConcurrency) {
        await Promise.race(executing);
        executing.splice(executing.findIndex(p => p === promise), 1);
      }
    }

    await Promise.all(executing);
    return results;
  }

  private async executeWithMonitoring<T>(
    task: () => Promise<T>,
    index: number
  ): Promise<T> {
    const startTime = Date.now();
    this.setConcurrentTasks(this.metrics.concurrentTasks + 1);

    try {
      const result = await task();
      const executionTime = Date.now() - startTime;
      this.recordTaskExecution(executionTime, true);
      return result;
    } catch (error) {
      const executionTime = Date.now() - startTime;
      this.recordTaskExecution(executionTime, false);
      throw error;
    } finally {
      this.setConcurrentTasks(this.metrics.concurrentTasks - 1);
    }
  }

  public async shutdown(): Promise<void> {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    await this.cacheClear();
    this.removeAllListeners();
  }
}