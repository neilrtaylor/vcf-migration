// AI Cost Optimization hook

import { useState, useCallback, useRef } from 'react';
import { isAIProxyConfigured } from '@/services/ai/aiProxyClient';
import { fetchCostOptimization } from '@/services/ai/aiCostOptimizationApi';
import type { CostOptimizationInput, CostOptimizationResult } from '@/services/ai/types';
import { useAISettings } from './useAISettings';

export interface UseAICostOptimizationReturn {
  optimization: CostOptimizationResult | null;
  isLoading: boolean;
  error: string | null;
  fetchOptimization: (data: CostOptimizationInput) => Promise<void>;
  clearOptimization: () => void;
  isAvailable: boolean;
}

/**
 * Hook for AI-powered cost optimization recommendations
 */
export function useAICostOptimization(): UseAICostOptimizationReturn {
  const { settings } = useAISettings();
  const [optimization, setOptimization] = useState<CostOptimizationResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isAvailable = isAIProxyConfigured() && settings.enabled;
  const fetchingRef = useRef(false);

  const doFetchOptimization = useCallback(async (data: CostOptimizationInput) => {
    if (!isAvailable) return;
    if (fetchingRef.current) return;

    fetchingRef.current = true;
    setIsLoading(true);
    setError(null);

    try {
      const result = await fetchCostOptimization(data);
      setOptimization(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Cost optimization failed';
      setError(message);
    } finally {
      setIsLoading(false);
      fetchingRef.current = false;
    }
  }, [isAvailable]);

  const clearOptimization = useCallback(() => {
    setOptimization(null);
    setError(null);
  }, []);

  return {
    optimization,
    isLoading,
    error,
    fetchOptimization: doFetchOptimization,
    clearOptimization,
    isAvailable,
  };
}
