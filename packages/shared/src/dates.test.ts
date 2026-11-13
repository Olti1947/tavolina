import { describe, expect, it } from 'vitest';
import { formatDate, formatDateTime, formatTime } from './dates';

describe('date formatting in Europe/Belgrade', () => {
  it('formats a winter instant (UTC+1)', () => {
    expect(formatDateTime('2026-11-13T20:42:00Z')).toBe('13.11.2026 21:42');
  });

  it('formats a summer instant (UTC+2)', () => {
    expect(formatTime('2026-07-01T19:42:00Z')).toBe('21:42');
  });

  it('moves the date across local midnight', () => {
    expect(formatDate('2026-12-31T23:30:00Z')).toBe('01.01.2027');
  });

  it('handles the DST switch (29 Mar 2026, 02:00 → 03:00)', () => {
    expect(formatTime('2026-03-29T00:59:00Z')).toBe('01:59');
    expect(formatTime('2026-03-29T01:00:00Z')).toBe('03:00');
  });
});
