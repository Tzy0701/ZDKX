const assert=require('assert'),fs=require('fs'),os=require('os'),path=require('path');
const BB=require('../js/engine'),M=require('../js/missions'),Service=require('../server/official');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'bb44-bot-restart-'));
function rng(s){return()=>((s=(Math.imul(s,1664525)+1013904223)>>>0)/4294967296);}
function peer(room){return {room,readyState:1,messages:[],send(raw){this.messages.push(JSON.parse(raw));}};}
async function until(check){const end=Date.now()+15000;while(!check()){assert(Date.now()<end,'氧气机器人恢复超时');await new Promise(r=>setTimeout(r,25));}}
(async()=>{try{for(let n=2;n<=5;n++){
 const seats=Array.from({length:n},(_,i)=>({pid:'p'+i,name:'氧气恢复机器人'+i,bot:true,credential:'氧气机器人凭证'+i}));let G;
 // 保留原始发牌及49根：四根9分给前两人各两根，红线在第二人，装备9在本局。
 for(let seed=1;seed<2000;seed++){
  G=BB.createGame(M.get('official-development',44),seats,{captain:0,rng:rng(seed*104729)});
  if(G.wires.filter(w=>w.o===0&&w.v===9).length===2&&G.wires.filter(w=>w.o===1&&w.v===9).length===2&&G.wires.some(w=>w.o===1&&BB.kindOf(w)==='r')&&G.equip.some(e=>e.n===9))break;
 }
 assert.equal(G.wires.filter(w=>w.o===0&&w.v===9).length,2);assert.equal(G.wires.filter(w=>w.o===1&&w.v===9).length,2);assert(G.wires.some(w=>w.o===1&&BB.kindOf(w)==='r'));assert(G.equip.some(e=>e.n===9));
 const firstTarget=G.wires.find(w=>w.o===1&&w.v===9);
 while(G.phase==='setup'){const pi=BB.setupActor(G),wire=pi===1?G.wires.find(w=>w.o===1&&w.v===9&&w.id!==firstTarget.id):G.wires.find(w=>w.o===pi&&BB.setupInfoAllowed(G,w));assert.equal(BB.act(G,pi,{a:'info',w:wire.id}),null);}
 // 终局场景：其余蓝线已处理；这不是从开局完整机器人通关的证明。
 G.wires.forEach(w=>{if(w.v!==9&&BB.kindOf(w)!=='r'){w.cut=true;w.info=null;}});G.turn=0;G.turnNo=23;G.officialState.oxygen.available=n*2;G.officialState.oxygen.replenishedTurn=23;
 const target=G.wires.find(w=>w.o===1&&w.v===9);assert.equal(BB.act(G,0,{a:'dual',w:target.id,val:9}),null);assert.equal(G.pending.step,'target');assert.equal(G.officialState.oxygen.available,n*2-3);
 G.catalog=G.mission.catalog='campaign';G.paused=true;const name='bb-oxygen-bot'+n,credential='氧气观战房主凭证'+n;
 fs.writeFileSync(path.join(dir,name+'.json'),JSON.stringify({version:1,name,host:'watch',mid:44,ruleset:'campaign',attempts:1,started:true,seats,observers:[{pid:'watch',name:'氧气观战房主',credential,perspective:null}],revision:0,seen:[],G}));
 const wss={clients:new Set()},observer=peer(name);wss.clients.add(observer);let service=Service(wss,dir);service.handle(observer,'hello',{credential,name:'氧气观战房主'});let room=service.load(name);
 const pending=JSON.parse(JSON.stringify(room.G.pending));assert(room.G.paused);observer.readyState=3;service=Service(wss,dir);room=service.load(name);assert.deepEqual(room.G.pending,pending);assert(room.G.paused);assert.equal(room.G.officialState.oxygen.available,n*2-3);
 const restored=peer(name);wss.clients.add(restored);service.handle(restored,'hello',{credential,name:'氧气观战房主'});service.handle(restored,'official:pause',{gid:room.G.gid,revision:room.revision,commandId:'继续氧气'+n,paused:false});
 await until(()=>['won','lost'].includes(room.G.phase));assert.equal(room.G.phase,'won');assert.equal(room.G.wires.length,49);assert(room.G.wires.every(w=>w.cut));assert.equal(room.G.det,0);assert.equal(room.G.pending,null);
 assert.equal(room.G.officialState.oxygen.available,n===2?1:n*2-6);assert.equal(room.G.equip.find(e=>e.n===9).used,n===2);
 console.log('✓ 第44关'+n+'人服务器机器人：耗氧后私人回应暂停／重启恢复，回应不重复扣氧'+(n===2?'，缺氧时稳定器跳过、队长补满':'')+'并公开最后红线获胜（终局场景）');
}}finally{fs.rmSync(dir,{recursive:true,force:true});}})().catch(e=>{console.error(e);process.exitCode=1;});
