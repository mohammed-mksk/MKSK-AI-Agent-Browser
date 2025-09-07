const { contextBridge, ipcRenderer } = require('electron');

// IPC channels - embedded directly to avoid module loading issues
const IPC_CHANNELS = {
  // AI Provider
  AI_PARSE_COMMAND: 'ai:parse-command',
  AI_SET_PROVIDER: 'ai:set-provider',
  AI_GET_PROVIDERS: 'ai:get-providers',

  // Automation
  AUTOMATION_START: 'automation:start',
  AUTOMATION_STOP: 'automation:stop',
  AUTOMATION_PROGRESS: 'automation:progress',
  AUTOMATION_RESULT: 'automation:result',

  // Database
  DB_SAVE_RESULT: 'db:save-result',
  DB_GET_HISTORY: 'db:get-history',
  DB_SAVE_WORKFLOW: 'db:save-workflow',
  DB_GET_WORKFLOWS: 'db:get-workflows',

  // Export
  EXPORT_REPORT: 'export:report',

  // Browser
  BROWSER_SCREENSHOT: 'browser:screenshot',
  BROWSER_STATUS: 'browser:status',

  // Settings
  SETTINGS_GET: 'settings:get',
  SETTINGS_SET: 'settings:set',

  // Debug and Logging
  DEBUG_GET_LOGS: 'debug:get-logs',
  DEBUG_GET_SESSION: 'debug:get-session',
  DEBUG_GET_ALL_SESSIONS: 'debug:get-all-sessions',
  DEBUG_GET_STATS: 'debug:get-stats',
  DEBUG_SET_REAL_TIME: 'debug:set-real-time',
  DEBUG_SET_DEBUG_MODE: 'debug:set-debug-mode',
  DEBUG_EXPORT_LOGS: 'debug:export-logs',
  DEBUG_CLEAR_LOGS: 'debug:clear-logs',
  DEBUG_GET_PERFORMANCE: 'debug:get-performance',

  // Real-time events
  DEBUG_LOG_EVENT: 'debug:log-event',
  DEBUG_STEP_EVENT: 'debug:step-event',
  DEBUG_PERFORMANCE_EVENT: 'debug:performance-event'
};

// Type definitions for TypeScript
type ParsedCommand = any;
type AutomationResult = any;
type SavedWorkflow = any;
type AutomationHistory = any;
type AIConfig = any;

// Input validation functions for security
const validateString = (input: any, maxLength: number = 10000): string => {
  if (typeof input !== 'string') {
    throw new Error('Input must be a string');
  }
  if (input.length > maxLength) {
    throw new Error(`Input exceeds maximum length of ${maxLength} characters`);
  }
  return input;
};

const validateNumber = (input: any, min?: number, max?: number): number => {
  const num = Number(input);
  if (isNaN(num)) {
    throw new Error('Input must be a valid number');
  }
  if (min !== undefined && num < min) {
    throw new Error(`Number must be at least ${min}`);
  }
  if (max !== undefined && num > max) {
    throw new Error(`Number must be at most ${max}`);
  }
  return num;
};

const validateBoolean = (input: any): boolean => {
  if (typeof input !== 'boolean') {
    throw new Error('Input must be a boolean');
  }
  return input;
};

const sanitizeObject = (obj: any): any => {
  if (obj === null || obj === undefined) {
    return obj;
  }
  if (typeof obj === 'string') {
    return validateString(obj);
  }
  if (typeof obj === 'number' || typeof obj === 'boolean') {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item));
  }
  if (typeof obj === 'object') {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(obj)) {
      const sanitizedKey = validateString(key, 100);
      sanitized[sanitizedKey] = sanitizeObject(value);
    }
    return sanitized;
  }
  return obj;
};

