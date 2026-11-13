import { describe, expect, it } from 'vitest';
import { exceedsCashLimit } from './cash';

describe('exceedsCashLimit', () => {
  it('allows exactly €2,000 in cash', () => {
    expect(exceedsCashLimit(200_000)).toBe(false);
  });

  it('blocks a cent over €2,000', () => {
    expect(exceedsCashLimit(200_001)).toBe(true);
  });

  it('uses the venue setting when given', () => {
    expect(exceedsCashLimit(60_000, 50_000)).toBe(true);
  });
});
