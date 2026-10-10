// Shared appearance for the Workspace design; saved light/dark preference persists.
export function applyTheme(settings){
 const root=document.documentElement;root.setAttribute('data-theme',settings.theme||'light');root.setAttribute('data-accent','blue')
 const custom=settings.accent_color==='custom'&&/^#[a-f0-9]{6}$/i.test(settings.accent_custom||'')?settings.accent_custom:null
 for(const key of ['--accent','--accent-dim','--accent-glow','--accent-text'])root.style.removeProperty(key)
 if(custom){root.style.setProperty('--accent',custom);root.style.setProperty('--accent-dim',custom+'18');root.style.setProperty('--accent-glow',custom+'26')}
}
