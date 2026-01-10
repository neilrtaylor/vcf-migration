// Excel export service using SheetJS
import * as XLSX from 'xlsx';
import type { RVToolsData, VirtualMachine, VHostInfo, VDatastoreInfo, VSnapshotInfo, VCDInfo, VDiskInfo, VNetworkInfo, VToolsInfo } from '@/types/rvtools';
import { mibToGiB, formatHardwareVersion, getHardwareVersionNumber } from '@/utils/formatters';
import { HW_VERSION_MINIMUM, HW_VERSION_RECOMMENDED, SNAPSHOT_BLOCKER_AGE_DAYS } from '@/utils/constants';
import osCompatibilityData from '@/data/redhatOSCompatibility.json';
import ibmCloudProfiles from '@/data/ibmCloudProfiles.json';
import type { VMCheckResults, CheckMode } from '@/services/preflightChecks';
import { getChecksForMode } from '@/services/preflightChecks';

// OS Compatibility lookup
function getOSCompatibility(guestOS: string) {
  const osLower = guestOS.toLowerCase();
  for (const entry of osCompatibilityData.osEntries) {
    if (entry.patterns.some(p => osLower.includes(p))) {
      return entry;
    }
  }
  return osCompatibilityData.defaultEntry;
}

// Map VM to VPC VSI profile
function mapVMToVSIProfile(vcpus: number, memoryGiB: number) {
  const { vpcProfiles } = ibmCloudProfiles;
  const memToVcpuRatio = memoryGiB / vcpus;

  let family: 'balanced' | 'compute' | 'memory' = 'balanced';
  if (memToVcpuRatio <= 2.5) {
    family = 'compute';
  } else if (memToVcpuRatio >= 6) {
    family = 'memory';
  }

  const profiles = vpcProfiles[family];
  const bestFit = profiles.find(p => p.vcpus >= vcpus && p.memoryGiB >= memoryGiB);
  return bestFit || profiles[profiles.length - 1];
}

