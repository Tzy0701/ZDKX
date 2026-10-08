const assert = require('assert');
const BB = require('../js/engine'), Bot = require('../js/bot'), M = require('../js/missions');
const seats = n => Array.from({ length: n }, (_, i) => ({ pid: 'p' + i, name: '玩家' + i }));
function rng(seed = 14) { return () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296); }
function game(n = 3, seed = 14, captain = 0) { return BB.createGame(M.get('official-development', 14), seats(n), { captain, rng: rng(seed) }); }
function act(G, pi, a) { assert.equal(BB.act(G, pi, a, { rng: rng() }), null, JSON.stringify(a)); }
function reject(G, pi, a) { const before = JSON.stringify(G); assert(BB.act(G, pi, a)); assert.equal(JSON.stringify(G), before); }
function test(name, run) { run(); console.log('✓', name); }
function rig(hands = [[1, 1, 2, 2], [1, 3, 1.5, 4], [1, 2, 2, 5, 5]]) {
  const G = game(hands.length); G.officialState.rookie = G.captain = 0; G.wires = []; G.players.forEach(p => { p.stands = [[]]; });
  hands.forEach((hand, o) => hand.forEach(v => { const id = G.wires.length; G.wires.push({ id, v, o, s: 0, cut: false, info: null }); G.players[o].stands[0].push(id); }));
  G.players.forEach(p => p.stands[0].sort((a, b) => G.wires[a].v - G.wires[b].v)); G.phase = 'play'; G.turn = 0; G.turnNo = 1; G.pending = null; G.equip = []; return G;
}
function gear(G, n) { G.equip.push({ n, id: BB.EQUIP[n].id, used: false }); for (let k = 0; k < 2; k++) { const id = G.wires.length; G.wires.push({ id, v: n, o: G.np - 1, s: 0, cut: true, info: null }); G.players.at(-1).stands[0].push(id); } }
function finish(G, wanted) { const pd = G.pending, choices = BB.view(G, pd.to).pending.choices; act(G, pd.to, { a: 'resolve', id: pd.id, w: wanted ?? (choices.length ? choices[0] : null) }); }

test('第14关2–5人来源设置、随机队长角色与新人、双人红黄调整和均衡线架', () => {
  for (const n of [2, 3, 4, 5]) {
    const rookies = new Set(); let bottom = false;
    for (let captain = 0; captain < n; captain++) for (let seed = 1; seed <= 20; seed++) {
      const G = game(n, seed, captain), rookie = BB.rookie(G); rookies.add(rookie); bottom ||= G.equip.some(e => e.n === 13);
      assert.equal(rookie, G.captain); assert.equal(G.turn, rookie); assert.equal(BB.setupActor(G), rookie); assert.equal(G.detMax, n);
      assert.equal(G.wires.filter(w => BB.kindOf(w) === 'b').length, 48); assert.equal(G.rmark.n, n === 2 ? 3 : 2); assert.equal(G.rmark.cand.length, G.rmark.n);
      assert.equal(G.ymark.n, n === 2 ? 4 : 2); assert.equal(G.ymark.cand.length, n === 2 ? 4 : 3); assert.equal(G.equip.length, n);
      G.players.forEach((p, pi) => { assert.equal(p.dd, 1); assert.equal(p.stands.length, n === 2 || n === 3 && pi === rookie ? 2 : 1); assert.equal(BB.setupNeed(G, pi), 1); p.stands.forEach(st => { const v = st.map(id => G.wires[id].v); assert.deepEqual(v, v.slice().sort((a, b) => a - b)); }); });
      const lengths = G.players.flatMap(p => p.stands.map(st => st.length)); assert(Math.max(...lengths) - Math.min(...lengths) <= 1);
      for (let pi = -1; pi < n; pi++) { const V = BB.view(G, pi); assert.equal(BB.rookie(V), rookie); V.players.forEach((p, owner) => p.stands.flat().forEach(w => { if (owner !== pi) assert.equal(w.v, null); })); assert(!JSON.stringify(V).includes('equipmentReserve')); }
    }
    assert.equal(rookies.size, n); assert(bottom, '开发版保留底盒抽取资格，不用排除装备来绕过核实门槛');
  }
});

