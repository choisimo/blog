import type { Config } from 'tailwindcss';
import tailwindcssAnimate from 'tailwindcss-animate';
import { fontFamily } from 'tailwindcss/defaultTheme';

export default {
  darkMode: ['class'],
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
    './src/**/*.{md,mdx}',
    './public/posts/**/*.{md,mdx}',
  ],
  prefix: '',
  theme: {
    container: {
      center: true,
      padding: '1rem',
      screens: {
        '2xl': '1400px',
      },
    },
    extend: {
      fontFamily: {
        sans: ['Pretendard', ...fontFamily.sans],
        mono: ['JetBrains Mono', ...fontFamily.mono],
      },
      colors: {
        // Fieldnotes paper/ink shades; terminal restores its original neutral scale.
        slate: Object.fromEntries([50,100,200,300,400,500,600,700,800,900,950].map(shade => [shade, `hsl(var(--fn-slate-${shade}) / <alpha-value>)`])),
        zinc: Object.fromEntries([50,100,200,300,400,500,600,700,800,900,950].map(shade => [shade, `hsl(var(--fn-zinc-${shade}) / <alpha-value>)`])),

        // Namespaced tokens: legacy accent/surface variables retain their HSL semantics.
        ui: {
          'canvas': 'hsl(var(--ui-canvas) / <alpha-value>)',
          'surface': 'hsl(var(--ui-surface) / <alpha-value>)',
          'soft': 'hsl(var(--ui-soft) / <alpha-value>)',
          'text': 'hsl(var(--ui-text) / <alpha-value>)',
          'muted': 'hsl(var(--ui-muted) / <alpha-value>)',
          'subtle': 'hsl(var(--ui-subtle) / <alpha-value>)',
          'line': 'hsl(var(--ui-line) / <alpha-value>)',
          'line-strong': 'hsl(var(--ui-line-strong) / <alpha-value>)',
          'accent': 'hsl(var(--ui-accent) / <alpha-value>)',
          'accent-soft': 'hsl(var(--ui-accent-soft) / <alpha-value>)',
          'danger': 'hsl(var(--ui-danger) / <alpha-value>)',
          'danger-soft': 'hsl(var(--ui-danger-soft) / <alpha-value>)',
          'success': 'hsl(var(--ui-success) / <alpha-value>)',
          'warn': 'hsl(var(--ui-warn) / <alpha-value>)',
          'code-bg': 'hsl(var(--ui-code-bg) / <alpha-value>)',
        },

        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        sidebar: {
          DEFAULT: 'hsl(var(--sidebar-background))',
          foreground: 'hsl(var(--sidebar-foreground))',
          primary: 'hsl(var(--sidebar-primary))',
          'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
          accent: 'hsl(var(--sidebar-accent))',
          'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
          border: 'hsl(var(--sidebar-border))',
          ring: 'hsl(var(--sidebar-ring))',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      keyframes: {
        'accordion-down': {
          from: {
            height: '0',
          },
          to: {
            height: 'var(--radix-accordion-content-height)',
          },
        },
        'accordion-up': {
          from: {
            height: 'var(--radix-accordion-content-height)',
          },
          to: {
            height: '0',
          },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
      transitionTimingFunction: {
        spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
        smooth: 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
    },
  },
  plugins: [tailwindcssAnimate],
} satisfies Config;
