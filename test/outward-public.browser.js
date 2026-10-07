// 真实联机房间，无测试快照注入。
const assert=require('assert'),BB=require('../js/engine'),M=require('../js/missions');const {chromium}=require(process.env.BB_PLAYWRIGHT_MODULE||'playwright');
const base=process.env.BB_BROWSER_URL;if(!/^https?:\/\//.test(base||''))throw new Error('请提供实际游戏网址');
(async()=>{const browser=await chromium.launch({executablePath:'/snap/bin/chromium',headless:true,args:['--no-sandbox']}),errors=[];try{for(let n=2;n<=5;n++){
 const pages=[],contexts=[];let code,threeD=true,duplicate=false,resolved=false,reloaded=false;
 try{for(let pi=0;pi<n;pi++){
  const c=await browser.newContext({viewport:{width:375,height:820},reducedMotion:'reduce'});contexts.push(c);await c.addInitScript(name=>{localStorage.setItem('bb_name',JSON.stringify(name));if(localStorage.getItem('bb_view3d')===null)localStorage.setItem('bb_view3d','true');const Socket=window.WebSocket;window.WebSocket=class extends Socket{constructor(...a){super(...a);this.addEventListener('message',e=>{try{const m=JSON.parse(e.data);if(m.topic==='official:view'){window.testView=m.data.view;window.testRevision=m.data.revision;}}catch(_){}});}};},'朝外公网'+pi);
  const p=await c.newPage();pages.push(p);p.on('pageerror',e=>errors.push(e.message));await p.route('https://fonts.googleapis.com/**',r=>r.abort());await p.goto(base,{waitUntil:'domcontentloaded'});await p.locator('#nm').fill('朝外公网'+pi);
  if(!pi){await p.locator('#btn-host').click();await p.locator('#scr-lobby .code').waitFor();code=await p.locator('#scr-lobby .code').innerText();}else{await p.locator('#jcode').fill(code);await p.locator('#btn-join').click();}await pages[0].waitForFunction(n=>document.querySelectorAll('#scr-lobby .seat').length===n,pi+1);
 }
 const host=pages[0];assert((await host.locator('#msel option[value="38"]').innerText()).includes('已核实'));await host.locator('#msel').selectOption('38');await host.locator('#scr-lobby [data-act=start]').click();await Promise.all(pages.map(p=>p.waitForFunction(v=>window.testView?.official?.module==='captain-outward-wire'&&window.testView.contentVersion===v,M.CAMPAIGN_VERSION)));
 async function sync(){const r=Math.max(...await Promise.all(pages.map(p=>p.evaluate(()=>window.testRevision))));await Promise.all(pages.map(p=>p.waitForFunction(r=>window.testRevision>=r,r)));}
 async function views(){await sync();return Promise.all(pages.map(p=>p.evaluate(()=>window.testView)));}
 async function advance(f){await sync();const r=await host.evaluate(()=>window.testRevision);await f();await host.waitForFunction(r=>window.testRevision>r,r);await sync();}
 async function wire(pi,id){await pages[pi].locator('#scr-game '+(threeD?'.slot.can':'.tile.can')+'[data-w="'+id+'"]').click();}
 async function toggle(){for(const p of pages)await p.locator('#scr-game [data-act=view]').click();threeD=!threeD;}
 while((await host.evaluate(()=>window.testView.phase))==='setup'){const v=await views(),pi=BB.setupActor(v[0]),w=v[pi].players[pi].stands.flat().find(w=>BB.setupInfoAllowed(v[pi],w)&&w.v!=null&&BB.kindOf(w)==='b');await advance(()=>wire(pi,w.id));}
 for(let k=0;k<200;k++){
  const v=await views(),V=v[0];if(V.phase!=='play'||n!==2&&resolved&&duplicate)break;const pi=V.turn,cap=V.captain,id=V.official.outwardId,own=v[pi].players[pi].stands.flat().filter(w=>!w.cut),special=v[(cap+1)%n].players[cap].stands.flat().find(w=>w.id===id);
  for(let mode=0;mode<(resolved?0:2);mode++){assert.equal(v[cap].players[cap].stands.flat().find(w=>w.id===id).v,null);for(const p of pages){assert.equal(await p.locator('.outward-marker:not([hidden])').count(),1);assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));}await toggle();}
  const all=v.flatMap((view,owner)=>view.players[owner].stands.flat().map(w=>({...w,owner})));const pos=all.findIndex(w=>w.id===id);all[pos]={...special,owner:cap};
  if(BB.outwardSkipAllowed(v[pi],pi)){await advance(()=>pages[pi].locator('[data-act=outward-skip]').click());continue;}
  if(pi===cap&&!special.cut){
   if(BB.kindOf(special)==='r'&&BB.outwardRedPossible(v[cap])){await advance(()=>pages[cap].locator('[data-act=outward-red]').click());resolved=true;continue;}
   if(BB.kindOf(special)==='b'){
    if(BB.outwardSoloValues(v[cap]).includes(special.v)){await advance(()=>pages[cap].locator('[data-act=outward-solo][data-v="'+special.v+'"]').click());resolved=true;continue;}
    const target=all.find(w=>w.owner!==cap&&!w.cut&&w.v===special.v);assert(target);await pages[cap].locator('[data-act=mode][data-m=outward]').click();await wire(cap,target.id);await advance(()=>pages[cap].locator('[data-act=val][data-v="'+special.v+'"]').click());await advance(()=>pages[target.owner].locator('[data-act=resolve-target]').click());
    const stage=await views();assert.deepEqual(stage[cap].pending.choices,[id]);assert.equal(stage[cap].players[cap].stands.flat().find(w=>w.id===id).v,null);for(const view of stage)assert.equal(view.players[target.owner].stands.flat().find(w=>w.id===target.id).v,special.v);
    await pages[cap].reload({waitUntil:'domcontentloaded'});await pages[cap].locator('#jcode').fill(code);await pages[cap].locator('#btn-join').click();await pages[cap].waitForFunction(()=>window.testView?.pending?.step==='own');await advance(()=>wire(cap,id));reloaded=true;resolved=true;continue;
   }
  }
  const known=own.filter(w=>w.v!=null&&!BB.isOutward(V,w));if(known.every(w=>BB.kindOf(w)==='r')){await advance(()=>pages[pi].locator('[data-act=red]').click());continue;}
  const candidates=known.filter(w=>BB.kindOf(w)==='b'),multi=candidates.find(w=>known.filter(x=>x.v===w.v).length>=2&&all.some(x=>x.owner!==pi&&!x.cut&&!BB.isOutward(V,x)&&x.v===w.v));const value=(!duplicate&&multi||candidates[0]).v,target=all.find(w=>w.owner!==pi&&!w.cut&&!BB.isOutward(V,w)&&w.v===value);
  if(!target){await advance(()=>pages[pi].locator('[data-act=solo][data-v="'+value+'"]').click());continue;}
  await wire(pi,target.id);await advance(()=>pages[pi].locator('[data-act=val][data-v="'+value+'"]').click());await advance(()=>pages[target.owner].locator('[data-act=resolve-target]').click());const vv=await views();for(const view of vv)assert.equal(view.players[target.owner].stands.flat().find(w=>w.id===target.id).v,value);
  const choices=vv[pi].pending.choices.filter(w=>w!==id),selected=choices.at(-1);if(!reloaded){await pages[pi].reload({waitUntil:'domcontentloaded'});await pages[pi].locator('#jcode').fill(code);await pages[pi].locator('#btn-join').click();await pages[pi].waitForFunction(()=>window.testView?.pending?.step==='own');reloaded=true;}await advance(()=>wire(pi,selected));if(choices.length>1)duplicate=true;
 }
 assert(resolved&&duplicate&&reloaded);if(n===2)assert.equal((await views())[0].phase,'won');host.once('dialog',d=>d.accept());await host.locator('[data-act=host-quit]').click();await host.locator('#scr-lobby').waitFor({state:'visible'});console.log('✓ 第38关真实联机'+n+'人：版本、手机双视图、朝外处理、目标翻牌、私人确认、重复手牌及重连'+(n===2?'；完整通关':''));
 }finally{for(const c of contexts)await c.close();}
}assert.deepEqual(errors,[]);}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
