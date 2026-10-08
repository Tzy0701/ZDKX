const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const BB = require('../js/engine');
const Bot = require('../js/bot');
const Missions = require('../js/missions');
const officialService = require('../server/official');

function game() {
  return BB.createGame(Missions.get('physical', 1), [
    { pid: 'p1', name: 'Host' }, { pid: 'p2', name: 'Guest' }
  ]);
}
function setupComplete(G) {
  for (let pi = 0; pi < 2; pi++) {
    const wire = G.wires.find(w => w.o === pi && !w.cut && BB.kindOf(w.v) === 'b' && !w.info);
    assert(wire);
    assert.strictEqual(BB.act(G, pi, { a: 'info', w: wire.id }), null);
  }
  assert.strictEqual(G.phase, 'play');
}

// Pausing in setup freezes the whole game. Pausing during a turn preserves
// the exact deadline remainder and pending choice across repeated requests.
{
  const G = game();
  const beforeSetup = JSON.stringify(G);
  assert.strictEqual(BB.setPaused(G, true, 1000), null);
  assert.strictEqual(G.phase, 'setup');
  assert.strictEqual(BB.act(G, 0, { a: 'info', w: G.wires[0].id }), '牌局已暂停');
  assert.strictEqual(JSON.stringify(G).replace('"paused":true', '"paused":false'), beforeSetup);
  assert.strictEqual(Bot.decide(G, 0), null);
  assert.strictEqual(BB.setPaused(G, false, 2000), null);

  setupComplete(G);
  const initialTime = 10000;
  G.deadline = initialTime + 5000;
  G.pending = { type: 'cut', id: 'decision-stable', from: 0, to: 1, step: 'target', ids: [0], vals: [1] };
  G.declaration = { player: 0, val: 1 };
  G.feedback = [{ n: 1, text: 'visible feedback' }];
  assert.strictEqual(BB.setPaused(G, true, initialTime + 1200), null);
  assert.strictEqual(G.pauseRemaining, 3800);
  assert.strictEqual(G.deadline, null);
  const paused = JSON.stringify(G);
  assert.strictEqual(BB.setPaused(G, true, initialTime + 3000), null);
  assert.strictEqual(JSON.stringify(G), paused, 'repeated pause must not reset stored time');
  for (const action of [{ a: 'timeout' }, { a: 'equip', n: 1 }, { a: 'resolve', id: 'decision-stable', w: 0 }]) {
    assert.strictEqual(BB.act(G, 0, action), '牌局已暂停');
    assert.strictEqual(JSON.stringify(G), paused, 'blocked actions must not mutate state');
  }
  assert.strictEqual(Bot.decide(G, 0), null);
  assert.strictEqual(BB.setPaused(G, false, initialTime + 9000), null);
  assert.strictEqual(G.deadline, initialTime + 9000 + 3800);
  assert.strictEqual(G.pauseRemaining, null);
  assert.strictEqual(G.pending.id, 'decision-stable');
  assert.deepStrictEqual(G.declaration, { player: 0, val: 1 });
  assert.strictEqual(G.feedback[0].text, 'visible feedback');
  const view = BB.view(G, 0);
  assert.strictEqual(view.paused, false);
  assert.strictEqual(view.pauseRemaining, null);
}

function peer(wss, room) {
  const ws = { room, readyState: 1, messages: [], send(raw) { this.messages.push(JSON.parse(raw)); } };
  wss.clients.add(ws); return ws;
}
function last(ws, topic) { return ws.messages.filter(m => m.topic === topic).at(-1)?.data; }

