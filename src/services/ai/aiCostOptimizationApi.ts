// AI Cost Optimization API client

import { createLogger } from '@/utils/logger';
import { isAIProxyConfigured, getCostOptimization } from './aiProxyClient';
import type { CostOptimizationInput, CostOptimizationResult, CostOptimizationRequest, CostOptimizationRecommendation } from './types';

const logger = createLogger('AI Cost Optimization');

/**
 * Normalize cost optimization response to handle common LLM output variations
 */
function normalizeCostOptimization(raw: Record<string, unknown>): CostOptimizationResult {
  // Helper to get a field with multiple possible names
  const getField = (obj: Record<string, unknown>, ...keys: string[]): unknown => {
    for (const key of keys) {
      if (obj[key] !== undefined) return obj[key];
    }
    return undefined;
  };

  // Helper to ensure string array
  const ensureStringArray = (value: unknown): string[] => {
    if (Array.isArray(value)) return value.map(String);
    if (typeof value === 'string') return [value];
    return [];
  };

  // Helper to normalize recommendations
  const ensureRecommendations = (value: unknown): CostOptimizationRecommendation[] => {
    if (!Array.isArray(value)) return [];
    return value.map((item: unknown) => {
      if (typeof item === 'object' && item !== null) {
        const obj = item as Record<string, unknown>;
        return {
          category: String(obj.category || obj.Category || 'General'),
          description: String(obj.description || obj.Description || obj.recommendation || ''),
          estimatedSavings: String(obj.estimatedSavings || obj.estimated_savings || obj.savings || ''),
          priority: (obj.priority || obj.Priority || 'medium') as 'high' | 'medium' | 'low',
        };
      }
      // If just a string, wrap it in an object
      return {
        category: 'General',
        description: String(item),
        estimatedSavings: '',
        priority: 'medium' as const,
      };
    });
  };

  // Handle nested response
  const data = (raw.response || raw.result || raw) as Record<string, unknown>;

  const normalized: CostOptimizationResult = {
    recommendations: ensureRecommendations(
      getField(data, 'recommendations', 'Recommendations', 'cost_recommendations')
    ),
    architectureRecommendations: ensureStringArray(
      getField(data, 'architectureRecommendations', 'architecture_recommendations', 'architectureSuggestions')
    ),
    source: 'watsonx',
  };

  logger.debug('Normalized cost optimization', {
    recommendationsCount: normalized.recommendations.length,
    architectureRecommendationsCount: normalized.architectureRecommendations.length,
  });

  return normalized;
}

/**
 * Fetch AI-generated cost optimization recommendations
 */
export async function fetchCostOptimization(
  data: CostOptimizationInput
): Promise<CostOptimizationResult | null> {
  if (!isAIProxyConfigured()) {
    logger.info('AI proxy not configured, skipping cost optimization');
    return null;
  }

  logger.info('Fetching AI cost optimization recommendations');

  try {
    const request: CostOptimizationRequest = { data };
    const response = await getCostOptimization(request, { timeout: 60000 });

    logger.info(`Received cost optimization in ${response.processingTimeMs}ms`);

    // Normalize the response to handle LLM output variations
    const normalized = normalizeCostOptimization(response.result as unknown as Record<string, unknown>);
    return normalized;
  } catch (error) {
    logger.error(
      'AI cost optimization failed',
      error instanceof Error ? error : new Error(String(error))
    );
    return null;
  }
}
