import path from 'node:path';
import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: [path.resolve(__dirname, './src/**/*.{js,ts,jsx,tsx}')],
  theme: {
    extend: {
      colors: {
        background: {
          DEFAULT: 'var(--color-bg-primary, #0f172a)',
          secondary: 'var(--color-bg-secondary, #1e293b)',
          card: 'var(--color-bg-card, rgba(30, 41, 59, 0.7))',
          container: 'var(--color-bg-container, #1e293b)',
        },
        foreground: {
          DEFAULT: 'var(--color-text-primary, #f8fafc)',
          secondary: 'var(--color-text-secondary, #94a3b8)',
          muted: 'var(--color-text-muted, #64748b)',
        },
        primary: {
          DEFAULT: 'var(--color-primary, #6366f1)',
          hover: 'var(--color-primary-hover, #4f46e5)',
          light: 'var(--color-primary-light, rgba(99, 102, 241, 0.15))',
        },
        border: 'var(--color-border, rgba(255, 255, 255, 0.1))',
        success: 'var(--color-success, #10b981)',
        warning: 'var(--color-warning, #f59e0b)',
        danger: 'var(--color-danger, #ef4444)',
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['Fira Code', 'Cascadia Code', 'JetBrains Mono', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
};

export default config;
