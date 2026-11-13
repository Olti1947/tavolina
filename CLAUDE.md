# CLAUDE.md — Tavolina (Restaurant OS for Kosovo)

> Put this file at the root of an empty repository. Claude Code loads it automatically.
> "Tavolina" (Albanian for *table*) is a working name. Owner: Olt Bajrami.
> Version 2 (4 Nov 2026): the core is now **waiter handhelds + station printing + offline-first devices**. QR ordering moved to an add-on.

---

## 0. How to work in this repo (read first)

1. **Build milestone by milestone** (section 9). Finish a milestone's acceptance criteria and tests before starting the next. Tick the checkboxes in this file as you go and add a one-line note under the milestone if you changed a decision.
2. **Never invent fiscal or tax-authority details.** The format of a fiscal coupon, its signature, its QR payload, the transmission protocol to the tax administration (ATK) and the corrective-document rules are defined in official documents we have not read in full yet (section 7). Everything fiscal goes behind the `FiscalProvider` interface, and only `MockFiscalProvider` gets implemented until those documents are in `docs/regulation/`. If you need a detail that isn't there, write a `TODO(fiscal-spec):` comment and add it to `docs/open-questions.md` instead of guessing.
3. **Money is integer cents** (`long` in Java, integer `number` in TS, `BIGINT` in SQL). Never use floats for money. Currency is always EUR.
4. **Nothing fiscal or financial is ever hard-deleted or updated in place.** Orders, payments, receipts, shifts and settlements are append-only; corrections create new records (voids, refunds, corrective documents). Every state change writes an audit log entry.
5. **Every device must keep working with no internet** (section 6.5). Selling, printing tickets and issuing receipts must never wait on the cloud. Every device write uses a client-generated UUIDv7 and an idempotent server endpoint.
6. **Tenant isolation is mandatory.** Every table that holds business data has `business_id`; every query is scoped by it. Write a test that proves one business cannot read another's data.
7. **Design for low support load.** Owners phone at 11 PM when something breaks. Prefer behaviour that fails safe and explains itself (clear error text in Albanian, automatic retries, device health reporting) over anything that needs a technician.
8. Prefer boring, well-maintained libraries. Ask before adding anything heavy (a message broker, a second database, Kubernetes).
9. Commit at the end of each meaningful step with a clear message. Don't push or open PRs unless asked.
10. When something here is ambiguous, pick the simplest option that keeps the fiscal layer swappable and the devices offline-capable. Note it in `docs/decisions.md` (date, decision, why) and carry on.

---

## 1. What we're building

A system that runs a café or restaurant in Kosovo, built around how service actually works there: **waiter-led table service, cash often carried by the waiter, and internet that drops.**

