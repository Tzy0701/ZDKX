const assert = require('assert');
const BB = require('../js/engine');
const C = require('../js/campaign-rules');
const M = require('../js/missions');
const Bot = require('../js/bot');
const seats = n => Array.from({ length: n }, (_, i) => ({ pid: 'p' + i, name: '玩家' + i }));
function rng(seed = 51) { return () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296); }
function game(mid, n, captain = 0) { return BB.createGame(M.get('official-development', mid), seats(n), { rng: rng(), captain }); }
function rig(mid, hands, captain = 0) {
  const G = game(mid, hands.length, captain);
  G.players.forEach(p => { p.stands = [[]]; }); G.wires = [];
  hands.forEach((hand, o) => hand.forEach(v => {
    const id = G.wires.length; G.wires.push({ id, v, o, s: 0, cut: false, info: null }); G.players[o].stands[0].push(id);
  }));
  G.players.forEach(p => p.stands[0].sort((a, b) => G.wires[a].v - G.wires[b].v));
  G.setupNeeds = C.setupNeeds(G); G.phase = 'play'; G.turn = 0; G.turnNo = 1;
  return G;
}
function act(G, pi, a) { assert.strictEqual(BB.act(G, pi, a, { rng: rng(), now: 12345 }), null); }
function rejected(G, pi, a) { const before = JSON.stringify(G); assert(BB.act(G, pi, a)); assert.strictEqual(JSON.stringify(G), before); }
function resolve(G, w) { act(G, G.pending.to, { a: 'resolve', id: G.pending.id, w }); }
function trigger(G) {
  const own = G.wires.find(w => w.o === G.turn && BB.kindOf(w.v) === 'y' && !w.cut);
  const target = G.wires.find(w => w.o !== G.turn && BB.kindOf(w.v) === 'y' && !w.cut);
  act(G, G.turn, { a: 'dual', w: target.id, val: 'Y' });
  assert.equal(G.pending.type, 'cut'); resolve(G, target.id);
  assert.equal(G.pending.step, 'own'); assert(!G.officialState.clues.triggered);
  resolve(G, own.id); assert.equal(G.pending.type, 'clue');
}
function finishClues(G) {
  let decisions = 0;
  while (G.pending && G.pending.type === 'clue') {
    const pi = G.pending.to, a = Bot.decide(G, pi); assert(a); act(G, pi, a); assert(++decisions <= G.np * 2);
  }
  assert.equal(decisions, G.np * 2); assert(G.officialState.clues.finished);
}
function test(name, run) { run(); console.log('✓', name); }

test('第22、27关开发版本：各人数用线、线架、角色及队长特例；不提高公开核实状态', () => {
  for (const mid of [22, 27]) for (let n = 2; n <= 5; n++) for (let captain = 0; captain < n; captain++) {
    const G = game(mid, n, captain);
    assert.equal(G.wires.length, 53); assert.equal(G.ymark.n, 4); assert.equal(G.rmark.n, 1);
    assert.equal(G.ymark.cand.length, 4); assert.equal(G.rmark.cand.length, 1);
    const lengths = G.players.flatMap((p, pi) => { assert.equal(p.stands.length, n === 2 || n === 3 && pi === captain ? 2 : 1); return p.stands.map(s => s.length); });
    assert(Math.max(...lengths) - Math.min(...lengths) <= 1);
    assert(G.players.every(p => p.dd === (mid === 22 ? 1 : 0)));
    assert.equal(G.equip.length, n); if (mid === 27) assert(!G.equip.some(e => e.n === 7));
    assert.equal(BB.setupActor(G), mid === 27 && n === 2 ? (captain + 1) % n : captain);
    while (G.phase === 'setup') {
      const pi = BB.setupActor(G), a = Bot.decide(G, pi); assert(a); act(G, pi, a);
    }
    assert.equal(G.phase, 'play'); assert.equal(G.turn, captain);
    assert(G.players.every((_, pi) => G.setup[pi] === BB.setupNeed(G, pi)));
    if (mid === 22) G.players.forEach((p, pi) => { const side = G.officialState.clues.side.filter(t => t.owner === pi); assert(side.length <= 2); if (p.stands.length === 2 && side.length === 2) assert.equal(new Set(side.map(t => t.rack)).size, 2); });
    assert.equal(M.get('campaign', mid).ruleset, 'custom'); assert(!M.get('campaign', mid).verified);
  }
});

