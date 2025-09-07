/**
 * Debug manager for comprehensive logging and debugging capabilities
 */
import { Browser, Page } from 'puppeteer';
import { Logger, LogEntry } from './Logger.js';
import { PerformanceMonitor, PerformanceMetrics } from './PerformanceMonitor.js';
import { AutomationStep, StepResult } from '../../shared/types.js';
import { LOG_LEVELS } from '../../shared/constants.js';
import { EventEmitter } from 'events';

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  CRITICAL = 4
}

export interface DebugSession {
  id: string;
  startTime: number;
  endTime?: number;
  steps: DebugStep[];
  screenshots: DebugScreenshot[];
  logs: DebugLog[];
  performance: PerformanceMetrics[];
  metadata: Record<string, any>;
}

export interface DebugStep {
  id: string;
  stepIndex: number;
  step: AutomationStep;
  result: StepResult;
  timestamp: number;
  duration: number;
  screenshot?: string; // Base64 encoded screenshot
  pageState?: PageState;
  errors?: string[];
}

export interface DebugScreenshot {
  id: string;
  timestamp: number;
  description: string;
  data: string; // Base64 encoded
  metadata?: Record<string, any>;
}

export interface DebugLog {
  id: string;
  timestamp: number;
  level: LogLevel;
  message: string;
  category: string;
  data?: any;
  stackTrace?: string;
}

export interface PageState {
  url: string;
  title: string;
  viewport: { width: number; height: number };
  cookies: any[];
  localStorage: Record<string, string>;
  sessionStorage: Record<string, string>;
  elementCount: number;
  loadTime: number;
}

export interface DebugConfig {
  enabled: boolean;
  captureScreenshots: boolean;
  capturePageState: boolean;
  capturePerformance: boolean;
  logLevel: LogLevel;
  maxSessions: number;
  maxStepsPerSession: number;
  autoCleanup: boolean;
}

export class DebugManager extends EventEmitter {
  private logger: Logger;
  private performanceMonitor: PerformanceMonitor;
  private sessions: Map<string, DebugSession> = new Map();
  private currentSession: DebugSession | null = null;
  private config: DebugConfig;
  private debugMode: boolean = false;
  private realTimeEnabled: boolean = false;
  
  constructor(performanceMonitor: PerformanceMonitor) {
    super();
    this.logger = new Logger();
    this.performanceMonitor = performanceMonitor;
    this.config = {
      enabled: true,
      captureScreenshots: true,
      capturePageState: true,
      capturePerformance: true,
      logLevel: LogLevel.DEBUG,
      maxSessions: 50,
      maxStepsPerSession: 1000,
      autoCleanup: true
    };
  }
  
  /**
   * Start a new debug session
   */
  startSession(metadata?: Record<string, any>): string {
    if (!this.config.enabled) {
      return '';
    }
    
    const sessionId = this.generateSessionId();
    const session: DebugSession = {
      id: sessionId,
      startTime: Date.now(),
      steps: [],
      screenshots: [],
      logs: [],
      performance: [],
      metadata: metadata || {}
    };
    
    this.sessions.set(sessionId, session);
    this.currentSession = session;
    
    // Cleanup old sessions if needed
    if (this.config.autoCleanup && this.sessions.size > this.config.maxSessions) {
      this.cleanupOldSessions();
    }
    
    this.logger.info(`Debug session started: ${sessionId}`);
    return sessionId;
  }
  
  /**
   * End the current debug session
   */
  endSession(sessionId?: string): void {
    const session = sessionId ? this.sessions.get(sessionId) : this.currentSession;
    
    if (session) {
      session.endTime = Date.now();
      
      if (this.currentSession?.id === session.id) {
        this.currentSession = null;
      }
      
      this.logger.info(`Debug session ended: ${session.id}, duration: ${session.endTime - session.startTime}ms`);
    }
  }
  
