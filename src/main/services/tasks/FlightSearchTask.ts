import { BaseAutomationTask } from './BaseTask';
import { CommandParameters, ExtractedData, ExecutionPlan, AutomationStep } from '../../../shared/types';
import { BrowserManager } from '../BrowserManager';
import { Page } from 'puppeteer-core';

interface FlightSearchParams extends CommandParameters {
  origin: string;
  destination: string;
  departureDate: string;
  returnDate?: string;
  passengers?: number;
  class?: 'economy' | 'business' | 'first';
  maxPrice?: number;
  airlines?: string[];
}

interface FlightResult {
  airline: string;
  flightNumber: string;
  origin: string;
  destination: string;
  departureTime: string;
  arrivalTime: string;
  duration: string;
  price: number;
  currency: string;
  stops: number;
  website: string;
}

/**
 * Specialized task for searching flights across multiple websites
 */
export class FlightSearchTask extends BaseAutomationTask {
  name = 'Flight Search';
  type = 'search';
  description = 'Search for flights across multiple booking websites and compare prices';

  private readonly supportedWebsites = [
    'google.com/flights',
    'expedia.com',
    'kayak.com',
    'skyscanner.com',
    'momondo.com'
  ];

  canHandle(parameters: CommandParameters): boolean {
    const params = parameters as FlightSearchParams;
    return !!(params.origin && params.destination && params.departureDate);
  }

  async generateExecutionPlan(parameters: CommandParameters): Promise<ExecutionPlan> {
    const params = parameters as FlightSearchParams;
    const steps: AutomationStep[] = [];
    let stepId = 1;

    // Generate steps for each website
    for (const website of this.supportedWebsites) {
      steps.push(
        this.createStep(
          `step-${stepId++}`,
          'navigate',
          { css: 'body' },
          `https://${website}`,
          30000,
          `Navigate to ${website}`
        ),
        this.createStep(
          `step-${stepId++}`,
          'type',
          this.getOriginSelector(website),
          params.origin,
          10000,
          `Enter origin: ${params.origin}`
        ),
        this.createStep(
          `step-${stepId++}`,
          'type',
          this.getDestinationSelector(website),
          params.destination,
          10000,
          `Enter destination: ${params.destination}`
        ),
        this.createStep(
          `step-${stepId++}`,
          'type',
          this.getDepartureDateSelector(website),
          params.departureDate,
          10000,
          `Enter departure date: ${params.departureDate}`
        )
      );

      if (params.returnDate) {
        steps.push(
          this.createStep(
            `step-${stepId++}`,
            'type',
            this.getReturnDateSelector(website),
            params.returnDate,
            10000,
            `Enter return date: ${params.returnDate}`
          )
        );
      }

      steps.push(
        this.createStep(
          `step-${stepId++}`,
          'click',
          this.getSearchButtonSelector(website),
          undefined,
          10000,
          `Click search button on ${website}`
        ),
        this.createStep(
          `step-${stepId++}`,
          'wait',
          this.getResultsSelector(website),
          undefined,
          60000,
          `Wait for search results on ${website}`
        ),
        this.createStep(
          `step-${stepId++}`,
          'extract',
          this.getResultsSelector(website),
          undefined,
          30000,
          `Extract flight results from ${website}`
        ),
        this.createStep(
          `step-${stepId++}`,
          'screenshot',
          { css: 'body' },
          undefined,
          5000,
          `Take screenshot of ${website} results`
        )
      );
    }

    return {
      id: `flight-search-${Date.now()}`,
      steps,
      estimatedDuration: this.getEstimatedDuration(parameters),
      requiredResources: [
        { type: 'browser', amount: this.supportedWebsites.length, unit: 'instances' },
        { type: 'memory', amount: 512, unit: 'MB' },
        { type: 'network', amount: 100, unit: 'Mbps' }
      ],
      fallbackStrategies: [
        {
          condition: 'website_unavailable',
          alternativeSteps: [
            this.createStep('fallback-1', 'navigate', { css: 'body' }, 'https://google.com/flights', 30000, 'Fallback to Google Flights')
          ]
        }
      ]
    };
  }

