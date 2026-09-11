// Headless QR capture: starts a Baileys socket, prints the raw QR string
// to stdout as "QRSTRING:<data>" so the parent can render a PNG, then exits
// once paired (creds.json present) or after timeout.
import makeWASocket, { useMultiFileAuthState, fetchLatestBaileysVersion } from '@whiskeysockets/baileys';
import { existsSync, writeFileSync } from 'fs';
import path from 'path';
import pino from 'pino';

const args = process.argv.slice(2);
function getArg(name, def) {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : def;
}
const SESSION_DIR = getArg('session', path.join(process.env.HOME || '~', '.hermes', 'whatsapp', 'session'));
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
  sock.ev.on('connection.update', (update) => {
    const { connection, qr } = update;
    if (qr && qr !== lastQr) {
      lastQr = qr;
      try { writeFileSync('/tmp/wa_qr.txt', qr); } catch (e) {}
      console.log('QRSTRING:' + qr);
    }
    if (connection === 'open') {
      try { writeFileSync('/tmp/wa_qr.txt', 'PAIRED'); } catch (e) {}
      console.log('PAIRED:ok');
      setTimeout(() => process.exit(0), 1500);
    }
  });
}
start().catch((e) => { console.error('ERR:' + e.message); process.exit(1); });
// Safety timeout
setTimeout(() => { console.log('TIMEOUT'); process.exit(2); }, 180000);
