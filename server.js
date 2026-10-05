// Tanvi v32.1 — WebSocket Relay Server (Node.js)
// काम: ESP32 (/esp) और मोबाइल ब्राउज़र के बीच हर मैसेज/ऑडियो पास करना
const { WebSocketServer } = require('ws');
const http = require('http');

const PORT = process.env.PORT || 3000;
let esp = null;                    // ESP32 का कनेक्शन (सिर्फ 1)
const clients = new Set();         // मोबाइल ब्राउज़र

const server = http.createServer((req, res) => {
  if (req.url === '/ping') {       // Render को जगाए रखने के लिए
    res.writeHead(200); res.end('ok');
    return;
  }
  res.writeHead(200, {'Content-Type': 'text/plain'});
  res.end('Tanvi Relay is running');
});

const wss = new WebSocketServer({ server });

wss.on('connection', (ws, req) => {
  const path = req.url;
  console.log('Connected:', path);

  if (path === '/esp') {
    if (esp) { try { esp.close(); } catch(e){} }  // पुराना ESP कनेक्शन हटाएँ
    esp = ws;
    console.log('ESP32 ONLINE');
  } else {
    clients.add(ws);
    console.log('Mobile client joined. Total:', clients.size);
  }

  ws.on('message', (data, isBinary) => {
    if (path === '/esp') {
      // ESP32 से आया -> सभी मोबाइल को भेजो (कमांड + CCTV ऑडियो दोनों)
      for (const c of clients) {
        if (c.readyState === 1) c.send(data, { binary: isBinary });
      }
    } else {
      // मोबाइल से आया -> ESP32 को भेजो (KEY:, PTT:, PCM ऑडियो)
      if (esp && esp.readyState === 1) esp.send(data, { binary: isBinary });
    }
  });

  ws.on('close', () => {
    clients.delete(ws);
    if (ws === esp) { esp = null; console.log('ESP32 OFFLINE'); }
    console.log('Disconnected:', path);
  });

  ws.on('error', (e) => console.log('WS error:', e.message));
});

server.listen(PORT, () => console.log('Tanvi Relay on port', PORT));
