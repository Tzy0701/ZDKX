// 真实房间，经界面建房与提交动作；不注入牌局或备用内容。
const assert=require('assert'),M=require('../js/missions');
const {chromium}=require(process.env.BB_PLAYWRIGHT_MODULE||'playwright');
const base=process.env.BB_BROWSER_URL;if(!/^https?:\/\//.test(base||''))throw new Error('请提供游戏网址');
(async()=>{const browser=await chromium.launch({executablePath:'/snap/bin/chromium',headless:true,args:['--no-sandbox']}),errors=[];
try{for(const n of [2,3,4,5]){
 const pages=[],contexts=[];let code,threeD=true,drew=false,reloaded=false,paused=false;
 try{
  for(let pi=0;pi<n;pi++){
   const context=await browser.newContext({viewport:{width:375,height:820},reducedMotion:'reduce'});contexts.push(context);
   await context.addInitScript(()=>{localStorage.setItem('bb_view3d','true');const Socket=window.WebSocket;window.WebSocket=class extends Socket{constructor(...args){super(...args);this.addEventListener('message',e=>{try{const m=JSON.parse(e.data);if(m.topic==='official:view'){window.testView=m.data.view;window.testRevision=m.data.revision;}}catch(_){}});}};});
   const page=await context.newPage();pages.push(page);page.on('pageerror',e=>errors.push(e.message));await page.route('https://fonts.googleapis.com/**',r=>r.abort());await page.goto(base,{waitUntil:'domcontentloaded'});await page.locator('#nm').fill('机器人任务验收'+pi);
   if(pi===0){await page.locator('#btn-host').click();await page.locator('#scr-lobby .code').waitFor();code=await page.locator('#scr-lobby .code').innerText();}else{await page.locator('#jcode').fill(code);await page.locator('#btn-join').click();}
   await pages[0].waitForFunction(count=>document.querySelectorAll('#scr-lobby .seat').length===count,pi+1);
  }
  const host=pages[0];assert((await host.locator('#msel option[value="43"]').innerText()).includes('已核实'));await host.locator('#msel').selectOption('43');await host.locator('#scr-lobby [data-act=start]').click();
  await Promise.all(pages.map(p=>p.waitForFunction(version=>window.testView?.official?.module==='nano-robot'&&window.testView.contentVersion===version,M.CAMPAIGN_VERSION)));
  async function views(){const r=Math.max(...await Promise.all(pages.map(p=>p.evaluate(()=>window.testRevision))));await Promise.all(pages.map(p=>p.waitForFunction(r=>window.testRevision>=r,r)));return Promise.all(pages.map(p=>p.evaluate(()=>window.testView)));}
  async function advance(f){const r=(await views(),await host.evaluate(()=>window.testRevision));await f();await host.waitForFunction(r=>window.testRevision>r,r);await views();}
  async function wire(pi,id){await pages[pi].locator('#scr-game '+(threeD?'.slot.can':'.tile.can')+'[data-w="'+id+'"]').click();}
  async function toggle(){for(const p of pages)await p.locator('#scr-game [data-act=view]').click();threeD=!threeD;}
  const initial=n===2?5:n===5?3:4;
  while((await views())[0].phase==='setup'){
   const v=await views(),pi=v[0].setup[0]===0?0:v[0].players.findIndex((_,i)=>v[0].setup[i]===0),pd=v[pi].pending;
   if(pd){const id=pd.choices.at(-1);await advance(()=>id==null?pages[pi].locator('[data-act=initial-clue-aside][data-rack="0"]').click():wire(pi,id));}
   else{const id=v[pi].players[pi].stands.flat().find(w=>!w.cut&&Number.isInteger(w.v)&&!w.info).id;await advance(()=>wire(pi,id));}
  }
  for(let step=0;step<200;step++){
   const v=await views(),V=v[0];if(V.phase!=='play'||n!==2&&drew)break;const who=V.turn,pd=v[who].pending;
   if(pd?.type==='nano-rack'){
    for(let pi=0;pi<n;pi++){assert.equal('drawn'in v[pi].pending,pi===who);assert.equal('choices'in v[pi].pending,pi===who);}
    if(!paused){await advance(()=>host.locator('[data-act=host-pause]').click());assert((await views())[0].paused);await advance(()=>host.locator('[data-act=host-pause]').click());paused=true;}
    if(!reloaded){await pages[who].reload({waitUntil:'domcontentloaded'});await pages[who].locator('#jcode').fill(code);await pages[who].locator('#btn-join').click();await pages[who].waitForFunction(id=>window.testView?.pending?.id===id,pd.id);reloaded=true;}
    const before=V.official.nano.position;await advance(()=>pages[who].locator('[data-act=nano-rack][data-rack="1"]').click());assert.equal((await views())[0].official.nano.position,before+V.official.nano.direction);drew=true;continue;
   }
   const all=v.flatMap((view,owner)=>view.players[owner].stands.flat().map(w=>({...w,owner}))),own=v[who].players[who].stands.flat().filter(w=>!w.cut);
   if(own.length&&own.every(w=>!Number.isInteger(w.v))){await advance(()=>pages[who].locator('[data-act=red]').click());continue;}
   const values=[...new Set(own.filter(w=>Number.isInteger(w.v)).map(w=>w.v))].sort((a,b)=>Number(b===V.official.nano.position)-Number(a===V.official.nano.position));let selected;
   for(const value of values){const count=own.filter(w=>w.v===value).length,cut=all.filter(w=>w.cut&&w.v===value).length,target=all.find(w=>w.owner!==who&&!w.cut&&w.v===value);if(count===4||count===2&&cut===2){selected={value,solo:true};break;}if(target){selected={value,target};break;}}
   assert(selected,'完整牌面参考策略无匹配行动，需复核拆线顺序与备用时机');const before=V.official.nano.remaining;
   if(selected.solo)await advance(()=>pages[who].locator('[data-act=solo][data-v="'+selected.value+'"]').click());
   else{await wire(who,selected.target.id);await advance(()=>pages[who].locator('[data-act=val][data-v="'+selected.value+'"]').click());const declared=await views();for(const p of pages)assert.equal(await p.locator('.declared-target').count(),1);await advance(()=>pages[selected.target.owner].locator('[data-act=resolve-target]').click());const ownChoice=(await views())[who].pending.choices.at(-1);await advance(()=>wire(who,ownChoice));}
   const after=(await views())[0];if(after.official.nano.remaining<before&&!after.pending)drew=true;
   if(step===0){for(let mode=0;mode<2;mode++){for(const p of pages){assert((await p.locator('.nano-panel').innerText()).includes('机器人'));assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));}await toggle();}}
  }
  assert(drew);if(n===2){assert(paused&&reloaded);assert.equal((await views())[0].phase,'won');assert.equal((await views())[0].official.nano.remaining,0);}
  console.log('✓ 第43关真实联机'+n+'人：版本'+M.CAMPAIGN_VERSION+'、手机双视图、公开位置与数量、玩家回应与私人补线'+(n===2?'、选架暂停重连及完整通关':''));
 }finally{const host=pages[0];if(host)try{host.once('dialog',d=>d.accept());await host.locator('[data-act=host-quit]').click({timeout:3000});await host.locator('#scr-lobby').waitFor({state:'visible',timeout:5000});}catch(e){console.error('验收房间退出未确认',code,e.message);}for(const c of contexts)await c.close();}
}assert.deepEqual(errors,[]);}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
