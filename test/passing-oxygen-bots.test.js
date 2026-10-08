const assert=require('assert'),BB=require('../js/engine'),Bot=require('../js/bot'),{game,setup,give,budget}=require('./passing-oxygen.fixture');
for(const n of [2,3,4,5]){
 const G=game(n);setup(G);give(G,10,1);G.wires.filter(w=>w.o===1&&w.v!==10).forEach(w=>{w.cut=true;w.info=null;});budget(G,1,9);G.wires.filter(w=>w.v===9).forEach(w=>w.cut=true);G.equip=[{n:16,id:'wire-cutter',used:false}];const a=Bot.decide(G,1);assert.equal(a.a,'passing-oxygen-skip');assert.equal(BB.act(G,1,a),null);assert.equal(G.equip[0].used,false,'不足10枚时不能先用通行证非法拆蓝10');
 const H=game(n);setup(H);give(H,10,1);H.wires.filter(w=>w.o===1&&w.v!==10).forEach(w=>{w.cut=true;w.info=null;});budget(H,1,9);H.wires.filter(w=>w.v===11).slice(0,2).forEach(w=>w.cut=true);H.equip=[{n:11,id:'coffee-mug',used:false}];const coffee=Bot.decide(H,1);assert.equal(coffee.a,'equip');assert.equal(coffee.n,11);assert.equal(BB.act(H,1,coffee),null);assert.equal(H.det,0);assert.equal(BB.passingOxygen(H).holder,H.turn);
}
console.log('✓ 第63关2–5人缺氧后段：机器人不非法用通行证剪付不起的值，已解锁咖啡杯可用时优先合法跳过且不罚格；非整局证明');
const results={won:0,lost:0};let actions=0,skips=0;
for(const n of [2,3,4,5])for(let seed=1;seed<=4;seed++){
 const G=game(n,seed%n,seed*7919);setup(G);let steps=0;while(G.phase==='play'&&steps++<350){const pi=G.pending?G.pending.to:G.turn,a=Bot.decide(G,pi);assert(a,'当前玩家不能无故停止');assert.equal(BB.act(G,pi,a),null,JSON.stringify(a));actions++;if(a.a==='passing-oxygen-skip')skips++;const s=BB.passingOxygen(G);assert.equal(s.available+s.reserve,s.total);assert(s.available>=0&&s.reserve>=0);}
 assert(['won','lost'].includes(G.phase),'不能循环拒绝／超限');results[G.phase]++;
}
console.log('✓ 第63关2–5人16局推理机器人：'+JSON.stringify(results)+'，'+actions+'动作／'+skips+'次缺氧跳过，非法／停止／超限0且氧气守恒；不认证策略充分或所有任务例外');
