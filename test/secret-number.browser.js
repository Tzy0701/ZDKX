// 秘密数字牌开发模块只在隔离本机服务器验收。
const assert = require('assert'), fs = require('fs'), path = require('path'), BB = require('../js/engine'), M = require('../js/missions');
const { chromium } = require(process.env.BB_PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.BB_BROWSER_URL || 'http://127.0.0.1:9123', dir = process.env.BB_TEST_DATA_DIR || '/tmp/bb29-test-data';
const publicRun = process.env.BB_PUBLIC === '1';
if (!publicRun && (!/^http:\/\/(127\.0\.0\.1|localhost):/.test(base) || !dir.startsWith('/tmp/'))) throw new Error('开发夹具只允许隔离本机服务器');
function rng(seed) { return () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296); }
function survivesFirstPenalty(source, firstValue) {
  const G = JSON.parse(JSON.stringify(source)); let first = true, picked = null;
  for (let k = 0; k < 400 && !['won', 'lost'].includes(G.phase); k++) {
    const pi = G.pending ? G.pending.to : G.phase === 'setup' ? BB.setupActor(G) : G.turn, pd = G.pending;
    const own = G.players[G.turn].stands.flat().map(id => G.wires[id]).filter(w => !w.cut); let a;
    if (G.phase === 'setup') a = { a: 'info', w: G.players[pi].stands.flat().map(id => G.wires[id]).find(w => BB.kindOf(w) === 'b').id };
    else if (pd?.type === 'secret-number') {
      if (pd.step === 'choose') { const cards = BB.view(G, pi).pending.choices; picked = first ? firstValue : cards.find(value => own.some(w => BB.kindOf(w) === 'b' && w.v !== value)) ?? cards[0]; a = { a: 'secret-choose', id: pd.id, value: picked }; }
      else { a = { a: 'secret-reveal', id: pd.id }; picked = null; }
    } else if (pd?.type === 'cut') {
      var choices = BB.view(G, pi).pending.choices;
      var selected = pd.step === 'own' ? G.players[pi].stands.flat().filter(id => choices.includes(id)).at(-1) : choices.at(-1);
      a = { a: 'resolve', id: pd.id, w: selected }; if (pd.step === 'own') first = false;
    }
    else if (own.every(w => BB.kindOf(w) === 'r')) a = { a: 'red' };
    else {
      const value = (first ? own.find(w => w.v === firstValue) : own.find(w => BB.kindOf(w) === 'b' && w.v !== picked) || own.find(w => BB.kindOf(w) === 'b')).v;
      const all = G.players.flatMap(p => p.stands.flat().map(id => G.wires[id])), target = all.find(w => w.o !== pi && !w.cut && w.v === value);
      a = target ? { a: 'dual', w: target.id, val: value } : { a: 'solo', val: value };
    }
    if (BB.act(G, pi, a)) return false;
  }
  return G.phase === 'won';
}
function fixture(n) {
  const code = 'S' + Date.now().toString(36).slice(-4).toUpperCase() + n, seats = Array.from({ length: n }, (_, i) => ({ pid: code + '-p' + i, name: '秘密验收' + i, credential: '测试凭证-' + code + '-' + i, bot: false }));
  let G, value;
  for (let seed = 1; seed < 500; seed++) { G = BB.createGame(M.get('official-development', 29), seats, { rng: rng(seed), captain: 0 }); value = G.officialState.secretNumbers.hands[n - 1].find(v => G.wires.filter(w => w.o === 0 && w.v === v).length >= 2 && G.wires.some(w => w.o !== 0 && w.v === v) && (n !== 2 || survivesFirstPenalty(G, v))); if (value) break; }
  assert(value); G.catalog = G.mission.catalog = 'campaign'; fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'bb-' + code.toLowerCase() + '.json'), JSON.stringify({ version: 1, name: 'bb-' + code.toLowerCase(), host: seats[0].pid, mid: 29, ruleset: 'campaign', attempts: 1, started: true, seats, observers: [], revision: 0, seen: [], G }), { mode: 0o600 }); return { code, seats, value };
}
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.BB_CHROMIUM || '/snap/bin/chromium', headless: true, args: ['--no-sandbox'] }), errors = [];
  try {
    for (const n of [2, 3, 4, 5]) {
      const data = publicRun ? { code: null, seats: Array.from({ length: n }, (_, i) => ({ name: '秘密公网' + i })), value: null } : fixture(n), pages = [], contexts = []; let threeD = true, duplicate = false, picked = null, chooseReload = false, revealReload = false, penalty = false;
      try {
        for (let pi = 0; pi < n; pi++) {
          const context = await browser.newContext({ viewport: { width: 375, height: 820 }, reducedMotion: 'reduce' }); contexts.push(context);
          await context.addInitScript(({ code, seat, publicRun }) => {
            localStorage.setItem('bb_name', JSON.stringify(seat.name)); if (!publicRun) { localStorage.setItem('bb_pid', JSON.stringify(seat.pid)); localStorage.setItem('bb_officialCredentials', JSON.stringify({ [code]: seat.credential })); } if (localStorage.getItem('bb_view3d') === null) localStorage.setItem('bb_view3d', 'true');
            const Socket = window.WebSocket; window.WebSocket = class extends Socket { constructor(...args) { super(...args); this.addEventListener('message', e => { try { const m = JSON.parse(e.data); if (m.topic === 'official:view') { window.testView = m.data.view; window.testRevision = m.data.revision; } } catch (_) {} }); } };
          }, { code: data.code, seat: data.seats[pi], publicRun });
          const page = await context.newPage(); pages.push(page); page.on('pageerror', e => errors.push(e.message)); await page.route('https://fonts.googleapis.com/**', r => r.abort()); await page.goto(base, { waitUntil: 'domcontentloaded' }); await page.locator('#nm').fill(data.seats[pi].name); if (publicRun && pi === 0) { await page.locator('#btn-host').click(); await page.locator('#scr-lobby .code').waitFor(); data.code = await page.locator('#scr-lobby .code').innerText(); } else { await page.locator('#jcode').fill(data.code); await page.locator('#btn-join').click(); }
          if (publicRun) await pages[0].waitForFunction(count => document.querySelectorAll('#scr-lobby .seat').length === count, pi + 1); else await page.waitForFunction(() => window.testView?.official?.module === 'secret-number-pass');
        }
        const host = pages[0];
        if (publicRun) { assert((await host.locator('#msel option[value="29"]').innerText()).includes('已核实')); await host.locator('#msel').selectOption('29'); await host.locator('#scr-lobby [data-act=start]').click(); await Promise.all(pages.map(p => p.waitForFunction(version => window.testView?.official?.module === 'secret-number-pass' && window.testView.contentVersion === version, M.CAMPAIGN_VERSION))); }
        async function sync() { for (let k = 0; k < 10; k++) { const r = Math.max(...await Promise.all(pages.map(p => p.evaluate(() => window.testRevision)))); await Promise.all(pages.map(p => p.waitForFunction(r => window.testRevision >= r, r))); if ((await Promise.all(pages.map(p => p.evaluate(() => window.testRevision)))).every(x => x === r)) return; } throw new Error('客户端修订号持续不一致'); }
        async function views() { await sync(); return Promise.all(pages.map(p => p.evaluate(() => window.testView))); }
        async function advance(f) { await sync(); const r = await host.evaluate(() => window.testRevision); await f(); await host.waitForFunction(r => window.testRevision > r, r); await sync(); }
        async function wire(pi, id) { await pages[pi].locator('#scr-game ' + (threeD ? '.slot.can' : '.tile.can') + '[data-w="' + id + '"]').click(); }
        async function toggle() { for (const p of pages) await p.locator('#scr-game [data-act=view]').click(); threeD = !threeD; }
        async function reload(pi) { const r = await host.evaluate(() => window.testRevision); await pages[pi].reload({ waitUntil: 'domcontentloaded' }); await pages[pi].locator('#jcode').fill(data.code); await pages[pi].locator('#btn-join').click(); await pages[pi].waitForFunction(r => window.testRevision >= r && window.testView?.official?.module === 'secret-number-pass', r); await sync(); }
        while ((await host.evaluate(() => window.testView.phase)) === 'setup') { const v = await views(), pi = BB.setupActor(v[0]), id = v[pi].players[pi].stands.flat().find(w => BB.kindOf(w) === 'b').id; await advance(() => wire(pi, id)); }
        for (let step = 0; step < 350; step++) {
          const v = await views(), V = v[0], pd = V.pending;
          if (V.phase !== 'play' || n !== 2 && duplicate && (publicRun ? revealReload : penalty)) break;
          if (pd?.type === 'secret-number') {
            for (let mode = 0; mode < 2; mode++) {
              for (let owner = 0; owner < n; owner++) {
                const p = pages[owner]; assert.equal('choices' in v[owner].pending, pd.step === 'choose' && owner === pd.to); assert((await p.locator('.secret-number-notice').innerText()).includes('秘密数字牌')); assert(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
                assert.equal(await p.locator('[data-act=secret-choose]').count(), pd.step === 'choose' && owner === pd.to ? v[owner].pending.choices.length : 0); assert.equal(await p.locator('[data-act=secret-reveal]').count(), pd.step === 'reveal' && owner === pd.to ? 1 : 0);
              }
              await toggle();
            }
            if (pd.step === 'choose') {
              if (!chooseReload) { await reload(pd.to); chooseReload = true; }
              const own = v[V.turn].players[V.turn].stands.flat().filter(w => !w.cut && BB.kindOf(w) === 'b'), cards = v[pd.to].pending.choices;
              picked = !duplicate && !publicRun ? data.value : cards.find(value => own.some(w => w.v !== value)) ?? cards[0]; assert(cards.includes(picked));
              await advance(() => pages[pd.to].locator('[data-act=secret-choose][data-v="' + picked + '"]').click());
              for (const view of await views()) { assert(!view.pending); assert(!('chosen' in view.official.secretNumbers)); }
            } else {
              if (!revealReload) { await reload(pd.to); revealReload = true; }
              const before = V.det; await advance(() => pages[pd.to].locator('[data-act=secret-reveal]').click()); const after = (await views())[0]; if (!penalty && !publicRun) { assert.equal(after.det, before + 1); penalty = true; } else if (after.det === before + 1) penalty = true; picked = null;
            }
            continue;
          }
          const pi = V.turn, own = v[pi].players[pi].stands.flat().filter(w => !w.cut), all = v.flatMap((view, owner) => view.players[owner].stands.flat().map(w => ({ ...w, owner })));
          if (own.every(w => BB.kindOf(w) === 'r')) { await advance(() => pages[pi].locator('[data-act=red]').click()); continue; }
          const w = !duplicate && !publicRun ? own.find(w => w.v === data.value) : own.find(w => BB.kindOf(w) === 'b' && w.v !== picked) || own.find(w => BB.kindOf(w) === 'b');
          const value = w.v, target = all.find(w => w.owner !== pi && !w.cut && w.v === value), copies = own.filter(w => w.v === value);
          if (!target) { await advance(() => pages[pi].locator('[data-act=solo][data-v="' + value + '"]').click()); continue; }
          await wire(pi, target.id); await advance(() => pages[pi].locator('[data-act=val][data-v="' + value + '"]').click()); for (const p of pages) assert.equal(await p.locator('.declared-target').count(), 1);
          await advance(() => pages[target.owner].locator('[data-act=resolve-target]').click()); await advance(() => wire(pi, copies.at(-1).id));
          if (!duplicate && copies.length > 1) { assert(!(await views())[pi].players[pi].stands.flat().find(w => w.id === copies[0].id).cut); duplicate = true; }
        }
        assert(duplicate && (publicRun || penalty) && chooseReload && revealReload); if (n === 2) assert.equal((await views())[0].phase, 'won');
        await host.screenshot({ path: '/tmp/bb29-' + n + '-mobile.png' }); console.log('✓ 第29关' + (publicRun ? '公网' : '开发版') + n + '人：手机二维／三维秘密选牌、公开翻牌及追加处罚、重复手牌选择、选牌和翻牌中刷新恢复；' + (n === 2 ? '完整通关' : '代表动作通过'));
        if (publicRun && await host.locator('[data-act=host-quit]').count()) { host.once('dialog', dialog => dialog.accept()); await host.locator('[data-act=host-quit]').click(); await host.locator('#scr-lobby').waitFor({ state: 'visible' }); }
      } catch (error) { console.error('浏览器诊断', JSON.stringify(await Promise.all(pages.map(p => p.evaluate(() => ({ phase: window.testView?.phase, pending: window.testView?.pending, panel: document.querySelector('.act')?.innerText })))))); throw error; }
      finally { for (const context of contexts) await context.close(); }
    }
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
