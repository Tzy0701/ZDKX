// 本机播放跟随服务器快照；媒体播放不能改变游戏时间轴。
(function(){
 'use strict';
 function validAsset(asset){try{var u=new URL(asset.url);return u.protocol==='https:'&&!u.username&&!u.password&&['cdn.pegasus.de','cocktailgames.com','www.cocktailgames.com'].includes(u.hostname)&&/^[a-f0-9]{64}$/.test(asset.sha256);}catch(_){return false;}}
 async function loadVerified(asset,options){
  options=options||{};if(!validAsset(asset))throw Error('音频资源无效。');var crypt=options.crypto||globalThis.crypto;if(!crypt||!crypt.subtle)throw Error('当前浏览器无法准备任务音频。');
  var room=options.room||(globalThis.BBNet&&globalThis.BBNet.activeRoom),suffix=room?'?room='+encodeURIComponent(room):'';
  var response=await (options.fetch||fetch)('/audio/'+asset.sha256+'.mp3'+suffix,{credentials:'omit',signal:options.signal});if(!response.ok)throw Error('音频加载失败，请重试。');var bytes=await response.arrayBuffer();if(bytes.byteLength>64*1024*1024)throw Error('录音文件超出本机播放限制。');
  var digest=await crypt.subtle.digest('SHA-256',bytes),hash=Array.from(new Uint8Array(digest)).map(function(v){return v.toString(16).padStart(2,'0');}).join('');if(hash!==asset.sha256)throw Error('录音版本不匹配，暂不能播放。');
  var url=(options.createURL||URL.createObjectURL)(new Blob([bytes],{type:'audio/mpeg'}));return {url:url,release:function(){(options.releaseURL||URL.revokeObjectURL)(url);}};
 }
 function create(options){
  options=options||{};var make=options.makeAudio||function(){return new Audio();},now=options.now||function(){return performance.now();},load=options.loadAsset||function(asset,signal){return loadVerified(asset,{signal:signal});};
  var media=null,snapshot=null,receivedAt=0,key=null,enabled=false,error=null,generation=0,prepared=null,loading=null,controller=null,preflight=false;
  function desired(){return snapshot.elapsedMs+(snapshot.status==='running'?Math.max(0,now()-receivedAt):0);}
  function seek(force){if(!media||!snapshot||media.seeking&&!force)return;var target=desired()/1000;if(Number.isFinite(snapshot.mediaDurationMs))target=Math.min(target,snapshot.mediaDurationMs/1000);else if(Number.isFinite(media.duration))target=Math.min(target,media.duration);if(Math.abs(media.currentTime-target)>.5||((force||snapshot.status!=='running')&&Math.abs(media.currentTime-target)>.001))try{media.currentTime=target;}catch(_){}}
  function sync(){if(!enabled||!media||!snapshot)return;if(snapshot.status==='running'&&Number.isFinite(snapshot.mediaDurationMs)&&desired()>=snapshot.mediaDurationMs){media.pause();error='录音已到末尾，等待服务器同步。';return;}seek();if(snapshot.status!=='running')media.pause();else if(media.paused){var epoch=generation,promise=media.play();if(promise&&promise.catch)promise.catch(function(){if(epoch!==generation)return;enabled=false;error='浏览器未能播放，请再次开启声音。';});}}
  function destroy(){generation++;if(controller)controller.abort();if(media){media.pause();media.removeAttribute('src');media.load();}if(prepared)prepared.release();prepared=null;loading=null;controller=null;media=null;snapshot=null;key=null;enabled=false;preflight=false;error=null;}
  function prepare(){if(!snapshot)return Promise.resolve('当前没有音频任务');if(prepared)return Promise.resolve(null);if(loading)return loading;var epoch=generation,asset=snapshot.source;error=null;controller=new AbortController();var signal=controller.signal;loading=Promise.resolve().then(function(){return load(asset,signal);}).then(function(result){if(epoch!==generation){result.release();return null;}prepared=result;loading=null;controller=null;return null;},function(e){if(epoch!==generation)return null;loading=null;controller=null;error=e&&/[\u3400-\u9fff]/.test(e.message)?e.message:'音频加载失败，请重试。';return error;});return loading;}
  return {
   update:function(gid,view){if(!view){destroy();return;}if(!validAsset(view.source)||!Number.isFinite(view.elapsedMs)||view.elapsedMs<0||!['waiting','running','paused','ended'].includes(view.status)){destroy();error='音频资源无效。';return;}var next=gid+':'+view.source.sha256;if(key&&key!==next)destroy();if(key===next&&snapshot&&(view.revision<snapshot.revision||view.revision===snapshot.revision&&view.serverTime<=snapshot.serverTime))return;if(error==='录音已到末尾，等待服务器同步。')error=null;key=next;snapshot=view;receivedAt=now();sync();},
   prepare:prepare,
   enable:function(){if(!snapshot)return Promise.resolve('当前没有音频任务');if(!prepared)return Promise.resolve('请先准备任务音频。');if(!['waiting','running'].includes(snapshot.status))return Promise.resolve('牌局暂停或已结束，暂不能开启声音。');if(preflight)return Promise.resolve('正在检查声音，请稍候。');error=null;var epoch=generation;if(!media){media=make();media.preload='metadata';media.src=prepared.url;media.addEventListener('loadedmetadata',function(){if(epoch===generation)seek();});media.addEventListener('error',function(){if(epoch!==generation)return;enabled=false;error='音频加载失败，请重试。';});}preflight=snapshot.status==='waiting';enabled=!preflight;seek(true);return Promise.resolve(media.play()).then(function(){if(epoch!==generation)return null;preflight=false;enabled=true;if(snapshot.status==='waiting'){media.pause();seek(true);}return null;},function(){if(epoch!==generation)return null;preflight=false;enabled=false;error='浏览器未能播放，请再次开启声音。';return error;});},
   sync:sync,destroy:destroy,
   status:function(){return {enabled:enabled,prepared:!!prepared,loading:!!loading,preflight:preflight,error:error};}
  };
 }
 if(typeof module!=='undefined'&&module.exports)module.exports={create:create,loadVerified:loadVerified};else window.BB_AUDIO_PLAYER={create:create,loadVerified:loadVerified};
})();
