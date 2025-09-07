/**
 * Site Coordination Engine
 * 
 * Purpose: Implements parallel site processing, data synchronization between sites,
 * site-specific adaptation while maintaining consistency, and site performance monitoring.
 * This engine focuses specifically on coordinating execution across multiple browser sessions.
 */

import {
  SiteTask,
  CoordinationPlan,
  ExecutionOrder,
  SynchronizationPoint,
  ParallelizationStrategy
} from '../interfaces/ITaskPlanner.js';
import { ActionContext } from '../../shared/types.js';
import { AIProviderManager } from './AIProviderManager.js';
import { BrowserManager } from './BrowserManager.js';
import { Page, Browser } from 'puppeteer';

export interface ISiteCoordinationEngine {
  /**
   * Process multiple sites in parallel with intelligent coordination
   * @param siteTasks - Array of site tasks to process
   * @param strategy - Parallelization strategy
   * @returns Promise resolving to parallel processing result
   */
  processParallelSites(siteTasks: SiteTask[], strategy: ParallelizationStrategy): Promise<ParallelProcessingResult>;

  /**
   * Synchronize data between different sites during execution
   * @param synchronizationPoints - Points where sites need to sync
   * @param activeSessions - Currently active browser sessions
   * @returns Promise resolving to synchronization result
   */
  synchronizeData(synchronizationPoints: SynchronizationPoint[], activeSessions: Map<string, SiteSession>): Promise<SynchronizationResult>;

  /**
   * Adapt site-specific approaches while maintaining consistency
   * @param siteTask - The site task to adapt
   * @param context - Current execution context
   * @returns Promise resolving to adapted site task
   */
  adaptSiteSpecificApproach(siteTask: SiteTask, context: SiteAdaptationContext): Promise<AdaptedSiteTask>;

  /**
   * Monitor performance of individual sites during execution
   * @param siteId - ID of the site to monitor
   * @returns Promise resolving to site performance metrics
   */
  monitorSitePerformance(siteId: string): Promise<SitePerformanceMetrics>;

  /**
   * Optimize resource allocation across multiple sites
   * @param siteTasks - Array of site tasks
   * @param availableResources - Available system resources
   * @returns Promise resolving to resource allocation plan
   */
  optimizeResourceAllocation(siteTasks: SiteTask[], availableResources: SystemResources): Promise<ResourceAllocationPlan>;
}

export interface ParallelProcessingResult {
  success: boolean;
  processedSites: ProcessedSite[];
  totalDuration: number;
  parallelEfficiency: number;
  resourceUtilization: ResourceUtilization;
  synchronizationEvents: SynchronizationEvent[];
  errors: ProcessingError[];
}

export interface ProcessedSite {
  siteId: string;
  url: string;
  success: boolean;
  startTime: Date;
  endTime: Date;
  duration: number;
  actionsExecuted: number;
  dataExtracted: any[];
  adaptationsMade: string[];
  performanceMetrics: SitePerformanceMetrics;
}

export interface SynchronizationResult {
  success: boolean;
  synchronizedPoints: SynchronizedPoint[];
  dataExchanges: DataExchange[];
  conflicts: SynchronizationConflict[];
  totalSyncTime: number;
}

export interface SynchronizedPoint {
  id: string;
  timestamp: Date;
  participantSites: string[];
  dataShared: any;
  syncDuration: number;
}

export interface DataExchange {
  fromSite: string;
  toSite: string;
  dataType: string;
  data: any;
  timestamp: Date;
  success: boolean;
}

export interface SynchronizationConflict {
  pointId: string;
  conflictType: 'timing' | 'data' | 'resource';
  description: string;
  affectedSites: string[];
  resolution: string;
}

export interface AdaptedSiteTask extends SiteTask {
  originalTask: SiteTask;
  adaptations: SiteAdaptation[];
  adaptationReason: string;
  confidenceAdjustment: number;
}

