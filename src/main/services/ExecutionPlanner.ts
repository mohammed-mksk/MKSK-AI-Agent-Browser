import { 
  ParsedCommand, 
  ExecutionPlan, 
  AutomationStep, 
  ResourceRequirement, 
  FallbackStrategy,
  AutomationIntent,
  CommandParameters
} from '../../shared/types.js';
import { STEP_TYPES, AUTOMATION_TYPES } from '../../shared/constants.js';
import { AIProviderManager } from './AIProviderManager.js';
import { Logger } from './Logger.js';
import { nanoid } from 'nanoid';

export class ExecutionPlanner {
  private logger: Logger;
  private aiProvider: AIProviderManager;

  constructor(aiProvider: AIProviderManager) {
    this.logger = new Logger();
    this.aiProvider = aiProvider;
  }

  async createExecutionPlan(parsedCommand: ParsedCommand): Promise<ExecutionPlan> {
    try {
      this.logger.info(`Creating execution plan for intent: ${parsedCommand.intent.type}`);
      console.log('=== DEBUG: EXECUTION PLANNER ===');
      console.log(`Intent: ${parsedCommand.intent.type}`);
      console.log(`Suggested actions: ${parsedCommand.suggestedActions?.length || 0}`);
      
      const steps = await this.generateSteps(parsedCommand);
      console.log(`Generated steps: ${steps.length}`);
      
      const optimizedSteps = this.optimizeSteps(steps);
      console.log(`Optimized steps: ${optimizedSteps.length}`);
      
      const resources = this.calculateResourceRequirements(optimizedSteps);
      const fallbacks = this.createFallbackStrategies(optimizedSteps);
      const duration = this.estimateExecutionTime(optimizedSteps);

      const plan: ExecutionPlan = {
        id: nanoid(),
        steps: optimizedSteps,
        estimatedDuration: duration,
        requiredResources: resources,
        fallbackStrategies: fallbacks
      };

      this.logger.info(`Execution plan created with ${steps.length} steps, estimated duration: ${duration}ms`);
      console.log('=== DEBUG: FINAL EXECUTION PLAN ===');
      console.log(`Plan ID: ${plan.id}`);
      console.log(`Steps: ${plan.steps.length}`);
      plan.steps.forEach((step, index) => {
        console.log(`  Step ${index + 1}: ${step.type} - ${step.value || step.target?.text || 'No value'}`);
      });
      
      return plan;
    } catch (error) {
      this.logger.error('Failed to create execution plan:', error);
      throw error;
    }
  }

  private async generateSteps(parsedCommand: ParsedCommand): Promise<AutomationStep[]> {
    const { intent, parameters, suggestedActions } = parsedCommand;
    
    // If AI provided suggested actions, use them first
    if (suggestedActions && suggestedActions.length > 0) {
      this.logger.info(`Using AI-suggested actions: ${suggestedActions.length} steps`);
      return await this.convertSuggestedActionsToSteps(suggestedActions, parameters);
    }
    
    // Fallback to rule-based generation
    switch (intent.type) {
      case AUTOMATION_TYPES.SEARCH:
        return this.generateSearchSteps(parameters);
      case AUTOMATION_TYPES.FORM_FILL:
        return this.generateFormFillSteps(parameters);
      case AUTOMATION_TYPES.DATA_EXTRACT:
        return this.generateDataExtractionSteps(parameters);
      case AUTOMATION_TYPES.RESEARCH:
        return this.generateResearchSteps(parameters);
      case AUTOMATION_TYPES.NAVIGATE:
        return this.generateNavigationSteps(parameters);
      case AUTOMATION_TYPES.MONITOR:
        return this.generateMonitoringSteps(parameters);
      default:
        throw new Error(`Unsupported automation type: ${intent.type}`);
    }
  }

  private async convertSuggestedActionsToSteps(suggestedActions: any[], parameters: CommandParameters): Promise<AutomationStep[]> {
    const steps: AutomationStep[] = [];
    
    for (const action of suggestedActions) {
      const step: AutomationStep = {
        id: action.id || nanoid(),
        type: action.type,
        target: action.target || { css: 'body' },
        value: action.value,
        timeout: action.timeout || 10000,
        retryCount: action.retryCount || 3,
        description: action.description || `${action.type} step`
      };
      
      // Special handling for navigate steps without URLs
      if (step.type === 'navigate' && !step.value && step.target?.text) {
        // Generate appropriate URL based on search terms
        if (this.isFlightSearch(step.target.text)) {
          step.value = 'https://www.google.com/flights';
        } else {
          step.value = `https://www.google.com/search?q=${encodeURIComponent(step.target.text)}`;
        }
      }
      
      steps.push(step);
    }
    
    // Add a wait step after navigation for page loading
    if (steps.length > 0 && steps[0].type === 'navigate') {
      steps.splice(1, 0, {
        id: nanoid(),
        type: 'wait',
        target: { css: 'body' },
        timeout: 3000,
        retryCount: 1,
        description: 'Wait for page to load'
      });
    }
    
    // For flight searches, use multi-site search approach
    const searchTerms = parameters.searchTerms?.[0] || '';
    if (steps.length > 0 && (this.isFlightSearch(searchTerms) || steps[0].value?.includes('flights'))) {
      console.log('=== DEBUG: Using multi-site flight search ===');
      console.log(`Search terms: ${searchTerms}`);
      
      // Replace the simple steps with comprehensive multi-site search
      const multiSiteSteps = await this.generateMultiSiteFlightSearch(parameters);
      return multiSiteSteps;
    }
    
    return steps;
  }

