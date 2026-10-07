const assert = require('assert');
const BB = require('../js/engine'), Bot = require('../js/bot'), M = require('../js/missions');
const seats = n => Array.from({ length: n }, (_, i) => ({ pid: 'p' + i, name: '玩家' + i }));
function rng(seed = 11) { return () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296); }
function game(n = 3, seed = 11, captain = 0) { return BB.createGame(M.get('official-development', 11), seats(n), { captain, rng: rng(seed) }); }
function act(G, pi, a) { assert.equal(BB.act(G, pi, a, { rng: rng() }), null); }
function rejected(G, pi, a) { const before = JSON.stringify(G); const error = BB.act(G, pi, a); assert(error); assert.equal(JSON.stringify(G), before); return error; }
function test(name, run) { run(); console.log('✓', name); }
function rig(hands = [[1, 1, 5, 5], [1, 1, 5, 2], [2, 2, 2]]) {
  const G = game(hands.length); G.officialState.redNumber = 5; G.players.forEach(p => { p.stands = [[]]; }); G.wires = [];
  hands.forEach((hand, o) => hand.forEach(v => { const id = G.wires.length, wire = { id, v, o, s: 0, cut: false, info: null }; if (v === 5) wire.kind = 'r'; G.wires.push(wire); G.players[o].stands[0].push(id); }));
  G.players.forEach(p => p.stands[0].sort((a, b) => G.wires[a].v - G.wires[b].v)); G.equip = []; G.phase = 'play'; G.turn = 0; G.turnNo = 1; return G;
}
function dual(G, pi, target, own) {
  act(G, pi, { a: 'dual', w: target.id, val: BB.annOf(own) }); const id = G.pending.id;
  act(G, target.o, { a: 'resolve', id, w: target.id });
  assert.equal(BB.view(G, -1).pending.hit, target.id); assert(!('choices' in BB.view(G, -1).pending));
  act(G, pi, { a: 'resolve', id, w: own.id });
}
function unlock(G, n) { G.equip.push({ n, id: BB.EQUIP[n].id, used: false }); G.wires.filter(w => w.v === n && BB.kindOf(w) === 'b').slice(0, 2).forEach(w => { w.cut = true; }); }

test('第11关2–5人来源设置：保留48整数导线，四根玩法为红、黄线与队长标记例外', () => {
  const drawn = new Set(); let bottom = false;
  for (let n = 2; n <= 5; n++) for (let captain = 0; captain < n; captain++) for (let seed = 1; seed <= 20; seed++) {
    const G = game(n, seed, captain), number = BB.redNumber(G); drawn.add(number); bottom ||= G.equip.some(e => e.n === 13);
    assert(Number.isInteger(number) && number >= 1 && number <= 12);
    assert.equal(G.wires.filter(w => Number.isInteger(w.v)).length, 48); assert.equal(G.wires.filter(w => BB.kindOf(w) === 'r').length, 4); assert.equal(G.wires.filter(w => BB.kindOf(w) === 'b').length, 44);
    assert(G.wires.filter(w => w.kind === 'r').every(w => w.v === number));
    assert.equal(G.ymark.n, n === 2 ? 4 : 2); assert.equal(G.ymark.cand.length, G.ymark.n); assert.equal(G.rmark.n, 0);
    assert.equal(G.detMax, n); assert.equal(G.equip.length, n); assert.equal(new Set(G.equip.map(e => e.n)).size, n);
    assert(!G.equip.some(e => e.n === number)); assert(!G.equipmentReserve.includes(number));
    assert.equal(BB.setupNeed(G, captain), n === 2 ? 0 : 1); assert.equal(BB.setupActor(G), n === 2 ? 1 - captain : captain); assert(G.players.every(p => p.dd === 1));
    const lengths = G.players.flatMap((p, pi) => { assert.equal(p.stands.length, n === 2 || n === 3 && pi === captain ? 2 : 1); return p.stands.map(s => { const values = s.map(id => G.wires[id].v); assert.deepEqual(values, values.slice().sort((a, b) => a - b)); return s.length; }); });
    assert(Math.max(...lengths) - Math.min(...lengths) <= 1);
  }
  assert.equal(drawn.size, 12); assert(bottom, '开发模块保留底盒抽取资格，不擅自排除');
});

