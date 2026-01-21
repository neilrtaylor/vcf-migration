#!/usr/bin/env npx tsx
/**
 * Script to update ibmCloudConfig.json with fresh profile data from IBM Cloud APIs
 *
 * Usage:
 *   npm run update-profiles
 *
 * Requires:
 *   - VITE_IBM_CLOUD_API_KEY environment variable (or IBM_CLOUD_API_KEY)
 *
 * What it does:
 *   1. Fetches VPC instance profiles from IBM Cloud VPC API
 *   2. Fetches VPC bare metal profiles from IBM Cloud VPC API
 *   3. Fetches ROKS machine types from Kubernetes Service API
 *   4. Merges the data, preserving existing pricing info
 *   5. Updates src/data/ibmCloudConfig.json
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// ES module compatibility for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const VPC_API_VERSION = '2024-11-12';
const REGION = 'us-south';
const ZONE = 'us-south-1';
const IAM_TOKEN_URL = 'https://iam.cloud.ibm.com/identity/token';
const VPC_BASE_URL = `https://${REGION}.iaas.cloud.ibm.com`;
const KUBERNETES_API_URL = 'https://containers.cloud.ibm.com/global/v2';

const CONFIG_PATH = path.join(__dirname, '..', 'src', 'data', 'ibmCloudConfig.json');

// Types
interface VPCInstanceProfile {
  name: string;
  family: string;
  vcpu_count: { type: string; value?: number; min?: number; max?: number };
  memory: { type: string; value?: number; min?: number; max?: number };
  bandwidth: { type: string; value?: number };
}

interface VPCBareMetalProfile {
  name: string;
  family: string;
  cpu_core_count: { type: string; value: number };
  cpu_socket_count: { type: string; value: number };
  memory: { type: string; value: number };
  bandwidth: { type: string; value: number };
  disks: Array<{
    quantity: { type: string; value: number };
    size: { type: string; value: number };
    supported_interface_types: { type: string; default: string; values: string[] };
  }>;
}

interface ROKSMachineType {
  name: string;
  cores: number;
  memory: number | string;
  networkSpeed: number;
  serverType: string;
  deprecated: boolean;
  storage?: Array<{ size: number; count: number; type: string }>;
}

// Get API key from environment
function getApiKey(): string {
  const apiKey = process.env.VITE_IBM_CLOUD_API_KEY || process.env.IBM_CLOUD_API_KEY;
  if (!apiKey) {
    console.error('Error: No API key found.');
    console.error('Set VITE_IBM_CLOUD_API_KEY or IBM_CLOUD_API_KEY environment variable.');
    console.error('');
    console.error('Example:');
    console.error('  export IBM_CLOUD_API_KEY=your-api-key');
    console.error('  npm run update-profiles');
    process.exit(1);
  }
  return apiKey;
}

// Get IAM token
async function getIamToken(apiKey: string): Promise<string> {
  console.log('  Authenticating with IBM Cloud IAM...');

  const response = await fetch(IAM_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json',
    },
    body: new URLSearchParams({
      grant_type: 'urn:ibm:params:oauth:grant-type:apikey',
      apikey: apiKey,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`IAM authentication failed: ${response.status} - ${text}`);
  }

  const data = await response.json();
  console.log('  Authentication successful');
  return data.access_token;
}

// Fetch VPC instance profiles
async function fetchVPCInstanceProfiles(token: string): Promise<VPCInstanceProfile[]> {
  console.log('  Fetching VPC instance profiles...');

  const url = `${VPC_BASE_URL}/v1/instance/profiles?version=${VPC_API_VERSION}&generation=2`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`VPC Instance Profiles API failed: ${response.status} - ${text}`);
  }

  const data = await response.json();
  console.log(`  Found ${data.profiles.length} VPC instance profiles`);
  return data.profiles;
}

// Fetch VPC bare metal profiles
async function fetchVPCBareMetalProfiles(token: string): Promise<VPCBareMetalProfile[]> {
  console.log('  Fetching VPC bare metal profiles...');

  const url = `${VPC_BASE_URL}/v1/bare_metal_server/profiles?version=${VPC_API_VERSION}&generation=2`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`VPC Bare Metal Profiles API failed: ${response.status} - ${text}`);
  }

  const data = await response.json();
  console.log(`  Found ${data.profiles.length} VPC bare metal profiles`);
  return data.profiles;
}

// Fetch ROKS machine types
async function fetchROKSMachineTypes(token: string): Promise<ROKSMachineType[]> {
  console.log('  Fetching ROKS machine types...');

  const url = `${KUBERNETES_API_URL}/getFlavors?zone=${encodeURIComponent(ZONE)}&provider=vpc-gen2`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`ROKS Machine Types API failed: ${response.status} - ${text}`);
  }

  const data = await response.json();
  const machineTypes = Array.isArray(data) ? data : (data.machineTypes || []);
  console.log(`  Found ${machineTypes.length} ROKS machine types`);
  return machineTypes;
}

// Helper to get family from profile name
function getFamilyFromName(name: string): string {
  const prefix = name.split('-')[0].split('.')[0];
  if (prefix.startsWith('bx') || prefix.startsWith('bz')) return 'balanced';
  if (prefix.startsWith('cx') || prefix.startsWith('cz')) return 'compute';
  if (prefix.startsWith('mx') || prefix.startsWith('mz')) return 'memory';
  if (prefix.startsWith('vx')) return 'veryHighMemory';
  if (prefix.startsWith('ux')) return 'ultraHighMemory';
  if (prefix.startsWith('gx') || prefix.startsWith('gp')) return 'gpu';
  return 'other';
}

// Transform VPC instance profiles
function transformVPCProfiles(profiles: VPCInstanceProfile[], existingConfig: any): any {
  const grouped: Record<string, any[]> = {
    balanced: [],
    compute: [],
    memory: [],
    veryHighMemory: [],
    ultraHighMemory: [],
  };

  // Build lookup of existing pricing
  const existingPricing: Record<string, { hourlyRate: number; monthlyRate: number }> = {};
  for (const family of Object.keys(existingConfig.vsiProfiles || {})) {
    for (const profile of existingConfig.vsiProfiles[family] || []) {
      existingPricing[profile.name] = {
        hourlyRate: profile.hourlyRate || 0,
        monthlyRate: profile.monthlyRate || 0,
      };
    }
  }

  for (const profile of profiles) {
    const family = getFamilyFromName(profile.name);
    if (!grouped[family]) continue; // Skip gpu, other

    const existing = existingPricing[profile.name];

    grouped[family].push({
      name: profile.name,
      vcpus: profile.vcpu_count.value || profile.vcpu_count.min || 0,
      memoryGiB: Math.round((profile.memory.value || profile.memory.min || 0) / 1024),
      bandwidthGbps: profile.bandwidth?.value || 0,
      hourlyRate: existing?.hourlyRate || 0,
      monthlyRate: existing?.monthlyRate || 0,
    });
  }

  // Sort each family by vcpus
  for (const family of Object.keys(grouped)) {
    grouped[family].sort((a, b) => a.vcpus - b.vcpus);
  }

  return grouped;
}

// Transform VPC bare metal profiles
function transformBareMetalProfiles(
  vpcProfiles: VPCBareMetalProfile[],
  roksTypes: ROKSMachineType[],
  existingConfig: any
): any {
  const grouped: Record<string, any[]> = {
    balanced: [],
    compute: [],
    memory: [],
    veryHighMemory: [],
  };

  // Build set of ROKS-supported profile names
  const roksSupported = new Set<string>();
  for (const mt of roksTypes) {
    if (mt.deprecated) continue;
    if (mt.serverType === 'bare_metal' || mt.name.includes('.metal.')) {
      // Normalize name format
      roksSupported.add(mt.name.replace(/\./g, '-'));
      roksSupported.add(mt.name);
    }
  }

  // Build lookup of existing pricing and metadata
  const existingProfiles: Record<string, any> = {};
  for (const family of Object.keys(existingConfig.bareMetalProfiles || {})) {
    for (const profile of existingConfig.bareMetalProfiles[family] || []) {
      existingProfiles[profile.name] = profile;
    }
  }

  for (const profile of vpcProfiles) {
    const family = getFamilyFromName(profile.name);
    if (!grouped[family]) grouped[family] = [];

    // Find NVMe storage disk (skip boot disks with size < 1000)
    const storageDisk = profile.disks.find(d =>
      (d.supported_interface_types.default === 'nvme' ||
        d.supported_interface_types.values?.includes('nvme')) &&
      d.size.value > 1000
    );

    const hasNvme = !!storageDisk;
    const nvmeDisks = storageDisk?.quantity.value || 0;
    const nvmeSizeGiB = storageDisk?.size.value || 0;

    // Check ROKS support
    const normalizedName = profile.name.replace(/\./g, '-');
    const isRoksSupported = roksSupported.has(normalizedName) || roksSupported.has(profile.name);

    // Get existing pricing/metadata
    const existing = existingProfiles[profile.name];

    const transformed: any = {
      name: profile.name,
      physicalCores: profile.cpu_core_count.value,
      vcpus: profile.cpu_core_count.value * 2, // Hyperthreading
      memoryGiB: profile.memory.value,
      hasNvme,
      roksSupported: isRoksSupported,
      hourlyRate: existing?.hourlyRate || 0,
      monthlyRate: existing?.monthlyRate || 0,
      useCase: existing?.useCase || '',
      description: existing?.description || '',
    };

    if (hasNvme) {
      transformed.nvmeDisks = nvmeDisks;
      transformed.nvmeSizeGiB = nvmeSizeGiB;
      transformed.totalNvmeGiB = nvmeDisks * nvmeSizeGiB;
    }

    grouped[family].push(transformed);
  }

  // Sort each family: ROKS-supported first, then by memory descending
  for (const family of Object.keys(grouped)) {
    grouped[family].sort((a, b) => {
      if (a.roksSupported !== b.roksSupported) return a.roksSupported ? -1 : 1;
      if (a.hasNvme !== b.hasNvme) return a.hasNvme ? -1 : 1;
      return b.memoryGiB - a.memoryGiB;
    });
  }

  return grouped;
}

// Main function
async function main() {
  console.log('='.repeat(60));
  console.log('IBM Cloud Profile Update Script');
  console.log('='.repeat(60));
  console.log('');

  // Get API key
  const apiKey = getApiKey();

  // Load existing config
  console.log('Loading existing configuration...');
  let existingConfig: any = {};
  try {
    const content = fs.readFileSync(CONFIG_PATH, 'utf-8');
    existingConfig = JSON.parse(content);
    console.log(`  Loaded ${CONFIG_PATH}`);
  } catch (err) {
    console.warn('  Warning: Could not load existing config, starting fresh');
  }

  try {
    // Get IAM token
    console.log('');
    console.log('Step 1: Authentication');
    const token = await getIamToken(apiKey);

    // Fetch all profiles
    console.log('');
    console.log('Step 2: Fetching profiles from IBM Cloud APIs');

    const [vpcProfiles, bareMetalProfiles, roksTypes] = await Promise.all([
      fetchVPCInstanceProfiles(token),
      fetchVPCBareMetalProfiles(token),
      fetchROKSMachineTypes(token),
    ]);

    // Transform profiles
    console.log('');
    console.log('Step 3: Transforming profile data');

    const vsiProfiles = transformVPCProfiles(vpcProfiles, existingConfig);
    const bareMetalProfilesTransformed = transformBareMetalProfiles(bareMetalProfiles, roksTypes, existingConfig);

    // Count profiles
    const vsiCount = Object.values(vsiProfiles).flat().length;
    const bmCount = Object.values(bareMetalProfilesTransformed).flat().length;
    const roksCount = (bareMetalProfilesTransformed.balanced?.filter((p: any) => p.roksSupported)?.length || 0) +
      (bareMetalProfilesTransformed.compute?.filter((p: any) => p.roksSupported)?.length || 0) +
      (bareMetalProfilesTransformed.memory?.filter((p: any) => p.roksSupported)?.length || 0);

    console.log(`  VSI profiles: ${vsiCount}`);
    console.log(`  Bare metal profiles: ${bmCount} (${roksCount} ROKS-supported)`);

    // Build new config - preserve all existing sections
    const newConfig = {
      version: new Date().toISOString().split('T')[0],
      baseCurrency: existingConfig.baseCurrency || 'USD',
      notes: 'Unified IBM Cloud configuration. Profiles can be refreshed via VPC API (GET /v1/instance/profiles) and Kubernetes Service API (GET /v2/getMachineTypes).',
      apiEndpoints: existingConfig.apiEndpoints || {
        vpc: 'https://{region}.iaas.cloud.ibm.com/v1',
        kubernetes: 'https://containers.cloud.ibm.com/global/v2',
        globalCatalog: 'https://globalcatalog.cloud.ibm.com/api/v1',
      },
      vsiProfiles,
      bareMetalProfiles: bareMetalProfilesTransformed,
      defaults: existingConfig.defaults || {
        region: 'us-south',
        cpuOvercommitRatio: 4,
        memoryOvercommitRatio: 1.0,
        odfReplicationFactor: 3,
        odfOperationalCapacity: 0.7,
        odfCephOverhead: 0.15,
        nodeRedundancy: 1,
      },
      // Preserve pricing data sections
      vsiPricing: existingConfig.vsiPricing || {},
      bareMetalPricing: existingConfig.bareMetalPricing || {},
      blockStorage: existingConfig.blockStorage,
      networking: existingConfig.networking,
      storageAddons: existingConfig.storageAddons,
      regions: existingConfig.regions,
      discounts: existingConfig.discounts,
      roks: existingConfig.roks,
      odfWorkloadProfiles: existingConfig.odfWorkloadProfiles,
      odfSizing: existingConfig.odfSizing,
      ocpVirtSizing: existingConfig.ocpVirtSizing,
    };

    // Write new config
    console.log('');
    console.log('Step 4: Writing updated configuration');

    fs.writeFileSync(CONFIG_PATH, JSON.stringify(newConfig, null, 2) + '\n');
    console.log(`  Written to ${CONFIG_PATH}`);

    // Summary
    console.log('');
    console.log('='.repeat(60));
    console.log('Update complete!');
    console.log('='.repeat(60));
    console.log('');
    console.log('Summary:');
    console.log(`  - VSI profiles: ${vsiCount}`);
    console.log(`  - Bare metal profiles: ${bmCount}`);
    console.log(`  - ROKS-supported bare metal: ${roksCount}`);
    console.log(`  - Config version: ${newConfig.version}`);
    console.log('');
    console.log('Note: Pricing data is preserved from the existing config.');
    console.log('To update pricing, use the Global Catalog API or edit manually.');

  } catch (error) {
    console.error('');
    console.error('Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
