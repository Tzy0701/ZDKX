// 第54关内部传氧事件的隔离浏览器验收；不启动尚未核实的录音时间轴。
const assert=require('assert'),fs=require('fs'),path=require('path'),BB=require('../js/engine'),M=require('../js/missions');
const {chromium}=require(process.env.BB_PLAYWRIGHT_MODULE||'playwright');
const base=process.env.BB_BROWSER_URL||'http://127.0.0.1:9123',dir=process.env.BB_TEST_DATA_DIR||'/tmp/bb54-test-data';
const eventTypes=process.env.BB_SUBMARINE_EVENT?[process.env.BB_SUBMARINE_EVENT]:['transfer','leak','shortage','panic'];
if(eventTypes.some(t=>!['transfer','leak','shortage','panic'].includes(t)))throw Error('未知的潜艇测试场景');
if(!/^http:\/\/(127\.0\.0\.1|localhost):/.test(base)||!dir.startsWith('/tmp/'))throw Error('开发夹具仅允许隔离本机服务器');
function rng(seed){return()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);}
function fixture(n,eventType){
 const code='U'+Date.now().toString(36).slice(-4).toUpperCase()+n,seats=Array.from({length:n},(_,i)=>({pid:code+'p'+i,name:'潜艇玩家'+i,credential:code+'凭据'+i,bot:false}));
 const G=BB.createGame(M.get('official-development',54),seats,{rng:rng(n+13),captain:0});
 while(G.phase==='setup'){const p=BB.setupActor(G),w=G.wires.find(w=>w.o===p&&BB.setupInfoAllowed(G,w));assert.equal(BB.act(G,p,{a:'info',w:w.id}),null);}
 G.officialState.submarine54.audioReady=true;G.phase='play';
 const own=G.wires.find(w=>w.o===0&&w.v<=4&&G.wires.some(t=>t.o===1&&t.v===w.v));assert(own,'夹具需要1–4的蓝线，扣费后仍能给氧');const target=G.wires.find(w=>w.o===1&&w.v===own.v);
 if(eventType==='shortage'){const state=BB.submarine54(G);state.reserve+=state.balances[0];state.balances[0]=0;}
 else{assert.equal(BB.act(G,0,{a:'dual',w:target.id,val:own.v}),null);assert.equal(BB.act(G,1,{a:'resolve',id:G.pending.id,w:target.id}),null);}
 const decision=G.pending?.id,balance=BB.submarine54(G).balances.slice(),reserve=BB.submarine54(G).reserve;
 if(eventType!=='shortage')assert.equal(BB.applySubmarineEvent(G,{gid:G.gid,index:0,type:eventType},{serverAudio:true}),null);
 const redValue=eventType==='leak'?(G.pending.type==='submarine-red'?G.pending.value:G.wires.at(-1).v):null;
 G.catalog=G.mission.catalog='campaign';fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'bb-'+code.toLowerCase()+'.json'),JSON.stringify({version:1,name:'bb-'+code.toLowerCase(),host:seats[0].pid,mid:54,ruleset:'campaign',attempts:1,started:true,seats,observers:[],revision:0,seen:[],G}),{mode:0o600});
 return {code,seats,own:own.id,target:target.id,decision,balance,reserve,redValue,eventType};
}
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.BB_CHROMIUM||'/snap/bin/chromium',headless:true,args:['--no-sandbox']}),errors=[];
 try{for(const eventType of eventTypes)for(const n of [2,3,4,5]){const data=fixture(n,eventType),contexts=[],pages=[];
 try{
  for(let i=0;i<=n;i++){
   const context=await browser.newContext({viewport:{width:375,height:820},reducedMotion:'reduce'});contexts.push(context);
   await context.addInitScript(({code,seat})=>{localStorage.setItem('bb_view3d','true');if(seat){localStorage.setItem('bb_pid',JSON.stringify(seat.pid));localStorage.setItem('bb_officialCredentials',JSON.stringify({[code]:seat.credential}));}const Socket=window.WebSocket;window.WebSocket=class extends Socket{constructor(...args){super(...args);this.addEventListener('message',e=>{try{const m=JSON.parse(e.data);if(m.topic==='official:view'){window.testView=m.data.view;window.testRevision=m.data.revision;}}catch(_){}});}};},{code:data.code,seat:data.seats[i]});
   const page=await context.newPage();pages.push(page);page.on('pageerror',e=>errors.push(e.message));await page.route('https://fonts.googleapis.com/**',r=>r.abort());await page.goto(base,{waitUntil:'domcontentloaded'});await page.locator('#nm').fill(data.seats[i]?.name||'潜艇观众');await page.locator('#jcode').fill(data.code);await page.locator('#btn-join').click();await page.waitForFunction(()=>window.testView?.official?.module==='submarine-audio');
  }
  if(eventType==='panic'){
   for(let mode=0;mode<2;mode++){for(const page of pages){assert((await page.locator('.submarine-repeat').innerText()).includes('潜艇玩家0'));assert((await page.locator('.submarine-repeat').innerText()).includes('仍按正常费用耗氧'));assert(await page.locator('.target-arrow').count()>0);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));}if(mode===0)for(const page of pages)await page.locator('#scr-game [data-act="view"]').click();}
   await pages[0].reload({waitUntil:'domcontentloaded'});await pages[0].locator('#jcode').fill(data.code);await pages[0].locator('#btn-join').click();await pages[0].waitForFunction(()=>window.testView?.official?.submarine54?.repeatTurn?.owner===0);assert.equal((await pages[0].evaluate(()=>window.testView)).pending.id,data.decision);
   await pages[0].locator('#scr-game .slot.can[data-w="'+data.own+'"]').click();await Promise.all(pages.map(page=>page.waitForFunction(()=>!window.testView.pending&&!window.testView.official.submarine54.repeatTurn)));
   const views=await Promise.all(pages.slice(0,n).map(page=>page.evaluate(()=>window.testView))),V=views[0];assert.equal(V.turn,0);assert.deepEqual(V.official.submarine54.balances,data.balance);assert.equal(await pages[0].locator('.submarine-repeat').count(),0);assert((await pages[0].locator('.turn-notice').innerText()).includes('轮到你'));
   const all=views.flatMap((v,p)=>v.players[p].stands.flat().map(w=>({...w,o:p}))),own=V.players[0].stands.flat().find(w=>!w.cut&&Number.isInteger(w.v)&&BB.oxygenCost(w.v)<=V.official.submarine54.balances[0]&&all.some(t=>t.o!==0&&!t.cut&&t.v===w.v));assert(own,'连续回合应有正常付费动作');const target=all.find(w=>w.o!==0&&!w.cut&&w.v===own.v);
   await pages[0].locator('#scr-game .slot.can[data-w="'+target.id+'"]').click();await pages[0].locator('[data-act="val"][data-v="'+own.v+'"]').click();await pages[0].waitForFunction(()=>window.testView.pending?.step==='target');assert.equal((await pages[0].evaluate(()=>window.testView)).official.submarine54.balances[0],data.balance[0]-BB.oxygenCost(own.v));
   await pages[target.o].waitForFunction(()=>window.testView.pending?.step==='target');await pages[target.o].locator('[data-act="resolve-target"]').click();await pages[0].waitForFunction(()=>window.testView.pending?.step==='own');await pages[0].locator('#scr-game .slot.can[data-w="'+own.id+'"]').click();await Promise.all(pages.map(page=>page.waitForFunction(()=>!window.testView.pending&&window.testView.turn!==0)));
   console.log('✓ 第54关'+n+'人375像素双视图：连续行动公开提示／原箭头、私人步骤刷新恢复、同人接班通知、第二回合正常扣氧且随后轮转，观战同步只读');continue;
  }
  if(eventType==='shortage'){
   for(let mode=0;mode<2;mode++){
    for(const page of pages){assert((await page.locator('.submarine-panel').innerText()).includes('潜艇玩家0：0 枚'));assert((await page.locator('.submarine-panel').innerText()).includes('5–8耗2枚'));assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));}
    assert(await pages[0].locator('[data-act="submarine-skip"]').isEnabled());
    await pages[0].locator('#scr-game '+(mode===0?'.slot.can':'.tile.can')+'[data-w="'+data.target+'"]').click();
    const buttons=pages[0].locator('[data-act="val"]');assert(await buttons.count()>0);assert.equal(await buttons.evaluateAll(bs=>bs.every(b=>b.disabled)),true);assert.equal(await buttons.first().getAttribute('title').then(t=>t.includes('当前不足')),true);
    if(mode===0)for(const page of pages)await page.locator('#scr-game [data-act="view"]').click();
   }
   await pages[0].locator('[data-act="submarine-skip"]').click();await Promise.all(pages.map(page=>page.waitForFunction(()=>window.testView.turn===1&&window.testView.det===1)));
   assert(await pages[1].locator('[data-act="submarine-skip"]').isDisabled());assert.equal(await pages.at(-1).locator('[data-act="submarine-skip"]').count(),0);
   console.log('✓ 第54关'+n+'人375像素双视图：公开个人余额／分段费用、零氧宣告禁用与理由、合法缺氧跳过罚一次、足氧玩家不能省氧跳过、观众无操作');continue;
  }
  if(eventType==='leak'){
   const privateRack=n<=3;
   for(let mode=0;mode<2;mode++){
    for(let i=0;i<pages.length;i++){const page=pages[i],V=await page.evaluate(()=>window.testView);assert.equal(V.official.submarine54.redRemaining,10);assert(!('redReserve' in V.official.submarine54));assert.equal('drawn' in V.pending,privateRack&&i===0);assert.equal(await page.locator('[data-act="submarine-red"]').count(),privateRack&&i===0?2:0);assert(await page.locator('.target-arrow').count()>0);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));if(privateRack){assert((await page.locator('.target-notice').innerText()).includes('本次拆线暂停'));assert((await page.locator('.submarine-panel').innerText()).includes('轮到 潜艇玩家0'));}else assert.equal(V.players[0].stands.flat().find(w=>w.id===48).v,i===0?data.redValue:null);}
    if(mode===0)for(const page of pages)await page.locator('#scr-game [data-act="view"]').click();
   }
   if(privateRack){await pages[0].reload({waitUntil:'domcontentloaded'});await pages[0].locator('#jcode').fill(data.code);await pages[0].locator('#btn-join').click();await pages[0].waitForFunction(()=>window.testView?.pending?.type==='submarine-red');assert.equal((await pages[0].evaluate(()=>window.testView)).pending.drawn.value,data.redValue);await pages[0].locator('[data-act="submarine-red"][data-rack="1"]').click();await Promise.all(pages.map(page=>page.waitForFunction(()=>window.testView?.pending?.step==='own')));}
   for(let i=0;i<pages.length;i++){const V=await pages[i].evaluate(()=>window.testView);assert.equal(V.pending.id,data.decision);assert.deepEqual(V.official.submarine54.balances,data.balance);assert.equal(V.official.submarine54.reserve,data.reserve);const added=V.players[0].stands.flat().find(w=>w.id===48);assert(added);assert.equal(added.v,i===0?data.redValue:null);if(i===0)for(const rack of V.players[0].stands)assert.deepEqual(rack.map(w=>w.v),rack.map(w=>w.v).sort((a,b)=>a-b));}
   await pages[0].locator('#scr-game '+(privateRack?'.slot.can':'.tile.can')+'[data-w="'+data.own+'"]').click();await Promise.all(pages.map(page=>page.waitForFunction(()=>!window.testView.pending&&window.testView.turn!==0)));assert.equal((await pages[0].evaluate(()=>window.testView)).det,0);
   console.log('✓ 第54关'+n+'人375像素双视图：红线备用隐藏、'+(privateRack?'私人值／两架选择刷新恢复':'单架自动插入')+'、数值排序、公开箭头保留、原选线继续且不重扣氧');
   continue;
  }
  for(let mode=0;mode<2;mode++){
   for(let i=0;i<pages.length;i++){const page=pages[i],V=await page.evaluate(()=>window.testView);assert.equal('choices' in V.pending,i===0);assert(!('redReserve' in V.official.submarine54));assert.equal(await page.locator('[data-act="submarine-transfer-pick"]').count(),i===0?2*(n-1):0);assert((await page.locator('.target-notice').innerText()).includes('本次拆线暂停'));assert(await page.locator('.target-arrow').count()>0);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));}
   await pages[0].locator('[data-act="submarine-transfer-pick"][data-p="1"][data-mode="give"]').click();await pages[0].locator('#submarine-transfer-amount').fill('999');assert.equal(await pages[0].locator('#submarine-transfer-amount').evaluate(e=>e.checkValidity()),false);
   if(mode===0)for(const page of pages)await page.locator('#scr-game [data-act="view"]').click();
  }
  await pages[0].reload({waitUntil:'domcontentloaded'});await pages[0].locator('#jcode').fill(data.code);await pages[0].locator('#btn-join').click();await pages[0].waitForFunction(()=>window.testView?.pending?.type==='submarine-transfer');
  await pages[0].locator('[data-act="submarine-transfer-pick"][data-p="1"][data-mode="give"]').click();await pages[0].locator('#submarine-transfer-amount').fill('1');await pages[0].locator('[data-act="submarine-transfer-confirm"]').click();
  await Promise.all(pages.map(page=>page.waitForFunction(()=>window.testView?.pending?.step==='own')));
  for(const page of pages){const V=await page.evaluate(()=>window.testView);assert.equal(V.pending.id,data.decision);assert.equal(V.official.submarine54.reserve,data.reserve);assert.deepEqual(V.official.submarine54.balances,data.balance.map((v,i)=>v+(i===0?-1:i===1?1:0)));assert.equal(V.players[1].stands.flat().find(w=>w.id===data.target).v,V.pending.vals[0]);}
  await pages[0].locator('#scr-game .slot.can[data-w="'+data.own+'"]').click();await Promise.all(pages.map(page=>page.waitForFunction(()=>!window.testView.pending&&window.testView.turn!==0)));assert.equal((await pages[0].evaluate(()=>window.testView)).det,0);
  console.log('✓ 第54关'+n+'人375像素双视图：传氧菜单仅本人／观众屏蔽、当前宣告与箭头保留、数量验证、刷新重连、给氧后恢复原决定并完成拆线、不重扣费');
 }finally{for(const c of contexts)await c.close();}
 }assert.deepEqual(errors,[]);}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
