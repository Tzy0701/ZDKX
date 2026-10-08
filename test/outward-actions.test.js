const assert = require('assert'), BB = require('../js/engine'), M = require('../js/missions'), Bot = require('../js/bot');
function rng(seed = 38) { return () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296); }
const seats = n => Array.from({ length: n }, (_, i) => ({ pid: 'p' + i, name: '玩家' + i }));
function game(n = 3, seed = 38, captain = 0) { return BB.createGame(M.get('official-development', 38), seats(n), { captain, rng: rng(seed) }); }
function act(G, pi, a) { assert.equal(BB.act(G, pi, a), null, JSON.stringify(a)); }
function reject(G, pi, a) { const before = JSON.stringify(G); assert(BB.act(G, pi, a)); assert.equal(JSON.stringify(G), before); }
function test(name, f) { f(); console.log('✓', name); }
function rig(hands = [[1, 1, 2], [1, 3, 3], [1, 2, 2, 2]]) {
  const G = game(hands.length); G.wires = []; G.players.forEach(p => { p.stands = [[]]; });
  hands.forEach((hand, o) => hand.forEach(v => { const id = G.wires.length; G.wires.push({ id, v, o, s: 0, cut: false, info: null }); G.players[o].stands[0].push(id); }));
  G.officialState.outwardId = G.players[0].stands[0].at(-1); G.phase = 'play'; G.turn = 0; G.turnNo = 1; G.pending = null; return G;
}
function resolve(G, id) { const pd = G.pending, V = BB.view(G, pd.to); act(G, pd.to, { a: 'resolve', id: pd.id, w: id ?? (V.pending.choices.length ? V.pending.choices[0] : null) }); }

test('朝外双人：宣告可不在已知手牌；目标公开回应，队长只确认朝外线，正确剪断', () => {
  const G = rig(), id = G.officialState.outwardId, target = G.wires.find(w => w.o === 2 && w.v === 2); assert.equal(BB.hasValue(G, 0, 2), false);
  act(G, 0, { a: 'outward-dual', w: target.id, val: 2 }); assert.equal(G.pending.outwardOwn, id); reject(G, 0, { a: 'resolve', id: G.pending.id, w: id }); resolve(G, target.id);
  assert.deepEqual(BB.view(G, 0).pending.choices, [id]); assert.equal(BB.view(G, 0).players[0].stands[0].find(w => w.id === id).v, null); assert(!('choices' in BB.view(G, 1).pending));
  reject(G, 0, { a: 'resolve', id: G.pending.id, w: G.players[0].stands[0][0] }); resolve(G, id); assert(G.wires[id].cut && G.wires[target.id].cut); assert.equal(G.det, 0); assert.equal(G.players[0].dd, 1);
});

test('匹配或不匹配的朝外线给队长同样选项；猜错自己的线或目标蓝／红立即爆炸', () => {
  const G = rig(), id = G.officialState.outwardId, target = G.wires.find(w => w.o === 1 && w.v === 1); act(G, 0, { a: 'outward-dual', w: target.id, val: 1 }); resolve(G, target.id);
  assert.deepEqual(BB.view(G, 0).pending.choices, [id]); resolve(G, id); assert.equal(G.phase, 'lost'); assert.equal(G.det, 0); assert(!G.wires[target.id].cut); assert.equal(G.declaration.result.targetMatched, true); assert(G.declaration.result.outwardFailed);
  for (const value of [3, 3.5]) {
    const H = rig([[1, 2], [value, 2], [1, 1, 1, 2, 2]]), wrong = H.wires.find(w => w.o === 1 && w.v === value); act(H, 0, { a: 'outward-dual', w: wrong.id, val: 2 }); resolve(H); assert.equal(H.phase, 'lost'); assert.equal(H.det, 0); assert(!H.wires[wrong.id].info); assert.equal(H.declaration.result.targetMatched, false);
  }
});

