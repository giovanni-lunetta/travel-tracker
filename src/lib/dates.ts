/**
 * Partial dates. People rarely remember exact days, so a visit date can be
 * just a year ("2019"), a month ("2019-07") or a full day ("2019-07-04").
 * Strings in this format sort correctly as plain text.
 */
import type { Visit } from '../types';

const RE = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/;

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function isValidPartialDate(s: string): boolean {
  const m = RE.exec(s);
  if (!m) return false;
  const year = +m[1];
  if (m[2] === undefined) return true;
  const month = +m[2];
  if (month < 1 || month > 12) return false;
  if (m[3] === undefined) return true;
  const day = +m[3];
  return day >= 1 && day <= daysInMonth(year, month);
}

/** "2019-07-04" -> "Jul 4, 2019", "2019-07" -> "Jul 2019", "2019" -> "2019". */
export function formatPartialDate(s: string, locale = 'en-US'): string {
  const m = RE.exec(s);
  if (!m) return s;
  if (m[2] === undefined) return m[1];
  const date = new Date(Date.UTC(+m[1], +m[2] - 1, m[3] === undefined ? 1 : +m[3]));
  // timeZone UTC so a date never shifts to the previous day for west-of-UTC users.
  const opts: Intl.DateTimeFormatOptions = { timeZone: 'UTC', year: 'numeric', month: 'short' };
  if (m[3] !== undefined) opts.day = 'numeric';
  return new Intl.DateTimeFormat(locale, opts).format(date);
}

export function formatVisit(v: Visit, locale = 'en-US'): string {
  const start = formatPartialDate(v.start, locale);
  return v.end ? `${start} – ${formatPartialDate(v.end, locale)}` : start;
}

/** Earliest instant a partial date could mean, as a sortable "YYYY-MM-DD". */
const lowerBound = (s: string) => s + '-01-01'.slice(s.length - 4);
/** Latest instant a partial date could mean. */
function upperBound(s: string): string {
  if (s.length === 10) return s;
  if (s.length === 7) return `${s}-${String(daysInMonth(+s.slice(0, 4), +s.slice(5, 7))).padStart(2, '0')}`;
  return s + '-12-31';
}

/** A visit is valid if its dates are valid and the end is not before the start. */
export function visitIsValid(v: Visit): boolean {
  if (!isValidPartialDate(v.start)) return false;
  if (v.end === undefined) return true;
  if (!isValidPartialDate(v.end)) return false;
  return lowerBound(v.start) <= upperBound(v.end);
}
