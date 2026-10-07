// 第59关真实来源开局的全信息参考路径；不提供给推理机器人，不认证全部规则例外。
const assert=require('assert'),BB=require('../js/engine'),{game,setup}=require('./robot-route.fixture');
let actions=0,reversals=0,orientations=0,reds=0;
function act(G,pi,a){assert.equal(BB.act(G,pi,a),null,JSON.stringify(a));actions++;}
function directionForNextBlue(G){const route=BB.robotRoute(G);let owner=null;for(let offset=1;offset<=G.np;offset++){const p=(G.turn+offset)%G.np;if(G.wires.some(w=>w.o===p&&!w.cut&&Number.isInteger(w.v))){owner=p;break;}}if(owner===null)return route.direction;const held=new Set(G.wires.filter(w=>w.o===owner&&!w.cut&&Number.isInteger(w.v)).map(w=>w.v));const left=route.row.filter((v,i)=>i<=route.position&&held.has(v)).length,right=route.row.filter((v,i)=>i>=route.position&&held.has(v)).length;return right>=left?1:-1;}
const failures=[],seeds=Number(process.env.BB_ROUTE_SEEDS||25);
for(const n of [2,3,4,5])for(let seed=1;seed<=seeds;seed++){
 const base=game(n,seed%n,seed);setup(base);const fingerprint=JSON.stringify(base),G=JSON.parse(JSON.stringify(base));let steps=0;
 while(G.phase==='play'&&steps++<250){
  if(G.pending){const p=G.pending;if(p.type==='robot-direction'){act(G,p.to,{a:'robot-direction',id:p.id,direction:directionForNextBlue(G)});orientations++;}else{assert.equal(p.type,'cut');const V=BB.view(G,p.to);act(G,p.to,{a:'resolve',id:p.id,w:p.step==='target'?p.ids[0]:V.pending.choices.at(-1)});}continue;}
  const owner=G.turn,own=G.wires.filter(w=>w.o===owner&&!w.cut);assert(own.length);
  if(own.every(w=>BB.kindOf(w)==='r')){act(G,owner,{a:'red'});reds++;continue;}
  const route=BB.robotRoute(G);if(route.step==='move'){const values=BB.robotRouteValues(G,owner);if(!values.length){act(G,owner,{a:'robot-reverse',id:route.decisionId});reversals++;continue;}values.sort((a,b)=>own.filter(w=>w.v===b).length-own.filter(w=>w.v===a).length||a-b);act(G,owner,{a:'robot-move',id:route.decisionId,val:values[0]});continue;}
  assert.equal(route.step,'cut');const value=route.row[route.position];if(BB.soloOk(G,owner,value))act(G,owner,{a:'solo',val:value});else{const target=G.wires.find(w=>w.o!==owner&&!w.cut&&w.v===value);assert(target,'四副本配对必须存在');act(G,owner,{a:'dual',val:value,w:target.id});}
 }
 if(G.phase!=='won')failures.push({n,seed,phase:G.phase,det:G.det,step:BB.robotRoute(G).step});else{assert(G.wires.every(w=>w.cut));assert.equal(BB.robotRoute(G).completed.length,12);assert(!G.pending);}
 assert.equal(JSON.stringify(base),fingerprint,'不能重新发牌或修改原始开局寻找解');
}
console.log(JSON.stringify({games:seeds*4,actions,orientations,reversals,reds,failures}));if(failures.length)process.exitCode=1;
