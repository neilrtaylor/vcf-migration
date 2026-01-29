// Builds InsightsInput from RVToolsData for use in export flows
// Only sends aggregated summaries, never individual VM names or IPs

import type { InsightsInput } from './types';
import type { RVToolsData } from '@/types/rvtools';
import { mibToGiB } from '@/utils/formatters';
import { isVMwareInfrastructureVM } from '@/utils/autoExclusion';

/**
 * Build an InsightsInput from raw RVTools data.
 * Used by export flows (DOCX, PDF, Excel) to fetch AI insights.
 */
export function buildInsightsInput(rawData: RVToolsData): InsightsInput {
  const allVMs = rawData.vInfo.filter(vm => !vm.template && !isVMwareInfrastructureVM(vm.vmName, vm.guestOS));
  const poweredOnVMs = allVMs.filter(vm => vm.powerState === 'poweredOn');

  const totalVCPUs = poweredOnVMs.reduce((sum, vm) => sum + vm.cpus, 0);
  const totalMemoryGiB = Math.round(poweredOnVMs.reduce((sum, vm) => sum + mibToGiB(vm.memory), 0));
  const totalStorageTiB = Math.round((poweredOnVMs.reduce((sum, vm) => sum + mibToGiB(vm.provisionedMiB), 0) / 1024) * 100) / 100;
  const excludedCount = rawData.vInfo.length - allVMs.length;

  // Build workload breakdown (basic OS-based categories)
  const workloadBreakdown: Record<string, number> = {};
  for (const vm of poweredOnVMs) {
    const os = vm.guestOS?.toLowerCase() || '';
    let category = 'Other';
    if (os.includes('windows server')) category = 'Windows Server';
    else if (os.includes('windows')) category = 'Windows Desktop';
    else if (os.includes('rhel') || os.includes('red hat')) category = 'RHEL';
    else if (os.includes('centos')) category = 'CentOS';
    else if (os.includes('ubuntu')) category = 'Ubuntu';
    else if (os.includes('sles') || os.includes('suse')) category = 'SLES';
    else if (os.includes('linux')) category = 'Linux (Other)';

    workloadBreakdown[category] = (workloadBreakdown[category] || 0) + 1;
  }

  // Build blocker summary
  const blockerSummary: string[] = [];
  const templatesCount = rawData.vInfo.filter(vm => vm.template).length;
  if (templatesCount > 0) {
    blockerSummary.push(`${templatesCount} VM templates excluded`);
  }
  const poweredOffCount = allVMs.filter(vm => vm.powerState !== 'poweredOn').length;
  if (poweredOffCount > 0) {
    blockerSummary.push(`${poweredOffCount} VMs powered off`);
  }

  // Build network summary
  const networkSummary = rawData.vNetwork?.length > 0
    ? buildNetworkSummary(rawData)
    : undefined;

  return {
    totalVMs: poweredOnVMs.length,
    totalExcluded: excludedCount,
    totalVCPUs,
    totalMemoryGiB,
    totalStorageTiB,
    clusterCount: rawData.vCluster.length,
    hostCount: rawData.vHost.length,
    datastoreCount: rawData.vDatastore.length,
    workloadBreakdown,
    complexitySummary: {
      simple: 0,
      moderate: 0,
      complex: 0,
      blocker: 0,
    },
    blockerSummary,
    networkSummary,
    migrationTarget: 'both',
  };
}

function buildNetworkSummary(rawData: RVToolsData) {
  const portGroupMap = new Map<string, { vmNames: Set<string>; ips: string[] }>();

  for (const nic of rawData.vNetwork) {
    const pg = nic.networkName || 'Unknown';
    if (!portGroupMap.has(pg)) {
      portGroupMap.set(pg, { vmNames: new Set(), ips: [] });
    }
    const data = portGroupMap.get(pg)!;
    data.vmNames.add(nic.vmName);
    if (nic.ipv4Address) {
      data.ips.push(nic.ipv4Address);
    }
  }

  return Array.from(portGroupMap.entries()).map(([portGroup, data]) => {
    let subnet = 'N/A';
    if (data.ips.length > 0) {
      const prefixCounts = new Map<string, number>();
      for (const ip of data.ips) {
        const parts = ip.split('.');
        if (parts.length >= 3) {
          const prefix = `${parts[0]}.${parts[1]}.${parts[2]}`;
          prefixCounts.set(prefix, (prefixCounts.get(prefix) || 0) + 1);
        }
      }
      let maxCount = 0;
      let mostCommonPrefix = '';
      prefixCounts.forEach((count, prefix) => {
        if (count > maxCount) {
          maxCount = count;
          mostCommonPrefix = prefix;
        }
      });
      if (mostCommonPrefix) {
        subnet = `${mostCommonPrefix}.0/24`;
      }
    }
    return { portGroup, vmCount: data.vmNames.size, subnet };
  });
}
