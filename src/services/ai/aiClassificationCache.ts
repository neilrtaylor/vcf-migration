// AI classification cache - localStorage persistence
// Follows the pattern of src/services/pricing/pricingCache.ts

import type { VMClassificationResult } from './types';

// ===== TYPES =====

export interface CachedClassifications {
  classifications: Record<string, VMClassificationResult>; // keyed by vmName
  environmentFingerprint: string;
  lastUpdated: string;
  expiresAt: string;
}

// ===== CONSTANTS =====

const CACHE_KEY = 'vcf-ai-classifications';
const CACHE_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

// ===== CACHE FUNCTIONS =====

/**
 * Get cached classifications from localStorage
 */
export function getCachedClassifications(): CachedClassifications | null {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return null;

    const parsed = JSON.parse(cached) as CachedClassifications;

    if (!parsed.classifications || typeof parsed.classifications !== 'object') {
      localStorage.removeItem(CACHE_KEY);
      return null;
    }

    return parsed;
  } catch {
    localStorage.removeItem(CACHE_KEY);
    return null;
  }
}

/**
 * Save classifications to localStorage cache
 */
export function setCachedClassifications(
  classifications: VMClassificationResult[],
  environmentFingerprint: string
): void {
  try {
    const now = new Date();
    const classificationMap: Record<string, VMClassificationResult> = {};

    for (const c of classifications) {
      classificationMap[c.vmName] = c;
    }

    const cached: CachedClassifications = {
      classifications: classificationMap,
      environmentFingerprint,
      lastUpdated: now.toISOString(),
      expiresAt: new Date(now.getTime() + CACHE_DURATION_MS).toISOString(),
    };

    localStorage.setItem(CACHE_KEY, JSON.stringify(cached));
  } catch {
    // Silently fail - cache is optional
  }
}

/**
 * Check if the classification cache is expired
 */
export function isClassificationCacheExpired(): boolean {
  const cached = getCachedClassifications();
  if (!cached) return true;
  return new Date() > new Date(cached.expiresAt);
}

/**
 * Check if cached data matches current environment
 */
export function isClassificationCacheValid(environmentFingerprint: string): boolean {
  const cached = getCachedClassifications();
  if (!cached) return false;
  if (cached.environmentFingerprint !== environmentFingerprint) return false;
  return !isClassificationCacheExpired();
}

/**
 * Get a single VM classification from cache
 */
export function getCachedVMClassification(vmName: string): VMClassificationResult | null {
  const cached = getCachedClassifications();
  if (!cached) return null;
  return cached.classifications[vmName] || null;
}

/**
 * Clear the classification cache
 */
export function clearClassificationCache(): void {
  try {
    localStorage.removeItem(CACHE_KEY);
  } catch {
    // Silently fail
  }
}
