const assert=require('assert'),BB=require('../js/engine'),{create,unlock}=require('./emergency-reserve.fixture');
function event(G){return {gid:G.gid,n:15};}function apply(G){assert.equal(BB.applyEquipmentEffect(G,event(G),{serverEquipment:true}),null);}
function reject(G,e=event(G),opts={serverEquipment:true}){const before=JSON.stringify(G);assert(BB.applyEquipmentEffect(G,e,opts));assert.equal(JSON.stringify(G),before);}
assert.equal(BB.EQUIP[15].id,'emergency-reserve');assert.equal(BB.equipmentLabel(15),'3·3');assert(BB.EQUIP[15].activationPending);
for(const n of [2,3,4,5])for(let cap=0;cap<n;cap++){
 const G=create(n,cap),all3=G.wires.filter(w=>w.v===3);all3.slice(0,2).forEach(w=>w.cut=true);reject(G);unlock(G);reject(G,event(G),{});reject(G,{gid:'旧游戏',n:15});reject(G,{gid:G.gid,n:16});
 for(const state of ['paused','pending']){G[state]=true;reject(G);G[state]=state==='pending'?null:false;}
 const client=JSON.stringify(G);assert(BB.act(G,cap,{a:'equip',n:15}));assert.equal(JSON.stringify(G),client);assert(BB.act(G,cap,{a:'equipment-effect',event:event(G),serverEquipment:true}));assert.equal(JSON.stringify(G),client);
 const players=JSON.stringify(G.players),wires=JSON.stringify(G.wires),turn=G.turn,turnNo=G.turnNo,det=G.det,deadline=G.deadline,copy=JSON.parse(JSON.stringify(G));apply(G);apply(copy);assert.deepEqual(copy,G);assert(G.equip.find(e=>e.n===15).used);assert(G.equip.filter(e=>e.n!==15).every(e=>!e.used));assert.equal(JSON.stringify(G.players),players);assert.equal(JSON.stringify(G.wires),wires);assert.equal(G.turn,turn);assert.equal(G.turnNo,turnNo);assert.equal(G.det,det);assert.equal(G.deadline,deadline);
 const once=JSON.stringify(G);apply(G);assert.equal(JSON.stringify(G),once);assert.equal(BB.act(G,cap,{a:'equip',n:7,players:[0]}),null);assert.equal(G.players[0].dd,1);assert(G.players.slice(1).every(p=>!p.dd));assert(G.equip.find(e=>e.n===7).used);const afterReuse=JSON.stringify(G);apply(G);assert.equal(JSON.stringify(G),afterReuse,'重复恢复事件不能再次恢复随后重新用过的电池');
 for(let viewer=-1;viewer<n;viewer++){const V=BB.view(G,viewer);assert(V.equip.find(e=>e.n===15).used);assert(V.equip.filter(e=>![15,7].includes(e.n)).every(e=>!e.used));}
}
{
 const G=create(3);unlock(G);G.equip=G.equip.filter(e=>e.n===15);apply(G);assert(G.equip[0].used);const fatal=create(3);unlock(fatal);fatal.det=fatal.detMax;reject(fatal);const hidden=create(3);unlock(hidden);hidden.equip.find(e=>e.n===15).hidden=true;reject(hidden);
 const roles=create(5);unlock(roles);['double-detector','triple-detector','xy-ray','general-radar','walkie-talkies'].forEach((id,i)=>roles.players[i].character={id,used:true});roles.players[4].character.removed=true;const characters=JSON.stringify(roles.players);apply(roles);assert.equal(JSON.stringify(roles.players),characters);
}
console.log('✓ 应急储备箱内部组件2–5人全部队长：四根3解锁、仅恢复此前已用共享装备／自身消耗、角色／导线／回合／计时不变；恢复后电池可再次合法使用，重复事件不重复恢复；错误／暂停／待决定／引爆／客户端伪造不变，自动触发时机未启用');
{
 const fs=require('fs'),os=require('os'),path=require('path'),Service=require('../server/official'),dir=fs.mkdtempSync(path.join(os.tmpdir(),'bb55-reserve-authority-'));
 function peer(room){return {room,readyState:1,messages:[],send(raw){this.messages.push(JSON.parse(raw));}};}function last(ws,t){return ws.messages.filter(m=>m.topic===t).at(-1)?.data;}
 try{for(const n of [2,3,4,5]){
  let G=create(n);unlock(G);G.catalog=G.mission.catalog='campaign';const name='bb-reserve'+n,seats=G.players.map(p=>({pid:p.pid,name:p.name,bot:false,credential:'储备凭据'+p.pid})),wss={clients:new Set()};fs.writeFileSync(path.join(dir,name+'.json'),JSON.stringify({version:1,name,host:seats[0].pid,mid:55,ruleset:'campaign',attempts:1,started:true,seats,observers:[],revision:0,seen:[],G}));let service=Service(wss,dir),room,peers,observer,credential;
  function connect(){peers=seats.map(s=>{const ws=peer(name);wss.clients.add(ws);service.handle(ws,'hello',{credential:s.credential,name:s.name});return ws;});observer=peer(name);wss.clients.add(observer);service.handle(observer,'hello',credential?{credential,name:'储备观众'}:{spectator:true,name:'储备观众'});credential=last(observer,'official:welcome').credential;room=service.load(name);G=room.G;}
  connect();const before=JSON.stringify(G);service.handle(peers[0],'official:act',{gid:G.gid,revision:room.revision,commandId:'伪造恢复',action:{a:'equipment-effect',event:event(G),serverEquipment:true}});assert.equal(JSON.stringify(G),before);service.handle(peers[0],'official:pause',{gid:G.gid,revision:room.revision,commandId:'暂停储备',paused:true});const paused=JSON.stringify(G);assert(service.applyEquipmentEffect(name,event(G)));assert.equal(JSON.stringify(G),paused);wss.clients.forEach(ws=>ws.readyState=3);service=Service(wss,dir);connect();assert(G.paused);assert(!G.equip.find(e=>e.n===15).used);service.handle(peers[0],'official:pause',{gid:G.gid,revision:room.revision,commandId:'继续储备',paused:false});
  const revision=room.revision,players=JSON.stringify(G.players),turn=G.turnNo;assert.equal(service.applyEquipmentEffect(name,event(G)),null);assert.equal(room.revision,revision+1);assert.equal(JSON.stringify(G.players),players);assert.equal(G.turnNo,turn);assert(G.equip.find(e=>e.n===15).used);const done=JSON.stringify(G),rev=room.revision;assert.equal(service.applyEquipmentEffect(name,event(G)),null);assert.equal(JSON.stringify(G),done);assert.equal(room.revision,rev);
  for(const ws of [...peers,observer]){const V=last(ws,'official:view').view;assert(V.equip.find(e=>e.n===15).used);assert(V.equip.filter(e=>e.n!==15).every(e=>!e.used));assert(V.players.every(p=>p.character.used&&!p.dd));}
  wss.clients.forEach(ws=>ws.readyState=3);service=Service(wss,dir);connect();assert.equal(service.applyEquipmentEffect(name,event(G)),null);assert.equal(room.revision,rev);assert.equal(JSON.stringify(G),done);wss.clients.forEach(ws=>ws.readyState=3);
 }}finally{fs.rmSync(dir,{recursive:true,force:true});}
}
console.log('✓ 储备箱2–5人内部权威结算：客户端无入口、暂停／重启／凭据重连、效果只增一次修订、玩家与观战同步共享状态，个人卡不恢复，重启重复事件不重用；实际自动触发未认证');
{
 const fixture=require('./vip-pass.fixture');for(const n of [1,12]){
  const G=fixture.create(3);G.equip=[{n,id:n===1?'label-different':'label-equal',used:false},{n:15,id:'emergency-reserve',used:false}];for(const value of [n,3])G.wires.filter(w=>w.v===value).slice(0,value===3?4:2).forEach(w=>w.cut=true);
  const pairs=[];for(const rack of G.players[0].stands)for(let i=0;i<rack.length-1;i++){const a=G.wires[rack[i]],b=G.wires[rack[i+1]],same=BB.annOf(a)===BB.annOf(b);if(!(a.cut&&b.cut)&&same===(n===12))pairs.push([a.id,b.id]);}assert(pairs.length);const first=pairs[0],second=pairs.at(-1);assert.equal(BB.act(G,0,{a:'equip',n,w1:first[0],w2:first[1]}),null);assert.equal(G.labels.length,1);apply(G);assert.equal(BB.act(G,0,{a:'equip',n,w1:second[0],w2:second[1]}),null);assert.equal(G.labels.length,1,'实体仅有一枚对应标签，恢复再用需要移走原标记');assert.deepEqual(G.labels[0],{a:second[0],b:second[1],t:n===1?'ne':'eq'});
 }
}
console.log('✓ 储备箱恢复=／≠后再用移动原标记，实体标签各仅一枚，不生成额外副本；旧改编行为保留');