test('新人蓝色猜错经被选玩家公开回应后立即爆炸，不推进引爆器也不伪造线索', () => {
  const G = rig(), wrong = G.wires.find(w => w.o === 1 && w.v === 3);
  act(G, 0, { a: 'dual', w: wrong.id, val: 1 }); assert.equal(G.phase, 'play'); assert.equal(G.pending.to, 1);
  reject(G, 0, { a: 'resolve', id: G.pending.id, w: wrong.id }); finish(G, wrong.id);
  assert.equal(G.phase, 'lost'); assert.equal(G.det, 0); assert.equal(G.lastAct.t, 'boom'); assert(!wrong.cut && !wrong.info); assert(G.result.why.includes('新人')); assert.equal(G.declaration.result.matched, false);
});

test('新人成功仍由队友选目标、本人选重复手牌；被别人当目标不触发新人失败例外', () => {
  const G = rig(), hit = G.wires.find(w => w.o === 1 && w.v === 1), own = G.wires.filter(w => w.o === 0 && w.v === 1).at(-1), first = G.wires.filter(w => w.o === 0 && w.v === 1)[0];
  act(G, 0, { a: 'dual', w: hit.id, val: 1 }); finish(G, hit.id); assert.equal(G.pending.to, 0); assert.equal(BB.view(G, -1).pending.hit, hit.id); assert(!('choices' in BB.view(G, 1).pending)); finish(G, own.id);
  assert.equal(G.phase, 'play'); assert(own.cut && hit.cut && !first.cut); assert.equal(G.players[0].dd, 1);
  const H = rig(); H.turn = 1; const target = H.wires.find(w => w.o === 0 && w.v === 2); act(H, 1, { a: 'dual', w: target.id, val: 1 }); finish(H, target.id);
  assert.equal(H.phase, 'play'); assert.equal(H.det, 1); assert.equal(target.info.v, 2);
});

test('稳定器直接用、复合修饰及队友代用均拒绝且不耗牌；旧保护状态不能保护新人', () => {
  const G = rig(); gear(G, 9); const target = G.wires.find(w => w.o === 1 && w.v === 3);
  reject(G, 0, { a: 'equip', n: 9 }); reject(G, 1, { a: 'equip', n: 9 }); reject(G, 0, { a: 'dual', w: target.id, val: 1, stab: true }); assert(!G.equip[0].used); assert.equal(BB.stabilizerAllowed(BB.view(G, 0), 0), false);
  G.turn = 1; reject(G, 0, { a: 'equip', n: 9 }); assert(BB.stabilizerAllowed(BB.view(G, 1), 1));
  act(G, 1, { a: 'dual', w: G.wires.find(w => w.o === 0 && w.v === 2).id, val: 1, stab: true }); finish(G); assert.equal(G.phase, 'play'); assert.equal(G.det, 0); assert(G.equip[0].used);
  const H = rig(); H.stab = true; act(H, 0, { a: 'dual', w: H.wires.find(w => w.o === 1 && w.v === 3).id, val: 1 }); assert.equal(H.pending.stab, false); finish(H); assert.equal(H.phase, 'lost');
});

test('双重、三重、超级与X/Y修饰都仍是新人的双人拆线；无匹配立即爆炸', () => {
  for (const kind of ['dd', 'triple', 'super', 'xy']) {
    const G = rig(), targets = G.wires.filter(w => w.o === 1 && w.v !== 1), blue = targets.find(w => Number.isInteger(w.v));
    if (kind === 'dd') act(G, 0, { a: 'dd', ws: targets.slice(0, 2).map(w => w.id), val: 1 });
    if (kind === 'triple') { gear(G, 3); act(G, 0, { a: 'equip', n: 3, ws: targets.map(w => w.id), val: 1 }); }
    if (kind === 'super') { G.wires.find(w => w.o === 1 && w.v === 1).cut = true; gear(G, 5); act(G, 0, { a: 'equip', n: 5, p: 1, s: 0, val: 1 }); }
    if (kind === 'xy') { gear(G, 10); act(G, 0, { a: 'dual', w: blue.id, val: 1, xy: true, vals: [1, 2] }); }
    finish(G); assert.equal(G.phase, 'lost', kind); assert.equal(G.det, 0); if (kind === 'dd') { assert.equal(G.players[0].dd, 0); assert.equal(G.players[1].dd, 1); }
  }
  const H = rig(), red = H.wires.find(w => w.o === 1 && BB.kindOf(w) === 'r'); act(H, 0, { a: 'dual', w: red.id, val: 1 }); finish(H); assert.equal(H.phase, 'lost');
  const I = rig(); act(I, 0, { a: 'dd', ws: I.wires.filter(w => w.o === 1 && [1, 3].includes(w.v)).map(w => w.id), val: 1 }); finish(I); finish(I); assert.equal(I.phase, 'play'); assert.equal(I.players[0].dd, 0); assert.equal(I.players[1].dd, 1);
});

