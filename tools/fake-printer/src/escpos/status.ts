// Status queries and the bytes a printer answers with, following the Epson ESC/POS reference
// (DLE EOT n "transmit real-time status", GS r n "transmit status"). Real printers answer
// DLE EOT as soon as it arrives, even in the middle of other data, so the scanner looks at the
// raw stream instead of waiting for the decoder.

export type StatusQuery = { cmd: 'DLE EOT' | 'GS r'; n: number };

export interface PaperState {
  paperOut: boolean;
}

/** One-byte answer to a status query, or null when this printer stays silent (unknown n). */
export function statusReply(query: StatusQuery, { paperOut }: PaperState): number | null {
  if (query.cmd === 'GS r') {
    // n = 1 paper sensor: bits 0-1 near end, bits 2-3 paper end. n = 2 drawer: closed.
    if (query.n === 1 || query.n === 49) return paperOut ? 0x0f : 0x00;
    if (query.n === 2 || query.n === 50) return 0x00;
    return null;
  }
  // DLE EOT: bits 1 and 4 are always set.
  const FIXED = 0x12;
  switch (query.n) {
    case 1: // printer: bit 3 offline (a printer out of paper goes offline)
      return FIXED | (paperOut ? 0x08 : 0);
    case 2: // offline cause: bit 5 stopped because the paper ran out
      return FIXED | (paperOut ? 0x20 : 0);
    case 3: // error cause: none of ours are simulated
      return FIXED;
    case 4: // roll paper sensor: bits 2-3 near end, bits 5-6 paper end
      return FIXED | (paperOut ? 0x0c | 0x60 : 0);
    default:
      return null;
  }
}

/** Finds status queries in a byte stream that may arrive split across TCP chunks. */
export class StatusScanner {
  // At most the last two bytes of the previous chunk, when they could start a query.
  private tail: Uint8Array = new Uint8Array(0);

  push(chunk: Uint8Array): StatusQuery[] {
    const bytes = this.tail.length > 0 ? Buffer.concat([this.tail, chunk]) : chunk;
    const queries: StatusQuery[] = [];
    let i = 0;
    for (; i < bytes.length; i++) {
      const b = bytes[i];
      if (b !== 0x10 && b !== 0x1d) continue;
      if (i + 2 >= bytes.length) break; // could be the start of a query: keep it for the next chunk
      if (b === 0x10 && bytes[i + 1] === 0x04) {
        queries.push({ cmd: 'DLE EOT', n: bytes[i + 2]! });
        i += 2;
      } else if (b === 0x1d && bytes[i + 1] === 0x72) {
        queries.push({ cmd: 'GS r', n: bytes[i + 2]! });
        i += 2;
      }
    }
    this.tail = Uint8Array.from(bytes.subarray(i));
    return queries;
  }
}
