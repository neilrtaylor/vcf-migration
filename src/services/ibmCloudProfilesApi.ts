// IBM Cloud API service for fetching VPC instance profiles and ROKS machine types
//
// VPC API: https://cloud.ibm.com/apidocs/vpc/latest#list-instance-profiles
// Kubernetes Service API: https://cloud.ibm.com/apidocs/kubernetes/containers-v1-v2

import { withRetry, isRetryableError } from '@/utils/retry';
import { createLogger, parseApiError, getUserFriendlyMessage } from '@/utils/logger';
import { deduplicateWithKey } from '@/utils/requestDeduplication';

const logger = createLogger('IBM Cloud API');

// ===== TYPES =====

export interface VPCInstanceProfile {
  name: string;
  family: string;
  vcpu_count: { type: string; value?: number; min?: number; max?: number };
  memory: { type: string; value?: number; min?: number; max?: number };
  bandwidth: { type: string; value?: number };
  os_architecture?: { type: string; values?: string[] };
  href: string;
}

export interface VPCProfilesResponse {
  profiles: VPCInstanceProfile[];
  first?: { href: string };
  limit: number;
  total_count: number;
}

export interface ROKSMachineType {
  name: string;
  cores: number;
  memory: number | string;  // MiB (number) or "384GB" (string) depending on API
  networkSpeed: number;
  serverType: string;
  trustedEnabled: boolean;
  deprecated: boolean;
  isolation: string;
  storage: {
    size: number;
    count: number;
    type: string;
  }[];
}

export interface ROKSMachineTypesResponse {
  machineTypes: ROKSMachineType[];
}

// VPC Bare Metal Server Profile types
export interface VPCBareMetalProfile {
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
  href: string;
}

export interface VPCBareMetalProfilesResponse {
  profiles: VPCBareMetalProfile[];
  total_count: number;
}

export interface TransformedProfile {
  name: string;
  family: string;
  vcpus: number;
  memoryGiB: number;
  bandwidthGbps?: number;
  physicalCores?: number;
  hasNvme?: boolean;
  nvmeDisks?: number;
  nvmeSizeGiB?: number;
  totalNvmeGiB?: number;
  roksSupported?: boolean;  // Whether this profile is available for ROKS/Kubernetes worker nodes
}

// ===== CONSTANTS =====

const VPC_API_VERSION = '2024-11-12';
const DEFAULT_TIMEOUT = 30000;

// API key from environment variable
const ENV_API_KEY = import.meta.env.VITE_IBM_CLOUD_API_KEY as string | undefined;

// Profiles proxy URL (IBM Code Engine)
const PROFILES_PROXY_URL = import.meta.env.VITE_PROFILES_PROXY_URL as string | undefined;

// Regional VPC endpoints - use proxy in development to avoid CORS
const VPC_REGIONS: Record<string, string> = import.meta.env.DEV
  ? {
      'us-south': '/api/vpc/us-south',
      'us-east': '/api/vpc/us-east',
      'eu-de': '/api/vpc/eu-de',
      'eu-gb': '/api/vpc/eu-gb',
      'eu-es': '/api/vpc/eu-es',
      'jp-tok': '/api/vpc/jp-tok',
      'jp-osa': '/api/vpc/jp-osa',
      'au-syd': '/api/vpc/au-syd',
      'ca-tor': '/api/vpc/ca-tor',
      'br-sao': '/api/vpc/br-sao',
    }
  : {
      'us-south': 'https://us-south.iaas.cloud.ibm.com',
      'us-east': 'https://us-east.iaas.cloud.ibm.com',
      'eu-de': 'https://eu-de.iaas.cloud.ibm.com',
      'eu-gb': 'https://eu-gb.iaas.cloud.ibm.com',
      'eu-es': 'https://eu-es.iaas.cloud.ibm.com',
      'jp-tok': 'https://jp-tok.iaas.cloud.ibm.com',
      'jp-osa': 'https://jp-osa.iaas.cloud.ibm.com',
      'au-syd': 'https://au-syd.iaas.cloud.ibm.com',
      'ca-tor': 'https://ca-tor.iaas.cloud.ibm.com',
      'br-sao': 'https://br-sao.iaas.cloud.ibm.com',
    };

