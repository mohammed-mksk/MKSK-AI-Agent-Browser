import { app, BrowserWindow, ipcMain } from 'electron';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { SimpleDatabase } from './services/SimpleDatabase.js';
import { IPC_CHANNELS } from '../shared/constants.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class MinimalApplication {
  private mainWindow: BrowserWindow | null = null;
  private database: SimpleDatabase;
  private runningAutomations: Map<string, boolean> = new Map();

  constructor() {
    this.database = new SimpleDatabase();
    this.initializeApp();
  }

  private async initializeApp(): Promise<void> {
    try {
      // Initialize database
      await this.database.initialize();
      console.log('Database initialized successfully');
      
      // Set up IPC handlers
      this.setupIPCHandlers();
      
      // Set up app event handlers
      this.setupAppEventHandlers();
    } catch (error) {
      console.error('Failed to initialize application:', error);
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
        preload: join(__dirname, '../../preload/index.js')
      },
      titleBarStyle: 'default',
      show: false
    });

    // Load the React app from the correct location
    // __dirname is dist/main/main, so we need to go up three levels to get to src/renderer/dist
    const rendererPath = join(__dirname, '../../../src/renderer/dist/index.html');
    console.log('Loading renderer from:', rendererPath);
    
    this.mainWindow.loadFile(rendererPath).catch((err) => {
      console.error('Failed to load renderer:', err);
      // If renderer build doesn't exist, show a simple page
      this.mainWindow?.loadURL('data:text/html,<html><body style="background-color: #1a1a1a; color: white; font-family: Arial, sans-serif; text-align: center; padding-top: 100px;"><h1>AI Automation Browser</h1><p>Application is starting...</p><p>The React frontend is being built. Please wait.</p></body></html>');
    });

    // Show window when ready
    this.mainWindow.once('ready-to-show', () => {
      this.mainWindow?.show();
      console.log('AI Automation Browser started successfully!');
    });

    // Handle window closed
    this.mainWindow.on('closed', () => {
      this.mainWindow = null;
    });

    // Open DevTools in development
    if (process.env['NODE_ENV'] === 'development') {
      this.mainWindow.webContents.openDevTools();
    }
  }

  private simulateAutomationProgress(command: string, automationId: string): void {
    this.runningAutomations.set(automationId, true);
    
    const steps = [
      { progress: 10, message: 'Initializing browser...', delay: 500 },
      { progress: 25, message: 'Starting browser...', delay: 1000 },
      { progress: 40, message: 'Navigating to website...', delay: 1500 },
      { progress: 60, message: 'Processing data...', delay: 2000 },
      { progress: 80, message: 'Extracting results...', delay: 1000 },
      { progress: 100, message: 'Completed!', delay: 500 }
    ];

    let currentStep = 0;
    
    const executeStep = () => {
      if (!this.runningAutomations.get(automationId) || currentStep >= steps.length) {
        return;
      }

      const step = steps[currentStep];
      
      try {
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
          this.mainWindow.webContents.send(IPC_CHANNELS.AUTOMATION_PROGRESS, {
            id: automationId,
            progress: step.progress,
            message: step.message
          });
        }

        currentStep++;
        
        if (currentStep < steps.length) {
          setTimeout(executeStep, step.delay);
        } else {
          // Send final result
          this.sendAutomationResult(command, automationId);
        }
      } catch (error) {
        console.error('Error during progress simulation:', error);
        this.handleAutomationError(automationId, error);
      }
    };

    setTimeout(executeStep, 100);
  }

  private sendAutomationResult(command: string, automationId: string): void {
    try {
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        // Simulate different results based on command type
        let mockData;
        if (command.toLowerCase().includes('flight')) {
          mockData = {
            flights: [
              { airline: 'Delta', departure: '08:00', arrival: '14:30', price: '$450', duration: '6h 30m' },
              { airline: 'British Airways', departure: '10:15', arrival: '16:45', price: '$520', duration: '6h 30m' },
              { airline: 'United', departure: '13:45', arrival: '20:15', price: '$390', duration: '6h 30m' },
              { airline: 'American Airlines', departure: '16:30', arrival: '22:00', price: '$475', duration: '5h 30m' }
            ]
          };
        } else if (command.toLowerCase().includes('research')) {
          mockData = {
            summary: 'Research completed successfully',
            sources: ['source1.com', 'source2.com', 'source3.com'],
            keyPoints: ['Point 1', 'Point 2', 'Point 3']
          };
        } else {
          mockData = {
            message: 'Task completed successfully',
            details: 'Mock automation result'
          };
        }

        this.mainWindow.webContents.send(IPC_CHANNELS.AUTOMATION_RESULT, {
          id: automationId,
          command: command,
          result: {
            success: true,
            data: mockData
          },
          timestamp: Date.now(),
          duration: 4.5
        });

        // Save result to database
        this.database.saveResult({
          id: automationId,
          command: command,
          result: { success: true, data: mockData },
          timestamp: Date.now(),
          duration: 4.5
        }).catch(error => {
          console.error('Failed to save automation result:', error);
        });
      }
    } catch (error) {
      console.error('Error sending automation result:', error);
      this.handleAutomationError(automationId, error);
    } finally {
      this.runningAutomations.delete(automationId);
    }
  }

  private handleAutomationError(automationId: string, error: any): void {
    try {
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send(IPC_CHANNELS.AUTOMATION_RESULT, {
          id: automationId,
          result: {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error occurred'
          },
          timestamp: Date.now()
        });
      }
    } catch (sendError) {
      console.error('Failed to send error notification:', sendError);
    } finally {
      this.runningAutomations.delete(automationId);
    }
  }

  private async retryOperation<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    delay: number = 1000
  ): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.warn(`Operation failed (attempt ${attempt}/${maxRetries}):`, lastError.message);
        
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, delay * attempt));
        }
      }
    }
    
    throw lastError!;
  }

  private getDefaultSetting(key: string): any {
    const defaults: Record<string, any> = {
      'theme': 'dark',
      'aiProvider': 'OpenAI',
      'browserSettings': { 
        headless: true, 
        defaultTimeout: 30000,
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      'maxConcurrentAutomations': 3,
      'retryAttempts': 3,
      'debugMode': false,
      'autoSaveResults': true,
      'notificationsEnabled': true
    };
    
    return defaults[key];
  }

  private validateSettingValue(key: string, value: any): void {
    switch (key) {
      case 'theme':
        if (!['light', 'dark', 'auto'].includes(value)) {
          throw new Error('Theme must be one of: light, dark, auto');
        }
        break;
      case 'aiProvider':
        if (!['OpenAI', 'Claude', 'Local Model'].includes(value)) {
          throw new Error('AI Provider must be one of: OpenAI, Claude, Local Model');
        }
        break;
      case 'maxConcurrentAutomations':
        if (!Number.isInteger(value) || value < 1 || value > 10) {
          throw new Error('Max concurrent automations must be an integer between 1 and 10');
        }
        break;
      case 'retryAttempts':
        if (!Number.isInteger(value) || value < 0 || value > 10) {
          throw new Error('Retry attempts must be an integer between 0 and 10');
        }
        break;
      case 'browserSettings':
        if (!value || typeof value !== 'object') {
          throw new Error('Browser settings must be an object');
        }
        if (value.defaultTimeout && (!Number.isInteger(value.defaultTimeout) || value.defaultTimeout < 1000)) {
          throw new Error('Default timeout must be at least 1000ms');
        }
        break;
      case 'debugMode':
      case 'autoSaveResults':
      case 'notificationsEnabled':
        if (typeof value !== 'boolean') {
          throw new Error(`${key} must be a boolean value`);
        }
        break;
      default:
        // Allow unknown settings but log a warning
        console.warn(`Unknown setting key: ${key}`);
        break;
    }
  }

  private setupIPCHandlers(): void {
    // Database handlers with retry logic
    ipcMain.handle(IPC_CHANNELS.DB_GET_HISTORY, async () => {
      try {
        const history = await this.retryOperation(
          () => this.database.getAutomationHistory(),
          3,
          500
        );
        return { success: true, data: history };
      } catch (error) {
        console.error('Failed to get automation history after retries:', error);
        return { 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error',
          retryable: true
        };
      }
    });

    ipcMain.handle(IPC_CHANNELS.DB_GET_WORKFLOWS, async () => {
      try {
        const workflows = await this.retryOperation(
          () => this.database.getWorkflows(),
          3,
          500
        );
        return { success: true, data: workflows };
      } catch (error) {
        console.error('Failed to get workflows after retries:', error);
        return { 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error',
          retryable: true
        };
      }
    });

    ipcMain.handle(IPC_CHANNELS.DB_SAVE_WORKFLOW, async (_, workflow) => {
      try {
        // Validate workflow data before saving
        if (!workflow || typeof workflow !== 'object') {
          throw new Error('Invalid workflow data provided');
        }
        
        const id = await this.retryOperation(
          () => this.database.saveWorkflow(workflow),
          3,
          1000
        );
        return { success: true, data: id };
      } catch (error) {
        console.error('Failed to save workflow after retries:', error);
        return { 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error',
          retryable: true
        };
      }
    });

    ipcMain.handle(IPC_CHANNELS.DB_SAVE_RESULT, async (_, result) => {
      try {
        // Validate result data before saving
        if (!result || typeof result !== 'object') {
          throw new Error('Invalid result data provided');
        }
        
        const id = await this.retryOperation(
          () => this.database.saveResult(result),
          3,
          1000
        );
        return { success: true, data: id };
      } catch (error) {
        console.error('Failed to save result after retries:', error);
        return { 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error',
          retryable: true
        };
      }
    });

    // Settings handlers with retry logic and validation
    ipcMain.handle(IPC_CHANNELS.SETTINGS_GET, async (_, key: string) => {
      try {
        // Validate input
        if (!key || typeof key !== 'string') {
          throw new Error('Invalid setting key provided');
        }
        
        const value = await this.retryOperation(
          () => this.database.getSetting(key),
          2,
          300
        );
        return { success: true, data: value };
      } catch (error) {
        console.error('Failed to get setting after retries:', error);
        // Return default values for critical settings
        const defaultValue = this.getDefaultSetting(key);
        if (defaultValue !== undefined) {
          console.log(`Using default value for setting '${key}':`, defaultValue);
          return { success: true, data: defaultValue, isDefault: true };
        }
        return { 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error',
          retryable: true
        };
      }
    });

    ipcMain.handle(IPC_CHANNELS.SETTINGS_SET, async (_, key: string, value: any) => {
      try {
        // Validate input
        if (!key || typeof key !== 'string') {
          throw new Error('Invalid setting key provided');
        }
        
        // Validate setting value based on key
        this.validateSettingValue(key, value);
        
        await this.retryOperation(
          () => this.database.setSetting(key, value),
          2,
          500
        );
        return { success: true };
      } catch (error) {
        console.error('Failed to set setting after retries:', error);
        return { 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error',
          retryable: true
        };
      }
    });

    // AI Provider handlers (basic implementation)
    ipcMain.handle(IPC_CHANNELS.AI_GET_PROVIDERS, async () => {
      try {
        // Return mock providers for now
        const providers = ['OpenAI', 'Claude', 'Local Model'];
        return { success: true, data: providers };
      } catch (error) {
        console.error('Failed to get AI providers:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    });

    ipcMain.handle(IPC_CHANNELS.AI_SET_PROVIDER, async (_, provider, config) => {
      try {
        console.log(`Setting AI provider to ${provider}`);
        return { success: true };
      } catch (error) {
        console.error('Failed to set AI provider:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    });

    ipcMain.handle(IPC_CHANNELS.AI_PARSE_COMMAND, async (_, command) => {
      try {
        console.log('Parsing command:', command);
        // Mock implementation
        return { 
          success: true, 
          data: {
            taskType: 'flightSearch',
            parameters: {
              origin: 'New York',
              destination: 'London',
              date: '2023-12-25'
            }
          }
        };
      } catch (error) {
        console.error('Failed to parse command:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    });

    // Automation handlers (enhanced with progress simulation)
    ipcMain.handle(IPC_CHANNELS.AUTOMATION_START, async (_, command: string) => {
      try {
        console.log('Starting automation with command:', command);
        
        // For now, return a mock response
        const mockResult = {
          id: Date.now().toString(),
          command: command,
          success: true,
          message: 'Automation started successfully (mock implementation)'
        };
        
        // Simulate progress updates with error handling
        this.simulateAutomationProgress(command, mockResult.id);
        
        return { success: true, data: mockResult };
      } catch (error) {
        console.error('Failed to start automation:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    });

    ipcMain.handle(IPC_CHANNELS.AUTOMATION_STOP, async () => {
      try {
        console.log('Stopping automation');
        return { success: true };
      } catch (error) {
        console.error('Failed to stop automation:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    });

    // Browser handlers (basic implementation)
    ipcMain.handle(IPC_CHANNELS.BROWSER_STATUS, async () => {
      try {
        return { success: true, data: { status: 'ready' } };
      } catch (error) {
        console.error('Failed to get browser status:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    });

    ipcMain.handle(IPC_CHANNELS.BROWSER_SCREENSHOT, async (_, url: string) => {
      try {
        console.log('Taking screenshot of:', url);
        // Mock implementation - return empty buffer for now
        return { success: true, data: Buffer.alloc(0) };
      } catch (error) {
        console.error('Failed to take screenshot:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    });

    // Export/Report handlers
    ipcMain.handle(IPC_CHANNELS.EXPORT_REPORT, async (_, result: any, format: string) => {
      try {
        console.log(`Exporting report in ${format} format`);
        
        // Mock implementation - simulate file creation
        const mockFilePath = `C:\\Users\\Documents\\automation_report_${Date.now()}.${format}`;
        
        // Simulate different export formats
        switch (format.toLowerCase()) {
          case 'pdf':
            console.log('Generating PDF report...');
            break;
          case 'excel':
            console.log('Generating Excel report...');
            break;
          case 'csv':
            console.log('Generating CSV report...');
            break;
          case 'json':
            console.log('Generating JSON report...');
            break;
          default:
            throw new Error(`Unsupported export format: ${format}`);
        }
        
        return { 
          success: true, 
          filePath: mockFilePath,
          message: `Report exported successfully as ${format.toUpperCase()}`
        };
      } catch (error) {
        console.error('Failed to export report:', error);
        return { 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });

    // Dialog handlers
    ipcMain.handle('dialog:showSaveDialog', async (_, options: any) => {
      try {
        const { dialog } = require('electron');
        const result = await dialog.showSaveDialog(this.mainWindow!, options);
        return result.filePath;
      } catch (error) {
        console.error('Failed to show save dialog:', error);
        return undefined;
      }
    });

    ipcMain.handle('dialog:showOpenDialog', async (_, options: any) => {
      try {
        const { dialog } = require('electron');
        const result = await dialog.showOpenDialog(this.mainWindow!, options);
        return result.filePaths;
      } catch (error) {
        console.error('Failed to show open dialog:', error);
        return undefined;
      }
    });

    ipcMain.handle('dialog:showMessageBox', async (_, options: any) => {
      try {
        const { dialog } = require('electron');
        const result = await dialog.showMessageBox(this.mainWindow!, options);
        return result.response;
      } catch (error) {
        console.error('Failed to show message box:', error);
        return 0;
      }
    });

    // Database health and recovery handlers
    ipcMain.handle('db-health-check', async () => {
      try {
        const healthStatus = await this.database.healthCheck();
        return { success: true, data: healthStatus };
      } catch (error) {
        console.error('Failed to perform health check:', error);
        return { 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error',
          data: { status: 'error', issues: ['Health check failed'] }
        };
      }
    });

    ipcMain.handle('db-repair', async () => {
      try {
        const repairResult = await this.database.repair();
        return { success: true, data: repairResult };
      } catch (error) {
        console.error('Failed to repair database:', error);
        return { 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error',
          data: { success: false, message: 'Repair operation failed' }
        };
      }
    });

    // System status handler
    ipcMain.handle('system-status', async () => {
      try {
        const dbHealth = await this.database.healthCheck();
        const runningAutomationsCount = this.runningAutomations.size;
        
        return { 
          success: true, 
          data: {
            database: dbHealth,
            automations: {
              running: runningAutomationsCount,
              status: runningAutomationsCount > 0 ? 'active' : 'idle'
            },
            memory: {
              used: process.memoryUsage().heapUsed,
              total: process.memoryUsage().heapTotal
            },
            uptime: process.uptime()
          }
        };
      } catch (error) {
        console.error('Failed to get system status:', error);
        return { 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });

    // Error recovery handler
    ipcMain.handle('recover-from-error', async (_, errorType: string) => {
      try {
        console.log(`Attempting to recover from error type: ${errorType}`);
        
        switch (errorType) {
          case 'database':
            const repairResult = await this.database.repair();
            return { success: true, data: repairResult };
            
          case 'automation':
            // Stop all running automations
            this.runningAutomations.clear();
            return { success: true, data: { message: 'All automations stopped' } };
            
          case 'memory':
            // Force garbage collection if available
            if (global.gc) {
              global.gc();
            }
            return { success: true, data: { message: 'Memory cleanup attempted' } };
            
          default:
            return { success: false, error: `Unknown error type: ${errorType}` };
        }
      } catch (error) {
        console.error('Failed to recover from error:', error);
        return { 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });

    // Performance optimization handlers
    ipcMain.handle('performance-optimize', async () => {
      try {
        console.log('Starting performance optimization...');
        
        // Optimize database performance
        const dbOptimization = await this.database.optimizePerformance();
        
        // Clear running automations that might be stuck
        const stuckAutomations = this.runningAutomations.size;
        this.runningAutomations.clear();
        
        // Force garbage collection if available
        let gcPerformed = false;
        if (global.gc) {
          global.gc();
          gcPerformed = true;
        }
        
        return {
          success: true,
          data: {
            database: dbOptimization,
            automations: {
              cleared: stuckAutomations,
              message: stuckAutomations > 0 ? `Cleared ${stuckAutomations} stuck automations` : 'No stuck automations found'
            },
            garbageCollection: {
              performed: gcPerformed,
              message: gcPerformed ? 'Garbage collection performed' : 'Garbage collection not available'
            }
          }
        };
      } catch (error) {
        console.error('Performance optimization failed:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });

    // Resource monitoring handler
    ipcMain.handle('performance-monitor', async () => {
      try {
        const dbMemory = this.database.getMemoryUsage();
        const processMemory = process.memoryUsage();
        const runningAutomations = this.runningAutomations.size;
        
        return {
          success: true,
          data: {
            database: dbMemory,
            process: {
              heapUsed: Math.round(processMemory.heapUsed / 1024 / 1024), // MB
              heapTotal: Math.round(processMemory.heapTotal / 1024 / 1024), // MB
              external: Math.round(processMemory.external / 1024 / 1024), // MB
              rss: Math.round(processMemory.rss / 1024 / 1024) // MB
            },
            automations: {
              running: runningAutomations,
              status: runningAutomations > 0 ? 'active' : 'idle'
            },
            uptime: Math.round(process.uptime()),
            timestamp: Date.now()
          }
        };
      } catch (error) {
        console.error('Performance monitoring failed:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });

    // Resource limits handler
    ipcMain.handle('performance-limits', async (_, limits: any) => {
      try {
        console.log('Setting performance limits:', limits);
        
        // In a real implementation, this would configure resource limits
        // For now, we'll just validate and store the limits
        const validatedLimits = {
          maxMemoryMB: Math.max(100, Math.min(limits.maxMemoryMB || 512, 2048)),
          maxConcurrentAutomations: Math.max(1, Math.min(limits.maxConcurrentAutomations || 3, 10)),
          maxHistoryItems: Math.max(100, Math.min(limits.maxHistoryItems || 1000, 5000)),
          maxWorkflowItems: Math.max(10, Math.min(limits.maxWorkflowItems || 100, 500)),
          cacheTimeoutMs: Math.max(5000, Math.min(limits.cacheTimeoutMs || 30000, 300000))
        };
        
        // Store limits in database settings
        await this.database.setSetting('performanceLimits', validatedLimits);
        
        return {
          success: true,
          data: {
            limits: validatedLimits,
            message: 'Performance limits updated successfully'
          }
        };
      } catch (error) {
        console.error('Failed to set performance limits:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });

    // Automation queue management
    ipcMain.handle('automation-queue-status', async () => {
      try {
        const queueStatus = Array.from(this.runningAutomations.entries()).map(([id, isRunning]) => ({
          id,
          isRunning,
          startTime: Date.now() // In a real implementation, we'd track actual start times
        }));
        
        return {
          success: true,
          data: {
            queue: queueStatus,
            total: queueStatus.length,
            running: queueStatus.filter(item => item.isRunning).length
          }
        };
      } catch (error) {
        console.error('Failed to get automation queue status:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });

    ipcMain.handle('automation-queue-clear', async () => {
      try {
        const clearedCount = this.runningAutomations.size;
        this.runningAutomations.clear();
        
        console.log(`Cleared ${clearedCount} items from automation queue`);
        
        return {
          success: true,
          data: {
            cleared: clearedCount,
            message: `Cleared ${clearedCount} automation(s) from queue`
          }
        };
      } catch (error) {
        console.error('Failed to clear automation queue:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });
  }
}

// Create and start the application
new MinimalApplication();