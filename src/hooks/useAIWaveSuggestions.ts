// AI Wave Suggestions hook

import { useState, useCallback, useRef } from 'react';
import { isAIProxyConfigured } from '@/services/ai/aiProxyClient';
import { fetchWaveSuggestions } from '@/services/ai/aiWaveSuggestionsApi';
import type { WaveSuggestionInput, WaveSuggestionResult } from '@/services/ai/types';
import { useAISettings } from './useAISettings';

export interface UseAIWaveSuggestionsReturn {
  suggestions: WaveSuggestionResult | null;
  isLoading: boolean;
  error: string | null;
  fetchSuggestions: (data: WaveSuggestionInput) => Promise<void>;
  clearSuggestions: () => void;
  isAvailable: boolean;
}

/**
 * Hook for AI-powered wave planning suggestions
 */
export function useAIWaveSuggestions(): UseAIWaveSuggestionsReturn {
  const { settings } = useAISettings();
  const [suggestions, setSuggestions] = useState<WaveSuggestionResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isAvailable = isAIProxyConfigured() && settings.enabled;
  const fetchingRef = useRef(false);

  const doFetchSuggestions = useCallback(async (data: WaveSuggestionInput) => {
    if (!isAvailable) return;
    if (fetchingRef.current) return;

    fetchingRef.current = true;
    setIsLoading(true);
    setError(null);

    try {
      const result = await fetchWaveSuggestions(data);
      setSuggestions(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Wave suggestions failed';
      setError(message);
    } finally {
      setIsLoading(false);
      fetchingRef.current = false;
    }
  }, [isAvailable]);

  const clearSuggestions = useCallback(() => {
    setSuggestions(null);
    setError(null);
  }, []);

  return {
    suggestions,
    isLoading,
    error,
    fetchSuggestions: doFetchSuggestions,
    clearSuggestions,
    isAvailable,
  };
}
