const assert = require('assert');
const BB = require('../js/engine');
const M = require('../js/missions');
const C = require('../js/campaign-rules');

const seats = n => Array.from({ length: n }, (_, i) => ({ pid: 'p' + i, name: 'P' + i }));
function rng(seed = 4) { return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; }; }
function game(mid, n = 3, options = {}) { return BB.createGame(M.get('official-development', mid), seats(n), { rng: rng(), ...options }); }
function rig(mid, hands, equipment = []) {
  const G = game(mid, hands.length);
  G.players.forEach(p => { p.stands = [[]]; p.dd = 1; });
  G.wires = [];
  hands.forEach((h, o) => h.forEach(v => {
    const id = G.wires.length;
    G.wires.push({ id, o, s: 0, v, cut: false, info: null });
    G.players[o].stands[0].push(id);
  }));
  G.players.forEach(p => p.stands[0].sort((a, b) => G.wires[a].v - G.wires[b].v));
  G.equip = equipment.map(n => ({ n, id: C.equipmentIdentity(n), used: false }));
  G.phase = 'play'; G.turn = 0; G.det = 0; G.turnNo = 1;
  return G;
}
function cut(G, v, count) { G.wires.filter(w => w.v === v).slice(0, count).forEach(w => { w.cut = true; }); }
function resolve(G, w) { assert.strictEqual(BB.act(G, G.pending.to, { a: 'resolve', id: G.pending.id, w }), null); }
function test(name, fn) { fn(); console.log('✓', name); }

test('顺序任务：2–5 人用线、线架、队长轮换符合任务卡', () => {
  for (const mid of [9, 16]) for (const n of [2, 3, 4, 5]) for (let captain = 0; captain < n; captain++) {
    const G = game(mid, n, { captain });
    assert.equal(G.captain, captain);
    assert.equal(G.detMax, n);
    assert.equal(G.infoN, 1);
    assert.equal(G.seq.length, 3);
    assert.equal(new Set(G.seq).size, 3);
    assert(G.seq.every(v => Number.isInteger(v) && v >= 1 && v <= 12));
    assert.equal(G.wires.filter(w => BB.kindOf(w.v) === 'b').length, 48);
    assert.equal(G.ymark.n, n === 2 ? 4 : 2);
    assert.equal(G.rmark.n, n === 2 ? 2 : 1);
    assert.equal(G.ymark.cand.length, n === 2 ? 4 : mid === 9 ? 2 : 3);
    const racks = G.players.flatMap((p, pi) => {
      assert.equal(p.stands.length, n === 2 || n === 3 && pi === captain ? 2 : 1);
      return p.stands;
    });
    assert(Math.max(...racks.map(r => r.length)) - Math.min(...racks.map(r => r.length)) <= 1);
    assert(G.players.every(p => p.dd === 1));
    const view = BB.view(G, captain);
    assert.equal(view.official.sequence.threshold, mid === 9 ? 2 : 4);
    assert(!('equipmentReserve' in view));
    assert(!('equipmentReserve' in BB.packPublic(G)));
  }
});

test('顺序 A 两根解锁、B 四根解锁；前置数字全部满足门槛', () => {
  for (const mid of [9, 16]) {
    const G = game(mid); G.seq = [3, 6, 9];
    assert(BB.seqAllowed(G, 3)); assert(BB.seqAllowed(G, 4)); assert(BB.seqAllowed(G, 'Y'));
    assert(!BB.seqAllowed(G, 6)); assert(!BB.seqAllowed(G, 9));
    cut(G, 3, 2);
    assert.equal(BB.seqAllowed(G, 6), mid === 9);
    cut(G, 6, 4);
    assert.equal(BB.seqAllowed(G, 9), mid === 9);
    cut(G, 3, 4); assert(BB.seqAllowed(G, 9));
  }
});

test('受锁数字不可宣告；拒绝行动不消耗卡牌或改变状态', () => {
  const G = rig(9, [[6, 6, 3], [6, 6, 3], [3, 3]]); G.seq = [3, 6, 9];
  const before = JSON.stringify(G);
  assert(BB.act(G, 0, { a: 'dd', ws: [3, 4], val: 6 }));
  assert.equal(JSON.stringify(G), before);
});

test('顺序锁定导致当前玩家无法行动时失败；红线公开仍合法', () => {
  const G = rig(9, [[3, 3, 3, 3, 2], [6, 6], [2, 2]]); G.seq = [1, 6, 9];
  assert.equal(BB.act(G, 0, { a: 'solo', val: 3 }), null);
  assert.equal(G.turn, 1); assert.equal(G.phase, 'lost');
  assert(G.result.why.includes('没有合法'));
  const R = rig(16, [[3, 3, 3, 3, 2], [1.5], [2, 2]]); R.seq = [1, 6, 9];
  assert.equal(BB.act(R, 0, { a: 'solo', val: 3 }), null);
  assert.equal(R.phase, 'play'); assert.equal(R.turn, 1);
  assert.equal(BB.act(R, 1, { a: 'red' }), null);
});

