import { Page } from 'puppeteer-core';
import { 
  AutomationStep, 
  ElementSelector,
  ActionContext
} from '../../shared/types.js';
import { Logger } from './Logger.js';
import { ElementDiscoveryService } from './ElementDiscoveryService.js';

export interface ValidationResult {
  isValid: boolean;
  confidence: number;
  issues: ValidationIssue[];
  recommendations: string[];
  safetyScore: number;
  rollbackPlan?: RollbackPlan;
}

export interface ValidationIssue {
  type: 'element_not_found' | 'element_not_visible' | 'element_not_interactable' | 'safety_concern' | 'timing_issue' | 'context_mismatch';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  element?: ElementSelector;
  suggestedFix?: string;
  blockingAction: boolean;
}

export interface RollbackPlan {
  id: string;
  steps: RollbackStep[];
  triggerConditions: string[];
  estimatedTime: number;
  safetyLevel: 'safe' | 'moderate' | 'risky';
}

export interface RollbackStep {
  action: 'undo_click' | 'restore_value' | 'navigate_back' | 'close_modal' | 'refresh_page' | 'wait';
  target?: ElementSelector;
  originalValue?: string;
  timeout: number;
  description: string;
}

export interface ElementValidation {
  exists: boolean;
  visible: boolean;
  interactable: boolean;
  stable: boolean;
  confidence: number;
  boundingBox?: DOMRect;
  computedStyle?: Partial<CSSStyleDeclaration>;
  accessibility: AccessibilityValidation;
}

export interface AccessibilityValidation {
  hasLabel: boolean;
  hasRole: boolean;
  isKeyboardAccessible: boolean;
  hasProperContrast: boolean;
  issues: string[];
}

export interface SafetyValidation {
  isDestructive: boolean;
  affectsUserData: boolean;
  triggersNavigation: boolean;
  hasUnintendedSideEffects: boolean;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  mitigationStrategies: string[];
}

export interface FeasibilityValidation {
  canExecute: boolean;
  requiredConditions: string[];
  missingConditions: string[];
  estimatedSuccessRate: number;
  alternativeApproaches: string[];
}

export class ActionValidationSystem {
  private logger: Logger;
  private elementDiscovery: ElementDiscoveryService;
  private validationHistory: Map<string, ValidationResult> = new Map();

  constructor(elementDiscovery: ElementDiscoveryService) {
    this.logger = new Logger();
    this.elementDiscovery = elementDiscovery;
  }