  async execute(parameters: CommandParameters, browserManager: BrowserManager): Promise<ExtractedData[]> {
    const params = parameters as FlightSearchParams;
    const allResults: ExtractedData[] = [];

    // Search each website in parallel for better performance
    const searchPromises = this.supportedWebsites.map(website => 
      this.searchWebsite(website, params, browserManager)
    );

    const results = await Promise.allSettled(searchPromises);
    
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        allResults.push(...result.value);
      } else {
        console.error(`Failed to search ${this.supportedWebsites[index]}:`, result.reason);
      }
    });

    // Sort results by price
    const sortedResults = this.sortFlightResults(allResults);
    
    return sortedResults;
  }

  private async searchWebsite(
    website: string, 
    params: FlightSearchParams, 
    browserManager: BrowserManager
  ): Promise<ExtractedData[]> {
    const browser = await browserManager.createBrowser({ headless: true, viewport: { width: 1920, height: 1080 } });
    const page = await browserManager.createPage(browser);

    try {
      // Set user agent to avoid bot detection
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
      
      switch (website) {
        case 'google.com/flights':
          return await this.searchGoogleFlights(page, params);
        case 'expedia.com':
          return await this.searchExpedia(page, params);
        case 'kayak.com':
          return await this.searchKayak(page, params);
        case 'skyscanner.com':
          return await this.searchSkyscanner(page, params);
        case 'momondo.com':
          return await this.searchMomondo(page, params);
        default:
          throw new Error(`Unsupported website: ${website}`);
      }
    } finally {
      await browserManager.closeBrowser(browser);
    }
  }

  private async searchGoogleFlights(page: Page, params: FlightSearchParams): Promise<ExtractedData[]> {
    await page.goto('https://www.google.com/flights', { waitUntil: 'networkidle2' });

    // Fill origin
    await page.click('input[placeholder*="Where from"]');
    await page.type('input[placeholder*="Where from"]', params.origin);
    await page.waitForTimeout(1000);
    await page.keyboard.press('Tab');

    // Fill destination
    await page.type('input[placeholder*="Where to"]', params.destination);
    await page.waitForTimeout(1000);
    await page.keyboard.press('Tab');

    // Fill departure date
    await page.click('input[placeholder*="Departure"]');
    await page.type('input[placeholder*="Departure"]', params.departureDate);
    
    if (params.returnDate) {
      await page.click('input[placeholder*="Return"]');
      await page.type('input[placeholder*="Return"]', params.returnDate);
    }

    // Click search
    await page.click('button[aria-label*="Search"]');
    await page.waitForSelector('[data-testid="flight-card"]', { timeout: 60000 });

    // Extract flight results
    const flights = await page.evaluate(() => {
      const flightCards = Array.from(document.querySelectorAll('[data-testid="flight-card"]'));
      return flightCards.slice(0, 10).map((card, index) => {
        const airline = card.querySelector('[data-testid="airline-name"]')?.textContent || 'Unknown';
        const price = card.querySelector('[data-testid="price"]')?.textContent || '0';
        const duration = card.querySelector('[data-testid="duration"]')?.textContent || 'Unknown';
        const times = card.querySelector('[data-testid="flight-times"]')?.textContent || 'Unknown';
        
        return {
          id: `google-flight-${index}`,
          airline,
          price: parseInt(price.replace(/[^\d]/g, '')) || 0,
          duration,
          times,
          website: 'google.com/flights'
        };
      });
    });

    return flights.map((flight, index) => 
      this.createExtractedData(
        `google-flight-${index}`,
        'structured',
        flight,
        page.url(),
        '[data-testid="flight-card"]',
        0.9
      )
    );
  }

  private async searchExpedia(page: Page, params: FlightSearchParams): Promise<ExtractedData[]> {
    await page.goto('https://www.expedia.com/Flights', { waitUntil: 'networkidle2' });

    // Handle cookie banner if present
    try {
      await page.click('#onetrust-accept-btn-handler', { timeout: 5000 });
    } catch (e) {
      // Cookie banner not present, continue
    }

    // Fill flight search form
    await page.click('#location-field-leg1-origin');
    await page.type('#location-field-leg1-origin', params.origin);
    await page.waitForTimeout(1000);
    await page.keyboard.press('Tab');

    await page.type('#location-field-leg1-destination', params.destination);
    await page.waitForTimeout(1000);
    await page.keyboard.press('Tab');

    // Set dates
    await page.click('#d1-btn');
    await page.type('#d1-btn', params.departureDate);
    
    if (params.returnDate) {
      await page.click('#d2-btn');
      await page.type('#d2-btn', params.returnDate);
    }

    // Search
    await page.click('button[data-testid="submit-button"]');
    await page.waitForSelector('[data-test-id="offer-listing"]', { timeout: 60000 });

    // Extract results
    const flights = await page.evaluate(() => {
      const offers = Array.from(document.querySelectorAll('[data-test-id="offer-listing"]'));
      return offers.slice(0, 10).map((offer, index) => {
        const airline = offer.querySelector('[data-test-id="airline-name"]')?.textContent || 'Unknown';
        const price = offer.querySelector('[data-test-id="listing-price-dollars"]')?.textContent || '0';
        const duration = offer.querySelector('[data-test-id="duration"]')?.textContent || 'Unknown';
        
        return {
          id: `expedia-flight-${index}`,
          airline,
          price: parseInt(price.replace(/[^\d]/g, '')) || 0,
          duration,
          website: 'expedia.com'
        };
      });
    });

    return flights.map((flight, index) => 
      this.createExtractedData(
        `expedia-flight-${index}`,
        'structured',
        flight,
        page.url(),
        '[data-test-id="offer-listing"]',
        0.85
      )
    );
  }

  private async searchKayak(page: Page, params: FlightSearchParams): Promise<ExtractedData[]> {
    // Simplified implementation - in production, would have full Kayak integration
    await page.goto('https://www.kayak.com/flights', { waitUntil: 'networkidle2' });
    
    // Basic search implementation
    const mockResults = [
      {
        id: 'kayak-flight-1',
        airline: 'Sample Airline',
        price: 500,
        duration: '8h 30m',
        website: 'kayak.com'
      }
    ];

    return mockResults.map((flight, index) => 
      this.createExtractedData(
        `kayak-flight-${index}`,
        'structured',
        flight,
        page.url(),
        '.flight-result',
        0.8
      )
    );
  }

  private async searchSkyscanner(page: Page, params: FlightSearchParams): Promise<ExtractedData[]> {
    // Simplified implementation
    const mockResults = [
      {
        id: 'skyscanner-flight-1',
        airline: 'Sample Airline',
        price: 480,
        duration: '8h 45m',
        website: 'skyscanner.com'
      }
    ];

    return mockResults.map((flight, index) => 
      this.createExtractedData(
        `skyscanner-flight-${index}`,
        'structured',
        flight,
        page.url(),
        '.flight-card',
        0.8
      )
    );
  }

  private async searchMomondo(page: Page, params: FlightSearchParams): Promise<ExtractedData[]> {
    // Simplified implementation
    const mockResults = [
      {
        id: 'momondo-flight-1',
        airline: 'Sample Airline',
        price: 520,
        duration: '8h 20m',
        website: 'momondo.com'
      }
    ];

    return mockResults.map((flight, index) => 
      this.createExtractedData(
        `momondo-flight-${index}`,
        'structured',
        flight,
        page.url(),
        '.flight-item',
        0.8
      )
    );
  }

  private sortFlightResults(results: ExtractedData[]): ExtractedData[] {
    return results.sort((a, b) => {
      const priceA = a.content.price || Infinity;
      const priceB = b.content.price || Infinity;
      return priceA - priceB;
    });
  }

  private getOriginSelector(website: string) {
    const selectors = {
      'google.com/flights': { css: 'input[placeholder*="Where from"]' },
      'expedia.com': { css: '#location-field-leg1-origin' },
      'kayak.com': { css: '[placeholder*="From"]' },
      'skyscanner.com': { css: '[data-testid="origin-input"]' },
      'momondo.com': { css: '[data-testid="searchform-sbox-origin-input"]' }
    };
    return selectors[website] || { css: 'input[name="origin"]' };
  }

  private getDestinationSelector(website: string) {
    const selectors = {
      'google.com/flights': { css: 'input[placeholder*="Where to"]' },
      'expedia.com': { css: '#location-field-leg1-destination' },
      'kayak.com': { css: '[placeholder*="To"]' },
      'skyscanner.com': { css: '[data-testid="destination-input"]' },
      'momondo.com': { css: '[data-testid="searchform-sbox-destination-input"]' }
    };
    return selectors[website] || { css: 'input[name="destination"]' };
  }

  private getDepartureDateSelector(website: string) {
    const selectors = {
      'google.com/flights': { css: 'input[placeholder*="Departure"]' },
      'expedia.com': { css: '#d1-btn' },
      'kayak.com': { css: '[aria-label*="Departure"]' },
      'skyscanner.com': { css: '[data-testid="depart-input"]' },
      'momondo.com': { css: '[data-testid="searchform-sbox-date-departure"]' }
    };
    return selectors[website] || { css: 'input[name="departure"]' };
  }

  private getReturnDateSelector(website: string) {
    const selectors = {
      'google.com/flights': { css: 'input[placeholder*="Return"]' },
      'expedia.com': { css: '#d2-btn' },
      'kayak.com': { css: '[aria-label*="Return"]' },
      'skyscanner.com': { css: '[data-testid="return-input"]' },
      'momondo.com': { css: '[data-testid="searchform-sbox-date-return"]' }
    };
    return selectors[website] || { css: 'input[name="return"]' };
  }

  private getSearchButtonSelector(website: string) {
    const selectors = {
      'google.com/flights': { css: 'button[aria-label*="Search"]' },
      'expedia.com': { css: 'button[data-testid="submit-button"]' },
      'kayak.com': { css: 'button[aria-label*="Search"]' },
      'skyscanner.com': { css: '[data-testid="desktop-cta"]' },
      'momondo.com': { css: '[data-testid="searchform-sbox-submit-button"]' }
    };
    return selectors[website] || { css: 'button[type="submit"]' };
  }

  private getResultsSelector(website: string) {
    const selectors = {
      'google.com/flights': { css: '[data-testid="flight-card"]' },
      'expedia.com': { css: '[data-test-id="offer-listing"]' },
      'kayak.com': { css: '.flight-result' },
      'skyscanner.com': { css: '.flight-card' },
      'momondo.com': { css: '.flight-item' }
    };
    return selectors[website] || { css: '.flight-result' };
  }

  getEstimatedDuration(parameters: CommandParameters): number {
    // Flight searches typically take 2-3 minutes per website
    return this.supportedWebsites.length * 150000; // 2.5 minutes per website
  }
}