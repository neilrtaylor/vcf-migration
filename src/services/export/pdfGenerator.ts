// Enhanced PDF generation service using jsPDF with visualizations
import jsPDF from 'jspdf';
import type { RVToolsData, VirtualMachine, VHostInfo, VDatastoreInfo, VNetworkInfo } from '@/types/rvtools';
import type { MigrationInsights } from '@/services/ai/types';
import { mibToGiB, mibToTiB, formatNumber } from '@/utils/formatters';
import { isVMwareInfrastructureVM } from '@/utils/autoExclusion';

// Export options interface
export interface PDFExportOptions {
  includeDashboard?: boolean;
  includeCompute?: boolean;
  includeStorage?: boolean;
  includeNetwork?: boolean;
  includeClusters?: boolean;
  includeHosts?: boolean;
  includeResourcePools?: boolean;
  aiInsights?: MigrationInsights | null;
}

const DEFAULT_OPTIONS: Required<PDFExportOptions> = {
  includeDashboard: true,
  includeCompute: true,
  includeStorage: true,
  includeNetwork: true,
  includeClusters: true,
  includeHosts: true,
  includeResourcePools: true,
  aiInsights: null,
};

// IBM Carbon Design System Colors
const COLORS = {
  // Primary
  blue60: '#0f62fe',
  blue50: '#4589ff',
  blue40: '#78a9ff',
  // Teal
  teal50: '#009d9a',
  teal40: '#08bdba',
  // Green
  green50: '#24a148',
  green40: '#42be65',
  // Yellow
  yellow40: '#f1c21b',
  // Orange
  orange40: '#ff832b',
  // Red
  red60: '#da1e28',
  red50: '#fa4d56',
  // Purple
  purple60: '#8a3ffc',
  purple50: '#a56eff',
  // Magenta
  magenta50: '#ee5396',
  // Grays
  gray100: '#161616',
  gray80: '#393939',
  gray70: '#525252',
  gray60: '#6f6f6f',
  gray50: '#8d8d8d',
  gray30: '#c6c6c6',
  gray20: '#e0e0e0',
  gray10: '#f4f4f4',
  white: '#ffffff',
};

// Chart color palettes
const CHART_COLORS = [
  COLORS.blue60, COLORS.teal50, COLORS.purple60, COLORS.green50,
  COLORS.magenta50, COLORS.orange40, COLORS.blue40, COLORS.teal40,
  COLORS.purple50, COLORS.green40, COLORS.red50, COLORS.yellow40,
];

const POWER_STATE_COLORS = {
  poweredOn: COLORS.green50,
  poweredOff: COLORS.gray60,
  suspended: COLORS.yellow40,
};

// PDF Constants
const PAGE_WIDTH = 210; // A4 width in mm
const PAGE_HEIGHT = 297; // A4 height in mm
const MARGIN = 15;
const CONTENT_WIDTH = PAGE_WIDTH - (MARGIN * 2);

// Font sizes
const FONT = {
  title: 24,
  sectionTitle: 16,
  subsectionTitle: 12,
  body: 10,
  small: 8,
  tiny: 7,
};

// Helper to convert hex to RGB
function hexToRgb(hex: string): [number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)]
    : [0, 0, 0];
}

export class EnhancedPDFGenerator {
  private doc: jsPDF;
  private currentY: number;
  private pageNumber: number;

  constructor() {
    this.doc = new jsPDF('p', 'mm', 'a4');
    this.currentY = MARGIN;
    this.pageNumber = 1;
  }

  async generate(data: RVToolsData, options: PDFExportOptions = {}): Promise<Blob> {
    const opts = { ...DEFAULT_OPTIONS, ...options };

    // Filter VMs
    const allVMs = data.vInfo.filter(vm => !vm.template && !isVMwareInfrastructureVM(vm.vmName, vm.guestOS));
    const poweredOnVMs = allVMs.filter(vm => vm.powerState === 'poweredOn');

    // Cover page
    this.addCoverPage(data, allVMs);

    // Dashboard section
    if (opts.includeDashboard) {
      this.addNewPage();
      this.addDashboardSection(data, allVMs, poweredOnVMs);
    }

    // Compute section
    if (opts.includeCompute) {
      this.addNewPage();
      this.addComputeSection(allVMs, poweredOnVMs);
    }

    // Storage section
    if (opts.includeStorage) {
      this.addNewPage();
      this.addStorageSection(data, allVMs);
    }

    // Network section
    if (opts.includeNetwork) {
      this.addNewPage();
      this.addNetworkSection(data, poweredOnVMs);
    }

    // Clusters section
    if (opts.includeClusters) {
      this.addNewPage();
      this.addClustersSection(data, allVMs);
    }

    // Hosts section
    if (opts.includeHosts) {
      this.addNewPage();
      this.addHostsSection(data);
    }

    // Resource Pools section
    if (opts.includeResourcePools && data.vResourcePool && data.vResourcePool.length > 0) {
      this.addNewPage();
      this.addResourcePoolsSection(data);
    }

    // AI Insights page
    if (opts.aiInsights) {
      this.addNewPage();
      this.addAIInsightsPage(opts.aiInsights);
    }

    // Add page numbers
    this.addPageNumbers();

    return this.doc.output('blob');
  }

  // ===== COVER PAGE =====
  private addCoverPage(data: RVToolsData, vms: VirtualMachine[]): void {
    // Background gradient effect (using rectangles)
    this.doc.setFillColor(...hexToRgb(COLORS.blue60));
    this.doc.rect(0, 0, PAGE_WIDTH, 100, 'F');

    // Decorative element
    this.doc.setFillColor(...hexToRgb(COLORS.teal50));
    this.doc.rect(0, 95, PAGE_WIDTH, 5, 'F');

    // Title
    this.doc.setTextColor(...hexToRgb(COLORS.white));
    this.doc.setFontSize(28);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('VMware Infrastructure', PAGE_WIDTH / 2, 45, { align: 'center' });
    this.doc.text('Analysis Report', PAGE_WIDTH / 2, 58, { align: 'center' });

    // Subtitle
    this.doc.setFontSize(14);
    this.doc.setFont('helvetica', 'normal');
    this.doc.text('Comprehensive Environment Assessment', PAGE_WIDTH / 2, 75, { align: 'center' });

    // Reset text color
    this.doc.setTextColor(...hexToRgb(COLORS.gray100));

    // File info box
    this.currentY = 120;
    this.doc.setFillColor(...hexToRgb(COLORS.gray10));
    this.doc.roundedRect(MARGIN, this.currentY, CONTENT_WIDTH, 45, 3, 3, 'F');

    this.doc.setFontSize(FONT.body);
    this.doc.setTextColor(...hexToRgb(COLORS.gray70));
    this.currentY += 10;
    this.doc.text(`Source File: ${data.metadata.fileName}`, MARGIN + 10, this.currentY);
    this.currentY += 8;
    if (data.metadata.collectionDate) {
      this.doc.text(`Collection Date: ${data.metadata.collectionDate.toLocaleDateString()}`, MARGIN + 10, this.currentY);
      this.currentY += 8;
    }
    this.doc.text(`Report Generated: ${new Date().toLocaleString()}`, MARGIN + 10, this.currentY);
    this.currentY += 8;
    this.doc.text(`Total VMs Analyzed: ${formatNumber(vms.length)}`, MARGIN + 10, this.currentY);

    // Quick stats grid
    this.currentY = 185;
    const stats = [
      { label: 'Virtual Machines', value: formatNumber(vms.length), color: COLORS.blue60 },
      { label: 'ESXi Hosts', value: formatNumber(data.vHost.length), color: COLORS.teal50 },
      { label: 'Clusters', value: formatNumber(data.vCluster.length), color: COLORS.purple60 },
      { label: 'Datastores', value: formatNumber(data.vDatastore.length), color: COLORS.green50 },
    ];

    const statWidth = (CONTENT_WIDTH - 15) / 4;
    stats.forEach((stat, i) => {
      const x = MARGIN + (i * (statWidth + 5));
      this.drawMetricCard(x, this.currentY, statWidth, 35, stat.value, stat.label, stat.color);
    });

    // Footer
    this.doc.setFontSize(FONT.small);
    this.doc.setTextColor(...hexToRgb(COLORS.gray60));
    this.doc.text('Generated by VCF Migration Tool', PAGE_WIDTH / 2, PAGE_HEIGHT - 20, { align: 'center' });
  }

