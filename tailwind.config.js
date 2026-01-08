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
          50: '#faf7f0',
          100: '#f5eed9',
          200: '#e8d9b0',
          300: '#d9c081',
          400: '#cda656',
          500: '#c19440',
          600: '#a57634',
          700: '#865a2d',
          800: '#70492a',
          900: '#603e27',
        },
        dark: {
          50: '#f6f7f9',
          100: '#eceef2',
          200: '#d5dae2',
          300: '#b0bac9',
          400: '#8595ab',
          500: '#667790',
          600: '#515f77',
          700: '#424d61',
          800: '#394252',
          900: '#2f3541',
          950: '#1a1d24',
        }
      },
    },
  },
  plugins: [],
}
