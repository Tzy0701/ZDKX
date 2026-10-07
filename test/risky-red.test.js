const assert = require('assert');
const BB = require('../js/engine'), Bot = require('../js/bot'), M = require('../js/missions'), C = require('../js/campaign-rules');
const seats = n => Array.from({ length: n }, (_, i) => ({ pid: 'p' + i, name: '玩家' + i }));
function rng(seed = 13) { return () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296); }
function game(n = 3, seed = 13, captain = 0) { return BB.createGame(M.get('official-development', 13), seats(n), { captain, rng: rng(seed) }); }
function act(G, pi, a) { assert.equal(BB.act(G, pi, a, { rng: rng() }), null, JSON.stringify(a)); }
function reject(G, pi, a) { const before = JSON.stringify(G), error = BB.act(G, pi, a); assert(error); assert.equal(JSON.stringify(G), before); return error; }
function test(name, run) { run(); console.log('✓', name); }
function setup(G) { while (G.phase === 'setup') { const pi = BB.setupActor(G); act(G, pi, Bot.decide(G, pi)); } }
function rig(hands = [[1.5, 1, 1], [4.5, 1, 1], [9.5, 2, 2, 2, 2]]) {
  const G = game(hands.length); G.wires = []; G.players.forEach(p => { p.stands = [[]]; });
  hands.forEach((hand, o) => hand.forEach(v => { const id = G.wires.length; G.wires.push({ id, v, o, s: 0, cut: false, info: null }); G.players[o].stands[0].push(id); }));
  G.players.forEach(p => p.stands[0].sort((a, b) => G.wires[a].v - G.wires[b].v)); G.officialState.risky.side = []; G.phase = 'play'; G.pending = null; G.turn = 0; G.turnNo = 1; G.equip = []; return G;
}
function replyAll(G) { while (G.pending?.type === 'risky-cut') act(G, G.pending.to, { a: 'risky-reply', id: G.pending.id }); }

test('第13关来源设置：48蓝、3已知红、无黄；按队长先发红，架长均衡且排序独立', () => {
  const redRacks = new Set(), drawn = new Set(); let aside = false;
  for (let n = 2; n <= 5; n++) for (let captain = 0; captain < n; captain++) for (let seed = 1; seed <= 24; seed++) {
    const G = game(n, seed, captain); assert.equal(G.wires.length, 51); assert.equal(G.detMax, n);
    assert.equal(G.wires.filter(w => BB.kindOf(w) === 'b').length, 48); assert.equal(G.wires.filter(w => BB.kindOf(w) === 'r').length, 3);
    assert.equal(G.ymark.n, 0); assert.equal(G.rmark.n, 3); assert.equal(G.rmark.cand.length, 3);
    for (let v = 1; v <= 12; v++) assert.equal(G.wires.filter(w => w.v === v).length, 4);
    G.players.forEach((p, pi) => {
      const offset = (pi - captain + n) % n, expected = n === 2 ? pi === captain ? 2 : 1 : offset < 3 ? 1 : 0;
      assert.equal(G.wires.filter(w => w.o === pi && BB.kindOf(w) === 'r').length, expected);
      assert.equal(p.stands.length, n === 2 || n === 3 && pi === captain ? 2 : 1); assert.equal(p.dd, 1);
      if (p.stands.length === 2 && expected === 1) redRacks.add(G.wires.find(w => w.o === pi && BB.kindOf(w) === 'r').s);
      if (n === 2 && pi === captain) assert(p.stands.every(st => st.filter(id => BB.kindOf(G.wires[id]) === 'r').length === 1));
      p.stands.forEach(st => { const values = st.map(id => G.wires[id].v); assert.deepEqual(values, values.slice().sort((a, b) => a - b)); });
    });
    const counts = G.players.flatMap(p => p.stands.map(st => st.length)); assert(Math.max(...counts) - Math.min(...counts) <= 1);
    assert.equal(G.equip.length, n); assert(!G.equip.some(e => e.n > 12)); assert.equal(BB.setupNeed(G, captain), n === 2 ? 0 : 1);
    while (G.phase === 'setup') { const pi = BB.setupActor(G); assert.equal(G.pending.to, pi); drawn.add(G.pending.token.value); assert(Number.isInteger(G.pending.token.value)); aside ||= !BB.view(G, pi).pending.choices.length; act(G, pi, Bot.decide(G, pi)); }
    assert.equal(G.wires.filter(w => w.info).length + G.officialState.risky.side.length, n === 2 ? 1 : n);
  }
  assert.deepEqual([...redRacks].sort(), [0, 1]); assert.equal(drawn.size, 12); assert(aside);
});

