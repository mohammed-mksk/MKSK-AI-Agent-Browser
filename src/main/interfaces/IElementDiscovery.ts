import { Page } from 'puppeteer';
import { 
  ElementMap, 
  SemanticElement, 
  DOMElement, 
  ElementPurpose, 
  ElementType,
  BoundingBox,
  AlternativeSelector,
  ElementRelationship
} from './IReasoningEngine.js';

// Core element discovery interfaces
export interface IElementDiscovery {
  /**
   * Analyzes the page structure to understand layout and content organization
   */
  analyzePageStructure(page: Page): Promise<PageStructureAnalysis>;

  /**
   * Discovers interactive elements on the page based on user intent
   */
  discoverInteractiveElements(page: Page, intent: string): Promise<ElementMap>;

  /**
   * Creates a semantic index of elements with purpose understanding
   */
  createSemanticElementIndex(elements: DOMElement[]): Promise<SemanticIndex>;

  /**
   * Finds elements by their intended purpose and context
   */
  findElementsByPurpose(purpose: ElementPurpose, context: string, page: Page): Promise<TargetElement[]>;

  /**
   * Validates that an element is accessible and interactable
   */
  validateElementAccessibility(element: TargetElement, page: Page): Promise<AccessibilityCheck>;

  /**
   * Injects analysis scripts into the page for comprehensive DOM analysis
   */
  injectAnalysisScripts(page: Page): Promise<void>;

  /**
   * Extracts comprehensive element information from the page
   */
  extractElementInformation(page: Page): Promise<ExtractedElementInfo[]>;

  /**
   * Generates alternative selectors for robust element targeting
   */
  generateAlternativeSelectors(element: DOMElement, page: Page): Promise<AlternativeSelector[]>;
}

// Page structure analysis types
export interface PageStructureAnalysis {
  pageType: 'form' | 'search' | 'listing' | 'article' | 'navigation' | 'unknown';
  mainSections: PageSection[];
  interactiveAreas: InteractiveArea[];
  formStructures: FormStructure[];
  navigationElements: NavigationElement[];
  contentAreas: ContentArea[];
  confidence: number;
  analysisTimestamp: Date;
}

export interface PageSection {
  id: string;
  type: 'header' | 'main' | 'sidebar' | 'footer' | 'navigation' | 'content';
  boundingBox: BoundingBox;
  elements: number[];
  importance: number;
  description: string;
}

export interface InteractiveArea {
  id: string;
  type: 'form' | 'buttons' | 'links' | 'inputs' | 'controls';
  elements: TargetElement[];
  purpose: string;
  confidence: number;
  boundingBox: BoundingBox;
}

export interface FormStructure {
  id: string;
  formElement: TargetElement;
  fields: FormField[];
  submitButtons: TargetElement[];
  resetButtons: TargetElement[];
  validationRules: ValidationRule[];
  isMultiStep: boolean;
  currentStep?: number;
  totalSteps?: number;
}

export interface FormField {
  element: TargetElement;
  type: 'text' | 'email' | 'password' | 'number' | 'tel' | 'url' | 'search' | 'textarea' | 'select' | 'checkbox' | 'radio' | 'file' | 'date' | 'time';
  label?: string;
  placeholder?: string;
  required: boolean;
  validation: ValidationRule[];
  relatedElements: TargetElement[];
}

export interface ValidationRule {
  type: 'required' | 'pattern' | 'minLength' | 'maxLength' | 'min' | 'max' | 'email' | 'url' | 'custom';
  value?: any;
  message?: string;
}

export interface NavigationElement {
  element: TargetElement;
  type: 'menu' | 'breadcrumb' | 'pagination' | 'tabs' | 'accordion' | 'dropdown';
  items: NavigationItem[];
  isActive: boolean;
  level: number;
}

export interface NavigationItem {
  element: TargetElement;
  text: string;
  href?: string;
  isActive: boolean;
  hasSubmenu: boolean;
  submenuItems?: NavigationItem[];
}

export interface ContentArea {
  id: string;
  type: 'article' | 'list' | 'table' | 'card' | 'media' | 'text';
  boundingBox: BoundingBox;
  elements: TargetElement[];
  extractableData: ExtractableData[];
  importance: number;
}

export interface ExtractableData {
  type: 'text' | 'link' | 'image' | 'table' | 'list' | 'price' | 'date' | 'contact';
  selector: string;
  value: any;
  confidence: number;
  context: string;
}

