import { Page } from 'puppeteer';
import { AIProvider } from './ai/AIProvider.js';
import { Logger } from './Logger.js';
import { DOMAnalysisEngine } from './DOMAnalysisEngine.js';
import {
  DOMElement,
  ElementPurpose,
  ElementType,
  SemanticElement,
  AlternativeSelector,
  ElementRelationship,
  BoundingBox
} from '../interfaces/IReasoningEngine.js';
import { SemanticIndex } from '../interfaces/IElementDiscovery.js';

export interface IndexedElement {
  index: number;
  element: DOMElement;
  purpose: ElementPurpose;
  type: ElementType;
  confidence: number;
  context: ElementContext;
  selectors: AlternativeSelector[];
  relationships: ElementRelationship;
  screenshot?: Buffer;
  accessibility: ElementAccessibility;
}

export interface ElementContext {
  description: string;
  parentContext: string;
  siblingContext: string[];
  formContext?: FormContext;
  navigationContext?: NavigationContext;
  contentContext?: ContentContext;
}

export interface FormContext {
  formId: string;
  fieldType: string;
  label?: string;
  placeholder?: string;
  required: boolean;
  validation: string[];
}

export interface NavigationContext {
  menuLevel: number;
  menuType: 'main' | 'sub' | 'breadcrumb' | 'pagination';
  position: number;
  totalItems: number;
}

export interface ContentContext {
  contentType: 'heading' | 'paragraph' | 'list' | 'table' | 'media';
  importance: number;
  extractable: boolean;
}

export interface ElementAccessibility {
  hasLabel: boolean;
  hasRole: boolean;
  keyboardAccessible: boolean;
  screenReaderFriendly: boolean;
  contrastRatio?: number;
  issues: string[];
}

export interface IndexingResult {
  indexedElements: IndexedElement[];
  semanticIndex: SemanticIndex;
  statistics: IndexingStatistics;
  performance: IndexingPerformance;
}

export interface IndexingStatistics {
  totalElements: number;
  indexedElements: number;
  elementsByPurpose: Map<ElementPurpose, number>;
  elementsByType: Map<ElementType, number>;
  averageConfidence: number;
  accessibilityScore: number;
}

export interface IndexingPerformance {
  totalTime: number;
  indexingTime: number;
  aiClassificationTime: number;
  screenshotTime: number;
  elementsPerSecond: number;
}

export class SemanticElementIndexer {
  private aiProvider: AIProvider;
  private logger: Logger;
  private domAnalyzer: DOMAnalysisEngine;

  constructor(aiProvider: AIProvider) {
    this.aiProvider = aiProvider;
    this.logger = new Logger();
    this.domAnalyzer = new DOMAnalysisEngine(aiProvider);
  }

  async indexPageElements(page: Page, options?: {
    includeScreenshots?: boolean;
    maxElements?: number;
    confidenceThreshold?: number;
  }): Promise<IndexingResult> {
    const startTime = Date.now();
    
    try {
      this.logger.info('Starting semantic element indexing');
      
      const opts = {
        includeScreenshots: false,
        maxElements: 1000,
        confidenceThreshold: 0.5,
        ...options
      };
      
      // Perform DOM analysis first
      const domAnalysis = await this.domAnalyzer.analyzeDOM(page);
      
      // Filter elements based on options
      let elements = domAnalysis.elements;
      if (opts.maxElements && elements.length > opts.maxElements) {
        elements = elements.slice(0, opts.maxElements);
      }
      
      // Create indexed elements with semantic information
      const indexedElements: IndexedElement[] = [];
      const aiClassificationStart = Date.now();
      
      for (let i = 0; i < elements.length; i++) {
        const element = elements[i];
        const indexedElement = await this.createIndexedElement(element, i, page, opts.includeScreenshots);
        
        if (indexedElement.confidence >= opts.confidenceThreshold) {
          indexedElements.push(indexedElement);
        }
      }
      
      const aiClassificationTime = Date.now() - aiClassificationStart;
      
      // Create semantic index
      const semanticIndex = await this.createSemanticIndex(indexedElements);
      
      // Generate statistics
      const statistics = this.generateStatistics(indexedElements);
      
      const totalTime = Date.now() - startTime;
      
      const result: IndexingResult = {
        indexedElements,
        semanticIndex,
        statistics,
        performance: {
          totalTime,
          indexingTime: totalTime - aiClassificationTime,
          aiClassificationTime,
          screenshotTime: 0, // Would track screenshot time separately
          elementsPerSecond: indexedElements.length / (totalTime / 1000)
        }
      };
      
      this.logger.info(`Semantic indexing completed: ${indexedElements.length} elements indexed in ${totalTime}ms`);
      return result;
      
    } catch (error) {
      this.logger.error('Semantic element indexing failed:', error);
      throw error;
    }
  }

