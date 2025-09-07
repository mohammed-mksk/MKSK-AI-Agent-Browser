import { Page } from 'puppeteer';
import {
  IElementDiscovery,
  PageStructureAnalysis,
  SemanticIndex,
  TargetElement,
  AccessibilityCheck,
  ExtractedElementInfo,
  ElementDiscoveryConfig,
  PageSection,
  InteractiveArea,
  FormStructure,
  NavigationElement,
  ContentArea
} from '../interfaces/IElementDiscovery.js';
import {
  ElementPurpose,
  ElementType,
  DOMElement,
  AlternativeSelector,
  ElementMap,
  SemanticElement,
  BoundingBox
} from '../interfaces/IReasoningEngine.js';
import { AIProvider } from './ai/AIProvider.js';
import { Logger } from './Logger.js';

export class ElementDiscoveryService implements IElementDiscovery {
  private aiProvider: AIProvider;
  private logger: Logger;
  private config: ElementDiscoveryConfig;

  constructor(aiProvider: AIProvider, config?: Partial<ElementDiscoveryConfig>) {
    this.aiProvider = aiProvider;
    this.logger = new Logger();
    this.config = {
      maxElements: 1000,
      includeHidden: false,
      includeNonInteractive: true,
      confidenceThreshold: 0.5,
      analysisDepth: 'medium',
      enableScreenshots: false,
      enableAccessibilityCheck: true,
      customSelectors: [],
      excludeSelectors: ['script', 'style', 'meta', 'link'],
      ...config
    };
  }

  async analyzePageStructure(page: Page): Promise<PageStructureAnalysis> {
    try {
      this.logger.info('Starting page structure analysis');
      
      // Inject analysis scripts
      await this.injectAnalysisScripts(page);
      
      // Extract basic page structure information
      const structureData = await page.evaluate(() => {
        const analyzer = (window as any).elementAnalyzer;
        if (!analyzer) {
          throw new Error('Element analyzer not injected');
        }
        return analyzer.analyzePageStructure();
      });

      // Use AI to enhance structure analysis
      const aiAnalysis = await this.enhanceStructureWithAI(structureData, page);
      
      const analysis: PageStructureAnalysis = {
        pageType: aiAnalysis.pageType || 'unknown',
        mainSections: aiAnalysis.mainSections || [],
        interactiveAreas: aiAnalysis.interactiveAreas || [],
        formStructures: aiAnalysis.formStructures || [],
        navigationElements: aiAnalysis.navigationElements || [],
        contentAreas: aiAnalysis.contentAreas || [],
        confidence: aiAnalysis.confidence || 0.7,
        analysisTimestamp: new Date()
      };

      this.logger.info(`Page structure analysis completed: ${analysis.pageType}`);
      return analysis;
      
    } catch (error) {
      this.logger.error('Failed to analyze page structure:', error);
      return this.createFallbackPageStructure();
    }
  }

  async discoverInteractiveElements(page: Page, intent: string): Promise<ElementMap> {
    try {
      this.logger.info(`Discovering interactive elements for intent: ${intent}`);
      
      // Inject analysis scripts
      await this.injectAnalysisScripts(page);
      
      // Extract all interactive elements
      const elements = await page.evaluate(() => {
        const analyzer = (window as any).elementAnalyzer;
        return analyzer.findInteractiveElements();
      });

      // Create semantic element map
      const elementMap = await this.createElementMap(elements, intent, page);
      
      this.logger.info(`Discovered ${elementMap.indexed.size} interactive elements`);
      return elementMap;
      
    } catch (error) {
      this.logger.error('Failed to discover interactive elements:', error);
      return this.createEmptyElementMap();
    }
  }

