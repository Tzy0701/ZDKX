const assert=require('assert'),BB=require('../js/engine'),Bot=require('../js/bot'),{game,setup}=require('./double-outward.fixture');
{
 let G,pair;for(let seed=1;seed<100;seed++){const candidate=game(3,0,seed);setup(candidate);const ids=candidate.officialState.outwardGroups[0];if(candidate.wires[ids[0]].v>=4&&Number.isInteger(candidate.wires[ids[0]].v)&&candidate.wires[ids[0]].v<candidate.wires[ids[1]].v){G=candidate;pair=ids;break;}}assert(G);const bound=G.wires[pair[0]].v;G.wires[pair[0]].cut=true;const counterpart=G.wires.find(w=>w.id!==pair[0]&&w.v===bound);counterpart.cut=true;counterpart.info=null;const probability=Bot.infer(G,0,8000)[pair[1]];assert(probability);for(let v=1;v<bound;v++)assert.equal(probability.P[v]||0,0,'已公开左端值是右端的下界');assert(Object.values(probability.P).reduce((a,b)=>a+b,0)>0);
}
for(const n of [2,3,4,5]){
 const G=game(n);setup(G);const unknown=G.wires.filter(w=>w.o===0&&BB.isOutward(G,w)&&Number.isInteger(w.v)),hidden=G.wires.filter(w=>w.o!==0&&!w.cut&&!w.info&&!BB.isOutward(G,w)&&Number.isInteger(w.v));let alternate;
 for(const a of unknown){for(const b of hidden){if(a.v===b.v)continue;const H=JSON.parse(JSON.stringify(G));[H.wires[a.id].v,H.wires[b.id].v]=[b.v,a.v];if(H.officialState.outwardGroups.every(ids=>H.wires[ids[0]].v<=H.wires[ids[1]].v)&&H.players.every(p=>p.stands.every(st=>{const normal=st.filter(id=>!BB.isOutward(H,H.wires[id]));return normal.every((id,i)=>i===0||H.wires[normal[i-1]].v<=H.wires[id].v);}))) {alternate=H;break;}}if(alternate)break;}
 assert(alternate);assert.deepEqual(BB.view(alternate,0),BB.view(G,0));function inference(state){const previous=Math.random;let seed=12345;try{Math.random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);return Bot.infer(state,0,6000);}finally{Math.random=previous;}}assert.deepEqual(inference(alternate),inference(G),'同一许可视图不能用隐藏真值改变概率');
}
console.log('✓ 第64关双端推理：公开左端剪后给右端下界，样本不越界且有效；2–5人不同合法隐藏摆法库存／普通区／双端顺序有效、本人视图相同，固定采样概率完全相同');
{
 let G,owner,pair,value;for(let seed=1;seed<500;seed++){const candidate=game(2,0,seed);setup(candidate);for(let p=0;p<2;p++){const ids=candidate.officialState.outwardGroups[p],v=candidate.wires[ids[0]].v;if(Number.isInteger(v)&&candidate.wires[ids[1]].v===v){G=candidate;owner=p;pair=ids;value=v;break;}}if(G)break;}assert(G);G.wires.filter(w=>!pair.includes(w.id)).forEach(w=>{w.cut=true;w.info=null;});G.turn=owner;const a=Bot.decide(G,owner);assert.equal(a.a,'outward-solo');assert.equal(a.val,value);assert.deepEqual(a.outs,pair);assert.equal(BB.act(G,owner,a),null);assert.equal(G.phase,'won');
}
console.log('✓ 第64关真实同值双端最后一对：机器人只用公开库存／许可视图选择两朝外盲单拆，实际赢局，不因没有已知手牌停住；后段非整局证明');
const results={won:0,lost:0};let actions=0;
for(const n of [2,3,4,5])for(let seed=1;seed<=4;seed++){
 const G=game(n,seed%n,seed*7919);setup(G);let steps=0;while(G.phase==='play'&&steps++<350){const pi=G.pending?G.pending.to:G.turn,a=Bot.decide(G,pi);assert(a,'当前玩家不得停止');assert.equal(BB.act(G,pi,a),null,JSON.stringify(a));actions++;}assert(['won','lost'].includes(G.phase),'不得循环拒绝或超限');results[G.phase]++;
}
console.log('✓ 第64关2–5人16局推理机器人：'+JSON.stringify(results)+'，'+actions+'动作，非法／停止／超限0；计入双端相对大小样本约束和本人回应概率，不认证策略充分或全部任务例外');
