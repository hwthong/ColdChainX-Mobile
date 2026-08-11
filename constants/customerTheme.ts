import { colors } from './colors';

export const customerColors = {
  background: colors.surface.page,
  surface: colors.surface.card,
  surfaceSoft: colors.surface.cardSoft,
  surfaceNeutral: colors.surface.muted,
  primary: colors.brand.primary,
  primaryPressed: colors.brand.primaryPressed,
  primarySoft: colors.brand.primarySoft,
  textPrimary: colors.text.primary,
  text: colors.text.primary,
  textSecondary: colors.text.secondary,
  border: colors.border.default,
  borderStrong: colors.border.strong,
  borderSubtle: colors.border.default,
  progressTrack: colors.brand.primarySoft,
  error: colors.status.danger.main,
  success: colors.status.success.main,
} as const;

export const customerSpacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  pageHorizontal: 20,
  sectionGap: 16,
  controlGap: 12,
} as const;

export const customerRadius = {
  small: 12,
  control: 16,
  card: 16,
  pill: 999,
  surface: 20,
} as const;

export const customerControl = {
  height: 54,
  buttonHeight: 54,
} as const;
