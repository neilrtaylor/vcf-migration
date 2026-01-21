// IBM Cloud Cost Estimation Service
import ibmCloudConfig from '@/data/ibmCloudConfig.json';
import type { IBMCloudPricing } from '@/services/pricing/pricingCache';
import { getCurrentPricing, getStaticPricing } from '@/services/pricing/pricingCache';

// ===== TYPES =====

export interface ValidationError {
  field: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

export interface ROKSSizingInput {
  computeNodes: number;
  computeProfile: string;
  storageNodes?: number;
  storageProfile?: string;
  storageTiB?: number;
  storageTier?: '5iops' | '10iops';
  useNvme?: boolean;
  odfProfile?: string;
}

export interface NetworkingOptions {
  includeVPN?: boolean;
  vpnGatewayCount?: number;
  includeTransitGateway?: boolean;
  transitGatewayLocalConnections?: number;
  transitGatewayGlobalConnections?: number;
  includePublicGateway?: boolean;
  publicGatewayCount?: number;
  loadBalancerCount?: number;
}

export interface VSISizingInput {
  vmProfiles: { profile: string; count: number }[];
  storageTiB: number;
  storageTier?: '5iops' | '10iops';
  networking?: NetworkingOptions;
}

// ===== VALIDATION =====

/**
 * Validate ROKSSizingInput
 */
export function validateROKSSizingInput(input: ROKSSizingInput): ValidationResult {
  const errors: ValidationError[] = [];

  // Compute nodes validation
  if (input.computeNodes === undefined || input.computeNodes === null) {
    errors.push({ field: 'computeNodes', message: 'Compute nodes count is required' });
  } else if (!Number.isInteger(input.computeNodes) || input.computeNodes < 0) {
    errors.push({ field: 'computeNodes', message: 'Compute nodes must be a non-negative integer' });
  } else if (input.computeNodes > 1000) {
    errors.push({ field: 'computeNodes', message: 'Compute nodes cannot exceed 1000' });
  }

  // Compute profile validation
  if (!input.computeProfile || typeof input.computeProfile !== 'string') {
    errors.push({ field: 'computeProfile', message: 'Compute profile is required' });
  } else if (input.computeProfile.trim() === '') {
    errors.push({ field: 'computeProfile', message: 'Compute profile cannot be empty' });
  }

  // Storage nodes validation (optional)
  if (input.storageNodes !== undefined && input.storageNodes !== null) {
    if (!Number.isInteger(input.storageNodes) || input.storageNodes < 0) {
      errors.push({ field: 'storageNodes', message: 'Storage nodes must be a non-negative integer' });
    } else if (input.storageNodes > 500) {
      errors.push({ field: 'storageNodes', message: 'Storage nodes cannot exceed 500' });
    }
  }

  // Storage TiB validation (optional)
  if (input.storageTiB !== undefined && input.storageTiB !== null) {
    if (typeof input.storageTiB !== 'number' || input.storageTiB < 0) {
      errors.push({ field: 'storageTiB', message: 'Storage TiB must be a non-negative number' });
    } else if (input.storageTiB > 10000) {
      errors.push({ field: 'storageTiB', message: 'Storage TiB cannot exceed 10,000' });
    }
  }

  // Storage tier validation (optional)
  if (input.storageTier !== undefined && input.storageTier !== null) {
    if (!['5iops', '10iops'].includes(input.storageTier)) {
      errors.push({ field: 'storageTier', message: 'Storage tier must be "5iops" or "10iops"' });
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate VSISizingInput
 */
export function validateVSISizingInput(input: VSISizingInput): ValidationResult {
  const errors: ValidationError[] = [];

  // VM profiles validation
  if (!input.vmProfiles || !Array.isArray(input.vmProfiles)) {
    errors.push({ field: 'vmProfiles', message: 'VM profiles array is required' });
  } else {
    input.vmProfiles.forEach((vm, index) => {
      if (!vm.profile || typeof vm.profile !== 'string' || vm.profile.trim() === '') {
        errors.push({ field: `vmProfiles[${index}].profile`, message: 'Profile name is required' });
      }
      if (vm.count === undefined || vm.count === null) {
        errors.push({ field: `vmProfiles[${index}].count`, message: 'VM count is required' });
      } else if (!Number.isInteger(vm.count) || vm.count < 0) {
        errors.push({ field: `vmProfiles[${index}].count`, message: 'VM count must be a non-negative integer' });
      } else if (vm.count > 10000) {
        errors.push({ field: `vmProfiles[${index}].count`, message: 'VM count cannot exceed 10,000' });
      }
    });
  }

  // Storage TiB validation
  if (input.storageTiB === undefined || input.storageTiB === null) {
    errors.push({ field: 'storageTiB', message: 'Storage TiB is required' });
  } else if (typeof input.storageTiB !== 'number' || input.storageTiB < 0) {
    errors.push({ field: 'storageTiB', message: 'Storage TiB must be a non-negative number' });
  } else if (input.storageTiB > 100000) {
    errors.push({ field: 'storageTiB', message: 'Storage TiB cannot exceed 100,000' });
  }

  // Storage tier validation (optional)
  if (input.storageTier !== undefined && input.storageTier !== null) {
    if (!['5iops', '10iops'].includes(input.storageTier)) {
      errors.push({ field: 'storageTier', message: 'Storage tier must be "5iops" or "10iops"' });
    }
  }

  // Networking validation (optional)
  if (input.networking) {
    const net = input.networking;
    if (net.vpnGatewayCount !== undefined && (!Number.isInteger(net.vpnGatewayCount) || net.vpnGatewayCount < 0)) {
      errors.push({ field: 'networking.vpnGatewayCount', message: 'VPN gateway count must be a non-negative integer' });
    }
    if (net.publicGatewayCount !== undefined && (!Number.isInteger(net.publicGatewayCount) || net.publicGatewayCount < 0)) {
      errors.push({ field: 'networking.publicGatewayCount', message: 'Public gateway count must be a non-negative integer' });
    }
    if (net.loadBalancerCount !== undefined && (!Number.isInteger(net.loadBalancerCount) || net.loadBalancerCount < 0)) {
      errors.push({ field: 'networking.loadBalancerCount', message: 'Load balancer count must be a non-negative integer' });
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate region code
 */
export function validateRegion(region: string, pricing?: IBMCloudPricing): ValidationResult {
  const errors: ValidationError[] = [];
  const data = pricing || getActivePricing();

  if (!region || typeof region !== 'string') {
    errors.push({ field: 'region', message: 'Region is required' });
  } else if (!data.regions[region]) {
    const validRegions = Object.keys(data.regions).join(', ');
    errors.push({ field: 'region', message: `Invalid region "${region}". Valid regions: ${validRegions}` });
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate discount type
 */
export function validateDiscountType(discountType: string, pricing?: IBMCloudPricing): ValidationResult {
  const errors: ValidationError[] = [];
  const data = pricing || getActivePricing();

  if (!discountType || typeof discountType !== 'string') {
    errors.push({ field: 'discountType', message: 'Discount type is required' });
  } else if (!data.discounts[discountType]) {
    const validTypes = Object.keys(data.discounts).join(', ');
    errors.push({ field: 'discountType', message: `Invalid discount type "${discountType}". Valid types: ${validTypes}` });
  }

  return { valid: errors.length === 0, errors };
}

// Helper to get active pricing data (dynamic or static fallback)
function getActivePricing(): IBMCloudPricing {
  try {
    const current = getCurrentPricing();
    // Ensure all required properties exist by merging with static pricing
    const staticData = getStaticPricing();
    return {
      ...staticData,
      ...current.data,
      // Ensure nested objects exist
      bareMetal: current.data.bareMetal || staticData.bareMetal,
      vsi: current.data.vsi || staticData.vsi,
      regions: current.data.regions || staticData.regions,
      discounts: current.data.discounts || staticData.discounts,
      blockStorage: current.data.blockStorage || staticData.blockStorage,
      networking: current.data.networking || staticData.networking,
      roks: current.data.roks || staticData.roks,
      storageAddons: current.data.storageAddons || staticData.storageAddons,
      odfWorkloadProfiles: current.data.odfWorkloadProfiles || staticData.odfWorkloadProfiles,
    };
  } catch {
    return getStaticPricing();
  }
}

export interface CostLineItem {
  category: string;
  description: string;
  quantity: number;
  unit: string;
  unitCost: number;
  monthlyCost: number;
  annualCost: number;
  notes?: string;
}

export interface CostEstimate {
  architecture: string;
  region: string;
  regionName: string;
  discountType: string;
  discountPct: number;
  lineItems: CostLineItem[];
  subtotalMonthly: number;
  subtotalAnnual: number;
  discountAmountMonthly: number;
  discountAmountAnnual: number;
  totalMonthly: number;
  totalAnnual: number;
  metadata: {
    pricingVersion: string;
    generatedAt: string;
    notes: string[];
  };
}

export type RegionCode = keyof typeof ibmCloudConfig.regions;
export type DiscountType = keyof typeof ibmCloudConfig.discounts;

/**
 * Get list of available regions
 */
export function getRegions(pricing?: IBMCloudPricing): { code: string; name: string; multiplier: number }[] {
  const data = pricing || getActivePricing();
  if (!data.regions) {
    console.warn('[getRegions] regions is undefined, returning defaults');
    return [{ code: 'us-south', name: 'Dallas', multiplier: 1.0 }];
  }
  return Object.entries(data.regions).map(([code, region]) => ({
    code,
    name: region.name,
    multiplier: region.multiplier,
  }));
}

/**
 * Get list of available discount options
 */
export function getDiscountOptions(pricing?: IBMCloudPricing): { id: string; name: string; discountPct: number; description: string }[] {
  const data = pricing || getActivePricing();
  if (!data.discounts) {
    console.warn('[getDiscountOptions] discounts is undefined, returning defaults');
    return [{ id: 'onDemand', name: 'On-Demand', discountPct: 0, description: 'Pay-as-you-go' }];
  }
  return Object.entries(data.discounts).map(([id, discount]) => ({
    id,
    name: discount.name,
    discountPct: discount.discountPct,
    description: discount.description,
  }));
}

/**
 * Get bare metal profiles
 */
export function getBareMetalProfiles(pricing?: IBMCloudPricing) {
  const data = pricing || getActivePricing();
  if (!data.bareMetal) {
    console.warn('[getBareMetalProfiles] bareMetal is undefined, returning empty array');
    return [];
  }
  return Object.entries(data.bareMetal).map(([id, profile]) => ({
    id,
    ...profile,
  }));
}

/**
 * Get VSI profiles
 */
export function getVSIProfiles(pricing?: IBMCloudPricing) {
  const data = pricing || getActivePricing();
  if (!data.vsi) {
    console.warn('[getVSIProfiles] vsi is undefined, returning empty array');
    return [];
  }
  return Object.entries(data.vsi).map(([id, profile]) => ({
    id,
    ...profile,
  }));
}

/**
 * Get ODF workload profiles
 */
export function getODFProfiles(pricing?: IBMCloudPricing) {
  const data = pricing || getActivePricing();
  if (!data.odfWorkloadProfiles) {
    console.warn('[getODFProfiles] odfWorkloadProfiles is undefined, returning empty array');
    return [];
  }
  return Object.entries(data.odfWorkloadProfiles).map(([id, profile]) => ({
    id,
    ...profile,
  }));
}

/**
 * Calculate ROKS cluster cost estimate
 */
export function calculateROKSCost(
  input: ROKSSizingInput,
  region: RegionCode = 'us-south',
  discountType: DiscountType = 'onDemand',
  pricing?: IBMCloudPricing
): CostEstimate {
  const pricingToUse = pricing || getActivePricing();
  const lineItems: CostLineItem[] = [];

  // Defensive checks for required pricing data
  const regionData = pricingToUse.regions?.[region] || { name: 'Dallas', multiplier: 1.0, availabilityZones: 3 };
  const discountData = pricingToUse.discounts?.[discountType] || { name: 'On-Demand', discountPct: 0, description: 'Pay-as-you-go' };
  const multiplier = regionData.multiplier;

  // Compute nodes (bare metal)
  const computeProfile = pricingToUse.bareMetal[input.computeProfile as keyof typeof pricingToUse.bareMetal];
  if (computeProfile && input.computeNodes > 0) {
    const monthlyRate = computeProfile.monthlyRate * multiplier;
    lineItems.push({
      category: 'Compute',
      description: `Bare Metal - ${input.computeProfile}`,
      quantity: input.computeNodes,
      unit: 'nodes',
      unitCost: monthlyRate,
      monthlyCost: input.computeNodes * monthlyRate,
      annualCost: input.computeNodes * monthlyRate * 12,
      notes: computeProfile.description,
    });
  }

  // If using NVMe (converged storage), no separate storage nodes needed
  if (input.useNvme && computeProfile?.hasNvme) {
    // NVMe storage is included in the bare metal cost
    // Cast to access optional NVMe properties
    const nvmeProfile = computeProfile as { totalNvmeGB?: number; nvmeDisks?: number; nvmeSizeGB?: number };
    const nvmeCapacity = input.computeNodes * (nvmeProfile.totalNvmeGB || 0);
    lineItems.push({
      category: 'Storage',
      description: 'NVMe Local Storage (included)',
      quantity: Math.round(nvmeCapacity / 1024),
      unit: 'TiB raw',
      unitCost: 0,
      monthlyCost: 0,
      annualCost: 0,
      notes: `${nvmeProfile.nvmeDisks || 0}x ${(nvmeProfile.nvmeSizeGB || 0) / 1000}TB NVMe per node`,
    });
  } else {
    // Hybrid architecture with separate storage nodes
    if (input.storageNodes && input.storageProfile) {
      const storageVSI = pricingToUse.vsi[input.storageProfile as keyof typeof pricingToUse.vsi];
      if (storageVSI) {
        const monthlyRate = storageVSI.monthlyRate * multiplier;
        lineItems.push({
          category: 'Storage - VSI',
          description: `VSI - ${input.storageProfile}`,
          quantity: input.storageNodes,
          unit: 'nodes',
          unitCost: monthlyRate,
          monthlyCost: input.storageNodes * monthlyRate,
          annualCost: input.storageNodes * monthlyRate * 12,
          notes: `ODF storage workers - ${storageVSI.description}`,
        });
      }
    }

    // Block storage for hybrid
    if (input.storageTiB && input.storageTiB > 0) {
      const tier = input.storageTier || '10iops';
      const storageTierData = pricingToUse.blockStorage?.[tier];
      const storageGB = input.storageTiB * 1024;
      const costPerGB = (storageTierData?.costPerGBMonth || 0.10) * multiplier;

      lineItems.push({
        category: 'Storage - Block',
        description: `Block Storage - ${storageTierData?.tierName || tier}`,
        quantity: storageGB,
        unit: 'GB',
        unitCost: costPerGB,
        monthlyCost: storageGB * costPerGB,
        annualCost: storageGB * costPerGB * 12,
        notes: storageTierData?.description || `${tier} IOPS tier`,
      });
    }
  }

  // Networking (basic setup)
  const lbCostPerMonth = pricingToUse.networking?.loadBalancer?.perLBMonthly ?? 21.60;
  const networkingCost = lbCostPerMonth * multiplier * 2; // 2 LBs
  lineItems.push({
    category: 'Networking',
    description: 'Load Balancers (2x)',
    quantity: 2,
    unit: 'LBs',
    unitCost: lbCostPerMonth * multiplier,
    monthlyCost: networkingCost,
    annualCost: networkingCost * 12,
    notes: 'Application Load Balancers for ingress',
  });

  // Calculate totals
  const subtotalMonthly = lineItems.reduce((sum, item) => sum + item.monthlyCost, 0);
  const subtotalAnnual = subtotalMonthly * 12;
  const discountAmountMonthly = subtotalMonthly * (discountData.discountPct / 100);
  const discountAmountAnnual = discountAmountMonthly * 12;
  const totalMonthly = subtotalMonthly - discountAmountMonthly;
  const totalAnnual = totalMonthly * 12;

  return {
    architecture: input.useNvme ? 'All-NVMe Converged' : 'Hybrid (Bare Metal + VSI Storage)',
    region,
    regionName: regionData.name,
    discountType,
    discountPct: discountData.discountPct,
    lineItems,
    subtotalMonthly,
    subtotalAnnual,
    discountAmountMonthly,
    discountAmountAnnual,
    totalMonthly,
    totalAnnual,
    metadata: {
      pricingVersion: pricingToUse.pricingVersion,
      generatedAt: new Date().toISOString(),
      notes: [
        'Estimated pricing - actual costs may vary',
        'Contact IBM for enterprise pricing',
        discountData.discountPct > 0 ? `${discountData.name} discount applied` : 'On-demand pricing',
      ],
    },
  };
}

/**
 * Calculate VSI migration cost estimate
 */
export function calculateVSICost(
  input: VSISizingInput,
  region: RegionCode = 'us-south',
  discountType: DiscountType = 'onDemand',
  pricing?: IBMCloudPricing
): CostEstimate {
  const pricingToUse = pricing || getActivePricing();
  const lineItems: CostLineItem[] = [];

  // Defensive checks for required pricing data
  const regionData = pricingToUse.regions?.[region] || { name: 'Dallas', multiplier: 1.0, availabilityZones: 3 };
  const discountData = pricingToUse.discounts?.[discountType] || { name: 'On-Demand', discountPct: 0, description: 'Pay-as-you-go' };
  const multiplier = regionData.multiplier;

  // Group VSI profiles
  const profileCounts: Record<string, { count: number; profile: typeof pricingToUse.vsi[keyof typeof pricingToUse.vsi] }> = {};

  for (const vm of input.vmProfiles) {
    const profile = pricingToUse.vsi[vm.profile as keyof typeof pricingToUse.vsi];
    if (profile) {
      if (!profileCounts[vm.profile]) {
        profileCounts[vm.profile] = { count: 0, profile };
      }
      profileCounts[vm.profile].count += vm.count;
    }
  }

  // Add VSI line items
  for (const [profileName, data] of Object.entries(profileCounts)) {
    const monthlyRate = data.profile.monthlyRate * multiplier;
    lineItems.push({
      category: 'Compute - VSI',
      description: `VSI - ${profileName}`,
      quantity: data.count,
      unit: 'instances',
      unitCost: monthlyRate,
      monthlyCost: data.count * monthlyRate,
      annualCost: data.count * monthlyRate * 12,
      notes: data.profile.description,
    });
  }

  // Block storage
  if (input.storageTiB > 0) {
    const tier = input.storageTier || '10iops';
    const storageTierData = pricingToUse.blockStorage?.[tier];
    const storageGB = input.storageTiB * 1024;
    const costPerGB = (storageTierData?.costPerGBMonth || 0.10) * multiplier;

    lineItems.push({
      category: 'Storage - Block',
      description: `Block Storage - ${storageTierData?.tierName || tier}`,
      quantity: storageGB,
      unit: 'GB',
      unitCost: costPerGB,
      monthlyCost: storageGB * costPerGB,
      annualCost: storageGB * costPerGB * 12,
      notes: storageTierData?.description || `${tier} IOPS tier`,
    });
  }

  // Networking
  const netOpts = input.networking || {};
  const loadBalancerCount = netOpts.loadBalancerCount ?? 1;
  const networking = pricingToUse.networking || {};

  // Load Balancer(s)
  if (loadBalancerCount > 0) {
    const lbCost = (networking.loadBalancer?.perLBMonthly ?? 21.60) * multiplier;
    lineItems.push({
      category: 'Networking',
      description: 'Application Load Balancer',
      quantity: loadBalancerCount,
      unit: 'LB',
      unitCost: lbCost,
      monthlyCost: loadBalancerCount * lbCost,
      annualCost: loadBalancerCount * lbCost * 12,
      notes: 'For application traffic distribution',
    });
  }

  // VPN Gateway
  if (netOpts.includeVPN) {
    const vpnCount = netOpts.vpnGatewayCount || 1;
    const vpnCost = (networking.vpnGateway?.perGatewayMonthly ?? 99) * multiplier;
    lineItems.push({
      category: 'Networking',
      description: 'VPN Gateway',
      quantity: vpnCount,
      unit: 'gateway',
      unitCost: vpnCost,
      monthlyCost: vpnCount * vpnCost,
      annualCost: vpnCount * vpnCost * 12,
      notes: 'Site-to-site VPN connectivity to on-premises',
    });
  }

  // Transit Gateway
  if (netOpts.includeTransitGateway) {
    const localConns = netOpts.transitGatewayLocalConnections || 1;
    const globalConns = netOpts.transitGatewayGlobalConnections || 0;
    const transitGw = networking.transitGateway || { localConnectionMonthly: 50, globalConnectionMonthly: 100 };

    // Local connections
    if (localConns > 0) {
      const localConnCost = (transitGw.localConnectionMonthly ?? 50) * multiplier;
      lineItems.push({
        category: 'Networking',
        description: 'Transit Gateway - Local Connection',
        quantity: localConns,
        unit: 'connection',
        unitCost: localConnCost,
        monthlyCost: localConns * localConnCost,
        annualCost: localConns * localConnCost * 12,
        notes: 'Same-region VPC/Classic connectivity',
      });
    }

    // Global connections
    if (globalConns > 0) {
      const globalConnCost = (transitGw.globalConnectionMonthly ?? 100) * multiplier;
      lineItems.push({
        category: 'Networking',
        description: 'Transit Gateway - Global Connection',
        quantity: globalConns,
        unit: 'connection',
        unitCost: globalConnCost,
        monthlyCost: globalConns * globalConnCost,
        annualCost: globalConns * globalConnCost * 12,
        notes: 'Cross-region connectivity',
      });
    }
  }

  // Public Gateway
  if (netOpts.includePublicGateway) {
    const pgwCount = netOpts.publicGatewayCount || 1;
    const pgwCost = (networking.publicGateway?.perGatewayMonthly ?? 5) * multiplier;
    lineItems.push({
      category: 'Networking',
      description: 'Public Gateway',
      quantity: pgwCount,
      unit: 'gateway',
      unitCost: pgwCost,
      monthlyCost: pgwCount * pgwCost,
      annualCost: pgwCount * pgwCost * 12,
      notes: 'Outbound internet access for VPC subnets',
    });
  }

  // Calculate totals
  const subtotalMonthly = lineItems.reduce((sum, item) => sum + item.monthlyCost, 0);
  const subtotalAnnual = subtotalMonthly * 12;
  const discountAmountMonthly = subtotalMonthly * (discountData.discountPct / 100);
  const discountAmountAnnual = discountAmountMonthly * 12;
  const totalMonthly = subtotalMonthly - discountAmountMonthly;
  const totalAnnual = totalMonthly * 12;

  return {
    architecture: 'VPC Virtual Server Instances',
    region,
    regionName: regionData.name,
    discountType,
    discountPct: discountData.discountPct,
    lineItems,
    subtotalMonthly,
    subtotalAnnual,
    discountAmountMonthly,
    discountAmountAnnual,
    totalMonthly,
    totalAnnual,
    metadata: {
      pricingVersion: pricingToUse.pricingVersion,
      generatedAt: new Date().toISOString(),
      notes: [
        'Estimated pricing - actual costs may vary',
        'Contact IBM for enterprise pricing',
        discountData.discountPct > 0 ? `${discountData.name} discount applied` : 'On-demand pricing',
      ],
    },
  };
}

/**
 * Format currency
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Format currency with decimals
 */
export function formatCurrencyPrecise(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}
