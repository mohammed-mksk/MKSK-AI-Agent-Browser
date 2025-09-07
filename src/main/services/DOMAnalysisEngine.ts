import { Page } from 'puppeteer';
import { AIProvider } from './ai/AIProvider.js';
import { Logger } from './Logger.js';
import { 
  DOMElement, 
  ElementPurpose, 
  BoundingBox,
  ElementRelationship
} from '../interfaces/IReasoningEngine.js';

export interface DOMAnalysisResult {
  elements: DOMElement[];
  relationships: ElementRelationship[];
  viewport: ViewportInfo;
  accessibility: AccessibilityAnalysis;
  performance: AnalysisPerformance;
}

export interface ViewportInfo {
  width: number;
  height: number;
  scrollX: number;
  scrollY: number;
  devicePixelRatio: number;
  visibleElements: number;
  hiddenElements: number;
}

export interface AccessibilityAnalysis {
  totalElements: number;
  accessibleElements: number;
  violationsCount: number;
  commonIssues: string[];
  recommendations: string[];
  score: number;
}

export interface AnalysisPerformance {
  totalTime: number;
  elementsAnalyzed: number;
  scriptsInjected: boolean;
  memoryUsage: number;
  errors: string[];
}

export interface ElementPurposeClassification {
  element: DOMElement;
  purpose: ElementPurpose;
  confidence: number;
  reasoning: string;
  alternatives: { purpose: ElementPurpose; confidence: number }[];
}

export class DOMAnalysisEngine {
  private aiProvider: AIProvider;
  private logger: Logger;
  private analysisScriptsInjected: boolean = false;

  constructor(aiProvider: AIProvider) {
    this.aiProvider = aiProvider;
    this.logger = new Logger();
  }

  async analyzeDOM(page: Page): Promise<DOMAnalysisResult> {
    const startTime = Date.now();
    
    try {
      this.logger.info('Starting comprehensive DOM analysis');
      
      // Inject analysis scripts if not already done
      await this.injectAnalysisScripts(page);
      
      // Extract all DOM elements
      const elements = await this.extractDOMElements(page);
      
      // Analyze element relationships
      const relationships = await this.analyzeElementRelationships(elements, page);
      
      // Get viewport information
      const viewport = await this.getViewportInfo(page);
      
      // Perform accessibility analysis
      const accessibility = await this.performAccessibilityAnalysis(elements, page);
      
      const totalTime = Date.now() - startTime;
      
      const result: DOMAnalysisResult = {
        elements,
        relationships,
        viewport,
        accessibility,
        performance: {
          totalTime,
          elementsAnalyzed: elements.length,
          scriptsInjected: this.analysisScriptsInjected,
          memoryUsage: 0, // Would need to implement memory tracking
          errors: []
        }
      };
      
      this.logger.info(`DOM analysis completed: ${elements.length} elements analyzed in ${totalTime}ms`);
      return result;
      
    } catch (error) {
      this.logger.error('DOM analysis failed:', error);
      throw error;
    }
  }

  async classifyElementPurpose(element: DOMElement): Promise<ElementPurposeClassification> {
    try {
      const prompt = `
Analyze this DOM element and classify its purpose:

Element Details:
- Tag: ${element.tagName}
- ID: ${element.id || 'none'}
- Class: ${element.className || 'none'}
- Text: ${element.textContent?.substring(0, 100) || 'none'}
- Attributes: ${JSON.stringify(element.attributes)}
- Visible: ${element.isVisible}
- Interactable: ${element.isInteractable}

Classify the element's purpose and provide reasoning in JSON format:
{
  "purpose": "button|input|link|form|navigation|content|search|submit|unknown",
  "confidence": 0.9,
  "reasoning": "Detailed explanation of why this classification was chosen",
  "alternatives": [
    {"purpose": "alternative_purpose", "confidence": 0.3}
  ]
}`;

      const response = await this.aiProvider.generateCompletion(prompt, {
        temperature: 0.1,
        maxTokens: 400
      });

      const aiResult = JSON.parse(response);
      
      return {
        element,
        purpose: this.stringToPurpose(aiResult.purpose),
        confidence: aiResult.confidence || 0.7,
        reasoning: aiResult.reasoning || 'AI classification',
        alternatives: aiResult.alternatives?.map((alt: any) => ({
          purpose: this.stringToPurpose(alt.purpose),
          confidence: alt.confidence
        })) || []
      };
      
    } catch (error) {
      this.logger.error('Failed to classify element purpose:', error);
      return this.fallbackPurposeClassification(element);
    }
  }