test('双层底盒按黄色解锁，抽两张不同的未入局装备，牌库保持私有', () => {
  const G = rig(9, [[1.1, 2.1, 2], [2, 2, 2], [3]], [13]); G.seq = [3, 6, 9];
  G.equipmentReserve = [3, 4, 6, 8];
  const before = JSON.stringify(G);
  assert(BB.act(G, 0, { a: 'equip', n: 13 })); assert.equal(JSON.stringify(G), before);
  assert.equal(BB.act(G, 0, { a: 'solo', val: 'Y' }), null);
  assert(BB.equipUnlocked(G, 13));
  assert.equal(BB.act(G, 2, { a: 'equip', n: 13 }, { rng: rng() }), null);
  assert.equal(G.equip.length, 3); assert.equal(new Set(G.equip.map(e => e.n)).size, 3);
  assert.equal(G.equipmentReserve.length, 2); assert(G.equip.find(e => e.n === 13).used);
  assert(G.equip.every(e => e.id === C.equipmentIdentity(e.n)));
  const spent = JSON.stringify(G); assert(BB.act(G, 1, { a: 'equip', n: 13 })); assert.equal(JSON.stringify(G), spent);
  assert(!('equipmentReserve' in BB.view(G, 0)));
});

test('初始、失败与便利贴均使用奇偶标记，不泄露确切数值', () => {
  const G = rig(21, [[1, 4, 4], [2, 4], [1]] , [4]);
  cut(G, 4, 2);
  const sticky = G.wires.find(w => w.o === 1 && w.v === 4);
  assert.equal(BB.act(G, 1, { a: 'equip', n: 4, w: sticky.id }), null);
  assert.deepEqual(sticky.info, { t: 'even' });
  const target = G.wires.find(w => w.o === 1 && w.v === 2);
  assert.equal(BB.act(G, 0, { a: 'dual', w: target.id, val: 1 }), null);
  resolve(G, target.id);
  assert.deepEqual(G.wires[target.id].info, { t: 'even' });
  const publicWire = BB.view(G, 2).players[1].stands[0].find(w => w.id === target.id);
  assert.equal(publicWire.v, null); assert.deepEqual(publicWire.info, { t: 'even' });
  const setup = game(21);
  const wire = setup.wires.find(w => w.o === setup.captain && BB.kindOf(w.v) === 'b');
  assert.equal(BB.act(setup, setup.captain, { a: 'info', w: wire.id }), null);
  assert.deepEqual(wire.info, { t: wire.v % 2 ? 'odd' : 'even' });
});

test('奇偶各十一枚，耗尽时使用临时口头提示', () => {
  const G = rig(21, [[2, 2, 2], Array(13).fill(4), [3]], [4]);
  // A deliberately large same-parity fixture verifies the real token count.
  G.wires.filter(w => w.o === 1).slice(0, 11).forEach(w => { w.info = { t: 'even' }; });
  cut(G, 4, 2);
  // Cut tokens are reclaimed; replace these so eleven remain deployed.
  G.wires.filter(w => w.o === 1 && !w.cut).forEach(w => { w.info = { t: 'even' }; });
  const pw = G.wires.find(w => w.o === 0);
  assert.equal(BB.act(G, 0, { a: 'equip', n: 4, w: pw.id }), null);
  assert.equal(pw.info, null); assert.deepEqual(G.announcement, { id: pw.id, info: { t: 'even' } });
  assert.equal(G.wires.filter(w => !w.cut && w.info?.t === 'even').length, 11);
});

test('等号标签允许一根已剪黄线，不能两根均已剪，按颜色比较', () => {
  const G = rig(21, [[1.1, 9.1, 11], [2], [2]], [12]);
  G.wires.push(...[0, 1].map((_, i) => ({ id: G.wires.length + i, o: 2, s: 0, v: 12, cut: true, info: null })));
  G.wires[0].cut = true;
  assert.equal(BB.act(G, 0, { a: 'equip', n: 12, w1: 0, w2: 1 }), null);
  assert.deepEqual(G.labels, [{ a: 0, b: 1, t: 'eq' }]);
  G.equip[0].used = false; G.wires[1].cut = true;
  const before = JSON.stringify(G);
  assert(BB.act(G, 0, { a: 'equip', n: 12, w1: 0, w2: 1 })); assert.equal(JSON.stringify(G), before);
});

test('恢复待回应存档后保留任务模块；旧存档仍执行旧规则', () => {
  const G = rig(9, [[3, 3, 1], [3, 3, 1], [2, 2]]); G.seq = [3, 6, 9];
  assert.equal(BB.act(G, 0, { a: 'dual', w: 3, val: 3 }), null);
  const restored = JSON.parse(JSON.stringify(G)); resolve(restored, 3);
  assert.deepEqual(BB.view(restored, 0).pending.choices, [0, 1]);
  assert(!('choices' in BB.view(restored, 2).pending)); resolve(restored, 1);
  assert.equal(BB.cutCount(restored, 3), 2); assert(BB.seqAllowed(restored, 6));
  delete restored.officialState; assert(!BB.seqAllowed(restored, 6));
});
test('可重复双重探测器保持可用，失败不放信息标记', () => {
  const G = rig(58, [[1, 1, 3], [2, 2, 3], [4, 4]]);
  assert.equal(BB.act(G, 0, { a: 'dd', ws: [3, 4], val: 1 }), null);
  assert.equal(G.players[0].dd, 1);
  resolve(G, 3);
  assert.equal(G.det, 1); assert.equal(G.wires[3].info, null);
  assert.equal(G.players[0].dd, 1); assert.equal(G.turn, 1);
  assert.equal(BB.act(G, 1, { a: 'dd', ws: [0, 1], val: 2 }), null);
  resolve(G, 0); assert.equal(G.players[1].dd, 1); assert.equal(G.wires[0].info, null);
  assert.deepEqual(C.equipmentNumbers(M.get('official-development', 58)), [1, 2, 3, 5, 6, 8, 9, 10, 11, 12, 14, 15, 16, 17, 18]);
});


