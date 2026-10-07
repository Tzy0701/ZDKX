const assert=require('assert'),BB=require('../js/engine'),M=require('../js/missions');
function rng(s){return()=>((s=(Math.imul(s,1664525)+1013904223)>>>0)/4294967296);}
function game(n=3,cap=0,seed=1){return BB.createGame(M.get('official-development',53),Array.from({length:n},(_,i)=>({pid:'p'+i,name:'压力机器人玩家'+i})),{captain:cap,rng:rng(seed)});}
function act(G,pi,a){assert.equal(BB.act(G,pi,a),null,JSON.stringify(a));}
function reject(G,pi,a){const before=JSON.stringify(G);assert(BB.act(G,pi,a));assert.equal(JSON.stringify(G),before);}
function setup(G){while(G.phase==='setup'){const pi=BB.setupActor(G);act(G,pi,{a:'info',w:G.wires.find(w=>w.o===pi&&BB.setupInfoAllowed(G,w)).id});}}
function rig(hands){const G=game(hands.length);setup(G);G.wires=[];G.players.forEach(p=>p.stands=p.stands.map(()=>[]));hands.forEach((hand,o)=>hand.forEach(v=>{const id=G.wires.length;G.wires.push({id,v,o,s:0,cut:false,info:null});G.players[o].stands[0].push(id);}));G.equip=[];return G;}
function reply(G){const pd=G.pending,V=BB.view(G,pd.to);act(G,pd.to,{a:'resolve',id:pd.id,w:V.pending.choices.at(-1)??null});}
function finish(G){while(G.pending)reply(G);}
for(const n of [2,3,4,5])for(let cap=0;cap<n;cap++)for(let seed=1;seed<=8;seed++){
 const G=game(n,cap,seed*104729);assert.equal(G.wires.length,n===2?51:50);assert.equal(G.rmark.n,n===2?3:2);assert.equal(G.rmark.cand.length,n===2?3:2);assert.equal(G.ymark.n,0);assert(G.equip.every(e=>![6,9].includes(e.n)));assert.equal(G.equip.length,n);assert.equal(BB.robotPressure(G).position,0);assert.equal(BB.robotPressure(G).limit,12);setup(G);assert(G.players.every((_,pi)=>G.setup[pi]===1));assert.equal(G.turn,cap);for(let pi=-1;pi<n;pi++){const s=BB.view(G,pi).official.robotPressure;assert.equal(s.dialUsed,false);assert.equal(s.position,0);assert(!('nextOutcome' in s));}
}
console.log('✓ 第53关2–5人全部队长：50／51根、已知红2／3无黄、正常初始、机器人从1之前起、禁倒带／稳定器、不公开未结算结果');
for(const [start,value,end] of [[0,1,1],[1,1,0],[3,3,2],[3,4,4],[11,11,10]]){
 const G=rig([[value,7],[value,8],[9]]);BB.robotPressure(G).position=start;act(G,0,{a:'dual',w:2,val:value});assert.equal(BB.robotPressure(G).position,start);reply(G);assert.equal(BB.robotPressure(G).position,start);const saved=JSON.parse(JSON.stringify(G));reply(G);reply(saved);assert.equal(BB.robotPressure(G).position,end);assert.equal(BB.robotPressure(saved).position,end);assert.equal(G.det,0);
 const solo=rig([[value,value,value,value],[7],[8]]);BB.robotPressure(solo).position=start;act(solo,0,{a:'solo',val:value});assert.equal(BB.robotPressure(solo).position,end);assert.equal(solo.det,0);
}
{
 const G=rig([[2,7],[3,8],[9]]);BB.robotPressure(G).position=9;act(G,0,{a:'dual',w:2,val:2});reply(G);assert.equal(BB.robotPressure(G).position,11);assert.equal(G.det,0);assert.equal(G.phase,'play');assert.equal(G.wires[2].info.v,3);assert(!BB.view(G,0).log.some(e=>e.t.includes('引爆器前进')));
 G.turn=0;act(G,0,{a:'dual',w:2,val:2});reply(G);assert.equal(BB.robotPressure(G).position,12);assert.equal(G.phase,'lost');assert.equal(G.det,0);
 const exact=rig([[2],[3],[4]]);BB.robotPressure(exact).position=10;act(exact,0,{a:'dual',w:1,val:2});reply(exact);assert.equal(BB.robotPressure(exact).position,12);assert.equal(exact.phase,'lost');
}
{
 const G=rig([[2,7],[2,8],[9]]);BB.robotPressure(G).position=11;act(G,0,{a:'dual',w:2,val:2});finish(G);assert.equal(BB.robotPressure(G).position,12);assert.equal(G.phase,'lost');
 const red=rig([[1.5],[2],[3]]);BB.robotPressure(red).position=7;act(red,0,{a:'red'});assert.equal(BB.robotPressure(red).position,7);assert.equal(red.det,0);
 const boom=rig([[2],[1.5],[3]]);act(boom,0,{a:'dual',w:1,val:2});reply(boom);assert.equal(boom.phase,'lost');assert.equal(BB.robotPressure(boom).position,0);
}
{
 const G=rig([[2,4],[4,6],[7]]);G.players[0].character={id:'xy-ray',used:false};G.players[0].dd=false;BB.robotPressure(G).position=4;act(G,0,{a:'dual',w:2,val:2,vals:[2,4],xy:true,xyPersonal:true});finish(G);assert.equal(BB.robotPressure(G).position,3);assert(G.players[0].character.used);
 for(let i=0;i<2;i++){const id=G.wires.length;G.wires.push({id,v:11,o:2,s:0,cut:true,info:null});G.players[2].stands[0].push(id);}G.equip.push({n:11,used:false});const position=BB.robotPressure(G).position;act(G,G.turn,{a:'equip',n:11,p:0});assert.equal(BB.robotPressure(G).position,position);assert.equal(G.turn,0);
 const ban=rig([[1,2],[1,3],[6,6,9,9]]);ban.wires.filter(w=>[6,9].includes(w.v)).forEach(w=>w.cut=true);ban.equip=[{n:6,used:false},{n:9,used:false}];reject(ban,0,{a:'equip',n:6});reject(ban,0,{a:'equip',n:9});reject(ban,0,{a:'dual',w:2,val:1,stab:true});
}
assert(!M.get('campaign',53).verified);
console.log('✓ 第53关当前德文到12分支：结算后普通成功＋1／匹配实际剪值－1／失败＋2且不动引爆器，私有步骤恢复不重算、四线单拆一次移动、到12与越过12败、红线仍爆炸；红线公开／咖啡杯不算剪线的解释待核');

