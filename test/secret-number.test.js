const assert = require('assert'), BB = require('../js/engine'), Bot = require('../js/bot'), M = require('../js/missions');
const seats = n => Array.from({ length: n }, (_, i) => ({ pid: 'p' + i, name: '玩家' + i }));
function rng(seed = 29) { return () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296); }
function game(n = 3, seed = 29, captain = 0) { return BB.createGame(M.get('official-development', 29), seats(n), { captain, rng: rng(seed) }); }
function act(G, pi, a) { assert.equal(BB.act(G, pi, a, { rng: rng() }), null, JSON.stringify(a)); }
function reject(G, pi, a) { const before = JSON.stringify(G); assert(BB.act(G, pi, a)); assert.equal(JSON.stringify(G), before); }
function test(name, f) { f(); console.log('✓', name); }
function setup(G) { while (G.phase === 'setup') { const pi = BB.setupActor(G); act(G, pi, Bot.decide(G, pi)); } }
function rig(hands = [[1, 1, 2, 2], [1, 3, 4, 4], [1, 2, 2, 3, 3, 5]]) {
  const G = game(hands.length); G.wires = []; G.players.forEach(p => { p.stands = [[]]; });
  hands.forEach((hand, o) => hand.forEach(v => { const id = G.wires.length; G.wires.push({ id, v, o, s: 0, cut: false, info: null }); G.players[o].stands[0].push(id); }));
  G.officialState.secretNumbers = { hands: [[5, 6], [7, 8], [1, 2, 3]], deck: [4, 9, 10, 11, 12], retired: [], chosen: null, cutValues: [], lastReveal: null };
  G.phase = 'play'; G.turn = 0; G.turnNo = 1; G.pending = { type: 'secret-number', step: 'choose', id: ++G.actionId, from: 0, to: 2 }; G.equip = []; return G;
}
function choose(G, value) { const pd = G.pending; act(G, pd.to, { a: 'secret-choose', id: pd.id, value }); }
function resolve(G, id) { const pd = G.pending; act(G, pd.to, { a: 'resolve', id: pd.id, w: id ?? BB.view(G, pd.to).pending.choices[0] }); }
function reveal(G) { const pd = G.pending; act(G, pd.to, { a: 'secret-reveal', id: pd.id }); }
function gear(G, n) { G.equip.push({ n, id: BB.EQUIP[n].id, used: false }); for (let i = 0; i < 2; i++) { const id = G.wires.length; G.wires.push({ id, v: n, o: 2, s: 0, cut: true, info: null }); G.players[2].stands[0].push(id); } }

test('第29关2–5人全部队长：48蓝、3已知红、无黄，私人数字牌右邻3张其余2张', () => {
  for (let n = 2; n <= 5; n++) for (let captain = 0; captain < n; captain++) for (let seed = 1; seed <= 20; seed++) {
    const G = game(n, seed, captain), state = G.officialState.secretNumbers;
    assert.equal(G.wires.length, 51); assert.equal(G.rmark.n, 3); assert.equal(G.ymark.n, 0); assert.equal(state.deck.length, 11 - 2 * n);
    assert.deepEqual(state.deck.concat(...state.hands).slice().sort((a, b) => a - b), Array.from({ length: 12 }, (_, i) => i + 1));
    G.players.forEach((p, pi) => { assert.equal(state.hands[pi].length, pi === (captain + n - 1) % n ? 3 : 2); assert.equal(BB.setupNeed(G, pi), n === 2 && pi === captain ? 0 : 1); assert.equal(p.dd, 1); });
    for (let pi = -1; pi < n; pi++) {
      const V = BB.view(G, pi), pub = BB.packPublic(G), packed = BB.unpack(pub, pi >= 0 ? BB.packHand(G, pi) : null, pi, BB.packChoice(G, pi));
      assert.deepEqual(V.official.secretNumbers.hand, pi >= 0 ? state.hands[pi] : []); assert.deepEqual(packed.official.secretNumbers.hand, V.official.secretNumbers.hand); assert(!JSON.stringify(V).includes('"deck":')); assert.deepEqual(pub.official.secretNumbers.hand, []);
      if (pi >= 0) assert.deepEqual(BB.unpack(pub, null, (pi + 1) % n, BB.packChoice(G, pi)).official.secretNumbers.hand, [], '其他玩家不能套用这份秘密手牌');
    }
    setup(G); assert.equal(G.pending.type, 'secret-number'); assert.equal(G.pending.to, (captain + n - 1) % n);
    for (let pi = -1; pi < n; pi++) assert.equal('choices' in BB.view(G, pi).pending, pi === G.pending.to);
  }
});

