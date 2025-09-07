import { app } from 'electron';
import { join } from 'path';
import { createWriteStream, existsSync, mkdirSync, WriteStream, readFileSync, readdirSync, statSync } from 'fs';
import { LOG_LEVELS } from '../../shared/constants.js';
import { EventEmitter } from 'events';

export interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  data?: any;
  context?: string;
  sessionId?: string;
  userId?: string;
}

export interface LogFilter {
  level?: string;
  startDate?: Date;
  endDate?: Date;
  context?: string;
  searchTerm?: string;
  limit?: number;
}

export interface LogStats {
  totalEntries: number;
  errorCount: number;
  warningCount: number;
  infoCount: number;
  debugCount: number;
  fileSize: number;
  oldestEntry?: Date;
  newestEntry?: Date;
}

export class Logger extends EventEmitter {
  private logStream: WriteStream | null = null;
  private logLevel: string;
  private logDir: string;
  private sessionId: string;
  private context: string;
  private debugMode: boolean = false;
  private performanceMarks: Map<string, number> = new Map();
  private logBuffer: LogEntry[] = [];
  private maxBufferSize: number = 1000;
  private realTimeEnabled: boolean = false;

  constructor(level: string = LOG_LEVELS.INFO, context: string = 'main') {
    super();
    this.logLevel = level;
    this.logDir = join(app.getPath('userData'), 'logs');
    this.context = context;
    this.sessionId = this.generateSessionId();
    this.initializeLogger();
  }

  private initializeLogger(): void {
    try {
      // Create logs directory if it doesn't exist
      if (!existsSync(this.logDir)) {
        mkdirSync(this.logDir, { recursive: true });
      }

      // Create log file with current date
      const logFileName = `automation-${new Date().toISOString().split('T')[0]}.log`;
      const logFilePath = join(this.logDir, logFileName);

      this.logStream = createWriteStream(logFilePath, { flags: 'a' });
      
      this.info('Logger initialized successfully');
    } catch (error) {
      console.error('Failed to initialize logger:', error);
    }
  }

  private shouldLog(level: string): boolean {
    const levels = [LOG_LEVELS.ERROR, LOG_LEVELS.WARN, LOG_LEVELS.INFO, LOG_LEVELS.DEBUG, LOG_LEVELS.TRACE];
    const currentLevelIndex = levels.indexOf(this.logLevel as any);
    const messageLevelIndex = levels.indexOf(level as any);
    
    return messageLevelIndex <= currentLevelIndex;
  }

  private formatMessage(level: string, message: string, data?: any): string {
    const timestamp = new Date().toISOString();
    const dataStr = data ? ` | Data: ${JSON.stringify(data, null, 2)}` : '';
    return `[${timestamp}] [${level.toUpperCase()}] ${message}${dataStr}`;
  }

  private writeLog(level: string, message: string, data?: any): void {
    if (!this.shouldLog(level)) return;

    const timestamp = new Date().toISOString();
    const logEntry: LogEntry = {
      timestamp,
      level,
      message,
      data,
      context: this.context,
      sessionId: this.sessionId
    };

    // Add to buffer
    this.addToBuffer(logEntry);

    const formattedMessage = this.formatMessage(level, message, data);
    
    // Write to console (with colors in debug mode)
    if (this.debugMode) {
      this.writeColoredLog(level, formattedMessage);
    } else {
      switch (level) {
        case LOG_LEVELS.ERROR:
          console.error(formattedMessage);
          break;
        case LOG_LEVELS.WARN:
          console.warn(formattedMessage);
          break;
        case LOG_LEVELS.DEBUG:
        case LOG_LEVELS.TRACE:
          console.debug(formattedMessage);
          break;
        default:
          console.log(formattedMessage);
      }
    }

    // Write to file
    if (this.logStream) {
      this.logStream.write(JSON.stringify(logEntry) + '\n');
    }

    // Emit real-time log event if enabled
    if (this.realTimeEnabled) {
      this.emit('log', logEntry);
    }
  }

  error(message: string, data?: any): void {
    this.writeLog(LOG_LEVELS.ERROR, message, data);
  }

  warn(message: string, data?: any): void {
    this.writeLog(LOG_LEVELS.WARN, message, data);
  }

  info(message: string, data?: any): void {
    this.writeLog(LOG_LEVELS.INFO, message, data);
  }

  debug(message: string, data?: any): void {
    this.writeLog(LOG_LEVELS.DEBUG, message, data);
  }

  trace(message: string, data?: any): void {
    this.writeLog(LOG_LEVELS.TRACE, message, data);
  }

  setLevel(level: string): void {
    this.logLevel = level;
    this.info(`Log level changed to: ${level}`);
  }

  close(): void {
    if (this.logStream) {
      this.logStream.end();
      this.logStream = null;
    }
  }