export function generateExcelReport(rawData: RVToolsData): XLSX.WorkBook {
  const workbook = XLSX.utils.book_new();

  // Filter to non-template VMs
  const vms = rawData.vInfo.filter((vm: VirtualMachine) => !vm.template);
  const poweredOnVMs = vms.filter((vm: VirtualMachine) => vm.powerState === 'poweredOn');

  // ===== Executive Summary Sheet =====
  const execData = [
    ['RVTools Analysis Report', ''],
    ['Generated', new Date().toLocaleString()],
    [''],
    ['Infrastructure Summary', ''],
    ['Total VMs', vms.length],
    ['Powered On VMs', poweredOnVMs.length],
    ['Powered Off VMs', vms.filter((vm: VirtualMachine) => vm.powerState === 'poweredOff').length],
    ['Total vCPUs', vms.reduce((sum: number, vm: VirtualMachine) => sum + vm.cpus, 0)],
    ['Total Memory (GiB)', Math.round(vms.reduce((sum: number, vm: VirtualMachine) => sum + mibToGiB(vm.memory), 0))],
    ['Total Storage (TiB)', (vms.reduce((sum: number, vm: VirtualMachine) => sum + mibToGiB(vm.provisionedMiB), 0) / 1024).toFixed(1)],
    ['Total Clusters', rawData.vCluster.length],
    ['Total Hosts', rawData.vHost.length],
    ['Total Datastores', rawData.vDatastore.length],
  ];
  const execSheet = XLSX.utils.aoa_to_sheet(execData);
  XLSX.utils.book_append_sheet(workbook, execSheet, 'Executive Summary');

  // ===== VM List Sheet =====
  const vmListData = vms.map((vm: VirtualMachine) => ({
    'VM Name': vm.vmName,
    'Power State': vm.powerState,
    'Guest OS': vm.guestOS,
    'vCPUs': vm.cpus,
    'Memory (GiB)': Math.round(mibToGiB(vm.memory)),
    'Provisioned (GiB)': Math.round(mibToGiB(vm.provisionedMiB)),
    'In Use (GiB)': Math.round(mibToGiB(vm.inUseMiB)),
    'HW Version': formatHardwareVersion(vm.hardwareVersion),
    'Cluster': vm.cluster,
    'Host': vm.host,
    'Datacenter': vm.datacenter,
    'Folder': vm.folder,
    'Resource Pool': vm.resourcePool,
  }));
  const vmListSheet = XLSX.utils.json_to_sheet(vmListData);
  XLSX.utils.book_append_sheet(workbook, vmListSheet, 'VM List');

  // ===== Migration Readiness Sheet =====
  const toolsMap = new Map<string, VToolsInfo>(rawData.vTools.map((t: VToolsInfo) => [t.vmName, t]));
  const snapshotSet = new Set(rawData.vSnapshot.filter((s: VSnapshotInfo) => s.ageInDays > SNAPSHOT_BLOCKER_AGE_DAYS).map((s: VSnapshotInfo) => s.vmName));
  const cdConnectedSet = new Set(rawData.vCD.filter((cd: VCDInfo) => cd.connected).map((cd: VCDInfo) => cd.vmName));
  const rdmSet = new Set(rawData.vDisk.filter((d: VDiskInfo) => d.raw).map((d: VDiskInfo) => d.vmName));

  const migrationData = poweredOnVMs.map((vm: VirtualMachine) => {
    const tool = toolsMap.get(vm.vmName);
    const osCompat = getOSCompatibility(vm.guestOS);
    const hwVersion = getHardwareVersionNumber(vm.hardwareVersion);

    const issues: string[] = [];
    if (!tool || tool.toolsStatus === 'toolsNotInstalled') issues.push('No VMware Tools');
    if (snapshotSet.has(vm.vmName)) issues.push('Old Snapshots');
    if (cdConnectedSet.has(vm.vmName)) issues.push('CD-ROM Connected');
    if (rdmSet.has(vm.vmName)) issues.push('RDM Disk');
    if (hwVersion < HW_VERSION_MINIMUM) issues.push('Outdated HW Version');
    if (osCompat.compatibilityStatus === 'unsupported') issues.push('Unsupported OS');

    return {
      'VM Name': vm.vmName,
      'OS Compatibility': osCompat.compatibilityStatus,
      'OS': osCompat.displayName,
      'HW Version': formatHardwareVersion(vm.hardwareVersion),
      'HW Status': hwVersion >= HW_VERSION_RECOMMENDED ? 'Recommended' : hwVersion >= HW_VERSION_MINIMUM ? 'Supported' : 'Upgrade Required',
      'Tools Status': tool?.toolsStatus || 'Unknown',
      'Has Snapshots': rawData.vSnapshot.some((s: VSnapshotInfo) => s.vmName === vm.vmName) ? 'Yes' : 'No',
      'CD Connected': cdConnectedSet.has(vm.vmName) ? 'Yes' : 'No',
      'Issues': issues.join(', ') || 'None',
      'Ready': issues.length === 0 ? 'Yes' : 'No',
    };
  });
  const migrationSheet = XLSX.utils.json_to_sheet(migrationData);
  XLSX.utils.book_append_sheet(workbook, migrationSheet, 'Migration Readiness');

  // ===== ROKS Bare Metal Sizing Sheet =====
  const { bareMetalProfiles, odfSizing, ocpVirtSizing } = ibmCloudProfiles;
  const totalVCPUs = poweredOnVMs.reduce((sum: number, vm: VirtualMachine) => sum + vm.cpus, 0);
  const totalMemoryGiB = poweredOnVMs.reduce((sum: number, vm: VirtualMachine) => sum + mibToGiB(vm.memory), 0);
  const totalStorageGiB = poweredOnVMs.reduce((sum: number, vm: VirtualMachine) => sum + mibToGiB(vm.provisionedMiB), 0);

  // ODF sizing calculations
  const replicaFactor = odfSizing.replicaFactor;
  const operationalCapacity = odfSizing.operationalCapacityPercent / 100;
  const cephEfficiency = 1 - (odfSizing.cephOverheadPercent / 100);
  const requiredRawStorageGiB = Math.ceil(totalStorageGiB * replicaFactor / operationalCapacity / cephEfficiency);

  const adjustedVCPUs = Math.ceil(totalVCPUs / ocpVirtSizing.cpuOvercommitConservative);

  const recommendedProfile = bareMetalProfiles.find((p: { name: string }) =>
    p.name === 'bx2d.metal.96x384'
  ) || bareMetalProfiles[0];

  const usableThreadsPerNode = Math.floor(recommendedProfile.threads * 0.85);
  const usableMemoryPerNode = recommendedProfile.memoryGiB - ocpVirtSizing.systemReservedMemoryGiB;
  const usableNvmePerNode = recommendedProfile.totalNvmeGiB;

  const nodesForCPU = Math.ceil(adjustedVCPUs / usableThreadsPerNode);
  const nodesForMemory = Math.ceil(totalMemoryGiB / usableMemoryPerNode);
  const nodesForStorage = Math.ceil(requiredRawStorageGiB / usableNvmePerNode);
  const baseNodeCount = Math.max(odfSizing.minOdfNodes, nodesForCPU, nodesForMemory, nodesForStorage);
  const recommendedWorkers = baseNodeCount + ocpVirtSizing.nodeRedundancy;

  const totalClusterNvmeGiB = recommendedWorkers * recommendedProfile.totalNvmeGiB;
  const odfActualUsableTiB = ((totalClusterNvmeGiB / replicaFactor) * operationalCapacity * cephEfficiency / 1024).toFixed(1);

  const roksData = [
    ['ROKS Bare Metal Cluster Sizing', ''],
    [''],
    ['Source Environment', ''],
    ['Total VMs', poweredOnVMs.length],
    ['Total vCPUs', totalVCPUs],
    ['Total Memory (GiB)', Math.round(totalMemoryGiB)],
    ['Total Storage (GiB)', Math.round(totalStorageGiB)],
    [''],
    ['Adjusted Requirements', ''],
    ['Adjusted vCPUs (1.8:1 ratio)', adjustedVCPUs],
    ['VM Memory (no overcommit)', Math.round(totalMemoryGiB)],
    ['Required Raw NVMe (TiB)', Math.round(requiredRawStorageGiB / 1024)],
    [''],
    ['ODF Storage Sizing', ''],
    ['Replica Factor', '3x mirroring'],
    ['Operational Capacity', '75%'],
    ['Ceph Overhead', '~15%'],
    ['ODF Usable Capacity (TiB)', odfActualUsableTiB],
    [''],
    ['Recommended Bare Metal Configuration', ''],
    ['Node Profile', recommendedProfile.name],
    ['Worker Nodes (N+2)', recommendedWorkers],
    ['Total Physical Cores', recommendedWorkers * recommendedProfile.cores],
    ['Total Threads', recommendedWorkers * recommendedProfile.threads],
    ['Total Memory (GiB)', recommendedWorkers * recommendedProfile.memoryGiB],
    ['Total Raw NVMe (TiB)', Math.round(totalClusterNvmeGiB / 1024)],
  ];
  const roksSheet = XLSX.utils.aoa_to_sheet(roksData);
  XLSX.utils.book_append_sheet(workbook, roksSheet, 'ROKS Sizing');

  // ===== VPC VSI Mapping Sheet =====
  const vsiMappingData = poweredOnVMs.map((vm: VirtualMachine) => {
    const profile = mapVMToVSIProfile(vm.cpus, mibToGiB(vm.memory));
    return {
      'VM Name': vm.vmName,
      'Source vCPUs': vm.cpus,
      'Source Memory (GiB)': Math.round(mibToGiB(vm.memory)),
      'Recommended Profile': profile.name,
      'Profile vCPUs': profile.vcpus,
      'Profile Memory (GiB)': profile.memoryGiB,
      'Profile Family': profile.name.startsWith('bx2') ? 'Balanced' :
                        profile.name.startsWith('cx2') ? 'Compute' : 'Memory',
    };
  });
  const vsiSheet = XLSX.utils.json_to_sheet(vsiMappingData);
  XLSX.utils.book_append_sheet(workbook, vsiSheet, 'VPC VSI Mapping');

  // ===== Wave Planning Sheet =====
  const complexityScores = poweredOnVMs.map((vm: VirtualMachine) => {
    let score = 0;
    const osCompat = getOSCompatibility(vm.guestOS);
    score += (100 - osCompat.compatibilityScore) * 0.3;

    const vmNics = rawData.vNetwork.filter((n: VNetworkInfo) => n.vmName === vm.vmName).length;
    if (vmNics > 3) score += 30;
    else if (vmNics > 1) score += 15;

    const vmDisks = rawData.vDisk.filter((d: VDiskInfo) => d.vmName === vm.vmName).length;
    if (vmDisks > 5) score += 30;
    else if (vmDisks > 2) score += 15;

    const hwVersion = getHardwareVersionNumber(vm.hardwareVersion);
    if (hwVersion < HW_VERSION_MINIMUM) score += 25;
    else if (hwVersion < HW_VERSION_RECOMMENDED) score += 10;

    if (vm.cpus > 16 || mibToGiB(vm.memory) > 128) score += 20;

    return { vmName: vm.vmName, score: Math.min(100, score) };
  });

  const waveData = poweredOnVMs.map((vm: VirtualMachine) => {
    const complexityData = complexityScores.find(cs => cs.vmName === vm.vmName);
    const osCompat = getOSCompatibility(vm.guestOS);
    const hasBlocker = rdmSet.has(vm.vmName) || snapshotSet.has(vm.vmName) ||
                       !toolsMap.get(vm.vmName) || toolsMap.get(vm.vmName)?.toolsStatus === 'toolsNotInstalled';

    let wave = 'Wave 3: Standard';
    if (hasBlocker) {
      wave = 'Wave 5: Remediation';
    } else if ((complexityData?.score || 0) <= 15 && osCompat.compatibilityStatus === 'fully-supported') {
      wave = 'Wave 1: Pilot';
    } else if ((complexityData?.score || 0) <= 30) {
      wave = 'Wave 2: Quick Wins';
    } else if ((complexityData?.score || 0) > 55) {
      wave = 'Wave 4: Complex';
    }

    return {
      'VM Name': vm.vmName,
      'Assigned Wave': wave,
      'Complexity Score': Math.round(complexityData?.score || 0),
      'OS Status': osCompat.compatibilityStatus,
      'Has Blocker': hasBlocker ? 'Yes' : 'No',
      'vCPUs': vm.cpus,
      'Memory (GiB)': Math.round(mibToGiB(vm.memory)),
      'Storage (GiB)': Math.round(mibToGiB(vm.provisionedMiB)),
    };
  });
  const waveSheet = XLSX.utils.json_to_sheet(waveData);
  XLSX.utils.book_append_sheet(workbook, waveSheet, 'Wave Planning');

  // ===== Host List Sheet =====
  const hostData = rawData.vHost.map((host: VHostInfo) => ({
    'Host Name': host.name,
    'Power State': host.powerState,
    'Connection State': host.connectionState,
    'ESXi Version': host.esxiVersion,
    'ESXi Build': host.esxiBuild,
    'CPU Model': host.cpuModel,
    'CPU Sockets': host.cpuSockets,
    'Cores/Socket': host.coresPerSocket,
    'Total Cores': host.totalCpuCores,
    'CPU MHz': host.cpuMHz,
    'Memory (GiB)': Math.round(mibToGiB(host.memoryMiB)),
    'VM Count': host.vmCount,
    'Cluster': host.cluster,
    'Datacenter': host.datacenter,
  }));
  const hostSheet = XLSX.utils.json_to_sheet(hostData);
  XLSX.utils.book_append_sheet(workbook, hostSheet, 'Host List');

  // ===== Datastore List Sheet =====
  const datastoreData = rawData.vDatastore.map((ds: VDatastoreInfo) => ({
    'Datastore Name': ds.name,
    'Type': ds.type,
    'Capacity (GiB)': Math.round(mibToGiB(ds.capacityMiB)),
    'Free Space (GiB)': Math.round(mibToGiB(ds.freeMiB)),
    'Used (%)': ds.capacityMiB > 0 ? Math.round(((ds.capacityMiB - ds.freeMiB) / ds.capacityMiB) * 100) : 0,
    'VM Count': ds.vmCount,
    'Host Count': ds.hostCount,
    'Datacenter': ds.datacenter,
  }));
  const datastoreSheet = XLSX.utils.json_to_sheet(datastoreData);
  XLSX.utils.book_append_sheet(workbook, datastoreSheet, 'Datastore List');

  return workbook;
}

