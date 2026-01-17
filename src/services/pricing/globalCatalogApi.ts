// IBM Cloud Global Catalog API client for fetching pricing data
// Supports both direct API access and Cloud Functions proxy

import { withRetry, isRetryableError } from '@/utils/retry';
import { createLogger, parseApiError, isCorsError, getUserFriendlyMessage } from '@/utils/logger';
import { deduplicate } from '@/utils/requestDeduplication';

const logger = createLogger('Pricing API');

// ===== TYPES =====

export interface GlobalCatalogConfig {
  apiKey?: string;
  timeout?: number;
}

export interface CatalogResource {
  id: string;
  name: string;
  kind: string;
  active: boolean;
  disabled: boolean;
  geo_tags?: string[];
  pricing_tags?: string[];
  metadata?: {
    ui?: {
      strings?: {
        en?: {
          display_name?: string;
          description?: string;
        };
      };
    };
    service?: {
      id?: string;
      type?: string;
    };
    pricing?: {
      type?: string;
      origin?: string;
      starting_price?: Record<string, unknown>;
      metrics?: PricingMetric[];
    };
  };
}

export interface PricingMetric {
  metric_id: string;
  tier_model?: string;
  resource_display_name?: string;
  charge_unit_display_name?: string;
  charge_unit_name?: string;
  charge_unit?: string;
  amounts?: PricingAmount[];
}

export interface PricingAmount {
  country: string;
  currency: string;
  prices: PriceTier[];
}

export interface PriceTier {
  quantity_tier: number;
  price: number;
}

export interface CatalogResponse {
  offset: number;
  limit: number;
  count: number;
  resource_count: number;
  resources: CatalogResource[];
}

export interface PricingDeployment {
  deployment_id: string;
  deployment_location: string;
  deployment_location_display_name: string;
  metrics: PricingMetric[];
}

export interface PricingResponse {
  deployment_id?: string;
  metrics?: PricingMetric[];
  origin?: string;
  type?: string;
}

// ===== CONSTANTS =====

// Use proxy in development to avoid CORS, direct URL in production
const GLOBAL_CATALOG_BASE_URL = import.meta.env.DEV
  ? '/api/globalcatalog'  // Proxied through Vite dev server
  : 'https://globalcatalog.cloud.ibm.com/api/v1';

const DEFAULT_TIMEOUT = 30000; // 30 seconds

// API key from environment variable
const ENV_API_KEY = import.meta.env.VITE_IBM_CLOUD_API_KEY as string | undefined;

// Pricing proxy URL (IBM Cloud Functions)
const PRICING_PROXY_URL = import.meta.env.VITE_PRICING_PROXY_URL as string | undefined;

// IAM token endpoint (also needs proxy in dev)
const IAM_TOKEN_URL = import.meta.env.DEV
  ? '/api/iam/token'
  : 'https://iam.cloud.ibm.com/identity/token';

// Cache for IAM token
let cachedIamToken: { token: string; expiry: number } | null = null;

// ===== API FUNCTIONS =====

/**
 * Get IAM access token from API key
 */
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

      // Cache the token
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

/**
 * Build headers for API request
 */
