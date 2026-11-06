/** Design tokens (PRD 16.1–16.3). */
export const colors = {
  primary: '#0E6A4E',
  primaryDark: '#0A4F3A',
  primaryTint: '#E3F1EA',
  background: '#F5F6F3',
  surface: '#FFFFFF',
  text: '#14211B',
  textSecondary: '#56625B',
  border: '#C9D0CB',
  divider: '#E2E6E1',
  warningBg: '#FDF1DE',
  warningText: '#5C3D08',
  errorBg: '#FDECEC',
  errorText: '#8A1C1C',
  destructive: '#A12222',
  destructiveBorder: '#E8B4B4',
  statusOk: '#1F9D63',
  scannerBg: '#0D1411',
  scanLine: '#3DDC97',
  white: '#FFFFFF',
  dim: 'rgba(20,33,27,0.45)',
};

export const fonts = {
  regular: 'PlusJakartaSans-Regular',
  medium: 'PlusJakartaSans-Medium',
  semibold: 'PlusJakartaSans-SemiBold',
  bold: 'PlusJakartaSans-Bold',
  mono: 'JetBrainsMono-Regular',
  monoBold: 'JetBrainsMono-Bold',
};

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };

export const radius = { input: 12, card: 16, button: 12, chip: 20, sheet: 24 };

export const type = {
  authTitle: { fontFamily: fonts.bold, fontSize: 30, color: colors.text },
  tabTitle: { fontFamily: fonts.bold, fontSize: 24, color: colors.text },
  cardTitle: { fontFamily: fonts.bold, fontSize: 16, color: colors.text },
  body: { fontFamily: fonts.regular, fontSize: 15, color: colors.text },
  bodyStrong: { fontFamily: fonts.semibold, fontSize: 15, color: colors.text },
  label: { fontFamily: fonts.semibold, fontSize: 13, color: colors.textSecondary },
  caption: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.textSecondary },
  mono: { fontFamily: fonts.mono, fontSize: 14, color: colors.text },
} as const;
