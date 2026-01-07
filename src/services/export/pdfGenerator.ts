// PDF generation service using jsPDF
import jsPDF from 'jspdf';
import type { RVToolsData } from '@/types/rvtools';
import { mibToGiB, mibToTiB, formatNumber } from '@/utils/formatters';

interface PDFOptions {
  includeExecutiveSummary: boolean;
  includeComputeAnalysis: boolean;
  includeStorageAnalysis: boolean;
  includeMTVReadiness: boolean;
  includeVMList: boolean;
}

const DEFAULT_OPTIONS: PDFOptions = {
  includeExecutiveSummary: true,
  includeComputeAnalysis: true,
  includeStorageAnalysis: true,
  includeMTVReadiness: true,
  includeVMList: false, // Can be large
};

// PDF styling constants
const COLORS = {
  primary: [15, 98, 254] as [number, number, number], // IBM Blue 60
  secondary: [82, 82, 82] as [number, number, number], // Gray 70
  success: [36, 161, 72] as [number, number, number], // Green 50
  warning: [240, 171, 0] as [number, number, number], // Yellow 40
  error: [218, 30, 40] as [number, number, number], // Red 50
  text: [22, 22, 22] as [number, number, number], // Gray 100
  lightText: [82, 82, 82] as [number, number, number], // Gray 70
  border: [224, 224, 224] as [number, number, number], // Gray 20
};

const FONTS = {
  title: 24,
  heading: 16,
  subheading: 12,
  body: 10,
  small: 8,
};

const MARGINS = {
  left: 20,
  right: 20,
  top: 20,
  bottom: 20,
};

export class PDFGenerator {
  private doc: jsPDF;
  private pageWidth: number;
  private pageHeight: number;
  private contentWidth: number;
  private currentY: number;

  constructor() {
    this.doc = new jsPDF('p', 'mm', 'a4');
    this.pageWidth = this.doc.internal.pageSize.getWidth();
    this.pageHeight = this.doc.internal.pageSize.getHeight();
    this.contentWidth = this.pageWidth - MARGINS.left - MARGINS.right;
    this.currentY = MARGINS.top;
  }

  async generate(data: RVToolsData, options: Partial<PDFOptions> = {}): Promise<Blob> {
    const opts = { ...DEFAULT_OPTIONS, ...options };

    // Title page
    this.addTitlePage(data);

    // Executive Summary
    if (opts.includeExecutiveSummary) {
      this.addNewPage();
      this.addExecutiveSummary(data);
    }

    // Compute Analysis
    if (opts.includeComputeAnalysis) {
      this.addNewPage();
      this.addComputeAnalysis(data);
    }

    // Storage Analysis
    if (opts.includeStorageAnalysis) {
      this.addNewPage();
      this.addStorageAnalysis(data);
    }

    // MTV Readiness
    if (opts.includeMTVReadiness) {
      this.addNewPage();
      this.addMTVReadiness(data);
    }

    // VM List (optional, can be very long)
    if (opts.includeVMList) {
      this.addNewPage();
      this.addVMList(data);
    }

    // Add page numbers
    this.addPageNumbers();

    return this.doc.output('blob');
  }