test('缺失值按两排合计：原子提交、可标黄、零／一个缺失值、拒绝不能改变任何状态', () => {
  const G = game(22, 3);
  const value = BB.annOf(G.wires.find(w => w.o === 0 && BB.kindOf(w.v) === 'b').v);
  const v = BB.view(G, 0); assert(v.official.missingSetup); assert(!BB.view(G, 1).official.missingSetup); assert(!BB.packPublic(G).official.missingSetup);
  rejected(G, 0, { a: 'info', w: G.players[0].stands[0][0] });
  rejected(G, 1, { a: 'missing-clues', id: v.official.missingSetup.id, values: [1, 2], racks: [0, 0] });
  rejected(G, 0, { a: 'missing-clues', id: v.official.missingSetup.id, values: [value, value], racks: [0, 1] });
  const roundTrip = BB.unpack(BB.packPublic(G), BB.packHand(G, 0), 0, BB.packChoice(G, 0));
  assert.deepEqual(roundTrip.official.missingSetup, v.official.missingSetup);
  const staleChoice = BB.packChoice(G, 0), later = JSON.parse(JSON.stringify(G));
  later.setup[0] = BB.setupNeed(later, 0);
  assert(!BB.unpack(BB.packPublic(later), BB.packHand(later, 0), 0, staleChoice).official.missingSetup);
  const H = rig(22, [Array.from({ length: 12 }, (_, i) => i + 1), [1], [2]]);
  H.phase = 'setup'; assert.equal(BB.setupNeed(H, 0), 1);
  act(H, 0, { a: 'missing-clues', id: H.officialState.clues.setupDecisionId, values: ['Y'], racks: [0] });
  assert.equal(H.officialState.clues.side[0].value, 'Y');
  const Z = rig(22, [Array.from({ length: 12 }, (_, i) => i + 1).concat([1.1]), [1], [2]]);
  Z.phase = 'setup'; assert.equal(BB.setupNeed(Z, 0), 0); assert.equal(BB.setupActor(Z), 1);
});

test('旁置占用有限供给；耗尽只口头宣布；无效请求保留宣布，下一接受动作清除', () => {
  const G = rig(22, [[1], [1], [1], [1], [1]]); G.phase = 'setup';
  for (let pi = 0; pi < 3; pi++) act(G, pi, { a: 'missing-clues', id: G.officialState.clues.setupDecisionId, values: [2, 3], racks: [0, 0] });
  assert.equal(G.officialState.clues.side.length, 4); assert.equal(C.reservedTokens(G, { t: 'v', v: 2 }), 2);
  assert(!C.availableInfoTokens(G, false).some(t => t.value === 2));
  assert.equal(G.announcement.side.length, 2); const oral = JSON.stringify(G.announcement);
  rejected(G, 4, { a: 'missing-clues', id: G.officialState.clues.setupDecisionId, values: [4, 5], racks: [0, 0] });
  assert.equal(JSON.stringify(G.announcement), oral);
  act(G, 3, { a: 'missing-clues', id: G.officialState.clues.setupDecisionId, values: [4, 5], racks: [0, 0] });
  assert.equal(G.announcement, null);
  // 旁置的两枚 2 已占满，便利贴不能额外制造第三枚。
  G.phase = 'play'; G.equip = [{ n: 4, used: false }];
  G.wires[0].v = 2; G.wires[1].v = 4; G.wires[1].cut = true; G.wires[2].v = 4; G.wires[2].cut = true;
  act(G, 0, { a: 'equip', n: 4, w: 0 }); assert.equal(G.wires[0].info, null); assert.equal(G.announcement.info.v, 2);
});

