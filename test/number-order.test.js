const assert=require('assert'),BB=require('../js/engine'),M=require('../js/missions');
function rng(s){return()=>((s=(Math.imul(s,1664525)+1013904223)>>>0)/4294967296);}
function game(n=3,cap=0,seed=1){return BB.createGame(M.get('official-development',51),Array.from({length:n},(_,i)=>({pid:'p'+i,name:'命令玩家'+i})),{captain:cap,rng:rng(seed)});}
function act(G,pi,a){assert.equal(BB.act(G,pi,a),null,JSON.stringify(a));}
function reject(G,pi,a){const before=JSON.stringify(G);assert(BB.act(G,pi,a));assert.equal(JSON.stringify(G),before);}
function setup(G){while(G.phase==='setup'){const pi=BB.setupActor(G);act(G,pi,{a:'info',w:G.wires.find(w=>w.o===pi&&BB.setupInfoAllowed(G,w)).id});}}
function rig(hands,leader=0){const G=game(hands.length,leader);setup(G);G.wires=[];G.players.forEach(p=>p.stands=p.stands.map(()=>[]));hands.forEach((hand,o)=>hand.forEach(v=>{const id=G.wires.length;G.wires.push({id,v,o,s:0,cut:false,info:null});G.players[o].stands[0].push(id);}));G.equip=[];return G;}
function draw(G,value){const s=BB.numberOrder(G);if(value!==undefined){s.deck=[value];s.discard=[];}act(G,s.controller,{a:'order-draw',id:s.decisionId});}
function assign(G,owner){const s=BB.numberOrder(G);act(G,s.controller,{a:'order-assign',id:s.decisionId,p:owner});}
function answer(G){act(G,G.pending.to,{a:'order-answer',id:G.pending.id});}
function replies(G){while(G.pending){const pd=G.pending;act(G,pd.to,{a:'resolve',id:pd.id,w:BB.view(G,pd.to).pending.choices.at(-1)});}}
for(const n of [2,3,4,5])for(let cap=0;cap<n;cap++)for(let seed=1;seed<=8;seed++){
 const G=game(n,cap,seed*104729);assert.equal(G.wires.length,n===2?50:49);assert.equal(G.rmark.n,n===2?2:1);assert.equal(G.rmark.cand.length,n===2?2:1);assert.equal(G.ymark.n,0);assert.equal(G.det,-1);assert.equal(G.detMax,n);assert(G.detMin<=G.det);assert(G.equip.every(e=>e.n!==10));assert.equal(G.equip.length,n);assert(!BB.characterOptions(G.mission,(cap+1)%n,cap).includes('xy-ray'));setup(G);assert.equal(G.setup[cap],n===2?0:1);assert.equal(G.turn,cap);for(let pi=-1;pi<n;pi++){const s=BB.view(G,pi).official.numberOrder;assert.equal(s.remaining,12);assert(!('deck' in s));assert.equal(s.controller,cap);assert.equal(s.step,'draw');}
}
console.log('✓ 第51关2–5人全部队长：49／50根、已知红1／2，无黄，起点－1与第人数＋1次失误界限、12张隐藏牌、禁X/Y、双人队长无初始标记');
{
 const G=rig([[3,4],[3,5],[6,7]]);reject(G,0,{a:'dual',w:2,val:3});draw(G,3);const s=BB.numberOrder(G);reject(G,1,{a:'order-assign',id:s.decisionId,p:1});assign(G,0);assert.equal(G.pending.to,0);reject(G,0,{a:'dual',w:2,val:3});reject(G,1,{a:'order-answer',id:G.pending.id});reject(G,0,{a:'order-answer',id:G.pending.id-1});answer(G);assert.equal(BB.numberOrder(G).step,'cut');reject(G,0,{a:'dual',w:2,val:4});act(G,0,{a:'dual',w:2,val:3});replies(G);assert.equal(G.turn,1);assert.equal(BB.numberOrder(G).controller,1);assert.equal(G.det,-1);
}
{
 const G=rig([[4],[3,5],[3,6]]);draw(G,3);assign(G,2);answer(G);act(G,2,{a:'dual',w:1,val:3});const saved=JSON.parse(JSON.stringify(G));replies(G);replies(saved);assert.equal(G.turn,1);assert.equal(saved.turn,1);assert.equal(BB.numberOrder(G).controller,1);assert.equal(G.turnNo,2);
 const missing=rig([[4],[5,6],[3]]);draw(missing,3);assign(missing,1);answer(missing);assert.equal(missing.pending.type,'order-clue');for(let pi=-1;pi<3;pi++)assert.equal('choices' in BB.view(missing,pi).pending,pi===1);reject(missing,0,{a:'order-clue',id:missing.pending.id,w:0});reject(missing,1,{a:'order-clue',id:missing.pending.id,w:3});act(missing,1,{a:'order-clue',id:missing.pending.id,w:1});assert.equal(missing.wires[1].info.v,5);assert.equal(missing.det,0);assert.equal(missing.turn,1);
}
{
 const G=rig([[3,4],[1.5],[3]]);draw(G,3);G.stab=true;assign(G,1);assert.equal(G.phase,'lost');assert.equal(G.det,-1);assert(G.result.why.includes('FAQ'));
 const red=rig([[1.5],[3,3,3,3],[4]]);const deck=BB.numberOrder(red).deck.slice();reject(red,0,{a:'order-draw',id:BB.numberOrder(red).decisionId});act(red,0,{a:'red'});assert.deepEqual(BB.numberOrder(red).deck,deck);assert.equal(red.turn,1);assert.equal(red.det,-1);
 const solo=rig([[4],[3,3,3,3],[5]]);draw(solo,3);assign(solo,1);answer(solo);act(solo,1,{a:'solo',val:3});assert(BB.numberOrder(solo).retired.includes(3));assert(!BB.numberOrder(solo).deck.includes(3));assert(!BB.numberOrder(solo).discard.includes(3));assert.equal(solo.turn,2);
}
{
 const G=rig([[1],[2],[3]]);for(let i=0;i<4;i++){const leader=G.turn,owner=(leader+1)%3,value=(owner+1)%3+1;draw(G,value);assign(G,owner);answer(G);assert.equal(G.pending.type,'order-clue');act(G,owner,{a:'order-clue',id:G.pending.id,w:G.wires.find(w=>w.o===owner).id});}assert.equal(G.phase,'lost');assert.equal(G.det,3);
}
assert(!M.get('campaign',51).verified);
console.log('✓ 第51关独立指定自己／别人、遵命回应、双方私有选线、原长官左邻继续、缺值私有标记／一次罚格、红线独留指定按FAQ立即爆炸与红线长官不翻牌、数字退场／精确引爆通过；咖啡杯例外待核');
{
 const fs=require('fs'),os=require('os'),path=require('path'),Service=require('../server/official'),dir=fs.mkdtempSync(path.join(os.tmpdir(),'bb51-legacy-'));
 try{for(const n of [2,3,4,5]){
  const seats=Array.from({length:n},(_,i)=>({pid:'p'+i,name:'旧黑海任务'+i,credential:'旧黑海凭证'+i,bot:false})),mission=JSON.parse(JSON.stringify(M.get('custom',51)));mission.catalog='campaign';mission.contentVersion=17;
  const G=BB.createGame(mission,seats,{rng:rng(n*104729)});G.catalog='campaign';G.contentVersion=17;const name='bb-legacy51-'+n,before=JSON.stringify(G.mission);
  fs.writeFileSync(path.join(dir,name+'.json'),JSON.stringify({version:1,name,host:seats[0].pid,mid:51,ruleset:'campaign',attempts:1,started:true,seats,observers:[],revision:0,seen:[],G}));
  const restored=Service({clients:new Set()},dir).load(name).G;assert.equal(JSON.stringify(restored.mission),before);assert.equal(restored.contentVersion,17);assert(!restored.officialState);assert.equal(restored.ruleset,'custom');assert.deepEqual(restored.ymark,G.ymark);assert.deepEqual(restored.rmark,G.rmark);assert.equal(restored.detMax,G.detMax);assert.equal(BB.view(restored,0).official,null);assert(!BB.numberOrder(restored));
 }}finally{fs.rmSync(dir,{recursive:true,force:true});}
 console.log('✓ 第51关2–5人版本17改编存档保留原任务、红黄设置和引爆器，不追加命令规则');
}

