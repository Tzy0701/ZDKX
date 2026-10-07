/* 炸弹克星 · 3D 牌桌（CSS 3D）
 * 一张倾斜的切割垫：远处是队友的线架，中间是引爆器、进度托盘和装备卡，近处是你的线架。
 * 结构不变时只更新状态（类名、标记、指针角度），让翻倒、翻牌等过渡动画可以播放。
 */
(function () {
  var BB = window.BB;
  var T = {};

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function fmtV(v) { return BB.kindOf(v) === 'b' ? String(v) : v.toFixed(1); }
  function infoMarkup(f){if(f&&f.t==='not'&&String(f.v).indexOf('/')>=0)return String(f.v).split('/').map(function(v){return '<span class="negative-value">'+esc('≠'+(v==='Y'?'黄':v))+'</span>';}).join('<span hidden>、</span>');return esc(infoTxt(f));}
  function infoTxt(f) {
    if (!f) return '';
    if (f.t === 'v') return f.copies > 1 ? Array(f.copies).fill(f.v).join('＋') : f.v; if (f.t === 'Y') return '黄';
    if (f.t === 'odd') return '奇'; if (f.t === 'even') return '偶';
    if (f.t === 'freq') return f.copies === 2 ? '×2＋×2' : '×' + f.v;
    if (f.t === 'not') return String(f.v).split('/').map(function(v){return '≠'+(v==='Y'?'黄':v);}).join('、'); return '';
  }

  // 按座位顺序（从你的下家开始）排列队友
  function seatOrder(V, me) {
    var out = [], base = me < 0 ? 0 : me;
    for (var k = 1; k <= V.players.length; k++) { var i = (base + k) % V.players.length; if (i !== me) out.push(i); }
    if (me < 0) out = V.players.map(function (_, i) { return i; });
    return out;
  }
  // 远排在上，近排在下
  function layoutRows(opps, narrow) {
    if (narrow) return opps.map(function (o) { return [{ o: o, span: 2, tilt: 0 }]; });
    var k = opps.length;
    if (k === 1) return [[{ o: opps[0], span: 2, tilt: 0 }]];
    if (k === 2) return [[{ o: opps[0], span: 1, tilt: 2.5 }, { o: opps[1], span: 1, tilt: -2.5 }]];
    if (k === 3) return [[{ o: opps[1], span: 2, tilt: 0 }], [{ o: opps[0], span: 1, tilt: 5 }, { o: opps[2], span: 1, tilt: -5 }]];
    return [[{ o: opps[1], span: 1, tilt: 2 }, { o: opps[2], span: 1, tilt: -2 }], [{ o: opps[0], span: 1, tilt: 6 }, { o: opps[3], span: 1, tilt: -6 }]];
  }

  function sigOf(V, me, narrow, spectator) {
    return [V.gid, me, spectator ? 'watch' : 'play', narrow ? 'n' : 'w', V.equip.map(function (e) { return e.n; }).join(','),
      V.players.map(function (p) { return p.stands.map(function (st) { return st.map(function (w) { return w.id; }).join(','); }).join('/'); }).join(';')].join('|');
  }

  function tileHTML(w, o, s) {
    return '<button type="button" class="slot" data-w="' + w.id + '" data-o="' + o + '" data-s="' + s + '" tabindex="-1">' +
      '<span class="target-arrow" aria-hidden="true"><svg viewBox="0 0 28 36" focusable="false"><path d="M9 2H19V18H26L14 33L2 18H9Z"/></svg></span>' +
      '<span class="t3" aria-hidden="true"><i class="ff"><b class="fv"></b><span class="stripe"></span></i><i class="fb"></i><i class="ft"></i><i class="fl"></i><i class="fr"></i></span>' +
      '<span class="x-marker" hidden>X</span><span class="tok3" hidden></span><span class="unique-marker3" role="img" aria-label="×1：此值在整架只出现一次，含已剪线" hidden>×1</span></button>';
  }
  function rackHTML(p, o, si) {
    var h = '<div class="rack3" data-rack="' + o + '-' + si + '"><div class="rack-base"></div><div class="rack-row">';
    p.stands[si].forEach(function (w, k) {
      h += tileHTML(w, o, si);
      if (p.stands[si][k + 1]) h += '<span class="lbl3" data-pair="' + w.id + '-' + p.stands[si][k + 1].id + '" hidden></span>';
    });
    return h + '</div></div>';
  }
  function seatHTML(V, o, cell, mine, spectator) {
    var p = V.players[o];
    var h = '<section class="seat3' + (mine ? ' me' : '') + '" data-seat="' + o + '" style="grid-column: span ' + cell.span + ';--tz:' + cell.tilt + 'deg">' +
      '<div class="plate"><span class="pn">' + esc(p.name) + (mine ? spectator ? '（观战视角）' : '（你）' : '') + '</span><span class="pleft">' + p.stands.length + ' 个线架</span><span class="ptags"></span></div>';
    p.stands.forEach(function (_, si) { h += rackHTML(p, o, si); });
    return h + '</section>';
  }

  function build(stage, V, ctx) {
    var me = ctx.me, narrow = ctx.narrow;
    var rows = layoutRows(seatOrder(V, me), narrow);
    var h = '<div class="room"><div class="mat3"><div class="mat-grid"></div><div class="mat-ruler"></div>';
    rows.forEach(function (r) { r.forEach(function (c) { h += seatHTML(V, c.o, c, false); }); });
    // 中央：引爆器、进度托盘、装备
    h += '<section class="center3" style="grid-column: span 2">' +
      '<div class="dial3"><div class="dial-face"></div><div class="dial-needle"></div><div class="dial-hub"></div><div class="dial-txt"></div></div>' +
      '<div class="tray3"><div class="tray-cells"></div><div class="tray-mk"></div></div>' +
      '<div class="cards3">' + V.equip.map(function (e) {
        if (e.hidden) return '<button class="card3 hidden-equipment" data-act="hidden-equipment" data-slot="' + e.slot + '" title="未翻开的装备，不能预览身份"><span class="cin"><span class="cf"><b class="cn">✕</b><span class="ct">未翻开的装备</span><span class="cd">完成当前数字的四根蓝线后，可盲翻一张装备；不能查看编号或效果。</span><span class="cs">背面朝上 · 身份未知</span></span></span></button>';
        var d = BB.EQUIP[e.n];
        return '<button class="card3" data-act="eq" data-n="' + e.n + '" title="' + esc(d.desc) + '"><span class="cin">' +
          '<span class="cf"><b class="cn">' + BB.equipmentLabel(e.n) + '</b><span class="ct">' + d.name + '</span><span class="cd">' + esc(d.desc) + '</span><span class="cs"></span></span>' +
          '<span class="cb"><b>' + BB.equipmentLabel(e.n) + '</b><span>剪掉 '+BB.equipProgress(e.n).count+' 根 ' + BB.valLabel(BB.equipProgress(e.n).value) + '<br>解锁</span></span></span></button>';
      }).join('') + '</div></section>';
    if (me >= 0) h += seatHTML(V, me, { span: 2, tilt: 0 }, true, ctx.spectator);
    h += '</div></div><div class="boom-flash"></div>';
    stage.innerHTML = h;
    stage._sig = sigOf(V, me, narrow, ctx.spectator);
    stage._lastKey = null;
    fit(stage);
  }

  // 一个线架始终是一行；空间不足时由线架自身横向滚动。
  function fit(stage) {
    stage.querySelectorAll('.rack3').forEach(function (r) {
      var n = r.querySelectorAll('.slot').length || 1;
      var avail = r.clientWidth - 24;
      var labelSpace = 0;
      r.querySelectorAll('.lbl3:not([hidden])').forEach(function (label) {
        var style = getComputedStyle(label);
        labelSpace += label.offsetWidth + parseFloat(style.marginLeft) + parseFloat(style.marginRight) + 6;
      });
      var tw = (avail - 6 * (n - 1) - labelSpace) / n;
      tw = Math.max(26, Math.min(46, Math.floor(tw * 10) / 10 - 0.5));
      r.style.setProperty('--tw', tw.toFixed(1) + 'px');
      r.style.setProperty('--rackw', Math.ceil(n * tw + 6 * (n - 1) + labelSpace + 24) + 'px');
    });
  }
  T.fit = fit;

  function update(stage, V, ctx) {
    var me = ctx.me, sel = ctx.sel || {}, over = V.phase === 'won' || V.phase === 'lost';
    var key = V.lastAct ? V.gid + JSON.stringify(V.lastAct) + V.turnNo + V.det : '';
    var fresh = key && key !== stage._lastKey;
    stage._lastKey = key;
    var room = stage.querySelector('.room');
    room.classList.toggle('setup', V.phase === 'setup');
    room.classList.toggle('over', over);
    room.classList.toggle('won', V.phase === 'won');
    room.classList.toggle('physical', V.ruleset === 'physical');

    V.players.forEach(function (p, o) {
      var seat = stage.querySelector('[data-seat="' + o + '"]');
      if (!seat) return;
      var marking = ctx.setupStatus ? ctx.setupStatus(o) : { done: V.setup[o] >= BB.setupNeed(V, o), active: false, label: V.setup[o] >= BB.setupNeed(V, o) ? '已标记' : '等待标记' };
      var turn = (BB.turnActor(V) === o && (V.phase === 'play' || V.phase === 'constraints') && BB.ownTurnAllowed(V,o)) || marking.active;
      seat.classList.toggle('turn', turn);
      var left = 0;
      p.stands.forEach(function (st) { st.forEach(function (w) { if (!w.cut) left++; }); });
      var tags = (p.bot ? '<span class="tag bot">AI</span>' : '') + (o === (V.captain || 0) ? '<span class="tag">队长</span>' : '') +
        (BB.rookie(V) === o ? '<span class="tag warn rookie-tag">新人 · 拆线失败即爆炸</span>' : '') +
        (V.official && V.official.clues === 'mixed' ? '<span class="tag mixed-clue-tag">' + (BB.clueKind(V, o) === 'frequency' ? '频率标记' : '奇偶标记') + '</span>' : '') +
        (BB.liar(V) === o ? '<span class="tag warn liar-tag">说谎者 · 无个人装备</span>' : '') +
        (BB.unequippedCaptain(V) === o ? '<span class="tag warn unequipped-captain-tag">队长 · 无装备 · 失败即爆炸</span>' : '') +
        (ctx.dd && !BB.characterState(p).removed ? '<span class="character-card' + (BB.characterState(p).used ? ' spent' : ' ready') + '">' + (BB.characterState(p).hidden?'角色背面 · 锁定':BB.CHARACTERS[BB.characterState(p).id].name + ' · ' + (BB.characterState(p).locked?'暂时锁定':BB.characterState(p).used ? '已用' : '可用')) + '</span>' : '') +
        (V.official && V.official.constraints && V.official.constraints.personal && V.official.constraints.personal[o] ? '<span class="tag constraint-tag">限制 ' + V.official.constraints.personal[o].id + ' · ' + (V.official.constraints.personal[o].retired ? '已翻面' : '生效') + '</span>' : '') +
        '<span class="pleft">剩 ' + left + '</span>' +
        (V.phase === 'setup' ? '<span class="tag' + (marking.done ? ' yes' : marking.active ? ' turn' : '') + '">' + marking.label + '</span>' : '') +
        (V.pending && V.pending.to === o ? '<span class="tag warn">等待选择</span>' : '') +
        (turn && V.phase === 'constraints' ? '<span class="tag turn">选择限制中</span>' : '') +
        (turn && V.phase === 'play' ? '<span class="tag turn">行动中</span>' : '') + (ctx.sideClues ? ctx.sideClues(o) : '');
      var pt = seat.querySelector('.ptags');
      if (pt.innerHTML !== tags) pt.innerHTML = tags;

      p.stands.forEach(function (st,si) {
        var rack=seat.querySelector('[data-rack="'+o+'-'+si+'"]'),negatives=st.reduce(function(max,w){return Math.max(max,w.info&&w.info.t==='not'?String(w.info.v).split('/').length:0);},0),pad=negatives>1?Math.max(.78,.38+negatives*.4):.78;
        st.forEach(function(w){if(w.unique)pad=Math.max(pad,(w.info?w.info.t==='not'&&String(w.info.v).split('/').length>1?.58+String(w.info.v).split('/').length*.4:1.05:0)+1.05);});
        if(rack){rack.style.paddingBottom='calc(var(--tw) * '+pad+')';rack.querySelector('.rack-base').style.bottom='calc(var(--tw) * '+(pad-.78)+')';}
        st.forEach(function (w) {
          var el = seat.querySelector('.slot[data-w="' + w.id + '"]');
          if (!el) return;
          var k = w.v != null ? BB.kindOf(w) : 'x';
          var cls = 'slot k-' + k + (w.v == null ? ' hidden' : '') + (w.cut ? ' cut' : '') +
            (sel.wires && sel.wires.indexOf(w.id) >= 0 ? ' sel' : '') + (ctx.clickable(w, o) ? ' can' : '');
          var submarine=BB.submarine54(V);
          var call = V.pending&&['submarine-red','submarine-transfer'].indexOf(V.pending.type)>=0&&submarine&&submarine.suspendedAction?submarine.suspendedAction:V.pending && (V.pending.type === 'cut' || V.pending.type === 'risky-cut' || V.pending.type === 'precision-cut' || V.pending.type === 'tripwire-cut') ? V.pending : V.declaration;
          var chosen = call && (call.step === 'own' ? call.hit : call.result && call.result.wire);
          var declared = call && (chosen != null ? chosen === w.id : call.ids.indexOf(w.id) >= 0);
          var memory=BB.memorySea(V),pointed=memory&&memory.point&&memory.point.wire===w.id;
          if(pointed)cls+=' memory-target';
          if (declared||pointed) cls += ' declared-target';
          var flash = '';
          if (V.lastAct && V.lastAct.ids.indexOf(w.id) >= 0) flash = ' fx-' + V.lastAct.t;
          if (fresh && flash) { el.className = cls; void el.offsetWidth; }
          el.className = cls + flash;
          el.tabIndex = ctx.clickable(w, o) ? 0 : -1;
          el.setAttribute('aria-disabled', ctx.clickable(w, o) ? 'false' : 'true');
          el.setAttribute('aria-label', (w.v != null ? '线 ' + fmtV(w.v) : '未知的线') + (w.kind === 'r' ? '，本关视为红线' : '') + (w.cut ? k === 'r' && w.resolution !== 'cut' ? '，已公开' : w.resolution === 'secured' ? '，已安全处理' : '，已剪' : '') + (w.info ? '，标记 ' + infoTxt(w.info) : '')+(w.unique?'，×1：整架同值只有一根，含已剪线':'') + (pointed?'，当前记忆指线':declared ? '，队友已选中并宣告' : ''));
          var fv = el.querySelector('.fv'), txt = w.v != null ? fmtV(w.v) : '';
          if (fv.textContent !== txt) fv.textContent = txt;
          var tok = el.querySelector('.tok3'), it = w.info ? String(infoTxt(w.info)) : '';
          if (tok.textContent !== it || w.info && w.info.t==='not' && String(w.info.v).indexOf('/')>=0 && !tok.querySelector('.negative-value')) tok.innerHTML = w.info ? infoMarkup(w.info) : '';
          tok.classList.toggle('multi-not',!!(w.info&&w.info.t==='not'&&String(w.info.v).indexOf('/')>=0));
          tok.hidden = !w.info;
          var unique=el.querySelector('.unique-marker3');unique.hidden=!w.unique;unique.style.top='calc(100% + var(--tw) * '+(w.info?w.info.t==='not'&&String(w.info.v).split('/').length>1?.58+String(w.info.v).split('/').length*.4:1.05:0)+')';
          var x = el.querySelector('.x-marker'), outward = BB.isOutward(V, w); x.hidden = !BB.isX(V, w) && !outward;
          x.textContent = outward ? '朝外' : 'X'; x.classList.toggle('outward-marker', outward);
          if (!x.hidden) el.setAttribute('aria-label', el.getAttribute('aria-label') + (outward ? (w.cut || V.phase === 'won' || V.phase === 'lost' ? '，原朝外导线，已公开' : BB.allOutward(V)?'，朝外导线，主人不可见；队友剪中推进引爆器，不能用装备':'，朝外导线，队长不能看见，其他人不能选择') : '，X导线，不参与排序，不能使用装备'));
        });
      });
    });
    // 标签 = / ≠
    var labelsChanged = false;
    stage.querySelectorAll('.lbl3').forEach(function (l) {
      var pr = l.dataset.pair.split('-').map(Number), t = '';
      V.labels.forEach(function (x) { if ((x.a === pr[0] && x.b === pr[1]) || (x.a === pr[1] && x.b === pr[0])) t = x.t === 'eq' ? '=' : '≠'; });
      if (l.textContent !== t || l.hidden !== !t) labelsChanged = true;
      l.textContent = t; l.hidden = !t;
    });
    if (labelsChanged) fit(stage);

    // 引爆器：指针从 -135° 转到 +135°
    var dial = stage.querySelector('.dial3');
    dial.hidden=!!BB.robotPressure(V);
    var printed = V.mission && V.mission.printedDial, capacity = V.detMax - BB.dialMin(V), progress = V.det - BB.dialMin(V);
    var segs = [], step = 270 / capacity;
    for (var i = 0; i < capacity; i++) {
      var a0 = i * step, a1 = a0 + step - 3;
      var col = printed ? ['#4ab57e', '#92c867', '#efcb52', '#eea14d', '#e75e47'][i] : i === capacity - 1 ? 'var(--m-red)' : i < progress ? 'var(--m-amber)' : 'var(--m-dial-off)';
      segs.push(col + ' ' + a0.toFixed(1) + 'deg ' + a1.toFixed(1) + 'deg', 'transparent ' + a1.toFixed(1) + 'deg ' + (a0 + step).toFixed(1) + 'deg');
    }
    dial.querySelector('.dial-face').style.background = 'conic-gradient(from 225deg, ' + segs.join(', ') + ', transparent 270deg 360deg)';
    dial.querySelector('.dial-needle').style.transform = 'translate(-50%, -100%) rotate(' + (-135 + Math.max(0, Math.min(progress, capacity)) * step) + 'deg)';
    dial.querySelector('.dial-txt').innerHTML = printed ? '<b>余 ' + Math.max(0, V.detMax - V.det) + '</b><span>格</span><em>引爆器</em>' : '<b>' + V.det + '</b><span>/ ' + V.detMax + '</span><em>引爆器</em>';
    dial.classList.toggle('danger', V.det >= V.detMax - 1);

    // 进度托盘
    var memory=BB.memorySea(V),m = ctx.mission, ch = '';
    for (var v = m.blue[0]; v <= m.blue[1]; v++) {
      var c = ctx.countCut(v), si = V.seq.indexOf(v), pins = '';
      if (v === BB.redNumber(V)) { ch += '<span class="cell3 converted-red" title="本关四根 ' + v + ' 都视为红线"><b>' + v + '</b><span>红线</span></span>'; continue; }
      for (var q = 0; q < 4; q++) pins += '<i class="' + (q < c ? 'on' : '') + '"></i>';
      ch += '<span class="cell3' + (c >= 4 && !memory ? ' done' : '') + (V.missing === v ? ' miss' : '') + '" title="数值 ' + v + (memory?'':'：已剪 ' + c + ' 根')+'">' +
        (si >= 0 ? '<sup>' + (si + 1) + '</sup>' : '') + '<b>' + v + '</b>'+(memory?'':'<span class="pins">' + pins + '</span>')+'</span>';
    }
    var tc = stage.querySelector('.tray-cells');
    if (tc.innerHTML !== ch) tc.innerHTML = ch;
    var mk = '';
    function marks(M, cls, nm) {
      if(memory)return "";
      if (!M.n && !M.cand.length) return '';
      return '<span class="mkl">' + nm + ' ' + M.n + (M.cand.length > M.n ? '/' + M.cand.length : '') + '</span>' +
        (M.cand.length ? M.cand.map(function (x) { return '<span class="pawn ' + cls + '">' + x.toFixed(1) + '</span>'; }).join('') : '<span class="mkl">位置未知</span>');
    }
    mk += marks(V.ymark, 'y', '黄') + marks(V.rmark, 'r', '红');
    if (V.seq.length) mk += '<span class="mkl">顺序 ' + V.seq.join('→') + '</span>';
    if (V.radar) mk += '<span class="mkl">雷达「' + BB.valLabel(V.radar.val) + '」' + V.players.map(function (p, i) { return esc(p.name) + (Array.isArray(V.radar.res[i]) ? V.radar.res[i].map(function (yes, si) { return (si + 1) + '排' + (yes ? '有' : '无'); }).join('/') : V.radar.res[i] ? '有' : '无'); }).join(' · ') + '</span>';
    var tm = stage.querySelector('.tray-mk');
    if (tm.innerHTML !== mk) tm.innerHTML = mk;

    // 装备卡
    V.equip.forEach(function (e) {
      if (e.hidden) return;
      var card = stage.querySelector('.card3[data-n="' + e.n + '"]');
      if (!card) return;
      var st = ctx.equipState(e);
      card.disabled = false;
      card.classList.toggle('open', e.open);
      card.classList.toggle('used', e.used);
      card.classList.toggle('on', !!(sel.mode === 'eq' && sel.n === e.n));
      var unlock = BB.equipProgress(e.n), cut = ctx.countCut(unlock.value);
      card.querySelector('.cn').textContent = unlock.printed;
      card.querySelector('.cs').textContent = st.label + ' · ' + (st.progress || cut + '/' + (unlock.value === 'Y' ? V.ymark.n : 4) + (cut >= unlock.count ? ' 解锁' : ''));
      card.querySelector('.cd').textContent = st.desc || BB.EQUIP[e.n].desc;
    });

    if (fresh && V.lastAct.t === 'boom') {
      var f = stage.querySelector('.boom-flash');
      f.classList.remove('go'); void f.offsetWidth; f.classList.add('go');
    }
  }

  T.render = function (stage, V, ctx) {
    var narrow = stage.clientWidth < 720;
    ctx.narrow = narrow;
    if (stage._sig !== sigOf(V, ctx.me, narrow, ctx.spectator)) build(stage, V, ctx);
    update(stage, V, ctx);
  };

  window.Table3D = T;
})();