async function buildHeaders(config?: GlobalCatalogConfig): Promise<HeadersInit> {
  const headers: HeadersInit = {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
  };

  // Use API key from config or environment
  const apiKey = config?.apiKey || ENV_API_KEY;

  if (apiKey) {
    try {
      const token = await getIamToken(apiKey);
      headers['Authorization'] = `Bearer ${token}`;
      logger.debug('Using authenticated request');
    } catch (error) {
      logger.warn('Failed to get IAM token, continuing without auth', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  } else {
    logger.debug('No API key configured, using unauthenticated request');
  }

  return headers;
}

/**
 * Fetch with timeout support
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeout: number
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

/**
 * Search the Global Catalog
 */
export async function searchCatalog(
  query: string,
  config?: GlobalCatalogConfig
): Promise<CatalogResponse> {
  const params = new URLSearchParams({
    q: query,
    include: 'metadata.pricing',
    _limit: '200',
  });

  const url = `${GLOBAL_CATALOG_BASE_URL}?${params.toString()}`;
  const timeout = config?.timeout || DEFAULT_TIMEOUT;

  logger.info('Searching catalog', { query });

  return withRetry(
    async () => {
      const headers = await buildHeaders(config);
      const response = await fetchWithTimeout(
        url,
        {
          method: 'GET',
          headers,
        },
        timeout
      );

      if (!response.ok) {
        const apiError = await parseApiError(response, 'Global Catalog search');
        logger.error('Catalog search failed', new Error(apiError.message), { query, status: apiError.status });
        throw new Error(apiError.message);
      }

      const data = await response.json();
      logger.info('Search successful', { query, resourceCount: data.resource_count });
      return data;
    },
    {
      maxRetries: 3,
      initialDelayMs: 1000,
      onRetry: (error, attempt, delayMs) => {
        logger.warn(`Catalog search failed, retrying (attempt ${attempt})`, {
          query,
          error: error.message,
          delayMs,
        });
      },
      retryableErrors: (error) => {
        // Don't retry CORS errors
        if (isCorsError(error)) {
          logger.error('CORS or network error - API may be blocked by browser security policy', error, {
            suggestion: 'Use a proxy server or configure CORS headers',
          });
          return false;
        }
        return isRetryableError(error);
      },
    }
  );
}

/**
 * Get pricing for a specific catalog entry
 */
export async function getPricing(
  id: string,
  config?: GlobalCatalogConfig
): Promise<PricingResponse> {
  const url = `${GLOBAL_CATALOG_BASE_URL}/${encodeURIComponent(id)}/pricing`;
  const timeout = config?.timeout || DEFAULT_TIMEOUT;

  return withRetry(
    async () => {
      const headers = await buildHeaders(config);
      const response = await fetchWithTimeout(
        url,
        {
          method: 'GET',
          headers,
        },
        timeout
      );

      if (!response.ok) {
        const apiError = await parseApiError(response, 'Get pricing');
        logger.error('Failed to get pricing', new Error(apiError.message), { id, status: apiError.status });
        throw new Error(apiError.message);
      }

      return response.json();
    },
    {
      maxRetries: 3,
      initialDelayMs: 1000,
      onRetry: (error, attempt, delayMs) => {
        logger.warn(`Get pricing failed, retrying (attempt ${attempt})`, {
          id,
          error: error.message,
          delayMs,
        });
      },
    }
  );
}

/**
 * Fetch VSI profiles from Global Catalog
 */
export async function fetchVSIProfiles(config?: GlobalCatalogConfig): Promise<CatalogResource[]> {
  // Search for VPC VSI instance profiles
  const response = await searchCatalog('is.instance', config);

  // Filter for active VSI profiles (kind is 'instance.profile')
  return response.resources.filter(
    (r) => r.active && !r.disabled && r.kind === 'instance.profile'
  );
}

/**
 * Fetch block storage profiles from Global Catalog
 */
export async function fetchBlockStorageProfiles(config?: GlobalCatalogConfig): Promise<CatalogResource[]> {
  // Search for VPC block storage volume profiles
  const response = await searchCatalog('is.volume', config);

  // Filter for volume profiles
  return response.resources.filter(
    (r) => r.active && !r.disabled && r.kind === 'volume.profile'
  );
}

/**
 * Fetch bare metal profiles from Global Catalog
 */
export async function fetchBareMetalProfiles(config?: GlobalCatalogConfig): Promise<CatalogResource[]> {
  // Search for bare metal server profiles
  const response = await searchCatalog('is.bare-metal-server', config);

  // Filter for bare metal profiles
  return response.resources.filter(
    (r) => r.active && !r.disabled && r.kind === 'bare_metal_server.profile'
  );
}

/**
 * Errors encountered during fetchAllCatalogPricing
 */
export interface CatalogFetchErrors {
  vsi?: string;
  bareMetal?: string;
  blockStorage?: string;
}

/**
 * Fetch all pricing data from Global Catalog
 * Returns partial results if some APIs fail, with error details
 */
export async function fetchAllCatalogPricing(
  config?: GlobalCatalogConfig
): Promise<{
  vsi: CatalogResource[];
  bareMetal: CatalogResource[];
  blockStorage: CatalogResource[];
  errors: CatalogFetchErrors;
  hasErrors: boolean;
}> {
  logger.info('Fetching all catalog pricing data...');

  const errors: CatalogFetchErrors = {};

  // Fetch all resource types in parallel
  const [vsi, bareMetal, blockStorage] = await Promise.all([
    fetchVSIProfiles(config).catch((err) => {
      const message = getUserFriendlyMessage(err);
      errors.vsi = message;
      logger.error('Failed to fetch VSI profiles', err);
      return [];
    }),
    fetchBareMetalProfiles(config).catch((err) => {
      const message = getUserFriendlyMessage(err);
      errors.bareMetal = message;
      logger.error('Failed to fetch Bare Metal profiles', err);
      return [];
    }),
    fetchBlockStorageProfiles(config).catch((err) => {
      const message = getUserFriendlyMessage(err);
      errors.blockStorage = message;
      logger.error('Failed to fetch Block Storage profiles', err);
      return [];
    }),
  ]);

  const hasErrors = Object.keys(errors).length > 0;

  if (hasErrors) {
    logger.warn('Catalog fetch completed with errors', { errors });
  } else {
    logger.info('Fetch complete', {
      vsiProfiles: vsi.length,
      bareMetalProfiles: bareMetal.length,
      blockStorageProfiles: blockStorage.length,
    });
  }

  return { vsi, bareMetal, blockStorage, errors, hasErrors };
}

/**
 * Test API connectivity
 */
export async function testApiConnection(config?: GlobalCatalogConfig): Promise<{ success: boolean; error?: string }> {
  logger.info('Testing API connectivity...');
  try {
    const response = await searchCatalog('is.instance', { ...config, timeout: 10000 });
    const isAvailable = response.resource_count > 0;
    logger.info(`Connection test result: ${isAvailable ? 'SUCCESS' : 'NO DATA'}`);
    return { success: isAvailable };
  } catch (error) {
    const message = getUserFriendlyMessage(error instanceof Error ? error : new Error(String(error)));
    logger.error('Connection test FAILED', error instanceof Error ? error : new Error(String(error)));
    return { success: false, error: message };
  }
}

// ===== PROXY FUNCTIONS =====

/**
 * Pricing data structure returned by the proxy
 */
export interface ProxyPricingResponse {
  version: string;
  lastUpdated: string;
  source: string;
  cached: boolean;
  cacheAge?: number;
  stale?: boolean;
  error?: string;
  regions: Record<string, { name: string; multiplier: number }>;
  discountOptions: Record<string, { name: string; discountPct: number }>;
  vsiProfiles: Record<string, { vcpus: number; memoryGiB: number; hourlyRate: number }>;
  blockStorage: {
    generalPurpose: { costPerGBMonth: number; iopsPerGB: number };
    custom: { costPerGBMonth: number; costPerIOPS: number };
    tiers: Record<string, { costPerGBMonth: number; iopsPerGB: number }>;
  };
  bareMetal: Record<string, { vcpus: number; memoryGiB: number; storageGiB: number; monthlyRate: number }>;
  roks: { clusterManagementFee: number; workerNodeMarkup: number };
  odf: { perTBMonth: number; minimumTB: number };
  networking: {
    loadBalancer: { perLBMonthly: number; perGBProcessed: number };
    floatingIP: { monthlyRate: number };
    vpnGateway: { monthlyRate: number };
  };
}

/**
 * Check if pricing proxy is configured
 */
export function isProxyConfigured(): boolean {
  return !!PRICING_PROXY_URL;
}

/**
 * Get the proxy URL
 */
export function getProxyUrl(): string | undefined {
  return PRICING_PROXY_URL;
}

/**
 * Fetch pricing data from the Cloud Functions proxy
 * This is the preferred method as it keeps API credentials server-side
 */
export async function fetchFromProxy(
  options?: { refresh?: boolean; timeout?: number }
): Promise<ProxyPricingResponse> {
  if (!PRICING_PROXY_URL) {
    throw new Error('Pricing proxy URL not configured. Set VITE_PRICING_PROXY_URL environment variable.');
  }

  const url = new URL(PRICING_PROXY_URL);
  if (options?.refresh) {
    url.searchParams.set('refresh', 'true');
  }

  const timeout = options?.timeout || DEFAULT_TIMEOUT;

  logger.info('Fetching from proxy');

  return withRetry(
    async () => {
      const response = await fetchWithTimeout(
        url.toString(),
        {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
          },
        },
        timeout
      );

      if (!response.ok) {
        const apiError = await parseApiError(response, 'Proxy request');
        throw new Error(apiError.message);
      }

      const data = await response.json();

      logger.info('Proxy response received', {
        cached: data.cached,
        cacheAge: data.cacheAge,
        source: data.source,
        vsiProfiles: Object.keys(data.vsiProfiles || {}).length,
      });

      return data;
    },
    {
      maxRetries: 2,
      initialDelayMs: 1000,
      onRetry: (error, attempt, delayMs) => {
        logger.warn(`Proxy fetch failed, retrying (attempt ${attempt})`, {
          error: error.message,
          delayMs,
        });
      },
    }
  );
}

/**
 * Test proxy connectivity
 */
export async function testProxyConnection(): Promise<{ success: boolean; error?: string }> {
  if (!PRICING_PROXY_URL) {
    logger.info('Proxy not configured');
    return { success: false, error: 'Proxy URL not configured' };
  }

  logger.info('Testing proxy connectivity...');

  try {
    const data = await fetchFromProxy({ timeout: 10000 });
    const isAvailable = !!data.vsiProfiles && Object.keys(data.vsiProfiles).length > 0;
    logger.info(`Proxy test result: ${isAvailable ? 'SUCCESS' : 'NO DATA'}`);
    return { success: isAvailable };
  } catch (error) {
    const message = getUserFriendlyMessage(error instanceof Error ? error : new Error(String(error)));
    logger.error('Proxy test FAILED', error instanceof Error ? error : new Error(String(error)));
    return { success: false, error: message };
  }
}

// ===== DEDUPLICATED EXPORTS =====
// These prevent duplicate concurrent API calls

/**
 * Deduplicated version of fetchAllCatalogPricing.
 * If called multiple times concurrently with the same config, only one API request is made.
 */
export const fetchAllCatalogPricingDeduped = deduplicate(
  fetchAllCatalogPricing,
  'fetchAllCatalogPricing'
);

/**
 * Deduplicated version of fetchFromProxy.
 * If called multiple times concurrently with the same options, only one API request is made.
 */
export const fetchFromProxyDeduped = deduplicate(
  fetchFromProxy,
  'fetchFromProxy'
);
