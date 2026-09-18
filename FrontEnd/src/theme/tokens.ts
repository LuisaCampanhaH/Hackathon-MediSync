// Paleta turquesa/verde da marca. Tokens são variáveis de tema (ver
// ThemeContext) — nunca hardcode hex nos componentes, sempre leia daqui.

const lightBase = {
  bg: '#f3f8f9',
  surface: '#ffffff',
  surfaceAlt: '#e8f0f2',
  border: '#d2e0e3',
  textPrimary: '#0f2226',
  textSecondary: '#3f5c61',
  textMuted: '#6e888d',
  primary: '#00788f',
  primaryDark: '#005e72',
  primaryTint: '#d6eff4',
  onPrimary: '#ffffff',
  success: '#10b981',
  successTint: '#d8f6ea',
  successText: '#06765a',
  accent: '#07a999',
  accentTint: '#d5f4ef',
  accentText: '#066b60',
  tabInactive: '#7d979c',
  // Tokens de alerta (vermelho) não mudam com a paleta turquesa/verde.
  warn: '#DF0000',
  warnTint: '#FFD6C2',
  warnText: '#A50000',
  alertBg: '#FFE1D2',
  alertIconBg: '#D80000',
  alertTitle: '#430F0D',
  alertBody: '#522C1F',
  alertPrimaryBg: '#C90000',
  alertSecondaryBorder: '#C20000',
  alertSecondaryFg: '#970000',
  onWarn: '#FFFFFF',
  overlaySubtle: 'rgba(0,0,0,0.07)',
};

// Texto claro sobre --gradAction (streak, botão Salvar, chip selecionado) —
// pedido explícito, por cima da recomendação de contraste original.
const ON_GRAD_ACTION = '#FFFFFF';

export const lightColors = {
  ...lightBase,
  onGradAction: ON_GRAD_ACTION,
  // Iniciais do avatar: único texto sobre --gradAction que inverte por tema.
  onAvatarGrad: '#0f2226',
  gradHero: ['#0097b2', '#07a999'] as [string, string],
  gradAction: ['#07a999', '#10b981'] as [string, string],
  gradAlert: [lightBase.alertPrimaryBg, lightBase.alertIconBg] as [string, string],
};

const darkBase = {
  bg: '#0c1a1d',
  surface: '#12262a',
  surfaceAlt: '#1a3237',
  border: '#24444a',
  textPrimary: '#eaf4f5',
  textSecondary: '#a9c4c8',
  textMuted: '#7d999e',
  primary: '#2ab6cf',
  primaryDark: '#0f999c',
  primaryTint: '#143a42',
  onPrimary: '#04191e',
  success: '#34d399',
  successTint: '#0f3a2d',
  successText: '#6ee7b7',
  accent: '#2fc4b2',
  accentTint: '#0f3a35',
  accentText: '#7fe3d6',
  tabInactive: '#6b878c',
  warn: '#FF372B',
  warnTint: '#49150F',
  warnText: '#FFA28E',
  alertBg: '#2C0806',
  alertIconBg: '#F52027',
  alertTitle: '#FFDFD6',
  alertBody: '#E1B1A4',
  alertPrimaryBg: '#F52027',
  alertSecondaryBorder: '#EE3533',
  alertSecondaryFg: '#FF9985',
  onWarn: '#FFFFFF',
  overlaySubtle: 'rgba(255,255,255,0.10)',
};

export const darkColors: typeof lightColors = {
  ...darkBase,
  onGradAction: ON_GRAD_ACTION,
  onAvatarGrad: '#FFFFFF',
  gradHero: ['#0097b2', '#07a999'],
  gradAction: ['#2fc4b2', '#34d399'],
  gradAlert: [darkBase.alertPrimaryBg, darkBase.alertIconBg],
};

export type ColorTokens = typeof lightColors;

export const radii = {
  lg: 20,
  md: 16,
  sm: 12,
  squircle: 14,
  pill: 999,
};

// A single explicit pixel scale used everywhere instead of Tamagui's $-token
// shorthands, so spacing stays deterministic and matches the design spec's
// literal numbers rather than whatever the token scale happens to resolve to.
export const space = {
  xs: 6,
  sm: 10,
  md: 16,
  lg: 20,
  section: 26,
  cardPad: 26,
  cardPadSm: 20,
};

export const shadow = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 16,
    elevation: 3,
  },
  hero: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 30,
    elevation: 8,
  },
  dropdown: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.16,
    shadowRadius: 28,
    elevation: 10,
  },
  // drop-shadow(0 3px 8px rgba(7,169,153,.35)) do donut de adesão
  donut: {
    shadowColor: 'rgba(7,169,153,0.35)',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 6,
  },
} as const;

// Degradê neutro pra botões secundários/neutros (voltar, toggle de tema,
// steppers de estoque) — não muda com a marca, por isso não é um --token.
export function neutralGradient(colors: ColorTokens): [string, string] {
  return [colors.surface, colors.surfaceAlt];
}

// Degradês fixos da marca (donut de adesão, barras do gráfico semanal) — sem
// variante escura definida no design, ficam iguais nos dois temas.
export const brandGradients = {
  donut: ['#0097b2', '#07a999', '#10b981'] as [string, string, string],
  bar: ['#07a999', '#10b981'] as [string, string],
};
