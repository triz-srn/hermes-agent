// Headless pairing-code capture for WhatsApp (Baileys).
// Requests an 8-digit pairing code for a phone number, writes it to
// /tmp/wa_pair_second.txt, then waits for pairing to complete (creds.json).
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
const PHONE = getArg('phone', '');
const logger = pino({ level: 'silent' });

let codeRequested = false;
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

  // Request pairing code once the socket is up and we are not yet registered.
  if (PHONE && !sock.authState.creds.registered && !codeRequested) {
    codeRequested = true;
    setTimeout(async () => {
      try {
        const code = await sock.requestPairingCode(PHONE);
        writeFileSync('/tmp/wa_pair_second.txt', code);
        console.log('PAIRCODE:' + code);
      } catch (e) {
        writeFileSync('/tmp/wa_pair_second.txt', 'ERR:' + e.message);
        console.log('ERR:' + e.message);
      }
    }, 3000);
  }

  sock.ev.on('connection.update', (update) => {
    const { connection } = update;
    if (connection === 'open') {
      writeFileSync('/tmp/wa_pair_second.txt', 'PAIRED');
      console.log('PAIRED:ok');
      setTimeout(() => process.exit(0), 1500);
    }
  });
}
start().catch((e) => { writeFileSync('/tmp/wa_pair_second.txt', 'ERR:' + e.message); console.error('ERR:' + e.message); process.exit(1); });
setTimeout(() => { console.log('TIMEOUT'); process.exit(2); }, 180000);