  async validateAction(
    action: AutomationStep,
    context: ActionContext,
    page: Page
  ): Promise<ValidationResult> {
    try {
      this.logger.info(`Validating action: ${action.type} - ${action.description}`);

      const [
        elementValidation,
        safetyValidation,
        feasibilityValidation
      ] = await Promise.all([
        this.validateElement(action.target, page),
        this.validateSafety(action, context, page),
        this.validateFeasibility(action, context, page)
      ]);

      const issues: ValidationIssue[] = [];
      let confidence = 1.0;
      let safetyScore = 1.0;

      // Process element validation issues
      if (!elementValidation.exists) {
        issues.push({
          type: 'element_not_found',
          severity: 'critical',
          message: `Target element not found: ${JSON.stringify(action.target)}`,
          element: action.target,
          suggestedFix: 'Wait for element to load or use alternative selector',
          blockingAction: true
        });
        confidence -= 0.5;
      } else if (!elementValidation.visible) {
        issues.push({
          type: 'element_not_visible',
          severity: 'high',
          message: 'Target element is not visible',
          element: action.target,
          suggestedFix: 'Scroll element into view or wait for it to become visible',
          blockingAction: true
        });
        confidence -= 0.3;
      } else if (!elementValidation.interactable) {
        issues.push({
          type: 'element_not_interactable',
          severity: 'high',
          message: 'Target element is not interactable',
          element: action.target,
          suggestedFix: 'Wait for element to become enabled or check for overlaying elements',
          blockingAction: true
        });
        confidence -= 0.3;
      }

      // Process safety validation issues
      if (safetyValidation.isDestructive) {
        issues.push({
          type: 'safety_concern',
          severity: 'high',
          message: 'Action may have destructive effects',
          suggestedFix: 'Create backup or confirmation step before execution',
          blockingAction: false
        });
        safetyScore -= 0.4;
      }

      if (safetyValidation.affectsUserData) {
        issues.push({
          type: 'safety_concern',
          severity: 'medium',
          message: 'Action may affect user data',
          suggestedFix: 'Implement rollback mechanism',
          blockingAction: false
        });
        safetyScore -= 0.2;
      }

      // Process feasibility validation issues
      if (!feasibilityValidation.canExecute) {
        issues.push({
          type: 'context_mismatch',
          severity: 'high',
          message: 'Action cannot be executed in current context',
          suggestedFix: feasibilityValidation.alternativeApproaches[0] || 'Review action requirements',
          blockingAction: true
        });
        confidence -= 0.4;
      }

      // Generate rollback plan if needed
      const rollbackPlan = await this.generateRollbackPlan(action, safetyValidation, page);

      const recommendations = this.generateRecommendations(issues, elementValidation, safetyValidation, feasibilityValidation);

      const result: ValidationResult = {
        isValid: issues.filter(issue => issue.blockingAction).length === 0,
        confidence: Math.max(0, confidence),
        issues,
        recommendations,
        safetyScore: Math.max(0, safetyScore),
        rollbackPlan
      };

      // Store validation result for learning
      this.validationHistory.set(`${action.id}_${Date.now()}`, result);

      this.logger.info(`Validation completed: ${result.isValid ? 'VALID' : 'INVALID'} (confidence: ${result.confidence.toFixed(2)})`);
      return result;

    } catch (error) {
      this.logger.error('Action validation failed:', error);
      return {
        isValid: false,
        confidence: 0,
        issues: [{
          type: 'context_mismatch',
          severity: 'critical',
          message: `Validation error: ${(error as Error).message}`,
          blockingAction: true
        }],
        recommendations: ['Fix validation system error before retrying'],
        safetyScore: 0
      };
    }
  }

  async validateElement(selector: ElementSelector, page: Page): Promise<ElementValidation> {
    try {
      // Find element using multiple strategies
      const element = await this.findElementWithFallback(selector, page);
      
      if (!element) {
        return {
          exists: false,
          visible: false,
          interactable: false,
          stable: false,
          confidence: 0,
          accessibility: {
            hasLabel: false,
            hasRole: false,
            isKeyboardAccessible: false,
            hasProperContrast: false,
            issues: ['Element not found']
          }
        };
      }

      // Check element properties
      const [isVisible, boundingBox, computedStyle, accessibility] = await Promise.all([
        element.isIntersectingViewport(),
        element.boundingBox(),
        this.getComputedStyle(element, page),
        this.validateAccessibility(element, page)
      ]);

      const isInteractable = await this.checkInteractability(element, page);
      const isStable = await this.checkStability(element, page);

      return {
        exists: true,
        visible: isVisible,
        interactable: isInteractable,
        stable: isStable,
        confidence: this.calculateElementConfidence(isVisible, isInteractable, isStable),
        boundingBox: boundingBox || undefined,
        computedStyle,
        accessibility
      };

    } catch (error) {
      this.logger.warn('Element validation failed:', error);
      return {
        exists: false,
        visible: false,
        interactable: false,
        stable: false,
        confidence: 0,
        accessibility: {
          hasLabel: false,
          hasRole: false,
          isKeyboardAccessible: false,
          hasProperContrast: false,
          issues: ['Validation error']
        }
      };
    }
  }

