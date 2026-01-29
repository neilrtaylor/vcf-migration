// AI Wave Suggestions API client

import { createLogger } from '@/utils/logger';
import { isAIProxyConfigured, getWaveSuggestions } from './aiProxyClient';
import type { WaveSuggestionInput, WaveSuggestionResult, WaveSuggestionRequest } from './types';

const logger = createLogger('AI Wave Suggestions');

/**
 * Normalize wave suggestions response to handle common LLM output variations
 */
function normalizeWaveSuggestions(raw: Record<string, unknown>): WaveSuggestionResult {
  // Helper to get a field with multiple possible names
  const getField = (obj: Record<string, unknown>, ...keys: string[]): unknown => {
    for (const key of keys) {
      if (obj[key] !== undefined) return obj[key];
    }
    return undefined;
  };

  // Helper to ensure array type
  const ensureStringArray = (value: unknown): string[] => {
    if (Array.isArray(value)) return value.map(String);
    if (typeof value === 'string') return [value];
    return [];
  };

  // Helper to normalize risk narratives
  const ensureRiskNarratives = (value: unknown): Array<{ waveName: string; narrative: string }> => {
    if (!Array.isArray(value)) return [];
    return value.map((item: unknown) => {
      if (typeof item === 'object' && item !== null) {
        const obj = item as Record<string, unknown>;
        return {
          waveName: String(obj.waveName || obj.wave_name || obj.name || 'Unknown'),
          narrative: String(obj.narrative || obj.risk || obj.description || ''),
        };
      }
      return { waveName: 'Unknown', narrative: String(item) };
    });
  };

  // Handle nested response
  const data = (raw.response || raw.result || raw) as Record<string, unknown>;

  const normalized: WaveSuggestionResult = {
    suggestions: ensureStringArray(
      getField(data, 'suggestions', 'Suggestions', 'suggestion_list', 'optimizations')
    ),
    riskNarratives: ensureRiskNarratives(
      getField(data, 'riskNarratives', 'risk_narratives', 'waveRisks', 'wave_risks')
    ),
    dependencyWarnings: ensureStringArray(
      getField(data, 'dependencyWarnings', 'dependency_warnings', 'warnings', 'dependencies')
    ),
    source: 'watsonx',
  };

  logger.debug('Normalized wave suggestions', {
    suggestionsCount: normalized.suggestions.length,
    riskNarrativesCount: normalized.riskNarratives.length,
    dependencyWarningsCount: normalized.dependencyWarnings.length,
  });

  return normalized;
}

/**
 * Fetch AI-generated wave planning suggestions
 */
export async function fetchWaveSuggestions(
  data: WaveSuggestionInput
): Promise<WaveSuggestionResult | null> {
  if (!isAIProxyConfigured()) {
    logger.info('AI proxy not configured, skipping wave suggestions');
    return null;
  }

  logger.info('Fetching AI wave suggestions');

  try {
    const request: WaveSuggestionRequest = { data };
    const response = await getWaveSuggestions(request, { timeout: 60000 });

    logger.info(`Received wave suggestions in ${response.processingTimeMs}ms`);

    // Normalize the response to handle LLM output variations
    const normalized = normalizeWaveSuggestions(response.result as unknown as Record<string, unknown>);
    return normalized;
  } catch (error) {
    logger.error(
      'AI wave suggestions failed',
      error instanceof Error ? error : new Error(String(error))
    );
    return null;
  }
}
