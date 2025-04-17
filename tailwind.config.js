/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}', './src/**/*.css'],
  theme: {
    screens: {
      'xs': '420px',
      'sm': '640px',
      'md': '768px',
      'lg': '1024px',
      'xl': '1280px',
      '2xl': '1536px',
    },
    extend: {
      colors: {
        violet: {
          800: '#6C46E5',  // Couleur plus proche du bleu-violet de l'après-midi, harmonisée avec ThemeColors.css
        },
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        dropdown: {
          '0%': { opacity: '0', transform: 'translateY(-5px) scale(0.98)' },
          '40%': { opacity: '1', transform: 'translateY(0) scale(1.01)' },
          '70%': { transform: 'scale(0.99)' },
          '100%': { transform: 'scale(1)' },
        }
      },
      animation: {
        fadeIn: 'fadeIn 0.3s ease-out forwards',
        float: 'float 3s ease-in-out infinite',
        dropdown: 'dropdown 0.2s ease-out forwards',
      },
      typography: {
        DEFAULT: {
          css: {
            maxWidth: '65ch',
            color: '#374151',
            p: {
              marginTop: '1.25em',
              marginBottom: '1.25em',
              lineHeight: '1.75',
            },
            h2: {
              marginTop: '2em',
              marginBottom: '1em',
              fontSize: '1.5em',
              fontWeight: '600',
            },
            ul: {
              marginTop: '1.25em',
              marginBottom: '1.25em',
              paddingLeft: '1.625em',
            },
            li: {
              marginTop: '0.5em',
              marginBottom: '0.5em',
            },
          },
        },
      },
    },
  },
  plugins: [],
};
