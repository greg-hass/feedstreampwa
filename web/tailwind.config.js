/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{html,js,svelte,ts}'],
  theme: {
    extend: {
      colors: {
        // Premium Dark Backgrounds
        background: '#050507', // bg0
        surface: '#0e0e11',    // bg1
        
        // Custom Accents
        youtube: '#FF0000',
        reddit: '#FF4500',
        podcast: '#8B5CF6', // Violet
        
        // Glass/Border colors
        glass: 'rgba(255, 255, 255, 0.05)',
        border: 'rgba(255, 255, 255, 0.1)',
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
