const assert=require('assert'),BB=require('../js/engine'),M=require('../js/missions');
function rng(s){return()=>((s=(Math.imul(s,1664525)+1013904223)>>>0)/4294967296);}
function game(n=3,cap=0,seed=1){return BB.createGame(M.get('official-development',49),Array.from({length:n},(_,i)=>({pid:'p'+i,name:'个人氧气玩家'+i})),{captain:cap,rng:rng(seed)});}
function act(G,pi,a){assert.equal(BB.act(G,pi,a),null,JSON.stringify(a));}
function reject(G,pi,a){const before=JSON.stringify(G);assert(BB.act(G,pi,a));assert.equal(JSON.stringify(G),before);}
function setup(G){while(G.phase==='setup'){const pi=BB.setupActor(G);act(G,pi,{a:'info',w:G.wires.find(w=>w.o===pi&&BB.setupInfoAllowed(G,w)).id});}}
function rig(hands){const G=game(hands.length);setup(G);G.wires=[];G.players.forEach(p=>p.stands=p.stands.map(()=>[]));hands.forEach((hand,o)=>hand.forEach(v=>{const id=G.wires.length;G.wires.push({id,v,o,s:0,cut:false,info:null});G.players[o].stands[0].push(id);}));G.equip=[];return G;}
function replies(G){while(G.pending){const pd=G.pending,V=BB.view(G,pd.to);act(G,pd.to,{a:'resolve',id:pd.id,w:pd.step==='own'?V.pending.choices.at(-1):pd.ids.find(id=>pd.vals.some(v=>BB.matches(G.wires[id],v)))??V.pending.choices[0]});}}
function conserved(G){const s=BB.personalOxygen(G);assert.equal(s.balances.reduce((a,b)=>a+b,0)+s.discarded,s.total);assert(s.balances.every(v=>Number.isInteger(v)&&v>=0));}
for(const n of [2,3,4,5])for(let cap=0;cap<n;cap++)for(let seed=1;seed<=8;seed++){
 const G=game(n,cap,seed*104729),state=BB.personalOxygen(G);assert.equal(G.wires.length,n===2?51:50);assert.equal(G.rmark.n,n===2?3:2);assert.equal(G.rmark.cand.length,n===2?3:2);assert.equal(G.ymark.n,0);assert.deepEqual(state.balances,Array(n).fill(9-n));assert.equal(state.total,n*(9-n));assert(G.equip.every(e=>e.n!==10));assert.equal(G.equip.length,n);assert(G.mission.rules.noChat);assert(!BB.characterOptions(G.mission,(cap+1)%n,cap).includes('xy-ray'));setup(G);assert.equal(G.turn,cap);conserved(G);for(let pi=-1;pi<n;pi++)assert.deepEqual(BB.view(G,pi).official.personalOxygen,state);
}
console.log('✓ 第49关2–5人全部队长：50／51根、已知红2／3、无黄、各7／6／5／4枚公开氧气，禁共享／个人X/Y和聊天，正常初始标记');
for(const value of [1,4,5,8,9,12]){
 const G=rig([[value,2],[value,3],[4]]);BB.personalOxygen(G).balances=[12,3,3];const target=G.wires.find(w=>w.o===1&&w.v===value);
 act(G,0,{a:'dual',w:target.id,val:value,oxygenTo:2});assert.deepEqual(BB.personalOxygen(G).balances,[12-value,3,3+value]);const restored=JSON.parse(JSON.stringify(G));replies(G);replies(restored);assert.deepEqual(BB.personalOxygen(restored),BB.personalOxygen(G));assert.deepEqual(BB.personalOxygen(G).balances,[12-value,3,3+value]);conserved(G);
 const solo=rig([[value,value,value,value],[2],[3]]);BB.personalOxygen(solo).balances=[12,3,3];act(solo,0,{a:'solo',val:value,oxygenTo:2});assert.equal(BB.personalOxygen(solo).balances[0],0);assert.equal(BB.personalOxygen(solo).discarded,12-value);assert.equal(BB.personalOxygen(solo).balances[2],3+value);conserved(solo);
}
console.log('✓ 第49关1–12费用边界：接收者无需是目标，双拆／四线单拆一次转移，私人回应与保存恢复不重复转移，空手弃氧守恒');
{
 const G=rig([[5,2],[4,3],[1]]);for(const a of [{a:'dual',w:2,val:5},{a:'dual',w:2,val:5,oxygenTo:0},{a:'dual',w:2,val:5,oxygenTo:3},{a:'dual',w:99,val:5,oxygenTo:2},{a:'solo',val:5,oxygenTo:2},{a:'dual',w:2,val:12,oxygenTo:2},{a:'dual',w:2,val:5,oxygenTo:2,xy:true},{a:'personal-oxygen-skip',oxygenTo:2}])reject(G,0,a);
 reject(G,1,{a:'dual',w:0,val:4,oxygenTo:2});act(G,0,{a:'dual',w:2,val:5,oxygenTo:2});replies(G);assert.equal(G.det,1);assert.deepEqual(BB.personalOxygen(G).balances,[1,6,11]);conserved(G);
}
{
 const G=rig([[3],[3,3],[3]]);act(G,0,{a:'dual',w:1,val:3,oxygenTo:1});assert.deepEqual(BB.personalOxygen(G).balances,[3,9,6]);replies(G);assert.deepEqual(BB.personalOxygen(G).balances,[0,9,6]);assert.equal(BB.personalOxygen(G).discarded,3);conserved(G);
 const red=rig([[1.5],[2],[3]]);act(red,0,{a:'red'});assert.deepEqual(BB.personalOxygen(red).balances,[0,6,6]);assert.equal(BB.personalOxygen(red).discarded,6);assert.equal(red.det,0);conserved(red);
 const empty=rig([[1,2],[1,3],[4]]);empty.wires.find(w=>w.o===2).cut=true;act(empty,0,{a:'dual',w:2,val:1,oxygenTo:2});assert.deepEqual(BB.personalOxygen(empty).balances,[5,6,0]);assert.equal(BB.personalOxygen(empty).discarded,7);conserved(empty);
}
{
 const G=rig([[1,2],[3],[4]]);act(G,2,{a:'personal-oxygen-signal'});assert(BB.personalOxygen(G).requests[2]);reject(G,1,{a:'personal-oxygen-skip'});reject(G,0,{a:'personal-oxygen-skip',stab:true});act(G,0,{a:'personal-oxygen-skip'});assert.equal(G.det,1);assert.equal(G.turn,1);act(G,1,{a:'personal-oxygen-skip'});act(G,2,{a:'personal-oxygen-skip'});assert.equal(G.phase,'lost');conserved(G);
 const S=rig([[1,2],[3],[9,9,4]]);S.wires.filter(w=>w.v===9).forEach(w=>w.cut=true);S.equip=[{n:9,used:false}];act(S,0,{a:'personal-oxygen-skip',stab:true});assert(S.equip[0].used);assert.equal(S.det,0);assert.equal(S.turn,1);conserved(S);
}
assert(!M.get('campaign',49).verified);
console.log('✓ 第49关无效操作完整不变，失败仍转移、当前德文主动跳过／稳定器／免费红线／空手弃氧、私有阶段及精确引爆边界；正式关49仍改编');
for(const type of ['dd','triple','super','personal-triple']){
 const G=rig([[2,4],[2,3,5],[6]]);const targets=G.wires.filter(w=>w.o===1).map(w=>w.id);if(type==='triple')G.equip=[{n:3,used:false}];if(type==='super')G.equip=[{n:5,used:false}];if(type==='personal-triple'){G.players[0].character={id:'triple-detector',used:false};G.players[0].dd=false;}
 // 解锁所需的两根同值蓝线已剪；保持测试拆除值2的匹配线未剪。
 if(type==='triple'||type==='super'){const number=type==='triple'?3:5;for(let i=0;i<2;i++){const id=G.wires.length;G.wires.push({id,v:number,o:2,s:0,cut:true,info:null});G.players[2].stands[0].push(id);}}
 const a=type==='dd'?{a:'dd',ws:targets.slice(0,2),val:2}:type==='triple'?{a:'equip',n:3,ws:targets,val:2}:type==='super'?{a:'equip',n:5,p:1,s:0,val:2}:{a:'character',ws:targets,val:2};a.oxygenTo=2;
 act(G,0,a);assert.deepEqual(BB.personalOxygen(G).balances,[4,6,8]);replies(G);assert.deepEqual(BB.personalOxygen(G).balances,[4,6,8]);conserved(G);
}
console.log('✓ 第49关双重／共享三重／超级／个人三重探测器，每次转移宣告值一次，目标与本人私人选择不重复收费');
{
 const fs=require('fs'),os=require('os'),path=require('path'),Service=require('../server/official'),dir=fs.mkdtempSync(path.join(os.tmpdir(),'bb49-authority-'));
 function peer(room){return {room,readyState:1,messages:[],send(raw){this.messages.push(JSON.parse(raw));}};}
 try{for(const n of [2,3,4,5]){
  const G=game(n);setup(G);G.catalog=G.mission.catalog='campaign';const name='bb-personal-oxygen'+n,seats=G.players.map((p,pi)=>({pid:p.pid,name:p.name,bot:false,credential:'氧气凭据'+pi})),wss={clients:new Set()};
  fs.writeFileSync(path.join(dir,name+'.json'),JSON.stringify({version:1,name,host:seats[0].pid,mid:49,ruleset:'campaign',attempts:1,started:true,seats,observers:[],revision:0,seen:[],G}));
  let service=Service(wss,dir),room,peers,observer;
  function connect(){peers=seats.map(s=>{const ws=peer(name);wss.clients.add(ws);service.handle(ws,'hello',{credential:s.credential,name:s.name});return ws;});observer=peer(name);wss.clients.add(observer);service.handle(observer,'hello',{spectator:true,name:'氧气观众'});room=service.load(name);}
  connect();const own=room.G.wires.find(w=>w.o===0&&!w.cut&&Number.isInteger(w.v)&&w.v<=9-n&&room.G.wires.some(t=>t.o!==0&&t.v===w.v)),target=room.G.wires.find(w=>w.o!==0&&!w.cut&&w.v===own.v);assert(own&&target);const recipient=n===2?1:(target.o+1)%n||1,balances=BB.personalOxygen(room.G).balances.slice(),expected=balances.slice();expected[0]-=own.v;expected[recipient]+=own.v;
  function send(pi,id,a){service.handle(peers[pi],'official:act',{gid:room.G.gid,revision:room.revision,commandId:id,action:a});}
  send(0,'转移拆线',{a:'dual',w:target.id,val:own.v,oxygenTo:recipient});assert.deepEqual(BB.personalOxygen(room.G).balances,expected);const firstRevision=room.revision;send(0,'转移拆线',{a:'dual',w:target.id,val:own.v,oxygenTo:recipient});assert.equal(room.revision,firstRevision);
  let count=0;while(room.G.pending){const pd=room.G.pending,who=pd.to,id=pd.id;service.handle(peers[0],'official:pause',{gid:room.G.gid,revision:room.revision,commandId:'暂停'+count,paused:true});const frozen=JSON.stringify(room.G);send(who,'暂停回应'+count,{a:'resolve',id,w:pd.step==='own'?own.id:target.id});assert.equal(JSON.stringify(room.G),frozen);
   wss.clients.forEach(ws=>ws.readyState=3);service=Service(wss,dir);connect();assert(room.G.paused);assert.deepEqual(BB.personalOxygen(room.G).balances,expected);assert.equal(room.G.pending.id,id);service.handle(peers[0],'official:pause',{gid:room.G.gid,revision:room.revision,commandId:'继续'+count,paused:false});
   const before=JSON.stringify(room.G);send((who+1)%n,'冒用回应'+count,{a:'resolve',id,w:own.id});assert.equal(JSON.stringify(room.G),before);send(who,'过期回应'+count,{a:'resolve',id:id-1,w:own.id});assert.equal(JSON.stringify(room.G),before);
   const pv=BB.view(room.G,who);send(who,'真实回应'+count,{a:'resolve',id,w:pv.pending.step==='own'?pv.pending.choices.at(-1):target.id});const revision=room.revision;send(who,'真实回应'+count,{a:'resolve',id,w:own.id});assert.equal(room.revision,revision);assert.deepEqual(BB.personalOxygen(room.G).balances,expected);count++;
  }assert.equal(count,2);assert.equal(room.G.det,0);conserved(room.G);assert(room.G.wires[target.id].cut);assert.equal(room.G.wires.filter(w=>w.o===0&&w.v===own.v&&w.cut).length,1);
 }}finally{fs.rmSync(dir,{recursive:true,force:true});}
 console.log('✓ 第49关2–5人权威：来源双拆转移一次，各回应暂停／重启／凭据重连、冒用／过期／重复拒绝，氧气守恒且不重复转移');
}
{
 const fs=require('fs'),os=require('os'),path=require('path'),Service=require('../server/official'),dir=fs.mkdtempSync(path.join(os.tmpdir(),'bb49-legacy-'));
 try{for(const n of [2,3,4,5]){
  const seats=Array.from({length:n},(_,i)=>({pid:'p'+i,name:'旧氧气任务'+i,credential:'旧氧气凭证'+i,bot:false})),mission=JSON.parse(JSON.stringify(M.get('custom',49)));mission.catalog='campaign';mission.contentVersion=17;
  const G=BB.createGame(mission,seats,{rng:rng(n*104729)});G.catalog='campaign';G.contentVersion=17;const name='bb-legacy49-'+n,before=JSON.stringify(G.mission);
  fs.writeFileSync(path.join(dir,name+'.json'),JSON.stringify({version:1,name,host:seats[0].pid,mid:49,ruleset:'campaign',attempts:1,started:true,seats,observers:[],revision:0,seen:[],G}));
  const restored=Service({clients:new Set()},dir).load(name).G;assert.equal(JSON.stringify(restored.mission),before);assert.equal(restored.contentVersion,17);assert(!restored.officialState);assert.equal(restored.ruleset,'custom');assert.deepEqual(restored.ymark,G.ymark);assert.deepEqual(restored.rmark,G.rmark);assert.equal(restored.detMax,G.detMax);assert.equal(BB.view(restored,0).official,null);assert(!BB.personalOxygen(restored));
 }}finally{fs.rmSync(dir,{recursive:true,force:true});}
 console.log('✓ 第49关2–5人版本17改编存档保留原任务、红黄设置和引爆器，不追加个人氧气规则');
}
{
 const Bot=require('../js/bot'),G=rig([[2,2,2,2],[3,4],[5]]);BB.personalOxygen(G).requests[2]=true;const a=Bot.decide(G,0);assert.deepEqual(a,{a:'solo',val:2,oxygenTo:2});const hidden=JSON.parse(JSON.stringify(G));hidden.wires.forEach(w=>{if(w.o!==0&&!w.cut)w.v=12;});assert.deepEqual(Bot.decide(hidden,0),a);act(G,0,a);assert.equal(BB.personalOxygen(G).balances[2],8);conserved(G);
 const zero=rig([[9],[2],[3]]);assert.deepEqual(Bot.decide(zero,0),{a:'personal-oxygen-skip',stab:false});act(zero,0,Bot.decide(zero,0));assert.equal(zero.det,1);conserved(zero);
 const red=rig([[1.5],[2],[3]]);assert.deepEqual(Bot.decide(red,0),{a:'red'});act(red,0,Bot.decide(red,0));assert.equal(red.det,0);conserved(red);
 const stable=rig([[9],[2],[9,9,3]]);stable.wires.filter(w=>w.o===2&&w.v===9).forEach(w=>w.cut=true);stable.equip=[{n:9,used:false}];assert.deepEqual(Bot.decide(stable,0),{a:'personal-oxygen-skip',stab:true});act(stable,0,Bot.decide(stable,0));assert.equal(stable.det,0);assert(stable.equip[0].used);conserved(stable);
}
console.log('✓ 第49关机器人仅用公开余额／拇指／线索选择收款者，队友隐藏值改变不影响选择；不足合法跳过／稳定器，红线免费');
{
 const Bot=require('../js/bot'),originalRandom=Math.random,roles=Object.keys(BB.CHARACTERS).filter(id=>id!=='xy-ray'),totals={won:0,lost:0};let transfers=0,skips=0;
 try{for(const n of [2,3,4,5])for(let rotation=0;rotation<roles.length;rotation++)for(let seed=1;seed<=2;seed++){
  Math.random=rng((rotation+1)*100003+seed*104729+n);const captain=seed%n,seats=Array.from({length:n},(_,pi)=>({pid:'p'+pi,name:'个人氧气角色机器人'+pi,bot:true,character:pi===captain?'double-detector':roles[(rotation+pi-(pi>captain?1:0))%roles.length]}));
  let G=BB.createGame(M.get('official-development',49),seats,{captain,rng:Math.random}),steps=0;
  while(!['won','lost'].includes(G.phase)&&steps<600){let acted=false;for(let pi=0;pi<n;pi++){const a=Bot.decide(G,pi);if(!a)continue;act(G,pi,a);if(a.oxygenTo!==undefined)transfers++;if(a.a==='personal-oxygen-skip')skips++;conserved(G);steps++;acted=true;break;}assert(acted||['won','lost'].includes(G.phase),'第49关机器人不能停止合法回合或私人回应');if(steps%17===0)G=JSON.parse(JSON.stringify(G));}
  assert(['won','lost'].includes(G.phase));totals[G.phase]++;
 }}finally{Math.random=originalRandom;}
 console.log('✓ 第49关2–5人四种允许角色32局：'+totals.won+'胜、'+totals.lost+'败，'+transfers+'次转移、'+skips+'次跳过；拒绝／停止／超限0，氧气守恒与过程存档恢复；不能认证规则与策略充分性');
}
