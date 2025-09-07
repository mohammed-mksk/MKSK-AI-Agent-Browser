import { Page } from 'puppeteer-core';
import { 
  AutomationStep, 
  ElementSelector, 
  ActionContext,
  ActionPrediction,
  ActionOptimization,
  TimingStrategy
} from '../../shared/types.js';
import { AIProvider } from './ai/AIProvider.js';
import { MemorySystem } from './MemorySystem.js';
import { Logger } from './Logger.js';
import { ElementDiscoveryService } from './ElementDiscoveryService.js';

export interface SmartActionChoice {
  selectedAction: AutomationStep;
  confidence: number;
  reasoning: string;
  alternatives: AlternativeAction[];
  optimizations: ActionOptimization[];
  timing: TimingStrategy;
  successPrediction: ActionPrediction;
}

export interface AlternativeAction {
  action: AutomationStep;
  confidence: number;
  reasoning: string;
  riskLevel: 'low' | 'medium' | 'high';
}

export interface ActionAnalysis {
  contextFactors: ContextFactor[];
  elementAvailability: ElementAvailability;
  pageState: PageStateAnalysis;
  historicalPerformance: HistoricalData;
  riskAssessment: RiskAssessment;
}

export interface ContextFactor {
  type: 'page_load_time' | 'element_visibility' | 'user_interaction' | 'network_condition' | 'browser_state';
  value: number;
  impact: number;
  description: string;
}

export interface ElementAvailability {
  target: ElementSelector;
  isVisible: boolean;
  isInteractable: boolean;
  confidence: number;
  alternatives: ElementSelector[];
  stability: number;
}

export interface PageStateAnalysis {
  loadState: 'loading' | 'interactive' | 'complete';
  dynamicContent: boolean;
  errorPresent: boolean;
  performanceScore: number;
  accessibility: number;
}

export interface HistoricalData {
  successRate: number;
  averageExecutionTime: number;
  commonFailures: string[];
  optimalTiming: number;
  contextPatterns: string[];
}

export interface RiskAssessment {
  overallRisk: 'low' | 'medium' | 'high';
  factors: RiskFactor[];
  mitigationStrategies: string[];
  fallbackOptions: AutomationStep[];
}

export interface RiskFactor {
  type: string;
  severity: number;
  description: string;
  mitigation: string;
}

export class SmartActionSelector {
  private aiProvider: AIProvider;
  private memorySystem: MemorySystem;
  private elementDiscovery: ElementDiscoveryService;
  private logger: Logger;

  constructor(
    aiProvider: AIProvider,
    memorySystem: MemorySystem,
    elementDiscovery: ElementDiscoveryService
  ) {
    this.aiProvider = aiProvider;
    this.memorySystem = memorySystem;
    this.elementDiscovery = elementDiscovery;
    this.logger = new Logger();
  }

  async selectOptimalAction(
    candidateActions: AutomationStep[],
    context: ActionContext,
    page: Page
  ): Promise<SmartActionChoice> {
    try {
      this.logger.info(`Selecting optimal action from ${candidateActions.length} candidates`);

      // Analyze current context
      const analysis = await this.analyzeActionContext(context, page);

      // Get AI-driven action selection
      const aiChoice = await this.getAIActionChoice(candidateActions, analysis, context);

      // Optimize action parameters
      const optimizations = await this.optimizeActionParameters(aiChoice.selectedAction, analysis);

      // Determine optimal timing
      const timing = await this.calculateOptimalTiming(aiChoice.selectedAction, analysis);

      // Predict success probability
      const successPrediction = await this.predictActionSuccess(aiChoice.selectedAction, analysis);

      const smartChoice: SmartActionChoice = {
        selectedAction: aiChoice.selectedAction,
        confidence: aiChoice.confidence,
        reasoning: aiChoice.reasoning,
        alternatives: aiChoice.alternatives,
        optimizations,
        timing,
        successPrediction
      };

      // Store decision for learning
      await this.storeActionDecision(smartChoice, context);

      this.logger.info(`Selected action: ${smartChoice.selectedAction.type} with confidence ${smartChoice.confidence}`);
      return smartChoice;

    } catch (error) {
      this.logger.error('Smart action selection failed:', error);
      
      // Fallback to first candidate action
      return {
        selectedAction: candidateActions[0],
        confidence: 0.5,
        reasoning: 'Fallback selection due to analysis failure',
        alternatives: [],
        optimizations: [],
        timing: { delay: 0, timeout: 10000 },
        successPrediction: { probability: 0.5, factors: [] }
      };
    }
  }