test('新人单人拆线与红线公开照常；旧改编存档和无模块牌局不擅自加新人', () => {
  const G = rig([[2, 2, 2, 2, 1.5], [1, 1], [1, 1]]); act(G, 0, { a: 'solo', val: 2 }); assert.equal(G.phase, 'play'); G.turn = 0; act(G, 0, { a: 'red' }); assert.equal(G.phase, 'play');
  assert.equal(BB.rookie(BB.createGame(M.get('custom', 14), seats(3), { rng: rng() })), null);
  assert.equal(M.get('campaign', 14).verified, false); assert.equal(M.get('physical', 14), null);
});

test('100局来源设置全信息通关及64局新人推理机器人合法终局', () => {
  let actions = 0;
  for (let n = 2; n <= 5; n++) for (let seed = 1; seed <= 25; seed++) {
    const G = game(n, seed, seed % n);
    for (let k = 0; k < 1000 && G.phase !== 'won'; k++) {
      const pi = G.pending ? G.pending.to : G.phase === 'setup' ? BB.setupActor(G) : G.turn; let a;
      if (G.phase === 'setup') a = Bot.decide(G, pi);
      else if (G.pending?.type === 'cut') a = { a: 'resolve', id: G.pending.id, w: G.pending.step === 'own' ? BB.view(G, pi).pending.choices.at(-1) : G.pending.ids.find(id => G.pending.vals.some(v => BB.matches(G.wires[id], v))) };
      else { const own = G.wires.filter(w => w.o === pi && !w.cut); if (own.every(w => BB.kindOf(w) === 'r')) a = { a: 'red' }; else { const v = BB.annOf(own.find(w => BB.kindOf(w) !== 'r')); a = BB.soloOk(G, pi, v) ? { a: 'solo', val: v } : { a: 'dual', val: v, w: G.wires.find(w => w.o !== pi && !w.cut && BB.matches(w, v)).id }; } }
      assert(a); act(G, pi, a); actions++;
    }
    assert.equal(G.phase, 'won'); assert.equal(G.det, 0);
  }
  for (let n = 2; n <= 5; n++) for (let seed = 1; seed <= 16; seed++) { const G = game(n, seed); for (let k = 0; k < 1000 && !['won', 'lost'].includes(G.phase); k++) { const pi = G.pending ? G.pending.to : G.phase === 'setup' ? BB.setupActor(G) : G.turn, a = Bot.decide(G, pi); assert(a); act(G, pi, a); } assert(['won', 'lost'].includes(G.phase)); }
  console.log('  100局来源设置通关，共' + actions + '个合法动作；64局推理机器人合法终局。');
});

