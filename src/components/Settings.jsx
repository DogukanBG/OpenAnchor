import React, { useState, useEffect } from 'react'
import { useApp } from '../App'

const CURRENCIES = [
  { code: 'EUR', symbol: '€', label: 'Euro (€)' },
  { code: 'USD', symbol: '$', label: 'US Dollar ($)' },
  { code: 'GBP', symbol: '£', label: 'British Pound (£)' },
  { code: 'CHF', symbol: 'Fr', label: 'Swiss Franc (Fr)' },
  { code: 'JPY', symbol: '¥', label: 'Japanese Yen (¥)' }
]

const CAT_COLORS = [
  '#3dd68c','#f97066','#f0b429','#6366f1','#3b82f6','#8b5cf6','#ec4899',
  '#06b6d4','#14b8a6','#f59e0b','#ef4444','#84cc16','#a855f7','#64748b'
]

const ACCENT_PRESETS = [
  { id: 'green',  label: 'Emerald',  color: '#3dd68c' },
  { id: 'blue',   label: 'Blue',     color: '#3b82f6' },
  { id: 'purple', label: 'Purple',   color: '#a855f7' },
  { id: 'orange', label: 'Orange',   color: '#f97316' },
  { id: 'red',    label: 'Red',      color: '#ef4444' },
  { id: 'cyan',   label: 'Cyan',     color: '#06b6d4' },
  { id: 'pink',   label: 'Pink',     color: '#ec4899' },
]

