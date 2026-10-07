const assert=require('assert'),BB=require('../js/engine'),M=require('../js/missions'),Bot=require('../js/bot');
function rng(seed){return()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);}
function game(n=3,cap=0,seed=1){return BB.createGame(M.get('official-development',36),Array.from({length:n},(_,i)=>({pid:'p'+i,name:'序列玩家'+i})),{captain:cap,rng:rng(seed)});}
function act(G,pi,a){assert.equal(BB.act(G,pi,a),null,JSON.stringify(a));}
function reject(G,pi,a){const before=JSON.stringify(G);assert(BB.act(G,pi,a));assert.equal(JSON.stringify(G),before);}
function setup(G,end='left'){act(G,G.captain,{a:'sequence-end',id:G.pending.id,end});while(G.phase==='setup'){const pi=BB.setupActor(G);act(G,pi,{a:'info',w:G.wires.find(w=>w.o===pi&&BB.setupInfoAllowed(G,w)).id});}}
for(let n=2;n<=5;n++)for(let cap=0;cap<n;cap++)for(let seed=1;seed<=10;seed++){
 const G=game(n,cap,seed*104729);assert.equal(G.wires.length,n===2?54:51);assert.equal(G.rmark.n,n===2?2:1);assert.equal(G.rmark.cand.length,3);assert.equal(G.ymark.n,n===2?4:2);assert.equal(G.ymark.cand.length,G.ymark.n);
 assert.equal(G.phase,'sequence');assert.equal(G.pending.to,cap);assert.equal(new Set(G.officialState.numberEnds.row).size,5);
 for(let pi=-1;pi<n;pi++){const V=BB.view(G,pi);assert.equal('choices' in V.pending,pi===cap);assert.deepEqual(V.official.numberEnds.row,G.officialState.numberEnds.row);}
 reject(G,(cap+1)%n,{a:'sequence-end',id:G.pending.id,end:'left'});reject(G,cap,{a:'sequence-end',id:G.pending.id,end:'middle'});reject(G,cap,{a:'info',w:G.wires.find(w=>w.o===cap&&Number.isInteger(w.v)).id});
 const id=G.pending.id;setup(G,seed%2?'left':'right');reject(G,cap,{a:'sequence-end',id,end:'left'});
 const row=G.officialState.numberEnds.row,current=row[G.officialState.numberEnds.end==='left'?0:4];
 for(let v=1;v<=12;v++){assert.equal(BB.seqAllowed(G,v,cap),!row.includes(v)||v===current);assert.equal(BB.seqAllowed(BB.view(G,cap),v,cap),BB.seqAllowed(G,v,cap));}
 assert(BB.seqAllowed(G,'Y',cap));assert.equal(G.wires.filter(w=>w.info).length,n);
}
console.log('✓ 第36关2–5人全部队长来源设置、私有端点选择、拒绝回滚、初始顺序和视角合法值通过');
// 核心回归使用小型明确局面，覆盖移牌门槛、反向选择与被锁回合。
function rig(hands,row=[1,2,3,4,5]){const G=game(hands.length);G.wires=[];G.players.forEach(p=>p.stands=[[]]);hands.forEach((h,o)=>h.forEach(v=>{const id=G.wires.length;G.wires.push({id,v,o,s:0,cut:false,info:null});G.players[o].stands[0].push(id);}));G.phase='play';G.pending=null;G.turn=0;G.officialState.numberEnds={row:row.slice(),end:'left',removed:[]};return G;}
{
 const G=rig([[1,1,7],[5,5,7],[2,2,6]]);act(G,0,{a:'solo',val:1});assert.deepEqual(G.officialState.numberEnds.row,[2,3,4,5]);assert.equal(G.pending.type,'sequence-end');assert.equal(G.pending.to,0);assert.equal(G.turn,0);
 const decision=G.pending.id;reject(G,1,{a:'sequence-end',id:decision,end:'right'});const saved=JSON.parse(JSON.stringify(G));act(saved,0,{a:'sequence-end',id:decision,end:'right'});assert.equal(saved.turn,1);assert(BB.seqAllowed(saved,5,1));assert(!BB.seqAllowed(saved,2,1));assert(BB.seqAllowed(saved,1,1));
 reject(saved,0,{a:'sequence-end',id:decision,end:'left'});act(saved,1,{a:'solo',val:5});act(saved,1,{a:'sequence-end',id:saved.pending.id,end:'left'});assert.equal(saved.turn,2);assert(BB.seqAllowed(saved,2,2));
}
{
 const G=rig([[1,7],[1,7],[2,3]]);act(G,0,{a:'dual',w:2,val:1});const id=G.pending.id;act(G,1,{a:'resolve',id,w:2});act(G,0,{a:'resolve',id,w:0});assert.equal(G.pending.type,'sequence-end');assert.deepEqual(G.officialState.numberEnds.removed,[1]);act(G,0,{a:'sequence-end',id:G.pending.id,end:'right'});assert.equal(G.turn,1);act(G,1,{a:'dual',w:1,val:7});let pd=G.pending;act(G,pd.to,{a:'resolve',id:pd.id,w:1});pd=G.pending;act(G,pd.to,{a:'resolve',id:pd.id,w:3});assert.equal(G.phase,'lost');assert(G.result.why.includes('数字序列'));
}
{
 const G=rig([[1,1],[2,2],[6,6]],[1]);act(G,0,{a:'solo',val:1});assert.equal(G.pending,null);assert.deepEqual(G.officialState.numberEnds.row,[]);assert.equal(G.turn,1);assert(BB.seqAllowed(G,2,1));
}
console.log('✓ 第36关成功剪两根后移牌、行动者保留决定、反向继续、旧决定拒绝、末牌与无法遵守立即失败通过');
let terminal=0;
for(let n=2;n<=5;n++)for(let seed=1;seed<=4;seed++){
 const G=game(n,0,seed*104729);for(let k=0;k<500&&!['won','lost'].includes(G.phase);k++){const pi=G.pending?G.pending.to:G.phase==='setup'?BB.setupActor(G):G.turn,a=Bot.decide(G,pi);assert(a,'机器人缺少动作 '+G.phase);act(G,pi,a);}assert(['won','lost'].includes(G.phase));terminal++;
}
console.log('✓ 第36关'+terminal+'局私人视角机器人合法终局；未声称全部通关或官方发布');
assert(!M.get('campaign',36).verified);assert(!M.get('custom',36).officialModule);
function gear(G,n){G.equip=G.equip.filter(e=>e.n!==n).concat([{n,used:false}]);for(let k=0;k<2;k++){const id=G.wires.length;G.wires.push({id,v:n,o:G.np-1,s:0,cut:true,info:null});G.players.at(-1).stands[0].push(id);}}
{
 const G=rig([[1,7],[6,7],[2,2]]),before=G.officialState.numberEnds.row.slice();act(G,0,{a:'dual',w:2,val:1});act(G,1,{a:'resolve',id:G.pending.id,w:2});assert.equal(G.pending,null);assert.equal(G.det,1);assert.deepEqual(G.officialState.numberEnds.row,before);
}
{
 const G=rig([[1,1,1,1,7],[6,6],[7,8]]);act(G,0,{a:'solo',val:1});assert.equal(G.officialState.numberEnds.removed.length,1);assert.equal(G.lastAct.ids.length,4);assert.equal(G.pending.to,0);
}
{
 const G=rig([[1,7],[6,1,8],[2,2]]);gear(G,10);reject(G,0,{a:'dual',w:2,val:1,xy:true,vals:[1,2]});assert(!G.equip.find(e=>e.n===10).used);act(G,0,{a:'dual',w:3,val:1,xy:true,vals:[1,7]});act(G,1,{a:'resolve',id:G.pending.id,w:3});act(G,0,{a:'resolve',id:G.pending.id,w:0});assert.equal(G.pending.type,'sequence-end');assert(G.equip.find(e=>e.n===10).used);
}
{
 const G=rig([[1,7],[6,1,8],[2,2]]);act(G,0,{a:'dd',ws:[2,3],val:1});act(G,1,{a:'resolve',id:G.pending.id,w:3});act(G,0,{a:'resolve',id:G.pending.id,w:0});assert.equal(G.pending.type,'sequence-end');assert.equal(G.players[0].dd,0);
}
{
 const G=rig([[1,7],[6,8],[2,2]]);gear(G,9);act(G,0,{a:'dual',w:2,val:1,stab:true});act(G,1,{a:'resolve',id:G.pending.id,w:2});assert.equal(G.det,0);assert.equal(G.pending,null);assert.equal(G.officialState.numberEnds.row.length,5);
}
{
 const G=rig([[7,2],[2,7],[6,6]]);gear(G,2);act(G,1,{a:'equip',n:2,w:2,p:0});act(G,0,{a:'walkie',id:G.pending.id,w:0});assert.equal(G.phase,'lost');assert(G.result.why.includes('数字序列'));
}
console.log('✓ 第36关失败不移牌、四根只移一牌、X/Y限制、双重探测器、稳定器与交换后合法性检查通过');
{
 const G=game();assert.equal(BB.setPaused(G,true,1000),null);reject(G,G.captain,{a:'sequence-end',id:G.pending.id,end:'left'});assert.equal(BB.setPaused(G,false,2000),null);act(G,G.captain,{a:'sequence-end',id:G.pending.id,end:'left'});
}
console.log('✓ 第36关初始序列选择阶段也可暂停，暂停期间拒绝决定且状态不变');
{
 const fs=require('fs'),os=require('os'),path=require('path'),Service=require('../server/official'),dir=fs.mkdtempSync(path.join(os.tmpdir(),'bb36-authority-')),wss={clients:new Set()};
 const last=(ws,topic)=>ws.messages.filter(m=>m.topic===topic).at(-1)?.data;function peer(room){const ws={room,readyState:1,messages:[],send(raw){this.messages.push(JSON.parse(raw));}};wss.clients.add(ws);return ws;}
 try{for(let n=2;n<=5;n++){
  let service=Service(wss,dir);const name='bb-ends'+n,peers=Array.from({length:n},()=>peer(name));peers.forEach((ws,pi)=>service.handle(ws,pi?'hello':'official:hello',{ruleset:'campaign',mid:36,name:'序列玩家'+pi}));let room=service.load(name);service.handle(peers[0],'official:start',{mid:36,revision:room.revision,commandId:'开始'});
  let G,target,value;for(let seed=1;seed<500;seed++){G=game(n,0,seed*104729);value=G.officialState.numberEnds.row[0];if(G.wires.some(w=>w.o===0&&w.v===value)){target=G.wires.find(w=>w.o!==0&&w.v===value);if(target)break;}}
  assert(target);room.G=G;G.catalog=G.mission.catalog='campaign';G.players.forEach((p,pi)=>{p.pid=room.seats[pi].pid;p.name=room.seats[pi].name;});
  function send(pi,id,a){service.handle(peers[pi],'official:act',{gid:room.G.gid,revision:room.revision,commandId:id,pi:(pi+1)%n,action:a});}
  function pause(paused,id){service.handle(peers[0],'official:pause',{gid:room.G.gid,revision:room.revision,commandId:id,paused});assert.equal(room.G.paused,paused);}
  function restart(){const credentials=peers.map(ws=>last(ws,'official:welcome').credential);service=Service(wss,dir);room=service.load(name);G=room.G;for(let pi=0;pi<n;pi++){peers[pi]=peer(name);service.handle(peers[pi],'hello',{credential:credentials[pi],name:'序列玩家'+pi});}}
  const initial=G.pending.id;pause(true,'初始暂停');const frozen=JSON.stringify(G);send(0,'暂停选端',{a:'sequence-end',id:initial,end:'left'});assert.equal(JSON.stringify(G),frozen);restart();assert.equal(G.pending.id,initial);assert.equal(G.phase,'sequence');assert(G.paused);pause(false,'初始继续');send(0,'先选左端',{a:'sequence-end',id:initial,end:'left'});assert.equal(G.phase,'setup');
  let k=0;while(G.phase==='setup'){const pi=BB.setupActor(G);send(pi,'标记'+k++,{a:'info',w:G.wires.find(w=>w.o===pi&&BB.setupInfoAllowed(G,w)).id});}
  send(0,'猜当前数值',{a:'dual',w:target.id,val:value});send(target.o,'目标回应',{a:'resolve',id:G.pending.id,w:target.id});const choice=BB.view(G,0).pending.choices.at(-1);send(0,'自己的配对',{a:'resolve',id:G.pending.id,w:choice});assert.equal(G.pending.type,'sequence-end');const decision=G.pending.id;
  peers.forEach((ws,pi)=>assert.equal('choices' in last(ws,'official:view').view.pending,pi===0));assert(!('choices' in BB.view(G,-1).pending));
  const before=JSON.stringify(G);send(1,'冒充行动者',{a:'sequence-end',id:decision,end:'right'});assert.equal(JSON.stringify(G),before);send(0,'旧决定',{a:'sequence-end',id:initial,end:'right'});assert.equal(JSON.stringify(G),before);
  pause(true,'后续暂停');restart();assert.equal(G.pending.id,decision);assert(G.paused);pause(false,'后续继续');send(0,'选择右端',{a:'sequence-end',id:decision,end:'right'});assert.equal(G.pending,null);assert.equal(G.officialState.numberEnds.end,'right');const rev=room.revision;send(0,'选择右端',{a:'sequence-end',id:decision,end:'right'});assert.equal(room.revision,rev);restart();assert.equal(G.officialState.numberEnds.end,'right');send(0,'选择右端',{a:'sequence-end',id:decision,end:'right'});assert.equal(room.revision,rev);
 }}finally{fs.rmSync(dir,{recursive:true,force:true});}
 console.log('✓ 第36关2–5人权威服务：初始及剪线后选端的暂停、重连、重启、私人视图、冒充拒绝、旧决定拒绝与重启后去重通过');
}