  /**
   * Enable or disable debug mode
   */
  setDebugMode(enabled: boolean): void {
    this.debugMode = enabled;
    this.info(`Debug mode ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Start performance timing
   */
  startTimer(label: string): void {
    this.performanceMarks.set(label, Date.now());
    if (this.debugMode) {
      this.debug(`Timer started: ${label}`);
    }
  }

  /**
   * End performance timing and log duration
   */
  endTimer(label: string): number {
    const startTime = this.performanceMarks.get(label);
    if (!startTime) {
      this.warn(`Timer not found: ${label}`);
      return 0;
    }

    const duration = Date.now() - startTime;
    this.performanceMarks.delete(label);
    
    if (this.debugMode) {
      this.debug(`Timer ended: ${label} - Duration: ${duration}ms`);
    }
    
    return duration;
  }

  /**
   * Log with performance timing
   */
  logWithTiming<T>(label: string, fn: () => T): T {
    this.startTimer(label);
    try {
      const result = fn();
      this.endTimer(label);
      return result;
    } catch (error) {
      this.endTimer(label);
      this.error(`Error in timed operation ${label}:`, error);
      throw error;
    }
  }

  /**
   * Log with performance timing (async)
   */
  async logWithTimingAsync<T>(label: string, fn: () => Promise<T>): Promise<T> {
    this.startTimer(label);
    try {
      const result = await fn();
      this.endTimer(label);
      return result;
    } catch (error) {
      this.endTimer(label);
      this.error(`Error in timed async operation ${label}:`, error);
      throw error;
    }
  }

  /**
   * Get recent log entries from buffer
   */
  getRecentLogs(limit: number = 100): LogEntry[] {
    return this.logBuffer.slice(-limit);
  }

  /**
   * Search logs with filters
   */
  searchLogs(filter: LogFilter): LogEntry[] {
    let results = [...this.logBuffer];

    if (filter.level) {
      results = results.filter(entry => entry.level === filter.level);
    }

    if (filter.context) {
      results = results.filter(entry => entry.context === filter.context);
    }

    if (filter.searchTerm) {
      const term = filter.searchTerm.toLowerCase();
      results = results.filter(entry => 
        entry.message.toLowerCase().includes(term) ||
        (entry.data && JSON.stringify(entry.data).toLowerCase().includes(term))
      );
    }

    if (filter.startDate) {
      results = results.filter(entry => new Date(entry.timestamp) >= filter.startDate!);
    }

    if (filter.endDate) {
      results = results.filter(entry => new Date(entry.timestamp) <= filter.endDate!);
    }

    if (filter.limit) {
      results = results.slice(-filter.limit);
    }

    return results;
  }

  /**
   * Get log statistics
   */
  getLogStats(): LogStats {
    const stats: LogStats = {
      totalEntries: this.logBuffer.length,
      errorCount: 0,
      warningCount: 0,
      infoCount: 0,
      debugCount: 0,
      fileSize: 0
    };

    for (const entry of this.logBuffer) {
      switch (entry.level) {
        case LOG_LEVELS.ERROR:
          stats.errorCount++;
          break;
        case LOG_LEVELS.WARN:
          stats.warningCount++;
          break;
        case LOG_LEVELS.INFO:
          stats.infoCount++;
          break;
        case LOG_LEVELS.DEBUG:
        case LOG_LEVELS.TRACE:
          stats.debugCount++;
          break;
      }
    }

    if (this.logBuffer.length > 0) {
      stats.oldestEntry = new Date(this.logBuffer[0].timestamp);
      stats.newestEntry = new Date(this.logBuffer[this.logBuffer.length - 1].timestamp);
    }

    return stats;
  }

  /**
   * Export logs to file
   */
  async exportLogs(filePath: string, filter?: LogFilter): Promise<void> {
    const logs = filter ? this.searchLogs(filter) : this.logBuffer;
    const exportData = {
      exportDate: new Date().toISOString(),
      sessionId: this.sessionId,
      totalEntries: logs.length,
      logs
    };

    const fs = await import('fs/promises');
    await fs.writeFile(filePath, JSON.stringify(exportData, null, 2));
    this.info(`Logs exported to: ${filePath}`);
  }

  /**
   * Clear log buffer
   */
  clearBuffer(): void {
    this.logBuffer = [];
    this.info('Log buffer cleared');
  }

  /**
   * Enable or disable real-time log events
   */
  setRealTimeEnabled(enabled: boolean): void {
    this.realTimeEnabled = enabled;
    this.info(`Real-time logging ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Get real-time status
   */
  isRealTimeEnabled(): boolean {
    return this.realTimeEnabled;
  }



  /**
   * Log automation activity with structured data
   */
  logAutomationActivity(activity: string, stepType: string, data?: any): void {
    const activityData = {
      activity,
      stepType,
      timestamp: new Date().toISOString(),
      ...data
    };
    
    this.info(`Automation Activity: ${activity}`, activityData);
    
    // Emit specific automation event
    if (this.realTimeEnabled) {
      this.emit('automation-activity', activityData);
    }
  }

  /**
   * Log performance metrics
   */
  logPerformanceMetrics(metrics: any): void {
    this.debug('Performance Metrics', metrics);
    
    if (this.realTimeEnabled) {
      this.emit('performance-metrics', metrics);
    }
  }

  /**
   * Log debug information with step details
   */
  logDebugStep(stepId: string, stepType: string, result: any, duration: number): void {
    const debugData = {
      stepId,
      stepType,
      result,
      duration,
      timestamp: new Date().toISOString()
    };
    
    this.debug(`Debug Step: ${stepType} (${stepId})`, debugData);
    
    if (this.realTimeEnabled) {
      this.emit('debug-step', debugData);
    }
  }

  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  /**
   * Add entry to buffer
   */
  private addToBuffer(entry: LogEntry): void {
    this.logBuffer.push(entry);
    
    // Maintain buffer size limit
    if (this.logBuffer.length > this.maxBufferSize) {
      this.logBuffer = this.logBuffer.slice(-this.maxBufferSize);
    }
  }

  /**
   * Write colored log to console (debug mode)
   */
  private writeColoredLog(level: string, message: string): void {
    const colors = {
      [LOG_LEVELS.ERROR]: '\x1b[31m', // Red
      [LOG_LEVELS.WARN]: '\x1b[33m',  // Yellow
      [LOG_LEVELS.INFO]: '\x1b[36m',  // Cyan
      [LOG_LEVELS.DEBUG]: '\x1b[35m', // Magenta
      [LOG_LEVELS.TRACE]: '\x1b[37m'  // White
    };
    
    const reset = '\x1b[0m';
    const color = colors[level] || '\x1b[0m';
    
    console.log(`${color}${message}${reset}`);
  }
}