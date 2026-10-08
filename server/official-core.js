const BB = require('../js/engine');
const Bot = require('../js/bot');
const Missions = require('../js/missions');

function officialService(wss, runtime) {
  const store = runtime.store;
  const setTimeout = runtime.setTimeout;
  const clearTimeout = runtime.clearTimeout;
  const rooms = new Map();
  const token = runtime.token;
  function remember(room, key) {
    room.seen.add(key);
    // 旧命令仍由 gid/revision 拒绝；限制回执集合，防止无限增长。
    while (room.seen.size > 256) room.seen.delete(room.seen.values().next().value);
  }
  const send = (ws, topic, data) => {
    if (ws.readyState === 1) ws.send(JSON.stringify({ t: 'msg', topic, data, peer: 'official-server' }));
  };
  const sockets = room => [...wss.clients].filter(ws => ws.room === room.name && ws.readyState === 1);
  function save(room) {
    store.write(room.name, JSON.stringify({ version: 1, name: room.name, host: room.host, mid: room.mid, ruleset: room.ruleset,
      attempts: room.attempts, started: room.started, seats: room.seats, observers: room.observers || [], revision: room.revision, seen: [...room.seen], G: room.G }));
  }
  function load(name) {
    if (rooms.has(name)) return rooms.get(name);
    const snapshot = store.read(name);
    if (!snapshot) return null;
    try {
      const data = JSON.parse(snapshot);
      const ruleset = data.ruleset || 'physical';
      if (data.version !== 1 || data.name !== name || !['campaign', 'physical'].includes(ruleset) || !Missions.get(ruleset, data.mid)) return null;
      let recovered = false;
      if (data.G) {
        data.G.paused = !!data.G.paused;
        if (!data.G.paused) data.G.pauseRemaining = null;
        else if (data.G.pauseRemaining !== null && !Number.isFinite(data.G.pauseRemaining)) data.G.pauseRemaining = null;
        recovered = BB.recoverFatalState(data.G);
        if(runtime.restart && data.G.phase==='audio-ready'&&data.G.audioPreparation){data.G.players.forEach((_,pi)=>{if(BB.invalidateAudioReady(data.G,pi))recovered=true;});}
        if (recovered) data.revision = (data.revision || 0) + 1;
      }
      const room = { ...data, observers: Array.isArray(data.observers) ? data.observers : [], ruleset,
        seen: new Set(Array.isArray(data.seen) ? data.seen.filter(key => typeof key === 'string') : []), botTimer: null };
      rooms.set(name, room);
      if (recovered) save(room);
      return room;
    } catch (_) { return null; }
  }
  function effectiveSeats(room, mission) {
    const captain = room.attempts % room.seats.length;
    return room.seats.map((s, pi) => ({ ...s, character: !mission.personalCharacters || pi === captain ? 'double-detector' : s.character || 'double-detector' }));
  }
  function publicLobby(room) {
    const seats = !room.started ? effectiveSeats(room, Missions.get(room.ruleset, room.mid)) : room.seats;
    return { code: room.name.slice(3).toUpperCase(), host: room.host,
      seats: seats.map(s => ({ pid: s.pid, name: s.name, bot: !!s.bot, character: s.character || 'double-detector' })),
      ruleset: room.ruleset, catalog: room.ruleset, mid: room.mid, started: !!room.started, attempts: room.attempts,
      observers: (room.observers || []).map(o => ({ pid: o.pid, name: o.name })), revision: room.revision };
  }
  function lobby(room) { const data = publicLobby(room); sockets(room).forEach(ws => send(ws, 'official:lobby', data)); }
  function seat(room, ws) { return room.seats.find(s => !s.bot && s.credential === ws.officialCredential) || null; }
  function observer(room, ws) { return (room.observers || []).find(o => o.credential === ws.officialCredential) || null; }
  function member(room, ws) { return seat(room, ws) || observer(room, ws); }
  function view(room, recipient) {
    if (!room.G) return;
    for (const ws of sockets(room).filter(ws => !recipient || recipient(ws))) {
      const owner = seat(room, ws), watching = observer(room, ws);
      const pi = owner ? room.G.players.findIndex(p => p.pid === owner.pid) :
        watching && watching.perspective ? room.G.players.findIndex(p => p.pid === watching.perspective) : -1;
      const V = BB.view(room.G, pi);
      if (watching) {
        V.me = -1;
        V.spectator = true;
        V.perspective = watching.perspective || null;
        if (V.pending) { delete V.pending.choices; delete V.pending.preferredOwn; delete V.pending.publicMatch; delete V.pending.noSafe; delete V.pending.tokens; delete V.pending.canPlaceAside; delete V.pending.ownAnswers; delete V.pending.drawn; delete V.pending.clueValues; if(V.pending.type==='false-info')delete V.pending.wire; }
        if (V.official) { delete V.official.missingSetup; delete V.official.fakeSetup; delete V.official.licenseRequired; }
        if(BB.personalCardsLocked(V)){delete V.official.weakLink.ownOwner;delete V.official.weakLink.ownWeak;delete V.official.weakLink.ownConstraint;V.players.forEach(p=>{p.dd=0;p.character={id:'hidden',used:false,hidden:true,locked:true};});}
      } else { V.spectator = false; V.perspective = null; }
      send(ws, 'official:view', { revision: room.revision, view: V });
    }
  }
  function scheduleBot(room) {
    clearTimeout(room.botTimer);
    room.botTimer = null;
    const G = room.G;
    if (!G || G.paused || G.phase === 'won' || G.phase === 'lost') return;
    if(G.audioClock&&G.audioClock.cutHeld)return;
    let pi = -1, queuedAction = null, delay = 300;
    if (G.phase === 'setup') {
      const next = G.ruleset === 'physical' ? BB.setupActor(G) :
        G.players.findIndex((p, i) => p.bot && G.setup[i] < BB.setupNeed(G, i));
      if (next >= 0 && G.players[next].bot) pi = next;
    } else if (G.pending && G.players[G.pending.to].bot) pi = G.pending.to;
    else if(!G.pending&&BB.freeTurn(G)&&BB.freeTurn(G).step==='claim'){for(let owner=0;owner<G.np;owner++)if(G.players[owner].bot&&BB.freeTurnEligible(G,owner)){pi=owner;queuedAction=Bot.decide(G,owner);break;}}
    else if (!G.pending && BB.tripwire(G) && BB.tripwire(G).stalled) { for(let i=0;i<G.np;i++)if(G.players[i].bot){const action=Bot.decide(G,i);if(action){pi=i;queuedAction=action;break;}} }
    else if(!G.pending&&BB.numberClaim(G)&&BB.numberClaim(G).step==='claim'){
      for(let owner=0;owner<G.np;owner++)if(G.players[owner].bot){const action=Bot.decide(G,owner);if(action){pi=owner;queuedAction=action;break;}}
      if(pi<0&&G.players[G.captain].bot){queuedAction=Bot.claimAssignment(G,G.captain);if(queuedAction){pi=G.captain;if(G.players.some((p,owner)=>!p.bot&&G.wires.some(w=>w.o===owner&&!w.cut)))delay=5000;}}
    }
    else if (!G.pending && G.players[BB.turnActor(G)].bot) pi = BB.turnActor(G);
    if (pi < 0) return;
    room.botTimer = setTimeout(() => {
      if (room.G !== G || G.paused) return;
      const action = queuedAction || Bot.decide(G, pi);
      if (!action) return;
      const err = BB.act(G, pi, action);
      if (err) { console.warn('official bot:', err); return; }
      room.revision++; save(room); view(room); scheduleBot(room);
    }, delay);
  }
  function error(ws, msg) { send(ws, 'official:error', { msg }); }
  function identify(ws, d, create) {
    let room = load(ws.room);
    if (!room && create && d && ['physical', 'campaign'].includes(d.ruleset)) {
      const mid = Missions.get(d.ruleset, d.mid) ? Number(d.mid) : 1;
      room = { name: ws.room, host: null, ruleset: d.ruleset, mid, attempts: 0, started: false, seats: [], observers: [],
        revision: 0, G: null, seen: new Set(), botTimer: null };
      rooms.set(room.name, room);
    }
    if (!room) return false;
    const name = String((d && d.name) || '玩家').slice(0, 12);
    const credential = d && d.credential || ws.officialCredential;
    let current = room.seats.find(s => !s.bot && credential && s.credential === credential);
    let watching = (room.observers || []).find(o => credential && o.credential === credential);
    if (current && d && d.spectator && room.started) error(ws, '牌局进行中不能转换座位身份');
    if (current && d && d.spectator && !room.started) {
      room.seats = room.seats.filter(s => s !== current);
      watching = { pid: current.pid, name, credential: current.credential, perspective: null };
      room.observers.push(watching); current = null;
    }
    if (!current && !watching && d && d.credential && (room.observers || []).some(o => o.pid === d.pid)) {
      error(ws, '这个观战身份需要原浏览器的重连凭证'); return true;
    }
    if (!current && d && room.seats.some(s => s.pid === d.pid)) {
      error(ws, '这个座位需要原浏览器的重连凭证');
      return true;
    }
    if (!current && !watching && (d && d.spectator || room.started || room.seats.length >= 5)) {
      if ((room.observers || []).length >= 100) { error(ws, '房间观战身份已满'); return true; }
      watching = { pid: 'o' + token().slice(0, 14), name, credential: token(), perspective: null };
      room.observers.push(watching);
      if (!room.host) room.host = watching.pid;
    }
    if (!current && !watching && !room.started && room.seats.length < 5) {
      current = { pid: 'p' + token().slice(0, 14), name, credential: token(), bot: false };
      room.seats.push(current);
      if (!room.host) room.host = current.pid;
    }
    ws.officialCredential = current ? current.credential : watching ? watching.credential : null;
    if (current) {
      current.name = name;
      if (room.G) { const p = room.G.players.find(p => p.pid === current.pid); if (p) p.name = name; }
      if(room.G&&BB.invalidateAudioReady(room.G,room.G.players.findIndex(p=>p.pid===current.pid)))room.revision++;
      send(ws, 'official:welcome', { pid: current.pid, credential: current.credential, host: current.pid === room.host, role: 'player', perspective: null });
    } else if (watching) {
      watching.name = name;
      send(ws, 'official:welcome', { pid: watching.pid, credential: watching.credential, host: watching.pid === room.host, role: 'spectator', perspective: watching.perspective || null });
    }
    save(room); lobby(room); view(room); scheduleBot(room);
    return true;
  }
  function handle(ws, topic, d) {
    if (topic === 'official:hello') return identify(ws, d, true);
    const room = load(ws.room);
    if (!room) return false;
    if (topic === 'hello') return identify(ws, d, false);
    const actor = seat(room, ws);
    const identity = member(room, ws);
    const host = identity && identity.pid === room.host;
    if (topic === 'official:role') {
      if (!identity || !d || !['player', 'spectator'].includes(d.role)) return true;
      if (room.started) { error(ws, '牌局进行中不能更改身份'); return true; }
      if (d.role === 'spectator' && actor) {
        room.seats = room.seats.filter(s => s !== actor);
        const watching = { pid: actor.pid, name: actor.name, credential: actor.credential, perspective: null };
        room.observers = room.observers || [];
        room.observers.push(watching);
        ws.officialCredential = watching.credential;
      } else if (d.role === 'player' && !actor) {
        const watching = observer(room, ws);
        if (!watching || room.seats.length >= 5) { error(ws, '没有可用玩家座位'); return true; }
        room.observers = room.observers.filter(o => o !== watching);
        room.seats.push({ pid: watching.pid, name: watching.name, credential: watching.credential, bot: false });
      }
      room.revision++;
      const nowSeat = seat(room, ws), nowObserver = observer(room, ws);
      const switched = nowSeat || nowObserver;
      if (switched) {
        const welcome = nowSeat
          ? { pid: nowSeat.pid, credential: nowSeat.credential, host: nowSeat.pid === room.host, role: 'player', perspective: null }
          : { pid: nowObserver.pid, credential: nowObserver.credential, host: nowObserver.pid === room.host, role: 'spectator', perspective: nowObserver.perspective || null };
        sockets(room).filter(c => c.officialCredential === switched.credential).forEach(c => send(c, 'official:welcome', welcome));
      }
      save(room); lobby(room); view(room);
      return true;
    }
    if (topic === 'official:perspective') {
      const watching = observer(room, ws);
      if (!watching || !d || !(d.pid === null || typeof d.pid === 'string')) return true;
      const target = d.pid === null ? null : room.G && room.G.players.find(p => p.pid === d.pid);
      const lobbyPlayer = d.pid === null ? null : room.seats.find(s => s.pid === d.pid);
      if (d.pid !== null && !(target || (!room.started && lobbyPlayer))) { error(ws, '无效的观战视角'); return true; }
      watching.perspective = d.pid;
      save(room);
      view(room, c => c.officialCredential === watching.credential);
      return true;
    }
    if (topic === 'chat') {
      if (!actor) { error(ws, '观战者不能发送队内消息'); return true; }
      const G = room.G;
      const rules = G && G.mission.rules || {};
      if (G && G.phase !== 'won' && G.phase !== 'lost' && rules.noChat) {
        error(ws, '本关禁止聊天'); return true;
      }
      if (!d || typeof d.text !== 'string') return true;
      const text = d.text.trim().slice(0, 200);
      if (!text) return true;
      const packet = { pid: actor.pid, name: actor.name, text };
      sockets(room).forEach(c => send(c, 'chat', packet));
      return true;
    }
    if (topic === 'official:character') {
      if (room.started || !d || typeof d.character !== 'string' || !actor && !(host && d.bot)) return true;
      if (d.bot && !host) { error(ws, '只有房主能替机器人选择角色'); return true; }
      const target = d.bot && host ? room.seats.find(s => s.bot && s.pid === d.bot) : actor;
      if (!target) return true;
      const mi = Missions.get(room.ruleset, room.mid), captain = room.attempts % room.seats.length;
      const candidate = effectiveSeats(room, mi).map(s => ({ ...s, character: s.pid === target.pid ? d.character : s.character }));
      const invalid = BB.characterOptions(mi, room.seats.indexOf(target), captain).indexOf(d.character) < 0 || BB.validateCharacterSeats(mi, candidate, captain);
      if (invalid) { error(ws, typeof invalid === 'string' ? invalid : '此角色不能选择'); lobby(room); return true; }
      room.seats = candidate;
      save(room); lobby(room); return true;
    }
    if (topic === 'official:lobby') {
      if (!host || room.started) return true;
      const mid = Missions.get(room.ruleset, d && d.mid);
      if (!mid) { error(ws, '此任务不可用'); return true; }
      room.mid = mid.id;
      if (!mid.personalCharacters) room.seats.forEach(s => { s.character = 'double-detector'; });
      if (Array.isArray(d.seats)) {
        const candidates = d.seats.filter(s => s && typeof s === 'object').slice(0, 5);
        const wanted = new Set(candidates.map(s => s.pid));
        room.seats = room.seats.filter(s => s.pid === room.host || wanted.has(s.pid));
        for (const candidate of candidates) {
          if (room.seats.length >= 5) break;
          if (candidate.bot && !room.seats.some(s => s.pid === candidate.pid))
            room.seats.push({ pid: 'b' + token().slice(0, 12), name: String(candidate.name || 'AI').slice(0, 12), bot: true });
        }
      }
      save(room); lobby(room);
      return true;
    }
    if (topic === 'official:start') {
      if (!host || room.seats.length < 2) { error(ws, '至少需要两名玩家'); return true; }
      if (!d || typeof d.commandId !== 'string' || !d.commandId || d.commandId.length > 64) { error(ws, '无效的开局请求'); return true; }
      const key = identity.pid + ':start:' + d.commandId;
      if (room.seen.has(key)) { lobby(room); view(room); return true; }
      if ((room.started && room.G && room.G.phase !== 'won' && room.G.phase !== 'lost') ||
          !d || d.revision !== room.revision || typeof d.commandId !== 'string' || !d.commandId) {
        error(ws, '牌局状态已变化，请按最新大厅重试'); return true;
      }
      const mission = Missions.get(room.ruleset, d && d.mid);
      if (!mission) { error(ws, '此任务不可用'); return true; }
      const seats = effectiveSeats(room, mission);
      const charError = BB.validateCharacterSeats(mission, seats, room.attempts % room.seats.length);
      if (charError) { error(ws, charError); return true; }
      room.mid = mission.id;
      room.G = BB.createGame(mission, seats.map(s => ({ pid: s.pid, name: s.name, bot: !!s.bot, character: s.character || 'double-detector' })),
        { captain: room.attempts % room.seats.length });
      room.seats = seats; room.started = true; room.attempts++; room.revision++;
      remember(room, key);
      save(room); lobby(room); view(room); scheduleBot(room);
      return true;
    }
    if(topic==='official:audio-start'){
      if(!host){error(ws,'只有房主可开始任务音频');return true;}
      if(!d||typeof d.commandId!=='string'||!d.commandId||d.commandId.length>64){error(ws,'无效的音频开始请求');return true;}
      const key=identity.pid+':audio-start:'+d.commandId;if(room.seen.has(key)){view(room);return true;}
      const G=room.G,prep=G&&G.audioPreparation;
      if(!room.started||!prep||d.gid!==G.gid||d.revision!==room.revision||d.id!==prep.id){error(ws,'音频开始请求已过期');return true;}
      const connected=G.players.every(p=>p.bot||sockets(room).some(client=>client.readyState===1&&seat(room,client)?.pid===p.pid));
      if(!connected){error(ws,'请等待所有参与玩家连接并就绪');return true;}
      const err=BB.initializeAudio(G,prep.definition,{serverAudio:true,now:Date.now()});if(err){error(ws,err);return true;}
      remember(room, key);room.revision++;save(room);view(room);scheduleBot(room);return true;
    }
    if (topic === 'official:pause') {
      if (!host) { error(ws, '只有房主可以暂停或继续牌局'); return true; }
      if (!room.G || !room.started || !d || typeof d.paused !== 'boolean' ||
          typeof d.commandId !== 'string' || !d.commandId || d.commandId.length > 64) {
        error(ws, '无效的暂停请求'); return true;
      }
      const key = identity.pid + ':pause:' + d.commandId;
      if (room.seen.has(key)) { view(room); return true; }
      if (d.gid !== room.G.gid || d.revision !== room.revision) {
        error(ws, '牌局状态已变化，请按最新牌桌重试'); view(room); return true;
      }
      const wasPaused = !!room.G.paused;
      const pauseError = BB.setPaused(room.G, d.paused, Date.now());
      if (pauseError) { error(ws, pauseError); return true; }
      remember(room, key);
      if (wasPaused !== room.G.paused) {
        room.revision++;
        if (room.G.paused) { clearTimeout(room.botTimer); room.botTimer = null; }
        save(room); view(room); scheduleBot(room);
      } else { save(room); view(room); }
      return true;
    }
    if (topic === 'official:back') {
      if (!host) { error(ws, '只有房主可以退出牌局'); return true; }
      if (!d || typeof d.commandId !== 'string' || !d.commandId || d.commandId.length > 64) { error(ws, '无效的退出请求'); return true; }
      const key = identity.pid + ':back:' + d.commandId;
      if (room.seen.has(key)) { lobby(room); view(room); return true; }
      if (room.started && room.G && d && d.gid === room.G.gid && d.revision === room.revision &&
          typeof d.commandId === 'string' && d.commandId && d.commandId.length <= 64) {
        clearTimeout(room.botTimer); room.botTimer = null; room.G = null; room.started = false; room.revision++; remember(room, key); save(room); lobby(room);
      } else { error(ws, '牌局状态已变化，请按最新牌桌重试'); lobby(room); view(room); }
      return true;
    }
    if (topic === 'official:act') {
      if (!actor || !room.G || !d || typeof d.commandId !== 'string' || !d.commandId || d.commandId.length > 64) return true;
      const key = actor.pid + ':' + d.commandId;
      if (room.seen.has(key)) { view(room); return true; }
      if (d.gid !== room.G.gid || d.revision !== room.revision) { error(ws, '状态已变化，请按最新牌桌重试'); view(room); return true; }
      if (!d.action || typeof d.action !== 'object' || Array.isArray(d.action) || typeof d.action.a !== 'string' || d.action.a === 'timeout') { error(ws, '无效动作'); return true; }
      const pi = room.G.players.findIndex(p => p.pid === actor.pid);
      // Malformed client fields must neither crash the service nor partially mutate a game.
      const before = JSON.stringify(room.G);
      let err;
      try { err = BB.act(room.G, pi, d.action); }
      catch (_) { room.G = JSON.parse(before); err = '无效动作参数'; }
      if (err) { error(ws, err); return true; }
      remember(room, key); room.revision++;
      save(room); view(room); scheduleBot(room);
      return true;
    }
    // Authoritative rooms never accept client-authored public state or private hands.
    return true;
  }
  // 同一个规则服务由 Node 文件存储或云端 Durable Object 存储驱动。
  for (const name of store.names()) {
    const room = load(name);
    if (room) scheduleBot(room);
  }
  function tick() {

    for (const room of rooms.values()) {
      const G = room.G;
      if(G&&G.audioClock){const audio=BB.advanceAudio(G,{serverAudio:true,now:Date.now()});if(!audio.error&&audio.changed){room.revision++;save(room);view(room);scheduleBot(room);}}
      if (!G || G.paused || G.phase !== 'play' || !G.deadline || Date.now() < G.deadline) continue;
      if (!BB.act(G, G.turn, { a: 'timeout' }, { now: Date.now(), serverTimeout: true })) {
        room.revision++; save(room); view(room); scheduleBot(room);
      }
    }
  }
  if (runtime.interval) runtime.interval(tick, 250);
  // 供未来已核实的时间轴调用；WebSocket客户端没有此入口。
  function applyAudioEvent(name,event){const room=load(name);if(!room||!room.started||!room.G)return '房间没有正在进行的游戏';const before=JSON.stringify(room.G),err=BB.applySubmarineEvent(room.G,event,{serverAudio:true});if(err)return err;if(JSON.stringify(room.G)===before)return null;room.revision++;save(room);view(room);scheduleBot(room);return null;}
  function applyEquipmentEffect(name,event,options){const room=load(name);if(!room||!room.started||!room.G)return '房间没有正在进行的游戏';const before=JSON.stringify(room.G),err=BB.applyEquipmentEffect(room.G,event,{serverEquipment:true,rng:options&&options.rng});if(err)return err;if(JSON.stringify(room.G)===before)return null;room.revision++;save(room);view(room);scheduleBot(room);return null;}
  // 尚无客户端启动入口；仅后续核实过的服务端录音清单可调用。
  function initializeAudio(name,definition){const room=load(name);if(!room||!room.started||!room.G)return '房间没有正在进行的游戏';if(!room.G.audioPreparation)return '请先登记音频并等待参与玩家就绪';if(!room.G.players.every(p=>p.bot||sockets(room).some(client=>client.readyState===1&&seat(room,client)?.pid===p.pid)))return '请等待所有参与玩家连接并就绪';const err=BB.initializeAudio(room.G,definition,{serverAudio:true,now:Date.now()});if(err)return err;room.revision++;save(room);view(room);scheduleBot(room);return null;}
  function prepareAudio(name,definition){const room=load(name);if(!room||!room.started||!room.G)return '房间没有正在进行的游戏';const err=BB.prepareAudio(room.G,definition,{serverAudio:true});if(err)return err;room.revision++;save(room);view(room);return null;}
  function disconnect(ws){const room=load(ws.room),owner=room&&seat(room,ws);if(room&&owner&&room.G&&BB.invalidateAudioReady(room.G,room.G.players.findIndex(p=>p.pid===owner.pid))){room.revision++;save(room);view(room);}}
  function audioAsset(hash){for(const room of rooms.values()){const G=room.G,state=G&&(G.audioClock||G.audioPreparation),d=state&&state.definition;if(d&&d.asset&&G.mission&&state.version===1&&state.gid===G.gid&&d.asset.sha256===hash&&!require('../js/audio-timeline').validate(d,G.mission.id,G.mission.contentVersion))return {url:d.asset.url,sha256:d.asset.sha256,locale:d.asset.locale};}return null;}
  function nextWake() {
    let due = Infinity;
    for (const room of rooms.values()) {
      const G = room.G;
      if (!G || G.paused || ['won', 'lost'].includes(G.phase)) continue;
      if (G.phase === 'play' && G.deadline) due = Math.min(due, G.deadline);
      const clock = G.audioClock;
      if (clock && clock.status === 'running') {
        const cue = clock.definition.cues[clock.applied];
        due = Math.min(due, clock.startedAt + (cue ? cue.atMs : clock.definition.durationMs) - clock.baseMs);
      }
    }
    return due;
  }
  return { handle, load, tick, nextWake, reset: () => rooms.clear(), applyAudioEvent, applyEquipmentEffect, initializeAudio, prepareAudio, disconnect, audioAsset };
}

module.exports = officialService;
