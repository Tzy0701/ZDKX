// 原卡挑战组件验收；不把组件测试称为第55关完整验收。
const assert=require('assert'),H=require('../js/challenges'),BB=require('../js/engine'),M=require('../js/missions');
function rng(s){return()=>((s=(Math.imul(s,1664525)+1013904223)>>>0)/4294967296);}
function fixture(n,cap=0,seed=1){
 const mission=JSON.parse(JSON.stringify(M.get('physical',4)));Object.assign(mission,{id:55,y:[0,0],r:[2,2],two:{r:[2,3]},eq:0,verified:false});delete mission.officialModule;
 const G=BB.createGame(mission,Array.from({length:n},(_,i)=>({pid:'p'+i,name:'挑战玩家'+i})),{captain:cap,rng:rng(seed)});
 while(G.phase==='setup'){const p=BB.setupActor(G),w=G.wires.find(w=>w.o===p&&BB.setupInfoAllowed(G,w));assert.equal(BB.act(G,p,{a:'info',w:w.id}),null);}
 return G;
}
function pattern(G,owner,index,values,cuts){G.wires=[];G.players.forEach(p=>p.stands=p.stands.map(()=>[]));values.forEach((v,id)=>{G.wires.push({id,v,o:owner,s:index,cut:cuts.includes(id),info:null});G.players[owner].stands[index].push(id);});}
function state(G,ids){return {version:1,gid:G.gid,cards:ids.map(id=>({id,done:false})),completedValues:[]};}
function rejection(G,s,fn){const before=JSON.stringify([G,s]);const r=fn();assert(typeof r==='string'?r:r.error);assert.equal(JSON.stringify([G,s]),before);}
assert.equal(BB.CHALLENGES.length,10);assert(BB.CHALLENGES.every((c,i)=>c.id===i+1&&c.desc));
for(const n of [2,3,4,5])for(let cap=0;cap<n;cap++)for(let seed=1;seed<=25;seed++){
 const G=fixture(n,cap,seed*104729),s=H.create(G.gid,n,rng(seed));assert.equal(s.cards.length,n);assert.equal(new Set(s.cards.map(c=>c.id)).size,n);assert(s.cards.every(c=>c.id>=1&&c.id<=10&&!c.done));assert.equal(G.wires.length,50);assert.equal(G.wires.filter(w=>Number.isInteger(w.v)).length,48);assert.equal(G.rmark.n,2);assert.equal(G.rmark.cand.length,n===2?3:2);
 for(const c of s.cards)if(c.id===8){assert.equal(c.values.length,2);assert.equal(new Set(c.values).size,2);assert(c.values.every(v=>v>=1&&v<=12));}
 assert.deepEqual(H.view(s),H.view(JSON.parse(JSON.stringify(s))));
}
console.log('✓ 挑战组件2–5人：从10张唯一牌随机抽人数张、挑战8两张不同数字、可保存恢复；来源50蓝红设置仅作组件夹具，不认证整关或特殊引爆器');
{
 const G=fixture(2),s=state(G,[3,6,9,10]);
 pattern(G,0,0,[1,1,2,3,3],[2]);assert(H.rackEligible(G,0,0,3));assert(!H.rackEligible(G,0,1,3));pattern(G,0,0,[1,1,2,3],[2]);assert(!H.rackEligible(G,0,0,3));
 pattern(G,0,0,[1,2,3,4,5,6,7,8,9],[1,3,5,7]);assert(H.rackEligible(G,0,0,6));pattern(G,0,0,[1,2,3,4,5,6,7,8,9],[1,3,5]);assert(!H.rackEligible(G,0,0,6));
 pattern(G,0,0,[1,2,3,4,5,5.1,5.5],[]);assert(H.rackEligible(G,0,0,9));pattern(G,0,0,[1,1,2,3,4],[]);assert(!H.rackEligible(G,0,0,9));pattern(G,0,0,[1,2,3,4,5,6],[]);assert(!H.rackEligible(G,0,0,9));pattern(G,0,0,[1.5,2.1],[]);assert(!H.rackEligible(G,0,0,9));
 pattern(G,0,0,[1,2,3,4,5,6,7,8,9],[1,2,3,4,5,6,7]);assert(H.rackEligible(G,0,0,10));assert(!H.rackEligible(G,0,1,10));G.wires[0].cut=true;assert(!H.rackEligible(G,0,0,10));
 pattern(G,0,0,[1,1,2,3,3],[2]);G.det=1;assert.equal(H.claimRack(G,s,0,3,0),null);assert.equal(G.det,0);assert(s.cards[0].done);rejection(G,s,()=>H.claimRack(G,s,0,3,0));
 const saved=JSON.parse(JSON.stringify(s));assert(saved.cards[0].done);rejection(G,s,()=>H.claimRack(G,saved,0,3,0));rejection(G,s,()=>H.claimRack(G,s,-1,6,0));rejection(G,s,()=>H.claimRack(G,s,1,6,0));rejection(G,s,()=>H.claimRack(G,{...s,gid:'旧游戏'},0,6,0));
 const hidden=BB.view(G,1);assert(!H.rackEligible(hidden,0,0,9));assert(!('eligibleRacks' in H.view(s)));assert(!('wires' in H.view(s)));
 for(const flag of ['paused','pending']){G[flag]=true;rejection(G,s,()=>H.claimRack(G,s,0,6,0));G[flag]=flag==='pending'?null:false;}
 G.det=G.detMax;rejection(G,s,()=>H.claimRack(G,s,0,6,0));
}
console.log('✓ 挑战3／6／9／10逐架条件、红黄忽略／重复蓝值／数量边界、一次退格／旧局／重复／暂停／待决定／引爆拒绝不变；公共视图不发送他人满足条件的架');
{
 function completed(G,values){G.wires=[];G.players.forEach(p=>p.stands=p.stands.map(()=>[]));for(const v of values)for(let copy=0;copy<4;copy++){const id=G.wires.length;G.wires.push({id,v,o:0,s:0,cut:true,info:null});G.players[0].stands[0].push(id);}}
 const G=fixture(3),s=state(G,[4,8]);s.cards[1].values=[4,5];completed(G,[4,5,9]);G.det=2;
 assert.deepEqual(H.recordCompletedValue(G,s,4),{error:null,rewards:[]});assert.deepEqual(H.recordCompletedValue(G,s,5),{error:null,rewards:[8]});assert.equal(G.det,1);
 const saved=JSON.parse(JSON.stringify(s)),savedGame=JSON.parse(JSON.stringify(G)),before=JSON.stringify([G,s]);assert.deepEqual(H.recordCompletedValue(G,s,5),{error:null,rewards:[]});assert.equal(JSON.stringify([G,s]),before);assert.deepEqual(H.recordCompletedValue(savedGame,saved,9),{error:null,rewards:[4]});assert.deepEqual(H.recordCompletedValue(G,s,9),{error:null,rewards:[4]});assert.equal(G.det,0);assert.equal(savedGame.det,G.det);assert.deepEqual(saved,s);
 G.det=BB.dialMin(G);const earliest=state(G,[4]);completed(G,[1,5,12]);for(const v of [1,5,12])assert.equal(H.recordCompletedValue(G,earliest,v).error,null);assert.equal(G.det,BB.dialMin(G));assert(earliest.cards[0].done);
 const wrong=state(G,[4,8]);wrong.cards[1].values=[3,8];completed(G,[1,2,3,8,12]);for(const v of [1,2,3,8,12])assert.equal(H.recordCompletedValue(G,wrong,v).error,null);assert(wrong.cards.every(c=>!c.done));
 const unfinished=state(G,[4]);G.wires[0].cut=false;rejection(G,unfinished,()=>H.recordCompletedValue(G,unfinished,1));rejection(G,unfinished,()=>H.recordCompletedValue(G,unfinished,13));
}
console.log('✓ 挑战4／8只看最先完成顺序、目标二值顺序无关、晚完成不补领、重复数字不领奖、保存恢复、一次退格与最早位置边界；连续剪线／特殊行动尚待任务集成');
{
 function source(n){const G=fixture(n);for(const v of [1,2])G.wires.filter(w=>w.v===v).forEach((w,i)=>{w.o=v-1;w.s=i%G.players[v-1].stands.length;w.info=null;});G.players.forEach((p,o)=>p.stands=p.stands.map((_,s)=>G.wires.filter(w=>w.o===o&&w.s===s).sort((a,b)=>a.v-b.v||a.id-b.id).map(w=>w.id)));return G;}
 function solo(G,value){const actor=G.turn,turn=G.turnNo;assert.equal(BB.act(G,actor,{a:'solo',val:value}),null);return {gid:G.gid,actor,turn,kind:'solo',ids:G.lastAct.ids.slice()};}
 for(const n of [2,3,4,5]){
  const G=source(n),s=state(G,[5]),first=solo(G,1);assert.deepEqual(H.recordAction(G,s,first),{error:null,rewards:[]});assert.equal(s.soloStreak,1);assert.equal(G.det,0);const before=JSON.stringify([G,s]);assert(H.recordAction(G,s,first).duplicate);assert.equal(JSON.stringify([G,s]),before);rejection(G,s,()=>H.recordAction(G,s,{...first,actor:1}));
  const second=solo(G,2),savedG=JSON.parse(JSON.stringify(G)),savedState=JSON.parse(JSON.stringify(s));assert.deepEqual(H.recordAction(G,s,second),{error:null,rewards:[5]});assert.deepEqual(H.recordAction(savedG,savedState,second),{error:null,rewards:[5]});assert.deepEqual(savedState,s);assert.equal(savedG.det,G.det);assert.equal(G.det,Math.max(BB.dialMin(G),-1));assert(s.cards[0].done);assert.equal(H.view(s).soloProgress,2);assert(!('cutEvents' in H.view(s)));const done=JSON.stringify([G,s]);assert(H.recordAction(G,s,first).duplicate);assert.equal(JSON.stringify([G,s]),done);
  G.turnNo++;rejection(G,s,()=>H.recordAction(G,s,{...second,turn:second.turn+1}));
 }
 // 实际失败双拆打断已记录的单拆，不通过客户端填报结果。
 const G=source(3),s=state(G,[5]);H.recordAction(G,s,solo(G,1));const actor=G.turn,turn=G.turnNo,own=G.wires.find(w=>w.o===actor&&!w.cut&&Number.isInteger(w.v)),target=G.wires.find(w=>w.o!==actor&&!w.cut&&Number.isInteger(w.v)&&w.v!==own.v);assert.equal(BB.act(G,actor,{a:'dual',w:target.id,val:own.v}),null);assert.equal(BB.act(G,G.pending.to,{a:'resolve',id:G.pending.id,w:target.id}),null);assert.equal(H.recordAction(G,s,{gid:G.gid,actor,turn,kind:'miss',ids:G.lastAct.ids.slice()}).error,null);assert.equal(s.soloStreak,0);assert(!s.cards[0].done);
 const gap=source(3),gs=state(gap,[5]);H.recordAction(gap,gs,solo(gap,1));gap.turnNo++;const next=solo(gap,2);rejection(gap,gs,()=>H.recordAction(gap,gs,next));
 const vip=source(3),vs=state(vip,[5]);vip.equip=[{n:16,id:'wire-cutter',used:false}];vip.wires.filter(w=>w.v===9).forEach(w=>w.cut=true);const chosen=vip.wires.filter(w=>w.o===0&&w.v===1).slice(2).map(w=>w.id),vt=vip.turnNo;assert.equal(BB.act(vip,0,{a:'equip',n:16,ws:chosen,val:1}),null);assert.equal(H.recordAction(vip,vs,{gid:vip.gid,turn:vt,actor:0,kind:'solo',ids:chosen}).error,null);assert.deepEqual(H.recordAction(vip,vs,solo(vip,2)).rewards,[5]);
 const duo=source(3),ds=state(duo,[5]);H.recordAction(duo,ds,solo(duo,1));const dt=duo.turnNo,da=duo.turn,mine=duo.wires.find(w=>w.o===da&&!w.cut&&Number.isInteger(w.v)&&duo.wires.some(t=>t.o!==da&&!t.cut&&t.v===w.v)),mate=duo.wires.find(w=>w.o!==da&&!w.cut&&w.v===mine.v);assert.equal(BB.act(duo,da,{a:'dual',w:mate.id,val:mine.v}),null);assert.equal(BB.act(duo,duo.pending.to,{a:'resolve',id:duo.pending.id,w:mate.id}),null);assert.equal(BB.act(duo,duo.pending.to,{a:'resolve',id:duo.pending.id,w:mine.id}),null);assert.equal(H.recordAction(duo,ds,{gid:duo.gid,turn:dt,actor:da,kind:'duo',ids:duo.lastAct.ids.slice()}).error,null);assert.equal(ds.soloStreak,0);
}
console.log('✓ 挑战5组件2–5人真实相邻回合单拆：团队不同玩家连续两次退格仅一次、实际失败打断、事件去重／保存恢复、旧事件／重复导线拒绝、不公开详细历史；非拆线间隔与批量装备例外未核实而拒绝推断');
