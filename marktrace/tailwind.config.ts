import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      colors: {
        page: {
          light: '#F8F9FA',
          dark: '#12141A', // bitwarden dark page
        },
        card: {
          light: '#FFFFFF',
          dark: '#1C1E26', // bitwarden dark card
        },
        primary: {
          light: '#1A1A1A',
          dark: '#F0F0F0',
        },
        secondary: {
          light: '#6C757D',
          dark: '#A0A5B0',
        },
        border: {
          light: '#DEE2E6',
          dark: '#2D313A',
        },
        accent: {
          DEFAULT: '#175DDC', // bitwarden blue
          dark: '#2A72F6',
        },
        success: '#10B981',
        warning: '#F59E0B',
      },
      boxShadow: {
        card: '0 1px 3px 0 rgb(0 0 0 / 0.08), 0 1px 2px -1px rgb(0 0 0 / 0.04)',
      },
      transitionDuration: {
        theme: '150ms',
      },
    },
  },
  plugins: [],
} satisfies Config;
