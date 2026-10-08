// 从实际来源发牌经合法参考行动到达许可阶段，供隔离测试使用。
const assert=require('assert'),BB=require('../js/engine'),M=require('../js/missions');
function rng(s){return()=>((s=(Math.imul(s,1664525)+1013904223)>>>0)/4294967296);}
module.exports=function(seats){
 for(let seed=1;seed<100;seed++){
  const G=BB.createGame(M.get('official-development',46),seats,{captain:0,rng:rng(seed*104729)});if(new Set(G.wires.filter(w=>w.v===7).map(w=>w.o)).size<2)continue;
  for(let step=0;step<500;step++){
   if(G.phase==='play'&&!G.pending&&G.officialState.license.required)return G;
   const pi=G.pending?G.pending.to:G.phase==='setup'?BB.setupActor(G):G.turn;let a;
   if(G.phase==='setup')a={a:'info',w:G.wires.find(w=>w.o===pi&&BB.setupInfoAllowed(G,w)).id};
   else if(G.pending){const pd=G.pending;a={a:'resolve',id:pd.id,w:pd.step==='own'?BB.view(G,pi).pending.choices.at(-1):pd.ids.find(id=>pd.vals.some(value=>BB.matches(G.wires[id],value)))};}
   else{const own=G.wires.filter(w=>w.o===pi&&!w.cut);for(const val of [...new Set(own.map(w=>BB.annOf(w)))]){if(val===7)continue;if(BB.soloOk(G,pi,val)){a={a:'solo',val};break;}const target=G.wires.find(w=>w.o!==pi&&!w.cut&&BB.matches(w,val));if(target){a={a:'dual',val,w:target.id};break;}}}
   assert(a,'许可夹具缺少合法参考行动');assert.equal(BB.act(G,pi,a),null);
  }
 }
 throw new Error('未找到来源许可阶段');
};
