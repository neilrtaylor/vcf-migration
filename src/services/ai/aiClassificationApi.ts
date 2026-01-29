// AI Classification API client
// Follows the pattern of src/services/pricing/globalCatalogApi.ts

import { createLogger } from '@/utils/logger';
import { isAIProxyConfigured, classifyVMs } from './aiProxyClient';
import {
  getCachedClassifications,
  setCachedClassifications,
  isClassificationCacheValid,
} from './aiClassificationCache';
import type {
  VMClassificationInput,
  VMClassificationResult,
  ClassificationRequest,
} from './types';

const logger = createLogger('AI Classification');

/**
 * Classify VMs using AI, with caching and fallback
 *
 * @param vms - VM summaries to classify
 * @param environmentFingerprint - Current environment fingerprint for cache validation
 * @returns Classification results (may be from cache)
 */
export async function fetchAIClassifications(
  vms: VMClassificationInput[],
  environmentFingerprint: string
): Promise<VMClassificationResult[]> {
  if (!isAIProxyConfigured()) {
    logger.info('AI proxy not configured, skipping classification');
    return [];
  }

  // Check cache first
  if (isClassificationCacheValid(environmentFingerprint)) {
    const cached = getCachedClassifications();
    if (cached) {
      const results = Object.values(cached.classifications);
      logger.info(`Returning ${results.length} cached classifications`);
      return results;
    }
  }

  // Fetch from AI proxy
  logger.info(`Classifying ${vms.length} VMs via AI proxy`);

  try {
    const request: ClassificationRequest = { vms };
    const response = await classifyVMs(request, { timeout: 300000 }); // 5 min timeout — proxy processes VMs in sequential LLM batches

    logger.info(`Received ${response.classifications.length} classifications in ${response.processingTimeMs}ms`);

    // Cache results
    setCachedClassifications(response.classifications, environmentFingerprint);

    return response.classifications;
  } catch (error) {
    logger.error(
      'AI classification failed',
      error instanceof Error ? error : new Error(String(error))
    );
    return [];
  }
}