test('秘密选择不公开值，选错牌／冒用／过期／重复回应不变；成功仍由双方选择导线', () => {
  const G = rig(), pd = G.pending; reject(G, 0, { a: 'secret-choose', id: pd.id, value: 1 }); reject(G, 2, { a: 'secret-choose', id: pd.id, value: 12 }); reject(G, 2, { a: 'secret-choose', id: pd.id - 1, value: 1 }); choose(G, 1);
  assert(!G.pending); assert(!('chosen' in BB.view(G, -1).official.secretNumbers)); reject(G, 2, { a: 'secret-choose', id: pd.id, value: 2 });
  const target = G.wires.find(w => w.o === 1 && w.v === 1), copies = G.wires.filter(w => w.o === 0 && w.v === 1); act(G, 0, { a: 'dual', w: target.id, val: 1 }); resolve(G, target.id); resolve(G, copies.at(-1).id);
  assert.equal(G.pending.step, 'reveal'); assert.equal(G.turn, 0); assert.equal(G.det, 0); assert(!G.wires[copies[0].id].cut); assert.equal('choices' in BB.view(G, -1).pending, false);
  reject(G, 0, { a: 'secret-reveal', id: G.pending.id }); reveal(G); assert.equal(G.det, 1); assert.equal(G.turn, 1); assert(G.officialState.secretNumbers.hands[0].includes(1));
});

test('未命中不追加数字处罚；探测器仅未剪候选匹配秘密数字也不罚', () => {
  const G = rig(); choose(G, 1); act(G, 0, { a: 'dual', w: G.wires.find(w => w.o === 1 && w.v === 3).id, val: 1 }); resolve(G); reveal(G); assert.equal(G.det, 1);
  const H = rig(); choose(H, 3); const target = H.wires.find(w => w.o === 1 && w.v === 1), other = H.wires.find(w => w.o === 1 && w.v === 3); act(H, 0, { a: 'dd', ws: [target.id, other.id], val: 1 }); resolve(H, target.id); resolve(H); reveal(H); assert.equal(H.det, 0); assert(!H.wires[other.id].cut);
});

test('单拆四根只罚一格、完成数字退场；稳定器不抵消数字牌处罚', () => {
  const G = rig([[1, 1, 1, 1, 2], [2, 2, 3], [2, 3, 3, 3]]); choose(G, 1); act(G, 0, { a: 'solo', val: 1 }); reveal(G); assert.equal(G.det, 1); assert(G.officialState.secretNumbers.retired.includes(1)); assert(!G.officialState.secretNumbers.hands.flat().includes(1));
  const H = rig(); gear(H, 9); choose(H, 1); const target = H.wires.find(w => w.o === 1 && w.v === 1); act(H, 0, { a: 'dual', w: target.id, val: 1, stab: true }); resolve(H); resolve(H); H.det = H.detMax - 1; reveal(H); assert.equal(H.phase, 'lost'); assert.equal(H.det, H.detMax);
});

