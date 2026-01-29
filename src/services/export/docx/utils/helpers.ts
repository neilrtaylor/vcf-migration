// DOCX Generator Helper Functions

import {
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  BorderStyle,
  ShadingType,
  HeadingLevel,
  Bookmark,
} from 'docx';
import type { ITableCellOptions } from 'docx';
import { STYLES, FONT_FAMILY, type DocumentContent } from '../types';

// ===== CAPTION COUNTERS =====
// These track table and figure numbers across the document
let tableCounter = 0;
let figureCounter = 0;

/**
 * Reset counters (call at start of document generation)
 */
export function resetCaptionCounters(): void {
  tableCounter = 0;
  figureCounter = 0;
}

/**
 * Create a table description to appear ABOVE the table
 * Increments the table counter and returns description text only (no table reference inline)
 * @param _title - The table title (used for label below table, not in description)
 * @param description - Description of what the table shows and its significance
 * @returns Array of paragraphs for the description block (appears above table)
 */
export function createTableDescription(_title: string, description: string): Paragraph[] {
  tableCounter++;
  const paragraphs: Paragraph[] = [];

  // Description paragraph only (table reference appears in label below table)
  paragraphs.push(
    new Paragraph({
      spacing: { before: 200, after: 120 },
      children: [
        new TextRun({
          text: description,
          size: STYLES.bodySize,
          font: FONT_FAMILY,
        }),
      ],
    })
  );

  return paragraphs;
}

/**
 * Create a table label to appear BELOW the table (centered, just the reference)
 * Uses the current table counter value (call after createTableDescription)
 * @param title - The table title
 * @returns Paragraph for the centered label below table
 */
export function createTableLabel(title: string): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 120, after: 200 },
    children: [
      new Bookmark({
        id: `table_${tableCounter}`,
        children: [
          new TextRun({
            text: `Table ${tableCounter}: `,
            bold: true,
            size: STYLES.smallSize,
            color: STYLES.primaryColor,
            font: FONT_FAMILY,
          }),
          new TextRun({
            text: title,
            bold: true,
            size: STYLES.smallSize,
            font: FONT_FAMILY,
          }),
        ],
      }),
    ],
  });
}

/**
 * @deprecated Use createTableDescription and createTableLabel instead
 * Create a table caption with automatic numbering (legacy function)
 */
export function createTableCaption(title: string, description?: string): Paragraph[] {
  tableCounter++;
  const paragraphs: Paragraph[] = [];

  paragraphs.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 120, after: 60 },
      children: [
        new Bookmark({
          id: `table_${tableCounter}`,
          children: [
            new TextRun({
              text: `Table ${tableCounter}: `,
              bold: true,
              size: STYLES.smallSize,
              color: STYLES.primaryColor,
              font: FONT_FAMILY,
            }),
            new TextRun({
              text: title,
              bold: true,
              size: STYLES.smallSize,
              font: FONT_FAMILY,
            }),
          ],
        }),
      ],
    })
  );

  if (description) {
    paragraphs.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 120 },
        children: [
          new TextRun({
            text: description,
            size: STYLES.smallSize,
            italics: true,
            color: STYLES.secondaryColor,
            font: FONT_FAMILY,
          }),
        ],
      })
    );
  }

  return paragraphs;
}

/**
 * Create a figure description to appear ABOVE the chart
 * Increments the figure counter and returns description text only (no figure reference inline)
 * @param _title - The figure title (used for label below chart, not in description)
 * @param description - Description of what the chart shows and its significance
 * @returns Array of paragraphs for the description block (appears above chart)
 */
export function createFigureDescription(_title: string, description: string): Paragraph[] {
  figureCounter++;
  const paragraphs: Paragraph[] = [];

  // Description paragraph only (figure reference appears in label below chart)
  paragraphs.push(
    new Paragraph({
      spacing: { before: 200, after: 120 },
      children: [
        new TextRun({
          text: description,
          size: STYLES.bodySize,
          font: FONT_FAMILY,
        }),
      ],
    })
  );

  return paragraphs;
}

/**
 * Create a figure label to appear BELOW the chart (centered, just the reference)
 * Uses the current figure counter value (call after createFigureDescription)
 * @param title - The figure title
 * @returns Paragraph for the centered label below chart
 */
export function createFigureLabel(title: string): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 120, after: 200 },
    children: [
      new Bookmark({
        id: `figure_${figureCounter}`,
        children: [
          new TextRun({
            text: `Figure ${figureCounter}: `,
            bold: true,
            size: STYLES.smallSize,
            color: STYLES.primaryColor,
            font: FONT_FAMILY,
          }),
          new TextRun({
            text: title,
            bold: true,
            size: STYLES.smallSize,
            font: FONT_FAMILY,
          }),
        ],
      }),
    ],
  });
}

/**
 * @deprecated Use createFigureDescription and createFigureLabel instead
 * Create a figure caption with automatic numbering (legacy function)
 */
