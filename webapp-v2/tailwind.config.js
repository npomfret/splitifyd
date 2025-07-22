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
      }
    },
  },
  plugins: [],
}