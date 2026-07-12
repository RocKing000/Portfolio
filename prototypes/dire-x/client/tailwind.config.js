/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        dire: {
          dark: '#0a0f1a',
          panel: '#111827',
          card: '#1a2332',
          accent: '#00d4ff',
          warning: '#ff6b35',
          danger: '#ef4444',
          success: '#22c55e',
          muted: '#64748b',
        },
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
    },
  },
  plugins: [],
};
