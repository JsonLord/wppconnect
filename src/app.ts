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
  if (appLogs.length > 500) appLogs.shift();
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
  if (whatsappClient && whatsappClient.page && !whatsappClient.page.isClosed()) {
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

app.post('/clear-session', (req, res) => {
  log('Manual session clear');
  try {
    const tokensDir = path.join(process.cwd(), 'tokens');
    if (fs.existsSync(tokensDir)) fs.rmSync(tokensDir, { recursive: true, force: true });
    whatsappClient = null;
    isReady = false;
    lastQR = null;
    statusMsg = 'Cleared';
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/send-poll', async (req, res) => {
  const { telnumber, name, choices } = req.body;
  if (!whatsappClient || !isReady) return res.status(503).json({ error: 'WhatsApp not ready' });
  try {
    const result = await whatsappClient.sendPollMessage(`${telnumber}@c.us`, name, choices);
    res.json({ success: true, result });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

async function resolveMany(hosts: string[]): Promise<string[]> {
  const resolver = new Resolver();
  resolver.setServers(['8.8.8.8', '1.1.1.1']);
  const rules: string[] = [];
  for (const host of hosts) {
    try {
      const addrs = await new Promise<string[]>((resolve, reject) => {
        resolver.resolve4(host, (err, addresses) => err ? reject(err) : resolve(addresses));
      });
      if (addrs.length > 0) {
        rules.push(`MAP ${host} ${addrs[0]}`);
      }
    } catch (e) {}
  }
  return rules;
}

async function startWPP() {
  if (isInitializing) return;
  isInitializing = true;
  statusMsg = 'Initializing...';
  log('Starting initialization...');

  const dnsRules = await resolveMany([
    'web.whatsapp.com',
    'static.whatsapp.net',
    'pps.whatsapp.net',
    'mms.whatsapp.net'
  ]);

  const hostRules = dnsRules.join(',');
  if (hostRules) log(`Host Rules: ${hostRules}`);

  try {
    whatsappClient = await wppconnect.create({
      session: 'hf-session',
      catchQR: (base64, ascii) => {
        lastQR = { base64, ascii };
        statusMsg = 'Waiting for scan';
        log('QR code updated');
      },
      statusFind: (status) => {
        statusMsg = status;
        log('Status: ' + status);
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
          '--disable-web-security',
          hostRules ? `--host-resolver-rules=${hostRules}` : ''
        ].filter(Boolean),
      },
      autoClose: 0,
      updatesLog: false,
      waitForLogin: false,
    });

    if (whatsappClient.page) {
      whatsappClient.page.on('console', msg => {
          const text = msg.text();
          if (!text.includes('TypeError: window.WAPI') && !text.includes('WAPI is not defined')) {
             log(`Browser: ${text}`);
          }
      });
    }

    log('Client Object Created');
  } catch (e: any) {
    log('Init Error: ' + e.message);
    statusMsg = 'Error: ' + e.message;
  } finally {
    isInitializing = false;
  }
}

app.listen(port, () => {
  log(`Node Backend on port ${port}`);
  setTimeout(startWPP, 5000);
});
