import { EventEmitter } from 'events';
import { Logger } from './Logger.js';

export interface PrivacyRule {
  id: string;
  name: string;
  description: string;
  dataType: 'pii' | 'financial' | 'health' | 'credentials' | 'biometric' | 'location';
  sensitivity: 'low' | 'medium' | 'high' | 'critical';
  detect: (data: string) => boolean;
  mask: (data: string) => string;
}

export interface DataClassification {
  dataType: string;
  sensitivity: 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
  location: string;
  maskedValue: string;
}

export interface PrivacyContext {
  userId?: string;
  sessionId: string;
  dataSource: 'user_input' | 'extracted_data' | 'ai_reasoning' | 'page_content';
  consentLevel: 'none' | 'basic' | 'full';
  retentionPolicy: 'session' | 'temporary' | 'persistent' | 'none';
}

export interface ConsentRecord {
  userId: string;
  timestamp: number;
  consentType: 'data_collection' | 'data_processing' | 'data_storage' | 'data_sharing';
  granted: boolean;
  scope: string[];
  expiresAt?: number;
}

export class PrivacyProtectionSystem extends EventEmitter {
  private logger: Logger;
  private privacyRules: Map<string, PrivacyRule> = new Map();
  private consentRecords: Map<string, ConsentRecord[]> = new Map();
  private dataRetentionPolicies: Map<string, number> = new Map();
  private encryptionKey: string;

  constructor(encryptionKey?: string) {
    super();
    this.logger = new Logger();
    this.encryptionKey = encryptionKey || this.generateEncryptionKey();
    this.initializePrivacyRules();
    this.initializeRetentionPolicies();
  }

  private generateEncryptionKey(): string {
    return Buffer.from(Math.random().toString(36).substring(2, 15) + 
                      Math.random().toString(36).substring(2, 15)).toString('base64');
  }

  private initializePrivacyRules(): void {
    // Personal Identifiable Information (PII)
    this.addPrivacyRule({
      id: 'pii-email',
      name: 'Email Address Detection',
      description: 'Detects and masks email addresses',
      dataType: 'pii',
      sensitivity: 'medium',
      detect: (data: string) => {
        return /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/.test(data);
      },
      mask: (data: string) => {
        return data.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, 
          (match) => {
            const [local, domain] = match.split('@');
            return `${local.charAt(0)}***@${domain}`;
          });
      }
    });

    this.addPrivacyRule({
      id: 'pii-phone',
      name: 'Phone Number Detection',
      description: 'Detects and masks phone numbers',
      dataType: 'pii',
      sensitivity: 'medium',
      detect: (data: string) => {
        return /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/.test(data);
      },
      mask: (data: string) => {
        return data.replace(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, 'XXX-XXX-XXXX');
      }
    });

    // Financial Information
    this.addPrivacyRule({
      id: 'financial-credit-card',
      name: 'Credit Card Detection',
      description: 'Detects and masks credit card numbers',
      dataType: 'financial',
      sensitivity: 'critical',
      detect: (data: string) => {
        return /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/.test(data);
      },
      mask: (data: string) => {
        return data.replace(/\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g, 
          (match) => {
            const cleaned = match.replace(/[-\s]/g, '');
            return `****-****-****-${cleaned.slice(-4)}`;
          });
      }
    });

    this.addPrivacyRule({
      id: 'financial-ssn',
      name: 'Social Security Number Detection',
      description: 'Detects and masks SSN',
      dataType: 'financial',
      sensitivity: 'critical',
      detect: (data: string) => {
        return /\b\d{3}-\d{2}-\d{4}\b/.test(data);
      },
      mask: (data: string) => {
        return data.replace(/\b\d{3}-\d{2}-\d{4}\b/g, 'XXX-XX-XXXX');
      }
    });

    // Credentials
    this.addPrivacyRule({
      id: 'credentials-password',
      name: 'Password Detection',
      description: 'Detects and masks passwords',
      dataType: 'credentials',
      sensitivity: 'critical',
      detect: (data: string) => {
        return /password|passwd|pwd/i.test(data);
      },
      mask: (data: string) => {
        return data.replace(/(password|passwd|pwd)\s*[:=]\s*\S+/gi, '$1: [REDACTED]');
      }
    });

    this.addPrivacyRule({
      id: 'credentials-api-key',
      name: 'API Key Detection',
      description: 'Detects and masks API keys and tokens',
      dataType: 'credentials',
      sensitivity: 'critical',
      detect: (data: string) => {
        return /(api[_-]?key|token|secret|bearer)\s*[:=]\s*[a-zA-Z0-9_-]{20,}/i.test(data);
      },
      mask: (data: string) => {
        return data.replace(/(api[_-]?key|token|secret|bearer)\s*[:=]\s*[a-zA-Z0-9_-]{20,}/gi, 
          '$1: [REDACTED]');
      }
    });

