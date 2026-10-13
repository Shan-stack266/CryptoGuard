import test from 'node:test'
import assert from 'node:assert/strict'
import { allowedOrigins } from '../server/origins.js'

test('development accepts configured loopback aliases and extra port only', () => {
  const origins = allowedOrigins({origin:'http://localhost:5173',additionalOrigins:['http://localhost:5174'],secure:false})
  for (const port of [5173,5174]) for (const host of ['localhost','127.0.0.1','[::1]']) assert.ok(origins.has(`http://${host}:${port}`))
  for (const value of [undefined,'null','http://localhost:5175','https://localhost:5173','https://attacker.test','http://localhost.attacker.test:5173']) assert.equal(origins.has(value),false)
})

test('production retains exact configured origins without local alias expansion', () => {
  const origins = allowedOrigins({origin:'https://app.example.test',secure:true})
  assert.deepEqual([...origins],['https://app.example.test'])
  const local = allowedOrigins({origin:'http://localhost:5173',secure:true})
  assert.equal(local.has('http://127.0.0.1:5173'),false)
})
