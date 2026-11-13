import net from 'node:net';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { startFakePrinter, type FakePrinterServer } from './server';

const TICKET = Buffer.from(
  '\x1b@\x1ba\x01\x1d!\x11BAR\n\x1d!\x00\x1ba\x002x Macchiato\n\x1dV\x00',
  'latin1',
);

/** Sends bytes like a printer driver: connect, write, half-close, collect the replies. */
function send(port: number, data: Buffer, { timeoutMs = 1000 } = {}): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const replies: Buffer[] = [];
    const socket = net.connect(port, '127.0.0.1', () => socket.end(data));
    socket.setTimeout(timeoutMs, () => {
      socket.destroy();
      reject(new Error('timeout'));
    });
    socket.on('data', (chunk) => replies.push(chunk));
    socket.on('close', () => resolve(Buffer.concat(replies)));
    socket.on('error', reject);
  });
}

/** Sends a status query and resolves with the first reply byte, keeping the connection open until then. */
function query(port: number, bytes: number[], timeoutMs = 1000): Promise<number> {
  return new Promise((resolve, reject) => {
    const socket = net.connect(port, '127.0.0.1', () => socket.write(Buffer.from(bytes)));
    socket.setTimeout(timeoutMs, () => {
      socket.destroy();
      reject(new Error('timeout'));
    });
    socket.once('data', (chunk) => {
      socket.destroy();
      resolve(chunk[0]!);
    });
    socket.on('error', reject);
  });
}

describe('fake printer server', () => {
  let server: FakePrinterServer;
  const bar = () => server.printer('bar');
  const base = () => `http://127.0.0.1:${server.webPort}`;

  beforeEach(async () => {
    server = await startFakePrinter({
      printers: [
        { name: 'Bar', port: 0 },
        { name: 'Kitchen', port: 0, paperWidth: 58 },
      ],
      webPort: 0,
      host: '127.0.0.1',
    });
  });

  afterEach(async () => {
    await server.close();
  });

  it('stores each connection as a decoded job', async () => {
    await send(bar().port, TICKET);
    const job = await bar().waitForJob();
    expect(job).toMatchObject({ id: 1, printer: 'Bar', printed: true });
    expect(job.doc.blocks).toMatchObject([
      { kind: 'line', align: 'center', spans: [{ text: 'BAR', width: 2, height: 2 }] },
      { kind: 'line', align: 'left', spans: [{ text: '2x Macchiato' }] },
      { kind: 'cut', partial: false },
    ]);
    expect(job.raw.equals(TICKET)).toBe(true);
  });

  it('keeps printers separate and lists jobs newest first', async () => {
    await send(bar().port, Buffer.from('one\n'));
    await bar().waitForJob((j) => j.id === 1);
    await send(bar().port, Buffer.from('two\n'));
    await bar().waitForJob((j) => j.id === 2);
    await send(server.printer('Kitchen').port, Buffer.from('soup\n'));
    await server.printer('Kitchen').waitForJob();
    expect(
      bar()
        .jobs()
        .map((j) => j.id),
    ).toEqual([2, 1]);
    expect(server.printer('Kitchen').jobs()).toHaveLength(1);
  });

  it('answers status queries and does not store status-only connections', async () => {
    expect(await query(bar().port, [0x10, 0x04, 0x04])).toBe(0x12);
    expect(await query(bar().port, [0x1d, 0x72, 0x01])).toBe(0x00);
    expect(bar().jobs()).toEqual([]);
  });

  it('refuses connections while offline and accepts them again after', async () => {
    const port = bar().port;
    await bar().setMode('offline');
    await expect(send(port, TICKET)).rejects.toMatchObject({ code: 'ECONNREFUSED' });
    await bar().setMode('online');
    expect(bar().port).toBe(port);
    await send(port, TICKET);
    await bar().waitForJob();
  });

  it('reports paper out and marks jobs as not printed', async () => {
    await bar().setMode('paperOut');
    expect(await query(bar().port, [0x10, 0x04, 0x04])).toBe(0x7e);
    expect(await query(bar().port, [0x10, 0x04, 0x01])).toBe(0x1a);
    await send(bar().port, TICKET);
    expect(await bar().waitForJob()).toMatchObject({ printed: false });
  });

  it('delays everything in slow mode', async () => {
    await bar().setMode('slow', { slowMs: 300 });
    const started = Date.now();
    expect(await query(bar().port, [0x10, 0x04, 0x04])).toBe(0x12);
    expect(Date.now() - started).toBeGreaterThanOrEqual(250);
  });

  it('never answers in timeout mode', async () => {
    await bar().setMode('timeout');
    await expect(query(bar().port, [0x10, 0x04, 0x04], 300)).rejects.toThrow('timeout');
    await expect(send(bar().port, TICKET, { timeoutMs: 300 })).rejects.toThrow('timeout');
    expect(bar().jobs()).toEqual([]);
  });

  it('times out waiting for a job that never comes', async () => {
    await expect(bar().waitForJob(() => true, 50)).rejects.toThrow('No job on printer "Bar"');
  });

  describe('HTTP API', () => {
    it('lists printers', async () => {
      const res = await fetch(`${base()}/api/printers`);
      expect(await res.json()).toMatchObject([
        { name: 'Bar', paperWidth: 80, mode: 'online', jobCount: 0 },
        { name: 'Kitchen', paperWidth: 58, mode: 'online', jobCount: 0 },
      ]);
    });

    it('switches modes', async () => {
      const res = await fetch(`${base()}/api/printers/kitchen/mode`, {
        method: 'POST',
        body: JSON.stringify({ mode: 'slow', slowMs: 1500 }),
      });
      expect(res.status).toBe(200);
      expect(server.printer('Kitchen')).toMatchObject({ mode: 'slow', slowMs: 1500 });
    });

    it('rejects unknown modes and printers', async () => {
      const bad = await fetch(`${base()}/api/printers/Bar/mode`, {
        method: 'POST',
        body: JSON.stringify({ mode: 'broken' }),
      });
      expect(bad.status).toBe(400);
      const missing = await fetch(`${base()}/api/printers/Terrace/jobs`);
      expect(missing.status).toBe(404);
    });

    it('returns rendered jobs and clears them', async () => {
      await send(bar().port, TICKET);
      await bar().waitForJob();
      const jobs = (await (await fetch(`${base()}/api/printers/Bar/jobs`)).json()) as {
        html: string;
        warnings: string[];
      }[];
      expect(jobs).toHaveLength(1);
      expect(jobs[0]!.html).toContain('2x Macchiato');
      expect(jobs[0]!.warnings).toEqual([]);

      expect((await fetch(`${base()}/api/printers/Bar/jobs`, { method: 'DELETE' })).status).toBe(
        204,
      );
      expect(bar().jobs()).toEqual([]);
    });

    it('serves the live page', async () => {
      const res = await fetch(base());
      expect(res.headers.get('content-type')).toContain('text/html');
      expect(await res.text()).toContain('<title>Fake printer</title>');
    });
  });
});
