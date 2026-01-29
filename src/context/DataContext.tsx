// Data context for global state management
/* eslint-disable react-refresh/only-export-components */
import { createContext, useReducer, useCallback, type ReactNode } from 'react';
import { dataReducer, initialState, type DataState, type DataAction, type ChartFilter } from './dataReducer';
import type { RVToolsData, AnalysisResults } from '@/types';

// Context value interface
interface DataContextValue extends DataState {
  setRawData: (data: RVToolsData) => void;
  setAnalysis: (analysis: AnalysisResults) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setChartFilter: (filter: ChartFilter | null) => void;
  clearChartFilter: () => void;
  clearData: () => void;
  dispatch: React.Dispatch<DataAction>;
}

// Create context
export const DataContext = createContext<DataContextValue | null>(null);

// Provider props
interface DataProviderProps {
  children: ReactNode;
}

// Provider component
export function DataProvider({ children }: DataProviderProps) {
  const [state, dispatch] = useReducer(dataReducer, initialState);

  // Action dispatchers
  const setRawData = useCallback((data: RVToolsData) => {
    dispatch({ type: 'SET_RAW_DATA', payload: data });
  }, []);

  const setAnalysis = useCallback((analysis: AnalysisResults) => {
    dispatch({ type: 'SET_ANALYSIS', payload: analysis });
  }, []);

  const setLoading = useCallback((loading: boolean) => {
    dispatch({ type: 'SET_LOADING', payload: loading });
  }, []);

  const setError = useCallback((error: string | null) => {
    dispatch({ type: 'SET_ERROR', payload: error });
  }, []);

  const setChartFilter = useCallback((filter: ChartFilter | null) => {
    dispatch({ type: 'SET_CHART_FILTER', payload: filter });
  }, []);

  const clearChartFilter = useCallback(() => {
    dispatch({ type: 'SET_CHART_FILTER', payload: null });
  }, []);

  const clearData = useCallback(() => {
    dispatch({ type: 'CLEAR_DATA' });
  }, []);

  const value: DataContextValue = {
    ...state,
    setRawData,
    setAnalysis,
    setLoading,
    setError,
    setChartFilter,
    clearChartFilter,
    clearData,
    dispatch,
  };

  return (
    <DataContext.Provider value={value}>
      {children}
    </DataContext.Provider>
  );
}
