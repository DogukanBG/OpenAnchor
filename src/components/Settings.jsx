import React, { useState, useEffect, useRef } from 'react'
import { useApp } from '../App'
import DataControls from './DataControls'
import LocalLlama from './LocalLlama'
import { applyTheme } from '../utils/theme'
import { CURRENCIES, symbolFor } from '../utils/currency'

// Muted and natural, but with enough different hues that categories stay
// apart from each other in a chart.
const CAT_COLORS = [
  '#c17f4a','#b8503a','#c9a227','#7d9455','#4f8a7b','#5b7fa6','#8a6ba3',
  '#b5647f','#8c6239','#6b8f3f','#d18f5c','#5f7d6e','#a3563f','#7a7263'
]

const ACCENT_PRESETS = [{id:'blue',label:'Blue',color:'#2875e8'}]

export default function Settings() {
  const { categories, accounts, settings, ollamaOk, refreshCategories, refreshAccounts, refreshSettings, showToast } = useApp()
  const modelRequest=useRef(0)
  const [models, setModels] = useState([])
  const [loadingModels, setLoadingModels] = useState(false)
  const [modelError,setModelError]=useState('')
  const [saved, setSaved] = useState('')
  const [newCat, setNewCat] = useState({ name: '', type: 'expense', color: '#6366f1', icon: '📋' })
  const [addingCat, setAddingCat] = useState(false)

  // Accounts
  const [newAccount, setNewAccount] = useState({ name: '', currency: 'EUR' })
  const [addingAccount, setAddingAccount] = useState(false)
  const [balanceAccountId, setBalanceAccountId] = useState(null)
  const [manualBalance, setManualBalance]       = useState('')
  const [manualBalanceDate, setManualBalanceDate] = useState(new Date().toISOString().split('T')[0])
  const [balanceSaved, setBalanceSaved]         = useState('')

  const balanceAccount = accounts.find(a => a.id === balanceAccountId) || accounts[0] || null

  const [form, setForm] = useState({
    extraction_model: '',
    assistant_model: '',
    currency: 'EUR',
    ai_provider: 'ollama',
    ollama_url: 'http://127.0.0.1:11434',
    custom_base_url: 'http://127.0.0.1:8080',
    theme: 'light',
    accent_color: 'blue',
    accent_custom: '#c68a4e',
    user_name: '',
    user_memory: ''
  })

  useEffect(() => {
    if (settings) {
      setForm(f => ({
        ...f,
        ollama_extraction_model:settings.ollama_extraction_model||'',ollama_assistant_model:settings.ollama_assistant_model||'',custom_extraction_model:settings.custom_extraction_model||'',custom_assistant_model:settings.custom_assistant_model||'',
        extraction_model: settings[`${settings.ai_provider||'ollama'}_extraction_model`] || settings.extraction_model || '',
        assistant_model: settings[`${settings.ai_provider||'ollama'}_assistant_model`] || settings.assistant_model || '',
        currency: settings.currency || 'EUR',
        ai_provider: settings.ai_provider || 'ollama',
        ollama_url: settings.ollama_url || 'http://127.0.0.1:11434',
        custom_base_url: settings.custom_base_url || 'http://127.0.0.1:8080',
        theme: settings.theme || 'light',
        accent_color: settings.accent_color === 'custom' ? 'custom' : 'blue',
        accent_custom: settings.accent_custom || '#c68a4e',
        user_name: settings.user_name || '',
        user_memory: settings.user_memory || ''
      }))
    }
  }, [settings])

  useEffect(() => {
    const timer=setTimeout(fetchModels,500);return()=>{clearTimeout(timer);modelRequest.current++}
  }, [form.ai_provider,form.custom_base_url,form.ollama_url,ollamaOk])

  async function fetchModels() {
    const request=++modelRequest.current;setLoadingModels(true);setModels([]);setModelError('')
    try{const list=await window.api.ollama.listModels({provider:form.ai_provider,baseUrl:form.ai_provider==='custom'?form.custom_base_url:form.ollama_url});if(request===modelRequest.current)setModels(list)}catch(e){if(request===modelRequest.current)setModelError(e.message)}finally{if(request===modelRequest.current)setLoadingModels(false)}
  }

  function set(k, v) {
    const updated = { ...form, [k]: v };if(['extraction_model','assistant_model'].includes(k))updated[`${form.ai_provider}_${k}`]=v;if(k==='ai_provider'){for(const purpose of ['extraction','assistant']){updated[`${form.ai_provider}_${purpose}_model`]=form[`${purpose}_model`];updated[`${purpose}_model`]=form[`${v}_${purpose}_model`]||settings[`${v}_${purpose}_model`]||''}}
    setForm(updated)
    // Live preview — apply immediately without saving
    previewTheme(updated)
  }

  // Applies the chosen theme right away, before the user hits Save.
  function previewTheme(f) {
    applyTheme(f)
  }

  async function saveSettings() {
    await window.api.settings.set('ai_provider',form.ai_provider)
    for (const [k, v] of Object.entries(form)) {
      await window.api.settings.set(k, v)
    }
    await refreshSettings()
    setSaved('Saved!')
    setTimeout(() => setSaved(''), 2000)
  }

  async function saveManualBalance() {
    if (!manualBalance || !balanceAccount) return
    const amount = parseFloat(manualBalance.replace(',', '.'))
    if (isNaN(amount)) return
    await window.api.accounts.setBalance(balanceAccount.id, amount, manualBalanceDate, 'Manual entry')
    await refreshAccounts()
    setBalanceSaved('Saved!')
    setTimeout(() => setBalanceSaved(''), 2000)
  }

  async function clearBalance() {
    if (!balanceAccount) return
    if (!confirm(`Clear the stored balance for "${balanceAccount.name}"?`)) return
    await window.api.accounts.setBalance(balanceAccount.id, '', '', '')
    await refreshAccounts()
  }

  async function addAccount() {
    if (!newAccount.name.trim()) return
    await window.api.accounts.add(newAccount)
    await refreshAccounts()
    setNewAccount({ name: '', currency: settings.currency || 'EUR' })
    setAddingAccount(false)
  }

  async function deleteAccount(id) {
    if (!confirm('Delete this account?')) return
    const result = await window.api.accounts.delete(id)
    if (result.success) refreshAccounts()
    else showToast(result.error, 'error')
  }

  async function addCategory() {
    if (!newCat.name.trim()) return
    await window.api.categories.add(newCat)
    await refreshCategories()
    setNewCat({ name: '', type: 'expense', color: '#6366f1', icon: '📋' })
    setAddingCat(false)
  }

  async function deleteCategory(id) {
    const result = await window.api.categories.delete(id)
    if (result.success) refreshCategories()
    else showToast(result.error, 'error')
  }

  const customCats = categories.filter(c => !c.is_default)
  const defaultCats = categories.filter(c => c.is_default)

  return (
    <div className="h-full overflow-y-auto p-6 animate-fade-in">
      <div className="max-w-2xl mx-auto space-y-6">

        <h1 className="font-display text-2xl font-bold text-text-bright">Settings</h1>

        <DataControls/>
        {/* ── AI Models ── */}
        <Section title="AI Models" icon="🤖">
          <div className="flex items-center justify-between mb-4">
            <div className={`flex items-center gap-2 text-sm ${models.length ? 'text-accent' : 'text-muted'}`}>
              <span className={`w-2 h-2 rounded-full ${models.length ? 'bg-accent' : 'bg-muted'}`}/>
              {loadingModels?'Checking connection…':models.length?'Connected':modelError?'Not connected':'No model reported'}
            </div>
            <button
              onClick={fetchModels}
              disabled={loadingModels}
              className="text-xs text-muted hover:text-text border border-border px-3 py-1.5 rounded-xl transition-all disabled:opacity-40"
            >
              Refresh models
            </button>
          </div>

          {/* Provider */}
          <div className="mb-4">
            <label className="text-xs text-muted block mb-2">Provider</label>
            <div className="flex gap-2">
              {[
                { id: 'ollama', label: 'Ollama' },
                { id: 'custom', label: 'Custom (llama.cpp / OpenAI-compatible)' }
              ].map(p => (
                <button
                  key={p.id}
                  onClick={() => set('ai_provider', p.id)}
                  className={`flex-1 py-2 px-2 rounded-xl text-xs font-medium border transition-all ${
                    form.ai_provider === p.id ? 'border-accent text-accent bg-accent-dim' : 'border-border text-muted'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {form.ai_provider==='custom'&&<LocalLlama/>}
          {modelError&&<p className="text-sm text-muted mb-3">{modelError}</p>}
          {!models.length && (
            <div className="mb-4 p-3 bg-surface-2 border border-border rounded-xl text-sm text-muted">
              {form.ai_provider === 'custom' ? (
                <>
                  <p className="font-medium text-text mb-1">To use AI features:</p>
                  <ol className="space-y-1 text-xs">
                    <li>1. Start llama-server with your GGUF model, e.g. <code className="bg-black/20 px-1 rounded font-mono">llama-server -m model.gguf --port 8080</code></li>
                    <li>2. Make sure the Server URL below matches</li>
                  </ol>
                </>
              ) : (
                <>
                  <p className="font-medium text-text mb-1">To use AI features:</p>
                  <ol className="space-y-1 text-xs">
                    <li>1. Install Ollama from <span className="text-accent font-mono">ollama.ai</span></li>
                    <li>2. Run <code className="bg-black/20 px-1 rounded font-mono">ollama serve</code> in terminal</li>
                    <li>3. Pull a model, e.g. <code className="bg-black/20 px-1 rounded font-mono">ollama pull llama3.2</code></li>
                  </ol>
                </>
              )}
            </div>
          )}

          <ModelSelect
            label="Bank Statement Extraction Model"
            hint="Used to parse transactions from uploaded files. Smaller models like llama3.2:3b or qwen2.5:3b work well."
            value={form.extraction_model}
            provider={form.ai_provider}
            models={models}
            loading={loadingModels}
            onChange={v => set('extraction_model', v)}
          />
          <div className="mt-3"/>
          <ModelSelect
            label="AI Assistant Model"
            hint="Used for chat and financial analysis. Larger models give better insights. Try llama3.1:8b or mistral:7b."
            value={form.assistant_model}
            provider={form.ai_provider}
            models={models}
            loading={loadingModels}
            onChange={v => set('assistant_model', v)}
          />

          <div className="mt-4">
            <label className="text-xs text-muted block mb-1">
              {form.ai_provider === 'custom' ? 'Server Base URL (llama.cpp / OpenAI-compatible)' : 'Ollama URL'}
            </label>
            <input
              value={form.ai_provider === 'custom' ? form.custom_base_url : form.ollama_url}
              onChange={e => set(form.ai_provider === 'custom' ? 'custom_base_url' : 'ollama_url', e.target.value)}
              placeholder={form.ai_provider === 'custom' ? 'http://127.0.0.1:8080' : 'http://127.0.0.1:11434'}
              className="w-full bg-surface-2 border border-border rounded-xl px-3 py-2 text-sm text-text font-mono"
            />
          </div>
        </Section>

        {/* ── Appearance ── */}
        <Section title="Appearance" icon="🎨">
          {/* Base theme */}
          <div className="mb-5">
            <label className="text-xs text-muted block mb-2">Base Theme</label>
            <div className="flex gap-3">
              {[
                { id: 'light', label: '☀️ Light', bg: '#faf7f2', fg: '#2f2a25' },
                { id: 'dark',  label: '🌑 Dark',  bg: '#1c1a18', fg: '#ece7df' }
              ].map(t => (
                <button
                  key={t.id}
                  onClick={() => set('theme', t.id)}
                  className={`flex-1 py-3 rounded-xl border-2 text-sm font-medium transition-all ${form.theme === t.id ? 'ring-1 ring-offset-1 ring-offset-surface-1' : 'opacity-70 hover:opacity-100'}`}
                  style={{ background: t.bg, color: t.fg, borderColor: form.theme === t.id ? 'var(--accent)' : 'var(--border)' }}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Accent colour */}
          <div>
            <label className="text-xs text-muted block mb-2">Accent Colour</label>
            <div className="flex gap-2 flex-wrap mb-3">
              {ACCENT_PRESETS.map(p => (
                <button
                  key={p.id}
                  onClick={() => set('accent_color', p.id)}
                  title={p.label}
                  className="flex flex-col items-center gap-1 group"
                >
                  <span
                    style={{ background: p.color }}
                    className={`w-8 h-8 rounded-full transition-all group-hover:scale-110 ${
                      form.accent_color === p.id ? 'ring-2 ring-white ring-offset-2 ring-offset-surface-1 scale-110' : ''
                    }`}
                  />
                  <span className="text-[10px] text-muted">{p.label}</span>
                </button>
              ))}
              {/* Custom */}
              <button
                onClick={() => set('accent_color', 'custom')}
                className="flex flex-col items-center gap-1 group"
                title="Custom"
              >
                <span
                  style={{
                    background: form.accent_color === 'custom'
                      ? form.accent_custom
                      : 'conic-gradient(red, yellow, lime, aqua, blue, magenta, red)'
                  }}
                  className={`w-8 h-8 rounded-full transition-all group-hover:scale-110 ${
                    form.accent_color === 'custom' ? 'ring-2 ring-white ring-offset-2 ring-offset-surface-1 scale-110' : ''
                  }`}
                />
                <span className="text-[10px] text-muted">Custom</span>
              </button>
            </div>

            {/* Custom hex input */}
            {form.accent_color === 'custom' && (
              <div className="flex items-center gap-3 p-3 bg-surface-2 rounded-xl border border-border animate-fade-in">
                <input
                  type="color"
                  value={form.accent_custom}
                  onChange={e => set('accent_custom', e.target.value)}
                  className="w-10 h-10 rounded-lg cursor-pointer border-0 bg-transparent p-0"
                />
                <div className="flex-1">
                  <input
                    type="text"
                    value={form.accent_custom}
                    onChange={e => /^#[0-9a-fA-F]{0,6}$/.test(e.target.value) && set('accent_custom', e.target.value)}
                    className="w-full bg-surface-1 border border-border rounded-lg px-3 py-1.5 text-sm font-mono text-text"
                    placeholder="#c68a4e"
                    maxLength={7}
                  />
                  <p className="text-xs text-muted mt-1">Enter any hex colour</p>
                </div>
                <span
                  className="w-10 h-10 rounded-lg shrink-0"
                  style={{ background: form.accent_custom }}
                />
              </div>
            )}
          </div>
        </Section>

        {/* ── General ── */}
        <Section title="General" icon="⚙️">
          <div>
            <label className="text-xs text-muted block mb-1">Default Currency for New Accounts</label>
            <select
              value={form.currency}
              onChange={e => set('currency', e.target.value)}
              className="bg-surface-2 border border-border rounded-xl px-3 py-2 text-sm text-text appearance-none"
            >
              {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
            </select>
          </div>
        </Section>

        {/* Save button */}
        <button
          onClick={saveSettings}
          className="w-full py-3 bg-accent text-surface rounded-2xl font-semibold hover:bg-opacity-90 transition-all"
        >
          {saved || 'Save Settings'}
        </button>

        {/* ── Categories ── */}
        <Section title="Categories" icon="🏷️">
          {/* Custom categories */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-text">Custom Categories</p>
              <button
                onClick={() => setAddingCat(true)}
                className="text-xs text-accent hover:underline"
              >
                + Add new
              </button>
            </div>

            {addingCat && (
              <div className="bg-surface-2 rounded-xl p-4 mb-3 space-y-3 border border-border animate-slide-up">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-muted block mb-1">Name</label>
                    <input
                      value={newCat.name}
                      onChange={e => setNewCat(c => ({ ...c, name: e.target.value }))}
                      placeholder="e.g. Gym membership"
                      className="w-full bg-surface-1 border border-border rounded-xl px-3 py-2 text-sm text-text"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted block mb-1">Icon</label>
                    <input
                      value={newCat.icon}
                      onChange={e => setNewCat(c => ({ ...c, icon: e.target.value }))}
                      placeholder="🏋️"
                      className="w-full bg-surface-1 border border-border rounded-xl px-3 py-2 text-sm text-text"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-muted block mb-1">Type</label>
                  <div className="flex gap-2">
                    {['expense', 'income', 'both'].map(t => (
                      <button key={t} onClick={() => setNewCat(c => ({ ...c, type: t }))}
                        className={`px-3 py-1.5 rounded-lg text-xs capitalize transition-all border ${newCat.type === t ? 'border-accent text-accent bg-accent-dim' : 'border-border text-muted'}`}>
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs text-muted block mb-1">Color</label>
                  <div className="flex gap-2 flex-wrap">
                    {CAT_COLORS.map(col => (
                      <button key={col} onClick={() => setNewCat(c => ({ ...c, color: col }))}
                        style={{ background: col }}
                        className={`w-6 h-6 rounded-full transition-transform hover:scale-110 ${newCat.color === col ? 'ring-2 ring-white ring-offset-1 ring-offset-surface-2' : ''}`}/>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setAddingCat(false)} className="flex-1 py-2 text-sm text-muted border border-border rounded-xl hover:text-text transition-all">Cancel</button>
                  <button onClick={addCategory} className="flex-1 py-2 text-sm bg-accent text-surface rounded-xl font-medium">Add Category</button>
                </div>
              </div>
            )}

            {customCats.length === 0 && !addingCat ? (
              <p className="text-muted text-xs">No custom categories yet.</p>
            ) : (
              <div className="space-y-1">
                {customCats.map(cat => (
                  <div key={cat.id} className="flex items-center gap-3 px-3 py-2 bg-surface-2 rounded-xl group">
                    <span className="text-base">{cat.icon}</span>
                    <span className="w-3 h-3 rounded-full shrink-0" style={{ background: cat.color }}/>
                    <span className="text-sm text-text flex-1">{cat.name}</span>
                    <span className="text-xs text-muted">{cat.type}</span>
                    <button onClick={() => deleteCategory(cat.id)}
                      className="opacity-0 group-hover:opacity-100 text-muted hover:text-loss text-xs transition-all">
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Default categories (read-only) */}
          <details>
            <summary className="text-xs text-muted cursor-pointer hover:text-text mb-2">
              View {defaultCats.length} built-in categories
            </summary>
            <div className="grid grid-cols-2 gap-1 mt-2">
              {defaultCats.map(cat => (
                <div key={cat.id} className="flex items-center gap-2 px-2 py-1.5 text-xs text-muted">
                  <span>{cat.icon}</span>
                  <span className="w-2 h-2 rounded-full" style={{ background: cat.color }}/>
                  <span className="flex-1 truncate">{cat.name}</span>
                </div>
              ))}
            </div>
          </details>
        </Section>

        {/* ── Accounts ── */}
        <Section title="Accounts" icon="🏦">
          <p className="text-xs text-muted mb-4">
            Track more than one bank account, each with its own currency and balance.
          </p>

          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-text">Your Accounts</p>
              <button onClick={() => setAddingAccount(true)} className="text-xs text-accent hover:underline">
                + Add account
              </button>
            </div>

            {addingAccount && (
              <div className="bg-surface-2 rounded-xl p-4 mb-3 space-y-3 border border-border animate-slide-up">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-muted block mb-1">Name</label>
                    <input
                      value={newAccount.name}
                      onChange={e => setNewAccount(a => ({ ...a, name: e.target.value }))}
                      placeholder="e.g. Savings"
                      className="w-full bg-surface-1 border border-border rounded-xl px-3 py-2 text-sm text-text"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted block mb-1">Currency</label>
                    <select
                      value={newAccount.currency}
                      onChange={e => setNewAccount(a => ({ ...a, currency: e.target.value }))}
                      className="w-full bg-surface-1 border border-border rounded-xl px-3 py-2 text-sm text-text appearance-none"
                    >
                      {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
                    </select>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setAddingAccount(false)} className="flex-1 py-2 text-sm text-muted border border-border rounded-xl hover:text-text transition-all">Cancel</button>
                  <button onClick={addAccount} className="flex-1 py-2 text-sm bg-accent text-surface rounded-xl font-medium">Add Account</button>
                </div>
              </div>
            )}

            <div className="space-y-1">
              {accounts.map(acc => (
                <div key={acc.id} className="flex items-center gap-3 px-3 py-2 bg-surface-2 rounded-xl group">
                  <span className="text-sm text-text flex-1">{acc.name}</span>
                  <span className="text-xs text-muted">{acc.currency}</span>
                  <span className="text-xs font-mono text-muted">
                    {acc.balance ? `${symbolFor(acc.currency)}${parseFloat(acc.balance).toLocaleString('de-DE', { minimumFractionDigits: 2 })}` : '—'}
                  </span>
                  {!acc.is_default && (
                    <button onClick={() => deleteAccount(acc.id)}
                      className="opacity-0 group-hover:opacity-100 text-muted hover:text-loss text-xs transition-all">
                      Remove
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Manual balance, per account */}
          {balanceAccount && (
            <div className="border-t border-border pt-4">
              <p className="text-sm font-medium text-text mb-2">Set Balance</p>
              <p className="text-xs text-muted mb-3">
                Useful when you don't have a bank statement to import yet, or want to correct the balance.
              </p>
              <select
                value={balanceAccount.id}
                onChange={e => setBalanceAccountId(Number(e.target.value))}
                className="w-full mb-3 bg-surface-2 border border-border rounded-xl px-3 py-2 text-sm text-text appearance-none"
              >
                {accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.name}</option>)}
              </select>

              {balanceAccount.balance && (
                <div className="flex items-center justify-between bg-surface-2 rounded-xl px-4 py-3 mb-3 border border-border">
                  <div>
                    <p className="text-xs text-muted">Current stored balance</p>
                    <p className="text-lg font-display font-bold text-accent">
                      {symbolFor(balanceAccount.currency)}{parseFloat(balanceAccount.balance).toLocaleString('de-DE', { minimumFractionDigits: 2 })}
                    </p>
                    <p className="text-xs text-muted mt-0.5">as of {balanceAccount.balance_date} · {balanceAccount.balance_label}</p>
                  </div>
                  <button onClick={clearBalance}
                    className="text-xs text-muted hover:text-loss border border-border hover:border-loss px-3 py-1.5 rounded-xl transition-all">
                    Clear
                  </button>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted block mb-1">Balance Amount</label>
                  <input
                    type="text"
                    value={manualBalance}
                    onChange={e => setManualBalance(e.target.value)}
                    placeholder="e.g. 3420.50"
                    className="w-full bg-surface-2 border border-border rounded-xl px-3 py-2 text-sm text-text font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted block mb-1">As of Date</label>
                  <input
                    type="date"
                    value={manualBalanceDate}
                    onChange={e => setManualBalanceDate(e.target.value)}
                    className="w-full bg-surface-2 border border-border rounded-xl px-3 py-2 text-sm text-text"
                  />
                </div>
              </div>
              <button
                onClick={saveManualBalance}
                disabled={!manualBalance}
                className="mt-3 w-full py-2.5 bg-accent text-surface rounded-xl font-semibold text-sm hover:bg-opacity-90 transition-all disabled:opacity-40"
              >
                {balanceSaved || 'Set Balance'}
              </button>
            </div>
          )}
        </Section>

        {/* ── User Profile ── */}
        <Section title="User Profile" icon="👤">
          <p className="text-xs text-muted mb-4">Your name and personal notes are injected into every AI prompt, so the assistant knows who it's talking to and can tailor advice accordingly.</p>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted block mb-1">Your Name</label>
              <input
                value={form.user_name}
                onChange={e => set('user_name', e.target.value)}
                placeholder="e.g. Alex"
                className="w-full bg-surface-2 border border-border rounded-xl px-3 py-2 text-sm text-text"
              />
              <p className="text-xs text-muted mt-1">Shown on the dashboard and used in AI greetings.</p>
            </div>
            <div>
              <label className="text-xs text-muted block mb-1">Personal Memory</label>
              <textarea
                value={form.user_memory}
                onChange={e => set('user_memory', e.target.value)}
                placeholder={"e.g. I'm saving for a house. I try to keep monthly expenses under €2,000. I have a car loan of €180/month."}
                rows={4}
                className="w-full bg-surface-2 border border-border rounded-xl px-3 py-2 text-sm text-text resize-none"
              />
              <p className="text-xs text-muted mt-1">The AI uses this context in every response. Write anything relevant — goals, constraints, situation.</p>
            </div>
          </div>
        </Section>

        {/* ── About ── */}
        <Section title="About" icon="ℹ️">
          <div className="text-sm text-muted space-y-2">
            <p><span className="text-text font-medium">OpenAnchor</span> — open-source, privacy-first</p>
            <p>All data stored locally in SQLite. No cloud, no telemetry, no accounts.</p>
            <p>AI powered by <span className="text-accent">Ollama</span> or a local <span className="text-accent">llama.cpp</span> server — runs 100% on your machine.</p>
            <p className="text-xs opacity-60 mt-2">Database location: {'{userData}/finance.db'}</p>
          </div>
        </Section>

      </div>
    </div>
  )
}

function Section({ title, icon, children }) {
  return (
    <div className="bg-surface-1 border border-border rounded-2xl p-5">
      <h2 className="font-semibold text-text flex items-center gap-2 mb-4">
        <span>{icon}</span>{title}
      </h2>
      {children}
    </div>
  )
}

function ModelSelect({ label, hint, value, models, loading, onChange, provider }) {
  return (
    <div>
      <label className="text-xs text-muted block mb-1">{label}</label>
      {loading ? (
        <div className="h-9 skeleton rounded-xl"/>
      ) : (
        <select
          value={value}
          onChange={e => onChange(e.target.value)}
          className="w-full bg-surface-2 border border-border rounded-xl px-3 py-2 text-sm text-text appearance-none"
        >
          <option value="">— Select model —</option>
          {value&&!models.some(m=>m.name===value)&&<option value={value}>{value} (saved)</option>}
          {models.map(m => (
            <option key={m.name} value={m.name}>{m.name}</option>
          ))}
        </select>
      )}
<input className="input w-full mt-2" aria-label={`${label} model ID`} placeholder="Or enter the exact server model ID" value={value} onChange={e=>onChange(e.target.value)}/>
      {hint && <p className="text-xs text-muted mt-1">{hint}</p>}
      {models.length === 0 && !loading && (
        <p className="text-xs text-muted mt-1">{provider==='custom'?'Choose a GGUF checkpoint and start the local model above, or connect to your running server.':'No models found. Start Ollama and install a model.'}</p>
      )}
    </div>
  )
}
