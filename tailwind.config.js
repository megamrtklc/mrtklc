/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      colors: {
        brand: {
          red: '#E50914',
          accent: '#F43F5E',
          dark: '#0B0D11',
          card: '#161922',
        },
        ivory: {
          50: '#FAF8F5',
          100: '#F5F2EB',
          200: '#EBE7DD',
          card: '#FFFDF9',
        },
        slateLight: {
          50: '#F4F5F7',
          100: '#EAECEF',
          200: '#D8DBE2',
          card: '#FFFFFF',
        },
      },
    },
  },
};
