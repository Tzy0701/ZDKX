const assert=require('assert'),BB=require('../js/engine'),M=require('../js/missions'),F=require('./yellow-before-x.fixture');
function act(G,p,a){assert.equal(BB.act(G,p,a),null,JSON.stringify(a));}
function reject(G,p,a){const before=JSON.stringify(G);assert(BB.act(G,p,a));assert.equal(JSON.stringify(G),before);}
for(let n=2;n<=5;n++)for(let cap=0;cap<n;cap++)for(let seed=1;seed<=12;seed++){
 const G=F.game(n,cap,seed);assert.equal(G.wires.length,n===2?55:54);assert.equal(G.wires.filter(w=>BB.kindOf(w)==='b').length,48);assert.equal(G.rmark.n,n===2?3:2);assert.equal(G.rmark.cand.length,3);assert.equal(G.ymark.n,4);assert(!G.equip.some(e=>e.n===2));assert(!G.equipmentReserve.includes(2));const lengths=[];
 for(let p=0;p<n;p++){const owned=G.wires.filter(w=>w.o===p),xs=owned.filter(w=>BB.isX(G,w));assert.equal(xs.length,1);assert.equal(BB.kindOf(xs[0]),'b');assert.equal(xs[0].s,0);assert.equal(G.players[p].stands[0].at(-1),xs[0].id);assert(!BB.setupInfoAllowed(G,xs[0]));assert(!BB.equipmentWireAllowed(G,p,xs[0]));G.players[p].stands.forEach(st=>{const normal=st.map(id=>G.wires[id]).filter(w=>!w.x);lengths.push(normal.length);assert.deepEqual(normal.map(w=>w.v),normal.map(w=>w.v).sort((a,b)=>a-b));});}
 assert(Math.max(...lengths)-Math.min(...lengths)<=1);F.setup(G);assert(BB.xLocked(G));for(let p=0;p<n;p++){const V=BB.view(G,p);assert(V.official.yellowBeforeX.locked);assert.equal(V.official.yellowBeforeX.cut,0);assert.equal(V.players.flatMap(p=>p.stands.flat()).filter(w=>w.x).length,n);assert(V.players.filter((_,i)=>i!==p).flatMap(p=>p.stands.flat()).every(w=>w.v===null));}
}
console.log('✓ 第35关2–5人全部队长12种子：蓝48、已知黄4、红2候选3／双人红3，每人先抽唯一蓝X放第一架最右、普通区独立排序和剩余正常均分，双架整手一X；标记和全部装备忽略X、无共享对讲机，视图不泄露身份');
for(let n=2;n<=5;n++){
 const {G,x,matching,own,target}=F.lastYellow(n);assert.equal(BB.cutCount(G,'Y'),2);assert(BB.xLocked(G));reject(G,0,{a:'dual',w:matching.id,val:x.v});assert(!BB.soloOk(G,0,x.v));
 act(G,0,{a:'dual',w:target.id,val:'Y'});const before=JSON.parse(JSON.stringify(G));assert.equal(G.pending.step,'target');act(G,1,{a:'resolve',id:G.pending.id,w:target.id});act(before,1,{a:'resolve',id:before.pending.id,w:target.id});assert.deepEqual(before,G);assert(BB.xLocked(G));assert.equal(BB.cutCount(G,'Y'),2);assert.equal(BB.view(G,0).official.yellowBeforeX.cut,2);
 act(G,0,{a:'resolve',id:G.pending.id,w:own.id});assert(!BB.xLocked(G));assert.equal(BB.cutCount(G,'Y'),4);assert.equal(BB.view(G,0).official.yellowBeforeX.cut,4);
 G.turn=0;act(G,0,{a:'dual',w:matching.id,val:x.v});act(G,1,{a:'resolve',id:G.pending.id,w:matching.id});assert(BB.view(G,0).pending.choices.includes(x.id));act(G,0,{a:'resolve',id:G.pending.id,w:x.id});assert.equal(G.phase,'won');assert.equal(G.det,0);assert(G.wires[x.id].cut&&G.wires[matching.id].cut);assert(!BB.equipmentWireAllowed(G,0,x));
}
console.log('✓ 四黄完成前只有X值的双拆拒绝不变；最后黄对按目标／本人两阶段选择，目标公开不提前解锁，保存中途结果一致；两线完整剪后立即解锁，蓝X普通双拆可选自己的真实副本直至胜局，装备仍不能影响X');
{
 const {G,x,matching}=F.lastYellow(3);G.wires.filter(w=>BB.kindOf(w)==='y').forEach(w=>w.cut=true);matching.o=0;matching.s=0;F.resort(G);assert(BB.soloOk(G,0,x.v));act(G,0,{a:'solo',val:x.v});assert.equal(G.phase,'won');
 const H=F.game(3);F.setup(H);const peerX=H.wires.find(w=>w.o===1&&w.x);reject(H,0,{a:'dual',w:peerX.id,val:H.wires.find(w=>w.o===0&&!w.x&&Number.isInteger(w.v)).v});const ownX=H.wires.find(w=>w.o===0&&w.x);H.players[0].character={id:'walkie-talkies',used:false};H.players[0].dd=0;reject(H,0,{a:'character',w:ownX.id,p:1});reject(H,0,{a:'equip',n:2,w:ownX.id,p:1});
 for(let n=2;n<=5;n++){const legacy=BB.createGame(M.get('campaign',35),Array.from({length:n},(_,i)=>({pid:'旧'+i,name:'旧玩家'})));assert(!BB.yellowBeforeX(legacy));assert(!BB.xLocked(legacy));}
}
console.log('✓ 解锁后最后一对含本人X可正常单拆；锁定队友X目标／个人或共享对讲机拒绝不变，旧版改编第35关保留原玩法；双架X放架选择及无可剪线例外尚待核实');
