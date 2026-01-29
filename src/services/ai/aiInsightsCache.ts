// AI insights cache - localStorage persistence
// Follows the pattern of aiClassificationCache.ts

import type { MigrationInsights } from './types';

// ===== TYPES =====

export interface CachedInsights {
  insights: MigrationInsights;
  /** Cache key derived from input data to detect stale entries */
  inputHash: string;
  lastUpdated: string;
  expiresAt: string;
}

// ===== CONSTANTS =====

const CACHE_KEY = 'vcf-ai-insights';
const CACHE_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

// ===== CACHE FUNCTIONS =====

/**
 * Build a hash string from insights input for cache key comparison
 */
export function buildInsightsInputHash(totalVMs: number, totalVCPUs: number, totalMemoryGiB: number, migrationTarget: string): string {
  return `${totalVMs}:${totalVCPUs}:${totalMemoryGiB}:${migrationTarget}`;
}

/**
 * Get cached insights from localStorage
 */
export function getCachedInsights(inputHash: string): MigrationInsights | null {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return null;

    const parsed = JSON.parse(cached) as CachedInsights;

    // Check if cache matches current input
    if (parsed.inputHash !== inputHash) return null;

    // Check expiry
    if (new Date() > new Date(parsed.expiresAt)) {
      localStorage.removeItem(CACHE_KEY);
      return null;
    }

    if (!parsed.insights || typeof parsed.insights !== 'object') {
      localStorage.removeItem(CACHE_KEY);
      return null;
    }

    return parsed.insights;
  } catch {
    localStorage.removeItem(CACHE_KEY);
    return null;
  }
}

/**
 * Save insights to localStorage cache
 */
export function setCachedInsights(insights: MigrationInsights, inputHash: string): void {
  try {
    const now = new Date();
    const cached: CachedInsights = {
      insights,
      inputHash,
      lastUpdated: now.toISOString(),
      expiresAt: new Date(now.getTime() + CACHE_DURATION_MS).toISOString(),
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(cached));
  } catch {
    // Silently fail - cache is optional
  }
}

/**
 * Clear the insights cache
 */
export function clearInsightsCache(): void {
  try {
    localStorage.removeItem(CACHE_KEY);
  } catch {
    // Silently fail
  }
}