// Kubernetes Service API endpoint - use proxy in development
const KUBERNETES_API_URL = import.meta.env.DEV
  ? '/api/kubernetes'
  : 'https://containers.cloud.ibm.com/global/v2';

// IAM token endpoint
const IAM_TOKEN_URL = import.meta.env.DEV
  ? '/api/iam/token'
  : 'https://iam.cloud.ibm.com/identity/token';

// Cached IAM token
let cachedIamToken: { token: string; expiry: number } | null = null;

/**
 * Check if API key is configured
 */
export function isApiKeyConfigured(): boolean {
  return !!ENV_API_KEY;
}

/**
 * Check if profiles proxy is configured
 */
export function isProfilesProxyConfigured(): boolean {
  return !!PROFILES_PROXY_URL;
}

/**
 * Get the profiles proxy URL
 */
export function getProfilesProxyUrl(): string | undefined {
  return PROFILES_PROXY_URL;
}

/**
 * Response from profiles proxy
 */
export interface ProxyProfilesResponse {
  version: string;
  lastUpdated: string;
  source: string;
  region: string;
  zone: string;
  vsiProfiles: Array<{
    name: string;
    family: string;
    vcpus: number;
    memoryGiB: number;
    bandwidthGbps: number;
  }>;
  bareMetalProfiles: Array<{
    name: string;
    family: string;
    vcpus: number;
    physicalCores: number;
    memoryGiB: number;
    bandwidthGbps: number;
    hasNvme: boolean;
    nvmeDisks: number;
    nvmeSizeGiB: number;
    totalNvmeGiB: number;
    roksSupported: boolean;
  }>;
  counts: {
    vsi: number;
    bareMetal: number;
    roksVSI: number;
    roksBM: number;
  };
  cached?: boolean;
  cacheAge?: number;
  error?: string;
}

/**
 * Fetch profiles from the Code Engine proxy
 */
export async function fetchFromProfilesProxy(
  options?: { refresh?: boolean; region?: string; zone?: string; timeout?: number }
): Promise<ProxyProfilesResponse> {
  if (!PROFILES_PROXY_URL) {
    throw new Error('Profiles proxy URL not configured. Set VITE_PROFILES_PROXY_URL environment variable.');
  }

  const url = new URL(PROFILES_PROXY_URL);
  if (options?.refresh) {
    url.searchParams.set('refresh', 'true');
  }
  if (options?.region) {
    url.searchParams.set('region', options.region);
  }
  if (options?.zone) {
    url.searchParams.set('zone', options.zone);
  }

  logger.info('Fetching from profiles proxy', { url: url.toString() });

  const response = await fetchWithTimeout(
    url.toString(),
    {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    },
    options?.timeout || DEFAULT_TIMEOUT
  );

  if (!response.ok) {
    const apiError = await parseApiError(response, 'Profiles proxy');
    throw new Error(apiError.message);
  }

  const data = await response.json();

  logger.info('Profiles proxy response received', {
    cached: data.cached,
    cacheAge: data.cacheAge,
    source: data.source,
    vsiProfiles: data.counts?.vsi || data.vsiProfiles?.length || 0,
    bareMetalProfiles: data.counts?.bareMetal || data.bareMetalProfiles?.length || 0,
  });

  return data;
}

// ===== HELPER FUNCTIONS =====

async function getIamToken(apiKey: string): Promise<string> {
  // Check if we have a valid cached token (with 5 min buffer)
  if (cachedIamToken && cachedIamToken.expiry > Date.now() + 300000) {
    logger.debug('Using cached IAM token');
    return cachedIamToken.token;
  }

  logger.info('Fetching new IAM token...');

  return withRetry(
    async () => {
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
        const apiError = await parseApiError(response, 'IAM authentication');
        throw new Error(apiError.message);
      }

      const data = await response.json();

      cachedIamToken = {
        token: data.access_token,
        expiry: Date.now() + (data.expires_in * 1000),
      };

      logger.info('IAM token obtained successfully');
      return data.access_token;
    },
    {
      maxRetries: 2,
      initialDelayMs: 1000,
      onRetry: (error, attempt, delayMs) => {
        logger.warn(`IAM token request failed, retrying (attempt ${attempt})`, {
          error: error.message,
          delayMs,
        });
      },
    }
  );
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeout: number = DEFAULT_TIMEOUT
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