test('初始可标转红整数，双人队长不能标；有限标记、正常排序及私有颜色不泄露', () => {
  const G = game(), number = BB.redNumber(G); let marked = false;
  while (G.phase === 'setup') {
    const pi = BB.setupActor(G), wire = G.wires.find(w => w.o === pi && w.kind === 'r') || G.wires.find(w => w.o === pi && BB.kindOf(w) === 'b');
    act(G, pi, { a: 'info', w: wire.id }); marked ||= wire.v === number;
  }
  assert(marked); assert(G.wires.filter(w => w.v === number && w.info).every(w => w.info.v === number));
  for (let pi = -1; pi < G.np; pi++) {
    const V = BB.view(G, pi); assert.equal(V.official.redNumber, number);
    V.players.forEach((p, owner) => p.stands.flat().forEach(w => { if (owner !== pi && !w.cut) { assert.equal(w.v, null); assert(!('kind' in w)); } }));
    assert(!JSON.stringify(V).includes('equipmentReserve'));
    if (pi >= 0) { const U = BB.unpack(BB.packPublic(G), BB.packHand(G, pi), pi, BB.packChoice(G, pi)); assert.deepEqual(U.players[pi].stands, V.players[pi].stands); assert.deepEqual(U.players.filter((_, p) => p !== pi), V.players.filter((_, p) => p !== pi)); }
  }
  const H = game(2), captainWire = H.wires.find(w => w.o === H.captain && Number.isInteger(w.v)); rejected(H, H.captain, { a: 'info', w: captainWire.id });
  const classic = BB.createGame(M.get('custom', 11), seats(3), { rng: rng() }); assert(!classic.officialState); assert(classic.wires.every(w => !w.kind));
});

test('转红值不能宣告或单拆；命中目标实际按红线失败，稳定器可保护且不放假数字线索', () => {
  const G = rig(), red = G.wires.find(w => w.o === 1 && w.kind === 'r');
  assert(!BB.hasValue(G, 0, 5)); assert(BB.hasValue(G, 0, 'R')); assert(!BB.soloOk(G, 0, 5)); assert(!BB.soloOk(G, 0, 'R'));
  rejected(G, 0, { a: 'dual', w: red.id, val: 5 }); rejected(G, 0, { a: 'solo', val: 5 }); rejected(G, 0, { a: 'red' });
  act(G, 0, { a: 'dual', w: red.id, val: 1 }); assert.equal(BB.view(G, 1).pending.noSafe, true);
  rejected(G, 1, { a: 'resolve', id: G.pending.id, w: red.id }); act(G, 1, { a: 'resolve', id: G.pending.id, w: null });
  assert.equal(G.phase, 'lost'); assert(!G.wires[red.id].info); assert(!G.wires[red.id].cut);
  const H = rig([[1, 1, 5, 5], [1, 1, 5, 2], [2, 2, 2, 9, 9]]); unlock(H, 9);
  act(H, 0, { a: 'dual', w: red.id, val: 1, stab: true }); act(H, 1, { a: 'resolve', id: H.pending.id, w: null });
  assert.equal(H.phase, 'play'); assert.equal(H.det, 0); assert(H.equip.find(e => e.n === 9).used); assert(!H.wires[red.id].info); assert(!H.wires[red.id].cut);
});

test('探测器只选匹配安全线，红线留到行动公开；不能自动胜利，公开不算蓝值完成', () => {
  const G = rig(); const pi = 0, target = G.wires.find(w => w.o === 1 && w.v === 1), red = G.wires.find(w => w.o === 1 && w.kind === 'r');
  act(G, pi, { a: 'dd', ws: [target.id, red.id], val: 1 }); assert.deepEqual(BB.view(G, 1).pending.choices, [target.id]);
  act(G, 1, { a: 'resolve', id: G.pending.id, w: target.id }); act(G, 0, { a: 'resolve', id: G.pending.id, w: G.wires.filter(w => w.o === 0 && w.v === 1).at(-1).id });
  assert.equal(G.players[0].dd, 0); assert.equal(G.players[1].dd, 1);
  const H = rig(); H.wires.filter(w => BB.kindOf(w) !== 'r').forEach(w => { w.cut = true; });
  assert.equal(H.phase, 'play'); assert.equal(BB.canAct(H, 0), true); act(H, 0, { a: 'red' }); assert.equal(H.phase, 'play');
  act(H, H.turn, { a: 'red' }); assert.equal(H.phase, 'won'); assert.equal(BB.cutCount(H, 5), 0); assert.equal(BB.cutCount(H, 'R'), 3);
});

