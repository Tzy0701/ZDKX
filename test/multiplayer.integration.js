/* Real WebSocket integration check for authoritative 2–5 seat games.
 * Run with: node test/multiplayer.integration.js
 */
const assert = require('assert');
const fs = require('fs');
const http = require('http');
const https = require('https');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const WebSocket = require('ws');

const ROOT = path.join(__dirname, '..');

function freePort() {
  return new Promise((resolve, reject) => {
    const server = http.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      server.close(err => err ? reject(err) : resolve(port));
    });
  });
}
function socketUrl(endpoint, roomCode) {
  const url = new URL(endpoint);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  url.pathname = '/ws';
  url.search = roomCode ? '?room=' + encodeURIComponent('bb-' + roomCode) : '';
  return url.toString();
}

class Client {
  constructor(ws, index) {
    this.ws = ws;
    this.index = index;
    this.messages = [];
    this.waiters = [];
    ws.on('message', raw => {
      const msg = JSON.parse(raw.toString());
      this.messages.push(msg);
      this.waiters = this.waiters.filter(waiter => {
        if (!waiter.predicate(msg)) return true;
        clearTimeout(waiter.timer);
        waiter.resolve(msg);
        return false;
      });
    });
  }
  static async connect(endpoint, code, index, credential, ruleset = 'physical') {
    const ws = new WebSocket(socketUrl(endpoint, code));
    await new Promise((resolve, reject) => {
      ws.once('open', resolve);
      ws.once('error', reject);
      setTimeout(() => reject(new Error('websocket open timeout')), 3000).unref();
    });
    const c = new Client(ws, index);
    ws.send(JSON.stringify({ t: 'join', room: `bb-${code}` }));
    await c.wait(msg => msg.t === 'welcome');
    c.say(index === 0 ? 'official:hello' : 'hello', {
      ruleset: index === 0 ? ruleset : undefined,
      mid: 1, name: `Seat ${index + 1}`, credential
    });
    const identity = await c.wait(msg => msg.t === 'msg' && msg.topic === 'official:welcome');
    await c.wait(msg => msg.t === 'msg' && msg.topic === 'official:lobby');
    return { client: c, identity: identity.data };
  }
  static async spectate(endpoint, code, index) {
    const ws = new WebSocket(socketUrl(endpoint, code));
    await new Promise((resolve, reject) => { ws.once('open', resolve); ws.once('error', reject); });
    const c = new Client(ws, index);
    ws.send(JSON.stringify({ t: 'join', room: `bb-${code}` }));
    await c.wait(msg => msg.t === 'welcome');
    c.say('official:hello', { name: 'Observer' });
    const view = await c.wait(msg => msg.t === 'msg' && msg.topic === 'official:view' && msg.data.view);
    return { client: c, view: view.data.view };
  }
  say(topic, data) { this.ws.send(JSON.stringify({ t: 'emit', topic, data })); }
  wait(predicate, ms = 4000) {
    const seen = this.messages.find(predicate);
    if (seen) return Promise.resolve(seen);
    return new Promise((resolve, reject) => {
      const waiter = { predicate, resolve, reject, timer: null };
      waiter.timer = setTimeout(() => {
        this.waiters = this.waiters.filter(w => w !== waiter);
        reject(new Error(`timed out waiting for a server message (client ${this.index})`));
      }, ms);
      this.waiters.push(waiter);
    });
  }
  nextViewAfter(revision) {
    return this.wait(msg => msg.t === 'msg' && msg.topic === 'official:view' && msg.data.revision > revision);
  }
  close() { try { this.ws.close(); } catch (_) {} }
}

function code() {
  return `it${process.pid.toString(36)}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`.slice(0, 20);
}

