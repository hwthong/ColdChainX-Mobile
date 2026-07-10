import { apiRequest } from './apiClient';

const TRIP_ID_PATTERN = /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/;

export interface TrackingOrderDto {
  orderId: string;
  trackingCode: string;
  itemName: string;
  category: string;
  tempCondition: string;
}

export interface TelemetryDataDto {
  lat: number;
  lon: number;
  temperature?: number;
  tempC?: number;
  humidity?: number;
  humidityPercent?: number;
  timestamp?: string;
  batteryLevel?: number;
  doorOpen?: boolean;
}

export interface EtaDto {
  remainingDistanceKm: number;
  estimatedDurationMinutes: number;
  estimatedArrival: string;
}

export interface TrackingDataResponse {
  tripId: string;
  status: string;
  vehicle?: {
    vehicleId: string;
    truckPlate: string;
  } | null;
  device?: {
    deviceId: string;
    deviceCode: string;
    status: string;
    lastPingTime?: string | null;
  } | null;
  orders: TrackingOrderDto[];
  latestTelemetry?: TelemetryDataDto | null;
  eta?: EtaDto | null;
}

export interface TripRouteOrderDto {
  orderId: string;
  trackingCode: string;
  itemName: string;
  category?: string | null;
  quantity?: number | null;
  weightKg?: number | null;
  cbm?: number | null;
  tempCondition?: string | null;
}

export interface TripRouteLpnDto {
  lpnId: string;
  lpnCode: string;
  orderId: string;
  orderTrackingCode?: string | null;
  itemName?: string | null;
  quantity?: number | null;
  weightKg?: number | null;
  cbm?: number | null;
  tempCondition?: string | null;
}

export interface TripRoutePointDto {
  locationId?: string | null;
  address: string;
  lat: number;
  lon: number;
}

export interface OptimizedTripStopDto extends TripRoutePointDto {
  stopId?: string | null;
  originalStopSequence?: number | null;
  optimizedSequence?: number | null;
  stopType?: string | null;
  orders: TripRouteOrderDto[];
  lpns: TripRouteLpnDto[];
}

export interface TripRouteResponse {
  tripId: string;
  overviewPolyline?: string | null;
  totalDistanceMeters: number;
  totalDurationSeconds: number;
  origin?: TripRoutePointDto | null;
  destination?: TripRoutePointDto | null;
  waypointOrder: number[];
  optimizedStops: OptimizedTripStopDto[];
}

export interface ApiResponse<T> {
  success: boolean;
  message?: string | null;
  data?: T | null;
}

