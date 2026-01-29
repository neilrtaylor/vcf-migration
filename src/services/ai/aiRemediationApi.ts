// AI Remediation Guidance API client

import { createLogger } from '@/utils/logger';
import { isAIProxyConfigured, getRemediationGuidance } from './aiProxyClient';
import type { RemediationInput, RemediationResult, RemediationRequest } from './types';

const logger = createLogger('AI Remediation');

/**
 * Fetch AI-generated remediation guidance for migration blockers
 */
export async function fetchRemediationGuidance(
  data: RemediationInput
): Promise<RemediationResult | null> {
  if (!isAIProxyConfigured()) {
    logger.info('AI proxy not configured, skipping remediation guidance');
    return null;
  }

  logger.info('Fetching AI remediation guidance');

  try {
    const request: RemediationRequest = { data };
    const response = await getRemediationGuidance(request, { timeout: 60000 });

    logger.info(`Received remediation guidance in ${response.processingTimeMs}ms`);
    return response.result;
  } catch (error) {
    logger.error(
      'AI remediation guidance failed',
      error instanceof Error ? error : new Error(String(error))
    );
    return null;
  }
}
