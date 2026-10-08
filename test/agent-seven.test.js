const assert=require('assert'),BB=require('../js/engine'),M=require('../js/missions'),C=require('../js/campaign-rules'),Bot=require('../js/bot');
function rng(s){return()=>((s=(Math.imul(s,1664525)+1013904223)>>>0)/4294967296);}
function game(n=3,cap=0,seed=1){return BB.createGame(M.get('official-development',46),Array.from({length:n},(_,i)=>({pid:'p'+i,name:'许可玩家'+i})),{captain:cap,rng:rng(seed)});}
function act(G,pi,a){assert.equal(BB.act(G,pi,a),null,JSON.stringify(a));}
function reject(G,pi,a){const before=JSON.stringify(G);assert(BB.act(G,pi,a));assert.equal(JSON.stringify(G),before);}
function setup(G){while(G.phase==='setup'){const pi=BB.setupActor(G);act(G,pi,{a:'info',w:G.wires.find(w=>w.o===pi&&BB.setupInfoAllowed(G,w)).id});}}
function rig(hands){const G=game(hands.length);setup(G);G.wires=[];G.players.forEach(p=>p.stands=p.stands.map(()=>[]));hands.forEach((hand,o)=>hand.forEach(v=>{const id=G.wires.length;G.wires.push({id,v,o,s:0,cut:false,info:null});G.players[o].stands[0].push(id);}));G.equip=[];G.officialState.license.checkedTurn=null;C.modules['agent-seven'].enterTurn(G);return G;}
for(let n=2;n<=5;n++)for(let cap=0;cap<n;cap++)for(let seed=1;seed<=8;seed++){
 const G=game(n,cap,seed*104729);assert.equal(G.wires.length,52);assert.equal(G.rmark.n,0);assert.equal(G.ymark.n,4);assert.deepEqual(G.ymark.cand,[5.1,6.1,7.1,8.1]);assert.deepEqual(G.wires.filter(w=>BB.kindOf(w)==='y').map(w=>w.v).sort((a,b)=>a-b),[5.1,6.1,7.1,8.1]);assert(G.equip.every(e=>e.n!==7&&!e.hidden));assert.equal(G.equip.length,n);for(let v=1;v<=12;v++)assert.equal(G.wires.filter(w=>w.v===v).length,4);
 setup(G);assert.equal(G.setup[cap],n===2?0:1);assert(G.players.every((_,pi)=>G.setup[pi]===(n===2&&pi===cap?0:1)));for(let pi=-1;pi<n;pi++)assert.equal('licenseRequired'in BB.view(G,pi).official,pi===G.turn);
}
console.log('✓ 第46关2–5人全部队长：52根、固定四黄5.1／6.1／7.1／8.1、无红、排除电池、双人队长无初始线索；合法许可状态仅当前玩家接收');
{
 const G=rig([[7,2],[7],[7,7,5.1]]),ids=G.wires.filter(w=>w.v===7).map(w=>w.id);assert(!G.officialState.license.required);reject(G,0,{a:'precision-cut',ws:ids});reject(G,0,{a:'dual',w:2,val:7});reject(G,0,{a:'solo',val:7});
 act(G,0,{a:'dual',w:2,val:2});act(G,1,{a:'resolve',id:G.pending.id,w:2});assert.equal(G.phase,'play');assert.equal(G.det,1);assert.equal(G.wires[2].info.v,7);assert(G.wires.filter(w=>w.v===7).every(w=>!w.cut));assert(G.officialState.license.required);assert.equal(G.turn,1);
}
{
 const G=rig([[7,7],[7,2],[7,5.1]]),ids=G.wires.filter(w=>w.v===7).map(w=>w.id);G.players[0].stands[0]=[0];G.players[0].stands[1]=[1];G.wires[1].s=1;G.equip=[{n:5,used:false},{n:9,used:false}];assert(G.officialState.license.required);assert(!BB.stabilizerAllowed(G,0));reject(G,0,{a:'equip',n:9});reject(G,0,{a:'solo',val:7});reject(G,0,{a:'precision-cut',ws:ids,stab:true});
 act(G,0,{a:'precision-cut',ws:ids});const decision=G.pending.id;reject(G,(G.pending.to+1)%3,{a:'precision-reply',id:decision});const restored=JSON.parse(JSON.stringify(G));
 while(restored.pending){const pi=restored.pending.to;for(let p=-1;p<3;p++)assert.equal('ownAnswers'in BB.view(restored,p).pending,p===pi);act(restored,pi,{a:'precision-reply',id:decision});}
 assert(restored.officialState.precision.complete);assert(restored.wires.filter(w=>w.v===7).every(w=>w.cut));assert.equal(restored.det,0);assert.equal(restored.wires.find(w=>w.v===2).cut,false);assert.equal(restored.wires.find(w=>w.v===5.1).cut,false);assert(!BB.view(restored,1).equip.find(e=>e.n===5).open);
}
{
 const G=rig([[7],[7,2],[7,7,7.1]]),ids=G.wires.filter(w=>w.v===7).map(w=>w.id);ids[3]=G.wires.find(w=>w.v===7.1).id;act(G,0,{a:'precision-cut',ws:ids});while(G.phase==='play'&&G.pending)act(G,G.pending.to,{a:'precision-reply',id:G.pending.id});assert.equal(G.phase,'lost');assert(G.wires.filter(w=>w.v===7).every(w=>!w.cut));
}
assert(!M.get('campaign',46).verified);assert(!M.get('custom',46).officialModule);
{
 const fs=require('fs'),os=require('os'),path=require('path'),Service=require('../server/official'),dir=fs.mkdtempSync(path.join(os.tmpdir(),'bb46-legacy-'));
 try{for(let n=2;n<=5;n++){
  const seats=Array.from({length:n},(_,i)=>({pid:'p'+i,name:'旧许可玩家'+i,credential:'旧许可凭证'+i,bot:false})),mission=JSON.parse(JSON.stringify(M.get('custom',46)));mission.catalog='campaign';mission.contentVersion=17;
  const G=BB.createGame(mission,seats,{rng:rng(n*104729)});G.catalog='campaign';G.contentVersion=17;const name='bb-legacy46-'+n,before=JSON.stringify(G.mission);
  fs.writeFileSync(path.join(dir,name+'.json'),JSON.stringify({version:1,name,host:seats[0].pid,mid:46,ruleset:'campaign',attempts:1,started:true,seats,observers:[],revision:0,seen:[],G}));
  const restored=Service({clients:new Set()},dir).load(name).G;assert.equal(JSON.stringify(restored.mission),before);assert.equal(restored.contentVersion,17);assert.equal(restored.ruleset,'custom');assert(!restored.officialState);assert.deepEqual(restored.ymark,G.ymark);assert.deepEqual(restored.rmark,G.rmark);assert.equal(restored.detMax,G.detMax);assert.equal(BB.view(restored,0).official,null);
 }}finally{fs.rmSync(dir,{recursive:true,force:true});}
 console.log('✓ 第46关2–5人旧版本17改编存档保持原任务、黄红配置与引爆器，不添加固定黄或许可机制');
}
{
 const originalRandom=Math.random,roles=['triple-detector','xy-ray','general-radar','walkie-talkies'],totals={won:0,lost:0};
 try{for(let n=2;n<=5;n++)for(let rotation=0;rotation<4;rotation++)for(let seed=1;seed<=2;seed++){
  Math.random=rng((rotation+1)*100003+seed*104729+n);const captain=seed%n,seats=Array.from({length:n},(_,pi)=>({pid:'p'+pi,name:'许可机器人'+pi,bot:true,character:pi===captain?'double-detector':roles[(rotation+pi-(pi>captain?1:0))%4]}));
  const G=BB.createGame(M.get('official-development',46),seats,{captain,rng:Math.random});let steps=0;
  while(!['won','lost'].includes(G.phase)&&steps<700){let acted=false;for(let pi=0;pi<n;pi++){const a=Bot.decide(G,pi);if(!a)continue;act(G,pi,a);steps++;acted=true;break;}assert(acted||['won','lost'].includes(G.phase),'许可机器人不得停止合法阶段');}
  assert(steps<700,'许可机器人不得循环');assert(['won','lost'].includes(G.phase));totals[G.phase]++;
 }}finally{Math.random=originalRandom;}
 assert.equal(totals.won+totals.lost,32);console.log('✓ 第46关当前开发解释四类角色32局真实推理无非法动作、停住或循环：'+JSON.stringify(totals)+'；不裁定版本差异');
}
console.log('✓ 第46关本人回合开始仅剩7才许可、两架合并、其余导线未完成也可特殊拆、失败猜到7正常给线索、四线保存恢复与私有回应、选错立即爆炸、成功不提前解锁其他装备通过');
{
 const fs=require('fs'),os=require('os'),path=require('path'),Service=require('../server/official'),fixture=require('./agent-seven.fixture'),dir=fs.mkdtempSync(path.join(os.tmpdir(),'bb46-authority-')),wss={clients:new Set()};
 function peer(room){const ws={room,readyState:1,messages:[],send(raw){this.messages.push(JSON.parse(raw));}};wss.clients.add(ws);return ws;}
 const last=(ws,topic)=>ws.messages.filter(m=>m.topic===topic).at(-1)?.data;
 try{for(let n=2;n<=5;n++){
  let service=Service(wss,dir);const name='bb-license'+n,peers=Array.from({length:n},()=>peer(name));peers.forEach((ws,pi)=>service.handle(ws,pi?'hello':'official:hello',{ruleset:'campaign',mid:46,name:'许可联机'+pi}));let observer=peer(name);service.handle(observer,'hello',{spectator:true,name:'许可观众'});let room=service.load(name);service.handle(peers[0],'official:start',{mid:46,revision:room.revision,commandId:'开始'});
  let G=fixture(room.seats.map(s=>({pid:s.pid,name:s.name,bot:false})));room.G=G;G.catalog=G.mission.catalog='campaign';const actor=G.turn,ids=G.wires.filter(w=>!w.cut&&w.v===7).map(w=>w.id);assert.equal(G.wires.length,52);
  function send(pi,id,a){service.handle(peers[pi],'official:act',{gid:G.gid,revision:room.revision,commandId:id,pi:(pi+1)%n,action:a});}
  function pause(paused,id){service.handle(peers[0],'official:pause',{gid:G.gid,revision:room.revision,commandId:id,paused});assert.equal(G.paused,paused);}
  function restart(){const credentials=peers.map(ws=>last(ws,'official:welcome').credential),observerCredential=last(observer,'official:welcome').credential;peers.forEach(ws=>ws.readyState=3);observer.readyState=3;service=Service(wss,dir);room=service.load(name);G=room.G;for(let pi=0;pi<n;pi++){peers[pi]=peer(name);service.handle(peers[pi],'hello',{credential:credentials[pi],name:'许可联机'+pi});}observer=peer(name);service.handle(observer,'hello',{credential:observerCredential,name:'许可观众'});}
  const frozen=JSON.stringify(G);send((actor+1)%n,'冒用许可',{a:'precision-cut',ws:ids});assert.equal(JSON.stringify(G),frozen);send(actor,'启动许可',{a:'precision-cut',ws:ids});const decision=G.pending.id;
  const started=room.revision;send(actor,'启动许可',{a:'precision-cut',ws:ids});assert.equal(room.revision,started);
  let replies=0;while(G.pending){
   const who=G.pending.to;peers.forEach((ws,pi)=>{const V=last(ws,'official:view').view;assert.equal('ownAnswers'in V.pending,pi===who);assert.equal('licenseRequired'in V.official,pi===actor);});service.handle(observer,'official:perspective',{pid:room.seats[actor].pid});const V=last(observer,'official:view').view;assert(!('ownAnswers'in V.pending));assert(!('licenseRequired'in V.official));
   pause(true,'暂停回应'+replies);const pending=JSON.parse(JSON.stringify(G.pending)),before=JSON.stringify(G);send(who,'暂停内回应'+replies,{a:'precision-reply',id:decision});assert.equal(JSON.stringify(G),before);restart();assert.deepEqual(G.pending,pending);assert(G.paused);pause(false,'继续回应'+replies);
   const unchanged=JSON.stringify(G);send((who+1)%n,'冒用回应'+replies,{a:'precision-reply',id:decision});assert.equal(JSON.stringify(G),unchanged);send(who,'旧回应'+replies,{a:'precision-reply',id:decision-1});assert.equal(JSON.stringify(G),unchanged);
   send(who,'正确回应'+replies,{a:'precision-reply',id:decision});const revision=room.revision;send(who,'正确回应'+replies,{a:'precision-reply',id:decision});assert.equal(room.revision,revision);replies++;
  }
  assert(replies>=2);assert(G.officialState.precision.complete);assert(ids.every(id=>G.wires[id].cut));assert.equal(G.det,0);assert.equal(G.pending,null);restart();assert(G.officialState.precision.complete);assert(ids.every(id=>G.wires[id].cut));
 }}finally{fs.rmSync(dir,{recursive:true,force:true});}
 console.log('✓ 第46关2–5人来源合法许可阶段权威服务：每个回应暂停／重启／凭据重连、私有资格与答案、观战只读、冒用／旧回应拒绝、去重及完成恢复通过');
}
