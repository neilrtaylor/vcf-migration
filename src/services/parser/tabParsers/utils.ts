// Shared utilities for tab parsers
import type { WorkSheet } from 'xlsx';
import * as XLSX from 'xlsx';

export type ColumnMap = Record<string, string | null>;
export type ParsedRow = Record<string, unknown>;

/**
 * Parse a worksheet into an array of objects using column mapping
 */
export function parseSheet(sheet: WorkSheet, columnMap: ColumnMap): ParsedRow[] {
  // Get raw data as array of arrays
  const rawData = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 });

  if (rawData.length < 2) {
    return []; // No data rows
  }

  // First row is headers
  const headers = rawData[0] as string[];

  // Normalize header for matching: remove quotes, lowercase, trim, normalize whitespace
  const normalizeHeader = (header: string): string => {
    return header
      .replace(/^["']+|["']+$/g, '') // Remove leading/trailing quotes
      .toLowerCase()
      .trim()
      .replace(/\s+/g, ' '); // Normalize multiple spaces to single space
  };

  // Build normalized lookup map for headers
  const normalizedColumnMap: ColumnMap = {};
  for (const [key, value] of Object.entries(columnMap)) {
    normalizedColumnMap[normalizeHeader(key)] = value;
  }

  // Build mapping from column index to field name
  const indexToField: Map<number, string> = new Map();

  headers.forEach((header, index) => {
    if (!header) return;

    const headerStr = String(header).trim();
    // Strip quotes from header for matching
    const headerStrClean = headerStr.replace(/^["']+|["']+$/g, '').trim();

    // Try exact match first (with quotes stripped)
    let fieldName = columnMap[headerStrClean];
    // Then try normalized match
    if (!fieldName) {
      fieldName = normalizedColumnMap[normalizeHeader(headerStr)];
    }

    if (fieldName) {
      indexToField.set(index, fieldName);
    }
  });

  // Debug: Log headers and matches to help identify issues
  if (import.meta.env.DEV) {
    const unmatchedHeaders = headers.filter((header, index) => {
      if (!header) return false;
      return !indexToField.has(index);
    });
    if (unmatchedHeaders.length > 0) {
      console.debug('[Parser] Unmatched headers:', unmatchedHeaders.map(h => `"${h}"`));
    }
  }

  // Parse data rows
  const rows: ParsedRow[] = [];

  for (let i = 1; i < rawData.length; i++) {
    const rowData = rawData[i] as unknown[];
    if (!rowData || rowData.length === 0) continue;

    const row: ParsedRow = {};
    let hasData = false;

    indexToField.forEach((fieldName, index) => {
      const value = rowData[index];
      if (value !== undefined && value !== null && value !== '') {
        row[fieldName] = value;
        hasData = true;
      }
    });

    if (hasData) {
      rows.push(row);
    }
  }

  return rows;
}

/**
 * Get string value from parsed row
 */
export function getStringValue(row: ParsedRow, field: string): string {
  const value = row[field];
  if (value === undefined || value === null) return '';
  return String(value).trim();
}

/**
 * Get number value from parsed row
 */
export function getNumberValue(row: ParsedRow, field: string): number {
  const value = row[field];
  if (value === undefined || value === null) return 0;

  if (typeof value === 'number') return value;

  const parsed = parseFloat(String(value).replace(/,/g, ''));
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Get boolean value from parsed row
 */
export function getBooleanValue(row: ParsedRow, field: string): boolean {
  const value = row[field];
  if (value === undefined || value === null) return false;

  if (typeof value === 'boolean') return value;

  const str = String(value).toLowerCase().trim();
  return str === 'true' || str === 'yes' || str === '1' || str === 'on';
}

/**
 * Get date value from parsed row
 */
export function getDateValue(row: ParsedRow, field: string): Date | null {
  const value = row[field];
  if (value === undefined || value === null || value === '') return null;

  // Excel stores dates as numbers (days since 1900-01-01)
  if (typeof value === 'number') {
    // Excel date serial number
    const date = XLSX.SSF.parse_date_code(value);
    if (date) {
      return new Date(date.y, date.m - 1, date.d, date.H || 0, date.M || 0, date.S || 0);
    }
  }

  // Try parsing as string
  const date = new Date(String(value));
  return isNaN(date.getTime()) ? null : date;
}

/**
 * Parse comma-separated values into array
 */
export function parseCSVValue(value: string): string[] {
  if (!value) return [];
  return value.split(',').map(s => s.trim()).filter(s => s);
}
