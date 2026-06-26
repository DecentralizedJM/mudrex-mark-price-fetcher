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
          light: '#FAFAFA',
          dark: '#0A0A0A',
        },
        card: {
          light: '#FFFFFF',
          dark: '#141414',
        },
        primary: {
          light: '#0A0A0A',
          dark: '#FAFAFA',
        },
        secondary: {
          light: '#525252',
          dark: '#A3A3A3',
        },
        border: {
          light: '#E5E5E5',
          dark: '#262626',
        },
        accent: {
          DEFAULT: '#0066FF',
          dark: '#3B82F6',
        },
        success: '#059669',
        warning: '#D97706',
      },
      boxShadow: {
        card: '0 1px 3px 0 rgb(0 0 0 / 0.06), 0 1px 2px -1px rgb(0 0 0 / 0.06)',
      },
      transitionDuration: {
        theme: '150ms',
      },
    },
  },
  plugins: [],
} satisfies Config;