// ===== VPC INSTANCE PROFILES API =====

/**
 * Fetch VPC instance profiles from the IBM Cloud VPC API
 *
 * API Endpoint: GET /v1/instance/profiles
 * Documentation: https://cloud.ibm.com/apidocs/vpc/latest#list-instance-profiles
 *
 * @param region - The IBM Cloud region (e.g., 'us-south')
 * @param apiKey - IBM Cloud API key for authentication
 */
export async function fetchVPCInstanceProfiles(
  region: string = 'us-south',
  apiKey?: string
): Promise<VPCProfilesResponse> {
  const baseUrl = VPC_REGIONS[region];
  if (!baseUrl) {
    throw new Error(`Unknown region: ${region}. Valid regions: ${Object.keys(VPC_REGIONS).join(', ')}`);
  }

  // Use provided API key or environment variable
  const effectiveApiKey = apiKey || ENV_API_KEY;

  if (!effectiveApiKey) {
    logger.warn('No API key configured. Set VITE_IBM_CLOUD_API_KEY in .env file.');
    throw new Error('API key required. Set VITE_IBM_CLOUD_API_KEY environment variable.');
  }

  const url = `${baseUrl}/v1/instance/profiles?version=${VPC_API_VERSION}&generation=2`;

  logger.info('Fetching VPC instance profiles', { region });

  return withRetry(
    async () => {
      const headers: HeadersInit = {
        'Accept': 'application/json',
      };

      // Get IAM token for authentication
      const token = await getIamToken(effectiveApiKey);
      headers['Authorization'] = `Bearer ${token}`;

      const response = await fetchWithTimeout(url, { method: 'GET', headers });

      if (!response.ok) {
        const apiError = await parseApiError(response, 'VPC Instance Profiles');
        logger.error('VPC API error', new Error(apiError.message), { region, status: apiError.status });
        throw new Error(apiError.message);
      }

      const data = await response.json();
      logger.info('Fetched VPC profiles', { count: data.total_count });

      return data;
    },
    {
      maxRetries: 3,
      initialDelayMs: 1000,
      onRetry: (error, attempt, delayMs) => {
        logger.warn(`VPC profiles fetch failed, retrying (attempt ${attempt})`, {
          region,
          error: error.message,
          delayMs,
        });
      },
      retryableErrors: (error) => {
        // Don't retry auth errors
        if (error.message.includes('not_authorized') || error.message.includes('403')) {
          return false;
        }
        return isRetryableError(error);
      },
    }
  );
}

/**
 * Transform VPC API profiles to our internal format
 */
export function transformVPCProfiles(profiles: VPCInstanceProfile[]): Record<string, TransformedProfile[]> {
  const grouped: Record<string, TransformedProfile[]> = {
    balanced: [],
    compute: [],
    memory: [],
    veryHighMemory: [],
    ultraHighMemory: [],
    gpu: [],
    other: [],
  };

  for (const profile of profiles) {
    const transformed: TransformedProfile = {
      name: profile.name,
      family: profile.family,
      vcpus: profile.vcpu_count.value || profile.vcpu_count.min || 0,
      memoryGiB: Math.round((profile.memory.value || profile.memory.min || 0) / 1024), // Convert MiB to GiB
      bandwidthGbps: profile.bandwidth?.value,
    };

    // Categorize by family/prefix
    const prefix = profile.name.split('-')[0];
    if (prefix.startsWith('bx') || prefix.startsWith('bz')) {
      grouped.balanced.push(transformed);
    } else if (prefix.startsWith('cx') || prefix.startsWith('cz')) {
      grouped.compute.push(transformed);
    } else if (prefix.startsWith('mx') || prefix.startsWith('mz')) {
      grouped.memory.push(transformed);
    } else if (prefix.startsWith('vx')) {
      grouped.veryHighMemory.push(transformed);
    } else if (prefix.startsWith('ux')) {
      grouped.ultraHighMemory.push(transformed);
    } else if (prefix.startsWith('gx') || prefix.startsWith('gp')) {
      grouped.gpu.push(transformed);
    } else {
      grouped.other.push(transformed);
    }
  }

  // Sort each group by vcpus
  for (const family of Object.keys(grouped)) {
    grouped[family].sort((a, b) => a.vcpus - b.vcpus);
  }

  return grouped;
}

