const assert=require('assert'),BB=require('../js/engine'),M=require('../js/missions');
function rng(s){return()=>((s=(Math.imul(s,1664525)+1013904223)>>>0)/4294967296);}
function game(n=3,cap=0,seed=1){return BB.createGame(M.get('official-development',48),Array.from({length:n},(_,i)=>({pid:'p'+i,name:'三黄玩家'+i})),{captain:cap,rng:rng(seed)});}
function act(G,pi,a){assert.equal(BB.act(G,pi,a),null,JSON.stringify(a));}
function reject(G,pi,a){const before=JSON.stringify(G);assert(BB.act(G,pi,a));assert.equal(JSON.stringify(G),before);}
function setup(G){while(G.phase==='setup'){const pi=BB.setupActor(G);act(G,pi,{a:'info',w:G.wires.find(w=>w.o===pi&&BB.setupInfoAllowed(G,w)).id});}}
function rig(hands){const G=game(hands.length);setup(G);G.wires=[];G.players.forEach(p=>p.stands=p.stands.map(()=>[]));hands.forEach((hand,o)=>hand.forEach(v=>{const id=G.wires.length;G.wires.push({id,v,o,s:0,cut:false,info:null});G.players[o].stands[0].push(id);}));G.equip=[];return G;}
function replies(G){while(G.phase==='play'&&G.pending)act(G,G.pending.to,{a:'yellow-three-reply',id:G.pending.id});}
for(let n=2;n<=5;n++)for(let cap=0;cap<n;cap++)for(let seed=1;seed<=8;seed++){
 const G=game(n,cap,seed*104729),yellow=G.wires.filter(w=>BB.kindOf(w)==='y');assert.equal(G.wires.length,n===2?54:53);assert.equal(G.rmark.n,n===2?3:2);assert.equal(G.rmark.cand.length,n===2?3:2);assert.equal(yellow.length,3);assert.equal(G.ymark.cand.length,3);
 for(let offset=0;offset<n;offset++){const owner=(cap+offset)%n;assert.equal(yellow.filter(w=>w.o===owner).length,n===2?offset===0?2:1:offset<3?1:0);}
 if(n===2)assert.equal(new Set(yellow.filter(w=>w.o===cap).map(w=>w.s)).size,2);const sizes=G.players.flatMap(p=>p.stands.map(s=>s.length));assert(Math.max(...sizes)-Math.min(...sizes)<=1);setup(G);assert(G.players.every((_,pi)=>G.setup[pi]===1));
}
console.log('✓ 第48关2–5人全部队长：53／54根、三黄先分到前三人、双人队长两架各黄、均衡排序与正常初始蓝线索');
{
 const G=rig([[1.1,4],[3.1,4],[7.1,5]]),ids=G.wires.filter(w=>BB.kindOf(w)==='y').map(w=>w.id);reject(G,0,{a:'solo',val:'Y'});reject(G,0,{a:'dual',w:2,val:'Y'});reject(G,1,{a:'yellow-three-cut',ws:ids});reject(G,0,{a:'yellow-three-cut',ws:[ids[0],ids[0],ids[1]]});reject(G,0,{a:'yellow-three-cut',ws:ids,stab:true});
 act(G,0,{a:'yellow-three-cut',ws:ids});const restored=JSON.parse(JSON.stringify(G));while(restored.pending){const who=restored.pending.to;for(let pi=-1;pi<3;pi++)assert.equal('ownAnswers'in BB.view(restored,pi).pending,pi===who);reject(restored,(who+1)%3,{a:'yellow-three-reply',id:restored.pending.id});act(restored,who,{a:'yellow-three-reply',id:restored.pending.id});}assert(restored.officialState.yellowThree.complete);assert(ids.every(id=>restored.wires[id].cut));assert.equal(restored.det,0);
}
{
 const G=rig([[1.1,4],[3.1,4],[7.1,5]]);act(G,0,{a:'yellow-three-cut',ws:[0,3,5]});replies(G);assert.equal(G.det,1);assert(G.wires.filter(w=>BB.kindOf(w)==='y').every(w=>!w.cut));assert.equal(G.wires[0].info,null);assert.equal(G.wires[3].info.v,4);assert.equal(G.wires[5].info.v,5);
 const R=rig([[1.1,4],[3.1,1.5],[7.1,5]]);act(R,0,{a:'yellow-three-cut',ws:[0,2,3]});replies(R);assert.equal(R.phase,'lost');
}
for(const n of [4,5]){const hands=[[4],[1.1,4],[3.1,4],[7.1,4]];if(n===5)hands.push([5]);const G=rig(hands);act(G,0,{a:'yellow-three-cut',ws:G.wires.filter(w=>BB.kindOf(w)==='y').map(w=>w.id)});replies(G);assert(G.officialState.yellowThree.complete);}
{
 const G=rig([[4],[1.1,4],[3.1,7.1]]);reject(G,0,{a:'yellow-three-cut',ws:[1,3,4]});
}
assert(!M.get('campaign',48).verified);assert(!M.get('custom',48).officialModule);
console.log('✓ 第48关当前德文分支：三黄一次成功、禁止普通黄拆、跨玩家保存／私人回应、错误只标错线且仅罚一格、基础红线引爆、4–5人无黄也可发起通过；版本差异未裁定');
{
 const fs=require('fs'),os=require('os'),path=require('path'),Service=require('../server/official'),C=require('../js/campaign-rules'),dir=fs.mkdtempSync(path.join(os.tmpdir(),'bb48-authority-')),wss={clients:new Set()};
 function peer(room){const ws={room,readyState:1,messages:[],send(raw){this.messages.push(JSON.parse(raw));}};wss.clients.add(ws);return ws;}
 const last=(ws,topic)=>ws.messages.filter(m=>m.topic===topic).at(-1)?.data;
 try{for(let n=2;n<=5;n++){
  let service=Service(wss,dir);const name='bb-yellow-three'+n,peers=Array.from({length:n},()=>peer(name));peers.forEach((ws,pi)=>service.handle(ws,pi?'hello':'official:hello',{ruleset:'campaign',mid:48,name:'三黄联机'+pi}));let observer=peer(name);service.handle(observer,'hello',{spectator:true,name:'三黄观众'});let room=service.load(name);service.handle(peers[0],'official:start',{mid:48,revision:room.revision,commandId:'开始'});
  let G=game(n,0,n*104729);room.G=G;G.catalog=G.mission.catalog='campaign';G.players.forEach((p,pi)=>{p.pid=room.seats[pi].pid;p.name=room.seats[pi].name;});
  function send(pi,id,a){service.handle(peers[pi],'official:act',{gid:G.gid,revision:room.revision,commandId:id,pi:(pi+1)%n,action:a});}
  function pause(paused,id){service.handle(peers[0],'official:pause',{gid:G.gid,revision:room.revision,commandId:id,paused});assert.equal(G.paused,paused);}
  function restart(){const creds=peers.map(ws=>last(ws,'official:welcome').credential),observerCred=last(observer,'official:welcome').credential;peers.forEach(ws=>ws.readyState=3);observer.readyState=3;service=Service(wss,dir);room=service.load(name);G=room.G;for(let pi=0;pi<n;pi++){peers[pi]=peer(name);service.handle(peers[pi],'hello',{credential:creds[pi],name:'三黄联机'+pi});}observer=peer(name);service.handle(observer,'hello',{credential:observerCred,name:'三黄观众'});}
  let k=0;while(G.phase==='setup'){const pi=BB.setupActor(G);send(pi,'初始'+k++,{a:'info',w:G.wires.find(w=>w.o===pi&&BB.setupInfoAllowed(G,w)).id});}
  const ids=G.wires.filter(w=>BB.kindOf(w)==='y').map(w=>w.id);send(0,'三黄宣告',{a:'yellow-three-cut',ws:ids});const decision=G.pending.id,start=room.revision;send(0,'三黄宣告',{a:'yellow-three-cut',ws:ids});assert.equal(room.revision,start);
  let repliesCount=0;while(G.pending){const who=G.pending.to;peers.forEach((ws,pi)=>assert.equal('ownAnswers'in last(ws,'official:view').view.pending,pi===who));service.handle(observer,'official:perspective',{pid:room.seats[who].pid});assert(!('ownAnswers'in last(observer,'official:view').view.pending));
   pause(true,'暂停三黄'+repliesCount);const pending=JSON.parse(JSON.stringify(G.pending)),frozen=JSON.stringify(G);send(who,'暂停回应'+repliesCount,{a:'yellow-three-reply',id:decision});assert.equal(JSON.stringify(G),frozen);restart();assert.deepEqual(G.pending,pending);assert(G.paused);pause(false,'继续三黄'+repliesCount);
   const before=JSON.stringify(G);send((who+1)%n,'冒用回应'+repliesCount,{a:'yellow-three-reply',id:decision});assert.equal(JSON.stringify(G),before);send(who,'过期回应'+repliesCount,{a:'yellow-three-reply',id:decision-1});assert.equal(JSON.stringify(G),before);send(who,'真实回应'+repliesCount,{a:'yellow-three-reply',id:decision});const after=room.revision;send(who,'真实回应'+repliesCount,{a:'yellow-three-reply',id:decision});assert.equal(room.revision,after);repliesCount++;
  }
  assert(repliesCount>=2);assert(G.officialState.yellowThree.complete);assert.equal(G.det,0);assert(ids.every(id=>G.wires[id].cut));restart();assert(G.officialState.yellowThree.complete);assert(ids.every(id=>G.wires[id].cut));
  // 再创建实际来源失败场景，保留房间身份；测试当前德文“仅标错线”分支。
  G=game(n,0,(n+7)*104729);setup(G);G.catalog=G.mission.catalog='campaign';G.players.forEach((p,pi)=>{p.pid=room.seats[pi].pid;p.name=room.seats[pi].name;});room.G=G;
  const yellow=G.wires.find(w=>w.o===0&&BB.kindOf(w)==='y'),tokens=C.availableInfoTokens(G,false),blue=G.wires.filter(w=>w.o!==0&&BB.kindOf(w)==='b'&&!w.info&&tokens.some(t=>t.value===w.v));const second=blue.find(w=>w.v!==blue[0].v);assert(second);const wrong=[yellow.id,blue[0].id,second.id];send(0,'失败三黄宣告',{a:'yellow-three-cut',ws:wrong});const missDecision=G.pending.id;
  let missReplies=0;while(G.pending){const who=G.pending.to;send(who,'失败回应'+missReplies,{a:'yellow-three-reply',id:missDecision});const revision=room.revision;send(who,'失败回应'+missReplies,{a:'yellow-three-reply',id:missDecision});assert.equal(room.revision,revision);missReplies++;}
  assert.equal(G.det,1);assert(G.wires.filter(w=>BB.kindOf(w)==='y').every(w=>!w.cut));assert.equal(G.wires[yellow.id].info,null);assert.equal(G.wires[blue[0].id].info.v,blue[0].v);assert.equal(G.wires[second.id].info.v,second.v);restart();assert.equal(G.det,1);assert(!G.officialState.yellowThree.complete);
 }}finally{fs.rmSync(dir,{recursive:true,force:true});}
 console.log('✓ 第48关2–5人权威：成功各回应暂停／重启／凭据重连、私人答案／观战只读、旧／冒用／重复拒绝；当前德文失败错线标记且一次罚格保存恢复通过');
}