  private addFlightSearchSteps(steps: AutomationStep[], parameters: CommandParameters): void {
    const searchTerms = parameters.searchTerms?.[0] || '';
    console.log(`=== DEBUG: addFlightSearchSteps called with: ${searchTerms} ===`);
    
    // Parse flight details from search terms
    const flightDetails = this.parseFlightDetails(searchTerms);
    console.log(`=== DEBUG: Parsed flight details ===`);
    console.log(`From: ${flightDetails.from}, To: ${flightDetails.to}`);
    
    if (flightDetails.from && flightDetails.to) {
      console.log('=== DEBUG: Adding form filling steps ===');
      // Add steps to fill flight search form
      const formSteps: AutomationStep[] = [
        // Analyze page structure first
        {
          id: nanoid(),
          type: 'analyze_page',
          target: { css: 'body' },
          timeout: 5000,
          retryCount: 1,
          description: 'Analyze page structure to find input fields'
        },
        // Fill departure airport
        {
          id: nanoid(),
          type: 'click',
          target: { 
            css: 'input[placeholder*="Where from"], input[aria-label*="Where from"], input[data-testid*="origin"], input[placeholder*="From"], input[aria-label*="From"]',
            xpath: '//input[contains(@placeholder, "Where from") or contains(@aria-label, "Where from") or contains(@placeholder, "From") or contains(@aria-label, "From")]'
          },
          timeout: 5000,
          retryCount: 3,
          description: 'Click departure airport field'
        },
        {
          id: nanoid(),
          type: 'type',
          target: { 
            css: 'input[placeholder*="Where from"], input[aria-label*="Where from"], input[data-testid*="origin"]'
          },
          value: flightDetails.from,
          timeout: 5000,
          retryCount: 3,
          description: `Enter departure airport: ${flightDetails.from}`
        },
        // Wait for dropdown and select first option
        {
          id: nanoid(),
          type: 'wait',
          target: { css: 'body' },
          timeout: 2000,
          retryCount: 1,
          description: 'Wait for airport suggestions'
        },
        {
          id: nanoid(),
          type: 'click',
          target: { 
            css: 'li[role="option"]:first-child, .suggestion:first-child, [data-testid*="airport-option"]:first-child'
          },
          timeout: 5000,
          retryCount: 3,
          description: 'Select first departure airport suggestion'
        },
        // Fill destination airport
        {
          id: nanoid(),
          type: 'click',
          target: { 
            css: 'input[placeholder*="Where to"], input[aria-label*="Where to"], input[data-testid*="destination"]',
            xpath: '//input[contains(@placeholder, "Where to") or contains(@aria-label, "Where to")]'
          },
          timeout: 5000,
          retryCount: 3,
          description: 'Click destination airport field'
        },
        {
          id: nanoid(),
          type: 'type',
          target: { 
            css: 'input[placeholder*="Where to"], input[aria-label*="Where to"], input[data-testid*="destination"]'
          },
          value: flightDetails.to,
          timeout: 5000,
          retryCount: 3,
          description: `Enter destination airport: ${flightDetails.to}`
        },
        // Wait and select destination
        {
          id: nanoid(),
          type: 'wait',
          target: { css: 'body' },
          timeout: 2000,
          retryCount: 1,
          description: 'Wait for destination suggestions'
        },
        {
          id: nanoid(),
          type: 'click',
          target: { 
            css: 'li[role="option"]:first-child, .suggestion:first-child, [data-testid*="airport-option"]:first-child'
          },
          timeout: 5000,
          retryCount: 3,
          description: 'Select first destination airport suggestion'
        },
        // Try to trigger search by pressing Enter in destination field (fallback)
        {
          id: nanoid(),
          type: 'key_press',
          target: { 
            css: 'input[placeholder*="Where to"], input[aria-label*="Where to"]'
          },
          value: 'Enter',
          timeout: 3000,
          retryCount: 2,
          description: 'Press Enter to trigger search'
        },
        // Search for flights
        {
          id: nanoid(),
          type: 'click',
          target: { 
            css: 'button[aria-label*="Explore flights"], button[aria-label*="Search"], button:contains("Search"), button:contains("Explore"), [data-testid*="search-button"]',
            xpath: '//button[contains(@aria-label, "Explore flights") or contains(@aria-label, "Search") or contains(text(), "Search") or contains(text(), "Explore")]'
          },
          timeout: 5000,
          retryCount: 3,
          description: 'Click search/explore flights button'
        },
        // Wait for results to load
        {
          id: nanoid(),
          type: 'wait',
          target: { css: 'body' },
          timeout: 10000,
          retryCount: 1,
          description: 'Wait for flight results to load'
        }
      ];
      
      // Insert form steps before the extract step
      const extractIndex = steps.findIndex(step => step.type === 'extract');
      if (extractIndex > -1) {
        steps.splice(extractIndex, 0, ...formSteps);
        console.log(`=== DEBUG: Inserted ${formSteps.length} form steps before extract step ===`);
      } else {
        steps.push(...formSteps);
        console.log(`=== DEBUG: Added ${formSteps.length} form steps at the end ===`);
      }
    } else {
      console.log('=== DEBUG: No flight details found, skipping form filling ===');
    }
  }

