/**
 * Field Highlighting Engine
 * Created: July 30, 2025
 * 
 * Provides visual field highlighting similar to Manus.ai and Fellou
 * Color-coded overlays with semantic type indicators
 */

import { DetectedField, SemanticType } from './fieldDetection';

export interface HighlightStyle {
  borderColor: string;
  backgroundColor: string;
  shadowColor: string;
  labelColor: string;
  labelBackground: string;
}

export class FieldHighlighter {
  private highlightElements: Map<string, HTMLElement> = new Map();
  private isHighlighting = false;

  private semanticStyles: Record<SemanticType, HighlightStyle> = {
    email: {
      borderColor: '#3b82f6',
      backgroundColor: 'rgba(59, 130, 246, 0.1)',
      shadowColor: 'rgba(59, 130, 246, 0.5)',
      labelColor: 'white',
      labelBackground: '#3b82f6'
    },
    password: {
      borderColor: '#ef4444',
      backgroundColor: 'rgba(239, 68, 68, 0.1)',
      shadowColor: 'rgba(239, 68, 68, 0.5)',
      labelColor: 'white',
      labelBackground: '#ef4444'
    },
    name: {
      borderColor: '#10b981',
      backgroundColor: 'rgba(16, 185, 129, 0.1)',
      shadowColor: 'rgba(16, 185, 129, 0.5)',
      labelColor: 'white',
      labelBackground: '#10b981'
    },
    departure: {
      borderColor: '#f59e0b',
      backgroundColor: 'rgba(245, 158, 11, 0.1)',
      shadowColor: 'rgba(245, 158, 11, 0.5)',
      labelColor: 'white',
      labelBackground: '#f59e0b'
    },
    destination: {
      borderColor: '#8b5cf6',
      backgroundColor: 'rgba(139, 92, 246, 0.1)',
      shadowColor: 'rgba(139, 92, 246, 0.5)',
      labelColor: 'white',
      labelBackground: '#8b5cf6'
    },
    phone: {
      borderColor: '#06b6d4',
      backgroundColor: 'rgba(6, 182, 212, 0.1)',
      shadowColor: 'rgba(6, 182, 212, 0.5)',
      labelColor: 'white',
      labelBackground: '#06b6d4'
    },
    address: {
      borderColor: '#84cc16',
      backgroundColor: 'rgba(132, 204, 22, 0.1)',
      shadowColor: 'rgba(132, 204, 22, 0.5)',
      labelColor: 'white',
      labelBackground: '#84cc16'
    },
    date: {
      borderColor: '#f97316',
      backgroundColor: 'rgba(249, 115, 22, 0.1)',
      shadowColor: 'rgba(249, 115, 22, 0.5)',
      labelColor: 'white',
      labelBackground: '#f97316'
    },
    search: {
      borderColor: '#6366f1',
      backgroundColor: 'rgba(99, 102, 241, 0.1)',
      shadowColor: 'rgba(99, 102, 241, 0.5)',
      labelColor: 'white',
      labelBackground: '#6366f1'
    },
    text: {
      borderColor: '#64748b',
      backgroundColor: 'rgba(100, 116, 139, 0.1)',
      shadowColor: 'rgba(100, 116, 139, 0.5)',
      labelColor: 'white',
      labelBackground: '#64748b'
    },
    number: {
      borderColor: '#0ea5e9',
      backgroundColor: 'rgba(14, 165, 233, 0.1)',
      shadowColor: 'rgba(14, 165, 233, 0.5)',
      labelColor: 'white',
      labelBackground: '#0ea5e9'
    },
    unknown: {
      borderColor: '#9ca3af',
      backgroundColor: 'rgba(156, 163, 175, 0.1)',
      shadowColor: 'rgba(156, 163, 175, 0.5)',
      labelColor: 'white',
      labelBackground: '#9ca3af'
    }
  };

  highlightFields(fields: DetectedField[]): void {
    this.removeAllHighlights();
    this.isHighlighting = true;

    fields.forEach((field, index) => {
      this.createFieldHighlight(field, index);
    });

    // Add global styles if not already present
    this.ensureGlobalStyles();
  }

  private createFieldHighlight(field: DetectedField, index: number): void {
    const highlight = document.createElement('div');
    const style = this.semanticStyles[field.semantic];
    
    highlight.className = 'ai-field-highlight';
    highlight.dataset.fieldId = field.id;
    highlight.dataset.semantic = field.semantic;
    highlight.dataset.score = field.score.toString();

    // Position the highlight using the field's bounding rect
    const rect = field.rect;
    highlight.style.cssText = `
      position: fixed;
      z-index: 10000;
      left: ${rect.left}px;
      top: ${rect.top}px;
      width: ${rect.width}px;
      height: ${rect.height}px;
      border: 2px solid ${style.borderColor};
      background: ${style.backgroundColor};
      border-radius: 4px;
      pointer-events: none;
      transition: all 0.3s ease;
      box-shadow: 0 0 10px ${style.shadowColor};
      animation: fieldHighlightFadeIn 0.3s ease-out;
    `;

    // Create field type indicator
    const indicator = this.createFieldIndicator(field, style);
    highlight.appendChild(indicator);

    // Create field info tooltip
    const tooltip = this.createFieldTooltip(field);
    highlight.appendChild(tooltip);

    document.body.appendChild(highlight);
    this.highlightElements.set(field.id, highlight);

    // Add interaction handlers
    this.addHighlightInteractions(highlight, field);
  }

