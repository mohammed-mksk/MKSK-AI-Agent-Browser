import { create } from 'zustand';
import { 
  AutomationProgress, 
  AutomationResult, 
  SavedWorkflow, 
  AutomationHistory 
} from '@shared/types';

interface AppState {
  // UI State
  sidebarCollapsed: boolean;
  currentPage: string;
  
  // Automation State
  isAutomationRunning: boolean;
  automationProgress: AutomationProgress | null;
  currentResult: AutomationResult | null;
  
  // Data State
  history: AutomationHistory[];
  workflows: SavedWorkflow[];
  
  // AI Provider State
  currentAIProvider: string | null;
  availableProviders: string[];
  
  // Actions
  setSidebarCollapsed: (collapsed: boolean) => void;
  setCurrentPage: (page: string) => void;
  setAutomationRunning: (running: boolean) => void;
  setAutomationProgress: (progress: AutomationProgress | null) => void;
  setCurrentResult: (result: AutomationResult | null) => void;
  setHistory: (history: AutomationHistory[]) => void;
  addToHistory: (item: AutomationHistory) => void;
  setWorkflows: (workflows: SavedWorkflow[]) => void;
  addWorkflow: (workflow: SavedWorkflow) => void;
  updateWorkflow: (id: string, workflow: Partial<SavedWorkflow>) => void;
  deleteWorkflow: (id: string) => void;
  setCurrentAIProvider: (provider: string | null) => void;
  setAvailableProviders: (providers: string[]) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  // Initial State
  sidebarCollapsed: false,
  currentPage: 'dashboard',
  isAutomationRunning: false,
  automationProgress: null,
  currentResult: null,
  history: [],
  workflows: [],
  currentAIProvider: null,
  availableProviders: [],

  // Actions
  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
  
  setCurrentPage: (page) => set({ currentPage: page }),
  
  setAutomationRunning: (running) => set({ isAutomationRunning: running }),
  
  setAutomationProgress: (progress) => set({ automationProgress: progress }),
  
  setCurrentResult: (result) => set({ currentResult: result }),
  
  setHistory: (history) => set({ history }),
  
  addToHistory: (item) => set((state) => ({
    history: [item, ...(state.history || [])].slice(0, 100) // Keep only last 100 items
  })),
  
  setWorkflows: (workflows) => set({ workflows }),
  
  addWorkflow: (workflow) => set((state) => ({
    workflows: [workflow, ...(state.workflows || [])]
  })),
  
  updateWorkflow: (id, updates) => set((state) => ({
    workflows: (state.workflows || []).map(w => 
      w.id === id ? { ...w, ...updates } : w
    )
  })),
  
  deleteWorkflow: (id) => set((state) => ({
    workflows: (state.workflows || []).filter(w => w.id !== id)
  })),
  
  setCurrentAIProvider: (provider) => set({ currentAIProvider: provider }),
  
  setAvailableProviders: (providers) => set({ availableProviders: providers }),
}));