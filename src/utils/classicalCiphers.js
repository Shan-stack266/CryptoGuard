export const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
const SQUARE_ALPHABET = 'ABCDEFGHIKLMNOPQRSTUVWXYZ'
const mod = (value, base) => ((value % base) + base) % base

// Filter ASCII before uppercasing: Unicode case expansion must not invent letters.
export const normalizeSquareText = (text) => text.replace(/[^a-zA-Z]/g, '').toUpperCase().replace(/J/g, 'I')

export function validateKeyword(keyword, square = false) {
  if (typeof keyword !== 'string' || !/^[a-zA-Z]+(?:\s+[a-zA-Z]+)*$/.test(keyword.trim())) {
    throw new Error('Enter a keyword containing A–Z letters (spaces between words are allowed).')
  }
  return square ? normalizeSquareText(keyword) : keyword.replace(/\s/g, '').toUpperCase()
}

export function createSquare(keyword) {
  return [...new Set(validateKeyword(keyword, true) + SQUARE_ALPHABET)].join('')
}

export function validateInteger(value, min, max, name) {
  if ((typeof value === 'string' && !value.trim()) || value === null || typeof value === 'boolean' || !Number.isInteger(Number(value)) || Number(value) < min || Number(value) > max) {
    throw new Error(`${name} must be a whole number from ${min} to ${max}.`)
  }
  return Number(value)
}

function shiftLetter(char, shift) {
  const base = char >= 'a' && char <= 'z' ? 97 : 65
  return String.fromCharCode(base + mod(char.charCodeAt(0) - base + shift, 26))
}

export function caesar(text, shift, decrypt = false) {
  shift = validateInteger(shift, 0, 25, 'Shift')
  const amount = decrypt ? -shift : shift
  return {
    output: text.replace(/[a-zA-Z]/g, (char) => shiftLetter(char, amount)),
    shiftedAlphabet: [...ALPHABET].map((char) => shiftLetter(char, amount)).join(''),
  }
}

export function vigenere(text, keyword, decrypt = false) {
  const key = validateKeyword(keyword)
  let index = 0
  const steps = []
  const output = text.replace(/[a-zA-Z]/g, (char) => {
    const keyLetter = key[index % key.length]
    const result = shiftLetter(char, (decrypt ? -1 : 1) * (keyLetter.charCodeAt(0) - 65))
    // Bounded display trace; the entire message is still processed.
    if (steps.length < 100) steps.push({ input: char, key: keyLetter, output: result, index })
    index++
    return result
  })
  return { output, steps, letterCount: index }
}

export function preparePlayfair(text) {
  const normalized = normalizeSquareText(text)
  const pairs = []
  let fillers = 0
  for (let i = 0; i < normalized.length;) {
    const first = normalized[i]
    const second = normalized[i + 1]
    if (!second || first === second) {
      pairs.push(first + (first === 'X' ? 'Q' : 'X'))
      fillers++
      i++
    } else {
      pairs.push(first + second)
      i += 2
    }
  }
  return { normalized, pairs, fillers }
}

export function playfair(text, keyword, decrypt = false) {
  const square = createSquare(keyword)
  const normalized = normalizeSquareText(text)
  if (decrypt && normalized.length % 2) throw new Error('Playfair ciphertext must contain an even number of letters; it is never padded during decryption.')
  const prepared = decrypt
    ? { normalized, pairs: normalized.match(/.{2}/g) ?? [], fillers: 0 }
    : preparePlayfair(text)
  const steps = []
  const output = prepared.pairs.map((pair, index) => {
    const a = square.indexOf(pair[0]), b = square.indexOf(pair[1])
    const ar = Math.floor(a / 5), ac = a % 5, br = Math.floor(b / 5), bc = b % 5
    const direction = decrypt ? -1 : 1
    let result, rule
    if (ar === br) {
      result = square[ar * 5 + mod(ac + direction, 5)] + square[br * 5 + mod(bc + direction, 5)]
      rule = 'Same row'
    } else if (ac === bc) {
      result = square[mod(ar + direction, 5) * 5 + ac] + square[mod(br + direction, 5) * 5 + bc]
      rule = 'Same column'
    } else {
      result = square[ar * 5 + bc] + square[br * 5 + ac]
      rule = 'Rectangle'
    }
    if (index < 100) steps.push({ input: pair, output: result, rule })
    return result
  }).join('')
  return { output, square, normalized, processed: prepared.pairs.join(''), fillers: prepared.fillers, steps, pairCount: prepared.pairs.length }
}

export function bifid(text, keyword, period = 5, decrypt = false) {
  const square = createSquare(keyword)
  period = validateInteger(period, 1, 10000, 'Period')
  const normalized = normalizeSquareText(text)
  const blocks = []
  let output = ''
  let blockCount = 0
  for (let start = 0; start < normalized.length; start += period) {
    const input = normalized.slice(start, start + period)
    const coords = [...input].map((char) => {
      const position = square.indexOf(char)
      return [Math.floor(position / 5) + 1, position % 5 + 1]
    })
    const stream = decrypt ? coords.flat() : [...coords.map((c) => c[0]), ...coords.map((c) => c[1])]
    const rows = decrypt ? stream.slice(0, input.length) : coords.map((c) => c[0])
    const columns = decrypt ? stream.slice(input.length) : coords.map((c) => c[1])
    const resultPairs = Array.from({ length: input.length }, (_, i) => decrypt ? [rows[i], columns[i]] : [stream[2 * i], stream[2 * i + 1]])
    const result = resultPairs.map(([row, col]) => square[(row - 1) * 5 + col - 1]).join('')
    if (blocks.length < 20) blocks.push({ input, coords, stream, rows, columns, resultPairs, output: result })
    blockCount++
    output += result
  }
  return { output, square, normalized, blocks, blockCount, period }
}

export function runCipher(cipher, text, settings, decrypt = false) {
  if (!text.trim()) throw new Error('Enter a message to process.')
  if ((cipher === 'playfair' || cipher === 'bifid') && !normalizeSquareText(text)) throw new Error('This cipher needs at least one A–Z letter.')
  switch (cipher) {
    case 'caesar': return caesar(text, settings.shift, decrypt)
    case 'playfair': return playfair(text, settings.keyword, decrypt)
    case 'bifid': return bifid(text, settings.keyword, settings.period, decrypt)
    case 'vigenere': return vigenere(text, settings.keyword, decrypt)
    default: throw new Error('Select a supported cipher.')
  }
}