// 只结束本测试自己创建的任务，保留房间与座位；确认返回大厅后才关闭连接。
async function finishOwnMission(host) {
  if (!host || host.client.ws.readyState !== WebSocket.OPEN) return;
  const messages = host.client.messages;
  for (let attempt = 0; attempt < 4; attempt++) {
    const lobby = messages.filter(m => m.t === 'msg' && m.topic === 'official:lobby').at(-1)?.data;
    if (!lobby || !lobby.started) return;
    const current = messages.filter(m => m.t === 'msg' && m.topic === 'official:view').at(-1)?.data;
    assert(current?.view?.gid, '本测试任务应有可退出的游戏编号');
    const old = new Set(messages);
    const done = host.client.wait(m => !old.has(m) && m.t === 'msg' &&
      (m.topic === 'official:error' || m.topic === 'official:lobby' && !m.data.started));
    host.client.say('official:back', { gid: current.view.gid, revision: current.revision,
      commandId: `结束测试-${attempt}-${current.view.gid}` });
    const result = await done;
    if (result.topic === 'official:lobby') { console.log('✓ 本测试任务已确认结束并返回大厅'); return; }
    assert.equal(result.data.msg, '牌局状态已变化，请按最新牌桌重试');
    // AI 可能先完成行动；按服务器最新版本重试本测试自己的清理请求。
  }
  throw new Error('未能结束本测试任务');
}
function getHome(endpoint, route = '/healthz') {
  return new Promise((resolve, reject) => {
    const url = new URL(route, endpoint);
    const client = url.protocol === 'https:' ? https : http;
    const req = client.get(url, res => { res.resume(); resolve(res.statusCode); });
    req.once('error', reject);
  });
}

