# tools/fake-printer

A fake ESC/POS printer for development and tests, so everything can be built without hardware
(CLAUDE.md section 6.7).

- TCP server on port 9100 that decodes our ESC/POS subset
- live receipt view at `http://localhost:9180`
- several instances on different ports (for example "Bar" and "Kitchen")
- switches to simulate offline, paper out and slow/timeouts

The Android emulator reaches it at `10.0.2.2:9100`. Implementation arrives in #4.
