import React from 'react';
import { View, Text } from 'react-native';

import { TONE_COLORS, type MessageTone } from '../constants/warehouseTheme';

interface AppMessageProps {
  text: string;
  tone?: MessageTone;
}

/**
 * Colored message banner — replaces 3+ duplicate Message implementations.
 * Supports neutral, success, warning, and error tones.
 */
export function AppMessage({ text, tone = 'neutral' }: AppMessageProps) {
  const colors = TONE_COLORS[tone];

  return (
    <View
      style={{
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.bg,
        borderRadius: 10,
        paddingHorizontal: 14,
        paddingVertical: 10,
      }}
    >
      <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text, lineHeight: 18 }}>
        {text}
      </Text>
    </View>
  );
}
