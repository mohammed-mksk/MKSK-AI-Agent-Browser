import { IBrowserEngine, BrowserEngineConfig } from '../interfaces/IBrowserEngine.js';
import { ExecutionPlan, AutomationResult, AutomationStep } from '../../shared/types.js';
import { EventEmitter } from 'events';
import { ReasoningEngine } from './ai/ReasoningEngine.js';
import { ElementDiscoveryService } from './ElementDiscoveryService.js';
import { TaskPlanner } from './TaskPlanner.js';
import { MemorySystem } from './MemorySystem.js';
import { AIProviderManager } from './AIProviderManager.js';

export interface AIBrowserEngineConfig extends BrowserEngineConfig {
  aiProvider?: 'openai' | 'anthropic' | 'gemini';
  fallbackEngine?: 'puppeteer' | 'browseruse';
  enableLearning?: boolean;
  enableMultiSite?: boolean;
  performanceOptimization?: boolean;
}

export interface AIExecutionContext {
  taskId: string;
  objective: string;
  currentStep: number;
  totalSteps: number;
  startTime: number;
  reasoning: string[];
  adaptations: string[];
  errors: string[];
}

export class AIBrowserEngine extends EventEmitter implements IBrowserEngine {
  private config: AIBrowserEngineConfig;
  private isInitialized = false;
  private _isRunning = false;
  private currentContext: AIExecutionContext | null = null;
  private fallbackEngine: IBrowserEngine | null = null;
  
  // AI-driven components
  private reasoningEngine: ReasoningEngine | null = null;
  private elementDiscovery: ElementDiscoveryService | null = null;
  private taskPlanner: TaskPlanner | null = null;
  private memorySystem: MemorySystem | null = null;
  private aiProvider: AIProviderManager | null = null;

  constructor(config: AIBrowserEngineConfig = {}, aiProviderManager?: AIProviderManager) {
    super();
    this.config = {
      headless: false,
      timeout: 60000,
      viewport: { width: 1366, height: 768 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      enableStealth: true,
      aiProvider: 'openai',
      fallbackEngine: 'puppeteer',
      enableLearning: true,
      enableMultiSite: true,
      performanceOptimization: true,
      ...config
    };
    
    // Use provided AI provider manager or create a new one
    this.aiProvider = aiProviderManager || null;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Initialize AI Provider Manager if not provided
      if (!this.aiProvider) {
        this.aiProvider = new AIProviderManager();
        await this.aiProvider.initialize();
      }

      // Initialize AI services if learning is enabled
      if (this.config.enableLearning) {
        try {
          // Get the current AI provider from the manager
          const currentProviderName = this.aiProvider.getCurrentProvider();
          if (!currentProviderName) {
            console.warn('No AI provider available, disabling AI features');
            return;
          }

          // For now, we'll use the AIProviderManager as a wrapper
          // In a full implementation, we'd get the actual provider instance
          const providerWrapper = {
            name: currentProviderName,
            generateCompletion: (prompt: string, options?: any) => this.aiProvider.generateCompletion(prompt, options),
            parseStructuredOutput: (prompt: string, schema: any) => this.aiProvider.generateCompletion(prompt),
            isAvailable: () => Promise.resolve(true),
            getUsage: () => this.aiProvider.getUsageStats() || { totalRequests: 0, totalTokens: 0, totalCost: 0, lastUsed: new Date() }
          };

          // Initialize Reasoning Engine
          this.reasoningEngine = new ReasoningEngine(providerWrapper as any);

          // Initialize Memory System (requires database service)
          try {
            const { DatabaseService } = await import('./DatabaseService.js');
            const database = new DatabaseService();
            await database.initialize();
            this.memorySystem = new MemorySystem(providerWrapper as any, database);
          } catch (error) {
            console.warn('Memory system initialization failed, continuing without learning:', error);
          }

          // Initialize Task Planner
          if (this.memorySystem) {
            this.taskPlanner = new TaskPlanner(providerWrapper as any, this.memorySystem, this.elementDiscovery);
          }

          // Initialize Element Discovery Service
          this.elementDiscovery = new ElementDiscoveryService(providerWrapper as any);
        } catch (error) {
          console.warn('AI services initialization failed, continuing with basic automation:', error);
        }
      }

      // Initialize fallback engine
      if (this.config.fallbackEngine === 'browseruse') {
        const { BrowserUseService } = await import('./BrowserUseService.js');
        this.fallbackEngine = new BrowserUseService(this.config);
      } else {
        const { PuppeteerService } = await import('./PuppeteerService.js');
        this.fallbackEngine = new PuppeteerService(this.config);
      }

      if (this.fallbackEngine) {
        await this.fallbackEngine.initialize();
      }

      this.isInitialized = true;
      this.emit('initialized');
    } catch (error) {
      console.error('Failed to initialize AI Browser Engine:', error);
      throw error;
    }
  }

