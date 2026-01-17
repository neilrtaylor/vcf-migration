// Migration Readiness Section

import { Paragraph, Table, TableRow, PageBreak, HeadingLevel, BorderStyle } from 'docx';
import reportTemplates from '@/data/reportTemplates.json';
import { STYLES, type DocumentContent, type VMReadiness } from '../types';
import { createHeading, createParagraph, createBulletList, createTableCell } from '../utils/helpers';

export function buildMigrationReadiness(readiness: VMReadiness[], maxIssueVMs: number): DocumentContent[] {
  const templates = reportTemplates.migrationReadiness;
  const blockerVMs = readiness.filter((r) => r.hasBlocker).slice(0, maxIssueVMs);
  const warningVMs = readiness.filter((r) => r.hasWarning && !r.hasBlocker).slice(0, maxIssueVMs);

  const sections: DocumentContent[] = [
    createHeading('3. ' + templates.title, HeadingLevel.HEADING_1),
    createParagraph(templates.introduction),
    createHeading('3.1 ' + templates.checksPerformed.title, HeadingLevel.HEADING_2),
    ...createBulletList(
      templates.checksPerformed.checks.map((c) => `${c.name}: ${c.description}`)
    ),
  ];

  // Blockers table
  if (blockerVMs.length > 0) {
    sections.push(
      new Paragraph({ spacing: { before: 240 } }),
      createHeading('3.2 ' + templates.blockersSummary.title, HeadingLevel.HEADING_2),
      createParagraph(templates.blockersSummary.description),
      new Table({
        width: { size: 100, type: 'pct' as const },
        columnWidths: [3000, 2000, 4000],
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
              createTableCell('Issues', { header: true }),
            ],
          }),
          ...blockerVMs.map(
            (vm) =>
              new TableRow({
                children: [
                  createTableCell(vm.vmName.length > 30 ? vm.vmName.substring(0, 27) + '...' : vm.vmName),
                  createTableCell(vm.cluster),
                  createTableCell(vm.issues.join(', ')),
                ],
              })
          ),
        ],
      })
    );
    if (readiness.filter((r) => r.hasBlocker).length > maxIssueVMs) {
      sections.push(
        createParagraph(
          `Note: Showing ${maxIssueVMs} of ${readiness.filter((r) => r.hasBlocker).length} VMs with blockers. See Appendix A for the complete list.`,
          { spacing: { before: 120 } }
        )
      );
    }
  }

  // Warnings table
  if (warningVMs.length > 0) {
    sections.push(
      new Paragraph({ spacing: { before: 240 } }),
      createHeading('3.3 ' + templates.warningsSummary.title, HeadingLevel.HEADING_2),
      createParagraph(templates.warningsSummary.description),
      new Table({
        width: { size: 100, type: 'pct' as const },
        columnWidths: [3000, 2000, 4000],
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
              createTableCell('Warnings', { header: true }),
            ],
          }),
          ...warningVMs.map(
            (vm) =>
              new TableRow({
                children: [
                  createTableCell(vm.vmName.length > 30 ? vm.vmName.substring(0, 27) + '...' : vm.vmName),
                  createTableCell(vm.cluster),
                  createTableCell(vm.issues.join(', ')),
                ],
              })
          ),
        ],
      })
    );
    if (readiness.filter((r) => r.hasWarning && !r.hasBlocker).length > maxIssueVMs) {
      sections.push(
        createParagraph(
          `Note: Showing ${maxIssueVMs} of ${readiness.filter((r) => r.hasWarning && !r.hasBlocker).length} VMs with warnings. See Appendix B for the complete list.`,
          { spacing: { before: 120 } }
        )
      );
    }
  }

  // Key Migration Risks section
  sections.push(
    new Paragraph({ spacing: { before: 240 } }),
    createHeading('3.4 Key Migration Risks', HeadingLevel.HEADING_2),
    createParagraph(
      'The following risks have been identified based on the environment analysis. These should be addressed during migration planning.',
      { spacing: { after: 200 } }
    )
  );

  const riskItems: string[] = [];

  const unsupportedOSCount = readiness.filter(r => r.issues.includes('Unsupported OS')).length;
  if (unsupportedOSCount > 0) {
    riskItems.push(`Unsupported Operating Systems: ${unsupportedOSCount} VMs have operating systems that may not be supported on the target platform. Review and plan for OS upgrades or alternative migration approaches.`);
  }

  const snapshotCount = readiness.filter(r => r.issues.includes('Old Snapshots (>30d)')).length;
  if (snapshotCount > 0) {
    riskItems.push(`Snapshot Sprawl: ${snapshotCount} VMs have snapshots older than 30 days. Consolidate or remove snapshots before migration to reduce migration time and storage requirements.`);
  }

  const rdmCount = readiness.filter(r => r.issues.includes('RDM Disk')).length;
  if (rdmCount > 0) {
    riskItems.push(`Raw Device Mappings (RDM): ${rdmCount} VMs use RDM disks which require special handling. Plan for storage reconfiguration or alternative storage solutions.`);
  }

  const noToolsCount = readiness.filter(r => r.issues.includes('No VMware Tools')).length;
  if (noToolsCount > 0) {
    riskItems.push(`Missing VMware Tools: ${noToolsCount} VMs do not have VMware Tools installed. Install tools or plan for post-migration agent deployment.`);
  }

  riskItems.push('Skills Gap (ROKS): If selecting ROKS with OpenShift Virtualization, ensure the operations team has Kubernetes expertise or plan for training and enablement.');
  riskItems.push('Cost Variance: Actual costs may differ significantly from estimates based on negotiated enterprise agreements, reserved capacity commitments, and actual usage patterns.');
  riskItems.push('Application Dependencies: Without application dependency mapping, there is risk of service disruption if dependent VMs are migrated in separate waves.');

  sections.push(...createBulletList(riskItems));
  sections.push(new Paragraph({ children: [new PageBreak()] }));

  return sections;
}
