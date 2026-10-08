// 第66关掩体组件：原卡地图和移动，更完整的音频任务集成另行验收。
(function(){
 'use strict';
 var directions=['north','east','south','west'];
 var vectors={north:[0,-1],east:[1,0],south:[0,1],west:[-1,0]};
 var maps={
  surface:{stairs:[3,0],hatched:[[1,2],[3,1]],traps:[],walls:[[[1,0],[2,0]],[[1,1],[2,1]],[[3,0],[3,1]]],door:[[[1,2],[2,2]]],laser:[]},
  basement:{stairs:[3,0],hatched:[[0,0],[3,2]],traps:[[1,0],[1,2],[3,1]],walls:[[[3,0],[3,1]]],door:[],laser:[[[1,0],[2,0]],[[1,1],[2,1]],[[1,2],[2,2]]]}
 };
 function same(a,b){return a[0]===b[0]&&a[1]===b[1];}
 function edge(edges,a,b){return edges.some(function(e){return same(e[0],a)&&same(e[1],b)||same(e[1],a)&&same(e[0],b);});}
 function valid(s){return s&&s.version===1&&typeof s.gid==='string'&&maps[s.face]&&Array.isArray(s.position)&&s.position.length===2&&s.position.every(Number.isInteger)&&s.position[0]>=0&&s.position[0]<4&&s.position[1]>=0&&s.position[1]<3;}
 var H={version:1};
 H.map=function(face){return maps[face]?JSON.parse(JSON.stringify(maps[face])):null;};
 H.matches=function(id,value){
  if(!Number.isInteger(value)||value<1||value>12)return false;
  return id==='A'?value%2===0:id==='B'?value%2===1:id==='C'?value<=6:id==='D'?value>=7:id==='E'?value>=4&&value<=9:false;
 };
 H.create=function(gid,rng){
  if(typeof gid!=='string'||!gid||typeof rng!=='function')throw Error('掩体设置需要游戏编号和随机源');
  var cards=['A','B','C','D','E'];for(var i=4;i>0;i--){var draw=rng();if(!Number.isFinite(draw)||draw<0||draw>=1)throw Error('随机源无效');var j=Math.floor(draw*(i+1));var t=cards[i];cards[i]=cards[j];cards[j]=t;}
  var sides={};directions.forEach(function(d,i){sides[d]=cards[i];});
  return {version:1,gid:gid,face:'surface',position:[0,0],sides:sides,special:cards[4],passages:{door:null,laser:null},revision:0,pending:null,events:[]};
 };
 // null表示仍须音频核实；未核实时不能把门或激光当作可通行。
 H.routes=function(s,value){
  if(!valid(s))return [];
  var map=maps[s.face];return directions.filter(function(d){return H.matches(s.sides[d],value);}).map(function(d){
   var v=vectors[d],to=[s.position[0]+v[0],s.position[1]+v[1]],status='open';
   if(to[0]<0||to[0]>=4||to[1]<0||to[1]>=3||edge(map.walls,s.position,to))status='blocked';
   else for(var kind of ['door','laser'])if(edge(map[kind],s.position,to))status=s.passages[kind]===true?'open':s.passages[kind]===false?'blocked':'unverified';
   return {direction:d,to:to,status:status};
  });
 };
 // 仅供引擎内部使用，不提供客户端伪造拆线或音频事件的入口。
 H.begin=function(s,event){
  if(!valid(s)||!event||event.gid!==s.gid||event.revision!==s.revision)return '掩体事件已过期或不属于本局';
  if(s.pending)return '请先完成当前掩体决定';
  if(typeof event.id!=='string'||!event.id||s.events.indexOf(event.id)>=0)return '掩体事件重复或编号无效';
  if(typeof event.success!=='boolean'||!['duo','solo'].includes(event.kind)||![2,4].includes(event.count)||event.kind==='duo'&&event.count!==2||event.kind==='solo'&&!event.success)return '掩体事件不是有效拆线结果';
  if(event.special!==undefined&&typeof event.special!=='boolean')return '特殊行动声明无效';
  if(!(Number.isInteger(event.value)&&event.value>=1&&event.value<=12||event.value==='Y'))return '拆线宣告值无效';
  var striped=maps[s.face].hatched.some(function(p){return same(p,s.position);});
  if(event.special&&(!striped||!H.matches(s.special,event.value)))return '当前位置或宣告不满足特殊行动';
  s.events.push(event.id);s.revision++;
  if(event.special){
   if(event.success)s.pending={id:event.id,gid:s.gid,value:event.value,type:'audio-special',remaining:0};
   return {error:null,special:event.success,held:true,steps:0};
  }
  var steps=event.kind==='solo'&&event.count===4?2:1;
  s.pending={id:event.id,gid:s.gid,value:event.value,type:'movement',remaining:steps};
  return {error:null,special:false,held:false,steps:steps};
 };
 H.move=function(s,command){
  if(!valid(s)||!command||command.gid!==s.gid||command.revision!==s.revision||!s.pending||command.id!==s.pending.id)return {error:'掩体决定已过期或不属于本局'};
  if(s.pending.type!=='movement')return {error:'特殊行动需要已核实的音频指令'};
  var routes=H.routes(s,s.pending.value),open=routes.filter(function(r){return r.status==='open';}),chosen=open.find(function(r){return r.direction===command.direction;});
  if(command.direction!==null&&!chosen)return {error:'该方向不满足限制或被阻挡'};
  if(command.direction===null&&(open.length||routes.some(function(r){return r.status==='unverified';})))return {error:open.length?'仍有可移动方向，不能停留':'门或激光的音频状态尚未核实'};
  var switched=false;if(chosen){s.position=chosen.to.slice();if(same(s.position,maps[s.face].stairs)){s.face=s.face==='surface'?'basement':'surface';s.position=maps[s.face].stairs.slice();switched=true;}}
  var trap=!!chosen&&maps[s.face].traps.some(function(p){return same(p,s.position);});
  s.pending.remaining--;s.revision++;if(!s.pending.remaining)s.pending=null;
  return {error:null,moved:!!chosen,switched:switched,detonatorAdvance:trap?1:0,face:s.face,position:s.position.slice(),remaining:s.pending?s.pending.remaining:0};
 };
 H.view=function(s){return JSON.parse(JSON.stringify(s));};
 if(typeof module!=='undefined'&&module.exports)module.exports=H;else window.BB_BUNKER=H;
})();
