// Decodes the ESC/POS subset our builder emits into a document the receipt view can draw.
// Anything outside the subset becomes a warning on the job card, so builder bugs are visible.

export type Align = 'left' | 'center' | 'right';

export interface Span {
  text: string;
  bold: boolean;
  /** Character width and height multipliers, 1–8 (GS !). */
  width: number;
  height: number;
}

export type Block =
  | { kind: 'line'; align: Align; spans: Span[] }
  | { kind: 'cut'; partial: boolean }
  | { kind: 'qr'; align: Align; data: string; moduleSize: number; ecc: string };

export interface Doc {
  blocks: Block[];
  warnings: string[];
}

const LF = 0x0a;
const CR = 0x0d;
const HT = 0x09;
const DLE = 0x10;
const ESC = 0x1b;
const GS = 0x1d;

// Characters above 0x7F in the code pages printers ship with (ESC t 0 = PC437, 19 = PC858).
// Only what Albanian needs plus the euro sign; the HW milestone checks real printers.
const HIGH_CHARS: Record<number, Record<number, string>> = {
  0: { 0x80: 'Ç', 0x82: 'é', 0x87: 'ç', 0x89: 'ë' },
  19: { 0x80: 'Ç', 0x82: 'é', 0x87: 'ç', 0x89: 'ë', 0xd3: 'Ë', 0xd5: '€' },
};

const ALIGNS: Record<number, Align> = {
  0: 'left',
  48: 'left',
  1: 'center',
  49: 'center',
  2: 'right',
  50: 'right',
};
const QR_ECC: Record<number, string> = { 48: 'L', 49: 'M', 50: 'Q', 51: 'H' };

const hex = (b: number) => '0x' + b.toString(16).padStart(2, '0').toUpperCase();

