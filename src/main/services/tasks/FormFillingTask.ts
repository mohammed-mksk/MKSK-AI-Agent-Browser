import { BaseAutomationTask } from './BaseTask';
import { CommandParameters, ExtractedData, ExecutionPlan, AutomationStep } from '../../../shared/types';
import { BrowserManager } from '../BrowserManager';
import { Page } from 'puppeteer-core';
import { AIProviderManager } from '../AIProviderManager';

interface FormFillingParams extends CommandParameters {
  url: string;
  context?: string;
  strategy?: 'best_responses' | 'honest' | 'creative' | 'professional';
  submit?: boolean;
  formData?: Record<string, string>;
}

interface FormField {
  selector: string;
  type: 'text' | 'email' | 'number' | 'select' | 'radio' | 'checkbox' | 'textarea';
  label: string;
  placeholder?: string;
  required: boolean;
  options?: string[];
}

interface FormStructure {
  fields: FormField[];
  submitButton: string;
  formAction?: string;
  formMethod?: string;
}

/**
 * Specialized task for intelligent form filling with AI-generated responses
 */
export class FormFillingTask extends BaseAutomationTask {
  name = 'Form Filling';
  type = 'form_fill';
  description = 'Automatically fill out forms with intelligent, context-appropriate responses';

  private aiProvider: AIProviderManager;

  constructor(aiProvider: AIProviderManager) {
    super();
    this.aiProvider = aiProvider;
  }

  canHandle(parameters: CommandParameters): boolean {
    const params = parameters as FormFillingParams;
    return !!(params.url || params.urls?.length);
  }

  async generateExecutionPlan(parameters: CommandParameters): Promise<ExecutionPlan> {
    const params = parameters as FormFillingParams;
    const steps: AutomationStep[] = [];
    const url = params.url || params.urls?.[0];
    
    if (!url) {
      throw new Error('URL is required for form filling task');
    }

    let stepId = 1;

    // Navigation step
    steps.push(
      this.createStep(
        `step-${stepId++}`,
        'navigate',
        { css: 'body' },
        url,
        30000,
        `Navigate to form page: ${url}`
      )
    );

    // Form analysis step
    steps.push(
      this.createStep(
        `step-${stepId++}`,
        'extract',
        { css: 'form' },
        undefined,
        15000,
        'Analyze form structure and fields'
      )
    );

    // Form filling steps (will be generated dynamically)
    steps.push(
      this.createStep(
        `step-${stepId++}`,
        'type',
        { css: 'input, textarea, select' },
        'dynamic',
        30000,
        'Fill form fields with intelligent responses'
      )
    );

    // Screenshot step
    steps.push(
      this.createStep(
        `step-${stepId++}`,
        'screenshot',
        { css: 'body' },
        undefined,
        5000,
        'Take screenshot of filled form'
      )
    );

    // Optional submit step
    if (params.submit) {
      steps.push(
        this.createStep(
          `step-${stepId++}`,
          'click',
          { css: 'button[type="submit"], input[type="submit"]' },
          undefined,
          10000,
          'Submit the form'
        )
      );
    }

    return {
      id: `form-fill-${Date.now()}`,
      steps,
      estimatedDuration: this.getEstimatedDuration(parameters),
      requiredResources: [
        { type: 'browser', amount: 1, unit: 'instances' },
        { type: 'memory', amount: 256, unit: 'MB' },
        { type: 'ai_tokens', amount: 2000, unit: 'tokens' }
      ],
      fallbackStrategies: [
        {
          condition: 'form_not_found',
          alternativeSteps: [
            this.createStep('fallback-1', 'extract', { css: 'body' }, undefined, 10000, 'Extract all input elements')
          ]
        }
      ]
    };
  }

