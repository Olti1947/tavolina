# tools/fake-printer

A fake ESC/POS printer for development and tests, so everything can be built without hardware
(CLAUDE.md section 6.7). One process runs several printers, each on its own TCP port, and shows
every job as a paper-like receipt on a live page.

## Run it

```sh
make dev                                   # starts it with the rest of the stack
npm start -w @tavolina/fake-printer        # or on its own
```

Then open <http://localhost:9180>. By default there are two 80 mm printers:

| Printer | Laptop           | Android emulator | Phone on the same Wi-Fi |
| ------- | ---------------- | ---------------- | ----------------------- |
| Bar     | `localhost:9100` | `10.0.2.2:9100`  | `<laptop LAN IP>:9100`  |
| Kitchen | `localhost:9101` | `10.0.2.2:9101`  | `<laptop LAN IP>:9101`  |

The startup log prints the LAN IP. The printers listen on all interfaces so a phone can reach
them; the page listens on `127.0.0.1` only.

Try it without the app:

```sh
printf '\x1b@\x1ba\x01\x1d!\x11Bar\n\x1d!\x00\x1ba\x00Macchiato x2\n\x1dV\x00' | nc -w1 localhost 9100
```

## Configure

| Flag                         | Environment variable    | Default                       |
| ---------------------------- | ----------------------- | ----------------------------- |
| `--printer Name:port[:58\|80]` (repeat) | `FAKE_PRINTER_PRINTERS` (comma-separated) | `Bar:9100:80,Kitchen:9101:80` |
| `--web-port N`               | `FAKE_PRINTER_WEB_PORT` | `9180`                        |

```sh
npm start -w @tavolina/fake-printer -- --printer Terrace:9102:58 --web-port 9280
```

## Switches

Each printer has buttons on the page, or use the API:

| Mode       | What a driver sees                                                                   |
| ---------- | ------------------------------------------------------------------------------------ |
| `online`   | Prints normally                                                                      |
| `offline`  | Connection refused (printer off or unplugged); open connections drop                 |
| `paperOut` | Connects; status queries report paper end; the job is kept but marked "not printed"  |
| `slow`     | Connects; nothing is read or answered for `slowMs` (default 3000)                     |
| `timeout`  | Connects; nothing is ever read or answered                                           |

```sh
curl -X POST localhost:9180/api/printers/Bar/mode -d '{"mode":"slow","slowMs":5000}'
curl localhost:9180/api/printers                 # printers and modes
curl localhost:9180/api/printers/Bar/jobs        # jobs, newest first
curl -X DELETE localhost:9180/api/printers/Bar/jobs
```

## What it understands

Each TCP connection is one job. A connection that only asks for status is not a job.

- `ESC @` reset, `ESC E` bold, `ESC !` print mode, `GS !` character size, `ESC a` alignment,
  `ESC d` feed, `LF`, `GS V` full/partial cut, `ESC t` code page (PC437 and PC858 for ë, ç, Ë, Ç, €)
- `GS ( k` QR code (model, module size, error correction, store, print)
- Status: `DLE EOT 1–4` (answered immediately, as real printers do) and `GS r 1/2`, using the bits
  from the Epson ESC/POS reference. Paper out answers `DLE EOT 4` with `0x7E`; normal is `0x12`.
- `ESC -` underline and `GS a` auto status back are accepted but not drawn or emulated.

Anything else, a command cut off at the end of the job, a line with no `LF`, or a line wider than
the paper (48 columns at 80 mm, 32 at 58 mm) shows as a warning on the card. The raw bytes are
under "Raw bytes" on each card.

## In tests

```ts
import { startFakePrinter } from '@tavolina/fake-printer';

const fake = await startFakePrinter({
  printers: [{ name: 'Bar', port: 0 }], // 0 picks a free port
  webPort: false,                       // no page needed
  host: '127.0.0.1',
});
const bar = fake.printer('Bar');
// ...point the driver at 127.0.0.1:bar.port and print...
const job = await bar.waitForJob();     // first stored job, or the next one (2 s timeout)
expect(job.doc.blocks).toMatchObject([{ kind: 'line', spans: [{ text: 'BAR' }] }]);
await bar.setMode('paperOut');
bar.clear();                            // between cases, so an older job doesn't match
await fake.close();
```
