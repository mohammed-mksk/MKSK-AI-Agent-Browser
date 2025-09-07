/**
 * Error Recovery Interface
 * 
 * Purpose: Defines intelligent error recovery capabilities for browser automation.
 * This interface provides AI-driven error classification, recovery strategy generation,
 * and progressive fallback mechanisms to handle automation failures gracefully.
 */

import { AutomationError, ActionContext } from '../../shared/types.js';

export interface IErrorRecovery {
  /**
   * Classify an automation error to determine its type and severity
   * @param error - The error to classify
   * @param context - Context in which the error occurred
   * @returns Promise resolving to error classification
   */
  classifyError(error: AutomationError, context: ActionContext): Promise<ErrorClassification>;

  /**
   * Generate recovery strategies for a classified error
   * @param classification - The classified error
   * @param context - Optional action context for enhanced strategy generation
   * @returns Promise resolving to array of recovery strategies
   */
  generateRecoveryStrategies(classification: ErrorClassification, context?: ActionContext): Promise<RecoveryStrategy[]>;

  /**
   * Execute a specific recovery strategy
   * @param strategy - The recovery strategy to execute
   * @param context - Current action context
   * @returns Promise resolving to recovery result
   */
  executeRecoveryStrategy(strategy: RecoveryStrategy, context: ActionContext): Promise<RecoveryResult>;

  /**
   * Handle CAPTCHA detection and resolution
   * @param captchaType - Type of CAPTCHA detected
   * @param context - Current page context
   * @returns Promise resolving to CAPTCHA handling result
   */
  handleCaptcha(captchaType: CaptchaType, context: ActionContext): Promise<CaptchaHandlingResult>;

  /**
   * Manage timeout situations with intelligent waiting strategies
   * @param timeoutContext - Context of the timeout situation
   * @returns Promise resolving to timeout resolution
   */
  manageTimeout(timeoutContext: TimeoutContext): Promise<TimeoutResolution>;

  /**
   * Check if an error is recoverable
   * @param error - The error to check
   * @returns Promise resolving to recoverability assessment
   */
  isRecoverable(error: AutomationError): Promise<boolean>;

  /**
   * Get recovery statistics for monitoring and optimization
   * @returns Promise resolving to recovery statistics
   */
  getRecoveryStats(): Promise<RecoveryStats>;
}

/**
 * Error Classification Result
 */
export interface ErrorClassification {
  /** Type of error detected */
  type: ErrorType;
  /** Severity level of the error */
  severity: ErrorSeverity;
  /** Context in which error occurred */
  context: ErrorContext;
  /** Possible causes of the error */
  possibleCauses: string[];
  /** Whether the error is recoverable */
  recoverable: boolean;
  /** Confidence in the classification */
  confidence: number;
  /** Additional metadata */
  metadata: Record<string, any>;
}

/**
 * Error Types
 */
export enum ErrorType {
  ELEMENT_NOT_FOUND = 'element_not_found',
  PAGE_LOAD_TIMEOUT = 'page_load_timeout',
  CAPTCHA_DETECTED = 'captcha_detected',
  BOT_DETECTION = 'bot_detection',
  NETWORK_ERROR = 'network_error',
  JAVASCRIPT_ERROR = 'javascript_error',
  PERMISSION_DENIED = 'permission_denied',
  RATE_LIMITED = 'rate_limited',
  POPUP_BLOCKING = 'popup_blocking',
  FORM_VALIDATION_ERROR = 'form_validation_error',
  AUTHENTICATION_REQUIRED = 'authentication_required',
  UNKNOWN = 'unknown'
}

/**
 * Error Severity Levels
 */
export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

/**
 * Error Context Information
 */
export interface ErrorContext {
  /** URL where error occurred */
  url: string;
  /** Current step being executed */
  currentStep?: string;
  /** Element selector that failed */
  failedSelector?: string;
  /** Page state at time of error */
  pageState: any;
  /** Browser state information */
  browserState: any;
  /** Time when error occurred */
  timestamp: Date;
  /** Previous actions leading to error */
  actionHistory: any[];
}

/**
 * Recovery Strategy
 */
export interface RecoveryStrategy {
  /** Unique identifier for the strategy */
  id: string;
  /** Human-readable name */
  name: string;
  /** Description of what the strategy does */
  description: string;
  /** Steps to execute for recovery */
  steps: RecoveryStep[];
  /** Estimated success probability */
  successProbability: number;
  /** Estimated time to execute */
  timeEstimate: number;
  /** Priority level (higher = try first) */
  priority: number;
  /** Fallback strategy if this fails */
  fallbackStrategy?: RecoveryStrategy;
  /** Conditions under which this strategy applies */
  applicableConditions: string[];
}

/**
 * Recovery Step
 */
export interface RecoveryStep {
  /** Type of recovery action */
  type: RecoveryActionType;
  /** Description of the step */
  description: string;
  /** Parameters for the action */
  parameters: Record<string, any>;
  /** Timeout for this step */
  timeout: number;
  /** Whether this step is optional */
  optional: boolean;
}

