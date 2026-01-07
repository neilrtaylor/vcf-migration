// Data context for global state management
import { createContext, useReducer, useCallback, type ReactNode } from 'react';
import { dataReducer, initialState, type DataState, type DataAction } from './dataReducer';
import type { RVToolsData, AnalysisResults } from '@/types';

// Context value interface
interface DataContextValue extends DataState {
  setRawData: (data: RVToolsData) => void;
  setAnalysis: (analysis: AnalysisResults) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
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

  const clearData = useCallback(() => {
    dispatch({ type: 'CLEAR_DATA' });
  }, []);

  const value: DataContextValue = {
    ...state,
    setRawData,
    setAnalysis,
    setLoading,
    setError,
    clearData,
    dispatch,
  };

  return (
    <DataContext.Provider value={value}>
      {children}
    </DataContext.Provider>
  );
}
