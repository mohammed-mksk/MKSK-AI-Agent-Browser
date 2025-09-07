/**
 * Browser Automation Engine
 * Created: July 30, 2025
 * 
 * Real browser automation using Puppeteer for web scraping and interaction
 */

import puppeteer, { Browser, Page, ElementHandle } from 'puppeteer';
import { Logger } from './Logger.js';
import { ParsedCommand } from './AICommandParser.js';

export interface BrowserAutomationResult {
  success: boolean;
  extractedData: any[];
  screenshots: Buffer[];
  duration: number;
  error?: string;
}

export class BrowserAutomationEngine {
  private logger: Logger;
  private browser: Browser | null = null;
  private page: Page | null = null;
  private defaultTimeoutMs: number;

  constructor() {
    this.logger = new Logger('BrowserAutomationEngine');
    const envTimeout = Number(process.env['BROWSER_TIMEOUT']);
    this.defaultTimeoutMs = Number.isFinite(envTimeout) && envTimeout > 0 ? envTimeout : 30000;
  }

  async executeParsedCommand(
    parsedCommand: ParsedCommand,
    report?: (evt: { progress?: number; message?: string; step?: string; site?: string; meta?: any }) => void
  ): Promise<BrowserAutomationResult> {
    const startTime = Date.now();
    this.logger.info('Starting browser automation', { 
      intent: parsedCommand.intent.type,
      websites: parsedCommand.websites 
    });

    try {
      await this.initializeBrowser();

      const extractedData = await this.performAutomation(parsedCommand, report);
      const screenshots = await this.captureScreenshots();
      
      const duration = Date.now() - startTime;
      
      this.logger.info('Browser automation completed successfully', { 
        duration,
        dataItems: extractedData.length 
      });

      return {
        success: true,
        extractedData,
        screenshots,
        duration
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error('Browser automation failed', { error, duration });
      
      return {
        success: false,
        extractedData: [],
        screenshots: [],
        duration,
        error: error instanceof Error ? error.message : 'Unknown automation error'
      };
    } finally {
      await this.cleanup();
    }
  }

  private async initializeBrowser(): Promise<void> {
    this.logger.info('Launching browser');
    
    const headlessEnv = (process.env['BROWSER_HEADLESS'] || '').toLowerCase() === 'true';
    this.browser = await puppeteer.launch({
      headless: headlessEnv, // default from env; show window when false
      defaultViewport: { width: 1920, height: 1080 },
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu'
      ]
    });

    this.page = await this.browser.newPage();
    
    // Set user agent to avoid bot detection
    await this.page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    this.logger.info('Browser launched successfully');
  }

  // ===== Phase 1: Reliability Helpers =====
  private async waitForVisible(page: Page, selector: string, timeoutMs?: number): Promise<ElementHandle<Element> | null> {
    try {
      await page.waitForSelector(selector, { visible: true, timeout: timeoutMs ?? this.defaultTimeoutMs });
      return (await page.$(selector)) as ElementHandle<Element> | null;
    } catch {
      return null;
    }
  }

