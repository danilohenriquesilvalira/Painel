const { heroui } = require("@heroui/react");

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
    // HeroUI - necessário para os componentes funcionarem
    './node_modules/@heroui/theme/dist/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // CORES OFICIAIS EDP - BRAND GUIDELINES MARCH 2023

        // Paleta da Web (Tons corrigidos)
        'edp-electric': {
          DEFAULT: '#28FF52',
          100: '#D4FFDD',
          200: '#A9FFBA',
          300: '#7EFF97',
        },
        'edp-marine': {
          DEFAULT: '#212E3E',
          100: '#424D5B',
          200: '#646D78',
          300: '#90979F',
        },
        'edp-spruce': {
          DEFAULT: '#143F47',
          100: '#365960',
          200: '#5B797E',
        },
        'edp-seaweed': {
          DEFAULT: '#225E66',
          100: '#43767D',
        },
        'edp-slate': {
          DEFAULT: '#7C9599',
          100: '#90A5A8',
        },
        'edp-violet': {
          DEFAULT: '#6D32FF',
          100: '#8351FF',
          200: '#A784FF',
          300: '#C5ADFF',
        },
        'edp-ice': {
          DEFAULT: '#0CD3F8',
          100: '#3DDCF9',
          200: '#6DE5FB',
          300: '#9EEDFC',
        },
        'edp-cobalt': {
          DEFAULT: '#263CC8',
          100: '#4759D0',
          200: '#7D8ADE',
          300: '#A8B1E9',
        },

        // Paleta Semântica (Cores de advertência corrigidas e expandidas)
        'edp-semantic': {
          'red': '#E32C2C',
          'light-red': '#EDD5D3',
          'yellow': '#F7D200',
          'light-yellow': '#FFF1BE',
          'blue': '#263CC8',
          'light-blue': '#A8B1E9',
          'green': '#225E66',
          'light-green': '#91AFB3',
        },

        // WORDMARK ONLY - NÃO FAZ PARTE DA PALETA
        'edp-wordmark': '#3B4B5D',

        // Paleta Neutra (Tons corrigidos)
        'edp-neutral': {
          'darkest': '#222222',
          'darker': '#455558',
          'dark': '#7C9599',
          'medium': '#90A5A8',
          'light': '#A3B5B8',
          'lighter': '#BECACC',
          'lightest': '#D7DFE0',
          'white-tint': '#E6EBEC',
          'white-wash': '#F1F4F4',
        },

        white: '#FFFFFF',
        black: '#000000',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.4s ease-out',
        'scale-in': 'scaleIn 0.2s ease-out',
        'pulse-subtle': 'pulseSubtle 2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        pulseSubtle: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.7' },
        },
      },
      fontFamily: {
        'sans': ['Mulish', 'sans-serif'],
        'edp': ['Mulish', 'sans-serif'],
        'display': ['Mulish', 'sans-serif'],
        'body': ['Mulish', 'sans-serif'],
        'mono': ['JetBrains Mono', 'SF Mono', 'Monaco', 'Consolas', 'monospace'],
        'tech': ['JetBrains Mono', 'SF Mono', 'Monaco', 'Consolas', 'monospace'],
      },
    },
  },
  darkMode: "class",
  plugins: [
    heroui({
      themes: {
        light: {
          colors: {
            primary: {
              50: '#E6EBEC',
              100: '#90979F',
              200: '#646D78',
              300: '#424D5B',
              400: '#374554',
              500: '#212E3E',
              600: '#1B2633',
              700: '#151E28',
              800: '#0F161D',
              900: '#090E12',
              DEFAULT: '#212E3E',
              foreground: '#FFFFFF',
            },
            success: {
              50: '#D4FFDD',
              100: '#A9FFBA',
              200: '#7EFF97',
              300: '#53FF74',
              400: '#28FF52',
              500: '#28FF52',
              600: '#20CC42',
              700: '#189931',
              800: '#106621',
              900: '#083310',
              DEFAULT: '#28FF52',
              foreground: '#212E3E',
            },
            danger: {
              DEFAULT: '#E32C2C',
              foreground: '#FFFFFF',
            },
            warning: {
              DEFAULT: '#F7D200',
              foreground: '#212E3E',
            },
          },
        },
      },
    }),
  ],
}
