/* Optional live-browser regression: two players + spectator, mission 2,
 * desktop and mobile WebKit wire clicks and duplicate-value selection.
 * Creates its own new room; does not alter any existing room.
 */
const assert=require('assert'),fs=require('fs'),os=require('os'),path=require('path'),{spawn}=require('child_process');
// Optional dependency: Playwright with its WebKit browser installed.
const {webkit}=require(process.env.BB_PLAYWRIGHT_MODULE || 'playwright');
const base=(process.env.BB_BROWSER_URL || 'http://127.0.0.1:8081').replace(/\/$/, '');
const touch=process.env.BB_TOUCH==='1';
const clickWire=locator=>touch?locator.tap():locator.click();
(async()=>{let browser;try{
browser=await webkit.launch({headless:true}); const contexts=[],pages=[],errors=[];
for(const name of ['点选甲','点选乙','观战者']){const ctx=await browser.newContext({viewport:{width:touch?375:1280,height:touch?820:800},hasTouch:touch,isMobile:touch,reducedMotion:'reduce'});contexts.push(ctx);const page=await ctx.newPage();pages.push(page);page.on('pageerror',e=>errors.push(e.message));await page.route('https://fonts.googleapis.com/**',r=>r.abort());await page.goto(base+'/',{waitUntil:'domcontentloaded'});await page.locator('#nm').fill(name)}
const [A,B,C]=pages;await A.locator('#btn-host').click();await A.locator('#scr-lobby .code').waitFor();const code=await A.locator('#scr-lobby .code').innerText();
await B.locator('#jcode').fill(code);await B.locator('#btn-join').click();await B.locator('#scr-lobby .seat').nth(1).waitFor();
await C.locator('#jcode').fill(code);await C.locator('#btn-spectate').click();await C.locator('#scr-lobby .observer-list').waitFor();
assert((await A.locator('#msel option[value="2"]').innerText()).includes('已核实')); await A.locator('#msel').selectOption('2');await A.locator('#scr-lobby [data-act=start]').click();for(const page of pages)await page.locator('#scr-game .setup-notice').waitFor();
for(const page of [A,B]){for(let n=1;n<=1;n++){const wire=page.locator('#scr-game .seat3.me .slot.can').first();await clickWire(wire);await page.waitForFunction(n=>document.querySelectorAll('#scr-game .seat3.me .tok3:not([hidden])').length===n,n)}}
await A.waitForFunction(()=>!document.querySelector('#scr-game .setup-notice'));
const hand=async page=>page.locator('#scr-game .seat3.me .slot:not(.cut)').evaluateAll(es=>es.map(e=>({id:e.dataset.w,v:e.querySelector('.fv').textContent.trim()})));
const own=await hand(A),other=await hand(B);const values=[...new Set(own.map(w=>w.v))].filter(v=>/^\d+$/.test(v));const val=values.find(v=>own.filter(w=>w.v===v).length>=2&&other.some(w=>w.v===v));assert(val,'expected duplicated matching value in test deal');const copies=own.filter(w=>w.v===val),target=other.find(w=>w.v===val);
await clickWire(A.locator('#scr-game .slot[data-w="'+target.id+'"]'));await A.locator('#scr-game .vbtn[data-v="'+val+'"]').click();
await B.locator('#scr-game [data-act=resolve-target]').waitFor();assert((await B.locator('#scr-game [data-act=resolve-target]').innerText()).includes('命中'));
for(const page of pages){await page.locator('#scr-game .target-notice').waitFor();assert(!(await page.locator('#scr-game .slot.cut').count()))}
await B.locator('#scr-game [data-act=resolve-target]').click();await A.waitForFunction(()=>document.querySelector('#scr-game .act')?.innerText.includes('任意一根匹配线'));
assert.equal(await A.locator('#scr-game .seat3.me .slot.can').count(),copies.length);assert.equal(await C.locator('#scr-game .slot.can').count(),0);
const selected=copies[copies.length-1];await clickWire(A.locator('#scr-game .slot.can[data-w="'+selected.id+'"]'));await A.locator('#scr-game .slot.cut[data-w="'+selected.id+'"]').waitFor();
assert.equal(await A.locator('#scr-game .slot.cut[data-w="'+copies[0].id+'"]').count(),0);assert.equal(await A.locator('#scr-game .slot.cut[data-w="'+target.id+'"]').count(),1);
await C.waitForFunction(()=>document.querySelector('#scr-game .cut-response')?.textContent.includes('公开回应：命中'));
for(const page of pages){await page.setViewportSize({width:375,height:820});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));}
// Own response and target selection must both still work at mobile width.
await B.locator('#scr-game .turn-notice').waitFor();const bh=await hand(B),ah=await hand(A);const bv=bh.find(w=>ah.some(x=>x.v===w.v));assert(bv);const at=ah.find(w=>w.v===bv.v);
await clickWire(B.locator('#scr-game .slot[data-w="'+at.id+'"]'));await B.locator('#scr-game .vbtn[data-v="'+bv.v+'"]').click();await A.locator('#scr-game [data-act=resolve-target]').click();await B.waitForFunction(()=>document.querySelector('#scr-game .act')?.innerText.includes('任意一根匹配线'));await clickWire(B.locator('#scr-game .seat3.me .slot.can[data-w="'+bv.id+'"]'));await B.locator('#scr-game .slot.cut[data-w="'+bv.id+'"]').waitFor();
assert.deepEqual(errors,[]);A.once('dialog',d=>d.accept());await A.locator('[data-act=host-quit]').click();await A.locator('#scr-lobby').waitFor({state:'visible'});console.log(JSON.stringify({result:'PASS',engine:'WebKit',publicURL:base,mission:2,declared:val,firstCopy:copies[0].id,chosenCopy:selected.id,target:target.id,desktopAndMobileMouseClicks:!touch,mobileTouchClicks:touch,publicResponse:true,observerReadOnly:true,errors}));
}finally{if(browser)await browser.close();}})().catch(e=>{console.error(e.stack);process.exitCode=1});
