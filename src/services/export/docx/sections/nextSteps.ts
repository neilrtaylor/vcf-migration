// Next Steps Section

import { Paragraph, HeadingLevel } from 'docx';
import type { MigrationInsights } from '@/services/ai/types';
import reportTemplates from '@/data/reportTemplates.json';
import { type DocumentContent, type DocxExportOptions } from '../types';
import { createHeading, createParagraph, createBulletList, createAISection } from '../utils/helpers';

export function buildNextSteps(options: Required<DocxExportOptions>, aiInsights?: MigrationInsights | null): DocumentContent[] {
  const templates = reportTemplates.nextSteps;
  const placeholders = reportTemplates.placeholders;

  const sections: DocumentContent[] = [
    createHeading('9. ' + templates.title, HeadingLevel.HEADING_1),
    createParagraph(templates.introduction),
  ];

  templates.steps.forEach((phase, index) => {
    sections.push(
      createHeading(`9.${index + 1} ${phase.phase}`, HeadingLevel.HEADING_2),
      ...createBulletList(phase.items)
    );
  });

  // Add AI recommendations if available
  if (aiInsights?.recommendations && aiInsights.recommendations.length > 0) {
    sections.push(
      ...createAISection(
        '9.5 AI Recommendations',
        aiInsights.recommendations,
        HeadingLevel.HEADING_2
      )
    );
  }

  sections.push(
    new Paragraph({ spacing: { before: 480 } }),
    createHeading('9.6 ' + templates.contact.title, HeadingLevel.HEADING_2),
    createParagraph(templates.contact.content),
    createParagraph(options.companyName || placeholders.companyName, { bold: true }),
    createParagraph(options.preparedBy || placeholders.preparedBy),
    createParagraph(placeholders.contactEmail),
    createParagraph(placeholders.contactPhone)
  );

  return sections;
}
