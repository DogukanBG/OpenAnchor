import React, { useState, useEffect, useCallback } from 'react'
import { useApp } from '../App'
import Merchants from './Merchants'

const TIME_RANGES = [
  { label: '7D',  days: 7    },
  { label: '2W',  days: 14   },
  { label: '1M',  days: 30   },
  { label: '3M',  days: 90   },
  { label: '6M',  days: 180  },
  { label: '1Y',  days: 365  },
  { label: '5Y',  days: 1825 },
  { label: 'All', days: null }
]

function getDateRange(days) {
  const to = new Date().toISOString().split('T')[0]
  if (!days) return { dateTo: to, dateFrom: undefined }
  return { dateFrom: new Date(Date.now() - days * 86400000).toISOString().split('T')[0], dateTo: to }
}

export default function Transactions() {
  const { categories, currency } = useApp()

  const [tab,               setTab]               = useState('transactions')
  const [transactions,      setTransactions]       = useState([])
  const [loading,           setLoading]            = useState(true)
  const [search,            setSearch]             = useState('')
  const [rangeIdx,          setRangeIdx]           = useState(2)
  const [filterType,        setFilterType]         = useState('all')
  const [filterCategory,    setFilterCategory]     = useState('')
  const [showUncategorized, setShowUncategorized]  = useState(false)
  const [selectedIds,       setSelectedIds]        = useState(new Set())
  const [bulkCategory,      setBulkCategory]       = useState('')
  const [showModal,         setShowModal]          = useState(false)
  const [editTx,            setEditTx]             = useState(null)
  const [sortKey,           setSortKey]            = useState('date')
  const [sortDir,           setSortDir]            = useState('desc')

  const range     = TIME_RANGES[rangeIdx]
  const dateRange = getDateRange(range.days)

  const loadTxs = useCallback(async () => {
    setLoading(true)
    const filters = {
      ...dateRange,
      search:         search || undefined,
      type:           filterType !== 'all' ? filterType : undefined,
      category:       filterCategory || undefined,
      uncategorized:  showUncategorized || undefined
    }
    const txs = await window.api.transactions.getAll(filters)
    setTransactions(txs)
    setSelectedIds(new Set())
    setLoading(false)
  }, [rangeIdx, search, filterType, filterCategory, showUncategorized])

  useEffect(() => { loadTxs() }, [loadTxs])

  // ── Handlers ────────────────────────────────────────────────────────────────
  async function handleDelete(id) {
    if (!confirm('Delete this transaction?')) return
    await window.api.transactions.delete(id)
    loadTxs()
  }

  async function handleBulkDelete() {
    if (selectedIds.size === 0) return
    if (!confirm(`Delete ${selectedIds.size} selected transaction${selectedIds.size > 1 ? 's' : ''}?`)) return
    await window.api.transactions.bulkDelete([...selectedIds])
    setSelectedIds(new Set())
    loadTxs()
  }

  async function handleBulkCategorize() {
    if (selectedIds.size === 0 || !bulkCategory) return
    await window.api.transactions.bulkCategorize([...selectedIds], bulkCategory)
    setBulkCategory('')
    loadTxs()
  }

  function toggleSelectId(id) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    if (selectedIds.size === sorted.length && sorted.length > 0) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(sorted.map(t => t.id)))
    }
  }

  function handleEdit(tx) { setEditTx(tx);  setShowModal(true) }
  function handleAdd()     { setEditTx(null); setShowModal(true) }

  async function handleSave(data) {
    if (editTx) await window.api.transactions.update(editTx.id, data)
    else        await window.api.transactions.add(data)
    setShowModal(false)
    setEditTx(null)
    loadTxs()
  }

  function toggleSort(key) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('desc') }
  }

  function toggleUncategorized() {
    setShowUncategorized(v => !v)
    setFilterCategory('')
  }

  const sorted = [...transactions].sort((a, b) => {
    const av = a[sortKey], bv = b[sortKey]
    const cmp = av < bv ? -1 : av > bv ? 1 : 0
    return sortDir === 'asc' ? cmp : -cmp
  })

  const fmt           = n => `${n >= 0 ? '' : '-'}${currency}${Math.abs(n).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  const totalIncome   = transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const totalExpenses = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + Math.abs(t.amount), 0)

  return (
    <div className="h-full flex flex-col animate-fade-in">

      {/* ── Top bar ── */}
      <div className="px-6 pt-6 pb-4 border-b border-border shrink-0">

        {/* Tab bar + Add button */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1 bg-surface-2 border border-border p-1 rounded-xl">
            {[['transactions', '💳 Transactions'], ['merchants', '🏪 Merchants']].map(([id, label]) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  tab === id ? 'bg-accent text-surface' : 'text-muted hover:text-text'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {tab === 'transactions' && (
            <button
              onClick={handleAdd}
              className="flex items-center gap-2 px-4 py-2 bg-accent text-surface rounded-xl font-medium text-sm hover:bg-opacity-90 transition-all"
            >
              <span className="text-lg leading-none">+</span> Add Transaction
            </button>
          )}
        </div>

        {/* Filters — transactions tab only */}
        {tab === 'transactions' && (
          <>
            {/* Filter row */}
            <div className="flex items-center gap-2 flex-wrap">

              {/* Search */}
              <div className="relative flex-1 min-w-[180px] max-w-xs">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted text-sm">🔍</span>
                <input
                  className="w-full bg-surface-2 border border-border rounded-xl pl-9 pr-3 py-2 text-sm text-text placeholder-muted"
                  placeholder="Search..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>

              {/* Type */}
              <div className="flex bg-surface-1 border border-border rounded-xl overflow-hidden">
                {['all', 'income', 'expense'].map(t => (
                  <button
                    key={t}
                    onClick={() => setFilterType(t)}
                    className={`px-3 py-2 text-xs font-medium capitalize transition-all ${filterType === t ? 'bg-surface-3 text-text' : 'text-muted hover:text-text'}`}
                  >
                    {t}
                  </button>
                ))}
              </div>

              {/* Category dropdown */}
              <select
                value={filterCategory}
                onChange={e => { setFilterCategory(e.target.value); if (e.target.value) setShowUncategorized(false) }}
                disabled={showUncategorized}
                className="bg-surface-1 border border-border rounded-xl px-3 py-2 text-sm text-text appearance-none cursor-pointer disabled:opacity-40"
              >
                <option value="">All categories</option>
                {categories.map(c => (
                  <option key={c.id} value={c.name}>{c.icon} {c.name}</option>
                ))}
              </select>

              {/* Uncategorized toggle */}
              <button
                onClick={toggleUncategorized}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border transition-all ${
                  showUncategorized
                    ? 'bg-warn-dim border-warn border-opacity-60 text-warn'
                    : 'bg-surface-1 border-border text-muted hover:text-text'
                }`}
              >
                ❓ Uncategorized
              </button>

              {/* Time range */}
              <div className="flex items-center gap-1 bg-surface-1 p-1 rounded-xl border border-border">
                {TIME_RANGES.map((r, i) => (
                  <button
                    key={r.label}
                    onClick={() => setRangeIdx(i)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${i === rangeIdx ? 'bg-accent text-surface' : 'text-muted hover:text-text'}`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Summary row */}
            <div className="flex items-center gap-6 mt-2.5 text-sm">
              <span className="text-muted">
                {showUncategorized ? `${transactions.length} uncategorized` : `${transactions.length} transactions`}
              </span>
              <span className="text-accent font-mono">+{fmt(totalIncome)}</span>
              <span className="text-loss font-mono">-{fmt(totalExpenses)}</span>
              <span className={`font-mono font-semibold ${totalIncome - totalExpenses >= 0 ? 'text-accent' : 'text-loss'}`}>
                Net: {fmt(totalIncome - totalExpenses)}
              </span>
            </div>

            {/* Bulk action bar — only when rows are selected */}
            {selectedIds.size > 0 && (
              <div className="flex items-center gap-2 mt-2 px-3 py-2 bg-surface-2 border border-border rounded-xl animate-fade-in">
                <span className="text-xs font-medium text-text shrink-0">
                  {selectedIds.size} selected
                </span>

                <div className="w-px h-4 bg-border mx-1 shrink-0"/>

                {/* Move to category */}
                <span className="text-xs text-muted shrink-0">Move to:</span>
                <select
                  value={bulkCategory}
                  onChange={e => setBulkCategory(e.target.value)}
                  className="bg-surface-1 border border-border rounded-lg px-2 py-1 text-xs text-text appearance-none cursor-pointer flex-1 max-w-[180px]"
                >
                  <option value="">— category —</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.name}>{c.icon} {c.name}</option>
                  ))}
                </select>
                <button
                  onClick={handleBulkCategorize}
                  disabled={!bulkCategory}
                  className="px-3 py-1 bg-accent text-surface text-xs rounded-lg font-medium hover:bg-opacity-90 transition-all disabled:opacity-40"
                >
                  ✓ Apply
                </button>

                <div className="w-px h-4 bg-border mx-1 shrink-0"/>

                {/* Delete */}
                <button
                  onClick={handleBulkDelete}
                  className="flex items-center gap-1 px-3 py-1 bg-loss-dim border border-loss border-opacity-40 text-loss text-xs rounded-lg hover:bg-opacity-80 transition-all"
                >
                  🗑️ Delete
                </button>

                {/* Clear selection */}
                <button
                  onClick={() => setSelectedIds(new Set())}
                  className="ml-auto text-muted hover:text-text text-xs px-2 py-1 rounded-lg hover:bg-surface-3 transition-all"
                >
                  ✕
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Merchants tab ── */}
      {tab === 'merchants' && (
        <div className="flex-1 overflow-hidden">
          <Merchants />
        </div>
      )}

      {/* ── Transactions table ── */}
      {tab === 'transactions' && (
        <div className="flex-1 overflow-auto px-6 py-4">
          {loading ? (
            <div className="space-y-2">
              {[...Array(8)].map((_, i) => <div key={i} className="h-12 skeleton rounded-xl" />)}
            </div>
          ) : sorted.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-muted">
              <span className="text-4xl mb-3">{showUncategorized ? '✅' : '📭'}</span>
              <p>{showUncategorized ? 'All transactions are categorized!' : 'No transactions found'}</p>
              <p className="text-xs mt-1">
                {showUncategorized ? 'Great job keeping things organized.' : 'Try adjusting filters or add a transaction'}
              </p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-surface z-10">
                <tr className="text-left">
                  <th className="pb-3 pr-4 w-8">
                    <input
                      type="checkbox"
                      checked={sorted.length > 0 && selectedIds.size === sorted.length}
                      onChange={toggleSelectAll}
                      className="accent-accent w-3.5 h-3.5 cursor-pointer"
                    />
                  </th>
                  {[
                    { key: 'date',        label: 'Date'        },
                    { key: 'description', label: 'Description' },
                    { key: 'category',    label: 'Category'    },
                    { key: 'amount',      label: 'Amount'      },
                    { key: null,          label: ''            }
                  ].map(col => (
                    <th
                      key={col.key || 'actions'}
                      onClick={() => col.key && toggleSort(col.key)}
                      className={`pb-3 pr-4 text-xs uppercase tracking-widest font-medium text-muted ${col.key ? 'cursor-pointer hover:text-text select-none' : ''}`}
                    >
                      {col.label} {sortKey === col.key && (sortDir === 'asc' ? '↑' : '↓')}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {sorted.map(tx => (
                  <TxRow
                    key={tx.id}
                    tx={tx}
                    categories={categories}
                    currency={currency}
                    selected={selectedIds.has(tx.id)}
                    onSelect={() => toggleSelectId(tx.id)}
                    onEdit={() => handleEdit(tx)}
                    onDelete={() => handleDelete(tx.id)}
                  />
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── Modal ── */}
      {showModal && (
        <TxModal
          tx={editTx}
          categories={categories}
          onSave={handleSave}
          onClose={() => { setShowModal(false); setEditTx(null) }}
        />
      )}
    </div>
  )
}

// ── TxRow ─────────────────────────────────────────────────────────────────────
function TxRow({ tx, categories, currency, selected, onSelect, onEdit, onDelete }) {
  const cat = categories.find(c => c.name === tx.category)
  const fmt = n => `${Math.abs(n).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  return (
    <tr className={`group transition-colors ${selected ? 'bg-surface-2' : 'hover:bg-surface-1'}`}>
      <td className="py-3 pr-4 w-8">
        <input
          type="checkbox"
          checked={selected}
          onChange={onSelect}
          className="accent-accent w-3.5 h-3.5 cursor-pointer"
        />
      </td>
      <td className="py-3 pr-4 font-mono text-xs text-muted whitespace-nowrap">{tx.date}</td>
      <td className="py-3 pr-4 text-text max-w-[280px]">
        <div className="truncate">{tx.description}</div>
        {tx.notes && <div className="text-xs text-muted truncate mt-0.5">{tx.notes}</div>}
      </td>
      <td className="py-3 pr-4">
        {tx.category ? (
          <span className="flex items-center gap-1.5 text-xs">
            <span className="text-base leading-none">{cat?.icon || '📋'}</span>
            <span className="text-muted">{tx.category}</span>
          </span>
        ) : (
          <span className="text-xs text-warn opacity-70 italic">uncategorized</span>
        )}
      </td>
      <td className="py-3 pr-4">
        <span className={`font-mono font-semibold ${tx.type === 'income' ? 'text-accent' : 'text-loss'}`}>
          {tx.type === 'income' ? '+' : '-'}{currency}{fmt(tx.amount)}
        </span>
      </td>
      <td className="py-3">
        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={onEdit}   className="text-muted hover:text-text text-xs px-2 py-1 rounded-lg hover:bg-surface-3 transition-all">Edit</button>
          <button onClick={onDelete} className="text-muted hover:text-loss text-xs px-2 py-1 rounded-lg hover:bg-loss-dim  transition-all">Delete</button>
        </div>
      </td>
    </tr>
  )
}

// ── TxModal ───────────────────────────────────────────────────────────────────
function TxModal({ tx, categories, onSave, onClose }) {
  const today = new Date().toISOString().split('T')[0]
  const [form, setForm] = useState({
    date:        tx?.date        || today,
    description: tx?.description || '',
    amount:      tx ? Math.abs(tx.amount) : '',
    type:        tx?.type        || 'expense',
    category:    tx?.category    || '',
    notes:       tx?.notes       || ''
  })
  const [saving, setSaving] = useState(false)

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  async function submit() {
    if (!form.date || !form.description || !form.amount) return
    setSaving(true)
    const amount = parseFloat(form.amount) * (form.type === 'expense' ? -1 : 1)
    await onSave({ ...form, amount })
  }

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-surface-1 border border-border rounded-2xl w-full max-w-md p-6 shadow-2xl animate-slide-up">
        <h2 className="font-display text-xl font-bold text-text-bright mb-5">
          {tx ? 'Edit' : 'Add'} Transaction
        </h2>
        <div className="space-y-4">

          {/* Type toggle */}
          <div className="flex bg-surface-2 rounded-xl p-1 gap-1">
            {['income', 'expense'].map(t => (
              <button
                key={t}
                onClick={() => set('type', t)}
                className={`flex-1 py-2 rounded-lg text-sm font-medium capitalize transition-all ${
                  form.type === t
                    ? t === 'income' ? 'bg-accent text-surface' : 'bg-loss text-white'
                    : 'text-muted hover:text-text'
                }`}
              >
                {t === 'income' ? '↑ Income' : '↓ Expense'}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted block mb-1">Date</label>
              <input type="date" value={form.date} onChange={e => set('date', e.target.value)}
                className="w-full bg-surface-2 border border-border rounded-xl px-3 py-2 text-sm text-text"/>
            </div>
            <div>
              <label className="text-xs text-muted block mb-1">Amount</label>
              <input type="number" step="0.01" min="0" value={form.amount}
                onChange={e => set('amount', e.target.value)} placeholder="0.00"
                className="w-full bg-surface-2 border border-border rounded-xl px-3 py-2 text-sm text-text font-mono"/>
            </div>
          </div>

          <div>
            <label className="text-xs text-muted block mb-1">Description</label>
            <input value={form.description} onChange={e => set('description', e.target.value)}
              placeholder="What was this for?"
              className="w-full bg-surface-2 border border-border rounded-xl px-3 py-2 text-sm text-text"/>
          </div>

          <div>
            <label className="text-xs text-muted block mb-1">Category</label>
            <select value={form.category} onChange={e => set('category', e.target.value)}
              className="w-full bg-surface-2 border border-border rounded-xl px-3 py-2 text-sm text-text appearance-none">
              <option value="">No category</option>
              {categories.filter(c => c.type === form.type || c.type === 'both').map(c => (
                <option key={c.id} value={c.name}>{c.icon} {c.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs text-muted block mb-1">Notes (optional)</label>
            <input value={form.notes} onChange={e => set('notes', e.target.value)}
              placeholder="Any additional info..."
              className="w-full bg-surface-2 border border-border rounded-xl px-3 py-2 text-sm text-text"/>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-border text-muted hover:text-text text-sm transition-all">
            Cancel
          </button>
          <button onClick={submit} disabled={saving || !form.description || !form.amount}
            className="flex-1 py-2.5 rounded-xl bg-accent text-surface font-semibold text-sm hover:bg-opacity-90 transition-all disabled:opacity-50">
            {saving ? 'Saving...' : tx ? 'Save Changes' : 'Add Transaction'}
          </button>
        </div>
      </div>
    </div>
  )
}
