// VSI Overview Section

import { Paragraph, Table, TableRow, PageBreak, HeadingLevel, BorderStyle, AlignmentType } from 'docx';
import reportTemplates from '@/data/reportTemplates.json';
import { STYLES, type DocumentContent, type VSIMapping } from '../types';
import { createHeading, createParagraph, createBulletList, createTableCell } from '../utils/helpers';

export function buildVSIOverview(mappings: VSIMapping[], maxVMs: number): DocumentContent[] {
  const templates = reportTemplates.vsiOverview;

  const profileDistribution = mappings.reduce((acc, m) => {
    acc[m.family] = (acc[m.family] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return [
    createHeading('7. ' + templates.title, HeadingLevel.HEADING_1),
    createParagraph(templates.introduction),

    createHeading('7.1 ' + templates.whatIsVsi.title, HeadingLevel.HEADING_2),
    createParagraph(templates.whatIsVsi.content),

    createHeading('7.2 ' + templates.architecture.title, HeadingLevel.HEADING_2),
    createParagraph(templates.architecture.content),
    ...createBulletList(templates.architecture.components),

    createHeading('7.3 ' + templates.profileFamilies.title, HeadingLevel.HEADING_2),
    createParagraph(templates.profileFamilies.description),
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
            createTableCell('Family', { header: true }),
            createTableCell('CPU:Memory', { header: true }),
            createTableCell('Use Case', { header: true }),
          ],
        }),
        ...templates.profileFamilies.families.map(
          (f) =>
            new TableRow({
              children: [
                createTableCell(f.name),
                createTableCell(f.ratio),
                createTableCell(f.useCase),
              ],
            })
        ),
      ],
    }),

    createHeading('7.4 ' + templates.benefits.title, HeadingLevel.HEADING_2),
    ...templates.benefits.items.flatMap((b) => [
      createParagraph(b.title, { bold: true }),
      createParagraph(b.description),
    ]),

    createHeading('7.5 ' + templates.considerations.title, HeadingLevel.HEADING_2),
    ...createBulletList(templates.considerations.items),

    createHeading('7.6 ' + templates.sizing.title, HeadingLevel.HEADING_2),
    createParagraph(templates.sizing.description),

    createHeading('7.6.1 Profile Distribution', HeadingLevel.HEADING_3),
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
            createTableCell('Profile Family', { header: true }),
            createTableCell('VM Count', { header: true, align: AlignmentType.RIGHT }),
          ],
        }),
        ...Object.entries(profileDistribution).map(
          ([family, count]) =>
            new TableRow({
              children: [
                createTableCell(family),
                createTableCell(`${count}`, { align: AlignmentType.RIGHT }),
              ],
            })
        ),
      ],
    }),

    new Paragraph({ spacing: { before: 240 } }),
    createHeading('7.6.2 Sample VM to VSI Mappings', HeadingLevel.HEADING_3),
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
            createTableCell('VM Name', { header: true }),
            createTableCell('vCPUs', { header: true, align: AlignmentType.RIGHT }),
            createTableCell('Memory', { header: true, align: AlignmentType.RIGHT }),
            createTableCell('Profile', { header: true }),
          ],
        }),
        ...mappings.slice(0, maxVMs).map(
          (m) =>
            new TableRow({
              children: [
                createTableCell(m.vmName.length > 25 ? m.vmName.substring(0, 22) + '...' : m.vmName),
                createTableCell(`${m.sourceVcpus}`, { align: AlignmentType.RIGHT }),
                createTableCell(`${m.sourceMemoryGiB} GiB`, { align: AlignmentType.RIGHT }),
                createTableCell(m.profile),
              ],
            })
        ),
      ],
    }),
    mappings.length > maxVMs
      ? createParagraph(`Note: Showing ${maxVMs} of ${mappings.length} VM mappings.`, { spacing: { before: 120 } })
      : new Paragraph({}),

    new Paragraph({ spacing: { before: 360 } }),
    createHeading('7.7 Block Storage Profiles', HeadingLevel.HEADING_2),
    createParagraph(
      'IBM Cloud offers multiple storage profiles for VSI disk volumes, each optimized for different performance requirements.'
    ),

    createHeading('7.7.1 First-Generation Storage Profiles', HeadingLevel.HEADING_3),
    createParagraph('The first-generation storage profiles provide reliable block storage with predictable IOPS performance:'),
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
            createTableCell('Profile', { header: true }),
            createTableCell('IOPS/GB', { header: true, align: AlignmentType.CENTER }),
            createTableCell('Use Case', { header: true }),
            createTableCell('Boot Volume', { header: true, align: AlignmentType.CENTER }),
          ],
        }),
        new TableRow({
          children: [
            createTableCell('general-purpose'),
            createTableCell('3', { align: AlignmentType.CENTER }),
            createTableCell('Standard workloads, file servers, development'),
            createTableCell('Yes (Required)', { align: AlignmentType.CENTER }),
          ],
        }),
        new TableRow({
          children: [
            createTableCell('5iops-tier'),
            createTableCell('5', { align: AlignmentType.CENTER }),
            createTableCell('Moderate I/O applications, web servers'),
            createTableCell('No', { align: AlignmentType.CENTER }),
          ],
        }),
        new TableRow({
          children: [
            createTableCell('10iops-tier'),
            createTableCell('10', { align: AlignmentType.CENTER }),
            createTableCell('High-performance databases, transactional workloads'),
            createTableCell('No', { align: AlignmentType.CENTER }),
          ],
        }),
      ],
    }),

    createParagraph('Boot Volume Requirements:', { bold: true, spacing: { before: 200 } }),
    ...createBulletList([
      'Boot volumes must use the general-purpose profile exclusively',
      'Boot disk size is limited to 10 GiB minimum and 250 GiB maximum',
      'VSI instances cannot have more than 12 attached disk volumes',
    ]),

    new Paragraph({ children: [new PageBreak()] }),
  ];
}
