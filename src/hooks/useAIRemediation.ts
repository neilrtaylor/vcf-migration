// AI Remediation Guidance hook

import { useState, useCallback, useRef } from 'react';
import { isAIProxyConfigured } from '@/services/ai/aiProxyClient';
import { fetchRemediationGuidance } from '@/services/ai/aiRemediationApi';
import type { RemediationInput, RemediationResult } from '@/services/ai/types';
import { useAISettings } from './useAISettings';

export interface UseAIRemediationReturn {
  guidance: RemediationResult | null;
  isLoading: boolean;
  error: string | null;
  fetchGuidance: (data: RemediationInput) => Promise<void>;
  clearGuidance: () => void;
  isAvailable: boolean;
}

/**
 * Hook for AI-powered remediation guidance
 */
export function useAIRemediation(): UseAIRemediationReturn {
  const { settings } = useAISettings();
  const [guidance, setGuidance] = useState<RemediationResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isAvailable = isAIProxyConfigured() && settings.enabled;
  const fetchingRef = useRef(false);

  const doFetchGuidance = useCallback(async (data: RemediationInput) => {
    if (!isAvailable) return;
    if (fetchingRef.current) return;

    fetchingRef.current = true;
    setIsLoading(true);
    setError(null);

    try {
      const result = await fetchRemediationGuidance(data);
      setGuidance(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Remediation guidance failed';
      setError(message);
    } finally {
      setIsLoading(false);
      fetchingRef.current = false;
    }
  }, [isAvailable]);

  const clearGuidance = useCallback(() => {
    setGuidance(null);
    setError(null);
  }, []);

  return {
    guidance,
    isLoading,
    error,
    fetchGuidance: doFetchGuidance,
    clearGuidance,
    isAvailable,
  };
}
