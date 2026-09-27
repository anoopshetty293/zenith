/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'fsoc-bg': '#05070c',
        'fsoc-panel': '#0d1220',
        'fsoc-border': '#1b263a',
        'fsoc-cyan': '#5cd8f0',
        'fsoc-blue': '#7a8cff',
        'fsoc-amber': '#f0b45c',
        'fsoc-red': '#ff6b7a',
        'fsoc-green': '#69e6a6',
        'fsoc-dim': '#7c8bab',
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'Consolas', 'monospace'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'pulse-cyan': 'pulse-cyan 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'scan-line': 'scan-line 3s linear infinite',
        'beacon-pulse': 'beacon-pulse 1s ease-in-out infinite',
        'link-flow': 'link-flow 1.5s linear infinite',
      },
      keyframes: {
        'pulse-cyan': {
          '0%, 100%': { opacity: 1 },
          '50%': { opacity: 0.5 },
        },
        'scan-line': {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100%)' },
        },
        'beacon-pulse': {
          '0%, 100%': { boxShadow: '0 0 4px #00d4ff' },
          '50%': { boxShadow: '0 0 12px #00d4ff, 0 0 24px #00d4ff44' },
        },
        'link-flow': {
          '0%': { strokeDashoffset: 0 },
          '100%': { strokeDashoffset: -20 },
        },
      },
    },
  },
  plugins: [],
}