// ===== VPC BARE METAL SERVER PROFILES API =====

/**
 * Fetch VPC Bare Metal Server profiles from the IBM Cloud VPC API
 *
 * API Endpoint: GET /v1/bare_metal_server/profiles
 * Documentation: https://cloud.ibm.com/apidocs/vpc/latest#list-bare-metal-server-profiles
 *
 * @param region - The IBM Cloud region (e.g., 'us-south')
 * @param apiKey - IBM Cloud API key for authentication
 */
export async function fetchVPCBareMetalProfiles(
  region: string = 'us-south',
  apiKey?: string
): Promise<VPCBareMetalProfilesResponse> {
  const baseUrl = VPC_REGIONS[region];
  if (!baseUrl) {
    throw new Error(`Unknown region: ${region}. Valid regions: ${Object.keys(VPC_REGIONS).join(', ')}`);
  }

  const effectiveApiKey = apiKey || ENV_API_KEY;

  if (!effectiveApiKey) {
    logger.warn('No API key configured for Bare Metal API.');
    throw new Error('API key required. Set VITE_IBM_CLOUD_API_KEY environment variable.');
  }

  const url = `${baseUrl}/v1/bare_metal_server/profiles?version=${VPC_API_VERSION}&generation=2`;

  logger.info('Fetching VPC bare metal profiles', { region });

  return withRetry(
    async () => {
      const headers: HeadersInit = {
        'Accept': 'application/json',
      };

      const token = await getIamToken(effectiveApiKey);
      headers['Authorization'] = `Bearer ${token}`;

      const response = await fetchWithTimeout(url, { method: 'GET', headers });

      if (!response.ok) {
        const apiError = await parseApiError(response, 'Bare Metal Profiles');
        logger.error('Bare Metal API error', new Error(apiError.message), { region, status: apiError.status });
        throw new Error(apiError.message);
      }

      const data = await response.json();
      logger.info('Fetched bare metal profiles', { count: data.total_count });

      return data;
    },
    {
      maxRetries: 3,
      initialDelayMs: 1000,
      onRetry: (error, attempt, delayMs) => {
        logger.warn(`Bare metal profiles fetch failed, retrying (attempt ${attempt})`, {
          region,
          error: error.message,
          delayMs,
        });
      },
      retryableErrors: (error) => {
        // Don't retry auth errors
        if (error.message.includes('not_authorized') || error.message.includes('403')) {
          return false;
        }
        return isRetryableError(error);
      },
    }
  );
}

/**
 * Transform VPC Bare Metal profiles to our internal format
 */