async function runPhysical(endpoint, count) {
  const room = code();
  const seats = [];
  for (let i = 0; i < count; i++) seats.push(await Client.connect(endpoint, room, i));
  try {
    const [host, ...others] = seats;
    const lobbyMessage = await host.client.wait(m => m.t === 'msg' && m.topic === 'official:lobby' && m.data.seats.length === count);
    const lobby = lobbyMessage.data;
    assert.strictEqual(lobby.seats.length, count, `${count} distinct online seats should join`);
    assert.strictEqual(new Set(lobby.seats.map(s => s.pid)).size, count, 'each client must get a distinct server seat');
    const startView = host.client.wait(m => m.t === 'msg' && m.topic === 'official:view' && m.data.revision > lobby.revision);
    host.client.say('official:start', { mid: 1, revision: lobby.revision, commandId: `start-${count}` });

    let current = (await startView).data;
    for (let seatIndex = 0; seatIndex < seats.length; seatIndex++) {
      const seat = seats[seatIndex];
      if (current.view.setup[seatIndex] >= 1) continue;
      const privateMsg = await seat.client.wait(m => m.t === 'msg' && m.topic === 'official:view' && m.data.revision === current.revision);
      const mine = privateMsg.data.view.players.find(p => p.pid === seat.identity.pid);
      const wire = mine.stands.flat().find(w => !w.cut && Number.isInteger(w.v));
      assert(wire, `seat ${seat.identity.pid} should have a private blue wire to mark`);
      const nextHostView = host.client.nextViewAfter(current.revision);
      seat.client.say('official:act', { gid: current.view.gid, revision: current.revision,
        commandId: `info-${count}-${seat.identity.pid}`, action: { a: 'info', w: wire.id } });
      current = (await nextHostView).data;
    }
    assert.strictEqual(current.view.phase, 'play', `${count} player table should finish initial clues`);
    const views = await Promise.all(seats.map(async seat => {
      if (seat.client === host.client) return current.view;
      const m = await seat.client.wait(msg => msg.t === 'msg' && msg.topic === 'official:view' && msg.data.revision === current.revision);
      return m.data.view;
    }));
    for (let i = 0; i < views.length; i++) {
      for (let j = 0; j < count; j++) {
        const wires = views[i].players[j].stands.flat();
        if (j === i) assert(wires.some(w => !w.cut && w.v !== null), `seat ${i} sees its own hand`);
        else assert(wires.every(w => w.cut || w.v === null), `seat ${i} must not see seat ${j}'s hand`);
      }
    }

    // Complete one genuine two-stage dual cut with two different sockets.
    const actor = seats[0], actorView = views[0];
    assert.strictEqual(actorView.turn, 0, 'first attempt captain should act first');
    const own = actorView.players[0].stands.flat().find(w => !w.cut && Number.isInteger(w.v));
    let targetSeat = -1, target = null;
    for (let j = 1; j < count && !target; j++) {
      target = views[j].players[j].stands.flat().find(w => !w.cut && w.v === own.v);
      if (target) targetSeat = j;
    }
    let responder = seats[targetSeat > 0 ? targetSeat : 1];
    if (target) {
      const pendingWait = actor.client.nextViewAfter(current.revision);
      actor.client.say('official:act', { gid: current.view.gid, revision: current.revision,
        commandId: `dual-${count}`, action: { a: 'dual', w: target.id, val: own.v } });
      current = (await pendingWait).data;
      assert.strictEqual(current.view.pending.step, 'target', 'dual action should create a target choice');
      responder = seats[targetSeat];
      const responderPending = await responder.client.wait(m => m.t === 'msg' && m.topic === 'official:view' && m.data.revision === current.revision);
      assert(responderPending.data.view.pending.choices.includes(target.id), 'targeting teammate receives the legal matching choice');
      const ownChoiceWait = actor.client.nextViewAfter(current.revision);
      responder.client.say('official:act', { gid: current.view.gid, revision: current.revision,
        commandId: `target-${count}`, action: { a: 'resolve', id: current.view.pending.id, w: target.id } });
      current = (await ownChoiceWait).data;
      assert.strictEqual(current.view.pending.step, 'own', 'actor sees the selected target and then chooses their wire');
      assert.strictEqual(current.view.pending.hit, target.id, 'the chosen target is public to everyone');
    } else {
      console.log(`  ${count} seats had no shared initial blue value; dual-cut stage skipped for this randomized deal`);
    }
    const spectator = await Client.spectate(endpoint, room, count);
    try {
      assert.strictEqual(spectator.view.me, -1, 'late observer receives only the public view');
      if (target) assert(!spectator.view.pending.choices, 'spectators must not see alternative matches or their count');
      spectator.client.say('official:act', null);
      spectator.client.say('official:hello', []);
      spectator.client.ws.send('{malformed-json');
      await new Promise(resolve => setTimeout(resolve, 50));
      assert.strictEqual(spectator.client.ws.readyState, WebSocket.OPEN, 'malformed null, array, and JSON packets should not drop the connection');
      assert.strictEqual(await getHome(endpoint), 200, 'malformed packets must not crash the game server');
    } finally { spectator.client.close(); }
    if (target) {
      const cutWait = host.client.nextViewAfter(current.revision);
      actor.client.say('official:act', { gid: current.view.gid, revision: current.revision,
        commandId: `own-${count}`, action: { a: 'resolve', id: current.view.pending.id, w: own.id } });
      current = (await cutWait).data;
      assert.strictEqual(current.view.phase, 'play');
      assert.strictEqual(current.view.pending, null);
      const firstCut = await host.client.wait(m => m.t === 'msg' && m.topic === 'official:view' && m.data.revision === current.revision);
      const ownWire = firstCut.data.view.players[0].stands.flat().find(w => w.id === own.id);
      const targetWire = firstCut.data.view.players[targetSeat].stands.flat().find(w => w.id === target.id);
      assert(ownWire.cut && targetWire.cut, 'both selected wires become cut together');
    }

    // Reconnect with the server-issued credential and verify the private view is restored.
    const rejoin = await Client.connect(endpoint, room, responder.client.index, responder.identity.credential);
    try {
      assert.strictEqual(rejoin.identity.pid, responder.identity.pid, 'credential should restore the same seat');
      const rejoinedView = await rejoin.client.wait(m => m.t === 'msg' && m.topic === 'official:view' && m.data.view.phase === 'play');
      assert(rejoinedView.data.view.players[responder.client.index].stands.flat().some(w => !w.cut && w.v !== null),
        'reconnected player regains only its own uncut values');
      assert(rejoinedView.data.view.players[0].stands.flat().every(w => w.cut || w.v === null),
        'reconnected player still cannot see another live hand');
    } finally { rejoin.client.close(); }
    console.log(`✓ ${count}-player physical room: ${count} seats, private views, clue setup,${target ? ' dual cut,' : ''} reconnect`);
  } finally { try { await finishOwnMission(seats[0]); } finally { seats.forEach(s => s.client.close()); } }
}

