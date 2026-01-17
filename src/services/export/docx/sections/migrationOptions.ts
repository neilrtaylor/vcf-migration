// Migration Options Section

import { Paragraph, Table, TableRow, PageBreak, HeadingLevel, BorderStyle } from 'docx';
import reportTemplates from '@/data/reportTemplates.json';
import { STYLES, type DocumentContent } from '../types';
import { createHeading, createParagraph, createTableCell } from '../utils/helpers';

export function buildMigrationOptions(): DocumentContent[] {
  const templates = reportTemplates.migrationOptions;

  return [
    createHeading('4. ' + templates.title, HeadingLevel.HEADING_1),
    createParagraph(templates.introduction),
    createParagraph(templates.comparisonIntro),
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
            createTableCell('Characteristic', { header: true }),
            createTableCell('ROKS + OpenShift Virt', { header: true }),
            createTableCell('VPC Virtual Servers', { header: true }),
          ],
        }),
        new TableRow({
          children: [
            createTableCell('Migration Approach', { bold: true }),
            createTableCell('VM to container platform'),
            createTableCell('Lift-and-shift'),
          ],
        }),
        new TableRow({
          children: [
            createTableCell('Infrastructure', { bold: true }),
            createTableCell('Bare Metal with local NVMe'),
            createTableCell('Multi-tenant virtual servers'),
          ],
        }),
        new TableRow({
          children: [
            createTableCell('Storage', { bold: true }),
            createTableCell('ODF (Ceph) with 3x replication'),
            createTableCell('Block storage volumes'),
          ],
        }),
        new TableRow({
          children: [
            createTableCell('Modernization Path', { bold: true }),
            createTableCell('Containerization ready'),
            createTableCell('Traditional VM operations'),
          ],
        }),
        new TableRow({
          children: [
            createTableCell('Operational Model', { bold: true }),
            createTableCell('Kubernetes/GitOps'),
            createTableCell('Traditional VM management'),
          ],
        }),
        new TableRow({
          children: [
            createTableCell('Best For', { bold: true }),
            createTableCell('Application modernization'),
            createTableCell('Quick migration with minimal change'),
          ],
        }),
      ],
    }),
    new Paragraph({ children: [new PageBreak()] }),
  ];
}
