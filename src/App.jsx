import React, { useState, useEffect, createContext, useContext } from 'react'
import Spending from './components/Spending'
import CategoryManager from './components/CategoryManager'
import Recurring from './components/Recurring'
import MonthlyBudget from './components/MonthlyBudget'
import ReliableImport from './components/ReliableImport'
import Dashboard from './components/CashFlowDashboard'
import Transactions from './components/LedgerTransactions'
import AIAssistant from './components/EvidenceAssistant'
import Settings from './components/Settings'
import Toast from './components/Toast'
import { applyTheme } from './utils/theme'
import { symbolFor } from './utils/currency'
import appIcon from '../assets/icons/openanchor-blue.png'

// ── App Context ──────────────────────────────────────────────────────────────
export const AppContext = createContext(null)
export const useApp = () => useContext(AppContext)

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Overview' },
  { id: 'transactions', label: 'Transactions' },
  { id: 'budget', label: 'Budgets' },
  { id: 'spending', label: 'Spending' },
  { id: 'habits', label: 'Recurring' },
  { id: 'upload', label: 'Import' },
  { id: 'assistant', label: 'Assistant' },
  { id: 'categories', label: 'Categories' },
  { id: 'settings', label: 'Settings' }
]

export default function App() {
  const [page, setPage] = useState('dashboard')
  const [scope,setScopeState]=useState(()=>{try{return JSON.parse(localStorage.getItem('openanchor.scope'))||{accountId:null,dateFrom:new Date().getFullYear()+'-01-01',dateTo:new Date().toLocaleDateString('en-CA')}}catch{return {accountId:null,dateFrom:'2026-01-01',dateTo:'2026-10-03'}}})
  const setScope=value=>{setScopeState(value);localStorage.setItem('openanchor.scope',JSON.stringify(value))}
  const [categories, setCategories] = useState([])
  const [accounts, setAccounts] = useState([])
  const [settings, setSettings] = useState({})
  const [ollamaOk, setOllamaOk] = useState(false)
  const [currency, setCurrency] = useState('€')
  const [toast, setToast] = useState(null)
  const [revision,setRevision]=useState(0)

  useEffect(() => {
    loadInitial().catch(e=>showToast(e.message,'error'))
    const unlisten=window.api.onDataChanged(()=>{setRevision(n=>n+1);refreshAccounts();refreshSettings();refreshCategories()})
    const interval = setInterval(checkOllama, 10000)
    return () => {clearInterval(interval);unlisten()}
  }, [])

  useEffect(()=>{if(settings.ai_provider)checkOllama()},[settings.ai_provider,settings.custom_base_url,settings.ollama_url])

  async function loadInitial() {
    const [cats, accs, setts] = await Promise.all([
      window.api.categories.getAll(),
      window.api.accounts.getAll(),
      window.api.settings.getAll()
    ])
    setCategories(cats)
    setAccounts(accs)
    setScopeState(old=>({...old,accountId:accs.some(a=>a.id===old.accountId)?old.accountId:(accs.find(a=>a.is_default)||accs[0])?.id}))
    setSettings(setts)
    setCurrency(symbolFor(setts.currency))
    applyTheme(setts)
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

  async function refreshAccounts() {
    const accs = await window.api.accounts.getAll()
    setAccounts(accs)
    setScopeState(old=>({...old,accountId:accs.some(a=>a.id===old.accountId)?old.accountId:(accs.find(a=>a.is_default)||accs[0])?.id}))
  }

  async function refreshSettings() {
    const setts = await window.api.settings.getAll()
    setSettings(setts)
    setCurrency(symbolFor(setts.currency))
    applyTheme(setts)
  }

  function showToast(message, type = 'info') {
    setToast({ message, type, id: Date.now() })
  }

  const ctx = { revision,scope,setScope,categories, accounts, settings, ollamaOk, currency, refreshCategories, refreshAccounts, refreshSettings, setPage, showToast }

  const PageComponent = {
    dashboard: Dashboard,
    transactions: Transactions,
    budget: MonthlyBudget,
    habits: Recurring,
    spending: Spending,
    categories: CategoryManager,
    upload: ReliableImport,
    assistant: AIAssistant,
    settings: Settings
  }[page]

  return (
    <AppContext.Provider value={ctx}>
      <div className="oa-app">
        <aside className="oa-sidebar">
          <div className="oa-window-handle drag-region" aria-hidden="true"/>
          <div className="oa-brand"><img src={appIcon} alt=""/><span>OpenAnchor</span></div>
          <nav className="oa-navigation" aria-label="Main navigation">
            {NAV_ITEMS.map(item=><button key={item.id} aria-current={page===item.id?'page':undefined} onClick={()=>setPage(item.id)}><NavIcon name={item.id}/><span>{item.label}</span></button>)}
          </nav>
          <div className="oa-sidebar-footer"><div><span className={`oa-status ${ollamaOk?'connected':''}`}/>{ollamaOk?'AI connected':'AI offline'}</div><span>Stored on this Mac</span></div>
        </aside>
        <div className="oa-workspace"><div className="oa-titlebar drag-region" aria-hidden="true"/><main className="oa-content"><PageComponent/></main></div>
        <Toast toast={toast} onDismiss={()=>setToast(null)}/>
      </div>
    </AppContext.Provider>
  )
}

function NavIcon({name}){
 const paths={categories:<><path d="M3 3h8l10 10-8 8L3 11Z"/><circle cx="7.5" cy="7.5" r="1"/></>,dashboard:<><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,transactions:<><path d="M3 7h18l-4-4M21 17H3l4 4"/></>,spending:<><path d="M4 3v17h17M7 14l4-4 4 2 5-7"/></>,habits:<><path d="M4 8h15l-3-3M20 16H5l3 3M20 8v4M4 16v-4"/></>,budget:<><rect x="3" y="5" width="18" height="15" rx="2"/><path d="M3 9h18M15 13h6v4h-6z"/></>,assistant:<><path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5Z"/></>,settings:<><path d="M4 6h16M4 12h16M4 18h16"/><circle cx="9" cy="6" r="2"/><circle cx="15" cy="12" r="2"/><circle cx="9" cy="18" r="2"/></>,upload:<><path d="M12 16V3m-5 5 5-5 5 5M4 14v6h16v-6"/></>}
 return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>
}