export function transformVPCBareMetalProfiles(profiles: VPCBareMetalProfile[]): TransformedProfile[] {
  const result: TransformedProfile[] = [];

  logger.info('Transforming VPC Bare Metal profiles', { count: profiles.length });

  for (const profile of profiles) {
    // Log raw API data for debugging
    logger.debug(`Raw API profile: ${profile.name}`, {
      cpu_core_count: profile.cpu_core_count,
      cpu_socket_count: profile.cpu_socket_count,
      memory: profile.memory,
      bandwidth: profile.bandwidth,
      disks: profile.disks,
    });

    // Find NVMe storage disk (skip boot disks with size 480 or 960)
    const storageDisk = profile.disks.find(d =>
      (d.supported_interface_types.default === 'nvme' ||
       d.supported_interface_types.values?.includes('nvme')) &&
      d.size.value > 1000
    );

    const hasNvme = !!storageDisk;
    const nvmeDisks = storageDisk?.quantity.value || 0;
    const nvmeSizeGiB = storageDisk?.size.value || 0;

    const transformed: TransformedProfile = {
      name: profile.name,
      family: getFamilyFromName(profile.name),
      vcpus: profile.cpu_core_count.value * 2, // Hyperthreading
      memoryGiB: profile.memory.value,
      physicalCores: profile.cpu_core_count.value,
      bandwidthGbps: profile.bandwidth?.value ? profile.bandwidth.value / 1000 : undefined,
      hasNvme,
      nvmeDisks: hasNvme ? nvmeDisks : undefined,
      nvmeSizeGiB: hasNvme ? nvmeSizeGiB : undefined,
      totalNvmeGiB: hasNvme ? nvmeDisks * nvmeSizeGiB : undefined,
    };

    // Log transformed profile
    logger.debug(`Transformed profile: ${transformed.name}`, {
      physicalCores: transformed.physicalCores,
      vcpus: transformed.vcpus,
      memoryGiB: transformed.memoryGiB,
      hasNvme: transformed.hasNvme,
      nvmeDisks: transformed.nvmeDisks,
      nvmeSizeGiB: transformed.nvmeSizeGiB,
      totalNvmeGiB: transformed.totalNvmeGiB,
    });

    result.push(transformed);
  }

  // Log summary table of all profiles
  console.groupCollapsed('[IBM Cloud API] Bare Metal Profiles Summary (click to expand)');
  console.table(result.map(p => ({
    name: p.name,
    physicalCores: p.physicalCores,
    vcpus: p.vcpus,
    memoryGiB: p.memoryGiB,
    hasNvme: p.hasNvme,
    nvmeDisks: p.nvmeDisks,
    nvmeSizeGiB: p.nvmeSizeGiB,
    totalNvmeGiB: p.totalNvmeGiB,
  })));
  console.groupEnd();

  // Sort by vcpus
  return result.sort((a, b) => a.vcpus - b.vcpus);
}

// ===== KUBERNETES SERVICE FLAVORS API =====

/**
 * Fetch ROKS/Kubernetes flavors from the IBM Cloud Kubernetes Service API
 *
 * CLI Equivalent: ibmcloud ks flavors --zone <zone> --provider vpc-gen2
 * API Endpoint: GET /global/v2/getFlavors
 * Documentation: https://cloud.ibm.com/apidocs/kubernetes/containers-v1-v2
 *
 * @param zone - The availability zone (e.g., 'us-south-1')
 * @param provider - The provider type ('vpc-gen2' for VPC)
 * @param apiKey - IBM Cloud API key for authentication
 */
export async function fetchROKSMachineTypes(
  zone: string,
  provider: string = 'vpc-gen2',
  apiKey?: string
): Promise<ROKSMachineTypesResponse> {
  // Use provided API key or environment variable
  const effectiveApiKey = apiKey || ENV_API_KEY;

  if (!effectiveApiKey) {
    logger.warn('No API key configured for ROKS API.');
    throw new Error('API key required. Set VITE_IBM_CLOUD_API_KEY environment variable.');
  }

  // Use getFlavors endpoint instead of getMachineTypes
  const url = `${KUBERNETES_API_URL}/getFlavors?zone=${encodeURIComponent(zone)}&provider=${encodeURIComponent(provider)}`;

  logger.info('Fetching ROKS flavors', { zone, provider });

  return withRetry(
    async () => {
      const headers: HeadersInit = {
        'Accept': 'application/json',
      };

      const token = await getIamToken(effectiveApiKey);
      headers['Authorization'] = `Bearer ${token}`;

      const response = await fetchWithTimeout(url, { method: 'GET', headers });

      if (!response.ok) {
        const apiError = await parseApiError(response, 'ROKS Flavors');
        logger.error('ROKS API error', new Error(apiError.message), { zone, status: apiError.status });
        throw new Error(apiError.message);
      }

      const data = await response.json();

      // getFlavors returns an array directly, wrap it for compatibility
      const result: ROKSMachineTypesResponse = {
        machineTypes: Array.isArray(data) ? data : (data.machineTypes || []),
      };

      logger.info('Fetched ROKS flavors', { count: result.machineTypes.length });

      return result;
    },
    {
      maxRetries: 3,
      initialDelayMs: 1000,
      onRetry: (error, attempt, delayMs) => {
        logger.warn(`ROKS flavors fetch failed, retrying (attempt ${attempt})`, {
          zone,
          error: error.message,
          delayMs,
        });
      },
    }
  );
}

/**
 * Parse memory value from ROKS API (can be number in MiB or string like "384GB")
 */
