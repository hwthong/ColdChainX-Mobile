import React, { useCallback, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';

import { colors } from '../constants/colors';
import { getUnreadNotificationCount } from '../services/notificationApi';
import { useAuthStore } from '../store/useAuthStore';

interface DriverHeaderProps {
  title: string;
  showBackButton?: boolean;
}

export function DriverHeader({ title, showBackButton = false }: DriverHeaderProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const token = useAuthStore((state) => state.token);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchUnreadCount = useCallback(async () => {
    if (!token) {
      setUnreadCount(0);
      return;
    }

    try {
      const response = await getUnreadNotificationCount(token);
      if (response.success && response.data) {
        setUnreadCount(response.data.unreadCount);
      }
    } catch (error) {
      if (__DEV__) {
        console.warn('[DriverHeader] Failed to load unread count', error);
      }
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      fetchUnreadCount();
    }, [fetchUnreadCount])
  );

  return (
    <View
      style={{
        paddingTop: insets.top,
        backgroundColor: colors.surface.card,
        borderBottomWidth: 1,
        borderBottomColor: colors.border.default,
      }}
      className="w-full"
    >
      <View className="h-[56px] flex-row items-center justify-between px-4">
        {showBackButton ? (
          <Pressable
            onPress={() => router.back()}
            style={{ backgroundColor: colors.surface.muted }}
            className="h-10 w-10 items-center justify-center rounded-full"
          >
            <Ionicons name="chevron-back" size={22} color={colors.text.primary} />
          </Pressable>
        ) : (
          <View className="h-10 w-10" />
        )}

        <Text
          numberOfLines={1}
          style={{ color: colors.text.primary }}
          className="flex-1 px-2 text-center text-lg font-bold"
        >
          {title}
        </Text>

        <Pressable
          onPress={() => router.push('/(driver)/notifications' as never)}
          accessibilityRole="button"
          accessibilityLabel={unreadCount > 0 ? `Thông báo, ${unreadCount} chưa đọc` : 'Thông báo'}
          style={{ backgroundColor: colors.surface.muted }}
          className="relative h-10 w-10 items-center justify-center rounded-full"
        >
          <Ionicons name="notifications-outline" size={22} color={colors.brand.primary} />
          {unreadCount > 0 ? (
            <View
              style={{ backgroundColor: colors.status.warning.main }}
              className="absolute -top-1 -right-1 min-w-[18px] h-[18px] items-center justify-center rounded-full px-1"
            >
              <Text className="text-[10px] font-bold text-white">
                {unreadCount > 99 ? '99+' : unreadCount}
              </Text>
            </View>
          ) : null}
        </Pressable>
      </View>
    </View>
  );
}
