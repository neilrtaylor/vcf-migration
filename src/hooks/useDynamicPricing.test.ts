// Unit tests for useDynamicPricing hook
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useDynamicPricing } from './useDynamicPricing';
import type { IBMCloudPricing } from '@/services/pricing/pricingCache';

// Mock pricing cache
vi.mock('@/services/pricing/pricingCache', () => ({
  getCurrentPricing: vi.fn(() => ({
    data: mockStaticPricing,
    lastUpdated: null,
    source: 'static' as const,
  })),
  setCachedPricing: vi.fn(),
  isCacheExpired: vi.fn(() => true),
  clearPricingCache: vi.fn(),
  getStaticPricing: vi.fn(() => mockStaticPricing),
}));

// Mock global catalog API
vi.mock('@/services/pricing/globalCatalogApi', () => ({
  fetchAllCatalogPricing: vi.fn(),
  testApiConnection: vi.fn(),
  isProxyConfigured: vi.fn(() => false),
  fetchFromProxy: vi.fn(),
  testProxyConnection: vi.fn(),
}));

// Mock pricing transformer
vi.mock('@/services/pricing/pricingTransformer', () => ({
  transformCatalogToAppPricing: vi.fn(() => mockStaticPricing),
  transformProxyToAppPricing: vi.fn(() => mockStaticPricing),
}));

// Use a partial mock that satisfies the basic structure
const mockStaticPricing = {
  pricingVersion: '1.0',
  baseCurrency: 'USD',
  notes: 'Test pricing',
  vsi: {
    'bx2-2x8': { profile: 'bx2-2x8', family: 'balanced', vcpus: 2, memoryGiB: 8, networkGbps: 4, hourlyRate: 0.1, monthlyRate: 73, description: 'Test' },
    'bx2-4x16': { profile: 'bx2-4x16', family: 'balanced', vcpus: 4, memoryGiB: 16, networkGbps: 8, hourlyRate: 0.2, monthlyRate: 146, description: 'Test' },
  },
  bareMetal: {},
  blockStorage: {
    generalPurpose: { tierName: 'general-purpose', costPerGBMonth: 0.1, iopsPerGB: 3, description: 'Test' },
  },
  networking: {
    publicGateway: { perGatewayMonthly: 10, description: 'Test' },
    floatingIP: { perIPMonthly: 5, description: 'Test' },
    loadBalancer: { perLBMonthly: 25, perGBProcessed: 0.01, description: 'Test' },
    vpnGateway: { perGatewayMonthly: 50, perConnectionMonthly: 10, description: 'Test' },
    transitGateway: { perGatewayMonthly: 0, localConnectionMonthly: 0, globalConnectionMonthly: 0, perGBLocal: 0, perGBGlobal: 0, description: 'Test' },
  },
  roks: {
    ocpLicense: { perCoreMonthly: 0, description: 'Test' },
    clusterManagement: { perClusterMonthly: 0, description: 'Test' },
  },
  storageAddons: {
    snapshots: { costPerGBMonth: 0.05, description: 'Test' },
    objectStorage: { standardPerGBMonth: 0.02, vaultPerGBMonth: 0.01, description: 'Test' },
  },
  regions: {},
  discounts: {},
  odfWorkloadProfiles: {},
} as IBMCloudPricing;

