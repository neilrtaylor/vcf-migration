// Data reducer for state management
import type { RVToolsData, AnalysisResults } from '@/types';

// Chart filter for drill-down functionality
export interface ChartFilter {
  dimension: string;  // e.g., 'powerState', 'cluster', 'guestOS'
  value: string;      // e.g., 'poweredOn', 'Cluster-01'
  source: string;     // which chart triggered it
}

// State interface
export interface DataState {
  rawData: RVToolsData | null;
  analysis: AnalysisResults | null;
  isLoading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  chartFilter: ChartFilter | null;
}

// Action types
export type DataAction =
  | { type: 'SET_RAW_DATA'; payload: RVToolsData }
  | { type: 'SET_ANALYSIS'; payload: AnalysisResults }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_CHART_FILTER'; payload: ChartFilter | null }
  | { type: 'CLEAR_DATA' };

// Initial state
export const initialState: DataState = {
  rawData: null,
  analysis: null,
  isLoading: false,
  error: null,
  lastUpdated: null,
  chartFilter: null,
};

// Reducer function
export function dataReducer(state: DataState, action: DataAction): DataState {
  switch (action.type) {
    case 'SET_RAW_DATA':
      return {
        ...state,
        rawData: action.payload,
        lastUpdated: new Date(),
        error: null,
      };

    case 'SET_ANALYSIS':
      return {
        ...state,
        analysis: action.payload,
        isLoading: false,
      };

    case 'SET_LOADING':
      return {
        ...state,
        isLoading: action.payload,
      };

    case 'SET_ERROR':
      return {
        ...state,
        error: action.payload,
        isLoading: false,
      };

    case 'SET_CHART_FILTER':
      return {
        ...state,
        chartFilter: action.payload,
      };

    case 'CLEAR_DATA':
      return initialState;

    default:
      return state;
  }
}
