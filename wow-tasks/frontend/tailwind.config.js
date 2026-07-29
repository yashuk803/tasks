/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          dark:    '#1d5d86',  // primary dark blue
          teal:    '#00b6be',  // teal
          light:   '#6bcbe0',  // light cyan
          amber:   '#f9a21a',  // accent orange
          black:   '#071412',  // near black
        },
      },
      fontFamily: {
        sans:  ['Proxima Nova', 'Inter', 'system-ui', 'sans-serif'],
        serif: ['PT Serif', 'Georgia', 'serif'],
      },
    },
  },
  plugins: [require('@tailwindcss/forms')],
};
