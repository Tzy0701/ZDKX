const assert=require('assert'),BB=require('../js/engine'),M=require('../js/missions'),Bot=require('../js/bot');
function rng(seed){return()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);}
function game(n=3,cap=0,seed=1){return BB.createGame(M.get('official-development',41),Array.from({length:n},(_,i)=>({pid:'p'+i,name:'绊线玩家'+i})),{captain:cap,rng:rng(seed)});}
function act(G,pi,a){assert.equal(BB.act(G,pi,a,{rng:()=>0.371}),null,JSON.stringify(a));}
function reject(G,pi,a){const before=JSON.stringify(G);assert(BB.act(G,pi,a));assert.equal(JSON.stringify(G),before);}
function setup(G){while(G.phase==='setup'){const pi=G.pending.to,pd=BB.view(G,pi).pending;act(G,pi,{a:'initial-clue',id:pd.id,w:pd.choices.length?pd.choices.at(-1):null,rack:0});}}
let yellowClues=0;
for(let n=2;n<=5;n++)for(let cap=0;cap<n;cap++)for(let seed=1;seed<=12;seed++){
 const G=game(n,cap,seed*104729);assert.equal(G.wires.length,48+Math.min(n,4)+(n===2?2:1));assert.equal(G.rmark.n,n===2?2:1);assert.equal(G.rmark.cand.length,3);assert.equal(G.ymark.n,Math.min(n,4));assert.equal(G.ymark.cand.length,Math.min(n,4));assert.equal(G.det,0);assert.equal(G.detMax,1);assert.equal(G.detMin,-4);assert(!G.equip.some(e=>e.n===13));assert(!G.equipmentReserve.includes(13));
 for(let pi=0;pi<n;pi++){assert.equal(G.wires.filter(w=>w.o===pi&&BB.kindOf(w)==='y').length,n===5&&pi===cap?0:1);assert.equal(G.players[pi].stands.length,n===2||n===3&&pi===cap?2:1);assert.equal('choices'in BB.view(G,pi).pending,pi===cap);assert.equal(BB.tripwire(BB.view(G,pi)).groups[pi].yellow,n===5&&pi===cap?0:1);}
 const sizes=G.players.flatMap(p=>p.stands.map(st=>st.length));assert(Math.max(...sizes)-Math.min(...sizes)<=1);G.players.forEach(p=>p.stands.forEach(st=>assert.deepEqual(st.map(id=>G.wires[id].v),st.map(id=>G.wires[id].v).sort((a,b)=>a-b))));
 while(G.phase==='setup'){const pd=BB.view(G,G.pending.to).pending;if(pd.token.value==='Y'){yellowClues++;if(pd.choices.length)assert(pd.choices.every(id=>BB.kindOf(G.wires[id])==='y'));}act(G,pd.to,{a:'initial-clue',id:pd.id,w:pd.choices.length?pd.choices.at(-1):null,rack:0});}
 assert(G.players.every((_,pi)=>G.setup[pi]===1));assert(!BB.seqAllowed(G,'Y'));assert(!BB.seqAllowed(BB.view(G,cap),'Y'));assert(!BB.soloOk(G,cap,'Y'));
}
{
 const G=game(3,0,18*104729),pd=BB.view(G,0).pending;assert.equal(pd.token.value,'Y');assert.equal(pd.choices.length,1);act(G,0,{a:'initial-clue',id:pd.id,w:pd.choices[0]});assert.equal(G.wires[pd.choices[0]].info.t,'Y');yellowClues++;
}
{
 let G;for(let seed=1;seed<=100;seed++){G=game(5,0,seed*104729);if(G.pending.token.value==='Y')break;}assert.equal(G.pending.token.value,'Y');assert.equal(BB.view(G,0).pending.choices.length,0);act(G,0,{a:'initial-clue',id:G.pending.id,w:null,rack:0});assert.equal(G.officialState.risky.side[0].value,'Y');yellowClues++;
}
assert(yellowClues>0);console.log('✓ 第41关2–5人全部队长：分开每人一黄、五人队长无黄、架数与排序、固定橙色起点、排除底盒与随机黄色标记通过');
{
 const G=game(3,0,104729);setup(G);const target=G.wires.find(w=>w.o!==0&&BB.kindOf(w)==='y'),ownCuts=G.wires.filter(w=>w.o===0&&w.cut).length;reject(G,0,{a:'tripwire-cut',w:G.wires.find(w=>w.o===0&&!w.cut).id});for(const bad of ['__proto__','constructor',null,-1,0.5])reject(G,0,{a:'tripwire-cut',w:bad});reject(G,0,{a:'tripwire-cut',w:target.id,stab:true});act(G,0,{a:'tripwire-cut',w:target.id});const id=G.pending.id;for(let pi=-1;pi<3;pi++)assert.equal('ownAnswers'in BB.view(G,pi).pending,pi===target.o);reject(G,(target.o+1)%3,{a:'tripwire-reply',id});reject(G,target.o,{a:'tripwire-reply',id:id-1});act(G,target.o,{a:'tripwire-reply',id});assert.equal(G.det,-1);assert(G.wires[target.id].cut);assert.equal(G.wires[target.id].resolution,'secured');assert.equal(G.wires.filter(w=>w.o===0&&w.cut).length,ownCuts);assert.equal(G.pending,null);
}
for(const color of ['b','r']){
 let G,target;for(let seed=1;seed<=100;seed++){G=game(3,0,seed*104729);target=G.wires.find(w=>w.o!==0&&BB.kindOf(w)===color);if(target)break;}setup(G);assert(target);act(G,0,{a:'tripwire-cut',w:target.id});act(G,target.o,{a:'tripwire-reply',id:G.pending.id});assert.equal(G.phase,'lost');assert(!G.wires[target.id].cut);assert.equal(G.det,color==='b'?1:0);
}
{
 const G=game();setup(G);const yellow=G.wires.find(w=>w.o!==0&&BB.kindOf(w)==='y');act(G,0,{a:'tripwire-cut',w:yellow.id});act(G,yellow.o,{a:'tripwire-reply',id:G.pending.id});const actor=G.turn,blue=G.wires.find(w=>w.o!==actor&&BB.kindOf(w)==='b');act(G,actor,{a:'tripwire-cut',w:blue.id});act(G,blue.o,{a:'tripwire-reply',id:G.pending.id});assert.equal(G.phase,'play');assert.equal(G.det,0);assert.equal(G.wires[blue.id].info.v,blue.v);assert(!G.wires[blue.id].cut);
}
{
 const G=game();setup(G);G.det=-4;const yellow=G.wires.find(w=>w.o!==0&&BB.kindOf(w)==='y');act(G,0,{a:'tripwire-cut',w:yellow.id});act(G,yellow.o,{a:'tripwire-reply',id:G.pending.id});assert.equal(G.det,-4);assert(!G.declaration.result.retreated);assert(G.wires[yellow.id].cut);
}
console.log('✓ 第41关单线私人回应、只处理队友黄线并退一格、选红与首错蓝即时失败、非致命蓝失败线索及轨道最早边界通过');
let actions=0;
for(let n=2;n<=5;n++)for(let seed=1;seed<=25;seed++){
 const G=game(n,seed%n,seed*104729);setup(G);
 for(let k=0;k<500&&G.phase==='play';k++){
  const pi=G.pending?G.pending.to:G.turn;let a;
  if(G.pending?.type==='tripwire-cut')a={a:'tripwire-reply',id:G.pending.id};else if(G.pending){const pd=G.pending;a={a:'resolve',id:pd.id,w:pd.step==='own'?BB.view(G,pi).pending.choices.at(-1):pd.ids.find(id=>pd.vals.some(v=>BB.matches(G.wires[id],v)))};}else{
   const yellow=G.wires.find(w=>w.o!==pi&&!w.cut&&BB.kindOf(w)==='y'),own=G.wires.filter(w=>w.o===pi&&!w.cut);
   if(yellow)a={a:'tripwire-cut',w:yellow.id};else if(own.every(w=>BB.kindOf(w)==='r'))a={a:'red'};else{const value=own.find(w=>BB.kindOf(w)==='b').v,target=G.wires.find(w=>w.o!==pi&&!w.cut&&w.v===value);a=BB.soloOk(G,pi,value)?{a:'solo',val:value}:{a:'dual',w:target.id,val:value};}
  }act(G,pi,a);actions++;
 }assert.equal(G.phase,'won');
}
console.log('✓ 第41关100局来源配置全信息参考求解通关，共'+actions+'个开局后合法动作；未认证发布');
assert(M.get('campaign',41).verified);assert(!M.get('custom',41).officialModule);
function rig(hands){const G=game(hands.length);G.wires=[];G.players.forEach(p=>p.stands=[[]]);hands.forEach((hand,o)=>hand.forEach(v=>{const id=G.wires.length;G.wires.push({id,v,o,s:0,cut:false,info:null});G.players[o].stands[0].push(id);}));G.phase='play';G.pending=null;G.turn=G.captain=0;G.turnNo=1;G.officialState.risky.side=[];G.officialState.tripwire={stalled:false,groups:G.players.map((_,pi)=>({ids:G.wires.filter(w=>w.o===pi).map(w=>w.id),yellow:1}))};return G;}
{
 const G=rig([[7,7,7,7,1.1],[2.1],[9,9,9,9,3.1]]);act(G,0,{a:'solo',val:7});assert.equal(G.turn,2);assert.equal(G.det,0);assert(!G.officialState.tripwire.stalled);act(G,2,{a:'tripwire-cut',w:G.wires.find(w=>w.o===1).id});act(G,1,{a:'tripwire-reply',id:G.pending.id});assert.equal(G.det,-1);
}
{
 const G=rig([[7,7,7,7,1.1],[2.1],[3.1]]);act(G,0,{a:'solo',val:7});assert.equal(G.det,0);assert(G.officialState.tripwire.stalled);assert.equal(G.phase,'play');assert.equal(Bot.decide(G,G.turn),null);reject(G,G.turn,{a:'tripwire-cut',w:G.wires.find(w=>w.o!==G.turn).id});
}
{
 const G=rig([[9,9,7,1.1],[1.5,2.1],[8,3.1]]);G.equip=[{n:9,used:false},{n:6,used:false},{n:12,used:false}];for(let k=0;k<2;k++){const id=G.wires.length;G.wires.push({id,v:9,o:2,s:0,cut:true,info:null});G.players[2].stands[0].push(id);}act(G,0,{a:'equip',n:9});assert(G.stab);const red=G.wires.find(w=>BB.kindOf(w)==='r');act(G,0,{a:'tripwire-cut',w:red.id});assert(!G.stab);act(G,red.o,{a:'tripwire-reply',id:G.pending.id});assert.equal(G.phase,'lost');assert.equal(G.det,0);assert(G.equip.find(e=>e.n===9).used);
}
console.log('✓ 第41关仅余黄／红免费跳过、有合法回合者继续及稳定器不保护绊线通过；全员跳过保持等待，随时装备仍可改变手牌');
let wins=0,losses=0,stalled=0;
for(let n=2;n<=5;n++)for(let seed=1;seed<=4;seed++){
 const G=game(n,0,seed*104729);for(let k=0;k<600&&!['won','lost'].includes(G.phase)&&!G.officialState.tripwire.stalled;k++){const pi=G.pending?G.pending.to:G.turn,a=Bot.decide(G,pi);assert(a);act(G,pi,a);}if(G.phase==='won')wins++;else if(G.phase==='lost')losses++;else{assert(G.officialState.tripwire.stalled);stalled++;}
}
console.log('✓ 第41关16局基础角色机器人：胜利'+wins+'、失败'+losses+'、暂需等待'+stalled+'；未发现重复拒绝或未标记的停住');
for(const n of [3,4,5]){
 const G=game(n,0,n*104729);setup(G);const pi=1,probs=Bot.infer(G,pi,8000);
 for(const group of G.officialState.tripwire.groups){if(group.ids.some(id=>G.wires[id].o===pi))continue;const expected=group.yellow,sum=group.ids.reduce((sum,id)=>sum+(probs[id]?.P.Y||0),0);assert(Math.abs(sum-expected)<0.000001,'公开每人一黄约束不满足：'+n+' '+sum);}
}
console.log('✓ 第41关机器人按初始公开线组的一黄／队长零黄约束采样，非持有者没有读取真实黄线身份');
{
 const G=game(3,0,104729);setup(G);const altered=JSON.parse(JSON.stringify(G)),pi=1;altered.wires.forEach(w=>{if(!BB.wireVisible(altered,pi,w)&&(!w.info||w.info.t!=='v'))w.v=w.v===2?11:2;});assert.deepEqual(BB.view(G,pi),BB.view(altered,pi));
 const originalRandom=Math.random;try{Math.random=rng(987654);const first=Bot.infer(G,pi,4000);Math.random=rng(987654);const second=Bot.infer(altered,pi,4000);assert.deepEqual(first,second);}finally{Math.random=originalRandom;}
}
console.log('✓ 第41关相同许可视图、不同真实隐藏线值产生相同推理结果；公开分组约束不泄露真实摆法');
{
 const fs=require('fs'),os=require('os'),path=require('path'),Service=require('../server/official'),dir=fs.mkdtempSync(path.join(os.tmpdir(),'bb41-authority-')),wss={clients:new Set()};
 const last=(ws,topic)=>ws.messages.filter(m=>m.topic===topic).at(-1)?.data;function peer(room){const ws={room,readyState:1,messages:[],send(raw){this.messages.push(JSON.parse(raw));}};wss.clients.add(ws);return ws;}
 try{for(let n=2;n<=5;n++)for(const color of ['y','r']){
  let service=Service(wss,dir);const name='bb-tripwire'+n+color,peers=Array.from({length:n},()=>peer(name));peers.forEach((ws,pi)=>service.handle(ws,pi?'hello':'official:hello',{ruleset:'campaign',mid:41,name:'绊线玩家'+pi}));let watcher=peer(name);service.handle(watcher,'hello',{spectator:true,name:'绊线观众'});let room=service.load(name);service.handle(peers[0],'official:start',{mid:41,revision:room.revision,commandId:'开始'});
  let G,target;for(let seed=1;seed<500;seed++){G=game(n,0,seed*104729);target=G.wires.find(w=>w.o!==0&&BB.kindOf(w)===color);if(target)break;}assert(target);room.G=G;G.catalog=G.mission.catalog='campaign';G.players.forEach((p,pi)=>{p.pid=room.seats[pi].pid;p.name=room.seats[pi].name;});
  function send(pi,id,a){service.handle(peers[pi],'official:act',{gid:G.gid,revision:room.revision,commandId:id,pi:(pi+1)%n,action:a});}
  function pause(paused,id){service.handle(peers[0],'official:pause',{gid:G.gid,revision:room.revision,commandId:id,paused});assert.equal(G.paused,paused);}
  function restart(){const credentials=peers.map(ws=>last(ws,'official:welcome').credential),observerCredential=last(watcher,'official:welcome').credential;service=Service(wss,dir);room=service.load(name);G=room.G;for(let pi=0;pi<n;pi++){peers[pi]=peer(name);service.handle(peers[pi],'hello',{credential:credentials[pi],name:'绊线玩家'+pi});}watcher=peer(name);service.handle(watcher,'hello',{credential:observerCredential,name:'绊线观众'});}
  let step=0;function response(a){const pd=G.pending,pi=pd.to;pause(true,'暂停'+step);service.handle(watcher,'official:perspective',{pid:room.seats[pi].pid});const V=last(watcher,'official:view').view;assert(V.spectator);assert(!('choices'in V.pending));assert(!('ownAnswers'in V.pending));assert(!('canPlaceAside'in V.pending));
   const frozen=JSON.stringify(G);send(pi,'暂停回应'+step,a);assert.equal(JSON.stringify(G),frozen);const pending=JSON.parse(JSON.stringify(G.pending)),det=G.det;restart();assert.deepEqual(G.pending,pending);assert.equal(G.det,det);pause(false,'继续'+step);
   const before=JSON.stringify(G);send((pi+1)%n,'冒充'+step,a);assert.equal(JSON.stringify(G),before);send(pi,'旧回应'+step,{...a,id:pd.id-1});assert.equal(JSON.stringify(G),before);service.handle(watcher,'official:act',{gid:G.gid,revision:room.revision,commandId:'观众'+step,action:a});assert.equal(JSON.stringify(G),before);
   peers.forEach((ws,who)=>{const view=last(ws,'official:view').view;assert.equal('choices'in view.pending,pd.type==='initial-clue'&&who===pi);assert.equal('ownAnswers'in view.pending,pd.type==='tripwire-cut'&&who===pi);});
   send(pi,'回应'+step,a);const rev=room.revision;send(pi,'回应'+step,a);assert.equal(room.revision,rev);step++;
  }
  while(G.phase==='setup'){const pd=BB.view(G,G.pending.to).pending;response({a:'initial-clue',id:pd.id,w:pd.choices.length?pd.choices.at(-1):null,rack:0});}
  const saved=JSON.stringify(G);send(0,'畸形目标',{a:'tripwire-cut',w:'__proto__'});assert.equal(JSON.stringify(G),saved);send(0,'绊线宣告',{a:'tripwire-cut',w:target.id});response({a:'tripwire-reply',id:G.pending.id});assert.equal(G.phase,color==='y'?'play':'lost');assert.equal(G.det,color==='y'?-1:0);assert.equal(G.wires[target.id].cut,color==='y');if(color==='y')assert.equal(G.wires[target.id].resolution,'secured');const prior=JSON.stringify(G);restart();assert.equal(JSON.stringify(G),prior);
 }}finally{fs.rmSync(dir,{recursive:true,force:true});}
 console.log('✓ 第41关2–5人权威服务：随机初始与黄／红回应的暂停、重连、重启、私人选项、观战只读、冒充／过期／畸形目标拒绝与去重通过');
}
function waitingDeal(){let G;for(let seed=1;seed<=200;seed++){G=game(3,0,seed*104729);if(G.equip.some(e=>e.n===2))break;}assert(G.equip.some(e=>e.n===2));setup(G);for(let k=0;k<300&&!G.officialState.tripwire.stalled;k++){
 const pi=G.pending?G.pending.to:G.turn;let a;if(G.pending){const pd=G.pending;a={a:'resolve',id:pd.id,w:pd.step==='own'?BB.view(G,pi).pending.choices.at(-1):pd.ids.find(id=>G.wires[id].v===pd.vals[0])};}else{const value=G.wires.find(w=>w.o===pi&&!w.cut&&BB.kindOf(w)==='b').v,target=G.wires.find(w=>w.o!==pi&&!w.cut&&w.v===value);a=BB.soloOk(G,pi,value)?{a:'solo',val:value}:{a:'dual',w:target.id,val:value};}act(G,pi,a);
 }assert(G.officialState.tripwire.stalled);assert.equal(G.wires.filter(w=>w.cut&&BB.kindOf(w)==='b').length,48);return G;}
