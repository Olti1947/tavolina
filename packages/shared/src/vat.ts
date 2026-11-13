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
 * The receipt examples in ATK's Technical and Functional Requirements (Annex B and F) agree with
 * this rule; they are in fixtures/vat-cases.json.
 * TODO(fiscal-spec): the examples can't tell rounding per line from rounding per rate total. We
 * round per line; confirm against the "EFS Implementation Specifications" once we have it.
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

/** Splits each line, then sums per rate. Keys are basis points as strings. */
export function sumByRate(lines: readonly VatLine[]): Record<string, VatRateTotal> {
  const totals: Record<string, VatRateTotal> = {};
  for (const line of lines) {
    const { net, vat } = splitVat(line.gross, line.bps);
    const key = String(line.bps);
    const total = (totals[key] ??= { gross: 0, net: 0, vat: 0 });
    total.gross += line.gross;
    total.net += net;
    total.vat += vat;
  }
  return totals;
}
