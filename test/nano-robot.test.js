const assert=require('assert'),BB=require('../js/engine'),M=require('../js/missions'),Bot=require('../js/bot');
function rng(seed){return()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);}
function game(n=3,cap=0,seed=1){return BB.createGame(M.get('official-development',43),Array.from({length:n},(_,i)=>({pid:'p'+i,name:'机器人验收'+i})),{captain:cap,rng:rng(seed)});}
function act(G,pi,a){assert.equal(BB.act(G,pi,a),null,JSON.stringify(a));}
function reject(G,pi,a){const before=JSON.stringify(G);assert(BB.act(G,pi,a));assert.equal(JSON.stringify(G),before);}
function setup(G){while(G.phase==='setup'){const pi=BB.setupActor(G),pd=BB.view(G,pi).pending;act(G,pi,pd?{a:'initial-clue',id:pd.id,w:pd.choices.length?pd.choices.at(-1):null,rack:0}:{a:'info',w:G.wires.find(w=>w.o===pi&&BB.setupInfoAllowed(G,w)).id});}}
for(let n=2;n<=5;n++)for(let cap=0;cap<n;cap++)for(let seed=1;seed<=12;seed++){
 const G=game(n,cap,seed*104729),count=n===2?5:n===5?3:4;assert.equal(G.wires.length,51);assert.equal(G.officialState.nano.reserve.length,count);assert.equal(G.wires.filter(w=>w.o<0).length,count);assert.equal(G.wires.filter(w=>BB.kindOf(w)==='r').length,3);assert.equal(G.ymark.n,0);assert.equal(G.rmark.cand.length,3);
 for(let v=1;v<=12;v++)assert.equal(G.wires.filter(w=>w.v===v).length,4);assert.equal(G.players.flatMap(p=>p.stands.flat()).length,51-count);const sizes=G.players.flatMap(p=>p.stands.map(s=>s.length));assert(Math.max(...sizes)-Math.min(...sizes)<=1);
 for(let pi=-1;pi<n;pi++){const V=BB.view(G,pi);assert.equal(V.official.nano.position,1);assert.equal(V.official.nano.remaining,count);assert(!('reserve'in V.official.nano));assert(!('revealed'in V.official.nano));assert.equal(V.official.randomInitialClues,n===2);assert(!Object.keys(BB.packHand(G,pi)).some(id=>G.wires[id].o<0));}
 setup(G);assert(G.players.every((_,pi)=>G.setup[pi]===1));const reserved=G.officialState.nano.reserve[0];reject(G,cap,{a:'dual',w:reserved,val:G.wires.find(w=>w.o===cap&&Number.isInteger(w.v)).v});assert(!BB.targetAllowed(G,cap,G.wires[reserved]));
}
console.log('✓ 第43关2–5人全部队长来源设置、51根总量、5／4／4／3隐藏备用、均衡线架、双人队长随机标记、隐藏内容与拒绝直接剪备用通过');
function rig(hands,stack=[2,3]){const G=game(hands.length);G.wires=[];G.players.forEach(p=>p.stands=p.stands.map(()=>[]));hands.forEach((hand,o)=>hand.forEach(v=>{const id=G.wires.length;G.wires.push({id,v,o,s:0,cut:false,info:null});G.players[o].stands[0].push(id);}));const reserve=stack.map(v=>{const id=G.wires.length;G.wires.push({id,v,o:-1,s:-1,cut:false,info:null});return id;});G.officialState.nano={position:1,direction:1,reserve,waiting:false};G.officialState.risky.side=[];G.pending=null;G.phase='play';G.turn=0;G.turnNo=1;G.equip=[];return G;}
function reply(G,id){const pd=G.pending;act(G,pd.to,{a:'resolve',id:pd.id,w:id??BB.view(G,pd.to).pending.choices[0]});}
{
 const G=rig([[1,1,7],[1,7],[8]],[1,2]),newId=G.officialState.nano.reserve[0];act(G,0,{a:'dual',w:3,val:1});reply(G,3);reply(G,1);assert.equal(G.pending.type,'nano-rack');assert.equal(G.officialState.nano.reserve.length,1);assert.equal(G.officialState.nano.position,1);
 for(let pi=-1;pi<3;pi++){const V=BB.view(G,pi);assert.equal('drawn'in V.pending,pi===0);assert.equal('choices'in V.pending,pi===0);assert(!('wire'in V.pending));}
 const decision=G.pending.id;reject(G,1,{a:'nano-rack',id:decision,rack:0});reject(G,0,{a:'nano-rack',id:decision-1,rack:0});reject(G,0,{a:'nano-rack',id:decision,rack:2});const restored=JSON.parse(JSON.stringify(G));act(restored,0,{a:'nano-rack',id:decision,rack:1});assert.equal(restored.wires[newId].o,0);assert.equal(restored.wires[newId].s,1);assert.equal(restored.officialState.nano.position,2);assert.equal(restored.pending,null);assert.equal(restored.turn,1);assert.equal(BB.view(restored,1).players[0].stands[1].find(w=>w.id===newId).v,null);assert.equal(BB.view(restored,0).players[0].stands[1].find(w=>w.id===newId).v,1);
}
{
 const G=rig([[1,1,1,1,7],[7],[8]],[2,3]);act(G,0,{a:'solo',val:1});assert.equal(G.pending.type,'nano-rack');assert.equal(G.officialState.nano.reserve.length,1);act(G,0,{a:'nano-rack',id:G.pending.id,rack:0});assert.equal(G.officialState.nano.position,2);
}
{
 const G=rig([[1,7],[1,7],[8]],[2]);G.turn=1;act(G,1,{a:'dual',w:0,val:1});reply(G,0);reply(G,2);assert.equal(G.pending,null);assert.equal(G.officialState.nano.reserve.length,0);assert(G.players[1].stands[0].some(id=>G.wires[id].v===2));assert.equal(G.officialState.nano.position,2);
}
{
 const G=rig([[1,7],[3,7],[8]],[2,3]);act(G,0,{a:'dual',w:2,val:1});reply(G,2);assert.equal(G.officialState.nano.reserve.length,2);assert.equal(G.officialState.nano.position,2);assert.equal(G.det,1);
}
console.log('✓ 第43关实际命中才补线，双人／四根单拆每次仅行动者收一根；双架私人选择可恢复、单架自动放置、失败无补线通过');
{
 const G=rig([[7],[8],[9]],[2]);G.equip=[{n:11,used:false}];for(let i=0;i<2;i++){const id=G.wires.length;G.wires.push({id,v:11,o:2,s:0,cut:true,info:null});G.players[2].stands[0].push(id);}
 for(let step=0;step<23;step++){const expected=step<=11?1+step:23-step;assert.equal(G.officialState.nano.position,expected);if(step===22)break;G.equip[0].used=false;act(G,G.turn,{a:'equip',n:11,p:(G.turn+1)%3});}assert.equal(G.officialState.nano.direction,1);assert.equal(G.officialState.nano.reserve.length,1);
}
{
 const G=rig([[1,1],[2,2],[3,3]],[4]);G.officialState.nano.position=12;for(let k=0;k<3;k++)act(G,G.turn,{a:'solo',val:k+1});assert.notEqual(G.phase,'won');assert.equal(G.officialState.nano.reserve.length,1);
}
console.log('✓ 第43关轨道1–12往返、咖啡杯也推进、备用未清不能提前获胜通过');
{
 const G=rig([[2,2],[1],[]],[1]);G.officialState.nano.position=7;act(G,0,{a:'solo',val:2});assert.equal(G.phase,'lost');assert.equal(G.officialState.nano.waiting,false);assert.match(G.result.why,/唯一同值/);
 const legal=rig([[1],[2,2],[]],[1]);act(legal,0,{a:'dual',w:1,val:1});reply(legal,1);assert.equal(legal.phase,'play');assert.equal(legal.officialState.nano.position,2);act(legal,1,{a:'solo',val:2});assert.equal(legal.officialState.nano.reserve.length,0);assert.equal(legal.phase,'play');act(legal,0,{a:'dual',w:3,val:1});reply(legal,3);reply(legal,0);assert.equal(legal.phase,'won');
}
console.log('✓ 第43关发行商FAQ：无法拆线且唯一同值在机器人时立即爆炸；其他玩家仍可行动补线时不提前判负');
{
 const fs=require('fs'),os=require('os'),path=require('path'),Service=require('../server/official'),dir=fs.mkdtempSync(path.join(os.tmpdir(),'bb43-blocked-save-'));
 try{
  const G=rig([[1],[],[]],[1]);G.officialState.nano.waiting=true;G.paused=true;G.catalog=G.mission.catalog='campaign';const name='bb-robot-blocked';
  const seats=G.players.map((p,i)=>({pid:p.pid,name:p.name,bot:false,credential:'死局旧凭证'+i}));fs.writeFileSync(path.join(dir,name+'.json'),JSON.stringify({version:1,name,host:seats[0].pid,mid:43,ruleset:'campaign',attempts:1,started:true,seats,observers:[],revision:5,seen:[],G}));
  let room=Service({clients:new Set()},dir).load(name);assert.equal(room.G.phase,'lost');assert.equal(room.G.paused,false);assert.equal(room.G.officialState.nano.waiting,false);assert.equal(room.revision,6);assert.match(room.G.result.why,/唯一同值/);
  room=Service({clients:new Set()},dir).load(name);assert.equal(room.revision,6);assert.equal(room.G.phase,'lost');const before=JSON.stringify(room.G);assert.equal(BB.recoverFatalState(room.G),false);assert.equal(JSON.stringify(room.G),before);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
 console.log('✓ 第43关旧版无法继续的等待存档恢复为发行商指定失败，修订只增一次，暂停／等待清除且重启不重复应用');
}
{
 const G=game(3,0,104729);setup(G);const altered=JSON.parse(JSON.stringify(G));altered.officialState.nano.reserve.forEach(id=>{altered.wires[id].v=12;});assert.deepEqual(BB.view(G,0),BB.view(altered,0));const old=Math.random;try{Math.random=rng(98765);const first=Bot.infer(G,0,5000);Math.random=rng(98765);const second=Bot.infer(altered,0,5000);assert.deepEqual(first,second);assert(!Object.keys(first).some(id=>G.officialState.nano.reserve.includes(+id)));assert(!Object.keys(first).some(id=>id.startsWith('nano-unknown-')));}finally{Math.random=old;}
}
console.log('✓ 第43关机器人备用只按公开数量建匿名样本，实际备用内容不影响推理，也不成为可剪目标');
assert(M.get('campaign',43).verified);assert.equal(M.get('campaign',43).officialModule,'nano-robot');assert(!M.get('custom',43).officialModule);
{
 const fs=require('fs'),os=require('os'),path=require('path'),Service=require('../server/official'),dir=fs.mkdtempSync(path.join(os.tmpdir(),'bb43-legacy-'));
 try{for(let n=2;n<=5;n++){
  const seats=Array.from({length:n},(_,i)=>({pid:'p'+i,name:'旧玩家'+i,credential:'旧凭证'+i,bot:false})),mission=JSON.parse(JSON.stringify(M.get('custom',43)));mission.catalog='campaign';mission.contentVersion=16;
  const G=BB.createGame(mission,seats,{rng:rng(n*104729)});G.catalog='campaign';G.contentVersion=16;const name='bb-legacy43-'+n,before=JSON.stringify(G.mission);
  fs.writeFileSync(path.join(dir,name+'.json'),JSON.stringify({version:1,name,host:seats[0].pid,mid:43,ruleset:'campaign',attempts:1,started:true,seats,observers:[],revision:0,seen:[],G}));
  const restored=Service({clients:new Set()},dir).load(name).G;assert.equal(JSON.stringify(restored.mission),before);assert.equal(restored.contentVersion,16);assert(!restored.officialState);assert.equal(restored.ruleset,'custom');assert.deepEqual(restored.ymark,G.ymark);assert.deepEqual(restored.rmark,G.rmark);assert.equal(restored.detMax,G.detMax);assert.equal(BB.view(restored,0).official,null);
 }}finally{fs.rmSync(dir,{recursive:true,force:true});}
 console.log('✓ 第43关2–5人旧版本16改编存档保持原规则、黄红配置和引爆器，不替换成机器人任务');
}
{
 // 来源参考求解使用完整牌面验证整局流程，不作为机器人推理或所有发牌必胜的证明。
 let actions=0;
 for(let n=2;n<=5;n++)for(let seed=1;seed<=25;seed++){
  const G=game(n,seed%n,seed*104729);setup(G);
  for(let k=0;k<500&&G.phase==='play';k++){
   const pi=G.pending?G.pending.to:G.turn;let a;
   if(G.pending?.type==='nano-rack')a={a:'nano-rack',id:G.pending.id,rack:k%G.players[pi].stands.length};
   else if(G.pending){const pd=G.pending;a={a:'resolve',id:pd.id,w:pd.step==='own'?BB.view(G,pi).pending.choices.at(-1):pd.ids.find(id=>pd.vals.includes(G.wires[id].v))};}
   else{
    const own=G.wires.filter(w=>w.o===pi&&!w.cut),pos=G.officialState.nano.position;
    const values=[...new Set(own.filter(w=>BB.kindOf(w)==='b').map(w=>w.v))].sort((a,b)=>Number(b===pos)-Number(a===pos));
    for(const value of values){
     if(BB.soloOk(G,pi,value)){a={a:'solo',val:value};break;}
     const target=G.wires.find(w=>w.o>=0&&w.o!==pi&&!w.cut&&w.v===value);
     if(target){a={a:'dual',w:target.id,val:value};break;}
    }
    if(!a&&own.length&&own.every(w=>BB.kindOf(w)==='r'))a={a:'red'};
   }
   assert(a,`来源整局无动作：人数${n}，种子${seed}`);act(G,pi,a);actions++;
   if(G.pending?.type==='nano-rack'){
    const snapshot=JSON.parse(JSON.stringify(G));assert.deepEqual(BB.view(snapshot,pi),BB.view(G,pi));
   }
  }
  assert.equal(G.phase,'won',`来源整局未胜：人数${n}，种子${seed}`);
  assert.equal(G.officialState.nano.reserve.length,0);assert(G.wires.every(w=>w.cut));assert.equal(G.det,0);
 }
 console.log(`✓ 第43关100局完整来源参考求解通过（${actions}次动作），备用全清、红线公开、无错误剪线`);
}
{
 const G=rig([[1,7,7,7,7],[1,8],[8]],[2]),target=G.wires.find(w=>w.o===1&&w.v===1);
 target.info={t:'v',v:1};assert.deepEqual(Bot.decide(G,0),{a:'dual',w:target.id,val:1});
 const changed=JSON.parse(JSON.stringify(G));changed.wires[changed.officialState.nano.reserve[0]].v=12;
 assert.deepEqual(Bot.decide(changed,0),Bot.decide(G,0));
 const solo=rig([[1,1,1,1,7,7,7,7],[8],[8]],[2]);assert.deepEqual(Bot.decide(solo,0),{a:'solo',val:1});
 const restored=rig([[1],[1],[8]],[2]);act(restored,0,{a:'dual',w:1,val:1});reply(restored,1);reply(restored,0);
 const choice=Bot.decide(JSON.parse(JSON.stringify(restored)),0);assert.equal(choice.a,'nano-rack');act(restored,0,choice);assert.equal(restored.officialState.nano.position,2);
 console.log('✓ 第43关机器人优先公开安全补线／当前位置单拆，隐藏备用不影响选择，恢复后可完成私人选架');
}
{
 const G=rig([[4,4],[6,8],[6,8]],[6]);G.officialState.nano.position=5;
 G.equip=[{n:11,used:false}];for(let k=0;k<2;k++){const id=G.wires.length;G.wires.push({id,v:11,o:0,s:0,cut:true,info:null});G.players[0].stands[0].push(id);}
 const targets=G.wires.filter(w=>w.o>0&&w.v===6);targets.forEach(w=>w.info={t:'v',v:6});
 const a=Bot.decide(G,0);assert.deepEqual(a,{a:'equip',n:11,p:1});act(G,0,a);assert.equal(G.officialState.nano.position,6);assert.equal(G.turn,1);
 const cut=Bot.decide(G,1);assert.deepEqual(cut,{a:'dual',w:targets[1].id,val:6});act(G,1,cut);reply(G,targets[1].id);reply(G,targets[0].id);
 assert.equal(G.officialState.nano.reserve.length,0);assert.equal(G.officialState.nano.position,7);
 console.log('✓ 第43关机器人根据公开同值标记用咖啡杯安排下一位置补线，实际剪中后才取备用');
}
{
 for(const detector of ['double','triple','super','xy','personal-triple','personal-xy']){
  const G=rig([[8],[1,7],[1,7]],[2]);G.turn=1;
  if(detector.startsWith('personal-')){G.players[1].character={id:detector==='personal-triple'?'triple-detector':'xy-ray',used:false};G.players[1].dd=0;}
  G.equip=[3,5,10].map(n=>({n,used:false}));
  for(const value of [3,5,10])for(let k=0;k<2;k++){const id=G.wires.length;G.wires.push({id,v:value,o:0,s:0,cut:true,info:null});G.players[0].stands[0].push(id);}
  const target=G.wires.find(w=>w.o===2&&w.v===1),own=G.wires.find(w=>w.o===1&&w.v===1),ids=G.players[2].stands[0].slice();
  const a=detector==='double'?{a:'dd',ws:ids,val:1}:detector==='triple'?{a:'equip',n:3,ws:ids,val:1}:detector==='super'?{a:'equip',n:5,p:2,s:0,val:1}:detector==='personal-triple'?{a:'character',ws:ids,val:1}:{a:'dual',w:target.id,val:7,xy:true,xyPersonal:detector==='personal-xy',vals:[7,1]};
  act(G,1,a);reply(G,target.id);reply(G,own.id);assert.equal(G.officialState.nano.reserve.length,0);assert.equal(G.officialState.nano.position,2);
  assert.equal(BB.characterState(G.players[1]).used,detector==='double'||detector.startsWith('personal-'));
  for(const n of [3,5,10])assert.equal(G.equip.find(e=>e.n===n).used,detector==='triple'&&n===3||detector==='super'&&n===5||detector==='xy'&&n===10);
 }
 console.log('✓ 第43关双重／仅两根三重／超级探测器、个人三重及个人／共享X/Y第二值命中均只补一根，个人与共享使用状态独立');
}
{
 const originalRandom=Math.random,totals={won:0,lost:0,waiting:0},equipment={},protectedCuts=[];
 try{for(let n=2;n<=5;n++)for(let seed=1;seed<=4;seed++){
  Math.random=rng(seed*104729+n);const G=BB.createGame(M.get('official-development',43),Array.from({length:n},(_,i)=>({pid:'p'+i,name:'推理机器人'+i,bot:true})),{captain:seed%n,rng:Math.random});
  let steps=0;
  while(!['won','lost'].includes(G.phase)&&steps<600){
   let acted=false;
   for(let pi=0;pi<n;pi++){const a=Bot.decide(G,pi);if(!a)continue;act(G,pi,a);if(a.a==='equip')equipment[a.n]=(equipment[a.n]||0)+1;if(a.stab)protectedCuts.push({n,seed});steps++;acted=true;break;}
   if(!acted){
    // 场上的同值线可能全在备用堆：这是未获胜的等待，不能自动补线或冒充成功。
    assert.equal(G.phase,'play');assert(G.officialState.nano.waiting);assert(G.officialState.nano.reserve.length>0);
    assert(G.players.every((_,pi)=>!BB.canAct(G,pi)));totals.waiting++;break;
   }
  }
  assert(steps<600,'机器人不可重复拒绝或空转');if(['won','lost'].includes(G.phase))totals[G.phase]++;
 }}finally{Math.random=originalRandom;}
 assert.equal(totals.won+totals.lost+totals.waiting,16);
 assert(Object.keys(equipment).length>0,'真实整局应覆盖共享装备');assert(protectedCuts.length>0,'真实整局应覆盖稳定器组合');
 console.log(`✓ 第43关16局真实推理机器人无非法动作或循环：获胜${totals.won}、引爆${totals.lost}、无合法动作等待${totals.waiting}（不作为必胜证明）`);
 console.log('✓ 第43关真实整局机器人装备使用次数 '+JSON.stringify(equipment)+'，稳定器组合 '+protectedCuts.length+' 次');
}
{
 const originalRandom=Math.random,roles=['triple-detector','xy-ray','general-radar','walkie-talkies'],totals={won:0,lost:0,waiting:0};
 try{for(let n=2;n<=5;n++)for(let rotation=0;rotation<4;rotation++)for(let seed=1;seed<=2;seed++){
  Math.random=rng((rotation+1)*100003+seed*104729+n);const captain=seed%n;
  const seats=Array.from({length:n},(_,pi)=>({pid:'p'+pi,name:'角色机器人'+pi,bot:true,character:pi===captain?'double-detector':roles[(rotation+pi-(pi>captain?1:0))%4]}));
  const G=BB.createGame(M.get('official-development',43),seats,{captain,rng:Math.random});let steps=0;
  while(!['won','lost'].includes(G.phase)&&steps<600){
   let acted=false;for(let pi=0;pi<n;pi++){const a=Bot.decide(G,pi);if(!a)continue;act(G,pi,a);steps++;acted=true;break;}
   if(!acted){assert.equal(G.phase,'play');assert(G.officialState.nano.waiting);assert(G.players.every((_,pi)=>!BB.canAct(G,pi)));totals.waiting++;break;}
  }
  assert(steps<600,'新角色机器人不能循环');if(['won','lost'].includes(G.phase))totals[G.phase]++;
 }}finally{Math.random=originalRandom;}
 assert.equal(totals.won+totals.lost+totals.waiting,32);
 console.log('✓ 第43关2–5人四类新角色32局机器人无非法动作或循环：'+JSON.stringify(totals)+'（仅合法性验收，不证明推理能力）');
}
{
 const fs=require('fs'),os=require('os'),path=require('path'),Service=require('../server/official'),dir=fs.mkdtempSync(path.join(os.tmpdir(),'bb43-authority-')),wss={clients:new Set()};
 const last=(ws,topic)=>ws.messages.filter(m=>m.topic===topic).at(-1)?.data;function peer(room){const ws={room,readyState:1,messages:[],send(raw){this.messages.push(JSON.parse(raw));}};wss.clients.add(ws);return ws;}
 try{for(let n=2;n<=5;n++){
  let service=Service(wss,dir);const name='bb-nano'+n,peers=Array.from({length:n},()=>peer(name));peers.forEach((ws,pi)=>service.handle(ws,pi?'hello':'official:hello',{ruleset:'campaign',mid:43,name:'补线玩家'+pi}));let watcher=peer(name);service.handle(watcher,'hello',{spectator:true,name:'补线观众'});let room=service.load(name);service.handle(peers[0],'official:start',{mid:43,revision:room.revision,commandId:'开始'});
  let G,target;for(let seed=1;seed<500;seed++){G=game(n,0,seed*104729);if(G.wires.some(w=>w.o===0&&w.v===1)){target=G.wires.find(w=>w.o>0&&w.v===1);if(target)break;}}assert(target);room.G=G;G.catalog=G.mission.catalog='campaign';G.players.forEach((p,pi)=>{p.pid=room.seats[pi].pid;p.name=room.seats[pi].name;});
  function send(pi,id,a){service.handle(peers[pi],'official:act',{gid:G.gid,revision:room.revision,commandId:id,pi:(pi+1)%n,action:a});}
  function pause(paused,id){service.handle(peers[0],'official:pause',{gid:G.gid,revision:room.revision,commandId:id,paused});assert.equal(G.paused,paused);}
  function restart(){const creds=peers.map(ws=>last(ws,'official:welcome').credential),observerCredential=last(watcher,'official:welcome').credential;service=Service(wss,dir);room=service.load(name);G=room.G;for(let pi=0;pi<n;pi++){peers[pi]=peer(name);service.handle(peers[pi],'hello',{credential:creds[pi],name:'补线玩家'+pi});}watcher=peer(name);service.handle(watcher,'hello',{credential:observerCredential,name:'补线观众'});}
  let k=0;while(G.phase==='setup'){const pi=BB.setupActor(G),pd=BB.view(G,pi).pending;send(pi,'标记'+k++,pd?{a:'initial-clue',id:pd.id,w:pd.choices.length?pd.choices[0]:null,rack:0}:{a:'info',w:G.wires.find(w=>w.o===pi&&BB.setupInfoAllowed(G,w)).id});}
  const remaining=G.officialState.nano.reserve.length,incoming=G.officialState.nano.reserve[0],value=G.wires[incoming].v;send(0,'宣告',{a:'dual',w:target.id,val:1});send(target.o,'回应目标',{a:'resolve',id:G.pending.id,w:target.id});const own=BB.view(G,0).pending.choices.at(-1),cutDecision=G.pending.id;send(0,'自己的线',{a:'resolve',id:cutDecision,w:own});assert.equal(G.officialState.nano.reserve.length,remaining-1);
  const rev=room.revision;send(0,'自己的线',{a:'resolve',id:cutDecision,w:own});assert.equal(room.revision,rev);service.handle(watcher,'official:perspective',{pid:room.seats[0].pid});
  if(n<=3){assert.equal(G.pending.type,'nano-rack');const decision=G.pending.id;
   peers.forEach((ws,pi)=>{const V=last(ws,'official:view').view;assert.equal('drawn'in V.pending,pi===0);assert.equal('choices'in V.pending,pi===0);assert(!('wire'in V.pending));});const observed=last(watcher,'official:view').view;assert(observed.spectator);assert(!('drawn'in observed.pending));assert(!('choices'in observed.pending));
   pause(true,'暂停补线');const frozen=JSON.stringify(G);send(0,'暂停选择',{a:'nano-rack',id:decision,rack:1});assert.equal(JSON.stringify(G),frozen);const pending=JSON.parse(JSON.stringify(G.pending));restart();assert.deepEqual(G.pending,pending);assert.equal(G.officialState.nano.position,1);pause(false,'继续补线');
   const before=JSON.stringify(G);send(1,'冒充放置',{a:'nano-rack',id:decision,rack:1});assert.equal(JSON.stringify(G),before);send(0,'旧选择',{a:'nano-rack',id:decision-1,rack:1});assert.equal(JSON.stringify(G),before);send(0,'错误架',{a:'nano-rack',id:decision,rack:2});assert.equal(JSON.stringify(G),before);send(0,'放置补线',{a:'nano-rack',id:decision,rack:1});const after=room.revision;send(0,'放置补线',{a:'nano-rack',id:decision,rack:1});assert.equal(room.revision,after);assert.equal(G.wires[incoming].s,1);
  }else assert.equal(G.pending,null);
  assert.equal(G.officialState.nano.position,2);assert.equal(G.wires[incoming].o,0);assert.equal(G.officialState.nano.reserve.length,remaining-1);restart();assert.equal(G.officialState.nano.position,2);assert.equal(G.officialState.nano.reserve.length,remaining-1);assert.equal(BB.view(G,0).players[0].stands.flat().find(w=>w.id===incoming).v,value);assert.equal(BB.view(G,1).players[0].stands.flat().find(w=>w.id===incoming).v,null);
 }}finally{fs.rmSync(dir,{recursive:true,force:true});}
 console.log('✓ 第43关2–5人权威服务：双架补线暂停／重连／重启、私有新牌、观战不接收临时牌值、单架自动放置、旧选择／冒充／错架拒绝与去重通过');
}
