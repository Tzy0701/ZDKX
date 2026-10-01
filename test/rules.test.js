/* 规则单元测试：node test/rules.test.js */
const assert = require('assert');
const BB = require('../js/engine.js');
const M = require('../js/missions.js');

let n = 0;
function t(name, fn) { fn(); n++; console.log('✓', name); }
const seats = (k) => Array.from({ length: k }, (_, i) => ({ pid: 'p' + i, name: 'P' + i }));

// 构造一个确定的牌局：hands[i] = 玩家 i 的线数值
function rig(hands, opts = {}) {
  const mission = Object.assign({}, M[7], { info: 'none', eq: 0, rules: {} }, opts.mission || {});
  const G = BB.createGame(mission, seats(hands.length));
  let id = 0;
  G.wires = [];
  hands.forEach((h, o) => h.forEach((v) => G.wires.push({ id: id++, v, o, s: 0, cut: false, info: null })));
  G.players.forEach((p) => { p.stands = [[]]; });
  G.np = hands.length;
  G.wires.sort((a, b) => a.v - b.v).forEach((w) => G.players[w.o].stands[0].push(w.id));
  G.wires.sort((a, b) => a.id - b.id);
  G.ymark = { n: hands.flat().filter((v) => BB.kindOf(v) === 'y').length, cand: [] };
  G.rmark = { n: hands.flat().filter((v) => BB.kindOf(v) === 'r').length, cand: [] };
  G.equip = (opts.equip || []).map((n) => ({ n, used: false }));
  G.phase = 'play'; G.turn = 0; G.det = 0; G.detMax = opts.detMax || 3; G.seq = opts.seq || [];
  G.deadline = null;
  return G;
}
const wid = (G, o, v) => G.wires.find((w) => w.o === o && w.v === v && !w.cut).id;

t('所有任务配置合法，人数 2-5 都能建局', () => {
  assert.strictEqual(M.length, 66);
  for (const m of M) for (const k of [2, 3, 4, 5]) {
    const G = BB.createGame(m, seats(k));
    const blue = G.wires.filter((w) => BB.kindOf(w.v) === 'b').length;
    assert.strictEqual(blue % 4, 0);
    assert.strictEqual(G.wires.filter((w) => BB.kindOf(w.v) === 'y').length, m.y[0]);
    assert.strictEqual(G.wires.filter((w) => BB.kindOf(w.v) === 'r').length, m.r[0]);
    G.players.forEach((p) => p.stands.forEach((st) => {
      for (let i = 1; i < st.length; i++) assert(G.wires[st[i - 1]].v <= G.wires[st[i]].v, '线架必须有序');
    }));
    assert.strictEqual(G.players[0].stands.length, k === 2 ? 2 : 1);
  }
});

t('双人剪：命中后双方各剪一根', () => {
  const G = rig([[3, 5], [5, 7]]);
  assert.strictEqual(BB.act(G, 0, { a: 'dual', w: wid(G, 1, 5), val: 5 }), null);
  assert.strictEqual(G.wires.filter((w) => w.cut).length, 2);
  assert.strictEqual(G.turn, 1);
});

t('双人剪：必须持有宣告的数值，不能指向自己', () => {
  const G = rig([[3, 5], [5, 7]]);
  assert.match(BB.act(G, 0, { a: 'dual', w: wid(G, 1, 7), val: 7 }), /持有/);
  assert.match(BB.act(G, 0, { a: 'dual', w: wid(G, 0, 3), val: 3 }), /自己/);
  assert.match(BB.act(G, 1, { a: 'dual', w: wid(G, 0, 3), val: 5 }), /轮到/);
});

t('双人剪失败：引爆器 +1，并公开真实数值', () => {
  const G = rig([[3, 5], [5, 7]]);
  BB.act(G, 0, { a: 'dual', w: wid(G, 1, 7), val: 5 });
  assert.strictEqual(G.det, 1);
  assert.deepStrictEqual(G.wires.find((w) => w.v === 7).info, { t: 'v', v: 7 });
});

