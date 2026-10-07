// 掩体地图组件验收，不代表第66关音频或整关已通过。
const assert=require('assert'),H=require('../js/bunker'),source=require('../docs/official-mechanisms.json').bunker66;
const clone=x=>JSON.parse(JSON.stringify(x));
function rng(seed){return()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);}
function state(){const s=H.create('掩体验证',rng(1));s.sides={north:'A',east:'D',south:'B',west:'C'};s.special='E';return s;}
function begin(s,value=10,extra={}){return H.begin(s,{gid:s.gid,revision:s.revision,id:'拆线-'+s.revision,value,success:true,kind:'duo',count:2,...extra});}
function move(s,d){return H.move(s,{gid:s.gid,revision:s.revision,id:s.pending.id,direction:d});}
function reject(s,fn){const before=JSON.stringify(s),out=fn();assert(typeof out==='string'||out.error);assert.equal(JSON.stringify(s),before);}
for(let seed=1;seed<=100;seed++){
 const s=H.create('局'+seed,rng(seed));assert.deepEqual(s.position,[0,0]);assert.equal(s.face,'surface');assert.deepEqual(Object.values(s.sides).concat(s.special).sort(),['A','B','C','D','E']);assert.equal(s.pending,null);assert.deepEqual(s,clone(s));
}
for(const bad of [NaN,Infinity,-0.1,1])assert.throws(()=>H.create('无效随机',()=>bad),/随机源无效/);
for(const face of ['surface','basement']){
 const m=H.map(face),gold=source[face];for(const key of ['stairs','hatched','walls'])assert.deepEqual(m[key],gold[key]);assert.deepEqual(m.traps,gold.traps||[]);
 assert.deepEqual(m.door,gold.door?[gold.door]:[]);assert.deepEqual(m.laser,gold.laserEdges||[]);
 m.stairs[0]=99;assert.deepEqual(H.map(face).stairs,[3,0]);
}
for(let v=1;v<=12;v++){
 assert.equal(H.matches('A',v),v%2===0);assert.equal(H.matches('B',v),v%2===1);assert.equal(H.matches('C',v),v<=6);assert.equal(H.matches('D',v),v>=7);assert.equal(H.matches('E',v),v>=4&&v<=9);
}
for(const v of ['Y','R',null,0,13,4.1])for(const id of ['A','B','C','D','E'])assert.equal(H.matches(id,v),false);
console.log('✓ 掩体原卡双面4×3地图、墙／门／激光／条纹／陷阱／楼梯位置与来源一致，100次A–E唯一随机分配，E为4–9而非黄色');
{
 const s=state();assert.deepEqual(begin(s),{error:null,special:false,held:false,steps:1});
 const saved=clone(s);reject(s,()=>move(s,'north'));reject(s,()=>move(s,null));
 const a=move(s,'east'),b=move(saved,'east');assert.deepEqual(a,b);assert.deepEqual(s,saved);assert.deepEqual(s.position,[1,0]);assert.equal(s.pending,null);
 reject(s,()=>H.begin(s,{gid:s.gid,revision:s.revision,id:'拆线-0',value:10,success:true,kind:'duo',count:2}));
 const t=state();assert.equal(begin(t,3,{success:false}).error,null);assert.equal(move(t,'south').moved,true);assert.deepEqual(t.position,[0,1]);
 const y=state();begin(y,'Y');assert.equal(move(y,null).moved,false);assert.equal(y.pending,null);
}
{
 const s=state();s.position=[1,1];s.sides={north:'B',east:'A',south:'D',west:'C'};
 begin(s,2);assert.equal(H.routes(s,2).find(r=>r.direction==='east').status,'blocked');assert.equal(move(s,'west').error,null);
 const t=state();t.position=[1,2];t.sides={north:'B',east:'A',south:'D',west:'C'};begin(t,10);
 assert.equal(H.routes(t,10).find(r=>r.direction==='east').status,'unverified');reject(t,()=>move(t,'east'));reject(t,()=>move(t,null));
 // 已核实控制状态的内部夹具；不提供客户端开门入口。
 t.passages.door=false;assert.equal(move(t,null).moved,false);
 const u=state();u.face='basement';u.position=[1,1];u.sides={north:'B',east:'A',south:'D',west:'C'};begin(u,10);reject(u,()=>move(u,null));u.passages.laser=true;assert.equal(move(u,'east').moved,true);
}
console.log('✓ 成功及安全失败都移动、黄色无A–E方向、不可越墙或越界，有合法方向必须移动，未核实门／激光不允许伪造通行或停留');
{
 const s=state();s.position=[2,0];begin(s,10);const r=move(s,'east');assert(r.switched);assert.equal(s.face,'basement');assert.deepEqual(s.position,[3,0]);
 // 到楼梯只翻一次，不递归翻回；维持向北，不旋转地图。
 begin(s,2);assert.equal(move(s,'west').error,null);assert.deepEqual(s.position,[2,0]);
 const t=state();t.face='basement';t.position=[0,0];t.sides={north:'B',east:'A',south:'D',west:'C'};begin(t,2,{kind:'solo',count:4});const first=move(t,'east');assert.equal(first.detonatorAdvance,1);assert.equal(first.remaining,1);
 const saved=clone(t),stale={gid:t.gid,revision:t.revision-1,id:t.pending.id,direction:'north'};reject(t,()=>H.move(t,stale));
 assert.deepEqual(move(t,'west'),move(saved,'west'));assert.equal(t.pending,null);assert.deepEqual(t.position,[0,0]);
}
console.log('✓ 楼梯只翻一次且保留北向，落入陷阱报告一次罚格，四根单拆分两次方向决定，保存中途恢复及旧回复拒绝不变');
{
 const s=state();s.position=[1,2];assert.equal(begin(s,5,{special:true}).special,true);assert.equal(s.pending.type,'audio-special');assert.deepEqual(s.position,[1,2]);reject(s,()=>move(s,null));reject(s,()=>begin(s));
 const t=state();t.position=[1,2];assert.equal(begin(t,5,{special:true,success:false}).held,true);assert.equal(t.pending,null);assert.deepEqual(t.position,[1,2]);
 const u=state();reject(u,()=>begin(u,5,{special:true}));u.position=[1,2];reject(u,()=>begin(u,10,{special:true}));reject(u,()=>begin(u,5,{kind:'solo',success:false,count:4}));
 reject(u,()=>begin(u,5,{special:'是'}));reject(u,()=>H.begin(u,{gid:'旧局',revision:0,id:'错',value:5,kind:'duo',success:true,count:2}));
 const v=H.view(s);v.position[0]=99;assert.equal(s.position[0],1);
}
console.log('✓ 条纹格特殊行动成功等待音频、失败不行动不移动，非条纹／不符限制／伪造局号／重复事件拒绝不变；未启用任务、音频、黄线开放或客户端控制入口');
