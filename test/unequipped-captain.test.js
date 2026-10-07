const assert = require('assert');
const BB = require('../js/engine'), Bot = require('../js/bot'), M = require('../js/missions');
const seats = n => Array.from({ length: n }, (_, i) => ({ pid: 'p' + i, name: '玩家' + i }));
function rng(seed = 28) { return () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296); }
function game(n = 3, seed = 28, captain = 0) { return BB.createGame(M.get('official-development', 28), seats(n), { captain, rng: rng(seed) }); }
function act(G, pi, a) { assert.equal(BB.act(G, pi, a, { rng: rng() }), null, JSON.stringify(a)); }
function reject(G, pi, a) { const before = JSON.stringify(G); assert(BB.act(G, pi, a)); assert.equal(JSON.stringify(G), before); }
function test(name, run) { run(); console.log('✓', name); }
function rig(hands = [[1, 1, 2, 2], [1, 3, 1.5, 4], [1, 2, 2, 5, 5]]) {
  const G = game(hands.length); G.officialState.unequippedCaptain = G.captain = 0; G.wires = []; G.players.forEach(p => { p.stands = [[]]; });
  hands.forEach((hand, o) => hand.forEach(v => { const id = G.wires.length; G.wires.push({ id, v, o, s: 0, cut: false, info: null }); G.players[o].stands[0].push(id); }));
  G.players.forEach(p => p.stands[0].sort((a, b) => G.wires[a].v - G.wires[b].v)); G.phase = 'play'; G.turn = 0; G.turnNo = 1; G.pending = null; G.equip = []; return G;
}
function gear(G, n) { G.equip.push({ n, id: BB.EQUIP[n].id, used: false }); for (let k = 0; k < 2; k++) { const id = G.wires.length; G.wires.push({ id, v: n, o: G.np - 1, s: 0, cut: true, info: null }); G.players.at(-1).stands[0].push(id); } }
function finish(G, wanted) { const pd = G.pending, choices = BB.view(G, pd.to).pending.choices; act(G, pd.to, { a: 'resolve', id: pd.id, w: wanted ?? (choices.length ? choices[0] : null) }); }

test('第28关2–5人设置：保留指定队长、移除其角色、蓝红黄数、独立排序及均衡线架', () => {
  for (let n = 2; n <= 5; n++) {
    let bottom = false;
    for (let captain = 0; captain < n; captain++) for (let seed = 1; seed <= 20; seed++) {
      const G = game(n, seed, captain); bottom ||= G.equip.some(e => e.n === 13);
      assert.equal(G.captain, captain); assert.equal(BB.unequippedCaptain(G), captain); assert.equal(G.detMax, n);
      assert.equal(G.wires.filter(w => BB.kindOf(w) === 'b').length, 48); assert.equal(G.rmark.n, n === 2 ? 3 : 2); assert.equal(G.rmark.cand.length, G.rmark.n); assert.equal(G.ymark.n, 4); assert.equal(G.ymark.cand.length, 4); assert.equal(G.equip.length, n);
      G.players.forEach((p, pi) => { assert.equal(p.dd, pi === captain ? 0 : 1); assert.equal(!!p.character.removed, pi === captain); assert.equal(BB.setupNeed(G, pi), 1); assert.equal(BB.equipmentAllowed(BB.view(G, pi), pi), pi !== captain); assert.equal(p.stands.length, n === 2 || n === 3 && pi === captain ? 2 : 1); p.stands.forEach(st => { const v = st.map(id => G.wires[id].v); assert.deepEqual(v, v.slice().sort((a, b) => a - b)); }); });
      const lengths = G.players.flatMap(p => p.stands.map(st => st.length)); assert(Math.max(...lengths) - Math.min(...lengths) <= 1);
      for (let pi = -1; pi < n; pi++) { const V = BB.view(G, pi); assert.equal(BB.unequippedCaptain(V), captain); V.players.forEach((p, owner) => p.stands.flat().forEach(w => { if (owner !== pi) assert.equal(w.v, null); })); }
    }
    assert(bottom, '不能排除底盒来提前认证本关');
  }
});