async function runCustomRelay(endpoint) {
  const room = code();
  const wsA = new WebSocket(socketUrl(endpoint, room)), wsB = new WebSocket(socketUrl(endpoint, room));
  await Promise.all([wsA, wsB].map(ws => new Promise((resolve, reject) => { ws.once('open', resolve); ws.once('error', reject); })));
  const wrap = (ws, i) => {
    const c = new Client(ws, i);
    ws.send(JSON.stringify({ t: 'join', room: `bb-${room}` }));
    return c.wait(m => m.t === 'welcome').then(() => c);
  };
  const [ca, cb] = await Promise.all([wrap(wsA, 0), wrap(wsB, 1)]);
  try {
    ca.say('hello', { pid: 'sender-pid' });
    cb.say('hello', { pid: 'target-pid' });
    const received = cb.wait(m => m.t === 'msg' && m.topic === 'lobby' && m.data.probe === room);
    ca.say('lobby', { probe: room, mode: 'custom' });
    await received;
    const privatePacket = cb.wait(m => m.t === 'msg' && m.topic === 'hand');
    ca.say('hand', { to: 'target-pid', hidden: true });
    assert.strictEqual((await privatePacket).data.hidden, true, 'custom hand relay reaches its intended pid');
    const officialNoRelay = cb.wait(m => m.t === 'msg' && m.topic === 'official:view', 500);
    ca.say('official:view', { fake: true });
    await officialNoRelay.catch(() => {});
    assert(!cb.messages.some(m => m.t === 'msg' && m.topic === 'official:view'), 'legacy custom room cannot relay forged official views');
    console.log('✓ custom room relay still works and hides private-hand packets');
  } finally { ca.close(); cb.close(); }
}

async function addStartingClues(endpoint, seats, current, clueCount, ordered) {
  const count = seats.length;
  const order = ordered
    ? Array.from({ length: count }, (_, i) => (current.view.captain + i) % count)
    : Array.from({ length: count }, (_, i) => i);
  for (const seatIndex of order) {
    for (let placed = current.view.setup[seatIndex] || 0; placed < clueCount; placed++) {
      const seat = seats[seatIndex];
      const privateMsg = await seat.client.wait(m => m.t === 'msg' && m.topic === 'official:view' && m.data.revision === current.revision);
      const own = privateMsg.data.view.players[seatIndex];
      const wire = own.stands.flat().find(w => !w.cut && w.info == null && Number.isInteger(w.v));
      assert(wire, `seat ${seatIndex} must have an unmarked blue wire for clue ${placed + 1}`);
      const next = seat.client.nextViewAfter(current.revision);
      seat.client.say('official:act', { gid: current.view.gid, revision: current.revision,
        commandId: `clue-${current.view.mid}-${seatIndex}-${placed}-${Math.random().toString(36).slice(2, 7)}`,
        action: { a: 'info', w: wire.id } });
      current = (await next).data;
      if (current.view.phase !== 'setup') return current;
    }
  }
  return current;
}

