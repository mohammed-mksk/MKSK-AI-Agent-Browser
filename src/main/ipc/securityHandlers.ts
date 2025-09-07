/**
 * Security IPC Handlers
 * Created: July 30, 2025
 * 
 * Electron IPC handlers for secure storage operations
 */

import { ipcMain, BrowserWindow } from 'electron';
import { Logger } from '../services/Logger.js';

const logger = new Logger('SecurityIPC');

// Mock secure storage (in production, this would use electron-store or similar)
const secureStore = new Map<string, string>();

/**
 * Register all security IPC handlers
 */
export function registerSecurityHandlers(mainWindow: BrowserWindow): void {
  logger.info('Registering security IPC handlers');

  // Store API key securely
  ipcMain.handle('secure:store-api-key', async (_event, provider, apiKey) => {
    logger.info('IPC: secure:store-api-key called', { provider });
    
    try {
      // Validate input
      if (!provider || typeof provider !== 'string' || provider.trim().length === 0) {
        logger.warn('Invalid provider provided to secure:store-api-key', { provider });
        return {
          success: false,
          error: 'Invalid or empty provider name',
          data: null
        };
      }

      if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length === 0) {
        logger.warn('Invalid API key provided to secure:store-api-key', { provider });
        return {
          success: false,
          error: 'Invalid or empty API key',
          data: null
        };
      }

      // In production, this would encrypt the API key
      secureStore.set(`api_key_${provider.trim()}`, apiKey.trim());
      
      logger.info('API key stored successfully', { provider: provider.trim() });
      
      return {
        success: true,
        data: {
          provider: provider.trim(),
          stored: true
        },
        message: `API key for ${provider.trim()} stored securely`
      };

    } catch (error) {
      logger.error('Error in secure:store-api-key handler', { error, provider });
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred while storing API key',
        data: null
      };
    }
  });

  // Get API key securely
  ipcMain.handle('secure:get-api-key', async (_event, provider) => {
    logger.info('IPC: secure:get-api-key called', { provider });
    
    const apiKey = secureStore.get(`api_key_${provider}`);
    
    return {
      success: true,
      data: {
        provider,
        hasKey: !!apiKey,
        // Never return the actual key for security
        keyPreview: apiKey ? `${apiKey.substring(0, 8)}...` : null
      }
    };
  });

  // Remove API key
  ipcMain.handle('secure:remove-api-key', async (_event, provider) => {
    logger.info('IPC: secure:remove-api-key called', { provider });
    
    const existed = secureStore.has(`api_key_${provider}`);
    secureStore.delete(`api_key_${provider}`);
    
    return {
      success: true,
      data: {
        provider,
        removed: existed
      },
      message: existed ? `API key for ${provider} removed` : `No API key found for ${provider}`
    };
  });

  logger.info('Security IPC handlers registered successfully');
}

/**
 * Unregister all security IPC handlers
 */
export function unregisterSecurityHandlers(): void {
  logger.info('Unregistering security IPC handlers');
  
  ipcMain.removeAllListeners('secure:store-api-key');
  ipcMain.removeAllListeners('secure:get-api-key');
  ipcMain.removeAllListeners('secure:remove-api-key');
  
  logger.info('Security IPC handlers unregistered');
}