import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getCachedClassifications,
  setCachedClassifications,
  isClassificationCacheValid,
  getCachedVMClassification,
  clearClassificationCache,
} from './aiClassificationCache';
import type { VMClassificationResult } from './types';

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

describe('aiClassificationCache', () => {
  const mockClassifications: VMClassificationResult[] = [
    {
      vmName: 'web-server-01',
      workloadType: 'Web',
      confidence: 0.95,
      reasoning: 'Name contains web',
      alternatives: [{ workloadType: 'Infrastructure', confidence: 0.3 }],
      source: 'ai',
    },
    {
      vmName: 'db-master',
      workloadType: 'Databases',
      confidence: 0.9,
      reasoning: 'Name contains db',
      alternatives: [],
      source: 'ai',
    },
  ];

  const fingerprint = 'test-vcenter::id::cluster1';

  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
  });

  it('returns null when cache is empty', () => {
    expect(getCachedClassifications()).toBeNull();
  });

  it('stores and retrieves classifications', () => {
    setCachedClassifications(mockClassifications, fingerprint);

    const cached = getCachedClassifications();
    expect(cached).not.toBeNull();
    expect(cached!.classifications['web-server-01'].workloadType).toBe('Web');
    expect(cached!.classifications['db-master'].workloadType).toBe('Databases');
    expect(cached!.environmentFingerprint).toBe(fingerprint);
  });

  it('validates cache by fingerprint', () => {
    setCachedClassifications(mockClassifications, fingerprint);

    expect(isClassificationCacheValid(fingerprint)).toBe(true);
    expect(isClassificationCacheValid('different-fingerprint')).toBe(false);
  });

  it('retrieves individual VM classification', () => {
    setCachedClassifications(mockClassifications, fingerprint);

    const result = getCachedVMClassification('web-server-01');
    expect(result).not.toBeNull();
    expect(result!.workloadType).toBe('Web');
    expect(result!.confidence).toBe(0.95);
  });

  it('returns null for uncached VM', () => {
    setCachedClassifications(mockClassifications, fingerprint);

    expect(getCachedVMClassification('nonexistent-vm')).toBeNull();
  });

  it('clears cache', () => {
    setCachedClassifications(mockClassifications, fingerprint);
    expect(getCachedClassifications()).not.toBeNull();

    clearClassificationCache();
    expect(getCachedClassifications()).toBeNull();
  });

  it('handles corrupted localStorage data', () => {
    localStorageMock.getItem.mockReturnValue('not-json');
    expect(getCachedClassifications()).toBeNull();
  });

  it('handles invalid cache structure', () => {
    localStorageMock.getItem.mockReturnValue(JSON.stringify({ foo: 'bar' }));
    expect(getCachedClassifications()).toBeNull();
  });
});
