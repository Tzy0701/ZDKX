const assert = require('assert');
const BB = require('../js/engine'), Bot = require('../js/bot'), M = require('../js/missions');
function rng(seed = 17) { return () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296); }
const seats = n => Array.from({ length: n }, (_, i) => ({ pid: 'p' + i, name: '玩家' + i }));
function game(n = 3, seed = 17) { return BB.createGame(M.get('official-development', 17), seats(n), { rng: rng(seed), captain: 0 }); }
function act(G, pi, a) { assert.equal(BB.act(G, pi, a), null, JSON.stringify(a)); }
function reject(G, pi, a) { const before = JSON.stringify(G); assert(BB.act(G, pi, a)); assert.equal(JSON.stringify(G), before); }
function test(name, run) { run(); console.log('✓', name); }
function rig(hands = [[1, 2, 3, 5, 1.5], [1, 1, 3, 4, 6], [2, 3, 4, 6]]) {
  const G = game(hands.length); G.officialState.liar = G.captain = 0; G.officialState.fakeDecision = 1; G.officialState.initialIds = []; G.wires = [];
  G.players.forEach((p, pi) => { p.stands = [[]]; p.dd = pi === 0 ? 0 : 1; p.character = { id: 'double-detector', used: pi === 0, ...(pi === 0 ? { removed: true } : {}) }; });
  hands.forEach((hand, o) => hand.forEach(v => { const id = G.wires.length; G.wires.push({ id, v, o, s: 0, cut: false, info: null }); G.players[o].stands[0].push(id); }));
  G.players.forEach(p => p.stands[0].sort((a, b) => G.wires[a].v - G.wires[b].v)); G.phase = 'play'; G.turn = 1; G.turnNo = 1; G.pending = null; G.equip = []; G.setup = Object.fromEntries(G.players.map((_, pi) => [pi, 0])); G.setupNeeds = G.players.map((_, pi) => pi === 0 ? 2 : 1); return G;
}
function gear(G, n) { G.equip.push({ n, id: BB.EQUIP[n].id, used: false }); for (let i = 0; i < 2; i++) { const id = G.wires.length; G.wires.push({ id, v: n, o: G.np - 1, s: 0, cut: true, info: null }); G.players.at(-1).stands[0].push(id); } }
function finish(G, w, clueVal) { const pd = G.pending, V = BB.view(G, pd.to); act(G, pd.to, { a: 'resolve', id: pd.id, w: w ?? (V.pending.choices.length ? V.pending.choices[0] : null), clueVal }); }

test('第17关2–5人来源设置、公开随机身份、均衡线架及真正移除角色卡', () => {
  for (let n = 2; n <= 5; n++) {
    const holders = new Set();
    for (let seed = 1; seed <= 24; seed++) {
      const G = game(n, Math.imul(seed, 104729) >>> 0), liar = BB.liar(G); holders.add(liar); assert.equal(liar, G.captain); assert.equal(BB.setupActor(G), liar);
      assert.equal(G.wires.filter(w => BB.kindOf(w) === 'b').length, 48); assert.equal(G.rmark.n, n === 2 ? 3 : 2); assert.equal(G.rmark.cand.length, 3); assert.equal(G.ymark.n, 0); assert.equal(G.equip.length, n); assert(G.equip.every(e => e.n <= 12));
      G.players.forEach((p, pi) => { assert.equal(p.stands.length, n === 2 || n === 3 && pi === liar ? 2 : 1); assert.equal(BB.setupNeed(G, pi), pi === liar ? 2 : 1); assert.equal(p.dd, pi === liar ? 0 : 1); assert.equal(!!BB.characterState(p).removed, pi === liar); p.stands.forEach(st => { const values = st.map(id => G.wires[id].v); assert.deepEqual(values, values.slice().sort((a, b) => a - b)); }); });
      const lengths = G.players.flatMap(p => p.stands.map(st => st.length)); assert(Math.max(...lengths) - Math.min(...lengths) <= 1);
      for (let pi = -1; pi < n; pi++) { const V = BB.view(G, pi); assert.equal(BB.liar(V), liar); assert.equal(!!V.official.fakeSetup, pi === liar); V.players.forEach((p, owner) => p.stands.flat().forEach(w => { if (owner !== pi) assert.equal(w.v, null); })); assert(!JSON.stringify(V).includes('equipmentReserve')); }
    }
    assert.equal(holders.size, n);
  }
});

