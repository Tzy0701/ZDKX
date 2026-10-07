/* Optional browser check: run while npm start is serving http://127.0.0.1:9123. */
const assert = require('assert');
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const WebSocket = require('ws');

const base = process.env.BB_SMOKE_URL || 'http://127.0.0.1:9123/';
const port = 9300 + Math.floor(Math.random() * 500);
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'bb-browser-'));
const chrome = spawn('chromium', ['--headless', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage',
  '--remote-allow-origins=*', '--remote-debugging-port=' + port, '--user-data-dir=' + profile, 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
let browserDiagnostics = async () => {};
function get(url) { return new Promise((resolve, reject) => { const req = http.get(url, r => {
  let body = ''; r.on('data', chunk => { body += chunk; }); r.on('end', () => resolve(JSON.parse(body)));
}).on('error', reject); req.setTimeout(1000, () => req.destroy(new Error('CDP request timed out'))); }); }
async function waitFor(check, timeout = 20000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) { const result = await check(); if (result) return result; await sleep(60); }
  throw new Error('browser wait timed out');
}
(async () => {
  await waitFor(async () => { try { return await get('http://127.0.0.1:' + port + '/json'); } catch (_) { return null; } });
  const targets = await get('http://127.0.0.1:' + port + '/json');
  const tab = targets.find(t => t.type === 'page');
  assert(tab, 'Chromium has no page target');
  const ws = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.once('open', resolve); ws.once('error', reject); });
  let nextId = 1;
  const pending = new Map(), exceptions = [], networkErrors = [];
  ws.on('message', raw => {
    const m = JSON.parse(raw);
    if (m.method === 'Runtime.exceptionThrown') exceptions.push(m.params.exceptionDetails.text);
    if (m.method === 'Network.webSocketFrameError') networkErrors.push(m.params.errorMessage);
    if (m.method === 'Network.loadingFailed') networkErrors.push(m.params.errorText);
    if (m.method === 'Network.webSocketHandshakeResponseReceived') networkErrors.push('WS HTTP status ' + m.params.response.status);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  });
  function send(method, params = {}) { return new Promise((resolve, reject) => {
    const id = nextId++;
    pending.set(id, m => m.error ? reject(new Error(m.error.message)) : resolve(m.result));
    ws.send(JSON.stringify({ id, method, params }));
  }); }
  async function evaluate(expression) {
    const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
    return result.result.value;
  }
  browserDiagnostics = async () => {
    console.error('Browser status:', await evaluate("JSON.stringify({url:location.href,title:document.title,ready:document.readyState,hostButton:!!document.querySelector('#btn-host'),note:document.querySelector('#netnote')?.textContent,toast:document.querySelector('#toast')?.textContent,bodyPrefix:document.body?.innerText.slice(0,240)})"));
    console.error('Runtime exceptions:', exceptions);
    console.error('Network:', networkErrors);
  };
  await send('Runtime.enable');
  await send('Page.enable');
  await send('Network.enable');
  await send('Page.navigate', { url: base });
  await waitFor(() => evaluate("!!document.querySelector('#btn-host') && !document.querySelector('#btn-host').disabled && document.querySelector('#netnote')?.textContent.includes('联机通道')"));
  await evaluate("document.querySelector('#nm').value='Smoke Host';document.querySelector('#btn-host').click();");
  await waitFor(() => evaluate("!document.querySelector('#scr-lobby').hidden && !!document.querySelector('[data-act=addbot]')"));
  await evaluate("document.querySelector('[data-act=addbot]').click()");
  await waitFor(() => evaluate("document.querySelectorAll('#scr-lobby .seat').length === 2"));
  await evaluate("const select=document.querySelector('#msel');select.value='4';select.dispatchEvent(new Event('change',{bubbles:true}));");
  await waitFor(() => evaluate("document.querySelector('#msel')?.value === '4'"));
  await evaluate("document.querySelector('[data-act=start]').click()");
  await waitFor(() => evaluate("!document.querySelector('#scr-game').hidden && document.querySelectorAll('.room.physical .card3').length === 2"));
  await evaluate("document.querySelector('#chatin').value='3D setup chat';document.querySelector('#chatf button').click()");
  await waitFor(() => evaluate("document.querySelector('#g-chat').textContent.includes('Smoke Host：3D setup chat')"));
  await evaluate("document.querySelector('#scr-game [data-act=view]').click()");
  await waitFor(() => evaluate("document.querySelectorAll('#scr-game .equips .eq').length === 2"));
  assert(await evaluate("document.querySelector('#scr-game').textContent.includes('第 2 次失误引爆')"));
  await evaluate("document.querySelector('#scr-game .mine-zone .tile.k-b:not(.cut)').click()");
  await waitFor(() => evaluate("document.querySelector('#scr-game .turnline')?.textContent.includes('第 1 回合')"));
  await evaluate("document.querySelector('#chatin').value='2D play chat';document.querySelector('#chatin').focus()");
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', text: '\r', unmodifiedText: '\r', windowsVirtualKeyCode: 13 });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
  await waitFor(() => evaluate("document.querySelector('#g-chat').textContent.includes('Smoke Host：2D play chat')"));
  await send('Emulation.setDeviceMetricsOverride', { width: 375, height: 800, deviceScaleFactor: 1, mobile: true });
  assert(await evaluate("document.querySelectorAll('#scr-game .equips .eq').length === 2"));
  await send('Page.reload', { ignoreCache: true });
  await waitFor(() => evaluate("!!document.querySelector('[data-act=rejoin]')"));
  await evaluate("document.querySelector('[data-act=rejoin]').click()");
  await waitFor(() => evaluate("!document.querySelector('#scr-game').hidden && document.querySelectorAll('#scr-game .equips .eq').length === 2"));
  await evaluate("document.querySelector('#chatin').value='Mobile reconnect chat';document.querySelector('#chatf button').click()");
  await waitFor(() => evaluate("document.querySelector('#g-chat').textContent.includes('Smoke Host：Mobile reconnect chat')"));
  assert.deepStrictEqual(exceptions, []);
  console.log('✓ Chromium lobby, mission 4, 3D/2D cards, setup, mobile, reconnect and chat via Send/Enter');
  ws.close();
})().catch(async e => { console.error(e); await browserDiagnostics(); process.exitCode = 1; }).finally(async () => {
  chrome.kill('SIGTERM');
  await sleep(200);
  fs.rmSync(profile, { recursive: true, force: true });
});