export default function Settings() {
  const { categories, settings, ollamaOk, refreshCategories, refreshSettings } = useApp()
  const [models, setModels] = useState([])
  const [loadingModels, setLoadingModels] = useState(false)
  const [saved, setSaved] = useState('')
  const [newCat, setNewCat] = useState({ name: '', type: 'expense', color: '#6366f1', icon: '📋' })
  const [addingCat, setAddingCat] = useState(false)

  const [form, setForm] = useState({
    extraction_model: '',
    assistant_model: '',
    currency: 'EUR',
    ollama_url: 'http://127.0.0.1:11434',
    theme: 'dark',
    accent_color: 'green',
    accent_custom: '#3dd68c'
  })

  useEffect(() => {
    if (settings) {
      setForm(f => ({
        ...f,
        extraction_model: settings.extraction_model || '',
        assistant_model: settings.assistant_model || '',
        currency: settings.currency || 'EUR',
        ollama_url: settings.ollama_url || 'http://127.0.0.1:11434',
        theme: settings.theme || 'dark',
        accent_color: settings.accent_color || 'green',
        accent_custom: settings.accent_custom || '#3dd68c'
      }))
    }
  }, [settings])

  useEffect(() => {
    if (ollamaOk) fetchModels()
  }, [ollamaOk])

  async function fetchModels() {
    setLoadingModels(true)
    const list = await window.api.ollama.listModels()
    setModels(list)
    setLoadingModels(false)
  }

  function set(k, v) {
    const updated = { ...form, [k]: v }
    setForm(updated)
    // Live preview — apply immediately without saving
    previewTheme(updated)
  }

  function previewTheme(f) {
    const root = document.documentElement
    root.setAttribute('data-theme', f.theme || 'dark')
    const accent = f.accent_color || 'green'
    root.setAttribute('data-accent', accent)
    if (accent === 'custom' && f.accent_custom) {
      const hex = f.accent_custom
      const r = parseInt(hex.slice(1,3),16)
      const g = parseInt(hex.slice(3,5),16)
      const b = parseInt(hex.slice(5,7),16)
      root.style.setProperty('--accent', hex)
      root.style.setProperty('--accent-glow', `rgba(${r},${g},${b},0.15)`)
      root.style.setProperty('--accent-dim',  `rgba(${r},${g},${b},0.12)`)
      const lum = (0.299*r + 0.587*g + 0.114*b) / 255
      root.style.setProperty('--accent-text', lum > 0.5 ? '#0f172a' : '#ffffff')
    } else {
      root.style.removeProperty('--accent')
      root.style.removeProperty('--accent-glow')
      root.style.removeProperty('--accent-dim')
      root.style.removeProperty('--accent-text')
    }
  }

  async function saveSettings() {
    for (const [k, v] of Object.entries(form)) {
      await window.api.settings.set(k, v)
    }
    await refreshSettings()
    setSaved('Saved!')
    setTimeout(() => setSaved(''), 2000)
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
    else alert(result.error)
  }

  const customCats = categories.filter(c => !c.is_default)
  const defaultCats = categories.filter(c => c.is_default)

  return (
    <div className="h-full overflow-y-auto p-6 animate-fade-in">
      <div className="max-w-2xl mx-auto space-y-6">

        <h1 className="font-display text-2xl font-bold text-text-bright">Settings</h1>

        {/* ── AI Models ── */}
        <Section title="AI Models" icon="🤖">
          <div className="flex items-center justify-between mb-4">
            <div className={`flex items-center gap-2 text-sm ${ollamaOk ? 'text-accent' : 'text-loss'}`}>
              <span className={`w-2 h-2 rounded-full ${ollamaOk ? 'bg-accent' : 'bg-loss'}`}/>
              {ollamaOk ? 'Ollama connected' : 'Ollama not running'}
            </div>
            <button
              onClick={fetchModels}
              disabled={!ollamaOk}
              className="text-xs text-muted hover:text-text border border-border px-3 py-1.5 rounded-xl transition-all disabled:opacity-40"
            >
              Refresh models
            </button>
          </div>

          {!ollamaOk && (
            <div className="mb-4 p-3 bg-surface-2 border border-border rounded-xl text-sm text-muted">
              <p className="font-medium text-text mb-1">To use AI features:</p>
              <ol className="space-y-1 text-xs">
                <li>1. Install Ollama from <span className="text-accent font-mono">ollama.ai</span></li>
                <li>2. Run <code className="bg-black/20 px-1 rounded font-mono">ollama serve</code> in terminal</li>
                <li>3. Pull a model, e.g. <code className="bg-black/20 px-1 rounded font-mono">ollama pull llama3.2</code></li>
              </ol>
            </div>
          )}

          <ModelSelect
            label="Bank Statement Extraction Model"
            hint="Used to parse transactions from uploaded files. Smaller models like llama3.2:3b or qwen2.5:3b work well."
            value={form.extraction_model}
            models={models}
            loading={loadingModels}
            onChange={v => set('extraction_model', v)}
          />
          <div className="mt-3"/>
          <ModelSelect
            label="AI Assistant Model"
            hint="Used for chat and financial analysis. Larger models give better insights. Try llama3.1:8b or mistral:7b."
            value={form.assistant_model}
            models={models}
            loading={loadingModels}
            onChange={v => set('assistant_model', v)}
          />

          <div className="mt-4">
            <label className="text-xs text-muted block mb-1">Ollama URL</label>
            <input
              value={form.ollama_url}
              onChange={e => set('ollama_url', e.target.value)}
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
                { id: 'dark',  label: '🌑 Dark',  bg: '#0d1117', fg: '#e2e8f0' },
                { id: 'light', label: '☀️ Light', bg: '#f5f7fa', fg: '#1e2736' }
              ].map(t => (
                <button
                  key={t.id}
                  onClick={() => set('theme', t.id)}
                  style={{ background: t.bg, color: t.fg, borderColor: form.theme === t.id ? 'var(--accent)' : 'var(--border)' }}
                  className={`flex-1 py-3 rounded-xl border-2 text-sm font-medium transition-all ${form.theme === t.id ? 'ring-1 ring-offset-1 ring-offset-surface-1' : 'opacity-70 hover:opacity-100'}`}
                  style={{ background: t.bg, color: t.fg, borderColor: form.theme === t.id ? '#3dd68c' : 'var(--border)' }}
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
                    placeholder="#3dd68c"
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
            <label className="text-xs text-muted block mb-1">Currency</label>
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

        {/* ── About ── */}
        <Section title="About" icon="ℹ️">
          <div className="text-sm text-muted space-y-2">
            <p><span className="text-text font-medium">Finance Planner</span> — open-source, privacy-first</p>
            <p>All data stored locally in SQLite. No cloud, no telemetry, no accounts.</p>
            <p>AI powered by <span className="text-accent">Ollama</span> — runs 100% on your machine.</p>
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

function ModelSelect({ label, hint, value, models, loading, onChange }) {
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
          {models.map(m => (
            <option key={m.name} value={m.name}>{m.name}</option>
          ))}
        </select>
      )}
      {hint && <p className="text-xs text-muted mt-1">{hint}</p>}
      {models.length === 0 && !loading && (
        <p className="text-xs text-loss mt-1">No models found. Pull one with: <code className="font-mono bg-black/20 px-1 rounded">ollama pull llama3.2</code></p>
      )}
    </div>
  )
}
