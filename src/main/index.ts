import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { Logger } from './services/Logger.js';
import { DatabaseService } from './services/DatabaseService.js';
import { AIProviderManager } from './services/AIProviderManager.js';
import { ExecutionPlanner } from './services/ExecutionPlanner.js';
import { SecureStorage } from './services/SecureStorage.js';
import { BrowserAutomationService } from './services/BrowserAutomationService.js';
import { AIResearchService } from './services/AIResearchService.js';
import { IPC_CHANNELS } from '../shared/constants.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class MainApplication {
  private mainWindow: BrowserWindow | null = null;
  private logger: Logger;
  private databaseService: DatabaseService;
  private aiProviderManager: AIProviderManager;
  private executionPlanner: ExecutionPlanner;
  private secureStorage: SecureStorage;
  private browserAutomation: BrowserAutomationService;
  private aiResearch: AIResearchService;

  // Input validation and sanitization methods
  private validateString(input: any, maxLength: number = 10000): string {
    if (typeof input !== 'string') {
      throw new Error('Input must be a string');
    }
    if (input.length > maxLength) {
      throw new Error(`Input exceeds maximum length of ${maxLength} characters`);
    }
    // Basic sanitization - remove potentially dangerous characters
    return input.replace(/[<>\"'&]/g, '');
  }

  private validateNumber(input: any, min?: number, max?: number): number {
    const num = Number(input);
    if (isNaN(num)) {
      throw new Error('Input must be a valid number');
    }
    if (min !== undefined && num < min) {
      throw new Error(`Number must be at least ${min}`);
    }
    if (max !== undefined && num > max) {
      throw new Error(`Number must be at most ${max}`);
    }
    return num;
  }

  private validateBoolean(input: any): boolean {
    if (typeof input !== 'boolean') {
      throw new Error('Input must be a boolean');
    }
    return input;
  }

  private sanitizeObject(obj: any): any {
    if (obj === null || obj === undefined) {
      return obj;
    }
    if (typeof obj === 'string') {
      return this.validateString(obj);
    }
    if (typeof obj === 'number' || typeof obj === 'boolean') {
      return obj;
    }
    if (Array.isArray(obj)) {
      return obj.map(item => this.sanitizeObject(item));
    }
    if (typeof obj === 'object') {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(obj)) {
        const sanitizedKey = this.validateString(key, 100);
        sanitized[sanitizedKey] = this.sanitizeObject(value);
      }
      return sanitized;
    }
    return obj;
  }

  constructor() {
    this.logger = new Logger();
    this.databaseService = new DatabaseService();
    this.aiProviderManager = new AIProviderManager();
    this.executionPlanner = new ExecutionPlanner(this.aiProviderManager);
    this.secureStorage = new SecureStorage();
    this.browserAutomation = new BrowserAutomationService(this.aiProviderManager);
    this.aiResearch = new AIResearchService(this.aiProviderManager);
    
    // Inject dependencies into AI provider manager
    this.aiProviderManager.setSecureStorage(this.secureStorage);
    this.aiProviderManager.setDatabaseService(this.databaseService);
    
    this.initializeApp();
  }

  private async initializeApp(): Promise<void> {
    try {
      // Initialize services
      await this.databaseService.initialize();
      await this.aiProviderManager.initialize();
      
      // Don't initialize browser automation here - it will be initialized on demand
      this.logger.info('Browser automation service will be initialized on demand');
      
      this.logger.info('Application services initialized successfully');
      
      // Set up app event handlers
      this.setupAppEventHandlers();
      
      // Set up IPC handlers
      this.setupIPCHandlers();
      
    } catch (error) {
      this.logger.error('Failed to initialize application:', error);
      app.quit();
    }
  }

  private setupAppEventHandlers(): void {
    app.whenReady().then(() => {
      this.createMainWindow();
      
      app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
          this.createMainWindow();
        }
      });
    });

    app.on('window-all-closed', () => {
      if (process.platform !== 'darwin') {
        app.quit();
      }
    });

    app.on('before-quit', async () => {
      try {
        await this.cleanup();
      } catch (error) {
        this.logger.error('Error during cleanup:', error);
      }
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      this.logger.error('Uncaught exception:', error);
      dialog.showErrorBox('Unexpected Error', error.message);
    });

    process.on('unhandledRejection', (reason) => {
      this.logger.error('Unhandled rejection:', reason);
    });
  }

  private createMainWindow(): void {
    this.mainWindow = new BrowserWindow({
      width: 1400,
      height: 900,
      minWidth: 1200,
      minHeight: 800,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        allowRunningInsecureContent: false,
        experimentalFeatures: false,
        webSecurity: true,
        preload: join(__dirname, '../../preload/index.js')
      },
      titleBarStyle: 'default',
      show: false
    });

    // Set up Content Security Policy
    this.mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          'Content-Security-Policy': [
            "default-src 'self'; " +
            "script-src 'self' 'unsafe-inline'; " +
            "style-src 'self' 'unsafe-inline'; " +
            "img-src 'self' data: https:; " +
            "font-src 'self' data:; " +
            "connect-src 'self' https://api.openai.com https://api.anthropic.com; " +
            "object-src 'none'; " +
            "base-uri 'self';"
          ]
        }
      });
    });

    // Load the React app
    if (process.env['NODE_ENV'] === 'development') {
      this.mainWindow.loadURL('http://localhost:5173');
      this.mainWindow.webContents.openDevTools();
    } else {
      this.mainWindow.loadFile(join(__dirname, '../../../src/renderer/dist/index.html'));
    }

    // Show window when ready
    this.mainWindow.once('ready-to-show', () => {
      this.mainWindow?.show();
      this.logger.info('Main window created and shown');
      
      // Main window is ready
    });

    // Handle window closed
    this.mainWindow.on('closed', () => {
      this.mainWindow = null;
    });
  }

  private setupIPCHandlers(): void {
    // AI Provider handlers
    ipcMain.handle(IPC_CHANNELS.AI_PARSE_COMMAND, async (_, command: string) => {
      try {
        const sanitizedCommand = this.validateString(command, 50000);
        
        // Check if AI provider is configured
        if (!this.aiProviderManager.getCurrentProvider()) {
          throw new Error('No AI provider configured. Please set up your API keys in Settings.');
        }
        
        this.logger.info(`Parsing command: ${sanitizedCommand.substring(0, 100)}...`);
        const result = await this.aiProviderManager.parseCommand(sanitizedCommand);
        this.logger.info(`Command parsed successfully with confidence: ${result.confidence}`);
        
        return { success: true, data: result };
      } catch (error) {
        this.logger.error('Failed to parse command:', error);
        return { success: false, error: (error as Error).message };
      }
    });

    ipcMain.handle(IPC_CHANNELS.AI_SET_PROVIDER, async (_, provider: string, config: any) => {
      try {
        const sanitizedProvider = this.validateString(provider, 100);
        const sanitizedConfig = this.sanitizeObject(config);
        
        // If no API key in config, try to get it from secure storage
        if (!sanitizedConfig.apiKey) {
          const encryptedData = await this.databaseService.getSetting(`encrypted_api_key_${sanitizedProvider}`);
          if (encryptedData) {
            try {
              const decryptedData = this.secureStorage.retrieveAPIKey(encryptedData);
              sanitizedConfig.apiKey = decryptedData.apiKey;
            } catch (decryptError) {
              this.logger.error('Failed to decrypt stored API key:', decryptError);
            }
          }
        }
        
        await this.aiProviderManager.setProvider(sanitizedProvider, sanitizedConfig);
        this.logger.info(`AI provider successfully set to: ${sanitizedProvider}`);
        
        // Also reinitialize to ensure everything is properly configured
        try {
          await this.aiProviderManager.reinitialize();
          this.logger.info('AI Provider Manager reinitialized after provider change');
        } catch (error) {
          this.logger.warn('Failed to reinitialize AI Provider Manager:', error);
        }
        
        return { success: true };
      } catch (error) {
        this.logger.error('Failed to set AI provider:', error);
        return { success: false, error: (error as Error).message };
      }
    });

    ipcMain.handle(IPC_CHANNELS.AI_GET_PROVIDERS, async () => {
      try {
        const providers = await this.aiProviderManager.getAvailableProviders();
        return { success: true, data: providers };
      } catch (error) {
        this.logger.error('Failed to get AI providers:', error);
        return { success: false, error: (error as Error).message };
      }
    });

    // Automation handlers
    ipcMain.handle(IPC_CHANNELS.AUTOMATION_START, async (_, command: string) => {
      try {
        this.logger.info(`Starting automation for command: ${command}`);
        
        // Parse command
        const parsedCommand = await this.aiProviderManager.parseCommand(command);
        this.logger.info('Command parsed successfully');
        
        // Create execution plan
        const executionPlan = await this.executionPlanner.createExecutionPlan(parsedCommand);
        this.logger.info('Execution plan created');
        
        // Check if browser is available
        if (!this.browserAutomation.isRunning()) {
          this.logger.info('Browser not connected, attempting to initialize...');
          await this.browserAutomation.initialize();
        }
        
        // Execute the automation plan
        this.logger.info('Starting browser automation execution...');
        let result = await this.browserAutomation.executeAutomation(executionPlan);
        
        // Set the command in the result
        result.command = command;
        
        // Enhance result with AI analysis and synthesis
        try {
          this.logger.info('Enhancing results with AI analysis...');
          result = await this.aiResearch.enhanceAutomationResult(result, command);
        } catch (enhanceError) {
          this.logger.warn('Failed to enhance results with AI analysis:', enhanceError);
          // Continue without enhancement
        }
        
        // Save result to database with enhanced metadata
        try {
          const enhancedResult = {
            ...result,
            timestamp: new Date(),
            metadata: {
              ...result.metadata,
              searchQuery: command,
              sites: result.extractedData.map(data => data.source.url).filter((url, index, arr) => arr.indexOf(url) === index),
              resultCount: result.extractedData.length,
              sessionId: Date.now().toString()
            }
          };
          
          await this.databaseService.saveAutomationResult(enhancedResult);
          this.logger.info(`Results saved with ${result.extractedData.length} items from ${enhancedResult.metadata.sites.length} sites`);
        } catch (dbError) {
          this.logger.warn('Failed to save result to database:', dbError);
          // Don't fail the entire operation for database issues
        }
        
        this.logger.info('Automation completed successfully');
        return { success: true, data: { parsedCommand, executionPlan, result } };
      } catch (error) {
        this.logger.error('Failed to start automation:', error);
        
        // Try to reinitialize browser if it's a connection issue
        if (error instanceof Error && (error.message.includes('Protocol error') || error.message.includes('Connection closed'))) {
          this.logger.info('Attempting to reinitialize browser due to connection error...');
          try {
            await this.browserAutomation.cleanup();
            await this.browserAutomation.initialize();
            this.logger.info('Browser reinitialized successfully');
          } catch (reinitError) {
            this.logger.error('Failed to reinitialize browser:', reinitError);
          }
        }
        
        return { success: false, error: (error as Error).message };
      }
    });

    ipcMain.handle(IPC_CHANNELS.AUTOMATION_STOP, async () => {
      try {
        await this.browserAutomation.stopExecution();
        return { success: true };
      } catch (error) {
        this.logger.error('Failed to stop automation:', error);
        return { success: false, error: (error as Error).message };
      }
    });

    // Database handlers
    ipcMain.handle(IPC_CHANNELS.DB_GET_HISTORY, async () => {
      try {
        const history = await this.databaseService.getAutomationHistory();
        return { success: true, data: history };
      } catch (error) {
        this.logger.error('Failed to get automation history:', error);
        return { success: false, error: (error as Error).message };
      }
    });

    ipcMain.handle(IPC_CHANNELS.DB_GET_WORKFLOWS, async () => {
      try {
        const workflows = await this.databaseService.getWorkflows();
        return { success: true, data: workflows };
      } catch (error) {
        this.logger.error('Failed to get workflows:', error);
        return { success: false, error: (error as Error).message };
      }
    });

    // Settings handlers
    ipcMain.handle(IPC_CHANNELS.SETTINGS_GET, async (_, key: string) => {
      try {
        const sanitizedKey = this.validateString(key, 200);
        const value = await this.databaseService.getSetting(sanitizedKey);
        return { success: true, data: value };
      } catch (error) {
        this.logger.error('Failed to get setting:', error);
        return { success: false, error: (error as Error).message };
      }
    });

    ipcMain.handle(IPC_CHANNELS.SETTINGS_SET, async (_, key: string, value: any) => {
      try {
        const sanitizedKey = this.validateString(key, 200);
        const sanitizedValue = this.sanitizeObject(value);
        await this.databaseService.setSetting(sanitizedKey, sanitizedValue);
        return { success: true };
      } catch (error) {
        this.logger.error('Failed to set setting:', error);
        return { success: false, error: (error as Error).message };
      }
    });

    // Secure API key handlers
    ipcMain.handle('secure:store-api-key', async (_, provider: string, apiKey: string) => {
      try {
        const sanitizedProvider = this.validateString(provider, 100);
        const sanitizedApiKey = this.validateString(apiKey, 1000);
        
        // Validate that this looks like a real API key
        if (sanitizedApiKey.length < 10) {
          throw new Error('API key appears to be too short');
        }
        
        const encryptedData = this.secureStorage.storeAPIKey(sanitizedProvider, sanitizedApiKey);
        // Convert Buffer to base64 string for database storage
        const encryptedString = encryptedData.toString('base64');
        await this.databaseService.setSetting(`encrypted_api_key_${sanitizedProvider}`, encryptedString);
        
        this.logger.info(`API key stored successfully for provider: ${sanitizedProvider}`);
        
        // Reinitialize AI provider manager to pick up the new key
        try {
          await this.aiProviderManager.reinitialize();
          this.logger.info('AI Provider Manager reinitialized after API key storage');
        } catch (error) {
          this.logger.warn('Failed to reinitialize AI Provider Manager:', error);
        }
        
        return { success: true };
      } catch (error) {
        this.logger.error('Failed to store API key:', error);
        return { success: false, error: (error as Error).message };
      }
    });

    ipcMain.handle('secure:get-api-key', async (_, provider: string) => {
      try {
        const sanitizedProvider = this.validateString(provider, 100);
        const encryptedString = await this.databaseService.getSetting(`encrypted_api_key_${sanitizedProvider}`);
        
        if (!encryptedString) {
          return { success: true, data: null };
        }
        
        // Convert base64 string back to Buffer
        const encryptedData = Buffer.from(encryptedString, 'base64');
        const decryptedData = this.secureStorage.retrieveAPIKey(encryptedData);
        return { success: true, data: { provider: decryptedData.provider, hasKey: true } };
      } catch (error) {
        this.logger.error('Failed to retrieve API key:', error);
        return { success: false, error: (error as Error).message };
      }
    });

    ipcMain.handle('secure:remove-api-key', async (_, provider: string) => {
      try {
        const sanitizedProvider = this.validateString(provider, 100);
        await this.databaseService.setSetting(`encrypted_api_key_${sanitizedProvider}`, null);
        return { success: true };
      } catch (error) {
        this.logger.error('Failed to remove API key:', error);
        return { success: false, error: (error as Error).message };
      }
    });

    ipcMain.handle('secure:encryption-available', async () => {
      try {
        const available = this.secureStorage.isEncryptionSupported();
        return { success: true, data: available };
      } catch (error) {
        this.logger.error('Failed to check encryption availability:', error);
        return { success: false, error: (error as Error).message };
      }
    });

    // Browser handlers (placeholder - browser automation not yet implemented)
    ipcMain.handle(IPC_CHANNELS.BROWSER_SCREENSHOT, async (_, url: string) => {
      try {
        this.logger.info(`Screenshot requested for: ${url}`);
        return { success: true, data: Buffer.alloc(0) }; // Placeholder
      } catch (error) {
        this.logger.error('Failed to take screenshot:', error);
        return { success: false, error: (error as Error).message };
      }
    });

    ipcMain.handle(IPC_CHANNELS.BROWSER_STATUS, async () => {
      try {
        return { success: true, data: { status: 'ready' } }; // Placeholder
      } catch (error) {
        this.logger.error('Failed to get browser status:', error);
        return { success: false, error: (error as Error).message };
      }
    });

    // Debug and logging handlers (simplified)
    ipcMain.handle(IPC_CHANNELS.DEBUG_GET_LOGS, async (_, limit?: number) => {
      try {
        // Return empty logs for now
        return { success: true, data: [] };
      } catch (error) {
        this.logger.error('Failed to get logs:', error);
        return { success: false, error: (error as Error).message };
      }
    });

    ipcMain.handle(IPC_CHANNELS.DEBUG_GET_SESSION, async () => {
      try {
        return { success: true, data: null };
      } catch (error) {
        this.logger.error('Failed to get current debug session:', error);
        return { success: false, error: (error as Error).message };
      }
    });

    ipcMain.handle(IPC_CHANNELS.DEBUG_GET_ALL_SESSIONS, async () => {
      try {
        return { success: true, data: [] };
      } catch (error) {
        this.logger.error('Failed to get all debug sessions:', error);
        return { success: false, error: (error as Error).message };
      }
    });

    ipcMain.handle(IPC_CHANNELS.DEBUG_GET_STATS, async () => {
      try {
        return { success: true, data: {} };
      } catch (error) {
        this.logger.error('Failed to get debug stats:', error);
        return { success: false, error: (error as Error).message };
      }
    });

    ipcMain.handle(IPC_CHANNELS.DEBUG_GET_PERFORMANCE, async (_, limit?: number) => {
      try {
        return { success: true, data: [] };
      } catch (error) {
        this.logger.error('Failed to get performance metrics:', error);
        return { success: false, error: (error as Error).message };
      }
    });

    ipcMain.handle(IPC_CHANNELS.DEBUG_SET_REAL_TIME, async (_, enabled: boolean) => {
      try {
        this.logger.info(`Real-time mode ${enabled ? 'enabled' : 'disabled'}`);
        return { success: true };
      } catch (error) {
        this.logger.error('Failed to set real-time mode:', error);
        return { success: false, error: (error as Error).message };
      }
    });

    ipcMain.handle(IPC_CHANNELS.DEBUG_SET_DEBUG_MODE, async (_, enabled: boolean) => {
      try {
        this.logger.info(`Debug mode ${enabled ? 'enabled' : 'disabled'}`);
        return { success: true };
      } catch (error) {
        this.logger.error('Failed to set debug mode:', error);
        return { success: false, error: (error as Error).message };
      }
    });

    ipcMain.handle(IPC_CHANNELS.DEBUG_EXPORT_LOGS, async (_, filePath: string, filter?: any) => {
      try {
        this.logger.info(`Export logs requested to: ${filePath}`);
        return { success: true };
      } catch (error) {
        this.logger.error('Failed to export logs:', error);
        return { success: false, error: (error as Error).message };
      }
    });

    ipcMain.handle(IPC_CHANNELS.DEBUG_CLEAR_LOGS, async () => {
      try {
        this.logger.info('Clear logs requested');
        return { success: true };
      } catch (error) {
        this.logger.error('Failed to clear logs:', error);
        return { success: false, error: (error as Error).message };
      }
    });

    // Additional debug handlers
    ipcMain.handle('debug:get-log-stats', async () => {
      try {
        return { success: true, data: {} };
      } catch (error) {
        this.logger.error('Failed to get log stats:', error);
        return { success: false, error: (error as Error).message };
      }
    });

    ipcMain.handle('debug:clear-all-sessions', async () => {
      try {
        this.logger.info('Clear all sessions requested');
        return { success: true };
      } catch (error) {
        this.logger.error('Failed to clear all sessions:', error);
        return { success: false, error: (error as Error).message };
      }
    });

    // Dialog handlers for file operations
    ipcMain.handle('dialog:showSaveDialog', async (_, options) => {
      try {
        const result = await dialog.showSaveDialog(this.mainWindow!, options);
        return result.filePath;
      } catch (error) {
        this.logger.error('Failed to show save dialog:', error);
        return undefined;
      }
    });

    ipcMain.handle('dialog:showOpenDialog', async (_, options) => {
      try {
        const result = await dialog.showOpenDialog(this.mainWindow!, options);
        return result.filePaths;
      } catch (error) {
        this.logger.error('Failed to show open dialog:', error);
        return undefined;
      }
    });

    ipcMain.handle('dialog:showMessageBox', async (_, options) => {
      try {
        const result = await dialog.showMessageBox(this.mainWindow!, options);
        return result.response;
      } catch (error) {
        this.logger.error('Failed to show message box:', error);
        return 0;
      }
    });

    // Update service handlers (placeholder)
    ipcMain.handle('update:check-for-updates', async (_, manual: boolean = false) => {
      try {
        this.logger.info(`Update check requested (manual: ${manual})`);
        return { success: true };
      } catch (error) {
        this.logger.error('Failed to check for updates:', error);
        return { success: false, error: (error as Error).message };
      }
    });

    ipcMain.handle('update:download-update', async () => {
      try {
        this.logger.info('Update download requested');
        return { success: true };
      } catch (error) {
        this.logger.error('Failed to download update:', error);
        return { success: false, error: (error as Error).message };
      }
    });

    ipcMain.handle('update:quit-and-install', async () => {
      try {
        this.logger.info('Quit and install requested');
        return { success: true };
      } catch (error) {
        this.logger.error('Failed to quit and install:', error);
        return { success: false, error: (error as Error).message };
      }
    });

    ipcMain.handle('update:get-version-info', async () => {
      try {
        return { success: true, data: { version: '1.0.0' } };
      } catch (error) {
        this.logger.error('Failed to get version info:', error);
        return { success: false, error: (error as Error).message };
      }
    });
  }

  private setupRealTimeEventForwarding(): void {
    // Placeholder for real-time event forwarding
    this.logger.info('Real-time event forwarding setup requested');
  }

  private async cleanup(): Promise<void> {
    this.logger.info('Starting application cleanup...');
    
    try {
      // Clean up services
      await this.databaseService.close();
      await this.browserAutomation.cleanup();
      
      // Close logger
      this.logger.close();
      
      this.logger.info('Application cleanup completed');
    } catch (error) {
      this.logger.error('Error during cleanup:', error);
    }
  }
}

// Create and start the application
new MainApplication();