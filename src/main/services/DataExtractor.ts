import { Page } from 'puppeteer-core';
import { 
  ExtractedData, 
  StructuredData, 
  ElementSelector 
} from '../../shared/types.js';
import { DATA_TYPES } from '../../shared/constants.js';
import { AIProviderManager } from './AIProviderManager.js';
import { Logger } from './Logger.js';
import { nanoid } from 'nanoid';

interface TableData {
  headers: string[];
  rows: Record<string, string>[];
  metadata: {
    rowCount: number;
    columnCount: number;
    hasHeaders: boolean;
  };
}

interface FormData {
  fields: Array<{
    name: string;
    type: string;
    label?: string;
    value?: string;
    required?: boolean;
    options?: string[];
  }>;
  action?: string;
  method?: string;
}

interface TextContent {
  title?: string;
  headings: string[];
  paragraphs: string[];
  links: Array<{ text: string; href: string }>;
  metadata: {
    wordCount: number;
    language?: string;
  };
}

interface DataPattern {
  type: string;
  confidence: number;
  selector: string;
  description: string;
  examples: string[];
}

export class DataExtractor {
  private logger: Logger;
  private aiProvider: AIProviderManager;

  constructor(aiProvider: AIProviderManager) {
    this.logger = new Logger();
    this.aiProvider = aiProvider;
  }

  async extractStructuredData(page: Page, dataType: string): Promise<StructuredData[]> {
    try {
      this.logger.info(`Extracting structured data of type: ${dataType}`);
      
      const results: StructuredData[] = [];
      
      switch (dataType.toLowerCase()) {
        case 'flight':
          results.push(...await this.extractFlightData(page));
          break;
        case 'product':
          results.push(...await this.extractProductData(page));
          break;
        case 'contact':
          results.push(...await this.extractContactData(page));
          break;
        case 'article':
          results.push(...await this.extractArticleData(page));
          break;
        default:
          results.push(...await this.extractGenericStructuredData(page));
      }
      
      return results;
    } catch (error) {
      this.logger.error('Failed to extract structured data:', error);
      return [];
    }
  }

  async extractTableData(page: Page): Promise<TableData[]> {
    try {
      const tables = await page.$$('table');
      const results: TableData[] = [];
      
      for (const table of tables) {
        const tableData = await table.evaluate((tableEl) => {
          const rows = Array.from(tableEl.querySelectorAll('tr'));
          const headers: string[] = [];
          const data: Record<string, string>[] = [];
          
          let headerRowIndex = -1;
          
          // Find header row
          for (let i = 0; i < rows.length; i++) {
            const headerCells = rows[i].querySelectorAll('th');
            if (headerCells.length > 0) {
              headerRowIndex = i;
              headers.push(...Array.from(headerCells).map(cell => 
                cell.textContent?.trim() || `Column ${headers.length + 1}`
              ));
              break;
            }
          }
          
          // If no header row found, use first row as headers
          if (headerRowIndex === -1 && rows.length > 0) {
            const firstRowCells = rows[0].querySelectorAll('td, th');
            headers.push(...Array.from(firstRowCells).map((_, index) => `Column ${index + 1}`));
            headerRowIndex = 0;
          }
          
          // Extract data rows
          for (let i = headerRowIndex + 1; i < rows.length; i++) {
            const cells = Array.from(rows[i].querySelectorAll('td, th'));
            const rowData: Record<string, string> = {};
            
            cells.forEach((cell, index) => {
              const header = headers[index] || `Column ${index + 1}`;
              rowData[header] = cell.textContent?.trim() || '';
            });
            
            if (Object.values(rowData).some(value => value !== '')) {
              data.push(rowData);
            }
          }
          
          return {
            headers,
            rows: data,
            metadata: {
              rowCount: data.length,
              columnCount: headers.length,
              hasHeaders: headerRowIndex >= 0
            }
          };
        });
        
        if (tableData.rows.length > 0) {
          results.push(tableData);
        }
      }
      
      return results;
    } catch (error) {
      this.logger.error('Failed to extract table data:', error);
      return [];
    }
  }

  async extractFormData(page: Page): Promise<FormData[]> {
    try {
      const forms = await page.$$('form');
      const results: FormData[] = [];
      
      for (const form of forms) {
        const formData = await form.evaluate((formEl) => {
          const fields: any[] = [];
          const inputs = formEl.querySelectorAll('input, textarea, select');
          
          inputs.forEach(input => {
            const field: any = {
              name: input.getAttribute('name') || input.getAttribute('id') || '',
              type: input.getAttribute('type') || input.tagName.toLowerCase()
            };
            
            // Get label
            const label = formEl.querySelector(`label[for="${input.id}"]`) ||
                         input.closest('label') ||
                         input.previousElementSibling?.tagName === 'LABEL' ? input.previousElementSibling : null;
            
            if (label) {
              field.label = label.textContent?.trim();
            }
            
            // Get current value
            if (input.tagName.toLowerCase() === 'select') {
              const select = input as HTMLSelectElement;
              field.value = select.value;
              field.options = Array.from(select.options).map(opt => opt.text);
            } else {
              field.value = (input as HTMLInputElement).value;
            }
            
            // Check if required
            field.required = input.hasAttribute('required');
            
            fields.push(field);
          });
          
          return {
            fields,
            action: formEl.getAttribute('action') || '',
            method: formEl.getAttribute('method') || 'GET'
          };
        });
        
        if (formData.fields.length > 0) {
          results.push(formData);
        }
      }
      
      return results;
    } catch (error) {
      this.logger.error('Failed to extract form data:', error);
      return [];
    }
  }

