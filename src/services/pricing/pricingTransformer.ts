// Pricing transformer - converts proxy API responses to app format

import type { ProxyPricingResponse } from './globalCatalogApi';
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

  // Merge custom profiles from static data (proxy never returns these)
  // Custom profiles include Future profiles and user-defined configurations
  for (const [profileName, profile] of Object.entries(staticPricing.bareMetal)) {
    if (profile.isCustom && !bareMetalProfiles[profileName]) {
      bareMetalProfiles[profileName] = profile;
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
    notes: `Pricing from Code Engine proxy (${proxyData.source || 'proxy'})`,
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