test('频率标记按整架计数，包含已剪线；四根用两枚 ×2', () => {
  for (const count of [1, 2, 3, 4]) {
    const G = rig(24, [[...Array(count).fill(5), 4, 4, 4, 4], [2], [2]], [4]);
    cut(G, 4, 2);
    // 即使三根同值线已剪，留下的一根仍标四根的频率。
    cut(G, 5, count - 1);
    const target = G.wires.find(w => w.v === 5 && !w.cut);
    assert.equal(BB.act(G, 0, { a: 'equip', n: 4, w: target.id }), null);
    assert.deepEqual(target.info, count === 4 ? { t: 'freq', v: 2, copies: 2 } : { t: 'freq', v: count });
    const restored = BB.unpack(BB.packPublic(G), BB.packHand(G, 1), 1);
    assert.deepEqual(restored.players[0].stands[0].find(w => w.id === target.id).info, target.info);
    assert.equal(restored.players[0].stands[0].find(w => w.id === target.id).v, null);
  }
});

test('两架分别计数；便利贴允许已剪蓝线；交换后丢弃频率标记', () => {
  const G = rig(24, [[5, 5, 5, 5, 4, 4], [2, 2], [3, 3]], [4, 2]);
  G.players[0].stands = [[0, 1, 4, 5], [2, 3]];
  G.wires[2].s = 1; G.wires[3].s = 1;
  cut(G, 4, 2); G.wires[0].cut = true;
  assert.equal(BB.act(G, 0, { a: 'equip', n: 4, w: 0 }), null);
  assert.deepEqual(G.wires[0].info, { t: 'freq', v: 2 });
  cut(G, 2, 2);
  // 使用一根带频率标记的线交换；不是普通任务的“标记跟随”。
  G.wires[1].info = { t: 'freq', v: 2 };
  assert.equal(BB.act(G, 0, { a: 'equip', n: 2, w: 1, p: 2 }), null);
  const pending = G.pending.id;
  assert.equal(BB.act(G, 2, { a: 'walkie', id: pending, w: 8 }), null);
  assert.equal(G.wires[1].info, null); assert.equal(G.wires[8].info, null);
});

test('频率失败线索不公开确切数字；×2 两枚占用两个实体标记', () => {
  const G = rig(24, [[1, 1], [5, 5, 5, 5], [3, 3, 4, 4, 4, 4]], [4]);
  assert.equal(BB.act(G, 0, { a: 'dual', w: 2, val: 1 }), null); resolve(G, 2);
  assert.deepEqual(G.wires[2].info, { t: 'freq', v: 2, copies: 2 });
  assert.equal(BB.view(G, 0).players[1].stands[0][0].v, null);
  const H = rig(24, [[5, 5, 5, 5, 4, 4], [2], [2]], [4]); cut(H, 4, 2);
  for (let i = 0; i < 3; i++) H.wires.push({ id: H.wires.length, o: 2, s: 0, v: 6, cut: false, info: { t: 'freq', v: 2, copies: 2 } });
  assert.equal(BB.act(H, 0, { a: 'equip', n: 4, w: 0 }), null);
  assert.equal(H.wires[0].info, null); assert.deepEqual(H.announcement.info, { t: 'freq', v: 2, copies: 2 });
});

test('数字轮换：宣告后翻面，未完成的数字本轮不能重用，无匹配时免费跳过', () => {
  const G = rig(26, [[1, 1, 2], [1, 1], [2, 2, 2]]);
  assert.equal(BB.act(G, 0, { a: 'dual', w: 3, val: 1 }), null);
  assert(G.officialState.numbers.used.includes(1));
  const saved = JSON.parse(JSON.stringify(G)); resolve(saved, 3); resolve(saved, 1);
  assert.equal(saved.turn, 2); assert.equal(saved.det, 0);
  assert(!BB.seqAllowed(saved, 1)); assert(BB.seqAllowed(saved, 2));
  const before = JSON.stringify(saved);
  assert(BB.act(saved, 2, { a: 'dual', w: 0, val: 1 })); assert.equal(JSON.stringify(saved), before);
});

