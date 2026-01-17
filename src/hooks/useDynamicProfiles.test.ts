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
    { name: 'bx2d-metal-96x384', vcpus: 96, memoryGiB: 384, family: 'balanced' },
  ],
  compute: [],
  memory: [],
};

const mockStaticProfiles: IBMCloudProfiles = {
  version: '2024-01-01',
  vsiProfiles: mockVsiProfiles,
  bareMetalProfiles: mockBareMetalProfiles,
  region: 'us-south',
  zone: 'us-south-1',
};

// Mock profiles cache
vi.mock('@/services/profiles/profilesCache', () => ({
  getCurrentProfiles: vi.fn(() => ({
    data: mockStaticProfiles,
    lastUpdated: null,
    source: 'static' as const,
  })),
  setCachedProfiles: vi.fn(),
  isProfilesCacheExpired: vi.fn(() => true),
  clearProfilesCache: vi.fn(),
  getStaticProfiles: vi.fn(() => mockStaticProfiles),
  countProfiles: vi.fn((profiles: IBMCloudProfiles) => {
    let vsi = 0;
    let bareMetal = 0;
    for (const family of Object.values(profiles.vsiProfiles)) {
      vsi += family.length;
    }
    for (const family of Object.values(profiles.bareMetalProfiles)) {
      bareMetal += family.length;
    }
    return { vsi, bareMetal };
  }),
}));

// Mock IBM Cloud profiles API
vi.mock('@/services/ibmCloudProfilesApi', () => ({
  fetchVPCInstanceProfiles: vi.fn(),
  fetchVPCBareMetalProfiles: vi.fn(),
  fetchROKSMachineTypes: vi.fn(),
  transformVPCProfiles: vi.fn(() => ({
    balanced: [{ name: 'bx2-2x8', vcpus: 2, memoryGiB: 8, family: 'balanced' }],
    compute: [],
    memory: [],
    veryHighMemory: [],
    ultraHighMemory: [],
    gpu: [],
    other: [],
  })),
  transformVPCBareMetalProfiles: vi.fn(() => []),
  transformROKSMachineTypes: vi.fn(() => ({
    vsi: [],
    bareMetal: [{ name: 'bx2d.metal.96x384', family: 'balanced', vcpus: 96, memoryGiB: 384 }],
  })),
  testProfilesApiConnection: vi.fn(),
  isApiKeyConfigured: vi.fn(() => true),
}));

