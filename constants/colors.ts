/**
 * Single source of truth for ColdChainX Mobile color palette tokens.
 * Derived directly from the Web blue palette audit.
 */

export const colors = {
  brand: {
    primary: '#367eb8',
    primaryPressed: '#276497',
    primarySoft: '#e2eff8',
    primaryForeground: '#f8fcff',
  },
  surface: {
    page: '#eef6fc',
    card: '#ffffff',
    cardSoft: '#fafdff',
    selected: '#e2eff8',
    muted: '#eaf3f9',
  },
  border: {
    default: '#ccdfec',
    strong: '#bdd6e7',
    focus: '#72a9d2',
    selected: '#367eb8',
  },
  text: {
    primary: '#173b59',
    secondary: '#607b90',
    muted: '#7898b3',
    onPrimary: '#f8fcff',
    brand: '#2878bf',
  },
  status: {
    success: {
      main: '#166534',
      bg: '#F0FDF4',
      border: '#BBF7D0',
    },
    warning: {
      main: '#C2410C',
      bg: '#FFF7ED',
      border: '#FED7AA',
    },
    danger: {
      main: '#991B1B',
      bg: '#FEF2F2',
      border: '#FECACA',
    },
    info: {
      main: '#0E7490',
      bg: '#ECFEFF',
      border: '#A5F3FC',
    },
  },
} as const;

export type Colors = typeof colors;
