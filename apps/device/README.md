# apps/device

Expo (React Native, TypeScript) app for Android: **one app, two layouts**.

| Folder | Purpose |
|---|---|
| `src/offline/` | `expo-sqlite` local store, sync outbox and sync worker. Every device keeps working with no internet. |
| `src/printing/` | ESC/POS builder and `PrinterDriver`s (Virtual, TCP 9100, Bluetooth), print queue and retry. |
| `src/fiscal/` | TypeScript mirror of `FiscalProvider`; receipts are most likely issued on the device. |
| `src/features/` | Feature screens and logic (orders, payments, shifts, ...), shared by both layouts. |
| `src/layouts/tablet/` | Counter POS layout (10" landscape). |
| `src/layouts/phone/` | Waiter handheld layout (6" one-handed). |

Both layouts share the offline engine, printing and fiscal code, so those rules are written once.
Needs an Expo **development build** (not Expo Go) because TCP sockets need a native module.
Project setup arrives in #3.
