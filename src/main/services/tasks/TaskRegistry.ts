import { AutomationTask } from './BaseTask';
import { FlightSearchTask } from './FlightSearchTask';
import { FormFillingTask } from './FormFillingTask';
import { ResearchTask } from './ResearchTask';
import { CommandParameters, AutomationIntent } from '../../../shared/types';
import { AIProviderManager } from '../AIProviderManager';

/**
 * Registry for managing all available automation tasks
 */
export class TaskRegistry {
  private tasks: Map<string, AutomationTask> = new Map();
  private aiProvider: AIProviderManager;

  constructor(aiProvider: AIProviderManager) {
    this.aiProvider = aiProvider;
    this.initializeTasks();
  }

  /**
   * Initialize all available tasks
   */
  private initializeTasks(): void {
    // Register built-in tasks
    this.registerTask(new FlightSearchTask());
    this.registerTask(new FormFillingTask(this.aiProvider));
    this.registerTask(new ResearchTask(this.aiProvider));
  }

  /**
   * Register a new task
   */
  registerTask(task: AutomationTask): void {
    this.tasks.set(task.type, task);
    console.log(`Registered task: ${task.name} (${task.type})`);
  }

  /**
   * Unregister a task
   */
  unregisterTask(taskType: string): boolean {
    const removed = this.tasks.delete(taskType);
    if (removed) {
      console.log(`Unregistered task type: ${taskType}`);
    }
    return removed;
  }

  /**
   * Get all registered tasks
   */
  getAllTasks(): AutomationTask[] {
    return Array.from(this.tasks.values());
  }

  /**
   * Get task by type
   */
  getTask(taskType: string): AutomationTask | undefined {
    return this.tasks.get(taskType);
  }

  /**
   * Find the best task for given parameters
   */
  findBestTask(parameters: CommandParameters): AutomationTask | null {
    // First, try to match by explicit task type if provided
    if (parameters.taskType) {
      const task = this.getTask(parameters.taskType);
      if (task && task.canHandle(parameters)) {
        return task;
      }
    }

    // Find all tasks that can handle the parameters
    const compatibleTasks = Array.from(this.tasks.values())
      .filter(task => task.canHandle(parameters));

    if (compatibleTasks.length === 0) {
      return null;
    }

    // If only one compatible task, return it
    if (compatibleTasks.length === 1) {
      return compatibleTasks[0];
    }

    // Multiple compatible tasks - use heuristics to choose the best one
    return this.selectBestTask(compatibleTasks, parameters);
  }

  /**
   * Find task by automation intent
   */
  findTaskByIntent(intent: AutomationIntent): AutomationTask | null {
    const taskTypeMapping: Record<string, string> = {
      'search': 'search',
      'form_fill': 'form_fill',
      'data_extract': 'research',
      'navigate': 'research',
      'monitor': 'research',
      'research': 'research'
    };

    const taskType = taskTypeMapping[intent.type];
    if (taskType) {
      return this.getTask(taskType);
    }

    return null;
  }

  /**
   * Get task capabilities and descriptions
   */
  getTaskCapabilities(): Array<{
    type: string;
    name: string;
    description: string;
    canHandle: string[];
  }> {
    return Array.from(this.tasks.values()).map(task => ({
      type: task.type,
      name: task.name,
      description: task.description,
      canHandle: this.getTaskCapabilities_internal(task)
    }));
  }

  /**
   * Validate if parameters are compatible with any registered task
   */
  validateParameters(parameters: CommandParameters): {
    isValid: boolean;
    compatibleTasks: string[];
    suggestions?: string[];
  } {
    const compatibleTasks = Array.from(this.tasks.values())
      .filter(task => task.canHandle(parameters))
      .map(task => task.type);

    const isValid = compatibleTasks.length > 0;
    const suggestions = isValid ? [] : this.generateParameterSuggestions(parameters);

    return {
      isValid,
      compatibleTasks,
      suggestions
    };
  }

  /**
   * Get estimated execution time for parameters across all compatible tasks
   */
  getEstimatedExecutionTime(parameters: CommandParameters): {
    taskType: string;
    estimatedDuration: number;
  } | null {
    const bestTask = this.findBestTask(parameters);
    if (!bestTask) return null;

    return {
      taskType: bestTask.type,
      estimatedDuration: bestTask.getEstimatedDuration(parameters)
    };
  }

  /**
   * Create execution plan for parameters
   */
  async createExecutionPlan(parameters: CommandParameters) {
    const bestTask = this.findBestTask(parameters);
    if (!bestTask) {
      throw new Error('No compatible task found for the given parameters');
    }

    return await bestTask.generateExecutionPlan(parameters);
  }

  /**
   * Execute task with given parameters
   */
  async executeTask(parameters: CommandParameters, browserManager: any) {
    const bestTask = this.findBestTask(parameters);
    if (!bestTask) {
      throw new Error('No compatible task found for the given parameters');
    }

    console.log(`Executing task: ${bestTask.name} (${bestTask.type})`);
    return await bestTask.execute(parameters, browserManager);
  }