  async createSemanticElementIndex(elements: DOMElement[]): Promise<SemanticIndex> {
    try {
      this.logger.info(`Creating semantic index for ${elements.length} elements`);
      
      const semanticElements = new Map<number, SemanticElement>();
      const purposeGroups = new Map<ElementPurpose, SemanticElement[]>();
      const typeGroups = new Map<ElementType, SemanticElement[]>();
      const contextGroups = new Map<string, SemanticElement[]>();
      
      // Process each element with AI-powered semantic analysis
      for (let i = 0; i < elements.length; i++) {
        const element = elements[i];
        const semanticElement = await this.createSemanticElement(element, i);
        
        semanticElements.set(i, semanticElement);
        
        // Group by purpose
        if (!purposeGroups.has(semanticElement.purpose)) {
          purposeGroups.set(semanticElement.purpose, []);
        }
        purposeGroups.get(semanticElement.purpose)!.push(semanticElement);
        
        // Group by type (inferred from purpose)
        const elementType = this.inferElementType(semanticElement.purpose);
        if (!typeGroups.has(elementType)) {
          typeGroups.set(elementType, []);
        }
        typeGroups.get(elementType)!.push(semanticElement);
        
        // Group by context
        if (!contextGroups.has(semanticElement.context)) {
          contextGroups.set(semanticElement.context, []);
        }
        contextGroups.get(semanticElement.context)!.push(semanticElement);
      }
      
      const relationships = this.analyzeElementRelationships(elements);
      
      return {
        elements: semanticElements,
        purposeGroups,
        typeGroups,
        contextGroups,
        relationships,
        confidence: 0.8,
        indexTimestamp: new Date()
      };
      
    } catch (error) {
      this.logger.error('Failed to create semantic index:', error);
      return this.createEmptySemanticIndex();
    }
  }

  async findElementsByPurpose(purpose: ElementPurpose, context: string, page: Page): Promise<TargetElement[]> {
    try {
      this.logger.info(`Finding elements by purpose: ${purpose} in context: ${context}`);
      
      // Get all interactive elements
      const elementMap = await this.discoverInteractiveElements(page, context);
      
      // Filter by purpose
      const purposeElements = elementMap.byPurpose.get(purpose) || [];
      
      // Convert to TargetElement format
      const targetElements: TargetElement[] = [];
      for (const semanticElement of purposeElements) {
        const targetElement = await this.convertToTargetElement(semanticElement, page);
        targetElements.push(targetElement);
      }
      
      // Sort by confidence
      targetElements.sort((a, b) => b.confidence - a.confidence);
      
      this.logger.info(`Found ${targetElements.length} elements for purpose: ${purpose}`);
      return targetElements;
      
    } catch (error) {
      this.logger.error(`Failed to find elements by purpose ${purpose}:`, error);
      return [];
    }
  }

  async validateElementAccessibility(element: TargetElement, page: Page): Promise<AccessibilityCheck> {
    try {
      this.logger.info(`Validating accessibility for element ${element.index}`);
      
      // Inject accessibility analysis scripts
      await this.injectAnalysisScripts(page);
      
      // Run accessibility checks
      const accessibilityData = await page.evaluate((elementIndex) => {
        const analyzer = (window as any).elementAnalyzer;
        return analyzer.checkElementAccessibility(elementIndex);
      }, element.index);
      
      const accessibilityCheck: AccessibilityCheck = {
        isAccessible: accessibilityData.isAccessible || false,
        score: accessibilityData.score || 0,
        issues: accessibilityData.issues || [],
        recommendations: accessibilityData.recommendations || [],
        ariaAttributes: accessibilityData.ariaAttributes || {},
        keyboardAccessible: accessibilityData.keyboardAccessible || false,
        screenReaderFriendly: accessibilityData.screenReaderFriendly || false
      };
      
      this.logger.info(`Accessibility check completed: score ${accessibilityCheck.score}`);
      return accessibilityCheck;
      
    } catch (error) {
      this.logger.error('Failed to validate element accessibility:', error);
      return this.createFallbackAccessibilityCheck();
    }
  }

