import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useAIClassification } from './useAIClassification';
import type { VMClassificationInput } from '@/services/ai/types';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: vi.fn(() => { store = {}; }),
  };
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Mock dependencies
vi.mock('@/services/ai/aiProxyClient', () => ({
  isAIProxyConfigured: vi.fn(() => false),
}));

vi.mock('@/services/ai/aiClassificationApi', () => ({
  fetchAIClassifications: vi.fn(() => Promise.resolve([])),
}));

vi.mock('@/services/ai/aiClassificationCache', () => ({
  clearClassificationCache: vi.fn(),
  getCachedVMClassification: vi.fn(() => null),
}));

vi.mock('./useAISettings', () => ({
  useAISettings: vi.fn(() => ({
    settings: { enabled: false, consentGiven: false },
    updateSettings: vi.fn(),
    resetSettings: vi.fn(),
  })),
}));

describe('useAIClassification', () => {
  const mockVMs: VMClassificationInput[] = [
    {
      vmName: 'web-server-01',
      guestOS: 'Ubuntu 22.04',
      vCPUs: 4,
      memoryMB: 8192,
      diskCount: 2,
      nicCount: 1,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
  });

  it('returns not available when proxy is not configured', () => {
    const { result } = renderHook(() =>
      useAIClassification(mockVMs, 'test-fingerprint')
    );

    expect(result.current.isAvailable).toBe(false);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.classifications).toEqual({});
  });

  it('returns not available when AI is disabled in settings', () => {
    const { result } = renderHook(() =>
      useAIClassification(mockVMs, 'test-fingerprint')
    );

    expect(result.current.isAvailable).toBe(false);
  });

  it('returns null from getClassification when no data', () => {
    const { result } = renderHook(() =>
      useAIClassification(mockVMs, 'test-fingerprint')
    );

    expect(result.current.getClassification('web-server-01')).toBeNull();
  });

  it('provides clearCache function', () => {
    const { result } = renderHook(() =>
      useAIClassification(mockVMs, 'test-fingerprint')
    );

    expect(typeof result.current.clearCache).toBe('function');
  });
});