// 全信息参考求解只用于确认来源发牌可达，不用于游戏机器人。
let wins=0,losses=0,actions=0;
for(let n=2;n<=5;n++)for(let seed=1;seed<=25;seed++){
const G=game(n,seed%n,seed*104729);
for(let k=0;k<500&&!['won','lost'].includes(G.phase);k++){
const pi=G.pending?G.pending.to:G.phase==='setup'?BB.setupActor(G):G.turn;let a;
if(G.pending?.type==='sequence-end'){const s=G.officialState.numberEnds;let next=G.pending.initial?G.captain:(G.turn+1)%n;while(!G.wires.some(w=>w.o===next&&!w.cut))next=(next+1)%n;const own=G.wires.filter(w=>w.o===next&&!w.cut);a={a:'sequence-end',id:G.pending.id,end:own.some(w=>w.v===s.row[0])?'left':own.some(w=>w.v===s.row.at(-1))?'right':'left'};}
else if(G.phase==='setup')a={a:'info',w:G.wires.find(w=>w.o===pi&&BB.setupInfoAllowed(G,w)).id};
else if(G.pending){const pd=G.pending;a={a:'resolve',id:pd.id,w:pd.step==='own'?BB.view(G,pi).pending.choices.at(-1):pd.ids.find(id=>pd.vals.some(v=>BB.matches(G.wires[id],v)))};}
else{const own=G.wires.filter(w=>w.o===pi&&!w.cut);if(own.every(w=>BB.kindOf(w)==='r'))a={a:'red'};else{const s=G.officialState.numberEnds,current=s.row[s.end==='left'?0:s.row.length-1],candidate=own.filter(w=>BB.kindOf(w)!=='r'&&BB.seqAllowed(G,BB.annOf(w),pi)).sort((a,b)=>Number(b.v===current)-Number(a.v===current))[0],value=BB.annOf(candidate),target=G.wires.find(w=>w.o!==pi&&!w.cut&&BB.matches(w,value));a=BB.soloOk(G,pi,value)?{a:'solo',val:value}:{a:'dual',w:target.id,val:value};}}
const err=BB.act(G,pi,a);if(err)throw new Error(err+JSON.stringify(a));actions++;
}
assert.equal(G.phase,'won');wins++;
}
assert.equal(wins,100);console.log('✓ 第36关100局来源配置全信息参考求解完整通关，共'+actions+'个合法动作；此结果不代表机器人有隐藏信息或任意随机局都能赢');
for(const detector of [3,5]){
 const G=rig([[1,7],[6,1,8],[2,2]]);gear(G,detector);act(G,0,detector===3?{a:'equip',n:3,ws:[2,3,4],val:1}:{a:'equip',n:5,p:1,s:0,val:1});assert.deepEqual(BB.view(G,1).pending.choices,[3]);assert(!('choices' in BB.view(G,2).pending));act(G,1,{a:'resolve',id:G.pending.id,w:3});act(G,0,{a:'resolve',id:G.pending.id,w:0});assert.equal(G.pending.type,'sequence-end');assert.equal(G.officialState.numberEnds.removed[0],1);assert(G.equip.find(e=>e.n===detector).used);
}
{
 const G=rig([[1,7],[7,6],[2,2]]);gear(G,10);act(G,0,{a:'dual',w:2,val:1,xy:true,vals:[1,7]});act(G,1,{a:'resolve',id:G.pending.id,w:2});act(G,0,{a:'resolve',id:G.pending.id,w:1});assert.equal(G.pending,null);assert.deepEqual(G.officialState.numberEnds.row,[1,2,3,4,5]);assert.deepEqual(G.officialState.numberEnds.removed,[]);
}
{
 const G=rig([[1,7],[6,8],[2,2]]);gear(G,8);act(G,1,{a:'equip',n:8,val:1});assert.equal(G.turn,0);assert.deepEqual(G.officialState.numberEnds.row,[1,2,3,4,5]);assert(G.equip.find(e=>e.n===8).used);
 gear(G,7);G.players[0].dd=0;act(G,1,{a:'equip',n:7,players:[0]});assert.equal(G.players[0].dd,1);assert.equal(G.turn,0);
 gear(G,6);act(G,1,{a:'equip',n:6});assert.equal(G.det,-1);assert.equal(G.turn,0);assert.equal(G.pending,null);
}
{
 const G=rig([[1,7],[2,2],[6,6]]);gear(G,11);act(G,0,{a:'equip',n:11,p:1});assert.equal(G.phase,'lost');assert.equal(G.officialState.numberEnds.row.length,5);
}
console.log('✓ 第36关三重／超级的私人命中与移牌、X/Y命中自由值不移牌、非回合雷达／电池／倒带器及咖啡杯被锁回合通过');
{
 let count=0;const roles=['double-detector','triple-detector','xy-ray','general-radar','walkie-talkies'];
 for(let n=2;n<=5;n++)for(let seed=1;seed<=4;seed++){
  const G=BB.createGame(M.get('official-development',36),Array.from({length:n},(_,i)=>({pid:'p'+i,name:'角色玩家'+i,character:roles[i]})),{captain:0,rng:rng(seed*104729)});
  for(let k=0;k<600&&!['won','lost'].includes(G.phase);k++){const pi=G.pending?G.pending.to:G.phase==='setup'?BB.setupActor(G):G.turn,a=Bot.decide(G,pi);assert(a);act(G,pi,a);}assert(['won','lost'].includes(G.phase));count++;
 }
 console.log('✓ 第36关'+count+'局第三盒新角色组合机器人合法终局，没有重复拒绝的动作');
}