test('错误初始标记由本人选线和值；不许标真值、红线、重复线或旧决定，拒绝完整不变', () => {
  const G = rig(); G.phase = 'setup'; G.turn = 0;
  const blue = G.wires.find(w => w.o === 0 && w.v === 1), red = G.wires.find(w => w.o === 0 && BB.kindOf(w) === 'r');
  reject(G, 1, { a: 'info', w: G.players[1].stands[0][0] }); reject(G, 0, { a: 'info', id: 1, w: blue.id, val: 1 }); reject(G, 0, { a: 'info', id: 1, w: red.id, val: 2 }); reject(G, 0, { a: 'info', w: blue.id, val: 2 });
  act(G, 0, { a: 'info', id: 1, w: blue.id, val: 3 }); assert.deepEqual(G.wires[blue.id].info, { t: 'not', v: '3' }); assert.equal(BB.setupActor(G), 0);
  reject(G, 0, { a: 'info', id: 1, w: G.wires.find(w => w.o === 0 && w.v === 2).id, val: 3 }); reject(G, 0, { a: 'info', id: 2, w: blue.id, val: 4 });
  act(G, 0, { a: 'info', id: 2, w: G.wires.find(w => w.o === 0 && w.v === 2).id, val: 3 }); assert.equal(BB.setupActor(G), 1); assert(!BB.view(G, 0).official.fakeSetup);
  act(G, 1, { a: 'info', w: G.wires.find(w => w.o === 1 && w.v === 3).id }); assert.equal(G.announcement.info.v, 3); assert.equal(G.wires.filter(w => w.info && Number(w.info.v) === 3).length, 2); assert.equal(G.setup[1], 1);
  const saved = JSON.stringify(G); assert(BB.act(G, 0, { a: 'info', id: 2, w: blue.id, val: 4 })); assert.equal(JSON.stringify(G), saved);
});

test('蓝线猜错说谎者时标猜测值而非实际值；探测器仍由目标选线，X/Y错误标记由目标选值', () => {
  const G = rig(), target = G.wires.find(w => w.o === 0 && w.v === 2); act(G, 1, { a: 'dual', w: target.id, val: 1 }); finish(G, target.id);
  assert.equal(G.det, 1); assert.equal(G.phase, 'play'); assert.deepEqual(target.info, { t: 'not', v: '1' }); assert.equal(G.declaration.result.matched, false); assert.equal(BB.view(G, 2).players[0].stands.flat().find(w => w.id === target.id).v, null);
  const H = rig(); gear(H, 10); const wrong = H.wires.find(w => w.o === 0 && w.v === 2); act(H, 1, { a: 'dual', w: wrong.id, val: 1, xy: true, vals: [1, 4] });
  assert.deepEqual(BB.view(H, 0).pending.clueValues, [1, 4]); assert(!('clueValues' in BB.view(H, 1).pending)); reject(H, 0, { a: 'resolve', id: H.pending.id, w: wrong.id }); reject(H, 0, { a: 'resolve', id: H.pending.id, w: wrong.id, clueVal: 5 }); finish(H, wrong.id, 4); assert.deepEqual(H.wires[wrong.id].info, { t: 'not', v: '4' });
  const I = rig(), ids = I.wires.filter(w => w.o === 0 && [2, 3].includes(w.v)).map(w => w.id); act(I, 1, { a: 'dd', ws: ids, val: 1 }); finish(I, ids[1]); assert.equal(I.wires[ids[0]].info, null); assert.deepEqual(I.wires[ids[1]].info, { t: 'not', v: '1' }); assert.equal(I.players[1].dd, 0);
});

