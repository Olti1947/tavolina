# apps/admin

React web app (Vite + TypeScript) for owners and the back office. It is responsive, so it works
as a phone web app (installable PWA later).

- Owner live view of the current shift and push alerts (CLAUDE.md section 6.8). It is **fresh, not
  realtime**: refresh, pull-to-refresh and polling while visible, with no WebSocket.
- Dashboards, reports, CSV export.
- Setup: venue, menu, floor, staff, devices, printers and stations.
- Later: the internal support view, and the kitchen display add-on.

## Run and test

```sh
npm run dev -w @tavolina/admin    # http://localhost:5173 (also started by `make dev`)
npm test -w @tavolina/admin       # Vitest + Testing Library
npm run build -w @tavolina/admin
```

Strings come from `@tavolina/shared` (i18n, `sq` default), and API types from `@tavolina/api-client`.
