/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#C01A2A',
        'primary-dark': '#9B1520',
        'primary-light': '#E8202F',
      },
    },
  },
  plugins: [],
}

