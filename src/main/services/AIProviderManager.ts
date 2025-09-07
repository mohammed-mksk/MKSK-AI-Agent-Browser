import { 
  AIConfig, 
  ParsedCommand, 
  AutomationIntent, 
  CommandParameters, 
  CompletionOptions,
  AIUsageStats 
} from '../../shared/types.js';
import { AI_PROVIDERS, AI_MODELS } from '../../shared/constants.js';
import { OpenAIProvider } from './ai/OpenAIProvider.js';
import { ClaudeProvider } from './ai/ClaudeProvider.js';
import { LocalModelProvider } from './ai/LocalModelProvider.js';
import { Logger } from './Logger.js';

interface AIProvider {
  name: string;
  initialize(config: AIConfig): Promise<void>;
  generateCompletion(prompt: string, options?: CompletionOptions): Promise<string>;
  parseStructuredOutput<T>(prompt: string, schema: any): Promise<T>;
  isAvailable(): Promise<boolean>;
  getUsage(): AIUsageStats;
}

export class AIProviderManager {
  private providers: Map<string, AIProvider> = new Map();
  private currentProvider: AIProvider | null = null;
  private logger: Logger;
  private defaultConfig: AIConfig;
  private secureStorage: any; // Will be injected
  private databaseService: any; // Will be injected

  constructor() {
    this.logger = new Logger();
    this.defaultConfig = {
      model: AI_MODELS.GPT_4,
      temperature: 0.1,
      maxTokens: 4000
    };
    
    this.initializeProviders();
  }

  setSecureStorage(secureStorage: any): void {
    this.secureStorage = secureStorage;
  }

  setDatabaseService(databaseService: any): void {
    this.databaseService = databaseService;
  }

  private initializeProviders(): void {
    // Register available providers
    this.providers.set(AI_PROVIDERS.OPENAI, new OpenAIProvider());
    this.providers.set(AI_PROVIDERS.ANTHROPIC, new ClaudeProvider());
    this.providers.set(AI_PROVIDERS.LOCAL, new LocalModelProvider());
  }

  async initialize(): Promise<void> {
    try {
      this.logger.info('Initializing AI Provider Manager...');
      
      // Check if dependencies are available
      if (!this.databaseService) {
        this.logger.warn('Database service not available during AI Provider Manager initialization');
      }
      if (!this.secureStorage) {
        this.logger.warn('Secure storage not available during AI Provider Manager initialization');
      }
      
      // Try to get stored AI provider preference
      let defaultProvider = AI_PROVIDERS.OPENAI;
      let storedProvider = null;
      let storedModel = null;
      
      if (this.databaseService) {
        try {
          storedProvider = await this.databaseService.getSetting('aiProvider');
          storedModel = await this.databaseService.getSetting('aiModel');
          this.logger.info(`Stored provider: ${storedProvider}, model: ${storedModel}`);
          if (storedProvider) {
            defaultProvider = storedProvider;
          }
        } catch (error) {
          this.logger.warn('Could not load stored AI provider settings:', error);
        }
      } else {
        this.logger.warn('Database service not available, cannot load stored provider settings');
      }
      
      // Try to get API key from environment or stored settings
      let apiKey = this.getApiKeyForProvider(defaultProvider);
      this.logger.info(`Environment API key for ${defaultProvider}: ${apiKey ? 'found' : 'not found'}`);
      
      // If no environment API key, try to get from secure storage
      if (!apiKey && this.databaseService && this.secureStorage) {
        try {
          const encryptedString = await this.databaseService.getSetting(`encrypted_api_key_${defaultProvider}`);
          this.logger.info(`Encrypted key for ${defaultProvider}: ${encryptedString ? 'found' : 'not found'}`);
          if (encryptedString) {
            // Convert base64 string back to Buffer
            const encryptedData = Buffer.from(encryptedString, 'base64');
            const decryptedData = this.secureStorage.retrieveAPIKey(encryptedData);
            apiKey = decryptedData.apiKey;
            this.logger.info(`Successfully loaded stored API key for ${defaultProvider}`);
          }
        } catch (error) {
          this.logger.warn(`Could not load stored API key for ${defaultProvider}:`, error);
        }
      } else if (!apiKey) {
        this.logger.warn(`No API key available for ${defaultProvider} - database: ${!!this.databaseService}, secure storage: ${!!this.secureStorage}`);
      }
      
      if (apiKey) {
        const model = storedModel || process.env['AI_MODEL'] || this.defaultConfig.model;
        await this.setProvider(defaultProvider, {
          ...this.defaultConfig,
          apiKey,
          model
        });
        this.logger.info(`AI Provider Manager initialized with ${defaultProvider} using stored settings`);
      } else {
        this.logger.info('AI Provider Manager initialized without default provider - API keys need to be configured');
      }
    } catch (error) {
      this.logger.error('Failed to initialize AI Provider Manager:', error);
    }
  }

