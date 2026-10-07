const assert = require('assert');
const BB = require('../js/engine'), Bot = require('../js/bot'), M = require('../js/missions');
const seats = n => Array.from({ length: n }, (_, i) => ({ pid: 'p' + i, name: '玩家' + i }));
function rng(seed = 18) { return () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296); }
function game(n = 3, captain = 0, seed = 18) { return BB.createGame(M.get('official-development', 18), seats(n), { captain, rng: rng(seed) }); }
function rig(hands, deck = [3, 4, 1, 2, 5, 6, 7, 8, 9, 10, 11, 12]) {
  const G = game(hands.length); G.wires = []; G.players.forEach(p => { p.stands = [[]]; });
  hands.forEach((hand, o) => hand.forEach(v => { const id = G.wires.length; G.wires.push({ id, v, o, s: 0, cut: false, info: null }); G.players[o].stands[0].push(id); }));
  G.players.forEach(p => p.stands[0].sort((a, b) => G.wires[a].v - G.wires[b].v));
  G.officialState.command.deck = deck; return G;
}
function act(G, pi, action) { assert.strictEqual(BB.act(G, pi, action, { rng: rng() }), null); }
function rejected(G, pi, action) { const before = JSON.stringify(G); assert(BB.act(G, pi, action)); assert.equal(JSON.stringify(G), before); }
function command(G, a, extra = {}) { act(G, G.turn, { a, id: G.officialState.command.decisionId, ...extra }); }
function query(G) { command(G, 'number-draw'); command(G, 'radar-query'); }
function answer(G, pi) { const pd = BB.view(G, pi).pending; act(G, pi, { a: 'radar-reply', id: pd.id, answers: pd.ownAnswers }); }
function allAnswers(G) { while (G.pending && G.pending.type === 'radar') answer(G, G.pending.to); }
function resolve(G, w) { act(G, G.pending.to, { a: 'resolve', id: G.pending.id, w }); }
function test(name, run) { run(); console.log('✓', name); }

test('第18关2–5人用线、队长轮换、无初始线索、个人能力与重复雷达符合任务卡', () => {
  for (let n = 2; n <= 5; n++) for (let captain = 0; captain < n; captain++) {
    const G = game(n, captain); assert.equal(G.phase, 'play'); assert.equal(G.turn, captain); assert.equal(G.infoN, 0);
    assert.equal(G.wires.length, n === 2 ? 51 : 50); assert.equal(G.rmark.n, n === 2 ? 3 : 2); assert.equal(G.rmark.cand.length, G.rmark.n);
    assert.equal(G.ymark.n, 0); assert(G.wires.every(w => !w.info)); assert(G.players.every(p => p.dd === 1));
    const lengths = G.players.flatMap((p, pi) => { assert.equal(p.stands.length, n === 2 || n === 3 && pi === captain ? 2 : 1); return p.stands.map(r => r.length); });
    assert(Math.max(...lengths) - Math.min(...lengths) <= 1);
    assert.deepEqual(G.equip.map(e => e.n), [8]); assert(BB.equipUnlocked(G, 8)); assert(!G.equip[0].used);
    assert.equal(new Set(G.officialState.command.deck).size, 12);
    const pub = JSON.stringify(BB.packPublic(G)); assert(!pub.includes('"deck"')); assert(!pub.includes('"discard"')); assert(!pub.includes('"equipmentReserve"'));
    assert.equal(BB.view(G, captain).official.radarCommand.remaining, 12);
  }
});

