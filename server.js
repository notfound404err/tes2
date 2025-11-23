import express from 'express';
import axios from 'axios';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;
const PORT = process.env.PORT || 3000;

if (!BOT_TOKEN || !CHAT_ID) {
  console.warn('Warning: BOT_TOKEN and CHAT_ID must be set in environment');
}

function getClientIp(req) {
  const xff = req.headers['x-forwarded-for'];
  if (xff) return xff.split(',')[0].trim();
  if (req.socket && req.socket.remoteAddress) return req.socket.remoteAddress;
  return 'unknown';
}

// HTML escape helper function to prevent invalid HTML in Telegram messages
function escapeHtml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/"/g, '"')
    .replace(/'/g, '&#39;');
}

app.post('/send-message', async (req, res) => {
  const { message, anonymous } = req.body || {};
  if (anonymous) {
    console.log('Incoming /send-message (anonymous)', { body: { message: message ? '[REDACTED]' : message, anonymous } });
  } else {
    console.log('Incoming /send-message', { headers: req.headers, body: req.body });
  }
  if (!message) return res.status(400).json({ ok: false, error: 'message required' });

  try {
    const ip = getClientIp(req);
    const escapedIp = escapeHtml(ip);

    const now = new Date();
    const timestampLocal = now.toLocaleString();
    const timeOnly = now.toLocaleTimeString('en-GB', { hour12: false });
    const escapedTimestampLocal = escapeHtml(timestampLocal);
    const escapedTimeOnly = escapeHtml(timeOnly);

    const userAgent = req.headers['user-agent'] || 'unknown';
    const escapedUserAgent = escapeHtml(userAgent);

    function extractDeviceModel(ua) {
      if (!ua || ua === 'unknown') return 'unknown';
      const androidMatch = ua.match(/Android[^;]*;[^;]*;\s*([^;\)]+?)\s*Build/i);
      if (androidMatch && androidMatch[1]) return androidMatch[1].trim();
      const smMatch = ua.match(/\b([A-Z0-9\-]{3,})\b/);
      if (smMatch && smMatch[1]) return smMatch[1];
      if (/iPhone|iPad/i.test(ua)) return ua.match(/iPhone|iPad/i)[0];
      return 'unknown';
    }

    const deviceModel = extractDeviceModel(userAgent);
    const escapedDeviceModel = escapeHtml(deviceModel);

    const escapedMessage = escapeHtml(message);

    let text;
    if (anonymous) {
      text = 'Anonymous message from your web:\n\n' + escapedMessage + '\n\n—\nDate: ' + escapedTimestampLocal + '\nTime: ' + escapedTimeOnly;
    } else {
      text = 'Secret message from your web:\n\n' + escapedMessage + '\n\n—\nDate: ' + escapedTimestampLocal + '\nTime: ' + escapedTimeOnly + '\nIP: ' + escapedIp + '\nDevice: ' + escapedDeviceModel + '\nUser-Agent: ' + escapedUserAgent;
    }

    if (!BOT_TOKEN || !CHAT_ID) {
      return res.status(500).json({ ok: false, error: 'server not configured with BOT_TOKEN/CHAT_ID' });
    }

    const url = 'https://api.telegram.org/bot' + BOT_TOKEN + '/sendMessage';
    try {
      const telegramResp = await axios.post(url, {
        chat_id: CHAT_ID,
        text,
        parse_mode: 'HTML'
      });

      console.log('Message forwarded to Telegram', {
        chat_id: CHAT_ID,
        timestamp: timestampLocal,
        ip,
        telegram_ok: telegramResp?.data?.ok
      });

      return res.json({ ok: true });
    } catch (err) {
      console.error('send-message error full', {
        message: err?.message,
        stack: err?.stack,
        responseData: err?.response?.data,
        responseStatus: err?.response?.status,
      });
      return res.status(500).json({ ok: false, error: 'failed to send' });
    }
  } catch (err) {
    console.error('unexpected error in /send-message', err?.stack || err);
    return res.status(500).json({ ok: false, error: 'failed to send' });
  }
});

// simple status page so visiting http://localhost:PORT shows something useful
app.get('/', (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(`
    <html>
      <head><title>Telegram Relay</title></head>
      <body style="font-family:system-ui,Segoe UI,Roboto,Arial;margin:2rem;color:#222">
        <h1>Telegram Relay Server</h1>
        <p>This server receives POST <code>/send-message</code> and forwards messages to your Telegram bot.</p>
        <p>POST example (JSON): <code>{ "message": "Hello" }</code></p>
        <p>Bot: <strong>${process.env.BOT_TOKEN ? 'configured' : 'not configured'}</strong></p>
        <p>Chat target: <strong>${process.env.CHAT_ID || 'not configured'}</strong></p>
      </body>
    </html>
  `);
});

app.listen(PORT, () => {
  console.log(`Telegram relay server listening on http://localhost:${PORT}`);
});
