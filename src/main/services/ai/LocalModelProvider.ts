import axios from 'axios';
import { 
  AIConfig, 
  CompletionOptions, 
  AIUsageStats 
} from '../../../shared/types.js';
import { Logger } from '../Logger.js';

export class LocalModelProvider {
  name = 'Local Model';
  private logger: Logger;
  private config: AIConfig | null = null;
  private usage: AIUsageStats;
  private baseUrl: string;

  constructor() {
    this.logger = new Logger();
    this.baseUrl = 'http://localhost:11434'; // Default Ollama URL
    this.usage = {
      totalRequests: 0,
      totalTokens: 0,
      totalCost: 0, // Local models are free
      lastUsed: new Date()
    };
  }

  async initialize(config: AIConfig): Promise<void> {
    try {
      this.config = config;
      this.baseUrl = config.baseUrl || this.baseUrl;
      
      // Test connection to local model server
      await this.testConnection();
      
      this.logger.info('Local model provider initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize local model provider:', error);
      throw error;
    }
  }

  async generateCompletion(prompt: string, options?: CompletionOptions): Promise<string> {
    if (!this.config) {
      throw new Error('Local model provider not initialized');
    }

    try {
      const response = await axios.post(`${this.baseUrl}/api/generate`, {
        model: this.config.model || 'llama2',
        prompt: prompt,
        stream: false,
        options: {
          temperature: options?.temperature ?? this.config.temperature ?? 0.1,
          num_predict: options?.maxTokens ?? this.config.maxTokens ?? 4000,
          stop: options?.stop
        }
      }, {
        timeout: 60000 // 60 second timeout for local models
      });

      const completion = response.data.response || '';
      
      // Update usage statistics
      this.updateUsage(response.data);
      
      return completion;
    } catch (error) {
      this.logger.error('Local model completion failed:', error);
      throw error;
    }
  }

  async parseStructuredOutput<T>(prompt: string, schema: any): Promise<T> {
    // Local models typically don't have structured output, so we use prompt engineering
    const structuredPrompt = `
${prompt}

Please respond with valid JSON only, following this schema:
${JSON.stringify(schema, null, 2)}

Important: Return ONLY the JSON object, no additional text or explanation.
`;

    try {
      const completion = await this.generateCompletion(structuredPrompt);
      
      // Try to extract JSON from the response
      const jsonMatch = completion.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? jsonMatch[0] : completion.trim();
      
      return JSON.parse(jsonStr) as T;
    } catch (error) {
      this.logger.error('Local model structured parsing failed:', error);
      throw new Error('Failed to parse structured output from local model');
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      await this.testConnection();
      return true;
    } catch (error) {
      this.logger.warn('Local model provider availability check failed:', error);
      return false;
    }
  }

  getUsage(): AIUsageStats {
    return { ...this.usage };
  }

  private async testConnection(): Promise<void> {
    try {
      // Test connection to Ollama server
      const response = await axios.get(`${this.baseUrl}/api/tags`, {
        timeout: 5000
      });
      
      if (response.status !== 200) {
        throw new Error('Local model server not responding');
      }
      
      // Check if the configured model is available
      if (this.config?.model) {
        const models = response.data.models || [];
        const modelExists = models.some((model: any) => 
          model.name === this.config?.model || 
          model.name.startsWith(this.config?.model + ':')
        );
        
        if (!modelExists) {
          this.logger.warn(`Model ${this.config.model} not found locally. Available models:`, 
            models.map((m: any) => m.name));
        }
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.code === 'ECONNREFUSED') {
          throw new Error('Local model server is not running. Please start Ollama or your local model server.');
        } else if (error.code === 'ETIMEDOUT') {
          throw new Error('Local model server connection timeout.');
        }
      }
      throw error;
    }
  }

  private updateUsage(responseData: any): void {
    this.usage.totalRequests += 1;
    this.usage.lastUsed = new Date();
    
    // Estimate token count (rough approximation)
    if (responseData.response) {
      const estimatedTokens = Math.ceil(responseData.response.length / 4);
      this.usage.totalTokens += estimatedTokens;
    }
    
    // Local models are free, so cost remains 0
  }

  // Additional methods specific to local models
  async listAvailableModels(): Promise<string[]> {
    try {
      const response = await axios.get(`${this.baseUrl}/api/tags`);
      const models = response.data.models || [];
      return models.map((model: any) => model.name);
    } catch (error) {
      this.logger.error('Failed to list available models:', error);
      return [];
    }
  }

  async pullModel(modelName: string): Promise<void> {
    try {
      this.logger.info(`Pulling model: ${modelName}`);
      
      const response = await axios.post(`${this.baseUrl}/api/pull`, {
        name: modelName
      }, {
        timeout: 300000 // 5 minute timeout for model pulling
      });
      
      if (response.status === 200) {
        this.logger.info(`Model ${modelName} pulled successfully`);
      }
    } catch (error) {
      this.logger.error(`Failed to pull model ${modelName}:`, error);
      throw error;
    }
  }

  async deleteModel(modelName: string): Promise<void> {
    try {
      await axios.delete(`${this.baseUrl}/api/delete`, {
        data: { name: modelName }
      });
      
      this.logger.info(`Model ${modelName} deleted successfully`);
    } catch (error) {
      this.logger.error(`Failed to delete model ${modelName}:`, error);
      throw error;
    }
  }
}