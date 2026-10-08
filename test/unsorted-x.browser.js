// 第20关只在隔离服务器验证来源设置，不把开发夹具写到公网。
const assert = require('assert'), fs = require('fs'), path = require('path');
const BB = require('../js/engine'), M = require('../js/missions');
const { chromium } = require(process.env.BB_PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.BB_BROWSER_URL || 'http://127.0.0.1:9123', dir = process.env.BB_TEST_DATA_DIR || '/tmp/bb20-test-data';
if (!/^http:\/\/(127\.0\.0\.1|localhost):/.test(base) || !dir.startsWith('/tmp/')) throw new Error('开发夹具只允许隔离本机服务器');
function rng(seed) { return () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296); }
function fixture(n) {
  const code = 'X' + Date.now().toString(36).slice(-4).toUpperCase() + n;
  const seats = Array.from({ length: n }, (_, i) => ({ pid: code + '-p' + i, name: 'X导线验收' + i, credential: '测试凭证-' + code + '-' + i, bot: false }));
  let G;
  for (let seed = 1; seed < 1000; seed++) {
    G = BB.createGame(M.get('official-development', 20), seats, { rng: rng(seed), captain: 0 });
    const x = G.wires.find(w => w.o === 0 && w.x);
    if (BB.kindOf(x) === 'b' && G.wires.some(w => w.o === 0 && !w.x && w.v === x.v) && G.wires.some(w => w.o !== 0 && !w.x && w.v === x.v) && G.wires.some(w => w.o !== 0 && w.x && BB.kindOf(w) === 'b' && G.wires.some(z => z.o === 0 && z.v === w.v))) break;
  }
  G.catalog = G.mission.catalog = 'campaign'; fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'bb-' + code.toLowerCase() + '.json'), JSON.stringify({ version: 1, name: 'bb-' + code.toLowerCase(), host: seats[0].pid, mid: 20, ruleset: 'campaign', attempts: 1, started: true, seats, observers: [], revision: 0, seen: [], G }), { mode: 0o600 });
  return { code, seats };
}
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.BB_CHROMIUM || '/snap/bin/chromium', headless: true, args: ['--no-sandbox'] }), errors = [];
  try {
    for (const n of [2, 3, 4, 5]) {
      const data = fixture(n), pages = [], contexts = []; let threeD = true, usedDetector = false, usedX = false, reconnected = false;
      try {
        for (let pi = 0; pi < n; pi++) {
          const context = await browser.newContext({ viewport: { width: 375, height: 820 }, reducedMotion: 'reduce' }); contexts.push(context);
          await context.addInitScript(({ code, seat }) => {
            localStorage.setItem('bb_name', JSON.stringify(seat.name)); localStorage.setItem('bb_pid', JSON.stringify(seat.pid)); localStorage.setItem('bb_officialCredentials', JSON.stringify({ [code]: seat.credential }));
            if (localStorage.getItem('bb_view3d') === null) localStorage.setItem('bb_view3d', 'true');
            const Socket = window.WebSocket; window.WebSocket = class extends Socket { constructor(...args) { super(...args); this.addEventListener('message', e => { try { const m = JSON.parse(e.data); if (m.topic === 'official:view') { window.testView = m.data.view; window.testRevision = m.data.revision; } } catch (_) {} }); } };
          }, { code: data.code, seat: data.seats[pi] });
          const page = await context.newPage(); pages.push(page); page.on('pageerror', e => errors.push(e.message));
          await page.route('https://fonts.googleapis.com/**', r => r.abort()); await page.goto(base, { waitUntil: 'domcontentloaded' }); await page.locator('#nm').fill(data.seats[pi].name); await page.locator('#jcode').fill(data.code); await page.locator('#btn-join').click(); await page.waitForFunction(() => window.testView?.official?.module === 'unsorted-x');
        }
        const host = pages[0];
        async function sync() { for (let k = 0; k < 10; k++) { const r = Math.max(...await Promise.all(pages.map(p => p.evaluate(() => window.testRevision)))); await Promise.all(pages.map(p => p.waitForFunction(r => window.testRevision >= r, r))); if ((await Promise.all(pages.map(p => p.evaluate(() => window.testRevision)))).every(x => x === r)) return; } throw new Error('客户端修订号持续不一致'); }
        async function views() { await sync(); return Promise.all(pages.map(p => p.evaluate(() => window.testView))); }
        async function advance(callback) { await sync(); const r = await host.evaluate(() => window.testRevision); await callback(); await host.waitForFunction(r => window.testRevision > r, r); await sync(); }
        function selector(id, can = true) { return '#scr-game ' + (threeD ? '.slot' : '.tile') + (can ? '.can' : '') + '[data-w="' + id + '"]'; }
        async function wire(pi, id) { await pages[pi].locator(selector(id)).click(); }
        async function toggle() { for (const page of pages) await page.locator('#scr-game [data-act=view]').click(); threeD = !threeD; }
        async function reload(pi) { const r = await host.evaluate(() => window.testRevision); await pages[pi].reload({ waitUntil: 'domcontentloaded' }); await pages[pi].locator('#jcode').fill(data.code); await pages[pi].locator('#btn-join').click(); await pages[pi].waitForFunction(r => window.testRevision >= r && window.testView?.official?.module === 'unsorted-x', r); await sync(); reconnected = true; }
        for (let mode = 0; mode < 2; mode++) {
          for (const page of pages) { assert.equal(await page.locator('#scr-game .x-marker:not([hidden])').count(), n); assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)); }
          const V = (await views())[0], pi = BB.setupActor(V), x = V.players[pi].stands.flat().find(w => w.x);
          assert.equal(await pages[pi].locator(selector(x.id)).count(), 0, '初始标记不能选择X');
          await toggle();
        }
        while ((await host.evaluate(() => window.testView.phase)) === 'setup') { const v = await views(), pi = BB.setupActor(v[0]), w = v[pi].players[pi].stands.flat().find(w => !w.x && BB.kindOf(w) === 'b'); await advance(() => wire(pi, w.id)); }
        // 先实际使用个人探测器，确认自己的重复X不会成为可选回应。
        {
          const v = await views(), own = v[0].players[0].stands.flat(), x = own.find(w => w.x), all = v.flatMap((view, owner) => view.players[owner].stands.flat().map(w => ({ ...w, owner })));
          const target = all.find(w => w.owner !== 0 && !w.x && w.v === x.v), partner = all.find(w => w.owner === target.owner && w.s === target.s && !w.x && w.id !== target.id);
          await pages[0].locator('[data-act=mode][data-m=dd]').click();
          for (let mode = 0; mode < 2; mode++) { for (const w of all.filter(w => w.x)) assert.equal(await pages[0].locator(selector(w.id)).count(), 0); await toggle(); }
          await wire(0, target.id); await wire(0, partner.id); await advance(() => pages[0].locator('[data-act=val][data-v="' + x.v + '"]').click());
          await advance(() => pages[target.owner].locator('[data-act=resolve-target][data-w="' + target.id + '"]').count().then(async count => { if (count) await pages[target.owner].locator('[data-act=resolve-target][data-w="' + target.id + '"]').click(); else await wire(target.owner, target.id); }));
          let ownView = (await views())[0]; assert(!ownView.pending.choices.includes(x.id)); assert.equal(await pages[0].locator(selector(x.id)).count(), 0); await reload(0);
          ownView = (await views())[0]; await advance(() => wire(0, ownView.pending.choices[0])); usedDetector = true;
          assert.equal((await views())[0].players[0].dd, 0);
        }
        for (let step = 0; step < 220; step++) {
          const v = await views(), V = v[0]; if (V.phase !== 'play' || n !== 2 && usedX) break;
          const pi = V.turn, own = v[pi].players[pi].stands.flat().filter(w => !w.cut), all = v.flatMap((view, owner) => view.players[owner].stands.flat().map(w => ({ ...w, owner })));
          if (own.every(w => BB.kindOf(w) === 'r')) { await advance(() => pages[pi].locator('[data-act=red]').click()); continue; }
          const pair = all.find(w => w.owner !== pi && !w.cut && BB.kindOf(w) !== 'r' && (!usedX ? w.x : true) && own.some(x => BB.matches(x, BB.annOf(w)))) || all.find(w => w.owner !== pi && !w.cut && BB.kindOf(w) !== 'r' && own.some(x => BB.matches(x, BB.annOf(w))));
          if (!pair) { const value = BB.annOf(own.find(w => BB.kindOf(w) !== 'r')); await advance(() => pages[pi].locator('[data-act=solo][data-v="' + value + '"]').click()); continue; }
          const value = BB.annOf(pair);
          await wire(pi, pair.id); await advance(() => pages[pi].locator('[data-act=val][data-v="' + value + '"]').click());
          for (const page of pages) assert.equal(await page.locator('.declared-target').count(), 1);
          await advance(() => pages[pair.owner].locator('[data-act=resolve-target]').click());
          const pd = (await views())[pi].pending; assert(pd.choices.every(id => own.some(w => w.id === id && BB.matches(w, value))));
          const choice = own.find(w => w.x && pd.choices.includes(w.id))?.id ?? pd.choices.at(-1);
          await advance(() => wire(pi, choice)); usedX ||= pair.x || own.find(w => w.id === choice).x;
          if (usedX) { for (let mode = 0; mode < 2; mode++) { for (const page of pages) assert.equal(await page.locator('#scr-game .x-marker:not([hidden])').count(), n); await toggle(); } }
        }
        assert(usedDetector && usedX && reconnected); if (n === 2) assert.equal((await views())[0].phase, 'won');
        await host.screenshot({ path: '/tmp/bb20-' + n + '-mobile.png' });
        console.log('✓ 第20关开发版' + n + '人：手机二维／三维X标记、初始和装备禁选、探测器私有选择、刷新恢复及普通X拆线；' + (n === 2 ? '完整通关' : '代表动作通过'));
      } catch (error) { console.error('浏览器诊断', JSON.stringify(await Promise.all(pages.map(p => p.evaluate(() => ({ phase: window.testView?.phase, pending: window.testView?.pending, panel: document.querySelector('.act')?.innerText })))))); throw error; }
      finally { for (const context of contexts) await context.close(); }
    }
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
