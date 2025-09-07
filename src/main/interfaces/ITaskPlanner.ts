import { AutomationAction } from '../../shared/types.js';
import { 
  TaskConstraint,
  ActionSequence,
  ContextCondition
} from './IMemorySystem.js';

// Core task planning interfaces
export interface ITaskPlanner {
  /**
   * Parses natural language task description into structured understanding
   */
  parseNaturalLanguageTask(task: string): Promise<TaskUnderstanding>;

  /**
   * Generates initial action plan based on task understanding
   */
  generateInitialPlan(understanding: TaskUnderstanding): Promise<ActionPlan>;

  /**
   * Adapts existing plan based on changing conditions
   */
  adaptPlan(currentPlan: ActionPlan, newContext: PlanningContext): Promise<ActionPlan>;

  /**
   * Coordinates tasks across multiple sites
   */
  coordinateMultiSiteTasks(sites: string[], objective: string): Promise<MultiSiteStrategy>;

  /**
   * Prioritizes actions based on context and constraints
   */
  prioritizeActions(actions: PendingAction[]): Promise<PrioritizedActions>;

  /**
   * Validates plan feasibility before execution
   */
  validatePlan(plan: ActionPlan): Promise<PlanValidation>;

  /**
   * Optimizes plan for better performance and reliability
   */
  optimizePlan(plan: ActionPlan): Promise<ActionPlan>;
}

// Task understanding types
export interface TaskUnderstanding {
  intent: TaskIntent;
  objectives: string[];
  constraints: string[];
  expectedOutcome: string;
  complexity: 'simple' | 'medium' | 'complex';
  estimatedSteps: number;
  requiredSites: string[];
  dataRequirements: DataRequirement[];
  timeConstraints: TimeConstraint[];
}

export interface TaskIntent {
  type: 'search' | 'form_fill' | 'data_extract' | 'navigate' | 'monitor' | 'research' | 'comparison' | 'booking';
  description: string;
  confidence: number;
  subIntents: SubIntent[];
}

export interface SubIntent {
  type: string;
  description: string;
  priority: number;
  dependencies: string[];
}

export interface DataRequirement {
  type: 'input' | 'output' | 'intermediate';
  name: string;
  format: string;
  required: boolean;
  source?: string;
  validation?: ValidationRule[];
}

export interface ValidationRule {
  type: 'format' | 'range' | 'required' | 'custom';
  rule: string;
  message: string;
}

export interface TimeConstraint {
  type: 'deadline' | 'duration' | 'schedule';
  value: Date | number;
  flexibility: 'strict' | 'preferred' | 'flexible';
}

// Action planning types
export interface ActionPlan {
  id: string;
  objective: string;
  steps: PlannedAction[];
  contingencies: ContingencyPlan[];
  successCriteria: string[];
  timeoutStrategy: TimeoutStrategy;
  confidence: number;
  estimatedDuration: number;
  resourceRequirements: ResourceRequirement[];
}

export interface PlannedAction {
  id: string;
  action: AutomationAction;
  reasoning: string;
  dependencies: string[];
  successCriteria: string[];
  fallbacks: AlternativeAction[];
  priority: number;
  estimatedDuration: number;
  retryStrategy: RetryStrategy;
}

export interface AlternativeAction {
  action: AutomationAction;
  reasoning: string;
  confidence: number;
  estimatedSuccess: number;
  conditions: ContextCondition[];
}

export interface ContingencyPlan {
  condition: string;
  actions: PlannedAction[];
  reasoning: string;
  triggerConditions: TriggerCondition[];
}

export interface TriggerCondition {
  type: 'error' | 'timeout' | 'element_not_found' | 'page_change' | 'custom';
  condition: string;
  threshold?: number;
}

export interface TimeoutStrategy {
  maxDuration: number;
  checkpoints: number[];
  fallbackActions: PlannedAction[];
  escalationStrategy: EscalationStrategy;
}

export interface EscalationStrategy {
  levels: EscalationLevel[];
  maxRetries: number;
  backoffStrategy: 'linear' | 'exponential' | 'custom';
}

export interface EscalationLevel {
  level: number;
  actions: PlannedAction[];
  timeout: number;
  conditions: string[];
}

