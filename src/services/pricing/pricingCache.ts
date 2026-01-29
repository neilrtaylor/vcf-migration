// Pricing cache service - manages localStorage caching with expiry

import staticPricingData from '@/data/ibmCloudConfig.json';

// ===== TYPES =====

export interface BareMetalProfile {
  profile: string;
  family: string;
  vcpus: number;
  physicalCores: number;
  memoryGiB: number;
  hasNvme: boolean;
  nvmeDisks?: number;
  nvmeSizeGB?: number;
  totalNvmeGB?: number;
  roksSupported?: boolean;
  isCustom?: boolean;
  tag?: string;
  hourlyRate: number;
  monthlyRate: number;
  description: string;
}

export interface VSIProfile {
  profile: string;
  family: string;
  vcpus: number;
  memoryGiB: number;
  networkGbps: number;
  hourlyRate: number;
  monthlyRate: number;
  description: string;
}

export interface BlockStorageTier {
  tierName: string;
  iopsPerGB?: number;
  costPerGBMonth?: number;
  description: string;
  minIOPS?: number;
  maxIOPS?: number;
  baseCostPerGBMonth?: number;
  costPerIOPSMonth?: number;
}

export interface NetworkPricing {
  publicGateway: { perGatewayMonthly: number; description: string };
  floatingIP: { perIPMonthly: number; description: string };
  vpnGateway: { perGatewayMonthly: number; perConnectionMonthly: number; description: string };
  transitGateway: {
    perGatewayMonthly: number;
    localConnectionMonthly: number;
    globalConnectionMonthly: number;
    perGBLocal: number;
    perGBGlobal: number;
    description: string;
  };
  loadBalancer: { perLBMonthly: number; perGBProcessed: number; description: string };
}

export interface RegionPricing {
  name: string;
  code: string;
  multiplier: number;
  availabilityZones: number;
}

export interface DiscountOption {
  name: string;
  discountPct: number;
  description: string;
}

export interface IBMCloudPricing {
  pricingVersion: string;
  baseCurrency: string;
  notes: string;
  bareMetal: Record<string, BareMetalProfile>;
  vsi: Record<string, VSIProfile>;
  blockStorage: Record<string, BlockStorageTier>;
  roks: {
    ocpLicense: { perCoreMonthly: number; description: string };
    clusterManagement: { perClusterMonthly: number; description: string };
  };
  networking: NetworkPricing;
  storageAddons: {
    snapshots: { costPerGBMonth: number; description: string };
    objectStorage: { standardPerGBMonth: number; vaultPerGBMonth: number; description: string };
  };
  regions: Record<string, RegionPricing>;
  discounts: Record<string, DiscountOption>;
  odfWorkloadProfiles: Record<string, {
    name: string;
    cpuPerNode: number;
    memoryPerNodeGiB: number;
    description: string;
  }>;
}

export type PricingSource = 'proxy' | 'static' | 'cached';

export interface CachedPricing {
  data: IBMCloudPricing;
  lastUpdated: string;  // ISO timestamp
  source: PricingSource;
  expiresAt: string;    // ISO timestamp (24 hours from fetch)
}

// ===== CONSTANTS =====

const CACHE_KEY = 'ibm-cloud-pricing-cache';
const CACHE_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

// ===== CACHE FUNCTIONS =====

/**
 * Get cached pricing data from localStorage
 */
export function getCachedPricing(): CachedPricing | null {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return null;

    const parsed = JSON.parse(cached) as CachedPricing;

    // Validate that cached data has required structure
    if (!parsed.data ||
        !parsed.data.bareMetal ||
        !parsed.data.vsi ||
        !parsed.data.regions ||
        !parsed.data.discounts) {
      console.warn('Cached pricing data is incomplete, clearing cache');
      localStorage.removeItem(CACHE_KEY);
      return null;
    }

    return parsed;
  } catch (error) {
    console.warn('Failed to read pricing cache:', error);
    localStorage.removeItem(CACHE_KEY);
    return null;
  }
}

/**
 * Save pricing data to localStorage cache
 */
export function setCachedPricing(data: IBMCloudPricing, source: PricingSource): void {
  try {
    const now = new Date();
    const cached: CachedPricing = {
      data,
      lastUpdated: now.toISOString(),
      source,
      expiresAt: new Date(now.getTime() + CACHE_DURATION_MS).toISOString(),
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(cached));
  } catch (error) {
    console.warn('Failed to save pricing cache:', error);
  }
}

/**
 * Check if the cached pricing has expired
 */
export function isCacheExpired(): boolean {
  const cached = getCachedPricing();
  if (!cached) return true;

  const expiresAt = new Date(cached.expiresAt);
  return new Date() > expiresAt;
}

/**
 * Get the last updated timestamp
 */
export function getLastUpdated(): Date | null {
  const cached = getCachedPricing();
  if (!cached) return null;
  return new Date(cached.lastUpdated);
}

/**
 * Get the pricing source (api, static, or cached)
 */
export function getPricingSource(): PricingSource {
  const cached = getCachedPricing();
  if (!cached) return 'static';
  return cached.source;
}

/**
 * Clear the pricing cache
 */
export function clearPricingCache(): void {
  try {
    localStorage.removeItem(CACHE_KEY);
  } catch (error) {
    console.warn('Failed to clear pricing cache:', error);
  }
}

/**
 * Get static pricing data as fallback
 * Transforms the config structure to match the IBMCloudPricing interface
 */
