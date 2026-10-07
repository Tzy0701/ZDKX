const assert = require('assert');
const BB = require('../js/engine');
const Bot = require('../js/bot');
const M = require('../js/missions');

const seats = n => Array.from({ length: n }, (_, i) => ({ pid: `p${i}`, name: `P${i}` }));
function rig(hands, equipment = []) {
  const mission = { ...M.get('physical', 8), info: 'none', eq: 0, rules: {} };
  const G = BB.createGame(mission, seats(hands.length), { rng: () => 0.4 });
  G.wires = [];
  G.players.forEach(p => { p.stands = [[]]; p.dd = 1; });
  hands.forEach((hand, o) => hand.forEach(v => {
    const id = G.wires.length;
    G.wires.push({ id, v, o, s: 0, cut: false, info: null });
    G.players[o].stands[0].push(id);
  }));
  G.players.forEach(p => p.stands[0].sort((a, b) => G.wires[a].v - G.wires[b].v));
  G.equip = equipment.map(n => ({ n, used: false }));
  G.phase = 'play'; G.turn = 0; G.det = 0;
  return G;
}
const id = (G, o, v, ordinal = 0) => G.wires.filter(w => w.o === o && w.v === v && !w.cut)[ordinal].id;
function resolve(G, pi, w) { return BB.act(G, pi, { a: 'resolve', id: G.pending.id, w }); }
function test(name, fn) { fn(); console.log('✓', name); }

test('verified catalog and setup for 2–5 players', () => {
  assert.deepStrictEqual(M.PHYSICAL.map(m => m.id), [1, 2, 3, 4, 5, 6, 7, 8, 13, 15, 17, 18, 21, 23, 24, 25, 26, 29, 31, 33, 38, 39, 41, 43]);
  assert.strictEqual(M.get('physical', 9), null);
  assert.strictEqual(M.get('custom', 66).id, 66);
  const audit = require('../docs/mission-audit.json');
  assert.deepStrictEqual(audit.missions.map(m => m.id), Array.from({ length: 66 }, (_, i) => i + 1));
  assert.deepStrictEqual(audit.missions.filter(m => m.completeVerification).map(m => m.id), M.PHYSICAL.map(m => m.id));
  assert(M.OFFICIAL.every(m => m.cardReviewed && m.source));
  [34, 65].forEach(mid => assert.deepStrictEqual(M.OFFICIAL[mid - 1].supportedPlayers, [3, 4, 5]));
  for (const m of M.PHYSICAL) for (const n of [2, 3, 4, 5]) {
    const G = BB.createGame(m, seats(n), { rng: () => 0.4, captain: 1 });
    assert.strictEqual(G.ruleset, 'physical');
    assert.strictEqual(G.detMax, m.id === 41 ? 1 : n);
    assert.strictEqual(G.infoN, m.id === 18 ? 0 : 1);
    assert.strictEqual(G.captain, m.id === 17 ? BB.liar(G) : 1);
    assert(G.players.every((p, pi) => p.dd === (m.id === 17 && pi === BB.liar(G) ? 0 : 1)));
    assert.strictEqual(G.wires.filter(w => BB.kindOf(w.v) === 'b').length, (m.blue[1] - m.blue[0] + 1) * 4);
    for (let v = m.blue[0]; v <= m.blue[1]; v++) assert.strictEqual(G.wires.filter(w => w.v === v).length, 4);
    assert(G.wires.every(w => w.v >= m.blue[0] && w.v <= m.blue[1]));
    const y = m.id === 41 ? Math.min(n,4) : n === 2 && m.two && m.two.y ? m.two.y[0] : m.y[0];
    const r = n === 2 && m.two && m.two.r ? m.two.r[0] : m.r[0];
    assert.strictEqual(G.wires.filter(w => BB.kindOf(w.v) === 'y').length, y);
    assert.strictEqual(G.wires.filter(w => BB.kindOf(w.v) === 'r').length, r);
    const expectedRacks = n === 2 ? 4 : n === 3 ? 4 : n;
    const racks = G.players.flatMap((p, pi) => {
      assert.strictEqual(p.stands.length, n === 2 || (n === 3 && pi === G.captain) ? 2 : 1);
      return p.stands.map((stand, si) => {
        const values = stand.map(id => {
          assert.strictEqual(G.wires[id].o, pi);
          assert.strictEqual(G.wires[id].s, si);
          return G.wires[id].v;
        });
        var ordinary = stand.filter(id => !BB.isOutward(G, G.wires[id])).map(id => G.wires[id].v);
        assert(ordinary.every((v, i) => i === 0 || ordinary[i - 1] <= v));
        return stand;
      });
    });
    assert.strictEqual(racks.length, expectedRacks);
    const reserve = BB.nano(G) ? BB.nano(G).reserve : [];
    assert.strictEqual(racks.flat().length + reserve.length, G.wires.length);
    assert.strictEqual(new Set(racks.flat().concat(reserve)).size, G.wires.length);
    assert(reserve.every(id => G.wires[id].o === -1 && G.wires[id].s === -1));
    assert(Math.max(...racks.map(x => x.length)) - Math.min(...racks.map(x => x.length)) <= 1);
    assert.strictEqual(G.equip.length, m.id === 18 ? 1 : m.eq === -1 ? n : m.eq);
    if (m.id === 18) assert.deepStrictEqual(G.equip.map(e => e.n), [8]);
    if (m.id === 3) assert(G.equip.every(e => e.n <= 10), 'mission 3 excludes equipment 11 and 12');
  }
});

