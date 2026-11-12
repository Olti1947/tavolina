# packages/shared

TypeScript domain logic used by both `apps/device` and `apps/admin`:

- money (integer cents, EUR) and date formatting (`1.234,50 €`, `dd.MM.yyyy`, `Europe/Belgrade`)
- i18n resources (`sq` default, `en`)
- VAT math, which is the TS twin of the Java implementation in `apps/api`
- table ownership and cash rules

Devices compute totals offline and the server recomputes them and rejects mismatches, so the TS
and Java implementations must agree to the cent. `fixtures/` holds the cases both test suites run.
Setup arrives in #3.