// Define the API that will be exposed to the renderer process
const electronAPI = {
  // AI Provider methods
  ai: {
    parseCommand: (command: string): Promise<ParsedCommand> => {
      const validatedCommand = validateString(command, 50000);
      return ipcRenderer.invoke(IPC_CHANNELS.AI_PARSE_COMMAND, validatedCommand);
    },

    setProvider: (provider: string, config: AIConfig): Promise<void> => {
      const validatedProvider = validateString(provider, 100);
      const sanitizedConfig = sanitizeObject(config);
      return ipcRenderer.invoke(IPC_CHANNELS.AI_SET_PROVIDER, validatedProvider, sanitizedConfig);
    },

    getProviders: (): Promise<string[]> =>
      ipcRenderer.invoke(IPC_CHANNELS.AI_GET_PROVIDERS)
  },

  // Automation methods
  automation: {
    start: (command: string): Promise<{ parsedCommand: ParsedCommand; executionPlan: any }> => {
      const validatedCommand = validateString(command, 50000);
      return ipcRenderer.invoke(IPC_CHANNELS.AUTOMATION_START, validatedCommand);
    },

    stop: (): Promise<void> =>
      ipcRenderer.invoke(IPC_CHANNELS.AUTOMATION_STOP),

    onProgress: (callback: (progress: any) => void): void => {
      ipcRenderer.on(IPC_CHANNELS.AUTOMATION_PROGRESS, (_, progress) => callback(progress));
    },

    onResult: (callback: (result: AutomationResult) => void): void => {
      ipcRenderer.on(IPC_CHANNELS.AUTOMATION_RESULT, (_, result) => callback(result));
    },

    removeProgressListener: (): void => {
      ipcRenderer.removeAllListeners(IPC_CHANNELS.AUTOMATION_PROGRESS);
    },

    removeResultListener: (): void => {
      ipcRenderer.removeAllListeners(IPC_CHANNELS.AUTOMATION_RESULT);
    }
  },

  // Database methods
  database: {
    getHistory: (): Promise<AutomationHistory[]> =>
      ipcRenderer.invoke(IPC_CHANNELS.DB_GET_HISTORY),

    getWorkflows: (): Promise<SavedWorkflow[]> =>
      ipcRenderer.invoke(IPC_CHANNELS.DB_GET_WORKFLOWS),

    saveWorkflow: (workflow: SavedWorkflow): Promise<void> =>
      ipcRenderer.invoke(IPC_CHANNELS.DB_SAVE_WORKFLOW, workflow),

    saveResult: (result: AutomationResult): Promise<void> =>
      ipcRenderer.invoke(IPC_CHANNELS.DB_SAVE_RESULT, result),

    getAutomationResult: (id: string): Promise<{ success: boolean; data?: any; error?: string }> =>
      ipcRenderer.invoke('db:get-result', id)
  },

  // Settings methods
  settings: {
    get: (key: string): Promise<any> =>
      ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_GET, key),

    set: (key: string, value: any): Promise<void> =>
      ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_SET, key, value)
    ,
    resetDefaults: (): Promise<{ success: boolean; data?: any; error?: string }> =>
      ipcRenderer.invoke('settings:reset-defaults')
  },

  // Browser methods
  browser: {
    takeScreenshot: (url: string): Promise<Buffer> =>
      ipcRenderer.invoke(IPC_CHANNELS.BROWSER_SCREENSHOT, url),

    getStatus: (): Promise<any> =>
      ipcRenderer.invoke(IPC_CHANNELS.BROWSER_STATUS)
  },

  // Export methods
  reports: {
    export: (result: AutomationResult, format: string): Promise<{ success: boolean; error?: string; filePath?: string }> =>
      ipcRenderer.invoke(IPC_CHANNELS.EXPORT_REPORT, result, format)
  },

  // Debug and logging methods
  debug: {
    getRecentLogs: (limit?: number): Promise<any[]> =>
      ipcRenderer.invoke(IPC_CHANNELS.DEBUG_GET_LOGS, limit),

    getCurrentSession: (): Promise<any | null> =>
      ipcRenderer.invoke(IPC_CHANNELS.DEBUG_GET_SESSION),

    getAllSessions: (): Promise<any[]> =>
      ipcRenderer.invoke(IPC_CHANNELS.DEBUG_GET_ALL_SESSIONS),

    getStats: (): Promise<any> =>
      ipcRenderer.invoke(IPC_CHANNELS.DEBUG_GET_STATS),

    getPerformanceHistory: (limit?: number): Promise<any[]> =>
      ipcRenderer.invoke(IPC_CHANNELS.DEBUG_GET_PERFORMANCE, limit),

    setRealTimeEnabled: (enabled: boolean): Promise<void> =>
      ipcRenderer.invoke(IPC_CHANNELS.DEBUG_SET_REAL_TIME, enabled),

    setDebugMode: (enabled: boolean): Promise<void> =>
      ipcRenderer.invoke(IPC_CHANNELS.DEBUG_SET_DEBUG_MODE, enabled),

    exportLogs: (filePath: string, filter?: any): Promise<void> =>
      ipcRenderer.invoke(IPC_CHANNELS.DEBUG_EXPORT_LOGS, filePath, filter),

    clearLogs: (): Promise<void> =>
      ipcRenderer.invoke(IPC_CHANNELS.DEBUG_CLEAR_LOGS),

    // Real-time event listeners
    onLog: (callback: (logEntry: any) => void): void => {
      ipcRenderer.on(IPC_CHANNELS.DEBUG_LOG_EVENT, (_, logEntry) => callback(logEntry));
    },

    onDebugStep: (callback: (step: any) => void): void => {
      ipcRenderer.on(IPC_CHANNELS.DEBUG_STEP_EVENT, (_, step) => callback(step));
    },

    onPerformanceMetrics: (callback: (metrics: any) => void): void => {
      ipcRenderer.on(IPC_CHANNELS.DEBUG_PERFORMANCE_EVENT, (_, metrics) => callback(metrics));
    },

    // Remove listeners
    removeLogListener: (): void => {
      ipcRenderer.removeAllListeners(IPC_CHANNELS.DEBUG_LOG_EVENT);
    },

    removeDebugStepListener: (): void => {
      ipcRenderer.removeAllListeners(IPC_CHANNELS.DEBUG_STEP_EVENT);
    },

    removePerformanceListener: (): void => {
      ipcRenderer.removeAllListeners(IPC_CHANNELS.DEBUG_PERFORMANCE_EVENT);
    },

    // Additional debug methods
    getLogStats: (): Promise<any> =>
      ipcRenderer.invoke('debug:get-log-stats'),

    clearAllSessions: (): Promise<void> =>
      ipcRenderer.invoke('debug:clear-all-sessions')
  },

  // Utility methods
  utils: {
    showSaveDialog: (options: any): Promise<string | undefined> =>
      ipcRenderer.invoke('dialog:showSaveDialog', options),

    showOpenDialog: (options: any): Promise<string[] | undefined> =>
      ipcRenderer.invoke('dialog:showOpenDialog', options),

    showMessageBox: (options: any): Promise<number> =>
      ipcRenderer.invoke('dialog:showMessageBox', options)
  },

  // Secure storage methods
  secure: {
    storeAPIKey: (provider: string, apiKey: string): Promise<{ success: boolean; error?: string }> => {
      const validatedProvider = validateString(provider, 100);
      const validatedApiKey = validateString(apiKey, 1000);
      return ipcRenderer.invoke('secure:store-api-key', validatedProvider, validatedApiKey);
    },

    getAPIKey: (provider: string): Promise<{ success: boolean; data?: { provider: string; hasKey: boolean } | null; error?: string }> => {
      const validatedProvider = validateString(provider, 100);
      return ipcRenderer.invoke('secure:get-api-key', validatedProvider);
    },

    removeAPIKey: (provider: string): Promise<{ success: boolean; error?: string }> => {
      const validatedProvider = validateString(provider, 100);
      return ipcRenderer.invoke('secure:remove-api-key', validatedProvider);
    },

    isEncryptionAvailable: (): Promise<{ success: boolean; data?: boolean; error?: string }> =>
      ipcRenderer.invoke('secure:encryption-available')
  }
};

// Expose the API to the renderer process
contextBridge.exposeInMainWorld('electronAPI', electronAPI);

// The electronAPI will be available on window.electronAPI in the renderer process
