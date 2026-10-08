/* Real-browser spectator checks. Starts an isolated local npm server and three Chromium profiles. */
const assert = require('assert');
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const WebSocket = require('ws');

const root = path.resolve(__dirname, '..');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const port = 18000 + Math.floor(Math.random() * 10000);
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bb-spectator-data-'));
const server = spawn(process.execPath, ['server/server.js'], { cwd: root, env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', BB_DATA_DIR: dataDir }, stdio: ['ignore', 'pipe', 'pipe'] });
let serverOutput = '';
server.stdout.on('data', b => { serverOutput += b; });
server.stderr.on('data', b => { serverOutput += b; });
const profiles = [];
const browsers = [];

function request(url) {
  return new Promise((resolve, reject) => http.get(url, response => {
    let body = ''; response.on('data', chunk => { body += chunk; });
    response.on('end', () => resolve({ status: response.statusCode, body }));
  }).on('error', reject));
}
async function waitFor(check, label, timeout = 20000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) { try { const result = await check(); if (result) return result; } catch (_) {} await sleep(80); }
  throw new Error('Timed out waiting for ' + label);
}
async function launch(label, cdpPort) {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'bb-spectator-' + label + '-'));
  profiles.push(profile);
  const proc = spawn('/snap/bin/chromium', ['--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage',
    '--remote-allow-origins=*', '--remote-debugging-port=' + cdpPort, '--user-data-dir=' + profile, 'about:blank'], { stdio: 'ignore' });
  browsers.push(proc);
  const targetsUrl = 'http://127.0.0.1:' + cdpPort + '/json';
  const targets = await waitFor(async () => { try { return (await request(targetsUrl)).body; } catch (_) { return null; } }, label + ' Chromium CDP', 15000);
  const target = JSON.parse(targets).find(t => t.type === 'page');
  assert(target, label + ' has a page target');
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.once('open', resolve); ws.once('error', reject); });
  let seq = 0;
  const pending = new Map(), exceptions = [];
  ws.on('message', raw => {
    const message = JSON.parse(raw);
    if (message.method === 'Runtime.exceptionThrown') exceptions.push(message.params.exceptionDetails.text);
    if (message.id && pending.has(message.id)) { const done = pending.get(message.id); pending.delete(message.id); message.error ? done.reject(new Error(message.error.message)) : done.resolve(message.result); }
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++seq; pending.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params }));
  });
  await send('Runtime.enable'); await send('Page.enable');
  const evaluate = async expression => {
    const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (result.result && result.result.type === 'error') throw new Error(result.result.description);
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception && result.exceptionDetails.exception.description || result.exceptionDetails.text);
    return result.result.value;
  };
  const wait = (expression, timeout) => waitFor(() => evaluate(expression), label + ': ' + expression, timeout);
  await send('Page.navigate', { url: 'http://127.0.0.1:' + port + '/' });
  await wait("!!document.querySelector('#btn-host') && !document.querySelector('#btn-host').disabled", 15000);
  return { label, proc, ws, send, evaluate, wait, exceptions };
}