  private parseFlightDetails(searchTerms: string): { from: string; to: string; departDate?: string; returnDate?: string } {
    const text = searchTerms.toLowerCase();
    console.log(`=== DEBUG: Parsing flight details from: "${searchTerms}" ===`);
    
    // Extract airports (look for common airport codes or "from X to Y" pattern)
    let from = '';
    let to = '';
    
    // Look for airport codes (3 letters, case insensitive)
    const airportCodes = searchTerms.match(/\b[A-Za-z]{3}\b/g);
    console.log(`=== DEBUG: Found airport codes: ${JSON.stringify(airportCodes)} ===`);
    
    if (airportCodes && airportCodes.length >= 1) {
      from = airportCodes[0];
      // For the destination, look for city names or additional airport codes
      if (airportCodes.length >= 2) {
        to = airportCodes[1];
      }
    }
    
    // If we didn't find airport codes, look for "LHR to Mumbai" pattern
    if (!from || !to) {
      // Look for "X to Y" pattern (more flexible)
      const patterns = [
        /(\w+)\s+to\s+(\w+)/i,  // "LHR to Mumbai"
        /from\s+(\w+)\s+to\s+(\w+)/i,  // "from LHR to Mumbai"
        /(\w+)\s*-\s*(\w+)/i,  // "LHR-Mumbai"
      ];
      
      for (const pattern of patterns) {
        const match = searchTerms.match(pattern);
        if (match) {
          from = match[1].trim();
          to = match[2].trim();
          console.log(`=== DEBUG: Found pattern match: ${from} -> ${to} ===`);
          break;
        }
      }
    }
    
    // Convert city names to airport codes
    from = this.convertToAirportCode(from);
    to = this.convertToAirportCode(to);
    
    console.log(`=== DEBUG: Final parsed result: From="${from}", To="${to}" ===`);
    return { from, to };
  }

  private convertToAirportCode(cityOrCode: string): string {
    const cityToAirportMap: { [key: string]: string } = {
      // Major cities to airport codes
      'mumbai': 'BOM',
      'delhi': 'DEL',
      'bangalore': 'BLR',
      'chennai': 'MAA',
      'kolkata': 'CCU',
      'hyderabad': 'HYD',
      'pune': 'PNQ',
      'ahmedabad': 'AMD',
      'kochi': 'COK',
      'goa': 'GOI',
      
      // UK cities
      'london': 'LHR',
      'manchester': 'MAN',
      'birmingham': 'BHX',
      'glasgow': 'GLA',
      'edinburgh': 'EDI',
      
      // Other major cities
      'new york': 'JFK',
      'los angeles': 'LAX',
      'chicago': 'ORD',
      'miami': 'MIA',
      'toronto': 'YYZ',
      'vancouver': 'YVR',
      'paris': 'CDG',
      'amsterdam': 'AMS',
      'frankfurt': 'FRA',
      'zurich': 'ZUR',
      'dubai': 'DXB',
      'singapore': 'SIN',
      'hong kong': 'HKG',
      'tokyo': 'NRT',
      'sydney': 'SYD'
    };
    
    const normalized = cityOrCode.toLowerCase().trim();
    const airportCode = cityToAirportMap[normalized];
    
    if (airportCode) {
      console.log(`=== DEBUG: Converted "${cityOrCode}" to airport code "${airportCode}" ===`);
      return airportCode;
    }
    
    // If it's already an airport code or unknown city, return as-is
    return cityOrCode.toUpperCase();
  }

  private isFlightSearch(searchText: string): boolean {
    const flightKeywords = ['flight', 'flights', 'airport', 'airline', 'travel', 'LHR', 'JFK', 'LAX', 'return', 'departure'];
    return flightKeywords.some(keyword => searchText.toLowerCase().includes(keyword.toLowerCase()));
  }

  private generateSearchSteps(parameters: CommandParameters): AutomationStep[] {
    const steps: AutomationStep[] = [];
    const urls = parameters.urls || this.getDefaultSearchUrls(parameters);
    
    for (const url of urls) {
      // Navigate to search site
      steps.push({
        id: nanoid(),
        type: STEP_TYPES.NAVIGATE,
        target: { css: 'body' },
        value: url,
        timeout: 10000,
        retryCount: 3,
        description: `Navigate to ${url}`
      });

      // Wait for page load
      steps.push({
        id: nanoid(),
        type: STEP_TYPES.WAIT,
        target: { css: 'body' },
        timeout: 5000,
        retryCount: 2,
        description: 'Wait for page to load'
      });

      // Fill search form
      if (parameters.searchTerms) {
        steps.push({
          id: nanoid(),
          type: STEP_TYPES.TYPE,
          target: { 
            css: 'input[type="search"], input[name*="search"], input[placeholder*="search"]',
            xpath: '//input[contains(@placeholder, "search") or contains(@name, "search")]'
          },
          value: parameters.searchTerms.join(' '),
          timeout: 5000,
          retryCount: 3,
          description: 'Enter search terms'
        });

        // Submit search
        steps.push({
          id: nanoid(),
          type: STEP_TYPES.CLICK,
          target: { 
            css: 'button[type="submit"], input[type="submit"], button:contains("Search")',
            xpath: '//button[@type="submit"] | //input[@type="submit"] | //button[contains(text(), "Search")]'
          },
          timeout: 5000,
          retryCount: 3,
          description: 'Submit search form'
        });
      }

      // Wait for results
      steps.push({
        id: nanoid(),
        type: STEP_TYPES.WAIT,
        target: { css: '.results, .search-results, [data-testid*="result"]' },
        timeout: 10000,
        retryCount: 2,
        description: 'Wait for search results'
      });

      // Extract results
      steps.push({
        id: nanoid(),
        type: STEP_TYPES.EXTRACT,
        target: { css: '.results, .search-results, [data-testid*="result"]' },
        timeout: 5000,
        retryCount: 2,
        description: 'Extract search results'
      });

      // Take screenshot
      steps.push({
        id: nanoid(),
        type: STEP_TYPES.SCREENSHOT,
        target: { css: 'body' },
        timeout: 3000,
        retryCount: 1,
        description: 'Capture results screenshot'
      });
    }

    return steps;
  }