test('咖啡杯直接收牌不公开或追加处罚；一张时补牌，空手牌入牌堆及无牌右邻跳过', () => {
  const G = rig(); gear(G, 11); choose(G, 1); const old = G.officialState.secretNumbers.hands[0].slice(); act(G, 0, { a: 'equip', n: 11, p: 1 }); assert.equal(G.turn, 1); assert.equal(G.pending.step, 'choose'); assert.equal(G.det, 0); assert(old.every(v => G.officialState.secretNumbers.hands[0].includes(v))); assert(G.officialState.secretNumbers.hands[0].includes(1));
  const H = rig(); H.officialState.secretNumbers.hands[2] = [1, 3]; choose(H, 1); assert.equal(H.officialState.secretNumbers.hands[2].length, 2); assert(H.officialState.secretNumbers.hands[2].includes(4));
  const I = rig(); I.wires.filter(w => w.o === 0).forEach(w => { w.cut = true; }); I.turn = 1; I.pending.from = 1; I.pending.to = 2; choose(I, 1); const target = I.wires.find(w => w.o === 2 && w.v === 3); act(I, 1, { a: 'dual', w: target.id, val: 3 }); resolve(I); resolve(I); reveal(I); assert.equal(I.officialState.secretNumbers.hands[0].length, 0); assert(I.officialState.secretNumbers.deck.includes(5)); assert.equal(I.pending.to, 1);
});

test('第29关100局来源设置合法终局和64局私人信息机器人，无待决定循环', () => {
  let wins = 0, actions = 0;
  for (let n = 2; n <= 5; n++) for (let seed = 1; seed <= 25; seed++) {
    const G = game(n, seed * 104729, seed % n);
    for (let k = 0; k < 1500 && !['won', 'lost'].includes(G.phase); k++) {
      const pi = G.pending ? G.pending.to : G.phase === 'setup' ? BB.setupActor(G) : G.turn; let a;
      if (G.phase === 'setup') a = Bot.decide(G, pi);
      else if (G.pending?.type === 'secret-number') {
        const pd = G.pending, hand = G.wires.filter(w => w.o === G.turn && !w.cut && BB.kindOf(w) === 'b');
        a = pd.step === 'choose' ? { a: 'secret-choose', id: pd.id, value: BB.view(G, pi).pending.choices.find(v => hand.some(w => w.v !== v)) ?? BB.view(G, pi).pending.choices[0] } : { a: 'secret-reveal', id: pd.id };
      } else if (G.pending?.type === 'cut') a = { a: 'resolve', id: G.pending.id, w: G.pending.step === 'own' ? BB.view(G, pi).pending.choices.at(-1) : G.pending.ids.find(id => G.pending.vals.some(v => BB.matches(G.wires[id], v))) };
      else {
        const own = G.wires.filter(w => w.o === pi && !w.cut), secret = G.officialState.secretNumbers.chosen?.value;
        if (own.every(w => BB.kindOf(w) === 'r')) a = { a: 'red' };
        else { const value = (own.find(w => BB.kindOf(w) === 'b' && w.v !== secret) || own.find(w => BB.kindOf(w) === 'b')).v; a = BB.soloOk(G, pi, value) ? { a: 'solo', val: value } : { a: 'dual', val: value, w: G.wires.find(w => w.o !== pi && !w.cut && BB.matches(w, value)).id }; }
      }
      assert(a); act(G, pi, a); actions++;
      var remaining = Array.from({ length: 12 }, (_, i) => i + 1).filter(v => BB.cutCount(G, v) < 4);
      if (remaining.length === 1) {
        assert(!G.officialState.secretNumbers.hands.flat().includes(remaining[0]));
        assert(!G.officialState.secretNumbers.deck.includes(remaining[0]));
        assert.notEqual(G.officialState.secretNumbers.chosen?.value, remaining[0]);
      }
    }
    assert(['won', 'lost'].includes(G.phase)); wins += G.phase === 'won';
  }
  for (let n = 2; n <= 5; n++) for (let seed = 1; seed <= 16; seed++) { const G = game(n, seed); for (let k = 0; k < 1500 && !['won', 'lost'].includes(G.phase); k++) { const pi = G.pending ? G.pending.to : G.phase === 'setup' ? BB.setupActor(G) : G.turn, a = Bot.decide(G, pi); assert(a); act(G, pi, a); } assert(['won', 'lost'].includes(G.phase)); }
  console.log('  全信息' + wins + '/100局通关，共' + actions + '个合法动作；64局私人信息机器人合法终局。');
});

