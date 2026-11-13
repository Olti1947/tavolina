import os from 'node:os';
import { parseCli } from './config';
import { startFakePrinter } from './server';

function lanAddresses(): string[] {
  return Object.values(os.networkInterfaces())
    .flat()
    .filter((a) => a && a.family === 'IPv4' && !a.internal)
    .map((a) => a!.address);
}

async function main() {
  const config = parseCli(process.argv.slice(2), process.env);
  const server = await startFakePrinter(config);

  const lan = lanAddresses()[0];
  console.log(`Fake printer: receipts at http://localhost:${server.webPort}`);
  for (const p of server.printers) {
    const phone = lan ? `, phone on Wi-Fi ${lan}:${p.port}` : '';
    console.log(`  ${p.name.padEnd(10)} ${p.paperWidth} mm  emulator 10.0.2.2:${p.port}${phone}`);
  }

  const shutdown = () => {
    void server.close().then(() => process.exit(0));
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err: NodeJS.ErrnoException & { port?: number }) => {
  if (err.code === 'EADDRINUSE') {
    console.error(
      `Fake printer: port ${err.port ?? ''} is already in use. Is another fake printer running?`,
    );
  } else {
    console.error(`Fake printer: ${err.message}`);
  }
  process.exit(1);
});