    // Location Data
    this.addPrivacyRule({
      id: 'location-coordinates',
      name: 'GPS Coordinates Detection',
      description: 'Detects and masks GPS coordinates',
      dataType: 'location',
      sensitivity: 'high',
      detect: (data: string) => {
        return /[-+]?\d{1,3}\.\d+,\s*[-+]?\d{1,3}\.\d+/.test(data);
      },
      mask: (data: string) => {
        return data.replace(/[-+]?\d{1,3}\.\d+,\s*[-+]?\d{1,3}\.\d+/g, '[COORDINATES_REDACTED]');
      }
    });
  }

  private initializeRetentionPolicies(): void {
    // Set default retention periods (in milliseconds)
    this.dataRetentionPolicies.set('session', 0); // Delete immediately after session
    this.dataRetentionPolicies.set('temporary', 24 * 60 * 60 * 1000); // 24 hours
    this.dataRetentionPolicies.set('persistent', 30 * 24 * 60 * 60 * 1000); // 30 days
  }

  public addPrivacyRule(rule: PrivacyRule): void {
    this.privacyRules.set(rule.id, rule);
    this.logger.info(`Privacy rule added: ${rule.name}`);
  }

  public async classifyAndProtectData(
    data: string,
    context: PrivacyContext
  ): Promise<{
    originalData: string;
    protectedData: string;
    classifications: DataClassification[];
    requiresConsent: boolean;
  }> {
    const classifications: DataClassification[] = [];
    let protectedData = data;
    let requiresConsent = false;

    try {
      // Apply all privacy rules
      for (const rule of this.privacyRules.values()) {
        if (rule.detect(data)) {
          const classification: DataClassification = {
            dataType: rule.dataType,
            sensitivity: rule.sensitivity,
            confidence: 0.9, // Could be enhanced with ML confidence scoring
            location: context.dataSource,
            maskedValue: rule.mask(data)
          };

          classifications.push(classification);
          protectedData = rule.mask(protectedData);

          // Check if consent is required
          if (rule.sensitivity === 'critical' || rule.sensitivity === 'high') {
            requiresConsent = true;
          }
        }
      }

      // Log privacy protection action
      this.emit('dataProtected', {
        context,
        classifications,
        requiresConsent,
        timestamp: Date.now()
      });

      return {
        originalData: data,
        protectedData,
        classifications,
        requiresConsent
      };

    } catch (error) {
      this.logger.error('Data protection failed:', error);
      
      // Return safe default (fully masked)
      return {
        originalData: data,
        protectedData: '[DATA_PROTECTION_ERROR]',
        classifications: [],
        requiresConsent: true
      };
    }
  }

  public async recordConsent(
    userId: string,
    consentType: ConsentRecord['consentType'],
    granted: boolean,
    scope: string[],
    expiresAt?: number
  ): Promise<void> {
    const consentRecord: ConsentRecord = {
      userId,
      timestamp: Date.now(),
      consentType,
      granted,
      scope,
      expiresAt
    };

    if (!this.consentRecords.has(userId)) {
      this.consentRecords.set(userId, []);
    }

    this.consentRecords.get(userId)!.push(consentRecord);

    this.emit('consentRecorded', consentRecord);
    this.logger.info(`Consent recorded for user ${userId}: ${consentType} - ${granted ? 'granted' : 'denied'}`);
  }

  public hasValidConsent(
    userId: string,
    consentType: ConsentRecord['consentType'],
    scope?: string[]
  ): boolean {
    const userConsents = this.consentRecords.get(userId);
    if (!userConsents) return false;

    const relevantConsents = userConsents.filter(consent => 
      consent.consentType === consentType &&
      consent.granted &&
      (!consent.expiresAt || consent.expiresAt > Date.now())
    );

    if (relevantConsents.length === 0) return false;

    // Check scope if provided
    if (scope && scope.length > 0) {
      return relevantConsents.some(consent =>
        scope.every(requiredScope => consent.scope.includes(requiredScope))
      );
    }

    return true;
  }

  public async encryptSensitiveData(data: string): Promise<string> {
    try {
      // Simple encryption for demo - in production use proper encryption
      const encrypted = Buffer.from(data).toString('base64');
      return `ENC:${encrypted}`;
    } catch (error) {
      this.logger.error('Encryption failed:', error);
      return '[ENCRYPTION_FAILED]';
    }
  }

  public async decryptSensitiveData(encryptedData: string): Promise<string> {
    try {
      if (!encryptedData.startsWith('ENC:')) {
        return encryptedData; // Not encrypted
      }

      const encrypted = encryptedData.substring(4);
      return Buffer.from(encrypted, 'base64').toString();
    } catch (error) {
      this.logger.error('Decryption failed:', error);
      return '[DECRYPTION_FAILED]';
    }
  }

  public async anonymizeData(data: string): Promise<string> {
    let anonymized = data;

    // Apply all privacy rules for anonymization
    for (const rule of this.privacyRules.values()) {
      if (rule.detect(anonymized)) {
        anonymized = rule.mask(anonymized);
      }
    }

    // Additional anonymization techniques
    anonymized = anonymized
      .replace(/\b[A-Z][a-z]+ [A-Z][a-z]+\b/g, '[NAME]') // Names
      .replace(/\b\d{1,5}\s+\w+\s+(Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Lane|Ln|Boulevard|Blvd)\b/gi, '[ADDRESS]') // Addresses
      .replace(/\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}\b/gi, '[DATE]'); // Dates

    return anonymized;
  }

  public async scheduleDataDeletion(
    dataId: string,
    retentionPolicy: 'session' | 'temporary' | 'persistent'
  ): Promise<void> {
    const retentionPeriod = this.dataRetentionPolicies.get(retentionPolicy);
    if (retentionPeriod === undefined) {
      this.logger.warn(`Unknown retention policy: ${retentionPolicy}`);
      return;
    }

    if (retentionPeriod === 0) {
      // Delete immediately
      this.emit('dataDeleted', { dataId, reason: 'session_end' });
      return;
    }

    // Schedule deletion
    setTimeout(() => {
      this.emit('dataDeleted', { dataId, reason: 'retention_expired' });
      this.logger.info(`Data ${dataId} deleted due to retention policy: ${retentionPolicy}`);
    }, retentionPeriod);
  }

  public getPrivacyReport(userId?: string): {
    totalDataClassifications: number;
    sensitivityDistribution: Record<string, number>;
    consentStatus: Record<string, boolean>;
    dataRetentionSummary: Record<string, number>;
  } {
    // This would typically query a database
    // For now, return mock data based on current state
    
    const sensitivityDistribution: Record<string, number> = {};
    let totalDataClassifications = 0;

    // Count classifications by sensitivity (mock data)
    this.privacyRules.forEach(rule => {
      sensitivityDistribution[rule.sensitivity] = (sensitivityDistribution[rule.sensitivity] || 0) + 1;
      totalDataClassifications++;
    });

    const consentStatus: Record<string, boolean> = {};
    if (userId) {
      const userConsents = this.consentRecords.get(userId) || [];
      ['data_collection', 'data_processing', 'data_storage', 'data_sharing'].forEach(type => {
        consentStatus[type] = this.hasValidConsent(userId, type as ConsentRecord['consentType']);
      });
    }

    const dataRetentionSummary: Record<string, number> = {};
    this.dataRetentionPolicies.forEach((period, policy) => {
      dataRetentionSummary[policy] = period;
    });

    return {
      totalDataClassifications,
      sensitivityDistribution,
      consentStatus,
      dataRetentionSummary
    };
  }

  public async handleDataSubjectRequest(
    userId: string,
    requestType: 'access' | 'rectification' | 'erasure' | 'portability'
  ): Promise<{
    success: boolean;
    data?: any;
    message: string;
  }> {
    try {
      switch (requestType) {
        case 'access':
          const userData = {
            consents: this.consentRecords.get(userId) || [],
            privacyReport: this.getPrivacyReport(userId)
          };
          return {
            success: true,
            data: userData,
            message: 'User data access request fulfilled'
          };

        case 'erasure':
          this.consentRecords.delete(userId);
          this.emit('userDataErased', { userId, timestamp: Date.now() });
          return {
            success: true,
            message: 'User data erasure request fulfilled'
          };

        case 'rectification':
          return {
            success: true,
            message: 'Data rectification capabilities available through consent management'
          };

        case 'portability':
          const exportData = {
            consents: this.consentRecords.get(userId) || [],
            exportedAt: new Date().toISOString()
          };
          return {
            success: true,
            data: exportData,
            message: 'Data portability request fulfilled'
          };

        default:
          return {
            success: false,
            message: 'Unknown request type'
          };
      }
    } catch (error) {
      this.logger.error('Data subject request failed:', error);
      return {
        success: false,
        message: 'Request processing failed'
      };
    }
  }

  public async shutdown(): Promise<void> {
    this.removeAllListeners();
    this.logger.info('Privacy protection system shutdown');
  }
}