async function runCampaignTransition(endpoint, count) {
  const room = code();
  const seats = [];
  for (let i = 0; i < count; i++) seats.push(await Client.connect(endpoint, room, i, undefined, 'campaign'));
  try {
    const host = seats[0];
    const lobbyMsg = await host.client.wait(m => m.t === 'msg' && m.topic === 'official:lobby' && m.data.seats.length === count);
    let lobby = lobbyMsg.data;
    assert.strictEqual(lobby.ruleset, 'campaign');
    assert.strictEqual(lobby.catalog, 'campaign');
    let start = host.client.nextViewAfter(lobby.revision);
    host.client.say('official:start', { mid: 1, revision: lobby.revision, commandId: `campaign-1-${count}` });
    let current = (await start).data;
    current = await addStartingClues(endpoint, seats, current, 1, true);
    assert.strictEqual(current.view.phase, 'play', `campaign mission 1 should reach play with ${count} humans`);
    assert.strictEqual(current.view.catalog, 'campaign');
    assert.strictEqual(current.view.verified, true, 'mission 1 should resolve to verified physical rules');

    const lobbyAfterBack = host.client.wait(m => m.t === 'msg' && m.topic === 'official:lobby' && m.data.revision > current.revision && !m.data.started);
    host.client.say('official:back', { gid: current.view.gid, revision: current.revision, commandId: `back-${count}` });
    lobby = (await lobbyAfterBack).data;
    host.client.say('official:lobby', { mid: 2, seats: lobby.seats });
    lobby = (await host.client.wait(m => m.t === 'msg' && m.topic === 'official:lobby' && m.data.mid === 2)).data;
    assert.strictEqual(lobby.ruleset, 'campaign');
    start = host.client.nextViewAfter(lobby.revision);
    host.client.say('official:start', { mid: 2, revision: lobby.revision, commandId: `campaign-2-${count}` });
    current = (await start).data;
    current = await addStartingClues(endpoint, seats, current, current.view.infoN, true);
    assert.strictEqual(current.view.phase, 'play', `campaign mission 2 should reach play with ${count} humans`);
    assert.strictEqual(current.view.mid, 2);
    assert.strictEqual(current.view.catalog, 'campaign');
    assert.strictEqual(current.view.verified, true, 'mission 2 uses the reviewed physical card');
    assert.strictEqual(current.view.ruleset, 'physical', 'mission 2 uses physical setup and turn rules');
    assert.strictEqual(current.view.infoN, 1);
    console.log(`✓ ${count}-player campaign room: verified mission 1 → verified mission 2 via server lobby`);
  } finally { try { await finishOwnMission(seats[0]); } finally { seats.forEach(s => s.client.close()); } }
}

async function runOfficialChat(endpoint) {
  const room = code();
  const seats = [
    await Client.connect(endpoint, room, 0, undefined, 'campaign'),
    await Client.connect(endpoint, room, 1, undefined, 'campaign')
  ];
  const [host, guest] = seats;
  try {
    let lobby = (await host.client.wait(m => m.t === 'msg' && m.topic === 'official:lobby' && m.data.seats.length === 2)).data;
    let nextView = host.client.nextViewAfter(lobby.revision);
    host.client.say('official:start', { mid: 1, revision: lobby.revision, commandId: `chat-open-${room}` });
    let current = (await nextView).data;

    // Mission 1 permits table talk during both clue placement and play.
    const setupChat = `mission 1 setup ${room}`;
    const hostSetupMessage = host.client.wait(m => m.t === 'msg' && m.topic === 'chat' && m.data.text === setupChat);
    const guestSetupMessage = guest.client.wait(m => m.t === 'msg' && m.topic === 'chat' && m.data.text === setupChat);
    host.client.say('chat', { text: setupChat });
    assert.strictEqual((await hostSetupMessage).data.name, 'Seat 1');
    assert.strictEqual((await guestSetupMessage).data.name, 'Seat 1');

    current = await addStartingClues(endpoint, seats, current, 1, true);
    assert.strictEqual(current.view.phase, 'play');
    const playChat = `mission 1 play ${room}`;
    const guestPlayMessage = guest.client.wait(m => m.t === 'msg' && m.topic === 'chat' && m.data.text === playChat);
    host.client.say('chat', { text: playChat });
    assert.strictEqual((await guestPlayMessage).data.name, 'Seat 1');

    const lobbyAfterBack = host.client.wait(m => m.t === 'msg' && m.topic === 'official:lobby' && m.data.revision > current.revision && !m.data.started);
    host.client.say('official:back', { gid: current.view.gid, revision: current.revision, commandId: `chat-back-${room}` });
    lobby = (await lobbyAfterBack).data;
    const lobby11 = host.client.wait(m => m.t === 'msg' && m.topic === 'official:lobby' && m.data.mid === 11);
    host.client.say('official:lobby', { mid: 11, seats: lobby.seats });
    lobby = (await lobby11).data;
    nextView = host.client.nextViewAfter(lobby.revision);
    host.client.say('official:start', { mid: 11, revision: lobby.revision, commandId: `chat-locked-${room}` });
    current = (await nextView).data;

    const setupText = `mission 11 setup ${room}`;
    const setupRejected = host.client.wait(m => m.t === 'msg' && m.topic === 'official:error' && m.data.msg === '本关禁止聊天');
    host.client.say('chat', { text: setupText });
    await setupRejected;
    assert(!guest.client.messages.some(m => m.t === 'msg' && m.topic === 'chat' && m.data.text === setupText), 'setup chat must remain blocked in mission 11');

    current = await addStartingClues(endpoint, seats, current, current.view.infoN, false);
    assert.strictEqual(current.view.phase, 'play');
    const text = `mission 11 play ${room}`;
    const errorOffset = host.client.messages.length;
    const rejected = host.client.wait(m => m.t === 'msg' && m.topic === 'official:error' && m.data.msg === '本关禁止聊天' && host.client.messages.indexOf(m) >= errorOffset);
    host.client.say('chat', { text });
    await rejected;
    assert(!guest.client.messages.some(m => m.t === 'msg' && m.topic === 'chat' && m.data.text === text), 'play chat must remain blocked in mission 11');
    console.log('✓ official chat: mission 1 messages reach both seats during setup/play; mission 11 blocks chat during setup/play');
  } finally { try { await finishOwnMission(seats[0]); } finally { seats.forEach(s => s.client.close()); } }
}

