/* 炸弹克星 · AI 队友：只使用该玩家能看到的信息做概率推理 */
(function () {
  var BB = typeof module !== 'undefined' && module.exports ? require('./engine.js') : window.BB;
  var Bot = {};

  // 蒙特卡洛推理：在所有与公开信息一致的摆法中随机游走采样，
  // 估计每根未知线是各个宣告值（以及红线）的概率。
  // 只交换/替换“对该玩家未知”的线，候选黄/红线也会互相替换，不偷看真相。
  function infer(G, pi, iters) {
    var R = G.mission.rules || {};
    var val = {}, gapOf = {}, gaps = [], hidden = [];
    G.players.forEach(function (p, o) {
      if (o === pi) return;
      p.stands.forEach(function (st) {
        var cur = null, lastKnown = -Infinity;
        st.forEach(function (id) {
          var w = G.wires[id];
          val[id] = w.v;
          var known = w.cut || (w.info && w.info.t === 'v');
          if (known) {
            if (cur) { cur.hi = w.v; cur = null; }
            lastKnown = w.v;
          } else {
            if (!cur) { cur = { lo: lastKnown, hi: Infinity, ids: [] }; gaps.push(cur); }
            cur.ids.push(id); gapOf[id] = cur; hidden.push(id);
          }
        });
      });
    });
    var lab = {};
    G.labels.forEach(function (l) { (lab[l.a] = lab[l.a] || []).push(l); (lab[l.b] = lab[l.b] || []).push(l); });
    function slotOk(id) {
      var v = val[id], f = G.wires[id].info, k = BB.kindOf(v);
      if (f) {
        if (f.t === 'Y' && k !== 'y') return false;
        if ((f.t === 'odd' || f.t === 'even') && (k !== 'b' || (v % 2 === 0) !== (f.t === 'even'))) return false;
        if (f.t === 'not' && String(f.v).split('/').indexOf(String(BB.annOf(v))) >= 0) return false;
      }
      var ls = lab[id];
      if (ls) for (var j = 0; j < ls.length; j++) {
        var same = BB.annOf(val[ls[j].a]) === BB.annOf(val[ls[j].b]);
        if ((ls[j].t === 'eq') !== same) return false;
      }
      return true;
    }
    // 重新排序一个空档内的值，并检查是否合法
    function settle(g) {
      var vs = g.ids.map(function (id) { return val[id]; }).sort(function (a, b) { return a - b; });
      if (vs[0] < g.lo || vs[vs.length - 1] > g.hi) return false;
      g.ids.forEach(function (id, i) { val[id] = vs[i]; });
      for (var i = 0; i < g.ids.length; i++) if (!slotOk(g.ids[i])) return false;
      return true;
    }
    function snap(g) { return g.ids.map(function (id) { return val[id]; }); }
    function restore(g, s) { g.ids.forEach(function (id, i) { val[id] = s[i]; }); }
    function cands(mark, frac) {
      var c = mark.cand.slice();
      if (R.hide || !c.length) { c = []; for (var d = 1; d <= 11; d++) c.push(d + frac); }
      return c;
    }
    var alt = { y: cands(G.ymark, 0.1), r: cands(G.rmark, 0.5) };
    var fixedVals = G.wires.filter(function (w) { return hidden.indexOf(w.id) < 0; }).map(function (w) { return w.v; });
    function inUse(v) {
      for (var i = 0; i < fixedVals.length; i++) if (Math.abs(fixedVals[i] - v) < 1e-6) return true;
      for (var j = 0; j < hidden.length; j++) if (Math.abs(val[hidden[j]] - v) < 1e-6) return true;
      return false;
    }
    var cnt = {}, red = {}, n = 0;
    hidden.forEach(function (id) { cnt[id] = {}; red[id] = 0; });
    var H = hidden.length, burn = 300 + 60 * H, total = H ? (iters || (burn + 4000)) : 0;
    for (var t = 0; t < total; t++) {
      var a = hidden[Math.floor(Math.random() * H)];
      var ka = BB.kindOf(val[a]);
      var ga = gapOf[a], sa = snap(ga);
      if (ka !== 'b' && Math.random() < 0.3) {
        var list = alt[ka];
        var nv = list[Math.floor(Math.random() * list.length)];
        if (!inUse(nv)) { val[a] = nv; if (!settle(ga)) restore(ga, sa); }
      } else {
        var b = hidden[Math.floor(Math.random() * H)];
        if (val[a] !== val[b]) {
          var gb = gapOf[b], sb = snap(gb);
          var x = val[a]; val[a] = val[b]; val[b] = x;
          if (!settle(ga) || (gb !== ga && !settle(gb))) { restore(ga, sa); restore(gb, sb); }
        }
      }
      if (t >= burn && t % 4 === 0) {
        n++;
        for (var h = 0; h < H; h++) {
          var id = hidden[h], an = BB.annOf(val[id]);
          cnt[id][an] = (cnt[id][an] || 0) + 1;
          if (an === 'R') red[id]++;
        }
      }
    }
    var out = {};
    hidden.forEach(function (id) {
      var P = {};
      for (var k in cnt[id]) P[k] = cnt[id][k] / (n || 1);
      out[id] = { P: P, red: red[id] / (n || 1) };
    });
    // 已有确切信息标记的线
    G.wires.forEach(function (w) {
      if (w.o !== pi && !w.cut && w.info && w.info.t === 'v') { var P = {}; P[w.v] = 1; out[w.id] = { P: P, red: 0 }; }
    });
    return out;
  }
  Bot.infer = infer;

  Bot.decide = function (G, pi) {
    var V = BB.view(G, pi);
    var M = G.mission;
    var me = V.players[pi];
    var mine = [];
    me.stands.forEach(function (st) { st.forEach(function (w) { if (!w.cut) mine.push(w); }); });

    if (G.phase === 'setup') {
      if (G.setup[pi] >= G.infoN) return null;
      var blues = mine.filter(function (w) { return BB.kindOf(w.v) === 'b' && !w.info; });
      if (!blues.length) return null;
      return { a: 'info', w: blues[Math.floor(Math.random() * blues.length)].id };
    }
    if (G.pending && G.pending.type === 'walkie' && G.pending.to === pi) {
      var nr = mine.filter(function (w) { return BB.kindOf(w.v) !== 'r'; });
      var pick = (nr.length ? nr : mine)[0];
      return { a: 'walkie', w: pick.id };
    }
    if (G.turn !== pi || G.phase !== 'play' || G.pending) return null;

    // 危险时用倒带器
    var rew = G.equip.filter(function (e) { return e.n === 6 && !e.used && BB.equipUnlocked(G, 6); })[0];
    if (rew && G.det >= G.detMax - 1 && G.det > 0) return { a: 'equip', n: 6 };

    if (mine.length && mine.every(function (w) { return BB.kindOf(w.v) === 'r'; })) return { a: 'red' };

    var vals = [];
    mine.forEach(function (w) { var a = BB.annOf(w.v); if (a !== 'R' && vals.indexOf(a) < 0) vals.push(a); });
    for (var i = 0; i < vals.length; i++) {
      if (BB.soloOk(G, pi, vals[i])) return { a: 'solo', val: vals[i] };
    }
    vals = vals.filter(function (v) { return BB.seqAllowed(G, v); });

    var probs = infer(G, pi);
    var best = null, cands = [];
    V.players.forEach(function (p, tp) {
      if (tp === pi) return;
      p.stands.forEach(function (st, si) {
        st.forEach(function (w, i) {
          if (w.cut) return;
          var d = probs[w.id];
          vals.forEach(function (val) {
            var pv = d.P[val] || 0;
            var score = pv - 8 * d.red;
            var c = { w: w.id, tp: tp, si: si, val: val, p: pv, red: d.red, score: score };
            cands.push(c);
            if (!best || score > best.score) best = c;
          });
        });
      });
    });
    if (!best) return null;

    // 双重探测器：同一排两根线，提高命中率
    if (me.dd && best.p < 0.7) {
      var bestDD = null;
      cands.forEach(function (a) {
        cands.forEach(function (b) {
          if (a.w >= b.w || a.tp !== b.tp || a.si !== b.si || a.val !== b.val) return;
          var hit = 1 - (1 - a.p) * (1 - b.p);
          var boom = a.red * b.red;
          var s = hit - 3 * boom - 0.3 * Math.max(a.red, b.red);
          if (!bestDD || s > bestDD.s) bestDD = { s: s, ws: [a.w, b.w], val: a.val, hit: hit };
        });
      });
      if (bestDD && bestDD.hit > best.p + 0.2 && bestDD.s > best.score) return { a: 'dd', ws: bestDD.ws, val: bestDD.val };
    }
    return { a: 'dual', w: best.w, val: best.val };
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = Bot;
  else window.BBBot = Bot;
})();
