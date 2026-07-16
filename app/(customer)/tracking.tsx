import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';

import { GoongRouteMap } from '../../components/customer/GoongRouteMap';
import { getApiErrorMessage } from '../../services/apiClient';
import { getCustomerIdFromToken, getUserIdFromToken } from '../../services/jwt';
import { getMockDeliveryFlow } from '../../services/mockDeliveryApi';
import { getUserNotifications, NotificationResponse } from '../../services/notificationApi';
import { getCustomerOrders, OrderResponse } from '../../services/orderApi';
import {
  getPlannedTripRoute,
  getTrackingByTripId,
  sanitizeTripId,
  TrackingDataResponse,
  TripRouteResponse,
} from '../../services/trackingApi';
import {
  buildDispatchTimeline,
  mockAlertLogs,
  mockTemperatureLogs,
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
  const [trackingData, setTrackingData] = useState<TrackingDataResponse | null>(null);
  const [isTrackingLoading, setIsTrackingLoading] = useState(false);
  const [plannedRoute, setPlannedRoute] = useState<TripRouteResponse | null>(null);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [isRouteLoading, setIsRouteLoading] = useState(false);
  const [devTripId, setDevTripId] = useState('');

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

  const canUseDevTripFallback =
    __DEV__ &&
    Boolean(accessToken && customerId) &&
    (!activeOrder?.masterTripId || Boolean(error));

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

  const fetchRealTracking = useCallback(async (tripId: string) => {
    if (!accessToken) return;
    setIsTrackingLoading(true);
    try {
      const res = await getTrackingByTripId(accessToken, tripId);
      if (res.success && res.data) {
        setTrackingData(res.data);
      } else {
        setTrackingData(null);
      }
    } catch (err) {
      console.log('Error fetching tracking data', err);
      setTrackingData(null);
    } finally {
      setIsTrackingLoading(false);
    }
  }, [accessToken]);

  const fetchPlannedRoute = useCallback(async (tripId: string) => {
    if (!accessToken) return;

    setIsRouteLoading(true);
    setRouteError(null);
    try {
      const res = await getPlannedTripRoute(accessToken, tripId);
      if (res.success && res.data) {
        setPlannedRoute(res.data);
      } else {
        setPlannedRoute(null);
        setRouteError(res.message || 'Không thể tải tuyến đường dự kiến.');
      }
    } catch (err) {
      console.log('Error fetching planned trip route', err);
      setPlannedRoute(null);
      setRouteError(getApiErrorMessage(err));
    } finally {
      setIsRouteLoading(false);
    }
  }, [accessToken]);

  const fetchDevTripRoute = useCallback(() => {
    const tripId = sanitizeTripId(devTripId);

    if (!tripId) {
      setPlannedRoute(null);
      setRouteError('TripId không hợp lệ. Vui lòng nhập UUID của chuyến.');
      return;
    }

    setDevTripId(tripId);
    setTrackingData(null);
    fetchPlannedRoute(tripId);
  }, [devTripId, fetchPlannedRoute]);

  React.useEffect(() => {
    if (activeOrder?.masterTripId) {
      fetchRealTracking(activeOrder.masterTripId);
      fetchPlannedRoute(activeOrder.masterTripId);
    } else {
      setTrackingData(null);
      setPlannedRoute(null);
      setRouteError(null);
    }
  }, [activeOrder?.masterTripId, fetchPlannedRoute, fetchRealTracking]);

  useFocusEffect(
    useCallback(() => {
      setIsLoading(true);
      fetchTrackingData();
    }, [fetchTrackingData])
  );

  const onRefresh = () => {
    setIsRefreshing(true);
    fetchTrackingData();
    if (activeOrder?.masterTripId) {
      fetchRealTracking(activeOrder.masterTripId);
      fetchPlannedRoute(activeOrder.masterTripId);
    }
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

      {/* DEV ONLY - remove after customer orders API fixed */}
      {canUseDevTripFallback ? (
        <DevTripRouteFallback
          tripId={devTripId}
          onTripIdChange={setDevTripId}
          onLoadRoute={fetchDevTripRoute}
          route={plannedRoute}
          routeError={routeError}
          isRouteLoading={isRouteLoading}
        />
      ) : null}

      {!activeOrder ? (
        canUseDevTripFallback ? null : (
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
        )
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

          <SectionCard title="Bản đồ tuyến đường dự kiến" icon="map-outline">
            {!activeOrder.masterTripId ? (
              <View className="items-center justify-center py-4">
                <Text className="text-center text-sm font-medium leading-6 text-[#877369]">
                  Đơn hàng chưa xuất bến nên chưa có bản đồ vận chuyển.
                </Text>
              </View>
            ) : isRouteLoading ? (
              <ActivityIndicator size="small" color="#8B4513" className="py-4" />
            ) : routeError ? (
              <View className="gap-3 rounded-2xl border border-red-200 bg-red-50 p-4">
                <Text className="text-sm font-semibold leading-5 text-red-700">{routeError}</Text>
                <Pressable
                  onPress={() => activeOrder.masterTripId && fetchPlannedRoute(activeOrder.masterTripId)}
                  className="self-start rounded-xl bg-[#8B4513] px-4 py-2"
                >
                  <Text className="font-bold text-white">Tải lại</Text>
                </Pressable>
              </View>
            ) : plannedRoute ? (
              <>
                <View className="gap-2 rounded-2xl bg-[#F8F9FA] p-4">
                  <InfoRow label="Điểm đi" value={plannedRoute.origin?.address || 'Chưa cập nhật'} />
                  <InfoRow label="Điểm đến" value={plannedRoute.destination?.address || 'Chưa cập nhật'} />
                  <InfoRow label="Khoảng cách" value={formatDistance(plannedRoute.totalDistanceMeters)} />
                  <InfoRow label="Thời gian dự kiến" value={formatDuration(plannedRoute.totalDurationSeconds)} />
                </View>

                {!trackingData?.latestTelemetry ? (
                  <View className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                    <Text className="text-sm font-medium leading-6 text-amber-800">
                      Chưa có tín hiệu GPS realtime từ thiết bị IoT. Hiện đang hiển thị tuyến đường dự kiến.
                    </Text>
                  </View>
                ) : null}

                <GoongRouteMap route={plannedRoute} />
                <RouteStopsList route={plannedRoute} />
              </>
            ) : (
              <View className="items-center justify-center py-4">
                <Text className="text-sm font-medium text-[#877369]">Không thể tải tuyến đường dự kiến.</Text>
              </View>
            )}
          </SectionCard>

          <SectionCard title="Cold-chain monitoring" icon="thermometer-outline">
            {!activeOrder.masterTripId ? (
              <View className="items-center justify-center py-4">
                <Text className="text-sm font-medium text-[#877369]">Đơn hàng chưa xuất bến nên chưa có tracking vận chuyển.</Text>
              </View>
            ) : isTrackingLoading ? (
              <ActivityIndicator size="small" color="#8B4513" className="py-4" />
            ) : !trackingData?.latestTelemetry ? (
              <View className="items-center justify-center py-4">
                <Text className="text-sm font-medium text-[#877369]">Chưa có tín hiệu IoT từ xe. Vui lòng thử lại sau.</Text>
              </View>
            ) : (
              <>
                <View className="flex-row gap-3">
                  <MetricCard label="Nhiệt độ" value={`${trackingData.latestTelemetry.tempC ?? trackingData.latestTelemetry.temperature ?? '--'} °C`} />
                  <MetricCard label="Độ ẩm" value={`${trackingData.latestTelemetry.humidityPercent ?? trackingData.latestTelemetry.humidity ?? '--'}%`} />
                </View>
                <InfoRow label="Xe vận chuyển" value={trackingData.vehicle?.truckPlate || '--'} />
                <InfoRow label="Vị trí hiện tại" value={`${trackingData.latestTelemetry.lat}, ${trackingData.latestTelemetry.lon}`} />
                <InfoRow label="Cập nhật lúc" value={trackingData.latestTelemetry.timestamp ? new Date(trackingData.latestTelemetry.timestamp).toLocaleString('vi-VN') : '--'} />
                <InfoRow label="ETA" value={trackingData.eta?.estimatedArrival ? new Date(trackingData.eta.estimatedArrival).toLocaleString('vi-VN') : '--'} />
              </>
            )}
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

function DevTripRouteFallback({
  tripId,
  onTripIdChange,
  onLoadRoute,
  route,
  routeError,
  isRouteLoading,
}: {
  tripId: string;
  onTripIdChange: (value: string) => void;
  onLoadRoute: () => void;
  route: TripRouteResponse | null;
  routeError: string | null;
  isRouteLoading: boolean;
}) {
  const canLoadRoute = Boolean(tripId.trim()) && !isRouteLoading;

  return (
    <SectionCard title="TripId test" icon="map-outline">
      <View className="gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
        <Text className="text-sm font-semibold leading-5 text-amber-900">
          DEV ONLY - remove after customer orders API fixed
        </Text>
        <Text className="text-xs font-medium leading-5 text-amber-800">
          Nhập tripId thủ công để test Goong map khi API customer orders đang lỗi schema.
        </Text>
      </View>

      <View className="gap-2">
        <Text className="text-xs font-bold uppercase tracking-wider text-[#877369]">TripId test</Text>
        <TextInput
          value={tripId}
          onChangeText={onTripIdChange}
          placeholder="Nhập tripId"
          placeholderTextColor="#B8A79E"
          autoCapitalize="none"
          autoCorrect={false}
          className="rounded-2xl border border-[#DAC2B6]/70 bg-[#FFFDFB] px-4 py-3 font-semibold text-[#3A1F04]"
        />
      </View>

      <Pressable
        onPress={onLoadRoute}
        disabled={!canLoadRoute}
        className={`flex-row items-center justify-center gap-2 rounded-2xl px-4 py-3 ${
          canLoadRoute ? 'bg-[#8B4513]' : 'bg-[#C8B7AE]'
        }`}
      >
        {isRouteLoading ? <ActivityIndicator color="#FFFFFF" /> : <Ionicons name="map-outline" size={18} color="#FFFFFF" />}
        <Text className="font-bold text-white">{isRouteLoading ? 'Đang tải route...' : 'Tải route test'}</Text>
      </Pressable>

      {routeError ? (
        <View className="rounded-2xl border border-red-200 bg-red-50 p-4">
          <Text className="text-sm font-semibold leading-5 text-red-700">{routeError}</Text>
        </View>
      ) : null}

      {route ? (
        <>
          <View className="gap-2 rounded-2xl bg-[#F8F9FA] p-4">
            <InfoRow label="TripId" value={route.tripId || tripId.trim()} />
            <InfoRow label="Điểm đi" value={route.origin?.address || 'Chưa cập nhật'} />
            <InfoRow label="Điểm đến" value={route.destination?.address || 'Chưa cập nhật'} />
            <InfoRow label="Khoảng cách" value={formatDistance(route.totalDistanceMeters)} />
            <InfoRow label="Thời gian dự kiến" value={formatDuration(route.totalDurationSeconds)} />
          </View>
          <GoongRouteMap route={route} />
          <RouteStopsList route={route} />
        </>
      ) : null}
    </SectionCard>
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

function RouteStopsList({ route }: { route: TripRouteResponse }) {
  if (route.optimizedStops.length === 0) return null;

  return (
    <View className="gap-2">
      <Text className="text-xs font-bold text-[#877369]">Điểm dừng giao hàng</Text>
      {route.optimizedStops.map((stop, index) => (
        <View key={stop.stopId ?? `${stop.locationId}-${index}`} className="flex-row items-start gap-3">
          <View className="mt-0.5 h-7 w-7 items-center justify-center rounded-full bg-[#8B4513]/10">
            <Text className="text-xs font-bold text-[#8B4513]">{stop.optimizedSequence ?? index + 1}</Text>
          </View>
          <View className="flex-1 border-b border-[#DAC2B6]/30 pb-3">
            <Text className="text-sm font-bold text-[#3A1F04]">{stop.address || 'Chưa cập nhật địa chỉ'}</Text>
            <Text className="mt-1 text-xs leading-5 text-[#877369]">{getStopSummary(stop)}</Text>
          </View>
        </View>
      ))}
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

function formatDistance(meters?: number | null) {
  if (!meters || meters <= 0) return 'Chưa cập nhật';
  if (meters >= 1000) return `${(meters / 1000).toFixed(1)} km`;
  return `${Math.round(meters)} m`;
}

function formatDuration(seconds?: number | null) {
  if (!seconds || seconds <= 0) return 'Chưa cập nhật';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} phút`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes > 0 ? `${hours} giờ ${remainingMinutes} phút` : `${hours} giờ`;
}

function getStopSummary(stop: TripRouteResponse['optimizedStops'][number]) {
  const orderCount = stop.orders.length;
  const lpnCount = stop.lpns.length;

  if (orderCount > 0 && lpnCount > 0) {
    return `${orderCount} đơn hàng · ${lpnCount} LPN`;
  }
  if (orderCount > 0) return `${orderCount} đơn hàng`;
  if (lpnCount > 0) return `${lpnCount} LPN`;
  return 'Điểm dừng trong tuyến dự kiến';
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