test('数字卡全部翻面后重置；四根完成的数字永久移出牌列', () => {
  const G = rig(26, [[1, 1, 2], [1, 1, 2], [2, 2]]);
  // 只保留尚未完成的 1 和 2 数字卡，模拟上一轮已翻掉 2。
  G.officialState.numbers = { remaining: [1, 2], used: [2] };
  assert.equal(BB.act(G, 0, { a: 'dual', w: 3, val: 1 }), null);
  resolve(G, 3); resolve(G, 1);
  assert.deepEqual(G.officialState.numbers.used, []);
  assert(BB.seqAllowed(G, 1)); assert(BB.seqAllowed(G, 2));
  assert.equal(BB.act(G, 1, { a: 'dual', w: 0, val: 1 }), null);
  resolve(G, 0); resolve(G, 4);
  assert(!G.officialState.numbers.remaining.includes(1));
  assert.deepEqual(BB.view(G, 0).official.numbers.open, [2]);
});

test('数字轮换不含 X/Y；所有支持人数使用官方用线数量', () => {
  for (const n of [2, 3, 4, 5]) {
    const G = game(26, n);
    assert.equal(G.wires.filter(w => Number.isInteger(w.v)).length, 48);
    assert.equal(G.ymark.n, 0); assert.equal(G.rmark.n, 2);
    assert.deepEqual(G.officialState.numbers.remaining, Array.from({ length: 12 }, (_, i) => i + 1));
    assert(!G.equip.some(e => e.n === 10)); assert(!G.equipmentReserve.includes(10));
  }
});

console.log('官方任务模块验收测试通过');

test('版本 3 的改编存档保留自己的任务说明，不显示版本 4 的奇偶规则', () => {
  const mission = { ...M.get('custom', 21), catalog: 'campaign', contentVersion: 3, verified: false };
  const G = BB.createGame(mission, seats(3), { rng: rng() });
  const restored = JSON.parse(JSON.stringify(G));
  const V = BB.view(restored, 0);
  assert.equal(V.ruleset, 'custom'); assert.equal(V.contentVersion, 3); assert.equal(V.official, null);
  assert.equal(V.mission.info, 'choose'); assert.equal(V.mission.rules.timer, 60);
  assert.equal(V.mission.status, '改编规则'); assert.notEqual(V.mission.name, M.get('campaign', 21).name);
  assert.equal(BB.unpack(BB.packPublic(restored), BB.packHand(restored, 0), 0).mission.rules.timer, 60);
});

test('第三盒角色：队长固定双重探测器，新角色不能重复；旧任务不能选新能力', () => {
  const mi = M.get('official-development', 33);
  for (const np of [2, 3, 4, 5]) for (let captain = 0; captain < np; captain++) {
    const roster = seats(np), ids = ['triple-detector', 'xy-ray', 'general-radar', 'walkie-talkies'];
    let index = 0;
    roster.forEach((s, p) => { s.character = p === captain ? 'general-radar' : ids[index++]; });
    const G = BB.createGame(mi, roster, { captain, rng: rng() });
    assert.equal(BB.characterState(G.players[captain]).id, 'double-detector');
    assert.equal(G.players[captain].dd, 1);
    G.players.forEach((p, i) => { if (i !== captain) { assert.equal(p.dd, 0); assert(!BB.characterState(p).used); } });
    const view = BB.unpack(BB.packPublic(G), BB.packHand(G, 0), 0);
    assert.deepEqual(view.players.map(p => p.character), G.players.map(BB.characterState));
  }
  const duplicate = seats(3); duplicate[1].character = duplicate[2].character = 'xy-ray';
  assert.throws(() => BB.createGame(mi, duplicate), /只有一张/);
  assert.throws(() => BB.createGame(M.get('physical', 1), duplicate), /不能选择/);
});
function role(G, pi, id) { G.players[pi].character = { id, used: false }; G.players[pi].dd = id === 'double-detector' ? 1 : 0; }
function rejected(G, pi, action) { const before = JSON.stringify(G); assert(BB.act(G, pi, action)); assert.equal(JSON.stringify(G), before); }

test('个人三重探测器无需解锁，回应后可选择自己的任意同值线；共享卡仍锁定', () => {
  const G = rig(33, [[1, 2], [3, 3, 4], [3, 4, 5]], [3]); role(G, 1, 'triple-detector'); G.turn = 1;
  rejected(G, 1, { a: 'character', n: 3, ws: [5, 6], val: 3 });
  rejected(G, 1, { a: 'character', n: 3, ws: [5, 6, 7], val: 'Y' });
  rejected(G, 1, { a: 'character', n: 8, val: 3 });
  assert.equal(BB.act(G, 1, { a: 'character', ws: [5, 6, 7], val: 3 }), null);
  assert(BB.characterState(G.players[1]).used); assert(!G.equip[0].used);
  assert(!('choices' in BB.view(G, 0).pending));
  resolve(G, 5); assert.deepEqual(BB.view(G, 1).pending.choices, [2, 3]);
  assert.equal(BB.view(G, 0).pending.hit, 5);
  const restored = JSON.parse(JSON.stringify(G)); resolve(restored, 3);
  assert(restored.wires[3].cut); assert(!restored.wires[2].cut); assert(restored.wires[5].cut);
  assert.equal(restored.players[0].dd, 1); assert(!restored.equip[0].used);
  const two = rig(33, [[1], [3, 3], [3, 4]], []); role(two, 1, 'triple-detector'); two.turn = 1;
  assert.equal(BB.act(two, 1, { a: 'character', ws: [3, 4], val: 3 }), null);
});

