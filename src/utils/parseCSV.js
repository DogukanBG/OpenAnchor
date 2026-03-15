/**
 * Direct parser for German bank CSV statements.
 *
 * Expected columns (semicolon-separated):
 * Buchungstag | Wertstellung | Umsatzart | Buchungstext | Betrag | Währung | IBAN Kontoinhaber | Kategorie
 *
 * - Betrag: German decimal format, e.g. "1.234,56" or "-329,00"
 *   Positive = income, negative = expense
 * - Buchungstag: DD.MM.YYYY
 * - Umsatzart: e.g. "Gutschrift", "Lastschrift", "Überweisung", "Gehalt" etc.
 * - Kategorie: ignored — we use our own categorization
 */

const COL = {
  BUCHUNGSTAG:      0,
  WERTSTELLUNG:     1,
  UMSATZART:        2,
  BUCHUNGSTEXT:     3,
  BETRAG:           4,
  WAEHRUNG:         5,
  IBAN_KONTOINHABER:6,
  KATEGORIE:        7  // ignored
}

function parseGermanNumber(str) {
  if (!str) return null
  // "1.234,56" → 1234.56  |  "-329,00" → -329.00
  const cleaned = String(str).trim().replace(/\./g, '').replace(',', '.')
  const val = parseFloat(cleaned)
  return isNaN(val) ? null : val
}

function parseGermanDate(str) {
  if (!str) return null
  const s = str.trim()
  // DD.MM.YYYY
  const m = s.match(/^(\d{2})\.(\d{2})\.(\d{4})$/)
  if (m) return `${m[3]}-${m[2]}-${m[1]}`
  // DD.MM.YY
  const m2 = s.match(/^(\d{2})\.(\d{2})\.(\d{2})$/)
  if (m2) return `20${m2[3]}-${m2[2]}-${m2[1]}`
  return null
}

// Split a CSV line respecting quoted fields
function splitLine(line, sep = ';') {
  const fields = []
  let cur = ''
  let inQuote = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      inQuote = !inQuote
    } else if (ch === sep && !inQuote) {
      fields.push(cur.trim().replace(/^"|"$/g, ''))
      cur = ''
    } else {
      cur += ch
    }
  }
  fields.push(cur.trim().replace(/^"|"$/g, ''))
  return fields
}

/**
 * Parse a raw CSV string into an array of transaction objects.
 * Returns { transactions, closingBalance, error }
 */
export function parseGermanBankCSV(rawText) {
  const lines = rawText
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0)

  if (lines.length < 2) {
    return { transactions: [], closingBalance: null, error: 'CSV file appears empty' }
  }

  // Detect separator — try ; first, then ,
  const sep = lines[0].includes(';') ? ';' : ','

  // Find the header row — look for "Buchungstag" or "Buchungsdatum"
  let headerIdx = -1
  for (let i = 0; i < Math.min(lines.length, 10); i++) {
    const lower = lines[i].toLowerCase()
    if (lower.includes('buchungstag') || lower.includes('buchungsdatum') || lower.includes('betrag')) {
      headerIdx = i
      break
    }
  }

  if (headerIdx === -1) {
    // Try to parse without a header using positional columns
    headerIdx = 0
  }

  const headers = splitLine(lines[headerIdx], sep).map(h => h.toLowerCase().trim())

  // Map column names flexibly
  function colIdx(names) {
    for (const name of names) {
      const idx = headers.findIndex(h => h.includes(name))
      if (idx !== -1) return idx
    }
    return -1
  }

  const idxDate  = colIdx(['buchungstag', 'buchungsdatum', 'datum', 'date'])
  const idxDesc  = colIdx(['buchungstext', 'verwendungszweck', 'beschreibung', 'text', 'description'])
  const idxAmt   = colIdx(['betrag', 'amount', 'umsatz'])
  const idxType  = colIdx(['umsatzart', 'transaktionstyp', 'typ', 'art'])

  if (idxAmt === -1) {
    return { transactions: [], closingBalance: null, error: 'Could not find amount column (Betrag) in CSV' }
  }

  const transactions = []
  let closingBalance = null
  let closingDate    = null

  for (let i = headerIdx + 1; i < lines.length; i++) {
    const fields = splitLine(lines[i], sep)
    if (fields.length < 2) continue

    const rawAmount = fields[idxAmt] ?? ''
    const amount    = parseGermanNumber(rawAmount)

    // Skip balance summary rows and rows with no amount
    if (amount === null) continue
    const descRaw = idxDesc !== -1 ? fields[idxDesc] : fields[1] || ''
    const lowerDesc = descRaw.toLowerCase()
    if (
      lowerDesc.includes('kontostand') ||
      lowerDesc.includes('neuer saldo') ||
      lowerDesc.includes('anfangssaldo') ||
      lowerDesc.includes('endsaldo') ||
      lowerDesc.includes('closing balance') ||
      lowerDesc.includes('opening balance')
    ) {
      // Treat as potential closing balance if it's the last one
      closingBalance = Math.abs(amount)
      const rawDate = idxDate !== -1 ? fields[idxDate] : fields[0]
      closingDate = parseGermanDate(rawDate) || new Date().toISOString().split('T')[0]
      continue
    }

    const rawDate = idxDate !== -1 ? fields[idxDate] : fields[0]
    const date    = parseGermanDate(rawDate) || new Date().toISOString().split('T')[0]
    const type    = amount >= 0 ? 'income' : 'expense'

    // Build description: prefer Buchungstext, append Umsatzart if present and different
    let description = descRaw.trim()
    if (!description && idxType !== -1) description = fields[idxType]?.trim() || 'Unknown'

    transactions.push({
      date,
      description: description || 'Unknown',
      amount:      Math.abs(amount),
      type,
      category:    '',
      selected:    true
    })
  }

  return { transactions, closingBalance, closingDate, error: null }
}
