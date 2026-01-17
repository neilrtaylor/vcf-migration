// Environment Analysis Section

import { Paragraph, PageBreak, HeadingLevel, AlignmentType } from 'docx';
import type { RVToolsData, VirtualMachine, VNetworkInfo } from '@/types/rvtools';
import { mibToGiB, mibToTiB } from '@/utils/formatters';
import reportTemplates from '@/data/reportTemplates.json';
import { CHART_COLORS, type DocumentContent, type ChartData } from '../types';
import { createHeading, createParagraph, createStyledTable } from '../utils/helpers';
import { generatePieChart, createChartParagraph } from '../utils/charts';

export async function buildEnvironmentAnalysis(rawData: RVToolsData): Promise<DocumentContent[]> {
  const templates = reportTemplates.environmentAnalysis;
  const vms = rawData.vInfo.filter((vm) => !vm.template);
  const poweredOnVMs = vms.filter((vm) => vm.powerState === 'poweredOn');

  const totalVCPUs = poweredOnVMs.reduce((sum, vm) => sum + vm.cpus, 0);
  const totalMemoryGiB = poweredOnVMs.reduce((sum, vm) => sum + mibToGiB(vm.memory), 0);
  const totalVMStorageGiB = poweredOnVMs.reduce((sum, vm) => sum + mibToGiB(vm.provisionedMiB), 0);
  const avgStoragePerVM = poweredOnVMs.length > 0 ? totalVMStorageGiB / poweredOnVMs.length : 0;

  const totalDatastoreCapacity = rawData.vDatastore.reduce((sum, ds) => sum + ds.capacityMiB, 0);
  const totalDatastoreUsed = rawData.vDatastore.reduce((sum, ds) => sum + ds.inUseMiB, 0);

  const totalNICs = rawData.vNetwork.length;
  const uniquePortGroups = new Set(rawData.vNetwork.map((n: VNetworkInfo) => n.networkName)).size;
  const uniqueSwitches = new Set(rawData.vNetwork.map((n: VNetworkInfo) => n.switchName)).size;

  // Generate vCPU distribution chart
  const vcpuBuckets = [
    { label: '1-2 vCPUs', min: 1, max: 2 },
    { label: '3-4 vCPUs', min: 3, max: 4 },
    { label: '5-8 vCPUs', min: 5, max: 8 },
    { label: '9-16 vCPUs', min: 9, max: 16 },
    { label: '17+ vCPUs', min: 17, max: Infinity },
  ];
  const vcpuData: ChartData[] = vcpuBuckets.map((bucket, index) => ({
    label: bucket.label,
    value: poweredOnVMs.filter(vm => vm.cpus >= bucket.min && vm.cpus <= bucket.max).length,
    color: CHART_COLORS[index % CHART_COLORS.length],
  })).filter(d => d.value > 0);

  const vcpuChart = await generatePieChart(vcpuData, 'vCPU Distribution');

  // Generate memory distribution chart
  const memBuckets = [
    { label: '0-4 GiB', min: 0, max: 4 },
    { label: '5-8 GiB', min: 5, max: 8 },
    { label: '9-16 GiB', min: 9, max: 16 },
    { label: '17-32 GiB', min: 17, max: 32 },
    { label: '33-64 GiB', min: 33, max: 64 },
    { label: '65+ GiB', min: 65, max: Infinity },
  ];
  const memData: ChartData[] = memBuckets.map((bucket, index) => {
    const memGiB = (vm: VirtualMachine) => mibToGiB(vm.memory);
    return {
      label: bucket.label,
      value: poweredOnVMs.filter(vm => memGiB(vm) >= bucket.min && memGiB(vm) <= bucket.max).length,
      color: CHART_COLORS[index % CHART_COLORS.length],
    };
  }).filter(d => d.value > 0);

  const memChart = await generatePieChart(memData, 'Memory Distribution');

  // Generate datastore type distribution chart
  const datastoreTypes = rawData.vDatastore.reduce((acc, ds) => {
    const type = ds.type || 'Other';
    acc[type] = (acc[type] || 0) + mibToGiB(ds.capacityMiB);
    return acc;
  }, {} as Record<string, number>);

  const dsTypeData: ChartData[] = Object.entries(datastoreTypes).map(([type, capacity], index) => ({
    label: type,
    value: Math.round(capacity),
    color: CHART_COLORS[index % CHART_COLORS.length],
  }));

  const dsTypeChart = await generatePieChart(dsTypeData, 'Storage by Type (GiB)');

  return [
    createHeading('2. ' + templates.title, HeadingLevel.HEADING_1),
    createParagraph(templates.introduction),

    createHeading('2.1 ' + templates.sections.infrastructure.title, HeadingLevel.HEADING_2),
    createParagraph(templates.sections.infrastructure.description),
    createStyledTable(
      ['Component', 'Count'],
      [
        ['vCenter Servers', `${rawData.vSource.length}`],
        ['Clusters', `${rawData.vCluster.length}`],
        ['ESXi Hosts', `${rawData.vHost.length}`],
        ['Virtual Machines', `${vms.length}`],
        ['Datastores', `${rawData.vDatastore.length}`],
      ],
      { columnAligns: [AlignmentType.LEFT, AlignmentType.RIGHT] }
    ),

    new Paragraph({ spacing: { before: 240 } }),
    createHeading('2.2 ' + templates.sections.compute.title, HeadingLevel.HEADING_2),
    createParagraph(templates.sections.compute.description),
    createStyledTable(
      ['Resource', 'Value'],
      [
        ['Total vCPUs Allocated', `${totalVCPUs.toLocaleString()}`],
        ['Total Memory Allocated', `${(totalMemoryGiB / 1024).toFixed(1)} TiB`],
        ['Average vCPUs per VM', `${poweredOnVMs.length > 0 ? (totalVCPUs / poweredOnVMs.length).toFixed(1) : 0}`],
        ['Average Memory per VM', `${poweredOnVMs.length > 0 ? (totalMemoryGiB / poweredOnVMs.length).toFixed(0) : 0} GiB`],
      ],
      { columnAligns: [AlignmentType.LEFT, AlignmentType.RIGHT] }
    ),

    createChartParagraph(vcpuChart, 480, 260),
    createChartParagraph(memChart, 480, 260),

    new Paragraph({ spacing: { before: 240 } }),
    createHeading('2.3 ' + templates.sections.storage.title, HeadingLevel.HEADING_2),
    createParagraph(templates.sections.storage.description),
    createStyledTable(
      ['Metric', 'Value'],
      [
        ['Total Datastore Capacity', `${mibToTiB(totalDatastoreCapacity).toFixed(1)} TiB`],
        ['Total Datastore Used', `${mibToTiB(totalDatastoreUsed).toFixed(1)} TiB`],
        ['Datastore Utilization', `${totalDatastoreCapacity > 0 ? ((totalDatastoreUsed / totalDatastoreCapacity) * 100).toFixed(0) : 0}%`],
        ['Total VM Storage Provisioned', `${(totalVMStorageGiB / 1024).toFixed(1)} TiB`],
        ['Average Storage per VM', `${avgStoragePerVM.toFixed(0)} GiB`],
      ],
      { columnAligns: [AlignmentType.LEFT, AlignmentType.RIGHT] }
    ),

    createChartParagraph(dsTypeChart, 480, 260),

    new Paragraph({ spacing: { before: 240 } }),
    createHeading('2.4 ' + templates.sections.network.title, HeadingLevel.HEADING_2),
    createParagraph(templates.sections.network.description),
    createStyledTable(
      ['Component', 'Count'],
      [
        ['Total NICs', `${totalNICs}`],
        ['Port Groups', `${uniquePortGroups}`],
        ['Virtual Switches', `${uniqueSwitches}`],
      ],
      { columnAligns: [AlignmentType.LEFT, AlignmentType.RIGHT] }
    ),

    new Paragraph({ children: [new PageBreak()] }),
  ];
}
