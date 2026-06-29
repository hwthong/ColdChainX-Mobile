import React, { useEffect } from 'react';
import { Animated, Modal, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface AppToastProps {
  visible: boolean;
  type: ToastType;
  title?: string;
  message: string;
  onClose: () => void;
  autoHideDuration?: number;
}

export function AppToast({
  visible,
  type,
  title,
  message,
  onClose,
  autoHideDuration = 5000,
}: AppToastProps) {
  const [fadeAnim] = React.useState(new Animated.Value(0));

  const handleClose = React.useCallback(() => {
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => onClose());
  }, [fadeAnim, onClose]);

  useEffect(() => {
    if (visible) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();

      if (autoHideDuration > 0) {
        const timer = setTimeout(() => {
          handleClose();
        }, autoHideDuration);
        return () => clearTimeout(timer);
      }
    } else {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, autoHideDuration, fadeAnim, handleClose]);

  if (!visible) return null;

  const getColors = () => {
    switch (type) {
      case 'success':
        return { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-800', icon: 'checkmark-circle', iconColor: '#15803d' };
      case 'error':
        return { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-800', icon: 'alert-circle', iconColor: '#b91c1c' };
      case 'warning':
        return { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-800', icon: 'warning', iconColor: '#b45309' };
      case 'info':
      default:
        return { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-800', icon: 'information-circle', iconColor: '#1d4ed8' };
    }
  };

  const colors = getColors();

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={handleClose}>
      <View className="flex-1 justify-start items-center px-4 pt-16 bg-black/20">
        <Animated.View
          style={{ opacity: fadeAnim, transform: [{ translateY: fadeAnim.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] }) }] }}
          className={`w-full max-w-sm rounded-2xl border ${colors.bg} ${colors.border} p-4 shadow-lg flex-row items-start`}
        >
          <View className="mr-3 mt-0.5">
            <Ionicons name={colors.icon as any} size={24} color={colors.iconColor} />
          </View>
          <View className="flex-1 mr-2">
            {title ? (
              <Text className={`text-base font-bold mb-1 ${colors.text}`}>{title}</Text>
            ) : null}
            <Text className={`text-sm leading-5 font-medium ${colors.text}`}>{message}</Text>
          </View>
          <Pressable onPress={handleClose} className="p-1 -mr-2 -mt-1 opacity-70 active:opacity-100">
            <Ionicons name="close" size={20} color={colors.iconColor} />
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
}
