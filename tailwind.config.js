/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        chrome: {
          900: '#202124', // Background
          800: '#292a2d', // Surface/Cards
          700: '#35363a', // Hover states
          600: '#5f6368', // Borders
          300: '#9aa0a6', // Secondary Text
          100: '#e8eaed', // Primary Text
        },
        accent: {
          DEFAULT: '#8ab4f8', // Link/Action blue
          hover: '#aecbfa',
        }
      }
    }
  },
  plugins: [],
}