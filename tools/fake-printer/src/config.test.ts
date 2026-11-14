import { describe, expect, it } from 'vitest';
import { parseCli, parsePrinter } from './config';

describe('parsePrinter', () => {
  it('reads name, port and width', () => {
    expect(parsePrinter('Bar:9100:58')).toEqual({ name: 'Bar', port: 9100, paperWidth: 58 });
    expect(parsePrinter(' Kitchen:9101 ')).toEqual({ name: 'Kitchen', port: 9101, paperWidth: 80 });
  });

  it.each(['Bar', ':9100', 'Bar:x', 'Bar:70000', 'Bar:9100:76', 'Bar:9100:80:x'])(
    'rejects %s',
    (spec) => expect(() => parsePrinter(spec)).toThrow(),
  );
});

describe('parseCli', () => {
  it('defaults to Bar and Kitchen with the view on 9180', () => {
    expect(parseCli([], {})).toEqual({
      printers: [
        { name: 'Bar', port: 9100, paperWidth: 80 },
        { name: 'Kitchen', port: 9101, paperWidth: 80 },
      ],
      webPort: 9180,
    });
  });

  it('reads the environment', () => {
    const config = parseCli([], {
      FAKE_PRINTER_PRINTERS: 'Terrace:9200:58',
      FAKE_PRINTER_WEB_PORT: '9280',
    });
    expect(config).toEqual({
      printers: [{ name: 'Terrace', port: 9200, paperWidth: 58 }],
      webPort: 9280,
    });
  });

  it('lets flags override the environment', () => {
    const config = parseCli(['--printer', 'A:1', '--printer=B:2', '--web-port', '3'], {
      FAKE_PRINTER_PRINTERS: 'X:9',
      FAKE_PRINTER_WEB_PORT: '9',
    });
    expect(config.printers.map((p) => p.name)).toEqual(['A', 'B']);
    expect(config.webPort).toBe(3);
  });

  it('rejects unknown options', () => {
    expect(() => parseCli(['--port', '1'], {})).toThrow(/Unknown option --port/);
  });
});
