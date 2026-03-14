import React, { useState, useEffect, useRef } from 'react'
import { useApp } from '../App'

const TIME_SPANS = [
  { label: '7 Days',   days: 7   },
  { label: '2 Weeks',  days: 14  },
  { label: '1 Month',  days: 30  },
  { label: '3 Months', days: 90  },
  { label: '6 Months', days: 180 },
  { label: '1 Year',   days: 365 },
]

function getDateRange(days) {
  const now = new Date()
  return {
    from: new Date(now - days * 86400000).toISOString().split('T')[0],
    to:   now.toISOString().split('T')[0]
  }
}

function buildSystemContext(summary, transactions, breakdown, spanLabel, currency, userMemory, userName) {
  const fmt = n => `${Math.abs(n).toFixed(2)}`
  const topExpenses = breakdown.filter(b => b.type === 'expense').slice(0, 6)
  const topIncome   = breakdown.filter(b => b.type === 'income').slice(0, 3)
  const savingsRate = summary.income > 0 ? Math.round((summary.net / summary.income) * 100) : 0
  const userBlock   = (userMemory || userName)
    ? `\n=== USER PROFILE ===\n${userName ? `Name: ${userName}\n` : ''}${userMemory ? `Notes: ${userMemory}` : ''}\n`
    : ''

  return `You are a knowledgeable personal finance assistant.${userName ? ` The user's name is ${userName}.` : ''} Use the financial data below to give accurate, actionable advice. Be concise and reference actual numbers.
${userBlock}
=== FINANCIAL SUMMARY (${spanLabel}) ===
Total Income:   ${currency}${fmt(summary.income)}
Total Expenses: ${currency}${fmt(summary.expenses)}
Net Balance:    ${currency}${fmt(summary.net)}
Savings rate:   ${savingsRate}%
Transactions:   ${summary.count}

=== TOP EXPENSE CATEGORIES ===
${topExpenses.map(b => `- ${b.category || 'Uncategorized'}: ${currency}${fmt(b.total)} (${b.count} transactions)`).join('\n') || 'No data'}

=== INCOME SOURCES ===
${topIncome.map(b => `- ${b.category || 'Other'}: ${currency}${fmt(b.total)}`).join('\n') || 'No data'}

=== RECENT TRANSACTIONS (last 20) ===
${transactions.slice(0, 20).map(t =>
  `${t.date} | ${t.type === 'income' ? '+' : '-'}${currency}${fmt(Math.abs(t.amount))} | ${t.description}${t.category ? ` [${t.category}]` : ''}`
).join('\n') || 'No transactions'}

Do not invent numbers. If asked about something outside this window, say so.`
}

const GREETINGS = [
  (name) => `Hi ${name} 👋`,
  (name) => `Hey ${name} 👋`,
  (name) => `Welcome back, ${name} 👋`,
  (name) => `Good to see you, ${name} 👋`,
  (name) => `Hello, ${name} 👋`,
  (name) => `What's up, ${name} 👋`,
]

// Pick a stable greeting per session (not re-randomized on re-render)
function getGreeting(name) {
  const idx = Math.floor(Math.random() * GREETINGS.length)
  return GREETINGS[idx](name)
}

const SUGGESTIONS = [
  'Analyze my spending patterns', 'Where can I cut expenses?',
  "What's my biggest expense?",   'Am I saving enough?',
  'Give me a budget plan',         'Any unusual spending this period?',
]