function parseMemoryGiB(memory: number | string): number {
  if (typeof memory === 'number') {
    return Math.round(memory / 1024); // MiB to GiB
  }
  // String format like "384GB" or "768GiB"
  const match = memory.match(/(\d+)\s*(GB|GiB|MB|MiB)?/i);
  if (match) {
    const value = parseInt(match[1], 10);
    const unit = (match[2] || 'GB').toUpperCase();
    if (unit === 'MB' || unit === 'MIB') {
      return Math.round(value / 1024);
    }
    return value; // Already in GB/GiB
  }
  return 0;
}

/**
 * Transform ROKS machine types to our internal format
 */
export function transformROKSMachineTypes(machineTypes: ROKSMachineType[]): {
  vsi: TransformedProfile[];
  bareMetal: TransformedProfile[];
} {
  const vsi: TransformedProfile[] = [];
  const bareMetal: TransformedProfile[] = [];

  logger.info('Transforming ROKS machine types', { count: machineTypes.length });

  for (const mt of machineTypes) {
    if (mt.deprecated) {
      logger.debug(`Skipping deprecated: ${mt.name}`);
      continue;
    }

    const isBM = mt.serverType === 'bare_metal' || mt.name.includes('.metal.');
    const hasNvme = mt.storage?.some(s => s.type === 'nvme') || false;

    // Log raw ROKS data for bare metal profiles
    if (isBM) {
      logger.debug(`Raw ROKS bare metal: ${mt.name}`, {
        cores: mt.cores,
        memory: mt.memory,
        serverType: mt.serverType,
        storage: mt.storage,
        networkSpeed: mt.networkSpeed,
      });
    }

    const profile: TransformedProfile = {
      name: mt.name,
      family: getFamilyFromName(mt.name),
      vcpus: mt.cores,
      memoryGiB: parseMemoryGiB(mt.memory),
      bandwidthGbps: mt.networkSpeed ? mt.networkSpeed / 1000 : undefined,
    };

    if (isBM) {
      profile.physicalCores = Math.round(mt.cores / 2); // Assuming hyperthreading
      profile.hasNvme = hasNvme;
      if (hasNvme && mt.storage) {
        const nvmeStorage = mt.storage.filter(s => s.type === 'nvme');
        profile.nvmeDisks = nvmeStorage.reduce((sum, s) => sum + s.count, 0);
        profile.nvmeSizeGiB = nvmeStorage[0]?.size || 0;
        profile.totalNvmeGiB = nvmeStorage.reduce((sum, s) => sum + (s.size * s.count), 0);
      }
      bareMetal.push(profile);
    } else {
      vsi.push(profile);
    }
  }

  // Log ROKS bare metal summary
  if (bareMetal.length > 0) {
    console.groupCollapsed('[IBM Cloud API] ROKS Bare Metal Flavors (click to expand)');
    console.table(bareMetal.map(p => ({
      name: p.name,
      physicalCores: p.physicalCores,
      vcpus: p.vcpus,
      memoryGiB: p.memoryGiB,
      hasNvme: p.hasNvme,
      nvmeDisks: p.nvmeDisks,
      nvmeSizeGiB: p.nvmeSizeGiB,
      totalNvmeGiB: p.totalNvmeGiB,
    })));
    console.groupEnd();
  }

  return {
    vsi: vsi.sort((a, b) => a.vcpus - b.vcpus),
    bareMetal: bareMetal.sort((a, b) => a.vcpus - b.vcpus),
  };
}

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

// ===== COMBINED FETCH =====

export interface ProfilesApiResult {
  vpcProfiles: Record<string, TransformedProfile[]>;
  roksMachineTypes: {
    vsi: TransformedProfile[];
    bareMetal: TransformedProfile[];
  };
  fetchedAt: string;
  region: string;
  zone: string;
}

/**
 * Errors encountered during fetchAllProfiles
 */
export interface ProfilesFetchErrors {
  vpc?: string;
  roks?: string;
  bareMetal?: string;
}

/**
 * Fetch all profiles from both VPC and Kubernetes Service APIs
 * Returns partial results if some APIs fail, with error details
 *
 * @param region - IBM Cloud region (e.g., 'us-south')
 * @param zone - Availability zone (e.g., 'us-south-1')
 * @param apiKey - IBM Cloud API key
 */
