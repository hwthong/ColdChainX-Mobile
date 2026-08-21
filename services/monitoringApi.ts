import { apiRequest } from './apiClient';
import {
  ApiResponse,
  getPlannedTripRoute,
  getTrackingByTripId,
  sanitizeTripId,
  TrackingDataResponse,
  TripRouteResponse,
} from './trackingApi';
import { TemperaturePoint } from '../components/customer/TemperatureChart';

export type TripTracking = Omit<TrackingDataResponse, 'device'> & {
  telemetry?: {
    latitude?: number;
    longitude?: number;
    temperatureC?: number;
    doorOpen?: boolean;
    timestamp?: string;
  };
  device?: {
    deviceId?: string;
    deviceCode?: string;
    isOnline?: boolean;
    status?: string;
    lastSeenAt?: string;
  } | null;
};

export interface SmartAlert {
  alertId?: string;
  alertType?: string;
  severity?: string;
  title?: string;
  message?: string;
  createdAt?: string;
  smartRiskScore?: number;
  actualTemperatureC?: number;
  forecastedSpikeTemp?: number;
  latitude?: number;
  longitude?: number;
  status?: string;
}

export interface TemperatureChart {
  points: TemperaturePoint[];
}

export interface StopTemperatureChart extends TemperatureChart {
  tripId: string;
  stopId: string;
  endTime: string;
  rawPointCount: number;
  sampledPointCount: number;
}

export async function getTripTracking(token: string, tripId: string) {
  const response = await getTrackingByTripId(token, tripId);
  return {
    ...response,
    data: response.data ? toTripTracking(response.data) : null,
  } satisfies ApiResponse<TripTracking>;
}

export function getTripRoute(token: string, tripId: string) {
  return getPlannedTripRoute(token, tripId) as Promise<ApiResponse<TripRouteResponse>>;
}

export function getTripSmartAlerts(token: string, tripId: string) {
  return getAlertsByKind(token, tripId, 'smart');
}

export function getTripRiskAlerts(token: string, tripId: string) {
  return getAlertsByKind(token, tripId, 'risk');
}

export function getTripSsaAlerts(token: string, tripId: string) {
  return getAlertsByKind(token, tripId, 'ssa');
}

export async function getTripAlerts(token: string, tripId: string) {
  const results = await Promise.all([
    getTripRiskAlerts(token, tripId),
    getTripSsaAlerts(token, tripId),
    getTripSmartAlerts(token, tripId),
  ]);
  const failed = results.find((result) => !result.success);
  if (failed) return { ...failed, data: [] } satisfies ApiResponse<SmartAlert[]>;

  const seen = new Set<string>();
  const alerts = results
    .flatMap((result) => result.data ?? [])
    .filter((alert) => {
      const key = alert.alertId || `${alert.alertType ?? ''}-${alert.createdAt ?? ''}-${alert.message ?? ''}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((left, right) => Date.parse(right.createdAt ?? '') - Date.parse(left.createdAt ?? ''));

  return { success: true, data: alerts } satisfies ApiResponse<SmartAlert[]>;
}

function getAlertsByKind(token: string, tripId: string, kind: 'risk' | 'ssa' | 'smart') {
  const validTripId = requireTripId(tripId);
  return apiRequest<ApiResponse<SmartAlert[]>>(`/api/trip/${validTripId}/alerts/${kind}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function getTripTemperatureChart(token: string, tripId: string) {
  const validTripId = requireTripId(tripId);
  return apiRequest<ApiResponse<TemperatureChart>>(`/api/trip/${validTripId}/chart/temperature`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function getStopTemperatureChart(token: string, stopId: string) {
  const validStopId = requireStopId(stopId);
  return apiRequest<ApiResponse<StopTemperatureChart>>(
    `/api/stops/${validStopId}/chart/temperature`,
    {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    }
  );
}

function toTripTracking(tracking: TrackingDataResponse): TripTracking {
  const latest = tracking.latestTelemetry;
  const rawLat = latest?.lat ?? (tracking as any).lat ?? (tracking as any).latitude ?? (tracking as any).currentLatitude;
  const rawLon = latest?.lon ?? (tracking as any).lon ?? (tracking as any).lng ?? (tracking as any).longitude ?? (tracking as any).currentLongitude;
  const latNum = rawLat !== undefined && rawLat !== null && !isNaN(Number(rawLat)) ? Number(rawLat) : undefined;
  const lonNum = rawLon !== undefined && rawLon !== null && !isNaN(Number(rawLon)) ? Number(rawLon) : undefined;

  const hasCoords = typeof latNum === 'number' && Number.isFinite(latNum) && typeof lonNum === 'number' && Number.isFinite(lonNum);

  return {
    ...tracking,
    telemetry: (latest || hasCoords) ? {
      latitude: latNum ?? latest?.lat,
      longitude: lonNum ?? latest?.lon,
      temperatureC: latest?.tempC ?? latest?.temperature ?? (tracking as any).temperature,
      doorOpen: latest?.doorOpen ?? (tracking as any).doorOpen,
      timestamp: latest?.timestamp ?? (tracking as any).timestamp,
    } : undefined,
    device: tracking.device ? {
      deviceId: tracking.device.deviceId,
      deviceCode: tracking.device.deviceCode,
      status: tracking.device.status,
      isOnline: tracking.device.isOnline ?? inferOnlineState(tracking.device.status),
      lastSeenAt: tracking.device.lastPingTime ?? undefined,
    } : null,
  };
}

function inferOnlineState(status?: string) {
  const normalized = status?.trim().toUpperCase();
  if (normalized === 'ONLINE' || normalized === 'ACTIVE') return true;
  if (normalized === 'OFFLINE' || normalized === 'INACTIVE' || normalized === 'DISCONNECTED') return false;
  return undefined;
}

function requireTripId(tripId: string) {
  const sanitized = sanitizeTripId(tripId);
  if (!sanitized) throw new Error('TripId không hợp lệ. Vui lòng dùng UUID của chuyến.');
  return encodeURIComponent(sanitized);
}

function requireStopId(stopId: string) {
  const sanitized = sanitizeTripId(stopId);
  if (!sanitized) throw new Error('StopId không hợp lệ. Vui lòng dùng UUID do hệ thống cung cấp.');
  return encodeURIComponent(sanitized);
}
