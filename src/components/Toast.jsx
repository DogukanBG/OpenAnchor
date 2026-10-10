import React, { useEffect } from 'react'

export default function Toast({ toast, onDismiss }) {
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(onDismiss, 3500)
    return () => clearTimeout(t)
  }, [toast, onDismiss])

  if (!toast) return null

  return (
    <div className="fixed bottom-5 right-5 z-[100] animate-slide-up">
      <div className={`flex items-center gap-2.5 px-4 py-3 rounded-xl border shadow-lg text-sm max-w-sm ${
        toast.type === 'error'
          ? 'bg-loss-dim border-loss border-opacity-40 text-loss'
          : 'bg-surface-1 border-border text-text'
      }`}>
        <span>{toast.type === 'error' ? '⚠️' : 'ℹ️'}</span>
        <span className="flex-1">{toast.message}</span>
        <button onClick={onDismiss} className="text-muted hover:text-text">✕</button>
      </div>
    </div>
  )
}
