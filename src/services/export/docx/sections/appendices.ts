// Appendices Section

import { Paragraph, Table, TableRow, PageBreak, HeadingLevel, BorderStyle, AlignmentType } from 'docx';
import { STYLES, type DocumentContent, type VMReadiness } from '../types';
import { createHeading, createParagraph, createTableCell } from '../utils/helpers';

export function buildAppendices(readiness: VMReadiness[], maxIssueVMs: number): DocumentContent[] {
  const allBlockerVMs = readiness.filter((r) => r.hasBlocker);
  const allWarningVMs = readiness.filter((r) => r.hasWarning && !r.hasBlocker);

  // Only include appendices if there are more VMs than shown in main body
  if (allBlockerVMs.length <= maxIssueVMs && allWarningVMs.length <= maxIssueVMs) {
    return [];
  }

  const sections: DocumentContent[] = [
    createHeading('Appendices', HeadingLevel.HEADING_1),
    createParagraph(
      'The following appendices contain the complete lists of virtual machines with migration issues that were summarized in the main report.',
      { spacing: { after: 200 } }
    ),
  ];

  // Appendix A: Full Blockers List
  if (allBlockerVMs.length > maxIssueVMs) {
    sections.push(
      new Paragraph({ spacing: { before: 240 } }),
      createHeading('Appendix A: Complete List of VMs with Blockers', HeadingLevel.HEADING_2),
      createParagraph(
        `This appendix contains all ${allBlockerVMs.length} virtual machines with migration blockers that must be resolved before migration.`,
        { spacing: { after: 120 } }
      ),
      new Table({
        width: { size: 100, type: 'pct' as const },
        columnWidths: [2500, 1500, 1500, 1500, 3500],
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
              createTableCell('Cluster', { header: true }),
              createTableCell('vCPUs', { header: true, align: AlignmentType.RIGHT }),
              createTableCell('Memory', { header: true, align: AlignmentType.RIGHT }),
              createTableCell('Issues', { header: true }),
            ],
          }),
          ...allBlockerVMs.map(
            (vm, index) =>
              new TableRow({
                children: [
                  createTableCell(
                    vm.vmName.length > 25 ? vm.vmName.substring(0, 22) + '...' : vm.vmName,
                    { altRow: index % 2 === 1 }
                  ),
                  createTableCell(vm.cluster, { altRow: index % 2 === 1 }),
                  createTableCell(`${vm.cpus}`, { align: AlignmentType.RIGHT, altRow: index % 2 === 1 }),
                  createTableCell(`${vm.memoryGiB} GiB`, { align: AlignmentType.RIGHT, altRow: index % 2 === 1 }),
                  createTableCell(vm.issues.join(', '), { altRow: index % 2 === 1 }),
                ],
              })
          ),
        ],
      })
    );
  }

  // Appendix B: Full Warnings List
  if (allWarningVMs.length > maxIssueVMs) {
    sections.push(
      new Paragraph({ children: [new PageBreak()] }),
      createHeading('Appendix B: Complete List of VMs with Warnings', HeadingLevel.HEADING_2),
      createParagraph(
        `This appendix contains all ${allWarningVMs.length} virtual machines with warnings that should be reviewed before migration.`,
        { spacing: { after: 120 } }
      ),
      new Table({
        width: { size: 100, type: 'pct' as const },
        columnWidths: [2500, 1500, 1500, 1500, 3500],
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
              createTableCell('Cluster', { header: true }),
              createTableCell('vCPUs', { header: true, align: AlignmentType.RIGHT }),
              createTableCell('Memory', { header: true, align: AlignmentType.RIGHT }),
              createTableCell('Warnings', { header: true }),
            ],
          }),
          ...allWarningVMs.map(
            (vm, index) =>
              new TableRow({
                children: [
                  createTableCell(
                    vm.vmName.length > 25 ? vm.vmName.substring(0, 22) + '...' : vm.vmName,
                    { altRow: index % 2 === 1 }
                  ),
                  createTableCell(vm.cluster, { altRow: index % 2 === 1 }),
                  createTableCell(`${vm.cpus}`, { align: AlignmentType.RIGHT, altRow: index % 2 === 1 }),
                  createTableCell(`${vm.memoryGiB} GiB`, { align: AlignmentType.RIGHT, altRow: index % 2 === 1 }),
                  createTableCell(vm.issues.join(', '), { altRow: index % 2 === 1 }),
                ],
              })
          ),
        ],
      })
    );
  }

  return sections;
}
