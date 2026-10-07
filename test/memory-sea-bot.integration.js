// 原始来源发牌后段恢复场景，不是从开局完整通关证明。
const assert=require('assert'),fs=require('fs'),os=require('os'),path=require('path');
const BB=require('../js/engine'),M=require('../js/missions'),Service=require('../server/official');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'bb50-bot-restart-'));
function rng(s){return()=>((s=(Math.imul(s,1664525)+1013904223)>>>0)/4294967296);}
function peer(room){return {room,readyState:1,messages:[],send(raw){this.messages.push(JSON.parse(raw));}};}
async function until(check){const end=Date.now()+15000;while(!check()){assert(Date.now()<end,'黑海记忆机器人恢复超时');await new Promise(r=>setTimeout(r,25));}}
(async()=>{try{for(const n of [2,3,4,5]){
 const seats=Array.from({length:n},(_,i)=>({pid:'p'+i,name:'黑海记忆恢复机器人'+i,bot:true,credential:'黑海记忆机器人凭证'+i}));let G;
 for(let seed=1;seed<5000;seed++){G=BB.createGame(M.get('official-development',50),seats,{captain:0,rng:rng(seed*104729)});if(G.wires.filter(w=>w.o===0&&w.v===2).length===2&&G.wires.filter(w=>w.o===1&&w.v===2).length===2)break;}
 assert.equal(G.wires.filter(w=>w.o===0&&w.v===2).length,2);assert.equal(G.wires.filter(w=>w.o===1&&w.v===2).length,2);
 while(G.phase==='memory-preview')assert.equal(BB.act(G,G.pending.to,{a:'memory-ready',id:G.pending.id}),null);
 while(G.phase==='setup'){const pi=BB.setupActor(G);assert.equal(BB.act(G,pi,{a:'info',w:G.wires.find(w=>w.o===pi&&BB.setupInfoAllowed(G,w)).id}),null);}
 G.wires.forEach(w=>{if(w.v!==2){w.cut=true;w.info=null;}});const memory=JSON.parse(JSON.stringify(G.officialState.memorySea.botMemories));assert(Object.keys(memory).length===n);G.paused=true;G.catalog=G.mission.catalog='campaign';
 const name='bb-personal-oxygen-bot'+n,credential='黑海记忆观战房主凭证'+n;
 fs.writeFileSync(path.join(dir,name+'.json'),JSON.stringify({version:1,name,host:'watch',mid:50,ruleset:'campaign',attempts:1,started:true,seats,observers:[{pid:'watch',name:'氧气观战房主',credential,perspective:null}],revision:0,seen:[],G}));
 const wss={clients:new Set()},observer=peer(name);wss.clients.add(observer);let service=Service(wss,dir);service.handle(observer,'hello',{credential,name:'氧气观战房主'});let room=service.load(name);assert(room.G.paused);observer.readyState=3;
 service=Service(wss,dir);room=service.load(name);assert(room.G.paused);assert.deepEqual(room.G.officialState.memorySea.botMemories,memory);const restored=peer(name);wss.clients.add(restored);service.handle(restored,'hello',{credential,name:'氧气观战房主'});service.handle(restored,'official:pause',{gid:room.G.gid,revision:room.revision,commandId:'恢复黑海记忆'+n,paused:false});
 await until(()=>['won','lost'].includes(room.G.phase));assert.equal(room.G.phase,'won');assert.equal(room.G.det,0);assert(room.G.wires.every(w=>w.cut));assert.equal(room.G.pending,null);assert.equal(room.botTimer,null);const seen=restored.messages.filter(m=>m.topic==='official:view').map(m=>m.data.view);assert(seen.some(V=>V.pending?.type==='cut'));seen.forEach(V=>{assert(!('botMemories' in V.official.memorySea));assert(!V.pending||!('choices' in V.pending));});
 console.log('✓ 第50关'+n+'人服务器机器人：来源后段暂停／重启后私有记忆原样恢复、双方选线、两次蓝2拆线零罚格获胜；观战不接收记忆／私人选择；非整局证明');
}}finally{fs.rmSync(dir,{recursive:true,force:true});}})().catch(e=>{console.error(e);process.exitCode=1;});