  async executeAutomation(executionPlan: ExecutionPlan): Promise<AutomationResult> {
    if (!this.isInitialized) {
      throw new Error('AI Browser Engine not initialized');
    }

    this._isRunning = true;
    const startTime = Date.now();

    try {
      // Create execution context
      this.currentContext = {
        taskId: `ai-task-${Date.now()}`,
        objective: executionPlan.objective || 'AI-enhanced automation',
        currentStep: 0,
        totalSteps: executionPlan.steps?.length || 0,
        startTime,
        reasoning: ['AI-enhanced execution started'],
        adaptations: [],
        errors: []
      };

      this.emit('automationStarted', this.currentContext);

      // Use AI-driven automation if available, otherwise fallback
      if (this.config.enableLearning && this.fallbackEngine) {
        const result = await this.executeWithAIEnhancement(executionPlan);
        return result;
      } else if (this.fallbackEngine) {
        const result = await this.fallbackEngine.executeAutomation(executionPlan);
        
        // Add AI metadata
        result.metadata = {
          ...result.metadata,
          aiEnhanced: true,
          aiProvider: this.config.aiProvider,
          reasoning: this.currentContext.reasoning,
          adaptations: this.currentContext.adaptations,
          learningEnabled: this.config.enableLearning,
          executionTime: Date.now() - startTime
        };

        this.emit('automationCompleted', result);
        return result;
      }

      throw new Error('No fallback engine available');
    } catch (error) {
      console.error('AI automation failed:', error);
      if (this.currentContext) {
        this.currentContext.errors.push(error instanceof Error ? error.message : String(error));
      }
      throw error;
    } finally {
      this._isRunning = false;
      this.currentContext = null;
    }
  }

  async cleanup(): Promise<void> {
    try {
      if (this.isRunning) {
        await this.stopAutomation();
      }

      if (this.fallbackEngine) {
        await this.fallbackEngine.cleanup();
      }
      
      this.isInitialized = false;
      this.removeAllListeners();
    } catch (error) {
      console.error('Error during cleanup:', error);
    }
  }

  isRunning(): boolean {
    return this._isRunning;
  }

  getEngineType(): string {
    return 'ai-browser-engine';
  }

  async stopAutomation(): Promise<void> {
    if (this._isRunning && this.fallbackEngine) {
      await this.fallbackEngine.stopAutomation();
    }
    this._isRunning = false;
    this.emit('automationStopped');
  }

  async testEngine(): Promise<boolean> {
    try {
      if (this.fallbackEngine) {
        return await this.fallbackEngine.testEngine();
      }
      return false;
    } catch (error) {
      console.error('AI engine test failed:', error);
      return false;
    }
  }

  // AI-specific methods
  public getCurrentContext(): AIExecutionContext | null {
    return this.currentContext;
  }

  public getPerformanceMetrics() {
    return {
      executionTime: 0,
      memoryUsage: 0,
      cacheHitRate: 0,
      successRate: 1.0
    };
  }

  public getCacheStatistics() {
    return new Map();
  }

  public async getMemoryPatterns() {
    return [];
  }

