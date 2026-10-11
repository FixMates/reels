/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        studio: {
          950: '#070b14',
          900: '#0b1120',
          850: '#0f172a',
          800: '#1e293b',
          700: '#334155',
          600: '#475569',
          500: '#64748b',
          accent: '#38bdf8',
          accentHover: '#0ea5e9',
          gold: '#facc15',
          success: '#10b981',
          danger: '#ef4444',
          purple: '#a855f7'
        }
      }
    },
  },
  plugins: [],
}
