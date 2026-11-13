import { readFileSync } from 'node:fs';
import http from 'node:http';
import type net from 'node:net';
import { MODES, type FakePrinter, type Job, type Mode } from './printer';
import { renderJob, type RenderedJob } from './render';

const PAGE = readFileSync(new URL('./page.html', import.meta.url), 'utf8');

export interface PrinterInfo {
  name: string;
  port: number;
  paperWidth: number;
  mode: Mode;
  slowMs: number;
  jobCount: number;
}

const info = (p: FakePrinter): PrinterInfo => ({
  name: p.name,
  port: p.port,
  paperWidth: p.paperWidth,
  mode: p.mode,
  slowMs: p.slowMs,
  jobCount: p.jobs().length,
});

/** The live receipt view and a small JSON API for switching modes from scripts or tests. */
export function startWeb(
  printers: FakePrinter[],
  port: number,
  host: string,
): Promise<http.Server> {
  const byName = new Map(printers.map((p) => [p.name.toLowerCase(), p]));
  const rendered = new WeakMap<Job, Promise<RenderedJob>>();
  const render = (p: FakePrinter, job: Job) => {
    let r = rendered.get(job);
    if (!r) {
      r = renderJob(job, p.paperWidth);
      rendered.set(job, r);
    }
    return r;
  };

  const streams = new Set<http.ServerResponse>();
  const broadcast = (event: string, data: unknown) => {
    const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const res of streams) res.write(message);
  };
  for (const p of printers) {
    p.on('job', async (job) => broadcast('job', await render(p, job)));
    p.on('mode', () => broadcast('printer', info(p)));
  }

  const snapshot = async () =>
    Promise.all(
      printers.map(async (p) => ({
        ...info(p),
        jobs: await Promise.all(p.jobs().map((job) => render(p, job))),
      })),
    );

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const send = (status: number, body?: unknown) => {
      res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
      res.end(body === undefined ? undefined : JSON.stringify(body));
    };

    try {
      if (req.method === 'GET' && url.pathname === '/') {
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        res.end(PAGE);
        return;
      }
      if (req.method === 'GET' && url.pathname === '/events') {
        res.writeHead(200, {
          'content-type': 'text/event-stream',
          'cache-control': 'no-cache',
          connection: 'keep-alive',
        });
        streams.add(res);
        req.on('close', () => streams.delete(res));
        res.write(`event: snapshot\ndata: ${JSON.stringify(await snapshot())}\n\n`);
        return;
      }
      if (req.method === 'GET' && url.pathname === '/api/printers') {
        send(200, printers.map(info));
        return;
      }

      const match = /^\/api\/printers\/([^/]+)\/(jobs|mode)$/.exec(url.pathname);
      const printer = match ? byName.get(decodeURIComponent(match[1]!).toLowerCase()) : undefined;
      if (!match) {
        send(404, { error: 'Not found' });
      } else if (!printer) {
        send(404, { error: `No printer named "${decodeURIComponent(match[1]!)}"` });
      } else if (match[2] === 'jobs' && req.method === 'GET') {
        send(200, await Promise.all(printer.jobs().map((job) => render(printer, job))));
      } else if (match[2] === 'jobs' && req.method === 'DELETE') {
        printer.clear();
        broadcast('cleared', { printer: printer.name });
        send(204);
      } else if (match[2] === 'mode' && req.method === 'POST') {
        const body = JSON.parse((await readBody(req)) || '{}') as { mode?: Mode; slowMs?: number };
        if (!body.mode || !MODES.includes(body.mode)) {
          send(400, { error: `mode must be one of: ${MODES.join(', ')}` });
          return;
        }
        await printer.setMode(body.mode, { slowMs: body.slowMs });
        send(200, info(printer));
      } else {
        send(405, { error: 'Method not allowed' });
      }
    } catch (err) {
      send(400, { error: err instanceof Error ? err.message : String(err) });
    }
  });

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => {
      server.off('error', reject);
      resolve(server);
    });
  });
}

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.setEncoding('utf8');
    req.on('data', (chunk: string) => (body += chunk));
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

export function webPort(server: http.Server): number {
  return (server.address() as net.AddressInfo).port;
}
