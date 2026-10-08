const assert = require('assert'), fs = require('fs'), path = require('path'), BB = require('../js/engine'), M = require('../js/missions');
const { chromium } = require(process.env.BB_PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.BB_BROWSER_URL || 'http://127.0.0.1:9123', dir = process.env.BB_TEST_DATA_DIR || '/tmp/bb40-test-data';
if (!/^http:\/\/(127\.0\.0\.1|localhost):/.test(base) || !dir.startsWith('/tmp/')) throw new Error('只允许隔离本机测试');
function rng(seed) { return () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296); }
function fixture(n, actor) {
 const code='M'+Date.now().toString(36).slice(-4).toUpperCase()+n,seats=Array.from({length:n},(_,i)=>({pid:code+'-p'+i,name:'混合验收'+i,credential:code+'-凭证'+i,bot:false}));let G;
 for(let seed=1;seed<500;seed++){G=BB.createGame(M.get('official-development',40),seats,{captain:0,rng:rng(seed*104729)});if(G.equip.some(e=>e.n===2)&&G.equip.some(e=>e.n===4)&&G.wires.some(w=>w.o===actor&&w.v===4))break;}
 assert(G.equip.some(e=>e.n===2));assert(G.equip.some(e=>e.n===4));while(G.phase==='setup'){const pi=BB.setupActor(G),w=G.wires.find(w=>w.o===pi&&BB.setupInfoAllowed(G,w));assert.equal(BB.act(G,pi,{a:'info',w:w.id}),null);}
 for(let k=0;k<200&&(!BB.equipUnlocked(G,2)||!BB.equipUnlocked(G,4)||!G.wires.some(w=>w.o===actor&&w.v===4&&w.cut));k++){
  const pi=G.pending?G.pending.to:G.turn;let a;
  if(G.pending){a={a:'resolve',id:G.pending.id,w:BB.view(G,pi).pending.choices[0]};}else{
   const own=G.wires.filter(w=>w.o===pi&&!w.cut&&Number.isInteger(w.v)),values=[...new Set(own.map(w=>w.v))].sort((a,b)=>(b===2?2:b===4?1:0)-(a===2?2:a===4?1:0));
   for(const value of values){if(BB.soloOk(G,pi,value)){a={a:'solo',val:value};break;}const target=G.wires.find(w=>w.o===actor&&w.o!==pi&&!w.cut&&w.v===value)||G.wires.find(w=>w.o!==pi&&!w.cut&&w.v===value);if(target){a={a:'dual',w:target.id,val:value};break;}}
  }assert(a);assert.equal(BB.act(G,pi,a),null);
 }
 while(G.pending){const pi=G.pending.to;assert.equal(BB.act(G,pi,{a:'resolve',id:G.pending.id,w:BB.view(G,pi).pending.choices[0]}),null);}
 const w=G.wires.find(w=>w.o===actor&&w.v===4&&w.cut);assert(w);G.catalog=G.mission.catalog='campaign';fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'bb-'+code.toLowerCase()+'.json'),JSON.stringify({version:1,name:'bb-'+code.toLowerCase(),host:seats[0].pid,mid:40,ruleset:'campaign',attempts:1,started:true,seats,observers:[],revision:0,seen:[],G}),{mode:0o600});return {code,seats,id:w.id};
}
(async()=>{const browser=await chromium.launch({executablePath:'/snap/bin/chromium',headless:true,args:['--no-sandbox']}),errors=[];try{for(let n=2;n<=5;n++)for(const actor of [0,1]){const data=fixture(n,actor),pages=[],contexts=[];let threeD=true;try{
        for (let pi = 0; pi < n; pi++) {
          const context = await browser.newContext({ viewport: { width: 375, height: 820 }, reducedMotion: 'reduce' }); contexts.push(context);
          await context.addInitScript(({ code, seat }) => {
            localStorage.setItem('bb_name', JSON.stringify(seat.name)); localStorage.setItem('bb_pid', JSON.stringify(seat.pid)); localStorage.setItem('bb_officialCredentials', JSON.stringify({ [code]: seat.credential })); if (localStorage.getItem('bb_view3d') === null) localStorage.setItem('bb_view3d', 'true');
            const Socket = window.WebSocket; window.WebSocket = class extends Socket { constructor(...args) { super(...args); this.addEventListener('message', e => { try { const m = JSON.parse(e.data); if (m.topic === 'official:view') { window.testView = m.data.view; window.testRevision = m.data.revision; } } catch (_) {} }); } };
          }, { code: data.code, seat: data.seats[pi] });
          const page = await context.newPage(); pages.push(page); page.on('pageerror', e => errors.push(e.message)); await page.route('https://fonts.googleapis.com/**', r => r.abort()); await page.goto(base, { waitUntil: 'domcontentloaded' }); await page.locator('#nm').fill(data.seats[pi].name); await page.locator('#jcode').fill(data.code); await page.locator('#btn-join').click(); await page.waitForFunction(() => window.testView?.official?.module === 'mixed-clues');
        }
        const host = pages[0];
        async function sync() { const r = Math.max(...await Promise.all(pages.map(p => p.evaluate(() => window.testRevision)))); await Promise.all(pages.map(p => p.waitForFunction(r => window.testRevision >= r, r))); }
        async function views() { await sync(); return Promise.all(pages.map(p => p.evaluate(() => window.testView))); }
        async function advance(f) { await sync(); const r = await host.evaluate(() => window.testRevision); await f(); await host.waitForFunction(r => window.testRevision > r, r); await sync(); }
        async function wire(pi, id) { await pages[pi].locator('#scr-game ' + (threeD ? '.slot.can' : '.tile.can') + '[data-w="' + id + '"]').click(); }
        async function toggle() { for (const p of pages) await p.locator('#scr-game [data-act=view]').click(); threeD = !threeD; }
for(let mode=0;mode<2;mode++){for(const p of pages){assert.equal(await p.locator('.mixed-clue-tag').count(),n);assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));}await toggle();}
 await pages[actor].locator('[data-act=eq][data-n="4"]').click();for(let mode=0;mode<2;mode++){assert((await pages[actor].locator('.act').innerText()).includes(actor===0?'频率标记':'奇偶标记'));assert((await pages[actor].locator('.act').innerText()).includes('已剪蓝线'));await toggle();}
 await wire(actor,data.id);await advance(()=>pages[actor].locator('[data-act=eqgo]').click());let V=(await views())[actor],info=V.players[actor].stands.flat().find(w=>w.id===data.id).info;assert(info);assert.equal(info.t,actor===0?'freq':'even');
 await pages[actor].reload({waitUntil:'domcontentloaded'});await pages[actor].locator('#jcode').fill(data.code);await pages[actor].locator('#btn-join').click();await pages[actor].waitForFunction(()=>window.testView?.official?.module==='mixed-clues');V=await pages[actor].evaluate(()=>window.testView);assert.equal(V.players[actor].stands.flat().find(w=>w.id===data.id).info.t,info.t);
 // 使用各玩家自己的视角汇总测试真值；网页操作仍由相应座位发出。
 let allViews=await views(),pi=allViews[0].turn;
 const hand=allViews[pi].players[pi].stands.flat().filter(w=>!w.cut&&BB.kindOf(w)==='b');
 const declared=hand[0].v;
 const targets=allViews.flatMap((v,owner)=>v.players[owner].stands.flat().map(w=>({...w,owner}))).filter(w=>w.owner!==pi&&!w.cut&&BB.kindOf(w)==='b'&&w.v!==declared);
 assert(targets.length);const target=targets.find(w=>w.owner===actor)||targets[0],beforeDet=allViews[0].det;
 if(actor===1)await toggle();
 await wire(pi,target.id);await advance(()=>pages[pi].locator('[data-act=val][data-v="'+declared+'"]').click());
 for(const p of pages)assert.equal(await p.locator('.declared-target').count(),1);
 await advance(()=>pages[target.owner].locator('[data-act=resolve-target]').click());
 allViews=await views();assert.equal(allViews[0].det,beforeDet+1);assert.equal(allViews[0].pending,null);
 const targetInfo=allViews[0].players[target.owner].stands.flat().find(w=>w.id===target.id).info;
 assert(targetInfo);assert.equal(targetInfo.t,target.owner%2===0?'freq':target.v%2?'odd':'even');
 // 对讲机在原猜测者的非当前回合发起；队友用刚附着失败标记的线回应。
 assert.notEqual(allViews[0].turn,pi);const exchangeTurn=allViews[0].turn;
 const offered=allViews[pi].players[pi].stands.flat().find(w=>!w.cut&&BB.kindOf(w)==='b');assert(offered);
 const offeredRack=allViews[pi].players[pi].stands.findIndex(r=>r.some(w=>w.id===offered.id));
 const targetRack=allViews[target.owner].players[target.owner].stands.findIndex(r=>r.some(w=>w.id===target.id));
 await pages[pi].locator('[data-act=eq][data-n="2"]').click();await wire(pi,offered.id);
 await advance(()=>pages[pi].locator('[data-act=eqp][data-p="'+target.owner+'"]').click());
 allViews=await views();assert.equal(allViews[0].pending.type,'walkie');const decisionId=allViews[0].pending.id;
 await pages[target.owner].reload({waitUntil:'domcontentloaded'});await pages[target.owner].locator('#jcode').fill(data.code);await pages[target.owner].locator('#btn-join').click();
 await pages[target.owner].waitForFunction(id=>window.testView?.pending?.id===id,decisionId);
 await advance(()=>wire(target.owner,target.id));allViews=await views();assert.equal(allViews[0].pending,null);assert.equal(allViews[0].turn,exchangeTurn);
 for(const view of allViews){
  const incoming=view.players[pi].stands[offeredRack].find(w=>w.id===target.id),returned=view.players[target.owner].stands[targetRack].find(w=>w.id===offered.id);
  assert(incoming&&returned);assert(!incoming.info&&!returned.info);assert(view.equip.find(e=>e.n===2).used);
  assert.deepEqual(view.official.clueKinds,Array.from({length:n},(_,i)=>i%2?'parity':'frequency'));
 }
 for(const owner of [pi,target.owner])for(const rack of allViews[owner].players[owner].stands){const values=rack.map(w=>w.v);assert(values.every((v,i)=>!i||values[i-1]<=v));}
 console.log('✓ 第40关开发版'+n+'人：非回合对讲机、回应中刷新、交换线标记丢弃、原线架重排及固定类型通过');
 // 双人局继续经真实网页按钮完成任务，覆盖失败后的回合推进、公开红线和最终胜利。
 if(n===2)for(let k=0;k<160&&(V=(await views())[0]).phase==='play';k++){
  const vv=await views(),who=V.turn,own=vv[who].players[who].stands.flat().filter(w=>!w.cut);
  if(own.every(w=>BB.kindOf(w)==='r')){await advance(()=>pages[who].locator('[data-act=red]').click());continue;}
  const value=own.find(w=>BB.kindOf(w)==='b').v;
  const matching=vv.flatMap((v,owner)=>v.players[owner].stands.flat().map(w=>({...w,owner}))).find(w=>w.owner!==who&&!w.cut&&w.v===value);
  if(!matching){await advance(()=>pages[who].locator('[data-act=solo][data-v="'+value+'"]').click());continue;}
  await wire(who,matching.id);await advance(()=>pages[who].locator('[data-act=val][data-v="'+value+'"]').click());
  await advance(()=>pages[matching.owner].locator('[data-act=resolve-target]').click());const choices=(await views())[who].pending.choices;await advance(()=>wire(who,choices.at(-1)));
 }
 if(n===2)assert.equal((await views())[0].phase,'won');
 console.log('✓ 第40关开发版'+n+'人：公开猜测及错误回应、目标所属信息类型、失误推进'+(n===2?'与真实网页完整通关':''));
 console.log('✓ 第40关开发版'+n+'人：手机双视图固定类型、'+(actor===0?'频率':'奇偶')+'便利贴标已剪蓝线及刷新恢复通过');
 }finally{for(const c of contexts)await c.close();}}assert.deepEqual(errors,[]);}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
