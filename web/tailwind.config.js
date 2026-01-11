/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{html,js,svelte,ts}'],
  theme: {
    extend: {
      colors: {
        // Premium Solid Dark Palette
        background: '#050507', // bg-deep
        surface: '#0e0e11',    // bg-base
        raised: '#16161a',     // bg-elevated
        stroke: '#1f1f23',     // subtle borders
        
        // Custom Accents (Retaining brand colors)
        accent: '#10B981', 
        youtube: '#FF0000',
        reddit: '#FF4500',
        podcast: '#8B5CF6', 
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