  private generateFormFillSteps(parameters: CommandParameters): AutomationStep[] {
    const steps: AutomationStep[] = [];
    const url = parameters.urls?.[0];
    
    if (url) {
      // Navigate to form
      steps.push({
        id: nanoid(),
        type: STEP_TYPES.NAVIGATE,
        target: { css: 'body' },
        value: url,
        timeout: 10000,
        retryCount: 3,
        description: `Navigate to form at ${url}`
      });
    }

    // Wait for form to load
    steps.push({
      id: nanoid(),
      type: STEP_TYPES.WAIT,
      target: { css: 'form, input, textarea, select' },
      timeout: 5000,
      retryCount: 2,
      description: 'Wait for form elements to load'
    });

    // Extract form structure first
    steps.push({
      id: nanoid(),
      type: STEP_TYPES.EXTRACT,
      target: { css: 'form' },
      timeout: 5000,
      retryCount: 2,
      description: 'Analyze form structure'
    });

    // Fill form fields (will be dynamically generated based on form analysis)
    if (parameters.formData) {
      Object.entries(parameters.formData).forEach(([field, value]) => {
        steps.push({
          id: nanoid(),
          type: STEP_TYPES.TYPE,
          target: { 
            css: `input[name="${field}"], textarea[name="${field}"], select[name="${field}"]`,
            xpath: `//input[@name="${field}"] | //textarea[@name="${field}"] | //select[@name="${field}"]`
          },
          value: value,
          timeout: 5000,
          retryCount: 3,
          description: `Fill field: ${field}`
        });
      });
    }

    // Take screenshot before submission
    steps.push({
      id: nanoid(),
      type: STEP_TYPES.SCREENSHOT,
      target: { css: 'body' },
      timeout: 3000,
      retryCount: 1,
      description: 'Capture form before submission'
    });

    return steps;
  }

  private generateDataExtractionSteps(parameters: CommandParameters): AutomationStep[] {
    const steps: AutomationStep[] = [];
    const urls = parameters.urls || [];
    
    for (const url of urls) {
      // Navigate to page
      steps.push({
        id: nanoid(),
        type: STEP_TYPES.NAVIGATE,
        target: { css: 'body' },
        value: url,
        timeout: 10000,
        retryCount: 3,
        description: `Navigate to ${url}`
      });

      // Wait for content
      steps.push({
        id: nanoid(),
        type: STEP_TYPES.WAIT,
        target: { css: 'body' },
        timeout: 5000,
        retryCount: 2,
        description: 'Wait for page content'
      });

      // Extract specified data
      if (parameters.extractionTargets) {
        parameters.extractionTargets.forEach(target => {
          steps.push({
            id: nanoid(),
            type: STEP_TYPES.EXTRACT,
            target: { css: target },
            timeout: 5000,
            retryCount: 2,
            description: `Extract data from: ${target}`
          });
        });
      } else {
        // Extract all structured data
        steps.push({
          id: nanoid(),
          type: STEP_TYPES.EXTRACT,
          target: { css: 'table, .data, .content, main, article' },
          timeout: 5000,
          retryCount: 2,
          description: 'Extract structured data'
        });
      }

      // Take screenshot
      steps.push({
        id: nanoid(),
        type: STEP_TYPES.SCREENSHOT,
        target: { css: 'body' },
        timeout: 3000,
        retryCount: 1,
        description: 'Capture page screenshot'
      });
    }

    return steps;
  }

  private generateResearchSteps(parameters: CommandParameters): AutomationStep[] {
    const steps: AutomationStep[] = [];
    const searchEngines = ['https://www.google.com', 'https://www.bing.com'];
    const searchTerms = parameters.searchTerms || [];

    for (const searchTerm of searchTerms) {
      for (const engine of searchEngines) {
        // Navigate to search engine
        steps.push({
          id: nanoid(),
          type: STEP_TYPES.NAVIGATE,
          target: { css: 'body' },
          value: engine,
          timeout: 10000,
          retryCount: 3,
          description: `Navigate to ${engine}`
        });

        // Search for term
        steps.push({
          id: nanoid(),
          type: STEP_TYPES.TYPE,
          target: { 
            css: 'input[name="q"], input[type="search"]',
            xpath: '//input[@name="q"] | //input[@type="search"]'
          },
          value: searchTerm,
          timeout: 5000,
          retryCount: 3,
          description: `Search for: ${searchTerm}`
        });

        // Submit search
        steps.push({
          id: nanoid(),
          type: STEP_TYPES.CLICK,
          target: { 
            css: 'button[type="submit"], input[type="submit"]',
            xpath: '//button[@type="submit"] | //input[@type="submit"]'
          },
          timeout: 5000,
          retryCount: 3,
          description: 'Submit search'
        });

        // Extract results
        steps.push({
          id: nanoid(),
          type: STEP_TYPES.EXTRACT,
          target: { css: '.g, .b_algo, .result' },
          timeout: 10000,
          retryCount: 2,
          description: 'Extract search results'
        });
      }
    }

    return steps;
  }

  private generateNavigationSteps(parameters: CommandParameters): AutomationStep[] {
    const steps: AutomationStep[] = [];
    const urls = parameters.urls || [];
    
    for (const url of urls) {
      steps.push({
        id: nanoid(),
        type: STEP_TYPES.NAVIGATE,
        target: { css: 'body' },
        value: url,
        timeout: 10000,
        retryCount: 3,
        description: `Navigate to ${url}`
      });

      steps.push({
        id: nanoid(),
        type: STEP_TYPES.SCREENSHOT,
        target: { css: 'body' },
        timeout: 3000,
        retryCount: 1,
        description: 'Capture page screenshot'
      });
    }

    return steps;
  }

