const assert=require('assert'),BB=require('../js/engine'),M=require('../js/missions'),Bot=require('../js/bot');
function rng(s){return()=>((s=(Math.imul(s,1664525)+1013904223)>>>0)/4294967296);}
function game(n=3,cap=0,seed=1){return BB.createGame(M.get('official-development',45),Array.from({length:n},(_,i)=>({pid:'p'+i,name:'认领玩家'+i})),{captain:cap,rng:rng(seed)});}
function act(G,pi,a){assert.equal(BB.act(G,pi,a),null,JSON.stringify(a));}
function reject(G,pi,a,pattern){const before=JSON.stringify(G),error=BB.act(G,pi,a);assert(error);if(pattern)assert.match(error,pattern);assert.equal(JSON.stringify(G),before);}
function setup(G){while(G.phase==='setup'){const pi=BB.setupActor(G);act(G,pi,{a:'info',w:G.wires.find(w=>w.o===pi&&BB.setupInfoAllowed(G,w)).id});}}
function rig(hands,deck=[3,8]){const G=game(hands.length);setup(G);G.wires=[];G.players.forEach(p=>p.stands=p.stands.map(()=>[]));hands.forEach((hand,o)=>hand.forEach(v=>{const id=G.wires.length;G.wires.push({id,v,o,s:0,cut:false,info:null});G.players[o].stands[0].push(id);}));G.equip=[];const r=G.officialState.numberClaim;r.deck=deck;r.discard=[];r.retired=[];return G;}
function draw(G){act(G,G.captain,{a:'claim-draw',id:G.officialState.numberClaim.decisionId});}
for(let n=2;n<=5;n++)for(let cap=0;cap<n;cap++)for(let seed=1;seed<=8;seed++){
 const G=game(n,cap,seed*104729);assert.equal(G.wires.length,n===2?51:50);assert.equal(G.rmark.n,n===2?3:2);assert.equal(G.rmark.cand.length,n===2?3:2);assert.equal(G.ymark.n,0);assert(G.equip.every(e=>![10,11].includes(e.n)));assert.equal(G.equip.length,n);assert(!BB.characterOptions(G.mission,(cap+1)%n,cap).includes('xy-ray'));assert.equal(new Set(G.officialState.numberClaim.deck).size,12);
 setup(G);assert.equal(G.turn,cap);assert.equal(G.officialState.numberClaim.step,'draw');draw(G);assert.equal(G.officialState.numberClaim.step,'claim');for(let pi=-1;pi<n;pi++){const r=BB.view(G,pi).official.numberClaim;assert(!('deck'in r));assert(!('discard'in r));assert.equal(r.remaining,11);assert(!BB.ownTurnAllowed(BB.view(G,pi),pi));}
}
console.log('✓ 第45关2–5人全部队长设置：48蓝、双人3红／其余2红、12张隐藏数字、排除共享10／11及个人X/Y');
{
 const G=rig([[3],[3,3,8],[3,8]]);draw(G);const id=G.officialState.numberClaim.decisionId;reject(G,1,{a:'claim-draw',id});act(G,1,{a:'claim-number',id});assert.equal(G.turn,1);assert(BB.ownTurnAllowed(G,1));assert(BB.seqAllowed(BB.view(G,1),3));assert(!BB.seqAllowed(BB.view(G,1),8));reject(G,2,{a:'claim-number',id});reject(G,2,{a:'dual',w:1,val:3});reject(G,1,{a:'solo',val:8},/数字牌/);
 act(G,1,{a:'dual',w:0,val:3});const decision=G.pending.id;act(G,0,{a:'resolve',id:decision,w:0});assert.equal(BB.view(G,1).pending.choices.length,2);assert(!('choices'in BB.view(G,2).pending));act(G,1,{a:'resolve',id:decision,w:2});assert.equal(G.turn,0);assert.equal(G.officialState.numberClaim.step,'draw');assert.equal(G.officialState.numberClaim.retired.length,0);draw(G);assert.equal(G.officialState.numberClaim.value,8);
}
{
 const G=rig([[3],[8,9],[3,2]]);draw(G);const id=G.officialState.numberClaim.decisionId;reject(G,1,{a:'claim-assign',id,p:2});act(G,0,{a:'claim-assign',id,p:1});assert.equal(G.pending.type,'number-claim-clue');assert.equal(G.det,0);
 for(let pi=-1;pi<3;pi++)assert.equal('choices'in BB.view(G,pi).pending,pi===1);const copy=JSON.parse(JSON.stringify(G));reject(G,2,{a:'claim-clue',id:G.pending.id,w:1});act(copy,1,{a:'claim-clue',id:copy.pending.id,w:1});assert.equal(copy.wires[1].info.v,8);assert.equal(copy.det,1);assert.equal(copy.turn,0);assert.equal(copy.officialState.numberClaim.step,'draw');
}
{
 const G=rig([[3],[8],[3]]);draw(G);const id=G.officialState.numberClaim.decisionId;act(G,1,{a:'claim-number',id});assert.equal(G.det,1);assert.equal(G.officialState.numberClaim.step,'claim');assert.equal(G.officialState.numberClaim.actor,null);act(G,1,{a:'claim-penalty',id});assert.equal(G.det,2);act(G,1,{a:'claim-penalty',id});assert.equal(G.phase,'lost');
}
{
 const G=rig([[3],[1.5],[3]]);draw(G);act(G,1,{a:'claim-number',id:G.officialState.numberClaim.decisionId});act(G,1,{a:'red'});assert.equal(G.wires[1].cut,true);assert.equal(G.det,0);assert.equal(G.turn,0);
 const S=rig([[3,3,3,3],[8],[8]]);draw(S);act(S,0,{a:'claim-number',id:S.officialState.numberClaim.decisionId});act(S,0,{a:'solo',val:3});assert(S.officialState.numberClaim.retired.includes(3));assert(!S.officialState.numberClaim.discard.includes(3));draw(S);assert.equal(S.officialState.numberClaim.value,8);
}
assert(!M.get('campaign',45).verified);assert(!M.get('custom',45).officialModule);
{
 const fs=require('fs'),os=require('os'),path=require('path'),Service=require('../server/official'),dir=fs.mkdtempSync(path.join(os.tmpdir(),'bb45-legacy-'));
 try{for(let n=2;n<=5;n++){
  const seats=Array.from({length:n},(_,i)=>({pid:'p'+i,name:'旧认领任务玩家'+i,credential:'旧认领凭证'+i,bot:false}));const mission=JSON.parse(JSON.stringify(M.get('custom',45)));mission.catalog='campaign';mission.contentVersion=17;
  const G=BB.createGame(mission,seats,{rng:rng(n*104729)});G.catalog='campaign';G.contentVersion=17;const name='bb-legacy45-'+n,before=JSON.stringify(G.mission);
  fs.writeFileSync(path.join(dir,name+'.json'),JSON.stringify({version:1,name,host:seats[0].pid,mid:45,ruleset:'campaign',attempts:1,started:true,seats,observers:[],revision:0,seen:[],G}));
  const restored=Service({clients:new Set()},dir).load(name).G;assert.equal(JSON.stringify(restored.mission),before);assert.equal(restored.contentVersion,17);assert.equal(restored.ruleset,'custom');assert(!restored.officialState);assert(!BB.numberClaim(restored));assert.deepEqual(restored.ymark,G.ymark);assert.deepEqual(restored.rmark,G.rmark);assert.deepEqual(restored.seq,G.seq);assert.equal(restored.detMax,G.detMax);assert.equal(BB.view(restored,0).official,null);
 }}finally{fs.rmSync(dir,{recursive:true,force:true});}
 console.log('✓ 第45关2–5人旧版本17改编存档保留原任务、黄红设置、顺序规则及引爆器，不添加抢认流程');
}
console.log('✓ 第45关有效抢认仅首个成功、过期／冒充拒绝、正常私人双拆、队长指定缺值的私人标记恢复、处罚边界、红线认领、完成数字退场通过');
{
 const G=rig([[8],[3],[3,3,3,4]],[8,3]);G.wires.filter(w=>w.o===2&&w.v===3).slice(0,2).forEach(w=>w.info={t:'v',v:3});draw(G);act(G,0,{a:'claim-assign',id:G.officialState.numberClaim.decisionId,p:1});
 const restored=JSON.parse(JSON.stringify(G));act(restored,1,{a:'claim-clue',id:restored.pending.id,w:1});assert.equal(restored.wires[1].info,null);assert.equal(restored.wires.filter(w=>w.info&&w.info.v===3).length,2);assert.deepEqual(restored.announcement,{id:1,info:{t:'v',v:3}});assert.equal(restored.det,1);
 reject(restored,1,{a:'claim-draw',id:restored.officialState.numberClaim.decisionId});assert(restored.announcement);draw(restored);assert.equal(restored.announcement,null);
}
{
 const G=game();setup(G);const r=G.officialState.numberClaim;r.deck=[];r.discard=Array.from({length:12},(_,i)=>i+1);const before=r.discard.slice();draw(G);assert(before.includes(r.value));assert.equal(r.deck.length,11);assert.equal(r.discard.length,1);assert.equal(new Set(r.deck.concat(r.discard)).size,12);
 const H=game();setup(H);H.wires.filter(w=>Number.isInteger(w.v)).forEach(w=>{w.cut=true;w.info=null;});draw(H);assert.equal(H.officialState.numberClaim.value,null);assert.equal(H.officialState.numberClaim.retired.length,12);
 while(H.phase==='play'){const owner=H.wires.find(w=>!w.cut).o;act(H,owner,{a:'claim-number',id:H.officialState.numberClaim.decisionId});act(H,owner,{a:'red'});if(H.phase==='play')draw(H);}assert.equal(H.phase,'won');
}
console.log('✓ 第45关标记耗尽不复制第三枚、临时线索在拒绝后保留而下次接受后清除，空堆重洗不重复牌、全部蓝线退牌后红线收尾通过');
{
 const G=rig([[3,3],[3],[3,8]]);draw(G);act(G,0,{a:'claim-number',id:G.officialState.numberClaim.decisionId});act(G,0,{a:'dual',w:2,val:3});const pd=JSON.parse(JSON.stringify(G.pending)),id=G.officialState.numberClaim.decisionId;
 reject(G,2,{a:'claim-penalty',id:id-1});act(G,2,{a:'claim-penalty',id});assert.equal(G.det,1);assert.deepEqual(G.pending,pd);act(G,1,{a:'resolve',id:pd.id,w:2});act(G,0,{a:'resolve',id:pd.id,w:1});assert.equal(G.officialState.numberClaim.step,'draw');
 const fatal=rig([[3],[3],[8]]);draw(fatal);act(fatal,0,{a:'claim-number',id:fatal.officialState.numberClaim.decisionId});act(fatal,0,{a:'dual',w:1,val:3});const decision=fatal.pending.id;fatal.det=fatal.detMax-1;act(fatal,2,{a:'claim-penalty',id:fatal.officialState.numberClaim.decisionId});assert.equal(fatal.phase,'lost');assert.equal(fatal.pending,null);reject(fatal,1,{a:'resolve',id:decision,w:1});
 const clue=rig([[3],[8],[3]]);draw(clue);act(clue,0,{a:'claim-assign',id:clue.officialState.numberClaim.decisionId,p:1});const choice=clue.pending.id;act(clue,2,{a:'claim-penalty',id:clue.officialState.numberClaim.decisionId});assert.equal(clue.pending.id,choice);assert.equal(clue.det,1);act(clue,1,{a:'claim-clue',id:choice,w:1});assert.equal(clue.det,2);
}
console.log('✓ 第45关额外暗示报告可在私人回应／线索阶段记录，非致命时保留决定，致命时取消决定；过期报告和结束后回应不变');
{
 const G=rig([[3],[1.5,2.5],[3,8]]);const deck=G.officialState.numberClaim.deck.slice(),id=G.officialState.numberClaim.decisionId;
 reject(G,0,{a:'claim-number',id});assert.deepEqual(Bot.decide(G,1),{a:'claim-number',id});act(G,1,{a:'claim-number',id});assert.equal(G.turn,1);assert.deepEqual(G.officialState.numberClaim.deck,deck);act(G,1,{a:'red'});assert.equal(G.det,0);assert.equal(G.turn,G.captain);assert.equal(G.officialState.numberClaim.step,'draw');assert.deepEqual(G.officialState.numberClaim.deck,deck);draw(G);assert.equal(G.officialState.numberClaim.value,3);
}
console.log('✓ 第45关翻牌前仅剩红线者可认领公开，不抽取／弃置数字牌、无罚格；普通蓝线认领仍须先翻牌');
{
 const G=rig([[8],[3],[3]]);assert.deepEqual(Bot.decide(G,0),{a:'claim-draw',id:G.officialState.numberClaim.decisionId});assert.equal(Bot.decide(G,1),null);draw(G);
 assert.equal(Bot.decide(G,0),null);assert.equal(Bot.decide(G,1).a,'claim-number');assert.equal(Bot.decide(G,2).a,'claim-number');
 G.wires[1].info={t:'v',v:3};const assignment=Bot.claimAssignment(G,0);assert.equal(assignment.p,1);const altered=JSON.parse(JSON.stringify(G));altered.wires[2].v=9;assert.deepEqual(BB.view(G,0),BB.view(altered,0));assert.deepEqual(Bot.claimAssignment(G,0),Bot.claimAssignment(altered,0));
 act(G,0,{a:'claim-assign',id:G.officialState.numberClaim.decisionId,p:0});const choice=Bot.decide(G,0);assert.equal(choice.a,'claim-clue');act(G,0,choice);assert.equal(G.det,1);
}
{
 const originalRandom=Math.random,roles=['triple-detector','general-radar','walkie-talkies','double-detector'],totals={won:0,lost:0};
 try{for(let n=2;n<=5;n++)for(let rotation=0;rotation<4;rotation++)for(let seed=1;seed<=2;seed++){
  Math.random=rng((rotation+1)*100003+seed*104729+n);const captain=seed%n,seats=Array.from({length:n},(_,pi)=>({pid:'p'+pi,name:'认领机器人'+pi,bot:true,character:pi===captain?'double-detector':roles[(rotation+pi-(pi>captain?1:0))%4]}));
  const G=BB.createGame(M.get('official-development',45),seats,{captain,rng:Math.random});let steps=0;
  while(!['won','lost'].includes(G.phase)&&steps<700){let acted=false;for(let pi=0;pi<n;pi++){const a=Bot.decide(G,pi);if(!a)continue;act(G,pi,a);steps++;acted=true;break;}assert(acted||['won','lost'].includes(G.phase),'认领机器人不能停止合法阶段');}
  assert(steps<700,'认领机器人不能循环');assert(['won','lost'].includes(G.phase));totals[G.phase]++;
 }}finally{Math.random=originalRandom;}
 assert.equal(totals.won+totals.lost,32);console.log('✓ 第45关允许角色32局真实推理无非法动作、停住或循环：'+JSON.stringify(totals)+'；认领仅用本人手牌，队长指定仅用公开线索');
}
{
 const fs=require('fs'),os=require('os'),path=require('path'),Service=require('../server/official'),C=require('../js/campaign-rules'),dir=fs.mkdtempSync(path.join(os.tmpdir(),'bb45-authority-')),wss={clients:new Set()};
 const last=(ws,topic)=>ws.messages.filter(m=>m.topic===topic).at(-1)?.data;
 function peer(room){const ws={room,readyState:1,messages:[],send(raw){this.messages.push(JSON.parse(raw));}};wss.clients.add(ws);return ws;}
 try{for(let n=2;n<=5;n++){
  let service=Service(wss,dir);const name='bb-claim'+n,peers=Array.from({length:n},()=>peer(name));peers.forEach((ws,pi)=>service.handle(ws,pi?'hello':'official:hello',{ruleset:'campaign',mid:45,name:'认领联机'+pi}));let observer=peer(name);service.handle(observer,'hello',{spectator:true,name:'认领观众'});let room=service.load(name);
  service.handle(peers[0],'official:start',{mid:45,revision:room.revision,commandId:'开始'});
  let G,holders;for(let seed=1;seed<300;seed++){G=game(n,0,seed*104729);holders=[...new Set(G.wires.filter(w=>w.v===3).map(w=>w.o))];if(holders.length>=2)break;}assert(holders.length>=2);
  room.G=G;G.catalog=G.mission.catalog='campaign';G.players.forEach((p,pi)=>{p.pid=room.seats[pi].pid;p.name=room.seats[pi].name;});G.officialState.numberClaim.deck=[3,...G.officialState.numberClaim.deck.filter(v=>v!==3)];
  function race(){return G.officialState.numberClaim;}
  function send(pi,id,action,revision=room.revision){service.handle(peers[pi],'official:act',{gid:G.gid,revision,commandId:id,pi:(pi+1)%n,action});}
  function pause(paused,id){service.handle(peers[0],'official:pause',{gid:G.gid,revision:room.revision,commandId:id,paused});assert.equal(G.paused,paused);}
  function restart(){const credentials=peers.map(ws=>last(ws,'official:welcome').credential),observerCredential=last(observer,'official:welcome').credential;peers.forEach(ws=>ws.readyState=3);observer.readyState=3;service=Service(wss,dir);room=service.load(name);G=room.G;for(let pi=0;pi<n;pi++){peers[pi]=peer(name);service.handle(peers[pi],'hello',{credential:credentials[pi],name:'认领联机'+pi});}observer=peer(name);service.handle(observer,'hello',{credential:observerCredential,name:'认领观众'});}
  let k=0;while(G.phase==='setup'){const pi=BB.setupActor(G);send(pi,'初始'+k++,{a:'info',w:G.wires.find(w=>w.o===pi&&BB.setupInfoAllowed(G,w)).id});}
  send(0,'翻牌',{a:'claim-draw',id:race().decisionId});assert.equal(race().value,3);const id=race().decisionId,revision=room.revision,winner=holders[0],loser=holders[1];
  send(winner,'先认领',{a:'claim-number',id},revision);assert.equal(race().actor,winner);const accepted=room.revision,beforeLate=JSON.stringify(G);
  send(loser,'后认领',{a:'claim-number',id},revision);assert.equal(room.revision,accepted);assert.equal(JSON.stringify(G),beforeLate);send(loser,'旧决定认领',{a:'claim-number',id});assert.equal(JSON.stringify(G),beforeLate);assert.equal(G.det,0);
  pause(true,'暂停认领结果');const frozen=JSON.stringify(G);send(winner,'暂停拆线',{a:'dual',w:G.wires.find(w=>w.o!==winner&&w.v===3).id,val:3});assert.equal(JSON.stringify(G),frozen);restart();assert.equal(race().actor,winner);assert(G.paused);pause(false,'恢复认领结果');
  const restoredRevision=room.revision;send(winner,'先认领',{a:'claim-number',id});assert.equal(room.revision,restoredRevision);assert.equal(race().actor,winner);
  const target=G.wires.find(w=>w.o!==winner&&!w.cut&&w.v===3);send(winner,'开始双拆',{a:'dual',w:target.id,val:3});const cutId=G.pending.id;send(target.o,'确认目标',{a:'resolve',id:cutId,w:target.id});assert.equal(G.pending.step,'own');
  service.handle(observer,'official:perspective',{pid:room.seats[winner].pid});assert(!('choices'in last(observer,'official:view').view.pending));const own=BB.view(G,winner).pending.choices.at(-1);restart();assert.equal(G.pending.step,'own');assert.equal(G.pending.id,cutId);
  send(winner,'选择本人线',{a:'resolve',id:cutId,w:own});assert.equal(race().step,'draw');assert.equal(G.turn,G.captain);const afterOwn=room.revision;send(winner,'选择本人线',{a:'resolve',id:cutId,w:own});assert.equal(room.revision,afterOwn);
  let missing;for(const value of race().deck){const owner=G.players.findIndex((_,pi)=>G.wires.some(w=>w.o===pi&&!w.cut&&Number.isInteger(w.v))&&!G.wires.some(w=>w.o===pi&&!w.cut&&w.v===value));if(owner>=0){missing={owner,value};break;}}assert(missing);
  race().deck=[missing.value,...race().deck.filter(v=>v!==missing.value)];send(0,'翻缺值牌',{a:'claim-draw',id:race().decisionId});send(0,'指定缺值',{a:'claim-assign',id:race().decisionId,p:missing.owner});assert.equal(G.pending.type,'number-claim-clue');assert.equal(G.det,0);
  peers.forEach((ws,pi)=>{const V=last(ws,'official:view').view;assert.equal('choices'in V.pending,pi===missing.owner);assert(!('deck'in V.official.numberClaim));assert(!('discard'in V.official.numberClaim));});service.handle(observer,'official:perspective',{pid:room.seats[missing.owner].pid});assert(!('choices'in last(observer,'official:view').view.pending));
  const clueId=G.pending.id;pause(true,'暂停缺值标记');restart();assert(G.paused);assert.equal(G.pending.id,clueId);pause(false,'恢复缺值标记');
  const tokens=C.availableInfoTokens(G,false),wire=G.wires.find(w=>w.o===missing.owner&&!w.cut&&Number.isInteger(w.v)&&!w.info&&tokens.some(t=>t.value===w.v));assert(wire);const beforeClue=JSON.stringify(G);send((missing.owner+1)%n,'冒用标记',{a:'claim-clue',id:clueId,w:wire.id});assert.equal(JSON.stringify(G),beforeClue);send(missing.owner,'旧标记决定',{a:'claim-clue',id:clueId-1,w:wire.id});assert.equal(JSON.stringify(G),beforeClue);
  send(missing.owner,'放置缺值标记',{a:'claim-clue',id:clueId,w:wire.id});assert.equal(G.wires[wire.id].info.v,wire.v);assert.equal(G.det,1);assert.equal(race().step,'draw');const afterClue=room.revision;send(missing.owner,'放置缺值标记',{a:'claim-clue',id:clueId,w:wire.id});assert.equal(room.revision,afterClue);assert.equal(G.det,1);
 }}finally{fs.rmSync(dir,{recursive:true,force:true});}
 console.log('✓ 第45关2–5人权威服务：同修订双认领仅首个成功且后者不罚、暂停／重启／凭据重连／去重、私人选线与缺值标记恢复、观战只读、牌堆隐藏通过');
}
