import { AutomationAction, AutomationError, ExtractedData } from '../../shared/types.js';

// Core reasoning interfaces
export interface BrowserState {
  url: string;
  title: string;
  pageType: PageType;
  loadState: LoadState;
  elementMap: ElementMap;
  screenshots: Screenshot[];
  accessibility: AccessibilityInfo;
  performance: PerformanceMetrics;
  errors: BrowserError[];
}

export interface ActionHistory {
  actions: ExecutedAction[];
  totalActions: number;
  successfulActions: number;
  failedActions: number;
  patterns: ActionPattern[];
  timespan: number;
}

export interface ExecutedAction {
  id: string;
  action: AutomationAction;
  timestamp: Date;
  duration: number;
  success: boolean;
  result: ActionResult;
  reasoning: string;
  confidence: number;
}

export interface ActionResult {
  success: boolean;
  data?: ExtractedData[];
  screenshot?: Buffer;
  error?: AutomationError;
  stateChanges: StateChange[];
  extractedData: ExtractedData[];
  performance: ActionPerformance;
}

export interface ReasoningResult {
  thinking: string;
  evaluation: string;
  memory: string;
  nextGoal: string;
  confidence: number;
  alternatives: AlternativeAction[];
}

export interface ActionEvaluation {
  success: boolean;
  reasoning: string;
  lessons: string[];
  nextRecommendations: string[];
  confidence: number;
  shouldRetry: boolean;
  alternativeApproaches: string[];
}

export interface ReasoningContext {
  currentState: BrowserState;
  taskObjective: string;
  actionHistory: ActionHistory;
  memoryContext: MemoryContext;
  constraints: TaskConstraint[];
  timeRemaining: number;
}

export interface ActionPlan {
  id: string;
  objective: string;
  steps: PlannedAction[];
  contingencies: ContingencyPlan[];
  successCriteria: string[];
  timeoutStrategy: TimeoutStrategy;
  confidence: number;
}

export interface StuckDetection {
  isStuck: boolean;
  pattern: ActionPattern;
  confidence: number;
  suggestedBreakout: AlternativeAction[];
  reasoning: string;
}

export interface DecisionExplanation {
  decision: string;
  reasoning: string;
  factors: DecisionFactor[];
  confidence: number;
  alternatives: AlternativeDecision[];
  riskAssessment: RiskAssessment;
}

// Supporting types
export interface AlternativeAction {
  action: AutomationAction;
  reasoning: string;
  confidence: number;
  estimatedSuccess: number;
}

export interface PlannedAction {
  id: string;
  action: AutomationAction;
  reasoning: string;
  dependencies: string[];
  successCriteria: string[];
  fallbacks: AlternativeAction[];
}

export interface ContingencyPlan {
  condition: string;
  actions: PlannedAction[];
  reasoning: string;
}

export interface TimeoutStrategy {
  maxDuration: number;
  checkpoints: number[];
  fallbackActions: PlannedAction[];
}

export interface ActionPattern {
  id: string;
  actions: string[];
  frequency: number;
  lastOccurrence: Date;
  isProblematic: boolean;
}

export interface MemoryContext {
  recentPatterns: ActionPattern[];
  successfulStrategies: SuccessfulStrategy[];
  failedAttempts: FailedAttempt[];
  siteSpecificLearnings: SiteSpecificLearning[];
}

export interface TaskConstraint {
  type: 'time' | 'resource' | 'ethical' | 'technical';
  description: string;
  severity: 'low' | 'medium' | 'high';
}

export interface StateChange {
  type: 'url' | 'dom' | 'visibility' | 'content';
  before: any;
  after: any;
  timestamp: Date;
}

export interface ActionPerformance {
  executionTime: number;
  memoryUsage: number;
  networkRequests: number;
  domChanges: number;
}

export interface DecisionFactor {
  factor: string;
  weight: number;
  value: any;
  impact: 'positive' | 'negative' | 'neutral';
}

export interface AlternativeDecision {
  decision: string;
  reasoning: string;
  confidence: number;
  tradeoffs: string[];
}

export interface RiskAssessment {
  level: 'low' | 'medium' | 'high';
  factors: string[];
  mitigation: string[];
}

export interface SuccessfulStrategy {
  id: string;
  context: string;
  actions: AutomationAction[];
  successRate: number;
  lastUsed: Date;
}

export interface FailedAttempt {
  id: string;
  context: string;
  action: AutomationAction;
  error: AutomationError;
  timestamp: Date;
  lessons: string[];
}