  private addTitlePage(data: RVToolsData): void {
    const centerX = this.pageWidth / 2;

    // Title
    this.currentY = 80;
    this.doc.setFontSize(FONTS.title);
    this.doc.setTextColor(...COLORS.primary);
    this.doc.text('RVTools Analysis Report', centerX, this.currentY, { align: 'center' });

    // Subtitle
    this.currentY += 15;
    this.doc.setFontSize(FONTS.heading);
    this.doc.setTextColor(...COLORS.secondary);
    this.doc.text('VMware Infrastructure Assessment', centerX, this.currentY, { align: 'center' });

    // File info
    this.currentY += 30;
    this.doc.setFontSize(FONTS.body);
    this.doc.setTextColor(...COLORS.text);
    this.doc.text(`Source File: ${data.metadata.fileName}`, centerX, this.currentY, { align: 'center' });

    if (data.metadata.collectionDate) {
      this.currentY += 8;
      this.doc.text(
        `Collection Date: ${data.metadata.collectionDate.toLocaleDateString()}`,
        centerX,
        this.currentY,
        { align: 'center' }
      );
    }

    // Report generation date
    this.currentY += 8;
    this.doc.text(
      `Report Generated: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`,
      centerX,
      this.currentY,
      { align: 'center' }
    );

    // Summary box
    this.currentY += 30;
    const vms = data.vInfo.filter(vm => !vm.template);
    const boxY = this.currentY;
    const boxHeight = 50;

    this.doc.setDrawColor(...COLORS.border);
    this.doc.setFillColor(248, 248, 248);
    this.doc.roundedRect(MARGINS.left, boxY, this.contentWidth, boxHeight, 3, 3, 'FD');

    // Quick stats in box
    this.currentY = boxY + 15;
    this.doc.setFontSize(FONTS.subheading);
    this.doc.setTextColor(...COLORS.text);

    const stats = [
      `${formatNumber(vms.length)} Virtual Machines`,
      `${formatNumber(data.vHost.length)} ESXi Hosts`,
      `${formatNumber(data.vCluster.length)} Clusters`,
      `${formatNumber(data.vDatastore.length)} Datastores`,
    ];

    const statWidth = this.contentWidth / stats.length;
    stats.forEach((stat, i) => {
      const x = MARGINS.left + statWidth * i + statWidth / 2;
      this.doc.text(stat, x, this.currentY, { align: 'center' });
    });

    // Footer
    this.doc.setFontSize(FONTS.small);
    this.doc.setTextColor(...COLORS.lightText);
    this.doc.text(
      'Generated by RVTools Analyzer',
      centerX,
      this.pageHeight - MARGINS.bottom,
      { align: 'center' }
    );
  }

  private addExecutiveSummary(data: RVToolsData): void {
    this.addSectionTitle('Executive Summary');

    const vms = data.vInfo.filter(vm => !vm.template);
    const poweredOn = vms.filter(vm => vm.powerState === 'poweredOn');
    const poweredOff = vms.filter(vm => vm.powerState === 'poweredOff');
    const templates = data.vInfo.filter(vm => vm.template);

    const totalVCPUs = vms.reduce((sum, vm) => sum + vm.cpus, 0);
    const totalMemoryMiB = vms.reduce((sum, vm) => sum + vm.memory, 0);
    const totalStorageMiB = vms.reduce((sum, vm) => sum + vm.provisionedMiB, 0);

    // VM Overview
    this.addSubsectionTitle('Virtual Machine Overview');
    this.addMetricRow([
      { label: 'Total VMs', value: formatNumber(vms.length) },
      { label: 'Powered On', value: formatNumber(poweredOn.length) },
      { label: 'Powered Off', value: formatNumber(poweredOff.length) },
      { label: 'Templates', value: formatNumber(templates.length) },
    ]);

    this.currentY += 10;

    // Resource Summary
    this.addSubsectionTitle('Resource Summary');
    this.addMetricRow([
      { label: 'Total vCPUs', value: formatNumber(totalVCPUs) },
      { label: 'Total Memory', value: `${mibToGiB(totalMemoryMiB).toFixed(0)} GiB` },
      { label: 'Total Storage', value: `${mibToTiB(totalStorageMiB).toFixed(1)} TiB` },
    ]);

    this.currentY += 10;

    // Infrastructure
    this.addSubsectionTitle('Infrastructure');
    const uniqueDatacenters = new Set(vms.map(vm => vm.datacenter).filter(Boolean)).size;
    this.addMetricRow([
      { label: 'Datacenters', value: formatNumber(uniqueDatacenters) },
      { label: 'Clusters', value: formatNumber(data.vCluster.length) },
      { label: 'ESXi Hosts', value: formatNumber(data.vHost.length) },
      { label: 'Datastores', value: formatNumber(data.vDatastore.length) },
    ]);

    this.currentY += 10;

    // OS Distribution
    this.addSubsectionTitle('Top Operating Systems');
    const osDistribution = this.getOSDistribution(vms);
    const topOS = osDistribution.slice(0, 5);

    topOS.forEach(({ os, count }) => {
      this.addTextLine(`${os}: ${count} VMs (${((count / vms.length) * 100).toFixed(1)}%)`);
    });
  }