test('setup follows captain order', () => {
  const G = BB.createGame(M.PHYSICAL[0], seats(3), { captain: 1, rng: () => 0.3 });
  const wire = pi => G.wires.find(w => w.o === pi && BB.kindOf(w.v) === 'b' && !w.info).id;
  assert.match(BB.act(G, 0, { a: 'info', w: wire(0) }), /顺序/);
  assert.strictEqual(BB.act(G, 1, { a: 'info', w: wire(1) }), null);
  assert.strictEqual(BB.act(G, 2, { a: 'info', w: wire(2) }), null);
  assert.strictEqual(BB.act(G, 0, { a: 'info', w: wire(0) }), null);
  assert.strictEqual(G.phase, 'play');
  assert.strictEqual(G.turn, 1);
});

test('reviewed training cards keep their distinct yellow/red setup and yellow solo rules', () => {
  const setup = mid => BB.createGame(M.get('physical', mid), seats(3), { rng: () => 0.4 });
  assert.deepStrictEqual(setup(2).ymark.n, 2);
  assert(setup(2).ymark.cand.every(v => v >= 1.1 && v <= 7.1));
  assert(setup(3).rmark.cand.every(v => v >= 1.5 && v <= 9.5));
  assert.strictEqual(setup(7).ymark.n, 0);
  assert.strictEqual(setup(7).rmark.cand.length, 2);
  const four = rig([[1.1, 3.1, 5.1, 7.1, 8], [8]]);
  assert.strictEqual(BB.act(four, 0, { a: 'solo', val: 'Y' }), null);
  assert.strictEqual(four.wires.filter(w => BB.kindOf(w.v) === 'y' && w.cut).length, 4);
  const two = rig([[1.1, 3.1, 8], [5.1, 7.1, 8]]);
  assert(BB.act(two, 0, { a: 'solo', val: 'Y' }), 'two yellow wires cannot solo while the other pair is uncut');
  two.wires.filter(w => w.o === 1 && BB.kindOf(w.v) === 'y').forEach(w => { w.cut = true; });
  assert.strictEqual(BB.act(two, 0, { a: 'solo', val: 'Y' }), null);
});

test('standalone X/Y accepts yellow, while detector combinations still require blue values', () => {
  const G = rig([[3, 1.1, 10, 10], [5, 6.1]], [10]);
  G.wires.filter(w => w.v === 10).forEach(w => { w.cut = true; });
  const target = id(G, 1, 6.1), own = id(G, 0, 1.1);
  assert.strictEqual(BB.act(G, 0, { a: 'dual', w: target, val: 3, vals: [3, 'Y'], xy: true }), null);
  assert.strictEqual(resolve(G, 1, target), null);
  assert.strictEqual(resolve(G, 0, own), null);
  assert(G.wires[own].cut && G.wires[target].cut && G.equip[0].used);
  const H = rig([[3, 1.1, 10, 10], [5, 6.1]], [10]);
  H.wires.filter(w => w.v === 10).forEach(w => { w.cut = true; });
  const before = JSON.stringify(H);
  assert.match(BB.act(H, 0, { a: 'dd', ws: H.players[1].stands[0], val: 3, vals: [3, 'Y'], xy: true }), /蓝色/);
  assert.strictEqual(JSON.stringify(H), before);
});

