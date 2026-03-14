import React, { useState } from 'react'
import { useApp } from '../App'

// ── Prompts ───────────────────────────────────────────────────────────────────

// Per-page transaction extraction
const PAGE_PROMPT = (pageText, pageNum, totalPages, inferredYear) => `
You are a precise financial data extractor processing page ${pageNum} of ${totalPages} of a bank statement.

Return ONLY a valid JSON object — no explanation, no markdown, no code blocks.

Format:
{
  "transactions": [
    { "date": "YYYY-MM-DD", "description": "text", "amount": 42.50, "type": "expense" }
  ],
  "closing_balance": null
}

CRITICAL RULES — read carefully:
1. "amount" is ALWAYS a positive number, never negative
2. "type" MUST be:
   - "expense" if the amount is in the DEBIT column (zu Ihren Lasten / Belastung / Abbuchung / minus sign / trailing minus like "329,00-")
   - "income"  if the amount is in the CREDIT column (zu Ihren Gunsten / Gutschrift / Eingang / Gehalt / Lohn / Rente / no trailing minus)
3. German number format: "1.234,56" means 1234.56 — period=thousands separator, comma=decimal
4. A trailing minus like "329,00-" means EXPENSE. A plain number like "255,00" in the credit column means INCOME.
5. "date" must be YYYY-MM-DD. German dates like "03.11" mean day.month, use year ${inferredYear}
6. DO NOT extract balance summary lines (Kontostand, Alter Kontostand, Neuer Kontostand, Saldo) as transactions
7. If this page has a "Neuer Kontostand" or closing balance line, set "closing_balance" to that number (positive float). Otherwise null.
8. If there are no transactions on this page (e.g. it's a header/footer page), return {"transactions": [], "closing_balance": null}

PAGE CONTENT:
${pageText}
`.trim()

// Balance-only extraction (run on full text once)
const BALANCE_PROMPT = (text) => `
Extract the account balance information from this bank statement text.
Return ONLY a JSON object, no explanation:

{
  "opening_balance": 8780.04,
  "opening_date": "2025-10-31",
  "closing_balance": 9123.45,
  "closing_date": "2025-11-30"
}

Rules:
- German number format: "8.780,04" = 8780.04
- German dates: "31.10.2025" = 2025-10-31
- Look for: "Alter Kontostand", "Neuer Kontostand", "Anfangssaldo", "Endsaldo", "Opening Balance", "Closing Balance"
- If a value is not found, use null

TEXT:
${text.substring(0, 3000)}
`.trim()

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseJsonResponse(response) {
  let text = response.trim()
  text = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start === -1 || end === -1) throw new Error('No JSON object in response')
  return JSON.parse(text.substring(start, end + 1))
}

function inferYear(pageTexts) {
  const combined = pageTexts.join(' ')
  // Look for 4-digit years
  const match = combined.match(/\b(20\d{2})\b/)
  if (match) return match[1]
  return new Date().getFullYear().toString()
}