  private generateMonitoringSteps(parameters: CommandParameters): AutomationStep[] {
    // Monitoring steps would be implemented for price tracking, etc.
    return this.generateDataExtractionSteps(parameters);
  }

  private getDefaultSearchUrls(parameters: CommandParameters): string[] {
    // Return default search URLs based on the type of search
    if (parameters.searchTerms?.some(term => 
      term.toLowerCase().includes('flight') || 
      term.toLowerCase().includes('airport') ||
      term.toLowerCase().includes('travel')
    )) {
      return [
        'https://www.google.com/flights',
        'https://www.kayak.co.uk',
        'https://www.skyscanner.net',
        'https://www.expedia.co.uk'
      ];
    }
    
    return ['https://www.google.com'];
  }

  private async generateMultiSiteFlightSearch(parameters: CommandParameters): Promise<AutomationStep[]> {
    const steps: AutomationStep[] = [];
    const searchTerms = parameters.searchTerms?.[0] || '';
    const flightDetails = this.parseFlightDetails(searchTerms);
    
    console.log(`=== DEBUG: AI-powered site selection for ${flightDetails.from} to ${flightDetails.to} ===`);
    
    // Use AI to determine the best sites for this specific flight search
    const selectedSites = await this.selectOptimalFlightSites(searchTerms, flightDetails);
    
    console.log(`=== DEBUG: AI selected ${selectedSites.length} optimal sites: ${selectedSites.map(s => s.name).join(', ')} ===`);
    
    for (const siteInfo of selectedSites) {
      console.log(`=== DEBUG: Adding steps for ${siteInfo.name} (Reason: ${siteInfo.reason}) ===`);
      
      // Navigate to site
      steps.push({
        id: nanoid(),
        type: 'navigate',
        target: { css: 'body' },
        value: siteInfo.url,
        timeout: 15000,
        retryCount: 3,
        description: `Navigate to ${siteInfo.name} - ${siteInfo.reason}`
      });
      
      // Wait for page load (site-specific timing)
      const waitTime = siteInfo.url.includes('skyscanner') ? 10000 : 
                      siteInfo.url.includes('momondo') ? 8000 : 5000;
      steps.push({
        id: nanoid(),
        type: 'wait',
        target: { css: 'body' },
        timeout: waitTime,
        retryCount: 1,
        description: `Wait for ${siteInfo.name} to load (${waitTime}ms)`
      });
      
      // Analyze page structure
      steps.push({
        id: nanoid(),
        type: 'analyze_page',
        target: { css: 'body' },
        timeout: 5000,
        retryCount: 1,
        description: `Analyze ${siteInfo.name} structure`
      });
      
      // Add CAPTCHA detection step for problematic sites
      if (siteInfo.url.includes('skyscanner')) {
        steps.push({
          id: nanoid(),
          type: 'captcha_check',
          target: { css: 'body' },
          timeout: 5000,
          retryCount: 1,
          description: 'Check for CAPTCHA/bot detection'
        });
      }
      
      // Add site-specific form filling steps
      if (siteInfo.url.includes('google.com/flights')) {
        steps.push(...this.generateGoogleFlightsSteps(flightDetails));
      } else if (siteInfo.url.includes('kayak')) {
        steps.push(...this.generateKayakSteps(flightDetails));
      } else if (siteInfo.url.includes('skyscanner')) {
        steps.push(...this.generateSkyscannerSteps(flightDetails));
      } else if (siteInfo.url.includes('expedia')) {
        steps.push(...this.generateExpediaSteps(flightDetails));
      } else if (siteInfo.url.includes('momondo')) {
        steps.push(...this.generateMomondoSteps(flightDetails));
      } else if (siteInfo.url.includes('cheapflights')) {
        steps.push(...this.generateCheapflightsSteps(flightDetails));
      }
      
      // Extract results
      steps.push({
        id: nanoid(),
        type: 'extract',
        target: { css: '.flight-result, [data-testid*="flight"], .result, .price, .fare' },
        timeout: 15000,
        retryCount: 3,
        description: `Extract results from ${siteInfo.name}`
      });
      
      // Take screenshot
      steps.push({
        id: nanoid(),
        type: 'screenshot',
        target: { css: 'body' },
        timeout: 3000,
        retryCount: 1,
        description: `Screenshot ${siteInfo.name} results`
      });
    }
    
    return steps;
  }

  private async selectOptimalFlightSites(searchTerms: string, flightDetails: { from: string; to: string }): Promise<Array<{name: string, url: string, reason: string}>> {
    try {
      const prompt = this.createSiteSelectionPrompt(searchTerms, flightDetails);
      const response = await this.aiProvider.generateCompletion(prompt);
      
      console.log('=== DEBUG: AI Site Selection Response ===');
      console.log(response);
      
      const parsed = JSON.parse(response);
      return parsed.selectedSites || this.getDefaultSiteSelection(flightDetails);
      
    } catch (error) {
      console.log('=== DEBUG: AI site selection failed, using fallback ===');
      return this.getDefaultSiteSelection(flightDetails);
    }
  }

