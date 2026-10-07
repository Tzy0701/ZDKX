const assert = require('assert');
const BB = require('../js/engine.js');
const M = require('../js/missions.js');

function rig() {
  const mission = Object.assign({}, M[7], { info: 'none', eq: 0, rules: {} });
  const G = BB.createGame(mission, [
    { pid: 'p0', name: '队长' },
    { pid: 'p1', name: '队友' }
  ]);
  G.wires = [];
  [[2, 3, 5, 6], [4, 6, 7, 8]].forEach((hand, owner) => hand.forEach((v) => {
    G.wires.push({ id: G.wires.length, v, o: owner, s: 0, cut: v === 6, info: null });
  }));
  G.players.forEach((p) => { p.stands = [[]]; });
  G.wires.forEach((w) => G.players[w.o].stands[0].push(w.id));
  G.ruleset = 'custom';
  delete G.cutFlow; // Legacy saved games resolve cuts immediately.
  G.phase = 'play';
  G.turn = 0;
  G.det = 0;
  G.detMax = 5;
  G.equip = [{ n: 6, used: false }];
  return G;
}

const G = rig();
const target = G.wires.find((w) => w.o === 1 && w.v === 7).id;
assert.strictEqual(BB.act(G, 0, { a: 'dual', w: target, val: 5 }), null);
assert.deepStrictEqual(G.declaration, {
  id: 1,
  from: 0,
  to: 1,
  ids: [target],
  vals: [5],
  label: '双人剪'
});

const publicView = BB.view(G, -1);
assert.deepStrictEqual(publicView.declaration, G.declaration);
assert.deepStrictEqual(Object.keys(publicView.declaration).sort(), ['from', 'id', 'ids', 'label', 'to', 'vals']);
assert.deepStrictEqual(publicView.declaration.ids, [target]);
assert.deepStrictEqual(publicView.declaration.vals, [5]);

const savedDeclaration = JSON.parse(JSON.stringify(G.declaration));
assert.match(BB.act(G, 1, { a: 'solo', val: 99 }), /持有|单人剪/);
assert.deepStrictEqual(G.declaration, savedDeclaration, 'rejected actions preserve the current declaration');

G.det = 1;
assert.strictEqual(BB.act(G, 1, { a: 'equip', n: 6 }), null);
assert.strictEqual(G.declaration, null, 'the next accepted action clears the declaration');
assert.strictEqual(BB.view(G, 0).declaration, null);

console.log('✓ custom cut declarations expose only declared public metadata, survive rejected actions, then clear');