  async createBrowserUseStyleIndex(page: Page): Promise<string> {
    try {
      this.logger.info('Creating BrowserUse-style numbered element index');
      
      const indexingResult = await this.indexPageElements(page, {
        includeScreenshots: false,
        maxElements: 100,
        confidenceThreshold: 0.3
      });
      
      // Generate BrowserUse-style output
      let output = 'Interactive elements found on the page:\n\n';
      
      indexingResult.indexedElements.forEach((element, index) => {
        const boundingBox = element.element.boundingBox;
        const text = element.element.textContent?.substring(0, 50) || '';
        const tag = element.element.tagName;
        const id = element.element.id ? `#${element.element.id}` : '';
        const className = element.element.className ? `.${element.element.className.split(' ')[0]}` : '';
        
        output += `<click>${index}</click> ${tag}${id}${className} "${text}" <${boundingBox.x},${boundingBox.y},${boundingBox.width},${boundingBox.height}>\n`;
      });
      
      return output;
      
    } catch (error) {
      this.logger.error('Failed to create BrowserUse-style index:', error);
      return 'Error: Could not create element index';
    }
  }

  private async createIndexedElement(
    element: DOMElement, 
    index: number, 
    page: Page, 
    includeScreenshot: boolean = false
  ): Promise<IndexedElement> {
    try {
      // Classify element purpose using AI
      const purposeClassification = await this.domAnalyzer.classifyElementPurpose(element);
      
      // Determine element type
      const elementType = this.inferElementType(purposeClassification.purpose);
      
      // Generate context information
      const context = await this.generateElementContext(element, page);
      
      // Generate alternative selectors
      const selectors = await this.generateAlternativeSelectors(element);
      
      // Analyze accessibility
      const accessibility = await this.analyzeElementAccessibility(element);
      
      // Take screenshot if requested
      let screenshot: Buffer | undefined;
      if (includeScreenshot) {
        screenshot = await this.takeElementScreenshot(element, page);
      }
      
      return {
        index,
        element,
        purpose: purposeClassification.purpose,
        type: elementType,
        confidence: purposeClassification.confidence,
        context,
        selectors,
        relationships: { parent: -1, children: [], siblings: [], type: 'content' }, // Simplified for now
        screenshot,
        accessibility
      };
      
    } catch (error) {
      this.logger.error(`Failed to create indexed element ${index}:`, error);
      
      // Return fallback indexed element
      return {
        index,
        element,
        purpose: ElementPurpose.UNKNOWN,
        type: ElementType.EXTRACTABLE,
        confidence: 0.3,
        context: {
          description: 'Fallback element',
          parentContext: '',
          siblingContext: []
        },
        selectors: [],
        relationships: { parent: -1, children: [], siblings: [], type: 'content' },
        accessibility: {
          hasLabel: false,
          hasRole: false,
          keyboardAccessible: false,
          screenReaderFriendly: false,
          issues: ['Analysis failed']
        }
      };
    }
  }

  private async createSemanticIndex(indexedElements: IndexedElement[]): Promise<SemanticIndex> {
    const elements = new Map<number, SemanticElement>();
    const purposeGroups = new Map<ElementPurpose, SemanticElement[]>();
    const typeGroups = new Map<ElementType, SemanticElement[]>();
    const contextGroups = new Map<string, SemanticElement[]>();
    
    for (const indexedElement of indexedElements) {
      const semanticElement: SemanticElement = {
        index: indexedElement.index,
        domElement: indexedElement.element,
        purpose: indexedElement.purpose,
        confidence: indexedElement.confidence,
        context: indexedElement.context.description,
        alternatives: indexedElement.selectors
      };
      
      elements.set(indexedElement.index, semanticElement);
      
      // Group by purpose
      if (!purposeGroups.has(indexedElement.purpose)) {
        purposeGroups.set(indexedElement.purpose, []);
      }
      purposeGroups.get(indexedElement.purpose)!.push(semanticElement);
      
      // Group by type
      if (!typeGroups.has(indexedElement.type)) {
        typeGroups.set(indexedElement.type, []);
      }
      typeGroups.get(indexedElement.type)!.push(semanticElement);
      
      // Group by context
      const contextKey = indexedElement.context.description.substring(0, 20);
      if (!contextGroups.has(contextKey)) {
        contextGroups.set(contextKey, []);
      }
      contextGroups.get(contextKey)!.push(semanticElement);
    }
    
    return {
      elements,
      purposeGroups,
      typeGroups,
      contextGroups,
      relationships: [], // Would implement relationship analysis
      confidence: this.calculateOverallConfidence(indexedElements),
      indexTimestamp: new Date()
    };
  }

