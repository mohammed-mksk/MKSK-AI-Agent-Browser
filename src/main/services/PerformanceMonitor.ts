/**
 * Performance monitoring and resource management service
 */
import { EventEmitter } from 'events';
import { Logger } from './Logger.js';

export interface PerformanceMetrics {
  memory: MemoryMetrics;
  cpu: CpuMetrics;
  browser: BrowserMetrics;
  database: DatabaseMetrics;
  timestamp: number;
}

export interface MemoryMetrics {
  heapUsed: number; // MB
  heapTotal: number; // MB
  external: number; // MB
  rss: number; // MB
  percentUsed: number; // 0-100
}

export interface CpuMetrics {
  usage: number; // 0-100
  loadAverage: number[];
}

export interface BrowserMetrics {
  instances: number;
  pages: number;
  memoryEstimate: number; // MB
}

export interface DatabaseMetrics {
  size: number; // KB
  connections: number;
  queries: number;
  cacheSize: number; // KB
  cacheHitRate: number; // 0-100
}

export interface ResourceLimits {
  maxMemoryMB: number;
  maxCpuPercent: number;
  maxBrowserInstances: number;
  maxConcurrentQueries: number;
  maxDatabaseSizeMB: number;
}

export class PerformanceMonitor extends EventEmitter {
  private logger: Logger;
  private metrics: PerformanceMetrics[] = [];
  private maxMetricsHistory: number = 100;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private resourceLimits: ResourceLimits;
  private queryCount: number = 0;
  private queryHistory: { timestamp: number; duration: number }[] = [];
  private browserInstances: number = 0;
  private browserPages: number = 0;
  
  constructor() {
    super();
    this.logger = new Logger();
    this.resourceLimits = {
      maxMemoryMB: 1024, // 1GB
      maxCpuPercent: 80,
      maxBrowserInstances: 5,
      maxConcurrentQueries: 20,
      maxDatabaseSizeMB: 100
    };
  }
  
  /**
   * Start monitoring system performance
   */
  startMonitoring(intervalMs: number = 30000): void {
    if (this.monitoringInterval) {
      this.stopMonitoring();
    }
    
    this.logger.info(`Starting performance monitoring with interval: ${intervalMs}ms`);
    
    this.monitoringInterval = setInterval(() => {
      this.collectMetrics()
        .then(metrics => {
          this.metrics.push(metrics);
          
          // Trim history if needed
          if (this.metrics.length > this.maxMetricsHistory) {
            this.metrics = this.metrics.slice(-this.maxMetricsHistory);
          }
          
          // Emit performance metrics event
          this.emit('performance-metrics', metrics);
          
          // Check for resource issues
          this.checkResourceLimits(metrics);
        })
        .catch(error => {
          this.logger.error('Failed to collect performance metrics:', error);
        });
    }, intervalMs);
  }
  
  /**
   * Stop performance monitoring
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
      this.logger.info('Performance monitoring stopped');
    }
  }
  
  /**
   * Set resource limits
   */
  setResourceLimits(limits: Partial<ResourceLimits>): void {
    this.resourceLimits = { ...this.resourceLimits, ...limits };
    this.logger.info('Resource limits updated:', this.resourceLimits);
  }
  
  /**
   * Get current performance metrics
   */
  async getCurrentMetrics(): Promise<PerformanceMetrics> {
    return this.collectMetrics();
  }
  
  /**
   * Get performance history
   */
  getMetricsHistory(limit?: number): PerformanceMetrics[] {
    if (limit && limit > 0) {
      return this.metrics.slice(-limit);
    }
    return [...this.metrics];
  }
  
  /**
   * Track a database query
   */
  trackQuery(durationMs: number): void {
    this.queryCount++;
    this.queryHistory.push({
      timestamp: Date.now(),
      duration: durationMs
    });
    
    // Keep only recent history (last 100 queries)
    if (this.queryHistory.length > 100) {
      this.queryHistory = this.queryHistory.slice(-100);
    }
  }
  
  /**
   * Track browser instances
   */
  trackBrowsers(instances: number, pages: number): void {
    this.browserInstances = instances;
    this.browserPages = pages;
  }
  
  /**
   * Check if a new browser instance can be created
   */
  canCreateBrowserInstance(): boolean {
    return this.browserInstances < this.resourceLimits.maxBrowserInstances;
  }
  
  /**
   * Check if a new query can be executed
   */
  canExecuteQuery(): boolean {
    // Count queries in the last 5 seconds
    const now = Date.now();
    const recentQueries = this.queryHistory.filter(q => now - q.timestamp < 5000).length;
    
    return recentQueries < this.resourceLimits.maxConcurrentQueries;
  }
  