  private addComputeAnalysis(data: RVToolsData): void {
    this.addSectionTitle('Compute Analysis');

    const vms = data.vInfo.filter(vm => !vm.template);
    const poweredOn = vms.filter(vm => vm.powerState === 'poweredOn');

    const totalVCPUs = vms.reduce((sum, vm) => sum + vm.cpus, 0);
    const poweredOnVCPUs = poweredOn.reduce((sum, vm) => sum + vm.cpus, 0);
    const totalMemoryGiB = mibToGiB(vms.reduce((sum, vm) => sum + vm.memory, 0));
    const poweredOnMemoryGiB = mibToGiB(poweredOn.reduce((sum, vm) => sum + vm.memory, 0));

    // CPU Summary
    this.addSubsectionTitle('CPU Summary');
    this.addMetricRow([
      { label: 'Total vCPUs', value: formatNumber(totalVCPUs) },
      { label: 'Powered On vCPUs', value: formatNumber(poweredOnVCPUs) },
      { label: 'Avg vCPUs/VM', value: (totalVCPUs / vms.length).toFixed(1) },
    ]);

    this.currentY += 10;

    // Memory Summary
    this.addSubsectionTitle('Memory Summary');
    this.addMetricRow([
      { label: 'Total Memory', value: `${totalMemoryGiB.toFixed(0)} GiB` },
      { label: 'Powered On', value: `${poweredOnMemoryGiB.toFixed(0)} GiB` },
      { label: 'Avg Memory/VM', value: `${(totalMemoryGiB / vms.length).toFixed(1)} GiB` },
    ]);

    this.currentY += 10;

    // CPU Distribution
    this.addSubsectionTitle('vCPU Distribution');
    const cpuDist = this.getCPUDistribution(vms);
    cpuDist.forEach(({ bucket, count }) => {
      const pct = ((count / vms.length) * 100).toFixed(1);
      this.addTextLine(`${bucket} vCPUs: ${count} VMs (${pct}%)`);
    });

    this.currentY += 10;

    // Top CPU Consumers
    this.addSubsectionTitle('Top 10 CPU Consumers');
    const topCPU = [...vms].sort((a, b) => b.cpus - a.cpus).slice(0, 10);
    topCPU.forEach((vm, i) => {
      this.addTextLine(`${i + 1}. ${vm.vmName}: ${vm.cpus} vCPUs`);
    });
  }

  private addStorageAnalysis(data: RVToolsData): void {
    this.addSectionTitle('Storage Analysis');

    const datastores = data.vDatastore;
    const totalCapacityTiB = mibToTiB(datastores.reduce((sum, ds) => sum + ds.capacityMiB, 0));
    const totalUsedTiB = mibToTiB(datastores.reduce((sum, ds) => sum + ds.inUseMiB, 0));
    const totalFreeTiB = mibToTiB(datastores.reduce((sum, ds) => sum + ds.freeMiB, 0));
    const avgUtilization = totalCapacityTiB > 0 ? (totalUsedTiB / totalCapacityTiB) * 100 : 0;

    // Storage Summary
    this.addSubsectionTitle('Storage Summary');
    this.addMetricRow([
      { label: 'Total Capacity', value: `${totalCapacityTiB.toFixed(1)} TiB` },
      { label: 'Used', value: `${totalUsedTiB.toFixed(1)} TiB` },
      { label: 'Free', value: `${totalFreeTiB.toFixed(1)} TiB` },
      { label: 'Avg Utilization', value: `${avgUtilization.toFixed(1)}%` },
    ]);

    this.currentY += 10;

    // Datastore Types
    this.addSubsectionTitle('Datastore Types');
    const typeDistribution = datastores.reduce((acc, ds) => {
      const type = ds.type || 'Unknown';
      if (!acc[type]) acc[type] = { count: 0, capacityMiB: 0 };
      acc[type].count++;
      acc[type].capacityMiB += ds.capacityMiB;
      return acc;
    }, {} as Record<string, { count: number; capacityMiB: number }>);

    Object.entries(typeDistribution)
      .sort((a, b) => b[1].capacityMiB - a[1].capacityMiB)
      .forEach(([type, info]) => {
        this.addTextLine(`${type}: ${info.count} datastores (${mibToTiB(info.capacityMiB).toFixed(1)} TiB)`);
      });

    this.currentY += 10;

    // High Utilization Datastores
    this.addSubsectionTitle('High Utilization Datastores (>80%)');
    const highUtil = datastores
      .filter(ds => ds.capacityMiB > 0 && (ds.inUseMiB / ds.capacityMiB) * 100 > 80)
      .sort((a, b) => {
        const utilA = (a.inUseMiB / a.capacityMiB) * 100;
        const utilB = (b.inUseMiB / b.capacityMiB) * 100;
        return utilB - utilA;
      })
      .slice(0, 10);

    if (highUtil.length === 0) {
      this.addTextLine('No datastores with utilization above 80%');
    } else {
      highUtil.forEach(ds => {
        const util = ((ds.inUseMiB / ds.capacityMiB) * 100).toFixed(1);
        this.addTextLine(`${ds.name}: ${util}% utilized`);
      });
    }
  }

