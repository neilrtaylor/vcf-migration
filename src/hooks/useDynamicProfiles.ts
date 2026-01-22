// Dynamic profiles hook - manages IBM Cloud profiles with API refresh capability

import { useState, useEffect, useCallback } from 'react';
import type { IBMCloudProfiles, ProfilesSource, VSIProfilesByFamily, BareMetalProfilesByFamily } from '@/services/profiles/profilesCache';
import {
  getCurrentProfiles,
  setCachedProfiles,
  isProfilesCacheExpired,
  clearProfilesCache,
  getStaticProfiles,
  countProfiles,
} from '@/services/profiles/profilesCache';
import {
  fetchVPCInstanceProfiles,
  fetchVPCBareMetalProfiles,
  fetchROKSMachineTypes,
  transformVPCProfiles,
  transformVPCBareMetalProfiles,
  transformROKSMachineTypes,
  testProfilesApiConnection,
  isApiKeyConfigured,
  isProfilesProxyConfigured,
  fetchFromProfilesProxy,
  type TransformedProfile,
  type ProxyProfilesResponse,
} from '@/services/ibmCloudProfilesApi';

export interface UseDynamicProfilesConfig {
  apiKey?: string;
  region?: string;
  zone?: string;
  autoRefreshOnExpiry?: boolean;
}

export interface UseDynamicProfilesReturn {
  profiles: IBMCloudProfiles;
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  lastUpdated: Date | null;
  source: ProfilesSource;
  refreshProfiles: () => Promise<void>;
  clearCache: () => void;
  isApiAvailable: boolean | null;
  profileCounts: { vsi: number; bareMetal: number };
}

/**
 * Hook for managing dynamic IBM Cloud profiles with API refresh capability
 */
