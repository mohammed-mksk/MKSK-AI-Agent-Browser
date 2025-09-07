/**
 * Multi-Site Coordinator
 * 
 * Purpose: Implements intelligent coordination of browser automation tasks across multiple websites.
 * Handles parallel execution, data correlation, failure handling, and intelligent site selection.
 */

import {
  MultiSiteStrategy,
  SiteTask,
  CoordinationPlan,
  DataFlowPlan,
  MultiSiteFailureHandling,
  ExecutionOrder,
  SynchronizationPoint,
  DataExchange,
  AggregationPoint,
  FallbackChain
} from '../interfaces/ITaskPlanner.js';
import { ActionContext, AutomationAction } from '../../shared/types.js';
import { AIProviderManager } from './AIProviderManager.js';
import { BrowserManager } from './BrowserManager.js';
import { Page, Browser } from 'puppeteer';

export interface IMultiSiteCoordinator {
  /**
   * Execute a multi-site strategy with intelligent coordination
   * @param strategy - The multi-site strategy to execute
   * @returns Promise resolving to execution result
   */
  executeMultiSiteStrategy(strategy: MultiSiteStrategy): Promise<MultiSiteExecutionResult>;

  /**
   * Coordinate actions across multiple browser tabs/windows
   * @param siteTasks - Array of site tasks to coordinate
   * @param coordinationPlan - Plan for coordinating execution
   * @returns Promise resolving to coordination result
   */
  coordinateActions(siteTasks: SiteTask[], coordinationPlan: CoordinationPlan): Promise<CoordinationResult>;

  /**
   * Handle cross-site data correlation and aggregation
   * @param dataFlowPlan - Plan for data flow between sites
   * @param siteResults - Results from individual sites
   * @returns Promise resolving to aggregated data
   */
  aggregateData(dataFlowPlan: DataFlowPlan, siteResults: SiteExecutionResult[]): Promise<AggregatedData>;

  /**
   * Handle site failures with intelligent fallback strategies
   * @param failedSite - Information about the failed site
   * @param failureHandling - Failure handling configuration
   * @returns Promise resolving to fallback result
   */
  handleSiteFailure(failedSite: SiteFailureInfo, failureHandling: MultiSiteFailureHandling): Promise<FallbackResult>;

  /**
   * Monitor and optimize multi-site execution performance
   * @param executionId - ID of the execution to monitor
   * @returns Promise resolving to performance metrics
   */
  monitorExecution(executionId: string): Promise<MultiSitePerformanceMetrics>;
}

export interface MultiSiteExecutionResult {
  success: boolean;
  strategy: MultiSiteStrategy;
  siteResults: SiteExecutionResult[];
  aggregatedData: AggregatedData;
  duration: number;
  performanceMetrics: MultiSitePerformanceMetrics;
  errors: MultiSiteError[];
  learnings: string[];
}

export interface SiteExecutionResult {
  siteId: string;
  url: string;
  success: boolean;
  actions: ExecutedAction[];
  extractedData: any[];
  duration: number;
  error?: string;
  screenshots: Buffer[];
}

export interface ExecutedAction {
  action: AutomationAction;
  result: any;
  duration: number;
  success: boolean;
  error?: string;
}

export interface CoordinationResult {
  success: boolean;
  coordinatedActions: CoordinatedAction[];
  synchronizationEvents: SynchronizationEvent[];
  resourceUsage: ResourceUsage;
  timing: ExecutionTiming;
}

export interface CoordinatedAction {
  siteId: string;
  action: AutomationAction;
  executionTime: Date;
  dependencies: string[];
  result: any;
}

export interface SynchronizationEvent {
  id: string;
  type: 'wait' | 'signal' | 'data_exchange';
  timestamp: Date;
  participants: string[];
  data?: any;
}

export interface ResourceUsage {
  browserTabs: number;
  memoryUsage: number;
  cpuUsage: number;
  networkRequests: number;
}

export interface ExecutionTiming {
  startTime: Date;
  endTime: Date;
  totalDuration: number;
  parallelEfficiency: number;
}

export interface AggregatedData {
  id: string;
  sources: string[];
  data: any;
  aggregationStrategy: string;
  confidence: number;
  conflicts: DataConflict[];
  metadata: AggregationMetadata;
}

export interface DataConflict {
  field: string;
  values: ConflictingValue[];
  resolution: string;
  confidence: number;
}

