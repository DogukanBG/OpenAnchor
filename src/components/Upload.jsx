import React, { useState, useRef } from 'react'
import { useApp } from '../App'

const EXTRACTION_PROMPT = (text) => `You are a precise financial data extractor. Extract ALL transactions from the bank statement below.

Return ONLY a valid JSON array — no explanation, no markdown, no code blocks, just the raw JSON.

Each transaction must follow this exact format:
[
  {
    "date": "YYYY-MM-DD",
    "description": "merchant or description text",
    "amount": 42.50,
    "type": "expense"
  }
]

Rules:
- "amount" is ALWAYS a positive number
- "type" is "income" for money received, "expense" for money spent
- "date" must be in YYYY-MM-DD format
- Include ALL transactions, even transfers and fees
- If year is missing, infer from context or use current year

BANK STATEMENT:
${text.substring(0, 6000)}`

export default function Upload() {
  const { categories, settings, ollamaOk, setPage } = useApp()
  const [step, setStep] = useState('idle') // idle | parsing | extracted | reviewing | done
  const [filePath, setFilePath] = useState(null)
  const [rawText, setRawText] = useState('')
  const [extracted, setExtracted] = useState([])
  const [error, setError] = useState('')
  const [progress, setProgress] = useState('')
  const [editIdx, setEditIdx] = useState(null)

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
      const text = await window.api.file.extractText(path)
      setRawText(text)
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
    setProgress('Sending to AI model for extraction...')
    setError('')

    try {
      const response = await window.api.ollama.generate({
        model,
        prompt: EXTRACTION_PROMPT(rawText)
      })

      setProgress('Parsing AI response...')

      // Try to extract JSON from response
      let json = response.trim()

      // Strip markdown code blocks if model wrapped it
      json = json.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()

      // Find JSON array in response
      const start = json.indexOf('[')
      const end = json.lastIndexOf(']')
      if (start === -1 || end === -1) throw new Error('No JSON array found in response')
      json = json.substring(start, end + 1)

      const transactions = JSON.parse(json)
      if (!Array.isArray(transactions)) throw new Error('Response is not an array')

      // Normalize and validate
      const normalized = transactions
        .filter(tx => tx.date && tx.description && tx.amount !== undefined)
        .map((tx, i) => ({
          ...tx,
          id: i,
          amount: Math.abs(parseFloat(tx.amount) || 0),
          type: tx.type || 'expense',
          category: '',
          selected: true
        }))

      setExtracted(normalized)
      setStep('reviewing')
      setProgress('')
    } catch (e) {
      setError(`Extraction failed: ${e.message}. Try a different model or check the raw text below.`)
      setStep('extracted')
      setProgress('')
    }
  }

  async function importSelected() {
    const toImport = extracted.filter(tx => tx.selected)
    if (toImport.length === 0) return

    setStep('parsing')
    setProgress(`Importing ${toImport.length} transactions...`)

    const payload = toImport.map(tx => ({
      date: tx.date,
      description: tx.description,
      amount: tx.type === 'expense' ? -Math.abs(tx.amount) : Math.abs(tx.amount),
      category: tx.category || null,
      type: tx.type,
      source: 'upload'
    }))

    await window.api.transactions.bulkAdd(payload)
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
    setStep('idle'); setFilePath(null); setRawText(''); setExtracted([])
    setError(''); setProgress('')
  }

  const selectedCount = extracted.filter(r => r.selected).length

  return (
    <div className="h-full overflow-y-auto p-6 animate-fade-in">
      <div className="max-w-4xl mx-auto">

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="font-display text-2xl font-bold text-text-bright">Import Bank Statement</h1>
            <p className="text-muted text-sm mt-0.5">Upload a PDF or CSV — AI extracts transactions locally</p>
          </div>
          {step !== 'idle' && (
            <button onClick={reset} className="text-sm text-muted hover:text-text border border-border px-3 py-1.5 rounded-xl transition-all">
              ← Start over
            </button>
          )}
        </div>

        {/* Ollama warning */}
        {!ollamaOk && (
          <div className="mb-4 p-4 bg-warn-dim border border-warn border-opacity-30 rounded-xl text-sm text-warn flex items-center gap-3">
            <span className="text-xl">⚠️</span>
            <div>
              <p className="font-medium">Ollama is not running</p>
              <p className="text-xs opacity-80 mt-0.5">Start Ollama (<code className="font-mono bg-black/20 px-1 rounded">ollama serve</code>) to use AI extraction. You can still upload files.</p>
            </div>
          </div>
        )}

        {!model && ollamaOk && (
          <div className="mb-4 p-4 bg-surface-2 border border-border rounded-xl text-sm text-muted flex items-center gap-3">
            <span>⚙️</span>
            <span>No extraction model selected. <button onClick={() => setPage('settings')} className="text-accent underline">Go to Settings</button> to pick one.</span>
          </div>
        )}

        {/* ── Step: idle ── */}
        {step === 'idle' && (
          <div
            onClick={pickFile}
            className="border-2 border-dashed border-border hover:border-accent rounded-2xl p-16 text-center cursor-pointer transition-all group"
          >
            <div className="text-5xl mb-4 group-hover:scale-110 transition-transform">📄</div>
            <p className="text-text font-semibold text-lg">Click to choose a bank statement</p>
            <p className="text-muted text-sm mt-2">Supports PDF, CSV, and TXT files</p>
          </div>
        )}

        {/* ── Step: parsing/progress ── */}
        {step === 'parsing' && (
          <div className="bg-surface-1 border border-border rounded-2xl p-12 text-center">
            <div className="w-12 h-12 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-4"/>
            <p className="text-text font-medium">{progress}</p>
          </div>
        )}

        {/* ── Step: extracted (raw text ready, awaiting AI) ── */}
        {step === 'extracted' && (
          <div className="space-y-4">
            <div className="bg-surface-1 border border-border rounded-2xl p-5">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="font-semibold text-text">File loaded</p>
                  <p className="text-xs text-muted mt-0.5 font-mono truncate max-w-sm">{filePath}</p>
                </div>
                <span className="text-accent text-sm font-medium bg-accent-dim px-2 py-1 rounded-lg">
                  {rawText.length.toLocaleString()} chars
                </span>
              </div>

              <details className="text-xs mt-3">
                <summary className="text-muted cursor-pointer hover:text-text">Preview raw text</summary>
                <pre className="mt-2 bg-surface-2 rounded-xl p-3 overflow-auto max-h-40 text-muted font-mono whitespace-pre-wrap text-xs leading-relaxed">
                  {rawText.substring(0, 2000)}{rawText.length > 2000 && '\n...'}
                </pre>
              </details>
            </div>

            {error && <ErrorBanner message={error}/>}

            <button
              onClick={runExtraction}
              disabled={!model || !ollamaOk}
              className="w-full py-3 rounded-2xl bg-accent text-surface font-semibold text-sm hover:bg-opacity-90 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              🤖 Extract transactions with AI ({model || 'no model selected'})
            </button>
          </div>
        )}

        {/* ── Step: reviewing ── */}
        {step === 'reviewing' && (
          <div className="space-y-4 animate-slide-up">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-text">{extracted.length} transactions extracted</p>
                <p className="text-xs text-muted mt-0.5">Review and assign categories before importing</p>
              </div>
              <button
                onClick={importSelected}
                disabled={selectedCount === 0}
                className="px-5 py-2 bg-accent text-surface rounded-xl font-semibold text-sm hover:bg-opacity-90 transition-all disabled:opacity-40"
              >
                Import {selectedCount} selected
              </button>
            </div>

            {error && <ErrorBanner message={error}/>}

            <div className="bg-surface-1 border border-border rounded-2xl overflow-hidden">
              <div className="grid grid-cols-[40px_1fr_1fr_120px_140px_80px] gap-3 px-4 py-2.5 border-b border-border bg-surface-2 text-xs uppercase tracking-widest text-muted">
                <div className="flex items-center">
                  <input type="checkbox" checked={extracted.every(r => r.selected)} onChange={toggleAll}
                    className="accent-accent w-3.5 h-3.5"/>
                </div>
                <span>Date</span><span>Description</span><span>Amount</span><span>Category</span><span>Type</span>
              </div>
              <div className="max-h-[400px] overflow-y-auto divide-y divide-border">
                {extracted.map((tx, i) => (
                  <div key={i} className={`grid grid-cols-[40px_1fr_1fr_120px_140px_80px] gap-3 px-4 py-2.5 items-center text-sm transition-colors ${!tx.selected ? 'opacity-40' : ''}`}>
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
                      className="bg-surface-2 border border-transparent hover:border-border text-xs text-text rounded-lg px-2 py-1 appearance-none w-full">
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
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Step: done ── */}
        {step === 'done' && (
          <div className="bg-accent-dim border border-accent border-opacity-40 rounded-2xl p-12 text-center glow-green animate-slide-up">
            <div className="text-5xl mb-4">✅</div>
            <p className="text-accent font-display text-2xl font-bold mb-2">Import complete!</p>
            <p className="text-muted text-sm mb-6">Transactions have been saved to your local database.</p>
            <div className="flex gap-3 justify-center">
              <button onClick={() => setPage('transactions')} className="px-5 py-2 bg-accent text-surface rounded-xl font-semibold text-sm">
                View Transactions
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