test('雷达不把转红整数算蓝，便利贴不能贴转红线；对讲机交换保留颜色和已有标记', () => {
  const G = rig([[1, 1, 5, 5], [1, 1, 5, 2], [2, 2, 2, 4, 4, 8, 8]]); unlock(G, 8); unlock(G, 4);
  act(G, 2, { a: 'equip', n: 8, val: 5 }); assert(G.radar.res.every(racks => racks.every(yes => !yes)));
  rejected(G, 0, { a: 'equip', n: 4, w: G.wires.find(w => w.o === 0 && w.kind === 'r').id });
  unlock(G, 2); const red = G.wires.find(w => w.o === 0 && w.kind === 'r'), incoming = G.wires.find(w => w.o === 1 && w.v === 1); G.wires[red.id].info = { t: 'v', v: 5 };
  act(G, 0, { a: 'equip', n: 2, w: red.id, p: 1 }); const id = G.pending.id; rejected(G, 1, { a: 'walkie', id: id - 1, w: incoming.id }); act(G, 1, { a: 'walkie', id, w: incoming.id });
  const moved = G.wires[red.id]; assert.equal(moved.o, 1); assert.equal(moved.v, 5); assert.equal(moved.kind, 'r'); assert.deepEqual(moved.info, { t: 'v', v: 5 });
  const V = BB.view(G, 1), mine = V.players[1].stands.flat().find(w => w.id === red.id); assert.equal(BB.kindOf(mine), 'r'); assert.equal(BB.annOf(mine), 'R');
  assert(!('kind' in BB.view(G, 0).players[1].stands.flat().find(w => w.id === red.id)));
});

test('推理只依据公开转红数字，已标转红线的红线概率为一，不读取实际隐藏颜色', () => {
  const G = rig(); G.wires.find(w => w.o === 1 && w.v === 5).info = { t: 'v', v: 5 };
  const id = G.wires.find(w => w.o === 1 && w.v === 5).id, originalRandom = Math.random;
  try {
    Math.random = rng(11); const A = Bot.infer(G, 0, 600); assert.equal(A[id].red, 1); assert.equal(A[id].P.R, 1);
    const H = JSON.parse(JSON.stringify(G)); H.wires.filter(w => w.o !== 0 && !w.cut && !w.info).forEach(w => { w.v = 11.5; w.kind = 'r'; });
    Math.random = rng(11); const B = Bot.infer(H, 0, 600); assert.deepEqual(B, A);
  } finally { Math.random = originalRandom; }
});

test('第11关开发版100局全信息通关和64局推理机器人合法终局，官方认证门槛仍保留', () => {
  let actions = 0, reveals = 0;
  for (let n = 2; n <= 5; n++) for (let seed = 1; seed <= 25; seed++) {
    const G = game(n, seed, seed % n);
    for (let k = 0; k < 1000 && G.phase !== 'won'; k++) {
      const pi = G.pending ? G.pending.to : G.phase === 'setup' ? BB.setupActor(G) : G.turn; let a;
      if (G.pending?.type === 'cut') { const pd = G.pending; a = { a: 'resolve', id: pd.id, w: pd.step === 'own' ? BB.view(G, pi).pending.choices.at(-1) : pd.ids.find(id => pd.vals.some(v => BB.matches(G.wires[id], v))) }; }
      else if (G.phase === 'setup') a = Bot.decide(G, pi);
      else { const own = G.wires.filter(w => w.o === pi && !w.cut); if (own.every(w => BB.kindOf(w) === 'r')) { a = { a: 'red' }; reveals++; } else { const value = BB.annOf(own.find(w => BB.kindOf(w) !== 'r')); a = BB.soloOk(G, pi, value) ? { a: 'solo', val: value } : { a: 'dual', val: value, w: G.wires.find(w => w.o !== pi && !w.cut && BB.matches(w, value)).id }; } }
      assert(a); act(G, pi, a); actions++;
    }
    assert.equal(G.phase, 'won'); assert.equal(G.det, 0); assert.equal(BB.cutCount(G, BB.redNumber(G)), 0); assert(G.wires.filter(w => w.kind === 'r').every(w => w.cut));
  }
  for (let n = 2; n <= 5; n++) for (let seed = 1; seed <= 16; seed++) { const G = game(n, seed, seed % n); for (let k = 0; k < 1000 && !['won', 'lost'].includes(G.phase); k++) { const pi = G.pending ? G.pending.to : G.phase === 'setup' ? BB.setupActor(G) : G.turn; const a = Bot.decide(G, pi); assert(a); act(G, pi, a); } assert(['won', 'lost'].includes(G.phase)); }
  assert.equal(M.get('campaign', 11).verified, false); assert.equal(M.get('physical', 11), null);
  console.log('  100局全信息通关，' + actions + '个合法动作，' + reveals + '次公开红线；另64局推理机器人合法终局。');
});