  async validateSafety(action: AutomationStep, context: ActionContext, page: Page): Promise<SafetyValidation> {
    try {
      let isDestructive = false;
      let affectsUserData = false;
      let triggersNavigation = false;
      let hasUnintendedSideEffects = false;
      const mitigationStrategies: string[] = [];

      // Analyze action type for safety implications
      switch (action.type) {
        case 'click':
          const clickTarget = await this.analyzeClickTarget(action.target, page);
          isDestructive = clickTarget.isDeleteButton || clickTarget.isSubmitButton;
          triggersNavigation = clickTarget.isNavigationLink;
          hasUnintendedSideEffects = clickTarget.triggersModal || clickTarget.triggersPopup;
          
          if (isDestructive) {
            mitigationStrategies.push('Add confirmation dialog', 'Create data backup');
          }
          if (triggersNavigation) {
            mitigationStrategies.push('Save current state', 'Prepare navigation rollback');
          }
          break;

        case 'type':
          affectsUserData = true;
          const inputType = await this.analyzeInputField(action.target, page);
          isDestructive = inputType.isPasswordField || inputType.isEmailField;
          
          mitigationStrategies.push('Store original value', 'Validate input format');
          break;

        case 'navigate':
          triggersNavigation = true;
          hasUnintendedSideEffects = true;
          mitigationStrategies.push('Save current page state', 'Prepare back navigation');
          break;

        default:
          // Other actions are generally safe
          break;
      }

      // Calculate risk level
      let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';
      if (isDestructive && affectsUserData) {
        riskLevel = 'critical';
      } else if (isDestructive || (affectsUserData && triggersNavigation)) {
        riskLevel = 'high';
      } else if (affectsUserData || triggersNavigation || hasUnintendedSideEffects) {
        riskLevel = 'medium';
      }

      return {
        isDestructive,
        affectsUserData,
        triggersNavigation,
        hasUnintendedSideEffects,
        riskLevel,
        mitigationStrategies
      };

    } catch (error) {
      this.logger.warn('Safety validation failed:', error);
      return {
        isDestructive: true, // Assume worst case
        affectsUserData: true,
        triggersNavigation: true,
        hasUnintendedSideEffects: true,
        riskLevel: 'critical',
        mitigationStrategies: ['Manual review required due to validation error']
      };
    }
  }

  async validateFeasibility(action: AutomationStep, context: ActionContext, page: Page): Promise<FeasibilityValidation> {
    try {
      const requiredConditions: string[] = [];
      const missingConditions: string[] = [];
      const alternativeApproaches: string[] = [];

      // Check page state requirements
      const pageState = await page.evaluate(() => ({
        readyState: document.readyState,
        hasActiveModals: document.querySelectorAll('.modal:not(.hidden), .popup:not(.hidden)').length > 0,
        hasLoadingElements: document.querySelectorAll('.loading, .spinner').length > 0,
        hasErrors: document.querySelectorAll('.error, .alert-danger').length > 0
      }));

      requiredConditions.push('Page fully loaded');
      if (pageState.readyState !== 'complete') {
        missingConditions.push('Page not fully loaded');
        alternativeApproaches.push('Wait for page load completion');
      }

      requiredConditions.push('No blocking modals');
      if (pageState.hasActiveModals) {
        missingConditions.push('Active modals blocking interaction');
        alternativeApproaches.push('Close blocking modals first');
      }

      requiredConditions.push('No loading states');
      if (pageState.hasLoadingElements) {
        missingConditions.push('Page has loading elements');
        alternativeApproaches.push('Wait for loading to complete');
      }

      // Check action-specific requirements
      switch (action.type) {
        case 'click':
          requiredConditions.push('Element clickable');
          const clickable = await this.isElementClickable(action.target, page);
          if (!clickable) {
            missingConditions.push('Element not clickable');
            alternativeApproaches.push('Scroll element into view', 'Remove overlaying elements');
          }
          break;

        case 'type':
          requiredConditions.push('Input field focusable');
          const focusable = await this.isElementFocusable(action.target, page);
          if (!focusable) {
            missingConditions.push('Input field not focusable');
            alternativeApproaches.push('Enable input field', 'Use alternative input method');
          }
          break;

        case 'extract':
          requiredConditions.push('Content available for extraction');
          const hasContent = await this.hasExtractableContent(action.target, page);
          if (!hasContent) {
            missingConditions.push('No extractable content found');
            alternativeApproaches.push('Wait for content to load', 'Use alternative selectors');
          }
          break;
      }

      const canExecute = missingConditions.length === 0;
      const estimatedSuccessRate = canExecute ? 0.9 : Math.max(0.1, 0.9 - (missingConditions.length * 0.2));

      return {
        canExecute,
        requiredConditions,
        missingConditions,
        estimatedSuccessRate,
        alternativeApproaches
      };

    } catch (error) {
      this.logger.warn('Feasibility validation failed:', error);
      return {
        canExecute: false,
        requiredConditions: ['Validation system functional'],
        missingConditions: ['Validation system error'],
        estimatedSuccessRate: 0,
        alternativeApproaches: ['Fix validation system', 'Manual execution']
      };
    }
  }

