// 第13关来源设置的隔离联机测试；只写本机服务器的临时数据目录。
const assert = require('assert'), fs = require('fs'), path = require('path');
const BB = require('../js/engine'), M = require('../js/missions');
const { chromium } = require(process.env.BB_PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.BB_BROWSER_URL || 'http://127.0.0.1:9123', dir = process.env.BB_TEST_DATA_DIR || '/tmp/bb13-test-data';
const publicRun = process.env.BB_PUBLIC === '1';
if (!publicRun && (!/^http:\/\/(127\.0\.0\.1|localhost):/.test(base) || !dir.startsWith('/tmp/'))) throw new Error('开发夹具只允许隔离本机服务器');
function rng(seed) { return () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296); }
function fixture(n) {
  const code = 'T' + Date.now().toString(36).slice(-4).toUpperCase() + n, seats = Array.from({ length: n }, (_, i) => ({ pid: code + '-p' + i, name: '冒险玩家' + i, credential: '测试凭证-' + code + '-' + i, bot: false }));
  const G = BB.createGame(M.get('official-development', 13), seats, { rng: rng(n + 13), captain: 0 });
  G.catalog = G.mission.catalog = 'campaign'; fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'bb-' + code.toLowerCase() + '.json'), JSON.stringify({ version: 1, name: 'bb-' + code.toLowerCase(), host: seats[0].pid, mid: 13, ruleset: 'campaign', attempts: 1, started: true, seats, observers: [], revision: 0, seen: [], G }), { mode: 0o600 });
  return { code, seats };
}
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.BB_CHROMIUM || '/snap/bin/chromium', headless: true, args: ['--no-sandbox'] }), errors = [];
  try {
    for (const n of (process.env.BB_TEST_PLAYER_COUNTS || '2,3,4,5').split(',').map(Number)) {
      const data = publicRun ? { code: null, seats: Array.from({ length: n }, (_, i) => ({ name: '三红验收' + i })) } : fixture(n), pages = [], contexts = []; let threeD = n <= 3, ownReload = false, riskyReload = false, cuts = 0, riskyDone = false;
      try {
        for (let pi = 0; pi < n; pi++) {
          const context = await browser.newContext({ viewport: { width: 375, height: 820 }, reducedMotion: 'reduce' }); contexts.push(context);
          await context.addInitScript(({ code, seat, threeD, publicRun }) => {
            localStorage.setItem('bb_name', JSON.stringify(seat.name));
            if (!publicRun) { localStorage.setItem('bb_pid', JSON.stringify(seat.pid)); localStorage.setItem('bb_officialCredentials', JSON.stringify({ [code]: seat.credential })); }
            if (localStorage.getItem('bb_view3d') === null) localStorage.setItem('bb_view3d', JSON.stringify(threeD));
            const Socket = window.WebSocket; window.WebSocket = class extends Socket { constructor(...args) { super(...args); this.addEventListener('message', e => { try { const m = JSON.parse(e.data); if (m.topic === 'official:view') { window.testView = m.data.view; window.testRevision = m.data.revision; } } catch (_) {} }); } };
          }, { code: data.code, seat: data.seats[pi], threeD, publicRun });
          const page = await context.newPage(); pages.push(page); page.on('pageerror', e => errors.push(e.message));
          await page.route('https://fonts.googleapis.com/**', r => r.abort()); await page.goto(base, { waitUntil: 'domcontentloaded' }); await page.locator('#nm').fill(data.seats[pi].name);
          if (publicRun && pi === 0) { await page.locator('#btn-host').click(); await page.locator('#scr-lobby .code').waitFor(); data.code = await page.locator('#scr-lobby .code').innerText(); }
          else { await page.locator('#jcode').fill(data.code); await page.locator('#btn-join').click(); }
          if (publicRun) await pages[0].waitForFunction(count => document.querySelectorAll('#scr-lobby .seat').length === count, pi + 1);
          else await page.waitForFunction(() => window.testView?.official?.module === 'risky-red-cut');
        }
        const host = pages[0];
        if (publicRun) { assert((await host.locator('#msel option[value="13"]').innerText()).includes('已核实')); await host.locator('#msel').selectOption('13'); await host.locator('#scr-lobby [data-act="start"]').click(); await Promise.all(pages.map(p => p.waitForFunction(version => window.testView?.official?.module === 'risky-red-cut' && window.testView.contentVersion === version, M.CAMPAIGN_VERSION))); }
        async function sync() { for (let k = 0; k < 10; k++) { const r = Math.max(...await Promise.all(pages.map(p => p.evaluate(() => window.testRevision)))); await Promise.all(pages.map(p => p.waitForFunction(r => window.testRevision >= r, r))); const latest = await Promise.all(pages.map(p => p.evaluate(() => window.testRevision))); if (latest.every(x => x === r)) return; } throw new Error('客户端修订号持续不一致'); }
        async function advance(callback) { await sync(); const r = await host.evaluate(() => window.testRevision); await callback(); await host.waitForFunction(r => window.testRevision > r, r); await sync(); }
        async function views() { await sync(); return Promise.all(pages.map(p => p.evaluate(() => window.testView))); }
        async function wire(page, id) { await page.locator('#scr-game ' + (threeD ? '.slot.can' : '.tile.can') + '[data-w="' + id + '"]').click(); }
        async function toggle() { for (const page of pages) await page.locator('#scr-game [data-act=view]').click(); threeD = !threeD; }
        async function reload(pi) { const r = await host.evaluate(() => window.testRevision); await pages[pi].reload({ waitUntil: 'domcontentloaded' }); await pages[pi].locator('#jcode').fill(data.code); await pages[pi].locator('#btn-join').click(); await pages[pi].waitForFunction(r => window.testRevision >= r && window.testView?.official?.module === 'risky-red-cut', r); await sync(); }
        for (let mode = 0; mode < 2; mode++) { for (const page of pages) assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)); await toggle(); }
        while ((await host.evaluate(() => window.testView.phase)) === 'setup') {
          const v = await views(), pd = v[0].pending, pi = pd.to, privateChoice = v[pi].pending;
          assert((await pages[pi].locator('.act').innerText()).includes('随机抽到「' + pd.token.value + '」'));
          v.forEach((V, owner) => { assert.equal('choices' in V.pending, owner === pi); V.players.forEach((p, target) => p.stands.flat().forEach(w => { if (target !== owner && !w.cut) assert.equal(w.v, null); })); });
          if (privateChoice.canPlaceAside) await advance(() => pages[pi].locator('[data-act="initial-clue-aside"]').last().click());
          else await advance(() => wire(pages[pi], privateChoice.choices.at(-1)));
        }
        assert.equal((await views())[0].players.reduce((sum, p) => sum + p.stands.flat().filter(w => w.info).length, 0) + (await views())[0].official.sideClues.length, n === 2 ? 1 : n);
        for (let k = 0; k < 240; k++) {
          const v = await views(), V = v[0]; if (V.phase === 'won' || riskyDone && n !== 2) break;
          assert.equal(V.phase, 'play'); const pd = V.pending;
          if (pd?.type === 'cut') {
            const pi = pd.to;
            if (pd.step === 'own' && !ownReload) { await reload(pi); ownReload = true; }
            const current = await pages[pi].evaluate(() => window.testView.pending), id = current.choices.at(-1);
            if (pd.step === 'target' && pd.ids.length === 1) await advance(() => pages[pi].locator('[data-act="resolve-target"]').click());
            else { await advance(() => wire(pages[pi], id)); cuts++; }
            continue;
          }
          if (pd?.type === 'risky-cut') {
            v.forEach((view, pi) => { assert.deepEqual(view.pending.ids, pd.ids); assert.equal('ownAnswers' in view.pending, pi === pd.to); });
            for (let mode = 0; mode < 2; mode++) { for (const page of pages) { assert.equal(await page.locator('.declared-target').count(), 3); assert((await page.locator('.target-declaration').innerText()).includes('宣告三根都是红线')); } await toggle(); }
            if (!riskyReload) { await reload(pd.to); riskyReload = true; }
            await advance(() => pages[pd.to].locator('[data-act="risky-reply"]').click());
            if (!(await host.evaluate(() => window.testView.pending))) {
              riskyDone = true;
              const finished = (await views())[0]; pd.ids.forEach(id => { const w = finished.players.flatMap(p => p.stands.flat()).find(w => w.id === id); assert(w.cut && w.resolution === 'cut'); });
              for (const page of pages) for (const id of pd.ids) assert((await page.locator('[data-w="' + id + '"]').getAttribute('aria-label')).includes('已剪'));
              assert.equal(finished.phase, finished.players.every(p => p.stands.flat().every(w => w.cut)) ? 'won' : 'play');
            }
            continue;
          }
          const pi = V.turn, own = v[pi].players[pi].stands.flat().filter(w => !w.cut), allRed = own.every(w => BB.kindOf(w) === 'r');
          if (!riskyDone && (allRed || n !== 2 && cuts > 0)) {
            await pages[pi].locator('[data-act="risky-start"]').click();
            const ids = v.flatMap((view, owner) => view.players[owner].stands.flat().filter(w => !w.cut && BB.kindOf(w) === 'r').map(w => w.id)); assert.equal(ids.length, 3);
            for (const id of ids) await wire(pages[pi], id);
            assert.equal(await pages[pi].locator('.sel[data-w]').count(), 3); assert(!await pages[pi].locator('[data-act="risky-submit"]').isDisabled());
            await advance(() => pages[pi].locator('[data-act="risky-submit"]').click()); continue;
          }
          const number = BB.annOf(own.find(w => BB.kindOf(w) !== 'r'));
          if (BB.soloOk({ ...V, wires: v.flatMap((view, owner) => view.players[owner].stands.flat().map(w => ({ ...w, o: owner }))) }, pi, number)) await advance(() => pages[pi].locator('[data-act="solo"][data-v="' + number + '"]').click());
          else {
            const target = v.flatMap((view, owner) => owner === pi ? [] : view.players[owner].stands.flat().filter(w => !w.cut && BB.matches(w, number)))[0]; assert(target);
            await wire(pages[pi], target.id); await advance(() => pages[pi].locator('[data-act="val"][data-v="' + number + '"]').click());
          }
        }
        assert(riskyDone && riskyReload && ownReload); if (n === 2) assert.equal(await host.evaluate(() => window.testView.phase), 'won');
        await host.screenshot({ path: '/tmp/bb13-' + n + '-mobile.png', fullPage: false });
        console.log('✓ 第13关' + n + '人：随机标记、双人拆线私有选择、公开三红箭头及回应、重连、双视图与手机宽度' + (n === 2 ? '，完整通关' : ''));
        if (publicRun && (await host.locator('[data-act="host-quit"]').count())) {
          host.once('dialog', dialog => dialog.accept()); await host.locator('[data-act="host-quit"]').click();
          await host.locator('#scr-lobby').waitFor({ state: 'visible' });
        }
      } finally { for (const context of contexts) await context.close(); }
    }
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