  /**
   * Log a debug step
   */
  async logStep(step: AutomationStep, result: StepResult, page?: Page): Promise<void> {
    if (!this.config.enabled || !this.currentSession) {
      return;
    }
    
    const debugStep: DebugStep = {
      id: this.generateStepId(),
      stepIndex: this.currentSession.steps.length,
      step,
      result,
      timestamp: Date.now(),
      duration: result.duration || 0,
      errors: result.error ? [result.error] : undefined
    };
    
    // Capture screenshot if enabled and page is available
    if (this.config.captureScreenshots && page && !page.isClosed()) {
      try {
        const screenshot = await page.screenshot({ encoding: 'base64' });
        debugStep.screenshot = screenshot as string;
      } catch (error) {
        this.logger.warn('Failed to capture debug screenshot:', error);
      }
    }
    
    // Capture page state if enabled
    if (this.config.capturePageState && page && !page.isClosed()) {
      try {
        debugStep.pageState = await this.capturePageState(page);
      } catch (error) {
        this.logger.warn('Failed to capture page state:', error);
      }
    }
    
    this.currentSession.steps.push(debugStep);
    
    // Limit steps per session
    if (this.currentSession.steps.length > this.config.maxStepsPerSession) {
      this.currentSession.steps = this.currentSession.steps.slice(-this.config.maxStepsPerSession);
    }
    
    this.logger.debug(`Debug step logged: ${step.type} - ${result.success ? 'SUCCESS' : 'FAILED'}`);
    
    // Emit real-time debug step event
    if (this.realTimeEnabled) {
      this.emit('debug-step', debugStep);
    }
  }
  
  /**
   * Add a debug log entry
   */
  addLog(level: LogLevel, message: string, category: string, data?: any): void {
    if (!this.config.enabled || !this.currentSession) {
      return;
    }
    
    const logEntry: DebugLog = {
      id: this.generateLogId(),
      timestamp: Date.now(),
      level,
      message,
      category,
      data,
      stackTrace: level >= LogLevel.ERROR ? new Error().stack : undefined
    };
    
    this.currentSession.logs.push(logEntry);
    
    // Also log to main logger
    switch (level) {
      case LogLevel.DEBUG:
        this.logger.debug(`[${category}] ${message}`, data);
        break;
      case LogLevel.INFO:
        this.logger.info(`[${category}] ${message}`, data);
        break;
      case LogLevel.WARN:
        this.logger.warn(`[${category}] ${message}`, data);
        break;
      case LogLevel.ERROR:
      case LogLevel.CRITICAL:
        this.logger.error(`[${category}] ${message}`, data);
        break;
    }
  }
  
  /**
   * Capture a debug screenshot
   */
  async captureScreenshot(page: Page, description: string, metadata?: Record<string, any>): Promise<void> {
    if (!this.config.enabled || !this.currentSession || !this.config.captureScreenshots) {
      return;
    }
    
    try {
      const screenshot = await page.screenshot({ encoding: 'base64' });
      
      const debugScreenshot: DebugScreenshot = {
        id: this.generateScreenshotId(),
        timestamp: Date.now(),
        description,
        data: screenshot as string,
        metadata
      };
      
      this.currentSession.screenshots.push(debugScreenshot);
      this.logger.debug(`Debug screenshot captured: ${description}`);
    } catch (error) {
      this.logger.warn('Failed to capture debug screenshot:', error);
    }
  }
  
  /**
   * Add performance metrics to current session
   */
  addPerformanceMetrics(metrics: PerformanceMetrics): void {
    if (!this.config.enabled || !this.currentSession || !this.config.capturePerformance) {
      return;
    }
    
    this.currentSession.performance.push(metrics);
  }
  
  /**
   * Get debug session
   */
  getSession(sessionId: string): DebugSession | null {
    return this.sessions.get(sessionId) || null;
  }
  
  /**
   * Get all debug sessions
   */
  getAllSessions(): DebugSession[] {
    return Array.from(this.sessions.values()).sort((a, b) => b.startTime - a.startTime);
  }
  
  /**
   * Get current session
   */
  getCurrentSession(): DebugSession | null {
    return this.currentSession;
  }
  