(async () => {
  let A, B, C, D;
  try {
    const page = await waitFor(async () => { try { return await request('http://127.0.0.1:' + port + '/'); } catch (_) { return null; } }, 'isolated HTTP server');
    assert.strictEqual(page.status, 200, 'HTTP page status');
    assert(page.body.includes('id="btn-host"'), 'HTTP page contains game UI');
    const wsProbe = new WebSocket('ws://127.0.0.1:' + port + '/ws');
    await new Promise((resolve, reject) => { wsProbe.once('open', resolve); wsProbe.once('error', reject); });
    wsProbe.close();

    A = await launch('host-observer', port + 101);
    B = await launch('player-b', port + 102);
    C = await launch('player-c', port + 103);
    D = await launch('direct-observer', port + 104);
    await A.evaluate("document.querySelector('#nm').value='Host';document.querySelector('#btn-host').click()");
    await A.wait("!document.querySelector('#scr-lobby').hidden && !!document.querySelector('.code')");
    const code = await A.evaluate("document.querySelector('.code').textContent.trim()");
    async function join(client, name, seatCount, action = '#btn-join') {
      await client.wait("!!document.querySelector(" + JSON.stringify(action) + ") && !document.querySelector(" + JSON.stringify(action) + ").disabled");
      await client.evaluate("document.querySelector('#nm').value=" + JSON.stringify(name) + ";document.querySelector('#jcode').value=" + JSON.stringify(code) + ";document.querySelector(" + JSON.stringify(action) + ").click()");
      await client.wait("!document.querySelector('#scr-lobby').hidden && document.querySelectorAll('#scr-lobby .seat').length===" + seatCount);
    }
    await join(B, 'Player B', 2);
    await join(C, 'Player C', 3);
    await A.wait("document.querySelectorAll('#scr-lobby .seat').length===3");
    await A.evaluate("document.querySelector('[data-act=spectator-role]').click()");
    await A.wait("document.querySelector('#scr-lobby .spectator-lobby .tag')?.textContent.includes('观战') && document.querySelectorAll('#scr-lobby .seat').length===2");
    assert.strictEqual(await A.evaluate("!!document.querySelector('[data-act=spectator-role]') && !document.querySelector('[data-act=spectator-role]').disabled"), true, 'host observer retains lobby management affordance');
    await A.evaluate("document.querySelector('#msel').value='1';document.querySelector('#msel').dispatchEvent(new Event('change',{bubbles:true}));document.querySelector('[data-act=start]').click()");
    for (const client of [A, B, C]) await client.wait("!document.querySelector('#scr-game').hidden && !!document.querySelector('.turnline')", 30000);
    assert.strictEqual(await A.evaluate("document.querySelector('#scr-lobby').hidden"), true, 'lobby is hidden after game start');
    assert.strictEqual(await A.evaluate("document.querySelectorAll('#scr-game .seat3').length"), 2, 'observer sees both actual player racks in 3D');
    assert.strictEqual(await A.evaluate("document.querySelector('#chatin').disabled"), true, 'observer chat is disabled');
    assert.strictEqual(await A.evaluate("!document.querySelector('.actionPanel,.action-panel,.turn-notice')"), true, 'observer has no action panel or own-turn notice');
    assert.strictEqual(await A.evaluate("!!document.querySelector('[data-act=host-pause]') && !!document.querySelector('[data-act=host-quit]')"), true, 'host observer retains pause and quit controls');
    assert.strictEqual(await A.evaluate("document.querySelector('#g-main').dataset.mode"), '3d');
    await A.evaluate("document.querySelector('#g-main [data-act=view]').click()");
    await A.wait("document.querySelector('#g-main').dataset.mode==='2d'");
    assert.strictEqual(await A.evaluate("document.querySelectorAll('#g-main .table .pblock').length + document.querySelectorAll('#g-main .mine-zone .pblock').length"), 2, 'host observer shows both actual player blocks');

    const options = await A.evaluate("Array.from(document.querySelectorAll('#spectator-perspective option')).map(o=>({pid:o.value,name:o.textContent.trim()}))");
    const named = options.filter(o => o.pid && !o.name.includes('Host'));
    assert(named.length >= 2, 'spectator perspective lists both players: ' + JSON.stringify(options));
    const selected = await A.evaluate("Array.from(document.querySelectorAll('#spectator-perspective option')).filter(o=>o.value).map(o=>({pid:o.value,name:o.textContent.replace(/ 的手牌$/,'')}))");
    assert(selected.length >= 2, 'two selectable player perspectives');
    const bOpt = selected.find(o => o.name === 'Player B'), cOpt = selected.find(o => o.name === 'Player C');
    assert(bOpt && cOpt, 'both players have named perspectives');
    async function choosePerspective(pid) {
      await A.evaluate("(()=>{const s=document.querySelector('#spectator-perspective');s.value=" + JSON.stringify(pid) + ";s.dispatchEvent(new Event('change',{bubbles:true}))})()");
      await A.wait("document.querySelector('#spectator-perspective').value===" + JSON.stringify(pid));
      await sleep(250);
    }
    async function snapshot(client) {
      return client.evaluate("(()=>({mode:document.querySelector('#g-main').dataset.mode, mine:!!document.querySelector('#g-main .mine-zone,#g-main .seat3.me'), hand:Array.from(document.querySelectorAll('#g-main .mine-zone .tile:not(.cut) .tv, #g-main .seat3.me .slot:not(.cut) .fv')).map(e=>e.textContent.trim()).filter(Boolean), hiddenValues:Array.from(document.querySelectorAll('#g-main .table .pblock .tv, #g-main .seat3:not(.me) .slot .fv')).map(e=>e.textContent.trim()).filter(Boolean), forbidden:!!document.querySelector('#g-main .tile.can,#g-main .slot.can,.actionPanel,.action-panel,.turn-notice'), chatDisabled:document.querySelector('#chatin').disabled, scroll:document.documentElement.scrollWidth, client:document.documentElement.clientWidth}))()");
    }
    const viewChecks = [];
    for (const mode of ['2d', '3d']) {
      if (await A.evaluate("document.querySelector('#g-main').dataset.mode") !== mode) { await A.evaluate("document.querySelector('#g-main [data-act=view]').click()"); await A.wait("document.querySelector('#g-main').dataset.mode===" + JSON.stringify(mode)); }
      for (const option of [bOpt, cOpt, null]) {
        await choosePerspective(option ? option.pid : '');
        const state = await snapshot(A);
        assert.strictEqual(state.mode, mode);
        assert(state.mine === !!option, 'selected hand visibility follows perspective ' + mode + ' ' + (option ? option.name : 'public'));
        assert(option ? state.hand.length > 0 : state.hand.length === 0, 'only selected hand may expose values: ' + JSON.stringify(state));
        assert.strictEqual(state.hiddenValues.length, 0, 'unselected hands remain hidden: ' + JSON.stringify(state));
        assert.strictEqual(state.forbidden, false, 'observer controls/clickable values stay absent');
        assert.strictEqual(state.chatDisabled, true);
        viewChecks.push({ mode, perspective: option ? option.name : 'public', handValues: state.hand.length });
      }
      await A.send('Emulation.setDeviceMetricsOverride', { width: 375, height: 812, deviceScaleFactor: 1, mobile: true });
      for (const option of [bOpt, cOpt, null]) {
        await choosePerspective(option ? option.pid : '');
        const state = await snapshot(A);
        assert(state.scroll <= state.client + 1, 'no horizontal page overflow at 375px: ' + JSON.stringify(state));
        assert.strictEqual(state.mine, !!option);
        assert.strictEqual(state.hiddenValues.length, 0);
      }
      if (mode === '3d') {
        await choosePerspective(bOpt.pid);
        await A.evaluate("document.querySelector('#g-main .seat3.me').scrollIntoView({block:'center'})");
        await sleep(300);
        const shot = await A.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
        fs.writeFileSync('/tmp/bb-spectator-mobile.png', Buffer.from(shot.data, 'base64'));
      }
      viewChecks.push({ mode, viewport: 375, noHorizontalOverflow: true });
      await A.send('Emulation.clearDeviceMetricsOverride');
    }
    // Restore desktop 3D and B perspective, reload, then verify identity, perspective and host controls persist.
    if (await A.evaluate("document.querySelector('#g-main').dataset.mode") !== '3d') await A.evaluate("document.querySelector('#g-main [data-act=view]').click()");
    await choosePerspective(bOpt.pid);
    await A.send('Page.reload', { ignoreCache: true });
    await A.wait("!!document.querySelector('[data-act=rejoin]')", 15000);
    await A.evaluate("document.querySelector('[data-act=rejoin]').click()");
    await A.wait("!document.querySelector('#scr-game').hidden && document.querySelector('#spectator-perspective')?.value===" + JSON.stringify(bOpt.pid), 30000);
    assert.strictEqual(await A.evaluate("!!document.querySelector('[data-act=host-pause]')"), true, 'rejoined observer can still pause');
    await A.evaluate("document.querySelector('[data-act=host-pause]').click()");
    await A.wait("document.querySelector('.pause-notice')");
    await A.evaluate("document.querySelector('[data-act=host-pause]').click()");
    await A.wait("!document.querySelector('.pause-notice')");
    assert.strictEqual(await A.evaluate("!document.querySelector('#scr-game [data-act=spectator-role]')"), true, 'no midgame role switch control');

    // A fourth browser uses the direct-watch home button and must stay outside the player seats.
    await D.evaluate("document.querySelector('#nm').value='Direct watcher';document.querySelector('#jcode').value=" + JSON.stringify(code) + ";document.querySelector('#btn-spectate').click()");
    await D.wait("!document.querySelector('#scr-game').hidden && document.querySelector('#spectator-perspective')", 20000);
    assert.strictEqual(await D.evaluate("document.querySelector('#chatin').disabled"), true, 'direct watcher is a spectator');
    assert.strictEqual(await B.evaluate("document.querySelectorAll('#scr-lobby .seat').length"), 2, 'both actual players remain seated');

    // A player remains able to place a setup hand and chat after the observer has joined.
    await B.evaluate("document.querySelector('#g-main [data-act=view]').click()");
    await B.wait("document.querySelector('#g-main').dataset.mode==='2d'");
    const canTile = await B.wait("document.querySelector('#g-main .mine-zone .tile.can')");
    assert(canTile, 'player B has the first enabled setup action');
    await B.evaluate("document.querySelector('#g-main .mine-zone .tile.can').click()");
    await B.wait("document.querySelector('.turnline')?.textContent.includes('布置阶段')");
    assert.deepStrictEqual([A, B, C, D].flatMap(x => x.exceptions), [], 'no browser runtime exceptions');
    console.log(JSON.stringify({ result: 'PASS', http: page.status, websocket: '/ws accepted', room: code,
      lobbySeatsAfterObservers: 2, directWatchTakesSeat: false, views: viewChecks, persistedPerspective: bOpt.name,
      hostPauseAfterRejoin: true, playerSetupAction: 'available and performed', mobileScreenshot: '/tmp/bb-spectator-mobile.png', runtimeExceptions: [] }, null, 2));
  } finally {
    for (const client of [A, B, C, D]) if (client) { try { client.ws.close(); } catch (_) {} }
    for (const proc of browsers) { try { proc.kill('SIGTERM'); } catch (_) {} }
    try { server.kill('SIGTERM'); } catch (_) {}
    await sleep(300);
    for (const profile of profiles) fs.rmSync(profile, { recursive: true, force: true });
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
})().catch(error => { console.error(error.stack || error); console.error('Server output:', serverOutput); process.exitCode = 1; });
