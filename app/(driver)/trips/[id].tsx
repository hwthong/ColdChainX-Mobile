import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, AppState, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';

import { GoongRouteMap } from '../../../components/customer/GoongRouteMap';
import { TemperatureChart } from '../../../components/customer/TemperatureChart';
import { getApiErrorMessage } from '../../../services/apiClient';
import {
  getTripAlerts, getTripRoute, getTripTemperatureChart, getTripTracking,
  SmartAlert, TemperatureChart as TemperatureChartData, TripTracking,
} from '../../../services/monitoringApi';
import { OptimizedTripStopDto, TripRouteResponse } from '../../../services/trackingApi';
import { useAuthStore } from '../../../store/useAuthStore';

const POLL_MS = 15_000;
const MAX_POLL_MS = 60_000;
const TERMINAL = new Set(['COMPLETED', 'CANCELLED', 'CLOSED']);
const STATUS: Record<string, string> = {
  PLANNED: 'Đã lên kế hoạch', PICKING: 'Đang lấy hàng', LOADING_COMPLETED: 'Đã xếp hàng',
  SEALED: 'Đã kẹp chì', DISPATCHED: 'Đã điều phối', IN_TRANSIT: 'Đang vận chuyển',
  DELAYED: 'Bị trễ', COMPLETED: 'Hoàn tất', CLOSED: 'Đã đóng', CANCELLED: 'Đã hủy',
};

