import { AutomationAction, AutomationError } from '../../shared/types.js';

// Core memory system interfaces
export interface IMemorySystem {
  /**
   * Stores a successful interaction pattern for future reference
   */
  storeSuccessfulPattern(pattern: InteractionPattern): Promise<void>;

  /**
   * Retrieves relevant patterns based on current task context
   */
  retrieveRelevantPatterns(context: TaskContext): Promise<InteractionPattern[]>;

  /**
   * Updates task progress information
   */
  updateTaskProgress(taskId: string, progress: TaskProgress): Promise<void>;

  /**
   * Learns from a failure and stores insights
   */
  learnFromFailure(failure: ActionFailure): Promise<LearningInsight>;

  /**
   * Generalizes a specific pattern for broader applicability
   */
  generalizePattern(specificPattern: InteractionPattern): Promise<GeneralPattern>;

  /**
   * Retrieves task progress information
   */
  getTaskProgress(taskId: string): Promise<TaskProgress | null>;

  /**
   * Stores site-specific learning insights
   */
  storeSiteSpecificLearning(learning: SiteSpecificLearning): Promise<void>;

  /**
   * Retrieves site-specific learnings for a domain
   */
  getSiteSpecificLearnings(domain: string): Promise<SiteSpecificLearning[]>;

  /**
   * Cleans up old or irrelevant memory entries
   */
  cleanupMemory(): Promise<void>;

  /**
   * Gets memory statistics and usage information
   */
  getMemoryStats(): Promise<MemoryStats>;
}

// Core data structures
export interface InteractionPattern {
  id: string;
  sitePattern: string;
  taskType: string;
  successfulActions: ActionSequence[];
  contextConditions: ContextCondition[];
  reliability: number;
  lastUsed: Date;
  usageCount: number;
  createdAt: Date;
  tags: string[];
}

export interface ActionSequence {
  id: string;
  actions: AutomationAction[];
  context: ActionContext;
  successRate: number;
  averageDuration: number;
  lastExecuted: Date;
}

export interface ContextCondition {
  type: 'url_pattern' | 'page_type' | 'element_present' | 'viewport_size' | 'user_agent';
  value: string;
  operator: 'equals' | 'contains' | 'matches' | 'greater_than' | 'less_than';
  weight: number;
}

export interface ActionContext {
  url: string;
  pageType: string;
  viewport: { width: number; height: number };
  userAgent: string;
  timestamp: Date;
  sessionId: string;
}

export interface TaskProgress {
  taskId: string;
  currentStep: number;
  totalSteps: number;
  completedObjectives: string[];
  pendingObjectives: string[];
  encounteredObstacles: Obstacle[];
  adaptationsMade: Adaptation[];
  startTime: Date;
  lastUpdated: Date;
  estimatedCompletion: Date;
  confidence: number;
}

export interface Obstacle {
  id: string;
  type: 'element_not_found' | 'timeout' | 'captcha' | 'permission_denied' | 'network_error' | 'unexpected_page';
  description: string;
  context: ActionContext;
  resolutionAttempts: ResolutionAttempt[];
  resolved: boolean;
  timestamp: Date;
}

export interface ResolutionAttempt {
  id: string;
  strategy: string;
  actions: AutomationAction[];
  success: boolean;
  duration: number;
  timestamp: Date;
  learnings: string[];
}

export interface Adaptation {
  id: string;
  reason: string;
  originalPlan: string;
  adaptedPlan: string;
  success: boolean;
  timestamp: Date;
  impact: 'minor' | 'moderate' | 'major';
}

export interface ActionFailure {
  id: string;
  action: AutomationAction;
  error: AutomationError;
  context: ActionContext;
  attemptNumber: number;
  timestamp: Date;
  stackTrace?: string;
  screenshots?: Buffer[];
}

export interface LearningInsight {
  id: string;
  type: 'pattern_recognition' | 'error_prevention' | 'optimization' | 'adaptation';
  insight: string;
  confidence: number;
  applicability: ApplicabilityScope;
  evidence: Evidence[];
  timestamp: Date;
  validated: boolean;
}

export interface ApplicabilityScope {
  domains: string[];
  pageTypes: string[];
  actionTypes: string[];
  conditions: ContextCondition[];
}

export interface Evidence {
  type: 'success_rate' | 'performance_improvement' | 'error_reduction' | 'user_feedback';
  value: number;
  description: string;
  timestamp: Date;
}

export interface GeneralPattern {
  id: string;
  name: string;
  description: string;
  applicableScenarios: string[];
  actionTemplate: ActionTemplate[];
  successPredictors: SuccessPredictor[];
  reliability: number;
  createdFrom: string[]; // IDs of specific patterns
  lastValidated: Date;
}

export interface ActionTemplate {
  step: number;
  actionType: string;
  targetPattern: string;
  valuePattern?: string;
  conditions: ContextCondition[];
  alternatives: AlternativeTemplate[];
}

export interface AlternativeTemplate {
  actionType: string;
  targetPattern: string;
  valuePattern?: string;
  priority: number;
  conditions: ContextCondition[];
}

export interface SuccessPredictor {
  factor: string;
  weight: number;
  threshold: number;
  operator: 'greater_than' | 'less_than' | 'equals' | 'contains';
}

export interface TaskContext {
  taskId: string;
  objective: string;
  currentUrl: string;
  pageType: string;
  userIntent: string;
  constraints: TaskConstraint[];
  priority: 'low' | 'medium' | 'high';
  deadline?: Date;
}

export interface TaskConstraint {
  type: 'time' | 'resource' | 'ethical' | 'technical' | 'legal';
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  enforceable: boolean;
}

export interface SiteSpecificLearning {
  id: string;
  domain: string;
  subdomain?: string;
  patterns: InteractionPattern[];
  commonIssues: CommonIssue[];
  optimizations: Optimization[];
  lastUpdated: Date;
  reliability: number;
  usageFrequency: number;
}

export interface CommonIssue {
  type: string;
  description: string;
  frequency: number;
  solutions: Solution[];
  lastEncountered: Date;
}

export interface Solution {
  description: string;
  actions: AutomationAction[];
  successRate: number;
  averageTime: number;
  conditions: ContextCondition[];
}

export interface Optimization {
  type: 'performance' | 'reliability' | 'user_experience';
  description: string;
  improvement: number;
  implementation: AutomationAction[];
  validatedAt: Date;
}

export interface MemoryStats {
  totalPatterns: number;
  totalLearnings: number;
  totalTasks: number;
  memoryUsage: number;
  oldestEntry: Date;
  newestEntry: Date;
  averageReliability: number;
  topDomains: DomainStats[];
  cleanupRecommended: boolean;
}

export interface DomainStats {
  domain: string;
  patternCount: number;
  successRate: number;
  lastAccessed: Date;
  reliability: number;
}

// Enums
export enum PatternType {
  NAVIGATION = 'navigation',
  FORM_FILLING = 'form_filling',
  DATA_EXTRACTION = 'data_extraction',
  SEARCH = 'search',
  AUTHENTICATION = 'authentication',
  INTERACTION = 'interaction'
}

export enum LearningType {
  SUCCESS_PATTERN = 'success_pattern',
  FAILURE_ANALYSIS = 'failure_analysis',
  OPTIMIZATION = 'optimization',
  ADAPTATION = 'adaptation',
  GENERALIZATION = 'generalization'
}

export enum MemoryPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}