export default function AIAssistant() {
  const { settings, ollamaOk, currency, setPage } = useApp()

  // Sidebar / chat history
  const [chats,        setChats]       = useState([])
  const [activeChatId, setActiveChatId] = useState(null)
  const [sidebarOpen,  setSidebarOpen]  = useState(true)
  const [editingId,    setEditingId]    = useState(null)
  const [editTitle,    setEditTitle]    = useState('')

  // Session
  const [messages,    setMessages]   = useState([])
  const [input,       setInput]      = useState('')
  const [streaming,   setStreaming]  = useState(false)
  const [systemCtx,   setSystemCtx]  = useState('')
  const [dataLoaded,  setDataLoaded] = useState(false)
  const [spanIdx,     setSpanIdx]    = useState(2)
  const [contextInfo, setContextInfo]= useState(null)
  const [loadingCtx,  setLoadingCtx] = useState(false)

  // Message editing
  const [editMsgIdx,  setEditMsgIdx]  = useState(null) // index of message being edited
  const [editMsgText, setEditMsgText] = useState('')

  const messagesEndRef      = useRef(null)
  const removeTokenListener = useRef(null)
  const activeChatIdRef     = useRef(null) // needed inside async closures

  const model    = settings.assistant_model || ''
  const span     = TIME_SPANS[spanIdx]
  const userName = settings.user_name   || ''
  const userMem  = settings.user_memory || ''
  const greetingRef = React.useRef(userName ? getGreeting(userName) : '')
  // Refresh greeting if userName changes
  React.useEffect(() => {
    if (userName) greetingRef.current = getGreeting(userName)
  }, [userName])

  useEffect(() => { loadChats() }, [])
  useEffect(() => { loadContext(span) }, [spanIdx])
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])
  useEffect(() => { activeChatIdRef.current = activeChatId }, [activeChatId])
  useEffect(() => () => { removeTokenListener.current?.() }, [])

  // ── History ─────────────────────────────────────────────────────────────────
  async function loadChats() {
    const list = await window.api.chats.getAll()
    setChats(list)
  }

  async function newChat() {
    setActiveChatId(null)
    setMessages([])
  }

  async function loadChat(chat) {
    setActiveChatId(chat.id)
    activeChatIdRef.current = chat.id
    const msgs = await window.api.chats.getMessages(chat.id)
    setMessages(msgs.map(m => ({ role: m.role, content: m.content })))
    const idx = TIME_SPANS.findIndex(s => s.label === chat.span_label)
    if (idx >= 0) setSpanIdx(idx)
  }

  async function deleteChat(id, e) {
    e.stopPropagation()
    if (!confirm('Delete this chat?')) return
    await window.api.chats.delete(id)
    setChats(prev => prev.filter(c => c.id !== id))
    if (activeChatId === id) { setActiveChatId(null); setMessages([]) }
  }

  async function saveTitle(id) {
    if (!editTitle.trim()) return
    await window.api.chats.updateTitle(id, editTitle)
    setChats(prev => prev.map(c => c.id === id ? { ...c, title: editTitle } : c))
    setEditingId(null)
  }

  // ── Context ──────────────────────────────────────────────────────────────────
  async function loadContext(span) {
    setDataLoaded(false); setLoadingCtx(true)
    const { from, to } = getDateRange(span.days)
    const [summary, txs, breakdown] = await Promise.all([
      window.api.stats.getSummary({ dateFrom: from, dateTo: to }),
      window.api.transactions.getAll({ dateFrom: from, dateTo: to, limit: 100 }),
      window.api.stats.getCategoryBreakdown({ dateFrom: from, dateTo: to })
    ])
    setSystemCtx(buildSystemContext(summary, txs, breakdown, span.label, currency, userMem, userName))
    setContextInfo({ income: summary.income, expenses: summary.expenses, count: summary.count })
    setDataLoaded(true); setLoadingCtx(false)
  }

  function changeSpan(idx) {
    if (idx === spanIdx) return
    setSpanIdx(idx)
    if (messages.length > 0) setMessages([])
    setActiveChatId(null)
  }

  // ── Stop ─────────────────────────────────────────────────────────────────────
  function stopGeneration() {
    window.api.ollama.stop()
    setStreaming(false)
    removeTokenListener.current?.()
  }

  // ── Send / re-send ───────────────────────────────────────────────────────────
  async function send(text, historyOverride) {
    const userText = (text || input).trim()
    if (!userText || streaming) return
    if (!model)    { alert('Please select an AI model in Settings.'); return }
    if (!ollamaOk) { alert('Ollama is not running.'); return }

    setInput('')
    const base = historyOverride || messages
    const newMessages = [...base, { role: 'user', content: userText }]
    setMessages(newMessages)
    setStreaming(true)
    setMessages(msgs => [...msgs, { role: 'assistant', content: '' }])

    // Auto-create chat on first message
    let chatId = activeChatIdRef.current
    if (!chatId) {
      const title = userText.slice(0, 50) + (userText.length > 50 ? '…' : '')
      const chat  = await window.api.chats.create(title, span.label, span.days)
      setChats(prev => [chat, ...prev])
      setActiveChatId(chat.id)
      activeChatIdRef.current = chat.id
      chatId = chat.id
    }
    await window.api.chats.addMessage(chatId, 'user', userText)

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
      if (full) await window.api.chats.addMessage(activeChatIdRef.current, 'assistant', full)
      loadChats()
    } catch (e) {
      setMessages(msgs => {
        const u = [...msgs]
        u[u.length - 1] = { role: 'assistant', content: `Error: ${e.message || 'Failed.'}` }
        return u
      })
    } finally {
      setStreaming(false)
      removeTokenListener.current?.()
    }
  }

  // ── Edit message ─────────────────────────────────────────────────────────────
  function startEditMsg(idx) {
    if (streaming) return
    setEditMsgIdx(idx)
    setEditMsgText(messages[idx].content)
  }

  async function submitEditMsg(idx) {
    if (!editMsgText.trim()) return
    // Truncate history to just before this message, then re-send
    const historyBefore = messages.slice(0, idx)
    setMessages(historyBefore)
    setEditMsgIdx(null)
    await send(editMsgText, historyBefore)
  }

  const fmt = n => `${currency}${Math.abs(n).toLocaleString('de-DE', { minimumFractionDigits: 2 })}`

  return (
    <div className="h-full flex overflow-hidden animate-fade-in">

      {/* ── Sidebar ── */}
      {sidebarOpen && (
        <aside className="w-60 shrink-0 border-r border-border bg-surface-1 flex flex-col">
          <div className="px-3 pt-4 pb-2 shrink-0">
            <button onClick={newChat}
              className="w-full flex items-center gap-2 px-3 py-2.5 bg-accent text-surface rounded-xl text-sm font-semibold hover:bg-opacity-90 transition-all">
              <span className="text-lg leading-none">+</span> New Chat
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-2 py-1 space-y-0.5">
            {chats.length === 0 && <p className="text-xs text-muted text-center py-6">No saved chats yet</p>}
            {chats.map(chat => (
              <div key={chat.id} onClick={() => loadChat(chat)}
                className={`group flex items-center gap-2 px-2 py-2 rounded-xl cursor-pointer transition-all ${
                  activeChatId === chat.id ? 'bg-surface-3 text-text' : 'hover:bg-surface-2 text-muted hover:text-text'
                }`}>
                <span className="text-sm shrink-0">💬</span>
                {editingId === chat.id ? (
                  <input value={editTitle} onChange={e => setEditTitle(e.target.value)}
                    onBlur={() => saveTitle(chat.id)}
                    onKeyDown={e => e.key === 'Enter' && saveTitle(chat.id)}
                    onClick={e => e.stopPropagation()} autoFocus
                    className="flex-1 bg-surface-1 border border-accent rounded-lg px-1.5 py-0.5 text-xs text-text min-w-0"/>
                ) : (
                  <span className="flex-1 text-xs truncate">{chat.title}</span>
                )}
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 shrink-0">
                  <button onClick={e => { e.stopPropagation(); setEditingId(chat.id); setEditTitle(chat.title) }}
                    className="text-muted hover:text-text p-0.5 rounded text-xs" title="Rename">✏️</button>
                  <button onClick={e => deleteChat(chat.id, e)}
                    className="text-muted hover:text-loss p-0.5 rounded text-xs" title="Delete">🗑️</button>
                </div>
              </div>
            ))}
          </div>
          <div className="px-3 py-2 border-t border-border text-xs text-muted shrink-0">
            {chats.length} saved chat{chats.length !== 1 ? 's' : ''}
          </div>
        </aside>
      )}

      {/* ── Main ── */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Header */}
        <div className="px-6 pt-5 pb-4 border-b border-border shrink-0">
          <div className="flex items-center justify-between mb-3 gap-4">
            <div className="flex items-center gap-3 min-w-0 overflow-hidden">
              <button onClick={() => setSidebarOpen(v => !v)}
                className="text-muted hover:text-text p-1.5 rounded-lg hover:bg-surface-2 transition-all shrink-0" title="Toggle history">
                <HistoryIcon/>
              </button>
              <div className="min-w-0 overflow-hidden">
                <h1 className="font-display text-2xl font-bold text-text-bright truncate">
                  {userName ? greetingRef.current : 'AI Assistant'}
                </h1>
                <p className="text-muted text-sm mt-0.5 truncate">{model ? `${model} · local` : 'No model selected'}</p>
              </div>
            </div>
            <div className={`flex items-center gap-1.5 text-xs shrink-0 ${ollamaOk ? 'text-accent' : 'text-loss'}`}>
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${ollamaOk ? 'bg-accent animate-pulse-slow' : 'bg-loss'}`}/>
              {ollamaOk ? 'Ollama running' : 'Ollama offline'}
            </div>
          </div>

          {/* Timespan */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-muted shrink-0">Data window:</span>
            <div className="flex items-center gap-1 bg-surface-2 p-1 rounded-xl border border-border">
              {TIME_SPANS.map((s, i) => (
                <button key={s.label} onClick={() => changeSpan(i)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${i === spanIdx ? 'bg-accent text-surface font-semibold' : 'text-muted hover:text-text'}`}>
                  {s.label}
                </button>
              ))}
            </div>
            {dataLoaded && contextInfo && (
              <span className="text-xs text-muted flex items-center gap-1.5">
                <span className="text-accent">✓</span>
                {contextInfo.count} tx · <span className="text-accent">{fmt(contextInfo.income)}</span>
                {' · '}<span className="text-loss">{fmt(contextInfo.expenses)}</span>
              </span>
            )}
            {loadingCtx && <span className="text-xs text-muted flex items-center gap-1.5"><span className="w-3 h-3 border border-muted border-t-transparent rounded-full animate-spin"/>Loading...</span>}
          </div>
        </div>

        {/* Warnings */}
        {(!ollamaOk || !model) && (
          <div className="px-6 py-3 shrink-0 space-y-2">
            {!ollamaOk && <div className="p-3 bg-loss-dim border border-loss border-opacity-30 rounded-xl text-sm text-loss">⚠️ Ollama not running. Run <code className="font-mono bg-black/20 px-1 rounded">ollama serve</code>.</div>}
            {!model && <div className="p-3 bg-surface-2 border border-border rounded-xl text-sm text-muted">No model selected. <button onClick={() => setPage('settings')} className="text-accent underline">Open Settings</button></div>}
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-6 animate-fade-in">
              <div className="text-center">
                <div className="w-16 h-16 rounded-2xl bg-surface-2 border border-border flex items-center justify-center text-3xl mx-auto mb-4">🧠</div>
                <p className="text-text font-semibold">{userName ? `What can I help you with, ${userName}?` : 'Your local finance AI'}</p>
                <p className="text-muted text-sm mt-1">Analysing your last <span className="text-text font-medium">{span.label}</span></p>
                {dataLoaded && contextInfo && <p className="text-accent text-xs mt-2">✓ {contextInfo.count} transactions loaded</p>}
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
              <ChatBubble
                key={i} msg={msg}
                isLast={i === messages.length - 1}
                streaming={streaming}
                isEditing={editMsgIdx === i}
                editText={editMsgText}
                onEditStart={() => startEditMsg(i)}
                onEditChange={setEditMsgText}
                onEditSubmit={() => submitEditMsg(i)}
                onEditCancel={() => setEditMsgIdx(null)}
                canEdit={!streaming}
              />
            ))
          )}
          <div ref={messagesEndRef}/>
        </div>

        {/* Input */}
        <div className="px-6 pb-6 pt-3 shrink-0 border-t border-border">
          <div className="flex gap-3 items-end">
            <textarea value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
              placeholder={`Ask about your last ${span.label}... (Enter to send)`}
              rows={1} disabled={streaming || !ollamaOk || !model || !dataLoaded}
              className="flex-1 bg-surface-1 border border-border rounded-2xl px-4 py-3 text-sm text-text placeholder-muted resize-none min-h-[48px] max-h-32 disabled:opacity-50 disabled:cursor-not-allowed"
              onInput={e => { e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 128) + 'px' }}
            />
            {streaming ? (
              <button onClick={stopGeneration}
                className="w-12 h-12 bg-loss text-white rounded-2xl flex items-center justify-center hover:bg-opacity-90 transition-all shrink-0"
                title="Stop generation">
                <StopIcon/>
              </button>
            ) : (
              <button onClick={() => send()} disabled={!input.trim() || !ollamaOk || !model || !dataLoaded}
                className="w-12 h-12 bg-accent text-surface rounded-2xl flex items-center justify-center hover:bg-opacity-90 transition-all disabled:opacity-40 shrink-0">
                <SendIcon/>
              </button>
            )}
          </div>
          <p className="text-xs text-muted mt-2 text-center">All processing happens locally — your data never leaves your device</p>
        </div>
      </div>
    </div>
  )
}

