import { IBrowserEngine, BrowserEngineType } from '../interfaces/IBrowserEngine.js';
import { BrowserEngineFactory } from '../factories/BrowserEngineFactory.js';
import { ExecutionPlan, AutomationResult } from '../../shared/types.js';
import { Logger } from './Logger.js';
import { EventEmitter } from 'events';

export interface PerformanceMetrics {
  engineType: BrowserEngineType;
  executionTime: number;
  success: boolean;
  memoryUsage: number;
  cpuUsage: number;
  errorCount: number;
  adaptationCount: number;
  cacheHitRate?: number;
  reasoningQuality?: number;
}

export interface ComparisonResult {
  testName: string;
  executionPlan: ExecutionPlan;
  results: PerformanceMetrics[];
  winner: BrowserEngineType;
  summary: string;
  recommendations: string[];
}

export interface BenchmarkSuite {
  name: string;
  description: string;
  tests: BenchmarkTest[];
}

export interface BenchmarkTest {
  name: string;
  description: string;
  executionPlan: ExecutionPlan;
  expectedOutcome: string;
  weight: number; // Importance of this test (1-10)
}

export class EnginePerformanceComparator extends EventEmitter {
  private logger: Logger;
  private factory: BrowserEngineFactory;

  constructor() {
    super();
    this.logger = new Logger();
    this.factory = new BrowserEngineFactory();
  }

  /**
   * Compare performance of different browser engines
   */
  async compareEngines(
    engines: BrowserEngineType[],
    benchmarkSuite: BenchmarkSuite
  ): Promise<ComparisonResult[]> {
    this.logger.info(`Starting performance comparison for engines: ${engines.join(', ')}`);
    this.emit('comparisonStarted', { engines, suite: benchmarkSuite.name });

    const results: ComparisonResult[] = [];

    for (const test of benchmarkSuite.tests) {
      this.logger.info(`Running test: ${test.name}`);
      this.emit('testStarted', { test: test.name });

      const testResults: PerformanceMetrics[] = [];

      for (const engineType of engines) {
        try {
          const metrics = await this.runSingleTest(engineType, test);
          testResults.push(metrics);
          
          this.emit('engineTestCompleted', { 
            engine: engineType, 
            test: test.name, 
            metrics 
          });
        } catch (error) {
          this.logger.error(`Test failed for ${engineType}:`, error);
          
          // Record failure metrics
          testResults.push({
            engineType,
            executionTime: 0,
            success: false,
            memoryUsage: 0,
            cpuUsage: 0,
            errorCount: 1,
            adaptationCount: 0
          });
        }
      }

      const comparisonResult = this.analyzeTestResults(test, testResults);
      results.push(comparisonResult);

      this.emit('testCompleted', { test: test.name, result: comparisonResult });
    }

    this.emit('comparisonCompleted', { results });
    return results;
  }

  /**
   * Run a single test on a specific engine
   */
  private async runSingleTest(
    engineType: BrowserEngineType,
    test: BenchmarkTest
  ): Promise<PerformanceMetrics> {
    const startTime = Date.now();
    const startMemory = process.memoryUsage().heapUsed;

    let engine: IBrowserEngine | null = null;

    try {
      // Create and initialize engine
      engine = await this.factory.createEngine(engineType, {
        headless: true, // Use headless for performance testing
        timeout: 30000
      });

      await engine.initialize();

      // Execute the test
      const result = await engine.executeAutomation(test.executionPlan);

      const endTime = Date.now();
      const endMemory = process.memoryUsage().heapUsed;

      // Calculate metrics
      const metrics: PerformanceMetrics = {
        engineType,
        executionTime: endTime - startTime,
        success: result.success,
        memoryUsage: (endMemory - startMemory) / 1024 / 1024, // MB
        cpuUsage: 0, // Would need more sophisticated monitoring
        errorCount: result.metadata?.errors?.length || 0,
        adaptationCount: result.metadata?.adaptations?.length || 0
      };

      // Add AI-specific metrics if available
      if (engineType === BrowserEngineType.AI_BROWSER && result.metadata) {
        metrics.cacheHitRate = result.metadata.cacheHitRate;
        metrics.reasoningQuality = this.assessReasoningQuality(result.metadata.aiReasoning);
      }

      return metrics;

    } finally {
      if (engine) {
        await engine.cleanup();
      }
    }
  }

  /**
   * Analyze test results and determine winner
   */
  private analyzeTestResults(
    test: BenchmarkTest,
    results: PerformanceMetrics[]
  ): ComparisonResult {
    // Calculate scores for each engine
    const scores = results.map(metrics => ({
      engineType: metrics.engineType,
      score: this.calculateEngineScore(metrics, test.weight)
    }));

    // Find winner (highest score)
    const winner = scores.reduce((best, current) => 
      current.score > best.score ? current : best
    );

    // Generate summary
    const summary = this.generateTestSummary(test, results, winner.engineType);
    const recommendations = this.generateRecommendations(results);

    return {
      testName: test.name,
      executionPlan: test.executionPlan,
      results,
      winner: winner.engineType,
      summary,
      recommendations
    };
  }

