import { AIProvider } from './ai/AIProvider.js';
import { Logger } from './Logger.js';
import { TaskIntent, TaskUnderstanding, DataRequirement, TimeConstraint } from '../interfaces/ITaskPlanner.js';

export interface NLPConfig {
  confidenceThreshold: number;
  maxTokens: number;
  temperature: number;
  enableContextualUnderstanding: boolean;
  supportedLanguages: string[];
}

export interface IntentClassification {
  intent: TaskIntent;
  confidence: number;
  alternatives: AlternativeIntent[];
  reasoning: string;
}

export interface AlternativeIntent {
  intent: TaskIntent;
  confidence: number;
  reasoning: string;
}

export interface EntityExtraction {
  entities: ExtractedEntity[];
  confidence: number;
  context: string;
}

export interface ExtractedEntity {
  type: EntityType;
  value: string;
  confidence: number;
  position: { start: number; end: number };
  context: string;
}

export enum EntityType {
  LOCATION = 'location',
  DATE = 'date',
  TIME = 'time',
  PERSON = 'person',
  ORGANIZATION = 'organization',
  PRICE = 'price',
  QUANTITY = 'quantity',
  URL = 'url',
  EMAIL = 'email',
  PHONE = 'phone',
  FLIGHT_NUMBER = 'flight_number',
  HOTEL_NAME = 'hotel_name',
  AIRLINE = 'airline'
}

export interface ConstraintExtraction {
  constraints: ExtractedConstraint[];
  confidence: number;
}

export interface ExtractedConstraint {
  type: ConstraintType;
  value: string;
  priority: 'low' | 'medium' | 'high';
  confidence: number;
}

export enum ConstraintType {
  BUDGET = 'budget',
  TIME_LIMIT = 'time_limit',
  QUALITY = 'quality',
  PREFERENCE = 'preference',
  REQUIREMENT = 'requirement',
  RESTRICTION = 'restriction'
}

export interface ComplexityAssessment {
  complexity: 'simple' | 'medium' | 'complex';
  factors: ComplexityFactor[];
  estimatedSteps: number;
  confidence: number;
}

export interface ComplexityFactor {
  factor: string;
  impact: number;
  reasoning: string;
}

export class NaturalLanguageProcessor {
  private aiProvider: AIProvider;
  private logger: Logger;
  private config: NLPConfig;

  constructor(aiProvider: AIProvider, config?: Partial<NLPConfig>) {
    this.aiProvider = aiProvider;
    this.logger = new Logger();
    this.config = {
      confidenceThreshold: 0.7,
      maxTokens: 1000,
      temperature: 0.1,
      enableContextualUnderstanding: true,
      supportedLanguages: ['en', 'es', 'fr', 'de'],
      ...config
    };
  }

  async processNaturalLanguageTask(task: string, context?: string): Promise<TaskUnderstanding> {
    try {
      this.logger.info(`Processing natural language task: ${task.substring(0, 100)}...`);
      
      // Parallel processing of different NLP components
      const [intentResult, entityResult, constraintResult, complexityResult] = await Promise.all([
        this.classifyIntent(task, context),
        this.extractEntities(task),
        this.extractConstraints(task),
        this.assessComplexity(task)
      ]);

      // Combine results into comprehensive understanding
      const understanding: TaskUnderstanding = {
        intent: intentResult.intent,
        objectives: await this.extractObjectives(task, intentResult.intent),
        constraints: constraintResult.constraints.map(c => c.value),
        expectedOutcome: await this.determineExpectedOutcome(task, intentResult.intent),
        complexity: complexityResult.complexity,
        estimatedSteps: complexityResult.estimatedSteps,
        requiredSites: await this.identifyRequiredSites(task, intentResult.intent),
        dataRequirements: await this.extractDataRequirements(entityResult.entities),
        timeConstraints: await this.extractTimeConstraints(entityResult.entities)
      };

      this.logger.info(`Task understanding completed: ${understanding.intent.type} (${understanding.complexity})`);
      return understanding;
    } catch (error) {
      this.logger.error('Failed to process natural language task:', error);
      return this.createFallbackUnderstanding(task);
    }
  }