export interface RetryStrategy {
  maxRetries: number;
  backoffMs: number;
  conditions: string[];
  adaptiveRetry: boolean;
}

export interface ResourceRequirement {
  type: 'browser' | 'memory' | 'network' | 'storage' | 'api_calls';
  amount: number;
  unit: string;
  priority: 'low' | 'medium' | 'high';
}

// Multi-site coordination types
export interface MultiSiteStrategy {
  id: string;
  sites: SiteTask[];
  coordinationPlan: CoordinationPlan;
  dataFlow: DataFlowPlan;
  failureHandling: MultiSiteFailureHandling;
  aggregationStrategy: AggregationStrategy;
}

export interface SiteTask {
  siteUrl: string;
  taskPlan: ActionPlan;
  priority: number;
  dependencies: string[];
  expectedData: DataRequirement[];
  fallbackSites: string[];
}

export interface CoordinationPlan {
  executionOrder: ExecutionOrder;
  parallelization: ParallelizationStrategy;
  synchronizationPoints: SynchronizationPoint[];
  resourceSharing: ResourceSharingPlan;
}

export interface ExecutionOrder {
  type: 'sequential' | 'parallel' | 'hybrid';
  sequence: string[];
  parallelGroups: string[][];
  dependencies: DependencyMap;
}

export interface DependencyMap {
  [taskId: string]: string[];
}

export interface ParallelizationStrategy {
  maxConcurrent: number;
  resourceLimits: ResourceLimit[];
  loadBalancing: LoadBalancingStrategy;
}

export interface ResourceLimit {
  resource: string;
  limit: number;
  priority: 'strict' | 'preferred';
}

export interface LoadBalancingStrategy {
  type: 'round_robin' | 'least_loaded' | 'priority_based';
  parameters: Record<string, any>;
}

export interface SynchronizationPoint {
  id: string;
  waitFor: string[];
  timeout: number;
  action: 'continue' | 'abort' | 'retry';
}

export interface ResourceSharingPlan {
  sharedResources: SharedResource[];
  accessControl: AccessControlRule[];
}

export interface SharedResource {
  id: string;
  type: string;
  maxConcurrentAccess: number;
  priority: number;
}

export interface AccessControlRule {
  resource: string;
  allowedTasks: string[];
  restrictions: string[];
}

export interface DataFlowPlan {
  dataExchanges: DataExchange[];
  aggregationPoints: AggregationPoint[];
  validationRules: DataValidationRule[];
}

export interface DataExchange {
  from: string;
  to: string;
  dataType: string;
  transformation?: DataTransformation;
  validation?: DataValidationRule[];
}

export interface DataTransformation {
  type: 'format' | 'filter' | 'aggregate' | 'normalize';
  parameters: Record<string, any>;
}

export interface AggregationPoint {
  id: string;
  sources: string[];
  strategy: AggregationStrategy;
  outputFormat: string;
}

export interface AggregationStrategy {
  type: 'merge' | 'compare' | 'rank' | 'filter' | 'summarize';
  parameters: Record<string, any>;
  conflictResolution: ConflictResolution;
}

export interface ConflictResolution {
  strategy: 'first_wins' | 'last_wins' | 'highest_confidence' | 'merge' | 'manual';
  parameters: Record<string, any>;
}

export interface DataValidationRule {
  field: string;
  rule: string;
  severity: 'error' | 'warning' | 'info';
  action: 'reject' | 'flag' | 'correct';
}

export interface MultiSiteFailureHandling {
  failureStrategies: FailureStrategy[];
  fallbackChain: FallbackChain;
  recoveryPlan: RecoveryPlan;
}

export interface FailureStrategy {
  errorType: string;
  strategy: 'retry' | 'fallback' | 'skip' | 'abort';
  parameters: Record<string, any>;
}

export interface FallbackChain {
  primary: string;
  fallbacks: FallbackOption[];
}

export interface FallbackOption {
  site: string;
  confidence: number;
  adaptations: string[];
}

export interface RecoveryPlan {
  steps: RecoveryStep[];
  timeout: number;
  successCriteria: string[];
}

export interface RecoveryStep {
  action: string;
  parameters: Record<string, any>;
  timeout: number;
}

