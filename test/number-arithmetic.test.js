const assert=require('assert'),BB=require('../js/engine'),M=require('../js/missions'),Bot=require('../js/bot');
function rng(s){return()=>((s=(Math.imul(s,1664525)+1013904223)>>>0)/4294967296);}
function game(n=3,cap=0,seed=1){return BB.createGame(M.get('official-development',47),Array.from({length:n},(_,i)=>({pid:'p'+i,name:'算式玩家'+i})),{captain:cap,rng:rng(seed)});}
function act(G,pi,a){assert.equal(BB.act(G,pi,a),null,JSON.stringify(a));}
function reject(G,pi,a){const before=JSON.stringify(G);assert(BB.act(G,pi,a));assert.equal(JSON.stringify(G),before);}
function setup(G){while(G.phase==='setup'){const pi=BB.setupActor(G);act(G,pi,{a:'info',w:G.wires.find(w=>w.o===pi&&BB.setupInfoAllowed(G,w)).id});}}
function rig(hands){const G=game(hands.length);setup(G);G.wires=[];G.players.forEach(p=>p.stands=p.stands.map(()=>[]));hands.forEach((hand,o)=>hand.forEach(v=>{const id=G.wires.length;G.wires.push({id,v,o,s:0,cut:false,info:null});G.players[o].stands[0].push(id);}));G.equip=[];return G;}
for(let n=2;n<=5;n++)for(let cap=0;cap<n;cap++)for(let seed=1;seed<=8;seed++){
 const G=game(n,cap,seed*104729);assert.equal(G.wires.length,n===2?51:50);assert.equal(G.rmark.n,n===2?3:2);assert.equal(G.rmark.cand.length,3);assert.equal(G.ymark.n,0);assert(G.equip.every(e=>e.n!==10));assert(!BB.characterOptions(G.mission,(cap+1)%n,cap).includes('xy-ray'));setup(G);
 for(let pi=-1;pi<n;pi++){const state=BB.view(G,pi).official.arithmetic;assert.deepEqual(state.open,Array.from({length:12},(_,i)=>i+1));assert.deepEqual(state.discard,[]);assert(!('selection'in state));}
}
console.log('✓ 第47关2–5人全部队长：48蓝、2／3红且双人3红、无黄、公开12张数字，排除共享及个人X/Y');
for(const [val,cards,operation] of [[12,[3,9],'sum'],[7,[10,3],'difference'],[7,[3,10],'difference'],[1,[2,1],'difference']]){
 const G=rig([[val,4],[val,4],[2]]);act(G,0,{a:'dual',w:2,val,cards,operation});assert.equal(BB.arithmetic(G).open.length,10);assert.deepEqual(BB.arithmetic(G).discard,cards);const pd=G.pending.id,restored=JSON.parse(JSON.stringify(G));act(restored,1,{a:'resolve',id:pd,w:2});act(restored,0,{a:'resolve',id:pd,w:0});assert.equal(BB.arithmetic(restored).open.length,10);assert.equal(BB.arithmetic(restored).selection,null);
 const S=rig([[val,val,val,val],[4],[4]]);act(S,0,{a:'solo',val,cards,operation});assert.equal(BB.arithmetic(S).discard.length,2);
}
{
 const G=rig([[7,12],[7,4],[4]]);reject(G,0,{a:'dual',w:2,val:7});reject(G,0,{a:'dual',w:2,val:7,cards:[3,3],operation:'difference'});reject(G,0,{a:'dual',w:2,val:7,cards:[10,3],operation:'multiply'});reject(G,0,{a:'dual',w:2,val:12,cards:[10,3],operation:'sum'});reject(G,0,{a:'dual',w:99,val:7,cards:[10,3],operation:'difference'});reject(G,1,{a:'arithmetic-skip',cards:[1,2]});
 act(G,0,{a:'dual',w:3,val:7,cards:[10,3],operation:'difference'});act(G,1,{a:'resolve',id:G.pending.id,w:3});assert.equal(G.det,1);assert.deepEqual(BB.arithmetic(G).discard,[10,3]);reject(G,1,{a:'dual',w:0,val:7,cards:[10,3],operation:'difference'});
}
{
 const G=rig([[7,2],[7,2],[4]]);BB.arithmetic(G).open=[10,3];BB.arithmetic(G).discard=Array.from({length:12},(_,i)=>i+1).filter(v=>![10,3].includes(v));act(G,0,{a:'dual',w:2,val:7,cards:[10,3],operation:'difference'});assert.equal(BB.arithmetic(G).open.length,0);const id=G.pending.id;act(G,1,{a:'resolve',id,w:2});act(G,0,{a:'resolve',id,w:0});assert.equal(BB.arithmetic(G).open.length,12);assert.equal(BB.arithmetic(G).resets,1);assert.equal(new Set(BB.arithmetic(G).open).size,12);assert.deepEqual(BB.arithmetic(G).discard,[]);
 const pass=rig([[1],[2],[3]]);pass.stab=true;reject(pass,0,{a:'arithmetic-skip',cards:[1,2],stab:true});act(pass,0,{a:'arithmetic-skip',cards:[1,2]});assert.equal(pass.det,1);assert.equal(pass.stab,false);assert.equal(BB.arithmetic(pass).open.length,10);
 const reds=rig([[1.5],[2],[3]]);act(reds,0,{a:'red'});assert.equal(BB.arithmetic(reds).open.length,12);
}
assert(!M.get('campaign',47).verified);assert(!M.get('custom',47).officialModule);
{
 const fs=require('fs'),os=require('os'),path=require('path'),Service=require('../server/official'),dir=fs.mkdtempSync(path.join(os.tmpdir(),'bb47-legacy-'));
 try{for(let n=2;n<=5;n++){
  const seats=Array.from({length:n},(_,i)=>({pid:'p'+i,name:'旧算式玩家'+i,credential:'旧算式凭证'+i,bot:false})),mission=JSON.parse(JSON.stringify(M.get('custom',47)));mission.catalog='campaign';mission.contentVersion=17;
  const G=BB.createGame(mission,seats,{rng:rng(n*104729)});G.catalog='campaign';G.contentVersion=17;const name='bb-legacy47-'+n,before=JSON.stringify(G.mission);fs.writeFileSync(path.join(dir,name+'.json'),JSON.stringify({version:1,name,host:seats[0].pid,mid:47,ruleset:'campaign',attempts:1,started:true,seats,observers:[],revision:0,seen:[],G}));
  const restored=Service({clients:new Set()},dir).load(name).G;assert.equal(JSON.stringify(restored.mission),before);assert.equal(restored.contentVersion,17);assert.equal(restored.ruleset,'custom');assert(!restored.officialState);assert(!BB.arithmetic(restored));assert.deepEqual(restored.ymark,G.ymark);assert.deepEqual(restored.rmark,G.rmark);assert.equal(restored.detMax,G.detMax);assert.equal(BB.view(restored,0).official,null);
 }}finally{fs.rmSync(dir,{recursive:true,force:true});}
 console.log('✓ 第47关2–5人旧版本17存档保留原改编任务、黄红设置与引爆器，不添加算式规则');
}
console.log('✓ 第47关和／差、双拆与四根单拆一次弃两牌、保存回应不重复、非法动作不变、失败仍弃牌、牌耗尽在回合结束复原、跳过罚格与红线不耗牌通过');
{
 const G=rig([[12,12,12,12],[2],[2]]),altered=JSON.parse(JSON.stringify(G));altered.wires.filter(w=>w.o!==0).forEach(w=>w.v=8);assert.deepEqual(BB.view(G,0),BB.view(altered,0));const action=Bot.decide(G,0);assert.deepEqual(Bot.decide(altered,0),action);assert.equal(action.a,'solo');assert.equal(action.val,12);assert.equal(action.cards.length,2);assert(BB.arithmeticPairs(BB.view(G,0),12).some(p=>p.operation===action.operation&&p.cards.every(v=>action.cards.includes(v))));act(G,0,action);
 const limited=rig([[12],[12],[3]]);BB.arithmetic(limited).open=[1,2];BB.arithmetic(limited).discard=Array.from({length:10},(_,i)=>i+3);const skip=Bot.decide(limited,0);assert.deepEqual(skip,{a:'arithmetic-skip',cards:[1,2]});act(limited,0,skip);assert.equal(limited.det,1);assert.equal(BB.arithmetic(limited).open.length,12);
 const reds=rig([[1.5],[2],[3]]);assert.deepEqual(Bot.decide(reds,0),{a:'red'});
}
{
 const originalRandom=Math.random,roles=['triple-detector','general-radar','walkie-talkies','double-detector'],totals={won:0,lost:0};
 try{for(let n=2;n<=5;n++)for(let rotation=0;rotation<4;rotation++)for(let seed=1;seed<=2;seed++){
  Math.random=rng((rotation+1)*100003+seed*104729+n);const captain=seed%n,seats=Array.from({length:n},(_,pi)=>({pid:'p'+pi,name:'算式机器人'+pi,bot:true,character:pi===captain?'double-detector':roles[(rotation+pi-(pi>captain?1:0))%4]}));const G=BB.createGame(M.get('official-development',47),seats,{captain,rng:Math.random});let steps=0;
  while(!['won','lost'].includes(G.phase)&&steps<700){let acted=false;for(let pi=0;pi<n;pi++){const a=Bot.decide(G,pi);if(!a)continue;act(G,pi,a);steps++;acted=true;break;}assert(acted||['won','lost'].includes(G.phase),'算式机器人不得停止合法阶段');}
  assert(steps<700,'算式机器人不得循环');assert(['won','lost'].includes(G.phase));totals[G.phase]++;
 }}finally{Math.random=originalRandom;}
 assert.equal(totals.won+totals.lost,32);console.log('✓ 第47关2–5人允许角色32局真实推理合法终局：'+JSON.stringify(totals)+'，无非法算式或循环；不能证明策略充分');
}
{
 const fs=require('fs'),os=require('os'),path=require('path'),Service=require('../server/official'),dir=fs.mkdtempSync(path.join(os.tmpdir(),'bb47-authority-')),wss={clients:new Set()};
 function peer(room){const ws={room,readyState:1,messages:[],send(raw){this.messages.push(JSON.parse(raw));}};wss.clients.add(ws);return ws;}
 const last=(ws,topic)=>ws.messages.filter(m=>m.topic===topic).at(-1)?.data;
 try{for(let n=2;n<=5;n++){
  let service=Service(wss,dir);const name='bb-arithmetic'+n,peers=Array.from({length:n},()=>peer(name));peers.forEach((ws,pi)=>service.handle(ws,pi?'hello':'official:hello',{ruleset:'campaign',mid:47,name:'算式联机'+pi}));let observer=peer(name);service.handle(observer,'hello',{spectator:true,name:'算式观众'});let room=service.load(name);service.handle(peers[0],'official:start',{mid:47,revision:room.revision,commandId:'开始'});
  let G,target;for(let seed=1;seed<300;seed++){G=game(n,0,seed*104729);target=G.wires.find(w=>w.o!==0&&w.v===12);if(target&&G.wires.some(w=>w.o===0&&w.v===12))break;}assert(target);room.G=G;G.catalog=G.mission.catalog='campaign';G.players.forEach((p,pi)=>{p.pid=room.seats[pi].pid;p.name=room.seats[pi].name;});
  function send(pi,id,a,revision=room.revision){service.handle(peers[pi],'official:act',{gid:G.gid,revision,commandId:id,pi:(pi+1)%n,action:a});}
  function pause(paused,id){service.handle(peers[0],'official:pause',{gid:G.gid,revision:room.revision,commandId:id,paused});assert.equal(G.paused,paused);}
  function restart(){const credentials=peers.map(ws=>last(ws,'official:welcome').credential),observerCredential=last(observer,'official:welcome').credential;peers.forEach(ws=>ws.readyState=3);observer.readyState=3;service=Service(wss,dir);room=service.load(name);G=room.G;for(let pi=0;pi<n;pi++){peers[pi]=peer(name);service.handle(peers[pi],'hello',{credential:credentials[pi],name:'算式联机'+pi});}observer=peer(name);service.handle(observer,'hello',{credential:observerCredential,name:'算式观众'});}
  let k=0;while(G.phase==='setup'){const pi=BB.setupActor(G);send(pi,'初始'+k++,{a:'info',w:G.wires.find(w=>w.o===pi&&BB.setupInfoAllowed(G,w)).id});}
  const initial=JSON.stringify(G);send(0,'错误算式',{a:'dual',w:target.id,val:12,cards:[3,9],operation:'difference'});assert.equal(JSON.stringify(G),initial);const oldRevision=room.revision;
  send(0,'相加宣告',{a:'dual',w:target.id,val:12,cards:[3,9],operation:'sum'});assert.equal(BB.arithmetic(G).open.length,10);assert.deepEqual(BB.arithmetic(G).discard,[3,9]);const decision=G.pending.id,rev=room.revision;send(0,'相加宣告',{a:'dual',w:target.id,val:12,cards:[3,9],operation:'sum'});assert.equal(room.revision,rev);
  peers.forEach(ws=>{const V=last(ws,'official:view').view;assert.equal(V.official.arithmetic.open.length,10);assert(!('selection'in V.official.arithmetic));});service.handle(observer,'official:perspective',{pid:room.seats[target.o].pid});assert(!('choices'in last(observer,'official:view').view.pending));
  pause(true,'暂停目标');const frozen=JSON.stringify(G);send(target.o,'暂停回应',{a:'resolve',id:decision,w:target.id});assert.equal(JSON.stringify(G),frozen);restart();assert(G.paused);assert.equal(G.pending.id,decision);assert.deepEqual(BB.arithmetic(G).discard,[3,9]);pause(false,'继续目标');
  const beforeTarget=JSON.stringify(G);send(target.o,'旧修订回应',{a:'resolve',id:decision,w:target.id},oldRevision);assert.equal(JSON.stringify(G),beforeTarget);send(0,'冒用目标',{a:'resolve',id:decision,w:target.id});assert.equal(JSON.stringify(G),beforeTarget);send(target.o,'目标回应',{a:'resolve',id:decision,w:target.id});assert.equal(G.pending.step,'own');assert.equal(BB.arithmetic(G).open.length,10);
  const own=BB.view(G,0).pending.choices.at(-1);pause(true,'暂停本人');restart();assert.equal(G.pending.step,'own');assert.equal(G.pending.id,decision);service.handle(observer,'official:perspective',{pid:room.seats[0].pid});assert(!('choices'in last(observer,'official:view').view.pending));pause(false,'继续本人');
  send(0,'本人回应',{a:'resolve',id:decision,w:own});const after=room.revision;send(0,'本人回应',{a:'resolve',id:decision,w:own});assert.equal(room.revision,after);assert.equal(G.pending,null);assert.equal(G.turn,1);assert.deepEqual(BB.arithmetic(G).discard,[3,9]);
  const beforeUsed=JSON.stringify(G);send(1,'重复已弃牌',{a:'dual',w:0,val:12,cards:[3,9],operation:'sum'});assert.equal(JSON.stringify(G),beforeUsed);service.handle(observer,'official:act',{gid:G.gid,revision:room.revision,commandId:'观战弃牌',action:{a:'arithmetic-skip',cards:[1,2]}});assert.equal(JSON.stringify(G),beforeUsed);
  send(1,'弃牌跳过',{a:'arithmetic-skip',cards:[1,2]});assert.equal(G.det,1);assert.equal(BB.arithmetic(G).open.length,8);const afterPass=room.revision;send(1,'弃牌跳过',{a:'arithmetic-skip',cards:[1,2]});assert.equal(room.revision,afterPass);restart();assert.equal(G.det,1);assert.deepEqual(BB.arithmetic(G).discard,[3,9,1,2]);
 }}finally{fs.rmSync(dir,{recursive:true,force:true});}
 console.log('✓ 第47关2–5人权威服务：算式验证与一次弃牌、两阶段暂停／凭据重连／重启、私人选择／观战只读、旧修订／冒用／已弃牌拒绝、重复跳过不重罚通过');
}