  async classifyIntent(task: string, context?: string): Promise<IntentClassification> {
    try {
      const prompt = this.createIntentClassificationPrompt(task, context);
      const response = await this.aiProvider.generateCompletion(prompt, {
        temperature: this.config.temperature,
        maxTokens: 400
      });

      const classification = JSON.parse(response);
      
      return {
        intent: {
          type: classification.intent?.type || 'search',
          description: classification.intent?.description || task,
          confidence: classification.intent?.confidence || 0.7,
          subIntents: classification.intent?.subIntents || []
        },
        confidence: classification.confidence || 0.7,
        alternatives: classification.alternatives || [],
        reasoning: classification.reasoning || 'AI-based intent classification'
      };
    } catch (error) {
      this.logger.error('Failed to classify intent:', error);
      return this.createFallbackIntentClassification(task);
    }
  }

  async extractEntities(task: string): Promise<EntityExtraction> {
    try {
      const prompt = this.createEntityExtractionPrompt(task);
      const response = await this.aiProvider.generateCompletion(prompt, {
        temperature: this.config.temperature,
        maxTokens: 600
      });

      const extraction = JSON.parse(response);
      
      return {
        entities: extraction.entities?.map((e: any) => ({
          type: e.type || EntityType.LOCATION,
          value: e.value || '',
          confidence: e.confidence || 0.7,
          position: e.position || { start: 0, end: 0 },
          context: e.context || ''
        })) || [],
        confidence: extraction.confidence || 0.7,
        context: extraction.context || task
      };
    } catch (error) {
      this.logger.error('Failed to extract entities:', error);
      return { entities: [], confidence: 0.5, context: task };
    }
  }

  async extractConstraints(task: string): Promise<ConstraintExtraction> {
    try {
      const prompt = this.createConstraintExtractionPrompt(task);
      const response = await this.aiProvider.generateCompletion(prompt, {
        temperature: this.config.temperature,
        maxTokens: 400
      });

      const extraction = JSON.parse(response);
      
      return {
        constraints: extraction.constraints?.map((c: any) => ({
          type: c.type || ConstraintType.REQUIREMENT,
          value: c.value || '',
          priority: c.priority || 'medium',
          confidence: c.confidence || 0.7
        })) || [],
        confidence: extraction.confidence || 0.7
      };
    } catch (error) {
      this.logger.error('Failed to extract constraints:', error);
      return { constraints: [], confidence: 0.5 };
    }
  }

  async assessComplexity(task: string): Promise<ComplexityAssessment> {
    try {
      const prompt = this.createComplexityAssessmentPrompt(task);
      const response = await this.aiProvider.generateCompletion(prompt, {
        temperature: this.config.temperature,
        maxTokens: 400
      });

      const assessment = JSON.parse(response);
      
      return {
        complexity: assessment.complexity || 'medium',
        factors: assessment.factors || [],
        estimatedSteps: assessment.estimatedSteps || 5,
        confidence: assessment.confidence || 0.7
      };
    } catch (error) {
      this.logger.error('Failed to assess complexity:', error);
      return {
        complexity: 'medium',
        factors: [],
        estimatedSteps: 5,
        confidence: 0.5
      };
    }
  }

  async extractObjectives(task: string, intent: TaskIntent): Promise<string[]> {
    try {
      const prompt = this.createObjectiveExtractionPrompt(task, intent);
      const response = await this.aiProvider.generateCompletion(prompt, {
        temperature: this.config.temperature,
        maxTokens: 300
      });

      const extraction = JSON.parse(response);
      return extraction.objectives || [task];
    } catch (error) {
      this.logger.error('Failed to extract objectives:', error);
      return [task];
    }
  }

  async determineExpectedOutcome(task: string, intent: TaskIntent): Promise<string> {
    try {
      const prompt = this.createOutcomeExtractionPrompt(task, intent);
      const response = await this.aiProvider.generateCompletion(prompt, {
        temperature: this.config.temperature,
        maxTokens: 200
      });

      const extraction = JSON.parse(response);
      return extraction.expectedOutcome || 'Complete the requested task';
    } catch (error) {
      this.logger.error('Failed to determine expected outcome:', error);
      return 'Complete the requested task';
    }
  }

