/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{html,js,svelte,ts}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Dynamic theme colors using CSS variables
        background: 'var(--tw-colors-background)',
        surface: 'var(--tw-colors-surface)',
        raised: 'var(--tw-colors-raised)',
        stroke: 'var(--tw-colors-stroke)',
        accent: 'var(--tw-colors-accent)',

        // Dark theme (default)
        DEFAULT: '#050507',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
      }
    },
  },
  plugins: [],
}
