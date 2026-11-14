import type http from 'node:http';
import { FakePrinter, type PrinterConfig } from './printer';
import { startWeb, webPort } from './web';

export interface FakePrinterOptions {
  printers: PrinterConfig[];
  /** Port of the live receipt view; 0 picks a free one, `false` starts no web server (tests). */
  webPort?: number | false;
  /** Address the printers listen on. The default lets phones on the Wi-Fi reach them. */
  host?: string;
  /** Address of the receipt view. Only this laptop needs it. */
  webHost?: string;
}

export interface FakePrinterServer {
  printers: FakePrinter[];
  /** Looks a printer up by name, ignoring case. */
  printer(name: string): FakePrinter;
  webPort: number | null;
  close(): Promise<void>;
}

export async function startFakePrinter(options: FakePrinterOptions): Promise<FakePrinterServer> {
  const names = options.printers.map((p) => p.name.toLowerCase());
  if (names.length === 0) throw new Error('Configure at least one printer');
  if (new Set(names).size !== names.length) throw new Error('Printer names must be unique');

  const printers = options.printers.map((config) => new FakePrinter(config, options.host));
  let web: http.Server | undefined;
  try {
    for (const p of printers) await p.start();
    if (options.webPort !== false) {
      web = await startWeb(printers, options.webPort ?? 9180, options.webHost ?? '127.0.0.1');
    }
  } catch (err) {
    await Promise.all(printers.map((p) => p.close()));
    throw err;
  }

  return {
    printers,
    printer(name) {
      const found = printers.find((p) => p.name.toLowerCase() === name.toLowerCase());
      if (!found) throw new Error(`No printer named "${name}"`);
      return found;
    },
    webPort: web ? webPort(web) : null,
    async close() {
      if (web) {
        // Open live-view streams would keep the server from closing.
        web.closeAllConnections();
        await new Promise<void>((resolve) => web!.close(() => resolve()));
      }
      await Promise.all(printers.map((p) => p.close()));
    },
  };
}
