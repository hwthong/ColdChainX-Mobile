import { apiRequest } from './apiClient';
import { TrackingDataResponse, TripRouteResponse, ApiResponse } from './trackingApi';
import { TemperaturePoint } from '../components/customer/TemperatureChart';

export type TripTracking = TrackingDataResponse & {
  telemetry?: {
    latitude?: number;
    longitude?: number;
    temperatureC?: number;
    doorOpen?: boolean;
    timestamp?: string;
  };
  device?: {
    isOnline?: boolean;
    status?: string;
    lastSeenAt?: string;
  };
};

export interface SmartAlert {
  alertId?: string;
  alertType?: string;
  title?: string;
  message?: string;
  createdAt?: string;
  smartRiskScore?: number;
}

export interface TemperatureChart {
  points: TemperaturePoint[];
}

export function getTripTracking(token: string, tripId: string) {
  return apiRequest<ApiResponse<TripTracking>>(`/api/tracking/${tripId}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function getTripRoute(token: string, tripId: string) {
  return apiRequest<ApiResponse<TripRouteResponse>>(`/api/Dispatch/trip/${tripId}/route`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function getTripSmartAlerts(token: string, tripId: string) {
  return apiRequest<ApiResponse<SmartAlert[]>>(`/api/trip/${tripId}/alerts/smart`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function getTripTemperatureChart(token: string, tripId: string) {
  return apiRequest<ApiResponse<TemperatureChart>>(`/api/trip/${tripId}/chart/temperature`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });
}