  private async analyzeActionContext(context: ActionContext, page: Page): Promise<ActionAnalysis> {
    const [
      contextFactors,
      elementAvailability,
      pageState,
      historicalData,
      riskAssessment
    ] = await Promise.all([
      this.analyzeContextFactors(page),
      this.analyzeElementAvailability(context.targetElement, page),
      this.analyzePageState(page),
      this.getHistoricalData(context),
      this.assessRisk(context, page)
    ]);

    return {
      contextFactors,
      elementAvailability,
      pageState,
      historicalData,
      riskAssessment
    };
  }

  private async analyzeContextFactors(page: Page): Promise<ContextFactor[]> {
    const factors: ContextFactor[] = [];

    try {
      // Analyze page load time
      const performanceMetrics = await page.evaluate(() => {
        const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
        return {
          loadTime: navigation.loadEventEnd - navigation.loadEventStart,
          domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
          firstContentfulPaint: performance.getEntriesByName('first-contentful-paint')[0]?.startTime || 0
        };
      });

      factors.push({
        type: 'page_load_time',
        value: performanceMetrics.loadTime,
        impact: this.calculateLoadTimeImpact(performanceMetrics.loadTime),
        description: `Page load time: ${performanceMetrics.loadTime}ms`
      });

      // Analyze network conditions
      const connectionInfo = await page.evaluate(() => {
        const connection = (navigator as any).connection;
        return connection ? {
          effectiveType: connection.effectiveType,
          downlink: connection.downlink,
          rtt: connection.rtt
        } : null;
      });

      if (connectionInfo) {
        factors.push({
          type: 'network_condition',
          value: connectionInfo.downlink,
          impact: this.calculateNetworkImpact(connectionInfo.effectiveType),
          description: `Network: ${connectionInfo.effectiveType}, ${connectionInfo.downlink}Mbps`
        });
      }

      // Analyze browser state
      const browserState = await page.evaluate(() => ({
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        devicePixelRatio: window.devicePixelRatio,
        userAgent: navigator.userAgent
      }));

      factors.push({
        type: 'browser_state',
        value: browserState.viewportWidth,
        impact: 0.1,
        description: `Viewport: ${browserState.viewportWidth}x${browserState.viewportHeight}`
      });

    } catch (error) {
      this.logger.warn('Failed to analyze some context factors:', error);
    }

    return factors;
  }

  private async analyzeElementAvailability(
    targetElement: ElementSelector | undefined,
    page: Page
  ): Promise<ElementAvailability> {
    if (!targetElement) {
      return {
        target: {},
        isVisible: false,
        isInteractable: false,
        confidence: 0,
        alternatives: [],
        stability: 0
      };
    }

    try {
      // Use element discovery service to analyze element
      const pageStructure = await this.elementDiscovery.analyzePageStructure(page);
      const elements = await this.elementDiscovery.discoverInteractiveElements(page, 'general');

      // Find target element in discovered elements
      const targetInfo = elements.indexed.get(0); // Simplified for now

      if (targetInfo) {
        return {
          target: targetElement,
          isVisible: true,
          isInteractable: true,
          confidence: targetInfo.confidence,
          alternatives: targetInfo.alternatives.map(alt => ({ css: alt.selector })),
          stability: await this.calculateElementStability(targetElement, page)
        };
      }

      return {
        target: targetElement,
        isVisible: false,
        isInteractable: false,
        confidence: 0,
        alternatives: [],
        stability: 0
      };

    } catch (error) {
      this.logger.warn('Failed to analyze element availability:', error);
      return {
        target: targetElement,
        isVisible: false,
        isInteractable: false,
        confidence: 0,
        alternatives: [],
        stability: 0
      };
    }
  }

