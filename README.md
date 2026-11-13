# Tavolina

Restaurant OS for cafés and restaurants in Kosovo: counter POS, waiter handhelds, direct station
printing, waiter settlement and an owner app. It is built for waiter-led table service and keeps
working with no internet.

The full product and engineering brief is in [CLAUDE.md](CLAUDE.md).

## Quick start

Prerequisites: Docker, JDK 21, Node.js 22 (`nvm use` reads `.nvmrc`), and Android Studio (for the emulator).

```sh
cp .env.example .env
npm install   # installs every TS workspace (apps/device, apps/admin, packages/*)
make dev      # starts Postgres, the API, the admin app and the fake printer
make stop     # stops Postgres
make lint     # ESLint, Prettier, TS types, Spotless
make test     # every test suite (the API tests need Docker)
make help     # lists all commands
```

M0 is still being built. `make dev` starts each part once it exists, and for anything not
scaffolded yet it prints the issue that adds it.

## Repository map

```
docs/                      decisions.md, open-questions.md, regulation/ (ATK PDFs), demo and walkthrough docs
apps/
  api/                     Spring Boot modular monolith
    src/main/java/com/tavolina/
      identity/            businesses, venues, users, roles, devices, auth
      catalog/             menu, items, modifiers, VAT, stations
      floor/               areas, tables
      ordering/            orders, lines, station tickets, table ownership
      payments/            payments, cash rules
      fiscal/              FiscalProvider, receipts, fiscal outbox
      shifts/              device and waiter shifts, settlements, X/Z
      devices/             heartbeat, printers, health, alerts
      reporting/           dashboards, owner live view, CSV export
      sync/                idempotent device sync endpoints
      audit/               append-only audit log
  device/                  Expo app: counter POS (tablet) + waiter handheld (phone)
    src/offline/           local SQLite store, sync outbox
    src/printing/          ESC/POS builder, printer drivers, print queue
    src/fiscal/            TS FiscalProvider
    src/features/          screens and logic shared by both layouts
    src/layouts/{tablet,phone}/
  admin/                   owner app and back office (responsive web / PWA)
packages/
  api-client/              TS client generated from OpenAPI; never edited by hand
  shared/                  TS domain logic for device and admin (money, dates, i18n, VAT, rules)
    fixtures/              test cases run by both Java and TS (vat-cases.json)
tools/
  fake-printer/            ESC/POS TCP sink on :9100 with a live receipt view on :9180
infra/                     docker-compose.yml (Postgres 16)
.github/workflows/         CI
```

Each folder has its own README (or `package-info.java` for backend modules) describing what it owns.

## Why it is built this way

- **One repo, several apps.** A feature like "send to stations" touches the API, the device app
  and the printing code at once. One repo lets one PR and one CI run cover all of it.
- **Modular monolith.** A single deployable suits a small team and keeps hosting cheap, which
  matters at €25–60 per venue per month. Modules only talk through public services or events,
  so one (for example `fiscal`) can be split out later without a rewrite.
- **One device app, two layouts.** The counter tablet and the waiter phone share the offline
  engine, printing and fiscal code, and only the screens differ. The hardest rules are written once.
- **Offline-first devices.** Internet drops in venues. Devices sell, print and issue receipts
  locally, then sync through an outbox to idempotent endpoints using client-generated UUIDv7s.
- **Fiscal layer behind `FiscalProvider`.** The ATK technical details are still being read. A mock
  runs now, and a partner's SEF or our own certified SEF can replace it without touching the rest.
- **Fake printer.** No hardware is needed to build and test printing, retries and printer alerts,
  either locally or in CI.
- **Generated API client + shared TS package.** The TS apps cannot drift from the API contract.
  Devices compute totals offline and the server recomputes them, so the VAT math exists in TS
  (`packages/shared`) and Java, and both run the same `fixtures/vat-cases.json`, which keeps them
  agreeing to the cent.
- **Owner app is fresh, not realtime.** It refreshes and polls and receives server-side push alerts;
  WebSocket is only used between devices inside a venue.

## Contributing

- Work milestone by milestone (CLAUDE.md section 9). Issues are grouped under GitHub milestones.
- Branch from `develop` as `feature/<issue>-<slug>` and open a PR into `develop`.
- Record decisions in [docs/decisions.md](docs/decisions.md).
