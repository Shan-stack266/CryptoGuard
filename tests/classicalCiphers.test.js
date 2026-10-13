import test from 'node:test'
import assert from 'node:assert/strict'
import { ALPHABET, createSquare, normalizeSquareText, preparePlayfair, caesar, playfair, bifid, vigenere, runCipher } from '../src/utils/classicalCiphers.js'

// Published Playfair example: https://uomustansiriyah.edu.iq/media/lectures/5/5_2021_06_12%2105_37_05_PM.pdf
test('Playfair published encryption and decryption vector', () => {
  const key = 'playfair example', message = 'hide the gold in the tree stump'
  const ciphertext = 'BMODZBXDNABEKUDMUIXMMOUVIF'
  assert.equal(playfair(message, key).output, ciphertext)
  assert.equal(playfair(ciphertext, key, true).output, 'HIDETHEGOLDINTHETREXESTUMP')
  assert.equal(createSquare(key), 'PLAYFIREXMBCDGHKNOQSTUVWZ')
})

test('Playfair row, column, rectangle and wrap rules', () => {
  // Alphabetical square (keyword A), hand-derived coordinates.
  for (const [plain, encrypted] of [['AB', 'BC'], ['EA', 'AB'], ['AF', 'FL'], ['VA', 'AF'], ['AG', 'BF']]) {
    assert.equal(playfair(plain, 'A').output, encrypted)
    assert.equal(playfair(encrypted, 'A', true).output, plain)
  }
})

test('Playfair repeated letters, odd endings, X fillers and J normalization', () => {
  assert.deepEqual(preparePlayfair('BALLOON').pairs, ['BA', 'LX', 'LO', 'ON'])
  assert.deepEqual(preparePlayfair('XXX').pairs, ['XQ', 'XQ', 'XQ'])
  assert.deepEqual(preparePlayfair('cat').pairs, ['CA', 'TX'])
  assert.equal(normalizeSquareText('Jig, jAZZ! 9 éß 🧊'), 'IIGIAZZ')
  for (const text of ['BALLOON', 'XXX', 'cat', 'Jig, jAZZ! 9 éß 🧊']) {
    assert.equal(playfair(playfair(text, 'MONARCHY').output, 'MONARCHY', true).output, preparePlayfair(text).pairs.join(''))
  }
  assert.throws(() => playfair('ABC', 'KEY', true), /even/)
})

test('Caesar fixed shift vectors, case and punctuation', () => {
  assert.equal(caesar('Attack at dawn! 123', 3).output, 'Dwwdfn dw gdzq! 123')
  assert.equal(caesar('Dwwdfn dw gdzq! 123', 3, true).output, 'Attack at dawn! 123')
  assert.equal(caesar('Az az éß 🧊', 25).output, 'Zy zy éß 🧊')
  assert.equal(caesar('Az az', 0).output, 'Az az')
  assert.equal(caesar('', 3).shiftedAlphabet, 'DEFGHIJKLMNOPQRSTUVWXYZABC')
  assert.equal(caesar('', 3, true).shiftedAlphabet, 'XYZABCDEFGHIJKLMNOPQRSTUVW')
  for (let shift = 0; shift < 26; shift++) {
    const message = ALPHABET + ALPHABET.toLowerCase() + '\n9 ! éß'
    assert.equal(caesar(caesar(message, shift).output, shift, true).output, message)
  }
})

// Published Vigenère vector: https://repository.uobabylon.edu.iq/2011_2012/paper_11_1363_649.pdf
test('Vigenère published vector and alphabet-only key progression', () => {
  assert.equal(vigenere('ATTACKATDAWN', 'LEMON').output, 'LXFOPVEFRNHR')
  assert.equal(vigenere('LXFOPVEFRNHR', 'LEMON', true).output, 'ATTACKATDAWN')
  assert.equal(vigenere('Attack, at dawn! 123 éß🧊', 'le mon').output, 'Lxfopv, ef rnhr! 123 éß🧊')
  const result = vigenere('A! a2A', 'BC')
  assert.equal(result.output, 'B! c2B')
  assert.deepEqual(result.steps.map((s) => s.key), ['B', 'C', 'B'])
})

