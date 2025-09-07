import type { AIConfig, CompletionOptions, AIUsageStats } from '../../../shared/types.js';

export interface JSONSchema {
  type: string;
  properties?: Record<string, any>;
  required?: string[];
  [key: string]: any;
}

export abstract class AIProvider {
  abstract name: string;
  protected config: AIConfig | null = null;
  protected usageStats: AIUsageStats = {
    totalRequests: 0,
    totalTokens: 0,
    totalCost: 0,
    lastUsed: new Date()
  };

  abstract initialize(config: AIConfig): Promise<void>;
  abstract generateCompletion(prompt: string, options?: CompletionOptions): Promise<string>;
  abstract parseStructuredOutput<T>(prompt: string, schema: JSONSchema): Promise<T>;
  abstract isAvailable(): Promise<boolean>;

  getUsage(): AIUsageStats {
    return { ...this.usageStats };
  }

  protected updateUsage(tokens: number, cost: number = 0): void {
    this.usageStats.totalRequests++;
    this.usageStats.totalTokens += tokens;
    this.usageStats.totalCost += cost;
    this.usageStats.lastUsed = new Date();
  }

  protected validateConfig(config: AIConfig): void {
    if (!config.model) {
      throw new Error('AI model is required');
    }
  }
}