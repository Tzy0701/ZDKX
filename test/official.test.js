const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const officialService = require('../server/official');
const BB = require('../js/engine');
const Missions = require('../js/missions');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bomb-busters-official-'));
const wss = { clients: new Set() };
const service = officialService(wss, dir);
function peer() {
  const ws = { room: 'bb-auth-test', readyState: 1, messages: [],
    send(raw) { this.messages.push(JSON.parse(raw)); } };
  wss.clients.add(ws);
  return ws;
}
function last(ws, topic) { return ws.messages.filter(m => m.topic === topic).at(-1)?.data; }
function act(ws, revision, gid, commandId, action, extra = {}) {
  service.handle(ws, 'official:act', { revision, gid, commandId, action, ...extra });
}
try {
  const host = peer();
  assert(service.handle(host, 'official:hello', { create: true, ruleset: 'physical', mid: 1, name: 'Host' }));
  const hostIdentity = last(host, 'official:welcome');
  assert(hostIdentity.credential);
  const guest = peer();
  assert(service.handle(guest, 'hello', { pid: 'guess', name: 'Guest' }));
  const guestIdentity = last(guest, 'official:welcome');
  assert.notStrictEqual(hostIdentity.pid, guestIdentity.pid);
  service.handle(host, 'official:start', { mid: 1, revision: 0, commandId: 'start-1' });
  const G = service.load(host.room).G;
  service.handle(host, 'official:start', { mid: 1, revision: 0, commandId: 'start-1' });
  assert.strictEqual(service.load(host.room).G.gid, G.gid);
  service.handle(host, 'official:back', { gid: 'stale-game', revision: 1, commandId: 'stale-back' });
  assert.strictEqual(service.load(host.room).G.gid, G.gid);
  const hostView = last(host, 'official:view').view;
  const guestView = last(guest, 'official:view').view;
  assert.strictEqual(hostView.gid, guestView.gid);
  assert(hostView.players[0].stands.flat().some(w => !w.cut && w.v != null));
  assert(hostView.players[1].stands.flat().every(w => !w.cut && w.v === null));
  assert(guestView.players[0].stands.flat().every(w => !w.cut && w.v === null));

  const revision = service.load(host.room).revision;
  const hostWire = G.wires.find(w => w.o === 0 && Number.isInteger(w.v));
  act(guest, revision, G.gid, 'spoof', { a: 'info', w: hostWire.id }, { pid: hostIdentity.pid });
  assert.strictEqual(service.load(host.room).revision, revision);
  assert(last(guest, 'official:error'));
  act(host, revision, G.gid, 'first', { a: 'info', w: hostWire.id });
  assert.strictEqual(service.load(host.room).revision, revision + 1);
  act(host, revision, G.gid, 'first', { a: 'info', w: hostWire.id });
  assert.strictEqual(service.load(host.room).revision, revision + 1);
  act(host, revision, G.gid, 'stale', { a: 'info', w: hostWire.id });
  assert.strictEqual(service.load(host.room).revision, revision + 1);
  act(host, revision + 1, G.gid, 'timeout', { a: 'timeout' });
  assert.strictEqual(service.load(host.room).revision, revision + 1);

  const reconnected = peer();
  service.handle(reconnected, 'hello', { credential: guestIdentity.credential, name: 'Guest again' });
  assert.strictEqual(last(reconnected, 'official:welcome').pid, guestIdentity.pid);
  assert(last(reconnected, 'official:view'));
  const restored = officialService({ clients: new Set() }, dir).load(host.room);
  assert.strictEqual(restored.G.gid, G.gid);
  assert.strictEqual(restored.revision, revision + 1);
  const room = service.load(host.room);
  room.G.phase = 'won';
  service.handle(host, 'official:start', { mid: 1, revision: room.revision, commandId: 'next-attempt' });
  assert.notStrictEqual(room.G.gid, G.gid);
  assert.strictEqual(room.G.captain, 1);
  console.log('✓ authoritative views, seat credentials, stale commands and snapshots');
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}

const chatDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bomb-busters-chat-'));
const chatWss = { clients: new Set() };
const chatService = officialService(chatWss, chatDir);
function chatPeer(room) {
  const ws = { room, readyState: 1, messages: [], send(raw) { this.messages.push(JSON.parse(raw)); } };
  chatWss.clients.add(ws);
  return ws;
}
try {
  for (const mid of [1, 2, 11]) {
    const name = 'bb-chat-' + mid;
    const host = chatPeer(name), guest = chatPeer(name), spectator = chatPeer(name);
    const outsider = chatPeer(name + '-other');
    chatService.handle(host, 'official:hello', { ruleset: 'campaign', mid, name: 'Host' });
    chatService.handle(guest, 'hello', { name: 'Guest' });
    chatService.handle(host, 'official:start', { mid, revision: 0, commandId: 'chat-start' });
    const room = chatService.load(name);
    for (const phase of ['setup', 'play', 'won', 'lost']) {
      room.G.phase = phase;
      const before = JSON.stringify(room.G), revision = room.revision;
      const text = '通讯测试 ' + mid + ' ' + phase;
      const blocked = mid === 11 && (phase === 'setup' || phase === 'play');
      for (const ws of [host, guest]) {
        for (const c of chatWss.clients) c.messages = [];
        chatService.handle(ws, 'chat', { text: '  ' + text + '  ', name: 'Spoofed', pid: 'spoofed' });
        if (blocked) {
          assert.strictEqual(last(ws, 'official:error')?.msg, '本关禁止聊天');
          assert([...chatWss.clients].every(c => !last(c, 'chat')));
        } else {
          const expectedName = ws === host ? 'Host' : 'Guest';
          for (const c of [host, guest, spectator]) {
            assert.strictEqual(last(c, 'chat')?.text.trim(), text);
            assert.strictEqual(last(c, 'chat')?.name, expectedName);
          }
          assert(!last(outsider, 'chat'));
        }
        assert.strictEqual(JSON.stringify(room.G), before, 'chat must not change the game');
        assert.strictEqual(room.revision, revision);
      }
    }
    for (const c of chatWss.clients) c.messages = [];
    chatService.handle(spectator, 'chat', { text: 'spectator cannot speak for a seat' });
    chatService.handle(host, 'chat', { text: '   ' });
    assert([...chatWss.clients].every(c => !last(c, 'chat')));
  }
  console.log('✓ chat broadcasts in setup/play/results without mutating games; silent missions and seat identity enforced');
} finally { fs.rmSync(chatDir, { recursive: true, force: true }); }

const restartDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bomb-busters-restart-'));
const restartName = 'bb-restore';
const restartGame = BB.createGame(Missions.get('physical', 1), [
  { pid: 'person', name: 'Person' }, { pid: 'bot', name: 'Bot', bot: true }
], { captain: 1, rng: () => 0.4 });
fs.writeFileSync(path.join(restartDir, restartName + '.json'), JSON.stringify({
  version: 1, name: restartName, host: 'person', mid: 1, attempts: 1, started: true,
  seats: [{ pid: 'person', name: 'Person', credential: 'secret', bot: false },
    { pid: 'bot', name: 'Bot', bot: true }], revision: 0, G: restartGame
}));
const afterRestart = officialService({ clients: new Set() }, restartDir);
setTimeout(() => {
  try {
    assert.strictEqual(afterRestart.load(restartName).G.setup[1], 1);
    assert.strictEqual(afterRestart.load(restartName).revision, 1);
    console.log('✓ saved bot turn resumes after server restart without a client');
  } finally { fs.rmSync(restartDir, { recursive: true, force: true }); }
}, 500);

const roleDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bomb-busters-roles-'));
const roleWss = { clients: new Set() }, roleService = officialService(roleWss, roleDir);
function rolePeer() { const ws = { room: 'bb-roles', readyState: 1, messages: [], send(raw) { this.messages.push(JSON.parse(raw)); } }; roleWss.clients.add(ws); return ws; }
function roleAct(ws, revision, gid, commandId, action) { roleService.handle(ws, 'official:act', { revision, gid, commandId, action }); }
try {
  const peers = Array.from({ length: 5 }, rolePeer);
  peers.forEach((ws, i) => roleService.handle(ws, i ? 'hello' : 'official:hello', { ruleset: 'campaign', mid: 33, name: '角色玩家' + i }));
  const room = roleService.load('bb-roles');
  const ids = ['triple-detector', 'xy-ray', 'general-radar', 'walkie-talkies'];
  peers.slice(1).forEach((ws, i) => roleService.handle(ws, 'official:character', { character: ids[i], pid: room.seats[0].pid }));
  assert.deepEqual(room.seats.slice(1).map(s => s.character), ids);
  assert.equal(room.seats[0].character || 'double-detector', 'double-detector');
  const before = JSON.stringify(room.seats);
  roleService.handle(peers[2], 'official:character', { character: 'triple-detector' });
  roleService.handle(peers[0], 'official:character', { character: 'general-radar' });
  assert.equal(JSON.stringify(room.seats), before);
  roleService.handle(peers[0], 'official:start', { mid: 33, revision: room.revision, commandId: '角色开始' });
  assert.deepEqual(room.G.players.slice(1).map(p => p.character.id), ids);
  const G = room.G;
  // 使用实际服务端提交，验证私人选择和角色状态会写入快照。
  G.phase = 'play'; G.turn = 0;
  roleAct(peers[3], room.revision, G.gid, '个人雷达', { a: 'character', val: 3 });
  assert(G.players[3].character.used, JSON.stringify(last(peers[3], 'official:error'))); assert.equal(G.turn, 0);
  const fw = G.wires.find(w => w.o === 4 && !w.cut);
  roleAct(peers[4], room.revision, G.gid, '个人交换', { a: 'character', w: fw.id, p: 1 });
  assert.equal(G.pending.type, 'walkie'); assert(G.players[4].character.used);
  const restored = officialService({ clients: new Set() }, roleDir).load('bb-roles');
  assert.deepEqual(restored.G.pending, G.pending); assert(restored.G.players[4].character.used);
  const credential = last(peers[1], 'official:welcome').credential;
  const rejoin = rolePeer(); roleService.handle(rejoin, 'hello', { credential, name: '角色重连' });
  assert.equal(last(rejoin, 'official:view').view.pending.id, G.pending.id);
  const returned = G.wires.find(w => w.o === 1 && !w.cut);
  const rev = room.revision;
  roleAct(rejoin, rev, G.gid, '交换回应', { a: 'walkie', id: G.pending.id, w: returned.id });
  assert.equal(G.pending, null); assert.equal(room.revision, rev + 1);
  roleAct(rejoin, rev, G.gid, '交换回应', { a: 'walkie', id: 1, w: returned.id });
  assert.equal(room.revision, rev + 1);
  roleService.handle(peers[2], 'official:character', { character: 'double-detector' });
  assert.equal(room.seats[2].character, 'xy-ray');
  console.log('✓ 联机角色选择防冒用、有限卡牌、使用状态、交换重连和快照恢复');
} finally { fs.rmSync(roleDir, { recursive: true, force: true }); }

const constraintDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bomb-busters-constraint-'));
const constraintWss = { clients: new Set() }, constraintService = officialService(constraintWss, constraintDir);
function constraintPeer() { const ws = { room: 'bb-constraint', readyState: 1, messages: [], send(raw) { this.messages.push(JSON.parse(raw)); } }; constraintWss.clients.add(ws); return ws; }
try {
  const host = constraintPeer(), guest = constraintPeer();
  constraintService.handle(host, 'official:hello', { ruleset: 'campaign', mid: 31, name: '队长' });
  constraintService.handle(guest, 'hello', { name: '队友' });
  constraintService.handle(host, 'official:start', { mid: 31, revision: 0, commandId: '限制开局' });
  const room = constraintService.load(host.room), G = room.G;
  assert.equal(G.phase, 'constraints');
  const V = last(host, 'official:view').view;
  assert(V.players[0].stands.flat().every(w => w.v !== null));
  assert(V.players[1].stands.flat().every(w => w.v === null));
  const decision = V.official.constraints.decisionId;
  function submit(ws, id, card, commandId) { constraintService.handle(ws, 'official:act', { revision: room.revision, gid: G.gid, commandId, action: { a: 'constraint-select', id, card } }); }
  submit(guest, decision, 'A', '冒用顺序'); assert.equal(G.phase, 'constraints'); assert(!G.officialState.constraints.personal[0]);
  submit(host, decision, 'A', '队长选限制'); assert.equal(G.turn, 1);
  const credential = last(guest, 'official:welcome').credential;
  const saved = officialService({ clients: new Set() }, constraintDir).load(host.room);
  assert.equal(saved.G.phase, 'constraints'); assert.equal(saved.G.turn, 1);
  assert.equal(saved.G.officialState.constraints.personal[0].id, 'A');
  assert.equal(saved.G.officialState.constraints.decisionId, G.officialState.constraints.decisionId);
  const joined = constraintPeer(); constraintService.handle(joined, 'hello', { credential, name: '重连队友' });
  submit(joined, decision, 'C', '旧选择编号'); assert.equal(G.phase, 'constraints');
  submit(joined, G.officialState.constraints.decisionId, 'A', '重复卡牌'); assert.equal(G.phase, 'constraints');
  submit(joined, G.officialState.constraints.decisionId, 'C', '队友选限制'); assert.equal(G.phase, 'setup');
  assert.equal(G.officialState.constraints.personal[1].id, 'C');
  console.log('✓ 联机限制选择顺序、私有手牌、旧编号拒绝、选择中断线和服务端重启恢复');
} finally { fs.rmSync(constraintDir, { recursive: true, force: true }); }

const penaltyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bomb-busters-communication-'));
try {
  const wss = { clients: new Set() }, srv = officialService(wss, penaltyDir);
  const make = () => { const ws = { room: 'bb-communication-25', readyState: 1, messages: [], send(raw) { this.messages.push(JSON.parse(raw)); } }; wss.clients.add(ws); return ws; };
  const host = make(), guest = make(), spectator = make();
  srv.handle(host, 'official:hello', { create: true, ruleset: 'campaign', mid: 25, name: '房主' });
  srv.handle(guest, 'hello', { name: '队友' });
  const hostCredential = last(host, 'official:welcome').credential, guestCredential = last(guest, 'official:welcome').credential;
  srv.handle(spectator, 'hello', { spectator: true, name: '观战' });
  srv.handle(host, 'official:start', { revision: 0, mid: 25, commandId: '开局' });
  const room = srv.load(host.room), G = room.G;
  for (const pi of [0, 1]) {
    const ws = pi === 0 ? host : guest, w = G.wires.find(w => w.o === pi && Number.isInteger(w.v));
    srv.handle(ws, 'official:act', { revision: room.revision, gid: G.gid, commandId: '初始'+pi, action: { a: 'info', w: w.id } });
  }
  assert.equal(G.phase, 'play');
  const submit = (s, ws, id, action) => { const r = s.load(ws.room); s.handle(ws, 'official:act', { revision: r.revision, gid: r.G.gid, commandId: id, action }); };
  const revision = room.revision;
  submit(srv, spectator, '观战不能处罚', { a: 'communication-penalty' }); assert.equal(room.revision, revision);
  submit(srv, guest, '实际违规报告', { a: 'communication-penalty' }); assert.equal(G.det, 1);
  const saved = JSON.parse(fs.readFileSync(path.join(penaltyDir, room.name + '.json')));
  assert(saved.seen.some(key => key.endsWith(':实际违规报告')));
  assert(saved.seen.some(key => key.endsWith(':start:开局')));
  const resumed = officialService(wss, penaltyDir);
  resumed.handle(guest, 'hello', { credential: guestCredential, name: '重连队友' });
  const R = resumed.load(host.room), currentRevision = R.revision;
  submit(resumed, guest, '实际违规报告', { a: 'communication-penalty' });
  assert.equal(R.G.det, 1); assert.equal(R.revision, currentRevision);
  // 恢复后重复命令即使附上最新状态也不能再次扣格。
  const restoredView = last(guest, 'official:view').view;
  assert.equal(restoredView.official.communicationPenalties, 1);
  assert(restoredView.players[0].stands.flat().every(w => w.cut || w.v === null));
  resumed.handle(host, 'hello', { credential: hostCredential, name: '重连房主' });
  const pause = { revision: R.revision, gid: R.G.gid, commandId: '暂停一次', paused: true };
  resumed.handle(host, 'official:pause', pause);
  const resume2 = officialService(wss, penaltyDir);
  resume2.handle(host, 'hello', { credential: hostCredential, name: '房主' });
  const R2 = resume2.load(host.room);
  resume2.handle(host, 'official:pause', { ...pause, revision: R2.revision, paused: false });
  assert(R2.G.paused);
  // 正常的新请求可以继续；旧请求不会被当作新请求重用。
  resume2.handle(host, 'official:pause', { revision: R2.revision, gid: R2.G.gid, commandId: '继续', paused: false });
  assert(!R2.G.paused);
  resume2.handle(host, 'official:back', { revision: R2.revision, gid: R2.G.gid, commandId: '退出一次' });
  assert.equal(R2.G, null);
  const resume3 = officialService(wss, penaltyDir); resume3.handle(host, 'hello', { credential: hostCredential, name: '房主' });
  const R3 = resume3.load(host.room), lobbyRevision = R3.revision;
  resume3.handle(host, 'official:start', { revision: R3.revision, mid: 25, commandId: '开局' });
  assert.equal(R3.G, null); assert.equal(R3.revision, lobbyRevision);
  resume3.handle(host, 'official:start', { revision: R3.revision, mid: 25, commandId: '新开局' });
  const nextGid = R3.G.gid;
  resume3.handle(host, 'official:back', { revision: R3.revision, gid: nextGid, commandId: '退出一次' });
  assert.equal(R3.G.gid, nextGid);
  console.log('✓ 第25关语音违规报告、观战只读、保存重启后动作／暂停／开局／退出命令不重复执行');
} finally { fs.rmSync(penaltyDir, { recursive: true, force: true }); }