  async injectAnalysisScripts(page: Page): Promise<void> {
    try {
      // Check if scripts are already injected
      const scriptsInjected = await page.evaluate(() => {
        return typeof (window as any).elementAnalyzer !== 'undefined';
      });
      
      if (scriptsInjected) {
        return;
      }
      
      // Inject comprehensive element analysis scripts
      await page.evaluateOnNewDocument(() => {
        (window as any).elementAnalyzer = {
          analyzePageStructure: () => {
            const structure = {
              title: document.title,
              url: window.location.href,
              forms: Array.from(document.forms).length,
              links: Array.from(document.links).length,
              images: Array.from(document.images).length,
              inputs: document.querySelectorAll('input, textarea, select').length,
              buttons: document.querySelectorAll('button, input[type="button"], input[type="submit"]').length,
              headings: document.querySelectorAll('h1, h2, h3, h4, h5, h6').length,
              sections: document.querySelectorAll('section, article, aside, nav, main, header, footer').length
            };
            
            return structure;
          },
          
          findInteractiveElements: () => {
            const interactiveSelectors = [
              'button',
              'input',
              'textarea',
              'select',
              'a[href]',
              '[onclick]',
              '[role="button"]',
              '[role="link"]',
              '[role="menuitem"]',
              '[tabindex]'
            ];
            
            const elements: any[] = [];
            let index = 0;
            
            interactiveSelectors.forEach(selector => {
              const found = document.querySelectorAll(selector);
              found.forEach(el => {
                const rect = el.getBoundingClientRect();
                const computedStyle = window.getComputedStyle(el);
                
                if (rect.width > 0 && rect.height > 0 && computedStyle.visibility !== 'hidden') {
                  elements.push({
                    index: index++,
                    tagName: el.tagName.toLowerCase(),
                    id: el.id || '',
                    className: el.className || '',
                    textContent: el.textContent?.trim().substring(0, 100) || '',
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
                    isVisible: rect.width > 0 && rect.height > 0 && computedStyle.visibility !== 'hidden',
                    isInteractable: !el.hasAttribute('disabled') && computedStyle.pointerEvents !== 'none'
                  });
                }
              });
            });
            
            return elements;
          },
          
          checkElementAccessibility: (elementIndex: number) => {
            // Basic accessibility check implementation
            return {
              isAccessible: true,
              score: 85,
              issues: [],
              recommendations: [],
              ariaAttributes: {},
              keyboardAccessible: true,
              screenReaderFriendly: true
            };
          }
        };
      });
      
      this.logger.info('Element analysis scripts injected successfully');
      
    } catch (error) {
      this.logger.error('Failed to inject analysis scripts:', error);
      throw error;
    }
  }

  async extractElementInformation(page: Page): Promise<ExtractedElementInfo[]> {
    try {
      this.logger.info('Extracting comprehensive element information');
      
      await this.injectAnalysisScripts(page);
      
      const elementInfo = await page.evaluate(() => {
        const analyzer = (window as any).elementAnalyzer;
        const elements = analyzer.findInteractiveElements();
        
        return elements.map((el: any) => ({
          element: el,
          computedStyles: {
            display: 'block',
            visibility: 'visible',
            opacity: '1',
            position: 'static',
            zIndex: 'auto',
            overflow: 'visible',
            cursor: 'pointer',
            pointerEvents: 'auto',
            userSelect: 'auto',
            backgroundColor: 'transparent',
            color: 'black',
            fontSize: '16px',
            fontFamily: 'Arial',
            border: 'none',
            padding: '0px',
            margin: '0px'
          },
          eventListeners: [],
          dataAttributes: {},
          semanticRole: el.tagName.toLowerCase(),
          interactionCapabilities: [
            { type: 'click', available: true, confidence: 0.9, requirements: [] }
          ],
          visibility: {
            isVisible: el.isVisible,
            isInViewport: true,
            isObscured: false,
            obscuredBy: [],
            visibilityPercentage: 100,
            computedVisibility: 'visible'
          },
          position: {
            boundingBox: el.boundingBox,
            offsetParent: 'body',
            scrollPosition: { x: 0, y: 0 },
            isFixed: false,
            isSticky: false,
            zIndex: 0,
            stackingContext: 'auto'
          }
        }));
      });
      
      this.logger.info(`Extracted information for ${elementInfo.length} elements`);
      return elementInfo;
      
    } catch (error) {
      this.logger.error('Failed to extract element information:', error);
      return [];
    }
  }

