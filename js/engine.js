/* 炸弹克星 · 规则引擎（房主权威，纯数据，可在浏览器和 Node 中运行） */
(function () {
  var BB = {};
  var Campaign = typeof module !== 'undefined' && module.exports ? require('./campaign-rules.js') : window.BB_CAMPAIGN;
  var Audio = typeof module !== 'undefined' && module.exports ? require('./audio-timeline.js') : window.BB_AUDIO_TIMELINE;

  BB.EQUIP = {
    1: { name: '标签 ≠', any: true, sel: 'ownPair', desc: '标记自己同一排相邻的两根不同值导线；其中一根可以已剪。红线彼此相等，黄线彼此相等。' },
    2: { name: '对讲机', any: true, sel: 'ownWire+player', desc: '双方各选一根未剪导线交换并重新排序；已有信息标记随导线移动，不可讨论其数值。' },
    3: { name: '三重探测器', any: false, sel: 'triple', desc: '双人拆线时指向队友同一排的三根线；该排仅余两根时可指两根。宣告蓝色数字，只剪一根。' },
    4: { name: '便利贴', any: true, sel: 'ownBlue', desc: '在自己一根未剪的蓝线前放对应的信息标记，受信息标记供应量限制。' },
    5: { name: '超级探测器', any: false, sel: 'stand', desc: '双人拆线时指向队友同一排全部未剪导线，宣告蓝色数字；只剪一根。' },
    6: { name: '倒带器', any: true, sel: 'none', desc: '引爆器后退一格。' },
    7: { name: '备用电池', any: true, sel: 'players', desc: '选择一或两张已使用的角色卡，恢复其个人装备。' },
    8: { name: '通用雷达', any: true, sel: 'value', desc: '询问一个蓝色数字；每名玩家对每一排分别回答有或没有，不报告数量和位置。' },
    9: { name: '稳定器', any: false, sel: 'none', desc: '双人拆线前使用：本次失败不推进引爆器，红线也不爆炸；安全误判仍放信息标记。' },
    10: { name: 'X/Y 射线', any: false, sel: 'xy', desc: '本次双人拆线宣告两个自己持有的不同值，可包含黄色；与探测器组合时只宣告蓝色数字。' },
    11: { name: '咖啡杯', any: false, sel: 'player', desc: '在自己回合跳过拆线，并指定下一名行动的玩家，之后照顺时针继续。' },
    12: { name: '标签 =', any: true, sel: 'ownPair', desc: '标记自己同一排相邻的两根相同值导线，其中一根可以已剪；黄线都算黄色，红线都算红色。' },
    13: { name: '双层底盒', any: true, sel: 'none', desc: '首两根黄线剪完解锁；使用时抽两张未入局的随机共享装备，按已剪线判断是否可用。' },
    14: { name: '单一导线标签', any: true, sel: 'ownUniqueBlue', desc: '四根蓝2全部剪完解锁。在自己的蓝线上放×1标记，允许已剪线；该值在整架只出现一次，计入已剪线。不会公开隐藏数值。' },
    15: { name: '应急储备箱', any: true, activationPending: true, sel: 'none', desc: '印刷3·3，需要四根蓝3全部剪完。效果恢复此前已用的共享装备；不恢复个人角色卡。即时效果的触发时机尚待核实。' },
    16: { name: '单剪通行证', any: false, sel: 'ownTwo', desc: '四根蓝9全部剪完解锁。在自己回合选择两根同值的非红导线单拆，即使另外两根尚未剪；两架合起来算一手牌。只剪所选两根并消耗本回合。' },
    17: { name: '分解器', any: true, activationPending: true, sel: 'none', desc: '印刷10·10，需要四根蓝10全部剪完。随机抽蓝色数字信息标记；法文版剪掉全队该值的剩余蓝线。即时触发时机及德文可选措辞尚待核实。' },
    18: { name: '抓钩', any: true, sel: 'otherWire', desc: '四根蓝11全部剪完解锁。取队友一根未剪线到自己手中，不公开数值；两架时本人选择放哪架，按印刷值排序。取出和插入的位置公开。' }
  };
  Object.keys(BB.EQUIP).forEach(function (n) { BB.EQUIP[n].id = Campaign.equipmentIdentity(Number(n)); });
  BB.CHARACTERS = Campaign.characters;
  BB.CHALLENGES = Campaign.challenges.cards;
  BB.personalOxygen = Campaign.personalOxygen;
  BB.memorySea = Campaign.memorySea;
  BB.numberOrder = Campaign.numberOrder;
  BB.allFalseInfo = Campaign.allFalseInfo;
  BB.robotPressure = Campaign.robotPressure;
  BB.submarine54 = Campaign.submarine54;
  BB.submarineAffordable = Campaign.submarineAffordable;
  BB.CONSTRAINTS = Campaign.constraints;
  BB.robotRoute = Campaign.robotRoute;
  BB.robotRouteValues = Campaign.robotRouteValues;
  BB.constraintRing = Campaign.constraintRing;
  BB.numberRewards = Campaign.numberRewards;
  BB.passingOxygen = Campaign.passingOxygen;
  BB.passingAffordable = Campaign.passingAffordable;
  BB.doubleOutward = Campaign.doubleOutward;
  BB.outwardIdsForOwner = Campaign.outwardIdsForOwner;
  BB.numberRelay = Campaign.numberRelay;
  BB.freeTurn = Campaign.freeTurn;
  BB.weakLink = Campaign.weakLink;
  BB.personalCardsLocked = Campaign.personalCardsLocked;
  BB.freeTurnEligible = Campaign.freeTurnEligible;
  BB.relayMatching = Campaign.relayMatching;
  BB.constraint = Campaign.constraint;
  BB.actorValueAllowed = Campaign.actorValueAllowed;
  BB.targetAllowed = Campaign.targetAllowed;
  BB.equipmentAllowed = Campaign.equipmentAllowed;
  BB.turnActor = Campaign.turnActor;
  BB.soloAllowed = Campaign.soloAllowed;
  BB.communicationRule = Campaign.communicationRule;
  BB.redNumber = Campaign.redNumber;
  BB.rookie = Campaign.rookie;
  BB.liar = Campaign.liar;
  BB.unequippedCaptain = Campaign.unequippedCaptain;
  BB.isX = Campaign.isX;
  BB.yellowBeforeX = Campaign.yellowBeforeX;
  BB.xLocked = Campaign.xLocked;
  BB.isOutward = Campaign.isOutward;
  BB.allOutward = Campaign.allOutward;
  BB.wireVisible = Campaign.wireVisible;
  BB.clueKind = Campaign.clueKind;
  BB.tripwire = Campaign.tripwire;
  BB.nano = Campaign.nano;
  BB.ownTurnAllowed = Campaign.ownTurnAllowed;
  BB.cutClueAllowed = Campaign.cutClueAllowed;
  BB.equipmentWireAllowed = Campaign.equipmentWireAllowed;
  BB.stabilizerAllowed = Campaign.stabilizerAllowed;
  BB.announcementLabel = function (G, val) {
    return Campaign.communicationRule(G) && Number.isInteger(val) && val >= 1 && val <= 12 ? '手势 ' + Array(val).fill('●').join(' ') : BB.valLabel(val);
  };
  BB.detonatorText = function (G) {
    var official = G.officialState || G.official, sharedConstraint = official && official.constraints && official.constraints.kind !== 'personal';
    if(Campaign.robotPressure(G)){var robot=Campaign.robotPressure(G);return '机器人位于 '+(robot.position===0?'1之前':robot.position)+'；到 '+robot.limit+' 引爆（不使用引爆器）';}
    if(Campaign.allOutward(G))return '引爆器距引爆还剩 '+Math.max(0,G.detMax-G.det)+' 格（朝外线处罚也计入）';
    if (Campaign.tripwire(G)) return '绊线任务：引爆器距引爆还剩 ' + Math.max(0,G.detMax-G.det) + ' 格';
    if (Campaign.numberRewards(G)) return '数字奖励：引爆器距引爆还剩 ' + Math.max(0,G.detMax-G.det) + ' 格';
    if (G.det < 0 || G.mission && G.mission.printedDial && G.equip.some(function (e) { return e.n === 6 && e.used; })) return '引爆器距引爆还剩 ' + Math.max(0, G.detMax - G.det) + ' 格' + (G.det < 0 ? '（已退到人数起点之前）' : '');
    return Campaign.communicationRule(G) || sharedConstraint ? '引爆器 ' + G.det + '/' + G.detMax + '；再前进 ' + Math.max(0, G.detMax - G.det) + ' 格引爆' : '第 ' + G.detMax + ' 次失误引爆；当前 ' + G.det + ' 次';
  };
  BB.equipProgress = function (n) { return Campaign.unlock(n); };
  BB.equipmentLabel = function(n){return n>=14?Campaign.unlock(n).printed:String(n);};
  BB.uniqueMarkerCount=function(G){var wires=G.wires||G.players.flatMap(function(p){return p.stands.flat();});return wires.reduce(function(n,w){return n+(w.unique?1:0)+(w.info&&w.info.t==='freq'&&w.info.v===1?(w.info.copies||1):0);},0);};
  BB.oxygen = Campaign.oxygen;
  BB.numberClaim = Campaign.numberClaim;
  BB.arithmetic = Campaign.arithmetic;
  BB.arithmeticPairs = Campaign.arithmeticPairs;
  BB.oxygenCost = Campaign.oxygenCost;
  BB.characterState = function (p) {
    var id = p.character ? p.character.id : 'double-detector';
    var state = { id: id, used: id === 'double-detector' ? !p.dd : !!p.character.used };
    if (p.character && p.character.removed) state.removed = true;
    if (p.character && p.character.hidden) state.hidden = true;
    if (p.character && p.character.locked) state.locked = true;
    return state;
  };
  BB.characterOptions = function (mi, pi, captain) {
    var ids = mi.personalCharacters && mi.ruleset === 'physical' && pi !== captain ? Object.keys(BB.CHARACTERS) : ['double-detector'];
    return ids.filter(function (id) { return !(mi.excludeCharacters || []).includes(id); });
  };
  BB.validateCharacterSeats = function (mi, seats, captain) {
    var selected = [];
    for (var i = 0; i < seats.length; i++) {
      var id = i === captain ? 'double-detector' : seats[i].character || 'double-detector';
      if (BB.characterOptions(mi, i, captain).indexOf(id) < 0) return '此任务不能选择该角色';
      if (id !== 'double-detector' && selected.indexOf(id) >= 0) return '每种新角色只有一张，请选择其他角色';
      selected.push(id);
    }
    return null;
  };
  function useCharacter(G, pi) {
    var state = BB.characterState(G.players[pi]);
    if (state.id === 'double-detector') { if (!Campaign.reusableCharacter(G)) G.players[pi].dd = 0; if (G.players[pi].character) G.players[pi].character.used = !G.players[pi].dd; }
    else G.players[pi].character.used = true;
  }
  function characterAvailable(G, pi, id) {
    if(Campaign.personalCardsLocked(G))return false;
    var state = BB.characterState(G.players[pi]);
    return state.id === id && !state.used && !state.removed;
  };


  function shuffle(a, rng) {
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(rng() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  BB.shuffle = shuffle;

  // 保留印刷排序数值；任务可以另设玩法颜色。旧数字调用继续兼容。
  function kindOf(v) {
    if (v && typeof v === 'object') { if (v.kind) return v.kind; v = v.v; }
    var f = Math.round((v - Math.floor(v)) * 10);
    return f === 1 ? 'y' : f === 5 ? 'r' : 'b';
  }
  BB.kindOf = kindOf;
  // 宣告值：蓝线为数字，黄线为 'Y'，红线为 'R'
  function annOf(v) { var k = kindOf(v); return k === 'b' ? v && typeof v === 'object' ? v.v : v : k === 'y' ? 'Y' : 'R'; }
  BB.annOf = annOf;
  function matches(v, val) { return annOf(v) === val; }
  BB.matches = matches;
  BB.setupInfoAllowed = function (G, wire) { var special = Campaign.setupInfoAllowed(G, wire); return special == null ? kindOf(wire) === 'b' : special; };
  BB.valLabel = function (val) { return val === 'Y' ? '黄色' : val === 'R' ? '红色' : String(val); };
  BB.usesCutChoices = function (G) { return G.ruleset === 'physical' || G.cutFlow === 'choice-v1'; };

  /* ---------- 建局 ---------- */
  // seats: [{pid, name, bot}]
  BB.createGame = function (mission, seats, opts) {
    opts = opts || {};
    var rng = opts.rng || Math.random;
    var np = seats.length;
    var mi = JSON.parse(JSON.stringify(mission));
    var physical = mi.ruleset === 'physical';
    if (physical && mi.two && np === 2) { if (mi.two.y) mi.y = mi.two.y; if (mi.two.r) mi.r = mi.two.r; }
    if (physical) Campaign.prepareMission(mi,np);
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
    function pickCand(n, of, frac, fixed) {
      if (!of) return { cand: [], real: [] };
      if(Array.isArray(fixed)){
        if(fixed.length!==of||new Set(fixed).size!==of||fixed.some(function(value){return !Number.isFinite(value)||Math.abs(value-Math.floor(value)-frac)>1e-8||value<lo||value>hi;}))throw new Error('任务固定特殊导线配置无效');
        var chosen=fixed.slice().sort(function(a,b){return a-b;});return {cand:chosen,real:shuffle(chosen.slice(),rng).slice(0,n).sort(function(a,b){return a-b;})};
      }
      var spots = [];
      for (var v = Math.max(1, lo); v <= Math.min(11, hi - 1 >= lo ? hi - 1 : hi); v++) spots.push(v + frac);
      if (spots.length < of) { spots = []; for (var v2 = 1; v2 <= 11; v2++) spots.push(v2 + frac); }
      var cand = shuffle(spots, rng).slice(0, of).sort(function (a, b) { return a - b; });
      var real = shuffle(cand.slice(), rng).slice(0, n).sort(function (a, b) { return a - b; });
      return { cand: cand, real: real };
    }
    var Y = pickCand(mi.y[0], mi.y[1], 0.1, physical?mi.fixedYellow:null);
    var Rd = pickCand(mi.r[0], mi.r[1], 0.5);
    pool = pool.concat(Y.real, Rd.real);
    shuffle(pool, rng);

    var captain = physical ? ((opts.captain || 0) % np + np) % np : 0;
    if (physical) captain = Campaign.prepareCaptain(mi, np, captain, campaignContext(rng));
    var characterError = physical && BB.validateCharacterSeats(mi, seats, captain);
    if (characterError) throw new Error(characterError);
    var players = seats.map(function (s, pi) {
      var st = []; for (var i = 0, ns = np === 2 || (physical && np === 3 && pi === captain) ? 2 : 1; i < ns; i++) st.push([]);
      var id = physical && mi.personalCharacters && pi !== captain ? s.character || 'double-detector' : 'double-detector';
      var p = { pid: s.pid, name: s.name, bot: !!s.bot, stands: st, dd: mi.dd && id === 'double-detector' ? 1 : 0 };
      if (physical) p.character = { id: id, used: !mi.dd };
      return p;
    });
    var wires = [];
    var slots = [];
    for (var si = 0; si < 2; si++) for (var pi = 0; pi < np; pi++) { var who = (pi + captain) % np; if (players[who].stands[si]) slots.push([who, si]); }
    pool.forEach(function (v, i) {
      var sl = slots[i % slots.length];
      wires.push({ id: i, v: v, o: sl[0], s: sl[1], cut: false, info: null });
    });
    var G = {
      gid: Math.floor(rng() * 1e9).toString(36) + Date.now().toString(36), ruleset: physical ? 'physical' : 'custom', catalog: mi.catalog || mi.ruleset || 'custom', mission: mi, np: np, players: players, wires: wires,
      ymark: { n: mi.y[0], cand: Y.cand }, rmark: { n: mi.r[0], cand: Rd.cand },
      missing: missing,
      det: 0, detMax: physical ? np : Math.max(1, (np === 2 ? 3 : np + 1) + (mi.det || 0)),
      detMin: physical && mi.printedDial ? np - 5 : 0,
      equip: [], labels: [], radar: null, stab: false, pending: null, cutFlow: 'choice-v1',
      seq: [], turn: captain, captain: captain, turnNo: 0, turnLimit: null,
      phase: 'setup', setup: {}, deadline: null, paused: false, pauseRemaining: null, log: [], logSeq: 0, result: null, lastAct: null, actionId: 0, announcement: null, declaration: null, feedback: []
    };
    resort(G);
    // 装备
    var eqN = mi.eq === -1 ? np : mi.eq;
    var eqPool = [];
    for (var n = 1; n <= 12; n++) if (n >= lo && n <= hi && n !== missing) eqPool.push(n);
    if (mi.officialModule) eqPool = Campaign.equipmentNumbers(mi);
    var eqDraw = shuffle(eqPool, rng);
    G.equip = eqDraw.slice(0, Math.min(eqN, eqPool.length)).sort(function (a, b) { return a - b; })
      .map(function (n) { return { n: n, id: Campaign.equipmentIdentity(n), used: false }; });
    if (mi.officialModule) G.equipmentReserve = eqDraw.slice(G.equip.length);
    // 顺序引信
    if (R.seq) {
      var sv = shuffle(values.filter(function (v) { return v !== missing; }), rng).slice(0, R.seq);
      G.seq = sv;
    }
    Campaign.initialize(G, campaignContext(rng));
    if (physical && mi.printedDial) G.detMin = Math.min(G.det,G.detMax - 5);
    if (R.turns) G.turnLimit = Math.ceil(pool.filter(function (v) { return kindOf(v) !== 'r'; }).length / 2) + R.turns;
    // 开局信息
    var infoN = physical ? 1 : R.infoN || (np === 2 ? 2 : 1);
    G.infoN = mi.info === 'none' ? 0 : infoN;
    players.forEach(function (p, i) { G.setup[i] = 0; });
    var setupNeeds = Campaign.setupNeeds(G);
    if (setupNeeds) G.setupNeeds = setupNeeds;
    addLog(G, '任务 ' + mi.id + '「' + mi.name + '」开始。' + np + ' 名拆弹专家，' + BB.detonatorText(G) + '。');
    if (G.phase === 'constraints') {
      addLog(G, '选择限制阶段：从队长开始，每人选择一张 A–E 限制，再放初始信息标记。');
    } else if (Campaign.beginSetup(G, campaignContext(rng, opts.now))) {
      addLog(G, Campaign.setupMessage(G) || (G.phase === 'sequence' ? '队长先独立选择数字序列的一端，再开始初始标记。' : '布置阶段：从队长开始，依次摆放随机抽取的信息标记；双人队长不抽标记。'));
    } else if (BB.setupActor(G) < 0) {
      startPlay(G, opts.now);
    } else if (mi.info === 'random') {
      players.forEach(function (p, i) { for (var k = 0; k < BB.setupNeed(G, i); k++) autoInfo(G, i, rng); });
      startPlay(G, opts.now);
    } else {
      addLog(G, G.setupNeeds ? '布置阶段：从队长开始，按任务规定数量放置信息标记。' : mi.info === 'parity' ? '布置阶段：每人在自己的蓝线上放 ' + G.infoN + ' 个奇偶标记。' : '布置阶段：每人在自己的一根蓝线上放 ' + G.infoN + ' 个信息标记。');
    }
    BB.observeMemoryBots(G);
    return G;
  };

  BB.observeMemoryBots=function(G){var state=Campaign.memorySea(G);if(!state||G.phase==='won'||G.phase==='lost')return;state.botMemories=state.botMemories||{};
    G.players.forEach(function(player,pi){if(!player.bot)return;var V=BB.view(G,pi),memory=state.botMemories[pi]||{red:[],yellow:[],clues:{},layouts:[]},layout=V.players.map(function(p){return p.stands.map(function(st){return st.map(function(w){return w.id;});});});
      if(V.official.memorySea.preview){memory.red=V.rmark.cand.slice();memory.yellow=V.ymark.cand.slice();}
      Object.keys(memory.clues).forEach(function(id){var clue=memory.clues[id],before=memory.layouts[clue.owner]&&memory.layouts[clue.owner][clue.rack],after=layout[clue.owner]&&layout[clue.owner][clue.rack];if(!before||!after||JSON.stringify(before)!==JSON.stringify(after))delete memory.clues[id];});
      var point=V.official.memorySea.point;if(point)memory.clues[point.wire]={owner:point.owner,rack:point.rack,info:JSON.parse(JSON.stringify(point.info))};memory.layouts=layout;state.botMemories[pi]=memory;
    });
  };

  BB.setupNeed = function (G, pi) { return G.setupNeeds ? G.setupNeeds[pi] : G.infoN; };
  BB.setupActor = function (G) {
    for (var k = 0; k < G.np; k++) {
      var pi = ((G.captain || 0) + k) % G.np;
      if ((G.setup[pi] || 0) < BB.setupNeed(G, pi)) return pi;
    }
    return -1;
  };

  function resort(G) {
    G.players.forEach(function (p, pi) {
      p.stands = p.stands.map(function (_, si) {
        var ids=G.wires.filter(function (w) { return w.o === pi && w.s === si; }).sort(function (a, b) { return Number(Campaign.unsortedWire(G, a)) - Number(Campaign.unsortedWire(G, b)) || a.v - b.v || a.id - b.id; }).map(function(w){return w.id;});
        if(Campaign.doubleOutward(G)){var pair=Campaign.outwardIdsForOwner(G,pi);ids=ids.filter(function(id){return pair.indexOf(id)<0;});if(G.wires[pair[0]].s===si)ids.unshift(pair[0]);if(G.wires[pair[1]].s===si)ids.push(pair[1]);}return ids;
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
    var officialInfo = Campaign.infoFor(G, w);
    if (officialInfo) return officialInfo;
    if (G.mission.info === 'parity') return { t: w.v % 2 === 0 ? 'even' : 'odd' };
    return kindOf(w) === 'y' ? { t: 'Y' } : { t: 'v', v: w.v };
  }
  function infoTokenKey(info) {
    if (!info) return null;
    if (info.t === 'Y') return 'Y';
    if (info.t === 'v' || info.t === 'not' && Number.isInteger(Number(info.v)) && Number(info.v) >= 1 && Number(info.v) <= 12) return 'v:' + Number(info.v);
    return info.t + ':' + info.v;
  }
  function placeInfo(G, w, info, origin) {
    var memoryPlacement=Campaign.placeInfo(G,w,info,origin);if(memoryPlacement!==null)return memoryPlacement;
    if (G.ruleset === 'physical' && w.info && w.info.tokens && w.info.t === 'v' && info.t === 'v' && w.info.v === info.v && !info.token) return true;
    if (w.info && w.info.t === info.t && w.info.v === info.v && w.info.copies === info.copies && (!info.token || w.info.token === info.token)) return true;
    var limit = Campaign.tokenLimit(G, info);
    var key = infoTokenKey(info);
    if (limit == null && G.ruleset === 'physical' && (key === 'Y' || key.indexOf('v:') === 0)) limit = 2;
    if (limit != null) {
      var used = G.wires.filter(function (other) { return other.id !== w.id && !other.cut && other.info && infoTokenKey(other.info) === key; }).reduce(function (n, other) { return n + (other.info.copies || 1); }, 0);
      used += Campaign.reservedTokens(G, info);
      if (used + (info.copies || 1) > limit) { G.announcement = { id: w.id, info: info }; return false; }
      var old = G.wires.filter(function (other) { return other.cut && other.info && infoTokenKey(other.info) === key && (!info.token || other.info.token === info.token); })[0];
      if (old) old.info = null;
    }
    w.info = info;
    return true;
  }
  function autoInfo(G, pi, rng) {
    var cands = G.wires.filter(function (w) { return w.o === pi && !w.info && kindOf(w) === 'b'; });
    if (!cands.length) { G.setup[pi]++; return; }
    var w = cands[Math.floor((rng || Math.random)() * cands.length)];
    placeInfo(G, w, infoFor(G, w));
    G.setup[pi]++;
  }

  function startPlay(G, now) {
    G.phase = 'play';
    G.turn = G.captain;
    G.turnNo = 1;
    if (G.officialState) {
      Campaign.enterTurn(G, campaignContext());
      if (G.phase === 'lost') return;
      if(G.phase==='audio-ready'){addLog(G,'初始标记完成，等待核实后的官方音频时间轴；尚未开始拆线。');return;}
    } else for (var k = 0; k < G.np && !canAct(G, G.turn); k++) G.turn = nextPlayer(G, G.turn);
    setDeadline(G, now);
    addLog(G, Campaign.freeTurn(G)?'开始拆弹！计时已开始，等待玩家喊“我来拆线”取得回合。':'开始拆弹！由队长 ' + pname(G, G.turn) + ' 先行动。');
  }
  function setDeadline(G, now) {
    var free=Campaign.freeTurn(G);if(free){if(G.deadline==null)G.deadline=(now||Date.now())+free.duration*1000;return;}
    var t = G.mission.rules && G.mission.rules.timer;
    G.deadline = t ? (now || Date.now()) + t * 1000 : null;
  }

  function uncutOf(G, pi) { return G.wires.filter(function (w) { return w.o === pi && !w.cut; }); }
  function hasUncut(G, pi) { return uncutOf(G, pi).length > 0; }
  BB.hasValue = function (G, pi, val) { return uncutOf(G, pi).some(function (w) { return Campaign.wireVisible(G, pi, w) && matches(w, val); }); };
  function nextPlayer(G, from) {
    for (var k = 1; k <= G.np; k++) {
      var i = (from + k) % G.np;
      if (hasUncut(G, i)) return i;
    }
    return from;
  }

  function othersCuttable(G, pi) {
    return G.wires.some(function (w) { return w.o !== pi && !w.cut && kindOf(w) !== 'r'; });
  }
  function soloOk(G, pi, val) {
    if (G.mission.rules && G.mission.rules.noSolo && othersCuttable(G, pi)) return false;
    if (!seqAllowed(G, val, pi)) return false;
    var mine = uncutOf(G, pi).filter(function (w) { return matches(w, val); });
    var rest = G.wires.filter(function (w) { return !w.cut && matches(w, val); });
    if (!Campaign.soloAllowed(G, pi, mine)) return false;
    if (G.ruleset === 'physical') return val !== 'R' && (mine.length === 2 || mine.length === 4) && mine.length === rest.length;
    return mine.length > 0 && mine.length === rest.length;
  }
  BB.soloOk = soloOk;
  // 该玩家现在是否有合法行动
  function canAct(G, pi) {
    var mine = uncutOf(G, pi);
    if (!mine.length) return false;
    if(Campaign.allOutward(G)&&mine.some(function(w){return Campaign.isOutward(G,w);})&&(BB.outwardRedPossible(G,pi)||BB.outwardSoloValues(G,pi).length||G.wires.some(function(w){return w.o!==pi&&!w.cut&&Campaign.targetAllowed(G,pi,w);})))return true;
    if (mine.every(function (w) { return kindOf(w) === 'r'; })) return true;
    var others = G.wires.some(function (w) { return w.o !== pi && !w.cut && Campaign.targetAllowed(G, pi, w); });
    return mine.some(function (w) {
      var a = annOf(w);
      if (a === 'R' || !Campaign.ownWireAllowed(G, pi, w)) return false;
      return (others && seqAllowed(G, a, pi)) || soloOk(G, pi, a);
    });
  }
  BB.canAct = canAct;
  function viewWires(G) { return G.wires || G.players.reduce(function (all, p, owner) { return all.concat(p.stands.reduce(function (out, st) { return out.concat(st.map(function (w) { return Object.assign({ o: owner }, w); })); }, [])); }, []); }
  BB.outwardSoloValues = function (G, owner, selected) {
    owner=owner===undefined?G.captain:owner;var wires = viewWires(G), special = wires.filter(function (w) { return Campaign.isOutward(G, w) && !w.cut&&w.o===owner; })[0];
    if (!special) return [];
    if(Campaign.doubleOutward(G)){var allowed=Campaign.outwardIdsForOwner(G,owner).filter(function(id){return wires.some(function(w){return w.id===id&&!w.cut;});}),chosen=selected||[special.id];if(!Array.isArray(chosen)||!chosen.length||new Set(chosen).size!==chosen.length||chosen.some(function(id){return allowed.indexOf(id)<0;}))return [];return Array.from({length:12},function(_,i){return i+1;}).filter(function(value){var known=wires.filter(function(w){return w.o===owner&&!w.cut&&!Campaign.isOutward(G,w)&&matches(w,value);}).length,done=wires.filter(function(w){return w.cut&&matches(w,value);}).length,remaining=4-done;return [2,4].indexOf(remaining)>=0&&known+chosen.length===remaining;});}
    return Array.from({ length: 12 }, function (_, i) { return i + 1; }).filter(function (value) {
      var mine = wires.filter(function (w) { return w.o === owner && !w.cut && !Campaign.isOutward(G, w) && matches(w, value); }).length;
      var done = wires.filter(function (w) { return w.cut && matches(w, value); }).length;
      return mine === 3 || mine === 1 && done === 2;
    });
  };
  BB.outwardRedPossible = function (G, owner) {
    owner=owner===undefined?G.captain:owner;var wires = viewWires(G);
    return wires.some(function (w) { return w.o===owner&&Campaign.isOutward(G, w) && !w.cut; }) && wires.filter(function (w) { return w.o === owner && !w.cut && !Campaign.isOutward(G, w); }).every(function (w) { return kindOf(w) === 'r'; });
  };
  BB.outwardSkipAllowed = function (G, pi) {
    if(Campaign.allOutward(G))return false;
    if (pi === G.captain) return false;
    var wires = viewWires(G), special = wires.filter(function (w) { return Campaign.isOutward(G, w) && !w.cut; })[0];
    if (!special) return false;
    var mine = wires.filter(function (w) { return w.o === pi && !w.cut; });
    if (!mine.length || mine.every(function (w) { return kindOf(w) === 'r'; })) return false;
    return mine.filter(function (w) { return kindOf(w) === 'b'; }).every(function (w) {
      var own = mine.filter(function (x) { return matches(x, w.v); }).length, done = wires.filter(function (x) { return x.cut && matches(x, w.v); }).length;
      var outward = matches(special, w.v) ? 1 : 0;
      return !(own === 4 || own === 2 && done === 2) && 4 - done - own - outward <= 0;
    });
  };

  // 顺序引信：值 val 能否开始剪
  function seqAllowed(G, val, pi) {
    if (!Campaign.actorValueAllowed(G, pi === undefined ? G.turn : pi, val)) return false;
    var relay=Campaign.numberRelay(G);if(relay){var owner=pi===undefined?G.turn:pi;return Number.isInteger(val)&&relay.completed.indexOf(val)<0&&relay.hands[owner].some(function(card){return (typeof card==='number'?card:card.value)===val;});}
    if (G.officialState) return Campaign.allowedValue(G, val, campaignContext());
    var order=Campaign.numberOrder(G);if(order)return order.step==='cut'&&order.value===val;
    var claim=Campaign.numberClaim(G);if(claim)return claim.step==='cut'&&claim.value===val;
    if(Campaign.arithmetic(G))return Campaign.arithmeticPairs(G,val).length>0;
    if (G.official && G.official.precision && !G.official.precision.complete && val === G.official.precision.value) return false;
    if (G.official && G.official.yellowThree && val === 'Y') return false;
    if (Campaign.tripwire(G) && val === 'Y') return false;
    var ends = Campaign.numberEnds(G);
    if (ends) return ends.row.indexOf(val) < 0 || ends.end != null && val === ends.row[ends.end === 'left' ? 0 : ends.row.length - 1];
    if (!G.seq.length || val === 'Y' || val === 'R') return true;
    var idx = G.seq.indexOf(val);
    if (idx <= 0) return true;
    var prev = G.seq[idx - 1];
    return G.wires.every(function (w) { return w.v !== prev || w.cut; }) && seqAllowed(G, prev);
  }
  BB.seqAllowed = seqAllowed;

  function cutCount(G, val) { return G.wires.filter(function (w) { return w.cut && matches(w, val); }).length; }
  BB.cutCount = cutCount;
  BB.dialMin = function (G) { return Number.isFinite(G.detMin) ? G.detMin : 0; };
  BB.equipUnlocked = function (G, n) { var special = Campaign.equipUnlocked(G, n, campaignContext()); if (special != null) return special; var unlock = Campaign.unlock(n); return cutCount(G, unlock.value) >= unlock.count; };

  function campaignContext(rng, now, opts) { return { now:now||Date.now(),serverTimeout:!!(opts&&opts.serverTimeout),shuffle: shuffle, rng: rng || Math.random, cutCount: cutCount, canAct: canAct, nextPlayer: nextPlayer, log: addLog, lose: lose, placeInfo: placeInfo,
    equipmentName: function (n) { return BB.EQUIP[n].name; },
    resort: resort, cutWire: cutWire, outwardSkipAllowed: BB.outwardSkipAllowed,
    setupActor: BB.setupActor, setupNeed: BB.setupNeed, startPlay: function (G) { startPlay(G, now); }, endTurn: function (G, nextIdx) { endTurn(G, now, nextIdx); } }; }

  function cutWire(G, w) {
    w.cut = true;
    if (G.ruleset === 'physical') w.info = null;
  }
  function invalidateUniqueRacks(G,racks){G.wires.forEach(function(w){if(w.unique&&racks.some(function(r){return w.o===r.o&&w.s===r.s;}))delete w.unique;});}
  function placeGrapple(G,owner,wire,rack,now){
    invalidateUniqueRacks(G,[{o:owner,s:rack}]);
    wire.o=owner;wire.s=rack;
    G.labels=G.labels.filter(function(label){return label.a!==wire.id&&label.b!==wire.id;});
    resort(G);
    G.declaration=Object.assign({},G.declaration,{destination:{p:owner,s:rack,pos:G.players[owner].stands[rack].indexOf(wire.id)}});
    addLog(G,pname(G,owner)+' 已把抓钩取得的线放入第'+(rack+1)+'架；数值不公开。');
    // 随时装备可能拿走当前玩家最后一根线；空手座位不再等待行动。
    if(!hasUncut(G,G.turn)){G.turn=nextPlayer(G,G.turn);G.turnNo++;setDeadline(G,now);}
  }

  function checkEnd(G) {
    if (G.phase === 'won' || G.phase === 'lost') return true;
    if (G.det >= G.detMax) { lose(G, '引爆器走到了尽头……炸弹爆炸了。'); return true; }
    var left = G.wires.filter(function (w) { return !w.cut && (G.ruleset === 'physical' || kindOf(w) !== 'r'); });
    if (!left.length) {
      if (G.ruleset !== 'physical') G.wires.forEach(function (w) { if (kindOf(w) === 'r') w.cut = true; });
      G.phase = 'won'; G.deadline = null;
      G.result = { win: true, why: '所有可剪的线都已剪断，炸弹被成功拆除！' };
      addLog(G, '🎉 拆弹成功！', 'win');
      return true;
    }
    return false;
  }
  function lose(G, why) {
    G.phase = 'lost'; G.deadline = null; G.pending = null; G.paused = false; G.pauseRemaining = null;
    G.result = { win: false, why: why };
    addLog(G, '💥 ' + why, 'lose');
  }
  BB.recoverFatalState = function (G) {
    if (G.phase !== 'play') return false;
    if(Campaign.robotPressure(G)&&Campaign.robotPressure(G).position>=Campaign.robotPressure(G).limit){Campaign.robotPressure(G).position=Campaign.robotPressure(G).limit;lose(G,'机器人到达12，按本局德文原卡炸弹爆炸。');}
    else if(Number.isFinite(G.det)&&Number.isFinite(G.detMax)&&G.detMax>0&&G.det>=G.detMax)lose(G, '引爆器走到了尽头……炸弹爆炸了。');
    else if(Campaign.nanoImpossiblePair(G,canAct)){G.officialState.nano.waiting=false;lose(G,'仅剩一根蓝线，唯一同值未剪线在机器人备用堆，按发行商规则炸弹爆炸。');}
    else if(Campaign.boundConstraintDeadlock(G,canAct))lose(G,'全队无法在当前共享限制下行动，炸弹爆炸。');
    else if(Campaign.ringConstraintDeadlock(G,canAct))lose(G,'按本局德文原卡，全队无法遵守各自限制，炸弹爆炸。');
    else return false;
    if (G.ruleset === 'physical') G.feedback = G.log.slice(-1);
    return true;
  };

  function endTurn(G, now, nextIdx) {
    if (G.det >= G.detMax) { checkEnd(G); return; }
    if (Campaign.finishTurn(G, campaignContext(null, now), nextIdx)) return;
    if (checkEnd(G)) return;
    G.stab = false;
    var missionNext=Campaign.nextTurn(G,nextIdx);
    G.turn = missionNext !== undefined ? missionNext : nextIdx !== undefined ? nextIdx : nextPlayer(G, G.turn);
    G.turnNo++;
    var R = G.mission.rules || {};
    if (R.countdown && (G.turnNo - 1) % R.countdown === 0) {
      G.det++;
      addLog(G, '⏱ 引信老化：引爆器自动前进一格（' + G.det + '/' + G.detMax + '）。', 'bad');
      if (checkEnd(G)) return;
    }
    if (G.turnLimit && G.turnNo > G.turnLimit) { lose(G, '超过回合上限，时间耗尽。'); return; }
    if (G.officialState) {
      Campaign.enterTurn(G, campaignContext());
      if (G.phase === 'lost') return;
    } else for (var k = 0; k < G.np && !canAct(G, G.turn); k++) {
      if (hasUncut(G, G.turn)) addLog(G, pname(G, G.turn) + ' 手上的数值都被顺序引信锁住，本回合跳过。');
      G.turn = nextPlayer(G, G.turn);
    }
    setDeadline(G, now);
  }

  // 统一的剪线判定。targets: 线 id 数组；vals: 宣告值数组
  function attempt(G, pi, targets, vals, label, rng) {
    var ws = targets.map(function (id) { return W(G, id); });
    if (G.ruleset !== 'physical') {
      G.actionId = (G.actionId || 0) + 1;
      G.declaration = { id: G.actionId, from: pi, to: ws[0].o, ids: targets.slice(), vals: vals.slice(), label: label };
    }
    var hit = null, hv = null;
    for (var i = 0; i < ws.length && !hit; i++) {
      for (var j = 0; j < vals.length; j++) if (matches(ws[i], vals[j])) { hit = ws[i]; hv = vals[j]; break; }
    }
    var tp = ws[0].o;
    var who = pname(G, pi) + ' → ' + pname(G, tp);
    var said = vals.map(function (value) { return BB.announcementLabel(G, value); }).join(' 或 ');
    if (hit) {
      cutWire(G, hit);
      var mine = uncutOf(G, pi).filter(function (w) { return matches(w, hv); })[0];
      if (mine) cutWire(G, mine);
      addLog(G, '✂️ ' + who + '（' + label + '）宣告「' + said + '」：命中！双方各剪掉一根' + BB.valLabel(hv) + (hv === 'Y' ? '' : '') + '。', 'good');
      G.lastAct = { t: 'hit', ids: [hit.id].concat(mine ? [mine.id] : []) };
      unlockLog(G, hv);
      return true;
    }
    var reds = ws.filter(function (w) { return kindOf(w) === 'r'; });
    var safe = ws.filter(function (w) { return kindOf(w) !== 'r'; });
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
  function placeFailInfo(G, safe, vals, rng, choice) {
    var R = G.mission.rules || {};
    if (R.silent) return;
    var w = safe[Math.floor((rng || Math.random)() * safe.length)];
    if (R.fog) {
      w.info = { t: 'not', v: vals.map(String).join('/') };
    } else {
      placeInfo(G, w, Campaign.failureInfo(G, w, vals, choice) || (G.ruleset === 'physical' ? infoFor(G, w) : kindOf(w) === 'y' ? { t: 'Y' } : { t: 'v', v: w.v }), 'failure');
    }
  }
  function unlockLog(G, val) {
    if (val === 'Y') {
      if (G.equip.some(function (e) { return e.n === 13; }) && cutCount(G, 'Y') === 2 && Campaign.equipUnlocked(G, 13, campaignContext()) == null)
        addLog(G, '🔓 装备「双层底盒」已解锁！', 'good');
      return;
    }
    if (cutCount(G, val) === 2) {
      G.equip.forEach(function (e) {
        if (e.n === val && Campaign.equipUnlocked(G, e.n, campaignContext()) == null) addLog(G, '🔓 装备「' + BB.EQUIP[e.n].name + '」已解锁！', 'good');
      });
    }
    if (cutCount(G, val) === 4) addLog(G, '✅ 数值 ' + val + ' 已全部剪完。');
  }

  function physicalCard(G, n) {
    return G.equip.filter(function (e) { return e.n === n && !e.used && BB.equipUnlocked(G, n); })[0];
  }
  function beginPhysical(G, pi, ids, baseVals, label, mods, now) {
    var stand = W(G, ids[0]).s, owner = W(G, ids[0]).o;
    var usesEquipment = !!(mods.dd || mods.equip || mods.character || mods.xy || mods.xyPersonal || mods.stab || G.stab);
    if (usesEquipment && ids.some(function (id) { return !Campaign.equipmentWireAllowed(G, pi, W(G, id)); })) return '装备不能选择X导线';
    if (mods.xyPersonal && !mods.xy) return '个人 X/Y 射线必须用于双值宣告';
    if (mods.character && !characterAvailable(G, pi, mods.character)) return '你的个人能力不可用';
    if (mods.xyPersonal && (!characterAvailable(G, pi, 'xy-ray') || mods.character || mods.dd)) return '本次行动只能使用一张个人角色卡';
    if (ids.some(function (id) { return W(G, id).o !== owner || W(G, id).s !== stand; })) return '探测器必须指向同一名队友的同一排';
    if ((mods.dd || mods.equip === 3 || mods.equip === 5) && baseVals[0] === 'Y') return '探测器只能宣告蓝色数字';
    if (mods.equip === 3) {
      var left = G.players[owner].stands[stand].filter(function (id) { return !W(G, id).cut && !Campaign.isX(G, W(G, id)); }).length;
      if (ids.length !== Math.min(3, left)) return '三重探测器应指向三根线；该排只剩两根时指向两根';
    }
    var vals = baseVals.slice();
    if (mods.xy) {
      if (mods.xyPersonal ? !characterAvailable(G, pi, 'xy-ray') : !physicalCard(G, 10)) return 'X/Y 射线尚未可用';
      if (!Array.isArray(mods.vals) || mods.vals.length !== 2 || mods.vals[0] === mods.vals[1] || mods.vals[0] !== baseVals[0]) return '请选择两个不同的数值';
      var er = checkVal(G, pi, mods.vals[1]); if (er) return er;
      vals = mods.vals.slice();
      var detector = mods.dd || mods.equip === 3 || mods.equip === 5;
      if (vals.some(function (v) { return v === 'Y' ? !!detector : !Number.isInteger(v) || v < 1 || v > 12; })) return '与探测器组合时只能宣告蓝色数字';
    }
    if (mods.stab && !G.stab && !physicalCard(G, 9)) return '稳定器尚未可用';
    if (usesEquipment && vals.some(function (value) { return !uncutOf(G, pi).some(function (wire) { return matches(wire, value) && Campaign.ownWireAllowed(G, pi, wire) && Campaign.equipmentWireAllowed(G, pi, wire); }); })) return '使用装备时宣告值必须来自自己非X的未剪导线';
    if (mods.equip && !mods.character && !physicalCard(G, mods.equip)) return '探测器尚未可用';
    if (mods.dd && !characterAvailable(G, pi, 'double-detector')) return '双重探测器不可用';
    Campaign.declare(G, vals, campaignContext());
    if (mods.dd || mods.character || mods.xyPersonal) useCharacter(G, pi);
    [mods.character ? null : mods.equip, mods.xy && !mods.xyPersonal ? 10 : null, mods.stab && !G.stab ? 9 : null].forEach(function (n) { if (n) physicalCard(G, n).used = true; });
    G.actionId = (G.actionId || 0) + 1;
    G.pending = { type: 'cut', id: G.actionId, from: pi, to: owner, ids: ids.slice(), vals: vals, label: label, usesEquipment: usesEquipment, stab: !!(mods.stab || G.stab) && Campaign.stabilizerAllowed(G, pi), step: 'target' };
    addLog(G, '✂️ ' + pname(G, pi) + ' 向 ' + pname(G, owner) + ' 的一排线宣告「' + vals.map(function (value) { return BB.announcementLabel(G, value); }).join(' 或 ') + '」。');
    return null;
  }
  function finishPhysical(G, pd, hit, clue, now, rng) {
    G.pending = null;
    var who = pname(G, pd.from) + ' → ' + pname(G, pd.target);
    G.declaration = {
      id: pd.id, from: pd.from, to: pd.target, ids: pd.ids.slice(),
      vals: pd.vals.slice(), label: pd.label,
      result: { matched: !!hit, wire: hit ? pd.hit : null }
    };
    if (pd.outwardIntent&&!hit||pd.outwardOwn != null && (!hit || !matches(W(G, pd.outwardOwn), pd.hitVal))) {
      G.declaration.result.targetMatched = !!hit; G.declaration.result.outwardFailed = true;
      G.declaration.result.matched = false; G.lastAct = { t: 'boom', ids: pd.ids.concat(pd.outwardOwn==null?[]:[pd.outwardOwn]) };
      lose(G, pname(G,pd.from)+' 的朝外导线盲猜拆线失败，炸弹立即爆炸。'); return;
    }
    if (hit) {
      cutWire(G, W(G, pd.hit)); cutWire(G, W(G, pd.own));
      G.lastAct = { t: 'hit', ids: [pd.hit, pd.own] };
      addLog(G, '✂️ ' + who + ' 成功剪断两根 ' + BB.announcementLabel(G, pd.hitVal) + '。', 'good');
      unlockLog(G, pd.hitVal);
      if (Campaign.afterCut(G, campaignContext(rng, now))) return;
    } else {
      var failureReason = Campaign.cutFailureReason(G, pd.from);
      if (failureReason) { G.lastAct = { t: 'boom', ids: pd.ids.slice() }; lose(G, failureReason); return; }
      var safe = pd.ids.filter(function (id) { return kindOf(W(G, id)) !== 'r'; });
      G.lastAct = { t: 'miss', ids: pd.ids.slice() };
      if (!safe.length && !pd.stab) { G.pending = null; lose(G, who + ' 剪到了红线！炸弹爆炸了。'); return; }
      if (!pd.stab) G.det += Campaign.failureSteps(G, pd.from);
      if (G.det >= G.detMax) { lose(G, '引爆器走到了尽头……炸弹爆炸了。'); return; }
      if (!Campaign.suppressFailureClue(G, pd.from, pd.target) && clue != null && safe.indexOf(clue) >= 0) placeFailInfo(G, [W(G, clue)], pd.vals, null, pd.clueVal);
      addLog(G, '❌ ' + who + ' 没有命中。' + (Campaign.failureMessage(G,pd.from)||(pd.stab ? '稳定器保护了引爆器。' : '引爆器前进 ' + Campaign.failureSteps(G, pd.from) + ' 格。')), 'bad');
    }
    endTurn(G, now);
  }
  function physicalOwnChoices(G, pi, pd) {
    if(pd.outwardIntent)return Campaign.outwardIdsForOwner(G,pi).filter(function(id){return !W(G,id).cut;});
    if (pd.outwardOwn != null) return [pd.outwardOwn];
    var ids = uncutOf(G, pi).filter(function (w) { return matches(w, pd.hitVal) && Campaign.ownWireAllowed(G, pi, w) && (!pd.usesEquipment || Campaign.equipmentWireAllowed(G, pi, w)); }).map(function (w) { return w.id; });
    if(!pd.usesEquipment)Campaign.outwardIdsForOwner(G,pi).forEach(function(id){if(!W(G,id).cut)ids.push(id);});
    return ids;
  }
  function resolvePhysical(G, pi, a, now, rng) {
    var pd = G.pending;
    if (!pd || pd.type !== 'cut' || pd.to !== pi || a.id !== pd.id) return '这次选择已经失效';
    if (pd.step === 'target') {
      var hits = pd.ids.filter(function (id) { return pd.vals.some(function (v) { return matches(W(G, id), v); }); });
      if (hits.length) {
        if (hits.indexOf(a.w) < 0) return '请选择命中的目标线';
        pd.hit = a.w; pd.hitVal = pd.vals.filter(function (v) { return matches(W(G, a.w), v); })[0];
        pd.target = pi; pd.to = pd.from; pd.step = 'own';
        return null;
      }
      var safe = pd.ids.filter(function (id) { return kindOf(W(G, id)) !== 'r'; });
      var noClue = Campaign.suppressFailureClue(G, pd.from, pi);
      if (safe.length && !noClue && safe.indexOf(a.w) < 0) return '请选择一根安全的目标线放置信息';
      if ((!safe.length || noClue) && a.w !== null) return '没有可标记的安全线';
      var clueValues = safe.length && !noClue && Campaign.failureClueValues(G, pi, pd.vals);
      if (clueValues) {
        var clueVal = a.clueVal == null && clueValues.length === 1 ? clueValues[0] : a.clueVal;
        if (clueValues.indexOf(clueVal) < 0) return '请选择一个本次宣告的数值作为错误标记';
        pd.clueVal = clueVal;
      }
      pd.target = pi;
      finishPhysical(G, pd, false, a.w, now, rng);
      return null;
    }
    if (pd.step === 'own') {
      var own = physicalOwnChoices(G, pi, pd);
      if (own.indexOf(a.w) < 0) return '请选择你自己匹配的线';
      pd.own = a.w;
      if (Campaign.isOutward(G, W(G, a.w))) pd.outwardOwn = a.w;
      finishPhysical(G, pd, true, null, now, rng);
      return null;
    }
    return '无效的选择';
  }

  /* ---------- 动作 ---------- */
  function outwardAction(G, pi, a, now, rng) {
    if (Campaign.outwardId(G) == null || G.phase !== 'play' || G.pending || G.turn !== pi) return '尚未轮到你，或现在不能操作朝外导线';
    if (a.a === 'outward-skip') {
      if (!BB.outwardSkipAllowed(G, pi) || a.stab || a.xy || a.xyPersonal || a.equip || a.dd || a.character) return '只有没有其他合法拆线时才须跳过；不能用装备保护此次跳过';
      G.det++; addLog(G, pname(G, pi) + ' 只能与队长朝外线配对，跳过回合，引爆器前进一格。'); endTurn(G, now); return null;
    }
    var ownOutward=a.own===undefined?Campaign.outwardId(G,pi):a.own;if(Campaign.outwardIdsForOwner(G,pi).indexOf(ownOutward)<0)return '只能主动处理自己的朝外导线';var special = W(G, ownOutward);
    if (special.o!==pi || special.cut) return '只能主动处理自己尚未拆除的朝外导线';
    if (a.stab || a.xy || a.xyPersonal || a.equip || a.dd || a.character) return '朝外导线不能组合共享装备、个人能力或稳定器';
    if (a.a === 'outward-red') {
      if (!BB.outwardRedPossible(G,pi)) return '请先处理自己其余非红导线，再宣告朝外线为红色';
      G.stab = false;
      addLog(G, pname(G, pi) + ' 宣告朝外导线为红色，并公开剩余红线。');
      if (uncutOf(G,pi).some(function(w){return kindOf(w)!=='r';})) { lose(G, Campaign.allOutward(G)?pname(G,pi)+' 的朝外导线并非全是红色，宣告错误，炸弹爆炸。':'朝外导线并非红色，队长的宣告错误，炸弹爆炸。'); return null; }
      var reds = uncutOf(G, pi); reds.forEach(function (w) { w.cut = true; }); G.lastAct = { t: 'hit', ids: reds.map(function (w) { return w.id; }) }; endTurn(G, now); return null;
    }
    if (!Number.isInteger(a.val) || a.val < 1 || a.val > 12) return '盲猜只能宣告蓝色数字1–12';
    if (a.a === 'outward-dual') {
      var err = checkTargets(G, pi, [a.w], true); if (err) return err;
      G.stab = false;
      err = beginPhysical(G, pi, [a.w], [a.val], '朝外导线双人拆线', {}, now); if (err) return err;
      if(Campaign.doubleOutward(G)){G.pending.outwardIntent=true;G.pending.preferredOwn=special.id;}else G.pending.outwardOwn = special.id;return null;
    }
    if (a.a !== 'outward-solo') return '未知的朝外导线动作';
    var chosen=Campaign.doubleOutward(G)?a.outs||[ownOutward]:undefined;
    if (BB.outwardSoloValues(G,pi,chosen).indexOf(a.val) < 0) return '朝外单拆必须符合两根或四根组合，请选择要盲猜的朝外线';
    G.stab = false;
    addLog(G, pname(G, pi) + ' 宣告朝外导线为「' + a.val + '」，进行单人拆线。');
    if ((chosen||[special.id]).some(function(id){return !matches(W(G,id),a.val);})){lose(G,'朝外导线单人拆线猜错，炸弹立即爆炸。');return null;}
    var group = uncutOf(G, pi).filter(function (w) { return matches(w, a.val); }); group.forEach(function (w) { cutWire(G, w); });
    G.lastAct = { t: 'hit', ids: group.map(function (w) { return w.id; }) }; unlockLog(G, a.val); endTurn(G, now); return null;
  }
  // 返回 null 表示成功；返回字符串为错误信息
  function actMutable(G, pi, a, opts) {
    opts = opts || {};
    var now = opts.now || Date.now();
    var rng = opts.rng || Math.random;
    if (G.phase === 'won' || G.phase === 'lost') return '游戏已经结束';
    var P = G.players[pi];
    if (!P) return '你不在这局游戏中';
    if(a.a==='audio-ready'){var prep=G.audioPreparation;if(G.phase!=='audio-ready'||!prep||prep.version!==1||prep.gid!==G.gid||a.id!==prep.id||a.sha256!==prep.definition.asset.sha256||typeof a.ready!=='boolean')return '音频就绪确认已过期或版本不匹配';if(prep.ready[pi]!==a.ready){prep.ready[pi]=a.ready;prep.revision++;}return null;}
    var moduleError = Campaign.validateAction(G, pi, a, campaignContext(rng, now));
    if (moduleError) return moduleError;
    var handled = Campaign.handleAction(G, pi, a, campaignContext(rng, now, opts));
    if (handled) return handled.error;
    if (['outward-dual', 'outward-solo', 'outward-red', 'outward-skip'].indexOf(a.a) >= 0) return outwardAction(G, pi, a, now, rng);

    if (a.a === 'info') {
      if (G.phase !== 'setup') return '现在不是布置阶段';
      if (G.ruleset === 'physical') {
        if (pi !== BB.setupActor(G)) return '请按队长开始的顺序布置信息标记';
      }
      if (G.setup[pi] >= BB.setupNeed(G, pi)) return '你已经放好了信息标记';
      var w = W(G, a.w);
      if (!w || w.o !== pi) return '只能放在你自己的线上';
      if (!BB.setupInfoAllowed(G, w)) return '这根导线不能放初始信息标记';
      if (w.info) return '这根线已经有标记了';
      placeInfo(G, w, infoFor(G, w), 'initial');
      G.setup[pi]++;
      addLog(G, P.name + ' 放置了一个开局信息标记。');
      var done = BB.setupActor(G) < 0;
      if (done) startPlay(G, now);
      return null;
    }

    if (G.phase !== 'play') return '现在不能行动';

    if(a.a==='grapple-rack'){
      var gp=G.pending;
      if(!gp||gp.type!=='grapple'||gp.to!==pi||gp.id!==a.id||!Number.isInteger(a.rack)||!P.stands[a.rack])return '抓钩放架选择已过期或尚未轮到你';
      var gw=W(G,gp.wire);if(!gw||gw.o!==pi||gw.s!==-1||gw.cut)return '暂存导线状态无效';
      G.pending=null;placeGrapple(G,pi,gw,a.rack,now);return null;
    }

    // 待处理：对讲机响应
    if (a.a === 'walkie') {
      var pd = G.pending;
      if (!pd || pd.type !== 'walkie' || pd.to !== pi) return '没有等待你的交换';
      if (G.ruleset === 'physical' && a.id !== pd.id) return '这次交换选择已经失效';
      var mw = W(G, a.w);
      if (!mw || mw.o !== pi || mw.cut) return '请选择你自己未剪的线';
      var fw = W(G, pd.wire);
      var fs = fw.s, ms = mw.s;
      invalidateUniqueRacks(G,[{o:fw.o,s:fs},{o:mw.o,s:ms}]);
      fw.o = pi; fw.s = ms; mw.o = pd.from; mw.s = fs;
      if (G.ruleset !== 'physical' || Campaign.frequencyClues(G)) { fw.info = null; mw.info = null; }
      G.labels = G.labels.filter(function (l) { return [fw.id, mw.id].indexOf(l.a) < 0 && [fw.id, mw.id].indexOf(l.b) < 0; });
      resort(G);
      G.pending = null;
      addLog(G, '📻 ' + pname(G, pd.from) + ' 与 ' + P.name + ' 用对讲机交换了一根线。');
      return null;
    }
    if (a.a === 'resolve' && BB.usesCutChoices(G)) return resolvePhysical(G, pi, a, now, rng);
    if (G.pending) return '正在等待 ' + pname(G, G.pending.to) + (G.pending.type === 'cut' ? ' 回应拆线' : ' 选择交换的线');

    if (a.a === 'equip' || a.a === 'character') return useEquip(G, pi, a, now, rng);

    if (a.a === 'timeout') {
      if (G.ruleset === 'physical' && (pi !== G.turn || !G.deadline || now < G.deadline || !opts.serverTimeout)) return '尚未到服务端判定的超时';
      G.det++;
      addLog(G, '⌛ ' + P.name + ' 超时！引爆器前进一格（' + G.det + '/' + G.detMax + '）。', 'bad');
      endTurn(G, now);
      return null;
    }

    if (BB.turnActor(G) !== pi) return '还没轮到你';

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
      if (BB.usesCutChoices(G)) return beginPhysical(G, pi, ids, [a.val], a.a === 'dd' ? '双重探测器' : '双人拆线', { dd: a.a === 'dd', xy: !!a.xy, xyPersonal: !!a.xyPersonal, vals: a.vals, stab: !!a.stab }, now);
      if (a.a === 'dd') P.dd = 0;
      attempt(G, pi, ids, [a.val], a.a === 'dd' ? '双重探测器' : '双人剪', rng);
      endTurn(G, now);
      return null;
    }
    if (a.a === 'solo') {
      var val = a.val;
      if (G.mission.rules && G.mission.rules.noSolo && othersCuttable(G, pi)) return '本关禁止单人剪';
      if (!seqAllowed(G, val, pi)) return (Campaign.constraint(G, pi) ? '本关限制：还不能剪 ' : '顺序引信：还不能剪 ') + BB.valLabel(val);
      if (!soloOk(G, pi, val)) return '单人剪需要你持有该数值所有剩余的线';
      var mineV = uncutOf(G, pi).filter(function (w) { return matches(w, val); });
      Campaign.declare(G, [val], campaignContext());
      mineV.forEach(function (w) { cutWire(G, w); });
      addLog(G, '✂️ ' + P.name + ' 单人剪：剪掉了自己全部 ' + mineV.length + ' 根' + BB.valLabel(val) + '。', 'good');
      G.lastAct = { t: 'hit', ids: mineV.map(function (w) { return w.id; }) };
      unlockLog(G, val);
      if (Campaign.afterCut(G, campaignContext(rng, now))) return null;
      endTurn(G, now);
      return null;
    }
    if (a.a === 'red') {
      var mine = uncutOf(G, pi);
      if (!mine.length || mine.some(function (w) { return kindOf(w) !== 'r'; })) return '只有当你剩下的全是红线时才能公开';
      mine.forEach(function (w) { w.cut = true; });
      addLog(G, '🟥 ' + P.name + ' 公开了自己剩下的 ' + mine.length + ' 根红线。', 'warn');
      G.lastAct = { t: 'hit', ids: mine.map(function (w) { return w.id; }) };
      endTurn(G, now);
      return null;
    }
    return '未知动作';
  }
  BB.act = function (G, pi, a, opts) {
    if (G.paused) return '牌局已暂停';
    if(G.audioClock&&G.phase==='play'&&(G.audioClock.cutHeld||Audio.due(G.audioClock,opts&&Number.isFinite(opts.now)?opts.now:Date.now())))return '请先收听并同步服务器音频指令';
    var before = JSON.parse(JSON.stringify(G));
    var announcement = G.announcement, radar = G.radar, lastAct = G.lastAct;
    var declaration = G.declaration;
    var logSeq = G.logSeq;
    var err;
    try { err = actMutable(G, pi, a, opts); }
    catch (_) { err = '动作参数无效'; }
    if (err) {
      Object.keys(G).forEach(function (k) { delete G[k]; });
      Object.assign(G, before);
      return err;
    }
    if (G.phase === 'play' && !G.pending && G.officialState && ['number-cycle', 'number-ends', 'tripwire', 'nano-robot', 'shared-captain-constraints', 'shared-completion-constraints','number-bound-constraints','robot-number-route','rotating-personal-constraints','passing-oxygen'].indexOf(G.officialState.module) >= 0 && (a.a === 'equip' || a.a === 'character' || a.a === 'walkie'||a.a==='grapple-rack'))
      Campaign.enterTurn(G, campaignContext(opts && opts.rng));
    if (G.announcement === announcement) G.announcement = null;
    if (G.declaration === declaration) G.declaration = null;
    if (G.ruleset === 'physical') {
      if (G.radar === radar) G.radar = null;
      if (G.lastAct === lastAct) G.lastAct = null;
      G.feedback = G.log.filter(function (entry) { return entry.n > logSeq; }).slice(-2);
    }
    BB.observeMemoryBots(G);
    if(G.audioClock&&(G.phase==='won'||G.phase==='lost'))Audio.stop(G.audioClock,opts&&Number.isFinite(opts.now)?opts.now:Date.now());
    return null;
  };
  BB.prepareAudio=function(G,definition,opts){
    if(!opts||opts.serverAudio!==true)return '客户端不能登记音频清单';
    if(G.ruleset!=='physical'||G.phase!=='audio-ready'||G.paused||G.pending||G.audioClock||G.audioPreparation)return '请先完成官方音频任务布置，不能重复登记';
    var err=Audio.validate(definition,G.mission.id,G.mission.contentVersion);if(err)return err;
    G.audioPreparation={version:1,gid:G.gid,id:'audio-'+(++G.actionId),definition:JSON.parse(JSON.stringify(definition)),ready:G.players.map(p=>!!p.bot),revision:1};return null;
  };
  BB.invalidateAudioReady=function(G,pi){var prep=G.audioPreparation;if(!prep||prep.version!==1||prep.gid!==G.gid||G.phase!=='audio-ready'||!Array.isArray(prep.ready)||!prep.ready[pi]||!G.players[pi]||G.players[pi].bot)return false;prep.ready[pi]=false;prep.revision++;return true;};
  BB.initializeAudio=function(G,definition,opts){
    if(!opts||opts.serverAudio!==true)return '客户端不能建立音频时间轴';
    if(G.ruleset!=='physical'||G.phase!=='audio-ready'||G.paused||G.pending||G.audioClock)return '请先完成官方音频任务的布置，不能重复启动';
    var err=Audio.validate(definition,G.mission.id,G.mission.contentVersion);if(err)return err;
    var prep=G.audioPreparation;if(prep&&(!prep.ready.every(Boolean)||JSON.stringify(prep.definition)!==JSON.stringify(definition)))return '请等待所有玩家就绪，使用同一份核实清单';
    var clock;try{clock=Audio.create(G.gid,definition,Number.isFinite(opts.now)?opts.now:Date.now());}catch(e){return e.message;}
    if(prep)clock.revision=prep.revision+1;G.audioClock=clock;G.phase='play';G.deadline=null;
    var submarine=Campaign.submarine54(G);if(submarine)submarine.audioReady=true;
    addLog(G,'服务器已启动核实过的音频时间轴。');return null;
  };
  BB.advanceAudio=function(G,opts){
    if(!opts||opts.serverAudio!==true)return {error:'客户端不能推进音频指令'};
    if(!G.audioClock||G.audioClock.gid!==G.gid||G.audioClock.version!==1)return {error:'本局没有可恢复的音频时钟'};
    var now=Number.isFinite(opts.now)?opts.now:Date.now();if(G.paused)return {error:null,changed:false};
    if(G.phase==='won'||G.phase==='lost')return {error:null,changed:Audio.stop(G.audioClock,now)};
    var before=JSON.parse(JSON.stringify(G)),seq=G.logSeq;
    var result=Audio.advance(G.audioClock,now,function(cue){if(cue.type==='fail')lose(G,cue.text||'官方录音宣布时间耗尽，炸弹爆炸。');else addLog(G,cue.text||(cue.type==='hold'?'请停止操作，收听录音指令。':'录音指令结束，可以继续行动。'));return null;});
    if(result.error){Object.keys(G).forEach(k=>delete G[k]);Object.assign(G,before);return result;}
    if(result.changed)G.feedback=G.log.filter(entry=>entry.n>seq).slice(-2);return result;
  };

  // 内部事件接口；联机入口不把客户端事件或时间传入此方法。正式时间轴仍未启用。
  BB.applySubmarineEvent=function(G,event,opts){if(!opts||opts.serverAudio!==true)return '客户端不能触发音频事件';var before=JSON.parse(JSON.stringify(G)),seq=G.logSeq,result;try{result=Campaign.applySubmarineEvent(G,event,campaignContext());}catch(_){result={error:'音频事件参数无效'};}if(result.error){Object.keys(G).forEach(function(key){delete G[key];});Object.assign(G,before);return result.error;}if(!result.duplicate)G.feedback=G.log.filter(function(entry){return entry.n>seq;}).slice(-2);return null;};
  // 即时效果的内部结算组件；未核实的自动触发时机不会由客户端选择。
  BB.applyEquipmentEffect=function(G,event,opts){
    if(!opts||opts.serverEquipment!==true)return '客户端不能触发内部装备效果';
    if(!event||event.gid!==G.gid||[15,17].indexOf(event.n)<0)return '装备效果身份无效';
    if(G.ruleset!=='physical'||G.phase!=='play'||G.paused||G.pending||G.det>=G.detMax)return '当前不能结算即时装备效果';
    var box=G.equip.find(function(e){return e.n===event.n;}),generation=event.generation===undefined?0:event.generation;
    if(!box||box.hidden||!Number.isInteger(generation)||generation<0)return '装备身份或使用批次无效';
    if(event.n===17&&event.edition!=='fr')return '分解器仅实现明确法文版效果；其他版别尚待核实';
    var previous=(G.equipmentEffects||[]).find(function(e){return e.n===event.n&&e.generation===generation;});
    if(previous)return previous.edition===(event.n===17?event.edition:null)?null:'旧装备事件内容不一致';
    if(generation!==(box.effectGeneration||0))return '此装备使用批次已经失效';
    if(box.used)return null;
    if(!BB.equipUnlocked(G,event.n))return '即时装备还未解锁';
    if(event.n===17&&!Campaign.equipmentEffectsSupported(G))return '此任务的批量装备效果例外尚未实现，当前不绕过';
    var tokens=event.n===17?Campaign.availableInfoTokens(G,false):null;if(tokens&&!tokens.length)return '没有可抽取的蓝色数字信息标记';
    var before=JSON.parse(JSON.stringify(G)),seq=G.logSeq;
    try{
      G.announcement=null;G.radar=null;G.declaration=null;G.lastAct=null;
      if(event.n===15){var restored=G.equip.filter(function(e){return e.n!==15&&e.used;});restored.forEach(function(e){e.used=false;e.effectGeneration=(e.effectGeneration||0)+1;});box.used=true;
        G.equipmentEffects=G.equipmentEffects||[];G.equipmentEffects.push({n:15,generation:generation,edition:null});
        addLog(G,'应急储备箱已恢复此前用过的共享装备'+(restored.length?'：'+restored.filter(function(e){return !e.hidden;}).map(function(e){return BB.EQUIP[e.n]?BB.EQUIP[e.n].name:'装备 '+BB.equipmentLabel(e.n);}).join('、'):'；没有其他已用共享装备')+'。角色卡保持原状态。','good');
      }else{
        var random=(opts.rng||Math.random)();if(!Number.isFinite(random)||random<0||random>=1)throw Error('随机源无效');var token=tokens[Math.floor(random*tokens.length)],targets=G.wires.filter(function(w){return !w.cut&&kindOf(w)==='b'&&w.v===token.value;});
        targets.forEach(function(w){cutWire(G,w);});box.used=true;G.actionId++;
        G.declaration={type:'disintegrator',id:G.actionId,from:G.turn,to:G.turn,ids:targets.map(function(w){return w.id;}),vals:[token.value],label:'分解器',token:{id:token.id,value:token.value}};
        G.lastAct={t:'hit',ids:targets.map(function(w){return w.id;})};G.equipmentEffects=G.equipmentEffects||[];G.equipmentEffects.push({n:17,generation:generation,edition:'fr',token:token.id,value:token.value,ids:targets.map(function(w){return w.id;})});
        addLog(G,'分解器抽到蓝色 '+token.value+(targets.length?'，同时剪掉全队该值剩余 '+targets.length+' 根蓝线。':'；没有同值未剪蓝线，本次不剪线，也不重新抽取。'),'good');if(targets.length)unlockLog(G,token.value);
        var error=Campaign.afterEquipmentEffect(G,{n:17,value:token.value,ids:targets.map(function(w){return w.id;})},campaignContext(opts.rng));if(error)throw Error(error);
        if(!checkEnd(G)&&!hasUncut(G,G.turn)){G.stab=false;G.turn=nextPlayer(G,G.turn);G.turnNo++;setDeadline(G);}
      }
      G.feedback=G.log.filter(function(e){return e.n>seq;}).slice(-2);return null;
    }catch(error){Object.keys(G).forEach(function(key){delete G[key];});Object.assign(G,before);return error.message||'内部装备效果无效';}
  };

  BB.setPaused = function (G, paused, now) {
    if (typeof paused !== 'boolean') return '暂停状态无效';
    if (G.paused === paused) return null;
    if (G.phase !== 'audio-ready' && G.phase !== 'memory-preview' && G.phase !== 'constraints' && G.phase !== 'sequence' && G.phase !== 'setup' && G.phase !== 'play') return '当前阶段不能暂停';
    now = Number.isFinite(now) ? now : Date.now();
    if(G.audioClock){if(paused)Audio.pause(G.audioClock,now);else Audio.resume(G.audioClock,now);}
    if (paused) {
      G.pauseRemaining = G.deadline ? Math.max(0, G.deadline - now) : null;
      G.deadline = null;
      G.paused = true;
    } else {
      G.deadline = G.pauseRemaining == null ? null : now + G.pauseRemaining;
      G.pauseRemaining = null;
      G.paused = false;
    }
    return null;
  };

  function checkTargets(G, pi, ids, sameOwner) {
    var owner = null;
    for (var i = 0; i < ids.length; i++) {
      var w = W(G, ids[i]);
      if (!w || w.cut) return '目标线不存在或已被剪断';
      if (w.o === pi) return '不能指向你自己的线';
      if (!Campaign.targetAllowed(G, pi, w)) return '当前限制不能选择这根目标线';
      if (owner === null) owner = w.o;
      else if (sameOwner && w.o !== owner) return '所有目标线必须属于同一名队友';
    }
    return null;
  }
  function checkVal(G, pi, val) {
    if(Campaign.outwardId(G,pi)!=null&&!uncutOf(G,pi).some(function(w){return !Campaign.isOutward(G,w)&&matches(w,val);}))return '普通宣告只能使用本人可见的未剪值；猜朝外线请使用盲拆';
    if (val === 'R') return '不能宣告红色';
    if (!BB.hasValue(G, pi, val)) return '你必须持有自己宣告的数值';
    if (!seqAllowed(G, val, pi)) return (Campaign.constraint(G, pi) ? '本关限制：现在还不能剪 ' : '顺序引信：现在还不能剪 ') + BB.valLabel(val);
    return null;
  }

  function useEquip(G, pi, a, now, rng) {
    var personal = a.a === 'character';
    var state = BB.characterState(G.players[pi]), role = BB.CHARACTERS[state.id];
    if (personal && (!G.players[pi].character || !role || !role.equipment || state.used)) return '你的个人能力不可用';
    if (personal && a.n !== undefined && a.n !== role.equipment) return '个人能力与所选角色不符';
    var e = personal ? { n: role.equipment, used: false } : G.equip.filter(function (x) { return x.n === a.n; })[0];
    if (!e) return '本局没有这张装备';
    if (e.used) return '这张装备已经用过了';
    if (!personal && !BB.equipUnlocked(G, e.n)) { var unlock = Campaign.unlock(e.n); return '装备还没解锁（需要先剪掉 ' + unlock.count + ' 根 ' + BB.valLabel(unlock.value) + '）'; }
    var def = BB.EQUIP[e.n];
    if (!def) return '该装备尚未实现，任务未开放官方版本';
    if(def.activationPending)return '此即时装备的自动触发时机尚未核实，不能由客户端选择使用';
    if ((!def.any || (G.ruleset !== 'physical' && e.n === 2)) && (BB.turnActor(G) !== pi || !Campaign.ownTurnAllowed(G,pi))) return '这张装备只能在你自己的回合使用';
    if ((a.xy || a.xyPersonal || a.stab) && [3, 5, 10].indexOf(e.n) < 0) return '修饰卡只能用于双人拆线';
    var P = G.players[pi];
    var nm = '「' + def.name + '」' + (personal ? '（个人能力）' : '');
    switch (e.n) {
      case 1: case 12: {
        var w1 = W(G, a.w1), w2 = W(G, a.w2);
        if (!w1 || !w2 || w1.o !== pi || w2.o !== pi || (G.ruleset === 'physical' ? w1.cut && w2.cut : w1.cut || w2.cut)) return '请选择你自己相邻的线（标签允许其中一根已剪）';
        var st = P.stands[w1.s];
        if (w1.s !== w2.s || Math.abs(st.indexOf(w1.id) - st.indexOf(w2.id)) !== 1) return '两根线必须相邻';
        var same = annOf(w1) === annOf(w2);
        if (e.n === 1 && same) return '这两根线数值相同，不能放「≠」';
        if (e.n === 12 && !same) return '这两根线数值不同，不能放「=」';
        var labelType=e.n===1?'ne':'eq';
        if(G.ruleset==='physical')G.labels=G.labels.filter(function(label){return label.t!==labelType;});
        G.labels.push({ a: w1.id, b: w2.id, t: labelType });
        addLog(G, '🏷 ' + P.name + ' 使用了' + nm + '。');
        break;
      }
      case 2: {
        var w = W(G, a.w);
        if (!w || w.o !== pi || w.cut) return '请选择你自己一根未剪的线';
        if (a.p === pi || !G.players[a.p] || !hasUncut(G, a.p)) return '请选择一名还有线的队友';
        if (!G.wires.some(function (wire) { return wire.o === a.p && !wire.cut && Campaign.equipmentWireAllowed(G, a.p, wire); })) return '队友没有可合法交换的导线';
        if (G.ruleset === 'physical') G.actionId = (G.actionId || 0) + 1;
        G.pending = { type: 'walkie', id: G.ruleset === 'physical' ? G.actionId : null, from: pi, to: a.p, wire: w.id };
        addLog(G, '📻 ' + P.name + ' 使用了' + nm + '，等待 ' + pname(G, a.p) + ' 选择要交换的线。');
        break;
      }
      case 3: case 5: {
        var ids;
        if (e.n === 3) {
          ids = a.ws || [];
          if ((BB.usesCutChoices(G) ? ids.length < 2 || ids.length > 3 : ids.length !== 3) || new Set(ids).size !== ids.length) return '三重探测器需要选择同一名队友的 3 根线';
        } else {
          var tp = G.players[a.p];
          if (!tp || a.p === pi || !tp.stands[a.s]) return '请选择一名队友的一排线';
          ids = tp.stands[a.s].filter(function (id) { return !W(G, id).cut && Campaign.equipmentWireAllowed(G, pi, W(G, id)); });
          if (!ids.length) return '这一排已经没有线了';
        }
        var er = checkTargets(G, pi, ids, true); if (er) return er;
        var ev = checkVal(G, pi, a.val); if (ev) return ev;
        if (BB.usesCutChoices(G)) return beginPhysical(G, pi, ids, [a.val], def.name, { equip: e.n, character: personal ? state.id : null, xy: !!a.xy, xyPersonal: !!a.xyPersonal, vals: a.vals, stab: !!a.stab }, now);
        e.used = true;
        attempt(G, pi, ids, [a.val], def.name, rng);
        endTurn(G, now);
        return null;
      }
      case 4: {
        var pw = W(G, a.w);
        if (!pw || pw.o !== pi || (pw.cut && !Campaign.cutClueAllowed(G)) || kindOf(pw) !== 'b' || pw.info) return '请选择你自己一根没有标记的蓝线';
        placeInfo(G, pw, G.ruleset === 'physical' ? infoFor(G, pw) : { t: 'v', v: pw.v });
        addLog(G, '📝 ' + P.name + ' 使用了' + nm + '。');
        break;
      }
      case 6:
        if (G.det <= BB.dialMin(G)) return '引爆器已经在最早时间格';
        G.det--;
        addLog(G, '⏪ ' + P.name + ' 使用了' + nm + '，引爆器后退一格，还剩 ' + (G.detMax - G.det) + ' 格引爆。', 'good');
        break;
      case 7: {
        var used = G.players.map(function (p, i) { return i; }).filter(function (i) { var card = BB.characterState(G.players[i]); return G.mission.dd && card.used && !card.removed; });
        if (!used.length) return '没有人的角色卡需要充电';
        var selected = G.ruleset === 'physical' ? a.players : used.slice(0, 2);
        if (!Array.isArray(selected) || selected.length < 1 || selected.length > 2 || new Set(selected).size !== selected.length || selected.some(function (i) { return used.indexOf(i) < 0; })) return '请选择一或两张已用角色卡';
        selected.forEach(function (i) { var p = G.players[i]; if (BB.characterState(p).id === 'double-detector') p.dd = 1; if (p.character) p.character.used = false; });
        addLog(G, '🔋 ' + P.name + ' 使用了' + nm + '：' + selected.map(function (i) { return pname(G, i); }).join('、') + ' 的个人能力重新可用。', 'good');
        break;
      }
      case 8: {
        var val = a.val;
        if (G.ruleset === 'physical' ? !(Number.isInteger(val) && val >= 1 && val <= 12) : val !== 'Y' && !(val >= 1 && val <= 12)) return '请选择蓝色数字 1–12';
        var res = G.ruleset === 'physical' ? G.players.map(function (p, i) { return p.stands.map(function (st) { return st.some(function (id) { var w = W(G, id); return !w.cut && matches(w, val) && Campaign.equipmentWireAllowed(G, pi, w); }); }); }) : G.players.map(function (p, i) { return BB.hasValue(G, i, val); });
        G.radar = { val: val, res: res };
        addLog(G, '📡 ' + P.name + ' 使用' + nm + '查询「' + BB.announcementLabel(G, val) + '」：' +
          G.players.map(function (p, i) { return p.name + (Array.isArray(res[i]) ? res[i].map(function (yes, si) { return '第' + (si + 1) + '排' + (yes ? '有' : '无'); }).join('、') : res[i] ? ' 有' : ' 没有'); }).join('，') + '。');
        break;
      }
      case 9:
        if (!Campaign.stabilizerAllowed(G, pi)) return '当前角色或任务不能使用稳定器保护此次拆线';
        G.stab = true;
        addLog(G, '🛡 ' + P.name + ' 启动了' + nm + '。');
        break;
      case 10: {
        if (G.ruleset === 'physical') {
          if (!personal) return 'X/Y 射线请在双人拆线时作为修饰卡使用';
          if (!a.vals || a.vals.length !== 2) return '请选择两个不同的数值';
          var error = checkTargets(G, pi, [a.w], true) || checkVal(G, pi, a.vals[0]);
          if (error) return error;
          return beginPhysical(G, pi, [a.w], [a.vals[0]], '个人 X/Y 射线', { xy: true, xyPersonal: true, vals: a.vals, stab: !!a.stab }, now);
        }
        var xw = a.w;
        var er2 = checkTargets(G, pi, [xw], true); if (er2) return er2;
        if (!a.vals || a.vals.length !== 2 || a.vals[0] === a.vals[1]) return '请宣告两个不同的数值';
        for (var k = 0; k < 2; k++) { var ev2 = checkVal(G, pi, a.vals[k]); if (ev2) return ev2; }
        if (BB.usesCutChoices(G)) return beginPhysical(G, pi, [xw], a.vals, def.name, { equip: e.n }, now);
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
      case 13: {
        if (!G.equipmentReserve || G.equipmentReserve.length < 2) return '没有两张可添加的装备';
        var drawn = shuffle(G.equipmentReserve.slice(), rng).slice(0, 2);
        G.equipmentReserve = G.equipmentReserve.filter(function (n) { return drawn.indexOf(n) < 0; });
        var added = drawn.map(function (n) { return { n: n, id: Campaign.equipmentIdentity(n), used: false }; });
        G.equip = G.equip.concat(added);
        Campaign.equipmentAdded(G, added, campaignContext(rng, now));
        G.equip.sort(function (a, b) { return a.n - b.n; });
        addLog(G, '🧰 ' + P.name + ' 使用了双层底盒，新增 ' + drawn.map(function (n) { return BB.EQUIP[n].name; }).join('、') + '。');
        break;
      }
      case 18:{
        var taken=W(G,a.w);
        if(G.ruleset!=='physical'||!taken||taken.cut||taken.o===pi||taken.o<0||taken.s<0||!Campaign.equipmentWireAllowed(G,pi,taken))return '请选择队友一根可用装备移动的未剪线';
        var source={p:taken.o,s:taken.s,pos:G.players[taken.o].stands[taken.s].indexOf(taken.id)};
        invalidateUniqueRacks(G,[{o:source.p,s:source.s}]);
        // 频率标记说明旧线架的数量，换架后不能继续作为新架事实。
        if(taken.info&&taken.info.t==='freq')taken.info=null;
        G.actionId++;G.declaration={type:'grapple',id:G.actionId,from:pi,to:source.p,ids:[taken.id],vals:[],label:'抓钩',source:source,destination:null};
        e.used=true;G.labels=G.labels.filter(function(label){return label.a!==taken.id&&label.b!==taken.id;});
        addLog(G,P.name+' 用抓钩取走 '+pname(G,source.p)+' 第'+(source.s+1)+'架第'+(source.pos+1)+'根线；数值不公开。');
        if(P.stands.length===1)placeGrapple(G,pi,taken,0,now);
        else{taken.o=pi;taken.s=-1;resort(G);G.pending={type:'grapple',id:G.actionId,from:pi,to:pi,wire:taken.id};}
        return null;
      }
      case 16:{
        var selected=a.ws;
        if(G.ruleset!=='physical'||!Array.isArray(selected)||selected.length!==2||new Set(selected).size!==2)return '单剪通行证需要选择自己两根不同的导线';
        var pair=selected.map(function(id){return Number.isInteger(id)?W(G,id):null;});
        if(pair.some(function(w){return !w||w.o!==pi||w.cut||kindOf(w)==='r'||!Campaign.equipmentWireAllowed(G,pi,w);}))return '只能选择自己未剪且可用装备的非红导线';
        var value=annOf(pair[0]);if(annOf(pair[1])!==value||a.val!==value)return '两根导线必须同值，并宣告该值';
        if(!seqAllowed(G,value,pi)||!Campaign.soloAllowed(G,pi,pair)||G.mission.rules&&G.mission.rules.noSolo&&othersCuttable(G,pi))return '本关当前限制不允许这次单人拆线';
        e.used=true;G.actionId++;G.declaration={type:'vip-cut',id:G.actionId,from:pi,to:pi,ids:selected.slice(),vals:[value],label:def.name};
        Campaign.declare(G,[value],campaignContext(rng,now));pair.forEach(function(w){cutWire(G,w);});
        G.lastAct={t:'hit',ids:selected.slice()};addLog(G,P.name+' 使用单剪通行证，剪掉自己所选的两根'+BB.valLabel(value)+'。','good');unlockLog(G,value);
        if(Campaign.afterCut(G,campaignContext(rng,now)))return null;
        endTurn(G,now);return null;
      }
      case 14:{
        var unique=W(G,a.w);
        if(G.ruleset!=='physical'||!unique||unique.o!==pi||unique.s<0||kindOf(unique)!=='b'||!Campaign.equipmentWireAllowed(G,pi,unique))return '请选择自己可用装备的蓝线，已剪或未剪均可';
        if(unique.unique||unique.info&&unique.info.t==='freq'&&unique.info.v===1)return '这根线已有×1标记';
        if(P.stands[unique.s].filter(function(id){return annOf(W(G,id))===annOf(unique);}).length!==1)return '该值在整架必须只出现一次，已剪线也计入';
        if(BB.uniqueMarkerCount(G)>=7){var reclaimed=G.wires.find(function(w){return w.id!==unique.id&&w.cut&&(w.unique||w.info&&w.info.t==='freq'&&w.info.v===1);});if(reclaimed){if(reclaimed.unique)delete reclaimed.unique;else reclaimed.info=null;}else{G.announcement={id:unique.id,info:{t:'freq',v:1},frequencyOnly:true};addLog(G,P.name+' 使用单一导线标签；×1标记不足，本次仅口头宣告该值在所指架只有一根。');break;}}
        unique.unique=true;addLog(G,P.name+' 使用单一导线标签，所指蓝线在整架只出现一次（含已剪线）。');break;
      }
    }
    if (personal) useCharacter(G, pi); else e.used = true;
    return null;
  }

  /* ---------- 视图：只暴露玩家 pi 能看到的信息 ---------- */
  function missionView(G) {
    if (G.catalog !== 'campaign' && G.ruleset !== 'physical') return undefined;
    var out = {};
    ['id', 'name', 'brief', 'blue', 'y', 'r', 'eq', 'dd', 'info', 'det', 'rules', 'tier', 'two', 'catalog', 'contentVersion', 'verified', 'source', 'officialModule', 'personalCharacters', 'excludeCharacters', 'printedDial'].forEach(function (key) {
      if (G.mission[key] !== undefined) out[key] = JSON.parse(JSON.stringify(G.mission[key]));
    });
    out.ruleset = G.ruleset;
    out.status = G.mission.status || (G.mission.verified ? '已核实' : '改编规则');
    return out;
  }
  BB.view = function (G, pi) {
    var over = G.phase === 'won' || G.phase === 'lost';
    var R = G.mission.rules || {};
    return {
      gid: G.gid, cutFlow: G.cutFlow || null, catalog: G.catalog || G.mission.catalog || G.ruleset || 'custom', ruleset: G.ruleset || 'custom', contentVersion: G.mission.contentVersion || 1, verified: !!G.mission.verified, mid: G.mission.id, captain: G.captain, np: G.np, me: pi, phase: G.phase, turn: G.turn, turnNo: G.turnNo, turnLimit: G.turnLimit,
      det: G.det, detMax: G.detMax, detMin: BB.dialMin(G), stab: G.stab, infoN: G.infoN, setup: G.setup, setupNeeds: G.setupNeeds, mission: missionView(G),
      players: G.players.map(function (p, i) {
        return {
          name: p.name, bot: p.bot, dd: Campaign.personalCardsLocked(G)&&pi!==i?0:p.dd, pid: p.pid, character: p.character ? Campaign.characterView(G,pi,i,BB.characterState(p)) : undefined,
          stands: p.stands.map(function (st) {
            return st.map(function (id) {
              var w = G.wires[id];
              var see = Campaign.wireVisible(G, pi, w, i);
              var visible = { id: id, v: see ? w.v : null, cut: w.cut, info: w.info };
              if(w.unique)visible.unique=true;
              if (Campaign.isX(G, w)) visible.x = true;
              // 隐藏导线的特殊颜色也属私人信息，不可泄露其位置。
              if (see && w.kind) visible.kind = w.kind;
              if (w.cut && w.resolution) visible.resolution = w.resolution;
              return visible;
            });
          })
        };
      }),
      equip: G.equip.map(function (e) { return Campaign.equipmentView(G, e, campaignContext()) || { n: e.n, id: e.id || Campaign.equipmentIdentity(e.n), used: e.used, open: BB.equipUnlocked(G, e.n) }; }),
      ymark: (R.hide || Campaign.memorySea(G)&&!Campaign.memorySea(G).preview) && !over ? { n: G.ymark.n, cand: [] } : G.ymark,
      rmark: (R.hide || Campaign.memorySea(G)&&!Campaign.memorySea(G).preview) && !over ? { n: G.rmark.n, cand: [] } : G.rmark,
      missing: over ? G.missing : null,
      seq: G.seq, official: Campaign.view(G, pi), labels: G.labels, radar: G.radar, pending: publicPending(G, pi), declaration: G.declaration || null, deadline: G.deadline,
      paused: !!G.paused, pauseRemaining: G.paused ? G.pauseRemaining : null, audio: G.audioClock ? Audio.view(G.audioClock,Date.now()) : G.audioPreparation ? {version:1,status:'waiting',elapsedMs:0,mediaDurationMs:G.audioPreparation.definition.durationMs,serverTime:Date.now(),source:{url:G.audioPreparation.definition.asset.url,sha256:G.audioPreparation.definition.asset.sha256,locale:G.audioPreparation.definition.asset.locale},cutHeld:true,revision:G.audioPreparation.revision,preparation:{id:G.audioPreparation.id,ready:G.audioPreparation.ready.slice()}} : null,
      announcement: G.announcement, result: G.result, lastAct: G.lastAct,
      log: G.ruleset === 'physical' ? (G.feedback || []) : G.log.slice(-12)
    };
  };
  function publicPending(G, pi) {
    var pd = G.pending;
    if (pd) { var special = Campaign.pendingView(G, pi); if (special) return special; }
    if(pd&&pd.type==='grapple'){var out={type:pd.type,id:pd.id,from:pd.from,to:pd.to,wire:pd.wire};if(pi===pd.to){out.drawn={value:W(G,pd.wire).v};out.choices=G.players[pi].stands.map(function(_,rack){return rack;});}return out;}
    if (!pd || pd.type !== 'cut') return pd;
    var out = { type: 'cut', id: pd.id, from: pd.from, to: pd.to, step: pd.step, label: pd.label, ids: pd.ids.slice(), vals: pd.vals.slice() };
    if (pd.step === 'own') { out.hit = pd.hit; out.hitVal = pd.hitVal; }
    if (pd.outwardOwn != null) out.outwardOwn = pd.outwardOwn;
    if(pd.outwardIntent){out.outwardIntent=true;if(pi===pd.from&&pd.step==='own')out.preferredOwn=pd.preferredOwn;}
    if (pi === pd.to) {
      if (pd.step === 'target') {
        var hits = pd.ids.filter(function (id) { return pd.vals.some(function (v) { return matches(W(G, id), v); }); });
        if(Campaign.allOutward(G)&&pd.ids.length===1&&Campaign.isOutward(G,W(G,pd.ids[0])))out.publicMatch=!!hits.length;
        out.noClue = !hits.length && Campaign.suppressFailureClue(G, pd.from, pd.to);
        out.choices = out.noClue ? [] : hits.length ? hits : pd.ids.filter(function (id) { return kindOf(W(G, id)) !== 'r'; });
        out.noSafe = !out.choices.length;
        if (!hits.length && !out.noSafe) { var clueValues = Campaign.failureClueValues(G, pi, pd.vals); if (clueValues) out.clueValues = clueValues; }
      } else if (pd.step === 'own') {
        out.choices = physicalOwnChoices(G, pi, pd);
      }
    }
    return out;
  }

  // 紧凑编码（联机传输，单条消息 ≤4KB）：公共部分 + 每人私有手牌
  BB.packPublic = function (G, logN) {
    var V = BB.view(G, -1);
    // 共用包也会发给队长，朝外线的值必须改由其他玩家的私人包携带。
    V.players.forEach(function (p) { p.stands.forEach(function (st) { st.forEach(function (w) { if (Campaign.isOutward(G, w) && !w.cut && G.phase !== 'won' && G.phase !== 'lost') { w.v = null; delete w.kind; } }); }); });
    V.players.forEach(function (p) {
      p.stands = p.stands.map(function (st) {
        return st.map(function (w) { var row = [w.id, w.v === null ? 0 : w.v, w.info ? encInfo(w.info) : 0, w.cut ? 1 : 0]; if (w.kind || w.resolution || w.x) row[4] = w.kind || null; if (w.resolution || w.x) row[5] = w.resolution || null; if (w.x) row[6] = 1;if(w.unique)row[7]=1; return row; });
      });
    });
    V.log = G.ruleset === 'physical' ? V.log : G.log.slice(-(logN === undefined ? 8 : logN));
    return V;
  };
  BB.packChoice = function (G, pi) {
    var official = Campaign.view(G, pi);
    var choice = official && official.missingSetup ? Object.assign({ type: 'missing-setup', to: pi }, official.missingSetup) : publicPending(G, pi);
    if (official && official.secretNumbers && pi >= 0) choice = Object.assign({}, choice || { type: 'secret-hand', to: pi }, { secretOwner: pi, secretHand: official.secretNumbers.hand.slice() });
    return choice;
  };
  BB.packHand = function (G, pi) {
    var h = {};
    G.wires.forEach(function (w) { if (pi >= 0 && Campaign.wireVisible(G, pi, w) && (w.o === pi || Campaign.isOutward(G, w))) h[w.id] = w.kind ? { v: w.v, kind: w.kind } : w.v; });
    return h;
  };
  BB.unpack = function (pub, hand, me, choice) {
    var V = JSON.parse(JSON.stringify(pub));
    V.me = me;
    if (choice && choice.secretOwner === me && me >= 0 && V.official && V.official.secretNumbers && Array.isArray(choice.secretHand)) V.official.secretNumbers.hand = choice.secretHand.slice();
    if (choice && choice.type === 'missing-setup' && choice.to === me && V.phase === 'setup' && BB.setupActor(V) === me && V.official) V.official.missingSetup = { id: choice.id, values: choice.values };
    if (choice && choice.id && V.pending && choice.id === V.pending.id && (choice.to === me || choice.type === 'radar' && choice.waiting.indexOf(me) >= 0)) V.pending = choice;
    V.players.forEach(function (p, pi) {
      p.stands = p.stands.map(function (st) {
        return st.map(function (a) {
          var v = a[1] || null;
          var kind = a[4];
          var permitted = Campaign.wireVisible(V, me, { id: a[0], cut: !!a[3] }, pi);
          if (!permitted) { v = null; kind = null; }
          if (v === null && permitted && hand && hand[a[0]] !== undefined) {
            var own = hand[a[0]];
            if (own && typeof own === 'object') { v = own.v; kind = own.kind; } else v = own;
          }
          var wire = { id: a[0], v: v, cut: !!a[3], info: a[2] ? decInfo(a[2]) : null };
          if (kind && v !== null) wire.kind = kind;
          if (a[5] && wire.cut) wire.resolution = a[5];
          if (a[6]) wire.x = true;
          if(a[7])wire.unique=true;
          return wire;
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
    if (f.t === 'freq') return 'f' + f.v + ':' + (f.copies || 1);
    return 0;
  }
  function decInfo(x) {
    if (typeof x === 'number') return { t: 'v', v: x };
    if (x === 'Y') return { t: 'Y' };
    if (x === 'o') return { t: 'odd' };
    if (x === 'e') return { t: 'even' };
    if (x.charAt(0) === 'f') {
      var parts = x.slice(1).split(':'), info = { t: 'freq', v: Number(parts[0]) };
      if (Number(parts[1]) === 2) info.copies = 2;
      return info;
    }
    if (x.charAt(0) === '!') return { t: 'not', v: x.slice(1) };
    return null;
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = BB;
  else window.BB = BB;
})();