test('命中仍公开如实回应并选择重复手牌；普通玩家失败线索仍为真值，红线失败仍爆炸', () => {
  const G = rig(), target = G.wires.find(w => w.o === 0 && w.v === 1), duplicate = G.wires.filter(w => w.o === 1 && w.v === 1);
  act(G, 1, { a: 'dual', w: target.id, val: 1 }); reject(G, 0, { a: 'resolve', id: G.pending.id, w: G.wires.find(w => w.o === 0 && w.v === 2).id }); finish(G, target.id); assert.equal(BB.view(G, 2).pending.hit, target.id); finish(G, duplicate.at(-1).id); assert(!G.wires[duplicate[0].id].cut && G.wires[duplicate.at(-1).id].cut);
  const H = rig(); H.turn = 0; const blue = H.wires.find(w => w.o === 1 && w.v === 4); act(H, 0, { a: 'dual', w: blue.id, val: 1 }); finish(H, blue.id); assert.deepEqual(blue.info, { t: 'v', v: 4 });
  const I = rig(), red = I.wires.find(w => w.o === 0 && BB.kindOf(w) === 'r'); act(I, 1, { a: 'dual', w: red.id, val: 1 }); finish(I); assert.equal(I.phase, 'lost');
});

test('说谎者不能主动用装备或组合修饰，电池不能恢复已移除角色；可参与对讲机与雷达', () => {
  const G = rig(); G.turn = 0; for (const n of [2, 7, 8, 9, 10]) gear(G, n);
  const target = G.wires.find(w => w.o === 1 && w.v === 1); for (const a of [{ a: 'equip', n: 8, val: 1 }, { a: 'equip', n: 2, w: G.players[0].stands[0][0], p: 1 }, { a: 'dd', ws: G.players[1].stands[0].slice(0, 2), val: 1 }, { a: 'dual', w: target.id, val: 1, xy: true, vals: [1, 2] }, { a: 'dual', w: target.id, val: 1, stab: true }]) reject(G, 0, a);
  G.turn = 1; G.players[1].dd = 0; G.players[1].character.used = true; reject(G, 1, { a: 'equip', n: 7, players: [0] }); act(G, 1, { a: 'equip', n: 7, players: [1] }); assert.equal(G.players[1].dd, 1); assert(BB.characterState(G.players[0]).removed);
  act(G, 1, { a: 'equip', n: 8, val: 2 }); assert(G.radar.res[0][0]);
  const wire = G.wires.find(w => w.o === 0 && w.v === 2); wire.info = { t: 'not', v: '4' };
  const offered = G.wires.find(w => w.o === 1 && w.v === 6); act(G, 1, { a: 'equip', n: 2, w: offered.id, p: 0 }); act(G, 0, { a: 'walkie', id: G.pending.id, w: wire.id }); assert.equal(wire.o, 1); assert.deepEqual(wire.info, { t: 'not', v: '4' }); assert.equal(G.players[0].dd, 0);
});

test('正负标记共用实体数值标记，已剪错误标记可被收回且不复制；机器人不将负信息当真值', () => {
  const G = rig(); gear(G, 4); const old = G.wires.find(w => w.o === 0 && w.v === 1); old.info = { t: 'not', v: '3' }; old.cut = true;
  G.wires.find(w => w.o === 0 && w.v === 2).info = { t: 'not', v: '3' };
  const target = G.wires.find(w => w.o === 1 && w.v === 3); act(G, 1, { a: 'equip', n: 4, w: target.id }); assert.equal(old.info, null); assert.deepEqual(target.info, { t: 'v', v: 3 });
  const H = game(3); const liar = BB.liar(H), observer = (liar + 1) % 3;
  while (H.phase === 'setup') { const pi = BB.setupActor(H); act(H, pi, Bot.decide(H, pi)); }
  const probabilities = Bot.infer(H, observer, 6000);
  H.wires.filter(w => w.o !== observer && w.info?.t === 'not').forEach(w => assert.equal(probabilities[w.id].P[w.info.v] || 0, 0));
  assert.equal(BB.liar(BB.createGame(M.get('custom', 17), seats(3), { rng: rng() })), null); assert.equal(M.get('campaign', 17).verified, true); assert.equal(M.get('physical', 17).officialModule, 'liar');
});