  // ===== DASHBOARD SECTION =====
  private addDashboardSection(data: RVToolsData, vms: VirtualMachine[], poweredOnVMs: VirtualMachine[]): void {
    this.addSectionTitle('Dashboard Overview');

    // Calculate metrics
    const totalVCPUs = vms.reduce((sum, vm) => sum + vm.cpus, 0);
    const totalMemoryGiB = Math.round(vms.reduce((sum, vm) => sum + mibToGiB(vm.memory), 0));
    const totalStorageTiB = (vms.reduce((sum, vm) => sum + mibToGiB(vm.provisionedMiB), 0) / 1024).toFixed(1);
    const poweredOff = vms.filter(vm => vm.powerState === 'poweredOff').length;
    const suspended = vms.filter(vm => vm.powerState === 'suspended').length;

    // Metric cards row
    const metrics = [
      { label: 'Total VMs', value: formatNumber(vms.length), color: COLORS.blue60 },
      { label: 'Powered On', value: formatNumber(poweredOnVMs.length), color: COLORS.green50 },
      { label: 'Total vCPUs', value: formatNumber(totalVCPUs), color: COLORS.teal50 },
      { label: 'Total Memory', value: `${formatNumber(totalMemoryGiB)} GiB`, color: COLORS.purple60 },
    ];

    const cardWidth = (CONTENT_WIDTH - 15) / 4;
    metrics.forEach((m, i) => {
      this.drawMetricCard(MARGIN + (i * (cardWidth + 5)), this.currentY, cardWidth, 28, m.value, m.label, m.color);
    });
    this.currentY += 35;

    // Second row of metrics
    const metrics2 = [
      { label: 'Provisioned Storage', value: `${totalStorageTiB} TiB`, color: COLORS.purple60 },
      { label: 'Powered Off', value: formatNumber(poweredOff), color: COLORS.gray60 },
      { label: 'ESXi Hosts', value: formatNumber(data.vHost.length), color: COLORS.teal50 },
      { label: 'Clusters', value: formatNumber(data.vCluster.length), color: COLORS.blue60 },
    ];
    metrics2.forEach((m, i) => {
      this.drawMetricCard(MARGIN + (i * (cardWidth + 5)), this.currentY, cardWidth, 28, m.value, m.label, m.color);
    });
    this.currentY += 38;

    // Charts row - Power State and OS Distribution
    const chartWidth = (CONTENT_WIDTH - 10) / 2;
    const chartHeight = 65;

    // Check if we need a page break
    this.ensureSpace(chartHeight + 10);

    // Power State Pie Chart
    const powerStateData = [
      { label: 'Powered On', value: poweredOnVMs.length, color: POWER_STATE_COLORS.poweredOn },
      { label: 'Powered Off', value: poweredOff, color: POWER_STATE_COLORS.poweredOff },
      { label: 'Suspended', value: suspended, color: POWER_STATE_COLORS.suspended },
    ].filter(d => d.value > 0);

    this.drawPieChart(MARGIN, this.currentY, chartWidth, chartHeight, 'Power State Distribution', powerStateData);

    // OS Distribution Bar Chart
    const osDistribution = this.getOSDistribution(vms).slice(0, 8);
    this.drawHorizontalBarChart(
      MARGIN + chartWidth + 10, this.currentY, chartWidth, chartHeight,
      'Top Operating Systems', osDistribution, 'VMs'
    );
    this.currentY += chartHeight + 10;

    // Second charts row - VMs by Cluster and Hardware Version
    this.ensureSpace(chartHeight + 10);

    const clusterDistribution = this.getClusterDistribution(vms).slice(0, 8);
    this.drawHorizontalBarChart(
      MARGIN, this.currentY, chartWidth, chartHeight,
      'VMs by Cluster', clusterDistribution, 'VMs'
    );

    // Hardware Version Distribution
    const hwVersionData = this.getHardwareVersionDistribution(vms);
    this.drawPieChart(MARGIN + chartWidth + 10, this.currentY, chartWidth, chartHeight, 'Hardware Versions', hwVersionData);
    this.currentY += chartHeight + 10;

    // VMware Tools Status
    this.ensureSpace(chartHeight + 10);
    const toolsData = this.getToolsStatusDistribution(data, poweredOnVMs);
    this.drawPieChart(MARGIN, this.currentY, chartWidth, chartHeight, 'VMware Tools Status', toolsData);
  }