test('个人 X/Y 可与共享三重探测器、稳定器组合；一张个人卡不能重复叠用', () => {
  const G = rig(33, [[1], [3, 4], [3, 4, 5]], [3, 9]); role(G, 1, 'xy-ray'); G.turn = 1;
  G.wires.push({ id: 6, o: 0, s: 0, v: 3, cut: true, info: null }, { id: 7, o: 0, s: 0, v: 3, cut: true, info: null }, { id: 8, o: 0, s: 0, v: 9, cut: true, info: null }, { id: 9, o: 0, s: 0, v: 9, cut: true, info: null });
  G.players[0].stands[0].push(6, 7, 8, 9);
  rejected(G, 1, { a: 'equip', n: 3, ws: [3, 4, 5], val: 3, xy: true, xyPersonal: true, vals: [3, 'Y'] });
  assert.equal(BB.act(G, 1, { a: 'equip', n: 3, ws: [3, 4, 5], val: 3, vals: [3, 4], xy: true, xyPersonal: true, stab: true }), null);
  assert(G.equip.every(e => e.used)); assert(BB.characterState(G.players[1]).used);
  resolve(G, 4); resolve(G, 2); assert(G.wires[4].cut && G.wires[2].cut);
  const solo = rig(33, [[1], [1.1, 3], [2.1, 3]], []); role(solo, 1, 'xy-ray'); solo.turn = 1;
  assert.equal(BB.act(solo, 1, { a: 'character', w: 3, vals: ['Y', 3] }), null);
  resolve(solo, 3); resolve(solo, 1); assert(solo.wires[1].cut && solo.wires[3].cut);
});

test('个人雷达可在别人回合使用，每架单独回答；备用电池恢复不同类型的角色', () => {
  const G = rig(33, [[1, 7, 7], [3], [3]], [7, 8]); role(G, 1, 'general-radar'); role(G, 2, 'xy-ray');
  assert.equal(BB.act(G, 1, { a: 'character', val: 3 }), null);
  assert.deepEqual(G.radar.res, [[false], [true], [true]]); assert.equal(G.turn, 0);
  assert(BB.characterState(G.players[1]).used); assert(!G.equip[1].used);
  G.players[2].character.used = true; cut(G, 7, 2);
  assert.equal(BB.act(G, 0, { a: 'equip', n: 7, players: [1, 2] }), null);
  assert(!BB.characterState(G.players[1]).used); assert(!BB.characterState(G.players[2]).used);
  assert.equal(G.players[1].dd, 0); assert.equal(G.players[2].dd, 0);
  assert.equal(BB.act(G, 1, { a: 'character', val: 3 }), null);
});

test('个人对讲机离回合使用、保存后回应，保留奇偶标记且不消耗共享卡', () => {
  const G = rig(33, [[1, 2], [3], [4]], [2]); role(G, 1, 'walkie-talkies');
  G.wires[2].info = { t: 'odd' };
  assert.equal(BB.act(G, 1, { a: 'character', w: 2, p: 2 }), null);
  assert(!G.equip[0].used); assert(BB.characterState(G.players[1]).used);
  const R = JSON.parse(JSON.stringify(G));
  rejected(R, 2, { a: 'walkie', id: R.pending.id + 1, w: 3 });
  assert.equal(BB.act(R, 2, { a: 'walkie', id: R.pending.id, w: 3 }), null);
  assert.equal(R.wires[2].o, 2); assert.deepEqual(R.wires[2].info, { t: 'odd' });
  assert.equal(R.turn, 0); assert(!R.equip[0].used);
});

test('第 33 关不同人数与角色的机器人始终提交合法动作并结束牌局', () => {
  const Bot = require('../js/bot');
  for (const np of [2, 3, 4, 5]) for (let seed = 1; seed <= 5; seed++) {
    const roster = seats(np), captain = seed % np;
    const ids = ['triple-detector', 'xy-ray', 'general-radar', 'walkie-talkies']; let ri = 0;
    roster.forEach((s, i) => { s.bot = true; s.character = i === captain ? 'double-detector' : ids[(ri++ + seed) % ids.length]; });
    const G = BB.createGame(M.get('physical', 33), roster, { captain, rng: rng(seed) });
    let actions = 0;
    while (G.phase === 'setup' || G.phase === 'play') {
      assert(++actions < 350, '机器人未结束牌局');
      const pi = G.phase === 'setup' ? (G.captain + Object.values(G.setup).reduce((a, b) => a + b, 0)) % np : G.pending ? G.pending.to : G.turn;
      const action = Bot.decide(G, pi);
      assert(action, '机器人没有行动');
      assert.equal(BB.act(G, pi, action), null, JSON.stringify(action));
    }
  }
});

