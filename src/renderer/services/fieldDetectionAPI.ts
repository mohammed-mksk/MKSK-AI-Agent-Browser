/**
 * Field Detection API Client
 * Created: July 30, 2025
 * 
 * Renderer process client for field detection operations
 * Communicates with main process via IPC
 */

import { DetectedField } from '../services/fieldDetection';

// Local interface for field statistics
export interface FieldStatistics {
  totalFields: number;
  identifiedFields: number;
  highConfidenceFields: number;
}

// Electron IPC API declarations
declare global {
  interface Window {
    electronAPI: {
      fieldDetection: {
        detect: () => Promise<FieldDetectionAPIResult>;
        highlight: (fields: DetectedField[]) => Promise<FieldDetectionAPIResult>;
        removeHighlights: () => Promise<FieldDetectionAPIResult>;
        fillField: (fieldId: string, value: string) => Promise<FieldFillAPIResult>;
        smartFill: (fieldData: Record<string, string>) => Promise<FieldDetectionAPIResult>;
        getSuggestions: (userData: Record<string, string>) => Promise<FieldDetectionAPIResult>;
        onUpdate: (callback: (data: any) => void) => void;
        onHighlightUpdate: (callback: (data: any) => void) => void;
      };
    };
  }
}

// API response types
export interface FieldDetectionAPIResult {
  success: boolean;
  data?: {
    fields: DetectedField[];
    stats: FieldStatistics;
  };
  error?: string;
}

export interface FieldFillAPIResult {
  success: boolean;
  data?: {
    fieldId: string;
    filled: boolean;
  };
  error?: string;
}

/**
 * Field Detection API Client
 * Provides typed interface to electron IPC field detection operations
 */
export class FieldDetectionAPI {
  private updateCallbacks: ((data: any) => void)[] = [];
  private highlightUpdateCallbacks: ((data: any) => void)[] = [];

  constructor() {
    // Register for updates if electronAPI is available
    if (window.electronAPI?.fieldDetection) {
      window.electronAPI.fieldDetection.onUpdate((data) => {
        this.updateCallbacks.forEach(callback => callback(data));
      });
      
      window.electronAPI.fieldDetection.onHighlightUpdate((data) => {
        this.highlightUpdateCallbacks.forEach(callback => callback(data));
      });
    }
  }

  /**
   * Detect all fields on the current page
   */
  async detectFields(): Promise<FieldDetectionAPIResult> {
    if (!window.electronAPI?.fieldDetection) {
      return {
        success: false,
        error: 'Electron API not available'
      };
    }

    try {
      return await window.electronAPI.fieldDetection.detect();
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Highlight specific fields on the page
   */
  async highlightFields(fields: DetectedField[]): Promise<FieldDetectionAPIResult> {
    if (!window.electronAPI?.fieldDetection) {
      return {
        success: false,
        error: 'Electron API not available'
      };
    }

    try {
      return await window.electronAPI.fieldDetection.highlight(fields);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Remove all field highlights
   */
  async removeHighlights(): Promise<FieldDetectionAPIResult> {
    if (!window.electronAPI?.fieldDetection) {
      return {
        success: false,
        error: 'Electron API not available'
      };
    }

    try {
      return await window.electronAPI.fieldDetection.removeHighlights();
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Fill a specific field with a value
   */
  async fillField(fieldId: string, value: string): Promise<FieldFillAPIResult> {
    if (!window.electronAPI?.fieldDetection) {
      return {
        success: false,
        error: 'Electron API not available'
      };
    }

    try {
      return await window.electronAPI.fieldDetection.fillField(fieldId, value);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Smart fill multiple fields based on semantic matching
   */
  async smartFill(fieldData: Record<string, string>): Promise<FieldDetectionAPIResult> {
    if (!window.electronAPI?.fieldDetection) {
      return {
        success: false,
        error: 'Electron API not available'
      };
    }

    try {
      return await window.electronAPI.fieldDetection.smartFill(fieldData);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get field suggestions based on user data
   */
  async getFieldSuggestions(userData: Record<string, string>): Promise<FieldDetectionAPIResult> {
    if (!window.electronAPI?.fieldDetection) {
      return {
        success: false,
        error: 'Electron API not available'
      };
    }

    try {
      return await window.electronAPI.fieldDetection.getSuggestions(userData);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Subscribe to field detection updates
   */
  onUpdate(callback: (data: any) => void): () => void {
    this.updateCallbacks.push(callback);
    
    // Return unsubscribe function
    return () => {
      const index = this.updateCallbacks.indexOf(callback);
      if (index > -1) {
        this.updateCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * Subscribe to field highlight updates
   */
  onHighlightUpdate(callback: (data: any) => void): () => void {
    this.highlightUpdateCallbacks.push(callback);
    
    // Return unsubscribe function
    return () => {
      const index = this.highlightUpdateCallbacks.indexOf(callback);
      if (index > -1) {
        this.highlightUpdateCallbacks.splice(index, 1);
      }
    };
  }
}

// Export singleton instance
export const fieldDetectionAPI = new FieldDetectionAPI();
