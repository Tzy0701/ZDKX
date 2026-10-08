// 保留原始来源设置与线架的便利贴恢复场景，非从开局完整机器人通关证据。
const assert=require('assert'),fs=require('fs'),os=require('os'),path=require('path');
const BB=require('../js/engine'),M=require('../js/missions'),Bot=require('../js/bot'),Service=require('../server/official');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'bb52-bot-restart-'));
function rng(s){return()=>((s=(Math.imul(s,1664525)+1013904223)>>>0)/4294967296);}
function peer(room){return {room,readyState:1,messages:[],send(raw){this.messages.push(JSON.parse(raw));}};}
async function until(check){const end=Date.now()+15000;while(!check()){assert(Date.now()<end,'假线索机器人便利贴恢复超时');await new Promise(r=>setTimeout(r,25));}}
(async()=>{try{for(const n of [2,3,4,5]){
 const seats=Array.from({length:n},(_,i)=>({pid:'p'+i,name:'假线索恢复机器人'+i,bot:true,credential:'假线索恢复凭据'+i}));let G;
 for(let seed=1;seed<2000;seed++){G=BB.createGame(M.get('official-development',52),seats,{captain:0,rng:rng(seed*104729)});if(G.equip.some(e=>e.n===4)&&G.wires.some(w=>w.o===0&&w.v===4)&&G.wires.some(w=>w.o!==0&&w.v===4))break;}
 assert(G.equip.some(e=>e.n===4));while(G.phase==='setup'){const pi=BB.setupActor(G),a=Bot.decide(G,pi);assert.equal(BB.act(G,pi,a),null);}
 const target=G.wires.find(w=>w.o!==0&&w.v===4);assert.equal(BB.act(G,0,{a:'dual',w:target.id,val:4}),null);while(G.pending){const pi=G.pending.to;assert.equal(BB.act(G,pi,Bot.decide(G,pi)),null);}assert.equal(BB.cutCount(G,4),2);
 const pi=(G.turn+1)%n,w=G.wires.find(w=>w.o===pi&&!w.cut&&!w.info&&Number.isInteger(w.v));assert(w);const turn=G.turn;assert.equal(BB.act(G,pi,{a:'equip',n:4,w:w.id}),null);const id=G.pending.id;G.paused=true;G.catalog=G.mission.catalog='campaign';
 const name='bb-false-info-bot'+n,credential='假线索观战房主凭据'+n;fs.writeFileSync(path.join(dir,name+'.json'),JSON.stringify({version:1,name,host:'watch',mid:52,ruleset:'campaign',attempts:1,started:true,seats,observers:[{pid:'watch',name:'假线索观战房主',credential,perspective:seats[pi].pid}],revision:0,seen:[],G}));
 const wss={clients:new Set()},observer=peer(name);wss.clients.add(observer);let service=Service(wss,dir);service.handle(observer,'hello',{credential,name:'假线索观战房主'});let room=service.load(name);assert(room.G.paused);observer.readyState=3;
 service=Service(wss,dir);room=service.load(name);assert.equal(room.G.pending.id,id);assert(!room.G.equip.find(e=>e.n===4).used);const restored=peer(name);wss.clients.add(restored);service.handle(restored,'hello',{credential,name:'假线索观战房主'});const before=restored.messages.filter(m=>m.topic==='official:view').at(-1).data.view;assert.equal(before.pending.type,'false-info');assert(!('choices' in before.pending));assert(!('wire' in before.pending));service.handle(restored,'official:pause',{gid:room.G.gid,revision:room.revision,commandId:'恢复假线索'+n,paused:false});
 await until(()=>room.G.equip.find(e=>e.n===4).used);assert.equal(room.G.pending,null);assert.equal(room.G.turn,turn);assert.equal(room.G.det,0);assert.equal(room.G.wires[w.id].info.t,'not');assert(!String(room.G.wires[w.id].info.v).split('/').includes(String(w.v)));service.handle(restored,'official:pause',{gid:room.G.gid,revision:room.revision,commandId:'完成后暂停'+n,paused:true});assert(room.G.paused);assert.equal(room.botTimer,null);
 const events=restored.messages.filter(m=>m.topic==='official:view').map(m=>m.data.view);events.forEach(V=>{if(V.pending?.type==='false-info'){assert(!('choices' in V.pending));assert(!('wire' in V.pending));}});
 console.log('✓ 第52关'+n+'人来源设置：合法蓝4解锁、非回合便利贴选值暂停／重启后机器人回复，仅耗牌一次、不推进回合、不标真值；观战视角不收私人字段');
}}finally{fs.rmSync(dir,{recursive:true,force:true});}})().catch(e=>{console.error(e);process.exitCode=1;});
