import { describe, it, expect } from 'vitest';
import { buildChatContext } from './chatContextBuilder';
import type { RVToolsData } from '@/types';

describe('chatContextBuilder', () => {
  const mockRawData = {
    vInfo: [
      { name: 'vm1', cpus: 4, memory: 8192 },
      { name: 'vm2', cpus: 8, memory: 16384 },
    ],
    vDisk: [
      { capacityMiB: 102400 },
      { capacityMiB: 204800 },
    ],
    vCluster: [
      { name: 'cluster1' },
    ],
    vHost: [
      { name: 'host1' },
      { name: 'host2' },
    ],
    vDatastore: [
      { name: 'ds1' },
    ],
  } as unknown as RVToolsData;

  it('returns undefined when no data is loaded', () => {
    const context = buildChatContext(null, null, '/dashboard');
    expect(context).toBeUndefined();
  });

  it('builds summary from raw data', () => {
    const context = buildChatContext(mockRawData, null, '/dashboard');

    expect(context).toBeDefined();
    expect(context!.summary.totalVMs).toBe(2);
    expect(context!.summary.totalVCPUs).toBe(12);
    expect(context!.summary.totalMemoryGiB).toBe(24);
    expect(context!.summary.clusterCount).toBe(1);
    expect(context!.summary.hostCount).toBe(2);
    expect(context!.summary.datastoreCount).toBe(1);
  });

  it('includes current page', () => {
    const context = buildChatContext(mockRawData, null, '/vsi-migration');
    expect(context!.currentPage).toBe('/vsi-migration');
  });

  it('calculates storage from vDisk', () => {
    const context = buildChatContext(mockRawData, null, '/dashboard');
    // (102400 + 204800) / 1024 / 1024 = 0.29 TiB
    expect(context!.summary.totalStorageTiB).toBeGreaterThan(0);
  });

  it('returns empty workload breakdown without analysis', () => {
    const context = buildChatContext(mockRawData, null, '/dashboard');
    expect(context!.workloadBreakdown).toEqual({});
  });

  it('returns default complexity summary without analysis', () => {
    const context = buildChatContext(mockRawData, null, '/dashboard');
    expect(context!.complexitySummary).toEqual({
      simple: 0,
      moderate: 0,
      complex: 0,
      blocker: 0,
    });
  });
});