(async function () {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bomb-busters-pause-'));
  const roomName = 'bb-pause-test';
  const wss = { clients: new Set() };
  const service = officialService(wss, dir);
  try {
    const host = peer(wss, roomName), guest = peer(wss, roomName);
    service.handle(host, 'official:hello', { ruleset: 'physical', mid: 1, name: 'Host' });
    service.handle(guest, 'hello', { name: 'Guest' });
    const hi = last(host, 'official:welcome'), gi = last(guest, 'official:welcome');
    service.handle(guest, 'official:pause', { paused: true, gid: 'fake', revision: 0, commandId: 'nope' });
    assert(last(guest, 'official:error'));
    service.handle(host, 'official:start', { mid: 1, revision: 0, commandId: 'start' });
    let room = service.load(roomName), G = room.G;
    const rev = room.revision;
    service.handle(guest, 'official:pause', { paused: true, gid: G.gid, revision: rev, commandId: 'guest-pause' });
    assert.strictEqual(room.G.paused, false, 'nonhost cannot pause');
    assert(last(guest, 'official:error'));
    service.handle(host, 'official:pause', { paused: true, gid: G.gid, revision: rev, commandId: 'pause-one' });
    assert.strictEqual(room.G.paused, true);
    assert.strictEqual(room.revision, rev + 1);
    assert.strictEqual(last(host, 'official:view').view.paused, true);
    const pausedJson = JSON.stringify(room.G);
    service.handle(host, 'official:pause', { paused: true, gid: G.gid, revision: rev, commandId: 'pause-one' });
    assert.strictEqual(room.revision, rev + 1, 'duplicate request must not apply twice');
    assert.strictEqual(JSON.stringify(room.G), pausedJson);
    service.handle(host, 'official:pause', { paused: false, gid: G.gid, revision: rev, commandId: 'stale-resume' });
    assert.strictEqual(room.G.paused, true, 'stale request must not resume');

    const restoredService = officialService({ clients: new Set() }, dir);
    const restored = restoredService.load(roomName);
    assert.strictEqual(restored.G.paused, true, 'paused state survives restart');
    assert.strictEqual(restored.G.deadline, null);
    assert.strictEqual(Bot.decide(restored.G, 0), null);
    service.handle(host, 'official:pause', { paused: false, gid: G.gid, revision: room.revision, commandId: 'resume-one' });
    assert.strictEqual(room.G.paused, false);
    assert.strictEqual(room.revision, rev + 2);
    assert.strictEqual(last(host, 'official:view').view.paused, false);

    service.handle(guest, 'official:back', { gid: G.gid, revision: room.revision, commandId: 'guest-back' });
    assert.strictEqual(room.G, G, 'nonhost cannot quit the game');
    service.handle(host, 'official:back', { gid: G.gid, revision: room.revision, commandId: 'host-back' });
    assert.strictEqual(room.G, null);
    assert.strictEqual(room.started, false);
    assert(hi.credential && gi.credential);

    // A server restart must not run a bot's pending setup turn while paused.
    const botName = 'bb-paused-bot';
    const botGame = BB.createGame(Missions.get('physical', 1), [
      { pid: 'human', name: 'Human' }, { pid: 'bot', name: 'Bot', bot: true }
    ], { captain: 1 });
    BB.setPaused(botGame, true);
    fs.writeFileSync(path.join(dir, botName + '.json'), JSON.stringify({
      version: 1, name: botName, host: 'human', mid: 1, attempts: 1, started: true,
      seats: [{ pid: 'human', name: 'Human', credential: 'test-host', bot: false },
        { pid: 'bot', name: 'Bot', bot: true }], revision: 10, G: botGame
    }));
    const rebootWss = { clients: new Set() };
    const reboot = officialService(rebootWss, dir);
    const rebootRoom = reboot.load(botName);
    await new Promise(resolve => setTimeout(resolve, 450));
    assert.strictEqual(rebootRoom.G.setup[1], 0, 'paused bot must remain idle after restart');
    assert.strictEqual(rebootRoom.revision, 10);
    const returningHost = peer(rebootWss, botName);
    reboot.handle(returningHost, 'hello', { credential: 'test-host', name: 'Human' });
    reboot.handle(returningHost, 'official:pause', { gid: botGame.gid, revision: 10, commandId: 'bot-resume', paused: false });
    await new Promise(resolve => setTimeout(resolve, 450));
    assert.strictEqual(rebootRoom.G.setup[1], 1, 'resuming schedules the saved bot turn');
    assert.strictEqual(rebootRoom.revision, 12);
    console.log('✓ pause freezes engine actions and authoritative timers, restores, and requires host control');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
})().catch(err => { console.error(err); process.exitCode = 1; });
