import type {
  TripRouteLpnDto,
  TripRouteOrderDto,
  TripRoutePointDto,
  TripRouteResponse,
} from './trackingApi';

export type RouteMapPoint = {
  id: string;
  locationId?: string | null;
  label: string;
  address: string;
  lat: number;
  lon: number;
  type: 'origin' | 'stop' | 'destination';
  sequence?: number;
  stopType?: string | null;
  ordersCount?: number;
  lpnsCount?: number;
  orderItemsSummary?: string;
  orders?: TripRouteOrderDto[];
  lpns?: TripRouteLpnDto[];
  accessibilityLabel: string;
};

/**
 * Format total distance in meters to a friendly Vietnamese km / m string.
 * Example: 125000 -> "125 km", 12500 -> "12.5 km", 800 -> "800 m"
 */
export function formatTripDistance(meters: number): string {
  if (!Number.isFinite(meters) || meters <= 0) return '0 km';
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }
  const km = meters / 1000;
  if (km >= 100 || Number.isInteger(km)) {
    return `${Math.round(km)} km`;
  }
  return `${km.toFixed(1).replace(/\.0$/, '')} km`;
}

/**
 * Format total duration in seconds to a friendly Vietnamese hours & minutes string.
 * Example: 10800 -> "3 giờ", 8100 -> "2 giờ 15 phút", 2400 -> "40 phút"
 */
export function formatTripDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0 phút';
  const totalMinutes = Math.round(seconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0 && minutes > 0) {
    return `${hours} giờ ${minutes} phút`;
  }
  if (hours > 0) {
    return `${hours} giờ`;
  }
  return `${minutes} phút`;
}

/**
 * Calculate final destination number based on count of valid intermediate stops.
 * Example: 2 optimizedStops -> final destination is #3.
 * 0 optimizedStops -> final destination is #1.
 */
export function calculateFinalDestinationNumber(optimizedStopsCount: number): number {
  const safeCount =
    Number.isInteger(optimizedStopsCount) && optimizedStopsCount > 0
      ? optimizedStopsCount
      : 0;
  return safeCount + 1;
}

/**
 * Polyline decode cache to avoid recomputing the same overviewPolyline.
 */
const polylineCache = new Map<string, [number, number][]>();
const MAX_CACHE_SIZE = 50;

/**
 * Decodes an encoded polyline string into an array of [longitude, latitude] coordinates.
 */
export function decodePolyline(encoded?: string | null): [number, number][] {
  if (!encoded || typeof encoded !== 'string') return [];

  const cached = polylineCache.get(encoded);
  if (cached) return cached;

  let index = 0;
  let lat = 0;
  let lon = 0;
  const coordinates: [number, number][] = [];

  while (index < encoded.length) {
    const latResult = decodePolylineValue(encoded, index);
    if (!latResult) break;
    index = latResult.nextIndex;
    lat += latResult.delta;

    const lonResult = decodePolylineValue(encoded, index);
    if (!lonResult) break;
    index = lonResult.nextIndex;
    lon += lonResult.delta;

    const decodedLatitude = lat / 1e5;
    const decodedLongitude = lon / 1e5;
    if (isValidMapCoordinate(decodedLatitude, decodedLongitude)) {
      coordinates.push([decodedLongitude, decodedLatitude]);
    }
  }

  if (polylineCache.size >= MAX_CACHE_SIZE) {
    const firstKey = polylineCache.keys().next().value;
    if (firstKey) polylineCache.delete(firstKey);
  }
  polylineCache.set(encoded, coordinates);

  return coordinates;
}

function decodePolylineValue(encoded: string, startIndex: number) {
  let result = 0;
  let shift = 0;
  let index = startIndex;
  let byte = 0;

  do {
    if (index >= encoded.length) return null;
    byte = encoded.charCodeAt(index++) - 63;
    result |= (byte & 0x1f) << shift;
    shift += 5;
  } while (byte >= 0x20);

  return {
    delta: result & 1 ? ~(result >> 1) : result >> 1,
    nextIndex: index,
  };
}

/**
 * Validate latitude and longitude values.
 */
export function isValidMapCoordinate(
  lat?: number | null,
  lon?: number | null
): lat is number {
  return (
    typeof lat === 'number' &&
    typeof lon === 'number' &&
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    lat >= -90 &&
    lat <= 90 &&
    lon >= -180 &&
    lon <= 180
  );
}

/**
 * Build ordered list of RouteMapPoints from a TripRouteResponse.
 * Ensures:
 * 1. Origin is assigned type 'origin' with warehouse icon (not numbered).
 * 2. Intermediate stops are assigned type 'stop' with sequence numbers 1, 2, 3...
 * 3. Destination is assigned type 'destination' with number = (stops count + 1) or #1.
 * 4. Deduplication of overlapping destination and stops is handled gracefully.
 * 5. Accessibility labels are populated for screen readers.
 */
