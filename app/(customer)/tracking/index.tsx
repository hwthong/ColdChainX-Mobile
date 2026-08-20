import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';

import { colors } from '../../../constants/colors';
import {
  getCustomerOrderStatusPresentation,
  isActiveTrackingStatus,
} from '../../../constants/customerOrderPresentation';
import { getCustomerDataErrorMessage } from '../../../services/apiClient';
import { getMyCustomerOrders, OrderResponse } from '../../../services/orderApi';
import { useAuthStore } from '../../../store/useAuthStore';

export default function TrackingListScreen() {
  const router = useRouter();
  const accessToken = useAuthStore((state) => state.token);

  const [orders, setOrders] = useState<OrderResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trackableOrders = orders.filter(
    (order) => Boolean(order.masterTripId?.trim()) && isActiveTrackingStatus(order.status)
  );

  const loadOrders = useCallback(
    async (silent = false) => {
      if (!accessToken) {
        setError('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
        setIsLoading(false);
        return;
      }
      try {
        if (!silent) setError(null);
        const response = await getMyCustomerOrders(accessToken, 1, 50);
        if (!response.success) {
          setOrders([]);
          setError(response.message || 'Không thể tải đơn hàng.');
          return;
        }
        setOrders(response.data ?? []);
      } catch (err) {
        setOrders([]);
        setError(getCustomerDataErrorMessage(err));
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [accessToken]
  );

  useFocusEffect(
    useCallback(() => {
      setIsLoading(true);
      void loadOrders();

      let appState = AppState.currentState;
      const subscription = AppState.addEventListener('change', (nextState) => {
        if (appState !== 'active' && nextState === 'active') {
          void loadOrders(true);
        }
        appState = nextState;
      });
      return () => subscription.remove();
    }, [loadOrders])
  );

  const onRefresh = useCallback(() => {
    setIsRefreshing(true);
    void loadOrders(true);
  }, [loadOrders]);

  if (isLoading) {
    return (
      <View style={{ backgroundColor: colors.surface.page }} className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" color={colors.brand.primary} />
        <Text style={{ color: colors.brand.primary }} className="mt-4 font-medium">
          Đang tải...
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={{ backgroundColor: colors.surface.page }}
      className="flex-1"
      contentContainerStyle={{ padding: 20, paddingBottom: 100, gap: 12 }}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={onRefresh}
          tintColor={colors.brand.primary}
        />
      }
      showsVerticalScrollIndicator={false}
    >
      {error ? (
        <View className="rounded-2xl border border-red-200 bg-red-50 p-4">
          <Text className="text-sm font-semibold leading-5 text-red-700">{error}</Text>
          <Pressable
            onPress={() => void loadOrders()}
            style={{ backgroundColor: colors.brand.primary }}
            className="mt-3 self-start rounded-xl px-4 py-2"
          >
            <Text style={{ color: colors.text.onPrimary }} className="font-bold">
              Thử lại
            </Text>
          </Pressable>
        </View>
      ) : trackableOrders.length === 0 ? (
        orders.length === 0 ? (
          <EmptyOrder onCreateOrder={() => router.push('/(customer)/create-order')} />
        ) : (
          <EmptyTransit onViewOrders={() => router.push('/(customer)/status' as never)} />
        )
      ) : (
        <>
          <View
            style={{ backgroundColor: colors.surface.card, borderColor: colors.border.default }}
            className="flex-row items-center gap-2 rounded-2xl border px-4 py-3"
          >
            <View
              style={{ backgroundColor: colors.brand.primarySoft }}
              className="h-8 w-8 items-center justify-center rounded-lg"
            >
              <Ionicons name="locate" size={16} color={colors.brand.primary} />
            </View>
            <View className="flex-1">
              <Text style={{ color: colors.text.primary }} className="text-sm font-bold">
                {trackableOrders.length} đơn đang vận chuyển
              </Text>
              <Text style={{ color: colors.text.secondary }} className="text-xs">
                Chọn đơn để xem bản đồ và dữ liệu chuyến
              </Text>
            </View>
          </View>

          {trackableOrders.map((order) => (
            <TrackableOrderCard
              key={order.orderId}
              order={order}
              onPress={() =>
                router.push({
                  pathname: '/(customer)/tracking/[orderId]',
                  params: {
                    orderId: order.orderId,
                    trackingCode: order.trackingCode,
                  },
                } as never)
              }
            />
          ))}
        </>
      )}
    </ScrollView>
  );
}

function TrackableOrderCard({
  order,
  onPress,
}: {
  order: OrderResponse;
  onPress: () => void;
}) {
  const status = getCustomerOrderStatusPresentation(order.status);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        backgroundColor: colors.surface.card,
        borderColor: colors.border.default,
        opacity: pressed ? 0.8 : 1,
      })}
      className="overflow-hidden rounded-2xl border shadow-sm"
    >
      {/* Top accent bar */}
      <View style={{ backgroundColor: colors.brand.primary }} className="h-1 w-full" />

      <View className="p-4">
        {/* Header row */}
        <View className="flex-row items-start justify-between gap-3">
          <View className="flex-1">
            <Text style={{ color: colors.brand.primary }} className="text-base font-bold">
              {order.trackingCode}
            </Text>
            <Text style={{ color: colors.text.primary }} className="mt-0.5 text-sm font-medium" numberOfLines={1}>
              {order.itemName}
            </Text>
          </View>
          <View className="flex-row items-center gap-1.5">
            <View className={`rounded-full border px-2.5 py-1 ${status.containerClass}`}>
              <Text className={`text-[10px] font-bold uppercase tracking-wider ${status.textClass}`}>
                {status.label}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.text.muted} />
          </View>
        </View>

        {/* Route info if available */}
        {order.route ? (
          <View
            style={{ backgroundColor: colors.surface.page, borderColor: colors.border.default }}
            className="mt-3 flex-row items-center gap-2 rounded-xl border px-3 py-2"
          >
            <Ionicons name="navigate-outline" size={14} color={colors.brand.primary} />
            <Text style={{ color: colors.text.secondary }} className="flex-1 text-xs" numberOfLines={1}>
              {order.route.originCity ?? '--'} → {order.route.destCity ?? '--'}
            </Text>
          </View>
        ) : null}

        {/* Footer */}
        <View className="mt-3 flex-row items-center justify-between">
          <View className="flex-row items-center gap-1.5">
            <Ionicons name="locate-outline" size={14} color={colors.brand.primary} />
            <Text style={{ color: colors.brand.primary }} className="text-xs font-semibold">
              Xem bản đồ & giám sát
            </Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

