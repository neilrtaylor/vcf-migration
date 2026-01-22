// Profiles cache service - manages localStorage caching with expiry for IBM Cloud profiles

import staticProfilesData from '@/data/ibmCloudConfig.json';
import type { TransformedProfile } from '@/services/ibmCloudProfilesApi';

// ===== TYPES =====

export interface VSIProfilesByFamily {
  balanced: TransformedProfile[];
  compute: TransformedProfile[];
  memory: TransformedProfile[];
  veryHighMemory: TransformedProfile[];
  ultraHighMemory: TransformedProfile[];
  gpu: TransformedProfile[];
  other: TransformedProfile[];
}

export interface BareMetalProfilesByFamily {
  balanced: TransformedProfile[];
  compute: TransformedProfile[];
  memory: TransformedProfile[];
  veryHighMemory: TransformedProfile[];
}

export interface IBMCloudProfiles {
  version: string;
  vsiProfiles: VSIProfilesByFamily;
  bareMetalProfiles: BareMetalProfilesByFamily;
  region: string;
  zone: string;
}

export type ProfilesSource = 'api' | 'static' | 'cached' | 'proxy';

export interface CachedProfiles {
  data: IBMCloudProfiles;
  lastUpdated: string;  // ISO timestamp
  source: ProfilesSource;
  expiresAt: string;    // ISO timestamp (24 hours from fetch)
}

// ===== CONSTANTS =====

const CACHE_KEY = 'ibm-cloud-profiles-cache';
const CACHE_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

// ===== HELPER FUNCTIONS =====

/**
 * Transform static JSON data to IBMCloudProfiles format
 */
function transformStaticToProfiles(): IBMCloudProfiles {
  const vsiProfiles: VSIProfilesByFamily = {
    balanced: [],
    compute: [],
    memory: [],
    veryHighMemory: [],
    ultraHighMemory: [],
    gpu: [],
    other: [],
  };

  // Transform VSI profiles from static data
  for (const [family, profiles] of Object.entries(staticProfilesData.vsiProfiles)) {
    const familyKey = family as keyof VSIProfilesByFamily;
    if (vsiProfiles[familyKey]) {
      vsiProfiles[familyKey] = (profiles as Array<{
        name: string;
        vcpus: number;
        memoryGiB: number;
        bandwidthGbps: number;
        hourlyRate?: number;
        monthlyRate?: number;
      }>).map(p => ({
        name: p.name,
        family: familyKey,
        vcpus: p.vcpus,
        memoryGiB: p.memoryGiB,
        bandwidthGbps: p.bandwidthGbps,
      }));
    }
  }

  // Transform bare metal profiles from static data
  const bareMetalProfiles: BareMetalProfilesByFamily = {
    balanced: [],
    compute: [],
    memory: [],
    veryHighMemory: [],
  };

  for (const [family, profiles] of Object.entries(staticProfilesData.bareMetalProfiles)) {
    const familyKey = family as keyof BareMetalProfilesByFamily;
    if (bareMetalProfiles[familyKey]) {
      bareMetalProfiles[familyKey] = (profiles as Array<{
        name: string;
        physicalCores: number;
        vcpus: number;
        memoryGiB: number;
        hasNvme: boolean;
        nvmeDisks?: number;
        nvmeSizeGiB?: number;
        totalNvmeGiB?: number;
        roksSupported?: boolean;
      }>).map(p => ({
        name: p.name,
        family: familyKey,
        vcpus: p.vcpus,
        memoryGiB: p.memoryGiB,
        physicalCores: p.physicalCores,
        hasNvme: p.hasNvme,
        nvmeDisks: p.nvmeDisks,
        nvmeSizeGiB: p.nvmeSizeGiB,
        totalNvmeGiB: p.totalNvmeGiB,
        roksSupported: p.roksSupported,
      }));
    }
  }

  return {
    version: staticProfilesData.version,
    vsiProfiles,
    bareMetalProfiles,
    region: 'us-south',
    zone: 'us-south-1',
  };
}

// ===== CACHE FUNCTIONS =====

/**
 * Get cached profiles data from localStorage
 */
export function getCachedProfiles(): CachedProfiles | null {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return null;

    const parsed = JSON.parse(cached) as CachedProfiles;
    return parsed;
  } catch (error) {
    console.warn('Failed to read profiles cache:', error);
    return null;
  }
}

/**
 * Save profiles data to localStorage cache
 */
export function setCachedProfiles(data: IBMCloudProfiles, source: ProfilesSource): void {
  try {
    const now = new Date();
    const cached: CachedProfiles = {
      data,
      lastUpdated: now.toISOString(),
      source,
      expiresAt: new Date(now.getTime() + CACHE_DURATION_MS).toISOString(),
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(cached));
  } catch (error) {
    console.warn('Failed to save profiles cache:', error);
  }
}

/**
 * Check if the cached profiles have expired
 */
export function isProfilesCacheExpired(): boolean {
  const cached = getCachedProfiles();
  if (!cached) return true;

  const expiresAt = new Date(cached.expiresAt);
  return new Date() > expiresAt;
}

/**
 * Get the last updated timestamp
 */
export function getProfilesLastUpdated(): Date | null {
  const cached = getCachedProfiles();
  if (!cached) return null;
  return new Date(cached.lastUpdated);
}

/**
 * Get the profiles source (api, static, or cached)
 */
export function getProfilesSource(): ProfilesSource {
  const cached = getCachedProfiles();
  if (!cached) return 'static';
  return cached.source;
}

/**
 * Clear the profiles cache
 */
export function clearProfilesCache(): void {
  try {
    localStorage.removeItem(CACHE_KEY);
  } catch (error) {
    console.warn('Failed to clear profiles cache:', error);
  }
}

/**
 * Get static profiles data as fallback
 */
export function getStaticProfiles(): IBMCloudProfiles {
  return transformStaticToProfiles();
}

/**
 * Get current profiles data (cached or static fallback)
 */
export function getCurrentProfiles(): { data: IBMCloudProfiles; source: ProfilesSource; lastUpdated: Date | null } {
  const cached = getCachedProfiles();

  if (cached && !isProfilesCacheExpired()) {
    return {
      data: cached.data,
      source: 'cached',
      lastUpdated: new Date(cached.lastUpdated),
    };
  }

  // Return static data as fallback
  return {
    data: getStaticProfiles(),
    source: 'static',
    lastUpdated: null,
  };
}

/**
 * Count total profiles
 */
export function countProfiles(profiles: IBMCloudProfiles): { vsi: number; bareMetal: number } {
  const vsiCount = Object.values(profiles.vsiProfiles).reduce((sum, arr) => sum + arr.length, 0);
  const bareMetalCount = Object.values(profiles.bareMetalProfiles).reduce((sum, arr) => sum + arr.length, 0);
  return { vsi: vsiCount, bareMetal: bareMetalCount };
}
