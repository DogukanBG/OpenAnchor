import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react(), {name:'development-csp',transformIndexHtml(html,ctx){return ctx.server?html.replace(/<meta http-equiv="Content-Security-Policy"[^>]*>/,''):html}}],
  base: './',
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, './src') }
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true
  },
  server: {
    port: 5173,
    strictPort: true
  }
})
