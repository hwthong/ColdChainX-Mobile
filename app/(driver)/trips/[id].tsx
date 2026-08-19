import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  Linking,
  Modal,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';

import { AppPressable as Pressable } from '../../../components/AppPressable';
import { GoongRouteMap } from '../../../components/customer/GoongRouteMap';
import { TemperatureChart } from '../../../components/customer/TemperatureChart';
import { TripAlertsSection } from '../../../components/driver/TripAlertsSection';
import { TripOrdersSection } from '../../../components/driver/TripOrdersSection';
import { StatusBadge } from '../../../components/StatusBadge';
import { getApiErrorMessage } from '../../../services/apiClient';
import {
  getTripAlerts, getTripRoute, getTripTemperatureChart, getTripTracking,
  SmartAlert, TemperatureChart as TemperatureChartData, TripTracking,
} from '../../../services/monitoringApi';
import { TripRouteResponse } from '../../../services/trackingApi';
import { getIncidents, IncidentResponse } from '../../../services/incidentApi';
import { getVehicleDetail } from '../../../services/vehicleApi';
import { driverApi, DriverTripDetailResponseDto, DriverTripStopDto } from '../../../services/driverApi';
import { getOrderById, OrderResponse } from '../../../services/orderApi';
import { colors } from '../../../constants/colors';
import { useAuthStore } from '../../../store/useAuthStore';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const POLL_MS = 15_000;
const MAX_POLL_MS = 60_000;
const TERMINAL = new Set(['COMPLETED', 'CANCELLED', 'CLOSED']);
const STATUS: Record<string, string> = {
  PLANNED: 'Đã lên kế hoạch', PICKING: 'Đang lấy hàng', LOADING_COMPLETED: 'Đã xếp hàng',
  SEALED: 'Đã kẹp chì', DISPATCHED: 'Đã điều phối', IN_TRANSIT: 'Đang vận chuyển',
  DELAYED: 'Bị trễ', COMPLETED: 'Hoàn tất', CLOSED: 'Đã đóng', CANCELLED: 'Đã hủy',
};
const STOP_STATUS: Record<string, string> = {
  PLANNED: 'Chờ check-in',
  ARRIVED: 'Đã check-in',
  DEPARTED: 'Đã hoàn tất (dữ liệu cũ)',
  FAILED_DELIVERY: 'Giao hàng thất bại',
};