  private async analyzePageState(page: Page): Promise<PageStateAnalysis> {
    try {
      const pageState = await page.evaluate(() => {
        return {
          readyState: document.readyState,
          loadingElements: document.querySelectorAll('.loading, .spinner, [data-loading="true"]').length,
          errorElements: document.querySelectorAll('.error, .alert-danger, [role="alert"]').length,
          interactiveElements: document.querySelectorAll('button, input, select, textarea, a[href]').length,
          images: document.images.length,
          imagesLoaded: Array.from(document.images).filter(img => img.complete).length
        };
      });

      const performanceScore = await this.calculatePerformanceScore(page);
      const accessibilityScore = await this.calculateAccessibilityScore(page);

      return {
        loadState: pageState.readyState as 'loading' | 'interactive' | 'complete',
        dynamicContent: pageState.loadingElements > 0,
        errorPresent: pageState.errorElements > 0,
        performanceScore,
        accessibility: accessibilityScore
      };

    } catch (error) {
      this.logger.warn('Failed to analyze page state:', error);
      return {
        loadState: 'complete',
        dynamicContent: false,
        errorPresent: false,
        performanceScore: 0.5,
        accessibility: 0.5
      };
    }
  }

  private async getHistoricalData(context: ActionContext): Promise<HistoricalData> {
    try {
      const patterns = await this.memorySystem.retrieveRelevantPatterns({
        taskType: 'action_execution',
        currentUrl: context.currentUrl,
        pageState: context.pageState,
        userObjective: context.objective || 'general'
      });

      if (patterns.length === 0) {
        return {
          successRate: 0.7, // Default assumption
          averageExecutionTime: 2000,
          commonFailures: [],
          optimalTiming: 1000,
          contextPatterns: []
        };
      }

      const successRate = patterns.reduce((sum, p) => sum + p.reliability, 0) / patterns.length;
      const avgTime = patterns.reduce((sum, p) => sum + (p.usageCount * 1000), 0) / patterns.length;

      return {
        successRate,
        averageExecutionTime: avgTime,
        commonFailures: [],
        optimalTiming: avgTime * 0.8,
        contextPatterns: patterns.map(p => p.sitePattern)
      };

    } catch (error) {
      this.logger.warn('Failed to get historical data:', error);
      return {
        successRate: 0.7,
        averageExecutionTime: 2000,
        commonFailures: [],
        optimalTiming: 1000,
        contextPatterns: []
      };
    }
  }

  private async assessRisk(context: ActionContext, page: Page): Promise<RiskAssessment> {
    const factors: RiskFactor[] = [];
    let overallRisk: 'low' | 'medium' | 'high' = 'low';

    try {
      // Check for common risk indicators
      const riskIndicators = await page.evaluate(() => {
        return {
          hasModals: document.querySelectorAll('.modal, .popup, .overlay').length > 0,
          hasErrors: document.querySelectorAll('.error, .alert').length > 0,
          hasLoading: document.querySelectorAll('.loading, .spinner').length > 0,
          hasRedirects: window.location.href !== document.referrer,
          hasJavaScriptErrors: (window as any).jsErrors?.length || 0
        };
      });

      if (riskIndicators.hasModals) {
        factors.push({
          type: 'modal_interference',
          severity: 0.6,
          description: 'Modal dialogs present that may interfere with actions',
          mitigation: 'Handle modals before executing main action'
        });
      }

      if (riskIndicators.hasErrors) {
        factors.push({
          type: 'page_errors',
          severity: 0.8,
          description: 'Error messages present on page',
          mitigation: 'Address errors before proceeding'
        });
        overallRisk = 'high';
      }

      if (riskIndicators.hasLoading) {
        factors.push({
          type: 'dynamic_content',
          severity: 0.4,
          description: 'Page has loading content that may affect timing',
          mitigation: 'Wait for content to load before action'
        });
        if (overallRisk === 'low') overallRisk = 'medium';
      }

      // Generate fallback options based on risk
      const fallbackOptions: AutomationStep[] = [];
      if (context.targetElement) {
        fallbackOptions.push({
          id: 'fallback_wait',
          type: 'wait',
          target: context.targetElement,
          description: 'Wait for element to be ready',
          timeout: 10000,
          retryCount: 3
        });
      }

      return {
        overallRisk,
        factors,
        mitigationStrategies: factors.map(f => f.mitigation),
        fallbackOptions
      };

    } catch (error) {
      this.logger.warn('Failed to assess risk:', error);
      return {
        overallRisk: 'medium',
        factors: [],
        mitigationStrategies: [],
        fallbackOptions: []
      };
    }
  }