export interface SiteAdaptation {
  type: 'selector' | 'timing' | 'approach' | 'fallback';
  description: string;
  originalValue: any;
  adaptedValue: any;
  confidence: number;
}

export interface SiteAdaptationContext {
  siteStructure: SiteStructureInfo;
  previousAttempts: AttemptHistory[];
  availableAlternatives: AlternativeApproach[];
  performanceConstraints: PerformanceConstraint[];
  consistencyRequirements: ConsistencyRequirement[];
}

export interface SiteStructureInfo {
  pageType: string;
  detectedFramework: string;
  loadingPatterns: string[];
  elementPatterns: ElementPattern[];
  uniqueCharacteristics: string[];
}

export interface ElementPattern {
  type: string;
  selector: string;
  confidence: number;
  alternatives: string[];
}

export interface AttemptHistory {
  timestamp: Date;
  approach: string;
  success: boolean;
  duration: number;
  error?: string;
}

export interface AlternativeApproach {
  name: string;
  description: string;
  applicability: number;
  estimatedSuccess: number;
  adaptations: string[];
}

export interface PerformanceConstraint {
  type: 'time' | 'memory' | 'network';
  limit: number;
  priority: 'strict' | 'preferred';
}

export interface ConsistencyRequirement {
  aspect: 'data_format' | 'timing' | 'approach';
  requirement: string;
  flexibility: number;
}

export interface SitePerformanceMetrics {
  responseTime: number;
  loadTime: number;
  actionExecutionTime: number;
  memoryUsage: number;
  networkRequests: number;
  errorRate: number;
  successRate: number;
  adaptationCount: number;
}

export interface SystemResources {
  availableMemory: number;
  cpuCapacity: number;
  networkBandwidth: number;
  maxBrowserTabs: number;
  concurrentLimit: number;
}

export interface ResourceAllocationPlan {
  siteAllocations: SiteResourceAllocation[];
  totalResourceUsage: ResourceUsage;
  optimizationStrategy: string;
  expectedEfficiency: number;
}

export interface SiteResourceAllocation {
  siteId: string;
  allocatedMemory: number;
  allocatedCpu: number;
  priority: number;
  concurrencySlot: number;
}

export interface ResourceUsage {
  memoryUsed: number;
  cpuUsed: number;
  networkUsed: number;
  tabsUsed: number;
}

export interface ResourceUtilization {
  memoryUtilization: number;
  cpuUtilization: number;
  networkUtilization: number;
  tabUtilization: number;
  overallEfficiency: number;
}

export interface ProcessingError {
  siteId: string;
  type: 'coordination' | 'execution' | 'synchronization' | 'resource';
  message: string;
  timestamp: Date;
  severity: 'low' | 'medium' | 'high' | 'critical';
  recoverable: boolean;
}

export interface SiteSession {
  siteId: string;
  browser: Browser;
  page: Page;
  startTime: Date;
  status: 'initializing' | 'running' | 'waiting' | 'completed' | 'failed';
  performanceMetrics: SitePerformanceMetrics;
  adaptations: SiteAdaptation[];
}

export interface SynchronizationEvent {
  id: string;
  type: 'data_sync' | 'timing_sync' | 'resource_sync';
  timestamp: Date;
  participants: string[];
  data?: any;
  duration: number;
}

export class SiteCoordinationEngine implements ISiteCoordinationEngine {
  private aiProvider: AIProviderManager;
  private browserManager: BrowserManager;
  private activeSessions: Map<string, SiteSession> = new Map();
  private performanceHistory: Map<string, SitePerformanceMetrics[]> = new Map();
  private adaptationHistory: Map<string, SiteAdaptation[]> = new Map();

  constructor(aiProvider: AIProviderManager, browserManager: BrowserManager) {
    this.aiProvider = aiProvider;
    this.browserManager = browserManager;
  }

