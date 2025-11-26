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
                'interactive-secondary-foreground': 'rgb(var(--interactive-secondary-foreground-rgb, 255 255 255) / <alpha-value>)',
                'interactive-accent': 'rgb(var(--interactive-accent-rgb, 34 197 94) / <alpha-value>)',
                'semantic-success': 'rgb(var(--semantic-success-rgb, 22 163 74) / <alpha-value>)',
                'semantic-warning': 'rgb(var(--semantic-warning-rgb, 234 179 8) / <alpha-value>)',
                'semantic-error': 'rgb(var(--semantic-error-rgb, 220 38 38) / <alpha-value>)',
                'surface-warning': 'rgb(var(--surface-warning-rgb, 254 252 232) / <alpha-value>)',
                'surface-error': 'rgb(var(--surface-error-rgb, 254 226 226) / <alpha-value>)',
                'border-default': 'rgb(var(--border-default-rgb, 226 232 240) / <alpha-value>)',
                'border-strong': 'rgb(var(--border-strong-rgb, 148 163 184) / <alpha-value>)',
                'border-warning': 'rgb(var(--border-warning-rgb, 250 204 21) / <alpha-value>)',
                'border-error': 'rgb(var(--border-error-rgb, 248 180 180) / <alpha-value>)',
            },
            spacing: {
                xs: 'var(--spacing-xs, 0.25rem)',
                sm: 'var(--spacing-sm, 0.5rem)',
                md: 'var(--spacing-md, 0.75rem)',
                lg: 'var(--spacing-lg, 1rem)',
                xl: 'var(--spacing-xl, 1.5rem)',
            },
            borderRadius: {
                sm: 'var(--radii-sm, 0.25rem)',
                md: 'var(--radii-md, 0.5rem)',
                lg: 'var(--radii-lg, 1rem)',
                full: 'var(--radii-full, 9999px)',
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