test('第17关100局来源配置全信息通关、64局推理机器人合法终局', () => {
  let actions = 0;
  for (let n = 2; n <= 5; n++) for (let seed = 1; seed <= 25; seed++) {
    const G = game(n, seed);
    for (let k = 0; k < 1000 && G.phase !== 'won'; k++) {
      const pi = G.pending ? G.pending.to : G.phase === 'setup' ? BB.setupActor(G) : G.turn; let a;
      if (G.phase === 'setup') a = Bot.decide(G, pi);
      else if (G.pending) a = { a: 'resolve', id: G.pending.id, w: G.pending.step === 'own' ? BB.view(G, pi).pending.choices.at(-1) : G.pending.ids.find(id => G.pending.vals.some(v => BB.matches(G.wires[id], v))) };
      else { const own = G.wires.filter(w => w.o === pi && !w.cut); if (own.every(w => BB.kindOf(w) === 'r')) a = { a: 'red' }; else { const value = BB.annOf(own.find(w => BB.kindOf(w) !== 'r')); a = BB.soloOk(G, pi, value) ? { a: 'solo', val: value } : { a: 'dual', val: value, w: G.wires.find(w => w.o !== pi && !w.cut && BB.matches(w, value)).id }; } }
      assert(a); act(G, pi, a); actions++;
    }
    assert.equal(G.phase, 'won'); assert.equal(G.det, 0);
  }
  for (let n = 2; n <= 5; n++) for (let seed = 1; seed <= 16; seed++) { const G = game(n, seed); for (let k = 0; k < 1000 && !['won', 'lost'].includes(G.phase); k++) { const pi = G.pending ? G.pending.to : G.phase === 'setup' ? BB.setupActor(G) : G.turn; const a = Bot.decide(G, pi); assert(a); act(G, pi, a); } assert(['won', 'lost'].includes(G.phase)); }
  console.log('  100局通关，共' + actions + '个合法动作；64局机器人合法终局。');
});

