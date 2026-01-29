// AI right-sizing cache - localStorage persistence

import type { ProfileRecommendation } from './types';

// ===== TYPES =====

export interface CachedRightsizing {
  recommendations: Record<string, ProfileRecommendation>; // keyed by vmName
  environmentFingerprint: string;
  lastUpdated: string;
  expiresAt: string;
}

// ===== CONSTANTS =====

const CACHE_KEY = 'vcf-ai-rightsizing';
const CACHE_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

// ===== CACHE FUNCTIONS =====

export function getCachedRightsizing(): CachedRightsizing | null {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return null;

    const parsed = JSON.parse(cached) as CachedRightsizing;
    if (!parsed.recommendations || typeof parsed.recommendations !== 'object') {
      localStorage.removeItem(CACHE_KEY);
      return null;
    }

    return parsed;
  } catch {
    localStorage.removeItem(CACHE_KEY);
    return null;
  }
}

export function setCachedRightsizing(
  recommendations: ProfileRecommendation[],
  environmentFingerprint: string
): void {
  try {
    const now = new Date();
    const recMap: Record<string, ProfileRecommendation> = {};

    for (const r of recommendations) {
      recMap[r.vmName] = r;
    }

    const cached: CachedRightsizing = {
      recommendations: recMap,
      environmentFingerprint,
      lastUpdated: now.toISOString(),
      expiresAt: new Date(now.getTime() + CACHE_DURATION_MS).toISOString(),
    };

    localStorage.setItem(CACHE_KEY, JSON.stringify(cached));
  } catch {
    // Silently fail
  }
}

export function isRightsizingCacheValid(environmentFingerprint: string): boolean {
  const cached = getCachedRightsizing();
  if (!cached) return false;
  if (cached.environmentFingerprint !== environmentFingerprint) return false;
  return new Date() <= new Date(cached.expiresAt);
}

export function getCachedVMRightsizing(vmName: string): ProfileRecommendation | null {
  const cached = getCachedRightsizing();
  if (!cached) return null;
  return cached.recommendations[vmName] || null;
}

export function clearRightsizingCache(): void {
  try {
    localStorage.removeItem(CACHE_KEY);
  } catch {
    // Silently fail
  }
}
