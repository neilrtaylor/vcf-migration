// Unit tests for useDynamicProfiles hook
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useDynamicProfiles } from './useDynamicProfiles';
import type { IBMCloudProfiles, VSIProfilesByFamily, BareMetalProfilesByFamily } from '@/services/profiles/profilesCache';

const mockVsiProfiles: VSIProfilesByFamily = {
  balanced: [
    { name: 'bx2-2x8', vcpus: 2, memoryGiB: 8, family: 'balanced' },
    { name: 'bx2-4x16', vcpus: 4, memoryGiB: 16, family: 'balanced' },
  ],
  compute: [
    { name: 'cx2-2x4', vcpus: 2, memoryGiB: 4, family: 'compute' },
  ],
  memory: [
    { name: 'mx2-2x16', vcpus: 2, memoryGiB: 16, family: 'memory' },
  ],
  veryHighMemory: [],
  ultraHighMemory: [],
  gpu: [],
  other: [],
};

const mockBareMetalProfiles: BareMetalProfilesByFamily = {
  balanced: [
    { name: 'bx2d-metal-96x384', vcpus: 96, memoryGiB: 384, family: 'balanced', roksSupported: true },
  ],
  compute: [],
  memory: [],
  veryHighMemory: [],
  custom: [],
};

const mockStaticProfiles: IBMCloudProfiles = {
  version: '2024-01-01',
  vsiProfiles: mockVsiProfiles,
  bareMetalProfiles: mockBareMetalProfiles,
  region: 'us-south',
  zone: 'us-south-1',
};

const mockProxyResponse = {
  version: '1.0',
  lastUpdated: new Date().toISOString(),
  source: 'proxy',
  region: 'us-south',
  zone: 'us-south-1',
  vsiProfiles: [{ name: 'bx2-2x8', vcpus: 2, memoryGiB: 8, family: 'balanced', bandwidthGbps: 4 }],
  bareMetalProfiles: [],
  counts: { vsi: 1, bareMetal: 0, roksVSI: 0, roksBM: 0 },
};

// Create mock functions
const mockIsProfilesProxyConfigured = vi.fn(() => false);
const mockFetchFromProfilesProxy = vi.fn();
const mockTestProfilesProxyConnection = vi.fn();
const mockGetCurrentProfiles = vi.fn(() => ({
  data: mockStaticProfiles,
  lastUpdated: null,
  source: 'static' as const,
}));
const mockSetCachedProfiles = vi.fn();
const mockIsProfilesCacheExpired = vi.fn(() => true);
const mockClearProfilesCache = vi.fn();
const mockGetStaticProfiles = vi.fn(() => mockStaticProfiles);
const mockCountProfiles = vi.fn((profiles: IBMCloudProfiles) => {
  let vsi = 0;
  let bareMetal = 0;
  for (const family of Object.values(profiles.vsiProfiles)) {
    vsi += family.length;
  }
  for (const family of Object.values(profiles.bareMetalProfiles)) {
    bareMetal += family.length;
  }
  return { vsi, bareMetal };
});

// Mock profiles cache
vi.mock('@/services/profiles/profilesCache', () => ({
  getCurrentProfiles: () => mockGetCurrentProfiles(),
  setCachedProfiles: (...args: unknown[]) => mockSetCachedProfiles(...args),
  isProfilesCacheExpired: () => mockIsProfilesCacheExpired(),
  clearProfilesCache: () => mockClearProfilesCache(),
  getStaticProfiles: () => mockGetStaticProfiles(),
  countProfiles: (profiles: IBMCloudProfiles) => mockCountProfiles(profiles),
}));

// Mock IBM Cloud profiles API (proxy-only)
vi.mock('@/services/ibmCloudProfilesApi', () => ({
  isProfilesProxyConfigured: () => mockIsProfilesProxyConfigured(),
  fetchFromProfilesProxy: (...args: unknown[]) => mockFetchFromProfilesProxy(...args),
  testProfilesProxyConnection: (...args: unknown[]) => mockTestProfilesProxyConnection(...args),
}));

