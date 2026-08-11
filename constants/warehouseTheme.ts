import { colors } from './colors';

/**
 * Warehouse UI theme — synchronized with central Web blue palette.
 * Business codes (LPN, ASN, QC) are kept in English; all UI labels are Vietnamese.
 */

export const WH_COLORS = {
  /** Dark navy used for header background and hero cards */
  headerBg: colors.text.primary,
  /** Soft primary text accent on dark bg */
  headerText: colors.brand.primaryForeground,
  /** Primary action color (buttons, active tabs, icons) */
  primary: colors.brand.primary,
  /** Light tint of primary for secondary buttons / inactive tab bg */
  primaryLight: colors.brand.primarySoft,
  /** Screen background */
  background: colors.surface.page,
  /** Card / surface background */
  cardBg: colors.surface.card,
  /** Card border */
  cardBorder: colors.border.default,
  /** Main body text */
  textPrimary: colors.text.primary,
  /** Secondary / muted text */
  textSecondary: colors.text.secondary,
  /** Label text inside forms */
  labelText: colors.text.muted,
  /** Background for icon circles */
  iconBg: colors.brand.primarySoft,
  /** Placeholder text */
  placeholder: colors.text.muted,
  /** Input border */
  inputBorder: colors.border.default,
  /** Tab bar border top */
  tabBorder: colors.border.default,
} as const;

export interface StatusStyle {
  bg: string;
  text: string;
  border: string;
  label: string;
}

/** Maps LPN / ASN status codes to display styles and Vietnamese labels. */
export const STATUS_STYLES: Record<string, StatusStyle> = {
  IN_STOCK: {
    bg: colors.status.success.bg,
    text: colors.status.success.main,
    border: colors.status.success.border,
    label: 'Đã nhập kho',
  },
  RECEIVING: {
    bg: colors.status.warning.bg,
    text: colors.status.warning.main,
    border: colors.status.warning.border,
    label: 'Đang chờ nhập vị trí',
  },
  DISCREPANCY_HOLD: {
    bg: colors.status.warning.bg,
    text: colors.status.warning.main,
    border: colors.status.warning.border,
    label: 'Đang giữ do sai lệch',
  },
  RETURN_PENDING: {
    bg: colors.status.danger.bg,
    text: colors.status.danger.main,
    border: colors.status.danger.border,
    label: 'Chờ trả hàng',
  },
  SCHEDULED: {
    bg: colors.brand.primarySoft,
    text: colors.brand.primary,
    border: colors.border.default,
    label: 'Đã đặt lịch',
  },
  QC_PASSED: {
    bg: colors.status.success.bg,
    text: colors.status.success.main,
    border: colors.status.success.border,
    label: 'QC đạt',
  },
  ARRIVED: {
    bg: colors.status.warning.bg,
    text: colors.status.warning.main,
    border: colors.status.warning.border,
    label: 'Đã đến kho',
  },
  PLANNED: {
    bg: colors.brand.primarySoft,
    text: colors.brand.primary,
    border: colors.border.default,
    label: 'Chờ bốc hàng',
  },
  ALLOCATED: {
    bg: colors.brand.primarySoft,
    text: colors.brand.primary,
    border: colors.border.default,
    label: 'Đã phân chuyến',
  },
  PICKING: {
    bg: colors.status.info.bg,
    text: colors.status.info.main,
    border: colors.status.info.border,
    label: 'Đang bốc hàng',
  },
  LOADING: {
    bg: colors.status.warning.bg,
    text: colors.status.warning.main,
    border: colors.status.warning.border,
    label: 'Chờ bốc lên xe',
  },
  LOADING_COMPLETED: {
    bg: colors.status.success.bg,
    text: colors.status.success.main,
    border: colors.status.success.border,
    label: 'Đã bốc xong',
  },
  RELEASED: {
    bg: colors.status.success.bg,
    text: colors.status.success.main,
    border: colors.status.success.border,
    label: 'Đã xuất kho',
  },
  SEALED: {
    bg: colors.brand.primarySoft,
    text: colors.brand.primary,
    border: colors.border.default,
    label: 'Đã kẹp chì',
  },
  DISPATCHED: {
    bg: colors.brand.primarySoft,
    text: colors.brand.primary,
    border: colors.border.default,
    label: 'Đã điều phối',
  },
  SHIPPING: {
    bg: colors.brand.primarySoft,
    text: colors.brand.primary,
    border: colors.border.default,
    label: 'Đang giao',
  },
  IN_TRANSIT: {
    bg: colors.status.info.bg,
    text: colors.status.info.main,
    border: colors.status.info.border,
    label: 'Đang di chuyển',
  },
  DELAYED: {
    bg: colors.status.warning.bg,
    text: colors.status.warning.main,
    border: colors.status.warning.border,
    label: 'Bị trễ',
  },
  COMPLETED: {
    bg: colors.status.success.bg,
    text: colors.status.success.main,
    border: colors.status.success.border,
    label: 'Hoàn thành',
  },
  CANCELLED: {
    bg: colors.status.danger.bg,
    text: colors.status.danger.main,
    border: colors.status.danger.border,
    label: 'Đã hủy',
  },
} as const;

/** Message tone colors used by AppMessage component */
export const TONE_COLORS = {
  neutral: { bg: colors.brand.primarySoft, border: colors.border.default, text: colors.brand.primary },
  success: { bg: colors.status.success.bg, border: colors.status.success.border, text: colors.status.success.main },
  warning: { bg: colors.status.warning.bg, border: colors.status.warning.border, text: colors.status.warning.main },
  error: { bg: colors.status.danger.bg, border: colors.status.danger.border, text: colors.status.danger.main },
} as const;

export type MessageTone = keyof typeof TONE_COLORS;

/**
 * Returns the StatusStyle for a given status code.
 * Falls back to a neutral brown style for unknown codes.
 */
export function getStatusStyle(status: string): StatusStyle {
  const normalized = status?.toUpperCase().trim() ?? '';
  return (
    STATUS_STYLES[normalized] ?? {
      bg: WH_COLORS.primaryLight,
      text: WH_COLORS.primary,
      border: WH_COLORS.inputBorder,
      label: status,
    }
  );
}

/** Formats an ISO date string to Vietnamese locale. Returns fallback if invalid. */
export function formatDateTimeVi(value?: string | null, fallback = 'N/A'): string {
  if (!value) return fallback;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString('vi-VN');
}