  async identifyRequiredSites(task: string, intent: TaskIntent): Promise<string[]> {
    try {
      const prompt = this.createSiteIdentificationPrompt(task, intent);
      const response = await this.aiProvider.generateCompletion(prompt, {
        temperature: this.config.temperature,
        maxTokens: 300
      });

      const identification = JSON.parse(response);
      return identification.requiredSites || [];
    } catch (error) {
      this.logger.error('Failed to identify required sites:', error);
      return [];
    }
  }

  async extractDataRequirements(entities: ExtractedEntity[]): Promise<DataRequirement[]> {
    try {
      const requirements: DataRequirement[] = [];
      
      for (const entity of entities) {
        const requirement: DataRequirement = {
          type: this.entityToDataType(entity.type),
          name: entity.type,
          format: this.getDataFormat(entity.type),
          required: entity.confidence > 0.8,
          validation: this.getValidationRules(entity.type)
        };
        
        requirements.push(requirement);
      }
      
      return requirements;
    } catch (error) {
      this.logger.error('Failed to extract data requirements:', error);
      return [];
    }
  }

  async extractTimeConstraints(entities: ExtractedEntity[]): Promise<TimeConstraint[]> {
    try {
      const constraints: TimeConstraint[] = [];
      
      const dateEntities = entities.filter(e => e.type === EntityType.DATE || e.type === EntityType.TIME);
      
      for (const entity of dateEntities) {
        const constraint: TimeConstraint = {
          type: entity.type === EntityType.DATE ? 'deadline' : 'schedule',
          value: new Date(entity.value),
          flexibility: 'preferred'
        };
        
        constraints.push(constraint);
      }
      
      return constraints;
    } catch (error) {
      this.logger.error('Failed to extract time constraints:', error);
      return [];
    }
  }

  // Private helper methods
  private createFallbackUnderstanding(task: string): TaskUnderstanding {
    return {
      intent: {
        type: 'search',
        description: task,
        confidence: 0.5,
        subIntents: []
      },
      objectives: [task],
      constraints: [],
      expectedOutcome: 'Complete the requested task',
      complexity: 'medium',
      estimatedSteps: 3,
      requiredSites: [],
      dataRequirements: [],
      timeConstraints: []
    };
  }

  private createFallbackIntentClassification(task: string): IntentClassification {
    return {
      intent: {
        type: 'search',
        description: task,
        confidence: 0.5,
        subIntents: []
      },
      confidence: 0.5,
      alternatives: [],
      reasoning: 'Fallback classification due to processing error'
    };
  }

  private entityToDataType(entityType: EntityType): 'input' | 'output' | 'intermediate' {
    switch (entityType) {
      case EntityType.LOCATION:
      case EntityType.DATE:
      case EntityType.TIME:
        return 'input';
      case EntityType.PRICE:
      case EntityType.FLIGHT_NUMBER:
        return 'output';
      default:
        return 'intermediate';
    }
  }

  private getDataFormat(entityType: EntityType): string {
    switch (entityType) {
      case EntityType.DATE: return 'date';
      case EntityType.TIME: return 'time';
      case EntityType.PRICE: return 'currency';
      case EntityType.EMAIL: return 'email';
      case EntityType.PHONE: return 'phone';
      case EntityType.URL: return 'url';
      default: return 'string';
    }
  }

  private getValidationRules(entityType: EntityType): any[] {
    switch (entityType) {
      case EntityType.EMAIL:
        return [{ type: 'format', rule: 'email', message: 'Must be valid email' }];
      case EntityType.DATE:
        return [{ type: 'format', rule: 'date', message: 'Must be valid date' }];
      case EntityType.PRICE:
        return [{ type: 'range', rule: 'positive', message: 'Must be positive number' }];
      default:
        return [];
    }
  }

