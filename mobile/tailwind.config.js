/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        // Surfaces
        bg:       '#0F172A',
        bgRaise:  '#1E293B',
        bgSunk:   '#0B1220',
        surface:  '#243247',
        surface2: '#2F3F58',
        hairline: 'rgba(255,255,255,0.08)',
        divider:  'rgba(255,255,255,0.06)',
        // Ink
        text:     '#F8FAFC',
        textSoft: '#CBD5E1',
        textMute: '#94A3B8',
        textDim:  '#64748B',
        // Brand
        green:       '#22C55E',
        greenDeep:   '#15803D',
        purple:      '#A855F7',
        purpleDeep:  '#7E22CE',
        flame:       '#F97316',
        flameDeep:   '#C2410C',
        gold:        '#FACC15',
        goldDeep:    '#A16207',
        sky:         '#38BDF8',
        skyDeep:     '#0369A1',
        rose:        '#F43F5E',
        roseDeep:    '#9F1239',
      },
      fontFamily: {
        sans: ['PlusJakarta_500Medium', 'System'],
        sansSemi: ['PlusJakarta_600SemiBold', 'System'],
        sansBold: ['PlusJakarta_700Bold', 'System'],
        sansBlack: ['PlusJakarta_800ExtraBold', 'System'],
      },
      borderRadius: {
        'sm': '14px',
        'md': '20px',
        'lg': '28px',
        'xl': '36px',
      },
      letterSpacing: {
        tightest: '-0.5px',
        tighter:  '-0.3px',
        label:    '1.5px',
      },
    },
  },
  plugins: [],
};
