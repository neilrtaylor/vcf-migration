// Shared HTTP client for the AI proxy
// Follows the pattern of src/services/pricing/globalCatalogApi.ts

import { withRetry } from '@/utils/retry';
import { createLogger, parseApiError, getUserFriendlyMessage } from '@/utils/logger';
import { deduplicate } from '@/utils/requestDeduplication';
import type {
  AIProxyHealthResponse,
  ClassificationRequest,
  ClassificationResponse,
  RightsizingRequest,
  RightsizingResponse,
  InsightsRequest,
  InsightsResponse,
  ChatRequest,
  ChatResponse,
  WaveSuggestionRequest,
  WaveSuggestionResponse,
  CostOptimizationRequest,
  CostOptimizationResponse,
  RemediationRequest,
  RemediationResponse,
} from './types';

const logger = createLogger('AI Proxy');

// ===== CONSTANTS =====

const DEFAULT_TIMEOUT = 60000; // 60 seconds (LLM calls can be slow)
const AI_PROXY_URL = import.meta.env.VITE_AI_PROXY_URL as string | undefined;
const AI_PROXY_API_KEY = import.meta.env.VITE_AI_PROXY_API_KEY as string | undefined;

// ===== HELPER FUNCTIONS =====

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
 * Build request headers including API key auth
 */
function getHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };

  if (AI_PROXY_API_KEY) {
    headers['X-API-Key'] = AI_PROXY_API_KEY;
  }

  return headers;
}

// ===== PROXY FUNCTIONS =====

/**
 * Check if the AI proxy is configured
 */
export function isAIProxyConfigured(): boolean {
  return !!AI_PROXY_URL;
}

/**
 * Get the AI proxy URL
 */
export function getAIProxyUrl(): string | undefined {
  return AI_PROXY_URL;
}

/**
 * Test AI proxy connectivity (health endpoint - no auth required)
 */
export async function testAIProxyConnection(): Promise<{
  success: boolean;
  error?: string;
  cancelled?: boolean;
}> {
  if (!AI_PROXY_URL) {
    logger.info('AI proxy not configured');
    return { success: false, error: 'AI proxy URL not configured' };
  }

  logger.info('Testing AI proxy connectivity...');

  try {
    const response = await fetchWithTimeout(
      `${AI_PROXY_URL}/health`,
      { method: 'GET', headers: { Accept: 'application/json' } },
      10000
    );

    if (!response.ok) {
      logger.warn('AI proxy health check failed', { status: response.status });
      return { success: false, error: `Health check returned ${response.status}` };
    }

    const data: AIProxyHealthResponse = await response.json();
    logger.info('AI proxy health check passed', { status: data.status, model: data.model });
    return { success: data.status === 'healthy' };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      logger.debug('AI proxy test cancelled (AbortError)');
      return { success: false, cancelled: true };
    }
    const message = getUserFriendlyMessage(
      error instanceof Error ? error : new Error(String(error))
    );
    logger.error('AI proxy test FAILED', error instanceof Error ? error : new Error(String(error)));
    return { success: false, error: message };
  }
}

/**
 * Generic POST request to the AI proxy
 */
async function postToProxy<TReq, TRes>(
  endpoint: string,
  body: TReq,
  options?: { timeout?: number; skipCache?: boolean }
): Promise<TRes> {
  if (!AI_PROXY_URL) {
    throw new Error('AI proxy URL not configured. Set VITE_AI_PROXY_URL environment variable.');
  }

  const timeout = options?.timeout || DEFAULT_TIMEOUT;

  logger.info(`POST ${endpoint}`);

  return withRetry(
    async () => {
      const headers = getHeaders();
      if (options?.skipCache) {
        headers['X-Skip-Cache'] = 'true';
      }

      const response = await fetchWithTimeout(
        `${AI_PROXY_URL}${endpoint}`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
        },
        timeout
      );

      if (!response.ok) {
        const apiError = await parseApiError(response, `AI proxy ${endpoint}`);
        throw new Error(apiError.message);
      }

      const data = await response.json();
      logger.info(`Response from ${endpoint}`, {
        processingTimeMs: data.processingTimeMs,
        model: data.model,
      });

      return data;
    },
    {
      maxRetries: 1, // Only 1 retry for LLM calls (expensive)
      initialDelayMs: 2000,
      onRetry: (error, attempt, delayMs) => {
        logger.warn(`AI proxy ${endpoint} failed, retrying (attempt ${attempt})`, {
          error: error.message,
          delayMs,
        });
      },
    }
  );
}

// ===== API ENDPOINTS =====

/**
 * Classify VMs using AI
 */
export async function classifyVMs(
  request: ClassificationRequest,
  options?: { timeout?: number }
): Promise<ClassificationResponse> {
  return postToProxy<ClassificationRequest, ClassificationResponse>(
    '/api/classify',
    request,
    options
  );
}

/**
 * Get right-sizing recommendations using AI
 */
export async function getRightsizingRecommendations(
  request: RightsizingRequest,
  options?: { timeout?: number }
): Promise<RightsizingResponse> {
  return postToProxy<RightsizingRequest, RightsizingResponse>(
    '/api/rightsizing',
    request,
    options
  );
}

/**
 * Get migration insights using AI
 */
export async function getMigrationInsights(
  request: InsightsRequest,
  options?: { timeout?: number; skipCache?: boolean }
): Promise<InsightsResponse> {
  return postToProxy<InsightsRequest, InsightsResponse>(
    '/api/insights',
    request,
    options
  );
}

/**
 * Send a chat message
 */
export async function sendChatMessage(
  request: ChatRequest,
  options?: { timeout?: number }
): Promise<ChatResponse> {
  return postToProxy<ChatRequest, ChatResponse>(
    '/api/chat',
    request,
    options
  );
}

/**
 * Get wave planning suggestions using AI
 */
export async function getWaveSuggestions(
  request: WaveSuggestionRequest,
  options?: { timeout?: number }
): Promise<WaveSuggestionResponse> {
  return postToProxy<WaveSuggestionRequest, WaveSuggestionResponse>(
    '/api/wave-suggestions',
    request,
    options
  );
}

/**
 * Get cost optimization recommendations using AI
 */
export async function getCostOptimization(
  request: CostOptimizationRequest,
  options?: { timeout?: number }
): Promise<CostOptimizationResponse> {
  return postToProxy<CostOptimizationRequest, CostOptimizationResponse>(
    '/api/cost-optimization',
    request,
    options
  );
}

/**
 * Get remediation guidance using AI
 */
export async function getRemediationGuidance(
  request: RemediationRequest,
  options?: { timeout?: number }
): Promise<RemediationResponse> {
  return postToProxy<RemediationRequest, RemediationResponse>(
    '/api/remediation',
    request,
    options
  );
}

// ===== DEDUPLICATED EXPORTS =====

export const classifyVMsDeduped = deduplicate(classifyVMs, 'classifyVMs');
export const getRightsizingDeduped = deduplicate(
  getRightsizingRecommendations,
  'getRightsizing'
);
export const getMigrationInsightsDeduped = deduplicate(
  getMigrationInsights,
  'getMigrationInsights'
);