  private addMTVReadiness(data: RVToolsData): void {
    this.addSectionTitle('Migration Readiness Assessment');

    const vms = data.vInfo.filter(vm => !vm.template && vm.powerState === 'poweredOn');

    // VMware Tools Status
    this.addSubsectionTitle('VMware Tools Status');
    const toolsStatus = this.analyzeToolsStatus(data);
    this.addMetricRow([
      { label: 'Tools Running', value: formatNumber(toolsStatus.running) },
      { label: 'Tools Outdated', value: formatNumber(toolsStatus.outdated) },
      { label: 'Not Installed', value: formatNumber(toolsStatus.notInstalled) },
    ]);

    this.currentY += 10;

    // Snapshots
    this.addSubsectionTitle('Snapshot Analysis');
    const snapshotVMs = new Set(data.vSnapshot.map(s => s.vmName)).size;
    const oldSnapshots = data.vSnapshot.filter(s => s.ageInDays > 7).length;
    this.addMetricRow([
      { label: 'VMs with Snapshots', value: formatNumber(snapshotVMs) },
      { label: 'Total Snapshots', value: formatNumber(data.vSnapshot.length) },
      { label: 'Snapshots >7 days', value: formatNumber(oldSnapshots) },
    ]);

    this.currentY += 10;

    // CD-ROM Status
    this.addSubsectionTitle('CD-ROM Status');
    const connectedCDs = data.vCD.filter(cd => cd.connected).length;
    this.addTextLine(`VMs with connected CD-ROM: ${connectedCDs}`);
    if (connectedCDs > 0) {
      this.doc.setTextColor(...COLORS.warning);
      this.addTextLine('Warning: Disconnect CD-ROMs before migration');
      this.doc.setTextColor(...COLORS.text);
    }

    this.currentY += 10;

    // Hardware Version
    this.addSubsectionTitle('Hardware Version Distribution');
    const hwVersions = vms.reduce((acc, vm) => {
      const version = vm.hardwareVersion || 'Unknown';
      acc[version] = (acc[version] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    Object.entries(hwVersions)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .forEach(([version, count]) => {
        this.addTextLine(`${version}: ${count} VMs`);
      });

    this.currentY += 10;

    // RDM Check
    this.addSubsectionTitle('RDM (Raw Device Mapping) Check');
    const rdmDisks = data.vDisk.filter(d => d.raw).length;
    if (rdmDisks === 0) {
      this.doc.setTextColor(...COLORS.success);
      this.addTextLine('No RDM disks detected - Ready for migration');
    } else {
      this.doc.setTextColor(...COLORS.error);
      this.addTextLine(`${rdmDisks} RDM disks detected - Requires remediation`);
    }
    this.doc.setTextColor(...COLORS.text);
  }

  private addVMList(data: RVToolsData): void {
    this.addSectionTitle('Virtual Machine Inventory');

    const vms = data.vInfo.filter(vm => !vm.template);

    // Table header
    const headers = ['VM Name', 'Power', 'vCPUs', 'Memory', 'Storage', 'OS'];
    const colWidths = [50, 20, 15, 20, 20, 45];

    this.addTableHeader(headers, colWidths);

    // Table rows
    vms.slice(0, 50).forEach(vm => { // Limit to 50 VMs to avoid huge PDFs
      this.checkPageBreak(8);

      const row = [
        vm.vmName.substring(0, 25),
        vm.powerState === 'poweredOn' ? 'On' : 'Off',
        vm.cpus.toString(),
        `${mibToGiB(vm.memory).toFixed(0)} GB`,
        `${mibToGiB(vm.provisionedMiB).toFixed(0)} GB`,
        (vm.guestOS || 'Unknown').substring(0, 25),
      ];

      this.addTableRow(row, colWidths);
    });

    if (vms.length > 50) {
      this.currentY += 5;
      this.doc.setFontSize(FONTS.small);
      this.doc.setTextColor(...COLORS.lightText);
      this.doc.text(`... and ${vms.length - 50} more VMs (truncated for PDF)`, MARGINS.left, this.currentY);
    }
  }

  // Helper methods
  private addNewPage(): void {
    this.doc.addPage();
    this.currentY = MARGINS.top;
  }

  private checkPageBreak(neededSpace: number): void {
    if (this.currentY + neededSpace > this.pageHeight - MARGINS.bottom) {
      this.addNewPage();
    }
  }

  private addSectionTitle(title: string): void {
    this.doc.setFontSize(FONTS.heading);
    this.doc.setTextColor(...COLORS.primary);
    this.doc.text(title, MARGINS.left, this.currentY);
    this.currentY += 3;

    // Underline
    this.doc.setDrawColor(...COLORS.primary);
    this.doc.setLineWidth(0.5);
    this.doc.line(MARGINS.left, this.currentY, MARGINS.left + 60, this.currentY);
    this.currentY += 10;
  }

  private addSubsectionTitle(title: string): void {
    this.checkPageBreak(15);
    this.doc.setFontSize(FONTS.subheading);
    this.doc.setTextColor(...COLORS.secondary);
    this.doc.text(title, MARGINS.left, this.currentY);
    this.currentY += 8;
  }

  private addTextLine(text: string): void {
    this.checkPageBreak(6);
    this.doc.setFontSize(FONTS.body);
    this.doc.setTextColor(...COLORS.text);
    this.doc.text(text, MARGINS.left + 5, this.currentY);
    this.currentY += 6;
  }

  private addMetricRow(metrics: { label: string; value: string }[]): void {
    this.checkPageBreak(20);

    const boxHeight = 15;
    const boxWidth = this.contentWidth / metrics.length - 2;

    metrics.forEach((metric, i) => {
      const x = MARGINS.left + i * (boxWidth + 2);

      // Box
      this.doc.setDrawColor(...COLORS.border);
      this.doc.setFillColor(248, 248, 248);
      this.doc.roundedRect(x, this.currentY, boxWidth, boxHeight, 2, 2, 'FD');

      // Value
      this.doc.setFontSize(FONTS.subheading);
      this.doc.setTextColor(...COLORS.primary);
      this.doc.text(metric.value, x + boxWidth / 2, this.currentY + 6, { align: 'center' });

      // Label
      this.doc.setFontSize(FONTS.small);
      this.doc.setTextColor(...COLORS.lightText);
      this.doc.text(metric.label, x + boxWidth / 2, this.currentY + 12, { align: 'center' });
    });

    this.currentY += boxHeight + 5;
  }

  private addTableHeader(headers: string[], colWidths: number[]): void {
    this.checkPageBreak(10);

    let x = MARGINS.left;
    this.doc.setFontSize(FONTS.small);
    this.doc.setTextColor(255, 255, 255);
    this.doc.setFillColor(...COLORS.primary);

    // Header background
    this.doc.rect(MARGINS.left, this.currentY - 4, this.contentWidth, 7, 'F');

    headers.forEach((header, i) => {
      this.doc.text(header, x + 2, this.currentY);
      x += colWidths[i];
    });

    this.currentY += 5;
  }

  private addTableRow(cells: string[], colWidths: number[]): void {
    let x = MARGINS.left;
    this.doc.setFontSize(FONTS.small);
    this.doc.setTextColor(...COLORS.text);

    cells.forEach((cell, i) => {
      this.doc.text(cell, x + 2, this.currentY);
      x += colWidths[i];
    });

    // Row border
    this.doc.setDrawColor(...COLORS.border);
    this.doc.line(MARGINS.left, this.currentY + 2, MARGINS.left + this.contentWidth, this.currentY + 2);

    this.currentY += 6;
  }

  private addPageNumbers(): void {
    const totalPages = this.doc.getNumberOfPages();

    for (let i = 1; i <= totalPages; i++) {
      this.doc.setPage(i);
      this.doc.setFontSize(FONTS.small);
      this.doc.setTextColor(...COLORS.lightText);
      this.doc.text(
        `Page ${i} of ${totalPages}`,
        this.pageWidth / 2,
        this.pageHeight - 10,
        { align: 'center' }
      );
    }
  }

  // Analysis helpers
  private getOSDistribution(vms: { guestOS: string }[]): { os: string; count: number }[] {
    const distribution = vms.reduce((acc, vm) => {
      let os = vm.guestOS || 'Unknown';

      // Simplify OS names
      if (os.toLowerCase().includes('windows server 2019')) os = 'Windows Server 2019';
      else if (os.toLowerCase().includes('windows server 2016')) os = 'Windows Server 2016';
      else if (os.toLowerCase().includes('windows server 2022')) os = 'Windows Server 2022';
      else if (os.toLowerCase().includes('windows server')) os = 'Windows Server (Other)';
      else if (os.toLowerCase().includes('rhel') || os.toLowerCase().includes('red hat')) os = 'RHEL';
      else if (os.toLowerCase().includes('centos')) os = 'CentOS';
      else if (os.toLowerCase().includes('ubuntu')) os = 'Ubuntu';
      else if (os.toLowerCase().includes('sles') || os.toLowerCase().includes('suse')) os = 'SLES';
      else if (os.toLowerCase().includes('linux')) os = 'Linux (Other)';

      acc[os] = (acc[os] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(distribution)
      .map(([os, count]) => ({ os, count }))
      .sort((a, b) => b.count - a.count);
  }

  private getCPUDistribution(vms: { cpus: number }[]): { bucket: string; count: number }[] {
    const buckets = [
      { bucket: '1-2', min: 1, max: 2 },
      { bucket: '3-4', min: 3, max: 4 },
      { bucket: '5-8', min: 5, max: 8 },
      { bucket: '9-16', min: 9, max: 16 },
      { bucket: '17-32', min: 17, max: 32 },
      { bucket: '33+', min: 33, max: Infinity },
    ];

    return buckets.map(({ bucket, min, max }) => ({
      bucket,
      count: vms.filter(vm => vm.cpus >= min && vm.cpus <= max).length,
    })).filter(b => b.count > 0);
  }

  private analyzeToolsStatus(data: RVToolsData): { running: number; outdated: number; notInstalled: number } {
    const vms = data.vInfo.filter(vm => !vm.template && vm.powerState === 'poweredOn');
    const toolsMap = new Map(data.vTools.map(t => [t.vmName, t]));

    let running = 0;
    let outdated = 0;
    let notInstalled = 0;

    vms.forEach(vm => {
      const tools = toolsMap.get(vm.vmName);
      if (!tools) {
        notInstalled++;
      } else if (tools.toolsStatus === 'toolsOk') {
        running++;
      } else if (tools.toolsStatus === 'toolsOld') {
        outdated++;
      } else if (tools.toolsStatus === 'toolsNotInstalled') {
        notInstalled++;
      } else {
        outdated++;
      }
    });

    return { running, outdated, notInstalled };
  }
}

export async function generatePDF(data: RVToolsData, options?: Partial<PDFOptions>): Promise<Blob> {
  const generator = new PDFGenerator();
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
