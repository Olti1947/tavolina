import { describe, expect, it } from 'vitest';
import { decode } from './escpos/decode';
import type { Job } from './printer';
import { renderJob } from './render';

const job = (text: string): Job => {
  const raw = Buffer.from(text, 'latin1');
  return {
    id: 1,
    printer: 'Bar',
    receivedAt: '',
    remote: '',
    printed: true,
    raw,
    doc: decode(raw),
  };
};

describe('renderJob', () => {
  it('escapes text', async () => {
    const { html } = await renderJob(job('<b>&"\n'), 80);
    expect(html).toContain('&#60;b&#62;&#38;&#34;');
    expect(html).not.toContain('<b>');
  });

  it('warns when a line is wider than the paper', async () => {
    const line = 'x'.repeat(40) + '\n';
    expect((await renderJob(job(line), 80)).warnings).toEqual([]);
    expect((await renderJob(job(line), 58)).warnings).toEqual([
      'A line is 40 columns wide; the paper fits 32',
    ]);
    // Double width counts twice.
    expect((await renderJob(job('\x1d!\x10' + 'x'.repeat(30) + '\n'), 80)).warnings).toEqual([
      'A line is 60 columns wide; the paper fits 48',
    ]);
  });

  it('shows a warning instead of failing when the QR data is too long', async () => {
    const data = 'x'.repeat(4000);
    const len = data.length + 3;
    const store = `\x1d(k${String.fromCharCode(len & 0xff, len >> 8)}\x31\x50\x30${data}`;
    const rendered = await renderJob(job(store + '\x1d(k\x03\x00\x31\x51\x30'), 80);
    expect(rendered.html).toContain('could not be drawn');
    expect(rendered.warnings[0]).toMatch(/^QR code could not be drawn/);
  });

  it('draws a QR code as SVG', async () => {
    const data = 'abc';
    const store = `\x1d(k${String.fromCharCode(data.length + 3)}\x00\x31\x50\x30${data}`;
    const { html } = await renderJob(job(store + '\x1d(k\x03\x00\x31\x51\x30'), 80);
    expect(html).toContain('<svg');
  });
});