function chooseConstraint(G, card) {
  return BB.act(G, G.turn, { a: 'constraint-select', id: G.officialState.constraints.decisionId, card });
}
function sharedCard(G, id, deck = []) {
  const state = G.officialState.constraints;
  state.active = id; state.deck = deck; state.captainPending = false; state.enteredTurn = G.turnNo;
}

test('个人限制按队长顺序选择 A–E，然后才能放初始标记；选择可看自己的手牌', () => {
  for (const np of [2, 3, 4, 5]) for (let captain = 0; captain < np; captain++) {
    const G = game(31, np, { captain });
    assert.equal(G.phase, 'constraints'); assert.equal(G.turn, captain); assert.equal(G.infoN, 1);
    assert.equal(G.wires.filter(w => Number.isInteger(w.v)).length, 48);
    assert.equal(G.rmark.n, 2); assert.equal(G.rmark.cand.length, 3); assert.equal(G.ymark.n, 0);
    const V = BB.view(G, captain);
    assert(V.players[captain].stands.flat().every(w => w.v !== null));
    assert(V.players.filter((_, p) => p !== captain).flatMap(p => p.stands.flat()).every(w => w.v === null));
    assert.equal(BB.setPaused(G, true), null); rejected(G, captain, { a: 'constraint-select', id: V.official.constraints.decisionId, card: 'A' }); BB.setPaused(G, false);
    const first = G.wires.find(w => w.o === captain && Number.isInteger(w.v));
    rejected(G, captain, { a: 'info', w: first.id });
    rejected(G, (captain + 1) % np, { a: 'constraint-select', id: G.officialState.constraints.decisionId, card: 'A' });
    for (const card of 'ABCDE'.slice(0, np)) {
      const id = G.officialState.constraints.decisionId;
      assert.equal(chooseConstraint(G, card), null);
      if (G.phase === 'constraints') rejected(G, G.turn, { a: 'constraint-select', id, card: 'E' });
    }
    assert.equal(G.phase, 'setup'); assert.equal(G.turn, captain);
    assert.equal(new Set(G.officialState.constraints.personal.map(c => c.id)).size, np);
    assert.equal(G.officialState.constraints.available.length, 0);
    assert.equal(BB.act(G, captain, { a: 'info', w: first.id }), null);
  }
});

test('A–F 只约束行动玩家的宣告；被指队友可以剪自己限制以外的匹配线', () => {
  const G = rig(31, [[2, 2, 3], [2, 3], [3]], []);
  G.officialState.constraints.personal = [{ id: 'A', retired: false }, { id: 'B', retired: false }, { id: 'D', retired: false }];
  for (const [id, allowed] of [['A', [2, 4, 6, 8, 10, 12]], ['B', [1, 3, 5, 7, 9, 11]], ['C', [1, 2, 3, 4, 5, 6]], ['D', [7, 8, 9, 10, 11, 12]], ['E', [4, 5, 6, 7, 8, 9]], ['F', [1, 2, 3, 10, 11, 12]]]) {
    const S = rig(32, [[2], [2], [3]], []); sharedCard(S, id);
    for (let value = 1; value <= 12; value++) assert.equal(BB.actorValueAllowed(S, 0, value), allowed.includes(value), id + ':' + value);
    assert.equal(BB.actorValueAllowed(S, 0, 'Y'), id === 'F');
  }
  rejected(G, 0, { a: 'dual', w: 4, val: 3 });
  assert.equal(BB.act(G, 0, { a: 'dual', w: 3, val: 2 }), null);
  resolve(G, 3); resolve(G, 1); assert(G.wires[3].cut && G.wires[1].cut);
  assert.equal(BB.constraint(G, 1), 'B');
});

test('回合开始无法遵守个人限制时永久翻面；后来交换得到对应导线也不恢复', () => {
  const G = rig(31, [[2, 2, 2, 2, 4], [3], [4, 4]], [2]);
  G.officialState.constraints.personal = [{ id: 'A', retired: false }, { id: 'D', retired: false }, { id: 'C', retired: false }];
  assert.equal(BB.act(G, 0, { a: 'solo', val: 2 }), null);
  assert.equal(G.turn, 1); assert(G.officialState.constraints.personal[1].retired);
  // 仅测试交换本身，使用两根已剪 2 解锁对讲机。
  G.wires[6].v = 8;
  assert.equal(BB.act(G, 1, { a: 'equip', n: 2, w: 5, p: 2 }), null);
  assert.equal(BB.act(G, 2, { a: 'walkie', id: G.pending.id, w: 6 }), null);
  assert.equal(G.wires[6].o, 1); assert.equal(BB.constraint(G, 1), null);
  assert(G.officialState.constraints.personal[1].retired);
});

