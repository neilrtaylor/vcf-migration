// Migration Readiness Section

import { Paragraph, Table, TableRow, PageBreak, HeadingLevel, BorderStyle } from 'docx';
import type { MigrationInsights } from '@/services/ai/types';
import reportTemplates from '@/data/reportTemplates.json';
import { STYLES, type DocumentContent, type VMReadiness } from '../types';
import { createHeading, createParagraph, createBulletList, createTableCell, createTableDescription, createTableLabel, createAISection } from '../utils/helpers';

// Type assertion for templates with table/figure descriptions
const templates = reportTemplates as typeof reportTemplates & {
  tableDescriptions: Record<string, { title: string; description: string }>;
  figureDescriptions: Record<string, { title: string; description: string }>;
};

export function buildMigrationReadiness(readiness: VMReadiness[], maxIssueVMs: number, aiInsights?: MigrationInsights | null): DocumentContent[] {
  const readinessTemplates = reportTemplates.migrationReadiness;
  const blockerVMs = readiness.filter((r) => r.hasBlocker).slice(0, maxIssueVMs);
  const warningVMs = readiness.filter((r) => r.hasWarning && !r.hasBlocker).slice(0, maxIssueVMs);

  const sections: DocumentContent[] = [
    createHeading('3. ' + readinessTemplates.title, HeadingLevel.HEADING_1),
    createParagraph(readinessTemplates.introduction),
    createHeading('3.1 ' + readinessTemplates.checksPerformed.title, HeadingLevel.HEADING_2),
    ...createBulletList(
      readinessTemplates.checksPerformed.checks.map((c) => `${c.name}: ${c.description}`)
    ),
  ];

  // Blockers table - description above, label below
  if (blockerVMs.length > 0) {
    sections.push(
      new Paragraph({ spacing: { before: 240 } }),
      createHeading('3.2 ' + readinessTemplates.blockersSummary.title, HeadingLevel.HEADING_2),
      createParagraph(readinessTemplates.blockersSummary.description),
      // Description above table
      ...createTableDescription(
        templates.tableDescriptions.blockerVMs.title,
        templates.tableDescriptions.blockerVMs.description
      ),
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
      }),
      // Label below table
      createTableLabel(templates.tableDescriptions.blockerVMs.title)
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

  // Warnings table - description above, label below
  if (warningVMs.length > 0) {
    sections.push(
      new Paragraph({ spacing: { before: 240 } }),
      createHeading('3.3 ' + readinessTemplates.warningsSummary.title, HeadingLevel.HEADING_2),
      createParagraph(readinessTemplates.warningsSummary.description),
      // Description above table
      ...createTableDescription(
        templates.tableDescriptions.warningVMs.title,
        templates.tableDescriptions.warningVMs.description
      ),
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
      }),
      // Label below table
      createTableLabel(templates.tableDescriptions.warningVMs.title)
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

  // Add AI risk assessment if available
  if (aiInsights?.riskAssessment) {
    sections.push(
      ...createAISection(
        '3.5 AI Risk Assessment',
        aiInsights.riskAssessment,
        HeadingLevel.HEADING_2
      )
    );
  }

  sections.push(new Paragraph({ children: [new PageBreak()] }));

  return sections;
}
