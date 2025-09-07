// Application constants
export const APP_NAME = 'AI Automation Browser';
export const APP_VERSION = '1.0.0';

// AI Provider constants
export const AI_PROVIDERS = {
  OPENAI: 'openai',
  ANTHROPIC: 'anthropic',
  LOCAL: 'local'
} as const;

export const AI_MODELS = {
  GPT_4: 'gpt-4',
  GPT_4_TURBO: 'gpt-4-turbo-preview',
  GPT_3_5_TURBO: 'gpt-3.5-turbo',
  CLAUDE_3_OPUS: 'claude-3-opus-20240229',
  CLAUDE_3_SONNET: 'claude-3-sonnet-20240229',
  CLAUDE_3_HAIKU: 'claude-3-haiku-20240307'
} as const;

// Browser constants
export const BROWSER_DEFAULTS = {
  TIMEOUT: 30000,
  VIEWPORT: { width: 1920, height: 1080 },
  USER_AGENT: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  MAX_CONCURRENT: 3
} as const;

// Automation constants
export const AUTOMATION_TYPES = {
  SEARCH: 'search',
  FORM_FILL: 'form_fill',
  DATA_EXTRACT: 'data_extract',
  NAVIGATE: 'navigate',
  MONITOR: 'monitor',
  RESEARCH: 'research'
} as const;

export const STEP_TYPES = {
  NAVIGATE: 'navigate',
  CLICK: 'click',
  TYPE: 'type',
  EXTRACT: 'extract',
  WAIT: 'wait',
  SCREENSHOT: 'screenshot'
} as const;

export const ELEMENT_SELECTORS = {
  CSS: 'css',
  XPATH: 'xpath',
  TEXT: 'text',
  PLACEHOLDER: 'placeholder',
  ROLE: 'role',
  TEST_ID: 'testId'
} as const;

// Error types
export const ERROR_TYPES = {
  NETWORK: 'network',
  PARSING: 'parsing',
  TIMEOUT: 'timeout',
  ELEMENT_NOT_FOUND: 'element_not_found',
  AI_ERROR: 'ai_error'
} as const;

// Status constants
export const AUTOMATION_STATUS = {
  PLANNING: 'planning',
  EXECUTING: 'executing',
  COMPLETED: 'completed',
  ERROR: 'error',
  CANCELLED: 'cancelled'
} as const;

// Data extraction types
export const DATA_TYPES = {
  TEXT: 'text',
  TABLE: 'table',
  FORM: 'form',
  IMAGE: 'image',
  LINK: 'link',
  STRUCTURED: 'structured'
} as const;

// Export formats
export const EXPORT_FORMATS = {
  PDF: 'pdf',
  EXCEL: 'excel',
  CSV: 'csv',
  JSON: 'json'
} as const;

// IPC channels
export const IPC_CHANNELS = {
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
} as const;

// Database constants
export const DB_TABLES = {
  AUTOMATION_RESULTS: 'automation_results',
  WORKFLOWS: 'workflows',
  SETTINGS: 'settings',
  CACHE: 'cache'
} as const;

// Cache constants
export const CACHE_KEYS = {
  AI_RESPONSES: 'ai_responses',
  WEBSITE_DATA: 'website_data',
  BROWSER_SESSIONS: 'browser_sessions'
} as const;

export const CACHE_TTL = {
  DEFAULT: 30 * 60 * 1000, // 30 minutes
  AI_RESPONSES: 60 * 60 * 1000, // 1 hour
  WEBSITE_DATA: 15 * 60 * 1000 // 15 minutes
} as const;

// Retry constants
export const RETRY_CONFIG = {
  MAX_ATTEMPTS: 3,
  BASE_DELAY: 1000,
  MAX_DELAY: 10000,
  BACKOFF_FACTOR: 2
} as const;

// Logging levels
export const LOG_LEVELS = {
  ERROR: 'error',
  WARN: 'warn',
  INFO: 'info',
  DEBUG: 'debug',
  TRACE: 'trace'
} as const;