test('第29关2–5人权威联机：选牌与翻牌隐私、暂停、重连重启、冒用和重复指令', () => {
  const fs = require('fs'), os = require('os'), path = require('path'), Service = require('../server/official');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bb29-authority-')), wss = { clients: new Set() }, svc = Service(wss, dir);
  const last = (ws, topic) => ws.messages.filter(m => m.topic === topic).at(-1)?.data;
  function peer(room) { const ws = { room, readyState: 1, messages: [], send(raw) { this.messages.push(JSON.parse(raw)); } }; wss.clients.add(ws); return ws; }
  try {
    for (let n = 2; n <= 5; n++) {
      const name = 'bb-secret' + n, peers = Array.from({ length: n }, () => peer(name));
      peers.forEach((ws, pi) => svc.handle(ws, pi ? 'hello' : 'official:hello', { ruleset: 'campaign', mid: 29, name: '秘密玩家' + pi }));
      const room = svc.load(name); svc.handle(peers[0], 'official:start', { mid: 29, revision: room.revision, commandId: '开始' });
      let G, value;
      for (let seed = 1; seed < 100; seed++) { G = game(n, seed); value = G.officialState.secretNumbers.hands[n - 1].find(v => G.wires.some(w => w.o === 0 && w.v === v) && G.wires.some(w => w.o !== 0 && w.v === v)); if (value) break; }
      assert(value); room.G = G; G.catalog = G.mission.catalog = 'campaign'; G.players.forEach((p, pi) => { p.pid = room.seats[pi].pid; p.name = room.seats[pi].name; });
      function send(pi, commandId, action, service = svc, state = room, ws = peers[pi]) { service.handle(ws, 'official:act', { gid: state.G.gid, revision: state.revision, commandId, pi: (pi + 1) % n, action }); }
      let k = 0; while (G.phase === 'setup') { const pi = BB.setupActor(G); send(pi, '标记' + k++, Bot.decide(G, pi)); }
      const owner = G.pending.to, chooseId = G.pending.id;
      peers.forEach((ws, pi) => { const V = last(ws, 'official:view').view; assert.equal('choices' in V.pending, pi === owner); assert.deepEqual(V.official.secretNumbers.hand, G.officialState.secretNumbers.hands[pi]); });
      const frozen = JSON.stringify(G); send(0, '冒用选牌', { a: 'secret-choose', id: chooseId, value, pi: owner }); assert.equal(JSON.stringify(G), frozen);
      svc.handle(peers[0], 'official:pause', { paused: true, gid: G.gid, revision: room.revision, commandId: '暂停' }); const paused = JSON.stringify(G); send(owner, '暂停中选牌', { a: 'secret-choose', id: chooseId, value }); assert.equal(JSON.stringify(G), paused);
      svc.handle(peers[0], 'official:pause', { paused: false, gid: G.gid, revision: room.revision, commandId: '继续' });
      const credential = last(peers[owner], 'official:welcome').credential, reconnected = peer(name); svc.handle(reconnected, 'hello', { credential, name: '秘密玩家' + owner });
      const restored = Service(wss, dir), state = restored.load(name); assert.equal(state.G.pending.id, chooseId); assert.deepEqual(last(reconnected, 'official:view').view.pending.choices, state.G.officialState.secretNumbers.hands[owner]);
      send(owner, '选牌', { a: 'secret-choose', id: chooseId, value }, restored, state, reconnected); const selectedRev = state.revision;
      send(owner, '选牌', { a: 'secret-choose', id: chooseId, value }, restored, state, reconnected); assert.equal(state.revision, selectedRev);
      peers.forEach(ws => { const V = last(ws, 'official:view').view; assert(!('chosen' in V.official.secretNumbers)); assert(!V.pending); });
      const target = state.G.wires.find(w => w.o !== 0 && w.v === value); send(0, '宣告', { a: 'dual', w: target.id, val: value }, restored, state); let pd = state.G.pending;
      send(target.o, '公开命中', { a: 'resolve', id: pd.id, w: target.id }, restored, state); pd = state.G.pending; const own = BB.view(state.G, 0).pending.choices.at(-1); send(0, '本人选线', { a: 'resolve', id: pd.id, w: own }, restored, state);
      assert.equal(state.G.pending.step, 'reveal'); const revealId = state.G.pending.id, saved = JSON.stringify(state.G); send(owner, '旧翻牌', { a: 'secret-reveal', id: chooseId }, restored, state, reconnected); assert.equal(JSON.stringify(state.G), saved);
      const restarted = Service(wss, dir), again = restarted.load(name); assert.equal(again.G.pending.id, revealId); assert.equal(again.G.officialState.secretNumbers.chosen.value, value);
      const spectator = peer(name); restarted.handle(spectator, 'hello', { name: '观战', spectator: true }); const V = last(spectator, 'official:view').view; assert.deepEqual(V.official.secretNumbers.hand, []); assert(!('value' in V.pending));
      send(owner, '翻牌', { a: 'secret-reveal', id: revealId }, restarted, again, reconnected); assert.equal(again.G.det, 1); assert.equal(again.G.turn, 1); const revision = again.revision; send(owner, '翻牌', { a: 'secret-reveal', id: revealId }, restarted, again, reconnected); assert.equal(again.revision, revision);
    }
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('第29关发布目录与旧版改编存档：新局用官方模块，旧快照不换规则或版本', () => {
  const official = M.get('campaign', 29); assert(official.verified); assert.equal(official.contentVersion, M.CAMPAIGN_VERSION); assert.equal(official.officialModule, 'secret-number-pass');
  const fs = require('fs'), os = require('os'), path = require('path'), Service = require('../server/official'), dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bb29-compat-'));
  try {
    const G = BB.createGame(M.get('custom', 29), seats(3), { rng: rng() }); G.catalog = G.mission.catalog = 'campaign'; G.contentVersion = G.mission.contentVersion = 11; G.paused = true; G.pauseRemaining = null;
    const original = JSON.stringify(G.mission); fs.writeFileSync(path.join(dir, 'bb-old29.json'), JSON.stringify({ version: 1, name: 'bb-old29', host: 'p0', mid: 29, ruleset: 'campaign', attempts: 1, started: true, seats: seats(3), observers: [], revision: 7, seen: [], G }));
    const service = Service({ clients: new Set() }, dir), restored = service.load('bb-old29').G;
    assert.equal(restored.contentVersion, 11); assert.equal(restored.ruleset, 'custom'); assert.equal(JSON.stringify(restored.mission), original); assert(!restored.officialState); assert.equal(restored.mission.rules.timer, 60); assert(restored.mission.rules.noChat);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('普通失误到达终点立即失败，不再等待秘密翻牌，也不放最后的失败标记', () => {
  const G=rig(); choose(G,2); G.det=G.detMax-1; const target=G.wires.find(w=>w.o===1&&w.v===3); act(G,0,{a:'dual',w:target.id,val:1}); resolve(G,target.id); assert.equal(G.phase,'lost'); assert.equal(G.pending,null); assert(!G.wires[target.id].info); assert(G.result.why.includes('引爆器')); assert.equal(G.officialState.secretNumbers.lastReveal,null);
});

test('旧版已在终点却等待翻牌的快照恢复为失败，保存一次，保留原规则和版本', () => {
  const fs=require('fs'),os=require('os'),path=require('path'),Service=require('../server/official'),dir=fs.mkdtempSync(path.join(os.tmpdir(),'bb29-fatal-'));
  try {
    const G=rig(); choose(G,2); G.det=G.detMax; G.paused=true; G.pending={type:'secret-number',step:'reveal',id:9,from:0,to:2}; G.mission.contentVersion=12;
    fs.writeFileSync(path.join(dir,'bb-oldfatal.json'),JSON.stringify({version:1,name:'bb-oldfatal',host:'p0',mid:29,ruleset:'campaign',attempts:1,started:true,seats:seats(3),observers:[],revision:7,seen:[],G}));
    const svc=Service({clients:new Set()},dir),room=svc.load('bb-oldfatal'); assert.equal(room.G.phase,'lost'); assert.equal(room.G.pending,null); assert.equal(room.G.paused,false); assert.equal(room.G.mission.contentVersion,12); assert.equal(room.revision,8);
    const again=Service({clients:new Set()},dir).load('bb-oldfatal'); assert.equal(again.revision,8);
  } finally {fs.rmSync(dir,{recursive:true,force:true});}
});
