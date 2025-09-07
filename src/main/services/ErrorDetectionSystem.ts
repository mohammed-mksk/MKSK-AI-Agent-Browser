/**
 * Error Detection and Classification System
 * 
 * Purpose: Specialized system for detecting and classifying automation errors
 * using AI-powered analysis and pattern recognition. This system provides
 * comprehensive error detection capabilities with context-aware classification.
 */

import {
  ErrorClassification,
  ErrorType,
  ErrorSeverity,
  ErrorContext
} from '../interfaces/IErrorRecovery.js';
import { AutomationError, ActionContext } from '../../shared/types.js';
import { AIProviderManager } from './AIProviderManager.js';

export interface IErrorDetection {
  /**
   * Detect errors from browser automation context
   * @param context - Current automation context
   * @returns Promise resolving to detected errors
   */
  detectErrors(context: ActionContext): Promise<AutomationError[]>;

  /**
   * Classify a detected error with AI analysis
   * @param error - The error to classify
   * @param context - Context in which error occurred
   * @returns Promise resolving to error classification
   */
  classifyError(error: AutomationError, context: ActionContext): Promise<ErrorClassification>;

  /**
   * Analyze error severity based on context and impact
   * @param error - The error to analyze
   * @param context - Current context
   * @returns Promise resolving to severity assessment
   */
  analyzeSeverity(error: AutomationError, context: ActionContext): Promise<ErrorSeverity>;

  /**
   * Detect error patterns and trends
   * @param errors - Array of recent errors
   * @returns Promise resolving to pattern analysis
   */
  detectErrorPatterns(errors: AutomationError[]): Promise<ErrorPatternAnalysis>;

  /**
   * Predict potential errors based on current state
   * @param context - Current automation context
   * @returns Promise resolving to error predictions
   */
  predictPotentialErrors(context: ActionContext): Promise<ErrorPrediction[]>;
}

export interface ErrorPatternAnalysis {
  /** Recurring error patterns */
  patterns: ErrorPattern[];
  /** Trend analysis */
  trends: ErrorTrend[];
  /** Risk assessment */
  riskLevel: 'low' | 'medium' | 'high';
  /** Recommendations */
  recommendations: string[];
}

export interface ErrorPattern {
  /** Pattern identifier */
  id: string;
  /** Error types in pattern */
  errorTypes: ErrorType[];
  /** Frequency of occurrence */
  frequency: number;
  /** Context conditions */
  conditions: string[];
  /** Confidence in pattern */
  confidence: number;
}

export interface ErrorTrend {
  /** Trend type */
  type: 'increasing' | 'decreasing' | 'stable';
  /** Error type being tracked */
  errorType: ErrorType;
  /** Change rate */
  changeRate: number;
  /** Time period */
  timePeriod: string;
}

export interface ErrorPrediction {
  /** Predicted error type */
  errorType: ErrorType;
  /** Probability of occurrence */
  probability: number;
  /** Conditions that may trigger error */
  triggerConditions: string[];
  /** Preventive actions */
  preventiveActions: string[];
  /** Time window for prediction */
  timeWindow: number;
}

export class ErrorDetectionSystem implements IErrorDetection {
  private aiProvider: AIProviderManager;
  private errorHistory: Map<string, AutomationError[]> = new Map();
  private classificationCache: Map<string, ErrorClassification> = new Map();
  private patternDatabase: Map<string, ErrorPattern> = new Map();

  constructor(aiProvider: AIProviderManager) {
    this.aiProvider = aiProvider;
  }

  async detectErrors(context: ActionContext): Promise<AutomationError[]> {
    const detectedErrors: AutomationError[] = [];

    try {
      // Check for common error indicators
      const commonErrors = await this.detectCommonErrors(context);
      detectedErrors.push(...commonErrors);

      // Use AI to detect subtle errors
      const aiDetectedErrors = await this.aiDetectErrors(context);
      detectedErrors.push(...aiDetectedErrors);

      // Check for performance-related errors
      const performanceErrors = await this.detectPerformanceErrors(context);
      detectedErrors.push(...performanceErrors);

      // Store detected errors in history
      await this.storeErrorHistory(context.currentUrl, detectedErrors);

      return detectedErrors;
    } catch (detectionError) {
      console.error('Error detection failed:', detectionError);
      return [];
    }
  }

