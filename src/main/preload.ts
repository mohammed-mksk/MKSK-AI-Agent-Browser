/**
 * Enhanced Preload Script with Field Detection Support
 * Created: July 30, 2025
 * 
 * Exposes secure APIs to renderer process
 */

import { contextBridge, ipcRenderer } from 'electron';

console.log("Enhanced preload script loading");

// Field Detection API
const fieldDetectionAPI = {
  // Detection operations
  detect: () => ipcRenderer.invoke('field-detection:detect'),
  highlight: (fields: any[]) => ipcRenderer.invoke('field-detection:highlight', fields),
  removeHighlights: () => ipcRenderer.invoke('field-detection:remove-highlights'),
  
  // Field filling operations
  fillField: (fieldId: string, value: string) => ipcRenderer.invoke('field-detection:fill-field', fieldId, value),
  smartFill: (fieldData: Record<string, string>) => ipcRenderer.invoke('field-detection:smart-fill', fieldData),
  getSuggestions: (userData: Record<string, string>) => ipcRenderer.invoke('field-detection:get-suggestions', userData),
  
  // Event listeners
  onUpdate: (callback: (data: any) => void) => {
    ipcRenderer.on('field-detection:update', (_event, data) => callback(data));
  },
  onHighlightUpdate: (callback: (data: any) => void) => {
    ipcRenderer.on('field-detection:highlight-update', (_event, data) => callback(data));
  }
};

// Legacy ekoNode API (preserved for backwards compatibility)
const ekoNodeAPI = {
  BrowserAgent: class BrowserAgent {
    constructor() {
      console.log('BrowserAgent initialized (placeholder)');
    }
    setHeadless(headless: boolean) {
      console.log('setHeadless called with:', headless);
    }
  },
  Eko: class Eko {
    private _config: any;
    
    constructor(config: any) {
      console.log('Eko initialized with config:', config);
      this._config = config;
    }
    async run(command: string) {
      console.log('Eko.run called with command:', command);
      return {
        status: 'placeholder',
        message: 'This is a placeholder response. Full Eko functionality requires proper integration.',
        command: command,
        config: this._config
      };
    }
  }
};

// Expose APIs to renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  fieldDetection: fieldDetectionAPI
});

// Maintain backwards compatibility
contextBridge.exposeInMainWorld('ekoNode', ekoNodeAPI);

console.log('Enhanced preload script loaded successfully');