  private createSiteSelectionPrompt(searchTerms: string, flightDetails: { from: string; to: string }): string {
    return `
You are a flight booking expert. Analyze this flight search and recommend the best 3-4 flight booking websites.

Flight Search: "${searchTerms}"
Route: ${flightDetails.from} → ${flightDetails.to}

Available flight booking sites:
1. Google Flights (https://www.google.com/flights) - Comprehensive search, good for all routes
2. Kayak UK (https://www.kayak.co.uk) - Strong in Europe and UK, good deals
3. Skyscanner (https://www.skyscanner.net) - Excellent for international routes, budget airlines
4. Expedia UK (https://www.expedia.co.uk) - Good for package deals, established routes
5. Momondo (https://www.momondo.co.uk) - Great for finding hidden deals, alternative routes
6. Cheapflights UK (https://www.cheapflights.co.uk) - Specialized in budget options
7. British Airways (https://www.britishairways.com) - Direct bookings, premium routes
8. Emirates (https://www.emirates.com) - Middle East/Asia routes, premium service

Consider these factors:
- Route type (domestic UK, Europe, intercontinental, Asia, etc.)
- Likely best sites for this specific route
- Budget vs premium preferences
- Airline coverage for this route
- Regional expertise

Return a JSON response:
{
  "selectedSites": [
    {
      "name": "Site Name",
      "url": "https://...",
      "reason": "Why this site is optimal for this route"
    }
  ]
}

Select 3-4 sites maximum. Prioritize sites most likely to have the best deals and coverage for this specific route.
Return ONLY valid JSON.`;
  }

  private getDefaultSiteSelection(flightDetails: { from: string; to: string }): Array<{name: string, url: string, reason: string}> {
    // Intelligent fallback based on route analysis
    const from = flightDetails.from.toLowerCase();
    const to = flightDetails.to.toLowerCase();
    
    // UK to India/Asia route - prioritize sites with less bot detection
    if ((from.includes('lhr') || from.includes('london')) && (to.includes('mumbai') || to.includes('delhi') || to.includes('india'))) {
      return [
        { name: 'Google Flights', url: 'https://www.google.com/flights', reason: 'Comprehensive search for UK-India routes, reliable access' },
        { name: 'Momondo', url: 'https://www.momondo.co.uk', reason: 'Often finds hidden deals on international routes' },
        { name: 'Kayak UK', url: 'https://www.kayak.co.uk', reason: 'Strong UK departure coverage' },
        // Note: Skyscanner moved to last due to CAPTCHA issues
        { name: 'Skyscanner', url: 'https://www.skyscanner.net', reason: 'Excellent for long-haul flights (may have access restrictions)' }
      ];
    }
    
    // European routes
    if (this.isEuropeanRoute(from, to)) {
      return [
        { name: 'Skyscanner', url: 'https://www.skyscanner.net', reason: 'Best for European budget airlines' },
        { name: 'Kayak UK', url: 'https://www.kayak.co.uk', reason: 'Strong European coverage' },
        { name: 'Google Flights', url: 'https://www.google.com/flights', reason: 'Comprehensive European search' }
      ];
    }
    
    // Default international
    return [
      { name: 'Google Flights', url: 'https://www.google.com/flights', reason: 'Comprehensive global coverage' },
      { name: 'Skyscanner', url: 'https://www.skyscanner.net', reason: 'Excellent international route coverage' },
      { name: 'Kayak UK', url: 'https://www.kayak.co.uk', reason: 'Good alternative pricing' }
    ];
  }

  private isEuropeanRoute(from: string, to: string): boolean {
    const europeanCities = ['paris', 'berlin', 'rome', 'madrid', 'amsterdam', 'brussels', 'zurich', 'vienna', 'prague'];
    const europeanCodes = ['cdg', 'ber', 'fco', 'mad', 'ams', 'bru', 'zur', 'vie', 'prg'];
    
    return europeanCities.some(city => from.includes(city) || to.includes(city)) ||
           europeanCodes.some(code => from.includes(code) || to.includes(code));
  }

  private generateGoogleFlightsSteps(flightDetails: { from: string; to: string }): AutomationStep[] {
    return [
      // Smart fill departure with better selectors
      {
        id: nanoid(),
        type: 'smart_fill',
        target: { 
          css: 'input[aria-label*="Where from"], input[aria-label*="Where from?"]',
          xpath: '//input[contains(@aria-label, "Where from")]'
        },
        value: flightDetails.from,
        timeout: 5000,
        retryCount: 3,
        description: `Fill Google Flights departure: ${flightDetails.from}`
      },
      // Wait for suggestions
      {
        id: nanoid(),
        type: 'wait',
        target: { css: 'body' },
        timeout: 2000,
        retryCount: 1,
        description: 'Wait for departure suggestions'
      },
      // Try to click first suggestion
      {
        id: nanoid(),
        type: 'click',
        target: { 
          css: 'li[role="option"]:first-child, .suggestion:first-child, [data-testid*="airport-option"]:first-child',
          xpath: '//li[@role="option"][1]'
        },
        timeout: 3000,
        retryCount: 2,
        description: 'Select first departure suggestion'
      },
      // Smart fill destination
      {
        id: nanoid(),
        type: 'smart_fill',
        target: { 
          css: 'input[aria-label*="Where to"], input[placeholder*="Where to"]',
          xpath: '//input[contains(@aria-label, "Where to")]'
        },
        value: flightDetails.to,
        timeout: 5000,
        retryCount: 3,
        description: `Fill Google Flights destination: ${flightDetails.to}`
      },
      // Wait for destination suggestions
      {
        id: nanoid(),
        type: 'wait',
        target: { css: 'body' },
        timeout: 2000,
        retryCount: 1,
        description: 'Wait for destination suggestions'
      },
      // Try to click first destination suggestion
      {
        id: nanoid(),
        type: 'click',
        target: { 
          css: 'li[role="option"]:first-child, .suggestion:first-child, [data-testid*="airport-option"]:first-child',
          xpath: '//li[@role="option"][1]'
        },
        timeout: 3000,
        retryCount: 2,
        description: 'Select first destination suggestion'
      },
      // Trigger search with Enter
      {
        id: nanoid(),
        type: 'key_press',
        target: { css: 'input[aria-label*="Where to"]' },
        value: 'Enter',
        timeout: 3000,
        retryCount: 2,
        description: 'Trigger search with Enter'
      },
      // Wait for results
      {
        id: nanoid(),
        type: 'wait',
        target: { css: 'body' },
        timeout: 10000,
        retryCount: 1,
        description: 'Wait for Google Flights results'
      }
    ];
  }