{
 const G=game();setup(G);BB.robotPressure(G).position=12;G.paused=true;assert(BB.recoverFatalState(G));assert.equal(G.phase,'lost');assert.equal(G.paused,false);assert.equal(G.det,0);assert.equal(BB.recoverFatalState(G),false);
}
console.log('✓ 第53关达到12的异常未结算快照恢复为当前德文分支败局，解除暂停且只恢复一次，不改引爆器');
{
 const fs=require('fs'),os=require('os'),path=require('path'),Service=require('../server/official'),dir=fs.mkdtempSync(path.join(os.tmpdir(),'bb53-authority-'));
 function peer(room){return {room,readyState:1,messages:[],send(raw){this.messages.push(JSON.parse(raw));}};}
 function last(ws,topic){return ws.messages.filter(m=>m.topic===topic).at(-1)?.data;}
 try{for(const n of [2,3,4,5]){
  let G=game(n);setup(G);G.catalog=G.mission.catalog='campaign';const name='bb-robot-pressure'+n,seats=G.players.map(p=>({pid:p.pid,name:p.name,bot:false,credential:'压力凭据'+p.pid})),wss={clients:new Set()};
  fs.writeFileSync(path.join(dir,name+'.json'),JSON.stringify({version:1,name,host:seats[0].pid,mid:53,ruleset:'campaign',attempts:1,started:true,seats,observers:[],revision:0,seen:[],G}));let service=Service(wss,dir),room,peers,observer,observerCredential;
  function connect(){peers=seats.map(s=>{const ws=peer(name);wss.clients.add(ws);service.handle(ws,'hello',{credential:s.credential,name:s.name});return ws;});observer=peer(name);wss.clients.add(observer);service.handle(observer,'hello',observerCredential?{credential:observerCredential,name:'压力观众'}:{spectator:true,name:'压力观众'});observerCredential=last(observer,'official:welcome').credential;room=service.load(name);G=room.G;}
  function send(pi,id,a,revision=room.revision){service.handle(peers[pi],'official:act',{gid:G.gid,revision,commandId:id,pi:(pi+1)%n,action:a});}
  function unchanged(pi,id,a){const before=JSON.stringify(G);send(pi,id,a);assert.equal(JSON.stringify(G),before);}
  function acceptedOnce(pi,id,a){const before=room.revision;send(pi,id,a);assert.equal(room.revision,before+1);const frozen=JSON.stringify(G);send(pi,id,a);assert.equal(room.revision,before+1);assert.equal(JSON.stringify(G),frozen);}
  function restart(){wss.clients.forEach(ws=>ws.readyState=3);service=Service(wss,dir);connect();}
  function roundtrip(stage,who,a){const old=room.revision;service.handle(peers[0],'official:pause',{gid:G.gid,revision:room.revision,commandId:'暂停'+stage,paused:true});assert(G.paused);unchanged(who,'暂停响应'+stage,a);const frozen=JSON.stringify(G);restart();assert.equal(JSON.stringify(G),frozen);service.handle(peers[0],'official:pause',{gid:G.gid,revision:room.revision,commandId:'继续'+stage,paused:false});const before=JSON.stringify(G);send(who,'旧修订'+stage,a,old);assert.equal(JSON.stringify(G),before);}
  function privateViews(){peers.forEach((ws,pi)=>{const V=last(ws,'official:view').view;assert.equal(V.official.robotPressure.position,BB.robotPressure(G).position);assert.equal('choices' in V.pending,pi===G.pending.to);assert(!('nextOutcome' in V.official.robotPressure));});service.handle(observer,'official:perspective',{pid:seats[G.pending.to].pid});const V=last(observer,'official:view').view;assert(!('choices' in V.pending));}
  connect();const own=G.wires.find(w=>w.o===0&&Number.isInteger(w.v)&&G.wires.some(t=>t.o!==0&&t.v===w.v)),target=G.wires.find(w=>w.o!==0&&w.v===own.v);assert(own&&target);acceptedOnce(0,'压力宣告',{a:'dual',w:target.id,val:own.v});let responses=0;
  while(G.pending){const pd=G.pending,who=pd.to,V=last(peers[who],'official:view').view,a={a:'resolve',id:pd.id,w:V.pending.step==='own'?V.pending.choices.at(-1):target.id};assert.equal(BB.robotPressure(G).position,0);privateViews();roundtrip('压力选线'+responses,who,a);unchanged((who+1)%n,'冒用压力选线'+responses,a);unchanged(who,'旧压力编号'+responses,{...a,id:a.id-1});acceptedOnce(who,'压力选线'+responses,a);responses++;}assert.equal(responses,2);assert.equal(BB.robotPressure(G).position,1);assert.equal(G.det,0);restart();assert.equal(BB.robotPressure(G).position,1);
  // 同一来源手牌的安全失败；设定在临界轨道位置，以单独验证移动和恢复边界。
  const actor=G.turn,wire=G.wires.find(w=>w.o===actor&&!w.cut&&Number.isInteger(w.v)),wrong=G.wires.find(w=>w.o!==actor&&!w.cut&&Number.isInteger(w.v)&&w.v!==wire.v);assert(wire&&wrong);BB.robotPressure(G).position=9;acceptedOnce(actor,'压力失败宣告',{a:'dual',w:wrong.id,val:wire.v});const who=G.pending.to,id=G.pending.id;privateViews();roundtrip('失败回应',who,{a:'resolve',id,w:wrong.id});acceptedOnce(who,'压力失败回应',{a:'resolve',id,w:wrong.id});assert.equal(BB.robotPressure(G).position,11);assert.equal(G.det,0);assert.equal(G.phase,'play');restart();assert.equal(BB.robotPressure(G).position,11);assert.equal(G.det,0);
  // 验证异常快照的12终点只恢复一次，包含暂停及尚未回复的私有决定。
  BB.robotPressure(G).position=12;G.paused=true;G.pending={type:'cut',id:++G.actionId,from:G.turn,to:(G.turn+1)%n,step:'target',ids:[wrong.id],vals:[wire.v],label:'恢复终点'};service.handle(peers[0],'official:pause',{gid:G.gid,revision:room.revision,commandId:'保存临界快照',paused:true});const revision=room.revision;restart();assert.equal(G.phase,'lost');assert.equal(G.pending,null);assert.equal(G.paused,false);assert.equal(room.revision,revision+1);const recovered=room.revision;restart();assert.equal(room.revision,recovered);assert.equal(G.det,0);
 }}finally{fs.rmSync(dir,{recursive:true,force:true});}
 console.log('✓ 第53关2–5人权威：双方私有选线暂停／重连／重启、冒用／过期／旧修订／重复拒绝，完成成功只＋1／失败只＋2，轨道保存与到12异常快照只恢复一次，观战不收私有选择，引爆器不推进');
}
{
 const Bot=require('../js/bot'),G=rig([[3,4],[3,5],[4,5]]);BB.robotPressure(G).position=3;G.wires[2].info={t:'v',v:3};assert.deepEqual(Bot.decide(G,0),{a:'dual',w:2,val:3});const hidden=JSON.parse(JSON.stringify(G));hidden.wires.forEach(w=>{if(w.o!==0&&!w.cut&&!w.info)w.v=12;});assert.deepEqual(Bot.decide(hidden,0),Bot.decide(G,0));
 const late=rig([[1,1,11],[11,2],[3]]);BB.robotPressure(late).position=11;late.wires[3].info={t:'v',v:11};assert.deepEqual(Bot.decide(late,0),{a:'dual',w:3,val:11});
 const solo=rig([[3,3,3,3,1,1],[2],[4]]);BB.robotPressure(solo).position=3;assert.deepEqual(Bot.decide(solo,0),{a:'solo',val:3});
 const red=rig([[1.5],[2],[3]]);assert.deepEqual(Bot.decide(red,0),{a:'red'});
}
console.log('✓ 第53关机器人优先匹配当前数字／公开安全线及匹配单拆，临界不先选必爆普通单拆；未知线值替换不改公开匹配选择，红线正常公开');
{
 const Bot=require('../js/bot'),oldRandom=Math.random,roles=Object.keys(BB.CHARACTERS),totals={won:0,lost:0},equipment={};
 try{for(const n of [2,3,4,5])for(let rotation=0;rotation<roles.length;rotation++)for(let seed=1;seed<=2;seed++){
  Math.random=rng((rotation+1)*100003+seed*104729+n);const captain=seed%n,seats=Array.from({length:n},(_,pi)=>({pid:'p'+pi,name:'压力角色机器人'+pi,bot:true,character:pi===captain?'double-detector':roles[(rotation+pi-(pi>captain?1:0))%roles.length]}));let G=BB.createGame(M.get('official-development',53),seats,{captain,rng:Math.random}),steps=0;
  while(!['won','lost'].includes(G.phase)&&steps<700){let acted=false;for(let pi=0;pi<n;pi++){const a=Bot.decide(G,pi);if(!a)continue;act(G,pi,a);if(a.a==='equip'||a.a==='dd'||a.a==='character')equipment[a.a+':'+(a.n||'personal')]=(equipment[a.a+':'+(a.n||'personal')]||0)+1;steps++;acted=true;break;}assert(acted||['won','lost'].includes(G.phase),'机器人压力任务不能停止合法回合');assert.equal(G.det,0);if(steps%17===0)G=JSON.parse(JSON.stringify(G));}
  assert(['won','lost'].includes(G.phase));totals[G.phase]++;
 }}finally{Math.random=oldRandom;}
 console.log('✓ 第53关当前德文分支2–5人五角色40局：'+totals.won+'胜、'+totals.lost+'败，非法／停止／超限0、引爆器不动／过程恢复，装备'+JSON.stringify(equipment)+'；不认证策略充分性');
}
{
 const fs=require('fs'),os=require('os'),path=require('path'),Service=require('../server/official'),dir=fs.mkdtempSync(path.join(os.tmpdir(),'bb53-legacy-'));
 try{for(const n of [2,3,4,5]){
  const seats=Array.from({length:n},(_,i)=>({pid:'p'+i,name:'旧黑海任务'+i,credential:'旧黑海凭证'+i,bot:false})),mission=JSON.parse(JSON.stringify(M.get('custom',53)));mission.catalog='campaign';mission.contentVersion=17;
  const G=BB.createGame(mission,seats,{rng:rng(n*104729)});G.catalog='campaign';G.contentVersion=17;const name='bb-legacy53-'+n,before=JSON.stringify(G.mission);
  fs.writeFileSync(path.join(dir,name+'.json'),JSON.stringify({version:1,name,host:seats[0].pid,mid:53,ruleset:'campaign',attempts:1,started:true,seats,observers:[],revision:0,seen:[],G}));
  const restored=Service({clients:new Set()},dir).load(name).G;assert.equal(JSON.stringify(restored.mission),before);assert.equal(restored.contentVersion,17);assert(!restored.officialState);assert.equal(restored.ruleset,'custom');assert.deepEqual(restored.ymark,G.ymark);assert.deepEqual(restored.rmark,G.rmark);assert.equal(restored.detMax,G.detMax);assert.equal(BB.view(restored,0).official,null);assert(!BB.robotPressure(restored));
 }}finally{fs.rmSync(dir,{recursive:true,force:true});}
 console.log('✓ 第53关2–5人版本17改编存档保留原任务、红黄设置和引爆器，不追加机器人压力规则');
}