t('剪到红线立即爆炸', () => {
  const G = rig([[3, 5], [5, 6.5]]);
  BB.act(G, 0, { a: 'dual', w: wid(G, 1, 6.5), val: 5 });
  assert.strictEqual(G.phase, 'lost');
});

t('引爆器走满就爆炸', () => {
  const G = rig([[3, 5], [5, 7], [3, 9]], { detMax: 2 });
  BB.act(G, 0, { a: 'dual', w: wid(G, 1, 7), val: 5 });
  BB.act(G, 1, { a: 'dual', w: wid(G, 2, 9), val: 5 });
  assert.strictEqual(G.phase, 'lost');
});

t('黄线：宣告“黄色”', () => {
  const G = rig([[2.1, 5], [4.1, 5]]);
  assert.strictEqual(BB.act(G, 0, { a: 'dual', w: wid(G, 1, 4.1), val: 'Y' }), null);
  assert.strictEqual(G.wires.filter((w) => w.cut && BB.kindOf(w.v) === 'y').length, 2);
  assert.match(BB.act(G, 1, { a: 'dual', w: wid(G, 0, 5), val: 'R' }), /红色/);
});

t('剪错黄线时信息标记写“黄”', () => {
  const G = rig([[2.1, 5], [4.1, 5]]);
  BB.act(G, 0, { a: 'dual', w: wid(G, 1, 4.1), val: 5 });
  assert.deepStrictEqual(G.wires.find((w) => w.v === 4.1).info, { t: 'Y' });
});

t('单人剪：持有全部剩余的线', () => {
  const G = rig([[4, 4, 4, 4, 6], [6, 8]]);
  assert.strictEqual(BB.act(G, 0, { a: 'solo', val: 4 }), null);
  assert.strictEqual(G.wires.filter((w) => w.cut).length, 4);
  const H = rig([[4, 4, 6], [4, 4, 6]]);
  assert.match(BB.act(H, 0, { a: 'solo', val: 4 }), /所有剩余/);
});

t('公开红线 + 剪完非红线即胜利', () => {
  const G = rig([[5, 7.5], [5]]);
  BB.act(G, 0, { a: 'dual', w: wid(G, 1, 5), val: 5 });
  assert.strictEqual(G.phase, 'won');
  const H = rig([[7.5], [5, 5, 8], [8, 9, 9]]);
  assert.strictEqual(BB.act(H, 0, { a: 'red' }), null);
  assert(H.wires.find((w) => w.v === 7.5).cut);
});

t('双重探测器：两根中有一根即成功；只用一次', () => {
  const G = rig([[5, 5, 9], [3, 5, 8], [9, 9, 9]]);
  G.players.forEach((p) => (p.dd = 1));
  assert.strictEqual(BB.act(G, 0, { a: 'dd', ws: [wid(G, 1, 3), wid(G, 1, 5)], val: 5 }), null);
  assert(G.wires.find((w) => w.o === 1 && w.v === 5).cut);
  G.turn = 0;
  assert.match(BB.act(G, 0, { a: 'dd', ws: [wid(G, 1, 3), wid(G, 1, 8)], val: 5 }), /用过/);
});

t('双重探测器：一红一错只前进引爆器，两红才爆炸', () => {
  const G = rig([[5, 9], [3, 4.5, 8]]);
  G.players.forEach((p) => (p.dd = 1));
  BB.act(G, 0, { a: 'dd', ws: [wid(G, 1, 3), wid(G, 1, 4.5)], val: 5 });
  assert.strictEqual(G.phase, 'play');
  assert.strictEqual(G.det, 1);
  assert.deepStrictEqual(G.wires.find((w) => w.v === 3).info, { t: 'v', v: 3 });
});

t('装备解锁需要剪掉 2 根同编号', () => {
  const G = rig([[6, 6, 9], [6, 6, 9]], { equip: [6] });
  G.det = 1;
  assert.match(BB.act(G, 0, { a: 'equip', n: 6 }), /解锁/);
  BB.act(G, 0, { a: 'dual', w: wid(G, 1, 6), val: 6 });
  assert.strictEqual(BB.act(G, 0, { a: 'equip', n: 6 }), null, '倒带器可在别人回合使用');
  assert.strictEqual(G.det, 0);
  assert.match(BB.act(G, 0, { a: 'equip', n: 6 }), /用过/);
});