  // Prompt creation methods
  private createIntentClassificationPrompt(task: string, context?: string): string {
    return `
Classify the intent of this browser automation task.

Task: "${task}"
${context ? `Context: ${context}` : ''}

Analyze the task and classify the intent in JSON format:
{
  "intent": {
    "type": "search|form_fill|data_extract|navigate|monitor|research|comparison|booking",
    "description": "Clear description of the intent",
    "confidence": 0.9,
    "subIntents": [
      {
        "type": "flight_search",
        "description": "Search for flight options",
        "priority": 1,
        "dependencies": []
      }
    ]
  },
  "confidence": 0.9,
  "alternatives": [
    {
      "intent": {
        "type": "booking",
        "description": "Alternative interpretation",
        "confidence": 0.3,
        "subIntents": []
      },
      "confidence": 0.3,
      "reasoning": "Could also be interpreted as booking intent"
    }
  ],
  "reasoning": "Primary intent is flight search based on keywords and context"
}

Focus on:
- Travel-related intents (flight search, hotel booking, car rental)
- E-commerce intents (product search, price comparison, purchase)
- Research intents (information gathering, comparison)
- Form-filling intents (registration, application submission)`;
  }

  private createEntityExtractionPrompt(task: string): string {
    return `
Extract entities from this browser automation task.

Task: "${task}"

Extract entities in JSON format:
{
  "entities": [
    {
      "type": "location|date|time|person|organization|price|quantity|url|email|phone|flight_number|hotel_name|airline",
      "value": "New York",
      "confidence": 0.9,
      "position": {"start": 15, "end": 23},
      "context": "departure location"
    }
  ],
  "confidence": 0.8,
  "context": "Flight search task with specific locations and dates"
}

Focus on extracting:
- Locations (cities, airports, countries)
- Dates and times (departure, return, check-in)
- Prices and quantities (budget, number of passengers)
- Travel-specific entities (airlines, flight numbers, hotel names)
- Contact information (emails, phone numbers)`;
  }

  private createConstraintExtractionPrompt(task: string): string {
    return `
Extract constraints and requirements from this browser automation task.

Task: "${task}"

Extract constraints in JSON format:
{
  "constraints": [
    {
      "type": "budget|time_limit|quality|preference|requirement|restriction",
      "value": "under $500",
      "priority": "high",
      "confidence": 0.8
    }
  ],
  "confidence": 0.8
}

Look for:
- Budget constraints (price limits, cost preferences)
- Time constraints (deadlines, duration limits)
- Quality requirements (star ratings, amenities)
- Preferences (airline, hotel chain, seat type)
- Restrictions (non-stop flights, specific dates)`;
  }

  private createComplexityAssessmentPrompt(task: string): string {
    return `
Assess the complexity of this browser automation task.

Task: "${task}"

Provide complexity assessment in JSON format:
{
  "complexity": "simple|medium|complex",
  "factors": [
    {
      "factor": "Multiple site coordination",
      "impact": 0.3,
      "reasoning": "Task requires searching multiple flight booking sites"
    }
  ],
  "estimatedSteps": 7,
  "confidence": 0.8
}

Consider these complexity factors:
- Number of sites involved
- Form complexity
- Data processing requirements
- Conditional logic needs
- Error handling complexity
- Multi-step workflows`;
  }

  private createObjectiveExtractionPrompt(task: string, intent: TaskIntent): string {
    return `
Extract specific objectives from this task.

Task: "${task}"
Intent: ${intent.type} - ${intent.description}

Extract objectives in JSON format:
{
  "objectives": [
    "Find available flights",
    "Compare prices across airlines",
    "Extract flight details and pricing"
  ]
}

Break down the main task into specific, actionable objectives.`;
  }

  private createOutcomeExtractionPrompt(task: string, intent: TaskIntent): string {
    return `
Determine the expected outcome for this task.

Task: "${task}"
Intent: ${intent.type} - ${intent.description}

Provide expected outcome in JSON format:
{
  "expectedOutcome": "List of available flights with prices, times, and booking links"
}

Describe what the user expects to receive as the final result.`;
  }

  private createSiteIdentificationPrompt(task: string, intent: TaskIntent): string {
    return `
Identify required websites for this browser automation task.

Task: "${task}"
Intent: ${intent.type} - ${intent.description}

Identify sites in JSON format:
{
  "requiredSites": [
    "https://www.google.com/flights",
    "https://www.kayak.com",
    "https://www.expedia.com"
  ]
}

For flight searches, include major flight booking sites.
For hotel searches, include hotel booking platforms.
For general searches, include relevant specialized sites.`;
  }
}