  async execute(parameters: CommandParameters, browserManager: BrowserManager): Promise<ExtractedData[]> {
    const params = parameters as FormFillingParams;
    const url = params.url || params.urls?.[0];
    
    if (!url) {
      throw new Error('URL is required for form filling task');
    }

    const browser = await browserManager.createBrowser({ 
      headless: false, // Show browser for form filling
      viewport: { width: 1920, height: 1080 } 
    });
    const page = await browserManager.createPage(browser);

    try {
      // Set user agent
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
      
      // Navigate to the form
      await page.goto(url, { waitUntil: 'networkidle2' });

      // Analyze form structure
      const formStructure = await this.analyzeFormStructure(page);
      
      // Generate intelligent responses
      const responses = await this.generateFormResponses(formStructure, params);
      
      // Fill the form
      const fillResults = await this.fillForm(page, formStructure, responses);
      
      // Take screenshot
      const screenshot = await browserManager.takeScreenshot(page);
      
      // Submit if requested
      let submitResult = null;
      if (params.submit) {
        submitResult = await this.submitForm(page, formStructure);
      }

      // Create result data
      const resultData = {
        url,
        formStructure,
        responses,
        fillResults,
        submitResult,
        screenshot: screenshot.toString('base64')
      };

      return [
        this.createExtractedData(
          'form-fill-result',
          'structured',
          resultData,
          page.url(),
          'form',
          0.9
        )
      ];

    } finally {
      await browserManager.closeBrowser(browser);
    }
  }

  private async analyzeFormStructure(page: Page): Promise<FormStructure> {
    return await page.evaluate(() => {
      const forms = Array.from(document.querySelectorAll('form'));
      const form = forms[0] || document; // Use first form or document if no form tag
      
      const fields: FormField[] = [];
      
      // Find all input elements
      const inputs = Array.from(form.querySelectorAll('input, textarea, select'));
      
      inputs.forEach((input: any) => {
        if (input.type === 'hidden' || input.type === 'submit' || input.type === 'button') {
          return; // Skip hidden and button inputs
        }

        const label = this.findLabelForInput(input);
        const field: FormField = {
          selector: this.generateSelector(input),
          type: this.mapInputType(input.type || input.tagName.toLowerCase()),
          label: label || input.placeholder || input.name || 'Unknown field',
          placeholder: input.placeholder,
          required: input.required || input.hasAttribute('required'),
          options: this.getSelectOptions(input)
        };
        
        fields.push(field);
      });

      // Find submit button
      const submitButton = form.querySelector('button[type="submit"], input[type="submit"], button:not([type])');
      
      return {
        fields,
        submitButton: submitButton ? this.generateSelector(submitButton) : 'button[type="submit"]',
        formAction: (form as HTMLFormElement)?.action,
        formMethod: (form as HTMLFormElement)?.method
      };
    });
  }

  private async generateFormResponses(
    formStructure: FormStructure, 
    params: FormFillingParams
  ): Promise<Record<string, string>> {
    // If specific form data is provided, use it
    if (params.formData) {
      return params.formData;
    }

    const strategy = params.strategy || 'best_responses';
    const context = params.context || 'General form filling';
    
    const prompt = this.buildFormFillingPrompt(formStructure, strategy, context);
    
    try {
      const aiResponse = await this.aiProvider.generateStructuredOutput(prompt, {
        type: 'object',
        properties: {
          responses: {
            type: 'object',
            additionalProperties: { type: 'string' }
          }
        },
        required: ['responses']
      });

      return aiResponse.responses || {};
    } catch (error) {
      console.error('Failed to generate AI responses, using fallback:', error);
      return this.generateFallbackResponses(formStructure);
    }
  }