export function createFigureCaption(title: string, description?: string): Paragraph[] {
  figureCounter++;
  const paragraphs: Paragraph[] = [];

  paragraphs.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 120, after: 60 },
      children: [
        new Bookmark({
          id: `figure_${figureCounter}`,
          children: [
            new TextRun({
              text: `Figure ${figureCounter}: `,
              bold: true,
              size: STYLES.smallSize,
              color: STYLES.primaryColor,
              font: FONT_FAMILY,
            }),
            new TextRun({
              text: title,
              bold: true,
              size: STYLES.smallSize,
              font: FONT_FAMILY,
            }),
          ],
        }),
      ],
    })
  );

  if (description) {
    paragraphs.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 180 },
        children: [
          new TextRun({
            text: description,
            size: STYLES.smallSize,
            italics: true,
            color: STYLES.secondaryColor,
            font: FONT_FAMILY,
          }),
        ],
      })
    );
  }

  return paragraphs;
}

/**
 * Get current table count (for reference in text)
 */
export function getCurrentTableNumber(): number {
  return tableCounter;
}

/**
 * Get current figure count (for reference in text)
 */
export function getCurrentFigureNumber(): number {
  return figureCounter;
}

export function createTableCell(
  text: string,
  options: Partial<ITableCellOptions> & {
    bold?: boolean;
    header?: boolean;
    align?: (typeof AlignmentType)[keyof typeof AlignmentType];
    altRow?: boolean;
  } = {}
): TableCell {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { bold, header, align, altRow: _altRow, ...cellOptions } = options;

  let fillColor: string | undefined;
  if (header) {
    fillColor = '525252';
  }

  const textColor = header ? 'ffffff' : '161616';

  return new TableCell({
    ...cellOptions,
    shading: fillColor ? { fill: fillColor, type: ShadingType.SOLID } : undefined,
    margins: {
      top: 100,
      bottom: 100,
      left: 140,
      right: 140,
    },
    children: [
      new Paragraph({
        alignment: align || AlignmentType.LEFT,
        children: [
          new TextRun({
            text,
            bold: bold || header,
            size: header ? STYLES.bodySize : STYLES.smallSize,
            color: textColor,
          }),
        ],
      }),
    ],
  });
}

export function createStyledTable(
  headers: string[],
  rows: string[][],
  options: {
    columnAligns?: ((typeof AlignmentType)[keyof typeof AlignmentType])[];
    columnWidths?: number[];
  } = {}
): Table {
  const { columnAligns = [], columnWidths } = options;

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    columnWidths: columnWidths,
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
        tableHeader: true,
        children: headers.map((h, i) =>
          createTableCell(h, { header: true, align: columnAligns[i] })
        ),
      }),
      ...rows.map((row, rowIndex) =>
        new TableRow({
          children: row.map((cell, cellIndex) =>
            createTableCell(cell, {
              align: columnAligns[cellIndex],
              altRow: rowIndex % 2 === 1,
            })
          ),
        })
      ),
    ],
  });
}

export function createHeading(
  text: string,
  level: (typeof HeadingLevel)[keyof typeof HeadingLevel]
): Paragraph {
  return new Paragraph({
    heading: level,
    spacing: { before: 240, after: 120 },
    children: [
      new TextRun({
        text,
        bold: true,
        color: STYLES.secondaryColor,
      }),
    ],
  });
}

export function createParagraph(
  text: string,
  options: { bold?: boolean; spacing?: { before?: number; after?: number } } = {}
): Paragraph {
  return new Paragraph({
    spacing: options.spacing || { after: 120 },
    children: [
      new TextRun({
        text,
        size: STYLES.bodySize,
        bold: options.bold,
      }),
    ],
  });
}

export function createBulletList(items: string[]): Paragraph[] {
  return items.map(
    (item) =>
      new Paragraph({
        bullet: { level: 0 },
        spacing: { after: 60 },
        children: [
          new TextRun({
            text: item,
            size: STYLES.bodySize,
          }),
        ],
      })
  );
}

// ===== AI CONTENT HELPERS =====

/**
 * Create an AI disclaimer paragraph (italic purple text)
 */
export function createAIDisclaimer(): Paragraph {
  return new Paragraph({
    spacing: { before: 120, after: 120 },
    children: [
      new TextRun({
        text: 'The following content was generated by AI (IBM watsonx.ai) and should be reviewed for accuracy.',
        italics: true,
        size: STYLES.smallSize,
        color: STYLES.purpleColor,
        font: FONT_FAMILY,
      }),
    ],
  });
}

/**
 * Create an AI-enhanced section with heading, disclaimer, and content.
 * Content can be a string (rendered as paragraphs) or an array of strings (rendered as bullet list).
 */
export function createAISection(
  title: string,
  content: string | string[],
  headingLevel: (typeof HeadingLevel)[keyof typeof HeadingLevel] = HeadingLevel.HEADING_2
): DocumentContent[] {
  const elements: DocumentContent[] = [
    new Paragraph({ spacing: { before: 240 } }),
    createHeading(title, headingLevel),
    createAIDisclaimer(),
  ];

  if (Array.isArray(content)) {
    elements.push(...createBulletList(content));
  } else {
    // Split string into paragraphs by double newline, or render as single paragraph
    const paragraphs = content.split(/\n\n+/).filter(p => p.trim());
    for (const para of paragraphs) {
      elements.push(createParagraph(para.trim()));
    }
  }

  return elements;
}
