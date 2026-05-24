/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './client/index.html',
    './client/src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        deriv: {
          primary: '#0091ea',
          secondary: '#00c853',
          dark: '#1a1a2e',
          card: '#16213e',
          accent: '#e94560',
        },
      },
    },
  },
  plugins: [],
};
