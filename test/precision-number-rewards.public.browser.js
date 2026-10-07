// 真实联机房间，无测试快照注入。
const assert=require('assert'),BB=require('../js/engine'),M=require('../js/missions');const {chromium}=require(process.env.BB_PLAYWRIGHT_MODULE||'playwright');
const base=process.env.BB_BROWSER_URL;if(!/^https?:\/\//.test(base||''))throw new Error('请提供实际游戏网址');
(async()=>{const browser=await chromium.launch({executablePath:'/snap/bin/chromium',headless:true,args:['--no-sandbox']}),errors=[];try{for(const n of (process.env.BB_PLAYER_COUNTS ? process.env.BB_PLAYER_COUNTS.split(',').map(Number) : [2,3,4,5])){
 const pages=[],contexts=[];let code,threeD=true,duplicate=false,resolved=false,reloaded=false;
 try{for(let pi=0;pi<n;pi++){
  const c=await browser.newContext({viewport:{width:375,height:820},reducedMotion:'reduce'});contexts.push(c);await c.addInitScript(name=>{localStorage.setItem('bb_name',JSON.stringify(name));if(localStorage.getItem('bb_view3d')===null)localStorage.setItem('bb_view3d','true');const Socket=window.WebSocket;window.WebSocket=class extends Socket{constructor(...a){super(...a);this.addEventListener('message',e=>{try{const m=JSON.parse(e.data);if(m.topic==='official:lobby')window.testLobby=m.data;if(m.topic==='official:welcome')window.testRole=m.data.role;if(m.topic==='official:view'){if(m.data.view.log.some(x=>x.t.includes('的奖励数字「')))window.badRewardLog=true;window.testView=m.data.view;window.testRevision=m.data.revision;}}catch(_){}});}};},'奖励公网'+pi);
  const p=await c.newPage();pages.push(p);p.on('pageerror',e=>errors.push(e.message));await p.route('https://fonts.googleapis.com/**',r=>r.abort());await p.goto(base,{waitUntil:'domcontentloaded'});await p.locator('#nm').fill('奖励公网'+pi);
  if(!pi){await p.locator('#btn-host').click();await p.locator('#scr-lobby .code').waitFor();code=await p.locator('#scr-lobby .code').innerText();}else{await p.locator('#jcode').fill(code);await p.locator('#btn-join').click();}try{await pages[0].waitForFunction(n=>document.querySelectorAll('#scr-lobby .seat').length===n,pi+1);}catch(e){console.error('大厅验收诊断',n,pi,code,await Promise.all(pages.map(p=>p.evaluate(()=>({role:window.testRole,seats:window.testLobby?.seats?.length,started:window.testLobby?.started,visibleSeats:document.querySelectorAll('#scr-lobby .seat').length,notice:document.querySelector('.toast')?.innerText})))));throw e;}
 }
 const host=pages[0];assert((await host.locator('#msel option[value="39"]').innerText()).includes('已核实'));await host.locator('#msel').selectOption('39');await host.locator('#scr-lobby [data-act=start]').click();await Promise.all(pages.map(p=>p.waitForFunction(v=>window.testView?.official?.module==='precision-number-rewards'&&window.testView.contentVersion===v,M.CAMPAIGN_VERSION)));
 async function sync(){const r=Math.max(...await Promise.all(pages.map(p=>p.evaluate(()=>window.testRevision))));await Promise.all(pages.map(p=>p.waitForFunction(r=>window.testRevision>=r,r)));}
 async function views(){await sync();return Promise.all(pages.map(p=>p.evaluate(()=>window.testView)));}
 async function advance(f){await sync();const r=await host.evaluate(()=>window.testRevision);await f();await host.waitForFunction(r=>window.testRevision>r,r);await sync();}
 async function wire(pi,id){await pages[pi].locator('#scr-game '+(threeD?'.slot.can':'.tile.can')+'[data-w="'+id+'"]').click();}
 async function toggle(){for(const p of pages)await p.locator('#scr-game [data-act=view]').click();threeD=!threeD;}
 while((await host.evaluate(()=>window.testView.phase))==='setup'){const v=await views(),pd=v[0].pending,pi=pd.to,choice=v[pi].pending.choices.at(-1);await advance(()=>choice==null?pages[pi].locator('[data-act=initial-clue-aside][data-rack="0"]').click():wire(pi,choice));}
 const prepared=await views(),actor=prepared[0].turn,value=prepared[0].official.precision.value,all=prepared.flatMap((v,owner)=>v.players[owner].stands.flat().map(w=>({...w,owner}))),ids=all.filter(w=>w.v===value&&!w.cut).map(w=>w.id);assert.equal(ids.length,4);
 await pages[actor].locator('[data-act=precision-start]').click();for(const id of ids)await wire(actor,id);for(let mode=0;mode<2;mode++){assert.equal(await pages[actor].locator('[data-act=precision-submit]:enabled').count(),1);await toggle();}
 await advance(()=>pages[actor].locator('[data-act=precision-submit]').click());
 await advance(()=>host.locator('[data-act=host-pause]').click());assert((await views())[0].paused);await advance(()=>host.locator('[data-act=host-pause]').click());
 while((await views())[0].pending?.type==='precision-cut'){const v=await views(),pd=v[0].pending;assert.equal(pd.type,'precision-cut');for(let pi=0;pi<n;pi++){assert.equal('ownAnswers'in v[pi].pending,pi===pd.to);assert.equal(await pages[pi].locator('.declared-target').count(),4);}
  if(!reloaded){await pages[pd.to].reload({waitUntil:'domcontentloaded'});await pages[pd.to].locator('#jcode').fill(code);await pages[pd.to].locator('#btn-join').click();await pages[pd.to].waitForFunction(id=>window.testView?.pending?.id===id,pd.id);reloaded=true;}
  await advance(()=>pages[pd.to].locator('[data-act=precision-reply]').click());
 }
 let rewardReconnect=false;
 while((await views())[0].pending?.type==='precision-clue'){
  const v=await views(),pd=v[0].pending;for(let pi=0;pi<n;pi++){assert.equal('choices'in v[pi].pending,pi===pd.to);assert(!('distributed'in v[pi].official.precision));assert(Array.isArray(v[pi].official.precision.assignedNumbers));}
  if(!rewardReconnect){await pages[pd.to].reload({waitUntil:'domcontentloaded'});await pages[pd.to].locator('#jcode').fill(code);await pages[pd.to].locator('#btn-join').click();await pages[pd.to].waitForFunction(id=>window.testView?.pending?.id===id,pd.id);rewardReconnect=true;}
  await advance(()=>wire(pd.to,(v[pd.to].pending.choices.at(-1))));
 }
 assert((await views())[0].official.precision.complete);for(const p of pages)assert(!await p.evaluate(()=>window.badRewardLog));assert((await views())[0].equip.every(e=>!e.hidden&&e.open));
 if(n===2)for(let k=0;k<180;k++){
  const v=await views(),V=v[0];if(V.phase!=='play')break;const pi=V.turn,own=v[pi].players[pi].stands.flat().filter(w=>!w.cut);
  if(own.every(w=>BB.kindOf(w)==='r')){await advance(()=>pages[pi].locator('[data-act=red]').click());continue;}
  const value=BB.annOf(own.find(w=>BB.kindOf(w)!=='r')),target=v.flatMap((view,owner)=>view.players[owner].stands.flat().map(w=>({...w,owner}))).find(w=>w.owner!==pi&&!w.cut&&BB.matches(w,value));
  if(!target){await advance(()=>pages[pi].locator('[data-act=solo][data-v="'+value+'"]').click());continue;}
  await wire(pi,target.id);await advance(()=>pages[pi].locator('[data-act=val][data-v="'+value+'"]').click());await advance(()=>pages[target.owner].locator('[data-act=resolve-target]').click());const choices=(await views())[pi].pending.choices;await advance(()=>wire(pi,choices.at(-1)));
 }
 if(n===2)assert.equal((await views())[0].phase,'won');host.once('dialog',d=>d.accept());await host.locator('[data-act=host-quit]').click();await host.locator('#scr-lobby').waitFor({state:'visible'});console.log('✓ 第39关真实联机'+n+'人：版本15、手机双视图、四线公开箭头、私人回应、暂停重连、私有奖励牌及逐项线索'+(n===2?'；完整通关':''));
 }finally{for(const c of contexts)await c.close();}
}assert.deepEqual(errors,[]);}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
