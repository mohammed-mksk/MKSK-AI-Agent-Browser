import Anthropic from '@anthropic-ai/sdk';
import { 
  AIConfig, 
  CompletionOptions, 
  AIUsageStats 
} from '../../../shared/types.js';
import { Logger } from '../Logger.js';

export class ClaudeProvider {
  name = 'Claude';
  private client: Anthropic | null = null;
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
        throw new Error('Anthropic API key is required');
      }

      this.client = new Anthropic({
        apiKey: config.apiKey,
        baseURL: config.baseUrl
      });

      this.config = config;
      this.logger.info('Claude provider initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize Claude provider:', error);
      throw error;
    }
  }

  async generateCompletion(prompt: string, options?: CompletionOptions): Promise<string> {
    if (!this.client || !this.config) {
      throw new Error('Claude provider not initialized');
    }

    try {
      const response = await this.client.messages.create({
        model: this.config.model,
        max_tokens: options?.maxTokens ?? this.config.maxTokens ?? 4000,
        temperature: options?.temperature ?? this.config.temperature ?? 0.1,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      });

      const completion = response.content[0]?.type === 'text' 
        ? response.content[0].text 
        : '';
      
      // Update usage statistics
      this.updateUsage(response.usage);
      
      return completion;
    } catch (error) {
      this.logger.error('Claude completion failed:', error);
      throw error;
    }
  }

  async parseStructuredOutput<T>(prompt: string, schema: any): Promise<T> {
    // Claude doesn't have function calling like OpenAI, so we'll use prompt engineering
    const structuredPrompt = `
${prompt}

Please respond with valid JSON only, following this schema:
${JSON.stringify(schema, null, 2)}

Do not include any text before or after the JSON response.
`;

    try {
      const completion = await this.generateCompletion(structuredPrompt);
      
      // Try to extract JSON from the response
      const jsonMatch = completion.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? jsonMatch[0] : completion;
      
      return JSON.parse(jsonStr) as T;
    } catch (error) {
      this.logger.error('Claude structured parsing failed:', error);
      throw new Error('Failed to parse structured output from Claude');
    }
  }

  async isAvailable(): Promise<boolean> {
    if (!this.client) {
      return false;
    }

    try {
      // Test with a simple request
      await this.client.messages.create({
        model: this.config?.model || 'claude-3-haiku-20240307',
        max_tokens: 1,
        messages: [{ role: 'user', content: 'test' }]
      });
      
      return true;
    } catch (error) {
      this.logger.warn('Claude provider availability check failed:', error);
      return false;
    }
  }

  getUsage(): AIUsageStats {
    return { ...this.usage };
  }

  private updateUsage(usage: any): void {
    if (usage) {
      this.usage.totalRequests += 1;
      this.usage.totalTokens += usage.input_tokens + usage.output_tokens || 0;
      this.usage.lastUsed = new Date();
      
      // Estimate cost (rough approximation for Claude 3)
      const inputTokens = usage.input_tokens || 0;
      const outputTokens = usage.output_tokens || 0;
      
      // Claude 3 pricing varies by model
      if (this.config?.model?.includes('opus')) {
        this.usage.totalCost += (inputTokens * 0.000015) + (outputTokens * 0.000075);
      } else if (this.config?.model?.includes('sonnet')) {
        this.usage.totalCost += (inputTokens * 0.000003) + (outputTokens * 0.000015);
      } else {
        // Haiku pricing
        this.usage.totalCost += (inputTokens * 0.00000025) + (outputTokens * 0.00000125);
      }
    }
  }
}