import React, { useCallback, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';

import { getUserNotifications } from '../services/notificationApi';
import { getUserIdFromToken } from '../services/jwt';
import { useAuthStore } from '../store/useAuthStore';

interface CustomerHeaderProps {
  title: string;
  showBackButton?: boolean;
}

export function CustomerHeader({ title, showBackButton = false }: CustomerHeaderProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const accessToken = useAuthStore((state) => state.token);
  const storedUserId = useAuthStore((state) => state.userId ?? state.user?.userId ?? null);
  const userId = storedUserId ?? (accessToken ? getUserIdFromToken(accessToken) : null);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchUnreadCount = useCallback(async () => {
    if (!accessToken || !userId) {
      setUnreadCount(0);
      return;
    }

    try {
      const response = await getUserNotifications(accessToken, userId, {
        unreadOnly: true,
        pageNumber: 1,
        pageSize: 10,
      });

      if (response.success && response.data) {
        setUnreadCount(response.data.totalRecords);
      }
    } catch (error) {
      console.error('[CustomerHeader] Failed to load unread notifications', {
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }, [accessToken, userId]);

  useFocusEffect(
    useCallback(() => {
      fetchUnreadCount();
    }, [fetchUnreadCount])
  );

  return (
    <View
      style={{ paddingTop: insets.top }}
      className="bg-[#3A1F04] w-full flex-col z-50 shadow-sm border-b border-[#DAC2B6]/10"
    >
      <View className="flex-row items-center justify-between h-[60px] px-5">
        {showBackButton ? (
          <Pressable
            onPress={() => router.back()}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-white/10 active:bg-white/20 transition-colors"
          >
            <Ionicons name="chevron-back" size={24} color="#FFC29F" />
          </Pressable>
        ) : (
          <View className="w-10 h-10" /> // Spacer for alignment
        )}

        <Text
          className={`flex-1 text-center text-[#FFC29F] tracking-tight ${
            title === 'ColdChainX' ? 'font-serif italic font-bold text-[26px]' : 'font-bold text-xl'
          }`}
        >
          {title}
        </Text>

        <Pressable
          onPress={() => router.push('/(customer)/notifications' as never)}
          className="w-10 h-10 flex items-center justify-center rounded-full bg-white/10 active:bg-white/20 transition-colors"
        >
          <Ionicons name="notifications-outline" size={21} color="#FFFFFF" />
          {unreadCount > 0 ? (
            <View className="absolute right-1 top-1 min-w-[18px] h-[18px] items-center justify-center rounded-full bg-[#FF4D4F] px-1">
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
