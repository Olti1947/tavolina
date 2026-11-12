# packages/shared/fixtures

Cross-language test cases, run by **both** the Java tests in `apps/api` and the TS tests in
`packages/shared`.

- `vat-cases.json`: gross, VAT basis points, expected net and VAT, per-rate sums and rounding edge
  cases (CLAUDE.md section 11).

**Any change to the math starts with a new case here.**
