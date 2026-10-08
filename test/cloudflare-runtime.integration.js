// 真正的 workerd + SQLite 存档，跨进程重启；只运行本地模拟器。
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const { Client, freePort, finishOwnMission } = require('./multiplayer.integration');
const root = path.resolve(__dirname, '..');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function main() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bb-cloud-runtime-'));
  const port = await freePort(), endpoint = 'http://127.0.0.1:' + port;
  let child, clients = [], log = '';
  async function start() {
    log = '';
    child = spawn('npx', ['--yes', 'wrangler@4.148.0', 'dev', '--config', 'cloudflare/worker/wrangler.toml',
      '--ip', '127.0.0.1', '--port', String(port), '--persist-to', dir, '--show-interactive-dev-session=false'], {
      cwd: root, detached: true,
      env: { ...process.env, WRANGLER_LOG_PATH: path.join(dir, 'wrangler.log'), WRANGLER_SEND_METRICS: 'false' },
      stdio: ['ignore', 'pipe', 'pipe']
    });
    child.stdout.on('data', b => { log += b; }); child.stderr.on('data', b => { log += b; });
    for (let i = 0; i < 300; i++) {
      if (child.exitCode !== null) throw Error(log);
      try { const response = await fetch(endpoint + '/healthz'); if (response.ok) return; } catch (_) {}
      await sleep(100);
    }
    throw Error('模拟器启动失败：' + log);
  }
  async function stop() {
    if (!child) return;
    const stopped = new Promise(resolve => child.once('exit', resolve));
    try { process.kill(-child.pid, 'SIGTERM'); } catch (_) {}
    await stopped; child = null;
  }
  function view(seat, rev) { return seat.client.wait(m => m.topic === 'official:view' && m.data.revision === rev).then(m => m.data.view); }
  async function action(seat, host, current, commandId, action) {
    const next = host.client.nextViewAfter(current.revision);
    seat.client.say('official:act', { gid: current.view.gid, revision: current.revision, commandId, action });
    return (await next).data;
  }
  try {
    await start();
    assert.equal((await fetch(endpoint + '/ws')).status, 400);
    assert.equal((await fetch(endpoint + '/ws?room=bb-test')).status, 426);
    for (let n = 2; n <= 5; n++) {
      const code = 'restart-' + n + '-' + Date.now().toString(36);
      let seats = [];
      for (let i = 0; i < n; i++) seats.push(await Client.connect(endpoint, code, i, undefined, 'campaign'));
      clients = seats;
      let host = seats[0];
      const lobby = (await host.client.wait(m => m.topic === 'official:lobby' && m.data.seats.length === n)).data;
      let next = host.client.nextViewAfter(lobby.revision);
      host.client.say('official:start', { mid: 1, revision: lobby.revision, commandId: 'start' });
      let current = (await next).data;
      for (let pi = 0; pi < n; pi++) {
        const V = await view(seats[pi], current.revision), wire = V.players[pi].stands.flat().find(w => Number.isInteger(w.v));
        current = await action(seats[pi], host, current, 'info-' + pi, { a: 'info', w: wire.id });
      }
      assert.equal(current.view.phase, 'play');
      const views = await Promise.all(seats.map(s => view(s, current.revision)));
      let pair;
      for (const own of views[0].players[0].stands.flat()) {
        for (let pi = 1; pi < n && !pair; pi++) {
          const target = views[pi].players[pi].stands.flat().find(w => w.v === own.v);
          if (target) pair = { own, target, pi };
        }
        if (pair) break;
      }
      assert(pair);
      current = await action(host, host, current, 'dual', { a: 'dual', w: pair.target.id, val: pair.own.v });
      const id = current.view.pending.id, gid = current.view.gid;
      const identities = seats.map(s => s.identity);
      async function restartAndRestore(step) {
        seats.forEach(s => s.client.close()); await sleep(150);
        await stop(); await start();
        seats = [];
        for (let i = 0; i < n; i++) seats.push(await Client.connect(endpoint, code, i, identities[i].credential, 'campaign'));
        clients = seats; host = seats[0];
        current = (await host.client.wait(m => m.topic === 'official:view' && m.data.view.pending?.step === step)).data;
        assert.equal(current.view.gid, gid); assert.equal(current.view.pending.id, id);
        for (let i = 0; i < n; i++) assert.equal(seats[i].identity.pid, identities[i].pid);
      }
      await restartAndRestore('target');
      assert((await view(seats[pair.pi], current.revision)).pending.choices);
      assert(!current.view.pending.choices);
      current = await action(seats[pair.pi], host, current, 'target', { a: 'resolve', id, w: pair.target.id });
      await restartAndRestore('own');
      assert(current.view.pending.choices);
      const resolve = { gid, revision: current.revision, commandId: 'own', action: { a: 'resolve', id, w: pair.own.id } };
      next = host.client.nextViewAfter(current.revision); host.client.say('official:act', resolve); current = (await next).data;
      assert.equal(current.view.pending, null);
      const oldMessages = new Set(host.client.messages);
      const duplicate = host.client.wait(m => !oldMessages.has(m) && m.topic === 'official:view' && m.data.revision === current.revision);
      host.client.say('official:act', resolve); await duplicate;
      await finishOwnMission(host); seats.forEach(s => s.client.close()); clients = [];
      console.log('✓ ' + n + ' 人真实 Worker：SQLite 持久化、目标／本人阶段进程重启、私人选项、座位凭证、重复回应');
    }
  } finally {
    clients.forEach(s => s.client.close());
    await stop(); fs.rmSync(dir, { recursive: true, force: true });
  }
}
main().catch(e => { console.error(e.stack || e); process.exitCode = 1; });
