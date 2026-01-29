// Executive Summary Section

import { Paragraph, TextRun, PageBreak, HeadingLevel } from 'docx';
import type { RVToolsData } from '@/types/rvtools';
import type { MigrationInsights } from '@/services/ai/types';
import { mibToTiB } from '@/utils/formatters';
import reportTemplates from '@/data/reportTemplates.json';
import { STYLES, CHART_COLORS, type DocumentContent, type VMReadiness, type ChartData } from '../types';
import { createHeading, createParagraph, createBulletList, createStyledTable, createTableDescription, createTableLabel, createFigureDescription, createFigureLabel, createAISection } from '../utils/helpers';
import { generatePieChart, createChartParagraph } from '../utils/charts';
import { AlignmentType } from 'docx';

// Type assertion for templates with table/figure descriptions
const templates = reportTemplates as typeof reportTemplates & {
  tableDescriptions: Record<string, { title: string; description: string }>;
  figureDescriptions: Record<string, { title: string; description: string }>;
};

export async function buildExecutiveSummary(
  rawData: RVToolsData,
  readiness: VMReadiness[],
  aiInsights?: MigrationInsights | null
): Promise<DocumentContent[]> {
  const execTemplates = reportTemplates.executiveSummary;
  const vms = rawData.vInfo.filter((vm) => !vm.template);
  const poweredOnVMs = vms.filter((vm) => vm.powerState === 'poweredOn');

  const totalVCPUs = poweredOnVMs.reduce((sum, vm) => sum + vm.cpus, 0);
  const totalMemoryTiB = mibToTiB(poweredOnVMs.reduce((sum, vm) => sum + vm.memory, 0));
  const totalStorageTiB = mibToTiB(poweredOnVMs.reduce((sum, vm) => sum + vm.provisionedMiB, 0));

  const readyCount = readiness.filter((r) => !r.hasBlocker && !r.hasWarning).length;
  const warningCount = readiness.filter((r) => r.hasWarning && !r.hasBlocker).length;
  const blockerCount = readiness.filter((r) => r.hasBlocker).length;
  const readinessPercent = readiness.length > 0 ? Math.round((readyCount / readiness.length) * 100) : 0;

  // Generate Migration Readiness pie chart
  const readinessChartData: ChartData[] = [
    { label: 'Ready', value: readyCount, color: CHART_COLORS[1] },
    { label: 'Needs Prep', value: warningCount, color: CHART_COLORS[3] },
    { label: 'Blocked', value: blockerCount, color: CHART_COLORS[7] },
  ].filter(d => d.value > 0);

  const readinessChart = await generatePieChart(readinessChartData, 'Migration Readiness');

  // Generate Power State pie chart
  const poweredOffCount = vms.filter(vm => vm.powerState === 'poweredOff').length;
  const suspendedCount = vms.filter(vm => vm.powerState === 'suspended').length;
  const powerStateChartData: ChartData[] = [
    { label: 'Powered On', value: poweredOnVMs.length, color: CHART_COLORS[1] },
    { label: 'Powered Off', value: poweredOffCount, color: CHART_COLORS[0] },
    { label: 'Suspended', value: suspendedCount, color: CHART_COLORS[3] },
  ].filter(d => d.value > 0);

  const powerStateChart = await generatePieChart(powerStateChartData, 'VM Power State Distribution');

  const sections: DocumentContent[] = [
    createHeading('1. ' + execTemplates.title, HeadingLevel.HEADING_1),
    createParagraph(execTemplates.introduction),

    // At-a-Glance Summary Box
    createHeading('Assessment At-a-Glance', HeadingLevel.HEADING_2),
    new Paragraph({
      spacing: { after: 60 },
      bullet: { level: 0 },
      children: [
        new TextRun({
          text: `Environment: ${poweredOnVMs.length} VMs analyzed across ${rawData.vCluster.length} clusters with ${totalVCPUs.toLocaleString()} vCPUs and ${totalStorageTiB.toFixed(1)} TiB storage`,
          size: STYLES.bodySize,
        }),
      ],
    }),
    new Paragraph({
      spacing: { after: 60 },
      bullet: { level: 0 },
      children: [
        new TextRun({
          text: `Migration Readiness: ${readinessPercent}% of VMs are ready to migrate; ${blockerCount} VMs have blockers requiring remediation`,
          size: STYLES.bodySize,
        }),
      ],
    }),
    new Paragraph({
      spacing: { after: 60 },
      bullet: { level: 0 },
      children: [
        new TextRun({
          text: 'Recommended Platform: ROKS for organizations planning modernization; VSI for lift-and-shift with minimal change',
          size: STYLES.bodySize,
        }),
      ],
    }),
    new Paragraph({
      spacing: { after: 200 },
      bullet: { level: 0 },
      children: [
        new TextRun({
          text: 'Key Risks: Unsupported operating systems, snapshot sprawl, RDM disk usage, and Kubernetes skills gap (if ROKS)',
          size: STYLES.bodySize,
        }),
      ],
    }),

    // Source file info
    new Paragraph({
      spacing: { before: 120, after: 120 },
      children: [
        new TextRun({
          text: 'Source Data: ',
          bold: true,
          size: STYLES.bodySize,
        }),
        new TextRun({
          text: rawData.metadata.fileName || 'RVTools Export',
          size: STYLES.bodySize,
        }),
        new TextRun({
          text: rawData.metadata.collectionDate
            ? ` (Collected: ${new Date(rawData.metadata.collectionDate).toLocaleDateString()})`
            : '',
          size: STYLES.bodySize,
          color: STYLES.secondaryColor,
        }),
      ],
    }),

    createHeading(execTemplates.keyFindings.title, HeadingLevel.HEADING_2),
    createParagraph(execTemplates.keyFindings.environmentOverview),

    // Environment Summary Table - description above, label below
    ...createTableDescription(
      templates.tableDescriptions.environmentSummary.title,
      templates.tableDescriptions.environmentSummary.description
    ),
    createStyledTable(
      ['Metric', 'Value'],
      [
        ['Total VMs (Powered On)', `${poweredOnVMs.length}`],
        ['Total vCPUs', `${totalVCPUs.toLocaleString()}`],
        ['Total Memory', `${totalMemoryTiB.toFixed(1)} TiB`],
        ['Total Storage', `${totalStorageTiB.toFixed(1)} TiB`],
        ['Clusters', `${rawData.vCluster.length}`],
        ['ESXi Hosts', `${rawData.vHost.length}`],
      ],
      { columnAligns: [AlignmentType.LEFT, AlignmentType.RIGHT] }
    ),
    createTableLabel(templates.tableDescriptions.environmentSummary.title),

    // Power State Chart - description above, label below
    ...createFigureDescription(
      templates.figureDescriptions.powerStateDistribution.title,
      templates.figureDescriptions.powerStateDistribution.description
    ),
    createChartParagraph(powerStateChart, 480, 260),
    createFigureLabel(templates.figureDescriptions.powerStateDistribution.title),

    new Paragraph({ spacing: { before: 240 } }),
    createHeading('Migration Readiness Overview', HeadingLevel.HEADING_2),

    // Migration Readiness Table - description above, label below
    ...createTableDescription(
      templates.tableDescriptions.migrationReadiness.title,
      templates.tableDescriptions.migrationReadiness.description
    ),
    createStyledTable(
      ['Status', 'VM Count', 'Percentage'],
      [
        ['Ready to Migrate', `${readyCount}`, `${readinessPercent}%`],
        ['Needs Preparation', `${warningCount}`, `${readiness.length > 0 ? Math.round((warningCount / readiness.length) * 100) : 0}%`],
        ['Has Blockers', `${blockerCount}`, `${readiness.length > 0 ? Math.round((blockerCount / readiness.length) * 100) : 0}%`],
      ],
      { columnAligns: [AlignmentType.LEFT, AlignmentType.RIGHT, AlignmentType.RIGHT] }
    ),
    createTableLabel(templates.tableDescriptions.migrationReadiness.title),

    // Readiness Chart - description above, label below
    ...createFigureDescription(
      templates.figureDescriptions.migrationReadiness.title,
      templates.figureDescriptions.migrationReadiness.description
    ),
    createChartParagraph(readinessChart, 480, 260),
    createFigureLabel(templates.figureDescriptions.migrationReadiness.title),

    new Paragraph({ spacing: { before: 240 } }),
    createHeading(execTemplates.recommendations.title, HeadingLevel.HEADING_2),
    createParagraph(execTemplates.recommendations.intro),

    // ROKS Recommendations
    new Paragraph({ spacing: { before: 200 } }),
    createParagraph(execTemplates.recommendations.roksTitle, { bold: true }),
    createParagraph(execTemplates.recommendations.roksRecommended),
    ...createBulletList(execTemplates.recommendations.roksReasons),

    // VSI Recommendations
    new Paragraph({ spacing: { before: 200 } }),
    createParagraph(execTemplates.recommendations.vsiTitle, { bold: true }),
    createParagraph(execTemplates.recommendations.vsiRecommended),
    ...createBulletList(execTemplates.recommendations.vsiReasons),
  ];

  // Add AI executive summary if available
  if (aiInsights?.executiveSummary) {
    sections.push(
      ...createAISection(
        'AI-Generated Executive Summary',
        aiInsights.executiveSummary,
        HeadingLevel.HEADING_2
      )
    );
  }

  sections.push(new Paragraph({ children: [new PageBreak()] }));

  return sections;
}
