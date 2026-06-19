import React, { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';

import { getApiErrorMessage } from '../../services/apiClient';
import { getUserIdFromToken } from '../../services/jwt';
import { getUserNotifications } from '../../services/notificationApi';
import { useAuthStore } from '../../store/useAuthStore';

export default function CustomerHomeScreen() {
  const router = useRouter();
  const logout = useAuthStore((state) => state.logout);
  const accessToken = useAuthStore((state) => state.token);
  const fullName = useAuthStore((state) => state.fullName ?? state.user?.fullName ?? null);
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
      console.error('[CustomerHome] Failed to load unread notifications', {
        message: getApiErrorMessage(error),
      });
    }
  }, [accessToken, userId]);

  useFocusEffect(
    useCallback(() => {
      fetchUnreadCount();
    }, [fetchUnreadCount])
  );

  return (
    <View className="flex-1 bg-[#F5F2F0] px-5 py-6">
      <View className="mb-6 flex-row items-center justify-between">
        <View className="flex-1 pr-4">
          <Text className="text-xs font-bold uppercase tracking-widest text-[#877369]">Customer</Text>
          <Text className="mt-1 text-2xl font-bold text-[#3A1F04]" numberOfLines={1}>
            {fullName || 'ColdChainX'}
          </Text>
        </View>
        <Pressable onPress={logout} className="rounded-xl border border-[#8B4513]/20 bg-white px-4 py-2">
          <Text className="font-semibold text-[#8B4513]">Logout</Text>
        </Pressable>
      </View>

      <View className="rounded-3xl bg-[#3A1F04] p-5">
        <Text className="text-xs font-bold uppercase tracking-widest text-[#FFC29F]/70">Cold-chain workspace</Text>
        <Text className="mt-3 text-2xl font-bold text-[#FFC29F]">Quản lý đơn vận chuyển</Text>
        <Text className="mt-2 text-sm leading-6 text-white/70">
          Tạo đơn, theo dõi báo giá, nhận thông báo và giám sát trạng thái giao hàng.
        </Text>
      </View>

      <View className="mt-6 flex-row flex-wrap gap-3">
        <QuickAction
          icon="add-circle-outline"
          title="Create Order"
          subtitle="Tạo đơn mới"
          onPress={() => router.push('/(customer)/create-order')}
        />
        <QuickAction
          icon="list-outline"
          title="My Orders"
          subtitle="Xem đơn hàng"
          onPress={() => router.push('/(customer)/status')}
        />
        <QuickAction
          icon="locate-outline"
          title="Tracking"
          subtitle="Giám sát đơn"
          onPress={() => router.push('/(customer)/tracking')}
        />
        <QuickAction
          icon="notifications-outline"
          title="Notifications"
          subtitle={unreadCount > 0 ? `${unreadCount} chưa đọc` : 'Cập nhật mới'}
          badge={unreadCount}
          onPress={() => router.push('/(customer)/notifications' as never)}
        />
      </View>
    </View>
  );
}

function QuickAction({
  icon,
  title,
  subtitle,
  badge = 0,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  badge?: number;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="min-h-[132px] flex-1 basis-[47%] rounded-2xl border border-[#DAC2B6]/50 bg-white p-4 shadow-sm"
    >
      <View className="flex-row items-start justify-between">
        <View className="h-11 w-11 items-center justify-center rounded-full bg-[#8B4513]/10">
          <Ionicons name={icon} size={22} color="#8B4513" />
        </View>
        {badge > 0 ? (
          <View className="min-w-[22px] items-center justify-center rounded-full bg-red-500 px-1.5 py-0.5">
            <Text className="text-[10px] font-bold text-white">{badge > 99 ? '99+' : badge}</Text>
          </View>
        ) : null}
      </View>
      <Text className="mt-4 text-base font-bold text-[#3A1F04]">{title}</Text>
      <Text className="mt-1 text-xs font-medium text-[#877369]">{subtitle}</Text>
    </Pressable>
  );
}