export default function DriverTripDetailScreen() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const tripId = Array.isArray(params.id) ? params.id[0] : params.id;
  const router = useRouter();
  const token = useAuthStore((state) => state.token);
  const [tracking, setTracking] = useState<TripTracking | null>(null);
  const [route, setRoute] = useState<TripRouteResponse | null>(null);
  const [chart, setChart] = useState<TemperatureChartData | null>(null);
  const [alerts, setAlerts] = useState<SmartAlert[]>([]);
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
  }, [setError, token, tripId]);

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
      inFlight = false;
      terminal = Boolean(current?.status && TERMINAL.has(current.status.toUpperCase()));
      if (current) { failures = 0; successes += 1; if (successes % 3 === 0) void Promise.all([loadChart(), loadAlerts()]); }
      else failures += 1;
      setLoading(false);
      if (disposed || terminal) return;
      clear();
      timer = setTimeout(() => void poll(), Math.min(POLL_MS * 2 ** failures, MAX_POLL_MS));
    };
    void Promise.all([loadRoute(), loadChart(), loadAlerts()]);
    void poll();
    const subscription = AppState.addEventListener('change', (nextState) => {
      appState = nextState;
      if (nextState !== 'active') clear(); else if (!terminal) void poll();
    });
    return () => { disposed = true; clear(); subscription.remove(); };
  }, [loadAlerts, loadChart, loadRoute, loadTracking, setError, token, tripId]));

  const refresh = useCallback(async () => {
    setRefreshing(true); await Promise.all([loadTracking(), loadRoute(), loadChart(), loadAlerts()]); setRefreshing(false);
  }, [loadAlerts, loadChart, loadRoute, loadTracking]);

  if (loading) return <View className="flex-1 items-center justify-center bg-[#F6F8F2]"><ActivityIndicator size="large" color="#8B4513" /><Text className="mt-4 text-amber-800">Đang tải giám sát chuyến...</Text></View>;
  const vehiclePosition = getVehiclePosition(tracking);
  const status = tracking?.status || 'UNKNOWN';

  return (
    <ScrollView className="flex-1 bg-[#F6F8F2]" contentContainerStyle={{ padding: 20, paddingBottom: 100, gap: 16 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor="#8B4513" />}>
      <View className="flex-row items-start justify-between gap-3"><View className="flex-1"><Text className="text-xs font-bold uppercase tracking-widest text-amber-700">Chuyến vận chuyển</Text><Text className="mt-1 text-2xl font-bold text-amber-950">{tripId?.slice(0, 8).toUpperCase() || '--'}</Text></View><View className="rounded-xl bg-amber-100 px-3 py-2"><Text className="text-xs font-bold text-amber-900">{STATUS[status.toUpperCase()] || status}</Text></View></View>
      <View className="flex-row gap-3"><Action icon="document-text-outline" label="Chứng từ" onPress={() => router.push(`/(driver)/trips/${tripId}/documents` as never)} /><Action icon="warning-outline" label="Báo sự cố" danger onPress={() => router.push(`/(driver)/trips/${tripId}/incident` as never)} /></View>

      <Section title="Bản đồ tuyến đường" icon="map-outline">
        {errors.route ? <ErrorMessage message={errors.route} onRetry={loadRoute} /> : null}
        {route ? <><InfoRow label="Quãng đường" value={formatDistance(route.totalDistanceMeters)} /><InfoRow label="Thời gian dự kiến" value={formatDuration(route.totalDurationSeconds)} /><GoongRouteMap route={route} vehiclePosition={vehiclePosition} />{!vehiclePosition ? <Empty message="Chưa nhận được vị trí từ thiết bị." /> : null}</> : !errors.route ? <Empty message="Chưa có dữ liệu tuyến đường." /> : null}
      </Section>

      <Section title="Xe và thiết bị IoT" icon="hardware-chip-outline">
        {errors.tracking ? <ErrorMessage message={errors.tracking} onRetry={loadTracking} /> : null}
        {tracking ? <><View className="flex-row gap-3"><Metric label="Nhiệt độ" value={formatTemperature(tracking.telemetry?.temperatureC)} /><Metric label="Cửa xe" value={formatDoor(tracking.telemetry?.doorOpen)} /></View><InfoRow label="Biển số xe" value={tracking.vehicle?.truckPlate || '--'} /><InfoRow label="Mã thiết bị" value={tracking.device?.deviceCode || '--'} /><InfoRow label="Kết nối" value={formatOnlineState(tracking)} /><InfoRow label="Cập nhật cuối" value={formatDateTime(tracking.telemetry?.timestamp ?? tracking.device?.lastSeenAt)} /><InfoRow label="ETA" value={formatDateTime(tracking.eta?.estimatedArrival)} /></> : !errors.tracking ? <Empty message="Chưa nhận được telemetry thật từ thiết bị." /> : null}
      </Section>

      <Section title="Lịch sử nhiệt độ" icon="pulse-outline">{errors.chart ? <ErrorMessage message={errors.chart} onRetry={loadChart} /> : null}{chart ? <TemperatureChart points={chart.points} /> : !errors.chart ? <Empty message="Chưa có dữ liệu nhiệt độ." /> : null}</Section>
      <Section title="Cảnh báo vận hành" icon="notifications-outline">{errors.alerts ? <ErrorMessage message={errors.alerts} onRetry={loadAlerts} /> : null}{!errors.alerts && alerts.length === 0 ? <Empty message="Chưa có cảnh báo cho chuyến này." /> : null}{alerts.map((alert, index) => <View key={alert.alertId || `${alert.createdAt}-${index}`} className="rounded-2xl border border-red-200 bg-red-50 p-4"><Text className="font-bold text-red-900">{alert.title || alert.alertType || 'Cảnh báo'}</Text><Text className="mt-2 text-sm leading-5 text-red-800">{alert.message || 'Không có nội dung.'}</Text><Text className="mt-2 text-xs text-red-700">{formatDateTime(alert.createdAt)}</Text></View>)}</Section>
      <Section title={`Điểm dừng (${route?.optimizedStops.length ?? 0})`} icon="trail-sign-outline">{route?.optimizedStops.map((stop, index) => <StopRow key={stop.stopId || `${stop.lat}-${stop.lon}-${index}`} stop={stop} index={index} />)}{!route?.optimizedStops.length ? <Empty message="Chưa có điểm dừng." /> : null}</Section>
    </ScrollView>
  );
}