export default function DriverTripDetailScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const tripId = Array.isArray(params.id) ? params.id[0] : params.id;
  const router = useRouter();
  const token = useAuthStore((state) => state.token);
  const [tracking, setTracking] = useState<TripTracking | null>(null);
  const [trip, setTrip] = useState<DriverTripDetailResponseDto | null>(null);
  const [route, setRoute] = useState<TripRouteResponse | null>(null);
  const [isMapFullscreen, setIsMapFullscreen] = useState(false);
  const [chart, setChart] = useState<TemperatureChartData | null>(null);
  const [alerts, setAlerts] = useState<SmartAlert[]>([]);
  const [alertsLoaded, setAlertsLoaded] = useState(false);
  const [activeIncident, setActiveIncident] = useState<IncidentResponse | null>(null);
  const [replacementPlate, setReplacementPlate] = useState<string | null>(null);
  const [orderDetailsMap, setOrderDetailsMap] = useState<Record<string, OrderResponse>>({});
  const [loadingOrderDetails, setLoadingOrderDetails] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errors, setErrors] = useState<Record<string, string | null>>({});

  const setError = useCallback((key: string, value: string | null) => {
    setErrors((current) => ({ ...current, [key]: value }));
  }, []);

  const loadOrderDetails = useCallback(async (ordersToFetch: { orderId?: string }[]) => {
    if (!token || !ordersToFetch?.length) return;
    const uniqueIds = Array.from(
      new Set(
        ordersToFetch
          .map((o) => (o.orderId || '').trim())
          .filter(Boolean)
      )
    );
    if (uniqueIds.length === 0) return;

    setLoadingOrderDetails(true);
    try {
      const results = await Promise.allSettled(
        uniqueIds.map(async (orderId) => {
          const response = await getOrderById(token, orderId);
          if (response.success && response.data) {
            return response.data;
          }
          return null;
        })
      );

      const mapUpdates: Record<string, OrderResponse> = {};
      for (const result of results) {
        if (result.status === 'fulfilled' && result.value) {
          const item = result.value;
          const rawId = item.orderId || '';
          if (rawId) {
            mapUpdates[rawId] = item;
            mapUpdates[rawId.toLowerCase()] = item;
            mapUpdates[rawId.toUpperCase()] = item;
          }
        }
      }

      setOrderDetailsMap((prev) => ({ ...prev, ...mapUpdates }));
    } catch {
      // Graceful non-blocking fallback
    } finally {
      setLoadingOrderDetails(false);
    }
  }, [token]);

  const loadTracking = useCallback(async () => {
    if (!token || !tripId) return null;
    try {
      const response = await getTripTracking(token, tripId);
      if (!response.success || !response.data) {
        setError('tracking', response.message || 'Không thể tải dữ liệu giám sát chuyến.');
        return null;
      }
      setTracking(response.data);
      setError('tracking', null);
      if (response.data.orders?.length) {
        void loadOrderDetails(response.data.orders);
      }
      return response.data;
    } catch (error) { setError('tracking', getApiErrorMessage(error)); return null; }
  }, [setError, token, tripId, loadOrderDetails]);

  const loadTrip = useCallback(async () => {
    if (!tripId) return null;
    try {
      const data = await driverApi.getMyTripDetail(tripId);
      setTrip(data);
      setError('trip', null);
      return data;
    } catch (error) {
      setError('trip', getApiErrorMessage(error));
      return null;
    }
  }, [tripId, setError]);

  const loadRoute = useCallback(async () => {
    if (!token || !tripId) return;
    try {
      const response = await getTripRoute(token, tripId);
      if (!response.success || !response.data) { setError('route', response.message || 'Chưa có dữ liệu tuyến đường.'); return; }
      setRoute(response.data); setError('route', null);
      const routeOrders = response.data.optimizedStops.flatMap((s) => s.orders ?? []);
      if (routeOrders.length > 0) {
        void loadOrderDetails(routeOrders);
      }
    } catch (error) { setError('route', getApiErrorMessage(error)); }
  }, [setError, token, tripId, loadOrderDetails]);

  const loadChart = useCallback(async () => {
    if (!token || !tripId) return;
    try {
      const response = await getTripTemperatureChart(token, tripId);
      if (!response.success || !response.data) { setError('chart', response.message || 'Không thể tải lịch sử nhiệt độ.'); return; }
      setChart(response.data); setError('chart', null);
    } catch (error) { setError('chart', getApiErrorMessage(error)); }
  }, [setError, token, tripId]);

  const loadAlerts = useCallback(async () => {
    if (!token || !tripId) return;
    try {
      const response = await getTripAlerts(token, tripId);
      if (!response.success) { setError('alerts', response.message || 'Không thể tải cảnh báo.'); return; }
      setAlerts(response.data ?? []); setError('alerts', null);
    } catch (error) { setError('alerts', getApiErrorMessage(error)); }
    finally { setAlertsLoaded(true); }
  }, [setError, token, tripId]);

  const loadIncident = useCallback(async () => {
    if (!token || !tripId) return;
    try {
      const response = await getIncidents(token, tripId, 1, 20);
      if (response.success && response.data?.data && response.data.data.length > 0) {
        const incidents = response.data.data;
        const active = incidents.find((i: IncidentResponse) => i.status !== 'RESOLVED');
        const target = active || incidents[0];
        setActiveIncident(target);

        if (target.externalReeferPlan?.vehiclePlate) {
          setReplacementPlate(target.externalReeferPlan.vehiclePlate);
        } else if (target.replacementVehicleId) {
          try {
            const vRes = await getVehicleDetail(token, target.replacementVehicleId);
            if (vRes.success && vRes.data?.truckPlate) {
              setReplacementPlate(vRes.data.truckPlate);
            }
          } catch {
            // ignore
          }
        }
      } else {
        setActiveIncident(null);
        setReplacementPlate(null);
      }
    } catch {
      // It's okay to fail silently for this secondary info
    }
  }, [token, tripId]);

  useFocusEffect(useCallback(() => {
    if (!token || !tripId) { setError('tracking', 'Thiếu phiên đăng nhập hoặc TripId hợp lệ.'); setLoading(false); return; }
    let disposed = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let inFlight = false;
    let failures = 0;
    let successes = 0;
    let terminal = false;
    let appState = AppState.currentState;
    const clear = () => { if (timer) clearTimeout(timer); timer = null; };
    const poll = async () => {
      if (disposed || inFlight || appState !== 'active') return;
      inFlight = true;
      const current = await loadTracking();
      terminal = terminal || Boolean(current?.status && TERMINAL.has(current.status.toUpperCase()));
      if (current) {
        failures = 0;
        successes += 1;
        if (successes % 3 === 0) {
          const [latestTrip] = await Promise.all([loadTrip(), loadChart(), loadAlerts(), loadIncident()]);
          terminal = terminal || Boolean(latestTrip?.status && TERMINAL.has(latestTrip.status.toUpperCase()));
        }
      }
      else failures += 1;
      inFlight = false;
      setLoading(false);
      if (disposed || terminal) return;
      clear();
      timer = setTimeout(() => void poll(), Math.min(POLL_MS * 2 ** failures, MAX_POLL_MS));
    };
    const initialize = async () => {
      const [currentTrip, currentTracking] = await Promise.all([
        loadTrip(), loadTracking(), loadRoute(), loadChart(), loadAlerts(), loadIncident(),
      ]);
      if (disposed) return;
      terminal = Boolean(
        (currentTrip?.status && TERMINAL.has(currentTrip.status.toUpperCase()))
        || (currentTracking?.status && TERMINAL.has(currentTracking.status.toUpperCase()))
      );
      setLoading(false);
      if (!terminal && appState === 'active') {
        timer = setTimeout(() => void poll(), POLL_MS);
      }
    };
    void initialize();
    const subscription = AppState.addEventListener('change', (nextState) => {
      appState = nextState;
      if (nextState !== 'active') clear(); else if (!terminal) void poll();
    });
    return () => { disposed = true; clear(); subscription.remove(); };
  }, [loadTrip, loadAlerts, loadChart, loadRoute, loadTracking, loadIncident, setError, token, tripId]));

  const refresh = useCallback(async () => {
    setRefreshing(true); await Promise.all([loadTrip(), loadTracking(), loadRoute(), loadChart(), loadAlerts(), loadIncident()]); setRefreshing(false);
  }, [loadTrip, loadAlerts, loadChart, loadRoute, loadTracking, loadIncident]);

  const displayStops = useMemo<DriverTripStopDto[]>(() => {
    if (trip?.stops && trip.stops.length > 0) {
      return trip.stops;
    }
    if (route?.optimizedStops && route.optimizedStops.length > 0) {
      return route.optimizedStops.map((s, idx) => ({
        stopId: s.stopId || `route-stop-${idx}`,
        stopSequence: s.optimizedSequence ?? s.originalStopSequence ?? idx + 1,
        address: s.address || 'Điểm giao hàng',
        plannedArrivalTime: (s as { plannedArrivalTime?: string }).plannedArrivalTime ?? null,
        plannedDepartureTime: (s as { plannedDepartureTime?: string }).plannedDepartureTime ?? null,
        status: (s as { status?: string }).status || 'PLANNED',
        stopType: s.stopType || 'DELIVERY',
      }));
    }
    if (tracking?.orders && tracking.orders.length > 0) {
      return tracking.orders.map((o, idx) => ({
        stopId: o.orderId,
        stopSequence: idx + 1,
        address: `Điểm giao hàng: ${o.itemName} (${o.trackingCode})`,
        plannedArrivalTime: null,
        plannedDepartureTime: null,
        status: 'PLANNED',
        stopType: 'DELIVERY',
      }));
    }
    return [];
  }, [trip?.stops, route?.optimizedStops, tracking?.orders]);

  const nextStopIndex = useMemo(() => {
    return displayStops.findIndex(
      (stop) => (stop.status?.toUpperCase() || '') !== 'DEPARTED'
    );
  }, [displayStops]);

  const vehiclePosition = useMemo(() => getVehiclePosition(tracking), [tracking]);

  const safeOpenURL = useCallback(async (primaryUrl: string, fallbackUrl?: string) => {
    try {
      const supported = await Linking.canOpenURL(primaryUrl);
      if (supported) {
        await Linking.openURL(primaryUrl);
        return;
      }
    } catch {
      // ignore and try fallback
    }

    if (fallbackUrl) {
      try {
        const fallbackSupported = await Linking.canOpenURL(fallbackUrl);
        if (fallbackSupported) {
          await Linking.openURL(fallbackUrl);
          return;
        }
      } catch {
        // ignore
      }
    }

    // Final attempt to open
    try {
      await Linking.openURL(fallbackUrl || primaryUrl);
    } catch {
      Alert.alert(
        'Thông báo',
        'Không thể mở ứng dụng bản đồ trên thiết bị. Vui lòng kiểm tra ứng dụng bản đồ hoặc kết nối mạng.'
      );
    }
  }, []);

  const openGoogleMaps = useCallback(async () => {
    if (!route) return;
    const dest =
      route.destination?.lat && route.destination?.lon
        ? `${route.destination.lat},${route.destination.lon}`
        : encodeURIComponent(route.destination?.address || '');
    const origin = vehiclePosition
      ? `${vehiclePosition.latitude},${vehiclePosition.longitude}`
      : route.origin?.lat && route.origin?.lon
      ? `${route.origin.lat},${route.origin.lon}`
      : '';

    const appUrl = origin
      ? `comgooglemaps://?saddr=${origin}&daddr=${dest}&directionsmode=driving`
      : `comgooglemaps://?daddr=${dest}&directionsmode=driving`;
    const webUrl = origin
      ? `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${dest}`
      : `https://www.google.com/maps/dir/?api=1&destination=${dest}`;

    await safeOpenURL(appUrl, webUrl);
  }, [route, vehiclePosition, safeOpenURL]);

  const openAppleMaps = useCallback(async () => {
    if (!route) return;
    const dest =
      route.destination?.lat && route.destination?.lon
        ? `${route.destination.lat},${route.destination.lon}`
        : encodeURIComponent(route.destination?.address || '');
    const origin = vehiclePosition
      ? `${vehiclePosition.latitude},${vehiclePosition.longitude}`
      : route.origin?.lat && route.origin?.lon
      ? `${route.origin.lat},${route.origin.lon}`
      : '';

    const appUrl = origin
      ? `maps://?saddr=${origin}&daddr=${dest}&dirflg=d`
      : `maps://?daddr=${dest}&dirflg=d`;
    const webUrl = origin
      ? `https://maps.apple.com/?saddr=${origin}&daddr=${dest}`
      : `https://maps.apple.com/?daddr=${dest}`;

    await safeOpenURL(appUrl, webUrl);
  }, [route, vehiclePosition, safeOpenURL]);

  const openGoongMap = useCallback(async () => {
    if (!route) return;
    const destLat = route.destination?.lat;
    const destLon = route.destination?.lon;
    const originLat = vehiclePosition?.latitude || route.origin?.lat;
    const originLon = vehiclePosition?.longitude || route.origin?.lon;
    let url = 'https://maps.goong.io';
    if (destLat && destLon) {
      url =
        originLat && originLon
          ? `https://maps.goong.io/?origin=${originLat},${originLon}&destination=${destLat},${destLon}`
          : `https://maps.goong.io/?destination=${destLat},${destLon}`;
    }
    await safeOpenURL(url);
  }, [route, vehiclePosition, safeOpenURL]);

  if (loading) {
    return (
      <View style={{ backgroundColor: colors.surface.page }} className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" color={colors.brand.primary} />
        <Text style={{ color: colors.brand.primary }} className="mt-4 font-medium">Đang tải chi tiết chuyến...</Text>
      </View>
    );
  }
  const status = trip?.status || tracking?.status || 'UNKNOWN';
  const isCompleted = TERMINAL.has(status.toUpperCase());

  return (
    <View style={{ backgroundColor: colors.surface.page }} className="flex-1">
      {/* ── TOP APP BAR WITH SAFE AREA INSETS ── */}
      <View
        style={{
          backgroundColor: colors.surface.card,
          borderBottomColor: colors.border.default,
          paddingTop: Math.max(insets.top + 6, 48),
        }}
        className="border-b px-4 pb-3.5 shadow-sm"
      >
        <View className="flex-row items-center justify-between">
          <Pressable
            onPress={() => router.back()}
            style={{ backgroundColor: colors.brand.primarySoft }}
            className="rounded-full p-2.5"
          >
            <Ionicons name="arrow-back" size={18} color={colors.brand.primary} />
          </Pressable>

          <View className="flex-1 px-3">
            <Text style={{ color: colors.text.secondary }} className="text-[10px] font-bold uppercase tracking-wider">
              Chuyến xe vận chuyển
            </Text>
            <Text numberOfLines={1} style={{ color: colors.text.primary }} className="text-base font-bold">
              {tripId ? `Chuyến #${tripId.slice(0, 8).toUpperCase()}` : '--'}
            </Text>
          </View>

          <View style={{ backgroundColor: colors.surface.selected }} className="rounded-xl px-3 py-1.5">
            <Text style={{ color: colors.brand.primary }} className="text-xs font-bold">
              {STATUS[status.toUpperCase()] || status}
            </Text>
          </View>
        </View>
      </View>

      <ScrollView
        style={{ backgroundColor: colors.surface.page }}
        className="flex-1"
        contentContainerStyle={{ padding: 16, paddingBottom: 100, gap: 16 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.brand.primary} />
        }
      >
        {/* ── NÚT THAO TÁC TRÊN ĐẦU: CHỨNG TỪ + XEM SỰ CỐ / BÁO SỰ CỐ ── */}
        <View className="flex-row gap-3">
          <Action icon="document-text-outline" label="Chứng từ" onPress={() => router.push(`/(driver)/trips/${tripId}/documents` as never)} />
          {activeIncident ? (
            <>
              <Action 
                icon="warning" 
                label="Xem sự cố đã báo" 
                danger 
                onPress={() => router.push(`/(driver)/trips/${tripId}/incident-detail?incidentId=${activeIncident.incidentId}` as never)} 
              />
              <Action 
                icon="add-circle-outline" 
                label="Báo thêm" 
                onPress={() => router.push(`/(driver)/trips/${tripId}/incident` as never)} 
              />
            </>
          ) : (
            <Action 
              icon="warning-outline" 
              label="Báo sự cố" 
              danger 
              onPress={() => router.push(`/(driver)/trips/${tripId}/incident` as never)} 
            />
          )}
        </View>

        {/* ── CARD BANNER NỔI BẬT: THÔNG BÁO TIẾN TRÌNH SỰ CỐ ĐÃ BÁO CÁO ── */}
        {activeIncident ? (
          <Pressable
            onPress={() =>
              router.push(
                `/(driver)/trips/${tripId}/incident-detail?incidentId=${activeIncident.incidentId}` as never
              )
            }
            style={{
              backgroundColor:
                activeIncident.status === 'RESOLVED'
                  ? colors.status.success.bg
                  : activeIncident.severity === 'CRITICAL'
                  ? '#FEF2F2'
                  : colors.status.warning.bg,
              borderColor:
                activeIncident.status === 'RESOLVED'
                  ? colors.status.success.border
                  : activeIncident.severity === 'CRITICAL'
                  ? '#FECACA'
                  : colors.status.warning.border,
            }}
            className="flex-row items-center justify-between rounded-2xl border p-4 shadow-sm"
          >
            <View className="flex-row items-center gap-3 flex-1 pr-2">
              <View
                style={{
                  backgroundColor:
                    activeIncident.status === 'RESOLVED'
                      ? colors.status.success.main
                      : activeIncident.severity === 'CRITICAL'
                      ? '#DC2626'
                      : colors.status.warning.main,
                }}
                className="h-10 w-10 items-center justify-center rounded-xl"
              >
                <Ionicons
                  name={activeIncident.status === 'RESOLVED' ? 'checkmark-circle' : 'warning'}
                  size={22}
                  color="#ffffff"
                />
              </View>
              <View className="flex-1">
                <Text
                  style={{
                    color:
                      activeIncident.status === 'RESOLVED'
                        ? colors.status.success.main
                        : activeIncident.severity === 'CRITICAL'
                        ? '#B91C1C'
                        : colors.status.warning.main,
                  }}
                  className="text-xs font-bold uppercase tracking-wider"
                >
                  {activeIncident.status === 'RESOLVED'
                    ? 'Sự cố đã hoàn tất'
                    : 'Chuyến có sự cố đã báo'}
                </Text>
                <Text
                  numberOfLines={1}
                  style={{ color: colors.text.primary }}
                  className="mt-0.5 text-xs font-semibold"
                >
                  {activeIncident.description || 'Đang chờ điều phối cứu hộ'}
                </Text>
              </View>
            </View>
            <View className="flex-row items-center gap-1.5">
              <StatusBadge status={activeIncident.status} showVietnameseLabel />
              <Ionicons name="chevron-forward" size={16} color={colors.text.muted} />
            </View>
          </Pressable>
        ) : null}

        <Section
          title="Bản đồ tuyến đường"
          icon="map-outline"
          rightAction={
            route ? (
              <Pressable
                onPress={() => setIsMapFullscreen(true)}
                style={{ backgroundColor: colors.brand.primarySoft }}
                className="flex-row items-center gap-1 rounded-lg px-2.5 py-1"
              >
                <Ionicons name="expand-outline" size={13} color={colors.brand.primary} />
                <Text style={{ color: colors.brand.primary }} className="text-xs font-bold">
                  Phóng to
                </Text>
              </Pressable>
            ) : null
          }
        >
          {errors.route ? <ErrorMessage message={errors.route} onRetry={loadRoute} /> : null}
          {route ? (
            <>
              <InfoRow label="Quãng đường" value={formatDistance(route.totalDistanceMeters)} />
              <InfoRow label="Thời gian dự kiến" value={formatDuration(route.totalDurationSeconds)} />
              <GoongRouteMap route={route} vehiclePosition={vehiclePosition} />
              {!vehiclePosition ? <Empty message="Chưa nhận được vị trí từ thiết bị." /> : null}

              {/* Phím tắt mở nhanh bản đồ ngoài */}
              <View className="mt-1 flex-row items-center justify-end gap-1.5 flex-wrap">
                <Text style={{ color: colors.text.muted }} className="text-[11px]">Mở ngoài:</Text>
                <Pressable
                  onPress={openGoogleMaps}
                  style={{ backgroundColor: '#EEF2FF', borderColor: '#C7D2FE' }}
                  className="flex-row items-center gap-1 rounded-lg border px-2 py-1 shadow-xs"
                >
                  <Ionicons name="navigate-outline" size={12} color="#4338CA" />
                  <Text className="text-[11px] font-bold text-indigo-800">Google Map</Text>
                </Pressable>

                <Pressable
                  onPress={openAppleMaps}
                  style={{ backgroundColor: '#F1F5F9', borderColor: '#CBD5E1' }}
                  className="flex-row items-center gap-1 rounded-lg border px-2 py-1 shadow-xs"
                >
                  <Ionicons name="compass-outline" size={12} color="#334155" />
                  <Text className="text-[11px] font-bold text-slate-700">Apple Map</Text>
                </Pressable>

                <Pressable
                  onPress={openGoongMap}
                  style={{ backgroundColor: '#FEF3C7', borderColor: '#FDE68A' }}
                  className="flex-row items-center gap-1 rounded-lg border px-2 py-1 shadow-xs"
                >
                  <Ionicons name="map-outline" size={12} color="#B45309" />
                  <Text className="text-[11px] font-bold text-amber-800">Goong Map</Text>
                </Pressable>
              </View>
            </>
          ) : !errors.route ? (
            <Empty message="Chưa có dữ liệu tuyến đường." />
          ) : null}
        </Section>

        <TripOrdersSection
          route={route}
          fallbackOrders={tracking?.orders}
          orderDetailsMap={orderDetailsMap}
          loadingDetails={loadingOrderDetails}
        />

      <Section title="Xe và thiết bị IoT" icon="hardware-chip-outline">
        {tracking ? (
          <>
            <View className="flex-row gap-3">
              <Metric label="Nhiệt độ" value={formatTemperature(tracking.telemetry?.temperatureC)} />
              <Metric label="Cửa xe" value={formatDoor(tracking.telemetry?.doorOpen)} />
            </View>
            <InfoRow
              label="Biển số xe"
              value={
                replacementPlate
                  ? `${replacementPlate} (Xe cứu hộ)`
                  : tracking.vehicle?.truckPlate || '--'
              }
            />
            {replacementPlate && tracking.vehicle?.truckPlate && replacementPlate !== tracking.vehicle.truckPlate ? (
              <InfoRow label="Xe ban đầu" value={tracking.vehicle.truckPlate} />
            ) : null}
            <InfoRow label="Mã thiết bị" value={tracking.device?.deviceCode || '--'} />
            <InfoRow label="Kết nối" value={formatOnlineState(tracking)} />
            <InfoRow label="Cập nhật cuối" value={formatDateTime(tracking.telemetry?.timestamp ?? tracking.device?.lastSeenAt)} />
            <InfoRow label="ETA" value={formatDateTime(tracking.eta?.estimatedArrival)} />
          </>
        ) : !errors.tracking ? (
          <Empty message="Chưa nhận được telemetry thật từ thiết bị." />
        ) : null}
      </Section>

      <Section title="Lịch sử nhiệt độ" icon="pulse-outline">{errors.chart ? <ErrorMessage message={errors.chart} onRetry={loadChart} /> : null}{chart ? <TemperatureChart points={chart.points} /> : !errors.chart ? <Empty message="Chưa có dữ liệu nhiệt độ." /> : null}</Section>
      <TripAlertsSection
        key={`${tripId}-${isCompleted ? 'completed' : 'active'}`}
        alerts={alerts}
        completed={isCompleted}
        loading={!alertsLoaded}
        error={errors.alerts}
        onRetry={loadAlerts}
      />
      <Section title={`Điểm dừng (${displayStops.length})`} icon="trail-sign-outline">
        {errors.trip && !displayStops.length ? <ErrorMessage message={errors.trip} onRetry={loadTrip} /> : null}
        {displayStops.map((stop, index) => (
          <StopRow 
            key={stop.stopId || index}
            stop={stop}
            index={index} 
            isNextStop={index === nextStopIndex}
            onPress={() => router.push({
              pathname: '/(driver)/trips/stop/[stopId]',
              params: { stopId: stop.stopId, tripId },
            } as never)}
          />
        ))}
        {!displayStops.length ? <Empty message="Chưa có điểm dừng." /> : null}
      </Section>
    </ScrollView>

    {/* ── MODAL BẢN ĐỒ TOÀN MÀN HÌNH ── */}
    <Modal
      visible={isMapFullscreen}
      animationType="slide"
      onRequestClose={() => setIsMapFullscreen(false)}
    >
      <View style={{ backgroundColor: colors.surface.page }} className="flex-1">
        {/* Header với Safe Area Insets */}
        <View
          style={{
            backgroundColor: colors.surface.card,
            borderColor: colors.border.default,
            paddingTop: Math.max(insets.top + 6, 48),
          }}
          className="border-b px-4 pb-3 shadow-sm"
        >
          <View className="flex-row items-center justify-between">
            <Pressable
              onPress={() => setIsMapFullscreen(false)}
              style={{ backgroundColor: colors.brand.primarySoft }}
              className="rounded-full p-2.5"
            >
              <Ionicons name="close" size={20} color={colors.brand.primary} />
            </Pressable>

            <View className="flex-1 px-3">
              <Text style={{ color: colors.text.secondary }} className="text-[10px] font-bold uppercase tracking-wider">
                Bản đồ lộ trình toàn màn hình
              </Text>
              <Text numberOfLines={1} style={{ color: colors.text.primary }} className="text-sm font-bold">
                {tripId ? `Chuyến #${tripId.slice(0, 8).toUpperCase()}` : '--'}
              </Text>
            </View>

            <Pressable
              onPress={() => setIsMapFullscreen(false)}
              style={{ backgroundColor: colors.surface.muted }}
              className="rounded-xl px-3 py-1.5"
            >
              <Text style={{ color: colors.text.primary }} className="text-xs font-semibold">Đóng</Text>
            </Pressable>
          </View>

          {/* Thanh nút điều hướng bên ngoài (Google Map, Apple Map, Goong Map) */}
          <View className="mt-2.5 flex-row items-center justify-between gap-1.5">
            <Pressable
              onPress={openGoogleMaps}
              style={{ backgroundColor: '#EEF2FF', borderColor: '#C7D2FE' }}
              className="flex-1 flex-row items-center justify-center gap-1 rounded-xl border py-2 shadow-xs"
            >
              <Ionicons name="navigate-outline" size={13} color="#4338CA" />
              <Text className="text-[11px] font-bold text-indigo-800">Google Map</Text>
            </Pressable>

            <Pressable
              onPress={openAppleMaps}
              style={{ backgroundColor: '#F1F5F9', borderColor: '#CBD5E1' }}
              className="flex-1 flex-row items-center justify-center gap-1 rounded-xl border py-2 shadow-xs"
            >
              <Ionicons name="compass-outline" size={13} color="#334155" />
              <Text className="text-[11px] font-bold text-slate-700">Apple Map</Text>
            </Pressable>

            <Pressable
              onPress={openGoongMap}
              style={{ backgroundColor: '#FEF3C7', borderColor: '#FDE68A' }}
              className="flex-1 flex-row items-center justify-center gap-1 rounded-xl border py-2 shadow-xs"
            >
              <Ionicons name="map-outline" size={13} color="#B45309" />
              <Text className="text-[11px] font-bold text-amber-800">Goong Map</Text>
            </Pressable>
          </View>
        </View>

        {/* Bản đồ Goong toàn màn hình */}
        <View className="flex-1 p-2">
          {route && isMapFullscreen ? (
            <GoongRouteMap
              route={route}
              vehiclePosition={vehiclePosition}
              isFullScreen
            />
          ) : null}
        </View>
      </View>
    </Modal>
  </View>
  );
}