// ── ChatBubble ────────────────────────────────────────────────────────────────
function ChatBubble({ msg, isLast, streaming, isEditing, editText, onEditStart, onEditChange, onEditSubmit, onEditCancel, canEdit }) {
  const isUser  = msg.role === 'user'
  const isEmpty = !msg.content && isLast && streaming

  return (
    <div className={`flex gap-3 animate-slide-up group ${isUser ? 'flex-row-reverse' : ''}`}>
      <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-sm shrink-0 ${isUser ? 'bg-accent text-surface' : 'bg-surface-2 border border-border text-base'}`}>
        {isUser ? '👤' : '🧠'}
      </div>

      <div className="flex flex-col gap-1 max-w-[75%]">
        {isEditing ? (
          /* Edit mode */
          <div className="flex flex-col gap-2">
            <textarea
              value={editText}
              onChange={e => onEditChange(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onEditSubmit() } }}
              autoFocus
              rows={3}
              className="bg-surface-2 border border-accent rounded-2xl px-4 py-3 text-sm text-text resize-none min-w-[300px]"
            />
            <div className="flex gap-2 justify-end">
              <button onClick={onEditCancel}
                className="px-3 py-1.5 text-xs text-muted border border-border rounded-xl hover:text-text transition-all">
                Cancel
              </button>
              <button onClick={onEditSubmit}
                className="px-3 py-1.5 text-xs bg-accent text-surface rounded-xl font-medium hover:bg-opacity-90 transition-all">
                Re-send ↵
              </button>
            </div>
          </div>
        ) : (
          /* Normal mode */
          <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${isUser ? 'bg-accent text-surface rounded-tr-sm' : 'bg-surface-1 border border-border text-text rounded-tl-sm'}`}>
            {isEmpty ? (
              <span className="flex gap-1">
                {[0,150,300].map(d => <span key={d} className="w-1.5 h-1.5 bg-muted rounded-full animate-bounce" style={{ animationDelay:`${d}ms`}}/>)}
              </span>
            ) : <FormattedMessage content={msg.content}/>}
          </div>
        )}

        {/* Edit button — only user messages, only when not streaming */}
        {isUser && canEdit && !isEditing && (
          <button onClick={onEditStart}
            className="self-end text-xs text-muted opacity-0 group-hover:opacity-100 hover:text-text transition-all flex items-center gap-1 px-2 py-0.5 rounded-lg hover:bg-surface-2">
            <EditIcon/> Edit
          </button>
        )}
      </div>
    </div>
  )
}

function FormattedMessage({ content }) {
  return (
    <>
      {content.split('\n').map((line, i) => {
        if (line.startsWith('**') && line.endsWith('**')) return <p key={i} className="font-semibold mt-2 mb-1">{line.slice(2,-2)}</p>
        if (line.startsWith('- ') || line.startsWith('• ')) return <p key={i} className="ml-3 before:content-['•'] before:mr-2">{line.slice(2)}</p>
        if (line === '') return <br key={i}/>
        return <p key={i}>{line}</p>
      })}
    </>
  )
}

function SendIcon()    { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m22 2-7 20-4-9-9-4 20-7z"/></svg> }
function StopIcon()    { return <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="4" width="16" height="16" rx="2"/></svg> }
function HistoryIcon() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 3h6v6H3z"/><path d="M15 3h6v6h-6z"/><path d="M3 15h6v6H3z"/><path d="M15 15h6v6h-6z"/></svg> }
function EditIcon()    { return <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> }