test('朝外单拆四根和最后两根；错误猜测真正结算失败，不返回隐藏值验证错误', () => {
  const G = rig([[4, 4, 4, 4], [2, 2], [2, 2]]); assert(BB.outwardSoloValues(BB.view(G, 0)).includes(4)); act(G, 0, { a: 'outward-solo', val: 4 }); assert(G.wires.filter(w => w.o === 0).every(w => w.cut));
  const H = rig([[4, 5], [4, 4], [4, 5, 5, 5]]); H.wires.filter(w => w.o === 1).forEach(w => { w.cut = true; }); assert(BB.outwardSoloValues(BB.view(H, 0)).includes(4)); act(H, 0, { a: 'outward-solo', val: 4 }); assert.equal(H.phase, 'lost'); assert.equal(H.det, 0);
  const I = rig([[4, 4], [4, 4], [2, 2, 2, 2]]); I.wires.filter(w => w.o === 1).forEach(w => { w.cut = true; }); act(I, 0, { a: 'outward-solo', val: 4 }); assert(I.wires.filter(w => w.o === 0).every(w => w.cut));
  const J = rig(); reject(J, 0, { a: 'outward-solo', val: 2 }); reject(J, 1, { a: 'outward-solo', val: 1 });
});

test('朝外红线必须由队长宣告；非红宣告失败爆炸；其余非红未处理时不能公开', () => {
  const G = rig([[1.5, 3.5], [2, 2], [2, 2]]); assert(BB.outwardRedPossible(BB.view(G, 0))); reject(G, 0, { a: 'red' }); act(G, 0, { a: 'outward-red' }); assert(G.wires.filter(w => w.o === 0).every(w => w.cut)); assert.equal(G.phase, 'play');
  const H = rig([[1.5, 2], [2], [2, 2]]); assert(BB.outwardRedPossible(BB.view(H, 0))); act(H, 0, { a: 'outward-red' }); assert.equal(H.phase, 'lost');
  const I = rig([[1, 3.5], [1], [1, 1]]); assert(!BB.outwardRedPossible(BB.view(I, 0))); reject(I, 0, { a: 'outward-red' });
});

test('只能与朝外线配对须跳过罚一格；依据公开数量与本人手牌判定，不偷看其他普通线', () => {
  const G = rig([[3], [3, 3, 3], [1, 1, 1, 1]]); G.turn = 1; assert(BB.outwardSkipAllowed(G, 1)); assert(BB.outwardSkipAllowed(BB.view(G, 1), 1)); reject(G, 1, { a: 'dual', w: G.players[2].stands[0][0], val: 3 }); act(G, 1, { a: 'outward-skip' }); assert.equal(G.det, 1); assert.equal(G.turn, 2);
  const H = rig([[3], [3, 3, 3], [1, 1, 1, 1]]); H.turn = 1; H.det = H.detMax - 1; act(H, 1, { a: 'outward-skip' }); assert.equal(H.phase, 'lost');
  const I = rig([[3], [3, 3, 3, 1], [1, 1, 1]]); I.turn = 1; assert(!BB.outwardSkipAllowed(I, 1)); reject(I, 1, { a: 'outward-skip' });
});

test('盲猜不能组合任何装备、稳定器或个人能力；拒绝保留牌和状态', () => {
  const G = rig(), target = G.wires.find(w => w.o === 2 && w.v === 2);
  for (const mods of [{ stab: true }, { xy: true }, { xyPersonal: true }, { dd: true }, { equip: 9 }, { character: true }]) reject(G, 0, { a: 'outward-dual', w: target.id, val: 2, ...mods });
  reject(G, 0, { a: 'outward-dual', w: target.id, val: 'Y' }); G.stab = true; reject(G, 0, { a: 'outward-dual', w: -1, val: 2 }); assert(G.stab); act(G, 0, { a: 'outward-dual', w: target.id, val: 1 }); assert.equal(G.pending.stab, false); resolve(G); assert.equal(G.phase, 'lost');
});

