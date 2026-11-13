import { describe, expect, test } from 'vitest';
import { formatPartialDate, formatVisit, isValidPartialDate, visitIsValid } from '../src/lib/dates';

describe('partial dates', () => {
  test('accepts year, year-month and full dates', () => {
    expect(isValidPartialDate('2019')).toBe(true);
    expect(isValidPartialDate('2019-07')).toBe(true);
    expect(isValidPartialDate('2019-07-04')).toBe(true);
  });
  test('rejects malformed or impossible dates', () => {
    for (const bad of ['', '19', '2019-7', '2019-13', '2019-02-30', '2019-07-4', 'July 2019', '2019-00']) {
      expect(isValidPartialDate(bad), bad).toBe(false);
    }
  });
  test('accepts a leap day only in leap years', () => {
    expect(isValidPartialDate('2024-02-29')).toBe(true);
    expect(isValidPartialDate('2023-02-29')).toBe(false);
  });
  test('formats each precision without shifting by timezone', () => {
    expect(formatPartialDate('2019-07-04')).toBe('Jul 4, 2019');
    expect(formatPartialDate('2019-07')).toBe('Jul 2019');
    expect(formatPartialDate('2019')).toBe('2019');
  });
  test('formats a visit as a single date or a range', () => {
    expect(formatVisit({ start: '2019-07-04' })).toBe('Jul 4, 2019');
    expect(formatVisit({ start: '2019-07-04', end: '2019-07-12' })).toBe('Jul 4, 2019 – Jul 12, 2019');
  });
  test('a visit range must not end before it starts, even at mixed precision', () => {
    expect(visitIsValid({ start: '2019-07-04', end: '2019-07-12' })).toBe(true);
    expect(visitIsValid({ start: '2019-07-04', end: '2019' })).toBe(true);
    expect(visitIsValid({ start: '2020', end: '2019-12-31' })).toBe(false);
    expect(visitIsValid({ start: 'nope' })).toBe(false);
  });
});
