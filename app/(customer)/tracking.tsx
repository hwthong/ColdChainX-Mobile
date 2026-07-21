import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, AppState, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';

import { GoongRouteMap } from '../../components/customer/GoongRouteMap';
import { TemperatureChart } from '../../components/customer/TemperatureChart';
import { getApiErrorMessage } from '../../services/apiClient';
import { getCustomerIdFromToken } from '../../services/jwt';
import {
  getTripRoute,
  getTripAlerts,
  getTripTemperatureChart,
  getTripTracking,
  SmartAlert,
  TemperatureChart as TemperatureChartData,
  TripTracking,
} from '../../services/monitoringApi';
import { getCustomerOrders, OrderResponse } from '../../services/orderApi';
import { TripRouteResponse } from '../../services/trackingApi';
import { useAuthStore } from '../../store/useAuthStore';

const POLLING_INTERVAL_MS = 15_000;
const MAX_POLLING_INTERVAL_MS = 60_000;
const TERMINAL_TRIP_STATUSES = new Set(['COMPLETED', 'CANCELLED']);

export default function TrackingScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ orderId?: string | string[] }>();
  const explicitOrderId = getSingleParam(params.orderId);
  const accessToken = useAuthStore((state) => state.token);
  const storedCustomerId = useAuthStore((state) => state.customerId ?? state.user?.customerId ?? null);
  const customerId = storedCustomerId ?? (accessToken ? getCustomerIdFromToken(accessToken) : null);

  const [orders, setOrders] = useState<OrderResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [tracking, setTracking] = useState<TripTracking | null>(null);
  const [route, setRoute] = useState<TripRouteResponse | null>(null);
  const [chart, setChart] = useState<TemperatureChartData | null>(null);
  const [alerts, setAlerts] = useState<SmartAlert[]>([]);
  const [trackingError, setTrackingError] = useState<string | null>(null);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [chartError, setChartError] = useState<string | null>(null);
  const [alertsError, setAlertsError] = useState<string | null>(null);
  const [isTrackingLoading, setIsTrackingLoading] = useState(false);
  const [isRouteLoading, setIsRouteLoading] = useState(false);
  const [isChartLoading, setIsChartLoading] = useState(false);
  const [areAlertsLoading, setAreAlertsLoading] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  const trackableOrders = useMemo(
    () => orders.filter((order) => Boolean(order.masterTripId?.trim())),
    [orders]
  );
  const explicitOrder = useMemo(
    () => explicitOrderId
      ? orders.find((order) => order.orderId === explicitOrderId) ?? null
      : null,
    [explicitOrderId, orders]
  );
  const selectedOrder = useMemo(
    () => selectedOrderId
      ? trackableOrders.find((order) => order.orderId === selectedOrderId) ?? null
      : null,
    [selectedOrderId, trackableOrders]
  );
  const activeOrder = explicitOrder
    ?? selectedOrder
    ?? (trackableOrders.length === 1 ? trackableOrders[0] : null);
  const shouldShowSelector = !explicitOrderId && trackableOrders.length > 1;
  const explicitOrderMissing = Boolean(explicitOrderId && !explicitOrder && !isLoading);
  const tripId = activeOrder?.masterTripId?.trim() || null;

  const loadOrders = useCallback(async () => {
    if (!accessToken || !customerId) {
      setOrders([]);
      setOrderError('Không tìm thấy phiên đăng nhập hoặc mã khách hàng. Vui lòng đăng nhập lại.');
      setIsLoading(false);
      return;
    }
    try {
      setOrderError(null);
      const response = await getCustomerOrders(accessToken, customerId, 1, 50);
      if (!response.success) {
        setOrders([]);
        setOrderError(response.message || 'Không thể tải đơn hàng để giám sát.');
        return;
      }
      const nextOrders = response.data ?? [];
      setOrders(nextOrders);
      setSelectedOrderId((currentOrderId) =>
        currentOrderId && nextOrders.some(
          (order) => order.orderId === currentOrderId && Boolean(order.masterTripId?.trim())
        )
          ? currentOrderId
          : null
      );
    } catch (error) {
      setOrders([]);
      setOrderError(getApiErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, customerId]);

  const loadTracking = useCallback(async (currentTripId: string, showLoading = false) => {
    if (!accessToken) return null;
    if (showLoading) setIsTrackingLoading(true);
    try {
      setTrackingError(null);
      const response = await getTripTracking(accessToken, currentTripId);
      if (!response.success || !response.data) {
        setTracking(null);
        setTrackingError(response.message || 'Không thể tải dữ liệu giám sát hiện tại.');
        return null;
      }
      setTracking(response.data);
      return response.data;
    } catch (error) {
      setTrackingError(getMonitoringErrorMessage(error));
      return null;
    } finally {
      if (showLoading) setIsTrackingLoading(false);
    }
  }, [accessToken]);

  const loadRoute = useCallback(async (currentTripId: string) => {
    if (!accessToken) return;
    setIsRouteLoading(true);
    try {
      setRouteError(null);
      const response = await getTripRoute(accessToken, currentTripId);
      if (!response.success || !response.data) {
        setRoute(null);
        setRouteError(response.message || 'Không có dữ liệu tuyến đường.');
        return;
      }
      setRoute(response.data);
    } catch (error) {
      setRoute(null);
      setRouteError(getMonitoringErrorMessage(error));
    } finally {
      setIsRouteLoading(false);
    }
  }, [accessToken]);

  const loadChart = useCallback(async (currentTripId: string) => {
    if (!accessToken) return;
    setIsChartLoading(true);
    try {
      setChartError(null);
      const response = await getTripTemperatureChart(accessToken, currentTripId);
      if (!response.success || !response.data) {
        setChart(null);
        setChartError(response.message || 'Không thể tải biểu đồ nhiệt độ.');
        return;
      }
      setChart(response.data);
    } catch (error) {
      setChart(null);
      setChartError(getMonitoringErrorMessage(error));
    } finally {
      setIsChartLoading(false);
    }
  }, [accessToken]);

  const loadAlerts = useCallback(async (currentTripId: string) => {
    if (!accessToken) return;
    setAreAlertsLoading(true);
    try {
      setAlertsError(null);
      const response = await getTripAlerts(accessToken, currentTripId);
      if (!response.success) {
        setAlerts([]);
        setAlertsError(response.message || 'Không thể tải cảnh báo thông minh.');
        return;
      }
      setAlerts(response.data ?? []);
    } catch (error) {
      setAlerts([]);
      setAlertsError(getMonitoringErrorMessage(error));
    } finally {
      setAreAlertsLoading(false);
    }
  }, [accessToken]);

  useFocusEffect(useCallback(() => {
    if (!explicitOrderId) setSelectedOrderId(null);
  }, [explicitOrderId]));

  useFocusEffect(useCallback(() => {
    setIsLoading(true);
    void loadOrders();
  }, [loadOrders]));

  useFocusEffect(useCallback(() => {
    if (!tripId || !accessToken) {
      setTracking(null); setRoute(null); setChart(null); setAlerts([]);
      setTrackingError(null); setRouteError(null); setChartError(null); setAlertsError(null);
      return undefined;
    }

    let disposed = false;
    let pollingTimer: ReturnType<typeof setTimeout> | null = null;
    let pollingInFlight = false;
    let terminalReached = false;
    let consecutiveFailures = 0;
    let successfulPolls = 0;
    let currentAppState = AppState.currentState;
    const clearTimer = () => {
      if (pollingTimer) clearTimeout(pollingTimer);
      pollingTimer = null;
    };
    const poll = async (showLoading = false) => {
      if (disposed || pollingInFlight || currentAppState !== 'active') return;
      pollingInFlight = true;
      const nextTracking = await loadTracking(tripId, showLoading);
      pollingInFlight = false;
      terminalReached = isTerminalTripStatus(nextTracking?.status);
      if (disposed || terminalReached) return;
      if (nextTracking) {
        consecutiveFailures = 0;
        successfulPolls += 1;
        if (successfulPolls % 3 === 0) {
          void Promise.all([loadChart(tripId), loadAlerts(tripId)]);
        }
      } else {
        consecutiveFailures += 1;
      }
      clearTimer();
      const nextDelay = Math.min(
        POLLING_INTERVAL_MS * 2 ** consecutiveFailures,
        MAX_POLLING_INTERVAL_MS
      );
      pollingTimer = setTimeout(() => void poll(false), nextDelay);
    };

    void Promise.all([loadRoute(tripId), loadChart(tripId), loadAlerts(tripId)]);
    void poll(true);
    const subscription = AppState.addEventListener('change', (nextState) => {
      currentAppState = nextState;
      if (nextState !== 'active') clearTimer();
      else if (!terminalReached) void poll(false);
    });
    return () => {
      disposed = true;
      clearTimer();
      subscription.remove();
    };
  }, [accessToken, loadAlerts, loadChart, loadRoute, loadTracking, tripId]));

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await loadOrders();
    if (tripId) await Promise.all([loadTracking(tripId), loadRoute(tripId), loadChart(tripId), loadAlerts(tripId)]);
    setIsRefreshing(false);
  }, [loadAlerts, loadChart, loadOrders, loadRoute, loadTracking, tripId]);

  if (isLoading) return (
    <View className="flex-1 items-center justify-center bg-[#F5F2F0]">
      <ActivityIndicator size="large" color="#8B4513" />
      <Text className="mt-4 font-medium text-[#8B4513]">Đang tải giám sát đơn...</Text>
    </View>
  );

  return (
    <ScrollView className="flex-1 bg-[#F5F2F0]" contentContainerStyle={{ padding: 20, paddingBottom: 100, gap: 16 }}
      refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor="#8B4513" />}
      showsVerticalScrollIndicator={false}>
      {orderError ? <ErrorCard message={orderError} onRetry={loadOrders} /> : null}
      {explicitOrderMissing ? (
        <EmptyMessage message="Không tìm thấy đơn hàng được yêu cầu trong tài khoản Customer hiện tại." />
      ) : null}
      {shouldShowSelector ? (
        <TrackingOrderSelector
          orders={trackableOrders}
          selectedOrderId={selectedOrderId}
          onSelect={setSelectedOrderId}
        />
      ) : null}
      {!activeOrder && !explicitOrderMissing && trackableOrders.length === 0 ? (
        orders.length === 0
          ? <EmptyOrder onCreateOrder={() => router.push('/(customer)/create-order')} />
          : <EmptyMessage message="Chưa có đơn hàng nào được điều phối vào chuyến để giám sát." />
      ) : null}
      {activeOrder ? (
        <>
          <OrderHeader order={activeOrder} />
          <Pressable
            onPress={() => router.push({
              pathname: '/(customer)/chat/[orderId]',
              params: { orderId: activeOrder.orderId, trackingCode: activeOrder.trackingCode },
            } as never)}
            className="flex-row items-center justify-center gap-2 rounded-2xl border border-[#DAC2B6]/60 bg-white p-4"
          >
            <Ionicons name="chatbubbles-outline" size={20} color="#8B4513" />
            <Text className="font-bold text-[#8B4513]">Trao đổi về đơn hàng</Text>
          </Pressable>
          {!tripId ? (
            <SectionCard title="Giám sát chuyến" icon="locate-outline">
              <EmptyMessage message="Đơn hàng chưa được điều phối vào chuyến." />
            </SectionCard>
          ) : (
            <>
              <SectionCard title="Bản đồ tuyến đường" icon="map-outline">
                {isRouteLoading ? <SectionLoader /> : routeError ? <ErrorCard message={routeError} onRetry={() => loadRoute(tripId)} /> : route ? (
                  <>
                    <RouteSummary route={route} />
                    <GoongRouteMap route={route} vehiclePosition={getVehiclePosition(tracking)} />
                    {!getVehiclePosition(tracking) ? (
                      <Text className="text-center text-sm font-medium text-[#877369]">
                        Chưa nhận được vị trí từ thiết bị.
                      </Text>
                    ) : null}
                  </>
                ) : <EmptyMessage message="Chưa có dữ liệu tuyến đường." />}
              </SectionCard>
              <SectionCard title="Dữ liệu hiện tại" icon="thermometer-outline">
                {isTrackingLoading ? <SectionLoader /> : null}
                {trackingError ? <ErrorCard message={trackingError} onRetry={() => loadTracking(tripId, true)} /> : null}
                {!isTrackingLoading && !tracking?.telemetry ? <EmptyMessage message="Chưa nhận được dữ liệu từ thiết bị." /> : null}
                {tracking ? <TelemetrySummary tracking={tracking} /> : null}
              </SectionCard>
              <SectionCard title="Biểu đồ nhiệt độ" icon="pulse-outline">
                {isChartLoading ? <SectionLoader /> : chartError ? <ErrorCard message={chartError} onRetry={() => loadChart(tripId)} /> : chart?.points.length ? (
                  <><TemperatureChart points={chart.points} /><Text className="text-xs text-[#877369]">{chart.points.length} điểm dữ liệu (tối đa 200), timestamp UTC hiển thị theo giờ thiết bị.</Text></>
                ) : <EmptyMessage message="Chưa có dữ liệu nhiệt độ." />}
              </SectionCard>
              <SectionCard title="Cảnh báo thông minh" icon="notifications-outline">
                {areAlertsLoading ? <SectionLoader /> : alertsError ? <ErrorCard message={alertsError} onRetry={() => loadAlerts(tripId)} /> : alerts.length ? (
                  alerts.map((alert, index) => <AlertRow key={alert.alertId || `${alert.createdAt}-${index}`} alert={alert} />)
                ) : <EmptyMessage message="Chưa có cảnh báo thông minh." />}
              </SectionCard>
            </>
          )}
        </>
      ) : null}
    </ScrollView>
  );
}

