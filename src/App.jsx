import React, { useState, useEffect, createContext, useContext } from 'react'
import Dashboard from './components/Dashboard'
import Transactions from './components/Transactions'
import Upload from './components/Upload'
import AIAssistant from './components/AIAssistant'
import Settings from './components/Settings'

// ── App Context ──────────────────────────────────────────────────────────────
export const AppContext = createContext(null)
export const useApp = () => useContext(AppContext)

const NAV_ITEMS = [
  { id: 'dashboard', icon: GridIcon, label: 'Dashboard' },
  { id: 'transactions', icon: ListIcon, label: 'Transactions' },
  { id: 'upload', icon: UploadIcon, label: 'Import' },
  { id: 'assistant', icon: BrainIcon, label: 'AI Assistant' },
  { id: 'settings', icon: GearIcon, label: 'Settings' }
]

export default function App() {
  const [page, setPage] = useState('dashboard')
  const [categories, setCategories] = useState([])
  const [settings, setSettings] = useState({})
  const [ollamaOk, setOllamaOk] = useState(false)
  const [currency, setCurrency] = useState('€')

  useEffect(() => {
    loadInitial()
    const interval = setInterval(checkOllama, 10000)
    return () => clearInterval(interval)
  }, [])

  async function loadInitial() {
    const [cats, setts] = await Promise.all([
      window.api.categories.getAll(),
      window.api.settings.getAll()
    ])
    setCategories(cats)
    setSettings(setts)
    setCurrency(setts.currency === 'USD' ? '$' : setts.currency === 'GBP' ? '£' : '€')
    checkOllama()
  }

  async function checkOllama() {
    const ok = await window.api.ollama.isRunning()
    setOllamaOk(ok)
  }

  async function refreshCategories() {
    const cats = await window.api.categories.getAll()
    setCategories(cats)
  }

  async function refreshSettings() {
    const setts = await window.api.settings.getAll()
    setSettings(setts)
    setCurrency(setts.currency === 'USD' ? '$' : setts.currency === 'GBP' ? '£' : '€')
  }

  const ctx = { categories, settings, ollamaOk, currency, refreshCategories, refreshSettings, setPage }

  const PageComponent = {
    dashboard: Dashboard,
    transactions: Transactions,
    upload: Upload,
    assistant: AIAssistant,
    settings: Settings
  }[page]

  return (
    <AppContext.Provider value={ctx}>
      <div className="flex h-screen w-screen overflow-hidden bg-surface">

        {/* ── Sidebar ── */}
        <aside className="w-[72px] flex flex-col items-center py-4 gap-1 border-r border-border bg-surface-1 drag-region shrink-0">
          {/* Logo */}
          <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center mb-4 mt-3 shrink-0 no-drag" title="Finance Planner">
            <ChartIcon />
          </div>

          <div className="flex-1 flex flex-col gap-1 no-drag">
            {NAV_ITEMS.map(item => {
              const Icon = item.icon
              const active = page === item.id
              return (
                <button
                  key={item.id}
                  onClick={() => setPage(item.id)}
                  title={item.label}
                  className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-200
                    ${active
                      ? 'bg-accent text-surface shadow-lg glow-green'
                      : 'text-muted hover:text-text hover:bg-surface-2'
                    }`}
                >
                  <Icon size={20} />
                </button>
              )
            })}
          </div>

          {/* Ollama status dot */}
          <div
            className={`no-drag w-2 h-2 rounded-full mb-2 transition-colors ${ollamaOk ? 'bg-accent' : 'bg-loss'}`}
            title={ollamaOk ? 'Ollama connected' : 'Ollama not running — start Ollama to use AI features'}
          />
        </aside>

        {/* ── Main ── */}
        <main className="flex-1 overflow-hidden">
          <PageComponent />
        </main>
      </div>
    </AppContext.Provider>
  )
}

// ── Inline SVG Icons ──────────────────────────────────────────────────────────
function ChartIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/>
    </svg>
  )
}
function GridIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
      <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
    </svg>
  )
}
function ListIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>
    </svg>
  )
}
function UploadIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
      <polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
    </svg>
  )
}
function BrainIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z"/>
      <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z"/>
    </svg>
  )
}
function GearIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  )
}
