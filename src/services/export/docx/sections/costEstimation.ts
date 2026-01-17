// Cost Estimation Section

import { Paragraph, Table, TableRow, TextRun, PageBreak, HeadingLevel, BorderStyle, ShadingType, AlignmentType } from 'docx';
import reportTemplates from '@/data/reportTemplates.json';
import { STYLES, type DocumentContent, type ROKSSizing, type VSIMapping } from '../types';
import { createHeading, createParagraph, createBulletList, createTableCell } from '../utils/helpers';

export function buildCostEstimation(
  roksSizing: ROKSSizing,
  vsiMappings: VSIMapping[]
): DocumentContent[] {
  const templates = reportTemplates.costEstimation;

  const totalVSIComputeCost = vsiMappings.reduce((sum, m) => sum + m.computeCost, 0);
  const totalBootStorageCost = vsiMappings.reduce((sum, m) => sum + m.bootStorageCost, 0);
  const totalDataStorageCost = vsiMappings.reduce((sum, m) => sum + m.dataStorageCost, 0);
  const totalVSIStorageCost = totalBootStorageCost + totalDataStorageCost;
  const totalVSIMonthlyCost = totalVSIComputeCost + totalVSIStorageCost;
  const totalBootStorageGiB = vsiMappings.reduce((sum, m) => sum + m.bootDiskGiB, 0);
  const totalDataStorageGiB = vsiMappings.reduce((sum, m) => sum + m.dataDiskGiB, 0);
  const totalVSIStorageGiB = totalBootStorageGiB + totalDataStorageGiB;
  const roksMonthlyCost = roksSizing.monthlyCost;

  const costRatio = totalVSIMonthlyCost > 0 ? (roksMonthlyCost / totalVSIMonthlyCost).toFixed(1) : 'N/A';
  const annualDifference = (roksMonthlyCost - totalVSIMonthlyCost) * 12;

  return [
    createHeading('8. ' + templates.title, HeadingLevel.HEADING_1),
    createParagraph(templates.introduction),
    createParagraph(templates.disclaimer, { spacing: { after: 240 } }),

    createHeading('8.1 ' + templates.sections.comparison.title, HeadingLevel.HEADING_2),
    createParagraph(templates.sections.comparison.description),
    new Table({
      width: { size: 100, type: 'pct' as const },
      borders: {
        top: { style: BorderStyle.SINGLE, size: 1, color: STYLES.mediumGray },
        bottom: { style: BorderStyle.SINGLE, size: 1, color: STYLES.mediumGray },
        left: { style: BorderStyle.SINGLE, size: 1, color: STYLES.mediumGray },
        right: { style: BorderStyle.SINGLE, size: 1, color: STYLES.mediumGray },
        insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: STYLES.mediumGray },
        insideVertical: { style: BorderStyle.SINGLE, size: 1, color: STYLES.mediumGray },
      },
      rows: [
        new TableRow({
          children: [
            createTableCell('Platform', { header: true }),
            createTableCell('Compute', { header: true, align: AlignmentType.RIGHT }),
            createTableCell('Storage', { header: true, align: AlignmentType.RIGHT }),
            createTableCell('Monthly Total', { header: true, align: AlignmentType.RIGHT }),
            createTableCell('Annual Total', { header: true, align: AlignmentType.RIGHT }),
          ],
        }),
        new TableRow({
          children: [
            createTableCell('ROKS (Bare Metal)'),
            createTableCell(`$${roksMonthlyCost.toLocaleString()}`, { align: AlignmentType.RIGHT }),
            createTableCell('Included', { align: AlignmentType.RIGHT }),
            createTableCell(`$${roksMonthlyCost.toLocaleString()}`, { align: AlignmentType.RIGHT }),
            createTableCell(`$${(roksMonthlyCost * 12).toLocaleString()}`, { align: AlignmentType.RIGHT }),
          ],
        }),
        new TableRow({
          children: [
            createTableCell('VPC VSI'),
            createTableCell(`$${Math.round(totalVSIComputeCost).toLocaleString()}`, { align: AlignmentType.RIGHT }),
            createTableCell(`$${Math.round(totalVSIStorageCost).toLocaleString()}`, { align: AlignmentType.RIGHT }),
            createTableCell(`$${Math.round(totalVSIMonthlyCost).toLocaleString()}`, { align: AlignmentType.RIGHT }),
            createTableCell(`$${Math.round(totalVSIMonthlyCost * 12).toLocaleString()}`, { align: AlignmentType.RIGHT }),
          ],
        }),
      ],
    }),

    new Paragraph({ spacing: { before: 200 } }),
    createParagraph('VSI Block Storage Breakdown', { bold: true }),
    new Table({
      width: { size: 100, type: 'pct' as const },
      borders: {
        top: { style: BorderStyle.SINGLE, size: 1, color: STYLES.mediumGray },
        bottom: { style: BorderStyle.SINGLE, size: 1, color: STYLES.mediumGray },
        left: { style: BorderStyle.SINGLE, size: 1, color: STYLES.mediumGray },
        right: { style: BorderStyle.SINGLE, size: 1, color: STYLES.mediumGray },
        insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: STYLES.mediumGray },
        insideVertical: { style: BorderStyle.SINGLE, size: 1, color: STYLES.mediumGray },
      },
      rows: [
        new TableRow({
          children: [
            createTableCell('Storage Type', { header: true }),
            createTableCell('Capacity', { header: true, align: AlignmentType.RIGHT }),
            createTableCell('Profile', { header: true }),
            createTableCell('Monthly Cost', { header: true, align: AlignmentType.RIGHT }),
          ],
        }),
        new TableRow({
          children: [
            createTableCell('Boot Volumes'),
            createTableCell(`${Math.round(totalBootStorageGiB)} GiB`, { align: AlignmentType.RIGHT }),
            createTableCell('general-purpose (3 IOPS/GB)'),
            createTableCell(`$${Math.round(totalBootStorageCost).toLocaleString()}`, { align: AlignmentType.RIGHT }),
          ],
        }),
        new TableRow({
          children: [
            createTableCell('Data Volumes'),
            createTableCell(`${Math.round(totalDataStorageGiB)} GiB`, { align: AlignmentType.RIGHT }),
            createTableCell('Tiered (see assumptions)'),
            createTableCell(`$${Math.round(totalDataStorageCost).toLocaleString()}`, { align: AlignmentType.RIGHT }),
          ],
        }),
        new TableRow({
          children: [
            createTableCell('Total Storage', { bold: true }),
            createTableCell(`${Math.round(totalVSIStorageGiB / 1024)} TiB`, { align: AlignmentType.RIGHT, bold: true }),
            createTableCell(''),
            createTableCell(`$${Math.round(totalVSIStorageCost).toLocaleString()}`, { align: AlignmentType.RIGHT, bold: true }),
          ],
        }),
      ],
    }),

    new Paragraph({ spacing: { before: 160 } }),
    createParagraph('Data Volume Storage Tier Assumptions:', { bold: true }),
    ...createBulletList([
      '50% general-purpose (3 IOPS/GB) at $0.08/GB - Standard workloads',
      '30% 5iops-tier (5 IOPS/GB) at $0.10/GB - Moderate I/O applications',
      '20% 10iops-tier (10 IOPS/GB) at $0.13/GB - Database and high-performance workloads',
    ]),

    new Paragraph({ spacing: { before: 240 } }),
    createHeading('8.2 Cost Analysis & Recommendations', HeadingLevel.HEADING_2),

    new Paragraph({
      spacing: { before: 120, after: 120 },
      shading: { fill: 'fff8e6', type: ShadingType.SOLID },
      children: [
        new TextRun({
          text: 'Key Finding: ',
          bold: true,
          size: STYLES.bodySize,
        }),
        new TextRun({
          text: `At list pricing, ROKS with OpenShift Virtualization is approximately ${costRatio}× higher cost than VPC VSI, representing an annual difference of $${Math.abs(Math.round(annualDifference)).toLocaleString()}.`,
          size: STYLES.bodySize,
        }),
      ],
    }),

    createParagraph('Platform Selection Guidance', { bold: true, spacing: { before: 200 } }),
    ...createBulletList([
      'Choose ROKS if: Your organization plans to modernize applications to containers, requires hybrid cloud portability, or wants a unified platform for VMs and containers.',
      'Choose VSI if: Your primary goal is a straightforward lift-and-shift migration with minimal operational change.',
    ]),

    new Paragraph({ spacing: { before: 200 } }),
    createParagraph('Important Pricing Considerations', { bold: true }),
    createParagraph(
      'The estimates above are based on IBM Cloud list pricing. Actual costs may differ significantly based on:',
      { spacing: { after: 60 } }
    ),
    ...createBulletList([
      'Enterprise discount agreements - Large organizations typically negotiate 20-40% discounts',
      'Reserved capacity commitments - 1-year or 3-year commitments can reduce costs by 30-50%',
      'Hybrid cloud entitlements - Existing Red Hat subscriptions may offset ROKS licensing costs',
      'Promotional pricing - IBM frequently offers migration incentives for VMware customers',
    ]),

    new Paragraph({ spacing: { before: 240 } }),
    createHeading('8.3 ' + templates.notes.title, HeadingLevel.HEADING_2),
    ...createBulletList(templates.notes.items),

    new Paragraph({ children: [new PageBreak()] }),
  ];
}
