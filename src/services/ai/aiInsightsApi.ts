// AI Insights API client

import { createLogger } from '@/utils/logger';
import { isAIProxyConfigured, getMigrationInsights } from './aiProxyClient';
import type { InsightsInput, MigrationInsights, InsightsRequest } from './types';

const logger = createLogger('AI Insights');

/**
 * Normalize insights response to handle common LLM output variations
 * The LLM might use snake_case, different nesting, or alternative field names
 */
function normalizeInsights(raw: Record<string, unknown>): MigrationInsights {
  // Helper to get a field with multiple possible names
  const getField = (obj: Record<string, unknown>, ...keys: string[]): unknown => {
    for (const key of keys) {
      if (obj[key] !== undefined) return obj[key];
    }
    return undefined;
  };

  // Helper to ensure array type
  const ensureArray = (value: unknown): string[] => {
    if (Array.isArray(value)) return value.map(String);
    if (typeof value === 'string') return [value];
    return [];
  };

  // Handle nested response (e.g., { response: { ... } } or { result: { ... } })
  const data = (raw.response || raw.result || raw) as Record<string, unknown>;

  const normalized: MigrationInsights = {
    executiveSummary: String(
      getField(data, 'executiveSummary', 'executive_summary', 'summary', 'Executive Summary') || ''
    ),
    riskAssessment: String(
      getField(data, 'riskAssessment', 'risk_assessment', 'risks', 'Risk Assessment') || ''
    ),
    recommendations: ensureArray(
      getField(data, 'recommendations', 'Recommendations', 'recommendation_list')
    ),
    costOptimizations: ensureArray(
      getField(data, 'costOptimizations', 'cost_optimizations', 'Cost Optimizations', 'costSavings')
    ),
    migrationStrategy: String(
      getField(data, 'migrationStrategy', 'migration_strategy', 'strategy', 'Migration Strategy') || ''
    ),
    source: 'watsonx',
  };

  logger.debug('Normalized insights', {
    hasExecutiveSummary: !!normalized.executiveSummary,
    hasRiskAssessment: !!normalized.riskAssessment,
    recommendationsCount: normalized.recommendations.length,
    costOptimizationsCount: normalized.costOptimizations.length,
    hasMigrationStrategy: !!normalized.migrationStrategy,
  });

  return normalized;
}

/**
 * Fetch AI-generated migration insights
 */
export async function fetchAIInsights(
  data: InsightsInput,
  options?: { skipCache?: boolean }
): Promise<MigrationInsights | null> {
  if (!isAIProxyConfigured()) {
    logger.info('AI proxy not configured, skipping insights');
    return null;
  }

  logger.info('Fetching AI migration insights', { skipCache: options?.skipCache });

  try {
    const request: InsightsRequest = { data };
    const response = await getMigrationInsights(request, {
      timeout: 60000,
      skipCache: options?.skipCache,
    });

    logger.info(`Received insights in ${response.processingTimeMs}ms`);

    // Guard against empty/null response
    if (!response.insights || typeof response.insights !== 'object') {
      logger.warn('AI proxy returned empty or invalid insights', { insights: response.insights });
      return null;
    }

    // Log raw response structure for debugging
    logger.debug('Raw insights structure', {
      keys: Object.keys(response.insights),
      hasExecutiveSummary: 'executiveSummary' in response.insights,
      hasRecommendations: 'recommendations' in response.insights,
    });

    // Normalize the response to handle LLM output variations
    const normalized = normalizeInsights(response.insights as unknown as Record<string, unknown>);

    // If normalization resulted in empty data, return null to trigger re-fetch
    if (!normalized.executiveSummary && normalized.recommendations.length === 0) {
      logger.warn('Normalized insights are empty, LLM may have returned unexpected format');
      return null;
    }

    return normalized;
  } catch (error) {
    logger.error(
      'AI insights failed',
      error instanceof Error ? error : new Error(String(error))
    );
    return null;
  }
}