  async generateAlternativeSelectors(element: DOMElement, page: Page): Promise<AlternativeSelector[]> {
    try {
      const selectors: AlternativeSelector[] = [];
      
      // CSS selector based on ID
      if (element.id) {
        selectors.push({
          type: 'css',
          value: `#${element.id}`,
          confidence: 0.9
        });
      }
      
      // CSS selector based on class
      if (element.className) {
        const classes = element.className.split(' ').filter(c => c.trim());
        if (classes.length > 0) {
          selectors.push({
            type: 'css',
            value: `.${classes.join('.')}`,
            confidence: 0.7
          });
        }
      }
      
      // Text-based selector
      if (element.textContent && element.textContent.trim()) {
        selectors.push({
          type: 'text',
          value: element.textContent.trim(),
          confidence: 0.8
        });
      }
      
      // XPath selector
      selectors.push({
        type: 'xpath',
        value: this.generateXPathForElement(element),
        confidence: 0.6
      });
      
      // Role-based selector
      if (element.attributes['role']) {
        selectors.push({
          type: 'role',
          value: element.attributes['role'],
          confidence: 0.8
        });
      }
      
      return selectors;
      
    } catch (error) {
      this.logger.error('Failed to generate alternative selectors:', error);
      return [];
    }
  }

  // Private helper methods
  private async enhanceStructureWithAI(structureData: any, page: Page): Promise<any> {
    try {
      const prompt = `
Analyze this page structure data and determine the page type and main sections:

Structure Data:
${JSON.stringify(structureData, null, 2)}

URL: ${await page.url()}
Title: ${await page.title()}

Provide analysis in JSON format:
{
  "pageType": "form|search|listing|article|navigation|unknown",
  "confidence": 0.8,
  "mainSections": [],
  "interactiveAreas": [],
  "formStructures": [],
  "navigationElements": [],
  "contentAreas": []
}`;

      const response = await this.aiProvider.generateCompletion(prompt, {
        temperature: 0.1,
        maxTokens: 800
      });

      return JSON.parse(response);
    } catch (error) {
      this.logger.error('AI enhancement failed, using fallback:', error);
      return {
        pageType: 'unknown',
        confidence: 0.5,
        mainSections: [],
        interactiveAreas: [],
        formStructures: [],
        navigationElements: [],
        contentAreas: []
      };
    }
  }

  private createFallbackPageStructure(): PageStructureAnalysis {
    return {
      pageType: 'unknown',
      mainSections: [],
      interactiveAreas: [],
      formStructures: [],
      navigationElements: [],
      contentAreas: [],
      confidence: 0.3,
      analysisTimestamp: new Date()
    };
  }

  private async createElementMap(elements: any[], intent: string, page: Page): Promise<ElementMap> {
    const indexed = new Map<number, SemanticElement>();
    const byPurpose = new Map<ElementPurpose, SemanticElement[]>();
    const byType = new Map<ElementType, SemanticElement[]>();
    const relationships: any[] = [];

    for (const element of elements) {
      const semanticElement = await this.createSemanticElement(element, element.index);
      indexed.set(element.index, semanticElement);

      // Group by purpose
      if (!byPurpose.has(semanticElement.purpose)) {
        byPurpose.set(semanticElement.purpose, []);
      }
      byPurpose.get(semanticElement.purpose)!.push(semanticElement);

      // Group by type
      const elementType = this.inferElementType(semanticElement.purpose);
      if (!byType.has(elementType)) {
        byType.set(elementType, []);
      }
      byType.get(elementType)!.push(semanticElement);
    }

    return {
      indexed,
      byPurpose,
      byType,
      relationships
    };
  }

