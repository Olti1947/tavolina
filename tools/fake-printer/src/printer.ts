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
  private readonly timers = new Set<NodeJS.Timeout>();
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

  async setMode(mode: Mode, options: { slowMs?: number } = {}): Promise<void> {
    if (!MODES.includes(mode)) throw new Error(`Unknown mode "${mode}"`);
    if (options.slowMs !== undefined) {
      if (!Number.isInteger(options.slowMs) || options.slowMs < 0) {
        throw new Error('slowMs must be a non-negative integer');
      }
      this._slowMs = options.slowMs;
    }
    if (mode === this._mode) return;
    if (mode === 'offline') await this.stopListening();
    else if (this._mode === 'offline') await this.listen();
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

  // Like pulling the plug: open connections drop too.
  private stopListening(): Promise<void> {
    for (const timer of this.timers) clearTimeout(timer);
    this.timers.clear();
    for (const socket of this.sockets) socket.destroy();
    if (!this.server.listening) return Promise.resolve();
    return new Promise((resolve) => this.server.close(() => resolve()));
  }

  private accept(socket: net.Socket): void {
    this.sockets.add(socket);
    socket.on('close', () => this.sockets.delete(socket));
    socket.on('error', () => socket.destroy());

    const remote = `${socket.remoteAddress ?? '?'}:${socket.remotePort ?? '?'}`;
    // The mode when the job starts decides how it is handled.
    const paperOut = this._mode === 'paperOut';

    if (this._mode === 'timeout') {
      socket.pause();
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
    socket.on('end', () => {
      socket.end();
      this.store(Buffer.concat(chunks), remote, !paperOut);
    });

    if (this._mode === 'slow') {
      socket.pause();
      const timer = setTimeout(() => {
        this.timers.delete(timer);
        socket.resume();
      }, this._slowMs);
      this.timers.add(timer);
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
