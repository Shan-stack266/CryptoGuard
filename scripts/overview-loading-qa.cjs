// Controlled response gates; no live credentials or database writes.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || `${process.env.TEMP}/cinifix-browser-qa/node_modules/playwright`)
const assert=require('node:assert/strict')
async function main(){
 const browser=await chromium.launch({channel:'chrome',headless:true})
 try {
  const page=await browser.newPage(), counts={state:0,summary:0}
  const user={id:'11111111-1111-4111-8111-111111111111',email:'loading@example.test',role:'admin',active:true}
  const state={policies:{},events:[{id:'event',timestamp:new Date().toISOString(),identity:user.email,operation:'Login',decision:'Allowed',score:0,severity:'Low'}],alerts:[],audit:[],blockedIPs:[],ledger:[],accounts:[],accountLogs:[],model:null}
  let releaseInitial, releaseDenied
  const initialSummary=new Promise(resolve=>{releaseInitial=resolve})
  const deniedSummary=new Promise(resolve=>{releaseDenied=resolve})
  await page.route('**/api/**',async route=>{
   const path=new URL(route.request().url()).pathname
   let body={},status=200
   if(path==='/api/auth/session')body={user}
   else if(path==='/api/state'){
    counts.state++
    if(counts.state===1)body=state
    else {status=403;body={error:'Account access restricted.'}}
   } else if(path==='/api/summary'){
    counts.summary++
    await (counts.summary===1?initialSummary:deniedSummary)
    body={failures:counts.summary===1?2:42,open:0}
   } else {status=404;body={error:'Unexpected test route'}}
   await route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)})
  })
  await page.goto(process.env.QA_URL || 'http://localhost:5173')
  await page.waitForFunction(()=>document.querySelector('.overview-stats')?.getAttribute('aria-busy')==='false')
  const cards=page.locator('.overview-stats strong')
  assert.equal(await cards.nth(0).textContent(),'1','Activity must render before delayed statistics')
  await page.locator('.dashboard-nav').getByRole('button',{name:'AI Security',exact:true}).click()
  assert.equal(await page.locator('.security-metrics').count(),0,'Pending statistics must not show fabricated counts')
  assert.deepEqual(counts,{state:1,summary:1},'One parallel pair is enough for initial load')
  releaseInitial()
  await page.waitForFunction(()=>document.querySelector('.security-metrics strong')?.textContent==='2')
  await page.getByRole('button',{name:'Refresh',exact:true}).click()
  await page.getByRole('alert').filter({hasText:'Account access restricted.'}).waitFor()
  releaseDenied()
  await page.waitForFunction(()=>!document.querySelector('.dashboard-topbar button:disabled'))
  assert.equal(await page.locator('.security-metrics').count(),0,'Late statistics must not restore data after access is denied')
  console.log('Loading QA passed: one parallel refresh, activity renders before held statistics, pending values are explicit, and denied access stays cleared.')
 } finally {await browser.close()}
}
main().catch(error=>{console.error(error);process.exitCode=1})