test('队长普通猜错蓝或红立即爆炸；成功仍公开目标，再由本人选择重复手牌', () => {
  for (const value of [3, 1.5]) {
    const G = rig(), wrong = G.wires.find(w => w.o === 1 && w.v === value);
    act(G, 0, { a: 'dual', w: wrong.id, val: 1 }); assert.equal(G.phase, 'play'); reject(G, 0, { a: 'resolve', id: G.pending.id, w: wrong.id }); finish(G);
    assert.equal(G.phase, 'lost'); assert.equal(G.det, 0); assert(G.result.why.includes('队长')); assert.equal(G.declaration.result.matched, false); assert(!G.wires[wrong.id].info);
  }
  const H = rig(), target = H.wires.find(w => w.o === 1 && w.v === 1), own = H.wires.filter(w => w.o === 0 && w.v === 1).at(-1), first = H.wires.find(w => w.o === 0 && w.v === 1);
  act(H, 0, { a: 'dual', w: target.id, val: 1 }); finish(H, target.id); assert.equal(BB.view(H, -1).pending.hit, target.id); assert(!('choices' in BB.view(H, 1).pending)); finish(H, own.id);
  assert(H.wires[own.id].cut && H.wires[target.id].cut && !H.wires[first.id].cut); assert.equal(H.phase, 'play'); assert.equal(H.players[0].dd, 0); assert.equal(H.players[1].dd, 1);
  const I = rig(); I.turn = 1; const wrong = I.wires.find(w => w.o === 0 && w.v === 2); act(I, 1, { a: 'dual', w: wrong.id, val: 1 }); finish(I); assert.equal(I.phase, 'play'); assert.equal(I.det, 1); assert.equal(I.wires[wrong.id].info.v, 2);
});

test('队长不能主动用任何共享或个人装备，队友稳定器不能代保；拒绝完全不变', () => {
  const G = rig(); for (let n = 1; n <= 13; n++) { gear(G, n); reject(G, 0, { a: 'equip', n }); }
  const target = G.wires.find(w => w.o === 1 && w.v === 3), ws = G.wires.filter(w => w.o === 1 && !w.cut).slice(0, 2).map(w => w.id);
  for (const a of [{ a: 'dd', ws, val: 1 }, { a: 'character', ws, val: 1 }, { a: 'dual', w: target.id, val: 1, stab: true }, { a: 'dual', w: target.id, val: 1, xy: true, vals: [1, 2] }]) reject(G, 0, a);
  reject(G, 1, { a: 'equip', n: 9 }); assert(G.equip.every(e => !e.used));
  G.stab = true; act(G, 0, { a: 'dual', w: target.id, val: 1 }); assert.equal(G.pending.stab, false); finish(G); assert.equal(G.phase, 'lost');
  const H = rig(); H.turn = 1; gear(H, 9); const wrong = H.wires.find(w => w.o === 0 && w.v === 2); act(H, 1, { a: 'dual', w: wrong.id, val: 1, stab: true }); finish(H); assert.equal(H.phase, 'play'); assert.equal(H.det, 0);
});