**Core (launch)**
- **Counter POS** (tablet at the bar/counter): quick sale, table overview, payments, fiscal receipts.
- **Waiter handheld** (Android phone): each waiter opens their own tables, takes orders at the table, sends them to the bar and kitchen, takes payment and issues the receipt, other waiters have read-only permission to other waiters' tables in the case they need to take payment for them, but only the table owner can change status of the table.
- **Station printing:** order tickets print directly on the bar and kitchen printers over the venue's Wi-Fi (or Bluetooth), even with no internet.
- **Waiter settlement:** at shift close, each waiter's sales and the cash they must hand over are calculated automatically.
- **Owner app:** a **live view of the current shift** (open tables, each waiter's sales and cash held, voids and other sensitive actions), push alerts on owner-set thresholds, today's sales, per-waiter totals, VAT summary, Z-reports, device alerts.
- **Built-in support tooling:** printer and device health alerts, remote diagnostics, a support log.

**Add-ons (after launch, sold separately)**
- **Kitchen display screen** (replaces or complements the kitchen printer).
- **QR features:** digital menu, "call the waiter" and "bring the bill" buttons, and QR ordering for terraces, beach bars and takeaway, where staff accept each order on the POS.
- **Venue's own online ordering page** and, only if APIs exist, a delivery inbox (Wolt/Glovo).
- **Stock and recipe costing.**

**The bet:** from 2026 Kosovo allows fiscal receipts from *certified software* (SEF), not only hardware fiscal cash registers. Every venue must stay compliant, which gets us the meeting. Plain fiscal software will be cheap and crowded, so we win by fitting the waiter-led macchiato culture, never losing a sale or a receipt when the internet drops, and keeping support calls rare.

**Primary users**

| Role | Uses | Device |
|---|---|---|
| Owner | Reports, settlements, menu, staff, devices | Phone (owner app) or laptop (web) |
| Manager | Voids, refunds, shift close, menu edits | Counter POS (PIN) or web |
| Waiter | Own tables, orders, payments, own settlement | Android phone (handheld) |
| Bartender / cashier | Quick sale, counter tables, accepting hand-overs | Android tablet (counter POS) |
| Kitchen / bar | Tickets | Thermal printer (default) or kitchen screen (add-on) |
| Guest (add-on) | QR menu, call waiter, order on terraces | Own phone, mobile web |

**Market context (for prioritisation, not for code):**
- **Market size:** about 4,650 active restaurant and mobile food businesses in Kosovo (ARBK, NACE 5610), plus cafés and bars.
- **The SEF opening:** added by Administrative Instruction (MF) No. 01/2026 (27 Apr 2026). Certified SEF products appeared from Jul 2026.
- **Competition:** a list of newly certified SEF vendors, legacy POS and fiscal-printer dealers with local technicians, and Odoo's Kosovo fiscalization module.
- **Pricing:** owners are expected to pay roughly €25–60 per venue per month, so cost to serve must stay low.
- **Communication:** owners use phone, Viber and WhatsApp, not email.

---

## 2. Scope

### MVP (milestones M0–M6)
- Multi-tenant backend: business → venues → devices, staff, roles.
- Menu: categories, items, modifiers, VAT rate per item, availability, routing to a station.
- Floor: areas and tables.
- **One mobile app with two layouts**: tablet (counter POS) and phone (waiter handheld). Same code, same offline engine.
- Orders with table ownership, send to stations, split by item, voids with manager PIN.
- Payments (cash, card recorded as method), receipt via `FiscalProvider` (mock), printing.
- **Direct station printing** (ESC/POS over TCP 9100 on LAN, plus Bluetooth), with retry, a queue and printer status.
- Shifts per device and per waiter, **waiter settlement**, X/Z reports.
- Owner app/web: live shift view and threshold alerts (section 6.8), dashboard (sales, by payment method, by VAT rate, by waiter, by hour, top items), menu, tables, staff, devices, CSV export.
- Offline-first on every device, with sync.
- Device health: heartbeat, app version, printer status (online, paper out, error), unsynced-queue age; alerts to the owner and to us.
- Languages: Albanian (`sq`, default) and English (`en`). Design for adding Serbian (`sr-Latn`).

### Not in MVP (do not build until asked)
- Real fiscal integration (M7, blocked on documents and a partner).
- Kitchen display screen, all QR features, own ordering page, delivery inbox, stock (section 9 "Add-ons").
- Online card payments (Kosovo lacks PayPal/Stripe; this would need a local bank gateway).
- Card-terminal integration (record "card" as the method for now).
- Our own SEF certification package (later; section 7.3).

---

## 3. Tech stack

Chosen to match Olt's experience (Java/Spring Boot, React, React Native, TypeScript, PostgreSQL).

| Part | Stack |
|---|---|
| Backend | Java 21, Spring Boot 3.x, **modular monolith**, Maven, Spring Web, Spring Security (JWT), Spring Data JPA, Flyway, springdoc-openapi, WebSocket (STOMP) for realtime |
| Database | PostgreSQL 16 |
| Device app | React Native with Expo (TypeScript), Android first; `expo-sqlite` for the local store; one app with **tablet (counter)** and **phone (handheld)** layouts |
| Printing | A `PrinterDriver` interface with three drivers: `VirtualPrinterDriver` (no hardware; shows the ticket on screen and logs it), `TcpEscPosDriver` (raw TCP, port 9100, for LAN printers) and `BluetoothEscPosDriver`. ESC/POS bytes are generated by our own small builder module so they can be snapshot-tested. Pick a maintained RN TCP/Bluetooth library and record it in `docs/decisions.md` (TCP sockets need a native module, so use an Expo development build, not Expo Go) |
| Owner app | Responsive web in `apps/admin` (works as a phone web app; installable PWA is fine) |
| Shared types | `packages/api-client`, generated from the backend's OpenAPI spec |
| Shared TS logic | `packages/shared`: money and date formatting, i18n resources, VAT math, ownership and cash rules, used by `apps/device` and `apps/admin`; plus cross-language test fixtures |
| i18n | `i18next` on all TS apps; Spring `MessageSource` for server messages |
| Tests | JUnit 5 + Testcontainers; Vitest + Testing Library; Jest for RN; Playwright for web end-to-end |
| Local dev | Docker Compose (Postgres) plus a **fake ESC/POS printer** (section 6.7): a TCP server that decodes received jobs and shows them as paper-like receipts in a browser page |
| CI | GitHub Actions: build, test, lint for every app |

**Why a modular monolith:** one deployable is the right size for a small team. Keep module boundaries strict so services can be split out later.

---

## 4. Repository layout

```
/
├─ CLAUDE.md
├─ docs/
│  ├─ decisions.md               ← ADR-lite log (create it)
│  ├─ open-questions.md          ← unresolved questions, esp. fiscal (create it)
│  └─ regulation/                ← ATK PDFs, added by Olt (section 7)
├─ apps/
│  ├─ api/                       ← Spring Boot
│  │  └─ src/main/java/com/tavolina/
│  │     ├─ identity/            ← businesses, venues, users, roles, devices, auth
│  │     ├─ catalog/             ← menu, categories, items, modifiers, VAT, stations
│  │     ├─ floor/               ← areas, tables
│  │     ├─ ordering/            ← orders, lines, table ownership and transfers
│  │     ├─ payments/            ← payments, cash rules
│  │     ├─ fiscal/              ← FiscalProvider, receipts, fiscal outbox
│  │     ├─ shifts/              ← device shifts, waiter shifts, settlements, X/Z
│  │     ├─ devices/             ← heartbeat, printers, health, alerts
│  │     ├─ reporting/           ← dashboard queries, CSV export
│  │     ├─ sync/                ← device sync endpoints, idempotency
│  │     └─ audit/               ← append-only audit log
│  ├─ device/                    ← Expo RN: counter POS + waiter handheld
│  │  └─ src/{offline,printing,fiscal,features/*,layouts/{tablet,phone}}
│  └─ admin/                     ← React: owner app + back office (add-on KDS later)
├─ packages/
│  ├─ api-client/                ← generated from OpenAPI; never edited by hand
│  └─ shared/                    ← TS domain logic used by device and admin
│     └─ fixtures/               ← test cases shared with Java (e.g. vat-cases.json)
├─ tools/
│  └─ fake-printer/              ← ESC/POS TCP sink for dev and tests
├─ infra/
│  └─ docker-compose.yml
└─ .github/workflows/
```

Modules talk to each other only through each module's public service interfaces or domain events, never through another module's repositories.

---

## 5. Domain model

All IDs are UUIDv7 (time-ordered; generated on the device for anything a device creates). All timestamps are stored in UTC (`timestamptz`) and displayed in `Europe/Belgrade`, the IANA zone Kosovo uses. Every business-data table has `business_id`, `created_at`, `created_by`.

### 5.1 Identity and devices
- **Business** (tenant): legal name, trade name, `nui`, `fiscal_number`, `vat_number` (nullable), `vat_registered`, address, default language.
- **Venue**: name, address, `fiscal_business_unit_code` (nullable; TBD by spec), timezone (default `Europe/Belgrade`), settings (cash limit, auto-print rules).
- **User**: name, phone, password hash (web), PIN hash (devices), status.
- **Membership**: user ↔ business with role `OWNER | MANAGER | WAITER | CASHIER`, optional venue restriction.
- **Device**: venue, kind `COUNTER | HANDHELD`, name, registration status, `fiscal_device_code` (nullable, TBD by spec), app version, last heartbeat, last sync, oldest unsynced item age.
- **Printer**: venue, name, connection `LAN | BLUETOOTH`, address (IP:port or BT MAC), paper width (58/80 mm), status (`ONLINE | OFFLINE | PAPER_OUT | ERROR | UNKNOWN`), last status at.
- **DeviceAlert**: device or printer, kind, severity, message (i18n key), opened at, resolved at.

### 5.2 Catalog
- **VatRate**: code, label, basis points (e.g. 1800 = 18%). Seed 18% and 8% (Kosovo's standard and reduced rates). **Which rate applies to food service is to be confirmed with an accountant**; keep it per item.
- **Station**: venue, name (Bar, Kitchen), printer (nullable), copies.
- **Category**: name (i18n), sort order, default station.
- **Item**: category, name (i18n), price in cents **VAT-inclusive**, vat_rate, station override, available.
- **ModifierGroup** / **Modifier**: min/max selections; price delta in cents.
- Order lines snapshot name, price and VAT rate; menu edits never change past orders.

### 5.3 Floor
- **Area**: Inside, Terrace, Bar.
- **Table**: area, label, seats, active. (`qr_token` arrives with the QR add-on.)

### 5.4 Ordering
- **Order**: venue, table (nullable for quick sale), `source` = `HANDHELD | COUNTER` (later `QR_TABLE`, `OWN_ONLINE`), `status` = `OPEN | PAID | CANCELLED`, **`owner_user_id` (the waiter who owns it)**, `owner_device_id`, guest count, note.
- **Table ownership rule:** a table's open order belongs to the waiter who opened it. Only that waiter's devices may change it, plus a manager on the counter. Ownership transfers ("move to another waiter") need both devices online, or a manager override that is audited. This rule prevents offline conflicts.
- **OrderLine**: item snapshot, quantity, modifiers snapshot, note, `status` = `NEW | SENT | VOIDED`, `send_batch` (which "send" it went out in), void reason and actor.
- **StationTicket**: order, station, send batch, lines, print status (`QUEUED | PRINTED | FAILED`), attempts, printed at. The ticket says "ORDER – NOT A FISCAL RECEIPT" (wording TBD by spec).

### 5.5 Payments, fiscal, shifts
- **Payment**: order, method `CASH | CARD | OTHER`, amount cents, tendered and change, device, **collected_by_user_id** (for waiter settlement), idempotency key.
- **FiscalReceipt**: order, issuing device, sequence number per device, lines snapshot, totals by VAT rate, total, payment methods, `status` = `PENDING | ISSUED_OFFLINE | SUBMITTED | CONFIRMED | FAILED`, provider, opaque provider identifiers (JSON), `qr_payload`, attempts, last error. **Immutable once issued.**
- **CorrectiveDocument**: references a receipt, reason, lines, totals. Exact legal form is `TODO(fiscal-spec)`.
- **FiscalOutbox**: pending submissions with retry/backoff (on the device and mirrored on the server).
- **DeviceShift**: device, opened/closed by and at, opening float, counted cash.
- **WaiterShift**: user, venue, opened/closed at, sales total, cash collected, card collected, receipts count, voids, **cash to hand over**, counted cash, difference, accepted by (manager/cashier).
- **ZReport**: per device shift; totals by payment method and VAT rate, receipt sequence range, voids, corrections. Immutable.
- **AuditLog**: append-only; no `UPDATE`/`DELETE` permission for the app's DB role.

---

## 6. Key flows

### 6.1 Table service on the waiter handheld (the core flow)
1. The waiter logs in with a PIN on their phone and opens a waiter shift.
2. **My tables** shows the tables this waiter owns, with amount and time open, plus free tables to open. Others' tables are visible read-only.
3. The waiter taps a free table, sets the guest count and adds items with modifiers and notes. Favourites go on the first screen; search is one tap away.
4. **Send**: `NEW` lines become `SENT`, and one StationTicket is created per station and **printed directly from the phone** to that station's printer. If a printer fails, retry and queue it, show a clear alert on the phone, and let the waiter reroute to another printer.
5. **Bill**: the waiter can print a pro-forma ("not a fiscal receipt"; wording TBD by spec) on a station or portable printer, or just show the total on the phone.
6. **Payment at the table**: cash (with change) or card (recorded). When fully paid, the phone calls `FiscalProvider.issue(...)` and prints the receipt on the chosen printer (nearest station printer by default, or a Bluetooth portable printer). The order becomes `PAID` and the table frees up.
7. **Split by item**: move lines to a new order on the same table and pay each.
8. Speed target: a repeat order of two coffees in **three taps or fewer** after opening the table.

### 6.2 Counter POS (tablet)
- Quick sale (items → pay → issue → print) for takeaway and bar customers.
- Overview of all tables with owner, amount and time. A manager can take over a table (audited).
- **Waiter hand-over**: at shift close, the counter shows each waiter's settlement. The cashier or manager enters counted cash and accepts it, and the difference is stored.

### 6.3 Waiter settlement and shift close
- Cash collected by a waiter adds up from their payments. Cash to hand over = cash collected, minus any approved cash payouts (later). Show it live on the waiter's phone during the shift.
- Close the waiter shift: totals, counted cash, difference, then acceptance on the counter. Print a settlement slip.
- Device shift close prints the Z-report. X-reports are available any time.

### 6.4 Voids, refunds, cash rules
- Voiding a `SENT` line or cancelling before fiscalization needs a reason and a manager PIN, writes an audit entry, and prints a "VOID" ticket at the station.
- After fiscalization, a refund is a **CorrectiveDocument** via `FiscalProvider.correct(...)`; the original receipt is never edited.
- **Cash ceiling:** since 1 Jun 2026, transactions over **€2,000** between businesses and individuals must be paid by bank or electronic channel. Block cash beyond that on a single order, with a clear message. Make the limit a setting.

### 6.5 Offline-first (every device)
- Each device keeps a local SQLite copy of: menu, stations and printers, tables, staff PIN hashes, **its own open orders and the read-only state of other tables last seen**, its shift, its receipt sequence and its outboxes.
- **No internet ≠ no service.** With the internet down but the venue Wi-Fi up, phones still print to LAN printers. With Wi-Fi down too, Bluetooth printers still work. Selling, sending and issuing never wait for the cloud.
- Every device write goes into a local **sync outbox** with a client UUID; a sync worker pushes it with backoff to idempotent endpoints (`PUT /api/v1/sync/...`). Conflict rules: server wins for menu and config; **the owning device wins for its own orders** (ownership prevents two devices editing the same order offline).
- **Fiscal offline:** `FiscalProvider.issue` must work offline and mark receipts `ISSUED_OFFLINE`; the fiscal outbox submits them when back online. A summary of the earlier 2025 instruction (PwC) said outage coupons had to reach ATK within **48 hours**, with tax blocks registered within **5 days** after a total device failure. **Confirm both against AI 01/2026.** Escalating warnings: banner at 12 h, owner alert at 24 h (configurable).
- Whether each device must be registered separately with ATK as a fiscal issuer (and what that costs) is an **open question** (section 12). The design assumes per-device issuing behind the interface; if the spec forces central issuing, only the provider changes.
- Tests must cover: phone offline → open table → send (prints) → pay → issue → reconnect, giving exactly one order, payment and receipt on the server even with repeated retries. Also a printer going offline mid-send, and a phone restart with a full outbox.

### 6.6 Device health and support tooling
- Each device sends a heartbeat every 60 s when online: app version, battery, network, printer statuses, outbox sizes and the oldest item's age.
- Printer status comes from ESC/POS status queries where supported. Otherwise it is inferred from send failures.
- Alerts (Albanian text, plain language) go to the device, the owner app and an internal support view: printer offline or out of paper, outbox older than threshold, device silent for 15+ min during opening hours, app version too old.
- A **support view** in `apps/admin` (our staff role, not the owner) shows one venue's devices, alerts, recent errors and sync state, so most "it's broken" calls can be diagnosed remotely.
- Remote actions (later): request logs, force a resync, push config. Never remote-edit fiscal data.

### 6.7 Printing without hardware (until the hardware check milestone)
Olt does not have a printer, tablet or spare phone yet. Everything up to M6 must be fully buildable and testable with **a laptop, the Android emulator and his own phone**:
- **Fake printer (`tools/fake-printer`).** A TCP server listening on port 9100, decoding the ESC/POS subset we use (text, bold, double size, alignment, cut, QR, status queries). It shows every job as a receipt-like card (80 mm or 58 mm width) on a live web page at `http://localhost:9180`, newest first. It can run several instances on different ports to act as "Bar" and "Kitchen". It also has switches to simulate **offline**, **paper out** and **slow/timeouts**, so the retry, queue and alert code can be tested without hardware.
- **Reaching it:** the Android emulator reaches the laptop as `10.0.2.2`, so configure the printer as `10.0.2.2:9100`. A real phone on the same Wi-Fi uses the laptop's LAN IP.
- **Virtual printer driver** in the device app: a printer type "Virtual" that shows the ticket in a bottom sheet and keeps a history screen. This is useful for demos on a single phone with no laptop.
- **Snapshot tests:** the ESC/POS builder's output for every document type (station ticket, void ticket, pro-forma, receipt, Z-report, settlement slip, test page) is stored as golden files and compared in CI, at both 58 mm and 80 mm widths.
- **Tablet layout without a tablet:** use an Android emulator profile of about 10" (for example a Pixel Tablet image), and the phone layout on the phone emulator or Olt's own phone.
- **Rule:** no code path may assume a physical printer exists; a missing printer is a normal, handled state with a clear message.

### 6.8 Owner live view and alerts
The owner checks in on the shift from their phone at any time of day, mainly to keep an eye on waiters.
- **Live screen** (separate from history reports):
  - **Open tables:** owning waiter, amount, time open, time since the last send. Highlight tables open a long time with nothing sent recently.
  - **Per waiter:** sales so far, cash currently held (cash to hand over), receipts count, voids.
  - **Today vs. usual:** revenue so far against the same weekday's average up to this hour.
  - **Sensitive-action feed:** voids, cancellations, manager takeovers, refunds and ownership transfers, with who did it, who approved it (PIN) and the reason. Built from the audit log.
- **Freshness, not realtime.** The owner app does **not** use WebSocket. It refreshes with a refresh button and pull-to-refresh, and auto-refreshes about every 2 minutes (a setting) only while the screen is visible. It always shows "Përditësuar 21:42" (updated at) at the top.
- **Sync honesty:** data only reaches the server when devices sync, so each waiter/device row shows how fresh its data is ("telefoni offline që nga 21:40"). Never present unsynced totals as complete.
- **Push alerts** are evaluated **on the server** whenever device data syncs, and sent as push notifications whether the owner app is open or not. Owner-configurable rules, all off or at sensible defaults out of the box:
  - a void or cancellation over €X, or more than N voids in a shift;
  - a waiter holding more than €X cash (prompt a mid-shift cash drop);
  - a table open more than X minutes with nothing sent;
  - lines sent to a station but never paid when the waiter or device shift closes.
- Alert channel: web push from the PWA for now (on iPhone this needs the app added to the home screen). Viber/WhatsApp delivery is an open question (section 12).

---

## 7. The fiscal layer

### 7.1 What is known (verified sources, Nov 2026)
- **Hardware history:** Kosovo historically required **hardware** fiscal devices (standalone fiscal cash registers, or POS + fiscal printer) reporting to ATK.
- **The 2026 change:** **Administrative Instruction (MF) No. 01/2026** (27 Apr 2026) added **Electronic Fiscal Software (SEF)** as an official way to fiscalize. Hardware stays allowed during a transitional period.
- **Fiscalization code:** taxpayers need a **Unique Fiscalization Code** (ATK's EDI system, "Request for Fiscalization", live since 9 Jul 2026) before using SEF.
- **Certification:** SEF products must be **certified by ATK** and listed in its public register. Certified examples include ProData Finance+, LRPos, Zen365 POS, easyPos (Android/iOS), SEF Connect, InfoKON, Kuleta, ShariX (Android), NovaSEF, BeProg, Kendrix POS and FiskPro.
- **Receipts and outages:** coupons carry a **QR code** for verification, and SEF must store transactions it could not transmit.
- **Application package:** a technical description, a solution for untransmitted transactions, a user manual and installation guide, an **audit module** manual, a declaration of compliance, a demo version, the technology list, and **source-code documentation**.

### 7.2 What is NOT known yet → `TODO(fiscal-spec)`
- **Receipt content:** coupon fields and layout, numbering rules, how `NUIKF` (seen on certified receipts) is built.
- **Security:** signing method, certificates and keys.
- **QR code:** payload format and verification URL.
- **Transmission:** protocol, endpoints, auth and responses.
- **Corrections:** corrective document, refund and storno rules.
- **Where issuing happens:** whether **each phone may issue receipts**, or issuing must happen on one registered device or server per venue.
- **Wording:** required text on pro-forma, non-fiscal and order tickets.
- **Offline deadlines:** exact deadlines under 01/2026.

**Olt will put these documents in `docs/regulation/`** (atk-ks.org blocks automated fetching, so don't scrape it):
- Administrative Instruction (MF) No. 01/2026: https://www.atk-ks.org/en/legislation/administrative-instructions/
- Specific Technical and Functional Requirements for EFD / Fiscal Systems / EFS: https://www.atk-ks.org/wp-content/uploads/2016/04/ENG-KE%CC%88RKESAT-SPECIFIKE-TEKNIKE-DHE-FUNKSIONALE-PE%CC%88R-PAJISJET-ELEKTRONIKE-FISKALE.pdf
- Conditions and Procedures for Application, Certification and Maintenance of EFS: https://www.atk-ks.org/en/portfolio/kushtet-administrative-per-autorizim/
- SEF application form: https://www.atk-ks.org/wp-content/uploads/2018/12/Forma-e-kerkeses-SEF.pdf
- Public SEF register: https://apps.atk-ks.org/sefaplikimi/PublicSEF

When they appear, read them fully, write `docs/fiscal-spec-notes.md` with every requirement and its article number, and only then design the real provider.

### 7.3 The interface (build in M2, on both server and device)

```java
public interface FiscalProvider {
    ProviderInfo info();                                  // name, version, certified?, supportsOffline, issuesOnDevice
    FiscalResult issue(FiscalReceiptRequest request);     // must succeed offline when supportsOffline
    FiscalResult correct(CorrectiveRequest request);      // refunds / corrections after issue
    SubmissionResult submit(UUID receiptId);              // push an offline-issued receipt to the authority
    HealthStatus health();                                // reachable? last successful submission?
}
```

- `FiscalReceiptRequest`: business and venue identifiers, device id, sequence number, issued-at, lines (name, qty, unit price cents, VAT bps, line total cents), totals per VAT rate, grand total, payment methods with amounts, cashier/waiter id.
- `FiscalResult`: status, opaque provider identifiers (JSON), `qrPayload`, printable fiscal lines, errors.
- Mirror it in TS in `apps/device/src/fiscal/`. Issuing will most likely happen on the device.

**Implementations**
1. `MockFiscalProvider` (now): deterministic fake identifiers, a QR payload encoding the receipt id, and a printed **"TEST – JO KUPON FISKAL"** line. It must be impossible to enable in production (fail at startup).
2. `PartnerSefProvider` (M7): wraps a certified vendor's API or SDK, if we can negotiate one.
3. `OwnSefProvider` (later): our own, aiming at ATK certification. Build the **audit module** (hash-chained log plus export) early and keep architecture docs current so the certification package is cheap to assemble.

---

## 8. API, realtime, security

- REST under `/api/v1`, documented with OpenAPI. Generate `packages/api-client` from it in CI.
- Auth: owners use phone or email + password (JWT access plus refresh tokens). Devices register once with a pairing code from the owner app and get a device token; staff switch users by PIN on the device.
- Realtime: STOMP over WebSocket per venue (`/topic/venue/{id}/tables`, `/topic/venue/{id}/alerts`) so counters and handhelds see table state live when online (operational need: two people must not take the same table). Clients re-fetch state on reconnect; realtime is a convenience, never a dependency. **The owner app does not use WebSocket**; it polls and has a refresh button (section 6.8).
- Idempotency: every device write takes a client UUID; replays return the original result.
- Validation: the server recomputes all totals from lines and rejects mismatches.
- Security basics: argon2/bcrypt for passwords and PINs; PIN lockout after 5 failures; no secrets in the repo (`.env.example` only); the audit log's DB role has no `UPDATE`/`DELETE`; a lost phone can be revoked from the owner app.
- Personal data: staff phone numbers are personal data; don't log them.

---

## 9. Milestones

Each milestone ends with green tests, `docs/demo-<milestone>.md` (steps for Olt to try it) and `docs/walkthrough-<milestone>.md` (how it works, key files, what to read first).

### M0 — Scaffolding
- [ ] Monorepo layout from section 4, root README with one-command dev start.
- [x] Docker Compose with Postgres 16; Spring Boot runs Flyway V1.
- [ ] Expo device app, `apps/admin`, `packages/api-client` and `packages/shared` build; linting and formatting for TS and Java.
- [ ] `packages/shared/fixtures/vat-cases.json` seeded, with a Java test and a TS test that both run it (section 11).
- [ ] `tools/fake-printer` (section 6.7): TCP on 9100, live receipt view at `localhost:9180`, offline/paper-out/slow switches, multiple instances.
- [ ] Expo development build running on the Android emulator (phone and ~10" tablet profiles), reaching the API and the fake printer via `10.0.2.2`.
- [ ] GitHub Actions running build + tests for all apps.
- [ ] `docs/decisions.md` and `docs/open-questions.md` created (seed from sections 7.2 and 12).
**Done when:** one command starts the API, the admin app and the fake printer, the device app runs on an emulator, and CI is green.

### M1 — Identity, catalog, floor, devices
- [ ] Business, venue, user, membership, device, printer, station entities + migrations.
- [ ] Owner sign-up and login; invite staff; set PINs; pair devices with a code.
- [ ] Menu CRUD with i18n, VAT rates, modifiers, availability, station routing.
- [ ] Areas and tables; printers and stations setup with a "print test page" button.
- [ ] Admin screens for all of the above in Albanian and English.
- [ ] Tenant isolation test across all endpoints.
**Done when:** an owner can set up a venue with a menu, 12 tables, a bar printer and a kitchen printer, and print a test page to the fake printer.

### M2 — Counter POS, payments, mock fiscal
- [ ] Tablet layout: PIN login, device shift open, table overview, quick sale, order screen with modifiers and notes.
- [ ] `PrinterDriver` with Virtual and TCP drivers (Bluetooth driver written and unit-tested, verified on hardware later); ESC/POS builder with golden-file snapshot tests.
- [ ] Send to stations through the drivers, with print queue and retry (tested with the fake printer's offline and paper-out switches).
- [ ] Payments: cash with change, card recorded, multiple payments, €2,000 cash rule.
- [ ] `FiscalProvider` (Java + TS) and `MockFiscalProvider`; receipt sequence per device; receipt printing.
- [ ] Voids with manager PIN and void tickets; audit log.
**Done when:** a quick sale and a table order both print station tickets and a mock receipt on the fake printer.

### M3 — Waiter handheld and table ownership
- [ ] Phone layout: waiter shift, "My tables", open table, order, send, bill, pay, issue, print to a chosen printer.
- [ ] Table ownership rules; read-only view of others' tables; transfers (online) and manager takeover (audited).
- [ ] Live table state across devices via WebSocket when online.
- [ ] Every sensitive action (void, cancellation, takeover, transfer, refund) writes an audit entry with actor, approver and reason in a shape the owner live feed (M4) can query.
- [ ] Waiter settlement: live cash-to-hand-over on the phone, shift close, acceptance on the counter, settlement slip.
**Done when:** two phones and one tablet run a 10-table service, each waiter's settlement matches their payments to the cent, and the counter sees every table live.

### M4 — Owner app and reports
**M4a — Live view and alerts (section 6.8)**
- [ ] Live screen: open tables, per-waiter sales and cash held, today vs. usual, sensitive-action feed.
- [ ] Polling (≈2 min while visible, configurable) plus refresh button and pull-to-refresh; "updated at" label; per-device data freshness.
- [ ] Server-side alert rules evaluated on sync; owner-configurable thresholds; web push delivery.

**M4b — History reports**
- [ ] Dashboard: today and date range; revenue, by payment method, by VAT rate, **by waiter**, by hour, top items, voids; CSV export.
- [ ] X and Z reports (stored and printable); waiter settlements history.

**Done when:** during a service the owner sees each waiter's sales and cash held on their phone (refreshing on its own and on demand), gets a push alert when a void exceeds the threshold, sees which devices haven't synced, and can see yesterday's sales by VAT rate and by waiter and reconcile every waiter's cash.

### M5 — Offline hardening
- [ ] Full local store and outboxes on every device; sync worker with backoff; idempotent sync endpoints.
- [ ] Offline issue → `ISSUED_OFFLINE` → submit on reconnect; escalating warnings.
- [ ] Chaos tests: internet down with Wi-Fi up; Wi-Fi down with Bluetooth printer; printer down mid-send; app killed during sync; repeated retries.
**Done when:** a 20-order service on three devices with the internet off syncs with zero duplicates or losses, and every ticket printed.

### M6 — Device health and support tooling
- [ ] Heartbeats, printer status, outbox age; device and owner alerts in plain Albanian.
- [ ] Internal support view per venue (devices, alerts, errors, sync state).
- [ ] Revoke a lost device from the owner app.
**Done when:** unplugging the bar printer shows a clear alert on the waiter's phone and in the owner app within a minute, and the support view shows why.

### HW — Real hardware check (deferred; do before pilots)
Starts only when Olt says the hardware has arrived: an 80 mm LAN/Wi-Fi thermal printer, ideally a Bluetooth printer, an Android tablet and one or two Android phones.
- [ ] Write `docs/hardware-test-plan.md` (every document type, both drivers, status queries, paper out, power loss mid-print, Wi-Fi drop, printer reboot, two phones printing at once).
- [ ] Run it on the real devices; fix encoding (Albanian ë and ç), cut and QR-size issues; record the tested printer models in `docs/supported-hardware.md`.
- [ ] Add any printer quirks as switches in the fake printer so CI keeps covering them.
**Done when:** every document prints correctly on the real printers, and a 20-order service runs on real devices with the Wi-Fi switched off and on mid-service.

### M7 — Real fiscal provider (blocked)
- [ ] Blocked until `docs/regulation/` holds the ATK documents **and** Olt confirms a path (partner SEF or own SEF).
- [ ] Write `docs/fiscal-spec-notes.md`, then implement the provider behind the interface with tests against the spec.

### Add-ons (do not start without a request)
- **A1 Kitchen display:** web screen per station, bump/recall, timers, printer fallback.
- **A2 QR features:** QR codes per table (`qr_token`, rotatable); a digital menu; "call the waiter" and "bring the bill" buttons that notify the owning waiter's phone; QR ordering (cart → `PENDING_ACCEPT` → staff accept or reject), enabled per area (e.g. terrace only).
- **A3 Own online ordering page**; **A4 delivery inbox** (only if Wolt/Glovo APIs exist); **A5 stock and recipes**; **A6 Serbian locale**; **A7 own SEF certification package**.

---

## 10. UX rules

- **Albanian first.** Every string goes through i18n. Formats: `1.234,50 €`, `dd.MM.yyyy`.
- **Handheld:** one-handed use on a 6" Android phone, touch targets ≥ 48 dp, big text for prices and totals, works in sunlight (high contrast).
- **Tablet:** 10" landscape, ≥ 48 dp targets.
- **Never block service on the network.** Show sync state discreetly; show fiscal and printer problems loudly, with what to do next ("Printeri i barit s'ka letër – vendos letër ose zgjidh printer tjetër").
- Accessibility: contrast ≥ 4.5:1; status shown with text as well as colour.

---

## 11. Testing and quality bar

- **Backend:** unit tests for totals/VAT math, integration tests with Testcontainers for every endpoint, tenant-isolation tests, idempotency tests, ownership-rule tests.
- **VAT math:** prices are VAT-inclusive. Per line: `net = round(gross * 10000 / (10000 + bps))`, `vat = gross - net`; sum per rate; round half-up to the cent. Confirm the required rounding against the ATK spec (`TODO(fiscal-spec)`) and keep it in one function **per language** (Java in `apps/api`, TS in `packages/shared`). Devices compute totals offline and the server recomputes and rejects mismatches, so the two must agree to the cent: both test suites run the same cases from `packages/shared/fixtures/vat-cases.json` (gross, bps, expected net and VAT, per-rate sums, rounding edge cases). Any change to the math starts by adding a case there.
- **Device:** tests for the outbox, sync, ownership rules, the print queue (against `tools/fake-printer`) and the fiscal mock.
- **Web:** component tests and Playwright end-to-end tests for owner setup (M1) and dashboards (M4).
- No milestone is done with failing or skipped tests.

---

## 12. Open questions (seed `docs/open-questions.md` with these)

1. Partner SEF or own SEF first? Which certified vendors offer an API, SDK or white-label?
2. Everything in section 7.2, especially **whether each waiter phone may issue fiscal receipts** and whether each device needs its own ATK registration and fee.
3. Which VAT rate applies to café/restaurant food and drinks? (Ask an accountant.)
4. Do waiters in our pilot venues carry their own cash and settle at shift end? How do they hand over today?
5. Which printers do venues already have (models, LAN/USB/Bluetooth), and can we reuse them? Which model should we buy for the HW milestone so it matches what pilots will use?
6. Which card terminals do venues use? Integration or "card" as a recorded method only?
7. Dealer partnership terms: revenue share, who does first-line support, who installs?
8. Pricing per tier within ~€25–60/month, plus setup and hardware bundle prices.
9. Company setup: a Kosovo company with a local partner, given Olt studies in Hungary on a student permit (check permit rules first).
10. Owner alerts: is web push enough, or do owners need alerts on Viber/WhatsApp (and do those offer a usable business API at our price point)?
11. Monitoring individual waiters (per-waiter sales, voids, cash held): anything in Kosovo labour or data-protection law we must tell staff or respect?

---

## 13. Glossary

| Term | Meaning |
|---|---|
| ATK / TAK | Administrata Tatimore e Kosovës — Tax Administration of Kosovo |
| SEF / EFS | Softuer Elektronik Fiskal — certified Electronic Fiscal Software |
| PEF / EFD | Pajisje Elektronike Fiskale — hardware Electronic Fiscal Device |
| EDI | ATK's electronic declaration system (issues the Unique Fiscalization Code) |
| Kupon fiskal | Fiscal coupon / receipt |
| NUI | Business identification number |
| TVSH | VAT |
| X-report / Z-report | Interim / end-of-shift fiscal sales report |
| Station ticket | Order slip printed at the bar or kitchen (not fiscal) |
| Waiter settlement | Each waiter's end-of-shift sales and cash hand-over |
| ESC/POS | Command language of thermal receipt printers |
| KDS | Kitchen display system (add-on) |