  async classifyError(error: AutomationError, context: ActionContext): Promise<ErrorClassification> {
    try {
      // Check cache first
      const cacheKey = this.generateCacheKey(error, context);
      const cachedClassification = this.classificationCache.get(cacheKey);
      if (cachedClassification) {
        return cachedClassification;
      }

      // Perform comprehensive classification
      const classification = await this.performComprehensiveClassification(error, context);
      
      // Cache the result
      this.classificationCache.set(cacheKey, classification);
      
      return classification;
    } catch (classificationError) {
      console.error('Error classification failed:', classificationError);
      return this.createFallbackClassification(error, context);
    }
  }

  async analyzeSeverity(error: AutomationError, context: ActionContext): Promise<ErrorSeverity> {
    try {
      const severityFactors = await this.analyzeSeverityFactors(error, context);
      return this.calculateSeverity(severityFactors);
    } catch (severityError) {
      console.error('Severity analysis failed:', severityError);
      return ErrorSeverity.MEDIUM; // Conservative fallback
    }
  }

  async detectErrorPatterns(errors: AutomationError[]): Promise<ErrorPatternAnalysis> {
    try {
      // Group errors by type and context
      const groupedErrors = this.groupErrorsByPattern(errors);
      
      // Identify recurring patterns
      const patterns = await this.identifyRecurringPatterns(groupedErrors);
      
      // Analyze trends
      const trends = await this.analyzeTrends(errors);
      
      // Assess risk level
      const riskLevel = this.assessRiskLevel(patterns, trends);
      
      // Generate recommendations
      const recommendations = await this.generateRecommendations(patterns, trends);

      return {
        patterns,
        trends,
        riskLevel,
        recommendations
      };
    } catch (patternError) {
      console.error('Pattern detection failed:', patternError);
      return {
        patterns: [],
        trends: [],
        riskLevel: 'low',
        recommendations: []
      };
    }
  }

  async predictPotentialErrors(context: ActionContext): Promise<ErrorPrediction[]> {
    try {
      const predictions: ErrorPrediction[] = [];

      // Analyze current context for risk factors
      const riskFactors = await this.analyzeRiskFactors(context);
      
      // Use AI to predict potential errors
      const aiPredictions = await this.aiPredictErrors(context, riskFactors);
      predictions.push(...aiPredictions);
      
      // Use historical patterns for prediction
      const patternPredictions = await this.predictFromPatterns(context);
      predictions.push(...patternPredictions);

      // Sort by probability
      return predictions.sort((a, b) => b.probability - a.probability);
    } catch (predictionError) {
      console.error('Error prediction failed:', predictionError);
      return [];
    }
  }

  // Private helper methods

  private async detectCommonErrors(context: ActionContext): Promise<AutomationError[]> {
    const errors: AutomationError[] = [];

    // Check for element not found scenarios
    if (context.targetElement && !await this.elementExists(context.targetElement)) {
      errors.push({
        id: `element_not_found_${Date.now()}`,
        type: 'element_not_found',
        message: `Element not found: ${JSON.stringify(context.targetElement)}`,
        context: { selector: context.targetElement },
        timestamp: new Date()
      });
    }

    // Check for timeout scenarios
    if (context.timeConstraints && context.timeConstraints < Date.now()) {
      errors.push({
        id: `timeout_${Date.now()}`,
        type: 'timeout',
        message: 'Operation timeout exceeded',
        context: { timeConstraint: context.timeConstraints },
        timestamp: new Date()
      });
    }

    return errors;
  }

  private async aiDetectErrors(context: ActionContext): Promise<AutomationError[]> {
    try {
      const prompt = `
        Analyze this browser automation context for potential errors:
        
        Context:
        - URL: ${context.currentUrl}
        - Objective: ${context.objective || 'N/A'}
        - Target Element: ${JSON.stringify(context.targetElement, null, 2)}
        - Page State: ${JSON.stringify(context.pageState, null, 2)}
        - Previous Actions: ${JSON.stringify(context.previousActions?.slice(-3), null, 2)}
        
        Look for signs of:
        1. Elements that may not be accessible
        2. Page state issues
        3. Navigation problems
        4. Form validation errors
        5. Network or loading issues
        
        Respond with JSON array of detected errors:
        [
          {
            "type": "error_type",
            "message": "error description",
            "context": {},
            "confidence": 0.8
          }
        ]
        
        Return empty array if no errors detected.
      `;

      const response = await this.aiProvider.generateCompletion(prompt, {
        temperature: 0.1,
        maxTokens: 500
      });

      const aiErrors = JSON.parse(response);
      
      return aiErrors.map((error: any, index: number) => ({
        id: `ai_detected_${Date.now()}_${index}`,
        type: error.type,
        message: error.message,
        context: error.context,
        timestamp: new Date()
      }));
    } catch (aiError) {
      console.error('AI error detection failed:', aiError);
      return [];
    }
  }