test('共享限制牌堆只公开剩余数量；队长开始选择有独立编号，不能重复回应', () => {
  const G = game(32);
  assert.equal(G.officialState.constraints.deck.length, 11);
  assert.equal(new Set([G.officialState.constraints.active, ...G.officialState.constraints.deck]).size, 12);
  assert(!('deck' in BB.view(G, 0).official.constraints));
  for (let p = 0; p < G.np; p++) {
    const w = G.wires.find(w => w.o === p && Number.isInteger(w.v));
    assert.equal(BB.act(G, p, { a: 'info', w: w.id }), null);
  }
  const state = G.officialState.constraints; assert(state.captainPending);
  const decision = state.decisionId;
  rejected(G, 1, { a: 'constraint-ready', id: decision, replace: true });
  rejected(G, 0, { a: 'constraint-ready', id: decision + 1, replace: true });
  rejected(G, 0, { a: 'dual', w: G.wires.find(w => w.o === 1).id, val: 1 });
  G.officialState.constraints.deck = []; G.officialState.constraints.active = 'A';
  assert.equal(BB.act(G, 0, { a: 'constraint-ready', id: decision, replace: true }), null);
  assert.equal(G.officialState.constraints.active, null); assert(!G.officialState.constraints.captainPending);
  rejected(G, 0, { a: 'constraint-ready', id: decision, replace: true });
});

test('G 禁用共享与个人装备，拒绝动作不消耗卡牌；普通拆线仍然合法', () => {
  const G = rig(32, [[3, 3, 8, 8], [3, 4], [4]], [3, 8]); sharedCard(G, 'G'); role(G, 0, 'general-radar');
  rejected(G, 0, { a: 'character', val: 3 });
  rejected(G, 1, { a: 'equip', n: 8, val: 3 });
  rejected(G, 0, { a: 'dual', w: 4, val: 3, stab: true });
  assert.equal(BB.act(G, 0, { a: 'dual', w: 4, val: 3 }), null);
});

test('H 不能选择有信息标记的线，也不能用便利贴；失败没有数字或临时口头线索', () => {
  const G = rig(32, [[3, 3, 4, 4], [5, 6], [2]], [4]); sharedCard(G, 'H');
  G.wires[0].info = { t: 'v', v: 3 }; G.wires[4].info = { t: 'v', v: 5 };
  rejected(G, 0, { a: 'equip', n: 4, w: 1 });
  rejected(G, 0, { a: 'dual', w: 4, val: 3 });
  assert.equal(BB.act(G, 0, { a: 'dual', w: 5, val: 3 }), null);
  const pd = BB.view(G, 1).pending; assert(pd.noClue); assert.deepEqual(pd.choices, []);
  resolve(G, null); assert.equal(G.det, 1); assert.equal(G.wires[5].info, null); assert.equal(G.announcement, null);
  const S = rig(32, [[3, 3], [3, 4], [2]], []); sharedCard(S, 'H'); S.wires[0].info = { t: 'v', v: 3 };
  assert.equal(BB.act(S, 0, { a: 'dual', w: 2, val: 3 }), null); resolve(S, 2);
  assert.deepEqual(BB.view(S, 0).pending.choices, [1]); rejected(S, 0, { a: 'resolve', id: S.pending.id, w: 0 }); resolve(S, 1);
});

test('I／J 按每架剩余导线的端点判断；K 禁单拆；L 失败两格且稳定器保护', () => {
  for (const [card, forbidden] of [['I', 5], ['J', 3]]) {
    const G = rig(32, [[3, 3], [2, 3, 4, 5], [1]], []); sharedCard(G, card);
    // 目标架未剪端点分别是 id2 和 id5。
    rejected(G, 0, { a: 'dual', w: card === 'I' ? forbidden : 2, val: 3 });
    G.wires[card === 'I' ? 5 : 2].cut = true;
    rejected(G, 0, { a: 'dual', w: card === 'I' ? 4 : 3, val: 3 });
  }
  const K = rig(32, [[3, 3, 3, 3], [2], [2]], []); sharedCard(K, 'K');
  assert(!BB.soloOk(K, 0, 3)); rejected(K, 0, { a: 'solo', val: 3 });
  const L = rig(32, [[3, 9, 9], [4], [3]], [9]); sharedCard(L, 'L');
  assert.equal(BB.act(L, 0, { a: 'dual', w: 3, val: 3 }), null); resolve(L, 3); assert.equal(L.det, 2);
  const shield = rig(32, [[3, 9, 9], [4], [3]], [9]); sharedCard(shield, 'L'); cut(shield, 9, 2);
  assert.equal(BB.act(shield, 0, { a: 'dual', w: 3, val: 3, stab: true }), null); resolve(shield, 3); assert.equal(shield.det, 0);
});

test('第 37 关每完成一个蓝值换牌；全部不能行动时罚一格换牌，公开红线不受限制', () => {
  const G = rig(37, [[2, 2, 2, 2, 3], [3], [4]], []); sharedCard(G, 'A', ['B', 'C']);
  assert.equal(BB.act(G, 0, { a: 'solo', val: 2 }), null);
  assert.equal(G.officialState.constraints.active, 'B'); assert.deepEqual(G.officialState.constraints.completed, [2]);
  const stuck = rig(37, [[3, 3, 1.5], [], []], []); sharedCard(stuck, 'K', ['B']);
  // 另外两根蓝 3 已剪，只有自己有最后一对，但 K 禁止单拆。
  stuck.wires.push({ id: 3, o: 0, s: 0, v: 3, cut: true, info: null }, { id: 4, o: 0, s: 0, v: 3, cut: true, info: null }); stuck.players[0].stands[0].push(3, 4);
  assert(!BB.canAct(stuck, 0));
  C.enterTurn(stuck, { canAct: BB.canAct, nextPlayer: () => 0, log: BB.addLog, lose: () => { throw Error('不应爆炸'); } });
  assert.equal(stuck.det, 1); assert.equal(stuck.officialState.constraints.active, 'B'); assert(BB.canAct(stuck, 0));
  const red = rig(37, [[1.5], [2], [2]], []); sharedCard(red, 'D');
  assert.equal(BB.act(red, 0, { a: 'red' }), null); assert(red.wires[0].cut);
});

