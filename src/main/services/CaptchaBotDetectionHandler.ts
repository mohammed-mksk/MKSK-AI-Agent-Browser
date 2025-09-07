/**
 * Advanced CAPTCHA and Bot Detection Handler
 * 
 * Purpose: Implements intelligent CAPTCHA detection and classification,
 * bot detection avoidance strategies, intelligent delay and behavior randomization,
 * and fallback strategies for blocked sites.
 */

import {
  CaptchaType,
  CaptchaHandlingResult,
  CaptchaHandlingMethod
} from '../interfaces/IErrorRecovery.js';
import { AIProviderManager } from './AIProviderManager.js';
import { Page, Browser } from 'puppeteer';

export interface ICaptchaBotDetectionHandler {
  /**
   * Detect and classify CAPTCHA types on the current page
   * @param page - The browser page to analyze
   * @returns Promise resolving to detected CAPTCHA information
   */
  detectCaptcha(page: Page): Promise<CaptchaDetectionResult>;

  /**
   * Handle detected CAPTCHA using appropriate strategy
   * @param captchaInfo - Information about the detected CAPTCHA
   * @param page - The browser page containing the CAPTCHA
   * @returns Promise resolving to CAPTCHA handling result
   */
  handleCaptcha(captchaInfo: CaptchaDetectionResult, page: Page): Promise<CaptchaHandlingResult>;

  /**
   * Detect bot detection mechanisms on the page
   * @param page - The browser page to analyze
   * @returns Promise resolving to bot detection analysis
   */
  detectBotDetection(page: Page): Promise<BotDetectionResult>;

  /**
   * Apply bot detection avoidance strategies
   * @param page - The browser page to apply strategies to
   * @param strategies - Array of avoidance strategies to apply
   * @returns Promise resolving to avoidance result
   */
  applyAvoidanceStrategies(page: Page, strategies: AvoidanceStrategy[]): Promise<AvoidanceResult>;

  /**
   * Generate intelligent delays and behavior randomization
   * @param page - The browser page for context
   * @param actionType - Type of action being performed
   * @returns Promise resolving to randomization parameters
   */
  generateRandomizedBehavior(page: Page, actionType: string): Promise<RandomizedBehavior>;

  /**
   * Implement fallback strategies for blocked sites
   * @param blockInfo - Information about the blocking
   * @param page - The browser page that was blocked
   * @returns Promise resolving to fallback strategy result
   */
  handleSiteBlocking(blockInfo: SiteBlockingInfo, page: Page): Promise<FallbackStrategyResult>;
}

export interface CaptchaDetectionResult {
  detected: boolean;
  type: CaptchaType;
  confidence: number;
  location: CaptchaLocation;
  characteristics: CaptchaCharacteristics;
  solvingStrategy: CaptchaSolvingStrategy;
}

export interface CaptchaLocation {
  selector: string;
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  isVisible: boolean;
  isInteractable: boolean;
}

export interface CaptchaCharacteristics {
  provider: 'recaptcha' | 'hcaptcha' | 'cloudflare' | 'custom' | 'unknown';
  version: string;
  difficulty: 'easy' | 'medium' | 'hard' | 'unknown';
  requiresInteraction: boolean;
  hasAudio: boolean;
  hasImage: boolean;
  estimatedSolveTime: number;
}

export interface CaptchaSolvingStrategy {
  method: CaptchaHandlingMethod;
  confidence: number;
  estimatedSuccessRate: number;
  fallbackMethods: CaptchaHandlingMethod[];
  requirements: string[];
}

export interface BotDetectionResult {
  detected: boolean;
  detectionMethods: DetectionMethod[];
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  blockedFeatures: string[];
  recommendedActions: string[];
}

export interface DetectionMethod {
  type: 'fingerprinting' | 'behavioral' | 'timing' | 'headers' | 'javascript' | 'network';
  description: string;
  confidence: number;
  countermeasures: string[];
}

export interface AvoidanceStrategy {
  name: string;
  type: 'timing' | 'behavior' | 'fingerprint' | 'headers' | 'network';
  description: string;
  parameters: Record<string, any>;
  effectiveness: number;
  applicableScenarios: string[];
}

