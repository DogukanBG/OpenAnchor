// Compares two transaction descriptions by the words they share.
//
// Bank descriptions for the same shop repeat almost word for word, for
// example "REWE SAGT DANKE 4821" and "REWE SAGT DANKE 7734". Counting
// shared words is enough to match them. No AI model is needed.

export function normalizeTokens(str) {
  return new Set(
    String(str)
      .toLowerCase()
      .replace(/[^a-z0-9äöüß\s]/gi, ' ')
      .split(/\s+/)
      .filter(t => t.length > 1)
  )
}

// Returns a score from 0 (nothing in common) to 1 (identical words).
export function jaccardSimilarity(a, b) {
  const setA = normalizeTokens(a)
  const setB = normalizeTokens(b)
  if (setA.size === 0 || setB.size === 0) return 0
  let intersection = 0
  for (const t of setA) if (setB.has(t)) intersection++
  const union = setA.size + setB.size - intersection
  return union === 0 ? 0 : intersection / union
}
