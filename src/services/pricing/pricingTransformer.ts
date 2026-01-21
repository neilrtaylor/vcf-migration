// Pricing transformer - converts Global Catalog API responses to app format

import type { CatalogResource, PricingMetric, ProxyPricingResponse } from './globalCatalogApi';
import type {
  IBMCloudPricing,
  VSIProfile,
  BareMetalProfile,
  BlockStorageTier,
} from './pricingCache';
import { getStaticPricing } from './pricingCache';

// ===== CONSTANTS =====

const HOURS_PER_MONTH = 730; // Industry standard

// Profile family detection patterns
const FAMILY_PATTERNS: Record<string, RegExp> = {
  balanced: /^b[xz][0-9]/i,
  compute: /^c[xz][0-9]/i,
  memory: /^m[xz][0-9]/i,
  ultra: /^u[xz][0-9]/i,
  gpu: /^g[xz][0-9]/i,
};

// ===== HELPER FUNCTIONS =====

/**
 * Extract hourly price from pricing metrics (USD, US country)
 */
function extractHourlyPrice(metrics?: PricingMetric[]): number | null {
  if (!metrics || metrics.length === 0) return null;

  // Look for instance-hours metric
  const instanceMetric = metrics.find(
    (m) => m.metric_id?.includes('instance') || m.charge_unit?.includes('hour')
  );

  const metric = instanceMetric || metrics[0];
  if (!metric.amounts) return null;

  // Find USD pricing for USA
  const usdAmount = metric.amounts.find(
    (a) => a.currency === 'USD' && (a.country === 'USA' || a.country === 'US')
  );

  if (usdAmount?.prices?.[0]?.price) {
    return usdAmount.prices[0].price;
  }

  // Fallback to first available price
  const firstAmount = metric.amounts[0];
  if (firstAmount?.prices?.[0]?.price) {
    return firstAmount.prices[0].price;
  }

  return null;
}

/**
 * Extract per-GB price from pricing metrics
 */
function extractPerGBPrice(metrics?: PricingMetric[]): number | null {
  if (!metrics || metrics.length === 0) return null;

  // Look for GB or capacity metric
  const gbMetric = metrics.find(
    (m) =>
      m.charge_unit?.toLowerCase().includes('gb') ||
      m.metric_id?.toLowerCase().includes('capacity') ||
      m.metric_id?.toLowerCase().includes('gigabyte')
  );

  const metric = gbMetric || metrics[0];
  if (!metric.amounts) return null;

  // Find USD pricing
  const usdAmount = metric.amounts.find(
    (a) => a.currency === 'USD' && (a.country === 'USA' || a.country === 'US')
  );

  if (usdAmount?.prices?.[0]?.price) {
    return usdAmount.prices[0].price;
  }

  return null;
}

/**
 * Detect profile family from profile name
 */
function detectFamily(profileName: string): string {
  for (const [family, pattern] of Object.entries(FAMILY_PATTERNS)) {
    if (pattern.test(profileName)) {
      return family;
    }
  }
  return 'balanced';
}

/**
 * Parse vCPU and memory from profile name (e.g., "bx2-16x64")
 */
function parseProfileSpecs(
  profileName: string
): { vcpus: number; memoryGiB: number } | null {
  // Pattern: family-vcpuxmemory (e.g., bx2-16x64, cx2-4x8)
  const match = profileName.match(/(\d+)x(\d+)/);
  if (match) {
    return {
      vcpus: parseInt(match[1], 10),
      memoryGiB: parseInt(match[2], 10),
    };
  }
  return null;
}

/**
 * Parse bare metal profile specs (e.g., "bx2.metal.96x384")
 */
function parseBareMetalSpecs(profileName: string): {
  vcpus: number;
  memoryGiB: number;
  physicalCores: number;
} | null {
  const match = profileName.match(/(\d+)x(\d+)/);
  if (match) {
    const vcpus = parseInt(match[1], 10);
    return {
      vcpus,
      memoryGiB: parseInt(match[2], 10),
      physicalCores: Math.floor(vcpus / 2), // Typically 2 threads per core
    };
  }
  return null;
}

/**
 * Estimate network bandwidth from vCPUs
 */
function estimateNetworkGbps(vcpus: number): number {
  if (vcpus <= 2) return 4;
  if (vcpus <= 4) return 8;
  if (vcpus <= 8) return 16;
  if (vcpus <= 16) return 32;
  if (vcpus <= 48) return 64;
  return 80;
}

// ===== TRANSFORM FUNCTIONS =====

/**
 * Transform VSI profiles from API to app format
 */
