import { EventEmitter } from 'node:events';
import net from 'node:net';
import { decode, type Doc } from './escpos/decode';
import { StatusScanner, statusReply } from './escpos/status';

/**
 * - `online`: prints normally.
 * - `offline`: not listening, so connections are refused (printer switched off or unplugged).
 * - `paperOut`: accepts jobs and answers status queries with "paper end", but prints nothing.
 * - `slow`: waits `slowMs` before reading anything, status replies included.
 * - `timeout`: accepts the connection, then never reads or answers.
 */
export type Mode = 'online' | 'offline' | 'paperOut' | 'slow' | 'timeout';
export const MODES: readonly Mode[] = ['online', 'offline', 'paperOut', 'slow', 'timeout'];

export type PaperWidth = 58 | 80;

export interface PrinterConfig {
  name: string;
  /** TCP port; 0 picks a free one (for tests). */
  port: number;
  paperWidth?: PaperWidth;
}

export interface Job {
  id: number;
  printer: string;
  receivedAt: string;
  remote: string;
  /** False when the printer was out of paper: the job reached it but nothing came out. */
  printed: boolean;
  raw: Buffer;
  doc: Doc;
}

const MAX_JOBS = 200;

export class FakePrinter extends EventEmitter<{ job: [Job]; mode: [Mode] }> {
  readonly name: string;
  readonly paperWidth: PaperWidth;
  private _port: number;
  private _mode: Mode = 'online';
  private _slowMs = 3000;
  private readonly host: string;
  private readonly server: net.Server;
  private readonly sockets = new Set<net.Socket>();
  // Connections held by `slow` (with the timer that releases them) or `timeout` (null).
  private readonly held = new Map<net.Socket, NodeJS.Timeout | null>();
  // Mode changes run one after another, so a double click can't interleave listen and close.
  private modeChange: Promise<void> = Promise.resolve();
  private _jobs: Job[] = [];
  private nextId = 1;

  constructor(config: PrinterConfig, host = '0.0.0.0') {
    super();
    this.name = config.name;
    this.paperWidth = config.paperWidth ?? 80;
    this._port = config.port;
    this.host = host;
    this.server = net.createServer((socket) => this.accept(socket));
  }

  get port(): number {
    return this._port;
  }

  get mode(): Mode {
    return this._mode;
  }

  get slowMs(): number {
    return this._slowMs;
  }

  /** Newest first. */
  jobs(): Job[] {
    return [...this._jobs];
  }

  clear(): void {
    this._jobs = [];
  }

  async start(): Promise<void> {
    await this.listen();
  }

  async close(): Promise<void> {
    await this.stopListening();
    this.removeAllListeners();
  }

  setMode(mode: Mode, options: { slowMs?: number } = {}): Promise<void> {
    if (!MODES.includes(mode)) return Promise.reject(new Error(`Unknown mode "${mode}"`));
    const { slowMs } = options;
    if (slowMs !== undefined && (!Number.isInteger(slowMs) || slowMs < 0)) {
      return Promise.reject(new Error('slowMs must be a non-negative integer'));
    }
    const run = this.modeChange.then(() => this.applyMode(mode, slowMs));
    this.modeChange = run.catch(() => {});
    return run;
  }

  private async applyMode(mode: Mode, slowMs: number | undefined): Promise<void> {
    const slowChanged = slowMs !== undefined && slowMs !== this._slowMs;
    if (slowMs !== undefined) this._slowMs = slowMs;
    if (mode === this._mode) {
      if (slowChanged) this.emit('mode', mode);
      return;
    }
    if (mode === 'offline') await this.stopListening();
    else if (this._mode === 'offline') await this.listen();
    else this.releaseHeld();
    this._mode = mode;
    this.emit('mode', mode);
  }

