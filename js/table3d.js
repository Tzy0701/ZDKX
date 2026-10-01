/* 炸弹克星 · 3D 牌桌（CSS 3D）
 * 一张倾斜的切割垫：远处是队友的线架，中间是引爆器、进度托盘和装备卡，近处是你的线架。
 * 结构不变时只更新状态（类名、标记、指针角度），让翻倒、翻牌等过渡动画可以播放。
 */
(function () {
  var BB = window.BB;
  var T = {};

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function fmtV(v) { return BB.kindOf(v) === 'b' ? String(v) : v.toFixed(1); }
  function infoTxt(f) {
    if (!f) return '';
    if (f.t === 'v') return f.v; if (f.t === 'Y') return '黄';
    if (f.t === 'odd') return '奇'; if (f.t === 'even') return '偶';
    if (f.t === 'not') return '≠' + f.v; return '';
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

  function sigOf(V, me, narrow) {
    return [V.gid, me, narrow ? 'n' : 'w', V.equip.map(function (e) { return e.n; }).join(','),
      V.players.map(function (p) { return p.stands.map(function (st) { return st.map(function (w) { return w.id; }).join(','); }).join('/'); }).join(';')].join('|');
  }

  function tileHTML(w, o, s) {
    return '<div class="slot" data-w="' + w.id + '" data-o="' + o + '" data-s="' + s + '" role="button" tabindex="-1">' +
      '<div class="t3"><i class="ff"><b class="fv"></b><span class="stripe"></span></i><i class="fb"></i><i class="ft"></i><i class="fl"></i><i class="fr"></i></div>' +
      '<span class="tok3" hidden></span></div>';
  }
  function rackHTML(p, o, si) {
    var h = '<div class="rack3" data-rack="' + o + '-' + si + '"><div class="rack-base"></div><div class="rack-row">';
    p.stands[si].forEach(function (w, k) {
      h += tileHTML(w, o, si);
      if (p.stands[si][k + 1]) h += '<span class="lbl3" data-pair="' + w.id + '-' + p.stands[si][k + 1].id + '" hidden></span>';
    });
    return h + '</div></div>';
  }
  function seatHTML(V, o, cell, mine) {
    var p = V.players[o];
    var h = '<section class="seat3' + (mine ? ' me' : '') + '" data-seat="' + o + '" style="grid-column: span ' + cell.span + ';--tz:' + cell.tilt + 'deg">' +
      '<div class="plate"><span class="pn">' + esc(p.name) + (mine ? '（你）' : '') + '</span><span class="ptags"></span></div>';
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
        var d = BB.EQUIP[e.n];
        return '<button class="card3" data-act="eq" data-n="' + e.n + '" title="' + esc(d.desc) + '"><span class="cin">' +
          '<span class="cf"><b class="cn">' + e.n + '</b><span class="ct">' + d.name + '</span><span class="cd">' + esc(d.desc) + '</span><span class="cs"></span></span>' +
          '<span class="cb"><b>' + e.n + '</b><span>剪掉 2 根 ' + e.n + '<br>解锁</span></span></span></button>';
      }).join('') + '</div></section>';
    if (me >= 0) h += seatHTML(V, me, { span: 2, tilt: 0 }, true);
    h += '</div></div><div class="boom-flash"></div>';
    stage.innerHTML = h;
    stage._sig = sigOf(V, me, narrow);
    stage._lastKey = null;
    fit(stage);
  }

  // 根据每排线的数量和可用宽度计算牌的大小
  function fit(stage) {
    stage.querySelectorAll('.rack3').forEach(function (r) {
      var n = r.querySelectorAll('.slot').length || 1;
      var avail = r.clientWidth - 24;
      var gap = 6, minTw = 26;
      var per = n, tw = (avail - gap * (n - 1)) / n;
      // 太挤时折成两行，保证手机上也看得清
      if (tw < minTw && n > 1) { per = Math.ceil(n / 2); tw = (avail - gap * (per - 1)) / per; }
      tw = Math.max(16, Math.min(46, Math.floor(tw * 10) / 10 - 0.5));
      r.classList.toggle('wrap2', per < n);
      r.style.setProperty('--tw', tw.toFixed(1) + 'px');
      r.style.setProperty('--per', per);
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

    V.players.forEach(function (p, o) {
      var seat = stage.querySelector('[data-seat="' + o + '"]');
      if (!seat) return;
      var turn = V.turn === o && V.phase === 'play';
      seat.classList.toggle('turn', turn);
      var left = 0;
      p.stands.forEach(function (st) { st.forEach(function (w) { if (!w.cut) left++; }); });
      var tags = (p.bot ? '<span class="tag bot">AI</span>' : '') + (o === 0 ? '<span class="tag">队长</span>' : '') +
        (ctx.dd ? '<span class="tag' + (p.dd ? ' yes' : ' off') + '">双探</span>' : '') +
        '<span class="pleft">剩 ' + left + '</span>' +
        (V.phase === 'setup' ? '<span class="tag' + (V.setup[o] >= V.infoN ? ' yes' : '') + '">' + (V.setup[o] >= V.infoN ? '已布置' : '布置中') + '</span>' : '') +
        (V.pending && V.pending.to === o ? '<span class="tag warn">交换中</span>' : '') +
        (turn ? '<span class="tag turn">行动中</span>' : '');
      var pt = seat.querySelector('.ptags');
      if (pt.innerHTML !== tags) pt.innerHTML = tags;

      p.stands.forEach(function (st) {
        st.forEach(function (w) {
          var el = seat.querySelector('.slot[data-w="' + w.id + '"]');
          if (!el) return;
          var k = w.v != null ? BB.kindOf(w.v) : 'x';
          var cls = 'slot k-' + k + (w.v == null ? ' hidden' : '') + (w.cut ? ' cut' : '') +
            (sel.wires && sel.wires.indexOf(w.id) >= 0 ? ' sel' : '') + (ctx.clickable(w, o) ? ' can' : '');
          var flash = '';
          if (V.lastAct && V.lastAct.ids.indexOf(w.id) >= 0) flash = ' fx-' + V.lastAct.t;
          if (fresh && flash) { el.className = cls; void el.offsetWidth; }
          el.className = cls + flash;
          el.tabIndex = ctx.clickable(w, o) ? 0 : -1;
          el.setAttribute('aria-label', (w.v != null ? '线 ' + fmtV(w.v) : '未知的线') + (w.cut ? '，已剪' : '') + (w.info ? '，标记 ' + infoTxt(w.info) : ''));
          var fv = el.querySelector('.fv'), txt = w.v != null ? fmtV(w.v) : '';
          if (fv.textContent !== txt) fv.textContent = txt;
          var tok = el.querySelector('.tok3'), it = w.info ? String(infoTxt(w.info)) : '';
          if (tok.textContent !== it) tok.textContent = it;
          tok.hidden = !w.info;
        });
      });
    });
    // 标签 = / ≠
    stage.querySelectorAll('.lbl3').forEach(function (l) {
      var pr = l.dataset.pair.split('-').map(Number), t = '';
      V.labels.forEach(function (x) { if ((x.a === pr[0] && x.b === pr[1]) || (x.a === pr[1] && x.b === pr[0])) t = x.t === 'eq' ? '=' : '≠'; });
      l.textContent = t; l.hidden = !t;
    });

    // 引爆器：指针从 -135° 转到 +135°
    var dial = stage.querySelector('.dial3');
    var segs = [], step = 270 / V.detMax;
    for (var i = 0; i < V.detMax; i++) {
      var a0 = i * step, a1 = a0 + step - 3;
      var col = i === V.detMax - 1 ? 'var(--m-red)' : i < V.det ? 'var(--m-amber)' : 'var(--m-dial-off)';
      segs.push(col + ' ' + a0.toFixed(1) + 'deg ' + a1.toFixed(1) + 'deg', 'transparent ' + a1.toFixed(1) + 'deg ' + (a0 + step).toFixed(1) + 'deg');
    }
    dial.querySelector('.dial-face').style.background = 'conic-gradient(from 225deg, ' + segs.join(', ') + ', transparent 270deg 360deg)';
    dial.querySelector('.dial-needle').style.transform = 'translate(-50%, -100%) rotate(' + (-135 + Math.min(V.det, V.detMax) * step) + 'deg)';
    dial.querySelector('.dial-txt').innerHTML = '<b>' + V.det + '</b><span>/ ' + V.detMax + '</span><em>引爆器</em>';
    dial.classList.toggle('danger', V.det >= V.detMax - 1);

    // 进度托盘
    var m = ctx.mission, ch = '';
    for (var v = m.blue[0]; v <= m.blue[1]; v++) {
      var c = ctx.countCut(v), si = V.seq.indexOf(v), pins = '';
      for (var q = 0; q < 4; q++) pins += '<i class="' + (q < c ? 'on' : '') + '"></i>';
      ch += '<span class="cell3' + (c >= 4 ? ' done' : '') + (V.missing === v ? ' miss' : '') + '" title="数值 ' + v + '：已剪 ' + c + ' 根">' +
        (si >= 0 ? '<sup>' + (si + 1) + '</sup>' : '') + '<b>' + v + '</b><span class="pins">' + pins + '</span></span>';
    }
    var tc = stage.querySelector('.tray-cells');
    if (tc.innerHTML !== ch) tc.innerHTML = ch;
    var mk = '';
    function marks(M, cls, nm) {
      if (!M.n && !M.cand.length) return '';
      return '<span class="mkl">' + nm + ' ' + M.n + (M.cand.length > M.n ? '/' + M.cand.length : '') + '</span>' +
        (M.cand.length ? M.cand.map(function (x) { return '<span class="pawn ' + cls + '">' + x.toFixed(1) + '</span>'; }).join('') : '<span class="mkl">位置未知</span>');
    }
    mk += marks(V.ymark, 'y', '黄') + marks(V.rmark, 'r', '红');
    if (V.seq.length) mk += '<span class="mkl">顺序 ' + V.seq.join('→') + '</span>';
    if (V.radar) mk += '<span class="mkl">雷达「' + BB.valLabel(V.radar.val) + '」' + V.players.map(function (p, i) { return esc(p.name) + (V.radar.res[i] ? '有' : '无'); }).join(' · ') + '</span>';
    var tm = stage.querySelector('.tray-mk');
    if (tm.innerHTML !== mk) tm.innerHTML = mk;

    // 装备卡
    V.equip.forEach(function (e) {
      var card = stage.querySelector('.card3[data-n="' + e.n + '"]');
      if (!card) return;
      var st = ctx.equipState(e);
      card.disabled = !st.usable;
      card.classList.toggle('open', e.open);
      card.classList.toggle('used', e.used);
      card.classList.toggle('on', !!(sel.mode === 'eq' && sel.n === e.n));
      card.querySelector('.cs').textContent = st.label;
    });

    if (fresh && V.lastAct.t === 'boom') {
      var f = stage.querySelector('.boom-flash');
      f.classList.remove('go'); void f.offsetWidth; f.classList.add('go');
    }
  }

  T.render = function (stage, V, ctx) {
    var narrow = stage.clientWidth < 720;
    ctx.narrow = narrow;
    if (stage._sig !== sigOf(V, ctx.me, narrow)) build(stage, V, ctx);
    update(stage, V, ctx);
  };

  window.Table3D = T;
})();