// 机器人从允许视图回应；不同玩家尚未轮到时不能代答。
{const Bot=require('../js/bot');for(const n of [2,3,4,5]){const G=game(n);setup(G);const ids=G.wires.filter(w=>BB.kindOf(w)==='y').map(w=>w.id);act(G,0,{a:'yellow-three-cut',ws:ids});while(G.pending){const who=G.pending.to,action=Bot.decide(G,who),hidden=JSON.parse(JSON.stringify(G));hidden.wires.forEach(w=>{if(w.o!==who&&!w.cut)w.v=1.5;});assert.deepEqual(Bot.decide(hidden,who),action);assert.deepEqual(action,{a:'yellow-three-reply',id:G.pending.id});act(G,who,action);}assert(G.officialState.yellowThree.complete);assert.equal(G.det,0);assert.equal(BB.seqAllowed(BB.view(G,0),'Y'),false);}}
console.log('✓ 第48关2–5人机器人仅从本人允许视图完成三黄回应；公开视图禁止普通黄拆');
// 实际来源发牌的后段选择，保持总量与线架；并非完整机器人通关证明。
{const Bot=require('../js/bot');for(const n of [2,3,4,5]){const G=game(n);setup(G);G.wires.forEach(w=>{if(BB.kindOf(w)!=='y'){w.cut=true;w.info=null;}});const actor=G.turn,action=Bot.decide(G,actor),hidden=JSON.parse(JSON.stringify(G));hidden.wires.forEach(w=>{if(w.o!==actor&&!w.cut)w.v=12;});assert.equal(action.a,'yellow-three-cut');assert.equal(action.ws.length,3);assert.deepEqual(Bot.decide(hidden,actor),action);act(G,actor,action);while(G.pending)act(G,G.pending.to,Bot.decide(G,G.pending.to));assert.equal(G.phase,'won');assert.equal(G.det,0);}}
console.log('✓ 第48关2–5人来源后段机器人主动选择三黄并回应获胜；更换队友隐藏值不改变选择');
{
 const Bot=require('../js/bot'),originalRandom=Math.random,roles=Object.keys(BB.CHARACTERS),totals={won:0,lost:0};
 try{for(let n=2;n<=5;n++)for(let rotation=0;rotation<roles.length;rotation++)for(let seed=1;seed<=2;seed++){
  Math.random=rng((rotation+1)*100003+seed*104729+n);const captain=seed%n,seats=Array.from({length:n},(_,pi)=>({pid:'p'+pi,name:'三黄角色机器人'+pi,bot:true,character:pi===captain?'double-detector':roles[(rotation+pi)%roles.length]}));
  const G=BB.createGame(M.get('official-development',48),seats,{captain,rng:Math.random});let steps=0;
  while(!['won','lost'].includes(G.phase)&&steps<600){let acted=false;for(let pi=0;pi<n;pi++){const a=Bot.decide(G,pi);if(!a)continue;act(G,pi,a);steps++;acted=true;break;}assert(acted||['won','lost'].includes(G.phase),'第48关机器人不能停止合法回合或私人回应');}
  assert(['won','lost'].includes(G.phase));totals[G.phase]++;
 }}finally{Math.random=originalRandom;}
 console.log('✓ 第48关2–5人五种角色40局：'+totals.won+'胜、'+totals.lost+'败，拒绝动作／停住／超限为0；不能据此认证规则与策略充分性');
}
{
 const fs=require('fs'),os=require('os'),path=require('path'),Service=require('../server/official'),dir=fs.mkdtempSync(path.join(os.tmpdir(),'bb48-legacy-'));
 try{for(const n of [2,3,4,5]){
  const seats=Array.from({length:n},(_,i)=>({pid:'p'+i,name:'旧三黄任务玩家'+i,credential:'旧任务凭证'+i,bot:false})),mission=JSON.parse(JSON.stringify(M.get('custom',48)));mission.catalog='campaign';mission.contentVersion=17;
  const G=BB.createGame(mission,seats,{rng:rng(n*104729)});G.catalog='campaign';G.contentVersion=17;const name='bb-legacy48-'+n,before=JSON.stringify(G.mission);
  fs.writeFileSync(path.join(dir,name+'.json'),JSON.stringify({version:1,name,host:seats[0].pid,mid:48,ruleset:'campaign',attempts:1,started:true,seats,observers:[],revision:0,seen:[],G}));
  const restored=Service({clients:new Set()},dir).load(name).G;assert.equal(JSON.stringify(restored.mission),before);assert.equal(restored.contentVersion,17);assert(!restored.officialState);assert.equal(restored.ruleset,'custom');assert.deepEqual(restored.ymark,G.ymark);assert.deepEqual(restored.rmark,G.rmark);assert.equal(restored.detMax,G.detMax);assert.equal(BB.view(restored,0).official,null);
 }}finally{fs.rmSync(dir,{recursive:true,force:true});}
 console.log('✓ 第48关2–5人旧版本17改编存档保留原任务、红黄设置与引爆器，不追加三黄特殊行动');
}
