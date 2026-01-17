// Cover Page Section

import { Paragraph, TextRun, PageBreak, AlignmentType } from 'docx';
import reportTemplates from '@/data/reportTemplates.json';
import { STYLES, type DocumentContent, type DocxExportOptions } from '../types';

export function buildCoverPage(options: DocxExportOptions): DocumentContent[] {
  const templates = reportTemplates.coverPage;
  const placeholders = reportTemplates.placeholders;

  return [
    new Paragraph({
      spacing: { before: 2400, after: 480 },
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: templates.title,
          bold: true,
          size: STYLES.titleSize,
          color: STYLES.primaryColor,
        }),
      ],
    }),
    new Paragraph({
      spacing: { after: 960 },
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: templates.subtitle,
          size: STYLES.heading2Size,
          color: STYLES.secondaryColor,
        }),
      ],
    }),
    new Paragraph({
      spacing: { before: 480, after: 240 },
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: `Prepared for: ${options.clientName || placeholders.clientName}`,
          size: STYLES.heading3Size,
        }),
      ],
    }),
    new Paragraph({
      spacing: { after: 240 },
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: `Prepared by: ${options.preparedBy || placeholders.preparedBy}`,
          size: STYLES.heading3Size,
        }),
      ],
    }),
    new Paragraph({
      spacing: { after: 240 },
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: options.companyName || placeholders.companyName,
          size: STYLES.heading3Size,
        }),
      ],
    }),
    new Paragraph({
      spacing: { before: 480 },
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: new Date().toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          }),
          size: STYLES.bodySize,
          color: STYLES.secondaryColor,
        }),
      ],
    }),
    new Paragraph({ children: [new PageBreak()] }),
  ];
}
