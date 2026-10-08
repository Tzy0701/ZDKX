// 服务端音频时间轴组件。只有另行核实的录音与指令清单才可启动。
(function(){
 'use strict';
 var A={version:1,missions:[19,30,42,54,66]};
 function clone(x){return JSON.parse(JSON.stringify(x));}
 A.validate=function(d,mission,contentVersion){
  if(!d||d.verified!==true)return '音频指令清单尚未核实';
  if(d.version!==1||d.mission!==mission||!A.missions.includes(mission)||!Number.isSafeInteger(d.contentVersion)||d.contentVersion<1||d.contentVersion!==contentVersion)return '音频任务或内容版本不匹配';
  if(!d.asset||typeof d.asset.sha256!=='string'||!/^[a-f0-9]{64}$/.test(d.asset.sha256)||!['en','fr','de','zh-HK'].includes(d.asset.locale))return '录音版本标识无效';
  try{var url=new URL(d.asset.url);if(url.protocol!=='https:'||url.username||url.password||!['cdn.pegasus.de','www.cocktailgames.com','cocktailgames.com'].includes(url.hostname))return '录音须来自已核实的发行商资源';}catch(_){return '录音地址无效';}
  if(!Number.isSafeInteger(d.durationMs)||d.durationMs<=0||!Array.isArray(d.cues))return '录音时长或指令无效';
  var ids=[],previous=-1,terminal=false;
  for(var cue of d.cues){if(!cue||typeof cue.id!=='string'||!cue.id||ids.includes(cue.id)||!Number.isSafeInteger(cue.atMs)||cue.atMs<previous||cue.atMs>d.durationMs||cue.atMs<0||!['hold','resume','fail'].includes(cue.type)||terminal||cue.text!==undefined&&typeof cue.text!=='string')return '音频指令编号、顺序或类型无效';ids.push(cue.id);previous=cue.atMs;terminal=cue.type==='fail';}
  return null;
 };
 A.create=function(gid,d,now){if(typeof gid!=='string'||!gid||!Number.isFinite(now))throw Error('音频时钟需要游戏编号和服务器时间');var err=A.validate(d,d.mission,d.contentVersion);if(err)throw Error(err);return {version:1,gid:gid,definition:clone(d),status:'running',baseMs:0,startedAt:now,applied:0,cutHeld:false,text:null,revision:1};};
 A.elapsed=function(s,now){var delivered=s.applied?s.definition.cues[s.applied-1].atMs:0;return Math.min(s.definition.durationMs,Math.max(delivered,s.baseMs,s.baseMs+(s.status==='running'?Math.max(0,now-s.startedAt):0)));};
 A.due=function(s,now){var cue=s.definition.cues[s.applied];return s.status==='running'&&cue&&cue.atMs<=A.elapsed(s,now)?cue:null;};
 A.pause=function(s,now){if(s.status!=='running')return false;s.baseMs=A.elapsed(s,now);s.startedAt=null;s.status='paused';s.revision++;return true;};
 A.resume=function(s,now){if(s.status!=='paused')return false;s.startedAt=now;s.status='running';s.revision++;return true;};
 A.stop=function(s,now){if(s.status==='ended')return false;s.baseMs=A.elapsed(s,now);s.startedAt=null;s.status='ended';s.revision++;return true;};
 A.advance=function(s,now,apply){
  if(!Number.isFinite(now)||typeof apply!=='function')return {error:'音频推进参数无效'};
  var before=clone(s),changed=false,cue;
  while((cue=A.due(s,now))){var err;try{err=apply(clone(cue));}catch(_){err='音频指令执行失败';}if(err){Object.keys(s).forEach(k=>delete s[k]);Object.assign(s,before);return {error:err};}
   s.applied++;s.revision++;s.text=cue.text||null;changed=true;
   if(cue.type==='hold')s.cutHeld=true;else if(cue.type==='resume')s.cutHeld=false;else{s.baseMs=cue.atMs;s.startedAt=null;s.status='ended';break;}
  }
  if(s.status==='running'&&A.elapsed(s,now)===s.definition.durationMs){A.stop(s,now);changed=true;}
  return {error:null,changed:changed};
 };
 // 不公布未来事件、引爆时间或内部清单，避免提前剧透。
 A.view=function(s,now){var asset=s.definition.asset;return {version:1,status:s.status,elapsedMs:A.elapsed(s,now),mediaDurationMs:s.definition.durationMs,serverTime:now,source:{url:asset.url,sha256:asset.sha256,locale:asset.locale},cutHeld:s.cutHeld,text:s.text,revision:s.revision};};
 if(typeof module!=='undefined'&&module.exports)module.exports=A;else window.BB_AUDIO_TIMELINE=A;
})();
