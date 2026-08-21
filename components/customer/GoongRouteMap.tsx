import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';

import { colors } from '../../constants/colors';
import { TripRouteOrderDto, TripRoutePointDto, TripRouteResponse } from '../../services/trackingApi';

export type RouteMapPoint = {
  id: string;
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
};

type GoongRouteMapProps = {
  route: TripRouteResponse;
  height?: number;
  isFullScreen?: boolean;
  showRouteDataNotice?: boolean;
  vehiclePosition?: {
    latitude: number;
    longitude: number;
  } | null;
};

type MapBridgeMessage = {
  type: 'MAP_READY' | 'MAP_ERROR' | 'MAP_UNSUPPORTED' | 'RESOURCE_ERROR' | 'JS_ERROR' | 'UNHANDLED_REJECTION';
  message?: string;
  status?: number;
  domain?: string;
};

const GOONG_MAPTILES_KEY = process.env.EXPO_PUBLIC_GOONG_MAPTILES_KEY?.trim() || 'rCqT5IDaaeffKHi8nYFYA0vb8cZ51qPi1BTSFr8R';

export function GoongRouteMap({
  route,
  height = 280,
  isFullScreen = false,
  showRouteDataNotice = false,
  vehiclePosition,
}: GoongRouteMapProps) {
  const webViewRef = React.useRef<WebView>(null);
  const [mapFailure, setMapFailure] = useState<MapBridgeMessage | null>(null);
  const [isMapReady, setIsMapReady] = useState(false);
  const points = useMemo(() => buildRoutePoints(route), [route]);
  const routeCoordinates = useMemo(
    () => decodePolyline(route.overviewPolyline),
    [route.overviewPolyline]
  );

  const hasAnyLocation = points.length > 0 || Boolean(vehiclePosition && isValidMapCoordinate(vehiclePosition.latitude, vehiclePosition.longitude));

  const mapHtml = useMemo(() => {
    if (!GOONG_MAPTILES_KEY || !hasAnyLocation) return '';
    return buildMapHtml(GOONG_MAPTILES_KEY, points, routeCoordinates, vehiclePosition);
  }, [hasAnyLocation, points, routeCoordinates]);

  // Cập nhật vị trí xe trực tiếp mượt mà qua JS injection, KHÔNG reload/remount WebView để tránh giật/nhảy bản đồ
  useEffect(() => {
    if (isMapReady && vehiclePosition && webViewRef.current) {
      const lat = vehiclePosition.latitude;
      const lon = vehiclePosition.longitude;
      if (typeof lat === 'number' && typeof lon === 'number' && !isNaN(lat) && !isNaN(lon)) {
        webViewRef.current.injectJavaScript(
          `if (typeof window.updateVehicleMarker === 'function') { window.updateVehicleMarker(${lat}, ${lon}); } true;`
        );
      }
    }
  }, [vehiclePosition, isMapReady]);

  useEffect(() => {
    setMapFailure(null);
    setIsMapReady(false);
  }, [route.tripId, route.overviewPolyline]);

  if (!hasAnyLocation) {
    return <RouteMapFallback message="Đang cập nhật tọa độ tuyến đường..." points={points} vehiclePosition={vehiclePosition} />;
  }

  if (mapFailure) {
    return <RouteMapFallback message={getMapFailureMessage(mapFailure)} points={points} vehiclePosition={vehiclePosition} />;
  }

  return (
    <View
      style={isFullScreen ? { flex: 1, width: '100%', height: '100%' } : undefined}
      className={`overflow-hidden rounded-2xl border border-[#DAC2B6]/60 bg-[#F8F9FA] ${isFullScreen ? 'flex-1' : ''}`}
    >
      <WebView
        ref={webViewRef}
        key={`map-${isFullScreen ? 'full' : 'inline'}-${route.tripId}`}
        originWhitelist={['about:blank', 'https://*']}
        source={{ html: mapHtml }}
        javaScriptEnabled
        domStorageEnabled
        mixedContentMode="never"
        scrollEnabled={false}
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        onError={({ nativeEvent }) => setMapFailure({
          type: 'MAP_ERROR',
          message: sanitizeDiagnosticMessage(nativeEvent.description),
          domain: getHostname(nativeEvent.url),
        })}
        onHttpError={({ nativeEvent }) => setMapFailure({
          type: 'RESOURCE_ERROR',
          message: `HTTP ${nativeEvent.statusCode}`,
          status: nativeEvent.statusCode,
          domain: getHostname(nativeEvent.url),
        })}
        onMessage={({ nativeEvent }) => {
          const message = parseMapBridgeMessage(nativeEvent.data);
          if (!message) return;
          if (message.type === 'MAP_READY') {
            setIsMapReady(true);
            return;
          }
          if (!isMapReady) setMapFailure(message);
        }}
        startInLoadingState
        renderLoading={() => (
          <View style={{ backgroundColor: colors.surface.page }} className="absolute inset-0 items-center justify-center">
            <ActivityIndicator size="small" color={colors.brand.primary} />
            <Text style={{ color: colors.text.secondary }} className="mt-2 text-xs font-medium">Đang tải bản đồ...</Text>
          </View>
        )}
        style={
          isFullScreen
            ? { flex: 1, width: '100%', height: '100%', backgroundColor: colors.surface.page }
            : { height, backgroundColor: colors.surface.page }
        }
      />
      {showRouteDataNotice && !isFullScreen && routeCoordinates.length < 2 ? (
        <View style={{ borderTopColor: colors.border.default }} className="border-t bg-amber-50 px-4 py-3">
          <Text className="text-xs font-medium leading-5 text-amber-800">
            API chưa trả polyline; bản đồ hiện chỉ hiển thị các điểm tuyến dự kiến.
          </Text>
        </View>
      ) : null}
    </View>
  );
}