  private async getAIActionChoice(
    candidateActions: AutomationStep[],
    analysis: ActionAnalysis,
    context: ActionContext
  ): Promise<{ selectedAction: AutomationStep; confidence: number; reasoning: string; alternatives: AlternativeAction[] }> {
    try {
      const prompt = this.createActionSelectionPrompt(candidateActions, analysis, context);
      const response = await this.aiProvider.generateCompletion(prompt);
      const aiDecision = JSON.parse(response);

      const selectedAction = candidateActions.find(a => a.id === aiDecision.selectedActionId) || candidateActions[0];
      
      const alternatives: AlternativeAction[] = aiDecision.alternatives?.map((alt: any) => ({
        action: candidateActions.find(a => a.id === alt.actionId) || candidateActions[0],
        confidence: alt.confidence || 0.5,
        reasoning: alt.reasoning || 'Alternative option',
        riskLevel: alt.riskLevel || 'medium'
      })) || [];

      return {
        selectedAction,
        confidence: aiDecision.confidence || 0.7,
        reasoning: aiDecision.reasoning || 'AI-selected optimal action',
        alternatives
      };

    } catch (error) {
      this.logger.warn('AI action selection failed, using fallback:', error);
      return {
        selectedAction: candidateActions[0],
        confidence: 0.5,
        reasoning: 'Fallback selection due to AI failure',
        alternatives: []
      };
    }
  }

  private async optimizeActionParameters(
    action: AutomationStep,
    analysis: ActionAnalysis
  ): Promise<ActionOptimization[]> {
    const optimizations: ActionOptimization[] = [];

    // Optimize timeout based on page performance
    if (analysis.pageState.performanceScore < 0.5) {
      optimizations.push({
        parameter: 'timeout',
        originalValue: action.timeout,
        optimizedValue: Math.max(action.timeout * 1.5, 15000),
        reasoning: 'Increased timeout due to poor page performance',
        expectedImprovement: 0.2
      });
    }

    // Optimize retry count based on historical success rate
    if (analysis.historicalData.successRate < 0.7) {
      optimizations.push({
        parameter: 'retryCount',
        originalValue: action.retryCount || 3,
        optimizedValue: Math.min((action.retryCount || 3) + 2, 5),
        reasoning: 'Increased retries due to low historical success rate',
        expectedImprovement: 0.15
      });
    }

    // Optimize element selector based on availability
    if (analysis.elementAvailability.confidence < 0.8 && analysis.elementAvailability.alternatives.length > 0) {
      optimizations.push({
        parameter: 'target',
        originalValue: action.target,
        optimizedValue: analysis.elementAvailability.alternatives[0],
        reasoning: 'Using more reliable element selector',
        expectedImprovement: 0.3
      });
    }

    return optimizations;
  }

