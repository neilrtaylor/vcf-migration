// VPC VSI and ROKS BOM Excel Generator with Formulas and Styling
import ExcelJS from 'exceljs';
import type { CostEstimate, RegionCode, DiscountType } from '../costEstimation';
import type { MigrationInsights } from '@/services/ai/types';
import type { IBMCloudPricing } from '../pricing/pricingCache';
import { getCurrentPricing } from '../pricing/pricingCache';
import ibmCloudConfig from '@/data/ibmCloudConfig.json';

// Helper to get active pricing data
function getActivePricing(): IBMCloudPricing {
  try {
    return getCurrentPricing().data;
  } catch {
    return ibmCloudConfig as unknown as IBMCloudPricing;
  }
}

// VM detail for xlsx export
export interface VMDetail {
  vmName: string;
  guestOS: string;
  profile: string;
  vcpus: number;
  memoryGiB: number;
  bootVolumeGiB: number;
  dataVolumes: { sizeGiB: number }[];
}

// ROKS node detail for xlsx export
export interface ROKSNodeDetail {
  nodeName: string;
  profile: string;
  nodeType: 'worker' | 'storage';
}

// Format OS for display (e.g., "Red Hat Enterprise Linux")
function formatOS(guestOS: string): string {
  const osLower = guestOS.toLowerCase();
  if (osLower.includes('rhel') || osLower.includes('red hat')) {
    return 'Red Hat Enterprise Linux';
  }
  if (osLower.includes('ubuntu')) {
    return 'Ubuntu Linux';
  }
  if (osLower.includes('centos')) {
    return 'CentOS';
  }
  if (osLower.includes('windows server') || osLower.includes('microsoft windows server')) {
    return 'Windows Server';
  }
  if (osLower.includes('windows')) {
    return 'Windows';
  }
  if (osLower.includes('sles') || osLower.includes('suse')) {
    return 'SUSE Linux Enterprise';
  }
  if (osLower.includes('debian')) {
    return 'Debian';
  }
  if (osLower.includes('rocky')) {
    return 'Rocky Linux';
  }
  if (osLower.includes('alma')) {
    return 'AlmaLinux';
  }
  return guestOS.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
}

// Get VSI family prefix for profile naming (bxf, cxf, mxf for AMD)
function getProfilePrefix(profile: string): string {
  if (profile.startsWith('bx2') || profile.startsWith('bx')) return 'bxf';
  if (profile.startsWith('cx2') || profile.startsWith('cx')) return 'cxf';
  if (profile.startsWith('mx2') || profile.startsWith('mx')) return 'mxf';
  const parts = profile.split('-');
  if (parts.length >= 2) {
    return parts[0].replace('2', 'f');
  }
  return 'bxf';
}

// Get simplified profile display name (e.g., bxf-2x8)
function getDisplayProfile(profile: string): string {
  const prefix = getProfilePrefix(profile);
  const parts = profile.split('-');
  if (parts.length >= 2) {
    return `${prefix}-${parts.slice(1).join('-')}`;
  }
  return profile;
}

