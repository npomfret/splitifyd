/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Port colors from existing webapp
        primary: {
          DEFAULT: '#7c3aed', // Purple from screenshots
          dark: '#6d28d9',
          light: '#8b5cf6'
        }
      },
      keyframes: {
        'slide-up': {
          '0%': { transform: 'translateY(100%)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' }
        }
      },
      animation: {
        'slide-up': 'slide-up 0.3s ease-out'
      }
    },
  },
  plugins: [],
}