function EmptyOrder({ onCreateOrder }: { onCreateOrder: () => void }) {
  return (
    <View style={{ backgroundColor: colors.surface.card }} className="items-center rounded-3xl p-8">
      <Ionicons name="locate-outline" size={56} color={colors.text.secondary} />
      <Text style={{ color: colors.text.primary }} className="mt-4 text-center text-base font-bold">
        Chưa có đơn hàng
      </Text>
      <Text style={{ color: colors.text.secondary }} className="mt-2 text-center text-sm leading-5">
        Tạo đơn hàng và chờ được điều phối vào chuyến để bắt đầu giám sát.
      </Text>
      <Pressable
        onPress={onCreateOrder}
        style={{ backgroundColor: colors.brand.primary }}
        className="mt-5 rounded-xl px-5 py-3"
      >
        <Text style={{ color: colors.text.onPrimary }} className="font-bold">
          Tạo đơn mới
        </Text>
      </Pressable>
    </View>
  );
}

function EmptyTransit({ onViewOrders }: { onViewOrders: () => void }) {
  return (
    <View style={{ backgroundColor: colors.surface.card }} className="items-center rounded-3xl p-8">
      <Ionicons name="time-outline" size={56} color={colors.text.secondary} />
      <Text style={{ color: colors.text.primary }} className="mt-4 text-center text-base font-bold">
        Chưa có chuyến nào đang chạy
      </Text>
      <Text style={{ color: colors.text.secondary }} className="mt-2 text-center text-sm leading-5">
        Đơn hàng đang chờ điều phối xe. Bạn có thể theo dõi tiến độ tại tab Đơn hàng.
      </Text>
      <Pressable
        onPress={onViewOrders}
        style={{ backgroundColor: colors.brand.primary }}
        className="mt-5 rounded-xl px-5 py-3"
      >
        <Text style={{ color: colors.text.onPrimary }} className="font-bold">
          Xem tab Đơn hàng
        </Text>
      </Pressable>
    </View>
  );
}
