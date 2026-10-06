// Tanvi v32.1 — WebSocket Relay Server (Node.js) + Embedded Mobile Dashboard
const { WebSocketServer } = require('ws');
const http = require('http');

const PORT = process.env.PORT || 3000;
let esp = null;
const clients = new Set();

const DASHBOARD = `<!DOCTYPE html>
<html lang="hi"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<title>TANVI v32.1 — Master Intercom & PA</title>
<style>
*{box-sizing:border-box;-webkit-tap-highlight-color:transparent;font-family:Segoe UI,Roboto,sans-serif}
body{margin:0;background:#0d1117;color:#e6edf3;padding:10px;max-width:480px;margin:0 auto}
h2{margin:6px 0;text-align:center;font-size:1.15rem;color:#58a6ff}
.sub{text-align:center;font-size:.7rem;color:#8b949e;margin-bottom:10px}
.card{background:#161b22;border:1px solid #30363d;border-radius:12px;padding:12px;margin-bottom:12px}
.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}
.grid2{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:8px}
button{border:none;border-radius:10px;padding:14px 0;font-size:1rem;font-weight:600;color:#fff;background:#21262d;border:1px solid #30363d;cursor:pointer}
button:active{transform:scale(.95)}
.cls.on{background:#1f6feb;border-color:#388bfd}
.grp{background:#8957e5}.grp.on{background:#6e40c9;border-color:#a371f7}
.allon{background:#238636}.alloff{background:#da3633}
.status{font-size:.8rem;text-align:center;padding:8px;background:#0d1117;border-radius:8px;border:1px solid #30363d;margin-bottom:10px;word-break:break-all}
.ptt{width:100%;padding:26px;font-size:1.3rem;background:#da3633;border:2px solid #f85149;border-radius:14px}
.ptt.on{background:#f85149;box-shadow:0 0 18px #f85149}
.aux{width:100%;padding:10px;background:#1f6feb;margin-top:8px;font-size:.85rem}
.dot{display:inline-block;width:8px;height:8px;border-radius:50%;background:#da3633;margin-right:6px}
.dot.on{background:#3fb950}
</style></head><body>
<h2>TANVI v32.1 — Intercom & PA</h2>
<div class="sub">3-Way Master Hybrid System • ESP32-S3 • Remote Mode</div>
<div class="status"><span class="dot" id="dot"></span><span id="stxt">कनेक्ट हो रहा है...</span></div>
<div class="card">
<div class="grid" id="clsGrid"></div>
<div class="grid2">
<button class="grp" data-k="GROUP:B">GROUP B</button>
<button class="grp" data-k="GROUP:C">GROUP C</button>
<button class="grp" data-k="GROUP:D">GROUP D</button>
</div>
<div class="grid2">
<button class="allon" data-k="CMD:ALL_ON">ALL ON (A)</button>
<button class="alloff" data-k="CMD:ALL_OFF">ALL OFF (*)</button>
<button data-k="CMD:STATUS" style="background:#30363d">REFRESH</button>
</div></div>
<div class="card">
<button class="ptt" id="pttBtn">🎤 PUSH TO TALK</button>
<button class="aux" id="audBtn">🔊 Classroom Audio Feed चालू करें</button>
</div>
<script>
var ws, ctx, nextTime = 0, pttOn = false, mediaStream, recCtx, processor;
function connect(){
  ws = new WebSocket('wss://' + location.host + '/');
  ws.binaryType = 'arraybuffer';
  ws.onopen  = function(){ document.getElementById('dot').className='dot on'; ws.send('CMD:STATUS'); };
  ws.onclose = function(){ document.getElementById('dot').className='dot'; setTimeout(connect, 2000); };
  ws.onmessage = function(e){
    if (typeof e.data === 'string') { renderStatus(JSON.parse(e.data)); }
    else { playChunk(new Int16Array(e.data)); }
  };
}
function sendCmd(k){ if(ws && ws.readyState===1) ws.send(k); }
function renderStatus(s){
  document.getElementById('stxt').textContent = s.text + (s.ptt ? ' • PTT LIVE' : '');
  var cb = document.querySelectorAll('.cls');
  for (var i=0;i<cb.length;i++){ cb[i].classList.toggle('on', parseInt(cb[i].dataset.n) === s.cls); }
  var gb = document.querySelectorAll('.grp');
  for (var j=0;j<gb.length;j++){ gb[j].classList.toggle('on', gb[j].dataset.k === 'GROUP:'+s.grp); }
  document.querySelector('.allon').classList.toggle('on', !!s.allOn);
}
function ensureCtx(){ if(!ctx){ ctx = new (window.AudioContext||window.webkitAudioContext)({sampleRate:16000}); } if(ctx.state==='suspended') ctx.resume(); }
function playChunk(i16){
  if(!ctx) return;
  var f = new Float32Array(i16.length);
  for(var i=0;i<i16.length;i++) f[i] = i16[i] / 32768;
  var b = ctx.createBuffer(1, i16.length, 16000);
  b.copyToChannel(f, 0);
  var src = ctx.createBufferSource(); src.buffer = b;
  src.connect(ctx.destination);
  if(nextTime < ctx.currentTime) nextTime = ctx.currentTime + 0.08;
  src.start(nextTime); nextTime += b.duration;
}
async function startPtt(){
  try{
    ensureCtx();
    mediaStream = await navigator.mediaDevices.getUserMedia({audio:true});
    recCtx = new (window.AudioContext||window.webkitAudioContext)({sampleRate:16000});
    var src = recCtx.createMediaStreamSource(mediaStream);
    processor = recCtx.createScriptProcessor(2048, 1, 1);
    src.connect(processor); processor.connect(recCtx.destination);
    processor.onaudioprocess = function(ev){
      var d = ev.inputBuffer.getChannelData(0);
      var i16 = new Int16Array(d.length);
      for(var i=0;i<d.length;i++){ var v = Math.max(-1, Math.min(1, d[i])); i16[i] = v*32767; }
      if(ws && ws.readyState===1) ws.send(i16.buffer);
    };
    sendCmd('PTT:1'); pttOn = true;
    document.getElementById('pttBtn').className = 'ptt on';
  }catch(err){ alert('Mic permission denied: ' + err); }
}
function stopPtt(){
  if(!pttOn) return; pttOn = false;
  sendCmd('PTT:0');
  if(processor){ processor.disconnect(); processor = null; }
  if(mediaStream){ mediaStream.getTracks().forEach(function(t){t.stop();}); mediaStream = null; }
  if(recCtx){ recCtx.close(); recCtx = null; }
  document.getElementById('pttBtn').className = 'ptt';
}
var grid = document.getElementById('clsGrid');
for(var n=1;n<=16;n++){
  var b = document.createElement('button');
  b.className = 'cls'; b.textContent = n; b.dataset.n = n; b.dataset.k = 'KEY:' + n;
  grid.appendChild(b);
}
document.body.addEventListener('click', function(e){
  var k = e.target.dataset && e.target.dataset.k;
  if(k) sendCmd(k);
});
var ptt = document.getElementById('pttBtn');
ptt.addEventListener('touchstart', function(e){ e.preventDefault(); if(!pttOn) startPtt(); }, {passive:false});
ptt.addEventListener('touchend',   function(e){ e.preventDefault(); stopPtt(); }, {passive:false});
ptt.addEventListener('mousedown',  function(){ if(!pttOn) startPtt(); });
ptt.addEventListener('mouseup',    stopPtt);
ptt.addEventListener('mouseleave', stopPtt);
document.getElementById('audBtn').addEventListener('click', ensureCtx);
connect();
</script></body></html>`;

const server = http.createServer((req, res) => {
  if (req.url === '/ping') { res.writeHead(200); res.end('ok'); return; }
  res.writeHead(200, {'Content-Type': 'text/html; charset=utf-8'});
  res.end(DASHBOARD);
});

const wss = new WebSocketServer({ server });

wss.on('connection', (ws, req) => {
  const path = req.url;
  console.log('Connected:', path);
  if (path === '/esp') {
    if (esp) { try { esp.close(); } catch(e){} }
    esp = ws;
    console.log('ESP32 ONLINE');
  } else {
    clients.add(ws);
    console.log('Mobile client joined. Total:', clients.size);
  }
  ws.on('message', (data, isBinary) => {
    if (path === '/esp') {
      for (const c of clients) { if (c.readyState === 1) c.send(data, { binary: isBinary }); }
    } else {
      if (esp && esp.readyState === 1) esp.send(data, { binary: isBinary });
    }
  });
  ws.on('close', () => {
    clients.delete(ws);
    if (ws === esp) { esp = null; console.log('ESP32 OFFLINE'); }
  });
  ws.on('error', (e) => console.log('WS error:', e.message));
});

server.listen(PORT, () => console.log('Tanvi Relay + Dashboard on port', PORT));
