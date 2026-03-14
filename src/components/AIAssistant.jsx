import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useApp } from '../App'

function buildFinancialContext(summary, transactions, breakdown) {
  const fmt = n => `${Math.abs(n).toFixed(2)}`
  const topExpenses = breakdown.filter(b => b.type === 'expense').slice(0, 5)
  const topIncome = breakdown.filter(b => b.type === 'income').slice(0, 3)
  const recentTxs = transactions.slice(0, 10)

  return `You are a knowledgeable personal finance assistant. The user's financial data is provided below. Use it to give accurate, actionable advice. Be concise and conversational.

=== FINANCIAL SUMMARY (Last 90 days) ===
Total Income: €${fmt(summary.income)}
Total Expenses: €${fmt(summary.expenses)}
Net Balance: €${fmt(summary.net)}
Transaction count: ${summary.count}
Savings rate: ${summary.income > 0 ? Math.round((summary.net / summary.income) * 100) : 0}%

=== TOP EXPENSE CATEGORIES ===
${topExpenses.map(b => `- ${b.category || 'Uncategorized'}: €${fmt(b.total)} (${b.count} transactions)`).join('\n') || 'No expense data'}

=== INCOME SOURCES ===
${topIncome.map(b => `- ${b.category || 'Other'}: €${fmt(b.total)}`).join('\n') || 'No income data'}

=== RECENT TRANSACTIONS ===
${recentTxs.map(t => `${t.date} | ${t.type === 'income' ? '+' : '-'}€${fmt(Math.abs(t.amount))} | ${t.description}${t.category ? ` [${t.category}]` : ''}`).join('\n') || 'No transactions'}

Answer the user's questions based on this data. If they ask about something not in the data, say so. Do not make up numbers.`
}

const SUGGESTIONS = [
  "Analyze my spending patterns",
  "Where can I save money?",
  "What's my biggest expense category?",
  "Am I saving enough?",
  "Give me a budget recommendation",
  "What trends do you see in my finances?"
]

