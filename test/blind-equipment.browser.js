// 第15关真实浏览器检查；开发版只写入隔离服务器私有夹具。
const assert = require('assert'), fs = require('fs'), path = require('path');
const BB = require('../js/engine'), M = require('../js/missions');
const { chromium } = require(process.env.BB_PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.BB_BROWSER_URL || 'http://127.0.0.1:9123', dir = process.env.BB_TEST_DATA_DIR || '/tmp/bb15-test-data';
const publicRun = process.env.BB_PUBLIC === '1';
function rng(seed) { return () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296); }
function fixture(n) {
  const code = 'B' + Date.now().toString(36).slice(-4).toUpperCase() + n;
  const seats = Array.from({ length: n }, (_, i) => ({ pid: code + '-p' + i, name: '工具玩家' + i, credential: '测试凭证-' + code + '-' + i, bot: false }));
  let G;
  for (let seed = 1; seed < 5000; seed++) {
    G = BB.createGame(M.get('official-development', 15), seats, { rng: rng(seed), captain: 0 });
    const value = G.officialState.blind.value;
    if (G.equip[0].n === 4 && value !== 4 && (n !== 2 || G.wires.filter(w => w.o === 0 && w.v === value).length === 2)) break;
  }
  assert.equal(G.equip[0].n, 4); G.catalog = G.mission.catalog = 'campaign';
  fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(path.join(dir, 'bb-' + code.toLowerCase() + '.json'), JSON.stringify({ version: 1, name: 'bb-' + code.toLowerCase(), host: seats[0].pid, mid: 15, ruleset: 'campaign', attempts: 1, started: true, seats, observers: [], revision: 0, seen: [], G }), { mode: 0o600 });
  return { code, seats };
}
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.BB_CHROMIUM || '/snap/bin/chromium', headless: true, args: ['--no-sandbox'] });
  const errors = [];
  try {
    for (const n of (process.env.BB_TEST_PLAYER_COUNTS || '2,3,4,5').split(',').map(Number)) {
      const data = publicRun ? { code: null, seats: Array.from({ length: n }, (_, i) => ({ name: '盲开验收' + i })) } : fixture(n);
      let code = data.code, threeD = n <= 3, revealed = 0, usedSticky = false, duplicate = false, refreshed = false;
      const pages = [], contexts = [];
      try {
        for (let pi = 0; pi < n; pi++) {
          const context = await browser.newContext({ viewport: { width: 375, height: 820 }, reducedMotion: 'reduce' }); contexts.push(context);
          await context.addInitScript(({ code, seat, threeD, publicRun }) => {
            localStorage.setItem('bb_name', JSON.stringify(seat.name));
            if (!publicRun) { localStorage.setItem('bb_pid', JSON.stringify(seat.pid)); localStorage.setItem('bb_officialCredentials', JSON.stringify({ [code]: seat.credential })); }
            if (localStorage.getItem('bb_view3d') === null) localStorage.setItem('bb_view3d', JSON.stringify(threeD));
            const Socket = window.WebSocket;
            window.WebSocket = class extends Socket { constructor(...args) { super(...args); this.addEventListener('message', e => { try { const m = JSON.parse(e.data); if (m.topic === 'official:view') { window.testView = m.data.view; window.testRevision = m.data.revision; } } catch (_) {} }); } };
          }, { code, seat: data.seats[pi], threeD, publicRun });
          const page = await context.newPage(); pages.push(page); page.on('pageerror', e => errors.push(e.message));
          page.on('console', m => { if (m.type() === 'error' && /ReferenceError|TypeError|SyntaxError/.test(m.text())) errors.push(m.text()); });
          await page.route('https://fonts.googleapis.com/**', r => r.abort()); await page.goto(base, { waitUntil: 'domcontentloaded' }); await page.locator('#nm').fill(data.seats[pi].name);
          if (publicRun && pi === 0) { await page.locator('#btn-host').click(); await page.locator('#scr-lobby .code').waitFor(); code = await page.locator('#scr-lobby .code').innerText(); }
          else { await page.locator('#jcode').fill(code); await page.locator('#btn-join').click(); }
          if (publicRun) await pages[0].waitForFunction(count => document.querySelectorAll('#scr-lobby .seat').length === count, pi + 1);
          else await page.waitForFunction(() => window.testView?.official?.blindEquipment);
        }
        const host = pages[0];
        if (publicRun) { assert((await host.locator('#msel option[value="15"]').innerText()).includes('已核实')); await host.locator('#msel').selectOption('15'); await host.locator('#scr-lobby [data-act=start]').click(); }
        for (const page of pages) {
          await page.waitForFunction(() => window.testView?.official?.blindEquipment && document.querySelector('#scr-game .act'));
          assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
          assert.equal(await page.locator(threeD ? '.card3.hidden-equipment' : '.eq-hidden').count(), n);
          assert((await page.evaluate(() => window.testView.equip)).every(e => e.hidden && !('n' in e) && !('id' in e)));
        }
        async function sync() { const r = await host.evaluate(() => window.testRevision); await Promise.all(pages.map(p => p.waitForFunction(r => window.testRevision === r, r))); }
        async function advance(page, callback) { await sync(); const r = await host.evaluate(() => window.testRevision); await callback(); await host.waitForFunction(r => window.testRevision > r, r); await sync(); }
        async function views() { await sync(); return Promise.all(pages.map(p => p.evaluate(() => window.testView))); }
        async function clickWire(page, id) { await page.locator('#scr-game ' + (threeD ? '.slot.can' : '.tile.can') + '[data-w="' + id + '"]').click(); }
        while ((await host.evaluate(() => window.testView.phase)) === 'setup') {
          const v = await views(), pi = BB.setupActor(v[0]), wire = v[pi].players[pi].stands.flat().find(w => Number.isInteger(w.v));
          await advance(pages[pi], () => clickWire(pages[pi], wire.id));
        }
        for (let k = 0; k < 100 && (await host.evaluate(() => window.testView.phase)) === 'play' && (n === 2 || revealed === 0); k++) {
          const v = await views(), V = v[0], pd = V.pending;
          if (pd?.type === 'equipment-reveal') {
            const pi = (pd.from + 1) % n, page = pages[pi], slot = pd.slots[0], turnNo = V.turnNo;
            if (n === 2 && !refreshed) { await page.reload({ waitUntil: 'domcontentloaded' }); await page.locator('#jcode').fill(code); await page.locator('#btn-join').click(); await page.waitForFunction(id => window.testView?.pending?.id === id, pd.id); refreshed = true; }
            for (const client of pages) assert((await client.locator('.act').innerText()).includes('队伍可盲翻'));
            await advance(page, () => page.locator((threeD ? '.card3' : '.eq') + '[data-slot="' + slot + '"]').click()); revealed++;
            const updated = await views(), e = updated[0].equip.find(e => e.slot === slot);
            assert(!e.hidden && e.open); assert.equal(updated[0].turnNo, turnNo + 1); assert(!updated[0].pending);
            for (const client of pages) { assert((await client.locator('[data-act=eq][data-n="' + e.n + '"]').innerText()).includes('无需编号解锁')); await client.locator('#scr-game [data-act=view]').click(); assert(await client.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)); }
            threeD = !threeD;
            if (e.n === 4 && !usedSticky) {
              if (!publicRun) assert.equal(updated[0].players.flatMap(p => p.stands.flat()).filter(w => w.cut && w.v === 4).length, 0);
              const stickyWire = updated[pi].players[pi].stands.flat().find(w => !w.cut && Number.isInteger(w.v) && !w.info);
              assert(stickyWire); await page.locator('[data-act=eq][data-n="4"]').click(); await clickWire(page, stickyWire.id);
              await advance(page, () => page.locator('[data-act=eqgo]').click()); usedSticky = true;
              const final = await views(); assert(final[0].equip.find(e => e.n === 4).used);
              assert(final[pi].players[pi].stands.flat().find(w => w.id === stickyWire.id).info || final[0].announcement?.id === stickyWire.id, '标记不足时应公开临时口头信息，而非复制第三枚标记');
            }
            continue;
          }
          assert(!pd); const pi = V.turn, own = v[pi].players[pi].stands.flat().filter(w => !w.cut), all = v.flatMap((view, owner) => view.players[owner].stands.flat().map(w => ({ ...w, owner })));
          if (own.every(w => BB.kindOf(w.v) === 'r')) { await advance(pages[pi], () => pages[pi].locator('[data-act=red]').click()); continue; }
          const goal = V.official.blindEquipment.value;
          const value = own.some(w => w.v === goal) ? goal : (own.find(w => Number.isInteger(w.v) && (revealed || w.v !== 4)) || own.find(w => Number.isInteger(w.v))).v;
          const copies = own.filter(w => w.v === value), target = all.find(w => w.owner !== pi && !w.cut && w.v === value);
          if (!target) await advance(pages[pi], () => pages[pi].locator('[data-act=solo][data-v="' + value + '"]').click());
          else {
            await clickWire(pages[pi], target.id); await advance(pages[pi], () => pages[pi].locator('[data-act=val][data-v="' + value + '"]').click());
            await advance(pages[target.owner], () => pages[target.owner].locator('[data-act=resolve-target]').click());
            const selected = copies.at(-1); duplicate ||= copies.length > 1; await advance(pages[pi], () => clickWire(pages[pi], selected.id));
            const result = await pages[pi].evaluate(() => window.testView); if (copies.length > 1) assert(!result.players[pi].stands.flat().find(w => w.id === copies[0].id).cut);
          }
        }
        assert(revealed > 0); if (!publicRun) assert(usedSticky);
        if (n === 2) { assert.equal(await host.evaluate(() => window.testView.phase), 'won'); assert(duplicate && refreshed); }
        console.log(`✓ 第15关 ${n}人 隐藏身份、团队翻牌、直接解锁、手机二维／三维${usedSticky ? '及便利贴使用' : ''}${n === 2 ? '，整局通关与奖励阶段重连' : ''}`);
      } catch (error) {
        console.error('浏览器诊断', JSON.stringify(await Promise.all(pages.map(p => p.evaluate(() => ({ phase: window.testView?.phase, pending: window.testView?.pending, panel: document.querySelector('.act')?.innerText })))), null, 2)); throw error;
      } finally { await Promise.all(contexts.map(c => c.close())); }
    }
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
