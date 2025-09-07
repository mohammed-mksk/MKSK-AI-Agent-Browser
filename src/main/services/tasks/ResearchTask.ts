import { BaseAutomationTask } from './BaseTask';
import { CommandParameters, ExtractedData, ExecutionPlan, AutomationStep } from '../../../shared/types';
import { BrowserManager } from '../BrowserManager';
import { Page } from 'puppeteer';
import { AIProviderManager } from '../AIProviderManager';

interface ResearchParams extends CommandParameters {
  query: string;
  sources?: string[];
  depth?: 'shallow' | 'medium' | 'deep';
  outputFormat?: 'summary' | 'detailed' | 'comparison' | 'report';
  maxResults?: number;
  includeImages?: boolean;
}

interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  source: string;
  relevanceScore: number;
}

interface ResearchData {
  content: string;
  url: string;
  title: string;
  headings: string[];
  keyPoints: string[];
  images?: string[];
}

/**
 * Specialized task for comprehensive web research and data compilation
 */
export class ResearchTask extends BaseAutomationTask {
  name = 'Web Research';
  type = 'research';
  description = 'Conduct comprehensive web research across multiple sources and compile findings';

  private aiProvider: AIProviderManager;
  private readonly defaultSources = [
    'google.com',
    'bing.com',
    'duckduckgo.com'
  ];

  constructor(aiProvider: AIProviderManager) {
    super();
    this.aiProvider = aiProvider;
  }

  canHandle(parameters: CommandParameters): boolean {
    const params = parameters as ResearchParams;
    return !!(params.query || params.searchTerms?.length);
  }

  async generateExecutionPlan(parameters: CommandParameters): Promise<ExecutionPlan> {
    const params = parameters as ResearchParams;
    const query = params.query || params.searchTerms?.[0];
    
    if (!query) {
      throw new Error('Query is required for research task');
    }

    const sources = params.sources || this.defaultSources;
    const maxResults = params.maxResults || 10;
    const steps: AutomationStep[] = [];
    let stepId = 1;

    // Search each source
    for (const source of sources) {
      steps.push(
        this.createStep(
          `step-${stepId++}`,
          'navigate',
          { css: 'body' },
          this.getSearchUrl(source, query),
          30000,
          `Search ${source} for: ${query}`
        ),
        this.createStep(
          `step-${stepId++}`,
          'extract',
          this.getSearchResultsSelector(source),
          undefined,
          15000,
          `Extract search results from ${source}`
        )
      );
    }

    // Visit top results for detailed content
    for (let i = 0; i < Math.min(maxResults, 5); i++) {
      steps.push(
        this.createStep(
          `step-${stepId++}`,
          'navigate',
          { css: 'body' },
          'dynamic',
          30000,
          `Visit result ${i + 1} for detailed content`
        ),
        this.createStep(
          `step-${stepId++}`,
          'extract',
          { css: 'article, main, .content, body' },
          undefined,
          20000,
          `Extract content from result ${i + 1}`
        )
      );
    }

    // Compile research report
    steps.push(
      this.createStep(
        `step-${stepId++}`,
        'extract',
        { css: 'body' },
        'compile_report',
        30000,
        'Compile comprehensive research report'
      )
    );

    return {
      id: `research-${Date.now()}`,
      steps,
      estimatedDuration: this.getEstimatedDuration(parameters),
      requiredResources: [
        { type: 'browser', amount: 2, unit: 'instances' },
        { type: 'memory', amount: 512, unit: 'MB' },
        { type: 'ai_tokens', amount: 5000, unit: 'tokens' }
      ],
      fallbackStrategies: [
        {
          condition: 'search_engine_blocked',
          alternativeSteps: [
            this.createStep('fallback-1', 'navigate', { css: 'body' }, 'https://duckduckgo.com', 30000, 'Fallback to DuckDuckGo')
          ]
        }
      ]
    };
  }

  async execute(parameters: CommandParameters, browserManager: BrowserManager): Promise<ExtractedData[]> {
    const params = parameters as ResearchParams;
    const query = params.query || params.searchTerms?.[0];
    
    if (!query) {
      throw new Error('Query is required for research task');
    }

    const sources = params.sources || this.defaultSources;
    const maxResults = params.maxResults || 10;
    const depth = params.depth || 'medium';

    // Step 1: Gather search results from multiple sources
    const searchResults = await this.gatherSearchResults(query, sources, browserManager);
    
    // Step 2: Visit top results for detailed content
    const detailedData = await this.gatherDetailedContent(
      searchResults.slice(0, maxResults), 
      browserManager,
      depth
    );
    
    // Step 3: Compile research report
    const compiledReport = await this.compileResearchReport(
      query, 
      searchResults, 
      detailedData, 
      params
    );

    return [
      this.createExtractedData(
        'research-report',
        'structured',
        compiledReport,
        'research-compilation',
        'research-task',
        0.95
      )
    ];
  }

