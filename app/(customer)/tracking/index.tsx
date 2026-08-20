import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
  isDeliveredStatus,
  isMonitoringEligibleStatus,
} from '../../../constants/customerOrderPresentation';
import { getCustomerDataErrorMessage } from '../../../services/apiClient';
import { getMyCustomerOrders, OrderResponse } from '../../../services/orderApi';
import { signalRService } from '../../../services/signalrService';
import { useAuthStore } from '../../../store/useAuthStore';

export default function TrackingListScreen() {
  const router = useRouter();
  const accessToken = useAuthStore((state) => state.token);

  const [orders, setOrders] = useState<OrderResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trackableOrders = orders.filter(
    (order) => Boolean(order.masterTripId?.trim()) && isMonitoringEligibleStatus(order.status)
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

      let active = true;
      const interval = setInterval(() => {
        if (active && AppState.currentState === 'active') {
          void loadOrders(true);
        }
      }, 8_000);

      // Listen to real-time SignalR events for instant list updates
      const unsubNotification = signalRService.onNotification(() => {
        if (active) void loadOrders(true);
      });
      const unsubAlert = signalRService.on('ReceiveColdChainAlert', () => {
        if (active) void loadOrders(true);
      });

      let appState = AppState.currentState;
      const subscription = AppState.addEventListener('change', (nextState) => {
        if (appState !== 'active' && nextState === 'active') {
          void loadOrders(true);
        }
        appState = nextState;
      });

      return () => {
        active = false;
        clearInterval(interval);
        subscription.remove();
        unsubNotification();
        unsubAlert();
      };
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
          Đang tải giám sát...
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={{ backgroundColor: colors.surface.page }}
      className="flex-1"
      contentContainerStyle={{ padding: 20, paddingBottom: 100, gap: 16 }}
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
            style={{
              backgroundColor: colors.surface.card,
              borderColor: colors.border.default,
              borderWidth: 1,
              borderRadius: 16,
            }}
            className="flex-row items-center gap-3 p-4"
          >
            <View
              style={{ backgroundColor: colors.brand.primarySoft }}
              className="h-10 w-10 items-center justify-center rounded-xl"
            >
              <Ionicons name="navigate" size={20} color={colors.brand.primary} />
            </View>
            <View className="flex-1">
              <Text style={{ color: colors.text.primary }} className="text-base font-bold">
                {trackableOrders.length} đơn đang trên chuyến
              </Text>
              <Text style={{ color: colors.text.secondary }} className="mt-0.5 text-xs">
                Chọn đơn hàng để theo dõi vị trí xe & nhiệt độ thùng hàng
              </Text>
            </View>
          </View>

          {trackableOrders.map((order) => (
            <TrackableOrderCard
              key={order.orderId}
              order={order}
              onPress={() => {
                if (isDeliveredStatus(order.status)) {
                  Alert.alert(
                    'Thông báo',
                    'Đơn hàng của bạn đã được giao rồi',
                    [
                      { text: 'Đóng', style: 'cancel' },
                      {
                        text: 'Xem chi tiết đơn hàng',
                        onPress: () => router.push(`/(customer)/orders/${order.orderId}` as never),
                      },
                    ]
                  );
                  return;
                }
                router.push({
                  pathname: '/(customer)/tracking/[orderId]',
                  params: {
                    orderId: order.orderId,
                    trackingCode: order.trackingCode,
                  },
                } as never);
              }}
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
  const isDelivered = isDeliveredStatus(order.status);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        backgroundColor: colors.surface.card,
        borderColor: isDelivered ? 'rgba(22, 163, 74, 0.3)' : colors.border.default,
        borderWidth: 1,
        borderRadius: 16,
        opacity: pressed ? 0.75 : 1,
      })}
      className="p-5"
    >
      <View className="mb-3 flex-row items-start justify-between gap-3">
        <View className="flex-1">
          <Text style={{ color: isDelivered ? '#15803D' : colors.brand.primary }} className="text-lg font-bold">
            {order.trackingCode}
          </Text>
          <Text style={{ color: colors.text.muted }} className="mt-1 text-xs">
            {formatDate(order.createdAt)}
          </Text>
        </View>
        <StatusBadge status={order.status} />
      </View>

      <View className="flex-row gap-3">
        <View
          style={{ backgroundColor: isDelivered ? '#F0FDF4' : colors.brand.primarySoft }}
          className="h-20 w-20 items-center justify-center rounded-xl"
        >
          <Ionicons
            name={isDelivered ? 'checkmark-done-circle-outline' : 'cube-outline'}
            size={26}
            color={isDelivered ? '#16A34A' : colors.brand.primary}
          />
        </View>

        <View className="flex-1 gap-1.5">
          <Text style={{ color: colors.text.primary }} className="text-base font-semibold" numberOfLines={1}>
            {order.itemName}
          </Text>

          {order.route?.routeCode ? (
            <View className="flex-row items-center gap-1.5">
              <Ionicons name="git-branch-outline" size={15} color={isDelivered ? '#16A34A' : colors.brand.primary} />
              <Text style={{ color: isDelivered ? '#16A34A' : colors.brand.primary }} className="text-xs font-semibold">
                Tuyến {order.route.routeCode}
              </Text>
            </View>
          ) : null}

          {order.destination?.address ? (
            <View className="flex-row items-start gap-1.5">
              <Ionicons name="location-outline" size={15} color={colors.text.secondary} />
              <Text style={{ color: colors.text.secondary }} className="flex-1 text-xs leading-4" numberOfLines={2}>
                {order.destination.address}
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      <View
        style={{ backgroundColor: isDelivered ? '#16A34A' : colors.brand.primary }}
        className="mt-4 flex-row items-center justify-center gap-2 rounded-xl py-2.5"
      >
        <Ionicons
          name={isDelivered ? 'checkmark-circle-outline' : 'navigate-circle-outline'}
          size={18}
          color={colors.text.onPrimary}
        />
        <Text style={{ color: colors.text.onPrimary }} className="text-sm font-bold">
          {isDelivered ? 'Đã giao hàng' : 'Xem bản đồ & dữ liệu giám sát'}
        </Text>
        <Ionicons name="chevron-forward" size={16} color={colors.text.onPrimary} />
      </View>
    </Pressable>
  );
}

function StatusBadge({ status }: { status: string }) {
  const presentation = getCustomerOrderStatusPresentation(status);

  return (
    <View className={`rounded-full border px-2.5 py-1 ${presentation.containerClass}`}>
      <Text className={`text-[10px] font-bold uppercase tracking-wider ${presentation.textClass}`}>
        {presentation.label}
      </Text>
    </View>
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

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleString('vi-VN') : 'Chưa cập nhật';
}