function Section({
  title,
  icon,
  rightAction,
  children,
}: {
  title: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  rightAction?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <View style={{ backgroundColor: colors.surface.card, borderColor: colors.border.default }} className="gap-4 rounded-3xl border p-5 shadow-sm">
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-2">
          <Ionicons name={icon} size={20} color={colors.brand.primary} />
          <Text style={{ color: colors.text.primary }} className="text-base font-bold">{title}</Text>
        </View>
        {rightAction}
      </View>
      {children}
    </View>
  );
}

function Action({ icon, label, danger = false, onPress }: { icon: React.ComponentProps<typeof Ionicons>['name']; label: string; danger?: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        backgroundColor: danger ? colors.status.danger.bg : colors.surface.card,
        borderColor: danger ? colors.status.danger.border : colors.border.default,
      }}
      className="flex-1 flex-row items-center justify-center rounded-xl border p-3.5"
    >
      <Ionicons name={icon} size={20} color={danger ? colors.status.danger.main : colors.brand.primary} />
      <Text style={{ color: danger ? colors.status.danger.main : colors.brand.primary }} className="ml-2 text-sm font-bold">{label}</Text>
    </Pressable>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ backgroundColor: colors.surface.muted }} className="flex-1 rounded-2xl p-4">
      <Text style={{ color: colors.text.secondary }} className="text-xs">{label}</Text>
      <Text style={{ color: colors.text.primary }} className="mt-2 text-lg font-bold">{value}</Text>
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ borderBottomColor: colors.border.default }} className="flex-row items-start justify-between gap-4 border-b pb-2">
      <Text style={{ color: colors.text.secondary }} className="text-sm">{label}</Text>
      <Text style={{ color: colors.text.primary }} className="flex-1 text-right text-sm font-semibold">{value}</Text>
    </View>
  );
}

