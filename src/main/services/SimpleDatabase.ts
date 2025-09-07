/**
 * A simple in-memory database service for the minimal application
 * Enhanced with error handling, recovery mechanisms, and performance optimization
 */
export class SimpleDatabase {
  private history: any[] = [];
  private workflows: any[] = [];
  private settings: Map<string, any> = new Map();
  private isInitialized: boolean = false;
  private initializationError: Error | null = null;
  
  // Performance optimization properties
  private cache: Map<string, { data: any; timestamp: number; ttl: number }> = new Map();
  private readonly CACHE_TTL = 30000; // 30 seconds default TTL
  private readonly MAX_HISTORY_SIZE = 1000;
  private readonly MAX_WORKFLOWS_SIZE = 100;
  private lastCleanup: number = Date.now();
  private readonly CLEANUP_INTERVAL = 300000; // 5 minutes

  constructor() {
    // Initialize with some sample data
    try {
      this.initSampleData();
      this.isInitialized = true;
    } catch (error) {
      this.initializationError = error instanceof Error ? error : new Error('Unknown initialization error');
      console.error('Failed to initialize SimpleDatabase:', this.initializationError);
    }
  }

  private initSampleData() {
    // Sample automation history
    this.history = [
      {
        id: '1',
        timestamp: new Date().getTime() - 86400000, // 1 day ago
        command: 'Search for flights from New York to London',
        result: { success: true, message: 'Found 5 flights' },
        duration: 3.5
      },
      {
        id: '2',
        timestamp: new Date().getTime() - 43200000, // 12 hours ago
        command: 'Fill out contact form on example.com',
        result: { success: true, message: 'Form submitted successfully' },
        duration: 1.2
      },
      {
        id: '3',
        timestamp: new Date().getTime() - 3600000, // 1 hour ago
        command: 'Research AI trends for 2023',
        result: { success: true, message: 'Generated research report' },
        duration: 5.7
      }
    ];

    // Sample workflows
    this.workflows = [
      {
        id: '1',
        name: 'Flight Search',
        description: 'Search for flights between cities',
        command: 'Search for flights from {origin} to {destination} on {date}',
        createdAt: new Date().getTime() - 172800000, // 2 days ago
        lastRun: new Date().getTime() - 86400000 // 1 day ago
      },
      {
        id: '2',
        name: 'Form Automation',
        description: 'Automatically fill out web forms',
        command: 'Fill out form on {website} with {data}',
        createdAt: new Date().getTime() - 259200000, // 3 days ago
        lastRun: new Date().getTime() - 43200000 // 12 hours ago
      },
      {
        id: '3',
        name: 'Research Assistant',
        description: 'Research topics and generate reports',
        command: 'Research {topic} and create a summary',
        createdAt: new Date().getTime() - 345600000, // 4 days ago
        lastRun: new Date().getTime() - 3600000 // 1 hour ago
      }
    ];

    // Sample settings
    this.settings.set('theme', 'dark');
    this.settings.set('aiProvider', 'OpenAI');
    this.settings.set('browserSettings', { headless: true, defaultTimeout: 30000 });
  }

  private checkInitialization(): void {
    if (!this.isInitialized) {
      if (this.initializationError) {
        throw new Error(`Database not properly initialized: ${this.initializationError.message}`);
      }
      throw new Error('Database not properly initialized');
    }
  }

  private validateData<T>(data: T, validator: (item: T) => boolean, errorMessage: string): void {
    if (!validator(data)) {
      throw new Error(errorMessage);
    }
  }

  private createBackupData(): void {
    try {
      // In a real implementation, this would save to persistent storage
      console.log('Creating backup of database data');
    } catch (error) {
      console.warn('Failed to create backup:', error);
    }
  }

  async initialize(): Promise<void> {
    try {
      if (this.initializationError) {
        // Attempt to recover from initialization error
        console.log('Attempting to recover from initialization error...');
        this.initSampleData();
        this.isInitialized = true;
        this.initializationError = null;
      }
      
      console.log('Simple database initialized');
      this.createBackupData();
      return Promise.resolve();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error during initialization';
      console.error('Database initialization failed:', errorMessage);
      throw new Error(`Failed to initialize database: ${errorMessage}`);
    }
  }