test('黄线双拆完整结算后暂停轮转；队长顺序传左邻；私人选择、任意同值、保存恢复、过期回复', () => {
  const G = rig(22, [[1.1, 2.1, 3, 3], [3.1, 4.1, 3, 3], [5.5, 4, 4]], 2);
  trigger(G); assert.equal(G.turn, 0); assert.equal(G.turnNo, 1); assert.equal(G.pending.to, 2);
  const before = BB.view(G, 2).pending, three = before.tokens.find(t => t.value === 3);
  assert(!('tokens' in BB.view(G, 1).pending)); assert(!('choices' in BB.view(G, 1).pending));
  act(G, 2, { a: 'clue-select', id: before.id, token: three.id }); assert.equal(G.pending.to, 0);
  rejected(G, 2, { a: 'clue-select', id: before.id, token: three.id });
  const own = BB.view(G, 0).pending.choices; assert.deepEqual(own, [2, 3]); assert(!BB.view(G, 1).pending.choices);
  assert(!BB.packPublic(G).pending.choices);
  const H = JSON.parse(JSON.stringify(G));
  assert.equal(BB.setPaused(H, true), null); rejected(H, 0, { a: 'clue-place', id: H.pending.id, w: 3 });
  assert.equal(BB.setPaused(H, false), null);
  act(H, 0, { a: 'clue-place', id: H.pending.id, w: 3 }); assert.equal(H.wires[3].info.token, three.id); assert.equal(H.wires[2].info, null);
  assert.equal(H.pending.to, 0); assert.equal(H.pending.step, 'choose');
  while (H.pending) { const pi = H.pending.to; act(H, pi, Bot.decide(H, pi)); }
  assert.equal(H.turnNo, 2); assert(H.officialState.clues.finished); assert.equal(H.turn, 1);
  rejected(H, 0, { a: 'clue-place', id: before.id, w: 3 });
});

test('随机公开标记仅取备用蓝标记，不泄露牌库；摆放期间不能重复抽取或交换', () => {
  const G = rig(27, [[1.1, 2.1, 3, 3], [3.1, 4.1, 3, 3], [5.5, 4, 4]]);
  G.wires[2].info = { t: 'v', v: 3 }; G.wires[6].info = { t: 'v', v: 3 };
  trigger(G); const pool = G.officialState.clues.pool;
  assert.equal(pool.length, 3); assert.equal(new Set(pool.map(t => t.id)).size, 3);
  assert(pool.every(t => t.value !== 'Y' && t.value !== 3));
  assert.deepEqual(BB.view(G, 2).official.cluePool, pool); assert(!BB.view(G, 2).pending.tokens);
  rejected(G, 1, { a: 'equip', n: 2, w: 6, p: 2 });
  const H = JSON.parse(JSON.stringify(G)); finishClues(H);
  assert.equal(H.officialState.clues.pool.length, 0); assert.equal(H.turnNo, 2);
  assert.equal(H.officialState.clues.side.length + H.wires.filter(w => w.info && w.info.token).length, 3);
  const remaining = H.wires.find(w => w.o === 1 && BB.kindOf(w.v) === 'y' && !w.cut);
  const first = H.wires.find(w => w.o === 0 && BB.kindOf(w.v) === 'y' && !w.cut);
  H.turn = 0; act(H, 0, { a: 'dual', w: remaining.id, val: 'Y' }); resolve(H, remaining.id); resolve(H, first.id);
  assert.equal(H.pending, null); assert.equal(H.turnNo, 3); assert(H.officialState.clues.finished);
});

