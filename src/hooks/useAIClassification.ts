// AI Classification hook
// Follows the pattern of src/hooks/useDynamicPricing.ts

import { useState, useEffect, useCallback, useRef } from 'react';
import { isAIProxyConfigured } from '@/services/ai/aiProxyClient';
import { fetchAIClassifications } from '@/services/ai/aiClassificationApi';
import {
  clearClassificationCache,
  getCachedVMClassification,
} from '@/services/ai/aiClassificationCache';
import type { VMClassificationInput, VMClassificationResult } from '@/services/ai/types';
import { useAISettings } from './useAISettings';

export interface UseAIClassificationReturn {
  classifications: Record<string, VMClassificationResult>;
  isLoading: boolean;
  error: string | null;
  getClassification: (vmName: string) => VMClassificationResult | null;
  refreshClassifications: () => Promise<void>;
  clearCache: () => void;
  isAvailable: boolean;
}

/**
 * Hook for AI-powered workload classification
 *
 * @param vms - VM data to classify (empty array to skip)
 * @param environmentFingerprint - Environment fingerprint for cache scoping
 */
export function useAIClassification(
  vms: VMClassificationInput[],
  environmentFingerprint: string
): UseAIClassificationReturn {
  const { settings } = useAISettings();
  const [classifications, setClassifications] = useState<Record<string, VMClassificationResult>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isAvailable = isAIProxyConfigured() && settings.enabled;
  const fetchedRef = useRef(false);

  const doFetch = useCallback(async () => {
    if (!isAvailable || vms.length === 0) return;

    setIsLoading(true);
    setError(null);

    try {
      const results = await fetchAIClassifications(vms, environmentFingerprint);
      const map: Record<string, VMClassificationResult> = {};
      for (const r of results) {
        map[r.vmName] = r;
      }
      setClassifications(map);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Classification failed';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [isAvailable, vms, environmentFingerprint]);

  // Auto-fetch on mount when AI is available and VMs are provided
  useEffect(() => {
    if (fetchedRef.current) return;
    if (!isAvailable || vms.length === 0) return;

    fetchedRef.current = true;
    doFetch();
  }, [isAvailable, vms.length, doFetch]);

  const refreshClassifications = useCallback(async () => {
    fetchedRef.current = true;
    await doFetch();
  }, [doFetch]);

  const getClassification = useCallback(
    (vmName: string): VMClassificationResult | null => {
      return classifications[vmName] || getCachedVMClassification(vmName);
    },
    [classifications]
  );

  const clearCache = useCallback(() => {
    clearClassificationCache();
    setClassifications({});
    setError(null);
    fetchedRef.current = false;
  }, []);

  return {
    classifications,
    isLoading,
    error,
    getClassification,
    refreshClassifications,
    clearCache,
    isAvailable,
  };
}
