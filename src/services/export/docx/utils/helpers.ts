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
} from 'docx';
import type { ITableCellOptions } from 'docx';
import { STYLES } from '../types';

export function createTableCell(
  text: string,
  options: Partial<ITableCellOptions> & {
    bold?: boolean;
    header?: boolean;
    align?: (typeof AlignmentType)[keyof typeof AlignmentType];
    altRow?: boolean;
  } = {}
): TableCell {
  const { bold, header, align, altRow, ...cellOptions } = options;

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