  /**
   * Calculate performance score for an engine
   */
  private calculateEngineScore(metrics: PerformanceMetrics, weight: number): number {
    let score = 0;

    // Success is most important
    if (metrics.success) {
      score += 50;
    }

    // Execution time (faster is better)
    const timeScore = Math.max(0, 30 - (metrics.executionTime / 1000)); // 30 points max
    score += timeScore;

    // Memory usage (lower is better)
    const memoryScore = Math.max(0, 10 - (metrics.memoryUsage / 100)); // 10 points max
    score += memoryScore;

    // Error count (fewer is better)
    score -= metrics.errorCount * 5;

    // AI-specific bonuses
    if (metrics.cacheHitRate) {
      score += metrics.cacheHitRate * 5; // Up to 5 bonus points
    }

    if (metrics.reasoningQuality) {
      score += metrics.reasoningQuality * 10; // Up to 10 bonus points
    }

    if (metrics.adaptationCount > 0) {
      score += 5; // Bonus for adaptability
    }

    // Apply test weight
    return score * (weight / 10);
  }

  /**
   * Assess the quality of AI reasoning
   */
  private assessReasoningQuality(reasoning?: string[]): number {
    if (!reasoning || reasoning.length === 0) {
      return 0;
    }

    let quality = 0;

    // Check for key reasoning indicators
    const indicators = [
      'analyzed', 'determined', 'concluded', 'reasoned',
      'adapted', 'learned', 'optimized', 'recovered'
    ];

    const reasoningText = reasoning.join(' ').toLowerCase();

    indicators.forEach(indicator => {
      if (reasoningText.includes(indicator)) {
        quality += 0.1;
      }
    });

    // Bonus for detailed reasoning
    if (reasoning.length > 3) {
      quality += 0.2;
    }

    return Math.min(quality, 1.0); // Cap at 1.0
  }

  /**
   * Generate test summary
   */
  private generateTestSummary(
    test: BenchmarkTest,
    results: PerformanceMetrics[],
    winner: BrowserEngineType
  ): string {
    const successfulEngines = results.filter(r => r.success).length;
    const avgExecutionTime = results.reduce((sum, r) => sum + r.executionTime, 0) / results.length;

    return `Test "${test.name}": ${winner} performed best. ` +
           `${successfulEngines}/${results.length} engines succeeded. ` +
           `Average execution time: ${avgExecutionTime.toFixed(0)}ms.`;
  }

  /**
   * Generate recommendations based on results
   */
  private generateRecommendations(results: PerformanceMetrics[]): string[] {
    const recommendations: string[] = [];

    const aiResult = results.find(r => r.engineType === BrowserEngineType.AI_BROWSER);
    const browserUseResult = results.find(r => r.engineType === BrowserEngineType.BROWSER_USE);
    const puppeteerResult = results.find(r => r.engineType === BrowserEngineType.PUPPETEER);

    // AI-specific recommendations
    if (aiResult) {
      if (aiResult.success && aiResult.adaptationCount > 0) {
        recommendations.push('AI Browser showed good adaptability - recommended for complex tasks');
      }
      
      if (aiResult.cacheHitRate && aiResult.cacheHitRate > 0.7) {
        recommendations.push('AI Browser cache is performing well - good for repeated tasks');
      }

      if (aiResult.reasoningQuality && aiResult.reasoningQuality > 0.7) {
        recommendations.push('AI Browser reasoning quality is high - suitable for complex decision-making');
      }
    }

    // Performance recommendations
    const fastestEngine = results.reduce((fastest, current) => 
      current.executionTime < fastest.executionTime ? current : fastest
    );

    if (fastestEngine.executionTime < 5000) {
      recommendations.push(`${fastestEngine.engineType} is fastest - recommended for time-critical tasks`);
    }

    // Memory efficiency recommendations
    const mostEfficient = results.reduce((efficient, current) => 
      current.memoryUsage < efficient.memoryUsage ? current : efficient
    );

    if (mostEfficient.memoryUsage < 50) {
      recommendations.push(`${mostEfficient.engineType} is most memory efficient - good for resource-constrained environments`);
    }

    return recommendations;
  }

