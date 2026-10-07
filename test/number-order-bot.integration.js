// 保留来源总量／发牌的后段命令恢复场景，不作为开局完整联机通关证明。
const assert=require('assert'),fs=require('fs'),os=require('os'),path=require('path');
const BB=require('../js/engine'),M=require('../js/missions'),Service=require('../server/official');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'bb51-bot-restart-'));
function rng(s){return()=>((s=(Math.imul(s,1664525)+1013904223)>>>0)/4294967296);}
function peer(room){return {room,readyState:1,messages:[],send(raw){this.messages.push(JSON.parse(raw));}};}
async function until(check){const end=Date.now()+15000;while(!check()){assert(Date.now()<end,'命令机器人恢复超时');await new Promise(r=>setTimeout(r,25));}}
(async()=>{try{for(const n of [2,3,4,5]){
 const seats=Array.from({length:n},(_,i)=>({pid:'p'+i,name:'命令恢复机器人'+i,bot:true,credential:'命令机器人凭据'+i}));let G;
 for(let seed=1;seed<5000;seed++){G=BB.createGame(M.get('official-development',51),seats,{captain:0,rng:rng(seed*104729)});if(G.wires.filter(w=>w.o===0&&w.v===2).length===2&&G.wires.filter(w=>w.o===1&&w.v===2).length===2)break;}
 assert.equal(G.wires.filter(w=>w.o===0&&w.v===2).length,2);assert.equal(G.wires.filter(w=>w.o===1&&w.v===2).length,2);
 while(G.phase==='setup'){const pi=BB.setupActor(G);assert.equal(BB.act(G,pi,{a:'info',w:G.wires.find(w=>w.o===pi&&BB.setupInfoAllowed(G,w)).id}),null);}
 G.wires.forEach(w=>{if(w.v!==2){w.cut=true;w.info=null;}});G.paused=true;G.catalog=G.mission.catalog='campaign';
 const name='bb-number-order-bot'+n,credential='命令观战房主凭据'+n;
 fs.writeFileSync(path.join(dir,name+'.json'),JSON.stringify({version:1,name,host:'watch',mid:51,ruleset:'campaign',attempts:1,started:true,seats,observers:[{pid:'watch',name:'命令观战房主',credential,perspective:null}],revision:0,seen:[],G}));
 const wss={clients:new Set()},observer=peer(name);wss.clients.add(observer);let service=Service(wss,dir);service.handle(observer,'hello',{credential,name:'命令观战房主'});let room=service.load(name);assert(room.G.paused);const state=JSON.parse(JSON.stringify(BB.numberOrder(room.G)));observer.readyState=3;
 service=Service(wss,dir);room=service.load(name);assert(room.G.paused);assert.deepEqual(BB.numberOrder(room.G),state);const restored=peer(name);wss.clients.add(restored);service.handle(restored,'hello',{credential,name:'命令观战房主'});service.handle(restored,'official:pause',{gid:room.G.gid,revision:room.revision,commandId:'恢复命令'+n,paused:false});
 await until(()=>['won','lost'].includes(room.G.phase));assert.equal(room.G.phase,'won');assert.equal(room.G.det,-1);assert(room.G.wires.every(w=>w.cut));assert.equal(room.G.pending,null);assert.equal(room.botTimer,null);assert.equal(BB.numberOrder(room.G).retired.length,12);
 const seen=restored.messages.filter(m=>m.topic==='official:view').map(m=>m.data.view);for(const step of ['assign','answer','cut'])assert(seen.some(V=>V.official.numberOrder.step===step));assert(seen.some(V=>V.pending?.type==='cut'));seen.forEach(V=>{assert(!('deck' in V.official.numberOrder));assert(!V.pending||!('choices' in V.pending));});
 console.log('✓ 第51关'+n+'人服务器机器人：来源后段暂停／重启后翻牌、独立指定、遵命、双方选线与原长官接班，零罚格获胜、数字退场／观战只读；非整局证明');
}}finally{fs.rmSync(dir,{recursive:true,force:true});}})().catch(e=>{console.error(e);process.exitCode=1;});
