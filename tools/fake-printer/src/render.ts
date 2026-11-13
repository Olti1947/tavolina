import QRCode from 'qrcode';
import type { Block, Span } from './escpos/decode';
import type { Job, PaperWidth } from './printer';

/** Characters per line in Font A: 576 dots / 12 on 80 mm paper, 384 / 12 on 58 mm. */
export const COLUMNS: Record<PaperWidth, number> = { 80: 48, 58: 32 };

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

const lineColumns = (spans: Span[]) =>
  spans.reduce((sum, span) => sum + [...span.text].length * span.width, 0);

function renderSpan(span: Span): string {
  const styles: string[] = [];
  if (span.bold) styles.push('font-weight:700');
  if (span.width !== 1 || span.height !== 1) {
    // Each character takes `width` columns and `height` rows of the base font.
    styles.push(`--w:${span.width}`, `--h:${span.height}`);
  }
  const cls = span.width !== 1 || span.height !== 1 ? ' class="big"' : '';
  const style = styles.length > 0 ? ` style="${styles.join(';')}"` : '';
  return `<span${cls}${style}>${escapeHtml(span.text)}</span>`;
}

async function renderBlock(
  block: Block,
  columns: number,
): Promise<{ html: string; warning?: string }> {
  switch (block.kind) {
    case 'line': {
      const used = lineColumns(block.spans);
      const over = used > columns;
      const body = block.spans.map(renderSpan).join('') || '&nbsp;';
      const cls = `line ${block.align}${over ? ' overflow' : ''}`;
      return {
        html: `<div class="${cls}">${body}</div>`,
        warning: over ? `A line is ${used} columns wide; the paper fits ${columns}` : undefined,
      };
    }
    case 'cut':
      return { html: `<div class="cut">${block.partial ? 'partial cut' : 'cut'}</div>` };
    case 'qr': {
      const svg = await QRCode.toString(block.data || ' ', {
        type: 'svg',
        errorCorrectionLevel: block.ecc as QRCode.QRCodeErrorCorrectionLevel,
        margin: 1,
      });
      return {
        html: `<div class="qr ${block.align}" style="--m:${block.moduleSize}" title="${escapeHtml(block.data)}">${svg}</div>`,
      };
    }
  }
}

/** Plain data for the page; `html` is the receipt body. */
export interface RenderedJob {
  id: number;
  printer: string;
  receivedAt: string;
  remote: string;
  printed: boolean;
  bytes: number;
  rawHex: string;
  warnings: string[];
  html: string;
}

export async function renderJob(job: Job, paperWidth: PaperWidth): Promise<RenderedJob> {
  const columns = COLUMNS[paperWidth];
  const parts = await Promise.all(job.doc.blocks.map((block) => renderBlock(block, columns)));
  const warnings = [...job.doc.warnings];
  for (const { warning } of parts) {
    if (warning && !warnings.includes(warning)) warnings.push(warning);
  }
  return {
    id: job.id,
    printer: job.printer,
    receivedAt: job.receivedAt,
    remote: job.remote,
    printed: job.printed,
    bytes: job.raw.length,
    rawHex: job.raw.toString('hex').replace(/(..)(?!$)/g, '$1 '),
    warnings,
    html: parts.map((p) => p.html).join(''),
  };
}
