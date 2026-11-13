# packages/shared

TypeScript domain logic used by both `apps/device` and `apps/admin`:

- money (integer cents, EUR) and date formatting (`1.234,50 €`, `dd.MM.yyyy`, `Europe/Belgrade`)
- i18n resources (`sq` default, `en`)
- VAT math, which is the TS twin of the Java implementation in `apps/api`
- table ownership and cash rules

Devices compute totals offline and the server recomputes them and rejects mismatches, so the TS
and Java implementations must agree to the cent. `fixtures/` holds the cases both test suites run.
`fixtures/vat-cases.json` expectations were computed with an independent `Decimal` half-up
oracle, not with this code.

```sh
npm test -w @tavolina/shared        # Vitest
npm run typecheck -w @tavolina/shared
```

The package ships TypeScript source (no build step); Vite and Metro compile it with the app.
