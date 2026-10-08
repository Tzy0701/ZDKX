const assert = require('assert'), fs = require('fs'), path = require('path'), BB = require('../js/engine'), M = require('../js/missions');
const { chromium } = require(process.env.BB_PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.BB_BROWSER_URL || 'http://127.0.0.1:9123', dir = process.env.BB_TEST_DATA_DIR || '/tmp/bb41-browser-data';
if (!/^http:\/\/(127\.0\.0\.1|localhost):/.test(base) || !dir.startsWith('/tmp/')) throw new Error('只允许隔离本机测试');
function rng(seed) { return () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296); }
function fixture(n,color) {
 const code='T'+Date.now().toString(36).slice(-4).toUpperCase()+n,seats=Array.from({length:n},(_,i)=>({pid:code+'-p'+i,name:'绊线玩家'+i,credential:code+'-凭证'+i,bot:false}));let G,target;
 for(let seed=1;seed<=500;seed++){G=BB.createGame(M.get('official-development',41),seats,{captain:0,rng:rng(seed*104729)});target=G.wires.find(w=>w.o!==0&&BB.kindOf(w)===color);if(target)break;}assert(target);
 G.catalog=G.mission.catalog='campaign';fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'bb-'+code.toLowerCase()+'.json'),JSON.stringify({version:1,name:'bb-'+code.toLowerCase(),host:seats[0].pid,mid:41,ruleset:'campaign',attempts:1,started:true,seats,observers:[],revision:0,seen:[],G}),{mode:0o600});return {code,seats,target};
}
(async () => {
  const browser = await chromium.launch({ executablePath: '/snap/bin/chromium', headless: true, args: ['--no-sandbox'] }), errors = [];
  try {
    for (const n of [2,3,4,5]) for(const color of ['y','b','r']) {
      const data = fixture(n,color), pages = [], contexts = []; let threeD = true;
      try {
        for (let pi = 0; pi < n; pi++) {
          const context = await browser.newContext({ viewport: { width: 375, height: 820 }, reducedMotion: 'reduce' }); contexts.push(context);
          await context.addInitScript(({ code, seat }) => {
            localStorage.setItem('bb_name', JSON.stringify(seat.name)); localStorage.setItem('bb_pid', JSON.stringify(seat.pid)); localStorage.setItem('bb_officialCredentials', JSON.stringify({ [code]: seat.credential })); if (localStorage.getItem('bb_view3d') === null) localStorage.setItem('bb_view3d', 'true');
            const Socket = window.WebSocket; window.WebSocket = class extends Socket { constructor(...args) { super(...args); this.addEventListener('message', e => { try { const m = JSON.parse(e.data); if (m.topic === 'official:view') { window.testView = m.data.view; window.testRevision = m.data.revision; } } catch (_) {} }); } };
          }, { code: data.code, seat: data.seats[pi] });
          const page = await context.newPage(); pages.push(page); page.on('pageerror', e => errors.push(e.message)); await page.route('https://fonts.googleapis.com/**', r => r.abort()); await page.goto(base, { waitUntil: 'domcontentloaded' }); await page.locator('#nm').fill(data.seats[pi].name); await page.locator('#jcode').fill(data.code); await page.locator('#btn-join').click(); await page.waitForFunction(() => window.testView?.official?.module === 'tripwire');
        }
        const host = pages[0];
        async function sync() { const r = Math.max(...await Promise.all(pages.map(p => p.evaluate(() => window.testRevision)))); await Promise.all(pages.map(p => p.waitForFunction(r => window.testRevision >= r, r))); }
        async function views() { await sync(); return Promise.all(pages.map(p => p.evaluate(() => window.testView))); }
        async function advance(f) { await sync(); const r = await host.evaluate(() => window.testRevision); await f(); await host.waitForFunction(r => window.testRevision > r, r); await sync(); }
        async function wire(pi, id) { await pages[pi].locator('#scr-game ' + (threeD ? '.slot.can' : '.tile.can') + '[data-w="' + id + '"]').click(); }
        async function toggle() { for (const p of pages) await p.locator('#scr-game [data-act=view]').click(); threeD = !threeD; }
        let initial=await views();assert.equal(initial[0].det,0);assert.equal(initial[0].detMax,1);assert.equal(initial[0].detMin,-4);
        while((await views())[0].phase==='setup'){const v=await views(),pd=v[0].pending,pi=pd.to,choice=v[pi].pending.choices.at(-1);await advance(()=>choice==null?pages[pi].locator('[data-act=initial-clue-aside][data-rack="0"]').click():wire(pi,choice));}
        for(let mode=0;mode<2;mode++){assert.equal(await host.locator('[data-act=val][data-v="Y"]:enabled').count(),0);assert.equal(await host.locator('[data-act=tripwire-start]').count(),1);await toggle();}
        await host.locator('[data-act=tripwire-start]').click();await wire(0,data.target.id);for(let mode=0;mode<2;mode++){assert((await host.locator('.act').innerText()).includes('不能使用稳定器'));await toggle();}
        await advance(()=>host.locator('[data-act=tripwire-submit]').click());let v=await views(),decision=v[0].pending.id;
        for(let pi=0;pi<n;pi++){assert.equal('ownAnswers'in v[pi].pending,pi===data.target.o);assert.equal(await pages[pi].locator('.declared-target').count(),1);}
        await advance(()=>host.locator('[data-act=host-pause]').click());assert((await views())[0].paused);await advance(()=>host.locator('[data-act=host-pause]').click());
        const responder=pages[data.target.o];await responder.reload({waitUntil:'domcontentloaded'});await responder.locator('#jcode').fill(data.code);await responder.locator('#btn-join').click();await responder.waitForFunction(id=>window.testView?.pending?.id===id,decision);await advance(()=>responder.locator('[data-act=tripwire-reply]').click());v=await views();
        if(color==='y'){
          assert.equal(v[0].det,-1);assert.equal(v[0].phase,'play');assert.equal(v[0].players.flatMap(p=>p.stands.flat()).filter(w=>w.cut).length,1);
          for(let mode=0;mode<2;mode++){for(const p of pages)assert((await p.locator('#scr-game '+(threeD?'.slot':'.tile')+'[data-w="'+data.target.id+'"]').getAttribute('aria-label')).includes('已安全处理'));await toggle();}
        }else{assert.equal(v[0].phase,'lost');assert.equal(v[0].det,color==='b'?1:0);assert(!v[0].players.flatMap(p=>p.stands.flat()).some(w=>w.cut));}
        // 全信息参考操作经真实网页与服务端完成，只汇总每人自己的可见手牌。
        if(color==='y'&&n===2)for(let k=0;k<180&&(v=await views())[0].phase==='play';k++){
          const V=v[0],who=V.turn,all=v.flatMap((view,owner)=>view.players[owner].stands.flat().map(w=>({...w,owner}))),yellow=all.find(w=>w.owner!==who&&!w.cut&&BB.kindOf(w)==='y'),own=v[who].players[who].stands.flat().filter(w=>!w.cut);
          if(yellow){await pages[who].locator('[data-act=tripwire-start]').click();await wire(who,yellow.id);await advance(()=>pages[who].locator('[data-act=tripwire-submit]').click());await advance(()=>pages[yellow.owner].locator('[data-act=tripwire-reply]').click());continue;}
          if(own.every(w=>BB.kindOf(w)==='r')){await advance(()=>pages[who].locator('[data-act=red]').click());continue;}
          const value=own.find(w=>BB.kindOf(w)==='b').v,target=all.find(w=>w.owner!==who&&!w.cut&&w.v===value);
          if(!target){await advance(()=>pages[who].locator('[data-act=solo][data-v="'+value+'"]').click());continue;}
          await wire(who,target.id);await advance(()=>pages[who].locator('[data-act=val][data-v="'+value+'"]').click());await advance(()=>pages[target.owner].locator('[data-act=resolve-target]').click());const choices=(await views())[who].pending.choices;await advance(()=>wire(who,choices.at(-1)));
        }
        if(color==='y'&&n===2)assert.equal((await views())[0].phase,'won');
        console.log('✓ 第41关开发版'+n+'人：手机双视图、随机初始、固定起点、禁止普通黄线、公开目标、私人回应、暂停刷新恢复；'+(color==='y'?n===2?'安全处理并完整通关':'只处理一根黄线且退一格':color==='b'?'首错蓝线引爆':'选红立即爆炸'));
      } finally { for (const context of contexts) await context.close(); }
    }
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
