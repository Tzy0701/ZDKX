const assert=require('assert'),fs=require('fs'),os=require('os'),path=require('path');
const BB=require('../js/engine'),M=require('../js/missions'),Service=require('../server/official');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'bb43-bot-restart-'));
function peer(room){return {room,readyState:1,messages:[],send(raw){this.messages.push(JSON.parse(raw));}};}
async function until(check){const end=Date.now()+10000;while(!check()){assert(Date.now()<end,'补线机器人恢复超时');await new Promise(r=>setTimeout(r,25));}}
(async()=>{try{
 // 真实51根来源配置的终局场景：只剩本人最后两根1，以及最后一根备用红线。
 for(const n of [2,3]){
  const seats=Array.from({length:n},(_,i)=>({pid:'p'+i,name:'补线机器人'+i,bot:true,credential:'补线机器人凭证'+i}));
  const G=BB.createGame(M.get('official-development',43),seats,{captain:0,rng:()=>0.371});
  const blues=G.wires.filter(w=>w.v===1).slice(0,2),red=G.wires.find(w=>BB.kindOf(w)==='r');
  G.players.forEach(p=>p.stands=p.stands.map(()=>[]));
  G.wires.forEach(w=>{w.cut=true;if(w.o<0){w.o=0;w.s=0;}});
  blues.forEach(w=>{w.o=0;w.s=0;w.cut=false;});red.o=-1;red.s=-1;red.cut=false;
  G.wires.forEach(w=>{if(w.o>=0)G.players[w.o].stands[w.s].push(w.id);});
  G.players.forEach(p=>p.stands.forEach(st=>st.sort((a,b)=>G.wires[a].v-G.wires[b].v)));
  G.pending=null;G.phase='play';G.turn=0;G.setup=Object.fromEntries(seats.map((_,i)=>[i,1]));G.officialState.nano={position:1,direction:1,reserve:[red.id],waiting:false};
  assert.equal(BB.act(G,0,{a:'solo',val:1}),null);assert.equal(G.pending.type,'nano-rack');assert.equal(G.officialState.nano.reserve.length,0);assert.equal(G.officialState.nano.position,1);
  G.catalog=G.mission.catalog='campaign';G.paused=true;
  const name='bb-nano-bot'+n,credential='补线观战房主凭证'+n;
  fs.writeFileSync(path.join(dir,name+'.json'),JSON.stringify({version:1,name,host:'watch',mid:43,ruleset:'campaign',attempts:1,started:true,seats,observers:[{pid:'watch',name:'观战房主',credential,perspective:null}],revision:0,seen:[],G}));
  const wss={clients:new Set()},observer=peer(name);wss.clients.add(observer);let service=Service(wss,dir);service.handle(observer,'hello',{credential,name:'观战房主'});let room=service.load(name);
  const decision=JSON.parse(JSON.stringify(room.G.pending));assert(room.G.paused);observer.readyState=3;
  service=Service(wss,dir);room=service.load(name);assert.deepEqual(room.G.pending,decision);assert(room.G.paused);
  const restored=peer(name);wss.clients.add(restored);service.handle(restored,'hello',{credential,name:'观战房主'});
  service.handle(restored,'official:pause',{gid:room.G.gid,revision:room.revision,commandId:'继续补线'+n,paused:false});
  await until(()=>['won','lost'].includes(room.G.phase));assert.equal(room.G.phase,'won');assert.equal(room.G.officialState.nano.reserve.length,0);assert(room.G.wires.every(w=>w.cut));assert.equal(room.G.wires[red.id].o,0);assert.equal(room.G.pending,null);
 }
 console.log('✓ 第43关2／3人服务器机器人：私人补线选择暂停并重启后自行选架、公开最后红线并获胜（终局场景）');
}finally{fs.rmSync(dir,{recursive:true,force:true});}})().catch(e=>{console.error(e);process.exitCode=1;});
