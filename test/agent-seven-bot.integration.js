const assert=require('assert'),fs=require('fs'),os=require('os'),path=require('path');
const BB=require('../js/engine'),fixture=require('./agent-seven.fixture'),Service=require('../server/official');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'bb46-bot-restart-'));
function peer(room){return {room,readyState:1,messages:[],send(raw){this.messages.push(JSON.parse(raw));}};}
async function until(check){const end=Date.now()+15000;while(!check()){assert(Date.now()<end,'许可回应机器人恢复超时');await new Promise(r=>setTimeout(r,25));}}
(async()=>{try{for(let n=2;n<=5;n++){
 const seats=Array.from({length:n},(_,i)=>({pid:'p'+i,name:'许可恢复机器人'+i,bot:true,credential:'许可机器人凭证'+i})),G=fixture(seats),actor=G.turn,ids=G.wires.filter(w=>!w.cut&&w.v===7).map(w=>w.id);
 assert.equal(BB.act(G,actor,{a:'precision-cut',ws:ids}),null);const decision=G.pending.id;assert.equal(G.pending.type,'precision-cut');G.catalog=G.mission.catalog='campaign';G.paused=true;
 const name='bb-license-bot'+n,credential='许可观战房主凭证'+n;
 fs.writeFileSync(path.join(dir,name+'.json'),JSON.stringify({version:1,name,host:'watch',mid:46,ruleset:'campaign',attempts:1,started:true,seats,observers:[{pid:'watch',name:'许可观战房主',credential,perspective:null}],revision:0,seen:[],G}));
 const wss={clients:new Set()},observer=peer(name);wss.clients.add(observer);let service=Service(wss,dir);service.handle(observer,'hello',{credential,name:'许可观战房主'});let room=service.load(name);const pending=JSON.parse(JSON.stringify(room.G.pending));assert(room.G.paused);observer.readyState=3;
 service=Service(wss,dir);room=service.load(name);assert(room.G.paused);assert.deepEqual(room.G.pending,pending);assert.equal(room.G.pending.id,decision);
 const restored=peer(name);wss.clients.add(restored);service.handle(restored,'hello',{credential,name:'许可观战房主'});service.handle(restored,'official:pause',{gid:room.G.gid,revision:room.revision,commandId:'恢复许可'+n,paused:false});
 await until(()=>room.G.officialState.precision.complete||room.G.phase==='lost');assert(room.G.officialState.precision.complete);assert.notEqual(room.G.phase,'lost');assert.equal(room.G.pending,null);assert(ids.every(id=>room.G.wires[id].cut));assert.equal(room.G.det,0);
 if(room.G.phase==='play'){service.handle(restored,'official:pause',{gid:room.G.gid,revision:room.revision,commandId:'验收后暂停'+n,paused:true});assert(room.G.paused);assert.equal(room.botTimer,null);}
 const responses=room.G.log.filter(entry=>entry.t.includes('公开回应：'));assert(responses.length>=2);
 console.log('✓ 第46关'+n+'人来源许可场景：私人逐人回应暂停／服务重启后机器人自行完成四7，零罚格；非整局证明');
}}finally{fs.rmSync(dir,{recursive:true,force:true});}})().catch(e=>{console.error(e);process.exitCode=1;});