test('dual cut waits for target and actor choices; privacy and stale replies', () => {
  const G = rig([[3, 3, 5], [3, 3, 7]], [3]);
  assert.strictEqual(BB.act(G, 0, { a: 'dual', w: id(G, 1, 3), val: 3 }), null);
  assert.strictEqual(G.wires.filter(w => w.cut).length, 0);
  assert.strictEqual(BB.packPublic(G).pending.choices, undefined);
  assert.deepStrictEqual(BB.packChoice(G, 1).choices, [id(G, 1, 3)]);
  const first = G.pending.id;
  assert.strictEqual(resolve(G, 1, id(G, 1, 3)), null);
  assert.strictEqual(G.pending.step, 'own');
  assert.strictEqual(BB.packChoice(G, 1).choices, undefined);
  assert.strictEqual(BB.packChoice(G, 0).choices.length, 2);
  assert.strictEqual(resolve(G, 0, id(G, 0, 3, 1)), null);
  assert.strictEqual(G.wires.filter(w => w.cut).length, 2);
  assert(BB.equipUnlocked(G, 3));
  assert(G.players.every(p => p.dd === 1));
  assert.match(BB.act(G, 1, { a: 'resolve', id: first, w: id(G, 1, 3) }), /失效/);
});

test('physical cut declaration and outcome are public, then expire on the next accepted action', () => {
  const G = rig([[3, 3, 5], [3, 3, 5], [5, 8]], [3]);
  const target = id(G, 1, 3);
  assert.strictEqual(BB.act(G, 0, { a: 'dual', w: target, val: 3 }), null);
  const views = [-1, 0, 1, 2].map(pi => BB.view(G, pi));
  assert(views.every(view => view.declaration === null));
  assert.strictEqual(views[0].pending.to, 1);
  assert.deepStrictEqual(BB.packChoice(G, 1).choices, [target]);
  assert.strictEqual(resolve(G, 1, target), null);
  assert.strictEqual(G.pending.step, 'own');
  assert.strictEqual(BB.view(G, 2).pending.hitVal, 3, 'the public pending state confirms the declared match');
  assert.strictEqual(resolve(G, 0, id(G, 0, 3, 1)), null);

  const expected = {
    id: G.actionId, from: 0, to: 1, ids: [target], vals: [3], label: '双人拆线',
    result: { matched: true, wire: target }
  };
  [-1, 0, 1, 2].forEach(pi => assert.deepStrictEqual(BB.view(G, pi).declaration, expected));
  assert.deepStrictEqual(BB.packPublic(G).declaration, expected);
  assert.strictEqual(BB.view(G, 2).players[1].stands[0].find(w => w.id === target).v, 3);

  const rejected = BB.act(G, 1, { a: 'dual', w: target, val: 5 });
  assert(rejected);
  assert.deepStrictEqual(G.declaration, expected, 'rejected actions preserve the result');
  assert.strictEqual(BB.act(G, 1, { a: 'dual', w: id(G, 2, 5), val: 5 }), null);
  assert.strictEqual(G.declaration, null, 'the next accepted action clears the result');
});

test('physical miss result publishes no hidden target values or alternatives', () => {
  const G = rig([[3, 3, 5], [9, 7], [8]], []);
  const target = id(G, 1, 9);
  assert.strictEqual(BB.act(G, 0, { a: 'dual', w: target, val: 3 }), null);
  assert.strictEqual(resolve(G, 1, target), null);
  assert.strictEqual(G.pending, null);
  const expected = {
    id: G.actionId, from: 0, to: 1, ids: [target], vals: [3], label: '双人拆线',
    result: { matched: false, wire: null }
  };
  [-1, 0, 1, 2].forEach(pi => assert.deepStrictEqual(BB.view(G, pi).declaration, expected));
  assert.strictEqual(Object.prototype.hasOwnProperty.call(expected.result, 'value'), false);
  assert.strictEqual(Object.prototype.hasOwnProperty.call(expected.result, 'matches'), false);
  assert.strictEqual(BB.view(G, 0).players[1].stands[0].find(w => w.id === target).v, null);
});

