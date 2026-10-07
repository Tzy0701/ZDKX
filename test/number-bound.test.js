const assert=require('assert'),BB=require('../js/engine'),M=require('../js/missions'),{game,setup,assign}=require('./number-bound.fixture');
function bind(G,value,id){const b=G.officialState.constraints.bindings,i=b.indexOf(id);[b[i],b[value-1]]=[b[value-1],b[i]];}
function act(G,p,a){assert.equal(BB.act(G,p,a),null,JSON.stringify(a));}function reject(G,p,a){const before=JSON.stringify(G);assert(BB.act(G,p,a));assert.equal(JSON.stringify(G),before);}
for(const n of [2,3,4,5])for(let cap=0;cap<n;cap++)for(let seed=1;seed<=12;seed++){
 const G=game(n,cap,seed),s=G.officialState.constraints;assert.equal(G.wires.length,n===2?50:49);assert.equal(G.rmark.n,n===2?2:1);assert.equal(G.rmark.cand.length,G.rmark.n);assert.equal(G.ymark.n,0);assert.equal(s.bindings.length,12);assert.equal(new Set(s.bindings).size,12);assert.equal(s.active,null);assert(G.equip.every(e=>e.n!==17));setup(G);assert.equal(G.phase,'play');assert.equal(G.deadline,null);assert(G.players.every((_,p)=>G.setup[p]===1));for(let p=-1;p<n;p++){const c=BB.view(G,p).official.constraints;assert.equal(c.kind,'bound');assert.equal(c.bindings.length,12);assert.equal(c.remaining,12);assert.equal(c.active,null);}
}
console.log('✓ 第57关2–5人所有队长：49／50根、已知红1／双人2无黄、十二数字唯一绑定A–L全公开、最初无限制、排除分解器、普通初始／无虚构倒计时');
{
 const G=game(3);setup(G);assign(G,1,0);assign(G,2,1);const s=G.officialState.constraints;bind(G,1,'A');bind(G,2,'B');act(G,0,{a:'solo',val:1});assert.equal(s.active,'A');assert.deepEqual(s.completed,[1]);assert.equal(G.det,0);const copy=JSON.parse(JSON.stringify(G));act(G,1,{a:'solo',val:2});act(copy,1,{a:'solo',val:2});assert.deepEqual(copy,G);assert.equal(G.officialState.constraints.active,'B');assert.deepEqual(G.officialState.constraints.completed,[1,2]);const p=G.turn,even=G.wires.find(w=>w.o===p&&!w.cut&&w.v%2===0);reject(G,p,{a:'dual',w:G.wires.find(w=>w.o!==p&&!w.cut).id,val:even.v});
}
{
 const G=game(3);setup(G);assign(G,1,0);G.wires.filter(w=>w.o===1).forEach(w=>w.cut=true);bind(G,1,'A');act(G,0,{a:'solo',val:1});assert.notEqual(G.turn,1);assert.equal(G.det,0);
 const trapped=game(3);setup(trapped);assign(trapped,1,0);assign(trapped,2,0);trapped.wires.filter(w=>![1,2].includes(w.v)).forEach(w=>w.cut=true);bind(trapped,1,'K');trapped.officialState.constraints.completed=Array.from({length:10},(_,i)=>i+3);trapped.officialState.constraints.active=trapped.officialState.constraints.bindings.find((id,i)=>i>=2&&'BCFGHIJL'.includes(id));act(trapped,0,{a:'solo',val:1});assert.equal(trapped.phase,'lost');assert.equal(trapped.det,0);
 const saved=game(3);setup(saved);assign(saved,2,0);saved.wires.filter(w=>w.v!==2).forEach(w=>w.cut=true);saved.officialState.constraints.active='K';saved.paused=true;assert(BB.recoverFatalState(saved));assert.equal(saved.phase,'lost');assert.equal(saved.paused,false);assert(!BB.recoverFatalState(saved));
 const red=game(3);setup(red);const r=red.wires.find(w=>BB.kindOf(w)==='r'),owner=r.o;red.wires.filter(w=>w.o===owner&&w.id!==r.id).forEach(w=>w.cut=true);red.turn=owner;red.officialState.constraints.active='A';act(red,owner,{a:'red'});assert(red.wires[r.id].cut);assert.equal(red.det,0);
}
console.log('✓ 第57关四根完成后立即换绑定限制／不重复、保存恢复一致、当前限制校验、空手免费跳过／引爆器不动、全队无行动直接引爆、红线公开不受数值限制');
{
 const G=game(3);setup(G);assign(G,1,0);const ones=G.wires.filter(w=>w.v===1);ones.slice(2).forEach(w=>{w.o=1;w.s=0;});G.players.forEach((p,o)=>p.stands=p.stands.map((_,s)=>G.wires.filter(w=>w.o===o&&w.s===s).sort((a,b)=>a.v-b.v||a.id-b.id).map(w=>w.id)));G.officialState.constraints.active='K';bind(G,1,'A');G.turn=0;
 reject(G,0,{a:'solo',val:1});
 for(let pair=0;pair<2;pair++){const actor=G.turn,target=G.wires.find(w=>w.v===1&&!w.cut&&w.o!==actor),own=G.wires.find(w=>w.v===1&&!w.cut&&w.o===actor);assert(own&&target);act(G,actor,{a:'dual',val:1,w:target.id});const id=G.pending.id;act(G,target.o,{a:'resolve',id,w:target.id});assert.equal(G.officialState.constraints.active,'K');assert.equal(G.pending.step,'own');act(G,actor,{a:'resolve',id,w:own.id});assert.equal(BB.cutCount(G,1),(pair+1)*2);assert.equal(G.officialState.constraints.active,pair===0?'K':'A');}
 assert.equal(G.det,0);
}
console.log('✓ 第57关限制K只禁止单拆，真实双拆仍合法；两次目标／本人公开选择完成四根后才换A，不误跳过或增加引爆器');
{
 const G=game(3);setup(G);assign(G,2,0);assign(G,3,1);assign(G,4,2);G.wires.filter(w=>![2,3,4].includes(w.v)).forEach(w=>w.cut=true);bind(G,2,'A');const s=G.officialState.constraints;s.completed=Array.from({length:12},(_,i)=>i+1).filter(v=>![2,3,4].includes(v));s.active=s.bindings.find((id,i)=>s.completed.includes(i+1)&&'CF GHIJL'.replace(' ','').includes(id));act(G,0,{a:'solo',val:2});assert.equal(G.turn,2);assert.equal(G.turnNo,3);assert.equal(G.det,0);assert.equal(G.officialState.constraints.active,'A');
}
console.log('✓ 第57关非空手但只有奇数的玩家在偶数限制下真实免费跳过，下一合法玩家接班，不误改引爆器');
{
 const G=game(3);setup(G);assign(G,3,1);G.wires.filter(w=>![2,3].includes(w.v)).forEach(w=>w.cut=true);const twos=G.wires.filter(w=>w.v===2);twos.forEach((w,i)=>{w.o=i===0?1:0;w.s=0;w.cut=i>=2;w.info=null;});G.players.forEach((p,o)=>p.stands=p.stands.map((_,s)=>G.wires.filter(w=>w.o===o&&w.s===s).sort((a,b)=>a.v-b.v||a.id-b.id).map(w=>w.id)));bind(G,1,'A');bind(G,2,'B');G.officialState.constraints.active='A';G.officialState.constraints.completed=Array.from({length:12},(_,i)=>i+1).filter(v=>![2,3].includes(v));G.equip=[{n:18,id:'grapple',used:false}];G.turn=1;
 act(G,0,{a:'equip',n:18,w:twos[0].id});assert.equal(G.pending.type,'grapple');assert.equal(G.turn,1,'私人放架决定不能被自动跳过打断');const saved=JSON.parse(JSON.stringify(G)),id=G.pending.id;act(G,0,{a:'grapple-rack',id,rack:0});act(saved,0,{a:'grapple-rack',id,rack:0});assert.deepEqual(saved,G);assert.equal(G.turn,0);assert.equal(G.det,0);assert.equal(G.turnNo,2);assert.equal(G.officialState.constraints.active,'A');act(G,0,{a:'solo',val:2});assert.equal(G.officialState.constraints.active,'B');act(G,1,{a:'solo',val:3});assert.equal(G.phase,'won');
}
console.log('✓ 第57关真实非回合抓钩改变当前玩家合法值：私人放架前不打断，完成后免费跳到可行动玩家，保存恢复一致且限制不提前更换，随后正常两次单拆获胜；后段非整局证明');
{
 const fs=require('fs'),os=require('os'),path=require('path'),Service=require('../server/official'),dir=fs.mkdtempSync(path.join(os.tmpdir(),'bb57-authority-'));
 function peer(room){return {room,readyState:1,messages:[],send(raw){this.messages.push(JSON.parse(raw));}};}function last(ws,t){return ws.messages.filter(m=>m.topic===t).at(-1)?.data;}
 try{for(const n of [2,3,4,5]){
  let G=game(n);setup(G);bind(G,1,'G');const ones=G.wires.filter(w=>w.v===1);ones.forEach((w,i)=>{w.o=i===0?0:1;w.s=0;w.cut=i>=2;w.info=null;});G.players.forEach((p,o)=>p.stands=p.stands.map((_,s)=>G.wires.filter(w=>w.o===o&&w.s===s).sort((a,b)=>a.v-b.v||a.id-b.id).map(w=>w.id)));const own=ones[0].id,target=ones[1].id,name='bb-bound'+n,seats=G.players.map(p=>({pid:p.pid,name:p.name,bot:false,credential:'绑定凭据'+p.pid})),wss={clients:new Set()};G.catalog=G.mission.catalog='campaign';fs.writeFileSync(path.join(dir,name+'.json'),JSON.stringify({version:1,name,host:seats[0].pid,mid:57,ruleset:'campaign',attempts:1,started:true,seats,observers:[],revision:0,seen:[],G}));let service=Service(wss,dir),room,peers,observer;
  function connect(){peers=seats.map(s=>{const ws=peer(name);wss.clients.add(ws);service.handle(ws,'hello',{credential:s.credential,name:s.name});return ws;});observer=peer(name);wss.clients.add(observer);service.handle(observer,'hello',{spectator:true,name:'绑定观众'});room=service.load(name);G=room.G;}
  function send(p,id,a){service.handle(peers[p],'official:act',{gid:G.gid,revision:room.revision,commandId:id,action:a});}
  function restore(label){service.handle(peers[0],'official:pause',{gid:G.gid,revision:room.revision,commandId:label+'暂停',paused:true});wss.clients.forEach(ws=>ws.readyState=3);service=Service(wss,dir);connect();assert(G.paused);service.handle(peers[0],'official:pause',{gid:G.gid,revision:room.revision,commandId:label+'继续',paused:false});}
  connect();send(0,'开始绑定切线',{a:'dual',w:target,val:1});const id=G.pending.id;assert.equal(G.officialState.constraints.active,null);restore('目标');send(1,'绑定目标回答',{a:'resolve',id,w:target});assert.equal(G.officialState.constraints.active,null);assert.equal(BB.cutCount(G,1),2);restore('自己');send(0,'绑定自己选择',{a:'resolve',id,w:own});assert.equal(BB.cutCount(G,1),4);assert.equal(G.officialState.constraints.active,'G');assert.deepEqual(G.officialState.constraints.completed,[1]);assert.equal(G.det,0);const done=JSON.stringify(G),revision=room.revision;send(0,'绑定自己选择',{a:'resolve',id,w:own});assert.equal(room.revision,revision);assert.equal(JSON.stringify(G),done);send(G.turn,'违反共享禁装备',{a:'dd',ws:[target,own],val:1});assert.equal(JSON.stringify(G),done);for(const ws of [...peers,observer]){const c=last(ws,'official:view').view.official.constraints;assert.equal(c.active,'G');assert(c.bindings.find(x=>x.value===1).completed);}wss.clients.forEach(ws=>ws.readyState=3);
 }}finally{fs.rmSync(dir,{recursive:true,force:true});}
}
console.log('✓ 第57关2–5人权威：绑定卡公开、目标／自己阶段逐次暂停重启／凭据重连，完成前不切限制、第四根后全员同步切换，重复不再换／无额外罚格，共享禁装备真实执行');
{
 for(const n of [2,3,4,5]){const old=BB.createGame(M.get('campaign',57),Array.from({length:n},(_,i)=>({pid:'旧'+i,name:'旧任务'+i})));assert.equal(old.ruleset,'custom');assert.equal(old.mission.contentVersion,17);assert.equal(old.mission.rules.timer,30);assert(!old.officialState);setup(old);assert(old.deadline);const now=old.deadline-1000;assert.equal(BB.setPaused(old,true,now),null);const saved=JSON.parse(JSON.stringify(old));assert.equal(BB.setPaused(old,false,now+100),null);assert.equal(BB.setPaused(saved,false,now+100),null);assert.deepEqual(saved,old);assert(BB.view(old,0).players[0].stands.flat().every(w=>w.v!==null));}
}
console.log('✓ 第57关2–5人旧版17改编保存恢复保留原黄红／30秒计时与完整本人手牌，暂停剩余时间一致，不套用绑定限制');
assert(!M.get('campaign',57).verified);