test('第38关100局来源设置全信息通关，64局仅私人及公开信息的机器人合法终局', () => {
  let actions = 0;
  for (let n = 2; n <= 5; n++) for (let seed = 1; seed <= 25; seed++) {
    const G = game(n, seed * 104729, seed % n);
    for (let k = 0; k < 1000 && !['won', 'lost'].includes(G.phase); k++) {
      const pi = G.pending ? G.pending.to : G.phase === 'setup' ? BB.setupActor(G) : G.turn; let a;
      if (G.phase === 'setup') a = Bot.decide(G, pi);
      else if (G.pending) a = { a: 'resolve', id: G.pending.id, w: G.pending.step === 'own' ? BB.view(G, pi).pending.choices.filter(id => G.pending.outwardOwn != null || BB.matches(G.wires[id], G.pending.hitVal)).at(-1) : G.pending.ids.find(id => G.pending.vals.some(v => BB.matches(G.wires[id], v))) };
      else if (BB.outwardSkipAllowed(G, pi)) a = { a: 'outward-skip' };
      else {
        const special = G.wires[G.officialState.outwardId], own = G.wires.filter(w => w.o === pi && !w.cut);
        if (pi === G.captain && !special.cut) {
          if (BB.kindOf(special) === 'r' && BB.outwardRedPossible(G)) a = { a: 'outward-red' };
          else if (BB.kindOf(special) === 'b') {
            const target = G.wires.find(w => w.o !== pi && !w.cut && w.v === special.v);
            if (target) a = { a: 'outward-dual', w: target.id, val: special.v };
            else if (BB.outwardSoloValues(G).includes(special.v)) a = { a: 'outward-solo', val: special.v };
          }
        }
        if (!a) {
          const known = own.filter(w => !BB.isOutward(G, w));
          if (known.every(w => BB.kindOf(w) === 'r')) a = { a: 'red' };
          else { const value = known.find(w => BB.kindOf(w) === 'b').v, target = G.wires.find(w => w.o !== pi && !w.cut && !BB.isOutward(G, w) && w.v === value); a = BB.soloOk(G, pi, value) ? { a: 'solo', val: value } : { a: 'dual', w: target.id, val: value }; }
        }
      }
      assert(a); act(G, pi, a); actions++;
    }
    assert.equal(G.phase, 'won');
  }
  for (let n = 2; n <= 5; n++) for (let seed = 1; seed <= 16; seed++) { const G = game(n, seed * 7919); for (let k = 0; k < 1000 && !['won', 'lost'].includes(G.phase); k++) { const pi = G.pending ? G.pending.to : G.phase === 'setup' ? BB.setupActor(G) : G.turn, a = Bot.decide(G, pi); assert(a, '机器人必须完成自己的回合'); act(G, pi, a); } assert(['won', 'lost'].includes(G.phase)); }
  console.log('  100局通关，共' + actions + '个合法动作；64局机器人合法终局。');
});