  async processParallelSites(siteTasks: SiteTask[], strategy: ParallelizationStrategy): Promise<ParallelProcessingResult> {
    const startTime = Date.now();
    const processedSites: ProcessedSite[] = [];
    const synchronizationEvents: SynchronizationEvent[] = [];
    const errors: ProcessingError[] = [];

    try {
      console.log(`Processing ${siteTasks.length} sites in parallel with max concurrency: ${strategy.maxConcurrent}`);

      // Create resource allocation plan
      const systemResources = await this.getSystemResources();
      const allocationPlan = await this.optimizeResourceAllocation(siteTasks, systemResources);

      // Initialize browser sessions
      const sessions = await this.initializeBrowserSessions(siteTasks, allocationPlan);

      // Process sites in batches based on concurrency limit
      const batches = this.createProcessingBatches(siteTasks, strategy.maxConcurrent);
      
      for (const batch of batches) {
        const batchPromises = batch.map(async (siteTask) => {
          const session = sessions.get(siteTask.id);
          if (!session) {
            throw new Error(`No session found for site: ${siteTask.id}`);
          }

          return await this.processSingleSite(siteTask, session);
        });

        const batchResults = await Promise.allSettled(batchPromises);
        
        // Process batch results
        batchResults.forEach((result, index) => {
          const siteTask = batch[index];
          if (result.status === 'fulfilled') {
            processedSites.push(result.value);
          } else {
            errors.push({
              siteId: siteTask.id,
              type: 'execution',
              message: result.reason?.message || 'Unknown error',
              timestamp: new Date(),
              severity: 'high',
              recoverable: true
            });
          }
        });
      }

      // Cleanup sessions
      await this.cleanupBrowserSessions(sessions);

      const totalDuration = Date.now() - startTime;
      const parallelEfficiency = this.calculateParallelEfficiency(processedSites, totalDuration);
      const resourceUtilization = this.calculateResourceUtilization(allocationPlan, systemResources);

      return {
        success: errors.length === 0 || processedSites.length > 0,
        processedSites,
        totalDuration,
        parallelEfficiency,
        resourceUtilization,
        synchronizationEvents,
        errors
      };
    } catch (error) {
      console.error('Parallel site processing failed:', error);
      
      return {
        success: false,
        processedSites,
        totalDuration: Date.now() - startTime,
        parallelEfficiency: 0,
        resourceUtilization: {
          memoryUtilization: 0,
          cpuUtilization: 0,
          networkUtilization: 0,
          tabUtilization: 0,
          overallEfficiency: 0
        },
        synchronizationEvents,
        errors: [{
          siteId: 'all',
          type: 'coordination',
          message: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date(),
          severity: 'critical',
          recoverable: false
        }]
      };
    }
  }

  async synchronizeData(synchronizationPoints: SynchronizationPoint[], activeSessions: Map<string, SiteSession>): Promise<SynchronizationResult> {
    const synchronizedPoints: SynchronizedPoint[] = [];
    const dataExchanges: DataExchange[] = [];
    const conflicts: SynchronizationConflict[] = [];
    const startTime = Date.now();

    try {
      console.log(`Synchronizing data across ${synchronizationPoints.length} points`);

      for (const syncPoint of synchronizationPoints) {
        const syncStartTime = Date.now();
        
        // Wait for all required sites to reach this point
        const participantSessions = Array.from(activeSessions.values())
          .filter(session => syncPoint.waitFor.includes(session.siteId));

        if (participantSessions.length === 0) {
          conflicts.push({
            pointId: syncPoint.id,
            conflictType: 'timing',
            description: 'No participant sessions found',
            affectedSites: syncPoint.waitFor,
            resolution: 'Skipped synchronization point'
          });
          continue;
        }

        // Collect data from all participants
        const sharedData: any = {};
        for (const session of participantSessions) {
          try {
            const siteData = await this.extractSiteData(session);
            sharedData[session.siteId] = siteData;
          } catch (error) {
            conflicts.push({
              pointId: syncPoint.id,
              conflictType: 'data',
              description: `Failed to extract data from ${session.siteId}`,
              affectedSites: [session.siteId],
              resolution: 'Used default data'
            });
          }
        }

        // Create synchronized point
        synchronizedPoints.push({
          id: syncPoint.id,
          timestamp: new Date(),
          participantSites: participantSessions.map(s => s.siteId),
          dataShared: sharedData,
          syncDuration: Date.now() - syncStartTime
        });

        // Create data exchanges between sites
        for (const fromSession of participantSessions) {
          for (const toSession of participantSessions) {
            if (fromSession.siteId !== toSession.siteId) {
              dataExchanges.push({
                fromSite: fromSession.siteId,
                toSite: toSession.siteId,
                dataType: 'sync_data',
                data: sharedData[fromSession.siteId],
                timestamp: new Date(),
                success: true
              });
            }
          }
        }
      }

      return {
        success: conflicts.length === 0 || synchronizedPoints.length > 0,
        synchronizedPoints,
        dataExchanges,
        conflicts,
        totalSyncTime: Date.now() - startTime
      };
    } catch (error) {
      console.error('Data synchronization failed:', error);
      
      return {
        success: false,
        synchronizedPoints,
        dataExchanges,
        conflicts: [{
          pointId: 'all',
          conflictType: 'timing',
          description: error instanceof Error ? error.message : 'Unknown synchronization error',
          affectedSites: Array.from(activeSessions.keys()),
          resolution: 'Synchronization aborted'
        }],
        totalSyncTime: Date.now() - startTime
      };
    }
  }

