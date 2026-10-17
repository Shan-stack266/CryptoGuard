// Intercepted registration requests; does not create real accounts.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || `${process.env.TEMP}/cinifix-browser-qa/node_modules/playwright`)
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path')
async function main(){
 const browser=await chromium.launch({channel:'chrome',headless:true})
 try {
  const page=await browser.newPage();let requests=0,received
  await page.route('**/api/**',async route=>{
   const p=new URL(route.request().url()).pathname
   if(p==='/api/auth/session')return route.fulfill({status:401,contentType:'application/json',body:JSON.stringify({error:'Log in to continue.'})})
   if(p==='/api/auth/signup'){
    requests++;received=route.request().postDataJSON()
    return route.fulfill({status:received.username==='taken_user'?409:201,contentType:'application/json',body:JSON.stringify(received.username==='taken_user'?{error:'Username is not available. Choose another one.'}:{message:'Account created. You can log in now.'})})
   }
   throw Error('Unexpected registration QA route')
  })
  await page.goto(process.env.QA_URL || 'http://localhost:5173')
  await page.getByRole('button',{name:'Open profile login'}).click()
  await page.getByRole('button',{name:'Sign up',exact:true}).click()
  assert.equal(await page.getByRole('dialog').locator('input').count(),5)
  await page.getByLabel('Full name',{exact:true}).fill("Jo O'Connor")
  await page.getByLabel('Username',{exact:true}).fill('taken_user')
  await page.getByLabel('Email address',{exact:true}).fill('signup@example.test')
  await page.getByLabel('Password',{exact:true}).fill('test-password')
  await page.getByLabel('Confirm password',{exact:true}).fill('different-password')
  await page.getByRole('button',{name:'Create account',exact:true}).click()
  await page.getByText('Passwords do not match.',{exact:true}).waitFor();assert.equal(requests,0)
  await page.getByLabel('Confirm password',{exact:true}).fill('test-password')
  await page.getByRole('button',{name:'Create account',exact:true}).click()
  await page.getByText('Username is not available. Choose another one.',{exact:true}).waitFor()
  const shots=path.join(process.env.TEMP,'cinifix-layout-qa');fs.mkdirSync(shots,{recursive:true})
  for(const width of [1440,768,390,320]){
   await page.setViewportSize({width,height:740})
   const issues=await page.getByRole('dialog').evaluate(el=>{
    const r=el.getBoundingClientRect();return{overflow:el.scrollWidth>el.clientWidth+1,outside:r.left<0||r.right>innerWidth+1||r.top<0||r.bottom>innerHeight+1}
   })
   assert.deepEqual(issues,{overflow:false,outside:false},`Signup dialog at ${width}px`)
   if([1440,390].includes(width))await page.screenshot({path:path.join(shots,`signup-${width}.png`)})
  }
  await page.getByLabel('Username',{exact:true}).fill('available_user')
  await page.getByRole('button',{name:'Show password',exact:true}).click()
  assert.equal(await page.getByLabel('Confirm password',{exact:true}).getAttribute('type'),'text')
  await page.getByRole('button',{name:'Create account',exact:true}).click()
  await page.getByRole('heading',{name:'Welcome back',exact:true}).waitFor()
  assert.deepEqual(received,{full_name:"Jo O'Connor",username:'available_user',email:'signup@example.test',password:'test-password',confirm_password:'test-password'})
  assert.equal(await page.getByRole('dialog').locator('input').count(),2)
  assert.equal(await page.getByLabel('Password',{exact:true}).inputValue(),'')
  console.log('Signup QA passed: five required fields, password confirmation, duplicate usernames, show-password, mobile dialog bounds, and return to two-field login.')
 } finally {await browser.close()}
}
main().catch(error=>{console.error(error);process.exitCode=1})
