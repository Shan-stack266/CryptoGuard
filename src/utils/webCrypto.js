import { calculateShannonEntropy } from './entropy.js'

const encoder = new TextEncoder()
const decoder = new TextDecoder()

function bytesToHex(bytes) {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

function hexToBytes(hex) {
  const pairs = hex.match(/.{1,2}/g) ?? []
  return new Uint8Array(pairs.map((pair) => Number.parseInt(pair, 16)))
}

function bytesToBase64(bytes) {
  return btoa(String.fromCharCode(...bytes))
}

function base64ToBytes(base64) {
  return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0))
}

export async function deriveKey(passphrase, salt, iterations = 120000) {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey'],
  )

  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-512' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

export async function sha256Digest(value) {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(value))
  return bytesToHex(new Uint8Array(digest))
}

export async function encryptAESGCM(plaintext, passphrase, iterations = 120000) {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const key = await deriveKey(passphrase, salt, iterations)
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoder.encode(plaintext))
  const ciphertext = new Uint8Array(encrypted)
  const payload = {
    v: 1,
    alg: 'AES-256-GCM',
    kdf: 'PBKDF2-SHA512',
    iterations,
    salt: bytesToHex(salt),
    iv: bytesToHex(iv),
    ciphertext: bytesToBase64(ciphertext),
  }

  return {
    ...payload,
    armor: btoa(JSON.stringify(payload)),
    entropy: calculateShannonEntropy(bytesToBase64(ciphertext)),
    digest: await sha256Digest(`${passphrase}:${payload.salt}:${payload.iv}`),
  }
}

export async function decryptAESGCM(armor, passphrase) {
  const payload = JSON.parse(atob(armor.trim()))
  const salt = hexToBytes(payload.salt)
  const iv = hexToBytes(payload.iv)
  const key = await deriveKey(passphrase, salt, payload.iterations)
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    base64ToBytes(payload.ciphertext),
  )

  return decoder.decode(decrypted)
}
