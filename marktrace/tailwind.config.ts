import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './admin.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Work Sans', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      colors: {
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        muted: {
          DEFAULT: 'var(--muted)',
          foreground: 'var(--muted-foreground)',
        },
        card: {
          DEFAULT: 'var(--card)',
          elevated: 'var(--card-elevated)',
        },
        border: {
          DEFAULT: 'var(--border)',
          strong: 'var(--border-strong)',
        },
        input: 'var(--input)',
        ring: 'var(--ring)',
        primary: {
          DEFAULT: 'var(--color-primary)',
          glow: 'var(--color-primary-glow)',
          foreground: 'var(--primary-foreground)',
          subtle: 'var(--primary-subtle)',
          border: 'var(--primary-border)',
          ring: 'var(--primary-ring)',
        },
        accent: 'var(--color-primary)',
        destructive: {
          DEFAULT: 'var(--destructive)',
          subtle: 'var(--destructive-subtle)',
          border: 'var(--destructive-border)',
        },
        success: {
          DEFAULT: 'var(--success)',
          subtle: 'var(--success-subtle)',
          border: 'var(--success-border)',
        },
        warning: {
          DEFAULT: 'var(--warning)',
          subtle: 'var(--warning-subtle)',
          border: 'var(--warning-border)',
        },
        overlay: 'var(--overlay)',
      },
      borderRadius: {
        DEFAULT: 'var(--radius)',
        lg: 'var(--radius)',
        xl: 'calc(var(--radius) + 4px)',
      },
      boxShadow: {
        card: '0 1px 3px 0 oklch(0 0 0 / 8%), 0 1px 2px -1px oklch(0 0 0 / 4%)',
        panel: '0 12px 40px -12px oklch(0 0 0 / 60%)',
      },
      transitionDuration: {
        theme: '150ms',
      },
    },
  },
  plugins: [],
} satisfies Config;