  private async generateElementContext(element: DOMElement, page: Page): Promise<ElementContext> {
    try {
      // Use AI to generate rich context description
      const prompt = `
Analyze this DOM element and provide contextual information:

Element: ${element.tagName}
ID: ${element.id || 'none'}
Class: ${element.className || 'none'}
Text: ${element.textContent?.substring(0, 100) || 'none'}
Attributes: ${JSON.stringify(element.attributes)}

Provide context in JSON format:
{
  "description": "Brief description of element's purpose and context",
  "parentContext": "Description of parent element context",
  "siblingContext": ["Context of related sibling elements"],
  "formContext": {
    "fieldType": "text|email|password|etc",
    "label": "Associated label text",
    "required": true,
    "validation": ["validation rules"]
  },
  "navigationContext": {
    "menuLevel": 1,
    "menuType": "main|sub|breadcrumb|pagination",
    "position": 1,
    "totalItems": 5
  },
  "contentContext": {
    "contentType": "heading|paragraph|list|table|media",
    "importance": 0.8,
    "extractable": true
  }
}`;

      const response = await this.aiProvider.generateCompletion(prompt, {
        temperature: 0.1,
        maxTokens: 500
      });

      const aiContext = JSON.parse(response);
      
      return {
        description: aiContext.description || `${element.tagName} element`,
        parentContext: aiContext.parentContext || '',
        siblingContext: aiContext.siblingContext || [],
        formContext: aiContext.formContext,
        navigationContext: aiContext.navigationContext,
        contentContext: aiContext.contentContext
      };
      
    } catch (error) {
      this.logger.error('Failed to generate element context:', error);
      return {
        description: `${element.tagName} element`,
        parentContext: '',
        siblingContext: []
      };
    }
  }

  private async generateAlternativeSelectors(element: DOMElement): Promise<AlternativeSelector[]> {
    const selectors: AlternativeSelector[] = [];
    
    // CSS selector based on ID (highest confidence)
    if (element.id) {
      selectors.push({
        type: 'css',
        value: `#${element.id}`,
        confidence: 0.95
      });
    }
    
    // CSS selector based on unique class combination
    if (element.className) {
      const classes = element.className.split(' ').filter(c => c.trim());
      if (classes.length > 0) {
        selectors.push({
          type: 'css',
          value: `.${classes.join('.')}`,
          confidence: 0.7
        });
        
        // Single class selector (lower confidence)
        selectors.push({
          type: 'css',
          value: `.${classes[0]}`,
          confidence: 0.5
        });
      }
    }
    
    // Text-based selector
    if (element.textContent && element.textContent.trim()) {
      const text = element.textContent.trim();
      selectors.push({
        type: 'text',
        value: text,
        confidence: text.length > 3 && text.length < 50 ? 0.8 : 0.6
      });
    }
    
    // Attribute-based selectors
    Object.entries(element.attributes).forEach(([attr, value]) => {
      if (['name', 'data-testid', 'data-test', 'aria-label'].includes(attr)) {
        selectors.push({
          type: 'css',
          value: `[${attr}="${value}"]`,
          confidence: attr === 'data-testid' ? 0.9 : 0.7
        });
      }
    });
    
    // Role-based selector
    if (element.attributes.role) {
      selectors.push({
        type: 'role',
        value: element.attributes.role,
        confidence: 0.8
      });
    }
    
    // XPath selector (fallback)
    selectors.push({
      type: 'xpath',
      value: this.generateXPath(element),
      confidence: 0.4
    });
    
    // Sort by confidence
    return selectors.sort((a, b) => b.confidence - a.confidence);
  }