  private async gatherSearchResults(
    query: string, 
    sources: string[], 
    browserManager: BrowserManager
  ): Promise<SearchResult[]> {
    const allResults: SearchResult[] = [];

    // Search each source in parallel
    const searchPromises = sources.map(source => 
      this.searchSource(source, query, browserManager)
    );

    const results = await Promise.allSettled(searchPromises);
    
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        allResults.push(...result.value);
      } else {
        console.error(`Failed to search ${sources[index]}:`, result.reason);
      }
    });

    // Remove duplicates and sort by relevance
    return this.deduplicateAndRankResults(allResults);
  }

  private async searchSource(
    source: string, 
    query: string, 
    browserManager: BrowserManager
  ): Promise<SearchResult[]> {
    const browser = await browserManager.createBrowser({ 
      headless: true, 
      viewport: { width: 1920, height: 1080 } 
    });
    const page = await browserManager.createPage(browser);

    try {
      const searchUrl = this.getSearchUrl(source, query);
      await page.goto(searchUrl, { waitUntil: 'networkidle2' });

      // Handle cookie banners and popups
      await this.handlePopups(page);

      // Extract search results
      const results = await this.extractSearchResults(page, source);
      
      return results;
    } finally {
      await browserManager.closeBrowser(browser);
    }
  }

  private async extractSearchResults(page: Page, source: string): Promise<SearchResult[]> {
    return await page.evaluate((sourceName) => {
      const results: SearchResult[] = [];
      
      let resultSelectors: string[] = [];
      
      switch (sourceName) {
        case 'google.com':
          resultSelectors = ['.g', '.tF2Cxc', '.MjjYud'];
          break;
        case 'bing.com':
          resultSelectors = ['.b_algo', '.b_result'];
          break;
        case 'duckduckgo.com':
          resultSelectors = ['.result', '.web-result'];
          break;
        default:
          resultSelectors = ['.result', '.search-result', 'article'];
      }

      for (const selector of resultSelectors) {
        const elements = Array.from(document.querySelectorAll(selector));
        
        elements.forEach((element, index) => {
          const titleEl = element.querySelector('h1, h2, h3, .title, [data-testid="result-title-a"]');
          const linkEl = element.querySelector('a[href]');
          const snippetEl = element.querySelector('.snippet, .b_caption, .result__snippet, [data-testid="result-snippet"]');
          
          if (titleEl && linkEl) {
            const title = titleEl.textContent?.trim() || '';
            const url = (linkEl as HTMLAnchorElement).href;
            const snippet = snippetEl?.textContent?.trim() || '';
            
            if (title && url && !url.includes('javascript:')) {
              results.push({
                title,
                url,
                snippet,
                source: sourceName,
                relevanceScore: Math.max(0, 1 - (index * 0.1)) // Higher score for earlier results
              });
            }
          }
        });
        
        if (results.length > 0) break; // Found results with this selector
      }
      
      return results.slice(0, 15); // Limit to top 15 results per source
    }, source);
  }

  private async gatherDetailedContent(
    searchResults: SearchResult[], 
    browserManager: BrowserManager,
    depth: string
  ): Promise<ResearchData[]> {
    const detailedData: ResearchData[] = [];
    const maxPages = depth === 'shallow' ? 3 : depth === 'medium' ? 5 : 8;
    
    const contentPromises = searchResults.slice(0, maxPages).map(result => 
      this.extractDetailedContent(result, browserManager)
    );

    const results = await Promise.allSettled(contentPromises);
    
    results.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value) {
        detailedData.push(result.value);
      } else {
        console.error(`Failed to extract content from ${searchResults[index].url}:`, result.reason);
      }
    });

    return detailedData;
  }

  private async extractDetailedContent(
    searchResult: SearchResult, 
    browserManager: BrowserManager
  ): Promise<ResearchData | null> {
    const browser = await browserManager.createBrowser({ 
      headless: true, 
      viewport: { width: 1920, height: 1080 } 
    });
    const page = await browserManager.createPage(browser);

    try {
      await page.goto(searchResult.url, { 
        waitUntil: 'networkidle2', 
        timeout: 30000 
      });

      // Handle popups and cookie banners
      await this.handlePopups(page);

      // Extract content
      const content = await page.evaluate(() => {
        // Remove unwanted elements
        const unwantedSelectors = [
          'script', 'style', 'nav', 'header', 'footer', 
          '.advertisement', '.ads', '.sidebar', '.menu',
          '.cookie-banner', '.popup', '.modal'
        ];
        
        unwantedSelectors.forEach(selector => {
          const elements = document.querySelectorAll(selector);
          elements.forEach(el => el.remove());
        });

        // Find main content
        const contentSelectors = [
          'article', 'main', '.content', '.post-content', 
          '.entry-content', '.article-body', '.story-body'
        ];
        
        let mainContent = '';
        let title = '';
        const headings: string[] = [];
        
        // Get title
        const titleEl = document.querySelector('h1, title');
        title = titleEl?.textContent?.trim() || '';
        
        // Get main content
        for (const selector of contentSelectors) {
          const contentEl = document.querySelector(selector);
          if (contentEl) {
            mainContent = contentEl.textContent?.trim() || '';
            break;
          }
        }
        
        // Fallback to body if no main content found
        if (!mainContent) {
          mainContent = document.body.textContent?.trim() || '';
        }
        
        // Extract headings
        const headingElements = Array.from(document.querySelectorAll('h1, h2, h3, h4'));
        headingElements.forEach(heading => {
          const text = heading.textContent?.trim();
          if (text && text.length > 3 && text.length < 200) {
            headings.push(text);
          }
        });
        
        return {
          content: mainContent.slice(0, 5000), // Limit content length
          title,
          headings: headings.slice(0, 10) // Limit headings
        };
      });

      // Generate key points using AI
      const keyPoints = await this.extractKeyPoints(content.content, searchResult.title);

      return {
        content: content.content,
        url: searchResult.url,
        title: content.title || searchResult.title,
        headings: content.headings,
        keyPoints
      };

    } catch (error) {
      console.error(`Failed to extract content from ${searchResult.url}:`, error);
      return null;
    } finally {
      await browserManager.closeBrowser(browser);
    }
  }

  private async extractKeyPoints(content: string, title: string): Promise<string[]> {
    if (!content || content.length < 100) return [];

    const prompt = `
Extract the 3-5 most important key points from this content about "${title}":

${content.slice(0, 2000)}

Return only the key points as a JSON array of strings. Each point should be concise (1-2 sentences).
`;

    try {
      const response = await this.aiProvider.generateStructuredOutput(prompt, {
        type: 'object',
        properties: {
          keyPoints: {
            type: 'array',
            items: { type: 'string' }
          }
        },
        required: ['keyPoints']
      });

      return response.keyPoints || [];
    } catch (error) {
      console.error('Failed to extract key points:', error);
      return [];
    }
  }

  private async compileResearchReport(
    query: string,
    searchResults: SearchResult[],
    detailedData: ResearchData[],
    params: ResearchParams
  ): Promise<any> {
    const outputFormat = params.outputFormat || 'summary';
    
    const reportData = {
      query,
      timestamp: new Date(),
      totalSources: searchResults.length,
      detailedSources: detailedData.length,
      searchResults: searchResults.slice(0, 20), // Top 20 results
      detailedContent: detailedData,
      summary: await this.generateSummary(query, detailedData),
      keyFindings: await this.generateKeyFindings(detailedData),
      sources: detailedData.map(data => ({
        title: data.title,
        url: data.url,
        keyPoints: data.keyPoints
      }))
    };

    // Format based on requested output format
    switch (outputFormat) {
      case 'detailed':
        return {
          ...reportData,
          fullContent: detailedData.map(data => ({
            title: data.title,
            url: data.url,
            content: data.content,
            headings: data.headings
          }))
        };
      
      case 'comparison':
        return {
          ...reportData,
          comparison: await this.generateComparison(detailedData, query)
        };
      
      case 'report':
        return {
          ...reportData,
          formattedReport: await this.generateFormattedReport(query, reportData)
        };
      
      default: // summary
        return reportData;
    }
  }

  private async generateSummary(query: string, detailedData: ResearchData[]): Promise<string> {
    if (detailedData.length === 0) return 'No detailed content available for summary.';

    const combinedContent = detailedData
      .map(data => `${data.title}: ${data.keyPoints.join(' ')}`)
      .join('\n\n')
      .slice(0, 3000);

    const prompt = `
Based on the research about "${query}", provide a comprehensive summary of the key findings:

${combinedContent}

Write a clear, informative summary that covers the main points and insights discovered.
`;

    try {
      return await this.aiProvider.generateCompletion(prompt);
    } catch (error) {
      console.error('Failed to generate summary:', error);
      return 'Summary generation failed. Please review the detailed findings below.';
    }
  }

  private async generateKeyFindings(detailedData: ResearchData[]): Promise<string[]> {
    const allKeyPoints = detailedData.flatMap(data => data.keyPoints);
    
    if (allKeyPoints.length === 0) return [];

    const prompt = `
From these research findings, identify the 5-7 most important and unique insights:

${allKeyPoints.join('\n')}

Return the key findings as a JSON array of strings, avoiding duplicates and focusing on the most significant insights.
`;

    try {
      const response = await this.aiProvider.generateStructuredOutput(prompt, {
        type: 'object',
        properties: {
          findings: {
            type: 'array',
            items: { type: 'string' }
          }
        },
        required: ['findings']
      });

      return response.findings || [];
    } catch (error) {
      console.error('Failed to generate key findings:', error);
      return allKeyPoints.slice(0, 5); // Fallback to first 5 key points
    }
  }

  private async generateComparison(detailedData: ResearchData[], query: string): Promise<any> {
    // Implementation for comparison format
    return {
      sources: detailedData.map(data => ({
        title: data.title,
        url: data.url,
        strengths: data.keyPoints.slice(0, 3),
        perspective: data.headings.slice(0, 2)
      })),
      commonThemes: await this.findCommonThemes(detailedData),
      differences: await this.findDifferences(detailedData)
    };
  }

  private async generateFormattedReport(query: string, reportData: any): Promise<string> {
    const prompt = `
Create a professional research report about "${query}" based on this data:

Summary: ${reportData.summary}
Key Findings: ${reportData.keyFindings.join(', ')}
Sources: ${reportData.sources.length} sources analyzed

Format as a professional report with sections: Executive Summary, Key Findings, Detailed Analysis, and Conclusions.
`;

    try {
      return await this.aiProvider.generateCompletion(prompt);
    } catch (error) {
      console.error('Failed to generate formatted report:', error);
      return `Research Report: ${query}\n\n${reportData.summary}\n\nKey Findings:\n${reportData.keyFindings.map((f: string) => `• ${f}`).join('\n')}`;
    }
  }

  private async findCommonThemes(detailedData: ResearchData[]): Promise<string[]> {
    // Simplified implementation - in production would use more sophisticated analysis
    const allPoints = detailedData.flatMap(data => data.keyPoints);
    return allPoints.slice(0, 3); // Placeholder
  }

  private async findDifferences(detailedData: ResearchData[]): Promise<string[]> {
    // Simplified implementation
    return ['Different perspectives found across sources']; // Placeholder
  }

  private deduplicateAndRankResults(results: SearchResult[]): SearchResult[] {
    const seen = new Set<string>();
    const unique = results.filter(result => {
      const key = result.url.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    return unique.sort((a, b) => b.relevanceScore - a.relevanceScore);
  }

  private getSearchUrl(source: string, query: string): string {
    const encodedQuery = encodeURIComponent(query);
    
    switch (source) {
      case 'google.com':
        return `https://www.google.com/search?q=${encodedQuery}`;
      case 'bing.com':
        return `https://www.bing.com/search?q=${encodedQuery}`;
      case 'duckduckgo.com':
        return `https://duckduckgo.com/?q=${encodedQuery}`;
      default:
        return `https://www.google.com/search?q=${encodedQuery}`;
    }
  }

  private getSearchResultsSelector(source: string) {
    const selectors = {
      'google.com': { css: '.g, .tF2Cxc, .MjjYud' },
      'bing.com': { css: '.b_algo, .b_result' },
      'duckduckgo.com': { css: '.result, .web-result' }
    };
    
    return selectors[source as keyof typeof selectors] || { css: '.result' };
  }

  private async handlePopups(page: Page): Promise<void> {
    const popupSelectors = [
      '#onetrust-accept-btn-handler', // OneTrust cookie banner
      '.cookie-accept', '.accept-cookies',
      '[aria-label*="Accept"]', '[aria-label*="Close"]',
      '.modal-close', '.popup-close', '.overlay-close'
    ];

    for (const selector of popupSelectors) {
      try {
        await page.click(selector, { timeout: 2000 });
        await page.waitForTimeout(1000);
      } catch (e) {
        // Popup not present, continue
      }
    }
  }

  override getEstimatedDuration(parameters: CommandParameters): number {
    const params = parameters as ResearchParams;
    const maxResults = params.maxResults || 10;
    const depth = params.depth || 'medium';
    
    const baseTime = 60000; // 1 minute base
    const searchTime = 30000; // 30 seconds per search engine
    const contentTime = depth === 'shallow' ? 15000 : depth === 'medium' ? 25000 : 40000; // Per detailed page
    
    return baseTime + (3 * searchTime) + (maxResults * contentTime);
  }
}