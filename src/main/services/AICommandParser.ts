/**
 * AI Command Parser Service
 * Created: July 30, 2025
 * 
 * Real AI integration for parsing natural language commands into automation plans
 */

import OpenAI from 'openai';
import { Logger } from './Logger.js';

export interface ParsedCommand {
  intent: {
    type: string;
    complexity: string;
    description: string;
  };
  parameters: Record<string, any>;
  confidence: number;
  websites: string[];
  steps: AutomationStep[];
}

export interface AutomationStep {
  action: string;
  target: string;
  value?: string;
  description: string;
}

export class AICommandParser {
  private logger: Logger;
  private openai: OpenAI | null = null;

  constructor() {
    this.logger = new Logger('AICommandParser');
    this.initializeAI();
  }

  private initializeAI(): void {
    const apiKey = process.env['OPENAI_API_KEY'];
    
    if (!apiKey) {
      this.logger.warn('OpenAI API key not found in environment variables');
      return;
    }

    try {
      this.openai = new OpenAI({
        apiKey: apiKey
      });
      this.logger.info('OpenAI client initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize OpenAI client:', error);
    }
  }

  async parseCommand(command: string): Promise<ParsedCommand> {
    this.logger.info('Parsing command with AI', { command });

    if (!this.openai) {
      this.logger.warn('OpenAI not available, using fallback parsing');
      return this.fallbackParsing(command);
    }

    try {
      const prompt = this.buildParsingPrompt(command);
      
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'You are an AI assistant that parses natural language commands into structured automation plans for web browser automation. Always respond with valid JSON.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 1000
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response content from OpenAI');
      }

      const parsed = JSON.parse(content);
      this.logger.info('Command parsed successfully by AI', { intent: parsed.intent?.type });
      
      return this.validateAndEnhanceParsedCommand(parsed, command);

    } catch (error) {
      this.logger.error('AI parsing failed, using fallback:', error);
      return this.fallbackParsing(command);
    }
  }

  private buildParsingPrompt(command: string): string {
    return `
Parse this natural language command into a structured automation plan:

Command: "${command}"

Please analyze the command and return a JSON object with this exact structure:
{
  "intent": {
    "type": "flight_search" | "bank_research" | "product_comparison" | "general_search" | "form_fill" | "data_extract",
    "complexity": "simple" | "medium" | "complex",
    "description": "Brief description of what the user wants to accomplish"
  },
  "parameters": {
    "query": "main search terms",
    "location": "if location-specific",
    "dateRange": "if dates mentioned",
    "criteria": "specific requirements or filters",
    "outputFormat": "table" | "list" | "summary"
  },
  "confidence": 0.0-1.0,
  "websites": ["array of relevant websites to search"],
  "steps": [
    {
      "action": "navigate" | "search" | "extract" | "compare",
      "target": "website or element description",
      "value": "search terms or data to input",
      "description": "what this step accomplishes"
    }
  ]
}

Guidelines:
- For flight searches: use flight booking sites like google.com/flights, kayak.com, skyscanner.com
- For bank research: use comparison sites like moneysavingexpert.com, which.co.uk, comparethemarket.com
- For product research: use comparison sites, manufacturer sites, review sites
- Include 3-5 specific automation steps
- Set confidence based on how clear the command is
- Choose complexity based on number of sites/comparisons needed
`;
  }

  private validateAndEnhanceParsedCommand(parsed: any, originalCommand: string): ParsedCommand {
    // Ensure all required fields exist with defaults
    const result: ParsedCommand = {
      intent: {
        type: parsed.intent?.type || 'general_search',
        complexity: parsed.intent?.complexity || 'medium',
        description: parsed.intent?.description || 'General web automation task'
      },
      parameters: parsed.parameters || { query: originalCommand },
      confidence: Math.min(Math.max(parsed.confidence || 0.7, 0), 1),
      websites: Array.isArray(parsed.websites) ? parsed.websites : this.getDefaultWebsites(parsed.intent?.type),
      steps: Array.isArray(parsed.steps) ? parsed.steps : this.generateDefaultSteps(originalCommand, parsed.intent?.type)
    };

    // Enhance with additional logic
    result.websites = this.enhanceWebsiteSelection(result.intent.type, result.parameters);
    
    return result;
  }

  private fallbackParsing(command: string): ParsedCommand {
    this.logger.info('Using fallback parsing for command', { command });

    // Simple keyword-based intent detection
    const lowerCommand = command.toLowerCase();
    let intentType = 'general_search';
    let websites: string[] = [];

    if (lowerCommand.includes('flight') || lowerCommand.includes('airline') || lowerCommand.includes('travel')) {
      intentType = 'flight_search';
      websites = ['https://google.com/flights', 'https://kayak.com', 'https://skyscanner.com'];
    } else if (lowerCommand.includes('bank') || lowerCommand.includes('account') || lowerCommand.includes('breakdown cover')) {
      intentType = 'bank_research';
      websites = ['https://moneysavingexpert.com', 'https://which.co.uk', 'https://comparethemarket.com'];
    } else if (lowerCommand.includes('product') || lowerCommand.includes('buy') || lowerCommand.includes('compare')) {
      intentType = 'product_comparison';
      websites = ['https://google.com', 'https://amazon.co.uk', 'https://which.co.uk'];
    } else {
      websites = ['https://google.com'];
    }

    return {
      intent: {
        type: intentType,
        complexity: 'medium',
        description: `Automated ${intentType.replace('_', ' ')} based on user command`
      },
      parameters: {
        query: command,
        outputFormat: 'table'
      },
      confidence: 0.6,
      websites,
      steps: this.generateDefaultSteps(command, intentType)
    };
  }

  private getDefaultWebsites(intentType: string): string[] {
    const websiteMap: Record<string, string[]> = {
      flight_search: ['https://google.com/flights', 'https://kayak.com'],
      bank_research: ['https://moneysavingexpert.com', 'https://which.co.uk'],
      product_comparison: ['https://google.com', 'https://which.co.uk'],
      general_search: ['https://google.com']
    };

    const mapped = (websiteMap as Record<string, string[]>)[intentType];
    return (mapped ?? websiteMap['general_search']) as string[];
  }

  private enhanceWebsiteSelection(intentType: string, _parameters: any): string[] {
    // Add logic to select the most appropriate websites based on intent and parameters
    const baseWebsites = this.getDefaultWebsites(intentType);
    
    // Could add more sophisticated logic here based on location, preferences, etc.
    return baseWebsites;
  }

  private generateDefaultSteps(command: string, intentType: string): AutomationStep[] {
    const baseSteps: AutomationStep[] = [
      {
        action: 'navigate',
        target: 'search website',
        description: 'Navigate to the primary search website'
      },
      {
        action: 'search',
        target: 'search box',
        value: command,
        description: `Search for: ${command}`
      },
      {
        action: 'extract',
        target: 'results',
        description: 'Extract relevant data from search results'
      }
    ];

    // Customize steps based on intent type
    if (intentType === 'bank_research') {
      baseSteps.push({
        action: 'compare',
        target: 'comparison table',
        description: 'Compare different bank account options'
      });
    } else if (intentType === 'flight_search') {
      baseSteps.push({
        action: 'extract',
        target: 'flight prices',
        description: 'Extract flight prices and details'
      });
    }

    return baseSteps;
  }
}
