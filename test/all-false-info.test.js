const assert=require('assert'),BB=require('../js/engine'),M=require('../js/missions'),C=require('../js/campaign-rules');
function rng(s){return()=>((s=(Math.imul(s,1664525)+1013904223)>>>0)/4294967296);}
function game(n=3,cap=0,seed=1){return BB.createGame(M.get('official-development',52),Array.from({length:n},(_,i)=>({pid:'p'+i,name:'假线索玩家'+i})),{captain:cap,rng:rng(seed)});}
function act(G,pi,a){assert.equal(BB.act(G,pi,a),null,JSON.stringify(a));}
function reject(G,pi,a){const before=JSON.stringify(G);assert(BB.act(G,pi,a));assert.equal(JSON.stringify(G),before);}
function setup(G){while(G.phase==='setup'){const pi=BB.setupActor(G),view=BB.view(G,pi),w=G.wires.find(w=>w.o===pi&&!w.info&&!G.officialState.allFalseInfo.initialIds.includes(w.id)&&BB.setupInfoAllowed(G,w));act(G,pi,{a:'info',id:view.official.fakeSetup.id,w:w.id,val:w.v===1?2:1});}}
function rig(hands){const G=game(hands.length);setup(G);G.wires=[];G.players.forEach(p=>p.stands=p.stands.map(()=>[]));hands.forEach((hand,o)=>hand.forEach(v=>{const id=G.wires.length;G.wires.push({id,v,o,s:0,cut:false,info:null});G.players[o].stands[0].push(id);}));G.equip=[];return G;}
for(const n of [2,3,4,5])for(let cap=0;cap<n;cap++)for(let seed=1;seed<=8;seed++){
 const G=game(n,cap,seed*104729);assert.equal(G.wires.length,n===2?55:51);assert.equal(G.rmark.n,3);assert.equal(G.rmark.cand.length,3);assert.equal(G.ymark.n,n===2?4:0);assert.equal(G.ymark.cand.length,n===2?4:0);assert(G.equip.every(e=>![1,12].includes(e.n)));assert.equal(G.equip.length,n);assert(G.players.every(p=>p.dd));
 while(G.phase==='setup'){const pi=BB.setupActor(G),view=BB.view(G,pi),pd=view.official.fakeSetup,w=G.wires.find(w=>w.o===pi&&!w.info&&!G.officialState.allFalseInfo.initialIds.includes(w.id)&&BB.setupInfoAllowed(G,w));for(let who=-1;who<n;who++)assert.equal('fakeSetup' in BB.view(G,who).official,who===pi);reject(G,(pi+1)%n,{a:'info',id:pd.id,w:w.id,val:2});reject(G,pi,{a:'info',id:pd.id-1,w:w.id,val:2});if(Number.isInteger(w.v))reject(G,pi,{a:'info',id:pd.id,w:w.id,val:w.v});const yellow=G.wires.find(w=>w.o===pi&&BB.kindOf(w)==='y');if(yellow)reject(G,pi,{a:'info',id:pd.id,w:yellow.id,val:1});act(G,pi,{a:'info',id:pd.id,w:w.id,val:w.v===1?2:1});}
 assert(G.players.every((_,pi)=>G.setup[pi]===2));assert.equal(G.officialState.allFalseInfo.initialIds.length,n*2);assert.equal(new Set(G.officialState.allFalseInfo.initialIds).size,n*2);assert(G.wires.filter(w=>w.info).every(w=>w.info.t==='not'&&Number(w.info.v)!==w.v));
}
console.log('✓ 第52关2–5人全部队长：51／55根、已知红3／双人黄4，排除等号／不等号，每人两个不同蓝／红错误标记，私有选择、红黄限制及拒绝不变');
{
 const G=rig([[2,4],[3,5],[6]]);G.phase='setup';G.setup={0:0,1:0,2:0};G.officialState.allFalseInfo.initialIds=[];const red={id:G.wires.length,v:1.5,o:0,s:0,cut:false,info:null};G.wires.push(red);G.players[0].stands[0].push(red.id);act(G,0,{a:'info',id:G.officialState.allFalseInfo.decisionId,w:red.id,val:1});assert.equal(red.info.t,'not');assert.equal(red.info.v,'1');reject(G,0,{a:'info',id:G.officialState.allFalseInfo.decisionId,w:red.id,val:2});
}
{
 const G=rig([[2,4],[3,5],[6]]);act(G,0,{a:'dual',w:2,val:2});const before=JSON.parse(JSON.stringify(G));act(G,1,{a:'resolve',id:G.pending.id,w:2});assert.equal(G.wires[2].info.v,'2');assert.equal(G.det,1);assert.equal(C.availableInfoTokens(G,false).filter(t=>t.value===2).length,1);act(before,1,{a:'resolve',id:before.pending.id,w:2});assert.deepEqual(before.wires[2].info,G.wires[2].info);
 G.turn=0;G.det=0;act(G,0,{a:'dual',w:2,val:4});act(G,1,{a:'resolve',id:G.pending.id,w:2});assert.equal(G.wires[2].info.v,'2/4');assert.equal(G.wires[2].info.tokens.length,2);assert.equal(C.availableInfoTokens(G,false).filter(t=>t.value===4).length,1);
 const xy=rig([[2,4],[3,5],[6]]);xy.players[0].character={id:'xy-ray',used:false};xy.players[0].dd=false;act(xy,0,{a:'dual',w:2,val:2,vals:[2,4],xy:true,xyPersonal:true});assert.deepEqual(BB.view(xy,1).pending.clueValues,[2,4]);reject(xy,1,{a:'resolve',id:xy.pending.id,w:2,clueVal:3});act(xy,1,{a:'resolve',id:xy.pending.id,w:2,clueVal:4});assert.equal(xy.wires[2].info.v,'4');assert.equal(xy.det,1);
}
{
 const G=rig([[2],[3,3,3],[4]]);for(let i=0;i<3;i++){G.turn=0;G.det=0;act(G,0,{a:'dual',w:1+i,val:2});act(G,1,{a:'resolve',id:G.pending.id,w:1+i});}assert.equal(G.wires.filter(w=>w.info?.v==='2').length,2);assert.equal(G.wires[3].info,null);assert.equal(G.announcement.info.t,'not');assert.equal(G.announcement.info.v,'2');const announcement=JSON.stringify(G.announcement);reject(G,0,{a:'solo',val:2});assert.equal(JSON.stringify(G.announcement),announcement);
}
{
 const G=rig([[2,3],[5,6],[4,4,7]]);G.wires.filter(w=>w.v===4).forEach(w=>w.cut=true);G.equip=[{n:4,used:false}];act(G,1,{a:'equip',n:4,w:2});assert(!G.equip[0].used);const id=G.pending.id;
 for(let pi=-1;pi<3;pi++){const pd=BB.view(G,pi).pending;assert.equal('choices' in pd,pi===1);assert.equal('wire' in pd,pi===1);}assert(!BB.view(G,1).pending.choices.includes(5));const restored=JSON.parse(JSON.stringify(G));reject(G,0,{a:'false-info',id,val:2});reject(G,1,{a:'false-info',id:id-1,val:2});reject(G,1,{a:'false-info',id,val:5});act(G,1,{a:'false-info',id,val:2});act(restored,1,{a:'false-info',id,val:2});assert(G.equip[0].used);assert.equal(G.pending,null);assert.equal(G.wires[2].info.v,'2');assert.deepEqual(restored.wires[2].info,G.wires[2].info);assert.equal(G.turn,0);reject(G,1,{a:'false-info',id,val:3});
}
assert(!M.get('campaign',52).verified);
console.log('✓ 第52关失败猜值否定、开发保留多次否定、X/Y私人选择一个猜值、有限供给／口头回退，便利贴非回合私有错误数值选择／恢复／验证后一次耗牌；叠加与特殊例外未正式核实');
{
 const G=rig([[2,4],[1.1,3],[5]]);act(G,0,{a:'dual',w:2,val:2});act(G,1,{a:'resolve',id:G.pending.id,w:2});assert.equal(G.wires[2].info.t,'not');assert.equal(G.wires[2].info.v,'2');assert.equal(BB.view(G,0).players[1].stands[0].find(w=>w.id===2).v,null);
 const Y=rig([[1.1,2],[3,4],[5,7.1]]);act(Y,0,{a:'dual',w:2,val:'Y'});act(Y,1,{a:'resolve',id:Y.pending.id,w:2});assert.equal(Y.wires[2].info.v,'Y');assert.equal(C.availableInfoTokens(Y,true).filter(t=>t.value==='Y').length,1);
}
{
 const G=game(2);const pi=BB.setupActor(G),V=BB.view(G,pi);for(const w of V.players[pi].stands.flat())assert.equal(BB.setupInfoAllowed(V,w),BB.kindOf(w)!=='y');
}
console.log('✓ 第52关双人黄线目标失败标蓝色否定而不揭黄；黄猜失败否定黄消耗黄标记；公共本人视图允许初始红、不允许黄');
{
 const fs=require('fs'),os=require('os'),path=require('path'),Service=require('../server/official'),dir=fs.mkdtempSync(path.join(os.tmpdir(),'bb52-authority-'));
 function peer(room){return {room,readyState:1,messages:[],send(raw){this.messages.push(JSON.parse(raw));}};}
 function last(ws,topic){return ws.messages.filter(m=>m.topic===topic).at(-1)?.data;}
 try{for(const n of [2,3,4,5]){
  let G=game(n),name='bb-all-false'+n,seats=G.players.map(p=>({pid:p.pid,name:p.name,bot:false,credential:'假信息凭据'+p.pid})),wss={clients:new Set()};G.catalog=G.mission.catalog='campaign';
  fs.writeFileSync(path.join(dir,name+'.json'),JSON.stringify({version:1,name,host:seats[0].pid,mid:52,ruleset:'campaign',attempts:1,started:true,seats,observers:[],revision:0,seen:[],G}));let service=Service(wss,dir),room,peers,observer,observerCredential;
  function connect(){peers=seats.map(s=>{const ws=peer(name);wss.clients.add(ws);service.handle(ws,'hello',{credential:s.credential,name:s.name});return ws;});observer=peer(name);wss.clients.add(observer);service.handle(observer,'hello',observerCredential?{credential:observerCredential,name:'假线索观众'}:{spectator:true,name:'假线索观众'});observerCredential=last(observer,'official:welcome').credential;room=service.load(name);G=room.G;}
  function send(pi,id,a,revision=room.revision){service.handle(peers[pi],'official:act',{gid:G.gid,revision,commandId:id,pi:(pi+1)%n,action:a});}
  function unchanged(pi,id,a){const before=JSON.stringify(G);send(pi,id,a);assert.equal(JSON.stringify(G),before);}
  function acceptedOnce(pi,id,a){const before=room.revision;send(pi,id,a);assert.equal(room.revision,before+1);const frozen=JSON.stringify(G);send(pi,id,a);assert.equal(room.revision,before+1);assert.equal(JSON.stringify(G),frozen);}
  function restart(){wss.clients.forEach(ws=>ws.readyState=3);service=Service(wss,dir);connect();}
  function roundtrip(stage,who,a){const stale=room.revision;service.handle(peers[0],'official:pause',{gid:G.gid,revision:room.revision,commandId:'暂停'+stage,paused:true});assert(G.paused);unchanged(who,'暂停行动'+stage,a);const frozen=JSON.stringify(G);restart();assert.equal(JSON.stringify(G),frozen);service.handle(peers[0],'official:pause',{gid:G.gid,revision:room.revision,commandId:'继续'+stage,paused:false});assert(!G.paused);const before=JSON.stringify(G);send(who,'旧修订'+stage,a,stale);assert.equal(JSON.stringify(G),before);}
  function observerReadOnly(who){service.handle(observer,'official:perspective',{pid:seats[who].pid});const V=last(observer,'official:view').view;assert(!('fakeSetup' in V.official));if(V.pending){assert(!('choices' in V.pending));if(V.pending.type==='false-info')assert(!('wire' in V.pending));}const before=JSON.stringify(G);service.handle(observer,'official:act',{gid:G.gid,revision:room.revision,commandId:'观战尝试'+room.revision,action:{a:'info',id:G.officialState.allFalseInfo.decisionId,w:0,val:2}});assert.equal(JSON.stringify(G),before);}
  connect();let marks=0,redMarks=0;
  while(G.phase==='setup'){
   const who=BB.setupActor(G),V=last(peers[who],'official:view').view,pd=V.official.fakeSetup,w=G.wires.find(w=>w.o===who&&!w.info&&!G.officialState.allFalseInfo.initialIds.includes(w.id)&&BB.kindOf(w)==='r')||G.wires.find(w=>w.o===who&&!w.info&&!G.officialState.allFalseInfo.initialIds.includes(w.id)&&Number.isInteger(w.v)),token=C.availableInfoTokens(G,false).find(t=>t.value!==w.v),a={a:'info',id:pd.id,w:w.id,val:token.value};
   peers.forEach((ws,pi)=>assert.equal('fakeSetup' in last(ws,'official:view').view.official,pi===who));observerReadOnly(who);roundtrip('初始'+marks,who,a);unchanged((who+1)%n,'冒用初始'+marks,a);unchanged(who,'旧初始'+marks,{...a,id:a.id-1});if(Number.isInteger(w.v))unchanged(who,'真初始'+marks,{...a,val:w.v});acceptedOnce(who,'初始'+marks,a);if(BB.kindOf(w)==='r')redMarks++;marks++;
  }assert.equal(marks,n*2);assert(redMarks>0);assert.equal(G.officialState.allFalseInfo.initialIds.length,n*2);assert.equal(new Set(G.officialState.allFalseInfo.initialIds).size,n*2);
  // 从实际来源手牌合法拆出一对蓝4，验证共享便利贴解锁；保留全量与原排序。
  let source;for(let seed=1;seed<1000;seed++){source=game(n,0,seed*104729);if(source.equip.some(e=>e.n===4)&&source.wires.some(w=>w.o===0&&w.v===4)&&source.wires.some(w=>w.o!==0&&w.v===4))break;}assert(source.equip.some(e=>e.n===4));setup(source);source.catalog=source.mission.catalog='campaign';room.G=G=source;
  const target=G.wires.find(w=>w.o!==0&&w.v===4);acceptedOnce(0,'解锁宣告',{a:'dual',w:target.id,val:4});let cuts=0;while(G.pending){const who=G.pending.to,pd=last(peers[who],'official:view').view.pending,a={a:'resolve',id:pd.id,w:pd.step==='own'?pd.choices.at(-1):target.id};roundtrip('解锁回应'+cuts,who,a);acceptedOnce(who,'解锁回应'+cuts,a);cuts++;}assert.equal(BB.cutCount(G,4),2);assert(BB.equipUnlocked(G,4));
  const who=(G.turn+1)%n,w=G.wires.find(w=>w.o===who&&!w.cut&&!w.info&&Number.isInteger(w.v));assert(w);const turn=G.turn;acceptedOnce(who,'非回合便利贴',{a:'equip',n:4,w:w.id});assert.equal(G.pending.type,'false-info');assert(!G.equip.find(e=>e.n===4).used);const id=G.pending.id;observerReadOnly(who);peers.forEach((ws,pi)=>{const pd=last(ws,'official:view').view.pending;assert.equal('choices' in pd,pi===who);assert.equal('wire' in pd,pi===who);});const choice=last(peers[who],'official:view').view.pending.choices.find(v=>C.availableInfoTokens(G,false).some(t=>t.value===v));assert(choice);
  roundtrip('便利贴选值',who,{a:'false-info',id,val:choice});observerReadOnly(who);unchanged((who+1)%n,'冒用便利贴',{a:'false-info',id,val:choice});unchanged(who,'旧便利贴',{a:'false-info',id:id-1,val:choice});unchanged(who,'真实便利贴',{a:'false-info',id,val:w.v});acceptedOnce(who,'便利贴选值',{a:'false-info',id,val:choice});assert(G.equip.find(e=>e.n===4).used);assert.equal(G.pending,null);assert.equal(G.wires[w.id].info.t,'not');assert.equal(G.wires[w.id].info.v,String(choice));assert.equal(G.turn,turn);restart();assert(G.equip.find(e=>e.n===4).used);assert.equal(G.wires[w.id].info.v,String(choice));assert.equal(G.turn,turn);
 }}finally{fs.rmSync(dir,{recursive:true,force:true});}
 console.log('✓ 第52关2–5人权威来源：每次两枚蓝／红错误初始及非回合便利贴私有选择暂停／重连／重启、真值／冒用／过期／旧修订／重复拒绝；观战视角不接收私有菜单／目标，合法蓝4解锁后耗牌一次且不推进回合');
}
{
 const fs=require('fs'),os=require('os'),path=require('path'),Service=require('../server/official'),dir=fs.mkdtempSync(path.join(os.tmpdir(),'bb52-legacy-'));
 try{for(const n of [2,3,4,5]){
  const seats=Array.from({length:n},(_,i)=>({pid:'p'+i,name:'旧黑海任务'+i,credential:'旧黑海凭证'+i,bot:false})),mission=JSON.parse(JSON.stringify(M.get('custom',52)));mission.catalog='campaign';mission.contentVersion=17;
  const G=BB.createGame(mission,seats,{rng:rng(n*104729)});G.catalog='campaign';G.contentVersion=17;const name='bb-legacy52-'+n,before=JSON.stringify(G.mission);
  fs.writeFileSync(path.join(dir,name+'.json'),JSON.stringify({version:1,name,host:seats[0].pid,mid:52,ruleset:'campaign',attempts:1,started:true,seats,observers:[],revision:0,seen:[],G}));
  const restored=Service({clients:new Set()},dir).load(name).G;assert.equal(JSON.stringify(restored.mission),before);assert.equal(restored.contentVersion,17);assert(!restored.officialState);assert.equal(restored.ruleset,'custom');assert.deepEqual(restored.ymark,G.ymark);assert.deepEqual(restored.rmark,G.rmark);assert.equal(restored.detMax,G.detMax);assert.equal(BB.view(restored,0).official,null);assert(!BB.allFalseInfo(restored));
 }}finally{fs.rmSync(dir,{recursive:true,force:true});}
 console.log('✓ 第52关2–5人版本17改编存档保留原任务、红黄设置和引爆器，不追加全队假线索规则');
}