function normalizeAmount(raw) {
  if (typeof raw === 'number') return Math.abs(raw)
  const str = String(raw).replace(/\./g, '').replace(',', '.')
  return Math.abs(parseFloat(str) || 0)
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function Upload() {
  const { categories, settings, ollamaOk, setPage } = useApp()
  const [step, setStep] = useState('idle')
  const [filePath, setFilePath] = useState(null)
  const [pages, setPages] = useState([])
  const [pageCount, setPageCount] = useState(0)
  const [extracted, setExtracted] = useState([])
  const [detectedBalance, setDetectedBalance] = useState(null) // { amount, date, label }
  const [error, setError] = useState('')
  const [progress, setProgress] = useState('')
  const [progressDetail, setProgressDetail] = useState('') // "Page 2 of 4"
  const [useDetectedBalance, setUseDetectedBalance] = useState(true)

  const model = settings.extraction_model || ''

  async function pickFile() {
    setError('')
    const path = await window.api.file.openDialog()
    if (!path) return
    setFilePath(path)
    await parseFile(path)
  }

  async function parseFile(path) {
    setStep('parsing')
    setProgress('Reading file...')
    try {
      const result = await window.api.file.extractText(path)
      setPages(result.pages)
      setPageCount(result.pageCount || result.pages.length)
      setStep('extracted')
      setProgress('')
    } catch (e) {
      setError(`File error: ${e.message}`)
      setStep('idle')
    }
  }

  async function runExtraction() {
    if (!model) { setError('Please select an extraction model in Settings first.'); return }
    if (!ollamaOk) { setError('Ollama is not running. Start Ollama and try again.'); return }

    setStep('parsing')
    setError('')

    const allTransactions = []
    let latestClosingBalance = null
    let latestClosingDate = null
    const inferredYear = inferYear(pages)

    // ── Step 1: Extract transactions page by page ──────────────────────────
    for (let i = 0; i < pages.length; i++) {
      const pageNum = i + 1
      setProgress(`Extracting transactions...`)
      setProgressDetail(`Page ${pageNum} of ${pages.length}`)

      try {
        const response = await window.api.ollama.generate({
          model,
          prompt: PAGE_PROMPT(pages[i], pageNum, pages.length, inferredYear)
        })

        const parsed = parseJsonResponse(response)

        // Collect transactions
        if (Array.isArray(parsed.transactions)) {
          const normalized = parsed.transactions
            .filter(tx => tx.date && tx.description && tx.amount !== undefined)
            .map((tx, j) => ({
              id: `${i}-${j}`,
              date: tx.date,
              description: tx.description,
              amount: normalizeAmount(tx.amount),
              type: tx.type === 'income' ? 'income' : 'expense',
              category: '',
              selected: true,
              page: pageNum
            }))
          allTransactions.push(...normalized)
        }

        // Track the most recent closing balance mentioned
        if (parsed.closing_balance !== null && parsed.closing_balance !== undefined) {
          latestClosingBalance = normalizeAmount(parsed.closing_balance)
          latestClosingDate = inferredYear  // will be refined in step 2
        }

      } catch (e) {
        console.warn(`Page ${pageNum} extraction failed:`, e.message)
        // Don't abort — just skip this page and continue
      }
    }

    // ── Step 2: Extract balance info from full text ────────────────────────
    setProgress('Extracting account balance...')
    setProgressDetail('')
    try {
      const fullText = pages.join('\n\n--- PAGE BREAK ---\n\n')
      const balanceResponse = await window.api.ollama.generate({
        model,
        prompt: BALANCE_PROMPT(fullText)
      })
      const balanceParsed = parseJsonResponse(balanceResponse)

      if (balanceParsed.closing_balance && balanceParsed.closing_date) {
        setDetectedBalance({
          amount: normalizeAmount(balanceParsed.closing_balance),
          date: balanceParsed.closing_date,
          label: `Neuer Kontostand / Closing Balance (${balanceParsed.closing_date})`
        })
      } else if (latestClosingBalance !== null) {
        // Fallback to what we found per-page
        setDetectedBalance({
          amount: latestClosingBalance,
          date: new Date().toISOString().split('T')[0],
          label: 'Closing balance (date uncertain — please verify)'
        })
      }
    } catch (e) {
      console.warn('Balance extraction failed:', e.message)
    }

    if (allTransactions.length === 0) {
      setError('No transactions could be extracted. Try a larger model or check the raw text preview.')
      setStep('extracted')
      return
    }

    setExtracted(allTransactions)
    setStep('reviewing')
    setProgress('')
    setProgressDetail('')
  }

  async function importSelected() {
    const toImport = extracted.filter(tx => tx.selected)
    if (toImport.length === 0) return

    setStep('parsing')
    setProgress(`Importing ${toImport.length} transactions...`)
    setProgressDetail('')

    const payload = toImport.map(tx => ({
      date: tx.date,
      description: tx.description,
      amount: tx.type === 'expense' ? -Math.abs(tx.amount) : Math.abs(tx.amount),
      category: tx.category || null,
      type: tx.type,
      source: 'upload'
    }))

    await window.api.transactions.bulkAdd(payload)

    // Save balance only if user opted in and we have one
    if (useDetectedBalance && detectedBalance?.amount && detectedBalance?.date) {
      await window.api.balance.setIfNewer(
        detectedBalance.amount,
        detectedBalance.date,
        detectedBalance.label
      )
    }

    setStep('done')
    setProgress('')
  }

  function updateRow(idx, field, value) {
    setExtracted(rows => rows.map((r, i) => i === idx ? { ...r, [field]: value } : r))
  }
  function toggleSelect(idx) { updateRow(idx, 'selected', !extracted[idx].selected) }
  function toggleAll() {
    const allSelected = extracted.every(r => r.selected)
    setExtracted(rows => rows.map(r => ({ ...r, selected: !allSelected })))
  }

  function reset() {
    setStep('idle'); setFilePath(null); setPages([]); setPageCount(0)
    setExtracted([]); setDetectedBalance(null); setError('')
    setProgress(''); setProgressDetail(''); setUseDetectedBalance(true)
  }

  const selectedCount = extracted.filter(r => r.selected).length
  const incomeCount   = extracted.filter(r => r.selected && r.type === 'income').length
  const expenseCount  = extracted.filter(r => r.selected && r.type === 'expense').length

  return (
    <div className="h-full overflow-y-auto p-6 animate-fade-in">
      <div className="max-w-4xl mx-auto">

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="font-display text-2xl font-bold text-text-bright">Import Bank Statement</h1>
            <p className="text-muted text-sm mt-0.5">Upload a PDF or CSV — AI extracts transactions page by page</p>
          </div>
          {step !== 'idle' && (
            <button onClick={reset} className="text-sm text-muted hover:text-text border border-border px-3 py-1.5 rounded-xl transition-all">
              ← Start over
            </button>
          )}
        </div>

        {/* Warnings */}
        {!ollamaOk && (
          <div className="mb-4 p-4 bg-warn-dim border border-warn border-opacity-30 rounded-xl text-sm text-warn flex items-center gap-3">
            <span className="text-xl">⚠️</span>
            <div>
              <p className="font-medium">Ollama is not running</p>
              <p className="text-xs opacity-80 mt-0.5">Start Ollama (<code className="font-mono bg-black/20 px-1 rounded">ollama serve</code>) to use AI extraction.</p>
            </div>
          </div>
        )}
        {!model && ollamaOk && (
          <div className="mb-4 p-4 bg-surface-2 border border-border rounded-xl text-sm text-muted flex items-center gap-3">
            <span>⚙️</span>
            <span>No extraction model selected. <button onClick={() => setPage('settings')} className="text-accent underline">Go to Settings</button> to pick one.</span>
          </div>
        )}

        {/* ── idle ── */}
        {step === 'idle' && (
          <div onClick={pickFile}
            className="border-2 border-dashed border-border hover:border-accent rounded-2xl p-16 text-center cursor-pointer transition-all group">
            <div className="text-5xl mb-4 group-hover:scale-110 transition-transform">📄</div>
            <p className="text-text font-semibold text-lg">Click to choose a bank statement</p>
            <p className="text-muted text-sm mt-2">Supports PDF, CSV, and TXT — processed entirely locally</p>
          </div>
        )}

        {/* ── parsing / progress ── */}
        {step === 'parsing' && (
          <div className="bg-surface-1 border border-border rounded-2xl p-12 text-center">
            <div className="w-12 h-12 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-4"/>
            <p className="text-text font-medium">{progress}</p>
            {progressDetail && (
              <p className="text-muted text-sm mt-1">{progressDetail}</p>
            )}
          </div>
        )}

        {/* ── extracted (file read, awaiting AI) ── */}
        {step === 'extracted' && (
          <div className="space-y-4">
            <div className="bg-surface-1 border border-border rounded-2xl p-5">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="font-semibold text-text">File loaded</p>
                  <p className="text-xs text-muted mt-0.5 font-mono truncate max-w-sm">{filePath}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-accent text-sm font-medium bg-accent-dim px-2 py-1 rounded-lg">
                    {pages.length} page{pages.length !== 1 ? 's' : ''} detected
                  </span>
                </div>
              </div>

              {/* Page previews */}
              <div className="space-y-2 mt-3">
                {pages.map((p, i) => (
                  <details key={i} className="text-xs">
                    <summary className="text-muted cursor-pointer hover:text-text">
                      Preview page {i + 1} ({p.length.toLocaleString()} chars)
                    </summary>
                    <pre className="mt-1 bg-surface-2 rounded-xl p-3 overflow-auto max-h-32 text-muted font-mono whitespace-pre-wrap text-xs leading-relaxed">
                      {p.substring(0, 1000)}{p.length > 1000 && '\n...'}
                    </pre>
                  </details>
                ))}
              </div>
            </div>

            {error && <ErrorBanner message={error}/>}

            <button onClick={runExtraction} disabled={!model || !ollamaOk}
              className="w-full py-3 rounded-2xl bg-accent text-surface font-semibold text-sm hover:bg-opacity-90 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
              🤖 Extract transactions with AI — {pages.length} page{pages.length !== 1 ? 's' : ''} ({model || 'no model selected'})
            </button>
          </div>
        )}

        {/* ── reviewing ── */}
        {step === 'reviewing' && (
          <div className="space-y-4 animate-slide-up">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-text">{extracted.length} transactions extracted</p>
                <p className="text-xs text-muted mt-0.5">
                  <span className="text-accent">↑ {incomeCount} income</span>
                  <span className="mx-2 text-border">·</span>
                  <span className="text-loss">↓ {expenseCount} expenses</span>
                  <span className="mx-2 text-border">·</span>
                  {pages.length} pages processed
                </p>
              </div>
              <button onClick={importSelected} disabled={selectedCount === 0}
                className="px-5 py-2 bg-accent text-surface rounded-xl font-semibold text-sm hover:bg-opacity-90 transition-all disabled:opacity-40">
                Import {selectedCount} selected
              </button>
            </div>

            {/* Balance card */}
            {detectedBalance && (
              <div className="bg-surface-1 border border-accent border-opacity-30 rounded-2xl p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs text-muted uppercase tracking-widest mb-1">Detected Account Balance</p>
                    <p className="text-2xl font-display font-bold text-accent">
                      €{parseFloat(detectedBalance.amount).toLocaleString('de-DE', { minimumFractionDigits: 2 })}
                    </p>
                    <p className="text-xs text-muted mt-1">{detectedBalance.label}</p>
                  </div>
                  <label className="flex items-center gap-2 text-sm text-muted cursor-pointer shrink-0 mt-1">
                    <input
                      type="checkbox"
                      checked={useDetectedBalance}
                      onChange={e => setUseDetectedBalance(e.target.checked)}
                      className="accent-accent w-4 h-4"
                    />
                    Save as account balance
                  </label>
                </div>
                {useDetectedBalance && (
                  <p className="text-xs text-muted mt-2 border-t border-border pt-2">
                    ℹ️ This will only update your stored balance if this statement is more recent than the last one imported.
                  </p>
                )}
              </div>
            )}

            {error && <ErrorBanner message={error}/>}

            <div className="bg-surface-1 border border-border rounded-2xl overflow-hidden">
              <div className="grid grid-cols-[32px_90px_1fr_110px_130px_75px_50px] gap-2 px-4 py-2.5 border-b border-border bg-surface-2 text-xs uppercase tracking-widest text-muted">
                <div className="flex items-center">
                  <input type="checkbox" checked={extracted.every(r => r.selected)} onChange={toggleAll}
                    className="accent-accent w-3.5 h-3.5"/>
                </div>
                <span>Date</span><span>Description</span><span>Amount</span>
                <span>Category</span><span>Type</span><span>Pg.</span>
              </div>
              <div className="max-h-[420px] overflow-y-auto divide-y divide-border">
                {extracted.map((tx, i) => (
                  <div key={tx.id}
                    className={`grid grid-cols-[32px_90px_1fr_110px_130px_75px_50px] gap-2 px-4 py-2 items-center text-sm transition-colors ${!tx.selected ? 'opacity-40' : ''}`}>
                    <input type="checkbox" checked={tx.selected} onChange={() => toggleSelect(i)}
                      className="accent-accent w-3.5 h-3.5"/>
                    <input value={tx.date} onChange={e => updateRow(i, 'date', e.target.value)}
                      className="bg-surface-2 border border-transparent hover:border-border focus:border-accent rounded-lg px-2 py-1 text-xs font-mono text-muted w-full"/>
                    <input value={tx.description} onChange={e => updateRow(i, 'description', e.target.value)}
                      className="bg-surface-2 border border-transparent hover:border-border focus:border-accent rounded-lg px-2 py-1 text-xs text-text w-full truncate"/>
                    <div className="flex items-center gap-1">
                      <span className={tx.type === 'income' ? 'text-accent' : 'text-loss'}>
                        {tx.type === 'income' ? '+' : '-'}
                      </span>
                      <input type="number" value={tx.amount} onChange={e => updateRow(i, 'amount', e.target.value)}
                        className="bg-surface-2 border border-transparent hover:border-border focus:border-accent rounded-lg px-2 py-1 text-xs font-mono text-text w-full"/>
                    </div>
                    <select value={tx.category} onChange={e => updateRow(i, 'category', e.target.value)}
                      className="bg-surface-2 border border-transparent text-xs text-text rounded-lg px-2 py-1 appearance-none w-full">
                      <option value="">— category —</option>
                      {categories.filter(c => c.type === tx.type || c.type === 'both').map(c => (
                        <option key={c.id} value={c.name}>{c.icon} {c.name}</option>
                      ))}
                    </select>
                    <select value={tx.type} onChange={e => updateRow(i, 'type', e.target.value)}
                      className="bg-surface-2 border border-transparent text-xs rounded-lg px-2 py-1 appearance-none w-full text-text">
                      <option value="expense">Expense</option>
                      <option value="income">Income</option>
                    </select>
                    <span className="text-xs text-muted text-center">{tx.page}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── done ── */}
        {step === 'done' && (
          <div className="bg-accent-dim border border-accent border-opacity-40 rounded-2xl p-12 text-center glow-green animate-slide-up">
            <div className="text-5xl mb-4">✅</div>
            <p className="text-accent font-display text-2xl font-bold mb-2">Import complete!</p>
            <p className="text-muted text-sm mb-1">Transactions saved to your local database.</p>
            {useDetectedBalance && detectedBalance && (
              <p className="text-xs text-muted mb-6">Account balance updated to €{parseFloat(detectedBalance.amount).toLocaleString('de-DE', { minimumFractionDigits: 2 })}</p>
            )}
            <div className="flex gap-3 justify-center mt-6">
              <button onClick={() => setPage('dashboard')} className="px-5 py-2 bg-accent text-surface rounded-xl font-semibold text-sm">
                Go to Dashboard
              </button>
              <button onClick={reset} className="px-5 py-2 border border-border text-muted rounded-xl text-sm hover:text-text transition-all">
                Import Another
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function ErrorBanner({ message }) {
  return (
    <div className="p-4 bg-loss-dim border border-loss border-opacity-30 rounded-xl text-sm text-loss">
      ⚠️ {message}
    </div>
  )
}
