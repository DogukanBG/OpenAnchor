import React, { useState, useEffect, useRef } from 'react'
import { useApp } from '../App'

// ── Time range options (max 1 year) ───────────────────────────────────────────
const TIME_SPANS = [
  { label: '7 Days',    days: 7   },
  { label: '2 Weeks',   days: 14  },
  { label: '1 Month',   days: 30  },
  { label: '3 Months',  days: 90  },
  { label: '6 Months',  days: 180 },
  { label: '1 Year',    days: 365 },
]

function getDateRange(days) {
  const now = new Date()
  return {
    from: new Date(now - days * 86400000).toISOString().split('T')[0],
    to:   now.toISOString().split('T')[0]
  }
}

function buildSystemContext(summary, transactions, breakdown, spanLabel, currency = '€') {
  const fmt = n => `${Math.abs(n).toFixed(2)}`
  const topExpenses = breakdown.filter(b => b.type === 'expense').slice(0, 6)
  const topIncome   = breakdown.filter(b => b.type === 'income').slice(0, 3)
  const savingsRate = summary.income > 0 ? Math.round((summary.net / summary.income) * 100) : 0

  return `You are a knowledgeable personal finance assistant. The user's financial data for the last ${spanLabel} is provided below. Use it to give accurate, actionable advice. Be concise and conversational. Always reference actual numbers from the data.

=== FINANCIAL SUMMARY (${spanLabel}) ===
Total Income:    ${currency}${fmt(summary.income)}
Total Expenses:  ${currency}${fmt(summary.expenses)}
Net Balance:     ${currency}${fmt(summary.net)}
Savings rate:    ${savingsRate}%
Transactions:    ${summary.count}

=== TOP EXPENSE CATEGORIES ===
${topExpenses.map(b => `- ${b.category || 'Uncategorized'}: ${currency}${fmt(b.total)} (${b.count} transactions)`).join('\n') || 'No expense data'}

=== INCOME SOURCES ===
${topIncome.map(b => `- ${b.category || 'Other'}: ${currency}${fmt(b.total)}`).join('\n') || 'No income data'}

=== RECENT TRANSACTIONS (last 20) ===
${transactions.slice(0, 20).map(t =>
  `${t.date} | ${t.type === 'income' ? '+' : '-'}${currency}${fmt(Math.abs(t.amount))} | ${t.description}${t.category ? ` [${t.category}]` : ''}`
).join('\n') || 'No transactions'}

If the user asks about something outside this data window, mention it clearly. Do not invent numbers.`
}

const SUGGESTIONS = [
  "Analyze my spending patterns",
  "Where can I cut expenses?",
  "What's my biggest expense?",
  "Am I saving enough?",
  "Give me a budget plan",
  "Any unusual spending this period?",
  "Compare my income vs expenses",
  "What should I focus on improving?"
]