test('随机初始标记由对应玩家选同值导线，缺值旁置占有限供应；旧决定和越权不改变状态', () => {
  const G = game(3), pi = G.pending.to, id = G.pending.id, value = G.pending.token.value;
  reject(G, (pi + 1) % 3, { a: 'initial-clue', id, w: null, rack: 0 }); reject(G, pi, { a: 'info', w: 0 }); reject(G, pi, { a: 'initial-clue', id: id - 1, w: 0 });
  const own = G.wires.filter(w => w.o === pi && w.v === value);
  if (own.length) { reject(G, pi, { a: 'initial-clue', id, w: null, rack: 0 }); act(G, pi, { a: 'initial-clue', id, w: own.at(-1).id }); assert.equal(G.wires[own.at(-1).id].info.token.startsWith('info-'), true); }
  else act(G, pi, { a: 'initial-clue', id, w: null, rack: 1 });
  reject(G, pi, { a: 'initial-clue', id, w: own[0]?.id ?? null, rack: 0 }); setup(G);
  const H = game(2); H.pending.token = { id: 'info-12-0', value: 12 }; H.wires.filter(w => w.o === H.pending.to && w.v === 12).forEach(w => { w.v = 11; });
  const owner = H.pending.to; act(H, owner, { a: 'initial-clue', id: H.pending.id, w: null, rack: 1 });
  assert.equal(H.officialState.risky.side[0].rack, 1); assert.equal(C.reservedTokens(H, { t: 'v', v: 12 }), 1); assert.equal(C.availableInfoTokens(H, false).filter(t => t.value === 12).length, 1);
});

test('三红公开宣告跨玩家；只给回应者自己的答案；回应后一次剪断且不自动剪蓝线', () => {
  const G = rig(), ids = G.wires.filter(w => BB.kindOf(w) === 'r').map(w => w.id);
  act(G, 0, { a: 'risky-cut', ws: ids }); const id = G.pending.id;
  for (let pi = -1; pi < G.np; pi++) {
    const V = BB.view(G, pi); assert.deepEqual(V.pending.ids, ids); assert.deepEqual(V.pending.vals, ['R']); assert.equal('ownAnswers' in V.pending, pi === G.pending.to);
    V.players.forEach((p, owner) => p.stands.flat().forEach(w => { if (owner !== pi) assert.equal(w.v, null); }));
  }
  reject(G, 1, { a: 'risky-reply', id }); reject(G, 0, { a: 'equip', n: 9 }); reject(G, 0, { a: 'risky-reply', id: id - 1 });
  act(G, 0, { a: 'risky-reply', id }); assert(G.declaration); assert.equal(G.declaration.answers.length, 1); assert(G.wires.every(w => !w.cut)); reject(G, 0, { a: 'risky-reply', id });
  replyAll(G); assert.equal(G.phase, 'play'); assert.equal(G.det, 0); assert.equal(G.turnNo, 2); assert.equal(G.players[0].dd, 1);
  assert(ids.every(id => G.wires[id].cut && G.wires[id].resolution === 'cut')); assert(G.wires.filter(w => BB.kindOf(w) === 'b').every(w => !w.cut)); assert.equal(G.declaration.result.matched, true);
  const publicView = BB.view(G, -1), unpacked = BB.unpack(BB.packPublic(G), BB.packHand(G, 0), 0, BB.packChoice(G, 0));
  ids.forEach(id => { assert.equal(publicView.players.flatMap(p => p.stands.flat()).find(w => w.id === id).resolution, 'cut'); assert.equal(unpacked.players.flatMap(p => p.stands.flat()).find(w => w.id === id).resolution, 'cut'); });
});

test('选中非红立即爆炸，稳定器无效；重复、已剪、越权、组合装备均拒绝且不消耗牌', () => {
  const G = rig(), ids = G.wires.filter(w => BB.kindOf(w) === 'r').map(w => w.id); G.equip = [{ n: 9, used: false }]; G.stab = true;
  for (const a of [{ a: 'red' }, { a: 'risky-cut', ws: [ids[0], ids[0], ids[1]] }, { a: 'risky-cut', ws: ids.slice(1) }, { a: 'risky-cut', ws: ids, stab: true }, { a: 'risky-cut', ws: ids, xy: true }, { a: 'risky-cut', ws: ids, n: 3 }]) reject(G, 0, a);
  reject(G, 1, { a: 'risky-cut', ws: ids }); G.wires[ids[2]].cut = true; reject(G, 0, { a: 'risky-cut', ws: ids }); G.wires[ids[2]].cut = false;
  const blue = G.wires.find(w => w.o === 1 && BB.kindOf(w) === 'b'); act(G, 0, { a: 'risky-cut', ws: [ids[0], blue.id, ids[2]] }); replyAll(G);
  assert.equal(G.phase, 'lost'); assert.equal(G.det, 0); assert(G.wires.every(w => !w.cut)); assert.equal(G.equip[0].used, false); assert.equal(G.players[0].dd, 1);
});