export function useDynamicProfiles(
  config?: UseDynamicProfilesConfig
): UseDynamicProfilesReturn {
  const region = config?.region || 'us-south';
  const zone = config?.zone || `${region}-1`;

  const [profiles, setProfiles] = useState<IBMCloudProfiles>(() => {
    const current = getCurrentProfiles();
    return current.data;
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(() => {
    const current = getCurrentProfiles();
    return current.lastUpdated;
  });
  const [source, setSource] = useState<ProfilesSource>(() => {
    const current = getCurrentProfiles();
    return current.source;
  });
  const [isApiAvailable, setIsApiAvailable] = useState<boolean | null>(null);

  /**
   * Fetch fresh profiles from proxy or IBM Cloud APIs
   */
  const fetchProfiles = useCallback(async () => {
    console.log('[Dynamic Profiles] Starting profiles fetch...', { region, zone });

    // Check if proxy is configured - prefer proxy over direct API
    if (isProfilesProxyConfigured()) {
      console.log('[Dynamic Profiles] Proxy configured, fetching from proxy...');
      try {
        const proxyData = await fetchFromProfilesProxy({ region, zone });
        console.log('[Dynamic Profiles] Proxy data received:', {
          vsiProfiles: proxyData.counts?.vsi || proxyData.vsiProfiles?.length || 0,
          bareMetalProfiles: proxyData.counts?.bareMetal || proxyData.bareMetalProfiles?.length || 0,
          cached: proxyData.cached,
          source: proxyData.source,
        });

        // Transform proxy response to IBMCloudProfiles format
        const newProfiles = transformProxyResponse(proxyData, region, zone);

        // Cache the data
        setCachedProfiles(newProfiles, 'proxy');

        // Update state
        setProfiles(newProfiles);
        setLastUpdated(new Date());
        setSource('proxy');
        setIsApiAvailable(true);
        setError(null);

        const counts = countProfiles(newProfiles);
        console.log('[Dynamic Profiles] Successfully updated from PROXY:', counts);

        return true;
      } catch (err) {
        console.warn('[Dynamic Profiles] Proxy fetch failed:', err instanceof Error ? err.message : err);
        // Fall through to direct API if proxy fails
      }
    }

    try {
      // Fetch VPC instance profiles, VPC bare metal profiles, and ROKS flavors in parallel
      const [vpcResponse, vpcBareMetalResponse, roksResponse] = await Promise.all([
        fetchVPCInstanceProfiles(region, config?.apiKey).catch(err => {
          console.warn('[Dynamic Profiles] VPC VSI API failed:', err.message);
          return null;
        }),
        fetchVPCBareMetalProfiles(region, config?.apiKey).catch(err => {
          console.warn('[Dynamic Profiles] VPC Bare Metal API failed:', err.message);
          return null;
        }),
        fetchROKSMachineTypes(zone, 'vpc-gen2', config?.apiKey).catch(err => {
          console.warn('[Dynamic Profiles] ROKS API failed:', err.message);
          return null;
        }),
      ]);

      // Check if we got any data
      const hasVpcData = vpcResponse && vpcResponse.profiles.length > 0;
      const hasVpcBareMetalData = vpcBareMetalResponse && vpcBareMetalResponse.profiles.length > 0;
      const hasRoksData = roksResponse && roksResponse.machineTypes?.length > 0;

      console.log('[Dynamic Profiles] API responses:', {
        hasVpcData,
        vpcCount: vpcResponse?.profiles.length || 0,
        hasVpcBareMetalData,
        vpcBareMetalCount: vpcBareMetalResponse?.profiles.length || 0,
        hasRoksData,
        roksCount: roksResponse?.machineTypes?.length || 0,
      });

      if (!hasVpcData && !hasRoksData) {
        console.warn('[Dynamic Profiles] Both APIs returned no data, falling back to static');
        throw new Error('APIs returned no profile data');
      }

      // Transform the responses
      const vsiProfiles: VSIProfilesByFamily = hasVpcData
        ? transformToVSIProfilesByFamily(transformVPCProfiles(vpcResponse.profiles))
        : getStaticProfiles().vsiProfiles;

      // Get ROKS bare metal profiles (only ROKS-supported ones)
      const roksTransformed = hasRoksData
        ? transformROKSMachineTypes(roksResponse.machineTypes)
        : null;

      // Get VPC bare metal profiles with full NVMe details
      const vpcBareMetalTransformed = hasVpcBareMetalData
        ? transformVPCBareMetalProfiles(vpcBareMetalResponse.profiles)
        : [];

      // Merge: Start with all VPC bare metal profiles, mark ROKS-supported ones
      let bareMetalProfiles: BareMetalProfilesByFamily;

      // Build a set of ROKS-supported profile names (normalized to hyphen format)
      const roksProfileNames = new Set<string>();
      if (roksTransformed?.bareMetal.length) {
        for (const roksBm of roksTransformed.bareMetal) {
          // Normalize name format (bx2d.metal.96x384 -> bx2d-metal-96x384)
          const normalizedName = roksBm.name.replace(/\./g, '-');
          roksProfileNames.add(normalizedName);
          roksProfileNames.add(roksBm.name); // Also add original format
        }
      }

      if (vpcBareMetalTransformed.length > 0) {
        // Use all VPC profiles, enriched with ROKS support info
        const allBareMetals = vpcBareMetalTransformed.map(vpcBm => {
          // Check if this profile is ROKS-supported
          const normalizedName = vpcBm.name.replace(/\./g, '-');
          const roksSupported = roksProfileNames.has(normalizedName) || roksProfileNames.has(vpcBm.name);

          // Find ROKS profile for additional details if available
          const roksMatch = roksTransformed?.bareMetal.find(
            roksBm => roksBm.name.replace(/\./g, '-') === normalizedName || roksBm.name === vpcBm.name
          );

          return {
            ...vpcBm,
            roksSupported,
            // Merge any additional details from ROKS if available
            ...(roksMatch && {
              bandwidthGbps: roksMatch.bandwidthGbps || vpcBm.bandwidthGbps,
            }),
          };
        });
        bareMetalProfiles = groupBareMetalByFamily(allBareMetals);
      } else if (roksTransformed?.bareMetal.length) {
        // Fallback: Only ROKS data available, mark all as ROKS-supported
        const allBareMetals = roksTransformed.bareMetal.map(roksBm => ({
          ...roksBm,
          roksSupported: true,
        }));
        bareMetalProfiles = groupBareMetalByFamily(allBareMetals);
      } else {
        // No API data, use static profiles
        bareMetalProfiles = getStaticProfiles().bareMetalProfiles;
      }

      const newProfiles: IBMCloudProfiles = {
        version: new Date().toISOString().split('T')[0],
        vsiProfiles,
        bareMetalProfiles,
        region,
        zone,
      };

      // Cache the data
      setCachedProfiles(newProfiles, 'api');

      // Update state
      setProfiles(newProfiles);
      setLastUpdated(new Date());
      setSource('api');
      setIsApiAvailable(true);
      setError(null);

      const counts = countProfiles(newProfiles);
      console.log('[Dynamic Profiles] Successfully updated to LIVE API profiles:', counts);

      // Log final bare metal profiles being used (for debugging incorrect specs)
      const allBareMetals = [
        ...newProfiles.bareMetalProfiles.balanced,
        ...newProfiles.bareMetalProfiles.compute,
        ...newProfiles.bareMetalProfiles.memory,
        ...newProfiles.bareMetalProfiles.veryHighMemory,
      ];
      console.groupCollapsed('[Dynamic Profiles] FINAL Bare Metal Profiles in App (click to expand)');
      console.table(allBareMetals.map(p => ({
        name: p.name,
        physicalCores: p.physicalCores,
        vcpus: p.vcpus,
        memoryGiB: p.memoryGiB,
        roksSupported: p.roksSupported,
        hasNvme: p.hasNvme,
        nvmeDisks: p.nvmeDisks,
        nvmeSizeGiB: p.nvmeSizeGiB,
        totalNvmeGiB: p.totalNvmeGiB,
      })));
      console.groupEnd();

      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch profiles';

      if (errorMessage.includes('CORS') || errorMessage.includes('NetworkError') || errorMessage.includes('Failed to fetch')) {
        console.warn('[Dynamic Profiles] API not available (possibly CORS). Using static data.');
        setIsApiAvailable(false);
      } else {
        console.warn('[Dynamic Profiles] Fetch error:', errorMessage);
      }

      setError(errorMessage);
      return false;
    }
  }, [config?.apiKey, region, zone]);

  /**
   * Manual refresh profiles data
   */
  const refreshProfiles = useCallback(async () => {
    setIsRefreshing(true);
    setError(null);

    const success = await fetchProfiles();

    if (!success) {
      // Fallback to static data
      const staticData = getStaticProfiles();
      setProfiles(staticData);
      setSource('static');
    }

    setIsRefreshing(false);
  }, [fetchProfiles]);

  /**
   * Clear the profiles cache
   */
  const clearCache = useCallback(() => {
    clearProfilesCache();
    const staticData = getStaticProfiles();
    setProfiles(staticData);
    setSource('static');
    setLastUpdated(null);
    setError(null);
  }, []);

  // Initial load - check cache and optionally refresh
  useEffect(() => {
    const initializeProfiles = async () => {
      console.log('[Dynamic Profiles] Initializing profiles system...');
      setIsLoading(true);

      // Check current cached data
      const current = getCurrentProfiles();
      setProfiles(current.data);
      setLastUpdated(current.lastUpdated);
      setSource(current.source);

      console.log('[Dynamic Profiles] Current profiles state:', {
        source: current.source,
        lastUpdated: current.lastUpdated?.toISOString() || 'never',
        cacheExpired: isProfilesCacheExpired(),
        counts: countProfiles(current.data),
      });

      // Check if proxy or API key is configured
      const hasProxy = isProfilesProxyConfigured();
      const hasApiKey = config?.apiKey || isApiKeyConfigured();

      if (!hasProxy && !hasApiKey) {
        console.log('[Dynamic Profiles] No proxy or API key configured, using static data');
        setIsApiAvailable(false);
        setError('Configure VITE_PROFILES_PROXY_URL or VITE_IBM_CLOUD_API_KEY in .env file.');
        setIsLoading(false);
        return;
      }

      // If proxy is configured, we don't need API key check
      if (hasProxy) {
        console.log('[Dynamic Profiles] Profiles proxy configured');
      }

      // Test API connectivity
      console.log('[Dynamic Profiles] Testing API connectivity...');
      const connectionResult = await testProfilesApiConnection(region, config?.apiKey);
      const apiAvailable = connectionResult.success;
      setIsApiAvailable(apiAvailable);

      console.log('[Dynamic Profiles] API availability:', apiAvailable);

      // If cache is expired and auto-refresh is enabled, fetch fresh data
      if (config?.autoRefreshOnExpiry !== false && isProfilesCacheExpired() && apiAvailable) {
        console.log('[Dynamic Profiles] Cache expired and API available, fetching fresh data...');
        const success = await fetchProfiles();
        if (!success) {
          console.log('[Dynamic Profiles] Fetch failed, keeping current source:', current.source);
          setSource(current.source);
        }
      } else if (!apiAvailable) {
        console.log('[Dynamic Profiles] API not available, using', current.source, 'data');
      } else {
        console.log('[Dynamic Profiles] Using cached data (not expired)');
      }

      setIsLoading(false);
    };

    initializeProfiles();
  }, [config?.apiKey, config?.autoRefreshOnExpiry, region, fetchProfiles]);

  return {
    profiles,
    isLoading,
    isRefreshing,
    error,
    lastUpdated,
    source,
    refreshProfiles,
    clearCache,
    isApiAvailable,
    profileCounts: countProfiles(profiles),
  };
}

/**
 * Transform API profile response to VSIProfilesByFamily format
 */
function transformToVSIProfilesByFamily(apiProfiles: Record<string, TransformedProfile[]>): VSIProfilesByFamily {
  return {
    balanced: apiProfiles.balanced || [],
    compute: apiProfiles.compute || [],
    memory: apiProfiles.memory || [],
    veryHighMemory: apiProfiles.veryHighMemory || [],
    ultraHighMemory: apiProfiles.ultraHighMemory || [],
    gpu: apiProfiles.gpu || [],
    other: apiProfiles.other || [],
  };
}

/**
 * Group bare metal profiles by family
 */
function groupBareMetalByFamily(profiles: Array<{ name: string; family: string; vcpus: number; memoryGiB: number; physicalCores?: number; hasNvme?: boolean; nvmeDisks?: number; nvmeSizeGiB?: number; totalNvmeGiB?: number; roksSupported?: boolean; bandwidthGbps?: number }>): BareMetalProfilesByFamily {
  const grouped: BareMetalProfilesByFamily = {
    balanced: [],
    compute: [],
    memory: [],
    veryHighMemory: [],
  };

  for (const profile of profiles) {
    const family = profile.family as keyof BareMetalProfilesByFamily;
    if (grouped[family]) {
      grouped[family].push(profile);
    } else {
      // Default to balanced if family not recognized
      grouped.balanced.push(profile);
    }
  }

  return grouped;
}

/**
 * Transform proxy response to IBMCloudProfiles format
 */
function transformProxyResponse(
  proxyData: ProxyProfilesResponse,
  region: string,
  zone: string
): IBMCloudProfiles {
  // Group VSI profiles by family
  const vsiByFamily: VSIProfilesByFamily = {
    balanced: [],
    compute: [],
    memory: [],
    veryHighMemory: [],
    ultraHighMemory: [],
    gpu: [],
    other: [],
  };

  for (const profile of proxyData.vsiProfiles || []) {
    const familyKey = mapFamilyToKey(profile.family);
    if (vsiByFamily[familyKey]) {
      vsiByFamily[familyKey].push({
        name: profile.name,
        family: profile.family,
        vcpus: profile.vcpus,
        memoryGiB: profile.memoryGiB,
        bandwidthGbps: profile.bandwidthGbps,
      });
    }
  }

  // Group bare metal profiles by family
  const bareMetalByFamily: BareMetalProfilesByFamily = {
    balanced: [],
    compute: [],
    memory: [],
    veryHighMemory: [],
  };

  for (const profile of proxyData.bareMetalProfiles || []) {
    const familyKey = mapBareMetalFamilyToKey(profile.family);
    if (bareMetalByFamily[familyKey]) {
      bareMetalByFamily[familyKey].push({
        name: profile.name,
        family: profile.family,
        vcpus: profile.vcpus,
        physicalCores: profile.physicalCores,
        memoryGiB: profile.memoryGiB,
        bandwidthGbps: profile.bandwidthGbps,
        hasNvme: profile.hasNvme,
        nvmeDisks: profile.nvmeDisks,
        nvmeSizeGiB: profile.nvmeSizeGiB,
        totalNvmeGiB: profile.totalNvmeGiB,
        roksSupported: profile.roksSupported,
      });
    }
  }

  return {
    version: proxyData.version || new Date().toISOString().split('T')[0],
    vsiProfiles: vsiByFamily,
    bareMetalProfiles: bareMetalByFamily,
    region,
    zone,
  };
}

/**
 * Map VSI family name to key
 */
function mapFamilyToKey(family: string): keyof VSIProfilesByFamily {
  const familyLower = family.toLowerCase();
  if (familyLower.includes('balanced') || familyLower.startsWith('bx')) return 'balanced';
  if (familyLower.includes('compute') || familyLower.startsWith('cx')) return 'compute';
  if (familyLower.includes('memory') || familyLower.startsWith('mx')) return 'memory';
  if (familyLower.includes('very') || familyLower.startsWith('vx')) return 'veryHighMemory';
  if (familyLower.includes('ultra') || familyLower.startsWith('ux')) return 'ultraHighMemory';
  if (familyLower.includes('gpu') || familyLower.startsWith('gx')) return 'gpu';
  return 'other';
}

/**
 * Map bare metal family name to key
 */
function mapBareMetalFamilyToKey(family: string): keyof BareMetalProfilesByFamily {
  const familyLower = family.toLowerCase();
  if (familyLower.includes('balanced') || familyLower.startsWith('bx')) return 'balanced';
  if (familyLower.includes('compute') || familyLower.startsWith('cx')) return 'compute';
  if (familyLower.includes('memory') || familyLower.startsWith('mx')) return 'memory';
  if (familyLower.includes('very') || familyLower.startsWith('vx')) return 'veryHighMemory';
  return 'balanced';
}

export default useDynamicProfiles;