  private async analyzeElementAccessibility(element: DOMElement): Promise<ElementAccessibility> {
    const issues: string[] = [];
    
    // Check for label
    const hasLabel = !!(
      element.attributes['aria-label'] ||
      element.attributes['aria-labelledby'] ||
      element.attributes.title
    );
    
    if (!hasLabel && ['input', 'textarea', 'select'].includes(element.tagName)) {
      issues.push('Missing label for form element');
    }
    
    // Check for role
    const hasRole = !!(element.attributes.role);
    
    // Check keyboard accessibility
    const keyboardAccessible = !!(
      ['a', 'button', 'input', 'textarea', 'select'].includes(element.tagName) ||
      element.attributes.tabindex !== undefined ||
      element.attributes.role === 'button'
    );
    
    if (element.isInteractable && !keyboardAccessible) {
      issues.push('Element not keyboard accessible');
    }
    
    // Basic screen reader friendliness
    const screenReaderFriendly = hasLabel || hasRole || !!element.textContent;
    
    return {
      hasLabel,
      hasRole,
      keyboardAccessible,
      screenReaderFriendly,
      issues
    };
  }

  private async takeElementScreenshot(element: DOMElement, page: Page): Promise<Buffer | undefined> {
    try {
      const boundingBox = element.boundingBox;
      if (boundingBox.width > 0 && boundingBox.height > 0) {
        return await page.screenshot({
          clip: {
            x: boundingBox.x,
            y: boundingBox.y,
            width: Math.min(boundingBox.width, 300),
            height: Math.min(boundingBox.height, 200)
          }
        });
      }
    } catch (error) {
      this.logger.error('Failed to take element screenshot:', error);
    }
    return undefined;
  }

  private inferElementType(purpose: ElementPurpose): ElementType {
    switch (purpose) {
      case ElementPurpose.BUTTON:
      case ElementPurpose.SUBMIT:
      case ElementPurpose.LINK:
        return ElementType.CLICKABLE;
      case ElementPurpose.INPUT:
        return ElementType.TYPEABLE;
      case ElementPurpose.FORM:
        return ElementType.SELECTABLE;
      case ElementPurpose.NAVIGATION:
        return ElementType.NAVIGATIONAL;
      case ElementPurpose.CONTENT:
      case ElementPurpose.SEARCH:
      default:
        return ElementType.EXTRACTABLE;
    }
  }

  private generateStatistics(indexedElements: IndexedElement[]): IndexingStatistics {
    const elementsByPurpose = new Map<ElementPurpose, number>();
    const elementsByType = new Map<ElementType, number>();
    let totalConfidence = 0;
    let accessibleCount = 0;
    
    indexedElements.forEach(element => {
      // Count by purpose
      const purposeCount = elementsByPurpose.get(element.purpose) || 0;
      elementsByPurpose.set(element.purpose, purposeCount + 1);
      
      // Count by type
      const typeCount = elementsByType.get(element.type) || 0;
      elementsByType.set(element.type, typeCount + 1);
      
      // Sum confidence
      totalConfidence += element.confidence;
      
      // Count accessible elements
      if (element.accessibility.hasLabel && element.accessibility.keyboardAccessible) {
        accessibleCount++;
      }
    });
    
    return {
      totalElements: indexedElements.length,
      indexedElements: indexedElements.length,
      elementsByPurpose,
      elementsByType,
      averageConfidence: indexedElements.length > 0 ? totalConfidence / indexedElements.length : 0,
      accessibilityScore: indexedElements.length > 0 ? (accessibleCount / indexedElements.length) * 100 : 0
    };
  }

  private calculateOverallConfidence(indexedElements: IndexedElement[]): number {
    if (indexedElements.length === 0) return 0;
    
    const totalConfidence = indexedElements.reduce((sum, element) => sum + element.confidence, 0);
    return totalConfidence / indexedElements.length;
  }

  private generateXPath(element: DOMElement): string {
    // Simple XPath generation - can be enhanced
    if (element.id) {
      return `//*[@id="${element.id}"]`;
    }
    
    if (element.className) {
      const firstClass = element.className.split(' ')[0];
      return `//${element.tagName.toLowerCase()}[@class="${firstClass}"]`;
    }
    
    return `//${element.tagName.toLowerCase()}`;
  }
}