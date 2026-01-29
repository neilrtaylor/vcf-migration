// AI Insights hook

import { useState, useCallback, useRef } from 'react';
import { isAIProxyConfigured } from '@/services/ai/aiProxyClient';
import { fetchAIInsights } from '@/services/ai/aiInsightsApi';
import {
  getCachedInsights,
  setCachedInsights,
  buildInsightsInputHash,
  clearInsightsCache,
} from '@/services/ai/aiInsightsCache';
import type { InsightsInput, MigrationInsights } from '@/services/ai/types';
import { useAISettings } from './useAISettings';

export interface UseAIInsightsReturn {
  insights: MigrationInsights | null;
  isLoading: boolean;
  error: string | null;
  fetchInsights: (data: InsightsInput) => Promise<void>;
  refreshInsights: (data: InsightsInput) => Promise<void>;
  clearInsights: () => void;
  isAvailable: boolean;
}

/**
 * Hook for AI-powered migration insights
 */
export function useAIInsights(): UseAIInsightsReturn {
  const { settings } = useAISettings();
  const [insights, setInsights] = useState<MigrationInsights | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isAvailable = isAIProxyConfigured() && settings.enabled;
  const fetchingRef = useRef(false);
  const skipCacheRef = useRef(false);

  const doFetchInsights = useCallback(async (data: InsightsInput) => {
    if (!isAvailable) return;
    if (fetchingRef.current) return;

    const shouldSkipCache = skipCacheRef.current;
    skipCacheRef.current = false;

    // Check localStorage cache first (unless skip requested)
    const inputHash = buildInsightsInputHash(
      data.totalVMs,
      data.totalVCPUs,
      data.totalMemoryGiB,
      data.migrationTarget || 'both'
    );
    if (!shouldSkipCache) {
      const cached = getCachedInsights(inputHash);
      if (cached) {
        setInsights(cached);
        return;
      }
    }

    fetchingRef.current = true;
    setIsLoading(true);
    setError(null);

    try {
      const result = await fetchAIInsights(data, {
        skipCache: shouldSkipCache,
      });
      setInsights(result);

      // Cache valid results
      if (result) {
        setCachedInsights(result, inputHash);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Insights generation failed';
      setError(message);
    } finally {
      setIsLoading(false);
      fetchingRef.current = false;
    }
  }, [isAvailable]);

  /** Force refresh: clears both client and proxy caches, then fetches */
  const refreshInsights = useCallback(async (data: InsightsInput) => {
    clearInsightsCache();
    setInsights(null);
    setError(null);
    skipCacheRef.current = true;
    fetchingRef.current = false; // Allow re-fetch
    await doFetchInsights(data);
  }, [doFetchInsights]);

  const clearInsightsState = useCallback(() => {
    setInsights(null);
    setError(null);
    clearInsightsCache();
    skipCacheRef.current = true; // Next fetch will skip proxy cache too
  }, []);

  return {
    insights,
    isLoading,
    error,
    fetchInsights: doFetchInsights,
    refreshInsights,
    clearInsights: clearInsightsState,
    isAvailable,
  };
}