export function transformVSIProfiles(
  resources: CatalogResource[]
): Record<string, VSIProfile> {
  const profiles: Record<string, VSIProfile> = {};

  for (const resource of resources) {
    if (!resource.name || !resource.active) continue;

    const specs = parseProfileSpecs(resource.name);
    if (!specs) continue;

    const hourlyRate = extractHourlyPrice(resource.metadata?.pricing?.metrics);
    if (hourlyRate === null) continue;

    const family = detectFamily(resource.name);
    const displayName =
      resource.metadata?.ui?.strings?.en?.display_name || resource.name;

    profiles[resource.name] = {
      profile: resource.name,
      family,
      vcpus: specs.vcpus,
      memoryGiB: specs.memoryGiB,
      networkGbps: estimateNetworkGbps(specs.vcpus),
      hourlyRate,
      monthlyRate: Math.round(hourlyRate * HOURS_PER_MONTH * 100) / 100,
      description:
        displayName ||
        `${family.charAt(0).toUpperCase() + family.slice(1)} VSI - ${specs.vcpus} vCPU, ${specs.memoryGiB} GiB RAM`,
    };
  }

  return profiles;
}

/**
 * Transform bare metal profiles from API to app format
 */
export function transformBareMetalProfiles(
  resources: CatalogResource[]
): Record<string, BareMetalProfile> {
  const profiles: Record<string, BareMetalProfile> = {};

  for (const resource of resources) {
    if (!resource.name || !resource.active) continue;

    const specs = parseBareMetalSpecs(resource.name);
    if (!specs) continue;

    const hourlyRate = extractHourlyPrice(resource.metadata?.pricing?.metrics);
    if (hourlyRate === null) continue;

    const family = detectFamily(resource.name);
    const hasNvme = resource.name.includes('d.metal') || resource.name.includes('d-metal');
    const displayName =
      resource.metadata?.ui?.strings?.en?.display_name || resource.name;

    profiles[resource.name] = {
      profile: resource.name,
      family,
      vcpus: specs.vcpus,
      physicalCores: specs.physicalCores,
      memoryGiB: specs.memoryGiB,
      hasNvme,
      hourlyRate,
      monthlyRate: Math.round(hourlyRate * HOURS_PER_MONTH * 100) / 100,
      description:
        displayName ||
        `${family.charAt(0).toUpperCase() + family.slice(1)} bare metal - ${specs.physicalCores} cores, ${specs.memoryGiB} GiB RAM`,
    };

    // Add NVMe specs if applicable
    if (hasNvme) {
      profiles[resource.name].nvmeDisks = 8;
      profiles[resource.name].nvmeSizeGB = 3200;
      profiles[resource.name].totalNvmeGB = 25600;
    }
  }

  return profiles;
}

/**
 * Transform block storage profiles from API to app format
 */
export function transformBlockStorageProfiles(
  resources: CatalogResource[]
): Record<string, BlockStorageTier> {
  const tiers: Record<string, BlockStorageTier> = {};

  for (const resource of resources) {
    if (!resource.name || !resource.active) continue;

    const costPerGBMonth = extractPerGBPrice(resource.metadata?.pricing?.metrics);
    const displayName =
      resource.metadata?.ui?.strings?.en?.display_name || resource.name;
    const description =
      resource.metadata?.ui?.strings?.en?.description || displayName;

    // Map common tier names
    let tierKey = resource.name;
    let iopsPerGB: number | undefined;

    if (resource.name.includes('general-purpose') || resource.name.includes('3iops')) {
      tierKey = 'generalPurpose';
      iopsPerGB = 3;
    } else if (resource.name.includes('5iops')) {
      tierKey = '5iops';
      iopsPerGB = 5;
    } else if (resource.name.includes('10iops')) {
      tierKey = '10iops';
      iopsPerGB = 10;
    } else if (resource.name.includes('custom')) {
      tierKey = 'custom';
    }

    tiers[tierKey] = {
      tierName: resource.name,
      iopsPerGB,
      costPerGBMonth: costPerGBMonth || 0.10, // Default fallback
      description: description || resource.name,
    };

    // Add custom tier specific fields
    if (tierKey === 'custom') {
      tiers[tierKey].minIOPS = 100;
      tiers[tierKey].maxIOPS = 48000;
      tiers[tierKey].baseCostPerGBMonth = 0.10;
      tiers[tierKey].costPerIOPSMonth = 0.0002;
    }
  }

  return tiers;
}

/**
 * Merge API-fetched pricing with static fallback data
 * This ensures we have complete data even if API returns partial results
 * Preserves roksSupported from static data since API doesn't provide it
 */
