import React from 'react';
import { Pressable, Text, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { WH_COLORS } from '../constants/warehouseTheme';

interface AppButtonProps {
  icon?: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'secondary';
  compact?: boolean;
}

/**
 * Brown-themed action button. Replaces ActionButton + SmallButton duplicates.
 * Primary variant uses solid brown; secondary uses light brown bg + brown text.
 */
export function AppButton({
  icon,
  label,
  onPress,
  loading = false,
  disabled = false,
  variant = 'primary',
  compact = false,
}: AppButtonProps) {
  const isSecondary = variant === 'secondary';
  const isDisabled = loading || disabled;

  const bgColor = isSecondary
    ? WH_COLORS.primaryLight
    : WH_COLORS.primary;
  const textColor = isSecondary
    ? WH_COLORS.primary
    : '#FFFFFF';
  const borderColor = isSecondary
    ? 'rgba(139, 69, 19, 0.2)'
    : 'transparent';

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        borderRadius: 12,
        backgroundColor: bgColor,
        borderWidth: isSecondary ? 1 : 0,
        borderColor,
        paddingHorizontal: compact ? 12 : 16,
        paddingVertical: compact ? 10 : 14,
        opacity: isDisabled ? 0.6 : 1,
        flex: compact ? 1 : undefined,
      }}
    >
      {loading ? (
        <ActivityIndicator size="small" color={textColor} />
      ) : icon ? (
        <Ionicons name={icon} size={18} color={textColor} />
      ) : null}
      <Text style={{ fontSize: 14, fontWeight: '700', color: textColor }}>
        {loading ? 'Đang xử lý...' : label}
      </Text>
    </Pressable>
  );
}
