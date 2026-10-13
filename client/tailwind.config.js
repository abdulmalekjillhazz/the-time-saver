/** @type {import('tailwindcss').Config} */
// Colours come from CSS variables in app/globals.css, so light and dark themes share one set of names.
const token = (name) => `rgb(var(--c-${name}) / <alpha-value>)`;

export default {
  content: ['./app/**/*.{js,jsx}', './components/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        paper: token('paper'),
        ink: token('ink'),
        sapphire: token('sapphire'),
        'sapphire-deep': token('sapphire-deep'),
        gold: token('gold'),
        'gold-soft': token('gold-soft'),
        azure: token('azure'),
        'on-sapphire': token('on-sapphire'),
        'on-gold': token('on-gold'),
      },
      borderRadius: {
        md: 'var(--radius-md)',
      },
    },
  },
  plugins: [],
};
