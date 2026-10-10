import React from 'react'
export default function ExtractionProgress({progress,message}){
 if(!progress)return null
 const determinate=Number.isFinite(progress.total)&&progress.total>0&&Number.isFinite(progress.current)
 const percent=determinate?Math.min(100,Math.max(0,Math.round(progress.current/progress.total*100))):null
 return <div className="mt-4 border border-border rounded-xl p-4" aria-live="polite"><div className="flex justify-between text-sm mb-2"><span>{progress.phase}</span><span>{determinate?`${progress.current} / ${progress.total} · ${progress.waiting?'Model working':`${percent}%`}`:'In progress'}</span></div><progress aria-label={progress.phase} className="w-full h-3 accent-accent" max={determinate?progress.total:1} value={determinate&&!progress.waiting?Math.min(progress.current,progress.total):undefined}/><p className="text-xs text-muted mt-2">{message||progress.message}</p></div>
}