  private async calculateOptimalTiming(
    action: AutomationStep,
    analysis: ActionAnalysis
  ): Promise<TimingStrategy> {
    let delay = 0;
    let timeout = action.timeout;

    // Add delay for dynamic content
    if (analysis.pageState.dynamicContent) {
      delay += 1000;
    }

    // Add delay based on page load performance
    if (analysis.contextFactors.find(f => f.type === 'page_load_time')?.value > 3000) {
      delay += 500;
    }

    // Adjust timeout based on network conditions
    const networkFactor = analysis.contextFactors.find(f => f.type === 'network_condition');
    if (networkFactor && networkFactor.value < 1) { // Slow network
      timeout = Math.max(timeout * 1.5, 15000);
    }

    return {
      delay,
      timeout,
      retryInterval: Math.max(delay * 0.5, 500),
      maxWaitTime: timeout * 2
    };
  }

  private async predictActionSuccess(
    action: AutomationStep,
    analysis: ActionAnalysis
  ): Promise<ActionPrediction> {
    let probability = 0.7; // Base probability
    const factors: string[] = [];

    // Adjust based on element availability
    if (analysis.elementAvailability.isVisible && analysis.elementAvailability.isInteractable) {
      probability += 0.2;
      factors.push('Element is visible and interactable');
    } else {
      probability -= 0.3;
      factors.push('Element availability issues detected');
    }

    // Adjust based on page state
    if (analysis.pageState.errorPresent) {
      probability -= 0.2;
      factors.push('Page errors may interfere with action');
    }

    if (analysis.pageState.dynamicContent) {
      probability -= 0.1;
      factors.push('Dynamic content may affect timing');
    }

    // Adjust based on historical data
    probability = (probability + analysis.historicalData.successRate) / 2;
    factors.push(`Historical success rate: ${(analysis.historicalData.successRate * 100).toFixed(1)}%`);

    // Adjust based on risk assessment
    switch (analysis.riskAssessment.overallRisk) {
      case 'high':
        probability -= 0.2;
        factors.push('High risk factors detected');
        break;
      case 'medium':
        probability -= 0.1;
        factors.push('Medium risk factors present');
        break;
      case 'low':
        probability += 0.05;
        factors.push('Low risk environment');
        break;
    }

    // Ensure probability is within bounds
    probability = Math.max(0.1, Math.min(0.95, probability));

    return {
      probability,
      factors,
      confidence: probability > 0.7 ? 'high' : probability > 0.5 ? 'medium' : 'low',
      recommendedActions: probability < 0.5 ? ['Consider alternative approach', 'Add additional validation'] : []
    };
  }

  private async storeActionDecision(choice: SmartActionChoice, context: ActionContext): Promise<void> {
    try {
      const pattern = {
        id: `action_decision_${Date.now()}`,
        sitePattern: new URL(context.currentUrl).hostname,
        taskType: 'smart_action_selection',
        successfulActions: [{
          action: choice.selectedAction,
          confidence: choice.confidence,
          reasoning: choice.reasoning
        }],
        contextConditions: [{
          type: 'page_state',
          value: JSON.stringify(context.pageState)
        }],
        reliability: choice.confidence,
        lastUsed: new Date(),
        usageCount: 1,
        createdAt: new Date(),
        tags: ['smart_selection', choice.selectedAction.type]
      };

      await this.memorySystem.storeSuccessfulPattern(pattern);
    } catch (error) {
      this.logger.warn('Failed to store action decision:', error);
    }
  }

  // Helper methods
  private calculateLoadTimeImpact(loadTime: number): number {
    if (loadTime < 1000) return 0.1;
    if (loadTime < 3000) return 0.3;
    if (loadTime < 5000) return 0.5;
    return 0.8;
  }

  private calculateNetworkImpact(effectiveType: string): number {
    switch (effectiveType) {
      case '4g': return 0.1;
      case '3g': return 0.3;
      case '2g': return 0.6;
      case 'slow-2g': return 0.8;
      default: return 0.2;
    }
  }

