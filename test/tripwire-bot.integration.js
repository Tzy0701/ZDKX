const assert=require('assert'),fs=require('fs'),os=require('os'),path=require('path'),BB=require('../js/engine'),M=require('../js/missions'),Service=require('../server/official');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'bb41-bot-resume-'));
function rng(seed){return()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);}
function peer(room){return {room,readyState:1,messages:[],send(raw){this.messages.push(JSON.parse(raw));}};}
async function until(check){const end=Date.now()+10000;while(!check()){assert(Date.now()<end,'机器人恢复超时');await new Promise(r=>setTimeout(r,25));}}
(async()=>{let G;try{
 const seats=Array.from({length:3},(_,i)=>({pid:'p'+i,name:'救援机器人'+i,bot:true,credential:'机器人凭证'+i}));
 for(let seed=1;seed<=200;seed++){G=BB.createGame(M.get('official-development',41),seats,{captain:0,rng:rng(seed*104729)});if(G.equip.some(e=>e.n===2))break;}assert(G.equip.some(e=>e.n===2));
 while(G.phase==='setup'){const pd=BB.view(G,G.pending.to).pending;assert.equal(BB.act(G,pd.to,{a:'initial-clue',id:pd.id,w:pd.choices.length?pd.choices.at(-1):null,rack:0},{rng:()=>0.371}),null);}
 for(let k=0;k<300&&!G.officialState.tripwire.stalled;k++){
  const pi=G.pending?G.pending.to:G.turn;let a;if(G.pending){const pd=G.pending;a={a:'resolve',id:pd.id,w:pd.step==='own'?BB.view(G,pi).pending.choices.at(-1):pd.ids.find(id=>G.wires[id].v===pd.vals[0])};}else{const value=G.wires.find(w=>w.o===pi&&!w.cut&&BB.kindOf(w)==='b').v,target=G.wires.find(w=>w.o!==pi&&!w.cut&&w.v===value);a=BB.soloOk(G,pi,value)?{a:'solo',val:value}:{a:'dual',w:target.id,val:value};}assert.equal(BB.act(G,pi,a),null);
 }assert(G.officialState.tripwire.stalled);G.catalog=G.mission.catalog='campaign';const name='bb-bot-tripwire',credential='观战房主凭证';
 fs.writeFileSync(path.join(dir,name+'.json'),JSON.stringify({version:1,name,host:'watch',mid:41,ruleset:'campaign',attempts:1,started:true,seats,observers:[{pid:'watch',name:'观战房主',credential,perspective:null}],revision:0,seen:[],G}));
 const wss={clients:new Set()},observer=peer(name);wss.clients.add(observer);let service=Service(wss,dir);service.handle(observer,'hello',{credential,name:'观战房主'});let room=service.load(name);
 await until(()=>room.G.pending?.type==='walkie');service.handle(observer,'official:pause',{gid:room.G.gid,revision:room.revision,commandId:'暂停救援',paused:true});assert(room.G.paused);const pending=JSON.parse(JSON.stringify(room.G.pending));observer.readyState=3;
 service=Service(wss,dir);room=service.load(name);assert.deepEqual(room.G.pending,pending);assert(room.G.paused);const restored=peer(name);wss.clients.add(restored);service.handle(restored,'hello',{credential,name:'观战房主'});service.handle(restored,'official:pause',{gid:room.G.gid,revision:room.revision,commandId:'继续救援',paused:false});
 await until(()=>['won','lost'].includes(room.G.phase));assert.equal(room.G.phase,'won');assert.equal(BB.cutCount(room.G,'Y'),3);assert(room.G.equip.find(e=>e.n===2).used);assert(!room.G.officialState.tripwire.stalled);
 console.log('✓ 第41关服务器机器人从全员跳过局面自行发起随时交换；交换中暂停与服务重启后继续，红线队员处理绊线并完整通关');
}finally{fs.rmSync(dir,{recursive:true,force:true});}})().catch(e=>{console.error(e);process.exitCode=1;});