export function decode(bytes: Uint8Array): Doc {
  const blocks: Block[] = [];
  const warnings: string[] = [];

  let bold = false;
  let width = 1;
  let height = 1;
  let align: Align = 'left';
  let codePage = 0;

  let qrData = '';
  let qrModuleSize = 3;
  let qrEcc = 'L';

  // The line being built. Alignment counts only at the start of a line, as on a real printer.
  let spans: Span[] = [];
  let lineAlign: Align = align;

  const reset = () => {
    bold = false;
    width = 1;
    height = 1;
    align = 'left';
    codePage = 0;
  };

  const addText = (text: string) => {
    if (spans.length === 0) lineAlign = align;
    const last = spans[spans.length - 1];
    if (last && last.bold === bold && last.width === width && last.height === height) {
      last.text += text;
    } else {
      spans.push({ text, bold, width, height });
    }
  };

  const endLine = () => {
    blocks.push({ kind: 'line', align: spans.length > 0 ? lineAlign : align, spans });
    spans = [];
  };

  // A cut or QR code starts on a fresh line; flush any text that has no LF yet.
  const flushPartialLine = () => {
    if (spans.length > 0) endLine();
  };

  const warn = (message: string) => {
    if (!warnings.includes(message)) warnings.push(message);
  };

  let i = 0;
  // Reads the byte at i + offset, or undefined when the job ends mid-command.
  const at = (offset: number) => bytes[i + offset];
  const truncated = (name: string) => {
    warn(`${name} is cut off at the end of the job`);
    i = bytes.length;
  };

  while (i < bytes.length) {
    const b = bytes[i]!;

    if (b === LF) {
      endLine();
      i += 1;
    } else if (b === CR) {
      i += 1;
    } else if (b === HT) {
      addText(' ');
      i += 1;
    } else if (b === DLE) {
      // DLE EOT n: real-time status query, answered by the printer, not printed.
      if (at(1) === undefined) {
        truncated('DLE');
      } else if (at(1) === 0x04 && at(2) === undefined) {
        truncated('DLE EOT');
      } else if (at(1) === 0x04) {
        if (at(2)! < 1 || at(2)! > 4) warn(`DLE EOT ${at(2)} is not a status query we support`);
        i += 3;
      } else {
        warn(`Unknown command DLE ${hex(at(1)!)}`);
        i += 1;
      }
    } else if (b === ESC) {
      const cmd = at(1);
      const n = at(2);
      if (cmd === undefined) {
        truncated('ESC');
      } else if (cmd === 0x40) {
        // ESC @ initialize
        flushPartialLine();
        reset();
        i += 2;
      } else if (n === undefined) {
        truncated(`ESC ${String.fromCharCode(cmd)}`);
      } else if (cmd === 0x45) {
        // ESC E n bold
        bold = (n & 1) === 1;
        i += 3;
      } else if (cmd === 0x21) {
        // ESC ! n print mode: bit 3 bold, bit 4 double height, bit 5 double width
        bold = (n & 0x08) !== 0;
        height = n & 0x10 ? 2 : 1;
        width = n & 0x20 ? 2 : 1;
        i += 3;
      } else if (cmd === 0x61) {
        // ESC a n alignment
        const a = ALIGNS[n];
        if (a) align = a;
        else warn(`ESC a ${n} is not a valid alignment`);
        if (spans.length === 0) lineAlign = align;
        i += 3;
      } else if (cmd === 0x64) {
        // ESC d n feed n lines
        flushPartialLine();
        for (let k = 0; k < n; k++) endLine();
        i += 3;
      } else if (cmd === 0x74) {
        // ESC t n code page
        codePage = n;
        if (!HIGH_CHARS[n]) warn(`ESC t ${n}: code page not decoded, accented letters show as �`);
        i += 3;
      } else if (cmd === 0x2d) {
        // ESC - n underline: accepted, not drawn
        i += 3;
      } else {
        warn(`Unknown command ESC ${hex(cmd)}`);
        i += 1;
      }
    } else if (b === GS) {
      const cmd = at(1);
      if (cmd === undefined) {
        truncated('GS');
      } else if (cmd === 0x21) {
        // GS ! n character size: high nibble width - 1, low nibble height - 1
        const n = at(2);
        if (n === undefined) {
          truncated('GS !');
          continue;
        }
        width = ((n >> 4) & 0x07) + 1;
        height = (n & 0x07) + 1;
        i += 3;
      } else if (cmd === 0x56) {
        // GS V m [n] cut: m = 0/48 full, 1/49 partial, 65/66 feed then cut (takes n)
        const m = at(2);
        if (m === undefined) {
          truncated('GS V');
          continue;
        }
        flushPartialLine();
        const withFeed = m === 65 || m === 66;
        if (withFeed && at(3) === undefined) {
          truncated('GS V');
          continue;
        }
        blocks.push({ kind: 'cut', partial: m === 1 || m === 49 || m === 66 });
        i += withFeed ? 4 : 3;
      } else if (cmd === 0x28 && at(2) === undefined) {
        truncated('GS (');
      } else if (cmd === 0x28 && at(2) !== 0x6b) {
        warn(`Unknown command GS ( ${hex(at(2)!)}`);
        i += 1;
      } else if (cmd === 0x28) {
        // GS ( k pL pH cn fn [params]: 2D codes. Length pL + pH * 256 covers cn, fn and params.
        const pL = at(3);
        const pH = at(4);
        if (pL === undefined || pH === undefined) {
          truncated('GS ( k');
          continue;
        }
        const len = pL + pH * 256;
        const end = i + 5 + len;
        if (end > bytes.length) {
          truncated('GS ( k');
          continue;
        }
        const cn = bytes[i + 5];
        const fn = bytes[i + 6];
        const params = bytes.subarray(i + 7, end);
        if (cn !== 49) {
          warn(`GS ( k for symbol ${cn} is not supported (only QR, cn = 49)`);
        } else if (fn === 65) {
          // model: accepted
        } else if (fn === 67) {
          qrModuleSize = params[0] ?? qrModuleSize;
        } else if (fn === 69) {
          qrEcc = QR_ECC[params[0] ?? -1] ?? qrEcc;
        } else if (fn === 80) {
          // store data: first param is m = 48, then the data
          qrData = new TextDecoder().decode(params.subarray(1));
        } else if (fn === 81) {
          flushPartialLine();
          blocks.push({ kind: 'qr', align, data: qrData, moduleSize: qrModuleSize, ecc: qrEcc });
        } else {
          warn(`GS ( k QR function ${fn} is not supported`);
        }
        i = end;
      } else if (cmd === 0x72) {
        // GS r n transmit status: answered by the printer, not printed
        if (at(2) === undefined) {
          truncated('GS r');
          continue;
        }
        i += 3;
      } else if (cmd === 0x61) {
        // GS a n automatic status back: accepted, not emulated
        if (at(2) === undefined) {
          truncated('GS a');
          continue;
        }
        i += 3;
      } else {
        warn(`Unknown command GS ${hex(cmd)}`);
        i += 1;
      }
    } else if (b < 0x20 || b === 0x7f) {
      warn(`Unexpected control byte ${hex(b)}`);
      i += 1;
    } else if (b < 0x80) {
      // Collect a run of printable ASCII at once.
      let j = i;
      while (j < bytes.length && bytes[j]! >= 0x20 && bytes[j]! < 0x7f) j++;
      addText(Buffer.from(bytes.buffer, bytes.byteOffset + i, j - i).toString('latin1'));
      i = j;
    } else {
      const ch = HIGH_CHARS[codePage]?.[b];
      if (ch === undefined) warn(`Byte ${hex(b)} has no character in code page ${codePage}`);
      addText(ch ?? '�');
      i += 1;
    }
  }

  if (spans.length > 0) {
    warn('The last line has no line feed, so a real printer would not print it yet');
    endLine();
  }

  return { blocks, warnings };
}
