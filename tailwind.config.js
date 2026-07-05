/* eslint-disable no-undef */
/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        geist: ['Geist', 'serif'],
      },
      colors: {
        alias: 'var(--color-alias)',
        aliasSecondary: '#12DCB0',
        muted: '#FFFFFF66',
        lightWhite: '#FFFFFF0D',
        borderWhite: '#FFFFFF05',
        danger: '#E23B3E',
        white: '#FFFFFF',
        black: '#0C0C0C',

        // Theme-aware colors
        primary: 'var(--color-primary)',

        background: 'var(--color-background)',
        backgroundSecondary: 'var(--color-backgroundSecondary)',

        foreground: 'var(--color-foreground)',
        foregroundSecondary: 'var(--color-foregroundSecondary)',

        primaryForeground: 'var(--color-primaryForeground)',
        primaryMuted: 'var(--color-primaryMuted)',

        border: 'var(--color-border)',
        borderSecondary: 'var(--color-borderSecondary)',

        mutedForeground: 'var(--color-mutedForeground)',

        accent: 'var(--color-accent)',
        accentForeground: 'var(--color-accentForeground)',

        destructive: 'var(--color-destructive)',
        destructiveForeground: 'var(--color-destructiveForeground)',

        success: 'var(--color-success)',
        successForeground: 'var(--color-successForeground)',

        warning: 'var(--color-warning)',
        warningForeground: 'var(--color-warningForeground)',

        info: 'var(--color-info)',
        infoForeground: 'var(--color-infoForeground)',

        // Ring color for focus states
        ring: 'var(--color-primary)',
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic':
          'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
        'background-gradient':
          'linear-gradient(to bottom right, var(--color-alias) 0%, #12DCB0 100%)',
      },
      animation: {
        first: 'moveVertical 30s ease infinite',
        second: 'moveInCircle 20s reverse infinite',
        third: 'moveInCircle 40s linear infinite',
        fourth: 'moveHorizontal 40s ease infinite',
        fifth: 'moveInCircle 20s ease infinite',
      },
      keyframes: {
        moveHorizontal: {
          '0%': {
            transform: 'translateX(-50%) translateY(-10%)',
          },
          '50%': {
            transform: 'translateX(50%) translateY(10%)',
          },
          '100%': {
            transform: 'translateX(-50%) translateY(-10%)',
          },
        },
        moveInCircle: {
          '0%': {
            transform: 'rotate(0deg)',
          },
          '50%': {
            transform: 'rotate(180deg)',
          },
          '100%': {
            transform: 'rotate(360deg)',
          },
        },
        moveVertical: {
          '0%': {
            transform: 'translateY(-50%)',
          },
          '50%': {
            transform: 'translateY(50%)',
          },
          '100%': {
            transform: 'translateY(-50%)',
          },
        },
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};