  // ===== COMPUTE SECTION =====
  private addComputeSection(vms: VirtualMachine[], poweredOnVMs: VirtualMachine[]): void {
    this.addSectionTitle('Compute Analysis');

    const totalVCPUs = vms.reduce((sum, vm) => sum + vm.cpus, 0);
    const poweredOnVCPUs = poweredOnVMs.reduce((sum, vm) => sum + vm.cpus, 0);
    const totalMemoryGiB = Math.round(vms.reduce((sum, vm) => sum + mibToGiB(vm.memory), 0));
    const poweredOnMemoryGiB = Math.round(poweredOnVMs.reduce((sum, vm) => sum + mibToGiB(vm.memory), 0));
    const avgVCPU = vms.length > 0 ? (totalVCPUs / vms.length).toFixed(1) : '0';
    const avgMemory = vms.length > 0 ? (totalMemoryGiB / vms.length).toFixed(1) : '0';

    // Metric cards
    const cardWidth = (CONTENT_WIDTH - 15) / 4;
    const metrics = [
      { label: 'Total vCPUs', value: formatNumber(totalVCPUs), color: COLORS.blue60 },
      { label: 'Powered On vCPUs', value: formatNumber(poweredOnVCPUs), color: COLORS.green50 },
      { label: 'Total Memory', value: `${formatNumber(totalMemoryGiB)} GiB`, color: COLORS.purple60 },
      { label: 'Powered On Memory', value: `${formatNumber(poweredOnMemoryGiB)} GiB`, color: COLORS.teal50 },
    ];
    metrics.forEach((m, i) => {
      this.drawMetricCard(MARGIN + (i * (cardWidth + 5)), this.currentY, cardWidth, 28, m.value, m.label, m.color);
    });
    this.currentY += 35;

    // Averages row
    const metrics2 = [
      { label: 'Avg vCPU/VM', value: avgVCPU, color: COLORS.blue60 },
      { label: 'Avg Memory/VM', value: `${avgMemory} GiB`, color: COLORS.purple60 },
    ];
    const cardWidth2 = (CONTENT_WIDTH - 5) / 2;
    metrics2.forEach((m, i) => {
      this.drawMetricCard(MARGIN + (i * (cardWidth2 + 5)), this.currentY, cardWidth2, 25, m.value, m.label, m.color);
    });
    this.currentY += 35;

    // CPU Distribution Chart
    const chartHeight = 65;
    this.ensureSpace(chartHeight + 10);

    const cpuDistribution = this.getCPUDistribution(vms);
    const chartWidth = (CONTENT_WIDTH - 10) / 2;
    this.drawVerticalBarChart(MARGIN, this.currentY, chartWidth, chartHeight, 'vCPU Distribution', cpuDistribution, 'VMs');

    // Memory Distribution Chart
    const memoryDistribution = this.getMemoryDistribution(vms);
    this.drawVerticalBarChart(MARGIN + chartWidth + 10, this.currentY, chartWidth, chartHeight, 'Memory Distribution', memoryDistribution, 'VMs');
    this.currentY += chartHeight + 10;

    // Top CPU Consumers
    const topChartHeight = 70;
    this.ensureSpace(topChartHeight + 10);

    const topCPU = [...vms].sort((a, b) => b.cpus - a.cpus).slice(0, 10)
      .map(vm => ({ label: vm.vmName.substring(0, 25), value: vm.cpus }));
    this.drawHorizontalBarChart(MARGIN, this.currentY, chartWidth, topChartHeight, 'Top 10 CPU Consumers', topCPU, 'vCPUs');

    // Top Memory Consumers
    const topMemory = [...vms].sort((a, b) => b.memory - a.memory).slice(0, 10)
      .map(vm => ({ label: vm.vmName.substring(0, 25), value: Math.round(mibToGiB(vm.memory)) }));
    this.drawHorizontalBarChart(MARGIN + chartWidth + 10, this.currentY, chartWidth, topChartHeight, 'Top 10 Memory Consumers', topMemory, 'GiB');
  }

  // ===== STORAGE SECTION =====
  private addStorageSection(data: RVToolsData, vms: VirtualMachine[]): void {
    this.addSectionTitle('Storage Analysis');

    const datastores = data.vDatastore;
    const totalCapacityTiB = mibToTiB(datastores.reduce((sum, ds) => sum + ds.capacityMiB, 0));
    const totalUsedTiB = mibToTiB(datastores.reduce((sum, ds) => sum + ds.inUseMiB, 0));
    const totalFreeTiB = mibToTiB(datastores.reduce((sum, ds) => sum + ds.freeMiB, 0));
    const avgUtilization = totalCapacityTiB > 0 ? ((totalUsedTiB / totalCapacityTiB) * 100).toFixed(1) : '0';

    const vmProvisionedTiB = mibToTiB(vms.reduce((sum, vm) => sum + vm.provisionedMiB, 0));
    const vmInUseTiB = mibToTiB(vms.reduce((sum, vm) => sum + vm.inUseMiB, 0));

    // Metric cards
    const cardWidth = (CONTENT_WIDTH - 15) / 4;
    const metrics = [
      { label: 'Total Capacity', value: `${totalCapacityTiB.toFixed(1)} TiB`, color: COLORS.blue60 },
      { label: 'Used Storage', value: `${totalUsedTiB.toFixed(1)} TiB`, color: COLORS.purple60 },
      { label: 'Free Storage', value: `${totalFreeTiB.toFixed(1)} TiB`, color: COLORS.green50 },
      { label: 'Avg Utilization', value: `${avgUtilization}%`, color: COLORS.teal50 },
    ];
    metrics.forEach((m, i) => {
      this.drawMetricCard(MARGIN + (i * (cardWidth + 5)), this.currentY, cardWidth, 28, m.value, m.label, m.color);
    });
    this.currentY += 35;

    // VM storage metrics
    const metrics2 = [
      { label: 'VM Provisioned', value: `${vmProvisionedTiB.toFixed(1)} TiB`, color: COLORS.purple60 },
      { label: 'VM In-Use', value: `${vmInUseTiB.toFixed(1)} TiB`, color: COLORS.blue60 },
      { label: 'Datastores', value: formatNumber(datastores.length), color: COLORS.teal50 },
    ];
    const cardWidth2 = (CONTENT_WIDTH - 10) / 3;
    metrics2.forEach((m, i) => {
      this.drawMetricCard(MARGIN + (i * (cardWidth2 + 5)), this.currentY, cardWidth2, 25, m.value, m.label, m.color);
    });
    this.currentY += 35;

    // Storage by Type Pie Chart
    const chartWidth = (CONTENT_WIDTH - 10) / 2;
    const chartHeight = 65;
    this.ensureSpace(chartHeight + 10);

    const typeDistribution = this.getDatastoreTypeDistribution(datastores);
    this.drawPieChart(MARGIN, this.currentY, chartWidth, chartHeight, 'Storage by Type', typeDistribution);

    // High Utilization Datastores
    const highUtil = datastores
      .filter(ds => ds.capacityMiB > 0)
      .map(ds => ({
        label: ds.name.substring(0, 20),
        value: Math.round((ds.inUseMiB / ds.capacityMiB) * 100),
      }))
      .filter(d => d.value > 70)
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);

    if (highUtil.length > 0) {
      this.drawHorizontalBarChart(MARGIN + chartWidth + 10, this.currentY, chartWidth, chartHeight, 'High Utilization (>70%)', highUtil, '%');
    } else {
      // No high utilization - show top datastores instead
      const topDS = datastores
        .sort((a, b) => b.capacityMiB - a.capacityMiB)
        .slice(0, 8)
        .map(ds => ({ label: ds.name.substring(0, 20), value: Math.round(mibToGiB(ds.capacityMiB)) }));
      this.drawHorizontalBarChart(MARGIN + chartWidth + 10, this.currentY, chartWidth, chartHeight, 'Top Datastores by Capacity', topDS, 'GiB');
    }
    this.currentY += chartHeight + 10;

    // Top VMs by Storage
    const topChartHeight = 70;
    this.ensureSpace(topChartHeight + 10);

