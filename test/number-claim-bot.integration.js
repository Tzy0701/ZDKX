const assert=require('assert'),fs=require('fs'),os=require('os'),path=require('path');
const BB=require('../js/engine'),M=require('../js/missions'),Service=require('../server/official');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'bb45-bot-restart-'));
function rng(s){return()=>((s=(Math.imul(s,1664525)+1013904223)>>>0)/4294967296);}
function peer(room){return {room,readyState:1,messages:[],send(raw){this.messages.push(JSON.parse(raw));}};}
async function until(check){const end=Date.now()+15000;while(!check()){assert(Date.now()<end,'非队长机器人认领恢复超时');await new Promise(r=>setTimeout(r,25));}}
(async()=>{try{for(let n=2;n<=5;n++){
 const seats=Array.from({length:n},(_,i)=>({pid:'p'+i,name:'认领恢复机器人'+i,bot:true,credential:'认领机器人凭证'+i}));let G;
 for(let seed=1;seed<5000;seed++){G=BB.createGame(M.get('official-development',45),seats,{captain:0,rng:rng(seed*104729)});if(G.wires.filter(w=>w.o===1&&w.v===3).length===4)break;}
 assert.equal(G.wires.filter(w=>w.o===1&&w.v===3).length,4);
 while(G.phase==='setup'){const pi=BB.setupActor(G);assert.equal(BB.act(G,pi,{a:'info',w:G.wires.find(w=>w.o===pi&&BB.setupInfoAllowed(G,w)).id}),null);}
 // 保持实际发牌和50／51根总量的终局场景：队长空手，只有另一机器人剩四根3。
 // 这是调度／恢复验收，不是从开局完整机器人通关的证明。
 G.wires.forEach(w=>{if(w.v!==3){w.cut=true;w.info=null;}});G.turn=0;G.turnNo=23;const r=G.officialState.numberClaim;r.deck=[3];r.discard=[];r.retired=Array.from({length:12},(_,i)=>i+1).filter(v=>v!==3);r.step='draw';
 assert.equal(BB.act(G,0,{a:'claim-draw',id:r.decisionId}),null);assert.equal(r.step,'claim');assert.equal(r.value,3);assert(!G.wires.some(w=>w.o===0&&!w.cut));
 G.catalog=G.mission.catalog='campaign';G.paused=true;const name='bb-claim-bot'+n,credential='认领观战房主凭证'+n;
 fs.writeFileSync(path.join(dir,name+'.json'),JSON.stringify({version:1,name,host:'watch',mid:45,ruleset:'campaign',attempts:1,started:true,seats,observers:[{pid:'watch',name:'认领观战房主',credential,perspective:null}],revision:0,seen:[],G}));
 const wss={clients:new Set()},observer=peer(name);wss.clients.add(observer);let service=Service(wss,dir);service.handle(observer,'hello',{credential,name:'认领观战房主'});let room=service.load(name);assert(room.G.paused);const decision=room.G.officialState.numberClaim.decisionId;
 observer.readyState=3;service=Service(wss,dir);room=service.load(name);assert(room.G.paused);assert.equal(room.G.officialState.numberClaim.decisionId,decision);const restored=peer(name);wss.clients.add(restored);service.handle(restored,'hello',{credential,name:'认领观战房主'});
 service.handle(restored,'official:pause',{gid:room.G.gid,revision:room.revision,commandId:'继续认领'+n,paused:false});
 await until(()=>['won','lost'].includes(room.G.phase));assert.equal(room.G.phase,'won');assert.equal(room.G.wires.length,n===2?51:50);assert(room.G.wires.every(w=>w.cut));assert.equal(room.G.det,0);
 assert(restored.messages.some(m=>m.topic==='official:view'&&m.data.view.official.numberClaim.actor===1));assert(!room.G.log.some(entry=>entry.t.includes('被队长指定行动')));assert(room.G.officialState.numberClaim.retired.includes(3));
 console.log('✓ 第45关'+n+'人服务器机器人：认领阶段暂停／重启后，空手队长之外的机器人自行认领并四根单拆获胜，无错误指定或罚格（终局场景）');
 if(n===2){
  const mixedG=JSON.parse(JSON.stringify(G)),mixedSeats=JSON.parse(JSON.stringify(seats));mixedG.players[1].bot=false;mixedSeats[1].bot=false;
  const mixedName='bb-claim-human',mixedCredential=credential+'混合';
  fs.writeFileSync(path.join(dir,mixedName+'.json'),JSON.stringify({version:1,name:mixedName,host:'watch',mid:45,ruleset:'campaign',attempts:1,started:true,seats:mixedSeats,observers:[{pid:'watch',name:'混合观战房主',credential:mixedCredential,perspective:null}],revision:0,seen:[],G:mixedG}));
  const mixedWss={clients:new Set()},watch=peer(mixedName),human=peer(mixedName);mixedWss.clients.add(watch);mixedWss.clients.add(human);const mixedService=Service(mixedWss,dir);mixedService.handle(watch,'hello',{credential:mixedCredential,name:'混合观战房主'});mixedService.handle(human,'hello',{credential:mixedSeats[1].credential,name:'认领真人'});const mixed=mixedService.load(mixedName);
  mixedService.handle(watch,'official:pause',{gid:mixed.G.gid,revision:mixed.revision,commandId:'开启真人认领',paused:false});assert(mixed.botTimer,'队长机器人应等待真人，再考虑无人认领指定');
  mixedService.handle(human,'official:act',{gid:mixed.G.gid,revision:mixed.revision,commandId:'真人先认领',action:{a:'claim-number',id:mixed.G.officialState.numberClaim.decisionId}});
  assert.equal(mixed.G.officialState.numberClaim.actor,1);assert.equal(mixed.botTimer,null,'真人认领应取消队长机器人待执行的指定');assert.equal(mixed.G.det,0);
  mixedService.handle(human,'official:act',{gid:mixed.G.gid,revision:mixed.revision,commandId:'真人单拆',action:{a:'solo',val:3}});assert.equal(mixed.G.phase,'won');assert.equal(mixed.G.det,0);
  console.log('✓ 第45关混合人机：真人认领取消队长机器人待执行的指定，无抢回行动权或额外罚格');
 }
}}finally{fs.rmSync(dir,{recursive:true,force:true});}})().catch(e=>{console.error(e);process.exitCode=1;});
