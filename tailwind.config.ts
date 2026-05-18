import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  safelist: [
    'cefr-A1','cefr-A2','cefr-B1','cefr-B2','cefr-C1','cefr-C2',
    'badge-green','badge-blue','badge-amber','badge-red','badge-purple','badge-gray',
    'text-green-700','text-amber-700','text-red-600','text-blue-700',
    'bg-green-500','bg-amber-400','bg-red-400','bg-blue-400',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#f5eefb',
          100: '#e6d1f5',
          200: '#d0a8ee',
          300: '#b97ce5',
          400: '#a356da',
          500: '#8a33cc',
          600: '#742ab0',
          700: '#642f8d',
          800: '#4e2470',
          900: '#371852',
        },
      },
      fontFamily: {
        sans: ['var(--font-geist-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-geist-mono)', 'monospace'],
      },
    },
  },
  plugins: [],
}

export default config