test('第14关2–5人权威联机：随机身份持久化、私有重复手牌、观战、暂停、重连重启及过期／重复命令', () => {
  const fs = require('fs'), os = require('os'), path = require('path'), Service = require('../server/official');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bb14-authority-')), wss = { clients: new Set() }, svc = Service(wss, dir);
  const last = (ws, topic) => ws.messages.filter(m => m.topic === topic).at(-1)?.data;
  function peer(room) { const ws = { room, readyState: 1, messages: [], send(raw) { this.messages.push(JSON.parse(raw)); } }; wss.clients.add(ws); return ws; }
  try {
    for (let n = 2; n <= 5; n++) {
      const name = 'bb-rookie' + n, peers = Array.from({ length: n }, () => peer(name));
      peers.forEach((ws, pi) => svc.handle(ws, pi ? 'hello' : 'official:hello', { ruleset: 'campaign', mid: 14, name: '新人玩家' + pi }));
      const room = svc.load(name); svc.handle(peers[0], 'official:start', { mid: 14, revision: room.revision, commandId: '开始' });
      // 开发版只写入测试专用目录，公开战役不提前启用。
      room.G = game(n, n + 14); room.G.catalog = room.G.mission.catalog = 'campaign'; room.G.players.forEach((p, pi) => { p.pid = room.seats[pi].pid; });
      function send(pi, commandId, action, service = svc, state = room, ws = peers[pi]) { service.handle(ws, 'official:act', { gid: state.G.gid, revision: state.revision, commandId, pi: (pi + 1) % n, action }); }
      let k = 0;
      while (room.G.phase === 'setup') { const pi = BB.setupActor(room.G); send(pi, '标记' + k++, Bot.decide(room.G, pi)); }
      const rookie = BB.rookie(room.G), own = room.G.wires.filter(w => w.o === rookie && !w.cut && BB.kindOf(w) === 'b');
      const value = own.find(w => own.filter(x => x.v === w.v).length >= 2 && room.G.wires.some(x => x.o !== rookie && !x.cut && x.v === w.v)).v;
      const target = room.G.wires.find(w => w.o !== rookie && !w.cut && w.v === value), before = JSON.stringify(room.G);
      send((rookie + 1) % n, '冒用新人', { a: 'dual', w: target.id, val: value, pi: rookie }); assert.equal(JSON.stringify(room.G), before);
      send(rookie, '新人宣告', { a: 'dual', w: target.id, val: value }); const decision = room.G.pending.id;
      peers.forEach((ws, pi) => { const V = last(ws, 'official:view').view; assert.equal(BB.rookie(V), rookie); assert.deepEqual(V.pending.ids, [target.id]); assert.equal('choices' in V.pending, pi === target.o); });
      const watching = peer(name); svc.handle(watching, 'hello', { name: '观战者', spectator: true }); svc.handle(watching, 'official:perspective', { pid: room.seats[target.o].pid });
      const spectator = last(watching, 'official:view').view; assert.equal(spectator.me, -1); assert.equal(BB.rookie(spectator), rookie); assert(!('choices' in spectator.pending));
      const frozen = JSON.stringify(room.G); svc.handle(watching, 'official:act', { gid: room.G.gid, revision: room.revision, commandId: '观战冒用', action: { a: 'resolve', id: decision, w: target.id } }); assert.equal(JSON.stringify(room.G), frozen);
      svc.handle(peers[0], 'official:pause', { paused: true, gid: room.G.gid, revision: room.revision, commandId: '暂停' }); assert(room.G.paused);
      const paused = JSON.stringify(room.G); send(target.o, '暂停中回答', { a: 'resolve', id: decision, w: target.id }); assert.equal(JSON.stringify(room.G), paused);
      svc.handle(peers[0], 'official:pause', { paused: false, gid: room.G.gid, revision: room.revision, commandId: '继续' });
      send(target.o, '公开命中', { a: 'resolve', id: decision, w: target.id }); assert.equal(room.G.pending.step, 'own');
      peers.forEach((ws, pi) => { const V = last(ws, 'official:view').view; assert.equal(V.pending.hit, target.id); assert.equal('choices' in V.pending, pi === rookie); });
      const credential = last(peers[rookie], 'official:welcome').credential, reconnected = peer(name);
      svc.handle(reconnected, 'hello', { credential, name: '新人玩家' + rookie }); assert(last(reconnected, 'official:view').view.pending.choices.length >= 2);
      const restarted = Service(wss, dir), state = restarted.load(name); assert.equal(BB.rookie(state.G), rookie); assert.deepEqual(state.G.pending, room.G.pending);
      const saved = JSON.stringify(state.G); send(rookie, '过期决定', { a: 'resolve', id: decision - 1, w: own[0].id }, restarted, state, reconnected); assert.equal(JSON.stringify(state.G), saved);
      const choices = BB.view(state.G, rookie).pending.choices, chosen = choices.at(-1), first = choices[0];
      send(rookie, '选择后一根', { a: 'resolve', id: decision, w: chosen }, restarted, state, reconnected);
      const revision = state.revision; send(rookie, '选择后一根', { a: 'resolve', id: decision, w: chosen }, restarted, state, reconnected); assert.equal(state.revision, revision);
      assert(state.G.wires[chosen].cut && state.G.wires[target.id].cut && !state.G.wires[first].cut); assert.equal(state.G.phase, 'play'); assert.equal(state.G.det, 0); assert.equal(state.G.players[rookie].dd, 1);
    }
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