function Section({ title, icon, children }: { title: string; icon: React.ComponentProps<typeof Ionicons>['name']; children: React.ReactNode }) { return <View className="gap-4 rounded-3xl bg-white p-5"><View className="flex-row items-center gap-2"><Ionicons name={icon} size={20} color="#8B4513" /><Text className="text-base font-bold text-amber-950">{title}</Text></View>{children}</View>; }
function Action({ icon, label, danger = false, onPress }: { icon: React.ComponentProps<typeof Ionicons>['name']; label: string; danger?: boolean; onPress: () => void }) { return <Pressable onPress={onPress} className={`flex-1 flex-row items-center justify-center rounded-xl border p-3 ${danger ? 'border-red-200 bg-red-50' : 'border-amber-200 bg-white'}`}><Ionicons name={icon} size={20} color={danger ? '#991B1B' : '#8B4513'} /><Text className={`ml-2 text-sm font-bold ${danger ? 'text-red-900' : 'text-amber-900'}`}>{label}</Text></Pressable>; }
function Metric({ label, value }: { label: string; value: string }) { return <View className="flex-1 rounded-2xl bg-amber-50 p-4"><Text className="text-xs text-amber-700">{label}</Text><Text className="mt-2 text-lg font-bold text-amber-950">{value}</Text></View>; }
function InfoRow({ label, value }: { label: string; value: string }) { return <View className="flex-row items-start justify-between gap-4 border-b border-amber-100 pb-2"><Text className="text-sm text-amber-700">{label}</Text><Text className="flex-1 text-right text-sm font-semibold text-amber-950">{value}</Text></View>; }
function StopRow({ stop, index }: { stop: OptimizedTripStopDto; index: number }) { return <View className="flex-row gap-3"><View className="h-7 w-7 items-center justify-center rounded-full bg-amber-800"><Text className="text-xs font-bold text-white">{stop.optimizedSequence ?? index + 1}</Text></View><View className="flex-1"><Text className="font-semibold text-amber-950">{stop.address || 'Chưa có địa chỉ'}</Text><Text className="mt-1 text-xs text-amber-700">{stop.orders.length} đơn · {stop.lpns.length} LPN</Text></View></View>; }
function ErrorMessage({ message, onRetry }: { message: string; onRetry: () => void | Promise<unknown> }) { return <View className="rounded-2xl border border-red-200 bg-red-50 p-4"><Text className="text-sm leading-5 text-red-800">{message}</Text><Pressable onPress={() => void onRetry()} className="mt-3 self-start rounded-lg bg-red-800 px-4 py-2"><Text className="font-bold text-white">Thử lại</Text></Pressable></View>; }
function Empty({ message }: { message: string }) { return <Text className="py-3 text-center text-sm font-medium text-amber-700">{message}</Text>; }

function getVehiclePosition(tracking: TripTracking | null) { const latitude = tracking?.telemetry?.latitude; const longitude = tracking?.telemetry?.longitude; if (typeof latitude !== 'number' || !Number.isFinite(latitude) || latitude < -90 || latitude > 90) return null; if (typeof longitude !== 'number' || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) return null; return { latitude, longitude }; }
function formatOnlineState(tracking: TripTracking) { if (tracking.device?.isOnline === true) return 'Trực tuyến'; if (tracking.device?.isOnline === false) return 'Ngoại tuyến'; return tracking.device?.status || 'Không xác định'; }
function formatTemperature(value?: number) { return typeof value === 'number' && Number.isFinite(value) ? `${value.toFixed(1)} °C` : '--'; }
function formatDoor(value?: boolean) { return value === true ? 'Đang mở' : value === false ? 'Đang đóng' : '--'; }
function formatDateTime(value?: string | null) { if (!value) return '--'; const date = new Date(value); return Number.isNaN(date.getTime()) ? '--' : date.toLocaleString('vi-VN'); }
function formatDistance(value: number) { if (!Number.isFinite(value) || value <= 0) return '--'; return value >= 1000 ? `${(value / 1000).toFixed(1)} km` : `${Math.round(value)} m`; }
function formatDuration(value: number) { if (!Number.isFinite(value) || value <= 0) return '--'; const minutes = Math.round(value / 60); const hours = Math.floor(minutes / 60); return hours ? `${hours} giờ ${minutes % 60} phút` : `${minutes} phút`; }