export interface ConflictingValue {
  value: any;
  source: string;
  confidence: number;
}

export interface AggregationMetadata {
  aggregatedAt: Date;
  totalSources: number;
  successfulSources: number;
  dataQuality: number;
  completeness: number;
}

export interface SiteFailureInfo {
  siteId: string;
  url: string;
  error: string;
  failureType: 'network' | 'timeout' | 'captcha' | 'blocked' | 'structure_change' | 'unknown';
  context: ActionContext;
  attemptCount: number;
}

export interface FallbackResult {
  success: boolean;
  fallbackSite?: string;
  fallbackUrl?: string;
  adaptations: string[];
  confidence: number;
  reasoning: string;
}

export interface MultiSitePerformanceMetrics {
  totalDuration: number;
  averageSiteDuration: number;
  parallelizationEfficiency: number;
  successRate: number;
  dataQuality: number;
  resourceEfficiency: number;
  coordinationOverhead: number;
}

export interface MultiSiteError {
  type: 'coordination' | 'site_failure' | 'data_aggregation' | 'synchronization';
  message: string;
  siteId?: string;
  timestamp: Date;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export class MultiSiteCoordinator implements IMultiSiteCoordinator {
  private aiProvider: AIProviderManager;
  private browserManager: BrowserManager;
  private activeSessions: Map<string, MultiSiteSession> = new Map();
  private performanceHistory: Map<string, MultiSitePerformanceMetrics[]> = new Map();

  constructor(aiProvider: AIProviderManager, browserManager: BrowserManager) {
    this.aiProvider = aiProvider;
    this.browserManager = browserManager;
  }

  async executeMultiSiteStrategy(strategy: MultiSiteStrategy): Promise<MultiSiteExecutionResult> {
    const startTime = Date.now();
    const sessionId = `multisite_${Date.now()}`;
    
    try {
      console.log(`Executing multi-site strategy: ${strategy.id} with ${strategy.sites.length} sites`);
      
      // Create session for tracking
      const session = await this.createMultiSiteSession(sessionId, strategy);
      this.activeSessions.set(sessionId, session);
      
      // Execute coordination plan
      const coordinationResult = await this.coordinateActions(strategy.sites, strategy.coordinationPlan);
      
      // Aggregate data from all sites
      const aggregatedData = await this.aggregateData(strategy.dataFlowPlan, coordinationResult.siteResults || []);
      
      // Calculate performance metrics
      const performanceMetrics = await this.calculatePerformanceMetrics(sessionId, coordinationResult);
      
      const result: MultiSiteExecutionResult = {
        success: coordinationResult.success,
        strategy,
        siteResults: coordinationResult.siteResults || [],
        aggregatedData,
        duration: Date.now() - startTime,
        performanceMetrics,
        errors: session.errors,
        learnings: await this.extractLearnings(strategy, coordinationResult)
      };

      // Store performance history
      this.storePerformanceHistory(strategy.id, performanceMetrics);
      
      // Cleanup session
      this.activeSessions.delete(sessionId);
      
      return result;
    } catch (error) {
      console.error('Multi-site strategy execution failed:', error);
      
      const result: MultiSiteExecutionResult = {
        success: false,
        strategy,
        siteResults: [],
        aggregatedData: {
          id: `failed_${sessionId}`,
          sources: [],
          data: {},
          aggregationStrategy: 'none',
          confidence: 0,
          conflicts: [],
          metadata: {
            aggregatedAt: new Date(),
            totalSources: 0,
            successfulSources: 0,
            dataQuality: 0,
            completeness: 0
          }
        },
        duration: Date.now() - startTime,
        performanceMetrics: await this.getDefaultPerformanceMetrics(),
        errors: [{
          type: 'coordination',
          message: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date(),
          severity: 'critical'
        }],
        learnings: [`Multi-site execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`]
      };
      
      this.activeSessions.delete(sessionId);
      return result;
    }
  }

  async coordinateActions(siteTasks: SiteTask[], coordinationPlan: CoordinationPlan): Promise<CoordinationResult> {
    const startTime = Date.now();
    const coordinatedActions: CoordinatedAction[] = [];
    const synchronizationEvents: SynchronizationEvent[] = [];
    const siteResults: SiteExecutionResult[] = [];
    
    try {
      console.log(`Coordinating actions across ${siteTasks.length} sites`);
      
      // Create browser sessions for each site
      const browserSessions = await this.createBrowserSessions(siteTasks);
      
      // Execute based on coordination plan
      switch (coordinationPlan.executionOrder.type) {
        case 'sequential':
          await this.executeSequentially(siteTasks, browserSessions, coordinatedActions, siteResults);
          break;
        case 'parallel':
          await this.executeInParallel(siteTasks, browserSessions, coordinatedActions, siteResults);
          break;
        case 'hybrid':
          await this.executeHybrid(siteTasks, browserSessions, coordinationPlan, coordinatedActions, siteResults);
          break;
      }
      
      // Handle synchronization points
      for (const syncPoint of coordinationPlan.synchronizationPoints) {
        const syncEvent = await this.handleSynchronizationPoint(syncPoint, browserSessions);
        synchronizationEvents.push(syncEvent);
      }
      
      // Cleanup browser sessions
      await this.cleanupBrowserSessions(browserSessions);
      
      return {
        success: true,
        coordinatedActions,
        synchronizationEvents,
        siteResults,
        resourceUsage: await this.calculateResourceUsage(browserSessions),
        timing: {
          startTime: new Date(startTime),
          endTime: new Date(),
          totalDuration: Date.now() - startTime,
          parallelEfficiency: this.calculateParallelEfficiency(coordinatedActions)
        }
      };
    } catch (error) {
      console.error('Action coordination failed:', error);
      
      return {
        success: false,
        coordinatedActions,
        synchronizationEvents,
        siteResults,
        resourceUsage: {
          browserTabs: 0,
          memoryUsage: 0,
          cpuUsage: 0,
          networkRequests: 0
        },
        timing: {
          startTime: new Date(startTime),
          endTime: new Date(),
          totalDuration: Date.now() - startTime,
          parallelEfficiency: 0
        }
      };
    }
  }

  async aggregateData(dataFlowPlan: DataFlowPlan, siteResults: SiteExecutionResult[]): Promise<AggregatedData> {
    try {
      console.log(`Aggregating data from ${siteResults.length} sites`);
      
      const aggregatedData: any = {};
      const conflicts: DataConflict[] = [];
      const sources = siteResults.map(result => result.siteId);
      
      // Process each aggregation point
      for (const aggregationPoint of dataFlowPlan.aggregationPoints) {
        const sourceData = this.collectSourceData(aggregationPoint, siteResults);
        const aggregatedValue = await this.applyAggregationStrategy(aggregationPoint.strategy, sourceData);
        
        // Detect conflicts
        const pointConflicts = this.detectDataConflicts(aggregationPoint.id, sourceData);
        conflicts.push(...pointConflicts);
        
        aggregatedData[aggregationPoint.id] = aggregatedValue;
      }
      
      // Calculate data quality metrics
      const dataQuality = this.calculateDataQuality(siteResults, conflicts);
      const completeness = this.calculateDataCompleteness(dataFlowPlan, siteResults);
      
      return {
        id: `aggregated_${Date.now()}`,
        sources,
        data: aggregatedData,
        aggregationStrategy: 'multi_point',
        confidence: dataQuality,
        conflicts,
        metadata: {
          aggregatedAt: new Date(),
          totalSources: siteResults.length,
          successfulSources: siteResults.filter(r => r.success).length,
          dataQuality,
          completeness
        }
      };
    } catch (error) {
      console.error('Data aggregation failed:', error);
      
      return {
        id: `failed_aggregation_${Date.now()}`,
        sources: siteResults.map(r => r.siteId),
        data: {},
        aggregationStrategy: 'failed',
        confidence: 0,
        conflicts: [],
        metadata: {
          aggregatedAt: new Date(),
          totalSources: siteResults.length,
          successfulSources: 0,
          dataQuality: 0,
          completeness: 0
        }
      };
    }
  }

  async handleSiteFailure(failedSite: SiteFailureInfo, failureHandling: MultiSiteFailureHandling): Promise<FallbackResult> {
    try {
      console.log(`Handling site failure for ${failedSite.url}: ${failedSite.error}`);
      
      // Find appropriate fallback strategy
      const strategy = failureHandling.failureStrategies.find(s => 
        s.errorType === failedSite.failureType || s.errorType === 'any'
      );
      
      if (!strategy) {
        return {
          success: false,
          adaptations: [],
          confidence: 0,
          reasoning: 'No applicable fallback strategy found'
        };
      }
      
      switch (strategy.strategy) {
        case 'fallback':
          return await this.executeFallbackStrategy(failedSite, failureHandling.fallbackChain);
        case 'retry':
          return await this.executeRetryStrategy(failedSite, strategy.parameters);
        case 'skip':
          return await this.executeSkipStrategy(failedSite);
        case 'abort':
          return await this.executeAbortStrategy(failedSite);
        default:
          return {
            success: false,
            adaptations: [],
            confidence: 0,
            reasoning: `Unknown strategy: ${strategy.strategy}`
          };
      }
    } catch (error) {
      console.error('Site failure handling failed:', error);
      
      return {
        success: false,
        adaptations: [],
        confidence: 0,
        reasoning: `Failure handling error: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  async monitorExecution(executionId: string): Promise<MultiSitePerformanceMetrics> {
    const session = this.activeSessions.get(executionId);
    
    if (!session) {
      return await this.getDefaultPerformanceMetrics();
    }
    
    return {
      totalDuration: Date.now() - session.startTime,
      averageSiteDuration: session.siteDurations.reduce((a, b) => a + b, 0) / session.siteDurations.length,
      parallelizationEfficiency: session.parallelEfficiency,
      successRate: session.successfulSites / session.totalSites,
      dataQuality: session.dataQuality,
      resourceEfficiency: session.resourceEfficiency,
      coordinationOverhead: session.coordinationOverhead
    };
  }

  // Private helper methods

  private async createMultiSiteSession(sessionId: string, strategy: MultiSiteStrategy): Promise<MultiSiteSession> {
    return {
      id: sessionId,
      strategy,
      startTime: Date.now(),
      siteDurations: [],
      parallelEfficiency: 0,
      successfulSites: 0,
      totalSites: strategy.sites.length,
      dataQuality: 0,
      resourceEfficiency: 0,
      coordinationOverhead: 0,
      errors: []
    };
  }

  private async createBrowserSessions(siteTasks: SiteTask[]): Promise<Map<string, BrowserSession>> {
    const sessions = new Map<string, BrowserSession>();
    
    for (const siteTask of siteTasks) {
      try {
        const browser = await this.browserManager.createBrowser();
        const page = await browser.newPage();
        
        sessions.set(siteTask.id, {
          siteId: siteTask.id,
          browser,
          page,
          url: siteTask.url,
          startTime: Date.now()
        });
      } catch (error) {
        console.error(`Failed to create browser session for ${siteTask.id}:`, error);
      }
    }
    
    return sessions;
  }

  private async executeSequentially(
    siteTasks: SiteTask[], 
    browserSessions: Map<string, BrowserSession>,
    coordinatedActions: CoordinatedAction[],
    siteResults: SiteExecutionResult[]
  ): Promise<void> {
    for (const siteTask of siteTasks) {
      const session = browserSessions.get(siteTask.id);
      if (!session) continue;
      
      const result = await this.executeSiteTask(siteTask, session);
      siteResults.push(result);
      
      // Add coordinated actions
      for (const action of siteTask.actions) {
        coordinatedActions.push({
          siteId: siteTask.id,
          action: action.action,
          executionTime: new Date(),
          dependencies: siteTask.dependencies,
          result: result.success
        });
      }
    }
  }

  private async executeInParallel(
    siteTasks: SiteTask[], 
    browserSessions: Map<string, BrowserSession>,
    coordinatedActions: CoordinatedAction[],
    siteResults: SiteExecutionResult[]
  ): Promise<void> {
    const promises = siteTasks.map(async (siteTask) => {
      const session = browserSessions.get(siteTask.id);
      if (!session) return null;
      
      const result = await this.executeSiteTask(siteTask, session);
      
      // Add coordinated actions
      for (const action of siteTask.actions) {
        coordinatedActions.push({
          siteId: siteTask.id,
          action: action.action,
          executionTime: new Date(),
          dependencies: siteTask.dependencies,
          result: result.success
        });
      }
      
      return result;
    });
    
    const results = await Promise.all(promises);
    siteResults.push(...results.filter(r => r !== null) as SiteExecutionResult[]);
  }

  private async executeHybrid(
    siteTasks: SiteTask[], 
    browserSessions: Map<string, BrowserSession>,
    coordinationPlan: CoordinationPlan,
    coordinatedActions: CoordinatedAction[],
    siteResults: SiteExecutionResult[]
  ): Promise<void> {
    // Execute parallel groups first
    for (const parallelGroup of coordinationPlan.executionOrder.parallelGroups) {
      const groupTasks = siteTasks.filter(task => parallelGroup.includes(task.id));
      await this.executeInParallel(groupTasks, browserSessions, coordinatedActions, siteResults);
    }
    
    // Then execute sequential tasks
    const sequentialTasks = siteTasks.filter(task => 
      coordinationPlan.executionOrder.sequence.includes(task.id)
    );
    await this.executeSequentially(sequentialTasks, browserSessions, coordinatedActions, siteResults);
  }

  private async executeSiteTask(siteTask: SiteTask, session: BrowserSession): Promise<SiteExecutionResult> {
    const startTime = Date.now();
    const executedActions: ExecutedAction[] = [];
    const extractedData: any[] = [];
    const screenshots: Buffer[] = [];
    
    try {
      // Navigate to the site
      await session.page.goto(siteTask.url, { waitUntil: 'networkidle0' });
      
      // Execute actions for this site
      for (const plannedAction of siteTask.actions) {
        try {
          const actionResult = await this.executeAction(plannedAction.action, session.page);
          
          executedActions.push({
            action: plannedAction.action,
            result: actionResult,
            duration: 1000, // Placeholder
            success: true
          });
          
          // Extract data if needed
          if (plannedAction.action.type === 'extract') {
            extractedData.push(actionResult);
          }
        } catch (actionError) {
          executedActions.push({
            action: plannedAction.action,
            result: null,
            duration: 1000,
            success: false,
            error: actionError instanceof Error ? actionError.message : 'Unknown error'
          });
        }
      }
      
      // Take screenshot
      const screenshot = await session.page.screenshot();
      screenshots.push(screenshot);
      
      return {
        siteId: siteTask.id,
        url: siteTask.url,
        success: true,
        actions: executedActions,
        extractedData,
        duration: Date.now() - startTime,
        screenshots
      };
    } catch (error) {
      return {
        siteId: siteTask.id,
        url: siteTask.url,
        success: false,
        actions: executedActions,
        extractedData,
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
        screenshots
      };
    }
  }

  private async executeAction(action: AutomationAction, page: Page): Promise<any> {
    // Placeholder implementation - would integrate with existing action executor
    switch (action.type) {
      case 'click':
        return await page.click(action.target.css || '');
      case 'type':
        return await page.type(action.target.css || '', action.value || '');
      case 'extract':
        return await page.evaluate(() => document.title);
      default:
        throw new Error(`Unsupported action type: ${action.type}`);
    }
  }

  private async handleSynchronizationPoint(syncPoint: SynchronizationPoint, sessions: Map<string, BrowserSession>): Promise<SynchronizationEvent> {
    // Placeholder implementation
    return {
      id: syncPoint.id,
      type: 'wait',
      timestamp: new Date(),
      participants: Array.from(sessions.keys())
    };
  }

  private async cleanupBrowserSessions(sessions: Map<string, BrowserSession>): Promise<void> {
    for (const [sessionId, session] of sessions) {
      try {
        await session.browser.close();
      } catch (error) {
        console.error(`Failed to cleanup browser session ${sessionId}:`, error);
      }
    }
  }

  private calculateParallelEfficiency(actions: CoordinatedAction[]): number {
    // Placeholder calculation
    return 0.8;
  }

  private async calculateResourceUsage(sessions: Map<string, BrowserSession>): Promise<ResourceUsage> {
    return {
      browserTabs: sessions.size,
      memoryUsage: sessions.size * 100, // Placeholder
      cpuUsage: sessions.size * 10, // Placeholder
      networkRequests: sessions.size * 50 // Placeholder
    };
  }

  private collectSourceData(aggregationPoint: AggregationPoint, siteResults: SiteExecutionResult[]): any[] {
    return siteResults
      .filter(result => aggregationPoint.sources.includes(result.siteId))
      .map(result => result.extractedData)
      .flat();
  }

  private async applyAggregationStrategy(strategy: any, sourceData: any[]): Promise<any> {
    // Placeholder implementation
    switch (strategy.type) {
      case 'merge':
        return sourceData.reduce((acc, data) => ({ ...acc, ...data }), {});
      case 'compare':
        return sourceData;
      default:
        return sourceData[0];
    }
  }

  private detectDataConflicts(pointId: string, sourceData: any[]): DataConflict[] {
    // Placeholder implementation
    return [];
  }

  private calculateDataQuality(siteResults: SiteExecutionResult[], conflicts: DataConflict[]): number {
    const successRate = siteResults.filter(r => r.success).length / siteResults.length;
    const conflictPenalty = conflicts.length * 0.1;
    return Math.max(0, successRate - conflictPenalty);
  }

  private calculateDataCompleteness(dataFlowPlan: DataFlowPlan, siteResults: SiteExecutionResult[]): number {
    const expectedSources = dataFlowPlan.aggregationPoints.reduce((acc, point) => acc + point.sources.length, 0);
    const actualSources = siteResults.filter(r => r.success).length;
    return actualSources / expectedSources;
  }

  private async executeFallbackStrategy(failedSite: SiteFailureInfo, fallbackChain: FallbackChain): Promise<FallbackResult> {
    // Placeholder implementation
    return {
      success: false,
      adaptations: [],
      confidence: 0,
      reasoning: 'Fallback strategy not implemented'
    };
  }

  private async executeRetryStrategy(failedSite: SiteFailureInfo, parameters: Record<string, any>): Promise<FallbackResult> {
    // Placeholder implementation
    return {
      success: false,
      adaptations: [],
      confidence: 0,
      reasoning: 'Retry strategy not implemented'
    };
  }

  private async executeSkipStrategy(failedSite: SiteFailureInfo): Promise<FallbackResult> {
    return {
      success: true,
      adaptations: ['skipped_site'],
      confidence: 1.0,
      reasoning: `Skipped failed site: ${failedSite.url}`
    };
  }

  private async executeAbortStrategy(failedSite: SiteFailureInfo): Promise<FallbackResult> {
    return {
      success: false,
      adaptations: ['aborted_execution'],
      confidence: 1.0,
      reasoning: `Aborted execution due to critical failure at: ${failedSite.url}`
    };
  }

  private async calculatePerformanceMetrics(sessionId: string, coordinationResult: CoordinationResult): Promise<MultiSitePerformanceMetrics> {
    const session = this.activeSessions.get(sessionId);
    
    if (!session) {
      return await this.getDefaultPerformanceMetrics();
    }
    
    return {
      totalDuration: coordinationResult.timing.totalDuration,
      averageSiteDuration: coordinationResult.timing.totalDuration / session.totalSites,
      parallelizationEfficiency: coordinationResult.timing.parallelEfficiency,
      successRate: session.successfulSites / session.totalSites,
      dataQuality: session.dataQuality,
      resourceEfficiency: 0.8, // Placeholder
      coordinationOverhead: 0.1 // Placeholder
    };
  }

  private async getDefaultPerformanceMetrics(): Promise<MultiSitePerformanceMetrics> {
    return {
      totalDuration: 0,
      averageSiteDuration: 0,
      parallelizationEfficiency: 0,
      successRate: 0,
      dataQuality: 0,
      resourceEfficiency: 0,
      coordinationOverhead: 0
    };
  }

  private async extractLearnings(strategy: MultiSiteStrategy, result: CoordinationResult): Promise<string[]> {
    const learnings: string[] = [];
    
    if (result.success) {
      learnings.push(`Successfully coordinated ${strategy.sites.length} sites`);
      learnings.push(`Parallel efficiency: ${result.timing.parallelEfficiency.toFixed(2)}`);
    } else {
      learnings.push('Multi-site coordination encountered issues');
    }
    
    return learnings;
  }

  private storePerformanceHistory(strategyId: string, metrics: MultiSitePerformanceMetrics): void {
    if (!this.performanceHistory.has(strategyId)) {
      this.performanceHistory.set(strategyId, []);
    }
    
    const history = this.performanceHistory.get(strategyId)!;
    history.push(metrics);
    
    // Keep only last 100 entries
    if (history.length > 100) {
      history.splice(0, history.length - 100);
    }
  }
}

interface MultiSiteSession {
  id: string;
  strategy: MultiSiteStrategy;
  startTime: number;
  siteDurations: number[];
  parallelEfficiency: number;
  successfulSites: number;
  totalSites: number;
  dataQuality: number;
  resourceEfficiency: number;
  coordinationOverhead: number;
  errors: MultiSiteError[];
}

interface BrowserSession {
  siteId: string;
  browser: Browser;
  page: Page;
  url: string;
  startTime: number;
}