function StopRow({
  stop,
  index,
  isNextStop = false,
  onPress,
}: {
  stop: DriverTripStopDto;
  index: number;
  isNextStop?: boolean;
  onPress: () => void;
}) {
  const status = stop.status?.toUpperCase() || 'UNKNOWN';
  const isDeparted = status === 'DEPARTED';
  const disabled = !stop.stopId || isDeparted;

  if (isNextStop) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => ({
          backgroundColor: pressed ? '#EFF6FF' : '#F0FDF4',
          borderColor: '#86EFAC',
          opacity: pressed ? 0.8 : 1,
        })}
        className="rounded-2xl border-2 p-4 shadow-xs"
      >
        <View className="mb-2 flex-row items-center justify-between">
          <View className="flex-row items-center gap-2">
            <View style={{ backgroundColor: '#16A34A' }} className="h-6 w-6 items-center justify-center rounded-full">
              <Text style={{ color: '#ffffff' }} className="text-xs font-bold">{stop.stopSequence ?? index + 1}</Text>
            </View>
            <View style={{ backgroundColor: '#DCFCE7' }} className="rounded-full px-2.5 py-0.5">
              <Text style={{ color: '#15803D' }} className="text-[10px] font-bold uppercase tracking-wider">
                🎯 Điểm tiếp theo
              </Text>
            </View>
          </View>
          <Text style={{ color: '#16A34A' }} className="text-xs font-bold">
            {STOP_STATUS[status] || status}
          </Text>
        </View>

        <Text style={{ color: colors.text.primary }} className="text-sm font-bold leading-5">
          {stop.address || 'Chưa có địa chỉ'}
        </Text>

        <View className="mt-3 flex-row items-center justify-between border-t border-emerald-100 pt-2.5">
          <Text style={{ color: colors.text.secondary }} className="text-[11px]">
            Chạm để mở Check-in & Giao hàng
          </Text>
          <View style={{ backgroundColor: '#16A34A' }} className="flex-row items-center gap-1 rounded-lg px-3 py-1.5 shadow-xs">
            <Text className="text-xs font-bold text-white">Giao hàng</Text>
            <Ionicons name="arrow-forward" size={12} color="#ffffff" />
          </View>
        </View>
      </Pressable>
    );
  }

  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      className={`flex-row items-center gap-3 rounded-xl p-2.5 ${isDeparted ? 'bg-slate-50' : 'bg-transparent'}`}
      style={({ pressed }) => ({ opacity: disabled ? 0.5 : pressed ? 0.7 : 1 })}
    >
      <View
        style={{ backgroundColor: isDeparted ? colors.text.muted : colors.brand.primary }}
        className="h-7 w-7 items-center justify-center rounded-full"
      >
        <Text style={{ color: colors.text.onPrimary }} className="text-xs font-bold">
          {isDeparted ? '✓' : stop.stopSequence ?? index + 1}
        </Text>
      </View>
      <View className="flex-1">
        <Text
          style={{
            color: isDeparted ? colors.text.muted : colors.text.primary,
            textDecorationLine: isDeparted ? 'line-through' : 'none',
          }}
          className="text-xs font-semibold"
        >
          {stop.address || 'Chưa có địa chỉ'}
        </Text>
        <Text style={{ color: isDeparted ? colors.text.muted : colors.brand.primary }} className="mt-0.5 text-[11px] font-medium">
          {STOP_STATUS[status] || 'Chưa xác định'}
        </Text>
      </View>
      {!disabled ? <Ionicons name="chevron-forward" size={18} color={colors.brand.primary} /> : null}
    </Pressable>
  );
}

