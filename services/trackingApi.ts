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
    isOnline?: boolean;
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
  const sanitizedTripId = sanitizeTripId(tripId);
  if (!sanitizedTripId) {
    return Promise.reject(new Error('TripId không hợp lệ. Vui lòng dùng UUID của chuyến.'));
  }

  return apiRequest<ApiResponse<unknown>>(`/api/tracking/${encodeURIComponent(sanitizedTripId)}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  }).then((response) => ({
    ...response,
    data: normalizeTrackingData(response.data),
  } satisfies ApiResponse<TrackingDataResponse>));
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

export function normalizeTrackingData(value: unknown): TrackingDataResponse | null {
  if (!isRecord(value)) return null;

  const vehicleValue = readValue(value, 'vehicle', 'Vehicle');
  const deviceValue = readValue(value, 'device', 'Device');
  const latestValue = readValue(value, 'latestTelemetry', 'LatestTelemetry');
  const etaValue = readValue(value, 'eta', 'Eta');

  return {
    tripId: getString(readValue(value, 'tripId', 'TripId')) ?? '',
    status: getString(readValue(value, 'status', 'Status')) ?? '',
    vehicle: normalizeVehicle(vehicleValue),
    device: normalizeDevice(deviceValue),
    orders: getArray(readValue(value, 'orders', 'Orders')).map(normalizeTrackingOrder),
    latestTelemetry: normalizeTelemetry(latestValue),
    eta: normalizeEta(etaValue),
  };
}

function normalizeVehicle(value: unknown): TrackingDataResponse['vehicle'] {
  if (!isRecord(value)) return null;
  return {
    vehicleId: getString(readValue(value, 'vehicleId', 'VehicleId')) ?? '',
    truckPlate: getString(readValue(value, 'truckPlate', 'TruckPlate')) ?? '',
  };
}

function normalizeDevice(value: unknown): TrackingDataResponse['device'] {
  if (!isRecord(value)) return null;
  const explicitOnline = getBoolean(readValue(value, 'isOnline', 'IsOnline'));
  return {
    deviceId: getString(readValue(value, 'deviceId', 'DeviceId')) ?? '',
    deviceCode: getString(readValue(value, 'deviceCode', 'DeviceCode')) ?? '',
    status: getString(readValue(value, 'status', 'Status')) ?? '',
    lastPingTime: getString(readValue(value, 'lastPingTime', 'LastPingTime')),
    isOnline: explicitOnline ?? undefined,
  };
}

function normalizeTelemetry(value: unknown): TelemetryDataDto | null {
  if (!isRecord(value)) return null;
  const lat = getNumber(readValue(value, 'lat', 'Lat', 'latitude', 'Latitude'));
  const lon = getNumber(readValue(value, 'lon', 'Lon', 'lng', 'Lng', 'longitude', 'Longitude'));
  if (lat === null || lon === null) return null;

  return {
    lat,
    lon,
    temperature: getNumber(readValue(value, 'temperature', 'Temperature')) ?? undefined,
    tempC: getNumber(readValue(value, 'tempC', 'TempC')) ?? undefined,
    humidity: getNumber(readValue(value, 'humidity', 'Humidity')) ?? undefined,
    humidityPercent: getNumber(readValue(value, 'humidityPercent', 'HumidityPercent')) ?? undefined,
    timestamp: getString(readValue(value, 'timestamp', 'Timestamp')) ?? undefined,
    batteryLevel: getNumber(readValue(value, 'batteryLevel', 'BatteryLevel')) ?? undefined,
    doorOpen: getBoolean(readValue(value, 'doorOpen', 'DoorOpen')) ?? undefined,
  };
}

function normalizeEta(value: unknown): EtaDto | null {
  if (!isRecord(value)) return null;
  const distance = getNumber(readValue(value, 'remainingDistanceKm', 'RemainingDistanceKm'));
  const duration = getNumber(readValue(value, 'estimatedDurationMinutes', 'EstimatedDurationMinutes'));
  const arrival = getString(readValue(value, 'estimatedArrival', 'EstimatedArrival'));
  if (distance === null || duration === null || !arrival) return null;
  return {
    remainingDistanceKm: distance,
    estimatedDurationMinutes: duration,
    estimatedArrival: arrival,
  };
}

function normalizeTrackingOrder(value: unknown): TrackingOrderDto {
  const record = isRecord(value) ? value : {};
  return {
    orderId: getString(readValue(record, 'orderId', 'OrderId')) ?? '',
    trackingCode: getString(readValue(record, 'trackingCode', 'TrackingCode')) ?? '',
    itemName: getString(readValue(record, 'itemName', 'ItemName')) ?? '',
    category: getString(readValue(record, 'category', 'Category')) ?? '',
    tempCondition: getString(readValue(record, 'tempCondition', 'TempCondition')) ?? '',
  };
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

function getBoolean(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    if (value.toLowerCase() === 'true') return true;
    if (value.toLowerCase() === 'false') return false;
  }
  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