  private async detectPerformanceErrors(context: ActionContext): Promise<AutomationError[]> {
    const errors: AutomationError[] = [];

    // Check for slow page load (placeholder - would need actual performance metrics)
    const pageLoadTime = this.getPageLoadTime(context);
    if (pageLoadTime > 10000) { // 10 seconds
      errors.push({
        id: `slow_page_load_${Date.now()}`,
        type: 'timeout',
        message: `Slow page load detected: ${pageLoadTime}ms`,
        context: { loadTime: pageLoadTime },
        timestamp: new Date()
      });
    }

    return errors;
  }

  private async performComprehensiveClassification(error: AutomationError, context: ActionContext): Promise<ErrorClassification> {
    // Use AI for detailed classification
    const prompt = `
      Perform comprehensive classification of this automation error:
      
      Error Details:
      - Type: ${error.type}
      - Message: ${error.message}
      - Context: ${JSON.stringify(error.context, null, 2)}
      - Timestamp: ${error.timestamp}
      
      Action Context:
      - URL: ${context.currentUrl}
      - Objective: ${context.objective || 'N/A'}
      - Target Element: ${JSON.stringify(context.targetElement, null, 2)}
      
      Provide detailed classification:
      1. Specific error type from predefined categories
      2. Severity level (low/medium/high/critical)
      3. Root cause analysis
      4. Recoverability assessment
      5. Context impact analysis
      
      Respond with JSON:
      {
        "type": "specific_error_type",
        "severity": "severity_level",
        "possibleCauses": ["cause1", "cause2"],
        "recoverable": boolean,
        "confidence": 0.9,
        "contextImpact": "impact_description",
        "metadata": {}
      }
    `;

    const response = await this.aiProvider.generateCompletion(prompt, {
      temperature: 0.1,
      maxTokens: 600
    });

    const aiClassification = JSON.parse(response);

    return {
      type: this.mapToErrorType(aiClassification.type),
      severity: this.mapToSeverity(aiClassification.severity),
      context: this.createErrorContext(error, context),
      possibleCauses: aiClassification.possibleCauses,
      recoverable: aiClassification.recoverable,
      confidence: aiClassification.confidence,
      metadata: {
        ...aiClassification.metadata,
        contextImpact: aiClassification.contextImpact,
        classificationTimestamp: new Date()
      }
    };
  }

  private async analyzeSeverityFactors(error: AutomationError, context: ActionContext): Promise<SeverityFactors> {
    return {
      errorType: error.type,
      contextCriticality: this.assessContextCriticality(context),
      userImpact: this.assessUserImpact(error, context),
      systemImpact: this.assessSystemImpact(error),
      recoverability: await this.assessRecoverability(error),
      frequency: this.getErrorFrequency(error.type)
    };
  }

  private calculateSeverity(factors: SeverityFactors): ErrorSeverity {
    let severityScore = 0;

    // Weight different factors
    severityScore += factors.contextCriticality * 0.3;
    severityScore += factors.userImpact * 0.25;
    severityScore += factors.systemImpact * 0.2;
    severityScore += (factors.recoverability ? 0 : 1) * 0.15;
    severityScore += Math.min(factors.frequency / 10, 1) * 0.1;

    if (severityScore >= 0.8) return ErrorSeverity.CRITICAL;
    if (severityScore >= 0.6) return ErrorSeverity.HIGH;
    if (severityScore >= 0.4) return ErrorSeverity.MEDIUM;
    return ErrorSeverity.LOW;
  }

  private groupErrorsByPattern(errors: AutomationError[]): Map<string, AutomationError[]> {
    const grouped = new Map<string, AutomationError[]>();

    for (const error of errors) {
      const patternKey = `${error.type}_${this.extractPatternSignature(error)}`;
      
      if (!grouped.has(patternKey)) {
        grouped.set(patternKey, []);
      }
      
      grouped.get(patternKey)!.push(error);
    }

    return grouped;
  }