export function buildRoutePoints(route?: TripRouteResponse | null): RouteMapPoint[] {
  if (!route) return [];

  const points: RouteMapPoint[] = [];
  const origin = toMapPoint(route.origin, 'origin', 'Điểm xuất phát');
  if (origin) points.push(origin);

  // Sắp xếp các điểm dừng trung gian theo optimizedSequence
  const sortedStops = (route.optimizedStops || [])
    .slice()
    .sort((left, right) => (left.optimizedSequence ?? 0) - (right.optimizedSequence ?? 0));

  const validStops: RouteMapPoint[] = [];
  sortedStops.forEach((stop, index) => {
    const sequence = stop.optimizedSequence ?? index + 1;
    const point = toMapPoint(
      stop,
      'stop',
      `Điểm giao hàng #${sequence}`,
      sequence,
      stop.stopType,
      stop.orders,
      stop.lpns
    );
    if (point) {
      const isDuplicateOrigin =
        origin &&
        Math.abs(point.lat - origin.lat) < 0.0001 &&
        Math.abs(point.lon - origin.lon) < 0.0001;
      if (!isDuplicateOrigin) {
        validStops.push(point);
      }
    }
  });

  validStops.forEach((p) => points.push(p));

  // Điểm đến cuối cùng (destination)
  if (route.destination) {
    const finalDestSeq = validStops.length + 1;
    const isSingleDest = validStops.length === 0;
    const destination = toMapPoint(
      route.destination,
      'destination',
      isSingleDest ? 'Điểm giao hàng #1' : `Điểm đến cuối (#${finalDestSeq})`,
      finalDestSeq
    );
    if (destination) {
      const isDuplicateOrigin =
        origin &&
        Math.abs(destination.lat - origin.lat) < 0.0001 &&
        Math.abs(destination.lon - origin.lon) < 0.0001;
      const isDuplicateAnyStop = validStops.some(
        (s) =>
          Math.abs(destination.lat - s.lat) < 0.0001 &&
          Math.abs(destination.lon - s.lon) < 0.0001
      );
      if (!isDuplicateOrigin && !isDuplicateAnyStop) {
        points.push(destination);
      }
    }
  }

  return disperseOverlappingPoints(points);
}

/**
 * Thuật toán tách các điểm dừng có tọa độ trùng hoặc quá gần nhau (Spiderfy Dispersion)
 * để các icon không bị đè/chồng lấn lên nhau trên bản đồ.
 */