test('triple detector uses two on a two wire rack, then is spent', () => {
  const G = rig([[3, 3, 9], [9, 11]], [3]);
  G.wires.filter(w => w.v === 3).forEach(w => { w.cut = true; });
  const ws = G.players[1].stands[0].slice();
  assert.strictEqual(BB.act(G, 0, { a: 'equip', n: 3, ws, val: 9 }), null);
  assert.strictEqual(G.pending.type, 'cut');
  assert(G.equip[0].used);
  assert.strictEqual(resolve(G, 1, id(G, 1, 9)), null);
  assert.strictEqual(resolve(G, 0, id(G, 0, 9)), null);
  assert(G.players[0].dd);
});

test('two cut 3s unlock a shared Triple Detector independently of character cards', () => {
  const G = rig([[3, 9], [3, 7, 9]], [3]);
  assert(!BB.equipUnlocked(G, 3));
  assert.strictEqual(BB.act(G, 0, { a: 'dual', w: id(G, 1, 3), val: 3 }), null);
  assert.strictEqual(resolve(G, 1, id(G, 1, 3)), null);
  assert.strictEqual(resolve(G, 0, id(G, 0, 3)), null);
  assert(BB.equipUnlocked(G, 3));
  assert(!G.equip[0].used);
  G.turn = 0;
  const targets = [id(G, 1, 7), id(G, 1, 9)];
  assert.strictEqual(BB.act(G, 0, { a: 'equip', n: 3, ws: targets, val: 9 }), null);
  assert.deepStrictEqual(BB.packChoice(G, 1).choices, [id(G, 1, 9)]);
  assert.strictEqual(resolve(G, 1, id(G, 1, 9)), null);
  assert.strictEqual(resolve(G, 0, id(G, 0, 9)), null);
  assert(G.equip[0].used);
  assert(G.players.every(p => p.dd === 1));
});

test('solo cut requires two or four; reds need their own reveal turns', () => {
  const G = rig([[5, 7.5], [5]]);
  assert.strictEqual(BB.act(G, 0, { a: 'dual', w: id(G, 1, 5), val: 5 }), null);
  resolve(G, 1, id(G, 1, 5)); resolve(G, 0, id(G, 0, 5));
  assert.strictEqual(G.phase, 'play');
  assert.strictEqual(G.turn, 0);
  assert.strictEqual(BB.act(G, 0, { a: 'red' }), null);
  assert.strictEqual(G.phase, 'won');
  const H = rig([[4, 7], [7]]);
  assert.match(BB.act(H, 0, { a: 'solo', val: 4 }), /所有剩余/);
  const J = rig([[4, 4, 7], [7]]);
  assert.strictEqual(BB.act(J, 0, { a: 'solo', val: 4 }), null);
});

test('Nth mistake loses at the player count', () => {
  const G = rig([[3, 3], [7, 8]]);
  assert.strictEqual(BB.act(G, 0, { a: 'dual', w: id(G, 1, 7), val: 3 }), null);
  resolve(G, 1, id(G, 1, 7));
  assert.strictEqual(G.det, 1);
  G.turn = 0;
  BB.act(G, 0, { a: 'dual', w: id(G, 1, 8), val: 3 });
  resolve(G, 1, id(G, 1, 8));
  assert.strictEqual(G.phase, 'lost');
});

test('off turn Walkie Talkies retain markers', () => {
  const G = rig([[2, 2, 5], [2, 2, 9]], [2]);
  G.wires.filter(w => w.v === 2).slice(0, 2).forEach(w => { w.cut = true; });
  const five = id(G, 0, 5), nine = id(G, 1, 9);
  G.wires[five].info = { t: 'v', v: 5 };
  G.turn = 1;
  assert.strictEqual(BB.act(G, 0, { a: 'equip', n: 2, w: five, p: 1 }), null);
  assert.match(BB.act(G, 1, { a: 'walkie', id: G.pending.id - 1, w: nine }), /失效/);
  assert.strictEqual(BB.act(G, 1, { a: 'walkie', id: G.pending.id, w: nine }), null);
  assert.deepStrictEqual(G.wires[five].info, { t: 'v', v: 5 });
  assert.strictEqual(G.wires[five].o, 1);
});

