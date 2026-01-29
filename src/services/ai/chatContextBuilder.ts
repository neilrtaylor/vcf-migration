// Chat context builder - extracts relevant context from DataContext state
// Only sends aggregated summaries, never individual VM names or IPs

import type { ChatContext } from './types';
import type { RVToolsData, AnalysisResults } from '@/types';

/**
 * Build chat context from current app state
 * This runs on each message send, extracting relevant aggregates
 */
export function buildChatContext(
  rawData: RVToolsData | null,
  analysis: AnalysisResults | null,
  currentPage: string
): ChatContext | undefined {
  if (!rawData) return undefined;

  const vms = rawData.vInfo || [];

  // Build summary
  const totalVMs = vms.length;
  const totalVCPUs = vms.reduce((sum, vm) => sum + (vm.cpus || 0), 0);
  const totalMemoryMiB = vms.reduce((sum, vm) => sum + (vm.memory || 0), 0);

  // Calculate storage from vDisk
  const disks = rawData.vDisk || [];
  const totalStorageMiB = disks.reduce((sum, d) => sum + (d.capacityMiB || 0), 0);

  const clusters = rawData.vCluster || [];
  const hosts = rawData.vHost || [];
  const datastores = rawData.vDatastore || [];

  // Build workload breakdown from analysis if available
  const workloadBreakdown: Record<string, number> = {};
  // Analysis may have complexity results we can derive workload info from
  // For now, leave as empty unless analysis has specific workload data

  // Build complexity summary from analysis
  const complexitySummary = {
    simple: 0,
    moderate: 0,
    complex: 0,
    blocker: 0,
  };

  if (analysis?.complexity) {
    for (const result of analysis.complexity) {
      const category = result.category;
      if (category in complexitySummary) {
        complexitySummary[category as keyof typeof complexitySummary]++;
      }
    }
  }

  // Build blocker summary
  const blockerSummary: string[] = [];
  if (complexitySummary.blocker > 0) {
    blockerSummary.push(`${complexitySummary.blocker} VMs with migration blockers`);
  }

  return {
    summary: {
      totalVMs,
      totalExcluded: 0, // Would need VM overrides context
      totalVCPUs,
      totalMemoryGiB: Math.round(totalMemoryMiB / 1024),
      totalStorageTiB: Math.round((totalStorageMiB / 1024 / 1024) * 100) / 100,
      clusterCount: clusters.length,
      hostCount: hosts.length,
      datastoreCount: datastores.length,
    },
    workloadBreakdown,
    complexitySummary,
    blockerSummary,
    currentPage,
  };
}
