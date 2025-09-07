import { safeStorage } from 'electron';
import { Logger } from './Logger.js';

export class SecureStorage {
  private logger: Logger;
  private isEncryptionAvailable: boolean;

  constructor() {
    this.logger = new Logger();
    this.isEncryptionAvailable = safeStorage.isEncryptionAvailable();
    
    if (!this.isEncryptionAvailable) {
      this.logger.warn('Encryption is not available on this system. Sensitive data will be stored in plain text.');
    }
  }

  /**
   * Securely store sensitive data like API keys
   */
  encryptData(plainText: string): Buffer {
    if (!this.isEncryptionAvailable) {
      this.logger.warn('Storing data without encryption');
      return Buffer.from(plainText, 'utf8');
    }

    try {
      return safeStorage.encryptString(plainText);
    } catch (error) {
      this.logger.error('Failed to encrypt data:', error);
      throw new Error('Failed to encrypt sensitive data');
    }
  }

  /**
   * Decrypt previously stored sensitive data
   */
  decryptData(encryptedData: Buffer): string {
    if (!this.isEncryptionAvailable) {
      return encryptedData.toString('utf8');
    }

    try {
      return safeStorage.decryptString(encryptedData);
    } catch (error) {
      this.logger.error('Failed to decrypt data:', error);
      throw new Error('Failed to decrypt sensitive data');
    }
  }

  /**
   * Validate that the input is safe to store
   */
  validateSensitiveData(data: string): boolean {
    // Check for reasonable length limits
    if (data.length > 10000) {
      throw new Error('Sensitive data exceeds maximum length');
    }

    // Check for potentially dangerous content
    const dangerousPatterns = [
      /<script/i,
      /javascript:/i,
      /data:text\/html/i,
      /vbscript:/i
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(data)) {
        throw new Error('Sensitive data contains potentially dangerous content');
      }
    }

    return true;
  }

  /**
   * Securely store API key or other sensitive configuration
   */
  storeAPIKey(provider: string, apiKey: string): Buffer {
    this.validateSensitiveData(apiKey);
    this.validateSensitiveData(provider);
    
    const data = JSON.stringify({
      provider,
      apiKey,
      timestamp: Date.now()
    });

    return this.encryptData(data);
  }

  /**
   * Retrieve and decrypt API key
   */
  retrieveAPIKey(encryptedData: Buffer): { provider: string; apiKey: string; timestamp: number } {
    const decryptedData = this.decryptData(encryptedData);
    
    try {
      const parsed = JSON.parse(decryptedData);
      
      // Validate the structure
      if (!parsed.provider || !parsed.apiKey || !parsed.timestamp) {
        throw new Error('Invalid API key data structure');
      }

      return parsed;
    } catch (error) {
      this.logger.error('Failed to parse API key data:', error);
      throw new Error('Invalid API key data');
    }
  }

  /**
   * Check if encryption is available on this system
   */
  isEncryptionSupported(): boolean {
    return this.isEncryptionAvailable;
  }

  /**
   * Securely clear sensitive data from memory
   */
  clearSensitiveData(buffer: Buffer): void {
    if (buffer && buffer.length > 0) {
      buffer.fill(0);
    }
  }
}