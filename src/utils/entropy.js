export function calculateShannonEntropy(input) {
  const str = String(input ?? '')
  if (!str.length) return 0

  const frequencies = new Map()
  for (const char of str) {
    frequencies.set(char, (frequencies.get(char) ?? 0) + 1)
  }

  let entropy = 0
  for (const count of frequencies.values()) {
    const probability = count / str.length
    entropy -= probability * Math.log2(probability)
  }

  return Number(entropy.toFixed(4))
}
