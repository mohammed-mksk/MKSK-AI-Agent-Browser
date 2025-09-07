/**
 * Dynamic Field Detection Engine
 * Created: July 30, 2025
 * 
 * Replaces hardcoded selectors with intelligent field discovery
 * Similar to Manus.ai and Fellou field detection capabilities
 */

export interface DetectedField {
  id: string;
  element: HTMLElement;
  rect: DOMRect;
  attributes: FieldAttributes;
  context: FieldContext;
  semantic: SemanticType;
  score: number;
  visible: boolean;
}

export interface FieldAttributes {
  name?: string;
  id?: string;
  type?: string;
  placeholder?: string;
  ariaLabel?: string;
  className?: string;
  required?: boolean;
  disabled?: boolean;
}

export interface FieldContext {
  label?: string;
  nearbyText?: string[];
  formContext?: string;
  parentForm?: HTMLFormElement;
  position: {
    x: number;
    y: number;
    order: number;
  };
}

export type SemanticType = 
  | 'email' 
  | 'password' 
  | 'name' 
  | 'phone' 
  | 'address' 
  | 'date' 
  | 'search' 
  | 'departure' 
  | 'destination'
  | 'text'
  | 'number'
  | 'unknown';

export class DynamicFieldDetector {
  private fieldSelectors = [
    'input[type="text"]',
    'input[type="email"]',
    'input[type="password"]',
    'input[type="tel"]',
    'input[type="search"]',
    'input[type="url"]',
    'input[type="number"]',
    'input[type="date"]',
    'input[type="datetime-local"]',
    'input:not([type])',
    'textarea',
    'select',
    '[contenteditable="true"]',
    '[role="textbox"]',
    '[role="combobox"]'
  ];

  private semanticPatterns = {
    email: [/email/i, /e-mail/i, /mail/i, /@/],
    password: [/password/i, /pass/i, /pwd/i],
    name: [/name/i, /firstname/i, /lastname/i, /fullname/i],
    phone: [/phone/i, /tel/i, /mobile/i, /number/i],
    address: [/address/i, /street/i, /city/i, /postal/i, /zip/i],
    date: [/date/i, /birth/i, /dob/i, /when/i],
    search: [/search/i, /find/i, /query/i],
    departure: [/from/i, /departure/i, /origin/i, /depart/i, /leaving/i],
    destination: [/to/i, /destination/i, /arrival/i, /arrive/i, /going/i],
  };

  async detectAllFields(): Promise<DetectedField[]> {
    const fields: DetectedField[] = [];
    let fieldCounter = 0;

    for (const selector of this.fieldSelectors) {
      const elements = document.querySelectorAll(selector) as NodeListOf<HTMLElement>;
      
      elements.forEach((element) => {
        if (this.isVisible(element)) {
          const field = this.analyzeField(element, fieldCounter++);
          if (field) {
            fields.push(field);
          }
        }
      });
    }

    return this.rankFields(fields);
  }

  private isVisible(element: HTMLElement): boolean {
    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);
    
