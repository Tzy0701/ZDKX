// 仅检查挑战组件的浏览器加载与现有练习回归；不是第55关整局验收。
const assert=require('assert'),{chromium}=require(process.env.BB_PLAYWRIGHT_MODULE||'playwright');
const base=process.env.BB_BROWSER_URL||'http://127.0.0.1:9123';
if(!/^http:\/\/(127\.0\.0\.1|localhost):/.test(base))throw Error('组件夹具只允许本机测试');
(async()=>{const browser=await chromium.launch({executablePath:process.env.BB_CHROMIUM||'/snap/bin/chromium',headless:true,args:['--no-sandbox']});try{
 const context=await browser.newContext({viewport:{width:375,height:820},reducedMotion:'reduce'}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.route('https://fonts.googleapis.com/**',r=>r.abort());await page.goto(base,{waitUntil:'domcontentloaded'});
 const result=await page.evaluate(()=>{
  const H=window.BB_CHALLENGES;let seed=12345;const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
  return {cards:BB.CHALLENGES.length,draws:[2,3,4,5].map(n=>H.create('浏览器'+n,n,random).cards.length),verified55:BB_MISSIONS.get('campaign',55).verified};
 });assert.deepEqual(result,{cards:10,draws:[2,3,4,5],verified55:false});
 await page.locator('#nm').fill('挑战加载检查');await page.locator('[data-act="solo-start"]').click();await page.locator('#msel').selectOption('1');await page.locator('#scr-lobby [data-act="start"]').click();await page.locator('#scr-game .setup-notice').waitFor();await page.locator('#scr-game .seat3.me .slot.can').first().click();await page.waitForFunction(()=>!document.querySelector('#scr-game .setup-notice'));
 for(let i=0;i<2;i++){assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert(await page.locator('#scr-game .act').count());await page.locator('#scr-game [data-act="view"]').click();}
 assert.deepEqual(errors,[]);console.log('✓ 挑战脚本真实浏览器加载、2–5人数抽牌、公开55仍改编；375像素练习初始标记及双视图回归，无页面异常');await context.close();
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