test('步骤不得跳过或重抽；每人仅公开自己逐架的有／无，红色小数不算蓝值', () => {
  const G = game(2); G.officialState.command.deck = [3, 4];
  const before = G.officialState.command.decisionId;
  rejected(G, 0, { a: 'radar-query', id: before }); rejected(G, 1, { a: 'number-draw', id: before });
  command(G, 'number-draw'); assert.equal(G.officialState.command.value, 3);
  rejected(G, 0, { a: 'number-draw', id: before });
  rejected(G, 0, { a: 'equip', n: 8, val: 4 });
  command(G, 'radar-query'); assert.equal(G.pending.type, 'radar');
  const own = BB.view(G, 0).pending, other = BB.view(G, 1).pending;
  assert.equal(own.ownAnswers.length, 2); assert.equal(other.ownAnswers.length, 2);
  assert(!('ownAnswers' in BB.view(G, -1).pending));
  assert.equal(BB.unpack(BB.packPublic(G), BB.packHand(G, 1), 1, BB.packChoice(G, 1)).pending.ownAnswers.length, 2);
  rejected(G, 0, { a: 'radar-reply', id: own.id, answers: own.ownAnswers.map(v => !v) });
  rejected(G, 0, { a: 'radar-reply', id: own.id, answers: [1, 0] });
  const id = G.pending.id; answer(G, 1); assert(!BB.view(G, 1).pending.ownAnswers);
  rejected(G, 1, { a: 'radar-reply', id, answers: other.ownAnswers });
  assert(G.pending.answers[1]); assert.equal(G.pending.answers[0], null);
  answer(G, 0); assert.equal(G.pending, null); assert.equal(G.officialState.command.step, 'choose');
  assert(!G.equip[0].used); assert.equal(G.turnNo, 1);
  const R = rig([[3, 3], [3.5, 3.5], [3, 3]]); query(R);
  assert.deepEqual(BB.view(R, 1).pending.ownAnswers, [false]); allAnswers(R);
  rejected(R, 0, { a: 'command-select', id: R.officialState.command.decisionId, p: 1 });
});

test('指定者只选行动玩家；行动者自选目标和重复手牌；下一回合从指定者左邻继续', () => {
  const G = rig([[3, 3, 7, 7], [3, 3, 5, 5], [4, 4, 6, 6]]);
  query(G); allAnswers(G); command(G, 'command-select', { p: 1 });
  assert.equal(G.turn, 0); assert.equal(BB.turnActor(G), 1); assert.equal(BB.turnActor(BB.view(G, 2)), 1);
  rejected(G, 0, { a: 'dual', val: 3, w: 4 });
  rejected(G, 1, { a: 'solo', val: 5 });
  act(G, 1, { a: 'dual', val: 3, w: 1 }); resolve(G, 1);
  assert.deepEqual(BB.view(G, 1).pending.choices, [4, 5]); assert(!BB.view(G, 2).pending.choices);
  resolve(G, 5); assert(G.wires[1].cut && G.wires[5].cut); assert(!G.wires[0].cut && !G.wires[4].cut);
  assert.equal(G.turn, 1); assert.equal(G.turnNo, 2); assert.equal(G.officialState.command.step, 'draw');
  assert.equal(G.officialState.command.answers, null); assert.equal(G.officialState.command.value, null);
  assert(!BB.view(G, 0).radar); assert(!G.equip[0].used);
  query(G); allAnswers(G); command(G, 'command-select', { p: 2 });
  act(G, 2, { a: 'solo', val: 4 }); assert.equal(G.turn, 2); assert.equal(G.turnNo, 3);
});

test('个人双重探测器独立一次；失败普通罚格，仍以轮值玩家推进', () => {
  const G = rig([[3, 3, 7, 7], [3, 3], [4, 4]]);
  query(G); allAnswers(G); command(G, 'command-select', { p: 0 });
  act(G, 0, { a: 'dd', val: 3, ws: [6, 7] }); resolve(G, 7);
  assert.equal(G.players[0].dd, 0); assert.equal(G.players[1].dd, 1); assert.equal(G.det, 1);
  assert.deepEqual(G.wires[7].info, { t: 'v', v: 4 }); assert.equal(G.turn, 1); assert(!G.equip[0].used);
});

