import { assertCents, type Cents } from './money';

/**
 * Since 1 Jun 2026, payments over €2,000 between businesses and individuals must go through a
 * bank or electronic channel (CLAUDE.md section 6.4). This is the default; venues configure it.
 */
export const DEFAULT_CASH_LIMIT_CENTS: Cents = 200_000;

/** True when the cash paid on one order is over the limit, so the payment must be blocked. */
export function exceedsCashLimit(
  cashCents: Cents,
  limitCents: Cents = DEFAULT_CASH_LIMIT_CENTS,
): boolean {
  assertCents(cashCents);
  assertCents(limitCents);
  return cashCents > limitCents;
}
