export interface ElectronAPI {
  automation: {
    start: (command: string) => Promise<{ success: boolean; data?: any; error?: string }>;
    stop: () => Promise<{ success: boolean; error?: string }>;
    onProgress: (callback: (progress: any) => void) => void;
    onResult: (callback: (result: any) => void) => void;
    removeProgressListener: () => void;
    removeResultListener: () => void;
  };
  database: {
    getHistory: () => Promise<any[]>;
    getWorkflows: () => Promise<any[]>;
    getAutomationResult: (id: string) => Promise<{ success: boolean; data?: any; error?: string }>;
    saveWorkflow: (workflow: any) => Promise<void>;
    saveResult: (result: any) => Promise<void>;
  };
  ai: {
    getProviders: () => Promise<any[]>;
    setProvider: (provider: string, config: any) => Promise<{ success: boolean; error?: string }>;
    parseCommand: (command: string) => Promise<{ success: boolean; data?: any; error?: string }>;
  };
  browser: {
    takeScreenshot: (url: string) => Promise<Buffer>;
    getStatus: () => Promise<any>;
  };
  reports: {
    export: (result: any, format: string) => Promise<{ success: boolean; error?: string }>;
  };
  settings: {
    get: (key: string) => Promise<any>;
    set: (key: string, value: any) => Promise<{ success: boolean; error?: string }>;
    resetDefaults: () => Promise<{ success: boolean; data?: any; error?: string }>;
  };
  debug: {
    getRecentLogs: (limit?: number) => Promise<any[]>;
    getCurrentSession: () => Promise<any | null>;
    getAllSessions: () => Promise<any[]>;
    getStats: () => Promise<any>;
    getPerformanceHistory: (limit?: number) => Promise<any[]>;
    setRealTimeEnabled: (enabled: boolean) => Promise<void>;
    setDebugMode: (enabled: boolean) => Promise<void>;
    exportLogs: (filePath: string, filter?: any) => Promise<void>;
    clearLogs: () => Promise<void>;
    onLog: (callback: (logEntry: any) => void) => void;
    onDebugStep: (callback: (step: any) => void) => void;
    onPerformanceMetrics: (callback: (metrics: any) => void) => void;
    removeLogListener: () => void;
    removeDebugStepListener: () => void;
    removePerformanceListener: () => void;
    getLogStats: () => Promise<any>;
    clearAllSessions: () => Promise<void>;
  };
  utils: {
    showSaveDialog: (options: any) => Promise<string | undefined>;
    showOpenDialog: (options: any) => Promise<string[] | undefined>;
    showMessageBox: (options: any) => Promise<number>;
  };
  secure: {
    storeAPIKey: (provider: string, apiKey: string) => Promise<{ success: boolean; error?: string }>;
    getAPIKey: (provider: string) => Promise<{ success: boolean; data?: { provider: string; hasKey: boolean } | null; error?: string }>;
    removeAPIKey: (provider: string) => Promise<{ success: boolean; error?: string }>;
    isEncryptionAvailable: () => Promise<{ success: boolean; data?: boolean; error?: string }>;
  };
  fieldDetection: {
    detect: () => Promise<{ success: boolean; data?: { fields: any[] }; error?: string }>;
    highlight: (fields: any[]) => Promise<{ success: boolean; error?: string }>;
    removeHighlights: () => Promise<{ success: boolean; error?: string }>;
    fillField: (fieldId: string, value: string) => Promise<{ success: boolean; error?: string }>;
    smartFill: (mappings: Record<string, string>) => Promise<{ success: boolean; error?: string }>;
    getSuggestions: (fieldId: string) => Promise<{ success: boolean; data?: string[]; error?: string }>;
  };
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export {};
