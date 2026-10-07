const assert=require('assert'),BB=require('../js/engine'),M=require('../js/missions'),Bot=require('../js/bot');
function rng(seed=40){return()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);}
const seats=n=>Array.from({length:n},(_,i)=>({pid:'p'+i,name:'玩家'+i}));
function game(n=3,captain=0,seed=40){return BB.createGame(M.get('official-development',40),seats(n),{captain,rng:rng(seed)});}
function act(G,pi,a){assert.equal(BB.act(G,pi,a),null,JSON.stringify(a));}
function reject(G,pi,a){const before=JSON.stringify(G);assert(BB.act(G,pi,a));assert.equal(JSON.stringify(G),before);}
function test(name,f){f();console.log('✓',name);}
function rig(hands=[[3,3,4],[2,4,4],[1,2,3]]){const G=game(hands.length);G.wires=[];G.players.forEach(p=>p.stands=[[]]);hands.forEach((hand,o)=>hand.forEach(v=>{const id=G.wires.length;G.wires.push({id,v,o,s:0,cut:false,info:null});G.players[o].stands[0].push(id);}));G.phase='play';G.turn=0;G.pending=null;G.equip=[];return G;}
function gear(G,n){G.equip.push({n,id:BB.EQUIP[n].id,used:false});for(let k=0;k<2;k++){const id=G.wires.length;G.wires.push({id,v:n,o:G.np-1,s:0,cut:true,info:null});G.players.at(-1).stands[0].push(id);}}
function resolve(G,w){const pd=G.pending;act(G,pd.to,{a:'resolve',id:pd.id,w:w??BB.view(G,pd.to).pending.choices[0]});}

test('第40关2–5人全部队长：48蓝、3已知红、无黄，类型从队长顺时针固定交替',()=>{
 for(let n=2;n<=5;n++)for(let cap=0;cap<n;cap++)for(let seed=1;seed<=20;seed++){
  const G=game(n,cap,seed*104729);assert.equal(G.wires.length,51);assert.equal(G.rmark.n,3);assert.equal(G.rmark.cand.length,3);assert.equal(G.ymark.n,0);assert.equal(G.equip.length,n);
  for(let pi=0;pi<n;pi++){const expected=((pi-cap+n)%n)%2===0?'frequency':'parity';assert.equal(BB.clueKind(G,pi),expected);assert.equal(BB.setupNeed(G,pi),n===2&&pi===cap?0:1);const V=BB.view(G,pi);assert.equal(BB.clueKind(V,pi),expected);assert.equal(V.official.clueKinds[pi],expected);V.players.forEach((p,owner)=>p.stands.flat().forEach(w=>{if(owner!==pi)assert.equal(w.v,null);}));}
  while(G.phase==='setup'){const pi=BB.setupActor(G);act(G,pi,Bot.decide(G,pi));}
  assert.equal(G.turn,cap);G.wires.filter(w=>w.info).forEach(w=>{assert(BB.clueKind(G,w.o)==='frequency'?w.info.t==='freq':['odd','even'].includes(w.info.t));});
  G.players.forEach((p,pi)=>p.stands.forEach(st=>assert.deepEqual(st.map(id=>G.wires[id].v),st.map(id=>G.wires[id].v).slice().sort((a,b)=>a-b))));
 }
});

test('拆错按目标玩家的类型提供线索；频率包括同排已剪线，不合并两架',()=>{
 const G=rig();act(G,0,{a:'dual',w:G.wires.find(w=>w.o===1&&w.v===2).id,val:3});resolve(G);assert.equal(G.wires.find(w=>w.o===1&&w.v===2).info.t,'even');
 const H=rig();H.turn=1;const target=H.wires.find(w=>w.o===0&&w.v===3);H.wires.find(w=>w.o===0&&w.v===3&&w.id!==target.id).cut=true;act(H,1,{a:'dual',w:target.id,val:2});resolve(H);assert.deepEqual(H.wires[target.id].info,{t:'freq',v:2});
 const I=rig([[4,4,4,4],[1,2],[1,2]]);gear(I,4);act(I,0,{a:'equip',n:4,w:0});assert.deepEqual(I.wires[0].info,{t:'freq',v:2,copies:2});
});

