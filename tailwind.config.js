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
          DEFAULT: 'var(--surface)',
          1: 'var(--surface-1)',
          2: 'var(--surface-2)',
          3: 'var(--surface-3)'
        },
        border: {
          DEFAULT: 'var(--border)',
          bright: 'var(--border-bright)'
        },
        accent: {
          DEFAULT: 'var(--accent)',
          dim: 'var(--accent-dim)',
          glow: 'var(--accent-glow)'
        },
        loss: {
          DEFAULT: 'var(--loss)',
          dim: 'var(--loss-dim)'
        },
        warn: {
          DEFAULT: 'var(--warn)',
          dim: 'var(--warn-dim, #4a3a10)'
        },
        muted: 'var(--text-muted)',
        text: {
          DEFAULT: 'var(--text)',
          dim: 'var(--text-dim)',
          bright: 'var(--text-bright)'
        }
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.4s cubic-bezier(0.16,1,0.3,1)',
        'pulse-slow': 'pulse 3s ease-in-out infinite'
      },
      keyframes: {
        fadeIn: { from: { opacity: 0 }, to: { opacity: 1 } },
        slideUp: {
          from: { opacity: 0, transform: 'translateY(12px)' },
          to:   { opacity: 1, transform: 'translateY(0)' }
        }
      }
    }
  },
  plugins: []
}
