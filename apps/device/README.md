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
The development build and emulator profiles arrive in #5.

## Run and test

```sh
npm start -w @tavolina/device     # Metro; press `w` for a quick look in the browser
npm test -w @tavolina/device      # Jest (jest-expo + Testing Library)
```

Until devices are paired (M1), `src/App.tsx` picks the layout from the screen: shortest side
≥ 600 dp → tablet (counter), otherwise phone (waiter). Expo detects the npm workspace on its
own, so `@tavolina/shared` resolves with no custom `metro.config.js`.
