/* 炸弹克星 · AI 队友：只使用该玩家能看到的信息做概率推理 */
(function () {
  var BB = typeof module !== 'undefined' && module.exports ? require('./engine.js') : window.BB;
  var Bot = {};

  // 为每人一黄的公开设置构造可行样本；只用公开组成员、计数、标记和本人已知线。
  function tripwireSeed(G,pi,val,gaps,hidden,pool,kind,announcement){
    var state=BB.tripwire(G),groupOf={},needs=[],left=[],counts={},values=[],side=BB.view(G,pi).official.sideClues||[],budget=40000;
    G.wires.forEach(function(w){if(hidden.indexOf(w.id)<0&&val[w.id]==null)val[w.id]=BB.wireVisible(G,pi,w)?w.v:w.info&&w.info.t==='v'?w.info.v:null;});
    state.groups.forEach(function(group,index){needs[index]=group.yellow;left[index]=0;group.ids.forEach(function(id){groupOf[id]=index;if(hidden.indexOf(id)>=0)left[index]++;else if(kind(val[id])==='y')needs[index]--;});});
    if(needs.some(function(n,i){return n<0||n>left[i];}))return false;
    pool.forEach(function(v){if(!counts[v])values.push(v);counts[v]=(counts[v]||0)+1;});
    var cursor=gaps.map(function(){return 0;}),previous=gaps.map(function(g){return g.lo;});
    function options(g,index,candidateId){var id=candidateId==null?g.ids[cursor[index]]:candidateId,group=groupOf[id],info=G.wires[id].info;return values.filter(function(v){
      var yellow=kind(v)==='y';if(!counts[v]||v<previous[index]||v>g.hi||yellow&&needs[group]===0||!yellow&&left[group]===needs[group])return false;
      if(info&&info.t==='Y'&&!yellow)return false;
      if(side.some(function(token){return token.owner===group&&token.value===announcement(v);}))return false;
      return G.labels.every(function(label){if(label.a!==id&&label.b!==id)return true;var other=label.a===id?label.b:label.a;if(val[other]==null)return true;return (announcement(v)===announcement(val[other]))===(label.t==='eq');});
    });}
    function feasible(){
      var slots=[],byGap=[];
      for(var i=0;i<gaps.length;i++){var domains=[];for(var j=cursor[i];j<gaps[i].ids.length;j++){var domain=options(gaps[i],i,gaps[i].ids[j]);if(!domain.length)return false;domains.push(domain);slots.push({domain:domain,group:groupOf[gaps[i].ids[j]]});}byGap.push(domains);}
      for(var v=0;v<values.length;v++){var value=values[v];if(counts[value]&&slots.filter(function(slot){return slot.domain.indexOf(value)>=0;}).length<counts[value])return false;}
      for(var g=0;g<byGap.length;g++){var available=values.reduce(function(n,value){return n+(byGap[g].some(function(domain){return domain.indexOf(value)>=0;})?counts[value]:0);},0);if(available<byGap[g].length)return false;}
      for(var group=0;group<needs.length;group++){var members=slots.filter(function(slot){return slot.group===group;}),possible=members.filter(function(slot){return slot.domain.some(function(value){return kind(value)==='y';});}).length,forced=members.filter(function(slot){return slot.domain.every(function(value){return kind(value)==='y';});}).length;if(possible<needs[group]||forced>needs[group])return false;}
      for(var threshold=0;threshold<values.length;threshold++){
        var edge=values[threshold],low=values.reduce(function(n,value){return n+(value<=edge?counts[value]:0);},0),high=values.reduce(function(n,value){return n+(value>=edge?counts[value]:0);},0);
        if(slots.filter(function(slot){return slot.domain.every(function(value){return value<=edge;});}).length>low||slots.filter(function(slot){return slot.domain.some(function(value){return value<=edge;});}).length<low)return false;
        if(slots.filter(function(slot){return slot.domain.every(function(value){return value>=edge;});}).length>high||slots.filter(function(slot){return slot.domain.some(function(value){return value>=edge;});}).length<high)return false;
      }return true;
    }
    function assign(depth){
      if(--budget<0)return false;if(depth===hidden.length)return needs.every(function(n){return n===0;});if(!feasible())return false;
      var selected=-1,domain=null;for(var i=0;i<gaps.length;i++){if(cursor[i]===gaps[i].ids.length)continue;var available=options(gaps[i],i);if(!available.length)return false;if(domain==null||available.length<domain.length){selected=i;domain=available;}}
      BB.shuffle(domain,Math.random);var g=gaps[selected],id=g.ids[cursor[selected]],group=groupOf[id],old=previous[selected];
      for(var j=0;j<domain.length;j++){var value=domain[j],yellow=kind(value)==='y';counts[value]--;left[group]--;if(yellow)needs[group]--;val[id]=value;cursor[selected]++;previous[selected]=value;
        if(assign(depth+1))return true;
        previous[selected]=old;cursor[selected]--;val[id]=null;if(yellow)needs[group]++;left[group]++;counts[value]++;
      }return false;
    }
    return assign(0);
  }

  // 蒙特卡洛推理：在所有与公开信息一致的摆法中随机游走采样，
  // 估计每根未知线是各个宣告值（以及红线）的概率。
  // 只交换/替换“对该玩家未知”的线，候选黄/红线也会互相替换，不偷看真相。
  function infer(G, pi, iters) {
    var R = G.mission.rules || {};
    // 数字转红的规则公开，但每根隐藏导线的实际颜色不读取。
    var redNumber = BB.redNumber(G);
    function candidateKind(value) { return value === redNumber ? 'r' : BB.kindOf(value); }
    function candidateAnnouncement(value) { return value === redNumber ? 'R' : BB.annOf(value); }
    var val = {}, gapOf = {}, gaps = [], hidden = [], anonymous = {};
    G.players.forEach(function (p, o) {
      if (o === pi && !G.wires.some(function (w) { return w.o === pi && !w.cut && BB.isOutward(G, w); })) return;
      p.stands.forEach(function (st) {
        var cur = null, lastKnown = -Infinity;
        st.forEach(function (id) {
          var w = G.wires[id];
          if (o === pi && !BB.isOutward(G, w)) { val[id] = w.v; return; }
          if (BB.isOutward(G, w)) {
            if (w.cut) { val[id] = w.v; return; }
            if (o !== pi) { val[id] = w.v; return; }
            val[id] = null; var ownGap = { lo: -Infinity, hi: Infinity, ids: [id] }; gaps.push(ownGap); gapOf[id] = ownGap; hidden.push(id); return;
          }
          var visible = BB.wireVisible(G, pi, w);
          val[id] = visible ? w.v : G.ruleset === 'physical' && (!w.info || w.info.t !== 'v') ? null : (w.info && w.info.t === 'v' ? w.info.v : w.v);
          var known = visible || (w.info && w.info.t === 'v');
          if (BB.isX(G, w)) {
            if (!known) { var independent = { lo: -Infinity, hi: Infinity, ids: [id] }; gaps.push(independent); gapOf[id] = independent; hidden.push(id); }
            return;
          }
          if (known) {
            if (cur) { cur.hi = val[id]; cur = null; }
            lastKnown = val[id];
          } else {
            if (!cur) { cur = { lo: lastKnown, hi: Infinity, ids: [] }; gaps.push(cur); }
            cur.ids.push(id); gapOf[id] = cur; hidden.push(id);
          }
        });
      });
    });
    var nanoView=BB.nano(BB.view(G,pi));
    if(nanoView)for(var reserveIndex=0;reserveIndex<nanoView.remaining;reserveIndex++){
      var reserveId='nano-unknown-'+reserveIndex,gap={lo:-Infinity,hi:Infinity,ids:[reserveId]};anonymous[reserveId]={info:null};val[reserveId]=null;hidden.push(reserveId);gaps.push(gap);gapOf[reserveId]=gap;
    }
    if (G.ruleset === 'physical') {
      // Build a possible deal from public counts and this bot's own hand.
      // The authoritative hidden wire values never seed the probability walk.
      var known = {}, fixedColors = { y: [], r: [] };
      G.wires.forEach(function (w) {
        if (w.o < 0 || hidden.indexOf(w.id) >= 0) return;
        var v = BB.wireVisible(G, pi, w) ? w.v : w.info && w.info.t === 'v' ? w.info.v : null;
        if (v == null) return;
        var k = BB.kindOf(v);
        if (k === 'b') known[v] = (known[v] || 0) + 1;
        else fixedColors[k].push(v);
      });
      var pool = [];
      for (var blue = G.mission.blue[0]; blue <= G.mission.blue[1]; blue++)
        for (var copies = known[blue] || 0; copies < 4; copies++) pool.push(blue);
      function addColor(mark, frac, kind) {
        var candidates = R.hide || !mark.cand.length ? [] : mark.cand.slice();
        if (!candidates.length) for (var n = 1; n <= 11; n++) candidates.push(n + frac);
        candidates = candidates.filter(function (v) { return fixedColors[kind].indexOf(v) < 0; });
        BB.shuffle(candidates, Math.random);
        for (var i = fixedColors[kind].length; i < mark.n && candidates.length; i++) pool.push(candidates.pop());
      }
      var bluePool=pool.slice();
      addColor(G.ymark, 0.1, 'y'); addColor(G.rmark, 0.5, 'r');
      if (pool.length === hidden.length) {
        var seededTripwire=false;
        if(BB.tripwire(G)){
          var availableR=G.rmark.cand.filter(function(v){return fixedColors.r.indexOf(v)<0;}),neededR=G.rmark.n-fixedColors.r.length,variants=[];
          function combinations(start,chosen){if(chosen.length===neededR){variants.push(chosen.slice());return;}for(var i=start;i<availableR.length;i++)combinations(i+1,chosen.concat([availableR[i]]));}
          combinations(0,[]);BB.shuffle(variants,Math.random);
          for(var retry=0;retry<variants.length;retry++){hidden.forEach(function(id){val[id]=null;});pool=bluePool.slice();addColor(G.ymark,0.1,'y');pool=pool.concat(variants[retry]);if(tripwireSeed(G,pi,val,gaps,hidden,pool,candidateKind,candidateAnnouncement)){seededTripwire=true;break;}}
        }
        if(!seededTripwire){
        gaps.sort(function (a, b) {
          var ca = pool.filter(function (v) { return v >= a.lo && v <= a.hi; }).length - a.ids.length;
          var cb = pool.filter(function (v) { return v >= b.lo && v <= b.hi; }).length - b.ids.length;
          return ca - cb;
        });
        gaps.forEach(function (gap) {
          var chosen = [];
          for (var i = 0; i < gap.ids.length; i++) {
            var options = pool.map(function (v, index) { return { v: v, index: index }; })
              .filter(function (item) { return item.v >= gap.lo && item.v <= gap.hi; });
            var choice = options.length ? options[Math.floor(Math.random() * options.length)].index : 0;
            chosen.push(pool.splice(choice, 1)[0]);
          }
          chosen.sort(function (a, b) { return a - b; });
          gap.ids.forEach(function (id, i) { val[id] = chosen[i]; });
        });
        }
      }
    }
    var lab = {};
    G.labels.forEach(function (l) { (lab[l.a] = lab[l.a] || []).push(l); (lab[l.b] = lab[l.b] || []).push(l); });
    function slotOk(id) {
      var v = val[id], f = (anonymous[id] || G.wires[id]).info, k = candidateKind(v);
      if(!anonymous[id]&&(G.wires[id].unique||G.announcement&&G.announcement.frequencyOnly&&G.announcement.id===id)&&k!=='b')return false;
      if (f) {
        if(f.t==='v'&&v!==f.v)return false;
        if (f.t === 'Y' && k !== 'y') return false;
        if ((f.t === 'odd' || f.t === 'even') && (k !== 'b' || (v % 2 === 0) !== (f.t === 'even'))) return false;
        if (f.t === 'not' && String(f.v).split('/').indexOf(String(candidateAnnouncement(v))) >= 0) return false;
      }
      var ls = lab[id];
      if (ls) for (var j = 0; j < ls.length; j++) {
        var same = candidateAnnouncement(val[ls[j].a]) === candidateAnnouncement(val[ls[j].b]);
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
    var fixedVals = G.wires.filter(function (w) { return w.o >= 0 && hidden.indexOf(w.id) < 0; }).map(function (w) { return w.v; });
    function inUse(v) {
      for (var i = 0; i < fixedVals.length; i++) if (Math.abs(fixedVals[i] - v) < 1e-6) return true;
      for (var j = 0; j < hidden.length; j++) if (Math.abs(val[hidden[j]] - v) < 1e-6) return true;
      return false;
    }
    // 频率取整架计数，包括已剪线；只计入符合所有公开频率标记的样本。
    function tripwiresOk(){var state=BB.tripwire(G);return !state||state.groups.every(function(group){return group.ids.filter(function(id){return candidateKind(val[id])==='y';}).length===group.yellow;});}
    function outwardOrderOk(){if(!BB.doubleOutward(G))return true;var ids=G.officialState.outwardGroups[pi],a=val[ids[0]],b=val[ids[1]];return a===undefined||b===undefined||a<=b;}
    function frequenciesOk() {
      return G.wires.every(function (wire) {
        var single=wire.unique||G.announcement&&G.announcement.frequencyOnly&&G.announcement.id===wire.id;
        if ((!single&&(!wire.info||wire.info.t!=='freq'))||wire.o===pi)return true;
        var value = val[wire.id], expected = single?1:wire.info.v * (wire.info.copies || 1);
        if (!Number.isInteger(value)) return false;
        var count = G.players[wire.o].stands[wire.s].filter(function (id) { return val[id] === value; }).length;
        return count === expected;
      });
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
        if (!inUse(nv)) { val[a] = nv; if (!settle(ga) || !tripwiresOk() || !outwardOrderOk()) restore(ga, sa); }
      } else {
        var b = hidden[Math.floor(Math.random() * H)];
        if (val[a] !== val[b]) {
          var gb = gapOf[b], sb = snap(gb);
          var x = val[a]; val[a] = val[b]; val[b] = x;
          if (!settle(ga) || (gb !== ga && !settle(gb)) || !tripwiresOk() || !outwardOrderOk()) { restore(ga, sa); restore(gb, sb); }
        }
      }
      if (t >= burn && t % 4 === 0 && hidden.every(slotOk) && frequenciesOk() && tripwiresOk() && outwardOrderOk()) {
        n++;
        for (var h = 0; h < H; h++) {
          var id = hidden[h], an = candidateAnnouncement(val[id]);
          cnt[id][an] = (cnt[id][an] || 0) + 1;
          if (an === 'R') red[id]++;
        }
      }
    }
    var out = {};
    hidden.forEach(function (id) {
      if (anonymous[id]) return;
      var P = {};
      for (var k in cnt[id]) P[k] = cnt[id][k] / (n || 1);
      out[id] = { P: P, red: red[id] / (n || 1) };
    });
    // 已有确切信息标记的线
    G.wires.forEach(function (w) {
      if (w.o !== pi && !w.cut && (BB.wireVisible(G, pi, w) || w.info && w.info.t === 'v')) { var P = {}, declared = candidateAnnouncement(BB.wireVisible(G, pi, w) ? w.v : w.info.v); P[declared] = 1; out[w.id] = { P: P, red: declared === 'R' ? 1 : 0 }; }
    });
    return out;
  }
  Bot.infer = infer;

  function CFalseValues(G,actual){var C=typeof module!=='undefined'&&module.exports?require('./campaign-rules.js'):window.BB_CAMPAIGN;var tokens=C.availableInfoTokens(G,false).map(function(t){return t.value;}).filter(function(v){return v!==actual;});tokens=Array.from(new Set(tokens));if(!tokens.length)tokens=Array.from({length:12},function(_,i){return i+1;}).filter(function(v){return v!==actual;});tokens.sort(function(a,b){return Math.abs(a-actual)-Math.abs(b-actual)||a-b;});return tokens;}
  Bot.decide = function (G, pi) {
    if (G.paused || G.audioClock&&G.audioClock.cutHeld) return null;
    var V = BB.view(G, pi);
    var M = G.mission;
    var me = V.players[pi];
    var weak=BB.weakLink(V);if(weak&&weak.startPending&&G.phase==='play'&&G.turn===pi&&!V.pending)return {a:'weak-pass',id:weak.decisionId};
    if(BB.personalCardsLocked(V)){me.dd=0;me.character={id:'hidden',used:false,hidden:true,locked:true};}
    var mine = [];
    me.stands.forEach(function (st) { st.forEach(function (w) { if (!w.cut && w.v != null) mine.push(w); }); });
    var relay=BB.numberRelay(V);
    var free=BB.freeTurn(V);if(free&&G.phase==='play'&&!V.pending&&free.step==='claim')return BB.freeTurnEligible(V,pi)?{a:'turn-claim',id:free.decisionId}:null;
    if(V.pending&&V.pending.type==='number-relay'){
      if(V.pending.to!==pi)return null;var cards=relay.hands[pi],card=V.pending.retiring?cards.find(function(c){return !c.completed;}):cards.find(function(c){return c.completed||!mine.some(function(w){return w.v===c.value;});});card=card||cards[0];var peers=V.players.map(function(p,index){return {index:index,live:p.stands.some(function(st){return st.some(function(w){return !w.cut;});}),known:p.stands.some(function(st){return st.some(function(w){return !w.cut&&(w.v===card.value||w.info&&w.info.t==='v'&&w.info.v===card.value);});})};}).filter(function(p){return p.index!==pi;}).sort(function(a,b){return Number(b.known)-Number(a.known)||Number(b.live)-Number(a.live)||a.index-b.index;});return {a:'number-relay',id:V.pending.id,value:card.value,recipient:peers[0].index};
    }
    if(relay&&G.phase==='play'&&!V.pending&&G.turn===pi&&!BB.relayMatching(V,pi)&&!(mine.length&&mine.every(function(w){return BB.kindOf(w)==='r';})&&relay.hands[pi].filter(function(c){return !c.completed;}).length<=1))return {a:'number-relay-skip'};

    var route=BB.robotRoute(V);
    var ring=BB.constraintRing(V);
    if(V.pending&&V.pending.type==='constraint-vote')return V.pending.to===pi?{a:'constraint-vote',id:V.pending.id,agree:true}:null;
    if(ring&&ring.captainPending&&G.turn===pi){
      var index=ring.ring.findIndex(function(x){return x.owner===pi;});
      function coverage(id){var fake=JSON.parse(JSON.stringify(V));fake.official.constraints.personal[pi]={id:id,retired:false};return mine.filter(function(w){return BB.kindOf(w)==='b'&&BB.actorValueAllowed(fake,pi,w.v);}).length;}
      var best={direction:0,count:coverage(ring.personal[pi].id)};[1,-1].forEach(function(d){var id=ring.ring[(index-d+ring.ring.length)%ring.ring.length].id,count=coverage(id);if(count>best.count)best={direction:d,count:count};});return {a:'constraint-rotation',id:ring.decisionId,direction:best.direction};
    }
    if(V.pending&&V.pending.type==='robot-direction'){
      if(V.pending.to!==pi)return null;
      var left=route.row.filter(function(v,i){return i<route.position&&route.completed.indexOf(v)<0;}).length,right=route.row.filter(function(v,i){return i>route.position&&route.completed.indexOf(v)<0;}).length;
      return {a:'robot-direction',id:V.pending.id,direction:right>=left?1:-1};
    }
    if(route&&G.phase==='play'&&!V.pending&&route.step==='move'&&G.turn===pi&&mine.some(function(w){return BB.kindOf(w)==='b';})){
      var values=BB.robotRouteValues(V,pi);
      if(!values.length){var coffee=V.equip.find(function(e){return e.n===11&&e.open&&!e.used;});if(coffee){var next=V.players.findIndex(function(p,o){return o!==pi&&p.stands.some(function(st){return st.some(function(w){return !w.cut;});});});if(next>=0)return {a:'equip',n:11,p:next};}return {a:'robot-reverse',id:route.decisionId};}
      var probabilities=infer(G,pi);values.sort(function(a,b){function score(v){var count=mine.filter(function(w){return w.v===v;}).length,s=count===4||count===2&&BB.cutCount(G,v)===2?100:count;V.players.forEach(function(p,o){if(o!==pi)p.stands.forEach(function(st){st.forEach(function(w){if(!w.cut)s+=(probabilities[w.id].P[v]||0)*10;});});});return s;}return score(b)-score(a)||a-b;});
      return {a:'robot-move',id:route.decisionId,val:values[0]};
    }

    if (G.phase === 'constraints') {
      if (G.turn !== pi) return null;
      var available = V.official.constraints.available;
      var chosen = available[0];
      // 只用自己的手牌挑选能覆盖最多导线的限制卡。
      var scores = available.map(function (id) {
        var fake = JSON.parse(JSON.stringify(V));
        fake.official.constraints.personal[pi] = { id: id, retired: false };
        return { id: id, count: mine.filter(function (w) { return BB.actorValueAllowed(fake, pi, BB.annOf(w)); }).length };
      }).sort(function (a, b) { return b.count - a.count; });
      if (scores.length) chosen = scores[0].id;
      return { a: 'constraint-select', id: V.official.constraints.decisionId, card: chosen };
    }
    if (V.official && V.official.constraints && V.official.constraints.captainPending && G.turn === pi)
      return { a: 'constraint-ready', id: V.official.constraints.decisionId, replace: !BB.canAct(G, pi) };
    if (V.pending && V.pending.type === 'sequence-end') {
      if (V.pending.to !== pi) return null;
      var row = V.official.numberEnds.row, left = mine.filter(function (w) { return !w.cut && w.v === row[0]; }).length, right = mine.filter(function (w) { return !w.cut && w.v === row[row.length-1]; }).length;
      return { a: 'sequence-end', id: V.pending.id, end: right > left ? 'right' : 'left' };
    }
    if (V.pending && V.pending.type === 'memory-preview') return V.pending.to===pi ? {a:'memory-ready',id:V.pending.id} : null;
    if (G.phase === 'setup') {
      if (G.setup[pi] >= BB.setupNeed(G, pi) || G.ruleset === 'physical' && BB.setupActor(G) !== pi) return null;
      if (V.pending && V.pending.to === pi && V.pending.type === 'initial-clue') return { a: 'initial-clue', id: V.pending.id, w: V.pending.choices.length ? V.pending.choices[0] : null, rack: 0 };
      if (V.official && V.official.missingSetup) {
        var values = V.official.missingSetup.values.slice(0, BB.setupNeed(G, pi));
        return { a: 'missing-clues', id: V.official.missingSetup.id, values: values, racks: values.map(function (_, i) { return me.stands.length === 2 ? i : 0; }) };
      }
      var blues = mine.filter(function (w) { return BB.setupInfoAllowed(V, w) && !w.info; });
      if(BB.allFalseInfo(V)&&V.official.fakeSetup){blues=blues.filter(function(w){return V.official.fakeSetup.usedIds.indexOf(w.id)<0;});if(!blues.length)return null;var wire=blues[0],tokens=CFalseValues(G,wire.v);return {a:'info',id:V.official.fakeSetup.id,w:wire.id,val:tokens[0]};}
      if (BB.liar(V) === pi && V.official.fakeSetup) {
        blues = blues.filter(function (w) { return V.official.fakeSetup.usedIds.indexOf(w.id) < 0; });
        if (!blues.length) return null;
        return { a: 'info', id: V.official.fakeSetup.id, w: blues[0].id, val: blues[0].v === 1 ? 2 : 1 };
      }
      if (!blues.length) return null;
      return { a: 'info', w: blues[Math.floor(Math.random() * blues.length)].id };
    }
    if(V.pending&&V.pending.type==='false-info'&&V.pending.to===pi){var wire=mine.find(function(w){return w.id===V.pending.wire;}),values=CFalseValues(G,wire.v).filter(function(v){return V.pending.choices.indexOf(v)>=0;});return {a:'false-info',id:V.pending.id,val:values[0]??V.pending.choices[0]};}
    if(V.pending&&V.pending.type==='grapple'&&V.pending.to===pi){var rack=V.pending.choices.slice().sort(function(a,b){return me.stands[a].filter(function(w){return !w.cut;}).length-me.stands[b].filter(function(w){return !w.cut;}).length||a-b;})[0];return {a:'grapple-rack',id:V.pending.id,rack:rack};}
    if (V.pending && V.pending.type === 'radar' && V.pending.waiting.indexOf(pi) >= 0) return { a: 'radar-reply', id: V.pending.id, answers: V.pending.ownAnswers };
    if (V.pending && V.pending.type === 'secret-number' && V.pending.to === pi) return V.pending.step === 'choose' ? { a: 'secret-choose', id: V.pending.id, value: V.pending.choices[0] } : { a: 'secret-reveal', id: V.pending.id };
    if(V.pending&&V.pending.type==='submarine-transfer'&&V.pending.to===pi){var state=BB.submarine54(V),costs=mine.filter(function(w){return Number.isInteger(w.v);}).map(function(w){return BB.oxygenCost(w.v);}),need=costs.length?Math.min.apply(null,costs):0,gap=Math.max(0,need-state.balances[pi]),choices=V.pending.choices.slice();choices.sort(function(a,b){return b.take-a.take||a.p-b.p;});if(gap&&choices.length&&choices[0].take>=gap)return {a:'submarine-transfer',id:V.pending.id,mode:'take',p:choices[0].p,amount:gap};var recipient=choices.find(function(c){return state.balances[c.p]===0&&state.balances[pi]>need;});return recipient?{a:'submarine-transfer',id:V.pending.id,mode:'give',p:recipient.p,amount:1}:{a:'submarine-transfer',id:V.pending.id,mode:'skip'};}
    if(V.pending&&V.pending.type==='submarine-red'&&V.pending.to===pi){var rack=0;for(var r=1;r<me.stands.length;r++)if(me.stands[r].filter(function(w){return !w.cut;}).length<me.stands[rack].filter(function(w){return !w.cut;}).length)rack=r;return {a:'submarine-red',id:V.pending.id,rack:rack};}
    if (V.pending && V.pending.type === 'nano-rack' && V.pending.to === pi) { var rack=0;for(var r=1;r<me.stands.length;r++)if(me.stands[r].filter(function(w){return !w.cut;}).length<me.stands[rack].filter(function(w){return !w.cut;}).length)rack=r;return {a:'nano-rack',id:V.pending.id,rack:rack};}
    if (V.pending && V.pending.type === 'precision-clue' && V.pending.to === pi) return {a:'precision-clue',id:V.pending.id,w:V.pending.choices[0]};
    if (V.pending && V.pending.type === 'order-answer' && V.pending.to===pi)return {a:'order-answer',id:V.pending.id};
    if (V.pending && V.pending.type === 'order-clue' && V.pending.to===pi)return {a:'order-clue',id:V.pending.id,w:V.pending.choices.find(function(id){return !mine.find(function(w){return w.id===id;}).info;})??V.pending.choices[0]};
    if (V.pending && V.pending.type === 'number-claim-clue' && V.pending.to === pi) return {a:'claim-clue',id:V.pending.id,w:V.pending.choices[0]};
    if (V.pending && V.pending.type === 'tripwire-cut' && V.pending.to === pi) return {a:'tripwire-reply',id:V.pending.id};
    if (V.pending && V.pending.type === 'precision-cut' && V.pending.to === pi) return { a: 'precision-reply', id: V.pending.id };
    if (V.pending && V.pending.type === 'yellow-three-cut' && V.pending.to === pi) return {a:'yellow-three-reply',id:V.pending.id};
    if (V.pending && V.pending.type === 'risky-cut' && V.pending.to === pi) return { a: 'risky-reply', id: V.pending.id };
    if (V.pending && V.pending.type === 'equipment-reveal' && V.pending.to === pi) return { a: 'equipment-reveal', id: V.pending.id, slot: V.pending.slots[0] ?? null };
    var command = V.official && V.official.radarCommand;
    if (command && G.phase === 'play' && !G.pending && G.turn === pi) {
      if (command.step === 'draw') return { a: 'number-draw', id: command.decisionId };
      if (command.step === 'radar') return { a: 'radar-query', id: command.decisionId };
      if (command.step === 'choose') {
        // 仅根据当前雷达的公开逐架答案指定行动者，不读取他人隐藏导线。
        var eligible = command.answers.map(function (answers, owner) { return answers.some(Boolean) ? owner : -1; }).filter(function (owner) { return owner >= 0; });
        return { a: 'command-select', id: command.decisionId, p: eligible.indexOf(pi) >= 0 ? pi : eligible[0] };
      }
    }
    if (G.pending && G.pending.type === 'clue' && G.pending.to === pi) {
      var clue = V.pending;
      if (clue.step === 'choose') {
        var tokens = clue.tokens;
        if (!tokens || !tokens.length) return null;
        var preferred = clue.kind === 'draft' ? tokens.filter(function (token) { return mine.some(function (w) { return w.v === token.value; }); })[0] : null;
        return { a: 'clue-select', id: clue.id, token: (preferred || tokens[0]).id };
      }
      return { a: 'clue-place', id: clue.id, w: clue.choices.length ? clue.choices[0] : null, rack: 0 };
    }
    if (G.pending && G.pending.type === 'walkie' && G.pending.to === pi) {
      var rescueRed=BB.tripwire(V)&&V.official.tripwire.stalled?mine.find(function(w){return BB.kindOf(w)==='r';}):null;
      if(rescueRed)return {a:'walkie',id:G.pending.id,w:rescueRed.id};
      var pressureSwap=BB.robotPressure(V),giveCurrent=pressureSwap&&G.pending.from===G.turn?mine.find(function(w){return w.v===pressureSwap.position;}):null;if(giveCurrent)return {a:'walkie',id:G.pending.id,w:giveCurrent.id};
      var nr = mine.filter(function (w) { return BB.kindOf(w) !== 'r'; });
      var pick = (nr.length ? nr : mine)[0];
      return { a: 'walkie', id: G.pending.id, w: pick.id };
    }
    if (G.pending && G.pending.type === 'cut' && G.pending.to === pi) {
      var pd = V.pending;
      if(BB.doubleOutward(V)&&pd.step==='own'&&pd.outwardIntent){var probabilities=infer(G,pi),choices=pd.choices.slice().sort(function(a,b){return ((probabilities[b]||{P:{}}).P[pd.hitVal]||0)-((probabilities[a]||{P:{}}).P[pd.hitVal]||0)||(a===pd.preferredOwn?-1:b===pd.preferredOwn?1:a-b);});return {a:'resolve',id:pd.id,w:choices[0]};}
      return { a: 'resolve', id: pd.id, w: pd.choices && pd.choices.length ? pd.choices[0] : null, clueVal: pd.clueValues && pd.clueValues[0] };
    }
    var order=BB.numberOrder(V);
    if(order&&G.phase==='play'&&!G.pending&&order.step!=='cut'){if(pi!==order.controller)return null;if(order.step==='draw')return mine.length&&mine.every(function(w){return BB.kindOf(w)==='r';})?{a:'red'}:{a:'order-draw',id:order.decisionId};if(order.step==='assign')return {a:'order-assign',id:order.decisionId,p:Bot.orderAssignment(G,pi)};}
    var claim=BB.numberClaim(V);
    if(claim&&G.phase==='play'&&!G.pending){
      if(claim.step==='draw'){if(mine.length&&mine.every(function(w){return BB.kindOf(w)==='r';}))return {a:'claim-number',id:claim.decisionId};return pi===V.captain?{a:'claim-draw',id:claim.decisionId}:null;}
      if(claim.step==='claim')return mine.length&&(mine.some(function(w){return w.v===claim.value;})||mine.every(function(w){return BB.kindOf(w)==='r';}))?{a:'claim-number',id:claim.decisionId}:null;
    }
    if(BB.tripwire(V)&&V.official.tripwire.stalled){
      if(G.pending)return null;
      var ownYellow=mine.filter(function(w){return BB.kindOf(w)==='y';}),sharedWalkie=G.equip.some(function(e){return e.n===2&&!e.used&&BB.equipUnlocked(G,2);}),personalWalkie=BB.characterState(me).id==='walkie-talkies'&&!BB.characterState(me).used;
      var ownRed=mine.find(function(w){return BB.kindOf(w)==='r';}),onlyYellowPartner=V.players.findIndex(function(p,owner){return owner!==pi&&p.stands.flat().filter(function(w){return !w.cut;}).length===1;});
      if(ownRed&&onlyYellowPartner>=0&&(sharedWalkie||personalWalkie))return {a:personalWalkie?'character':'equip',n:2,w:ownRed.id,p:onlyYellowPartner};
      if(ownYellow.length===1&&(sharedWalkie||personalWalkie)){
        var rescueProbs=infer(G,pi),partners=[];V.players.forEach(function(p,owner){if(owner!==pi){var score=p.stands.flat().filter(function(w){return !w.cut;}).reduce(function(n,w){return n+(rescueProbs[w.id]?.red||0);},0);if(score>0)partners.push({owner:owner,score:score});}});partners.sort(function(a,b){return b.score-a.score;});
        if(partners.length)return {a:personalWalkie?'character':'equip',n:2,w:ownYellow[0].id,p:partners[0].owner};
      }
      var usedWalker=V.players.findIndex(function(p,owner){return BB.characterState(p).id==='walkie-talkies'&&BB.characterState(p).used&&(owner===pi?ownYellow.length===1||!!ownRed&&onlyYellowPartner>=0:p.stands.flat().filter(function(w){return !w.cut;}).length===1);});
      if(usedWalker>=0&&G.equip.some(function(e){return e.n===7&&!e.used&&BB.equipUnlocked(G,7);}))return {a:'equip',n:7,players:[usedWalker]};
      return null;
    }
    if (BB.turnActor(G) !== pi || G.phase !== 'play' || G.pending) return null;
    if(BB.allOutward(V)&&G.det>=G.detMax-1&&G.det>BB.dialMin(G)&&V.equip.some(function(e){return e.n===6&&e.open&&!e.used;}))return {a:'equip',n:6};
    if (BB.outwardSkipAllowed(V, pi)) return { a: 'outward-skip' };
    var facings=me.stands.flat().filter(function(w){return !w.cut&&BB.isOutward(V,w);});
    if(facings.length){
      var blindProbs=infer(G,pi),blindBest=null;
      function offer(action,score){if(!blindBest||score>blindBest.score)blindBest={action:action,score:score};}
      if(BB.outwardRedPossible(V,pi))offer({a:'outward-red'},facings.reduce(function(p,w){return p*(blindProbs[w.id]||{red:0}).red;},1));
      var groups=facings.map(function(w){return [w.id];});if(BB.doubleOutward(V)&&facings.length===2)groups.push(facings.map(function(w){return w.id;}));
      groups.forEach(function(ids){BB.outwardSoloValues(V,pi,BB.doubleOutward(V)?ids:undefined).forEach(function(value){var action={a:'outward-solo',val:value};if(BB.doubleOutward(V))action.outs=ids;offer(action,ids.reduce(function(p,id){return p*((blindProbs[id]||{P:{}}).P[value]||0);},1));});});
      facings.forEach(function(facing){var self=blindProbs[facing.id]||{P:{}};V.players.forEach(function(p,owner){if(owner!==pi)p.stands.forEach(function(st,rack){st.forEach(function(w){if(w.cut||!BB.targetAllowed(V,pi,Object.assign({o:owner,s:rack},w)))return;var target=blindProbs[w.id]||{P:{}};for(var value=1;value<=12;value++){var action={a:'outward-dual',w:w.id,val:value};if(BB.doubleOutward(V))action.own=facing.id;offer(action,(self.P[value]||0)*(target.P[value]||0));}});});});});
      if(blindBest&&(blindBest.score>=0.999||!mine.some(function(w){return !BB.isOutward(V,w)&&BB.kindOf(w)==='b';})))return blindBest.action;
    }

    if (BB.equipmentAllowed(G, pi) && G.equip.some(function (e) { return e.n === 13 && !e.used && BB.equipUnlocked(G, 13); }))
      return { a: 'equip', n: 13 };

    // 危险时用倒带器
    var rew = G.equip.filter(function (e) { return e.n === 6 && !e.used && BB.equipUnlocked(G, 6); })[0];
    if (BB.equipmentAllowed(G, pi) && rew && G.det >= G.detMax - 1 && G.det > BB.dialMin(G) && (G.det > 0 || G.detMax===1&&BB.dialMin(G)<0)) return { a: 'equip', n: 6 };

    if(BB.tripwire(V) && G.ymark.n-BB.cutCount(G,'Y')-mine.filter(function(w){return BB.kindOf(w)==='y';}).length>0){
      var tripwireProbs=infer(G,pi),targets=[];V.players.forEach(function(p,owner){if(owner!==pi)p.stands.forEach(function(st){st.forEach(function(w){if(!w.cut)targets.push({id:w.id,p:tripwireProbs[w.id].P.Y||0});});});});targets.sort(function(a,b){return b.p-a.p||a.id-b.id;});
      if(targets.length&&(targets[0].p>=0.99||mine.filter(function(w){return BB.kindOf(w)==='b';}).length<=2))return {a:'tripwire-cut',w:targets[0].id};
    }
    if (mine.length && mine.every(function (w) { return BB.kindOf(w) === 'r'; })) {
      if (V.official && V.official.riskyRedCut) {
        var reds = mine.map(function (w) { return w.id; });
        if (reds.length < 3) {
          var redProbabilities = infer(G, pi), candidates = [];
          V.players.forEach(function (p, owner) { if (owner !== pi) p.stands.forEach(function (st) { st.forEach(function (w) { if (!w.cut) candidates.push({ id: w.id, red: redProbabilities[w.id].red }); }); }); });
          candidates.sort(function (a, b) { return b.red - a.red || a.id - b.id; });
          reds = reds.concat(candidates.slice(0, 3 - reds.length).map(function (entry) { return entry.id; }));
        }
        return { a: 'risky-cut', ws: reds };
      }
      return { a: 'red' };
    }


    if(BB.equipmentAllowed(G,pi)&&V.equip.some(function(e){return e.n===18&&e.open&&!e.used;})){
      var grappleTarget=null;
      mine.filter(function(w){return Number.isInteger(w.v)&&BB.equipmentWireAllowed(V,pi,w);}).some(function(w){
        if(BB.cutCount(G,w.v)!==2||mine.filter(function(t){return t.v===w.v;}).length!==1)return false;
        V.players.some(function(p,owner){if(owner===pi)return false;return p.stands.some(function(st){return st.some(function(t){if(!t.cut&&BB.equipmentWireAllowed(V,pi,t)&&BB.seqAllowed(G,w.v,pi)&&BB.soloAllowed(G,pi,[w,t])&&!(G.mission.rules&&G.mission.rules.noSolo)&&(t.v===w.v||t.info&&t.info.t==='v'&&t.info.v===w.v)){grappleTarget=t.id;return true;}return false;});});});return grappleTarget!==null;
      });
      if(grappleTarget!==null)return {a:'equip',n:18,w:grappleTarget};
    }
    if(BB.equipmentAllowed(G,pi)&&BB.ownTurnAllowed(G,pi)&&!(G.mission.rules&&G.mission.rules.noSolo)&&V.equip.some(function(e){return e.n===16&&e.open&&!e.used;})){
      var passPair=null;
      mine.filter(function(w){return BB.kindOf(w)!=='r'&&BB.equipmentWireAllowed(V,pi,w);}).some(function(w){var value=BB.annOf(w),pair=mine.filter(function(t){return BB.annOf(t)===value&&BB.equipmentWireAllowed(V,pi,t);}).slice(0,2);if(pair.length===2&&(!BB.passingOxygen(V)||Number.isInteger(value)&&value<=BB.passingOxygen(V).available)&&!BB.soloOk(G,pi,value)&&BB.seqAllowed(G,value)&&BB.soloAllowed(G,pi,pair)){passPair={a:'equip',n:16,ws:pair.map(function(t){return t.id;}),val:value};return true;}return false;});
      if(passPair)return passPair;
    }
    if(BB.equipmentAllowed(G,pi)&&V.equip.some(function(e){return e.n===14&&e.open&&!e.used;})){
      var single=null;me.stands.some(function(st){return st.some(function(w){if(Number.isInteger(w.v)&&BB.kindOf(w)==='b'&&!w.unique&&!(w.info&&w.info.t==='freq'&&w.info.v===1)&&BB.equipmentWireAllowed(V,pi,w)&&st.filter(function(t){return t.v===w.v;}).length===1&&st.some(function(t){return !t.cut;})){single=w.id;return true;}return false;});});
      if(single!==null)return {a:'equip',n:14,w:single};
    }
    var vals = [];
    mine.forEach(function (w) { if(BB.isOutward(V,w))return;var a = BB.annOf(w); if (a !== 'R' && vals.indexOf(a) < 0) vals.push(a); });
    var oxygen=BB.oxygen(V);
    if(oxygen){
      vals=vals.filter(function(value){return BB.oxygenCost(value)<=oxygen.available;});
      if(!vals.length&&mine.some(function(w){return Number.isInteger(w.v);}))return {a:'oxygen-skip',stab:!V.stab&&V.equip.some(function(e){return e.n===9&&e.open&&!e.used;})&&BB.stabilizerAllowed(G,pi)};
    }
    var submarine=BB.submarine54(V);if(submarine){vals=vals.filter(function(value){return Number.isInteger(value)&&BB.oxygenCost(value)<=submarine.balances[pi];});if(!vals.length&&mine.some(function(w){return Number.isInteger(w.v);}))return {a:'submarine-skip'};}
    var passing=BB.passingOxygen(V);if(passing){vals=vals.filter(function(value){return Number.isInteger(value)&&passing.holder===pi&&value<=passing.available;});if(!vals.length&&mine.some(function(w){return Number.isInteger(w.v);})){var coffee=V.equip.find(function(e){return e.n===11&&e.open&&!e.used;}),next=V.players.findIndex(function(p,o){return o!==pi&&p.stands.some(function(st){return st.some(function(w){return !w.cut;});});});if(coffee&&next>=0)return {a:'equip',n:11,p:next};return {a:'passing-oxygen-skip'};}}
    var personalOxygen=BB.personalOxygen(V);
    if(personalOxygen){
      vals=vals.filter(function(value){return Number.isInteger(value)&&value<=personalOxygen.balances[pi];});
      if(!vals.length&&mine.some(function(w){return Number.isInteger(w.v);}))return {a:'personal-oxygen-skip',stab:!V.stab&&V.equip.some(function(e){return e.n===9&&e.open&&!e.used;})&&BB.stabilizerAllowed(G,pi)};
    }
    var pressure=BB.robotPressure(V);
    if(pressure&&vals.indexOf(pressure.position)>=0){if(BB.soloOk(G,pi,pressure.position))return {a:'solo',val:pressure.position};var known=null;V.players.forEach(function(p,owner){if(owner!==pi)p.stands.forEach(function(st,rack){st.forEach(function(w){if(!known&&!w.cut&&w.info&&w.info.t==='v'&&w.info.v===pressure.position&&BB.targetAllowed(V,pi,Object.assign({},w,{o:owner,s:rack})))known=w.id;});});});if(known!==null)return {a:'dual',w:known,val:pressure.position};}
    // 备用线未取完时，优先拆机器人所在数字；只依据本人牌与公开标记。
    var nano = BB.nano(V);
    if (nano && nano.remaining > 0 && vals.indexOf(nano.position) >= 0) {
      if (BB.soloOk(G, pi, nano.position)) return { a: 'solo', val: nano.position };
      var nanoTarget = null;
      V.players.forEach(function (p, owner) { if (owner !== pi) p.stands.forEach(function (st, rack) { st.forEach(function (w) {
        if (!nanoTarget && !w.cut && w.info && w.info.t === 'v' && w.info.v === nano.position && BB.targetAllowed(V, pi, Object.assign({}, w, { o: owner, s: rack }))) nanoTarget = w.id;
      }); }); });
      if (nanoTarget !== null) return { a: 'dual', w: nanoTarget, val: nano.position };
    }
    if (nano && nano.remaining > 0 && vals.indexOf(nano.position) < 0 && V.equip.some(function (e) { return e.n === 11 && e.open && !e.used; })) {
      var nextRobotValue = nano.position + nano.direction, knownOwners = [];
      V.players.forEach(function (p, owner) { if (p.stands.some(function (st) { return st.some(function (w) { return !w.cut && w.info && w.info.t === 'v' && w.info.v === nextRobotValue; }); })) knownOwners.push(owner); });
      var coffeeReceiver = knownOwners.find(function (owner) { return owner !== pi && knownOwners.some(function (other) { return other !== owner; }); });
      if (coffeeReceiver !== undefined && BB.equipmentAllowed(G, pi) && BB.ownTurnAllowed(G, pi)) return { a: 'equip', n: 11, p: coffeeReceiver };
    }
    for (var i = 0; i < vals.length; i++) {
      if (!pressure && BB.soloOk(G, pi, vals[i])) return { a: 'solo', val: vals[i] };
    }
    vals = vals.filter(function (v) { return BB.seqAllowed(G, v); });

    var probs = infer(G, pi), rookie = BB.rookie(V) === pi || BB.unequippedCaptain(V) === pi;
    // 三黄只能整体处理：自己的黄线确定，队友目标只依据公开标记和推理。
    if (V.official && V.official.yellowThree && !V.official.yellowThree.complete && !V.stab && (V.np >= 4 || mine.some(function(w){return BB.kindOf(w)==='y';}))) {
      var yellowCandidates=[];
      V.players.forEach(function(p,owner){p.stands.forEach(function(st){st.forEach(function(w){if(!w.cut){var known=owner===pi?BB.kindOf(w)==='y':w.info&&w.info.t==='Y'?true:w.info&&w.info.t==='v'?BB.kindOf({v:w.info.v})==='y':null;yellowCandidates.push({id:w.id,p:known===null?(probs[w.id].P.Y||0):Number(known),red:owner===pi?Number(BB.kindOf(w)==='r'):probs[w.id].red});}});});});
      yellowCandidates.sort(function(a,b){return (b.p-8*b.red)-(a.p-8*a.red)||a.id-b.id;});
      if(yellowCandidates.length>=3 && (yellowCandidates.slice(0,3).every(function(w){return w.p>=0.999;}) || !vals.length)) return {a:'yellow-three-cut',ws:yellowCandidates.slice(0,3).map(function(w){return w.id;})};
    }
    if (V.official && V.official.precision && !V.official.precision.complete && (!V.official.precision.license || V.official.licenseRequired)) {
      var precisionValue = V.official.precision.value, preciseCandidates = [];
      V.players.forEach(function(p,owner){p.stands.forEach(function(st){st.forEach(function(w){if(!w.cut)preciseCandidates.push({id:w.id,p:owner===pi?Number(w.v===precisionValue):w.info&&w.info.t==='v'?Number(w.info.v===precisionValue):(probs[w.id].P[precisionValue]||0)});});});});
      preciseCandidates.sort(function(a,b){return b.p-a.p||a.id-b.id;});
      if(preciseCandidates.length>=4 && (preciseCandidates[3].p>=0.999 || !vals.length))return {a:'precision-cut',ws:preciseCandidates.slice(0,4).map(function(x){return x.id;})};
    }
    var best = null, cands = [];
    V.players.forEach(function (p, tp) {
      if (tp === pi) return;
      p.stands.forEach(function (st, si) {
        st.forEach(function (w, i) {
          if (w.cut || !BB.targetAllowed(V, pi, Object.assign({}, w, { o: tp, s: si }))) return;
          var d = probs[w.id];
          vals.forEach(function (val) {
            if (w.info && w.info.t === 'not' && String(w.info.v).split('/').indexOf(String(val)) >= 0) return;
            var pv = d.P[val] || 0;
            if (nano && V.radar && V.radar.val === val && Array.isArray(V.radar.res[tp]) && V.radar.res[tp][si] === false) pv = 0;
            var score = rookie ? pv : pv - 8 * d.red;if(BB.allOutward(V)&&BB.isOutward(V,w))score-=V.det>=V.detMax-1?1000:.75;
            if(pressure)score=pv*(val===pressure.position?3:1)-8*d.red-(pressure.position+1>=pressure.limit&&val!==pressure.position?1000:0);
            var c = { w: w.id, tp: tp, si: si, val: val, p: pv, red: d.red, score: score };
            cands.push(c);
            if (!best || score > best.score) best = c;
          });
        });
      });
    });
    if(pressure){
      if(pressure.position>=pressure.limit-2&&V.equip.some(function(e){return e.n===11&&e.open&&!e.used;})){
        var candidates=[];V.players.forEach(function(p,owner){if(owner===pi)return;var live=p.stands.flat().filter(function(w){return !w.cut;}),missing=1;live.forEach(function(w){missing*=1-(probs[w.id].P[pressure.position]||0);});var radar=V.radar&&V.radar.val===pressure.position&&Array.isArray(V.radar.res[owner])&&V.radar.res[owner].some(Boolean);if(live.length)candidates.push({owner:owner,p:radar?1:1-missing});});candidates.sort(function(a,b){return b.p-a.p||a.owner-b.owner;});
        if(candidates.length&&vals.indexOf(pressure.position)<0&&candidates[0].p>.5)return {a:'equip',n:11,p:candidates[0].owner};
      }
      if(pressure.position>=6&&vals.indexOf(pressure.position)<0){var personal=BB.characterState(me),shared=V.equip.some(function(e){return e.n===2&&e.open&&!e.used;}),walker=personal.id==='walkie-talkies'&&!personal.used;if(shared||walker){var partners=[];V.players.forEach(function(p,owner){if(owner===pi)return;var live=p.stands.flat().filter(function(w){return !w.cut;}),miss=1;live.forEach(function(w){miss*=1-(probs[w.id].P[pressure.position]||0);});if(live.length)partners.push({owner:owner,p:1-miss});});partners.sort(function(a,b){return b.p-a.p||a.owner-b.owner;});if(partners.length&&partners[0].p>.7&&mine.length){var offered=mine.find(function(w){return BB.kindOf(w)==='r';})||mine.slice().sort(function(a,b){return b.v-a.v;})[0];return {a:walker?'character':'equip',n:2,w:offered.id,p:partners[0].owner};}}}
      vals.forEach(function(value){if(BB.soloOk(G,pi,value)){var score=value===pressure.position?3:pressure.position+1>=pressure.limit?-999:1;if(!best||score>best.score)best={action:{a:'solo',val:value},val:value,p:1,red:0,score:score};}});
      if(best&&best.action)return best.action;
    }
    if (!best) return null;
    if(pressure&&BB.equipmentAllowed(G,pi)&&BB.ownTurnAllowed(G,pi)){
      var selected={action:{a:'dual',w:best.w,val:best.val},score:best.score},role=BB.characterState(me);
      V.players.forEach(function(p,owner){if(owner===pi)return;p.stands.forEach(function(st,rack){var live=st.filter(function(w){return !w.cut;});vals.filter(Number.isInteger).forEach(function(value){var ordered=live.slice().sort(function(a,b){return ((probs[b.id].P[value]||0)-4*probs[b.id].red)-((probs[a.id].P[value]||0)-4*probs[a.id].red);});
        [{kind:'dd',count:2,ready:!!me.dd},{kind:'triple',count:Math.min(3,live.length),ready:V.equip.some(function(e){return e.n===3&&e.open&&!e.used;})},{kind:'personal',count:Math.min(3,live.length),ready:role.id==='triple-detector'&&!role.used},{kind:'super',count:live.length,ready:V.equip.some(function(e){return e.n===5&&e.open&&!e.used;})}].forEach(function(option){if(!option.ready||option.kind!=='super'&&live.length<2||!live.length)return;var chosen=ordered.slice(0,option.count),miss=1,red=1;chosen.forEach(function(w){miss*=1-(probs[w.id].P[value]||0);red*=probs[w.id].red;});var score=(1-miss)*(value===pressure.position?3:1)-8*red-(pressure.position+1>=pressure.limit&&value!==pressure.position?1000:0);if(score<=selected.score+.01)return;var action=option.kind==='dd'?{a:'dd',ws:chosen.map(function(w){return w.id;}),val:value}:option.kind==='personal'?{a:'character',ws:chosen.map(function(w){return w.id;}),val:value}:option.kind==='super'?{a:'equip',n:5,p:owner,s:rack,val:value}:{a:'equip',n:3,ws:chosen.map(function(w){return w.id;}),val:value};selected={action:action,score:score};});
      });});});return selected.action;
    }
    if(BB.allFalseInfo(V)&&BB.equipmentAllowed(G,pi)&&best.p<.95&&V.equip.some(function(e){return e.n===4&&e.open&&!e.used;})){var note=mine.find(function(w){return Number.isInteger(w.v)&&!w.info;});if(note)return {a:'equip',n:4,w:note.id};}
    if (nano && BB.equipmentAllowed(G, pi) && BB.ownTurnAllowed(G, pi)) {
      function ready(n) { return V.equip.some(function (e) { return e.n === n && e.open && !e.used; }); }
      if (best.p < 0.95 && ready(4)) {
        var note = mine.find(function (w) { return Number.isInteger(w.v) && !w.info; });
        if (note) return { a: 'equip', n: 4, w: note.id };
      }
      if (best.p < 0.95 && ready(7)) {
        var depleted = V.players.map(function (p, owner) { return { owner: owner, p: p, card: BB.characterState(p) }; }).filter(function (x) { return x.card.used && !x.card.removed && x.p.stands.some(function (st) { return st.some(function (w) { return !w.cut; }); }); });
        depleted.sort(function (a, b) { return Number(b.owner === pi) - Number(a.owner === pi); });
        if (depleted.length >= 2 || depleted.some(function (x) { return x.owner === pi; })) return { a: 'equip', n: 7, players: depleted.slice(0, 2).map(function (x) { return x.owner; }) };
      }
      var protectedCut = { action: { a: 'dual', w: best.w, val: best.val }, p: best.p, red: best.red, score: best.score };
      if (best.p < 0.99) V.players.forEach(function (p, owner) { if (owner !== pi) p.stands.forEach(function (st, rack) {
        var left = st.filter(function (w) { return !w.cut; });
        vals.filter(Number.isInteger).forEach(function (value) {
          if (V.radar && V.radar.val === value && V.radar.res[owner][rack] === false) return;
          var sorted = left.slice().sort(function (a, b) { return (probs[b.id].P[value] || 0) - 4 * probs[b.id].red - ((probs[a.id].P[value] || 0) - 4 * probs[a.id].red); });
          [3, 5].forEach(function (n) {
            if (!ready(n) || n === 3 && left.length < 2) return;
            var selected = n === 3 ? sorted.slice(0, Math.min(3, left.length)) : left, miss = 1, red = 1;
            selected.forEach(function (w) { miss *= 1 - (probs[w.id].P[value] || 0); red *= probs[w.id].red; });
            var hit = 1 - miss, score = hit - 8 * red;
            if (score > protectedCut.score + 0.08) protectedCut = { action: n === 3 ? { a: 'equip', n: n, ws: selected.map(function (w) { return w.id; }), val: value } : { a: 'equip', n: n, p: owner, s: rack, val: value }, p: hit, red: red, score: score };
          });
        });
      }); });
      if (ready(9) && BB.stabilizerAllowed(G, pi) && (protectedCut.p < 0.85 || protectedCut.red > 0.01)) protectedCut.action.stab = true;
      if (protectedCut.action.a === 'equip' || protectedCut.action.stab) return protectedCut.action;
    }
    var character = BB.characterState(me);
    if (BB.equipmentAllowed(G, pi) && !character.used && character.id === 'general-radar') {
      var blue = vals.filter(function (v) { return Number.isInteger(v); });
      if (blue.length) return { a: 'character', val: blue[0] };
    }
    if (BB.equipmentAllowed(G, pi) && !character.used && character.id === 'triple-detector' && best.p < 0.85) {
      var triples = [];
      V.players.forEach(function (p, tp) {
        if (tp === pi) return;
        p.stands.forEach(function (st) {
          var left = st.filter(function (w) { return !w.cut && !BB.isX(V, w); }), needed = Math.min(3, left.length);
          var wires = left.filter(function (w) { return BB.equipmentWireAllowed(V, pi, w) && BB.targetAllowed(V, pi, Object.assign({}, w, { o: tp, s: G.wires[w.id].s })); });
          if (left.length < 2 || wires.length < needed) return;
          vals.filter(function (v) { return Number.isInteger(v); }).forEach(function (value) {
            var chosen = wires.slice().sort(function (a, b) { return (probs[b.id].P[value] || 0) - 4 * probs[b.id].red - ((probs[a.id].P[value] || 0) - 4 * probs[a.id].red); }).slice(0, needed);
            var miss = 1, red = 1;
            chosen.forEach(function (w) { miss *= 1 - (probs[w.id].P[value] || 0); red *= probs[w.id].red; });
            triples.push({ ws: chosen.map(function (w) { return w.id; }), val: value, score: 1 - miss - 8 * red });
          });
        });
      });
      triples.sort(function (a, b) { return b.score - a.score; });
      if (triples.length && triples[0].score > best.score) return { a: 'character', ws: triples[0].ws, val: triples[0].val };
    }
    if (BB.equipmentAllowed(G, pi) && !character.used && character.id === 'xy-ray' && vals.length > 1 && best.p < 0.85) {
      var extra = vals.filter(function (v) { return v !== best.val; })[0];
      return { a: 'dual', w: best.w, val: best.val, vals: [best.val, extra], xy: true, xyPersonal: true };
    }
    if (BB.equipmentAllowed(G, pi) && !character.used && character.id === 'walkie-talkies' && best.red > 0.1 && mine.length) {
      var receiver = V.players.findIndex(function (p, i) { return i !== pi && p.stands.some(function (st) { return st.some(function (w) { return !w.cut && BB.equipmentWireAllowed(V, i, w); }); }); });
      var required=order?order.value:claim?claim.value:null;var offered=required!==null?mine.find(function(w){return w.v!==required||mine.filter(function(x){return x.v===required;}).length>1;}):mine[0];
      if (receiver >= 0&&offered) return { a: 'character', w: offered.id, p: receiver };
    }


    // 双重探测器：同一排两根线，提高命中率
    if (BB.equipmentAllowed(G, pi) && me.dd && best.p < (rookie ? 1 : 0.7)) {
      var bestDD = null;
      cands.forEach(function (a) {
        cands.forEach(function (b) {
          if (a.w >= b.w || a.tp !== b.tp || a.si !== b.si || a.val !== b.val || (BB.usesCutChoices(G) && a.val === 'Y') || !BB.equipmentWireAllowed(G, pi, G.wires[a.w]) || !BB.equipmentWireAllowed(G, pi, G.wires[b.w]) || !mine.some(function (w) { return BB.matches(w, a.val) && BB.equipmentWireAllowed(V, pi, w); })) return;
          var hit = 1 - (1 - a.p) * (1 - b.p);
          var boom = a.red * b.red;
          var s = rookie ? hit : hit - 3 * boom - 0.3 * Math.max(a.red, b.red);
          if (!bestDD || s > bestDD.s) bestDD = { s: s, ws: [a.w, b.w], val: a.val, hit: hit };
        });
      });
      if (bestDD && bestDD.hit > best.p + (rookie ? 0 : 0.2) && bestDD.s > best.score) return { a: 'dd', ws: bestDD.ws, val: bestDD.val };
    }
    return { a: 'dual', w: best.w, val: best.val };
  };

  // 无人认领时，队长仅按公开线索与剩余数量指定，不读取队友真实牌值。
  Bot.orderAssignment=function(G,pi){var V=BB.view(G,pi),state=BB.numberOrder(V);if(!state||state.step!=='assign'||state.controller!==pi)return null;
    if(V.players[pi].stands.flat().some(function(w){return !w.cut&&w.v===state.value;}))return pi;
    var probabilities=infer(G,pi),candidates=V.players.map(function(p,owner){var live=p.stands.flat().filter(function(w){return !w.cut;}),miss=1,allRed=1;live.forEach(function(w){var prob=probabilities[w.id]||{P:{},red:0};miss*=1-(prob.P[state.value]||0);allRed*=prob.red;});return {owner:owner,live:live.length,known:live.some(function(w){return w.info&&w.info.t==='v'&&w.info.v===state.value;}),score:1-miss-8*allRed};}).filter(function(x){return x.owner!==pi&&x.live>0;});
    candidates.sort(function(a,b){return Number(b.known)-Number(a.known)||b.score-a.score||a.owner-b.owner;});return candidates.length?candidates[0].owner:null;
  };
  Bot.claimAssignment=function(G,pi){
    var V=BB.view(G,pi),state=BB.numberClaim(V);if(!state||G.paused||G.pending||V.phase!=='play'||pi!==V.captain||state.step!=='claim')return null;
    var candidates=V.players.map(function(p,owner){var live=p.stands.flat().filter(function(w){return !w.cut;});return {owner:owner,count:live.length,known:live.some(function(w){return w.info&&w.info.t==='v'&&w.info.v===state.value;})};}).filter(function(x){return x.count>0;});
    candidates.sort(function(a,b){return Number(b.known)-Number(a.known)||a.count-b.count||a.owner-b.owner;});return candidates.length?{a:'claim-assign',id:state.decisionId,p:candidates[0].owner}:null;
  };
  var decideWithoutArithmetic=Bot.decide;
  function arithmeticPairScore(V,cards){
    var state=BB.arithmetic(V),remaining=state.open.filter(function(v){return cards.indexOf(v)<0;}),possible={},cut={};
    if(!remaining.length)return 1000;
    V.players.forEach(function(p){p.stands.forEach(function(st){st.forEach(function(w){if(w.cut&&Number.isInteger(w.v))cut[w.v]=(cut[w.v]||0)+1;});});});
    for(var i=0;i<remaining.length;i++)for(var j=i+1;j<remaining.length;j++){var sum=remaining[i]+remaining[j],difference=Math.abs(remaining[i]-remaining[j]);if(sum<=12)possible[sum]=true;if(difference>0)possible[difference]=true;}
    return Object.keys(possible).reduce(function(score,value){return score+Math.max(0,4-(cut[value]||0));},0);
  }
  Bot.decide=function(G,pi){
    var action=decideWithoutArithmetic(G,pi),V=BB.view(G,pi),state=BB.arithmetic(V);if(!state)return action;
    var cut=action&&(['dual','dd','solo'].indexOf(action.a)>=0||action.a==='equip'&&[3,5].indexOf(action.n)>=0||action.a==='character'&&BB.characterState(V.players[pi]).id==='triple-detector');
    if(cut){var pairs=BB.arithmeticPairs(V,action.val);pairs.sort(function(a,b){return arithmeticPairScore(V,b.cards)-arithmeticPairScore(V,a.cards);});var pair=pairs[0];if(pair)return Object.assign({},action,{cards:pair.cards.slice(),operation:pair.operation});}
    if(!action&&!G.paused&&V.phase==='play'&&!V.pending&&V.turn===pi&&state.open.length>=2){var options=[];for(var i=0;i<state.open.length;i++)for(var j=i+1;j<state.open.length;j++)options.push([state.open[i],state.open[j]]);options.sort(function(a,b){return arithmeticPairScore(V,b)-arithmeticPairScore(V,a);});return {a:'arithmetic-skip',cards:options[0]};}
    return action;
  };
  // 氧气收款只依据公开余额、请求、剩余数量与可见线索；不读取队友隐藏值。
  Bot.oxygenRecipient=function(V,pi){
    var state=BB.personalOxygen(V);if(!state)return null;
    var candidates=V.players.map(function(p,owner){var live=p.stands.flat().filter(function(w){return !w.cut;}),known=live.filter(function(w){return w.info&&w.info.t==='v'&&Number.isInteger(w.info.v);});return {owner:owner,live:live.length,requested:state.requests[owner],balance:state.balances[owner],need:known.length?Math.min.apply(null,known.map(function(w){return w.info.v;})):0,distance:(owner-pi+V.np)%V.np};}).filter(function(x){return x.owner!==pi;});
    candidates.sort(function(a,b){return Number(b.live>0)-Number(a.live>0)||Number(b.requested)-Number(a.requested)||Math.max(0,b.need-b.balance)-Math.max(0,a.need-a.balance)||a.balance-b.balance||a.distance-b.distance;});return candidates.length?candidates[0].owner:null;
  };
  var decideWithoutPersonalOxygen=Bot.decide;
  Bot.decide=function(G,pi){var action=decideWithoutPersonalOxygen(G,pi),V=BB.view(G,pi);if(!BB.personalOxygen(V)||!action)return action;var cut=['dual','dd','solo'].indexOf(action.a)>=0||action.a==='equip'&&[3,5].indexOf(action.n)>=0||action.a==='character'&&BB.characterState(V.players[pi]).id==='triple-detector';return cut?Object.assign({},action,{oxygenTo:Bot.oxygenRecipient(V,pi)}):action;};
  var decideWithoutMemorySea=Bot.decide;
  Bot.memoryInput=function(G,pi){var state=BB.memorySea(G);if(!state)return G;var input=JSON.parse(JSON.stringify(G)),memory=state.botMemories&&state.botMemories[pi];input.rmark.cand=memory?memory.red.slice():[];input.ymark.cand=memory?memory.yellow.slice():[];
    if(memory)Object.keys(memory.clues).forEach(function(id){var w=input.wires[id],clue=memory.clues[id];if(w&&!w.cut&&!w.info&&w.o===clue.owner&&w.s===clue.rack)w.info=JSON.parse(JSON.stringify(clue.info));});return input;
  };
  Bot.decide=function(G,pi){return decideWithoutMemorySea(Bot.memoryInput(G,pi),pi);};
  if (typeof module !== 'undefined' && module.exports) module.exports = Bot;
  else window.BBBot = Bot;
})();