{
  const fs=require('fs'),os=require('os'),path=require('path'),BB=require('../js/engine'),Bot=require('../js/bot'),Service=require('../server/official');
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'bb-role-rotate-')),wss={clients:new Set()},svc=Service(wss,dir);
  function peer(room){const ws={room,readyState:1,messages:[],send(raw){this.messages.push(JSON.parse(raw));}};wss.clients.add(ws);return ws;}
  const last=(ws,topic)=>ws.messages.filter(m=>m.topic===topic).at(-1)?.data;
  try {
    const peers=Array.from({length:3},()=>peer('bb-rotatechar'));
    peers.forEach((ws,pi)=>svc.handle(ws,pi?'hello':'official:hello',{ruleset:'campaign',mid:33,name:'角色'+pi}));const room=svc.load('bb-rotatechar');
    svc.handle(peers[1],'official:character',{character:'triple-detector'});assert.equal(room.seats[1].character,'triple-detector');
    svc.handle(peers[0],'official:start',{mid:33,revision:room.revision,commandId:'第一局'});assert.equal(room.G.players[1].character.id,'triple-detector');
    svc.handle(peers[0],'official:back',{gid:room.G.gid,revision:room.revision,commandId:'退出'});assert.equal(last(peers[0],'official:lobby').seats[1].character,'double-detector');
    svc.handle(peers[2],'official:character',{character:'triple-detector'});assert.equal(room.seats[1].character,'double-detector');assert.equal(room.seats[2].character,'triple-detector');
    svc.handle(peers[0],'official:start',{mid:33,revision:room.revision,commandId:'第二局'});assert.equal(room.G.captain,1);assert.equal(room.G.players[1].character.id,'double-detector');assert.equal(room.G.players[2].character.id,'triple-detector');
    const admin=peer('bb-observerbot'),human=peer('bb-observerbot');svc.handle(admin,'official:hello',{ruleset:'campaign',mid:33,name:'房主'});svc.handle(human,'hello',{name:'玩家'});const other=svc.load('bb-observerbot');
    svc.handle(admin,'official:role',{role:'spectator'});svc.handle(admin,'official:lobby',{mid:33,seats:[{pid:other.seats[0].pid,bot:false},{pid:'newbot',bot:true,name:'机器人'}]});const bot=other.seats.find(s=>s.bot);assert(bot);
    svc.handle(admin,'official:character',{bot:bot.pid,character:'triple-detector'});assert.equal(other.seats.find(s=>s.pid===bot.pid).character,'triple-detector');
    const before=JSON.stringify(other.seats);svc.handle(human,'official:character',{bot:bot.pid,character:'general-radar'});assert.equal(JSON.stringify(other.seats),before);
    console.log('✓ 队长轮换自动使用双重角色，释放旧个人卡；观战房主可配置机器人角色，普通玩家不能冒用');
  } finally {fs.rmSync(dir,{recursive:true,force:true});}
}
