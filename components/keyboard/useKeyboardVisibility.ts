import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';

export interface KeyboardVisibilityState {
  isKeyboardVisible: boolean;
  keyboardHeight: number;
}

/**
 * Reusable hook to track keyboard visibility and height across platforms.
 * Uses keyboardWillShow / keyboardWillHide on iOS for smooth transitions,
 * and keyboardDidShow / keyboardDidHide on Android.
 */
export function useKeyboardVisibility(): KeyboardVisibilityState {
  const [keyboardState, setKeyboardState] = useState<KeyboardVisibilityState>({
    isKeyboardVisible: false,
    keyboardHeight: 0,
  });

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSubscription = Keyboard.addListener(showEvent, (e) => {
      setKeyboardState({
        isKeyboardVisible: true,
        keyboardHeight: e.endCoordinates.height,
      });
    });

    const hideSubscription = Keyboard.addListener(hideEvent, () => {
      setKeyboardState({
        isKeyboardVisible: false,
        keyboardHeight: 0,
      });
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  return keyboardState;
}
