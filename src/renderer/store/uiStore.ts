import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type ViewMode = 'table' | '2d' | '3d' | 'params';
type Panel = 'explorer' | 'hex' | 'ai';

interface UiState {
  // Panel visibility
  showExplorer: boolean;
  showHexView: boolean;
  showAiPanel: boolean;

  // View mode for current map
  viewMode: ViewMode;

  // Explorer state
  expandedCategories: string[];
  searchQuery: string;

  // Table settings
  showModifiedOnly: boolean;
  highlightModified: boolean;
  showRiskColors: boolean;

  // 3D chart settings
  chartRotation: { x: number; y: number };
  chartZoom: number;

  // Theme
  theme: 'dark' | 'light';

  // AI panel
  aiApiKey: string | null;
  aiEndpoint: string;
}

interface UiActions {
  togglePanel: (panel: Panel) => void;
  setViewMode: (mode: ViewMode) => void;
  toggleCategory: (category: string) => void;
  setSearchQuery: (query: string) => void;
  setShowModifiedOnly: (show: boolean) => void;
  setHighlightModified: (highlight: boolean) => void;
  setShowRiskColors: (show: boolean) => void;
  setChartRotation: (rotation: { x: number; y: number }) => void;
  setChartZoom: (zoom: number) => void;
  setTheme: (theme: 'dark' | 'light') => void;
  setAiConfig: (apiKey: string | null, endpoint?: string) => void;
}

type UiStore = UiState & UiActions;

export const useUiStore = create<UiStore>()(
  persist(
    (set) => ({
      // Initial state
      showExplorer: true,
      showHexView: false,
      showAiPanel: true,
      viewMode: 'table',
      expandedCategories: ['Fuel', 'Ignition', 'Boost'],
      searchQuery: '',
      showModifiedOnly: false,
      highlightModified: true,
      showRiskColors: true,
      chartRotation: { x: 45, y: 45 },
      chartZoom: 1,
      theme: 'dark',
      aiApiKey: null,
      aiEndpoint: 'https://api.openai.com/v1',

      // Actions
      togglePanel: (panel) => {
        set((state) => {
          switch (panel) {
            case 'explorer':
              return { showExplorer: !state.showExplorer };
            case 'hex':
              return { showHexView: !state.showHexView };
            case 'ai':
              return { showAiPanel: !state.showAiPanel };
            default:
              return {};
          }
        });
      },

      setViewMode: (mode) => {
        set({ viewMode: mode });
      },

      toggleCategory: (category) => {
        set((state) => {
          const expanded = state.expandedCategories.includes(category)
            ? state.expandedCategories.filter((c) => c !== category)
            : [...state.expandedCategories, category];
          return { expandedCategories: expanded };
        });
      },

      setSearchQuery: (query) => {
        set({ searchQuery: query });
      },

      setShowModifiedOnly: (show) => {
        set({ showModifiedOnly: show });
      },

      setHighlightModified: (highlight) => {
        set({ highlightModified: highlight });
      },

      setShowRiskColors: (show) => {
        set({ showRiskColors: show });
      },

      setChartRotation: (rotation) => {
        set({ chartRotation: rotation });
      },

      setChartZoom: (zoom) => {
        set({ chartZoom: zoom });
      },

      setTheme: (theme) => {
        set({ theme: theme });
      },

      setAiConfig: (apiKey, endpoint) => {
        set((state) => ({
          aiApiKey: apiKey,
          aiEndpoint: endpoint || state.aiEndpoint,
        }));
      },
    }),
    {
      name: 'ecu-tuning-ui-settings',
      partialize: (state) => ({
        showExplorer: state.showExplorer,
        showAiPanel: state.showAiPanel,
        expandedCategories: state.expandedCategories,
        highlightModified: state.highlightModified,
        showRiskColors: state.showRiskColors,
        theme: state.theme,
        aiEndpoint: state.aiEndpoint,
      }),
    }
  )
);