test('牌堆用完仅洗回未完成的卡；四根完成永久移出；红线回合不翻卡不查询', () => {
  const blues = Array.from({ length: 12 }, (_, i) => [i + 1, i + 1]).flat();
  const G = rig([blues, blues, [1.5]], Array.from({ length: 12 }, (_, i) => i + 1));
  for (let n = 1; n <= 12; n++) {
    if (G.officialState.command.step === 'red') act(G, G.turn, { a: 'red' });
    query(G); assert.equal(G.officialState.command.value, n); allAnswers(G); command(G, 'command-select', { p: 0 });
    const target = G.wires.find(w => w.o === 1 && !w.cut && w.v === n);
    const own = G.wires.find(w => w.o === 0 && !w.cut && w.v === n);
    act(G, 0, { a: 'dual', val: n, w: target.id }); resolve(G, target.id); resolve(G, own.id);
    if (n === 8) assert(!G.log.some(entry => entry.t.includes('通用雷达') && entry.t.includes('已解锁')), '本关雷达始终可用，不应重复提示编号解锁');
    if (n === 2) { assert.equal(G.turn, 2); assert.equal(G.officialState.command.step, 'red'); rejected(G, 2, { a: 'number-draw', id: G.officialState.command.decisionId }); }
  }
  assert.equal(G.officialState.command.deck.length, 0); assert.equal(G.officialState.command.discard.length, 12);
  query(G); const value = G.officialState.command.value;
  assert.equal(G.officialState.command.deck.length, 11); allAnswers(G); command(G, 'command-select', { p: 0 });
  const target = G.wires.find(w => w.o === 1 && !w.cut && w.v === value), own = G.wires.find(w => w.o === 0 && !w.cut && w.v === value);
  act(G, 0, { a: 'dual', val: value, w: target.id }); resolve(G, target.id); resolve(G, own.id);
  assert(G.officialState.command.retired.includes(value)); assert(!G.officialState.command.deck.includes(value)); assert(!G.officialState.command.discard.includes(value));
});

test('暂停、回应中存档及非法动作保留状态；旧版改编18保持旧规则', () => {
  const G = rig([[3, 3], [3, 3], [3.5]]); query(G); answer(G, 0);
  const H = JSON.parse(JSON.stringify(G)), id = H.pending.id;
  assert.equal(BB.setPaused(H, true), null); rejected(H, 1, { a: 'radar-reply', id, answers: [true] });
  assert.equal(BB.setPaused(H, false), null); answer(H, 1); answer(H, 2); command(H, 'command-select', { p: 1 });
  assert.equal(H.officialState.command.actor, 1);
  const old = BB.createGame(M.get('custom', 18), seats(3), { rng: rng() }); assert(!old.officialState); assert.equal(BB.turnActor(old), old.turn);
  assert.equal(old.mission.eq, 1); assert.equal(old.mission.y[0], 2); assert.equal(old.infoN, 1);
});

test('第18关100局全信息可达性检查完成，另64局推理机器人均合法结束', () => {
  let count = 0;
  for (let n = 2; n <= 5; n++) for (let seed = 1; seed <= 25; seed++) {
    const G = game(n, seed % n, seed);
    for (let k = 0; k < 1000 && G.phase !== 'won'; k++) {
      const pi = G.pending ? G.pending.to : BB.turnActor(G); let a;
      if (G.pending || G.officialState.command.step !== 'cut') a = Bot.decide(G, pi);
      else {
        const value = G.officialState.command.value;
        if (BB.soloOk(G, pi, value)) a = { a: 'solo', val: value };
        else { const target = G.wires.find(w => w.o !== pi && !w.cut && w.v === value); assert(target); a = { a: 'dual', val: value, w: target.id }; }
      }
      assert(a, '不能停住'); act(G, pi, a); count++;
    }
    assert.equal(G.phase, 'won'); assert.equal(G.det, 0); assert.equal(G.officialState.command.retired.length, 12);
  }
  for (let n = 2; n <= 5; n++) for (let seed = 1; seed <= 16; seed++) {
    const G = game(n, seed % n, seed);
    for (let k = 0; k < 1000 && !['won', 'lost'].includes(G.phase); k++) { const pi = G.pending ? G.pending.to : BB.turnActor(G); const a = Bot.decide(G, pi); assert(a); act(G, pi, a); }
    assert(['won', 'lost'].includes(G.phase));
  }
  console.log('  100局全信息完成，共 ' + count + ' 个动作；推理机器人胜负不作为规则准确性的证明。');
});