export interface AvoidanceResult {
  success: boolean;
  appliedStrategies: AppliedStrategy[];
  remainingRisks: string[];
  recommendations: string[];
  effectivenessScore: number;
}

export interface AppliedStrategy {
  strategy: AvoidanceStrategy;
  success: boolean;
  duration: number;
  impact: string;
  error?: string;
}

export interface RandomizedBehavior {
  mouseMovements: MouseMovement[];
  typingPattern: TypingPattern;
  scrollBehavior: ScrollBehavior;
  delays: DelayPattern;
  humanLikeActions: HumanAction[];
}

export interface MouseMovement {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  duration: number;
  curve: 'linear' | 'bezier' | 'natural';
  pauses: number[];
}

export interface TypingPattern {
  baseSpeed: number; // characters per minute
  variation: number; // speed variation percentage
  mistakes: number; // intentional mistakes per 100 characters
  corrections: boolean;
  pauses: number[]; // pause durations in ms
}

export interface ScrollBehavior {
  speed: number;
  acceleration: number;
  naturalPauses: boolean;
  direction: 'up' | 'down' | 'mixed';
  distance: number;
}

export interface DelayPattern {
  beforeAction: number;
  afterAction: number;
  betweenActions: number;
  randomVariation: number;
  contextualAdjustment: number;
}

export interface HumanAction {
  type: 'mouse_wiggle' | 'random_scroll' | 'tab_switch' | 'window_resize' | 'idle_pause';
  probability: number;
  parameters: Record<string, any>;
}

export interface SiteBlockingInfo {
  blockingType: 'captcha' | 'ip_block' | 'rate_limit' | 'geo_block' | 'user_agent_block' | 'unknown';
  severity: 'temporary' | 'permanent' | 'unknown';
  message: string;
  detectedAt: Date;
  url: string;
  userAgent: string;
  ipAddress?: string;
}

export interface FallbackStrategyResult {
  success: boolean;
  strategy: FallbackStrategy;
  newUrl?: string;
  modifications: string[];
  estimatedBypassTime: number;
  confidence: number;
}

export interface FallbackStrategy {
  name: string;
  type: 'proxy' | 'user_agent' | 'delay' | 'alternative_site' | 'manual_intervention';
  description: string;
  parameters: Record<string, any>;
  successRate: number;
}

export class CaptchaBotDetectionHandler implements ICaptchaBotDetectionHandler {
  private aiProvider: AIProviderManager;
  private detectionHistory: Map<string, CaptchaDetectionResult[]> = new Map();
  private avoidanceStrategies: AvoidanceStrategy[] = [];
  private behaviorProfiles: Map<string, RandomizedBehavior> = new Map();

  constructor(aiProvider: AIProviderManager) {
    this.aiProvider = aiProvider;
    this.initializeAvoidanceStrategies();
  }

  async detectCaptcha(page: Page): Promise<CaptchaDetectionResult> {
    try {
      console.log('Detecting CAPTCHA on current page');

      // Check for common CAPTCHA indicators
      const captchaElements = await this.findCaptchaElements(page);
      
      if (captchaElements.length === 0) {
        return {
          detected: false,
          type: CaptchaType.UNKNOWN,
          confidence: 0,
          location: { selector: '', boundingBox: { x: 0, y: 0, width: 0, height: 0 }, isVisible: false, isInteractable: false },
          characteristics: {
            provider: 'unknown',
            version: '',
            difficulty: 'unknown',
            requiresInteraction: false,
            hasAudio: false,
            hasImage: false,
            estimatedSolveTime: 0
          },
          solvingStrategy: {
            method: CaptchaHandlingMethod.SKIP,
            confidence: 0,
            estimatedSuccessRate: 0,
            fallbackMethods: [],
            requirements: []
          }
        };
      }

      // Analyze the most prominent CAPTCHA element
      const primaryCaptcha = captchaElements[0];
      const captchaType = await this.classifyCaptchaType(page, primaryCaptcha);
      const characteristics = await this.analyzeCaptchaCharacteristics(page, primaryCaptcha);
      const location = await this.getCaptchaLocation(page, primaryCaptcha);
      const solvingStrategy = await this.determineSolvingStrategy(captchaType, characteristics);

      const result: CaptchaDetectionResult = {
        detected: true,
        type: captchaType,
        confidence: 0.9,
        location,
        characteristics,
        solvingStrategy
      };

      // Store detection history
      this.storeDetectionHistory(page.url(), result);

      return result;
    } catch (error) {
      console.error('CAPTCHA detection failed:', error);
      
      return {
        detected: false,
        type: CaptchaType.UNKNOWN,
        confidence: 0,
        location: { selector: '', boundingBox: { x: 0, y: 0, width: 0, height: 0 }, isVisible: false, isInteractable: false },
        characteristics: {
          provider: 'unknown',
          version: '',
          difficulty: 'unknown',
          requiresInteraction: false,
          hasAudio: false,
          hasImage: false,
          estimatedSolveTime: 0
        },
        solvingStrategy: {
          method: CaptchaHandlingMethod.SKIP,
          confidence: 0,
          estimatedSuccessRate: 0,
          fallbackMethods: [],
          requirements: []
        }
      };
    }
  }