  private async identifyRecurringPatterns(groupedErrors: Map<string, AutomationError[]>): Promise<ErrorPattern[]> {
    const patterns: ErrorPattern[] = [];

    for (const [patternKey, errors] of groupedErrors) {
      if (errors.length >= 3) { // Minimum occurrences for a pattern
        const pattern: ErrorPattern = {
          id: patternKey,
          errorTypes: [...new Set(errors.map(e => this.mapToErrorType(e.type)))],
          frequency: errors.length,
          conditions: this.extractCommonConditions(errors),
          confidence: Math.min(errors.length / 10, 1) // Max confidence at 10 occurrences
        };
        
        patterns.push(pattern);
      }
    }

    return patterns.sort((a, b) => b.frequency - a.frequency);
  }

  private async analyzeTrends(errors: AutomationError[]): Promise<ErrorTrend[]> {
    const trends: ErrorTrend[] = [];
    const timeWindow = 24 * 60 * 60 * 1000; // 24 hours
    const now = Date.now();
    
    // Group errors by type and time
    const errorsByType = new Map<string, AutomationError[]>();
    
    for (const error of errors) {
      if (now - error.timestamp.getTime() <= timeWindow) {
        if (!errorsByType.has(error.type)) {
          errorsByType.set(error.type, []);
        }
        errorsByType.get(error.type)!.push(error);
      }
    }

    // Analyze trends for each error type
    for (const [errorType, typeErrors] of errorsByType) {
      if (typeErrors.length >= 2) {
        const trend = this.calculateTrend(typeErrors);
        trends.push({
          type: trend.direction,
          errorType: this.mapToErrorType(errorType),
          changeRate: trend.rate,
          timePeriod: '24h'
        });
      }
    }

    return trends;
  }

  private assessRiskLevel(patterns: ErrorPattern[], trends: ErrorTrend[]): 'low' | 'medium' | 'high' {
    let riskScore = 0;

    // Factor in pattern frequency
    const totalPatternFrequency = patterns.reduce((sum, p) => sum + p.frequency, 0);
    riskScore += Math.min(totalPatternFrequency / 20, 1) * 0.4;

    // Factor in increasing trends
    const increasingTrends = trends.filter(t => t.type === 'increasing').length;
    riskScore += Math.min(increasingTrends / 5, 1) * 0.6;

    if (riskScore >= 0.7) return 'high';
    if (riskScore >= 0.4) return 'medium';
    return 'low';
  }

  private async generateRecommendations(patterns: ErrorPattern[], trends: ErrorTrend[]): Promise<string[]> {
    const recommendations: string[] = [];

    // Recommendations based on patterns
    for (const pattern of patterns.slice(0, 3)) { // Top 3 patterns
      if (pattern.frequency > 5) {
        recommendations.push(`Address recurring ${pattern.errorTypes.join(', ')} errors - occurred ${pattern.frequency} times`);
      }
    }

    // Recommendations based on trends
    for (const trend of trends) {
      if (trend.type === 'increasing' && trend.changeRate > 0.5) {
        recommendations.push(`Monitor increasing ${trend.errorType} errors - ${Math.round(trend.changeRate * 100)}% increase`);
      }
    }

    return recommendations;
  }

  private async analyzeRiskFactors(context: ActionContext): Promise<RiskFactor[]> {
    const riskFactors: RiskFactor[] = [];

    // Check for complex selectors
    if (context.targetElement && this.isComplexSelector(context.targetElement)) {
      riskFactors.push({
        type: 'complex_selector',
        severity: 0.6,
        description: 'Complex element selector may be fragile'
      });
    }

    // Check for time constraints
    if (context.timeConstraints && context.timeConstraints - Date.now() < 5000) {
      riskFactors.push({
        type: 'time_pressure',
        severity: 0.8,
        description: 'Tight time constraints increase error risk'
      });
    }

    return riskFactors;
  }