// Style definitions
const STYLES = {
  headerBlue: {
    fill: { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FF0077B6' } },
    font: { bold: true, color: { argb: 'FFFFFFFF' } },
  },
  headerBlack: {
    fill: { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FF262626' } },
    font: { bold: true, color: { argb: 'FFFFFFFF' } },
  },
  sectionHeader: {
    fill: { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FF262626' } },
    font: { bold: true, color: { argb: 'FFFFFFFF' } },
  },
  vmHeader: {
    font: { bold: true },
    fill: { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFE8E8E8' } },
  },
  currency: {
    numFmt: '"$"#,##0.00',
  },
  currencyBold: {
    numFmt: '"$"#,##0.00',
    font: { bold: true },
  },
  totalRow: {
    font: { bold: true },
    fill: { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFD4EDDA' } },
  },
};

// Generate VPC VSI BOM as xlsx workbook with formulas and styling
export async function generateVSIBOMExcel(
  vmDetails: VMDetail[],
  _estimate: CostEstimate,
  vpcName: string = 'Default VPC',
  region: RegionCode = 'us-south',
  discountType: DiscountType = 'onDemand',
  aiInsights?: MigrationInsights | null
): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'VCF Migration Tool';
  workbook.created = new Date();

  const pricing = getActivePricing();
  const regionData = pricing.regions[region];
  const multiplier = regionData?.multiplier || 1.0;
  const storageCostPerGB = (pricing.blockStorage.generalPurpose.costPerGBMonth || 0.08) * multiplier;

  // === BOM Sheet ===
  const bomSheet = workbook.addWorksheet('VPC VSI BOM');

  // Set column widths
  bomSheet.columns = [
    { width: 55 }, // Item
    { width: 18 }, // Unit Price
    { width: 10 }, // Quantity
    { width: 15 }, // Monthly Price
    { width: 18 }, // Section Total
  ];

  let currentRow = 1;

  // === Pricing Reference Section ===
  const pricingHeaderRow = bomSheet.getRow(currentRow);
  pricingHeaderRow.getCell(1).value = 'Pricing Reference';
  pricingHeaderRow.getCell(2).value = 'Value';
  pricingHeaderRow.getCell(1).fill = STYLES.headerBlack.fill;
  pricingHeaderRow.getCell(1).font = STYLES.headerBlack.font;
  pricingHeaderRow.getCell(2).fill = STYLES.headerBlack.fill;
  pricingHeaderRow.getCell(2).font = STYLES.headerBlack.font;
  currentRow++;

  bomSheet.getRow(currentRow).getCell(1).value = 'Storage Cost per GB (3 IOPS)';
  bomSheet.getRow(currentRow).getCell(2).value = storageCostPerGB;
  bomSheet.getRow(currentRow).getCell(2).numFmt = '"$"#,##0.0000';
  const storageCostCell = `B${currentRow}`;
  currentRow++;

  bomSheet.getRow(currentRow).getCell(1).value = 'Region Multiplier';
  bomSheet.getRow(currentRow).getCell(2).value = multiplier;
  currentRow++;

  currentRow++; // Empty row

  // === VPC Header ===
  const vpcHeaderRow = bomSheet.getRow(currentRow);
  ['Name', 'Region', '', '', 'Total price for VPC'].forEach((val, i) => {
    const cell = vpcHeaderRow.getCell(i + 1);
    cell.value = val;
    cell.fill = STYLES.headerBlue.fill;
    cell.font = STYLES.headerBlue.font;
  });
  currentRow++;

  const vpcValueRow = bomSheet.getRow(currentRow);
  vpcValueRow.getCell(1).value = vpcName;
  vpcValueRow.getCell(2).value = regionData?.name || region;
  const vpcTotalRow = currentRow;
  currentRow++;

  // === Zone Header ===
  const zoneHeaderRow = bomSheet.getRow(currentRow);
  ['Zone Name', '', '', '', 'Zone Total'].forEach((val, i) => {
    const cell = zoneHeaderRow.getCell(i + 1);
    cell.value = val;
    cell.fill = STYLES.headerBlue.fill;
    cell.font = STYLES.headerBlue.font;
  });
  currentRow++;

  const zoneValueRow = bomSheet.getRow(currentRow);
  zoneValueRow.getCell(1).value = 'Zone 1';
  const zoneTotalRowNum = currentRow;
  currentRow++;

  // === Item Headers ===
  const itemHeaderRow = bomSheet.getRow(currentRow);
  ['Item', 'Monthly Unit Price', 'Quantity', 'Monthly Price', ''].forEach((val, i) => {
    const cell = itemHeaderRow.getCell(i + 1);
    cell.value = val;
    cell.fill = STYLES.headerBlue.fill;
    cell.font = STYLES.headerBlue.font;
  });
  currentRow++;

  // === Expected Internet Traffic ===
  const trafficHeaderRow = bomSheet.getRow(currentRow);
  trafficHeaderRow.getCell(1).value = 'Expected Internet Traffic';
  trafficHeaderRow.getCell(1).fill = STYLES.sectionHeader.fill;
  trafficHeaderRow.getCell(1).font = STYLES.sectionHeader.font;
  const trafficTotalRow = currentRow;
  currentRow++;

  const trafficItemRow = bomSheet.getRow(currentRow);
  trafficItemRow.getCell(1).value = '0 GB of Traffic';
  trafficItemRow.getCell(2).value = 0;
  trafficItemRow.getCell(2).numFmt = STYLES.currency.numFmt;
  trafficItemRow.getCell(3).value = 1;
  trafficItemRow.getCell(4).value = { formula: `B${currentRow}*C${currentRow}` };
  trafficItemRow.getCell(4).numFmt = STYLES.currency.numFmt;
  currentRow++;

  // Set traffic total formula
  bomSheet.getRow(trafficTotalRow).getCell(5).value = { formula: `D${currentRow - 1}` };
  bomSheet.getRow(trafficTotalRow).getCell(5).numFmt = STYLES.currency.numFmt;
  bomSheet.getRow(trafficTotalRow).getCell(5).font = { bold: true };

  // === Compute Section ===
  const computeHeaderRow = bomSheet.getRow(currentRow);
  computeHeaderRow.getCell(1).value = 'Compute';
  computeHeaderRow.getCell(1).fill = STYLES.sectionHeader.fill;
  computeHeaderRow.getCell(1).font = STYLES.sectionHeader.font;
  const computeTotalRowNum = currentRow;
  currentRow++;

  // Track VM total rows for compute formula
  const vmTotalRows: number[] = [];

  // === Virtual Server entries ===
  for (const vm of vmDetails) {
    const displayProfile = getDisplayProfile(vm.profile);
    const displayOS = formatOS(vm.guestOS);

    // Get VSI pricing
    const vsiProfile = pricing.vsi[vm.profile as keyof typeof pricing.vsi];
    const vsiMonthlyCost = vsiProfile ? vsiProfile.monthlyRate * multiplier : 0;

    // Boot volume size
    const bootVolumeSize = vm.bootVolumeGiB || (vm.guestOS.toLowerCase().includes('windows') ? 120 : 100);

    // Calculate item rows for formula
    const vmHeaderRowNum = currentRow;
    const itemStartRow = currentRow + 1;
    const itemCount = 2 + vm.dataVolumes.length;
    const itemEndRow = itemStartRow + itemCount - 1;

    // Virtual Server header row with gray background - includes hostname
    const vsHeaderRow = bomSheet.getRow(currentRow);
    vsHeaderRow.getCell(1).value = `Virtual Server: ${vm.vmName} - ${displayProfile} - ${displayOS} (PAYG)`;
    vsHeaderRow.getCell(1).font = STYLES.vmHeader.font;
    vsHeaderRow.getCell(1).fill = STYLES.vmHeader.fill;
    vsHeaderRow.getCell(5).value = { formula: `SUM(D${itemStartRow}:D${itemEndRow})` };
    vsHeaderRow.getCell(5).numFmt = STYLES.currency.numFmt;
    vsHeaderRow.getCell(5).font = { bold: true };
    vsHeaderRow.getCell(5).fill = STYLES.vmHeader.fill;
    vmTotalRows.push(vmHeaderRowNum);
    currentRow++;

    // VSI profile row
    const profileRow = bomSheet.getRow(currentRow);
    profileRow.getCell(1).value = `${displayProfile} - ${displayOS}`;
    profileRow.getCell(2).value = vsiMonthlyCost;
    profileRow.getCell(2).numFmt = STYLES.currency.numFmt;
    profileRow.getCell(3).value = 1;
    profileRow.getCell(4).value = { formula: `B${currentRow}*C${currentRow}` };
    profileRow.getCell(4).numFmt = STYLES.currency.numFmt;
    currentRow++;

    // Boot volume row with formula for unit price
    const bootRow = bomSheet.getRow(currentRow);
    bootRow.getCell(1).value = `Boot volume - ${bootVolumeSize} GB (3 IOPS)`;
    bootRow.getCell(2).value = { formula: `${bootVolumeSize}*${storageCostCell}` };
    bootRow.getCell(2).numFmt = STYLES.currency.numFmt;
    bootRow.getCell(3).value = 1;
    bootRow.getCell(4).value = { formula: `B${currentRow}*C${currentRow}` };
    bootRow.getCell(4).numFmt = STYLES.currency.numFmt;
    currentRow++;

    // Data volume rows
    for (const vol of vm.dataVolumes) {
      const dataRow = bomSheet.getRow(currentRow);
      dataRow.getCell(1).value = `Data volume - ${vol.sizeGiB} GB (3 IOPS)`;
      dataRow.getCell(2).value = { formula: `${vol.sizeGiB}*${storageCostCell}` };
      dataRow.getCell(2).numFmt = STYLES.currency.numFmt;
      dataRow.getCell(3).value = 1;
      dataRow.getCell(4).value = { formula: `B${currentRow}*C${currentRow}` };
      dataRow.getCell(4).numFmt = STYLES.currency.numFmt;
      currentRow++;
    }
  }

  // Set section totals with formulas
  const computeFormula = vmTotalRows.length > 0 ? vmTotalRows.map(r => `E${r}`).join('+') : '0';
  bomSheet.getRow(computeTotalRowNum).getCell(5).value = { formula: computeFormula };
  bomSheet.getRow(computeTotalRowNum).getCell(5).numFmt = STYLES.currency.numFmt;
  bomSheet.getRow(computeTotalRowNum).getCell(5).font = { bold: true };

  bomSheet.getRow(zoneTotalRowNum).getCell(5).value = { formula: `E${computeTotalRowNum}` };
  bomSheet.getRow(zoneTotalRowNum).getCell(5).numFmt = STYLES.currency.numFmt;
  bomSheet.getRow(zoneTotalRowNum).getCell(5).font = { bold: true };

  bomSheet.getRow(vpcTotalRow).getCell(5).value = { formula: `E${zoneTotalRowNum}` };
  bomSheet.getRow(vpcTotalRow).getCell(5).numFmt = STYLES.currency.numFmt;
  bomSheet.getRow(vpcTotalRow).getCell(5).font = { bold: true };

  // === VM Details Sheet ===
  const detailSheet = workbook.addWorksheet('VM Details');
  detailSheet.columns = [
    { header: 'VM Name', width: 40 },
    { header: 'Guest OS', width: 25 },
    { header: 'VSI Profile', width: 15 },
    { header: 'vCPUs', width: 8 },
    { header: 'Memory (GiB)', width: 12 },
    { header: 'Boot (GB)', width: 10 },
    { header: 'Data Volumes', width: 20 },
    { header: 'Profile Cost', width: 12 },
    { header: 'Storage Cost', width: 12 },
    { header: 'Total Monthly', width: 14 },
  ];

  // Style header row
  const detailHeaderRow = detailSheet.getRow(1);
  detailHeaderRow.eachCell(cell => {
    cell.fill = STYLES.headerBlue.fill;
    cell.font = STYLES.headerBlue.font;
  });

  let detailRowNum = 2;
  for (const vm of vmDetails) {
    const vsiProfile = pricing.vsi[vm.profile as keyof typeof pricing.vsi];
    const vsiCost = vsiProfile ? vsiProfile.monthlyRate * multiplier : 0;
    const bootSize = vm.bootVolumeGiB || (vm.guestOS.toLowerCase().includes('windows') ? 120 : 100);
    const dataStorageTotal = vm.dataVolumes.reduce((s, v) => s + v.sizeGiB, 0);

    const row = detailSheet.getRow(detailRowNum);
    row.getCell(1).value = vm.vmName;
    row.getCell(2).value = vm.guestOS;
    row.getCell(3).value = vm.profile;
    row.getCell(4).value = vm.vcpus;
    row.getCell(5).value = vm.memoryGiB;
    row.getCell(6).value = bootSize;
    row.getCell(7).value = vm.dataVolumes.map(v => `${v.sizeGiB}GB`).join(', ') || 'None';
    row.getCell(8).value = vsiCost;
    row.getCell(8).numFmt = STYLES.currency.numFmt;
    // Storage cost = (boot + data) * cost per GB
    row.getCell(9).value = { formula: `(F${detailRowNum}+${dataStorageTotal})*${storageCostPerGB}` };
    row.getCell(9).numFmt = STYLES.currency.numFmt;
    // Total = profile + storage
    row.getCell(10).value = { formula: `H${detailRowNum}+I${detailRowNum}` };
    row.getCell(10).numFmt = STYLES.currency.numFmt;
    detailRowNum++;
  }

  // Add totals row
  const totalRow = detailSheet.getRow(detailRowNum);
  totalRow.getCell(1).value = 'TOTAL';
  totalRow.getCell(1).font = { bold: true };
  totalRow.getCell(4).value = { formula: `SUM(D2:D${detailRowNum - 1})` };
  totalRow.getCell(5).value = { formula: `SUM(E2:E${detailRowNum - 1})` };
  totalRow.getCell(6).value = { formula: `SUM(F2:F${detailRowNum - 1})` };
  totalRow.getCell(8).value = { formula: `SUM(H2:H${detailRowNum - 1})` };
  totalRow.getCell(8).numFmt = STYLES.currency.numFmt;
  totalRow.getCell(9).value = { formula: `SUM(I2:I${detailRowNum - 1})` };
  totalRow.getCell(9).numFmt = STYLES.currency.numFmt;
  totalRow.getCell(10).value = { formula: `SUM(J2:J${detailRowNum - 1})` };
  totalRow.getCell(10).numFmt = STYLES.currency.numFmt;
  totalRow.eachCell(cell => {
    cell.fill = STYLES.totalRow.fill;
    cell.font = STYLES.totalRow.font;
  });

  // === Summary Sheet ===
  const summarySheet = workbook.addWorksheet('Summary');
  summarySheet.columns = [{ width: 25 }, { width: 20 }];

  const summaryData = [
    ['VPC VSI Cost Summary', ''],
    ['', ''],
    ['Configuration', ''],
    ['VPC Name', vpcName],
    ['Region', regionData?.name || region],
    ['Pricing Type', discountType === 'onDemand' ? 'Pay-As-You-Go' : discountType],
    ['Storage Cost/GB', storageCostPerGB],
    ['', ''],
    ['Resource Count', ''],
    ['Total Virtual Servers', vmDetails.length],
    ['Unique Profiles', [...new Set(vmDetails.map(v => v.profile))].length],
    ['Total vCPUs', vmDetails.reduce((s, v) => s + v.vcpus, 0)],
    ['Total Memory (GiB)', vmDetails.reduce((s, v) => s + v.memoryGiB, 0)],
    ['', ''],
    ['Cost Summary', ''],
  ];

  summaryData.forEach((rowData, i) => {
    const row = summarySheet.getRow(i + 1);
    row.getCell(1).value = rowData[0];
    row.getCell(2).value = rowData[1];
    if (rowData[0] === 'VPC VSI Cost Summary' || rowData[0] === 'Configuration' ||
        rowData[0] === 'Resource Count' || rowData[0] === 'Cost Summary') {
      row.getCell(1).font = { bold: true };
    }
  });

  // Monthly cost with formula reference
  const monthlyCostRow = summarySheet.getRow(16);
  monthlyCostRow.getCell(1).value = 'Monthly Compute Cost';
  monthlyCostRow.getCell(2).value = { formula: `'VM Details'!J${detailRowNum}` };
  monthlyCostRow.getCell(2).numFmt = STYLES.currency.numFmt;

  const annualCostRow = summarySheet.getRow(17);
  annualCostRow.getCell(1).value = 'Annual Compute Cost';
  annualCostRow.getCell(2).value = { formula: 'B16*12' };
  annualCostRow.getCell(2).numFmt = STYLES.currency.numFmt;

  summarySheet.getRow(19).getCell(1).value = 'Generated';
  summarySheet.getRow(19).getCell(2).value = new Date().toLocaleString();

  // Add AI cost optimization notes if available
  if (aiInsights?.costOptimizations && aiInsights.costOptimizations.length > 0) {
    addAINotesSheet(workbook, aiInsights.costOptimizations);
  }

  return workbook;
}

// Generate ROKS BOM as xlsx workbook with formulas
export async function generateROKSBOMExcel(
  _estimate: CostEstimate,
  nodeDetails: ROKSNodeDetail[],
  clusterName: string = 'ROKS Cluster',
  region: RegionCode = 'us-south',
  discountType: DiscountType = 'onDemand',
  aiInsights?: MigrationInsights | null
): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'VCF Migration Tool';
  workbook.created = new Date();

  const pricing = getActivePricing();
  const regionData = pricing.regions[region];
  const multiplier = regionData?.multiplier || 1.0;

  // === BOM Sheet ===
  const bomSheet = workbook.addWorksheet('ROKS BOM');
  bomSheet.columns = [
    { width: 55 }, { width: 18 }, { width: 10 }, { width: 15 }, { width: 18 },
  ];

  let currentRow = 1;

  // === Cluster Header ===
  const clusterHeaderRow = bomSheet.getRow(currentRow);
  ['Name', 'Region', '', '', 'Total price for ROKS'].forEach((val, i) => {
    const cell = clusterHeaderRow.getCell(i + 1);
    cell.value = val;
    cell.fill = STYLES.headerBlue.fill;
    cell.font = STYLES.headerBlue.font;
  });
  currentRow++;

  const clusterValueRow = bomSheet.getRow(currentRow);
  clusterValueRow.getCell(1).value = clusterName;
  clusterValueRow.getCell(2).value = regionData?.name || region;
  const clusterTotalRowNum = currentRow;
  currentRow++;

  // === Items Header ===
  const itemHeaderRow = bomSheet.getRow(currentRow);
  ['Item', 'Monthly Unit Price', 'Quantity', 'Monthly Price', ''].forEach((val, i) => {
    const cell = itemHeaderRow.getCell(i + 1);
    cell.value = val;
    cell.fill = STYLES.headerBlue.fill;
    cell.font = STYLES.headerBlue.font;
  });
  currentRow++;

  // === Compute Nodes Section ===
  const computeNodes = nodeDetails.filter(n => n.nodeType === 'worker');
  const storageNodes = nodeDetails.filter(n => n.nodeType === 'storage');

  const computeByProfile = computeNodes.reduce((acc, node) => {
    acc[node.profile] = (acc[node.profile] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const computeSectionRowNum = currentRow;
  const computeHeaderRow = bomSheet.getRow(currentRow);
  computeHeaderRow.getCell(1).value = 'Compute Nodes';
  computeHeaderRow.getCell(1).fill = STYLES.sectionHeader.fill;
  computeHeaderRow.getCell(1).font = STYLES.sectionHeader.font;
  currentRow++;

  const computeItemRows: number[] = [];
  Object.entries(computeByProfile).forEach(([profile, count]) => {
    const bmProfile = pricing.bareMetal[profile as keyof typeof pricing.bareMetal];
    const monthlyCost = bmProfile ? bmProfile.monthlyRate * multiplier : 0;

    computeItemRows.push(currentRow);
    const row = bomSheet.getRow(currentRow);
    row.getCell(1).value = `${profile} - Bare Metal`;
    row.getCell(2).value = monthlyCost;
    row.getCell(2).numFmt = STYLES.currency.numFmt;
    row.getCell(3).value = count;
    row.getCell(4).value = { formula: `B${currentRow}*C${currentRow}` };
    row.getCell(4).numFmt = STYLES.currency.numFmt;
    currentRow++;
  });

  // Compute section total
  const computeFormula = computeItemRows.length > 0 ? computeItemRows.map(r => `D${r}`).join('+') : '0';
  bomSheet.getRow(computeSectionRowNum).getCell(5).value = { formula: computeFormula };
  bomSheet.getRow(computeSectionRowNum).getCell(5).numFmt = STYLES.currency.numFmt;
  bomSheet.getRow(computeSectionRowNum).getCell(5).font = { bold: true };

  // Storage nodes (if separate)
  let storageSectionRowNum: number | null = null;
  if (storageNodes.length > 0) {
    const storageByProfile = storageNodes.reduce((acc, node) => {
      acc[node.profile] = (acc[node.profile] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    storageSectionRowNum = currentRow;
    const storageHeaderRow = bomSheet.getRow(currentRow);
    storageHeaderRow.getCell(1).value = 'Storage Nodes';
    storageHeaderRow.getCell(1).fill = STYLES.sectionHeader.fill;
    storageHeaderRow.getCell(1).font = STYLES.sectionHeader.font;
    currentRow++;

    const storageItemRows: number[] = [];
    Object.entries(storageByProfile).forEach(([profile, count]) => {
      const vsiProfile = pricing.vsi[profile as keyof typeof pricing.vsi];
      const monthlyCost = vsiProfile ? vsiProfile.monthlyRate * multiplier : 0;

      storageItemRows.push(currentRow);
      const row = bomSheet.getRow(currentRow);
      row.getCell(1).value = `${profile} - VSI`;
      row.getCell(2).value = monthlyCost;
      row.getCell(2).numFmt = STYLES.currency.numFmt;
      row.getCell(3).value = count;
      row.getCell(4).value = { formula: `B${currentRow}*C${currentRow}` };
      row.getCell(4).numFmt = STYLES.currency.numFmt;
      currentRow++;
    });

    const storageFormula = storageItemRows.map(r => `D${r}`).join('+');
    bomSheet.getRow(storageSectionRowNum).getCell(5).value = { formula: storageFormula };
    bomSheet.getRow(storageSectionRowNum).getCell(5).numFmt = STYLES.currency.numFmt;
    bomSheet.getRow(storageSectionRowNum).getCell(5).font = { bold: true };
  }

  // === Networking Section (Load Balancers) ===
  const networkingSectionRowNum = currentRow;
  const networkingHeaderRow = bomSheet.getRow(currentRow);
  networkingHeaderRow.getCell(1).value = 'Networking';
  networkingHeaderRow.getCell(1).fill = STYLES.sectionHeader.fill;
  networkingHeaderRow.getCell(1).font = STYLES.sectionHeader.font;
  currentRow++;

  // Load Balancers (2x for ingress)
  const lbCost = (pricing.networking?.loadBalancer?.perLBMonthly || 35) * multiplier;
  const lbRowNum = currentRow;
  const lbRow = bomSheet.getRow(currentRow);
  lbRow.getCell(1).value = 'Application Load Balancer (Ingress)';
  lbRow.getCell(2).value = lbCost;
  lbRow.getCell(2).numFmt = STYLES.currency.numFmt;
  lbRow.getCell(3).value = 2;
  lbRow.getCell(4).value = { formula: `B${currentRow}*C${currentRow}` };
  lbRow.getCell(4).numFmt = STYLES.currency.numFmt;
  currentRow++;

  // Networking section total
  bomSheet.getRow(networkingSectionRowNum).getCell(5).value = { formula: `D${lbRowNum}` };
  bomSheet.getRow(networkingSectionRowNum).getCell(5).numFmt = STYLES.currency.numFmt;
  bomSheet.getRow(networkingSectionRowNum).getCell(5).font = { bold: true };

  // Cluster total = Compute + Storage (if any) + Networking
  const clusterFormulaParts = [`E${computeSectionRowNum}`];
  if (storageSectionRowNum) {
    clusterFormulaParts.push(`E${storageSectionRowNum}`);
  }
  clusterFormulaParts.push(`E${networkingSectionRowNum}`);
  const clusterFormula = clusterFormulaParts.join('+');
  bomSheet.getRow(clusterTotalRowNum).getCell(5).value = { formula: clusterFormula };
  bomSheet.getRow(clusterTotalRowNum).getCell(5).numFmt = STYLES.currency.numFmt;
  bomSheet.getRow(clusterTotalRowNum).getCell(5).font = { bold: true };

  // === Summary Sheet ===
  const summarySheet = workbook.addWorksheet('Summary');
  summarySheet.columns = [{ width: 25 }, { width: 20 }];

  const summaryData = [
    ['ROKS Cluster Cost Summary', ''],
    ['', ''],
    ['Configuration', ''],
    ['Cluster Name', clusterName],
    ['Region', regionData?.name || region],
    ['Pricing Type', discountType === 'onDemand' ? 'Pay-As-You-Go' : discountType],
    ['', ''],
    ['Node Count', ''],
    ['Compute Workers', computeNodes.length],
    ['Storage Workers', storageNodes.length],
    ['Total Workers', nodeDetails.length],
    ['', ''],
    ['Cost Summary', ''],
  ];

  summaryData.forEach((rowData, i) => {
    const row = summarySheet.getRow(i + 1);
    row.getCell(1).value = rowData[0];
    row.getCell(2).value = rowData[1];
    const label = String(rowData[0]);
    if (label.includes('Summary') || label === 'Configuration' ||
        label === 'Node Count' || label === 'Cost Summary') {
      row.getCell(1).font = { bold: true };
    }
  });

  const monthlyCostRow = summarySheet.getRow(14);
  monthlyCostRow.getCell(1).value = 'Monthly Cost';
  monthlyCostRow.getCell(2).value = { formula: `'ROKS BOM'!E${clusterTotalRowNum}` };
  monthlyCostRow.getCell(2).numFmt = STYLES.currency.numFmt;

  const annualCostRow = summarySheet.getRow(15);
  annualCostRow.getCell(1).value = 'Annual Cost';
  annualCostRow.getCell(2).value = { formula: 'B14*12' };
  annualCostRow.getCell(2).numFmt = STYLES.currency.numFmt;

  summarySheet.getRow(17).getCell(1).value = 'Generated';
  summarySheet.getRow(17).getCell(2).value = new Date().toLocaleString();

  // Add AI cost optimization notes if available
  if (aiInsights?.costOptimizations && aiInsights.costOptimizations.length > 0) {
    addAINotesSheet(workbook, aiInsights.costOptimizations);
  }

  return workbook;
}

// Add AI cost optimization notes sheet
function addAINotesSheet(workbook: ExcelJS.Workbook, costOptimizations: string[]): void {
  const aiSheet = workbook.addWorksheet('AI Notes');
  aiSheet.columns = [{ width: 80 }];

  const headerRow = aiSheet.addRow(['AI-Generated Cost Optimization Notes']);
  headerRow.font = { bold: true, size: 14 };

  const disclaimerRow = aiSheet.addRow(['Generated by IBM watsonx.ai — review for accuracy']);
  disclaimerRow.font = { italic: true, size: 10, color: { argb: 'FF8A3FFC' } };

  aiSheet.addRow([]);

  costOptimizations.forEach((opt, i) => {
    aiSheet.addRow([`${i + 1}. ${opt}`]);
  });
}

// Download VPC VSI BOM as xlsx
export async function downloadVSIBOMExcel(
  vmDetails: VMDetail[],
  estimate: CostEstimate,
  vpcName?: string,
  region?: RegionCode,
  discountType?: DiscountType,
  filename?: string
): Promise<void> {
  const workbook = await generateVSIBOMExcel(
    vmDetails,
    estimate,
    vpcName,
    region || estimate.region as RegionCode,
    discountType || estimate.discountType as DiscountType
  );

  const defaultFilename = `vpc-vsi-bom-${estimate.region}-${new Date().toISOString().split('T')[0]}.xlsx`;
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || defaultFilename;
  a.click();
  URL.revokeObjectURL(url);
}

// Download ROKS BOM as xlsx
export async function downloadROKSBOMExcel(
  estimate: CostEstimate,
  nodeDetails: ROKSNodeDetail[],
  clusterName?: string,
  region?: RegionCode,
  discountType?: DiscountType,
  filename?: string
): Promise<void> {
  const workbook = await generateROKSBOMExcel(
    estimate,
    nodeDetails,
    clusterName,
    region || estimate.region as RegionCode,
    discountType || estimate.discountType as DiscountType
  );

  const defaultFilename = `roks-bom-${estimate.region}-${new Date().toISOString().split('T')[0]}.xlsx`;
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || defaultFilename;
  a.click();
  URL.revokeObjectURL(url);
}
