/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Karla', 'sans-serif'],
        mono: ['ui-monospace', 'monospace'],
        display: ['Karla', '-apple-system', 'sans-serif']
      },
      borderRadius: {
        lg:  '0.3rem',
        xl:  '0.4rem',
        '2xl': '0.55rem',
        '3xl': '0.75rem'
      },
      boxShadow: {
        lg: '0 4px 10px rgba(0,0,0,0.15)',
        xl: '0 6px 14px rgba(0,0,0,0.18)',
        '2xl': '0 10px 20px rgba(0,0,0,0.22)'
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
        bar: {
          text: 'var(--bar-text)',
          dim: 'var(--bar-text-dim)'
        },
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
