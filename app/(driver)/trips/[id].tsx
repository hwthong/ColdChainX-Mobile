import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, AppState, RefreshControl, ScrollView, Text, View } from 'react-native';

import { AppPressable as Pressable } from '../../../components/AppPressable';
import { GoongRouteMap } from '../../../components/customer/GoongRouteMap';
import { TemperatureChart } from '../../../components/customer/TemperatureChart';
import { TripAlertsSection } from '../../../components/driver/TripAlertsSection';
import { getApiErrorMessage } from '../../../services/apiClient';
import {
  getTripAlerts, getTripRoute, getTripTemperatureChart, getTripTracking,
  SmartAlert, TemperatureChart as TemperatureChartData, TripTracking,
} from '../../../services/monitoringApi';
import { TripRouteResponse } from '../../../services/trackingApi';
import { getIncidents, IncidentResponse } from '../../../services/incidentApi';
import { driverApi, DriverTripDetailResponseDto, DriverTripStopDto } from '../../../services/driverApi';
import { colors } from '../../../constants/colors';
import { useAuthStore } from '../../../store/useAuthStore';

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
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const tripId = Array.isArray(params.id) ? params.id[0] : params.id;
  const router = useRouter();
  const token = useAuthStore((state) => state.token);
  const [tracking, setTracking] = useState<TripTracking | null>(null);
  const [trip, setTrip] = useState<DriverTripDetailResponseDto | null>(null);
  const [route, setRoute] = useState<TripRouteResponse | null>(null);
  const [chart, setChart] = useState<TemperatureChartData | null>(null);
  const [alerts, setAlerts] = useState<SmartAlert[]>([]);
  const [alertsLoaded, setAlertsLoaded] = useState(false);
  const [activeIncident, setActiveIncident] = useState<IncidentResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errors, setErrors] = useState<Record<string, string | null>>({});

  const setError = useCallback((key: string, value: string | null) => {
    setErrors((current) => ({ ...current, [key]: value }));
  }, []);

  const loadTracking = useCallback(async () => {
    if (!token || !tripId) return null;
    try {
      const response = await getTripTracking(token, tripId);
      if (!response.success || !response.data) {
        setError('tracking', response.message || 'Không thể tải dữ liệu giám sát chuyến.');
        return null;
      }
      setTracking(response.data); setError('tracking', null); return response.data;
    } catch (error) { setError('tracking', getApiErrorMessage(error)); return null; }
  }, [setError, token, tripId]);

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
    } catch (error) { setError('route', getApiErrorMessage(error)); }
  }, [setError, token, tripId]);

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
      const response = await getIncidents(token, tripId, 1, 1);
      if (response.success && response.data?.data?.length) {
        // Find first non-resolved incident, or the first one if all are resolved
        const active = response.data.data.find((i: IncidentResponse) => i.status !== 'RESOLVED');
        setActiveIncident(active || response.data.data[0]);
      } else {
        setActiveIncident(null);
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

  if (loading) {
    return (
      <View style={{ backgroundColor: colors.surface.page }} className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" color={colors.brand.primary} />
        <Text style={{ color: colors.brand.primary }} className="mt-4 font-medium">Đang tải chi tiết chuyến...</Text>
      </View>
    );
  }
  const vehiclePosition = getVehiclePosition(tracking);
  const status = trip?.status || tracking?.status || 'UNKNOWN';
  const isCompleted = TERMINAL.has(status.toUpperCase());

  return (
    <ScrollView style={{ backgroundColor: colors.surface.page }} className="flex-1" contentContainerStyle={{ padding: 20, paddingBottom: 100, gap: 16 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.brand.primary} />}>
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1">
          <Text style={{ color: colors.text.secondary }} className="text-xs font-bold uppercase tracking-widest">Chuyến vận chuyển</Text>
          <Text style={{ color: colors.text.primary }} className="mt-1 text-2xl font-bold">{tripId?.slice(0, 8).toUpperCase() || '--'}</Text>
        </View>
        <View style={{ backgroundColor: colors.surface.selected }} className="rounded-xl px-3 py-2">
          <Text style={{ color: colors.brand.primary }} className="text-xs font-bold">{STATUS[status.toUpperCase()] || status}</Text>
        </View>
      </View>
      <View className="flex-row gap-3">
        <Action icon="document-text-outline" label="Chứng từ" onPress={() => router.push(`/(driver)/trips/${tripId}/documents` as never)} />
        <Action 
          icon={activeIncident ? "warning" : "warning-outline"} 
          label={activeIncident ? "Sự cố đang xử lý" : "Báo sự cố"} 
          danger 
          onPress={() => router.push(activeIncident ? `/(driver)/trips/${tripId}/incident-detail?incidentId=${activeIncident.incidentId}` as never : `/(driver)/trips/${tripId}/incident` as never)} 
        />
      </View>

      <Section title="Bản đồ tuyến đường" icon="map-outline">
        {errors.route ? <ErrorMessage message={errors.route} onRetry={loadRoute} /> : null}
        {route ? <><InfoRow label="Quãng đường" value={formatDistance(route.totalDistanceMeters)} /><InfoRow label="Thời gian dự kiến" value={formatDuration(route.totalDurationSeconds)} /><GoongRouteMap route={route} vehiclePosition={vehiclePosition} />{!vehiclePosition ? <Empty message="Chưa nhận được vị trí từ thiết bị." /> : null}</> : !errors.route ? <Empty message="Chưa có dữ liệu tuyến đường." /> : null}
      </Section>

      <Section title="Xe và thiết bị IoT" icon="hardware-chip-outline">
        {errors.tracking ? <ErrorMessage message={errors.tracking} onRetry={loadTracking} /> : null}
        {tracking ? <><View className="flex-row gap-3"><Metric label="Nhiệt độ" value={formatTemperature(tracking.telemetry?.temperatureC)} /><Metric label="Cửa xe" value={formatDoor(tracking.telemetry?.doorOpen)} /></View><InfoRow label="Biển số xe" value={tracking.vehicle?.truckPlate || '--'} /><InfoRow label="Mã thiết bị" value={tracking.device?.deviceCode || '--'} /><InfoRow label="Kết nối" value={formatOnlineState(tracking)} /><InfoRow label="Cập nhật cuối" value={formatDateTime(tracking.telemetry?.timestamp ?? tracking.device?.lastSeenAt)} /><InfoRow label="ETA" value={formatDateTime(tracking.eta?.estimatedArrival)} /></> : !errors.tracking ? <Empty message="Chưa nhận được telemetry thật từ thiết bị." /> : null}
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
      <Section title={`Điểm dừng (${trip?.stopCount ?? 0})`} icon="trail-sign-outline">
        {errors.trip ? <ErrorMessage message={errors.trip} onRetry={loadTrip} /> : null}
        {trip?.stops?.map((stop, index) => (
          <StopRow 
            key={stop.stopId}
            stop={stop}
            index={index} 
            onPress={() => router.push({
              pathname: '/(driver)/trips/stop/[stopId]',
              params: { stopId: stop.stopId, tripId },
            } as never)}
          />
        ))}
        {!trip?.stops?.length ? <Empty message="Chưa có điểm dừng." /> : null}
      </Section>
    </ScrollView>
  );
}