  async generateRollbackPlan(action: AutomationStep, safety: SafetyValidation, page: Page): Promise<RollbackPlan | undefined> {
    if (safety.riskLevel === 'low') {
      return undefined; // No rollback needed for low-risk actions
    }

    const steps: RollbackStep[] = [];
    const triggerConditions: string[] = [];

    switch (action.type) {
      case 'click':
        if (safety.triggersNavigation) {
          steps.push({
            action: 'navigate_back',
            timeout: 5000,
            description: 'Navigate back to previous page'
          });
          triggerConditions.push('Unexpected navigation occurred');
        }
        
        if (safety.hasUnintendedSideEffects) {
          steps.push({
            action: 'close_modal',
            timeout: 3000,
            description: 'Close any opened modals'
          });
          triggerConditions.push('Modal dialog opened unexpectedly');
        }
        break;

      case 'type':
        if (safety.affectsUserData) {
          // Store original value for restoration
          const originalValue = await this.getElementValue(action.target, page);
          steps.push({
            action: 'restore_value',
            target: action.target,
            originalValue,
            timeout: 2000,
            description: 'Restore original input value'
          });
          triggerConditions.push('Input validation failed', 'Unexpected form submission');
        }
        break;

      case 'navigate':
        steps.push({
          action: 'navigate_back',
          timeout: 5000,
          description: 'Return to previous page'
        });
        triggerConditions.push('Navigation to wrong page', 'Page load failed');
        break;

      default:
        // Generic rollback for unknown actions
        steps.push({
          action: 'refresh_page',
          timeout: 10000,
          description: 'Refresh page to reset state'
        });
        triggerConditions.push('Action caused unexpected state');
        break;
    }

    return {
      id: `rollback_${action.id}_${Date.now()}`,
      steps,
      triggerConditions,
      estimatedTime: steps.reduce((sum, step) => sum + step.timeout, 0),
      safetyLevel: safety.riskLevel === 'critical' ? 'risky' : safety.riskLevel === 'high' ? 'moderate' : 'safe'
    };
  }

  async executeRollback(rollbackPlan: RollbackPlan, page: Page): Promise<boolean> {
    try {
      this.logger.info(`Executing rollback plan: ${rollbackPlan.id}`);

      for (const step of rollbackPlan.steps) {
        try {
          switch (step.action) {
            case 'navigate_back':
              await page.goBack({ waitUntil: 'networkidle2', timeout: step.timeout });
              break;

            case 'restore_value':
              if (step.target && step.originalValue !== undefined) {
                const element = await this.findElementWithFallback(step.target, page);
                if (element) {
                  await element.click({ clickCount: 3 }); // Select all
                  await element.type(step.originalValue);
                }
              }
              break;

            case 'close_modal':
              // Try common modal close patterns
              const closeSelectors = ['.modal .close', '.popup .close', '[data-dismiss="modal"]', '.overlay .close'];
              for (const selector of closeSelectors) {
                try {
                  const closeBtn = await page.$(selector);
                  if (closeBtn) {
                    await closeBtn.click();
                    break;
                  }
                } catch {
                  // Continue to next selector
                }
              }
              break;

            case 'refresh_page':
              await page.reload({ waitUntil: 'networkidle2', timeout: step.timeout });
              break;

            case 'wait':
              await page.waitForTimeout(step.timeout);
              break;

            default:
              this.logger.warn(`Unknown rollback action: ${step.action}`);
              break;
          }

          this.logger.info(`Rollback step completed: ${step.description}`);

        } catch (error) {
          this.logger.error(`Rollback step failed: ${step.description}`, error);
          // Continue with remaining steps
        }
      }

      this.logger.info('Rollback plan execution completed');
      return true;

    } catch (error) {
      this.logger.error('Rollback plan execution failed:', error);
      return false;
    }
  }

  // Helper methods
  private async findElementWithFallback(selector: ElementSelector, page: Page): Promise<any> {
    // Try CSS selector first
    if (selector.css) {
      const element = await page.$(selector.css);
      if (element) return element;
    }

    // Try XPath
    if (selector.xpath) {
      const elements = await page.$x(selector.xpath);
      if (elements.length > 0) return elements[0];
    }

    // Try text-based selection
    if (selector.text) {
      const element = await page.evaluateHandle((text) => {
        const walker = document.createTreeWalker(
          document.body,
          NodeFilter.SHOW_TEXT,
          null,
          false
        );
        
        let node;
        while (node = walker.nextNode()) {
          if (node.textContent?.includes(text)) {
            return node.parentElement;
          }
        }
        return null;
      }, selector.text);
      
      if (element) return element.asElement();
    }

    return null;
  }

