// Unified AI status hook - aggregates AI availability state

import { useState, useCallback } from 'react';
import { isAIProxyConfigured, testAIProxyConnection } from '@/services/ai/aiProxyClient';
import { useAISettings } from './useAISettings';

export interface AIProxyHealth {
  success: boolean;
  error?: string;
}

export interface UseAIStatusReturn {
  isConfigured: boolean;
  isEnabled: boolean;
  isConsentGiven: boolean;
  isAvailable: boolean;
  proxyHealth: AIProxyHealth | null;
  isTestingProxy: boolean;
  testProxy: () => Promise<void>;
}

/**
 * Unified hook for checking AI feature availability.
 * Combines proxy configuration, user settings, and connectivity status.
 */
export function useAIStatus(): UseAIStatusReturn {
  const { settings } = useAISettings();
  const [proxyHealth, setProxyHealth] = useState<AIProxyHealth | null>(null);
  const [isTestingProxy, setIsTestingProxy] = useState(false);

  const isConfigured = isAIProxyConfigured();
  const isEnabled = settings.enabled;
  const isConsentGiven = settings.consentGiven;
  const isAvailable = isConfigured && isEnabled;

  const testProxy = useCallback(async () => {
    setIsTestingProxy(true);
    try {
      const result = await testAIProxyConnection();
      if (!result.cancelled) {
        setProxyHealth({ success: result.success, error: result.error });
      }
    } finally {
      setIsTestingProxy(false);
    }
  }, []);

  return {
    isConfigured,
    isEnabled,
    isConsentGiven,
    isAvailable,
    proxyHealth,
    isTestingProxy,
    testProxy,
  };
}
