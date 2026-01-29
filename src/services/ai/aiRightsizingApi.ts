// AI Right-sizing API client

import { createLogger } from '@/utils/logger';
import { isAIProxyConfigured, getRightsizingRecommendations } from './aiProxyClient';
import {
  getCachedRightsizing,
  setCachedRightsizing,
  isRightsizingCacheValid,
} from './aiRightsizingCache';
import type {
  RightsizingInput,
  ProfileRecommendation,
  RightsizingRequest,
} from './types';

const logger = createLogger('AI Rightsizing');

/**
 * Get AI right-sizing recommendations with caching
 */
export async function fetchAIRightsizing(
  vms: RightsizingInput[],
  availableProfiles: Array<{ name: string; vcpus: number; memoryGiB: number; family: string }>,
  environmentFingerprint: string
): Promise<ProfileRecommendation[]> {
  if (!isAIProxyConfigured()) {
    logger.info('AI proxy not configured, skipping right-sizing');
    return [];
  }

  // Check cache
  if (isRightsizingCacheValid(environmentFingerprint)) {
    const cached = getCachedRightsizing();
    if (cached) {
      const results = Object.values(cached.recommendations);
      logger.info(`Returning ${results.length} cached right-sizing recommendations`);
      return results;
    }
  }

  logger.info(`Getting right-sizing recommendations for ${vms.length} VMs`);

  try {
    const request: RightsizingRequest = { vms, availableProfiles };
    const response = await getRightsizingRecommendations(request, { timeout: 300000 }); // 5 min — sequential LLM batches

    logger.info(
      `Received ${response.recommendations.length} recommendations in ${response.processingTimeMs}ms`
    );

    setCachedRightsizing(response.recommendations, environmentFingerprint);
    return response.recommendations;
  } catch (error) {
    logger.error(
      'AI right-sizing failed',
      error instanceof Error ? error : new Error(String(error))
    );
    return [];
  }
}
