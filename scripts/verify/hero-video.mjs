import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
const base=process.env.QA_URL??'http://127.0.0.1:4321';
const b=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
fs.mkdirSync('reports/m04a2/owned-video',{recursive:true});
const results=[];
async function step(name,fn){try{await fn();results.push({name,pass:true});console.log('PASS',name);}catch(e){results.push({name,pass:false,error:e.message});console.log('FAIL',name,e.message.slice(0,160));}}
async function ctx(options={}){const c=await b.newContext({viewport:{width:1440,height:900},...options});await c.route('**/*',r=>r.request().url().startsWith(new URL(base).origin)?r.continue():r.abort());return c;}
try{
await step('original bytes preserved',async()=>assert.equal(createHash('sha256').update(fs.readFileSync('public/media/hero-original-1080p.mp4')).digest('hex'),'bdddcb29b3d0ddcd3d804e32ccfac0d5e57a2b9dc26af1a3b81c8888c95eca96'));
for(const width of (process.env.QA_WIDTHS??'360,390,430,768,1366,1440,1920').split(',').map(Number))await step(`real video ${width}px`,async()=>{
 const c=await ctx({viewport:{width,height:900}});const p=await c.newPage();const errors=[];const requests=new Set();p.on('pageerror',e=>errors.push(e.message));p.on('request',r=>{if(/hero-original.*\.(mp4|webm)/.test(r.url()))requests.add(r.url());});
 await p.goto(base+'/');await p.waitForFunction(()=>{const v=document.querySelector('video');return v?.currentTime>0.3&&!v.paused;});
 const info=await p.locator('video').evaluate(v=>({src:v.currentSrc,muted:v.muted,duration:v.duration,width:v.videoWidth,height:v.videoHeight}));
 assert.equal(info.width,1920);assert.equal(info.height,1080);assert.ok(info.muted);assert.ok(Math.abs(info.duration-149.54)<0.2);assert.ok(info.src.endsWith('hero-original-1080p.mp4'));assert.equal(requests.size,1);
 assert.ok(await p.locator('[data-hero-progress]').evaluate(e=>e.value>0));
 assert.equal(await p.locator('[data-hero-select][aria-pressed="true"]').count(),0);
 await p.screenshot({path:`reports/m04a2/owned-video/playing-${width}.png`});
 assert.ok(await p.evaluate(()=>[...document.querySelectorAll('.hero__title,.hdr__nav')].every(e=>e.getBoundingClientRect().right<=document.documentElement.clientWidth+1)));
 await p.locator('[data-hero-pause]').click();assert.ok(await p.locator('video').evaluate(v=>v.paused));
 await p.locator('[data-hero-pause]').click();await p.waitForFunction(()=>!document.querySelector('video').paused);
 await p.locator('[data-hero-region-menu] > summary').click();await p.locator('[data-hero-select="0"]').click();await p.waitForFunction(()=>document.querySelector('[data-hero-depth]').dataset.current==='0');assert.ok(await p.locator('video').evaluate(v=>v.paused));assert.equal(await p.locator('video source[src]').count(),0);
 await p.locator('[data-hero-return]').click();await p.waitForFunction(()=>{const v=document.querySelector('video');return v.currentTime>0.2&&!v.paused;});
 assert.deepEqual(errors,[]);results.push({name:`metadata ${width}`,pass:true,info});await c.close();
});
for(const mode of ['reduced','save-data'])await step(`no transfer ${mode}`,async()=>{
 const c=await ctx(mode==='reduced'?{reducedMotion:'reduce'}:{});if(mode==='save-data')await c.addInitScript(()=>Object.defineProperty(navigator,'connection',{value:{saveData:true,addEventListener(){}},configurable:true}));
 const p=await c.newPage();const req=[];p.on('request',r=>{if(/hero-original.*\.(mp4|webm)/.test(r.url()))req.push(r.url());});await p.goto(base+'/');await p.waitForSelector('[data-hero-ready]');await p.waitForTimeout(400);assert.deepEqual(req,[]);assert.ok(await p.locator('video').evaluate(v=>v.paused));await c.close();
});
await step('network error keeps poster',async()=>{const c=await ctx();await c.route(/hero-original.*\.(mp4|webm)/,r=>r.fulfill({status:503,body:''}));const p=await c.newPage();await p.goto(base+'/');await p.waitForSelector('[data-hero-retry]:visible');assert.ok(await p.locator('.hero__poster').isVisible());await p.screenshot({path:'reports/m04a2/owned-video/network-error.png'});await c.close();});
await step('autoplay rejection offers retry',async()=>{const c=await ctx();await c.addInitScript(()=>{HTMLMediaElement.prototype.play=function(){return Promise.reject(new DOMException('QA','NotAllowedError'));};});const p=await c.newPage();await p.goto(base+'/');await p.waitForSelector('[data-hero-retry]:visible');assert.ok(await p.locator('.hero__poster').isVisible());await c.close();});
}finally{await b.close();fs.writeFileSync('reports/m04a2/owned-video/report.json',JSON.stringify(results,null,2));}
console.log(results.filter(r=>r.pass).length+'/'+results.length);process.exitCode=results.some(r=>!r.pass)?1:0;