{
 const Bot=require('../js/bot');for(const n of [2,3,4,5]){const G=game(n);let actions=0;while(G.phase==='setup'){const pi=BB.setupActor(G),before=BB.view(G,pi),a=Bot.decide(G,pi);assert.equal(a.a,'info');assert(before.official.fakeSetup);assert(!before.official.fakeSetup.usedIds.includes(a.w));assert(a.val!==G.wires[a.w].v);const hidden=JSON.parse(JSON.stringify(G));hidden.wires.forEach(w=>{if(w.o!==pi&&!w.cut)w.v=12;});assert.deepEqual(Bot.decide(hidden,pi),a);act(G,pi,a);actions++;}assert.equal(actions,n*2);assert.equal(new Set(G.officialState.allFalseInfo.initialIds).size,n*2);}
 const G=rig([[2],[3,5],[4,4,6]]);G.wires.filter(w=>w.v===4).forEach(w=>w.cut=true);G.equip=[{n:4,used:false}];act(G,1,{a:'equip',n:4,w:1});const a=Bot.decide(G,1);assert.equal(a.a,'false-info');assert.notEqual(a.val,3);const copy=JSON.parse(JSON.stringify(G));assert.deepEqual(Bot.decide(copy,1),a);act(copy,1,a);assert(copy.equip[0].used);assert.equal(copy.wires[1].info.t,'not');assert.equal(copy.turn,0);
}
console.log('✓ 第52关机器人每人两根不同蓝／红错误标记，只根据本人值和公开库存；隐藏值变更不影响初始选择，私人便利贴恢复合法回复且不推进回合');
{
 const Bot=require('../js/bot'),originalRandom=Math.random,roles=Object.keys(BB.CHARACTERS),totals={won:0,lost:0};let markers=0,notes=0;
 try{for(const n of [2,3,4,5])for(let rotation=0;rotation<roles.length;rotation++)for(let seed=1;seed<=2;seed++){
  Math.random=rng((rotation+1)*100003+seed*104729+n);const captain=seed%n,seats=Array.from({length:n},(_,pi)=>({pid:'p'+pi,name:'假线索角色机器人'+pi,bot:true,character:pi===captain?'double-detector':roles[(rotation+pi-(pi>captain?1:0))%roles.length]}));let G=BB.createGame(M.get('official-development',52),seats,{captain,rng:Math.random}),steps=0;
  while(!['won','lost'].includes(G.phase)&&steps<700){let acted=false;for(let pi=0;pi<n;pi++){const a=Bot.decide(G,pi);if(!a)continue;act(G,pi,a);if(a.a==='info')markers++;if(a.a==='false-info')notes++;steps++;acted=true;break;}assert(acted||['won','lost'].includes(G.phase),'第52关机器人不能停止合法回合或私人回应');if(steps%17===0)G=JSON.parse(JSON.stringify(G));}
  assert(['won','lost'].includes(G.phase));totals[G.phase]++;
 }}finally{Math.random=originalRandom;}
 console.log('✓ 第52关2–5人五种角色40局：'+totals.won+'胜、'+totals.lost+'败，'+markers+'次初始假线索、'+notes+'次私人便利贴回复；非法／停止／超限0与过程恢复；不认证规则例外或策略充分性');
}
{
 const vm=require('vm'),fs=require('fs'),sandbox={window:{}};vm.createContext(sandbox);for(const file of ['missions','challenges','campaign-rules','engine','bot'])vm.runInContext(fs.readFileSync(require.resolve('../js/'+file+'.js'),'utf8'),sandbox,{filename:file+'.js'});
 const B=sandbox.window.BB,Missions=sandbox.window.BB_MISSIONS,Bot=sandbox.window.BBBot;for(const n of [2,3,4,5]){const G=B.createGame(Missions.get('official-development',52),Array.from({length:n},(_,i)=>({pid:'p'+i,name:'浏览器机器人'+i,bot:true})),{rng:rng(n*104729)});let steps=0;while(G.phase==='setup'){const pi=B.setupActor(G);assert.equal(B.act(G,pi,Bot.decide(G,pi)),null);steps++;}assert.equal(steps,n*2);}
}
console.log('✓ 第52关2–5人浏览器脚本环境机器人完成假标记：正确使用浏览器规则库命名空间，不依赖Node require');
