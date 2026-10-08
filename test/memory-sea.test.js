const assert=require('assert'),BB=require('../js/engine'),M=require('../js/missions'),C=require('../js/campaign-rules');
function rng(s){return()=>((s=(Math.imul(s,1664525)+1013904223)>>>0)/4294967296);}
function game(n=3,cap=0,seed=1){return BB.createGame(M.get('official-development',50),Array.from({length:n},(_,i)=>({pid:'p'+i,name:'黑海玩家'+i})),{captain:cap,rng:rng(seed)});}
function act(G,pi,a){assert.equal(BB.act(G,pi,a),null,JSON.stringify(a));}
function reject(G,pi,a){const before=JSON.stringify(G);assert(BB.act(G,pi,a));assert.equal(JSON.stringify(G),before);}
function preview(G){while(G.phase==='memory-preview')act(G,G.pending.to,{a:'memory-ready',id:G.pending.id});}
function setup(G){preview(G);while(G.phase==='setup'){const pi=BB.setupActor(G);act(G,pi,{a:'info',w:G.wires.find(w=>w.o===pi&&BB.setupInfoAllowed(G,w)).id});}}
function rig(hands){const G=game(hands.length);setup(G);G.wires=[];G.players.forEach(p=>p.stands=p.stands.map(()=>[]));hands.forEach((hand,o)=>hand.forEach(v=>{const id=G.wires.length;G.wires.push({id,v,o,s:0,cut:false,info:null});G.players[o].stands[0].push(id);}));G.equip=[];G.officialState.memorySea.side=[];G.officialState.memorySea.point=null;return G;}
function reply(G){const pd=G.pending,V=BB.view(G,pd.to);act(G,pd.to,{a:'resolve',id:pd.id,w:V.pending.choices[0]});}
for(const n of [2,3,4,5])for(let cap=0;cap<n;cap++)for(let seed=1;seed<=8;seed++){
 const G=game(n,cap,seed*104729);assert.equal(G.wires.length,n===2?55:52);assert.equal(G.rmark.n,n===2?3:2);assert.equal(G.ymark.n,n===2?4:2);assert.equal(G.phase,'memory-preview');assert.equal(G.pending.to,cap);
 for(let pi=-1;pi<n;pi++){const V=BB.view(G,pi);assert.equal(V.rmark.cand.length,n===2?3:2);assert.equal(V.ymark.cand.length,n===2?4:2);assert(V.players.every(p=>p.stands.flat().every(w=>w.v===null)));}
 reject(G,cap,{a:'info',w:G.wires.find(w=>w.o===cap&&Number.isInteger(w.v)).id});reject(G,(cap+1)%n,{a:'memory-ready',id:G.pending.id});reject(G,cap,{a:'memory-ready',id:G.pending.id+1});
 const saved=JSON.parse(JSON.stringify(G));preview(G);preview(saved);assert.deepEqual(G.officialState.memorySea,saved.officialState.memorySea);assert.equal(G.phase,'setup');
 for(let pi=-1;pi<n;pi++){const V=BB.view(G,pi);assert.deepEqual(V.rmark.cand,[]);assert.deepEqual(V.ymark.cand,[]);assert.equal(V.official.memorySea.point,null);}
 setup(G);assert(G.wires.every(w=>!w.info));assert.equal(G.officialState.memorySea.side.length,n);const current=BB.view(G,0).official.memorySea;assert(current.point);assert(current.side.every(t=>!('wire' in t)));assert.equal(current.point.owner,(cap+n-1)%n);
}
console.log('✓ 第50关2–5人全部队长：52／55根、已知红黄预览逐人确认后隐藏，预览不公开手牌，恢复／过期拒绝、初始旁置与一次指线');
{
 const G=rig([[2,4],[3,5],[6]]);act(G,0,{a:'dual',w:2,val:2});reply(G);assert.equal(G.det,1);assert.equal(G.wires[2].info,null);const state=BB.memorySea(G);assert.equal(state.side[0].value,3);assert.equal(state.point.wire,2);for(let pi=-1;pi<3;pi++){const m=BB.view(G,pi).official.memorySea;assert.equal(m.point.wire,2);assert(!('wire' in m.side[0]));}const snapshot=JSON.parse(JSON.stringify(G));assert.deepEqual(BB.memorySea(snapshot),state);reject(G,0,{a:'solo',val:4});assert.equal(BB.memorySea(G).point.wire,2);act(G,1,{a:'dual',w:4,val:3});assert.equal(BB.memorySea(G).point,null);assert.equal(BB.memorySea(G).side[0].value,3);
}
{
 const G=rig([[2,4],[3,3,3],[5]]);for(let i=0;i<3;i++){G.turn=0;G.det=0;act(G,0,{a:'dual',w:2+i,val:2});reply(G);assert.equal(G.wires[2+i].info,null);}
 assert.equal(BB.memorySea(G).side.length,2);assert(BB.memorySea(G).point.verbal);assert.equal(C.availableInfoTokens(G,false).filter(t=>t.value===3).length,0);
 // 当前开发按基础有限标记规则回收绑定已剪导线的旁置标记，公共旁置不公开绑定。
 G.wires[2].cut=true;G.turn=0;G.det=0;act(G,0,{a:'dual',w:4,val:2});reply(G);assert.equal(BB.memorySea(G).side.length,2);assert(!BB.memorySea(G).point.verbal);assert.equal(new Set(BB.memorySea(G).side.map(t=>t.id)).size,2);
}
{
 const G=rig([[1,4],[3,5],[6]]);G.equip=[{n:4,used:false}];for(let i=0;i<2;i++){const id=G.wires.length;G.wires.push({id,v:4,o:2,s:0,cut:true,info:null});G.players[2].stands[0].push(id);}act(G,0,{a:'equip',n:4,w:0});assert.equal(G.wires[0].info.v,1);assert.equal(BB.memorySea(G).point,null);assert.equal(BB.memorySea(G).side.length,0);
}
assert(!M.get('campaign',50).verified);
console.log('✓ 第50关失败旁置不留永久位置，下一有效行动清除指线／无效操作保留，有限标记和口头回退、开发回收、便利贴正常；公开50仍改编');
{
 const Bot=require('../js/bot'),G=game(3,0,1);while(G.phase==='memory-preview'){const who=G.pending.to;const a=Bot.decide(G,who);assert.deepEqual(a,{a:'memory-ready',id:G.pending.id});act(G,who,a);}while(G.phase==='setup'){const pi=BB.setupActor(G);act(G,pi,{a:'info',w:G.wires.find(w=>w.o===pi&&w.v===1).id});}assert.equal(BB.memorySea(G).side.length,2);assert(BB.memorySea(G).point.verbal);
}
console.log('✓ 第50关机器人逐人确认预览，实际来源三人初始都指出蓝1时只占两枚标记，第三次暂时口头提示');
{
 const fs=require('fs'),os=require('os'),path=require('path'),Service=require('../server/official'),dir=fs.mkdtempSync(path.join(os.tmpdir(),'bb50-authority-'));
 function peer(room){return {room,readyState:1,messages:[],send(raw){this.messages.push(JSON.parse(raw));}};}
 try{for(const n of [2,3,4,5]){
  const G=game(n),name='bb-memory-sea'+n,seats=G.players.map(p=>({pid:p.pid,name:p.name,bot:false,credential:'黑海凭据'+p.pid})),wss={clients:new Set()};G.catalog=G.mission.catalog='campaign';
  fs.writeFileSync(path.join(dir,name+'.json'),JSON.stringify({version:1,name,host:seats[0].pid,mid:50,ruleset:'campaign',attempts:1,started:true,seats,observers:[],revision:0,seen:[],G}));let service=Service(wss,dir),room,peers,observer;
  function connect(){peers=seats.map(s=>{const ws=peer(name);wss.clients.add(ws);service.handle(ws,'hello',{credential:s.credential,name:s.name});return ws;});observer=peer(name);wss.clients.add(observer);service.handle(observer,'hello',{spectator:true,name:'黑海观众'});room=service.load(name);}
  function send(pi,id,a){service.handle(peers[pi],'official:act',{gid:room.G.gid,revision:room.revision,commandId:id,action:a});}
  connect();let count=0;
  while(room.G.phase==='memory-preview'){
   const who=room.G.pending.to,id=room.G.pending.id;service.handle(peers[0],'official:pause',{gid:room.G.gid,revision:room.revision,commandId:'暂停记忆'+count,paused:true});const frozen=JSON.stringify(room.G);send(who,'暂停确认'+count,{a:'memory-ready',id});assert.equal(JSON.stringify(room.G),frozen);
   wss.clients.forEach(ws=>ws.readyState=3);service=Service(wss,dir);connect();assert(room.G.paused);assert.equal(room.G.pending.to,who);assert.equal(room.G.pending.ready.length,count);service.handle(peers[0],'official:pause',{gid:room.G.gid,revision:room.revision,commandId:'继续记忆'+count,paused:false});
   const before=JSON.stringify(room.G);send((who+1)%n,'冒用确认'+count,{a:'memory-ready',id});assert.equal(JSON.stringify(room.G),before);send(who,'过期确认'+count,{a:'memory-ready',id:id-1});assert.equal(JSON.stringify(room.G),before);send(who,'真实确认'+count,{a:'memory-ready',id});const revision=room.revision;send(who,'真实确认'+count,{a:'memory-ready',id});assert.equal(room.revision,revision);count++;
  }assert.equal(count,n);assert.equal(room.G.phase,'setup');
  const publicView=observer.messages.filter(m=>m.topic==='official:view').at(-1).data.view;assert.deepEqual(publicView.rmark.cand,[]);assert.deepEqual(publicView.ymark.cand,[]);
  let marks=0;while(room.G.phase==='setup'){const who=BB.setupActor(room.G),wire=room.G.wires.find(w=>w.o===who&&BB.setupInfoAllowed(room.G,w));send(who,'记忆初始'+marks,{a:'info',w:wire.id});const point=BB.view(room.G,-1).official.memorySea.point;assert.equal(point.wire,wire.id);assert(room.G.wires.every(w=>!w.info));marks++;}
  const lastPoint=JSON.parse(JSON.stringify(BB.memorySea(room.G).point));wss.clients.forEach(ws=>ws.readyState=3);service=Service(wss,dir);connect();assert.deepEqual(BB.memorySea(room.G).point,lastPoint);assert.equal(room.G.phase,'play');assert(BB.view(room.G,-1).official.memorySea.side.every(t=>!('wire' in t)));
 }}finally{fs.rmSync(dir,{recursive:true,force:true});}
 console.log('✓ 第50关2–5人权威：每次预览确认暂停／重启／凭据重连、冒用／过期／重复拒绝，观战同步隐藏候选；初始指线／旁置保存恢复不公开历史位置');
}
{
 const fs=require('fs'),os=require('os'),path=require('path'),Service=require('../server/official'),dir=fs.mkdtempSync(path.join(os.tmpdir(),'bb50-legacy-'));
 try{for(const n of [2,3,4,5]){
  const seats=Array.from({length:n},(_,i)=>({pid:'p'+i,name:'旧黑海任务'+i,credential:'旧黑海凭证'+i,bot:false})),mission=JSON.parse(JSON.stringify(M.get('custom',50)));mission.catalog='campaign';mission.contentVersion=17;
  const G=BB.createGame(mission,seats,{rng:rng(n*104729)});G.catalog='campaign';G.contentVersion=17;const name='bb-legacy50-'+n,before=JSON.stringify(G.mission);
  fs.writeFileSync(path.join(dir,name+'.json'),JSON.stringify({version:1,name,host:seats[0].pid,mid:50,ruleset:'campaign',attempts:1,started:true,seats,observers:[],revision:0,seen:[],G}));
  const restored=Service({clients:new Set()},dir).load(name).G;assert.equal(JSON.stringify(restored.mission),before);assert.equal(restored.contentVersion,17);assert(!restored.officialState);assert.equal(restored.ruleset,'custom');assert.deepEqual(restored.ymark,G.ymark);assert.deepEqual(restored.rmark,G.rmark);assert.equal(restored.detMax,G.detMax);assert.equal(BB.view(restored,0).official,null);assert(!BB.memorySea(restored));
 }}finally{fs.rmSync(dir,{recursive:true,force:true});}
 console.log('✓ 第50关2–5人版本17改编存档保留原任务、红黄设置和引爆器，不追加记忆规则');
}

