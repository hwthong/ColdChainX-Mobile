import React, { type ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useKeyboardVisibility } from './useKeyboardVisibility';

export interface KeyboardChatViewProps {
  /** Height of the navigation header above the screen (default: 64) */
  headerHeight?: number;
  /** Content of the chat (e.g. order summary + message FlatList) */
  children: ReactNode;
  /** Message composer input and send button placed at the bottom */
  composer: ReactNode;
  /** Optional container style */
  style?: StyleProp<ViewStyle>;
  /** Optional background color */
  backgroundColor?: string;
}

/**
 * Reusable layout wrapper for Chat and Message screens.
 * Ensures the composer stays directly above the keyboard when open,
 * and restores safe-area bottom inset when closed.
 */
export function KeyboardChatView({
  headerHeight = 64,
  children,
  composer,
  style,
  backgroundColor,
}: KeyboardChatViewProps) {
  const insets = useSafeAreaInsets();
  const { isKeyboardVisible } = useKeyboardVisibility();

  // On iOS, KAV needs vertical offset equal to distance from window top (statusBar + header)
  const keyboardVerticalOffset = Platform.OS === 'ios' ? insets.top + headerHeight : 0;

  return (
    <View style={[styles.root, backgroundColor ? { backgroundColor } : null, style]}>
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={keyboardVerticalOffset}
      >
        <View style={styles.content}>
          {children}
        </View>
        <View style={{ paddingBottom: isKeyboardVisible ? 0 : Math.max(insets.bottom, 0) }}>
          {composer}
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
});
