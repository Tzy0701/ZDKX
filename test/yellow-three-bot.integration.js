// 保留来源总量与排序的后段恢复场景，不作为从开局整局通关证明。
const assert=require('assert'),fs=require('fs'),os=require('os'),path=require('path');
const BB=require('../js/engine'),M=require('../js/missions'),Service=require('../server/official');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'bb48-bot-restart-'));
function rng(s){return()=>((s=(Math.imul(s,1664525)+1013904223)>>>0)/4294967296);}
function peer(room){return {room,readyState:1,messages:[],send(raw){this.messages.push(JSON.parse(raw));}};}
async function until(check){const end=Date.now()+15000;while(!check()){assert(Date.now()<end,'三黄机器人恢复超时');await new Promise(r=>setTimeout(r,25));}}
(async()=>{try{for(const n of [2,3,4,5]){
 const seats=Array.from({length:n},(_,i)=>({pid:'p'+i,name:'三黄恢复机器人'+i,bot:true,credential:'三黄机器人凭证'+i})),G=BB.createGame(M.get('official-development',48),seats,{captain:0,rng:rng(n*104729)});
 while(G.phase==='setup'){const pi=BB.setupActor(G);assert.equal(BB.act(G,pi,{a:'info',w:G.wires.find(w=>w.o===pi&&BB.setupInfoAllowed(G,w)).id}),null);}
 G.wires.forEach(w=>{if(BB.kindOf(w)!=='y'){w.cut=true;w.info=null;}});const ids=G.wires.filter(w=>!w.cut).map(w=>w.id);assert.equal(ids.length,3);G.paused=true;G.catalog=G.mission.catalog='campaign';
 const name='bb-yellow-bot'+n,credential='三黄观战房主凭证'+n;
 fs.writeFileSync(path.join(dir,name+'.json'),JSON.stringify({version:1,name,host:'watch',mid:48,ruleset:'campaign',attempts:1,started:true,seats,observers:[{pid:'watch',name:'三黄观战房主',credential,perspective:null}],revision:0,seen:[],G}));
 const wss={clients:new Set()},observer=peer(name);wss.clients.add(observer);let service=Service(wss,dir);service.handle(observer,'hello',{credential,name:'三黄观战房主'});let room=service.load(name);assert(room.G.paused);observer.readyState=3;
 service=Service(wss,dir);room=service.load(name);assert(room.G.paused);assert.equal(room.G.pending,null);assert.equal(room.G.wires.length,n===2?54:53);
 const restored=peer(name);wss.clients.add(restored);service.handle(restored,'hello',{credential,name:'三黄观战房主'});service.handle(restored,'official:pause',{gid:room.G.gid,revision:room.revision,commandId:'恢复三黄'+n,paused:false});
 await until(()=>['won','lost'].includes(room.G.phase));assert.equal(room.G.phase,'won');assert(room.G.officialState.yellowThree.complete);assert.equal(room.G.det,0);assert(room.G.wires.every(w=>w.cut));assert.equal(room.G.pending,null);assert.equal(room.botTimer,null);
 const view=restored.messages.filter(m=>m.topic==='official:view').at(-1).data.view;assert.equal(view.phase,'won');assert(view.official.yellowThree.complete);assert.equal('ownAnswers' in (view.pending||{}),false);
 console.log('✓ 第48关'+n+'人服务器机器人：来源后段暂停／重启后主动发起三黄、逐人回应、零罚格获胜；非整局证明');
}}finally{fs.rmSync(dir,{recursive:true,force:true});}})().catch(e=>{console.error(e);process.exitCode=1;});