async function runHostControls(endpoint) {
  const room = code();
  const seats = [
    await Client.connect(endpoint, room, 0, undefined, 'campaign'),
    await Client.connect(endpoint, room, 1, undefined, 'campaign')
  ];
  let guest = seats[1];
  const host = seats[0];
  try {
    let lobby = (await host.client.wait(m => m.t === 'msg' && m.topic === 'official:lobby' && m.data.seats.length === 2)).data;
    const started = host.client.nextViewAfter(lobby.revision);
    host.client.say('official:start', { mid: 1, revision: lobby.revision, commandId: `controls-start-${room}` });
    let current = (await started).data;
    current = await addStartingClues(endpoint, seats, current, 1, true);
    assert.strictEqual(current.view.phase, 'play', 'host controls are available once the mission starts');

    const hostView = (await host.client.wait(m => m.t === 'msg' && m.topic === 'official:view' && m.data.revision === current.revision)).data.view;
    const guestView = (await guest.client.wait(m => m.t === 'msg' && m.topic === 'official:view' && m.data.revision === current.revision)).data.view;
    const mine = hostView.players[0].stands.flat().filter(w => !w.cut && Number.isInteger(w.v));
    const guestWires = guestView.players[1].stands.flat().filter(w => !w.cut && Number.isInteger(w.v));
    let pair = null;
    for (const own of mine) {
      const target = guestWires.find(w => w.v === own.v);
      if (target) { pair = { own, target }; break; }
    }
    assert(pair, 'two-player mission 1 deal should give the captain and teammate a matching blue pair');

    const beforeCutRevision = current.revision;
    let next = host.client.nextViewAfter(current.revision);
    host.client.say('official:act', { gid: current.view.gid, revision: current.revision,
      commandId: `controls-dual-${room}`, action: { a: 'dual', w: pair.target.id, val: pair.own.v } });
    current = (await next).data;
    assert.strictEqual(current.view.pending.step, 'target', 'dual cut should leave a pending teammate response');
    const decisionId = current.view.pending.id;

    const guestPauseError = guest.client.wait(m => m.t === 'msg' && m.topic === 'official:error' &&
      m.data.msg === '只有房主可以暂停或继续牌局');
    guest.client.say('official:pause', { gid: current.view.gid, revision: current.revision,
      commandId: `guest-pause-${room}`, paused: true });
    await guestPauseError;
    assert.strictEqual(current.revision, beforeCutRevision + 1, 'only the accepted dual action should have advanced the revision');

    const pauseRevision = current.revision;
    const pauseViewWait = host.client.nextViewAfter(pauseRevision);
    host.client.say('official:pause', { gid: current.view.gid, revision: pauseRevision,
      commandId: `host-pause-${room}`, paused: true });
    current = (await pauseViewWait).data;
    assert.strictEqual(current.view.paused, true, 'host pause is broadcast to every seat');
    assert.strictEqual(current.view.pending.id, decisionId, 'pausing preserves the pending teammate decision');

    const pausedGuestView = (await guest.client.wait(m => m.t === 'msg' && m.topic === 'official:view' &&
      m.data.revision === current.revision)).data.view;
    assert.strictEqual(pausedGuestView.paused, true, 'guest sees the pause state');
    assert.strictEqual(pausedGuestView.pending.id, decisionId, 'guest still sees the same private response while paused');
    const guestResolveError = guest.client.wait(m => m.t === 'msg' && m.topic === 'official:error' && m.data.msg === '牌局已暂停');
    guest.client.say('official:act', { gid: current.view.gid, revision: current.revision,
      commandId: `resolve-during-pause-${room}`, action: { a: 'resolve', id: decisionId, w: pair.target.id } });
    await guestResolveError;

    guest.client.close();
    await new Promise(resolve => setTimeout(resolve, 80));
    guest = await Client.connect(endpoint, room, 1, seats[1].identity.credential, 'campaign');
    const restored = (await guest.client.wait(m => m.t === 'msg' && m.topic === 'official:view' && m.data.view.paused)).data;
    assert.strictEqual(restored.view.pending.id, decisionId, 'reconnected teammate regains the paused decision');

    next = host.client.nextViewAfter(current.revision);
    host.client.say('official:pause', { gid: current.view.gid, revision: current.revision,
      commandId: `host-resume-${room}`, paused: false });
    current = (await next).data;
    assert.strictEqual(current.view.paused, false, 'host can resume the mission');
    assert.strictEqual(current.view.pending.id, decisionId, 'resuming keeps the same pending decision');

    next = host.client.nextViewAfter(current.revision);
    guest.client.say('official:act', { gid: current.view.gid, revision: current.revision,
      commandId: `resolve-after-resume-${room}`, action: { a: 'resolve', id: decisionId, w: pair.target.id } });
    current = (await next).data;
    assert.strictEqual(current.view.pending.step, 'own', 'the pending response can be completed after resume');
    next = host.client.nextViewAfter(current.revision);
    host.client.say('official:act', { gid: current.view.gid, revision: current.revision,
      commandId: `own-after-resume-${room}`, action: { a: 'resolve', id: decisionId, w: pair.own.id } });
    current = (await next).data;
    assert.strictEqual(current.view.pending, null, 'both players can finish the cut after resuming');

    const guestQuitError = guest.client.wait(m => m.t === 'msg' && m.topic === 'official:error' && m.data.msg === '只有房主可以退出牌局');
    guest.client.say('official:back', { gid: current.view.gid, revision: current.revision, commandId: `guest-quit-${room}` });
    await guestQuitError;

    const lobbyReturned = host.client.wait(m => m.t === 'msg' && m.topic === 'official:lobby' &&
      m.data.revision > current.revision && !m.data.started);
    host.client.say('official:back', { gid: current.view.gid, revision: current.revision, commandId: `host-quit-${room}` });
    const backLobby = (await lobbyReturned).data;
    const guestBackLobby = (await guest.client.wait(m => m.t === 'msg' && m.topic === 'official:lobby' &&
      m.data.revision === backLobby.revision && !m.data.started)).data;
    assert.strictEqual(backLobby.code, room.toUpperCase(), 'quit returns the same room to its lobby');
    assert.strictEqual(guestBackLobby.code, backLobby.code, 'teammate also receives the return to lobby');
    assert.strictEqual(backLobby.seats.length, 2, 'quitting the mission keeps both players in the room');
    assert.strictEqual(backLobby.started, false);
    console.log('✓ host controls: guests cannot pause or quit; pause preserves and reconnects pending decision; resume and host quit return both seats to same lobby');
  } finally {
    host.client.close();
    guest.client.close();
  }
}

