const assert=require('assert'),fs=require('fs'),os=require('os'),path=require('path');
const BB=require('../js/engine'),M=require('../js/missions'),Service=require('../server/official');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'bb47-bot-restart-'));
function rng(s){return()=>((s=(Math.imul(s,1664525)+1013904223)>>>0)/4294967296);}
function peer(room){return {room,readyState:1,messages:[],send(raw){this.messages.push(JSON.parse(raw));}};}
async function until(check){const end=Date.now()+15000;while(!check()){assert(Date.now()<end,'算式机器人恢复超时');await new Promise(r=>setTimeout(r,25));}}
(async()=>{try{for(let n=2;n<=5;n++){
 const seats=Array.from({length:n},(_,i)=>({pid:'p'+i,name:'算式恢复机器人'+i,bot:true,credential:'算式机器人凭证'+i}));let G;
 for(let seed=1;seed<5000;seed++){G=BB.createGame(M.get('official-development',47),seats,{captain:0,rng:rng(seed*104729)});if(G.wires.filter(w=>w.o===0&&w.v===12).length===2&&G.wires.filter(w=>w.o===1&&w.v===12).length===2)break;}
 assert.equal(G.wires.filter(w=>w.o===0&&w.v===12).length,2);assert.equal(G.wires.filter(w=>w.o===1&&w.v===12).length,2);
 while(G.phase==='setup'){const pi=BB.setupActor(G);assert.equal(BB.act(G,pi,{a:'info',w:G.wires.find(w=>w.o===pi&&BB.setupInfoAllowed(G,w)).id}),null);}
 // 保持实际发牌和50／51根总量的恢复场景：其他线已完成，余四根12与本轮最后两张牌。
 // 不作为从开局整局通关证明。
 G.wires.forEach(w=>{if(w.v!==12){w.cut=true;w.info=null;}});G.turn=0;const arithmetic=BB.arithmetic(G);arithmetic.open=[3,9];arithmetic.discard=Array.from({length:12},(_,i)=>i+1).filter(v=>![3,9].includes(v));
 const target=G.wires.find(w=>w.o===1&&w.v===12);assert.equal(BB.act(G,0,{a:'dual',w:target.id,val:12,cards:[3,9],operation:'sum'}),null);assert.equal(arithmetic.open.length,0);assert.equal(arithmetic.discard.length,12);const decision=G.pending.id;G.paused=true;G.catalog=G.mission.catalog='campaign';
 const name='bb-arithmetic-bot'+n,credential='算式观战房主凭证'+n;fs.writeFileSync(path.join(dir,name+'.json'),JSON.stringify({version:1,name,host:'watch',mid:47,ruleset:'campaign',attempts:1,started:true,seats,observers:[{pid:'watch',name:'算式观战房主',credential,perspective:null}],revision:0,seen:[],G}));
 const wss={clients:new Set()},observer=peer(name);wss.clients.add(observer);let service=Service(wss,dir);service.handle(observer,'hello',{credential,name:'算式观战房主'});let room=service.load(name);assert(room.G.paused);observer.readyState=3;
 service=Service(wss,dir);room=service.load(name);assert(room.G.paused);assert.equal(room.G.pending.id,decision);assert.equal(BB.arithmetic(room.G).open.length,0);assert.equal(BB.arithmetic(room.G).discard.length,12);
 const restored=peer(name);wss.clients.add(restored);service.handle(restored,'hello',{credential,name:'算式观战房主'});service.handle(restored,'official:pause',{gid:room.G.gid,revision:room.revision,commandId:'恢复算式'+n,paused:false});
 await until(()=>['won','lost'].includes(room.G.phase));assert.equal(room.G.phase,'won');assert.equal(room.G.det,0);assert.equal(room.G.wires.length,n===2?51:50);assert(room.G.wires.every(w=>w.cut));assert.equal(BB.arithmetic(room.G).resets,1);assert.equal(BB.arithmetic(room.G).open.length,10);assert.equal(BB.arithmetic(room.G).discard.length,2);assert.equal(new Set(BB.arithmetic(room.G).open.concat(BB.arithmetic(room.G).discard)).size,12);
 console.log('✓ 第47关'+n+'人服务器机器人：最后两张牌宣告后私人回应暂停／重启恢复，牌堆只重置一次，再合法算式拆线获胜，零罚格（恢复场景）');
}}finally{fs.rmSync(dir,{recursive:true,force:true});}})().catch(e=>{console.error(e);process.exitCode=1;});
