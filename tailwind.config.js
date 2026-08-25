/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Baloo 2"', 'sans-serif'],
        body: ['"Plus Jakarta Sans"', 'sans-serif']
      },
      colors: {
        // Fondo / superficie
        cream: {
          50: '#FFFDF9',
          100: '#FBF4E9',
          200: '#F3E7D3'
        },
        // Primario — Convive
        violet: {
          50: '#F1EDFC',
          100: '#E1D8F8',
          300: '#A78EEA',
          500: '#6B4FE0',
          600: '#5A3FC7',
          700: '#4630A0'
        },
        // Secundario
        coral: {
          100: '#FFE1D6',
          400: '#FF8563',
          500: '#FF6B4A'
        },
        // Convis / recompensas
        gold: {
          100: '#FCEBBE',
          400: '#F5B942',
          500: '#E0A32C'
        },
        // Éxito
        sage: {
          100: '#DCEEE1',
          500: '#3FAE6A'
        },
        // Error
        clay: {
          100: '#FBDCD3',
          500: '#E8503A'
        },
        // Info
        sky: {
          100: '#E1E9FF',
          500: '#4C7FFF'
        },
        // Texto / estructura oscura
        ink: {
          900: '#17131C',
          800: '#231D2B',
          700: '#332B3D'
        }
      },
      borderRadius: {
        xl2: '1.15rem'
      }
    }
  },
  plugins: []
}