export function mergeWithStaticPricing(
  apiData: Partial<{
    vsi: Record<string, VSIProfile>;
    bareMetal: Record<string, BareMetalProfile>;
    blockStorage: Record<string, BlockStorageTier>;
  }>
): IBMCloudPricing {
  const staticPricing = getStaticPricing();

  // Merge bare metal profiles, preserving roksSupported from static data
  const mergedBareMetal: Record<string, BareMetalProfile> = { ...staticPricing.bareMetal };
  if (apiData.bareMetal) {
    for (const [name, apiProfile] of Object.entries(apiData.bareMetal)) {
      const staticProfile = staticPricing.bareMetal[name];
      mergedBareMetal[name] = {
        ...apiProfile,
        // Preserve roksSupported from static data (API doesn't provide this)
        roksSupported: staticProfile?.roksSupported ?? apiProfile.roksSupported,
        // Also preserve NVMe details from static if API doesn't have them
        nvmeDisks: apiProfile.nvmeDisks ?? staticProfile?.nvmeDisks,
        nvmeSizeGB: apiProfile.nvmeSizeGB ?? staticProfile?.nvmeSizeGB,
        totalNvmeGB: apiProfile.totalNvmeGB ?? staticProfile?.totalNvmeGB,
      };
    }
  }

  return {
    ...staticPricing,
    // Update version to indicate API data
    pricingVersion: new Date().toISOString().split('T')[0],
    // Merge VSI profiles - API data takes precedence
    vsi: {
      ...staticPricing.vsi,
      ...(apiData.vsi || {}),
    },
    // Merge bare metal profiles with preserved roksSupported
    bareMetal: mergedBareMetal,
    // Merge block storage tiers
    blockStorage: {
      ...staticPricing.blockStorage,
      ...(apiData.blockStorage || {}),
    },
    // Keep static data for these (API doesn't provide)
    roks: staticPricing.roks,
    networking: staticPricing.networking,
    storageAddons: staticPricing.storageAddons,
    regions: staticPricing.regions,
    discounts: staticPricing.discounts,
    odfWorkloadProfiles: staticPricing.odfWorkloadProfiles,
    // Update notes
    notes: 'Pricing refreshed from IBM Cloud Global Catalog API. Some values may use fallback estimates.',
  };
}

/**
 * Full transformation pipeline: API resources to IBMCloudPricing format
 */
export function transformCatalogToAppPricing(catalogData: {
  vsi: CatalogResource[];
  bareMetal: CatalogResource[];
  blockStorage: CatalogResource[];
}): IBMCloudPricing {
  const transformedVsi = transformVSIProfiles(catalogData.vsi);
  const transformedBareMetal = transformBareMetalProfiles(catalogData.bareMetal);
  const transformedBlockStorage = transformBlockStorageProfiles(catalogData.blockStorage);

  return mergeWithStaticPricing({
    vsi: Object.keys(transformedVsi).length > 0 ? transformedVsi : undefined,
    bareMetal: Object.keys(transformedBareMetal).length > 0 ? transformedBareMetal : undefined,
    blockStorage: Object.keys(transformedBlockStorage).length > 0 ? transformedBlockStorage : undefined,
  });
}

/**
 * Transform proxy response to IBMCloudPricing format
 * The proxy returns data in a slightly different format that needs mapping
 */
