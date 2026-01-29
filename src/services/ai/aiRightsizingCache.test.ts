import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getCachedRightsizing,
  setCachedRightsizing,
  isRightsizingCacheValid,
  getCachedVMRightsizing,
  clearRightsizingCache,
} from './aiRightsizingCache';
import type { ProfileRecommendation } from './types';

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

describe('aiRightsizingCache', () => {
  const mockRecommendations: ProfileRecommendation[] = [
    {
      vmName: 'web-server-01',
      recommendedProfile: 'bx2-4x16',
      reasoning: 'Balanced workload',
      isOverprovisioned: false,
      source: 'ai',
    },
    {
      vmName: 'db-master',
      recommendedProfile: 'mx2-8x64',
      reasoning: 'Database needs memory',
      costSavingsEstimate: '~20% savings possible',
      isOverprovisioned: true,
      source: 'ai',
    },
  ];

  const fingerprint = 'test-fingerprint';

  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
  });

  it('returns null when cache is empty', () => {
    expect(getCachedRightsizing()).toBeNull();
  });

  it('stores and retrieves recommendations', () => {
    setCachedRightsizing(mockRecommendations, fingerprint);

    const cached = getCachedRightsizing();
    expect(cached).not.toBeNull();
    expect(cached!.recommendations['web-server-01'].recommendedProfile).toBe('bx2-4x16');
    expect(cached!.recommendations['db-master'].isOverprovisioned).toBe(true);
  });

  it('validates cache by fingerprint', () => {
    setCachedRightsizing(mockRecommendations, fingerprint);

    expect(isRightsizingCacheValid(fingerprint)).toBe(true);
    expect(isRightsizingCacheValid('other')).toBe(false);
  });

  it('retrieves individual VM recommendation', () => {
    setCachedRightsizing(mockRecommendations, fingerprint);

    const result = getCachedVMRightsizing('db-master');
    expect(result).not.toBeNull();
    expect(result!.recommendedProfile).toBe('mx2-8x64');
  });

  it('clears cache', () => {
    setCachedRightsizing(mockRecommendations, fingerprint);
    clearRightsizingCache();
    expect(getCachedRightsizing()).toBeNull();
  });
});