test('第17关2–5人权威服务端：错误标记选择私有、观战禁操作、决定重连重启、暂停及去重', () => {
  const fs = require('fs'), os = require('os'), path = require('path'), Service = require('../server/official');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bb17-authority-')), wss = { clients: new Set() };
  const last = (ws, topic) => ws.messages.filter(m => m.topic === topic).at(-1)?.data;
  function peer(room) { const ws = { room, readyState: 1, messages: [], send(raw) { this.messages.push(JSON.parse(raw)); } }; wss.clients.add(ws); return ws; }
  try {
    for (let n = 2; n <= 5; n++) {
      let svc = Service(wss, dir); const name = 'bb-liar' + n, peers = Array.from({ length: n }, () => peer(name));
      peers.forEach((ws, pi) => svc.handle(ws, pi ? 'hello' : 'official:hello', { ruleset: 'campaign', mid: 17, name: '说谎验收' + pi }));
      let room = svc.load(name); svc.handle(peers[0], 'official:start', { mid: 17, revision: room.revision, commandId: '开始' });
      room.G = game(n, Math.imul(n, 104729)); room.G.catalog = room.G.mission.catalog = 'campaign'; room.G.players.forEach((p, pi) => { p.pid = room.seats[pi].pid; p.name = room.seats[pi].name; });
      const send = (pi, commandId, action, ws = peers[pi]) => svc.handle(ws, 'official:act', { gid: room.G.gid, revision: room.revision, commandId, pi: (pi + 1) % n, action });
      const liar = BB.liar(room.G); send(liar, '第一枚错误标记', Bot.decide(room.G, liar));
      peers.forEach((ws, pi) => { const V = last(ws, 'official:view').view; assert.equal(BB.liar(V), liar); assert.equal(!!V.official.fakeSetup, pi === liar); });
      const watching = peer(name); svc.handle(watching, 'hello', { name: '观战者', spectator: true }); svc.handle(watching, 'official:perspective', { pid: room.seats[liar].pid }); assert(!last(watching, 'official:view').view.official.fakeSetup);
      const before = JSON.stringify(room.G), second = Bot.decide(room.G, liar); send((liar + 1) % n, '冒用说谎者', second); assert.equal(JSON.stringify(room.G), before);
      svc.handle(watching, 'official:act', { gid: room.G.gid, revision: room.revision, commandId: '观战冒用', action: second }); assert.equal(JSON.stringify(room.G), before);
      const credential = last(peers[liar], 'official:welcome').credential, reconnected = peer(name); svc.handle(reconnected, 'hello', { credential, name: '说谎验收' + liar }); assert.equal(last(reconnected, 'official:view').view.official.fakeSetup.id, second.id);
      svc = Service(wss, dir); room = svc.load(name); assert.equal(BB.liar(room.G), liar); assert.deepEqual(BB.view(room.G, liar).official.fakeSetup.usedIds, room.G.officialState.initialIds);
      send(liar, '过期错误标记', { ...second, id: second.id - 1 }, reconnected); assert.equal(JSON.stringify(room.G), before);
      send(liar, '第二枚错误标记', second, reconnected); const r = room.revision; send(liar, '第二枚错误标记', second, reconnected); assert.equal(room.revision, r);
      let k = 0; while (room.G.phase === 'setup') { const pi = BB.setupActor(room.G); send(pi, '正常标记' + k++, Bot.decide(room.G, pi)); }
      // 依法完成一轮，把回合移交给普通玩家，再测试失败回应的恢复。
      while (room.G.turn === liar) {
        const own = room.G.wires.filter(w => w.o === liar && !w.cut && BB.kindOf(w) === 'b'), value = own[0].v;
        if (BB.soloOk(room.G, liar, value)) send(liar, '说谎者正常单拆', { a: 'solo', val: value });
        else { const target = room.G.wires.find(w => w.o !== liar && !w.cut && w.v === value); send(liar, '说谎者如实猜测', { a: 'dual', w: target.id, val: value }); send(target.o, '如实回答', { a: 'resolve', id: room.G.pending.id, w: target.id }); send(liar, '本人选线', { a: 'resolve', id: room.G.pending.id, w: own[0].id }, reconnected); }
      }
      const actor = room.G.turn, value = room.G.wires.find(w => w.o === actor && !w.cut && BB.kindOf(w) === 'b').v, target = room.G.wires.find(w => w.o === liar && !w.cut && BB.kindOf(w) === 'b' && w.v !== value);
      send(actor, '猜错说谎者', { a: 'dual', w: target.id, val: value }); const decision = room.G.pending.id;
      peers.forEach((ws, pi) => { const V = last(ws, 'official:view').view; assert.equal('clueValues' in V.pending, pi === liar); }); assert(!('clueValues' in last(watching, 'official:view').view.pending));
      svc.handle(peers[0], 'official:pause', { paused: true, gid: room.G.gid, revision: room.revision, commandId: '暂停' }); const paused = JSON.stringify(room.G); send(liar, '暂停中回答', { a: 'resolve', id: decision, w: target.id }, reconnected); assert.equal(JSON.stringify(room.G), paused);
      svc.handle(peers[0], 'official:pause', { paused: false, gid: room.G.gid, revision: room.revision, commandId: '继续' }); svc = Service(wss, dir); room = svc.load(name); assert.equal(room.G.pending.id, decision);
      send(liar, '公开未命中', { a: 'resolve', id: decision, w: target.id }, reconnected); const finalRevision = room.revision; send(liar, '公开未命中', { a: 'resolve', id: decision, w: target.id }, reconnected); assert.equal(room.revision, finalRevision); assert.equal(room.G.det, 1); assert.equal(room.G.phase, 'play');
      assert(room.G.wires[target.id].info?.t === 'not' && room.G.wires[target.id].info.v === String(value) || room.G.announcement?.info.t === 'not' && room.G.announcement.info.v === String(value));
    }
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
