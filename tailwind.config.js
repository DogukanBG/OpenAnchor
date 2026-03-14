/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['IBM Plex Sans', 'sans-serif'],
        mono: ['IBM Plex Mono', 'monospace'],
        display: ['Syne', 'sans-serif']
      },
      colors: {
        surface: {
          DEFAULT: '#0d1117',
          1: '#161b22',
          2: '#1c2128',
          3: '#262d36'
        },
        border: { DEFAULT: '#2a3140', bright: '#3d4a5c' },
        accent: {
          DEFAULT: '#3dd68c',
          dim: '#1a4a35',
          glow: 'rgba(61,214,140,0.15)'
        },
        loss: { DEFAULT: '#f97066', dim: '#4a1a1a', glow: 'rgba(249,112,102,0.15)' },
        warn: { DEFAULT: '#f0b429', dim: '#4a3a10' },
        muted: '#5c6b7a',
        text: { DEFAULT: '#e2e8f0', dim: '#94a3b8', bright: '#f8fafc' }
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.4s cubic-bezier(0.16,1,0.3,1)',
        'pulse-slow': 'pulse 3s ease-in-out infinite'
      },
      keyframes: {
        fadeIn: { from: { opacity: 0 }, to: { opacity: 1 } },
        slideUp: { from: { opacity: 0, transform: 'translateY(12px)' }, to: { opacity: 1, transform: 'translateY(0)' } }
      }
    }
  },
  plugins: []
}