  /**
   * Select the best task from multiple compatible options
   */
  private selectBestTask(tasks: AutomationTask[], parameters: CommandParameters): AutomationTask {
    // Priority order for task selection
    const taskPriority: Record<string, number> = {
      'search': 3,      // Flight search is highly specific
      'form_fill': 2,   // Form filling is moderately specific
      'research': 1     // Research is most general
    };

    // Sort by priority (higher number = higher priority)
    tasks.sort((a, b) => (taskPriority[b.type] || 0) - (taskPriority[a.type] || 0));

    // Additional heuristics based on parameters
    if (parameters.urls?.some(url => url.includes('form') || url.includes('survey'))) {
      const formTask = tasks.find(t => t.type === 'form_fill');
      if (formTask) return formTask;
    }

    if (parameters.searchTerms?.some(term => 
      term.toLowerCase().includes('flight') || 
      term.toLowerCase().includes('airline') ||
      term.toLowerCase().includes('travel')
    )) {
      const flightTask = tasks.find(t => t.type === 'search');
      if (flightTask) return flightTask;
    }

    // Default to first task (highest priority)
    return tasks[0];
  }

  /**
   * Get internal task capabilities for documentation
   */
  private getTaskCapabilities_internal(task: AutomationTask): string[] {
    const capabilities: Record<string, string[]> = {
      'search': [
        'Multi-website flight search',
        'Price comparison',
        'Date flexibility',
        'Airline filtering'
      ],
      'form_fill': [
        'Intelligent form analysis',
        'Context-aware responses',
        'Multiple response strategies',
        'Form submission'
      ],
      'research': [
        'Multi-source web research',
        'Content extraction',
        'Report compilation',
        'Key insights generation'
      ]
    };

    return capabilities[task.type] || ['General automation capabilities'];
  }

  /**
   * Generate suggestions for invalid parameters
   */
  private generateParameterSuggestions(parameters: CommandParameters): string[] {
    const suggestions: string[] = [];

    if (!parameters.urls && !parameters.searchTerms && !parameters.query) {
      suggestions.push('Add URLs, search terms, or a query to specify what to automate');
    }

    if (parameters.urls?.length === 0) {
      suggestions.push('Provide at least one URL to work with');
    }

    // Task-specific suggestions
    const hasFlightKeywords = parameters.searchTerms?.some(term => 
      ['flight', 'airline', 'travel', 'booking'].some(keyword => 
        term.toLowerCase().includes(keyword)
      )
    );

    if (hasFlightKeywords) {
      suggestions.push('For flight searches, include origin, destination, and departure date');
    }

    const hasFormKeywords = parameters.urls?.some(url => 
      ['form', 'survey', 'application'].some(keyword => 
        url.toLowerCase().includes(keyword)
      )
    );

    if (hasFormKeywords) {
      suggestions.push('For form filling, specify the strategy (best_responses, honest, creative, professional)');
    }

    if (parameters.query || parameters.searchTerms) {
      suggestions.push('For research tasks, specify the depth (shallow, medium, deep) and output format');
    }

    return suggestions;
  }

  /**
   * Get task statistics
   */
  getTaskStatistics(): {
    totalTasks: number;
    taskTypes: string[];
    averageEstimatedDuration: number;
  } {
    const tasks = Array.from(this.tasks.values());
    const sampleParams: CommandParameters = { urls: ['https://example.com'] };
    
    const durations = tasks.map(task => {
      try {
        return task.getEstimatedDuration(sampleParams);
      } catch {
        return 60000; // Default 1 minute
      }
    });

    return {
      totalTasks: tasks.length,
      taskTypes: tasks.map(t => t.type),
      averageEstimatedDuration: durations.reduce((a, b) => a + b, 0) / durations.length
    };
  }

  /**
   * Health check for all registered tasks
   */
  async healthCheck(): Promise<{
    healthy: boolean;
    taskStatus: Array<{
      type: string;
      name: string;
      status: 'healthy' | 'error';
      error?: string;
    }>;
  }> {
    const taskStatus = [];
    let allHealthy = true;

    for (const task of this.tasks.values()) {
      try {
        // Basic validation - check if task can generate execution plan
        const sampleParams: CommandParameters = { 
          urls: ['https://example.com'],
          query: 'test query'
        };
        
        if (task.canHandle(sampleParams)) {
          await task.generateExecutionPlan(sampleParams);
        }
        
        taskStatus.push({
          type: task.type,
          name: task.name,
          status: 'healthy' as const
        });
      } catch (error) {
        allHealthy = false;
        taskStatus.push({
          type: task.type,
          name: task.name,
          status: 'error' as const,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return {
      healthy: allHealthy,
      taskStatus
    };
  }
}

// Export singleton instance factory
let taskRegistryInstance: TaskRegistry | null = null;

export function getTaskRegistry(aiProvider: AIProviderManager): TaskRegistry {
  if (!taskRegistryInstance) {
    taskRegistryInstance = new TaskRegistry(aiProvider);
  }
  return taskRegistryInstance;
}

export function resetTaskRegistry(): void {
  taskRegistryInstance = null;
}