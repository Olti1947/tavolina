import { describe, expect, it } from 'vitest';
import cases from '../fixtures/vat-cases.json';
import { splitVat, sumByRate } from './vat';

describe('splitVat (fixtures/vat-cases.json)', () => {
  it.each(cases.lines)('$gross cents at $bps bps: $note', ({ gross, bps, net, vat }) => {
    expect(splitVat(gross, bps)).toEqual({ net, vat });
  });
});

describe('sumByRate (fixtures/vat-cases.json)', () => {
  it.each(cases.sums)('$note', ({ lines, byRate }) => {
    expect(sumByRate(lines)).toEqual(byRate);
  });
});

describe('splitVat', () => {
  it('mirrors positive amounts for refunds', () => {
    expect(splitVat(-150, 1800)).toEqual({ net: -127, vat: -23 });
  });

  it('rejects non-integer amounts and rates', () => {
    expect(() => splitVat(1.5, 1800)).toThrow();
    expect(() => splitVat(100, 18.5)).toThrow();
    expect(() => splitVat(100, -1)).toThrow();
  });
});
