import React, { useEffect } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { colors } from '../constants/colors';
import { useAuthStore } from '../store/useAuthStore';
import { useNotificationStore } from '../store/useNotificationStore';

export const CUSTOMER_HEADER_HEIGHT = 64;

interface CustomerHeaderProps {
  title: string;
  showBackButton?: boolean;
}

export function CustomerHeader({ title, showBackButton = false }: CustomerHeaderProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const accessToken = useAuthStore((state) => state.token);
  const fullName = useAuthStore((state) => state.fullName ?? state.user?.fullName ?? null);
  const unreadCount = useNotificationStore((state) => state.unreadCount);
  const fetchUnreadCount = useNotificationStore((state) => state.fetchUnreadCount);
  const isHome = title === 'ColdChainX';
  const displayName = fullName?.trim() || 'bạn';

  useEffect(() => {
    if (accessToken) {
      fetchUnreadCount(accessToken);
    }
  }, [accessToken, fetchUnreadCount]);

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
      <View className="h-[64px] flex-row items-center justify-between px-5">
        {showBackButton ? (
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Quay lại"
            accessibilityHint="Trở về màn hình trước"
            style={{ backgroundColor: colors.surface.muted }}
            className="h-11 w-11 items-center justify-center rounded-full"
          >
            <Ionicons name="chevron-back" size={22} color={colors.brand.primary} />
          </Pressable>
        ) : (
          <View className="h-11 w-11" />
        )}

        {isHome ? (
          <View className="flex-1 px-2">
            <Text style={{ color: colors.text.secondary }} className="text-xs font-semibold">Xin chào,</Text>
            <Text style={{ color: colors.text.primary }} className="mt-0.5 text-xl font-bold" numberOfLines={1}>
              {displayName}
            </Text>
          </View>
        ) : (
          <Text style={{ color: colors.text.primary }} className="flex-1 px-2 text-center text-lg font-bold" numberOfLines={1}>
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
              style={{ backgroundColor: colors.surface.muted }}
              className="h-11 w-11 items-center justify-center rounded-full"
            >
              <Ionicons name="chatbubble-ellipses-outline" size={20} color={colors.brand.primary} />
            </Pressable>
          ) : null}

          <Pressable
            onPress={() => router.push('/(customer)/notifications' as never)}
            accessibilityRole="button"
            accessibilityLabel={unreadCount > 0 ? `Thông báo, ${unreadCount} chưa đọc` : 'Thông báo'}
            accessibilityHint="Mở trung tâm thông báo"
            style={{ backgroundColor: colors.surface.muted }}
            className="relative h-11 w-11 items-center justify-center rounded-full"
          >
            <Ionicons name="notifications-outline" size={21} color={colors.brand.primary} />
            {unreadCount > 0 ? (
              <View
                style={{ backgroundColor: colors.status.warning.main }}
                className="absolute right-1 top-1 min-w-[18px] h-[18px] items-center justify-center rounded-full px-1"
              >
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
              style={{ backgroundColor: colors.brand.primary }}
              className="h-11 w-11 items-center justify-center rounded-full"
            >
              <Ionicons name="person-outline" size={20} color={colors.text.onPrimary} />
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  );
}