for(const direction of ['offer-red','offer-yellow']){
 const G=waitingDeal(),redOwner=G.wires.find(w=>!w.cut&&BB.kindOf(w)==='r').o,pi=direction==='offer-red'?redOwner:G.players.findIndex((_,i)=>i!==redOwner),a=Bot.decide(G,pi);assert(a);assert.equal(a.a,'equip');assert.equal(a.n,2);assert.equal(BB.kindOf(G.wires[a.w]),direction==='offer-red'?'r':'y');act(G,pi,a);const reply=Bot.decide(G,G.pending.to);assert(reply);assert.equal(reply.a,'walkie');assert.equal(BB.kindOf(G.wires[reply.w]),direction==='offer-red'?'y':'r');act(G,G.pending.to,reply);assert(!G.officialState.tripwire.stalled);assert(G.wires.filter(w=>w.o===G.turn&&!w.cut).every(w=>BB.kindOf(w)==='r'));
 for(let k=0;k<30&&G.phase==='play';k++){const who=G.pending?G.pending.to:G.turn,a=Bot.decide(G,who);assert(a);if(a.a==='red')assert.equal(BB.cutCount(G,'Y'),G.ymark.n,'不能在绊线仍需帮助时先退出');act(G,who,a);}assert.equal(G.phase,'won');
}
console.log('✓ 第41关来源合法全员跳过局面，可双向秘密交换恢复红线队员行动；机器人继续处理队友全部绊线后公开红线并获胜');
{
 const roles=['double-detector','triple-detector','xy-ray','general-radar','walkie-talkies'];let won=0,lost=0,waiting=0;
 for(let n=2;n<=5;n++)for(let seed=1;seed<=4;seed++){
  const G=BB.createGame(M.get('official-development',41),Array.from({length:n},(_,i)=>({pid:'p'+i,name:'新角色'+i,character:roles[i]})),{captain:0,rng:rng(seed*104729)});
  for(let k=0;k<600&&!['won','lost'].includes(G.phase);k++){
   let pi=G.pending?G.pending.to:G.turn,a;
   if(G.officialState.tripwire.stalled&&!G.pending){for(let who=0;who<n;who++){a=Bot.decide(G,who);if(a){pi=who;break;}}if(!a){waiting++;break;}}
   else a=Bot.decide(G,pi);
   assert(a);act(G,pi,a);
  }
  if(G.phase==='won')won++;else if(G.phase==='lost')lost++;else assert(G.officialState.tripwire.stalled);
 }assert.equal(won+lost+waiting,16);console.log('✓ 第41关16局新角色组合合法终局／等待：胜利'+won+'、失败'+lost+'、等待'+waiting+'，没有重复拒绝');
}
{
 const fs=require('fs'),os=require('os'),path=require('path'),Service=require('../server/official'),dir=fs.mkdtempSync(path.join(os.tmpdir(),'bb41-legacy-'));
 try{for(let n=2;n<=5;n++){
  const seats=Array.from({length:n},(_,i)=>({pid:'p'+i,name:'旧玩家'+i,credential:'旧凭证'+i,bot:false})),mission=JSON.parse(JSON.stringify(M.get('custom',41)));mission.catalog='campaign';mission.contentVersion=15;const G=BB.createGame(mission,seats,{rng:rng(n*104729)});G.catalog='campaign';G.contentVersion=15;const name='bb-legacy41-'+n,before=JSON.stringify(G.mission);
  fs.writeFileSync(path.join(dir,name+'.json'),JSON.stringify({version:1,name,host:seats[0].pid,mid:41,ruleset:'campaign',attempts:1,started:true,seats,observers:[],revision:0,seen:[],G}));const room=Service({clients:new Set()},dir).load(name);assert(room);assert.equal(JSON.stringify(room.G.mission),before);assert.equal(room.G.contentVersion,15);assert(!room.G.officialState);assert.equal(room.G.ruleset,'custom');assert.equal(room.G.detMax,G.detMax);assert.deepEqual(room.G.ymark,G.ymark);assert.deepEqual(room.G.rmark,G.rmark);assert.equal(BB.view(room.G,0).official,null);
 }}finally{fs.rmSync(dir,{recursive:true,force:true});}
 console.log('✓ 第41关2–5人旧版本15改编存档保持原规则、黄红配置、引爆器和视角，未替换为绊线规则');
}

{
 const originalRandom=Math.random;try{
  for(const n of [3,4,5]){const G=game(n,0,n*104729);setup(G);for(let sampleSeed=1;sampleSeed<=8;sampleSeed++){
   Math.random=rng(10000+n*100+sampleSeed);const probs=Bot.infer(G,1,5000);
   for(const group of G.officialState.tripwire.groups){if(group.ids.some(id=>G.wires[id].o===1))continue;const sum=group.ids.reduce((n,id)=>n+(probs[id]?.P.Y||0),0);assert(Math.abs(sum-group.yellow)<0.000001,'有效样本缺失：人数'+n+'种子'+sampleSeed);}
  }}
 }finally{Math.random=originalRandom;}
}
console.log('✓ 第41关24组确定性采样初始化均产生有效概率，保持公开黄线约束；修复库存与排序容量导致的偶发全零');
