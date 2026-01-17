// Main DOCX Report Generator
// This orchestrates the modular section builders to generate the full report

import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Header,
  Footer,
  PageNumber,
  NumberFormat,
  AlignmentType,
  convertInchesToTwip,
} from 'docx';
import type { RVToolsData } from '@/types/rvtools';
import reportTemplates from '@/data/reportTemplates.json';
import { type DocxExportOptions, type DocumentContent, FONT_FAMILY, STYLES } from './types';
import { calculateVMReadiness, calculateROKSSizing, calculateVSIMappings } from './utils/calculations';
import {
  buildCoverPage,
  buildExecutiveSummary,
  buildAssumptionsAndScope,
  buildEnvironmentAnalysis,
  buildMigrationReadiness,
  buildMigrationOptions,
  buildMigrationStrategy,
  buildROKSOverview,
  buildVSIOverview,
  buildCostEstimation,
  buildNextSteps,
  buildAppendices,
} from './sections';

// Re-export types for consumers
export type { DocxExportOptions, VMReadiness, ROKSSizing, VSIMapping } from './types';

/**
 * Generate a DOCX migration assessment report
 */
export async function generateDocxReport(
  rawData: RVToolsData,
  options: DocxExportOptions = {}
): Promise<Blob> {
  const finalOptions: Required<DocxExportOptions> = {
    clientName: options.clientName || reportTemplates.placeholders.clientName,
    preparedBy: options.preparedBy || reportTemplates.placeholders.preparedBy,
    companyName: options.companyName || reportTemplates.placeholders.companyName,
    includeROKS: options.includeROKS ?? true,
    includeVSI: options.includeVSI ?? true,
    includeCosts: options.includeCosts ?? true,
    maxIssueVMs: options.maxIssueVMs ?? 20,
  };

  // Calculate all data
  const readiness = calculateVMReadiness(rawData);
  const roksSizing = calculateROKSSizing(rawData);
  const vsiMappings = calculateVSIMappings(rawData);

  // Build document sections (await async functions)
  const executiveSummary = await buildExecutiveSummary(rawData, readiness);
  const environmentAnalysis = await buildEnvironmentAnalysis(rawData);

  const sections: DocumentContent[] = [
    ...buildCoverPage(finalOptions),
    ...executiveSummary,
    ...buildAssumptionsAndScope(),
    ...environmentAnalysis,
    ...buildMigrationReadiness(readiness, finalOptions.maxIssueVMs),
    ...buildMigrationOptions(),
    ...buildMigrationStrategy(rawData),
  ];

  if (finalOptions.includeROKS) {
    sections.push(...buildROKSOverview(roksSizing));
  }

  if (finalOptions.includeVSI) {
    sections.push(...buildVSIOverview(vsiMappings, 20));
  }

  if (finalOptions.includeCosts && (finalOptions.includeROKS || finalOptions.includeVSI)) {
    sections.push(...buildCostEstimation(roksSizing, vsiMappings));
  }

  sections.push(...buildNextSteps(finalOptions));

  // Add appendices if there are more VMs than shown in main body
  sections.push(...buildAppendices(readiness, finalOptions.maxIssueVMs));

  // Create document with professional header/footer
  const doc = new Document({
    creator: finalOptions.companyName,
    title: `VMware Migration Assessment - ${finalOptions.clientName}`,
    description: 'VMware to IBM Cloud Migration Assessment Report',
    styles: {
      default: {
        document: {
          run: {
            font: FONT_FAMILY,
            size: STYLES.bodySize,
          },
        },
        heading1: {
          run: {
            font: FONT_FAMILY,
            size: STYLES.heading1Size,
            bold: true,
            color: STYLES.primaryColor,
          },
          paragraph: {
            spacing: { before: 400, after: 200 },
          },
        },
        heading2: {
          run: {
            font: FONT_FAMILY,
            size: STYLES.heading2Size,
            bold: true,
            color: STYLES.secondaryColor,
          },
          paragraph: {
            spacing: { before: 300, after: 150 },
          },
        },
        heading3: {
          run: {
            font: FONT_FAMILY,
            size: STYLES.heading3Size,
            bold: true,
          },
          paragraph: {
            spacing: { before: 200, after: 100 },
          },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: convertInchesToTwip(1),
              right: convertInchesToTwip(1),
              bottom: convertInchesToTwip(1),
              left: convertInchesToTwip(1),
            },
            pageNumbers: {
              start: 1,
              formatType: NumberFormat.DECIMAL,
            },
          },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({
                    text: 'VMware Cloud Migration Assessment',
                    size: 18,
                    color: STYLES.secondaryColor,
                    font: FONT_FAMILY,
                  }),
                ],
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: `${finalOptions.companyName}`,
                    size: 16,
                    color: STYLES.secondaryColor,
                    font: FONT_FAMILY,
                  }),
                  new TextRun({
                    text: '  |  Page ',
                    size: 16,
                    color: STYLES.secondaryColor,
                    font: FONT_FAMILY,
                  }),
                  new TextRun({
                    children: [PageNumber.CURRENT],
                    size: 16,
                    color: STYLES.secondaryColor,
                    font: FONT_FAMILY,
                  }),
                  new TextRun({
                    text: ' of ',
                    size: 16,
                    color: STYLES.secondaryColor,
                    font: FONT_FAMILY,
                  }),
                  new TextRun({
                    children: [PageNumber.TOTAL_PAGES],
                    size: 16,
                    color: STYLES.secondaryColor,
                    font: FONT_FAMILY,
                  }),
                ],
              }),
            ],
          }),
        },
        children: sections,
      },
    ],
  });

  // Generate blob
  return await Packer.toBlob(doc);
}

/**
 * Generate and download a DOCX migration assessment report
 */
export async function downloadDocx(
  rawData: RVToolsData,
  options: DocxExportOptions = {},
  filename?: string
): Promise<void> {
  const blob = await generateDocxReport(rawData, options);

  // Create download link
  const date = new Date().toISOString().split('T')[0];
  const clientName = options.clientName?.replace(/[^a-zA-Z0-9]/g, '-') || 'client';
  const finalFilename = filename || `migration-assessment_${clientName}_${date}.docx`;

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = finalFilename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