  /**
   * Enable/disable debug mode
   */
  setDebugMode(enabled: boolean): void {
    this.debugMode = enabled;
    this.logger.info(`Debug mode ${enabled ? 'enabled' : 'disabled'}`);
  }
  
  /**
   * Check if debug mode is enabled
   */
  isDebugMode(): boolean {
    return this.debugMode;
  }
  
  /**
   * Update debug configuration
   */
  updateConfig(config: Partial<DebugConfig>): void {
    this.config = { ...this.config, ...config };
    this.logger.info('Debug configuration updated:', config);
  }
  
  /**
   * Get debug configuration
   */
  getConfig(): DebugConfig {
    return { ...this.config };
  }
  
  /**
   * Export debug session as JSON
   */
  exportSession(sessionId: string): string | null {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return null;
    }
    
    return JSON.stringify(session, null, 2);
  }
  
  /**
   * Clear all debug sessions
   */
  clearAllSessions(): void {
    this.sessions.clear();
    this.currentSession = null;
    this.logger.info('All debug sessions cleared');
  }
  
  /**
   * Enable/disable real-time events
   */
  setRealTimeEnabled(enabled: boolean): void {
    this.realTimeEnabled = enabled;
    this.logger.setRealTimeEnabled(enabled);
    this.logger.info(`Real-time debug events ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Check if real-time is enabled
   */
  isRealTimeEnabled(): boolean {
    return this.realTimeEnabled;
  }

  /**
   * Get debug statistics
   */
  getStats(): {
    totalSessions: number;
    activeSessions: number;
    totalSteps: number;
    totalScreenshots: number;
    totalLogs: number;
    memoryUsage: number;
  } {
    let totalSteps = 0;
    let totalScreenshots = 0;
    let totalLogs = 0;
    let activeSessions = 0;
    
    for (const session of this.sessions.values()) {
      if (!session.endTime) {
        activeSessions++;
      }
      totalSteps += session.steps.length;
      totalScreenshots += session.screenshots.length;
      totalLogs += session.logs.length;
    }
    
    return {
      totalSessions: this.sessions.size,
      activeSessions,
      totalSteps,
      totalScreenshots,
      totalLogs,
      memoryUsage: this.estimateMemoryUsage()
    };
  }
  
  /**
   * Capture current page state
   */
  private async capturePageState(page: Page): Promise<PageState> {
    const [url, title, viewport, cookies, localStorage, sessionStorage, elementCount] = await Promise.all([
      page.url(),
      page.title(),
      page.viewport(),
      page.cookies(),
      page.evaluate(() => ({ ...localStorage })),
      page.evaluate(() => ({ ...sessionStorage })),
      page.evaluate(() => document.querySelectorAll('*').length)
    ]);
    
    return {
      url,
      title,
      viewport: viewport || { width: 0, height: 0 },
      cookies,
      localStorage,
      sessionStorage,
      elementCount,
      loadTime: Date.now()
    };
  }
  
  /**
   * Clean up old debug sessions
   */
  private cleanupOldSessions(): void {
    const sessions = Array.from(this.sessions.entries())
      .sort((a, b) => a[1].startTime - b[1].startTime);
    
    const toRemove = sessions.length - this.config.maxSessions + 1;
    
    for (let i = 0; i < toRemove; i++) {
      const [sessionId] = sessions[i];
      this.sessions.delete(sessionId);
    }
    
    this.logger.info(`Cleaned up ${toRemove} old debug sessions`);
  }
  
  /**
   * Estimate memory usage of debug data
   */
  private estimateMemoryUsage(): number {
    let totalSize = 0;
    
    for (const session of this.sessions.values()) {
      // Rough estimation
      totalSize += JSON.stringify(session).length * 2; // UTF-16 encoding
    }
    
    return totalSize;
  }
  
  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    return `debug_session_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }
  
  /**
   * Generate unique step ID
   */
  private generateStepId(): string {
    return `debug_step_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }
  
  /**
   * Generate unique log ID
   */
  private generateLogId(): string {
    return `debug_log_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }
  
  /**
   * Generate unique screenshot ID
   */
  private generateScreenshotId(): string {
    return `debug_screenshot_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }
}