  async handleCaptcha(captchaInfo: CaptchaDetectionResult, page: Page): Promise<CaptchaHandlingResult> {
    const startTime = Date.now();
    
    try {
      console.log(`Handling ${captchaInfo.type} CAPTCHA using ${captchaInfo.solvingStrategy.method} method`);

      switch (captchaInfo.solvingStrategy.method) {
        case CaptchaHandlingMethod.BYPASS:
          return await this.bypassCaptcha(captchaInfo, page);
        case CaptchaHandlingMethod.SOLVE_AUTOMATICALLY:
          return await this.solveCaptchaAutomatically(captchaInfo, page);
        case CaptchaHandlingMethod.REQUEST_USER_INPUT:
          return await this.requestUserInput(captchaInfo, page);
        case CaptchaHandlingMethod.USE_SERVICE:
          return await this.useCaptchaSolvingService(captchaInfo, page);
        case CaptchaHandlingMethod.SKIP:
        default:
          return {
            success: false,
            method: CaptchaHandlingMethod.SKIP,
            duration: Date.now() - startTime,
            confidence: 0,
            error: 'CAPTCHA handling not implemented or skipped'
          };
      }
    } catch (error) {
      console.error('CAPTCHA handling failed:', error);
      
      return {
        success: false,
        method: captchaInfo.solvingStrategy.method,
        duration: Date.now() - startTime,
        confidence: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async detectBotDetection(page: Page): Promise<BotDetectionResult> {
    try {
      console.log('Analyzing page for bot detection mechanisms');

      const detectionMethods: DetectionMethod[] = [];
      
      // Check for JavaScript-based detection
      const jsDetection = await this.checkJavaScriptDetection(page);
      if (jsDetection) detectionMethods.push(jsDetection);
      
      // Check for timing-based detection
      const timingDetection = await this.checkTimingDetection(page);
      if (timingDetection) detectionMethods.push(timingDetection);
      
      // Check for behavioral detection
      const behavioralDetection = await this.checkBehavioralDetection(page);
      if (behavioralDetection) detectionMethods.push(behavioralDetection);
      
      // Check for fingerprinting
      const fingerprintDetection = await this.checkFingerprinting(page);
      if (fingerprintDetection) detectionMethods.push(fingerprintDetection);

      const riskLevel = this.calculateRiskLevel(detectionMethods);
      const blockedFeatures = this.identifyBlockedFeatures(detectionMethods);
      const recommendedActions = this.generateRecommendations(detectionMethods);

      return {
        detected: detectionMethods.length > 0,
        detectionMethods,
        riskLevel,
        blockedFeatures,
        recommendedActions
      };
    } catch (error) {
      console.error('Bot detection analysis failed:', error);
      
      return {
        detected: false,
        detectionMethods: [],
        riskLevel: 'low',
        blockedFeatures: [],
        recommendedActions: ['Manual review recommended due to analysis failure']
      };
    }
  }

  async applyAvoidanceStrategies(page: Page, strategies: AvoidanceStrategy[]): Promise<AvoidanceResult> {
    const appliedStrategies: AppliedStrategy[] = [];
    const remainingRisks: string[] = [];
    const recommendations: string[] = [];
    
    try {
      console.log(`Applying ${strategies.length} bot detection avoidance strategies`);

      for (const strategy of strategies) {
        const startTime = Date.now();
        
        try {
          const success = await this.applyIndividualStrategy(page, strategy);
          
          appliedStrategies.push({
            strategy,
            success,
            duration: Date.now() - startTime,
            impact: success ? 'Positive' : 'None'
          });
        } catch (error) {
          appliedStrategies.push({
            strategy,
            success: false,
            duration: Date.now() - startTime,
            impact: 'None',
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      const successfulStrategies = appliedStrategies.filter(s => s.success);
      const effectivenessScore = successfulStrategies.length / strategies.length;

      // Identify remaining risks
      if (effectivenessScore < 1.0) {
        remainingRisks.push('Some avoidance strategies failed to apply');
      }
      
      if (effectivenessScore < 0.5) {
        remainingRisks.push('High risk of detection remains');
        recommendations.push('Consider using alternative approaches');
      }

      return {
        success: effectivenessScore > 0.5,
        appliedStrategies,
        remainingRisks,
        recommendations,
        effectivenessScore
      };
    } catch (error) {
      console.error('Avoidance strategy application failed:', error);
      
      return {
        success: false,
        appliedStrategies,
        remainingRisks: ['Strategy application failed'],
        recommendations: ['Manual intervention required'],
        effectivenessScore: 0
      };
    }
  }
  
  async generateRandomizedBehavior(page: Page, actionType: string): Promise<RandomizedBehavior> {
    try {
      console.log(`Generating randomized behavior for action: ${actionType}`);

      // Check if we have a cached behavior profile for this page
      const pageKey = new URL(page.url()).hostname;
      const cachedBehavior = this.behaviorProfiles.get(pageKey);
      
      if (cachedBehavior) {
        return this.adjustBehaviorForAction(cachedBehavior, actionType);
      }

      // Generate new randomized behavior
      const mouseMovements = this.generateMouseMovements(actionType);
      const typingPattern = this.generateTypingPattern();
      const scrollBehavior = this.generateScrollBehavior();
      const delays = this.generateDelayPattern(actionType);
      const humanLikeActions = this.generateHumanActions();

      const behavior: RandomizedBehavior = {
        mouseMovements,
        typingPattern,
        scrollBehavior,
        delays,
        humanLikeActions
      };

      // Cache the behavior profile
      this.behaviorProfiles.set(pageKey, behavior);

      return behavior;
    } catch (error) {
      console.error('Randomized behavior generation failed:', error);
      
      // Return default behavior
      return this.getDefaultBehavior();
    }
  }

  async handleSiteBlocking(blockInfo: SiteBlockingInfo, page: Page): Promise<FallbackStrategyResult> {
    try {
      console.log(`Handling site blocking: ${blockInfo.blockingType}`);

      // Determine appropriate fallback strategy
      const strategy = await this.selectFallbackStrategy(blockInfo);
      
      // Apply the fallback strategy
      const result = await this.applyFallbackStrategy(strategy, blockInfo, page);
      
      return result;
    } catch (error) {
      console.error('Site blocking handling failed:', error);
      
      return {
        success: false,
        strategy: {
          name: 'No Strategy',
          type: 'manual_intervention',
          description: 'Manual intervention required',
          parameters: {},
          successRate: 0
        },
        modifications: [],
        estimatedBypassTime: 0,
        confidence: 0
      };
    }
  }

  // Private helper methods

  private async findCaptchaElements(page: Page): Promise<any[]> {
    return await page.evaluate(() => {
      const captchaSelectors = [
        'iframe[src*="recaptcha"]',
        'iframe[src*="hcaptcha"]',
        '.g-recaptcha',
        '.h-captcha',
        '[data-sitekey]',
        '.captcha',
        '#captcha',
        '.cf-turnstile'
      ];

      const elements = [];
      for (const selector of captchaSelectors) {
        const found = document.querySelectorAll(selector);
        elements.push(...Array.from(found));
      }

      return elements.map(el => ({
        tagName: el.tagName,
        className: el.className,
        id: el.id,
        src: (el as any).src || '',
        visible: el.offsetWidth > 0 && el.offsetHeight > 0
      }));
    });
  }

  private async classifyCaptchaType(page: Page, element: any): Promise<CaptchaType> {
    if (element.src && element.src.includes('recaptcha')) {
      return CaptchaType.RECAPTCHA_V2;
    }
    if (element.src && element.src.includes('hcaptcha')) {
      return CaptchaType.HCAPTCHA;
    }
    if (element.className && element.className.includes('g-recaptcha')) {
      return CaptchaType.RECAPTCHA_V2;
    }
    if (element.className && element.className.includes('h-captcha')) {
      return CaptchaType.HCAPTCHA;
    }
    
    return CaptchaType.UNKNOWN;
  }

  private async analyzeCaptchaCharacteristics(page: Page, element: any): Promise<CaptchaCharacteristics> {
    // Analyze CAPTCHA characteristics based on element properties
    return {
      provider: this.determineProvider(element),
      version: this.determineVersion(element),
      difficulty: 'medium',
      requiresInteraction: true,
      hasAudio: false,
      hasImage: true,
      estimatedSolveTime: 30000 // 30 seconds
    };
  }

  private async getCaptchaLocation(page: Page, element: any): Promise<CaptchaLocation> {
    // Get element location and properties
    return {
      selector: this.generateSelector(element),
      boundingBox: { x: 0, y: 0, width: 300, height: 200 },
      isVisible: element.visible,
      isInteractable: true
    };
  }

  private async determineSolvingStrategy(type: CaptchaType, characteristics: CaptchaCharacteristics): Promise<CaptchaSolvingStrategy> {
    // Determine the best solving strategy based on CAPTCHA type and characteristics
    switch (type) {
      case CaptchaType.RECAPTCHA_V2:
        return {
          method: CaptchaHandlingMethod.BYPASS,
          confidence: 0.3,
          estimatedSuccessRate: 0.2,
          fallbackMethods: [CaptchaHandlingMethod.SKIP],
          requirements: ['Advanced bypass techniques']
        };
      case CaptchaType.HCAPTCHA:
        return {
          method: CaptchaHandlingMethod.SKIP,
          confidence: 0.1,
          estimatedSuccessRate: 0.1,
          fallbackMethods: [],
          requirements: ['Manual intervention']
        };
      default:
        return {
          method: CaptchaHandlingMethod.SKIP,
          confidence: 0,
          estimatedSuccessRate: 0,
          fallbackMethods: [],
          requirements: []
        };
    }
  }

  private async bypassCaptcha(captchaInfo: CaptchaDetectionResult, page: Page): Promise<CaptchaHandlingResult> {
    // Attempt to bypass CAPTCHA (placeholder implementation)
    return {
      success: false,
      method: CaptchaHandlingMethod.BYPASS,
      duration: 5000,
      confidence: 0.1,
      error: 'CAPTCHA bypass not implemented'
    };
  }

  private async solveCaptchaAutomatically(captchaInfo: CaptchaDetectionResult, page: Page): Promise<CaptchaHandlingResult> {
    // Attempt to solve CAPTCHA automatically (placeholder implementation)
    return {
      success: false,
      method: CaptchaHandlingMethod.SOLVE_AUTOMATICALLY,
      duration: 10000,
      confidence: 0.1,
      error: 'Automatic CAPTCHA solving not implemented'
    };
  }

  private async requestUserInput(captchaInfo: CaptchaDetectionResult, page: Page): Promise<CaptchaHandlingResult> {
    // Request user to solve CAPTCHA manually (placeholder implementation)
    return {
      success: false,
      method: CaptchaHandlingMethod.REQUEST_USER_INPUT,
      duration: 30000,
      confidence: 0.8,
      error: 'User input handling not implemented'
    };
  }

  private async useCaptchaSolvingService(captchaInfo: CaptchaDetectionResult, page: Page): Promise<CaptchaHandlingResult> {
    // Use external CAPTCHA solving service (placeholder implementation)
    return {
      success: false,
      method: CaptchaHandlingMethod.USE_SERVICE,
      duration: 15000,
      confidence: 0.7,
      error: 'CAPTCHA solving service not configured'
    };
  }

  private async checkJavaScriptDetection(page: Page): Promise<DetectionMethod | null> {
    try {
      const hasDetection = await page.evaluate(() => {
        // Check for common bot detection JavaScript patterns
        return !!(window as any).webdriver || 
               !!(window as any).phantom || 
               !!(window as any).callPhantom ||
               navigator.webdriver === true;
      });

      if (hasDetection) {
        return {
          type: 'javascript',
          description: 'JavaScript-based bot detection detected',
          confidence: 0.8,
          countermeasures: ['Modify webdriver properties', 'Use stealth mode']
        };
      }
    } catch (error) {
      console.warn('JavaScript detection check failed:', error);
    }
    
    return null;
  }

  private async checkTimingDetection(page: Page): Promise<DetectionMethod | null> {
    // Check for timing-based detection patterns
    return {
      type: 'timing',
      description: 'Timing analysis may be in use',
      confidence: 0.5,
      countermeasures: ['Add random delays', 'Vary action timing']
    };
  }

  private async checkBehavioralDetection(page: Page): Promise<DetectionMethod | null> {
    // Check for behavioral detection patterns
    return {
      type: 'behavioral',
      description: 'Behavioral analysis may be monitoring actions',
      confidence: 0.6,
      countermeasures: ['Add human-like mouse movements', 'Randomize interaction patterns']
    };
  }

  private async checkFingerprinting(page: Page): Promise<DetectionMethod | null> {
    try {
      const fingerprintRisk = await page.evaluate(() => {
        // Check for fingerprinting techniques
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        return !!(ctx && typeof ctx.getImageData === 'function');
      });

      if (fingerprintRisk) {
        return {
          type: 'fingerprinting',
          description: 'Browser fingerprinting techniques detected',
          confidence: 0.7,
          countermeasures: ['Modify browser fingerprint', 'Use fingerprint spoofing']
        };
      }
    } catch (error) {
      console.warn('Fingerprinting check failed:', error);
    }
    
    return null;
  }

  private calculateRiskLevel(methods: DetectionMethod[]): 'low' | 'medium' | 'high' | 'critical' {
    if (methods.length === 0) return 'low';
    
    const avgConfidence = methods.reduce((sum, m) => sum + m.confidence, 0) / methods.length;
    
    if (avgConfidence > 0.8) return 'critical';
    if (avgConfidence > 0.6) return 'high';
    if (avgConfidence > 0.4) return 'medium';
    return 'low';
  }

  private identifyBlockedFeatures(methods: DetectionMethod[]): string[] {
    const blockedFeatures: string[] = [];
    
    for (const method of methods) {
      switch (method.type) {
        case 'javascript':
          blockedFeatures.push('Automated interactions');
          break;
        case 'timing':
          blockedFeatures.push('Fast execution');
          break;
        case 'behavioral':
          blockedFeatures.push('Non-human patterns');
          break;
        case 'fingerprinting':
          blockedFeatures.push('Browser automation');
          break;
      }
    }
    
    return [...new Set(blockedFeatures)];
  }

  private generateRecommendations(methods: DetectionMethod[]): string[] {
    const recommendations: string[] = [];
    
    for (const method of methods) {
      recommendations.push(...method.countermeasures);
    }
    
    return [...new Set(recommendations)];
  }

  private async applyIndividualStrategy(page: Page, strategy: AvoidanceStrategy): Promise<boolean> {
    try {
      switch (strategy.type) {
        case 'timing':
          return await this.applyTimingStrategy(page, strategy);
        case 'behavior':
          return await this.applyBehaviorStrategy(page, strategy);
        case 'fingerprint':
          return await this.applyFingerprintStrategy(page, strategy);
        case 'headers':
          return await this.applyHeaderStrategy(page, strategy);
        default:
          return false;
      }
    } catch (error) {
      console.error(`Failed to apply strategy ${strategy.name}:`, error);
      return false;
    }
  }

  private async applyTimingStrategy(page: Page, strategy: AvoidanceStrategy): Promise<boolean> {
    // Apply timing-based avoidance
    const delay = strategy.parameters.delay || 1000;
    await new Promise(resolve => setTimeout(resolve, delay));
    return true;
  }

  private async applyBehaviorStrategy(page: Page, strategy: AvoidanceStrategy): Promise<boolean> {
    // Apply behavioral avoidance
    const behavior = await this.generateRandomizedBehavior(page, 'general');
    // Apply some of the behavior patterns
    return true;
  }

  private async applyFingerprintStrategy(page: Page, strategy: AvoidanceStrategy): Promise<boolean> {
    // Apply fingerprint modification
    await page.evaluateOnNewDocument(() => {
      // Modify webdriver property
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
      });
    });
    return true;
  }

  private async applyHeaderStrategy(page: Page, strategy: AvoidanceStrategy): Promise<boolean> {
    // Apply header modification
    const headers = strategy.parameters.headers || {};
    await page.setExtraHTTPHeaders(headers);
    return true;
  }

  private generateMouseMovements(actionType: string): MouseMovement[] {
    // Generate realistic mouse movements
    return [
      {
        fromX: Math.random() * 100,
        fromY: Math.random() * 100,
        toX: Math.random() * 100 + 200,
        toY: Math.random() * 100 + 200,
        duration: 500 + Math.random() * 1000,
        curve: 'bezier',
        pauses: [Math.random() * 100, Math.random() * 200]
      }
    ];
  }

  private generateTypingPattern(): TypingPattern {
    return {
      baseSpeed: 180 + Math.random() * 120, // 180-300 CPM
      variation: 0.2 + Math.random() * 0.3, // 20-50% variation
      mistakes: Math.random() * 2, // 0-2 mistakes per 100 chars
      corrections: Math.random() > 0.5,
      pauses: [100, 200, 500].map(p => p + Math.random() * p)
    };
  }

  private generateScrollBehavior(): ScrollBehavior {
    return {
      speed: 100 + Math.random() * 200,
      acceleration: 0.8 + Math.random() * 0.4,
      naturalPauses: true,
      direction: Math.random() > 0.5 ? 'down' : 'up',
      distance: 100 + Math.random() * 500
    };
  }

  private generateDelayPattern(actionType: string): DelayPattern {
    const baseDelay = actionType === 'click' ? 500 : 200;
    
    return {
      beforeAction: baseDelay + Math.random() * baseDelay,
      afterAction: baseDelay * 0.5 + Math.random() * baseDelay,
      betweenActions: baseDelay * 2 + Math.random() * baseDelay,
      randomVariation: 0.3,
      contextualAdjustment: Math.random() * 200
    };
  }

  private generateHumanActions(): HumanAction[] {
    return [
      {
        type: 'mouse_wiggle',
        probability: 0.1,
        parameters: { distance: 5, duration: 200 }
      },
      {
        type: 'random_scroll',
        probability: 0.05,
        parameters: { distance: 100, duration: 500 }
      },
      {
        type: 'idle_pause',
        probability: 0.2,
        parameters: { duration: 1000 + Math.random() * 2000 }
      }
    ];
  }

  private adjustBehaviorForAction(behavior: RandomizedBehavior, actionType: string): RandomizedBehavior {
    // Adjust cached behavior for specific action type
    const adjusted = { ...behavior };
    
    if (actionType === 'click') {
      adjusted.delays.beforeAction *= 1.2;
    } else if (actionType === 'type') {
      adjusted.typingPattern.baseSpeed *= 0.9; // Slightly slower for important forms
    }
    
    return adjusted;
  }

  private getDefaultBehavior(): RandomizedBehavior {
    return {
      mouseMovements: [],
      typingPattern: {
        baseSpeed: 200,
        variation: 0.3,
        mistakes: 1,
        corrections: true,
        pauses: [100, 200, 300]
      },
      scrollBehavior: {
        speed: 150,
        acceleration: 1.0,
        naturalPauses: true,
        direction: 'down',
        distance: 200
      },
      delays: {
        beforeAction: 500,
        afterAction: 300,
        betweenActions: 1000,
        randomVariation: 0.3,
        contextualAdjustment: 100
      },
      humanLikeActions: []
    };
  }

  private async selectFallbackStrategy(blockInfo: SiteBlockingInfo): Promise<FallbackStrategy> {
    switch (blockInfo.blockingType) {
      case 'rate_limit':
        return {
          name: 'Rate Limit Bypass',
          type: 'delay',
          description: 'Wait and retry with longer delays',
          parameters: { delay: 60000 },
          successRate: 0.8
        };
      case 'ip_block':
        return {
          name: 'IP Block Bypass',
          type: 'proxy',
          description: 'Use proxy or VPN to change IP',
          parameters: { proxyType: 'residential' },
          successRate: 0.6
        };
      case 'user_agent_block':
        return {
          name: 'User Agent Change',
          type: 'user_agent',
          description: 'Change user agent to avoid detection',
          parameters: { userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
          successRate: 0.7
        };
      default:
        return {
          name: 'Manual Intervention',
          type: 'manual_intervention',
          description: 'Requires manual intervention',
          parameters: {},
          successRate: 0.9
        };
    }
  }

  private async applyFallbackStrategy(strategy: FallbackStrategy, blockInfo: SiteBlockingInfo, page: Page): Promise<FallbackStrategyResult> {
    const startTime = Date.now();
    
    try {
      switch (strategy.type) {
        case 'delay':
          await new Promise(resolve => setTimeout(resolve, strategy.parameters.delay));
          return {
            success: true,
            strategy,
            modifications: ['Added delay'],
            estimatedBypassTime: strategy.parameters.delay,
            confidence: strategy.successRate
          };
        case 'user_agent':
          await page.setUserAgent(strategy.parameters.userAgent);
          return {
            success: true,
            strategy,
            modifications: ['Changed user agent'],
            estimatedBypassTime: Date.now() - startTime,
            confidence: strategy.successRate
          };
        default:
          return {
            success: false,
            strategy,
            modifications: [],
            estimatedBypassTime: 0,
            confidence: 0
          };
      }
    } catch (error) {
      return {
        success: false,
        strategy,
        modifications: [],
        estimatedBypassTime: Date.now() - startTime,
        confidence: 0
      };
    }
  }

  private initializeAvoidanceStrategies(): void {
    this.avoidanceStrategies = [
      {
        name: 'Random Delays',
        type: 'timing',
        description: 'Add random delays between actions',
        parameters: { minDelay: 500, maxDelay: 2000 },
        effectiveness: 0.7,
        applicableScenarios: ['general', 'form_filling', 'clicking']
      },
      {
        name: 'Human-like Mouse Movement',
        type: 'behavior',
        description: 'Simulate natural mouse movements',
        parameters: { curvature: 0.8, speed: 'variable' },
        effectiveness: 0.8,
        applicableScenarios: ['clicking', 'scrolling']
      },
      {
        name: 'Fingerprint Spoofing',
        type: 'fingerprint',
        description: 'Modify browser fingerprint properties',
        parameters: { modifyWebdriver: true, modifyPlugins: true },
        effectiveness: 0.6,
        applicableScenarios: ['general']
      }
    ];
  }

  private storeDetectionHistory(url: string, result: CaptchaDetectionResult): void {
    const hostname = new URL(url).hostname;
    
    if (!this.detectionHistory.has(hostname)) {
      this.detectionHistory.set(hostname, []);
    }
    
    const history = this.detectionHistory.get(hostname)!;
    history.push(result);
    
    // Keep only last 10 detections per hostname
    if (history.length > 10) {
      history.splice(0, history.length - 10);
    }
  }

  private determineProvider(element: any): 'recaptcha' | 'hcaptcha' | 'cloudflare' | 'custom' | 'unknown' {
    if (element.src && element.src.includes('recaptcha')) return 'recaptcha';
    if (element.src && element.src.includes('hcaptcha')) return 'hcaptcha';
    if (element.className && element.className.includes('cf-')) return 'cloudflare';
    return 'unknown';
  }

  private determineVersion(element: any): string {
    // Simplified version detection
    if (element.src && element.src.includes('recaptcha/api2')) return 'v2';
    if (element.src && element.src.includes('recaptcha/enterprise')) return 'enterprise';
    return 'unknown';
  }

  private generateSelector(element: any): string {
    if (element.id) return `#${element.id}`;
    if (element.className) return `.${element.className.split(' ')[0]}`;
    return element.tagName.toLowerCase();
  }
}