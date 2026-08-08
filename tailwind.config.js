/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['Fredoka', 'sans-serif'],
        body: ['Inter', 'sans-serif']
      },
      colors: {
        linen: {
          50: '#FBFAF7',
          100: '#F6F3EE',
          200: '#EDE8DE'
        },
        plum: {
          50: '#F1EEF9',
          100: '#DCD4EF',
          300: '#9C89CC',
          500: '#5B4B8A',
          600: '#4A3B73',
          700: '#3A2E5C'
        },
        mustard: {
          100: '#FBEACB',
          400: '#E8A33D',
          500: '#D6912E'
        },
        sage: {
          100: '#DFEEE3',
          500: '#4F9D69'
        },
        clay: {
          100: '#F6DAD4',
          500: '#D0574A'
        },
        charcoal: {
          900: '#1E1B24',
          800: '#282433',
          700: '#332E42'
        }
      },
      borderRadius: {
        xl2: '1.25rem'
      }
    }
  },
  plugins: []
}