  private async aiPredictErrors(context: ActionContext, riskFactors: RiskFactor[]): Promise<ErrorPrediction[]> {
    try {
      const prompt = `
        Predict potential errors for this automation context:
        
        Context:
        - URL: ${context.currentUrl}
        - Objective: ${context.objective || 'N/A'}
        - Target Element: ${JSON.stringify(context.targetElement, null, 2)}
        
        Risk Factors:
        ${riskFactors.map(rf => `- ${rf.type}: ${rf.description} (severity: ${rf.severity})`).join('\n')}
        
        Predict potential errors with:
        1. Error type
        2. Probability (0-1)
        3. Trigger conditions
        4. Preventive actions
        5. Time window (milliseconds)
        
        Respond with JSON array:
        [
          {
            "errorType": "error_type",
            "probability": 0.7,
            "triggerConditions": ["condition1"],
            "preventiveActions": ["action1"],
            "timeWindow": 30000
          }
        ]
      `;

      const response = await this.aiProvider.generateCompletion(prompt, {
        temperature: 0.2,
        maxTokens: 600
      });

      const predictions = JSON.parse(response);
      
      return predictions.map((pred: any) => ({
        errorType: this.mapToErrorType(pred.errorType),
        probability: pred.probability,
        triggerConditions: pred.triggerConditions,
        preventiveActions: pred.preventiveActions,
        timeWindow: pred.timeWindow
      }));
    } catch (predictionError) {
      console.error('AI error prediction failed:', predictionError);
      return [];
    }
  }

  private async predictFromPatterns(context: ActionContext): Promise<ErrorPrediction[]> {
    const predictions: ErrorPrediction[] = [];
    
    // Use stored patterns to predict errors
    for (const [patternId, pattern] of this.patternDatabase) {
      if (this.contextMatchesPattern(context, pattern)) {
        for (const errorType of pattern.errorTypes) {
          predictions.push({
            errorType,
            probability: pattern.confidence * 0.8, // Slightly lower than pattern confidence
            triggerConditions: pattern.conditions,
            preventiveActions: [`Avoid conditions that trigger ${patternId}`],
            timeWindow: 60000 // 1 minute
          });
        }
      }
    }

    return predictions;
  }

  // Utility methods

  private generateCacheKey(error: AutomationError, context: ActionContext): string {
    return `${error.type}_${error.message.substring(0, 20)}_${context.currentUrl}`;
  }

  private createFallbackClassification(error: AutomationError, context: ActionContext): ErrorClassification {
    return {
      type: this.mapToErrorType(error.type),
      severity: ErrorSeverity.MEDIUM,
      context: this.createErrorContext(error, context),
      possibleCauses: ['Unknown cause'],
      recoverable: true,
      confidence: 0.3,
      metadata: { fallback: true }
    };
  }

  private createErrorContext(error: AutomationError, context: ActionContext): ErrorContext {
    return {
      url: context.currentUrl,
      currentStep: context.objective,
      failedSelector: JSON.stringify(context.targetElement),
      pageState: context.pageState || {},
      browserState: {},
      timestamp: error.timestamp,
      actionHistory: context.previousActions || []
    };
  }

  private mapToErrorType(type: string): ErrorType {
    const typeMap: Record<string, ErrorType> = {
      'element_not_found': ErrorType.ELEMENT_NOT_FOUND,
      'timeout': ErrorType.PAGE_LOAD_TIMEOUT,
      'network': ErrorType.NETWORK_ERROR,
      'captcha': ErrorType.CAPTCHA_DETECTED,
      'bot_detection': ErrorType.BOT_DETECTION,
      'javascript': ErrorType.JAVASCRIPT_ERROR,
      'permission': ErrorType.PERMISSION_DENIED,
      'rate_limit': ErrorType.RATE_LIMITED
    };

    return typeMap[type] || ErrorType.UNKNOWN;
  }

  private mapToSeverity(severity: string): ErrorSeverity {
    const severityMap: Record<string, ErrorSeverity> = {
      'low': ErrorSeverity.LOW,
      'medium': ErrorSeverity.MEDIUM,
      'high': ErrorSeverity.HIGH,
      'critical': ErrorSeverity.CRITICAL
    };

    return severityMap[severity] || ErrorSeverity.MEDIUM;
  }

  private async elementExists(element: any): Promise<boolean> {
    // Placeholder - would need actual browser integration
    return Math.random() > 0.1; // 90% chance element exists
  }

  private getPageLoadTime(context: ActionContext): number {
    // Placeholder - would need actual performance metrics
    return Math.random() * 15000; // Random load time up to 15 seconds
  }

