// 错误信息和正常信息使用同一份实体标记库存。
const assert=require('assert'),BB=require('../js/engine'),M=require('../js/missions'),C=require('../js/campaign-rules');
function rng(s){return()=>((s=(Math.imul(s,1664525)+1013904223)>>>0)/4294967296);}
for(const n of [2,3,4,5]){
 const G=BB.createGame(M.get('campaign',17),Array.from({length:n},(_,i)=>({pid:'p'+i,name:'库存玩家'+i})),{rng:rng(n*104729)}),who=G.officialState.liar;
 for(let i=0;i<2;i++){const w=G.wires.find(w=>w.o===who&&!w.info&&Number.isInteger(w.v)&&w.v!==1);assert.equal(BB.act(G,who,{a:'info',id:G.officialState.fakeDecision,w:w.id,val:1}),null);assert.equal(C.availableInfoTokens(G,false).filter(t=>t.value===1).length,1-i);}
 const before=JSON.stringify(G),saved=JSON.parse(JSON.stringify(G));assert.deepEqual(C.availableInfoTokens(saved,true),C.availableInfoTokens(G,true));assert.equal(JSON.stringify(G),before);const marked=G.wires.filter(w=>w.info?.t==='not'&&w.info.v==='1');marked[0].cut=true;assert.equal(C.availableInfoTokens(G,false).filter(t=>t.value===1).length,1);marked[1].cut=true;assert.equal(C.availableInfoTokens(G,false).filter(t=>t.value===1).length,2);
 const wires=G.wires.filter(w=>!w.cut).slice(0,4);G.wires.forEach(w=>w.info=null);
 wires[0].info={t:'not',v:'3',token:'info-3-0'};wires[1].info={t:'v',v:3,token:'info-3-1'};assert.equal(C.availableInfoTokens(G,false).filter(t=>t.value===3).length,0);
 wires[2].info={t:'not',v:'Y'};assert.equal(C.availableInfoTokens(G,true).filter(t=>t.value==='Y').length,1);
 wires[3].info={t:'not',v:'4/5',tokens:['info-4-0','info-5-1']};for(const value of [4,5])assert.equal(C.availableInfoTokens(G,false).filter(t=>t.value===value).length,1);
}
console.log('✓ 2–5人真实说谎者两枚≠1占用数字1两份库存，保存查询不变、已剪回收、真假混用与明确身份、多值／黄色否定标记库存正确');
