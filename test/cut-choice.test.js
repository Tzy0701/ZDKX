const assert = require('assert');
const BB = require('../js/engine');
const Missions = require('../js/missions');
function rig(hands, equipment = []) {
  // Explicit legacy rules fixture: campaign mission 2 now uses physical rules.
  const G = BB.createGame(Object.assign({}, Missions.get('custom', 2), { info: 'none', dd: true, rules: {} }), hands.map((_, i) => ({ pid: 'p' + i, name: 'P' + i })));
  G.wires = [];
  hands.forEach((hand, o) => hand.forEach(v => G.wires.push({ id: G.wires.length, v, o, s: 0, cut: false, info: null })));
  G.players.forEach(p => { p.stands = [[]]; });
  G.wires.forEach(w => G.players[w.o].stands[0].push(w.id));
  G.equip = equipment.map(n => ({ n, used: false }));
  G.phase = 'play'; G.turn = 0; G.detMax = 5;
  return G;
}
function accept(G, pi, action) { assert.strictEqual(BB.act(G, pi, action), null); }

for (const mission of Missions.CAMPAIGN) {
  const G = BB.createGame(mission, [{ pid: 'a', name: 'A' }, { pid: 'b', name: 'B' }]);
  assert(BB.usesCutChoices(G), 'mission ' + mission.id + ' must offer player choices');
}
let G = rig([[1, 1, 4], [1, 1, 5], [2, 6]]);
accept(G, 0, { a: 'dual', w: 3, val: 1 });
assert.strictEqual(G.wires.some(w => w.cut), false);
assert.strictEqual(G.turn, 0);
assert.deepStrictEqual(BB.view(G, 1).pending.choices, [3]);
assert(!('choices' in BB.view(G, 0).pending));
assert(!('choices' in BB.view(G, 2).pending));
const decision = G.pending.id;
const before = JSON.stringify(G);
assert(BB.act(G, 2, { a: 'resolve', id: decision, w: 3 }));
assert.strictEqual(JSON.stringify(G), before);
accept(G, 1, { a: 'resolve', id: decision, w: 3 });
assert.strictEqual(G.pending.step, 'own');
assert.strictEqual(BB.view(G, 2).pending.hitVal, 1);
assert.deepStrictEqual(BB.view(G, 0).pending.choices, [0, 1]);
G = JSON.parse(JSON.stringify(G)); // Reconnect/restart midway through the response.
accept(G, 0, { a: 'resolve', id: decision, w: 1 });
assert.strictEqual(G.wires[0].cut, false, 'first 1 must remain untouched');
assert.strictEqual(G.wires[1].cut, true, 'actor chose the second 1');
assert.strictEqual(G.wires[3].cut, true);
assert.strictEqual(G.wires[4].cut, false);
assert.strictEqual(G.turn, 1);
const finished = JSON.stringify(G);
assert(BB.act(G, 0, { a: 'resolve', id: decision, w: 0 }));
assert.strictEqual(JSON.stringify(G), finished, 'duplicate response must not cut again');

G = rig([[1, 4], [3, 5]]);
accept(G, 0, { a: 'dual', w: 2, val: 1 });
assert.strictEqual(G.det, 0);
accept(G, 1, { a: 'resolve', id: G.pending.id, w: 2 });
assert.strictEqual(G.det, 1);
assert.strictEqual(G.declaration.result.matched, false);
assert.deepStrictEqual(G.wires[2].info, { t: 'v', v: 3 });

G = rig([[1.1, 4], [7.1, 5]]);
accept(G, 0, { a: 'dual', w: 2, val: 'Y' });
accept(G, 1, { a: 'resolve', id: G.pending.id, w: 2 });
accept(G, 0, { a: 'resolve', id: G.pending.id, w: 0 });
assert(G.wires[0].cut && G.wires[2].cut);

G = rig([[1, 1, 4], [1, 1, 5]]);
accept(G, 0, { a: 'dd', ws: [3, 4], val: 1 });
assert.strictEqual(G.players[0].dd, 0);
accept(G, 1, { a: 'resolve', id: G.pending.id, w: 4 });
accept(G, 0, { a: 'resolve', id: G.pending.id, w: 1 });
assert.deepStrictEqual(G.wires.filter(w => w.cut).map(w => w.id), [1, 4]);

G = rig([[1, 3, 3], [1, 3]], [3]);
G.wires.push({ id: 5, v: 3, o: 0, s: 0, cut: true, info: null }, { id: 6, v: 3, o: 0, s: 0, cut: true, info: null });
G.players[0].stands[0].push(5, 6);
accept(G, 0, { a: 'equip', n: 3, ws: [3, 4], val: 3 });
assert(G.equip[0].used);
accept(G, 1, { a: 'resolve', id: G.pending.id, w: 4 });
accept(G, 0, { a: 'resolve', id: G.pending.id, w: 2 });
assert(G.wires[2].cut && !G.wires[1].cut);

G = rig([[5, 5, 2], [5, 5, 8]], [5]);
G.wires.push({ id: 6, v: 5, o: 0, s: 0, cut: true, info: null }, { id: 7, v: 5, o: 0, s: 0, cut: true, info: null });
G.players[0].stands[0].push(6, 7);
accept(G, 0, { a: 'equip', n: 5, p: 1, s: 0, val: 5 });
accept(G, 1, { a: 'resolve', id: G.pending.id, w: 4 });
accept(G, 0, { a: 'resolve', id: G.pending.id, w: 1 });
assert(G.equip[0].used && G.wires[1].cut && G.wires[4].cut);

G = rig([[1, 4, 4], [4, 8]], [10]);
G.wires.push({ id: 5, v: 10, o: 0, s: 0, cut: true, info: null }, { id: 6, v: 10, o: 0, s: 0, cut: true, info: null });
G.players[0].stands[0].push(5, 6);
accept(G, 0, { a: 'equip', n: 10, w: 3, vals: [1, 4] });
assert(G.equip[0].used);
accept(G, 1, { a: 'resolve', id: G.pending.id, w: 3 });
assert.strictEqual(G.pending.hitVal, 4);
accept(G, 0, { a: 'resolve', id: G.pending.id, w: 2 });
assert(G.wires[2].cut && !G.wires[1].cut);

G = rig([[1, 4], [1, 5]]);
delete G.cutFlow;
accept(G, 0, { a: 'dual', w: 2, val: 1 });
assert.strictEqual(G.pending, null, 'legacy save still has its original resolution');
assert(G.wires[0].cut && G.wires[2].cut);
console.log('✓ all 66 missions offer explicit target/own choices; second duplicate selection, misses, yellow, detectors, privacy, restart, stale replies and legacy saves');
