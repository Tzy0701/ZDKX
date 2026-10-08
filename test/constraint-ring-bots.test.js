const assert=require('assert'),BB=require('../js/engine'),Bot=require('../js/bot'),{game,setup}=require('./constraint-ring.fixture');
const results={won:0,lost:0};let actions=0,proposals=0,votes=0;
for(const n of [2,3,4,5]){
 const G=game(n);setup(G);const candidates=G.wires.filter(w=>w.o!==0&&!w.cut&&!w.info&&Number.isInteger(w.v));let alternate;
 for(const a of candidates){for(const b of candidates){if(a.id===b.id||a.v===b.v)continue;const H=JSON.parse(JSON.stringify(G));[H.wires[a.id].v,H.wires[b.id].v]=[b.v,a.v];if(H.players.every(p=>p.stands.every(st=>st.every((id,i)=>i===0||H.wires[st[i-1]].v<=H.wires[id].v)))){alternate=H;break;}}if(alternate)break;}
 assert(alternate,'必须存在库存不变且排序有效的另一隐藏摆法');assert.deepEqual(BB.view(alternate,0),BB.view(G,0));assert.deepEqual(Bot.decide(alternate,0),Bot.decide(G,0),'队长轮转不能读取其他玩家真实线值');
}
console.log('✓ 第61关2–5人队长隐私：交换未标记隐藏值后库存及逐架排序仍有效、本人许可视图完全相同，队长轮转选择不变，不读取队友真值');
for(const n of [2,3,4,5])for(let seed=1;seed<=4;seed++){
 const G=game(n,seed%n,seed*7919);setup(G);let steps=0;
 while(G.phase==='play'&&steps++<400){const pi=G.pending?G.pending.to:G.turn,a=Bot.decide(G,pi);assert(a,'合法当前玩家／确认者不得停止');assert.equal(BB.act(G,pi,a),null,JSON.stringify(a));actions++;if(a.a==='constraint-rotation'&&a.direction)proposals++;if(a.a==='constraint-vote')votes++;}
 assert(['won','lost'].includes(G.phase),'不得超限／重复拒绝循环');results[G.phase]++;
}
console.log('✓ 第61关2–5人16局推理机器人：'+JSON.stringify(results)+'，'+actions+'动作／'+proposals+'次轮转提议／'+votes+'次同意，非法／停止／超限0；只认证合法终局，不认证所有场景或策略充分性');