  async extractTextContent(page: Page, context: string): Promise<TextContent> {
    try {
      const content = await page.evaluate(() => {
        const title = document.title;
        
        // Extract headings
        const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6'))
          .map(h => h.textContent?.trim())
          .filter(Boolean) as string[];
        
        // Extract paragraphs
        const paragraphs = Array.from(document.querySelectorAll('p'))
          .map(p => p.textContent?.trim())
          .filter(text => text && text.length > 20) as string[];
        
        // Extract links
        const links = Array.from(document.querySelectorAll('a[href]'))
          .map(a => ({
            text: a.textContent?.trim() || '',
            href: a.getAttribute('href') || ''
          }))
          .filter(link => link.text && link.href);
        
        // Calculate word count
        const allText = [title, ...headings, ...paragraphs].join(' ');
        const wordCount = allText.split(/\s+/).length;
        
        return {
          title,
          headings,
          paragraphs,
          links,
          metadata: {
            wordCount,
            language: document.documentElement.lang || undefined
          }
        };
      });
      
      return content;
    } catch (error) {
      this.logger.error('Failed to extract text content:', error);
      return {
        headings: [],
        paragraphs: [],
        links: [],
        metadata: { wordCount: 0 }
      };
    }
  }

  async recognizeDataPatterns(html: string): Promise<DataPattern[]> {
    try {
      // Use AI to analyze HTML and identify data patterns
      const prompt = `
        Analyze the following HTML content and identify structured data patterns.
        Look for patterns like:
        - Flight information (prices, times, airlines)
        - Product listings (names, prices, descriptions)
        - Contact information (emails, phones, addresses)
        - Tables with structured data
        - Forms with specific purposes
        
        HTML Content (truncated):
        ${html.substring(0, 5000)}
        
        Return a JSON array of patterns found, each with:
        - type: the type of data pattern
        - confidence: confidence score 0-1
        - selector: CSS selector to find this pattern
        - description: human-readable description
        - examples: array of example values found
      `;
      
      const response = await this.aiProvider.generateCompletion(prompt);
      
      try {
        const patterns = JSON.parse(response);
        return Array.isArray(patterns) ? patterns : [];
      } catch {
        // If AI response is not valid JSON, return empty array
        return [];
      }
    } catch (error) {
      this.logger.error('Failed to recognize data patterns:', error);
      return [];
    }
  }

  private async extractFlightData(page: Page): Promise<StructuredData[]> {
    const results: StructuredData[] = [];
    
    // Common flight data selectors
    const flightSelectors = [
      '.flight-result',
      '.flight-card',
      '[data-testid*="flight"]',
      '.itinerary',
      '.flight-option'
    ];
    
    for (const selector of flightSelectors) {
      try {
        const elements = await page.$$(selector);
        
        for (const element of elements) {
          const flightData = await element.evaluate((el) => {
            const getText = (sel: string) => el.querySelector(sel)?.textContent?.trim() || '';
            const getAttr = (sel: string, attr: string) => el.querySelector(sel)?.getAttribute(attr) || '';
            
            return {
              airline: getText('.airline, [data-testid*="airline"]') || 
                      getText('img[alt*="logo"]')?.replace(' logo', '') || '',
              price: getText('.price, .fare, [data-testid*="price"]') || '',
              departure: {
                time: getText('.departure-time, [data-testid*="departure"]') || '',
                airport: getText('.departure-airport, .origin') || '',
                date: getText('.departure-date') || ''
              },
              arrival: {
                time: getText('.arrival-time, [data-testid*="arrival"]') || '',
                airport: getText('.arrival-airport, .destination') || '',
                date: getText('.arrival-date') || ''
              },
              duration: getText('.duration, .flight-time') || '',
              stops: getText('.stops, .connections') || '0',
              bookingUrl: getAttr('a', 'href') || window.location.href
            };
          });
          
          if (flightData.price || flightData.airline) {
            results.push({
              type: 'flight',
              fields: flightData,
              confidence: 0.8,
              source: { css: selector }
            });
          }
        }
      } catch (error) {
        this.logger.warn(`Failed to extract flight data with selector ${selector}:`, error);
      }
    }
    
    return results;
  }