  private async calculateElementStability(selector: ElementSelector, page: Page): Promise<number> {
    try {
      // Check element stability over time
      const checks = 3;
      const interval = 500;
      let stableCount = 0;

      for (let i = 0; i < checks; i++) {
        const element = await page.$(selector.css || '');
        if (element) {
          const isVisible = await element.isIntersectingViewport();
          if (isVisible) stableCount++;
        }
        if (i < checks - 1) await page.waitForTimeout(interval);
      }

      return stableCount / checks;
    } catch {
      return 0.5; // Default stability
    }
  }

  private async calculatePerformanceScore(page: Page): Promise<number> {
    try {
      const metrics = await page.evaluate(() => {
        const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
        const paint = performance.getEntriesByType('paint');
        
        return {
          loadTime: navigation.loadEventEnd - navigation.loadEventStart,
          domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
          firstPaint: paint.find(p => p.name === 'first-paint')?.startTime || 0,
          firstContentfulPaint: paint.find(p => p.name === 'first-contentful-paint')?.startTime || 0
        };
      });

      // Simple scoring based on load times
      let score = 1.0;
      if (metrics.loadTime > 3000) score -= 0.3;
      if (metrics.domContentLoaded > 2000) score -= 0.2;
      if (metrics.firstContentfulPaint > 2500) score -= 0.2;

      return Math.max(0, score);
    } catch {
      return 0.5;
    }
  }

  private async calculateAccessibilityScore(page: Page): Promise<number> {
    try {
      const accessibilityInfo = await page.evaluate(() => {
        const elements = document.querySelectorAll('*');
        let totalElements = 0;
        let accessibleElements = 0;

        elements.forEach(el => {
          if (el.tagName === 'IMG' || el.tagName === 'INPUT' || el.tagName === 'BUTTON' || el.tagName === 'A') {
            totalElements++;
            if (el.getAttribute('alt') || el.getAttribute('aria-label') || el.getAttribute('title')) {
              accessibleElements++;
            }
          }
        });

        return totalElements > 0 ? accessibleElements / totalElements : 1;
      });

      return accessibilityInfo;
    } catch {
      return 0.5;
    }
  }

  private createActionSelectionPrompt(
    candidateActions: AutomationStep[],
    analysis: ActionAnalysis,
    context: ActionContext
  ): string {
    return `
Select the optimal action from the following candidates based on the current context analysis.

Candidate Actions:
${candidateActions.map((action, index) => `
${index + 1}. ID: ${action.id}
   Type: ${action.type}
   Description: ${action.description}
   Target: ${JSON.stringify(action.target)}
   Timeout: ${action.timeout}ms
`).join('')}

Context Analysis:
- Page State: ${analysis.pageState.loadState}, Dynamic Content: ${analysis.pageState.dynamicContent}
- Element Availability: Visible: ${analysis.elementAvailability.isVisible}, Interactable: ${analysis.elementAvailability.isInteractable}
- Historical Success Rate: ${(analysis.historicalData.successRate * 100).toFixed(1)}%
- Risk Level: ${analysis.riskAssessment.overallRisk}
- Performance Score: ${(analysis.pageState.performanceScore * 100).toFixed(1)}%

Context Factors:
${analysis.contextFactors.map(f => `- ${f.type}: ${f.value} (impact: ${f.impact})`).join('\n')}

Risk Factors:
${analysis.riskAssessment.factors.map(f => `- ${f.type}: ${f.description}`).join('\n')}

Please respond in JSON format:
{
  "selectedActionId": "action_id",
  "confidence": 0.8,
  "reasoning": "Detailed explanation of why this action was selected",
  "alternatives": [
    {
      "actionId": "alternative_action_id",
      "confidence": 0.6,
      "reasoning": "Why this is a good alternative",
      "riskLevel": "low|medium|high"
    }
  ]
}

Consider:
1. Element availability and stability
2. Page state and loading conditions
3. Historical performance data
4. Risk factors and mitigation strategies
5. Timing and sequencing requirements
`;
  }
}