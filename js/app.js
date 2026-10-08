/* 炸弹克星 · 界面与联机流程（实体联机由 Node 服务器管理，自定义房间由房主管理） */
(function () {
  var BB = window.BB, Bot = window.BBBot, Net = window.BBNet, MISSIONS = window.BB_MISSIONS;
  var $ = function (s, el) { return (el || document).querySelector(s); };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  var store = {
    get: function (k, d) { try { var v = localStorage.getItem('bb_' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: function (k, v) { try { if (v === null) localStorage.removeItem('bb_' + k); else localStorage.setItem('bb_' + k, JSON.stringify(v)); } catch (e) {} }
  };
  function rid(n, abc) { var s = ''; abc = abc || 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; for (var i = 0; i < n; i++) s += abc[Math.floor(Math.random() * abc.length)]; return s; }

  var gameAudio = window.BB_AUDIO_PLAYER.create();
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
    cleared: store.get('cleared', []), clearedPhysical: store.get('clearedPhysicalV' + MISSIONS.OFFICIAL_VERSION, []), clearedCampaign: store.get('clearedCampaignV' + MISSIONS.CAMPAIGN_VERSION, []), catalog: store.get('catalog', 'campaign'), ruleset: store.get('ruleset', 'physical'), err: '', netKind: null, joining: false, view3d: store.get('view3d', true), choice: null,
    official: false, spectator: false, perspective: null, revision: 0, commandSeq: 0, cutNoticeKey: null, turnNoticeKey: null
  };
  if (!S.pid) { S.pid = rid(10, 'abcdefghijkmnpqrstuvwxyz23456789'); store.set('pid', S.pid); }

  /* ---------- 通用 ---------- */
  var toastT = null;
  function toast(msg, kind, duration) {
    var t = $('#toast');
    t.textContent = msg; t.className = 'toast show ' + (kind || '');
    clearTimeout(toastT); toastT = setTimeout(function () { t.className = 'toast'; }, duration || 2600);
  }
  function clearTurnToast() {
    var t = $('#toast');
    if (t.classList.contains('turn')) { clearTimeout(toastT); t.className = 'toast'; }
  }
  function mRuleset(lobby, id) { var entry = mission(id, lobby.catalog || lobby.ruleset); return entry && entry.ruleset || lobby.ruleset || 'custom'; }
  function mission(id, catalogId) { return MISSIONS.get(catalogId || (S.V && (S.V.catalog || S.V.ruleset)) || (S.lobby && (S.lobby.catalog || S.lobby.ruleset)) || S.catalog || S.ruleset, id); }
  function gameMission(V) { return V.mission || mission(V.mid, V.catalog || V.ruleset); }
  function catalog(catalogId) { return catalogId === 'campaign' ? MISSIONS.CAMPAIGN : catalogId === 'custom' ? MISSIONS : MISSIONS.PHYSICAL; }
  function cleared(catalogId) { return catalogId === 'campaign' ? S.clearedCampaign : catalogId === 'custom' ? S.cleared : S.clearedPhysical; }
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
  function infoMarkup(f){if(f&&f.t==='not'&&String(f.v).indexOf('/')>=0)return String(f.v).split('/').map(function(v){return '<span class="negative-value">'+esc('≠'+(v==='Y'?'黄':v))+'</span>';}).join('<span hidden>、</span>');return esc(infoTxt(f));}
  function infoTxt(f) {
    if (!f) return '';
    if (f.t === 'v') return f.copies > 1 ? Array(f.copies).fill(f.v).join('＋') : f.v; if (f.t === 'Y') return '黄';
    if (f.t === 'odd') return '奇'; if (f.t === 'even') return '偶';
    if (f.t === 'freq') return f.copies === 2 ? '×2＋×2' : '×' + f.v;
    if (f.t === 'not') return String(f.v).split('/').map(function(v){return '≠'+(v==='Y'?'黄':v);}).join('、'); return '';
  }
  function isHost() { return S.mode === 'host' || S.mode === 'solo'; }
  function officialOnline() { return S.official && (S.mode === 'host' || S.mode === 'guest'); }
  function canManageGame() { return officialOnline() ? !!S.lobby && S.lobby.host === S.pid : isHost(); }
  function officialCredential(code) { return (store.get('officialCredentials', {}) || {})[code] || null; }
  function onOfficialWelcome(d) {
    var sameIdentity = S.official && S.pid === d.pid && S.spectator === (d.role === 'spectator') && S.perspective === (d.perspective || null);
    var credentials = store.get('officialCredentials', {}) || {};
    credentials[S.code] = d.credential;
    store.set('officialCredentials', credentials);
    S.pid = d.pid;
    S.official = true;
    S.mode = d.host ? 'host' : 'guest';
    S.spectator = d.role === 'spectator'; S.perspective = d.perspective || null;
    if (!sameIdentity) S.sel = null;
    render();
  }
  function onOfficialLobby(d) {
    S.official = true; S.lobby = d; S.catalog = d.catalog || d.ruleset || 'campaign'; S.ruleset = d.ruleset || 'physical'; S.joining = false; S.hostGone = false;
    S.revision = d.revision;
    S.spectator = (d.observers || []).some(function (p) { return p.pid === S.pid; });
    store.set('lastRoom', { code: S.code, host: d.host === S.pid });
    if (!d.started) { S.G = null; S.V = null; S.sel = null; S.deadline = null; S.pub = null; S.hand = null; S.choice = null; }
    if (!d.started && S.screen === 'game') { go('lobby'); }
    else if (S.screen === 'home') go(d.started && S.V ? 'game' : 'lobby');
    else render();
  }
  function onOfficialView(d) {
    var previous = S.V && S.V.phase;
    if (S.V && S.V.gid !== d.view.gid) { S.sel = null; previous = null; }
    S.V = d.view; S.revision = d.revision; S.deadline = d.view.deadline;
    S.spectator = !!d.view.spectator; S.perspective = d.view.perspective || null;
    S.log = d.view.log || [];
    afterState(previous);
    if (S.screen !== 'game') go('game'); else render();
  }
  function wireOfficial(net) {
    net.on('official:welcome', function (m) { onOfficialWelcome(m.data); });
    net.on('official:lobby', function (m) { onOfficialLobby(m.data); });
    net.on('official:view', function (m) { onOfficialView(m.data); });
    net.on('official:error', function (m) { toast(m.data.msg, 'bad'); });
    net.on('transport:ready', function () {
      if (S.net !== net || !S.code) return;
      if (S.mode === 'host') net.emit('official:hello', { ruleset: 'campaign', catalog: 'campaign', mid: S.lobby.mid, name: S.name, credential: officialCredential(S.code) });
      else if (S.mode === 'guest' && S.official) net.emit('hello', { name: S.name, credential: officialCredential(S.code) });
    });
  }
  function myIdx() {
    if (officialOnline() && S.spectator) return -1;
    var ps = isHost() && S.G ? S.G.players : S.V ? S.V.players : [];
    for (var i = 0; i < ps.length; i++) if (ps[i].pid === S.pid) return i;
    return -1;
  }
  function nextMissionId(catalogId) {
    var list = catalog(catalogId), done = cleared(catalogId);
    for (var i = 0; i < list.length; i++) if (done.indexOf(list[i].id) < 0) return list[i].id;
    return list[0].id;
  }

  /* ---------- 路由 ---------- */
  function go(screen) {
    S.screen = screen; S.sel = null;
    render();
    window.scrollTo(0, 0);
  }
  function render() {
    if (!S.V) clearTurnToast();
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
    var savedPhysical = store.get('hostGame', null);
    if (savedPhysical && savedPhysical.G && savedPhysical.G.ruleset === 'physical') {
      back.hidden = false;
      back.innerHTML += '<button class="btn small ghost" data-act="legacy-resume">以单人练习继续旧版实体牌局</button>';
    }
    Net.probe().then(function (cap) {
      S.netKind = cap ? cap.kind : null;
      var n = $('#netnote');
      if (!cap) n.innerHTML = '当前打开方式不支持联机。请在 claude.ai 里打开本页（好友需被邀请并拥有“可互动”及以上权限），或运行自带的 Node 服务器。单人练习不受影响。';
      else if (cap.kind === 'claude') n.innerHTML = '联机通道：claude.ai 实时房间。把本页分享给好友（至少“可互动”权限），大家打开后输入同一个房间码即可。';
      else n.innerHTML = '联机通道：自建服务器。好友打开同一个网址，输入房间码即可加入。';
      $('#btn-host').disabled = !cap; $('#btn-join').disabled = !cap;
      $('#btn-spectate').disabled = !cap || cap.kind !== 'ws';
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
    S.catalog = 'campaign'; store.set('catalog', S.catalog);
    S.lobby = { code: null, host: S.pid, seats: [{ pid: S.pid, name: S.name }, bot(0), bot(1)], catalog: 'campaign', ruleset: 'campaign', mid: nextMissionId('campaign'), started: false, attempts: 0 };
    go('lobby');
  }
  function resumeLegacyPhysical() {
    var saved = store.get('hostGame', null);
    if (!saved || !saved.G || saved.G.ruleset !== 'physical') return;
    leaveNet();
    S.mode = 'solo'; S.code = null; S.G = saved.G; S.lobby = saved.lobby; S.official = false;
    S.lobby.ruleset = 'physical'; S.lobby.started = true;
    S.pid = S.lobby.host;
    S.G.players.forEach(function (p) { p.bot = p.pid !== S.pid; });
    S.lobby.seats.forEach(function (seat) { seat.bot = seat.pid !== S.pid; });
    hostSync(); go('game');
  }
  function bot(i) { return { pid: 'bot' + i + rid(3), name: BOT_NAMES[i % BOT_NAMES.length], bot: true }; }

  /* ---------- 联机：房主 ---------- */
  function hostCreate(code, restore) {
    if (!needName()) return;
    leaveNet();
    code = code || rid(4);
    S.mode = 'host'; S.code = code; S.G = null; S.chat = []; S.official = false;
    S.catalog = 'campaign'; store.set('catalog', S.catalog);
    S.lobby = { code: code, host: S.pid, seats: [{ pid: S.pid, name: S.name }], catalog: 'campaign', ruleset: 'campaign', mid: nextMissionId('campaign'), started: false, attempts: 0 };
    if (restore) {
      S.lobby = restore.lobby; S.G = restore.G;
      S.lobby.ruleset = S.lobby.ruleset || 'custom'; S.lobby.attempts = S.lobby.attempts || 0;
      if (S.G) S.G.ruleset = S.G.ruleset || 'custom';
      if (S.G && S.G.deadline && !BB.freeTurn(S.G)) S.G.deadline = Date.now() + S.G.mission.rules.timer * 1000; S.lobby.seats.forEach(function (s) { if (s.pid === S.pid) s.name = S.name; });
    }
    S.joining = true; render();
    Net.join(code).then(function (net) {
      S.net = net; S.joining = false;
      if (S.lobby.catalog === 'campaign' && net.kind !== 'ws') { leaveNet(); S.mode = null; toast('战役联机需要 Node 服务器；单人练习仍可使用', 'bad'); render(); return; }
      S.official = S.lobby.catalog === 'campaign' && net.kind === 'ws';
      if (S.official) { S.G = null; wireOfficial(net); }
      net.on('hello', function (m) { onHello(m.data); });
      net.on('act', function (m) { if (!m.mine) onRemoteAct(m.data); });
      net.on('chat', function (m) { onChat(m.data); });
      net.onPeers(function () { /* 有人进出时重发一次状态，方便断线重连 */ setTimeout(emitLobby, 300); });
      store.set('lastRoom', { code: code, host: true });
      if (S.official) net.emit('official:hello', { ruleset: 'campaign', catalog: 'campaign', mid: S.lobby.mid, name: S.name, pid: S.pid, credential: officialCredential(code) });
      emitLobby();
      if (S.G && !S.official) hostSync();
      go(S.G ? 'game' : 'lobby');
    }).catch(function (e) { S.joining = false; S.mode = null; toast(e.message || '无法创建房间', 'bad'); render(); });
  }
  function emitLobby() {
    if (S.mode !== 'host' || !S.net) return;
    var L = S.lobby;
    if (officialOnline()) { S.net.emit('official:lobby', { catalog: L.catalog || 'campaign', ruleset: L.catalog || L.ruleset, mid: L.mid, seats: L.seats }); return; }
    S.net.emit('lobby', { code: L.code, host: L.host, seats: L.seats, catalog: L.catalog || L.ruleset || 'custom', ruleset: L.ruleset || 'custom', mid: L.mid, started: L.started });
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
    if (officialOnline()) return;
    if (!S.G || !d || ((S.G.ruleset === 'physical' || d.gid) && d.gid !== S.G.gid) || (d.ruleset && d.ruleset !== S.G.ruleset)) return;
    var i = -1;
    S.G.players.forEach(function (p, k) { if (p.pid === d.pid) i = k; });
    if (i < 0) return;
    var err = BB.act(S.G, i, d.a);
    if (err) { S.net.emit('err', { to: d.pid, msg: err }); return; }
    S.sel = S.sel && BB.turnActor(S.G) === myIdx() ? S.sel : null;
    hostSync();
  }

  /* ---------- 联机：加入者 ---------- */
  function guestJoin(code, spectate) {
    if (!needName()) return;
    code = (code || '').trim().toUpperCase();
    if (!/^[A-Z0-9]{3,8}$/.test(code)) { toast('房间码是 4 位字母或数字', 'bad'); return; }
    leaveNet();
    S.mode = 'guest'; S.code = code; S.lobby = null; S.G = null; S.pub = null; S.hand = null; S.V = null; S.log = []; S.chat = []; S.hostGone = false; S.official = false;
    S.joining = true; render();
    Net.join(code).then(function (net) {
      S.net = net;
      if (spectate && net.kind !== 'ws') { leaveNet(); S.mode = null; S.joining = false; toast('观战视角需要通过游戏服务器连接', 'bad'); render(); return; }
      if (net.kind === 'ws') wireOfficial(net);
      net.on('lobby', function (m) {
        S.hostPeer = m.peer; S.hostGone = false;
        var first = !S.lobby;
        S.lobby = m.data; S.lobby.ruleset = S.lobby.ruleset || 'custom'; S.joining = false;
        if (!S.lobby.started) { S.V = null; S.pub = null; S.hand = null; S.choice = null; S.sel = null; S.deadline = null; }
        store.set('lastRoom', { code: code, host: false });
        if (first || (!S.lobby.started && S.screen !== 'lobby' && S.screen !== 'rules' && S.screen !== 'missions')) go(S.lobby.started && S.pub ? 'game' : 'lobby');
        else render();
      });
      net.on('pub', function (m) { S.hostPeer = m.peer; onPub(m.data); });
      net.on('hand', function (m) { if (m.data && m.data.to === S.pid && (!S.pub || !m.data.gid || m.data.gid === S.pub.gid)) { S.hand = m.data.h; S.choice = m.data.choice || null; if (S.pub) onPub(S.pub, true); } });
      net.on('err', function (m) { if (m.data && m.data.to === S.pid) toast(m.data.msg, 'bad'); });
      net.on('chat', function (m) { onChat(m.data); });
      net.onPeers(function (ids) {
        if (S.hostPeer && ids.indexOf(S.hostPeer) < 0) { S.hostGone = true; render(); }
        else if (S.hostGone) { S.hostGone = false; render(); }
      });
      var tries = 0;
      (function hello() {
        if (S.mode !== 'guest' || S.net !== net || S.lobby) return;
        net.emit('hello', { pid: S.pid, name: S.name, credential: officialCredential(code), spectator: !!spectate });
        if (!S.lobby && ++tries < 6) setTimeout(hello, 2000);
        else if (!S.lobby) { S.joining = false; toast('没找到房间 ' + code + '：确认房主已创建房间且你们打开的是同一个页面', 'bad'); render(); }
      })();
    }).catch(function (e) { S.joining = false; S.mode = null; toast(e.message || '无法加入房间', 'bad'); render(); });
  }
  function onPub(pub, quiet) {
    if (S.pub && S.pub.gid !== pub.gid) { S.log = []; S.sel = null; S.choice = null; S.hand = null; }
    S.pub = pub;
    var me = -1;
    pub.players.forEach(function (p, i) { if (p.pid === S.pid) me = i; });
    var prevPhase = S.V && S.V.phase;
    if (S.V && S.V.gid !== pub.gid) { S.log = []; S.sel = null; S.choice = null; S.hand = null; prevPhase = null; }
    S.V = BB.unpack(pub, S.hand, me, S.choice);
    S.deadline = pub.left != null ? Date.now() + pub.left : null;
    if (pub.ruleset === 'physical') S.log = pub.log || [];
    else mergeLog(pub.log);
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
    if (officialOnline()) return;
    var G = S.G;
    if (!G) return;
    if (S.mode === 'host' && S.net) {
      var pub = BB.packPublic(G, 8), n = 8;
      pub.left = G.deadline ? G.deadline - Date.now() : null;
      while (JSON.stringify(pub).length > 3800 && n > 0) { n -= 2; pub.log = G.log.slice(-n); }
      S.net.emit('pub', pub);
      G.players.forEach(function (p, i) {
        if (!p.bot && p.pid !== S.pid) S.net.emit('hand', { to: p.pid, gid: G.gid, ruleset: G.ruleset, h: BB.packHand(G, i), choice: BB.packChoice(G, i) });
      });
      store.set('hostGame', { code: S.code, lobby: S.lobby, G: G });
    }
    if (silent) return;
    var prev = S.V && S.V.phase;
    S.V = BB.view(G, myIdx());
    S.deadline = G.deadline;
    S.log = G.ruleset === 'physical' ? BB.view(G, -1).log : G.log.slice();
    afterState(prev);
    render();
    runBots();
  }
  function afterState(prevPhase) {
    var V = S.V;
    if (!V) return;
    if (V.paused) S.sel = null;
    var call = cutDeclaration(V), me = myIdx(), turnMessage = null;
    var choosingFalse=V.pending&&V.pending.type==='false-info'&&V.pending.to===me&&!V.paused;
    var choosingSubmarine=V.pending&&['submarine-red','submarine-transfer'].indexOf(V.pending.type)>=0&&V.pending.to===me&&!V.paused;
    var choosingGrapple=V.pending&&V.pending.type==='grapple'&&V.pending.to===me&&!V.paused;
    var choosingRing=V.pending&&V.pending.type==='constraint-vote'&&V.pending.to===me&&!V.paused;
    var choosingRelay=V.pending&&V.pending.type==='number-relay'&&V.pending.to===me&&!V.paused;
    var order=BB.numberOrder(V),commanding=order&&['draw','assign'].indexOf(order.step)>=0&&order.controller===me&&V.phase==='play'&&!V.paused,replying=V.pending&&V.pending.type==='order-answer'&&V.pending.to===me&&!V.paused;
    var remembering=V.phase==='memory-preview'&&V.pending&&V.pending.to===me&&!V.paused;
    var marking = canPlaceInfo(V, me), choosingEnd = V.pending && ['sequence-end','robot-direction'].indexOf(V.pending.type)>=0 && V.pending.to === me;
    if (choosingRelay || choosingRing || choosingGrapple || choosingSubmarine || choosingFalse || commanding || replying || remembering || choosingEnd || marking || isMyTurn(V, me)) {
      var turnKey = V.gid + ':' + V.phase + ':' + (marking ? V.setup[me] : V.turnNo) + ':' + (V.official && V.official.radarCommand ? V.official.radarCommand.decisionId : '') + ':' + (choosingEnd ? V.pending.id : '') + ':' +(order?order.decisionId:'')+':'+(choosingFalse?V.pending.id:'')+':' + me;
      if(choosingSubmarine)turnKey+=':'+V.pending.type+':'+V.pending.id;
      if(choosingGrapple)turnKey+=':grapple:'+V.pending.id;
      if(choosingRing)turnKey+=':constraint-vote:'+V.pending.id;
      if(choosingRelay)turnKey+=':number-relay:'+V.pending.id;
      if (S.turnNoticeKey !== turnKey) {
        S.turnNoticeKey = turnKey;
        turnMessage = choosingFalse ? '轮到你选择便利贴的错误数值，选项仅你可见。' : replying ? '长官指定了你，请公开回应：长官，遵命！' : commanding ? order.step==='draw'?'轮到你担任长官，先翻数字牌。':'请独立指定拆线玩家，可以指定自己。' : remembering ? '轮到你确认红黄线记忆，'+V.players[me].name+'！' : choosingEnd ? V.pending.type==='robot-direction'?'轮到你选择机器人的朝向！':'轮到你独立选择数字序列的下一端！' : marking ? (V.ruleset === 'physical' ? '轮到你标记了，' : '请放置开局标记，') + V.players[me].name + '！' + setupInstruction(V, me) : '轮到你了，' + V.players[me].name + '！请选择本回合的行动。';
        if(choosingSubmarine)turnMessage=V.pending.type==='submarine-red'?'轮到你为新红线选择线架，排序数值仅你可见。':'轮到你决定是否传氧，请选择方向、队友和数量，或放弃。';
        if(choosingGrapple)turnMessage='轮到你为抓钩取得的线选择线架，数值仅你可见。';
        if(choosingRing)turnMessage='轮到你确认是否同意限制轮转。全队同意后牌位才移动。';
        if(choosingRelay)turnMessage='轮到你传出一张数字牌，请选牌及另一位接收者。';
      }
    } else clearTurnToast();
    if (call) {
      var response = cutResponse(V, call);
      var noticeKey = V.gid + ':' + call.id + ':' + (response ? response.matched ? 'hit' : 'miss' : 'declared') + ':' + ((call.type === 'risky-cut' || call.type === 'precision-cut' || call.type === 'yellow-three-cut') ? (call.answers || []).length : '') + ':' + me;
      if (S.cutNoticeKey !== noticeKey) {
        S.cutNoticeKey = noticeKey;
        var message = response ? cutResponseText(V, call, response) : cutDeclarationText(V, call, me);
        toast(message + (turnMessage ? ' ' + turnMessage : ''), turnMessage ? 'turn' : '', turnMessage ? 4200 : 2600);
        turnMessage = null;
      }
    }
    if (turnMessage) toast(turnMessage, 'turn', 4200);
    if (V.phase !== prevPhase && (V.phase === 'won' || V.phase === 'lost')) {
      if (V.phase === 'won' && me >= 0) {
        var cat = V.catalog || V.ruleset;
        var current = cat === 'campaign' ? V.contentVersion === MISSIONS.CAMPAIGN_VERSION : V.ruleset !== 'physical' || V.contentVersion === MISSIONS.OFFICIAL_VERSION;
        var key = cat === 'campaign' ? 'clearedCampaignV' + (V.contentVersion || 1) : V.ruleset === 'custom' ? 'cleared' : V.contentVersion ? 'clearedPhysicalV' + V.contentVersion : 'clearedPhysical';
        var done = current ? cleared(cat) : store.get(key, []);
        if (done.indexOf(V.mid) < 0) { done.push(V.mid); store.set(key, done); }
      }
      S.sel = null;
    }
    if (V.lastAct && V.lastAct.t === 'boom') document.body.classList.add('shake');
    setTimeout(function () { document.body.classList.remove('shake'); }, 700);
    if (V.phase === 'play' && BB.turnActor(V) !== myIdx() && S.sel && S.sel.mode !== 'eq') S.sel = null;
  }

  var botT = null;
  function runBots() {
    if (officialOnline()) return;
    clearTimeout(botT);
    var G = S.G;
    if (!G || G.paused || G.phase === 'won' || G.phase === 'lost') return;
    var who = -1, delay = 900, queuedAction = null;
    G.players.forEach(function (p, i) {
      if (who >= 0 || !p.bot) return;
      if (G.phase === 'setup' && G.setup[i] < BB.setupNeed(G, i)) {
        if (G.ruleset !== 'physical' || i === BB.setupActor(G)) { who = i; delay = 250; }
      }
      else if ((G.phase === 'play' || G.phase === 'sequence') && G.pending && G.pending.to === i) { who = i; delay = 700; }
    });
    if (who < 0 && G.phase === 'constraints' && G.players[G.turn].bot) { who = G.turn; delay = 250; }
    if (who < 0 && G.phase === 'play' && !G.pending && BB.tripwire(G) && BB.tripwire(G).stalled) G.players.some(function(p,i){if(!p.bot)return false;queuedAction=Bot.decide(G,i);if(queuedAction){who=i;return true;}return false;});
    if(who<0&&G.phase==='play'&&!G.pending&&BB.freeTurn(G)&&BB.freeTurn(G).step==='claim')G.players.some(function(p,i){if(!p.bot||!BB.freeTurnEligible(G,i))return false;who=i;queuedAction=Bot.decide(G,i);return true;});
    if (who < 0 && G.phase === 'play' && !G.pending && G.players[BB.turnActor(G)].bot) who = BB.turnActor(G);
    if (who < 0) return;
    botT = setTimeout(function () {
      if (S.G !== G || G.paused) return;
      var a = queuedAction || Bot.decide(G, who);
      if (!a) return;
      var err = BB.act(G, who, a);
      if (err) console.warn('bot', err, a);
      hostSync();
    }, delay);
  }
  setInterval(function () {
    var G = S.G;
    if(S.V){gameAudio.update(S.V.gid,S.V.audio);gameAudio.sync();var audioState=$('#audio-state');if(audioState){var local=gameAudio.status();audioState.textContent=local.error||(local.loading?'正在准备任务音频…':local.enabled?'声音已开启；切换牌桌视图不会重播。':local.prepared?'音频已就绪，请点击开启声音。':'请先准备任务音频，再开启本机声音。');}}else gameAudio.destroy();
    if(isHost()&&G&&G.audioClock){var audio=BB.advanceAudio(G,{serverAudio:true});if(!audio.error&&audio.changed)hostSync();}
    if (isHost() && G && !G.paused && G.phase === 'play' && G.deadline && Date.now() > G.deadline) {
      BB.act(G, G.turn, { a: 'timeout' }, {serverTimeout:true});
      hostSync();
    }
    var t = $('#timer');
    if (t && S.deadline && S.V && !S.V.paused && S.V.phase === 'play') {
      var s = Math.max(0, Math.ceil((S.deadline - Date.now()) / 1000));
      t.textContent = '⏱ ' + s + 's'; t.classList.toggle('hot', s <= 10);
    }
  }, 250);

  /* ---------- 发出动作 ---------- */
  function doAct(a) {
    if (S.spectator) return;
    if (S.V && S.V.paused) { toast('牌局已暂停，请等待房主继续', 'bad'); return; }
    if(S.V&&BB.personalOxygen(S.V)&&(['dual','dd','solo'].indexOf(a.a)>=0||a.a==='equip'&&[3,5].indexOf(a.n)>=0||a.a==='character'&&BB.characterState(S.V.players[myIdx()]).id==='triple-detector'))a.oxygenTo=personalOxygenRecipient(S.V,myIdx());
    if(S.V&&BB.arithmetic(S.V)&&(['dual','dd','solo'].indexOf(a.a)>=0||a.a==='equip'&&[3,5].indexOf(a.n)>=0||a.a==='character'&&BB.characterState(S.V.players[myIdx()]).id==='triple-detector')){var choice=S.arithmeticChoice||{cards:[],operation:'sum'};a.cards=choice.cards.slice();a.operation=choice.operation;S.arithmeticChoice=null;}
    if (officialOnline() && S.net && S.V) {
      S.net.emit('official:act', { gid: S.V.gid, revision: S.revision,
        commandId: String(++S.commandSeq) + '-' + rid(8), action: a });
      S.sel = null; render(); return;
    }
    if (isHost()) {
      var err = BB.act(S.G, myIdx(), a);
      if (err) { toast(err, 'bad'); return; }
      S.sel = null;
      hostSync();
    } else if (S.net) {
      S.net.emit('act', { pid: S.pid, gid: S.V && S.V.gid, ruleset: S.V && S.V.ruleset, a: a });
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
    if (S.spectator) return;
    text = text.trim().slice(0, 200);
    if (!text) return;
    var V = S.V;
    if (V && V.phase !== 'won' && V.phase !== 'lost' && gameMission(V).rules.noChat) { toast('本关禁止聊天', 'bad'); return; }
    var d = { pid: S.pid, name: S.name, text: text };
    if (S.mode === 'solo') onChat(d);
    else if (S.net) S.net.emit('chat', d);
  }

  function leaveNet() {
    if (S.net) { try { S.net.leave(); } catch (e) {} }
    S.net = null;
    S.official = false;
    S.spectator = false; S.perspective = null;
  }
  function quit() {
    leaveNet();
    clearTimeout(botT);
    if (S.mode === 'host') store.set('hostGame', null);
    S.mode = null; S.G = null; S.V = null; S.lobby = null; S.pub = null; S.hand = null; S.log = []; S.chat = []; S.code = null;
    S.pid = store.get('pid', S.pid);
    store.set('lastRoom', null);
    go('home');
  }
  function togglePause() {
    if (!canManageGame() || !S.V) return;
    if (officialOnline()) {
      S.net.emit('official:pause', { gid: S.V.gid, revision: S.revision,
        commandId: String(++S.commandSeq) + '-' + rid(8), paused: !S.V.paused });
      return;
    }
    var err = BB.setPaused(S.G, !S.G.paused);
    if (err) { toast(err, 'bad'); return; }
    clearTimeout(botT); S.sel = null; hostSync();
  }
  function returnToLobby() {
    if (!canManageGame() || !S.V) return;
    if (officialOnline()) {
      // Wait for the server to confirm; a stale request must leave the table usable.
      S.net.emit('official:back', { gid: S.V.gid, revision: S.revision,
        commandId: String(++S.commandSeq) + '-' + rid(8) });
      return;
    }
    clearTimeout(botT);
    S.lobby.started = false; S.G = null; S.V = null; S.sel = null; S.deadline = null;
    S.pub = null; S.hand = null; S.choice = null;
    store.set('hostGame', null);
    emitLobby(); go('lobby');
  }
  function hostControls(V, over) {
    if (!canManageGame()) return '';
    return '<div class="host-controls" role="group" aria-label="房主管理">' +
      (!over ? '<button type="button" class="btn small" data-act="host-pause" aria-pressed="' + !!V.paused + '">' + (V.paused ? '继续牌局' : '暂停牌局') + '</button>' : '') +
      '<button type="button" class="btn small ghost" data-act="host-quit">退出牌局</button></div>';
  }

  /* ---------- 大厅 ---------- */
  function characterText(p) {
    var state = BB.characterState(p), def = BB.CHARACTERS[state.id];
    if (state.removed) return '本关无角色卡';
    if (state.hidden) return '角色背面 · 锁定';
    if (state.locked) return esc(def.name)+' · 暂时锁定';
    return esc(def.name) + ' · ' + (state.used ? '已用' : '可用');
  }
  function selectedAction(a) { if (S.sel && S.sel.personal) a.a = 'character'; return a; }
  function renderLobby() {
    var L = S.lobby, el = $('#scr-lobby');
    if (!L) {
      el.innerHTML = '<div class="panel center"><p class="big">' + (S.joining ? '正在连接房间 ' + esc(S.code || '') + ' …' : '没有进入任何房间。') + '</p><button class="btn ghost" data-act="quit">返回首页</button></div>';
      return;
    }
    var host = canManageGame();
    var catalogId = L.catalog || L.ruleset || 'custom', ruleset = mRuleset(L, L.mid), list = catalog(catalogId), doneList = cleared(catalogId), m = mission(L.mid, catalogId);
    var n = L.seats.length, shown = Object.assign({}, m);
    if (m.ruleset === 'physical' && n === 2 && m.two) { if (m.two.y) shown.y = m.two.y; if (m.two.r) shown.r = m.two.r; }
    var seats = L.seats.map(function (s, i) {
      return '<li class="seat' + (s.pid === S.pid ? ' me' : '') + '"><span class="seat-n">' + (i + 1) + '</span><span class="seat-name">' + esc(s.name) + (s.pid === S.pid ? '<em>（你）</em>' : '') + '</span>' +
        (i === (m.ruleset === 'physical' ? (L.attempts || 0) % L.seats.length : 0) ? '<span class="tag">队长</span>' : '') + (s.bot ? '<span class="tag bot">AI</span>' : '') +
        (m.personalCharacters ? '<label class="small-t character-choice">个人能力 <select class="character-select" data-seat="' + i + '"' + (s.pid !== S.pid && !(host && s.bot) ? ' disabled' : '') + '>' + BB.characterOptions(m, i, (L.attempts || 0) % n).map(function (id) { var used = id !== 'double-detector' && L.seats.some(function (other, oi) { return oi !== i && oi !== (L.attempts || 0) % n && other.character === id; }); return '<option value="' + id + '"' + ((s.character || 'double-detector') === id ? ' selected' : '') + (used ? ' disabled' : '') + '>' + esc(BB.CHARACTERS[id].name) + '</option>'; }).join('') + '</select></label>' : '') +
        (host && s.pid !== S.pid ? '<button class="btn tiny ghost" data-act="kick" data-i="' + i + '">移除</button>' : '') + '</li>';
    }).join('');
    var opts = '';
    var tier = '';
    list.forEach(function (x) {
      if (x.tier !== tier) { if (tier) opts += '</optgroup>'; tier = x.tier; opts += '<optgroup label="' + tier + '">'; }
      opts += '<option value="' + x.id + '"' + (x.id === L.mid ? ' selected' : '') + '>' + x.id + '. ' + esc(x.name) + ' · ' + esc(x.status || (x.verified ? '已核实' : '改编规则')) + (doneList.indexOf(x.id) >= 0 ? ' ✓' : '') + '</option>';
    });
    opts += '</optgroup>';
    el.innerHTML =
      '<div class="lobby">' +
      '<section class="panel">' +
      (S.mode === 'solo' ? '<p class="eyebrow">单人练习</p><h2>组建你的拆弹小队</h2><p class="muted">你和 AI 队友一起拆弹。AI 只会用它能看到的信息推理。</p>'
        : '<p class="eyebrow">联机房间</p><h2 class="code-line">房间码 <span class="code">' + esc(L.code) + '</span> <button class="btn tiny ghost" data-act="copy">复制</button></h2><p class="muted">好友在首页输入这个房间码即可加入，最多 5 人。' + (S.hostGone ? ' <b class="bad-t">房主已断开，等待重连…</b>' : '') + '</p>') +
      '<ol class="seats">' + seats + '</ol>' +
      (officialOnline() ? '<div class="spectator-lobby"><div class="row"><span class="tag">' + (S.spectator ? '你正在观战' : '你已加入游戏') + '</span><button type="button" class="btn small ghost" data-act="spectator-role"' + (L.started || (S.spectator && n >= 5) ? ' disabled' : '') + '>' + (S.spectator ? '加入游戏' : '观战') + '</button></div><p class="muted small-t">仅可在大厅切换身份。观战不占玩家名额，可选择查看玩家手牌。</p><p class="small-t observer-list">观战者（' + (L.observers || []).length + '）：' + ((L.observers || []).map(function (p) { return esc(p.name) + (p.pid === S.pid ? '（你）' : ''); }).join('、') || '暂无') + '</p></div>' : '') +
      (host ? '<div class="row"><button class="btn small" data-act="addbot"' + (n >= 5 ? ' disabled' : '') + '>＋ 加入 AI 队友</button><span class="muted small-t">人数：' + n + ' / 5（至少 2 人）</span></div>' : '<p class="muted">等待房主选择任务并开始…</p>') +
      '</section>' +
      '<section class="panel">' +
      '<p class="eyebrow">任务选择</p>' +
      (host ? '<label class="lbl-t" for="msel">统一战役任务</label><select id="msel">' + opts + '</select>' : '<p class="tag">统一 66 关战役</p>') +
      '<div class="mcard"><div class="mcard-h"><span class="mnum">' + m.id + '</span><div><h3>' + esc(m.name) + '</h3><p class="muted small-t">' + esc(m.status || (m.verified ? '已核实' : '改编规则')) + ' · ' + m.tier + (doneList.indexOf(m.id) >= 0 ? ' · 已通关' : '') + '</p></div></div>' +
      '<p>' + esc(m.brief) + '</p>' + (m.ruleset === 'physical' && n === 2 && m.two ? '<p class="muted small-t">当前显示双人规则用线数量。</p>' : '') + '<div class="chips">' + ruleChips(shown) + '</div>' +
      '<p class="muted small-t">本局 ' + n + ' 人：' + (n === 2 ? '每人 2 排线，' : n === 3 && m.ruleset === 'physical' ? '队长 2 排线，' : '') + (m.ruleset === 'physical' ? '第 ' + n + ' 次失误引爆；当前 0 次。' : '引爆器容错 ' + (Math.max(1, (n === 2 ? 3 : n + 1) + (m.det || 0)) - 1) + ' 次。') + '</p></div>' +
      (!m.verified ? '<p class="muted small-t">本关使用旧版自定义改编规则，不代表实体规则原卡内容。</p>' : '') +
      (host ? '<button class="btn primary wide" data-act="start"' + (n < 2 ? ' disabled' : '') + '>开始任务</button>' : '') +
      '</section>' +
      '</div>';
  }

  function hostStart() {
    var L = S.lobby;
    if (L.seats.length < 2) { toast('至少需要 2 名玩家（可以加 AI 队友）', 'bad'); return; }
    var selected = mission(L.mid, L.catalog || L.ruleset);
    if (!selected) { toast('此任务尚未核实', 'bad'); return; }
    if (officialOnline()) { S.net.emit('official:start', { mid: selected.id, revision: S.revision,
      commandId: String(++S.commandSeq) + '-' + rid(8) }); return; }
    var charError = BB.validateCharacterSeats(selected, L.seats, (L.attempts || 0) % L.seats.length);
    if (selected.personalCharacters && charError) { toast(charError, 'bad'); return; }
    S.G = BB.createGame(selected, L.seats, { captain: (L.attempts || 0) % L.seats.length });
    L.attempts = (L.attempts || 0) + 1;
    S.log = []; S.sel = null;
    L.started = true;
    emitLobby();
    hostSync();
    go('game');
  }

  /* ---------- 牌桌 ---------- */
  function spectatorPanel(V) {
    if (!S.spectator) return '';
    return '<section class="panel spectator-panel" aria-label="观战视角"><div><b>观战模式</b><p class="muted small-t">可查看所选玩家的手牌；不能操作或发送队内消息。返回大厅后可加入游戏。</p></div><label for="spectator-perspective">观战视角</label><select id="spectator-perspective"><option value="">公共视角（隐藏手牌）</option>' +
      V.players.map(function (p) { return '<option value="' + esc(p.pid) + '"' + (p.pid === S.perspective ? ' selected' : '') + '>' + esc(p.name) + ' 的手牌</option>'; }).join('') + '</select></section>';
  }
  function renderGame() {
    var V = S.V, el = $('#scr-game');
    if (!V) {
      el.innerHTML = '<div class="panel center"><p class="big">等待房主同步牌桌…</p></div>';
      return;
    }
    if (!$('#g-main', el)) {
      el.innerHTML =
        '<div class="game"><div id="g-main" class="g-main"></div>' +
        '<aside class="g-side"><div class="panel side-panel"><div class="log-head"><h4 id="log-title">行动记录</h4><button type="button" class="btn tiny ghost" data-act="log-latest" aria-controls="g-log">最新</button></div><ol id="g-log" class="log" tabindex="0" aria-labelledby="log-title"></ol></div>' +
        '<div class="panel side-panel"><h4>队内通讯</h4><div id="g-chat" class="chat"></div>' +
        '<form id="chatf" class="chatf"><input id="chatin" maxlength="200" autocomplete="off" placeholder="说点什么（不要直接报出自己的线）"><button class="btn small">发送</button></form></div></aside></div>';
    }
    var m = gameMission(V), me = myIdx(), over = V.phase === 'won' || V.phase === 'lost';
    var viewSeat = S.spectator ? V.players.findIndex(function (p) { return p.pid === S.perspective; }) : me;
    var chipsM = m;
    if (V.ruleset === 'physical') { chipsM = Object.assign({}, m, { y: [V.ymark.n, V.ymark.cand.length], r: [V.rmark.n, V.rmark.cand.length] }); }
    var turnP = V.players[BB.turnActor(V)];
    var main = $('#g-main');
    var turnTxt = (V.paused ? '<b>牌局已暂停</b>' : V.phase==='play'&&BB.freeTurn(V)&&BB.freeTurn(V).step==='claim' ? '<b>等待玩家抢回合</b>' : V.official && V.official.tripwire && V.official.tripwire.stalled ? '<b>所有队员暂需跳过</b><br>可使用随时装备改变手牌' : V.phase==='audio-ready' ? '<b>等待官方音频</b><br>初始标记已完成，尚未开始拆线' : V.phase==='memory-preview' ? '<b>红黄数值记忆阶段</b><br>轮到 '+esc(V.players[V.pending.to].name)+(V.pending.to===me?'（你）':'') : V.pending && V.pending.type === 'sequence-end' ? '<b>选择数字序列端点</b><br>轮到 ' + esc(V.players[V.pending.to].name) + (V.pending.to === me ? '（你）' : '') : V.phase === 'constraints' ? '<b>选择限制卡</b><br>轮到 ' + esc(V.players[V.turn].name) + (V.turn === me ? '（你）' : '') : V.phase === 'setup' ? '<b>布置阶段 · 标记</b><br>' + setupWaiting(V, me) : over ? '<b>' + (V.phase === 'won' ? '任务成功' : '任务失败') + '</b>' :
        '第 ' + V.turnNo + (V.turnLimit ? ' / ' + V.turnLimit : '') + ' 回合 · 轮到 <b>' + esc(turnP.name) + '</b>' + (BB.turnActor(V) === me ? '（你）' : '')) +
      (V.deadline && V.phase === 'play' ? ' <span id="timer" class="timer"></span>' : '') + (V.stab ? ' <span class="tag">稳定器已启动</span>' : '');
    var viewBtn = '<button class="btn tiny ghost" data-act="view">' + (S.view3d ? '切换平面视图' : '切换 3D 牌桌') + '</button>' + hostControls(V, over);
    var pauseBanner = V.paused ? '<section class="banner pause-notice" role="status"><div><b>房主已暂停牌局</b><p>计时和所有游戏动作已暂停，等待房主继续。' + (V.pauseRemaining != null ? '剩余时间：' + Math.ceil(V.pauseRemaining / 1000) + ' 秒。' : '') + '</p></div></section>' : '';
    var banners = spectatorPanel(V) + allOutwardNotice(V) + pauseBanner + setupNotice(V, me) + turnNotice(V, me) + communicationNotice(V, me) + targetNotice(V, me) + (S.hostGone ? '<div class="banner bad">房主连接中断。房主重新进入同一房间后会自动恢复牌局。</div>' : '') +
      audioNotice(V) + weakLinkNotice(V) + freeTurnNotice(V) + numberRelayNotice(V) + passingOxygenNotice(V,me) + numberRewardsNotice(V) + constraintRingNotice(V,me) + robotRouteNotice(V) + boundConstraintNotice(V) + arithmeticNotice(V) + numberClaimNotice(V, me) + oxygenNotice(V, me) + personalOxygenNotice(V, me) + submarineNotice(V, me) + memoryNotice(V, me) + orderNotice(V, me) + falseInfoNotice(V) + pressureNotice(V) + nanoNotice(V) + commandNotice(V, me) + rookieNotice(V, me) + liarNotice(V, me) + secretNumberNotice(V, me) + unequippedCaptainNotice(V, me) + xNotice(V) + redNumberNotice(V) + blindEquipmentNotice(V) + clueNotice(V, me) + announcementNotice(V) + (over ? endBanner(V) : '');
    if (S.view3d) {
      if (main.dataset.mode !== '3d') {
        main.dataset.mode = '3d';
        main.innerHTML = '<section id="g-hud" class="panel hud3"></section><div id="g-ban"></div><div id="g-stage" class="stage3"></div><section id="g-con" class="panel console3"></section>';
      }
      $('#g-hud').innerHTML = '<div class="hud-l"><span class="eyebrow">任务 ' + m.id + ' · ' + m.tier + '</span><h2>' + esc(m.name) + '</h2><div class="chips">' + ruleChips(chipsM) + '</div></div>' +
        '<div class="hud-r"><span class="turnline">' + turnTxt + '</span><span class="tag' + ((BB.robotPressure(V)?BB.robotPressure(V).position>=BB.robotPressure(V).limit-2:V.det >= V.detMax - 1) ? ' warn' : '') + '">' + esc(BB.detonatorText(V)) + '</span>' + viewBtn + '</div>';
      $('#g-ban').innerHTML = banners;
      Table3D.render($('#g-stage'), V, {
        me: viewSeat, spectator: S.spectator, sel: S.sel, mission: m, dd: m.dd,
        setupStatus: function (i) { return setupStatus(V, i); },
        sideClues: function (i) { return sideClues(V, i); },
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
      '<div class="hud-l"><p class="eyebrow">任务 ' + m.id + ' · ' + m.tier + '</p><h2>' + esc(m.name) + '</h2><div class="chips">' + ruleChips(chipsM) + '</div></div>' +
      '<div class="hud-r">' + detonator(V) + '<div class="turnline">' + turnTxt + '</div>' + viewBtn + '</div></section>';
    h += banners;
    // 公共信息
    h += '<section class="panel boardinfo">' + track(V, m) + markers(V) + equipRow(V, me) + '</section>';
    // 其他玩家
    h += '<section class="table">';
    V.players.forEach(function (p, i) { if (i !== viewSeat) h += playerBlock(V, p, i, me); });
    h += '</section>';
    // 自己
    if (viewSeat >= 0) h += '<section class="panel mine-zone">' + playerBlock(V, V.players[viewSeat], viewSeat, me, true) + (me >= 0 ? actionPanel(V, me) : '') + '</section>';
    else h += '<section class="panel"><p class="muted">你正在观战。</p></section>';
    main.innerHTML = h;
    renderLog();
    renderChat();
    chatLock(over, m);
  }
  function chatLock(over, m) {
    var ci = $('#chatin');
    var blocked = S.spectator || (!over && m.rules.noChat);
    ci.disabled = blocked; ci.placeholder = S.spectator ? '观战者只可阅读队内消息' : blocked ? '本关禁止聊天' : '说点什么（不要直接报出自己的线）';
    $('#chatf button').disabled = blocked;
  }
  function cutDeclaration(V) {
    var submarine=BB.submarine54(V);if(V.pending&&['submarine-red','submarine-transfer'].indexOf(V.pending.type)>=0&&submarine&&submarine.suspendedAction)return submarine.suspendedAction;
    return V.pending && (V.pending.type === 'cut' || V.pending.type === 'risky-cut' || V.pending.type === 'precision-cut' || V.pending.type === 'tripwire-cut' || V.pending.type === 'yellow-three-cut') ? V.pending : V.declaration || null;
  }
  function isMyTurn(V, me) {
    return me >= 0 && V.phase === 'play' && !(V.audio&&V.audio.cutHeld) && !V.paused && !V.pending && BB.turnActor(V) === me && BB.ownTurnAllowed(V,me);
  }
  function audioNotice(V){if(!V.audio)return '';gameAudio.update(V.gid,V.audio);var state=gameAudio.status(),prep=V.audio.preparation,me=myIdx(),h='<section class="banner" aria-label="任务音频"><b>官方任务音频 · 与服务器同步</b><p id="audio-state">'+esc(state.error||(state.loading?'正在准备任务音频…':state.preflight?'正在开启声音…':state.enabled?'声音已开启；切换牌桌视图不会重播。':state.prepared?'音频已就绪，请点击开启声音。':'请先准备任务音频，再开启本机声音。'))+'</p><button class="btn small" data-act="'+(state.prepared?'audio-enable':'audio-prepare')+'"'+(state.loading||state.preflight?' disabled':'')+'>'+(state.loading?'正在准备…':state.prepared?(state.enabled?'重新同步声音':'开启声音并同步'):'准备任务音频')+'</button>';if(prep){h+='<p>准备阶段不计时。'+V.players.map(function(p,i){return esc(p.name)+'：'+(prep.ready[i]?'已就绪':'待准备');}).join('；')+'</p>';if(me>=0)h+='<button class="btn small" data-act="audio-ready"'+(!V.paused&&state.enabled&&!state.preflight?'':' disabled')+'>'+(prep.ready[me]?'取消就绪':'我已就绪')+'</button>';if(canManageGame())h+='<button class="btn primary small" data-act="audio-start"'+(!V.paused&&prep.ready.every(Boolean)?'':' disabled')+'>全员就绪后开始</button>';}return h+'</section>';}
  function freeTurnNotice(V){var f=BB.freeTurn(V);if(!f)return '';return '<section class="banner" aria-label="限时自由轮序"><b>任务总时间 '+(f.duration/60)+' 分钟 · '+(f.step==='claim'?'等待抢回合':esc(V.players[f.actor].name)+' 正在拆线')+'</b><p>换回合不重置倒计时；三人以上仍持线时不能连续行动。'+(f.previous===null?'':'上一位：'+esc(V.players[f.previous].name)+'。')+'</p></section>';}
  function weakLinkNotice(V){var s=BB.weakLink(V);if(!s)return '';return '<section class="banner" aria-label="秘密弱环节"><b>'+(s.status==='secret'?'角色秘密分配 · 个人装备锁定':s.status==='revealed'?'猜对弱环节 · 个人装备已解锁':'角色及限制全部弃置')+'</b>'+(s.status==='secret'&&s.ownConstraint?'<p class="private-choice">仅你可见：'+(s.ownWeak?'你是弱环节，必须秘密遵守':'你不是弱环节，不需要遵守')+' '+s.ownConstraint+' · '+esc(BB.CONSTRAINTS[s.ownConstraint].name)+'。'+esc(BB.CONSTRAINTS[s.ownConstraint].desc)+'</p>':'')+'</section>';}
  function nanoNotice(V){
    if(!V.official||!V.official.nano)return '';var robot=V.official.nano;return '<section class="nano-panel" aria-label="纳米机器人"><b>🤖 纳米机器人：数字 '+robot.position+' · '+(robot.direction>0?'向12移动':'向1移动')+'</b><p>隐藏备用导线：'+robot.remaining+' 根。拆中当前位置的蓝值后，行动者取得一根补线；咖啡杯也会推动机器人。</p>'+(robot.waiting?'<p class="nano-waiting" role="status">'+(robot.waitingReason==='no-other-player'?'其他玩家的导线均已处理，没有双人拆线目标；当前玩家也没有合法单人拆线组合。':'当前玩家没有可继续的拆线行动。')+' 若可用装备无法改变局面，房主可点击“退出牌局”返回房间重开。炸弹尚未引爆。</p>':'')+'</section>';
  }
  function arithmeticNotice(V){var state=BB.arithmetic(V);return state?'<section class="nano-panel arithmetic-panel" aria-label="算式数字牌"><b>公开数字牌：'+state.open.join('、')+'</b><p>选两张不同牌，相加或相减得到要拆的数字。已弃：'+(state.discard.join('、')||'无')+'；全部用完后重新展开。</p></section>':'';}
  function arithmeticResult(V){var state=BB.arithmetic(V),choice=S.arithmeticChoice;if(!state||!choice||choice.cards.length!==2||choice.cards.some(function(v){return state.open.indexOf(v)<0;}))return null;var value=choice.operation==='sum'?choice.cards[0]+choice.cards[1]:Math.abs(choice.cards[0]-choice.cards[1]);return value>=1&&value<=12?value:null;}
  function arithmeticControls(V){if(S.arithmeticGame!==V.gid){S.arithmeticGame=V.gid;S.arithmeticChoice=null;}var state=BB.arithmetic(V),choice=S.arithmeticChoice||{cards:[],operation:'sum'},valid=choice.cards.length===2&&choice.cards.every(function(v){return state.open.indexOf(v)>=0;}),value=arithmeticResult(V);return '<section class="arithmetic-controls"><p>先选两张数字牌和运算，再选择目标并宣告结果。</p><div class="vals">'+state.open.map(function(v){var selected=choice.cards.indexOf(v)>=0;return '<button class="vbtn'+(selected?' on':'')+'" data-act="arithmetic-card" data-card="'+v+'"'+(!selected&&choice.cards.length===2?' disabled':'')+'>'+v+'</button>';}).join('')+'</div><div class="row"><button class="btn small" data-act="arithmetic-op" data-operation="sum">相加</button><button class="btn small" data-act="arithmetic-op" data-operation="difference">相减（大减小）</button></div><p class="step">'+(value===null?'请选择可得到1–12的算式。':choice.cards.join(choice.operation==='sum'?'＋':'、')+'，'+(choice.operation==='sum'?'和':'差')+'为 '+value)+' 红线公开不消耗数字牌。</p><button class="btn small" data-act="arithmetic-skip"'+(valid?'':' disabled')+'>弃这两张牌并跳过（引爆器＋1）</button></section>';}
  function numberClaimNotice(V,me){var r=BB.numberClaim(V);if(!r)return '';var steps={draw:'等待队长翻牌',claim:'等待玩家认领',cut:'由认领或指定的玩家行动',clue:'等待被指定玩家放线索'};return '<section class="nano-panel number-claim-panel" aria-label="抢认数字"><b>抢认数字：'+(r.value===null?r.retired.length===12?'蓝线已完成':'尚未翻牌':r.value)+'</b><p>'+steps[r.step]+(r.actor===null?'':' · '+esc(V.players[r.actor].name))+'。数字牌堆剩余 '+r.remaining+' 张；完成四根的数字退场。</p>'+(me>=0&&!S.spectator&&V.phase==='play'&&!V.paused?'<button class="btn ghost small" data-act="claim-penalty">记录我给出了额外暗示（引爆器＋1）</button>':'')+'</section>';}
  function pressureNotice(V){var state=BB.robotPressure(V);if(!state)return '';var cells='';for(var n=0;n<=state.limit;n++){var active=n===Math.min(state.position,state.limit);cells+='<span class="pressure-cell'+(active?' current':'')+(n===state.limit?' danger':'')+'" aria-current="'+(active?'step':'false')+'">'+(n===0?'起点':n)+(active?' 🤖':'')+'</span>';}
    return '<section class="nano-panel pressure-panel" aria-label="机器人压力轨道"><b>机器人位置：'+(state.position===0?'1之前':state.position)+(state.position>=state.limit?' · 已到引爆点':'')+'</b><div class="pressure-track">'+cells+'</div><p>不使用引爆器。普通成功前进1格，剪中机器人所在数字后退1格，失败前进2格；本局到12引爆。</p></section>';}
  function falseInfoNotice(V){if(!BB.allFalseInfo(V))return '';return '<section class="nano-panel false-info-panel" aria-label="假线索规则"><b>全员假线索</b><p>所有信息标记都表示“不是这个值”。每人初始选择两根不同的蓝线或红线，不能选黄线。失败时标记刚猜的值；便利贴也要选择错误数值。</p>'+(V.pending&&V.pending.type==='false-info'?'<p class="false-info-pending" role="status">等待 '+esc(V.players[V.pending.to].name)+' 选择便利贴的错误数值。</p>'+(V.pending.to===V.me?'<button class="btn small" data-act="locate-false-info">前往私人选值面板</button>':''):'')+'</section>';}
  function orderNotice(V,me){var state=BB.numberOrder(V);if(!state)return '';if(V.phase==='won'||V.phase==='lost')return '<section class="nano-panel order-panel"><b>长官命令已结束</b><p>请查看任务结算。</p></section>';var steps={draw:'翻数字牌',assign:'独立指定行动者',answer:'等待遵命回应',clue:'等待缺值标记',cut:'拆指定数字'};return '<section class="nano-panel order-panel" aria-label="长官命令"><b>长官：'+esc(V.players[state.controller].name)+'</b><p>本轮数字：'+(state.value===null?'尚未翻牌':state.value)+'；'+steps[state.step]+(state.actor===null?'':' · '+esc(V.players[state.actor].name))+'。</p><p>长官独立指定，可指定自己；请勿讨论指定人选。被指定者回应“长官，遵命！”后拆线。下一长官从原长官左邻继续。</p><p>指定只剩红线者会立即引爆；自己作为长官只剩红线时，直接公开而不翻牌。剩余数字牌 '+state.remaining+' 张。</p></section>';}
  function memoryNotice(V,me){var state=BB.memorySea(V);if(!state)return '';var h='<section class="nano-panel memory-panel" aria-label="黑海记忆规则"><b>黑海记忆</b>';
    if(state.preview)h+='<p>只在这里查看一次红黄数值。所有人确认后移除列表，再发线和标记。</p><p class="memory-values">红线：'+V.rmark.cand.map(function(v){return v.toFixed(1);}).join('、')+'；黄线：'+V.ymark.cand.map(function(v){return v.toFixed(1);}).join('、')+'</p><p role="status">轮到 '+esc(V.players[V.pending.to].name)+(V.pending.to===me?'（你）':'')+' 确认记忆；已确认 '+V.pending.ready.length+'/'+V.np+'。</p>';
    else h+='<p>不放红黄木标记和完成标记。初始／失败线索旁置；当前位置只提示一次，不能追问或复述旧线索。装备仍正常使用。</p>';
    if(state.point){var item=wireOf(V,state.point.wire);h+='<p class="memory-point" role="status">'+esc(V.players[item.o].name)+' 第'+(item.s+1)+'排第'+(item.st.findIndex(function(w){return w.id===state.point.wire;})+1)+'根：'+BB.valLabel(state.point.info.t==='Y'?'Y':state.point.info.v)+(state.point.verbal?'（标记不足，本次口头提示）':'（标记旁置）')+'。下一次有效行动后移除位置提示。</p><button class="btn small" data-act="memory-locate">查看当前指线</button>';}
    return h+'</section>';}
  function personalOxygenRecipient(V,me){var key=V.gid+':'+V.turnNo+':'+me;if(S.oxygenRecipientKey!==key){S.oxygenRecipientKey=key;S.oxygenRecipient=null;}return Number.isInteger(S.oxygenRecipient)&&S.oxygenRecipient!==me?S.oxygenRecipient:null;}
  function personalOxygenNotice(V,me){var state=BB.personalOxygen(V);if(!state)return '';var requests=state.requests.map(function(raised,pi){return raised?V.players[pi].name:null;}).filter(Boolean);return '<section class="nano-panel personal-oxygen-panel" aria-label="个人氧气"><b>个人氧气</b><p>'+V.players.map(function(p,pi){return esc(p.name)+'：'+state.balances[pi]+' 枚';}).join('；')+'</p><p>已弃 '+state.discarded+' 枚；拆蓝线需按宣告数字转交氧气给一名队友，接收者不必是目标。空手时弃掉剩余氧气，公开红线免费。</p><p>水下禁止聊天，只可举拇指请求氧气。</p>'+(requests.length?'<p role="status">👍 请求氧气：'+esc(requests.join('、'))+'</p>':'')+(me>=0&&!S.spectator&&V.phase==='play'&&!V.pending&&!V.paused&&V.players[me].stands.some(function(st){return st.some(function(w){return !w.cut;});})?'<button class="btn small" data-act="personal-oxygen-signal">👍 请求更多氧气</button>':'')+'</section>';}
  function personalOxygenControls(V,me){var state=BB.personalOxygen(V),recipient=personalOxygenRecipient(V,me);return '<section class="personal-oxygen-controls"><p class="step">你的氧气：'+state.balances[me]+' 枚。拆线前选择接收氧气的队友：</p><div class="row">'+V.players.map(function(p,pi){return pi===me?'':'<button class="btn small'+(recipient===pi?' primary':'')+'" data-act="personal-oxygen-recipient" data-p="'+pi+'" aria-pressed="'+(recipient===pi)+'">'+esc(p.name)+'（'+state.balances[pi]+' 枚）</button>';}).join('')+'</div><p class="muted">'+(recipient===null?'请先选择接收者；再选择目标和数字。':esc(V.players[recipient].name)+' 将收到本次宣告数字数量的氧气；空手接收者会弃掉收到的氧气。')+'</p><button class="btn small" data-act="personal-oxygen-skip">跳过以节省氧气'+(V.stab?'（稳定器保护）':'（引爆器＋1）')+'</button></section>';}
  function oxygenNotice(V,me){
    var oxygen=BB.oxygen(V);if(!oxygen)return '';
    var requests=oxygen.requests.map(function(raised,pi){return raised?esc(V.players[pi].name):null;}).filter(Boolean);
    return '<section class="nano-panel oxygen-panel" aria-label="共享氧气"><b>共享氧气：'+oxygen.available+'／'+oxygen.total+' 枚</b><p>蓝线1–4耗1枚，5–8耗2枚，9–12耗3枚；队长回合开始补满。跳过推进引爆器一格，可用稳定器保护。</p><p>水下禁止队内聊天；只可举拇指请求更多氧气。</p>'+(requests.length?'<p role="status">👍 请求更多氧气：'+requests.join('、')+'</p>':'')+(me>=0&&!S.spectator&&V.phase==='play'&&!V.pending&&!V.paused?'<button class="btn small" data-act="oxygen-signal">👍 请求更多氧气</button>':'')+'</section>';
  }
  function submarineNotice(V,me){
    var state=BB.submarine54(V);if(!state)return '';var pd=V.pending,choosing=pd&&['submarine-red','submarine-transfer'].indexOf(pd.type)>=0;
    return '<section class="nano-panel submarine-panel" aria-label="潜艇氧气"><b>潜艇氧气 · 中心库存 '+state.reserve+' 枚</b><p>'+V.players.map(function(p,i){return esc(p.name)+'：'+state.balances[i]+' 枚'+(state.active[i]?'':'（已退出）');}).join('；')+'</p><p>蓝线1–4耗1枚，5–8耗2枚，9–12耗3枚；费用回到中心库存。完成四根同值蓝线后，仍参与者各补氧1。只有氧气不足且没有其他合法行动时才能跳过，推进引爆器一格；公开红线免费。</p>'+(state.repeatTurn?'<p class="submarine-repeat" role="status">连续行动：'+esc(V.players[state.repeatTurn.owner].name)+' 在本回合结束后再行动一次，仍按正常费用耗氧。</p>':'')+(choosing?'<p role="status">播报选择 · 轮到 '+esc(V.players[pd.to].name)+(pd.to===me?'（你）':'')+'：'+(pd.type==='submarine-red'?'放好新增红线，数值仅本人可见。':'决定是否与一名队友传氧。')+'</p>':'')+'</section>';
  }
  function passingOxygenNotice(V,me){var p=BB.passingOxygen(V);if(!p)return '';var asked=p.requests.map(function(x,i){return x?V.players[i].name:null;}).filter(Boolean);return '<section class="nano-panel" aria-label="氧气接力"><b>氧气接力 · '+esc(V.players[p.holder].name)+' 持有 '+p.available+' 枚</b><p>中心库存 '+p.reserve+' 枚；本关总量 '+p.total+' 枚。宣告数字几就消耗几枚，单拆两根或四根也只付一次；回应和本人选副本不会再次扣氧。</p><p>回合结束把余量交下一位，轮到队长补回库存；空手队长也会按轮次补回。缺氧且不能免费公开红线才可罚一格跳过。水下禁止聊天，只可举拇指。</p>'+(asked.length?'<p role="status">👍 请求更多氧气：'+esc(asked.join('、'))+'</p>':'')+(me>=0&&!S.spectator&&V.phase==='play'&&!V.pending&&!V.paused&&V.players[me].stands.some(function(st){return st.some(function(w){return !w.cut;});})?'<button class="btn small" data-act="passing-oxygen-signal">👍 请求更多氧气</button>':'')+'</section>';}
  function commandNotice(V, me) {
    var c = V.official && V.official.radarCommand;
    if (!c || V.phase !== 'play') return '';
    var step = { draw: '翻开本回合数字卡', radar: '查询本回合数字', answers: '等待所有玩家逐架回答', choose: '指定拆线玩家', cut: '由指定玩家自行选目标并拆线', red: '仅剩红线，必须公开' }[c.step];
    var h = '<section class="banner radar-command" role="status"><div><b>雷达指挥 · ' + esc(step) + '</b><p>轮值玩家：' + esc(V.players[c.officer].name) + (c.value == null ? '' : ' · 数字卡：' + c.value) + (c.actor == null ? '' : ' · 拆线玩家：' + esc(V.players[c.actor].name)) + '。下一回合从轮值玩家的左邻继续。</p>';
    var answers = V.pending && V.pending.type === 'radar' ? V.pending.answers : c.answers;
    if (answers) h += '<div class="radar-answers">' + answers.map(function (racks, owner) { return '<p><b>' + esc(V.players[owner].name) + '：</b>' + (racks ? racks.map(function (yes, rack) { return '<span class="tag">第' + (rack + 1) + '排' + (yes ? '有' : '没有') + '</span>'; }).join(' ') : '等待回应') + '</p>'; }).join('') + '</div>';
    return h + '<p class="muted small-t">数字牌堆剩余 ' + c.remaining + ' 张。雷达只回答有／没有；不能报告数量、位置或重述以前回合的回答。</p></div></section>';
  }
  function rookieNotice(V, me) {
    var rookie = BB.rookie(V);
    if (rookie == null) return '';
    return '<section class="banner rookie-notice" role="status"><div><b>本关新人：' + esc(V.players[rookie].name) + (rookie === me ? '（你）' : '') + '</b><p>抽到队长角色卡的人是新人。新人发起的双人拆线一旦失败，炸弹立即爆炸，包括双重、三重和超级探测器及 X/Y 射线。新人不能使用稳定器，队友也不能用稳定器保护新人的拆线。</p><p class="muted small-t">其他玩家发起的拆线，即使目标是新人，仍按正常规则结算。单人拆线及仅剩红线时公开照常进行。</p></div></section>';
  }
  function liarNotice(V, me) {
    var liar = BB.liar(V); if (liar == null) return '';
    return '<section class="banner liar-notice" role="status"><div><b>本关说谎者：' + esc(V.players[liar].name) + (liar === me ? '（你）' : '') + '</b><p>身份公开，本关无个人角色卡，不能主动使用共享装备。开局放两枚与蓝线不同的数值标记；别人猜错他的线时，标记本次猜测值，表示“不是这个数”。界面用 ≠ 提醒错误标记的含义。</p><p class="muted small-t">拆线仍须如实公开命中或未命中；说谎者也须如实回应雷达，可以参与队友发起的对讲机交换。标记供给有限。</p></div></section>';
  }
  function unequippedCaptainNotice(V, me) {
    var captain = BB.unequippedCaptain(V); if (captain == null) return '';
    return '<section class="banner unequipped-captain-notice" role="status"><div><b>忘带装备的队长：' + esc(V.players[captain].name) + (captain === me ? '（你）' : '') + '</b><p>队长本关没有个人角色卡，不能主动使用共享装备。队长发起的双人拆线失败立即爆炸，稳定器不能保护；单人拆线与仅剩红线时公开照常。</p><p class="muted small-t">队长仍须如实回应队友的猜测，可以参与队友发起的对讲机交换和雷达问答。其他玩家以队长为目标时，按正常规则结算。</p></div></section>';
  }
  function secretNumberNotice(V, me) {
    var state = V.official && V.official.secretNumbers; if (!state) return '';
    return '<section class="banner secret-number-notice"><div><b>秘密数字牌 · 先选牌，再拆线，最后公开</b><p>行动者右邻秘密选牌。只在实际剪到该值时追加一格引爆器；探测器未剪候选不计。公开后牌交给行动者，完成值退场，只剩一个蓝值时弃掉其牌。咖啡杯跳过拆线并直接收牌。</p>' + (me >= 0 ? '<p><b>你的秘密数字牌：</b>' + (state.hand.length ? state.hand.map(function (v) { return '<span class="tag">' + v + '</span>'; }).join(' ') : '无') + '（仅你可见）</p>' : '') + '<p class="muted small-t">牌堆剩余 ' + state.deckCount + ' 张；右邻无牌时继续向右寻找有牌玩家。</p></div></section>';
  }
  function constraintRingNotice(V,me){var c=BB.constraintRing(V);if(!c)return '';return '<section class="nano-panel" aria-label="轮转个人限制"><b>轮转个人限制 · 剩余换牌 '+c.remaining+' 张</b><p>每人遵守自己当前限制；无法行动免费跳过。队长回合开始可经全队同意轮转全部牌位。下方按顺时针列出牌位。付一格换自己的限制，不能打断正在结算的动作；公开红线不受限制。本开发版本采用德文全队无行动立即引爆。</p><div class="bound-grid">'+c.ring.map(function(slot,i){var d=BB.CONSTRAINTS[slot.id],name=slot.owner===null?'队长'+(slot.side==='left'?'左侧':'右侧')+'额外牌位':V.players[slot.owner].name;return '<details class="bound-card" data-ring-slot="'+i+'"><summary>'+esc(name)+(slot.owner===me?'（你）':'')+' · '+slot.id+' '+esc(d.name)+'</summary><p>'+esc(d.desc)+'</p></details>';}).join('')+'</div>'+(me>=0&&V.phase==='play'&&!V.pending&&!V.paused?'<button class="btn small" data-act="constraint-replace"'+(c.remaining?'':' disabled')+'>换自己的限制 · 引爆器＋1</button>':'')+'</section>';}
  function numberRewardsNotice(V){var r=BB.numberRewards(V);if(!r)return '';return '<section class="nano-panel" aria-label="完成数字奖励"><b>完成数字奖励 · 再前进 '+(V.detMax-V.det)+' 格引爆</b><p>引爆器从骷髅前橙色空格开始。每张公开数字的四根蓝线全部剪完时，后退一格，每个数字只奖励一次。未列出的数字仍可正常拆；红线仍须轮到玩家主动公开。</p><div class="row">'+r.values.map(function(v){var done=r.completed.indexOf(v)>=0;return '<span class="tag route-card'+(done?' route-back':'')+'" data-number-reward="'+v+'">'+v+' · '+countCut(V,v)+'/4'+(done?' · 已奖励':'')+'</span>';}).join('')+'</div></section>';}
  function numberRelayNotice(V){var r=BB.numberRelay(V);if(!r)return '';return '<section class="nano-panel" aria-label="数字牌接力"><b>数字牌接力 · 官方仅3–5人</b><p>只能拆自己正面数字牌对应的值；不匹配时罚格跳过。结束传一张牌，背面也可传；清空导线传牌后仍有正面牌会失败。咖啡杯跳过整回合，不传牌。</p>'+r.hands.map(function(hand,owner){return '<p>'+esc(V.players[owner].name)+'：'+(hand.length?hand.map(function(card){return '<span class="tag route-card'+(card.completed?' route-back':'')+'">'+(card.completed?'背面':card.value)+'</span>';}).join(' '):'无数字牌')+'</p>';}).join('')+'</section>';}
  function robotRouteNotice(V){
    // 路线牌与奖励数字牌属于不同任务，不互相限制宣告值。
    var r=BB.robotRoute(V);if(!r)return '';
    var here=r.completed.indexOf(r.row[r.position])>=0?'第'+(r.position+1)+'牌位（已完成）':r.row[r.position];
    return '<section class="nano-panel" aria-label="机器人数字路线"><b>机器人数字路线 · '+here+' · 朝'+(r.direction===1?'右 →':'左 ←')+'</b><p>先向前移动或停留在自己持有的蓝值，再拆该值，最后选择朝向。没有可达蓝值时才可在回合开始反向，推进引爆器一格；咖啡杯跳过整个回合。完成四根后数字牌翻面，保留原牌位。</p><div class="row">'+r.row.map(function(v,i){var done=r.completed.indexOf(v)>=0;return '<span class="tag route-card'+(done?' route-back':'')+(i===r.position?' robot-position':'')+'" data-route-value="'+v+'" aria-label="第'+(i+1)+'张'+(done?'数字牌已完成，背面朝上':'数字牌 '+v)+'">'+(i===r.position?'🤖 '+(r.direction===1?'→ ':'← '):'')+(done?'已完成 ✓':v)+'</span>';}).join('')+'</div></section>';
  }
  function boundConstraintNotice(V){var c=V.official&&V.official.constraints;if(!c||c.kind!=='bound')return '';return '<section class="nano-panel bound-constraints" aria-label="数字绑定限制"><b>数字绑定限制 · '+(c.active?esc(c.active+' '+BB.CONSTRAINTS[c.active].name):'尚无生效限制')+'</b><p>每完成四根同值蓝线，立即启用该数字旁的限制，全队遵守一条共享限制。无法行动免费跳过；全队无合法行动引爆。公开红线不受限制。</p><div class="bound-grid">'+c.bindings.map(function(item){var d=BB.CONSTRAINTS[item.id];return '<details class="bound-card'+(item.completed?' completed':'')+'" data-bound="'+item.value+'"'+(S.boundOpen&&S.boundOpen[item.value]?' open':'')+'><summary>'+item.value+' · '+item.id+' '+esc(d.name)+(item.completed?'（已完成）':'')+'</summary><p>'+esc(d.desc)+'</p></details>';}).join('')+'</div></section>';}
  document.addEventListener('toggle',function(event){if(event.target.matches&&event.target.matches('.bound-card')){S.boundOpen=S.boundOpen||{};S.boundOpen[event.target.dataset.bound]=event.target.open;}},true);
  function allOutwardNotice(V){return BB.allOutward(V)?'<section class="banner all-outward-notice"><div><b>'+ (BB.doubleOutward(V)?'每人两根朝外导线':'每人一根朝外导线') +'</b><p>本人看不到自己的朝外线，队友可见。主人主动盲拆，失败立即引爆；队友剪中朝外线，引爆器额外前进一格。任何装备都不能影响朝外线；不使用数字卡。</p></div></section>':'';}
  function xNotice(V) {
    if (!V.official || !V.official.unsortedX) return '';
    if(BB.yellowBeforeX(V))return '<section class="banner x-notice" role="status"><div><b>先拆四根黄线，再拆蓝色X线 · '+V.official.yellowBeforeX.cut+'/4 黄线已剪</b><p>每人预先发一根随机蓝色X线，整手只有一根，留在最右端、不参与排序。'+(BB.xLocked(V)?'X线仍锁定，不能作为自己的配对线或队友目标。':'X线已解锁，可普通单人或双人拆线。')+'</p><p>所有共享及个人装备始终忽略X线，不使用共享或个人对讲机。</p></div></section>';
    return '<section class="banner x-notice" role="status"><div><b>最右侧X导线 · 不参与排序</b><p>每人最后收到的一根线留在其线架最右侧，不论数值大小。每人只有一根X，两架合计。X不能放初始信息标记；普通双人、单人拆线和公开红线照常处理。</p><p class="muted small-t">所有个人与共享装备忽略X：探测器不指X，雷达不计X，标签、便利贴、稳定器和X/Y射线不能影响X。对讲机不入局。X被普通猜错时仍可获得失败信息标记。</p></div></section>';
  }
  function redNumberNotice(V) {
    var value = BB.redNumber(V);
    if (value == null) return '';
    return '<section class="banner red-number-notice" role="status"><div><b>蓝线变红 · 数字卡：' + value + '</b><p>四根「' + value + '」在本关都视为红线，保留原数字与排序位置。不可宣告或剪掉，只能在轮到你且手中仅剩红线时公开；同编号装备不入局。</p><p>初始信息标记可标这四根线。' + (V.np === 2 ? '双人局队长不放初始标记。' : '') + '</p></div></section>';
  }
  function blindEquipmentNotice(V) {
    var state = V.official && V.official.blindEquipment;
    if (!state) return '';
    var value = state.value, progress = value == null ? '' : ' · 当前已剪 ' + countCut(V, value) + '/4 根';
    return '<section class="banner blind-equipment" role="status"><div><b>盲开工具箱' + (value == null ? ' · 数字牌堆已结束' : ' · 当前数字卡：' + value) + '</b><p>' + (value == null ? '没有后续数字卡。' : '完成蓝色「' + value + '」的四根后，可盲翻一张共享装备。' + progress) + '</p><p>平常拆线可宣告自己持有的任意合法值，不限当前数字卡。翻开的装备无需编号解锁，仍各只能使用一次。背面装备不能查看身份。</p><p class="muted">数字牌堆剩余 ' + state.remaining + ' 张 · 背面装备 ' + state.hidden + ' 张。已经完成的数字会直接跳过，不重复领奖。</p></div></section>';
  }
  function setupActors(V) {
    if (V.phase !== 'setup') return [];
    if (V.ruleset === 'physical') {
      var next = BB.setupActor(V);
      return next >= 0 ? [next] : [];
    }
    return V.players.map(function (_, i) { return i; }).filter(function (i) { return V.setup[i] < BB.setupNeed(V, i); });
  }
  function canPlaceInfo(V, i) { return i >= 0 && !V.paused && setupActors(V).indexOf(i) >= 0; }
  function setupStatus(V, i) {
    var done = V.setup[i] >= BB.setupNeed(V, i), active = canPlaceInfo(V, i);
    return { done: done, active: active, label: done ? '已标记' : V.paused ? '标记已暂停' : active ? '正在标记' : '等待标记' };
  }
  function setupWaiting(V, me) {
    var names = setupActors(V).map(function (i) { return esc(V.players[i].name) + (i === me ? '（你）' : ''); }).join('、');
    return (V.ruleset === 'physical' ? '轮到 ' : '等待 ') + names + ' 放置标记';
  }
  function setupNotice(V, me) {
    if (V.phase !== 'setup' || V.paused) return '';
    var own = canPlaceInfo(V, me);
    return '<section class="banner setup-notice' + (own ? ' turn-notice' : '') + '" role="status" aria-label="开局标记进度"><div><b>' + setupWaiting(V, me) + '</b><p>' +
      (own ? setupInstruction(V, me) : '请等待标记完成。') +
      (V.ruleset === 'physical' ? BB.allFalseInfo(V)?'从队长开始，每人给两根不同的蓝线或红线放错误标记。': V.official && V.official.nano && V.np === 2 ? '双人：队长随机抽取一个蓝色信息标记，另一位自行选择一个蓝线标记。' : V.official && (V.official.riskyRedCut || V.official.randomInitialClues) ? (V.official.randomInitialClues ? (V.official.randomInitialYellow ? '按队长顺序，每人摆放一个随机抽取的信息标记；可能抽到黄色。' : '按队长顺序，每人摆放一个随机抽取的蓝色标记。') : '按队长顺序摆放随机抽取的蓝色标记；双人队长不抽标记。') : V.official && V.official.clues === 'missing-values' ? '从队长开始，每人同时选择两个自己没有的值；不足两个则少放。' : V.official && V.official.clues === 'yellow-draft' && V.np === 2 ? '双人时队长不放开局标记，另一人放一个蓝线标记。' : '从队长开始，依次每人放置 1 个标记。' : '本关可同时标记；每人需放置 ' + V.infoN + ' 个。') + '</p></div></section>';
  }
  function setupInstruction(V, me) {
    if(V.official&&V.official.fakeSetup)return '点击自己尚未选择的'+(V.official.fakeSetup.redAllowed?'蓝线或红线':'蓝线')+'，再选择不同数值。还需放 '+(BB.setupNeed(V,me)-V.setup[me])+' 个错误标记。';
    if (V.official && (V.official.riskyRedCut || V.official.randomInitialClues)) return '摆放随机抽到的信息标记；没有该值时旁置，有同值导线时自行选择一根。';
    return (V.official && V.official.clues === 'missing-values' ? '选择自己没有的数值，一次提交全部旁置标记。' : '点击自己的一根蓝线。') + '还需放 ' + (BB.setupNeed(V, me) - V.setup[me]) + ' 个标记。';
  }
  function sideClues(V, owner) {
    var memory=BB.memorySea(V);if(memory)return memory.side.filter(function(t){return t.owner===owner;}).map(function(t){return '<span class="tag side-clue" title="记忆线索旁置，不标明对应导线">第'+(t.rack+1)+'排旁 · '+(t.value==='Y'?'黄':t.value)+'</span>';}).join('');
    var tokens = V.official && V.official.sideClues || [];
    return tokens.filter(function (token) { return token.owner === owner; }).map(function (token) { return '<span class="tag side-clue" title="旁置时，两个线架合起来没有该值；交换后不自动更新">第' + (token.rack + 1) + '排旁 · ' + (token.value === 'Y' ? '黄' : token.value) + '</span>'; }).join('');
  }
  function clueNotice(V, me) {
    var pd = V.pending;
    var side = V.official && V.official.sideClues || [];
    var summary = side.length ? '<section class="banner"><div><b>旁置信息标记</b><p>' + V.players.map(function (p, owner) { return side.some(function (token) { return token.owner === owner; }) ? esc(p.name) + '：' + sideClues(V, owner) : ''; }).filter(Boolean).join('；') + '</p><p class="muted small-t">表示摆放时整手牌没有该值；交换导线后，旁置标记不自动更新。</p></div></section>' : '';
    var pool = V.official && V.official.cluePool || [];
    if (pool.length) summary += '<section class="banner clue-pool" aria-label="公开待选信息标记"><div><b>公开待选标记：</b>' + pool.map(function (token) { return '<span class="tag" data-token="' + token.id + '">' + token.value + '</span>'; }).join(' ') + '</div></section>';
    if (!pd || pd.type !== 'clue') return summary;
    return summary + '<section class="banner' + (pd.to === me && !V.paused ? ' turn-notice' : '') + '" role="status"><div><b>黄线奖励 · 轮到 ' + esc(V.players[pd.to].name) + (pd.to === me ? '（你）' : '') + '</b><p>' + (pd.step === 'choose' ? '选择一个信息标记。' : '摆放已选的 ' + pd.token.value + ' 标记；有多个同值导线时可自行选择。') + '所有标记摆放完成后，继续拆线回合。</p></div></section>';
  }
  function announcementNotice(V) {
    if (!V.announcement) return '';
    var a = V.announcement;
    if(a.frequencyOnly)return '<div class="banner unique-announcement"><b>×1标记已用尽：</b>'+esc(announcementWhere(V,a.id))+' 的值在此架只出现一次（含已剪线）。本次为临时口头提示。</div>';
    var text = a.side ? a.side.map(function (token) { return V.players[token.owner].name + ' 的手牌没有「' + (token.value === 'Y' ? '黄' : token.value) + '」'; }).join('；') : announcementWhere(V, a.id) + ' 的数值公开宣告为 ' + infoTxt(a.info);
    return '<div class="banner"><b>信息标记已用尽：</b>' + esc(text) + '。请记住此口头信息。</div>';
  }
  function turnNotice(V, me) {
    if(V.pending&&V.pending.type==='number-relay'&&V.pending.to===me&&!V.paused)return '<section class="banner turn-notice"><b>轮到你传数字牌！</b><p>选择自己的一张牌及另一名队友；清空导线时先处理正面牌。</p></section>';
    if(V.pending&&V.pending.type==='constraint-vote'&&V.pending.to===me&&!V.paused)return '<section class="banner turn-notice"><b>轮到你确认限制轮转！</b><p>请决定是否同意队长提议，全队同意后才会移动限制牌。</p></section>';
    var c=BB.constraintRing(V);if(c&&c.captainPending&&V.phase==='play'&&V.turn===me&&!V.paused)return '<section class="banner turn-notice"><b>轮到你决定本轮是否轮转限制！</b><p>保留现有牌位，或提议全部顺／逆时针移动一位。</p></section>';
    if(V.pending&&V.pending.type==='robot-direction'&&V.pending.to===me&&!V.paused)return '<section class="banner turn-notice" aria-label="你的朝向选择"><div><b>轮到你选择机器人的朝向！</b><p>拆线已经结算，请选择朝左或朝右；确认后下一位行动。</p></div></section>';
    if (!isMyTurn(V, me)) return '';
    return '<section class="banner turn-notice" aria-label="你的回合"><div><b>轮到你了，' + esc(V.players[me].name) + '！</b><p>第 ' + V.turnNo + ' 回合 · 请选择本回合的行动。</p></div></section>';
  }
  function communicationNotice(V, me) {
    if (!BB.communicationRule(V)) return '';
    var active = V.phase === 'play' && !V.paused;
    return '<section class="banner communication-notice" aria-label="本关沟通限制"><div><b>不能直接说出导线数值</b><p>可用手势、拼写或描述代替。点击数值会发送点数手势，请勿朗读数字。说出导线数值时，记录一次违规，引爆器前进一格。语音违规由玩家自行报告。</p></div>' + (me >= 0 ? '<button class="btn small" data-act="communication-penalty"' + (active ? '' : ' disabled') + '>记录一次说出数值（引爆器＋1）</button>' : '') + '</section>';
  }
  function cutTarget(V, call) {
    var target = call && wireOf(V, call.ids[0]);
    return target ? target.o : -1;
  }
  function cutDeclarationText(V, call, me) {
    if(call.type==='disintegrator')return '分解器抽到蓝色「'+call.vals[0]+'」'+(call.ids.length?'，已同时剪掉全队该值剩余 '+call.ids.length+' 根蓝线。':'；没有该值的未剪蓝线，卡牌已用尽，不重新抽取。');
    if(call.type==='vip-cut')return V.players[call.from].name+' 使用单剪通行证，所选的两根「'+BB.valLabel(call.vals[0])+'」已剪：'+riskyPositions(V,call)+'。';
    if(call.type==='grapple')return V.players[call.from].name+' 用抓钩取走 '+V.players[call.source.p].name+' 第'+(call.source.s+1)+'架第'+(call.source.pos+1)+'根线。'+(call.destination?'已插入 '+V.players[call.destination.p].name+' 第'+(call.destination.s+1)+'架第'+(call.destination.pos+1)+'根；数值不公开。':'等待本人选择放入自己的哪一架；数值不公开。');
    if (call.type === 'yellow-three-cut') return V.players[call.from].name + ' 选中了' + riskyPositions(V,call) + '，宣告三根都是黄线。' + (V.pending && V.pending.type === 'yellow-three-cut' ? '等待 ' + V.players[call.to].name + ' 公开回应。' : call.result ? call.result.matched ? '三根黄线已同时剪断。' : '未全部猜中，本次推进引爆器一格。' : '本次行动已结束，请查看任务结果。');
    if (call.type === 'tripwire-cut') return V.players[call.from].name + ' 选择了' + riskyPositions(V,call) + '，宣告是绊线。' + (call.result ? call.result.matched ? '黄线已安全处理。' : '选中的线不是绊线。' : '等待队友公开回应。');
    if (call.type === 'precision-cut') return V.players[call.from].name + ' 选中了' + riskyPositions(V, call) + '，宣告四根都是「' + call.vals[0] + '」。' + (call.result ? call.result.matched ? (V.official && V.official.precision && V.official.precision.rewardKind === 'numbers' ? '四根已同时剪断，接下来分发剩余数字牌并放置奖励线索。' : '四根已同时剪断，剩余装备直接解锁。') : '选中导线不正确，炸弹爆炸。' : '等待被选玩家公开回应。');
    if (call.type === 'risky-cut') return V.players[call.from].name + ' 选中了' + riskyPositions(V, call) + '，宣告三根都是红线。' + (call.to === me ? '轮到你公开回应自己被选中的导线。' : '等待 ' + V.players[call.to].name + ' 公开回应。');
    var racks = {};
    call.ids.forEach(function (id) {
      var target = wireOf(V, id);
      if (target) (racks[target.s + 1] = racks[target.s + 1] || []).push(target.st.indexOf(target.w) + 1);
    });
    var where = Object.keys(racks).map(function (rack) {
      return '第 ' + rack + ' 排第 ' + racks[rack].sort(function (a, b) { return a - b; }).join('、') + ' 根线';
    }).join('、');
    var owner = cutTarget(V, call);
    var whose = owner === me ? '你的' : V.players[owner].name + ' 的';
    return V.players[call.from].name + ' 选中了' + whose + where + '，宣告为「' + call.vals.map(function (value) { return BB.announcementLabel(V, value); }).join(' 或 ') + '」。';
  }
  function cutResponse(V, call) {
    if(call.type==='grapple'||call.type==='vip-cut'||call.type==='disintegrator')return null;
    if (call.step === 'own') return { matched: true, wire: call.hit, value: call.hitVal };
    var result = call.result;
    if (!result && !BB.usesCutChoices(V) && V.ruleset === 'custom' && V.lastAct && ['hit', 'miss', 'boom'].indexOf(V.lastAct.t) >= 0) {
      result = { matched: V.lastAct.t === 'hit', wire: call.ids.find(function (id) { return V.lastAct.ids.indexOf(id) >= 0; }) };
    }
    if (!result) return null;
    var wire = result.wire != null ? wireOf(V, result.wire) : null;
    var matched = result.targetMatched != null ? result.targetMatched : result.matched;
    return { matched: matched, wire: result.wire, outwardFailed: !!result.outwardFailed,
      value: matched && wire && (wire.w.cut || V.phase === 'won' || V.phase === 'lost') && wire.w.v != null ? BB.annOf(wire.w) : null };
  }
  function cutResponseText(V, call, response) {
    if (call.type === 'yellow-three-cut') return response.matched ? '三黄拆线成功：三根黄线同时剪断。' : '三黄未全部猜中：不剪导线，引爆器前进一格。';
    if (call.type === 'tripwire-cut') return response.matched ? '绊线已安全处理，'+(call.result.retreated?'引爆器后退一格。':'引爆器已在最早时间格。') : '所选导线不是绊线。';
    if (call.type === 'precision-cut') return response.matched ? '精准拆线成功：四根同时剪断。' : '精准拆线选错，炸弹爆炸。';
    if (call.type === 'risky-cut') return response.matched ? '冒险拆线成功：三根红线已同时剪断。' : '冒险拆线选中了非红线，炸弹爆炸。';
    var answer = response.matched ? '命中' + (response.value != null ? '，选定的线是「' + BB.announcementLabel(V, response.value) + '」' : '') : '未命中，所指的线不是「' + call.vals.map(function (value) { return BB.announcementLabel(V, value); }).join(' 或 ') + '」';
    return V.players[cutTarget(V, call)].name + ' 公开回应：' + answer + '。' + (response.outwardFailed ? ' '+V.players[call.from].name+' 的朝外线拆线失败，炸弹爆炸。' : '');
  }
  function riskyPositions(V, call) {
    return call.ids.map(function (id) { var item = wireOf(V, id); return V.players[item.o].name + ' 第' + (item.s + 1) + '排第' + (item.st.findIndex(function (w) { return w.id === id; }) + 1) + '根'; }).join('、');
  }
  function targetNotice(V, me) {
    var call = cutDeclaration(V);
    if (!call) return '';
    if(call.type==='disintegrator')return '<section class="banner target-notice disintegrator-notice" role="status"><div><b>分解器 · 蓝色 '+call.vals[0]+'</b><p>'+esc(cutDeclarationText(V,call,me))+'</p></div></section>';
    if(call.type==='vip-cut')return '<section class="banner target-notice vip-notice" role="status"><div><b>单剪通行证 · 两根已剪</b><p>'+esc(cutDeclarationText(V,call,me))+'</p></div></section>';
    if(call.type==='grapple')return '<section class="banner target-notice grapple-notice" role="status"><div><b>抓钩 · 公开移动位置</b><p>'+esc(cutDeclarationText(V,call,me))+'</p></div></section>';
    if (call.type === 'yellow-three-cut') return '<section class="banner target-notice" aria-label="公开三黄拆线宣告"><div><b>三黄拆线 · 三根黄线</b><p class="target-declaration">' + esc(cutDeclarationText(V,call,me)) + '</p><p class="cut-response">' + esc((call.answers||[]).map(function(x){return V.players[wireOf(V,x.wire).o].name+' 回应：'+(x.matched?'是黄线':'不是黄线');}).join('；')) + '</p></div><button class="btn small" data-act="locate-target">查看选中导线</button></section>';
    if (call.type === 'precision-cut') return '<section class="banner target-notice"><div><b>精准拆线 · 四根「' + call.vals[0] + '」</b><p>' + esc(cutDeclarationText(V,call,me)) + '</p><p>' + esc((call.answers||[]).map(function(x){return V.players[wireOf(V,x.wire).o].name+' 回应：'+(x.matched?'正确':'不正确');}).join('；')) + '</p></div><button class="btn small" data-act="locate-target">查看选中导线</button></section>';
    if (call.type === 'risky-cut') {
      var positions = riskyPositions(V, call);
      var replies = (call.answers || []).map(function (answer) { var item = wireOf(V, answer.wire); return V.players[item.o].name + ' 回应：选中的线' + (answer.red ? '是红线' : '不是红线'); }).join('；');
      return '<section class="banner target-notice" aria-label="公开冒险拆线宣告"><div><b>冒险拆线 · 三根红线</b><p class="target-declaration">' + esc(V.players[call.from].name + ' 选中了' + positions + '，宣告三根都是红线。') + '</p>' + (replies ? '<p class="cut-response">' + esc(replies) + '</p>' : '') + '<p>' + (V.pending && V.pending.type === 'risky-cut' ? '等待 ' + esc(V.players[call.to].name) + ' 公开确认被选中的导线；全部回应后同时剪断。' : call.result && call.result.matched ? '三根红线已同时剪断。' : '选中了非红线，炸弹爆炸。') + '</p></div><button class="btn small" data-act="locate-target">查看被选中的线</button></section>';
    }
    var owner = cutTarget(V, call), targetMe = owner === me;
    var pending = V.pending && V.pending.type === 'cut';
    var response = cutResponse(V, call);
    var instruction = V.paused ? '牌局已暂停，等待房主继续。' : V.pending&&['submarine-red','submarine-transfer'].indexOf(V.pending.type)>=0&&BB.submarine54(V)&&BB.submarine54(V).suspendedAction ? '本次拆线暂停；先由播报指定玩家完成本次选择，再继续原来的选线。' : pending ? call.step === 'target' ? targetMe ? (call.noSafe ? '红色箭头指向被选中的线。轮到你回应：点击“确认本次没有安全线”。' : '红色箭头指向被选中的线。轮到你回应：点击其中可操作的一根。') : '红色箭头指向被选中的线，等待 ' + V.players[owner].name + ' 公开回应。' : call.from === me ? '队友已确认命中，请选择你自己匹配的线。' : '等待 ' + V.players[call.from].name + ' 选择自己的匹配线。' : '本次拆线已结算，红色箭头指向本次选中的线。';
    return '<section class="banner target-notice" aria-label="公开拆线宣告"><div><b>' + (targetMe ? '队友选中了你的线' : '公开拆线宣告') + ' · ' + esc(call.label) + '</b><p class="target-declaration">' + esc(cutDeclarationText(V, call, me)) + '</p>' + (response ? '<p class="cut-response"><b>' + esc(cutResponseText(V, call, response)) + '</b></p>' : '') + '<p>' + esc(instruction) + '</p></div><button class="btn small" data-act="locate-target">查看被选中的线</button></section>';
  }
  function declaredTarget(V, id) {
    var memory=BB.memorySea(V);if(memory&&memory.point&&memory.point.wire===id)return true;
    var call = cutDeclaration(V);
    if (!call) return false;
    var chosen = call.step === 'own' ? call.hit : call.result && call.result.wire;
    return chosen != null ? chosen === id : call.ids.indexOf(id) >= 0;
  }
  function equipStatus(V, me, e) {
    if (e.hidden) return { usable: false, label: '背面朝上 · 身份未知', desc: '完成当前数字的四根蓝线后，队伍可选择盲翻这张装备。', progress: '不能查看编号或效果' };
    var d = BB.EQUIP[e.n];
    if(d.activationPending)return {usable:false,label:e.used?'已结算':e.open?'即时效果尚未开放':'剪掉四根蓝'+BB.valLabel(BB.equipProgress(e.n).value)+'解锁',desc:d.desc};
    if (e.n === 9 && me >= 0 && !e.used && BB.outwardSkipAllowed(V, me)) return { usable: false, label: '本回合须跳过，稳定器不能保护', desc: d.desc + ' 本关跳过仍使引爆器前进一格。' };
    if (e.n === 9 && me >= 0 && !BB.stabilizerAllowed(V, me)) return { usable: false, label: V.official && (V.official.module === 'captain-outward-wire'||BB.allOutward(V)) ? '朝外线不能使用稳定器' : BB.unequippedCaptain(V) != null ? '不能保护本关队长' : BB.liar(V) == null ? '本关新人禁用稳定器' : '说谎者不能使用稳定器', desc: d.desc + (V.official && (V.official.module === 'captain-outward-wire'||BB.allOutward(V)) ? ' 只剩朝外线和红线，不能用稳定器保护盲猜。' : BB.unequippedCaptain(V) != null ? ' 本关队长的双人拆线失败立即爆炸。' : BB.liar(V) == null ? ' 新人不能使用此卡，也不能由队友保护新人的拆线。' : ' 说谎者本关不能主动使用装备。') };
    var command = V.official && V.official.radarCommand;
    if (command && e.n === 8) {
      var ready = !V.paused && !V.pending && V.phase === 'play' && V.turn === me && command.step === 'radar';
      return { usable: ready, label: V.paused ? '牌局已暂停' : ready ? '查询本回合数字' : '等待轮值玩家查询', progress: '无须编号解锁 · 每回合重复使用', desc: '本关每回合翻数字卡后，轮值玩家查询该数字；每人逐架公开回应有或没有，再由轮值玩家指定一人拆线。' };
    }
    var allowed = me >= 0 && BB.equipmentAllowed(V, me) && !(BB.constraint(V, me) === 'H' && e.n === 4);
    var anytime = d.any && !(V.ruleset === 'custom' && e.n === 2);
    var myTurn = BB.turnActor(V) === me && V.phase === 'play' && !V.pending && BB.ownTurnAllowed(V,me);
    var usable = (e.n !== 6 || V.det > BB.dialMin(V)) && !(V.audio&&V.audio.cutHeld) && !V.paused && me >= 0 && allowed && !(V.official && V.official.constraints && V.official.constraints.captainPending && V.turn === me) && e.open && !e.used && V.phase === 'play' && !V.pending && (anytime || myTurn);
    var unlock = BB.equipProgress(e.n);
    var conditions = e.unlockConditions;
    var progress = conditions ? conditions.map(function (condition) {
      return (condition.kind === 'number' ? '附加数字 ' : '印刷条件 ') + BB.valLabel(condition.value) + '：' + condition.count + '/' + (condition.value === 'Y' ? V.ymark.n : 4) + (condition.kind === 'number' && condition.discarded ? '（数字卡已弃）' : condition.met ? '（已满足）' : '（两根达标）');
    }).join('；') : V.official && V.official.blindEquipment ? '已翻开 · 无需编号解锁' : null;
    return { usable: usable, label: e.used ? '已使用' : me >= 0 && !allowed ? BB.unequippedCaptain(V) === me ? '本关队长不能主动使用装备' : BB.liar(V) === me ? '说谎者不能主动使用装备' : '当前限制禁用此装备' : e.open ? (V.paused ? '牌局已暂停' : e.n === 6 && V.det <= BB.dialMin(V) ? '已在最早时间格，不能后退' : V.pending ? '等待当前选择完成，暂不可用' : usable || anytime ? '可使用' : '仅限自己回合') : conditions ? '两项解锁条件尚未同时满足' : '剪掉 ' + unlock.count + ' 根 ' + BB.valLabel(unlock.value) + ' 解锁', progress: progress,
      desc: conditions ? d.desc + ' 本关还需剪掉两根附加数字「' + BB.valLabel(conditions[1].value) + '」；同值时同一对导线即可满足两项条件。' : e.n===9&&BB.oxygen(V)?d.desc+' 本关也可先使用此卡，再跳过回合，避免引爆器前进。':null };
  }
  function detonator(V) {
    if(BB.robotPressure(V))return '<span class="tag pressure-status">'+esc(BB.detonatorText(V))+'</span>';
    var cells = '', printed = V.mission && V.mission.printedDial;
    if (printed) {
      var position = V.det - BB.dialMin(V), labels = ['5人', '4人', '3人', '2人', '空格', '☠'];
      labels.forEach(function (label, i) { cells += '<span class="det-c printed' + (i === position ? ' current' : '') + (i === 5 ? ' skull' : '') + '" title="' + (i === position ? '当前时间格：' : '') + label + '">' + label + '</span>'; });
    } else for (var i = 0; i < V.detMax; i++) cells += '<span class="det-c' + (i < V.det ? ' on' : '') + (i === V.detMax - 1 ? ' skull' : '') + '">' + (i === V.detMax - 1 ? '☠' : '') + '</span>';
    return '<div class="det" title="' + esc(BB.detonatorText(V)) + '"><span class="det-l">引爆器</span>' + cells + '<span class="det-n">' + esc(BB.detonatorText(V)) + '</span></div>';
  }
  function countCut(V, val) {
    var c = 0;
    V.players.forEach(function (p) { p.stands.forEach(function (st) { st.forEach(function (w) { if (w.cut && w.v != null && BB.annOf(w) === val) c++; }); }); });
    return c;
  }
  function track(V, m) {
    var memory=BB.memorySea(V),h = '<div class="track"><span class="sub-l">'+(memory?'蓝线数值（不放完成标记）':'剪线进度')+'</span>';
    for (var v = m.blue[0]; v <= m.blue[1]; v++) {
      var c = countCut(V, v), si = V.seq.indexOf(v);
      if (v === BB.redNumber(V)) { h += '<span class="tr converted-red" title="本关四根 ' + v + ' 都视为红线，只能在仅剩红线时公开"><b>' + v + '</b><span>红线</span></span>'; continue; }
      var pips = '';
      for (var k = 0; k < 4; k++) pips += '<i class="' + (k < c ? 'on' : '') + '"></i>';
      h += '<span class="tr' + (c >= 4 && !memory ? ' done' : '') + (V.missing === v ? ' miss' : '') + '" title="数值 ' + v + (memory?'':'：已剪 ' + c + ' 根')+'">' +
        (si >= 0 ? '<sup class="seqn">' + (si + 1) + '</sup>' : '') + '<b>' + v + '</b>'+(memory?'':'<span class="pips">' + pips + '</span>')+'</span>';
    }
    h += '</div>';
    if (V.seq.length) h += '<p class="muted small-t">顺序引信：' + V.seq.join(' → ') + '（前一个数值剪掉 ' + (V.official && V.official.sequence ? V.official.sequence.threshold : 4) + ' 根后解锁下一个）</p>';
    if (V.missing) h += '<p class="muted small-t">本局缺失的数值是 <b>' + V.missing + '</b>。</p>';
    return h;
  }
  function markers(V) {
    function one(mk, cls, nm) {
      if(BB.memorySea(V))return '';
      if (!mk.n && !mk.cand.length) return '';
      var cand = mk.cand.length ? mk.cand.map(function (c) { return '<span class="mk ' + cls + '">' + c.toFixed(1) + '</span>'; }).join('') : '<span class="muted">位置未公开</span>';
      return '<div class="mkrow"><span class="sub-l">' + nm + ' ' + mk.n + (mk.cand.length > mk.n ? '（' + mk.cand.length + ' 选 ' + mk.n + '）' : ' 根') + '</span>' + cand + '</div>';
    }
    var h = one(V.ymark, 'y', '黄线') + one(V.rmark, 'r', '红线');
    if (V.radar) h += '<div class="mkrow"><span class="sub-l">雷达「' + BB.announcementLabel(V, V.radar.val) + '」</span>' + V.players.map(function (p, i) { return '<span class="tag">' + esc(p.name) + (Array.isArray(V.radar.res[i]) ? V.radar.res[i].map(function (yes, si) { return ' 第' + (si + 1) + '排' + (yes ? '有' : '无'); }).join('') : V.radar.res[i] ? ' 有' : ' 无') + '</span>'; }).join('') + '</div>';
    return h ? '<div class="markers">' + h + '</div>' : '';
  }
  function equipRow(V, me) {
    if (!V.equip.length) return '';
    return '<div class="equips"><span class="sub-l">装备</span>' + V.equip.map(function (e) {
      if (e.hidden) return '<button class="eq eq-hidden" data-act="hidden-equipment" data-slot="' + e.slot + '"><span class="eq-n">✕</span><span class="eq-t">未翻开的装备</span><span class="eq-s">背面朝上 · 身份未知</span><span class="eq-desc">完成当前数字的四根蓝线后，可以盲翻一张；不能预览编号或效果。</span></button>';
      var d = BB.EQUIP[e.n];
      var es = equipStatus(V, me, e), usable = es.usable, st = es.label;
      var on = S.sel && S.sel.mode === 'eq' && S.sel.n === e.n;
      var unlock = BB.equipProgress(e.n), count = countCut(V, unlock.value);
      return '<button class="eq' + (e.used ? ' used' : e.open ? ' open' : '') + (on ? ' on' : '') + '" data-act="eq" data-n="' + e.n + '" title="' + esc(es.desc || d.desc) + '">' +
        '<span class="eq-n">' + unlock.printed + '</span><span class="eq-t">' + d.name + '</span><span class="eq-s">' + st + ' · ' + (es.progress || count + '/' + (unlock.value === 'Y' ? V.ymark.n : 4) + (count >= unlock.count ? ' 解锁' : '')) + '</span><span class="eq-desc">' + esc(es.desc || d.desc) + '</span></button>';
    }).join('') + '</div>';
  }
  function endBanner(V) {
    var r = V.result || {};
    var host = isHost();
    var m = gameMission(V);
    var list = catalog(V.catalog || V.ruleset), pos = list.findIndex(function (x) { return x.id === m.id; }), next = list[pos + 1];
    return '<div class="banner ' + (r.win ? 'good' : 'bad') + '"><div><b class="big">' + (r.win ? '拆弹成功！' : '炸弹爆炸！') + '</b><p>' + esc(r.why || '') + '</p></div>' +
      (host ? '<div class="row"><button class="btn small" data-act="again">再来一次</button>' + (next ? '<button class="btn small primary" data-act="nextm">下一任务：' + next.id + '. ' + esc(next.name) + (next.status ? '（' + esc(next.status) + '）' : '') + '</button>' : '') + '<button class="btn small ghost" data-act="tolobby">回到大厅</button></div>' : '<p class="muted">等待房主选择下一步…</p>') + '</div>';
  }
  function playerBlock(V, p, i, me, mine) {
    var sel = S.sel || {};
    var marking = setupStatus(V, i), turn = (BB.turnActor(V) === i && (V.phase === 'play' || V.phase === 'constraints') && BB.ownTurnAllowed(V,i)) || marking.active;
    var left = 0;
    p.stands.forEach(function (st) { st.forEach(function (w) { if (!w.cut) left++; }); });
    var h = '<div class="pblock' + (turn ? ' turn' : '') + (mine ? ' mine' : '') + '">' +
      '<div class="ph"><span class="pname">' + esc(p.name) + (mine ? S.spectator ? '（观战视角）' : '（你）' : '') + '</span>' + (p.bot ? '<span class="tag bot">AI</span>' : '') +
      (i === (V.captain || 0) ? '<span class="tag">队长</span>' : '') +
      (BB.rookie(V) === i ? '<span class="tag warn rookie-tag">新人 · 拆线失败即爆炸</span>' : '') +
      (V.official && V.official.clues === 'mixed' ? '<span class="tag mixed-clue-tag">' + (BB.clueKind(V, i) === 'frequency' ? '频率标记' : '奇偶标记') + '</span>' : '') +
      (BB.liar(V) === i ? '<span class="tag warn liar-tag">说谎者 · 无个人装备</span>' : '') +
      (BB.unequippedCaptain(V) === i ? '<span class="tag warn unequipped-captain-tag">队长 · 无装备 · 失败即爆炸</span>' : '') +
      '<span class="muted small-t">' + p.stands.length + ' 个线架</span>' +
      (gameMission(V).dd && !BB.characterState(p).removed ? '<span class="character-card' + (BB.characterState(p).used ? ' spent' : ' ready') + '" title="角色个人能力，与共享装备分别计次">' + characterText(p) + '</span>' : '') +
      (V.official && V.official.constraints && V.official.constraints.personal && V.official.constraints.personal[i] ? '<span class="tag constraint-tag">限制 ' + V.official.constraints.personal[i].id + ' · ' + (V.official.constraints.personal[i].retired ? '已翻面' : '生效') + '</span>' : '') +
      '<span class="muted small-t">剩 ' + left + ' 根</span>' +
      (V.phase === 'setup' ? '<span class="tag' + (marking.done ? ' yes' : marking.active ? ' turn' : '') + '">' + marking.label + '</span>' : '') +
      (V.pending && V.pending.to === i ? '<span class="tag warn">等待选择</span>' : '') +
      '</div>' + sideClues(V, i);
    p.stands.forEach(function (st, si) {
      var negatives=st.reduce(function(max,w){return Math.max(max,w.info&&w.info.t==='not'?String(w.info.v).split('/').length:0);},0);
      var markerPad=Math.max(negatives>1?negatives*14+8:8,st.some(function(w){return w.unique;})?28:8);
      h += '<div class="stand-wrap"><div class="stand"'+(markerPad>8?' style="--negative-pad:'+markerPad+'px"':'')+'>';
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
  function outwardLabel(V, w) { return w.cut || V.phase === 'won' || V.phase === 'lost' ? '原朝外导线，已公开' : BB.allOutward(V)?'朝外导线，主人不可见；队友剪中额外推进引爆器，不能用装备':'朝外导线，队长不能看见，其他玩家不能选择'; }
  function tile(V, w, o, s, me, sel) {
    var k = w.v != null ? BB.kindOf(w) : null;
    var cls = 'tile';
    if (k) cls += ' k-' + k;
    if (w.v == null) cls += ' back';
    if (w.cut) cls += ' cut';
    if (sel.wires && sel.wires.indexOf(w.id) >= 0) cls += ' sel';
    if (declaredTarget(V, w.id)) cls += ' declared-target';
    if(BB.memorySea(V)&&BB.memorySea(V).point&&BB.memorySea(V).point.wire===w.id)cls+=' memory-target';
    if (V.lastAct && V.lastAct.ids.indexOf(w.id) >= 0) cls += ' flash-' + V.lastAct.t;
    if (V.pending && V.pending.type === 'cut' && V.pending.step === 'own' && V.pending.hit === w.id) cls += ' flash-hit';
    var click = clickable(V, w, o, me);
    if (click) cls += ' can';
    var label = w.v != null ? fmtV(w.v) : '';
    return '<button class="' + cls + '"' + (click ? '' : ' tabindex="-1"') + ' data-w="' + w.id + '" data-o="' + o + '" data-s="' + s + '" aria-label="' + (w.v != null ? '线 ' + label : '未知的线') + (w.kind === 'r' ? '，本关视为红线' : '') + (w.cut ? k === 'r' && w.resolution !== 'cut' ? '（已公开）' : w.resolution === 'secured' ? '（已安全处理）' : '（已剪）' : '') + (w.info?'，标记 '+esc(infoTxt(w.info)):'')+(w.unique?'，×1：整架同值只有一根，含已剪线':'') + (declaredTarget(V, w.id) ? BB.memorySea(V)&&BB.memorySea(V).point&&BB.memorySea(V).point.wire===w.id?'，当前记忆指线':'，队友已选中并宣告' : '') + '">' +
      (declaredTarget(V, w.id) ? '<span class="target-arrow" aria-hidden="true"><svg viewBox="0 0 28 36" focusable="false"><path d="M9 2H19V18H26L14 33L2 18H9Z"/></svg></span>' : '') +
      (BB.isOutward(V, w) ? '<span class="x-marker outward-marker" role="img" aria-label="' + esc(outwardLabel(V, w)) + '" title="' + esc(outwardLabel(V, w)) + '">朝外</span>' : BB.isX(V, w) ? '<span class="x-marker" role="img" aria-label="X导线，不参与排序，不能使用装备" title="X：不参与排序，不能使用装备">X</span>' : '') +
      (w.info ? '<span class="tok'+(w.info.t==='not'&&String(w.info.v).indexOf('/')>=0?' multi-not':'')+'">' + infoMarkup(w.info) + '</span>' : '') +
      (w.unique?'<span class="unique-marker" role="img" aria-label="×1：此值在整架只出现一次，含已剪线" title="此值在整架只出现一次，含已剪线">×1</span>':'')+
      '<span class="tv">' + label + '</span>' + (w.cut && (k !== 'r' || w.resolution === 'cut') ? '<span class="snip">'+(w.resolution==='secured'?'✓':'✂')+'</span>' : '') + '</button>';
  }
  function clickable(V, w, o, me) {
    if (me < 0 || V.paused || V.audio&&V.audio.cutHeld) return false;
    if (V.phase === 'setup') {
      if (V.official && (V.official.riskyRedCut || V.official.randomInitialClues)) return V.pending && V.pending.type === 'initial-clue' && V.pending.to === me && Array.isArray(V.pending.choices) && V.pending.choices.indexOf(w.id) >= 0;
      if (V.official && V.official.clues === 'missing-values') return false;
      if (V.official && V.official.fakeSetup && V.official.fakeSetup.usedIds.indexOf(w.id) >= 0) return false;
      return canPlaceInfo(V, me) && !w.cut && o === me && BB.setupInfoAllowed(V, w) && !w.info;
    }
    if (V.phase !== 'play') return false;
    if (V.pending) {
      if (w.cut) return false;
      if (V.pending.type === 'cut') return V.pending.to === me && (!V.pending.clueValues || V.pending.clueValues.length < 2 || S.sel && S.sel.mode === 'failure-clue') && Array.isArray(V.pending.choices) && V.pending.choices.indexOf(w.id) >= 0;
      if (V.pending.type === 'precision-clue') return V.pending.to === me && Array.isArray(V.pending.choices) && V.pending.choices.indexOf(w.id) >= 0;
      if (V.pending.type === 'order-clue') return V.pending.to === me && Array.isArray(V.pending.choices) && V.pending.choices.indexOf(w.id) >= 0;
      if (V.pending.type === 'number-claim-clue') return V.pending.to === me && Array.isArray(V.pending.choices) && V.pending.choices.indexOf(w.id) >= 0;
      if (V.pending.type === 'clue') return V.pending.to === me && V.pending.step === 'place' && Array.isArray(V.pending.choices) && V.pending.choices.indexOf(w.id) >= 0;
      return V.pending.type === 'walkie' && V.pending.to === me && o === me;
    }
    var sel = S.sel;
    if ((V.stab || sel && (sel.mode === 'dd' || sel.mode === 'eq' || sel.xy || sel.stab)) && !BB.equipmentWireAllowed(V, me, w)) return false;
    if (sel && sel.mode === 'tripwire') return V.turn === me && !w.cut && o !== me;
    if (sel && sel.mode === 'precision') return BB.turnActor(V) === me && !w.cut;
    if (sel && (sel.mode === 'risky' || sel.mode === 'yellow-three')) return BB.turnActor(V) === me && !w.cut;
    if (sel && sel.mode === 'eq') {
      var n = sel.n;
      if (w.cut && !(V.ruleset === 'physical' && (n === 1 || n === 12 || n===14 || n === 4 && BB.cutClueAllowed(V)) && o === me)) return false;
      if (n === 1 || n === 12 || n === 2) return o === me;
      if (n === 4) return o === me && BB.kindOf(w) === 'b' && !w.info;
      if (n === 3 || n === 5 || n === 10) return o !== me && BB.targetAllowed(V, me, Object.assign({}, w, { o: o, s: wireOf(V, w.id).s }));
      if(n===18)return o!==me&&!w.cut;
      if(n===16)return o===me&&!w.cut&&BB.kindOf(w)!=='r';
      if(n===14)return o===me&&BB.kindOf(w)==='b'&&!w.unique;
      return false;
    }
    if (w.cut) return false;
    if(BB.numberClaim(V)&&BB.numberClaim(V).step!=='cut')return false;
    if (V.official && V.official.radarCommand && V.official.radarCommand.step !== 'cut') return false;
    return BB.turnActor(V) === me && o !== me && BB.targetAllowed(V, me, Object.assign({}, w, { o: o, s: wireOf(V, w.id).s }));
  }

  function myVals(V, me) {
    var vals = [];
    V.players[me].stands.forEach(function (st) { st.forEach(function (w) { if (!w.cut && w.v != null) { var a = BB.annOf(w); if (a !== 'R' && vals.indexOf(a) < 0) vals.push(a); } }); });
    return vals.sort(function (a, b) { return (a === 'Y' ? 99 : a) - (b === 'Y' ? 99 : b); });
  }
  function seqOk(V, val) {
    if(BB.numberOrder(V))return BB.seqAllowed(V,val);
    if(V.official && V.official.yellowThree) return BB.seqAllowed(V,val);
    if(BB.arithmetic(V))return BB.seqAllowed(V,val);
    if(BB.numberClaim(V))return BB.seqAllowed(V,val);
    if (V.official && V.official.tripwire) return BB.seqAllowed(V,val);
    if (V.official && V.official.radarCommand) return V.official.radarCommand.step === 'cut' && val === V.official.radarCommand.value;
    if (V.official && V.official.precision) return BB.seqAllowed(V,val);
    if (V.official && V.official.numberEnds) return BB.seqAllowed(V, val);
    if (BB.robotRoute(V)) return BB.seqAllowed(V,val);
    if (BB.numberRelay(V)) return BB.seqAllowed(V,val);
    if (V.official && V.official.numbers && V.official.module === 'number-cycle') return V.official.numbers.open.indexOf(val) >= 0;
    if (!V.seq.length || val === 'Y') return true;
    var i = V.seq.indexOf(val);
    if (i <= 0) return true;
    return countCut(V, V.seq[i - 1]) >= (V.official && V.official.sequence ? V.official.sequence.threshold : 4) && seqOk(V, V.seq[i - 1]);
  }
  function valBtns(V, me, opts) {
    opts = opts || {};
    var vals = opts.all ? range(gameMission(V)).concat(opts.blueOnly ? [] : ['Y']) : myVals(V, me);
    if (opts.blueOnly) vals = vals.filter(function (v) { return v !== 'Y'; });
    return '<div class="vals">' + vals.map(function (v) {
      var ok = opts.all || seqOk(V, v) && BB.actorValueAllowed(V, me, v);
      var selection = S.sel;
      if (!opts.all && (V.stab || selection && (selection.mode === 'dd' || selection.mode === 'eq' || selection.xy || selection.stab))) ok = ok && V.players[me].stands.some(function (st) { return st.some(function (w) { return !w.cut && BB.matches(w, v) && BB.equipmentWireAllowed(V, me, w); }); });
      var on = opts.picked && opts.picked.indexOf(v) >= 0;
      var oxygen=BB.oxygen(V),personal=!opts.all&&BB.personalOxygen(V),passing=!opts.all&&BB.passingOxygen(V),submarine=!opts.all&&BB.submarine54(V),cost=!opts.all&&(oxygen||submarine)?BB.oxygenCost(v):personal||passing?v:null,short=cost!==null&&(passing?passing.holder!==me||passing.available<cost:(submarine?submarine.balances[me]:personal?personal.balances[me]:oxygen.available)<cost),missingRecipient=personal&&personalOxygenRecipient(V,me)===null;if(missingRecipient)ok=false;
      var claim=!opts.all&&BB.numberClaim(V),order=!opts.all&&BB.numberOrder(V),wrongNumber=(order||claim)&&v!==(order?order.value:claim.value);
      var math=!opts.all&&BB.arithmetic(V),wrongMath=math&&arithmeticResult(V)!==v;if(wrongMath)ok=false;
      return '<button class="vbtn' + (v === 'Y' ? ' y' : '') + (on ? ' on' : '') + '" data-act="val" data-v="' + v + '"'+(missingRecipient?' title="请先选择接收氧气的队友"':cost!==null?' title="需要 '+cost+' 枚氧气'+(short?'，当前不足':'')+'"':wrongNumber?' title="本回合必须拆数字牌上的 '+(order?order.value:claim.value)+'"':wrongMath?' title="请先选择结果为 '+v+' 的两张数字牌和运算"':'') + (ok && opts.enabled !== false && !short ? '' : ' disabled') + '>' + (v === 'Y' ? '黄' : v) + '</button>';
    }).join('') + '</div>';
  }
  function range(m) { var a = []; for (var v = m.blue[0]; v <= m.blue[1]; v++) a.push(v); return a; }

  function actionPanel(V, me) {
    var P = V.players[me], h = '<div class="act">';
    var over = V.phase === 'won' || V.phase === 'lost';
    if (over) return h + '<p class="muted">所有线已公开，看看炸弹的真实结构吧。</p></div>';
    if (V.paused) return h + '<p class="step">牌局已暂停。' + (canManageGame() ? '点击上方“继续牌局”恢复。' : '等待房主继续。') + '</p></div>';
    if(V.audio&&V.audio.cutHeld&&V.phase==='play')return h+'<p class="step">请停止操作，收听录音指令。服务器将在指令结束后恢复行动。</p></div>';
    if(V.phase==='audio-ready')return h+'<p class="step">'+(V.audio&&V.audio.preparation?'请在上方准备音频、开启声音并确认就绪。全员就绪后由房主统一开始，准备期间不计时。':'官方音频事件尚未核实，当前不能开始拆线。房主可以暂停或退出牌局。')+'</p></div>';
    var weak=BB.weakLink(V);if(weak&&weak.startPending&&!V.pending){if(V.turn!==me)return h+'<p class="step">等待 '+esc(V.players[V.turn].name)+' 完成回合开始决定。</p></div>';if(!S.sel||S.sel.mode!=='weak-guess'||S.sel.id!==weak.decisionId)S.sel={mode:'weak-guess',id:weak.decisionId};var guess=S.sel;return h+'<p class="step">'+(weak.ownWeak?'你是秘密弱环节，不能猜身份，请继续并遵守自己的限制。':'回合开始：可独立猜弱环节及其限制，不能与队友讨论。猜错罚一格，猜对公开角色并解锁个人装备。')+'</p>'+(weak.ownWeak?'':'<div class="row">'+V.players.map(function(p,i){return '<button class="btn small'+(guess.player===i?' primary':'')+'" data-act="weak-player" data-p="'+i+'">'+esc(p.name)+'</button>';}).join('')+'</div><div class="row">'+['A','B','C','D','E'].map(function(id){return '<button class="btn small'+(guess.constraint===id?' primary':'')+'" data-act="weak-constraint" data-id="'+id+'">'+id+' · '+esc(BB.CONSTRAINTS[id].name)+'</button>';}).join('')+'</div><button class="btn primary" data-act="weak-confirm"'+(Number.isInteger(guess.player)&&guess.constraint?'':' disabled')+'>确认猜测</button> ')+'<button class="btn" data-act="weak-pass">'+(weak.ownWeak?'继续本回合':'本回合不猜')+'</button></div>';}
    var free=BB.freeTurn(V);if(free&&free.step==='claim'&&!V.pending)return h+'<p class="step">自由轮序：等待玩家喊“我来拆线”。任务总时间'+(free.duration/60)+'分钟，换回合不重置。'+(free.previous===null?'':('上一位：'+esc(V.players[free.previous].name)+'。'))+'</p><button class="btn primary" data-act="turn-claim"'+(BB.freeTurnEligible(V,me)?'':' disabled')+'>我来拆线</button>'+(!BB.freeTurnEligible(V,me)?'<p>你已无导线，或三人以上持线时不能连续行动。</p>':'')+'</div>';
    if(V.pending&&V.pending.type==='number-relay'){var p=V.pending,r=BB.numberRelay(V);if(p.to!==me)return h+'<p class="step">等待 '+esc(V.players[p.to].name)+' 传数字牌，随后继续。</p></div>';if(!S.sel||S.sel.mode!=='number-relay'||S.sel.id!==p.id)S.sel={mode:'number-relay',id:p.id};var choice=S.sel;return h+'<p class="step">轮到你传出一张牌。'+(p.retiring?'你已清空导线，传后仍留正面牌会失败。':'背面牌也可传。')+'</p><div class="row">'+r.hands[me].map(function(c,index){return '<button class="btn small'+(choice.value===c.value?' primary':'')+'" data-act="number-relay-card" data-value="'+c.value+'">'+(c.completed?'背面牌 '+(index+1):'数字 '+c.value)+'</button>';}).join('')+'</div><p>接收者：</p><div class="row">'+V.players.map(function(player,index){return index===me?'':'<button class="btn small'+(choice.recipient===index?' primary':'')+'" data-act="number-relay-recipient" data-p="'+index+'">'+esc(player.name)+(player.stands.flat().every(function(w){return w.cut;})?'（已无导线）':'')+'</button>';}).join('')+'</div><button class="btn primary" data-act="number-relay-confirm"'+(Number.isInteger(choice.value)&&Number.isInteger(choice.recipient)?'':' disabled')+'>确认传牌</button></div>';}
    if(V.pending&&V.pending.type==='constraint-vote'){var vote=V.pending;return h+(vote.to===me?'<p class="step">轮到你确认：是否同意全部限制'+(vote.direction===1?'顺时针':'逆时针')+'移动一位？额外牌位也参与。</p><button class="btn primary" data-act="constraint-vote" data-agree="yes">同意轮转</button> <button class="btn" data-act="constraint-vote" data-agree="no">不同意 · 保留</button>':'<p class="step">等待 '+esc(V.players[vote.to].name)+' 确认轮转，牌位尚未移动。</p>')+'</div>';}
    var ring=BB.constraintRing(V);if(ring&&ring.captainPending&&!V.pending){if(S.sel&&S.sel.mode==='eq')return h+equipPanel(V,me,S.sel)+'</div>';var remaining=P.stands.flat().filter(function(w){return !w.cut;}),onlyRed=remaining.length&&remaining.every(function(w){return BB.kindOf(w)==='r';});return h+(V.turn===me?'<p class="step">轮到队长决定本轮限制：选择轮转会请求全队确认。</p><button class="btn primary" data-act="constraint-rotation" data-direction="0">保留牌位</button> <button class="btn" data-act="constraint-rotation" data-direction="1">提议顺时针一位</button> <button class="btn" data-act="constraint-rotation" data-direction="-1">提议逆时针一位</button>'+(onlyRed?'<p>你只剩红线，公开不受限制。</p><button class="btn primary" data-act="red">公开红线</button>':''):'<p class="step">等待队长决定本轮是否轮转限制。</p>')+'</div>';}
    if(V.pending&&V.pending.type==='robot-direction'){var pd=V.pending;return h+(pd.to===me?'<p class="step">轮到你选择机器人朝向，确认后下一位行动。</p><button class="btn primary" data-act="robot-direction" data-direction="-1">朝左 ←</button> <button class="btn primary" data-act="robot-direction" data-direction="1">朝右 →</button>':'<p class="step">等待 '+esc(V.players[pd.to].name)+' 选择机器人的朝向。</p>')+'</div>';}
    var route=BB.robotRoute(V);
    if(route&&V.phase==='play'&&!V.pending&&route.step==='move'){
      if(S.sel&&S.sel.mode==='eq')return h+equipPanel(V,me,S.sel)+'</div>';
      if(V.turn!==me)return h+'<p class="step">轮到 '+esc(V.players[V.turn].name)+' 选择机器人向前移动或停留的数字。</p></div>';
      var routeValues=BB.robotRouteValues(V,me),blue=P.stands.some(function(st){return st.some(function(w){return !w.cut&&BB.kindOf(w)==='b';});});
      if(blue)return h+'<p class="step">轮到你：先选择机器人停留或前进到的蓝色数字。选项只依据你的手牌。</p><div class="row">'+routeValues.map(function(v){return '<button class="btn primary" data-act="robot-move" data-v="'+v+'">'+(route.row[route.position]===v?'停在 ':'移动到 ')+v+'</button>';}).join('')+'</div>'+(!routeValues.length?'<p>你没有当前或前方的蓝值。可以反向，推进引爆器一格。</p><button class="btn primary" data-act="robot-reverse">反向 · 引爆器＋1</button>':'')+(V.equip.some(function(e){return e.n===11&&e.open&&!e.used;})?'<button class="btn" data-act="eq" data-n="11">咖啡杯 · 跳过整个回合</button>':'')+'</div>';
    }
    if(V.phase==='memory-preview')return h+(V.pending.to===me?'<p class="step">轮到你确认上方红黄数值。所有人确认后，列表和预览会移除。</p><button class="btn primary" data-act="memory-ready">我已记住红黄数值</button>':'<p class="step">等待 '+esc(V.players[V.pending.to].name)+' 确认红黄数值。</p>')+'</div>';
    if(BB.personalOxygen(V)&&V.phase==='play'&&!V.pending&&V.turn===me)h+=personalOxygenControls(V,me);
    if(BB.arithmetic(V)&&V.phase==='play'&&!V.pending&&V.turn===me)h+=arithmeticControls(V);
    if(BB.oxygen(V)&&V.phase==='play'&&!V.pending&&V.turn===me)h+='<button class="btn small" data-act="oxygen-skip">跳过以节省氧气'+(V.stab?'（稳定器保护）':'（引爆器＋1）')+'</button>';
    if(BB.submarine54(V)&&V.phase==='play'&&!V.pending&&V.turn===me)h+='<button class="btn small" data-act="submarine-skip"'+(BB.submarineAffordable(V,me)?' disabled title="还有足够氧气可行动，或可以免费公开红线"':'')+'>缺氧跳过（引爆器＋1）</button>';
    if(BB.passingOxygen(V)&&V.phase==='play'&&!V.pending&&V.turn===me)h+='<button class="btn small" data-act="passing-oxygen-skip"'+(BB.passingAffordable(V,me)?' disabled title="还有足够氧气可行动，或可免费公开红线"':'')+'>缺氧跳过（引爆器＋1）</button>';
    if(BB.numberRelay(V)&&V.phase==='play'&&!V.pending&&V.turn===me)h+='<button class="btn small" data-act="number-relay-skip"'+(BB.relayMatching(V,me)?' disabled title="还有符合数字牌的导线，不能跳过"':'')+'>没有对应数字 · 跳过（引爆器＋1）</button>';
    var order=BB.numberOrder(V);
    if(order&&V.phase==='play'&&!V.pending&&order.step!=='cut'){
      if(S.sel&&S.sel.mode==='eq')return h+equipPanel(V,me,S.sel)+'</div>';
      if(me!==order.controller)return h+'<p class="step">等待长官 '+esc(V.players[order.controller].name)+' '+(order.step==='draw'?'翻数字牌':'独立指定行动者')+'。</p></div>';
      if(order.step==='draw'){var live=P.stands.flat().filter(function(w){return !w.cut;}),reds=live.length&&live.every(function(w){return BB.kindOf(w)==='r';});return h+(reds?'<p class="step">你只剩红线，不翻数字牌。</p><button class="btn primary" data-act="red">公开红线</button>':'<p class="step">轮到你担任长官，先翻数字牌。</p><button class="btn primary" data-act="order-draw">翻数字牌</button>')+'</div>';}
      return h+'<p class="step">独立指定一名玩家拆数字 '+order.value+'，可以指定自己。指定只剩红线的玩家会立即爆炸。</p><div class="row">'+V.players.map(function(p,pi){return p.stands.some(function(st){return st.some(function(w){return !w.cut;});})?'<button class="btn small" data-act="order-assign" data-p="'+pi+'">'+esc(p.name)+(pi===me?'（自己）':'')+'</button>':'';}).join('')+'</div></div>';
    }
    var claim=BB.numberClaim(V);
    if(claim&&V.phase==='play'&&!V.pending&&claim.step!=='cut'){
      if(S.sel&&S.sel.mode==='eq')return h+equipPanel(V,me,S.sel)+'</div>';
      if(claim.step==='draw'){var live=P.stands.flat().filter(function(w){return !w.cut;}),onlyRed=live.length&&live.every(function(w){return BB.kindOf(w)==='r';});return h+(me===V.captain?'<p class="step">由队长翻开本回合数字牌。</p><button class="btn primary" data-act="claim-draw">翻数字牌</button>':'<p class="step">等待队长 '+esc(V.players[V.captain].name)+' 翻数字牌。</p>')+(onlyRed?'<p class="step">你只剩红线，可以在翻牌前认领公开。</p><button class="btn primary" data-act="claim-number">认领公开红线</button>':'')+'</div>';}
      if(claim.step==='claim'){
        var mine=P.stands.flat().filter(function(w){return !w.cut;}),reds=mine.length&&mine.every(function(w){return BB.kindOf(w)==='r';});
        h+='<p class="step">先认领成功的人行动；本回合拆数字 '+(claim.value===null?'已无蓝线':claim.value)+'。认领未持有的数字会罚一格。</p>'+(mine.length?'<button class="btn primary" data-act="claim-number">'+(reds?'认领公开红线':'我认领这个数字')+'</button>':'<p class="muted">你已没有剩余导线。</p>');
        if(me===V.captain)h+='<p>无人认领时，队长可指定一名玩家，包括自己：</p><div class="row">'+V.players.map(function(p,pi){return p.stands.some(function(st){return st.some(function(w){return !w.cut;});})?'<button class="btn small" data-act="claim-assign" data-p="'+pi+'">'+esc(p.name)+'</button>':'';}).join('')+'</div>';
        return h+'</div>';
      }
    }
    if (V.official && V.official.precision && V.official.precision.assignedNumbers && V.official.precision.assignedNumbers.length) h += '<p class="step">你的奖励数字牌：' + V.official.precision.assignedNumbers.join('、') + '（仅你可见）。</p>';
    var constraints = V.official && V.official.constraints;
    if (V.phase === 'constraints') {
      if (V.turn !== me) return h + '<p class="step">轮到 ' + esc(V.players[V.turn].name) + ' 选择限制卡。之后才开始初始标记。</p></div>';
      return h + '<p class="step"><b>轮到你选择限制：</b>选择一张 A–E 卡。自己的回合开始无法遵守时，该限制永久翻面；作为被指队友回应时按正常规则剪线。</p><div class="constraint-choices">' + constraints.available.map(function (id) { return '<button class="btn small" data-act="constraint-select" data-card="' + id + '"><b>' + id + ' · ' + BB.CONSTRAINTS[id].name + '</b><br>' + esc(BB.CONSTRAINTS[id].desc) + '</button>'; }).join('') + '</div>' + (V.np === 2 ? '<p class="muted">双人建议避免同时选 A＋B 或 C＋D；这是建议，可以自行选择。</p>' : '') + '</div>';
    }
    if (V.pending && V.pending.type === 'sequence-end') {
      var sequence = V.official.numberEnds, waiting = V.pending;
      if (waiting.to !== me) return h + '<p class="step">等待 ' + esc(V.players[waiting.to].name) + ' 独立选择数字序列的一端。</p></div>';
      return h + '<p class="step">轮到你选择序列端点；请独立决定，不与队友讨论。当前数字牌：' + sequence.row.join('、') + '</p><button class="btn primary" data-act="sequence-end" data-end="left">左端：' + sequence.row[0] + '</button> <button class="btn primary" data-act="sequence-end" data-end="right">右端：' + sequence.row[sequence.row.length-1] + '</button></div>';
    }
    if (V.phase === 'setup') {
      if (V.official && (V.official.riskyRedCut || V.official.randomInitialClues)) {
        var pd = V.pending;
        if (!pd || pd.to !== me) return h + '<p class="step">等待 ' + esc(V.players[BB.setupActor(V)].name) + ' 完成随机初始标记。</p></div>';
        return h + '<p class="step">轮到你标记：随机抽到「' + BB.valLabel(pd.token.value) + '」。' + (pd.canPlaceAside ? '自己的手牌没有该值，请旁置标记。' : '点击自己任意一根对应导线；有同值导线时由你选择。') + '</p>' + (pd.canPlaceAside ? P.stands.map(function (_, rack) { return '<button class="btn primary small" data-act="initial-clue-aside" data-rack="' + rack + '">放第' + (rack + 1) + '排旁</button>'; }).join(' ') : '') + '</div>';
      }
      var need = BB.setupNeed(V, me) - V.setup[me];
      if (canPlaceInfo(V, me) && V.official && V.official.fakeSetup) {
        var wire = S.sel && S.sel.mode === 'fake-info' ? wireOf(V, S.sel.wires[0]) : null,redAllowed=V.official.fakeSetup.redAllowed;
        return h + '<p class="step"><b>轮到你放错误标记：</b>' + (wire ? '已选自己的'+(BB.kindOf(wire.w)==='r'?'红线':'蓝线「'+wire.w.v+'」')+'，请选择与它不同的数值。' : '先点击自己尚未选择的一根'+(redAllowed?'蓝线或红线':'蓝线')+'，再选择与它不同的数值。') + '还需放 ' + need + ' 个；'+(redAllowed?'不能选黄线。':'不能标红线。')+'</p>' + (wire ? '<div class="vals">' + range(gameMission(V)).map(function (value) { return '<button class="vbtn" data-act="fake-value" data-v="' + value + '"' + (value === wire.w.v ? ' disabled' : '') + '>' + value + '</button>'; }).join('') + '</div>' : '') + '</div>';
      }
      if (canPlaceInfo(V, me) && V.official && V.official.missingSetup) {
        var picked = S.sel && S.sel.mode === 'missing-clues' ? S.sel.values : [];
        var buttons = V.official.missingSetup.values.map(function (value) { return '<button class="vbtn' + (value === 'Y' ? ' y' : '') + (picked.indexOf(value) >= 0 ? ' on' : '') + '" data-act="missing-value" data-v="' + value + '">' + (value === 'Y' ? '黄' : value) + '</button>'; }).join('');
        var ready = picked.length === need;
        var submit = P.stands.length === 2 && need === 1 ? [0, 1].map(function (rack) { return '<button class="btn primary small" data-act="missing-submit" data-rack="' + rack + '"' + (ready ? '' : ' disabled') + '>放第' + (rack + 1) + '排旁</button>'; }).join(' ') : '<button class="btn primary" data-act="missing-submit"' + (ready ? '' : ' disabled') + '>同时放置 ' + need + ' 个标记</button>';
        return h + '<p class="step">轮到你标记：选择 ' + need + ' 个自己没有的不同数值（黄也可以）。两排合起来算一手牌；两排时各旁置一个。</p><div class="values">' + buttons + '</div>' + submit + '</div>';
      }
      if (canPlaceInfo(V, me)) return h + '<p class="step"><b>' + (V.ruleset === 'physical' ? '轮到你标记：' : '请放置标记：') + '</b>点击你自己的一根<b class="blue-t">蓝线</b>，在它前面放一个公开的信息标记' + (BB.clueKind(V, me) === 'frequency' ? '（显示该值在此架的总数，含已剪线）' : BB.clueKind(V, me) === 'parity' || gameMission(V).info === 'parity' ? '（只显示奇/偶）' : '') + '。还需放 ' + need + ' 个。</p></div>';
      return h + '<p class="muted">' + (need > 0 ? '还没轮到你。' : '你已标记完毕。') + setupWaiting(V, me) + '。</p></div>';
    }
    if (V.pending) {
      if(V.pending.type==='grapple')return h+(V.pending.to===me?'<p class="step">轮到你放好抓钩取得的导线，排序数值 '+V.pending.drawn.value+' 仅你可见。选择自己的线架：</p><div class="row">'+V.pending.choices.map(function(rack){return '<button class="btn primary" data-act="grapple-rack" data-rack="'+rack+'">放入第'+(rack+1)+'架</button>';}).join('')+'</div>':'<p class="step">等待 '+esc(V.players[V.pending.to].name)+' 放好抓钩取得的线；数值不公开。</p>')+'</div>';
      if(V.pending.type==='submarine-transfer'){
        if(V.pending.to!==me)return h+'<p class="step">等待 '+esc(V.players[V.pending.to].name)+' 决定是否转移氧气。</p></div>';
        var choice=S.sel&&S.sel.mode==='oxygen-transfer'?S.sel:null,partner=choice&&V.pending.choices.find(function(c){return c.p===choice.partner;}),limit=partner?(choice.direction==='give'?partner.give:partner.take):0;
        return h+'<p class="step">播报允许你与一名仍参与的队友转移氧气，也可以放弃。选择方向与数量：</p><div class="row">'+V.pending.choices.map(function(c){return '<button class="btn small" data-act="submarine-transfer-pick" data-p="'+c.p+'" data-mode="give"'+(c.give?'':' disabled')+'>给 '+esc(V.players[c.p].name)+'</button><button class="btn small" data-act="submarine-transfer-pick" data-p="'+c.p+'" data-mode="take"'+(c.take?'':' disabled')+'>从 '+esc(V.players[c.p].name)+' 领取</button>';}).join('')+'</div>'+(partner?'<label>转移数量（1–'+limit+'）<input id="submarine-transfer-amount" type="number" required min="1" max="'+limit+'" step="1" value="1"></label><button class="btn primary" data-act="submarine-transfer-confirm">确认转移</button>':'')+'<button class="btn ghost small" data-act="submarine-transfer-skip">不转移，继续</button></div>';
      }
      if(V.pending.type==='submarine-red')return h+(V.pending.to===me?'<p class="step">录音加入一根红线，排序数值 '+V.pending.drawn.value+'，只有你可见。选择放入自己的哪一架；会自动按数值排序。</p><div class="row">'+V.pending.choices.map(function(rack){return '<button class="btn primary" data-act="submarine-red" data-rack="'+rack+'">放入第'+(rack+1)+'架</button>';}).join('')+'</div>':'<p class="step">等待 '+esc(V.players[V.pending.to].name)+' 放好录音加入的红线；数值不公开。</p>')+'</div>';
      if(V.pending.type==='false-info')return h+(V.pending.to===me?'<p class="step">便利贴：为自己选中的蓝线选择一个错误数值。只有你看到可选数值；确认后使用此卡。</p><div class="vals">'+V.pending.choices.map(function(value){return '<button class="vbtn" data-act="false-info" data-v="'+value+'">'+value+'</button>';}).join('')+'</div>':'<p class="step">等待 '+esc(V.players[V.pending.to].name)+' 选择便利贴的错误数值。</p>')+'</div>';
      if (V.pending.type === 'secret-number') {
        var secret = V.pending;
        if (secret.to !== me) return h + '<p class="step">等待 ' + esc(V.players[secret.to].name) + (secret.step === 'choose' ? ' 秘密选择数字牌；之后轮到 ' + esc(V.players[secret.from].name) + ' 拆线。' : ' 公开本回合的秘密数字牌。') + '</p></div>';
        return h + (secret.step === 'choose' ? '<p class="step">秘密选择一张自己的数字牌；不要向队友透露牌值。</p><div class="values">' + secret.choices.map(function (value) { return '<button class="vbtn" data-act="secret-choose" data-v="' + value + '">' + value + '</button>'; }).join('') + '</div>' : '<p class="step">拆线已结束。公开秘密数字牌；只按实际剪到的值追加处罚，探测器未剪候选不计。</p><button class="btn primary" data-act="secret-reveal">公开秘密数字牌</button>') + '</div>';
      }
      if (V.pending.type === 'precision-clue') return h + (V.pending.to === me ? '<p class="step">轮到你放置奖励线索「'+V.pending.token.value+'」：点击自己的任意一根高亮导线；两个线架合起来算一手牌。</p>' : '<p class="step">等待 '+esc(V.players[V.pending.to].name)+' 放置奖励数字线索。</p>') + '</div>';
      if(V.pending.type==='nano-rack')return h+(V.pending.to===me?'<p class="step">你取得一根新导线：'+(V.pending.drawn.kind==='r'?'红色':'蓝色')+' '+V.pending.drawn.value+'。只有你可见，请选择放置架。</p><div class="values">'+V.pending.choices.map(function(rack){return '<button class="btn primary" data-act="nano-rack" data-rack="'+rack+'">放入第'+(rack+1)+'架</button>';}).join('')+'</div>':'<p class="step">等待 '+esc(V.players[V.pending.to].name)+' 选择补线放置的线架；内容不公开。</p>')+'</div>';
      if(V.pending.type==='number-claim-clue')return h+'<p class="step">'+(V.pending.to===me?'你没有当前数字。点击自己一根未剪蓝线放置对应标记，随后引爆器前进一格。':'等待 '+esc(V.players[V.pending.to].name)+' 选择自己的线索；选项仅本人可见。')+'</p></div>';
      if (V.pending.type === 'tripwire-cut') return h + (V.pending.to === me ? '<p class="step">队友猜测被选导线是绊线，请公开回应。</p><button class="btn primary" data-act="tripwire-reply">'+(V.pending.ownAnswers[0].matched?'是绊线，安全处理':'不是绊线，确认回应')+'</button>' : '<p class="step">等待 '+esc(V.players[V.pending.to].name)+' 回应绊线猜测。</p>')+'</div>';
      if(V.pending.type==='order-answer')return h+(V.pending.to===me?'<p class="step">长官指定你拆数字 '+BB.numberOrder(V).value+'。先公开回应，再进行拆线或缺值标记。</p><button class="btn primary" data-act="order-answer">长官，遵命！</button>':'<p class="step">等待 '+esc(V.players[V.pending.to].name)+' 回应长官命令。</p>')+'</div>';
      if(V.pending.type==='order-clue')return h+(V.pending.to===me?'<p class="step">你没有指定数字。点击自己的一根未剪蓝线提供信息，本次引爆器前进一格。</p>':'<p class="step">等待 '+esc(V.players[V.pending.to].name)+' 选择缺值标记。</p>')+'</div>';
      if (V.pending.type === 'precision-cut') return h + (V.pending.to === me ? '<p class="step">轮到你公开回应四线猜测；只确认自己被选中的导线。</p><button class="btn primary" data-act="precision-reply">公开回应：' + V.pending.ownAnswers.map(function(x){return x.matched?'正确':'不正确';}).join('、') + '</button>' : '<p class="step">等待 ' + esc(V.players[V.pending.to].name) + ' 公开回应精准拆线。</p>') + '</div>';
      if (V.pending.type === 'yellow-three-cut') return h + (V.pending.to === me ? '<p class="step">轮到你公开回应三黄判断；只确认自己被选中的导线。</p><button class="btn primary" data-act="yellow-three-reply">公开回应：' + V.pending.ownAnswers.map(function(x){return x.matched?'是黄线':'不是黄线';}).join('、') + '</button>' : '<p class="step">等待 ' + esc(V.players[V.pending.to].name) + ' 公开回应三黄拆线。</p>') + '</div>';
      if (V.pending.type === 'risky-cut') return h + (V.pending.to === me ? '<p class="step">轮到你公开回应冒险拆线；只确认自己被选中的导线。</p><button class="btn primary" data-act="risky-reply">公开回应：' + V.pending.ownAnswers.map(function (answer) { return answer.red ? '是红线' : '不是红线'; }).join('、') + '</button>' : '<p class="step">等待 ' + esc(V.players[V.pending.to].name) + ' 公开回应冒险拆线。</p>') + '</div>';
      if (V.pending.type === 'radar') return h + '<p class="step">雷达询问蓝色数字「' + V.pending.value + '」。每个线架分别回答，只公布有或没有。</p>' + (V.pending.ownAnswers ? '<button class="btn primary" data-act="radar-reply">公开回应：' + V.pending.ownAnswers.map(function (answer, rack) { return '第' + (rack + 1) + '排' + (answer ? '有' : '没有'); }).join('、') + '</button>' : '<p class="muted">你已回应，等待其他玩家。</p>') + '</div>';
      if (V.pending.type === 'equipment-reveal') return h + '<p class="step">当前数字「' + V.pending.value + '」的四根蓝线已完成。队伍可盲翻下方任意一张背面装备，直接可用。任一玩家可代表队伍选择；其他动作等待此决定完成。</p><div class="values">' + V.pending.slots.map(function (slot, index) { return '<button class="btn primary small" data-act="hidden-equipment" data-slot="' + slot + '">盲翻第' + (index + 1) + '张背面装备</button>'; }).join('') + '</div><button class="btn small ghost" data-act="skip-equipment">不翻装备，继续</button></div>';
      if (V.pending.type === 'clue') {
        var pd = V.pending;
        if (pd.to !== me) return h + '<p class="step">等待 ' + esc(V.players[pd.to].name) + (pd.step === 'choose' ? ' 选择信息标记。' : ' 摆放已选信息标记。') + '</p></div>';
        if (pd.step === 'choose') return h + '<p class="step">' + (pd.kind === 'pass' ? '从中央备用区取一个新标记交给左边队友。' : '从已公开的一组标记中选择一个，摆放到自己手中。') + '</p><div class="values">' + (pd.tokens || []).map(function (token) { return '<button class="vbtn" data-act="clue-select" data-token="' + token.id + '">' + token.value + '</button>'; }).join('') + '</div></div>';
        return h + '<p class="step">摆放「' + pd.token.value + '」信息标记：' + (pd.canPlaceAside ? '自己没有该值，请选择放在哪个线架旁。' : '点击自己任意一根高亮的匹配导线。') + '</p>' + (pd.canPlaceAside ? P.stands.map(function (_, rack) { return '<button class="btn primary small" data-act="clue-aside" data-rack="' + rack + '">放第' + (rack + 1) + '排旁</button>'; }).join(' ') : '') + '</div>';
      }
      if (V.pending.type === 'cut') {
        if (V.pending.to === me) {
          var answer = '';
          if (V.pending.step === 'target' && V.pending.ids.length === 1 && V.pending.choices && V.pending.choices.length === 1) {
            var chosen = wireOf(V, V.pending.choices[0]).w;
            var hit = V.pending.publicMatch===undefined?V.pending.vals.some(function (v) { return BB.matches(chosen, v); }):V.pending.publicMatch;
            answer = '<button class="btn primary" data-act="resolve-target" data-choice="' + chosen.id + '">' + (hit ? '是，命中「' + esc(BB.announcementLabel(V, V.pending.publicMatch===undefined?BB.annOf(chosen):V.pending.vals[0])) + '」' : '不是，确认未命中') + '</button>';
          }
          var clueOptions = V.pending.clueValues;
          var clueButtons = clueOptions && clueOptions.length > 1 ? '<p>本次均未命中。先选择一枚本次宣告值的错误标记，再确认目标线：</p><div class="vals">' + clueOptions.map(function (value) { return '<button class="vbtn' + (S.sel && S.sel.mode === 'failure-clue' && S.sel.value === value ? ' on' : '') + '" data-act="failure-value" data-v="' + value + '">' + value + '</button>'; }).join('') + '</div>' : '';
          if (clueOptions && clueOptions.length > 1 && !(S.sel && S.sel.mode === 'failure-clue')) answer = answer.replace('data-act="resolve-target"', 'disabled data-act="resolve-target"');
          return h + '<p class="step">' + (V.pending.step === 'target' ? '回应队友的猜测：确认下方答案，或点击高亮的目标线。探测器有多个结果时，由你选择其中一根。' : V.pending.outwardIntent ? '队友已确认目标线。现在独立选择自己任一根未剪朝外线；可更改先前选择，自己的盲猜错误会立即爆炸。' : V.pending.outwardOwn != null ? '队友已确认目标线。点击你的朝外线确认拆除；若自己的盲猜错误，将立即爆炸。' : '队友已确认命中「' + esc(BB.announcementLabel(V, V.pending.hitVal)) + '」。请选择你自己的任意一根匹配线；有相同数值时由你决定剪哪根。' + (V.official && V.official.outwardId != null && V.pending.choices && V.pending.choices.indexOf(V.official.outwardId) >= 0 ? ' 也可选择朝外线；若实际不匹配，将立即爆炸。' : '')) + '</p>' + clueButtons + answer +
            (V.pending.noSafe ? '<button class="btn primary" data-act="resolve-empty">确认未命中：' + (V.pending.noClue ? '本次不提供线索' : '没有安全线') + '</button>' : '') + '</div>';
        }
        return h + '<p class="muted">等待 ' + esc(V.players[V.pending.to].name) + ' 选择拆线结果…</p></div>';
      }
      if (V.pending.to === me) return h + '<p class="step"><b>' + esc(V.players[V.pending.from].name) + '</b> 用对讲机找你交换：点击你自己的一根线交给对方。</p></div>';
      return h + '<p class="muted">等待 ' + esc(V.players[V.pending.to].name) + ' 选择交换的线…</p></div>';
    }
    var command = V.official && V.official.radarCommand;
    if (command && command.step !== 'cut' && command.step !== 'red') {
      if (V.turn !== me) return h + '<p class="step">等待轮值玩家 ' + esc(V.players[V.turn].name) + ' 完成雷达指挥步骤。</p></div>';
      if (command.step === 'draw') return h + '<p class="step">第1步：翻开数字牌堆最上方一张，不可自行选择或连续重抽。</p><button class="btn primary" data-act="number-draw">翻数字卡</button></div>';
      if (command.step === 'radar') return h + '<p class="step">第2步：查询数字「' + command.value + '」，等待每名玩家逐架公开回应。</p><button class="btn primary" data-act="radar-query">查询蓝色 ' + command.value + '</button></div>';
      return h + '<p class="step">第3步：指定一名有蓝色「' + command.value + '」的玩家拆线（可以是自己）。目标导线由对方自行选择。</p><div class="values">' + V.players.map(function (p, owner) { return '<button class="btn small" data-act="command-select" data-p="' + owner + '"' + (command.answers[owner].some(Boolean) ? '' : ' disabled') + '>' + esc(p.name) + (owner === me ? '（自己）' : '') + '</button>'; }).join('') + '</div></div>';
    }
    if (constraints) {
      var cid = BB.constraint(V, me), ownCard = constraints.personal && constraints.personal[me];
      h += '<p class="step constraint-summary">' + (cid ? '当前' + (constraints.kind === 'personal' ? '个人' : '共享') + '限制：<b>' + cid + ' · ' + BB.CONSTRAINTS[cid].name + '</b><br>' + esc(BB.CONSTRAINTS[cid].desc) : ownCard && ownCard.retired ? '你的限制已永久翻面，按正常规则行动。' : '当前没有生效的限制。') + (constraints.kind==='bound'?'<br>未完成数字 '+constraints.remaining+' 个。':constraints.kind !== 'personal' ? '<br>牌堆剩余 ' + constraints.remaining + ' 张。' : '') + '</p>';
      if (constraints.captainPending) return h + (V.turn === me ? '<p class="step">队长回合开始：保留当前限制，或换下一张。牌堆耗尽时移除限制。</p><button class="btn small" data-act="constraint-keep">保留当前限制</button> <button class="btn primary small" data-act="constraint-next">更换下一张</button>' : '<p class="muted">等待队长决定是否更换限制。</p>') + '</div>';
    }
    var personal = BB.characterState(P), personalDef = BB.CHARACTERS[personal.id];
    if (P.character && !BB.personalCardsLocked(V) && BB.equipmentAllowed(V, me) && !personal.used && personalDef.equipment && (personalDef.timing === 'anytime' || V.turn === me && BB.ownTurnAllowed(V,me))) h += '<button class="btn small" data-act="personal">使用个人 ' + esc(personalDef.name) + '</button>';
    if (V.official && V.official.numberEnds) { var ends = V.official.numberEnds; h += '<p class="step">数字序列：' + ends.row.join('、') + '；当前从' + (ends.end === 'left' ? '左' : '右') + '端开始。后续牌值暂不能拆，其他数值可自由拆。</p>'; }
    if(V.official&&V.official.tripwire){
      if(V.official.tripwire.stalled){h+='<p class="step">当前所有队员都需跳过。可以使用随时装备改变手牌，再继续处理绊线；也可由房主退出重试。</p>';if(S.sel&&S.sel.mode==='eq')return h+equipPanel(V,me,S.sel)+'</div>';return h+'</div>';}
      if(V.turn===me && S.sel && S.sel.mode==='tripwire')return h+'<p class="step">选择另一名队友的一根未处理导线，宣告它是绊线。成功只处理该线并后退一格；蓝线错误前进一格，选红立即爆炸。不能使用稳定器或探测器保护。</p><button class="btn primary" data-act="tripwire-submit"'+(S.sel.wires.length===1?'':' disabled')+'>宣告是绊线</button><button class="btn ghost small" data-act="mode" data-m="dual">取消</button></div>';
      if(V.turn===me)h+='<button class="btn small" data-act="tripwire-start">处理队友的一根绊线</button>';
    }
    var sel = S.sel;
    if (V.official && V.official.precision && !V.official.precision.complete) {
      var precise = V.official.precision;
      h += precise.license?'<p class="step">蓝色7只能通过许可四线拆除。你的回合开始时仅剩蓝色7，才必须执行此行动；其他玩家仍可有未剪导线。'+(V.official.licenseRequired?'本回合你必须选择全部四根7。':'未满足条件时继续拆其他值。')+'</p>':'<p class="step">数字「'+precise.value+'」必须四根同时精准拆除；其余数字可正常拆。每整轮弃一张背面'+(precise.rewardKind==='numbers'?'数字牌':'装备')+'，已弃'+precise.discarded+'张。</p>';
      if(V.turn===me && sel && sel.mode==='precision') return h + '<p>选择四根不同的未剪导线，可包含自己、跨玩家和线架。已选'+sel.wires.length+'/4；选错立即爆炸，不能组合探测器。</p><button class="btn primary" data-act="precision-submit"'+(sel.wires.length===4?'':' disabled')+'>宣告四根都是 '+precise.value+'</button><button class="btn ghost small" data-act="mode" data-m="dual">取消</button></div>';
      h += '<button class="btn small" data-act="precision-start"'+(V.turn===me&&(!precise.license||V.official.licenseRequired)?'':' disabled')+'>'+(precise.license?'许可拆线':'精准拆线')+'：四根 '+precise.value+'</button>';
    }
    if (V.official && V.official.module === 'number-cycle') h += '<p class="step">正面数字卡：' + V.official.numbers.open.join('、') + '。选择数值并宣告拆线后，该卡翻面；本轮不能再次使用。</p>';
    if (sel && sel.mode === 'eq') return h + equipPanel(V, me, sel) + '</div>';
    if (BB.turnActor(V) !== me) return h + '<p class="muted">等待 <b>' + esc(V.players[BB.turnActor(V)].name) + '</b> 行动。你可以随时使用标注“可使用”的装备。</p></div>';
    if (BB.outwardSkipAllowed(V, me)) return h + '<p class="step">你持有的数值只能与队长的朝外线配对，不能选择它。本回合须跳过，引爆器前进一格；也可先使用合法装备改变手牌。</p><button class="btn primary" data-act="outward-skip">跳过回合（引爆器＋1）</button></div>';
    var outward = V.players[me].stands.some(function (st) { return st.some(function (w) { return !w.cut && BB.isOutward(V, w); }); });
    if (outward) {
      if (V.stab) h += '<p class="step">稳定器不能保护朝外线；选择盲猜时会取消本回合的保护，猜错仍立即爆炸。</p>';
      h += '<button class="tab" data-act="mode" data-m="outward">用朝外线双人盲猜</button><p class="muted small-t">只能主动使用你的朝外线；不能组合任何装备，猜错立即爆炸。</p>';
      var outwardIds=BB.outwardIdsForOwner(V,me).filter(function(id){return !wireOf(V,id).w.cut;}),groups=outwardIds.map(function(id){return [id];});if(BB.doubleOutward(V)&&outwardIds.length===2)groups.push(outwardIds.slice());groups.forEach(function(ids){h+=BB.outwardSoloValues(V,me,BB.doubleOutward(V)?ids:undefined).map(function(value){return '<button class="btn small" data-act="outward-solo" data-outs="'+ids.join(',')+'" data-v="'+value+'">'+(ids.length===2?'同时用两根朝外线':'用第'+(BB.outwardIdsForOwner(V,me).indexOf(ids[0])+1)+'根朝外线')+'单拆：宣告 '+value+'（猜错爆炸）</button>';}).join(' ');});if(BB.doubleOutward(V))h+='<div class="row">'+outwardIds.map(function(id){return '<button class="btn small'+(sel&&sel.mode==='outward'&&(sel.own===id||sel.own===undefined&&id===outwardIds[0])?' primary':'')+'" aria-pressed="'+!!(sel&&sel.mode==='outward'&&(sel.own===id||sel.own===undefined&&id===outwardIds[0]))+'" data-act="outward-own" data-own="'+id+'">盲双拆优先使用'+(BB.outwardIdsForOwner(V,me).indexOf(id)===0?'左':'右')+'端朝外线</button>';}).join('')+'</div>';
      if (BB.outwardRedPossible(V,me)) h += '<button class="btn danger small" data-act="outward-red">宣告朝外线是红线，公开剩余红线（猜错爆炸）</button>';
      if (sel && sel.mode === 'outward') return h + '<button class="btn small ghost" data-act="mode" data-m="dual">返回普通拆线</button><p class="step">' + (sel.wires.length ? '宣告1–12中的一个数值，队友公开回应后，再确认剪下你的朝外线。' : BB.allOutward(V)?'选择队友的一根未剪导线；剪到队友朝外线额外推进一格。你的朝外线将配对。':'选择队友的一根普通未剪导线；你的朝外线将作为配对线。') + '</p>' + valBtns(V, me, { all: true, blueOnly: true, enabled: sel.wires.length === 1 }) + '</div>';
    }

    var mode = sel && sel.mode === 'dd' ? 'dd' : 'dual';
    var mineLeft = [];
    P.stands.forEach(function (st) { st.forEach(function (w) { if (!w.cut) mineLeft.push(w); }); });
    var allRed = mineLeft.length && mineLeft.every(function (w) { return BB.kindOf(w) === 'r'; });
    if (V.official && V.official.yellowThree && !V.official.yellowThree.complete) {
      var canThree = mineLeft.length && (V.np >= 4 || mineLeft.some(function(w){return BB.kindOf(w)==='y';}));
      if(sel && sel.mode === 'yellow-three') return h + '<p class="step">选择三根不同的未剪导线，可包含自己、跨玩家和线架。已选 ' + sel.wires.length + '/3；全部回应后同时结算，不组合装备或个人能力。</p><button class="btn primary" data-act="yellow-three-submit"' + (sel.wires.length===3?'':' disabled') + '>宣告三根都是黄线</button><button class="btn ghost small" data-act="mode" data-m="dual">取消</button></div>';
      h += '<button class="btn small" data-act="yellow-three-start"' + (canThree && !V.stab?'':' disabled') + '>三黄特殊拆线</button><p class="muted small-t">黄线不能普通拆除。两三人局须自己持有黄线；四五人局可由任何仍有导线的玩家发起。稳定器生效时不能发起。</p>';
    }
    if (V.official && V.official.riskyRedCut) {
      var canRisk = V.np >= 4 || mineLeft.some(function (w) { return BB.kindOf(w) === 'r'; });
      if (allRed || sel && sel.mode === 'risky') {
        var chosen = sel && sel.mode === 'risky' ? sel.wires : [];
        return h + '<p class="step">' + (allRed ? '你只剩红线，必须进行冒险拆线。' : '冒险拆线：') + '选择三根不同的未剪导线（可跨玩家和线架，包括自己的线）。已选 ' + chosen.length + '/3；选错立即爆炸，不能使用装备或个人能力。</p><button class="btn primary" data-act="risky-submit"' + (chosen.length === 3 ? '' : ' disabled') + '>宣告三根都是红线</button>' + (sel && sel.mode === 'risky' ? '' : '<button class="btn small" data-act="risky-start">开始选择三根线</button>') + (allRed ? '' : '<button class="btn small ghost" data-act="mode" data-m="dual">取消，返回双人拆线</button>') + '</div>';
      }
      h += '<button class="btn small" data-act="risky-start"' + (canRisk ? '' : ' disabled') + '>冒险拆线：三根红线</button><p class="muted small-t">' + (canRisk ? '三根必须都为红线；不能用普通公开红线行动。' : '两人或三人局，自己持有红线时才可进行冒险拆线。') + '</p>';
    }
    h += '<div class="tabs"><button class="tab' + (mode === 'dual' ? ' on' : '') + '" data-act="mode" data-m="dual">双人拆线</button>' +
      (P.dd && !BB.personalCardsLocked(V) && BB.equipmentAllowed(V, me) ? '<button class="tab' + (mode === 'dd' ? ' on' : '') + '" data-act="mode" data-m="dd">双重探测器（一次性）</button>' : '') + '</div>';
    if (V.ruleset === 'physical' && BB.equipmentAllowed(V, me)) {
      var ready = function (n) { return BB.equipmentAllowed(V, me) && V.equip.some(function (e) { return e.n === n && e.open && !e.used; }); };
      if (!BB.personalCardsLocked(V) && personal.id === 'xy-ray' && !personal.used) h += '<label class="mod"><input type="checkbox" id="mod-personal-xy"' + (sel && sel.xyPersonal ? ' checked' : '') + '> 本次使用个人 X/Y 射线</label>';
      if (ready(10)) h += '<label class="mod"><input type="checkbox" id="mod-xy"' + (sel && sel.xy && !sel.xyPersonal ? ' checked' : '') + '> 本次使用 X/Y 射线</label>';
      if (ready(9) && BB.stabilizerAllowed(V, me)) h += '<label class="mod"><input type="checkbox" id="mod-stab"' + (sel && sel.stab ? ' checked' : '') + '> 本次使用稳定器</label>';
      if (sel && sel.xy) h += '<p class="muted">先选择目标，再依次选择两个不同的数值。</p>';
    }
    var tw = (sel && sel.wires) || [];
    if (allRed) {
      h += '<p class="step">你剩下的全是红线。</p><button class="btn primary" data-act="red">公开我的红线</button>';
    } else if (mode === 'dual') {
      h += '<p class="step">' + (tw.length ? '<b>第 2 步：</b>宣告这根线的数值（你必须也持有它）' : '<b>第 1 步：</b>点击一名队友的一根未剪的线') + '</p>' + valBtns(V, me, { enabled: tw.length === 1, picked: sel && sel.vals });
    } else {
      h += '<p class="step">' + (tw.length < 2 ? '<b>第 1 步：</b>选择同一名队友同一排的 <b>2</b> 根线（已选 ' + tw.length + '）' : '<b>第 2 步：</b>宣告数值，两根中有一根是它就成功') + '</p>' + valBtns(V, me, { enabled: tw.length === 2, picked: sel && sel.vals, blueOnly: BB.usesCutChoices(V) });
    }
    // 单人剪
    var solos = myVals(V, me).filter(function (v) { return soloPossible(V, me, v); });
    h += '<div class="solo"><span class="sub-l">单人拆线</span>' + (solos.length ? solos.map(function (v) { var oxygen=BB.oxygen(V),personal=BB.personalOxygen(V),passing=BB.passingOxygen(V),submarine=BB.submarine54(V),cost=oxygen||submarine?BB.oxygenCost(v):personal||passing?v:null,short=passing?passing.holder!==me||passing.available<cost:submarine?submarine.balances[me]<cost:personal?personal.balances[me]<cost:oxygen&&oxygen.available<cost,missingRecipient=personal&&personalOxygenRecipient(V,me)===null,mathWrong=BB.arithmetic(V)&&arithmeticResult(V)!==v;return '<button class="btn small" data-act="solo" data-v="' + v + '"'+(missingRecipient?' disabled title="请先选择接收氧气的队友"':short?' disabled title="氧气不足，需要 '+cost+' 枚"':mathWrong?' disabled title="请先选择结果为 '+v+' 的算式"':'')+'>剪掉 ' + BB.valLabel(v) + ' 的 ' + ((v === 'Y' ? V.ymark.n : 4) - countCut(V, v)) + ' 根'+(cost!==null?'（'+cost+'枚氧气'+(short?'，不足':'')+'）':'')+'</button>'; }).join('') : '<span class="muted small-t">当前没有合法的两根或四根组合</span>') + '</div>';
    return h + '</div>';
  }
  function soloPossible(V, me, v) {
    if (!BB.actorValueAllowed(V, me, v)) return false;
    var own = V.players[me].stands.reduce(function (out, st) { return out.concat(st); }, []).filter(function (w) { return !w.cut && BB.annOf(w) === v; });
    if (!BB.soloAllowed(V, me, own)) return false;
    if (!seqOk(V, v)) return false;
    var mine = 0, cut = countCut(V, v);
    V.players[me].stands.forEach(function (st) { st.forEach(function (w) { if (!w.cut && BB.annOf(w) === v) mine++; }); });
    var total = v === 'Y' ? V.ymark.n : 4;
    return V.ruleset === 'physical' ? (mine === 2 || mine === 4) && mine === total - cut : mine > 0 && mine === total - cut;
  }
  function equipPanel(V, me, sel) {
    var d = BB.EQUIP[sel.n], n = sel.n, h = '<p class="step"><b>' + d.name + '：</b>' + esc(d.desc) + '</p>';
    var tw = sel.wires || [];
    var role = BB.characterState(V.players[me]), rd = BB.CHARACTERS[role.id];
    var state = sel.personal ? { usable: BB.equipmentAllowed(V, me) && !role.used && (rd.timing === 'anytime' || V.turn === me && BB.ownTurnAllowed(V,me)), label: role.used ? '个人能力已用' : '等待你的回合' } : equipStatus(V, me, V.equip.filter(function (e) { return e.n === n; })[0]);
    if (state.desc) h = '<p class="step"><b>' + d.name + '：</b>' + esc(state.desc) + '</p>';
    if (state.progress) h += '<p class="muted">' + esc(state.progress) + '</p>';
    if (sel.personal) h = '<p class="step"><b>个人 ' + d.name + '：</b>' + esc(d.desc) + ' 不需要编号解锁，与共享装备分别计次。</p>';
    if (!state.usable) return h + '<p class="muted">' + state.label + '</p><button class="btn ghost small" data-act="eqcancel">关闭</button>';
    if (V.ruleset === 'physical' && (n === 3 || n === 5)) {
      if (!BB.personalCardsLocked(V) && !sel.personal && role.id === 'xy-ray' && !role.used) h += '<label class="mod"><input type="checkbox" id="mod-personal-xy"' + (sel.xyPersonal ? ' checked' : '') + '> 同时使用个人 X/Y 射线</label>';
      if (V.equip.some(function (e) { return e.n === 10 && e.open && !e.used; })) h += '<label class="mod"><input type="checkbox" id="mod-xy"' + (sel.xy && !sel.xyPersonal ? ' checked' : '') + '> 同时使用 X/Y 射线</label>';
      if (BB.stabilizerAllowed(V, me) && V.equip.some(function (e) { return e.n === 9 && e.open && !e.used; })) h += '<label class="mod"><input type="checkbox" id="mod-stab"' + (sel.stab ? ' checked' : '') + '> 同时使用稳定器</label>';
    }
    if (n === 3) {
      var group = tw.length ? wireOf(V, tw[0]).st : [], left = group.filter(function (w) { return !w.cut && !BB.isX(V, w); }).length, needed = Math.min(3, left);
      h += '<p class="muted">已选 ' + tw.length + ' 根；同一排通常选 3 根，只剩 2 根时选 2 根。朝外线不能选择，但仍计入该排未剪数量。</p>' + valBtns(V, me, { enabled: tw.length >= 2 && tw.length === needed, picked: sel.vals, blueOnly: BB.usesCutChoices(V) });
    }
    else if (n === 5) h += '<p class="muted">' + (tw.length ? '已选中整排。' : '点击队友某一排中的任意一根线。') + '</p>' + valBtns(V, me, { enabled: tw.length > 0, picked: sel.vals, blueOnly: BB.usesCutChoices(V) });
    else if (n === 10) h += '<p class="muted">' + (tw.length ? '再选两个数值。' : '先点击队友的一根线。') + '</p>' + valBtns(V, me, { enabled: tw.length === 1, picked: sel.vals }) +
      '<button class="btn primary small" data-act="eqgo"' + (tw.length === 1 && sel.vals.length === 2 ? '' : ' disabled') + '>扫描</button>';
    else if (n === 1 || n === 12) h += '<p class="muted">选择你自己相邻的两根线（已选 ' + tw.length + '）。标签可包含一根已剪的线。</p><button class="btn primary small" data-act="eqgo"' + (tw.length === 2 ? '' : ' disabled') + '>放置标签</button>';
    else if (n === 4) h += '<p class="muted">选择你自己一根没有标记的蓝线。'+(BB.allFalseInfo(V)?'本关确认后还需私下选择一个错误数值。':'') + (BB.clueKind(V, me) === 'frequency' ? '本关放频率标记，计入该架已剪线；允许选择已剪蓝线。' : BB.clueKind(V, me) === 'parity' ? '本关只放奇偶标记。' + (BB.cutClueAllowed(V) ? '允许选择已剪蓝线。' : '') : '') + '</p><button class="btn primary small" data-act="eqgo"' + (tw.length === 1 ? '' : ' disabled') + '>贴上</button>';
    else if(n===18)h+='<p class="muted">选择队友一根未剪线，取到自己手中；只有你看到数值。两架时接着选择放哪架。</p><button class="btn primary small" data-act="eqgo"'+(tw.length===1?'':' disabled')+'>取走所选导线</button>';
    else if(n===16){var chosen=tw.map(function(id){return wireOf(V,id).w;}),matched=chosen.length===2&&BB.annOf(chosen[0])===BB.annOf(chosen[1]),air=BB.passingOxygen(V),value=matched?BB.annOf(chosen[0]):null,funded=!air||matched&&Number.isInteger(value)&&air.holder===me&&air.available>=value,ready=matched&&funded&&seqOk(V,BB.annOf(chosen[0]))&&BB.actorValueAllowed(V,me,BB.annOf(chosen[0]))&&BB.soloAllowed(V,me,chosen);h+='<p class="muted">选择自己两根同值的非红线，可跨自己的两架。已选 '+tw.length+' 根；只剪所选两根，其他同值线保留。</p>'+(matched&&air?'<p class="muted">本次需要 '+value+' 枚氧气，当前 '+air.available+' 枚'+(!funded?'，不能支付':'')+'。</p>':'')+(matched&&funded&&!ready?'<p class="muted">本关当前限制或数字顺序不允许拆这一对。</p>':'')+'<button class="btn primary small" data-act="eqgo"'+(ready?'':' disabled')+'>剪掉所选两根</button>';}
    else if(n===14){var item=tw.length===1&&wireOf(V,tw[0]),valid=item&&!item.w.unique&&item.st.filter(function(w){return BB.annOf(w)===BB.annOf(item.w);}).length===1;h+='<p class="muted">选择自己整架只出现一次的蓝线，可已剪；同值已剪线也计入。数字信息标记保留。×1标记当前占用 '+BB.uniqueMarkerCount(V)+'／7。</p>'+(item&&!valid?'<p class="muted">该值在这架不止一根，或已有×1标记。</p>':'')+'<button class="btn primary small" data-act="eqgo"'+(valid?'':' disabled')+'>放置×1标签</button>';}
    else if (n === 8) h += valBtns(V, me, { all: true, blueOnly: V.ruleset === 'physical' });
    else if (n === 7 && V.ruleset === 'physical') h += '<p class="muted">选择一或两张已使用的个人角色卡。</p><div class="row">' + V.players.map(function (p, i) { return !BB.characterState(p).used || BB.characterState(p).removed ? '' : '<button class="btn small' + ((sel.players || []).indexOf(i) >= 0 ? ' primary' : '') + '" data-act="battery-p" data-p="' + i + '">' + esc(p.name) + '</button>'; }).join('') + '</div><button class="btn primary small" data-act="battery-go"' + (!sel.players || !sel.players.length ? ' disabled' : '') + '>恢复所选角色卡</button>';
    else if (n === 6 || n === 9 || n === 7 || n === 13) h += '<button class="btn primary small" data-act="eqinstant">使用卡牌</button>';
    else if (n === 10 && V.ruleset === 'physical') h += '<p class="muted">请在双人拆线或探测器行动中勾选“X/Y 射线”。</p>';
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
    var gid = S.V ? String(S.V.gid) : '';
    var follow = el.dataset.gid !== gid || el.scrollHeight - el.clientHeight - el.scrollTop < 12;
    var anchor = null, offset = 0, top = el.getBoundingClientRect().top;
    if (!follow) {
      anchor = Array.from(el.children).find(function (row) { return row.getBoundingClientRect().bottom > top; });
      if (anchor) offset = anchor.getBoundingClientRect().top - top;
    }
    var html = S.log.slice(-60).map(function (e) { return '<li class="lg ' + esc(e.k) + '" data-log-n="' + esc(e.n) + '">' + esc(e.t) + '</li>'; }).join('');
    if (el._logHTML !== html) { el.innerHTML = html; el._logHTML = html; }
    el.dataset.gid = gid;
    if (follow) el.scrollTop = el.scrollHeight;
    else if (anchor) {
      var kept = Array.from(el.children).find(function (row) { return row.dataset.logN === anchor.dataset.logN; });
      if (kept) el.scrollTop += kept.getBoundingClientRect().top - el.getBoundingClientRect().top - offset;
      else el.scrollTop = 0;
    }
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
    var catalogId = S.lobby ? (S.lobby.catalog || S.lobby.ruleset) : S.catalog, list = catalog(catalogId), doneList = cleared(catalogId);
    $('#missions-title').textContent = '统一战役 · 66 关';
    $('#missions-intro').textContent = '每关标注“已核实”或“改编规则”；改编关卡沿用旧版规则，通关记录独立保存。';
    h += '<p class="muted">已按实体规则核实：' + MISSIONS.PHYSICAL.map(function (m) { return m.id; }).join('、') + '。其余任务仍为改编规则；全 66 关卡面已核对，特殊机制和音频按阶段实现。</p>';
    list.forEach(function (m) {
      if (m.tier !== tier) { if (tier) h += '</div>'; tier = m.tier; h += '<h3 class="tier-h">' + tier + '</h3><div class="mgrid">'; }
      var done = doneList.indexOf(m.id) >= 0;
      h += '<article class="mitem' + (done ? ' done' : '') + '"><div class="mcard-h"><span class="mnum">' + m.id + '</span><div><h4>' + esc(m.name) + '</h4><span class="tag' + (m.verified ? ' yes' : '') + '">' + esc(m.status) + '</span>' + (done ? '<span class="tag yes">已通关</span>' : '') + '</div></div><p>' + esc(m.brief) + '</p><div class="chips">' + ruleChips(m) + '</div>' + (m.two ? '<p class="muted small-t">2 人变化：' + (m.two.y ? '黄 ' + m.two.y[0] + (m.two.y[0] !== m.two.y[1] ? '/' + m.two.y[1] : '') + '；' : '') + (m.two.r ? '红 ' + m.two.r[0] + (m.two.r[0] !== m.two.r[1] ? '/' + m.two.r[1] : '') : '') + '</p>' : '') + '</article>';
    });
    h += '</div>';
    el.innerHTML = h;
    $('#mprog').textContent = '已通关 ' + doneList.length + ' / ' + list.length;
  }

  /* ---------- 事件 ---------- */
  document.addEventListener('click', function (ev) {
    var b = ev.target.closest('[data-go],[data-act],.tile,.slot[data-w]');
    // WebKit can report the mat as the target inside a transformed button's
    // rectangle. Resolve only legal wire rectangles, never nearby table space.
    if (!b && ev.detail > 0 && S.view3d && ev.target.closest('#g-stage .mat3')) {
      var distance = Infinity;
      document.querySelectorAll('#g-stage .slot.can[data-w]').forEach(function (wire) {
        var r = wire.getBoundingClientRect();
        if (ev.clientX < r.left || ev.clientX > r.right || ev.clientY < r.top || ev.clientY > r.bottom) return;
        var d = Math.pow(ev.clientX - (r.left + r.right) / 2, 2) + Math.pow(ev.clientY - (r.top + r.bottom) / 2, 2);
        if (d < distance) { b = wire; distance = d; }
      });
    }
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
      case 'legacy-resume': resumeLegacyPhysical(); break;
      case 'host': hostCreate(); break;
      case 'join': guestJoin($('#jcode').value); break;
      case 'spectate': guestJoin($('#jcode').value, true); break;
      case 'spectator-role':
        if (officialOnline() && S.lobby && !S.lobby.started) S.net.emit('official:role', { role: S.spectator ? 'player' : 'spectator' });
        break;
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
      case 'nextm': { var items = catalog(V.catalog || V.ruleset), ix = items.findIndex(function (x) { return x.id === V.mid; }); if (items[ix + 1]) { S.lobby.mid = items[ix + 1].id; hostStart(); } break; }
      case 'tolobby': returnToLobby(); break;
      case 'host-pause': togglePause(); break;
      case 'host-quit':
        if (canManageGame() && V && window.confirm('退出将结束当前牌局，所有玩家返回大厅。本局进度将不会保留。确定退出？')) returnToLobby();
        break;
      case 'audio-prepare': {var preparing=gameAudio.prepare();render();preparing.then(function(error){if(error)toast(error);render();});break;}
      case 'audio-ready': doAct({a:'audio-ready',id:V.audio.preparation.id,sha256:V.audio.source.sha256,ready:!V.audio.preparation.ready[myIdx()]});break;
      case 'audio-start': if(officialOnline())S.net.emit('official:audio-start',{gid:V.gid,revision:S.revision,commandId:String(++S.commandSeq)+'-'+rid(8),id:V.audio.preparation.id});else if(S.G){var error=BB.initializeAudio(S.G,S.G.audioPreparation.definition,{serverAudio:true});if(error)toast(error);else hostSync();}break;
      case 'audio-enable': gameAudio.enable().then(function(error){if(error)toast(error);render();});break;
      case 'view': S.view3d = !S.view3d; store.set('view3d', S.view3d); render(); break;
      case 'log-latest': {
        var log = $('#g-log');
        if (log) { log.scrollTop = log.scrollHeight; log.focus({ preventScroll: true }); }
        break;
      }
      case 'locate-target': {
        var call = cutDeclaration(V);
        if (!call) break;
        var id = call.step === 'own' ? call.hit : call.result && call.result.wire != null ? call.result.wire : call.choices && call.choices.length ? call.choices[0] : call.ids[0];
        var target = $('#scr-game .declared-target[data-w="' + id + '"]');
        if (target) { target.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' }); target.focus({ preventScroll: true }); }
        break;
      }
      case 'personal': { var role = BB.CHARACTERS[BB.characterState(V.players[me]).id]; S.sel = { mode: 'eq', n: role.equipment, personal: true, wires: [], vals: [] }; render(); break; }
      case 'communication-penalty': doAct({ a: 'communication-penalty' }); break;
      case 'secret-choose': doAct({ a: 'secret-choose', id: V.pending.id, value: +b.dataset.v }); break;
      case 'secret-reveal': doAct({ a: 'secret-reveal', id: V.pending.id }); break;
      case 'number-draw': doAct({ a: 'number-draw', id: V.official.radarCommand.decisionId }); break;
      case 'radar-query': doAct({ a: 'radar-query', id: V.official.radarCommand.decisionId }); break;
      case 'radar-reply': doAct({ a: 'radar-reply', id: V.pending.id, answers: V.pending.ownAnswers }); break;
      case 'hidden-equipment': if (V.pending && V.pending.type === 'equipment-reveal' && !V.paused) doAct({ a: 'equipment-reveal', id: V.pending.id, slot: b.dataset.slot }); else toast('这张装备仍背面朝上；完成当前数字的四根蓝线后才能选择翻开。'); break;
      case 'skip-equipment': doAct({ a: 'equipment-reveal', id: V.pending.id, slot: null }); break;
      case 'command-select': doAct({ a: 'command-select', id: V.official.radarCommand.decisionId, p: +b.dataset.p }); break;
      case 'constraint-select': doAct({ a: 'constraint-select', id: V.official.constraints.decisionId, card: b.dataset.card }); break;
      case 'constraint-keep': doAct({ a: 'constraint-ready', id: V.official.constraints.decisionId, replace: false }); break;
      case 'constraint-next': doAct({ a: 'constraint-ready', id: V.official.constraints.decisionId, replace: true }); break;
      case 'mode': S.sel = b.dataset.m === 'dd' || b.dataset.m === 'outward' ? { mode: b.dataset.m, wires: [] } : null; render(); break;
      case 'outward-skip': doAct({ a: 'outward-skip' }); break;
      case 'outward-solo': doAct({ a: 'outward-solo', val: +b.dataset.v, outs: BB.doubleOutward(V)?b.dataset.outs.split(',').map(Number):undefined }); break;
      case 'outward-own': S.sel={mode:'outward',own:+b.dataset.own,wires:[],vals:[]};render();break;
      case 'number-relay-card': S.sel.value=+b.dataset.value;render();break;
      case 'number-relay-recipient': S.sel.recipient=+b.dataset.p;render();break;
      case 'number-relay-confirm': doAct({a:'number-relay',id:V.pending.id,value:S.sel.value,recipient:S.sel.recipient});break;
      case 'number-relay-skip': doAct({a:'number-relay-skip'});break;
      case 'outward-red': doAct({ a: 'outward-red' }); break;
      case 'red': doAct({ a: 'red' }); break;
      case 'initial-clue-aside': doAct({ a: 'initial-clue', id: V.pending.id, w: null, rack: +b.dataset.rack }); break;
      case 'nano-rack': doAct({a:'nano-rack',id:V.pending.id,rack:+b.dataset.rack});break;
      case 'submarine-transfer-pick': S.sel={mode:'oxygen-transfer',partner:+b.dataset.p,direction:b.dataset.mode};render();break;
      case 'submarine-transfer-confirm': {var input=$('#submarine-transfer-amount');if(input&&input.reportValidity())doAct({a:'submarine-transfer',id:V.pending.id,mode:S.sel.direction,p:S.sel.partner,amount:+input.value});break;}
      case 'submarine-transfer-skip': doAct({a:'submarine-transfer',id:V.pending.id,mode:'skip'});break;
      case 'submarine-red': doAct({a:'submarine-red',id:V.pending.id,rack:+b.dataset.rack});break;
      case 'submarine-skip': doAct({a:'submarine-skip'});break;
      case 'passing-oxygen-signal': doAct({a:'passing-oxygen-signal'});break;
      case 'passing-oxygen-skip': doAct({a:'passing-oxygen-skip'});break;
      case 'grapple-rack': doAct({a:'grapple-rack',id:V.pending.id,rack:+b.dataset.rack});break;
      case 'locate-false-info': {var target=$('#scr-game .act [data-act="false-info"]');if(target){target.scrollIntoView({behavior:'smooth',block:'center'});target.focus({preventScroll:true});}break;}
      case 'false-info': doAct({a:'false-info',id:V.pending.id,val:+b.dataset.v});break;
      case 'order-draw': doAct({a:'order-draw',id:BB.numberOrder(V).decisionId});break;
      case 'order-assign': doAct({a:'order-assign',id:BB.numberOrder(V).decisionId,p:+b.dataset.p});break;
      case 'order-answer': doAct({a:'order-answer',id:V.pending.id});break;
      case 'memory-ready': doAct({a:'memory-ready',id:V.pending.id});break;
      case 'memory-locate': {var memory=BB.memorySea(V),target=memory&&memory.point&&$('#scr-game .memory-target[data-w="'+memory.point.wire+'"]');if(target){target.scrollIntoView({behavior:'smooth',block:'center',inline:'center'});target.focus({preventScroll:true});}break;}
      case 'personal-oxygen-recipient': personalOxygenRecipient(V,myIdx());S.oxygenRecipient=+b.dataset.p;render();break;
      case 'personal-oxygen-signal': doAct({a:'personal-oxygen-signal'});break;
      case 'personal-oxygen-skip': doAct({a:'personal-oxygen-skip'});break;
      case 'oxygen-signal': doAct({a:'oxygen-signal'});break;
      case 'oxygen-skip': doAct({a:'oxygen-skip'});break;
      case 'arithmetic-card': {if(!BB.arithmetic(V)||V.turn!==me||V.pending||V.paused)break;var choice=S.arithmeticChoice||{cards:[],operation:'sum'},card=+b.dataset.card;choice.cards=choice.cards.indexOf(card)>=0?choice.cards.filter(function(v){return v!==card;}):choice.cards.concat([card]).slice(-2);S.arithmeticChoice=choice;render();break;}
      case 'arithmetic-op': if(BB.arithmetic(V)&&V.turn===me&&!V.pending&&!V.paused){S.arithmeticChoice=S.arithmeticChoice||{cards:[],operation:'sum'};S.arithmeticChoice.operation=b.dataset.operation;render();}break;
      case 'arithmetic-skip': {var choice=S.arithmeticChoice||{cards:[]};S.arithmeticChoice=null;doAct({a:'arithmetic-skip',cards:choice.cards.slice()});break;}
      case 'claim-draw': case 'claim-number': case 'claim-penalty': doAct({a:a,id:BB.numberClaim(V).decisionId});break;
      case 'claim-assign': doAct({a:'claim-assign',id:BB.numberClaim(V).decisionId,p:+b.dataset.p});break;
      case 'tripwire-start': S.sel={mode:'tripwire',wires:[]};render();break;
      case 'tripwire-submit': doAct({a:'tripwire-cut',w:S.sel.wires[0]});break;
      case 'tripwire-reply': doAct({a:'tripwire-reply',id:V.pending.id});break;
      case 'precision-start': S.sel = {mode:'precision',wires:[]}; render(); break;
      case 'precision-submit': doAct({a:'precision-cut',ws:S.sel.wires}); break;
      case 'precision-reply': doAct({a:'precision-reply',id:V.pending.id}); break;
      case 'yellow-three-start': S.sel = {mode:'yellow-three',wires:[]}; render(); break;
      case 'yellow-three-submit': doAct({a:'yellow-three-cut',ws:S.sel.wires}); break;
      case 'yellow-three-reply': doAct({a:'yellow-three-reply',id:V.pending.id}); break;
      case 'risky-start': S.sel = { mode: 'risky', wires: [] }; render(); break;
      case 'risky-submit': doAct({ a: 'risky-cut', ws: S.sel.wires }); break;
      case 'risky-reply': doAct({ a: 'risky-reply', id: V.pending.id }); break;
      case 'resolve-empty': doAct({ a: 'resolve', id: V.pending.id, w: null }); break;
      case 'missing-value': {
        if (!canPlaceInfo(V, me) || !V.official.missingSetup) break;
        var value = parseVal(b.dataset.v), current = S.sel && S.sel.mode === 'missing-clues' ? S.sel.values.slice() : [];
        if (current.indexOf(value) >= 0) current = current.filter(function (v) { return v !== value; });
        else if (current.length < BB.setupNeed(V, me)) current.push(value);
        S.sel = { mode: 'missing-clues', values: current }; render(); break;
      }
      case 'missing-submit': {
        var chosen = S.sel && S.sel.mode === 'missing-clues' ? S.sel.values : [];
        doAct({ a: 'missing-clues', id: V.official.missingSetup.id, values: chosen, racks: chosen.map(function (_, i) { return V.players[me].stands.length === 2 ? chosen.length === 1 ? +b.dataset.rack : i : 0; }) }); break;
      }
      case 'clue-select': doAct({ a: 'clue-select', id: V.pending.id, token: b.dataset.token }); break;
      case 'clue-aside': doAct({ a: 'clue-place', id: V.pending.id, w: null, rack: +b.dataset.rack }); break;
      case 'fake-value': if (V.official.fakeSetup && S.sel && S.sel.mode === 'fake-info') doAct({ a: 'info', id: V.official.fakeSetup.id, w: S.sel.wires[0], val: +b.dataset.v }); break;
      case 'failure-value': S.sel = { mode: 'failure-clue', value: parseVal(b.dataset.v) }; render(); break;
      case 'sequence-end': doAct({ a: 'sequence-end', id: V.pending.id, end: b.dataset.end }); break;
      case 'constraint-replace': doAct({a:'constraint-replace',revision:BB.constraintRing(V).revision}); break;
      case 'constraint-rotation': doAct({a:'constraint-rotation',id:BB.constraintRing(V).decisionId,direction:+b.dataset.direction}); break;
      case 'constraint-vote': doAct({a:'constraint-vote',id:V.pending.id,agree:b.dataset.agree==='yes'}); break;
      case 'robot-move': doAct({a:'robot-move',id:BB.robotRoute(V).decisionId,val:+b.dataset.v}); break;
      case 'turn-claim': doAct({a:'turn-claim',id:BB.freeTurn(V).decisionId}); break;
      case 'weak-player': S.sel.player=+b.dataset.p;render();break;
      case 'weak-constraint': S.sel.constraint=b.dataset.id;render();break;
      case 'weak-confirm': doAct({a:'weak-guess',id:BB.weakLink(V).decisionId,player:S.sel.player,constraint:S.sel.constraint});break;
      case 'weak-pass': doAct({a:'weak-pass',id:BB.weakLink(V).decisionId});break;
      case 'robot-reverse': doAct({a:'robot-reverse',id:BB.robotRoute(V).decisionId}); break;
      case 'robot-direction': doAct({a:'robot-direction',id:V.pending.id,direction:+b.dataset.direction}); break;
      case 'resolve-target': doAct({ a: 'resolve', id: V.pending.id, w: +b.dataset.choice, clueVal: S.sel && S.sel.mode === 'failure-clue' ? S.sel.value : undefined }); break;
      case 'solo': doAct({ a: 'solo', val: parseVal(b.dataset.v) }); break;
      case 'val': onVal(parseVal(b.dataset.v)); break;
      case 'eq': {
        var n = +b.dataset.n;
        if (V.official && V.official.radarCommand) { if (equipStatus(V, me, V.equip[0]).usable) doAct({ a: 'radar-query', id: V.official.radarCommand.decisionId }); else toast('本关雷达只在轮值玩家翻卡后查询该数字。'); break; }
        if (V.ruleset === 'physical' && n === 10 && equipStatus(V, me, V.equip.filter(function (e) { return e.n === n; })[0]).usable) {
          if (!S.sel || (S.sel.mode !== 'dual' && S.sel.mode !== 'dd' && !(S.sel.mode === 'eq' && (S.sel.n === 3 || S.sel.n === 5)))) S.sel = { mode: 'dual', wires: [], vals: [] };
          S.sel.xy = !S.sel.xy; S.sel.vals = []; render(); break;
        }
        if (V.ruleset !== 'physical' && (n === 6 || n === 7 || n === 9)) { doAct({ a: 'equip', n: n }); break; }
        S.sel = S.sel && S.sel.mode === 'eq' && S.sel.n === n ? null : { mode: 'eq', n: n, wires: [], vals: [] };
        render(); break;
      }
      case 'eqinstant': doAct({ a: 'equip', n: S.sel.n }); break;
      case 'battery-p': { var sp = S.sel.players || [], bp = +b.dataset.p; S.sel.players = sp.indexOf(bp) >= 0 ? sp.filter(function (x) { return x !== bp; }) : sp.concat([bp]).slice(-2); render(); break; }
      case 'battery-go': doAct({ a: 'equip', n: 7, players: S.sel.players }); break;
      case 'eqcancel': S.sel = null; render(); break;
      case 'eqp': {
        var sel = S.sel, p = +b.dataset.p;
        if (sel.n === 2) doAct(selectedAction({ a: 'equip', n: 2, w: sel.wires[0], p: p }));
        else doAct({ a: 'equip', n: 11, p: p });
        break;
      }
      case 'eqgo': {
        var s2 = S.sel;
        if (s2.n === 10) doAct(selectedAction({ a: 'equip', n: 10, w: s2.wires[0], vals: s2.vals, stab: !!s2.stab }));
        if (s2.n === 1 || s2.n === 12) doAct({ a: 'equip', n: s2.n, w1: s2.wires[0], w2: s2.wires[1] });
        if (s2.n === 4) doAct({ a: 'equip', n: 4, w: s2.wires[0] });
        if(s2.n===18)doAct({a:'equip',n:18,w:s2.wires[0]});
        if(s2.n===16)doAct({a:'equip',n:16,ws:s2.wires.slice(),val:BB.annOf(wireOf(V,s2.wires[0]).w)});
        if(s2.n===14)doAct({a:'equip',n:14,w:s2.wires[0]});
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
  function announcementWhere(V, id) {
    var f = wireOf(V, id);
    return f ? V.players[f.o].name + '第 ' + (f.s + 1) + ' 排第 ' + (f.st.indexOf(f.w) + 1) + ' 根线' : '目标线';
  }
  function onTile(id, o, s) {
    var V = S.V, me = myIdx();
    if (!V || me < 0) return;
    var W = wireOf(V, id);
    if (!W || !clickable(V, W.w, o, me)) return;
    if (V.phase === 'setup') {
      if (V.official && V.official.fakeSetup) { S.sel = { mode: 'fake-info', wires: [id] }; render(); return; }
      doAct(V.official && (V.official.riskyRedCut || V.official.randomInitialClues) ? { a: 'initial-clue', id: V.pending.id, w: id } : { a: 'info', w: id }); return;
    }
    if (V.pending && V.pending.to === me) { doAct({ a: V.pending.type === 'cut' ? 'resolve' : V.pending.type === 'clue' ? 'clue-place' : V.pending.type === 'precision-clue' ? 'precision-clue' : V.pending.type==='number-claim-clue'?'claim-clue':V.pending.type==='order-clue'?'order-clue':'walkie', id: V.pending.id, w: id, clueVal: S.sel && S.sel.mode === 'failure-clue' ? S.sel.value : undefined }); return; }
    var sel = S.sel || { mode: 'dual', wires: [] };
    var ws = sel.wires || [];
    function sameGroup(list, needStand) {
      return list.every(function (x) { var X = wireOf(V, x); return X.o === o && (!needStand || X.s === s); });
    }
    if (sel.mode === 'precision') ws = ws.indexOf(id) >= 0 ? ws.filter(function(x){return x!==id;}) : ws.concat([id]).slice(-4);
    else if (sel.mode === 'risky' || sel.mode === 'yellow-three') ws = ws.indexOf(id) >= 0 ? ws.filter(function (x) { return x !== id; }) : ws.concat([id]).slice(-3);
    else if (sel.mode === 'dual') ws = ws[0] === id ? [] : [id];
    else if(sel.mode==='eq'&&sel.n===16)ws=ws.indexOf(id)>=0?ws.filter(function(x){return x!==id;}):ws.concat([id]).slice(-2);
    else if (sel.mode === 'dd' || (sel.mode === 'eq' && (sel.n === 3 || sel.n === 1 || sel.n === 12))) {
      var lim = sel.mode === 'dd' || sel.n !== 3 ? 2 : 3;
      if (ws.indexOf(id) >= 0) ws = ws.filter(function (x) { return x !== id; });
      else { if (!sameGroup(ws, sel.mode === 'dd' || sel.n !== 3 || BB.usesCutChoices(V))) ws = []; ws = ws.concat([id]).slice(-lim); }
    } else if (sel.mode === 'eq' && sel.n === 5) ws = W.st.filter(function (w) { return !w.cut && BB.equipmentWireAllowed(V, me, w); }).map(function (w) { return w.id; });
    else ws = ws[0] === id ? [] : [id];
    sel.wires = ws;
    S.sel = sel;
    render();
  }
  function onVal(val) {
    var sel = S.sel || { mode: 'dual', wires: [] }, ws = sel.wires || [];
    if (sel.mode === 'outward' && ws.length === 1) { doAct({ a: 'outward-dual', w: ws[0], val: val, own: sel.own }); return; }
    if (sel.xy && S.V.ruleset === 'physical') {
      if (val === 'Y' && (sel.mode === 'dd' || (sel.mode === 'eq' && (sel.n === 3 || sel.n === 5)))) { toast('与探测器组合时只能宣告蓝色数字', 'bad'); return; }
      sel.vals = sel.vals || [];
      if (sel.vals.indexOf(val) >= 0) sel.vals = sel.vals.filter(function (v) { return v !== val; });
      else if (sel.vals.length >= 2) sel.vals = [sel.vals[0], val];
      else sel.vals.push(val);
      if (sel.vals.length < 2) { S.sel = sel; render(); return; }
      if (sel.mode === 'dual' && ws.length === 1) { doAct({ a: 'dual', w: ws[0], val: sel.vals[0], vals: sel.vals, xy: true, xyPersonal: !!sel.xyPersonal, stab: !!sel.stab }); return; }
      if (sel.mode === 'dd' && ws.length === 2) { doAct({ a: 'dd', ws: ws, val: sel.vals[0], vals: sel.vals, xy: true, xyPersonal: !!sel.xyPersonal, stab: !!sel.stab }); return; }
      if (sel.mode === 'eq' && (sel.n === 3 || sel.n === 5)) { var wx = wireOf(S.V, ws[0]); doAct(selectedAction(sel.n === 3 ? { a: 'equip', n: 3, ws: ws, val: sel.vals[0], vals: sel.vals, xy: true, xyPersonal: !!sel.xyPersonal, stab: !!sel.stab } : { a: 'equip', n: 5, p: wx.o, s: wx.s, val: sel.vals[0], vals: sel.vals, xy: true, xyPersonal: !!sel.xyPersonal, stab: !!sel.stab })); return; }
    }
    if (sel.mode === 'dual' && ws.length === 1) doAct({ a: 'dual', w: ws[0], val: val, stab: !!sel.stab });
    else if (sel.mode === 'dd' && ws.length === 2) doAct({ a: 'dd', ws: ws, val: val, stab: !!sel.stab });
    else if (sel.mode === 'eq') {
      if (sel.n === 3 && ws.length >= 2) doAct(selectedAction({ a: 'equip', n: 3, ws: ws, val: val, stab: !!sel.stab }));
      else if (sel.n === 5 && ws.length) { var W = wireOf(S.V, ws[0]); doAct({ a: 'equip', n: 5, p: W.o, s: W.s, val: val, stab: !!sel.stab }); }
      else if (sel.n === 8) doAct(selectedAction({ a: 'equip', n: 8, val: val }));
      else if (sel.n === 10) {
        var i = sel.vals.indexOf(val);
        if (i >= 0) sel.vals.splice(i, 1); else sel.vals = sel.vals.concat([val]).slice(-2);
        render();
      }
    }
  }
  document.addEventListener('change', function (ev) {
    if (ev.target.id === 'spectator-perspective' && officialOnline() && S.spectator) S.net.emit('official:perspective', { pid: ev.target.value || null });
    if (ev.target.classList.contains('character-select')) {
      var i = +ev.target.dataset.seat;
      if (officialOnline()) S.net.emit('official:character', { character: ev.target.value, bot: S.lobby.seats[i].bot ? S.lobby.seats[i].pid : undefined });
      else { S.lobby.seats[i].character = ev.target.value; emitLobby(); render(); }
    }
    if (ev.target.id === 'msel') { S.lobby.mid = +ev.target.value; S.lobby.catalog = S.lobby.catalog || 'campaign'; S.lobby.ruleset = S.lobby.catalog; emitLobby(); render(); }
    if (ev.target.id === 'mod-xy' || ev.target.id === 'mod-personal-xy' || ev.target.id === 'mod-stab') {
      if (!S.sel || (S.sel.mode !== 'dual' && S.sel.mode !== 'dd' && !(S.sel.mode === 'eq' && (S.sel.n === 3 || S.sel.n === 5)))) S.sel = { mode: 'dual', wires: [], vals: [] };
      if (ev.target.id === 'mod-stab') S.sel.stab = ev.target.checked;
      else { S.sel.xy = ev.target.checked; S.sel.xyPersonal = ev.target.id === 'mod-personal-xy' && ev.target.checked; }
      S.sel.vals = []; render();
    }
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