export function downloadExcel(rawData: RVToolsData, filename = 'rvtools-analysis.xlsx'): void {
  const workbook = generateExcelReport(rawData);
  XLSX.writeFile(workbook, filename);
}

// Pre-flight check Excel export
export function exportPreFlightExcel(
  results: VMCheckResults[],
  mode: CheckMode
): void {
  const checksForMode = getChecksForMode(mode);
  const workbook = XLSX.utils.book_new();

  // ===== Main Results Sheet =====
  const headers = [
    'VM Name',
    'Cluster',
    'Host',
    'Guest OS',
    'Blockers',
    'Warnings',
    'Status',
    ...checksForMode.map((c) => c.name),
  ];

  const rows = results.map((r) => [
    r.vmName,
    r.cluster,
    r.host,
    r.guestOS,
    r.blockerCount,
    r.warningCount,
    r.blockerCount > 0 ? 'Blocked' : r.warningCount > 0 ? 'Warnings' : 'Ready',
    ...checksForMode.map((c) => {
      const result = r.checks[c.id];
      if (!result) return 'N/A';
      if (result.status === 'pass') return 'PASS';
      if (result.status === 'fail') {
        const details = result.message || (result.value !== undefined ? `Value: ${result.value}` : '');
        return details ? `FAIL - ${details}` : 'FAIL';
      }
      if (result.status === 'warn') {
        const details = result.message || (result.value !== undefined ? `Value: ${result.value}` : '');
        return details ? `WARN - ${details}` : 'WARN';
      }
      return 'N/A';
    }),
  ]);

  const mainSheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);

  // Set column widths
  mainSheet['!cols'] = [
    { wch: 40 }, // VM Name
    { wch: 20 }, // Cluster
    { wch: 20 }, // Host
    { wch: 35 }, // Guest OS
    { wch: 10 }, // Blockers
    { wch: 10 }, // Warnings
    { wch: 12 }, // Status
    ...checksForMode.map(() => ({ wch: 30 })),
  ];

  XLSX.utils.book_append_sheet(workbook, mainSheet, `${mode.toUpperCase()} Pre-Flight`);

  // ===== Summary Sheet =====
  const vmsWithBlockers = results.filter((r) => r.blockerCount > 0).length;
  const vmsWithWarningsOnly = results.filter((r) => r.warningCount > 0 && r.blockerCount === 0).length;
  const vmsReady = results.filter((r) => r.blockerCount === 0 && r.warningCount === 0).length;

  const summaryData = [
    ['Pre-Flight Check Summary', ''],
    [''],
    ['Report Details', ''],
    ['Generated', new Date().toLocaleString()],
    ['Target Platform', mode.toUpperCase()],
    ['Total Checks per VM', checksForMode.length],
    [''],
    ['VM Summary', ''],
    ['Total VMs Analyzed', results.length],
    ['VMs with Blockers', vmsWithBlockers],
    ['VMs with Warnings Only', vmsWithWarningsOnly],
    ['VMs Ready to Migrate', vmsReady],
    ['Readiness Percentage', `${((vmsReady / results.length) * 100).toFixed(1)}%`],
    [''],
    ['Check Failure Summary', ''],
    ['Check Name', 'Failures', 'Severity'],
    ...checksForMode.map((c) => [
      c.name,
      results.filter((r) => r.checks[c.id]?.status === 'fail' || r.checks[c.id]?.status === 'warn').length,
      c.severity.charAt(0).toUpperCase() + c.severity.slice(1),
    ]),
  ];

  const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
  summarySheet['!cols'] = [{ wch: 35 }, { wch: 15 }, { wch: 15 }];
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');

  // ===== Blockers Only Sheet =====
  const blockedVMs = results.filter((r) => r.blockerCount > 0);
  if (blockedVMs.length > 0) {
    const blockerHeaders = ['VM Name', 'Cluster', 'Guest OS', 'Blocker Count', 'Blocking Checks'];
    const blockerRows = blockedVMs.map((r) => {
      const blockingChecks = checksForMode
        .filter((c) => c.severity === 'blocker' && r.checks[c.id]?.status === 'fail')
        .map((c) => c.name)
        .join(', ');
      return [r.vmName, r.cluster, r.guestOS, r.blockerCount, blockingChecks];
    });

    const blockerSheet = XLSX.utils.aoa_to_sheet([blockerHeaders, ...blockerRows]);
    blockerSheet['!cols'] = [{ wch: 40 }, { wch: 20 }, { wch: 35 }, { wch: 15 }, { wch: 60 }];
    XLSX.utils.book_append_sheet(workbook, blockerSheet, 'Blocked VMs');
  }

  // ===== Check Definitions Sheet =====
  const checkDefHeaders = ['Check ID', 'Check Name', 'Short Name', 'Category', 'Severity', 'Description', 'Applies To'];
  const checkDefRows = checksForMode.map((c) => [
    c.id,
    c.name,
    c.shortName,
    c.category.charAt(0).toUpperCase() + c.category.slice(1),
    c.severity.charAt(0).toUpperCase() + c.severity.slice(1),
    c.description,
    c.modes.map((m) => m.toUpperCase()).join(', '),
  ]);

  const checkDefSheet = XLSX.utils.aoa_to_sheet([checkDefHeaders, ...checkDefRows]);
  checkDefSheet['!cols'] = [
    { wch: 20 },
    { wch: 30 },
    { wch: 15 },
    { wch: 12 },
    { wch: 12 },
    { wch: 60 },
    { wch: 15 },
  ];
  XLSX.utils.book_append_sheet(workbook, checkDefSheet, 'Check Definitions');

  // Download the file
  const filename = `preflight-report-${mode}-${new Date().toISOString().split('T')[0]}.xlsx`;
  XLSX.writeFile(workbook, filename);
}