test('Battery selections and Radar answers per rack', () => {
  const G = rig([[7, 7, 8, 8], [7, 7, 8, 8]], [7, 8]);
  G.wires.filter(w => w.v === 7).slice(0, 2).forEach(w => { w.cut = true; });
  G.wires.filter(w => w.v === 8).slice(0, 2).forEach(w => { w.cut = true; });
  G.players.forEach(p => { p.dd = 0; });
  assert.match(BB.act(G, 0, { a: 'equip', n: 7 }), /选择/);
  assert.strictEqual(BB.act(G, 0, { a: 'equip', n: 7, players: [1] }), null);
  assert.strictEqual(G.players[0].dd, 0);
  assert.strictEqual(G.players[1].dd, 1);
  assert.strictEqual(BB.act(G, 0, { a: 'equip', n: 8, val: 8 }), null);
  assert.deepStrictEqual(G.radar.res, [[false], [true]]);
  assert.match(BB.act(G, 0, { a: 'equip', n: 8, val: 'Y' }), /用过/);
});

test('X/Y plus Double Detector and Stabilizer consume their own cards', () => {
  const G = rig([[10, 10, 3, 5], [3, 7, 8]], [10, 9]);
  G.wires.filter(w => w.v === 10).forEach(w => { w.cut = true; });
  G.wires.filter(w => w.v === 9).forEach(w => { w.cut = true; });
  // Unlock Stabilizer explicitly; the rig does not need a full printed deck.
  G.wires.push({ id: G.wires.length, v: 9, o: 0, s: 0, cut: true, info: null });
  G.wires.push({ id: G.wires.length, v: 9, o: 1, s: 0, cut: true, info: null });
  const targets = [id(G, 1, 3), id(G, 1, 7)];
  assert.strictEqual(BB.act(G, 0, { a: 'dd', ws: targets, val: 3, vals: [3, 5], xy: true, stab: true }), null);
  assert(G.players[0].dd === 0);
  assert(G.equip.every(e => e.used));
  assert.strictEqual(resolve(G, 1, id(G, 1, 3)), null);
  assert.strictEqual(resolve(G, 0, id(G, 0, 3)), null);
});

test('Stabilizer protects a mistaken red target and no clue is placed', () => {
  const G = rig([[9, 9, 5], [7.5]], [9]);
  G.wires.filter(w => w.v === 9).forEach(w => { w.cut = true; });
  assert.strictEqual(BB.act(G, 0, { a: 'dual', w: id(G, 1, 7.5), val: 5, stab: true }), null);
  assert.strictEqual(resolve(G, 1, null), null);
  assert.strictEqual(G.phase, 'play');
  assert.strictEqual(G.det, 0);
  assert.strictEqual(G.wires.find(w => w.v === 7.5).info, null);
});

test('clue supply gives a temporary announcement after two same value markers', () => {
  const G = rig([[3, 3, 3], [3, 5]]);
  G.wires.filter(w => w.v === 3).slice(0, 2).forEach(w => { w.info = { t: 'v', v: 3 }; });
  // A physical mission begins with one clue per player, so the same number
  // can exhaust both printed tokens before another placement.
  G.phase = 'setup'; G.setup = { 0: 0, 1: 0 }; G.infoN = 1; G.captain = 0;
  const third = G.wires.filter(w => w.v === 3)[2];
  assert.strictEqual(BB.act(G, 0, { a: 'info', w: third.id }), null);
  assert.strictEqual(third.info, null);
  assert.deepStrictEqual(G.announcement, { id: third.id, info: { t: 'v', v: 3 } });
});

test('saved pending choice survives JSON restore without public hand leakage', () => {
  const G = rig([[5, 5], [5, 7]]);
  BB.act(G, 0, { a: 'dual', w: id(G, 1, 5), val: 5 });
  const restored = JSON.parse(JSON.stringify(G));
  const pub = BB.packPublic(restored);
  assert.strictEqual(pub.pending.choices, undefined);
  const view = BB.unpack(pub, BB.packHand(restored, 1), 1, BB.packChoice(restored, 1));
  assert.strictEqual(view.pending.choices.length, 1);
  assert.strictEqual(resolve(restored, 1, id(restored, 1, 5)), null);
  assert.strictEqual(resolve(restored, 0, id(restored, 0, 5)), null);
  assert.strictEqual(restored.wires.filter(w => w.cut).length, 2);
});