test('重用已剪导线上的旧标记要移动原件；同值新标记可替换原标记，不增加副本', () => {
  const G = rig(22, [[1.1, 2.1, 3, 3], [3.1, 4.1, 3, 3], [5.5, 4, 4]]);
  G.wires[2].cut = true; G.wires[2].info = { t: 'v', v: 3, token: 'info-3-0' };
  G.wires[7].info = { t: 'v', v: 3, token: 'info-3-1' };
  trigger(G);
  const reclaim = BB.view(G, G.pending.to).pending.tokens.find(t => t.id === 'info-3-0'); assert(reclaim);
  act(G, G.pending.to, { a: 'clue-select', id: G.pending.id, token: reclaim.id });
  assert.equal(G.wires[2].info, null); assert.equal(G.wires[7].info.token, 'info-3-1');
  act(G, G.pending.to, { a: 'clue-place', id: G.pending.id, w: 7 });
  assert.equal(G.wires[7].info.token, 'info-3-0');
  assert(C.availableInfoTokens(G, false).some(t => t.id === 'info-3-1'));
  assert(!C.availableInfoTokens(G, false).some(t => t.id === 'info-3-0'));
  while (G.pending) { const pi = G.pending.to; act(G, pi, Bot.decide(G, pi)); }
  G.turn = 0;
  act(G, 0, { a: 'dual', val: 'Y', w: 7 }); resolve(G, 7);
  assert.equal(G.det, 1); assert.equal(G.wires[7].info.token, 'info-3-0');
});

test('单人一次剪四黄仍只触发一次，标记全部完成后才判断胜负', () => {
  for (const mid of [22, 27]) {
    const G = rig(mid, [[1.1, 2.1, 3.1, 4.1], [2, 2], [3.5]]);
    act(G, 0, { a: 'solo', val: 'Y' }); assert.equal(G.turnNo, 1); assert.equal(G.pending.type, 'clue');
    finishClues(G); assert.equal(G.turnNo, 2); assert.equal(G.phase, 'play');
    assert.equal(BB.cutCount(G, 'Y'), 4); assert.equal(G.officialState.clues.pool.length, 0);
  }
});

test('第22、27关机器人在2–5人完成合法回合，不靠他人隐藏值选奖励标记', () => {
  for (const mid of [22, 27]) for (let n = 2; n <= 5; n++) for (let seed = 1; seed <= 8; seed++) {
    const G = BB.createGame(M.get('official-development', mid), seats(n), { rng: rng(seed), captain: seed % n });
    for (let step = 0; step < 500 && !['won', 'lost'].includes(G.phase); step++) {
      const pi = G.phase === 'setup' ? BB.setupActor(G) : G.pending ? G.pending.to : G.turn;
      const a = Bot.decide(G, pi); assert(a, `${mid}/${n} 不应卡住`); act(G, pi, a);
    }
    assert(['won', 'lost'].includes(G.phase));
  }
});

test('两关各人数50个确定性牌局可完成：全信息测试检查可达性，不代表真实推理难度', () => {
  let actions = 0;
  for (const mid of [22, 27]) for (let n = 2; n <= 5; n++) for (let seed = 1; seed <= 50; seed++) {
    const G = BB.createGame(M.get('official-development', mid), seats(n), { rng: rng(seed), captain: seed % n });
    for (let step = 0; step < 200 && G.phase !== 'won'; step++) {
      let pi = G.phase === 'setup' ? BB.setupActor(G) : G.pending ? G.pending.to : G.turn, a;
      if (G.phase === 'setup' || G.pending) a = Bot.decide(G, pi);
      else {
        const own = G.wires.filter(w => w.o === pi && !w.cut);
        if (own.every(w => BB.kindOf(w.v) === 'r')) a = { a: 'red' };
        for (const value of [...new Set(own.map(w => BB.annOf(w.v)))]) {
          if (a || value === 'R') continue;
          if (BB.soloOk(G, pi, value)) a = { a: 'solo', val: value };
          else { const target = G.wires.find(w => !w.cut && w.o !== pi && BB.matches(w.v, value)); if (target) a = { a: 'dual', val: value, w: target.id }; }
        }
      }
      assert(a, `第${mid}关 ${n}人 种子${seed} 不应停住`); act(G, pi, a); actions++;
    }
    assert.equal(G.phase, 'won'); assert.equal(G.det, 0); assert(G.officialState.clues.finished);
  }
  console.log('  400 局完成，共 ' + actions + ' 个接受的动作；未使用双层底盒来证明任务完整性。');
});

