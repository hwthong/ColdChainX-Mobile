import React from 'react';
import { View, Text, TextInput } from 'react-native';
import type { TextInputProps } from 'react-native';

import { WH_COLORS } from '../constants/warehouseTheme';

interface AppInputProps {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  keyboardType?: TextInputProps['keyboardType'];
  multiline?: boolean;
}

/**
 * Brown-themed text input with label. Replaces the inline Field component.
 */
export function AppInput({
  label,
  value,
  onChangeText,
  placeholder = '',
  keyboardType = 'default',
  multiline = false,
}: AppInputProps) {
  return (
    <View style={{ flex: 1, gap: 4 }}>
      <Text
        style={{
          fontSize: 12,
          fontWeight: '700',
          color: WH_COLORS.labelText,
        }}
      >
        {label}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={WH_COLORS.placeholder}
        keyboardType={keyboardType}
        multiline={multiline}
        style={{
          borderWidth: 1,
          borderColor: WH_COLORS.inputBorder,
          borderRadius: 10,
          backgroundColor: WH_COLORS.cardBg,
          paddingHorizontal: 14,
          paddingVertical: 10,
          fontSize: 14,
          color: WH_COLORS.textPrimary,
          minHeight: multiline ? 86 : 44,
          textAlignVertical: multiline ? 'top' : 'center',
        }}
      />
    </View>
  );
}