test('Radar reports separate answers for two racks', () => {
  const G = rig([[8, 8, 8, 3], [8, 5]], [8]);
  const ownEights = G.wires.filter(w => w.o === 0 && w.v === 8);
  ownEights.slice(0, 2).forEach(w => { w.cut = true; });
  const moved = ownEights[2];
  G.players[0].stands[0] = G.players[0].stands[0].filter(id => id !== moved.id);
  G.players[0].stands[1] = [moved.id]; moved.s = 1;
  assert.strictEqual(BB.act(G, 0, { a: 'equip', n: 8, val: 8 }), null);
  assert.deepStrictEqual(G.radar.res, [[false, true], [true]]);
});

test('labels compare playable colors, not printed sorting decimals', () => {
  const G = rig([[1.1, 2.1, 3], [4]], [1, 12]);
  G.wires.push({ id: G.wires.length, v: 1, o: 0, s: 0, cut: true, info: null });
  G.wires.push({ id: G.wires.length, v: 1, o: 1, s: 0, cut: true, info: null });
  G.wires.push({ id: G.wires.length, v: 12, o: 0, s: 0, cut: true, info: null });
  G.wires.push({ id: G.wires.length, v: 12, o: 1, s: 0, cut: true, info: null });
  const first = id(G, 0, 1.1), second = id(G, 0, 2.1);
  assert.match(BB.act(G, 0, { a: 'equip', n: 1, w1: first, w2: second }), /相同/);
  assert.strictEqual(BB.act(G, 0, { a: 'equip', n: 12, w1: first, w2: second }), null);
});

test('rejected action cannot erase a spoken clue or change game state', () => {
  const G = rig([[3, 3], [5]]);
  G.announcement = { id: 2, info: { t: 'v', v: 5 } };
  const before = JSON.stringify(G);
  assert.match(BB.act(G, 1, { a: 'solo', val: 99 }), /轮到/);
  assert.strictEqual(JSON.stringify(G), before);
});

test('chosen detector target is public during own-wire resolution', () => {
  const G = rig([[3, 3], [3, 3]]);
  assert.strictEqual(BB.act(G, 0, { a: 'dd', ws: [id(G, 1, 3), id(G, 1, 3, 1)], val: 3 }), null);
  assert.strictEqual(resolve(G, 1, id(G, 1, 3, 1)), null);
  const view = BB.packPublic(G).pending;
  assert.strictEqual(view.hit, id(G, 1, 3, 1));
  assert.strictEqual(view.hitVal, 3);
  assert.strictEqual(view.choices, undefined);
});

test('physical bot inference ignores the real hidden deal', () => {
  let G, H;
  for (let seed = 1; seed < 40 && !H; seed++) {
    let state = seed;
    G = BB.createGame(M.PHYSICAL[0], seats(3), { rng: () => ((state = (state * 1664525 + 1013904223) >>> 0) / 4294967296) });
    const candidates = G.wires.filter(w => w.o !== 0);
    for (const a of candidates) {
      if (H) break;
      for (const b of candidates) {
        if (a.o === b.o || a.v === b.v) continue;
        const copy = JSON.parse(JSON.stringify(G));
        [copy.wires[a.id].v, copy.wires[b.id].v] = [copy.wires[b.id].v, copy.wires[a.id].v];
        const ordered = copy.players.every(p => p.stands.every(st => st.every((id, i) => !i || copy.wires[st[i - 1]].v <= copy.wires[id].v)));
        if (ordered) { H = copy; break; }
      }
    }
  }
  assert(H, 'could not make two distinct legal hidden deals');
  assert.deepStrictEqual(BB.view(G, 0), BB.view(H, 0));
  const originalRandom = Math.random;
  function run(game) {
    let state = 35;
    Math.random = () => ((state = (state * 1664525 + 1013904223) >>> 0) / 4294967296);
    return Bot.infer(game, 0, 900);
  }
  try { assert.deepStrictEqual(run(G), run(H)); }
  finally { Math.random = originalRandom; }
});

console.log('Physical rules tests passed');
