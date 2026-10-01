/* 炸弹克星 · 规则引擎（房主权威，纯数据，可在浏览器和 Node 中运行） */
(function () {
  var BB = {};

  BB.EQUIP = {
    1: { name: '标签 ≠', any: true, sel: 'ownPair', desc: '放在你两根相邻的线之间，公开声明它们数值不同。' },
    2: { name: '对讲机', any: false, sel: 'ownWire+player', desc: '与一名队友各选一根自己未剪的线交换（互相不知道对方给的是什么）。' },
    3: { name: '三重探测器', any: false, sel: 'triple', desc: '指向同一名队友的 3 根线并宣告一个数值，任意一根命中即成功。' },
    4: { name: '便利贴', any: true, sel: 'ownBlue', desc: '在你自己的一根蓝线前放一个信息标记。' },
    5: { name: '超级探测器', any: false, sel: 'stand', desc: '指向一名队友的整排线并宣告一个数值，只要其中有就成功。' },
    6: { name: '倒带器', any: true, sel: 'none', desc: '引爆器后退一格。' },
    7: { name: '应急电池', any: true, sel: 'none', desc: '最多 2 名队友的已用角色卡（双重探测器）重新可用。' },
    8: { name: '通用雷达', any: true, sel: 'value', desc: '宣告一个数值，每位玩家公开回答自己是否有这个数值的未剪线。' },
    9: { name: '稳定器', any: false, sel: 'none', desc: '本回合下一次剪线若失败：引爆器不前进，剪到红线也不会爆炸。' },
    10: { name: 'X/Y 射线', any: false, sel: 'xy', desc: '指向一根线并宣告两个数值（你都必须持有），命中其一即成功。' },
    11: { name: '咖啡杯', any: false, sel: 'player', desc: '跳过你的行动，指定下一位行动的玩家。' },
    12: { name: '标签 =', any: true, sel: 'ownPair', desc: '放在你两根相邻的线之间，公开声明它们数值相同。' }
  };

  function shuffle(a, rng) {
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(rng() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  BB.shuffle = shuffle;

  // 线的种类由数值小数部分决定：整数=蓝，.1=黄，.5=红
  function kindOf(v) {
    var f = Math.round((v - Math.floor(v)) * 10);
    return f === 1 ? 'y' : f === 5 ? 'r' : 'b';
  }
  BB.kindOf = kindOf;
  // 宣告值：蓝线为数字，黄线为 'Y'，红线为 'R'
  function annOf(v) { var k = kindOf(v); return k === 'b' ? v : k === 'y' ? 'Y' : 'R'; }
  BB.annOf = annOf;
  function matches(v, val) { return annOf(v) === val; }
  BB.matches = matches;
  BB.valLabel = function (val) { return val === 'Y' ? '黄色' : val === 'R' ? '红色' : String(val); };

  /* ---------- 建局 ---------- */
  // seats: [{pid, name, bot}]
  BB.createGame = function (mission, seats, opts) {
    opts = opts || {};
    var rng = opts.rng || Math.random;
    var np = seats.length;
    var mi = JSON.parse(JSON.stringify(mission));
    var R = mi.rules || {};
    var lo = mi.blue[0], hi = mi.blue[1];
    var values = [];
    for (var v = lo; v <= hi; v++) values.push(v);
    var missing = null;
    if (R.missing) {
      missing = values[Math.floor(rng() * values.length)];
    }
    var pool = [];
    values.forEach(function (v) { if (v !== missing) for (var i = 0; i < 4; i++) pool.push(v); });
    // 黄/红候选（取在蓝线范围内的位置）
    function pickCand(n, of, frac) {
      if (!of) return { cand: [], real: [] };
      var spots = [];
      for (var v = Math.max(1, lo); v <= Math.min(11, hi - 1 >= lo ? hi - 1 : hi); v++) spots.push(v + frac);
      if (spots.length < of) { spots = []; for (var v2 = 1; v2 <= 11; v2++) spots.push(v2 + frac); }
      var cand = shuffle(spots, rng).slice(0, of).sort(function (a, b) { return a - b; });
      var real = shuffle(cand.slice(), rng).slice(0, n).sort(function (a, b) { return a - b; });
      return { cand: cand, real: real };
    }
    var Y = pickCand(mi.y[0], mi.y[1], 0.1);
    var Rd = pickCand(mi.r[0], mi.r[1], 0.5);
    pool = pool.concat(Y.real, Rd.real);
    shuffle(pool, rng);

    var standsPer = np === 2 ? 2 : 1;
    var players = seats.map(function (s) {
      var st = []; for (var i = 0; i < standsPer; i++) st.push([]);
      return { pid: s.pid, name: s.name, bot: !!s.bot, stands: st, dd: mi.dd ? 1 : 0 };
    });
    var captain = 0;
    var wires = [];
    var slots = [];
    for (var si = 0; si < standsPer; si++) for (var pi = 0; pi < np; pi++) slots.push([(pi + captain) % np, si]);
    pool.forEach(function (v, i) {
      var sl = slots[i % slots.length];
      wires.push({ id: i, v: v, o: sl[0], s: sl[1], cut: false, info: null });
    });
    var G = {
      gid: Math.floor(rng() * 1e9).toString(36) + Date.now().toString(36), mission: mi, np: np, players: players, wires: wires,
      ymark: { n: mi.y[0], cand: Y.cand }, rmark: { n: mi.r[0], cand: Rd.cand },
      missing: missing,
      det: 0, detMax: Math.max(1, (np === 2 ? 3 : np + 1) + (mi.det || 0)),
      equip: [], labels: [], radar: null, stab: false, pending: null,
      seq: [], turn: captain, captain: captain, turnNo: 0, turnLimit: null,
      phase: 'setup', setup: {}, deadline: null, log: [], logSeq: 0, result: null, lastAct: null
    };
    resort(G);
    // 装备
    var eqN = mi.eq === -1 ? np : mi.eq;
    var eqPool = [];
    for (var n = 1; n <= 12; n++) if (n >= lo && n <= hi && n !== missing) eqPool.push(n);
    G.equip = shuffle(eqPool, rng).slice(0, Math.min(eqN, eqPool.length)).sort(function (a, b) { return a - b; })
      .map(function (n) { return { n: n, used: false }; });
    // 顺序引信
    if (R.seq) {
      var sv = shuffle(values.filter(function (v) { return v !== missing; }), rng).slice(0, R.seq);
      G.seq = sv;
    }
    if (R.turns) G.turnLimit = Math.ceil(pool.filter(function (v) { return kindOf(v) !== 'r'; }).length / 2) + R.turns;
    // 开局信息
    var infoN = R.infoN || (np === 2 ? 2 : 1);
    G.infoN = mi.info === 'none' ? 0 : infoN;
    players.forEach(function (p, i) { G.setup[i] = 0; });
    addLog(G, '任务 ' + mi.id + '「' + mi.name + '」开始。' + np + ' 名拆弹专家，引爆器容错 ' + (G.detMax - 1) + ' 次。');
    if (G.infoN === 0) {
      startPlay(G, opts.now);
    } else if (mi.info === 'random') {
      players.forEach(function (p, i) { for (var k = 0; k < G.infoN; k++) autoInfo(G, i, rng); });
      startPlay(G, opts.now);
    } else {
      addLog(G, mi.info === 'parity' ? '布置阶段：每人在自己的蓝线上放 ' + G.infoN + ' 个奇偶标记。' : '布置阶段：每人在自己的一根蓝线上放 ' + G.infoN + ' 个信息标记。');
    }
    return G;
  };

  function resort(G) {
    G.players.forEach(function (p, pi) {
      p.stands = p.stands.map(function (_, si) {
        return G.wires.filter(function (w) { return w.o === pi && w.s === si; })
          .sort(function (a, b) { return a.v - b.v || a.id - b.id; }).map(function (w) { return w.id; });
      });
    });
  }

  function addLog(G, txt, kind) {
    G.logSeq++;
    G.log.push({ n: G.logSeq, t: txt, k: kind || '' });
    if (G.log.length > 80) G.log.shift();
  }
  BB.addLog = addLog;

  function W(G, id) { return G.wires[id]; }
  function pname(G, i) { return G.players[i].name; }
  function infoFor(G, w) {
    if (G.mission.info === 'parity') return { t: w.v % 2 === 0 ? 'even' : 'odd' };
    return kindOf(w.v) === 'y' ? { t: 'Y' } : { t: 'v', v: w.v };
  }
  function autoInfo(G, pi, rng) {
    var cands = G.wires.filter(function (w) { return w.o === pi && !w.info && kindOf(w.v) === 'b'; });
    if (!cands.length) { G.setup[pi]++; return; }
    var w = cands[Math.floor((rng || Math.random)() * cands.length)];
    w.info = infoFor(G, w);
    G.setup[pi]++;
  }

  function startPlay(G, now) {
    G.phase = 'play';
    G.turn = G.captain;
    for (var k = 0; k < G.np && !canAct(G, G.turn); k++) G.turn = nextPlayer(G, G.turn);
    G.turnNo = 1;
    setDeadline(G, now);
    addLog(G, '开始拆弹！由队长 ' + pname(G, G.turn) + ' 先行动。');
  }
  function setDeadline(G, now) {
    var t = G.mission.rules && G.mission.rules.timer;
    G.deadline = t ? (now || Date.now()) + t * 1000 : null;
  }

  function uncutOf(G, pi) { return G.wires.filter(function (w) { return w.o === pi && !w.cut; }); }
  function hasUncut(G, pi) { return uncutOf(G, pi).length > 0; }
  BB.hasValue = function (G, pi, val) { return uncutOf(G, pi).some(function (w) { return matches(w.v, val); }); };
  function nextPlayer(G, from) {
    for (var k = 1; k <= G.np; k++) {
      var i = (from + k) % G.np;
      if (hasUncut(G, i)) return i;
    }
    return from;
  }

  function othersCuttable(G, pi) {
    return G.wires.some(function (w) { return w.o !== pi && !w.cut && kindOf(w.v) !== 'r'; });
  }
  function soloOk(G, pi, val) {
    if (G.mission.rules && G.mission.rules.noSolo && othersCuttable(G, pi)) return false;
    if (!seqAllowed(G, val)) return false;
    var mine = uncutOf(G, pi).filter(function (w) { return matches(w.v, val); });
    var rest = G.wires.filter(function (w) { return !w.cut && matches(w.v, val); });
    return mine.length > 0 && mine.length === rest.length;
  }
  BB.soloOk = soloOk;
  // 该玩家现在是否有合法行动
  function canAct(G, pi) {
    var mine = uncutOf(G, pi);
    if (!mine.length) return false;
    if (mine.every(function (w) { return kindOf(w.v) === 'r'; })) return true;
    var others = G.wires.some(function (w) { return w.o !== pi && !w.cut; });
    return mine.some(function (w) {
      var a = annOf(w.v);
      if (a === 'R') return false;
      return (others && seqAllowed(G, a)) || soloOk(G, pi, a);
    });
  }
  BB.canAct = canAct;

  // 顺序引信：值 val 能否开始剪
  function seqAllowed(G, val) {
    if (!G.seq.length || val === 'Y' || val === 'R') return true;
    var idx = G.seq.indexOf(val);
    if (idx <= 0) return true;
    var prev = G.seq[idx - 1];
    return G.wires.every(function (w) { return w.v !== prev || w.cut; }) && seqAllowed(G, prev);
  }
  BB.seqAllowed = seqAllowed;

  function cutCount(G, val) { return G.wires.filter(function (w) { return w.cut && matches(w.v, val); }).length; }
  BB.cutCount = cutCount;
  BB.equipUnlocked = function (G, n) { return cutCount(G, n) >= 2; };

  function cutWire(G, w) {
    w.cut = true;
  }

  function checkEnd(G) {
    if (G.phase === 'won' || G.phase === 'lost') return true;
    if (G.det >= G.detMax) { lose(G, '引爆器走到了尽头……炸弹爆炸了。'); return true; }
    var left = G.wires.filter(function (w) { return !w.cut && kindOf(w.v) !== 'r'; });
    if (!left.length) {
      G.wires.forEach(function (w) { if (kindOf(w.v) === 'r') w.cut = true; });
      G.phase = 'won'; G.deadline = null;
      G.result = { win: true, why: '所有可剪的线都已剪断，炸弹被成功拆除！' };
      addLog(G, '🎉 拆弹成功！', 'win');
      return true;
    }
    return false;
  }
  function lose(G, why) {
    G.phase = 'lost'; G.deadline = null;
    G.result = { win: false, why: why };
    addLog(G, '💥 ' + why, 'lose');
  }

  function endTurn(G, now, nextIdx) {
    if (checkEnd(G)) return;
    G.stab = false;
    G.turn = nextIdx !== undefined ? nextIdx : nextPlayer(G, G.turn);
    G.turnNo++;
    var R = G.mission.rules || {};
    if (R.countdown && (G.turnNo - 1) % R.countdown === 0) {
      G.det++;
      addLog(G, '⏱ 引信老化：引爆器自动前进一格（' + G.det + '/' + G.detMax + '）。', 'bad');
      if (checkEnd(G)) return;
    }
    if (G.turnLimit && G.turnNo > G.turnLimit) { lose(G, '超过回合上限，时间耗尽。'); return; }
    for (var k = 0; k < G.np && !canAct(G, G.turn); k++) {
      if (hasUncut(G, G.turn)) addLog(G, pname(G, G.turn) + ' 手上的数值都被顺序引信锁住，本回合跳过。');
      G.turn = nextPlayer(G, G.turn);
    }
    setDeadline(G, now);
  }

  // 统一的剪线判定。targets: 线 id 数组；vals: 宣告值数组
  function attempt(G, pi, targets, vals, label, rng) {
    var ws = targets.map(function (id) { return W(G, id); });
    var hit = null, hv = null;
    for (var i = 0; i < ws.length && !hit; i++) {
      for (var j = 0; j < vals.length; j++) if (matches(ws[i].v, vals[j])) { hit = ws[i]; hv = vals[j]; break; }
    }
    var tp = ws[0].o;
    var who = pname(G, pi) + ' → ' + pname(G, tp);
    var said = vals.map(BB.valLabel).join(' 或 ');
    if (hit) {
      cutWire(G, hit);
      var mine = uncutOf(G, pi).filter(function (w) { return matches(w.v, hv); })[0];
      if (mine) cutWire(G, mine);
      addLog(G, '✂️ ' + who + '（' + label + '）宣告「' + said + '」：命中！双方各剪掉一根' + BB.valLabel(hv) + (hv === 'Y' ? '' : '') + '。', 'good');
      G.lastAct = { t: 'hit', ids: [hit.id].concat(mine ? [mine.id] : []) };
      unlockLog(G, hv);
      return true;
    }
    var reds = ws.filter(function (w) { return kindOf(w.v) === 'r'; });
    var safe = ws.filter(function (w) { return kindOf(w.v) !== 'r'; });
    if (G.stab) {
      addLog(G, '🛡 ' + who + '（' + label + '）宣告「' + said + '」：没中，但稳定器生效，引爆器不动。', 'warn');
      G.stab = false;
      if (safe.length) placeFailInfo(G, safe, vals, rng);
      G.lastAct = { t: 'miss', ids: targets };
      return false;
    }
    if (!safe.length) {
      G.wires.forEach(function (w) { if (reds.indexOf(w) >= 0) w.cut = true; });
      G.lastAct = { t: 'boom', ids: targets };
      lose(G, who + ' 剪到了红线！炸弹爆炸了。');
      return false;
    }
    G.det++;
    addLog(G, '❌ ' + who + '（' + label + '）宣告「' + said + '」：错误！引爆器前进一格（' + G.det + '/' + G.detMax + '）。', 'bad');
    placeFailInfo(G, safe, vals, rng);
    G.lastAct = { t: 'miss', ids: targets };
    return false;
  }
  function placeFailInfo(G, safe, vals, rng) {
    var R = G.mission.rules || {};
    if (R.silent) return;
    var w = safe[Math.floor((rng || Math.random)() * safe.length)];
    if (R.fog) {
      w.info = { t: 'not', v: vals.map(String).join('/') };
    } else {
      w.info = kindOf(w.v) === 'y' ? { t: 'Y' } : { t: 'v', v: w.v };
    }
  }
  function unlockLog(G, val) {
    if (val === 'Y') return;
    if (cutCount(G, val) === 2) {
      G.equip.forEach(function (e) {
        if (e.n === val) addLog(G, '🔓 装备「' + BB.EQUIP[e.n].name + '」已解锁！', 'good');
      });
    }
    if (cutCount(G, val) === 4) addLog(G, '✅ 数值 ' + val + ' 已全部剪完。');
  }

  /* ---------- 动作 ---------- */
  // 返回 null 表示成功；返回字符串为错误信息
  BB.act = function (G, pi, a, opts) {
    opts = opts || {};
    var now = opts.now || Date.now();
    var rng = opts.rng || Math.random;
    if (G.phase === 'won' || G.phase === 'lost') return '游戏已经结束';
    var P = G.players[pi];
    if (!P) return '你不在这局游戏中';

    if (a.a === 'info') {
      if (G.phase !== 'setup') return '现在不是布置阶段';
      if (G.setup[pi] >= G.infoN) return '你已经放好了信息标记';
      var w = W(G, a.w);
      if (!w || w.o !== pi) return '只能放在你自己的线上';
      if (kindOf(w.v) !== 'b') return '只能放在蓝线上';
      if (w.info) return '这根线已经有标记了';
      w.info = infoFor(G, w);
      G.setup[pi]++;
      addLog(G, P.name + ' 放置了一个开局信息标记。');
      var done = G.players.every(function (_, i) { return G.setup[i] >= G.infoN; });
      if (done) startPlay(G, now);
      return null;
    }

    if (G.phase !== 'play') return '现在不能行动';

    // 待处理：对讲机响应
    if (a.a === 'walkie') {
      var pd = G.pending;
      if (!pd || pd.type !== 'walkie' || pd.to !== pi) return '没有等待你的交换';
      var mw = W(G, a.w);
      if (!mw || mw.o !== pi || mw.cut) return '请选择你自己未剪的线';
      var fw = W(G, pd.wire);
      var fs = fw.s, ms = mw.s;
      fw.o = pi; fw.s = ms; mw.o = pd.from; mw.s = fs;
      fw.info = null; mw.info = null;
      G.labels = G.labels.filter(function (l) { return [fw.id, mw.id].indexOf(l.a) < 0 && [fw.id, mw.id].indexOf(l.b) < 0; });
      resort(G);
      G.pending = null;
      addLog(G, '📻 ' + pname(G, pd.from) + ' 与 ' + P.name + ' 用对讲机交换了一根线。');
      return null;
    }
    if (G.pending) return '正在等待 ' + pname(G, G.pending.to) + ' 选择交换的线';

    if (a.a === 'equip') return useEquip(G, pi, a, now, rng);

    if (a.a === 'timeout') {
      G.det++;
      addLog(G, '⌛ ' + P.name + ' 超时！引爆器前进一格（' + G.det + '/' + G.detMax + '）。', 'bad');
      endTurn(G, now);
      return null;
    }

    if (G.turn !== pi) return '还没轮到你';

    if (a.a === 'dual' || a.a === 'dd') {
      var ids = a.a === 'dual' ? [a.w] : a.ws;
      if (!ids || !ids.length) return '请选择目标线';
      if (a.a === 'dd') {
        if (!P.dd) return '你的双重探测器已经用过了';
        if (ids.length !== 2 || ids[0] === ids[1]) return '双重探测器需要选择两根不同的线';
      }
      var e = checkTargets(G, pi, ids, true); if (e) return e;
      if (a.a === 'dd' && W(G, ids[0]).s !== W(G, ids[1]).s) return '两根线必须在同一排';
      var ev = checkVal(G, pi, a.val); if (ev) return ev;
      if (a.a === 'dd') P.dd = 0;
      attempt(G, pi, ids, [a.val], a.a === 'dd' ? '双重探测器' : '双人剪', rng);
      endTurn(G, now);
      return null;
    }
    if (a.a === 'solo') {
      var val = a.val;
      if (G.mission.rules && G.mission.rules.noSolo && othersCuttable(G, pi)) return '本关禁止单人剪';
      if (!seqAllowed(G, val)) return '顺序引信：还不能剪 ' + BB.valLabel(val);
      if (!soloOk(G, pi, val)) return '单人剪需要你持有该数值所有剩余的线';
      var mineV = uncutOf(G, pi).filter(function (w) { return matches(w.v, val); });
      mineV.forEach(function (w) { cutWire(G, w); });
      addLog(G, '✂️ ' + P.name + ' 单人剪：剪掉了自己全部 ' + mineV.length + ' 根' + BB.valLabel(val) + '。', 'good');
      G.lastAct = { t: 'hit', ids: mineV.map(function (w) { return w.id; }) };
      unlockLog(G, val);
      endTurn(G, now);
      return null;
    }
    if (a.a === 'red') {
      var mine = uncutOf(G, pi);
      if (!mine.length || mine.some(function (w) { return kindOf(w.v) !== 'r'; })) return '只有当你剩下的全是红线时才能公开';
      mine.forEach(function (w) { w.cut = true; });
      addLog(G, '🟥 ' + P.name + ' 公开了自己剩下的 ' + mine.length + ' 根红线。', 'warn');
      G.lastAct = { t: 'hit', ids: mine.map(function (w) { return w.id; }) };
      endTurn(G, now);
      return null;
    }
    return '未知动作';
  };

  function checkTargets(G, pi, ids, sameOwner) {
    var owner = null;
    for (var i = 0; i < ids.length; i++) {
      var w = W(G, ids[i]);
      if (!w || w.cut) return '目标线不存在或已被剪断';
      if (w.o === pi) return '不能指向你自己的线';
      if (owner === null) owner = w.o;
      else if (sameOwner && w.o !== owner) return '所有目标线必须属于同一名队友';
    }
    return null;
  }
  function checkVal(G, pi, val) {
    if (val === 'R') return '不能宣告红色';
    if (!BB.hasValue(G, pi, val)) return '你必须持有自己宣告的数值';
    if (!seqAllowed(G, val)) return '顺序引信：现在还不能剪 ' + BB.valLabel(val);
    return null;
  }

  function useEquip(G, pi, a, now, rng) {
    var e = G.equip.filter(function (x) { return x.n === a.n; })[0];
    if (!e) return '本局没有这张装备';
    if (e.used) return '这张装备已经用过了';
    if (!BB.equipUnlocked(G, e.n)) return '装备还没解锁（需要先剪掉 2 根 ' + e.n + '）';
    var def = BB.EQUIP[e.n];
    if (!def.any && G.turn !== pi) return '这张装备只能在你自己的回合使用';
    var P = G.players[pi];
    var nm = '「' + def.name + '」';
    switch (e.n) {
      case 1: case 12: {
        var w1 = W(G, a.w1), w2 = W(G, a.w2);
        if (!w1 || !w2 || w1.o !== pi || w2.o !== pi || w1.cut || w2.cut) return '请选择你自己两根未剪的线';
        var st = P.stands[w1.s];
        if (w1.s !== w2.s || Math.abs(st.indexOf(w1.id) - st.indexOf(w2.id)) !== 1) return '两根线必须相邻';
        var same = annOf(w1.v) === annOf(w2.v);
        if (e.n === 1 && same) return '这两根线数值相同，不能放「≠」';
        if (e.n === 12 && !same) return '这两根线数值不同，不能放「=」';
        G.labels.push({ a: w1.id, b: w2.id, t: e.n === 1 ? 'ne' : 'eq' });
        addLog(G, '🏷 ' + P.name + ' 使用了' + nm + '。');
        break;
      }
      case 2: {
        var w = W(G, a.w);
        if (!w || w.o !== pi || w.cut) return '请选择你自己一根未剪的线';
        if (a.p === pi || !G.players[a.p] || !hasUncut(G, a.p)) return '请选择一名还有线的队友';
        G.pending = { type: 'walkie', from: pi, to: a.p, wire: w.id };
        addLog(G, '📻 ' + P.name + ' 使用了' + nm + '，等待 ' + pname(G, a.p) + ' 选择要交换的线。');
        break;
      }
      case 3: case 5: {
        var ids;
        if (e.n === 3) {
          ids = a.ws || [];
          if (ids.length !== 3 || new Set(ids).size !== 3) return '三重探测器需要选择同一名队友的 3 根线';
        } else {
          var tp = G.players[a.p];
          if (!tp || a.p === pi || !tp.stands[a.s]) return '请选择一名队友的一排线';
          ids = tp.stands[a.s].filter(function (id) { return !W(G, id).cut; });
          if (!ids.length) return '这一排已经没有线了';
        }
        var er = checkTargets(G, pi, ids, true); if (er) return er;
        var ev = checkVal(G, pi, a.val); if (ev) return ev;
        e.used = true;
        attempt(G, pi, ids, [a.val], def.name, rng);
        endTurn(G, now);
        return null;
      }
      case 4: {
        var pw = W(G, a.w);
        if (!pw || pw.o !== pi || pw.cut || kindOf(pw.v) !== 'b' || pw.info) return '请选择你自己一根没有标记的蓝线';
        pw.info = { t: 'v', v: pw.v };
        addLog(G, '📝 ' + P.name + ' 使用了' + nm + '。');
        break;
      }
      case 6:
        if (G.det === 0) return '引爆器已经在起点';
        G.det--;
        addLog(G, '⏪ ' + P.name + ' 使用了' + nm + '，引爆器后退一格（' + G.det + '/' + G.detMax + '）。', 'good');
        break;
      case 7: {
        var used = G.players.map(function (p, i) { return i; }).filter(function (i) { return G.mission.dd && !G.players[i].dd; });
        if (!used.length) return '没有人的角色卡需要充电';
        used.slice(0, 2).forEach(function (i) { G.players[i].dd = 1; });
        addLog(G, '🔋 ' + P.name + ' 使用了' + nm + '：' + used.slice(0, 2).map(function (i) { return pname(G, i); }).join('、') + ' 的双重探测器重新可用。', 'good');
        break;
      }
      case 8: {
        var val = a.val;
        if (val !== 'Y' && !(val >= 1 && val <= 12)) return '请选择一个数值';
        var res = G.players.map(function (p, i) { return BB.hasValue(G, i, val); });
        G.radar = { val: val, res: res };
        addLog(G, '📡 ' + P.name + ' 使用' + nm + '查询「' + BB.valLabel(val) + '」：' +
          G.players.map(function (p, i) { return p.name + (res[i] ? ' 有' : ' 没有'); }).join('，') + '。');
        break;
      }
      case 9:
        G.stab = true;
        addLog(G, '🛡 ' + P.name + ' 启动了' + nm + '。');
        break;
      case 10: {
        var xw = a.w;
        var er2 = checkTargets(G, pi, [xw], true); if (er2) return er2;
        if (!a.vals || a.vals.length !== 2 || a.vals[0] === a.vals[1]) return '请宣告两个不同的数值';
        for (var k = 0; k < 2; k++) { var ev2 = checkVal(G, pi, a.vals[k]); if (ev2) return ev2; }
        e.used = true;
        attempt(G, pi, [xw], a.vals, def.name, rng);
        endTurn(G, now);
        return null;
      }
      case 11: {
        if (a.p === pi || !G.players[a.p] || !hasUncut(G, a.p)) return '请选择一名还有线的队友';
        e.used = true;
        addLog(G, '☕ ' + P.name + ' 喝了口咖啡，指定 ' + pname(G, a.p) + ' 接着行动。');
        endTurn(G, now, a.p);
        return null;
      }
    }
    e.used = true;
    return null;
  }

  /* ---------- 视图：只暴露玩家 pi 能看到的信息 ---------- */
  BB.view = function (G, pi) {
    var over = G.phase === 'won' || G.phase === 'lost';
    var R = G.mission.rules || {};
    return {
      gid: G.gid, mid: G.mission.id, np: G.np, me: pi, phase: G.phase, turn: G.turn, turnNo: G.turnNo, turnLimit: G.turnLimit,
      det: G.det, detMax: G.detMax, stab: G.stab, infoN: G.infoN, setup: G.setup,
      players: G.players.map(function (p, i) {
        return {
          name: p.name, bot: p.bot, dd: p.dd, pid: p.pid,
          stands: p.stands.map(function (st) {
            return st.map(function (id) {
              var w = G.wires[id];
              var see = w.cut || i === pi || over;
              return { id: id, v: see ? w.v : null, cut: w.cut, info: w.info };
            });
          })
        };
      }),
      equip: G.equip.map(function (e) { return { n: e.n, used: e.used, open: BB.equipUnlocked(G, e.n) }; }),
      ymark: R.hide && !over ? { n: G.ymark.n, cand: [] } : G.ymark,
      rmark: R.hide && !over ? { n: G.rmark.n, cand: [] } : G.rmark,
      missing: over ? G.missing : null,
      seq: G.seq, labels: G.labels, radar: G.radar, pending: G.pending, deadline: G.deadline,
      result: G.result, lastAct: G.lastAct, log: G.log.slice(-12)
    };
  };

  // 紧凑编码（联机传输，单条消息 ≤4KB）：公共部分 + 每人私有手牌
  BB.packPublic = function (G, logN) {
    var V = BB.view(G, -1);
    V.players.forEach(function (p) {
      p.stands = p.stands.map(function (st) {
        return st.map(function (w) { return [w.id, w.v === null ? 0 : w.v, w.info ? encInfo(w.info) : 0, w.cut ? 1 : 0]; });
      });
    });
    V.log = G.log.slice(-(logN === undefined ? 8 : logN));
    return V;
  };
  BB.packHand = function (G, pi) {
    var h = {};
    G.wires.forEach(function (w) { if (w.o === pi) h[w.id] = w.v; });
    return h;
  };
  BB.unpack = function (pub, hand, me) {
    var V = JSON.parse(JSON.stringify(pub));
    V.me = me;
    V.players.forEach(function (p, pi) {
      p.stands = p.stands.map(function (st) {
        return st.map(function (a) {
          var v = a[1] || null;
          if (v === null && pi === me && hand && hand[a[0]] !== undefined) v = hand[a[0]];
          return { id: a[0], v: v, cut: !!a[3], info: a[2] ? decInfo(a[2]) : null };
        });
      });
    });
    return V;
  };
  function encInfo(f) {
    if (f.t === 'v') return f.v;
    if (f.t === 'Y') return 'Y';
    if (f.t === 'odd') return 'o';
    if (f.t === 'even') return 'e';
    if (f.t === 'not') return '!' + f.v;
    return 0;
  }
  function decInfo(x) {
    if (typeof x === 'number') return { t: 'v', v: x };
    if (x === 'Y') return { t: 'Y' };
    if (x === 'o') return { t: 'odd' };
    if (x === 'e') return { t: 'even' };
    if (x.charAt(0) === '!') return { t: 'not', v: x.slice(1) };
    return null;
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = BB;
  else window.BB = BB;
})();
