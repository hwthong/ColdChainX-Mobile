import React from 'react';
import { Pressable, Text, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors } from '../constants/colors';

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
 * Web Blue Palette action button.
 * Primary variant uses solid brand primary; secondary uses card bg + brand primary text.
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

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        borderRadius: 12,
        backgroundColor: isSecondary
          ? pressed
            ? colors.brand.primarySoft
            : colors.surface.card
          : pressed
          ? colors.brand.primaryPressed
          : colors.brand.primary,
        borderWidth: isSecondary ? 1 : 0,
        borderColor: isSecondary ? colors.border.strong : 'transparent',
        paddingHorizontal: compact ? 12 : 16,
        paddingVertical: compact ? 10 : 14,
        opacity: isDisabled ? 0.6 : 1,
        flex: compact ? 1 : undefined,
      })}
    >
      {({ pressed }) => {
        const textColor = isSecondary ? colors.brand.primary : colors.text.onPrimary;
        return (
          <>
            {loading ? (
              <ActivityIndicator size="small" color={textColor} />
            ) : icon ? (
              <Ionicons name={icon} size={18} color={textColor} />
            ) : null}
            <Text style={{ fontSize: 14, fontWeight: '700', color: textColor }}>
              {loading ? 'Đang xử lý...' : label}
            </Text>
          </>
        );
      }}
    </Pressable>
  );
}
