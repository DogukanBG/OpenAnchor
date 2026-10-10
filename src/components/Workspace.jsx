import React from 'react'
import {useApp} from '../App'
export function localDate(){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
export function Money({value=0,currency='EUR'}){return new Intl.NumberFormat(undefined,{style:'currency',currency}).format(value)}
export function Panel({children}){return <section className="card p-5 mb-5">{children}</section>}
export function Field({label,...props}){return <label className="block text-sm mb-3">{label}<input className="input w-full mt-1" {...props}/></label>}
export function Scope({dates=true}){const {accounts,scope,setScope}=useApp();return <div className="flex gap-3 flex-wrap mb-5"><select className="input" value={scope.accountId||''} onChange={e=>setScope({...scope,accountId:Number(e.target.value)})}>{accounts.map(a=><option key={a.id} value={a.id}>{a.name} · {a.currency}</option>)}</select>{dates&&<><input aria-label="From date" className="input" type="date" value={scope.dateFrom} onChange={e=>setScope({...scope,dateFrom:e.target.value})}/><input aria-label="To date" className="input" type="date" value={scope.dateTo} onChange={e=>setScope({...scope,dateTo:e.target.value})}/></>}</div>}
export function ErrorNotice({error}){return error&&<p role="alert" className="text-red-400 mb-4">{error}</p>}
