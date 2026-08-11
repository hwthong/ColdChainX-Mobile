/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './components/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        // Web Blue Palette Semantic Tokens (source of truth: constants/colors.ts)
        primary: {
          DEFAULT: '#367eb8',
          pressed: '#276497',
          dark: '#173b59',
          navy: '#173b59',
          soft: '#e2eff8',
          foreground: '#f8fcff',
        },
        surface: {
          DEFAULT: '#ffffff',
          page: '#eef6fc',
          card: '#ffffff',
          soft: '#fafdff',
          muted: '#eaf3f9',
        },
        border: {
          DEFAULT: '#ccdfec',
          strong: '#bdd6e7',
          focus: '#72a9d2',
          selected: '#367eb8',
        },
        text: {
          primary: '#173b59',
          secondary: '#607b90',
          muted: '#7898b3',
          brand: '#2878bf',
        },
        muted: '#eaf3f9',
      },
    },
  },
  plugins: [],
};
