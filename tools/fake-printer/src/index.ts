// Public API for tests in other workspaces (for example the device print queue in M2).
export { startFakePrinter, type FakePrinterOptions, type FakePrinterServer } from './server';
export {
  FakePrinter,
  MODES,
  type Job,
  type Mode,
  type PaperWidth,
  type PrinterConfig,
} from './printer';
export { decode, type Align, type Block, type Doc, type Span } from './escpos/decode';
export { statusReply, StatusScanner, type StatusQuery } from './escpos/status';