  async adaptSiteSpecificApproach(siteTask: SiteTask, context: SiteAdaptationContext): Promise<AdaptedSiteTask> {
    try {
      console.log(`Adapting approach for site: ${siteTask.url}`);

      // Analyze site structure and previous attempts
      const adaptations = await this.generateSiteAdaptations(siteTask, context);
      
      // Apply adaptations to the site task
      const adaptedTask = await this.applySiteAdaptations(siteTask, adaptations);
      
      // Calculate confidence adjustment
      const confidenceAdjustment = this.calculateConfidenceAdjustment(adaptations, context);

      const adaptedSiteTask: AdaptedSiteTask = {
        ...adaptedTask,
        originalTask: siteTask,
        adaptations,
        adaptationReason: this.generateAdaptationReason(adaptations, context),
        confidenceAdjustment
      };

      // Store adaptation history
      this.storeAdaptationHistory(siteTask.id, adaptations);

      console.log(`Applied ${adaptations.length} adaptations to site ${siteTask.id}`);
      return adaptedSiteTask;
    } catch (error) {
      console.error('Site adaptation failed:', error);
      
      // Return original task with minimal adaptation
      return {
        ...siteTask,
        originalTask: siteTask,
        adaptations: [],
        adaptationReason: 'Adaptation failed, using original approach',
        confidenceAdjustment: -0.1
      };
    }
  }

  async monitorSitePerformance(siteId: string): Promise<SitePerformanceMetrics> {
    const session = this.activeSessions.get(siteId);
    
    if (!session) {
      return this.getDefaultPerformanceMetrics();
    }

    try {
      // Collect real-time performance metrics
      const metrics = await this.collectPerformanceMetrics(session);
      
      // Store in history
      this.storePerformanceHistory(siteId, metrics);
      
      return metrics;
    } catch (error) {
      console.error(`Failed to monitor performance for site ${siteId}:`, error);
      return this.getDefaultPerformanceMetrics();
    }
  }

  async optimizeResourceAllocation(siteTasks: SiteTask[], availableResources: SystemResources): Promise<ResourceAllocationPlan> {
    try {
      console.log(`Optimizing resource allocation for ${siteTasks.length} sites`);

      // Calculate resource requirements for each site
      const siteRequirements = await this.calculateSiteResourceRequirements(siteTasks);
      
      // Apply optimization algorithm
      const allocations = await this.applyResourceOptimization(siteRequirements, availableResources);
      
      // Calculate total usage and efficiency
      const totalResourceUsage = this.calculateTotalResourceUsage(allocations);
      const expectedEfficiency = this.calculateExpectedEfficiency(allocations, availableResources);

      return {
        siteAllocations: allocations,
        totalResourceUsage,
        optimizationStrategy: 'balanced_allocation',
        expectedEfficiency
      };
    } catch (error) {
      console.error('Resource allocation optimization failed:', error);
      
      // Return basic allocation
      return this.createBasicResourceAllocation(siteTasks, availableResources);
    }
  }