test('服务端 2–5 人：奖励选择私有、观战只看结果、重连及重启后继续，旧编号和冒用座位无效', () => {
  const fs = require('fs'), os = require('os'), path = require('path');
  const Service = require('../server/official');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bb-yellow-auth-'));
  const wss = { clients: new Set() }, service = Service(wss, dir);
  const last = (ws, topic) => ws.messages.filter(m => m.topic === topic).at(-1)?.data;
  function peer(name) { const ws = { room: name, readyState: 1, messages: [], send(raw) { this.messages.push(JSON.parse(raw)); } }; wss.clients.add(ws); return ws; }
  try {
    for (const mid of [22, 27]) for (let n = 2; n <= 5; n++) {
      const name = 'bb-yellow' + mid + n, peers = Array.from({ length: n }, () => peer(name));
      peers.forEach((ws, i) => service.handle(ws, i ? 'hello' : 'official:hello', { ruleset: 'campaign', mid, name: '联机玩家' + i }));
      const room = service.load(name);
      service.handle(peers[0], 'official:start', { mid, revision: room.revision, commandId: '开始' });
      // 仅测试房间注入开发任务；公开大厅继续使用原改编任务。
      room.G = rig(mid, [[1.1, 2.1, 3, 3], [3.1, 4.1, 3, 3]].concat(Array.from({ length: n - 2 }, () => [4, 4, 5.5])));
      room.G.players.forEach((p, i) => { p.pid = room.seats[i].pid; }); trigger(room.G);
      const spectator = peer(name);
      service.handle(spectator, 'hello', { name: '观战者', spectator: true });
      service.handle(spectator, 'official:perspective', { pid: room.G.players[0].pid });
      const pd = room.G.pending, token = BB.view(room.G, pd.to).pending.tokens[0];
      const command = { gid: room.G.gid, revision: room.revision, commandId: '选取标记', action: { a: 'clue-select', id: pd.id, token: token.id } };
      const before = JSON.stringify(room.G);
      service.handle(spectator, 'official:act', command); assert.equal(JSON.stringify(room.G), before);
      service.handle(peers[1], 'official:act', { ...command, pid: room.seats[0].pid }); assert.equal(JSON.stringify(room.G), before);
      service.handle(peers[0], 'official:act', command);
      assert.equal(room.G.pending.step, 'place');
      const target = room.G.pending.to, view = last(peers[target], 'official:view').view;
      assert(Array.isArray(view.pending.choices)); assert.equal(typeof view.pending.canPlaceAside, 'boolean');
      peers.filter((_, pi) => pi !== target).forEach(ws => { const p = last(ws, 'official:view').view.pending; assert(!('choices' in p)); assert(!('canPlaceAside' in p)); });
      const spect = last(spectator, 'official:view').view; assert.equal(spect.me, -1); assert(!('choices' in spect.pending)); assert(!('tokens' in spect.pending)); assert(!('canPlaceAside' in spect.pending));
      const reconnect = peer(name), credential = last(peers[target], 'official:welcome').credential;
      service.handle(reconnect, 'hello', { credential, name: '重连玩家' });
      assert.deepEqual(last(reconnect, 'official:view').view.pending, view.pending);
      const restartedWss = { clients: new Set() }, restarted = Service(restartedWss, dir);
      const restored = restarted.load(name); assert.equal(restored.G.pending.id, room.G.pending.id);
      const resumed = { room: name, readyState: 1, messages: [], send(raw) { this.messages.push(JSON.parse(raw)); } }; restartedWss.clients.add(resumed);
      restarted.handle(resumed, 'hello', { credential });
      const restoredBefore = JSON.stringify(restored.G), revision = restored.revision;
      restarted.handle(resumed, 'official:act', { ...command, revision }); assert.equal(JSON.stringify(restored.G), restoredBefore); assert.equal(restored.revision, revision);
      const own = BB.view(restored.G, target).pending;
      const placement = { gid: restored.G.gid, revision, commandId: '摆放标记', action: { a: 'clue-place', id: own.id, w: own.choices.length ? own.choices.at(-1) : null, rack: 0 } };
      restarted.handle(resumed, 'official:act', placement); assert.equal(restored.revision, revision + 1);
      const post = JSON.stringify(restored.G);
      restarted.handle(resumed, 'official:act', { ...placement, revision: restored.revision }); assert.equal(JSON.stringify(restored.G), post);
    }
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