  private generateKayakSteps(flightDetails: { from: string; to: string }): AutomationStep[] {
    return [
      {
        id: nanoid(),
        type: 'smart_fill',
        target: { css: 'input[placeholder*="From"], input[aria-label*="From"]' },
        value: flightDetails.from,
        timeout: 5000,
        retryCount: 3,
        description: `Fill Kayak departure: ${flightDetails.from}`
      },
      {
        id: nanoid(),
        type: 'smart_fill',
        target: { css: 'input[placeholder*="To"], input[aria-label*="To"]' },
        value: flightDetails.to,
        timeout: 5000,
        retryCount: 3,
        description: `Fill Kayak destination: ${flightDetails.to}`
      },
      {
        id: nanoid(),
        type: 'click',
        target: { css: 'button[aria-label*="Search"], button:contains("Search")' },
        timeout: 5000,
        retryCount: 3,
        description: 'Click Kayak search button'
      },
      {
        id: nanoid(),
        type: 'wait',
        target: { css: 'body' },
        timeout: 15000,
        retryCount: 1,
        description: 'Wait for Kayak results'
      }
    ];
  }

  private generateSkyscannerSteps(flightDetails: { from: string; to: string }): AutomationStep[] {
    return [
      // Wait longer for Skyscanner to load (it's a heavy SPA)
      {
        id: nanoid(),
        type: 'wait',
        target: { css: 'body' },
        timeout: 8000,
        retryCount: 1,
        description: 'Wait for Skyscanner to fully load'
      },
      // Try to find and click flights section first
      {
        id: nanoid(),
        type: 'click',
        target: { 
          css: 'a[href*="flights"], button:contains("Flights"), [data-testid*="flights"]',
          xpath: '//a[contains(@href, "flights")] | //button[contains(text(), "Flights")]'
        },
        timeout: 5000,
        retryCount: 2,
        description: 'Navigate to flights section'
      },
      // Wait for flights form to appear
      {
        id: nanoid(),
        type: 'wait',
        target: { css: 'body' },
        timeout: 5000,
        retryCount: 1,
        description: 'Wait for flights form'
      },
      {
        id: nanoid(),
        type: 'smart_fill',
        target: { 
          css: 'input[placeholder*="From"], input[name*="origin"], input[data-testid*="origin"], input[aria-label*="origin"]',
          xpath: '//input[contains(@placeholder, "From") or contains(@name, "origin")]'
        },
        value: flightDetails.from,
        timeout: 5000,
        retryCount: 3,
        description: `Fill Skyscanner departure: ${flightDetails.from}`
      },
      {
        id: nanoid(),
        type: 'smart_fill',
        target: { 
          css: 'input[placeholder*="To"], input[name*="destination"], input[data-testid*="destination"], input[aria-label*="destination"]',
          xpath: '//input[contains(@placeholder, "To") or contains(@name, "destination")]'
        },
        value: flightDetails.to,
        timeout: 5000,
        retryCount: 3,
        description: `Fill Skyscanner destination: ${flightDetails.to}`
      },
      {
        id: nanoid(),
        type: 'click',
        target: { 
          css: 'button[data-testid*="search"], button:contains("Search"), button[type="submit"]',
          xpath: '//button[contains(@data-testid, "search") or contains(text(), "Search")]'
        },
        timeout: 5000,
        retryCount: 3,
        description: 'Click Skyscanner search button'
      },
      {
        id: nanoid(),
        type: 'wait',
        target: { css: 'body' },
        timeout: 15000,
        retryCount: 1,
        description: 'Wait for Skyscanner results'
      }
    ];
  }

  private generateExpediaSteps(flightDetails: { from: string; to: string }): AutomationStep[] {
    return [
      {
        id: nanoid(),
        type: 'smart_fill',
        target: { css: 'input[data-stid*="origin"], input[placeholder*="Leaving from"]' },
        value: flightDetails.from,
        timeout: 5000,
        retryCount: 3,
        description: `Fill Expedia departure: ${flightDetails.from}`
      },
      {
        id: nanoid(),
        type: 'smart_fill',
        target: { css: 'input[data-stid*="destination"], input[placeholder*="Going to"]' },
        value: flightDetails.to,
        timeout: 5000,
        retryCount: 3,
        description: `Fill Expedia destination: ${flightDetails.to}`
      },
      {
        id: nanoid(),
        type: 'click',
        target: { css: 'button[data-testid*="submit"], button:contains("Search")' },
        timeout: 5000,
        retryCount: 3,
        description: 'Click Expedia search button'
      },
      {
        id: nanoid(),
        type: 'wait',
        target: { css: 'body' },
        timeout: 15000,
        retryCount: 1,
        description: 'Wait for Expedia results'
      }
    ];
  }