// Action prioritization types
export interface PendingAction {
  action: AutomationAction;
  context: ActionContext;
  priority: number;
  dependencies: string[];
  estimatedDuration: number;
  resourceRequirements: ResourceRequirement[];
}

export interface ActionContext {
  url: string;
  pageType: string;
  elementContext: string;
  userIntent: string;
  constraints: TaskConstraint[];
}

export interface PrioritizedActions {
  actions: PrioritizedAction[];
  executionOrder: string[];
  reasoning: PrioritizationReasoning;
}

export interface PrioritizedAction {
  action: PendingAction;
  finalPriority: number;
  reasoning: string;
  scheduledTime?: Date;
}

export interface PrioritizationReasoning {
  factors: PriorityFactor[];
  algorithm: string;
  confidence: number;
}

export interface PriorityFactor {
  name: string;
  weight: number;
  value: number;
  impact: 'positive' | 'negative' | 'neutral';
}

// Planning context types
export interface PlanningContext {
  currentUrl: string;
  pageState: PageState;
  availableElements: ElementInfo[];
  previousActions: ActionHistory;
  constraints: TaskConstraint[];
  timeRemaining: number;
  resourceAvailability: ResourceAvailability;
}

export interface PageState {
  loaded: boolean;
  interactive: boolean;
  errors: string[];
  performance: PerformanceMetrics;
  accessibility: AccessibilityMetrics;
}

export interface ElementInfo {
  id: string;
  type: string;
  selector: string;
  visible: boolean;
  interactable: boolean;
  confidence: number;
}

export interface ActionHistory {
  actions: HistoricalAction[];
  patterns: ActionPattern[];
  successRate: number;
  averageDuration: number;
}

export interface HistoricalAction {
  action: AutomationAction;
  result: ActionResult;
  duration: number;
  timestamp: Date;
}

export interface ActionResult {
  success: boolean;
  error?: string;
  data?: any;
  stateChanges: StateChange[];
}

export interface StateChange {
  type: string;
  before: any;
  after: any;
}

export interface ActionPattern {
  sequence: string[];
  frequency: number;
  successRate: number;
  context: string;
}

export interface ResourceAvailability {
  memory: number;
  cpu: number;
  network: number;
  browserTabs: number;
  apiQuota: number;
}

export interface PerformanceMetrics {
  loadTime: number;
  renderTime: number;
  interactiveTime: number;
  memoryUsage: number;
}

export interface AccessibilityMetrics {
  score: number;
  violations: number;
  warnings: number;
}

// Plan validation types
export interface PlanValidation {
  isValid: boolean;
  confidence: number;
  issues: ValidationIssue[];
  recommendations: string[];
  estimatedSuccessRate: number;
}

export interface ValidationIssue {
  type: 'error' | 'warning' | 'info';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  affectedSteps: string[];
  suggestedFix?: string;
}

// Enums
export enum PlanningStrategy {
  CONSERVATIVE = 'conservative',
  AGGRESSIVE = 'aggressive',
  BALANCED = 'balanced',
  ADAPTIVE = 'adaptive'
}

export enum ExecutionMode {
  SEQUENTIAL = 'sequential',
  PARALLEL = 'parallel',
  HYBRID = 'hybrid'
}

export enum FailureHandling {
  STRICT = 'strict',
  TOLERANT = 'tolerant',
  ADAPTIVE = 'adaptive'
}

// Multi-site coordination types
export interface MultiSiteStrategy {
  id: string;
  objective: string;
  sites: SiteTask[];
  coordinationPlan: CoordinationPlan;
  dataFlowPlan: DataFlowPlan;
  failureHandling: MultiSiteFailureHandling;
  estimatedDuration: number;
  successProbability: number;
}

export interface SiteTask {
  id: string;
  url: string;
  objective: string;
  actions: PlannedAction[];
  priority: number;
  dependencies: string[];
  dataRequirements: DataRequirement[];
  timeConstraints: TimeConstraint[];
  fallbackSites: string[];
}

export interface CoordinationPlan {
  executionOrder: ExecutionOrder;
  synchronizationPoints: SynchronizationPoint[];
  resourceSharing: ResourceSharingPlan;
  parallelizationStrategy: ParallelizationStrategy;
}