function disperseOverlappingPoints(points: RouteMapPoint[]): RouteMapPoint[] {
  if (points.length <= 1) return points;

  const CLUSTER_THRESHOLD = 0.00015; // Khoảng ~15m (tọa độ gần như trùng nhau)
  const DISPERSION_RADIUS = 0.0002;  // Bán kính xòe nhẹ ~20m

  const clusters: RouteMapPoint[][] = [];
  const visited = new Set<string>();

  for (let i = 0; i < points.length; i++) {
    const p1 = points[i];
    if (visited.has(p1.id)) continue;

    const currentCluster: RouteMapPoint[] = [p1];
    visited.add(p1.id);

    for (let j = i + 1; j < points.length; j++) {
      const p2 = points[j];
      if (visited.has(p2.id)) continue;

      const dLat = Math.abs(p1.lat - p2.lat);
      const dLon = Math.abs(p1.lon - p2.lon);
      if (dLat < CLUSTER_THRESHOLD && dLon < CLUSTER_THRESHOLD) {
        currentCluster.push(p2);
        visited.add(p2.id);
      }
    }
    clusters.push(currentCluster);
  }

  const result: RouteMapPoint[] = [];
  for (const cluster of clusters) {
    if (cluster.length === 1) {
      result.push(cluster[0]);
    } else {
      const count = cluster.length;
      const primary = cluster[0];

      // Điểm đầu tiên luôn giữ nguyên tọa độ gốc
      result.push(primary);

      // Các điểm trùng tiếp theo sẽ được xòe nhẹ xung quanh
      for (let idx = 1; idx < count; idx++) {
        const point = cluster[idx];
        const angle = (2 * Math.PI * (idx - 1)) / (count - 1) - Math.PI / 2;
        result.push({
          ...point,
          lat: primary.lat + DISPERSION_RADIUS * Math.sin(angle),
          lon: primary.lon + DISPERSION_RADIUS * Math.cos(angle),
        });
      }
    }
  }

  return result;
}

