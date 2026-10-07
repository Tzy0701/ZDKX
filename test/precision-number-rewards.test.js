const assert=require('assert'),BB=require('../js/engine'),M=require('../js/missions'),C=require('../js/campaign-rules'),Bot=require('../js/bot');
function rng(seed){return()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);}
function game(n=3,cap=0,seed=1){return BB.createGame(M.get('official-development',39),Array.from({length:n},(_,i)=>({pid:'p'+i,name:'奖励玩家'+i})),{captain:cap,rng:rng(seed)});}
function act(G,pi,a){assert.equal(BB.act(G,pi,a,{rng:()=>0.371}),null,JSON.stringify(a));}
function reject(G,pi,a){const before=JSON.stringify(G);assert(BB.act(G,pi,a));assert.equal(JSON.stringify(G),before);}
function setup(G){while(G.phase==='setup'){const pi=G.pending.to,pd=BB.view(G,pi).pending;act(G,pi,{a:'initial-clue',id:pd.id,w:pd.choices.length?pd.choices.at(-1):null,rack:0});}}
for(let n=2;n<=5;n++)for(let cap=0;cap<n;cap++){
 const G=game(n,cap,n*104729);assert.equal(G.wires.length,n===2?55:54);assert.equal(G.rmark.n,n===2?3:2);assert.equal(G.rmark.cand.length,3);assert.equal(G.ymark.n,4);assert.equal(G.equip.length,0);assert.equal(G.equipmentReserve.length,0);
 const state=G.officialState.precision;assert.equal(new Set([state.value,...state.deck]).size,9);assert.equal(state.deck.length,8);for(let pi=-1;pi<n;pi++){const V=BB.view(G,pi);assert.equal(V.official.precision.deckCount,8);assert(!('deck' in V.official.precision));assert(V.pending.token.value!=='Y');assert.equal('choices'in V.pending,pi===cap);}
 setup(G);assert(G.players.every((p,i)=>G.setup[i]===1));const value=state.value;assert(!BB.seqAllowed(G,value));const ids=G.wires.filter(w=>w.v===value).map(w=>w.id),expected=state.deck.map((value,i)=>({value,owner:(cap+i)%n}));act(G,cap,{a:'precision-cut',ws:ids});while(G.pending?.type==='precision-cut')act(G,G.pending.to,{a:'precision-reply',id:G.pending.id});assert(state.complete);assert.deepEqual(state.distributed,expected);assert.equal(state.deck.length,0);
 while(G.pending){const pd=BB.view(G,G.pending.to).pending;assert.equal(pd.type,'precision-clue');for(let pi=-1;pi<n;pi++)assert.equal('choices'in BB.view(G,pi).pending,pi===pd.to);reject(G,(pd.to+1)%n,{a:'precision-clue',id:pd.id,w:pd.choices[0]});reject(G,pd.to,{a:'precision-clue',id:pd.id-1,w:pd.choices[0]});const restored=JSON.parse(JSON.stringify(G));assert.deepEqual(restored.pending,G.pending);act(G,pd.to,{a:'precision-clue',id:pd.id,w:pd.choices.at(-1)});}
 for(let pi=-1;pi<n;pi++){const rewardView=BB.view(G,pi).official.precision;assert(!('distributed'in rewardView));assert.equal('assignedNumbers'in rewardView,pi>=0);if(pi>=0)assert.deepEqual(rewardView.assignedNumbers,G.officialState.precision.distributed.filter(c=>c.owner===pi).map(c=>c.value));}
 assert.equal(G.equip.length,0);assert.equal(G.officialState.precision.rewards.length,0);assert.equal(G.turn,(cap+1)%n);assert(ids.every(id=>G.wires[id].cut));
 for(let value=1;value<=12;value++){
  const used=G.wires.filter(w=>!w.cut&&w.info?.t==='v'&&w.info.v===value).reduce((n,w)=>n+(w.info.copies||1),0)+G.officialState.risky.side.filter(t=>t.value===value).length;
  assert(used<=2);assert.equal(C.availableInfoTokens(G,false).filter(t=>t.value===value).length,2-used);
 }
}
console.log('✓ 第39关2–5人全部队长来源设置、九张唯一数字、随机蓝线标记、隐藏牌堆、四线拆除、顺时针奖励、私人选择及有限供给通过');
let actions=0;
for(let n=2;n<=5;n++)for(let seed=1;seed<=25;seed++){
 const G=game(n,seed%n,seed*104729);setup(G);act(G,G.turn,{a:'precision-cut',ws:G.wires.filter(w=>w.v===G.officialState.precision.value).map(w=>w.id)});
 for(let k=0;k<500&&G.phase==='play';k++){
  const pi=G.pending?G.pending.to:G.turn;let a;
  if(G.pending?.type==='precision-cut')a={a:'precision-reply',id:G.pending.id};else if(G.pending?.type==='precision-clue')a={a:'precision-clue',id:G.pending.id,w:BB.view(G,pi).pending.choices.at(-1)};else if(G.pending){const pd=G.pending;a={a:'resolve',id:pd.id,w:pd.step==='own'?BB.view(G,pi).pending.choices.at(-1):pd.ids.find(id=>pd.vals.some(v=>BB.matches(G.wires[id],v)))};}else{
   const own=G.wires.filter(w=>w.o===pi&&!w.cut);if(own.every(w=>BB.kindOf(w)==='r'))a={a:'red'};else{const value=BB.annOf(own.find(w=>BB.kindOf(w)!=='r')),target=G.wires.find(w=>w.o!==pi&&!w.cut&&BB.matches(w,value));a=BB.soloOk(G,pi,value)?{a:'solo',val:value}:{a:'dual',w:target.id,val:value};}
  }act(G,pi,a);actions++;
 }assert.equal(G.phase,'won');
}
console.log('✓ 第39关100局来源配置全信息参考求解通关，共'+actions+'个四线宣告后合法动作');
assert(M.get('campaign',39).verified);assert(!M.get('custom',39).officialModule);
function rig(hands,deck){const G=game(hands.length);G.wires=[];G.players.forEach(p=>p.stands=[[]]);hands.forEach((hand,o)=>hand.forEach(v=>{const id=G.wires.length;G.wires.push({id,v,o,s:0,cut:false,info:null});G.players[o].stands[0].push(id);}));G.pending=null;G.phase='play';G.turn=G.captain=0;G.turnNo=1;G.officialState.precision={value:1,deck:deck.slice(),complete:false,discarded:0,rounds:0,rewards:[],distributed:[],rewardActor:null};G.officialState.risky.side=[];return G;}
function precise(G){act(G,G.turn,{a:'precision-cut',ws:G.wires.filter(w=>w.v===G.officialState.precision.value).map(w=>w.id)});while(G.pending?.type==='precision-cut')act(G,G.pending.to,{a:'precision-reply',id:G.pending.id});}
{
 const G=rig([[1,1,1,1,2],[3],[4]],[5,2]);precise(G);assert.equal(G.pending,null);assert(G.officialState.precision.complete);assert.equal(G.officialState.risky.side.length,0);assert(!G.wires.some(w=>w.info));assert.equal(G.turn,1);const publicLog=JSON.stringify(BB.view(G,-1).log);assert(!publicLog.includes('「5」'));assert(!publicLog.includes('「2」'));assert(!('assignedNumbers'in BB.view(G,-1).official.precision));
}
{
 const G=rig([[1,1,2],[1,2,2],[1,2]],[2]),twos=G.wires.filter(w=>w.o===1&&w.v===2);twos.forEach((w,i)=>w.info={t:'v',v:2,token:'info-2-'+i});precise(G);assert.equal(G.pending,null);assert.equal(G.wires.find(w=>w.o===0&&w.v===2).info,null);assert.equal(G.announcement,null);assert.equal(C.availableInfoTokens(G,false).filter(t=>t.value===2).length,0);
}
{
 const G=rig([[1,1,2],[1,2,2],[1,2]],[2]),w=G.wires.find(w=>w.o===0&&w.v===2);w.info={t:'v',v:2,token:'info-2-0'};precise(G);assert.equal(G.pending.type,'precision-clue');const id=w.id;act(G,0,{a:'precision-clue',id:G.pending.id,w:id});assert.equal(G.wires[id].info.copies,2);assert.deepEqual(G.wires[id].info.tokens,['info-2-0','info-2-1']);assert.equal(C.availableInfoTokens(G,false).filter(t=>t.value===2).length,0);
 const target=G.wires.find(w=>w.o===1&&w.v===2);act(G,1,{a:'dual',w:id,val:2});act(G,0,{a:'resolve',id:G.pending.id,w:id});act(G,1,{a:'resolve',id:G.pending.id,w:target.id});assert.equal(G.wires[id].info,null);assert.equal(C.availableInfoTokens(G,false).filter(t=>t.value===2).length,2);
}
console.log('✓ 第39关奖励缺值与无备用标记均忽略，不生成口头替代；同线两枚标记分别占用身份且剪断后释放通过');
for(let n=2;n<=5;n++)for(let cap=0;cap<n;cap++){
 const G=game(n,cap,n*104729);setup(G);for(let turns=0;turns<n;turns++){
  const pi=G.turn,value=G.wires.find(w=>w.o===pi&&!w.cut&&Number.isInteger(w.v)&&BB.seqAllowed(G,w.v)).v,target=G.wires.find(w=>w.o!==pi&&!w.cut&&w.v===value);act(G,pi,BB.soloOk(G,pi,value)?{a:'solo',val:value}:{a:'dual',w:target.id,val:value});while(G.pending){const pd=G.pending;act(G,pd.to,{a:'resolve',id:pd.id,w:pd.step==='own'?BB.view(G,pd.to).pending.choices.at(-1):pd.ids.find(id=>G.wires[id].v===value)});}assert.equal(G.officialState.precision.deck.length,turns===n-1?7:8);
 }assert.equal(G.officialState.precision.discarded,1);assert.equal(G.turn,cap);precise(G);assert.equal(G.officialState.precision.distributed.length,7);while(G.pending)act(G,G.pending.to,{a:'precision-clue',id:G.pending.id,w:BB.view(G,G.pending.to).pending.choices[0]});assert.equal(G.officialState.precision.discarded,1);
}
console.log('✓ 第39关2–5人全部队长：每整轮仅弃一数字，成功后按剩余七张分配且不继续弃牌通过');
for(let n=2;n<=5;n++)for(let seed=1;seed<=4;seed++){
 const G=game(n,0,seed*104729);for(let k=0;k<600&&!['won','lost'].includes(G.phase);k++){const pi=G.pending?G.pending.to:G.turn,a=Bot.decide(G,pi);assert(a);act(G,pi,a);}assert(['won','lost'].includes(G.phase));
}
console.log('✓ 第39关16局基础角色机器人合法终局，没有缺失动作或重复拒绝');

