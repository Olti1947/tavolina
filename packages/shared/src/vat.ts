import { assertCents, type Cents } from './money';

/**
 * VAT math, the TS twin of the Java implementation in apps/api. Both run
 * fixtures/vat-cases.json, so they agree to the cent (CLAUDE.md section 11).
 * Any change here starts with a new case in that file.
 */

export interface VatSplit {
  net: Cents;
  vat: Cents;
}

export interface VatLine {
  /** VAT-inclusive line total in cents. */
  gross: Cents;
  /** VAT rate in basis points, e.g. 1800 = 18%. */
  bps: number;
}

export interface VatRateTotal {
  gross: Cents;
  net: Cents;
  vat: Cents;
}

/**
 * Splits a VAT-inclusive amount: net = round_half_up(gross * 10000 / (10000 + bps)), vat = gross - net.
 * Integer math only. Negative amounts round symmetrically (half away from zero).
 * Call it once per VAT rate total (see sumByRate), not per line.
 */
export function splitVat(gross: Cents, bps: number): VatSplit {
  assertCents(gross);
  if (!Number.isSafeInteger(bps) || bps < 0) {
    throw new Error(`VAT rate must be non-negative integer basis points, got ${bps}`);
  }
  const abs = Math.abs(gross);
  const divisor = 10000 + bps;
  // round_half_up(a / d) for a >= 0 is floor((2a + d) / 2d).
  const absNet = Math.floor((2 * abs * 10000 + divisor) / (2 * divisor));
  const net = gross < 0 ? -absNet : absNet;
  return { net, vat: gross - net };
}

/**
 * Adds the gross of all lines per rate, then splits each rate total once. Keys are basis points
 * as strings. Line grosses must already include any discount.
 * Per rate, not per line: ATK's receipt example in Annex F, p. 81 (fixtures/vat-cases.json) only
 * works this way; per-line rounding gives 1.09 instead of the printed 1.08.
 * TODO(fiscal-spec): confirm against the "EFS Implementation Specifications" once we have it.
 */
export function sumByRate(lines: readonly VatLine[]): Record<string, VatRateTotal> {
  const grossByRate = new Map<number, Cents>();
  for (const line of lines) {
    assertCents(line.gross);
    grossByRate.set(line.bps, (grossByRate.get(line.bps) ?? 0) + line.gross);
  }
  const totals: Record<string, VatRateTotal> = {};
  for (const [bps, gross] of grossByRate) {
    totals[String(bps)] = { gross, ...splitVat(gross, bps) };
  }
  return totals;
}