    const topStorage = [...vms].sort((a, b) => b.provisionedMiB - a.provisionedMiB).slice(0, 10)
      .map(vm => ({ label: vm.vmName.substring(0, 25), value: Math.round(mibToGiB(vm.provisionedMiB)) }));
    this.drawHorizontalBarChart(MARGIN, this.currentY, CONTENT_WIDTH, topChartHeight, 'Top 10 VMs by Storage', topStorage, 'GiB');
  }

  // ===== NETWORK SECTION =====
  private addNetworkSection(data: RVToolsData, poweredOnVMs: VirtualMachine[]): void {
    this.addSectionTitle('Network Analysis');

    const networks = data.vNetwork;
    const totalNICs = networks.length;
    const connectedNICs = networks.filter(n => n.connected).length;
    const uniquePortGroups = new Set(networks.map(n => n.networkName)).size;
    const uniqueSwitches = new Set(networks.map(n => n.switchName).filter(Boolean)).size;
    const avgNICs = poweredOnVMs.length > 0 ? (totalNICs / poweredOnVMs.length).toFixed(1) : '0';

    // Metric cards
    const cardWidth = (CONTENT_WIDTH - 15) / 4;
    const metrics = [
      { label: 'Total NICs', value: formatNumber(totalNICs), color: COLORS.blue60 },
      { label: 'Connected NICs', value: formatNumber(connectedNICs), color: COLORS.green50 },
      { label: 'Port Groups', value: formatNumber(uniquePortGroups), color: COLORS.teal50 },
      { label: 'Virtual Switches', value: formatNumber(uniqueSwitches), color: COLORS.purple60 },
    ];
    metrics.forEach((m, i) => {
      this.drawMetricCard(MARGIN + (i * (cardWidth + 5)), this.currentY, cardWidth, 28, m.value, m.label, m.color);
    });
    this.currentY += 35;

    // Avg NICs
    this.drawMetricCard(MARGIN, this.currentY, (CONTENT_WIDTH - 5) / 2, 25, avgNICs, 'Avg NICs per VM', COLORS.blue60);
    this.currentY += 35;

    // Adapter Type Distribution
    const chartWidth = (CONTENT_WIDTH - 10) / 2;
    const chartHeight = 65;
    this.ensureSpace(chartHeight + 10);

    const adapterTypes = this.getAdapterTypeDistribution(networks);
    this.drawPieChart(MARGIN, this.currentY, chartWidth, chartHeight, 'NIC Adapter Types', adapterTypes);

    // Connection Status
    const connectionData = [
      { label: 'Connected', value: connectedNICs, color: COLORS.green50 },
      { label: 'Disconnected', value: totalNICs - connectedNICs, color: COLORS.red60 },
    ].filter(d => d.value > 0);
    this.drawPieChart(MARGIN + chartWidth + 10, this.currentY, chartWidth, chartHeight, 'Connection Status', connectionData);
    this.currentY += chartHeight + 10;

    // VMs by NIC Count
    const smallChartHeight = 60;
    this.ensureSpace(smallChartHeight + 10);

    const nicCountDist = this.getVMsByNICCount(networks, poweredOnVMs);
    this.drawVerticalBarChart(MARGIN, this.currentY, chartWidth, smallChartHeight, 'VMs by NIC Count', nicCountDist, 'VMs');

    // Top Port Groups
    const portGroupCounts = networks.reduce((acc, n) => {
      acc[n.networkName] = (acc[n.networkName] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    const topPortGroups = Object.entries(portGroupCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([label, value]) => ({ label: label.substring(0, 20), value }));
    this.drawHorizontalBarChart(MARGIN + chartWidth + 10, this.currentY, chartWidth, smallChartHeight, 'Top Port Groups', topPortGroups, 'NICs');
  }

  // ===== CLUSTERS SECTION =====
  private addClustersSection(data: RVToolsData, vms: VirtualMachine[]): void {
    this.addSectionTitle('Cluster Analysis');

    const clusters = data.vCluster;
    const totalHosts = clusters.reduce((sum, c) => sum + c.hostCount, 0);
    const haEnabled = clusters.filter(c => c.haEnabled).length;
    const drsEnabled = clusters.filter(c => c.drsEnabled).length;
    const avgHostsPerCluster = clusters.length > 0 ? (totalHosts / clusters.length).toFixed(1) : '0';

    // Metric cards
    const cardWidth = (CONTENT_WIDTH - 15) / 4;
    const metrics = [
      { label: 'Total Clusters', value: formatNumber(clusters.length), color: COLORS.blue60 },
      { label: 'Total Hosts', value: formatNumber(totalHosts), color: COLORS.teal50 },
      { label: 'HA Enabled', value: formatNumber(haEnabled), color: COLORS.green50 },
      { label: 'DRS Enabled', value: formatNumber(drsEnabled), color: COLORS.purple60 },
    ];
    metrics.forEach((m, i) => {
      this.drawMetricCard(MARGIN + (i * (cardWidth + 5)), this.currentY, cardWidth, 28, m.value, m.label, m.color);
    });
    this.currentY += 35;

    // Averages
    const avgVMsPerCluster = clusters.length > 0 ? (vms.length / clusters.length).toFixed(1) : '0';
    const cardWidth2 = (CONTENT_WIDTH - 5) / 2;
    this.drawMetricCard(MARGIN, this.currentY, cardWidth2, 25, avgHostsPerCluster, 'Avg Hosts/Cluster', COLORS.teal50);
    this.drawMetricCard(MARGIN + cardWidth2 + 5, this.currentY, cardWidth2, 25, avgVMsPerCluster, 'Avg VMs/Cluster', COLORS.blue60);
    this.currentY += 35;

    // HA Status Pie
    const chartWidth = (CONTENT_WIDTH - 10) / 2;
    const chartHeight = 60;
    this.ensureSpace(chartHeight + 10);

    const haData = [
      { label: 'HA Enabled', value: haEnabled, color: COLORS.green50 },
      { label: 'HA Disabled', value: clusters.length - haEnabled, color: COLORS.red60 },
    ].filter(d => d.value > 0);
    this.drawPieChart(MARGIN, this.currentY, chartWidth, chartHeight, 'High Availability (HA)', haData);

    // DRS Status Pie
    const drsData = [
      { label: 'DRS Enabled', value: drsEnabled, color: COLORS.blue60 },
      { label: 'DRS Disabled', value: clusters.length - drsEnabled, color: COLORS.gray60 },
    ].filter(d => d.value > 0);
    this.drawPieChart(MARGIN + chartWidth + 10, this.currentY, chartWidth, chartHeight, 'Distributed Resource Scheduler', drsData);
    this.currentY += chartHeight + 10;

    // Clusters by Host Count
    const barChartHeight = 65;
    this.ensureSpace(barChartHeight + 10);

    const clustersByHosts = clusters
      .sort((a, b) => b.hostCount - a.hostCount)
      .slice(0, 10)
      .map(c => ({ label: c.name.substring(0, 20), value: c.hostCount }));
    this.drawHorizontalBarChart(MARGIN, this.currentY, chartWidth, barChartHeight, 'Clusters by Host Count', clustersByHosts, 'Hosts');

    // Clusters by VM Count
    const vmsByCluster = vms.reduce((acc, vm) => {
      const cluster = vm.cluster || 'Unknown';
      acc[cluster] = (acc[cluster] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    const clustersByVMs = Object.entries(vmsByCluster)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([label, value]) => ({ label: label.substring(0, 20), value }));
    this.drawHorizontalBarChart(MARGIN + chartWidth + 10, this.currentY, chartWidth, barChartHeight, 'Clusters by VM Count', clustersByVMs, 'VMs');
  }

  // ===== HOSTS SECTION =====
  private addHostsSection(data: RVToolsData): void {
    this.addSectionTitle('Host Analysis');

    const hosts = data.vHost;
    const totalCores = hosts.reduce((sum, h) => sum + (h.totalCpuCores || 0), 0);
    const totalMemoryTiB = mibToTiB(hosts.reduce((sum, h) => sum + (h.memoryMiB || 0), 0));
    const totalVMs = hosts.reduce((sum, h) => sum + (h.vmCount || 0), 0);
    const avgVMsPerHost = hosts.length > 0 ? (totalVMs / hosts.length).toFixed(1) : '0';

    // Metric cards
    const cardWidth = (CONTENT_WIDTH - 15) / 4;
    const metrics = [
      { label: 'ESXi Hosts', value: formatNumber(hosts.length), color: COLORS.blue60 },
      { label: 'Total CPU Cores', value: formatNumber(totalCores), color: COLORS.teal50 },
      { label: 'Total Memory', value: `${totalMemoryTiB.toFixed(1)} TiB`, color: COLORS.purple60 },
      { label: 'Avg VMs/Host', value: avgVMsPerHost, color: COLORS.green50 },
    ];
    metrics.forEach((m, i) => {
      this.drawMetricCard(MARGIN + (i * (cardWidth + 5)), this.currentY, cardWidth, 28, m.value, m.label, m.color);
    });
    this.currentY += 38;

    // ESXi Version Distribution
    const chartWidth = (CONTENT_WIDTH - 10) / 2;
    const chartHeight = 65;
    this.ensureSpace(chartHeight + 10);

    const versionData = this.getESXiVersionDistribution(hosts);
    this.drawPieChart(MARGIN, this.currentY, chartWidth, chartHeight, 'ESXi Version Distribution', versionData);

    // Vendor Distribution
    const vendorData = this.getVendorDistribution(hosts);
    this.drawPieChart(MARGIN + chartWidth + 10, this.currentY, chartWidth, chartHeight, 'Hardware Vendors', vendorData);
    this.currentY += chartHeight + 10;

    // Top Hosts by VM Count
    this.ensureSpace(chartHeight + 10);

    const topByVMs = [...hosts].sort((a, b) => (b.vmCount || 0) - (a.vmCount || 0)).slice(0, 10)
      .map(h => ({ label: h.name.substring(0, 25), value: h.vmCount || 0 }));
    this.drawHorizontalBarChart(MARGIN, this.currentY, chartWidth, chartHeight, 'Top Hosts by VM Count', topByVMs, 'VMs');

    // Top Hosts by Memory
    const topByMemory = [...hosts].sort((a, b) => (b.memoryMiB || 0) - (a.memoryMiB || 0)).slice(0, 10)
      .map(h => ({ label: h.name.substring(0, 25), value: Math.round(mibToGiB(h.memoryMiB || 0)) }));
    this.drawHorizontalBarChart(MARGIN + chartWidth + 10, this.currentY, chartWidth, chartHeight, 'Top Hosts by Memory', topByMemory, 'GiB');
  }

  // ===== RESOURCE POOLS SECTION =====
  private addResourcePoolsSection(data: RVToolsData): void {
    this.addSectionTitle('Resource Pool Analysis');

    const pools = data.vResourcePool;
    const totalVMs = pools.reduce((sum, p) => sum + (p.vmCount || 0), 0);
    const poolsWithCpuReservation = pools.filter(p => (p.cpuReservation || 0) > 0).length;
    const poolsWithMemReservation = pools.filter(p => (p.memoryReservation || 0) > 0).length;

    // Metric cards
    const cardWidth = (CONTENT_WIDTH - 15) / 4;
    const metrics = [
      { label: 'Resource Pools', value: formatNumber(pools.length), color: COLORS.blue60 },
      { label: 'VMs in Pools', value: formatNumber(totalVMs), color: COLORS.teal50 },
      { label: 'CPU Reservations', value: formatNumber(poolsWithCpuReservation), color: COLORS.green50 },
      { label: 'Memory Reservations', value: formatNumber(poolsWithMemReservation), color: COLORS.purple60 },
    ];
    metrics.forEach((m, i) => {
      this.drawMetricCard(MARGIN + (i * (cardWidth + 5)), this.currentY, cardWidth, 28, m.value, m.label, m.color);
    });
    this.currentY += 38;

    // Reservation Status Charts
    const chartWidth = (CONTENT_WIDTH - 10) / 2;
    const chartHeight = 60;
    this.ensureSpace(chartHeight + 10);

    const cpuResData = [
      { label: 'With CPU Reservation', value: poolsWithCpuReservation, color: COLORS.green50 },
      { label: 'No CPU Reservation', value: pools.length - poolsWithCpuReservation, color: COLORS.gray60 },
    ].filter(d => d.value > 0);
    this.drawPieChart(MARGIN, this.currentY, chartWidth, chartHeight, 'CPU Reservation Status', cpuResData);

    const memResData = [
      { label: 'With Memory Reservation', value: poolsWithMemReservation, color: COLORS.purple60 },
      { label: 'No Memory Reservation', value: pools.length - poolsWithMemReservation, color: COLORS.gray60 },
    ].filter(d => d.value > 0);
    this.drawPieChart(MARGIN + chartWidth + 10, this.currentY, chartWidth, chartHeight, 'Memory Reservation Status', memResData);
    this.currentY += chartHeight + 10;

    // Top Pools by VM Count
    const barChartHeight = 65;
    this.ensureSpace(barChartHeight + 10);

    const topPools = [...pools].sort((a, b) => (b.vmCount || 0) - (a.vmCount || 0)).slice(0, 10)
      .map(p => ({ label: p.name.substring(0, 25), value: p.vmCount || 0 }));
    this.drawHorizontalBarChart(MARGIN, this.currentY, CONTENT_WIDTH, barChartHeight, 'Resource Pools by VM Count', topPools, 'VMs');
  }

  // ===== DRAWING HELPERS =====

  private drawMetricCard(x: number, y: number, width: number, height: number, value: string, label: string, color: string): void {
    // Card background
    this.doc.setFillColor(...hexToRgb(COLORS.white));
    this.doc.setDrawColor(...hexToRgb(COLORS.gray20));
    this.doc.roundedRect(x, y, width, height, 2, 2, 'FD');

    // Color accent bar
    this.doc.setFillColor(...hexToRgb(color));
    this.doc.rect(x, y, 3, height, 'F');

    // Value
    this.doc.setFontSize(FONT.sectionTitle);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setTextColor(...hexToRgb(COLORS.gray100));
    this.doc.text(value, x + 8, y + height / 2 - 2);

    // Label
    this.doc.setFontSize(FONT.small);
    this.doc.setFont('helvetica', 'normal');
    this.doc.setTextColor(...hexToRgb(COLORS.gray60));
    this.doc.text(label, x + 8, y + height / 2 + 6);
  }

  private drawPieChart(x: number, y: number, width: number, height: number, title: string, data: { label: string; value: number; color?: string }[]): void {
    // Background and border
    this.doc.setFillColor(...hexToRgb(COLORS.white));
    this.doc.setDrawColor(...hexToRgb(COLORS.gray20));
    this.doc.roundedRect(x, y, width, height, 2, 2, 'FD');

    // Title
    this.doc.setFontSize(FONT.body);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setTextColor(...hexToRgb(COLORS.gray100));
    this.doc.text(title, x + 5, y + 8);

    const total = data.reduce((sum, d) => sum + d.value, 0);
    if (total === 0) return;

    // Pie chart center and radius
    const centerX = x + width * 0.35;
    const centerY = y + height * 0.55;
    const radius = Math.min(width * 0.25, height * 0.35);

    let startAngle = -Math.PI / 2; // Start from top

    // Draw each slice
    data.forEach((d, i) => {
      const sliceAngle = (d.value / total) * 2 * Math.PI;
      const endAngle = startAngle + sliceAngle;
      const color = d.color || CHART_COLORS[i % CHART_COLORS.length];

      // Set fill color
      this.doc.setFillColor(...hexToRgb(color));

      // Use more steps for smoother arcs
      const steps = Math.max(20, Math.ceil(sliceAngle * 30));

      // Fill the arc area with triangles (no stroke)
      for (let j = 0; j < steps; j++) {
        const a1 = startAngle + (j / steps) * sliceAngle;
        const a2 = startAngle + ((j + 1) / steps) * sliceAngle;

        // Draw triangle from center to arc segment
        this.doc.triangle(
          centerX, centerY,
          centerX + radius * Math.cos(a1), centerY + radius * Math.sin(a1),
          centerX + radius * Math.cos(a2), centerY + radius * Math.sin(a2),
          'F'  // Fill only, no stroke
        );
      }

      startAngle = endAngle;
    });

    // Legend
    const legendX = x + width * 0.6;
    let legendY = y + 18;
    const legendBoxSize = 3;

    this.doc.setFontSize(FONT.tiny);
    data.slice(0, 5).forEach((d, i) => {
      const color = d.color || CHART_COLORS[i % CHART_COLORS.length];
      this.doc.setFillColor(...hexToRgb(color));
      this.doc.rect(legendX, legendY - 2.5, legendBoxSize, legendBoxSize, 'F');

      this.doc.setTextColor(...hexToRgb(COLORS.gray70));
      const pct = total > 0 ? ((d.value / total) * 100).toFixed(0) : '0';
      const legendText = `${d.label.substring(0, 12)} (${pct}%)`;
      this.doc.text(legendText, legendX + legendBoxSize + 2, legendY);
      legendY += 6;
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private drawHorizontalBarChart(x: number, y: number, width: number, height: number, title: string, data: { label: string; value: number }[], _unit: string): void {
    // Background and border
    this.doc.setFillColor(...hexToRgb(COLORS.white));
    this.doc.setDrawColor(...hexToRgb(COLORS.gray20));
    this.doc.roundedRect(x, y, width, height, 2, 2, 'FD');

    // Title
    this.doc.setFontSize(FONT.body);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setTextColor(...hexToRgb(COLORS.gray100));
    this.doc.text(title, x + 5, y + 8);

    if (data.length === 0) return;

    const maxValue = Math.max(...data.map(d => d.value));
    const chartX = x + 35;
    const chartWidth = width - 50;
    const chartY = y + 14;
    const barHeight = Math.min(6, (height - 20) / data.length - 1);
    const barGap = 1;

    data.slice(0, 8).forEach((d, i) => {
      const barY = chartY + i * (barHeight + barGap);
      const barWidth = maxValue > 0 ? (d.value / maxValue) * chartWidth : 0;

      // Label
      this.doc.setFontSize(FONT.tiny);
      this.doc.setFont('helvetica', 'normal');
      this.doc.setTextColor(...hexToRgb(COLORS.gray70));
      this.doc.text(d.label.substring(0, 12), x + 3, barY + barHeight - 1);

      // Bar
      const color = CHART_COLORS[i % CHART_COLORS.length];
      this.doc.setFillColor(...hexToRgb(color));
      this.doc.roundedRect(chartX, barY, Math.max(barWidth, 1), barHeight, 1, 1, 'F');

      // Value
      this.doc.setFontSize(FONT.tiny);
      this.doc.setTextColor(...hexToRgb(COLORS.gray100));
      this.doc.text(`${formatNumber(d.value)}`, chartX + barWidth + 2, barY + barHeight - 1);
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private drawVerticalBarChart(x: number, y: number, width: number, height: number, title: string, data: { label: string; value: number }[], _unit: string): void {
    // Background and border
    this.doc.setFillColor(...hexToRgb(COLORS.white));
    this.doc.setDrawColor(...hexToRgb(COLORS.gray20));
    this.doc.roundedRect(x, y, width, height, 2, 2, 'FD');

    // Title
    this.doc.setFontSize(FONT.body);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setTextColor(...hexToRgb(COLORS.gray100));
    this.doc.text(title, x + 5, y + 8);

    if (data.length === 0) return;

    const maxValue = Math.max(...data.map(d => d.value));
    const chartX = x + 8;
    const chartWidth = width - 16;
    const chartY = y + 14;
    const chartHeight = height - 28;
    const barWidth = Math.min(15, chartWidth / data.length - 2);
    const barGap = 2;

    data.forEach((d, i) => {
      const barX = chartX + i * (barWidth + barGap);
      const barHeight = maxValue > 0 ? (d.value / maxValue) * chartHeight : 0;
      const barY = chartY + chartHeight - barHeight;

      // Bar
      const color = CHART_COLORS[i % CHART_COLORS.length];
      this.doc.setFillColor(...hexToRgb(color));
      this.doc.roundedRect(barX, barY, barWidth, barHeight, 1, 1, 'F');

      // Label
      this.doc.setFontSize(FONT.tiny);
      this.doc.setFont('helvetica', 'normal');
      this.doc.setTextColor(...hexToRgb(COLORS.gray70));
      this.doc.text(d.label, barX + barWidth / 2, chartY + chartHeight + 5, { align: 'center', maxWidth: barWidth + barGap });

      // Value on top
      this.doc.setTextColor(...hexToRgb(COLORS.gray100));
      this.doc.text(`${d.value}`, barX + barWidth / 2, barY - 1, { align: 'center' });
    });
  }

  // ===== DATA HELPERS =====

  private getOSDistribution(vms: VirtualMachine[]): { label: string; value: number }[] {
    const distribution = vms.reduce((acc, vm) => {
      let os = vm.guestOS || 'Unknown';
      // Simplify OS names
      if (os.toLowerCase().includes('windows server 2022')) os = 'Win Server 2022';
      else if (os.toLowerCase().includes('windows server 2019')) os = 'Win Server 2019';
      else if (os.toLowerCase().includes('windows server 2016')) os = 'Win Server 2016';
      else if (os.toLowerCase().includes('windows server')) os = 'Windows Server';
      else if (os.toLowerCase().includes('rhel') || os.toLowerCase().includes('red hat')) os = 'RHEL';
      else if (os.toLowerCase().includes('centos')) os = 'CentOS';
      else if (os.toLowerCase().includes('ubuntu')) os = 'Ubuntu';
      else if (os.toLowerCase().includes('sles') || os.toLowerCase().includes('suse')) os = 'SLES';
      else if (os.toLowerCase().includes('linux')) os = 'Linux (Other)';
      else if (os.length > 20) os = os.substring(0, 17) + '...';
      acc[os] = (acc[os] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(distribution)
      .sort((a, b) => b[1] - a[1])
      .map(([label, value]) => ({ label, value }));
  }

  private getClusterDistribution(vms: VirtualMachine[]): { label: string; value: number }[] {
    const distribution = vms.reduce((acc, vm) => {
      const cluster = vm.cluster || 'Unknown';
      acc[cluster] = (acc[cluster] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(distribution)
      .sort((a, b) => b[1] - a[1])
      .map(([label, value]) => ({ label: label.substring(0, 20), value }));
  }

  private getHardwareVersionDistribution(vms: VirtualMachine[]): { label: string; value: number; color?: string }[] {
    const distribution = vms.reduce((acc, vm) => {
      const version = vm.hardwareVersion || 'Unknown';
      acc[version] = (acc[version] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(distribution)
      .sort((a, b) => b[0].localeCompare(a[0]))
      .slice(0, 8)
      .map(([label, value]) => ({ label, value }));
  }

  private getToolsStatusDistribution(data: RVToolsData, vms: VirtualMachine[]): { label: string; value: number; color?: string }[] {
    const toolsMap = new Map(data.vTools.map(t => [t.vmName, t]));
    const statusCounts = { current: 0, outdated: 0, notRunning: 0, notInstalled: 0 };

    vms.forEach(vm => {
      const tools = toolsMap.get(vm.vmName);
      if (!tools) {
        statusCounts.notInstalled++;
      } else if (tools.toolsStatus === 'toolsOk') {
        statusCounts.current++;
      } else if (tools.toolsStatus === 'toolsOld') {
        statusCounts.outdated++;
      } else if (tools.toolsStatus === 'toolsNotInstalled') {
        statusCounts.notInstalled++;
      } else {
        statusCounts.notRunning++;
      }
    });

    return [
      { label: 'Current', value: statusCounts.current, color: COLORS.green50 },
      { label: 'Outdated', value: statusCounts.outdated, color: COLORS.yellow40 },
      { label: 'Not Running', value: statusCounts.notRunning, color: COLORS.orange40 },
      { label: 'Not Installed', value: statusCounts.notInstalled, color: COLORS.red60 },
    ].filter(d => d.value > 0);
  }

  private getCPUDistribution(vms: VirtualMachine[]): { label: string; value: number }[] {
    const buckets = [
      { label: '1-2', min: 1, max: 2 },
      { label: '3-4', min: 3, max: 4 },
      { label: '5-8', min: 5, max: 8 },
      { label: '9-16', min: 9, max: 16 },
      { label: '17-32', min: 17, max: 32 },
      { label: '33+', min: 33, max: Infinity },
    ];

    return buckets.map(b => ({
      label: b.label,
      value: vms.filter(vm => vm.cpus >= b.min && vm.cpus <= b.max).length,
    })).filter(b => b.value > 0);
  }

  private getMemoryDistribution(vms: VirtualMachine[]): { label: string; value: number }[] {
    const buckets = [
      { label: '0-4', min: 0, max: 4 },
      { label: '5-8', min: 5, max: 8 },
      { label: '9-16', min: 9, max: 16 },
      { label: '17-32', min: 17, max: 32 },
      { label: '33-64', min: 33, max: 64 },
      { label: '65+', min: 65, max: Infinity },
    ];

    return buckets.map(b => ({
      label: b.label,
      value: vms.filter(vm => {
        const memGiB = mibToGiB(vm.memory);
        return memGiB >= b.min && memGiB <= b.max;
      }).length,
    })).filter(b => b.value > 0);
  }

  private getDatastoreTypeDistribution(datastores: VDatastoreInfo[]): { label: string; value: number }[] {
    const distribution = datastores.reduce((acc, ds) => {
      const type = ds.type || 'Unknown';
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(distribution)
      .sort((a, b) => b[1] - a[1])
      .map(([label, value]) => ({ label, value }));
  }

  private getAdapterTypeDistribution(networks: VNetworkInfo[]): { label: string; value: number }[] {
    const distribution = networks.reduce((acc, n) => {
      const type = n.adapterType || 'Unknown';
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(distribution)
      .sort((a, b) => b[1] - a[1])
      .map(([label, value]) => ({ label, value }));
  }

  private getVMsByNICCount(networks: VNetworkInfo[], vms: VirtualMachine[]): { label: string; value: number }[] {
    const nicCountByVM = networks.reduce((acc, n) => {
      acc[n.vmName] = (acc[n.vmName] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const buckets = [
      { label: '0', min: 0, max: 0 },
      { label: '1', min: 1, max: 1 },
      { label: '2', min: 2, max: 2 },
      { label: '3', min: 3, max: 3 },
      { label: '4-5', min: 4, max: 5 },
      { label: '6+', min: 6, max: Infinity },
    ];

    return buckets.map(b => ({
      label: b.label,
      value: vms.filter(vm => {
        const count = nicCountByVM[vm.vmName] || 0;
        return count >= b.min && count <= b.max;
      }).length,
    })).filter(b => b.value > 0);
  }

  private getESXiVersionDistribution(hosts: VHostInfo[]): { label: string; value: number }[] {
    const distribution = hosts.reduce((acc, h) => {
      const version = h.esxiVersion || 'Unknown';
      acc[version] = (acc[version] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(distribution)
      .sort((a, b) => b[0].localeCompare(a[0]))
      .slice(0, 6)
      .map(([label, value]) => ({ label: label.substring(0, 15), value }));
  }

  private getVendorDistribution(hosts: VHostInfo[]): { label: string; value: number }[] {
    const distribution = hosts.reduce((acc, h) => {
      let vendor = h.vendor || 'Unknown';
      if (vendor.toLowerCase().includes('dell')) vendor = 'Dell';
      else if (vendor.toLowerCase().includes('hp') || vendor.toLowerCase().includes('hewlett')) vendor = 'HPE';
      else if (vendor.toLowerCase().includes('lenovo')) vendor = 'Lenovo';
      else if (vendor.toLowerCase().includes('cisco')) vendor = 'Cisco';
      else if (vendor.toLowerCase().includes('supermicro')) vendor = 'Supermicro';
      acc[vendor] = (acc[vendor] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(distribution)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([label, value]) => ({ label, value }));
  }

  // ===== PAGE HELPERS =====

  // ===== AI INSIGHTS PAGE =====
  private addAIInsightsPage(insights: MigrationInsights): void {
    this.addSectionTitle('AI-Generated Insights');

    // Disclaimer
    this.doc.setFontSize(FONT.small);
    this.doc.setFont('helvetica', 'italic');
    this.doc.setTextColor(...hexToRgb(COLORS.purple60));
    this.doc.text(
      'The following content was generated by AI (IBM watsonx.ai) and should be reviewed for accuracy.',
      MARGIN, this.currentY
    );
    this.currentY += 8;

    // Executive Summary
    this.doc.setFontSize(FONT.subsectionTitle);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setTextColor(...hexToRgb(COLORS.gray100));
    this.doc.text('Executive Summary', MARGIN, this.currentY);
    this.currentY += 6;

    this.doc.setFontSize(FONT.body);
    this.doc.setFont('helvetica', 'normal');
    this.doc.setTextColor(...hexToRgb(COLORS.gray80));
    const summaryLines = this.doc.splitTextToSize(insights.executiveSummary, CONTENT_WIDTH);
    this.doc.text(summaryLines, MARGIN, this.currentY);
    this.currentY += summaryLines.length * 4.5 + 6;

    this.ensureSpace(30);

    // Risk Assessment
    this.doc.setFontSize(FONT.subsectionTitle);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setTextColor(...hexToRgb(COLORS.gray100));
    this.doc.text('Risk Assessment', MARGIN, this.currentY);
    this.currentY += 6;

    this.doc.setFontSize(FONT.body);
    this.doc.setFont('helvetica', 'normal');
    this.doc.setTextColor(...hexToRgb(COLORS.gray80));
    const riskLines = this.doc.splitTextToSize(insights.riskAssessment, CONTENT_WIDTH);
    this.doc.text(riskLines, MARGIN, this.currentY);
    this.currentY += riskLines.length * 4.5 + 6;

    this.ensureSpace(30);

    // Recommendations
    if (insights.recommendations.length > 0) {
      this.doc.setFontSize(FONT.subsectionTitle);
      this.doc.setFont('helvetica', 'bold');
      this.doc.setTextColor(...hexToRgb(COLORS.gray100));
      this.doc.text('Recommendations', MARGIN, this.currentY);
      this.currentY += 6;

      this.doc.setFontSize(FONT.body);
      this.doc.setFont('helvetica', 'normal');
      this.doc.setTextColor(...hexToRgb(COLORS.gray80));
      for (const rec of insights.recommendations) {
        this.ensureSpace(10);
        const recLines = this.doc.splitTextToSize(`• ${rec}`, CONTENT_WIDTH - 5);
        this.doc.text(recLines, MARGIN + 3, this.currentY);
        this.currentY += recLines.length * 4.5 + 2;
      }
      this.currentY += 4;
    }

    this.ensureSpace(30);

    // Cost Optimizations
    if (insights.costOptimizations.length > 0) {
      this.doc.setFontSize(FONT.subsectionTitle);
      this.doc.setFont('helvetica', 'bold');
      this.doc.setTextColor(...hexToRgb(COLORS.gray100));
      this.doc.text('Cost Optimizations', MARGIN, this.currentY);
      this.currentY += 6;

      this.doc.setFontSize(FONT.body);
      this.doc.setFont('helvetica', 'normal');
      this.doc.setTextColor(...hexToRgb(COLORS.gray80));
      for (const opt of insights.costOptimizations) {
        this.ensureSpace(10);
        const optLines = this.doc.splitTextToSize(`• ${opt}`, CONTENT_WIDTH - 5);
        this.doc.text(optLines, MARGIN + 3, this.currentY);
        this.currentY += optLines.length * 4.5 + 2;
      }
      this.currentY += 4;
    }

    this.ensureSpace(30);

    // Migration Strategy
    if (insights.migrationStrategy) {
      this.doc.setFontSize(FONT.subsectionTitle);
      this.doc.setFont('helvetica', 'bold');
      this.doc.setTextColor(...hexToRgb(COLORS.gray100));
      this.doc.text('Migration Strategy', MARGIN, this.currentY);
      this.currentY += 6;

      this.doc.setFontSize(FONT.body);
      this.doc.setFont('helvetica', 'normal');
      this.doc.setTextColor(...hexToRgb(COLORS.gray80));
      const strategyLines = this.doc.splitTextToSize(insights.migrationStrategy, CONTENT_WIDTH);
      this.doc.text(strategyLines, MARGIN, this.currentY);
      this.currentY += strategyLines.length * 4.5 + 6;
    }
  }

  private addNewPage(): void {
    this.doc.addPage();
    this.pageNumber++;
    this.currentY = MARGIN;
  }

  private ensureSpace(neededSpace: number): void {
    if (this.currentY + neededSpace > PAGE_HEIGHT - MARGIN) {
      this.addNewPage();
    }
  }

  private addSectionTitle(title: string): void {
    // Section header bar
    this.doc.setFillColor(...hexToRgb(COLORS.blue60));
    this.doc.rect(MARGIN, this.currentY, CONTENT_WIDTH, 10, 'F');

    this.doc.setFontSize(FONT.sectionTitle);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setTextColor(...hexToRgb(COLORS.white));
    this.doc.text(title, MARGIN + 5, this.currentY + 7);

    this.currentY += 18;
  }

  private addPageNumbers(): void {
    const totalPages = this.doc.getNumberOfPages();

    for (let i = 2; i <= totalPages; i++) {
      this.doc.setPage(i);
      this.doc.setFontSize(FONT.small);
      this.doc.setTextColor(...hexToRgb(COLORS.gray60));
      this.doc.text(`Page ${i - 1} of ${totalPages - 1}`, PAGE_WIDTH / 2, PAGE_HEIGHT - 8, { align: 'center' });

      // Header line
      this.doc.setDrawColor(...hexToRgb(COLORS.gray20));
      this.doc.setLineWidth(0.5);
      this.doc.line(MARGIN, 8, PAGE_WIDTH - MARGIN, 8);

      // Header text
      this.doc.setFontSize(FONT.tiny);
      this.doc.text('VMware Infrastructure Analysis Report', PAGE_WIDTH - MARGIN, 6, { align: 'right' });
    }
  }
}

// Main export function
export async function generatePDF(data: RVToolsData, options?: PDFExportOptions): Promise<Blob> {
  const generator = new EnhancedPDFGenerator();
  return generator.generate(data, options);
}

export function downloadPDF(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// Backwards compatibility alias
export { EnhancedPDFGenerator as PDFGenerator };