test('个人限制与新角色组合的机器人在 2–5 人完成牌局，不重复提交被拒绝的行动', () => {
  const Bot = require('../js/bot');
  for (const np of [2, 3, 4, 5]) for (let seed = 1; seed <= 5; seed++) {
    const roster = seats(np), captain = seed % np;
    const ids = ['triple-detector', 'xy-ray', 'general-radar', 'walkie-talkies']; let ri = 0;
    roster.forEach((s, i) => { s.bot = true; s.character = i === captain ? 'double-detector' : ids[(ri++ + seed) % ids.length]; });
    const G = BB.createGame(M.get('physical', 31), roster, { captain, rng: rng(seed) });
    let actions = 0;
    while (['constraints', 'setup', 'play'].includes(G.phase)) {
      assert(++actions < 350, '机器人未结束限制牌局');
      const pi = G.phase === 'setup' ? (G.captain + Object.values(G.setup).reduce((a, b) => a + b, 0)) % np : G.pending ? G.pending.to : G.turn;
      const action = Bot.decide(G, pi); assert(action, '机器人没有选择限制或行动');
      assert.equal(BB.act(G, pi, action), null, JSON.stringify(action));
    }
  }
});

test('第25关 2–5人用线、手势宣告与人工语音违规记录符合卡面', () => {
  for (const np of [2, 3, 4, 5]) for (let captain = 0; captain < np; captain++) {
    const G = game(25, np, { captain });
    assert.equal(G.wires.filter(w => Number.isInteger(w.v)).length, 48);
    assert.equal(G.ymark.n, 0); assert.equal(G.rmark.n, np === 2 ? 3 : 2);
    assert.equal(G.rmark.cand.length, G.rmark.n);
    assert.equal(G.equip.length, np); assert(G.equip.every(e => e.n <= 12));
    assert(G.players.every(p => p.dd === 1));
    assert.equal(G.officialState.communicationPenalties, 0);
    const before = JSON.stringify(G); assert(BB.act(G, captain, { a: 'communication-penalty' })); assert.equal(JSON.stringify(G), before);
    const view = BB.view(G, captain);
    assert(BB.communicationRule(G)); assert(BB.communicationRule(view));
    assert.equal(BB.announcementLabel(view, 3), '手势 ● ● ●');
    assert.equal(BB.announcementLabel(view, 12).split('●').length - 1, 12);
    assert(view.players.filter((_, i) => i !== captain).flatMap(p => p.stands.flat()).every(w => w.v === null));
  }
  const old = BB.createGame(M[24], seats(3));
  assert(!BB.communicationRule(old)); assert.equal(BB.announcementLabel(old, 3), BB.valLabel(3));
  assert(BB.act(old, 0, { a: 'communication-penalty' }));
});

test('违规不跳过回合、不被稳定器免除；回应中处罚保持私人选择并可恢复', () => {
  const G = rig(25, [[3, 3, 9, 9], [3, 3], [4, 4]], [9]);
  assert.equal(BB.act(G, 0, { a: 'dual', w: 4, val: 3 }), null);
  resolve(G, 4); assert.equal(G.pending.step, 'own');
  const pd = JSON.stringify(G.pending), turn = G.turnNo;
  G.stab = true;
  assert.equal(BB.act(G, 2, { a: 'communication-penalty' }), null);
  assert.equal(G.det, 1); assert.equal(G.turnNo, turn); assert.equal(JSON.stringify(G.pending), pd);
  assert.equal(G.officialState.communicationPenalties, 1);
  assert.deepEqual(BB.view(G, 0).pending.choices, [0, 1]);
  assert(!('choices' in BB.view(G, 2).pending));
  assert(BB.detonatorText(G).includes('再前进 2 格引爆'));
  const restored = JSON.parse(JSON.stringify(G));
  assert.equal(restored.officialState.communicationPenalties, 1); resolve(restored, 1);
  assert(restored.wires[1].cut); assert(!restored.wires[0].cut); assert.equal(restored.turnNo, turn + 1);
  assert.equal(BB.setPaused(G, true), null); rejected(G, 1, { a: 'communication-penalty' });
  assert.equal(BB.setPaused(G, false), null);
  assert.equal(BB.act(G, 1, { a: 'communication-penalty' }), null); assert.equal(G.phase, 'play');
  assert.equal(BB.act(G, 0, { a: 'communication-penalty' }), null); assert.equal(G.phase, 'lost'); assert.equal(G.pending, null);
  rejected(G, 1, { a: 'communication-penalty' });
});
