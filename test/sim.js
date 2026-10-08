const BB = require('../js/engine.js');
const Bot = require('../js/bot.js');
const M = require('../js/missions.js');
const assert = require('assert');
const missions = process.env.CATALOG === 'campaign' ? M.CAMPAIGN : M;
assert.strictEqual(missions.length, 66);
missions.forEach((m, i) => assert.strictEqual(m.id, i + 1));
let stats = {};
let errors = 0;
let stuck = 0;
let waiting = 0;
function nanoWaiting(G) { return BB.nano(G) && BB.nano(G).waiting && !G.pending && G.players.every((_, pi) => !BB.canAct(G, pi)); }
for (const m of missions) {
  for (const np of [2, 3, 4, 5]) {
    let wins = 0, N = +(process.env.N || 4);
    for (let g = 0; g < N; g++) {
      const seats = Array.from({ length: np }, (_, i) => ({ pid: 'p' + i, name: 'B' + i, bot: true }));
      const G = BB.createGame(m, seats);
      let steps = 0;
      while (G.phase !== 'won' && G.phase !== 'lost' && steps < 2000) {
        steps++;
        let acted = false;
        for (let p = 0; p < np; p++) {
          const a = Bot.decide(G, p);
          if (!a) continue;
          const err = BB.act(G, p, a);
          if (err) { errors++; if (errors < 10) console.log('ERR', m.id, np, JSON.stringify(a), err); }
          else acted = true;
          break;
        }
        if (!acted) { console.log(nanoWaiting(G) ? '合法等待' : 'STUCK', m.id, np, G.phase, G.turn); break; }
      }
      // round-trip pack/unpack
      if (G.phase !== 'won' && G.phase !== 'lost') { if (nanoWaiting(G)) waiting++; else stuck++; }
      const pub = BB.packPublic(G);
      const size = JSON.stringify(pub).length;
      if (size > 3800) console.log('BIG', m.id, np, size);
      BB.unpack(pub, BB.packHand(G, 0), 0);
      if (G.phase === 'won') wins++;
    }
    stats[m.id + '/' + np] = wins / N;
  }
}
const byTier = {};
for (const m of missions) {
  const avg = [2,3,4,5].reduce((s, n) => s + stats[m.id + '/' + n], 0) / 4;
  (byTier[m.tier] = byTier[m.tier] || []).push(m.id + ':' + Math.round(avg * 100));
}
console.log(byTier);
console.log('errors', errors);
console.log('stuck', stuck);
console.log('无合法动作等待', waiting);
if (errors || stuck) process.exitCode = 1;