  private createFieldIndicator(field: DetectedField, style: HighlightStyle): HTMLElement {
    const indicator = document.createElement('div');
    indicator.className = 'ai-field-indicator';
    
    const displayText = this.getDisplayText(field);
    indicator.textContent = displayText;
    
    indicator.style.cssText = `
      position: absolute;
      top: -28px;
      left: 0;
      background: ${style.labelBackground};
      color: ${style.labelColor};
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 600;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      white-space: nowrap;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
      z-index: 10001;
    `;

    return indicator;
  }

  private createFieldTooltip(field: DetectedField): HTMLElement {
    const tooltip = document.createElement('div');
    tooltip.className = 'ai-field-tooltip';
    tooltip.style.cssText = `
      position: absolute;
      top: 100%;
      left: 0;
      background: rgba(0, 0, 0, 0.9);
      color: white;
      padding: 8px 12px;
      border-radius: 6px;
      font-size: 11px;
      font-family: monospace;
      white-space: nowrap;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.2s ease;
      z-index: 10002;
      max-width: 300px;
    `;

    const info = [
      `Type: ${field.semantic}`,
      `Score: ${field.score}`,
      field.context.label ? `Label: ${field.context.label}` : null,
      field.attributes.placeholder ? `Placeholder: ${field.attributes.placeholder}` : null,
      field.attributes.name ? `Name: ${field.attributes.name}` : null
    ].filter(Boolean);

    tooltip.innerHTML = info.join('<br>');
    return tooltip;
  }

  private getDisplayText(field: DetectedField): string {
    const semanticLabels = {
      email: '📧 Email',
      password: '🔒 Password',
      name: '👤 Name',
      phone: '📞 Phone',
      address: '🏠 Address',
      date: '📅 Date',
      search: '🔍 Search',
      departure: '🛫 From',
      destination: '🛬 To',
      text: '📝 Text',
      number: '🔢 Number',
      unknown: '❓ Field'
    };

    return semanticLabels[field.semantic] || '❓ Field';
  }

  private addHighlightInteractions(highlight: HTMLElement, field: DetectedField): void {
    highlight.addEventListener('mouseenter', () => {
      const tooltip = highlight.querySelector('.ai-field-tooltip') as HTMLElement;
      if (tooltip) {
        tooltip.style.opacity = '1';
      }
      
      // Enhance highlight on hover
      highlight.style.transform = 'scale(1.02)';
      highlight.style.zIndex = '10003';
    });

    highlight.addEventListener('mouseleave', () => {
      const tooltip = highlight.querySelector('.ai-field-tooltip') as HTMLElement;
      if (tooltip) {
        tooltip.style.opacity = '0';
      }
      
      highlight.style.transform = 'scale(1)';
      highlight.style.zIndex = '10000';
    });

    highlight.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.selectField(field);
    });
  }

  private selectField(field: DetectedField): void {
    // Focus the actual field
    field.element.focus();
    
    // Dispatch custom event for field selection
    const event = new CustomEvent('fieldSelected', {
      detail: { field }
    });
    document.dispatchEvent(event);

    // Visual feedback
    const highlight = this.highlightElements.get(field.id);
    if (highlight) {
      highlight.style.animation = 'fieldSelected 0.6s ease-out';
    }
  }

  removeAllHighlights(): void {
    this.highlightElements.forEach((element) => {
      element.remove();
    });
    this.highlightElements.clear();
    this.isHighlighting = false;
  }

  removeFieldHighlight(fieldId: string): void {
    const element = this.highlightElements.get(fieldId);
    if (element) {
      element.remove();
      this.highlightElements.delete(fieldId);
    }
  }

  updateFieldHighlight(field: DetectedField): void {
    this.removeFieldHighlight(field.id);
    this.createFieldHighlight(field, 0);
  }

  private ensureGlobalStyles(): void {
    if (document.getElementById('ai-field-highlight-styles')) return;

    const style = document.createElement('style');
    style.id = 'ai-field-highlight-styles';
    style.textContent = `
      @keyframes fieldHighlightFadeIn {
        from {
          opacity: 0;
          transform: scale(0.95);
        }
        to {
          opacity: 1;
          transform: scale(1);
        }
      }

      @keyframes fieldSelected {
        0%, 100% {
          transform: scale(1);
        }
        50% {
          transform: scale(1.05);
        }
      }

      .ai-field-highlight {
        cursor: pointer;
      }

      .ai-field-highlight:hover {
        filter: brightness(1.1);
      }

      .ai-field-indicator {
        user-select: none;
      }

      .ai-field-tooltip {
        user-select: none;
        line-height: 1.4;
      }
    `;

    document.head.appendChild(style);
  }

  isHighlightingActive(): boolean {
    return this.isHighlighting;
  }

  getHighlightedFields(): DetectedField[] {
    const fields: DetectedField[] = [];
    this.highlightElements.forEach((element, fieldId) => {
      // Would need to store field data or retrieve from DOM
      // This is a simplified version
    });
    return fields;
  }
}