function Section({ title, icon, children }: { title: string; icon: React.ComponentProps<typeof Ionicons>['name']; children: React.ReactNode }) {
  return (
    <View style={{ backgroundColor: colors.surface.card, borderColor: colors.border.default }} className="gap-4 rounded-3xl border p-5 shadow-sm">
      <View className="flex-row items-center gap-2">
        <Ionicons name={icon} size={20} color={colors.brand.primary} />
        <Text style={{ color: colors.text.primary }} className="text-base font-bold">{title}</Text>
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

function StopRow({ stop, index, onPress }: { stop: DriverTripStopDto; index: number; onPress: () => void }) {
  const status = stop.status?.toUpperCase() || 'UNKNOWN';
  const disabled = !stop.stopId || status === 'DEPARTED';
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      className="flex-row items-center gap-3"
      style={({ pressed }) => ({ opacity: disabled ? 0.5 : pressed ? 0.7 : 1 })}
    >
      <View style={{ backgroundColor: colors.brand.primary }} className="h-7 w-7 items-center justify-center rounded-full">
        <Text style={{ color: colors.text.onPrimary }} className="text-xs font-bold">{stop.stopSequence ?? index + 1}</Text>
      </View>
      <View className="flex-1">
        <Text style={{ color: colors.text.primary }} className="font-semibold">{stop.address || 'Chưa có địa chỉ'}</Text>
        <Text style={{ color: colors.brand.primary }} className="mt-1 text-xs font-semibold">{STOP_STATUS[status] || 'Chưa xác định'}</Text>
      </View>
      {!disabled ? <Ionicons name="chevron-forward" size={20} color={colors.brand.primary} /> : null}
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