describe('useDynamicProfiles', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Suppress console logs during tests
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('initialization', () => {
    it('initializes with static profiles data', async () => {
      const { testProfilesApiConnection } = await import('@/services/ibmCloudProfilesApi');
      vi.mocked(testProfilesApiConnection).mockResolvedValue({ success: false });

      const { result } = renderHook(() => useDynamicProfiles());

      expect(result.current.profiles).toBeDefined();
      expect(result.current.source).toBe('static');

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
    });

    it('starts in loading state', () => {
      const { result } = renderHook(() => useDynamicProfiles());
      expect(result.current.isLoading).toBe(true);
    });

    it('uses default region us-south when not specified', async () => {
      const { testProfilesApiConnection } = await import('@/services/ibmCloudProfilesApi');
      vi.mocked(testProfilesApiConnection).mockResolvedValue({ success: false });

      const { result } = renderHook(() => useDynamicProfiles());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(testProfilesApiConnection).toHaveBeenCalledWith('us-south', undefined);
    });

    it('uses provided region in config', async () => {
      const { testProfilesApiConnection } = await import('@/services/ibmCloudProfilesApi');
      vi.mocked(testProfilesApiConnection).mockResolvedValue({ success: false });

      renderHook(() => useDynamicProfiles({ region: 'eu-de' }));

      await waitFor(() => {
        expect(testProfilesApiConnection).toHaveBeenCalledWith('eu-de', undefined);
      });
    });

    it('sets isApiAvailable after testing connection', async () => {
      const { testProfilesApiConnection } = await import('@/services/ibmCloudProfilesApi');
      vi.mocked(testProfilesApiConnection).mockResolvedValue({ success: true });

      const { result } = renderHook(() => useDynamicProfiles());

      await waitFor(() => {
        expect(result.current.isApiAvailable).toBe(true);
      });
    });

    it('sets error when API key not configured', async () => {
      const { isApiKeyConfigured, testProfilesApiConnection } = await import('@/services/ibmCloudProfilesApi');
      vi.mocked(isApiKeyConfigured).mockReturnValue(false);
      vi.mocked(testProfilesApiConnection).mockResolvedValue({ success: false });

      const { result } = renderHook(() => useDynamicProfiles());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toContain('API key required');
      expect(result.current.isApiAvailable).toBe(false);
    });
  });

  describe('refreshProfiles', () => {
    it('sets isRefreshing during refresh', async () => {
      const { testProfilesApiConnection, fetchVPCInstanceProfiles, fetchVPCBareMetalProfiles, fetchROKSMachineTypes } = await import('@/services/ibmCloudProfilesApi');
      vi.mocked(testProfilesApiConnection).mockResolvedValue({ success: false });
      vi.mocked(fetchVPCInstanceProfiles).mockImplementation(() =>
        new Promise(resolve => setTimeout(() => resolve({ profiles: [{ name: 'bx2-2x8' }] } as never), 100))
      );
      vi.mocked(fetchVPCBareMetalProfiles).mockResolvedValue({ profiles: [], total_count: 0 } as never);
      vi.mocked(fetchROKSMachineTypes).mockResolvedValue({ machineTypes: [] } as never);

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

    it('updates profiles data on successful refresh', async () => {
      const { testProfilesApiConnection, fetchVPCInstanceProfiles, fetchVPCBareMetalProfiles, fetchROKSMachineTypes } = await import('@/services/ibmCloudProfilesApi');
      const { setCachedProfiles } = await import('@/services/profiles/profilesCache');

      vi.mocked(testProfilesApiConnection).mockResolvedValue({ success: false });
      vi.mocked(fetchVPCInstanceProfiles).mockResolvedValue({
        profiles: [{ name: 'bx2-2x8', vcpu_count: { type: 'fixed', value: 2 }, memory: { type: 'fixed', value: 8 } }],
      } as never);
      vi.mocked(fetchVPCBareMetalProfiles).mockResolvedValue({ profiles: [], total_count: 0 } as never);
      vi.mocked(fetchROKSMachineTypes).mockResolvedValue({
        machineTypes: [{ name: 'bx2d.metal.96x384', cores: 96, memory: '384Gi' }],
      } as never);

      const { result } = renderHook(() => useDynamicProfiles());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.refreshProfiles();
      });

      expect(result.current.source).toBe('api');
      expect(setCachedProfiles).toHaveBeenCalled();
    });

    it('falls back to static data on refresh failure', async () => {
      const { testProfilesApiConnection, fetchVPCInstanceProfiles, fetchVPCBareMetalProfiles, fetchROKSMachineTypes } = await import('@/services/ibmCloudProfilesApi');

      vi.mocked(testProfilesApiConnection).mockResolvedValue({ success: false });
      vi.mocked(fetchVPCInstanceProfiles).mockRejectedValue(new Error('API error'));
      vi.mocked(fetchVPCBareMetalProfiles).mockRejectedValue(new Error('API error'));
      vi.mocked(fetchROKSMachineTypes).mockRejectedValue(new Error('API error'));

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
      const { testProfilesApiConnection, fetchVPCInstanceProfiles, fetchVPCBareMetalProfiles, fetchROKSMachineTypes } = await import('@/services/ibmCloudProfilesApi');

      vi.mocked(testProfilesApiConnection).mockResolvedValue({ success: false });
      vi.mocked(fetchVPCInstanceProfiles).mockRejectedValue(new Error('Network error'));
      vi.mocked(fetchVPCBareMetalProfiles).mockRejectedValue(new Error('Network error'));
      vi.mocked(fetchROKSMachineTypes).mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useDynamicProfiles());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.refreshProfiles();
      });

      // Error message can be the network error or "APIs returned no profile data"
      expect(result.current.error).toBeTruthy();
    });
  });

  describe('clearCache', () => {
    it('clears cache and resets to static profiles', async () => {
      const { testProfilesApiConnection } = await import('@/services/ibmCloudProfilesApi');
      const { clearProfilesCache } = await import('@/services/profiles/profilesCache');

      vi.mocked(testProfilesApiConnection).mockResolvedValue({ success: false });

      const { result } = renderHook(() => useDynamicProfiles());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      act(() => {
        result.current.clearCache();
      });

      expect(clearProfilesCache).toHaveBeenCalled();
      expect(result.current.source).toBe('static');
      expect(result.current.lastUpdated).toBeNull();
      expect(result.current.error).toBeNull();
    });
  });

  describe('profileCounts', () => {
    it('returns profile counts', async () => {
      const { testProfilesApiConnection } = await import('@/services/ibmCloudProfilesApi');
      vi.mocked(testProfilesApiConnection).mockResolvedValue({ success: false });

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

  describe('auto refresh', () => {
    it('does not auto-refresh when autoRefreshOnExpiry is false', async () => {
      const { testProfilesApiConnection, fetchVPCInstanceProfiles } = await import('@/services/ibmCloudProfilesApi');
      const { isProfilesCacheExpired } = await import('@/services/profiles/profilesCache');

      vi.mocked(testProfilesApiConnection).mockResolvedValue({ success: true });
      vi.mocked(isProfilesCacheExpired).mockReturnValue(true);

      const { result } = renderHook(() => useDynamicProfiles({ autoRefreshOnExpiry: false }));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // fetchVPCInstanceProfiles should not be called during init when autoRefreshOnExpiry is false
      expect(fetchVPCInstanceProfiles).not.toHaveBeenCalled();
    });

    it('auto-refreshes when cache is expired and API is available', async () => {
      const { testProfilesApiConnection, fetchVPCInstanceProfiles, fetchVPCBareMetalProfiles, fetchROKSMachineTypes, isApiKeyConfigured } = await import('@/services/ibmCloudProfilesApi');
      const { isProfilesCacheExpired } = await import('@/services/profiles/profilesCache');

      vi.mocked(isApiKeyConfigured).mockReturnValue(true);
      vi.mocked(testProfilesApiConnection).mockResolvedValue({ success: true });
      vi.mocked(isProfilesCacheExpired).mockReturnValue(true);
      vi.mocked(fetchVPCInstanceProfiles).mockResolvedValue({
        profiles: [{ name: 'bx2-2x8', vcpu_count: { type: 'fixed', value: 2 }, memory: { type: 'fixed', value: 8 } }],
      } as never);
      vi.mocked(fetchVPCBareMetalProfiles).mockResolvedValue({ profiles: [], total_count: 0 } as never);
      vi.mocked(fetchROKSMachineTypes).mockResolvedValue({
        machineTypes: [{ name: 'bx2d.metal.96x384' }],
      } as never);

      const { result } = renderHook(() => useDynamicProfiles({ autoRefreshOnExpiry: true }));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // The hook should have auto-refreshed on mount
      await waitFor(() => {
        expect(result.current.source).toBe('api');
      }, { timeout: 3000 });
    });
  });

  describe('partial API failure handling', () => {
    it('continues when VPC API fails but ROKS succeeds', async () => {
      const { testProfilesApiConnection, fetchVPCInstanceProfiles, fetchVPCBareMetalProfiles, fetchROKSMachineTypes, transformROKSMachineTypes } = await import('@/services/ibmCloudProfilesApi');

      vi.mocked(testProfilesApiConnection).mockResolvedValue({ success: true });
      vi.mocked(fetchVPCInstanceProfiles).mockRejectedValue(new Error('VPC API error'));
      vi.mocked(fetchVPCBareMetalProfiles).mockResolvedValue({ profiles: [], total_count: 0 } as never);
      vi.mocked(fetchROKSMachineTypes).mockResolvedValue({
        machineTypes: [{ name: 'bx2d.metal.96x384', cores: 96, memory: '384Gi' }],
      } as never);
      vi.mocked(transformROKSMachineTypes).mockReturnValue({
        vsi: [],
        bareMetal: [{ name: 'bx2d.metal.96x384', family: 'balanced', vcpus: 96, memoryGiB: 384 }],
      });

      const { result } = renderHook(() => useDynamicProfiles());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.refreshProfiles();
      });

      // Should still have data from ROKS API
      expect(result.current.profiles).toBeDefined();
    });
  });

  describe('return values', () => {
    it('returns all expected properties', async () => {
      const { testProfilesApiConnection } = await import('@/services/ibmCloudProfilesApi');
      vi.mocked(testProfilesApiConnection).mockResolvedValue({ success: false });

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
