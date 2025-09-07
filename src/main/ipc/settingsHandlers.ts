/**
 * Settings IPC Handlers
 * Created: July 30, 2025
 * 
 * Electron IPC handlers for settings operations
 */

import { ipcMain, BrowserWindow } from 'electron';
import { Logger } from '../services/Logger.js';
import { DatabaseService } from '../services/DatabaseService.js';

const logger = new Logger('SettingsIPC');

// Persisted settings via DatabaseService
const db = new DatabaseService();

const DEFAULT_SETTINGS: Record<string, any> = {
  aiProvider: 'openai',
  aiModel: 'gpt-4',
  temperature: 0.1,
  maxTokens: 4000,
  browserEngine: 'puppeteer',
  browserHeadless: false,
  maxConcurrentBrowsers: 3,
  logLevel: 'info',
  autoSaveWorkflows: true
};

/**
 * Register all settings IPC handlers
 */
export function registerSettingsHandlers(mainWindow: BrowserWindow): void {
  logger.info('Registering settings IPC handlers');
  // Initialize DB lazily
  db.initialize().catch(err => logger.error('Settings DB init failed:', err));

  // Get settings
  ipcMain.handle('settings:get', async (_event, key) => {
    logger.info('IPC: settings:get called', { key });
    
    try {
      if (key) {
        let value = await db.getSetting(key);
        if (value === null || value === undefined) {
          // Persist default if missing
          if (key in DEFAULT_SETTINGS) {
            value = DEFAULT_SETTINGS[key];
            await db.setSetting(key, value);
          }
        }
        return { success: true, data: value };
      }
      // Return known settings, ensuring defaults are persisted where missing
      const keys = Object.keys(DEFAULT_SETTINGS);
      const entries: [string, any][] = [];
      for (const k of keys) {
        let v = await db.getSetting(k);
        if (v === null || v === undefined) {
          v = DEFAULT_SETTINGS[k];
          await db.setSetting(k, v);
        }
        entries.push([k, v]);
      }
      return { success: true, data: Object.fromEntries(entries) };

    } catch (error) {
      logger.error('Error in settings:get handler', { error, key });
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred while getting settings',
        data: null
      };
    }
  });

  // Set settings
  ipcMain.handle('settings:set', async (_event, key, value) => {
    logger.info('IPC: settings:set called', { key, value });
    
    try {
      if (!key) throw new Error('Missing setting key');
      await db.setSetting(key, value);
      return { success: true, data: { key, value }, message: 'Setting updated successfully' };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to save setting' };
    }
  });

  ipcMain.handle('settings:reset-defaults', async () => {
    try {
      for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) {
        await db.setSetting(k, v);
      }
      return { success: true, data: { ...DEFAULT_SETTINGS } };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to reset defaults' };
    }
  });

  logger.info('Settings IPC handlers registered successfully');
}

/**
 * Unregister all settings IPC handlers
 */
export function unregisterSettingsHandlers(): void {
  logger.info('Unregistering settings IPC handlers');
  
  ipcMain.removeAllListeners('settings:get');
  ipcMain.removeAllListeners('settings:set');
  
  logger.info('Settings IPC handlers unregistered');
}
