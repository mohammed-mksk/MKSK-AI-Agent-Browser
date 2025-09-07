// Global type definitions for the renderer process
import { DetectedField } from './fieldDetection.d.ts';

// Browser Engine Types
type BrowserEngineType = 'puppeteer' | 'browseruse';

interface BrowserEngineConfig {
    headless?: boolean;
    timeout?: number;
    userDataDir?: string;
    viewport?: {
        width: number;
        height: number;
    };
    userAgent?: string;
    enableStealth?: boolean;
    apiKey?: string; // For AI-powered engines like BrowserUse
}

interface BrowserEngineInfo {
    type: BrowserEngineType;
    name: string;
    description: string;
    available: boolean;
    features: string[];
}

// Settings Types
interface AppSettings {
    aiProvider: string;
    aiModel: string;
    temperature: number;
    maxTokens: number;
    browserEngine: BrowserEngineType;
    browserHeadless: boolean;
    maxConcurrentBrowsers: number;
    logLevel: string;
    autoSaveWorkflows: boolean;
}

interface ElectronAPI {
    // AI Provider methods
    ai: {
        parseCommand: (command: string) => Promise<{ success: boolean; data?: any; error?: string }>;
        setProvider: (provider: string, config: any) => Promise<{ success: boolean; error?: string }>;
        getProviders: () => Promise<{ success: boolean; data?: string[]; error?: string }>;
    };

    // Automation methods
    automation: {
        start: (command: string) => Promise<{ success: boolean; data?: any; error?: string }>;
        stop: () => Promise<{ success: boolean; error?: string }>;
        onProgress: (callback: (progress: any) => void) => void;
        onResult: (callback: (result: any) => void) => void;
        removeProgressListener: () => void;
        removeResultListener: () => void;
    };

    // Database methods
    database: {
        getHistory: () => Promise<{ success: boolean; data?: any[]; error?: string }>;
        getWorkflows: () => Promise<{ success: boolean; data?: any[]; error?: string }>;
        saveWorkflow: (workflow: any) => Promise<{ success: boolean; error?: string }>;
        saveResult: (result: any) => Promise<{ success: boolean; error?: string }>;
        getAutomationResult: (id: string) => Promise<{ success: boolean; data?: any; error?: string }>;
    };

    // Settings methods
    settings: {
        get: (key: string) => Promise<{ success: boolean; data?: any; error?: string }>;
        set: (key: string, value: any) => Promise<{ success: boolean; error?: string }>;
    };

    // Browser methods
    browser: {
        takeScreenshot: (url: string) => Promise<{ success: boolean; data?: Buffer; error?: string }>;
        getStatus: () => Promise<{ success: boolean; data?: any; error?: string }>;
        getEngineType: () => Promise<{ success: boolean; data?: string; error?: string }>;
        switchEngine: (engineType: 'puppeteer' | 'browseruse') => Promise<{ success: boolean; error?: string }>;
        testEngine: () => Promise<{ success: boolean; data?: boolean; error?: string }>;
        getAvailableEngines: () => Promise<{ success: boolean; data?: string[]; error?: string }>;
    };

    // Export methods
    reports: {
        export: (result: any, format: string) => Promise<{ success: boolean; error?: string; filePath?: string }>;
    };

    // Debug methods
    debug: {
        getRecentLogs: (limit?: number) => Promise<{ success: boolean; data?: any[]; error?: string }>;
        getCurrentSession: () => Promise<{ success: boolean; data?: any; error?: string }>;
        getAllSessions: () => Promise<{ success: boolean; data?: any[]; error?: string }>;
        getStats: () => Promise<{ success: boolean; data?: any; error?: string }>;
        getPerformanceHistory: (limit?: number) => Promise<{ success: boolean; data?: any[]; error?: string }>;
        setRealTimeEnabled: (enabled: boolean) => Promise<{ success: boolean; error?: string }>;
        setDebugMode: (enabled: boolean) => Promise<{ success: boolean; error?: string }>;
        exportLogs: (filePath: string, filter?: any) => Promise<{ success: boolean; error?: string }>;
        clearLogs: () => Promise<{ success: boolean; error?: string }>;
        onLog: (callback: (logEntry: any) => void) => void;
        onDebugStep: (callback: (step: any) => void) => void;
        onPerformanceMetrics: (callback: (metrics: any) => void) => void;
        removeLogListener: () => void;
        removeDebugStepListener: () => void;
        removePerformanceListener: () => void;
        getLogStats: () => Promise<{ success: boolean; data?: any; error?: string }>;
        clearAllSessions: () => Promise<{ success: boolean; error?: string }>;
    };

    // Utility methods
    utils: {
        showSaveDialog: (options: any) => Promise<string | undefined>;
        showOpenDialog: (options: any) => Promise<string[] | undefined>;
        showMessageBox: (options: any) => Promise<number>;
    };

    // Secure storage methods
    secure: {
        storeAPIKey: (provider: string, apiKey: string) => Promise<{ success: boolean; error?: string }>;
        getAPIKey: (provider: string) => Promise<{ success: boolean; data?: { provider: string; hasKey: boolean } | null; error?: string }>;
        removeAPIKey: (provider: string) => Promise<{ success: boolean; error?: string }>;
        isEncryptionAvailable: () => Promise<{ success: boolean; data?: boolean; error?: string }>;
    };

    // Field detection methods
    fieldDetection: {
        detect: () => Promise<{ success: boolean; data?: { fields: DetectedField[] }; error?: string }>;
        highlight: (fields: DetectedField[]) => Promise<{ success: boolean; error?: string }>;
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

export { };