  async setProvider(providerName: string, config: AIConfig): Promise<void> {
    const provider = this.providers.get(providerName);
    
    if (!provider) {
      throw new Error(`Unknown AI provider: ${providerName}`);
    }

    try {
      // If no API key provided in config, try to get it from secure storage
      if (!config.apiKey && this.secureStorage) {
        const storedKey = await this.getStoredApiKey(providerName);
        if (storedKey) {
          config.apiKey = storedKey;
        }
      }

      if (!config.apiKey) {
        throw new Error(`No API key available for provider: ${providerName}`);
      }

      await provider.initialize(config);
      
      if (await provider.isAvailable()) {
        this.currentProvider = provider;
        this.logger.info(`AI provider set to: ${providerName}`);
      } else {
        throw new Error(`Provider ${providerName} is not available`);
      }
    } catch (error) {
      this.logger.error(`Failed to set AI provider ${providerName}:`, error);
      throw error;
    }
  }

  private async getStoredApiKey(providerName: string): Promise<string | null> {
    try {
      if (!this.secureStorage || !this.databaseService) {
        return null;
      }

      const encryptedString = await this.databaseService.getSetting(`encrypted_api_key_${providerName}`);
      if (encryptedString) {
        // Convert base64 string back to Buffer
        const encryptedData = Buffer.from(encryptedString, 'base64');
        const decryptedData = this.secureStorage.retrieveAPIKey(encryptedData);
        return decryptedData.apiKey;
      }
      
      return null;
    } catch (error) {
      this.logger.error(`Failed to retrieve stored API key for ${providerName}:`, error);
      return null;
    }
  }

  async getAvailableProviders(): Promise<string[]> {
    const available: string[] = [];
    
    for (const [name, provider] of this.providers) {
      try {
        if (await provider.isAvailable()) {
          available.push(name);
        }
      } catch {
        // Provider not available
      }
    }
    
    return available;
  }

  async parseCommand(command: string): Promise<ParsedCommand> {
    if (!this.currentProvider) {
      throw new Error('No AI provider configured');
    }

    try {
      const prompt = this.createCommandParsingPrompt(command);
      console.log('=== DEBUG: AI PROMPT ===');
      console.log(prompt.substring(0, 500) + '...');
      
      const response = await this.currentProvider.generateCompletion(prompt);
      console.log('=== DEBUG: AI RESPONSE ===');
      console.log(response);
      
      const parsed = JSON.parse(response);
      console.log('=== DEBUG: PARSED RESULT ===');
      console.log(JSON.stringify(parsed, null, 2));
      
      const result = {
        intent: parsed.intent,
        parameters: parsed.parameters,
        confidence: parsed.confidence || 0.8,
        suggestedActions: parsed.suggestedActions || []
      };
      
      console.log('=== DEBUG: FINAL RESULT ===');
      console.log(`Suggested actions count: ${result.suggestedActions.length}`);
      
      return result;
    } catch (error) {
      this.logger.error('Failed to parse command:', error);
      console.log('=== DEBUG: FALLING BACK TO BASIC PARSING ===');
      
      // Fallback to basic parsing
      return this.fallbackCommandParsing(command);
    }
  }

  async generateCompletion(prompt: string, options?: CompletionOptions): Promise<string> {
    if (!this.currentProvider) {
      throw new Error('No AI provider configured');
    }

    return await this.currentProvider.generateCompletion(prompt, options);
  }

