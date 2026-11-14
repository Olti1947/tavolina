import { describe, expect, it } from 'vitest';
import { StatusScanner, statusReply } from './status';

describe('statusReply', () => {
  it.each([
    [1, 0x12, 0x1a],
    [2, 0x12, 0x32],
    [3, 0x12, 0x12],
    [4, 0x12, 0x7e],
  ])('DLE EOT %i: ok %#x, paper out %#x', (n, ok, out) => {
    expect(statusReply({ cmd: 'DLE EOT', n }, { paperOut: false })).toBe(ok);
    expect(statusReply({ cmd: 'DLE EOT', n }, { paperOut: true })).toBe(out);
  });

  it('answers GS r 1 with the paper sensor', () => {
    expect(statusReply({ cmd: 'GS r', n: 1 }, { paperOut: false })).toBe(0x00);
    expect(statusReply({ cmd: 'GS r', n: 49 }, { paperOut: true })).toBe(0x0f);
  });

  it('stays silent for queries it does not know', () => {
    expect(statusReply({ cmd: 'DLE EOT', n: 7 }, { paperOut: false })).toBeNull();
    expect(statusReply({ cmd: 'GS r', n: 4 }, { paperOut: false })).toBeNull();
  });
});

describe('StatusScanner', () => {
  it('finds queries between other data', () => {
    const scanner = new StatusScanner();
    expect(scanner.push(Buffer.from([0x41, 0x10, 0x04, 0x04, 0x42, 0x1d, 0x72, 0x01]))).toEqual([
      { cmd: 'DLE EOT', n: 4 },
      { cmd: 'GS r', n: 1 },
    ]);
  });

  it('finds a query split after its second byte', () => {
    const scanner = new StatusScanner();
    expect(scanner.push(Buffer.from([0x41, 0x10, 0x04]))).toEqual([]);
    expect(scanner.push(Buffer.from([0x01]))).toEqual([{ cmd: 'DLE EOT', n: 1 }]);
  });

  it('finds a query split across chunks', () => {
    const scanner = new StatusScanner();
    expect(scanner.push(Buffer.from([0x41, 0x10]))).toEqual([]);
    expect(scanner.push(Buffer.from([0x04]))).toEqual([]);
    expect(scanner.push(Buffer.from([0x02, 0x41]))).toEqual([{ cmd: 'DLE EOT', n: 2 }]);
  });
});
