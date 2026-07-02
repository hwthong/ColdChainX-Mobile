/**
 * Warehouse UI theme — brown palette synchronized with Customer app.
 * Business codes (LPN, ASN, QC) are kept in English; all UI labels are Vietnamese.
 */

export const WH_COLORS = {
  /** Dark brown used for header background and hero cards */
  headerBg: '#3A1F04',
  /** Warm peach for header text / accent on dark bg */
  headerText: '#FFC29F',
  /** Primary action color (buttons, active tabs, icons) */
  primary: '#8B4513',
  /** Light tint of primary for secondary buttons / inactive tab bg */
  primaryLight: '#F8F3EF',
  /** Screen background */
  background: '#F5F2F0',
  /** Card / surface background */
  cardBg: '#FFFFFF',
  /** Card border */
  cardBorder: 'rgba(218, 194, 182, 0.5)',
  /** Main body text */
  textPrimary: '#3A1F04',
  /** Secondary / muted text */
  textSecondary: '#877369',
  /** Label text inside forms */
  labelText: '#6B5344',
  /** Background for icon circles */
  iconBg: 'rgba(139, 69, 19, 0.1)',
  /** Placeholder text */
  placeholder: '#B8A99E',
  /** Input border */
  inputBorder: '#DAC2B6',
  /** Tab bar border top */
  tabBorder: 'rgba(218, 194, 182, 0.5)',
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
    bg: '#F0FDF4',
    text: '#166534',
    border: '#BBF7D0',
    label: 'Đã nhập kho',
  },
  RECEIVING: {
    bg: '#FFF8F0',
    text: '#8B4513',
    border: '#F5D4B3',
    label: 'Đang chờ nhập vị trí',
  },
  DISCREPANCY_HOLD: {
    bg: '#FFF7ED',
    text: '#C2410C',
    border: '#FED7AA',
    label: 'Đang giữ do sai lệch',
  },
  RETURN_PENDING: {
    bg: '#FEF2F2',
    text: '#991B1B',
    border: '#FECACA',
    label: 'Chờ trả hàng',
  },
  SCHEDULED: {
    bg: '#EEF2FF',
    text: '#3730A3',
    border: '#C7D2FE',
    label: 'Đã đặt lịch',
  },
  QC_PASSED: {
    bg: '#F0FDF4',
    text: '#166534',
    border: '#BBF7D0',
    label: 'QC đạt',
  },
  ARRIVED: {
    bg: '#FFF8F0',
    text: '#8B4513',
    border: '#F5D4B3',
    label: 'Đã đến kho',
  },
  PLANNED: {
    bg: '#EEF2FF',
    text: '#3730A3',
    border: '#C7D2FE',
    label: 'Chờ bốc hàng',
  },
  ALLOCATED: {
    bg: '#F8F3EF',
    text: '#8B4513',
    border: '#DAC2B6',
    label: 'Đã phân chuyến',
  },
  PICKING: {
    bg: '#ECFEFF',
    text: '#0E7490',
    border: '#A5F3FC',
    label: 'Đang bốc hàng',
  },
  LOADING: {
    bg: '#FFF8F0',
    text: '#8B4513',
    border: '#F5D4B3',
    label: 'Chờ bốc lên xe',
  },
  LOADING_COMPLETED: {
    bg: '#F0FDF4',
    text: '#166534',
    border: '#BBF7D0',
    label: 'Đã bốc xong',
  },
  RELEASED: {
    bg: '#ECFDF5',
    text: '#047857',
    border: '#A7F3D0',
    label: 'Đã xuất kho',
  },
  SEALED: {
    bg: '#F5F3FF',
    text: '#6D28D9',
    border: '#DDD6FE',
    label: 'Đã kẹp chì',
  },
  DISPATCHED: {
    bg: '#EFF6FF',
    text: '#1D4ED8',
    border: '#BFDBFE',
    label: 'Đã điều phối',
  },
  SHIPPING: {
    bg: '#EFF6FF',
    text: '#1D4ED8',
    border: '#BFDBFE',
    label: 'Đang giao',
  },
} as const;

/** Message tone colors used by AppMessage component */
export const TONE_COLORS = {
  neutral: { bg: '#EEF2FF', border: '#C7D2FE', text: '#3730A3' },
  success: { bg: '#F0FDF4', border: '#BBF7D0', text: '#166534' },
  warning: { bg: '#FFFBEB', border: '#FDE68A', text: '#92400E' },
  error: { bg: '#FEF2F2', border: '#FECACA', text: '#991B1B' },
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