export default function AIAssistant() {
  const { settings, ollamaOk, setPage } = useApp()
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [systemCtx, setSystemCtx] = useState('')
  const [dataLoaded, setDataLoaded] = useState(false)
  const messagesEndRef = useRef(null)
  const removeTokenListener = useRef(null)

  const model = settings.assistant_model || ''

  useEffect(() => {
    loadContext()
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Cleanup token listener on unmount
  useEffect(() => {
    return () => { removeTokenListener.current?.() }
  }, [])

  async function loadContext() {
    const now = new Date()
    const from = new Date(now - 90 * 86400000).toISOString().split('T')[0]
    const to = now.toISOString().split('T')[0]

    const [summary, txs, breakdown] = await Promise.all([
      window.api.stats.getSummary({ dateFrom: from, dateTo: to }),
      window.api.transactions.getAll({ dateFrom: from, dateTo: to, limit: 50 }),
      window.api.stats.getCategoryBreakdown({ dateFrom: from, dateTo: to })
    ])

    setSystemCtx(buildFinancialContext(summary, txs, breakdown))
    setDataLoaded(true)
  }

  async function send(text) {
    const userText = (text || input).trim()
    if (!userText || streaming) return
    if (!model) { alert('Please select an AI assistant model in Settings.'); return }
    if (!ollamaOk) { alert('Ollama is not running. Please start Ollama.'); return }

    setInput('')
    const newMessages = [...messages, { role: 'user', content: userText }]
    setMessages(newMessages)
    setStreaming(true)

    // Add empty assistant message that we'll stream into
    setMessages(msgs => [...msgs, { role: 'assistant', content: '' }])

    let full = ''

    // Register streaming token listener
    if (removeTokenListener.current) removeTokenListener.current()
    removeTokenListener.current = window.api.ollama.onToken((token) => {
      full += token
      setMessages(msgs => {
        const updated = [...msgs]
        updated[updated.length - 1] = { role: 'assistant', content: full }
        return updated
      })
    })

    try {
      await window.api.ollama.chat({
        model,
        messages: newMessages,
        system: systemCtx
      })
    } catch (e) {
      setMessages(msgs => {
        const updated = [...msgs]
        updated[updated.length - 1] = {
          role: 'assistant',
          content: `Error: ${e.message || 'Failed to get response from Ollama.'}`
        }
        return updated
      })
    } finally {
      setStreaming(false)
      removeTokenListener.current?.()
    }
  }

  function clearChat() { setMessages([]) }

  return (
    <div className="h-full flex flex-col animate-fade-in">

      {/* Header */}
      <div className="px-6 pt-6 pb-4 border-b border-border shrink-0 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-text-bright">AI Assistant</h1>
          <p className="text-muted text-sm mt-0.5">
            {model ? `Using ${model} · runs locally` : 'No model selected'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-1.5 text-xs ${ollamaOk ? 'text-accent' : 'text-loss'}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${ollamaOk ? 'bg-accent animate-pulse-slow' : 'bg-loss'}`}/>
            {ollamaOk ? 'Ollama running' : 'Ollama offline'}
          </div>
          {messages.length > 0 && (
            <button onClick={clearChat} className="text-xs text-muted hover:text-text border border-border px-3 py-1.5 rounded-xl transition-all">
              Clear chat
            </button>
          )}
        </div>
      </div>

      {/* Warnings */}
      {(!ollamaOk || !model) && (
        <div className="px-6 py-3 shrink-0">
          {!ollamaOk && (
            <div className="p-3 bg-loss-dim border border-loss border-opacity-30 rounded-xl text-sm text-loss mb-2">
              ⚠️ Ollama is not running. Run <code className="font-mono bg-black/20 px-1 rounded">ollama serve</code> in your terminal.
            </div>
          )}
          {!model && (
            <div className="p-3 bg-surface-2 border border-border rounded-xl text-sm text-muted">
              No model selected. <button onClick={() => setPage('settings')} className="text-accent underline">Go to Settings</button> to pick a model.
            </div>
          )}
        </div>
      )}

      {/* Chat area */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-6 animate-fade-in">
            <div>
              <div className="w-16 h-16 rounded-2xl bg-surface-2 border border-border flex items-center justify-center text-3xl mx-auto mb-4">🧠</div>
              <p className="text-text font-semibold text-center">Your local finance AI</p>
              <p className="text-muted text-sm text-center mt-1">Ask about your spending, trends, and get personalized advice</p>
              {dataLoaded && <p className="text-accent text-xs text-center mt-2">✓ Financial data loaded</p>}
            </div>
            <div className="grid grid-cols-2 gap-2 max-w-lg w-full">
              {SUGGESTIONS.map(s => (
                <button key={s} onClick={() => send(s)}
                  className="text-left px-4 py-3 bg-surface-1 border border-border rounded-xl text-sm text-muted hover:text-text hover:border-border-bright transition-all">
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

      {/* Input */}
      <div className="px-6 pb-6 pt-3 shrink-0 border-t border-border">
        <div className="flex gap-3 items-end">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
            placeholder="Ask about your finances... (Enter to send, Shift+Enter for newline)"
            rows={1}
            disabled={streaming || !ollamaOk || !model}
            className="flex-1 bg-surface-1 border border-border rounded-2xl px-4 py-3 text-sm text-text placeholder-muted resize-none min-h-[48px] max-h-32 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ height: 'auto' }}
            onInput={e => { e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 128) + 'px' }}
          />
          <button
            onClick={() => send()}
            disabled={!input.trim() || streaming || !ollamaOk || !model}
            className="w-12 h-12 bg-accent text-surface rounded-2xl flex items-center justify-center hover:bg-opacity-90 transition-all disabled:opacity-40 shrink-0"
          >
            {streaming ? (
              <span className="w-4 h-4 border-2 border-surface border-t-transparent rounded-full animate-spin"/>
            ) : (
              <SendIcon/>
            )}
          </button>
        </div>
        <p className="text-xs text-muted mt-2 text-center">All processing happens locally — your data never leaves your device</p>
      </div>
    </div>
  )
}

function ChatBubble({ msg, isLast, streaming }) {
  const isUser = msg.role === 'user'
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
            <span className="w-1.5 h-1.5 bg-muted rounded-full animate-bounce" style={{ animationDelay: '0ms' }}/>
            <span className="w-1.5 h-1.5 bg-muted rounded-full animate-bounce" style={{ animationDelay: '150ms' }}/>
            <span className="w-1.5 h-1.5 bg-muted rounded-full animate-bounce" style={{ animationDelay: '300ms' }}/>
          </span>
        ) : (
          <FormattedMessage content={msg.content}/>
        )}
      </div>
    </div>
  )
}

function FormattedMessage({ content }) {
  // Simple markdown-like formatting
  const parts = content.split('\n')
  return (
    <>
      {parts.map((line, i) => {
        if (line.startsWith('**') && line.endsWith('**')) {
          return <p key={i} className="font-semibold mt-2 mb-1">{line.slice(2, -2)}</p>
        }
        if (line.startsWith('- ') || line.startsWith('• ')) {
          return <p key={i} className="ml-3 before:content-['•'] before:mr-2">{line.slice(2)}</p>
        }
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