{
 const G=rig([[1,1,2],[1,2,2,7],[1,2]],[2]),w=G.wires.find(w=>w.o===0&&w.v===2);w.info={t:'v',v:2,token:'info-2-0'};precise(G);act(G,0,{a:'precision-clue',id:G.pending.id,w:w.id});const record=JSON.parse(JSON.stringify(G.wires[w.id].info));
 act(G,1,{a:'dual',w:w.id,val:7});act(G,0,{a:'resolve',id:G.pending.id,w:w.id});assert.deepEqual(G.wires[w.id].info,record);assert.equal(C.availableInfoTokens(G,false).filter(t=>t.value===2).length,0);assert.equal(G.det,1);
}
console.log('✓ 第39关同线两枚标记在再次安全猜错后仍保留身份与数量，不凭空回收或复制标记');
{
 const fs=require('fs'),os=require('os'),path=require('path'),Service=require('../server/official'),dir=fs.mkdtempSync(path.join(os.tmpdir(),'bb39-authority-')),wss={clients:new Set()};
 const last=(ws,topic)=>ws.messages.filter(m=>m.topic===topic).at(-1)?.data;
 function peer(room){const ws={room,readyState:1,messages:[],send(raw){this.messages.push(JSON.parse(raw));}};wss.clients.add(ws);return ws;}
 try{for(let n=2;n<=5;n++)for(const wrong of [false,true]){
  let service=Service(wss,dir);const name='bb-reward'+n+(wrong?'x':'s'),peers=Array.from({length:n},()=>peer(name));peers.forEach((ws,pi)=>service.handle(ws,pi?'hello':'official:hello',{ruleset:'campaign',mid:39,name:'奖励玩家'+pi}));let watcher=peer(name);service.handle(watcher,'hello',{spectator:true,name:'奖励观众'});let room=service.load(name);service.handle(peers[0],'official:start',{mid:39,revision:room.revision,commandId:'开始'});
  let G=game(n,0,n*104729);room.G=G;G.catalog=G.mission.catalog='campaign';G.players.forEach((p,pi)=>{p.pid=room.seats[pi].pid;p.name=room.seats[pi].name;});
  function send(pi,id,a){service.handle(peers[pi],'official:act',{gid:G.gid,revision:room.revision,commandId:id,pi:(pi+1)%n,action:a});}
  function pause(paused,id){service.handle(peers[0],'official:pause',{gid:G.gid,revision:room.revision,commandId:id,paused});assert.equal(G.paused,paused);}
  function restart(){const credentials=peers.map(ws=>last(ws,'official:welcome').credential),observerCredential=last(watcher,'official:welcome').credential;service=Service(wss,dir);room=service.load(name);G=room.G;for(let pi=0;pi<n;pi++){peers[pi]=peer(name);service.handle(peers[pi],'hello',{credential:credentials[pi],name:'奖励玩家'+pi});}watcher=peer(name);service.handle(watcher,'hello',{credential:observerCredential,name:'奖励观众'});}
  let step=0;
  function response(a){const pd=G.pending,pi=pd.to,id='回应'+step;service.handle(watcher,'official:perspective',{pid:room.seats[pi].pid});let V=last(watcher,'official:view').view;assert(V.spectator);assert(!('choices'in V.pending));assert(!('ownAnswers'in V.pending));assert(!('deck'in V.official.precision));assert(!('distributed'in V.official.precision));if(G.officialState.precision.complete)assert.deepEqual(V.official.precision.assignedNumbers,G.officialState.precision.distributed.filter(c=>c.owner===pd.to).map(c=>c.value));
   const before=JSON.stringify(G);send((pi+1)%n,'冒充'+step,a);assert.equal(JSON.stringify(G),before);send(pi,'过期'+step,{...a,id:pd.id-1});assert.equal(JSON.stringify(G),before);service.handle(watcher,'official:act',{gid:G.gid,revision:room.revision,commandId:'观战'+step,action:a});assert.equal(JSON.stringify(G),before);
   pause(true,'暂停'+step);const frozen=JSON.stringify(G);send(pi,'暂停回应'+step,a);assert.equal(JSON.stringify(G),frozen);const pending=JSON.parse(JSON.stringify(G.pending)),deck=G.officialState.precision.deck.slice();restart();assert.deepEqual(G.pending,pending);assert.deepEqual(G.officialState.precision.deck,deck);assert(G.paused);pause(false,'继续'+step);
   peers.forEach((ws,who)=>{const view=last(ws,'official:view').view;assert.equal('choices'in view.pending,['initial-clue','precision-clue'].includes(pd.type)&&who===pi);assert.equal('ownAnswers'in view.pending,pd.type==='precision-cut'&&who===pi);});
   send(pi,id,a);const rev=room.revision;send(pi,id,a);assert.equal(room.revision,rev);step++;
  }
  while(G.phase==='setup'){const pd=BB.view(G,G.pending.to).pending;response({a:'initial-clue',id:pd.id,w:pd.choices.length?pd.choices.at(-1):null,rack:0});}
  const value=G.officialState.precision.value,ids=G.wires.filter(w=>w.v===value).map(w=>w.id);if(wrong)ids[0]=G.wires.find(w=>w.v!==value).id;send(0,'四线宣告',{a:'precision-cut',ws:ids});
  while(G.pending){const pd=BB.view(G,G.pending.to).pending;response(pd.type==='precision-cut'?{a:'precision-reply',id:pd.id}:{a:'precision-clue',id:pd.id,w:pd.choices.at(-1)});}
  assert.equal(G.phase,wrong?'lost':'play');assert.equal(G.officialState.precision.complete,!wrong);assert.equal(G.det,0);assert.equal(ids.filter(id=>G.wires[id].cut).length,wrong?0:4);assert.equal(G.equip.length,0);const prior=JSON.stringify(G);restart();assert.equal(JSON.stringify(G),prior);
 }}finally{fs.rmSync(dir,{recursive:true,force:true});}
 console.log('✓ 第39关2–5人权威服务：随机开局、四线回应、逐项奖励的暂停／重连／重启、私人选项、观战只读、冒充／过期拒绝及请求去重通过');
}
{
 const roles=['double-detector','triple-detector','xy-ray','general-radar','walkie-talkies'];let count=0;
 for(let n=2;n<=5;n++)for(let seed=1;seed<=4;seed++){
  const G=BB.createGame(M.get('official-development',39),Array.from({length:n},(_,i)=>({pid:'p'+i,name:'新角色'+i,character:roles[i]})),{captain:0,rng:rng(seed*104729)});
  for(let k=0;k<600&&!['won','lost'].includes(G.phase);k++){const pi=G.pending?G.pending.to:G.turn,a=Bot.decide(G,pi);assert(a);act(G,pi,a);}assert(['won','lost'].includes(G.phase));count++;
 }console.log('✓ 第39关'+count+'局第三盒新角色机器人合法终局，没有缺少动作或重复拒绝');
}

console.log('✓ 第39关奖励牌值仅发给对应持有者，公共视角不含完整奖励牌表或其他玩家牌值');
