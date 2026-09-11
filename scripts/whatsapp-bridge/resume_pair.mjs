// Resume an in-progress WhatsApp pairing: load existing creds, do NOT
// request a new pairing code, just wait for the connection to reach "open"
// and finish registration. Writes PAIRED to /tmp/wa_pair.txt on success.
import makeWASocket, { useMultiFileAuthState, fetchLatestBaileysVersion } from '@whiskeysockets/baileys';
import { writeFileSync } from 'fs';
import path from 'path';
import pino from 'pino';

const args = process.argv.slice(2);
function getArg(name, def) {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : def;
}
const SESSION_DIR = getArg('session', path.join(process.env.HOME || '~', '.hermes', 'whatsapp', 'session'));
const logger = pino({ level: 'silent' });

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
    const { connection, lastDisconnect, qr } = update;
    if (qr) {
      // A QR means the prior pairing was NOT accepted — report it.
      writeFileSync('/tmp/wa_pair.txt', 'NEEDS_REPAIR');
      console.log('NEEDS_REPAIR');
      setTimeout(() => process.exit(3), 500);
    }
    if (connection === 'open') {
      writeFileSync('/tmp/wa_pair.txt', 'PAIRED');
      console.log('PAIRED:ok');
      setTimeout(() => process.exit(0), 2000);
    }
    if (connection === 'close') {
      const code = lastDisconnect?.error?.output?.statusCode;
      console.log('CLOSE:' + code);
      if (code === 401 || code === 403) {
        writeFileSync('/tmp/wa_pair.txt', 'LOGGEDOUT:' + code);
        setTimeout(() => process.exit(4), 500);
      }
      // else Baileys auto-reconnects
    }
  });
}
start().catch((e) => { writeFileSync('/tmp/wa_pair.txt', 'ERR:' + e.message); console.error('ERR:' + e.message); process.exit(1); });
setTimeout(() => { console.log('TIMEOUT'); process.exit(2); }, 300000);