  private async extractProductData(page: Page): Promise<StructuredData[]> {
    const results: StructuredData[] = [];
    
    const productSelectors = [
      '.product',
      '.item',
      '[data-testid*="product"]',
      '.listing',
      '.card'
    ];
    
    for (const selector of productSelectors) {
      try {
        const elements = await page.$$(selector);
        
        for (const element of elements) {
          const productData = await element.evaluate((el) => {
            const getText = (sel: string) => el.querySelector(sel)?.textContent?.trim() || '';
            const getAttr = (sel: string, attr: string) => el.querySelector(sel)?.getAttribute(attr) || '';
            
            return {
              name: getText('h1, h2, h3, .title, .name, [data-testid*="title"]') || '',
              price: getText('.price, .cost, [data-testid*="price"]') || '',
              description: getText('.description, .summary') || '',
              image: getAttr('img', 'src') || '',
              rating: getText('.rating, .stars') || '',
              availability: getText('.availability, .stock') || '',
              url: getAttr('a', 'href') || window.location.href
            };
          });
          
          if (productData.name || productData.price) {
            results.push({
              type: 'product',
              fields: productData,
              confidence: 0.7,
              source: { css: selector }
            });
          }
        }
      } catch (error) {
        this.logger.warn(`Failed to extract product data with selector ${selector}:`, error);
      }
    }
    
    return results;
  }

  private async extractContactData(page: Page): Promise<StructuredData[]> {
    const results: StructuredData[] = [];
    
    try {
      const contactData = await page.evaluate(() => {
        const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
        const phoneRegex = /(\+?1?[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})/g;
        
        const text = document.body.textContent || '';
        const emails = text.match(emailRegex) || [];
        const phones = text.match(phoneRegex) || [];
        
        // Extract addresses (basic pattern)
        const addressElements = Array.from(document.querySelectorAll('[class*="address"], [class*="location"]'));
        const addresses = addressElements.map(el => el.textContent?.trim()).filter(Boolean);
        
        return {
          emails: [...new Set(emails)],
          phones: [...new Set(phones)],
          addresses: [...new Set(addresses)]
        };
      });
      
      if (contactData.emails.length > 0 || contactData.phones.length > 0 || contactData.addresses.length > 0) {
        results.push({
          type: 'contact',
          fields: contactData,
          confidence: 0.9,
          source: { css: 'body' }
        });
      }
    } catch (error) {
      this.logger.warn('Failed to extract contact data:', error);
    }
    
    return results;
  }

  private async extractArticleData(page: Page): Promise<StructuredData[]> {
    const results: StructuredData[] = [];
    
    try {
      const articleData = await page.evaluate(() => {
        // Try to find article content
        const articleEl = document.querySelector('article, .article, .post, .content, main');
        const contentEl = articleEl || document.body;
        
        const title = document.querySelector('h1')?.textContent?.trim() || document.title;
        const author = document.querySelector('.author, [rel="author"]')?.textContent?.trim() || '';
        const publishDate = document.querySelector('time, .date, .published')?.textContent?.trim() || '';
        
        // Extract paragraphs from article content
        const paragraphs = Array.from(contentEl.querySelectorAll('p'))
          .map(p => p.textContent?.trim())
          .filter(text => text && text.length > 50);
        
        return {
          title,
          author,
          publishDate,
          content: paragraphs.join('\n\n'),
          wordCount: paragraphs.join(' ').split(/\s+/).length
        };
      });
      
      if (articleData.title || articleData.content) {
        results.push({
          type: 'article',
          fields: articleData,
          confidence: 0.8,
          source: { css: 'article, .article, .post, .content, main' }
        });
      }
    } catch (error) {
      this.logger.warn('Failed to extract article data:', error);
    }
    
    return results;
  }

  private async extractGenericStructuredData(page: Page): Promise<StructuredData[]> {
    const results: StructuredData[] = [];
    
    try {
      // Extract JSON-LD structured data
      const jsonLdData = await page.evaluate(() => {
        const scripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
        return scripts.map(script => {
          try {
            return JSON.parse(script.textContent || '');
          } catch {
            return null;
          }
        }).filter(Boolean);
      });
      
      jsonLdData.forEach((data, index) => {
        results.push({
          type: 'structured',
          fields: data,
          confidence: 0.95,
          source: { css: `script[type="application/ld+json"]:nth-child(${index + 1})` }
        });
      });
      
      // Extract microdata
      const microdataItems = await page.$$('[itemscope]');
      for (const item of microdataItems) {
        const itemData = await item.evaluate((el) => {
          const data: any = {};
          const type = el.getAttribute('itemtype');
          if (type) data['@type'] = type;
          
          const props = el.querySelectorAll('[itemprop]');
          props.forEach(prop => {
            const name = prop.getAttribute('itemprop');
            const value = prop.textContent?.trim() || prop.getAttribute('content') || '';
            if (name && value) {
              data[name] = value;
            }
          });
          
          return data;
        });
        
        if (Object.keys(itemData).length > 1) {
          results.push({
            type: 'structured',
            fields: itemData,
            confidence: 0.85,
            source: { css: '[itemscope]' }
          });
        }
      }
    } catch (error) {
      this.logger.warn('Failed to extract generic structured data:', error);
    }
    
    return results;
  }
}