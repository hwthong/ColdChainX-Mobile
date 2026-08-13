import React, { useState } from 'react';
import {
  Pressable as NativePressable,
  type PressableProps,
} from 'react-native';

/**
 * Keeps React Native's functional Pressable styles working when NativeWind's
 * CSS interop consumes the style prop before it reaches the native component.
 */
export function AppPressable({ style, onPressIn, onPressOut, ...props }: PressableProps) {
  const [pressed, setPressed] = useState(false);
  const state = { pressed } as Parameters<Extract<PressableProps['style'], Function>>[0];
  const resolvedStyle = typeof style === 'function' ? style(state) : style;

  return (
    <NativePressable
      {...props}
      style={resolvedStyle}
      onPressIn={(event) => {
        setPressed(true);
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        setPressed(false);
        onPressOut?.(event);
      }}
    />
  );
}