test('权威服务端2–5人：逐人雷达隐私、乱序回答、观战、重连重启及重复命令', () => {
  const fs = require('fs'), os = require('os'), path = require('path'), Service = require('../server/official');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bb18-authority-')), wss = { clients: new Set() }, service = Service(wss, dir);
  function peer(name) { const ws = { room: name, readyState: 1, messages: [], send(raw) { this.messages.push(JSON.parse(raw)); } }; wss.clients.add(ws); return ws; }
  const last = (ws, topic) => ws.messages.filter(m => m.topic === topic).at(-1)?.data;
  try {
    for (let n = 2; n <= 5; n++) {
      const name = 'bb-radar' + n, peers = Array.from({ length: n }, () => peer(name));
      peers.forEach((ws, pi) => service.handle(ws, pi ? 'hello' : 'official:hello', { ruleset: 'campaign', mid: 18, name: '玩家' + pi }));
      const room = service.load(name); service.handle(peers[0], 'official:start', { mid: 18, revision: room.revision, commandId: '开始' });
      room.G = game(n); room.G.players.forEach((p, pi) => { p.pid = room.seats[pi].pid; });
      room.G.officialState.command.deck = [3, 4, 1, 2, 5, 6, 7, 8, 9, 10, 11, 12];
      function send(pi, commandId, action, svc = service, state = room, extra = {}) {
        svc.handle(peers[pi], 'official:act', { gid: state.G.gid, revision: state.revision, commandId, action, ...extra });
      }
      send(0, '翻牌', { a: 'number-draw', id: room.G.officialState.command.decisionId });
      send(0, '查询', { a: 'radar-query', id: room.G.officialState.command.decisionId });
      const spectator = peer(name); service.handle(spectator, 'hello', { name: '观战者', spectator: true });
      service.handle(spectator, 'official:perspective', { pid: room.seats[1].pid });
      assert(!last(spectator, 'official:view').view.pending.ownAnswers);
      for (const ws of peers) { const V = last(ws, 'official:view').view; assert.deepEqual(V.pending.ownAnswers, BB.view(room.G, V.me).pending.ownAnswers); assert(V.players.filter((_, pi) => pi !== V.me).flatMap(p => p.stands.flat()).every(w => w.v === null)); }
      const id = room.G.pending.id, truth = BB.view(room.G, n - 1).pending.ownAnswers;
      send(n - 1, '回应', { a: 'radar-reply', id, answers: truth }, service, room, { pid: room.seats[0].pid });
      assert.deepEqual(room.G.pending.answers[n - 1], truth); assert.equal(room.G.pending.answers[0], null);
      const before = JSON.stringify(room.G); send(n - 1, '重复新编号', { a: 'radar-reply', id, answers: truth }); assert.equal(JSON.stringify(room.G), before);
      const credential = last(peers[1], 'official:welcome').credential, reconnected = peer(name);
      service.handle(reconnected, 'hello', { credential }); assert.equal(last(reconnected, 'official:view').view.pending.id, id);
      const restoredWss = { clients: new Set(peers) }, restoredService = Service(restoredWss, dir), restored = restoredService.load(name);
      assert.equal(restored.G.pending.id, id); assert.deepEqual(restored.G.pending.answers[n - 1], truth);
      const oldRevision = restored.revision;
      send(n - 1, '回应', { a: 'radar-reply', id, answers: truth }, restoredService, restored); assert.equal(restored.revision, oldRevision);
      while (restored.G.pending) { const pi = restored.G.pending.to; send(pi, '回应', { a: 'radar-reply', id, answers: BB.view(restored.G, pi).pending.ownAnswers }, restoredService, restored); }
      const eligible = restored.G.officialState.command.answers.findIndex(r => r.some(Boolean));
      const selectId = restored.G.officialState.command.decisionId, preSelect = JSON.stringify(restored.G);
      send(1, '冒用指定', { a: 'command-select', id: selectId, p: eligible }, restoredService, restored, { pid: restored.seats[0].pid }); assert.equal(JSON.stringify(restored.G), preSelect);
      send(0, '指定', { a: 'command-select', id: selectId, p: eligible }, restoredService, restored); assert.equal(BB.turnActor(restored.G), eligible);
      const revision = restored.revision; send(0, '指定', { a: 'command-select', id: selectId, p: eligible }, restoredService, restored); assert.equal(restored.revision, revision);
      const pd = restored.G.pending; assert.equal(pd, null);
    }
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