export function getTrackingByTripId(accessToken: string, tripId: string) {
  return apiRequest<ApiResponse<TrackingDataResponse>>(`/api/tracking/${tripId}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}

export async function getPlannedTripRoute(accessToken: string, tripId: string) {
  const sanitizedTripId = sanitizeTripId(tripId);
  if (!sanitizedTripId) {
    throw new Error('TripId không hợp lệ. Vui lòng nhập UUID của chuyến.');
  }

  const response = await apiRequest<ApiResponse<unknown>>(
    `/api/Dispatch/trip/${encodeURIComponent(sanitizedTripId)}/route`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  return {
    ...response,
    data: normalizeTripRoute(response.data),
  } satisfies ApiResponse<TripRouteResponse>;
}

export function sanitizeTripId(value: string) {
  const uuidMatch = value.match(TRIP_ID_PATTERN);
  return uuidMatch?.[0] ?? '';
}

function normalizeTripRoute(value: unknown): TripRouteResponse | null {
  if (!isRecord(value)) return null;

  return {
    tripId: getString(readValue(value, 'tripId', 'TripId')) ?? '',
    overviewPolyline: getString(readValue(value, 'overviewPolyline', 'OverviewPolyline')),
    totalDistanceMeters: getNumber(readValue(value, 'totalDistanceMeters', 'TotalDistanceMeters')) ?? 0,
    totalDurationSeconds: getNumber(readValue(value, 'totalDurationSeconds', 'TotalDurationSeconds')) ?? 0,
    origin: normalizePoint(readValue(value, 'origin', 'Origin')),
    destination: normalizePoint(readValue(value, 'destination', 'Destination')),
    waypointOrder: getNumberArray(readValue(value, 'waypointOrder', 'WaypointOrder')),
    optimizedStops: getArray(readValue(value, 'optimizedStops', 'OptimizedStops'))
      .map(normalizeStop)
      .filter((stop): stop is OptimizedTripStopDto => Boolean(stop))
      .sort((left, right) => (left.optimizedSequence ?? 0) - (right.optimizedSequence ?? 0)),
  };
}

function normalizePoint(value: unknown): TripRoutePointDto | null {
  if (!isRecord(value)) return null;

  const lat = getNumber(readValue(value, 'lat', 'Lat', 'latitude', 'Latitude'));
  const lon = getNumber(readValue(value, 'lon', 'Lon', 'lng', 'Lng', 'longitude', 'Longitude'));
  if (lat === null || lon === null) return null;

  return {
    locationId: getString(readValue(value, 'locationId', 'LocationId')),
    address: getString(readValue(value, 'address', 'Address')) ?? '',
    lat,
    lon,
  };
}

function normalizeStop(value: unknown): OptimizedTripStopDto | null {
  const point = normalizePoint(value);
  if (!point || !isRecord(value)) return null;

  return {
    ...point,
    stopId: getString(readValue(value, 'stopId', 'StopId')),
    originalStopSequence: getNumber(readValue(value, 'originalStopSequence', 'OriginalStopSequence')),
    optimizedSequence: getNumber(readValue(value, 'optimizedSequence', 'OptimizedSequence')),
    stopType: getString(readValue(value, 'stopType', 'StopType')),
    orders: getArray(readValue(value, 'orders', 'Orders')).map(normalizeRouteOrder),
    lpns: getArray(readValue(value, 'lpns', 'Lpns')).map(normalizeLpn),
  };
}

function normalizeRouteOrder(value: unknown): TripRouteOrderDto {
  const record = isRecord(value) ? value : {};
  return {
    orderId: getString(readValue(record, 'orderId', 'OrderId')) ?? '',
    trackingCode: getString(readValue(record, 'trackingCode', 'TrackingCode')) ?? '',
    itemName: getString(readValue(record, 'itemName', 'ItemName')) ?? '',
    category: getString(readValue(record, 'category', 'Category')),
    quantity: getNumber(readValue(record, 'quantity', 'Quantity')),
    weightKg: getNumber(readValue(record, 'weightKg', 'WeightKg')),
    cbm: getNumber(readValue(record, 'cbm', 'Cbm')),
    tempCondition: getString(readValue(record, 'tempCondition', 'TempCondition')),
  };
}

function normalizeLpn(value: unknown): TripRouteLpnDto {
  const record = isRecord(value) ? value : {};
  return {
    lpnId: getString(readValue(record, 'lpnId', 'LpnId')) ?? '',
    lpnCode: getString(readValue(record, 'lpnCode', 'LpnCode')) ?? '',
    orderId: getString(readValue(record, 'orderId', 'OrderId')) ?? '',
    orderTrackingCode: getString(readValue(record, 'orderTrackingCode', 'OrderTrackingCode')),
    itemName: getString(readValue(record, 'itemName', 'ItemName')),
    quantity: getNumber(readValue(record, 'quantity', 'Quantity')),
    weightKg: getNumber(readValue(record, 'weightKg', 'WeightKg')),
    cbm: getNumber(readValue(record, 'cbm', 'Cbm')),
    tempCondition: getString(readValue(record, 'tempCondition', 'TempCondition')),
  };
}

function readValue(record: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    if (key in record) return record[key];
  }
  return undefined;
}

function getArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function getNumberArray(value: unknown): number[] {
  return getArray(value)
    .map(getNumber)
    .filter((item): item is number => item !== null);
}

function getString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

function getNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