export interface SiteSpecificLearning {
  domain: string;
  patterns: ActionPattern[];
  successfulStrategies: SuccessfulStrategy[];
  commonIssues: string[];
  lastUpdated: Date;
}

// Enums
export enum PageType {
  FORM = 'form',
  SEARCH = 'search',
  LISTING = 'listing',
  ARTICLE = 'article',
  NAVIGATION = 'navigation',
  UNKNOWN = 'unknown'
}

export enum LoadState {
  LOADING = 'loading',
  LOADED = 'loaded',
  INTERACTIVE = 'interactive',
  COMPLETE = 'complete',
  ERROR = 'error'
}

// Element discovery types
export interface ElementMap {
  indexed: Map<number, SemanticElement>;
  byPurpose: Map<ElementPurpose, SemanticElement[]>;
  byType: Map<ElementType, SemanticElement[]>;
  relationships: ElementRelationship[];
}

export interface SemanticElement {
  index: number;
  domElement: DOMElement;
  purpose: ElementPurpose;
  confidence: number;
  context: string;
  alternatives: AlternativeSelector[];
}

export interface DOMElement {
  tagName: string;
  id?: string;
  className?: string;
  textContent?: string;
  attributes: Record<string, string>;
  boundingBox: BoundingBox;
  isVisible: boolean;
  isInteractable: boolean;
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface AlternativeSelector {
  type: 'css' | 'xpath' | 'text' | 'role';
  value: string;
  confidence: number;
}

export interface ElementRelationship {
  parent: number;
  children: number[];
  siblings: number[];
  type: 'form' | 'navigation' | 'content' | 'interactive';
}

export enum ElementPurpose {
  BUTTON = 'button',
  INPUT = 'input',
  LINK = 'link',
  FORM = 'form',
  NAVIGATION = 'navigation',
  CONTENT = 'content',
  SEARCH = 'search',
  SUBMIT = 'submit',
  UNKNOWN = 'unknown'
}

export enum ElementType {
  CLICKABLE = 'clickable',
  TYPEABLE = 'typeable',
  SELECTABLE = 'selectable',
  EXTRACTABLE = 'extractable',
  NAVIGATIONAL = 'navigational'
}

// Browser and performance types
export interface Screenshot {
  id: string;
  data: Buffer;
  timestamp: Date;
  viewport: { width: number; height: number };
  fullPage: boolean;
}

export interface AccessibilityInfo {
  violations: AccessibilityViolation[];
  score: number;
  recommendations: string[];
}

export interface AccessibilityViolation {
  rule: string;
  severity: 'minor' | 'moderate' | 'serious' | 'critical';
  element: string;
  description: string;
}

export interface PerformanceMetrics {
  loadTime: number;
  domContentLoaded: number;
  firstContentfulPaint: number;
  largestContentfulPaint: number;
  cumulativeLayoutShift: number;
  memoryUsage: number;
}

export interface BrowserError {
  type: 'javascript' | 'network' | 'security' | 'timeout';
  message: string;
  source: string;
  timestamp: Date;
  severity: 'low' | 'medium' | 'high';
}

// Main interface
export interface IReasoningEngine {
  /**
   * Analyzes the current browser state and action history to provide reasoning insights
   */
  analyzeCurrentState(state: BrowserState, history: ActionHistory): Promise<ReasoningResult>;

  /**
   * Evaluates the success/failure of a previous action and provides learning insights
   */
  evaluatePreviousAction(action: ExecutedAction, result: ActionResult): Promise<ActionEvaluation>;

  /**
   * Generates next steps based on current context and reasoning
   */
  generateNextSteps(context: ReasoningContext): Promise<ActionPlan>;

  /**
   * Detects if the automation is stuck in a loop or pattern
   */
  detectStuckPattern(history: ActionHistory): Promise<StuckDetection>;

  /**
   * Provides detailed explanation for a decision made by the reasoning engine
   */
  explainDecision(decision: ActionDecision): Promise<DecisionExplanation>;

  /**
   * Updates the reasoning engine's memory with new learnings
   */
  updateMemory(learning: LearningInsight): Promise<void>;

  /**
   * Retrieves relevant patterns and strategies from memory
   */
  getRelevantMemory(context: string): Promise<MemoryContext>;
}

export interface ActionDecision {
  action: AutomationAction;
  reasoning: string;
  context: ReasoningContext;
  alternatives: AlternativeAction[];
}

export interface LearningInsight {
  type: 'success' | 'failure' | 'pattern' | 'optimization';
  context: string;
  insight: string;
  confidence: number;
  applicability: string[];
  timestamp: Date;
}