  private async storeErrorHistory(url: string, errors: AutomationError[]): Promise<void> {
    if (!this.errorHistory.has(url)) {
      this.errorHistory.set(url, []);
    }
    
    this.errorHistory.get(url)!.push(...errors);
    
    // Keep only last 100 errors per URL
    const urlErrors = this.errorHistory.get(url)!;
    if (urlErrors.length > 100) {
      urlErrors.splice(0, urlErrors.length - 100);
    }
  }

  private extractPatternSignature(error: AutomationError): string {
    // Create a signature based on error characteristics
    const contextKeys = Object.keys(error.context).sort().join(',');
    return `${contextKeys}_${error.message.length}`;
  }

  private extractCommonConditions(errors: AutomationError[]): string[] {
    const conditions = new Set<string>();
    
    for (const error of errors) {
      Object.keys(error.context).forEach(key => {
        conditions.add(`${key}:${typeof error.context[key]}`);
      });
    }
    
    return Array.from(conditions);
  }

  private calculateTrend(errors: AutomationError[]): { direction: 'increasing' | 'decreasing' | 'stable'; rate: number } {
    if (errors.length < 2) {
      return { direction: 'stable', rate: 0 };
    }

    // Simple trend calculation based on time distribution
    const sortedErrors = errors.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    const timeSpan = sortedErrors[sortedErrors.length - 1].timestamp.getTime() - sortedErrors[0].timestamp.getTime();
    
    if (timeSpan === 0) {
      return { direction: 'stable', rate: 0 };
    }

    const recentHalf = sortedErrors.slice(Math.floor(sortedErrors.length / 2));
    const recentRate = recentHalf.length / (timeSpan / 2);
    const overallRate = sortedErrors.length / timeSpan;
    
    const changeRate = (recentRate - overallRate) / overallRate;
    
    if (changeRate > 0.2) return { direction: 'increasing', rate: changeRate };
    if (changeRate < -0.2) return { direction: 'decreasing', rate: Math.abs(changeRate) };
    return { direction: 'stable', rate: Math.abs(changeRate) };
  }

  private assessContextCriticality(context: ActionContext): number {
    // Assess how critical the current context is (0-1 scale)
    let criticality = 0.5; // Base criticality
    
    if (context.objective?.toLowerCase().includes('payment')) criticality += 0.3;
    if (context.objective?.toLowerCase().includes('submit')) criticality += 0.2;
    if (context.timeConstraints) criticality += 0.1;
    
    return Math.min(criticality, 1);
  }

  private assessUserImpact(error: AutomationError, context: ActionContext): number {
    // Assess impact on user experience (0-1 scale)
    let impact = 0.5;
    
    if (error.type === 'element_not_found') impact += 0.2;
    if (error.type === 'timeout') impact += 0.3;
    if (context.objective?.toLowerCase().includes('critical')) impact += 0.2;
    
    return Math.min(impact, 1);
  }

  private assessSystemImpact(error: AutomationError): number {
    // Assess impact on system stability (0-1 scale)
    const highImpactTypes = ['network', 'javascript', 'permission_denied'];
    return highImpactTypes.includes(error.type) ? 0.8 : 0.3;
  }

  private async assessRecoverability(error: AutomationError): Promise<boolean> {
    const nonRecoverableTypes = ['permission_denied', 'authentication_required'];
    return !nonRecoverableTypes.includes(error.type);
  }

  private getErrorFrequency(errorType: string): number {
    // Get frequency of this error type from history
    let count = 0;
    for (const errors of this.errorHistory.values()) {
      count += errors.filter(e => e.type === errorType).length;
    }
    return count;
  }

  private isComplexSelector(element: any): boolean {
    if (!element) return false;
    
    const selectorString = JSON.stringify(element);
    return selectorString.length > 50 || selectorString.includes('nth-child') || selectorString.includes('>>');
  }

  private contextMatchesPattern(context: ActionContext, pattern: ErrorPattern): boolean {
    // Simple pattern matching - could be more sophisticated
    return pattern.conditions.some(condition => 
      context.currentUrl.includes(condition) || 
      (context.objective && context.objective.includes(condition))
    );
  }
}

// Supporting interfaces

interface SeverityFactors {
  errorType: string;
  contextCriticality: number;
  userImpact: number;
  systemImpact: number;
  recoverability: boolean;
  frequency: number;
}

interface RiskFactor {
  type: string;
  severity: number;
  description: string;
}