function TrackingOrderSelector({
  orders,
  selectedOrderId,
  onSelect,
}: {
  orders: OrderResponse[];
  selectedOrderId: string | null;
  onSelect: (orderId: string) => void;
}) {
  return (
    <View className="gap-3 rounded-3xl bg-white p-5">
      <View className="flex-row items-center gap-2">
        <Ionicons name="list-outline" size={20} color="#8B4513" />
        <Text className="text-base font-bold text-[#3A1F04]">Chọn đơn cần giám sát</Text>
      </View>
      <Text className="text-sm leading-5 text-[#877369]">
        Tài khoản có nhiều đơn đã được điều phối. Chọn một đơn để mở dữ liệu chuyến tương ứng.
      </Text>
      {orders.map((order) => {
        const isSelected = order.orderId === selectedOrderId;
        return (
          <Pressable
            key={order.orderId}
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected }}
            onPress={() => onSelect(order.orderId)}
            className={`rounded-2xl border p-4 ${
              isSelected ? 'border-[#8B4513] bg-[#8B4513]/10' : 'border-[#DAC2B6]/60 bg-[#F8F9FA]'
            }`}
          >
            <View className="flex-row items-start justify-between gap-3">
              <View className="flex-1">
                <Text className="font-bold text-[#3A1F04]">{order.trackingCode}</Text>
                <Text className="mt-1 text-sm text-[#877369]">{order.itemName}</Text>
                <Text className="mt-2 text-xs font-bold uppercase text-[#8B4513]">{order.status}</Text>
              </View>
              {isSelected ? <Ionicons name="checkmark-circle" size={22} color="#8B4513" /> : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

function TelemetrySummary({ tracking }: { tracking: TripTracking }) {
  const telemetry = tracking.telemetry;
  const deviceState = getDeviceState(tracking);
  return <View className="gap-3">
    {deviceState === 'Ngoại tuyến' ? <View className="rounded-2xl border border-amber-200 bg-amber-50 p-4"><Text className="text-sm font-semibold text-amber-800">Thiết bị đang ngoại tuyến.</Text></View> : null}
    {telemetry ? <View className="flex-row gap-3">
      <MetricCard label="Nhiệt độ hiện tại" value={telemetry.temperatureC === null || telemetry.temperatureC === undefined ? '--' : `${formatNumber(telemetry.temperatureC)} °C`} />
      <MetricCard label="Trạng thái cửa" value={formatDoorState(telemetry.doorOpen ?? null)} />
    </View> : null}
    <InfoRow label="Thiết bị" value={deviceState} />
    <InfoRow label="Mã thiết bị" value={tracking.device?.deviceCode || '--'} />
    <InfoRow label="Cập nhật lần cuối" value={formatDateTime(telemetry?.timestamp ?? tracking.device?.lastSeenAt)} />
    <InfoRow label="ETA" value={formatDateTime(tracking.eta?.estimatedArrival)} />
    <InfoRow label="Biển số xe" value={tracking.vehicle?.truckPlate || '--'} />
    <InfoRow label="Trạng thái chuyến" value={tracking.status || '--'} />
  </View>;
}

function RouteSummary({ route }: { route: TripRouteResponse }) {
  return <View className="gap-2 rounded-2xl bg-[#F8F9FA] p-4">
    <InfoRow label="Điểm lấy hàng" value={route.origin?.address || '--'} />
    <InfoRow label="Điểm giao" value={route.destination?.address || '--'} />
    <InfoRow label="Điểm dừng" value={String(route.optimizedStops.length)} />
    <InfoRow label="Khoảng cách" value={formatDistance(route.totalDistanceMeters)} />
    <InfoRow label="Thời gian dự kiến" value={formatDuration(route.totalDurationSeconds)} />
  </View>;
}

function AlertRow({ alert }: { alert: SmartAlert }) {
  return <View className="gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-4">
    <View className="flex-row items-start justify-between gap-3"><Text className="flex-1 text-sm font-bold text-amber-900">{alert.title || alert.alertType || 'Không xác định'}</Text></View>
    <Text className="text-sm leading-5 text-amber-900">{alert.message || 'Không có nội dung.'}</Text>
    <Text className="text-xs text-amber-700">{formatDateTime(alert.createdAt)}</Text>
  </View>;
}

function OrderHeader({ order }: { order: OrderResponse }) {
  return <View className="rounded-3xl bg-[#3A1F04] p-5">
    <Text className="text-xs font-bold uppercase tracking-widest text-[#FFC29F]/70">Tracking code</Text>
    <Text className="mt-2 text-2xl font-bold text-[#FFC29F]">{order.trackingCode}</Text>
    <Text className="mt-2 text-sm text-white/70">{order.itemName}</Text>
    <View className="mt-4 rounded-2xl bg-white/10 p-4"><Text className="text-xs text-white/60">Trạng thái đơn</Text><Text className="mt-1 font-bold text-white">{order.status}</Text></View>
  </View>;
}

function EmptyOrder({ onCreateOrder }: { onCreateOrder: () => void }) {
  return <View className="items-center rounded-3xl bg-white p-8"><Ionicons name="locate-outline" size={56} color="#877369" /><Text className="mt-4 text-center text-base font-bold text-[#3A1F04]">Chưa có đơn để giám sát</Text><Pressable onPress={onCreateOrder} className="mt-5 rounded-xl bg-[#8B4513] px-5 py-3"><Text className="font-bold text-white">Tạo đơn mới</Text></Pressable></View>;
}

function SectionCard({ title, icon, children }: { title: string; icon: React.ComponentProps<typeof Ionicons>['name']; children: React.ReactNode }) {
  return <View className="gap-4 rounded-3xl bg-white p-5"><View className="flex-row items-center gap-2"><Ionicons name={icon} size={20} color="#8B4513" /><Text className="text-base font-bold text-[#3A1F04]">{title}</Text></View>{children}</View>;
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return <View className="flex-1 rounded-2xl bg-[#F5F2F0] p-4"><Text className="text-xs text-[#877369]">{label}</Text><Text className="mt-2 text-lg font-bold text-[#8B4513]">{value}</Text></View>;
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return <View className="flex-row items-start justify-between gap-4 border-b border-[#DAC2B6]/30 pb-2"><Text className="text-sm text-[#877369]">{label}</Text><Text className="flex-1 text-right text-sm font-semibold text-[#3A1F04]">{value}</Text></View>;
}

function ErrorCard({ message, onRetry }: { message: string; onRetry: () => void | Promise<unknown> }) {
  return <View className="rounded-2xl border border-red-200 bg-red-50 p-4"><Text className="text-sm font-semibold leading-5 text-red-700">{message}</Text><Pressable onPress={() => void onRetry()} className="mt-3 self-start rounded-xl bg-[#8B4513] px-4 py-2"><Text className="font-bold text-white">Thử lại</Text></Pressable></View>;
}

function EmptyMessage({ message }: { message: string }) { return <Text className="py-3 text-center text-sm font-medium leading-6 text-[#877369]">{message}</Text>; }
function SectionLoader() { return <ActivityIndicator size="small" color="#8B4513" className="py-4" />; }

function getVehiclePosition(tracking: TripTracking | null) {
  const latitude = tracking?.telemetry?.latitude;
  const longitude = tracking?.telemetry?.longitude;
  return isValidLatitude(latitude) && isValidLongitude(longitude) ? { latitude, longitude } : null;
}

function getDeviceState(tracking: TripTracking) {
  if (tracking.device?.isOnline === true) return 'Trực tuyến';
  if (tracking.device?.isOnline === false) return 'Ngoại tuyến';
  const status = tracking.device?.status?.toUpperCase();
  if (status === 'ONLINE') return 'Trực tuyến';
  if (status === 'OFFLINE') return 'Ngoại tuyến';
  return tracking.device?.status ? `Không xác định (${tracking.device.status})` : 'Không xác định';
}

function formatDoorState(value: boolean | null) { return value === true ? 'Đang mở' : value === false ? 'Đang đóng' : '--'; }
function formatDateTime(value?: string | null) { if (!value) return '--'; const date = new Date(value); return Number.isNaN(date.getTime()) ? '--' : date.toLocaleString('vi-VN'); }
function formatDistance(value: number) { if (!Number.isFinite(value) || value <= 0) return '--'; return value >= 1000 ? `${formatNumber(value / 1000)} km` : `${Math.round(value)} m`; }
function formatDuration(value: number) { if (!Number.isFinite(value) || value <= 0) return '--'; const minutes = Math.round(value / 60); const hours = Math.floor(minutes / 60); const remaining = minutes % 60; return hours > 0 ? `${hours} giờ ${remaining} phút` : `${minutes} phút`; }
function formatNumber(value: number) { return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 }).format(value); }
function isValidLatitude(value: number | null | undefined): value is number { return typeof value === 'number' && Number.isFinite(value) && value >= -90 && value <= 90; }
function isValidLongitude(value: number | null | undefined): value is number { return typeof value === 'number' && Number.isFinite(value) && value >= -180 && value <= 180; }
function isTerminalTripStatus(status?: string | null) { return status ? TERMINAL_TRIP_STATUSES.has(status.toUpperCase()) : false; }
function getSingleParam(value?: string | string[]) { return Array.isArray(value) ? value[0] : value; }
function getMonitoringErrorMessage(error: unknown) {
  const message = getApiErrorMessage(error);
  return /stackexchange\.redis|authenticationfailure|serverendpoint|connection exception|timed out in the backlog/i.test(message)
    ? 'Dịch vụ dữ liệu thiết bị đang tạm thời không khả dụng. Vui lòng thử lại sau.'
    : message;
}