function ErrorMessage({ message, onRetry }: { message: string; onRetry: () => void | Promise<unknown> }) { return <View className="rounded-2xl border border-red-200 bg-red-50 p-4"><Text className="text-sm leading-5 text-red-800">{message}</Text><Pressable onPress={() => void onRetry()} className="mt-3 self-start rounded-lg bg-red-800 px-4 py-2"><Text className="font-bold text-white">Thử lại</Text></Pressable></View>; }
function Empty({ message }: { message: string }) { return <Text style={{ color: colors.text.secondary }} className="py-3 text-center text-sm font-medium">{message}</Text>; }

function getVehiclePosition(tracking: TripTracking | null) { const latitude = tracking?.telemetry?.latitude; const longitude = tracking?.telemetry?.longitude; if (typeof latitude !== 'number' || !Number.isFinite(latitude) || latitude < -90 || latitude > 90) return null; if (typeof longitude !== 'number' || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) return null; return { latitude, longitude }; }
function formatOnlineState(tracking: TripTracking) { if (tracking.device?.isOnline === true) return 'Trực tuyến'; if (tracking.device?.isOnline === false) return 'Ngoại tuyến'; return tracking.device?.status || 'Không xác định'; }
function formatTemperature(value?: number) { return typeof value === 'number' && Number.isFinite(value) ? `${value.toFixed(1)} °C` : '--'; }
function formatDoor(value?: boolean) { return value === true ? 'Đang mở' : value === false ? 'Đang đóng' : '--'; }
function formatDateTime(value?: string | null) { if (!value) return '--'; const date = new Date(value); return Number.isNaN(date.getTime()) ? '--' : date.toLocaleString('vi-VN'); }
function formatDistance(value: number) { if (!Number.isFinite(value) || value <= 0) return '--'; return value >= 1000 ? `${(value / 1000).toFixed(1)} km` : `${Math.round(value)} m`; }
function formatDuration(value: number) { if (!Number.isFinite(value) || value <= 0) return '--'; const minutes = Math.round(value / 60); const hours = Math.floor(minutes / 60); return hours ? `${hours} giờ ${minutes % 60} phút` : `${minutes} phút`; }