  /**
   * Create standard benchmark suite
   */
  static createStandardBenchmarkSuite(): BenchmarkSuite {
    return {
      name: 'Standard Browser Engine Benchmark',
      description: 'Comprehensive test suite for comparing browser automation engines',
      tests: [
        {
          name: 'Simple Navigation',
          description: 'Navigate to a webpage and verify title',
          executionPlan: {
            objective: 'Navigate to example.com and verify the page title',
            steps: [
              {
                action: 'navigate',
                target: 'https://example.com',
                description: 'Navigate to example.com'
              },
              {
                action: 'verify',
                target: 'title',
                expected: 'Example Domain',
                description: 'Verify page title'
              }
            ]
          },
          expectedOutcome: 'Successfully navigate and verify title',
          weight: 3
        },
        {
          name: 'Form Interaction',
          description: 'Fill out and submit a form',
          executionPlan: {
            objective: 'Fill out a contact form with test data',
            steps: [
              {
                action: 'navigate',
                target: 'https://httpbin.org/forms/post',
                description: 'Navigate to form page'
              },
              {
                action: 'type',
                target: 'input[name="custname"]',
                value: 'Test User',
                description: 'Enter customer name'
              },
              {
                action: 'type',
                target: 'input[name="custtel"]',
                value: '123-456-7890',
                description: 'Enter phone number'
              },
              {
                action: 'click',
                target: 'input[type="submit"]',
                description: 'Submit form'
              }
            ]
          },
          expectedOutcome: 'Successfully fill and submit form',
          weight: 7
        },
        {
          name: 'Dynamic Content',
          description: 'Handle dynamically loaded content',
          executionPlan: {
            objective: 'Wait for and interact with dynamic content',
            steps: [
              {
                action: 'navigate',
                target: 'https://httpbin.org/delay/2',
                description: 'Navigate to delayed response page'
              },
              {
                action: 'wait',
                target: 'body',
                timeout: 5000,
                description: 'Wait for content to load'
              },
              {
                action: 'extract',
                target: 'body',
                description: 'Extract page content'
              }
            ]
          },
          expectedOutcome: 'Successfully handle delayed content',
          weight: 8
        },
        {
          name: 'Error Recovery',
          description: 'Recover from common errors',
          executionPlan: {
            objective: 'Attempt to click non-existent element and recover',
            steps: [
              {
                action: 'navigate',
                target: 'https://example.com',
                description: 'Navigate to example.com'
              },
              {
                action: 'click',
                target: '#non-existent-element',
                description: 'Try to click non-existent element'
              },
              {
                action: 'click',
                target: 'body',
                description: 'Fallback to clicking body'
              }
            ]
          },
          expectedOutcome: 'Gracefully handle missing element',
          weight: 9
        },
        {
          name: 'Multi-Step Workflow',
          description: 'Execute complex multi-step automation',
          executionPlan: {
            objective: 'Perform multi-step navigation and data extraction',
            steps: [
              {
                action: 'navigate',
                target: 'https://httpbin.org',
                description: 'Navigate to httpbin'
              },
              {
                action: 'click',
                target: 'a[href="/get"]',
                description: 'Click GET endpoint link'
              },
              {
                action: 'extract',
                target: 'pre',
                description: 'Extract JSON response'
              },
              {
                action: 'navigate',
                target: 'https://httpbin.org/status/200',
                description: 'Navigate to status endpoint'
              },
              {
                action: 'verify',
                target: 'body',
                description: 'Verify successful response'
              }
            ]
          },
          expectedOutcome: 'Complete multi-step workflow successfully',
          weight: 10
        }
      ]
    };
  }

  /**
   * Generate performance report
   */
  generateReport(results: ComparisonResult[]): string {
    let report = '# Browser Engine Performance Comparison Report\n\n';

    // Overall summary
    const engineWins = new Map<BrowserEngineType, number>();
    results.forEach(result => {
      const wins = engineWins.get(result.winner) || 0;
      engineWins.set(result.winner, wins + 1);
    });

    report += '## Overall Results\n\n';
    Array.from(engineWins.entries())
      .sort(([,a], [,b]) => b - a)
      .forEach(([engine, wins]) => {
        report += `- **${engine}**: ${wins} test wins\n`;
      });

    report += '\n## Test Details\n\n';

    // Individual test results
    results.forEach(result => {
      report += `### ${result.testName}\n\n`;
      report += `**Winner**: ${result.winner}\n\n`;
      report += `**Summary**: ${result.summary}\n\n`;

      if (result.recommendations.length > 0) {
        report += '**Recommendations**:\n';
        result.recommendations.forEach(rec => {
          report += `- ${rec}\n`;
        });
        report += '\n';
      }

      report += '**Detailed Results**:\n\n';
      result.results.forEach(metrics => {
        report += `- **${metrics.engineType}**:\n`;
        report += `  - Success: ${metrics.success}\n`;
        report += `  - Execution Time: ${metrics.executionTime}ms\n`;
        report += `  - Memory Usage: ${metrics.memoryUsage.toFixed(2)}MB\n`;
        report += `  - Errors: ${metrics.errorCount}\n`;
        
        if (metrics.adaptationCount > 0) {
          report += `  - Adaptations: ${metrics.adaptationCount}\n`;
        }
        
        if (metrics.cacheHitRate) {
          report += `  - Cache Hit Rate: ${(metrics.cacheHitRate * 100).toFixed(1)}%\n`;
        }
        
        if (metrics.reasoningQuality) {
          report += `  - Reasoning Quality: ${(metrics.reasoningQuality * 100).toFixed(1)}%\n`;
        }
      });

      report += '\n';
    });

    return report;
  }
}