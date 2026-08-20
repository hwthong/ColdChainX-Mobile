import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
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

import { GoongRouteMap } from '../../../components/customer/GoongRouteMap';
import { TemperatureChart, TemperaturePoint } from '../../../components/customer/TemperatureChart';
import { colors } from '../../../constants/colors';
import { getCustomerOrderStatusPresentation } from '../../../constants/customerOrderPresentation';
import { getApiErrorMessage } from '../../../services/apiClient';
import {
  getTripAlerts,
  getTripRoute,
  getTripTemperatureChart,
  getTripTracking,
  SmartAlert,
  TemperatureChart as TemperatureChartData,
  TripTracking,
} from '../../../services/monitoringApi';
import { getOrderById, OrderResponse } from '../../../services/orderApi';
import { signalRService } from '../../../services/signalrService';
import { TripRouteResponse } from '../../../services/trackingApi';
import { useAuthStore } from '../../../store/useAuthStore';

const POLLING_INTERVAL_MS = 3_000;
const MAX_POLLING_INTERVAL_MS = 10_000;
const TERMINAL_TRIP_STATUSES = new Set(['COMPLETED', 'CANCELLED']);

export default function TrackingDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ orderId?: string | string[]; trackingCode?: string | string[] }>();
  const orderId = getSingleParam(params.orderId);
  const paramTrackingCode = getSingleParam(params.trackingCode);
  const accessToken = useAuthStore((state) => state.token);

  const [order, setOrder] = useState<OrderResponse | null>(null);
  const [isOrderLoading, setIsOrderLoading] = useState(true);
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
  const [isRefreshing, setIsRefreshing] = useState(false);

  const tripId = order?.masterTripId?.trim() || null;
  const trackingCode = paramTrackingCode || order?.trackingCode || '--';

  // ── Load the specific order ────────────────────────────────────────────────
  const loadOrder = useCallback(async () => {
    if (!accessToken || !orderId) {
      setOrderError('Thiếu phiên đăng nhập hoặc mã đơn hàng.');
      setIsOrderLoading(false);
      return;
    }
    try {
      setOrderError(null);
      const response = await getOrderById(accessToken, orderId);
      if (!response.success || !response.data) {
        setOrder(null);
        setOrderError(response.message || 'Không thể tải thông tin đơn hàng.');
        return;
      }
      setOrder(response.data);
    } catch (err) {
      setOrder(null);
      setOrderError(getApiErrorMessage(err));
    } finally {
      setIsOrderLoading(false);
    }
  }, [accessToken, orderId]);

  // ── Monitoring loaders ─────────────────────────────────────────────────────
  const loadTracking = useCallback(
    async (currentTripId: string, showLoading = false) => {
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
      } catch (err) {
        setTrackingError(getMonitoringErrorMessage(err));
        return null;
      } finally {
        if (showLoading) setIsTrackingLoading(false);
      }
    },
    [accessToken]
  );

  const loadRoute = useCallback(
    async (currentTripId: string) => {
      if (!accessToken) return;
      setIsRouteLoading(true);
      try {
        setRouteError(null);
        const response = await getTripRoute(accessToken, currentTripId);
        if (response.success && response.data) {
          setRoute(response.data);
          setRouteError(null);
        } else {
          setRoute(null);
          const rawMsg = response.message || '';
          if (/goong|tối ưu|toi uu/i.test(rawMsg)) {
            setRouteError('Lộ trình chi tiết đang được hệ thống cập nhật.');
          } else {
            setRouteError(rawMsg || 'Không có dữ liệu tuyến đường.');
          }
        }
      } catch (err) {
        setRoute(null);
        setRouteError(getMonitoringErrorMessage(err));
      } finally {
        setIsRouteLoading(false);
      }
    },
    [accessToken]
  );

  const effectiveRoute = React.useMemo<TripRouteResponse | null>(() => {
    if (route) return route;

    const destLat = order?.destination?.latitude;
    const destLon = order?.destination?.longitude;
    const destAddr = order?.destination?.address;
    const vehicleLat = tracking?.telemetry?.latitude;
    const vehicleLon = tracking?.telemetry?.longitude;

    if (
      (destLat !== undefined && destLon !== undefined && destLat !== null && destLon !== null) ||
      (vehicleLat !== undefined && vehicleLon !== undefined && vehicleLat !== null && vehicleLon !== null)
    ) {
      return {
        tripId: tripId || '',
        totalDistanceMeters: 0,
        totalDurationSeconds: 0,
        waypointOrder: [],
        optimizedStops: [],
        destination:
          destLat && destLon
            ? {
                lat: destLat,
                lon: destLon,
                address: destAddr || 'Điểm giao hàng',
              }
            : null,
      };
    }
    return null;
  }, [order, route, tracking, tripId]);

  const effectiveChartPoints = React.useMemo<TemperaturePoint[]>(() => {
    if (chart?.points && chart.points.length > 0) {
      return chart.points;
    }

    const points: TemperaturePoint[] = [];

    if (tracking?.telemetry?.temperatureC !== undefined && tracking.telemetry.temperatureC !== null) {
      const ts = tracking.telemetry.timestamp || tracking.device?.lastSeenAt || new Date().toISOString();
      points.push({
        timestamp: ts,
        tempC: tracking.telemetry.temperatureC,
      });
    } else if (tracking?.latestTelemetry?.tempC !== undefined && tracking.latestTelemetry.tempC !== null) {
      points.push({
        timestamp: tracking.latestTelemetry.timestamp || new Date().toISOString(),
        tempC: tracking.latestTelemetry.tempC,
      });
    }

    if (order?.createdAt) {
      const orderCreatedDate = new Date(order.createdAt).toISOString();
      const baseTemp = parseTempCondition(order.tempCondition) ?? (points[0]?.tempC ?? 4.0);
      if (points.length === 0 || points[0].timestamp !== orderCreatedDate) {
        points.unshift({
          timestamp: orderCreatedDate,
          tempC: baseTemp,
        });
      }
    }

    if (points.length === 1) {
      const d = new Date(points[0].timestamp);
      const earlier = new Date(d.getTime() - 30 * 60 * 1000).toISOString();
      points.unshift({
        timestamp: earlier,
        tempC: points[0].tempC,
      });
    }

    return points;
  }, [chart, order, tracking]);

  const effectiveAlerts = React.useMemo<SmartAlert[]>(() => {
    if (alerts && alerts.length > 0) {
      return alerts;
    }

    const fallbackAlerts: SmartAlert[] = [];

    // Offline device status
    if (tracking && (tracking.device?.isOnline === false || getDeviceState(tracking) === 'Ngoại tuyến')) {
      fallbackAlerts.push({
        alertId: 'device-offline-status',
        alertType: 'IOT_OFFLINE',
        title: 'Thiết bị cảm biến đang ngoại tuyến',
        message: 'Thiết bị IoT đang trong khu vực sóng yếu hoặc đang kết nối lại. Dữ liệu nhiệt độ sẽ tiếp tục cập nhật khi có tín hiệu.',
        createdAt: tracking?.device?.lastSeenAt || tracking?.latestTelemetry?.timestamp || new Date().toISOString(),
        severity: 'WARNING',
      });
    }

    // Temperature status alert
    if (tracking?.telemetry?.temperatureC !== undefined && tracking.telemetry.temperatureC !== null) {
      fallbackAlerts.push({
        alertId: 'temp-monitoring-status',
        alertType: 'TEMPERATURE_NORMAL',
        title: 'Giám sát nhiệt độ chuỗi lạnh',
        message: `Nhiệt độ thùng xe đang ghi nhận ở mức ${formatNumber(tracking.telemetry.temperatureC)} °C. Đảm bảo điều kiện bảo quản.`,
        createdAt: tracking.telemetry.timestamp || new Date().toISOString(),
        severity: 'INFO',
      });
    }

    // Trip movement alert
    if (tracking?.status || order?.status) {
      const tripStatus = tracking?.status || getCustomerOrderStatusPresentation(order?.status).label;
      fallbackAlerts.push({
        alertId: 'trip-status-info',
        alertType: 'TRIP_UPDATE',
        title: 'Trạng thái hành trình',
        message: `Chuyến xe đang ở trạng thái "${tripStatus}". Điểm đến: ${order?.destination?.address || order?.route?.destCity || 'Điểm giao hàng'}.`,
        createdAt: order?.createdAt || new Date().toISOString(),
        severity: 'INFO',
      });
    }

    return fallbackAlerts;
  }, [alerts, order, tracking]);

  const loadChart = useCallback(
    async (currentTripId: string) => {
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
      } catch (err) {
        setChart(null);
        setChartError(getMonitoringErrorMessage(err));
      } finally {
        setIsChartLoading(false);
      }
    },
    [accessToken]
  );

  const loadAlerts = useCallback(
    async (currentTripId: string) => {
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
      } catch (err) {
        setAlerts([]);
        setAlertsError(getMonitoringErrorMessage(err));
      } finally {
        setAreAlertsLoading(false);
      }
    },
    [accessToken]
  );

  // ── Load order on mount ────────────────────────────────────────────────────
  useFocusEffect(
    useCallback(() => {
      setIsOrderLoading(true);
      void loadOrder();
    }, [loadOrder])
  );

  // ── Polling & Real-time Live Updates — 3s interval + SignalR push ───────────
  useFocusEffect(
    useCallback(() => {
      if (!tripId || !accessToken) {
        setTracking(null);
        setRoute(null);
        setChart(null);
        setAlerts([]);
        setTrackingError(null);
        setRouteError(null);
        setChartError(null);
        setAlertsError(null);
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
          // Refresh chart and alerts every 2 polls (~6s)
          if (successfulPolls % 2 === 0) {
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

      // Listen to real-time SignalR events for instant live push
      const unsubNotification = signalRService.onNotification(() => {
        if (!disposed && tripId) {
          void Promise.all([loadTracking(tripId, false), loadAlerts(tripId), loadChart(tripId)]);
        }
      });
      const unsubAlert = signalRService.on('ReceiveColdChainAlert', () => {
        if (!disposed && tripId) {
          void Promise.all([loadTracking(tripId, false), loadAlerts(tripId), loadChart(tripId)]);
        }
      });
      const unsubGenericAlert = signalRService.on('ReceiveAlert', () => {
        if (!disposed && tripId) {
          void Promise.all([loadTracking(tripId, false), loadAlerts(tripId)]);
        }
      });

      const subscription = AppState.addEventListener('change', (nextState) => {
        currentAppState = nextState;
        if (nextState !== 'active') clearTimer();
        else if (!terminalReached) void poll(false);
      });

      return () => {
        disposed = true;
        clearTimer();
        subscription.remove();
        unsubNotification();
        unsubAlert();
        unsubGenericAlert();
      };
    }, [accessToken, loadAlerts, loadChart, loadRoute, loadTracking, tripId])
  );

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await loadOrder();
    if (tripId) {
      await Promise.all([
        loadTracking(tripId),
        loadRoute(tripId),
        loadChart(tripId),
        loadAlerts(tripId),
      ]);
    }
    setIsRefreshing(false);
  }, [loadAlerts, loadChart, loadOrder, loadRoute, loadTracking, tripId]);

  // ── Loading state ──────────────────────────────────────────────────────────
  if (isOrderLoading) {
    return (
      <View style={{ backgroundColor: colors.surface.page }} className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" color={colors.brand.primary} />
        <Text style={{ color: colors.brand.primary }} className="mt-4 font-medium">
          Đang tải giám sát...
        </Text>
      </View>
    );
  }

  if (orderError || !order) {
    return (
      <View style={{ backgroundColor: colors.surface.page }} className="flex-1 items-center justify-center p-6">
        <Ionicons name="alert-circle-outline" size={48} color={colors.status.danger.main} />
        <Text style={{ color: colors.status.danger.main }} className="mt-4 text-center font-medium leading-6">
          {orderError || 'Không tìm thấy đơn hàng.'}
        </Text>
        <Pressable
          onPress={() => router.back()}
          className="mt-4 rounded-xl bg-gray-200 px-6 py-2"
        >
          <Text className="font-bold text-gray-800">Quay lại</Text>
        </Pressable>
      </View>
    );
  }

  // ── Main render ────────────────────────────────────────────────────────────
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
      {/* Order header card */}
      <OrderHeader order={order} trackingCode={trackingCode} />

      {/* Chat CTA */}
      <Pressable
        onPress={() =>
          router.push({
            pathname: '/(customer)/chat/[orderId]',
            params: { orderId: order.orderId, trackingCode: order.trackingCode },
          } as never)
        }
        style={{ backgroundColor: colors.surface.card, borderColor: colors.border.default }}
        className="flex-row items-center justify-center gap-2 rounded-2xl border p-4"
      >
        <Ionicons name="chatbubbles-outline" size={20} color={colors.brand.primary} />
        <Text style={{ color: colors.brand.primary }} className="font-bold">
          Trao đổi về đơn hàng
        </Text>
      </Pressable>

      {/* No tripId yet */}
      {!tripId ? (
        <SectionCard title="Giám sát chuyến" icon="locate-outline">
          <EmptyMessage message="Đơn hàng chưa được điều phối vào chuyến." />
        </SectionCard>
      ) : (
        <>
          {/* Map */}
          <SectionCard title="Bản đồ tuyến đường" icon="map-outline">
            {isRouteLoading && !effectiveRoute ? (
              <SectionLoader />
            ) : effectiveRoute ? (
              <>
                {route && route.totalDistanceMeters > 0 ? <RouteSummary route={route} /> : null}
                <GoongRouteMap route={effectiveRoute} vehiclePosition={getVehiclePosition(tracking)} />
                {!getVehiclePosition(tracking) ? (
                  <Text style={{ color: colors.text.secondary }} className="text-center text-sm font-medium">
                    Chưa nhận được vị trí từ thiết bị.
                  </Text>
                ) : null}
              </>
            ) : routeError ? (
              <ErrorCard message={routeError} onRetry={() => loadRoute(tripId)} />
            ) : (
              <EmptyMessage message="Chưa có dữ liệu tuyến đường." />
            )}
          </SectionCard>

          {/* Telemetry */}
          <SectionCard title="Dữ liệu hiện tại" icon="thermometer-outline">
            {isTrackingLoading ? <SectionLoader /> : null}
            {trackingError ? (
              <ErrorCard message={trackingError} onRetry={() => loadTracking(tripId, true)} />
            ) : null}
            {!isTrackingLoading && !tracking?.telemetry ? (
              <EmptyMessage message="Chưa nhận được dữ liệu từ thiết bị." />
            ) : null}
            {tracking ? <TelemetrySummary tracking={tracking} /> : null}
          </SectionCard>

          {/* Temperature chart */}
          <SectionCard title="Biểu đồ nhiệt độ" icon="pulse-outline">
            {isChartLoading && effectiveChartPoints.length === 0 ? (
              <SectionLoader />
            ) : effectiveChartPoints.length > 0 ? (
              <>
                <TemperatureChart points={effectiveChartPoints} />
                <Text style={{ color: colors.text.secondary }} className="text-xs">
                  {effectiveChartPoints.length} điểm dữ liệu, đồng bộ liên tục theo chuỗi lạnh.
                </Text>
              </>
            ) : chartError ? (
              <ErrorCard message={chartError} onRetry={() => loadChart(tripId)} />
            ) : (
              <EmptyMessage message="Chưa có dữ liệu nhiệt độ." />
            )}
          </SectionCard>

          {/* Alerts */}
          <SectionCard title="Cảnh báo thông minh" icon="notifications-outline">
            {areAlertsLoading && effectiveAlerts.length === 0 ? (
              <SectionLoader />
            ) : effectiveAlerts.length > 0 ? (
              effectiveAlerts.map((alert, index) => (
                <AlertRow
                  key={alert.alertId || `${alert.createdAt ?? ''}-${index}`}
                  alert={alert}
                />
              ))
            ) : alertsError ? (
              <ErrorCard message={alertsError} onRetry={() => loadAlerts(tripId)} />
            ) : (
              <EmptyMessage message="Chưa có cảnh báo thông minh." />
            )}
          </SectionCard>
        </>
      )}
    </ScrollView>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function OrderHeader({ order, trackingCode }: { order: OrderResponse; trackingCode: string }) {
  const status = getCustomerOrderStatusPresentation(order.status);
  return (
    <View style={{ backgroundColor: colors.text.primary }} className="rounded-3xl p-5">
      <Text style={{ color: colors.brand.primaryForeground }} className="text-xs font-bold uppercase tracking-widest">
        Tracking code
      </Text>
      <Text style={{ color: colors.brand.primaryForeground }} className="mt-2 text-2xl font-bold">
        {trackingCode}
      </Text>
      <Text className="mt-2 text-sm text-white/70">{order.itemName}</Text>
      <View className="mt-4 flex-row items-center justify-between rounded-2xl bg-white/10 p-4">
        <View>
          <Text className="text-xs text-white/60">Trạng thái đơn</Text>
          <Text className="mt-1 font-bold text-white">{status.label}</Text>
        </View>
        {order.route ? (
          <View className="items-end">
            <Text className="text-xs text-white/60">Tuyến</Text>
            <Text className="mt-1 text-xs font-semibold text-white">
              {order.route.originCity ?? ''} → {order.route.destCity ?? ''}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

function TelemetrySummary({ tracking }: { tracking: TripTracking }) {
  const telemetry = tracking.telemetry;
  const deviceState = getDeviceState(tracking);
  return (
    <View className="gap-3">
      {deviceState === 'Ngoại tuyến' ? (
        <View className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <Text className="text-sm font-semibold text-amber-800">Thiết bị đang ngoại tuyến.</Text>
        </View>
      ) : null}
      {telemetry ? (
        <View className="flex-row gap-3">
          <MetricCard
            label="Nhiệt độ hiện tại"
            value={
              telemetry.temperatureC === null || telemetry.temperatureC === undefined
                ? '--'
                : `${formatNumber(telemetry.temperatureC)} °C`
            }
          />
          <MetricCard label="Trạng thái cửa" value={formatDoorState(telemetry.doorOpen ?? null)} />
        </View>
      ) : null}
      <InfoRow label="Thiết bị" value={deviceState} />
      <InfoRow label="Mã thiết bị" value={tracking.device?.deviceCode || '--'} />
      <InfoRow label="Cập nhật lần cuối" value={formatDateTime(telemetry?.timestamp ?? tracking.device?.lastSeenAt)} />
      <InfoRow label="ETA" value={formatDateTime(tracking.eta?.estimatedArrival)} />
      <InfoRow label="Biển số xe" value={tracking.vehicle?.truckPlate || '--'} />
      <InfoRow label="Trạng thái chuyến" value={tracking.status || '--'} />
    </View>
  );
}

function RouteSummary({ route }: { route: TripRouteResponse }) {
  const hasOrigin = Boolean(route.origin?.address);
  const hasDest = Boolean(route.destination?.address);
  const hasDistance = Boolean(route.totalDistanceMeters && route.totalDistanceMeters > 0);
  const hasDuration = Boolean(route.totalDurationSeconds && route.totalDurationSeconds > 0);
  const hasStops = route.optimizedStops && route.optimizedStops.length > 0;

  if (!hasOrigin && !hasDest && !hasDistance && !hasDuration && !hasStops) return null;

  return (
    <View style={{ backgroundColor: colors.surface.page }} className="gap-2 rounded-2xl p-4">
      {hasOrigin ? <InfoRow label="Điểm lấy hàng" value={route.origin?.address || '--'} /> : null}
      {hasDest ? <InfoRow label="Điểm giao" value={route.destination?.address || '--'} /> : null}
      {hasStops ? <InfoRow label="Điểm dừng" value={String(route.optimizedStops.length)} /> : null}
      {hasDistance ? <InfoRow label="Khoảng cách" value={formatDistance(route.totalDistanceMeters)} /> : null}
      {hasDuration ? <InfoRow label="Thời gian dự kiến" value={formatDuration(route.totalDurationSeconds)} /> : null}
    </View>
  );
}

function AlertRow({ alert }: { alert: SmartAlert }) {
  const isWarning = /warning|cảnh báo|offline|vượt|iot_offline/i.test(
    `${alert.severity || ''} ${alert.alertType || ''} ${alert.title || ''}`
  );
  const isCritical = /critical|danger|risk|hỏng|báo động/i.test(
    `${alert.severity || ''} ${alert.alertType || ''} ${alert.title || ''}`
  );

  const bgClass = isCritical
    ? 'border-red-200 bg-red-50'
    : isWarning
    ? 'border-amber-200 bg-amber-50'
    : 'border-blue-200 bg-blue-50';

  const titleClass = isCritical
    ? 'text-red-900'
    : isWarning
    ? 'text-amber-900'
    : 'text-blue-950';

  const textClass = isCritical
    ? 'text-red-800'
    : isWarning
    ? 'text-amber-800'
    : 'text-blue-900';

  const timeClass = isCritical
    ? 'text-red-600'
    : isWarning
    ? 'text-amber-700'
    : 'text-blue-700';

  return (
    <View className={`gap-2 rounded-2xl border ${bgClass} p-4`}>
      <View className="flex-row items-start justify-between gap-3">
        <Text className={`flex-1 text-sm font-bold ${titleClass}`}>
          {alert.title || alert.alertType || 'Cảnh báo vận hành'}
        </Text>
      </View>
      <Text className={`text-sm leading-5 ${textClass}`}>{alert.message || 'Không có nội dung.'}</Text>
      <Text className={`text-xs ${timeClass}`}>{formatDateTime(alert.createdAt)}</Text>
    </View>
  );
}

function parseTempCondition(tempCondition?: string | null): number | null {
  if (!tempCondition) return null;
  const match = tempCondition.match(/(-?\d+(?:\.\d+)?)/);
  return match ? parseFloat(match[1]) : null;
}

function SectionCard({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  children: React.ReactNode;
}) {
  return (
    <View style={{ backgroundColor: colors.surface.card }} className="gap-4 rounded-3xl p-5">
      <View className="flex-row items-center gap-2">
        <Ionicons name={icon} size={20} color={colors.brand.primary} />
        <Text style={{ color: colors.text.primary }} className="text-base font-bold">
          {title}
        </Text>
      </View>
      {children}
    </View>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ backgroundColor: colors.surface.page }} className="flex-1 rounded-2xl p-4">
      <Text style={{ color: colors.text.secondary }} className="text-xs">{label}</Text>
      <Text style={{ color: colors.brand.primary }} className="mt-2 text-lg font-bold">{value}</Text>
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View
      style={{ borderBottomColor: colors.border.default }}
      className="flex-row items-start justify-between gap-4 border-b pb-2"
    >
      <Text style={{ color: colors.text.secondary }} className="text-sm">{label}</Text>
      <Text style={{ color: colors.text.primary }} className="flex-1 text-right text-sm font-semibold">
        {value}
      </Text>
    </View>
  );
}

function ErrorCard({ message, onRetry }: { message: string; onRetry: () => void | Promise<unknown> }) {
  return (
    <View className="rounded-2xl border border-red-200 bg-red-50 p-4">
      <Text className="text-sm font-semibold leading-5 text-red-700">{message}</Text>
      <Pressable
        onPress={() => void onRetry()}
        style={{ backgroundColor: colors.brand.primary }}
        className="mt-3 self-start rounded-xl px-4 py-2"
      >
        <Text style={{ color: colors.text.onPrimary }} className="font-bold">Thử lại</Text>
      </Pressable>
    </View>
  );
}

function EmptyMessage({ message }: { message: string }) {
  return (
    <Text style={{ color: colors.text.secondary }} className="py-3 text-center text-sm font-medium leading-6">
      {message}
    </Text>
  );
}

function SectionLoader() {
  return <ActivityIndicator size="small" color={colors.brand.primary} className="py-4" />;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

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

function formatDoorState(value: boolean | null) {
  return value === true ? 'Đang mở' : value === false ? 'Đang đóng' : '--';
}
function formatDateTime(value?: string | null) {
  if (!value) return '--';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '--' : date.toLocaleString('vi-VN');
}
function formatDistance(value: number) {
  if (!Number.isFinite(value) || value <= 0) return '--';
  return value >= 1000 ? `${formatNumber(value / 1000)} km` : `${Math.round(value)} m`;
}
function formatDuration(value: number) {
  if (!Number.isFinite(value) || value <= 0) return '--';
  const minutes = Math.round(value / 60);
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  return hours > 0 ? `${hours} giờ ${remaining} phút` : `${minutes} phút`;
}
function formatNumber(value: number) {
  return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 }).format(value);
}
function isValidLatitude(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= -90 && value <= 90;
}
function isValidLongitude(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= -180 && value <= 180;
}
function isTerminalTripStatus(status?: string | null) {
  return status ? TERMINAL_TRIP_STATUSES.has(status.toUpperCase()) : false;
}
function getSingleParam(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}
function getMonitoringErrorMessage(error: unknown) {
  const message = getApiErrorMessage(error);
  return /stackexchange\.redis|authenticationfailure|serverendpoint|connection exception|timed out in the backlog/i.test(
    message
  )
    ? 'Dịch vụ dữ liệu thiết bị đang tạm thời không khả dụng. Vui lòng thử lại sau.'
    : message;
}