export async function fetchAllProfiles(
  region: string = 'us-south',
  zone?: string,
  apiKey?: string
): Promise<ProfilesApiResult & { errors: ProfilesFetchErrors; hasErrors: boolean }> {
  const effectiveZone = zone || `${region}-1`;

  logger.info('Fetching all profiles', { region, zone: effectiveZone });

  const errors: ProfilesFetchErrors = {};

  const [vpcResponse, bareMetalResponse, roksResponse] = await Promise.all([
    fetchVPCInstanceProfiles(region, apiKey).catch(err => {
      const message = getUserFriendlyMessage(err);
      errors.vpc = message;
      logger.error('Failed to fetch VPC profiles', err);
      return null;
    }),
    fetchVPCBareMetalProfiles(region, apiKey).catch(err => {
      const message = getUserFriendlyMessage(err);
      errors.bareMetal = message;
      logger.error('Failed to fetch VPC bare metal profiles', err);
      return null;
    }),
    fetchROKSMachineTypes(effectiveZone, 'vpc-gen2', apiKey).catch(err => {
      const message = getUserFriendlyMessage(err);
      errors.roks = message;
      logger.error('Failed to fetch ROKS machine types', err);
      return null;
    }),
  ]);

  const vpcProfiles = vpcResponse
    ? transformVPCProfiles(vpcResponse.profiles)
    : { balanced: [], compute: [], memory: [], veryHighMemory: [], ultraHighMemory: [], gpu: [], other: [] };

  const vpcBareMetalProfiles = bareMetalResponse
    ? transformVPCBareMetalProfiles(bareMetalResponse.profiles)
    : [];

  const roksMachineTypes = roksResponse
    ? transformROKSMachineTypes(roksResponse.machineTypes)
    : { vsi: [], bareMetal: [] };

  const hasErrors = Object.keys(errors).length > 0;

  if (hasErrors) {
    logger.warn('Profiles fetch completed with errors', { errors });
  } else {
    logger.info('All profiles fetched successfully', {
      vpcProfiles: Object.values(vpcProfiles).flat().length,
      bareMetalProfiles: vpcBareMetalProfiles.length,
      roksFlavors: roksMachineTypes.vsi.length + roksMachineTypes.bareMetal.length,
    });
  }

  return {
    vpcProfiles,
    roksMachineTypes,
    fetchedAt: new Date().toISOString(),
    region,
    zone: effectiveZone,
    errors,
    hasErrors,
  };
}

/**
 * Test API connectivity
 */
export async function testProfilesApiConnection(
  region: string = 'us-south',
  apiKey?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetchVPCInstanceProfiles(region, apiKey);
    const success = response.total_count > 0;
    logger.info(`Connection test result: ${success ? 'SUCCESS' : 'NO DATA'}`);
    return { success };
  } catch (error) {
    const message = getUserFriendlyMessage(error instanceof Error ? error : new Error(String(error)));
    logger.error('Connection test failed', error instanceof Error ? error : new Error(String(error)));
    return { success: false, error: message };
  }
}

// ===== DEDUPLICATED EXPORTS =====
// These prevent duplicate concurrent API calls

/**
 * Deduplicated version of fetchAllProfiles.
 * If called multiple times concurrently with the same region/zone/apiKey, only one API request is made.
 */
export const fetchAllProfilesDeduped = deduplicateWithKey(
  fetchAllProfiles,
  (region, zone, apiKey) => `fetchAllProfiles:${region}:${zone || ''}:${apiKey ? 'withKey' : 'noKey'}`
);

/**
 * Deduplicated version of fetchVPCInstanceProfiles.
 */
export const fetchVPCInstanceProfilesDeduped = deduplicateWithKey(
  fetchVPCInstanceProfiles,
  (region, apiKey) => `fetchVPCInstanceProfiles:${region}:${apiKey ? 'withKey' : 'noKey'}`
);

/**
 * Deduplicated version of fetchVPCBareMetalProfiles.
 */
export const fetchVPCBareMetalProfilesDeduped = deduplicateWithKey(
  fetchVPCBareMetalProfiles,
  (region, apiKey) => `fetchVPCBareMetalProfiles:${region}:${apiKey ? 'withKey' : 'noKey'}`
);
