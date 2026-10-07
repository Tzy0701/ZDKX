const assert = require('assert'), fs = require('fs'), path = require('path'), BB = require('../js/engine'), M = require('../js/missions');
const { chromium } = require(process.env.BB_PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.BB_BROWSER_URL || 'http://127.0.0.1:9123', dir = process.env.BB_TEST_DATA_DIR || '/tmp/bb39-browser-data';
if (!/^http:\/\/(127\.0\.0\.1|localhost):/.test(base) || !dir.startsWith('/tmp/')) throw new Error('只允许隔离本机测试');
function rng(seed) { return () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296); }
function fixture(n,wrong) {
 const code='P'+Date.now().toString(36).slice(-4).toUpperCase()+n,seats=Array.from({length:n},(_,i)=>({pid:code+'-p'+i,name:'奖励玩家'+i,credential:code+'-凭证'+i,bot:false}));
 let G,duplicateId;
 if(process.env.BB_DUPLICATE_ONLY){
  const C=require('../js/campaign-rules');
  for(let seed=1;seed<=1000;seed++){
   G=BB.createGame(M.get('official-development',39),seats,{captain:0,rng:rng(seed*104729)});const expected=G.officialState.precision.deck[0];
   while(G.phase==='setup'){const pi=G.pending.to,pd=BB.view(G,pi).pending;assert.equal(BB.act(G,pi,{a:'initial-clue',id:pd.id,w:pd.choices.length?pd.choices.at(-1):null,rack:0},{rng:()=>0.371}),null);}
   const w=G.wires.find(w=>w.o===0&&w.v===expected&&w.info?.t==='v'&&w.info.v===expected);if(w&&C.availableInfoTokens(G,false).some(t=>t.value===expected)){duplicateId=w.id;break;}
  }assert(duplicateId!=null,'未找到来源合法双枚场景');
 }else G=BB.createGame(M.get('official-development',39),seats,{captain:0,rng:rng(n*104729)});
 const value=G.officialState.precision.value,ids=G.wires.filter(w=>w.v===value).map(w=>w.id);
 if(wrong)ids[0]=G.wires.find(w=>w.v!==value).id;
 G.catalog=G.mission.catalog='campaign';fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'bb-'+code.toLowerCase()+'.json'),JSON.stringify({version:1,name:'bb-'+code.toLowerCase(),host:seats[0].pid,mid:39,ruleset:'campaign',attempts:1,started:true,seats,observers:[],revision:0,seen:[],G}),{mode:0o600});return {code,seats,ids,value,duplicateId};
}
(async () => {
  const browser = await chromium.launch({ executablePath: '/snap/bin/chromium', headless: true, args: ['--no-sandbox'] }), errors = [];
  try {
    for (const n of (process.env.BB_DUPLICATE_ONLY?[2]:[2,3,4,5])) for(const wrong of (process.env.BB_DUPLICATE_ONLY?[false]:[false,true])) {
      const data = fixture(n,wrong), pages = [], contexts = []; let threeD = true;
      try {
        for (let pi = 0; pi < n; pi++) {
          const context = await browser.newContext({ viewport: { width: 375, height: 820 }, reducedMotion: 'reduce' }); contexts.push(context);
          await context.addInitScript(({ code, seat }) => {
            localStorage.setItem('bb_name', JSON.stringify(seat.name)); localStorage.setItem('bb_pid', JSON.stringify(seat.pid)); localStorage.setItem('bb_officialCredentials', JSON.stringify({ [code]: seat.credential })); if (localStorage.getItem('bb_view3d') === null) localStorage.setItem('bb_view3d', 'true');
            const Socket = window.WebSocket; window.WebSocket = class extends Socket { constructor(...args) { super(...args); this.addEventListener('message', e => { try { const m = JSON.parse(e.data); if (m.topic === 'official:view') { window.testView = m.data.view; window.testRevision = m.data.revision; } } catch (_) {} }); } };
          }, { code: data.code, seat: data.seats[pi] });
          const page = await context.newPage(); pages.push(page); page.on('pageerror', e => errors.push(e.message)); await page.route('https://fonts.googleapis.com/**', r => r.abort()); await page.goto(base, { waitUntil: 'domcontentloaded' }); await page.locator('#nm').fill(data.seats[pi].name); await page.locator('#jcode').fill(data.code); await page.locator('#btn-join').click(); await page.waitForFunction(() => window.testView?.official?.module === 'precision-number-rewards');
        }
        const host = pages[0];
        async function sync() { const r = Math.max(...await Promise.all(pages.map(p => p.evaluate(() => window.testRevision)))); await Promise.all(pages.map(p => p.waitForFunction(r => window.testRevision >= r, r))); }
        async function views() { await sync(); return Promise.all(pages.map(p => p.evaluate(() => window.testView))); }
        async function advance(f) { await sync(); const r = await host.evaluate(() => window.testRevision); await f(); await host.waitForFunction(r => window.testRevision > r, r); await sync(); }
        async function wire(pi, id) { await pages[pi].locator('#scr-game ' + (threeD ? '.slot.can' : '.tile.can') + '[data-w="' + id + '"]').click(); }
        async function toggle() { for (const p of pages) await p.locator('#scr-game [data-act=view]').click(); threeD = !threeD; }
        let initial=await views();assert.equal(initial[0].official.precision.value,data.value);assert.equal(initial[0].equip.length,0);
        while((await views())[0].phase==='setup'){const v=await views(),pd=v[0].pending,pi=pd.to;const choice=v[pi].pending.choices.at(-1);await advance(()=>choice==null?pages[pi].locator('[data-act=initial-clue-aside][data-rack="0"]').click():wire(pi,choice));}
        await host.locator('[data-act=precision-start]').click();for(const id of data.ids)await wire(0,id);
        for(let mode=0;mode<2;mode++){assert.equal(await host.locator('[data-act=precision-submit]:enabled').count(),1);await toggle();}
        await advance(()=>host.locator('[data-act=precision-submit]').click());
        await advance(()=>host.locator('[data-act=host-pause]').click());assert((await views())[0].paused);await advance(()=>host.locator('[data-act=host-pause]').click());
        let reloaded=false;
        while((await views())[0].pending?.type==='precision-cut'){const v=await views(),pd=v[0].pending;assert.equal(pd.type,'precision-cut');for(let pi=0;pi<n;pi++){assert.equal('ownAnswers'in v[pi].pending,pi===pd.to);assert.equal(await pages[pi].locator('.declared-target').count(),4);}
          if(!reloaded){const p=pages[pd.to];await p.reload({waitUntil:'domcontentloaded'});await p.locator('#jcode').fill(data.code);await p.locator('#btn-join').click();await p.waitForFunction(id=>window.testView?.pending?.id===id,pd.id);reloaded=true;}
          await advance(()=>pages[pd.to].locator('[data-act=precision-reply]').click());
        }
        let rewardReloaded=false;
        while((await views())[0].pending?.type==='precision-clue'){
          let vv=await views(),pd=vv[0].pending;for(let pi=0;pi<n;pi++){assert.equal('choices'in vv[pi].pending,pi===pd.to);assert(!('distributed'in vv[pi].official.precision));const cards=vv[pi].official.precision.assignedNumbers;assert(Array.isArray(cards));assert((await pages[pi].locator('.act').innerText()).includes(cards.join('、')));}const assigned=vv.map(v=>v.official.precision.assignedNumbers).flat();assert.equal(new Set(assigned).size,assigned.length);
          for(let mode=0;mode<2;mode++){assert((await pages[pd.to].locator('.act').innerText()).includes('奖励线索'));await toggle();}
          if(!rewardReloaded){const p=pages[pd.to];await p.reload({waitUntil:'domcontentloaded'});await p.locator('#jcode').fill(data.code);await p.locator('#btn-join').click();await p.waitForFunction(id=>window.testView?.pending?.id===id,pd.id);rewardReloaded=true;}
          const offered=(await views())[pd.to].pending.choices,id=offered.includes(data.duplicateId)?data.duplicateId:offered.at(-1);await advance(()=>wire(pd.to,id));
          if(id===data.duplicateId){const info=(await views())[pd.to].players[pd.to].stands.flat().find(w=>w.id===id).info;assert.equal(info.copies,2);for(let mode=0;mode<2;mode++){const token=pages[pd.to].locator('#scr-game '+(threeD?'.slot':'.tile')+'[data-w="'+id+'"] '+(threeD?'.tok3':'.tok'));assert.equal(await token.innerText(),info.v+'＋'+info.v);await toggle();}console.log('✓ 第39关来源合法同线双枚奖励在手机二维／三维均显示两枚标记');}

        }
        let v=await views();assert.equal(v[0].official.precision.complete,!wrong);assert.equal(v[0].det,0);
        if(wrong){assert.equal(v[0].phase,'lost');assert(v[0].equip.every(e=>e.hidden));for(const id of data.ids)assert(v[0].players.some(p=>p.stands.flat().some(w=>w.id===id&&!w.cut)));assert((await host.locator('.target-notice').innerText()).includes('炸弹爆炸'));}
        else {assert(v[0].equip.every(e=>!e.hidden&&e.open));for(const id of data.ids)assert(v[0].players.some(p=>p.stands.flat().some(w=>w.id===id&&w.cut)));}
        // 全信息参考求解仅用各客户端自身手牌汇总真值，动作仍经真实网页与服务端。
        if(!wrong && n===2)for(let k=0;k<180&&(v=await views())[0].phase==='play';k++){
          const V=v[0],who=V.turn,own=v[who].players[who].stands.flat().filter(w=>!w.cut);
          if(own.every(w=>BB.kindOf(w)==='r')){await advance(()=>pages[who].locator('[data-act=red]').click());continue;}
          const value=BB.annOf(own.find(w=>BB.kindOf(w)!=='r')),target=v.flatMap((view,owner)=>view.players[owner].stands.flat().map(w=>({...w,owner}))).find(w=>w.owner!==who&&!w.cut&&BB.matches(w,value));
          if(!target){await advance(()=>pages[who].locator('[data-act=solo][data-v="'+value+'"]').click());continue;}
          await wire(who,target.id);await advance(()=>pages[who].locator('[data-act=val][data-v="'+value+'"]').click());await advance(()=>pages[target.owner].locator('[data-act=resolve-target]').click());const choices=(await views())[who].pending.choices;await advance(()=>wire(who,choices.at(-1)));
        }
        if(!wrong && n===2)assert.equal((await views())[0].phase,'won');
        console.log('✓ 第39关开发版'+n+'人：手机双视图四线选择、公共箭头、私人回应、暂停与刷新恢复；'+(wrong?'错误立即爆炸且不剪任何选中线':n===2?'真实网页完整通关':'正确拆除并摆放顺时针奖励'));
      } finally { for (const context of contexts) await context.close(); }
    }
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
