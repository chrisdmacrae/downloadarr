/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  prefix: "",
  theme: {
    // No content max width — pages run edge to edge behind the top nav and use
    // the page gutter directly.
    extend: {
      colors: {
        // shadcn/ui semantic slots, mapped in index.css onto the ink ramp.
        border: 'hsl(var(--border) / 0.11)',
        input: 'hsl(var(--input) / 0.11)',
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
          DEFAULT: 'hsl(var(--accent-hsl))',
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

        // The ink ramp itself.
        ink: {
          950: 'var(--ink-950)',
          900: 'var(--ink-900)',
          850: 'var(--ink-850)',
          800: 'var(--ink-800)',
          750: 'var(--ink-750)',
          700: 'var(--ink-700)',
          600: 'var(--ink-600)',
          500: 'var(--ink-500)',
          400: 'var(--ink-400)',
          300: 'var(--ink-300)',
          200: 'var(--ink-200)',
          100: 'var(--ink-100)',
          50: 'var(--ink-050)',
        },

        // Brand red — the only chroma in the system.
        brand: {
          600: 'var(--brand-600)',
          500: 'var(--brand-500)',
          400: 'var(--brand-400)',
          300: 'var(--brand-300)',
          tint: 'var(--brand-tint-16)',
          soft: 'var(--brand-tint-08)',
        },

        surface: {
          app: 'var(--surface-app)',
          sunken: 'var(--surface-sunken)',
          1: 'var(--surface-1)',
          2: 'var(--surface-2)',
          card: 'var(--surface-card)',
          'card-hover': 'var(--surface-card-hover)',
          raised: 'var(--surface-raised)',
          overlay: 'var(--surface-overlay)',
          input: 'var(--surface-input)',
          'input-hover': 'var(--surface-input-hover)',
          glass: 'var(--surface-glass)',
        },

        // Text ramp. Named `fg` so utilities read `text-fg-secondary`.
        fg: {
          DEFAULT: 'var(--text-body)',
          primary: 'var(--text-primary)',
          body: 'var(--text-body)',
          secondary: 'var(--text-secondary)',
          muted: 'var(--text-muted)',
          disabled: 'var(--text-disabled)',
          accent: 'var(--text-on-accent)',
        },

        // Monochrome status tones, keyed to RequestStatus.
        status: {
          pending: 'var(--status-pending)',
          searching: 'var(--status-searching)',
          found: 'var(--status-found)',
          downloading: 'var(--status-downloading)',
          completed: 'var(--status-completed)',
          failed: 'var(--status-failed)',
          idle: 'var(--status-idle)',
        },

        tone: {
          brightest: 'var(--tone-brightest)',
          bright: 'var(--tone-bright)',
          mid: 'var(--tone-mid)',
          dim: 'var(--tone-dim)',
          dimmest: 'var(--tone-dimmest)',
        },
      },

      borderColor: {
        hairline: 'var(--border-hairline)',
        subtle: 'var(--border-subtle)',
        strong: 'var(--border-strong)',
      },

      fontFamily: {
        sans: ['Archivo', 'Helvetica Neue', 'Arial', 'sans-serif'],
        condensed: ['Archivo Narrow', 'Archivo', 'Arial', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },

      fontSize: {
        '2xs': ['11px', { lineHeight: '1' }],
        xs: ['12px', { lineHeight: '1.3' }],
        sm: ['14px', { lineHeight: '1.6' }],
        base: ['16px', { lineHeight: '1.6' }],
        lg: ['18px', { lineHeight: '1.4' }],
        xl: ['20px', { lineHeight: '1.3' }],
        '2xl': ['24px', { lineHeight: '1.2' }],
        '3xl': ['30px', { lineHeight: '1.15' }],
        '4xl': ['38px', { lineHeight: '1.15' }],
        '5xl': ['48px', { lineHeight: '1.05' }],
        '6xl': ['64px', { lineHeight: '1' }],
      },

      letterSpacing: {
        tighter: '-0.03em',
        tight: '-0.015em',
        normal: '0',
        wide: '0.04em',
        eyebrow: '0.14em',
      },

      lineHeight: {
        none: '1',
        tight: '1.15',
        snug: '1.3',
        normal: '1.5',
        relaxed: '1.6',
      },

      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
        card: '10px',
        poster: '12px',
        overlay: '14px',
        control: '6px',
        pill: '999px',
      },

      boxShadow: {
        1: 'var(--shadow-1)',
        2: 'var(--shadow-2)',
        3: 'var(--shadow-3)',
        4: 'var(--shadow-4)',
        poster: 'var(--shadow-poster-hover)',
        glow: 'var(--shadow-accent-glow)',
        hairline: 'var(--inset-hairline)',
        focus: 'var(--focus-ring)',
      },

      spacing: {
        gutter: 'var(--page-pad-x)',
        rail: 'var(--rail-gap)',
        section: 'var(--section-gap)',
        topbar: 'var(--topbar-h)',
      },

      width: {
        'poster-sm': 'var(--poster-w-sm)',
        'poster-md': 'var(--poster-w-md)',
        'poster-lg': 'var(--poster-w-lg)',
        'settings-nav': 'var(--settings-nav-w)',
      },

      aspectRatio: {
        poster: '2 / 3',
        game: '3 / 4',
        wide: '16 / 9',
      },

      transitionDuration: {
        instant: '80ms',
        fast: '140ms',
        base: '200ms',
        slow: '320ms',
        rail: '520ms',
        hero: '600ms',
      },

      transitionTimingFunction: {
        standard: 'cubic-bezier(0.2, 0.8, 0.25, 1)',
        out: 'cubic-bezier(0.16, 1, 0.3, 1)',
        in: 'cubic-bezier(0.4, 0, 1, 1)',
      },

      backdropBlur: {
        glass: '20px',
        scrim: '6px',
      },

      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
        'pulse-dot': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.45' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'none' },
        },
      },

      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        'pulse-dot': 'pulse-dot 1.4s cubic-bezier(0.2, 0.8, 0.25, 1) infinite',
        shimmer: 'shimmer 1.6s linear infinite',
        'fade-up': 'fade-up 200ms cubic-bezier(0.16, 1, 0.3, 1)',
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}