  async getAutomationHistory(): Promise<any[]> {
    try {
      this.checkInitialization();
      this.performPeriodicCleanup();
      
      // Check cache first
      const cacheKey = 'automation_history';
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        return Promise.resolve(cached);
      }
      
      // Validate history data integrity
      const validHistory = this.history.filter(item => {
        return item && 
               typeof item.id === 'string' && 
               typeof item.timestamp === 'number' && 
               typeof item.command === 'string';
      });

      if (validHistory.length !== this.history.length) {
        console.warn(`Filtered out ${this.history.length - validHistory.length} invalid history items`);
      }

      // Cache the result
      this.setCache(cacheKey, validHistory, this.CACHE_TTL);
      
      return Promise.resolve(validHistory);
    } catch (error) {
      console.error('Failed to get automation history:', error);
      // Return empty array as fallback
      return Promise.resolve([]);
    }
  }

  async getWorkflows(): Promise<any[]> {
    try {
      this.checkInitialization();
      this.performPeriodicCleanup();
      
      // Check cache first
      const cacheKey = 'workflows';
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        return Promise.resolve(cached);
      }
      
      // Validate workflow data integrity
      const validWorkflows = this.workflows.filter(item => {
        return item && 
               typeof item.id === 'string' && 
               typeof item.name === 'string' && 
               typeof item.command === 'string';
      });

      if (validWorkflows.length !== this.workflows.length) {
        console.warn(`Filtered out ${this.workflows.length - validWorkflows.length} invalid workflow items`);
      }

      // Cache the result
      this.setCache(cacheKey, validWorkflows, this.CACHE_TTL);

      return Promise.resolve(validWorkflows);
    } catch (error) {
      console.error('Failed to get workflows:', error);
      // Return empty array as fallback
      return Promise.resolve([]);
    }
  }

  async saveWorkflow(workflow: any): Promise<string> {
    try {
      this.checkInitialization();
      
      // Validate workflow data
      this.validateData(workflow, 
        (w) => w && typeof w === 'object' && (typeof w.name === 'string' || typeof w.command === 'string'),
        'Invalid workflow data: must be an object with name or command'
      );

      const id = workflow.id || Date.now().toString();
      const sanitizedWorkflow = {
        ...workflow,
        id,
        createdAt: workflow.createdAt || Date.now(),
        name: workflow.name || 'Untitled Workflow',
        description: workflow.description || '',
        command: workflow.command || ''
      };
      
      const existingIndex = this.workflows.findIndex(w => w.id === id);
      if (existingIndex >= 0) {
        this.workflows[existingIndex] = sanitizedWorkflow;
        console.log(`Updated existing workflow with id: ${id}`);
      } else {
        this.workflows.push(sanitizedWorkflow);
        console.log(`Created new workflow with id: ${id}`);
      }
      
      this.createBackupData();
      return Promise.resolve(id);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error saving workflow';
      console.error('Failed to save workflow:', errorMessage);
      throw new Error(`Failed to save workflow: ${errorMessage}`);
    }
  }

  async saveResult(result: any): Promise<string> {
    try {
      this.checkInitialization();
      
      // Validate result data
      this.validateData(result,
        (r) => r && typeof r === 'object',
        'Invalid result data: must be an object'
      );

      const id = result.id || Date.now().toString();
      const sanitizedResult = {
        ...result,
        id,
        timestamp: result.timestamp || Date.now(),
        command: result.command || 'Unknown command',
        result: result.result || { success: false, message: 'No result data' }
      };
      
      // Prevent memory overflow by limiting history size
      if (this.history.length >= 1000) {
        console.warn('History limit reached, removing oldest entries');
        this.history = this.history.slice(-900); // Keep last 900 entries
      }
      
      this.history.push(sanitizedResult);
      console.log(`Saved automation result with id: ${id}`);
      
      this.createBackupData();
      return Promise.resolve(id);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error saving result';
      console.error('Failed to save result:', errorMessage);
      throw new Error(`Failed to save result: ${errorMessage}`);
    }
  }

  async getSetting(key: string): Promise<any> {
    try {
      this.checkInitialization();
      
      // Validate key
      this.validateData(key,
        (k) => typeof k === 'string' && k.length > 0,
        'Invalid setting key: must be a non-empty string'
      );

      const value = this.settings.get(key);
      
      // Return default values for common settings if not found
      if (value === undefined) {
        const defaultValues: Record<string, any> = {
          'theme': 'dark',
          'aiProvider': 'OpenAI',
          'browserSettings': { headless: true, defaultTimeout: 30000 },
          'maxConcurrentAutomations': 3,
          'retryAttempts': 3,
          'debugMode': false,
          'autoSaveResults': true,
          'notificationsEnabled': true
        };
        
        if (key in defaultValues) {
          console.log(`Using default value for setting '${key}':`, defaultValues[key]);
          return Promise.resolve(defaultValues[key]);
        }
      }
      
      return Promise.resolve(value);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error getting setting';
      console.error('Failed to get setting:', errorMessage);
      throw new Error(`Failed to get setting: ${errorMessage}`);
    }
  }

  async setSetting(key: string, value: any): Promise<void> {
    try {
      this.checkInitialization();
      
      // Validate key
      this.validateData(key,
        (k) => typeof k === 'string' && k.length > 0,
        'Invalid setting key: must be a non-empty string'
      );

      // Additional validation for specific settings
      if (key === 'theme' && !['light', 'dark', 'auto'].includes(value)) {
        throw new Error('Theme must be one of: light, dark, auto');
      }
      
      if (key === 'aiProvider' && !['OpenAI', 'Claude', 'Local Model'].includes(value)) {
        throw new Error('AI Provider must be one of: OpenAI, Claude, Local Model');
      }
      
      if (key === 'maxConcurrentAutomations' && (!Number.isInteger(value) || value < 1 || value > 10)) {
        throw new Error('Max concurrent automations must be an integer between 1 and 10');
      }

      this.settings.set(key, value);
      console.log(`Setting '${key}' updated successfully`);
      
      this.createBackupData();
      return Promise.resolve();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error setting value';
      console.error('Failed to set setting:', errorMessage);
      throw new Error(`Failed to set setting: ${errorMessage}`);
    }
  }

  async close(): Promise<void> {
    try {
      console.log('Closing Simple database...');
      this.createBackupData();
      
      // Clear data to free memory
      this.history = [];
      this.workflows = [];
      this.settings.clear();
      this.isInitialized = false;
      
      console.log('Simple database closed successfully');
      return Promise.resolve();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error closing database';
      console.error('Failed to close database:', errorMessage);
      throw new Error(`Failed to close database: ${errorMessage}`);
    }
  }

  // Additional utility methods for error recovery
  async healthCheck(): Promise<{ status: string; issues: string[] }> {
    const issues: string[] = [];
    
    try {
      if (!this.isInitialized) {
        issues.push('Database not initialized');
      }
      
      if (this.initializationError) {
        issues.push(`Initialization error: ${this.initializationError.message}`);
      }
      
      // Check data integrity
      const invalidHistory = this.history.filter(item => 
        !item || typeof item.id !== 'string' || typeof item.timestamp !== 'number'
      );
      if (invalidHistory.length > 0) {
        issues.push(`${invalidHistory.length} invalid history items found`);
      }
      
      const invalidWorkflows = this.workflows.filter(item =>
        !item || typeof item.id !== 'string' || typeof item.name !== 'string'
      );
      if (invalidWorkflows.length > 0) {
        issues.push(`${invalidWorkflows.length} invalid workflow items found`);
      }
      
      return {
        status: issues.length === 0 ? 'healthy' : 'issues_detected',
        issues
      };
    } catch (error) {
      return {
        status: 'error',
        issues: [`Health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`]
      };
    }
  }

  async repair(): Promise<{ success: boolean; message: string }> {
    try {
      console.log('Starting database repair...');
      
      // Attempt to reinitialize if needed
      if (!this.isInitialized || this.initializationError) {
        this.initSampleData();
        this.isInitialized = true;
        this.initializationError = null;
      }
      
      // Clean up invalid data
      const originalHistoryLength = this.history.length;
      this.history = this.history.filter(item => 
        item && typeof item.id === 'string' && typeof item.timestamp === 'number'
      );
      
      const originalWorkflowsLength = this.workflows.length;
      this.workflows = this.workflows.filter(item =>
        item && typeof item.id === 'string' && typeof item.name === 'string'
      );
      
      const historyFixed = originalHistoryLength - this.history.length;
      const workflowsFixed = originalWorkflowsLength - this.workflows.length;
      
      // Clear cache after repair
      this.clearCache();
      
      console.log(`Database repair completed. Fixed ${historyFixed} history items and ${workflowsFixed} workflow items.`);
      
      return {
        success: true,
        message: `Repair completed successfully. Fixed ${historyFixed + workflowsFixed} items.`
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown repair error';
      console.error('Database repair failed:', errorMessage);
      return {
        success: false,
        message: `Repair failed: ${errorMessage}`
      };
    }
  }

  // Performance optimization methods
  private getFromCache(key: string): any | null {
    const cached = this.cache.get(key);
    if (!cached) {
      return null;
    }
    
    const now = Date.now();
    if (now > cached.timestamp + cached.ttl) {
      // Cache expired
      this.cache.delete(key);
      return null;
    }
    
    return cached.data;
  }

  private setCache(key: string, data: any, ttl: number = this.CACHE_TTL): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
  }

  private clearCache(): void {
    this.cache.clear();
    console.log('Cache cleared');
  }

  private performPeriodicCleanup(): void {
    const now = Date.now();
    
    // Only perform cleanup if enough time has passed
    if (now - this.lastCleanup < this.CLEANUP_INTERVAL) {
      return;
    }
    
    try {
      // Clean expired cache entries
      const expiredKeys: string[] = [];
      for (const [key, value] of this.cache.entries()) {
        if (now > value.timestamp + value.ttl) {
          expiredKeys.push(key);
        }
      }
      
      expiredKeys.forEach(key => this.cache.delete(key));
      
      // Trim history if it exceeds maximum size
      if (this.history.length > this.MAX_HISTORY_SIZE) {
        const itemsToRemove = this.history.length - this.MAX_HISTORY_SIZE;
        this.history = this.history.slice(itemsToRemove);
        console.log(`Trimmed ${itemsToRemove} old history items to maintain performance`);
      }
      
      // Trim workflows if it exceeds maximum size
      if (this.workflows.length > this.MAX_WORKFLOWS_SIZE) {
        const itemsToRemove = this.workflows.length - this.MAX_WORKFLOWS_SIZE;
        // Keep the most recently created workflows
        this.workflows.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        this.workflows = this.workflows.slice(0, this.MAX_WORKFLOWS_SIZE);
        console.log(`Trimmed ${itemsToRemove} old workflow items to maintain performance`);
      }
      
      this.lastCleanup = now;
      
      if (expiredKeys.length > 0) {
        console.log(`Cleaned up ${expiredKeys.length} expired cache entries`);
      }
    } catch (error) {
      console.warn('Error during periodic cleanup:', error);
    }
  }

  // Resource monitoring methods
  getMemoryUsage(): { cacheSize: number; historySize: number; workflowsSize: number } {
    return {
      cacheSize: this.cache.size,
      historySize: this.history.length,
      workflowsSize: this.workflows.length
    };
  }

  async optimizePerformance(): Promise<{ success: boolean; message: string; stats: any }> {
    try {
      const beforeStats = this.getMemoryUsage();
      
      // Force cleanup
      this.performPeriodicCleanup();
      
      // Clear cache to free memory
      this.clearCache();
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
      
      const afterStats = this.getMemoryUsage();
      
      return {
        success: true,
        message: 'Performance optimization completed',
        stats: {
          before: beforeStats,
          after: afterStats,
          cacheCleared: beforeStats.cacheSize,
          historyTrimmed: Math.max(0, beforeStats.historySize - afterStats.historySize),
          workflowsTrimmed: Math.max(0, beforeStats.workflowsSize - afterStats.workflowsSize)
        }
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown optimization error';
      console.error('Performance optimization failed:', errorMessage);
      return {
        success: false,
        message: `Optimization failed: ${errorMessage}`,
        stats: null
      };
    }
  }
}