// ── Component ─────────────────────────────────────────────────────────────────
export default function AIAssistant() {
  const { settings, ollamaOk, currency, setPage } = useApp()
  const [messages,    setMessages]    = useState([])
  const [input,       setInput]       = useState('')
  const [streaming,   setStreaming]   = useState(false)
  const [systemCtx,   setSystemCtx]   = useState('')
  const [dataLoaded,  setDataLoaded]  = useState(false)
  const [spanIdx,     setSpanIdx]     = useState(2) // default: 1 Month
  const [contextInfo, setContextInfo] = useState(null) // { income, expenses, count, span }
  const [loadingCtx,  setLoadingCtx]  = useState(false)

  const messagesEndRef       = useRef(null)
  const removeTokenListener  = useRef(null)

  const model    = settings.assistant_model || ''
  const span     = TIME_SPANS[spanIdx]

  // Reload context whenever timespan changes
  useEffect(() => {
    loadContext(span)
  }, [spanIdx])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    return () => { removeTokenListener.current?.() }
  }, [])

  async function loadContext(span) {
    setDataLoaded(false)
    setLoadingCtx(true)
    const { from, to } = getDateRange(span.days)

    const [summary, txs, breakdown] = await Promise.all([
      window.api.stats.getSummary({ dateFrom: from, dateTo: to }),
      window.api.transactions.getAll({ dateFrom: from, dateTo: to, limit: 100 }),
      window.api.stats.getCategoryBreakdown({ dateFrom: from, dateTo: to })
    ])

    setSystemCtx(buildSystemContext(summary, txs, breakdown, span.label, currency))
    setContextInfo({ income: summary.income, expenses: summary.expenses, count: summary.count, span: span.label })
    setDataLoaded(true)
    setLoadingCtx(false)
  }

  function changeSpan(idx) {
    if (idx === spanIdx) return
    setSpanIdx(idx)
    // Clear chat when timespan changes — context is different
    if (messages.length > 0) setMessages([])
  }

  async function send(text) {
    const userText = (text || input).trim()
    if (!userText || streaming) return
    if (!model)   { alert('Please select an AI assistant model in Settings.'); return }
    if (!ollamaOk){ alert('Ollama is not running. Please start Ollama.'); return }

    setInput('')
    const newMessages = [...messages, { role: 'user', content: userText }]
    setMessages(newMessages)
    setStreaming(true)
    setMessages(msgs => [...msgs, { role: 'assistant', content: '' }])

    let full = ''
    if (removeTokenListener.current) removeTokenListener.current()
    removeTokenListener.current = window.api.ollama.onToken(token => {
      full += token
      setMessages(msgs => {
        const updated = [...msgs]
        updated[updated.length - 1] = { role: 'assistant', content: full }
        return updated
      })
    })

    try {
      await window.api.ollama.chat({ model, messages: newMessages, system: systemCtx })
    } catch (e) {
      setMessages(msgs => {
        const updated = [...msgs]
        updated[updated.length - 1] = { role: 'assistant', content: `Error: ${e.message || 'Failed to get response.'}` }
        return updated
      })
    } finally {
      setStreaming(false)
      removeTokenListener.current?.()
    }
  }

  function clearChat() { setMessages([]) }

  const fmt = n => `${currency}${Math.abs(n).toLocaleString('de-DE', { minimumFractionDigits: 2 })}`

  return (
    <div className="h-full flex flex-col animate-fade-in">

      {/* ── Header ── */}
      <div className="px-6 pt-5 pb-4 border-b border-border shrink-0">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="font-display text-2xl font-bold text-text-bright">AI Assistant</h1>
            <p className="text-muted text-sm mt-0.5">
              {model ? `${model} · runs locally` : 'No model selected'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className={`flex items-center gap-1.5 text-xs ${ollamaOk ? 'text-accent' : 'text-loss'}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${ollamaOk ? 'bg-accent animate-pulse-slow' : 'bg-loss'}`}/>
              {ollamaOk ? 'Ollama running' : 'Ollama offline'}
            </div>
            {messages.length > 0 && (
              <button onClick={clearChat}
                className="text-xs text-muted hover:text-text border border-border px-3 py-1.5 rounded-xl transition-all">
                Clear chat
              </button>
            )}
          </div>
        </div>

        {/* Timespan selector */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted shrink-0">Data window:</span>
          <div className="flex items-center gap-1 bg-surface-2 p-1 rounded-xl border border-border">
            {TIME_SPANS.map((s, i) => (
              <button key={s.label} onClick={() => changeSpan(i)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  i === spanIdx ? 'bg-accent text-surface font-semibold' : 'text-muted hover:text-text'
                }`}>
                {s.label}
              </button>
            ))}
          </div>
          {/* Context summary pill */}
          {dataLoaded && contextInfo && (
            <div className="flex items-center gap-2 text-xs text-muted ml-1">
              <span className="text-accent">✓</span>
              <span>{contextInfo.count} transactions</span>
              <span className="text-border">·</span>
              <span className="text-accent font-mono">{fmt(contextInfo.income)}</span>
              <span className="text-border">·</span>
              <span className="text-loss font-mono">{fmt(contextInfo.expenses)}</span>
            </div>
          )}
          {loadingCtx && (
            <span className="text-xs text-muted flex items-center gap-1.5 ml-1">
              <span className="w-3 h-3 border border-muted border-t-transparent rounded-full animate-spin"/>
              Loading {span.label} data...
            </span>
          )}
        </div>
      </div>

      {/* Warnings */}
      {(!ollamaOk || !model) && (
        <div className="px-6 py-3 shrink-0 space-y-2">
          {!ollamaOk && (
            <div className="p-3 bg-loss-dim border border-loss border-opacity-30 rounded-xl text-sm text-loss">
              ⚠️ Ollama not running. Run <code className="font-mono bg-black/20 px-1 rounded">ollama serve</code> in your terminal.
            </div>
          )}
          {!model && (
            <div className="p-3 bg-surface-2 border border-border rounded-xl text-sm text-muted">
              No model selected. <button onClick={() => setPage('settings')} className="text-accent underline">Open Settings</button> to pick one.
            </div>
          )}
        </div>
      )}

      {/* ── Chat area ── */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-6 animate-fade-in">
            <div className="text-center">
              <div className="w-16 h-16 rounded-2xl bg-surface-2 border border-border flex items-center justify-center text-3xl mx-auto mb-4">🧠</div>
              <p className="text-text font-semibold">Your local finance AI</p>
              <p className="text-muted text-sm mt-1">Analysing your last <span className="text-text font-medium">{span.label}</span></p>
              {dataLoaded && contextInfo && (
                <p className="text-accent text-xs mt-2">
                  ✓ {contextInfo.count} transactions loaded · {fmt(contextInfo.income)} income · {fmt(contextInfo.expenses)} expenses
                </p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2 max-w-lg w-full">
              {SUGGESTIONS.map(s => (
                <button key={s} onClick={() => send(s)} disabled={!dataLoaded || !model || !ollamaOk}
                  className="text-left px-4 py-3 bg-surface-1 border border-border rounded-xl text-sm text-muted hover:text-text hover:border-border-bright transition-all disabled:opacity-40">
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg, i) => (
            <ChatBubble key={i} msg={msg} isLast={i === messages.length - 1} streaming={streaming}/>
          ))
        )}
        <div ref={messagesEndRef}/>
      </div>

      {/* ── Input ── */}
      <div className="px-6 pb-6 pt-3 shrink-0 border-t border-border">
        <div className="flex gap-3 items-end">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
            placeholder={`Ask about your last ${span.label}... (Enter to send)`}
            rows={1}
            disabled={streaming || !ollamaOk || !model || !dataLoaded}
            className="flex-1 bg-surface-1 border border-border rounded-2xl px-4 py-3 text-sm text-text placeholder-muted resize-none min-h-[48px] max-h-32 disabled:opacity-50 disabled:cursor-not-allowed"
            onInput={e => { e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 128) + 'px' }}
          />
          <button onClick={() => send()}
            disabled={!input.trim() || streaming || !ollamaOk || !model || !dataLoaded}
            className="w-12 h-12 bg-accent text-surface rounded-2xl flex items-center justify-center hover:bg-opacity-90 transition-all disabled:opacity-40 shrink-0">
            {streaming
              ? <span className="w-4 h-4 border-2 border-surface border-t-transparent rounded-full animate-spin"/>
              : <SendIcon/>
            }
          </button>
        </div>
        <p className="text-xs text-muted mt-2 text-center">All processing happens locally — your data never leaves your device</p>
      </div>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────
function ChatBubble({ msg, isLast, streaming }) {
  const isUser  = msg.role === 'user'
  const isEmpty = !msg.content && isLast && streaming

  return (
    <div className={`flex gap-3 animate-slide-up ${isUser ? 'flex-row-reverse' : ''}`}>
      <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-sm shrink-0 ${
        isUser ? 'bg-accent text-surface' : 'bg-surface-2 border border-border text-base'
      }`}>
        {isUser ? '👤' : '🧠'}
      </div>
      <div className={`max-w-[75%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
        isUser
          ? 'bg-accent text-surface rounded-tr-sm'
          : 'bg-surface-1 border border-border text-text rounded-tl-sm'
      }`}>
        {isEmpty ? (
          <span className="flex gap-1">
            {[0,150,300].map(d => (
              <span key={d} className="w-1.5 h-1.5 bg-muted rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }}/>
            ))}
          </span>
        ) : (
          <FormattedMessage content={msg.content}/>
        )}
      </div>
    </div>
  )
}

function FormattedMessage({ content }) {
  return (
    <>
      {content.split('\n').map((line, i) => {
        if (line.startsWith('**') && line.endsWith('**'))
          return <p key={i} className="font-semibold mt-2 mb-1">{line.slice(2, -2)}</p>
        if (line.startsWith('- ') || line.startsWith('• '))
          return <p key={i} className="ml-3 before:content-['•'] before:mr-2">{line.slice(2)}</p>
        if (line === '') return <br key={i}/>
        return <p key={i}>{line}</p>
      })}
    </>
  )
}

function SendIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="m22 2-7 20-4-9-9-4 20-7z"/>
    </svg>
  )
}