test('两种玩家都可用便利贴标已剪蓝线，红线不能标，拒绝不耗牌或改状态',()=>{
 for(const pi of [0,1]){const G=rig();gear(G,4);const w=G.wires.find(w=>w.o===pi&&w.v!==4);w.cut=true;act(G,pi,{a:'equip',n:4,w:w.id});assert(BB.clueKind(G,pi)==='frequency'?G.wires[w.id].info.t==='freq':['odd','even'].includes(G.wires[w.id].info.t));}
 const H=rig([[1.5,2],[1,2],[1,2]]);gear(H,4);reject(H,0,{a:'equip',n:4,w:0});assert(!H.equip[0].used);
});

test('对讲机交换时两类附着标记均丢弃，玩家类型固定，决定持久且过期回复拒绝',()=>{
 const G=rig();gear(G,2);const own=G.wires.find(w=>w.o===0&&w.v===3),other=G.wires.find(w=>w.o===1&&w.v===4);own.info={t:'freq',v:2};other.info={t:'even'};
 act(G,0,{a:'equip',n:2,w:own.id,p:1});const saved=JSON.parse(JSON.stringify(G));reject(G,1,{a:'walkie',id:G.pending.id-1,w:other.id});act(saved,1,{a:'walkie',id:saved.pending.id,w:other.id});assert.equal(saved.wires[own.id].info,null);assert.equal(saved.wires[other.id].info,null);assert.equal(BB.clueKind(saved,0),'frequency');assert.equal(BB.clueKind(saved,1),'parity');
});

test('混合标记共用有限供应，耗尽用当前口头提示，不复制永久标记',()=>{
 const G=rig();gear(G,4);for(let k=0;k<7;k++){const id=G.wires.length;G.wires.push({id,v:6+k,o:2,s:0,cut:false,info:{t:'freq',v:1}});G.players[2].stands[0].push(id);}const w=G.wires.find(w=>w.o===0&&w.v===4);act(G,0,{a:'equip',n:4,w:w.id});assert(!G.wires[w.id].info);assert.deepEqual(G.announcement.info,{t:'freq',v:1});
 const old=BB.createGame(M.get('custom',40),seats(3),{rng:rng()});assert.equal(BB.clueKind(old,0),null);assert.equal(M.get('campaign',40).verified,false);
});

test('第40关100局来源设置全信息通关、64局混合线索机器人合法终局',()=>{
 let actions=0;for(let n=2;n<=5;n++)for(let seed=1;seed<=25;seed++){
 const G=game(n,seed%n,seed*104729);for(let k=0;k<1000&&!['won','lost'].includes(G.phase);k++){
  const pi=G.pending?G.pending.to:G.phase==='setup'?BB.setupActor(G):G.turn;let a;
  if(G.phase==='setup')a=Bot.decide(G,pi);else if(G.pending){const pd=G.pending;a={a:'resolve',id:pd.id,w:pd.step==='own'?BB.view(G,pi).pending.choices.at(-1):pd.ids.find(id=>pd.vals.some(v=>BB.matches(G.wires[id],v)))};}else{
   const own=G.wires.filter(w=>w.o===pi&&!w.cut);if(own.every(w=>BB.kindOf(w)==='r'))a={a:'red'};else{const value=own.find(w=>BB.kindOf(w)==='b').v,target=G.wires.find(w=>w.o!==pi&&!w.cut&&w.v===value);a=BB.soloOk(G,pi,value)?{a:'solo',val:value}:{a:'dual',w:target.id,val:value};}
  }assert(a);act(G,pi,a);actions++;
 }assert.equal(G.phase,'won');}
 for(let n=2;n<=5;n++)for(let seed=1;seed<=16;seed++){const G=game(n,0,seed*104729);for(let k=0;k<1000&&!['won','lost'].includes(G.phase);k++){const pi=G.pending?G.pending.to:G.phase==='setup'?BB.setupActor(G):G.turn,a=Bot.decide(G,pi);assert(a);act(G,pi,a);}assert(['won','lost'].includes(G.phase));}
 console.log('  100局通关，共'+actions+'个合法动作；64局机器人合法终局。');
});

