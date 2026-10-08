const assert=require('assert'),BB=require('../js/engine'),M=require('../js/missions'),Bot=require('../js/bot');
function rng(s){return()=>((s=(Math.imul(s,1664525)+1013904223)>>>0)/4294967296);}
function game(n=3,captain=0,seed=1){return BB.createGame(M.get('official-development',44),Array.from({length:n},(_,i)=>({pid:'p'+i,name:'氧气玩家'+i})),{captain,rng:rng(seed)});}
function act(G,pi,a){assert.equal(BB.act(G,pi,a),null,JSON.stringify(a));}
function reject(G,pi,a){const before=JSON.stringify(G);assert(BB.act(G,pi,a));assert.equal(JSON.stringify(G),before);}
function setup(G){while(G.phase==='setup'){const pi=BB.setupActor(G);act(G,pi,{a:'info',w:G.wires.find(w=>w.o===pi&&BB.setupInfoAllowed(G,w)).id});}}
function rig(hands){const G=game();setup(G);G.wires=[];G.players.forEach(p=>p.stands=p.stands.map(()=>[]));hands.forEach((hand,o)=>hand.forEach(v=>{const id=G.wires.length;G.wires.push({id,v,o,s:0,cut:false,info:null});G.players[o].stands[0].push(id);}));G.equip=[];return G;}
function reply(G,w){act(G,G.pending.to,{a:'resolve',id:G.pending.id,w});}
for(let n=2;n<=5;n++)for(let captain=0;captain<n;captain++)for(let seed=1;seed<=8;seed++){
 const G=game(n,captain,seed*104729);assert.equal(G.wires.length,49);assert.equal(G.rmark.n,1);assert.equal(G.rmark.cand.length,3);assert.equal(G.ymark.n,0);assert(G.equip.every(e=>e.n!==10));assert.equal(G.equip.length,n);assert(G.mission.rules.noChat);
 assert(!BB.characterOptions(G.mission,(captain+1)%n,captain).includes('xy-ray'));for(let v=1;v<=12;v++)assert.equal(G.wires.filter(w=>w.v===v).length,4);
 setup(G);assert.equal(G.turn,captain);assert.equal(G.officialState.oxygen.available,n*2);for(let pi=-1;pi<n;pi++)assert.deepEqual(BB.view(G,pi).official.oxygen,{available:n*2,total:n*2,requests:Array(n).fill(false)});
}
console.log('✓ 第44关2–5人全部队长：49根、1／3红、无黄、人数×2共享氧气，排除共享与个人X/Y，正常初始蓝标记');
for(const value of [1,4,5,8,9,12]){
 const G=rig([[value,2],[value,3],[4]]),cost=Math.ceil(value/4),target=G.wires.find(w=>w.o===1&&w.v===value),own=G.wires.find(w=>w.o===0&&w.v===value);
 act(G,0,{a:'dual',w:target.id,val:value});assert.equal(G.officialState.oxygen.available,6-cost);const snapshot=JSON.parse(JSON.stringify(G));reply(G,target.id);assert.equal(G.officialState.oxygen.available,6-cost);reply(G,own.id);assert.equal(G.officialState.oxygen.available,6-cost);
 reply(snapshot,target.id);reply(snapshot,own.id);assert.equal(snapshot.officialState.oxygen.available,6-cost);
 const solo=rig([[value,value,value,value],[2],[3]]);act(solo,0,{a:'solo',val:value});assert.equal(solo.officialState.oxygen.available,6-cost);
}
console.log('✓ 第44关1／4／5／8／9／12边界、双拆与四根单拆每次按宣告值耗氧一次，私人回应与保存恢复不重复扣除');
{
 const G=rig([[9,2],[8,3],[4]]);G.officialState.oxygen.available=2;reject(G,0,{a:'dual',w:2,val:9});reject(G,0,{a:'solo',val:9});reject(G,0,{a:'dual',w:99,val:2});reject(G,1,{a:'dual',w:0,val:8});reject(G,0,{a:'dual',w:2,val:0});reject(G,0,{a:'dual',w:2,val:2,xy:true,vals:[2,9]});
 act(G,0,{a:'dual',w:2,val:2});reply(G,2);assert.equal(G.det,1);assert.equal(G.officialState.oxygen.available,1);
}
{
 const G=rig([[1,2],[1.5,3],[9,9]]);G.wires.filter(w=>w.v===9).forEach(w=>w.cut=true);G.equip=[{n:9,used:false}];act(G,0,{a:'dual',w:2,val:1,stab:true});assert(G.equip[0].used);reply(G,null);assert.equal(G.det,0);assert.equal(G.officialState.oxygen.available,5);
}
console.log('✓ 第44关错误目标／人数／值／氧气不足／禁用修饰拒绝后完全不变；安全猜错与稳定器保护失败仍耗氧');
{
 const G=rig([[1,2],[3,4],[5,6]]);G.officialState.oxygen.available=1;reject(G,1,{a:'oxygen-skip'});reject(G,0,{a:'oxygen-skip',stab:true});act(G,0,{a:'oxygen-skip'});assert.equal(G.det,1);assert.equal(G.turn,1);assert.equal(G.officialState.oxygen.available,1);assert.equal(G.stab,false);
 act(G,1,{a:'oxygen-skip'});assert.equal(G.det,2);assert.equal(G.turn,2);act(G,2,{a:'oxygen-skip'});assert.equal(G.phase,'lost');
 const refill=rig([[1],[2],[3]]);refill.turn=2;refill.officialState.oxygen.available=0;act(refill,2,{a:'oxygen-skip'});assert.equal(refill.turn,0);assert.equal(refill.officialState.oxygen.available,6);
 for(const inline of [false,true]){const safe=rig([[1],[2],[9,9]]);safe.wires.filter(w=>w.v===9).forEach(w=>w.cut=true);safe.equip=[{n:9,used:false}];safe.officialState.oxygen.available=0;if(!inline)act(safe,0,{a:'equip',n:9});act(safe,0,{a:'oxygen-skip',stab:inline});assert.equal(safe.det,0);assert(safe.equip[0].used);assert.equal(safe.stab,false);assert.equal(safe.officialState.oxygen.available,0);}
}
{
 const G=rig([[1],[2],[3]]);act(G,2,{a:'oxygen-signal'});assert.equal(G.turn,0);assert.equal(G.officialState.oxygen.requests[2],true);assert.equal(G.officialState.oxygen.available,6);
 act(G,0,{a:'dual',w:1,val:1});assert(G.officialState.oxygen.requests.every(x=>!x));reject(G,2,{a:'oxygen-signal'});
 const reds=rig([[1.5],[2],[3]]);reds.officialState.oxygen.available=0;act(reds,0,{a:'red'});assert.equal(reds.officialState.oxygen.available,0);
}
assert(!M.get('campaign',44).verified);assert(!M.get('custom',44).officialModule);
{
 const fs=require('fs'),os=require('os'),path=require('path'),Service=require('../server/official'),dir=fs.mkdtempSync(path.join(os.tmpdir(),'bb44-legacy-'));
 try{for(let n=2;n<=5;n++){
  const seats=Array.from({length:n},(_,i)=>({pid:'p'+i,name:'旧氧气任务玩家'+i,credential:'旧任务凭证'+i,bot:false}));
  const mission=JSON.parse(JSON.stringify(M.get('custom',44)));mission.catalog='campaign';mission.contentVersion=17;
  const G=BB.createGame(mission,seats,{rng:rng(n*104729)});G.catalog='campaign';G.contentVersion=17;const name='bb-legacy44-'+n,before=JSON.stringify(G.mission);
  fs.writeFileSync(path.join(dir,name+'.json'),JSON.stringify({version:1,name,host:seats[0].pid,mid:44,ruleset:'campaign',attempts:1,started:true,seats,observers:[],revision:0,seen:[],G}));
  const restored=Service({clients:new Set()},dir).load(name).G;assert.equal(JSON.stringify(restored.mission),before);assert.equal(restored.contentVersion,17);assert(!restored.officialState);assert.equal(restored.ruleset,'custom');assert.deepEqual(restored.ymark,G.ymark);assert.deepEqual(restored.rmark,G.rmark);assert.equal(restored.detMax,G.detMax);assert.equal(BB.view(restored,0).official,null);assert(!BB.oxygen(restored));
 }}finally{fs.rmSync(dir,{recursive:true,force:true});}
 console.log('✓ 第44关2–5人旧版本17改编存档保留原顺序引信、失败无信息、黄红设置与引爆器，不添加共享氧气规则');
}
console.log('✓ 第44关主动省氧跳过、发行商FAQ稳定器保护（预先使用或同步选择）、精确引爆界限、实际队长回合补满、拇指请求与公开红线不耗氧');
{
 const G=rig([[2],[1],[9,9]]);G.turn=1;G.officialState.oxygen.available=0;G.wires.filter(w=>w.v===9).forEach(w=>w.cut=true);G.equip=[{n:9,used:false}];
 const a=Bot.decide(G,1);assert.deepEqual(a,{a:'oxygen-skip',stab:true});act(G,1,a);assert.equal(G.det,0);assert(G.equip[0].used);assert.equal(G.turn,0);assert.equal(G.officialState.oxygen.available,6);
 const reds=rig([[1.5],[2],[3]]);reds.officialState.oxygen.available=0;assert.deepEqual(Bot.decide(reds,0),{a:'red'});
}
console.log('✓ 第44关机器人氧气不足时合法跳过并使用可用稳定器，零氧气红线仍公开，不重复提交无效拆线');
{
 const originalRandom=Math.random,roles=['triple-detector','general-radar','walkie-talkies','double-detector'],totals={won:0,lost:0};
 try{for(let n=2;n<=5;n++)for(let rotation=0;rotation<4;rotation++)for(let seed=1;seed<=2;seed++){
  Math.random=rng((rotation+1)*100003+seed*104729+n);const captain=seed%n;
  const seats=Array.from({length:n},(_,pi)=>({pid:'p'+pi,name:'氧气角色机器人'+pi,bot:true,character:pi===captain?'double-detector':roles[(rotation+pi-(pi>captain?1:0))%4]}));
  const G=BB.createGame(M.get('official-development',44),seats,{captain,rng:Math.random});let steps=0;
  while(!['won','lost'].includes(G.phase)&&steps<600){
   let acted=false;for(let pi=0;pi<n;pi++){const a=Bot.decide(G,pi);if(!a)continue;act(G,pi,a);steps++;acted=true;break;}
   assert(acted||['won','lost'].includes(G.phase),'第44关机器人不能停止合法回合或私人回应');
  }
  assert(steps<600,'第44关机器人不能循环');assert(['won','lost'].includes(G.phase));totals[G.phase]++;
 }}finally{Math.random=originalRandom;}
 assert.equal(totals.won+totals.lost,32);console.log('✓ 第44关2–5人允许角色32局真实推理无非法动作、停住或循环：'+JSON.stringify(totals)+'（仅合法性验收）');
}
{
 // 基础规则第7页：空手玩家被跳过且不再执行行动；44卡在实际队长回合开始补氧。
 const G=rig([[],[1,3],[1,3]]);G.turn=2;G.officialState.oxygen.available=3;
 const replenished=G.officialState.oxygen.replenishedTurn;act(G,2,{a:'dual',w:0,val:1});reply(G,0);reply(G,2);
 assert.equal(G.turn,1);assert.equal(G.officialState.oxygen.available,2);assert.equal(G.officialState.oxygen.replenishedTurn,replenished);
 act(G,1,{a:'dual',w:3,val:3});reply(G,3);reply(G,1);assert.equal(G.phase,'won');assert.equal(G.officialState.oxygen.available,1);
}
console.log('✓ 第44关按基础跳过规则处理空手队长：经过其座位不自动补氧；剩余氧气仍可合法收尾');
{
 const fs=require('fs'),os=require('os'),path=require('path'),Service=require('../server/official'),dir=fs.mkdtempSync(path.join(os.tmpdir(),'bb44-authority-')),wss={clients:new Set()};
 function peer(room){const ws={room,readyState:1,messages:[],send(raw){this.messages.push(JSON.parse(raw));}};wss.clients.add(ws);return ws;}
 const last=(ws,topic)=>ws.messages.filter(m=>m.topic===topic).at(-1)?.data;
 try{for(let n=2;n<=5;n++){
  let service=Service(wss,dir);const name='bb-oxygen'+n,peers=Array.from({length:n},()=>peer(name));peers.forEach((ws,pi)=>service.handle(ws,pi?'hello':'official:hello',{ruleset:'campaign',mid:44,name:'联机氧气'+pi}));let watcher=peer(name);service.handle(watcher,'hello',{spectator:true,name:'氧气观众'});let room=service.load(name);
  service.handle(peers[0],'official:start',{mid:44,revision:room.revision,commandId:'开始'});
  let G,target;for(let seed=1;seed<1000;seed++){G=game(n,0,seed*104729);target=G.wires.find(w=>w.o>0&&w.v===9);if(target&&G.wires.some(w=>w.o===0&&w.v===9)&&G.equip.some(e=>e.n===9))break;}
  assert(target&&G.equip.some(e=>e.n===9));room.G=G;G.catalog=G.mission.catalog='campaign';G.players.forEach((p,pi)=>{p.pid=room.seats[pi].pid;p.name=room.seats[pi].name;});
  function send(pi,id,a,revision=room.revision){service.handle(peers[pi],'official:act',{gid:G.gid,revision,commandId:id,pi:(pi+1)%n,action:a});}
  function pause(paused,id){service.handle(peers[0],'official:pause',{gid:G.gid,revision:room.revision,commandId:id,paused});assert.equal(G.paused,paused);}
  function restart(){const credentials=peers.map(ws=>last(ws,'official:welcome').credential),observerCredential=last(watcher,'official:welcome').credential;peers.forEach(ws=>ws.readyState=3);watcher.readyState=3;service=Service(wss,dir);room=service.load(name);G=room.G;for(let pi=0;pi<n;pi++){peers[pi]=peer(name);service.handle(peers[pi],'hello',{credential:credentials[pi],name:'联机氧气'+pi});}watcher=peer(name);service.handle(watcher,'hello',{credential:observerCredential,name:'氧气观众'});}
  let k=0;while(G.phase==='setup'){const pi=BB.setupActor(G);send(pi,'初始'+k++,{a:'info',w:G.wires.find(w=>w.o===pi&&BB.setupInfoAllowed(G,w)).id});}
  const oldRevision=room.revision;send(0,'宣告9',{a:'dual',w:target.id,val:9});assert.equal(G.officialState.oxygen.available,n*2-3);assert.equal(G.pending.step,'target');
  const revision=room.revision;send(0,'宣告9',{a:'dual',w:target.id,val:9});assert.equal(room.revision,revision);assert.equal(G.officialState.oxygen.available,n*2-3);
  service.handle(watcher,'official:perspective',{pid:room.seats[target.o].pid});assert(!('choices'in last(watcher,'official:view').view.pending));
  peers.forEach((ws,pi)=>{const view=last(ws,'official:view').view;assert.equal(view.official.oxygen.available,n*2-3);assert.equal('choices'in view.pending,pi===target.o);});
  pause(true,'暂停目标');const frozen=JSON.stringify(G);send(target.o,'暂停回应',{a:'resolve',id:G.pending.id,w:target.id});assert.equal(JSON.stringify(G),frozen);const targetDecision=G.pending.id;restart();assert(G.paused);assert.equal(G.pending.id,targetDecision);assert.equal(G.officialState.oxygen.available,n*2-3);pause(false,'继续目标');
  const beforeTarget=JSON.stringify(G);send(target.o,'旧修订',{a:'resolve',id:targetDecision,w:target.id},oldRevision);assert.equal(JSON.stringify(G),beforeTarget);send(0,'冒充目标',{a:'resolve',id:targetDecision,w:target.id});assert.equal(JSON.stringify(G),beforeTarget);send(target.o,'旧决定',{a:'resolve',id:targetDecision-1,w:target.id});assert.equal(JSON.stringify(G),beforeTarget);
  send(target.o,'目标回应',{a:'resolve',id:targetDecision,w:target.id});assert.equal(G.pending.step,'own');assert.equal(G.officialState.oxygen.available,n*2-3);const afterTarget=room.revision;send(target.o,'目标回应',{a:'resolve',id:targetDecision,w:target.id});assert.equal(room.revision,afterTarget);
  pause(true,'暂停本人选择');const ownDecision=G.pending.id,own=BB.view(G,0).pending.choices.at(-1);restart();assert.equal(G.pending.step,'own');assert.equal(G.pending.id,ownDecision);assert.equal(G.officialState.oxygen.available,n*2-3);service.handle(watcher,'official:perspective',{pid:room.seats[0].pid});assert(!('choices'in last(watcher,'official:view').view.pending));pause(false,'继续本人选择');
  const beforeOwn=JSON.stringify(G);send(1,'冒充本人',{a:'resolve',id:ownDecision,w:own});assert.equal(JSON.stringify(G),beforeOwn);send(0,'非法本人线',{a:'resolve',id:ownDecision,w:target.id});assert.equal(JSON.stringify(G),beforeOwn);
  send(0,'选择本人线',{a:'resolve',id:ownDecision,w:own});assert.equal(G.pending,null);assert.equal(G.officialState.oxygen.available,n*2-3);assert.equal(G.turn,1);const afterOwn=room.revision;send(0,'选择本人线',{a:'resolve',id:ownDecision,w:own});assert.equal(room.revision,afterOwn);
  send(n-1,'请求氧气',{a:'oxygen-signal'});assert(G.officialState.oxygen.requests[n-1]);const signalRevision=room.revision;send(n-1,'请求氧气',{a:'oxygen-signal'});assert.equal(room.revision,signalRevision);
  const beforeChat=JSON.stringify(G),chatCount=peers.reduce((sum,ws)=>sum+ws.messages.filter(m=>m.topic==='chat').length,0);service.handle(peers[0],'chat',{text:'非法水下聊天'});assert.equal(peers.reduce((sum,ws)=>sum+ws.messages.filter(m=>m.topic==='chat').length,0),chatCount);assert.equal(JSON.stringify(G),beforeChat);
  service.handle(watcher,'official:act',{gid:G.gid,revision:room.revision,commandId:'观战手势',action:{a:'oxygen-signal'}});assert.equal(JSON.stringify(G),beforeChat);restart();assert(G.officialState.oxygen.requests[n-1]);
  send(1,'稳定器跳过',{a:'oxygen-skip',stab:true});assert.equal(G.det,0);assert(G.equip.find(e=>e.n===9).used);assert.equal(G.officialState.oxygen.available,n===2?n*2:n*2-3);const afterSkip=room.revision;send(1,'稳定器跳过',{a:'oxygen-skip',stab:true});assert.equal(room.revision,afterSkip);
 }}finally{fs.rmSync(dir,{recursive:true,force:true});}
 console.log('✓ 第44关2–5人权威服务：两阶段耗氧只扣一次、暂停／凭据重连／服务重启、私有选择与观战只读、旧请求／冒充／重复拒绝、禁语／氧气请求及稳定器跳过通过');
}