  private async checkInteractability(element: any, page: Page): Promise<boolean> {
    try {
      return await page.evaluate((el) => {
        if (!el) return false;
        
        const style = window.getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        
        return (
          style.display !== 'none' &&
          style.visibility !== 'hidden' &&
          style.pointerEvents !== 'none' &&
          !el.disabled &&
          rect.width > 0 &&
          rect.height > 0
        );
      }, element);
    } catch {
      return false;
    }
  }

  private async checkStability(element: any, page: Page): Promise<boolean> {
    try {
      // Check element position stability over time
      const positions: DOMRect[] = [];
      const checks = 3;
      const interval = 200;

      for (let i = 0; i < checks; i++) {
        const rect = await element.boundingBox();
        if (rect) positions.push(rect);
        if (i < checks - 1) await page.waitForTimeout(interval);
      }

      if (positions.length < 2) return false;

      // Check if position is stable (within 5px tolerance)
      const tolerance = 5;
      for (let i = 1; i < positions.length; i++) {
        const prev = positions[i - 1];
        const curr = positions[i];
        
        if (Math.abs(curr.x - prev.x) > tolerance || Math.abs(curr.y - prev.y) > tolerance) {
          return false;
        }
      }

      return true;
    } catch {
      return false;
    }
  }

  private async getComputedStyle(element: any, page: Page): Promise<Partial<CSSStyleDeclaration>> {
    try {
      return await page.evaluate((el) => {
        const style = window.getComputedStyle(el);
        return {
          display: style.display,
          visibility: style.visibility,
          opacity: style.opacity,
          pointerEvents: style.pointerEvents,
          position: style.position,
          zIndex: style.zIndex
        };
      }, element);
    } catch {
      return {};
    }
  }

  private async validateAccessibility(element: any, page: Page): Promise<AccessibilityValidation> {
    try {
      return await page.evaluate((el) => {
        const hasLabel = !!(
          el.getAttribute('aria-label') ||
          el.getAttribute('aria-labelledby') ||
          el.getAttribute('title') ||
          (el.tagName === 'INPUT' && document.querySelector(`label[for="${el.id}"]`))
        );

        const hasRole = !!el.getAttribute('role');
        const isKeyboardAccessible = el.tabIndex >= 0 || ['A', 'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA'].includes(el.tagName);

        // Basic contrast check (simplified)
        const style = window.getComputedStyle(el);
        const hasProperContrast = style.color !== style.backgroundColor;

        const issues: string[] = [];
        if (!hasLabel && ['INPUT', 'BUTTON', 'SELECT', 'TEXTAREA'].includes(el.tagName)) {
          issues.push('Missing accessible label');
        }
        if (!isKeyboardAccessible && el.onclick) {
          issues.push('Not keyboard accessible');
        }

        return {
          hasLabel,
          hasRole,
          isKeyboardAccessible,
          hasProperContrast,
          issues
        };
      }, element);
    } catch {
      return {
        hasLabel: false,
        hasRole: false,
        isKeyboardAccessible: false,
        hasProperContrast: false,
        issues: ['Accessibility validation failed']
      };
    }
  }

  private calculateElementConfidence(visible: boolean, interactable: boolean, stable: boolean): number {
    let confidence = 0;
    if (visible) confidence += 0.4;
    if (interactable) confidence += 0.4;
    if (stable) confidence += 0.2;
    return confidence;
  }

