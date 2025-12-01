/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        romantic: {
          dark: '#0a0e1a',
          soft: '#141b2d',
          light: '#1e2a3f',
          accent: '#00d4ff',
          glow: '#2E64FE',
        },
      },
      animation: {
        'firefly': 'firefly 5s ease-in-out infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
        'float': 'float 3s ease-in-out infinite',
        'pulse-soft': 'pulse-soft 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        firefly: {
          '0%, 100%': { opacity: '0', transform: 'translateY(0) scale(0.5)' },
          '50%': { opacity: '1', transform: 'translateY(-100px) scale(1)' },
        },
        glow: {
          '0%': { opacity: '0.5', boxShadow: '0 0 10px rgba(255, 107, 157, 0.3)' },
          '100%': { opacity: '1', boxShadow: '0 0 20px rgba(255, 107, 157, 0.6)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        'pulse-soft': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.7' },
        },
      },
    },
  },
  plugins: [],
};