  /**
   * Optimize performance if needed
   */
  async optimizeIfNeeded(): Promise<boolean> {
    const metrics = await this.collectMetrics();
    
    // Check if optimization is needed
    if (metrics.memory.percentUsed > 80 || 
        metrics.cpu.usage > this.resourceLimits.maxCpuPercent) {
      
      this.logger.warn('High resource usage detected, optimizing performance...');
      
      // Perform optimization
      await this.optimizePerformance();
      return true;
    }
    
    return false;
  }
  
  /**
   * Optimize system performance
   */
  async optimizePerformance(): Promise<void> {
    this.logger.info('Optimizing system performance...');
    
    // Clear metrics history to free memory
    this.metrics = this.metrics.slice(-10);
    
    // Clear query history
    this.queryHistory = [];
    
    // Force garbage collection if available
    if (global.gc) {
      this.logger.info('Running garbage collection...');
      global.gc();
    }
    
    this.logger.info('Performance optimization completed');
  }
  
  /**
   * Collect current performance metrics
   */
  private async collectMetrics(): Promise<PerformanceMetrics> {
    // Get memory metrics
    const memoryUsage = process.memoryUsage();
    const memory: MemoryMetrics = {
      heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
      heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024),
      external: Math.round(memoryUsage.external / 1024 / 1024),
      rss: Math.round(memoryUsage.rss / 1024 / 1024),
      percentUsed: Math.round((memoryUsage.heapUsed / memoryUsage.heapTotal) * 100)
    };
    
    // Get CPU metrics (simplified - in a real app we'd use a library like node-os-utils)
    const cpu: CpuMetrics = {
      usage: await this.estimateCpuUsage(),
      loadAverage: process.loadavg()
    };
    
    // Browser metrics
    const browser: BrowserMetrics = {
      instances: this.browserInstances,
      pages: this.browserPages,
      memoryEstimate: this.browserInstances * 100 + this.browserPages * 20 // Rough estimate
    };
    
    // Database metrics (simplified - in a real app we'd get actual metrics from the DB)
    const database: DatabaseMetrics = {
      size: 1024, // Mock value
      connections: 1,
      queries: this.queryCount,
      cacheSize: 256,
      cacheHitRate: 85
    };
    
    return {
      memory,
      cpu,
      browser,
      database,
      timestamp: Date.now()
    };
  }
  
  /**
   * Check if any resource limits are exceeded
   */
  private checkResourceLimits(metrics: PerformanceMetrics): void {
    // Check memory usage
    if (metrics.memory.rss > this.resourceLimits.maxMemoryMB) {
      this.logger.warn(`Memory usage exceeds limit: ${metrics.memory.rss}MB / ${this.resourceLimits.maxMemoryMB}MB`);
      this.emitResourceWarning('memory', metrics.memory.rss, this.resourceLimits.maxMemoryMB);
    }
    
    // Check CPU usage
    if (metrics.cpu.usage > this.resourceLimits.maxCpuPercent) {
      this.logger.warn(`CPU usage exceeds limit: ${metrics.cpu.usage}% / ${this.resourceLimits.maxCpuPercent}%`);
      this.emitResourceWarning('cpu', metrics.cpu.usage, this.resourceLimits.maxCpuPercent);
    }
    
    // Check browser instances
    if (metrics.browser.instances > this.resourceLimits.maxBrowserInstances) {
      this.logger.warn(`Browser instances exceed limit: ${metrics.browser.instances} / ${this.resourceLimits.maxBrowserInstances}`);
      this.emitResourceWarning('browser', metrics.browser.instances, this.resourceLimits.maxBrowserInstances);
    }
  }
  
  /**
   * Emit a resource warning
   */
  private emitResourceWarning(resource: string, current: number, limit: number): void {
    // In a real implementation, this would emit an event or send a notification
    this.logger.warn(`Resource warning: ${resource} usage ${current} exceeds limit ${limit}`);
  }
  
  /**
   * Estimate CPU usage (simplified implementation)
   */
  private async estimateCpuUsage(): Promise<number> {
    // This is a simplified CPU usage estimation
    // In a real implementation, you'd use a library like node-os-utils
    const startTime = process.hrtime();
    const startUsage = process.cpuUsage();
    
    // Wait a small amount of time
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const endTime = process.hrtime(startTime);
    const endUsage = process.cpuUsage(startUsage);
    
    // Calculate CPU usage percentage
    const totalTime = endTime[0] * 1000000 + endTime[1] / 1000; // microseconds
    const totalUsage = endUsage.user + endUsage.system; // microseconds
    
    const cpuPercent = Math.min(100, Math.max(0, (totalUsage / totalTime) * 100));
    
    return Math.round(cpuPercent);
  }
}