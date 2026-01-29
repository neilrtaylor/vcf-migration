// IBM Cloud API service for fetching VPC instance profiles
// Uses Code Engine proxy only - no direct browser API access

import { createLogger, parseApiError, getUserFriendlyMessage } from '@/utils/logger';

const logger = createLogger('IBM Cloud API');

// ===== TYPES =====

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
  isCustom?: boolean;       // Whether this is a custom (non-IBM Cloud) profile
  tag?: string;             // Custom display tag (e.g., "On-Prem", "Lab")
}

// ===== CONSTANTS =====

const DEFAULT_TIMEOUT = 30000;

// Profiles proxy URL (IBM Code Engine)
const PROFILES_PROXY_URL = import.meta.env.VITE_PROFILES_PROXY_URL as string | undefined;

// ===== HELPER FUNCTIONS =====

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

// ===== PROXY TYPES =====

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

// ===== PROXY FUNCTIONS =====

/**
 * Fetch profiles from the Code Engine proxy
 * This is the only method available - keeps API credentials server-side
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

/**
 * Test proxy connectivity
 * Returns { success: boolean, error?: string, cancelled?: boolean }
 * cancelled is true when the request was aborted (e.g., React StrictMode cleanup)
 */
export async function testProfilesProxyConnection(): Promise<{ success: boolean; error?: string; cancelled?: boolean }> {
  if (!PROFILES_PROXY_URL) {
    logger.info('Profiles proxy not configured');
    return { success: false, error: 'Profiles proxy URL not configured' };
  }

  logger.info('Testing profiles proxy connectivity...');

  try {
    const data = await fetchFromProfilesProxy({ timeout: 10000 });
    const isAvailable = data.vsiProfiles && data.vsiProfiles.length > 0;
    logger.info(`Profiles proxy test result: ${isAvailable ? 'SUCCESS' : 'NO DATA'}`);
    return { success: isAvailable };
  } catch (error) {
    // Handle AbortError specially - this happens during React StrictMode cleanup
    // and should not be treated as a real connectivity failure
    if (error instanceof Error && error.name === 'AbortError') {
      logger.debug('Profiles proxy test cancelled (AbortError)');
      return { success: false, cancelled: true };
    }
    const message = getUserFriendlyMessage(error instanceof Error ? error : new Error(String(error)));
    logger.error('Profiles proxy test FAILED', error instanceof Error ? error : new Error(String(error)));
    return { success: false, error: message };
  }
}
