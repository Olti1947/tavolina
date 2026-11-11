# Decisions

ADR-lite log: date, decision, why. Newest at the bottom.

## 2026-11-11 — Owner live view of the current shift
**Decision:** Add a live owner screen (open tables, per-waiter sales and cash held, today vs. usual, a feed of voids/takeovers/refunds/transfers) plus owner-configurable push alerts. M4 is split into M4a (live view and alerts) and M4b (history reports). M3 must write sensitive actions to the audit log in a form the feed can query. See CLAUDE.md section 6.8.
**Why:** Owners want to watch waiters and the shift as it happens, not only read reports afterwards. In waiter-led cafés the main loss is items served but never billed, and the system can flag those because every send is recorded. It is also a selling point that plain fiscal software lacks.

## 2026-11-11 — Owner app polls; no WebSocket
**Decision:** The owner app refreshes by polling (about every 2 minutes, configurable, only while the screen is visible) plus a refresh button and pull-to-refresh, and shows an "updated at" time and per-device data freshness. Counter and handheld devices keep the optional STOMP/WebSocket table updates. Alert rules run on the server when device data syncs and are delivered as push notifications, independent of the owner app being open.
**Why:** The owner is monitoring, not operating; a delay of a couple of minutes changes no decision. Data freshness is limited by device sync anyway (devices work offline), so a socket would not make it more current. Mobile browsers drop sockets when backgrounded, so a refetch path is needed regardless. Polling is simpler and cheaper to run at €25–60/venue/month. Devices on the floor still need second-level updates so two staff don't take the same table.
