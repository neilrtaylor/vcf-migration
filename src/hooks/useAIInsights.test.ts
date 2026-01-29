import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAIInsights } from './useAIInsights';
import type { InsightsInput } from '@/services/ai/types';

vi.mock('@/services/ai/aiProxyClient', () => ({
  isAIProxyConfigured: vi.fn(() => true),
}));

vi.mock('@/services/ai/aiInsightsApi', () => ({
  fetchAIInsights: vi.fn(() =>
    Promise.resolve({
      executiveSummary: 'Test summary',
      riskAssessment: 'Low risk',
      recommendations: ['Rec 1'],
      costOptimizations: ['Opt 1'],
      migrationStrategy: 'Phased approach',
      source: 'watsonx' as const,
    })
  ),
}));

vi.mock('./useAISettings', () => ({
  useAISettings: vi.fn(() => ({
    settings: { enabled: true, consentGiven: true },
    updateSettings: vi.fn(),
    resetSettings: vi.fn(),
  })),
}));

describe('useAIInsights', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockData: InsightsInput = {
    totalVMs: 100,
    totalExcluded: 5,
    totalVCPUs: 400,
    totalMemoryGiB: 1600,
    totalStorageTiB: 50,
    clusterCount: 3,
    hostCount: 10,
    datastoreCount: 8,
    workloadBreakdown: { Databases: 20, Web: 30 },
    complexitySummary: { simple: 60, moderate: 25, complex: 10, blocker: 5 },
    blockerSummary: ['5 VMs with unsupported OS'],
  };

  it('starts with no insights', () => {
    const { result } = renderHook(() => useAIInsights());

    expect(result.current.insights).toBeNull();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isAvailable).toBe(true);
  });

  it('fetches insights on demand', async () => {
    const { result } = renderHook(() => useAIInsights());

    await act(async () => {
      await result.current.fetchInsights(mockData);
    });

    expect(result.current.insights).not.toBeNull();
    expect(result.current.insights!.executiveSummary).toBe('Test summary');
    expect(result.current.insights!.recommendations).toEqual(['Rec 1']);
  });

  it('clears insights', async () => {
    const { result } = renderHook(() => useAIInsights());

    await act(async () => {
      await result.current.fetchInsights(mockData);
    });

    expect(result.current.insights).not.toBeNull();

    act(() => {
      result.current.clearInsights();
    });

    expect(result.current.insights).toBeNull();
  });
});
