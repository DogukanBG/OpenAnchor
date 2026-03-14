import React, { useState, useEffect, useRef, useMemo } from 'react'
import { useApp } from '../App'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts'

const TIME_RANGES = [
  { label: '7D',  days: 7   },
  { label: '2W',  days: 14  },
  { label: '1M',  days: 30  },
  { label: '3M',  days: 90  },
  { label: '6M',  days: 180 },
  { label: '1Y',  days: 365 },
  { label: '5Y',  days: 1825},
  { label: 'All', days: null}
]
const GROUP_BY = { 7:'day', 14:'day', 30:'day', 90:'week', 180:'month', 365:'month', 1825:'year', null:'month' }

function getDateRange(days) {
  const to = new Date()
  const toStr = to.toISOString().split('T')[0]
  if (!days) return { dateTo: toStr, dateFrom: undefined }
  return { dateFrom: new Date(to - days * 86400000).toISOString().split('T')[0], dateTo: toStr }
}

// ── Health Report prompt ──────────────────────────────────────────────────────
function buildHealthReportPrompt(last30, last12) {
  const fmt = n => Math.abs(n).toFixed(2)

  const monthlyAvgExpenses = last12.expenses / 12
  const spendingRatio = monthlyAvgExpenses > 0
    ? ((last30.expenses - monthlyAvgExpenses) / monthlyAvgExpenses * 100).toFixed(1)
    : 0
  const savingsRate30 = last30.income > 0
    ? Math.round((last30.net / last30.income) * 100) : 0
  const savingsRate12 = last12.income > 0
    ? Math.round((last12.net / last12.income) * 100) : 0

  const top30Expenses = last30.breakdown.filter(b => b.type === 'expense').slice(0, 5)
  const top12Expenses = last12.breakdown.filter(b => b.type === 'expense').slice(0, 5)

  // Find categories that spiked vs 12-month average
  const spikes = top30Expenses.map(b30 => {
    const b12 = last12.breakdown.find(b => b.category === b30.category && b.type === 'expense')
    const avg = b12 ? b12.total / 12 : 0
    const change = avg > 0 ? ((b30.total - avg) / avg * 100) : null
    return { ...b30, avg, change }
  }).filter(b => b.change !== null && b.change > 20)

  return `You are a personal finance analyst. Write a SHORT financial health report (max 5 sentences, no headers, no bullet points, plain prose). Be direct and specific — use the actual numbers.

DATA:
Last 30 days: Income €${fmt(last30.income)}, Expenses €${fmt(last30.expenses)}, Net €${fmt(last30.net)}, Savings rate ${savingsRate30}%
12-month avg monthly: Income €${fmt(last12.income/12)}, Expenses €${fmt(last12.expenses/12)}, Savings rate ${savingsRate12}%
This month vs monthly average: ${spendingRatio > 0 ? '+' : ''}${spendingRatio}% spending change

Top spending last 30 days:
${top30Expenses.map(b => `- ${b.category || 'Uncategorized'}: €${fmt(b.total)}`).join('\n') || 'No data'}

Unusual spending spikes (vs 12-month monthly average):
${spikes.length > 0 ? spikes.map(b => `- ${b.category}: €${fmt(b.total)} this month vs avg €${fmt(b.avg)} (+${b.change.toFixed(0)}%)`).join('\n') : 'None detected'}

Write the report now. Highlight: 1) overall financial health, 2) any unusual or problematic spending, 3) one positive or negative trend. Keep it under 5 sentences.`
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const { currency, categories, settings, ollamaOk, setPage } = useApp()
  const [selectedRange, setSelectedRange]   = useState(2)
  const [selectedCategory, setSelectedCategory] = useState(null)
  const [summary, setSummary]     = useState({ income: 0, expenses: 0, net: 0, count: 0 })
  const [timeSeries, setTimeSeries] = useState({ income: [], expenses: [] })
  const [breakdown, setBreakdown]  = useState([])
  const [loading, setLoading]      = useState(true)
  const [accountBalance, setAccountBalance] = useState(null)

  // Health report state
  const [report, setReport]           = useState('')
  const [reportLoading, setReportLoading] = useState(false)
  const [reportError, setReportError]  = useState('')
  const reportGenerated = useRef(false)

  const range    = TIME_RANGES[selectedRange]
  const dateRange = getDateRange(range.days)
  const groupBy  = GROUP_BY[range.days]

  useEffect(() => { loadData(); loadBalance() }, [selectedRange, selectedCategory])

  // Auto-generate report once on first load (silently, if model available)
  useEffect(() => {
    if (!reportGenerated.current && ollamaOk && settings.assistant_model && !loading) {
      reportGenerated.current = true
      generateHealthReport()
    }
  }, [loading, ollamaOk, settings.assistant_model])

  async function loadBalance() {
    const bal = await window.api.balance.get()
    if (bal?.amount) setAccountBalance(bal)
  }

  async function loadData() {
    setLoading(true)
    const filters = { ...dateRange, category: selectedCategory || undefined }
    const [sum, ts, bd] = await Promise.all([
      window.api.stats.getSummary(filters),
      window.api.stats.getTimeSeries({ ...filters, groupBy }),
      window.api.stats.getCategoryBreakdown(filters)
    ])
    setSummary(sum); setTimeSeries(ts); setBreakdown(bd)
    setLoading(false)
  }

  async function generateHealthReport() {
    const model = settings.assistant_model || settings.extraction_model || ''
    if (!model || !ollamaOk) {
      setReportError('No AI model available. Select a model in Settings.')
      return
    }
    setReportLoading(true)
    setReport('')
    setReportError('')
    try {
      const now = new Date()
      const to  = now.toISOString().split('T')[0]
      const from30 = new Date(now - 30  * 86400000).toISOString().split('T')[0]
      const from12 = new Date(now - 365 * 86400000).toISOString().split('T')[0]

      const [sum30, bd30, sum12, bd12] = await Promise.all([
        window.api.stats.getSummary({ dateFrom: from30, dateTo: to }),
        window.api.stats.getCategoryBreakdown({ dateFrom: from30, dateTo: to }),
        window.api.stats.getSummary({ dateFrom: from12, dateTo: to }),
        window.api.stats.getCategoryBreakdown({ dateFrom: from12, dateTo: to })
      ])

      const prompt = buildHealthReportPrompt(
        { ...sum30, breakdown: bd30 },
        { ...sum12, breakdown: bd12 }
      )

      const response = await window.api.ollama.generate({ model, prompt })
      setReport(response.trim())
    } catch (e) {
      setReportError(`Could not generate report: ${e.message}`)
    } finally {
      setReportLoading(false)
    }
  }

  // Chart data
  const chartData = useMemo(() => {
    const map = {}
    for (const row of timeSeries.income) {
      map[row.period] = { period: row.period, income: row.total, expenses: 0 }
    }
    for (const row of timeSeries.expenses) {
      if (!map[row.period]) map[row.period] = { period: row.period, income: 0, expenses: 0 }
      map[row.period].expenses = row.total
    }
    return Object.values(map).sort((a, b) => a.period.localeCompare(b.period))
  }, [timeSeries])

  const expenseBreakdown = breakdown.filter(b => b.type === 'expense').slice(0, 8)
  const fmt = n => `${currency}${Math.abs(n).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  const getCategoryColor = name => categories.find(c => c.name === name)?.color || '#64748b'

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null
    return (
      <div className="bg-surface-2 border border-border rounded-lg p-3 shadow-xl text-sm">
        <p className="text-muted mb-2 font-mono text-xs">{label}</p>
        {payload.map(p => (
          <p key={p.name} style={{ color: p.color }} className="font-medium">
            {p.name === 'income' ? '↑' : '↓'} {fmt(p.value)}
          </p>
        ))}
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto p-6 space-y-5 animate-fade-in">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-text-bright">Overview</h1>
          <p className="text-muted text-sm mt-0.5">
            {selectedCategory ? `Filtered: ${selectedCategory}` : 'All categories'}
          </p>
        </div>
        <div className="flex items-center gap-1 bg-surface-1 p-1 rounded-xl border border-border">
          {TIME_RANGES.map((r, i) => (
            <button key={r.label} onClick={() => setSelectedRange(i)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
                i === selectedRange ? 'bg-accent text-surface font-semibold' : 'text-muted hover:text-text'
              }`}>
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Account Balance Banner ── */}
      {accountBalance?.amount && (
        <div className="flex items-center justify-between bg-surface-1 border border-accent border-opacity-20 rounded-2xl px-5 py-3">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🏦</span>
            <div>
              <p className="text-xs text-muted uppercase tracking-widest">Account Balance</p>
              <p className="text-xl font-display font-bold text-accent">
                {currency}{parseFloat(accountBalance.amount).toLocaleString('de-DE', { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>
          <p className="text-xs text-muted">as of {accountBalance.date}</p>
        </div>
      )}

      {/* ── Summary Cards ── */}
      <div className="grid grid-cols-4 gap-4">
        <SummaryCard label="Total Income"   value={fmt(summary.income)}   sub={`${summary.count} transactions`} positive loading={loading}/>
        <SummaryCard label="Total Expenses" value={fmt(summary.expenses)} positive={false} loading={loading}/>
        <SummaryCard label="Net Balance"    value={fmt(summary.net)}      positive={summary.net >= 0} highlight loading={loading}/>
        <SummaryCard
          label="Savings Rate"
          value={summary.income > 0 ? `${Math.round((summary.net / summary.income) * 100)}%` : '—'}
          positive={summary.net >= 0} loading={loading}
        />
      </div>

      {/* ── Financial Health Report ── */}
      <div className="bg-surface-1 border border-border rounded-2xl p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-base">📋</span>
            <h2 className="font-semibold text-text">Financial Health Report</h2>
            <span className="text-xs text-muted bg-surface-2 px-2 py-0.5 rounded-full">Last 30 days · vs 12-month baseline</span>
          </div>
          <button
            onClick={generateHealthReport}
            disabled={reportLoading || !ollamaOk || (!settings.assistant_model && !settings.extraction_model)}
            className="flex items-center gap-1.5 text-xs text-muted hover:text-text border border-border px-3 py-1.5 rounded-xl transition-all disabled:opacity-40"
          >
            {reportLoading
              ? <><span className="w-3 h-3 border border-muted border-t-transparent rounded-full animate-spin"/>Generating...</>
              : <><RefreshIcon/>Regenerate</>
            }
          </button>
        </div>

        {reportLoading && !report && (
          <div className="space-y-2">
            <div className="h-4 skeleton rounded w-full"/>
            <div className="h-4 skeleton rounded w-5/6"/>
            <div className="h-4 skeleton rounded w-4/6"/>
          </div>
        )}

        {reportError && !reportLoading && (
          <div className="text-sm text-muted flex items-center gap-2">
            <span>⚠️</span>
            <span>{reportError}</span>
            {(!ollamaOk || !settings.assistant_model) && (
              <button onClick={() => setPage('settings')} className="text-accent underline ml-1">
                Open Settings
              </button>
            )}
          </div>
        )}

        {report && !reportLoading && (
          <p className="text-sm text-text leading-relaxed">{report}</p>
        )}

        {!report && !reportLoading && !reportError && (
          <p className="text-sm text-muted">
            {ollamaOk && (settings.assistant_model || settings.extraction_model)
              ? 'Click Regenerate to generate your financial health report.'
              : 'Requires Ollama running with a model selected in Settings.'}
          </p>
        )}
      </div>

      {/* ── Main Chart + Category Filter ── */}
      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2 bg-surface-1 rounded-2xl border border-border p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-text">Cash Flow</h2>
            <div className="flex gap-4 text-xs text-muted">
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-accent inline-block"/>Income</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-loss inline-block"/>Expenses</span>
            </div>
          </div>
          {loading ? <div className="h-48 skeleton rounded-lg"/> : chartData.length === 0 ? <EmptyState label="No data for this period"/> : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="gIncome" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="var(--accent)" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="gExpense" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--loss)" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="var(--loss)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false}/>
                <XAxis dataKey="period" tick={{ fill: 'var(--text-muted)', fontSize: 11, fontFamily: 'IBM Plex Mono' }} axisLine={false} tickLine={false}/>
                <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11, fontFamily: 'IBM Plex Mono' }} axisLine={false} tickLine={false} tickFormatter={v => `${currency}${(v/1000).toFixed(0)}k`}/>
                <Tooltip content={<CustomTooltip/>}/>
                <Area type="monotone" dataKey="income"   stroke="var(--accent)" strokeWidth={2} fill="url(#gIncome)"/>
                <Area type="monotone" dataKey="expenses" stroke="var(--loss)"   strokeWidth={2} fill="url(#gExpense)"/>
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Category filter */}
        <div className="bg-surface-1 rounded-2xl border border-border p-5 overflow-hidden flex flex-col">
          <h2 className="font-semibold text-text mb-3 shrink-0">Categories</h2>
          <div className="overflow-y-auto space-y-1 flex-1">
            <button onClick={() => setSelectedCategory(null)}
              className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm transition-all ${!selectedCategory ? 'bg-surface-3 text-text' : 'text-muted hover:text-text hover:bg-surface-2'}`}>
              <span className="w-5 text-center">🗂️</span>
              <span className="flex-1 text-left">All</span>
            </button>
            {breakdown.map(b => (
              <button key={b.category + b.type}
                onClick={() => setSelectedCategory(selectedCategory === b.category ? null : b.category)}
                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm transition-all ${selectedCategory === b.category ? 'bg-surface-3 text-text' : 'text-muted hover:text-text hover:bg-surface-2'}`}>
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: getCategoryColor(b.category) }}/>
                <span className="flex-1 text-left truncate">{b.category || 'Uncategorized'}</span>
                <span className="text-xs font-mono">{fmt(b.total)}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Expense Breakdown ── */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-surface-1 rounded-2xl border border-border p-5">
          <h2 className="font-semibold text-text mb-4">Spending by Category</h2>
          {loading ? <div className="h-40 skeleton rounded-lg"/> : expenseBreakdown.length === 0 ? <EmptyState label="No expense data"/> : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={expenseBreakdown} layout="vertical" margin={{ left: 0, right: 20, top: 0, bottom: 0 }}>
                <XAxis type="number" hide/>
                <YAxis type="category" dataKey="category" width={130} tick={{ fill: 'var(--text-dim)', fontSize: 11 }} axisLine={false} tickLine={false}/>
                <Tooltip formatter={v => fmt(v)} contentStyle={{ background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: 8 }}/>
                <Bar dataKey="total" radius={[0, 4, 4, 0]}>
                  {expenseBreakdown.map(entry => <Cell key={entry.category} fill={getCategoryColor(entry.category)} fillOpacity={0.85}/>)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="bg-surface-1 rounded-2xl border border-border p-5">
          <h2 className="font-semibold text-text mb-4">Distribution</h2>
          {loading ? <div className="h-40 skeleton rounded-full mx-auto w-40"/> : expenseBreakdown.length === 0 ? <EmptyState label="No data to display"/> : (
            <div className="flex items-center gap-4">
              <ResponsiveContainer width="50%" height={200}>
                <PieChart>
                  <Pie data={expenseBreakdown} cx="50%" cy="50%" innerRadius={55} outerRadius={80} dataKey="total" paddingAngle={3}>
                    {expenseBreakdown.map(entry => <Cell key={entry.category} fill={getCategoryColor(entry.category)}/>)}
                  </Pie>
                  <Tooltip formatter={v => fmt(v)} contentStyle={{ background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: 8 }}/>
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1.5 flex-1">
                {expenseBreakdown.slice(0, 6).map(b => (
                  <div key={b.category} className="flex items-center gap-2 text-xs">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: getCategoryColor(b.category) }}/>
                    <span className="text-muted truncate flex-1">{b.category || '—'}</span>
                    <span className="text-text font-mono">{fmt(b.total)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function SummaryCard({ label, value, sub, positive, highlight, loading }) {
  return (
    <div className={`rounded-2xl border p-5 ${highlight
      ? positive ? 'bg-accent-dim border-accent border-opacity-50 glow-green' : 'bg-loss-dim border-loss border-opacity-50 glow-red'
      : 'bg-surface-1 border-border'}`}>
      <p className="text-xs text-muted uppercase tracking-widest mb-1">{label}</p>
      {loading ? <div className="h-8 w-32 skeleton rounded mt-1"/> : (
        <p className={`text-2xl font-display font-bold ${positive ? 'text-accent' : 'text-loss'}`}>{value}</p>
      )}
      {sub && <p className="text-xs text-muted mt-1">{sub}</p>}
    </div>
  )
}

function EmptyState({ label }) {
  return <div className="h-48 flex items-center justify-center text-muted text-sm">{label}</div>
}

function RefreshIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
      <path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>
      <path d="M8 16H3v5"/>
    </svg>
  )
}