  private async analyzeClickTarget(selector: ElementSelector, page: Page): Promise<any> {
    try {
      const element = await this.findElementWithFallback(selector, page);
      if (!element) {
        return {
          isDeleteButton: false,
          isSubmitButton: false,
          isNavigationLink: false,
          triggersModal: false,
          triggersPopup: false
        };
      }

      return await page.evaluate((el) => {
        const text = el.textContent?.toLowerCase() || '';
        const className = el.className?.toLowerCase() || '';
        const id = el.id?.toLowerCase() || '';
        const type = el.type?.toLowerCase() || '';

        const isDeleteButton = text.includes('delete') || text.includes('remove') || className.includes('delete') || id.includes('delete');
        const isSubmitButton = type === 'submit' || text.includes('submit') || className.includes('submit');
        const isNavigationLink = el.tagName === 'A' && el.href && !el.href.startsWith('#');
        const triggersModal = className.includes('modal') || el.getAttribute('data-toggle') === 'modal';
        const triggersPopup = className.includes('popup') || el.target === '_blank';

        return {
          isDeleteButton,
          isSubmitButton,
          isNavigationLink,
          triggersModal,
          triggersPopup
        };
      }, element);
    } catch {
      return {
        isDeleteButton: false,
        isSubmitButton: false,
        isNavigationLink: false,
        triggersModal: false,
        triggersPopup: false
      };
    }
  }

  private async analyzeInputField(selector: ElementSelector, page: Page): Promise<any> {
    try {
      const element = await this.findElementWithFallback(selector, page);
      if (!element) {
        return { isPasswordField: false, isEmailField: false };
      }

      return await page.evaluate((el) => {
        const type = el.type?.toLowerCase() || '';
        const name = el.name?.toLowerCase() || '';
        const id = el.id?.toLowerCase() || '';

        const isPasswordField = type === 'password' || name.includes('password') || id.includes('password');
        const isEmailField = type === 'email' || name.includes('email') || id.includes('email');

        return { isPasswordField, isEmailField };
      }, element);
    } catch {
      return { isPasswordField: false, isEmailField: false };
    }
  }

  private async isElementClickable(selector: ElementSelector, page: Page): Promise<boolean> {
    const element = await this.findElementWithFallback(selector, page);
    return element ? await this.checkInteractability(element, page) : false;
  }

  private async isElementFocusable(selector: ElementSelector, page: Page): Promise<boolean> {
    try {
      const element = await this.findElementWithFallback(selector, page);
      if (!element) return false;

      return await page.evaluate((el) => {
        try {
          el.focus();
          return document.activeElement === el;
        } catch {
          return false;
        }
      }, element);
    } catch {
      return false;
    }
  }

  private async hasExtractableContent(selector: ElementSelector, page: Page): Promise<boolean> {
    try {
      const element = await this.findElementWithFallback(selector, page);
      if (!element) return false;

      return await page.evaluate((el) => {
        return !!(el.textContent?.trim() || el.innerHTML?.trim());
      }, element);
    } catch {
      return false;
    }
  }

  private async getElementValue(selector: ElementSelector, page: Page): Promise<string> {
    try {
      const element = await this.findElementWithFallback(selector, page);
      if (!element) return '';

      return await page.evaluate((el) => {
        return el.value || el.textContent || '';
      }, element);
    } catch {
      return '';
    }
  }

  private generateRecommendations(
    issues: ValidationIssue[],
    elementValidation: ElementValidation,
    safetyValidation: SafetyValidation,
    feasibilityValidation: FeasibilityValidation
  ): string[] {
    const recommendations: string[] = [];

    // Element-based recommendations
    if (!elementValidation.exists) {
      recommendations.push('Wait for element to load or verify selector accuracy');
    } else if (!elementValidation.visible) {
      recommendations.push('Scroll element into view before interaction');
    } else if (!elementValidation.interactable) {
      recommendations.push('Ensure element is enabled and not covered by other elements');
    }

    // Safety-based recommendations
    if (safetyValidation.riskLevel === 'high' || safetyValidation.riskLevel === 'critical') {
      recommendations.push('Implement rollback mechanism before execution');
      recommendations.push('Add user confirmation for destructive actions');
    }

    if (safetyValidation.affectsUserData) {
      recommendations.push('Backup original data before modification');
    }

    // Feasibility-based recommendations
    if (!feasibilityValidation.canExecute) {
      recommendations.push(...feasibilityValidation.alternativeApproaches);
    }

    // Accessibility recommendations
    if (elementValidation.accessibility.issues.length > 0) {
      recommendations.push('Address accessibility issues for better reliability');
    }

    return recommendations;
  }

  getValidationHistory(): Map<string, ValidationResult> {
    return new Map(this.validationHistory);
  }

  clearValidationHistory(): void {
    this.validationHistory.clear();
  }
}