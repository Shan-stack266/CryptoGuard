// A successful insert followed by a failed refresh must remain a successful save.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || `${process.env.TEMP}/cinifix-browser-qa/node_modules/playwright`)
const assert=require('node:assert/strict')
async function main(){
 const browser=await chromium.launch({channel:'chrome',headless:true})
 try {
  const page=await browser.newPage()
  const user={id:'11111111-1111-4111-8111-111111111111',email:'history@example.test',role:'user',active:true}
  let saved=null
  const state={policies:{},events:[],alerts:[],audit:[],blockedIPs:[],ledger:[],accounts:[],accountLogs:[],model:null}
  await page.route('**/api/**',async route=>{
   const path=new URL(route.request().url()).pathname
   let body={},status=200
   if(path==='/api/auth/session')body={user}
   else if(path==='/api/state'){
    if(saved){status=500;body={error:'Controlled refresh failure'}}else body=state
   } else if(path==='/api/summary')body={failures:0,open:0}
   else if(path==='/api/ciphers'){
    saved={...route.request().postDataJSON(),id:'saved-history',user_id:user.id,timestamp:new Date().toISOString(),status:'Processed'}
    assert.match(saved.digest,/^[a-f0-9]{64}$/)
    assert.ok(!('message' in saved)&&!('keyword' in saved))
    status=201;body=saved
   } else {status=404;body={error:'Unexpected test route'}}
   await route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)})
  })
  await page.goto(process.env.QA_URL || 'http://localhost:5173')
  await page.getByRole('heading',{name:'Encryption & decryption',exact:true}).waitFor()
  await page.getByRole('group',{name:'Select cipher'}).getByRole('button',{name:'Caesar',exact:true}).click()
  await page.locator('#classic-message').fill('Hello')
  await page.locator('input[type=number]').fill('3')
  await page.getByRole('button',{name:'Encrypt',exact:true}).click()
  await page.getByText('Result ready. Cipher history saved.',{exact:true}).waitFor()
  await page.getByRole('alert').filter({hasText:'Controlled refresh failure'}).waitFor()
  assert.ok((await page.locator('.responsive-table tbody').textContent()).includes('saved-history'))
  assert.equal(await page.locator('#classic-result').inputValue(),'Khoor')
  console.log('Cipher history QA passed: confirmed receipt displays immediately and a failed refresh does not erase it or report a failed insert.')
 } finally {await browser.close()}
}
main().catch(error=>{console.error(error);process.exitCode=1})