test('第11关开发版2–5人权威服务端：隐藏颜色、冒用拒绝、私人选择和重连重启去重', () => {
  const fs = require('fs'), os = require('os'), path = require('path'), Service = require('../server/official');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bb11-authority-')), wss = { clients: new Set() }, svc = Service(wss, dir);
  const last = (ws, topic) => ws.messages.filter(m => m.topic === topic).at(-1)?.data;
  function peer(room) { const ws = { room, readyState: 1, messages: [], send(raw) { this.messages.push(JSON.parse(raw)); } }; wss.clients.add(ws); return ws; }
  try {
    for (let n = 2; n <= 5; n++) {
      const name = 'bb-rednumber' + n, peers = Array.from({ length: n }, () => peer(name));
      peers.forEach((ws, pi) => svc.handle(ws, pi ? 'hello' : 'official:hello', { ruleset: 'campaign', mid: 11, name: '玩家' + pi }));
      const room = svc.load(name); svc.handle(peers[0], 'official:start', { mid: 11, revision: room.revision, commandId: '开始' });
      room.G = rig([[1, 1, 5, 5], [1, 1, 5, 5], ...Array.from({ length: n - 2 }, () => [2, 2])]); room.G.catalog = room.G.mission.catalog = 'campaign'; room.G.players.forEach((p, pi) => { p.pid = room.seats[pi].pid; });
      function send(pi, commandId, action, service = svc, state = room, ws = peers[pi]) { service.handle(ws, 'official:act', { gid: state.G.gid, revision: state.revision, commandId, pi: 0, action }); }
      const own = room.G.wires.filter(w => w.o === 0 && w.v === 1).at(-1), target = room.G.wires.find(w => w.o === 1 && w.v === 1);
      const initial = JSON.stringify(room.G); send(1, '冒用行动者', { a: 'dual', w: target.id, val: 1, pi: 0 }); assert.equal(JSON.stringify(room.G), initial);
      send(0, '宣告', { a: 'dual', w: target.id, val: 1 }); const pd = room.G.pending;
      assert(last(peers[1], 'official:view').view.pending.choices); assert(!last(peers[0], 'official:view').view.pending.choices);
      for (let pi = 0; pi < n; pi++) {
        const V = last(peers[pi], 'official:view').view; assert.equal(V.official.redNumber, 5);
        V.players.forEach((p, owner) => p.stands.flat().forEach(w => { if (owner !== pi && !w.cut) { assert.equal(w.v, null); assert(!('kind' in w)); } }));
      }
      const watching = peer(name); svc.handle(watching, 'hello', { name: '观战', spectator: true });
      const publicView = last(watching, 'official:view').view; assert(publicView.players.every(p => p.stands.flat().every(w => !('kind' in w)))); assert(!publicView.pending.choices);
      svc.handle(watching, 'official:perspective', { pid: room.seats[1].pid }); const handView = last(watching, 'official:view').view;
      assert(handView.players[1].stands.flat().some(w => w.kind === 'r')); assert(!handView.pending.choices);
      const before = JSON.stringify(room.G); send(1, '观战冒用回应', { a: 'resolve', id: pd.id, w: target.id }, svc, room, watching); assert.equal(JSON.stringify(room.G), before);
      send(1, '回应', { a: 'resolve', id: pd.id, w: target.id });
      const credential = last(peers[0], 'official:welcome').credential, reconnected = peer(name); svc.handle(reconnected, 'hello', { credential, name: '玩家0' });
      assert.equal(last(reconnected, 'official:view').view.pending.step, 'own');
      const wss2 = { clients: new Set([...peers, reconnected, watching]) }, restarted = Service(wss2, dir), state = restarted.load(name);
      assert.equal(BB.redNumber(state.G), 5); assert(state.G.wires.filter(w => w.v === 5).every(w => w.kind === 'r')); const saved = JSON.stringify(state.G);
      send(0, '旧决定', { a: 'resolve', id: pd.id - 1, w: own.id }, restarted, state, reconnected); assert.equal(JSON.stringify(state.G), saved);
      send(0, '选第二根', { a: 'resolve', id: pd.id, w: own.id }, restarted, state, reconnected); assert(state.G.wires[own.id].cut);
      const revision = state.revision; send(0, '选第二根', { a: 'resolve', id: pd.id, w: own.id }, restarted, state, reconnected); assert.equal(state.revision, revision);
      const again = Service(wss2, dir), loaded = again.load(name); send(0, '选第二根', { a: 'resolve', id: pd.id, w: own.id }, again, loaded, reconnected); assert.equal(loaded.revision, revision);
      assert(loaded.G.wires.filter(w => w.kind === 'r').every(w => !w.cut));
    }
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
