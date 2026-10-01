/* 炸弹克星 · 界面与联机流程（房主权威：房主浏览器运行规则引擎，其他人只发送动作） */
(function () {
  var BB = window.BB, Bot = window.BBBot, Net = window.BBNet, MISSIONS = window.BB_MISSIONS;
  var $ = function (s, el) { return (el || document).querySelector(s); };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  var store = {
    get: function (k, d) { try { var v = localStorage.getItem('bb_' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: function (k, v) { try { if (v === null) localStorage.removeItem('bb_' + k); else localStorage.setItem('bb_' + k, JSON.stringify(v)); } catch (e) {} }
  };
  function rid(n, abc) { var s = ''; abc = abc || 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; for (var i = 0; i < n; i++) s += abc[Math.floor(Math.random() * abc.length)]; return s; }

  var BOT_NAMES = ['AI·阿尔法', 'AI·布拉沃', 'AI·查理', 'AI·德尔塔', 'AI·回声'];
  var RULE_TAGS = {
    timer: function (v) { return '⏱ 每回合 ' + v + ' 秒'; },
    countdown: function (v) { return '⌛ 每 ' + v + ' 回合引爆器 +1'; },
    seq: function (v) { return '🔢 顺序引信 ×' + v; },
    fog: function () { return '🌫 浓雾'; },
    silent: function () { return '🕳 失败无信息'; },
    noChat: function () { return '🔇 禁止聊天'; },
    missing: function () { return '❔ 缺失一个数值'; },
    hide: function () { return '🙈 候选不公开'; },
    turns: function (v) { return '🏁 回合上限 +' + v; },
    infoN: function (v) { return '📌 开局 ' + v + ' 个信息'; }
  };

  var S = {
    screen: 'home', name: store.get('name', ''), pid: store.get('pid', null),
    mode: null, net: null, code: null, lobby: null, G: null, V: null, pub: null, hand: null,
    log: [], chat: [], sel: null, hostPeer: null, hostGone: false, deadline: null,
    cleared: store.get('cleared', []), err: '', netKind: null, joining: false, view3d: store.get('view3d', true)
  };
  if (!S.pid) { S.pid = rid(10, 'abcdefghijkmnpqrstuvwxyz23456789'); store.set('pid', S.pid); }

  /* ---------- 通用 ---------- */
  var toastT = null;
  function toast(msg, kind) {
    var t = $('#toast');
    t.textContent = msg; t.className = 'toast show ' + (kind || '');
    clearTimeout(toastT); toastT = setTimeout(function () { t.className = 'toast'; }, 2600);
  }
  function mission(id) { return MISSIONS[(id || 1) - 1]; }
  function ruleChips(m, extra) {
    var out = [];
    var R = m.rules || {};
    out.push('<span class="chip-rule">蓝 ' + m.blue[0] + '–' + m.blue[1] + '</span>');
    if (m.y[1]) out.push('<span class="chip-rule y">黄 ' + (m.y[0] === m.y[1] ? m.y[0] : m.y[0] + '/' + m.y[1]) + '</span>');
    if (m.r[1]) out.push('<span class="chip-rule r">红 ' + (m.r[0] === m.r[1] ? m.r[0] : m.r[0] + '/' + m.r[1]) + '</span>');
    if (m.eq) out.push('<span class="chip-rule">装备 ' + (m.eq === -1 ? '人数' : m.eq) + '</span>');
    if (m.dd) out.push('<span class="chip-rule">双重探测器</span>');
    if (m.info === 'none') out.push('<span class="chip-rule warn">无开局信息</span>');
    if (m.info === 'parity') out.push('<span class="chip-rule warn">奇偶信息</span>');
    if (m.det) out.push('<span class="chip-rule">容错 ' + (m.det > 0 ? '+' : '') + m.det + '</span>');
    Object.keys(R).forEach(function (k) { if (RULE_TAGS[k]) out.push('<span class="chip-rule warn">' + RULE_TAGS[k](R[k]) + '</span>'); });
    return out.join('');
  }
  function fmtV(v) { return BB.kindOf(v) === 'b' ? String(v) : v.toFixed(1); }
  function infoTxt(f) {
    if (!f) return '';
    if (f.t === 'v') return f.v; if (f.t === 'Y') return '黄';
    if (f.t === 'odd') return '奇'; if (f.t === 'even') return '偶';
    if (f.t === 'not') return '≠' + f.v; return '';
  }
  function isHost() { return S.mode === 'host' || S.mode === 'solo'; }
  function myIdx() {
    var ps = isHost() && S.G ? S.G.players : S.V ? S.V.players : [];
    for (var i = 0; i < ps.length; i++) if (ps[i].pid === S.pid) return i;
    return -1;
  }
  function nextMissionId() {
    for (var i = 1; i <= MISSIONS.length; i++) if (S.cleared.indexOf(i) < 0) return i;
    return MISSIONS.length;
  }

  /* ---------- 路由 ---------- */
  function go(screen) {
    S.screen = screen; S.sel = null;
    render();
    window.scrollTo(0, 0);
  }
  function render() {
    document.querySelectorAll('.nav button').forEach(function (b) { b.classList.toggle('on', b.dataset.go === S.screen || (b.dataset.go === 'home' && (S.screen === 'lobby' || S.screen === 'game'))); });
    ['home', 'lobby', 'game', 'rules', 'missions'].forEach(function (k) { $('#scr-' + k).hidden = S.screen !== k; });
    if (S.screen === 'home') renderHome();
    if (S.screen === 'lobby') renderLobby();
    if (S.screen === 'game') renderGame();
    if (S.screen === 'missions') renderMissions();
    var navPlay = $('.nav [data-go="home"]');
    navPlay.textContent = S.mode ? (S.lobby && S.lobby.started ? '回到牌桌' : '回到大厅') : '开始';
  }

  /* ---------- 首页 ---------- */
  function renderHome() {
    $('#nm').value = S.name;
    var last = store.get('lastRoom', null);
    var back = $('#resume');
    if (S.mode) {
      back.hidden = false;
      back.innerHTML = '<span>你正在' + (S.mode === 'solo' ? '单人练习' : '房间 <b>' + esc(S.code) + '</b>') + '中。</span><button class="btn small" data-act="resume">继续</button><button class="btn small ghost" data-act="quit">退出</button>';
    } else if (last) {
      back.hidden = false;
      back.innerHTML = '<span>上次的房间 <b>' + esc(last.code) + '</b>' + (last.host ? '（你是房主）' : '') + '</span><button class="btn small" data-act="rejoin">重新进入</button><button class="btn small ghost" data-act="forget">忘掉</button>';
    } else back.hidden = true;
    Net.probe().then(function (cap) {
      S.netKind = cap ? cap.kind : null;
      var n = $('#netnote');
      if (!cap) n.innerHTML = '当前打开方式不支持联机。请在 claude.ai 里打开本页（好友需被邀请并拥有“可互动”及以上权限），或运行自带的 Node 服务器。单人练习不受影响。';
      else if (cap.kind === 'claude') n.innerHTML = '联机通道：claude.ai 实时房间。把本页分享给好友（至少“可互动”权限），大家打开后输入同一个房间码即可。';
      else n.innerHTML = '联机通道：自建服务器。好友打开同一个网址，输入房间码即可加入。';
      $('#btn-host').disabled = !cap; $('#btn-join').disabled = !cap;
    });
  }
  function needName() {
    var n = $('#nm').value.trim().slice(0, 12);
    if (!n) { toast('先给自己起个代号', 'bad'); $('#nm').focus(); return null; }
    S.name = n; store.set('name', n); return n;
  }

  /* ---------- 单人练习 ---------- */
  function startSolo() {
    if (!needName()) return;
    leaveNet();
    S.mode = 'solo'; S.code = null; S.G = null;
    S.lobby = { code: null, host: S.pid, seats: [{ pid: S.pid, name: S.name }, bot(0), bot(1)], mid: nextMissionId(), started: false };
    go('lobby');
  }
  function bot(i) { return { pid: 'bot' + i + rid(3), name: BOT_NAMES[i % BOT_NAMES.length], bot: true }; }

  /* ---------- 联机：房主 ---------- */
  function hostCreate(code, restore) {
    if (!needName()) return;
    leaveNet();
    code = code || rid(4);
    S.mode = 'host'; S.code = code; S.G = null; S.chat = [];
    S.lobby = { code: code, host: S.pid, seats: [{ pid: S.pid, name: S.name }], mid: nextMissionId(), started: false };
    if (restore) {
      S.lobby = restore.lobby; S.G = restore.G;
      if (S.G && S.G.deadline) S.G.deadline = Date.now() + S.G.mission.rules.timer * 1000; S.lobby.seats.forEach(function (s) { if (s.pid === S.pid) s.name = S.name; });
    }
    S.joining = true; render();
    Net.join(code).then(function (net) {
      S.net = net; S.joining = false;
      net.on('hello', function (m) { onHello(m.data); });
      net.on('act', function (m) { if (!m.mine) onRemoteAct(m.data); });
      net.on('chat', function (m) { onChat(m.data); });
      net.onPeers(function () { /* 有人进出时重发一次状态，方便断线重连 */ setTimeout(emitLobby, 300); });
      store.set('lastRoom', { code: code, host: true });
      emitLobby();
      if (S.G) hostSync();
      go(S.G ? 'game' : 'lobby');
    }).catch(function (e) { S.joining = false; S.mode = null; toast(e.message || '无法创建房间', 'bad'); render(); });
  }
  function emitLobby() {
    if (S.mode !== 'host' || !S.net) return;
    var L = S.lobby;
    S.net.emit('lobby', { code: L.code, host: L.host, seats: L.seats, mid: L.mid, started: L.started });
    if (S.G) hostSync(true);
  }
  function onHello(d) {
    if (!d || !d.pid) return;
    var L = S.lobby, seat = L.seats.filter(function (s) { return s.pid === d.pid; })[0];
    var name = String(d.name || '玩家').slice(0, 12);
    if (seat) seat.name = name;
    else if (!L.started && L.seats.length < 5) { L.seats.push({ pid: d.pid, name: name }); toast(name + ' 加入了房间'); }
    if (S.G && seat) S.G.players.forEach(function (p) { if (p.pid === d.pid) p.name = name; });
    emitLobby();
    render();
  }
  function onRemoteAct(d) {
    if (!S.G || !d) return;
    var i = -1;
    S.G.players.forEach(function (p, k) { if (p.pid === d.pid) i = k; });
    if (i < 0) return;
    var err = BB.act(S.G, i, d.a);
    if (err) { S.net.emit('err', { to: d.pid, msg: err }); return; }
    S.sel = S.sel && S.G.turn === myIdx() ? S.sel : null;
    hostSync();
  }

  /* ---------- 联机：加入者 ---------- */
  function guestJoin(code) {
    if (!needName()) return;
    code = (code || '').trim().toUpperCase();
    if (!/^[A-Z0-9]{3,8}$/.test(code)) { toast('房间码是 4 位字母或数字', 'bad'); return; }
    leaveNet();
    S.mode = 'guest'; S.code = code; S.lobby = null; S.pub = null; S.hand = null; S.V = null; S.log = []; S.chat = []; S.hostGone = false;
    S.joining = true; render();
    Net.join(code).then(function (net) {
      S.net = net;
      net.on('lobby', function (m) {
        S.hostPeer = m.peer; S.hostGone = false;
        var first = !S.lobby;
        S.lobby = m.data; S.joining = false;
        store.set('lastRoom', { code: code, host: false });
        if (first || (!S.lobby.started && S.screen !== 'lobby' && S.screen !== 'rules' && S.screen !== 'missions')) go(S.lobby.started && S.pub ? 'game' : 'lobby');
        else render();
      });
      net.on('pub', function (m) { S.hostPeer = m.peer; onPub(m.data); });
      net.on('hand', function (m) { if (m.data && m.data.to === S.pid) { S.hand = m.data.h; if (S.pub) onPub(S.pub, true); } });
      net.on('err', function (m) { if (m.data && m.data.to === S.pid) toast(m.data.msg, 'bad'); });
      net.on('chat', function (m) { onChat(m.data); });
      net.onPeers(function (ids) {
        if (S.hostPeer && ids.indexOf(S.hostPeer) < 0) { S.hostGone = true; render(); }
        else if (S.hostGone) { S.hostGone = false; render(); }
      });
      var tries = 0;
      (function hello() {
        if (S.mode !== 'guest' || S.net !== net) return;
        net.emit('hello', { pid: S.pid, name: S.name });
        if (!S.lobby && ++tries < 6) setTimeout(hello, 2000);
        else if (!S.lobby) { S.joining = false; toast('没找到房间 ' + code + '：确认房主已创建房间且你们打开的是同一个页面', 'bad'); render(); }
      })();
    }).catch(function (e) { S.joining = false; S.mode = null; toast(e.message || '无法加入房间', 'bad'); render(); });
  }
  function onPub(pub, quiet) {
    S.pub = pub;
    var me = -1;
    pub.players.forEach(function (p, i) { if (p.pid === S.pid) me = i; });
    var prevPhase = S.V && S.V.phase;
    if (S.V && S.V.gid !== pub.gid) { S.log = []; S.sel = null; prevPhase = null; }
    S.V = BB.unpack(pub, S.hand, me);
    S.deadline = pub.left != null ? Date.now() + pub.left : null;
    mergeLog(pub.log);
    if (!quiet) afterState(prevPhase);
    if (S.screen === 'lobby' || (S.screen === 'home' && S.lobby && S.lobby.started)) go('game');
    else render();
  }
  function mergeLog(entries) {
    var last = S.log.length ? S.log[S.log.length - 1].n : 0;
    (entries || []).forEach(function (e) { if (e.n > last) S.log.push(e); });
    if (S.log.length > 200) S.log = S.log.slice(-200);
  }

  /* ---------- 房主同步 ---------- */
  function hostSync(silent) {
    var G = S.G;
    if (!G) return;
    if (S.mode === 'host' && S.net) {
      var pub = BB.packPublic(G, 8), n = 8;
      pub.left = G.deadline ? G.deadline - Date.now() : null;
      while (JSON.stringify(pub).length > 3800 && n > 0) { n -= 2; pub.log = G.log.slice(-n); }
      S.net.emit('pub', pub);
      G.players.forEach(function (p, i) {
        if (!p.bot && p.pid !== S.pid) S.net.emit('hand', { to: p.pid, h: BB.packHand(G, i) });
      });
      store.set('hostGame', { code: S.code, lobby: S.lobby, G: G });
    }
    if (silent) return;
    var prev = S.V && S.V.phase;
    S.V = BB.view(G, myIdx());
    S.deadline = G.deadline;
    S.log = G.log.slice();
    afterState(prev);
    render();
    runBots();
  }
  function afterState(prevPhase) {
    var V = S.V;
    if (!V) return;
    if (V.phase !== prevPhase && (V.phase === 'won' || V.phase === 'lost')) {
      if (V.phase === 'won' && S.cleared.indexOf(V.mid) < 0) { S.cleared.push(V.mid); store.set('cleared', S.cleared); }
      S.sel = null;
    }
    if (V.lastAct && V.lastAct.t === 'boom') document.body.classList.add('shake');
    setTimeout(function () { document.body.classList.remove('shake'); }, 700);
    if (V.turn !== myIdx() && S.sel && S.sel.mode !== 'eq') S.sel = null;
  }

  var botT = null;
  function runBots() {
    clearTimeout(botT);
    var G = S.G;
    if (!G || G.phase === 'won' || G.phase === 'lost') return;
    var who = -1, delay = 900;
    G.players.forEach(function (p, i) {
      if (who >= 0 || !p.bot) return;
      if (G.phase === 'setup' && G.setup[i] < G.infoN) { who = i; delay = 250; }
      else if (G.phase === 'play' && G.pending && G.pending.to === i) { who = i; delay = 700; }
    });
    if (who < 0 && G.phase === 'play' && !G.pending && G.players[G.turn].bot) who = G.turn;
    if (who < 0) return;
    botT = setTimeout(function () {
      if (S.G !== G) return;
      var a = Bot.decide(G, who);
      if (!a) return;
      var err = BB.act(G, who, a);
      if (err) console.warn('bot', err, a);
      hostSync();
    }, delay);
  }
  setInterval(function () {
    var G = S.G;
    if (isHost() && G && G.phase === 'play' && G.deadline && Date.now() > G.deadline) {
      BB.act(G, G.turn, { a: 'timeout' });
      hostSync();
    }
    var t = $('#timer');
    if (t && S.deadline && S.V && S.V.phase === 'play') {
      var s = Math.max(0, Math.ceil((S.deadline - Date.now()) / 1000));
      t.textContent = '⏱ ' + s + 's'; t.classList.toggle('hot', s <= 10);
    }
  }, 250);

  /* ---------- 发出动作 ---------- */
  function doAct(a) {
    if (isHost()) {
      var err = BB.act(S.G, myIdx(), a);
      if (err) { toast(err, 'bad'); return; }
      S.sel = null;
      hostSync();
    } else if (S.net) {
      S.net.emit('act', { pid: S.pid, a: a });
      S.sel = null; render();
    }
  }
  function onChat(d) {
    if (!d || !d.text) return;
    S.chat.push({ name: String(d.name || '').slice(0, 12), text: String(d.text).slice(0, 200), t: Date.now() });
    if (S.chat.length > 100) S.chat.shift();
    renderChat();
  }
  function sendChat(text) {
    text = text.trim().slice(0, 200);
    if (!text) return;
    var V = S.V;
    if (V && V.phase !== 'won' && V.phase !== 'lost' && mission(V.mid).rules.noChat) { toast('本关禁止聊天', 'bad'); return; }
    var d = { pid: S.pid, name: S.name, text: text };
    if (S.mode === 'solo') onChat(d);
    else if (S.net) S.net.emit('chat', d);
  }

  function leaveNet() {
    if (S.net) { try { S.net.leave(); } catch (e) {} }
    S.net = null;
  }
  function quit() {
    leaveNet();
    clearTimeout(botT);
    if (S.mode === 'host') store.set('hostGame', null);
    S.mode = null; S.G = null; S.V = null; S.lobby = null; S.pub = null; S.hand = null; S.log = []; S.chat = []; S.code = null;
    store.set('lastRoom', null);
    go('home');
  }

  /* ---------- 大厅 ---------- */
  function renderLobby() {
    var L = S.lobby, el = $('#scr-lobby');
    if (!L) {
      el.innerHTML = '<div class="panel center"><p class="big">' + (S.joining ? '正在连接房间 ' + esc(S.code || '') + ' …' : '没有进入任何房间。') + '</p><button class="btn ghost" data-act="quit">返回首页</button></div>';
      return;
    }
    var host = isHost();
    var m = mission(L.mid);
    var seats = L.seats.map(function (s, i) {
      return '<li class="seat' + (s.pid === S.pid ? ' me' : '') + '"><span class="seat-n">' + (i + 1) + '</span><span class="seat-name">' + esc(s.name) + (s.pid === S.pid ? '<em>（你）</em>' : '') + '</span>' +
        (i === 0 ? '<span class="tag">队长</span>' : '') + (s.bot ? '<span class="tag bot">AI</span>' : '') +
        (host && s.pid !== S.pid ? '<button class="btn tiny ghost" data-act="kick" data-i="' + i + '">移除</button>' : '') + '</li>';
    }).join('');
    var opts = '';
    var tier = '';
    MISSIONS.forEach(function (x) {
      if (x.tier !== tier) { if (tier) opts += '</optgroup>'; tier = x.tier; opts += '<optgroup label="' + tier + '">'; }
      opts += '<option value="' + x.id + '"' + (x.id === L.mid ? ' selected' : '') + '>' + x.id + '. ' + esc(x.name) + (S.cleared.indexOf(x.id) >= 0 ? ' ✓' : '') + '</option>';
    });
    opts += '</optgroup>';
    var n = L.seats.length;
    el.innerHTML =
      '<div class="lobby">' +
      '<section class="panel">' +
      (S.mode === 'solo' ? '<p class="eyebrow">单人练习</p><h2>组建你的拆弹小队</h2><p class="muted">你和 AI 队友一起拆弹。AI 只会用它能看到的信息推理。</p>'
        : '<p class="eyebrow">联机房间</p><h2 class="code-line">房间码 <span class="code">' + esc(L.code) + '</span> <button class="btn tiny ghost" data-act="copy">复制</button></h2><p class="muted">好友在首页输入这个房间码即可加入，最多 5 人。' + (S.hostGone ? ' <b class="bad-t">房主已断开，等待重连…</b>' : '') + '</p>') +
      '<ol class="seats">' + seats + '</ol>' +
      (host ? '<div class="row"><button class="btn small" data-act="addbot"' + (n >= 5 ? ' disabled' : '') + '>＋ 加入 AI 队友</button><span class="muted small-t">人数：' + n + ' / 5（至少 2 人）</span></div>' : '<p class="muted">等待房主选择任务并开始…</p>') +
      '</section>' +
      '<section class="panel">' +
      '<p class="eyebrow">任务选择</p>' +
      (host ? '<label class="lbl-t" for="msel">任务（共 66 关）</label><select id="msel">' + opts + '</select>' : '') +
      '<div class="mcard"><div class="mcard-h"><span class="mnum">' + m.id + '</span><div><h3>' + esc(m.name) + '</h3><p class="muted small-t">' + m.tier + (S.cleared.indexOf(m.id) >= 0 ? ' · 已通关' : '') + '</p></div></div>' +
      '<p>' + esc(m.brief) + '</p><div class="chips">' + ruleChips(m) + '</div>' +
      '<p class="muted small-t">本局 ' + n + ' 人：' + (n === 2 ? '每人 2 排线，' : '') + '引爆器容错 ' + (Math.max(1, (n === 2 ? 3 : n + 1) + (m.det || 0)) - 1) + ' 次。</p></div>' +
      (host ? '<button class="btn primary wide" data-act="start"' + (n < 2 ? ' disabled' : '') + '>开始任务</button>' : '') +
      '</section>' +
      '</div>';
  }

  function hostStart() {
    var L = S.lobby;
    if (L.seats.length < 2) { toast('至少需要 2 名玩家（可以加 AI 队友）', 'bad'); return; }
    S.G = BB.createGame(mission(L.mid), L.seats);
    S.log = []; S.sel = null;
    L.started = true;
    emitLobby();
    hostSync();
    go('game');
  }

  /* ---------- 牌桌 ---------- */
  function renderGame() {
    var V = S.V, el = $('#scr-game');
    if (!V) {
      el.innerHTML = '<div class="panel center"><p class="big">等待房主同步牌桌…</p></div>';
      return;
    }
    if (!$('#g-main', el)) {
      el.innerHTML =
        '<div class="game"><div id="g-main" class="g-main"></div>' +
        '<aside class="g-side"><div class="panel side-panel"><h4>行动记录</h4><ol id="g-log" class="log"></ol></div>' +
        '<div class="panel side-panel"><h4>队内通讯</h4><div id="g-chat" class="chat"></div>' +
        '<form id="chatf" class="chatf"><input id="chatin" maxlength="200" autocomplete="off" placeholder="说点什么（不要直接报出自己的线）"><button class="btn small">发送</button></form></div></aside></div>';
    }
    var m = mission(V.mid), me = myIdx(), over = V.phase === 'won' || V.phase === 'lost';
    var turnP = V.players[V.turn];
    var main = $('#g-main');
    var turnTxt = (V.phase === 'setup' ? '<b>布置阶段</b>' : over ? '<b>' + (V.phase === 'won' ? '任务成功' : '任务失败') + '</b>' :
        '第 ' + V.turnNo + (V.turnLimit ? ' / ' + V.turnLimit : '') + ' 回合 · 轮到 <b>' + esc(turnP.name) + '</b>' + (V.turn === me ? '（你）' : '')) +
      (V.deadline && V.phase === 'play' ? ' <span id="timer" class="timer"></span>' : '') + (V.stab ? ' <span class="tag">稳定器已启动</span>' : '');
    var viewBtn = '<button class="btn tiny ghost" data-act="view">' + (S.view3d ? '切换平面视图' : '切换 3D 牌桌') + '</button>';
    var banners = (S.hostGone ? '<div class="banner bad">房主连接中断。房主重新进入同一房间后会自动恢复牌局。</div>' : '') + (over ? endBanner(V) : '');
    if (S.view3d) {
      if (main.dataset.mode !== '3d') {
        main.dataset.mode = '3d';
        main.innerHTML = '<section id="g-hud" class="panel hud3"></section><div id="g-ban"></div><div id="g-stage" class="stage3"></div><section id="g-con" class="panel console3"></section>';
      }
      $('#g-hud').innerHTML = '<div class="hud-l"><span class="eyebrow">任务 ' + m.id + ' · ' + m.tier + '</span><h2>' + esc(m.name) + '</h2><div class="chips">' + ruleChips(m) + '</div></div>' +
        '<div class="hud-r"><span class="turnline">' + turnTxt + '</span><span class="tag' + (V.det >= V.detMax - 1 ? ' warn' : '') + '">失误 ' + V.det + ' / ' + V.detMax + '</span>' + viewBtn + '</div>';
      $('#g-ban').innerHTML = banners;
      Table3D.render($('#g-stage'), V, {
        me: me, sel: S.sel, mission: m, dd: m.dd,
        clickable: function (w, o) { return clickable(V, w, o, me); },
        countCut: function (v) { return countCut(V, v); },
        equipState: function (e) { return equipStatus(V, me, e); }
      });
      $('#g-con').innerHTML = me >= 0 ? actionPanel(V, me) : '<p class="muted">你正在观战。</p>';
      renderLog();
      renderChat();
      chatLock(over, m);
      return;
    }
    main.dataset.mode = '2d';
    var h = '';
    // HUD
    h += '<section class="hud panel' + (over ? (V.phase === 'won' ? ' won' : ' lost') : '') + '">' +
      '<div class="hud-l"><p class="eyebrow">任务 ' + m.id + ' · ' + m.tier + '</p><h2>' + esc(m.name) + '</h2><div class="chips">' + ruleChips(m) + '</div></div>' +
      '<div class="hud-r">' + detonator(V) + '<div class="turnline">' + turnTxt + '</div>' + viewBtn + '</div></section>';
    h += banners;
    // 公共信息
    h += '<section class="panel boardinfo">' + track(V, m) + markers(V) + equipRow(V, me) + '</section>';
    // 其他玩家
    h += '<section class="table">';
    V.players.forEach(function (p, i) { if (i !== me) h += playerBlock(V, p, i, me); });
    h += '</section>';
    // 自己
    if (me >= 0) h += '<section class="panel mine-zone">' + playerBlock(V, V.players[me], me, me, true) + actionPanel(V, me) + '</section>';
    else h += '<section class="panel"><p class="muted">你正在观战。</p></section>';
    main.innerHTML = h;
    renderLog();
    renderChat();
    chatLock(over, m);
  }
  function chatLock(over, m) {
    var ci = $('#chatin');
    var blocked = !over && m.rules.noChat;
    ci.disabled = blocked; ci.placeholder = blocked ? '本关禁止聊天' : '说点什么（不要直接报出自己的线）';
  }
  function equipStatus(V, me, e) {
    var d = BB.EQUIP[e.n];
    var myTurn = V.turn === me && V.phase === 'play' && !V.pending;
    var usable = me >= 0 && e.open && !e.used && V.phase === 'play' && !V.pending && (d.any || myTurn);
    return { usable: usable, label: e.used ? '已使用' : e.open ? (usable || d.any ? '可使用' : '仅限自己回合') : '剪掉 2 根 ' + e.n + ' 解锁' };
  }
  function detonator(V) {
    var cells = '';
    for (var i = 0; i < V.detMax; i++) {
      var last = i === V.detMax - 1;
      cells += '<span class="det-c' + (i < V.det ? ' on' : '') + (last ? ' skull' : '') + '">' + (last ? '☠' : '') + '</span>';
    }
    return '<div class="det" title="引爆器：已失误 ' + V.det + ' 次，第 ' + V.detMax + ' 次失误时爆炸"><span class="det-l">引爆器</span>' + cells + '<span class="det-n">失误 ' + V.det + ' / ' + V.detMax + '</span></div>';
  }
  function countCut(V, val) {
    var c = 0;
    V.players.forEach(function (p) { p.stands.forEach(function (st) { st.forEach(function (w) { if (w.cut && w.v != null && BB.annOf(w.v) === val) c++; }); }); });
    return c;
  }
  function track(V, m) {
    var h = '<div class="track"><span class="sub-l">剪线进度</span>';
    for (var v = m.blue[0]; v <= m.blue[1]; v++) {
      var c = countCut(V, v), si = V.seq.indexOf(v);
      var pips = '';
      for (var k = 0; k < 4; k++) pips += '<i class="' + (k < c ? 'on' : '') + '"></i>';
      h += '<span class="tr' + (c >= 4 ? ' done' : '') + (V.missing === v ? ' miss' : '') + '" title="数值 ' + v + '：已剪 ' + c + ' 根">' +
        (si >= 0 ? '<sup class="seqn">' + (si + 1) + '</sup>' : '') + '<b>' + v + '</b><span class="pips">' + pips + '</span></span>';
    }
    h += '</div>';
    if (V.seq.length) h += '<p class="muted small-t">顺序引信：' + V.seq.join(' → ') + '（必须先剪完前一个数值的全部线）</p>';
    if (V.missing) h += '<p class="muted small-t">本局缺失的数值是 <b>' + V.missing + '</b>。</p>';
    return h;
  }
  function markers(V) {
    function one(mk, cls, nm) {
      if (!mk.n && !mk.cand.length) return '';
      var cand = mk.cand.length ? mk.cand.map(function (c) { return '<span class="mk ' + cls + '">' + c.toFixed(1) + '</span>'; }).join('') : '<span class="muted">位置未公开</span>';
      return '<div class="mkrow"><span class="sub-l">' + nm + ' ' + mk.n + (mk.cand.length > mk.n ? '（' + mk.cand.length + ' 选 ' + mk.n + '）' : ' 根') + '</span>' + cand + '</div>';
    }
    var h = one(V.ymark, 'y', '黄线') + one(V.rmark, 'r', '红线');
    if (V.radar) h += '<div class="mkrow"><span class="sub-l">雷达「' + BB.valLabel(V.radar.val) + '」</span>' + V.players.map(function (p, i) { return '<span class="tag' + (V.radar.res[i] ? ' yes' : '') + '">' + esc(p.name) + (V.radar.res[i] ? ' 有' : ' 无') + '</span>'; }).join('') + '</div>';
    return h ? '<div class="markers">' + h + '</div>' : '';
  }
  function equipRow(V, me) {
    if (!V.equip.length) return '';
    return '<div class="equips"><span class="sub-l">装备</span>' + V.equip.map(function (e) {
      var d = BB.EQUIP[e.n];
      var es = equipStatus(V, me, e), usable = es.usable, st = es.label;
      var on = S.sel && S.sel.mode === 'eq' && S.sel.n === e.n;
      return '<button class="eq' + (e.used ? ' used' : e.open ? ' open' : '') + (on ? ' on' : '') + '" data-act="eq" data-n="' + e.n + '"' + (usable ? '' : ' disabled') + ' title="' + esc(d.desc) + '">' +
        '<span class="eq-n">' + e.n + '</span><span class="eq-t">' + d.name + '</span><span class="eq-s">' + st + '</span></button>';
    }).join('') + '</div>';
  }
  function endBanner(V) {
    var r = V.result || {};
    var host = isHost();
    var m = mission(V.mid);
    return '<div class="banner ' + (r.win ? 'good' : 'bad') + '"><div><b class="big">' + (r.win ? '拆弹成功！' : '炸弹爆炸！') + '</b><p>' + esc(r.why || '') + '</p></div>' +
      (host ? '<div class="row"><button class="btn small" data-act="again">再来一次</button>' + (m.id < 66 ? '<button class="btn small primary" data-act="nextm">下一关：' + (m.id + 1) + '. ' + esc(mission(m.id + 1).name) + '</button>' : '') + '<button class="btn small ghost" data-act="tolobby">回到大厅</button></div>' : '<p class="muted">等待房主选择下一步…</p>') + '</div>';
  }
  function playerBlock(V, p, i, me, mine) {
    var sel = S.sel || {};
    var turn = V.turn === i && V.phase === 'play';
    var left = 0;
    p.stands.forEach(function (st) { st.forEach(function (w) { if (!w.cut) left++; }); });
    var h = '<div class="pblock' + (turn ? ' turn' : '') + (mine ? ' mine' : '') + '">' +
      '<div class="ph"><span class="pname">' + esc(p.name) + (mine ? '（你）' : '') + '</span>' + (p.bot ? '<span class="tag bot">AI</span>' : '') +
      (i === 0 ? '<span class="tag">队长</span>' : '') +
      (mission(V.mid).dd ? '<span class="tag' + (p.dd ? ' yes' : ' off') + '" title="角色卡：双重探测器">双探 ' + (p.dd ? '可用' : '已用') + '</span>' : '') +
      '<span class="muted small-t">剩 ' + left + ' 根</span>' +
      (V.phase === 'setup' ? '<span class="tag' + (V.setup[i] >= V.infoN ? ' yes' : '') + '">' + (V.setup[i] >= V.infoN ? '已布置' : '布置中') + '</span>' : '') +
      (V.pending && V.pending.to === i ? '<span class="tag warn">选择交换中</span>' : '') +
      '</div>';
    p.stands.forEach(function (st, si) {
      h += '<div class="stand-wrap"><div class="stand">';
      st.forEach(function (w, k) {
        h += tile(V, w, i, si, me, sel);
        var nx = st[k + 1];
        if (nx) V.labels.forEach(function (l) {
          if ((l.a === w.id && l.b === nx.id) || (l.b === w.id && l.a === nx.id)) h += '<span class="lbl-mk">' + (l.t === 'eq' ? '=' : '≠') + '</span>';
        });
      });
      h += '</div></div>';
    });
    return h + '</div>';
  }
  function tile(V, w, o, s, me, sel) {
    var k = w.v != null ? BB.kindOf(w.v) : null;
    var cls = 'tile';
    if (k) cls += ' k-' + k;
    if (w.v == null) cls += ' back';
    if (w.cut) cls += ' cut';
    if (sel.wires && sel.wires.indexOf(w.id) >= 0) cls += ' sel';
    if (V.lastAct && V.lastAct.ids.indexOf(w.id) >= 0) cls += ' flash-' + V.lastAct.t;
    var click = clickable(V, w, o, me);
    if (click) cls += ' can';
    var label = w.v != null ? fmtV(w.v) : '';
    return '<button class="' + cls + '"' + (click ? '' : ' tabindex="-1"') + ' data-w="' + w.id + '" data-o="' + o + '" data-s="' + s + '" aria-label="' + (w.v != null ? '线 ' + label : '未知的线') + (w.cut ? '（已剪）' : '') + '">' +
      (w.info ? '<span class="tok">' + esc(infoTxt(w.info)) + '</span>' : '') +
      '<span class="tv">' + label + '</span>' + (w.cut ? '<span class="snip">✂</span>' : '') + '</button>';
  }
  function clickable(V, w, o, me) {
    if (w.cut || me < 0) return false;
    if (V.phase === 'setup') return o === me && V.setup[me] < V.infoN && BB.kindOf(w.v) === 'b' && !w.info;
    if (V.phase !== 'play') return false;
    if (V.pending) return V.pending.to === me && o === me;
    var sel = S.sel;
    if (sel && sel.mode === 'eq') {
      var n = sel.n;
      if (n === 1 || n === 12 || n === 2) return o === me;
      if (n === 4) return o === me && BB.kindOf(w.v) === 'b' && !w.info;
      if (n === 3 || n === 5 || n === 10) return o !== me;
      return false;
    }
    return V.turn === me && o !== me;
  }

  function myVals(V, me) {
    var vals = [];
    V.players[me].stands.forEach(function (st) { st.forEach(function (w) { if (!w.cut && w.v != null) { var a = BB.annOf(w.v); if (a !== 'R' && vals.indexOf(a) < 0) vals.push(a); } }); });
    return vals.sort(function (a, b) { return (a === 'Y' ? 99 : a) - (b === 'Y' ? 99 : b); });
  }
  function seqOk(V, val) {
    if (!V.seq.length || val === 'Y') return true;
    var i = V.seq.indexOf(val);
    if (i <= 0) return true;
    return countCut(V, V.seq[i - 1]) >= 4 && seqOk(V, V.seq[i - 1]);
  }
  function valBtns(V, me, opts) {
    opts = opts || {};
    var vals = opts.all ? range(mission(V.mid)).concat(['Y']) : myVals(V, me);
    return '<div class="vals">' + vals.map(function (v) {
      var ok = opts.all || seqOk(V, v);
      var on = opts.picked && opts.picked.indexOf(v) >= 0;
      return '<button class="vbtn' + (v === 'Y' ? ' y' : '') + (on ? ' on' : '') + '" data-act="val" data-v="' + v + '"' + (ok && opts.enabled !== false ? '' : ' disabled') + '>' + (v === 'Y' ? '黄' : v) + '</button>';
    }).join('') + '</div>';
  }
  function range(m) { var a = []; for (var v = m.blue[0]; v <= m.blue[1]; v++) a.push(v); return a; }

  function actionPanel(V, me) {
    var P = V.players[me], h = '<div class="act">';
    var over = V.phase === 'won' || V.phase === 'lost';
    if (over) return h + '<p class="muted">所有线已公开，看看炸弹的真实结构吧。</p></div>';
    if (V.phase === 'setup') {
      var need = V.infoN - V.setup[me];
      if (need > 0) return h + '<p class="step"><b>布置阶段：</b>点击你自己的一根<b class="blue-t">蓝线</b>，在它前面放一个公开的信息标记' + (mission(V.mid).info === 'parity' ? '（只显示奇/偶）' : '') + '。还需放 ' + need + ' 个。</p></div>';
      return h + '<p class="muted">你已布置完毕，等待其他队友…</p></div>';
    }
    if (V.pending) {
      if (V.pending.to === me) return h + '<p class="step"><b>' + esc(V.players[V.pending.from].name) + '</b> 用对讲机找你交换：点击你自己的一根线交给对方。</p></div>';
      return h + '<p class="muted">等待 ' + esc(V.players[V.pending.to].name) + ' 选择交换的线…</p></div>';
    }
    var sel = S.sel;
    if (sel && sel.mode === 'eq') return h + equipPanel(V, me, sel) + '</div>';
    if (V.turn !== me) return h + '<p class="muted">等待 <b>' + esc(V.players[V.turn].name) + '</b> 行动。你可以随时使用标注“可使用”的装备。</p></div>';

    var mode = sel && sel.mode === 'dd' ? 'dd' : 'dual';
    var mineLeft = [];
    P.stands.forEach(function (st) { st.forEach(function (w) { if (!w.cut) mineLeft.push(w); }); });
    var allRed = mineLeft.length && mineLeft.every(function (w) { return BB.kindOf(w.v) === 'r'; });
    h += '<div class="tabs"><button class="tab' + (mode === 'dual' ? ' on' : '') + '" data-act="mode" data-m="dual">双人剪</button>' +
      (P.dd ? '<button class="tab' + (mode === 'dd' ? ' on' : '') + '" data-act="mode" data-m="dd">双重探测器（一次性）</button>' : '') + '</div>';
    var tw = (sel && sel.wires) || [];
    if (allRed) {
      h += '<p class="step">你剩下的全是红线。</p><button class="btn primary" data-act="red">公开我的红线</button>';
    } else if (mode === 'dual') {
      h += '<p class="step">' + (tw.length ? '<b>第 2 步：</b>宣告这根线的数值（你必须也持有它）' : '<b>第 1 步：</b>点击一名队友的一根未剪的线') + '</p>' + valBtns(V, me, { enabled: tw.length === 1 });
    } else {
      h += '<p class="step">' + (tw.length < 2 ? '<b>第 1 步：</b>选择同一名队友同一排的 <b>2</b> 根线（已选 ' + tw.length + '）' : '<b>第 2 步：</b>宣告数值，两根中有一根是它就成功') + '</p>' + valBtns(V, me, { enabled: tw.length === 2 });
    }
    // 单人剪
    var solos = myVals(V, me).filter(function (v) { return soloPossible(V, me, v); });
    if (solos.length) h += '<div class="solo"><span class="sub-l">单人剪</span>' + solos.map(function (v) { return '<button class="btn small" data-act="solo" data-v="' + v + '">剪掉我全部的 ' + BB.valLabel(v) + '</button>'; }).join('') + '</div>';
    return h + '</div>';
  }
  function soloPossible(V, me, v) {
    if (!seqOk(V, v)) return false;
    var mine = 0, cut = countCut(V, v);
    V.players[me].stands.forEach(function (st) { st.forEach(function (w) { if (!w.cut && BB.annOf(w.v) === v) mine++; }); });
    var total = v === 'Y' ? V.ymark.n : 4;
    return mine > 0 && mine === total - cut;
  }
  function equipPanel(V, me, sel) {
    var d = BB.EQUIP[sel.n], n = sel.n, h = '<p class="step"><b>' + d.name + '：</b>' + esc(d.desc) + '</p>';
    var tw = sel.wires || [];
    if (n === 3) h += '<p class="muted">已选 ' + tw.length + ' / 3 根（同一名队友）。</p>' + valBtns(V, me, { enabled: tw.length === 3 });
    else if (n === 5) h += '<p class="muted">' + (tw.length ? '已选中整排。' : '点击队友某一排中的任意一根线。') + '</p>' + valBtns(V, me, { enabled: tw.length > 0 });
    else if (n === 10) h += '<p class="muted">' + (tw.length ? '再选两个数值。' : '先点击队友的一根线。') + '</p>' + valBtns(V, me, { enabled: tw.length === 1, picked: sel.vals }) +
      '<button class="btn primary small" data-act="eqgo"' + (tw.length === 1 && sel.vals.length === 2 ? '' : ' disabled') + '>扫描</button>';
    else if (n === 1 || n === 12) h += '<p class="muted">选择你自己相邻的两根线（已选 ' + tw.length + '）。</p><button class="btn primary small" data-act="eqgo"' + (tw.length === 2 ? '' : ' disabled') + '>放置标签</button>';
    else if (n === 4) h += '<p class="muted">选择你自己一根没有标记的蓝线。</p><button class="btn primary small" data-act="eqgo"' + (tw.length === 1 ? '' : ' disabled') + '>贴上</button>';
    else if (n === 8) h += valBtns(V, me, { all: true });
    else if (n === 2 || n === 11) {
      if (n === 2) h += '<p class="muted">' + (tw.length ? '已选你的线，现在选择交换对象：' : '先点击你自己的一根线，再选择交换对象：') + '</p>';
      h += '<div class="row">' + V.players.map(function (p, i) {
        var has = p.stands.some(function (st) { return st.some(function (w) { return !w.cut; }); });
        return i === me || !has ? '' : '<button class="btn small" data-act="eqp" data-p="' + i + '"' + (n === 2 && !tw.length ? ' disabled' : '') + '>' + esc(p.name) + '</button>';
      }).join('') + '</div>';
    }
    return h + '<button class="btn ghost small" data-act="eqcancel">取消</button>';
  }

  function renderLog() {
    var el = $('#g-log');
    if (!el) return;
    el.innerHTML = S.log.slice(-60).map(function (e) { return '<li class="lg ' + e.k + '">' + esc(e.t) + '</li>'; }).join('');
    el.scrollTop = el.scrollHeight;
  }
  function renderChat() {
    var el = $('#g-chat');
    if (!el) return;
    el.innerHTML = S.chat.length ? S.chat.map(function (c) { return '<p><b>' + esc(c.name) + '：</b>' + esc(c.text) + '</p>'; }).join('') : '<p class="muted">还没有消息。</p>';
    el.scrollTop = el.scrollHeight;
  }

  /* ---------- 关卡列表 ---------- */
  function renderMissions() {
    var el = $('#mlist'), tier = '', h = '';
    MISSIONS.forEach(function (m) {
      if (m.tier !== tier) { if (tier) h += '</div>'; tier = m.tier; h += '<h3 class="tier-h">' + tier + '</h3><div class="mgrid">'; }
      var done = S.cleared.indexOf(m.id) >= 0;
      h += '<article class="mitem' + (done ? ' done' : '') + '"><div class="mcard-h"><span class="mnum">' + m.id + '</span><div><h4>' + esc(m.name) + '</h4>' + (done ? '<span class="tag yes">已通关</span>' : '') + '</div></div><p>' + esc(m.brief) + '</p><div class="chips">' + ruleChips(m) + '</div></article>';
    });
    el.innerHTML = h + '</div>';
    $('#mprog').textContent = '已通关 ' + S.cleared.length + ' / 66';
  }

  /* ---------- 事件 ---------- */
  document.addEventListener('click', function (ev) {
    var b = ev.target.closest('[data-go],[data-act],.tile,.slot[data-w]');
    if (!b) return;
    if (b.dataset.go) {
      var g = b.dataset.go;
      if (g === 'home' && S.mode) g = S.lobby && S.lobby.started ? 'game' : 'lobby';
      go(g); return;
    }
    if (b.dataset.w !== undefined) { onTile(+b.dataset.w, +b.dataset.o, +b.dataset.s); return; }
    var a = b.dataset.act, V = S.V, me = myIdx();
    switch (a) {
      case 'solo-start': startSolo(); break;
      case 'host': hostCreate(); break;
      case 'join': guestJoin($('#jcode').value); break;
      case 'resume': go(S.lobby && S.lobby.started ? 'game' : 'lobby'); break;
      case 'quit': quit(); break;
      case 'rejoin': {
        var last = store.get('lastRoom', null);
        if (!last) break;
        if (last.host) { var hg = store.get('hostGame', null); hostCreate(last.code, hg && hg.code === last.code ? hg : null); }
        else guestJoin(last.code);
        break;
      }
      case 'forget': store.set('lastRoom', null); store.set('hostGame', null); renderHome(); break;
      case 'copy':
        try { navigator.clipboard.writeText(S.code).then(function () { toast('已复制房间码'); }, function () { toast('房间码：' + S.code); }); } catch (e) { toast('房间码：' + S.code); }
        break;
      case 'addbot': {
        var used = S.lobby.seats.filter(function (s) { return s.bot; }).length;
        if (S.lobby.seats.length < 5) S.lobby.seats.push(bot(used));
        emitLobby(); render(); break;
      }
      case 'kick': S.lobby.seats.splice(+b.dataset.i, 1); emitLobby(); render(); break;
      case 'start': hostStart(); break;
      case 'again': hostStart(); break;
      case 'nextm': S.lobby.mid = Math.min(66, V.mid + 1); hostStart(); break;
      case 'tolobby': S.lobby.started = false; S.G = null; S.V = null; emitLobby(); go('lobby'); break;
      case 'view': S.view3d = !S.view3d; store.set('view3d', S.view3d); render(); break;
      case 'mode': S.sel = b.dataset.m === 'dd' ? { mode: 'dd', wires: [] } : null; render(); break;
      case 'red': doAct({ a: 'red' }); break;
      case 'solo': doAct({ a: 'solo', val: parseVal(b.dataset.v) }); break;
      case 'val': onVal(parseVal(b.dataset.v)); break;
      case 'eq': {
        var n = +b.dataset.n;
        if (n === 6 || n === 7 || n === 9) { doAct({ a: 'equip', n: n }); break; }
        S.sel = S.sel && S.sel.mode === 'eq' && S.sel.n === n ? null : { mode: 'eq', n: n, wires: [], vals: [] };
        render(); break;
      }
      case 'eqcancel': S.sel = null; render(); break;
      case 'eqp': {
        var sel = S.sel, p = +b.dataset.p;
        if (sel.n === 2) doAct({ a: 'equip', n: 2, w: sel.wires[0], p: p });
        else doAct({ a: 'equip', n: 11, p: p });
        break;
      }
      case 'eqgo': {
        var s2 = S.sel;
        if (s2.n === 10) doAct({ a: 'equip', n: 10, w: s2.wires[0], vals: s2.vals });
        if (s2.n === 1 || s2.n === 12) doAct({ a: 'equip', n: s2.n, w1: s2.wires[0], w2: s2.wires[1] });
        if (s2.n === 4) doAct({ a: 'equip', n: 4, w: s2.wires[0] });
        break;
      }
    }
  });
  function parseVal(v) { return v === 'Y' ? 'Y' : +v; }
  function wireOf(V, id) {
    var f = null;
    V.players.forEach(function (p, o) { p.stands.forEach(function (st, s) { st.forEach(function (w) { if (w.id === id) f = { w: w, o: o, s: s, st: st }; }); }); });
    return f;
  }
  function onTile(id, o, s) {
    var V = S.V, me = myIdx();
    if (!V || me < 0) return;
    var W = wireOf(V, id);
    if (!W || !clickable(V, W.w, o, me)) return;
    if (V.phase === 'setup') { doAct({ a: 'info', w: id }); return; }
    if (V.pending && V.pending.to === me) { doAct({ a: 'walkie', w: id }); return; }
    var sel = S.sel || { mode: 'dual', wires: [] };
    var ws = sel.wires || [];
    function sameGroup(list, needStand) {
      return list.every(function (x) { var X = wireOf(V, x); return X.o === o && (!needStand || X.s === s); });
    }
    if (sel.mode === 'dual') ws = ws[0] === id ? [] : [id];
    else if (sel.mode === 'dd' || (sel.mode === 'eq' && (sel.n === 3 || sel.n === 1 || sel.n === 12))) {
      var lim = sel.mode === 'dd' || sel.n !== 3 ? 2 : 3;
      if (ws.indexOf(id) >= 0) ws = ws.filter(function (x) { return x !== id; });
      else { if (!sameGroup(ws, sel.mode === 'dd' || sel.n !== 3)) ws = []; ws = ws.concat([id]).slice(-lim); }
    } else if (sel.mode === 'eq' && sel.n === 5) ws = W.st.filter(function (w) { return !w.cut; }).map(function (w) { return w.id; });
    else ws = ws[0] === id ? [] : [id];
    sel.wires = ws;
    S.sel = sel;
    render();
  }
  function onVal(val) {
    var sel = S.sel || { mode: 'dual', wires: [] }, ws = sel.wires || [];
    if (sel.mode === 'dual' && ws.length === 1) doAct({ a: 'dual', w: ws[0], val: val });
    else if (sel.mode === 'dd' && ws.length === 2) doAct({ a: 'dd', ws: ws, val: val });
    else if (sel.mode === 'eq') {
      if (sel.n === 3 && ws.length === 3) doAct({ a: 'equip', n: 3, ws: ws, val: val });
      else if (sel.n === 5 && ws.length) { var W = wireOf(S.V, ws[0]); doAct({ a: 'equip', n: 5, p: W.o, s: W.s, val: val }); }
      else if (sel.n === 8) doAct({ a: 'equip', n: 8, val: val });
      else if (sel.n === 10) {
        var i = sel.vals.indexOf(val);
        if (i >= 0) sel.vals.splice(i, 1); else sel.vals = sel.vals.concat([val]).slice(-2);
        render();
      }
    }
  }
  document.addEventListener('change', function (ev) {
    if (ev.target.id === 'msel') { S.lobby.mid = +ev.target.value; emitLobby(); render(); }
  });
  document.addEventListener('submit', function (ev) {
    ev.preventDefault();
    if (ev.target.id === 'chatf') { var i = $('#chatin'); sendChat(i.value); i.value = ''; }
    if (ev.target.id === 'joinf') guestJoin($('#jcode').value);
  });
  document.addEventListener('keydown', function (ev) {
    if (ev.key === 'Escape' && S.sel) { S.sel = null; render(); }
    var sl = ev.target.closest && ev.target.closest('.slot[data-w]');
    if (sl && (ev.key === 'Enter' || ev.key === ' ')) { ev.preventDefault(); onTile(+sl.dataset.w, +sl.dataset.o, +sl.dataset.s); }
  });
  var rzT = null;
  window.addEventListener('resize', function () {
    clearTimeout(rzT);
    rzT = setTimeout(function () { if (S.screen === 'game' && S.view3d && $('#g-stage')) { renderGame(); Table3D.fit($('#g-stage')); } }, 150);
  });

  render();
})();