{
 const G=rig([[5],[6],[7]]),s=BB.numberOrder(G);s.deck=[];s.discard=[5,6];s.retired=[1];draw(G);assert([5,6].includes(s.value));assert.equal(s.deck.length,1);assert.deepEqual(s.retired,[1]);assert.deepEqual([...s.deck,...s.discard].sort((a,b)=>a-b),[5,6]);
}
console.log('✓ 第51关空牌堆仅洗回仍在游戏中的数字；旧版本17改编存档保留原计时规则，不追加命令机制');
{
 const fs=require('fs'),os=require('os'),path=require('path'),Service=require('../server/official'),dir=fs.mkdtempSync(path.join(os.tmpdir(),'bb51-authority-'));
 function peer(room){return {room,readyState:1,messages:[],send(raw){this.messages.push(JSON.parse(raw));}};}
 function last(ws,topic){return ws.messages.filter(m=>m.topic===topic).at(-1)?.data;}
 try{for(const n of [2,3,4,5]){
  let G,owner,value;
  for(let seed=1;seed<1000;seed++){G=game(n,0,seed*104729);value=BB.numberOrder(G).deck[0];owner=G.players.findIndex((_,pi)=>pi!==0&&G.wires.filter(w=>w.o===pi&&w.v===value).length===2);if(owner>=0)break;}
  assert(owner>=0);setup(G);G.catalog=G.mission.catalog='campaign';const name='bb-number-order'+n,seats=G.players.map(p=>({pid:p.pid,name:p.name,bot:false,credential:'命令凭据'+p.pid})),wss={clients:new Set()};
  fs.writeFileSync(path.join(dir,name+'.json'),JSON.stringify({version:1,name,host:seats[0].pid,mid:51,ruleset:'campaign',attempts:1,started:true,seats,observers:[],revision:0,seen:[],G}));let service=Service(wss,dir),room,peers,observer,observerCredential;
  function connect(){peers=seats.map(s=>{const ws=peer(name);wss.clients.add(ws);service.handle(ws,'hello',{credential:s.credential,name:s.name});return ws;});observer=peer(name);wss.clients.add(observer);service.handle(observer,'hello',observerCredential?{credential:observerCredential,name:'命令观众'}:{spectator:true,name:'命令观众'});observerCredential=last(observer,'official:welcome').credential;room=service.load(name);G=room.G;}
  function send(pi,id,a,revision=room.revision){service.handle(peers[pi],'official:act',{gid:G.gid,revision,commandId:id,pi:(pi+1)%n,action:a});}
  function restart(){wss.clients.forEach(ws=>ws.readyState=3);service=Service(wss,dir);connect();}
  function roundtrip(stage){const oldRevision=room.revision;service.handle(peers[0],'official:pause',{gid:G.gid,revision:room.revision,commandId:'暂停'+stage,paused:true});assert(G.paused);const snapshot=JSON.stringify(G);restart();assert.equal(JSON.stringify(G),snapshot);service.handle(peers[0],'official:pause',{gid:G.gid,revision:room.revision,commandId:'继续'+stage,paused:false});assert(!G.paused);const frozen=JSON.stringify(G);send(BB.numberOrder(G).controller,'旧修订'+stage,{a:'order-draw',id:BB.numberOrder(G).decisionId},oldRevision);assert.equal(JSON.stringify(G),frozen);}
  function unchanged(pi,id,a){const before=JSON.stringify(G);send(pi,id,a);assert.equal(JSON.stringify(G),before);}
  function acceptedOnce(pi,id,a){const before=room.revision;send(pi,id,a);assert.equal(room.revision,before+1);const snapshot=JSON.stringify(G);send(pi,id,a);assert.equal(room.revision,before+1);assert.equal(JSON.stringify(G),snapshot);}
  function viewsPrivate(){const pd=G.pending;peers.forEach((ws,pi)=>{const V=last(ws,'official:view').view;assert(!('deck' in V.official.numberOrder));if(pd)assert.equal('choices' in V.pending,pd.type!=='order-answer'&&pi===pd.to);});if(pd)service.handle(observer,'official:perspective',{pid:seats[pd.to].pid});const V=last(observer,'official:view').view;if(pd)assert(!('choices' in V.pending));const frozen=JSON.stringify(G);service.handle(observer,'official:act',{gid:G.gid,revision:room.revision,commandId:'观战尝试'+room.revision,action:{a:'order-draw',id:BB.numberOrder(G).decisionId}});assert.equal(JSON.stringify(G),frozen);}
  connect();roundtrip('翻牌前');unchanged(1,'冒用翻牌',{a:'order-draw',id:BB.numberOrder(G).decisionId});acceptedOnce(0,'翻牌',{a:'order-draw',id:BB.numberOrder(G).decisionId});assert.equal(BB.numberOrder(G).value,value);assert.equal(BB.numberOrder(G).remaining,undefined);roundtrip('指定前');viewsPrivate();unchanged(1,'冒用指定',{a:'order-assign',id:BB.numberOrder(G).decisionId,p:owner});acceptedOnce(0,'指定',{a:'order-assign',id:BB.numberOrder(G).decisionId,p:owner});assert.equal(G.pending.to,owner);
  roundtrip('遵命回应');viewsPrivate();const answerId=G.pending.id;unchanged((owner+1)%n,'冒用回应',{a:'order-answer',id:answerId});unchanged(owner,'过期回应',{a:'order-answer',id:answerId-1});acceptedOnce(owner,'回应',{a:'order-answer',id:answerId});
  const target=G.wires.find(w=>w.o!==owner&&w.v===value);acceptedOnce(owner,'双拆宣告',{a:'dual',w:target.id,val:value});let responses=0,selected;
  while(G.pending){const who=G.pending.to,id=G.pending.id,pendingBefore=JSON.parse(JSON.stringify(G.pending));roundtrip('选线'+responses);viewsPrivate();assert.deepEqual(G.pending,pendingBefore);unchanged((who+1)%n,'冒用选线'+responses,{a:'resolve',id,w:target.id});unchanged(who,'旧编号选线'+responses,{a:'resolve',id:id-1,w:target.id});const V=last(peers[who],'official:view').view;if(V.pending.step==='own'){assert.equal(V.pending.choices.length,2);selected=V.pending.choices.at(-1);}acceptedOnce(who,'选线'+responses,{a:'resolve',id,w:V.pending.step==='own'?selected:target.id});responses++;}
  assert.equal(responses,2);assert(G.wires[selected].cut);assert(G.wires[target.id].cut);assert.equal(G.det,-1);assert.equal(G.turn,1);assert.equal(BB.numberOrder(G).controller,1);restart();assert.equal(G.turn,1);assert.equal(G.det,-1);
  // 来源设置的缺值场景：寻找下一长官抽到数字不在某名蓝线玩家手中，直接保留真实牌堆。
  let missingGame,missingOwner,missingValue;
  for(let seed=1;seed<1000;seed++){missingGame=game(n,0,seed*6907);missingValue=BB.numberOrder(missingGame).deck[0];missingOwner=missingGame.players.findIndex((_,pi)=>pi!==0&&!missingGame.wires.some(w=>w.o===pi&&w.v===missingValue)&&missingGame.wires.some(w=>w.o===pi&&Number.isInteger(w.v)));if(missingOwner>=0)break;}
  assert(missingOwner>=0);setup(missingGame);missingGame.catalog=missingGame.mission.catalog='campaign';room.G=G=missingGame;acceptedOnce(0,'缺值翻牌',{a:'order-draw',id:BB.numberOrder(G).decisionId});acceptedOnce(0,'缺值指定',{a:'order-assign',id:BB.numberOrder(G).decisionId,p:missingOwner});acceptedOnce(missingOwner,'缺值回应',{a:'order-answer',id:G.pending.id});assert.equal(G.pending.type,'order-clue');roundtrip('缺值标记');viewsPrivate();const clueId=G.pending.id,chosen=last(peers[missingOwner],'official:view').view.pending.choices[0];unchanged((missingOwner+1)%n,'冒用缺值',{a:'order-clue',id:clueId,w:chosen});unchanged(missingOwner,'旧缺值',{a:'order-clue',id:clueId-1,w:chosen});acceptedOnce(missingOwner,'缺值标记',{a:'order-clue',id:clueId,w:chosen});assert.equal(G.det,0);assert.equal(G.turn,1);assert.equal(G.pending,null);restart();assert.equal(G.det,0);assert.equal(G.turn,1);
 }}finally{fs.rmSync(dir,{recursive:true,force:true});}
 console.log('✓ 第51关2–5人权威来源设置：翻牌／指定／回应／双方选线／缺值标记各阶段暂停、重启、凭据重连、防冒用／过期／重复；私有选线与观战只读、重复手牌自选、原长官顺序和缺值仅罚一格');
}
{
 const Bot=require('../js/bot'),self=rig([[3,4],[3,5],[6]]);draw(self,3);assert.deepEqual(Bot.decide(self,0),{a:'order-assign',id:BB.numberOrder(self).decisionId,p:0});assign(self,0);assert.deepEqual(Bot.decide(self,0),{a:'order-answer',id:self.pending.id});answer(self);assert.equal(Bot.decide(self,0).val,3);
 const missing=rig([[4],[5,6],[3]]);draw(missing,3);assign(missing,1);act(missing,1,Bot.decide(missing,1));const choice=Bot.decide(missing,1);assert.equal(choice.a,'order-clue');act(missing,1,choice);assert.equal(missing.det,0);assert.equal(missing.turn,1);
 let G;for(let seed=1;seed<100;seed++){G=game(3,0,seed*104729);if(!G.wires.some(w=>w.o===0&&w.v===BB.numberOrder(G).deck[0]))break;}assert(!G.wires.some(w=>w.o===0&&w.v===BB.numberOrder(G).deck[0]));setup(G);draw(G);const controller=BB.numberOrder(G).controller,changed=JSON.parse(JSON.stringify(G));changed.wires.forEach(w=>{if(w.o!==controller&&!w.cut&&!w.info)w.v=12;});const originalRandom=Math.random;let a,b;try{Math.random=rng(999);a=Bot.orderAssignment(G,controller);Math.random=rng(999);b=Bot.orderAssignment(changed,controller);}finally{Math.random=originalRandom;}assert.equal(a,b);
 const red=rig([[1.5],[3],[4]]);assert.deepEqual(Bot.decide(red,0),{a:'red'});act(red,0,Bot.decide(red,0));assert.equal(red.det,-1);
}
console.log('✓ 第51关机器人按自己的手牌优先指定自己，否则仅据公开线索／推理；未知线值变更不影响指定，遵命／缺值标记与红线长官合法');
{
 const Bot=require('../js/bot'),originalRandom=Math.random,roles=Object.keys(BB.CHARACTERS).filter(id=>id!=='xy-ray'),totals={won:0,lost:0};let declarations=0,penalties=0;
 try{for(const n of [2,3,4,5])for(let rotation=0;rotation<roles.length;rotation++)for(let seed=1;seed<=2;seed++){
  Math.random=rng((rotation+1)*100003+seed*104729+n);const captain=seed%n,seats=Array.from({length:n},(_,pi)=>({pid:'p'+pi,name:'命令角色机器人'+pi,bot:true,character:pi===captain?'double-detector':roles[(rotation+pi-(pi>captain?1:0))%roles.length]}));let G=BB.createGame(M.get('official-development',51),seats,{captain,rng:Math.random}),steps=0;
  while(!['won','lost'].includes(G.phase)&&steps<700){let acted=false;for(let pi=0;pi<n;pi++){const a=Bot.decide(G,pi);if(!a)continue;act(G,pi,a);if(a.a==='order-assign')declarations++;if(a.a==='order-clue')penalties++;steps++;acted=true;break;}assert(acted||['won','lost'].includes(G.phase),'第51关机器人不能停止合法命令或私人回应');if(steps%17===0)G=JSON.parse(JSON.stringify(G));}
  assert(['won','lost'].includes(G.phase));totals[G.phase]++;
 }}finally{Math.random=originalRandom;}
 console.log('✓ 第51关2–5人四种允许角色32局：'+totals.won+'胜、'+totals.lost+'败，'+declarations+'次指定、'+penalties+'次缺值标记；非法／停止／超限0与过程恢复；不认证规则例外或策略充分性');
}
