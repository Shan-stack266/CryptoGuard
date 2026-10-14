// UI contract tests use intercepted API responses, not a live Supabase project.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || `${process.env.TEMP}/cinifix-browser-qa/node_modules/playwright`)
const assert = require('node:assert/strict')
async function main() {
 const browser = await chromium.launch({channel:'chrome',headless:true})
 try {
  const context = await browser.newContext({permissions:['clipboard-read','clipboard-write'],acceptDownloads:true})
  const page = await context.newPage(), errors=[]
  page.on('pageerror',error=>errors.push(error.message))
  page.on('console',message=>{if(message.type()==='error'&&!/Failed to load resource.*401/.test(message.text()))errors.push(message.text())})
  const profile={id:'11111111-1111-4111-8111-111111111111',email:'ui-test@example.test',role:'admin',active:true}
  const state={policies:{maxFailures:5,maxRequests:120,maxPayload:1024,alertThreshold:50,blockThreshold:75,autoBlock:true,emergency:false},events:[],alerts:[],audit:[],blockedIPs:[],ledger:[],accounts:[profile],accountLogs:[],model:{status:'Collecting baseline',samples:0}}
  const requestCounts={state:0,summary:0}
  let signedIn=false
  await page.route('**/api/**',async route=>{
   const request=route.request(), path=new URL(request.url()).pathname
   let body={},status=200
   if(path==='/api/auth/session'){status=signedIn?200:401;body=signedIn?{user:profile}:{error:'Log in to continue.'}}
   else if(path==='/api/auth/login'){signedIn=true;body={user:profile}}
   else if(path==='/api/auth/logout'){signedIn=false;body={ok:true}}
   else if(path==='/api/state'){requestCounts.state++;body=state}
   else if(path==='/api/summary'){requestCounts.summary++;body={users:1,active:1,failures:0,denied:0,open:0,ack:0,restrictions:0}}
   else if(path==='/api/logs'){const rows=new URL(request.url()).searchParams.get('kind')==='account'?state.accountLogs:state.events;body={rows,total:rows.length,page:1,size:20}}
   else if(path==='/api/profile'){Object.assign(profile,request.postDataJSON());body={user:profile}}
   else if(path==='/api/ciphers'){const entry={...request.postDataJSON(),id:crypto.randomUUID(),timestamp:new Date().toISOString()};state.ledger.unshift(entry);body=entry;status=201}
   else if(path==='/api/security/analyze')body={...state.events[0],model:{status:'Ready',samples:25,novelty:0.5,threshold:1,anomalous:false,explanations:[]}}
   else if(path==='/api/policies'){state.policies=request.postDataJSON();body={ok:true}}
   else if(path==='/api/accounts'){Object.assign(profile,request.postDataJSON());body={ok:true}}
   else if(path==='/api/audit'){state.audit.unshift({...request.postDataJSON(),id:crypto.randomUUID(),timestamp:new Date().toISOString()});body={ok:true}}
   else if(path==='/api/auth/recover')body={message:'If the account exists, a recovery email will be sent.'}
   else {status=404;body={error:'Unexpected test route.'}}
   await route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)})
  })
  await page.goto(process.env.QA_URL||'http://127.0.0.1:5173/')
  await page.getByRole('button',{name:'Open profile login'}).click()
  await page.getByRole('button',{name:'Sign up',exact:true}).click()
  assert.equal(await page.getByRole('dialog').locator('input').count(),2)
  await page.getByRole('button',{name:'Back to login'}).click()
  await page.getByLabel('Email address',{exact:true}).fill('ui-test@example.test')
  await page.getByLabel('Password',{exact:true}).fill('testingpassword')
  await page.getByRole('button',{name:'Log in',exact:true}).click()
  await page.getByRole('heading',{name:'CRYPTOGUARD Overview'}).waitFor()
  await page.waitForFunction(()=>document.querySelector('.overview-stats')?.getAttribute('aria-busy')==='false')
  const metrics=await page.locator('.dashboard-stat-card strong').allTextContents()
  assert.equal(metrics.length,4)
  assert.equal(requestCounts.state,1,'Initial state request should be coalesced')
  assert.equal(requestCounts.summary,1,'Summary should load once alongside state')
  assert.equal(await page.getByRole('button',{name:/Emergency Lockout Protocol|Release Emergency Lockout/}).count(),0)
  assert.ok(metrics.every(value=>value==='0'))
  await page.getByRole('button',{name:'Account',exact:true}).click()
  await page.getByLabel('Display name').fill('Personal test name')
  await page.getByRole('button',{name:'Save profile'}).click()
  await page.getByText('Profile saved.',{exact:true}).waitFor()
  await page.getByRole('button',{name:'Account',exact:true}).click()
  const nav=name=>page.locator('.dashboard-nav').getByRole('button',{name,exact:true}).click()
  await nav('Cryptography')
  assert.equal(await page.locator('#classic-message').inputValue(),'')
  assert.equal(await page.getByLabel('Keyword (A–Z; spaces allowed)').inputValue(),'')
  await page.getByLabel('Keyword (A–Z; spaces allowed)').fill('PLAYFAIR EXAMPLE')
  await page.locator('#classic-message').fill('hide the gold in the tree stump')
  await page.getByRole('button',{name:'Encrypt',exact:true}).click()
  assert.equal(await page.locator('#classic-result').inputValue(),'BMODZBXDNABEKUDMUIXMMOUVIF')
  await page.waitForFunction(()=>document.querySelector('.responsive-table')?.textContent.includes('Playfair'))
  assert.equal(state.ledger[0].digest.length,64)
  await page.getByRole('button',{name:'Copy Result'}).click()
  assert.equal(await page.evaluate(()=>navigator.clipboard.readText()),'BMODZBXDNABEKUDMUIXMMOUVIF')
  const cipher=name=>page.getByRole('group',{name:'Select cipher'}).getByRole('button',{name,exact:true}).click()
  await cipher('Caesar');await page.getByLabel('Shift (0–25)').fill('3');await page.locator('#classic-message').fill('Hello! 123')
  await page.getByRole('button',{name:'Encrypt',exact:true}).click();assert.equal(await page.locator('#classic-result').inputValue(),'Khoor! 123')
  await cipher('Bifid');await page.getByLabel('Keyword (A–Z; spaces allowed)').fill('BGWKZQPNDSIOAXEFCLUMTHYVR');await page.getByLabel('Period (default 5; range 1–10,000)').fill('10');await page.locator('#classic-message').fill('FLEEATONCE')
  await page.getByRole('button',{name:'Encrypt',exact:true}).click();assert.equal(await page.locator('#classic-result').inputValue(),'UAEOLWRINS')
  await cipher('Vigenère');await page.getByLabel('Keyword (A–Z; spaces allowed)').fill('LEMON');await page.locator('#classic-message').fill('Attack at dawn!')
  await page.getByRole('button',{name:'Encrypt',exact:true}).click();assert.equal(await page.locator('#classic-result').inputValue(),'Lxfopv ef rnhr!')
  assert.equal(await page.locator('.cipher-tabula tbody td').count(),676)
  await page.locator('.aes-studio summary').click()
  assert.equal(await page.getByLabel('AES plaintext').inputValue(),'')
  const aes=page.locator('.aes-studio')
  await page.getByLabel('AES plaintext').fill('Real input for UI verification.')
  await aes.getByLabel('Passphrase',{exact:true}).fill('actual-test-passphrase')
  await page.getByRole('button',{name:'Encrypt Payload'}).click()
  await page.waitForFunction(()=>document.querySelector('.cipher-output').textContent!=='Ciphertext armor will appear here.')
  await page.getByRole('button',{name:'Decrypt Payload'}).click()
  await page.waitForFunction(()=>document.querySelector('.plain-output').textContent==='Real input for UI verification.')
  await nav('AI Security');assert.ok(await page.getByRole('button',{name:'Analyze recorded event'}).isDisabled())
  await nav('Alerts');assert.equal(await page.locator('.security-alert-row').count(),0)
  await nav('Prevention');assert.equal(await page.getByRole('heading',{name:'Access and detection policies',exact:true}).count(),0);assert.equal(await page.getByRole('heading',{name:'Emergency access restriction',exact:true}).count(),0);await page.getByLabel('Select account',{exact:true}).selectOption(profile.id);await page.getByRole('heading',{name:'Access and detection policies',exact:true}).waitFor();await page.getByRole('button',{name:'Enable emergency lockout'}).click()
  await page.getByRole('button',{name:'Release emergency lockout'}).waitFor();await page.getByLabel('Select account',{exact:true}).selectOption('');assert.equal(await page.getByRole('heading',{name:'Emergency access restriction',exact:true}).count(),0)
  await nav('Reports')
  await page.getByRole('button',{name:'Hash activity snapshot',exact:true}).click()
  await page.waitForFunction(()=>document.querySelector('[role="status"]')?.textContent?.includes('Snapshot hashed'))
  assert.ok(state.audit.some(row=>row.operation==='Snapshot SHA-256'&&/^[a-f0-9]{64}$/.test(row.detail)))
  await page.getByLabel('Record type').selectOption('Cipher')
  const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Export JSON'}).click()
  const stream=await(await downloadPromise).createReadStream(),chunks=[]
  for await(const chunk of stream)chunks.push(chunk)
  const report=JSON.parse(Buffer.concat(chunks).toString('utf8'))
  assert.ok(report.records.some(row=>row.algorithm==='Playfair'))
  assert.ok(report.records.every(row=>!('password'in row)&&!('keyword'in row)))
  // Populated fixtures stay in this intercepted browser session; no database records are created.
  state.events=Array.from({length:6},(_,i)=>({id:`event-${i}`,user_id:profile.id,timestamp:new Date(Date.now()-i*300000).toISOString(),identity:'long-account-name-for-layout-verification@example.test',ip:'192.0.2.1',operation:i?'Encrypt Vigen\u00e8re':'Login',decision:i?'Blocked':'Allowed',severity:'High',score:75+i,failures:2,requests:120,payload:1024,reasons:[{text:'Repeated activity requiring review.'}],controls:[],model:{status:'Ready',method:'kNN novelty',anomalous:true,samples:25}}))
  state.alerts=[{id:'alert-layout',event_id:'event-0',timestamp:new Date().toISOString(),identity:state.events[0].identity,title:'Repeated access attempts with an unusually long explanation for layout verification',severity:'High',score:80,status:'Open',note:''}]
  state.accountLogs=[{id:'account-layout',target_id:profile.id,operation:'Profile data changed',timestamp:new Date().toISOString(),detail:{field:'display_name'}}]
  await page.getByRole('button',{name:'Refresh',exact:true}).click()
  const fs=require('node:fs'),path=require('node:path'),shots=path.join(process.env.TEMP,'cinifix-layout-qa')
  fs.mkdirSync(shots,{recursive:true})
  async function layout(label,width){
   await page.evaluate(()=>document.fonts.ready)
   const issues=await page.evaluate(()=>{
    const problems=[],rect=e=>e.getBoundingClientRect(),visible=e=>e.getClientRects().length>0
    if(document.documentElement.scrollWidth>innerWidth+1)problems.push('document overflows horizontally')
    for(const parent of document.querySelectorAll('.dashboard-content,.dashboard-overview,.overview-user-stack,.overview-split,.overview-three,.workspace-account-grid,.dashboard-chart-grid,.dashboard-lower-grid,.dashboard-stat-grid,.security-grid,.security-filters,.security-date-range,.security-pagination,.security-view .dashboard-panel,.cipher-layout,.studio-grid,.landing-grid,.feature-switchers')){
     const children=[...parent.children].filter(e=>visible(e)&&getComputedStyle(e).position!=='absolute')
     for(let i=0;i<children.length;i++)for(let j=i+1;j<children.length;j++){
      const a=rect(children[i]),b=rect(children[j]);if(Math.min(a.right,b.right)-Math.max(a.left,b.left)>2&&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>2)problems.push(`${parent.className}: ${children[i].className} overlaps ${children[j].className}`)
     }
    }
    for(const el of document.querySelectorAll('.dashboard-shell h1,.dashboard-shell h2,.dashboard-shell p,.hero-copy h1'))if(visible(el)&&el.scrollWidth>el.clientWidth+2)problems.push(`${el.tagName} text overflows: ${el.textContent.slice(0,50)}`)
    const sidebar=document.querySelector('.dashboard-sidebar'),topbar=document.querySelector('.dashboard-topbar')
    if(sidebar&&innerWidth<=1180&&getComputedStyle(sidebar).position!=='static')problems.push('mobile sidebar covers content')
    if(topbar&&innerWidth<=1180&&getComputedStyle(topbar).position!=='static')problems.push('mobile topbar covers content')
    return problems
   })
   assert.deepEqual(issues,[],`${label} at ${width}px: ${issues.join('; ')}`)
  }
  for(const width of [1920,1440,1320,1180,1024,980,768,640,390,320]){
   await page.setViewportSize({width,height:900})
   for(const view of ['Dashboard Overview','Cryptography','AI Security','Alerts','Prevention','Reports','User Activity Logs','Account Logs','Security Events','AI Detection Results']){
    await nav(view)
    if(view==='AI Security'&&width===1440){await page.getByLabel('Activity record',{exact:true}).selectOption('event-0');await page.getByRole('button',{name:'Analyze recorded event',exact:true}).click();await page.getByRole('heading',{name:'Model result',exact:true}).waitFor()}
    if(view==='Prevention')await page.getByLabel('Select account',{exact:true}).selectOption(profile.id)
    if(view.endsWith('Logs')||view==='Security Events'||view==='AI Detection Results'){
     await page.getByRole('button',{name:'View details',exact:true}).first().waitFor()
     await page.getByRole('button',{name:'View details',exact:true}).first().click()
    }
    await layout(view,width)
    assert.equal(await page.locator('.dashboard-shell').evaluate(el=>getComputedStyle(el).color),'rgb(243, 241, 234)')
    if([1440,390].includes(width)&&['Dashboard Overview','Cryptography','Prevention','AI Detection Results','Reports','Alerts'].includes(view))await page.screenshot({path:path.join(shots,`${view.replaceAll(' ','-')}-${width}.png`),fullPage:true})
   }
  }
  await page.getByRole('button',{name:'Logout to landing'}).click()
  await page.getByRole('button',{name:'Open profile login'}).waitFor()
  for(const width of [1920,1440,1320,1180,1024,980,768,640,390,320]){await page.setViewportSize({width,height:900});await layout('Landing',width)}
  await page.setViewportSize({width:1440,height:900});await page.screenshot({path:path.join(shots,'landing-1440.png'),fullPage:true})
  profile.role='user';await page.getByRole('button',{name:'Open profile login'}).click();await page.getByLabel('Email address',{exact:true}).fill('ui-test@example.test');await page.getByLabel('Password',{exact:true}).fill('testingpassword');await page.getByRole('button',{name:'Log in',exact:true}).click()
  await page.getByRole('heading',{name:'CRYPTOGUARD Overview'}).waitFor()
  assert.equal(await page.locator('.dashboard-nav').getByRole('button',{name:'Prevention',exact:true}).count(),0)
  assert.equal(await page.locator('.dashboard-nav').getByRole('button',{name:'AI Security',exact:true}).count(),0)
  assert.equal(await page.locator('.overview-stats .dashboard-stat-card').count(),4)
  assert.equal(await page.getByRole('heading',{name:'Recent Cipher Operations',exact:true}).count(),1)
  assert.equal(await page.getByRole('heading',{name:'Unresolved Alerts',exact:true}).count(),0)
  for(const width of [1920,1440,1320,1180,1024,980,768,640,390,320]){
   await page.setViewportSize({width,height:900})
   for(const view of ['Dashboard Overview','Cryptography','Reports','User Activity Logs']){
    await nav(view);await layout(`User ${view}`,width)
    if(view==='Dashboard Overview'&&[1440,390].includes(width))await page.screenshot({path:path.join(shots,`user-overview-${width}.png`),fullPage:true})
   }
   await page.getByRole('button',{name:'Account',exact:true}).click();await layout('User account settings',width);await page.getByRole('button',{name:'Account',exact:true}).click()
  }
  await nav('Dashboard Overview');await page.getByRole('button',{name:'Open cipher studio',exact:true}).click();await page.getByRole('heading',{name:'Encryption & decryption',exact:true}).waitFor()
  assert.deepEqual(errors,[])
  console.log('UI contract QA passed: empty initial records, simple signup, role-aware navigation, four ciphers and AES, full digest history, exports, policy controls, logout, and empty/populated layouts at 1920/1440/1320/1180/1024/980/768/640/390/320px with overlap checks. Supabase responses were intercepted; live integration is not verified.')
 }finally{await browser.close()}
}
main().catch(error=>{console.error(error);process.exitCode=1})