  // Private helper methods

  private async getSystemResources(): Promise<SystemResources> {
    // Placeholder implementation - would integrate with system monitoring
    return {
      availableMemory: 8192, // MB
      cpuCapacity: 100, // percentage
      networkBandwidth: 1000, // Mbps
      maxBrowserTabs: 20,
      concurrentLimit: 10
    };
  }

  private async initializeBrowserSessions(siteTasks: SiteTask[], allocationPlan: ResourceAllocationPlan): Promise<Map<string, SiteSession>> {
    const sessions = new Map<string, SiteSession>();

    for (const siteTask of siteTasks) {
      try {
        const browser = await this.browserManager.createBrowser();
        const page = await browser.newPage();
        
        const session: SiteSession = {
          siteId: siteTask.id,
          browser,
          page,
          startTime: new Date(),
          status: 'initializing',
          performanceMetrics: this.getDefaultPerformanceMetrics(),
          adaptations: []
        };

        sessions.set(siteTask.id, session);
        this.activeSessions.set(siteTask.id, session);
      } catch (error) {
        console.error(`Failed to initialize session for ${siteTask.id}:`, error);
      }
    }

    return sessions;
  }

  private createProcessingBatches(siteTasks: SiteTask[], maxConcurrent: number): SiteTask[][] {
    const batches: SiteTask[][] = [];
    
    for (let i = 0; i < siteTasks.length; i += maxConcurrent) {
      batches.push(siteTasks.slice(i, i + maxConcurrent));
    }
    
    return batches;
  }

  private async processSingleSite(siteTask: SiteTask, session: SiteSession): Promise<ProcessedSite> {
    const startTime = Date.now();
    session.status = 'running';

    try {
      // Navigate to site
      await session.page.goto(siteTask.url, { waitUntil: 'networkidle0' });
      
      // Execute actions (placeholder implementation)
      const actionsExecuted = siteTask.actions.length;
      const dataExtracted: any[] = [];
      
      // Collect performance metrics
      const performanceMetrics = await this.collectPerformanceMetrics(session);
      
      session.status = 'completed';
      
      return {
        siteId: siteTask.id,
        url: siteTask.url,
        success: true,
        startTime: new Date(startTime),
        endTime: new Date(),
        duration: Date.now() - startTime,
        actionsExecuted,
        dataExtracted,
        adaptationsMade: session.adaptations.map(a => a.description),
        performanceMetrics
      };
    } catch (error) {
      session.status = 'failed';
      
      return {
        siteId: siteTask.id,
        url: siteTask.url,
        success: false,
        startTime: new Date(startTime),
        endTime: new Date(),
        duration: Date.now() - startTime,
        actionsExecuted: 0,
        dataExtracted: [],
        adaptationsMade: [],
        performanceMetrics: this.getDefaultPerformanceMetrics()
      };
    }
  }

  private async cleanupBrowserSessions(sessions: Map<string, SiteSession>): Promise<void> {
    for (const [sessionId, session] of sessions) {
      try {
        await session.browser.close();
        this.activeSessions.delete(sessionId);
      } catch (error) {
        console.error(`Failed to cleanup session ${sessionId}:`, error);
      }
    }
  }

  private calculateParallelEfficiency(processedSites: ProcessedSite[], totalDuration: number): number {
    if (processedSites.length === 0) return 0;
    
    const totalSiteDuration = processedSites.reduce((sum, site) => sum + site.duration, 0);
    const theoreticalSequentialTime = totalSiteDuration;
    
    return Math.min(1.0, theoreticalSequentialTime / totalDuration);
  }

