import OpenAI from 'openai';
import { 
  AIConfig, 
  CompletionOptions, 
  AIUsageStats 
} from '../../../shared/types.js';
import { Logger } from '../Logger.js';

export class OpenAIProvider {
  name = 'OpenAI';
  private client: OpenAI | null = null;
  private logger: Logger;
  private config: AIConfig | null = null;
  private usage: AIUsageStats;

  constructor() {
    this.logger = new Logger();
    this.usage = {
      totalRequests: 0,
      totalTokens: 0,
      totalCost: 0,
      lastUsed: new Date()
    };
  }

  async initialize(config: AIConfig): Promise<void> {
    try {
      if (!config.apiKey) {
        throw new Error('OpenAI API key is required');
      }

      this.client = new OpenAI({
        apiKey: config.apiKey,
        baseURL: config.baseUrl
      });

      this.config = config;
      this.logger.info('OpenAI provider initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize OpenAI provider:', error);
      throw error;
    }
  }

  async generateCompletion(prompt: string, options?: CompletionOptions): Promise<string> {
    if (!this.client || !this.config) {
      throw new Error('OpenAI provider not initialized');
    }

    try {
      const response = await this.client.chat.completions.create({
        model: this.config.model,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: options?.temperature ?? this.config.temperature ?? 0.1,
        max_tokens: options?.maxTokens ?? this.config.maxTokens ?? 4000,
        stop: options?.stop,
        stream: options?.stream ?? false
      });

      const completion = (response as any).choices?.[0]?.message?.content || '';
      
      // Update usage statistics
      this.updateUsage((response as any).usage);
      
      return completion;
    } catch (error) {
      this.logger.error('OpenAI completion failed:', error);
      throw error;
    }
  }

  async parseStructuredOutput<T>(prompt: string, schema: any): Promise<T> {
    if (!this.client || !this.config) {
      throw new Error('OpenAI provider not initialized');
    }

    try {
      // Use function calling for structured output
      const response = await this.client.chat.completions.create({
        model: this.config.model,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        functions: [
          {
            name: 'parse_output',
            description: 'Parse the output according to the provided schema',
            parameters: schema
          }
        ],
        function_call: { name: 'parse_output' },
        temperature: 0.1
      });

      const functionCall = response.choices[0]?.message?.function_call;
      
      if (functionCall?.arguments) {
        const parsed = JSON.parse(functionCall.arguments);
        this.updateUsage(response.usage);
        return parsed as T;
      }
      
      throw new Error('No structured output received');
    } catch (error) {
      this.logger.error('OpenAI structured parsing failed:', error);
      
      // Fallback to regular completion and JSON parsing
      const completion = await this.generateCompletion(prompt);
      try {
        return JSON.parse(completion) as T;
      } catch {
        throw new Error('Failed to parse structured output');
      }
    }
  }

  async isAvailable(): Promise<boolean> {
    if (!this.client) {
      return false;
    }

    try {
      // Test with a simple request
      await this.client.chat.completions.create({
        model: this.config?.model || 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: 'test' }],
        max_tokens: 1
      });
      
      return true;
    } catch (error) {
      this.logger.warn('OpenAI provider availability check failed:', error);
      return false;
    }
  }

  getUsage(): AIUsageStats {
    return { ...this.usage };
  }

  private updateUsage(usage: any): void {
    if (usage) {
      this.usage.totalRequests += 1;
      this.usage.totalTokens += usage.total_tokens || 0;
      this.usage.lastUsed = new Date();
      
      // Estimate cost (rough approximation)
      const inputTokens = usage.prompt_tokens || 0;
      const outputTokens = usage.completion_tokens || 0;
      
      // GPT-4 pricing (approximate)
      if (this.config?.model?.includes('gpt-4')) {
        this.usage.totalCost += (inputTokens * 0.00003) + (outputTokens * 0.00006);
      } else {
        // GPT-3.5 pricing (approximate)
        this.usage.totalCost += (inputTokens * 0.0000015) + (outputTokens * 0.000002);
      }
    }
  }
}