  private createCommandParsingPrompt(command: string): string {
    return `
You are an AI assistant that creates browser automation plans for web research and flight searches.

CRITICAL RULES:
1. ALWAYS generate suggestedActions - this is required for automation to work
2. For flight searches, use specialized flight booking sites
3. For general searches, use Google
4. Keep search queries as ONE SINGLE search term

Analyze this command and return a JSON response:
{
  "intent": {
    "type": "search" | "research",
    "description": "Brief description of the task",
    "complexity": "medium"
  },
  "parameters": {
    "searchTerms": ["SINGLE COMPLETE SEARCH QUERY"],
    "urls": ["specific URLs if flight search"]
  },
  "confidence": 0.85,
  "suggestedActions": [
    {
      "id": "1",
      "type": "navigate",
      "target": {"text": "COMPLETE_SEARCH_QUERY"},
      "value": "APPROPRIATE_URL_FOR_SEARCH",
      "timeout": 15000,
      "retryCount": 3
    },
    {
      "id": "2",
      "type": "extract", 
      "target": {"css": "h3, h2, .result"},
      "timeout": 10000,
      "retryCount": 3
    }
  ]
}

FLIGHT SEARCH DETECTION:
If the command mentions flights, airports, travel dates, or airline terms:
- Use flight booking sites: "https://www.google.com/flights", "https://www.kayak.com", "https://www.expedia.com"
- Set type to "search"
- Extract EXACT origin and destination from user input
- Include full flight details in searchTerms exactly as specified by user

IMPORTANT: Always use the EXACT airports/cities mentioned by the user, never substitute with examples.

EXAMPLES:
- For flight searches: Extract exact origin/destination from user command
- For research: Use the exact search terms provided by user
- Always preserve user's specific requirements and locations

Command: "${command}"

CRITICAL: You MUST include suggestedActions array with at least 2 actions.
Return ONLY valid JSON:`;
  }

  private fallbackCommandParsing(command: string): ParsedCommand {
    const lowerCommand = command.toLowerCase();
    
    // Simple keyword-based parsing as fallback
    let intent: AutomationIntent;
    let parameters: CommandParameters = {};
    
    if (lowerCommand.includes('search') || lowerCommand.includes('find')) {
      intent = {
        type: 'search',
        description: 'Search operation',
        complexity: 'simple'
      };
      
      // Extract search terms
      const words = command.split(' ').filter(word => 
        !['search', 'for', 'find', 'the', 'a', 'an'].includes(word.toLowerCase())
      );
      parameters.searchTerms = words;
      
    } else if (lowerCommand.includes('fill') || lowerCommand.includes('form')) {
      intent = {
        type: 'form_fill',
        description: 'Form filling operation',
        complexity: 'medium'
      };
      
    } else if (lowerCommand.includes('extract') || lowerCommand.includes('get data')) {
      intent = {
        type: 'data_extract',
        description: 'Data extraction operation',
        complexity: 'medium'
      };
      
    } else if (lowerCommand.includes('research') || lowerCommand.includes('analyze')) {
      intent = {
        type: 'research',
        description: 'Research operation',
        complexity: 'complex'
      };
      
    } else {
      intent = {
        type: 'navigate',
        description: 'Navigation operation',
        complexity: 'simple'
      };
    }
    
    // Extract URLs
    const urlRegex = /https?:\/\/[^\s]+/g;
    const urls = command.match(urlRegex);
    if (urls) {
      parameters.urls = urls;
    }
    
    return {
      intent,
      parameters,
      confidence: 0.6, // Lower confidence for fallback parsing
      suggestedActions: []
    };
  }

  private getApiKeyForProvider(provider: string): string | undefined {
    switch (provider) {
      case AI_PROVIDERS.OPENAI:
        return process.env['OPENAI_API_KEY'];
      case AI_PROVIDERS.ANTHROPIC:
        return process.env['ANTHROPIC_API_KEY'];
      default:
        return undefined;
    }
  }

  getCurrentProvider(): string | null {
    if (!this.currentProvider) return null;
    
    for (const [name, provider] of this.providers) {
      if (provider === this.currentProvider) {
        return name;
      }
    }
    
    return null;
  }

  /**
   * Reinitialize the AI provider (useful after API key is saved)
   */
  async reinitialize(): Promise<void> {
    this.logger.info('Reinitializing AI Provider Manager...');
    this.currentProvider = null;
    await this.initialize();
  }

  getUsageStats(): AIUsageStats | null {
    if (!this.currentProvider) return null;
    
    return this.currentProvider.getUsage();
  }

  async testProvider(providerName: string, config: AIConfig): Promise<boolean> {
    const provider = this.providers.get(providerName);
    
    if (!provider) {
      return false;
    }

    try {
      await provider.initialize(config);
      
      // Test with a simple completion
      const testResponse = await provider.generateCompletion(
        'Respond with "OK" if you can understand this message.',
        { maxTokens: 10 }
      );
      
      return testResponse.toLowerCase().includes('ok');
    } catch {
      return false;
    }
  }
}