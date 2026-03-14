import React, { useState, useEffect } from 'react'
import { useApp } from '../App'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'

const TIME_RANGES = [
  { label: '1M',  days: 30  },
  { label: '3M',  days: 90  },
  { label: '6M',  days: 180 },
  { label: '1Y',  days: 365 },
  { label: 'All', days: null }
]

function getDateRange(days) {
  const to = new Date().toISOString().split('T')[0]
  if (!days) return { dateTo: to }
  return { dateFrom: new Date(Date.now() - days * 86400000).toISOString().split('T')[0], dateTo: to }
}

export default function Merchants() {
  const { currency, categories } = useApp()
  const [merchants,    setMerchants]    = useState([])
  const [selected,     setSelected]     = useState(null)
  const [history,      setHistory]      = useState([])
  const [loading,      setLoading]      = useState(true)
  const [histLoading,  setHistLoading]  = useState(false)
  const [rangeIdx,     setRangeIdx]     = useState(2) // 6M default
  const [filterType,   setFilterType]   = useState('expense')
  const [search,       setSearch]       = useState('')

  const range = TIME_RANGES[rangeIdx]

  useEffect(() => { loadMerchants() }, [rangeIdx, filterType])

  async function loadMerchants() {
    setLoading(true)
    setSelected(null)
    setHistory([])
    const filters = { ...getDateRange(range.days), type: filterType || undefined }
    const rows = await window.api.merchants.getAll(filters)
    setMerchants(rows)
    setLoading(false)
  }

  async function selectMerchant(m) {
    if (selected?.description === m.description) { setSelected(null); setHistory([]); return }
    setSelected(m)
    setHistLoading(true)
    const rows = await window.api.merchants.getHistory(m.description, getDateRange(range.days))
    setHistory(rows)
    setHistLoading(false)
  }

  const fmt  = n => `${currency}${Math.abs(n).toLocaleString('de-DE', { minimumFractionDigits: 2 })}`
  const getCatColor = name => categories.find(c => c.name === name)?.color || '#64748b'
  const getCatIcon  = name => categories.find(c => c.name === name)?.icon  || '📋'

  const filtered = merchants.filter(m =>
    !search || m.description.toLowerCase().includes(search.toLowerCase())
  )

  // Top 10 for the bar chart
  const chartData = filtered.slice(0, 12).map(m => ({
    name: m.description.length > 18 ? m.description.slice(0, 18) + '…' : m.description,
    fullName: m.description,
    total: m.total,
    category: m.category
  }))

  return (
    <div className="h-full flex overflow-hidden">

      {/* ── Left: list ── */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Controls */}
        <div className="px-4 py-3 border-b border-border shrink-0 space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Search */}
            <div className="relative flex-1 min-w-[160px] max-w-xs">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted text-xs">🔍</span>
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search merchants..."
                className="w-full bg-surface-2 border border-border rounded-xl pl-8 pr-3 py-1.5 text-xs text-text placeholder-muted"/>
            </div>
            {/* Type toggle */}
            <div className="flex bg-surface-1 border border-border rounded-xl overflow-hidden">
              {['expense','income','all'].map(t => (
                <button key={t} onClick={() => setFilterType(t === 'all' ? '' : t)}
                  className={`px-3 py-1.5 text-xs font-medium capitalize transition-all ${
                    (filterType === t || (!filterType && t === 'all')) ? 'bg-surface-3 text-text' : 'text-muted hover:text-text'}`}>
                  {t}
                </button>
              ))}
            </div>
            {/* Time range */}
            <div className="flex items-center gap-1 bg-surface-1 p-1 rounded-xl border border-border">
              {TIME_RANGES.map((r, i) => (
                <button key={r.label} onClick={() => setRangeIdx(i)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${i === rangeIdx ? 'bg-accent text-surface' : 'text-muted hover:text-text'}`}>
                  {r.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Bar chart — top merchants */}
        {!loading && chartData.length > 0 && (
          <div className="px-4 pt-3 pb-1 shrink-0">
            <p className="text-xs text-muted mb-2">Top merchants by total spend</p>
            <ResponsiveContainer width="100%" height={110}>
              <BarChart data={chartData} margin={{ top: 0, right: 4, bottom: 0, left: 0 }}>
                <XAxis dataKey="name" tick={{ fill: 'var(--text-muted)', fontSize: 9, fontFamily: 'IBM Plex Mono' }} axisLine={false} tickLine={false} interval={0}/>
                <YAxis hide/>
                <Tooltip
                  formatter={(v, _, props) => [fmt(v), props.payload.fullName]}
                  contentStyle={{ background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                />
                <Bar dataKey="total" radius={[4, 4, 0, 0]}>
                  {chartData.map(entry => (
                    <Cell key={entry.fullName}
                      fill={getCatColor(entry.category)}
                      opacity={selected?.description === entry.fullName ? 1 : 0.7}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Merchant list */}
        <div className="flex-1 overflow-y-auto px-4 pb-4">
          {loading ? (
            <div className="space-y-2 pt-3">{[...Array(6)].map((_,i) => <div key={i} className="h-14 skeleton rounded-xl"/>)}</div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-muted">
              <span className="text-3xl mb-2">🏪</span>
              <p className="text-sm">No merchants found</p>
            </div>
          ) : (
            <div className="space-y-1 pt-2">
              {/* Header row */}
              <div className="grid grid-cols-[1fr_80px_70px_70px_60px] gap-2 px-3 py-1 text-xs uppercase tracking-widest text-muted">
                <span>Merchant</span><span className="text-right">Total</span>
                <span className="text-right">Avg</span><span className="text-right">Count</span><span/>
              </div>
              {filtered.map(m => {
                const isActive = selected?.description === m.description
                return (
                  <div key={m.description + m.type}
                    onClick={() => selectMerchant(m)}
                    className={`grid grid-cols-[1fr_80px_70px_70px_60px] gap-2 px-3 py-2.5 rounded-xl cursor-pointer transition-all border ${
                      isActive
                        ? 'bg-surface-2 border-accent border-opacity-40'
                        : 'border-transparent hover:bg-surface-1 hover:border-border'
                    }`}>
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-base shrink-0">{getCatIcon(m.category)}</span>
                      <div className="min-w-0">
                        <p className="text-sm text-text truncate">{m.description}</p>
                        <p className="text-xs text-muted">{m.category || 'Uncategorized'}</p>
                      </div>
                    </div>
                    <span className={`text-right text-sm font-mono font-semibold ${m.type === 'income' ? 'text-accent' : 'text-loss'}`}>
                      {fmt(m.total)}
                    </span>
                    <span className="text-right text-xs text-muted font-mono">{fmt(m.avg)}</span>
                    <span className="text-right text-xs text-muted">{m.count}×</span>
                    <span className="text-right text-xs text-muted">{isActive ? '▲' : '▼'}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Right: detail panel ── */}
      {selected && (
        <div className="w-72 shrink-0 border-l border-border bg-surface-1 flex flex-col animate-slide-up overflow-hidden">
          <div className="px-4 pt-4 pb-3 border-b border-border shrink-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs text-muted uppercase tracking-widest mb-0.5">Merchant</p>
                <p className="font-semibold text-text text-sm leading-tight">{selected.description}</p>
                <p className="text-xs text-muted mt-0.5">{selected.category || 'Uncategorized'}</p>
              </div>
              <button onClick={() => { setSelected(null); setHistory([]) }}
                className="text-muted hover:text-text text-lg leading-none shrink-0 mt-0.5">✕</button>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-2 gap-2 mt-3">
              {[
                { label: 'Total',   value: fmt(selected.total) },
                { label: 'Avg',     value: fmt(selected.avg) },
                { label: 'Count',   value: `${selected.count}×` },
                { label: 'Max',     value: fmt(selected.max_amount) },
              ].map(s => (
                <div key={s.label} className="bg-surface-2 rounded-xl px-3 py-2">
                  <p className="text-xs text-muted">{s.label}</p>
                  <p className="text-sm font-mono font-semibold text-text">{s.value}</p>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted mt-2">
              {selected.first_date} → {selected.last_date}
            </p>
          </div>

          {/* Transaction history */}
          <div className="flex-1 overflow-y-auto px-3 py-2">
            <p className="text-xs text-muted uppercase tracking-widest mb-2 px-1">Transaction History</p>
            {histLoading ? (
              <div className="space-y-2">{[...Array(4)].map((_,i) => <div key={i} className="h-10 skeleton rounded-lg"/>)}</div>
            ) : (
              <div className="space-y-1">
                {history.map(tx => (
                  <div key={tx.id} className="flex items-center justify-between px-2 py-2 rounded-lg hover:bg-surface-2 transition-all">
                    <div>
                      <p className="text-xs font-mono text-muted">{tx.date}</p>
                      {tx.notes && <p className="text-xs text-muted opacity-60 truncate max-w-[140px]">{tx.notes}</p>}
                    </div>
                    <span className={`text-xs font-mono font-semibold ${tx.type === 'income' ? 'text-accent' : 'text-loss'}`}>
                      {tx.type === 'income' ? '+' : '-'}{fmt(tx.amount)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
