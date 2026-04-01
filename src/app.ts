import express from 'express';
import * as wppconnect from './index';

const app = express();
const port = process.env.PORT || 7860;
let whatsappClient: wppconnect.Whatsapp | null = null;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Mandatory Health Check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'UP', message: 'WPPConnect API is ready' });
});

// Mandatory API Docs
app.get('/api-docs', (req, res) => {
  res.status(200).json({
    message: 'WPPConnect API Documentation',
    endpoints: {
      '/health': 'Health check endpoint',
      '/api-docs': 'API documentation',
      '/send-message': 'POST: Send a text message (telnumber, message)',
      '/send-poll': 'POST: Send a poll message (telnumber, name, choices)',
      '/get-connection-status': 'GET: Get the current WhatsApp connection status',
    },
  });
});

app.get('/get-connection-status', async (req, res) => {
  if (whatsappClient) {
    try {
      const state = await whatsappClient.getConnectionState();
      res.json({ status: true, message: state });
    } catch (error) {
      res.status(500).json({ status: false, message: error.message });
    }
  } else {
    res.status(503).json({ status: false, message: 'WhatsApp instance not initialized' });
  }
});

app.post('/send-message', async (req, res) => {
  const { telnumber, message } = req.body;
  if (!whatsappClient) {
    return res.status(503).json({ status: false, message: 'WhatsApp instance not initialized' });
  }
  try {
    const result = await whatsappClient.sendText(`${telnumber}@c.us`, message);
    res.json({ status: true, message: 'Message sent', result });
  } catch (error) {
    res.status(500).json({ status: false, message: error.message });
  }
});

app.post('/send-poll', async (req, res) => {
  const { telnumber, name, choices } = req.body;
  if (!whatsappClient) {
    return res.status(503).json({ status: false, message: 'WhatsApp instance not initialized' });
  }
  try {
    const result = await whatsappClient.sendPollMessage(`${telnumber}@c.us`, name, choices);
    res.json({ status: true, message: 'Poll sent', result });
  } catch (error) {
    res.status(500).json({ status: false, message: error.message });
  }
});

// Start WPPConnect
async function startWPP() {
  try {
    whatsappClient = await wppconnect.create({
      session: 'hf-space-session',
      catchQR: (base64Qr, asciiQR) => {
        console.log('QR Code generated. Please scan to log in.');
        console.log(asciiQR);
      },
      statusFind: (statusSession, session) => {
        console.log('Status Session: ', statusSession, 'Session: ', session);
      },
      headless: true,
      useChrome: false, // Use the Chromium installed in the Docker image
      puppeteerOptions: {
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium',
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      },
      logQR: true,
      tokenStore: 'file',
      folderNameToken: './tokens',
    });
    console.log('WPPConnect initialized and logged in.');
  } catch (error) {
    console.error('Error starting WPPConnect:', error);
  }
}

app.listen(port, () => {
  console.log(`Server started on port ${port}`);
  startWPP();
});