  private calculateResourceUtilization(allocationPlan: ResourceAllocationPlan, systemResources: SystemResources): ResourceUtilization {
    const usage = allocationPlan.totalResourceUsage;
    
    return {
      memoryUtilization: usage.memoryUsed / systemResources.availableMemory,
      cpuUtilization: usage.cpuUsed / systemResources.cpuCapacity,
      networkUtilization: usage.networkUsed / systemResources.networkBandwidth,
      tabUtilization: usage.tabsUsed / systemResources.maxBrowserTabs,
      overallEfficiency: allocationPlan.expectedEfficiency
    };
  }

  private async extractSiteData(session: SiteSession): Promise<any> {
    // Placeholder implementation
    return await session.page.evaluate(() => ({
      title: document.title,
      url: window.location.href,
      timestamp: Date.now()
    }));
  }

  private async generateSiteAdaptations(siteTask: SiteTask, context: SiteAdaptationContext): Promise<SiteAdaptation[]> {
    const adaptations: SiteAdaptation[] = [];
    
    // Analyze previous attempts
    if (context.previousAttempts.length > 0) {
      const failedAttempts = context.previousAttempts.filter(a => !a.success);
      if (failedAttempts.length > 0) {
        adaptations.push({
          type: 'approach',
          description: 'Switch to alternative approach based on previous failures',
          originalValue: 'standard_approach',
          adaptedValue: 'fallback_approach',
          confidence: 0.7
        });
      }
    }
    
    // Adapt based on site structure
    if (context.siteStructure.detectedFramework) {
      adaptations.push({
        type: 'selector',
        description: `Adapt selectors for ${context.siteStructure.detectedFramework} framework`,
        originalValue: 'generic_selectors',
        adaptedValue: `${context.siteStructure.detectedFramework}_selectors`,
        confidence: 0.8
      });
    }
    
    return adaptations;
  }

  private async applySiteAdaptations(siteTask: SiteTask, adaptations: SiteAdaptation[]): Promise<SiteTask> {
    // Apply adaptations to the site task
    const adaptedTask = { ...siteTask };
    
    for (const adaptation of adaptations) {
      switch (adaptation.type) {
        case 'selector':
          // Modify selectors in actions
          adaptedTask.actions = adaptedTask.actions.map(action => ({
            ...action,
            action: {
              ...action.action,
              // Apply selector adaptations
            }
          }));
          break;
        case 'timing':
          // Adjust timeouts
          adaptedTask.actions = adaptedTask.actions.map(action => ({
            ...action,
            timeout: action.timeout * 1.5 // Increase timeout
          }));
          break;
      }
    }
    
    return adaptedTask;
  }

  private calculateConfidenceAdjustment(adaptations: SiteAdaptation[], context: SiteAdaptationContext): number {
    if (adaptations.length === 0) return 0;
    
    const avgConfidence = adaptations.reduce((sum, a) => sum + a.confidence, 0) / adaptations.length;
    const adaptationPenalty = adaptations.length * 0.05; // Small penalty for each adaptation
    
    return avgConfidence - 0.5 - adaptationPenalty;
  }

  private generateAdaptationReason(adaptations: SiteAdaptation[], context: SiteAdaptationContext): string {
    if (adaptations.length === 0) return 'No adaptations needed';
    
    const reasons = adaptations.map(a => a.description);
    return `Applied ${adaptations.length} adaptations: ${reasons.join(', ')}`;
  }

  private async collectPerformanceMetrics(session: SiteSession): Promise<SitePerformanceMetrics> {
    try {
      // Collect real performance metrics from the browser
      const metrics = await session.page.metrics();
      
      return {
        responseTime: 500, // Placeholder
        loadTime: 2000, // Placeholder
        actionExecutionTime: 100, // Placeholder
        memoryUsage: metrics.JSHeapUsedSize || 0,
        networkRequests: 10, // Placeholder
        errorRate: 0,
        successRate: 1.0,
        adaptationCount: session.adaptations.length
      };
    } catch (error) {
      return this.getDefaultPerformanceMetrics();
    }
  }