test('队长可参与别人发起的对讲机与雷达，电池不能恢复移除角色；单拆和红线公开正常', () => {
  const G = rig(); gear(G, 2); const given = G.wires.find(w => w.o === 1 && w.v === 3), returned = G.wires.find(w => w.o === 0 && w.v === 2); given.info = { t: 'v', v: 3 };
  act(G, 1, { a: 'equip', n: 2, w: given.id, p: 0 }); assert.equal(G.pending.to, 0); act(G, 0, { a: 'walkie', w: returned.id, id: G.pending.id }); assert.equal(G.wires[given.id].o, 0); assert.deepEqual(G.wires[given.id].info, { t: 'v', v: 3 }); assert.equal(G.turn, 0);
  const H = rig(); gear(H, 8); act(H, 1, { a: 'equip', n: 8, val: 1 }); assert.equal(H.radar.res[0][0], true);
  gear(H, 7); H.players[2].dd = 0; H.players[2].character.used = true; reject(H, 1, { a: 'equip', n: 7, players: [0] }); act(H, 1, { a: 'equip', n: 7, players: [2] }); assert.equal(H.players[0].dd, 0); assert(H.players[0].character.removed); assert.equal(H.players[2].dd, 1);
  const I = rig([[2, 2, 2, 2, 1.5], [1, 1], [1, 1]]); act(I, 0, { a: 'solo', val: 2 }); I.turn = 0; act(I, 0, { a: 'red' }); assert.equal(I.phase, 'play');
  assert.equal(BB.unequippedCaptain(BB.createGame(M.get('custom', 28), seats(3), { rng: rng() })), null); assert.equal(M.get('campaign', 28).verified, false);
});
test('100局来源设置全信息通关及64局队长推理机器人合法终局', () => {
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

test('第28关2–5人权威联机：固定队长身份持久化、私有重复手牌、观战、暂停、重连重启及过期／重复命令', () => {
  const fs = require('fs'), os = require('os'), path = require('path'), Service = require('../server/official');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bb28-authority-')), wss = { clients: new Set() }, svc = Service(wss, dir);
  const last = (ws, topic) => ws.messages.filter(m => m.topic === topic).at(-1)?.data;
  function peer(room) { const ws = { room, readyState: 1, messages: [], send(raw) { this.messages.push(JSON.parse(raw)); } }; wss.clients.add(ws); return ws; }
  try {
    for (let n = 2; n <= 5; n++) {
      const name = 'bb-captain' + n, peers = Array.from({ length: n }, () => peer(name));
      peers.forEach((ws, pi) => svc.handle(ws, pi ? 'hello' : 'official:hello', { ruleset: 'campaign', mid: 28, name: '队长玩家' + pi }));
      const room = svc.load(name); svc.handle(peers[0], 'official:start', { mid: 28, revision: room.revision, commandId: '开始' });
      // 开发版只写入测试专用目录，公开战役不提前启用。
      room.G = game(n, n + 28); room.G.catalog = room.G.mission.catalog = 'campaign'; room.G.players.forEach((p, pi) => { p.pid = room.seats[pi].pid; p.name = room.seats[pi].name; });
      function send(pi, commandId, action, service = svc, state = room, ws = peers[pi]) { service.handle(ws, 'official:act', { gid: state.G.gid, revision: state.revision, commandId, pi: (pi + 1) % n, action }); }
      let k = 0;
      while (room.G.phase === 'setup') { const pi = BB.setupActor(room.G); send(pi, '标记' + k++, Bot.decide(room.G, pi)); }
      const captain = BB.unequippedCaptain(room.G), own = room.G.wires.filter(w => w.o === captain && !w.cut && BB.kindOf(w) === 'b');
      const value = own.find(w => own.filter(x => x.v === w.v).length >= 2 && room.G.wires.some(x => x.o !== captain && !x.cut && x.v === w.v)).v;
      const target = room.G.wires.find(w => w.o !== captain && !w.cut && w.v === value), before = JSON.stringify(room.G);
      send((captain + 1) % n, '冒用队长', { a: 'dual', w: target.id, val: value, pi: captain }); assert.equal(JSON.stringify(room.G), before);
      send(captain, '队长宣告', { a: 'dual', w: target.id, val: value }); const decision = room.G.pending.id;
      peers.forEach((ws, pi) => { const V = last(ws, 'official:view').view; assert.equal(BB.unequippedCaptain(V), captain); assert.deepEqual(V.pending.ids, [target.id]); assert.equal('choices' in V.pending, pi === target.o); });
      const watching = peer(name); svc.handle(watching, 'hello', { name: '观战者', spectator: true }); svc.handle(watching, 'official:perspective', { pid: room.seats[target.o].pid });
      const spectator = last(watching, 'official:view').view; assert.equal(spectator.me, -1); assert.equal(BB.unequippedCaptain(spectator), captain); assert(!('choices' in spectator.pending));
      const frozen = JSON.stringify(room.G); svc.handle(watching, 'official:act', { gid: room.G.gid, revision: room.revision, commandId: '观战冒用', action: { a: 'resolve', id: decision, w: target.id } }); assert.equal(JSON.stringify(room.G), frozen);
      svc.handle(peers[0], 'official:pause', { paused: true, gid: room.G.gid, revision: room.revision, commandId: '暂停' }); assert(room.G.paused);
      const paused = JSON.stringify(room.G); send(target.o, '暂停中回答', { a: 'resolve', id: decision, w: target.id }); assert.equal(JSON.stringify(room.G), paused);
      svc.handle(peers[0], 'official:pause', { paused: false, gid: room.G.gid, revision: room.revision, commandId: '继续' });
      send(target.o, '公开命中', { a: 'resolve', id: decision, w: target.id }); assert.equal(room.G.pending.step, 'own');
      peers.forEach((ws, pi) => { const V = last(ws, 'official:view').view; assert.equal(V.pending.hit, target.id); assert.equal('choices' in V.pending, pi === captain); });
      const credential = last(peers[captain], 'official:welcome').credential, reconnected = peer(name);
      svc.handle(reconnected, 'hello', { credential, name: '队长玩家' + captain }); assert(last(reconnected, 'official:view').view.pending.choices.length >= 2);
      const restarted = Service(wss, dir), state = restarted.load(name); assert.equal(BB.unequippedCaptain(state.G), captain); assert.deepEqual(state.G.pending, room.G.pending);
      const saved = JSON.stringify(state.G); send(captain, '过期决定', { a: 'resolve', id: decision - 1, w: own[0].id }, restarted, state, reconnected); assert.equal(JSON.stringify(state.G), saved);
      const choices = BB.view(state.G, captain).pending.choices, chosen = choices.at(-1), first = choices[0];
      send(captain, '选择后一根', { a: 'resolve', id: decision, w: chosen }, restarted, state, reconnected);
      const revision = state.revision; send(captain, '选择后一根', { a: 'resolve', id: decision, w: chosen }, restarted, state, reconnected); assert.equal(state.revision, revision);
      assert(state.G.wires[chosen].cut && state.G.wires[target.id].cut && !state.G.wires[first].cut); assert.equal(state.G.phase, 'play'); assert.equal(state.G.det, 0); assert.equal(state.G.players[captain].dd, 0);
    }
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
