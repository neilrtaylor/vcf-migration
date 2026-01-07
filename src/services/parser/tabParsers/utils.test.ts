// Unit tests for parser utilities
import { describe, it, expect } from 'vitest';
import {
  getStringValue,
  getNumberValue,
  getBooleanValue,
  getDateValue,
  parseCSVValue,
} from './utils';

describe('getStringValue', () => {
  it('returns string values', () => {
    const row = { name: 'test' };
    expect(getStringValue(row, 'name')).toBe('test');
  });

  it('converts numbers to strings', () => {
    const row = { count: 123 };
    expect(getStringValue(row, 'count')).toBe('123');
  });

  it('returns empty string for null/undefined', () => {
    const row = { name: null, value: undefined };
    expect(getStringValue(row, 'name')).toBe('');
    expect(getStringValue(row, 'value')).toBe('');
    expect(getStringValue(row, 'nonexistent')).toBe('');
  });

  it('trims whitespace', () => {
    const row = { name: '  test  ' };
    expect(getStringValue(row, 'name')).toBe('test');
  });
});

describe('getNumberValue', () => {
  it('returns numeric values', () => {
    const row = { count: 100 };
    expect(getNumberValue(row, 'count')).toBe(100);
  });

  it('parses string numbers', () => {
    const row = { count: '200', decimal: '300.5' };
    expect(getNumberValue(row, 'count')).toBe(200);
    expect(getNumberValue(row, 'decimal')).toBe(300.5);
  });

  it('handles comma-formatted numbers', () => {
    const row = { count: '1,234,567' };
    expect(getNumberValue(row, 'count')).toBe(1234567);
  });

  it('returns 0 for invalid values', () => {
    const row = { invalid: 'not a number', empty: '', nul: null };
    expect(getNumberValue(row, 'invalid')).toBe(0);
    expect(getNumberValue(row, 'empty')).toBe(0);
    expect(getNumberValue(row, 'nul')).toBe(0);
    expect(getNumberValue(row, 'nonexistent')).toBe(0);
  });
});

describe('getBooleanValue', () => {
  it('returns boolean values directly', () => {
    const row = { yes: true, no: false };
    expect(getBooleanValue(row, 'yes')).toBe(true);
    expect(getBooleanValue(row, 'no')).toBe(false);
  });

  it('parses string booleans', () => {
    const row = {
      t: 'true',
      f: 'false',
      y: 'yes',
      n: 'no',
      one: '1',
      on: 'on',
    };
    expect(getBooleanValue(row, 't')).toBe(true);
    expect(getBooleanValue(row, 'f')).toBe(false);
    expect(getBooleanValue(row, 'y')).toBe(true);
    expect(getBooleanValue(row, 'n')).toBe(false);
    expect(getBooleanValue(row, 'one')).toBe(true);
    expect(getBooleanValue(row, 'on')).toBe(true);
  });

  it('is case insensitive', () => {
    const row = { val: 'TRUE', other: 'YES' };
    expect(getBooleanValue(row, 'val')).toBe(true);
    expect(getBooleanValue(row, 'other')).toBe(true);
  });

  it('returns false for empty/null', () => {
    const row = { empty: '', nul: null };
    expect(getBooleanValue(row, 'empty')).toBe(false);
    expect(getBooleanValue(row, 'nul')).toBe(false);
    expect(getBooleanValue(row, 'nonexistent')).toBe(false);
  });
});

describe('getDateValue', () => {
  it('parses ISO date strings', () => {
    const row = { date: '2024-03-15T10:30:00' };
    const result = getDateValue(row, 'date');
    expect(result).toBeInstanceOf(Date);
    expect(result?.getFullYear()).toBe(2024);
    expect(result?.getMonth()).toBe(2); // March is 2 (0-indexed)
    expect(result?.getDate()).toBe(15);
  });

  it('parses Excel serial dates', () => {
    const row = { date: 45366 }; // Excel serial date for ~2024-03-15
    const result = getDateValue(row, 'date');
    expect(result).toBeInstanceOf(Date);
  });

  it('returns null for empty values', () => {
    const row = { empty: '', nul: null };
    expect(getDateValue(row, 'empty')).toBeNull();
    expect(getDateValue(row, 'nul')).toBeNull();
    expect(getDateValue(row, 'nonexistent')).toBeNull();
  });

  it('returns null for invalid dates', () => {
    const row = { invalid: 'not a date' };
    expect(getDateValue(row, 'invalid')).toBeNull();
  });
});

describe('parseCSVValue', () => {
  it('splits comma-separated values', () => {
    expect(parseCSVValue('a,b,c')).toEqual(['a', 'b', 'c']);
    expect(parseCSVValue('one, two, three')).toEqual(['one', 'two', 'three']);
  });

  it('trims whitespace', () => {
    expect(parseCSVValue('  a  ,  b  ,  c  ')).toEqual(['a', 'b', 'c']);
  });

  it('filters empty values', () => {
    expect(parseCSVValue('a,,b,  ,c')).toEqual(['a', 'b', 'c']);
  });

  it('returns empty array for empty string', () => {
    expect(parseCSVValue('')).toEqual([]);
  });
});
