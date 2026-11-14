import { describe, expect, it } from 'vitest';
import { decode, type Block } from './decode';

const ESC = 0x1b;
const GS = 0x1d;
const bytes = (...parts: (number | string)[]) =>
  Uint8Array.from(
    parts.flatMap((p) => (typeof p === 'number' ? [p] : [...Buffer.from(p, 'latin1')])),
  );
const text = (block: Block | undefined) =>
  block?.kind === 'line' ? block.spans.map((s) => s.text).join('') : undefined;

describe('decode', () => {
  it('splits text into lines on LF', () => {
    const doc = decode(bytes('Macchiato\n', 'Espresso\n'));
    expect(doc.blocks.map(text)).toEqual(['Macchiato', 'Espresso']);
    expect(doc.warnings).toEqual([]);
  });

  it('keeps empty lines', () => {
    expect(decode(bytes('a\n\nb\n')).blocks.map(text)).toEqual(['a', '', 'b']);
  });

  it('reads bold from ESC E and ESC !', () => {
    const doc = decode(bytes(ESC, 0x45, 1, 'Total', ESC, 0x45, 0, ' x\n', ESC, 0x21, 0x08, 'B\n'));
    const [first, second] = doc.blocks;
    expect(first).toMatchObject({
      spans: [
        { text: 'Total', bold: true },
        { text: ' x', bold: false },
      ],
    });
    expect(second).toMatchObject({ spans: [{ text: 'B', bold: true }] });
  });

  it('reads character size from GS ! and ESC !', () => {
    const doc = decode(
      bytes(GS, 0x21, 0x11, 'BIG\n', GS, 0x21, 0x10, 'wide\n', ESC, 0x21, 0x10, 'tall\n'),
    );
    expect(doc.blocks).toMatchObject([
      { spans: [{ width: 2, height: 2 }] },
      { spans: [{ width: 2, height: 1 }] },
      { spans: [{ width: 1, height: 2 }] },
    ]);
  });

  it('applies alignment set at the start of a line', () => {
    const doc = decode(
      bytes(ESC, 0x61, 1, 'Bar\n', ESC, 0x61, 0x32, 'right\n', ESC, 0x61, 0, 'left\n'),
    );
    expect(doc.blocks).toMatchObject([{ align: 'center' }, { align: 'right' }, { align: 'left' }]);
  });

  it('resets styles on ESC @', () => {
    const doc = decode(bytes(ESC, 0x45, 1, GS, 0x21, 0x11, ESC, 0x61, 1, ESC, 0x40, 'plain\n'));
    expect(doc.blocks[0]).toMatchObject({
      align: 'left',
      spans: [{ bold: false, width: 1, height: 1 }],
    });
  });

  it('feeds lines with ESC d', () => {
    expect(decode(bytes('a\n', ESC, 0x64, 2)).blocks.map(text)).toEqual(['a', '', '']);
  });

  it('reads full and partial cuts, with and without feed', () => {
    const doc = decode(bytes('x\n', GS, 0x56, 0, GS, 0x56, 1, GS, 0x56, 66, 3));
    expect(doc.blocks.slice(1)).toEqual([
      { kind: 'cut', partial: false },
      { kind: 'cut', partial: true },
      { kind: 'cut', partial: true },
    ]);
    expect(doc.warnings).toEqual([]);
  });

  it('reads a QR code from GS ( k', () => {
    const data = 'https://example.test/r/123';
    const store = [GS, 0x28, 0x6b, (data.length + 3) & 0xff, (data.length + 3) >> 8, 49, 80, 48];
    // prettier-ignore
    const doc = decode(
      bytes(
        ESC, 0x61, 1,
        GS, 0x28, 0x6b, 4, 0, 49, 65, 50, 0, // model 2
        GS, 0x28, 0x6b, 3, 0, 49, 67, 6, // module size 6
        GS, 0x28, 0x6b, 3, 0, 49, 69, 49, // ECC M
        ...store, data,
        GS, 0x28, 0x6b, 3, 0, 49, 81, 48, // print
      ),
    );
    expect(doc.blocks).toEqual([{ kind: 'qr', align: 'center', data, moduleSize: 6, ecc: 'M' }]);
    expect(doc.warnings).toEqual([]);
  });

  it('skips status queries without printing them', () => {
    const doc = decode(bytes(0x10, 0x04, 4, 'a\n', GS, 0x72, 1));
    expect(doc.blocks.map(text)).toEqual(['a']);
    expect(doc.warnings).toEqual([]);
  });

  it('decodes Albanian letters and the euro sign in PC858', () => {
    const doc = decode(bytes(ESC, 0x74, 19, 0x80, 0x87, 0xd3, 0x89, ' 2,50 ', 0xd5, '\n'));
    expect(text(doc.blocks[0])).toBe('ÇçËë 2,50 €');
    expect(doc.warnings).toEqual([]);
  });

  it('warns about unknown commands and bytes', () => {
    const doc = decode(bytes(ESC, 0x70, 'a\n', 0x07, 0xff, '\n'));
    expect(doc.warnings).toEqual([
      'Unknown command ESC 0x70',
      'Unexpected control byte 0x07',
      'Byte 0xFF has no character in code page 0',
    ]);
  });

  it('warns about a command cut off at the end', () => {
    expect(decode(bytes('a\n', GS, 0x28, 0x6b, 10, 0, 49)).warnings).toEqual([
      'GS ( k is cut off at the end of the job',
    ]);
    expect(decode(bytes('a\n', ESC)).warnings).toEqual(['ESC is cut off at the end of the job']);
  });

  it('names the right command when a job ends mid-command', () => {
    expect(decode(bytes('a\n', 0x10)).warnings).toEqual(['DLE is cut off at the end of the job']);
    expect(decode(bytes('a\n', 0x10, 0x04)).warnings).toEqual([
      'DLE EOT is cut off at the end of the job',
    ]);
    expect(decode(bytes('a\n', 0x10, 0x14)).warnings[0]).toBe('Unknown command DLE 0x14');
    expect(decode(bytes('a\n', GS, 0x28)).warnings).toEqual([
      'GS ( is cut off at the end of the job',
    ]);
    expect(decode(bytes('a\n', GS, 0x28, 0x4c)).warnings[0]).toBe('Unknown command GS ( 0x4C');
  });

  it('decodes a very long line without running out of stack', () => {
    const doc = decode(bytes('x'.repeat(500_000), '\n'));
    expect(text(doc.blocks[0])).toHaveLength(500_000);
  });

  it('warns when the last line has no LF but still shows it', () => {
    const doc = decode(bytes('Total'));
    expect(doc.blocks.map(text)).toEqual(['Total']);
    expect(doc.warnings).toHaveLength(1);
  });

  it('returns nothing for a status-only connection', () => {
    expect(decode(bytes(0x10, 0x04, 1, 0x10, 0x04, 4))).toEqual({ blocks: [], warnings: [] });
  });
});
