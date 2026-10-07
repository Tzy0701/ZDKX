// Deterministic, perfect-information reachability check for both 66-mission
// catalogs. This tests generated-deal reachability, not human difficulty or
// mission fidelity. Physical pending choices are resolved one player at a time.
const assert = require('assert');
const BB = require('../js/engine.js');
const Missions = require('../js/missions.js');

function rngFor(seed) {
  let state = seed >>> 0;
  return function () {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function playPerfectInformation(mission, playerCount, seed) {
  const rng = rngFor(seed);
  const seats = Array.from({ length: playerCount }, (_, p) => ({ pid: 'p' + p, name: 'P' + p }));
  const captain = mission.ruleset === 'physical' ? (seed - 1) % playerCount : 0;
  const game = BB.createGame(mission, seats, { rng, now: 1000, captain });
  const trace = [];
  let actions = 0;
  while (game.phase === 'constraints' || game.phase === 'setup' || game.phase === 'play') {
    if (++actions > 1000) return { result: 'action-limit', game, trace };
    let pi = BB.turnActor(game);
    let action = null;

    if (game.phase === 'constraints') {
      pi = game.turn; action = { a: 'constraint-select', id: game.officialState.constraints.decisionId, card: game.officialState.constraints.available[0] };
    } else if (game.phase === 'setup') {
      if (game.ruleset === 'physical') {
        pi = BB.setupActor(game);
      } else {
        pi = game.players.findIndex((_, p) => game.setup[p] < BB.setupNeed(game, p));
      }
      if (game.pending && game.pending.type === 'initial-clue') {
        const pd = BB.view(game, pi).pending;
        action = { a: 'initial-clue', id: pd.id, w: pd.choices.length ? pd.choices.at(-1) : null, rack: 0 };
      } else if (BB.liar(game) === pi) {
        const setup = BB.view(game, pi).official.fakeSetup;
        const wire = game.wires.find(w => w.o === pi && !w.cut && BB.kindOf(w) === 'b' && !w.info && !setup.usedIds.includes(w.id));
        if (wire) action = { a: 'info', id: setup.id, w: wire.id, val: wire.v === 1 ? 2 : 1 };
      } else {
        const wire = game.wires.find(w => w.o === pi && !w.cut && BB.setupInfoAllowed(game, w) && !w.info);
        if (wire) action = { a: 'info', w: wire.id };
      }
    } else if (game.pending && game.pending.type === 'secret-number') {
      pi = game.pending.to;
      const pd = BB.view(game, pi).pending;
      const hand = game.wires.filter(w => w.o === game.turn && !w.cut && BB.kindOf(w) === 'b');
      action = pd.step === 'choose' ? { a: 'secret-choose', id: pd.id, value: pd.choices.find(value => hand.some(w => w.v !== value)) ?? pd.choices[0] } : { a: 'secret-reveal', id: pd.id };
    } else if (game.pending && game.pending.type === 'equipment-reveal') {
      pi = game.pending.to;
      action = { a: 'equipment-reveal', id: game.pending.id, slot: BB.view(game, pi).pending.slots[0] ?? null };
    } else if (game.pending && game.pending.type === 'radar') {
      pi = game.pending.to;
      const choice = BB.view(game, pi).pending;
      action = { a: 'radar-reply', id: choice.id, answers: choice.ownAnswers };
    } else if (game.pending && game.pending.type === 'precision-clue') {
      pi = game.pending.to; action = { a: 'precision-clue', id: game.pending.id, w: BB.view(game, pi).pending.choices.at(-1) };
    } else if (game.pending && game.pending.type === 'nano-rack') {
      pi = game.pending.to; action = { a: 'nano-rack', id: game.pending.id, rack: actions % game.players[pi].stands.length };
    } else if (game.pending && game.pending.type === 'tripwire-cut') {
      pi = game.pending.to; action = { a: 'tripwire-reply', id: game.pending.id };
    } else if (game.pending && game.pending.type === 'precision-cut') {
      pi = game.pending.to; action = { a: 'precision-reply', id: game.pending.id };
    } else if (game.pending && game.pending.type === 'risky-cut') {
      pi = game.pending.to; action = { a: 'risky-reply', id: game.pending.id };
    } else if (game.pending && game.pending.type === 'cut') {
      pi = game.pending.to;
      const pd = game.pending;
      if (pd.step === 'target') {
        const matching = pd.ids.filter(id => pd.vals.some(v => BB.matches(game.wires[id].v, v)));
        if (matching.length) action = { a: 'resolve', id: pd.id, w: matching[0] };
        else {
          const safe = pd.ids.filter(id => BB.kindOf(game.wires[id].v) !== 'r');
          action = { a: 'resolve', id: pd.id, w: safe.length ? safe[0] : null };
        }
      } else if (pd.step === 'own') {
        const own = pd.outwardOwn != null ? game.wires[pd.outwardOwn] : game.wires.find(w => w.o === pi && !w.cut && BB.matches(w.v, pd.hitVal));
        if (own) action = { a: 'resolve', id: pd.id, w: own.id };
      }
    } else if (game.pending) {
      return { result: 'unexpected-pending-' + game.pending.type, game, trace };
    } else if (game.officialState && game.officialState.module === 'radar-command' && ['draw', 'radar', 'choose'].includes(game.officialState.command.step)) {
      pi = game.turn;
      const command = BB.view(game, pi).official.radarCommand;
      if (command.step === 'draw') action = { a: 'number-draw', id: command.decisionId };
      else if (command.step === 'radar') action = { a: 'radar-query', id: command.decisionId };
      else action = { a: 'command-select', id: command.decisionId, p: command.answers.findIndex(answer => answer.some(Boolean)) };
    } else {
      if (BB.tripwire(game)) { const yellow = game.wires.find(w => w.o !== pi && !w.cut && BB.kindOf(w) === 'y'); if (yellow) action = { a: 'tripwire-cut', w: yellow.id }; }
      if (game.officialState && game.officialState.precision && !game.officialState.precision.complete) action = { a: 'precision-cut', ws: game.wires.filter(w => w.v === game.officialState.precision.value).map(w => w.id) };
      if (BB.outwardSkipAllowed(game, pi)) action = { a: 'outward-skip' };
      const outward = game.wires.find(w => BB.isOutward(game, w) && !w.cut);
      if (!action && outward && pi === game.captain) {
        if (BB.kindOf(outward) === 'r' && BB.outwardRedPossible(game)) action = { a: 'outward-red' };
        else if (BB.kindOf(outward) === 'b') {
          if (BB.outwardSoloValues(game).includes(outward.v)) action = { a: 'outward-solo', val: outward.v };
          else { const target = game.wires.find(w => w.o !== pi && !w.cut && !BB.isOutward(game, w) && w.v === outward.v); if (target) action = { a: 'outward-dual', w: target.id, val: outward.v }; }
        }
      }
      const remaining = game.wires.filter(w => w.o === pi && !w.cut);
      if (!action && remaining.length && remaining.every(w => BB.kindOf(w.v) === 'r')) action = game.officialState && game.officialState.module === 'risky-red-cut' ? { a: 'risky-cut', ws: game.wires.filter(w => !w.cut && BB.kindOf(w) === 'r').map(w => w.id) } : { a: 'red' };
      const avoided = game.officialState && game.officialState.secretNumbers && game.officialState.secretNumbers.chosen && game.officialState.secretNumbers.chosen.value;
      const nano = BB.nano(game);
      const values = [...new Set(remaining.map(w => BB.annOf(w.v)))].sort((a, b) => nano && nano.reserve.length ? Number(b === nano.position) - Number(a === nano.position) : Number(a === avoided) - Number(b === avoided));
      for (const value of values) {
        if (action) break;
        if (value === 'R' || !BB.seqAllowed(game, value)) continue;
        if (BB.soloOk(game, pi, value)) {
          action = { a: 'solo', val: value };
          break;
        }
        const target = game.wires.find(w => w.o !== pi && !w.cut && BB.targetAllowed(game, pi, w) && BB.matches(w.v, value));
        if (target) {
          action = { a: 'dual', w: target.id, val: value };
          break;
        }
      }
      if (!action && !game.players.some((_, p) => BB.canAct(game, p))) {
        return { result: 'no-legal-action', game, trace };
      }
    }

    if (!action) return { result: 'no-action', game, trace };
    const err = BB.act(game, pi, action, { rng });
    trace.push({ p: pi, action, err: err || null, det: game.det, phase: game.phase });
    if (err) return { result: 'rejected-action', game, trace };
  }
  return { result: game.phase, game, trace };
}

assert.strictEqual(Missions.length, 66, 'expected 66 legacy missions');
assert.strictEqual(Missions.CAMPAIGN.length, 66, 'expected 66 unified campaign missions');
const failures = [];
const summaries = [];
for (const [catalog, missions] of [['legacy', Missions], ['campaign', Missions.CAMPAIGN]]) {
  let games = 0;
  let totalActions = 0;
  for (const mission of missions) {
    for (const playerCount of [2, 3, 4, 5]) {
      for (let seed = 1; seed <= 25; seed++) {
        games++;
        const result = playPerfectInformation(mission, playerCount, seed);
        totalActions += result.trace.length;
        if (result.result !== 'won') {
          failures.push({ catalog, mission: mission.id, players: playerCount, seed, result: result.result,
            phase: result.game.phase, turn: result.game.turn, det: result.game.det,
            detMax: result.game.detMax, turnNo: result.game.turnNo,
            pending: result.game.pending && { type: result.game.pending.type, step: result.game.pending.step },
            lastActions: result.trace.slice(-8) });
        }
      }
    }
  }
  summaries.push({ catalog, missionCount: missions.length, physicalRules: missions.filter(m => m.ruleset === 'physical').length,
    playerCounts: [2, 3, 4, 5], seedsPerSetup: 25, games, totalActions });
}

console.log(JSON.stringify({ summaries, failures }, null, 2));
if (failures.length) process.exitCode = 1;