/**
 * Recovery Action Types
 */
export enum RecoveryActionType {
  WAIT = 'wait',
  REFRESH_PAGE = 'refresh_page',
  RETRY_ACTION = 'retry_action',
  ALTERNATIVE_SELECTOR = 'alternative_selector',
  SCROLL_TO_ELEMENT = 'scroll_to_element',
  CLEAR_CACHE = 'clear_cache',
  CHANGE_USER_AGENT = 'change_user_agent',
  ADD_DELAY = 'add_delay',
  HANDLE_POPUP = 'handle_popup',
  BYPASS_CAPTCHA = 'bypass_captcha',
  SWITCH_TAB = 'switch_tab',
  RESTART_BROWSER = 'restart_browser'
}

/**
 * Recovery Result
 */
export interface RecoveryResult {
  /** Whether recovery was successful */
  success: boolean;
  /** Strategy that was executed */
  strategy: RecoveryStrategy;
  /** Steps that were completed */
  completedSteps: RecoveryStep[];
  /** Time taken for recovery */
  duration: number;
  /** New context after recovery */
  newContext?: ActionContext;
  /** Error if recovery failed */
  error?: AutomationError;
  /** Lessons learned for future recovery */
  learnings: string[];
}

/**
 * CAPTCHA Types
 */
export enum CaptchaType {
  RECAPTCHA_V2 = 'recaptcha_v2',
  RECAPTCHA_V3 = 'recaptcha_v3',
  HCAPTCHA = 'hcaptcha',
  IMAGE_CAPTCHA = 'image_captcha',
  TEXT_CAPTCHA = 'text_captcha',
  AUDIO_CAPTCHA = 'audio_captcha',
  UNKNOWN = 'unknown'
}

/**
 * CAPTCHA Handling Result
 */
export interface CaptchaHandlingResult {
  /** Whether CAPTCHA was handled successfully */
  success: boolean;
  /** Method used to handle CAPTCHA */
  method: CaptchaHandlingMethod;
  /** Time taken to handle CAPTCHA */
  duration: number;
  /** Confidence in the solution */
  confidence: number;
  /** Error if handling failed */
  error?: string;
}

/**
 * CAPTCHA Handling Methods
 */
export enum CaptchaHandlingMethod {
  BYPASS = 'bypass',
  SOLVE_AUTOMATICALLY = 'solve_automatically',
  REQUEST_USER_INPUT = 'request_user_input',
  USE_SERVICE = 'use_service',
  SKIP = 'skip'
}

/**
 * Timeout Context
 */
export interface TimeoutContext {
  /** Type of timeout that occurred */
  timeoutType: TimeoutType;
  /** Expected wait time */
  expectedWaitTime: number;
  /** Actual wait time before timeout */
  actualWaitTime: number;
  /** Element or condition being waited for */
  waitTarget: string;
  /** Current page state */
  pageState: any;
  /** Network conditions */
  networkConditions?: NetworkConditions;
}

/**
 * Timeout Types
 */
export enum TimeoutType {
  PAGE_LOAD = 'page_load',
  ELEMENT_WAIT = 'element_wait',
  NETWORK_REQUEST = 'network_request',
  JAVASCRIPT_EXECUTION = 'javascript_execution',
  USER_INPUT = 'user_input'
}

/**
 * Network Conditions
 */
export interface NetworkConditions {
  /** Connection speed */
  speed: 'slow' | 'medium' | 'fast';
  /** Latency in milliseconds */
  latency: number;
  /** Whether connection is stable */
  stable: boolean;
  /** Recent network errors */
  recentErrors: string[];
}

/**
 * Timeout Resolution
 */
export interface TimeoutResolution {
  /** Whether timeout was resolved */
  resolved: boolean;
  /** Method used to resolve timeout */
  method: TimeoutResolutionMethod;
  /** New timeout value if adjusted */
  newTimeout?: number;
  /** Time taken to resolve */
  duration: number;
  /** Whether to retry the original action */
  shouldRetry: boolean;
}

/**
 * Timeout Resolution Methods
 */
export enum TimeoutResolutionMethod {
  EXTEND_TIMEOUT = 'extend_timeout',
  RETRY_WITH_DELAY = 'retry_with_delay',
  ALTERNATIVE_APPROACH = 'alternative_approach',
  SKIP_STEP = 'skip_step',
  ABORT_TASK = 'abort_task'
}

/**
 * Recovery Statistics
 */
export interface RecoveryStats {
  /** Total number of errors encountered */
  totalErrors: number;
  /** Number of successful recoveries */
  successfulRecoveries: number;
  /** Success rate percentage */
  successRate: number;
  /** Most common error types */
  commonErrorTypes: Array<{ type: ErrorType; count: number }>;
  /** Most effective recovery strategies */
  effectiveStrategies: Array<{ strategy: string; successRate: number }>;
  /** Average recovery time */
  averageRecoveryTime: number;
  /** Time period for these statistics */
  timePeriod: {
    start: Date;
    end: Date;
  };
}