test('2–3人行动者须持红，4–5人可无红；仅剩红必须冒险，全部导线处理后才胜利', () => {
  for (const n of [2, 3, 4, 5]) {
    const hands = n === 2 ? [[1, 1], [1.5, 4.5, 9.5, 1, 1]] : [[1, 1], [1.5, 1, 1], [4.5, 9.5, 2, 2], ...Array.from({ length: n - 3 }, () => [2, 2])];
    const G = rig(hands), ids = G.wires.filter(w => BB.kindOf(w) === 'r').map(w => w.id);
    if (n <= 3) reject(G, 0, { a: 'risky-cut', ws: ids }); else { act(G, 0, { a: 'risky-cut', ws: ids }); replyAll(G); assert.equal(G.phase, 'play'); }
  }
  const H = rig(); H.wires.filter(w => BB.kindOf(w) === 'b').forEach(w => { w.cut = true; }); H.equip.push({ n: 11, used: false });
  reject(H, 0, { a: 'red' }); reject(H, 0, { a: 'equip', n: 11, p: 1 }); assert(BB.canAct(H, 0)); assert.equal(H.phase, 'play');
  act(H, 0, { a: 'risky-cut', ws: H.wires.filter(w => !w.cut).map(w => w.id) }); replyAll(H); assert.equal(H.phase, 'won');
  const I = rig([[1.5, 4.5, 9.5, 1, 1], [1, 1], [2, 2, 2, 2]]); act(I, 0, { a: 'risky-cut', ws: I.wires.filter(w => BB.kindOf(w) === 'r').map(w => w.id) }); replyAll(I); assert.equal(I.phase, 'play');
});

test('100局来源配置全信息通关与64局推理机器人合法终局；已核实任务与旧版改编分离', () => {
  let actions = 0;
  for (let n = 2; n <= 5; n++) for (let seed = 1; seed <= 25; seed++) {
    const G = game(n, seed, seed % n);
    for (let k = 0; k < 1000 && G.phase !== 'won'; k++) {
      const pi = G.pending ? G.pending.to : G.turn; let a;
      if (G.phase === 'setup') a = Bot.decide(G, pi);
      else if (G.pending?.type === 'risky-cut') a = { a: 'risky-reply', id: G.pending.id };
      else if (G.pending?.type === 'cut') a = { a: 'resolve', id: G.pending.id, w: G.pending.step === 'own' ? BB.view(G, pi).pending.choices.at(-1) : G.pending.ids.find(id => G.pending.vals.some(v => BB.matches(G.wires[id], v))) };
      else {
        const own = G.wires.filter(w => w.o === pi && !w.cut);
        if (own.every(w => BB.kindOf(w) === 'r')) a = { a: 'risky-cut', ws: G.wires.filter(w => !w.cut && BB.kindOf(w) === 'r').map(w => w.id) };
        else { const v = BB.annOf(own.find(w => BB.kindOf(w) !== 'r')); a = BB.soloOk(G, pi, v) ? { a: 'solo', val: v } : { a: 'dual', val: v, w: G.wires.find(w => w.o !== pi && !w.cut && BB.matches(w, v)).id }; }
      }
      assert(a); act(G, pi, a); actions++;
    }
    assert.equal(G.phase, 'won'); assert.equal(G.det, 0); assert(G.wires.every(w => w.cut));
  }
  for (let n = 2; n <= 5; n++) for (let seed = 1; seed <= 16; seed++) { const G = game(n, seed, seed % n); for (let k = 0; k < 1000 && !['won', 'lost'].includes(G.phase); k++) { const pi = G.pending ? G.pending.to : G.turn; const a = Bot.decide(G, pi); assert(a); act(G, pi, a); } assert(['won', 'lost'].includes(G.phase)); }
  assert.equal(M.get('campaign', 13).verified, true); assert.equal(M.get('physical', 13).officialModule, 'risky-red-cut');
  assert(!BB.createGame(M.get('custom', 13), seats(3), { rng: rng() }).officialState);
  console.log('  100局全信息通关，共' + actions + '个合法动作；另64局推理机器人合法终局。');
});

