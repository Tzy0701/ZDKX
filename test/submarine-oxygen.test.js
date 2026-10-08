// 只测原卡氧气机制。测试显式模拟音频开始；不使用未核实的录音窗口触发事件。
const assert=require('assert'),BB=require('../js/engine'),M=require('../js/missions');
function rng(s){return()=>((s=(Math.imul(s,1664525)+1013904223)>>>0)/4294967296);}
function game(n=3,cap=0,seed=1){return BB.createGame(M.get('official-development',54),Array.from({length:n},(_,i)=>({pid:'p'+i,name:'潜艇测试'+i})),{captain:cap,rng:rng(seed)});}
function act(G,pi,a){assert.equal(BB.act(G,pi,a),null,JSON.stringify(a));}
function reject(G,pi,a){const before=JSON.stringify(G);assert(BB.act(G,pi,a));assert.equal(JSON.stringify(G),before);}
function setup(G){while(G.phase==='setup'){const pi=BB.setupActor(G);act(G,pi,{a:'info',w:G.wires.find(w=>w.o===pi&&BB.setupInfoAllowed(G,w)).id});}}
function conserved(G){const s=BB.submarine54(G);assert.equal(s.balances.reduce((a,b)=>a+b,0)+s.reserve+s.retired,32);assert(s.balances.every(v=>v>=0));assert(s.reserve>=0&&s.retired>=0);}
function startTest(G){assert.equal(G.phase,'audio-ready');G.officialState.submarine54.audioReady=true;G.phase='play';}
function rig(hands){const G=game(hands.length);setup(G);startTest(G);G.wires=[];G.players.forEach(p=>p.stands=p.stands.map(()=>[]));hands.forEach((hand,o)=>hand.forEach(v=>{const id=G.wires.length;G.wires.push({id,v,o,s:0,cut:false,info:null});G.players[o].stands[0].push(id);}));G.equip=[];return G;}
function finish(G){while(G.pending){const pd=G.pending,V=BB.view(G,pd.to);act(G,pd.to,{a:'resolve',id:pd.id,w:V.pending.choices.at(-1)});}}
for(const n of [2,3,4,5])for(let cap=0;cap<n;cap++)for(let seed=1;seed<=8;seed++){
 const G=game(n,cap,seed*104729),each=[0,0,9,6,3,2][n],state=BB.submarine54(G);assert.equal(G.wires.length,48);assert(G.wires.every(w=>Number.isInteger(w.v)));assert.equal(state.redReserve.length,11);assert.equal(new Set(state.redReserve).size,11);assert.deepEqual(state.redReserve.slice().sort((a,b)=>a-b),Array.from({length:11},(_,i)=>i+1.5));assert.deepEqual(state.balances,Array(n).fill(each));assert.equal(state.reserve,32-n*each);assert(G.equip.every(e=>e.n!==10));assert(!BB.characterOptions(G.mission,(cap+1)%n,cap).includes('xy-ray'));conserved(G);setup(G);assert.equal(G.phase,'audio-ready');assert.equal(G.deadline,null);assert(G.players.every((_,pi)=>G.setup[pi]===1));for(let pi=-1;pi<n;pi++){const s=BB.view(G,pi).official.submarine54;assert.equal(s.redRemaining,11);assert(!('redReserve' in s));assert.equal(s.audioReady,false);}reject(G,cap,{a:'audio-start',verified:true});reject(G,cap,{a:'solo',val:1});assert.equal(BB.setPaused(G,true),null);assert.equal(BB.setPaused(G,false),null);
}
console.log('✓ 第54关2–5人所有队长：48蓝、11红隐藏未发、个人9／6／3／2氧与32总库存、禁X/Y、正常初始；音频未核实门禁阻止开始，暂停可恢复');
for(const value of [1,4,5,8,9,12]){
 const G=rig([[value,2],[value,3],[7]]),cost=Math.ceil(value/4);act(G,0,{a:'dual',w:2,val:value});assert.equal(BB.submarine54(G).balances[0],6-cost);const saved=JSON.parse(JSON.stringify(G));finish(G);finish(saved);assert.equal(BB.submarine54(G).balances[0],6-cost);assert.deepEqual(BB.submarine54(saved),BB.submarine54(G));conserved(G);
 const complete=rig([[value,2],[value,3],[7]]);for(let i=0;i<2;i++){const id=complete.wires.length;complete.wires.push({id,v:value,o:2,s:0,cut:true,info:null});complete.players[2].stands[0].push(id);}act(complete,0,{a:'dual',w:2,val:value});finish(complete);assert.deepEqual(BB.submarine54(complete).balances,[7-cost,7,7]);assert.deepEqual(BB.submarine54(complete).completed,[value]);conserved(complete);
 const solo=rig([[value,value,value,value],[2,2],[3,3]]);act(solo,0,{a:'solo',val:value});assert.equal(BB.submarine54(solo).balances[0],0);assert.equal(BB.submarine54(solo).active[0],false);assert.equal(BB.submarine54(solo).retired,6-cost);assert.deepEqual(BB.submarine54(solo).balances,[0,7,7]);conserved(solo);
}
{
 const G=rig([[9,2],[8,3],[7]]),s=BB.submarine54(G);s.reserve+=s.balances[0]-1;s.balances[0]=1;reject(G,0,{a:'dual',w:2,val:9});reject(G,1,{a:'dual',w:0,val:8});reject(G,0,{a:'dual',w:99,val:2});reject(G,0,{a:'submarine-skip'});act(G,0,{a:'dual',w:2,val:2});finish(G);assert.equal(G.det,1);assert.equal(BB.submarine54(G).balances[0],0);conserved(G);
 const skip=rig([[9],[8],[7]]),state=BB.submarine54(skip);state.reserve+=state.balances[0];state.balances[0]=0;reject(skip,1,{a:'submarine-skip'});reject(skip,0,{a:'submarine-skip',stab:true});act(skip,0,{a:'submarine-skip'});assert.equal(skip.det,1);assert.equal(skip.turn,1);conserved(skip);
 const red=rig([[1.5],[2,2],[3,3]]);reject(red,0,{a:'submarine-skip'});act(red,0,{a:'red'});assert.equal(BB.submarine54(red).active[0],false);assert.equal(BB.submarine54(red).retired,6);assert.equal(red.det,0);conserved(red);
}
assert(!M.get('campaign',54).verified);
console.log('✓ 第54关原卡氧气边界1–12、双拆／四线单拆一次扣费／库存回收、私人回复恢复不重扣、完成值一次补氧、空手不领取、能行动拒绝省氧跳过、错误状态不变；真实音频时间轴未启用，内部事件另行验收');
function event(G,index=0){return {gid:G.gid,index,type:'leak'};}
function apply(G,index=0){assert.equal(BB.applySubmarineEvent(G,event(G,index),{serverAudio:true}),null);}
function rejectEvent(G,e,options={serverAudio:true}){const before=JSON.stringify(G);assert(BB.applySubmarineEvent(G,e,options));assert.equal(JSON.stringify(G),before);}
for(const n of [2,3,4,5]){
 const G=game(n);setup(G);rejectEvent(G,event(G));startTest(G);const before=G.wires.length,reserve=BB.submarine54(G).redReserve.slice();rejectEvent(G,event(G),{});rejectEvent(G,{...event(G),gid:'old'});rejectEvent(G,event(G,1));apply(G);const after=JSON.stringify(G);apply(G);assert.equal(JSON.stringify(G),after);assert.equal(BB.submarine54(G).redReserve.length,10);
 if(G.players[0].stands.length===2){const pd=G.pending;assert.equal(pd.type,'submarine-red');for(let pi=-1;pi<n;pi++){const V=BB.view(G,pi);assert.equal('drawn' in V.pending,pi===0);assert.equal('choices' in V.pending,pi===0);assert(!('value' in V.pending));assert(!('redReserve' in V.official.submarine54));}reject(G,1,{a:'submarine-red',id:pd.id,rack:0});reject(G,0,{a:'submarine-red',id:pd.id-1,rack:0});reject(G,0,{a:'submarine-red',id:pd.id,rack:2});rejectEvent(G,event(G,1));const saved=JSON.parse(JSON.stringify(G));act(saved,0,{a:'submarine-red',id:pd.id,rack:1});act(G,0,{a:'submarine-red',id:pd.id,rack:1});assert.equal(G.wires.length,before+1);assert.deepEqual(saved.wires,G.wires);assert.equal(G.wires.at(-1).s,1);}
 else{assert.equal(G.pending,null);assert.equal(G.wires.length,before+1);assert.equal(G.wires.at(-1).s,0);}
 assert.equal(G.wires.at(-1).v,reserve[0]);assert.equal(G.rmark.n,1);assert.deepEqual(G.rmark.cand,[]);for(let pi=-1;pi<n;pi++){const V=BB.view(G,pi),w=V.players[0].stands.flat().find(w=>w.id===before);assert.equal(w.v,pi===0?reserve[0]:null);}conserved(G);
}
{
 const G=game(3);setup(G);startTest(G);const own=G.wires.find(w=>w.o===0&&G.wires.some(t=>t.o===1&&t.v===w.v)&&Number.isInteger(w.v)),target=G.wires.find(w=>w.o===1&&w.v===own.v);act(G,0,{a:'dual',w:target.id,val:own.v});const id=G.pending.id;act(G,1,{a:'resolve',id,w:target.id});assert.equal(G.pending.step,'own');const old=JSON.parse(JSON.stringify(G.pending)),oxygen=BB.submarine54(G).balances.slice();apply(G);assert.equal(G.pending.type,'submarine-red');for(let pi=-1;pi<3;pi++){const V=BB.view(G,pi);assert.equal(V.players[1].stands.flat().find(w=>w.id===target.id).v,own.v);assert.equal(V.official.submarine54.suspendedAction.hit,target.id);assert(!('choices' in V.official.submarine54.suspendedAction));}reject(G,0,{a:'resolve',id,w:own.id});const saved=JSON.parse(JSON.stringify(G));act(saved,0,{a:'submarine-red',id:saved.pending.id,rack:0});act(G,0,{a:'submarine-red',id:G.pending.id,rack:0});assert.deepEqual(G.pending,old);assert.deepEqual(BB.submarine54(G).balances,oxygen);act(G,0,{a:'resolve',id,w:own.id});act(saved,0,{a:'resolve',id,w:own.id});assert.deepEqual(saved.wires,G.wires);assert.equal(G.det,0);assert(G.wires[own.id].cut);assert(G.wires[target.id].cut);conserved(G);
}
console.log('✓ 第54关内部红线事件：客户端／错游戏／乱序拒绝、重复不再抽，双架私人排序值／放置与恢复、单架直接插入；暂停原选线并保留已公开命中／声明，放红后恢复原决策不重扣氧；精确录音时间轴仍未开启');
{
 const fs=require('fs'),os=require('os'),path=require('path'),Service=require('../server/official'),dir=fs.mkdtempSync(path.join(os.tmpdir(),'bb54-red-authority-'));
 function peer(room){return {room,readyState:1,messages:[],send(raw){this.messages.push(JSON.parse(raw));}};}
 function last(ws,t){return ws.messages.filter(m=>m.topic===t).at(-1)?.data;}
 try{for(const n of [2,3,4,5]){
  let G=game(n);setup(G);startTest(G);G.catalog=G.mission.catalog='campaign';const name='bb-submarine-red'+n,seats=G.players.map(p=>({pid:p.pid,name:p.name,bot:false,credential:'红线凭据'+p.pid})),wss={clients:new Set()};fs.writeFileSync(path.join(dir,name+'.json'),JSON.stringify({version:1,name,host:seats[0].pid,mid:54,ruleset:'campaign',attempts:1,started:true,seats,observers:[],revision:0,seen:[],G}));let service=Service(wss,dir),room,peers,observer,credential;
  function connect(){peers=seats.map(s=>{const ws=peer(name);wss.clients.add(ws);service.handle(ws,'hello',{credential:s.credential,name:s.name});return ws;});observer=peer(name);wss.clients.add(observer);service.handle(observer,'hello',credential?{credential,name:'红线观众'}:{spectator:true,name:'红线观众'});credential=last(observer,'official:welcome').credential;room=service.load(name);G=room.G;}
  function send(pi,id,a){service.handle(peers[pi],'official:act',{gid:G.gid,revision:room.revision,commandId:id,action:a});}
  function rejectNet(pi,id,a){const before=JSON.stringify(G);send(pi,id,a);assert.equal(JSON.stringify(G),before);}
  connect();rejectNet(0,'客户端伪造红事件',{a:'audio-leak',gid:G.gid,index:0});rejectNet(0,'客户端伪造已开始',{a:'audio-start',verified:true});const priorRevision=room.revision;assert.equal(service.applyAudioEvent(name,event(G)),null);assert.equal(room.revision,priorRevision+1);const frozen=JSON.stringify(G);assert.equal(service.applyAudioEvent(name,event(G)),null);assert.equal(room.revision,priorRevision+1);assert.equal(JSON.stringify(G),frozen);service.handle(peers[0],'official:act',{gid:G.gid,revision:priorRevision,commandId:'事件前旧修订',action:{a:'submarine-skip'}});assert.equal(JSON.stringify(G),frozen);assert(last(peers[0],'official:error').msg.includes('状态已变化'));const value=G.players[0].stands.length===2?G.pending.value:G.wires.at(-1).v;service.handle(peers[0],'official:pause',{gid:G.gid,revision:room.revision,commandId:'保存内部事件',paused:true});assert(G.paused);wss.clients.forEach(ws=>ws.readyState=3);service=Service(wss,dir);connect();assert(G.paused);assert.equal(BB.submarine54(G).redReserve.length,10);
  if(G.pending?.type==='submarine-red'){const id=G.pending.id;peers.forEach((ws,pi)=>assert.equal('drawn' in last(ws,'official:view').view.pending,pi===0));service.handle(observer,'official:perspective',{pid:seats[0].pid});const pd=last(observer,'official:view').view.pending;assert(!('drawn' in pd));assert(!('choices' in pd));rejectNet(0,'暂停放红',{a:'submarine-red',id,rack:0});service.handle(peers[0],'official:pause',{gid:G.gid,revision:room.revision,commandId:'继续放红',paused:false});rejectNet(1,'冒用放红',{a:'submarine-red',id,rack:0});rejectNet(0,'旧放红',{a:'submarine-red',id:id-1,rack:0});send(0,'真实放红',{a:'submarine-red',id,rack:1});const revision=room.revision,after=JSON.stringify(G);send(0,'真实放红',{a:'submarine-red',id,rack:1});assert.equal(room.revision,revision);assert.equal(JSON.stringify(G),after);}
  assert.equal(G.wires.length,49);assert.equal(G.wires.at(-1).v,value);assert.equal(G.rmark.n,1);assert.equal(G.det,0);assert.equal(G.turn,0);assert(!('redReserve' in last(observer,'official:view').view.official.submarine54));
 }}finally{fs.rmSync(dir,{recursive:true,force:true});}
 console.log('✓ 第54关2–5人权威模拟事件：客户端事件／开始伪造拒绝、红线状态保存／重启、双架私人值与观战视角屏蔽、暂停／冒用／旧编号／重复放置防重；原录音时间轴未启用');
}
{
 const Bot=require('../js/bot'),G=game(3);setup(G);assert.equal(Bot.decide(G,0),null);startTest(G);apply(G);const a=Bot.decide(G,0);assert.equal(a.a,'submarine-red');assert(G.pending.id===a.id);const hidden=JSON.parse(JSON.stringify(G));hidden.wires.forEach(w=>{if(w.o!==0&&!w.cut)w.v=12;});assert.deepEqual(Bot.decide(hidden,0),a);act(G,0,a);assert.equal(G.pending,null);assert.equal(G.wires.length,49);conserved(G);
 const skip=rig([[9],[8],[7]]),s=BB.submarine54(skip);s.reserve+=s.balances[0];s.balances[0]=0;assert.deepEqual(Bot.decide(skip,0),{a:'submarine-skip'});act(skip,0,Bot.decide(skip,0));assert.equal(skip.det,1);conserved(skip);
}
console.log('✓ 第54关机器人不绕过音频门禁，模拟红线事件时仅按本人线架放置、不读他人隐藏值，零氧合法跳过；真实音频事件未启用');
function audio(G,index,type){return {gid:G.gid,index,type};}
for(const n of [3,4,5]){
 const G=game(n);setup(G);startTest(G);const old=BB.submarine54(G).balances.slice(),stock=BB.submarine54(G).reserve;assert.equal(BB.applySubmarineEvent(G,audio(G,0,'oxygen'),{serverAudio:true}),null);assert.equal(BB.submarine54(G).balances[0],old[0]+1);assert.equal(BB.submarine54(G).reserve,stock-1);conserved(G);const snapshot=JSON.stringify(G);assert.equal(BB.applySubmarineEvent(G,audio(G,0,'oxygen'),{serverAudio:true}),null);assert.equal(JSON.stringify(G),snapshot);rejectEvent(G,audio(G,0,'transfer'));const saved=JSON.parse(JSON.stringify(G));assert.deepEqual(BB.submarine54(saved),BB.submarine54(G));
}
{
 const two=game(2);setup(two);startTest(two);rejectEvent(two,audio(two,0,'oxygen'));assert.equal(BB.submarine54(two).events,undefined);
 const G=rig([[1,2],[1,3],[4]]);act(G,0,{a:'dual',w:2,val:1});act(G,1,{a:'resolve',id:G.pending.id,w:2});const pending=JSON.parse(JSON.stringify(G.pending)),old=BB.submarine54(G).balances.slice();assert.equal(BB.applySubmarineEvent(G,audio(G,0,'transfer'),{serverAudio:true}),null);assert.equal(G.pending.type,'submarine-transfer');for(let pi=-1;pi<3;pi++){const V=BB.view(G,pi);assert.equal('choices' in V.pending,pi===0);assert.equal(V.official.submarine54.suspendedAction.hit,2);assert.equal(V.players[1].stands[0].find(w=>w.id===2).v,1);}const id=G.pending.id;reject(G,1,{a:'submarine-transfer',id,mode:'give',p:2,amount:1});reject(G,0,{a:'submarine-transfer',id:id-1,mode:'give',p:2,amount:1});reject(G,0,{a:'submarine-transfer',id,mode:'give',p:0,amount:1});reject(G,0,{a:'submarine-transfer',id,mode:'give',p:1,amount:old[0]+1});reject(G,0,{a:'submarine-transfer',id,mode:'give',p:1,amount:1.5});reject(G,0,{a:'resolve',id:pending.id,w:0});rejectEvent(G,audio(G,1,'transfer'));
 const saved=JSON.parse(JSON.stringify(G));act(G,0,{a:'submarine-transfer',id,mode:'give',p:2,amount:2});act(saved,0,{a:'submarine-transfer',id,mode:'give',p:2,amount:2});assert.deepEqual(G.pending,pending);assert.equal(BB.submarine54(G).balances[0],old[0]-2);assert.equal(BB.submarine54(G).balances[2],old[2]+2);assert.deepEqual(BB.submarine54(saved),BB.submarine54(G));conserved(G);act(G,0,{a:'resolve',id:pending.id,w:0});assert.equal(G.det,0);conserved(G);
 assert.equal(BB.applySubmarineEvent(G,audio(G,1,'transfer'),{serverAudio:true}),null);const who=G.pending.to,other=(who+1)%3,balances=BB.submarine54(G).balances.slice();act(G,who,{a:'submarine-transfer',id:G.pending.id,mode:'take',p:other,amount:1});assert.equal(BB.submarine54(G).balances[who],balances[who]+1);assert.equal(BB.submarine54(G).balances[other],balances[other]-1);conserved(G);
 assert.equal(BB.applySubmarineEvent(G,audio(G,2,'transfer'),{serverAudio:true}),null);const before=BB.submarine54(G).balances.slice();act(G,G.pending.to,{a:'submarine-transfer',id:G.pending.id,mode:'skip'});assert.deepEqual(BB.submarine54(G).balances,before);conserved(G);
}
console.log('✓ 第54关内部补氧／传氧：非双人从库存补1，不重复／不复制；双人完整免氧补充未核实故阻止部分事件。可给／取／放弃，数量／身份／过期拒绝，32守恒／恢复原切线且不重扣，真实计时仍关闭');
{
 const Bot=require('../js/bot'),G=rig([[9],[2,2],[3,3]]),s=BB.submarine54(G);s.reserve+=s.balances[0]-1;s.balances[0]=1;assert.equal(BB.applySubmarineEvent(G,audio(G,0,'transfer'),{serverAudio:true}),null);const a=Bot.decide(G,0);assert.deepEqual(a,{a:'submarine-transfer',id:G.pending.id,mode:'take',p:1,amount:2});const changed=JSON.parse(JSON.stringify(G));changed.wires.forEach(w=>{if(w.o!==0&&!w.cut)w.v=12;});assert.deepEqual(Bot.decide(changed,0),a);act(G,0,a);assert.equal(BB.submarine54(G).balances[0],3);conserved(G);
}
console.log('✓ 第54关机器人传氧仅依据本人费用与公开余额，缺氧领取可行动所需数量，未知队友线值不改决定；不创建氧气');
{
 const fs=require('fs'),os=require('os'),path=require('path'),Service=require('../server/official'),dir=fs.mkdtempSync(path.join(os.tmpdir(),'bb54-transfer-service-'));
 function peer(room){return {room,readyState:1,messages:[],send(raw){this.messages.push(JSON.parse(raw));}};}
 function last(ws,t){return ws.messages.filter(m=>m.topic===t).at(-1)?.data;}
 try{for(const n of [2,3,4,5]){
  let G=game(n);setup(G);startTest(G);G.catalog=G.mission.catalog='campaign';const name='bb-oxygen-event'+n,seats=G.players.map(p=>({pid:p.pid,name:p.name,bot:false,credential:'传氧凭据'+p.pid})),wss={clients:new Set()};fs.writeFileSync(path.join(dir,name+'.json'),JSON.stringify({version:1,name,host:seats[0].pid,mid:54,ruleset:'campaign',attempts:1,started:true,seats,observers:[],revision:0,seen:[],G}));let service=Service(wss,dir),room,peers,observer,cred;
  function connect(){peers=seats.map(s=>{const ws=peer(name);wss.clients.add(ws);service.handle(ws,'hello',{credential:s.credential,name:s.name});return ws;});observer=peer(name);wss.clients.add(observer);service.handle(observer,'hello',cred?{credential:cred,name:'传氧观众'}:{spectator:true,name:'传氧观众'});cred=last(observer,'official:welcome').credential;room=service.load(name);G=room.G;}
  function send(pi,id,a){service.handle(peers[pi],'official:act',{gid:G.gid,revision:room.revision,commandId:id,action:a});}
  connect();let index=0;if(n===2){const before=JSON.stringify(G),revision=room.revision;assert(service.applyAudioEvent(name,audio(G,0,'oxygen')));assert.equal(JSON.stringify(G),before);assert.equal(room.revision,revision);}else{const old=BB.submarine54(G).balances[0],revision=room.revision;assert.equal(service.applyAudioEvent(name,audio(G,0,'oxygen')),null);assert.equal(BB.submarine54(G).balances[0],old+1);assert.equal(room.revision,revision+1);assert.equal(service.applyAudioEvent(name,audio(G,0,'oxygen')),null);assert.equal(room.revision,revision+1);index=1;}
  assert.equal(service.applyAudioEvent(name,audio(G,index,'transfer')),null);assert.equal(G.pending.type,'submarine-transfer');const id=G.pending.id,balances=BB.submarine54(G).balances.slice(),reserve=BB.submarine54(G).reserve;
  service.handle(observer,'official:perspective',{pid:seats[0].pid});assert(!('choices' in last(observer,'official:view').view.pending));peers.forEach((ws,pi)=>assert.equal('choices' in last(ws,'official:view').view.pending,pi===0));service.handle(peers[0],'official:pause',{gid:G.gid,revision:room.revision,commandId:'暂停传氧',paused:true});const frozen=JSON.stringify(G);send(0,'暂停传氧回复',{a:'submarine-transfer',id,mode:'give',p:1,amount:1});assert.equal(JSON.stringify(G),frozen);wss.clients.forEach(ws=>ws.readyState=3);service=Service(wss,dir);connect();assert(G.paused);assert.equal(G.pending.id,id);assert.deepEqual(BB.submarine54(G).balances,balances);service.handle(peers[0],'official:pause',{gid:G.gid,revision:room.revision,commandId:'恢复传氧',paused:false});
  const before=JSON.stringify(G);send(1,'冒用传氧',{a:'submarine-transfer',id,mode:'give',p:0,amount:1});assert.equal(JSON.stringify(G),before);send(0,'旧传氧',{a:'submarine-transfer',id:id-1,mode:'give',p:1,amount:1});assert.equal(JSON.stringify(G),before);send(0,'过量传氧',{a:'submarine-transfer',id,mode:'give',p:1,amount:balances[0]+1});assert.equal(JSON.stringify(G),before);send(0,'真实传氧',{a:'submarine-transfer',id,mode:'give',p:1,amount:1});const revision=room.revision,done=JSON.stringify(G);send(0,'真实传氧',{a:'submarine-transfer',id,mode:'give',p:1,amount:1});assert.equal(room.revision,revision);assert.equal(JSON.stringify(G),done);assert.equal(BB.submarine54(G).balances[0],balances[0]-1);assert.equal(BB.submarine54(G).balances[1],balances[1]+1);assert.equal(BB.submarine54(G).reserve,reserve);assert.equal(G.turn,0);conserved(G);
 }}finally{fs.rmSync(dir,{recursive:true,force:true});}
console.log('✓ 第54关2–5人内部服务补氧／传氧：真实状态修订／重复不加氧，双人不部分补氧；私人菜单／观战屏蔽、暂停重启／凭据重连、身份／旧编号／过量／重复回复防重，32守恒且不推进回合；时间轴未启用');

// 连续回合仅为录音草稿的内部组件，不把转录窗口当正式调度时间。
{
 const G=rig([[1,2,9],[1,2,8],[7]]),state=BB.submarine54(G),before=state.balances.slice(),turn=G.turnNo;
 act(G,0,{a:'dual',w:3,val:1});act(G,1,{a:'resolve',id:G.pending.id,w:3});const decision=JSON.stringify(G.pending);
 assert.equal(BB.applySubmarineEvent(G,{gid:G.gid,index:0,type:'panic'},{serverAudio:true}),null);
 assert.equal(JSON.stringify(G.pending),decision);assert.deepEqual(BB.view(G,-1).official.submarine54.repeatTurn,{owner:0});
 const frozen=JSON.stringify(G);assert.equal(BB.applySubmarineEvent(G,{gid:G.gid,index:0,type:'panic'},{serverAudio:true}),null);assert.equal(JSON.stringify(G),frozen);
 rejectEvent(G,{gid:G.gid,index:1,type:'panic'});reject(G,0,{a:'equip',n:11,p:1});
 const saved=JSON.parse(JSON.stringify(G));finish(G);finish(saved);assert.equal(G.turn,0);assert.equal(G.turnNo,turn+1);assert.equal(BB.submarine54(G).repeatTurn,null);assert.equal(BB.submarine54(G).balances[0],before[0]-1);assert.deepEqual(G,saved);
 act(G,0,{a:'dual',w:4,val:2});finish(G);assert.equal(G.turn,1);assert.equal(G.turnNo,turn+2);assert.equal(BB.submarine54(G).balances[0],before[0]-2);conserved(G);
 const miss=rig([[1,9],[2,8],[7]]);assert.equal(BB.applySubmarineEvent(miss,{gid:miss.gid,index:0,type:'panic'},{serverAudio:true}),null);act(miss,0,{a:'dual',w:2,val:1});finish(miss);assert.equal(miss.det,1);assert.equal(miss.turn,0);assert.equal(BB.submarine54(miss).balances[0],5);assert.equal(BB.submarine54(miss).repeatTurn,null);conserved(miss);
 const empty=rig([[1,1,1,1],[2,2],[3,3]]);assert.equal(BB.applySubmarineEvent(empty,{gid:empty.gid,index:0,type:'panic'},{serverAudio:true}),null);act(empty,0,{a:'solo',val:1});assert.equal(empty.turn,1);assert.equal(BB.submarine54(empty).repeatTurn,null);assert.equal(BB.submarine54(empty).active[0],false);conserved(empty);
 const skip=rig([[9],[8],[7]]),s=BB.submarine54(skip);s.reserve+=s.balances[0];s.balances[0]=0;assert.equal(BB.applySubmarineEvent(skip,{gid:skip.gid,index:0,type:'panic'},{serverAudio:true}),null);act(skip,0,{a:'submarine-skip'});assert.equal(skip.turn,0);assert.equal(skip.det,1);act(skip,0,{a:'submarine-skip'});assert.equal(skip.turn,1);assert.equal(skip.det,2);conserved(skip);
 const fatal=rig([[9],[8],[7]]),f=BB.submarine54(fatal);f.reserve+=f.balances[0];f.balances[0]=0;fatal.det=2;assert.equal(BB.applySubmarineEvent(fatal,{gid:fatal.gid,index:0,type:'panic'},{serverAudio:true}),null);act(fatal,0,{a:'submarine-skip'});assert.equal(fatal.phase,'lost');assert.equal(BB.view(fatal,-1).official.submarine54.repeatTurn,null);
}
console.log('✓ 第54关内部连续回合：原私人决定不变、重复事件不叠加、保存恢复／成功／失败后只多一正常付费回合、缺氧跳过也结算、空手不再行动、爆炸不复活；咖啡杯组合与实际录音信号仍待核实');
{
 const fs=require('fs'),os=require('os'),path=require('path'),Service=require('../server/official'),dir=fs.mkdtempSync(path.join(os.tmpdir(),'bb54-panic-authority-'));
 function peer(room){return {room,readyState:1,messages:[],send(raw){this.messages.push(JSON.parse(raw));}};}
 function last(ws,t){return ws.messages.filter(m=>m.topic===t).at(-1)?.data;}
 try{for(const n of [2,3,4,5]){
  let G=game(n,0,n+13);setup(G);startTest(G);const own=G.wires.find(w=>w.o===0&&w.v<=4&&G.wires.some(t=>t.o===1&&t.v===w.v)),target=G.wires.find(w=>w.o===1&&w.v===own.v);
  act(G,0,{a:'dual',w:target.id,val:own.v});act(G,1,{a:'resolve',id:G.pending.id,w:target.id});const id=G.pending.id,oxygen=BB.submarine54(G).balances[0],turnNo=G.turnNo;
  G.catalog=G.mission.catalog='campaign';const name='bb-submarine-panic'+n,seats=G.players.map(p=>({pid:p.pid,name:p.name,bot:false,credential:'连续凭据'+p.pid})),wss={clients:new Set()};fs.writeFileSync(path.join(dir,name+'.json'),JSON.stringify({version:1,name,host:seats[0].pid,mid:54,ruleset:'campaign',attempts:1,started:true,seats,observers:[],revision:0,seen:[],G}));let service=Service(wss,dir),room,peers,observer;
  function connect(){peers=seats.map(s=>{const ws=peer(name);wss.clients.add(ws);service.handle(ws,'hello',{credential:s.credential,name:s.name});return ws;});observer=peer(name);wss.clients.add(observer);service.handle(observer,'hello',{spectator:true,name:'连续观众'});room=service.load(name);G=room.G;}
  function send(pi,commandId,action){service.handle(peers[pi],'official:act',{gid:G.gid,revision:room.revision,commandId,action});}
  connect();assert.equal(service.applyAudioEvent(name,{gid:G.gid,index:0,type:'panic'}),null);const rev=room.revision;assert.equal(rev,1);assert.equal(service.applyAudioEvent(name,{gid:G.gid,index:0,type:'panic'}),null);assert.equal(room.revision,rev);assert.equal(G.pending.id,id);assert.deepEqual(last(observer,'official:view').view.official.submarine54.repeatTurn,{owner:0});assert(!('choices' in last(observer,'official:view').view.pending));
  service.handle(peers[0],'official:pause',{gid:G.gid,revision:room.revision,commandId:'暂停连续'+n,paused:true});const frozen=JSON.stringify(G);send(0,'暂停回复',{a:'resolve',id,w:own.id});assert.equal(JSON.stringify(G),frozen);wss.clients.forEach(ws=>ws.readyState=3);service=Service(wss,dir);connect();assert(G.paused);assert.equal(BB.submarine54(G).repeatTurn.owner,0);assert.equal(G.pending.id,id);
  service.handle(peers[0],'official:pause',{gid:G.gid,revision:room.revision,commandId:'继续连续'+n,paused:false});const before=JSON.stringify(G);send(1,'冒用连续',{a:'resolve',id,w:own.id});assert.equal(JSON.stringify(G),before);send(0,'旧连续编号',{a:'resolve',id:id-1,w:own.id});assert.equal(JSON.stringify(G),before);
  send(0,'完成连续原剪',{a:'resolve',id,w:own.id});assert.equal(G.turn,0);assert.equal(G.turnNo,turnNo+1);assert.equal(BB.submarine54(G).repeatTurn,null);assert.equal(BB.submarine54(G).balances[0],oxygen);const done=JSON.stringify(G),revision=room.revision;send(0,'完成连续原剪',{a:'resolve',id,w:own.id});assert.equal(room.revision,revision);assert.equal(JSON.stringify(G),done);assert(G.wires[own.id].cut&&G.wires[target.id].cut);conserved(G);wss.clients.forEach(ws=>ws.readyState=3);
 }}finally{fs.rmSync(dir,{recursive:true,force:true});}
}
console.log('✓ 第54关2–5人内部连续事件权威服务：修订仅一次、双方私有选线原编号保留、暂停重启／凭据重连、冒用／旧编号／重复回复拒绝；原剪完成同人接班且不重复扣氧、观战只见公共连续状态');
{
 const Bot=require('../js/bot'),results={won:0,lost:0};let actions=0;
 for(const n of [2,3,4,5])for(let seed=1;seed<=4;seed++){
  const G=game(n,0,seed*104729+n);setup(G);startTest(G);assert.equal(BB.applySubmarineEvent(G,{gid:G.gid,index:0,type:'panic'},{serverAudio:true}),null);
  const random=rng(seed*7919+n);let count=0;
  while(G.phase==='play'&&count++<300){const pi=G.pending?G.pending.to:G.turn,a=Bot.decide(G,pi,random);assert(a,'连续事件后机器人必须能完成当前决定／行动');assert.equal(BB.act(G,pi,a),null,JSON.stringify(a));conserved(G);actions++;}
  assert(['won','lost'].includes(G.phase),'连续事件不得造成循环或停住');results[G.phase]++;
 }
 console.log('✓ 第54关2–5人16局机器人模拟内部连续事件：'+JSON.stringify(results)+'，'+actions+'动作，非法／停住／超限0；显式模拟开始，不认证录音计时');
}
}
