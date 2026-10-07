// 真实联机房间，无测试快照注入。
const assert=require('assert'),BB=require('../js/engine'),M=require('../js/missions');const {chromium}=require(process.env.BB_PLAYWRIGHT_MODULE||'playwright');
const base=process.env.BB_BROWSER_URL;if(!/^https?:\/\//.test(base||''))throw new Error('请提供实际游戏网址');
(async()=>{const browser=await chromium.launch({executablePath:'/snap/bin/chromium',headless:true,args:['--no-sandbox']}),errors=[];try{for(const n of (process.env.BB_PLAYER_COUNTS ? process.env.BB_PLAYER_COUNTS.split(',').map(Number) : [2,3,4,5])){
 const pages=[],contexts=[];let code,threeD=true,duplicate=false,resolved=false,reloaded=false;
 try{for(let pi=0;pi<n;pi++){
  const c=await browser.newContext({viewport:{width:375,height:820},reducedMotion:'reduce'});contexts.push(c);await c.addInitScript(name=>{localStorage.setItem('bb_name',JSON.stringify(name));if(localStorage.getItem('bb_view3d')===null)localStorage.setItem('bb_view3d','true');const Socket=window.WebSocket;window.WebSocket=class extends Socket{constructor(...a){super(...a);this.addEventListener('message',e=>{try{const m=JSON.parse(e.data);if(m.topic==='official:lobby')window.testLobby=m.data;if(m.topic==='official:welcome')window.testRole=m.data.role;if(m.topic==='official:view'){if(m.data.view.log.some(x=>x.t.includes('的奖励数字「')))window.badRewardLog=true;window.testView=m.data.view;window.testRevision=m.data.revision;}}catch(_){}});}};},'绊线公网'+pi);
  const p=await c.newPage();pages.push(p);p.on('pageerror',e=>errors.push(e.message));await p.route('https://fonts.googleapis.com/**',r=>r.abort());await p.goto(base,{waitUntil:'domcontentloaded'});await p.locator('#nm').fill('绊线公网'+pi);
  if(!pi){await p.locator('#btn-host').click();await p.locator('#scr-lobby .code').waitFor();code=await p.locator('#scr-lobby .code').innerText();}else{await p.locator('#jcode').fill(code);await p.locator('#btn-join').click();}try{await pages[0].waitForFunction(n=>document.querySelectorAll('#scr-lobby .seat').length===n,pi+1);}catch(e){console.error('大厅验收诊断',n,pi,code,await Promise.all(pages.map(p=>p.evaluate(()=>({role:window.testRole,seats:window.testLobby?.seats?.length,started:window.testLobby?.started,visibleSeats:document.querySelectorAll('#scr-lobby .seat').length,notice:document.querySelector('.toast')?.innerText})))));throw e;}
 }
 const host=pages[0];assert((await host.locator('#msel option[value="41"]').innerText()).includes('已核实'));await host.locator('#msel').selectOption('41');await host.locator('#scr-lobby [data-act=start]').click();await Promise.all(pages.map(p=>p.waitForFunction(v=>window.testView?.official?.module==='tripwire'&&window.testView.contentVersion===v,M.CAMPAIGN_VERSION)));
 async function sync(){const r=Math.max(...await Promise.all(pages.map(p=>p.evaluate(()=>window.testRevision))));await Promise.all(pages.map(p=>p.waitForFunction(r=>window.testRevision>=r,r)));}
 async function views(){await sync();return Promise.all(pages.map(p=>p.evaluate(()=>window.testView)));}
 async function advance(f){await sync();const r=await host.evaluate(()=>window.testRevision);await f();await host.waitForFunction(r=>window.testRevision>r,r);await sync();}
 async function wire(pi,id){await pages[pi].locator('#scr-game '+(threeD?'.slot.can':'.tile.can')+'[data-w="'+id+'"]').click();}
 async function toggle(){for(const p of pages)await p.locator('#scr-game [data-act=view]').click();threeD=!threeD;}
 while((await host.evaluate(()=>window.testView.phase))==='setup'){const v=await views(),pd=v[0].pending,pi=pd.to,choice=v[pi].pending.choices.at(-1);await advance(()=>choice==null?pages[pi].locator('[data-act=initial-clue-aside][data-rack="0"]').click():wire(pi,choice));}
 let secured=false,paused=false;
 for(let k=0;k<180;k++){
  const v=await views(),V=v[0];if(V.phase!=='play'||n!==2&&secured)break;assert(!V.official.tripwire.stalled);const who=V.turn,all=v.flatMap((view,owner)=>view.players[owner].stands.flat().map(w=>({...w,owner}))),own=v[who].players[who].stands.flat().filter(w=>!w.cut),yellow=all.find(w=>w.owner!==who&&!w.cut&&BB.kindOf(w)==='y');
  if(yellow){
   for(let mode=0;mode<(secured?0:2);mode++){assert.equal(await pages[who].locator('[data-act=val][data-v="Y"]:enabled').count(),0);await toggle();}
   await pages[who].locator('[data-act=tripwire-start]').click();await wire(who,yellow.id);const beforeDet=V.det;await advance(()=>pages[who].locator('[data-act=tripwire-submit]').click());const pending=await views();for(let pi=0;pi<n;pi++){assert.equal('ownAnswers'in pending[pi].pending,pi===yellow.owner);assert.equal(await pages[pi].locator('.declared-target').count(),1);}
   if(!paused){await advance(()=>host.locator('[data-act=host-pause]').click());assert((await views())[0].paused);await advance(()=>host.locator('[data-act=host-pause]').click());paused=true;}
   if(!reloaded){const id=pending[0].pending.id;await pages[yellow.owner].reload({waitUntil:'domcontentloaded'});await pages[yellow.owner].locator('#jcode').fill(code);await pages[yellow.owner].locator('#btn-join').click();await pages[yellow.owner].waitForFunction(id=>window.testView?.pending?.id===id,id);reloaded=true;}
   await advance(()=>pages[yellow.owner].locator('[data-act=tripwire-reply]').click());const done=(await views())[0];assert.equal(done.det,Math.max(done.detMin,beforeDet-1));assert.equal(done.players[yellow.owner].stands.flat().find(w=>w.id===yellow.id).resolution,'secured');secured=true;continue;
  }
  if(own.every(w=>BB.kindOf(w)==='r')){await advance(()=>pages[who].locator('[data-act=red]').click());continue;}
  const value=own.find(w=>BB.kindOf(w)==='b').v,target=all.find(w=>w.owner!==who&&!w.cut&&w.v===value);
  if(!target){await advance(()=>pages[who].locator('[data-act=solo][data-v="'+value+'"]').click());continue;}
  await wire(who,target.id);await advance(()=>pages[who].locator('[data-act=val][data-v="'+value+'"]').click());await advance(()=>pages[target.owner].locator('[data-act=resolve-target]').click());const choices=(await views())[who].pending.choices;await advance(()=>wire(who,choices.at(-1)));
 }
 assert(secured&&paused&&reloaded);if(n===2)assert.equal((await views())[0].phase,'won');host.once('dialog',d=>d.accept());await host.locator('[data-act=host-quit]').click();await host.locator('#scr-lobby').waitFor({state:'visible'});console.log('✓ 第41关真实联机'+n+'人：版本16、手机双视图、随机初始、固定起点、公开绊线目标、私人回应、暂停重连及退格'+(n===2?'；完整通关':''));
 }finally{for(const c of contexts)await c.close();}
}assert.deepEqual(errors,[]);}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
