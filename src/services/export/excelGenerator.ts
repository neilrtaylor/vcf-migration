// Excel export service using SheetJS
import * as XLSX from 'xlsx';
import type { RVToolsData, VirtualMachine, VHostInfo, VDatastoreInfo, VSnapshotInfo, VCDInfo, VDiskInfo, VNetworkInfo, VToolsInfo } from '@/types/rvtools';
import { mibToGiB, formatHardwareVersion, getHardwareVersionNumber } from '@/utils/formatters';
import { HW_VERSION_MINIMUM, HW_VERSION_RECOMMENDED, SNAPSHOT_BLOCKER_AGE_DAYS } from '@/utils/constants';
import osCompatibilityData from '@/data/redhatOSCompatibility.json';
import ibmCloudProfiles from '@/data/ibmCloudProfiles.json';

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

  // ===== ROKS Sizing Sheet =====
  const { defaults } = ibmCloudProfiles;
  const totalVCPUs = poweredOnVMs.reduce((sum: number, vm: VirtualMachine) => sum + vm.cpus, 0);
  const totalMemoryGiB = poweredOnVMs.reduce((sum: number, vm: VirtualMachine) => sum + mibToGiB(vm.memory), 0);
  const totalStorageGiB = poweredOnVMs.reduce((sum: number, vm: VirtualMachine) => sum + mibToGiB(vm.provisionedMiB), 0);

  const adjustedVCPUs = Math.ceil(totalVCPUs / defaults.cpuOvercommitRatio);
  const adjustedMemoryGiB = Math.ceil(totalMemoryGiB / defaults.memoryOvercommitRatio);
  const odfStorageGiB = Math.ceil(totalStorageGiB * defaults.odfReplicationFactor / defaults.odfEfficiencyFactor);

  const recommendedProfile = ibmCloudProfiles.roksWorkerProfiles.find(p =>
    p.vcpus >= 32 && p.memoryGiB >= 128
  ) || ibmCloudProfiles.roksWorkerProfiles[3];

  const workersForCPU = Math.ceil(adjustedVCPUs / (recommendedProfile.vcpus * 0.85));
  const workersForMemory = Math.ceil(adjustedMemoryGiB / (recommendedProfile.memoryGiB * 0.85));
  const recommendedWorkers = Math.max(defaults.minWorkerNodes, workersForCPU, workersForMemory);

  const roksData = [
    ['ROKS Cluster Sizing', ''],
    [''],
    ['Source Environment', ''],
    ['Total VMs', poweredOnVMs.length],
    ['Total vCPUs', totalVCPUs],
    ['Total Memory (GiB)', Math.round(totalMemoryGiB)],
    ['Total Storage (GiB)', Math.round(totalStorageGiB)],
    [''],
    ['Adjusted Requirements', ''],
    ['Adjusted vCPUs (1.5:1 ratio)', adjustedVCPUs],
    ['Adjusted Memory (1.2:1 ratio)', Math.round(adjustedMemoryGiB)],
    ['ODF Storage (3x replication)', Math.round(odfStorageGiB / 1024) + ' TiB'],
    [''],
    ['Recommended ROKS Configuration', ''],
    ['Worker Profile', recommendedProfile.name],
    ['Worker Count', recommendedWorkers],
    ['Total Cluster vCPUs', recommendedWorkers * recommendedProfile.vcpus],
    ['Total Cluster Memory (GiB)', recommendedWorkers * recommendedProfile.memoryGiB],
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