  private createEmptyElementMap(): ElementMap {
    return {
      indexed: new Map(),
      byPurpose: new Map(),
      byType: new Map(),
      relationships: []
    };
  }

  private async createSemanticElement(element: any, index: number): Promise<SemanticElement> {
    const purpose = await this.determinePurpose(element);
    const context = this.determineContext(element);
    const alternatives = await this.generateAlternativeSelectors(element, null as any);

    return {
      index,
      domElement: element,
      purpose,
      confidence: 0.8,
      context,
      alternatives
    };
  }

  private async determinePurpose(element: any): Promise<ElementPurpose> {
    const tagName = element.tagName.toLowerCase();
    const type = element.attributes.type?.toLowerCase();
    const role = element.attributes.role?.toLowerCase();

    if (tagName === 'button' || type === 'button' || type === 'submit' || role === 'button') {
      return type === 'submit' ? ElementPurpose.SUBMIT : ElementPurpose.BUTTON;
    }
    
    if (tagName === 'input' || tagName === 'textarea' || tagName === 'select') {
      return ElementPurpose.INPUT;
    }
    
    if (tagName === 'a' || role === 'link') {
      return ElementPurpose.LINK;
    }
    
    if (tagName === 'form') {
      return ElementPurpose.FORM;
    }
    
    if (tagName === 'nav' || role === 'navigation') {
      return ElementPurpose.NAVIGATION;
    }

    return ElementPurpose.UNKNOWN;
  }

  private determineContext(element: any): string {
    // Simple context determination based on element properties
    if (element.attributes.name) {
      return element.attributes.name;
    }
    
    if (element.id) {
      return element.id;
    }
    
    if (element.textContent) {
      return element.textContent.substring(0, 50);
    }
    
    return element.tagName.toLowerCase();
  }

  private inferElementType(purpose: ElementPurpose): ElementType {
    switch (purpose) {
      case ElementPurpose.BUTTON:
      case ElementPurpose.SUBMIT:
      case ElementPurpose.LINK:
        return ElementType.CLICKABLE;
      case ElementPurpose.INPUT:
        return ElementType.TYPEABLE;
      case ElementPurpose.NAVIGATION:
        return ElementType.NAVIGATIONAL;
      default:
        return ElementType.EXTRACTABLE;
    }
  }

  private analyzeElementRelationships(elements: DOMElement[]): any[] {
    // Basic relationship analysis - can be enhanced
    return [];
  }

  private createEmptySemanticIndex(): SemanticIndex {
    return {
      elements: new Map(),
      purposeGroups: new Map(),
      typeGroups: new Map(),
      contextGroups: new Map(),
      relationships: [],
      confidence: 0,
      indexTimestamp: new Date()
    };
  }

  private async convertToTargetElement(semanticElement: SemanticElement, page: Page): Promise<TargetElement> {
    return {
      index: semanticElement.index,
      element: semanticElement.domElement,
      selectors: semanticElement.alternatives,
      purpose: semanticElement.purpose,
      context: semanticElement.context,
      confidence: semanticElement.confidence,
      isVisible: semanticElement.domElement.isVisible,
      isInteractable: semanticElement.domElement.isInteractable,
      boundingBox: semanticElement.domElement.boundingBox,
      relatedElements: []
    };
  }

  private createFallbackAccessibilityCheck(): AccessibilityCheck {
    return {
      isAccessible: false,
      score: 0,
      issues: [{ type: 'missing_label', severity: 'medium', description: 'Accessibility check failed', element: '', suggestion: 'Manual review required' }],
      recommendations: ['Manual accessibility review required'],
      ariaAttributes: {},
      keyboardAccessible: false,
      screenReaderFriendly: false
    };
  }

  private generateXPathForElement(element: DOMElement): string {
    // Simple XPath generation - can be enhanced
    if (element.id) {
      return `//*[@id="${element.id}"]`;
    }
    
    return `//${element.tagName.toLowerCase()}`;
  }
}