function RouteMapFallback({
  message,
  points,
  vehiclePosition,
}: {
  message: string;
  points: RouteMapPoint[];
  vehiclePosition?: { latitude: number; longitude: number } | null;
}) {
  const targetPoint = points[points.length - 1] || points[0];
  const targetLat = targetPoint?.lat || vehiclePosition?.latitude;
  const targetLon = targetPoint?.lon || vehiclePosition?.longitude;

  const openGoogleMaps = () => {
    if (!targetLat || !targetLon) return;
    const dest = `${targetLat},${targetLon}`;
    void Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${dest}`);
  };

  const openAppleMaps = () => {
    if (!targetLat || !targetLon) return;
    const dest = `${targetLat},${targetLon}`;
    void Linking.openURL(`maps://?daddr=${dest}&dirflg=d`);
  };

  return (
    <View style={{ backgroundColor: colors.surface.page, borderColor: colors.border.default }} className="gap-3 rounded-2xl border p-4">
      <Text style={{ color: colors.brand.primary }} className="text-sm font-semibold">{message}</Text>
      {points.length > 0 ? (
        <View className="gap-2">
          {points.map((point) => (
            <View key={point.id} className="flex-row items-start gap-3">
              <View
                style={{
                  backgroundColor: point.type === 'origin' ? '#10B981' : point.type === 'destination' ? '#DC2626' : colors.brand.primary,
                }}
                className="mt-0.5 h-6 w-6 items-center justify-center rounded-full shadow-xs"
              >
                <Text style={{ color: colors.text.onPrimary }} className="text-[10px] font-bold">
                  {point.type === 'origin' ? '🏢' : point.sequence}
                </Text>
              </View>
              <View className="flex-1">
                <Text style={{ color: colors.text.primary }} className="text-xs font-bold">{point.label}</Text>
                <Text style={{ color: colors.text.secondary }} className="mt-0.5 text-xs leading-5">
                  {point.address || `${point.lat}, ${point.lon}`}
                </Text>
                {point.ordersCount ? (
                  <Text style={{ color: colors.brand.primary }} className="text-[11px] font-semibold mt-0.5">
                    📦 {point.ordersCount} đơn hàng {point.lpnsCount ? `· ${point.lpnsCount} LPN` : ''}
                  </Text>
                ) : null}
              </View>
            </View>
          ))}
        </View>
      ) : null}

      {targetLat && targetLon ? (
        <View className="mt-2 flex-row items-center gap-2">
          <Pressable
            onPress={openGoogleMaps}
            style={{ backgroundColor: '#EEF2FF', borderColor: '#C7D2FE' }}
            className="flex-1 flex-row items-center justify-center gap-1.5 rounded-xl border py-2.5"
          >
            <Ionicons name="navigate-outline" size={14} color="#4338CA" />
            <Text className="text-xs font-bold text-[#4338CA]">Google Maps</Text>
          </Pressable>
          <Pressable
            onPress={openAppleMaps}
            style={{ backgroundColor: '#F1F5F9', borderColor: '#CBD5E1' }}
            className="flex-1 flex-row items-center justify-center gap-1.5 rounded-xl border py-2.5"
          >
            <Ionicons name="compass-outline" size={14} color="#334155" />
            <Text className="text-xs font-bold text-[#334155]">Apple Maps</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

function toMapPoint(
  point: TripRoutePointDto | null | undefined,
  type: RouteMapPoint['type'],
  label: string,
  sequence?: number,
  stopType?: string | null,
  orders?: TripRouteOrderDto[],
  lpns?: unknown[]
): RouteMapPoint | null {
  if (!point || !isValidMapCoordinate(point.lat, point.lon)) return null;

  const ordersCount = orders?.length || 0;
  const lpnsCount = lpns?.length || 0;
  const orderItemsSummary = orders?.map((o) => o.itemName).filter(Boolean).slice(0, 2).join(', ');

  return {
    id: `${type}-${point.locationId ?? `${point.lat}-${point.lon}`}-${sequence ?? 0}`,
    label,
    address: point.address || 'Chưa có địa chỉ chi tiết',
    lat: point.lat,
    lon: point.lon,
    type,
    sequence,
    stopType,
    ordersCount,
    lpnsCount,
    orderItemsSummary,
  };
}

function decodePolyline(encoded?: string | null): [number, number][] {
  if (!encoded) return [];

  let index = 0;
  let lat = 0;
  let lon = 0;
  const coordinates: [number, number][] = [];

  while (index < encoded.length) {
    const latResult = decodePolylineValue(encoded, index);
    if (!latResult) return [];
    index = latResult.nextIndex;
    lat += latResult.delta;

    const lonResult = decodePolylineValue(encoded, index);
    if (!lonResult) return [];
    index = lonResult.nextIndex;
    lon += lonResult.delta;

    const decodedLatitude = lat / 1e5;
    const decodedLongitude = lon / 1e5;
    if (!isValidMapCoordinate(decodedLatitude, decodedLongitude)) return [];
    coordinates.push([decodedLongitude, decodedLatitude]);
  }

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

function buildMapHtml(
  mapKey: string,
  points: RouteMapPoint[],
  routeCoordinates: [number, number][],
  vehiclePosition: GoongRouteMapProps['vehiclePosition']
) {
  const payload = escapeJsonForHtml(JSON.stringify({ points, routeCoordinates, vehiclePosition }));
  const safeMapKey = escapeJsonForHtml(JSON.stringify(mapKey));

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="initial-scale=1,maximum-scale=1,user-scalable=no" />
  <link href="https://cdn.jsdelivr.net/npm/@goongmaps/goong-js@1.0.9/dist/goong-js.css" rel="stylesheet" />
  <script src="https://cdn.jsdelivr.net/npm/@goongmaps/goong-js@1.0.9/dist/goong-js.js"></script>
  <style>
    html, body, #map { height: 100%; margin: 0; padding: 0; background: #eef2f5; }
    
    /* ─── CUSTOM PIN MARKER STYLES ─── */
    .custom-pin {
      width: 24px;
      height: 32px;
      display: block;
      cursor: pointer;
      user-select: none;
      filter: drop-shadow(0 4px 8px rgba(15, 23, 42, 0.35));
      transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
      z-index: 10;
    }
    .custom-pin:hover, .custom-pin:active {
      transform: scale(1.25);
      z-index: 999 !important;
    }
    .pin-svg {
      display: block;
      width: 24px;
      height: 32px;
      pointer-events: none;
    }

    /* ─── VEHICLE MOVING MARKER ─── */
    .vehicle-marker {
      width: 34px;
      height: 34px;
      border-radius: 999px;
      background: linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%);
      border: 2.5px solid #FFFFFF;
      box-shadow: 0 4px 14px rgba(29, 78, 216, 0.6);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 17px;
      cursor: pointer;
      user-select: none;
      box-sizing: border-box;
      z-index: 100;
      transition: transform 0.2s ease;
    }
    .vehicle-marker:hover, .vehicle-marker:active {
      transform: scale(1.22);
      z-index: 1000 !important;
    }

    /* ─── POPUP DIALOG STYLING ─── */
    .goongjs-popup {
      z-index: 100;
    }
    .goongjs-popup-content {
      padding: 0 !important;
      border-radius: 18px !important;
      box-shadow: 0 16px 36px rgba(15, 23, 42, 0.28) !important;
      border: 1px solid rgba(226, 232, 240, 0.9) !important;
      overflow: hidden;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
    }
    .goongjs-popup-close-button {
      padding: 6px 10px !important;
      color: #64748B !important;
      font-size: 16px !important;
    }
    .custom-popup-card {
      padding: 14px 16px;
      min-width: 210px;
      max-width: 270px;
      background: #FFFFFF;
    }
    .popup-badge-row {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-bottom: 6px;
    }
    .popup-badge {
      font-size: 10px;
      font-weight: 800;
      padding: 2.5px 8px;
      border-radius: 6px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      display: inline-block;
    }
    .popup-badge.origin {
      background: #DCFCE7;
      color: #15803D;
    }
    .popup-badge.stop {
      background: #FFE4E6;
      color: #BE123C;
    }
    .popup-badge.destination {
      background: #FEE2E2;
      color: #B91C1C;
    }
    .popup-title {
      font-size: 13px;
      font-weight: 800;
      color: #0F172A;
      margin-bottom: 4px;
      line-height: 1.35;
    }
    .popup-address {
      font-size: 11.5px;
      color: #475569;
      line-height: 1.45;
      margin-bottom: 6px;
    }
    .popup-orders {
      font-size: 11px;
      font-weight: 700;
      color: #2563EB;
      background: #EFF6FF;
      padding: 4px 8px;
      border-radius: 6px;
      margin-top: 4px;
      display: inline-block;
    }
    .popup-items {
      font-size: 10.5px;
      color: #64748B;
      margin-top: 4px;
      font-style: italic;
      line-height: 1.3;
    }

    #map-error {
      display: none;
      position: absolute;
      inset: 0;
      align-items: center;
      justify-content: center;
      padding: 24px;
      text-align: center;
      background: #f8f9fa;
      color: #8b4513;
      font: 700 14px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <div id="map-error">Không thể tải bản đồ Goong.</div>
  <script>
    const mapTilesKey = ${safeMapKey};
    const payload = ${payload};

    function getDomain(value) {
      if (!value) return undefined;
      try {
        return new URL(String(value), window.location.href).hostname || undefined;
      } catch (_) {
        return undefined;
      }
    }

    function sanitizeMessage(value) {
      return String(value || 'Unknown map error')
        .replace(/https?:\\/\\/([^/\\s]+)[^\\s]*/gi, '$1')
        .replace(/([?&](?:access_token|api_key|key)=)[^&\\s]+/gi, '$1[REDACTED]')
        .slice(0, 240);
    }

    function postBridge(message) {
      if (!window.ReactNativeWebView) return;
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: message.type,
        message: message.message ? sanitizeMessage(message.message) : undefined,
        status: Number.isFinite(message.status) ? message.status : undefined,
        domain: message.domain ? String(message.domain).slice(0, 120) : undefined,
        line: Number.isFinite(message.line) ? message.line : undefined,
        column: Number.isFinite(message.column) ? message.column : undefined
      }));
    }

    function showMapError(details) {
      const error = document.getElementById('map-error');
      if (error) error.style.display = 'flex';
      postBridge(details);
    }

    window.onerror = function (message, source, line, column) {
      showMapError({
        type: 'JS_ERROR',
        message: message,
        domain: getDomain(source),
        line: line,
        column: column
      });
      return false;
    };

    window.addEventListener('unhandledrejection', function (event) {
      showMapError({
        type: 'UNHANDLED_REJECTION',
        message: event.reason && event.reason.message ? event.reason.message : event.reason
      });
    });

    window.addEventListener('error', function (event) {
      if (!event.target || event.target === window) return;
      showMapError({
        type: 'RESOURCE_ERROR',
        message: 'Failed to load ' + String(event.target.tagName || 'map resource'),
        domain: getDomain(event.target.src || event.target.href)
      });
    }, true);

    function escapeHtml(value) {
      return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    }

    try {
      const hasPoints = payload.points && payload.points.length > 0;
      const hasVehicle = payload.vehiclePosition && payload.vehiclePosition.latitude && payload.vehiclePosition.longitude;

      if (!window.goongjs || (!hasPoints && !hasVehicle)) {
        showMapError({
          type: 'RESOURCE_ERROR',
          message: !window.goongjs ? 'Goong JavaScript library is unavailable' : 'No valid route coordinates',
          domain: !window.goongjs ? 'cdn.jsdelivr.net' : undefined
        });
      } else if (typeof goongjs.supported === 'function' && !goongjs.supported()) {
        showMapError({ type: 'MAP_UNSUPPORTED', message: 'WebGL is unavailable in this WebView' });
      } else {
        goongjs.accessToken = mapTilesKey;
        const defaultCenter = hasPoints
          ? [payload.points[0].lon, payload.points[0].lat]
          : (hasVehicle ? [payload.vehiclePosition.longitude, payload.vehiclePosition.latitude] : [106.6297, 10.8231]);

        const map = new goongjs.Map({
          container: 'map',
          style: 'https://tiles.goong.io/assets/goong_map_web.json?api_key=' + mapTilesKey,
          accessToken: mapTilesKey,
          center: defaultCenter,
          zoom: (payload.points.length > 1 || (hasPoints && hasVehicle)) ? 8 : 13,
          attributionControl: false
        });

        map.addControl(new goongjs.NavigationControl({ showCompass: false }), 'top-right');

        map.on('load', function () {
          const bounds = new goongjs.LngLatBounds();

          payload.points.forEach(function (point, index) {
            const isOrigin = point.type === 'origin';
            const isFinal = point.type === 'destination';
            const seqNumber = point.sequence || (index + 1);

            const markerEl = document.createElement('div');
            markerEl.className = 'custom-pin ' + point.type;

            const pinColorTop = isFinal ? '#EF4444' : isOrigin ? '#10B981' : '#F43F5E';
            const pinColorBottom = isFinal ? '#B91C1C' : isOrigin ? '#047857' : '#BE123C';
            const textFill = isFinal ? '#B91C1C' : isOrigin ? '#047857' : '#BE123C';
            const labelText = isOrigin ? 'A' : String(seqNumber);
            const fontSize = isOrigin ? '9' : (labelText.length > 1 ? '8.5' : '10.5');

            markerEl.innerHTML = 
              '<svg class="pin-svg" width="24" height="32" viewBox="0 0 24 32" fill="none" xmlns="http://www.w3.org/2000/svg">' +
                '<defs>' +
                  '<linearGradient id="grad-' + point.id + '" x1="0" y1="0" x2="0" y2="32" gradientUnits="userSpaceOnUse">' +
                    '<stop offset="0%" stop-color="' + pinColorTop + '" />' +
                    '<stop offset="100%" stop-color="' + pinColorBottom + '" />' +
                  '</linearGradient>' +
                '</defs>' +
                '<path d="M12 0C5.37258 0 0 5.37258 0 12C0 21 12 32 12 32C12 32 24 21 24 12C24 5.37258 18.6274 0 12 0Z" fill="url(#grad-' + point.id + ')" stroke="#FFFFFF" stroke-width="2" />' +
                '<circle cx="12" cy="11.5" r="7" fill="#FFFFFF" />' +
                '<text x="12" y="11.5" text-anchor="middle" dominant-baseline="central" font-size="' + fontSize + '" font-weight="900" fill="' + textFill + '" font-family="system-ui, -apple-system, sans-serif">' + labelText + '</text>' +
              '</svg>';

            let popupHtml = '<div class="custom-popup-card">';
            popupHtml += '<div class="popup-badge-row">';
            if (isOrigin) {
              popupHtml += '<span class="popup-badge origin">🏢 Xuất phát</span>';
            } else if (isFinal) {
              popupHtml += '<span class="popup-badge destination">🏁 Điểm đến #' + seqNumber + '</span>';
            } else {
              popupHtml += '<span class="popup-badge stop">📍 Điểm giao #' + seqNumber + '</span>';
            }
            if (point.stopType) {
              popupHtml += '<span class="popup-badge" style="background:#F1F5F9; color:#475569;">' + escapeHtml(point.stopType) + '</span>';
            }
            popupHtml += '</div>';

            popupHtml += '<div class="popup-title">' + escapeHtml(point.label) + '</div>';
            popupHtml += '<div class="popup-address">' + escapeHtml(point.address || point.lat + ', ' + point.lon) + '</div>';
            
            if (point.ordersCount) {
              popupHtml += '<div class="popup-orders">📦 ' + point.ordersCount + ' Đơn hàng' + (point.lpnsCount ? ' · ' + point.lpnsCount + ' LPN' : '') + '</div>';
            }
            if (point.orderItemsSummary) {
              popupHtml += '<div class="popup-items">' + escapeHtml(point.orderItemsSummary) + '</div>';
            }
            popupHtml += '</div>';

            new goongjs.Marker(markerEl, { anchor: 'bottom' })
              .setLngLat([point.lon, point.lat])
              .setPopup(new goongjs.Popup({ offset: [0, -32], closeButton: true, maxWidth: '280px' }).setHTML(popupHtml))
              .addTo(map);

            bounds.extend([point.lon, point.lat]);
          });

          function snapToRoute(lon, lat, coords) {
            if (!coords || coords.length < 2) return [lon, lat];
            var minDistanceSq = Infinity;
            var bestPoint = [lon, lat];

            for (var i = 0; i < coords.length - 1; i++) {
              var p1 = coords[i];
              var p2 = coords[i + 1];

              var x = lon;
              var y = lat;
              var x1 = p1[0];
              var y1 = p1[1];
              var x2 = p2[0];
              var y2 = p2[1];

              var dx = x2 - x1;
              var dy = y2 - y1;
              var lenSq = dx * dx + dy * dy;

              if (lenSq === 0) continue;

              var t = Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / lenSq));
              var projX = x1 + t * dx;
              var projY = y1 + t * dy;

              var distSq = (x - projX) * (x - projX) + (y - projY) * (y - projY);
              if (distSq < minDistanceSq) {
                minDistanceSq = distSq;
                bestPoint = [projX, projY];
              }
            }

            return bestPoint;
          }

          let vehicleMarker = null;
          window.updateVehicleMarker = function(lat, lon) {
            const rawLat = parseFloat(lat);
            const rawLon = parseFloat(lon);
            if (isNaN(rawLat) || isNaN(rawLon) || rawLat < -90 || rawLat > 90 || rawLon < -180 || rawLon > 180) return;

            const snapped = snapToRoute(rawLon, rawLat, payload.routeCoordinates);
            const finalLon = snapped[0];
            const finalLat = snapped[1];

            if (vehicleMarker) {
              vehicleMarker.setLngLat([finalLon, finalLat]);
            } else if (map) {
              const vehicleEl = document.createElement('div');
              vehicleEl.className = 'vehicle-marker';
              vehicleEl.textContent = '🚚';

              vehicleMarker = new goongjs.Marker(vehicleEl, { anchor: 'center' })
                .setLngLat([finalLon, finalLat])
                .setPopup(new goongjs.Popup({ offset: [0, -18], closeButton: true, maxWidth: '260px' }).setHTML(
                  '<div class="custom-popup-card">' +
                    '<div class="popup-badge-row"><span class="popup-badge" style="background:#DBEAFE; color:#1D4ED8;">🚚 Đang vận chuyển</span></div>' +
                    '<div class="popup-title">Vị trí xe hiện tại</div>' +
                    '<div class="popup-address">Tọa độ: ' + finalLat.toFixed(5) + ', ' + finalLon.toFixed(5) + '</div>' +
                  '</div>'
                ))
                .addTo(map);
            }
          };

          const vPos = payload.vehiclePosition;
          if (vPos) {
            const vLat = typeof vPos.latitude === 'number' ? vPos.latitude : parseFloat(vPos.latitude || vPos.lat);
            const vLon = typeof vPos.longitude === 'number' ? vPos.longitude : parseFloat(vPos.longitude || vPos.lon || vPos.lng);
            if (!isNaN(vLat) && !isNaN(vLon) && vLat >= -90 && vLat <= 90 && vLon >= -180 && vLon <= 180) {
              window.updateVehicleMarker(vLat, vLon);
              const initialSnapped = snapToRoute(vLon, vLat, payload.routeCoordinates);
              bounds.extend([initialSnapped[0], initialSnapped[1]]);
            }
          }

          if (payload.routeCoordinates.length > 1) {
            map.addSource('planned-route', {
              type: 'geojson',
              data: {
                type: 'Feature',
                properties: {},
                geometry: {
                  type: 'LineString',
                  coordinates: payload.routeCoordinates
                }
              }
            });

            // Outer casing for polyline
            map.addLayer({
              id: 'planned-route-casing',
              type: 'line',
              source: 'planned-route',
              layout: {
                'line-join': 'round',
                'line-cap': 'round'
              },
              paint: {
                'line-color': '#1E3A8A',
                'line-width': 7.5,
                'line-opacity': 0.7
              }
            });

            // Inner vibrant polyline
            map.addLayer({
              id: 'planned-route-line',
              type: 'line',
              source: 'planned-route',
              layout: {
                'line-join': 'round',
                'line-cap': 'round'
              },
              paint: {
                'line-color': '#2563EB',
                'line-width': 5,
                'line-opacity': 0.95
              }
            });
          }

          if (payload.points.length > 1 || payload.vehiclePosition) {
            map.fitBounds(bounds, { padding: 48, maxZoom: 14, duration: 0 });
          }

          postBridge({ type: 'MAP_READY' });
        });

        map.on('error', function (event) {
          const mapError = event && event.error ? event.error : {};
          showMapError({
            type: 'MAP_ERROR',
            message: mapError.message || 'Goong map resource failed',
            status: Number(mapError.status || event.status),
            domain: getDomain(mapError.url || event.url) || 'tiles.goong.io'
          });
        });
      }
    } catch (error) {
      showMapError({
        type: 'JS_ERROR',
        message: error && error.message ? error.message : error
      });
    }
  </script>
