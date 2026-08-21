import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';

import { colors } from '../../constants/colors';
import type { TripRouteResponse } from '../../services/trackingApi';
import {
  buildRoutePoints,
  decodePolyline,
  formatTripDistance,
  formatTripDuration,
  isValidMapCoordinate,
  RouteMapPoint,
} from '../../services/routeUtils';

export type { RouteMapPoint };

type GoongRouteMapProps = {
  route: TripRouteResponse;
  height?: number;
  isFullScreen?: boolean;
  showRouteDataNotice?: boolean;
  showSummaryBar?: boolean;
  vehiclePosition?: {
    latitude: number;
    longitude: number;
  } | null;
};

type MapBridgeMessage = {
  type:
    | 'MAP_READY'
    | 'MAP_ERROR'
    | 'MAP_UNSUPPORTED'
    | 'RESOURCE_ERROR'
    | 'JS_ERROR'
    | 'UNHANDLED_REJECTION'
    | 'MARKER_SELECTED';
  message?: string;
  status?: number;
  domain?: string;
  pointId?: string;
};

const GOONG_MAPTILES_KEY = process.env.EXPO_PUBLIC_GOONG_MAPTILES_KEY?.trim();

export function GoongRouteMap({
  route,
  height = 280,
  isFullScreen = false,
  showRouteDataNotice = false,
  showSummaryBar = true,
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

  const hasAnyLocation =
    points.length > 0 ||
    Boolean(
      vehiclePosition &&
        isValidMapCoordinate(vehiclePosition.latitude, vehiclePosition.longitude)
    );

  const mapHtml = useMemo(() => {
    if (!GOONG_MAPTILES_KEY || !hasAnyLocation) return '';
    return buildMapHtml(GOONG_MAPTILES_KEY, points, routeCoordinates, vehiclePosition);
  }, [hasAnyLocation, points, routeCoordinates, vehiclePosition]);

  // Update vehicle marker smoothly via JS injection
  useEffect(() => {
    if (isMapReady && vehiclePosition && webViewRef.current) {
      const lat = vehiclePosition.latitude;
      const lon = vehiclePosition.longitude;
      if (
        typeof lat === 'number' &&
        typeof lon === 'number' &&
        !isNaN(lat) &&
        !isNaN(lon)
      ) {
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

  const fitAllBounds = useCallback(() => {
    if (isMapReady && webViewRef.current) {
      webViewRef.current.injectJavaScript(
        `if (typeof window.fitAllBounds === 'function') { window.fitAllBounds(); } true;`
      );
    }
  }, [isMapReady]);

  const destinationCount = useMemo(() => {
    return points.filter((point) => point.type !== 'origin').length;
  }, [points]);

  const summaryText = useMemo(() => {
    const parts: string[] = [];
    parts.push(`${destinationCount} điểm đến`);
    if (route.totalDistanceMeters > 0) {
      parts.push(formatTripDistance(route.totalDistanceMeters));
    }
    if (route.totalDurationSeconds > 0) {
      parts.push(formatTripDuration(route.totalDurationSeconds));
    }
    return parts.join(' • ');
  }, [destinationCount, route.totalDistanceMeters, route.totalDurationSeconds]);

  if (!hasAnyLocation) {
    return (
      <RouteMapFallback
        message="Đang cập nhật tọa độ tuyến đường..."
        points={points}
        vehiclePosition={vehiclePosition}
      />
    );
  }

  if (!GOONG_MAPTILES_KEY) {
    return (
      <RouteMapFallback
        message="Thiếu cấu hình EXPO_PUBLIC_GOONG_MAPTILES_KEY để hiển thị bản đồ Goong."
        points={points}
        vehiclePosition={vehiclePosition}
      />
    );
  }

  if (mapFailure) {
    return (
      <RouteMapFallback
        message={getMapFailureMessage(mapFailure)}
        points={points}
        vehiclePosition={vehiclePosition}
      />
    );
  }

  return (
    <View
      style={isFullScreen ? { flex: 1, width: '100%', height: '100%' } : undefined}
      className={
        isFullScreen
          ? 'flex-1 bg-[#F8F9FA]'
          : 'overflow-hidden rounded-2xl border border-[#DAC2B6]/60 bg-[#F8F9FA]'
      }
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
        nestedScrollEnabled
        bounces={false}
        overScrollMode="never"
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        allowsInlineMediaPlayback
        onError={({ nativeEvent }) =>
          setMapFailure({
            type: 'MAP_ERROR',
            message: sanitizeDiagnosticMessage(nativeEvent.description),
            domain: getHostname(nativeEvent.url),
          })
        }
        onHttpError={({ nativeEvent }) =>
          setMapFailure({
            type: 'RESOURCE_ERROR',
            message: `HTTP ${nativeEvent.statusCode}`,
            status: nativeEvent.statusCode,
            domain: getHostname(nativeEvent.url),
          })
        }
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
          <View
            style={{ backgroundColor: colors.surface.page }}
            className="absolute inset-0 items-center justify-center"
          >
            <ActivityIndicator size="small" color={colors.brand.primary} />
            <Text
              style={{ color: colors.text.secondary }}
              className="mt-2 text-xs font-medium"
            >
              Đang tải bản đồ...
            </Text>
          </View>
        )}
        style={
          isFullScreen
            ? { flex: 1, width: '100%', height: '100%', backgroundColor: colors.surface.page }
            : { height, backgroundColor: colors.surface.page }
        }
      />

      {/* Floating Route Summary Overlay & Fit Bounds Action */}
      {showSummaryBar && isMapReady && points.length > 0 && (
        <View className="absolute top-3 left-3 right-3 flex-row items-center justify-between gap-2">
          <View className="flex-1 flex-row items-center rounded-xl border border-slate-200/80 bg-white/95 px-3 py-2 shadow-xs backdrop-blur-sm">
            <Ionicons name="navigate-circle" size={16} color="#2563EB" />
            <Text
              numberOfLines={1}
              className="ml-1.5 text-xs font-bold text-slate-800"
            >
              {summaryText}
            </Text>
          </View>
          <Pressable
            onPress={fitAllBounds}
            accessibilityRole="button"
            accessibilityLabel="Xem toàn bộ tuyến đường và căn chỉnh bản đồ"
            accessibilityHint="Nhấn để phóng to/thu nhỏ toàn bộ các điểm trên tuyến đường"
            className="flex-row items-center gap-1 rounded-xl border border-blue-200 bg-blue-50/95 px-2.5 py-2 shadow-xs active:bg-blue-100"
          >
            <Ionicons name="scan-outline" size={14} color="#1D4ED8" />
            <Text className="text-[11px] font-bold text-blue-700">Xem toàn tuyến</Text>
          </Pressable>
        </View>
      )}

      {showRouteDataNotice && !isFullScreen && routeCoordinates.length < 2 ? (
        <View
          style={{ borderTopColor: colors.border.default }}
          className="border-t bg-amber-50 px-4 py-2.5"
        >
          <Text className="text-xs font-medium leading-5 text-amber-800">
            Không tải được chi tiết tuyến đường (hiển thị nối tuyến dự kiến).
          </Text>
        </View>
      ) : null}
    </View>
  );
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
    <View
      style={{ backgroundColor: colors.surface.page, borderColor: colors.border.default }}
      className="gap-3 rounded-2xl border p-4"
    >
      <Text style={{ color: colors.brand.primary }} className="text-sm font-semibold">
        {message}
      </Text>
      {points.length > 0 ? (
        <View className="gap-2">
          {points.map((point) => (
            <View key={point.id} className="flex-row items-start gap-3">
              <View
                style={{
                  backgroundColor:
                    point.type === 'origin'
                      ? '#10B981'
                      : point.type === 'destination'
                      ? '#DC2626'
                      : colors.brand.primary,
                }}
                className="mt-0.5 h-6 w-6 items-center justify-center rounded-full shadow-xs"
              >
                <Text style={{ color: colors.text.onPrimary }} className="text-[10px] font-bold">
                  {point.type === 'origin'
                    ? '🏢'
                    : point.type === 'destination'
                    ? '🏁'
                    : point.sequence}
                </Text>
              </View>
              <View className="flex-1">
                <Text style={{ color: colors.text.primary }} className="text-xs font-bold">
                  {point.label}
                </Text>
                <Text style={{ color: colors.text.secondary }} className="mt-0.5 text-xs leading-5">
                  {point.address || `${point.lat}, ${point.lon}`}
                </Text>
                {point.ordersCount ? (
                  <Text
                    style={{ color: colors.brand.primary }}
                    className="text-[11px] font-semibold mt-0.5"
                  >
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
            accessibilityRole="button"
            accessibilityLabel="Mở tuyến đường trên Google Maps"
            style={{ backgroundColor: '#EEF2FF', borderColor: '#C7D2FE' }}
            className="flex-1 flex-row items-center justify-center gap-1.5 rounded-xl border py-2.5"
          >
            <Ionicons name="navigate-outline" size={14} color="#4338CA" />
            <Text className="text-xs font-bold text-[#4338CA]">Google Maps</Text>
          </Pressable>
          <Pressable
            onPress={openAppleMaps}
            accessibilityRole="button"
            accessibilityLabel="Mở tuyến đường trên Apple Maps"
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
  <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover" />
  <link href="https://cdn.jsdelivr.net/npm/@goongmaps/goong-js@1.0.9/dist/goong-js.css" rel="stylesheet" />
  <script src="https://cdn.jsdelivr.net/npm/@goongmaps/goong-js@1.0.9/dist/goong-js.js"></script>
  <style>
    html, body { position: fixed; inset: 0; margin: 0; padding: 0; background: #eef2f5; overflow: hidden; touch-action: none; -webkit-overflow-scrolling: auto; }
    #map { position: absolute; top: 0; left: 0; right: 0; bottom: 0; }
    .goongjs-canvas-container, .goongjs-canvas { touch-action: none; }
    
    /* ─── CUSTOM PIN MARKER STYLES ─── */
    .custom-pin {
      display: flex;
      flex-direction: column;
      align-items: center;
      cursor: pointer;
      user-select: none;
      z-index: 10;
      transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
    }
    .custom-pin:hover, .custom-pin:active, .custom-pin.active {
      z-index: 999 !important;
      transform: scale(1.15) translateY(-3px);
    }
    .custom-pin.active .pin-svg {
      filter: drop-shadow(0 0 8px rgba(37, 99, 235, 0.9));
    }
    .pin-svg {
      display: block;
      width: 30px;
      height: 38px;
      pointer-events: none;
    }
    .pin-label-pill {
      background: ${colors.text.primary};
      color: ${colors.text.onPrimary};
      font-size: 9.5px;
      font-weight: 800;
      padding: 1.5px 6px;
      border-radius: 999px;
      white-space: nowrap;
      margin-top: 1.5px;
      border: 1.5px solid ${colors.surface.card};
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.35);
      letter-spacing: 0.2px;
      text-transform: uppercase;
      pointer-events: none;
    }
    .pin-label-pill.origin {
      background: ${colors.status.success.main};
    }
    .pin-label-pill.destination {
      background: ${colors.status.danger.main};
    }
    .pin-label-pill.stop {
      background: ${colors.brand.primaryPressed};
    }

    /* ─── VEHICLE MOVING MARKER ─── */
    .vehicle-marker {
      width: 36px;
      height: 36px;
      border-radius: 999px;
      background: linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%);
      border: 2.5px solid #FFFFFF;
      box-shadow: 0 4px 14px rgba(29, 78, 216, 0.6);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 18px;
      cursor: pointer;
      user-select: none;
      box-sizing: border-box;
      z-index: 100;
      animation: vehicle-pulse 2.2s infinite ease-in-out;
    }
    @keyframes vehicle-pulse {
      0% { box-shadow: 0 0 0 0 rgba(37, 99, 235, 0.7), 0 4px 14px rgba(29, 78, 216, 0.6); }
      70% { box-shadow: 0 0 0 10px rgba(37, 99, 235, 0), 0 4px 14px rgba(29, 78, 216, 0.6); }
      100% { box-shadow: 0 0 0 0 rgba(37, 99, 235, 0), 0 4px 14px rgba(29, 78, 216, 0.6); }
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
      max-height: 380px;
      overflow-y: auto;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
    }
    .goongjs-popup-close-button {
      padding: 6px 10px !important;
      color: #64748B !important;
      font-size: 16px !important;
    }
    .custom-popup-card {
      padding: 14px 16px;
      min-width: 220px;
      max-width: 290px;
      background: #FFFFFF;
    }
    .popup-badge-row {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-bottom: 6px;
      flex-wrap: wrap;
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
      margin-bottom: 8px;
    }
    .popup-section-title {
      font-size: 10.5px;
      font-weight: 800;
      color: #334155;
      text-transform: uppercase;
      letter-spacing: 0.4px;
      margin-top: 8px;
      margin-bottom: 4px;
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .popup-order-item {
      background: #F8FAFC;
      border: 1px solid #E2E8F0;
      border-radius: 8px;
      padding: 6px 8px;
      margin-top: 4px;
    }
    .popup-order-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 11px;
      font-weight: 700;
      color: #0F172A;
    }
    .popup-order-details {
      font-size: 10px;
      color: #64748B;
      margin-top: 2px;
      line-height: 1.35;
    }
    .popup-tag-pill {
      font-size: 9px;
      font-weight: 700;
      padding: 1px 5px;
      border-radius: 4px;
      background: #EFF6FF;
      color: #1D4ED8;
      display: inline-block;
      margin-right: 4px;
      margin-top: 2px;
    }
    .popup-lpn-chip {
      font-size: 9.5px;
      font-family: monospace;
      font-weight: 700;
      background: #F1F5F9;
      color: #334155;
      padding: 2px 6px;
      border-radius: 4px;
      border: 1px solid #CBD5E1;
      display: inline-block;
      margin-right: 4px;
      margin-top: 3px;
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
    document.addEventListener('scroll', function() { window.scrollTo(0, 0); }, true);
    document.body.addEventListener('touchmove', function(e) {
      if (!e.target.closest('.goongjs-canvas-container') && !e.target.closest('.goongjs-marker')) {
        e.preventDefault();
      }
    }, { passive: false });

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
        pointId: message.pointId
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
        domain: getDomain(source)
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
      const hasVehicle = payload.vehiclePosition &&
        Number.isFinite(Number(payload.vehiclePosition.latitude)) &&
        Number.isFinite(Number(payload.vehiclePosition.longitude));

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
        window.addEventListener('resize', function() { map.resize(); });

        let allBounds = new goongjs.LngLatBounds();
        window.fitAllBounds = function() {
          if (map && !allBounds.isEmpty()) {
            map.fitBounds(allBounds, { padding: 48, maxZoom: 14, duration: 800 });
          }
        };

        map.on('load', function () {
          map.resize();
          const bounds = new goongjs.LngLatBounds();

          let activeMarkerElement = null;

          payload.points.forEach(function (point, index) {
            const isOrigin = point.type === 'origin';
            const isFinal = point.type === 'destination';
            const seqNumber = point.sequence || (index + 1);

            const markerEl = document.createElement('div');
            markerEl.className = 'custom-pin ' + point.type;
            markerEl.setAttribute('role', 'img');
            markerEl.setAttribute('aria-label', point.accessibilityLabel || point.label);

            const pinColorTop = isFinal ? '${colors.status.danger.main}' : isOrigin ? '${colors.status.success.main}' : '${colors.brand.primary}';
            const pinColorBottom = isFinal ? '${colors.status.danger.main}' : isOrigin ? '${colors.status.success.main}' : '${colors.brand.primaryPressed}';
            const textFill = isFinal ? '${colors.status.danger.main}' : isOrigin ? '${colors.status.success.main}' : '${colors.brand.primaryPressed}';
            const labelText = String(seqNumber);
            const fontSize = labelText.length > 1 ? '9.5' : '11.5';
            const pillText = isOrigin
              ? '🏢 Kho xuất phát'
              : isFinal
              ? ('🏁 Điểm cuối #' + seqNumber)
              : ('Điểm giao #' + seqNumber);

            let innerIconSvg = '';
            if (isOrigin) {
              // Warehouse Building SVG Icon
              innerIconSvg =
                '<g fill="${colors.status.success.main}" transform="translate(8, 7) scale(0.5)">' +
                  '<path d="M12 2L1 8L3 9V21H21V9L23 8L12 2ZM7 19H5V10.5L12 6.5L19 10.5V19H17V12H7V19ZM9 19H15V14H9V19Z" />' +
                '</g>';
            } else {
              innerIconSvg =
                '<text x="14" y="13.2" text-anchor="middle" dominant-baseline="central" font-size="' + fontSize + '" font-weight="900" fill="' + textFill + '" font-family="system-ui, -apple-system, sans-serif">' + labelText + '</text>';
            }

            const svgId = String(point.id || index).replace(/[^a-zA-Z0-9_-]/g, '');
            markerEl.innerHTML =
              '<svg class="pin-svg" width="28" height="36" viewBox="0 0 28 36" fill="none" xmlns="http://www.w3.org/2000/svg">' +
                '<defs>' +
                  '<filter id="shadow-' + svgId + '" x="-20%" y="-20%" width="140%" height="140%">' +
                    '<feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="rgba(0,0,0,0.35)" />' +
                  '</filter>' +
                  '<linearGradient id="grad-' + svgId + '" x1="0" y1="0" x2="0" y2="36" gradientUnits="userSpaceOnUse">' +
                    '<stop offset="0%" stop-color="' + pinColorTop + '" />' +
                    '<stop offset="100%" stop-color="' + pinColorBottom + '" />' +
                  '</linearGradient>' +
                '</defs>' +
                '<path d="M14 0C6.268 0 0 6.268 0 14C0 24.5 14 36 14 36C14 36 28 24.5 28 14C28 6.268 21.732 0 14 0Z" fill="url(#grad-' + svgId + ')" stroke="${colors.surface.card}" stroke-width="2.5" filter="url(#shadow-' + svgId + ')" />' +
                '<circle cx="14" cy="13" r="8" fill="${colors.surface.card}" />' +
                innerIconSvg +
              '</svg>' +
              '<div class="pin-label-pill ' + point.type + '">' + pillText + '</div>';

            let popupHtml = '<div class="custom-popup-card">';
            popupHtml += '<div class="popup-badge-row">';
            if (isOrigin) {
              popupHtml += '<span class="popup-badge origin">🏢 Kho xuất phát</span>';
            } else if (isFinal) {
              popupHtml += '<span class="popup-badge destination">🏁 Điểm đến cuối — Điểm số ' + seqNumber + '</span>';
            } else {
              popupHtml += '<span class="popup-badge stop">📍 Điểm giao số ' + seqNumber + '</span>';
            }
            if (point.stopType) {
              popupHtml += '<span class="popup-badge" style="background:#F1F5F9; color:#475569;">' + escapeHtml(point.stopType) + '</span>';
            }
            popupHtml += '</div>';

            popupHtml += '<div class="popup-title">' + escapeHtml(point.label) + '</div>';
            popupHtml += '<div class="popup-address">' + escapeHtml(point.address || point.lat + ', ' + point.lon) + '</div>';
            
            // Orders section
            if (point.orders && point.orders.length > 0) {
              popupHtml += '<div class="popup-section-title">📦 Đơn hàng (' + point.orders.length + ')</div>';
              point.orders.forEach(function(order) {
                popupHtml += '<div class="popup-order-item">';
                popupHtml += '<div class="popup-order-header">';
                popupHtml += '<span>' + escapeHtml(order.itemName || 'Hàng đông lạnh') + '</span>';
                if (order.quantity !== null && order.quantity !== undefined) {
                  popupHtml += '<span>SL: ' + order.quantity + '</span>';
                }
                popupHtml += '</div>';
                if (order.trackingCode) {
                  popupHtml += '<div class="popup-order-details">Mã vận đơn: <b>' + escapeHtml(order.trackingCode) + '</b></div>';
                }
                let metaPills = '';
                if (order.category) metaPills += '<span class="popup-tag-pill">' + escapeHtml(order.category) + '</span>';
                if (order.tempCondition) metaPills += '<span class="popup-tag-pill" style="background:#FEF2F2; color:#B91C1C;">' + escapeHtml(order.tempCondition) + '</span>';
                if (order.weightKg !== null && order.weightKg !== undefined) metaPills += '<span class="popup-tag-pill" style="background:#F1F5F9; color:#334155;">' + order.weightKg + ' kg</span>';
                if (order.cbm !== null && order.cbm !== undefined) metaPills += '<span class="popup-tag-pill" style="background:#F1F5F9; color:#334155;">' + order.cbm + ' CBM</span>';
                if (metaPills) {
                  popupHtml += '<div style="margin-top:3px;">' + metaPills + '</div>';
                }
                popupHtml += '</div>';
              });
            } else if (point.ordersCount) {
              popupHtml += '<div class="popup-section-title">📦 Đơn hàng: ' + point.ordersCount + ' đơn</div>';
              if (point.orderItemsSummary) {
                popupHtml += '<div style="font-size:11px; color:#475569; font-style:italic;">' + escapeHtml(point.orderItemsSummary) + '</div>';
              }
            }

            // LPNs section
            if (point.lpns && point.lpns.length > 0) {
              popupHtml += '<div class="popup-section-title" style="margin-top:6px;">🏷️ Danh sách LPN (' + point.lpns.length + ')</div>';
              popupHtml += '<div style="margin-top:2px;">';
              point.lpns.forEach(function(lpn) {
                popupHtml += '<span class="popup-lpn-chip">' + escapeHtml(lpn.lpnCode || lpn.lpnId || 'LPN') + '</span>';
              });
              popupHtml += '</div>';
            } else if (point.lpnsCount) {
              popupHtml += '<div style="font-size:10.5px; color:#475569; margin-top:4px;">🏷️ ' + point.lpnsCount + ' LPN</div>';
            }

            popupHtml += '</div>';

            const popup = new goongjs.Popup({ offset: [0, -38], closeButton: true, maxWidth: '290px' })
              .setHTML(popupHtml);

            popup.on('open', function() {
              if (activeMarkerElement) activeMarkerElement.classList.remove('active');
              markerEl.classList.add('active');
              activeMarkerElement = markerEl;
              postBridge({ type: 'MARKER_SELECTED', pointId: point.id });
            });

            popup.on('close', function() {
              markerEl.classList.remove('active');
              if (activeMarkerElement === markerEl) activeMarkerElement = null;
            });

            new goongjs.Marker(markerEl, { anchor: 'bottom' })
              .setLngLat([point.lon, point.lat])
              .setPopup(popup)
              .addTo(map);

            bounds.extend([point.lon, point.lat]);
          });

          var routeCoords = (payload.routeCoordinates && payload.routeCoordinates.length > 1)
            ? payload.routeCoordinates
            : (payload.points.length > 1 ? payload.points.map(function(p) { return [p.lon, p.lat]; }) : []);

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

            const snapped = snapToRoute(rawLon, rawLat, routeCoords);
            const finalLon = snapped[0];
            const finalLat = snapped[1];

            if (vehicleMarker) {
              vehicleMarker.setLngLat([finalLon, finalLat]);
            } else if (map) {
              const vehicleEl = document.createElement('div');
              vehicleEl.className = 'vehicle-marker';
              vehicleEl.textContent = '🚚';
              vehicleEl.setAttribute('role', 'img');
              vehicleEl.setAttribute('aria-label', 'Vị trí xe đang vận chuyển');

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
              const initialSnapped = snapToRoute(vLon, vLat, routeCoords);
              bounds.extend([initialSnapped[0], initialSnapped[1]]);
            }
          }

          if (routeCoords.length > 1) {
            map.addSource('planned-route', {
              type: 'geojson',
              data: {
                type: 'Feature',
                properties: {},
                geometry: {
                  type: 'LineString',
                  coordinates: routeCoords
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
                'line-color': '${colors.text.primary}',
                'line-width': 8,
                'line-opacity': 0.85
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
                'line-color': '${colors.brand.primary}',
                'line-width': 5.5,
                'line-opacity': 1
              }
            });

            routeCoords.forEach(function(c) {
              bounds.extend(c);
            });
          }

          allBounds = bounds;

          if (payload.points.length > 1 || payload.vehiclePosition || routeCoords.length > 1) {
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
