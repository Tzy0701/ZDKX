// 第11关开发模块的隔离联机检查；不得写入公开服务器的数据目录。
const assert = require('assert'), fs = require('fs'), path = require('path');
const BB = require('../js/engine'), M = require('../js/missions');
const { chromium } = require(process.env.BB_PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.BB_BROWSER_URL || 'http://127.0.0.1:9123', dir = process.env.BB_TEST_DATA_DIR || '/tmp/bb11-test-data';
if (!/^http:\/\/(127\.0\.0\.1|localhost):/.test(base) || !dir.startsWith('/tmp/')) throw new Error('开发夹具只允许隔离本机服务器');
function rng(seed) { return () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296); }
function fixture(n) {
  const code = 'R' + Date.now().toString(36).slice(-4).toUpperCase() + n, seats = Array.from({ length: n }, (_, i) => ({ pid: code + '-p' + i, name: '红线玩家' + i, credential: '测试凭证-' + code + '-' + i, bot: false }));
  let G;
  for (let seed = 1; seed < 10000; seed++) { G = BB.createGame(M.get('official-development', 11), seats, { rng: rng(seed), captain: 0 }); if (BB.redNumber(G) === 5 && G.wires.some(w => w.o === 1 && w.kind === 'r')) break; }
  assert.equal(BB.redNumber(G), 5); assert(G.wires.some(w => w.o === 1 && w.kind === 'r'));
  G.equip = [8, 2, 6, 3, 7].slice(0, n).map(n => ({ n, id: BB.EQUIP[n].id, used: false })); G.equipmentReserve = Array.from({ length: 13 }, (_, i) => i + 1).filter(n => n !== 5 && !G.equip.some(e => e.n === n));
  G.catalog = G.mission.catalog = 'campaign'; fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(path.join(dir, 'bb-' + code.toLowerCase() + '.json'), JSON.stringify({ version: 1, name: 'bb-' + code.toLowerCase(), host: seats[0].pid, mid: 11, ruleset: 'campaign', attempts: 1, started: true, seats, observers: [], revision: 0, seen: [], G }), { mode: 0o600 }); return { code, seats };
}
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.BB_CHROMIUM || '/snap/bin/chromium', headless: true, args: ['--no-sandbox'] }), errors = [];
  try {
    for (const n of [2, 3, 4, 5]) {
      const data = fixture(n), pages = [], contexts = []; let threeD = n <= 3, refreshed = false, queried = false, duplicate = false, reveals = 0;
      try {
        for (let pi = 0; pi < n; pi++) {
          const context = await browser.newContext({ viewport: { width: 375, height: 820 }, reducedMotion: 'reduce' }); contexts.push(context);
          await context.addInitScript(({ code, seat, threeD }) => {
            localStorage.setItem('bb_name', JSON.stringify(seat.name)); localStorage.setItem('bb_pid', JSON.stringify(seat.pid)); localStorage.setItem('bb_officialCredentials', JSON.stringify({ [code]: seat.credential })); if (localStorage.getItem('bb_view3d') === null) localStorage.setItem('bb_view3d', JSON.stringify(threeD));
            const Socket = window.WebSocket; window.WebSocket = class extends Socket { constructor(...args) { super(...args); this.addEventListener('message', e => { try { const m = JSON.parse(e.data); if (m.topic === 'official:view') { window.testView = m.data.view; window.testRevision = m.data.revision; } } catch (_) {} }); } };
          }, { code: data.code, seat: data.seats[pi], threeD });
          const page = await context.newPage(); pages.push(page); page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error' && /ReferenceError|TypeError|SyntaxError/.test(m.text())) errors.push(m.text()); });
          await page.route('https://fonts.googleapis.com/**', r => r.abort()); await page.goto(base, { waitUntil: 'domcontentloaded' }); await page.locator('#nm').fill(data.seats[pi].name); await page.locator('#jcode').fill(data.code); await page.locator('#btn-join').click(); await page.waitForFunction(() => window.testView?.official?.module === 'blue-as-red');
        }
        const host = pages[0];
        async function sync() { for (let k = 0; k < 10; k++) { const r = Math.max(...await Promise.all(pages.map(p => p.evaluate(() => window.testRevision)))); await Promise.all(pages.map(p => p.waitForFunction(r => window.testRevision >= r, r))); const updated = await Promise.all(pages.map(p => p.evaluate(() => window.testRevision))); if (updated.every(x => x === r)) return; } throw new Error('客户端修订号持续不一致'); }
        async function advance(page, callback) { await sync(); const r = await host.evaluate(() => window.testRevision); await callback(); await host.waitForFunction(r => window.testRevision > r, r); await sync(); }
        async function views() { await sync(); return Promise.all(pages.map(p => p.evaluate(() => window.testView))); }
        async function clickWire(page, id) { await page.locator('#scr-game ' + (threeD ? '.slot.can' : '.tile.can') + '[data-w="' + id + '"]').click(); }
        for (let pi = 0; pi < n; pi++) {
          const page = pages[pi], V = await page.evaluate(() => window.testView);
          assert((await page.locator('.red-number-notice').innerText()).includes('数字卡：5'));
          V.players.forEach((p, owner) => p.stands.flat().forEach(w => { if (owner !== pi && !w.cut) { assert.equal(w.v, null); assert(!('kind' in w)); } }));
          for (let mode = 0; mode < 2; mode++) { assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)); const ownedRed = V.players[pi].stands.flat().filter(w => w.kind === 'r'); for (const w of ownedRed) assert((await page.locator('[data-w="' + w.id + '"]').getAttribute('class')).includes('k-r')); assert((await page.locator('.converted-red').innerText()).includes('红线')); await page.locator('#scr-game [data-act=view]').click(); }
        }
        if (n === 2) assert((await host.locator('.setup-notice').innerText()).includes('红线玩家1'));
        while ((await host.evaluate(() => window.testView.phase)) === 'setup') {
          const v = await views(), pi = BB.setupActor(v[0]), own = v[pi].players[pi].stands.flat(), wire = own.find(w => pi === 1 && w.kind === 'r') || own.find(w => BB.kindOf(w) === 'b'); assert(wire);
          await advance(pages[pi], () => clickWire(pages[pi], wire.id));
          if (pi === 1) assert((await pages[pi].evaluate(() => window.testView.players[1].stands.flat().find(w => w.kind === 'r'))).info?.v === 5);
        }
        for (let k = 0; k < 200 && (await host.evaluate(() => window.testView.phase)) === 'play' && (n === 2 || !queried); k++) {
          const v = await views(), V = v[0], pi = V.turn, own = v[pi].players[pi].stands.flat().filter(w => !w.cut);
          if (!queried && V.equip.find(e => e.n === 8).open) {
            for (const page of pages) await page.locator('#scr-game [data-act=view]').click(); threeD = !threeD;
            await host.locator('[data-act=eq][data-n="8"]').click(); await advance(host, () => host.locator('[data-act=val][data-v="5"]').click());
            for (const page of pages) { const R = await page.evaluate(() => window.testView.radar); assert.equal(R.val, 5); assert(R.res.every(racks => racks.every(x => x === false))); }
            queried = true; continue;
          }
          if (own.every(w => BB.kindOf(w) === 'r')) { await advance(pages[pi], () => pages[pi].locator('[data-act=red]').click()); reveals++; continue; }
          const value = own.some(w => w.v === 8) && !queried ? 8 : BB.annOf(own.find(w => BB.kindOf(w) !== 'r'));
          const copies = own.filter(w => BB.matches(w, value)), all = v.flatMap((view, owner) => view.players[owner].stands.flat().map(w => ({ ...w, owner }))), target = all.find(w => w.owner !== pi && !w.cut && BB.matches(w, value));
          assert.notEqual(value, 5);
          if (!target) await advance(pages[pi], () => pages[pi].locator('[data-act=solo][data-v="' + value + '"]').click());
          else {
            await clickWire(pages[pi], target.id); assert.equal(await pages[pi].locator('[data-act=val][data-v="5"]').count(), 0); await advance(pages[pi], () => pages[pi].locator('[data-act=val][data-v="' + value + '"]').click());
            for (const page of pages) assert((await page.locator('.target-notice').innerText()).includes(BB.valLabel(value)));
            await advance(pages[target.owner], () => pages[target.owner].locator('[data-act=resolve-target]').click());
            if (!refreshed) { await pages[pi].reload({ waitUntil: 'domcontentloaded' }); await pages[pi].locator('#jcode').fill(data.code); await pages[pi].locator('#btn-join').click(); await pages[pi].waitForFunction(() => window.testView?.pending?.step === 'own'); refreshed = true; }
            const selected = copies.at(-1); duplicate ||= copies.length > 1; await advance(pages[pi], () => clickWire(pages[pi], selected.id));
            if (copies.length > 1) assert(!(await pages[pi].evaluate(id => window.testView.players[window.testView.me].stands.flat().find(w => w.id === id).cut, copies[0].id)));
          }
        }
        assert(queried); assert(refreshed);
        if (n === 2) { assert.equal(await host.evaluate(() => window.testView.phase), 'won'); assert(duplicate); assert(reveals > 0); const final = await host.evaluate(() => window.testView); assert(final.players.flatMap(p => p.stands.flat()).filter(w => w.kind === 'r').every(w => w.cut)); }
        console.log('✓ 第11关开发版' + n + '人：手机二维/三维红线显示、初始标记例外、私有颜色、雷达否答和回应中重连' + (n === 2 ? '；整局通关与最后公开红线' : ''));
      } catch (error) { console.error('浏览器诊断', JSON.stringify(await Promise.all(pages.map(p => p.evaluate(() => ({ phase: window.testView?.phase, pending: window.testView?.pending, panel: document.querySelector('.act')?.innerText })))))); throw error; }
      finally { await Promise.all(contexts.map(c => c.close())); }
    }
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
