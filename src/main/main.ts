/**
 * Enhanced Main Process
 * Created: July 30, 2025
 * 
 * Upgraded main process with field detection support
 */

import { app, BrowserWindow } from 'electron';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { registerFieldDetectionHandlers, unregisterFieldDetectionHandlers } from './ipc/fieldDetectionHandlers.js';
import { registerAutomationHandlers, unregisterAutomationHandlers } from './ipc/automationHandlers.js';
import { registerSettingsHandlers, unregisterSettingsHandlers } from './ipc/settingsHandlers.js';
import { registerAIHandlers, unregisterAIHandlers } from './ipc/aiHandlers.js';
import { registerSecurityHandlers, unregisterSecurityHandlers } from './ipc/securityHandlers.js';
import { Logger } from './services/Logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const logger = new Logger('MainProcess');

class Application {
  private mainWindow: BrowserWindow | null = null;

  constructor() {
    this.initializeApp();
  }

  private initializeApp(): void {
    // Handle app ready event
    app.whenReady().then(() => {
      logger.info('Electron app ready, creating main window');
      this.createWindow();

      app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
          this.createWindow();
        }
      });
    });

    // Handle app close events
    app.on('window-all-closed', () => {
      if (process.platform !== 'darwin') {
        logger.info('All windows closed, quitting app');
        app.quit();
      }
    });

    // Handle before quit
    app.on('before-quit', () => {
      logger.info('App quitting, cleaning up');
      this.cleanup();
    });
  }

  private createWindow(): void {
    // Create the browser window
    this.mainWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        preload: path.join(__dirname, '../../preload/index.js')
      }
    });

    // Load the index.html file from renderer dist
    this.mainWindow.loadFile(path.join(__dirname, '../../../src/renderer/dist/index.html'));

    // Open DevTools for debugging
    if (process.env['NODE_ENV'] === 'development') {
      this.mainWindow.webContents.openDevTools();
    }

    // Register IPC handlers
    this.registerIPCHandlers();

    // Add debugging
    this.mainWindow.webContents.on('did-finish-load', () => {
      logger.info('Main window page loaded successfully');
    });

    this.mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription) => {
      logger.error('Failed to load main window page:', { errorCode, errorDescription });
    });

    this.mainWindow.on('closed', () => {
      logger.info('Main window closed');
      this.mainWindow = null;
      this.unregisterIPCHandlers();
    });
  }

  private registerIPCHandlers(): void {
    if (!this.mainWindow) {
      logger.error('Cannot register IPC handlers: mainWindow is null');
      return;
    }

    logger.info('Registering IPC handlers');
    
    // Register all IPC handlers
    registerFieldDetectionHandlers(this.mainWindow);
    registerAutomationHandlers(this.mainWindow);
    registerSettingsHandlers(this.mainWindow);
    registerAIHandlers(this.mainWindow);
    registerSecurityHandlers(this.mainWindow);
    
    logger.info('All IPC handlers registered successfully');
  }

  private unregisterIPCHandlers(): void {
    logger.info('Unregistering IPC handlers');
    
    // Unregister all IPC handlers
    unregisterFieldDetectionHandlers();
    unregisterAutomationHandlers();
    unregisterSettingsHandlers();
    unregisterAIHandlers();
    unregisterSecurityHandlers();
    
    logger.info('All IPC handlers unregistered');
  }

  private cleanup(): void {
    logger.info('Performing application cleanup');
    this.unregisterIPCHandlers();
  }

  public getMainWindow(): BrowserWindow | null {
    return this.mainWindow;
  }
}

// Create and start the application
const application = new Application();

// Export for testing or external access
export default application;
