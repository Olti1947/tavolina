/** Money is always integer cents in EUR (CLAUDE.md section 0). Never use floats for money. */
export type Cents = number;

export function assertCents(value: number): asserts value is Cents {
  if (!Number.isSafeInteger(value)) {
    throw new Error(`Amount must be integer cents, got ${value}`);
  }
}

/**
 * Formats cents as `1.234,50 €`. Built with integer math rather than `Intl.NumberFormat`,
 * so it gives the same output on Hermes (device) and in browsers (admin).
 */
export function formatEur(cents: Cents): string {
  assertCents(cents);
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  const euros = Math.floor(abs / 100).toString();
  const rest = (abs % 100).toString().padStart(2, '0');
  const grouped = euros.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${sign}${grouped},${rest} €`;
}