async function runBotMultiClue(endpoint) {
  const room = code();
  const seats = [
    await Client.connect(endpoint, room, 0, undefined, 'campaign'),
    await Client.connect(endpoint, room, 1, undefined, 'campaign')
  ];
  try {
    const host = seats[0];
    let lobby = (await host.client.wait(m => m.t === 'msg' && m.topic === 'official:lobby' && m.data.seats.length === 2)).data;
    const requestedBotPid = `test-bot-${room}`;
    const configured = host.client.wait(m => m.t === 'msg' && m.topic === 'official:lobby' && m.data.seats.length === 3);
    host.client.say('official:lobby', { mid: 32, seats: [...lobby.seats, { pid: requestedBotPid, name: 'Setup bot', bot: true }] });
    lobby = (await configured).data;
    const botIndex = lobby.seats.findIndex(s => s.bot);
    assert(botIndex >= 0, 'lobby should accept a bot seat');
    const started = host.client.nextViewAfter(lobby.revision);
    host.client.say('official:start', { mid: 32, revision: lobby.revision, commandId: 'campaign-multiclue-bot' });
    let current = (await started).data;
    assert.strictEqual(current.view.infoN, 2, 'mission 32 requires two starting clues per player');
    // Let the authoritative server schedule both bot setup actions before humans act.
    current = (await host.client.wait(m => m.t === 'msg' && m.topic === 'official:view' &&
      m.data.view.phase === 'setup' && m.data.view.setup[botIndex] === 2, 5000)).data;
    current = await addStartingClues(endpoint, seats, current, 2, false);
    assert.strictEqual(current.view.phase, 'play', 'two humans and a bot should complete all six setup clues');
    assert(current.view.players[botIndex].bot);
    console.log('✓ mission 32 two-clue setup: authoritative bot places both clues and two humans finish setup');
  } finally { try { await finishOwnMission(seats[0]); } finally { seats.forEach(s => s.client.close()); } }
}

