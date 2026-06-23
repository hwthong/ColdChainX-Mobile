import React from 'react';
import { View, Text } from 'react-native';

import { WH_COLORS } from '../constants/warehouseTheme';

interface AppInfoRowProps {
  label: string;
  value: string;
  /** Width of the label column, defaults to 90 */
  labelWidth?: number;
}

/**
 * A consistent label–value row used across warehouse screens.
 * Replaces 4 duplicate InfoRow implementations.
 */
export function AppInfoRow({ label, value, labelWidth = 90 }: AppInfoRowProps) {
  return (
    <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
      <Text
        style={{
          width: labelWidth,
          fontSize: 12,
          fontWeight: '700',
          color: WH_COLORS.textSecondary,
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          flex: 1,
          fontSize: 12,
          color: WH_COLORS.textPrimary,
        }}
      >
        {value}
      </Text>
    </View>
  );
}
