const crypto = require('crypto')
const CURRENCIES = { EUR: 2, USD: 2, GBP: 2, CHF: 2, JPY: 0 }
function assert(condition, message) { if (!condition) throw new Error(message) }
function date(value) {
  assert(typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value), 'Date must be YYYY-MM-DD')
  const parsed = new Date(`${value}T12:00:00Z`)
  assert(Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value, `Invalid date: ${value}`)
  return value
}
function today() { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}` }
function addDays(value, n) { return new Date(new Date(`${date(value)}T12:00:00Z`).getTime() + n * 86400000).toISOString().slice(0, 10) }
function days(a, b) { return Math.round((new Date(`${date(b)}T12:00:00Z`) - new Date(`${date(a)}T12:00:00Z`)) / 86400000) }
function precision(currency) { assert(Object.hasOwn(CURRENCIES, currency), 'Unsupported currency'); return CURRENCIES[currency] }
function minor(value, currency = 'EUR', locale = 'en') {
  const p = precision(currency)
  assert(['en','de'].includes(locale), 'Choose a valid amount format')
  if(typeof value==='number')locale='en' // Numeric values are already canonical; locale applies only to text.
  let s = typeof value === 'number' ? String(value) : String(value ?? '').trim()
  assert(s && s.length < 64, 'Amount is required')
  if (locale === 'de') {
    assert(/^[+-]?(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d+)?-?$/.test(s), `Invalid German amount: ${s}`)
    const trailing = s.endsWith('-'); s = s.replace(/\./g, '').replace(',', '.').replace(/-$/, '')
    if (trailing) s = `-${s}`
  }
  if(locale==='en'&&s.includes(',')){assert(/^[+-]?\d{1,3}(?:,\d{3})+(?:\.\d+)?$/.test(s),'Invalid English thousands grouping');s=s.replace(/,/g,'')}
  assert(/^[+-]?\d+(?:\.\d+)?$/.test(s), `Invalid amount: ${s}`)
  const negative = s.startsWith('-'); const [whole, fraction = ''] = s.replace(/^[+-]/, '').split('.')
  assert(fraction.length <= p || /^0*$/.test(fraction.slice(p)), `Amount has more than ${p} decimal places for ${currency}`)
  const result = Number(whole) * 10 ** p + Number(fraction.slice(0, p).padEnd(p, '0') || 0)
  assert(Number.isSafeInteger(result), 'Amount is too large')
  return negative ? -result : result
}
function major(value, currency = 'EUR') { return value / 10 ** precision(currency) }
function normalized(value) { return String(value || '').normalize('NFKC').toLocaleLowerCase().trim().replace(/\s+/g, ' ') }
function hash(value) { return crypto.createHash('sha256').update(value).digest('hex') }
function month(value) { assert(/^\d{4}-(0[1-9]|1[0-2])$/.test(value || ''), 'Month must be YYYY-MM'); date(`${value}-01`); return value }
function monthRange(value) { month(value); const n = new Date(`${value}-01T12:00:00Z`); n.setUTCMonth(n.getUTCMonth() + 1); return { dateFrom: `${value}-01`, dateTo: addDays(n.toISOString().slice(0, 10), -1) } }
function nextOccurrence(start, cadence, n = 1) {
  date(start)
  if (cadence === 'weekly' || cadence === 'fortnightly') return addDays(start, n * (cadence === 'weekly' ? 7 : 14))
  const months = { monthly: 1, quarterly: 3, annual: 12 }[cadence]
  assert(months, 'Unsupported cadence')
  const d = new Date(`${start}T12:00:00Z`); const day = d.getUTCDate(); const endOfMonth = day === new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate()
  d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() + n * months)
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate()
  d.setUTCDate(endOfMonth ? last : Math.min(day, last))
  return d.toISOString().slice(0, 10)
}
function occurrences(series, from, to) {
  const result = []; if (series.status !== 'active') return result
  date(from);date(to);const lower=from>series.effective_from?from:series.effective_from
  const step={weekly:7,fortnightly:14,monthly:31,quarterly:93,annual:366}[series.cadence];assert(step,'Unsupported cadence')
  let first=Math.floor(days(series.next_date,lower)/step)-2
  while(nextOccurrence(series.next_date,series.cadence,first)>lower)first--
  while(nextOccurrence(series.next_date,series.cadence,first+1)<lower)first++
  for (let n = first, count=0; count < 20000; n++,count++) {
    const d = nextOccurrence(series.next_date, series.cadence, n)
    if (d > to) break
    if (d >= from && d >= series.effective_from && (!series.effective_to || d <= series.effective_to)) result.push({ date: d, amount_minor: series.amount_minor, type: series.type, series_id: series.id, name: series.name })
  }
  return result
}
function intervalCoverage(intervals, cutoff, required) {
  date(cutoff); let count = 0
  for (let d = cutoff; count < 8192; d = addDays(d, -1)) {
    if (!intervals.some(i => i.date_from <= d && i.date_to >= d)) break
    count++
  }
  return { days: count, required, eligible: count >= required, cutoff, from: count ? addDays(cutoff, 1 - count) : null }
}
function candidateGroups(transactions) {
  const groups = new Map()
  const purposes = /rent|housing|utilities|insurance|subscription|salary|scholarship|stipendium|stipendien|netflix|spotify|adobe|gym|membership|electric|strom|miete|gehalt|loan|mortgage|fitness|telekom|vodafone|icloud|disney|prime video|apple music/i
  const excluded = /groceries|restaurants|shopping/i
  for (const tx of transactions) {
    if (!tx.merchant_id || tx.recurring_id || tx.transfer_id || tx.validation_error || excluded.test(tx.category || '') || !purposes.test(`${tx.category || ''} ${tx.description}`)) continue
    if(tx.payment_processor&&!tx.merchant_suggestion)continue
    const key = `${tx.account_id}:${tx.processed_merchant||tx.merchant_id}:${tx.type}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(tx)
  }
  const result = []
  for (const [key, rows] of groups) {
    rows.sort((a, b) => a.date.localeCompare(b.date))
    const dates = [...new Set(rows.map(r => r.date))]
    for (const cadence of ['weekly', 'fortnightly', 'monthly', 'quarterly', 'annual']) {
      if (dates.length < (['quarterly', 'annual'].includes(cadence) ? 2 : 3)) continue
      const fit = dates.slice(1).every((d, i) => Math.abs(days(nextOccurrence(dates[0], cadence, i + 1), d)) <= (cadence === 'weekly' ? 2 : 4))
      if (!fit) continue
      const amounts = rows.map(r => Math.abs(r.amount_minor)); const sorted = [...amounts].sort((a, b) => a - b); const median = sorted[Math.floor(sorted.length / 2)]
      const variable = /utilities/i.test(rows[0].category || '')
      const spread = median ? (Math.max(...amounts) - Math.min(...amounts)) / median : 0
      if (spread > 0.5 && !variable) continue
      const last = rows[rows.length - 1]
      result.push({ key, account_id: last.account_id, merchant_id: last.merchant_id, category: last.category, type: last.type, name: last.merchant || last.description, cadence, amount_minor: last.amount_minor, currency: last.currency, min_minor: Math.min(...amounts), max_minor: Math.max(...amounts), next_date: nextOccurrence(dates[0], cadence, dates.length), effective_from: dates[0], transaction_ids: rows.map(r => r.id), price_changed: spread > 0.1, overdue: nextOccurrence(dates[0], cadence, dates.length) < today(), evidence: `${dates.length} ${cadence} payments; ${dates[0]} to ${last.date}${variable ? '; variable utility amounts' : ''}` })
      break
    }
  }
  return result
}
module.exports = { assert, date, today, addDays, days, precision, minor, major, normalized, hash, month, monthRange, nextOccurrence, occurrences, intervalCoverage, candidateGroups }
