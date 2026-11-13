import { describe, expect, it } from 'vitest';
import { formatEur } from './money';

describe('formatEur', () => {
  it.each([
    [0, '0,00 €'],
    [5, '0,05 €'],
    [150, '1,50 €'],
    [123450, '1.234,50 €'],
    [100000000, '1.000.000,00 €'],
    [-250, '-2,50 €'],
  ])('%i cents → %s', (cents, expected) => {
    expect(formatEur(cents)).toBe(expected);
  });

  it('rejects fractional cents', () => {
    expect(() => formatEur(1.5)).toThrow();
  });
});