// Salisbury University, Cryptography Notes, Example 32, p.127:
// https://faculty.salisbury.edu/~despickler/distros/Cryptography/CryptographyNotes.pdf
// Supply the published complete square as the keyword, with period 10.
test('Bifid published square, coordinates and ciphertext', () => {
  const key = 'BGWKZQPNDSIOAXEFCLUMTHYVR'
  const encrypted = bifid('FLEE AT ONCE', key, 10)
  assert.equal(encrypted.output, 'UAEOLWRINS')
  assert.equal(encrypted.blocks[0].stream.join(''), '44333532431355312325')
  assert.equal(bifid('UAEOLWRINS', key, 10, true).output, 'FLEEATONCE')
})

test('Bifid independently hand-derived vectors for multiple periods and short last blocks', () => {
  // Alphabetical square: F G H I K occupy row 2 (23 = H, 24 = I).
  for (const [period, ciphertext] of [[1, 'ABCDEF'], [2, 'ABAOBV'], [3, 'AAHAIV'], [5, 'AAAHUF']]) {
    assert.equal(bifid('ABCDEF', 'A', period).output, ciphertext)
    assert.equal(bifid(ciphertext, 'A', period, true).output, 'ABCDEF')
  }
  assert.equal(bifid('ABCDEF', 'A').period, 5)
  for (const period of [1, 2, 5, 7, 100, 10000]) {
    const text = 'Jig, balloon! 123 éß🧊'
    assert.equal(bifid(bifid(text, 'SECRET', period).output, 'SECRET', period, true).output, normalizeSquareText(text))
  }
})

test('Square keys remove duplicates and combine I/J', () => {
  const square = createSquare('JIG JIG')
  assert.equal(square.length, 25)
  assert.equal(new Set(square).size, 25)
  assert.equal(square.slice(0, 2), 'IG')
  assert.ok(!square.includes('J'))
})

test('Empty input is supported by algorithms; UI processing rejects empty or unprocessable input', () => {
  for (const cipher of [playfair, bifid, vigenere]) assert.equal(cipher('', 'KEY').output, '')
  assert.equal(caesar('', 3).output, '')
  for (const cipher of ['playfair', 'caesar', 'bifid', 'vigenere']) assert.throws(() => runCipher(cipher, '   ', { keyword: 'KEY', shift: 3, period: 5 }), /message/)
  assert.throws(() => runCipher('bifid', '123 éß!', { keyword: 'KEY', period: 5 }), /letter/)
  assert.equal(vigenere('123 éß!', 'KEY').output, '123 éß!')
})

test('Invalid keywords, shifts, periods and unknown ciphers fail clearly', () => {
  for (const key of ['', '   ', '123', 'K3Y', 'é', 'KEY!', 'ß']) {
    for (const cipher of [playfair, bifid, vigenere]) assert.throws(() => cipher('ABC', key), /keyword/)
  }
  for (const shift of ['', -1, 26, 1.5, NaN, Infinity, null, true]) assert.throws(() => caesar('A', shift), /Shift/)
  for (const period of ['', 0, -1, 1.5, 10001, NaN, Infinity, null, true]) assert.throws(() => bifid('ABC', 'KEY', period), /Period/)
  assert.throws(() => runCipher('unknown', 'ABC', {}), /supported/)
})

test('Long messages round-trip fully while visualization traces stay bounded', () => {
  const text = 'Balloon, XX jAZZ! 12 éß🧊\n'.repeat(2000)
  const pf = playfair(text, 'KEY')
  assert.equal(playfair(pf.output, 'KEY', true).output, preparePlayfair(text).pairs.join(''))
  assert.equal(pf.steps.length, 100)
  const bf = bifid(text, 'KEY', 7)
  assert.equal(bifid(bf.output, 'KEY', 7, true).output, normalizeSquareText(text))
  assert.equal(bf.blocks.length, 20)
  const vg = vigenere(text, 'LEMON')
  assert.equal(vigenere(vg.output, 'LEMON', true).output, text)
  assert.equal(vg.steps.length, 100)
  assert.equal(caesar(caesar(text, 13).output, 13, true).output, text)
})
