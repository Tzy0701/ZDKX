// 第56关来源开发模块，尚未替换公开改编版本。
const assert=require('assert'),BB=require('../js/engine'),M=require('../js/missions');
function rng(s){return()=>((s=(Math.imul(s,1664525)+1013904223)>>>0)/4294967296);}
function game(n=3,cap=0,seed=1){return BB.createGame(M.get('official-development',56),Array.from({length:n},(_,i)=>({pid:'p'+i,name:'朝外玩家'+i})),{rng:rng(seed*104729),captain:cap});}
function act(G,p,a){assert.equal(BB.act(G,p,a),null,JSON.stringify(a));}function reject(G,p,a){const before=JSON.stringify(G);assert(BB.act(G,p,a));assert.equal(JSON.stringify(G),before);}
function setup(G){while(G.phase==='setup'){const p=BB.setupActor(G),w=G.wires.find(w=>w.o===p&&!w.info&&BB.setupInfoAllowed(G,w));act(G,p,{a:'info',w:w.id});}}
function wire(V,id){return V.players.flatMap(p=>p.stands.flat()).find(w=>w.id===id);}
function find(predicate){for(let seed=1;seed<=500;seed++){const G=game(3,0,seed);setup(G);const result=predicate(G);if(result)return {G,...result};}throw Error('未找到来源场景');}
for(const n of [2,3,4,5])for(let cap=0;cap<n;cap++)for(let seed=1;seed<=12;seed++){
 const G=game(n,cap,seed);assert.equal(G.wires.length,n===2?51:50);assert.equal(G.rmark.n,n===2?3:2);assert.equal(G.rmark.cand.length,3);assert.equal(G.ymark.n,0);assert.equal(G.officialState.outwardIds.length,n);assert.equal(new Set(G.officialState.outwardIds).size,n);assert.deepEqual(G.seq,[]);
 G.players.forEach((p,owner)=>{assert.equal(p.stands.length,n===2||n===3&&owner===cap?2:1);const id=G.officialState.outwardIds[owner],w=G.wires[id];assert.equal(w.o,owner);assert.equal(p.stands[w.s].at(-1),id);assert(!BB.setupInfoAllowed(G,w));for(const row of p.stands){const values=row.filter(id=>!BB.isOutward(G,G.wires[id])).map(id=>G.wires[id].v);assert.deepEqual(values,values.slice().sort((a,b)=>a-b));}for(let viewer=0;viewer<n;viewer++){const V=BB.view(G,viewer);assert.equal(wire(V,id).v,viewer===owner?null:w.v);const packed=BB.unpack(BB.packPublic(G),BB.packHand(G,viewer),viewer);assert.equal(wire(packed,id).v,viewer===owner?null:w.v);}});setup(G);assert(G.players.every((_,p)=>G.setup[p]===1));
}
console.log('✓ 第56关2–5人所有队长：50／51根、红2/3或双人3已知、无黄／无数字卡、一人一个本人隐藏／队友可见朝外线，原架末尾／正常区排序、正常初始和压缩包隐私；两架摆放仍待核实');
{
 const {G,target,own}=find(G=>{const target=G.wires[G.officialState.outwardIds[1]],own=G.wires.find(w=>w.o===0&&!BB.isOutward(G,w)&&w.v===target.v);return Number.isInteger(target.v)&&own?{target:target.id,own:own.id}:null;});const value=G.wires[target].v;act(G,0,{a:'dual',w:target,val:value});assert.equal(G.det,0);const id=G.pending.id;assert.equal(BB.view(G,1).pending.publicMatch,true);assert.equal(wire(BB.view(G,1),target).v,null);assert(!('publicMatch' in BB.view(G,0).pending));act(G,1,{a:'resolve',id,w:target});assert.equal(G.det,0);assert.equal(wire(BB.view(G,1),target).v,value);const saved=JSON.parse(JSON.stringify(G));act(G,0,{a:'resolve',id,w:own});act(saved,0,{a:'resolve',id,w:own});assert.deepEqual(saved,G);assert.equal(G.det,1);assert(G.wires[target].cut&&G.wires[own].cut);assert.equal(G.turnNo,2);reject(G,0,{a:'resolve',id,w:own});
}
{
 const {G,target,wrong}=find(G=>{const special=G.wires[G.officialState.outwardIds[0]],target=G.wires.find(w=>w.o!==0&&!BB.isOutward(G,w)&&Number.isInteger(w.v)&&w.v!==special.v);return target?{target:target.id,wrong:target.v}:null;});const id=G.officialState.outwardIds[0];act(G,0,{a:'outward-dual',w:target,val:wrong});act(G,G.pending.to,{a:'resolve',id:G.pending.id,w:target});assert.deepEqual(BB.view(G,0).pending.choices,[id]);act(G,0,{a:'resolve',id:G.pending.id,w:id});assert.equal(G.phase,'lost');assert(!G.wires[target].cut&&!G.wires[id].cut);assert.equal(G.det,0);
}
console.log('✓ 第56关队友剪中朝外线：公开确认／自己选线完成前不罚，完整结算只罚一次／保存恢复不重复；主人盲拆自身不匹配立即爆炸且不剪线');
{
 const {G,mate}=find(G=>{const own=G.wires[G.officialState.outwardIds[0]],mate=G.wires.find(w=>w.o!==0&&!BB.isOutward(G,w)&&w.v===own.v);return Number.isInteger(own.v)&&mate?{mate:mate.id}:null;}),id=G.officialState.outwardIds[0],value=G.wires[id].v;act(G,0,{a:'outward-dual',w:mate,val:value});act(G,G.pending.to,{a:'resolve',id:G.pending.id,w:mate});act(G,0,{a:'resolve',id:G.pending.id,w:id});assert(G.wires[id].cut&&G.wires[mate].cut);assert.equal(G.det,0);
 const other=game(3);setup(other);const out=other.officialState.outwardIds[1],normal=other.players[1].stands[other.wires[out].s].find(id=>id!==out);reject(other,0,{a:'dd',ws:[out,normal],val:1});reject(other,0,{a:'dual',w:out,val:1,stab:true});reject(other,1,{a:'character',w:out,val:1});
}
console.log('✓ 第56关主人主动盲双拆成功不罚；探测器／稳定器／个人能力不能影响朝外线，错误后状态不变');
{
 const {G,peer}=find(G=>{const id=G.officialState.outwardIds[0],special=G.wires[id];if(!Number.isInteger(special.v)||G.wires.some(w=>w.o===0&&w.id!==id&&w.v===special.v))return null;for(const w of G.wires){if(w.o===0||BB.isOutward(G,w)||w.info||!Number.isInteger(w.v)||w.v===special.v)continue;const row=G.players[w.o].stands[w.s],reordered=row.slice().sort((a,b)=>(a===w.id?special.v:G.wires[a].v)-(b===w.id?special.v:G.wires[b].v)||a-b);if(JSON.stringify(row)===JSON.stringify(reordered))return {peer:w.id};}return null;});const id=G.officialState.outwardIds[0],alternate=JSON.parse(JSON.stringify(G)),value=G.wires[id].v;[alternate.wires[id].v,alternate.wires[peer].v]=[alternate.wires[peer].v,alternate.wires[id].v];assert.deepEqual(BB.view(G,0),BB.view(alternate,0));const before=JSON.stringify(G),second=JSON.stringify(alternate),e=BB.act(G,0,{a:'dual',w:peer,val:value}),f=BB.act(alternate,0,{a:'dual',w:peer,val:value});assert(e&&e===f);assert.equal(JSON.stringify(G),before);assert.equal(JSON.stringify(alternate),second);
}
console.log('✓ 第56关相同许可视图／不同合法隐藏摆法，普通宣告均同样拒绝，不以本人隐藏真实数值提供试探接口');
assert(!M.get('campaign',56).verified);
{
 for(const owner of [0,1,2]){
  const {G}=find(G=>Math.round(G.wires[G.officialState.outwardIds[owner]].v*10)%10===5?{}:null);const id=G.officialState.outwardIds[owner];G.wires.filter(w=>w.o===owner&&w.id!==id&&BB.kindOf(w)!=='r').forEach(w=>w.cut=true);G.turn=owner;assert(BB.outwardRedPossible(G,owner));assert(BB.outwardRedPossible(BB.view(G,owner),owner));reject(G,owner,{a:'red'});act(G,owner,{a:'outward-red'});assert(G.wires[id].cut);assert.equal(G.det,0);assert.equal(G.phase,'play');
 }
 const {G}=find(G=>Number.isInteger(G.wires[G.officialState.outwardIds[1]].v)?{}:null),id=G.officialState.outwardIds[1],value=G.wires[id].v;G.wires.filter(w=>w.id!==id&&w.v===value).forEach(w=>{w.o=1;w.s=0;w.info=null;});G.players.forEach((p,owner)=>p.stands=p.stands.map((_,s)=>G.wires.filter(w=>w.o===owner&&w.s===s).sort((a,b)=>Number(BB.isOutward(G,a))-Number(BB.isOutward(G,b))||a.v-b.v||a.id-b.id).map(w=>w.id)));G.turn=1;assert(BB.outwardSoloValues(BB.view(G,1),1).includes(value));act(G,1,{a:'outward-solo',val:value});assert.equal(BB.cutCount(G,value),4);assert.equal(G.det,0);
}
console.log('✓ 第56关每个玩家的朝外红线均须主动推断公开、普通红线命令不能试探隐藏颜色；非队长可跨手牌主动盲单拆，成功不额外罚格');
{
 const Bot=require('../js/bot'),results={won:0,lost:0};let actions=0;for(const n of [2,3,4,5])for(let seed=1;seed<=4;seed++){
  const G=game(n,seed%n,seed*7919);setup(G);let steps=0;while(G.phase==='play'&&steps++<350){const pi=G.pending?G.pending.to:G.turn,a=Bot.decide(G,pi);assert(a,'机器人不能在合法进行中停止');assert.equal(BB.act(G,pi,a),null,JSON.stringify(a));actions++;}assert(['won','lost'].includes(G.phase),'不能循环或停住');results[G.phase]++;
 }console.log('✓ 第56关2–5人默认角色16局合法模拟：'+JSON.stringify(results)+'，'+actions+'动作，非法／停止／超限0；不认证策略或整关');
}
{
 const fs=require('fs'),os=require('os'),path=require('path'),Service=require('../server/official'),dir=fs.mkdtempSync(path.join(os.tmpdir(),'bb56-authority-'));
 function peer(room){return {room,readyState:1,messages:[],send(raw){this.messages.push(JSON.parse(raw));}};}function last(ws,t){return ws.messages.filter(m=>m.topic===t).at(-1)?.data;}
 try{for(const n of [2,3,4,5]){
  let G,target,own;for(let seed=1;seed<=400;seed++){G=game(n,0,seed);setup(G);target=G.wires[G.officialState.outwardIds[1]];own=G.wires.find(w=>w.o===0&&!BB.isOutward(G,w)&&w.v===target.v);if(own&&Number.isInteger(target.v))break;}assert(own);const targetId=target.id,ownId=own.id,value=target.v,name='bb-all-outward'+n,seats=G.players.map(p=>({pid:p.pid,name:p.name,bot:false,credential:'朝外凭据'+p.pid})),wss={clients:new Set()};G.catalog=G.mission.catalog='campaign';fs.writeFileSync(path.join(dir,name+'.json'),JSON.stringify({version:1,name,host:seats[0].pid,mid:56,ruleset:'campaign',attempts:1,started:true,seats,observers:[],revision:0,seen:[],G}));let service=Service(wss,dir),room,peers,observer,credential;
  function connect(){peers=seats.map(s=>{const ws=peer(name);wss.clients.add(ws);service.handle(ws,'hello',{credential:s.credential,name:s.name});return ws;});observer=peer(name);wss.clients.add(observer);service.handle(observer,'hello',credential?{credential,name:'朝外观众'}:{spectator:true,name:'朝外观众'});credential=last(observer,'official:welcome').credential;room=service.load(name);G=room.G;}
  function send(p,id,a){service.handle(peers[p],'official:act',{gid:G.gid,revision:room.revision,commandId:id,action:a});}
  function pausedRestore(label){service.handle(peers[0],'official:pause',{gid:G.gid,revision:room.revision,commandId:label+'暂停',paused:true});wss.clients.forEach(ws=>ws.readyState=3);service=Service(wss,dir);connect();assert(G.paused);service.handle(peers[0],'official:pause',{gid:G.gid,revision:room.revision,commandId:label+'继续',paused:false});}
  connect();send(0,'选择朝外目标',{a:'dual',w:targetId,val:value});const id=G.pending.id;assert.equal(G.det,0);assert.equal(last(peers[1],'official:view').view.pending.publicMatch,true);assert.equal(wire(last(peers[1],'official:view').view,targetId).v,null);service.handle(observer,'official:perspective',{pid:seats[1].pid});assert(!('publicMatch' in last(observer,'official:view').view.pending));assert(!('choices' in last(observer,'official:view').view.pending));pausedRestore('目标阶段');assert.equal(G.pending.id,id);const before=JSON.stringify(G);send(0,'冒用目标回应',{a:'resolve',id,w:targetId});assert.equal(JSON.stringify(G),before);send(1,'目标确认',{a:'resolve',id,w:targetId});assert.equal(G.pending.step,'own');assert.equal(G.det,0);assert.equal(wire(last(peers[1],'official:view').view,targetId).v,value);pausedRestore('自己阶段');assert.equal(G.pending.id,id);send(0,'选择自己匹配',{a:'resolve',id,w:ownId});assert.equal(G.det,1);assert(BB.detonatorText(G).includes('处罚'));assert(G.wires[targetId].cut&&G.wires[ownId].cut);const done=JSON.stringify(G),revision=room.revision;send(0,'选择自己匹配',{a:'resolve',id,w:ownId});assert.equal(room.revision,revision);assert.equal(JSON.stringify(G),done);wss.clients.forEach(ws=>ws.readyState=3);
 }}finally{fs.rmSync(dir,{recursive:true,force:true});}
}
console.log('✓ 第56关2–5人权威：目标／自己阶段逐次暂停重启／凭据重连、原决定编号、目标主人隐藏值／私有回应／观战屏蔽、公开确认后真值可见、身份／重复防重，完整处罚只一次；原官方目录仍改编');
{
 for(const n of [2,3,4,5]){const mission=M.get('campaign',56),G=BB.createGame(mission,Array.from({length:n},(_,i)=>({pid:'旧'+i,name:'旧版'+i})),{rng:rng(n)}),saved=JSON.parse(JSON.stringify(G));assert.equal(G.ruleset,'custom');assert(!BB.allOutward(G));assert(!G.officialState);assert.equal(G.mission.contentVersion,17);assert.equal(G.mission.rules.countdown,6);setup(G);setup(saved);assert.deepEqual(G,saved);assert(BB.view(G,0).players[0].stands.flat().every(w=>w.v!==null));assert(!G.officialState);}
}
console.log('✓ 第56关旧版17改编2–5人保存恢复保留原黄红／引信规则和完整本人手牌，不静默套用朝外任务');
module.exports={game,setup,find,act,reject};
