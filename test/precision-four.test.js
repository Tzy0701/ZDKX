const assert=require('assert'),BB=require('../js/engine'),M=require('../js/missions'),Bot=require('../js/bot');
function rng(seed){return()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);}
function game(n=3,cap=0,seed=1){return BB.createGame(M.get('official-development',23),Array.from({length:n},(_,i)=>({pid:'p'+i,name:'精准玩家'+i})),{captain:cap,rng:rng(seed)});}
function act(G,pi,a){assert.equal(BB.act(G,pi,a),null,JSON.stringify(a));}
function reject(G,pi,a){const before=JSON.stringify(G);assert(BB.act(G,pi,a));assert.equal(JSON.stringify(G),before);}
function setup(G){while(G.phase==='setup'){const pi=BB.setupActor(G);act(G,pi,{a:'info',w:G.wires.find(w=>w.o===pi&&BB.setupInfoAllowed(G,w)).id});}}
for(let n=2;n<=5;n++)for(let cap=0;cap<n;cap++){
 const G=game(n,cap);assert.equal(G.wires.length,n===2?50:49);assert.equal(G.rmark.n,n===2?2:1);assert.equal(G.rmark.cand.length,3);assert.equal(G.ymark.n,0);assert.equal(G.equip.length,7);assert.equal(G.officialState.precision.value,null);
 for(let pi=-1;pi<n;pi++){const V=BB.view(G,pi);assert.equal(V.official.precision.value,null);assert(!('nextValue' in V.official.precision));assert(V.equip.every(e=>e.hidden&&!('n'in e)&&!('id'in e)));}
 setup(G);const value=G.officialState.precision.value;assert(Number.isInteger(value));assert(!BB.seqAllowed(G,value));assert(!BB.seqAllowed(BB.view(G,cap),value));assert(BB.seqAllowed(G,value===1?2:1));
 const own=G.wires.find(w=>w.o===cap&&w.v===value),target=G.wires.find(w=>w.o!==cap&&w.v===value);if(own&&target)reject(G,cap,{a:'dual',w:target.id,val:value});
 reject(G,cap,{a:'equip',n:G.equip[0].n});const ids=G.wires.filter(w=>w.v===value).map(w=>w.id);reject(G,cap,{a:'precision-cut',ws:ids,stab:true});reject(G,cap,{a:'precision-cut',ws:[ids[0],ids[0],ids[1],ids[2]]});
 act(G,cap,{a:'precision-cut',ws:ids});while(G.pending){const pd=G.pending;for(let pi=-1;pi<n;pi++){const p=BB.view(G,pi).pending;assert.equal('ownAnswers'in p,pi===pd.to);}reject(G,(pd.to+1)%n,{a:'precision-reply',id:pd.id});const clone=JSON.parse(JSON.stringify(G));assert.equal(clone.pending.id,pd.id);act(G,pd.to,{a:'precision-reply',id:pd.id});}
 assert(G.officialState.precision.complete);assert(ids.every(id=>G.wires[id].cut));assert(G.equip.every(e=>!e.hidden&&BB.equipUnlocked(G,e.n)));assert(BB.seqAllowed(G,value));assert.equal(G.officialState.precision.discarded,0);
}
console.log('✓ 第23关来源设置、初始后公开数字、背面身份隐藏、禁止普通拆目标值、四线公开宣告与私人回应、一次剪四根及直接解锁通过');
{
 const G=game();setup(G);const value=G.officialState.precision.value,ids=G.wires.filter(w=>w.v===value).map(w=>w.id),wrong=G.wires.find(w=>w.v!==value);ids[0]=wrong.id;act(G,G.turn,{a:'precision-cut',ws:ids});while(G.pending){const pd=G.pending;act(G,pd.to,{a:'precision-reply',id:pd.id});}assert.equal(G.phase,'lost');assert.equal(G.det,0);assert(!G.officialState.precision.complete);assert(G.equip.every(e=>e.hidden));assert(ids.every(id=>!G.wires[id].cut));
}
let actions=0;
for(let n=2;n<=5;n++)for(let seed=1;seed<=25;seed++){
 const G=game(n,seed%n,seed*104729);setup(G);const ids=G.wires.filter(w=>w.v===G.officialState.precision.value).map(w=>w.id);act(G,G.turn,{a:'precision-cut',ws:ids});while(G.pending)act(G,G.pending.to,{a:'precision-reply',id:G.pending.id});
 for(let k=0;k<400&&G.phase==='play';k++){
  const pi=G.pending?G.pending.to:G.turn;let a;if(G.pending){const pd=G.pending;a={a:'resolve',id:pd.id,w:pd.step==='own'?BB.view(G,pi).pending.choices.at(-1):pd.ids.find(id=>pd.vals.includes(G.wires[id].v))};}else{const own=G.wires.filter(w=>w.o===pi&&!w.cut);if(own.every(w=>BB.kindOf(w)==='r'))a={a:'red'};else{const value=own.find(w=>BB.kindOf(w)==='b').v,target=G.wires.find(w=>w.o!==pi&&!w.cut&&w.v===value);a=BB.soloOk(G,pi,value)?{a:'solo',val:value}:{a:'dual',w:target.id,val:value};}}act(G,pi,a);actions++;
 }assert.equal(G.phase,'won');
}
console.log('✓ 第23关错误立即爆炸不剪线；100局来源配置参考求解通关，共'+actions+'个后续合法动作');
assert(M.get('campaign',23).verified);assert(!M.get('custom',23).officialModule);
for(let n=2;n<=5;n++)for(let cap=0;cap<n;cap++){
 const G=game(n,cap,n*104729);setup(G);for(let turns=0;turns<n;turns++){
  const pi=G.turn,value=G.wires.find(w=>w.o===pi&&!w.cut&&Number.isInteger(w.v)&&BB.seqAllowed(G,w.v)).v,target=G.wires.find(w=>w.o!==pi&&!w.cut&&w.v===value);
  act(G,pi,BB.soloOk(G,pi,value)?{a:'solo',val:value}:{a:'dual',w:target.id,val:value});while(G.pending){const pd=G.pending;act(G,pd.to,{a:'resolve',id:pd.id,w:pd.step==='own'?BB.view(G,pd.to).pending.choices.at(-1):pd.ids.find(id=>G.wires[id].v===value)});}
  assert.equal(G.equip.length,turns===n-1?6:7);
 }
 assert.equal(G.officialState.precision.rounds,1);assert.equal(G.officialState.precision.discarded,1);assert.equal(G.turn,cap);
 const ids=G.wires.filter(w=>w.v===G.officialState.precision.value).map(w=>w.id);act(G,G.turn,{a:'precision-cut',ws:ids});while(G.pending){const pd=G.pending;reject(G,pd.to,{a:'precision-reply',id:pd.id-1});act(G,pd.to,{a:'precision-reply',id:pd.id});}assert.equal(G.equip.length,6);assert(G.equip.every(e=>BB.equipUnlocked(G,e.n)));
}
console.log('✓ 第23关2–5人全部队长：每整轮仅弃一张，成功后保留六张直接解锁，旧回应拒绝且不改变状态');
for(let n=2;n<=5;n++)for(let seed=1;seed<=4;seed++){
 const G=game(n,0,seed*104729);for(let k=0;k<500&&!['won','lost'].includes(G.phase);k++){const pi=G.pending?G.pending.to:G.phase==='setup'?BB.setupActor(G):G.turn;const a=Bot.decide(G,pi);assert(a);act(G,pi,a);}assert(['won','lost'].includes(G.phase));
}
console.log('✓ 第23关16局私人视角机器人合法终局，没有缺失动作或重复拒绝');
{
 const fs=require('fs'),os=require('os'),path=require('path'),Service=require('../server/official'),dir=fs.mkdtempSync(path.join(os.tmpdir(),'bb23-authority-')),wss={clients:new Set()};
 const last=(ws,topic)=>ws.messages.filter(m=>m.topic===topic).at(-1)?.data;
 function peer(room){const ws={room,readyState:1,messages:[],send(raw){this.messages.push(JSON.parse(raw));}};wss.clients.add(ws);return ws;}
 try{for(let n=2;n<=5;n++)for(const wrong of [false,true]){
  let service=Service(wss,dir);const name='bb-precision'+n+(wrong?'x':'s'),peers=Array.from({length:n},()=>peer(name));peers.forEach((ws,pi)=>service.handle(ws,pi?'hello':'official:hello',{ruleset:'campaign',mid:23,name:'精准玩家'+pi}));let room=service.load(name);service.handle(peers[0],'official:start',{mid:23,revision:room.revision,commandId:'开始'});
  let G=game(n,0,n*104729);room.G=G;G.catalog=G.mission.catalog='campaign';G.players.forEach((p,pi)=>{p.pid=room.seats[pi].pid;p.name=room.seats[pi].name;});
  function send(pi,id,a){service.handle(peers[pi],'official:act',{gid:room.G.gid,revision:room.revision,commandId:id,pi:(pi+1)%n,action:a});}
  function pause(paused,id){service.handle(peers[0],'official:pause',{gid:room.G.gid,revision:room.revision,commandId:id,paused});assert.equal(room.G.paused,paused);}
  function restart(){const credentials=peers.map(ws=>last(ws,'official:welcome').credential);service=Service(wss,dir);room=service.load(name);G=room.G;for(let pi=0;pi<n;pi++){peers[pi]=peer(name);service.handle(peers[pi],'hello',{credential:credentials[pi],name:'精准玩家'+pi});}}
  let k=0;while(G.phase==='setup'){const pi=BB.setupActor(G);send(pi,'标记'+k++,{a:'info',w:G.wires.find(w=>w.o===pi&&BB.setupInfoAllowed(G,w)).id});}
  const value=G.officialState.precision.value,ids=G.wires.filter(w=>w.v===value).map(w=>w.id);if(wrong)ids[0]=G.wires.find(w=>w.v!==value).id;
  send(0,'四线宣告',{a:'precision-cut',ws:ids});const decision=G.pending.id;
  let replies=0;while(G.pending){const pi=G.pending.to;peers.forEach((ws,who)=>{const V=last(ws,'official:view').view;assert.equal('ownAnswers' in V.pending,who===pi);assert(V.equip.every(e=>e.hidden&&!('n'in e)));});
   const before=JSON.stringify(G);send((pi+1)%n,'冒充'+replies,{a:'precision-reply',id:decision});assert.equal(JSON.stringify(G),before);send(pi,'旧回应'+replies,{a:'precision-reply',id:decision-1});assert.equal(JSON.stringify(G),before);
   pause(true,'暂停'+replies);const frozen=JSON.stringify(G);send(pi,'暂停回应'+replies,{a:'precision-reply',id:decision});assert.equal(JSON.stringify(G),frozen);const savedPending=JSON.parse(JSON.stringify(G.pending));restart();assert.deepEqual(G.pending,savedPending);assert.equal(G.pending.id,decision);assert.equal(G.pending.answers.length,replies?G.declaration.answers.length:0);assert(G.paused);pause(false,'继续'+replies);
   send(pi,'正确回应'+replies,{a:'precision-reply',id:decision});const rev=room.revision;send(pi,'正确回应'+replies,{a:'precision-reply',id:decision});assert.equal(room.revision,rev);replies++;
  }
  assert.equal(G.officialState.precision.complete,!wrong);assert.equal(G.phase,wrong?'lost':'play');assert.equal(ids.filter(id=>G.wires[id].cut).length,wrong?0:4);assert.equal(G.det,0);const revision=room.revision;restart();assert.equal(room.revision,revision);assert.equal(G.officialState.precision.complete,!wrong);
 }}finally{fs.rmSync(dir,{recursive:true,force:true});}
 console.log('✓ 第23关2–5人权威服务：成功／失败每个回应阶段的暂停、重连、重启、隐藏装备、私人答案、冒充／旧回应拒绝与请求去重通过');
}
{
 // 已经清空的座位跳过；完整一轮以队长位置的循环边界判断。
 const G=game(4,1,104729),hands=[[8,8],[],[7,7],[3,3,3,3,6,6]];G.wires=[];G.players.forEach(p=>p.stands=[[]]);hands.forEach((hand,o)=>hand.forEach(v=>{const id=G.wires.length;G.wires.push({id,v,o,s:0,cut:false,info:null});G.players[o].stands[0].push(id);}));G.phase='play';G.turn=2;G.turnNo=1;G.officialState.precision.value=3;delete G.officialState.precision.nextValue;
 act(G,2,{a:'solo',val:7});assert.equal(G.turn,3);assert.equal(G.equip.length,7);act(G,3,{a:'solo',val:6});assert.equal(G.turn,0);assert.equal(G.equip.length,7);act(G,0,{a:'solo',val:8});assert.equal(G.turn,3);assert.equal(G.equip.length,6);assert.equal(G.officialState.precision.rounds,1);
 act(G,3,{a:'precision-cut',ws:G.wires.filter(w=>w.v===3).map(w=>w.id)});act(G,3,{a:'precision-reply',id:G.pending.id});assert.equal(G.phase,'won');assert.equal(G.equip.length,6);assert.equal(G.officialState.precision.discarded,1);
}
{
 let G;for(let seed=1;seed<=100;seed++){G=game(3,0,seed*104729);if([2,4,8].every(n=>G.equip.some(e=>e.n===n)))break;}assert([2,4,8].every(n=>G.equip.some(e=>e.n===n)));setup(G);const value=G.officialState.precision.value;act(G,0,{a:'precision-cut',ws:G.wires.filter(w=>w.v===value).map(w=>w.id)});while(G.pending)act(G,G.pending.to,{a:'precision-reply',id:G.pending.id});const turn=G.turn,pi=(turn+1)%3,w=G.wires.find(w=>w.o===pi&&!w.cut&&BB.kindOf(w)==='b'&&!w.info&&w.v!==4);assert(w);assert.equal(BB.cutCount(G,4),value===4?4:0);
 act(G,pi,{a:'equip',n:4,w:w.id});assert(G.wires[w.id].info);assert.equal(G.turn,turn);reject(G,pi,{a:'equip',n:4,w:w.id});
 act(G,pi,{a:'equip',n:8,val:1});assert.equal(G.turn,turn);assert(G.equip.find(e=>e.n===8).used);
 const offered=G.wires.find(w=>w.o===pi&&!w.cut),receiver=(pi+1)%3;act(G,pi,{a:'equip',n:2,w:offered.id,p:receiver});const choice=G.wires.find(w=>w.o===receiver&&!w.cut);act(G,receiver,{a:'walkie',id:G.pending.id,w:choice.id});assert.equal(G.turn,turn);assert.equal(G.wires[offered.id].o,receiver);assert.equal(G.officialState.precision.complete,true);
}
console.log('✓ 第23关空座位跨队长轮界、最后一个玩家及成功后非回合便利贴／雷达／对讲机直接可用且只用一次通过');
