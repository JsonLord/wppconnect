import express from 'express';
import * as wppconnect from './index';
import { Resolver } from 'dns';
import fs from 'fs';
import path from 'path';

const app = express();
const port = process.env.NODE_PORT || 3000;

let whatsappClient: wppconnect.Whatsapp | null = null;
let lastQR: { ascii: string, base64: string } | null = null;
let statusMsg: string = 'Disconnected';
let appLogs: string[] = [];
let isReady = false;
let isInitializing = false;

const log = (msg: string) => {
  const entry = `${new Date().toISOString()} - ${msg}`;
  console.log(entry);
  appLogs.push(entry);
  if (appLogs.length > 200) appLogs.shift();
};

app.use(express.json());

app.get('/health', (req, res) => {
  res.json({
    status: 'UP',
    connected: !!whatsappClient,
    ready: isReady,
    whatsappStatus: statusMsg,
    hasQR: !!lastQR,
    logs: appLogs
  });
});

app.get('/qr-data', (req, res) => {
  if (lastQR) res.json(lastQR);
  else res.status(404).json({ error: 'No QR' });
});

app.get('/screenshot', async (req, res) => {
  if (whatsappClient && whatsappClient.page) {
    try {
      const screenshot = await whatsappClient.page.screenshot({ encoding: 'base64' });
      const img = Buffer.from(screenshot as string, 'base64');
      res.writeHead(200, { 'Content-Type': 'image/png', 'Content-Length': img.length });
      res.end(img);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  } else {
    res.status(404).json({ error: 'Browser not active' });
  }
});

app.post('/init', (req, res) => {
  if (isInitializing) return res.json({ success: false, message: 'Already initializing' });
  startWPP();
  res.json({ success: true });
});

app.post('/send-message', async (req, res) => {
  const { telnumber, message } = req.body;
  if (!whatsappClient || !isReady) return res.status(503).json({ error: 'WhatsApp not ready' });
  try {
    const result = await whatsappClient.sendText(`${telnumber}@c.us`, message);
    res.json({ success: true, result });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.post('/send-poll', async (req, res) => {
  const { telnumber, name, choices } = req.body;
  if (!whatsappClient || !isReady) return res.status(503).json({ error: 'WhatsApp not ready' });
  try {
    const result = await whatsappClient.sendPollMessage(`${telnumber}@c.us`, name, choices);
    res.json({ success: true, result });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

async function startWPP() {
  if (isInitializing) return;
  isInitializing = true;
  statusMsg = 'Initializing...';
  log('Starting WPPConnect init...');

  // Try to get IP for web.whatsapp.com manually
  let waIP = '157.240.22.60';
  try {
    const resolver = new Resolver();
    resolver.setServers(['8.8.8.8', '1.1.1.1']);
    const addrs = await new Promise<string[]>((resolve, reject) => {
      resolver.resolve4('web.whatsapp.com', (err, addresses) => err ? reject(err) : resolve(addresses));
    });
    if (addrs && addrs.length > 0) {
        waIP = addrs[0];
        log(`Resolved web.whatsapp.com to ${waIP}`);
    }
  } catch (e) {
    log(`DNS failure, using fallback IP ${waIP}`);
  }

  // Cleanup tokens to avoid locks
  try {
    const tokensDir = path.join(process.cwd(), 'tokens');
    if (fs.existsSync(tokensDir)) fs.rmSync(tokensDir, { recursive: true, force: true });
    log('Cleaned tokens directory');
  } catch (e) {}

  try {
    whatsappClient = await wppconnect.create({
      session: 'hf-session',
      catchQR: (base64, ascii) => {
        lastQR = { base64, ascii };
        statusMsg = 'Waiting for scan';
        log('QR generated');
      },
      statusFind: (status) => {
        statusMsg = status;
        log('Status Change: ' + status);
        if (status === 'inChat') { isReady = true; lastQR = null; }
      },
      headless: true,
      useChrome: false,
      puppeteerOptions: {
        executablePath: '/usr/bin/chromium',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          `--host-resolver-rules=MAP web.whatsapp.com ${waIP}`,
        ],
      },
      autoClose: 0,
      updatesLog: false,
      waitForLogin: false,
    });
    log('Client Created');
  } catch (e: any) {
    log('Init Error: ' + e.message);
    statusMsg = 'Error: ' + e.message;
  } finally {
    isInitializing = false;
  }
}

app.listen(port, () => {
  log(`Node Backend started on port ${port}`);
  // Initial start after 5 seconds
  setTimeout(startWPP, 5000);
});
