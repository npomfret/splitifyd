/** @type {import('tailwindcss').Config} */
export default {
    content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
    theme: {
        extend: {
            colors: {
                // Dynamically use tenant branding colors via CSS variables
                primary: {
                    DEFAULT: 'rgb(var(--brand-primary-rgb, 124 58 237))', // Fallback to purple
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