test('第38关2–5人权威盲猜：匹配确认仍不透露朝外值，暂停重连重启及过期去重', () => {
  const fs = require('fs'), os = require('os'), path = require('path'), Service = require('../server/official'), dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bb38-actions-'));
  const wss = { clients: new Set() }, svc = Service(wss, dir), last = (ws, topic) => ws.messages.filter(m => m.topic === topic).at(-1)?.data;
  function peer(room) { const ws = { room, readyState: 1, messages: [], send(raw) { this.messages.push(JSON.parse(raw)); } }; wss.clients.add(ws); return ws; }
  try {
    for (let n = 2; n <= 5; n++) {
      const name = 'bb-blind' + n, peers = Array.from({ length: n }, () => peer(name)); peers.forEach((ws, pi) => svc.handle(ws, pi ? 'hello' : 'official:hello', { ruleset: 'campaign', mid: 38, name: '盲猜玩家' + pi }));
      const room = svc.load(name); svc.handle(peers[0], 'official:start', { mid: 38, revision: room.revision, commandId: '开始' }); let G, target;
      for (let seed = 1; seed < 300; seed++) { G = game(n, seed * 104729); const special = G.wires[G.officialState.outwardId]; if (BB.kindOf(special) === 'b') target = G.wires.find(w => w.o !== 0 && w.v === special.v); if (target) break; }
      assert(target); room.G = G; G.catalog = G.mission.catalog = 'campaign'; G.players.forEach((p, pi) => { p.pid = room.seats[pi].pid; p.name = room.seats[pi].name; });
      function send(pi, commandId, action, service = svc, state = room, ws = peers[pi]) { service.handle(ws, 'official:act', { gid: state.G.gid, revision: state.revision, commandId, pi: (pi + 1) % n, action }); }
      let k = 0; while (G.phase === 'setup') { const pi = BB.setupActor(G); send(pi, '标记' + k++, Bot.decide(G, pi)); }
      const id = G.officialState.outwardId, value = G.wires[id].v; send(0, '盲猜', { a: 'outward-dual', w: target.id, val: value }); const decision = G.pending.id;
      const before = JSON.stringify(G); send((target.o + 1) % n, '冒用回应', { a: 'resolve', id: decision, w: target.id, pi: target.o }); assert.equal(JSON.stringify(G), before);
      send(target.o, '确认目标', { a: 'resolve', id: decision, w: target.id }); assert.equal(G.pending.step, 'own');
      peers.forEach((ws, pi) => { const V = last(ws, 'official:view').view; assert.equal(V.pending.outwardOwn, id); assert.equal('choices' in V.pending, pi === 0); if (!pi) { assert.deepEqual(V.pending.choices, [id]); assert.equal(V.players[0].stands.flat().find(w => w.id === id).v, null); } });
      svc.handle(peers[0], 'official:pause', { paused: true, gid: G.gid, revision: room.revision, commandId: '暂停' }); const frozen = JSON.stringify(G); send(0, '暂停中确认', { a: 'resolve', id: decision, w: id }); assert.equal(JSON.stringify(G), frozen); svc.handle(peers[0], 'official:pause', { paused: false, gid: G.gid, revision: room.revision, commandId: '继续' });
      const credential = last(peers[0], 'official:welcome').credential, reconnect = peer(name); svc.handle(reconnect, 'hello', { credential, name: '盲猜玩家0' }); assert.deepEqual(last(reconnect, 'official:view').view.pending.choices, [id]);
      const restored = Service(wss, dir), state = restored.load(name); assert.equal(state.G.pending.outwardOwn, id); const saved = JSON.stringify(state.G); send(0, '旧回应', { a: 'resolve', id: decision - 1, w: id }, restored, state, reconnect); assert.equal(JSON.stringify(state.G), saved);
      send(0, '确认朝外', { a: 'resolve', id: decision, w: id }, restored, state, reconnect); const revision = state.revision; send(0, '确认朝外', { a: 'resolve', id: decision, w: id }, restored, state, reconnect); assert.equal(state.revision, revision); assert(state.G.wires[id].cut && state.G.wires[target.id].cut); assert.equal(state.G.players[0].dd, 1);
    }
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('对讲机不能交换朝外线；队长仅剩朝外线时，发起共享或个人交换不耗牌也不留下死决定', () => {
  function equip(G) { G.equip = [{ n: 2, id: BB.EQUIP[2].id, used: false }]; for (let k = 0; k < 2; k++) { const id = G.wires.length; G.wires.push({ id, v: 2, o: 2, s: 0, cut: true, info: null }); G.players[2].stands[0].push(id); } }
  const G = rig(); equip(G); const offered = G.wires.find(w => w.o === 1 && w.v === 3), id = G.officialState.outwardId; act(G, 1, { a: 'equip', n: 2, w: offered.id, p: 0 }); reject(G, 0, { a: 'walkie', id: G.pending.id, w: id }); const known = G.wires.find(w => w.o === 0 && w.id !== id); act(G, 0, { a: 'walkie', id: G.pending.id, w: known.id }); assert.equal(G.wires[id].o, 0); assert.equal(G.players[0].stands[0].at(-1), id);
  const H = rig(); equip(H); H.wires.filter(w => w.o === 0 && !BB.isOutward(H, w)).forEach(w => { w.cut = true; }); const wire = H.wires.find(w => w.o === 1 && w.v === 3); reject(H, 1, { a: 'equip', n: 2, w: wire.id, p: 0 }); assert(!H.equip[0].used); assert(!H.pending);
  H.players[1].character = { id: 'walkie-talkies', used: false }; reject(H, 1, { a: 'character', w: wire.id, p: 0 }); assert(!H.players[1].character.used);
});

test('第38关四种后期角色机器人不选朝外装备目标，32局合法终局', () => {
  const roles = ['triple-detector', 'xy-ray', 'general-radar', 'walkie-talkies'];
  for (let n = 2; n <= 5; n++) for (let seed = 1; seed <= 8; seed++) {
    const ss = seats(n); ss.forEach((s, pi) => { if (pi) s.character = roles[pi - 1]; });
    const G = BB.createGame(M.get('official-development', 38), ss, { captain: 0, rng: rng(seed * 104729) });
    for (let k = 0; k < 1000 && !['won', 'lost'].includes(G.phase); k++) { const pi = G.pending ? G.pending.to : G.phase === 'setup' ? BB.setupActor(G) : G.turn, a = Bot.decide(G, pi); assert(a); act(G, pi, a); }
    assert(['won', 'lost'].includes(G.phase));
  }
});

test('普通无装备双人成功后可选择朝外线，选项不验证真值；带装备时不提供该选择', () => {
  for (const value of [1, 2]) {
    const G = rig([[1, value], [1, 3, 3], [1, 1, 2, 2, 2]]), id = G.officialState.outwardId, target = G.wires.find(w => w.o === 1 && w.v === 1);
    act(G, 0, { a: 'dual', w: target.id, val: 1 }); resolve(G, target.id); assert(BB.view(G, 0).pending.choices.includes(id)); resolve(G, id); assert.equal(G.phase, value === 1 ? 'play' : 'lost');
  }
  const H = rig([[1, 1], [1, 3, 3], [1, 2, 2, 2]]), id = H.officialState.outwardId, ids = H.wires.filter(w => w.o === 1).slice(0, 2).map(w => w.id); act(H, 0, { a: 'dd', ws: ids, val: 1 }); resolve(H); assert(!BB.view(H, 0).pending.choices.includes(id)); reject(H, 0, { a: 'resolve', id: H.pending.id, w: id });
  const I = rig([[3.5], [1, 1], [1, 1]]); I.equip = [{ n: 9, id: BB.EQUIP[9].id, used: false }]; for (let k = 0; k < 2; k++) { const id = I.wires.length; I.wires.push({ id, v: 9, o: 1, s: 0, cut: true, info: null }); I.players[1].stands[0].push(id); } assert.equal(BB.stabilizerAllowed(I, 0), false); reject(I, 0, { a: 'equip', n: 9 });
});

test('朝外线已剪后仍不是普通排序边界，队友可推理其左侧更大的未知数', () => {
  let G, id, high, target;
  for (let seed = 1; seed < 400; seed++) {
    G = game(3, seed * 104729); id = G.officialState.outwardId; const outward = G.wires[id]; if (!Number.isInteger(outward.v)) continue;
    const ordinary = G.players[0].stands[outward.s].filter(i => i !== id).map(i => G.wires[i]); high = ordinary.at(-1); target = G.wires.find(w => w.o !== 0 && w.v === outward.v);
    if (target && high.v > outward.v && ordinary.length > 2) break;
  }
  assert(high && target); while (G.phase === 'setup') { const pi = BB.setupActor(G); const w = G.wires.find(w => w.o === pi && !BB.isOutward(G, w) && Number.isInteger(w.v) && w.id !== high.id); act(G, pi, { a: 'info', w: w.id }); }
  const value = G.wires[id].v; act(G, 0, { a: 'outward-dual', w: target.id, val: value }); resolve(G, target.id); resolve(G, id);
  const saved = Math.random; let p; try { Math.random = rng(7251); p = Bot.infer(G, 1, 12000); } finally { Math.random = saved; }
  assert(p[high.id]); assert(Object.entries(p[high.id].P).some(([v, chance]) => Number(v) > value && chance > 0));
});

test('个人三重探测器不能绕过强制跳过规则', () => {
  const G = rig([[3], [3, 3, 3], [1, 1, 1, 1]]); G.turn = 1; G.players[1].character = { id: 'triple-detector', used: false };
  reject(G, 1, { a: 'character', ws: G.players[2].stands[0].slice(0, 3), val: 3 }); assert(!G.players[1].character.used); assert(!G.pending);
});

test('预开稳定器后交换走最后一根已知蓝线，仍能公开朝外红线，保护不会阻断或生效', () => {
  const G = rig([[1, 3.5], [1.5, 1, 1, 1], [2, 2, 2, 2]]); G.equip = [{ n: 2, id: BB.EQUIP[2].id, used: false }, { n: 9, id: BB.EQUIP[9].id, used: false }];
  for (let k=0;k<2;k++) { const id=G.wires.length; G.wires.push({id,v:9,o:2,s:0,cut:true,info:null}); G.players[2].stands[0].push(id); }
  G.turn=2; act(G,2,{a:'solo',val:2}); assert.equal(G.turn,0); act(G,0,{a:'equip',n:9}); assert(G.stab);
  const incoming=G.wires.find(w=>w.o===1&&w.v===1.5), outgoing=G.wires.find(w=>w.o===0&&w.v===1); act(G,1,{a:'equip',n:2,w:incoming.id,p:0}); act(G,0,{a:'walkie',id:G.pending.id,w:outgoing.id});
  assert(G.stab); assert(BB.outwardRedPossible(BB.view(G,0))); act(G,0,{a:'outward-red'}); assert.equal(G.stab,false); assert(G.wires[G.officialState.outwardId].cut); assert.notEqual(G.phase,'lost'); assert(G.equip.find(e=>e.n===9).used);
});

test('目标确认后即向全员公开真值，尚未剪断或解锁；队长的朝外真值仍隐藏，压缩包一致', () => {
  const G=rig(), target=G.wires.find(w=>w.o===2&&w.v===2), id=G.officialState.outwardId; act(G,0,{a:'outward-dual',w:target.id,val:2}); resolve(G,target.id);
  assert(!G.wires[target.id].cut); assert.equal(BB.cutCount(G,2),0);
  for(let pi=-1;pi<G.np;pi++) { const V=BB.view(G,pi), packed=BB.unpack(BB.packPublic(G),pi>=0?BB.packHand(G,pi):null,pi,BB.packChoice(G,pi)); assert.equal(V.players[target.o].stands.flat().find(w=>w.id===target.id).v,2); assert.equal(packed.players[target.o].stands.flat().find(w=>w.id===target.id).v,2); }
  assert.equal(BB.view(G,0).players[0].stands.flat().find(w=>w.id===id).v,null); assert.equal(Bot.infer(G,1,8000)[target.id].P[2],1);
});

test('异常参数不会让纯引擎半耗角色或留下错误待回应，离线与联机均保持状态不变', () => {
  const G=rig(); reject(G,0,{a:'dd',ws:['__proto__','constructor'],val:1}); assert.equal(G.players[0].dd,1); assert(!G.pending); reject(G,0,null); reject(G,0,{a:'outward-dual',w:'__proto__',val:1});
});

test('三重的两根例外按线架总剩余数判断，朝外线仍未剪时不能把三根算成两根', () => {
  const G=rig([[1,2,1],[2,3],[1,2,2,3,3]]); G.turn=1; G.players[1].dd=0; G.players[1].character={id:'triple-detector',used:false};
  const ids=G.players[0].stands[0].filter(id=>!BB.isOutward(G,G.wires[id])); reject(G,1,{a:'character',ws:ids,val:2}); assert(!G.players[1].character.used);
  G.wires[G.officialState.outwardId].cut=true; act(G,1,{a:'character',ws:ids,val:2}); assert(G.players[1].character.used);
});

test('第38关目录升级不改变旧改编存档的红黄配置、隐藏候选、角色或版本', () => {
  const fs=require('fs'),os=require('os'),path=require('path'),Service=require('../server/official'),dir=fs.mkdtempSync(path.join(os.tmpdir(),'bb38-compat-'));
  try {for(let n=2;n<=5;n++){
    const G=BB.createGame(M.get('custom',38),seats(n),{rng:rng(n*104729)}); G.catalog=G.mission.catalog='campaign';G.mission.contentVersion=12;delete G.detMin;G.paused=true;G.pauseRemaining=null;
    const original=JSON.stringify(G.mission),name='bb-old38'+n;fs.writeFileSync(path.join(dir,name+'.json'),JSON.stringify({version:1,name,host:'p0',mid:38,ruleset:'campaign',attempts:1,started:true,seats:seats(n),observers:[],revision:0,seen:[],G}));
    const saved=Service({clients:new Set()},dir).load(name).G;assert.equal(JSON.stringify(saved.mission),original);assert.equal(saved.ruleset,'custom');assert.equal(saved.mission.contentVersion,12);assert(saved.mission.rules.hide);assert(!saved.officialState);assert.equal(BB.dialMin(saved),0);assert.equal(saved.ymark.n,2);
  }}finally{fs.rmSync(dir,{recursive:true,force:true});}
});