test('第40关2–5人权威联机：公开类型、私有响应、暂停、重连重启与过期去重',()=>{
 const fs=require('fs'),os=require('os'),path=require('path'),Service=require('../server/official'),dir=fs.mkdtempSync(path.join(os.tmpdir(),'bb40-authority-')),wss={clients:new Set()},svc=Service(wss,dir);
 const last=(ws,topic)=>ws.messages.filter(m=>m.topic===topic).at(-1)?.data;function peer(room){const ws={room,readyState:1,messages:[],send(raw){this.messages.push(JSON.parse(raw));}};wss.clients.add(ws);return ws;}
 try{for(let n=2;n<=5;n++){
  const name='bb-mixed'+n,peers=Array.from({length:n},()=>peer(name));peers.forEach((ws,pi)=>svc.handle(ws,pi?'hello':'official:hello',{ruleset:'campaign',mid:40,name:'标记玩家'+pi}));const room=svc.load(name);svc.handle(peers[0],'official:start',{mid:40,revision:room.revision,commandId:'开始'});
  room.G=game(n,0,n*104729);const G=room.G;G.catalog=G.mission.catalog='campaign';G.players.forEach((p,pi)=>{p.pid=room.seats[pi].pid;p.name=room.seats[pi].name;});
  function send(pi,id,a,service=svc,state=room,ws=peers[pi]){service.handle(ws,'official:act',{gid:state.G.gid,revision:state.revision,commandId:id,pi:(pi+1)%n,action:a});}
  let k=0;while(G.phase==='setup'){const pi=BB.setupActor(G);send(pi,'标记'+k++,Bot.decide(G,pi));}
  peers.forEach((ws,pi)=>{const V=last(ws,'official:view').view;assert.deepEqual(V.official.clueKinds,G.players.map((_,p)=>BB.clueKind(G,p)));assert.equal(V.me,pi);});
  const own=G.wires.filter(w=>w.o===0&&!w.cut&&Number.isInteger(w.v)),value=own.find(w=>G.wires.some(x=>x.o!==0&&x.v===w.v)).v,target=G.wires.find(w=>w.o!==0&&w.v===value);send(0,'宣告',{a:'dual',w:target.id,val:value});const decision=G.pending.id;
  peers.forEach((ws,pi)=>assert.equal('choices' in last(ws,'official:view').view.pending,pi===target.o));
  svc.handle(peers[0],'official:pause',{gid:G.gid,revision:room.revision,commandId:'暂停',paused:true});const frozen=JSON.stringify(G);send(target.o,'暂停中回应',{a:'resolve',id:decision,w:target.id});assert.equal(JSON.stringify(G),frozen);svc.handle(peers[0],'official:pause',{gid:G.gid,revision:room.revision,commandId:'继续',paused:false});
  send(target.o,'目标回应',{a:'resolve',id:decision,w:target.id});const credential=last(peers[0],'official:welcome').credential,reconnect=peer(name);svc.handle(reconnect,'hello',{credential,name:'标记玩家0'});const service=Service(wss,dir),state=service.load(name);assert.equal(state.G.pending.step,'own');assert.equal(BB.clueKind(state.G,0),'frequency');
  const saved=JSON.stringify(state.G);send(0,'旧选择',{a:'resolve',id:decision-1,w:own[0].id},service,state,reconnect);assert.equal(JSON.stringify(state.G),saved);const choice=BB.view(state.G,0).pending.choices.at(-1);send(0,'选自己的线',{a:'resolve',id:decision,w:choice},service,state,reconnect);const revision=state.revision;send(0,'选自己的线',{a:'resolve',id:decision,w:choice},service,state,reconnect);assert.equal(state.revision,revision);assert(state.G.wires[choice].cut&&state.G.wires[target.id].cut);
 }}finally{fs.rmSync(dir,{recursive:true,force:true});}
});