{
 const Bot=require('../js/bot'),G=rig([[2,4],[6,7],[2,4,6,7]]);for(let i=0;i<2;i++){const id=G.wires.length;G.wires.push({id,v:2,o:2,s:0,cut:true,info:null});G.players[2].stands[0].push(id);}G.equip=[{n:2,used:false}];BB.robotPressure(G).position=6;G.wires[2].info={t:'v',v:6};const a=Bot.decide(G,0);assert.deepEqual(a,{a:'equip',n:2,w:1,p:1});assert(!('val' in a));act(G,0,a);const reply=Bot.decide(G,1);assert.deepEqual(reply,{a:'walkie',id:G.pending.id,w:2});const hidden=JSON.parse(JSON.stringify(G));hidden.wires.forEach(w=>{if(w.o!==1&&!w.cut&&!w.info)w.v=12;});assert.deepEqual(Bot.decide(hidden,1),reply);act(G,1,reply);assert.equal(G.wires[2].o,0);assert.equal(G.wires[2].info.v,6);assert(G.equip[0].used);assert.equal(G.turn,0);assert.equal(BB.robotPressure(G).position,6);assert.equal(G.det,0);
}
console.log('✓ 第53关机器人对讲机仅按公开当前位置／推理交换，接收者本人持线响应，不索取数值；隐藏别人线值不改响应，交换和信息随线移动、不推进机器人或回合');