  private generateMomondoSteps(flightDetails: { from: string; to: string }): AutomationStep[] {
    return [
      {
        id: nanoid(),
        type: 'smart_fill',
        target: { 
          css: 'input[aria-label*="Flight origin"], input[placeholder*="From"], input[data-testid*="origin"]',
          xpath: '//input[contains(@aria-label, "Flight origin") or contains(@placeholder, "From")]'
        },
        value: flightDetails.from,
        timeout: 5000,
        retryCount: 3,
        description: `Fill Momondo departure: ${flightDetails.from}`
      },
      {
        id: nanoid(),
        type: 'smart_fill',
        target: { 
          css: 'input[aria-label*="Flight destination"], input[placeholder*="To"], input[data-testid*="destination"]',
          xpath: '//input[contains(@aria-label, "Flight destination") or contains(@placeholder, "To")]'
        },
        value: flightDetails.to,
        timeout: 5000,
        retryCount: 3,
        description: `Fill Momondo destination: ${flightDetails.to}`
      },
      {
        id: nanoid(),
        type: 'click',
        target: { 
          css: 'button[aria-label*="Search"], button:contains("Search"), .RxNS-mod-animation-search',
          xpath: '//button[contains(@aria-label, "Search") or contains(text(), "Search")]'
        },
        timeout: 5000,
        retryCount: 3,
        description: 'Click Momondo search button'
      },
      {
        id: nanoid(),
        type: 'wait',
        target: { css: 'body' },
        timeout: 15000,
        retryCount: 1,
        description: 'Wait for Momondo results'
      }
    ];
  }

  private generateCheapflightsSteps(flightDetails: { from: string; to: string }): AutomationStep[] {
    return [
      {
        id: nanoid(),
        type: 'smart_fill',
        target: { css: 'input[name*="origin"], input[placeholder*="From"]' },
        value: flightDetails.from,
        timeout: 5000,
        retryCount: 3,
        description: `Fill Cheapflights departure: ${flightDetails.from}`
      },
      {
        id: nanoid(),
        type: 'smart_fill',
        target: { css: 'input[name*="destination"], input[placeholder*="To"]' },
        value: flightDetails.to,
        timeout: 5000,
        retryCount: 3,
        description: `Fill Cheapflights destination: ${flightDetails.to}`
      },
      {
        id: nanoid(),
        type: 'click',
        target: { css: 'button[type="submit"], button:contains("Search")' },
        timeout: 5000,
        retryCount: 3,
        description: 'Click Cheapflights search button'
      },
      {
        id: nanoid(),
        type: 'wait',
        target: { css: 'body' },
        timeout: 15000,
        retryCount: 1,
        description: 'Wait for Cheapflights results'
      }
    ];
  }

  private optimizeSteps(steps: AutomationStep[]): AutomationStep[] {
    // Remove duplicate navigation steps
    const optimized: AutomationStep[] = [];
    let lastUrl = '';

    for (const step of steps) {
      if (step.type === STEP_TYPES.NAVIGATE) {
        if (step.value !== lastUrl) {
          optimized.push(step);
          lastUrl = step.value || '';
        }
      } else {
        optimized.push(step);
      }
    }

    return optimized;
  }

  private calculateResourceRequirements(steps: AutomationStep[]): ResourceRequirement[] {
    const navigateSteps = steps.filter(s => s.type === STEP_TYPES.NAVIGATE).length;
    const extractSteps = steps.filter(s => s.type === STEP_TYPES.EXTRACT).length;
    
    return [
      {
        type: 'browser',
        amount: Math.min(navigateSteps, 3), // Max 3 concurrent browsers
        unit: 'instances'
      },
      {
        type: 'memory',
        amount: navigateSteps * 100 + extractSteps * 50, // Rough estimate in MB
        unit: 'MB'
      },
      {
        type: 'network',
        amount: navigateSteps * 2 + extractSteps * 1, // Rough estimate in requests/min
        unit: 'requests/min'
      }
    ];
  }

  private createFallbackStrategies(steps: AutomationStep[]): FallbackStrategy[] {
    return [
      {
        condition: 'element_not_found',
        alternativeSteps: [
          {
            id: nanoid(),
            type: STEP_TYPES.WAIT,
            target: { css: 'body' },
            timeout: 5000,
            retryCount: 1,
            description: 'Wait and retry'
          }
        ]
      },
      {
        condition: 'timeout',
        alternativeSteps: [
          {
            id: nanoid(),
            type: STEP_TYPES.SCREENSHOT,
            target: { css: 'body' },
            timeout: 3000,
            retryCount: 1,
            description: 'Capture error state'
          }
        ]
      }
    ];
  }

  estimateExecutionTime(steps: AutomationStep[]): number {
    let totalTime = 0;
    
    for (const step of steps) {
      switch (step.type) {
        case STEP_TYPES.NAVIGATE:
          totalTime += 5000; // 5 seconds for navigation
          break;
        case STEP_TYPES.WAIT:
          totalTime += step.timeout;
          break;
        case STEP_TYPES.CLICK:
        case STEP_TYPES.TYPE:
          totalTime += 1000; // 1 second for interactions
          break;
        case STEP_TYPES.EXTRACT:
          totalTime += 3000; // 3 seconds for extraction
          break;
        case STEP_TYPES.SCREENSHOT:
          totalTime += 2000; // 2 seconds for screenshots
          break;
        default:
          totalTime += 1000;
      }
    }
    
    return totalTime;
  }

  validatePlan(plan: ExecutionPlan): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (plan.steps.length === 0) {
      errors.push('Execution plan must contain at least one step');
    }
    
    // Check for required navigation steps
    const hasNavigation = plan.steps.some(s => s.type === STEP_TYPES.NAVIGATE);
    if (!hasNavigation) {
      errors.push('Execution plan must include at least one navigation step');
    }
    
    // Validate step sequences
    for (let i = 0; i < plan.steps.length; i++) {
      const step = plan.steps[i];
      
      if (!step.target.css && !step.target.xpath && !step.target.text) {
        errors.push(`Step ${i + 1} must have at least one target selector`);
      }
      
      if (step.timeout <= 0) {
        errors.push(`Step ${i + 1} must have a positive timeout value`);
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
}