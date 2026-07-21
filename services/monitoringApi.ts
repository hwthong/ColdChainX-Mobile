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

function toTripTracking(tracking: TrackingDataResponse): TripTracking {
  const latest = tracking.latestTelemetry;
  return {
    ...tracking,
    telemetry: latest ? {
      latitude: latest.lat,
      longitude: latest.lon,
      temperatureC: latest.tempC ?? latest.temperature,
      doorOpen: latest.doorOpen,
      timestamp: latest.timestamp,
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
