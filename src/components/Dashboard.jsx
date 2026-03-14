import React, { useState, useEffect, useMemo } from 'react'
import { useApp } from '../App'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts'

const TIME_RANGES = [
  { label: '7D', days: 7 },
  { label: '2W', days: 14 },
  { label: '1M', days: 30 },
  { label: '3M', days: 90 },
  { label: '6M', days: 180 },
  { label: '1Y', days: 365 },
  { label: '5Y', days: 1825 },
  { label: 'All', days: null }
]

const GROUP_BY_FOR_RANGE = { 7: 'day', 14: 'day', 30: 'day', 90: 'week', 180: 'month', 365: 'month', 1825: 'year', null: 'month' }

function getDateRange(days) {
  const to = new Date()
  const toStr = to.toISOString().split('T')[0]
  if (!days) return { dateTo: toStr, dateFrom: undefined }
  const from = new Date(to - days * 86400000)
  return { dateFrom: from.toISOString().split('T')[0], dateTo: toStr }
}

export default function Dashboard() {
  const { currency, categories, setPage } = useApp()
  const [selectedRange, setSelectedRange] = useState(2) // 1M default
  const [selectedCategory, setSelectedCategory] = useState(null)
  const [summary, setSummary] = useState({ income: 0, expenses: 0, net: 0, count: 0 })
  const [timeSeries, setTimeSeries] = useState({ income: [], expenses: [] })
  const [breakdown, setBreakdown] = useState([])
  const [loading, setLoading] = useState(true)

  const range = TIME_RANGES[selectedRange]
  const dateRange = getDateRange(range.days)
  const groupBy = GROUP_BY_FOR_RANGE[range.days]

  useEffect(() => {
    loadData()
  }, [selectedRange, selectedCategory])

  async function loadData() {
    setLoading(true)
    const filters = { ...dateRange, category: selectedCategory || undefined }
    const [sum, ts, bd] = await Promise.all([
      window.api.stats.getSummary(filters),
      window.api.stats.getTimeSeries({ ...filters, groupBy }),
      window.api.stats.getCategoryBreakdown(filters)
    ])
    setSummary(sum)
    setTimeSeries(ts)
    setBreakdown(bd)
    setLoading(false)
  }

  // Merge income/expense time series for chart
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
  const incomeBreakdown = breakdown.filter(b => b.type === 'income').slice(0, 5)

  const fmt = (n) => `${currency}${Math.abs(n).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  function getCategoryColor(name) {
    return categories.find(c => c.name === name)?.color || '#64748b'
  }

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
    <div className="h-full overflow-y-auto p-6 space-y-6 animate-fade-in">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-text-bright">Overview</h1>
          <p className="text-muted text-sm mt-0.5">
            {selectedCategory ? `Filtered: ${selectedCategory}` : 'All categories'}
          </p>
        </div>

        {/* Time range selector */}
        <div className="flex items-center gap-1 bg-surface-1 p-1 rounded-xl border border-border">
          {TIME_RANGES.map((r, i) => (
            <button
              key={r.label}
              onClick={() => setSelectedRange(i)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
                i === selectedRange
                  ? 'bg-accent text-surface font-semibold'
                  : 'text-muted hover:text-text'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Summary Cards ── */}
      <div className="grid grid-cols-4 gap-4">
        <SummaryCard
          label="Total Income"
          value={fmt(summary.income)}
          sub={`${summary.count} transactions`}
          positive
          loading={loading}
        />
        <SummaryCard
          label="Total Expenses"
          value={fmt(summary.expenses)}
          positive={false}
          loading={loading}
        />
        <SummaryCard
          label="Net Balance"
          value={fmt(summary.net)}
          positive={summary.net >= 0}
          highlight
          loading={loading}
        />
        <SummaryCard
          label="Savings Rate"
          value={summary.income > 0 ? `${Math.round((summary.net / summary.income) * 100)}%` : '—'}
          positive={summary.net >= 0}
          loading={loading}
        />
      </div>

      {/* ── Main Chart + Category Filter ── */}
      <div className="grid grid-cols-3 gap-4">

        {/* Income/Expense Chart */}
        <div className="col-span-2 bg-surface-1 rounded-2xl border border-border p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-text">Cash Flow</h2>
            <div className="flex gap-4 text-xs text-muted">
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-accent inline-block"/>Income</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-loss inline-block"/>Expenses</span>
            </div>
          </div>
          {loading ? (
            <div className="h-48 skeleton rounded-lg"/>
          ) : chartData.length === 0 ? (
            <EmptyState label="No data for this period" />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="gIncome" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3dd68c" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#3dd68c" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="gExpense" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f97066" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#f97066" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a3140" vertical={false}/>
                <XAxis dataKey="period" tick={{ fill: '#5c6b7a', fontSize: 11, fontFamily: 'IBM Plex Mono' }} axisLine={false} tickLine={false}/>
                <YAxis tick={{ fill: '#5c6b7a', fontSize: 11, fontFamily: 'IBM Plex Mono' }} axisLine={false} tickLine={false} tickFormatter={v => `${currency}${(v/1000).toFixed(0)}k`}/>
                <Tooltip content={<CustomTooltip />}/>
                <Area type="monotone" dataKey="income" stroke="#3dd68c" strokeWidth={2} fill="url(#gIncome)"/>
                <Area type="monotone" dataKey="expenses" stroke="#f97066" strokeWidth={2} fill="url(#gExpense)"/>
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Category filter list */}
        <div className="bg-surface-1 rounded-2xl border border-border p-5 overflow-hidden flex flex-col">
          <h2 className="font-semibold text-text mb-3 shrink-0">Categories</h2>
          <div className="overflow-y-auto space-y-1 flex-1">
            <button
              onClick={() => setSelectedCategory(null)}
              className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm transition-all ${
                !selectedCategory ? 'bg-surface-3 text-text' : 'text-muted hover:text-text hover:bg-surface-2'
              }`}
            >
              <span className="w-5 text-center">🗂️</span>
              <span className="flex-1 text-left">All</span>
            </button>
            {breakdown.map(b => (
              <button
                key={b.category + b.type}
                onClick={() => setSelectedCategory(selectedCategory === b.category ? null : b.category)}
                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm transition-all ${
                  selectedCategory === b.category ? 'bg-surface-3 text-text' : 'text-muted hover:text-text hover:bg-surface-2'
                }`}
              >
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

        {/* Bar chart by category */}
        <div className="bg-surface-1 rounded-2xl border border-border p-5">
          <h2 className="font-semibold text-text mb-4">Spending by Category</h2>
          {loading ? (
            <div className="h-40 skeleton rounded-lg"/>
          ) : expenseBreakdown.length === 0 ? (
            <EmptyState label="No expense data" />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={expenseBreakdown} layout="vertical" margin={{ left: 0, right: 20, top: 0, bottom: 0 }}>
                <XAxis type="number" hide tickFormatter={v => `${currency}${v}`}/>
                <YAxis type="category" dataKey="category" width={130} tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false}/>
                <Tooltip formatter={(v) => fmt(v)} contentStyle={{ background: '#161b22', border: '1px solid #2a3140', borderRadius: 8 }}/>
                <Bar dataKey="total" radius={[0, 4, 4, 0]}>
                  {expenseBreakdown.map((entry) => (
                    <Cell key={entry.category} fill={getCategoryColor(entry.category)} fillOpacity={0.85}/>
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Pie donut */}
        <div className="bg-surface-1 rounded-2xl border border-border p-5">
          <h2 className="font-semibold text-text mb-4">Distribution</h2>
          {loading ? (
            <div className="h-40 skeleton rounded-full mx-auto w-40"/>
          ) : expenseBreakdown.length === 0 ? (
            <EmptyState label="No data to display" />
          ) : (
            <div className="flex items-center gap-4">
              <ResponsiveContainer width="50%" height={200}>
                <PieChart>
                  <Pie data={expenseBreakdown} cx="50%" cy="50%" innerRadius={55} outerRadius={80}
                    dataKey="total" paddingAngle={3}>
                    {expenseBreakdown.map(entry => (
                      <Cell key={entry.category} fill={getCategoryColor(entry.category)}/>
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => fmt(v)} contentStyle={{ background: '#161b22', border: '1px solid #2a3140', borderRadius: 8 }}/>
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
    <div className={`rounded-2xl border p-5 ${
      highlight
        ? positive
          ? 'bg-accent-dim border-accent border-opacity-50 glow-green'
          : 'bg-loss-dim border-loss border-opacity-50 glow-red'
        : 'bg-surface-1 border-border'
    }`}>
      <p className="text-xs text-muted uppercase tracking-widest mb-1">{label}</p>
      {loading ? (
        <div className="h-8 w-32 skeleton rounded mt-1"/>
      ) : (
        <p className={`text-2xl font-display font-bold ${positive ? 'text-accent' : 'text-loss'}`}>
          {value}
        </p>
      )}
      {sub && <p className="text-xs text-muted mt-1">{sub}</p>}
    </div>
  )
}

function EmptyState({ label }) {
  return (
    <div className="h-48 flex items-center justify-center text-muted text-sm">{label}</div>
  )
}