  /**
   * Resolves with the first stored job matching `predicate`, or the next one to arrive.
   * Call `clear()` between test cases so an older job does not match.
   */
  waitForJob(predicate: (job: Job) => boolean = () => true, timeoutMs = 2000): Promise<Job> {
    const existing = [...this._jobs].reverse().find(predicate);
    if (existing) return Promise.resolve(existing);
    return new Promise((resolve, reject) => {
      const onJob = (job: Job) => {
        if (!predicate(job)) return;
        clearTimeout(timer);
        this.off('job', onJob);
        resolve(job);
      };
      const timer = setTimeout(() => {
        this.off('job', onJob);
        reject(new Error(`No job on printer "${this.name}" within ${timeoutMs} ms`));
      }, timeoutMs);
      this.on('job', onJob);
    });
  }

  private listen(): Promise<void> {
    return new Promise((resolve, reject) => {
      const onError = (err: Error) => reject(err);
      this.server.once('error', onError);
      this.server.listen(this._port, this.host, () => {
        this.server.off('error', onError);
        this._port = (this.server.address() as net.AddressInfo).port;
        resolve();
      });
    });
  }

  // Leaving `slow` or `timeout`: delayed connections carry on now, hung ones are dropped
  // (a hung printer that recovers has forgotten them).
  private releaseHeld(): void {
    for (const [socket, timer] of this.held) {
      if (timer) {
        clearTimeout(timer);
        socket.resume();
      } else {
        socket.destroy();
      }
    }
    this.held.clear();
  }

  // Like pulling the plug: open connections drop too.
  private stopListening(): Promise<void> {
    for (const timer of this.held.values()) if (timer) clearTimeout(timer);
    this.held.clear();
    for (const socket of this.sockets) socket.destroy();
    if (!this.server.listening) return Promise.resolve();
    return new Promise((resolve) => this.server.close(() => resolve()));
  }

  private accept(socket: net.Socket): void {
    this.sockets.add(socket);
    socket.on('close', () => {
      this.sockets.delete(socket);
      this.held.delete(socket);
    });
    socket.on('error', () => socket.destroy());

    const remote = `${socket.remoteAddress ?? '?'}:${socket.remotePort ?? '?'}`;
    // The mode when the job starts decides how it is handled.
    const paperOut = this._mode === 'paperOut';

    if (this._mode === 'timeout') {
      socket.pause();
      this.held.set(socket, null);
      return;
    }

    const chunks: Buffer[] = [];
    const scanner = new StatusScanner();
    socket.on('data', (chunk: Buffer) => {
      chunks.push(chunk);
      for (const query of scanner.push(chunk)) {
        const reply = statusReply(query, { paperOut: this._mode === 'paperOut' });
        if (reply !== null && socket.writable) socket.write(Buffer.from([reply]));
      }
    });
    // A real printer prints whatever arrived, however the connection ends: a clean
    // half-close ('end') or a reset or destroy ('close' only).
    let stored = false;
    const finish = () => {
      if (stored) return;
      stored = true;
      this.store(Buffer.concat(chunks), remote, !paperOut);
    };
    socket.on('end', () => {
      socket.end();
      finish();
    });
    socket.on('close', finish);

    if (this._mode === 'slow') {
      socket.pause();
      const timer = setTimeout(() => {
        this.held.delete(socket);
        socket.resume();
      }, this._slowMs);
      this.held.set(socket, timer);
    }
  }

  private store(raw: Buffer, remote: string, printed: boolean): void {
    const doc = decode(raw);
    // A connection that only asked for status (a driver polling the printer) is not a job.
    if (doc.blocks.length === 0 && doc.warnings.length === 0) return;
    const job: Job = {
      id: this.nextId++,
      printer: this.name,
      receivedAt: new Date().toISOString(),
      remote,
      printed,
      raw,
      doc,
    };
    this._jobs.unshift(job);
    if (this._jobs.length > MAX_JOBS) this._jobs.length = MAX_JOBS;
    this.emit('job', job);
  }
}