{
 const Bot=require('../js/bot');let G,value,target;
 for(let seed=1;seed<100;seed++){G=BB.createGame(M.get('official-development',50),Array.from({length:3},(_,i)=>({pid:'p'+i,name:'记忆机器人'+i,bot:true})),{rng:rng(seed),captain:0});const own=G.wires.filter(w=>w.o===0&&Number.isInteger(w.v));const wire=own.find(w=>own.filter(x=>x.v===w.v).length===1&&G.wires.some(x=>x.o===1&&x.v===w.v));if(wire){value=wire.v;target=G.wires.find(w=>w.o===1&&w.v===value);break;}}
 assert(target);const previewRed=G.rmark.cand.slice(),previewYellow=G.ymark.cand.slice();preview(G);while(G.phase==='setup'){const pi=BB.setupActor(G);act(G,pi,{a:'info',w:pi===1?target.id:G.wires.find(w=>w.o===pi&&Number.isInteger(w.v)).id});}
 const memories=G.officialState.memorySea.botMemories;for(let pi=0;pi<3;pi++){assert.deepEqual(memories[pi].red,previewRed);assert.deepEqual(memories[pi].yellow,previewYellow);assert.equal(memories[pi].clues[target.id].info.v,value);assert(!('botMemories' in BB.view(G,pi).official.memorySea));}assert(!('botMemories' in BB.view(G,-1).official.memorySea));assert(!('botMemories' in BB.packPublic(G).official.memorySea));assert.equal(G.wires[target.id].info,null);
 const restored=JSON.parse(JSON.stringify(G));assert.deepEqual(restored.officialState.memorySea.botMemories,memories);const privateInput=Bot.memoryInput(restored,0);assert.equal(privateInput.wires[target.id].info.v,value);assert.equal(restored.wires[target.id].info,null);
 // 未公开线值与内部候选变化不会替换机器人实际记住的数字或推理边界。
 const changed=JSON.parse(JSON.stringify(restored));changed.rmark.cand=[11.5,10.5];changed.ymark.cand=[1.1,2.1];changed.wires.forEach(w=>{if(w.o!==0&&!w.cut)w.v=12;});const random=Math.random;let originalInference,changedInference;try{Math.random=rng(999);originalInference=Bot.infer(Bot.memoryInput(restored,0),0,200);Math.random=rng(999);changedInference=Bot.infer(Bot.memoryInput(changed,0),0,200);}finally{Math.random=random;}assert.deepEqual(originalInference,changedInference);
 // 公开交换导致原线架排序变化时，不再沿用旧位置的记忆；不读取交换后的秘密值。
 const moved=JSON.parse(JSON.stringify(restored));moved.players[1].stands[0].reverse();BB.observeMemoryBots(moved);assert.equal(moved.officialState.memorySea.botMemories[0].clues[target.id],undefined);
 const before=JSON.stringify(restored.officialState.memorySea.botMemories);reject(restored,1,{a:'dual',val:value,w:0});assert.equal(JSON.stringify(restored.officialState.memorySea.botMemories),before);
}
console.log('✓ 第50关机器人只记住已看过的红黄／公共指线，私有记忆不进入玩家／观战视图；保存恢复、隐藏值／内部候选变更推理不变、旧线架变化失效和拒绝不变');
{
 const Bot=require('../js/bot'),originalRandom=Math.random,roles=Object.keys(BB.CHARACTERS),totals={won:0,lost:0};let observations=0;
 try{for(const n of [2,3,4,5])for(let rotation=0;rotation<roles.length;rotation++)for(let seed=1;seed<=2;seed++){
  Math.random=rng((rotation+1)*100003+seed*104729+n);const captain=seed%n,seats=Array.from({length:n},(_,pi)=>({pid:'p'+pi,name:'黑海角色机器人'+pi,bot:true,character:pi===captain?'double-detector':roles[(rotation+pi-(pi>captain?1:0))%roles.length]}));let G=BB.createGame(M.get('official-development',50),seats,{captain,rng:Math.random}),steps=0;
  while(!['won','lost'].includes(G.phase)&&steps<600){let acted=false;for(let pi=0;pi<n;pi++){const a=Bot.decide(G,pi);if(!a)continue;act(G,pi,a);steps++;acted=true;break;}assert(acted||['won','lost'].includes(G.phase),'第50关机器人不能停止合法回合或私人回应');if(G.officialState.memorySea.point)observations++;if(steps%17===0)G=JSON.parse(JSON.stringify(G));}
  assert(['won','lost'].includes(G.phase));totals[G.phase]++;
 }}finally{Math.random=originalRandom;}
 console.log('✓ 第50关2–5人五种角色40局：'+totals.won+'胜、'+totals.lost+'败，'+observations+'次公开指线观察；非法／停止／超限0，过程保存恢复；不认证例外或策略充分性');
}