  private buildFormFillingPrompt(
    formStructure: FormStructure, 
    strategy: string, 
    context: string
  ): string {
    const strategyInstructions = {
      'best_responses': 'Provide the most compelling and positive responses that would likely lead to acceptance or approval.',
      'honest': 'Provide truthful, realistic responses that represent a typical person.',
      'creative': 'Provide creative and interesting responses that stand out while remaining appropriate.',
      'professional': 'Provide professional, business-appropriate responses suitable for corporate contexts.'
    };

    const instruction = strategyInstructions[strategy as keyof typeof strategyInstructions] || strategyInstructions.best_responses;

    return `
You are helping to fill out a form with the following context: ${context}

Strategy: ${instruction}

Form fields to fill:
${formStructure.fields.map(field => 
  `- ${field.label} (${field.type}${field.required ? ', required' : ''})${field.options ? ` Options: ${field.options.join(', ')}` : ''}`
).join('\n')}

Please provide appropriate responses for each field. For select fields, choose from the provided options.
For email fields, use a realistic email format. For phone numbers, use a realistic format.
For dates, use appropriate date formats. Keep responses concise and relevant.

Return your response as a JSON object with field labels as keys and responses as values.
`;
  }

  private generateFallbackResponses(formStructure: FormStructure): Record<string, string> {
    const responses: Record<string, string> = {};
    
    formStructure.fields.forEach(field => {
      switch (field.type) {
        case 'email':
          responses[field.label] = 'user@example.com';
          break;
        case 'text':
          if (field.label.toLowerCase().includes('name')) {
            responses[field.label] = 'John Doe';
          } else if (field.label.toLowerCase().includes('phone')) {
            responses[field.label] = '(555) 123-4567';
          } else {
            responses[field.label] = 'Sample response';
          }
          break;
        case 'number':
          responses[field.label] = '25';
          break;
        case 'select':
          if (field.options && field.options.length > 0) {
            responses[field.label] = field.options[0];
          }
          break;
        case 'textarea':
          responses[field.label] = 'This is a sample response for the text area field.';
          break;
        default:
          responses[field.label] = 'Sample';
      }
    });
    
    return responses;
  }

  private async fillForm(
    page: Page, 
    formStructure: FormStructure, 
    responses: Record<string, string>
  ): Promise<Record<string, boolean>> {
    const results: Record<string, boolean> = {};
    
    for (const field of formStructure.fields) {
      const response = responses[field.label];
      if (!response) continue;
      
      try {
        await this.waitForElement(page, { css: field.selector }, 10000);
        
        switch (field.type) {
          case 'text':
          case 'email':
          case 'number':
          case 'textarea':
            await page.click(field.selector);
            await page.evaluate((selector) => {
              const element = document.querySelector(selector) as HTMLInputElement;
              if (element) element.value = '';
            }, field.selector);
            await page.type(field.selector, response);
            break;
            
          case 'select':
            await page.select(field.selector, response);
            break;
            
          case 'radio':
            const radioSelector = `${field.selector}[value="${response}"]`;
            await page.click(radioSelector);
            break;
            
          case 'checkbox':
            if (response.toLowerCase() === 'true' || response.toLowerCase() === 'yes') {
              await page.click(field.selector);
            }
            break;
        }
        
        results[field.label] = true;
        await page.waitForTimeout(500); // Small delay between fields
        
      } catch (error) {
        console.error(`Failed to fill field ${field.label}:`, error);
        results[field.label] = false;
      }
    }
    
    return results;
  }

  private async submitForm(page: Page, formStructure: FormStructure): Promise<any> {
    try {
      await page.click(formStructure.submitButton);
      
      // Wait for navigation or success message
      await Promise.race([
        page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 }),
        page.waitForSelector('.success, .thank-you, .confirmation', { timeout: 10000 })
      ]);
      
      return {
        success: true,
        finalUrl: page.url(),
        timestamp: new Date()
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        timestamp: new Date()
      };
    }
  }

  override getEstimatedDuration(parameters: CommandParameters): number {
    const params = parameters as FormFillingParams;
    const fieldCount = Object.keys(params.formData || {}).length || 10; // Estimate 10 fields if not specified
    return 30000 + (fieldCount * 3000); // 30s base + 3s per field
  }
}