    return (
      rect.width > 0 &&
      rect.height > 0 &&
      style.display !== 'none' &&
      style.visibility !== 'hidden' &&
      style.opacity !== '0' &&
      element.offsetParent !== null
    );
  }

  private analyzeField(element: HTMLElement, order: number): DetectedField | null {
    const rect = element.getBoundingClientRect();
    const attributes = this.extractAttributes(element);
    const context = this.analyzeContext(element, order);
    const semantic = this.inferPurpose(element, attributes, context);
    const score = this.calculateFieldScore(element, attributes, context, semantic);

    return {
      id: this.generateFieldId(element, order),
      element,
      rect,
      attributes,
      context,
      semantic,
      score,
      visible: true
    };
  }

  private extractAttributes(element: HTMLElement): FieldAttributes {
    const input = element as HTMLInputElement;
    
    return {
      name: input.name || undefined,
      id: input.id || undefined,
      type: input.type || element.tagName.toLowerCase(),
      placeholder: input.placeholder || undefined,
      ariaLabel: element.getAttribute('aria-label') || undefined,
      className: element.className || undefined,
      required: input.required || false,
      disabled: input.disabled || false
    };
  }

  private analyzeContext(element: HTMLElement, order: number): FieldContext {
    const rect = element.getBoundingClientRect();
    
    return {
      label: this.findAssociatedLabel(element),
      nearbyText: this.getNearbyText(element),
      formContext: this.getFormContext(element),
      parentForm: element.closest('form') || undefined,
      position: {
        x: rect.left,
        y: rect.top,
        order
      }
    };
  }

  private findAssociatedLabel(element: HTMLElement): string | undefined {
    // Try label[for] association
    if (element.id) {
      const label = document.querySelector(`label[for="${element.id}"]`);
      if (label) return label.textContent?.trim();
    }

    // Try parent label
    const parentLabel = element.closest('label');
    if (parentLabel) {
      const clone = parentLabel.cloneNode(true) as HTMLElement;
      // Remove the input element from clone to get just label text
      const inputs = clone.querySelectorAll('input, textarea, select');
      inputs.forEach(input => input.remove());
      return clone.textContent?.trim();
    }

    // Try aria-labelledby
    const labelledBy = element.getAttribute('aria-labelledby');
    if (labelledBy) {
      const labelElement = document.getElementById(labelledBy);
      if (labelElement) return labelElement.textContent?.trim();
    }

    return undefined;
  }

  private getNearbyText(element: HTMLElement): string[] {
    const texts: string[] = [];
    const rect = element.getBoundingClientRect();
    const searchRadius = 100; // pixels

    // Find text nodes near the element
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      null,
      false
    );

    let node;
    while (node = walker.nextNode()) {
      const parent = node.parentElement;
      if (parent && parent !== element) {
        const parentRect = parent.getBoundingClientRect();
        const distance = Math.sqrt(
          Math.pow(parentRect.left - rect.left, 2) + 
          Math.pow(parentRect.top - rect.top, 2)
        );

        if (distance <= searchRadius) {
          const text = node.textContent?.trim();
          if (text && text.length > 2) {
            texts.push(text);
          }
        }
      }
    }

    return texts;
  }

  private getFormContext(element: HTMLElement): string | undefined {
    const form = element.closest('form');
    if (!form) return undefined;

    // Get form title or heading
    const heading = form.querySelector('h1, h2, h3, h4, h5, h6');
    if (heading) return heading.textContent?.trim();

    // Get form class or id as context
    return form.className || form.id || 'form';
  }

  private inferPurpose(
    element: HTMLElement, 
    attributes: FieldAttributes, 
    context: FieldContext
  ): SemanticType {
    const searchText = [
      attributes.name,
      attributes.id,
      attributes.placeholder,
      attributes.ariaLabel,
      context.label,
      ...context.nearbyText || []
    ].filter(Boolean).join(' ').toLowerCase();

    // Check input type first
    if (attributes.type === 'email') return 'email';
    if (attributes.type === 'password') return 'password';
    if (attributes.type === 'tel') return 'phone';
    if (attributes.type === 'date') return 'date';
    if (attributes.type === 'search') return 'search';
    if (attributes.type === 'number') return 'number';

    // Pattern matching
    for (const [semantic, patterns] of Object.entries(this.semanticPatterns)) {
      for (const pattern of patterns) {
        if (pattern.test(searchText)) {
          return semantic as SemanticType;
        }
      }
    }

    // Default based on element type
    if (element.tagName === 'TEXTAREA') return 'text';
    if (element.tagName === 'SELECT') return 'text';

    return 'unknown';
  }

  private calculateFieldScore(
    element: HTMLElement,
    attributes: FieldAttributes,
    context: FieldContext,
    semantic: SemanticType
  ): number {
    let score = 50; // Base score

    // Positive scoring factors
    if (context.label) score += 20;
    if (attributes.placeholder) score += 15;
    if (attributes.name) score += 10;
    if (attributes.id) score += 10;
    if (semantic !== 'unknown') score += 15;
    if (attributes.required) score += 5;

    // Negative scoring factors
    if (attributes.disabled) score -= 20;
    if (element.style.display === 'none') score -= 50;
    if (attributes.type === 'hidden') score -= 50;

    // Size-based scoring
    const rect = element.getBoundingClientRect();
    if (rect.width < 50 || rect.height < 20) score -= 10;

    return Math.max(0, Math.min(100, score));
  }

  private generateFieldId(element: HTMLElement, order: number): string {
    return `field_${element.tagName.toLowerCase()}_${order}_${Date.now()}`;
  }

  private rankFields(fields: DetectedField[]): DetectedField[] {
    return fields.sort((a, b) => {
      // Sort by score first
      if (b.score !== a.score) return b.score - a.score;
      
      // Then by semantic relevance
      const semanticPriority = {
        email: 10, password: 9, name: 8, departure: 7, destination: 6,
        phone: 5, address: 4, date: 3, search: 2, text: 1, unknown: 0
      };
      
      const aPriority = semanticPriority[a.semantic] || 0;
      const bPriority = semanticPriority[b.semantic] || 0;
      
      if (bPriority !== aPriority) return bPriority - aPriority;
      
      // Finally by position (top-left first)
      return (a.context.position.y - b.context.position.y) || 
             (a.context.position.x - b.context.position.x);
    });
  }

  getFieldById(fieldId: string): DetectedField | undefined {
    // This would need to store detected fields for retrieval
    return undefined;
  }
}