export function getStaticPricing(): IBMCloudPricing {
  const config = staticPricingData as {
    version: string;
    baseCurrency: string;
    notes: string;
    vsiPricing: Record<string, { hourlyRate: number; monthlyRate: number }>;
    bareMetalPricing: Record<string, { hourlyRate: number; monthlyRate: number }>;
    bareMetalProfiles: Record<string, Array<{
      name: string;
      physicalCores: number;
      vcpus: number;
      memoryGiB: number;
      hasNvme: boolean;
      roksSupported?: boolean;
      nvmeDisks?: number;
      nvmeSizeGiB?: number;
      totalNvmeGiB?: number;
      hourlyRate: number;
      monthlyRate: number;
      useCase: string;
      description: string;
    }>>;
    vsiProfiles: Record<string, Array<{
      name: string;
      vcpus: number;
      memoryGiB: number;
      bandwidthGbps: number;
      hourlyRate: number;
      monthlyRate: number;
    }>>;
    blockStorage: Record<string, BlockStorageTier>;
    networking: NetworkPricing;
    storageAddons: {
      snapshots: { costPerGBMonth: number; description: string };
      objectStorage: { standardPerGBMonth: number; vaultPerGBMonth: number; description: string };
    };
    regions: Record<string, RegionPricing>;
    discounts: Record<string, DiscountOption>;
    roks: {
      ocpLicense: { perCoreMonthly: number; description: string };
      clusterManagement: { perClusterMonthly: number; description: string };
    };
    odfWorkloadProfiles: Record<string, {
      name: string;
      cpuPerNode: number;
      memoryPerNodeGiB: number;
      description: string;
    }>;
  };

  // Transform bareMetal profiles from array structure to flat Record
  const bareMetal: Record<string, BareMetalProfile> = {};
  for (const [family, profiles] of Object.entries(config.bareMetalProfiles)) {
    for (const profile of profiles) {
      bareMetal[profile.name] = {
        profile: profile.name,
        family,
        vcpus: profile.vcpus,
        physicalCores: profile.physicalCores,
        memoryGiB: profile.memoryGiB,
        hasNvme: profile.hasNvme,
        nvmeDisks: profile.nvmeDisks,
        nvmeSizeGB: profile.nvmeSizeGiB,
        totalNvmeGB: profile.totalNvmeGiB,
        roksSupported: profile.roksSupported,
        hourlyRate: profile.hourlyRate,
        monthlyRate: profile.monthlyRate,
        description: profile.description,
      };
    }
  }

  // Transform custom bare metal profiles
  const customBareMetalProfiles = (config as { customBareMetalProfiles?: Array<{
    name: string;
    tag?: string;
    physicalCores: number;
    vcpus: number;
    memoryGiB: number;
    hasNvme: boolean;
    nvmeDisks?: number;
    nvmeSizeGiB?: number;
    totalNvmeGiB?: number;
    roksSupported?: boolean;
    hourlyRate?: number;
    monthlyRate?: number;
    useCase?: string;
    description?: string;
  }> }).customBareMetalProfiles || [];

  for (const profile of customBareMetalProfiles) {
    bareMetal[profile.name] = {
      profile: profile.name,
      family: 'custom',
      vcpus: profile.vcpus,
      physicalCores: profile.physicalCores,
      memoryGiB: profile.memoryGiB,
      hasNvme: profile.hasNvme,
      nvmeDisks: profile.nvmeDisks,
      nvmeSizeGB: profile.nvmeSizeGiB,
      totalNvmeGB: profile.totalNvmeGiB,
      roksSupported: profile.roksSupported,
      isCustom: true,
      tag: profile.tag || 'Custom',
      hourlyRate: profile.hourlyRate || 0,
      monthlyRate: profile.monthlyRate || 0,
      description: profile.description || `Custom - ${profile.vcpus} vCPUs, ${profile.memoryGiB} GiB RAM`,
    };
  }

  // Transform VSI profiles from array structure to flat Record
  const vsi: Record<string, VSIProfile> = {};
  for (const [family, profiles] of Object.entries(config.vsiProfiles)) {
    for (const profile of profiles) {
      vsi[profile.name] = {
        profile: profile.name,
        family,
        vcpus: profile.vcpus,
        memoryGiB: profile.memoryGiB,
        networkGbps: profile.bandwidthGbps,
        hourlyRate: profile.hourlyRate,
        monthlyRate: profile.monthlyRate,
        description: `${family} - ${profile.vcpus} vCPUs, ${profile.memoryGiB} GiB RAM`,
      };
    }
  }

  return {
    pricingVersion: config.version,
    baseCurrency: config.baseCurrency,
    notes: config.notes,
    bareMetal,
    vsi,
    blockStorage: config.blockStorage,
    roks: config.roks,
    networking: config.networking,
    storageAddons: config.storageAddons,
    regions: config.regions,
    discounts: config.discounts,
    odfWorkloadProfiles: config.odfWorkloadProfiles,
  };
}

/**
 * Get current pricing data (cached or static fallback)
 */
export function getCurrentPricing(): { data: IBMCloudPricing; source: PricingSource; lastUpdated: Date | null } {
  const cached = getCachedPricing();

  if (cached && !isCacheExpired()) {
    return {
      data: cached.data,
      source: 'cached',
      lastUpdated: new Date(cached.lastUpdated),
    };
  }

  // Return static data as fallback
  return {
    data: getStaticPricing(),
    source: 'static',
    lastUpdated: null,
  };
}
