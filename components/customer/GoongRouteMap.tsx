import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';

import { TripRoutePointDto, TripRouteResponse } from '../../services/trackingApi';

type RouteMapPoint = {
  id: string;
  label: string;
  address: string;
  lat: number;
  lon: number;
  type: 'origin' | 'stop' | 'destination';
  sequence?: number;
};

type GoongRouteMapProps = {
  route: TripRouteResponse;
  height?: number;
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

const GOONG_MAPTILES_KEY = process.env.EXPO_PUBLIC_GOONG_MAPTILES_KEY?.trim();

export function GoongRouteMap({ route, height = 300, vehiclePosition = null }: GoongRouteMapProps) {
  const [mapFailure, setMapFailure] = useState<MapBridgeMessage | null>(null);
  const [isMapReady, setIsMapReady] = useState(false);
  const points = useMemo(() => buildRoutePoints(route), [route]);
  const routeCoordinates = useMemo(
    () => decodePolyline(route.overviewPolyline),
    [route.overviewPolyline]
  );
  const mapHtml = useMemo(() => {
    if (!GOONG_MAPTILES_KEY || points.length === 0) return '';
    return buildMapHtml(GOONG_MAPTILES_KEY, points, routeCoordinates, vehiclePosition);
  }, [points, routeCoordinates, vehiclePosition]);

  useEffect(() => {
    setMapFailure(null);
    setIsMapReady(false);
  }, [route.tripId, route.overviewPolyline, vehiclePosition?.latitude, vehiclePosition?.longitude]);

  if (!GOONG_MAPTILES_KEY) {
    return <RouteMapFallback message="Goong MapTiles key chưa được cấu hình." points={points} />;
  }

  if (points.length === 0) {
    return <RouteMapFallback message="Dữ liệu tọa độ tuyến đường không hợp lệ." points={points} />;
  }

  if (mapFailure) {
    return <RouteMapFallback message={getMapFailureMessage(mapFailure)} points={points} />;
  }

  return (
    <View className="overflow-hidden rounded-2xl border border-[#DAC2B6]/60 bg-[#F8F9FA]">
      <WebView
        key={`${route.tripId}-${route.overviewPolyline ?? 'route'}-${vehiclePosition?.latitude ?? 'no-lat'}-${vehiclePosition?.longitude ?? 'no-lon'}`}
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
          <View className="absolute inset-0 items-center justify-center bg-[#EEF2F5]">
            <ActivityIndicator size="small" color="#8B4513" />
            <Text className="mt-2 text-xs font-medium text-[#877369]">Đang tải bản đồ...</Text>
          </View>
        )}
        style={{ height, backgroundColor: '#EEF2F5' }}
      />
      {routeCoordinates.length < 2 ? (
        <View className="border-t border-[#DAC2B6]/50 bg-amber-50 px-4 py-3">
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
  const destination = toMapPoint(route.destination, 'destination', 'Điểm đến');

  if (origin) points.push(origin);

  route.optimizedStops
    .slice()
    .sort((left, right) => (left.optimizedSequence ?? 0) - (right.optimizedSequence ?? 0))
    .forEach((stop, index) => {
      const sequence = stop.optimizedSequence ?? index + 1;
      const point = toMapPoint(stop, 'stop', `Điểm dừng ${sequence}`, sequence);
      if (point) points.push(point);
    });

  if (destination) points.push(destination);
  return points;
}

function RouteMapFallback({ message, points }: { message: string; points: RouteMapPoint[] }) {
  return (
    <View className="gap-3 rounded-2xl border border-[#DAC2B6]/60 bg-[#F8F9FA] p-4">
      <Text className="text-sm font-semibold text-[#8B4513]">{message}</Text>
      {points.length > 0 ? (
        <View className="gap-2">
          {points.map((point, index) => (
            <View key={point.id} className="flex-row items-start gap-3">
              <View className="mt-0.5 h-6 w-6 items-center justify-center rounded-full bg-[#8B4513]">
                <Text className="text-[10px] font-bold text-white">{index + 1}</Text>
              </View>
              <View className="flex-1">
                <Text className="text-xs font-bold text-[#3A1F04]">{point.label}</Text>
                <Text className="mt-1 text-xs leading-5 text-[#877369]">{point.address || `${point.lat}, ${point.lon}`}</Text>
              </View>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function toMapPoint(
  point: TripRoutePointDto | null | undefined,
  type: RouteMapPoint['type'],
  label: string,
  sequence?: number
): RouteMapPoint | null {
  if (!point || !isValidMapCoordinate(point.lat, point.lon)) return null;

  return {
    id: `${type}-${point.locationId ?? `${point.lat}-${point.lon}`}`,
    label,
    address: point.address,
    lat: point.lat,
    lon: point.lon,
    type,
    sequence,
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
    .marker {
      width: 30px;
      height: 30px;
      border-radius: 999px;
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      font: 700 12px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      border: 3px solid #fff;
      box-shadow: 0 8px 18px rgba(58, 31, 4, 0.22);
    }
    .marker.origin { background: #0f766e; }
    .marker.stop { background: #8b4513; }
    .marker.destination { background: #b91c1c; }
    .marker.vehicle { width: 38px; height: 38px; background: #1d4ed8; font-size: 18px; }
    .popup { min-width: 150px; font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    .popup-title { font-size: 13px; font-weight: 700; color: #3a1f04; margin-bottom: 4px; }
    .popup-address { font-size: 12px; line-height: 1.35; color: #5f5149; }
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
      if (!window.goongjs || !payload.points.length) {
        showMapError({
          type: 'RESOURCE_ERROR',
          message: !window.goongjs ? 'Goong JavaScript library is unavailable' : 'No valid route coordinates',
          domain: !window.goongjs ? 'cdn.jsdelivr.net' : undefined
        });
      } else if (typeof goongjs.supported === 'function' && !goongjs.supported()) {
        showMapError({ type: 'MAP_UNSUPPORTED', message: 'WebGL is unavailable in this WebView' });
      } else {
        goongjs.accessToken = mapTilesKey;
        const firstPoint = payload.points[0];
        const map = new goongjs.Map({
          container: 'map',
          style: 'https://tiles.goong.io/assets/goong_map_web.json',
          accessToken: mapTilesKey,
          center: [firstPoint.lon, firstPoint.lat],
          zoom: payload.points.length > 1 ? 8 : 13,
          attributionControl: false
        });

        map.addControl(new goongjs.NavigationControl({ showCompass: false }), 'top-right');

        map.on('load', function () {
          const bounds = new goongjs.LngLatBounds();

          payload.points.forEach(function (point, index) {
            const marker = document.createElement('div');
            marker.className = 'marker ' + point.type;
            marker.textContent = point.type === 'origin' ? 'A' : point.type === 'destination' ? 'B' : String(point.sequence || index);

            new goongjs.Marker(marker)
              .setLngLat([point.lon, point.lat])
              .setPopup(new goongjs.Popup({ offset: 18 }).setHTML(
                '<div class="popup">' +
                  '<div class="popup-title">' + escapeHtml(point.label) + '</div>' +
                  '<div class="popup-address">' + escapeHtml(point.address || point.lat + ', ' + point.lon) + '</div>' +
                '</div>'
              ))
              .addTo(map);

            bounds.extend([point.lon, point.lat]);
          });

          if (payload.vehiclePosition) {
            const vehicleMarker = document.createElement('div');
            vehicleMarker.className = 'marker vehicle';
            vehicleMarker.textContent = '🚚';
            new goongjs.Marker(vehicleMarker)
              .setLngLat([payload.vehiclePosition.longitude, payload.vehiclePosition.latitude])
              .setPopup(new goongjs.Popup({ offset: 22 }).setHTML(
                '<div class="popup"><div class="popup-title">Vị trí xe hiện tại</div></div>'
              ))
              .addTo(map);
            bounds.extend([payload.vehiclePosition.longitude, payload.vehiclePosition.latitude]);
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

            map.addLayer({
              id: 'planned-route-line',
              type: 'line',
              source: 'planned-route',
              layout: {
                'line-join': 'round',
                'line-cap': 'round'
              },
              paint: {
                'line-color': '#8b4513',
                'line-width': 5,
                'line-opacity': 0.86
              }
            });
          }

          if (payload.points.length > 1 || payload.vehiclePosition) {
            map.fitBounds(bounds, { padding: 44, maxZoom: 13, duration: 0 });
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

function isValidMapCoordinate(latitude: number, longitude: number) {
  return Number.isFinite(latitude)
    && Number.isFinite(longitude)
    && latitude >= -90
    && latitude <= 90
    && longitude >= -180
    && longitude <= 180;
}

function parseMapBridgeMessage(value: string): MapBridgeMessage | null {
  try {
    const message = JSON.parse(value) as Partial<MapBridgeMessage>;
    const allowedTypes = new Set<MapBridgeMessage['type']>([
      'MAP_READY',
      'MAP_ERROR',
      'MAP_UNSUPPORTED',
      'RESOURCE_ERROR',
      'JS_ERROR',
      'UNHANDLED_REJECTION',
    ]);
    if (!message.type || !allowedTypes.has(message.type)) return null;
    return {
      type: message.type,
      message: sanitizeDiagnosticMessage(message.message),
      status: typeof message.status === 'number' && Number.isFinite(message.status) ? message.status : undefined,
      domain: sanitizeDomain(message.domain),
    };
  } catch {
    return null;
  }
}

function getMapFailureMessage(failure: MapBridgeMessage) {
  if (failure.status === 401 || failure.status === 403) {
    return `Goong MapTiles key không hợp lệ hoặc không được phép (HTTP ${failure.status}).`;
  }
  if (failure.status === 404) {
    return 'Không tìm thấy tài nguyên bản đồ Goong.';
  }
  if (failure.type === 'MAP_UNSUPPORTED') {
    return 'Android WebView hiện tại không hỗ trợ WebGL để hiển thị bản đồ.';
  }
  if (failure.type === 'RESOURCE_ERROR') {
    return failure.domain
      ? `Không thể tải tài nguyên bản đồ từ ${failure.domain}.`
      : 'Không thể tải tài nguyên bản đồ.';
  }
  return 'Không thể khởi tạo bản đồ từ dữ liệu tuyến đường.';
}

function sanitizeDiagnosticMessage(value?: string) {
  if (!value) return undefined;
  return value
    .replace(/https?:\/\/([^/\s]+)[^\s]*/gi, '$1')
    .replace(/([?&](?:access_token|api_key|key)=)[^&\s]+/gi, '$1[REDACTED]')
    .slice(0, 240);
}

function sanitizeDomain(value?: string) {
  if (!value) return undefined;
  const domain = value.trim().toLowerCase();
  return /^[a-z0-9.-]+$/.test(domain) ? domain.slice(0, 120) : undefined;
}

function getHostname(value?: string) {
  if (!value) return undefined;
  try {
    return sanitizeDomain(new URL(value).hostname);
  } catch {
    return undefined;
  }
}