async function main() {
  let child = null;
  let endpoint = process.env.BB_TEST_URL || null;
  const scratchDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bb-multiplayer-'));
  let stderr = '';
  try {
    if (!endpoint) {
      const port = await freePort();
      endpoint = `http://127.0.0.1:${port}`;
      child = spawn(process.execPath, ['server/server.js'], {
        cwd: ROOT, env: { ...process.env, PORT: String(port), BB_DATA_DIR: scratchDir }, stdio: ['ignore', 'pipe', 'pipe']
      });
      child.stderr.on('data', chunk => { stderr += chunk; });
      const started = await new Promise((resolve, reject) => {
        const startedAt = Date.now();
        const tick = () => {
          if (child.exitCode !== null) return reject(new Error(`server exited early: ${stderr}`));
          getHome(endpoint).then(status => {
            if (status === 200) resolve(true);
            else setTimeout(tick, 100);
          }, () => {
            if (Date.now() - startedAt > 7000) reject(new Error(`server did not start: ${stderr}`));
            else setTimeout(tick, 100);
          });
        };
        tick();
      });
      assert(started);
    } else {
      assert.strictEqual(await getHome(endpoint), 200, 'BB_TEST_URL health endpoint should respond before the test');
    }
    for (let players = 2; players <= 5; players++) await runPhysical(endpoint, players);
    for (let players = 2; players <= 5; players++) await runCampaignTransition(endpoint, players);
    await runOfficialChat(endpoint);
    await runHostControls(endpoint);
    await runBotMultiClue(endpoint);
    await runCustomRelay(endpoint);
  } finally {
    if (child) {
      child.kill('SIGTERM');
      await new Promise(resolve => child.once('exit', resolve));
    }
    fs.rmSync(scratchDir, { recursive: true, force: true });
  }
}

if (require.main === module) main().catch(err => { console.error(err.stack || err); process.exitCode = 1; });
module.exports = { Client, freePort, finishOwnMission };