test('2–5人权威联机：初始标记与三红回应保密，暂停、重连、重启、过期与重复指令', () => {
  const fs = require('fs'), os = require('os'), path = require('path'), Service = require('../server/official');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bb13-authority-')), wss = { clients: new Set() }, svc = Service(wss, dir);
  const last = (ws, topic) => ws.messages.filter(m => m.topic === topic).at(-1)?.data;
  function peer(room) { const ws = { room, readyState: 1, messages: [], send(raw) { this.messages.push(JSON.parse(raw)); } }; wss.clients.add(ws); return ws; }
  try {
    for (let n = 2; n <= 5; n++) {
      const name = 'bb-risky' + n, peers = Array.from({ length: n }, () => peer(name));
      peers.forEach((ws, pi) => svc.handle(ws, pi ? 'hello' : 'official:hello', { ruleset: 'campaign', mid: 13, name: '玩家' + pi }));
      const room = svc.load(name); svc.handle(peers[0], 'official:start', { mid: 13, revision: room.revision, commandId: '开始' });
      // 开发任务只写入本测试的私有临时目录。
      room.G = game(n); room.G.catalog = room.G.mission.catalog = 'campaign'; room.G.players.forEach((p, pi) => { p.pid = room.seats[pi].pid; });
      function send(pi, commandId, action, service = svc, state = room, ws = peers[pi]) { service.handle(ws, 'official:act', { gid: state.G.gid, revision: state.revision, commandId, pi: 0, action }); }
      let k = 0;
      while (room.G.phase === 'setup') {
        const pi = BB.setupActor(room.G), action = Bot.decide(room.G, pi); send(pi, '初始标记' + k++, action);
        if (room.G.phase === 'setup') peers.forEach((ws, owner) => { const pd = last(ws, 'official:view').view.pending; assert.equal('choices' in pd, owner === pd.to); });
      }
      const ids = room.G.wires.filter(w => BB.kindOf(w) === 'r').map(w => w.id), before = JSON.stringify(room.G);
      send(1, '冒用队长', { a: 'risky-cut', ws: ids, pi: 0 }); assert.equal(JSON.stringify(room.G), before);
      send(0, '三红宣告', { a: 'risky-cut', ws: ids }); const pd = room.G.pending;
      peers.forEach((ws, owner) => { const V = last(ws, 'official:view').view; assert.deepEqual(V.pending.ids, ids); assert.equal('ownAnswers' in V.pending, owner === pd.to); });
      const watching = peer(name); svc.handle(watching, 'hello', { name: '观战者' }); svc.handle(watching, 'official:perspective', { pid: room.seats[pd.to].pid });
      const spectator = last(watching, 'official:view').view; assert.equal(spectator.me, -1); assert(!('ownAnswers' in spectator.pending));
      const unchanged = JSON.stringify(room.G); svc.handle(watching, 'official:act', { gid: room.G.gid, revision: room.revision, commandId: '观战冒用', action: { a: 'risky-reply', id: pd.id } }); assert.equal(JSON.stringify(room.G), unchanged);
      svc.handle(peers[0], 'official:pause', { paused: true, gid: room.G.gid, revision: room.revision, commandId: '暂停' }); assert(room.G.paused);
      const paused = JSON.stringify(room.G); send(pd.to, '暂停中回应', { a: 'risky-reply', id: pd.id }); assert.equal(JSON.stringify(room.G), paused);
      svc.handle(peers[0], 'official:pause', { paused: false, gid: room.G.gid, revision: room.revision, commandId: '恢复' }); assert(!room.G.paused);
      send(pd.to, '第一人回应', { a: 'risky-reply', id: pd.id }); assert(room.G.pending); assert(room.G.wires.every(w => !w.cut));
      const next = room.G.pending.to, credential = last(peers[next], 'official:welcome').credential, reconnected = peer(name);
      svc.handle(reconnected, 'hello', { credential, name: '玩家' + next }); assert(last(reconnected, 'official:view').view.pending.ownAnswers);
      const restarted = Service(wss, dir), state = restarted.load(name); assert.equal(state.G.officialState.module, 'risky-red-cut'); assert.deepEqual(state.G.pending, room.G.pending); assert.deepEqual(state.G.officialState.risky.side, room.G.officialState.risky.side);
      const saved = JSON.stringify(state.G); send(next, '旧决定', { a: 'risky-reply', id: pd.id - 1 }, restarted, state, reconnected); assert.equal(JSON.stringify(state.G), saved);
      let lastWho, lastCommand;
      while (state.G.pending) { lastWho = state.G.pending.to; lastCommand = '后续回应' + k++; send(lastWho, lastCommand, { a: 'risky-reply', id: pd.id }, restarted, state, lastWho === next ? reconnected : peers[lastWho]); }
      const revision = state.revision; send(lastWho, lastCommand, { a: 'risky-reply', id: pd.id }, restarted, state, lastWho === next ? reconnected : peers[lastWho]); assert.equal(state.revision, revision);
      assert(ids.every(id => state.G.wires[id].cut)); assert.equal(state.G.phase, 'play'); assert.equal(state.G.det, 0);
    }
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
