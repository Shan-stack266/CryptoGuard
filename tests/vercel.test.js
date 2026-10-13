import test from 'node:test'
import assert from 'node:assert/strict'
import { Readable } from 'node:stream'
import { createApplication } from '../server/application.js'
import vercelHandler from '../api/handler.js'

test('Vercel configuration uses HTTPS cookies and trusted platform proxy, while local development keeps its defaults', () => {
 const local=createApplication({}).config
 assert.equal(local.origin,'http://localhost:5173')
 assert.equal(local.secure,false)
 assert.equal(local.trustProxy,false)
 const deployed=createApplication({VERCEL_PROJECT_PRODUCTION_URL:'cryptoguard-two.vercel.app'},{vercel:true}).config
 assert.equal(deployed.origin,'https://cryptoguard-two.vercel.app')
 assert.equal(deployed.secure,true)
 assert.equal(deployed.trustProxy,true)
 assert.equal(deployed.ready,false)
})

test('Vercel rewrite reaches API routes with parsed JSON and preserves query filters', async () => {
 const values={SUPABASE_URL:'https://example.supabase.co',SUPABASE_ANON_KEY:'test-anon',SUPABASE_SERVICE_ROLE_KEY:'test-service',APP_ORIGIN:'https://cryptoguard-two.vercel.app'}
 const previous=Object.fromEntries(Object.keys(values).map(key=>[key,process.env[key]]))
 Object.assign(process.env,values)
 try {
  async function invoke(path,body,origin=values.APP_ORIGIN) {
   const request=Readable.from([])
   request.url=`/api/handler?__cg_path=${path}&kind=model&page=2`
   request.method=body===undefined?'GET':'POST'
   request.body=body
   request.headers={origin,'x-forwarded-for':'192.0.2.10'}
   request.socket={remoteAddress:'127.0.0.1'}
   let payload;const headers={}
   const response={statusCode:200,setHeader(key,value){headers[key]=value},end(value){payload=JSON.parse(value)}}
   await vercelHandler(request,response)
   assert.equal(new URL(request.url,'http://internal').searchParams.get('kind'),'model')
   assert.equal(new URL(request.url,'http://internal').searchParams.get('page'),'2')
   assert.ok(!request.url.includes('__cg_path'))
   return{status:response.statusCode,payload,headers}
  }
  const health=await invoke('health')
  assert.equal(health.status,200);assert.equal(health.payload.configured,true)
  assert.equal((await invoke('auth/login',{})).status,400)
  assert.equal((await invoke('auth/login',{},'https://attacker.test')).status,403)
 } finally {for(const [key,value]of Object.entries(previous))if(value===undefined)delete process.env[key];else process.env[key]=value}
})
