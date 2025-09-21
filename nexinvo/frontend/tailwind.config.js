/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f0f7ff',
          100: '#e0efff',
          200: '#bae1ff',
          300: '#7cc8ff',
          400: '#36abff',
          500: '#0891b2',
          600: '#1B365D',
          700: '#2E5984',
          800: '#1e3a8a',
          900: '#1e3a8a',
        },
        accent: {
          500: '#D4AF37',
          600: '#B8941F',
        }
      },
      fontFamily: {
        sans: ['Arial', 'sans-serif'],
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
  ],
}