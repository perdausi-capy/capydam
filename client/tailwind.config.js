/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        heading: ['Poppins', 'sans-serif'],
      },
      colors: {
        primary: {
          DEFAULT: '#3B73B9',
          light: '#5A8ED1',
          dark: '#2A5691',
        },
        accent: {
          1: '#FFD166', // Yellow
          2: '#06D6A0', // Teal
        },
        neutral: {
          dark: '#1A1D21',
          mid: '#3A3F45',
          light: '#F2F4F7',
          surface: '#FFFFFF',
        }
      },
      boxShadow: {
        'glow': '0 0 20px rgba(59, 115, 185, 0.5)', // Primary color glow
        'glass': '0 8px 32px 0 rgba(31, 38, 135, 0.07)',
      },
      animation: {
        'blob': 'blob 7s infinite',
        'float': 'float 6s ease-in-out infinite',
      },
      keyframes: {
        blob: {
          '0%': { transform: 'translate(0px, 0px) scale(1)' },
          '33%': { transform: 'translate(30px, -50px) scale(1.1)' },
          '66%': { transform: 'translate(-20px, 20px) scale(0.9)' },
          '100%': { transform: 'translate(0px, 0px) scale(1)' },
        },
        float: {
            '0%, 100%': { transform: 'translateY(0)' },
            '50%': { transform: 'translateY(-20px)' },
        }
      }
    },
  },
  plugins: [],
}