</body>
</html>`;
}

function escapeJsonForHtml(value: string) {
  return value
    .replace(/&/g, '\\u0026')
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

function sanitizeDiagnosticMessage(value?: string | null): string {
  if (!value) return 'Unknown diagnostic message';
  return value
    .replace(/https?:\/\/[^\s]+/gi, '[URL]')
    .replace(/[a-zA-Z0-9_\-]{20,}/g, '[REDACTED]')
    .slice(0, 200);
}

function getHostname(url?: string | null): string | undefined {
  if (!url) return undefined;
  try {
    return new URL(url).hostname;
  } catch {
    return undefined;
  }
}

function parseMapBridgeMessage(raw: unknown): MapBridgeMessage | null {
  if (typeof raw !== 'string') return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || typeof parsed.type !== 'string') return null;
    return parsed as MapBridgeMessage;
  } catch {
    return null;
  }
}

function getMapFailureMessage(failure: MapBridgeMessage): string {
  if (failure.type === 'MAP_UNSUPPORTED') {
    return 'Thiết bị chưa hỗ trợ WebGL để dựng bản đồ Goong.';
  }
  if (failure.type === 'RESOURCE_ERROR' && failure.domain?.includes('jsdelivr')) {
    return 'Không tải được thư viện Goong JS từ CDN.';
  }
  if (failure.domain?.includes('goong.io') || failure.status === 401 || failure.status === 403) {
    return 'Không xác thực được Goong Map key.';
  }
  return 'Chưa thể hiển thị bản đồ trực quan lúc này.';
}

function isValidMapCoordinate(lat?: number | null, lon?: number | null): lat is number {
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