  private getDefaultPerformanceMetrics(): SitePerformanceMetrics {
    return {
      responseTime: 0,
      loadTime: 0,
      actionExecutionTime: 0,
      memoryUsage: 0,
      networkRequests: 0,
      errorRate: 0,
      successRate: 0,
      adaptationCount: 0
    };
  }

  private async calculateSiteResourceRequirements(siteTasks: SiteTask[]): Promise<Map<string, ResourceRequirement>> {
    const requirements = new Map<string, ResourceRequirement>();
    
    for (const siteTask of siteTasks) {
      requirements.set(siteTask.id, {
        memory: 512, // MB per site
        cpu: 10, // percentage
        network: 50, // Mbps
        priority: siteTask.priority
      });
    }
    
    return requirements;
  }

  private async applyResourceOptimization(requirements: Map<string, ResourceRequirement>, availableResources: SystemResources): Promise<SiteResourceAllocation[]> {
    const allocations: SiteResourceAllocation[] = [];
    let concurrencySlot = 0;
    
    for (const [siteId, requirement] of requirements) {
      allocations.push({
        siteId,
        allocatedMemory: Math.min(requirement.memory, availableResources.availableMemory / requirements.size),
        allocatedCpu: Math.min(requirement.cpu, availableResources.cpuCapacity / requirements.size),
        priority: requirement.priority,
        concurrencySlot: concurrencySlot++
      });
    }
    
    return allocations;
  }

  private calculateTotalResourceUsage(allocations: SiteResourceAllocation[]): ResourceUsage {
    return {
      memoryUsed: allocations.reduce((sum, a) => sum + a.allocatedMemory, 0),
      cpuUsed: allocations.reduce((sum, a) => sum + a.allocatedCpu, 0),
      networkUsed: 100, // Placeholder
      tabsUsed: allocations.length
    };
  }

  private calculateExpectedEfficiency(allocations: SiteResourceAllocation[], availableResources: SystemResources): number {
    const totalUsage = this.calculateTotalResourceUsage(allocations);
    const memoryEfficiency = Math.min(1.0, totalUsage.memoryUsed / availableResources.availableMemory);
    const cpuEfficiency = Math.min(1.0, totalUsage.cpuUsed / availableResources.cpuCapacity);
    
    return (memoryEfficiency + cpuEfficiency) / 2;
  }

  private createBasicResourceAllocation(siteTasks: SiteTask[], availableResources: SystemResources): ResourceAllocationPlan {
    const basicAllocations: SiteResourceAllocation[] = siteTasks.map((task, index) => ({
      siteId: task.id,
      allocatedMemory: availableResources.availableMemory / siteTasks.length,
      allocatedCpu: availableResources.cpuCapacity / siteTasks.length,
      priority: task.priority,
      concurrencySlot: index
    }));

    return {
      siteAllocations: basicAllocations,
      totalResourceUsage: this.calculateTotalResourceUsage(basicAllocations),
      optimizationStrategy: 'basic_equal_allocation',
      expectedEfficiency: 0.5
    };
  }

  private storeAdaptationHistory(siteId: string, adaptations: SiteAdaptation[]): void {
    if (!this.adaptationHistory.has(siteId)) {
      this.adaptationHistory.set(siteId, []);
    }
    
    this.adaptationHistory.get(siteId)!.push(...adaptations);
  }

  private storePerformanceHistory(siteId: string, metrics: SitePerformanceMetrics): void {
    if (!this.performanceHistory.has(siteId)) {
      this.performanceHistory.set(siteId, []);
    }
    
    const history = this.performanceHistory.get(siteId)!;
    history.push(metrics);
    
    // Keep only last 100 entries
    if (history.length > 100) {
      history.splice(0, history.length - 100);
    }
  }
}

interface ResourceRequirement {
  memory: number;
  cpu: number;
  network: number;
  priority: number;
}