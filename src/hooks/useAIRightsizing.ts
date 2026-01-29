// AI Right-sizing hook

import { useState, useEffect, useCallback, useRef } from 'react';
import { isAIProxyConfigured } from '@/services/ai/aiProxyClient';
import { fetchAIRightsizing } from '@/services/ai/aiRightsizingApi';
import {
  clearRightsizingCache,
  getCachedVMRightsizing,
} from '@/services/ai/aiRightsizingCache';
import type { RightsizingInput, ProfileRecommendation } from '@/services/ai/types';
import { useAISettings } from './useAISettings';

export interface UseAIRightsizingReturn {
  recommendations: Record<string, ProfileRecommendation>;
  isLoading: boolean;
  error: string | null;
  getRecommendation: (vmName: string) => ProfileRecommendation | null;
  refreshRecommendations: () => Promise<void>;
  clearCache: () => void;
  isAvailable: boolean;
}

/**
 * Hook for AI-powered right-sizing recommendations
 */
export function useAIRightsizing(
  vms: RightsizingInput[],
  availableProfiles: Array<{ name: string; vcpus: number; memoryGiB: number; family: string }>,
  environmentFingerprint: string
): UseAIRightsizingReturn {
  const { settings } = useAISettings();
  const [recommendations, setRecommendations] = useState<Record<string, ProfileRecommendation>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isAvailable = isAIProxyConfigured() && settings.enabled;
  const fetchedRef = useRef(false);

  const doFetch = useCallback(async () => {
    if (!isAvailable || vms.length === 0 || availableProfiles.length === 0) return;

    setIsLoading(true);
    setError(null);

    try {
      const results = await fetchAIRightsizing(vms, availableProfiles, environmentFingerprint);
      const map: Record<string, ProfileRecommendation> = {};
      for (const r of results) {
        map[r.vmName] = r;
      }
      setRecommendations(map);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Right-sizing failed';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [isAvailable, vms, availableProfiles, environmentFingerprint]);

  useEffect(() => {
    if (fetchedRef.current) return;
    if (!isAvailable || vms.length === 0) return;

    fetchedRef.current = true;
    doFetch();
  }, [isAvailable, vms.length, doFetch]);

  const refreshRecommendations = useCallback(async () => {
    fetchedRef.current = true;
    await doFetch();
  }, [doFetch]);

  const getRecommendation = useCallback(
    (vmName: string): ProfileRecommendation | null => {
      return recommendations[vmName] || getCachedVMRightsizing(vmName);
    },
    [recommendations]
  );

  const clearCache = useCallback(() => {
    clearRightsizingCache();
    setRecommendations({});
    setError(null);
    fetchedRef.current = false;
  }, []);

  return {
    recommendations,
    isLoading,
    error,
    getRecommendation,
    refreshRecommendations,
    clearCache,
    isAvailable,
  };
}
