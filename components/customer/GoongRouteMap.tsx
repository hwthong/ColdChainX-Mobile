import React, { useEffect, useMemo, useState } from 'react';
import { Text, View } from 'react-native';
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
};

const GOONG_MAP_KEY = process.env.EXPO_PUBLIC_GOONG_MAP_KEY?.trim();

export function GoongRouteMap({ route, height = 300 }: GoongRouteMapProps) {
  const [webViewFailed, setWebViewFailed] = useState(false);
  const points = useMemo(() => buildRoutePoints(route), [route]);
  const routeCoordinates = useMemo(
    () => decodePolyline(route.overviewPolyline),
    [route.overviewPolyline]
  );
  const mapHtml = useMemo(() => {
    if (!GOONG_MAP_KEY || points.length === 0) return '';
    return buildMapHtml(GOONG_MAP_KEY, points, routeCoordinates);
  }, [points, routeCoordinates]);

  useEffect(() => {
    setWebViewFailed(false);
  }, [route.tripId, route.overviewPolyline]);

  if (!GOONG_MAP_KEY) {
    return <RouteMapFallback message="Chưa cấu hình Goong Map Key." points={points} />;
  }

  if (points.length === 0) {
    return <RouteMapFallback message="Không có tọa độ tuyến đường dự kiến." points={points} />;
  }

  if (webViewFailed) {
    return <RouteMapFallback message="Không thể tải tuyến đường dự kiến." points={points} />;
  }

  return (
    <View className="overflow-hidden rounded-2xl border border-[#DAC2B6]/60 bg-[#F8F9FA]">
      <WebView
        key={`${route.tripId}-${route.overviewPolyline ?? 'route'}`}
        originWhitelist={['*']}
        source={{ html: mapHtml }}
        javaScriptEnabled
        domStorageEnabled
        scrollEnabled={false}
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        onError={() => setWebViewFailed(true)}
        onHttpError={() => setWebViewFailed(true)}
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
  if (!point || !Number.isFinite(point.lat) || !Number.isFinite(point.lon)) return null;

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

    coordinates.push([lon / 1e5, lat / 1e5]);
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
  routeCoordinates: [number, number][]
) {
  const payload = escapeJsonForHtml(JSON.stringify({ points, routeCoordinates }));
  const safeMapKey = escapeJsonForHtml(JSON.stringify(mapKey));

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="initial-scale=1,maximum-scale=1,user-scalable=no" />
  <link href="https://cdn.jsdelivr.net/npm/@goongmaps/goong-js/dist/goong-js.css" rel="stylesheet" />
  <script src="https://cdn.jsdelivr.net/npm/@goongmaps/goong-js/dist/goong-js.js"></script>
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
    const mapKey = ${safeMapKey};
    const payload = ${payload};

    function showMapError() {
      const error = document.getElementById('map-error');
      if (error) error.style.display = 'flex';
    }

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
        showMapError();
      } else {
        goongjs.accessToken = mapKey;
        const firstPoint = payload.points[0];
        const map = new goongjs.Map({
          container: 'map',
          style: 'https://tiles.goong.io/assets/goong_map_web.json',
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

          if (payload.points.length > 1) {
            map.fitBounds(bounds, { padding: 44, maxZoom: 13, duration: 0 });
          }
        });

        map.on('error', showMapError);
      }
    } catch (error) {
      showMapError();
    }
  </script>
</body>
</html>`;
}

function escapeJsonForHtml(value: string) {
  return value.replace(/</g, '\\u003c').replace(/>/g, '\\u003e');
}