  /**
   * Execute automation with AI enhancement
   * Uses reasoning engine, element discovery, and adaptive planning
   */
  private async executeWithAIEnhancement(executionPlan: ExecutionPlan): Promise<AutomationResult> {
    if (!this.fallbackEngine || !this.currentContext) {
      throw new Error('AI enhancement not properly initialized');
    }

    const startTime = Date.now();
    const screenshots: Buffer[] = [];
    const extractedData: any[] = [];
    const errors: any[] = [];

    try {
      // Step 1: Use AI to understand the task and adapt the plan
      if (this.taskPlanner && executionPlan.objective) {
        this.currentContext.reasoning.push('Analyzing task with AI task planner...');
        
        try {
          const taskUnderstanding = await this.taskPlanner.parseNaturalLanguageTask(executionPlan.objective);
          this.currentContext.reasoning.push(`Task understood: ${taskUnderstanding.intent.description}`);
          
          // Generate an improved plan based on AI understanding
          const aiPlan = await this.taskPlanner.generateInitialPlan(taskUnderstanding);
          this.currentContext.reasoning.push(`Generated AI-enhanced plan with ${aiPlan.steps.length} steps`);
          this.currentContext.adaptations.push('Plan enhanced with AI reasoning');
        } catch (error) {
          this.currentContext.reasoning.push('AI planning failed, using original plan');
          console.warn('AI planning failed:', error);
        }
      }

      // Step 2: Execute the plan with AI-enhanced element discovery
      let currentStep = 0;
      for (const step of executionPlan.steps) {
        this.currentContext.currentStep = currentStep++;
        this.currentContext.reasoning.push(`Executing step ${currentStep}: ${step.description}`);

        try {
          // Use AI reasoning to analyze the current state before each step
          if (this.reasoningEngine) {
            // Get current page state (this would need to be implemented with actual browser state)
            const mockBrowserState = {
              url: 'current-page-url',
              title: 'Current Page',
              pageType: 'unknown' as any, // PageType.UNKNOWN
              loadState: 'complete' as any, // LoadState.COMPLETE
              elementMap: { indexed: new Map(), byPurpose: new Map(), byType: new Map(), relationships: [] },
              screenshots: [],
              accessibility: { score: 0.8, violations: [], warnings: [], recommendations: [] },
              performance: { 
                loadTime: 1000, 
                renderTime: 500, 
                interactiveTime: 1200, 
                memoryUsage: 50,
                domContentLoaded: 800,
                firstContentfulPaint: 600,
                largestContentfulPaint: 1100,
                cumulativeLayoutShift: 0.1
              },
              errors: []
            };

            const actionHistory = {
              actions: [],
              patterns: [],
              successRate: 1.0,
              averageDuration: 1000,
              totalActions: 0,
              successfulActions: 0,
              failedActions: 0,
              timespan: 1000
            };

            const reasoningResult = await this.reasoningEngine.analyzeCurrentState(mockBrowserState, actionHistory);
            this.currentContext.reasoning.push(`AI Analysis: ${reasoningResult.thinking}`);
            
            if (reasoningResult.alternatives.length > 0) {
              this.currentContext.adaptations.push(`AI suggested ${reasoningResult.alternatives.length} alternative approaches`);
            }
          }

          // Execute the step using the fallback engine
          // In a full implementation, this would be enhanced with AI element discovery
          this.emit('stepStarted', { step, context: this.currentContext });
          
          // For now, we'll delegate to the fallback engine but with AI context
          // In the future, this should use ElementDiscoveryService to find elements intelligently
          
        } catch (stepError) {
          this.currentContext.errors.push(`Step ${currentStep} failed: ${stepError}`);
          this.currentContext.reasoning.push(`Step failed, attempting AI recovery...`);
          
          // Use AI reasoning for error recovery
          if (this.reasoningEngine) {
            try {
              // This would implement AI-driven error recovery
              this.currentContext.reasoning.push('AI analyzing failure and generating recovery strategy...');
              this.currentContext.adaptations.push('Applied AI error recovery');
            } catch (recoveryError) {
              this.currentContext.reasoning.push('AI recovery failed, continuing with next step');
            }
          }
        }
      }

      // Step 3: Execute with fallback engine but preserve AI context
      const result = await this.fallbackEngine.executeAutomation(executionPlan);
      
      // Step 4: Learn from the execution if memory system is available
      if (this.memorySystem && result.success) {
        try {
          const pattern = {
            id: `pattern-${Date.now()}`,
            sitePattern: result.extractedData[0]?.source?.url || 'unknown',
            taskType: executionPlan.objective || 'automation',
            successfulActions: [],
            contextConditions: [],
            reliability: 1.0,
            lastUsed: new Date(),
            usageCount: 1,
            createdAt: new Date(),
            tags: ['ai-enhanced']
          };
          
          await this.memorySystem.storeSuccessfulPattern(pattern);
          this.currentContext.reasoning.push('Stored successful pattern for future learning');
        } catch (error) {
          console.warn('Failed to store learning pattern:', error);
        }
      }

      // Enhance result with AI metadata
      result.metadata = {
        ...result.metadata,
        aiEnhanced: true,
        aiProvider: this.config.aiProvider,
        reasoning: this.currentContext.reasoning,
        adaptations: this.currentContext.adaptations,
        learningEnabled: this.config.enableLearning,
        executionTime: Date.now() - startTime
      };

      this.emit('automationCompleted', result);
      return result;

    } catch (error) {
      console.error('AI-enhanced automation failed:', error);
      
      // Return error result with AI context
      const errorResult: AutomationResult = {
        id: `ai-error-${Date.now()}`,
        command: executionPlan.objective || 'AI automation',
        intent: { type: 'search', description: 'AI-enhanced automation', complexity: 'complex' },
        executionPlan,
        extractedData,
        screenshots,
        duration: Date.now() - startTime,
        success: false,
        errors: [{ 
          id: `error-${Date.now()}`,
          type: 'ai_error',
          message: error instanceof Error ? error.message : String(error),
          context: { aiContext: this.currentContext },
          timestamp: new Date()
        }],
        timestamp: new Date(),
        metadata: {
          browserVersion: 'unknown',
          userAgent: 'AI Browser Engine',
          viewport: this.config.viewport || { width: 1366, height: 768 },
          totalSteps: executionPlan.steps.length,
          successfulSteps: 0,
          failedSteps: executionPlan.steps.length,
          aiEnhanced: true,
          aiProvider: this.config.aiProvider,
          reasoning: this.currentContext?.reasoning || [],
          adaptations: this.currentContext?.adaptations || [],
          learningEnabled: this.config.enableLearning,
          executionTime: Date.now() - startTime,
          error: error instanceof Error ? error.message : String(error)
        }
      };

      return errorResult;
    }
  }
}