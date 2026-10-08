// 第12关开发模块的隔离联机夹具；不得用于公开服务器的数据目录。
const assert = require('assert'), fs = require('fs'), path = require('path');
const BB = require('../js/engine'), M = require('../js/missions');
const { chromium } = require(process.env.BB_PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.BB_BROWSER_URL || 'http://127.0.0.1:9123', dir = process.env.BB_TEST_DATA_DIR || '/tmp/bb12-test-data';
if (!/^http:\/\/(127\.0\.0\.1|localhost):/.test(base) || !dir.startsWith('/tmp/')) throw new Error('开发夹具只允许隔离本机服务器');
function rng(seed) { return () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296); }
function fixture(n) {
  const code = 'U' + Date.now().toString(36).slice(-4).toUpperCase() + n;
  const seats = Array.from({ length: n }, (_, i) => ({ pid: code + '-p' + i, name: '解锁玩家' + i, credential: '测试凭证-' + code + '-' + i, bot: false }));
  let G;
  for (let seed = 1; seed < 5000; seed++) { G = BB.createGame(M.get('official-development', 12), seats, { rng: rng(seed), captain: 0 }); if ([0, 1].every(pi => G.wires.some(w => w.o === pi && w.v === 3))) break; }
  assert([0, 1].every(pi => G.wires.some(w => w.o === pi && w.v === 3)));
  G.equip = [4, 6, 13, 7, 8].slice(0, n).map((n, i) => ({ n, id: BB.EQUIP[n].id, used: false, numberUnlock: [3, 5, 2, 7, 8][i], numberDiscarded: false, doubleReady: false }));
  G.officialState.equipmentNumbers = { deck: Array.from({ length: 12 }, (_, i) => i + 1).filter(v => !G.equip.some(e => e.numberUnlock === v)), discarded: [] };
  G.equipmentReserve = Array.from({ length: 13 }, (_, i) => i + 1).filter(n => !G.equip.some(e => e.n === n));
  G.wires.filter(w => w.v === 4).slice(0, 2).forEach(w => { w.cut = true; });
  G.phase = 'play'; G.turn = 0; G.turnNo = 1; G.players.forEach((_, pi) => { G.setup[pi] = 1; }); G.catalog = G.mission.catalog = 'campaign';
  fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(path.join(dir, 'bb-' + code.toLowerCase() + '.json'), JSON.stringify({ version: 1, name: 'bb-' + code.toLowerCase(), host: seats[0].pid, mid: 12, ruleset: 'campaign', attempts: 1, started: true, seats, observers: [], revision: 0, seen: [], G }), { mode: 0o600 });
  return { code, seats };
}
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.BB_CHROMIUM || '/snap/bin/chromium', headless: true, args: ['--no-sandbox'] }), errors = [];
  try {
    for (const n of [2, 3, 4, 5]) {
      const data = fixture(n), pages = [], contexts = []; let threeD = n <= 3;
      try {
        for (let pi = 0; pi < n; pi++) {
          const context = await browser.newContext({ viewport: { width: 375, height: 820 }, reducedMotion: 'reduce' }); contexts.push(context);
          await context.addInitScript(({ code, seat, threeD }) => {
            localStorage.setItem('bb_name', JSON.stringify(seat.name)); localStorage.setItem('bb_pid', JSON.stringify(seat.pid)); localStorage.setItem('bb_officialCredentials', JSON.stringify({ [code]: seat.credential })); localStorage.setItem('bb_view3d', JSON.stringify(threeD));
            const Socket = window.WebSocket; window.WebSocket = class extends Socket { constructor(...args) { super(...args); this.addEventListener('message', e => { try { const m = JSON.parse(e.data); if (m.topic === 'official:view') { window.testView = m.data.view; window.testRevision = m.data.revision; } } catch (_) {} }); } };
          }, { code: data.code, seat: data.seats[pi], threeD });
          const page = await context.newPage(); pages.push(page); page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error' && /ReferenceError|TypeError|SyntaxError/.test(m.text())) errors.push(m.text()); });
          await page.route('https://fonts.googleapis.com/**', r => r.abort()); await page.goto(base, { waitUntil: 'domcontentloaded' }); await page.locator('#nm').fill(data.seats[pi].name); await page.locator('#jcode').fill(data.code); await page.locator('#btn-join').click(); await page.waitForFunction(() => window.testView?.official?.doubleEquipmentUnlock);
        }
        const host = pages[0];
        async function sync() { for (let k = 0; k < 10; k++) { const revisions = await Promise.all(pages.map(p => p.evaluate(() => window.testRevision))); const r = Math.max(...revisions); await Promise.all(pages.map(p => p.waitForFunction(r => window.testRevision >= r, r))); const updated = await Promise.all(pages.map(p => p.evaluate(() => window.testRevision))); if (updated.every(x => x === r)) return; } throw new Error('客户端修订号持续不一致'); }
        async function advance(page, callback) { await sync(); const r = await host.evaluate(() => window.testRevision); await callback(); await host.waitForFunction(r => window.testRevision > r, r); await sync(); }
        async function clickWire(page, id) { await page.locator('#scr-game ' + (threeD ? '.slot.can' : '.tile.can') + '[data-w="' + id + '"]').click(); }
        for (const page of pages) {
          assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
          const card = page.locator('[data-act=eq][data-n="4"]'); const text = await card.innerText(); assert(text.includes('印刷条件 4：2/4')); assert(text.includes('附加数字 3：0/4')); assert(text.includes('尚未同时满足'));
          await page.locator('#scr-game [data-act=view]').click(); assert((await page.locator('[data-act=eq][data-n="4"]').innerText()).includes('附加数字 3：0/4')); await page.locator('#scr-game [data-act=view]').click();
        }
        const A = await host.evaluate(() => window.testView), B = await pages[1].evaluate(() => window.testView), own = A.players[0].stands.flat().filter(w => !w.cut && w.v === 3).at(-1), target = B.players[1].stands.flat().find(w => !w.cut && w.v === 3);
        await clickWire(host, target.id); await advance(host, () => host.locator('[data-act=val][data-v="3"]').click());
        for (const page of pages) assert((await page.locator('.target-notice').innerText()).includes('3'));
        await advance(pages[1], () => pages[1].locator('[data-act=resolve-target]').click());
        await host.reload({ waitUntil: 'domcontentloaded' }); await host.locator('#jcode').fill(data.code); await host.locator('#btn-join').click(); await host.waitForFunction(() => window.testView?.pending?.step === 'own');
        await advance(host, () => clickWire(host, own.id));
        for (const page of pages) { const card = page.locator('[data-act=eq][data-n="4"]'); assert((await card.innerText()).includes('数字卡已弃')); assert((await page.evaluate(() => window.testView.equip.find(e => e.n === 4))).open); await page.locator('#scr-game [data-act=view]').click(); }
        threeD = !threeD;
        const now = await host.evaluate(() => window.testView), sticky = now.players[0].stands.flat().find(w => !w.cut && Number.isInteger(w.v) && !w.info);
        assert.equal(now.turn, 1); await host.locator('[data-act=eq][data-n="4"]').click(); await clickWire(host, sticky.id); await advance(host, () => host.locator('[data-act=eqgo]').click());
        for (const page of pages) { const V = await page.evaluate(() => window.testView); assert(V.equip.find(e => e.n === 4).used); assert(V.players.every(p => p.dd === 1)); assert((await page.locator('[data-act=eq][data-n="4"]').innerText()).includes('已使用')); assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)); }
        console.log('✓ 第12关开发版' + n + '人：手机二维/三维双门槛显示、公开回应、选自身同值、刷新重连和回合外装备使用');
      } finally { await Promise.all(contexts.map(c => c.close())); }
    }
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
