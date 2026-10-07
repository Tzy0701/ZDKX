// 第五盒挑战卡组件。任务集成与有歧义的连续剪线规则分别验收。
(function(){
 'use strict';
 var descriptions=[
  '主动盲剪队友的一根线；剪到红线引爆，其余视为已剪。',
  '连续成功剪四根偶值线。',
  '一架剩余未剪线只形成两根一组，组间有已剪线。',
  '最先完成的三个蓝值之和为18。',
  '连续成功两次单人拆线。',
  '一架至少有五根孤立的未剪线，相邻位置均已剪或位于边缘。',
  '连续成功剪三个相邻数值，严格升序或降序。',
  '最先完成的两个蓝值是此卡抽到的两个数字。',
  '一架剩余蓝线值互不相同且少于六根，忽略红黄线。',
  '一架至少七根已剪，最左和最右导线仍未剪。'
 ];
 var H={version:1,cards:descriptions.map(function(desc,i){return {id:i+1,name:'挑战 '+(i+1),desc:desc};})};
 function shuffled(values,rng){var a=values.slice();for(var i=a.length-1;i>0;i--){var j=Math.floor(rng()*(i+1));var t=a[i];a[i]=a[j];a[j]=t;}return a;}
 H.create=function(gid,np,rng){
  if(typeof gid!=='string'||!Number.isInteger(np)||np<2||np>5||typeof rng!=='function')throw Error('挑战设置需要游戏编号、2–5人和随机源');
  return {version:H.version,gid:gid,cards:shuffled(H.cards,rng).slice(0,np).map(function(card){var c={id:card.id,done:false};if(c.id===8)c.values=shuffled(Array.from({length:12},function(_,i){return i+1;}),rng).slice(0,2);return c;}),completedValues:[]};
 };
 function card(state,id){return state.cards.find(function(c){return c.id===id;});}
 function identity(G,state){return state&&state.version===H.version&&state.gid===G.gid&&Array.isArray(state.cards);}
 function blue(w){return Number.isInteger(w.v)&&w.v>=1&&w.v<=12&&(!w.kind||w.kind==='b');}
 function rack(G,owner,index){var p=G.players[owner];if(!p||!Number.isInteger(index)||index<0||!p.stands[index])return null;return p.stands[index].map(function(w){return typeof w==='number'?G.wires[w]:w;});}
 H.rackEligible=function(G,owner,index,id){
  var wires=rack(G,owner,index);if(!wires||!wires.length)return false;
  var runs=[],current=0;wires.forEach(function(w){if(w.cut){if(current)runs.push(current);current=0;}else current++;});if(current)runs.push(current);
  if(id===3)return runs.length>0&&runs.every(function(n){return n===2;});
  if(id===6)return runs.filter(function(n){return n===1;}).length>=5;
  if(id===9){var left=wires.filter(function(w){return !w.cut&&blue(w);});return left.length>0&&left.length<6&&new Set(left.map(function(w){return w.v;})).size===left.length&&wires.every(function(w){return w.cut||w.v!==null;});}
  if(id===10)return !wires[0].cut&&!wires[wires.length-1].cut&&wires.filter(function(w){return w.cut;}).length>=7;
  return false;
 };
 function complete(G,state,c){if(c.done)return false;c.done=true;G.det=Math.max(Number.isFinite(G.detMin)?G.detMin:0,G.det-1);return true;}
 H.claimRack=function(G,state,owner,id,index){
  if(!identity(G,state)||G.phase!=='play'||G.paused||G.pending||G.det>=G.detMax)return '现在不能领取挑战奖励';
  if(!Number.isInteger(owner)||owner<0||!G.players[owner])return '玩家身份无效';
  var c=card(state,id);if(!c||c.done||[3,6,9,10].indexOf(id)<0)return '这张挑战不在场、已完成或不是线架挑战';
  if(!H.rackEligible(G,owner,index,id))return '自己的这架尚未满足挑战条件';
  complete(G,state,c);return null;
 };
 H.recordCompletedValue=function(G,state,value){
  if(!identity(G,state)||G.phase!=='play'||G.paused||G.det>=G.detMax||!Number.isInteger(value)||value<1||value>12)return {error:'完成数字事件无效'};
  if(state.completedValues.indexOf(value)>=0)return {error:null,rewards:[]};
  var matching=G.wires.filter(function(w){return blue(w)&&w.v===value;});if(matching.length!==4||matching.some(function(w){return !w.cut;}))return {error:'该数字的四根蓝线尚未全部剪断'};
  state.completedValues.push(value);var order=state.completedValues,rewards=[];
  var sum=card(state,4);if(sum&&!sum.done&&order.length===3&&order.reduce(function(a,b){return a+b;},0)===18&&complete(G,state,sum))rewards.push(4);
  var pair=card(state,8);if(pair&&!pair.done&&order.length===2&&pair.values.every(function(v){return order.indexOf(v)>=0;})&&complete(G,state,pair))rewards.push(8);
  return {error:null,rewards:rewards};
 };
 function announcement(w){if(w.kind==='r'||Math.round(w.v*10)%10===5)return 'R';return Math.round(w.v*10)%10===1?'Y':w.v;}
 H.recordAction=function(G,state,event){
  if(!identity(G,state)||G.phase!=='play'||G.paused||G.pending||G.det>=G.detMax||!event||event.gid!==G.gid||!Number.isInteger(event.turn)||event.turn<1||!Number.isInteger(event.actor)||!G.players[event.actor]||['solo','duo','miss'].indexOf(event.kind)<0||!Array.isArray(event.ids)||!event.ids.length||event.ids.some(function(id){return !Number.isInteger(id)||!G.wires[id];})||new Set(event.ids).size!==event.ids.length)return {error:'拆线事件身份／状态无效'};
  var ids=event.ids.slice().sort(function(a,b){return a-b;}),signature=JSON.stringify([event.actor,event.kind,ids]),events=state.cutEvents||[],prior=events.find(function(e){return e.turn===event.turn;});
  if(prior)return prior.signature===signature?{error:null,rewards:[],duplicate:true}:{error:'旧回合事件不一致'};
  if(events.length&&event.turn!==events[events.length-1].turn+1)return {error:'存在未核实的非拆线间隔，当前不推断连续性'};
  if(event.turn!==G.turnNo&&event.turn+1!==G.turnNo)return {error:'拆线事件回合已过期'};
  var last=G.lastAct;if(!last||last.t!==(event.kind==='miss'?'miss':'hit')||JSON.stringify(last.ids.slice().sort(function(a,b){return a-b;}))!==JSON.stringify(ids))return {error:'事件不对应当前真实拆线结果'};
  var declaration=G.declaration;if(declaration&&['disintegrator','grapple'].indexOf(declaration.type)>=0&&JSON.stringify(declaration.ids.slice().sort(function(a,b){return a-b;}))===JSON.stringify(ids))return {error:'批量／移动装备不冒充正常拆线'};
  if(event.kind!=='solo'&&declaration&&declaration.type==='cut'&&declaration.from!==event.actor)return {error:'事件行动者与公开宣告不符'};
  if(events.some(function(e){return e.kind!=='miss'&&e.ids.some(function(id){return ids.indexOf(id)>=0;});}))return {error:'已经记录的已剪导线不能再次完成挑战'};
  var wires=ids.map(function(id){return G.wires[id];});
  if(event.kind!=='miss'&&(wires.some(function(w){return !w.cut||announcement(w)==='R';})||!wires.every(function(w){return announcement(w)===announcement(wires[0]);})))return {error:'成功事件需要真实已剪同值非红线'};
  if(event.kind==='solo'&&([2,4].indexOf(ids.length)<0||wires.some(function(w){return w.o!==event.actor;})))return {error:'单拆需要本人两根或四根同值线'};
  if(event.kind==='duo'&&(ids.length!==2||wires.filter(function(w){return w.o===event.actor;}).length!==1))return {error:'双拆需要本人及队友各一根'};
  state.cutEvents=events;events.push({turn:event.turn,signature:signature,kind:event.kind,ids:ids});state.soloStreak=event.kind==='solo'?Math.min(2,(state.soloStreak||0)+1):0;
  var c=card(state,5),rewards=[];if(c&&!c.done&&state.soloStreak===2&&complete(G,state,c))rewards.push(5);
  return {error:null,rewards:rewards};
 };
 H.view=function(state){var out={version:state.version,cards:state.cards.map(function(c){var def=H.cards[c.id-1],out={id:c.id,name:def.name,desc:def.desc,done:c.done};if(c.values)out.values=c.values.slice();return out;}),completedValues:state.completedValues.slice()};if(card(state,5))out.soloProgress=card(state,5).done?2:state.soloStreak||0;return out;};
 if(typeof module!=='undefined'&&module.exports)module.exports=H;else window.BB_CHALLENGES=H;
})();