export function buildRoutePoints(route?: TripRouteResponse | null): RouteMapPoint[] {
  if (!route) return [];

  const points: RouteMapPoint[] = [];
  const origin = toMapPoint(
    route.origin,
    'origin',
    'Kho xuất phát',
    undefined,
    undefined,
    undefined,
    undefined,
    route.origin?.locationId || `${route.tripId}-origin`
  );
  if (origin) points.push(origin);

  const optimizedStops = route.optimizedStops || [];
  const hasUsableSequences = optimizedStops.every(
    (stop, index, stops) =>
      Number.isInteger(stop.optimizedSequence) &&
      (stop.optimizedSequence ?? 0) > 0 &&
      (stop.optimizedSequence ?? 0) <= stops.length &&
      stops.findIndex((candidate) => candidate.optimizedSequence === stop.optimizedSequence) === index
  );

  optimizedStops.forEach((stop, index) => {
    if (!isValidMapCoordinate(stop.lat, stop.lon)) return;
    const duplicate = points.find((point) => isSameRouteLocation(point, stop));
    if (duplicate) {
      mergePointDetails(duplicate, stop.orders, stop.lpns);
      return;
    }

    const displayNumber = hasUsableSequences
      ? (stop.optimizedSequence as number)
      : index + 1;
    const point = toMapPoint(
      stop,
      'stop',
      `Điểm giao số ${displayNumber}`,
      displayNumber,
      stop.stopType,
      stop.orders,
      stop.lpns,
      stop.stopId || stop.locationId || `${route.tripId}-stop-${index}`
    );
    if (point) points.push(point);
  });

  const visibleStops = points.filter((point) => point.type === 'stop');
  const needsVisibleFallback =
    !hasUsableSequences ||
    visibleStops.some(
      (point) => !Number.isInteger(point.sequence) || (point.sequence ?? 0) > visibleStops.length
    );
  if (needsVisibleFallback) {
    visibleStops.forEach((point, index) => {
      const displayNumber = index + 1;
      point.sequence = displayNumber;
      point.label = `Điểm giao số ${displayNumber}`;
      point.accessibilityLabel = `Điểm giao số ${displayNumber}, ${point.address}`;
    });
  }

  if (route.destination && isValidMapCoordinate(route.destination.lat, route.destination.lon)) {
    const duplicateIndex = points.findIndex(
      (point) => point.type !== 'origin' && isSameRouteLocation(point, route.destination!)
    );

    if (duplicateIndex >= 0) {
      const duplicate = points[duplicateIndex];
      duplicate.type = 'destination';
      duplicate.label = `Điểm đến cuối — Điểm số ${duplicate.sequence ?? 1}`;
      duplicate.accessibilityLabel = `Điểm đến cuối, điểm số ${duplicate.sequence ?? 1}, ${duplicate.address}`;
    } else if (!origin || !isSameRouteLocation(origin, route.destination)) {
      const displayNumber = calculateFinalDestinationNumber(visibleStops.length);
      const destination = toMapPoint(
        route.destination,
        'destination',
        `Điểm đến cuối — Điểm số ${displayNumber}`,
        displayNumber,
        undefined,
        undefined,
        undefined,
        route.destination.locationId || `${route.tripId}-final-destination`
      );
      if (destination) points.push(destination);
    }
  }

  return points;
}

function toMapPoint(
  point: TripRoutePointDto | null | undefined,
  type: RouteMapPoint['type'],
  label: string,
  sequence?: number,
  stopType?: string | null,
  orders?: TripRouteOrderDto[],
  lpns?: TripRouteLpnDto[],
  id?: string
): RouteMapPoint | null {
  if (!point || !isValidMapCoordinate(point.lat, point.lon)) return null;

  const ordersCount = orders?.length || 0;
  const lpnsCount = lpns?.length || 0;
  const orderItemsSummary = orders
    ?.map((o) => o.itemName)
    .filter(Boolean)
    .slice(0, 2)
    .join(', ');

  const address = point.address || 'Chưa có địa chỉ chi tiết';
  const accessibilityLabel =
    type === 'origin'
      ? `Điểm xuất phát, ${address}`
      : type === 'destination'
      ? `Điểm đến cuối, điểm số ${sequence ?? 1}, ${address}`
      : `Điểm giao số ${sequence ?? 1}, ${address}`;

  return {
    id: id || `${type}-${point.locationId ?? `${point.lat}-${point.lon}`}-${sequence ?? 0}`,
    locationId: point.locationId,
    label,
    address,
    lat: point.lat,
    lon: point.lon,
    type,
    sequence,
    stopType,
    ordersCount,
    lpnsCount,
    orderItemsSummary,
    orders,
    lpns,
    accessibilityLabel,
  };
}

function isSameRouteLocation(
  left: Pick<RouteMapPoint, 'lat' | 'lon' | 'locationId'>,
  right: TripRoutePointDto
) {
  const leftLocationId = left.locationId?.toLowerCase();
  const rightLocationId = right.locationId?.toLowerCase();
  if (leftLocationId && rightLocationId && leftLocationId === rightLocationId) return true;

  return Math.abs(left.lat - right.lat) < 0.000001 && Math.abs(left.lon - right.lon) < 0.000001;
}

function mergePointDetails(
  target: RouteMapPoint,
  orders: TripRouteOrderDto[] = [],
  lpns: TripRouteLpnDto[] = []
) {
  const mergedOrders = [...(target.orders || [])];
  for (const order of orders) {
    if (!mergedOrders.some((item) => item.orderId === order.orderId)) mergedOrders.push(order);
  }
  const mergedLpns = [...(target.lpns || [])];
  for (const lpn of lpns) {
    if (!mergedLpns.some((item) => item.lpnId === lpn.lpnId)) mergedLpns.push(lpn);
  }

  target.orders = mergedOrders;
  target.lpns = mergedLpns;
  target.ordersCount = mergedOrders.length;
  target.lpnsCount = mergedLpns.length;
  target.orderItemsSummary = mergedOrders
    .map((order) => order.itemName)
    .filter(Boolean)
    .slice(0, 2)
    .join(', ');
}
