import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { WH_COLORS } from '../constants/warehouseTheme';

interface EmptyStateProps {
  icon?: keyof typeof Ionicons.glyphMap;
  message: string;
}

/**
 * Friendly empty-state placeholder with icon and Vietnamese message.
 */
export function EmptyState({ icon = 'file-tray-outline', message }: EmptyStateProps) {
  return (
    <View
      style={{
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 40,
        paddingHorizontal: 24,
      }}
    >
      <View
        style={{
          width: 64,
          height: 64,
          borderRadius: 32,
          backgroundColor: WH_COLORS.primaryLight,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 16,
        }}
      >
        <Ionicons name={icon} size={28} color={WH_COLORS.primary} />
      </View>
      <Text
        style={{
          fontSize: 14,
          fontWeight: '600',
          color: WH_COLORS.textSecondary,
          textAlign: 'center',
          lineHeight: 20,
        }}
      >
        {message}
      </Text>
    </View>
  );
}
