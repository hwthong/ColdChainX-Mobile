/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './components/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        'brown-dark': '#3A1F04',
        'brown-light': '#8B4513',
        'green-brand': '#99CC33',
      },
    },
  },
  plugins: [],
};
