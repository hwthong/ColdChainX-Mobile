import React, { useState } from 'react';
import { View, Text, TextInput } from 'react-native';
import type { TextInputProps } from 'react-native';

import { colors } from '../constants/colors';

interface AppInputProps {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  keyboardType?: TextInputProps['keyboardType'];
  multiline?: boolean;
  error?: string;
}

/**
 * Web Blue Palette text input with label and focus/error states.
 */
export function AppInput({
  label,
  value,
  onChangeText,
  placeholder = '',
  keyboardType = 'default',
  multiline = false,
  error,
}: AppInputProps) {
  const [isFocused, setIsFocused] = useState(false);

  const getBorderColor = () => {
    if (error) return colors.status.danger.main;
    if (isFocused) return colors.border.focus;
    return colors.border.default;
  };

  return (
    <View style={{ flex: 1, gap: 4 }}>
      <Text
        style={{
          fontSize: 12,
          fontWeight: '700',
          color: error ? colors.status.danger.main : colors.text.secondary,
        }}
      >
        {label}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.text.muted}
        keyboardType={keyboardType}
        multiline={multiline}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        style={{
          borderWidth: 1,
          borderColor: getBorderColor(),
          borderRadius: 10,
          backgroundColor: colors.surface.card,
          paddingHorizontal: 14,
          paddingVertical: 10,
          fontSize: 14,
          color: colors.text.primary,
          minHeight: multiline ? 86 : 44,
          textAlignVertical: multiline ? 'top' : 'center',
        }}
      />
      {error ? (
        <Text style={{ fontSize: 11, color: colors.status.danger.main, marginTop: 2 }}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}