function unlocked(hands, n, extra) {
  const G = rig(hands, Object.assign({ equip: [n] }, extra));
  G.wires.filter((w) => w.v === n).slice(0, 2).forEach((w) => (w.cut = true));
  return G;
}

t('装备 3 三重探测器', () => {
  const G = unlocked([[3, 3, 7, 9], [1, 2, 9, 11], [3, 3]], 3);
  assert.strictEqual(BB.act(G, 0, { a: 'equip', n: 3, ws: [wid(G, 1, 1), wid(G, 1, 2), wid(G, 1, 9)], val: 9 }), null);
  assert(G.wires.find((w) => w.o === 1 && w.v === 9).cut);
});

t('装备 5 超级探测器', () => {
  const G = unlocked([[5, 5, 8], [1, 2, 8, 11], [5, 5]], 5);
  assert.strictEqual(BB.act(G, 0, { a: 'equip', n: 5, p: 1, s: 0, val: 8 }), null);
  assert(G.wires.find((w) => w.o === 1 && w.v === 8).cut);
});

t('装备 10 X/Y 射线', () => {
  const G = unlocked([[10, 10, 2, 7], [7, 9], [10, 10]], 10);
  assert.strictEqual(BB.act(G, 0, { a: 'equip', n: 10, w: wid(G, 1, 7), vals: [2, 7] }), null);
  assert(G.wires.find((w) => w.o === 1 && w.v === 7).cut);
});

t('装备 9 稳定器：失败不前进、红线不爆炸', () => {
  const G = unlocked([[9, 9, 5], [3.5, 6], [9, 9]], 9);
  BB.act(G, 0, { a: 'equip', n: 9 });
  BB.act(G, 0, { a: 'dual', w: wid(G, 1, 3.5), val: 5 });
  assert.strictEqual(G.phase, 'play');
  assert.strictEqual(G.det, 0);
});

t('装备 4 便利贴 / 1 标签≠ / 12 标签=', () => {
  const G = unlocked([[4, 4, 5, 6, 6], [4, 4, 12, 12], [1, 1, 12, 12]], 4);
  assert.strictEqual(BB.act(G, 0, { a: 'equip', n: 4, w: wid(G, 0, 5) }), null);
  assert.deepStrictEqual(G.wires.find((w) => w.v === 5).info, { t: 'v', v: 5 });
  const H = unlocked([[1, 1, 3, 5, 5], [1, 1, 12, 12], [12, 12]], 1);
  const st = H.players[0].stands[0].filter((id) => !H.wires[id].cut);
  assert.match(BB.act(H, 0, { a: 'equip', n: 1, w1: st[2], w2: st[1] === undefined ? st[0] : st[1] }), /相同|不同|相邻/);
  assert.strictEqual(BB.act(H, 0, { a: 'equip', n: 1, w1: wid(H, 0, 3), w2: wid(H, 0, 5) }), null);
  const E = unlocked([[1, 1, 3, 5, 5], [12, 12], [12, 12]], 12);
  const fives = E.wires.filter((w) => w.o === 0 && w.v === 5).map((w) => w.id);
  assert.strictEqual(BB.act(E, 0, { a: 'equip', n: 12, w1: fives[0], w2: fives[1] }), null);
});

t('装备 2 对讲机：交换线并重新排序', () => {
  const G = unlocked([[2, 2, 3], [2, 2, 9], [1, 10]], 2);
  assert.strictEqual(BB.act(G, 0, { a: 'equip', n: 2, w: wid(G, 0, 3), p: 1 }), null);
  assert.match(BB.act(G, 0, { a: 'dual', w: wid(G, 1, 9), val: 3 }), /等待/);
  assert.strictEqual(BB.act(G, 1, { a: 'walkie', w: wid(G, 1, 9) }), null);
  assert(G.wires.find((w) => w.v === 9).o === 0);
  assert(G.wires.find((w) => w.v === 3).o === 1);
  const st = G.players[0].stands[0].map((id) => G.wires[id].v);
  assert.deepStrictEqual(st, [...st].sort((a, b) => a - b));
});