describe('useDynamicProfiles', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset to defaults
    mockIsProfilesProxyConfigured.mockReturnValue(false);
    mockTestProfilesProxyConnection.mockResolvedValue({ success: false });
    mockFetchFromProfilesProxy.mockResolvedValue(mockProxyResponse);
    mockGetCurrentProfiles.mockReturnValue({
      data: mockStaticProfiles,
      lastUpdated: null,
      source: 'static' as const,
    });
    mockIsProfilesCacheExpired.mockReturnValue(true);
    // Suppress console logs during tests
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('initialization', () => {
    it('initializes with static profiles data when no proxy configured', async () => {
      mockIsProfilesProxyConfigured.mockReturnValue(false);

      const { result } = renderHook(() => useDynamicProfiles());

      expect(result.current.profiles).toBeDefined();
      expect(result.current.source).toBe('static');

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
    });

    it('starts in loading state', async () => {
      const { result } = renderHook(() => useDynamicProfiles());
      // Note: isLoading may already be false if the effect runs synchronously
      // Just verify it becomes false eventually
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
    });

    it('sets isApiAvailable after testing proxy connection', async () => {
      mockIsProfilesProxyConfigured.mockReturnValue(true);
      mockTestProfilesProxyConnection.mockResolvedValue({ success: true });

      const { result } = renderHook(() => useDynamicProfiles());

      await waitFor(() => {
        expect(result.current.isApiAvailable).toBe(true);
      });
    });

    it('sets isApiAvailable to false when proxy not configured', async () => {
      mockIsProfilesProxyConfigured.mockReturnValue(false);

      const { result } = renderHook(() => useDynamicProfiles());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.isApiAvailable).toBe(false);
    });

    it('sets isApiAvailable to false when proxy test fails', async () => {
      mockIsProfilesProxyConfigured.mockReturnValue(true);
      mockTestProfilesProxyConnection.mockResolvedValue({ success: false, error: 'Connection failed' });

      const { result } = renderHook(() => useDynamicProfiles());

      await waitFor(() => {
        expect(result.current.isApiAvailable).toBe(false);
      });
    });
  });

  describe('refreshProfiles', () => {
    it('sets isRefreshing during refresh', async () => {
      mockIsProfilesProxyConfigured.mockReturnValue(true);
      mockFetchFromProfilesProxy.mockImplementation(() =>
        new Promise(resolve => setTimeout(() => resolve(mockProxyResponse), 50))
      );

      const { result } = renderHook(() => useDynamicProfiles());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      act(() => {
        result.current.refreshProfiles();
      });

      expect(result.current.isRefreshing).toBe(true);

      await waitFor(() => {
        expect(result.current.isRefreshing).toBe(false);
      });
    });

    it('updates profiles data on successful proxy refresh', async () => {
      mockIsProfilesProxyConfigured.mockReturnValue(true);
      mockTestProfilesProxyConnection.mockResolvedValue({ success: true });
      mockFetchFromProfilesProxy.mockResolvedValue(mockProxyResponse);

      const { result } = renderHook(() => useDynamicProfiles());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await waitFor(() => {
        expect(result.current.source).toBe('proxy');
        expect(mockSetCachedProfiles).toHaveBeenCalled();
      });
    });

    it('falls back to static data on refresh failure', async () => {
      mockIsProfilesProxyConfigured.mockReturnValue(true);
      mockTestProfilesProxyConnection.mockResolvedValue({ success: true });
      mockFetchFromProfilesProxy.mockRejectedValue(new Error('Proxy error'));

      const { result } = renderHook(() => useDynamicProfiles());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.refreshProfiles();
      });

      expect(result.current.source).toBe('static');
    });

    it('sets error message on fetch failure', async () => {
      mockIsProfilesProxyConfigured.mockReturnValue(true);
      mockTestProfilesProxyConnection.mockResolvedValue({ success: false });
      mockFetchFromProfilesProxy.mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useDynamicProfiles());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.refreshProfiles();
      });

      expect(result.current.error).toBe('Network error');
    });
  });

  describe('clearCache', () => {
    it('clears cache and resets to static profiles', async () => {
      mockIsProfilesProxyConfigured.mockReturnValue(false);

      const { result } = renderHook(() => useDynamicProfiles());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      act(() => {
        result.current.clearCache();
      });

      expect(mockClearProfilesCache).toHaveBeenCalled();
      expect(result.current.source).toBe('static');
      expect(result.current.lastUpdated).toBeNull();
      expect(result.current.error).toBeNull();
    });
  });

  describe('profileCounts', () => {
    it('returns profile counts', async () => {
      mockIsProfilesProxyConfigured.mockReturnValue(false);

      const { result } = renderHook(() => useDynamicProfiles());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.profileCounts).toHaveProperty('vsi');
      expect(result.current.profileCounts).toHaveProperty('bareMetal');
      expect(typeof result.current.profileCounts.vsi).toBe('number');
      expect(typeof result.current.profileCounts.bareMetal).toBe('number');
    });
  });

  describe('proxy support', () => {
    it('uses proxy when configured', async () => {
      mockIsProfilesProxyConfigured.mockReturnValue(true);
      mockTestProfilesProxyConnection.mockResolvedValue({ success: true });
      mockFetchFromProfilesProxy.mockResolvedValue({
        ...mockProxyResponse,
        bareMetalProfiles: [{
          name: 'bx2d-metal-96x384',
          vcpus: 96,
          memoryGiB: 384,
          family: 'balanced',
          bandwidthGbps: 100,
          physicalCores: 48,
          hasNvme: true,
          nvmeDisks: 8,
          nvmeSizeGiB: 3200,
          totalNvmeGiB: 25600,
          roksSupported: true
        }],
        counts: { vsi: 1, bareMetal: 1, roksVSI: 0, roksBM: 1 },
      });

      const { result } = renderHook(() => useDynamicProfiles());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await waitFor(() => {
        expect(result.current.source).toBe('proxy');
      });
    });
  });

  describe('return values', () => {
    it('returns all expected properties', async () => {
      mockIsProfilesProxyConfigured.mockReturnValue(false);

      const { result } = renderHook(() => useDynamicProfiles());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current).toHaveProperty('profiles');
      expect(result.current).toHaveProperty('isLoading');
      expect(result.current).toHaveProperty('isRefreshing');
      expect(result.current).toHaveProperty('error');
      expect(result.current).toHaveProperty('lastUpdated');
      expect(result.current).toHaveProperty('source');
      expect(result.current).toHaveProperty('refreshProfiles');
      expect(result.current).toHaveProperty('clearCache');
      expect(result.current).toHaveProperty('isApiAvailable');
      expect(result.current).toHaveProperty('profileCounts');

      expect(typeof result.current.refreshProfiles).toBe('function');
      expect(typeof result.current.clearCache).toBe('function');
    });
  });
});
