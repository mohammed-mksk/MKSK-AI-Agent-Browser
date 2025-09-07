/**
 * AI Provider IPC Handlers
 * Created: July 30, 2025
 * 
 * Electron IPC handlers for AI provider operations
 */

import { ipcMain, BrowserWindow } from 'electron';
import { Logger } from '../services/Logger.js';

const logger = new Logger('AIIPC');

// Mock AI provider state
let currentProvider = 'openai';
let currentModel = 'gpt-4';

/**
 * Register all AI provider IPC handlers
 */
export function registerAIHandlers(mainWindow: BrowserWindow): void {
  logger.info('Registering AI IPC handlers');

  // Set AI provider
  ipcMain.handle('ai:set-provider', async (_event, provider, model) => {
    logger.info('IPC: ai:set-provider called', { provider, model });
    
    currentProvider = provider;
    if (model) {
      currentModel = model;
    }
    
    return {
      success: true,
      data: {
        provider: currentProvider,
        model: currentModel
      },
      message: `AI provider set to ${provider}`
    };
  });

  // Get AI providers
  ipcMain.handle('ai:get-providers', async () => {
    logger.info('IPC: ai:get-providers called');
    
    return {
      success: true,
      data: {
        current: {
          provider: currentProvider,
          model: currentModel
        },
        available: [
          {
            id: 'openai',
            name: 'OpenAI',
            models: ['gpt-4', 'gpt-4-turbo-preview', 'gpt-3.5-turbo']
          },
          {
            id: 'anthropic',
            name: 'Anthropic Claude',
            models: ['claude-3-opus-20240229', 'claude-3-sonnet-20240229', 'claude-3-haiku-20240307']
          }
        ]
      }
    };
  });

  // Parse command with AI
  ipcMain.handle('ai:parse-command', async (_event, command) => {
    logger.info('IPC: ai:parse-command called', { command });
    
    try {
      // Validate input
      if (!command || typeof command !== 'string' || command.trim().length === 0) {
        logger.warn('Invalid command provided to ai:parse-command', { command });
        return {
          success: false,
          error: 'Invalid or empty command provided',
          data: {
            intent: 'unknown',
            parameters: { query: '', site: '' },
            confidence: 0,
            steps: []
          }
        };
      }

      // Mock AI parsing response with proper structure
      const response = {
        success: true,
        data: {
          intent: 'search',
          parameters: {
            query: command.trim(),
            site: 'google.com'
          },
          confidence: 0.95,
          steps: [
            { 
              action: 'navigate', 
              target: 'https://google.com',
              description: 'Navigate to Google search page'
            },
            { 
              action: 'type', 
              target: 'input[name="q"]', 
              value: command.trim(),
              description: `Type "${command.trim()}" in search box`
            },
            { 
              action: 'click', 
              target: 'input[type="submit"]',
              description: 'Click search button'
            }
          ]
        }
      };

      // Validate response structure before returning
      if (!response.data.intent) {
        response.data.intent = 'general_automation';
      }
      if (!response.data.parameters) {
        response.data.parameters = { query: command.trim(), site: 'google.com' };
      }
      if (typeof response.data.confidence !== 'number') {
        response.data.confidence = 0.5;
      }
      if (!Array.isArray(response.data.steps)) {
        response.data.steps = [];
      }

      logger.info('AI parsing completed successfully', { 
        intent: response.data.intent, 
        confidence: response.data.confidence,
        stepCount: response.data.steps.length 
      });

      return response;

    } catch (error) {
      logger.error('Error in ai:parse-command handler', { error, command });
      
      // Return structured error response
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred during AI parsing',
        data: {
          intent: 'unknown',
          parameters: { query: '', site: '' },
          confidence: 0,
          steps: []
        }
      };
    }
  });

  logger.info('AI IPC handlers registered successfully');
}

/**
 * Unregister all AI IPC handlers
 */
export function unregisterAIHandlers(): void {
  logger.info('Unregistering AI IPC handlers');
  
  ipcMain.removeAllListeners('ai:set-provider');
  ipcMain.removeAllListeners('ai:get-providers');
  ipcMain.removeAllListeners('ai:parse-command');
  
  logger.info('AI IPC handlers unregistered');
}