  async injectAnalysisScripts(page: Page): Promise<void> {
    try {
      // Check if scripts are already injected
      const scriptsInjected = await page.evaluate(() => {
        return typeof (window as any).domAnalyzer !== 'undefined';
      });
      
      if (scriptsInjected) {
        this.analysisScriptsInjected = true;
        return;
      }
      
      // Inject comprehensive DOM analysis scripts
      await page.evaluateOnNewDocument(() => {
        (window as any).domAnalyzer = {
          // Extract all DOM elements with comprehensive information
          extractAllElements: () => {
            const elements: any[] = [];
            const allElements = document.querySelectorAll('*');
            let index = 0;
            
            allElements.forEach(el => {
              const rect = el.getBoundingClientRect();
              const computedStyle = window.getComputedStyle(el);
              
              // Skip script, style, and other non-visual elements
              if (['SCRIPT', 'STYLE', 'META', 'LINK', 'TITLE'].includes(el.tagName)) {
                return;
              }
              
              elements.push({
                index: index++,
                tagName: el.tagName.toLowerCase(),
                id: el.id || '',
                className: el.className || '',
                textContent: el.textContent?.trim().substring(0, 200) || '',
                attributes: Array.from(el.attributes).reduce((acc: any, attr) => {
                  acc[attr.name] = attr.value;
                  return acc;
                }, {}),
                boundingBox: {
                  x: rect.x,
                  y: rect.y,
                  width: rect.width,
                  height: rect.height
                },
                isVisible: rect.width > 0 && rect.height > 0 && 
                          computedStyle.visibility !== 'hidden' && 
                          computedStyle.display !== 'none' &&
                          parseFloat(computedStyle.opacity) > 0,
                isInteractable: !el.hasAttribute('disabled') && 
                               computedStyle.pointerEvents !== 'none' &&
                               ['A', 'BUTTON', 'INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName) ||
                               el.hasAttribute('onclick') ||
                               el.hasAttribute('role') && ['button', 'link', 'menuitem'].includes(el.getAttribute('role') || ''),
                computedStyle: {
                  display: computedStyle.display,
                  visibility: computedStyle.visibility,
                  opacity: computedStyle.opacity,
                  position: computedStyle.position,
                  zIndex: computedStyle.zIndex,
                  cursor: computedStyle.cursor,
                  pointerEvents: computedStyle.pointerEvents
                },
                parent: el.parentElement?.tagName.toLowerCase() || null,
                children: Array.from(el.children).map(child => child.tagName.toLowerCase())
              });
            });
            
            return elements;
          },
          
          // Analyze element relationships
          analyzeRelationships: (elements: any[]) => {
            const relationships: any[] = [];
            
            elements.forEach((element, index) => {
              const parentIndex = elements.findIndex(el => 
                el.tagName === element.parent && 
                el.boundingBox.x <= element.boundingBox.x &&
                el.boundingBox.y <= element.boundingBox.y
              );
              
              const childrenIndices = elements
                .map((el, idx) => ({ el, idx }))
                .filter(({ el }) => element.children.includes(el.tagName))
                .map(({ idx }) => idx);
              
              const siblingIndices = elements
                .map((el, idx) => ({ el, idx }))
                .filter(({ el, idx }) => 
                  idx !== index && 
                  el.parent === element.parent &&
                  Math.abs(el.boundingBox.y - element.boundingBox.y) < 50
                )
                .map(({ idx }) => idx);
              
              if (parentIndex !== -1 || childrenIndices.length > 0 || siblingIndices.length > 0) {
                relationships.push({
                  parent: parentIndex !== -1 ? parentIndex : -1,
                  children: childrenIndices,
                  siblings: siblingIndices,
                  type: this.inferRelationshipType(element)
                });
              }
            });
            
            return relationships;
          },
          
          // Get viewport information
          getViewportInfo: () => {
            const allElements = document.querySelectorAll('*');
            let visibleCount = 0;
            let hiddenCount = 0;
            
            allElements.forEach(el => {
              const rect = el.getBoundingClientRect();
              const style = window.getComputedStyle(el);
              
              if (rect.width > 0 && rect.height > 0 && 
                  style.visibility !== 'hidden' && 
                  style.display !== 'none') {
                visibleCount++;
              } else {
                hiddenCount++;
              }
            });
            
            return {
              width: window.innerWidth,
              height: window.innerHeight,
              scrollX: window.scrollX,
              scrollY: window.scrollY,
              devicePixelRatio: window.devicePixelRatio,
              visibleElements: visibleCount,
              hiddenElements: hiddenCount
            };
          },
          
          // Perform basic accessibility analysis
          analyzeAccessibility: (elements: any[]) => {
            let accessibleCount = 0;
            let violationsCount = 0;
            const commonIssues: string[] = [];
            const recommendations: string[] = [];
            
            elements.forEach(element => {
              let isAccessible = true;
              
              // Check for missing labels on form elements
              if (['input', 'textarea', 'select'].includes(element.tagName)) {
                const hasLabel = element.attributes['aria-label'] || 
                               element.attributes['aria-labelledby'] ||
                               document.querySelector(`label[for="${element.id}"]`);
                
                if (!hasLabel) {
                  isAccessible = false;
                  violationsCount++;
                  if (!commonIssues.includes('missing_labels')) {
                    commonIssues.push('missing_labels');
                    recommendations.push('Add proper labels to form elements');
                  }
                }
              }
              
              // Check for missing alt text on images
              if (element.tagName === 'img' && !element.attributes.alt) {
                isAccessible = false;
                violationsCount++;
                if (!commonIssues.includes('missing_alt_text')) {
                  commonIssues.push('missing_alt_text');
                  recommendations.push('Add alt text to images');
                }
              }
              
              // Check for interactive elements without proper roles
              if (element.isInteractable && !element.attributes.role && 
                  !['a', 'button', 'input', 'textarea', 'select'].includes(element.tagName)) {
                isAccessible = false;
                violationsCount++;
                if (!commonIssues.includes('missing_roles')) {
                  commonIssues.push('missing_roles');
                  recommendations.push('Add proper ARIA roles to interactive elements');
                }
              }
              
              if (isAccessible) {
                accessibleCount++;
              }
            });
            
            return {
              totalElements: elements.length,
              accessibleElements: accessibleCount,
              violationsCount,
              commonIssues,
              recommendations,
              score: elements.length > 0 ? (accessibleCount / elements.length) * 100 : 0
            };
          },
          
          // Helper function to infer relationship type
          inferRelationshipType: (element: any) => {
            if (element.tagName === 'form' || element.parent === 'form') {
              return 'form';
            }
            if (['nav', 'header', 'footer'].includes(element.tagName) || 
                element.attributes.role === 'navigation') {
              return 'navigation';
            }
            if (['article', 'section', 'main'].includes(element.tagName)) {
              return 'content';
            }
            if (element.isInteractable) {
              return 'interactive';
            }
            return 'content';
          }
        };
      });
      
      this.analysisScriptsInjected = true;
      this.logger.info('DOM analysis scripts injected successfully');
      
    } catch (error) {
      this.logger.error('Failed to inject DOM analysis scripts:', error);
      throw error;
    }
  }

  private async extractDOMElements(page: Page): Promise<DOMElement[]> {
    try {
      const elements = await page.evaluate(() => {
        const analyzer = (window as any).domAnalyzer;
        if (!analyzer) {
          throw new Error('DOM analyzer not injected');
        }
        return analyzer.extractAllElements();
      });
      
      return elements.map((el: any) => ({
        tagName: el.tagName,
        id: el.id,
        className: el.className,
        textContent: el.textContent,
        attributes: el.attributes,
        boundingBox: el.boundingBox,
        isVisible: el.isVisible,
        isInteractable: el.isInteractable
      }));
      
    } catch (error) {
      this.logger.error('Failed to extract DOM elements:', error);
      return [];
    }
  }

  private async analyzeElementRelationships(elements: DOMElement[], page: Page): Promise<ElementRelationship[]> {
    try {
      const relationships = await page.evaluate((elementsData) => {
        const analyzer = (window as any).domAnalyzer;
        return analyzer.analyzeRelationships(elementsData);
      }, elements);
      
      return relationships;
      
    } catch (error) {
      this.logger.error('Failed to analyze element relationships:', error);
      return [];
    }
  }

  private async getViewportInfo(page: Page): Promise<ViewportInfo> {
    try {
      const viewportInfo = await page.evaluate(() => {
        const analyzer = (window as any).domAnalyzer;
        return analyzer.getViewportInfo();
      });
      
      return viewportInfo;
      
    } catch (error) {
      this.logger.error('Failed to get viewport info:', error);
      return {
        width: 1920,
        height: 1080,
        scrollX: 0,
        scrollY: 0,
        devicePixelRatio: 1,
        visibleElements: 0,
        hiddenElements: 0
      };
    }
  }

  private async performAccessibilityAnalysis(elements: DOMElement[], page: Page): Promise<AccessibilityAnalysis> {
    try {
      const accessibilityData = await page.evaluate((elementsData) => {
        const analyzer = (window as any).domAnalyzer;
        return analyzer.analyzeAccessibility(elementsData);
      }, elements);
      
      return accessibilityData;
      
    } catch (error) {
      this.logger.error('Failed to perform accessibility analysis:', error);
      return {
        totalElements: elements.length,
        accessibleElements: 0,
        violationsCount: 0,
        commonIssues: [],
        recommendations: [],
        score: 0
      };
    }
  }

  private stringToPurpose(purposeString: string): ElementPurpose {
    switch (purposeString.toLowerCase()) {
      case 'button': return ElementPurpose.BUTTON;
      case 'input': return ElementPurpose.INPUT;
      case 'link': return ElementPurpose.LINK;
      case 'form': return ElementPurpose.FORM;
      case 'navigation': return ElementPurpose.NAVIGATION;
      case 'content': return ElementPurpose.CONTENT;
      case 'search': return ElementPurpose.SEARCH;
      case 'submit': return ElementPurpose.SUBMIT;
      default: return ElementPurpose.UNKNOWN;
    }
  }

  private fallbackPurposeClassification(element: DOMElement): ElementPurposeClassification {
    let purpose = ElementPurpose.UNKNOWN;
    let confidence = 0.5;
    
    // Basic classification based on tag name
    switch (element.tagName.toLowerCase()) {
      case 'button':
        purpose = element.attributes.type === 'submit' ? ElementPurpose.SUBMIT : ElementPurpose.BUTTON;
        confidence = 0.8;
        break;
      case 'input':
      case 'textarea':
      case 'select':
        purpose = ElementPurpose.INPUT;
        confidence = 0.8;
        break;
      case 'a':
        purpose = ElementPurpose.LINK;
        confidence = 0.8;
        break;
      case 'form':
        purpose = ElementPurpose.FORM;
        confidence = 0.9;
        break;
      case 'nav':
        purpose = ElementPurpose.NAVIGATION;
        confidence = 0.9;
        break;
      default:
        if (element.isInteractable) {
          purpose = ElementPurpose.BUTTON;
          confidence = 0.6;
        } else {
          purpose = ElementPurpose.CONTENT;
          confidence = 0.7;
        }
    }
    
    return {
      element,
      purpose,
      confidence,
      reasoning: 'Fallback classification based on tag name and interactability',
      alternatives: []
    };
  }
}