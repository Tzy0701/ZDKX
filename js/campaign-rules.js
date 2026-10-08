/* Official campaign modules. Functional rules and evidence: docs/official-mechanisms.json.
 * Modules are gated separately from the playable/verified catalog in missions.js.
 * No module runs for a legacy save unless that save explicitly contains its identity.
 */
(function () {
  var C = { version: 1, modules: {} };
  C.challenges = typeof module!=='undefined'&&module.exports?require('./challenges.js'):window.BB_CHALLENGES;
  var identities = ['label-different', 'walkie-talkies', 'triple-detector', 'sticky-note',
    'super-detector', 'rewinder', 'emergency-battery', 'general-radar', 'stabilizer',
    'xy-ray', 'coffee-mug', 'label-equal', 'double-bottom', 'unique-label',
    'emergency-reserve', 'wire-cutter', 'disintegrator', 'grapple'];
  C.equipmentIdentity = function (number) { return identities[number - 1] || null; };
  C.equipmentNumbers = function (mission) {
    var pool = [];
    for (var n = 1; n <= 12; n++) pool.push(n);
    if (mission.id >= 9 && mission.y[0] > 0) pool.push(13);
    if (mission.id >= 55) pool = pool.concat([14, 15, 16, 17, 18]);
    return pool.filter(function (n) { return !mission.excludeEquipment || mission.excludeEquipment.indexOf(n) < 0; });
  };
  C.unlock = function (n) {
    if (n === 13) return { value: 'Y', count: 2, printed: '黄' };
    var additional = { 14: 2, 15: 3, 16: 9, 17: 10, 18: 11 };
    return { value: additional[n] || n, count: n >= 14 ? 4 : 2, printed: additional[n] ? additional[n] + '·' + additional[n] : String(n) };
  };
  C.characters = {
    'double-detector': { name: '双重探测器', introducedAt: 1, timing: 'own-turn', equipment: null },
    'triple-detector': { name: '三重探测器', introducedAt: 31, timing: 'own-turn', equipment: 3 },
    'xy-ray': { name: 'X/Y 射线', introducedAt: 31, timing: 'own-turn', equipment: 10 },
    'general-radar': { name: '通用雷达', introducedAt: 31, timing: 'anytime', equipment: 8 },
    'walkie-talkies': { name: '对讲机', introducedAt: 31, timing: 'anytime', equipment: 2 }
  };

  function moduleFor(G) {
    return G.officialState && G.officialState.version === C.version && C.modules[G.officialState.module];
  }
  C.initialize = function (G, ctx) {
    if (!G.mission.officialModule) return;
    var module = C.modules[G.mission.officialModule];
    if (!module) throw new Error('Unknown official mission module: ' + G.mission.officialModule);
    G.officialState = { version: C.version, module: G.mission.officialModule };
    if (module.setup) module.setup(G, ctx);
  };
  C.prepareMission = function (mission, count) {
    var module=mission.officialModule&&C.modules[mission.officialModule];
    if(module&&module.prepareMission)module.prepareMission(mission,count);
  };
  C.setupMessage=function(G){var module=moduleFor(G);return module&&module.setupMessage?module.setupMessage(G):null;};
  C.prepareCaptain = function (mission, count, captain, ctx) {
    var module = mission.officialModule && C.modules[mission.officialModule];
    return module && module.prepareCaptain ? module.prepareCaptain(count, captain, ctx) : captain;
  };
  C.rookie = function (G) {
    if (G.officialState) return moduleFor(G) && G.officialState.module === 'rookie' ? G.officialState.rookie : null;
    return G.official && G.official.version === C.version && G.official.module === 'rookie' ? G.official.rookie : null;
  };
  C.stabilizerAllowed = function (G, pi) {
    var rookie = C.rookie(G), liar = C.liar(G), captain = C.unequippedCaptain(G), actor = C.turnActor(G);
    if ((actor === G.captain||C.allOutward(G)) && C.outwardId(G) != null && ownWires(G, actor).some(function (w) { return C.isOutward(G, w) && !w.cut; }) && !ownWires(G, actor).some(function (w) { return !w.cut && !C.isOutward(G, w) && Number.isInteger(w.v); })) return false;
    if(G.officialState&&G.officialState.license&&G.officialState.license.required||G.official&&G.official.licenseRequired)return false;
    return (rookie == null || (pi !== rookie && actor !== rookie)) && (liar == null || (pi !== liar && actor !== liar)) && (captain == null || (pi !== captain && actor !== captain));
  };
  C.liar = function (G) {
    if (G.officialState) return moduleFor(G) && G.officialState.module === 'liar' ? G.officialState.liar : null;
    return G.official && G.official.version === C.version && G.official.module === 'liar' ? G.official.liar : null;
  };
  C.isX = function (G, wire) {
    var state = G.officialState || G.official;
    return !!(state && state.version === C.version && ['unsorted-x','yellow-before-x'].indexOf(state.module)>=0 && wire && wire.x);
  };
  C.yellowBeforeX=function(G){var s=G.officialState||G.official;return !!(s&&s.version===C.version&&s.module==='yellow-before-x');};
  C.xLocked=function(G){if(!C.yellowBeforeX(G))return false;var wires=G.wires||G.players.reduce(function(all,p){return all.concat(p.stands.flat());},[]);return wires.filter(function(w){return w.cut&&w.v!==null&&Math.round((w.v-Math.floor(w.v))*10)===1;}).length<4;};
  C.unequippedCaptain = function (G) {
    var state = G.officialState || G.official;
    return state && state.version === C.version && state.module === 'unequipped-captain' ? state.unequippedCaptain : null;
  };
  C.doubleOutward=function(G){var state=G.officialState||G.official;return !!(state&&state.version===C.version&&state.module==='double-outward-wires');};
  C.allOutward=function(G){var state=G.officialState||G.official;return !!(state&&state.version===C.version&&['all-outward-wires','double-outward-wires'].indexOf(state.module)>=0);};
  C.outwardIdsForOwner=function(G,owner){var state=G.officialState||G.official;if(C.doubleOutward(G))return (state.outwardGroups[owner]||[]).slice();if(state&&state.version===C.version&&state.module==='all-outward-wires')return [state.outwardIds[owner]];return state&&state.version===C.version&&state.module==='captain-outward-wire'&&owner===G.captain?[state.outwardId]:[];};
  C.outwardId = function (G, owner) {
    var state = G.officialState || G.official;
    if(C.doubleOutward(G)){var group=C.outwardIdsForOwner(G,owner===undefined?G.turn:owner);var live=group.find(function(id){return G.wires?!G.wires[id].cut:G.players.some(function(p){return p.stands.some(function(st){return st.some(function(w){return w.id===id&&!w.cut;});});});});return live===undefined?group[0]:live;}
    if(C.allOutward(G))return state.outwardIds[owner===undefined?G.turn:owner];
    return state && state.version === C.version && state.module === 'captain-outward-wire' && (owner===undefined||owner===G.captain) ? state.outwardId : null;
  };
  C.isOutward = function (G, wire) {var state=G.officialState||G.official;return !!(wire&&(C.doubleOutward(G)?state.outwardGroups.some(function(ids){return ids.indexOf(wire.id)>=0;}):C.allOutward(G)?state.outwardIds.indexOf(wire.id)>=0:C.outwardId(G)!=null&&wire.id===C.outwardId(G)));};
  C.unsortedWire = function (G, wire) { return C.isX(G, wire) || C.isOutward(G, wire); };
  C.wireVisible = function (G, viewer, wire, owner) {
    if (wire.o != null && wire.o < 0) return false;
    if (C.memorySea(G) && C.memorySea(G).preview && G.phase!=='won' && G.phase!=='lost') return false;
    var submarine=C.submarine54(G),suspended=submarine&&submarine.suspendedPending;if(suspended&&suspended.type==='cut'&&suspended.step==='own'&&suspended.hit===wire.id)return true;
    if (wire.cut || G.phase === 'won' || G.phase === 'lost') return true;
    if (G.pending && G.pending.type === 'cut' && G.pending.step === 'own' && G.pending.hit === wire.id) return true;
    return C.isOutward(G, wire) ? viewer !== (C.allOutward(G)?owner==null?wire.o:owner:G.captain) : viewer === (owner == null ? wire.o : owner);
  };
  C.equipmentWireAllowed = function (G, pi, wire) { return !C.isX(G, wire) && !C.isOutward(G, wire); };
  C.failureClueValues = function (G, owner, vals) { var module=moduleFor(G);if(module&&module.failureClueValues)return module.failureClueValues(G,owner,vals);return C.liar(G) === owner ? vals.slice() : null; };
  C.failureInfo = function (G, wire, vals, choice) {var module=moduleFor(G);if(module&&module.failureInfo)return module.failureInfo(G,wire,vals,choice);return wire.o === C.liar(G) ? { t: 'not', v: String(choice == null ? vals[0] : choice) } : null; };
  C.cutFailureReason = function (G, actor) {
    var module = moduleFor(G);
    return module && module.cutFailureReason ? module.cutFailureReason(G, actor) : null;
  };
  C.allowedValue = function (G, value, ctx) {
    var module = moduleFor(G);
    return !module || !module.allowedValue || module.allowedValue(G, value, ctx);
  };
  C.validateAction = function (G, pi, action, ctx) {
    var module = moduleFor(G);
    return module && module.validateAction ? module.validateAction(G, pi, action, ctx) : null;
  };
  C.enterTurn = function (G, ctx) {
    var module = moduleFor(G);
    if (module && module.enterTurn) module.enterTurn(G, ctx);
  };
  C.finishTurn = function (G, ctx, nextIdx) {
    var module = moduleFor(G);
    return module && module.finishTurn ? module.finishTurn(G, ctx, nextIdx) : false;
  };
  C.nextTurn = function (G, nextIdx) {
    var module=moduleFor(G);
    return module&&module.nextTurn?module.nextTurn(G,nextIdx):undefined;
  };
  C.freeTurn=function(G){return G.officialState?G.officialState.freeTurn:G.official&&G.official.freeTurn;};
  C.weakLink=function(G){return G.officialState?G.officialState.weakLink:G.official&&G.official.weakLink;};
  C.personalCardsLocked=function(G){var s=C.weakLink(G);return !!(s&&s.status==='secret');};
  C.characterView=function(G,viewer,owner,card){
    var weak=C.weakLink(G);if(weak&&weak.status==='discarded')return {id:'hidden',used:true,removed:true};
    if(!C.personalCardsLocked(G))return card;
    return viewer===owner?Object.assign({},card,{locked:true}):{id:'hidden',used:false,hidden:true,locked:true};
  };
  function retireWeakLink(G,remove){var s=C.weakLink(G);s.status=remove?'discarded':'revealed';s.startPending=false;s.decisionId++;G.players.forEach(function(p){if(remove){p.dd=0;p.character.used=true;p.character.removed=true;}});}
  C.modules['secret-weak-link']={
    prepareMission:function(mission,count){if(count===2)throw Error('第34关官方任务不能双人游玩，请跳到第35关');},
    setup:function(G,ctx){
      var roles=ctx.shuffle(['triple-detector','xy-ray','general-radar','walkie-talkies'],ctx.rng).slice(0,G.np-1);roles.push('double-detector');roles=ctx.shuffle(roles,ctx.rng);var cards=ctx.shuffle(['A','B','C','D','E'],ctx.rng).slice(0,G.np);
      G.players.forEach(function(p,pi){p.character={id:roles[pi],used:false};p.dd=roles[pi]==='double-detector'?1:0;});
      G.officialState.weakLink={owner:roles.indexOf('double-detector'),cards:cards,status:'secret',startPending:false,decisionId:0,enteredTurn:null};
    },
    enterTurn:function(G,ctx){var s=C.weakLink(G);if(s.status!=='secret'||s.enteredTurn===G.turnNo)return;s.enteredTurn=G.turnNo;s.startPending=true;s.decisionId++;
      if(G.turn===s.owner&&!ctx.canAct(G,G.turn)){G.det+=2;retireWeakLink(G,true);ctx.log(G,'弱环节无法遵守秘密限制，引爆器前进两格；全队角色和限制全部弃置。','bad');if(G.det>=G.detMax)ctx.lose(G,'弱环节罚格到达末端，炸弹爆炸。');}
    },
    validateAction:function(G,pi,a){var s=C.weakLink(G);if(s.status==='secret'&&(a.a==='dd'||a.a==='character'||a.xyPersonal))return '角色仍背面朝上，个人装备暂时锁定';if(s.startPending&&pi===G.turn&&(['dual','dd','solo','red'].includes(a.a)||a.a==='equip'&&[3,5,9,10,11].includes(a.n)))return '请先决定是否猜弱环节，再开始本回合行动';return null;},
    handleAction:function(G,pi,a,ctx){if(['weak-guess','weak-pass'].indexOf(a.a)<0)return null;var s=C.weakLink(G);
      if(G.phase!=='play'||G.pending||s.status!=='secret'||!s.startPending||pi!==G.turn||a.id!==s.decisionId)return {error:'弱环节决定已过期或尚未轮到你'};
      if(a.a==='weak-pass'){s.startPending=false;return {error:null};}
      if(pi===s.owner)return {error:'弱环节只能秘密遵守限制，不能猜自己的身份'};
      if(!Number.isInteger(a.player)||!G.players[a.player]||!['A','B','C','D','E'].includes(a.constraint))return {error:'请选择玩家和A–E限制'};
      s.startPending=false;
      var announced=G.players[pi].name+' 猜测 '+G.players[a.player].name+' 的限制为 '+a.constraint+'：';
      if(a.player===s.owner&&a.constraint===s.cards[s.owner]){retireWeakLink(G,false);ctx.log(G,announced+'身份及限制正确！所有角色公开，限制弃置，个人装备解锁。','good');}
      else{G.det++;ctx.log(G,announced+'不完全正确，引爆器前进一格，本回合继续。','bad');if(G.det>=G.detMax)ctx.lose(G,'弱环节猜测罚格到达末端，炸弹爆炸。');}
      return {error:null};
    },
    view:function(G,pi){var s=C.weakLink(G),out={status:s.status,startPending:s.startPending,decisionId:s.decisionId};if(s.status==='secret'&&G.players[pi]){out.ownOwner=pi;out.ownWeak=pi===s.owner;out.ownConstraint=s.cards[pi];}return {version:C.version,module:'secret-weak-link',weakLink:out};}
  };
  C.freeTurnEligible=function(G,pi){var s=C.freeTurn(G);if(!s||s.step!=='claim'||!G.players[pi])return false;var active=G.players.map(function(_,owner){return ownWires(G,owner).some(function(w){return !w.cut;});});return active[pi]&&(G.np===2||active.filter(Boolean).length<=2||pi!==s.previous);};
  C.modules['timed-free-turn']={
    setup:function(G){G.officialState.freeTurn={step:'claim',actor:null,previous:null,decisionId:1,duration:G.np===2?720:900};},
    enterTurn:function(G){var s=C.freeTurn(G);s.step='claim';s.actor=null;},
    finishTurn:function(G){var s=C.freeTurn(G);s.previous=s.actor;s.actor=null;s.step='claim';s.decisionId++;return false;},
    validateAction:function(G,pi,a){var s=C.freeTurn(G);if(G.phase!=='play'||a.a==='timeout'||a.a==='turn-claim')return null;var cut=['dual','dd','solo','red'].indexOf(a.a)>=0||a.a==='equip'&&[3,5,9,10,11].indexOf(a.n)>=0||a.a==='character'&&C.characters[G.players[pi].character.id].timing==='own-turn';return cut&&(s.step!=='cut'||s.actor!==pi)?'先喊“我来拆线”取得回合，不能连续抢回合':null;},
    handleAction:function(G,pi,a,ctx){
      if(G.phase==='play'&&G.deadline&&ctx.now>=G.deadline&&a.a!=='timeout'){ctx.lose(G,'任务总时间耗尽，炸弹爆炸。');return {error:null};}
      if(a.a==='timeout'){
        if(G.phase!=='play'||!ctx.serverTimeout||!G.deadline||ctx.now<G.deadline)return {error:'尚未到服务端判定的任务超时'};
        ctx.lose(G,'任务总时间耗尽，炸弹爆炸。');return {error:null};
      }
      if(a.a!=='turn-claim')return null;var s=C.freeTurn(G);
      if(G.phase!=='play'||G.pending||a.id!==s.decisionId||!C.freeTurnEligible(G,pi))return {error:'抢回合已过期、仍在结算或不能连续行动'};
      s.step='cut';s.actor=pi;G.turn=pi;ctx.log(G,G.players[pi].name+' 喊“我来拆线”，取得本回合。');return {error:null};
    },
    view:function(G){return {version:C.version,module:'timed-free-turn',freeTurn:JSON.parse(JSON.stringify(C.freeTurn(G)))};}
  };
  C.equipmentEffectsSupported=function(G){var module=moduleFor(G);return !G.officialState||!!(module&&module.afterEquipmentEffect);};
  C.afterEquipmentEffect=function(G,effect,ctx){var module=moduleFor(G);return module&&module.afterEquipmentEffect?module.afterEquipmentEffect(G,effect,ctx):null;};
  C.boundConstraintDeadlock=function(G,canAct){return !!(G.officialState&&G.officialState.module==='number-bound-constraints'&&!G.pending&&G.wires.some(function(w){return !w.cut;})&&!G.players.some(function(_,owner){return canAct(G,owner);}));};
  C.declare = function (G, values, ctx) {
    var module = moduleFor(G);
    if (module && module.declare) module.declare(G, values, ctx);
  };
  C.view = function (G, pi) {
    var module = moduleFor(G);
    return module && module.view ? module.view(G, pi) : null;
  };
  function radarCommand(G) {
    if (G.officialState) return moduleFor(G) && G.officialState.module === 'radar-command' ? G.officialState.command : null;
    return G.official && G.official.module === 'radar-command' ? G.official.radarCommand : null;
  }
  C.radarCommand = radarCommand;
  C.turnActor = function (G) { var state = radarCommand(G); return state && state.step === 'cut' ? state.actor : G.turn; };
  C.equipUnlocked = function (G, n, ctx) {
    var module = moduleFor(G);
    return module && module.equipUnlocked ? module.equipUnlocked(G, n, ctx) : null;
  };
  C.equipmentView = function (G, equipment, ctx) {
    var module = moduleFor(G);
    return module && module.equipmentView ? module.equipmentView(G, equipment, ctx) : null;
  };
  C.equipmentAdded = function (G, equipment, ctx) {
    var module = moduleFor(G);
    if (module && module.equipmentAdded) module.equipmentAdded(G, equipment, ctx);
  };
  C.redNumber = function (G) {
    if (G.officialState) return moduleFor(G) && G.officialState.module === 'blue-as-red' ? G.officialState.redNumber : null;
    return G.official && G.official.version === C.version && G.official.module === 'blue-as-red' ? G.official.redNumber : null;
  };
  C.setupInfoAllowed = function (G, wire) {
    if(C.allFalseInfo(G))return Number.isFinite(wire.v)&&Math.round(wire.v*10)%10!==1;
    if (C.unsortedWire(G, wire)) return false;
    var module = moduleFor(G);
    if (module && module.setupInfoAllowed) return module.setupInfoAllowed(G, wire);
    return C.redNumber(G) != null ? Number.isInteger(wire.v) : null;
  };
  C.infoFor = function (G, wire) {
    var module = moduleFor(G);
    return module && module.infoFor ? module.infoFor(G, wire) : null;
  };
  C.tokenLimit = function (G, info) {
    var module = moduleFor(G);
    return module && module.tokenLimit ? module.tokenLimit(G, info) : null;
  };
  C.setupNeeds = function (G) {
    var module = moduleFor(G);
    return module && module.setupNeeds ? module.setupNeeds(G) : null;
  };
  C.beginSetup = function (G, ctx) {
    var module = moduleFor(G);
    return module && module.beginSetup ? module.beginSetup(G, ctx) : false;
  };
  function clueState(G) { var module = moduleFor(G); return module && module.yellowClues ? G.officialState.clues : null; }
  function tokenInfo(token) { return token.value === 'Y' ? { t: 'Y', token: token.id } : { t: 'v', v: token.value, token: token.id }; }
  function sameInfo(token, info) { return info.t === 'Y' ? token.value === 'Y' : info.t === 'v' && token.value === info.v; }
  function reserved(G) {
    var state = clueState(G), module = moduleFor(G);
    var tokens = state ? state.side.concat(state.pool, G.pending && G.pending.type === 'clue' && G.pending.token ? [G.pending.token] : []) : [];
    return tokens.concat(module && module.reservedTokens ? module.reservedTokens(G) : []);
  }
  C.reservedTokens = function (G, info) { return reserved(G).filter(function (token) { return sameInfo(token, info); }).length; };
  // 两份 1–12，加两份黄。旧标记没有编号，按剩余份数占用；新标记保留自己的身份。
  C.availableInfoTokens = function (G, yellow) {
    var out = [], occupied = reserved(G).slice(), anonymous = [];
    G.wires.forEach(function (w) {
      if(!w.cut&&w.info&&w.info.t==='not'){
        var values=String(w.info.v).split('/').map(function(value){return value==='Y'?'Y':Number(value);}).filter(function(value){return value==='Y'||Number.isInteger(value)&&value>=1&&value<=12;});
        if(w.info.tokens)w.info.tokens.forEach(function(id){var match=/^info-(Y|[0-9]+)-[01]$/.exec(id);if(match)occupied.push({id:id,value:match[1]==='Y'?'Y':Number(match[1])});});
        else if(w.info.token)occupied.push({id:w.info.token,value:values[0]});
        else values.forEach(function(value){for(var copy=0;copy<(values.length===1?(w.info.copies||1):1);copy++)anonymous.push(value);});
      }
      if (!w.cut && w.info && (w.info.t === 'v' || w.info.t === 'Y')) {
        var value = w.info.t === 'Y' ? 'Y' : w.info.v;
        if (w.info.tokens) w.info.tokens.forEach(function(id){occupied.push({id:id,value:value});});
        else if (w.info.token) occupied.push({ id: w.info.token, value: value }); else for(var copy=0;copy<(w.info.copies||1);copy++) anonymous.push(value);
      }
    });
    var values = Array.from({ length: 12 }, function (_, i) { return i + 1; });
    if (yellow) values.push('Y');
    values.forEach(function (value) {
      var slots = [0, 1].map(function (copy) { return { id: 'info-' + value + '-' + copy, value: value }; }).filter(function (token) {
        return !occupied.some(function (used) { return used.id === token.id; });
      });
      // 旁置标记总有编号；匿名数量只来自旧格式的导线标记。
      out = out.concat(slots.slice(anonymous.filter(function (v) { return v === value; }).length));
    });
    return out;
  };
  function reclaimToken(G, token) {
    var old = G.wires.filter(function (w) { return w.cut && w.info && sameInfo(token, w.info) && w.info.token === token.id; })[0] ||
      G.wires.filter(function (w) { return w.cut && w.info && !w.info.token && sameInfo(token, w.info); })[0];
    if (old) old.info = null;
  }
  function missingValues(G, pi) {
    var hand = G.wires.filter(function (w) { return w.o === pi; });
    return Array.from({ length: 12 }, function (_, i) { return i + 1; }).concat(['Y']).filter(function (value) {
      return !hand.some(function (w) { return value === 'Y' ? Math.round((w.v - Math.floor(w.v)) * 10) === 1 : w.v === value; });
    });
  }
  function clueChoices(G, pd) {
    return G.wires.filter(function (w) { return w.o === pd.to && !w.cut && w.v === pd.token.value; }).map(function (w) { return w.id; });
  }
  function clueDecision(G, step, to, from, index, token) {
    G.actionId++;
    G.pending = { type: 'clue', id: G.actionId, step: step, to: to, from: from, index: index, token: token || null };
  }
  C.pendingView = function (G, pi) {
    var pd = G.pending, state = clueState(G);
    var module = moduleFor(G);
    if (module && module.pendingView) return module.pendingView(G, pi);
    if (pd && pd.type === 'equipment-reveal' && moduleFor(G) && G.officialState.module === 'blind-equipment')
      return { type: pd.type, id: pd.id, from: pd.from, to: pd.to, value: pd.value, slots: G.equip.filter(function (e) { return e.hidden; }).map(function (e) { return e.slot; }) };
    if (pd && pd.type === 'radar' && radarCommand(G)) {
      var out = { type: 'radar', id: pd.id, from: pd.from, to: pd.to, value: pd.value, waiting: pd.waiting.slice(), answers: pd.answers.slice() };
      if (pd.waiting.indexOf(pi) >= 0) out.ownAnswers = radarAnswers(G, pi, pd.value);
      return out;
    }
    if (!pd || pd.type !== 'clue' || !state) return null;
    var out = { type: 'clue', id: pd.id, step: pd.step, to: pd.to, from: pd.from, token: pd.token, kind: state.kind };
    if (pi === pd.to) {
      if (pd.step === 'choose') out.tokens = state.kind === 'pass' ? C.availableInfoTokens(G, false) : state.pool.slice();
      else { out.choices = clueChoices(G, pd); out.canPlaceAside = !out.choices.length; }
    }
    return out;
  };
  function yellowClueModule(kind) {
    return {
      yellowClues: true,
      setup: function (G) {
        G.officialState.clues = { kind: kind, side: [], pool: [], triggered: false, finished: false, setupDecisionId: ++G.actionId };
      },
      setupNeeds: function (G) {
        return G.players.map(function (_, pi) { return kind === 'pass' ? Math.min(2, missingValues(G, pi).length) : G.np === 2 && pi === G.captain ? 0 : 1; });
      },
      validateAction: function (G, pi, action) {
        if (kind === 'pass' && G.phase === 'setup' && action.a !== 'missing-clues') return '本关开局请选择自己没有的数值，一次提交全部标记';
        if (G.pending && G.pending.type === 'clue' && ['clue-select', 'clue-place'].indexOf(action.a) < 0) return '请先完成黄线触发的信息标记';
        return null;
      },
      handleAction: function (G, pi, action, ctx) {
        var state = G.officialState.clues;
        if (action.a === 'missing-clues') {
          var need = ctx.setupNeed(G, pi), values = action.values, racks = action.racks;
          if (kind !== 'pass' || G.phase !== 'setup' || pi !== ctx.setupActor(G) || action.id !== state.setupDecisionId) return { error: '这次开局标记选择已经失效，或尚未轮到你' };
          if (!Array.isArray(values) || values.length !== need || new Set(values).size !== need || values.some(function (v) { return missingValues(G, pi).indexOf(v) < 0; })) return { error: '请选择规定数量、互不相同且自己没有的数值' };
          if (!Array.isArray(racks) || racks.length !== need || racks.some(function (s) { return !Number.isInteger(s) || !G.players[pi].stands[s]; }) || G.players[pi].stands.length === 2 && new Set(racks).size !== need) return { error: '两个线架各放一个旁置标记' };
          var oral = [];
          values.forEach(function (value, index) {
            var token = C.availableInfoTokens(G, true).filter(function (t) { return t.value === value; })[0];
            if (token) { reclaimToken(G, token); state.side.push({ id: token.id, value: value, owner: pi, rack: racks[index] }); }
            else oral.push({ owner: pi, rack: racks[index], value: value });
          });
          if (oral.length) G.announcement = { side: oral };
          G.setup[pi] = need; state.setupDecisionId = ++G.actionId;
          ctx.log(G, G.players[pi].name + ' 放置了缺失值开局标记。');
          if (ctx.setupActor(G) < 0) ctx.startPlay(G);
          return { error: null };
        }
        if (action.a !== 'clue-select' && action.a !== 'clue-place') return null;
        var pd = G.pending;
        if (G.phase !== 'play' || !pd || pd.type !== 'clue' || pi !== pd.to || action.id !== pd.id) return { error: '这次信息标记选择已经失效，或尚未轮到你' };
        if (action.a === 'clue-select') {
          if (pd.step !== 'choose') return { error: '现在需要摆放已选标记' };
          var candidates = kind === 'pass' ? C.availableInfoTokens(G, false) : state.pool;
          var selected = candidates.filter(function (token) { return token.id === action.token; })[0];
          if (!selected) return { error: '此信息标记已不可用' };
          reclaimToken(G, selected);
          if (kind === 'draft') state.pool = state.pool.filter(function (token) { return token.id !== selected.id; });
          clueDecision(G, 'place', kind === 'pass' ? (pi + 1) % G.np : pi, pi, pd.index, selected);
          ctx.log(G, G.players[pi].name + ' 选择了信息标记 ' + selected.value + (kind === 'pass' ? '，交给左边的 ' + G.players[G.pending.to].name : '') + '。');
          return { error: null };
        }
        if (pd.step !== 'place') return { error: '请先选择信息标记' };
        var choices = clueChoices(G, pd), wire = G.wires[action.w];
        if (choices.length ? choices.indexOf(action.w) < 0 : action.w !== null || !Number.isInteger(action.rack) || !G.players[pi].stands[action.rack]) return { error: '请选择自己的匹配导线；没有该值时放在线架旁' };
        // 移出待放标记的保留区，再占用目标导线；被替换的原标记回到备用区。
        G.pending = null;
        if (choices.length) ctx.placeInfo(G, wire, tokenInfo(pd.token));
        else state.side.push({ id: pd.token.id, value: pd.token.value, owner: pi, rack: action.rack });
        ctx.log(G, G.players[pi].name + ' 放置了额外信息标记。');
        if (pd.index + 1 === G.np) { state.finished = true; ctx.endTurn(G); }
        else { var next = (G.captain + pd.index + 1) % G.np; clueDecision(G, 'choose', next, next, pd.index + 1); }
        return { error: null };
      },
      afterCut: function (G, ctx) {
        var state = G.officialState.clues;
        if (state.triggered || ctx.cutCount(G, 'Y') < 2) return false;
        state.triggered = true;
        if (kind === 'draft') {
          state.pool = ctx.shuffle(C.availableInfoTokens(G, false), ctx.rng).slice(0, G.np);
          state.pool.forEach(function (token) { reclaimToken(G, token); });
        }
        clueDecision(G, 'choose', G.captain, G.captain, 0);
        ctx.log(G, '前两根黄线已剪断：从队长开始，依次选择并摆放额外信息标记。');
        return true;
      },
      view: function (G, pi) {
        var state = G.officialState.clues;
        var out = { module: G.officialState.module, version: C.version, clues: kind === 'pass' ? 'missing-values' : 'yellow-draft', sideClues: state.side.slice(), cluePool: state.pool.slice(), clueEvent: { triggered: state.triggered, finished: state.finished } };
        if (kind === 'pass' && G.phase === 'setup' && pi === setupActorForView(G)) out.missingSetup = { id: state.setupDecisionId, values: missingValues(G, pi) };
        return out;
      }
    };
  }
  function setupActorForView(G) {
    for (var k = 0; k < G.np; k++) { var pi = (G.captain + k) % G.np; if (G.setup[pi] < G.setupNeeds[pi]) return pi; }
    return -1;
  }
  C.modules['missing-value-pass'] = yellowClueModule('pass');
  C.modules['yellow-info-draft'] = yellowClueModule('draft');
  function radarAnswers(G, pi, value) {
    return G.players[pi].stands.map(function (stand) { return stand.some(function (id) { var wire = G.wires[id]; return !wire.cut && wire.v === value; }); });
  }
  function commandStep(G, step) { G.officialState.command.step = step; G.officialState.command.decisionId = ++G.actionId; }
  function retireNumbers(G, ctx) {
    var state = G.officialState.command;
    for (var n = 1; n <= 12; n++) if (ctx.cutCount(G, n) === 4 && state.retired.indexOf(n) < 0) state.retired.push(n);
    state.deck = state.deck.filter(function (v) { return state.retired.indexOf(v) < 0; });
    state.discard = state.discard.filter(function (v) { return state.retired.indexOf(v) < 0; });
  }
  C.modules['radar-command'] = {
    setup: function (G, ctx) {
      G.equip = [{ n: 8, id: C.equipmentIdentity(8), used: false }]; G.equipmentReserve = [];
      G.officialState.command = { deck: ctx.shuffle(Array.from({ length: 12 }, function (_, i) { return i + 1; }), ctx.rng), discard: [], retired: [], value: null, answers: null, actor: null, step: 'draw', enteredTurn: null, decisionId: null };
    },
    equipUnlocked: function (_, n) { return n === 8; },
    allowedValue: function (G, value) { var state = G.officialState.command; return state.step === 'cut' && state.value === value; },
    enterTurn: function (G, ctx) {
      var state = G.officialState.command;
      if (state.enteredTurn === G.turnNo) return;
      state.enteredTurn = G.turnNo; state.value = null; state.answers = null; state.actor = null;
      retireNumbers(G, ctx);
      var own = G.wires.filter(function (w) { return w.o === G.turn && !w.cut; });
      commandStep(G, own.length && own.every(function (w) { return Math.round((w.v - Math.floor(w.v)) * 10) === 5; }) ? 'red' : 'draw');
    },
    afterCut: function (G, ctx) { retireNumbers(G, ctx); return false; },
    validateAction: function (G, pi, action) {
      var state = G.officialState.command;
      if (G.pending && G.pending.type === 'radar' && action.a !== 'radar-reply') return '请先让所有玩家回答雷达查询';
      if (action.a === 'equip' || action.a === 'character') return '本关只按数字卡步骤查询共享雷达，不能额外使用其他共享装备';
      if (['dual', 'dd', 'solo'].indexOf(action.a) >= 0 && (state.step !== 'cut' || pi !== state.actor)) return '请先完成数字卡、雷达回应和行动者指定';
      if (action.a === 'red' && (state.step !== 'red' || pi !== G.turn)) return '本关只有回合开始仅剩红线的轮值玩家可以公开红线';
      return null;
    },
    handleAction: function (G, pi, action, ctx) {
      var state = G.officialState.command;
      if (action.a === 'radar-reply') {
        var pd = G.pending;
        if (G.phase !== 'play' || !pd || pd.type !== 'radar' || action.id !== pd.id || pd.waiting.indexOf(pi) < 0) return { error: '这次雷达回应已经失效，或你已经回答' };
        var expected = radarAnswers(G, pi, pd.value);
        if (!Array.isArray(action.answers) || action.answers.length !== expected.length || action.answers.some(function (answer, index) { return answer !== expected[index]; })) return { error: '请按每个线架实际有没有未剪蓝线回答，不报告数量或位置' };
        pd.answers[pi] = action.answers.slice(); pd.waiting = pd.waiting.filter(function (who) { return who !== pi; });
        ctx.log(G, G.players[pi].name + ' 回答雷达：' + action.answers.map(function (answer, index) { return '第' + (index + 1) + '排' + (answer ? '有' : '没有'); }).join('、') + '。');
        if (pd.waiting.length) pd.to = pd.waiting[0];
        else { state.answers = pd.answers.slice(); G.pending = null; commandStep(G, 'choose'); }
        return { error: null };
      }
      if (['number-draw', 'radar-query', 'command-select'].indexOf(action.a) < 0) return null;
      if (G.phase !== 'play' || G.pending || pi !== G.turn || action.id !== state.decisionId) return { error: '这次回合选择已经失效，或尚未轮到你' };
      if (action.a === 'number-draw') {
        if (state.step !== 'draw') return { error: '本回合已经翻过数字卡，或应先公开红线' };
        if (!state.deck.length) { state.deck = ctx.shuffle(state.discard.slice(), ctx.rng); state.discard = []; }
        if (!state.deck.length) return { error: '没有尚未完成的蓝色数字卡' };
        state.value = state.deck.shift(); state.discard.push(state.value); commandStep(G, 'radar');
        ctx.log(G, G.players[pi].name + ' 翻开数字卡「' + state.value + '」。');
        return { error: null };
      }
      if (action.a === 'radar-query') {
        if (state.step !== 'radar') return { error: '请先翻数字卡，本回合只查询该数字一次' };
        commandStep(G, 'answers');
        var waiting = G.players.map(function (_, offset) { return (G.turn + offset) % G.np; });
        G.pending = { type: 'radar', id: state.decisionId, from: pi, to: waiting[0], value: state.value, waiting: waiting, answers: G.players.map(function () { return null; }) };
        ctx.log(G, G.players[pi].name + ' 用雷达询问蓝色数字「' + state.value + '」，每人请逐架回应。');
        return { error: null };
      }
      if (state.step !== 'choose' || !Number.isInteger(action.p) || !G.players[action.p] || !state.answers[action.p].some(Boolean)) return { error: '请选择一名雷达回答有该数字的玩家，可选择自己' };
      state.actor = action.p; commandStep(G, 'cut');
      ctx.log(G, G.players[pi].name + ' 指定 ' + G.players[action.p].name + ' 拆数字「' + state.value + '」；目标导线由行动者选择。');
      return { error: null };
    },
    view: function (G) {
      var state = G.officialState.command;
      return { module: 'radar-command', version: C.version, radarCommand: { step: state.step, value: state.value, actor: state.actor, officer: G.turn, decisionId: state.decisionId, remaining: state.deck.length, retired: state.retired.slice(), answers: state.answers } };
    }
  };
  function nextBlindNumber(G, ctx) {
    var state = G.officialState.blind;
    state.value = null; state.step = 'active';
    while (state.deck.length) {
      var value = state.deck.shift();
      if (ctx.cutCount(G, value) === 4) continue;
      state.value = value; break;
    }
  }
  C.modules['unsorted-x'] = {
    setup: function (G, ctx) {
      G.players.forEach(function (_, pi) { var last = G.wires.filter(function (w) { return w.o === pi; }).slice(-1)[0]; last.x = true; });
      ctx.resort(G);
    },
    setupInfoAllowed: function (G, wire) { return !C.isX(G, wire) && Math.round(wire.v * 10) % 10 === 0; },
    validateAction: function (G, pi, a) {
      if ((a.a === 'equip' && a.n === 2) || (a.a === 'character' && G.players[pi].character.id === 'walkie-talkies')) return '本关不使用对讲机';
      var gear = a.a === 'equip' || a.a === 'character' || a.a === 'dd' || a.xy || a.xyPersonal || a.stab;
      if (gear) {
        var ids = (a.ws || []).concat([a.w, a.w1, a.w2]).filter(function (id) { return id !== undefined; });
        if (ids.some(function (id) { return C.isX(G, G.wires[id]); })) return 'X导线不能被共享装备或个人能力影响';
      }
    },
    view: function () { return { module: 'unsorted-x', version: C.version, unsortedX: true }; }
  };
  C.modules['yellow-before-x']=Object.assign({},C.modules['unsorted-x'],{
    setup:function(G,ctx){
      var chosen=ctx.shuffle(G.wires.filter(function(w){return Number.isInteger(w.v);}),ctx.rng).slice(0,G.np),slots=[];
      chosen.forEach(function(w,i){w.o=(G.captain+i)%G.np;w.s=0;w.x=true;});
      for(var rack=0;rack<2;rack++)for(var i=0;i<G.np;i++){var owner=(G.captain+i)%G.np;if(G.players[owner].stands[rack])slots.push([owner,rack]);}
      ctx.shuffle(G.wires.filter(function(w){return chosen.indexOf(w)<0;}),ctx.rng).forEach(function(w,i){var slot=slots[i%slots.length];w.o=slot[0];w.s=slot[1];});ctx.resort(G);
    },
    validateAction:function(G,pi,a){var ordinary=C.modules['unsorted-x'].validateAction(G,pi,a);if(ordinary)return ordinary;
      var cut=['dual','dd'].indexOf(a.a)>=0||a.a==='equip'&&[3,5].indexOf(a.n)>=0||a.a==='character'&&G.players[pi].character.id==='triple-detector';
      if(C.xLocked(G)&&cut){var vals=a.vals||[a.val];if(vals.some(function(v){return !G.wires.some(function(w){return w.o===pi&&!w.cut&&!C.isX(G,w)&&(v==='Y'?Math.round((w.v-Math.floor(w.v))*10)===1:w.v===v);});}))return '四根黄线完成前，宣告须有本人非X的可剪配对线';}
      return null;
    },
    view:function(G){return {version:C.version,module:'yellow-before-x',unsortedX:true,yellowBeforeX:{locked:C.xLocked(G),cut:G.wires.filter(function(w){return w.cut&&Math.round((w.v-Math.floor(w.v))*10)===1;}).length}};}
  });
  C.modules['liar'] = {
    prepareCaptain: function (count, captain, ctx) { return ctx.shuffle(Array.from({ length: count }, function (_, pi) { return pi; }), ctx.rng)[0]; },
    setup: function (G) {
      G.officialState.liar = G.captain; G.officialState.fakeDecision = 1; G.officialState.initialIds = [];
      G.players[G.captain].dd = 0; G.players[G.captain].character.used = true; G.players[G.captain].character.removed = true;
    },
    setupNeeds: function (G) { return G.players.map(function (_, pi) { return pi === G.officialState.liar ? 2 : 1; }); },
    validateAction: function (G, pi, a) {
      if (pi === G.officialState.liar && (a.a === 'equip' || a.a === 'character' || a.a === 'dd' || a.stab || a.xy || a.xyPersonal)) return '说谎者本关没有个人装备，也不能主动使用共享装备；仍可回应对讲机与雷达';
    },
    handleAction: function (G, pi, a, ctx) {
      if (a.a !== 'info' || pi !== G.officialState.liar) return null;
      var state = G.officialState, w = G.wires[a.w];
      if (G.phase !== 'setup' || ctx.setupActor(G) !== pi || a.id !== state.fakeDecision || G.setup[pi] >= 2) return { error: '尚未轮到你，或这次错误标记选择已经失效' };
      if (!w || w.o !== pi || w.cut || Math.round(w.v * 10) % 10 !== 0 || w.info || state.initialIds.indexOf(w.id) >= 0) return { error: '请选择自己尚未标记的一根蓝线；不能标红线' };
      if (!Number.isInteger(a.val) || a.val < 1 || a.val > 12 || a.val === w.v) return { error: '请选择1–12中与该导线不同的数值' };
      ctx.placeInfo(G, w, { t: 'not', v: String(a.val) }); state.initialIds.push(w.id); state.fakeDecision++; G.setup[pi]++;
      ctx.log(G, G.players[pi].name + ' 放置了一个错误开局标记（表示不是该值）。');
      if (ctx.setupActor(G) < 0) ctx.startPlay(G);
      return { error: null };
    },
    view: function (G, pi) {
      var out = { module: 'liar', version: C.version, liar: G.officialState.liar };
      if (G.phase === 'setup' && pi === out.liar && setupActorForView(G) === pi) out.fakeSetup = { id: G.officialState.fakeDecision, usedIds: G.officialState.initialIds.slice() };
      return out;
    }
  };
  C.modules['captain-outward-wire'] = {
    setup: function (G, ctx) {
      var last = G.wires.filter(function (w) { return w.o === G.captain; }).slice(-1)[0];
      G.officialState.outwardId = last.id; ctx.resort(G);
    },
    validateAction: function (G, pi, a, ctx) {
      var ids = (a.ws || []).concat([a.w, a.w1, a.w2]).filter(function (id) { return id !== undefined; });
      if ((a.a === 'equip' || a.a === 'character' || a.a === 'dd' || a.a === 'walkie' || a.xy || a.xyPersonal || a.stab) && ids.some(function (id) { return C.isOutward(G, G.wires[id]); })) return '不能用共享装备或个人能力影响朝外导线';
      if (pi === G.captain && a.a === 'red' && G.wires.some(function (w) { return C.isOutward(G, w) && !w.cut; })) return '朝外导线须由队长推断颜色后主动公开；不能自动验证它的颜色';
      if (!G.pending && G.phase === 'play' && pi === G.turn && ctx.outwardSkipAllowed(G, pi) && (['dual', 'dd', 'solo'].indexOf(a.a) >= 0 || a.a === 'equip' && [3, 5, 9, 10].indexOf(a.n) >= 0 || a.a === 'character' && ['triple-detector', 'xy-ray'].indexOf(G.players[pi].character.id) >= 0)) return '本回合只能与队长的朝外线配对，须跳过并前进一格';
    },
    view: function (G) { return { module: 'captain-outward-wire', version: C.version, outwardId: G.officialState.outwardId }; }
  };
  C.modules['all-outward-wires']={
    setup:function(G,ctx){G.officialState.outwardIds=G.players.map(function(_,owner){return ctx.shuffle(G.wires.filter(function(w){return w.o===owner;}),ctx.rng)[0].id;});ctx.resort(G);},
    validateAction:function(G,pi,a){var ids=(a.ws||[]).concat([a.w,a.w1,a.w2]).filter(function(id){return id!==undefined;});if((a.a==='equip'||a.a==='character'||a.a==='dd'||a.a==='walkie'||a.xy||a.xyPersonal||a.stab)&&ids.some(function(id){return C.isOutward(G,G.wires[id]);}))return '不能用共享或个人装备影响朝外导线';if(a.a==='red'&&G.wires.some(function(w){return w.o===pi&&!w.cut&&C.isOutward(G,w);}))return '请先推断自己的朝外线是否为红色，再主动公开';},
    afterCut:function(G,ctx){var target=G.lastAct&&G.lastAct.ids[0];if(target!==undefined&&C.isOutward(G,G.wires[target])&&G.wires[target].o!==G.turn){G.det++;ctx.log(G,'剪到了队友的朝外导线，引爆器额外前进一格。','bad');}return false;},
    view:function(G){return {module:'all-outward-wires',version:C.version,outwardIds:G.officialState.outwardIds.slice(),outwardId:G.officialState.outwardIds[G.turn]};}
  };
  C.modules['double-outward-wires']={
    setup:function(G,ctx){G.officialState.outwardGroups=G.players.map(function(p,owner){var pair=ctx.shuffle(G.wires.filter(function(w){return w.o===owner;}),ctx.rng).slice(0,2).sort(function(a,b){return a.v-b.v||a.id-b.id;});pair[0].s=0;pair[1].s=p.stands.length-1;return pair.map(function(w){return w.id;});});ctx.resort(G);},
    validateAction:C.modules['all-outward-wires'].validateAction,
    afterCut:C.modules['all-outward-wires'].afterCut,
    view:function(G){return {module:'double-outward-wires',version:C.version,outwardGroups:G.officialState.outwardGroups.map(function(ids){return ids.slice();}),outwardId:C.outwardId(G)};}
  };
  function cleanSecretNumbers(G, ctx) {
    var state = G.officialState.secretNumbers;
    var remaining = Array.from({ length: 12 }, function (_, i) { return i + 1; }).filter(function (v) { return ctx.cutCount(G, v) < 4; });
    for (var v = 1; v <= 12; v++) if (ctx.cutCount(G, v) === 4 || remaining.length === 1 && remaining[0] === v) {
      if (state.retired.indexOf(v) < 0) state.retired.push(v);
      state.deck = state.deck.filter(function (x) { return x !== v; });
      state.hands = state.hands.map(function (hand) { return hand.filter(function (x) { return x !== v; }); });
      // 最后唯一待剪值立即弃牌；已完成的本回合秘密牌仍按步骤3公开结算。
      if (state.chosen && remaining.length === 1 && remaining[0] === v && state.chosen.value === v) state.chosen = null;
    }
    state.hands.forEach(function (hand, pi) {
      if (!G.wires.some(function (w) { return w.o === pi && !w.cut; })) { state.deck = state.deck.concat(hand); state.hands[pi] = []; }
      else if (hand.length === 1 && state.deck.length) hand.push(state.deck.shift());
    });
  }
  C.modules['secret-number-pass'] = {
    setup: function (G, ctx) {
      var deck = ctx.shuffle(Array.from({ length: 12 }, function (_, i) { return i + 1; }), ctx.rng);
      var hands = G.players.map(function () { return deck.splice(0, 2); });
      hands[(G.captain + G.np - 1) % G.np].push(deck.shift());
      G.officialState.secretNumbers = { hands: hands, deck: deck, retired: [], chosen: null, cutValues: [], lastReveal: null };
    },
    setupNeeds: function (G) { return G.players.map(function (_, pi) { return G.np === 2 && pi === G.captain ? 0 : 1; }); },
    enterTurn: function (G, ctx) {
      var state = G.officialState.secretNumbers; cleanSecretNumbers(G, ctx); state.cutValues = []; state.lastReveal = null;
      for (var k = 1; k <= G.np; k++) {
        var owner = (G.turn - k + G.np) % G.np;
        if (state.hands[owner].length) { G.pending = { type: 'secret-number', step: 'choose', id: ++G.actionId, from: G.turn, to: owner }; return; }
      }
    },
    afterCut: function (G, ctx) {
      var state = G.officialState.secretNumbers;
      state.cutValues = (G.lastAct && G.lastAct.ids || []).map(function (id) { return G.wires[id].v; }).filter(Number.isInteger);
      cleanSecretNumbers(G, ctx); return false;
    },
    finishTurn: function (G, ctx, nextIdx) {
      var state = G.officialState.secretNumbers;
      if (!state.chosen || G.phase !== 'play') return false;
      if (nextIdx !== undefined) {
        var coffeeValue = state.chosen.value;
        if (state.retired.indexOf(coffeeValue) < 0) state.hands[G.turn].push(coffeeValue);
        state.chosen = null; cleanSecretNumbers(G, ctx);
        ctx.log(G, '咖啡杯跳过拆线：行动者直接收下秘密数字牌，不公开、不追加处罚。'); return false;
      }
      state.nextIdx = nextIdx == null ? null : nextIdx;
      G.pending = { type: 'secret-number', step: 'reveal', id: ++G.actionId, from: G.turn, to: state.chosen.owner }; return true;
    },
    handleAction: function (G, pi, a, ctx) {
      if (a.a !== 'secret-choose' && a.a !== 'secret-reveal') return null;
      var pd = G.pending, state = G.officialState.secretNumbers;
      if (G.phase !== 'play' || !pd || pd.type !== 'secret-number' || pd.to !== pi || a.id !== pd.id) return { error: '尚未轮到你，或这次秘密数字牌选择已经失效' };
      if (a.a === 'secret-choose') {
        if (pd.step !== 'choose' || state.hands[pi].indexOf(a.value) < 0) return { error: '请选择自己持有的一张秘密数字牌' };
        state.hands[pi].splice(state.hands[pi].indexOf(a.value), 1); state.chosen = { owner: pi, value: a.value }; G.pending = null; cleanSecretNumbers(G, ctx);
        ctx.log(G, G.players[pi].name + ' 放下了一张秘密数字牌；等待 ' + G.players[G.turn].name + ' 行动。'); return { error: null };
      }
      if (pd.step !== 'reveal' || !state.chosen) return { error: '现在不能公开秘密数字牌' };
      var value = state.chosen.value, actor = pd.from, penalty = state.cutValues.indexOf(value) >= 0;
      state.lastReveal = { value: value, owner: pi, actor: actor, penalty: penalty };
      ctx.log(G, G.players[pi].name + ' 公开数字牌「' + value + '」：' + (penalty ? '本回合剪了此值，引爆器前进一格。' : '本回合未剪此值，不追加处罚。'));
      if (penalty) G.det++;
      if (state.retired.indexOf(value) < 0) state.hands[actor].push(value);
      state.chosen = null; G.pending = null; cleanSecretNumbers(G, ctx);
      if (G.det >= G.detMax) ctx.lose(G, '秘密数字牌命中本回合剪线，引爆器到达尽头。');
      else { var next = state.nextIdx; state.nextIdx = null; ctx.endTurn(G, next == null ? undefined : next); }
      return { error: null };
    },
    pendingView: function (G, pi) {
      var pd = G.pending; if (!pd || pd.type !== 'secret-number') return null;
      var out = { type: pd.type, step: pd.step, id: pd.id, from: pd.from, to: pd.to };
      if (pd.step === 'choose' && pi === pd.to) out.choices = G.officialState.secretNumbers.hands[pi].slice();
      return out;
    },
    view: function (G, pi) {
      var state = G.officialState.secretNumbers;
      return { module: 'secret-number-pass', version: C.version, secretNumbers: { hand: pi >= 0 ? state.hands[pi].slice() : [], deckCount: state.deck.length, retired: state.retired.slice(), picked: !!state.chosen, lastReveal: state.lastReveal } };
    }
  };
  C.modules['unequipped-captain'] = {
    setup: function (G) {
      G.officialState.unequippedCaptain = G.captain;
      G.players[G.captain].dd = 0; G.players[G.captain].character.used = true; G.players[G.captain].character.removed = true;
    },
    validateAction: function (G, pi, a) {
      if (pi === G.officialState.unequippedCaptain && (a.a === 'equip' || a.a === 'character' || a.a === 'dd' || a.stab || a.xy || a.xyPersonal)) return '本关队长没有个人装备，不能主动使用共享装备；仍可回应对讲机与雷达';
      if ((a.stab || a.a === 'equip' && a.n === 9) && !C.stabilizerAllowed(G, pi)) return '稳定器不能保护本关队长的拆线';
    },
    cutFailureReason: function (G, actor) { return actor === G.officialState.unequippedCaptain ? '队长 ' + G.players[actor].name + ' 的双人拆线失败，炸弹立即爆炸。' : null; },
    view: function (G) { return { module: 'unequipped-captain', version: C.version, unequippedCaptain: G.officialState.unequippedCaptain }; }
  };
  C.modules['rookie'] = {
    // 任务设置先重新分发含队长卡的角色；持队长卡者当新人，再按身份分架与开局。
    prepareCaptain: function (count, captain, ctx) { return ctx.shuffle(Array.from({ length: count }, function (_, pi) { return pi; }), ctx.rng)[0]; },
    setup: function (G) { G.officialState.rookie = G.captain; },
    validateAction: function (G, pi, action) {
      if ((action.stab || action.a === 'equip' && action.n === 9) && !C.stabilizerAllowed(G, pi)) return '新人不能使用稳定器，也不能由队友在新人的回合代为保护';
      return null;
    },
    cutFailureReason: function (G, actor) { return actor === G.officialState.rookie ? '新人 ' + G.players[actor].name + ' 的双人拆线失败，炸弹立即爆炸。' : null; },
    view: function (G) { return { module: 'rookie', version: C.version, rookie: G.officialState.rookie }; }
  };
  function riskyRed(wire) { return wire.kind ? wire.kind === 'r' : Math.round((wire.v - Math.floor(wire.v)) * 10) === 5; }
  function initialTokenMatches(wire,token){return token.value==='Y'?Math.round(wire.v*10)%10===1:wire.v===token.value;}
  function riskySetup(G, ctx) {
    var pi = ctx.setupActor(G);
    if (pi < 0) { ctx.startPlay(G); return true; }
    var token = ctx.shuffle(C.availableInfoTokens(G, !!(moduleFor(G)&&moduleFor(G).randomInitialYellow)), ctx.rng)[0];
    G.pending = { type: 'initial-clue', id: ++G.actionId, from: pi, to: pi, token: token };
    ctx.log(G, G.players[pi].name + ' 随机抽到开局信息标记「' + (token.value==='Y'?'黄':token.value) + '」。');
    return true;
  }
  C.modules['risky-red-cut'] = {
    setup: function (G, ctx) {
      var reds = ctx.shuffle(G.wires.filter(riskyRed), ctx.rng);
      var blues = ctx.shuffle(G.wires.filter(function (w) { return !riskyRed(w); }), ctx.rng), slots = [];
      for (var rack = 0; rack < 2; rack++) for (var k = 0; k < G.np; k++) {
        var owner = (G.captain + k) % G.np;
        if (G.players[owner].stands[rack]) slots.push([owner, rack]);
      }
      reds.forEach(function (w, index) {
        w.o = (G.captain + index) % G.np;
        w.s = G.np === 2 && w.o === G.captain ? index === 2 ? 1 : 0 : Math.floor(ctx.rng() * G.players[w.o].stands.length);
      });
      // 先发红线，再补齐各架：总导线仍尽量均分，架长不能泄露一根红线所在架。
      var filled = slots.map(function (slot) { return reds.filter(function (w) { return w.o === slot[0] && w.s === slot[1]; }).length; });
      var target = slots.map(function (_, index) { return Math.floor(G.wires.length / slots.length) + (index < G.wires.length % slots.length ? 1 : 0); });
      var index = 0;
      blues.forEach(function (w) {
        while (filled[index % slots.length] >= target[index % slots.length]) index++;
        var slot = index++ % slots.length; w.o = slots[slot][0]; w.s = slots[slot][1]; filled[slot]++;
      });
      G.officialState.risky = { side: [] };
      ctx.resort(G);
    },
    setupNeeds: function (G) { return G.players.map(function (_, pi) { return G.np === 2 && pi === G.captain ? 0 : 1; }); },
    beginSetup: riskySetup,
    reservedTokens: function (G) {
      return G.officialState.risky.side.concat(G.pending && G.pending.type === 'initial-clue' ? [G.pending.token] : []);
    },
    validateAction: function (G, pi, a) {
      if (a.a === 'red') return '本关不能公开红线，请用冒险拆线一次选中三根红线';
      if (G.phase === 'setup' && a.a !== 'initial-clue') return '请先完成随机开局标记';
      if (G.pending && ['initial-clue', 'risky-cut'].indexOf(G.pending.type) >= 0 && a.a !== (G.pending.type === 'risky-cut' ? 'risky-reply' : G.pending.type)) return '请先完成当前任务决定';
      var own = G.wires.filter(function (w) { return w.o === pi && !w.cut; });
      if (G.phase === 'play' && !G.pending && pi === G.turn && own.length && own.every(riskyRed) &&
          (['dual', 'dd', 'solo'].indexOf(a.a) >= 0 || a.a === 'equip' && [3, 5, 10, 11].indexOf(a.n) >= 0))
        return '你只剩红线，必须进行冒险拆线';
      return null;
    },
    handleAction: function (G, pi, a, ctx) {
      if (a.a === 'initial-clue') {
        var pd = G.pending;
        if (G.phase !== 'setup' || !pd || pd.type !== a.a || pd.to !== pi || a.id !== pd.id) return { error: '这次开局决定已经失效或未轮到你' };
        var choices = G.wires.filter(function (w) { return w.o === pi && !w.cut && initialTokenMatches(w,pd.token); });
        if (choices.length) {
          if (!choices.some(function (w) { return w.id === a.w; })) return { error: '请把随机标记放在自己任意一根对应导线上' };
          G.pending = null;
          if (!ctx.placeInfo(G, G.wires[a.w], tokenInfo(pd.token))) return { error: '信息标记不可用' };
        } else {
          if (a.w !== null || !Number.isInteger(a.rack) || !G.players[pi].stands[a.rack]) return { error: '你没有该值，请选择旁置信息标记的线架' };
          G.officialState.risky.side.push(Object.assign({}, pd.token, { owner: pi, rack: a.rack })); G.pending = null;
        }
        G.setup[pi]++;
        ctx.log(G, G.players[pi].name + ' 放好了随机开局标记。'); riskySetup(G, ctx); return { error: null };
      }
      if (a.a === 'risky-cut') {
        if (G.phase !== 'play' || G.pending || G.turn !== pi) return { error: '请在自己的回合且没有待处理决定时进行冒险拆线' };
        if (a.stab || a.xy || a.xyPersonal || a.vals || a.n || a.character) return { error: '冒险拆线不能组合装备或个人能力' };
        var mine = G.wires.filter(function (w) { return w.o === pi && !w.cut; });
        if (!mine.length || G.np <= 3 && !mine.some(riskyRed)) return { error: '两人或三人局必须自己持有红线才能进行冒险拆线' };
        if (!Array.isArray(a.ws) || a.ws.length !== 3 || new Set(a.ws).size !== 3 || a.ws.some(function (id) { return !Number.isInteger(id) || !G.wires[id] || G.wires[id].cut; })) return { error: '请选择三根不同的未剪导线，可以跨玩家和线架' };
        var owners = [];
        a.ws.forEach(function (id) { var o = G.wires[id].o; if (owners.indexOf(o) < 0) owners.push(o); });
        var id = ++G.actionId;
        G.pending = { type: 'risky-cut', id: id, from: pi, to: owners[0], ids: a.ws.slice(), vals: ['R'], waiting: owners, answers: [] };
        G.declaration = { type: 'risky-cut', id: id, from: pi, to: owners[0], ids: a.ws.slice(), vals: ['R'], answers: [] };
        ctx.log(G, G.players[pi].name + ' 宣告冒险拆线：选中的三根都是红线。'); return { error: null };
      }
      if (a.a === 'risky-reply') {
        var pd = G.pending;
        if (G.phase !== 'play' || !pd || pd.type !== 'risky-cut' || a.id !== pd.id || pd.to !== pi) return { error: '这次冒险拆线回应已经失效或未轮到你' };
        var answers = pd.ids.filter(function (id) { return G.wires[id].o === pi; }).map(function (id) { return { wire: id, red: riskyRed(G.wires[id]) }; });
        pd.answers = pd.answers.concat(answers); G.declaration = Object.assign({}, G.declaration, { answers: pd.answers.slice() });
        ctx.log(G, G.players[pi].name + ' 公开回应：' + (answers.every(function (answer) { return answer.red; }) ? '我被选中的导线都是红线。' : '我被选中的导线并非全是红线。'));
        if (answers.some(function (answer) { return !answer.red; })) {
          G.declaration.result = { matched: false }; G.lastAct = { t: 'boom', ids: pd.ids.slice() }; G.pending = null;
          ctx.lose(G, '冒险拆线选中了非红线……炸弹爆炸了。'); return { error: null };
        }
        pd.waiting.shift();
        if (pd.waiting.length) { pd.to = pd.waiting[0]; return { error: null }; }
        pd.ids.forEach(function (id) { ctx.cutWire(G, G.wires[id]); G.wires[id].resolution = 'cut'; });
        G.lastAct = { t: 'hit', ids: pd.ids.slice() }; G.declaration.result = { matched: true };
        G.pending = null; ctx.log(G, '冒险拆线成功：三根红线同时剪断。', 'good'); ctx.endTurn(G); return { error: null };
      }
      return null;
    },
    pendingView: function (G, pi) {
      var pd = G.pending;
      if (!pd || ['initial-clue', 'risky-cut'].indexOf(pd.type) < 0) return null;
      var out = { type: pd.type, id: pd.id, from: pd.from, to: pd.to };
      if (pd.type === 'initial-clue') {
        out.token = pd.token;
        if (pi === pd.to) { out.choices = G.wires.filter(function (w) { return w.o === pi && initialTokenMatches(w,pd.token); }).map(function (w) { return w.id; }); out.canPlaceAside = !out.choices.length; }
      }
      if (pd.type === 'risky-cut') {
        out.ids = pd.ids.slice(); out.vals = ['R']; out.answers = pd.answers.slice(); out.waiting = pd.waiting.slice();
        if (pi === pd.to) out.ownAnswers = pd.ids.filter(function (id) { return G.wires[id].o === pi; }).map(function (id) { return { wire: id, red: riskyRed(G.wires[id]) }; });
      }
      return out;
    },
    view: function (G) { return { module: 'risky-red-cut', version: C.version, riskyRedCut: true, sideClues: G.officialState.risky.side.slice() }; }
  };
  C.modules['blue-as-red'] = {
    setup: function (G, ctx) {
      var number = ctx.shuffle(Array.from({ length: 12 }, function (_, i) { return i + 1; }), ctx.rng)[0];
      G.officialState.redNumber = number;
      G.wires.forEach(function (wire) { if (wire.v === number) wire.kind = 'r'; });
      // 抽到同编号装备时换牌；该牌也不得留在底盒可抽取的储备中。
      G.equipmentReserve = G.equipmentReserve.filter(function (n) { return n !== number; });
      G.equip = G.equip.map(function (e) {
        if (e.n !== number) return e;
        var n = G.equipmentReserve.shift();
        return { n: n, id: C.equipmentIdentity(n), used: false };
      }).sort(function (a, b) { return a.n - b.n; });
    },
    setupNeeds: function (G) { return G.players.map(function (_, pi) { return G.np === 2 && pi === G.captain ? 0 : 1; }); },
    setupInfoAllowed: function (_, wire) { return Number.isInteger(wire.v); },
    view: function (G) { return { module: 'blue-as-red', version: C.version, redNumber: G.officialState.redNumber }; }
  };
  function doubleUnlockConditions(G, e, ctx) {
    var printed = C.unlock(e.n);
    return [
      { kind: 'printed', value: printed.value, count: ctx.cutCount(G, printed.value), required: printed.count },
      { kind: 'number', value: e.numberUnlock, count: ctx.cutCount(G, e.numberUnlock), required: 2, discarded: !!e.numberDiscarded }
    ].map(function (condition) { condition.met = condition.count >= condition.required; return condition; });
  }
  function refreshDoubleUnlock(G, equipment, ctx) {
    equipment.forEach(function (e) {
      var conditions = doubleUnlockConditions(G, e, ctx);
      // 数字卡达标就移入弃牌堆；不必等待装备印刷条件也达标。
      if (!e.numberDiscarded && conditions[1].met) {
        e.numberDiscarded = true;
        G.officialState.equipmentNumbers.discarded.push(e.numberUnlock);
      }
      var ready = conditions.every(function (condition) { return condition.met; });
      if (ready && !e.doubleReady) ctx.log(G, '🔓 装备「' + ctx.equipmentName(e.n) + '」的两项条件都已满足，可以使用。', 'good');
      e.doubleReady = ready;
    });
  }
  C.modules['double-equipment-unlock'] = {
    setup: function (G, ctx) {
      G.officialState.equipmentNumbers = { deck: ctx.shuffle(Array.from({ length: 12 }, function (_, i) { return i + 1; }), ctx.rng), discarded: [] };
      this.equipmentAdded(G, G.equip, ctx);
    },
    equipmentAdded: function (G, equipment, ctx) {
      var state = G.officialState.equipmentNumbers;
      if (state.deck.length < equipment.length) throw new Error('第12关没有足够的数字卡分配给新增装备');
      equipment.forEach(function (e) { e.numberUnlock = state.deck.shift(); e.numberDiscarded = false; e.doubleReady = false; });
      refreshDoubleUnlock(G, equipment, ctx);
    },
    equipUnlocked: function (G, n, ctx) {
      var e = G.equip.filter(function (card) { return card.n === n; })[0];
      return !!e && doubleUnlockConditions(G, e, ctx).every(function (condition) { return condition.met; });
    },
    equipmentView: function (G, e, ctx) {
      var conditions = doubleUnlockConditions(G, e, ctx);
      return { n: e.n, id: e.id, used: !!e.used, open: conditions.every(function (condition) { return condition.met; }), unlockConditions: conditions };
    },
    validateAction: function (G, pi, action, ctx) {
      if (action.a === 'equip' && G.equip.some(function (e) { return e.n === action.n; }) && !this.equipUnlocked(G, action.n, ctx))
        return '第12关需要同时满足装备印刷条件和附加数字卡条件；两项各剪两根，同值时同一对即可';
      return null;
    },
    afterCut: function (G, ctx) { refreshDoubleUnlock(G, G.equip, ctx); return false; },
    view: function () { return { module: 'double-equipment-unlock', version: C.version, doubleEquipmentUnlock: true }; }
  };
  C.modules['blind-equipment'] = {
    setup: function (G, ctx) {
      // 抽选后再洗背面装备；不能按隐藏编号排序而泄露相邻牌的范围。
      G.equip = ctx.shuffle(G.equip.slice(), ctx.rng).map(function (e, index) { e.hidden = true; e.slot = 'back-' + index; return e; });
      G.officialState.blind = { deck: ctx.shuffle(Array.from({ length: 12 }, function (_, i) { return i + 1; }), ctx.rng), value: null, step: 'active' };
      nextBlindNumber(G, ctx);
    },
    equipUnlocked: function (G, n) { return G.equip.some(function (e) { return e.n === n && !e.hidden; }); },
    equipmentView: function (G, e) {
      return e.hidden ? { slot: e.slot, hidden: true, used: false, open: false } : { n: e.n, id: e.id, slot: e.slot, hidden: false, used: !!e.used, open: true };
    },
    validateAction: function (G, pi, action) {
      if (G.pending && G.pending.type === 'equipment-reveal' && action.a !== 'equipment-reveal') return '请先由队伍选择翻开一张背面装备，或放弃这次奖励';
      // 隐藏卡与未抽到的卡返回相同信息，不能用拒绝理由探测隐藏身份。
      if (action.a === 'equip' && !G.equip.some(function (e) { return e.n === action.n && !e.hidden; })) return '请先翻开这张装备；不能查看或使用背面装备';
      return null;
    },
    afterCut: function (G, ctx) {
      var state = G.officialState.blind;
      if (state.value == null || ctx.cutCount(G, state.value) !== 4) return false;
      if (!G.equip.some(function (e) { return e.hidden; }) || G.wires.every(function (w) { return w.cut; })) { nextBlindNumber(G, ctx); return false; }
      state.step = 'reward';
      G.pending = { type: 'equipment-reveal', id: ++G.actionId, from: G.turn, to: G.turn, value: state.value };
      ctx.log(G, '当前数字「' + state.value + '」的四根蓝线已完成，队伍可盲翻一张背面装备。');
      return true;
    },
    handleAction: function (G, pi, action, ctx) {
      if (action.a !== 'equipment-reveal') return null;
      var pd = G.pending;
      if (G.phase !== 'play' || !pd || pd.type !== 'equipment-reveal' || action.id !== pd.id) return { error: '这次装备奖励选择已经失效' };
      var e = G.equip.filter(function (card) { return card.slot === action.slot && card.hidden; })[0];
      if (action.slot !== null && !e) return { error: '请选择一张仍背面朝上的装备' };
      if (e) { e.hidden = false; ctx.log(G, G.players[pi].name + ' 代表队伍翻开「' + ctx.equipmentName(e.n) + '」，无需编号解锁即可使用。'); }
      else ctx.log(G, G.players[pi].name + ' 代表队伍放弃这次翻装备奖励。');
      G.pending = null; nextBlindNumber(G, ctx); ctx.endTurn(G);
      return { error: null };
    },
    view: function (G) {
      var state = G.officialState.blind;
      return { module: 'blind-equipment', version: C.version, blindEquipment: { value: state.value, step: state.step, remaining: state.deck.length, hidden: G.equip.filter(function (e) { return e.hidden; }).length } };
    }
  };
  C.reusableCharacter = function (G) {
    var module = moduleFor(G);
    return !!(module && module.reusableCharacter);
  };
  C.frequencyClues = function (G) { return G.officialState && ['frequency', 'mixed-clues'].indexOf(G.officialState.module) >= 0; };
  C.clueKind = function (G, pi) {
    var state = G.officialState || G.official;
    if (!state || state.version !== C.version) return null;
    if (state.module === 'mixed-clues') return ((pi - G.captain + G.np) % G.np) % 2 === 0 ? 'frequency' : 'parity';
    return state.module === 'frequency' || state.module === 'parity' ? state.module : null;
  };
  C.cutClueAllowed = function (G) {
    var state = G.officialState || G.official;
    return !!(state && state.version === C.version && ['frequency', 'mixed-clues'].indexOf(state.module) >= 0);
  };
  C.communicationRule = function (G) {
    return G.officialState ? !!moduleFor(G) && G.officialState.module === 'nonverbal-values' : !!(G.official && G.official.communication === 'nonverbal-values');
  };
  C.modules['nonverbal-values'] = {
    setup: function (G) { G.officialState.communicationPenalties = 0; },
    handleAction: function (G, pi, action, ctx) {
      if (action.a !== 'communication-penalty') return null;
      if (G.phase !== 'play') return { error: '开始拆线后才记录说出数值的违规' };
      G.officialState.communicationPenalties++;
      G.det++;
      ctx.log(G, G.players[pi].name + ' 记录一次说出导线数值的违规，引爆器前进一格。', 'bad');
      if (G.det >= G.detMax) { G.pending = null; ctx.lose(G, '说出导线数值的处罚使引爆器到达尽头。'); }
      return { error: null };
    },
    view: function (G) { return { module: 'nonverbal-values', version: C.version, communication: 'nonverbal-values', communicationPenalties: G.officialState.communicationPenalties }; }
  };
  function sequenceModule(side, threshold) {
    return {
      setup: function (G, ctx) {
        var numbers = Array.from({ length: 12 }, function (_, i) { return i + 1; });
        G.seq = ctx.shuffle(numbers, ctx.rng).slice(0, 3);
        G.officialState.sequence = { side: side, threshold: threshold };
      },
      allowedValue: function (G, value, ctx) {
        var index = G.seq.indexOf(value);
        if (index <= 0) return true; // Other blue values and yellow are unrestricted.
        for (var i = 0; i < index; i++) if (ctx.cutCount(G, G.seq[i]) < threshold) return false;
        return true;
      },
      enterTurn: function (G, ctx) {
        if (G.phase === 'play' && !ctx.canAct(G, G.turn))
          ctx.lose(G, '当前玩家没有合法拆线行动，顺序任务失败。');
      },
      view: function (G) {
        return { module: G.officialState.module, version: C.version,
          sequence: { side: side, threshold: threshold, values: G.seq.slice() } };
      }
    };
  }
  C.modules['sequence-a'] = sequenceModule('A', 2);
  C.modules['sequence-b'] = sequenceModule('B', 4);
  C.modules['parity'] = {
    infoFor: function (G, wire) {
      if (!Number.isInteger(wire.v)) return null;
      return { t: wire.v % 2 === 0 ? 'even' : 'odd' };
    },
    tokenLimit: function (G, info) { return info.t === 'odd' || info.t === 'even' ? 11 : null; },
    view: function () { return { module: 'parity', version: C.version, clues: 'parity' }; }
  };
  C.modules['frequency'] = {
    infoFor: function (G, wire) {
      if (!Number.isInteger(wire.v)) return null;
      var count = G.wires.filter(function (w) { return w.o === wire.o && w.s === wire.s && w.v === wire.v; }).length;
      return count === 4 ? { t: 'freq', v: 2, copies: 2 } : { t: 'freq', v: count };
    },
    tokenLimit: function (G, info) { return info.t === 'freq' ? 7 : null; },
    view: function () { return { module: 'frequency', version: C.version, clues: 'frequency' }; }
  };
  C.modules['mixed-clues'] = {
    setupNeeds: function (G) { return G.players.map(function (_, pi) { return G.np === 2 && pi === G.captain ? 0 : 1; }); },
    infoFor: function (G, wire) { return C.modules[C.clueKind(G, wire.o)].infoFor(G, wire); },
    tokenLimit: function (G, info) { return info.t === 'freq' ? 7 : info.t === 'odd' || info.t === 'even' ? 11 : null; },
    view: function (G) { return { module: 'mixed-clues', version: C.version, clues: 'mixed', clueKinds: G.players.map(function (_, pi) { return C.clueKind(G, pi); }) }; }
  };
  C.numberEnds = function (G) {
    var state = G.officialState || G.official;
    return state && state.version === C.version && state.module === 'number-ends' ? state.numberEnds : null;
  };
  function endChoice(G, who, initial) {
    G.pending = { type: 'sequence-end', id: ++G.actionId, from: who, to: who, initial: !!initial };
  }
  C.modules['number-ends'] = {
    setup: function (G, ctx) {
      G.officialState.numberEnds = { row: ctx.shuffle(Array.from({length:12}, function (_,i) { return i+1; }), ctx.rng).slice(0,5), end: null, removed: [] };
    },
    beginSetup: function (G) { G.phase = 'sequence'; endChoice(G, G.captain, true); return true; },
    allowedValue: function (G, value) {
      var state = C.numberEnds(G), row = state.row;
      return row.indexOf(value) < 0 || state.end != null && value === row[state.end === 'left' ? 0 : row.length-1];
    },
    validateAction: function (G, pi, a) {
      if (G.pending && G.pending.type === 'sequence-end' && a.a !== 'sequence-end') return '请先由指定玩家选择数字序列的下一端';
      return null;
    },
    handleAction: function (G, pi, a, ctx) {
      if (a.a !== 'sequence-end') return null;
      var pd = G.pending, state = C.numberEnds(G);
      if (!pd || pd.type !== 'sequence-end' || pd.to !== pi || a.id !== pd.id || ['left','right'].indexOf(a.end) < 0) return { error: '这次数字序列选择已经失效，或尚未轮到你' };
      state.end = a.end; G.pending = null;
      ctx.log(G, G.players[pi].name + ' 选择从数字序列' + (a.end === 'left' ? '左端' : '右端') + '继续。');
      if (pd.initial) { G.phase = 'setup'; if (ctx.setupActor(G) < 0) ctx.startPlay(G); }
      else ctx.endTurn(G);
      return { error: null };
    },
    afterCut: function (G, ctx) {
      var state = C.numberEnds(G), row = state.row;
      if (!row.length) return false;
      var value = row[state.end === 'left' ? 0 : row.length-1];
      var count = (G.lastAct && G.lastAct.ids || []).filter(function (id) { return G.wires[id].v === value; }).length;
      if (count < 2) return false;
      row.splice(state.end === 'left' ? 0 : row.length-1, 1); state.removed.push(value);
      ctx.log(G, '已剪至少两根「' + value + '」，移除该数字牌。');
      if (!row.length) return false;
      endChoice(G, G.turn, false); return true;
    },
    enterTurn: function (G, ctx) {
      if (!ctx.canAct(G, G.turn)) ctx.lose(G, '当前玩家只剩不能按数字序列拆除的导线，任务失败。');
    },
    pendingView: function (G, pi) {
      var pd = G.pending; if (!pd || pd.type !== 'sequence-end') return null;
      var out = { type: pd.type, id: pd.id, from: pd.from, to: pd.to, initial: pd.initial };
      if (pi === pd.to) out.choices = ['left','right'];
      return out;
    },
    view: function (G) { var state = C.numberEnds(G); return { module: 'number-ends', version: C.version, numberEnds: { row: state.row.slice(), end: state.end, removed: state.removed.slice() } }; }
  };
  C.modules['precision-four'] = {
    setup: function (G, ctx) {
      G.equip = ctx.shuffle(G.equip.slice(), ctx.rng).map(function (e,i) { e.hidden = true; e.slot = 'precision-back-'+i; return e; });
      G.equipmentReserve = [];
      G.officialState.precision = { value: null, nextValue: ctx.shuffle(Array.from({length:12},function(_,i){return i+1;}),ctx.rng)[0], complete:false, discarded:0, rounds:0 };
    },
    enterTurn: function (G) { var state=G.officialState.precision; if(state.value==null){state.value=state.nextValue;delete state.nextValue;} },
    allowedValue: function (G,value) { var state=G.officialState.precision; return state.complete || value!==state.value; },
    equipUnlocked: function (G,n) { return G.officialState.precision.complete && G.equip.some(function(e){return e.n===n;}); },
    equipmentView: function (G,e) { return e.hidden ? {slot:e.slot,hidden:true,used:false,open:false} : {n:e.n,id:e.id,used:!!e.used,open:true}; },
    validateAction: function (G,pi,a) {
      if(G.pending && G.pending.type==='precision-cut' && a.a!=='precision-reply')return '请先由被选玩家公开回应四根导线';
      if(a.a==='equip'&&!G.officialState.precision.complete)return '完成精准拆线前，背面装备不能查看或使用';
      return null;
    },
    finishTurn: function (G,ctx) {
      var state=G.officialState.precision;
      var next=ctx.nextPlayer(G,G.turn),from=(G.turn-G.captain+G.np)%G.np,to=(next-G.captain+G.np)%G.np;
      if(!state.complete && to<=from){state.rounds++;if(G.equip.length){G.equip.shift();state.discarded++;ctx.log(G,'一轮结束，背面弃掉一张装备。');}}
      return false;
    },
    handleAction: function (G,pi,a,ctx) {
      var state=G.officialState.precision;
      if(a.a==='precision-cut'){
        if(G.phase!=='play'||G.pending||G.turn!==pi||state.complete)return {error:'只能在自己的回合、精准拆线尚未完成时使用'};
        if(a.stab||a.xy||a.xyPersonal||a.vals||a.n||a.character||G.stab)return {error:'精准拆线不能组合装备或个人能力'};
        if(!Array.isArray(a.ws)||a.ws.length!==4||new Set(a.ws).size!==4||a.ws.some(function(id){return !Number.isInteger(id)||!G.wires[id]||G.wires[id].cut;}))return {error:'请选择四根不同的未剪导线，可跨玩家和线架'};
        var owners=[];a.ws.forEach(function(id){var o=G.wires[id].o;if(owners.indexOf(o)<0)owners.push(o);});
        var id=++G.actionId;G.pending={type:'precision-cut',id:id,from:pi,to:owners[0],ids:a.ws.slice(),vals:[state.value],waiting:owners,answers:[]};
        G.declaration={type:'precision-cut',id:id,from:pi,to:owners[0],ids:a.ws.slice(),vals:[state.value],answers:[]};ctx.log(G,G.players[pi].name+' 宣告四根选中导线都是「'+state.value+'」。');return {error:null};
      }
      if(a.a!=='precision-reply')return null;
      var pd=G.pending;if(G.phase!=='play'||!pd||pd.type!=='precision-cut'||a.id!==pd.id||pd.to!==pi)return {error:'这次精准拆线回应已失效，或未轮到你'};
      var answers=pd.ids.filter(function(id){return G.wires[id].o===pi;}).map(function(id){return {wire:id,matched:G.wires[id].v===state.value};});
      pd.answers=pd.answers.concat(answers);G.declaration=Object.assign({},G.declaration,{answers:pd.answers.slice()});ctx.log(G,G.players[pi].name+' 公开回应：'+(answers.every(function(x){return x.matched;})?'被选导线全部正确。':'被选导线并非全部正确。'));
      if(answers.some(function(x){return !x.matched;})){G.declaration.result={matched:false};G.lastAct={t:'boom',ids:pd.ids.slice()};ctx.lose(G,'精准拆线选错导线，炸弹立即爆炸。');return {error:null};}
      pd.waiting.shift();if(pd.waiting.length){pd.to=pd.waiting[0];return {error:null};}
      pd.ids.forEach(function(id){ctx.cutWire(G,G.wires[id]);});state.complete=true;G.equip.forEach(function(e){e.hidden=false;});G.lastAct={t:'hit',ids:pd.ids.slice()};G.declaration.result={matched:true};G.pending=null;
      var module=moduleFor(G);if(module.precisionSuccess){if(!module.precisionSuccess(G,ctx))ctx.endTurn(G);return {error:null};}
      ctx.log(G,'精准拆线成功，四根同时剪断；剩余装备全部公开并直接解锁。','good');ctx.endTurn(G);return {error:null};
    },
    pendingView: function(G,pi){var pd=G.pending;if(!pd||pd.type!=='precision-cut')return null;var out={type:pd.type,id:pd.id,from:pd.from,to:pd.to,ids:pd.ids.slice(),vals:pd.vals.slice(),answers:pd.answers.slice()};if(pi===pd.to)out.ownAnswers=pd.ids.filter(function(id){return G.wires[id].o===pi;}).map(function(id){return {wire:id,matched:G.wires[id].v===G.officialState.precision.value};});return out;},
    view: function(G){var state=G.officialState.precision;return {module:'precision-four',version:C.version,precision:{value:state.value,complete:state.complete,discarded:state.discarded,rounds:state.rounds}};}
  };
  function nextPrecisionClue(G,ctx) {
    var state=G.officialState.precision;
    while(state.rewards.length){
      var reward=state.rewards[0],wires=G.wires.filter(function(w){return w.o===reward.owner&&!w.cut&&w.v===reward.value;}),token=C.availableInfoTokens(G,false).filter(function(t){return t.value===reward.value;})[0];
      if(!wires.length||!token){ctx.log(G,G.players[reward.owner].name+' 的一张奖励牌无需放置标记。');state.rewards.shift();continue;}
      G.pending={type:'precision-clue',id:++G.actionId,from:state.rewardActor,to:reward.owner,token:token};return true;
    }
    G.pending=null;state.rewardActor=null;return false;
  }
  C.modules['precision-number-rewards'] = Object.assign({},C.modules['precision-four'],{
    setupMessage:function(){return '布置阶段：从队长开始，每人随机抽取一个蓝色信息标记。';},
    setup:function(G,ctx){
      var deck=ctx.shuffle(Array.from({length:12},function(_,i){return i+1;}),ctx.rng).slice(0,9);
      G.equip=[];G.equipmentReserve=[];G.officialState.risky={side:[]};
      G.officialState.precision={value:deck.shift(),deck:deck,complete:false,discarded:0,rounds:0,rewards:[],distributed:[],rewardActor:null};
    },
    beginSetup:riskySetup,
    reservedTokens:function(G){return G.officialState.risky.side.concat(G.pending&&G.pending.token?[G.pending.token]:[]);},
    finishTurn:function(G,ctx){
      var state=G.officialState.precision,next=ctx.nextPlayer(G,G.turn),from=(G.turn-G.captain+G.np)%G.np,to=(next-G.captain+G.np)%G.np;
      if(!state.complete&&to<=from){state.rounds++;if(state.deck.length){state.deck.shift();state.discarded++;ctx.log(G,'一轮结束，背面弃掉一张数字牌。');}}
      return false;
    },
    validateAction:function(G,pi,a){
      if(G.pending&&G.pending.type==='initial-clue'&&a.a!=='initial-clue')return '请先放置随机抽取的初始标记';
      if(G.pending&&G.pending.type==='precision-clue'&&a.a!=='precision-clue')return '请先由指定玩家放置奖励线索';
      return C.modules['precision-four'].validateAction(G,pi,a);
    },
    handleAction:function(G,pi,a,ctx){
      if(a.a==='initial-clue')return C.modules['risky-red-cut'].handleAction(G,pi,a,ctx);
      if(a.a!=='precision-clue')return C.modules['precision-four'].handleAction(G,pi,a,ctx);
      var pd=G.pending,state=G.officialState.precision,w=G.wires[a.w];
      if(G.phase!=='play'||!pd||pd.type!=='precision-clue'||pd.to!==pi||pd.id!==a.id||!w||w.o!==pi||w.cut||w.v!==pd.token.value)return {error:'请选择本人对应数字的未剪导线；这次奖励选择可能已失效'};
      var info=tokenInfo(pd.token);if(w.info){if(w.info.t!=='v'||w.info.v!==pd.token.value)return {error:'这根线已有不同类型标记，不能放此奖励'};var oldTokens=w.info.tokens||[w.info.token||('info-'+pd.token.value+'-'+(pd.token.id.slice(-1)==='0'?1:0))];info.tokens=oldTokens.concat([pd.token.id]);info.copies=(w.info.copies||1)+1;}
      G.pending=null;if(!ctx.placeInfo(G,w,info))return {error:'奖励标记已不在备用区'};
      state.rewards.shift();ctx.log(G,G.players[pi].name+' 放置奖励数字「'+pd.token.value+'」。');if(!nextPrecisionClue(G,ctx))ctx.endTurn(G);return {error:null};
    },
    precisionSuccess:function(G,ctx){
      var state=G.officialState.precision;state.rewardActor=G.turn;
      state.rewards=state.deck.map(function(value,i){return {value:value,owner:(G.captain+i)%G.np};});state.distributed=state.rewards.slice();state.deck=[];
      ctx.log(G,'精准拆线成功，四根同时剪断；从队长开始分发剩余数字牌并放置奖励线索。','good');return nextPrecisionClue(G,ctx);
    },
    pendingView:function(G,pi){
      var pd=G.pending;if(!pd)return null;if(pd.type==='initial-clue')return C.modules['risky-red-cut'].pendingView(G,pi);
      if(pd.type==='precision-clue'){var out={type:pd.type,id:pd.id,from:pd.from,to:pd.to,token:pd.token};if(pi===pd.to)out.choices=G.wires.filter(function(w){return w.o===pi&&!w.cut&&w.v===pd.token.value;}).map(function(w){return w.id;});return out;}
      return C.modules['precision-four'].pendingView(G,pi);
    },
    view:function(G,pi){var state=G.officialState.precision,out={module:'precision-number-rewards',version:C.version,randomInitialClues:true,sideClues:G.officialState.risky.side.slice(),precision:{value:state.value,complete:state.complete,discarded:state.discarded,rounds:state.rounds,deckCount:state.deck.length,rewardCount:state.distributed.length,rewardKind:'numbers'}};if(pi>=0)out.precision.assignedNumbers=state.distributed.filter(function(card){return card.owner===pi;}).map(function(card){return card.value;});return out;}
  });
  C.tripwire = function(G){var state=G.officialState||G.official;return state&&state.version===C.version&&state.module==='tripwire'?state.tripwire:null;};
  C.ownTurnAllowed=function(G,pi){if(G.audioClock&&G.audioClock.cutHeld||G.audio&&G.audio.cutHeld)return false;var weak=C.weakLink(G);if(weak&&weak.startPending&&G.turn===pi)return false;var free=C.freeTurn(G);if(free&&(free.step!=='cut'||free.actor!==pi))return false;var order=C.numberOrder(G);if(order&&(order.step!=='cut'||order.actor!==pi))return false;var claim=C.numberClaim(G);if(claim&&(claim.step!=='cut'||claim.actor!==pi))return false;var robot=C.nano(G);if(robot&&robot.waiting)return false;var state=C.tripwire(G);return !state||!state.stalled&&!onlyTripwires(G,pi);};
  function onlyTripwires(G,pi){var own=ownWires(G,pi).filter(function(w){return !w.cut;});return own.length>0&&own.some(function(w){return Math.round(w.v*10)%10===1;})&&!own.some(function(w){return Number.isInteger(w.v);});}
  C.modules['tripwire']={
    randomInitialYellow:true,
    setupMessage:function(){return '布置阶段：从队长开始，每人随机抽取一个信息标记；可能抽到黄色。';},
    prepareMission:function(mission,count){mission.y=[Math.min(count,4),Math.min(count,4)];},
    setup:function(G,ctx){
      var yellow=ctx.shuffle(G.wires.filter(function(w){return Math.round(w.v*10)%10===1;}),ctx.rng),remaining=ctx.shuffle(G.wires.filter(function(w){return Math.round(w.v*10)%10!==1;}),ctx.rng),slots=[];
      for(var si=0;si<2;si++)for(var offset=0;offset<G.np;offset++){var owner=(G.captain+offset)%G.np;if(G.players[owner].stands[si])slots.push([owner,si]);}
      var owners=G.players.map(function(_,offset){return (G.captain+offset)%G.np;}).filter(function(pi){return G.np!==5||pi!==G.captain;});
      yellow.forEach(function(w,i){w.o=owners[i];w.s=Math.floor(ctx.rng()*G.players[w.o].stands.length);});
      var filled=slots.map(function(slot){return yellow.filter(function(w){return w.o===slot[0]&&w.s===slot[1];}).length;}),target=slots.map(function(_,i){return Math.floor(G.wires.length/slots.length)+(i<G.wires.length%slots.length?1:0);}),index=0;
      remaining.forEach(function(w){while(filled[index%slots.length]>=target[index%slots.length])index++;var slot=index++%slots.length;w.o=slots[slot][0];w.s=slots[slot][1];filled[slot]++;});ctx.resort(G);
      G.det=0;G.detMax=1;G.detMin=-4;G.officialState.risky={side:[]};G.officialState.tripwire={stalled:false,groups:G.players.map(function(_,pi){return {ids:G.wires.filter(function(w){return w.o===pi;}).map(function(w){return w.id;}),yellow:G.np===5&&pi===G.captain?0:1};})};
    },
    beginSetup:riskySetup,
    reservedTokens:function(G){return G.officialState.risky.side.concat(G.pending&&G.pending.type==='initial-clue'?[G.pending.token]:[]);},
    setupInfoAllowed:function(G,w){return !riskyRed(w);},
    allowedValue:function(G,value){return value!=='Y';},
    enterTurn:function(G,ctx){
      var state=G.officialState.tripwire;state.stalled=false;
      var visited=[];while(visited.indexOf(G.turn)<0){if(!onlyTripwires(G,G.turn))return;visited.push(G.turn);ctx.log(G,G.players[G.turn].name+' 只剩绊线及可能的红线，本回合免费跳过。');G.turn=ctx.nextPlayer(G,G.turn);G.turnNo++;}
      state.stalled=true;ctx.log(G,'所有剩余玩家都需跳过，等待随时装备改变手牌。');
    },
    validateAction:function(G,pi,a){if(G.pending&&G.pending.type==='initial-clue'&&a.a!=='initial-clue')return '请先放置随机初始标记';if(G.pending&&G.pending.type==='tripwire-cut'&&a.a!=='tripwire-reply')return '请先由被选队友回应绊线猜测';if(!C.ownTurnAllowed(G,pi)&&(a.a==='dd'||a.a==='equip'&&[3,5,9,10,11].indexOf(a.n)>=0||a.a==='character'&&C.characters[G.players[pi].character.id].timing==='own-turn'))return '当前必须跳过，只可使用随时装备';return null;},
    handleAction:function(G,pi,a,ctx){
      if(a.a==='initial-clue')return C.modules['risky-red-cut'].handleAction(G,pi,a,ctx);
      if(a.a==='tripwire-cut'){
        if(G.phase!=='play'||G.pending||G.turn!==pi||onlyTripwires(G,pi)||G.officialState.tripwire.stalled)return {error:'现在不能处理绊线；只剩绊线及红线的玩家须跳过'};
        var w=G.wires[a.w];if(!Number.isInteger(a.w)||!w||w.cut||w.o===pi)return {error:'请选择另一名队友的一根未处理导线'};
        if(a.stab||a.xy||a.xyPersonal||a.vals||a.ws||a.n||a.character)return {error:'处理绊线不能组合双人拆线装备或个人能力'};
        G.stab=false;var id=++G.actionId;G.pending={type:'tripwire-cut',id:id,from:pi,to:w.o,ids:[w.id],vals:['Y']};G.declaration={type:'tripwire-cut',id:id,from:pi,to:w.o,ids:[w.id],vals:['Y']};ctx.log(G,G.players[pi].name+' 宣告队友选中导线是绊线。');return {error:null};
      }
      if(a.a!=='tripwire-reply')return null;
      var pd=G.pending;if(G.phase!=='play'||!pd||pd.type!=='tripwire-cut'||pd.to!==pi||pd.id!==a.id)return {error:'这次绊线回应已失效，或未轮到你'};
      var w=G.wires[pd.ids[0]],yellow=Math.round(w.v*10)%10===1,beforeDet=G.det;G.declaration=Object.assign({},G.declaration,{result:{matched:yellow,wire:w.id}});G.pending=null;
      if(yellow){ctx.cutWire(G,w);w.resolution='secured';G.det=Math.max(G.detMin,G.det-1);G.declaration.result.retreated=G.det<beforeDet;G.lastAct={t:'hit',ids:[w.id]};ctx.log(G,G.players[pi].name+' 公开回应是绊线，已安全处理；'+(G.det<beforeDet?'引爆器后退一格。':'引爆器已在最早时间格。'),'good');}
      else{G.lastAct={t:riskyRed(w)?'boom':'miss',ids:[w.id]};if(riskyRed(w)){ctx.lose(G,'处理绊线时选中红线，炸弹立即爆炸。');return {error:null};}G.det++;ctx.log(G,G.players[pi].name+' 公开回应不是绊线；引爆器前进一格。','bad');if(G.det>=G.detMax){ctx.lose(G,'引爆器到达尽头，炸弹爆炸。');return {error:null};}ctx.placeInfo(G,w,{t:'v',v:w.v});}
      ctx.endTurn(G);return {error:null};
    },
    pendingView:function(G,pi){var pd=G.pending;if(!pd)return null;if(pd.type==='initial-clue')return C.modules['risky-red-cut'].pendingView(G,pi);if(pd.type!=='tripwire-cut')return null;var out={type:pd.type,id:pd.id,from:pd.from,to:pd.to,ids:pd.ids.slice(),vals:['Y']};if(pi===pd.to)out.ownAnswers=[{wire:pd.ids[0],matched:Math.round(G.wires[pd.ids[0]].v*10)%10===1}];return out;},
    view:function(G){return {module:'tripwire',version:C.version,randomInitialClues:true,randomInitialYellow:true,sideClues:G.officialState.risky.side.slice(),tripwire:{stalled:G.officialState.tripwire.stalled,fixedDial:true,groups:G.officialState.tripwire.groups.map(function(group){return {ids:group.ids.slice(),yellow:group.yellow};})}};}
  };
  C.nano=function(G){var state=G.officialState||G.official;return state&&state.version===C.version&&state.nano?state.nano:null;};
  C.nanoImpossiblePair=function(G,canAct){
    if(!G.officialState||G.officialState.module!=='nano-robot'||G.pending)return false;
    var state=G.officialState.nano,own=G.wires.filter(function(w){return w.o===G.turn&&!w.cut;});
    return !canAct(G,G.turn)&&own.length===1&&Number.isInteger(own[0].v)&&G.wires.filter(function(w){return !w.cut&&w.v===own[0].v;}).length===2&&state.reserve.some(function(id){return G.wires[id].v===own[0].v;});
  };
  function placeNanoWire(G,wire,owner,rack,ctx){wire.o=owner;wire.s=rack;ctx.resort(G);ctx.log(G,G.players[owner].name+' 从机器人取得一根导线并放入第'+(rack+1)+'架；数值不公开。');}
  C.modules['yellow-three']={
    setup:function(G,ctx){
      var yellow=ctx.shuffle(G.wires.filter(function(w){return Math.round(w.v*10)%10===1;}),ctx.rng),others=ctx.shuffle(G.wires.filter(function(w){return Math.round(w.v*10)%10!==1;}),ctx.rng),slots=[];
      for(var rack=0;rack<2;rack++)for(var offset=0;offset<G.np;offset++){var owner=(G.captain+offset)%G.np;if(G.players[owner].stands[rack])slots.push([owner,rack]);}
      yellow.forEach(function(w,index){w.o=(G.captain+index)%G.np;w.s=G.np===2&&w.o===G.captain?index===2?1:0:Math.floor(ctx.rng()*G.players[w.o].stands.length);});
      var filled=slots.map(function(slot){return yellow.filter(function(w){return w.o===slot[0]&&w.s===slot[1];}).length;}),target=slots.map(function(_,i){return Math.floor(G.wires.length/slots.length)+(i<G.wires.length%slots.length?1:0);}),cursor=0;
      others.forEach(function(w){while(filled[cursor%slots.length]>=target[cursor%slots.length])cursor++;var slot=cursor++%slots.length;w.o=slots[slot][0];w.s=slots[slot][1];filled[slot]++;});ctx.resort(G);G.officialState.yellowThree={complete:false};
    },
    allowedValue:function(G,value){return value!=='Y';},
    validateAction:function(G,pi,a){if(G.pending&&G.pending.type==='yellow-three-cut'&&a.a!=='yellow-three-reply')return '请先完成三黄特殊回应';if(['dual','dd','solo'].indexOf(a.a)>=0&&a.val==='Y'||a.vals&&a.vals.indexOf('Y')>=0)return '黄线只能通过三黄特殊拆除';return null;},
    handleAction:function(G,pi,a,ctx){
      if(a.a==='yellow-three-cut'){
        if(G.phase!=='play'||G.pending||G.turn!==pi||G.officialState.yellowThree.complete)return {error:'只能在自己的回合、三黄未完成时特殊拆除'};
        if(a.stab||a.xy||a.xyPersonal||a.character||a.n||G.stab)return {error:'三黄特殊行动不能组合探测器或修饰卡'};
        var mine=G.wires.filter(function(w){return w.o===pi&&!w.cut;});if(!mine.length||G.np<=3&&!mine.some(function(w){return Math.round(w.v*10)%10===1;}))return {error:'两三人局必须自持黄线，四五人局仍须有未剪导线'};
        if(!Array.isArray(a.ws)||a.ws.length!==3||new Set(a.ws).size!==3||a.ws.some(function(id){return !Number.isInteger(id)||!G.wires[id]||G.wires[id].cut;}))return {error:'请选择三根不同的未剪导线，可跨玩家和线架'};
        var owners=[];a.ws.forEach(function(id){if(owners.indexOf(G.wires[id].o)<0)owners.push(G.wires[id].o);});var id=++G.actionId;G.pending={type:'yellow-three-cut',id:id,from:pi,to:owners[0],ids:a.ws.slice(),vals:['Y'],waiting:owners,answers:[]};G.declaration={type:'yellow-three-cut',id:id,from:pi,to:owners[0],ids:a.ws.slice(),vals:['Y'],answers:[]};ctx.log(G,G.players[pi].name+' 宣告选中三根同时拆除的黄线。');return {error:null};
      }
      if(a.a!=='yellow-three-reply')return null;var pd=G.pending;if(G.phase!=='play'||!pd||pd.type!=='yellow-three-cut'||pd.to!==pi||pd.id!==a.id)return {error:'三黄回应已过期或尚未轮到你'};
      var answers=pd.ids.filter(function(id){return G.wires[id].o===pi;}).map(function(id){return {wire:id,matched:Math.round(G.wires[id].v*10)%10===1};});pd.answers=pd.answers.concat(answers);G.declaration=Object.assign({},G.declaration,{answers:pd.answers.slice()});ctx.log(G,G.players[pi].name+' 公开回应选中的黄线判断。');
      if(answers.some(function(x){return Math.round(G.wires[x.wire].v*10)%10===5;})){G.pending=null;ctx.lose(G,'三黄行动选中了红线，按基础红线规则爆炸。');return {error:null};}
      pd.waiting.shift();if(pd.waiting.length){pd.to=pd.waiting[0];return {error:null};}
      var failed=pd.answers.filter(function(x){return !x.matched;});if(failed.length){failed.forEach(function(x){ctx.placeInfo(G,G.wires[x.wire],{t:'v',v:G.wires[x.wire].v});});G.det++;G.lastAct={t:'miss',ids:pd.ids.slice()};G.declaration.result={matched:false};G.pending=null;ctx.log(G,'三黄未全中：错线提供信息，共推进引爆器一格。','bad');ctx.endTurn(G);return {error:null};}
      pd.ids.forEach(function(id){ctx.cutWire(G,G.wires[id]);});G.officialState.yellowThree.complete=true;G.lastAct={t:'hit',ids:pd.ids.slice()};G.declaration.result={matched:true};G.pending=null;ctx.log(G,'三根黄线同时拆除成功。','good');ctx.endTurn(G);return {error:null};
    },
    pendingView:function(G,pi){var pd=G.pending;if(!pd||pd.type!=='yellow-three-cut')return null;var out={type:pd.type,id:pd.id,from:pd.from,to:pd.to,ids:pd.ids.slice(),vals:pd.vals.slice(),answers:pd.answers.slice()};if(pi===pd.to)out.ownAnswers=pd.ids.filter(function(id){return G.wires[id].o===pi;}).map(function(id){return {wire:id,matched:Math.round(G.wires[id].v*10)%10===1};});return out;},
    view:function(G){return {module:'yellow-three',version:C.version,yellowThree:{complete:G.officialState.yellowThree.complete,failurePolicy:'wrong-only-de'}};}
  };
  C.arithmetic=function(G){return G.officialState?G.officialState.arithmetic:G.official&&G.official.arithmetic;};
  C.arithmeticPairs=function(G,value){var state=C.arithmetic(G),out=[];if(!state)return out;for(var i=0;i<state.open.length;i++)for(var j=i+1;j<state.open.length;j++){var a=state.open[i],b=state.open[j];if(a+b===value)out.push({cards:[a,b],operation:'sum'});if(Math.abs(a-b)===value)out.push({cards:[a,b],operation:'difference'});}return out;};
  function arithmeticCardsValid(state,cards){return Array.isArray(cards)&&cards.length===2&&new Set(cards).size===2&&cards.every(function(v){return Number.isInteger(v)&&state.open.indexOf(v)>=0;});}
  function discardArithmetic(G,cards,ctx){var state=G.officialState.arithmetic;state.open=state.open.filter(function(v){return cards.indexOf(v)<0;});state.discard=state.discard.concat(cards);ctx.log(G,'弃置两张数字牌：'+cards.join('、')+'。');}
  C.modules['number-arithmetic']={
    setup:function(G){G.officialState.arithmetic={open:Array.from({length:12},function(_,i){return i+1;}),discard:[],selection:null,resets:0};},
    allowedValue:function(G,value){var state=C.arithmetic(G);return state.selection&&state.selection.value===value||C.arithmeticPairs(G,value).length>0;},
    validateAction:function(G,pi,a){
      if(a.xy||a.xyPersonal||a.a==='equip'&&a.n===10)return '本关不能使用共享或个人X/Y射线';
      var cut=['dual','dd','solo'].indexOf(a.a)>=0||a.a==='equip'&&[3,5].indexOf(a.n)>=0||a.a==='character'&&G.players[pi].character.id==='triple-detector';
      if(!cut){if((a.cards||a.operation)&&a.a!=='arithmetic-skip')return '数字算式只用于拆线，弃牌选择也可用于跳过';return null;}
      if(G.phase!=='play'||G.pending||G.turn!==pi)return '尚未轮到你拆线或当前选择未完成';
      var state=G.officialState.arithmetic;if(!arithmeticCardsValid(state,a.cards))return '请选择两张不同的公开数字牌';
      if(['sum','difference'].indexOf(a.operation)<0)return '请选择相加或相减';
      var value=a.operation==='sum'?a.cards[0]+a.cards[1]:Math.abs(a.cards[0]-a.cards[1]);if(value!==a.val||value<1||value>12)return '算式必须得到你要宣告的蓝色数字1–12';
      state.selection={cards:a.cards.slice(),operation:a.operation,value:value};return null;
    },
    declare:function(G,values,ctx){var state=G.officialState.arithmetic,selection=state.selection;if(!selection)return;discardArithmetic(G,selection.cards,ctx);state.selection=null;},
    handleAction:function(G,pi,a,ctx){if(a.a!=='arithmetic-skip')return null;if(G.phase!=='play'||G.pending||G.turn!==pi)return {error:'只有当前玩家可选择弃牌跳过'};if(a.stab||a.xy||a.xyPersonal)return {error:'算式跳过不能组合稳定器或X/Y修饰'};var state=G.officialState.arithmetic;if(!arithmeticCardsValid(state,a.cards))return {error:'请选择两张不同的公开数字牌弃置'};discardArithmetic(G,a.cards,ctx);G.det++;ctx.log(G,G.players[pi].name+' 弃牌跳过，引爆器前进一格。','bad');ctx.endTurn(G);return {error:null};},
    finishTurn:function(G,ctx){var state=G.officialState.arithmetic;if(!state.open.length){state.open=state.discard.slice().sort(function(a,b){return a-b;});state.discard=[];state.resets++;ctx.log(G,'数字牌已用完，重新展开全部十二张。');}return false;},
    view:function(G){var state=G.officialState.arithmetic;return {module:'number-arithmetic',version:C.version,arithmetic:{open:state.open.slice(),discard:state.discard.slice(),resets:state.resets}};}
  };
  C.modules['agent-seven']={
    prepareMission:function(mission){mission.fixedYellow=[5.1,6.1,7.1,8.1];},
    setup:function(G){G.officialState.precision={value:7,complete:false,discarded:0,rounds:0};G.officialState.license={required:false,checkedTurn:null};},
    setupNeeds:function(G){return G.players.map(function(_,pi){return G.np===2&&pi===G.captain?0:1;});},
    enterTurn:function(G){var state=G.officialState.license;if(state.checkedTurn===G.turnNo)return;state.checkedTurn=G.turnNo;var own=G.wires.filter(function(w){return w.o===G.turn&&!w.cut;});state.required=own.length>0&&own.every(function(w){return w.v===7;});},
    allowedValue:function(G,value){return G.officialState.precision.complete||value!==7;},
    validateAction:function(G,pi,a){
      if(G.pending&&G.pending.type==='precision-cut'&&a.a!=='precision-reply')return '请先由被选玩家回应许可拆线';
      if(a.a==='precision-cut'&&!G.officialState.license.required)return '只有回合开始仅剩蓝色7的玩家可执行许可拆线';
      if(G.officialState.license.required&&(['dual','dd','solo'].indexOf(a.a)>=0||a.a==='equip'&&[3,5,9,10].indexOf(a.n)>=0||a.a==='character'&&['triple-detector','xy-ray'].indexOf(G.players[pi].character.id)>=0))return '本回合必须执行四根7的许可拆线，不能用探测器或稳定器替代';
      if(['dual','dd','solo'].indexOf(a.a)>=0&&a.val===7)return '蓝色7只能通过许可四线特殊拆除';return null;
    },
    handleAction:function(G,pi,a,ctx){return C.modules['precision-four'].handleAction(G,pi,a,ctx);},
    pendingView:function(G,pi){return C.modules['precision-four'].pendingView(G,pi);},
    precisionSuccess:function(G,ctx){ctx.log(G,'许可拆线成功，四根蓝色7同时剪断。','good');return false;},
    view:function(G,pi){var out={module:'agent-seven',version:C.version,precision:{value:7,complete:G.officialState.precision.complete,discarded:0,rounds:0,license:true}};if(pi===G.turn)out.licenseRequired=G.officialState.license.required;return out;}
  };
  C.numberClaim=function(G){return G.officialState?G.officialState.numberClaim:G.official&&G.official.numberClaim;};
  function retireClaimNumbers(G,ctx){var state=G.officialState.numberClaim;for(var value=1;value<=12;value++)if(ctx.cutCount(G,value)===4&&state.retired.indexOf(value)<0){state.retired.push(value);state.deck=state.deck.filter(function(v){return v!==value;});state.discard=state.discard.filter(function(v){return v!==value;});}}
  function claimStep(G,step){var state=G.officialState.numberClaim;state.step=step;state.decisionId=++G.actionId;}
  function claimPenalty(G,pi,ctx,message){G.det++;ctx.log(G,G.players[pi].name+' '+message+'，引爆器前进一格。','bad');if(G.det>=G.detMax){G.pending=null;ctx.lose(G,'抢认或暗示处罚使引爆器到达尽头。');}}
  C.modules['number-claim']={
    setup:function(G,ctx){G.officialState.numberClaim={deck:ctx.shuffle(Array.from({length:12},function(_,i){return i+1;}),ctx.rng),discard:[],retired:[],value:null,actor:null,step:'draw',decisionId:null};},
    enterTurn:function(G){G.turn=G.captain;claimStep(G,'draw');},
    allowedValue:function(G,value){var state=G.officialState.numberClaim;return state.step==='cut'&&state.value===value;},
    validateAction:function(G,pi,a){var state=G.officialState.numberClaim;if(a.xy||a.xyPersonal||a.a==='equip'&&[10,11].indexOf(a.n)>=0)return '本关禁用X/Y射线及咖啡杯';if(G.pending&&G.pending.type==='number-claim-clue'&&a.a!=='claim-clue'&&a.a!=='claim-penalty')return '请先由被指定玩家放置信息标记';var cut=['dual','dd','solo'].indexOf(a.a)>=0||a.a==='equip'&&[3,5].indexOf(a.n)>=0||a.a==='character'&&G.players[pi].character.id==='triple-detector';if((cut||a.a==='red')&&(state.step!=='cut'||state.actor!==pi))return '请先认领或由队长指定行动者';if(cut&&a.val!==state.value)return state.value===null?'蓝线已经完成，请公开剩余红线':'本回合必须拆数字牌上的 '+state.value;return null;},
    handleAction:function(G,pi,a,ctx){
      if(['claim-draw','claim-number','claim-assign','claim-clue','claim-penalty'].indexOf(a.a)<0)return null;
      var state=G.officialState.numberClaim;if(G.phase!=='play')return {error:'拆线开始后才进行数字认领'};
      if(a.a==='claim-clue'){
        var pd=G.pending;if(!pd||pd.type!=='number-claim-clue'||pd.to!==pi||pd.id!==a.id)return {error:'这次缺值标记选择已失效'};
        var wire=G.wires[a.w];if(!wire||wire.o!==pi||wire.cut||!Number.isInteger(wire.v))return {error:'请选择自己一根未剪的蓝线'};
        var token=C.availableInfoTokens(G,false).find(function(t){return t.value===wire.v;}),placed=ctx.placeInfo(G,wire,token?tokenInfo(token):{t:'v',v:wire.v});G.pending=null;claimPenalty(G,pi,ctx,'被指定却没有当前数字，已'+(placed?'放置线索':'提供临时线索'));if(G.phase==='play')ctx.endTurn(G);return {error:null};
      }
      if(a.a==='claim-penalty'){if(a.id!==state.decisionId)return {error:'这次暗示记录已过期'};claimPenalty(G,pi,ctx,'记录一次额外暗示');return {error:null};}
      if(G.pending||a.id!==state.decisionId)return {error:'当前数字选择已变化，或拆线尚未完成'};
      if(a.a==='claim-draw'){
        if(pi!==G.captain||state.step!=='draw')return {error:'只有队长可在回合开始翻数字牌'};
        retireClaimNumbers(G,ctx);if(!state.deck.length){state.deck=ctx.shuffle(state.discard.slice(),ctx.rng);state.discard=[];}
        state.value=state.deck.length?state.deck.shift():null;if(state.value!==null)state.discard.push(state.value);state.actor=null;claimStep(G,'claim');ctx.log(G,state.value===null?'蓝线全部完成，剩余红线玩家可认领公开。':'队长翻开数字牌「'+state.value+'」，玩家可认领。');return {error:null};
      }
      var owner=a.a==='claim-number'?pi:a.p;if(a.a==='claim-assign'&&pi!==G.captain)return {error:'只有队长可指定无人认领的行动者'};
      if(!Number.isInteger(owner)||!G.players[owner])return {error:'请选择一名玩家'};
      var own=G.wires.filter(function(w){return w.o===owner&&!w.cut;});if(!own.length)return {error:'空手玩家不再行动'};
      var reds=own.every(function(w){return Math.round(w.v*10)%10===5;}),has=own.some(function(w){return w.v===state.value;});
      if(state.step!=='claim'&&!(state.step==='draw'&&a.a==='claim-number'&&reds))return {error:'本回合已有行动者，或数字尚未翻开；仅剩红线可在翻牌前认领'};
      if(!reds&&!has&&a.a==='claim-number'){claimPenalty(G,pi,ctx,'认领了自己没有的数字');return {error:null};}
      state.actor=owner;G.turn=owner;claimStep(G,'cut');ctx.log(G,G.players[owner].name+(a.a==='claim-number'?' 认领本次行动。':' 被队长指定行动。'));
      if(!reds&&!has){claimStep(G,'clue');G.pending={type:'number-claim-clue',id:state.decisionId,from:G.captain,to:owner};}
      return {error:null};
    },
    afterCut:function(G,ctx){retireClaimNumbers(G,ctx);return false;},
    finishTurn:function(G){var state=G.officialState.numberClaim;state.actor=null;state.value=null;state.step='draw';return false;},
    pendingView:function(G,pi){var pd=G.pending;if(!pd||pd.type!=='number-claim-clue')return null;var out={type:pd.type,id:pd.id,from:pd.from,to:pd.to};if(pi===pd.to)out.choices=G.wires.filter(function(w){return w.o===pi&&!w.cut&&Number.isInteger(w.v);}).map(function(w){return w.id;});return out;},
    view:function(G){var state=G.officialState.numberClaim;return {module:'number-claim',version:C.version,numberClaim:{step:state.step,value:state.value,actor:state.actor,decisionId:state.decisionId,remaining:state.deck.length,retired:state.retired.slice()}};}
  };
  C.submarine54=function(G){return G.officialState?G.officialState.submarine54:G.official&&G.official.submarine54;};
  function retireSubmarinePlayers(G){var state=G.officialState.submarine54;G.players.forEach(function(_,pi){if(!G.wires.some(function(w){return w.o===pi&&!w.cut;})){state.active[pi]=false;state.retired+=state.balances[pi];state.balances[pi]=0;}});}
  C.submarineAffordable=function(G,pi){var state=C.submarine54(G);if(!state)return false;var own=G.wires?G.wires.filter(function(w){return w.o===pi&&!w.cut;}):G.players[pi].stands.flat().filter(function(w){return !w.cut;});if(!own.length)return false;if(own.every(function(w){return Math.round(w.v*10)%10===5;}))return true;return own.some(function(w){return Number.isInteger(w.v)&&C.oxygenCost(w.v)<=state.balances[pi];});};
  function insertSubmarineRed(G,owner,rack,value,ctx){var id=G.wires.length;G.wires.push({id:id,v:value,o:owner,s:rack,cut:false,info:null});G.rmark.n++;ctx.resort(G);ctx.log(G,G.players[owner].name+' 已按顺序插入红线；排序数值不公开。','warn');}
  C.applySubmarineEvent=function(G,event,ctx){var state=C.submarine54(G);if(!G.officialState||G.officialState.module!=='submarine-audio'||G.phase!=='play'||G.paused||!state.audioReady)return {error:'只有已开始且未暂停的潜艇任务可处理内部事件'};
    if(!event||event.gid!==G.gid||!Number.isInteger(event.index)||event.index<0||['leak','oxygen','transfer','panic'].indexOf(event.type)<0)return {error:'事件身份／类型无效'};
    var ledger=state.events||[],next=ledger.length;if(event.index<next)return ledger[event.index].type===event.type?{error:null,duplicate:true}:{error:'旧事件内容不一致'};
    if(event.index!==next||G.pending&&['submarine-red','submarine-transfer'].indexOf(G.pending.type)>=0)return {error:'事件乱序或上一播报选择尚未完成'};
    var owner=C.turnActor(G);if(!state.active[owner]||!G.wires.some(function(w){return w.o===owner&&!w.cut;}))return {error:'当前玩家已退出'};
    if(event.type==='leak'&&!state.redReserve.length)return {error:'红线备用已空'};
    if(event.type==='panic'&&state.repeatTurn)return {error:'上一连续回合事件尚未结算，叠加例外未核实'};
    if(event.type==='oxygen'&&(G.np===2||state.reserve<1))return {error:G.np===2?'双人补氧含额外免氧拆线，完整事件尚未核实，当前不部分执行':'氧气库存为空，补氧例外尚未核实'};
    state.events=ledger;ledger.push({index:event.index,type:event.type,owner:owner});
    if(event.type==='panic'){state.repeatTurn={owner:owner,eventIndex:event.index};ctx.log(G,G.players[owner].name+' 在本回合结束后继续行动一次；仍按正常规则耗氧。','warn');return {error:null};}
    if(event.type==='oxygen'){state.reserve--;state.balances[owner]++;ctx.log(G,G.players[owner].name+' 找到氧气瓶，从库存领取1枚氧气。','good');return {error:null};}
    if(event.type==='transfer'){state.suspendedPending=G.pending?JSON.parse(JSON.stringify(G.pending)):null;G.pending={type:'submarine-transfer',id:++G.actionId,from:owner,to:owner};ctx.log(G,G.players[owner].name+' 可以与一名仍参与的队友交换氧气，等待本人选择。');return {error:null};}
    var value=state.redReserve.shift();
    if(G.players[owner].stands.length===1){insertSubmarineRed(G,owner,0,value,ctx);return {error:null};}
    state.suspendedPending=G.pending?JSON.parse(JSON.stringify(G.pending)):null;G.pending={type:'submarine-red',id:++G.actionId,from:owner,to:owner,value:value};ctx.log(G,G.players[owner].name+' 取得一根红线，等待本人选择线架；排序数值不公开。','warn');return {error:null};
  };
  C.modules['submarine-audio']={
    setup:function(G,ctx){var each=[0,0,9,6,3,2][G.np];G.officialState.submarine54={balances:G.players.map(function(){return each;}),reserve:32-G.np*each,retired:0,total:32,active:G.players.map(function(){return true;}),completed:[],redReserve:ctx.shuffle(Array.from({length:11},function(_,i){return i+1.5;}),ctx.rng),audioReady:false};},
    enterTurn:function(G){if(!G.officialState.submarine54.audioReady){G.phase='audio-ready';G.deadline=null;}},
    validateAction:function(G,pi,a){
      if(G.pending&&G.pending.type==='submarine-transfer'&&a.a!=='submarine-transfer')return '请先由播报指定玩家完成氧气转移';
      if(G.pending&&G.pending.type==='submarine-red'&&a.a!=='submarine-red')return '请先由持线玩家放好音频加入的红线';
      if(G.phase==='audio-ready')return '官方音频时间轴尚未核实，暂不能开始拆线';
      if(G.officialState.submarine54.repeatTurn&&a.a==='equip'&&a.n===11)return '连续行动期间咖啡杯的优先顺序尚未核实，当前不组合';
      if(a.xy||a.xyPersonal||a.a==='equip'&&a.n===10||a.a==='character'&&G.players[pi].character.id==='xy-ray')return '本关不能使用共享或个人X/Y射线';
      var cut=['dual','dd','solo'].indexOf(a.a)>=0||a.a==='equip'&&[3,5].indexOf(a.n)>=0||a.a==='character'&&G.players[pi].character.id==='triple-detector';if(!cut)return null;
      if(G.phase!=='play'||G.pending||G.turn!==pi)return '尚未轮到你拆线或上次选择未完成';var cost=C.oxygenCost(a.val);if(cost===null)return '请选择蓝色数字1–12';var state=G.officialState.submarine54;if(!state.active[pi]||state.balances[pi]<cost)return '个人氧气不足，不能拆这个值';state.balances[pi]-=cost;state.reserve+=cost;return null;
    },
    handleAction:function(G,pi,a,ctx){if(a.a==='submarine-transfer'){var pd=G.pending,state=G.officialState.submarine54;if(G.phase!=='play'||!pd||pd.type!=='submarine-transfer'||pd.to!==pi||pd.id!==a.id)return {error:'氧气转移已过期或尚未轮到你'};
      if(a.mode==='skip'){if(a.amount!==undefined&&a.amount!==0)return {error:'放弃转移不能包含数量'};}else{if(['give','take'].indexOf(a.mode)<0||!Number.isInteger(a.p)||a.p===pi||!G.players[a.p]||!state.active[a.p]||!G.wires.some(function(w){return w.o===a.p&&!w.cut;})||!Number.isInteger(a.amount)||a.amount<1)return {error:'请选择一名仍持线队友、方向与正整数数量'};var from=a.mode==='give'?pi:a.p,to=a.mode==='give'?a.p:pi;if(state.balances[from]<a.amount)return {error:'转移数量超过该玩家持有的氧气'};state.balances[from]-=a.amount;state.balances[to]+=a.amount;ctx.log(G,G.players[from].name+' 向 '+G.players[to].name+' 转移'+a.amount+'枚氧气。');}
      G.pending=state.suspendedPending;state.suspendedPending=null;return {error:null};}if(a.a==='submarine-red'){var pd=G.pending,state=G.officialState.submarine54;if(G.phase!=='play'||!pd||pd.type!=='submarine-red'||pd.to!==pi||pd.id!==a.id||!Number.isInteger(a.rack)||!G.players[pi].stands[a.rack])return {error:'红线放置已过期或线架不合法'};insertSubmarineRed(G,pi,a.rack,pd.value,ctx);G.pending=state.suspendedPending;state.suspendedPending=null;return {error:null};}if(a.a!=='submarine-skip')return null;if(G.phase!=='play'||G.pending||G.turn!==pi)return {error:'只能由当前玩家在无待处理选择时跳过'};if(!G.wires.some(function(w){return w.o===pi&&!w.cut;}))return {error:'空手玩家已退出，不再跳过'};if(C.submarineAffordable(G,pi))return {error:'还有足够氧气可以行动，必须行动而不能主动省氧跳过'};if(a.stab||a.xy||a.xyPersonal)return {error:'跳过修饰的精确规则尚未核实，当前不组合'};G.det++;ctx.log(G,G.players[pi].name+' 因氧气不足跳过，引爆器前进一格。','bad');ctx.endTurn(G);return {error:null};},
    afterCut:function(G,ctx){var state=G.officialState.submarine54;retireSubmarinePlayers(G);for(var value=1;value<=12;value++)if(ctx.cutCount(G,value)===4&&state.completed.indexOf(value)<0){state.completed.push(value);G.players.forEach(function(_,pi){if(state.active[pi]&&state.reserve>0){state.reserve--;state.balances[pi]++;}});ctx.log(G,'蓝色 '+value+' 已完成，仍持线的玩家各补氧1；空手玩家不领取。','good');}return false;},
    finishTurn:function(G){retireSubmarinePlayers(G);return false;},
    nextTurn:function(G){var state=G.officialState.submarine54,repeat=state.repeatTurn;if(!repeat)return undefined;state.repeatTurn=null;return state.active[repeat.owner]?repeat.owner:undefined;},
    pendingView:function(G,pi){var pd=G.pending;if(pd&&pd.type==='submarine-transfer'){var out={type:pd.type,id:pd.id,from:pd.from,to:pd.to};if(pi===pd.to){var state=G.officialState.submarine54;out.choices=G.players.map(function(_,owner){return {p:owner,give:state.balances[pi],take:state.balances[owner]};}).filter(function(c){return c.p!==pi&&state.active[c.p]&&G.wires.some(function(w){return w.o===c.p&&!w.cut;});});}return out;}if(!pd||pd.type!=='submarine-red')return null;var out={type:pd.type,id:pd.id,from:pd.from,to:pd.to};if(pi===pd.to){out.drawn={kind:'r',value:pd.value};out.choices=G.players[pi].stands.map(function(_,rack){return rack;});}return out;},
    view:function(G){var state=G.officialState.submarine54,pd=state.suspendedPending,action=pd&&pd.type==='cut'?{type:pd.type,id:pd.id,from:pd.from,to:pd.to,step:pd.step,label:pd.label,ids:pd.ids.slice(),vals:pd.vals.slice()}:null;if(action&&pd.step==='own'){action.hit=pd.hit;action.hitVal=pd.hitVal;}return {module:'submarine-audio',version:C.version,submarine54:{suspendedAction:action,repeatTurn:G.phase==='play'&&state.repeatTurn?{owner:state.repeatTurn.owner}:null,balances:state.balances.slice(),reserve:state.reserve,retired:state.retired,total:state.total,active:state.active.slice(),completed:state.completed.slice(),redRemaining:state.redReserve.length,audioReady:state.audioReady}};}
  };
  C.robotPressure=function(G){return G.officialState?G.officialState.robotPressure:G.official&&G.official.robotPressure;};
  C.failureMessage=function(G,from){var module=moduleFor(G);return module&&module.failureMessage?module.failureMessage(G,from):null;};
  C.modules['robot-pressure']={
    setup:function(G){G.officialState.robotPressure={position:0,limit:12,nextOutcome:null,variant:'de-reach-12'};},
    validateAction:function(G,pi,a){if(a.stab||a.a==='equip'&&[6,9].indexOf(a.n)>=0)return '本关不使用引爆器，禁止倒带器或稳定器';return null;},
    failureSteps:function(G){G.officialState.robotPressure.nextOutcome={type:'miss'};return 0;},
    failureMessage:function(){return '机器人将在本回合结束前进2格。';},
    afterCut:function(G){var state=G.officialState.robotPressure,wires=(G.lastAct&&G.lastAct.ids||[]).map(function(id){return G.wires[id];});var blue=wires.find(function(w){return Number.isInteger(w.v);});if(blue)state.nextOutcome={type:'hit',value:blue.v};return false;},
    finishTurn:function(G,ctx){var state=G.officialState.robotPressure,outcome=state.nextOutcome;state.nextOutcome=null;if(!outcome)return false;
      var movement=outcome.type==='miss'?2:outcome.value===state.position?-1:1,destination=Math.max(0,state.position+movement);state.position=Math.min(state.limit,destination);ctx.log(G,'机器人'+(movement>0?'前进'+movement:'后退1')+'格，'+(destination>=state.limit?'在12触发引爆。':'现位于 '+(state.position===0?'1之前':state.position)+'。'),movement>0?'warn':'good');
      if(state.position>=state.limit){ctx.lose(G,'机器人到达12，按本局德文原卡炸弹爆炸。');return true;}return false;
    },
    view:function(G){var state=G.officialState.robotPressure;return {module:'robot-pressure',version:C.version,robotPressure:{position:state.position,limit:state.limit,variant:state.variant,dialUsed:false}};}
  };
  C.allFalseInfo=function(G){return G.officialState?G.officialState.allFalseInfo:G.official&&G.official.allFalseInfo;};
  function addFalseMarker(G,w,value){var values=w.info&&w.info.t==='not'?String(w.info.v).split('/'):[],text=String(value);if(values.indexOf(text)>=0)return true;
    var token=C.availableInfoTokens(G,true).find(function(t){return String(t.value)===text;});if(!token){G.announcement={id:w.id,info:{t:'not',v:text}};return false;}
    G.wires.forEach(function(old){if(old.id!==w.id&&old.cut&&old.info&&old.info.t==='not'&&String(old.info.v).split('/').indexOf(text)>=0)old.info=null;});
    var tokens=w.info&&w.info.tokens?w.info.tokens.slice():w.info&&w.info.token?[w.info.token]:[];values.push(text);tokens.push(token.id);w.info={t:'not',v:values.join('/'),tokens:tokens};return true;
  }
  C.modules['all-false-info']={
    setup:function(G){G.officialState.allFalseInfo={decisionId:1,initialIds:[]};},
    setupNeeds:function(G){return G.players.map(function(){return 2;});},
    setupInfoAllowed:function(G,w){return Math.round(w.v*10)%10!==1;},
    failureClueValues:function(G,owner,vals){return vals.slice();},
    failureInfo:function(G,w,vals,choice){return {t:'not',v:String(choice==null?vals[0]:choice)};},
    placeInfo:function(G,w,info){return info.t==='not'?addFalseMarker(G,w,info.v):null;},
    validateAction:function(G,pi,a){if(a.a==='equip'&&[1,12].indexOf(a.n)>=0)return '本关禁用等号和不等号装备';if(G.pending&&G.pending.type==='false-info'&&a.a!=='false-info')return '请先完成便利贴的错误数值选择';return null;},
    handleAction:function(G,pi,a,ctx){
      var state=G.officialState.allFalseInfo,w=G.wires[a.w];
      if(a.a==='info'){
        if(G.phase!=='setup'||ctx.setupActor(G)!==pi||G.setup[pi]>=2||a.id!==state.decisionId)return {error:'初始错误标记选择已过期或尚未轮到你'};
        if(!w||w.o!==pi||w.cut||Math.round(w.v*10)%10===1||w.info||state.initialIds.indexOf(w.id)>=0)return {error:'请选择自己两根不同的未标记蓝线或红线，不能选黄线'};
        if(!Number.isInteger(a.val)||a.val<1||a.val>12||a.val===w.v)return {error:'请选择1–12中与导线不同的数值'};
        ctx.placeInfo(G,w,{t:'not',v:String(a.val)});state.initialIds.push(w.id);state.decisionId++;G.setup[pi]++;ctx.log(G,G.players[pi].name+' 放置错误初始标记，表示不是该值。');if(ctx.setupActor(G)<0)ctx.startPlay(G);return {error:null};
      }
      if(a.a==='equip'&&a.n===4){
        var card=G.equip.find(function(e){return e.n===4&&!e.used;});if(G.phase!=='play'||G.pending||!C.equipmentAllowed(G,pi)||!card||ctx.cutCount(G,4)<2)return {error:'便利贴未解锁／已使用，或当前选择未完成'};
        if(!w||w.o!==pi||w.cut||!Number.isInteger(w.v)||w.info)return {error:'请选择自己一根未剪且没有标记的蓝线'};
        G.pending={type:'false-info',id:++G.actionId,from:pi,to:pi,wire:w.id};ctx.log(G,G.players[pi].name+' 选择便利贴，接下来私下选择一个错误数值。');return {error:null};
      }
      if(a.a!=='false-info')return null;var pd=G.pending;
      if(G.phase!=='play'||!pd||pd.type!=='false-info'||pd.to!==pi||pd.id!==a.id)return {error:'便利贴错误数值选择已过期'};
      w=G.wires[pd.wire];if(!Number.isInteger(a.val)||a.val<1||a.val>12||a.val===w.v)return {error:'便利贴必须选择不同于实际蓝线的数值'};
      var card=G.equip.find(function(e){return e.n===4&&!e.used;});if(!card)return {error:'便利贴已经使用'};ctx.placeInfo(G,w,{t:'not',v:String(a.val)});card.used=true;G.pending=null;ctx.log(G,G.players[pi].name+' 使用便利贴，放置错误信息。');return {error:null};
    },
    pendingView:function(G,pi){var pd=G.pending;if(!pd||pd.type!=='false-info')return null;var out={type:pd.type,id:pd.id,from:pd.from,to:pd.to};if(pi===pd.to){out.wire=pd.wire;out.choices=Array.from({length:12},function(_,i){return i+1;}).filter(function(v){return v!==G.wires[pd.wire].v;});}return out;},
    view:function(G,pi){var state=G.officialState.allFalseInfo,out={module:'all-false-info',version:C.version,allFalseInfo:true};if(G.phase==='setup'&&setupActorForView(G)===pi)out.fakeSetup={id:state.decisionId,usedIds:state.initialIds.filter(function(id){return G.wires[id].o===pi;}),redAllowed:true};return out;}
  };
  C.numberOrder=function(G){return G.officialState?G.officialState.numberOrder:G.official&&G.official.numberOrder;};
  function orderStep(G,step){var state=G.officialState.numberOrder;state.step=step;state.decisionId=++G.actionId;}
  function retireOrderNumbers(G,ctx){var state=G.officialState.numberOrder;for(var v=1;v<=12;v++)if(ctx.cutCount(G,v)===4&&state.retired.indexOf(v)<0){state.retired.push(v);state.deck=state.deck.filter(function(x){return x!==v;});state.discard=state.discard.filter(function(x){return x!==v;});}}
  C.modules['number-order']={
    setup:function(G,ctx){G.det=-1;G.officialState.numberOrder={deck:ctx.shuffle(Array.from({length:12},function(_,i){return i+1;}),ctx.rng),discard:[],retired:[],controller:G.captain,actor:null,value:null,step:'draw',decisionId:null};},
    setupNeeds:function(G){return G.players.map(function(_,pi){return G.np===2&&pi===G.captain?0:1;});},
    enterTurn:function(G){var state=G.officialState.numberOrder;state.controller=G.turn;state.actor=null;state.value=null;orderStep(G,'draw');},
    allowedValue:function(G,value){var state=G.officialState.numberOrder;return state.step==='cut'&&state.value===value;},
    validateAction:function(G,pi,a){var state=G.officialState.numberOrder;if(a.xy||a.xyPersonal||a.a==='equip'&&a.n===10||a.a==='character'&&G.players[pi].character.id==='xy-ray')return '本关不能使用共享或个人X/Y射线';
      if(G.pending&&G.pending.type==='order-answer'&&a.a!=='order-answer'||G.pending&&G.pending.type==='order-clue'&&a.a!=='order-clue')return '请先由被指定者完成命令回应';
      var cut=['dual','dd','solo'].indexOf(a.a)>=0||a.a==='equip'&&[3,5].indexOf(a.n)>=0||a.a==='character'&&G.players[pi].character.id==='triple-detector';
      if(cut&&(state.step!=='cut'||state.actor!==pi||a.val!==state.value))return '请先完成指定和回应，再由被指定玩家拆数字 '+state.value;
      if(a.a==='red'&&(state.step!=='draw'||state.controller!==pi))return '只能在自己作为长官的回合开始、尚未翻牌时公开剩余红线';return null;
    },
    handleAction:function(G,pi,a,ctx){if(['order-draw','order-assign','order-answer','order-clue'].indexOf(a.a)<0)return null;var state=G.officialState.numberOrder;
      if(G.phase!=='play')return {error:'开局完成后才处理命令'};
      if(a.a==='order-answer'){
        var pd=G.pending;if(!pd||pd.type!=='order-answer'||pd.to!==pi||pd.id!==a.id)return {error:'命令回应已过期或尚未轮到你'};
        ctx.log(G,G.players[pi].name+' 回应：长官，遵命！');G.pending=null;
        if(G.wires.some(function(w){return w.o===pi&&!w.cut&&w.v===state.value;}))orderStep(G,'cut');else{orderStep(G,'clue');G.pending={type:'order-clue',id:state.decisionId,from:state.controller,to:pi};}return {error:null};
      }
      if(a.a==='order-clue'){
        var pd=G.pending,w=G.wires[a.w];if(!pd||pd.type!=='order-clue'||pd.to!==pi||pd.id!==a.id)return {error:'缺值标记选择已过期'};
        if(!w||w.o!==pi||w.cut||!Number.isInteger(w.v))return {error:'请选择自己一根未剪蓝线放标记'};
        ctx.placeInfo(G,w,{t:'v',v:w.v});G.pending=null;G.det++;ctx.log(G,G.players[pi].name+' 没有指定数字，已提供线索，引爆器前进一格。','bad');ctx.endTurn(G);return {error:null};
      }
      if(G.pending||a.id!==state.decisionId||pi!==state.controller)return {error:'只有当前长官可操作此命令，或编号已过期'};
      if(a.a==='order-draw'){
        if(state.step!=='draw')return {error:'本回合已翻牌'};var own=G.wires.filter(function(w){return w.o===pi&&!w.cut;});if(own.length&&own.every(function(w){return Math.round(w.v*10)%10===5;}))return {error:'长官只剩红线，应直接公开红线而不翻牌'};
        retireOrderNumbers(G,ctx);if(!state.deck.length){state.deck=ctx.shuffle(state.discard.slice(),ctx.rng);state.discard=[];}if(!state.deck.length)return {error:'蓝线已完成，请公开剩余红线'};
        state.value=state.deck.shift();state.discard.push(state.value);orderStep(G,'assign');ctx.log(G,G.players[pi].name+' 长官翻开数字 '+state.value+'，独立指定行动者。');return {error:null};
      }
      if(state.step!=='assign'||!Number.isInteger(a.p)||!G.players[a.p]||!G.wires.some(function(w){return w.o===a.p&&!w.cut;}))return {error:'请指定一名仍持有导线的玩家，可指定自己'};
      var own=G.wires.filter(function(w){return w.o===a.p&&!w.cut;});if(own.every(function(w){return Math.round(w.v*10)%10===5;})){ctx.lose(G,'长官指定了只剩红线的玩家，按发行商FAQ立即爆炸。');return {error:null};}
      state.actor=a.p;G.turn=a.p;orderStep(G,'answer');G.pending={type:'order-answer',id:state.decisionId,from:state.controller,to:a.p};ctx.log(G,G.players[pi].name+' 长官指定 '+G.players[a.p].name+' 拆数字 '+state.value+'。');return {error:null};
    },
    afterCut:function(G,ctx){retireOrderNumbers(G,ctx);return false;},
    finishTurn:function(G){var state=G.officialState.numberOrder;G.turn=state.controller;state.actor=null;state.value=null;state.step='draw';return false;},
    pendingView:function(G,pi){var pd=G.pending;if(!pd||['order-answer','order-clue'].indexOf(pd.type)<0)return null;var out={type:pd.type,id:pd.id,from:pd.from,to:pd.to};if(pi===pd.to&&pd.type==='order-clue')out.choices=G.wires.filter(function(w){return w.o===pi&&!w.cut&&Number.isInteger(w.v);}).map(function(w){return w.id;});return out;},
    view:function(G){var state=G.officialState.numberOrder;return {module:'number-order',version:C.version,numberOrder:{controller:state.controller,actor:state.actor,value:state.value,step:state.step,decisionId:state.decisionId,remaining:state.deck.length,retired:state.retired.slice()}};}
  };
  C.memorySea=function(G){return G.officialState?G.officialState.memorySea:G.official&&G.official.memorySea;};
  C.placeInfo=function(G,wire,info,origin){var module=moduleFor(G);return module&&module.placeInfo?module.placeInfo(G,wire,info,origin):null;};
  C.modules['memory-sea']={
    setup:function(G){G.officialState.memorySea={preview:true,side:[],point:null};},
    beginSetup:function(G){G.phase='memory-preview';G.pending={type:'memory-preview',id:++G.actionId,to:G.captain,ready:[]};return true;},
    setupMessage:function(){return '先记住红黄线数值；从队长开始依次确认，之后数值列表移除并开始初始指线。';},
    validateAction:function(G,pi,a){if(G.phase==='memory-preview'&&a.a!=='memory-ready')return '请先完成红黄数值记忆确认';G.officialState.memorySea.point=null;return null;},
    handleAction:function(G,pi,a,ctx){
      if(a.a!=='memory-ready')return null;var pd=G.pending;if(G.phase!=='memory-preview'||!pd||pd.type!=='memory-preview'||pd.to!==pi||pd.id!==a.id)return {error:'记忆确认已过期或未轮到你'};
      pd.ready.push(pi);if(pd.ready.length<G.np)pd.to=(pi+1)%G.np;else{G.officialState.memorySea.preview=false;G.pending=null;G.phase='setup';}ctx.log(G,G.players[pi].name+' 已确认记住红黄线数值。');return {error:null};
    },
    placeInfo:function(G,w,info,origin){
      if(origin!=='initial'&&origin!=='failure')return null;
      var state=G.officialState.memorySea,value=info.t==='Y'?'Y':info.v,token=C.availableInfoTokens(G,true).find(function(t){return t.value===value;});
      if(token){state.side=state.side.filter(function(t){return t.id!==token.id;});state.side.push({id:token.id,value:value,owner:w.o,rack:w.s,wire:w.id});}
      state.point={wire:w.id,owner:w.o,rack:w.s,info:JSON.parse(JSON.stringify(info)),verbal:!token};return !!token;
    },
    reservedTokens:function(G){return G.officialState.memorySea.side.filter(function(t){return !G.wires[t.wire].cut;});},
    pendingView:function(G){var pd=G.pending;return pd&&pd.type==='memory-preview'?{type:pd.type,id:pd.id,to:pd.to,ready:pd.ready.slice()}:null;},
    view:function(G){var state=G.officialState.memorySea;return {module:'memory-sea',version:C.version,memorySea:{preview:state.preview,side:state.side.map(function(t){return {id:t.id,value:t.value,owner:t.owner,rack:t.rack};}),point:state.point?JSON.parse(JSON.stringify(state.point)):null,hideValidation:true}};}
  };
  C.personalOxygen=function(G){return G.officialState?G.officialState.personalOxygen:G.official&&G.official.personalOxygen;};
  function discardEmptyOxygen(G){var state=G.officialState.personalOxygen;G.players.forEach(function(_,pi){if(!G.wires.some(function(w){return w.o===pi&&!w.cut;})){state.discarded+=state.balances[pi];state.balances[pi]=0;state.requests[pi]=false;}});}
  C.modules['personal-oxygen']={
    setup:function(G){var each=9-G.np;G.officialState.personalOxygen={balances:G.players.map(function(){return each;}),total:each*G.np,discarded:0,requests:G.players.map(function(){return false;})};},
    validateAction:function(G,pi,a){
      if(a.xy||a.xyPersonal||a.a==='equip'&&a.n===10||a.a==='character'&&G.players[pi].character.id==='xy-ray')return '本关不能使用共享或个人X/Y射线';
      var cut=['dual','dd','solo'].indexOf(a.a)>=0||a.a==='equip'&&[3,5].indexOf(a.n)>=0||a.a==='character'&&G.players[pi].character.id==='triple-detector';
      if(!cut)return a.oxygenTo!==undefined?'只有蓝线拆除可以转交氧气':null;
      if(G.phase!=='play'||G.pending||G.turn!==pi)return '尚未轮到你拆线，或上次选择尚未完成';
      if(!Number.isInteger(a.val)||a.val<1||a.val>12)return '请选择蓝色数字1–12';
      if(!Number.isInteger(a.oxygenTo)||a.oxygenTo<0||a.oxygenTo>=G.np||a.oxygenTo===pi)return '请选择另一名队友接收本次氧气';
      var state=G.officialState.personalOxygen;if(state.balances[pi]<a.val)return '个人氧气不足：需要 '+a.val+' 枚，可跳过回合';
      state.balances[pi]-=a.val;state.balances[a.oxygenTo]+=a.val;state.requests[pi]=false;discardEmptyOxygen(G);return null;
    },
    handleAction:function(G,pi,a,ctx){
      if(a.a==='personal-oxygen-signal'){
        if(G.phase!=='play'||G.pending||!G.wires.some(function(w){return w.o===pi&&!w.cut;}))return {error:'只能在行动之间由仍持线玩家请求更多氧气'};
        G.officialState.personalOxygen.requests[pi]=true;ctx.log(G,G.players[pi].name+' 举起拇指，请求更多氧气。');return {error:null};
      }
      if(a.a!=='personal-oxygen-skip')return null;
      if(G.phase!=='play'||G.pending||G.turn!==pi)return {error:'只有当前行动者可跳过回合'};
      if(a.xy||a.xyPersonal)return {error:'本关跳过不能组合X/Y射线'};
      var protectedSkip=!!G.stab;
      if(a.stab&&!protectedSkip){var stabilizer=G.equip.find(function(e){return e.n===9&&!e.used&&ctx.cutCount(G,9)>=2;});if(!stabilizer)return {error:'稳定器尚未解锁或已使用'};stabilizer.used=true;protectedSkip=true;}
      if(!protectedSkip)G.det++;G.officialState.personalOxygen.requests[pi]=false;ctx.log(G,G.players[pi].name+' 跳过回合，'+(protectedSkip?'稳定器保护，引爆器不前进。':'引爆器前进一格。'),protectedSkip?'good':'bad');ctx.endTurn(G);return {error:null};
    },
    finishTurn:function(G){discardEmptyOxygen(G);return false;},
    view:function(G){var state=G.officialState.personalOxygen;return {module:'personal-oxygen',version:C.version,personalOxygen:{balances:state.balances.slice(),total:state.total,discarded:state.discarded,requests:state.requests.slice()}};}
  };
  C.oxygen=function(G){return G.officialState?G.officialState.oxygen:G.official&&G.official.oxygen;};
  C.oxygenCost=function(value){return Number.isInteger(value)&&value>=1&&value<=12?Math.ceil(value/4):null;};
  C.passingOxygen=function(G){var s=G.officialState||G.official;return s&&s.version===C.version&&s.module==='passing-oxygen'?s.passingOxygen:null;};
  C.passingAffordable=function(G,pi){var s=C.passingOxygen(G);if(!s||s.holder!==pi)return false;var own=ownWires(G,pi).filter(function(w){return !w.cut;});return !!own.length&&(own.every(function(w){return Math.round(w.v*10)%10===5;})||own.some(function(w){return Number.isInteger(w.v)&&w.v<=s.available;}));};
  function passingEmptyCaptain(G,from,to){if(ownWires(G,G.captain).some(function(w){return !w.cut;}))return false;for(var k=1;k<=G.np;k++){var p=(from+k)%G.np;if(p===G.captain)return true;if(p===to)return false;}return false;}
  function passingHandoff(G,to,ctx,clockwise){var s=C.passingOxygen(G),from=s.holder;if(clockwise&&passingEmptyCaptain(G,from,to)){s.available+=s.reserve;s.reserve=0;ctx.log(G,'经过空手队长，库存氧气补回，由下一位接收。');}s.holder=to;s.requests=G.players.map(function(){return false;});ctx.log(G,'剩余 '+s.available+' 枚氧气交给 '+G.players[to].name+'。');}
  C.modules['passing-oxygen']={
    setup:function(G){var total=G.np===2?14:G.np*6;G.officialState.passingOxygen={total:total,available:total,reserve:0,holder:G.captain,replenishedTurn:null,requests:G.players.map(function(){return false;})};},
    enterTurn:function(G,ctx){var s=C.passingOxygen(G);if(s.holder!==G.turn)passingHandoff(G,G.turn,ctx,true);if(G.turn===G.captain&&s.replenishedTurn!==G.turnNo){s.available+=s.reserve;s.reserve=0;s.replenishedTurn=G.turnNo;s.requests=G.players.map(function(){return false;});ctx.log(G,'队长回合开始，收回库存氧气，共 '+s.available+' 枚。');}},
    validateAction:function(G,pi,a){
      if(a.xy||a.xyPersonal||a.a==='equip'&&a.n===10||a.a==='character'&&G.players[pi].character.id==='xy-ray')return '本关不能使用共享或个人X/Y射线';
      var cut=['dual','dd','solo'].indexOf(a.a)>=0||a.a==='equip'&&[3,5,16].indexOf(a.n)>=0||a.a==='character'&&G.players[pi].character.id==='triple-detector';if(!cut)return null;
      if(G.phase!=='play'||G.pending||G.turn!==pi)return '尚未轮到你拆线或上次选择未完成';
      var s=C.passingOxygen(G);if(!Number.isInteger(a.val)||a.val<1||a.val>12)return '请选择蓝色数字1–12';if(s.holder!==pi||s.available<a.val)return '当前氧气不足：拆数字 '+a.val+' 需要 '+a.val+' 枚';s.available-=a.val;s.reserve+=a.val;return null;
    },
    handleAction:function(G,pi,a,ctx){
      if(a.a==='passing-oxygen-signal'){if(G.phase!=='play'||G.pending||!ownWires(G,pi).some(function(w){return !w.cut;}))return {error:'只能在两次行动之间由仍持线玩家请求氧气'};G.officialState.passingOxygen.requests[pi]=true;ctx.log(G,G.players[pi].name+' 举起拇指，请求更多氧气。');return {error:null};}
      if(a.a!=='passing-oxygen-skip')return null;if(G.phase!=='play'||G.pending||G.turn!==pi||!ownWires(G,pi).some(function(w){return !w.cut;}))return {error:'只有仍持线的当前玩家可以缺氧跳过'};
      if(C.passingAffordable(G,pi))return {error:'有足够氧气拆线或可以免费公开红线，必须行动'};if(a.stab||a.xy||a.xyPersonal)return {error:'缺氧跳过的装备保护尚未核实，不能组合修饰'};G.det++;ctx.log(G,G.players[pi].name+' 因氧气不足跳过，引爆器前进一格。','bad');ctx.endTurn(G);return {error:null};
    },
    finishTurn:function(G,ctx,nextIdx){if(G.wires.every(function(w){return w.cut;}))return false;passingHandoff(G,nextIdx===undefined?ctx.nextPlayer(G,G.turn):nextIdx,ctx,nextIdx===undefined);return false;},
    view:function(G){var s=C.passingOxygen(G);return {module:'passing-oxygen',version:C.version,passingOxygen:{total:s.total,available:s.available,reserve:s.reserve,holder:s.holder,requests:s.requests.slice()}};}
  };
  C.modules['shared-oxygen']={
    setup:function(G){G.officialState.oxygen={available:G.np*2,total:G.np*2,replenishedTurn:null,requests:G.players.map(function(){return false;})};},
    enterTurn:function(G,ctx){var state=G.officialState.oxygen;if(G.turn===G.captain&&state.replenishedTurn!==G.turnNo){state.available=state.total;state.replenishedTurn=G.turnNo;state.requests=G.players.map(function(){return false;});ctx.log(G,'队长回合开始，共享氧气补满至 '+state.total+' 枚。');}},
    validateAction:function(G,pi,a){
      if(a.xy||a.xyPersonal||a.a==='equip'&&a.n===10||a.a==='character'&&G.players[pi].character.id==='xy-ray')return '本关不能使用共享或个人X/Y射线';
      var detector=a.a==='equip'&&(a.n===3||a.n===5)||a.a==='character'&&G.players[pi].character.id==='triple-detector';
      if(['dual','dd','solo'].indexOf(a.a)<0&&!detector)return null;
      if(G.phase!=='play'||G.pending||G.turn!==pi)return '尚未轮到你拆线，或上次选择尚未完成';
      var cost=C.oxygenCost(a.val);if(cost===null)return '请选择蓝色数字1–12';
      var state=G.officialState.oxygen;if(state.available<cost)return '共享氧气不足：此数字需要 '+cost+' 枚，可跳过回合';
      state.available-=cost;state.requests=G.players.map(function(){return false;});return null;
    },
    handleAction:function(G,pi,a,ctx){
      if(a.a==='oxygen-signal'){
        if(G.phase!=='play'||G.pending)return {error:'请在两次行动之间请求更多氧气'};
        G.officialState.oxygen.requests[pi]=true;ctx.log(G,G.players[pi].name+' 举起拇指，请求更多氧气。');return {error:null};
      }
      if(a.a!=='oxygen-skip')return null;
      if(G.phase!=='play'||G.pending||G.turn!==pi)return {error:'只有当前行动者可跳过回合'};
      if(a.xy||a.xyPersonal)return {error:'本关跳过不能组合X/Y射线'};
      var protectedSkip=!!G.stab;
      if(a.stab&&!protectedSkip){var stabilizer=G.equip.find(function(e){return e.n===9&&!e.used&&ctx.cutCount(G,9)>=2;});if(!stabilizer)return {error:'稳定器尚未解锁或已使用'};stabilizer.used=true;protectedSkip=true;}
      if(!protectedSkip)G.det++;G.officialState.oxygen.requests=G.players.map(function(){return false;});ctx.log(G,G.players[pi].name+' 跳过回合，'+(protectedSkip?'稳定器保护，引爆器不前进。':'引爆器前进一格。'),protectedSkip?'good':'bad');ctx.endTurn(G);return {error:null};
    },
    view:function(G){var state=G.officialState.oxygen;return {module:'shared-oxygen',version:C.version,oxygen:{available:state.available,total:state.total,requests:state.requests.slice()}};}
  };
  C.modules['nano-robot']={
    setup:function(G,ctx){
      var pool=ctx.shuffle(G.wires.slice(),ctx.rng),count=G.np===2?5:G.np===5?3:4,reserve=pool.slice(0,count),remaining=pool.slice(count),slots=[];
      reserve.forEach(function(w){w.o=-1;w.s=-1;});
      for(var rack=0;rack<2;rack++)for(var offset=0;offset<G.np;offset++){var owner=(G.captain+offset)%G.np;if(G.players[owner].stands[rack])slots.push([owner,rack]);}
      remaining.forEach(function(w,i){var slot=slots[i%slots.length];w.o=slot[0];w.s=slot[1];});ctx.resort(G);
      G.officialState.nano={position:1,direction:1,reserve:reserve.map(function(w){return w.id;}),waiting:false};G.officialState.risky={side:[]};
    },
    setupMessage:function(G){return G.np===2?'双人布置：队长先随机抽蓝色信息标记，另一位正常选择一个蓝线标记。':null;},
    beginSetup:function(G,ctx){if(G.np!==2)return false;var token=ctx.shuffle(C.availableInfoTokens(G,false),ctx.rng)[0];G.pending={type:'initial-clue',id:++G.actionId,from:G.captain,to:G.captain,token:token};return true;},
    reservedTokens:function(G){return G.officialState.risky.side.concat(G.pending&&G.pending.type==='initial-clue'?[G.pending.token]:[]);},
    validateAction:function(G,pi,a){if(G.pending&&G.pending.type==='initial-clue'&&a.a!=='initial-clue')return '请先完成队长的随机初始标记';if(G.pending&&G.pending.type==='nano-rack'&&a.a!=='nano-rack')return '请先由行动者选择新导线放入哪个线架';return null;},
    handleAction:function(G,pi,a,ctx){
      if(a.a==='initial-clue'){
        var pd=G.pending;if(G.phase!=='setup'||!pd||pd.type!=='initial-clue'||pd.to!==pi||pd.id!==a.id)return {error:'这次初始标记选择已失效，或未轮到你'};
        var matches=G.wires.filter(function(w){return w.o===pi&&!w.cut&&w.v===pd.token.value;});
        if(matches.length){if(!matches.some(function(w){return w.id===a.w;}))return {error:'请选择自己对应数字的一根蓝线'};G.pending=null;if(!ctx.placeInfo(G,G.wires[a.w],tokenInfo(pd.token)))return {error:'信息标记不可用'};}
        else{if(a.w!==null||!Number.isInteger(a.rack)||!G.players[pi].stands[a.rack])return {error:'缺少此数字，请选择旁置的线架'};G.officialState.risky.side.push(Object.assign({},pd.token,{owner:pi,rack:a.rack}));G.pending=null;}
        G.setup[pi]++;ctx.log(G,G.players[pi].name+' 放好了随机开局标记。');if(ctx.setupActor(G)<0)ctx.startPlay(G);return {error:null};
      }
      if(a.a!=='nano-rack')return null;
      var pd=G.pending;if(G.phase!=='play'||!pd||pd.type!=='nano-rack'||pd.to!==pi||a.id!==pd.id||!Number.isInteger(a.rack)||!G.players[pi].stands[a.rack])return {error:'这次补线放置已失效，或线架选择不合法'};
      placeNanoWire(G,G.wires[pd.wire],pi,a.rack,ctx);G.pending=null;ctx.endTurn(G);return {error:null};
    },
    afterCut:function(G,ctx){
      var state=G.officialState.nano;if(!state.reserve.length||!(G.lastAct&&G.lastAct.ids||[]).some(function(id){return G.wires[id].v===state.position;}))return false;
      var id=state.reserve.shift(),owner=G.turn;ctx.log(G,'拆中机器人所在数字，行动者取得一根隐藏备用线。','good');
      if(G.players[owner].stands.length===1){placeNanoWire(G,G.wires[id],owner,0,ctx);return false;}
      G.pending={type:'nano-rack',id:++G.actionId,from:owner,to:owner,wire:id};return true;
    },
    finishTurn:function(G){var state=G.officialState.nano;state.position+=state.direction;if(state.position===12)state.direction=-1;else if(state.position===1)state.direction=1;return false;},
    enterTurn:function(G,ctx){
      var state=G.officialState.nano;
      if(C.nanoImpossiblePair(G,ctx.canAct)){
        state.waiting=false;ctx.lose(G,'仅剩一根蓝线，唯一同值未剪线在机器人备用堆，按发行商规则炸弹爆炸。');return;
      }
      state.waiting=!ctx.canAct(G,G.turn);if(state.waiting)ctx.log(G,'玩家手中没有可继续的拆线行动，机器人仍有备用线。可使用合法装备或重试。');
    },
    pendingView:function(G,pi){var pd=G.pending;if(!pd)return null;if(pd.type==='initial-clue')return C.modules['risky-red-cut'].pendingView(G,pi);if(pd.type!=='nano-rack')return null;var out={type:pd.type,id:pd.id,from:pd.from,to:pd.to};if(pi===pd.to){out.choices=G.players[pi].stands.map(function(_,rack){return rack;});out.drawn={value:G.wires[pd.wire].v,kind:riskyRed(G.wires[pd.wire])?'r':'b'};}return out;},
    view:function(G){var state=G.officialState.nano,out={module:'nano-robot',version:C.version,randomInitialClues:G.phase==='setup'&&!!(G.pending&&G.pending.type==='initial-clue'),sideClues:G.officialState.risky.side.slice(),nano:{position:state.position,direction:state.direction,remaining:state.reserve.length,waiting:state.waiting,waitingReason:state.waiting?(G.players.every(function(_,pi){return pi===G.turn||!G.wires.some(function(w){return w.o===pi&&!w.cut;});})?'no-other-player':'no-current-cut'):null}};if(G.phase==='won'||G.phase==='lost')out.nano.revealed=state.reserve.map(function(id){return G.wires[id].v;});return out;}
  };
  C.modules['number-cycle'] = {
    setup: function (G) { G.officialState.numbers = { remaining: Array.from({ length: 12 }, function (_, i) { return i + 1; }), used: [] }; },
    allowedValue: function (G, value) {
      var deck = G.officialState.numbers;
      return deck.remaining.indexOf(value) >= 0 && deck.used.indexOf(value) < 0;
    },
    declare: function (G, values) {
      var deck = G.officialState.numbers;
      values.forEach(function (value) { if (deck.used.indexOf(value) < 0) deck.used.push(value); });
    },
    enterTurn: function (G, ctx) {
      var deck = G.officialState.numbers;
      deck.remaining = deck.remaining.filter(function (value) { return ctx.cutCount(G, value) < 4; });
      deck.used = deck.used.filter(function (value) { return deck.remaining.indexOf(value) >= 0; });
      if (deck.used.length === deck.remaining.length) deck.used = [];
      for (var k = 0; k < G.np && !ctx.canAct(G, G.turn); k++) {
        ctx.log(G, G.players[G.turn].name + ' 没有正面数字卡对应的线，免费跳过。');
        G.turn = ctx.nextPlayer(G, G.turn);
        G.turnNo++;
      }
    },
    view: function (G) {
      var deck = G.officialState.numbers;
      return { module: 'number-cycle', version: C.version,
        numbers: { open: deck.remaining.filter(function (value) { return deck.used.indexOf(value) < 0; }), used: deck.used.slice() } };
    }
  };
  // 限制卡保留身份、牌堆及回合决策，公开视图不包含未抽取牌的顺序。
  C.constraints = {
    A: { name: '只拆偶数', desc: '行动时只能宣告并拆除偶数蓝线。' },
    B: { name: '只拆奇数', desc: '行动时只能宣告并拆除奇数蓝线。' },
    C: { name: '只拆 1–6', desc: '行动时只能宣告并拆除蓝线 1–6。' },
    D: { name: '只拆 7–12', desc: '行动时只能宣告并拆除蓝线 7–12。' },
    E: { name: '只拆 4–9', desc: '行动时只能宣告并拆除蓝线 4–9。' },
    F: { name: '不拆 4–9', desc: '行动时不能宣告并拆除蓝线 4–9。' },
    G: { name: '禁用装备', desc: '不能使用共享装备或个人能力。' },
    H: { name: '无线索拆线', desc: '不能拆有信息标记的线；自己行动或队友拆自己的线失败时均不提供线索。便利贴不能标自己的线。' },
    I: { name: '不拆队友最大线', desc: '不能拆队友每个线架最右端的未剪线。' },
    J: { name: '不拆队友最小线', desc: '不能拆队友每个线架最左端的未剪线。' },
    K: { name: '禁止单人拆线', desc: '不能使用单人拆线。' },
    L: { name: '失败前进两格', desc: '自己拆线失败时，引爆器前进两格；稳定器仍能保护本次失败。' }
  };
  function constraintState(G) {
    return G.officialState ? moduleFor(G) && G.officialState.constraints : G.official && G.official.constraints;
  }
  C.constraint = function (G, pi) {
    var weak=C.weakLink(G);if(weak&&weak.status==='secret')return G.officialState?pi===weak.owner?weak.cards[pi]:null:weak.ownOwner===pi&&weak.ownWeak?weak.ownConstraint:null;
    var state = constraintState(G);
    if (!state) return null;
    if (state.kind !== 'personal') return state.active;
    var card = state.personal[pi];
    return card && !card.retired ? card.id : null;
  };
  function valueForConstraint(id, value) {
    if (id === 'F') return value === 'Y' || Number.isInteger(value) && (value < 4 || value > 9);
    if ('ABCDE'.indexOf(id) < 0 || !id) return true;
    if (!Number.isInteger(value)) return false;
    if (id === 'A') return value % 2 === 0;
    if (id === 'B') return value % 2 === 1;
    if (id === 'C') return value >= 1 && value <= 6;
    if (id === 'D') return value >= 7 && value <= 12;
    return value >= 4 && value <= 9;
  }
  function ownWires(G, pi) {
    return G.wires ? G.wires.filter(function (w) { return w.o === pi; }) : G.players[pi].stands.reduce(function (out, st) { return out.concat(st); }, []);
  }
  C.ownWireAllowed = function (G, pi, wire) { return !(C.xLocked(G)&&C.isX(G,wire))&&!C.isOutward(G, wire) && (C.constraint(G, pi) !== 'H' || !wire.info&&!wire.unique); };
  C.actorValueAllowed = function (G, pi, value) {
    if(C.xLocked(G)&&!ownWires(G,pi).some(function(w){return !w.cut&&!C.isX(G,w)&&(value==='Y'?w.v!==null&&Math.round((w.v-Math.floor(w.v))*10)===1:w.v===value);}))return false;
    var id = C.constraint(G, pi);
    if (!valueForConstraint(id, value)) return false;
    return id !== 'H' || ownWires(G, pi).some(function (w) { return !w.cut && !w.info&&!w.unique && (value === 'Y' ? Math.round((w.v - Math.floor(w.v)) * 10) === 1 : w.v === value); });
  };
  C.soloAllowed = function (G, pi, wires) {
    return C.constraint(G, pi) !== 'K' && wires.every(function (w) { return C.ownWireAllowed(G, pi, w); });
  };
  C.targetAllowed = function (G, pi, wire) {
    if(C.xLocked(G)&&C.isX(G,wire))return false;
    if (wire.o != null && wire.o < 0) return false;
    if (C.isOutward(G, wire)) return C.allOutward(G)&&wire.o!==pi;
    var id = C.constraint(G, pi);
    if (id === 'H' && (wire.info||wire.unique)) return false;
    if (id !== 'I' && id !== 'J') return true;
    var st = G.players[wire.o].stands[wire.s].map(function (entry) { return typeof entry === 'number' ? G.wires[entry] : entry; }).filter(function (w) { return !w.cut; });
    return !st.length || wire.id !== st[id === 'I' ? st.length - 1 : 0].id;
  };
  C.equipmentAllowed = function (G, pi) { return C.constraint(G, pi) !== 'G' && C.liar(G) !== pi && C.unequippedCaptain(G) !== pi; };
  C.suppressFailureClue = function (G, from, to) { return C.constraint(G, from) === 'H' || C.constraint(G, to) === 'H'; };
  C.failureSteps = function (G, from) {var module=moduleFor(G);if(module&&module.failureSteps)return module.failureSteps(G,from);return C.constraint(G, from) === 'L' ? 2 : 1; };
  C.handleAction = function (G, pi, action, ctx) {
    var module = moduleFor(G);
    return module && module.handleAction ? module.handleAction(G, pi, action, ctx) : null;
  };
  C.afterCut = function (G, ctx) {
    var module = moduleFor(G);
    return module && module.afterCut ? module.afterCut(G, ctx) : false;
  };
  function constraintView(G) {
    var state = G.officialState.constraints;
    return { module: G.officialState.module, version: C.version, constraints: {
      kind: state.kind, active: state.active || null,
      personal: state.personal ? state.personal.map(function (card) { return card ? { id: card.id, retired: !!card.retired } : null; }) : null,
      remaining: state.bindings ? 12-state.completed.length : state.deck ? state.deck.length : 0,
      bindings: state.bindings ? state.bindings.map(function(id,index){return {value:index+1,id:id,completed:state.completed.indexOf(index+1)>=0};}) : undefined,
      available: state.available ? state.available.slice() : [],
      choosing: G.phase === 'constraints' ? G.turn : null,
      captainPending: !!state.captainPending, decisionId: state.decisionId || null
    } };
  }
  function constraintValidation(G, pi, action) {
    var state = G.officialState.constraints;
    if (G.phase === 'constraints' && action.a !== 'constraint-select') return '请先按队长顺序选择限制卡';
    if (state.captainPending && pi === G.turn && ['dual', 'dd', 'solo', 'red', 'equip', 'character'].indexOf(action.a) >= 0) return '队长请先决定保留或更换限制卡';
    if (!C.equipmentAllowed(G, pi) && (action.a === 'equip' || action.a === 'character' || action.a === 'dd' || action.xy || action.xyPersonal || action.stab)) return '限制 G：不能使用共享装备或个人能力';
    if (C.constraint(G, pi) === 'H' && action.a === 'equip' && action.n === 4) return '限制 H：便利贴不能标你的线';
    return null;
  }
  function advanceConstraint(G, ctx) {
    var state = G.officialState.constraints;
    state.active = state.deck.length ? state.deck.shift() : null;
    ctx.log(G, state.active ? '当前共享限制：' + state.active + '「' + C.constraints[state.active].name + '」。' : '限制牌堆已用完，之后按正常规则行动。');
  }
  C.modules['personal-constraints'] = {
    setup: function (G) {
      G.officialState.constraints = { kind: 'personal', personal: G.players.map(function () { return null; }), available: ['A', 'B', 'C', 'D', 'E'], enteredTurn: null };
      G.phase = 'constraints'; G.actionId++; G.officialState.constraints.decisionId = G.actionId;
    },
    validateAction: constraintValidation,
    handleAction: function (G, pi, action, ctx) {
      if (action.a !== 'constraint-select') return null;
      var state = G.officialState.constraints;
      if (G.phase !== 'constraints' || pi !== G.turn || action.id !== state.decisionId || state.available.indexOf(action.card) < 0) return { error: '此限制卡已被选择，或尚未轮到你' };
      state.personal[pi] = { id: action.card, retired: false };
      state.available = state.available.filter(function (id) { return id !== action.card; });
      ctx.log(G, G.players[pi].name + ' 选择限制 ' + action.card + '「' + C.constraints[action.card].name + '」。');
      G.turn = (G.turn + 1) % G.np; G.actionId++; state.decisionId = G.actionId;
      if (state.personal.every(function (card) { return !!card; })) {
        state.available = []; state.decisionId = null; G.turn = G.captain; G.phase = 'setup';
        ctx.log(G, '限制选择完成。现在按队长顺序放置初始信息标记。');
      }
      return { error: null };
    },
    enterTurn: function (G, ctx) {
      var state = G.officialState.constraints;
      if (state.enteredTurn === G.turnNo) return;
      state.enteredTurn = G.turnNo;
      var card = state.personal[G.turn];
      if (card && !card.retired && !ctx.canAct(G, G.turn)) {
        card.retired = true;
        ctx.log(G, G.players[G.turn].name + ' 回合开始无法遵守限制 ' + card.id + '，永久翻面，之后正常行动。');
      }
    },
    view: constraintView
  };
  function sharedConstraints(kind) {
    return {
      setup: function (G, ctx) {
        var deck = ctx.shuffle(Object.keys(C.constraints), ctx.rng);
        G.officialState.constraints = { kind: kind, active: deck.shift(), deck: deck, completed: [], enteredTurn: null, captainPending: false };
      },
      validateAction: constraintValidation,
      handleAction: function (G, pi, action, ctx) {
        if (action.a !== 'constraint-ready') return null;
        var state = G.officialState.constraints;
        if (kind !== 'captain' || G.phase !== 'play' || G.pending || pi !== G.turn || pi !== G.captain || !state.captainPending || action.id !== state.decisionId || typeof action.replace !== 'boolean') return { error: '这次队长限制选择已经失效' };
        state.captainPending = false; state.decisionId = null;
        if (action.replace) advanceConstraint(G, ctx);
        this.enterTurn(G, ctx);
        return { error: null };
      },
      afterCut: function (G, ctx) {
        if (kind !== 'completion') return;
        var state = G.officialState.constraints;
        for (var v = 1; v <= 12; v++) if (ctx.cutCount(G, v) === 4 && state.completed.indexOf(v) < 0) {
          state.completed.push(v); advanceConstraint(G, ctx);
        }
      },
      enterTurn: function (G, ctx) {
        var state = G.officialState.constraints;
        for (var skip = 0; skip <= G.np + 12; skip++) {
          if (state.enteredTurn !== G.turnNo) {
            state.enteredTurn = G.turnNo;
            state.captainPending = kind === 'captain' && G.turn === G.captain && !!state.active;
            if (state.captainPending) { G.actionId++; state.decisionId = G.actionId; }
          }
          if (state.captainPending || ctx.canAct(G, G.turn)) return;
          if (kind === 'completion' && !G.players.some(function (_, i) { return ctx.canAct(G, i); })) {
            G.det++;
            ctx.log(G, '全队无法遵守限制，引爆器前进一格并更换限制。', 'bad');
            if (G.det >= G.detMax) { ctx.lose(G, '引爆器走到尽头，限制任务失败。'); return; }
            advanceConstraint(G, ctx);
            continue;
          }
          ctx.log(G, G.players[G.turn].name + ' 无法遵守当前限制，免费跳过回合。');
          G.turn = ctx.nextPlayer(G, G.turn); G.turnNo++;
        }
      },
      view: constraintView
    };
  }
  C.modules['shared-captain-constraints'] = sharedConstraints('captain');
  C.modules['shared-completion-constraints'] = sharedConstraints('completion');
  C.constraintRing=function(G){var state=G.officialState||G.official;return state&&state.version===C.version&&state.module==='rotating-personal-constraints'?state.constraints:null;};
  C.numberRewards=function(G){var state=G.officialState||G.official;return state&&state.version===C.version&&state.module==='number-completion-rewards'?state.numberRewards:null;};
  C.numberRelay=function(G){var state=G.officialState||G.official;return state&&state.version===C.version&&state.module==='number-card-relay'?state.numberRelay:null;};
  C.relayMatching=function(G,pi){var s=C.numberRelay(G);return !!s&&s.hands[pi].some(function(card){var value=typeof card==='number'?card:card.value;return s.completed.indexOf(value)<0&&ownWires(G,pi).some(function(w){return !w.cut&&w.v===value;});});};
  function flipRelayNumbers(G,ctx){var s=C.numberRelay(G);for(var v=1;v<=12;v++)if(ctx.cutCount(G,v)===4&&s.completed.indexOf(v)<0){s.completed.push(v);ctx.log(G,'数字牌 '+v+' 对应四根完成，翻到背面；仍可传递。');}}
  function nextRelayChoice(G,ctx){var s=C.numberRelay(G);while(s.queue.length){var entry=s.queue.shift();if(!s.hands[entry.owner].length)continue;G.pending={type:'number-relay',id:++G.actionId,from:G.turn,to:entry.owner,retiring:entry.retiring,nextIdx:s.nextIdx};return true;}s.transferDoneTurn=G.turnNo;return false;}
  function prepareRelay(G,ctx,others,nextIdx){var s=C.numberRelay(G);s.nextIdx=nextIdx===undefined?null:nextIdx;s.queue=others.map(function(owner){return {owner:owner,retiring:true};});s.queue.push({owner:G.turn,retiring:!ownWires(G,G.turn).some(function(w){return !w.cut;})});return nextRelayChoice(G,ctx);}
  C.modules['number-card-relay']={
    prepareMission:function(mission,count){if(count===2)throw Error('第65关官方任务不能双人游玩，请跳到第66关');},
    setup:function(G,ctx){var deck=ctx.shuffle(Array.from({length:12},function(_,i){return i+1;}),ctx.rng),hands=G.players.map(function(){return [];});deck.forEach(function(value,index){hands[(G.captain+index)%G.np].push(value);});G.officialState.numberRelay={hands:hands,completed:[],queue:[],transferDoneTurn:null,nextIdx:null,wholeSkipTurn:null};},
    allowedValue:function(G,value){var s=C.numberRelay(G);return Number.isInteger(value)&&s.completed.indexOf(value)<0&&s.hands[G.turn].indexOf(value)>=0;},
    validateAction:function(G,pi,a){if(G.pending&&G.pending.type==='number-relay'&&a.a!=='number-relay')return '先由指定玩家传出一张数字牌';if(a.xy||a.xyPersonal||a.a==='equip'&&a.n===10||a.a==='character'&&G.players[pi].character.id==='xy-ray')return '本关不使用共享或个人X/Y射线';if(a.a==='equip'&&a.n===11)C.numberRelay(G).wholeSkipTurn=G.turnNo;return null;},
    afterCut:function(G,ctx){flipRelayNumbers(G,ctx);var others=[];(G.lastAct&&G.lastAct.ids||[]).forEach(function(id){var owner=G.wires[id].o;if(owner!==G.turn&&others.indexOf(owner)<0&&!ownWires(G,owner).some(function(w){return !w.cut;}))others.push(owner);});if(prepareRelay(G,ctx,others))return true;ctx.endTurn(G);return true;},
    finishTurn:function(G,ctx,nextIdx){var s=C.numberRelay(G);if(s.wholeSkipTurn===G.turnNo){s.wholeSkipTurn=null;return false;}if(s.transferDoneTurn===G.turnNo)return false;return prepareRelay(G,ctx,[],nextIdx);},
    handleAction:function(G,pi,a,ctx){
      if(a.a==='number-relay-skip'){if(G.phase!=='play'||G.pending||G.turn!==pi||C.relayMatching(G,pi))return {error:'只有没有可拆对应数字的当前玩家才能罚格跳过'};if(a.stab||a.xy||a.xyPersonal)return {error:'跳过保护尚未核实，不能组合装备修饰'};G.det++;ctx.log(G,G.players[pi].name+' 没有符合数字牌的导线，跳过并推进引爆器一格。','bad');ctx.endTurn(G);return {error:null};}
      if(a.a!=='number-relay')return null;var s=C.numberRelay(G),p=G.pending;if(G.phase!=='play'||!p||p.type!=='number-relay'||p.to!==pi||p.id!==a.id||!Number.isInteger(a.value)||s.hands[pi].indexOf(a.value)<0||!Number.isInteger(a.recipient)||a.recipient===pi||!G.players[a.recipient])return {error:'数字传牌选择已过期，或请选自己的牌及另一队友'};
      s.hands[pi]=s.hands[pi].filter(function(value){return value!==a.value;});s.hands[a.recipient].push(a.value);ctx.log(G,G.players[pi].name+' 将'+(s.completed.indexOf(a.value)<0?'正面数字 '+a.value:'一张已完成背面牌')+' 交给 '+G.players[a.recipient].name+'。');G.pending=null;
      if(p.retiring&&s.hands[pi].some(function(value){return s.completed.indexOf(value)<0;})){ctx.lose(G,'清空导线后传出一牌，仍留有正面数字牌，任务失败。');return {error:null};}
      if(!nextRelayChoice(G,ctx))ctx.endTurn(G,p.nextIdx==null?undefined:p.nextIdx);return {error:null};
    },
    pendingView:function(G,pi){var p=G.pending;if(!p||p.type!=='number-relay')return null;var out={type:p.type,id:p.id,from:p.from,to:p.to,retiring:p.retiring};if(pi===p.to)out.choices=C.numberRelay(G).hands[pi].slice();return out;},
    view:function(G){var s=C.numberRelay(G);return {module:'number-card-relay',version:C.version,numberRelay:{hands:s.hands.map(function(hand){return hand.map(function(value){return {value:value,completed:s.completed.indexOf(value)>=0};});}),completed:s.completed.slice()}};}
  };
  function completedNumberRewards(G,ctx){var s=C.numberRewards(G);s.values.forEach(function(value){if(ctx.cutCount(G,value)===4&&s.completed.indexOf(value)<0){s.completed.push(value);var previous=G.det;G.det=Math.max(G.detMin,G.det-1);ctx.log(G,'奖励数字 '+value+' 四根完成，'+(G.det<previous?'引爆器后退一格。':'引爆器已在最早格，保持不动。'),'good');}});return false;}
  C.modules['number-completion-rewards']={
    setup:function(G,ctx){G.det=0;G.detMax=1;G.detMin=-4;G.officialState.numberRewards={values:ctx.shuffle(Array.from({length:12},function(_,i){return i+1;}),ctx.rng).slice(0,G.np),completed:[]};},
    afterCut:completedNumberRewards,
    afterEquipmentEffect:function(G,effect,ctx){completedNumberRewards(G,ctx);return null;},
    view:function(G){var s=C.numberRewards(G);return {module:'number-completion-rewards',version:C.version,numberRewards:{values:s.values.slice(),completed:s.completed.slice()}};}
  };
  function syncRing(G){var s=C.constraintRing(G);s.personal=G.players.map(function(_,owner){return {id:s.ring.find(function(slot){return slot.owner===owner;}).id,retired:false};});}
  function ringDeadlock(G,canAct){return !G.pending&&G.wires.some(function(w){return !w.cut;})&&!G.players.some(function(_,owner){return canAct(G,owner);});}
  C.ringConstraintDeadlock=function(G,canAct){return !!(C.constraintRing(G)&&ringDeadlock(G,canAct));};
  C.modules['rotating-personal-constraints']={
    setup:function(G,ctx){var cards=ctx.shuffle(['A','B','C','D','E'],ctx.rng),ring=[{owner:G.captain,side:null,id:cards.shift()}];if(G.np<=3)ring.push({owner:null,side:'left',id:cards.shift()});for(var k=1;k<G.np;k++)ring.push({owner:(G.captain+k)%G.np,side:null,id:cards.shift()});if(G.np===2)ring.push({owner:null,side:'right',id:cards.shift()});G.officialState.constraints={kind:'personal',ring:ring,personal:[],deck:ctx.shuffle(['F','G','H','I','J','K','L'],ctx.rng),discard:[],available:[],captainPending:false,enteredTurn:null,decisionId:null,revision:0,edition:'de'};syncRing(G);},
    enterTurn:function(G,ctx){
      if(G.pending)return;var s=C.constraintRing(G);
      if(ringDeadlock(G,ctx.canAct)){ctx.lose(G,'按本局德文原卡，全队无法遵守各自限制，炸弹爆炸。');return;}
      for(var skip=0;skip<G.np;skip++){
        if(s.enteredTurn!==G.turnNo){s.enteredTurn=G.turnNo;s.captainPending=G.turn===G.captain;if(s.captainPending)s.decisionId=++G.actionId;}
        if(s.captainPending||ctx.canAct(G,G.turn))return;
        ctx.log(G,G.players[G.turn].name+' 无法遵守个人限制，免费跳过；引爆器不动。');G.turn=ctx.nextPlayer(G,G.turn);G.turnNo++;
      }
    },
    validateAction:function(G,pi,a){
      if(G.pending&&G.pending.type==='constraint-vote'&&a.a!=='constraint-vote')return '请先完成全队的限制轮转确认';
      if(a.a==='red')return null;
      return constraintValidation(G,pi,a);
    },
    handleAction:function(G,pi,a,ctx){
      var s=C.constraintRing(G);
      if(a.a==='red'&&pi===G.turn&&!G.pending){s.captainPending=false;return null;}
      if(a.a==='constraint-replace'){
        if(G.phase!=='play'||G.pending||a.revision!==s.revision||!s.deck.length)return {error:'个人换牌已过期、牌堆已空，或尚有动作等待结算'};
        if(a.stab||a.xy||a.xyPersonal)return {error:'换限制不能组合拆线修饰'};
        var slot=s.ring.find(function(x){return x.owner===pi;});s.discard.push(slot.id);slot.id=s.deck.shift();s.revision++;if(s.captainPending)s.decisionId=++G.actionId;syncRing(G);G.det++;ctx.log(G,G.players[pi].name+' 更换个人限制为 '+slot.id+'「'+C.constraints[slot.id].name+'」，引爆器前进一格。','bad');if(G.det>=G.detMax)ctx.lose(G,'个人换限制推进引爆器到末端，炸弹爆炸。');else this.enterTurn(G,ctx);return {error:null};
      }
      if(a.a==='constraint-rotation'){
        if(G.phase!=='play'||G.pending||G.turn!==pi||pi!==G.captain||!s.captainPending||a.id!==s.decisionId||[0,1,-1].indexOf(a.direction)<0)return {error:'队长轮转决定已过期或尚未轮到你'};
        s.captainPending=false;
        if(a.direction===0){ctx.log(G,'队长决定本轮保留各自的限制。');this.enterTurn(G,ctx);return {error:null};}
        G.pending={type:'constraint-vote',id:++G.actionId,from:pi,to:(pi+1)%G.np,direction:a.direction,answered:[pi]};ctx.log(G,'队长提议限制全部'+(a.direction===1?'顺时针':'逆时针')+'轮转一位，等待全队同意。');return {error:null};
      }
      if(a.a!=='constraint-vote')return null;
      var pd=G.pending;if(G.phase!=='play'||!pd||pd.type!=='constraint-vote'||pd.to!==pi||a.id!==pd.id||typeof a.agree!=='boolean')return {error:'轮转确认已过期或尚未轮到你'};
      pd.answered.push(pi);
      if(!a.agree){G.pending=null;ctx.log(G,G.players[pi].name+' 不同意轮转，本轮限制保留。');this.enterTurn(G,ctx);return {error:null};}
      if(pd.answered.length<G.np){pd.to=(pi+1)%G.np;ctx.log(G,G.players[pi].name+' 同意轮转，等待下一位确认。');return {error:null};}
      var previous=s.ring.map(function(x){return x.id;});s.ring.forEach(function(x,index){x.id=previous[(index-pd.direction+previous.length)%previous.length];});s.revision++;syncRing(G);G.pending=null;ctx.log(G,'全队同意，所有限制'+(pd.direction===1?'顺时针':'逆时针')+'轮转一位，包括队长旁的额外牌位。');this.enterTurn(G,ctx);return {error:null};
    },
    pendingView:function(G,pi){var pd=G.pending;if(!pd||pd.type!=='constraint-vote')return null;var out={type:pd.type,id:pd.id,from:pd.from,to:pd.to,direction:pd.direction,answered:pd.answered.slice()};if(pi===pd.to)out.choices=[true,false];return out;},
    view:function(G){var out=constraintView(G),s=C.constraintRing(G);out.constraints.ring=s.ring.map(function(x){return Object.assign({},x);});out.constraints.discard=s.discard.slice();out.constraints.revision=s.revision;out.constraints.edition=s.edition;return out;}
  };
  C.robotRoute=function(G){var state=G.officialState||G.official;return state&&state.version===C.version&&state.module==='robot-number-route'?state.robotRoute:null;};
  C.robotRouteValues=function(G,pi){var s=C.robotRoute(G);if(!s)return [];return s.row.filter(function(value,index){return (index-s.position)*s.direction>=0&&ownWires(G,pi).some(function(w){return !w.cut&&w.v===value;});});};
  C.modules['robot-number-route']={
    setup:function(G,ctx){var row=ctx.shuffle(Array.from({length:12},function(_,i){return i+1;}),ctx.rng),position=row.indexOf(7);G.officialState.robotRoute={row:row,position:position,direction:position<6?1:-1,step:'move',decisionId:null,completed:[]};},
    enterTurn:function(G){var s=C.robotRoute(G);if(s.actor===G.turn&&s.turnNo===G.turnNo)return;s.actor=G.turn;s.turnNo=G.turnNo;s.step='move';s.decisionId=++G.actionId;},
    allowedValue:function(G,value){var s=C.robotRoute(G);return s.step==='cut'&&value===s.row[s.position];},
    validateAction:function(G,pi,a){
      if(G.phase!=='play')return null;var s=C.robotRoute(G);
      if(G.pending&&G.pending.type==='robot-direction'&&a.a!=='robot-direction')return '请先由行动者选择机器人的朝向';
      if((a.a==='equip'||a.a==='character')&&a.n===11&&s.step!=='move')return '咖啡杯须在移动前跳过整个回合';
      if((['dual','dd','solo'].indexOf(a.a)>=0||(a.a==='equip'||a.a==='character')&&[3,5,9,10,16].indexOf(a.n)>=0)&&s.step!=='cut')return '先选择机器人向前移动或停留的数字，再拆线';
      return null;
    },
    handleAction:function(G,pi,a,ctx){
      if(['robot-move','robot-reverse','robot-direction'].indexOf(a.a)<0)return null;var s=C.robotRoute(G);
      if(a.a==='robot-direction'){var pd=G.pending;if(G.phase!=='play'||!pd||pd.type!=='robot-direction'||pd.to!==pi||pd.id!==a.id||[1,-1].indexOf(a.direction)<0)return {error:'机器人朝向选择已过期或不是你的决定'};s.direction=a.direction;s.step='done';G.pending=null;ctx.log(G,G.players[pi].name+' 选择机器人朝'+(a.direction===1?'右':'左')+'，下一位继续。');ctx.endTurn(G,pd.nextIdx==null?undefined:pd.nextIdx);return {error:null};}
      if(G.phase!=='play'||G.pending||G.turn!==pi||s.step!=='move'||s.decisionId!==a.id)return {error:'机器人移动选择已过期或尚未轮到你'};
      var values=C.robotRouteValues(G,pi);
      if(a.a==='robot-reverse'){if(values.length||!ownWires(G,pi).some(function(w){return !w.cut&&Number.isInteger(w.v);}))return {error:'仍有当前位置或前方的蓝值，不能付费反向'};if(a.stab||a.xy||a.xyPersonal)return {error:'反向不能组合拆线修饰'};s.direction*=-1;s.decisionId=++G.actionId;G.det++;ctx.log(G,G.players[pi].name+' 没有可达蓝值，机器人反向，引爆器前进一格。','bad');if(G.det>=G.detMax)ctx.lose(G,'机器人反向推进引爆器到末端，炸弹爆炸。');return {error:null};}
      if(!Number.isInteger(a.val)||values.indexOf(a.val)<0)return {error:'只能向前移动或停在自己持有的蓝色数字'};
      s.position=s.row.indexOf(a.val);s.step='cut';ctx.log(G,G.players[pi].name+' 将机器人'+(values.length?'移动或停留':'移动')+'在 '+a.val+'，本回合必须拆该值。');return {error:null};
    },
    afterCut:function(G,ctx){var s=C.robotRoute(G);s.completed=s.row.filter(function(value){return ctx.cutCount(G,value)===4;});return false;},
    finishTurn:function(G,ctx,nextIdx){var s=C.robotRoute(G);if(s.step!=='cut'||G.wires.every(function(w){return w.cut;}))return false;s.step='direction';G.pending={type:'robot-direction',id:++G.actionId,from:G.turn,to:G.turn,nextIdx:nextIdx==null?null:nextIdx};return true;},
    pendingView:function(G,pi){var pd=G.pending;if(!pd||pd.type!=='robot-direction')return null;var out={type:pd.type,id:pd.id,from:pd.from,to:pd.to};if(pi===pd.to)out.choices=[-1,1];return out;},
    view:function(G){var s=C.robotRoute(G);return {module:'robot-number-route',version:C.version,robotRoute:{row:s.row.slice(),position:s.position,direction:s.direction,step:s.step,decisionId:s.decisionId,completed:s.completed.slice()}};}
  };
  C.modules['number-bound-constraints']={
    setup:function(G,ctx){G.officialState.constraints={kind:'bound',active:null,bindings:ctx.shuffle(Object.keys(C.constraints),ctx.rng),completed:[]};},
    validateAction:constraintValidation,
    afterCut:function(G,ctx){var state=G.officialState.constraints;for(var value=1;value<=12;value++)if(ctx.cutCount(G,value)===4&&state.completed.indexOf(value)<0){state.completed.push(value);state.active=state.bindings[value-1];ctx.log(G,'蓝色 '+value+' 全部完成，共享限制立即换为 '+state.active+'「'+C.constraints[state.active].name+'」。');}return false;},
    enterTurn:function(G,ctx){
      if(!G.players.some(function(_,owner){return ctx.canAct(G,owner);})){if(G.wires.some(function(w){return !w.cut;}))ctx.lose(G,'全队无法在当前共享限制下行动，炸弹爆炸。');return;}
      for(var skip=0;skip<G.np&&!ctx.canAct(G,G.turn);skip++){ctx.log(G,G.players[G.turn].name+' 无法遵守当前共享限制，免费跳过；引爆器不动。');G.turn=ctx.nextPlayer(G,G.turn);G.turnNo++;}
    },
    view:constraintView
  };

  // Mission 58 has no initial or failure clues and never spends the Double Detector.
  // Its catalog gate also requires the Box 5 equipment implementations.
  C.modules['reusable-double-detector'] = {
    reusableCharacter: true,
    view: function () { return { module: 'reusable-double-detector', version: C.version, reusableCharacter: true }; }
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = C;
  else window.BB_CAMPAIGN = C;
})();