export function transformProxyToAppPricing(proxyData: ProxyPricingResponse): IBMCloudPricing {
  const staticPricing = getStaticPricing();

  // Transform VSI profiles from proxy format to app format
  const vsiProfiles: Record<string, VSIProfile> = {};
  for (const [profileName, profile] of Object.entries(proxyData.vsiProfiles || {})) {
    const family = detectFamily(profileName);
    vsiProfiles[profileName] = {
      profile: profileName,
      family,
      vcpus: profile.vcpus,
      memoryGiB: profile.memoryGiB,
      networkGbps: estimateNetworkGbps(profile.vcpus),
      hourlyRate: profile.hourlyRate,
      monthlyRate: Math.round(profile.hourlyRate * HOURS_PER_MONTH * 100) / 100,
      description: `${family.charAt(0).toUpperCase() + family.slice(1)} VSI - ${profile.vcpus} vCPU, ${profile.memoryGiB} GiB RAM`,
    };
  }

  // Transform bare metal profiles from proxy format, preserving roksSupported from static data
  const bareMetalProfiles: Record<string, BareMetalProfile> = {};
  for (const [profileName, profile] of Object.entries(proxyData.bareMetal || {})) {
    const family = detectFamily(profileName);
    const hasNvme = profileName.includes('d-metal') || profileName.includes('d.metal');
    const staticProfile = staticPricing.bareMetal[profileName];
    bareMetalProfiles[profileName] = {
      profile: profileName,
      family,
      vcpus: profile.vcpus,
      physicalCores: Math.floor(profile.vcpus / 2),
      memoryGiB: profile.memoryGiB,
      hasNvme,
      // Preserve roksSupported from static data (proxy doesn't provide this)
      roksSupported: staticProfile?.roksSupported,
      hourlyRate: profile.monthlyRate / HOURS_PER_MONTH,
      monthlyRate: profile.monthlyRate,
      description: `${family.charAt(0).toUpperCase() + family.slice(1)} bare metal - ${profile.vcpus} vCPUs, ${profile.memoryGiB} GiB RAM`,
    };
    if (hasNvme && profile.storageGiB) {
      bareMetalProfiles[profileName].nvmeDisks = staticProfile?.nvmeDisks ?? 8;
      bareMetalProfiles[profileName].nvmeSizeGB = staticProfile?.nvmeSizeGB ?? Math.round(profile.storageGiB / 8);
      bareMetalProfiles[profileName].totalNvmeGB = staticProfile?.totalNvmeGB ?? profile.storageGiB;
    }
  }

  // Transform block storage from proxy format
  const blockStorageTiers: Record<string, BlockStorageTier> = {};
  if (proxyData.blockStorage) {
    if (proxyData.blockStorage.generalPurpose) {
      blockStorageTiers['generalPurpose'] = {
        tierName: 'general-purpose',
        iopsPerGB: proxyData.blockStorage.generalPurpose.iopsPerGB,
        costPerGBMonth: proxyData.blockStorage.generalPurpose.costPerGBMonth,
        description: 'General Purpose (3 IOPS/GB)',
      };
    }
    if (proxyData.blockStorage.tiers) {
      for (const [tierKey, tier] of Object.entries(proxyData.blockStorage.tiers)) {
        blockStorageTiers[tierKey] = {
          tierName: tierKey,
          iopsPerGB: tier.iopsPerGB,
          costPerGBMonth: tier.costPerGBMonth,
          description: `${tierKey} tier`,
        };
      }
    }
    if (proxyData.blockStorage.custom) {
      blockStorageTiers['custom'] = {
        tierName: 'custom',
        costPerGBMonth: proxyData.blockStorage.custom.costPerGBMonth,
        description: 'Custom IOPS',
        minIOPS: 100,
        maxIOPS: 48000,
        baseCostPerGBMonth: proxyData.blockStorage.custom.costPerGBMonth,
        costPerIOPSMonth: proxyData.blockStorage.custom.costPerIOPS,
      };
    }
  }

  return {
    ...staticPricing,
    pricingVersion: proxyData.version || new Date().toISOString().split('T')[0],
    notes: `Pricing from Cloud Functions proxy (${proxyData.source || 'proxy'})`,
    vsi: Object.keys(vsiProfiles).length > 0 ? vsiProfiles : staticPricing.vsi,
    bareMetal: Object.keys(bareMetalProfiles).length > 0 ? bareMetalProfiles : staticPricing.bareMetal,
    blockStorage: Object.keys(blockStorageTiers).length > 0 ? blockStorageTiers : staticPricing.blockStorage,
    // Update networking from proxy if available
    networking: proxyData.networking ? {
      ...staticPricing.networking,
      loadBalancer: {
        perLBMonthly: proxyData.networking.loadBalancer?.perLBMonthly || staticPricing.networking.loadBalancer.perLBMonthly,
        perGBProcessed: proxyData.networking.loadBalancer?.perGBProcessed || staticPricing.networking.loadBalancer.perGBProcessed,
        description: staticPricing.networking.loadBalancer.description,
      },
      floatingIP: {
        perIPMonthly: proxyData.networking.floatingIP?.monthlyRate || staticPricing.networking.floatingIP.perIPMonthly,
        description: staticPricing.networking.floatingIP.description,
      },
      vpnGateway: {
        perGatewayMonthly: proxyData.networking.vpnGateway?.monthlyRate || staticPricing.networking.vpnGateway.perGatewayMonthly,
        perConnectionMonthly: staticPricing.networking.vpnGateway.perConnectionMonthly,
        description: staticPricing.networking.vpnGateway.description,
      },
      publicGateway: staticPricing.networking.publicGateway,
      transitGateway: staticPricing.networking.transitGateway,
    } : staticPricing.networking,
  };
}