t('装备 7 应急电池 / 8 雷达 / 11 咖啡杯', () => {
  const G = unlocked([[7, 7, 3], [7, 7, 3, 5], [5, 8, 8]], 7);
  G.players.forEach((p) => (p.dd = 0));
  assert.strictEqual(BB.act(G, 2, { a: 'equip', n: 7 }), null);
  assert.strictEqual(G.players.filter((p) => p.dd).length, 2);
  const R = unlocked([[8, 8, 3], [8, 8, 3, 5], [5, 9]], 8);
  BB.act(R, 1, { a: 'equip', n: 8, val: 5 });
  assert.deepStrictEqual(R.radar.res, [false, true, true]);
  const C = unlocked([[11, 11, 3], [11, 11, 3], [5, 5]], 11);
  assert.strictEqual(BB.act(C, 0, { a: 'equip', n: 11, p: 2 }), null);
  assert.strictEqual(C.turn, 2);
});

t('顺序引信：前一个数值剪完前不能宣告后一个', () => {
  const G = rig([[2, 2, 5], [2, 2, 5]], { seq: [2, 5] });
  assert.match(BB.act(G, 0, { a: 'dual', w: wid(G, 1, 5), val: 5 }), /顺序/);
  BB.act(G, 0, { a: 'dual', w: wid(G, 1, 2), val: 2 });
  BB.act(G, 1, { a: 'dual', w: wid(G, 0, 2), val: 2 });
  assert.strictEqual(BB.act(G, 0, { a: 'dual', w: wid(G, 1, 5), val: 5 }), null);
});

t('浓雾 / 失败无信息', () => {
  const F = rig([[3, 5], [5, 7]], { mission: { rules: { fog: true } } });
  BB.act(F, 0, { a: 'dual', w: wid(F, 1, 7), val: 5 });
  assert.deepStrictEqual(F.wires.find((w) => w.v === 7).info, { t: 'not', v: '5' });
  const S = rig([[3, 5], [5, 7]], { mission: { rules: { silent: true } } });
  BB.act(S, 0, { a: 'dual', w: wid(S, 1, 7), val: 5 });
  assert.strictEqual(S.wires.find((w) => w.v === 7).info, null);
});

t('超时与老化引信', () => {
  const G = rig([[3, 5, 9], [5, 7, 9]], { mission: { rules: { countdown: 1 } }, detMax: 9 });
  BB.act(G, 0, { a: 'timeout' });
  assert.strictEqual(G.det, 2, '超时 +1，每 1 回合老化 +1');
});

t('布置阶段：只能在自己的蓝线上放信息', () => {
  const G = BB.createGame(M[7], seats(3));
  const mine = G.wires.find((w) => w.o === 0 && BB.kindOf(w.v) === 'b');
  const other = G.wires.find((w) => w.o === 1);
  assert.match(BB.act(G, 0, { a: 'info', w: other.id }), /自己/);
  assert.strictEqual(BB.act(G, 0, { a: 'info', w: mine.id }), null);
  assert.match(BB.act(G, 0, { a: 'info', w: mine.id }), /已经/);
});

t('视图不泄露他人未剪的线；联机编码可还原且 <4KB', () => {
  for (const k of [2, 5]) {
    const G = BB.createGame(M[65], seats(k));
    const V = BB.view(G, 0);
    V.players.forEach((p, i) => p.stands.forEach((st) => st.forEach((w) => {
      if (i !== 0 && !w.cut) assert.strictEqual(w.v, null);
      if (i === 0) assert.notStrictEqual(w.v, null);
    })));
    const pub = BB.packPublic(G);
    assert(JSON.stringify(pub).length < 3800);
    assert(!JSON.stringify(pub.players).includes('.5,'), '公共数据里不能出现未剪红线');
    const U = BB.unpack(pub, BB.packHand(G, 1), 1);
    U.players[1].stands.forEach((st) => st.forEach((w) => assert.notStrictEqual(w.v, null)));
    U.players[0].stands.forEach((st) => st.forEach((w) => assert.strictEqual(w.v, null)));
  }
});

console.log('\n全部通过：' + n + ' 项');
