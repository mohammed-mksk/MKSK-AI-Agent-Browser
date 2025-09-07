/**
 * Field Detection IPC Handlers
 * Created: July 30, 2025
 * 
 * Electron IPC handlers for field detection operations
 * Links renderer UI with main process field detection service
 */

import { ipcMain, BrowserWindow } from 'electron';
import { FieldDetectionService } from '../services/FieldDetectionService.js';
import { Logger } from '../services/Logger.js';

const logger = new Logger('FieldDetectionIPC');
const fieldDetectionService = new FieldDetectionService();

/**
 * Register all field detection IPC handlers
 */
export function registerFieldDetectionHandlers(mainWindow: BrowserWindow): void {
  // Set the browser window for the service
  fieldDetectionService.setBrowserWindow(mainWindow);
  
  logger.info('Registering field detection IPC handlers');

  // Detect fields on current page
  ipcMain.handle('field-detection:detect', async () => {
    logger.info('IPC: field-detection:detect called');
    return await fieldDetectionService.detectFields();
  });

  // Highlight specific fields
  ipcMain.handle('field-detection:highlight', async (_event, fields) => {
    logger.info(`IPC: field-detection:highlight called with ${fields?.length || 0} fields`);
    return await fieldDetectionService.highlightFields(fields || []);
  });

  // Remove all highlights
  ipcMain.handle('field-detection:remove-highlights', async () => {
    logger.info('IPC: field-detection:remove-highlights called');
    return await fieldDetectionService.removeHighlights();
  });

  // Fill a specific field
  ipcMain.handle('field-detection:fill-field', async (_event, fieldId, value) => {
    logger.info(`IPC: field-detection:fill-field called for field ${fieldId}`);
    return await fieldDetectionService.fillField(fieldId, value);
  });

  // Smart fill multiple fields
  ipcMain.handle('field-detection:smart-fill', async (_event, fieldData) => {
    logger.info(`IPC: field-detection:smart-fill called with ${Object.keys(fieldData || {}).length} fields`);
    return await fieldDetectionService.smartFieldFill(fieldData || {});
  });

  // Get field suggestions based on user data
  ipcMain.handle('field-detection:get-suggestions', async (_event, userData) => {
    logger.info(`IPC: field-detection:get-suggestions called with ${Object.keys(userData || {}).length} data points`);
    return await fieldDetectionService.getFieldSuggestions(userData || {});
  });

  logger.info('Field detection IPC handlers registered successfully');
}

/**
 * Unregister all field detection IPC handlers
 */
export function unregisterFieldDetectionHandlers(): void {
  logger.info('Unregistering field detection IPC handlers');
  
  ipcMain.removeAllListeners('field-detection:detect');
  ipcMain.removeAllListeners('field-detection:highlight');
  ipcMain.removeAllListeners('field-detection:remove-highlights');
  ipcMain.removeAllListeners('field-detection:fill-field');
  ipcMain.removeAllListeners('field-detection:smart-fill');
  ipcMain.removeAllListeners('field-detection:get-suggestions');
  
  logger.info('Field detection IPC handlers unregistered');
}

/**
 * Send field detection update to renderer
 */
export function sendFieldDetectionUpdate(mainWindow: BrowserWindow, data: any): void {
  mainWindow.webContents.send('field-detection:update', data);
}

/**
 * Send field highlight update to renderer
 */
export function sendFieldHighlightUpdate(mainWindow: BrowserWindow, data: any): void {
  mainWindow.webContents.send('field-detection:highlight-update', data);
}
