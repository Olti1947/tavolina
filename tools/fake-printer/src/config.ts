import type { PrinterConfig } from './printer';

export const DEFAULT_PRINTERS = 'Bar:9100:80,Kitchen:9101:80';
export const DEFAULT_WEB_PORT = 9180;

/** Parses "Name:port[:width]", for example "Bar:9100:80". */
export function parsePrinter(spec: string): PrinterConfig {
  const [name, port, width, ...rest] = spec.trim().split(':');
  const portNumber = Number(port);
  if (
    !name ||
    rest.length > 0 ||
    !Number.isInteger(portNumber) ||
    portNumber < 0 ||
    portNumber > 65535
  ) {
    throw new Error(`"${spec}" is not a printer; use Name:port[:58|80], e.g. Bar:9100:80`);
  }
  if (width !== undefined && width !== '58' && width !== '80') {
    throw new Error(`"${spec}": paper width must be 58 or 80`);
  }
  return { name, port: portNumber, paperWidth: width === '58' ? 58 : 80 };
}

export interface CliConfig {
  printers: PrinterConfig[];
  webPort: number;
}

/** Flags win over environment variables, which win over the defaults. */
export function parseCli(argv: string[], env: NodeJS.ProcessEnv): CliConfig {
  const printerSpecs: string[] = [];
  let webPort = env.FAKE_PRINTER_WEB_PORT;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    const value = arg.includes('=') ? arg.slice(arg.indexOf('=') + 1) : argv[++i];
    const flag = arg.split('=')[0];
    if (value === undefined) throw new Error(`${flag} needs a value`);
    if (flag === '--printer') printerSpecs.push(value);
    else if (flag === '--web-port') webPort = value;
    else
      throw new Error(`Unknown option ${flag}; use --printer Name:port[:58|80] and --web-port N`);
  }
  const specs =
    printerSpecs.length > 0
      ? printerSpecs
      : (env.FAKE_PRINTER_PRINTERS ?? DEFAULT_PRINTERS).split(',');
  const port = webPort === undefined ? DEFAULT_WEB_PORT : Number(webPort);
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error(`Web port "${webPort}" is not a port number`);
  }
  return { printers: specs.map(parsePrinter), webPort: port };
}
