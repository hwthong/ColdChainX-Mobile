import React, { useCallback, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';

import { getUnreadNotificationCount } from '../services/notificationApi';
import { useAuthStore } from '../store/useAuthStore';

interface CustomerHeaderProps {
  title: string;
  showBackButton?: boolean;
}

export function CustomerHeader({ title, showBackButton = false }: CustomerHeaderProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const accessToken = useAuthStore((state) => state.token);
  const fullName = useAuthStore((state) => state.fullName ?? state.user?.fullName ?? null);
  const [unreadCount, setUnreadCount] = useState(0);
  const isHome = title === 'ColdChainX';
  const displayName = fullName?.trim() || 'bạn';

  const fetchUnreadCount = useCallback(async () => {
    if (!accessToken) {
      setUnreadCount(0);
      return;
    }

    try {
      const response = await getUnreadNotificationCount(accessToken);

      if (response.success && response.data) {
        setUnreadCount(response.data.unreadCount);
      }
    } catch (error) {
      if (__DEV__) {
        console.warn('[CustomerHeader] Failed to load unread notifications', {
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  }, [accessToken]);

  useFocusEffect(
    useCallback(() => {
      fetchUnreadCount();
    }, [fetchUnreadCount])
  );

  return (
    <View
      style={{ paddingTop: insets.top }}
      className="w-full border-b border-[#DAC2B6]/30 bg-white"
    >
      <View className="h-[64px] flex-row items-center justify-between px-5">
        {showBackButton ? (
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Quay lại"
            accessibilityHint="Trở về màn hình trước"
            className="h-11 w-11 items-center justify-center rounded-full bg-[#F8F3EF]"
          >
            <Ionicons name="chevron-back" size={22} color="#8B4513" />
          </Pressable>
        ) : (
          <View className="h-11 w-11" />
        )}

        {isHome ? (
          <View className="flex-1 px-2">
            <Text className="text-xs font-semibold text-[#877369]">Xin chào,</Text>
            <Text className="mt-0.5 text-xl font-bold text-[#3A1F04]" numberOfLines={1}>
              {displayName}
            </Text>
          </View>
        ) : (
          <Text className="flex-1 px-2 text-center text-lg font-bold text-[#3A1F04]" numberOfLines={1}>
            {title}
          </Text>
        )}

        <View className="flex-row items-center gap-1">
          {isHome ? (
            <Pressable
              onPress={() => router.push('/(customer)/chat' as never)}
              accessibilityRole="button"
              accessibilityLabel="Hỗ trợ và trao đổi"
              accessibilityHint="Mở danh sách hội thoại theo đơn hàng"
              className="h-11 w-11 items-center justify-center rounded-full bg-[#F8F3EF]"
              style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
            >
              <Ionicons name="chatbubble-ellipses-outline" size={20} color="#8B4513" />
            </Pressable>
          ) : null}

          <Pressable
            onPress={() => router.push('/(customer)/notifications' as never)}
            accessibilityRole="button"
            accessibilityLabel={unreadCount > 0 ? `Thông báo, ${unreadCount} chưa đọc` : 'Thông báo'}
            accessibilityHint="Mở trung tâm thông báo"
            className="relative h-11 w-11 items-center justify-center rounded-full bg-[#F8F3EF]"
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
          >
            <Ionicons name="notifications-outline" size={21} color="#8B4513" />
            {unreadCount > 0 ? (
              <View className="absolute right-1 top-1 min-w-[18px] h-[18px] items-center justify-center rounded-full bg-[#C2410C] px-1">
                <Text className="text-[10px] font-bold text-white">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </Text>
              </View>
            ) : null}
          </Pressable>

          {isHome ? (
            <Pressable
              onPress={() => router.push('/(customer)/profile' as never)}
              accessibilityRole="button"
              accessibilityLabel="Mở hồ sơ cá nhân"
              className="h-11 w-11 items-center justify-center rounded-full bg-[#3A1F04]"
              style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
            >
              <Ionicons name="person-outline" size={20} color="#FFFFFF" />
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  );
}
