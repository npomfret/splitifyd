/** @type {import('tailwindcss').Config} */
export default {
    content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
    theme: {
        extend: {
            colors: {
                // Semantic surfaces / text
                'surface-base': 'rgb(var(--surface-base-rgb, 255 255 255) / <alpha-value>)',
                'surface-muted': 'rgb(var(--surface-muted-rgb, 245 247 251) / <alpha-value>)',
                'surface-raised': 'rgb(var(--surface-raised-rgb, 250 250 255) / <alpha-value>)',
                'text-primary': 'rgb(var(--text-primary-rgb, 15 23 42) / <alpha-value>)',
                'text-muted': 'rgb(var(--text-muted-rgb, 71 85 105) / <alpha-value>)',
                'text-inverted': 'rgb(var(--text-inverted-rgb, 255 255 255) / <alpha-value>)',
                'interactive-primary': 'rgb(var(--interactive-primary-rgb, 37 99 235) / <alpha-value>)',
                'interactive-primary-foreground': 'rgb(var(--interactive-primary-foreground-rgb, 255 255 255) / <alpha-value>)',
                'interactive-secondary': 'rgb(var(--interactive-secondary-rgb, 124 58 237) / <alpha-value>)',
                'border-default': 'rgb(var(--border-default-rgb, 226 232 240) / <alpha-value>)',
                'border-strong': 'rgb(var(--border-strong-rgb, 148 163 184) / <alpha-value>)',

                // Legacy brand palette (kept for transitional components)
                primary: {
                    DEFAULT: 'rgb(var(--brand-primary-rgb, 124 58 237))',
                    dark: 'rgb(var(--brand-secondary-rgb, 109 40 217))',
                    light: 'rgb(var(--brand-primary-rgb, 139 92 246))',
                    50: 'color-mix(in srgb, rgb(var(--brand-primary-rgb)) 10%, white)',
                    100: 'color-mix(in srgb, rgb(var(--brand-primary-rgb)) 20%, white)',
                    200: 'color-mix(in srgb, rgb(var(--brand-primary-rgb)) 40%, white)',
                    300: 'color-mix(in srgb, rgb(var(--brand-primary-rgb)) 60%, white)',
                    400: 'color-mix(in srgb, rgb(var(--brand-primary-rgb)) 80%, white)',
                    500: 'rgb(var(--brand-primary-rgb))',
                    600: 'rgb(var(--brand-primary-rgb))',
                    700: 'rgb(var(--brand-secondary-rgb))',
                    800: 'color-mix(in srgb, rgb(var(--brand-secondary-rgb)) 80%, black)',
                    900: 'color-mix(in srgb, rgb(var(--brand-secondary-rgb)) 60%, black)',
                },
            },
            spacing: {
                xs: 'var(--spacing-xs, 0.25rem)',
                sm: 'var(--spacing-sm, 0.5rem)',
                md: 'var(--spacing-md, 0.75rem)',
                lg: 'var(--spacing-lg, 1rem)',
                xl: 'var(--spacing-xl, 1.5rem)',
            },
            borderRadius: {
                sm: 'var(--radius-sm, 0.25rem)',
                md: 'var(--radius-md, 0.5rem)',
                lg: 'var(--radius-lg, 1rem)',
                full: 'var(--radius-full, 9999px)',
            },
            fontSize: {
                xs: ['var(--text-xs, 0.75rem)', 'var(--text-leading-xs, 1rem)'],
                sm: ['var(--text-sm, 0.875rem)', 'var(--text-leading-sm, 1.25rem)'],
                base: ['var(--text-base, 1rem)', 'var(--text-leading-base, 1.5rem)'],
                lg: ['var(--text-lg, 1.125rem)', 'var(--text-leading-lg, 1.75rem)'],
                xl: ['var(--text-xl, 1.25rem)', 'var(--text-leading-xl, 1.75rem)'],
            },
            boxShadow: {
                sm: 'var(--shadow-sm, 0 1px 2px rgba(15, 23, 42, 0.12))',
                md: 'var(--shadow-md, 0 4px 12px rgba(15, 23, 42, 0.12))',
                lg: 'var(--shadow-lg, 0 20px 60px rgba(15, 23, 42, 0.15))',
            },
            keyframes: {
                'slide-up': {
                    '0%': { transform: 'translateY(100%)', opacity: '0' },
                    '100%': { transform: 'translateY(0)', opacity: '1' },
                },
            },
            animation: {
                'slide-up': 'slide-up 0.3s ease-out',
            },
        },
    },
    plugins: [],
};