describe('useDynamicPricing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Suppress console logs during tests
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('initialization', () => {
    it('initializes with static pricing data', async () => {
      const { testApiConnection } = await import('@/services/pricing/globalCatalogApi');
      vi.mocked(testApiConnection).mockResolvedValue({ success: false });

      const { result } = renderHook(() => useDynamicPricing());

      // Initial state before loading completes
      expect(result.current.pricing).toBeDefined();
      expect(result.current.source).toBe('static');

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
    });

    it('starts in loading state', () => {
      const { result } = renderHook(() => useDynamicPricing());
      expect(result.current.isLoading).toBe(true);
    });

    it('sets isApiAvailable after testing connection', async () => {
      const { testApiConnection } = await import('@/services/pricing/globalCatalogApi');
      vi.mocked(testApiConnection).mockResolvedValue({ success: true });

      const { result } = renderHook(() => useDynamicPricing());

      await waitFor(() => {
        expect(result.current.isApiAvailable).toBe(true);
      });
    });

    it('sets isApiAvailable to false when API test fails', async () => {
      const { testApiConnection } = await import('@/services/pricing/globalCatalogApi');
      vi.mocked(testApiConnection).mockResolvedValue({ success: false, error: 'Connection failed' });

      const { result } = renderHook(() => useDynamicPricing());

      await waitFor(() => {
        expect(result.current.isApiAvailable).toBe(false);
      });
    });
  });

  describe('refreshPricing', () => {
    it('sets isRefreshing during refresh', async () => {
      const { testApiConnection, fetchAllCatalogPricing } = await import('@/services/pricing/globalCatalogApi');
      vi.mocked(testApiConnection).mockResolvedValue({ success: false });
      vi.mocked(fetchAllCatalogPricing).mockImplementation(() =>
        new Promise(resolve => setTimeout(() => resolve({
          vsi: [{ id: 'test', name: 'bx2-2x8', kind: 'instance.profile', active: true, disabled: false }],
          bareMetal: [],
          blockStorage: [],
          errors: {},
          hasErrors: false,
        }), 100))
      );

      const { result } = renderHook(() => useDynamicPricing());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      act(() => {
        result.current.refreshPricing();
      });

      expect(result.current.isRefreshing).toBe(true);

      await waitFor(() => {
        expect(result.current.isRefreshing).toBe(false);
      });
    });

    it('updates pricing data on successful refresh', async () => {
      const { testApiConnection, fetchAllCatalogPricing } = await import('@/services/pricing/globalCatalogApi');
      const { setCachedPricing } = await import('@/services/pricing/pricingCache');

      vi.mocked(testApiConnection).mockResolvedValue({ success: false });
      vi.mocked(fetchAllCatalogPricing).mockResolvedValue({
        vsi: [{ id: 'test', name: 'bx2-2x8', kind: 'instance.profile', active: true, disabled: false }],
        bareMetal: [],
        blockStorage: [],
        errors: {},
        hasErrors: false,
      });

      const { result } = renderHook(() => useDynamicPricing());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.refreshPricing();
      });

      expect(result.current.source).toBe('api');
      expect(setCachedPricing).toHaveBeenCalled();
    });

    it('falls back to static data on refresh failure', async () => {
      const { testApiConnection, fetchAllCatalogPricing } = await import('@/services/pricing/globalCatalogApi');

      vi.mocked(testApiConnection).mockResolvedValue({ success: false });
      vi.mocked(fetchAllCatalogPricing).mockRejectedValue(new Error('API error'));

      const { result } = renderHook(() => useDynamicPricing());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.refreshPricing();
      });

      expect(result.current.source).toBe('static');
    });

    it('sets error message on fetch failure', async () => {
      const { testApiConnection, fetchAllCatalogPricing } = await import('@/services/pricing/globalCatalogApi');

      vi.mocked(testApiConnection).mockResolvedValue({ success: false });
      vi.mocked(fetchAllCatalogPricing).mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useDynamicPricing());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.refreshPricing();
      });

      expect(result.current.error).toBe('Network error');
    });
  });

  describe('clearCache', () => {
    it('clears cache and resets to static pricing', async () => {
      const { testApiConnection } = await import('@/services/pricing/globalCatalogApi');
      const { clearPricingCache } = await import('@/services/pricing/pricingCache');

      vi.mocked(testApiConnection).mockResolvedValue({ success: false });

      const { result } = renderHook(() => useDynamicPricing());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      act(() => {
        result.current.clearCache();
      });

      expect(clearPricingCache).toHaveBeenCalled();
      expect(result.current.source).toBe('static');
      expect(result.current.lastUpdated).toBeNull();
      expect(result.current.error).toBeNull();
    });
  });

  describe('proxy support', () => {
    it('uses proxy when configured', async () => {
      const { isProxyConfigured, testProxyConnection, fetchFromProxy } = await import('@/services/pricing/globalCatalogApi');
      const { transformProxyToAppPricing } = await import('@/services/pricing/pricingTransformer');

      vi.mocked(isProxyConfigured).mockReturnValue(true);
      vi.mocked(testProxyConnection).mockResolvedValue({ success: true });
      vi.mocked(fetchFromProxy).mockResolvedValue({
        version: '1.0',
        lastUpdated: new Date().toISOString(),
        source: 'proxy',
        cached: false,
        regions: {},
        discountOptions: {},
        vsiProfiles: { 'bx2-2x8': { vcpus: 2, memoryGiB: 8, hourlyRate: 0.1 } },
        blockStorage: { generalPurpose: { costPerGBMonth: 0.1, iopsPerGB: 3 }, custom: { costPerGBMonth: 0.15, costPerIOPS: 0.01 }, tiers: {} },
        bareMetal: {},
        roks: { clusterManagementFee: 0, workerNodeMarkup: 0 },
        odf: { perTBMonth: 100, minimumTB: 1 },
        networking: { loadBalancer: { perLBMonthly: 25, perGBProcessed: 0 }, floatingIP: { monthlyRate: 5 }, vpnGateway: { monthlyRate: 50 } },
      });
      vi.mocked(transformProxyToAppPricing).mockReturnValue(mockStaticPricing);

      const { result } = renderHook(() => useDynamicPricing());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await waitFor(() => {
        expect(result.current.source).toBe('proxy');
      });
    });
  });

  describe('auto refresh', () => {
    it('does not auto-refresh when autoRefreshOnExpiry is false', async () => {
      const { testApiConnection, fetchAllCatalogPricing } = await import('@/services/pricing/globalCatalogApi');
      const { isCacheExpired } = await import('@/services/pricing/pricingCache');

      vi.mocked(testApiConnection).mockResolvedValue({ success: true });
      vi.mocked(isCacheExpired).mockReturnValue(true);

      const { result } = renderHook(() => useDynamicPricing({ autoRefreshOnExpiry: false }));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // fetchAllCatalogPricing should not be called during init when autoRefreshOnExpiry is false
      expect(fetchAllCatalogPricing).not.toHaveBeenCalled();
    });

    it('auto-refreshes when cache is expired and API is available', async () => {
      const { testApiConnection, fetchAllCatalogPricing, isProxyConfigured } = await import('@/services/pricing/globalCatalogApi');
      const { isCacheExpired } = await import('@/services/pricing/pricingCache');

      vi.mocked(isProxyConfigured).mockReturnValue(false);
      vi.mocked(testApiConnection).mockResolvedValue({ success: true });
      vi.mocked(isCacheExpired).mockReturnValue(true);
      vi.mocked(fetchAllCatalogPricing).mockResolvedValue({
        vsi: [{ id: 'test', name: 'bx2-2x8', kind: 'instance.profile', active: true, disabled: false }],
        bareMetal: [],
        blockStorage: [],
        errors: {},
        hasErrors: false,
      });

      const { result } = renderHook(() => useDynamicPricing({ autoRefreshOnExpiry: true }));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // The hook should have auto-refreshed on mount
      await waitFor(() => {
        expect(result.current.source).toBe('api');
      }, { timeout: 3000 });
    });
  });

  describe('return values', () => {
    it('returns all expected properties', async () => {
      const { testApiConnection } = await import('@/services/pricing/globalCatalogApi');
      vi.mocked(testApiConnection).mockResolvedValue({ success: false });

      const { result } = renderHook(() => useDynamicPricing());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current).toHaveProperty('pricing');
      expect(result.current).toHaveProperty('isLoading');
      expect(result.current).toHaveProperty('isRefreshing');
      expect(result.current).toHaveProperty('error');
      expect(result.current).toHaveProperty('lastUpdated');
      expect(result.current).toHaveProperty('source');
      expect(result.current).toHaveProperty('refreshPricing');
      expect(result.current).toHaveProperty('clearCache');
      expect(result.current).toHaveProperty('isApiAvailable');

      expect(typeof result.current.refreshPricing).toBe('function');
      expect(typeof result.current.clearCache).toBe('function');
    });
  });
});