  private async clickWithRetry(page: Page, selector: string, attempts = 3, delayMs = 500): Promise<boolean> {
    for (let i = 0; i < attempts; i++) {
      try {
        const el = await this.waitForVisible(page, selector, this.defaultTimeoutMs);
        if (!el) throw new Error('Element not visible');
        await el.click();
        return true;
      } catch (err) {
        this.logger.warn(`clickWithRetry failed (${i + 1}/${attempts}) on ${selector}: ${(err as Error).message}`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
    return false;
  }

  private async typeWithClear(page: Page, selector: string, value: string): Promise<boolean> {
    try {
      const el = await this.waitForVisible(page, selector, this.defaultTimeoutMs);
      if (!el) return false;
      await page.evaluate((sel) => {
        const input = document.querySelector<HTMLInputElement>(sel);
        if (input) input.value = '';
      }, selector);
      await page.type(selector, value, { delay: 20 });
      return true;
    } catch (err) {
      this.logger.warn(`typeWithClear failed on ${selector}: ${(err as Error).message}`);
      return false;
    }
  }

  private async waitForNetworkIdleAndSelectors(page: Page, selectors: string[] = ['body'], timeoutMs?: number): Promise<void> {
    try {
      await page.waitForNetworkIdle({ timeout: timeoutMs ?? this.defaultTimeoutMs });
    } catch {}
    for (const sel of selectors) {
      try { await page.waitForSelector(sel, { timeout: timeoutMs ?? this.defaultTimeoutMs }); } catch {}
    }
  }

  private async scrollToLoadMore(page: Page, maxScrolls = 5, waitMs = 500): Promise<void> {
    for (let i = 0; i < maxScrolls; i++) {
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await new Promise(resolve => setTimeout(resolve, waitMs));
    }
  }

  private async dismissCookieBanners(page: Page): Promise<void> {
    try {
      const TEXTS = ['accept', 'agree', 'allow', 'got it', 'ok', 'yes', 'i agree'];
      const cssCandidates = [
        'button#onetrust-accept-btn-handler',
        '#onetrust-accept-btn-handler',
        'button[aria-label*="accept" i]',
        'button[aria-label*="agree" i]',
        '[id*="cookie" i] button',
        '[class*="cookie" i] button',
        'button[mode="primary"]',
      ];
      for (const sel of cssCandidates) {
        const clicked = await this.clickWithRetry(page, sel, 1, 0);
        if (clicked) { this.logger.info(`Cookie banner dismissed via selector: ${sel}`); return; }
      }

      const clickedByText = await page.evaluate((texts: string[]) => {
        const buttons = Array.from(document.querySelectorAll('button, [role="button"], a')) as HTMLElement[];
        const isMatch = (el: HTMLElement) => {
          const t = (el.innerText || el.textContent || '').trim().toLowerCase();
          return texts.some(k => t.includes(k));
        };
        const target = buttons.find(isMatch);
        if (target) { (target as HTMLElement).click(); return true; }
        const inputs = Array.from(document.querySelectorAll('input[type="button"], input[type="submit"]')) as HTMLElement[];
        const target2 = inputs.find(isMatch);
        if (target2) { (target2 as HTMLElement).click(); return true; }
        return false;
      }, TEXTS);

      if (clickedByText) this.logger.info('Cookie banner dismissed via text match');
    } catch (err) {
      this.logger.warn(`dismissCookieBanners error: ${(err as Error).message}`);
    }
  }
  // ===== End Helpers =====

  private async performAutomation(
    parsedCommand: ParsedCommand,
    report?: (evt: { progress?: number; message?: string; step?: string; site?: string; meta?: any }) => void
  ): Promise<any[]> {
    if (!this.page) {
      throw new Error('Browser page not initialized');
    }

    const { intent, parameters, websites } = parsedCommand;
    
    // Route to appropriate automation strategy based on intent
    switch (intent.type) {
      case 'flight_search':
        // Phase 3: use multi-site aggregation flow
        return await this.performFlightSearchMultiSite(parameters, websites, report);
      case 'form_fill':
        report?.({ step: 'form_fill:start', message: 'Opening form page' });
        const ff = await this.performFormFill(parameters, report);
        report?.({ step: 'form_fill:done', message: 'Form fill complete', progress: 100 });
        return ff;
      case 'bank_research':
        report?.({ step: 'bank:start', message: 'Opening banking comparison site', progress: 5 });
        const bank = await this.performBankResearch(parameters, websites);
        report?.({ step: 'bank:done', message: 'Bank research complete', progress: 100 });
        return bank;
      case 'product_comparison':
        return await this.performProductComparison(parameters, websites);
      default:
        report?.({ step: 'search:start', message: 'Opening search engine', progress: 5 });
        const res = await this.performGeneralSearch(parameters, websites, report);
        report?.({ step: 'search:done', message: 'Search complete', progress: 100 });
        return res;
    }
  }

  private async performFlightSearch(parameters: any, websites: string[]): Promise<any[]> {
    this.logger.info('Performing flight search automation', { parameters });
    
    try {
      // Navigate to Google Flights
      this.logger.info('Navigating to Google Flights');
      await this.page!.goto('https://www.google.com/travel/flights', { 
        waitUntil: 'networkidle2',
        timeout: this.defaultTimeoutMs 
      });

      await this.waitForNetworkIdleAndSelectors(this.page!, ['body']);
      await this.dismissCookieBanners(this.page!);

      // Phase 2: Parse basic details from query and attempt to fill the form
      const details = this.parseFlightQuery(parameters?.query || '');
      this.logger.info('Page loaded. Parsed details (fallback):', details);

      // Try to set origin and destination
      if (details.origin) {
        await this.trySetOrigin(details.origin);
      }
      if (details.destination) {
        await this.trySetDestination(details.destination);
      }

      // Try to set dates if detected
      if (details.depart || details.return) {
        await this.trySetDates(details.depart, details.return);
      }

      // Trigger search via Enter as a fallback
      await this.page!.keyboard.press('Enter');
      await this.waitForNetworkIdleAndSelectors(this.page!, ['body']);
      this.logger.info('Attempted to trigger search, extracting visible data');

      // Try to extract any visible flight information or search interface
      const pageData = await this.page!.evaluate((searchQuery) => {
        const results = {
          pageTitle: document.title,
          url: window.location.href,
          searchQuery: searchQuery,
          extractedElements: [] as any[],
          pageContent: '',
          cards: [] as any[],
          prices: [] as { text: string; value: number }[],
          durations: [] as string[],
          stops: [] as string[]
        };

        // Try to find flight-related elements
        const flightElements = document.querySelectorAll('[data-testid*="flight"], .flight, [class*="flight"], [aria-label*="flight"]');
        flightElements.forEach((element, index) => {
          if (index < 5) { // Limit to first 5 elements
            results.extractedElements.push({
              tagName: element.tagName,
              className: element.className,
              textContent: element.textContent?.substring(0, 200) || '',
              attributes: Array.from(element.attributes).map(attr => ({ name: attr.name, value: attr.value }))
            });
          }
        });

        // Quick scan for price/duration/stop wording
        try {
          const text = document.body.innerText || '';
          const currencyRegex = /([£$€]\s?\d{2,4})/g;
          const matches = text.match(currencyRegex) || [];
          const unique = Array.from(new Set(matches)).slice(0, 20);
          for (const m of unique) {
            const v = Number(m.replace(/[^0-9]/g, ''));
            if (Number.isFinite(v)) results.prices.push({ text: m, value: v });
          }
          const durationRegex = /(\d{1,2})h\s?(\d{1,2})?m?/g;
          const durMatches = text.match(durationRegex) || [];
          results.durations = Array.from(new Set(durMatches)).slice(0, 10);
          const stopRegex = /(nonstop|non-stop|\b\d+\s+stops?)/gi;
          const stopMatches = text.match(stopRegex) || [];
          results.stops = Array.from(new Set(stopMatches)).slice(0, 10);
        } catch {}

        // Site-specific heuristics for Google Flights result cards
        try {
          const currencyRe = /([£$€]\s?\d{2,4})/;
          const durationRe = /(\d{1,2})h\s?(\d{1,2})?m?/i;
          const timeRangeRe = /(\d{1,2}:\d{2})\s*[–-]\s*(\d{1,2}:\d{2})/;
          const airlineHint = /(air|airways|airlines|klm|ba|british|lufthansa|emirates|qatar|etihad|turkish|delta|american|united|ryanair|vueling|easyjet|indigo|vistara|jet|virgin)/i;
          const containers = Array.from(document.querySelectorAll('div[role="listitem"], li[role="listitem"], div[data-testid*="result"], div[aria-label*="result" i], div[jscontroller]')) as HTMLElement[];
          const seen = new Set<HTMLElement>();
          const cards: any[] = [];
          const takeParent = (el: HTMLElement) => {
            let cur: HTMLElement | null = el;
            for (let i = 0; i < 5 && cur; i++) {
              const t = (cur.innerText || '').trim();
              if (currencyRe.test(t) && durationRe.test(t)) return cur;
              cur = cur.parentElement as HTMLElement | null;
            }
            return el;
          };
          const pool = containers.length ? containers : (Array.from(document.querySelectorAll('div, li')) as HTMLElement[]).slice(0, 2000);
          for (const el of pool) {
            const txt = (el.innerText || '').trim();
            if (!currencyRe.test(txt) || !durationRe.test(txt)) continue;
            const box = takeParent(el);
            if (seen.has(box)) continue;
            seen.add(box);
            const lines = txt.split('\n').map(s => s.trim()).filter(Boolean);
            const priceText = (txt.match(currencyRe) || [null])[0];
            const durationText = (txt.match(durationRe) || [null])[0];
            const timeMatch = txt.match(timeRangeRe);
            let airline = '';
            for (const ln of lines) { if (airlineHint.test(ln)) { airline = ln; break; } }
            const stopsMatch = txt.match(/(nonstop|non-stop|\b\d+\s+stops?)/i);
            const anchor = box.querySelector('a[href^="http"]') as HTMLAnchorElement | null;
            if (priceText && durationText) {
              const priceValue = Number(priceText.replace(/[^0-9]/g, ''));
              cards.push({
                priceText,
                priceValue,
                durationText,
                departTime: timeMatch ? timeMatch[1] : null,
                arriveTime: timeMatch ? timeMatch[2] : null,
                stopsText: stopsMatch ? stopsMatch[0] : null,
                airline: airline || null,
                href: anchor ? anchor.href : window.location.href
              });
            }
            if (cards.length >= 10) break;
          }
          results.cards = cards;
        } catch {}

        // If no flight elements found, try to get general page info
        if (results.extractedElements.length === 0) {
          const mainContent = document.querySelector('main, #main, .main, body');
          if (mainContent) {
            results.pageContent = mainContent.textContent?.substring(0, 500) || '';
          }
        }

        return results;
      }, parameters.query || 'flight search');

      this.logger.info('Data extraction completed', { 
        elementsFound: pageData.extractedElements.length,
        pageTitle: pageData.pageTitle 
      });

      // Keep browser open for 10 seconds so user can see what happened
      this.logger.info('Keeping browser open for user verification...');
      await new Promise(resolve => setTimeout(resolve, 10000));

      // Normalize options by price, prefer site-specific cards if available
      const fromCards = (pageData.cards || []).map((c: any, idx: number) => ({
        id: `option_${idx + 1}`,
        priceText: c.priceText,
        priceValue: c.priceValue,
        duration: c.durationText,
        stops: c.stopsText,
        departTime: c.departTime,
        arriveTime: c.arriveTime,
        airline: c.airline,
        sourceUrl: c.href || pageData.url
      }));
      const fromRegex = (pageData.prices || []).map((p: any, idx: number) => ({
        id: `option_${idx + 1}`,
        priceText: p.text,
        priceValue: p.value,
        duration: pageData.durations[idx] || null,
        stops: pageData.stops[idx] || null,
        sourceUrl: pageData.url
      }));
      const normalized = (fromCards.length ? fromCards : fromRegex).sort((a: any, b: any) => a.priceValue - b.priceValue);
      const recommendation = normalized[0]
        ? `Cheapest observed: ${normalized[0].priceText}${normalized[0].duration ? ', ' + normalized[0].duration : ''}${normalized[0].stops ? ', ' + normalized[0].stops : ''}`
        : 'No price signals detected';

      // Format the extracted data
      const flightData = {
        searchQuery: parameters.query,
        pageTitle: pageData.pageTitle,
        currentUrl: pageData.url,
        extractedElements: pageData.extractedElements,
        pageContent: pageData.pageContent,
        pricesDetected: pageData.prices,
        durationsDetected: pageData.durations,
        stopsDetected: pageData.stops,
        normalizedOptions: normalized,
        recommendation,
        searchParameters: parameters,
        automationStatus: 'Browser successfully navigated to Google Flights',
        note: 'This is real browser automation - the page was actually visited and data extracted',
        timestamp: new Date().toISOString()
      };

      return [{
        id: 'flight_data_1',
        type: 'structured',
        content: flightData,
        source: {
          url: pageData.url,
          selector: 'live page extraction',
          timestamp: new Date()
        },
        confidence: 0.9
      }];

    } catch (error) {
      this.logger.error('Flight search automation failed', error);
      
      // Return detailed error information
      return [{
        id: 'flight_error_1',
        type: 'structured',
        content: {
          error: 'Browser automation encountered an issue',
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
          searchQuery: parameters.query,
          attemptedUrl: 'https://www.google.com/travel/flights',
          note: 'The browser was launched but encountered an error during navigation or data extraction',
          timestamp: new Date().toISOString()
        },
        source: {
          url: 'automation_error',
          selector: 'error_handler',
          timestamp: new Date()
        },
        confidence: 0.1
      }];
    }
  }

  // Phase 3: Multi-site flight search aggregation (Google Flights, Kayak, Expedia)
  private async performFlightSearchMultiSite(
    parameters: any,
    websites: string[],
    report?: (evt: { progress?: number; message?: string; step?: string; site?: string; meta?: any }) => void
  ): Promise<any[]> {
    this.logger.info('Performing flight search automation (multi-site)', { parameters, websites });
    const aggregate: any[] = [];
    const siteSummaries: any[] = [];
    const details = this.parseFlightQuery(parameters?.query || '');

    const siteList = (websites && websites.length ? websites : [
      'https://www.google.com/travel/flights',
      'https://www.kayak.com/flights',
      'https://www.expedia.com/Flights'
    ]).map((u) => this.normalizeFlightUrl(u));

    const totalSites = siteList.length || 1;
    let siteIndex = 0;
    for (const site of siteList) {
      siteIndex++;
      const sitePctBase = Math.floor(((siteIndex - 1) / totalSites) * 100);
      try {
        this.logger.info(`Visiting site: ${site}`);
        report?.({ step: 'site:start', site, message: `Visiting ${site}`, progress: sitePctBase + 5 });
        await this.page!.goto(site, { waitUntil: 'networkidle2', timeout: this.defaultTimeoutMs });
        await this.waitForNetworkIdleAndSelectors(this.page!, ['body']);
        await this.dismissCookieBanners(this.page!);

        if (details.origin) { report?.({ step: 'site:set_origin', site, message: `Setting origin ${details.origin}` }); await this.trySetOrigin(details.origin); }
        if (details.destination) { report?.({ step: 'site:set_destination', site, message: `Setting destination ${details.destination}` }); await this.trySetDestination(details.destination); }
        if (details.depart || details.return) { report?.({ step: 'site:set_dates', site, message: 'Setting dates' }); await this.trySetDates(details.depart, details.return); }

        // Fallback trigger
        await this.page!.keyboard.press('Enter');
        await this.waitForNetworkIdleAndSelectors(this.page!, ['body']);
        report?.({ step: 'site:search', site, message: 'Triggered search' });

        const cards = await this.extractFlightCardsGeneric();
        const normalized = cards.map((c: any, idx: number) => ({
          id: `${new URL(site).hostname}_option_${idx + 1}`,
          priceText: c.priceText,
          priceValue: c.priceValue,
          duration: c.durationText,
          stops: c.stopsText,
          departTime: c.departTime,
          arriveTime: c.arriveTime,
          airline: c.airline,
          sourceUrl: c.href || this.page!.url(),
          sourceSite: new URL(site).hostname
        }));
        aggregate.push(...normalized);
        siteSummaries.push({ site, found: normalized.length });
        report?.({ step: 'site:extracted', site, message: `Extracted ${normalized.length} options`, meta: { count: normalized.length }, progress: sitePctBase + Math.floor(95 / totalSites) });
      } catch (err) {
        this.logger.warn(`Site failed: ${site} — ${(err as Error).message}`);
        siteSummaries.push({ site, error: (err as Error).message });
        report?.({ step: 'site:error', site, message: `Failed on ${site}: ${(err as Error).message}` });
      }
    }

    aggregate.sort((a, b) => (a.priceValue ?? Number.MAX_SAFE_INTEGER) - (b.priceValue ?? Number.MAX_SAFE_INTEGER));
    const recommendation = aggregate[0]
      ? `Cheapest observed: ${aggregate[0].priceText} on ${aggregate[0].sourceSite}${aggregate[0].duration ? ', ' + aggregate[0].duration : ''}${aggregate[0].stops ? ', ' + aggregate[0].stops : ''}`
      : 'No price signals detected across sites';

    const content = {
      searchQuery: parameters.query,
      sitesTried: siteList,
      siteSummaries,
      normalizedOptions: aggregate,
      recommendation,
      timestamp: new Date().toISOString()
    };

    const result = [{
      id: 'flight_multisite_1',
      type: 'structured',
      content,
      source: {
        url: this.page!.url(),
        selector: 'multi-site aggregation',
        timestamp: new Date()
      },
      confidence: aggregate.length ? 0.9 : 0.4
    }];
    report?.({ step: 'aggregate:done', message: 'Aggregation complete', progress: 100, meta: { options: aggregate.length } });
    return result;
  }

  // Phase 4: Generic form filling capability
  private async performFormFill(parameters: any, report?: (evt: { progress?: number; message?: string; step?: string; site?: string; meta?: any }) => void): Promise<any[]> {
    const url: string | undefined = parameters?.url || (Array.isArray(parameters?.urls) ? parameters.urls[0] : undefined) || this.extractUrlFromText(parameters?.query || '');
    if (!url) {
      throw new Error('No target URL provided for form filling');
    }

    this.logger.info('Form fill: navigating to URL', { url });
    await this.page!.goto(url, { waitUntil: 'networkidle2', timeout: this.defaultTimeoutMs });
    await this.waitForNetworkIdleAndSelectors(this.page!, ['body']);
    await this.dismissCookieBanners(this.page!);
    report?.({ step: 'form:navigated', message: 'Page loaded', progress: 20 });

    const formData: Record<string, any> = parameters?.formData || {};
    const autoSubmit: boolean = Boolean(parameters?.submit || parameters?.autoSubmit);

    // Detect fields with basic semantics
    const detected = await this.page!.evaluate(() => {
      function isVisible(el: HTMLElement) {
        const rect = el.getBoundingClientRect();
        const style = window.getComputedStyle(el);
        return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
      }
      function labelFor(el: HTMLElement): string {
        let labelText = '';
        const id = (el as HTMLInputElement).id;
        if (id) {
          const lbl = document.querySelector(`label[for="${CSS.escape(id)}"]`) as HTMLElement | null;
          if (lbl && lbl.innerText) labelText = lbl.innerText;
        }
        const parentLabel = el.closest('label') as HTMLElement | null;
        if (!labelText && parentLabel && parentLabel.innerText) labelText = parentLabel.innerText;
        const ph = (el as HTMLInputElement).placeholder || '';
        return `${labelText} ${ph}`.trim();
      }
      function classify(el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement): string {
        const name = (el.getAttribute('name') || '').toLowerCase();
        const id = (el.getAttribute('id') || '').toLowerCase();
        const type = (el.getAttribute('type') || '').toLowerCase();
        const lbl = labelFor(el as any).toLowerCase();
        const hay = `${name} ${id} ${type} ${lbl}`;
        if (type === 'email' || /email/.test(hay)) return 'email';
        if (type === 'password' || /password|pwd/.test(hay)) return 'password';
        if (/phone|tel|mobile/.test(hay)) return 'phone';
        if (/first\s*name|last\s*name|fullname|name/.test(hay)) return 'name';
        if (/company|organisation|organization|business/.test(hay)) return 'company';
        if (el.tagName.toLowerCase() === 'textarea' || /message|comments|cover|about/.test(hay)) return 'message';
        if (/address|street/.test(hay)) return 'address';
        if (/city|town/.test(hay)) return 'city';
        if (/zip|postcode|postal/.test(hay)) return 'postal';
        if (/website|url/.test(hay)) return 'website';
        return 'text';
      }
      function cssFor(el: Element): string {
        const e = el as HTMLElement;
        if (e.id) return `#${CSS.escape(e.id)}`;
        const name = e.getAttribute('name');
        if (name) return `${e.tagName.toLowerCase()}[name="${CSS.escape(name)}"]`;
        const ph = e.getAttribute('placeholder');
        if (ph) return `${e.tagName.toLowerCase()}[placeholder="${CSS.escape(ph)}"]`;
        const aria = e.getAttribute('aria-label');
        if (aria) return `${e.tagName.toLowerCase()}[aria-label="${CSS.escape(aria)}"]`;
        return `${e.tagName.toLowerCase()}`;
      }

      const inputs = Array.from(document.querySelectorAll('input, textarea, select'))
        .filter(el => isVisible(el as HTMLElement)) as (HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement)[];
      const fields = inputs.map(el => ({
        tag: el.tagName.toLowerCase(),
        type: (el as HTMLInputElement).type || 'text',
        css: cssFor(el),
        name: el.getAttribute('name') || '',
        id: el.getAttribute('id') || '',
        placeholder: (el as HTMLInputElement).placeholder || '',
        label: labelFor(el as any),
        semantic: classify(el),
      }));
      return fields;
    });

    const fillOrder = ['email','name','phone','company','message','address','city','postal','website','text'];
    const filled: any[] = [];
    const errors: any[] = [];
    // Report detection summary
    try { report?.({ step: 'form:detect', message: `Detected ${Array.isArray(detected) ? detected.length : 0} fields`, progress: 35, meta: { count: Array.isArray(detected) ? detected.length : 0 } }); } catch {}

    const chooseValue = (semantic: string): string | null => {
      const keyMap: Record<string, string[]> = {
        email: ['email'],
        name: ['name','firstName','lastName','fullName'],
        phone: ['phone','tel','mobile'],
        company: ['company','organisation','organization','business'],
        message: ['message','comments','coverLetter','about'],
        address: ['address','street'],
        city: ['city','town'],
        postal: ['postal','postcode','zip'],
        website: ['website','url'],
        text: ['text']
      };
      const keys = keyMap[semantic] || [];
      for (const k of keys) {
        if (formData[k] !== undefined) return String(formData[k]);
      }
      switch (semantic) {
        case 'email': return null;
        case 'name': return null;
        case 'phone': return null;
        case 'company': return null;
        case 'message': return 'Thank you for your time! Looking forward to hearing from you.';
        case 'city': return 'London';
        case 'postal': return '00000';
        case 'website': return 'https://example.com';
        case 'address': return '123 Example Street';
        default: return null;
      }
    };

    for (const semantic of fillOrder) {
      const targets = (detected as any[]).filter((f: any) => f.semantic === semantic);
      const value = chooseValue(semantic);
      for (const f of targets) {
        try {
          if (f.tag === 'select') {
            if (value !== null) await this.page!.select(f.css, String(value));
          } else if (f.type === 'checkbox') {
            if (formData[f.name] || formData[f.id]) {
              await this.clickWithRetry(this.page!, f.css, 2);
            }
          } else if (f.type === 'radio') {
            if (formData[f.name]) await this.clickWithRetry(this.page!, `input[type="radio"][name="${f.name}"]`, 1);
          } else if (f.type === 'password') {
            const pwd = formData['password'] || null;
            if (pwd) await this.typeWithClear(this.page!, f.css, String(pwd));
          } else {
            if (value !== null) await this.typeWithClear(this.page!, f.css, String(value));
          }
          filled.push({ field: f, value: value ?? null, status: 'filled' });
        } catch (e) {
          errors.push({ field: f, error: (e as Error).message });
        }
      }
    }
    try { report?.({ step: 'form:filled', message: `Filled ${filled.length} fields`, progress: 70, meta: { filled: filled.length, errors: errors.length } }); } catch {}

    let submission = { attempted: false, success: false };
    if (autoSubmit) {
      submission.attempted = true;
      try {
        report?.({ step: 'form:submit_attempt', message: 'Submitting form', progress: 80 });
        const clicked = await this.page!.evaluate(() => {
          const texts = ['submit','send','apply','continue','next'];
          const btns = Array.from(document.querySelectorAll('button, input[type="submit"]')) as HTMLElement[];
          for (const b of btns) {
            const t = (b.innerText || (b as HTMLInputElement).value || '').toLowerCase();
            if (texts.some(x => t.includes(x))) { (b as HTMLElement).click(); return true; }
          }
          const form = document.querySelector('form') as HTMLFormElement | null;
          if (form) { form.submit(); return true; }
          return false;
        });
        if (clicked) {
          await this.waitForNetworkIdleAndSelectors(this.page!, ['body']);
          submission.success = true;
          report?.({ step: 'form:submit_success', message: 'Form submitted', progress: 95 });
        }
      } catch {}
    }

    const content = {
      url,
      detectedFields: detected,
      filled,
      errors,
      submission
    };

    return [{
      id: 'form_fill_1',
      type: 'structured',
      content,
      source: {
        url: this.page!.url(),
        selector: 'form detection and fill',
        timestamp: new Date()
      },
      confidence: errors.length ? 0.7 : 0.9
    }];
  }

  private extractUrlFromText(text: string): string | undefined {
    const m = text.match(/https?:\/\/[\w\-._~:/?#[\]@!$&'()*+,;=%]+/);
    return m ? m[0] : undefined;
  }

  // ===== Phase 2 helpers: parse and UI interactions =====
  private parseFlightQuery(query: string): { origin?: string; destination?: string; depart?: Date; return?: Date } {
    const result: { origin?: string; destination?: string; depart?: Date; return?: Date } = {};
    const upper = query.toUpperCase();
    const codes = upper.match(/\b[A-Z]{3}\b/g) || [];
    if (codes.length >= 1) result.origin = codes[0];
    if (codes.length >= 2) result.destination = codes[1];
    // "from X to Y"
    if (!result.origin || !result.destination) {
      const fromTo = query.match(/from\s+([\w\s]+?)\s+to\s+([\w\s]+)/i);
      if (fromTo) {
        result.origin = result.origin || fromTo[1].trim();
        result.destination = result.destination || fromTo[2].trim();
      }
    }
    // Dates
    const now = new Date();
    const currentYear = now.getFullYear();
    const parseMonth = (m: string) => {
      const map: Record<string, number> = { jan:0,feb:1,mar:2,apr:3,may:4,jun:5,jul:6,aug:7,sep:8,sept:8,oct:9,nov:10,dec:11 };
      return map[m.slice(0,3).toLowerCase()];
    };
    const depMatch = query.match(/(depart(ing)?\s*)?(on\s*)?(\d{1,2})(st|nd|rd|th)?\s*(of\s*)?([A-Za-z]+)/i)
      || query.match(/([A-Za-z]+)\s*(\d{1,2})(st|nd|rd|th)?/i);
    const retMatch = query.match(/return(ing)?\s*(on\s*)?(\d{1,2})(st|nd|rd|th)?\s*(of\s*)?([A-Za-z]+)/i) || null;
    if (depMatch) {
      const day = Number(depMatch[4] || depMatch[2]);
      const monthName = (depMatch[7] || depMatch[1]) ?? '';
      const m = parseMonth(monthName);
      if (Number.isFinite(day) && Number.isFinite(m)) result.depart = new Date(currentYear, m!, day);
    }
    if (retMatch) {
      const day = Number(retMatch[3]);
      const monthName = retMatch[6] ?? '';
      const m = parseMonth(monthName);
      if (Number.isFinite(day) && Number.isFinite(m)) result.return = new Date(currentYear, m!, day);
    }
    return result;
  }

  private async trySetOrigin(value: string): Promise<void> {
    const page = this.page!;
    const originSelectors = [
      'input[aria-label*="From" i]',
      'div[aria-label*="Where from" i]',
      'input[data-placeholder*="From" i]'
    ];
    for (const sel of originSelectors) {
      if (await this.clickWithRetry(page, sel, 1)) break;
    }
    await this.typeWithClear(page, 'input[role="combobox"], input[aria-label*="From" i]', value);
    await new Promise(resolve => setTimeout(resolve, 800));
    await this.clickWithRetry(page, 'li[role="option"], .VfPpkd-MenuItem:first-child', 2);
  }

  private async trySetDestination(value: string): Promise<void> {
    const page = this.page!;
    const destSelectors = [
      'input[aria-label*="To" i]',
      'div[aria-label*="Where to" i]',
      'input[data-placeholder*="To" i]'
    ];
    for (const sel of destSelectors) {
      if (await this.clickWithRetry(page, sel, 1)) break;
    }
    await this.typeWithClear(page, 'input[role="combobox"], input[aria-label*="To" i]', value);
    await new Promise(resolve => setTimeout(resolve, 800));
    await this.clickWithRetry(page, 'li[role="option"], .VfPpkd-MenuItem:first-child', 2);
  }

  private async trySetDates(depart?: Date, ret?: Date): Promise<void> {
    const page = this.page!;
    const dateButtonSelectors = [
      '[aria-label*="Departure" i]',
      '[aria-label*="Dates" i]',
      'button[aria-haspopup="grid"]'
    ];
    for (const sel of dateButtonSelectors) {
      if (await this.clickWithRetry(page, sel, 1)) break;
    }
    await new Promise(resolve => setTimeout(resolve, 500));

    const clickDate = async (d: Date) => {
      const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
      const labelA = `${monthNames[d.getMonth()]} ${d.getDate()}`;
      const labelB = `${monthNames[d.getMonth()].slice(0,3)} ${d.getDate()}`;
      const clicked = await page.evaluate((a: string, b: string) => {
        const candidates = Array.from(document.querySelectorAll('[aria-label]')) as HTMLElement[];
        const match = candidates.find(el => {
          const t = (el.getAttribute('aria-label') || '').toLowerCase();
          return t.includes(a.toLowerCase()) || t.includes(b.toLowerCase());
        });
        if (match) { (match as HTMLElement).click(); return true; }
        return false;
      }, labelA, labelB);
      if (!clicked) {
        await this.clickWithRetry(page, `button[aria-label*="${labelA}" i], button[aria-label*="${labelB}" i]`, 1);
      }
    };

    if (depart) await clickDate(depart);
    if (ret) await clickDate(ret);

    await page.keyboard.press('Enter');
    await this.waitForNetworkIdleAndSelectors(page, ['body']);
  }

  private normalizeFlightUrl(url: string): string {
    try {
      const u = new URL(url.startsWith('http') ? url : `https://${url}`);
      const host = u.hostname;
      if (host.includes('google')) return 'https://www.google.com/travel/flights';
      if (host.includes('kayak')) return 'https://www.kayak.com/flights';
      if (host.includes('expedia')) return 'https://www.expedia.com/Flights';
      return u.origin + u.pathname;
    } catch {
      return url;
    }
  }

  private async extractFlightCardsGeneric(): Promise<any[]> {
    const cards = await this.page!.evaluate(() => {
      const currencyRe = /([£$€]\s?\d{2,4})/;
      const durationRe = /(\d{1,2})h\s?(\d{1,2})?m?/i;
      const timeRangeRe = /(\d{1,2}:\d{2})\s*[–-]\s*(\d{1,2}:\d{2})/;
      const airlineHint = /(air|airways|airlines|klm|ba|british|lufthansa|emirates|qatar|etihad|turkish|delta|american|united|ryanair|vueling|easyjet|indigo|vistara|jet|virgin)/i;
      const containers = Array.from(document.querySelectorAll('div[role="listitem"], li[role="listitem"], div[data-testid*="result"], div[aria-label*="result" i], li, article')) as HTMLElement[];
      const seen = new Set<HTMLElement>();
      const out: any[] = [];
      const takeParent = (el: HTMLElement) => {
        let cur: HTMLElement | null = el;
        for (let i = 0; i < 6 && cur; i++) {
          const t = (cur.innerText || '').trim();
          if (currencyRe.test(t) && durationRe.test(t)) return cur;
          cur = cur.parentElement as HTMLElement | null;
        }
        return el;
      };
      const pool = containers.length ? containers : (Array.from(document.querySelectorAll('div')) as HTMLElement[]).slice(0, 2000);
      for (const el of pool) {
        const txt = (el.innerText || '').trim();
        if (!currencyRe.test(txt) || !durationRe.test(txt)) continue;
        const box = takeParent(el);
        if (seen.has(box)) continue;
        seen.add(box);
        const lines = txt.split('\n').map(s => s.trim()).filter(Boolean);
        const priceText = (txt.match(currencyRe) || [null])[0];
        const durationText = (txt.match(durationRe) || [null])[0];
        const timeMatch = txt.match(timeRangeRe);
        let airline = '';
        for (const ln of lines) { if (airlineHint.test(ln)) { airline = ln; break; } }
        const stopsMatch = txt.match(/(nonstop|non-stop|\b\d+\s+stops?)/i);
        const anchor = box.querySelector('a[href^="http"]') as HTMLAnchorElement | null;
        if (priceText && durationText) {
          const priceValue = Number(priceText.replace(/[^0-9]/g, ''));
          out.push({
            priceText,
            priceValue,
            durationText,
            departTime: timeMatch ? timeMatch[1] : null,
            arriveTime: timeMatch ? timeMatch[2] : null,
            stopsText: stopsMatch ? stopsMatch[0] : null,
            airline: airline || null,
            href: anchor ? anchor.href : window.location.href
          });
        }
        if (out.length >= 12) break;
      }
      return out;
    });
    return cards;
  }

  private async performBankResearch(
    parameters: any,
    websites: string[],
    report?: (evt: { progress?: number; message?: string; step?: string; site?: string; meta?: any }) => void
  ): Promise<any[]> {
    this.logger.info('Performing bank research automation', { parameters });
    
    try {
      // Navigate to Money Saving Expert or similar
      await this.page!.goto('https://www.moneysavingexpert.com/banking/compare-bank-accounts/', { 
        waitUntil: 'networkidle2',
        timeout: this.defaultTimeoutMs 
      });

      await this.waitForNetworkIdleAndSelectors(this.page!, ['body']);
      await this.dismissCookieBanners(this.page!);
      report?.({ step: 'bank:navigated', message: 'Comparison page loaded', progress: 25 });
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Extract normalized account data
      const bankData = await this.page!.evaluate(() => {
        const accounts: any[] = [];
        const tables = Array.from(document.querySelectorAll('table')) as HTMLTableElement[];
        const toText = (el: Element | null) => (el ? (el as HTMLElement).innerText.trim() : '');
        const parseFee = (s: string) => { const m = s.match(/([£$€]\s?\d+(?:\.\d+)?)/); return { text: m ? m[1] : s, value: m ? Number(m[1].replace(/[^0-9.]/g, '')) : null }; };
        if (tables.length) {
          for (const tbl of tables) {
            const headers = Array.from(tbl.querySelectorAll('thead th')).map(th => th.innerText.toLowerCase());
            const rows = Array.from(tbl.querySelectorAll('tbody tr')) as HTMLTableRowElement[];
            for (const r of rows) {
              const cells = Array.from(r.querySelectorAll('td'));
              if (!cells.length) continue;
              const rowText = cells.map(c => (c as HTMLElement).innerText).join(' ').toLowerCase();
              if (!/(account|bank)/.test(rowText)) continue;
              const obj: any = {};
              for (let i=0;i<cells.length;i++) {
                const h = headers[i] || `col${i}`;
                obj[h] = (cells[i] as HTMLElement).innerText.trim();
              }
              const bankName = toText(r.querySelector('td a')) || obj['bank'] || obj['provider'] || '';
              const type = obj['account'] || obj['account type'] || '';
              const fee = parseFee(obj['monthly fee'] || obj['fee'] || '');
              accounts.push({ bank: bankName, accountType: type, monthlyFeeText: fee.text, monthlyFeeValue: fee.value, details: obj });
            }
          }
        }
        return { accounts };
      });
      report?.({ step: 'bank:extracted', message: `Extracted ${bankData.accounts.length} accounts`, progress: 85, meta: { count: bankData.accounts.length } });

      // Rank accounts by lowest monthly fee
      const ranked = [...bankData.accounts].sort((a, b) => (a.monthlyFeeValue ?? 1e6) - (b.monthlyFeeValue ?? 1e6));
      const recommendation = ranked[0] ? `Lowest monthly fee: ${ranked[0].bank} (${ranked[0].monthlyFeeText})` : 'No accounts ranked';

      return [{
        id: 'bank_data_1',
        type: 'structured',
        content: { normalizedAccounts: ranked, recommendation },
        source: {
          url: this.page!.url(),
          selector: 'bank comparison table',
          timestamp: new Date()
        },
        confidence: 0.9
      }];

    } catch (error) {
      this.logger.error('Bank research automation failed', error);
      
      return [{
        id: 'bank_fallback_1',
        type: 'structured',
        content: {
          error: 'Could not extract live bank data',
          message: 'Browser automation encountered an issue accessing banking comparison sites',
          suggestion: 'Try visiting moneysavingexpert.com manually for current information'
        },
        source: {
          url: 'automation_error',
          selector: 'fallback',
          timestamp: new Date()
        },
        confidence: 0.1
      }];
    }
  }

  private async performProductComparison(
    parameters: any,
    websites: string[],
    report?: (evt: { progress?: number; message?: string; step?: string; site?: string; meta?: any }) => void
  ): Promise<any[]> {
    this.logger.info('Performing product comparison automation', { parameters });
    // Generic approach: search the web for products and extract normalized items
    try {
      const q = parameters.query || 'best products';
      report?.({ step: 'product:start', message: `Searching for: ${q}`, progress: 10 });
      await this.page!.goto('https://www.google.com', { waitUntil: 'networkidle2', timeout: this.defaultTimeoutMs });
      await this.waitForNetworkIdleAndSelectors(this.page!, ['input[name="q"]']);
      await this.dismissCookieBanners(this.page!);
      await this.page!.type('input[name="q"]', q);
      await this.page!.keyboard.press('Enter');
      await this.page!.waitForNavigation({ waitUntil: 'networkidle2' });
      report?.({ step: 'product:search_done', message: 'Search results loaded', progress: 40 });

      const items = await this.page!.evaluate(() => {
        const currencyRe = /([£$€]\s?\d+[\d.,]*)/;
        const nodes = Array.from(document.querySelectorAll('div,g-card,div.MjjYud,div.sh-dgr__content')) as HTMLElement[];
        const out: any[] = [];
        for (const el of nodes) {
          const txt = (el.innerText || '').trim();
          if (!currencyRe.test(txt)) continue;
          const titleEl = el.querySelector('h3, .sh-dgr__content-title, a h3') as HTMLElement | null;
          const priceText = (txt.match(currencyRe) || [null])[0];
          const priceValue = priceText ? Number(priceText.replace(/[^0-9.]/g, '')) : null;
          const link = (el.querySelector('a[href^="http"]') as HTMLAnchorElement | null)?.href || '';
          if (titleEl && priceText) {
            out.push({ title: titleEl.innerText.trim(), priceText, priceValue, url: link });
          }
          if (out.length >= 20) break;
        }
        return out;
      });
      report?.({ step: 'product:extracted', message: `Extracted ${items.length} items`, progress: 80, meta: { count: items.length } });

      const ranked = [...items].sort((a, b) => (a.priceValue ?? 1e12) - (b.priceValue ?? 1e12));
      const recommendation = ranked[0] ? `Lowest price: ${ranked[0].priceText} - ${ranked[0].title}` : 'No items ranked';
      return [{
        id: 'product_data_1',
        type: 'structured',
        content: { normalizedProducts: ranked, recommendation },
        source: {
          url: this.page!.url(),
          selector: 'product results',
          timestamp: new Date()
        },
        confidence: ranked.length ? 0.9 : 0.5
      }];
    } catch (e) {
      return [{
        id: 'product_error',
        type: 'structured',
        content: { error: 'Product comparison failed', message: e instanceof Error ? e.message : String(e) },
        source: { url: this.page!.url(), selector: 'product error', timestamp: new Date() },
        confidence: 0.1
      }];
    }
  }

  private async performGeneralSearch(parameters: any, websites: string[], report?: (evt: { progress?: number; message?: string; step?: string; site?: string; meta?: any }) => void): Promise<any[]> {
    this.logger.info('Performing general search automation', { parameters });
    
    try {
      await this.page!.goto('https://www.google.com', { 
        waitUntil: 'networkidle2',
        timeout: this.defaultTimeoutMs 
      });

      await this.waitForNetworkIdleAndSelectors(this.page!, ['input[name="q"]']);
      await this.dismissCookieBanners(this.page!);
      report?.({ step: 'search:navigated', message: 'Search page loaded', progress: 20 });

      // Perform search
      await this.page!.type('input[name="q"]', parameters.query);
      report?.({ step: 'search:typed', message: `Entered query: ${parameters.query || ''}`, progress: 35 });
      await this.page!.keyboard.press('Enter');
      await this.page!.waitForNavigation({ waitUntil: 'networkidle2' });
      report?.({ step: 'search:submitted', message: 'Submitted search', progress: 50 });

      // Extract search results
      const searchResults = await this.page!.evaluate(() => {
        const results = Array.from(document.querySelectorAll('div.g')).slice(0, 5);
        return results.map((result, index) => {
          const titleElement = result.querySelector('h3');
          const linkElement = result.querySelector('a');
          const snippetElement = result.querySelector('.VwiC3b');
          
          return {
            title: titleElement?.textContent || `Result ${index + 1}`,
            url: linkElement?.href || '',
            snippet: snippetElement?.textContent || 'No description available'
          };
        });
      });

      report?.({ step: 'search:extracted', message: `Extracted ${searchResults.length} results`, progress: 85, meta: { count: searchResults.length } });
      return [{
        id: 'search_results_1',
        type: 'structured',
        content: {
          query: parameters.query,
          results: searchResults,
          totalResults: searchResults.length
        },
        source: {
          url: this.page!.url(),
          selector: 'search results',
          timestamp: new Date()
        },
        confidence: 0.9
      }];

    } catch (error) {
      this.logger.error('General search automation failed', error);
      throw error;
    }
  }

  private async captureScreenshots(): Promise<Buffer[]> {
    if (!this.page) {
      return [];
    }

    try {
      const screenshot = await this.page.screenshot({ 
        fullPage: true,
        type: 'png'
      });
      
      return [screenshot];
    } catch (error) {
      this.logger.error('Failed to capture screenshot', error);
      return [];
    }
  }

  private async cleanup(): Promise<void> {
    try {
      // Give user time to see the results before closing
      this.logger.info('Automation completed. Browser will remain open for 15 seconds for verification...');
      await new Promise(resolve => setTimeout(resolve, 15000));
      
      if (this.page) {
        await this.page.close();
        this.page = null;
      }
      
      if (this.browser) {
        await this.browser.close();
        this.browser = null;
      }
      
      this.logger.info('Browser cleanup completed');
    } catch (error) {
      this.logger.error('Error during browser cleanup', error);
    }
  }
}
