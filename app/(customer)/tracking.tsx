import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';

import { getApiErrorMessage } from '../../services/apiClient';
import { getCustomerIdFromToken, getUserIdFromToken } from '../../services/jwt';
import { getMockDeliveryFlow } from '../../services/mockDeliveryApi';
import { getUserNotifications, NotificationResponse } from '../../services/notificationApi';
import { getCustomerOrders, OrderResponse } from '../../services/orderApi';
import {
  buildDispatchTimeline,
  mockAlertLogs,
  mockTemperatureLogs,
  mockTrackingData,
  TimelineStep,
} from '../../services/trackingMock';
import { useAuthStore } from '../../store/useAuthStore';

export default function TrackingScreen() {
  const router = useRouter();
  const accessToken = useAuthStore((state) => state.token);
  const storedCustomerId = useAuthStore((state) => state.customerId ?? state.user?.customerId ?? null);
  const storedUserId = useAuthStore((state) => state.userId ?? state.user?.userId ?? null);
  const customerId = storedCustomerId ?? (accessToken ? getCustomerIdFromToken(accessToken) : null);
  const userId = storedUserId ?? (accessToken ? getUserIdFromToken(accessToken) : null);

  const [orders, setOrders] = useState<OrderResponse[]>([]);
  const [notifications, setNotifications] = useState<NotificationResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeOrder = useMemo(() => {
    return orders.find((order) => !isClosedStatus(order.status)) ?? orders[0] ?? null;
  }, [orders]);

  const relatedNotifications = useMemo(() => {
    if (!activeOrder) return notifications.slice(0, 3);

    return notifications
      .filter((notification) => isNotificationRelatedToOrder(notification, activeOrder))
      .slice(0, 3);
  }, [activeOrder, notifications]);

  const dispatchTimeline = useMemo(
    () => buildDispatchTimeline(activeOrder?.status ?? 'PENDING_REVIEW'),
    [activeOrder?.status]
  );

  const deliveryFlow = useMemo(
    () => getMockDeliveryFlow(activeOrder?.status ?? 'PENDING_REVIEW', activeOrder?.destination?.address),
    [activeOrder?.destination?.address, activeOrder?.status]
  );

  const fetchTrackingData = useCallback(async () => {
    if (!accessToken || !customerId) {
      setError('Không tìm thấy phiên đăng nhập hoặc mã khách hàng. Vui lòng đăng nhập lại.');
      setOrders([]);
      setNotifications([]);
      setIsLoading(false);
      setIsRefreshing(false);
      return;
    }

    try {
      setError(null);
      const [ordersResponse, notificationsResponse] = await Promise.all([
        getCustomerOrders(accessToken, customerId, 1, 10),
        userId
          ? getUserNotifications(accessToken, userId, {
              unreadOnly: false,
              pageNumber: 1,
              pageSize: 20,
            })
          : Promise.resolve(null),
      ]);

      if (ordersResponse.success) {
        setOrders(ordersResponse.data ?? []);
      } else {
        setError(ordersResponse.message || 'Không thể tải danh sách đơn để giám sát.');
      }

      if (notificationsResponse?.success && notificationsResponse.data) {
        setNotifications(notificationsResponse.data.items);
      }
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [accessToken, customerId, userId]);

  useFocusEffect(
    useCallback(() => {
      setIsLoading(true);
      fetchTrackingData();
    }, [fetchTrackingData])
  );

  const onRefresh = () => {
    setIsRefreshing(true);
    fetchTrackingData();
  };

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-[#F5F2F0]">
        <ActivityIndicator size="large" color="#8B4513" />
        <Text className="mt-4 font-medium text-[#8B4513]">Đang tải giám sát đơn...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      className="flex-1 bg-[#F5F2F0]"
      contentContainerStyle={{ padding: 20, paddingBottom: 100, gap: 16 }}
      refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor="#8B4513" />}
      showsVerticalScrollIndicator={false}
    >
      {error ? (
        <View className="rounded-2xl border border-red-200 bg-red-50 p-4">
          <Text className="font-semibold leading-5 text-red-700">{error}</Text>
          <Pressable onPress={fetchTrackingData} className="mt-3 self-start rounded-xl bg-[#8B4513] px-4 py-2">
            <Text className="font-bold text-white">Thử lại</Text>
          </Pressable>
        </View>
      ) : null}

      {!activeOrder ? (
        <View className="items-center justify-center rounded-3xl bg-white p-8">
          <Ionicons name="locate-outline" size={56} color="#877369" />
          <Text className="mt-4 text-center text-base font-bold text-[#3A1F04]">Chưa có đơn để giám sát</Text>
          <Text className="mt-2 text-center text-sm leading-6 text-[#877369]">
            Khi bạn tạo đơn vận chuyển, trạng thái và cảnh báo sẽ xuất hiện tại đây.
          </Text>
          <Pressable
            onPress={() => router.push('/(customer)/create-order')}
            className="mt-5 rounded-xl bg-[#8B4513] px-5 py-3"
          >
            <Text className="font-bold text-white">Tạo đơn mới</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <View className="rounded-3xl bg-[#3A1F04] p-5">
            <View className="flex-row items-start justify-between gap-3">
              <View className="flex-1">
                <Text className="text-xs font-bold uppercase tracking-widest text-[#FFC29F]/70">
                  Tracking code
                </Text>
                <Text className="mt-2 text-2xl font-bold text-[#FFC29F]">{activeOrder.trackingCode}</Text>
                <Text className="mt-2 text-sm leading-5 text-white/70">{activeOrder.itemName}</Text>
              </View>
              <StatusBadge status={activeOrder.status} />
            </View>

            <View className="mt-5 gap-3 rounded-2xl bg-white/10 p-4">
              <InfoLine icon="git-branch-outline" text={formatRoute(activeOrder)} />
              <InfoLine icon="location-outline" text={activeOrder.destination?.address || 'Chưa cập nhật địa chỉ'} />
            </View>
          </View>

          <SectionCard title="Cold-chain monitoring" icon="thermometer-outline">
            {/* TODO: replace mock tracking data with real IoT/tracking API */}
            <View className="flex-row gap-3">
              <MetricCard label="Nhiệt độ" value={`${mockTrackingData.currentTemperatureC} °C`} />
              <MetricCard label="Độ ẩm" value={`${mockTrackingData.humidityPercent}%`} />
            </View>
            <InfoRow label="Vị trí hiện tại" value={mockTrackingData.currentLocation} />
            <InfoRow label="GPS" value={mockTrackingData.gpsStatus} />
            <InfoRow label="Geo-fence" value={mockTrackingData.geoFenceStatus} />
            <View className="rounded-2xl border border-green-200 bg-green-50 p-4">
              <Text className="text-sm font-semibold leading-5 text-green-700">{mockTrackingData.smartAlert}</Text>
            </View>
          </SectionCard>

          <SectionCard title="Temperature log" icon="pulse-outline">
            {/* TODO: replace mock tracking data with real IoT/tracking API */}
            {mockTemperatureLogs.map((log) => (
              <View key={log.time} className="flex-row items-start justify-between gap-3 border-b border-[#DAC2B6]/30 pb-3">
                <View>
                  <Text className="text-sm font-bold text-[#3A1F04]">{log.time}</Text>
                  <Text className="mt-1 text-xs text-[#877369]">{log.note}</Text>
                </View>
                <Text className="text-sm font-bold text-[#006E0A]">
                  {log.temperatureC} °C / {log.humidityPercent}%
                </Text>
              </View>
            ))}
          </SectionCard>

          <SectionCard title="Notification alerts" icon="notifications-outline">
            {relatedNotifications.length > 0 ? (
              relatedNotifications.map((notification, index) => (
                <AlertRow
                  key={notification.notificationId ?? notification.id ?? `notification-${index}`}
                  title={notification.title || notification.type || 'ColdChainX alert'}
                  message={notification.message || notification.content || 'Bạn có cập nhật mới từ ColdChainX.'}
                />
              ))
            ) : (
              mockAlertLogs.map((alert) => (
                <AlertRow key={alert.id} title={alert.title} message={alert.message} />
              ))
            )}
          </SectionCard>

          <SectionCard title="Dispatch status" icon="file-tray-stacked-outline">
            {/* TODO: connect real dispatch/trip status when customer tracking endpoint is available */}
            <TimelineList steps={dispatchTimeline} />
          </SectionCard>

          <SectionCard title="Door delivery" icon="home-outline">
            {/* TODO: replace mock delivery flow when backend provides delivery/check-in/ePOD/COD APIs */}
            <TimelineList
              steps={deliveryFlow.stops.map((stop) => ({
                key: stop.id,
                title: stop.label,
                description: `${stop.address} - ETA ${stop.eta}`,
                state: stop.status === 'done' ? 'done' : stop.status === 'current' ? 'current' : stop.status === 'issue' ? 'issue' : 'pending',
              }))}
            />
            <InfoRow label="e-POD" value={deliveryFlow.epodStatus} />
            <InfoRow label="COD" value={deliveryFlow.codStatus} />
          </SectionCard>
        </>
      )}
    </ScrollView>
  );
}

function SectionCard({
  title,
  icon,
  children,
}: {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  children: React.ReactNode;
}) {
  return (
    <View className="rounded-2xl border border-[#DAC2B6]/50 bg-white p-5 shadow-sm">
      <View className="mb-4 flex-row items-center gap-2 border-b border-[#DAC2B6]/30 pb-3">
        <Ionicons name={icon} size={18} color="#8B4513" />
        <Text className="text-base font-bold text-[#8B4513]">{title}</Text>
      </View>
      <View className="gap-3">{children}</View>
    </View>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-1 rounded-2xl bg-[#F8F9FA] p-4">
      <Text className="text-xs font-semibold text-[#877369]">{label}</Text>
      <Text className="mt-2 text-xl font-bold text-[#3A1F04]">{value}</Text>
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-start justify-between gap-4">
      <Text className="text-sm text-[#877369]">{label}</Text>
      <Text className="flex-1 text-right text-sm font-semibold text-[#3A1F04]">{value}</Text>
    </View>
  );
}

function InfoLine({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  return (
    <View className="flex-row items-start gap-2">
      <Ionicons name={icon} size={16} color="#FFC29F" />
      <Text className="flex-1 text-sm font-semibold leading-5 text-white">{text}</Text>
    </View>
  );
}

function AlertRow({ title, message }: { title: string; message: string }) {
  return (
    <View className="rounded-2xl border border-[#DAC2B6]/50 bg-[#F8F9FA] p-4">
      <Text className="text-sm font-bold text-[#3A1F04]">{title}</Text>
      <Text className="mt-1 text-xs leading-5 text-[#877369]">{message}</Text>
    </View>
  );
}

function TimelineList({ steps }: { steps: TimelineStep[] }) {
  return (
    <View className="gap-3">
      {steps.map((step) => (
        <View key={step.key} className="flex-row items-start gap-3">
          <View className={`mt-1 h-3 w-3 rounded-full ${getTimelineDot(step.state)}`} />
          <View className="flex-1">
            <Text className="text-sm font-bold text-[#3A1F04]">{step.title}</Text>
            <Text className="mt-1 text-xs leading-5 text-[#877369]">{step.description}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

function StatusBadge({ status }: { status: string }) {
  return (
    <View className="rounded-full bg-[#FFC29F]/15 px-3 py-1">
      <Text className="text-[10px] font-bold uppercase text-[#FFC29F]">{translateStatus(status)}</Text>
    </View>
  );
}

function getTimelineDot(state: TimelineStep['state']) {
  switch (state) {
    case 'done':
      return 'bg-green-600';
    case 'current':
      return 'bg-[#8B4513]';
    case 'issue':
      return 'bg-red-600';
    default:
      return 'bg-[#DAC2B6]';
  }
}

function isClosedStatus(status: string) {
  return ['DELIVERED', 'REJECTED', 'CANCELLED'].includes(status.toUpperCase());
}

function formatRoute(order: OrderResponse) {
  if (!order.route) return 'Tuyến vận chuyển đang được cập nhật';
  return `${order.route.routeCode} - ${order.route.originCity} -> ${order.route.destCity}`;
}

function translateStatus(status: string) {
  switch (status.toUpperCase()) {
    case 'PENDING_REVIEW':
      return 'Chờ duyệt';
    case 'QUOTING':
      return 'Đang báo giá';
    case 'CONTRACT_PENDING':
      return 'Chờ hợp đồng';
    case 'ASSIGNED':
      return 'Đã phân xe';
    case 'IN_TRANSIT':
      return 'Đang giao';
    case 'DELIVERED':
      return 'Đã giao';
    case 'REJECTED':
      return 'Từ chối';
    case 'CANCELLED':
      return 'Đã hủy';
    default:
      return status;
  }
}

function isNotificationRelatedToOrder(notification: NotificationResponse, order: OrderResponse) {
  const orderId = getNotificationOrderId(notification);
  if (orderId && orderId === order.orderId) return true;

  const searchableText = `${notification.title ?? ''} ${notification.message ?? ''} ${notification.content ?? ''}`;
  return Boolean(order.trackingCode && searchableText.includes(order.trackingCode));
}

function getNotificationOrderId(notification: NotificationResponse) {
  return (
    notification.orderId ??
    getOrderIdFromUnknown(notification.data) ??
    getOrderIdFromUnknown(notification.payload)
  );
}

function getOrderIdFromUnknown(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === 'string') {
    try {
      return getOrderIdFromUnknown(JSON.parse(value));
    } catch {
      return null;
    }
  }

  if (typeof value !== 'object') return null;

  const record = value as Record<string, unknown>;
  const orderId = record.orderId ?? record.OrderId;
  return typeof orderId === 'string' && orderId.trim() ? orderId : null;
}