// Semantic indexing types
export interface SemanticIndex {
  elements: Map<number, SemanticElement>;
  purposeGroups: Map<ElementPurpose, SemanticElement[]>;
  typeGroups: Map<ElementType, SemanticElement[]>;
  contextGroups: Map<string, SemanticElement[]>;
  relationships: ElementRelationship[];
  confidence: number;
  indexTimestamp: Date;
}

export interface TargetElement {
  index: number;
  element: DOMElement;
  selectors: AlternativeSelector[];
  purpose: ElementPurpose;
  context: string;
  confidence: number;
  isVisible: boolean;
  isInteractable: boolean;
  boundingBox: BoundingBox;
  screenshot?: Buffer;
  relatedElements: number[];
}

export interface AccessibilityCheck {
  isAccessible: boolean;
  score: number;
  issues: AccessibilityIssue[];
  recommendations: string[];
  ariaAttributes: AriaAttributes;
  keyboardAccessible: boolean;
  screenReaderFriendly: boolean;
}

export interface AccessibilityIssue {
  type: 'missing_label' | 'low_contrast' | 'no_keyboard_access' | 'missing_aria' | 'invalid_markup';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  element: string;
  suggestion: string;
}

export interface AriaAttributes {
  role?: string;
  label?: string;
  labelledBy?: string;
  describedBy?: string;
  expanded?: boolean;
  hidden?: boolean;
  live?: 'off' | 'polite' | 'assertive';
  atomic?: boolean;
  relevant?: string;
}

// Element extraction types
export interface ExtractedElementInfo {
  element: DOMElement;
  computedStyles: ComputedStyles;
  eventListeners: EventListener[];
  dataAttributes: Record<string, string>;
  semanticRole: string;
  interactionCapabilities: InteractionCapability[];
  visibility: VisibilityInfo;
  position: PositionInfo;
}

export interface ComputedStyles {
  display: string;
  visibility: string;
  opacity: string;
  position: string;
  zIndex: string;
  overflow: string;
  cursor: string;
  pointerEvents: string;
  userSelect: string;
  backgroundColor: string;
  color: string;
  fontSize: string;
  fontFamily: string;
  border: string;
  padding: string;
  margin: string;
}

export interface EventListener {
  type: string;
  capture: boolean;
  passive: boolean;
  once: boolean;
}

export interface InteractionCapability {
  type: 'click' | 'hover' | 'focus' | 'input' | 'select' | 'drag' | 'scroll';
  available: boolean;
  confidence: number;
  requirements: string[];
}

export interface VisibilityInfo {
  isVisible: boolean;
  isInViewport: boolean;
  isObscured: boolean;
  obscuredBy: string[];
  visibilityPercentage: number;
  computedVisibility: 'visible' | 'hidden' | 'collapse';
}

export interface PositionInfo {
  boundingBox: BoundingBox;
  offsetParent: string;
  scrollPosition: { x: number; y: number };
  isFixed: boolean;
  isSticky: boolean;
  zIndex: number;
  stackingContext: string;
}

// Element discovery configuration
export interface ElementDiscoveryConfig {
  maxElements: number;
  includeHidden: boolean;
  includeNonInteractive: boolean;
  confidenceThreshold: number;
  analysisDepth: 'shallow' | 'medium' | 'deep';
  enableScreenshots: boolean;
  enableAccessibilityCheck: boolean;
  customSelectors: string[];
  excludeSelectors: string[];
}

// Element discovery result
export interface ElementDiscoveryResult {
  elements: TargetElement[];
  pageStructure: PageStructureAnalysis;
  semanticIndex: SemanticIndex;
  statistics: DiscoveryStatistics;
  performance: DiscoveryPerformance;
  errors: DiscoveryError[];
}

export interface DiscoveryStatistics {
  totalElements: number;
  interactiveElements: number;
  visibleElements: number;
  accessibleElements: number;
  elementsByType: Map<ElementType, number>;
  elementsByPurpose: Map<ElementPurpose, number>;
  confidenceDistribution: { [key: string]: number };
}

export interface DiscoveryPerformance {
  totalTime: number;
  analysisTime: number;
  indexingTime: number;
  screenshotTime: number;
  memoryUsage: number;
  elementsPerSecond: number;
}

export interface DiscoveryError {
  type: 'script_injection' | 'element_analysis' | 'accessibility_check' | 'screenshot' | 'timeout';
  message: string;
  element?: string;
  timestamp: Date;
  severity: 'low' | 'medium' | 'high';
}