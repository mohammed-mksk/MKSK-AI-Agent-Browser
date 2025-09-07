/**
 * Field Detection Type Definitions
 * Created: July 30, 2025
 * 
 * TypeScript interfaces for the field detection system
 */

export interface DetectedField {
  id: string;
  semantic: string;
  score: number;
  attributes: {
    name?: string;
    id?: string;
    type?: string;
    placeholder?: string;
    className?: string;
  };
  context: {
    label?: string;
    nearbyText?: string[];
    formContext?: string;
  };
  rect: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface FieldMapping {
  fieldId: string;
  originalType: string;
  correctedType: string;
  confidence: number;
  userValidated: boolean;
  dataValue?: string;
}

export interface DetectionStats {
  totalFields: number;
  identifiedFields: number;
  highConfidenceFields: number;
}

export interface FieldDetectionResponse {
  success: boolean;
  data?: {
    fields: DetectedField[];
    stats?: DetectionStats;
  };
  error?: string;
}

export interface FieldHighlightResponse {
  success: boolean;
  error?: string;
}

export interface FieldFillResponse {
  success: boolean;
  error?: string;
}

export interface FieldSuggestionsResponse {
  success: boolean;
  data?: string[];
  error?: string;
}

export interface DetectionLog {
  timestamp: number;
  event: string;
  data: any;
  level: 'info' | 'warning' | 'error' | 'success';
}

export interface PerformanceMetrics {
  detectionTime: number;
  fieldsPerSecond: number;
  averageConfidence: number;
  lastDetection: number;
}

export type SemanticFieldType = 
  | 'email'
  | 'password'
  | 'name'
  | 'departure'
  | 'destination'
  | 'phone'
  | 'address'
  | 'date'
  | 'search'
  | 'text'
  | 'number'
  | 'unknown';

export interface SemanticTypeConfig {
  [key: string]: {
    color: string;
    label: string;
    icon: string;
  };
}

export interface FieldDetectionPanelProps {
  onFieldsDetected?: (fields: DetectedField[]) => void;
  onFieldSelected?: (field: DetectedField) => void;
  onMappingChanged?: (mappings: Record<string, string>) => void;
}

export interface EnhancedFieldMappingInterfaceProps {
  detectedFields: DetectedField[];
  initialMappings?: Record<string, string>;
  onMappingChange?: (mappings: Record<string, FieldMapping>) => void;
  onFieldValidation?: (fieldId: string, isValid: boolean) => void;
  userData?: Record<string, string>;
}

export interface FieldDetectionDebugDashboardProps {
  detectedFields: DetectedField[];
  isEnabled: boolean;
  onToggle: (enabled: boolean) => void;
}
