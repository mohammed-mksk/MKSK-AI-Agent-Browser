// Core automation types
export interface AutomationIntent {
  type: 'search' | 'form_fill' | 'data_extract' | 'navigate' | 'monitor' | 'research';
  description: string;
  complexity: 'simple' | 'medium' | 'complex';
}

export interface CommandParameters {
  [key: string]: any;
  urls?: string[];
  searchTerms?: string[];
  formData?: Record<string, string>;
  extractionTargets?: string[];
  filters?: FilterCriteria[];
}

export interface ParsedCommand {
  intent: AutomationIntent;
  parameters: CommandParameters;
  confidence: number;
  suggestedActions: AutomationAction[];
}

export interface AutomationAction {
  id: string;
  type: 'navigate' | 'click' | 'type' | 'extract' | 'wait' | 'screenshot';
  target: ElementSelector;
  value?: string;
  timeout: number;
  retryCount: number;
}

export interface ElementSelector {
  css?: string;
  xpath?: string;
  text?: string;
  placeholder?: string;
  role?: string;
  testId?: string;
}

export interface AutomationStep {
  id: string;
  type: 'navigate' | 'click' | 'type' | 'extract' | 'wait' | 'screenshot' | 'analyze_page' | 'key_press' | 'smart_fill' | 'multi_site_search' | 'captcha_check';
  target: ElementSelector;
  value?: string;
  timeout: number;
  retryCount: number;
  description: string;
}

export interface ExecutionPlan {
  id: string;
  objective?: string;
  steps: AutomationStep[];
  estimatedDuration: number;
  requiredResources: ResourceRequirement[];
  fallbackStrategies: FallbackStrategy[];
}

export interface ResourceRequirement {
  type: 'browser' | 'memory' | 'network';
  amount: number;
  unit: string;
}

export interface FallbackStrategy {
  condition: string;
  alternativeSteps: AutomationStep[];
}

export interface ExtractedData {
  id: string;
  type: 'text' | 'table' | 'form' | 'image' | 'link' | 'structured';
  content: any;
  source: {
    url: string;
    selector: string;
    timestamp: Date;
  };
  confidence: number;
}

export interface AutomationResult {
  id: string;
  command: string;
  intent: AutomationIntent;
  executionPlan: ExecutionPlan;
  extractedData: ExtractedData[];
  screenshots: Buffer[];
  duration: number;
  success: boolean;
  errors: AutomationError[];
  timestamp: Date;
  metadata: ResultMetadata;
}

export interface AutomationError {
  id: string;
  type: 'network' | 'parsing' | 'timeout' | 'element_not_found' | 'ai_error';
  message: string;
  stack?: string;
  context: Record<string, any>;
  timestamp: Date;
}

export interface ResultMetadata {
  browserVersion: string;
  userAgent: string;
  viewport: { width: number; height: number };
  totalSteps: number;
  successfulSteps: number;
  failedSteps: number;
  // AI-specific metadata
  aiEnhanced?: boolean;
  aiProvider?: string;
  reasoning?: string[];
  adaptations?: string[];
  learningEnabled?: boolean;
  executionTime?: number;
  usedFallback?: boolean;
  recovered?: boolean;
  error?: string;
  aiReasoning?: string[];
}

export interface AutomationProgress {
  totalSteps: number;
  completedSteps: number;
  currentStep: AutomationStep | null;
  status: 'planning' | 'executing' | 'completed' | 'error' | 'cancelled';
  estimatedTimeRemaining: number;
  currentUrl?: string;
  currentAction?: string;
}

export interface SavedWorkflow {
  id: string;
  name: string;
  description: string;
  command: string;
  parameters: CommandParameters;
  executionPlan: ExecutionPlan;
  tags: string[];
  createdAt: Date;
  lastUsed: Date;
  useCount: number;
}

export interface FilterCriteria {
  field: string;
  operator: 'equals' | 'contains' | 'greater_than' | 'less_than' | 'between';
  value: any;
}

// AI Provider types
export interface AIConfig {
  apiKey?: string;
  baseUrl?: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
}

export interface CompletionOptions {
  temperature?: number;
  maxTokens?: number;
  stop?: string[];
  stream?: boolean;
}

export interface AIUsageStats {
  totalRequests: number;
  totalTokens: number;
  totalCost: number;
  lastUsed: Date;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

// Browser types
export interface BrowserOptions {
  headless: boolean;
  viewport: { width: number; height: number };
  userAgent?: string;
  proxy?: ProxyConfig;
}

export interface ProxyConfig {
  server: string;
  username?: string;
  password?: string;
}

export interface ScreenshotOptions {
  fullPage?: boolean;
  quality?: number;
  type?: 'png' | 'jpeg';
}

export interface StepResult {
  success: boolean;
  data?: any;
  screenshot?: Buffer;
  error?: Error;
  duration: number;
}

// Report types
export interface AutomationReport {
  id: string;
  title: string;
  summary: string;
  data: any;
  screenshots: Buffer[];
  metadata: ReportMetadata;
}

export interface ReportMetadata {
  generatedAt: Date;
  totalResults: number;
  executionTime: number;
  successRate: number;
}

// Database types
export interface AutomationHistory {
  id: string;
  command: string;
  result: AutomationResult;
  timestamp: Date;
}

// IPC types for Electron communication
export interface IPCMessage {
  type: string;
  payload: any;
  id?: string;
}

export interface IPCResponse {
  success: boolean;
  data?: any;
  error?: string;
  id?: string;
}

// Smart Action Selection Types
export interface ActionContext {
  currentUrl: string;
  pageState: any;
  targetElement?: ElementSelector;
  objective?: string;
  userIntent?: string;
  previousActions?: AutomationAction[];
  timeConstraints?: number;
}

export interface ActionPrediction {
  probability: number;
  factors: string[];
  confidence: 'low' | 'medium' | 'high';
  recommendedActions: string[];
}

export interface ActionOptimization {
  parameter: string;
  originalValue: any;
  optimizedValue: any;
  reasoning: string;
  expectedImprovement: number;
}

export interface TimingStrategy {
  delay: number;
  timeout: number;
  retryInterval?: number;
  maxWaitTime?: number;
}

// Memory and Learning Types
export interface InteractionPattern {
  id: string;
  sitePattern: string;
  taskType: string;
  successfulActions: any[];
  contextConditions: any[];
  reliability: number;
  lastUsed: Date;
  usageCount: number;
  createdAt: Date;
  tags: string[];
}