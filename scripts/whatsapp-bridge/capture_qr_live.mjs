import makeWASocket, { useMultiFileAuthState, fetchLatestBaileysVersion } from '@whiskeysockets/baileys';
import { writeFileSync } from 'fs';
import path from 'path';
import pino from 'pino';
import qrcode from 'qrcode-terminal';
import { execFileSync } from 'child_process';

const args = process.argv.slice(2);
function getArg(name, def) {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : def;
}
const SESSION_DIR = getArg('session', path.join(process.env.HOME || '~', '.hermes', 'whatsapp', 'session-2'));
const OUTPUT = getArg('output', path.join(process.env.HOME || '~', '.hermes', 'whatsapp', 'wa-second-pairing-qr.png'));
const STATUS = getArg('status', '/tmp/wa_qr_second_status.txt');
const logger = pino({ level: 'silent' });
let lastQr = null;

async function start() {
  const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);
  const { version } = await fetchLatestBaileysVersion();
  const sock = makeWASocket({
    version, auth: state, logger,
    printQRInTerminal: false,
    browser: ['Hermes Agent', 'Chrome', '120.0'],
    syncFullHistory: false, markOnlineOnConnect: false,
  });
  sock.ev.on('creds.update', saveCreds);
  sock.ev.on('connection.update', async ({ connection, qr, lastDisconnect }) => {
    if (qr && qr !== lastQr) {
      lastQr = qr;
      const py = `import qrcode,sys; qrcode.make(sys.stdin.read()).save(sys.argv[1])`;
      execFileSync('python3', ['-c', py, OUTPUT], { input: qr });
      writeFileSync(STATUS, `READY ${Date.now()}\n`);
      console.log(`QR_UPDATED:${Date.now()}`);
    }
    if (connection === 'open') {
      writeFileSync(STATUS, 'PAIRED\n');
      console.log('PAIRED:ok');
      setTimeout(() => process.exit(0), 2000);
    }
    if (connection === 'close') {
      const code = lastDisconnect?.error?.output?.statusCode;
      console.log(`CLOSE:${code ?? 'unknown'}`);
    }
  });
}
start().catch((e) => { writeFileSync(STATUS, `ERR:${e.message}\n`); console.error(`ERR:${e.message}`); process.exit(1); });
setTimeout(() => { console.log('TIMEOUT'); process.exit(2); }, 600000);
