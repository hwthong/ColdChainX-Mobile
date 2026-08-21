import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  calculateFinalDestinationNumber,
  formatTripDistance,
  formatTripDuration,
  decodePolyline,
  isValidMapCoordinate,
  buildRoutePoints,
} from '../routeUtils';
import type {
  TripRouteResponse,
} from '../trackingApi';
import {
  normalizeTripRoute,
  normalizeTripRouteApiResponse,
} from '../trackingApi';

describe('Trip Route Utilities & Multi-Stop Delivery Mapping', () => {
  describe('1. API Normalization (camelCase and PascalCase support)', () => {
    it('should correctly normalize camelCase JSON response from backend', () => {
      const rawCamelCase = {
        tripId: '550e8400-e29b-41d4-a716-446655440000',
        overviewPolyline: '_p~iF~ps|U_ulLnnqC_mqNvxq`@',
        totalDistanceMeters: 125000,
        totalDurationSeconds: 10800,
        origin: {
          locationId: 'loc-origin',
          address: 'Kho Tổng TP.HCM',
          lat: 10.8231,
          lon: 106.6297,
        },
        destination: {
          locationId: 'loc-dest',
          address: 'Điểm trả hàng Cần Thơ',
          lat: 10.0452,
          lon: 105.7469,
        },
        waypointOrder: [1, 0],
        optimizedStops: [
          {
            tripStopId: 'stop-1',
            locationId: 'loc-stop-1',
            originalStopSequence: 2,
            optimizedSequence: 1,
            stopType: 'DELIVERY',
            address: 'Đại lý Mỹ Tho',
            lat: 10.3622,
            lon: 106.3633,
            orders: [
              {
                orderId: 'ord-101',
                trackingCode: 'VN-101',
                itemName: 'Vaccine đông lạnh',
                category: 'Pharma',
                quantity: 10,
                weightKg: 25.5,
                cbm: 0.2,
                tempCondition: '-20°C',
              },
            ],
            lpns: [
              {
                lpnId: 'lpn-1',
                lpnCode: 'LPN-BOX-01',
                orderId: 'ord-101',
              },
            ],
          },
          {
            tripStopId: 'stop-2',
            locationId: 'loc-stop-2',
            originalStopSequence: 1,
            optimizedSequence: 2,
            stopType: 'DELIVERY',
            address: 'Kho Vĩnh Long',
            lat: 10.2537,
            lon: 105.9722,
            orders: [
              {
                orderId: 'ord-102',
                trackingCode: 'VN-102',
                itemName: 'Hải sản đông lạnh',
                quantity: 5,
              },
            ],
            lpns: [],
          },
        ],
      };

      const normalized = normalizeTripRoute(rawCamelCase);
      assert.ok(normalized);
      assert.equal(normalized.tripId, '550e8400-e29b-41d4-a716-446655440000');
      assert.equal(normalized.totalDistanceMeters, 125000);
      assert.equal(normalized.totalDurationSeconds, 10800);
      assert.equal(normalized.origin?.lat, 10.8231);
      assert.equal(normalized.destination?.lat, 10.0452);
      assert.equal(normalized.optimizedStops.length, 2);
      assert.equal(normalized.optimizedStops[0].optimizedSequence, 1);
      assert.equal(normalized.optimizedStops[0].orders[0].trackingCode, 'VN-101');
      assert.equal(normalized.optimizedStops[0].lpns[0].lpnCode, 'LPN-BOX-01');
      assert.equal(normalized.optimizedStops[1].optimizedSequence, 2);
    });

    it('should correctly normalize PascalCase JSON response from .NET backend', () => {
      const rawPascalCase = {
        TripId: '550e8400-e29b-41d4-a716-446655440000',
        OverviewPolyline: 'encoded-test',
        TotalDistanceMeters: 75000,
        TotalDurationSeconds: 7200,
        Origin: {
          LocationId: 'loc-0',
          Address: 'Kho Tân Bình',
          Lat: 10.8,
          Lon: 106.6,
        },
        Destination: {
          LocationId: 'loc-end',
          Address: 'Kho Bình Dương',
          Lat: 11.0,
          Lon: 106.7,
        },
        OptimizedStops: [
          {
            StopId: 'stop-p1',
            OptimizedSequence: 1,
            StopType: 'DELIVERY',
            Address: 'Điểm 1',
            Lat: 10.9,
            Lon: 106.65,
            Orders: [
              {
                OrderId: 'ord-p1',
                TrackingCode: 'VN-P1',
                ItemName: 'Thịt đông lạnh',
              },
            ],
            Lpns: [
              {
                LpnId: 'lpn-p1',
                LpnCode: 'LPN-P1',
                OrderId: 'ord-p1',
              },
            ],
          },
        ],
      };

      const normalized = normalizeTripRoute(rawPascalCase);
      assert.ok(normalized);
      assert.equal(normalized.tripId, '550e8400-e29b-41d4-a716-446655440000');
      assert.equal(normalized.totalDistanceMeters, 75000);
      assert.equal(normalized.origin?.address, 'Kho Tân Bình');
      assert.equal(normalized.destination?.address, 'Kho Bình Dương');
      assert.equal(normalized.optimizedStops.length, 1);
      assert.equal(normalized.optimizedStops[0].orders[0].itemName, 'Thịt đông lạnh');
      assert.equal(normalized.optimizedStops[0].lpns[0].lpnCode, 'LPN-P1');
    });

    it('preserves the optimizedStops order returned by the backend', () => {
      const normalized = normalizeTripRoute({
        TripId: 'trip-order',
        OptimizedStops: [
          { StopId: 'stop-2', OptimizedSequence: 2, Address: 'Điểm 2', Lat: 11, Lon: 107 },
          { StopId: 'stop-1', OptimizedSequence: 1, Address: 'Điểm 1', Lat: 10, Lon: 106 },
        ],
      });

      assert.ok(normalized);
      assert.deepEqual(
        normalized.optimizedStops.map((stop) => stop.stopId),
        ['stop-2', 'stop-1']
      );
    });

    it('normalizes a PascalCase API envelope used by .NET', () => {
      const response = normalizeTripRouteApiResponse({
        Success: true,
        Message: 'OK',
        Data: {
          TripId: 'trip-envelope',
          OptimizedStops: [],
        },
      });

      assert.equal(response.success, true);
      assert.equal(response.message, 'OK');
      assert.equal(response.data?.tripId, 'trip-envelope');
    });
  });

  describe('2. Final Destination Number Calculation', () => {
    it('should calculate final destination number correctly for different stop counts', () => {
      // 0 stops -> destination is #1
      assert.equal(calculateFinalDestinationNumber(0), 1);
      // 1 stop -> destination is #2
      assert.equal(calculateFinalDestinationNumber(1), 2);
      // 2 stops -> destination is #3
      assert.equal(calculateFinalDestinationNumber(2), 3);
      // 5 stops -> destination is #6
      assert.equal(calculateFinalDestinationNumber(5), 6);
    });
  });

  describe('3. Distance & Duration Formatting', () => {
    it('should format distance accurately', () => {
      assert.equal(formatTripDistance(125000), '125 km');
      assert.equal(formatTripDistance(12500), '12.5 km');
      assert.equal(formatTripDistance(800), '800 m');
      assert.equal(formatTripDistance(0), '0 km');
    });

    it('should format duration accurately', () => {
      assert.equal(formatTripDuration(10800), '3 giờ');
      assert.equal(formatTripDuration(8100), '2 giờ 15 phút');
      assert.equal(formatTripDuration(2400), '40 phút');
      assert.equal(formatTripDuration(0), '0 phút');
    });
  });

  describe('4. buildRoutePoints: Origin, Intermediate Stops & Final Destination Mapping', () => {
    it('should map a 3-destination trip with markers 1, 2, 3 and unnumbered origin', () => {
      const mockRoute: TripRouteResponse = {
        tripId: 'test-trip-3-stops',
        totalDistanceMeters: 125000,
        totalDurationSeconds: 10800,
        origin: {
          locationId: 'origin-1',
          address: 'Kho Xuất Phát Tổng',
          lat: 10.8231,
          lon: 106.6297,
        },
        destination: {
          locationId: 'dest-final',
          address: 'Điểm Đến Cuối Cùng Cần Thơ',
          lat: 10.0452,
          lon: 105.7469,
        },
        waypointOrder: [0, 1],
        optimizedStops: [
          {
            stopId: 'stop-a',
            optimizedSequence: 1,
            originalStopSequence: 2,
            stopType: 'DELIVERY',
            address: 'Điểm Giao Thứ Nhất Mỹ Tho',
            lat: 10.3622,
            lon: 106.3633,
            orders: [
              {
                orderId: 'ord-1',
                trackingCode: 'TRK-001',
                itemName: 'Hàng đông lạnh',
              },
            ],
            lpns: [],
          },
          {
            stopId: 'stop-b',
            optimizedSequence: 2,
            originalStopSequence: 1,
            stopType: 'DELIVERY',
            address: 'Điểm Giao Thứ Hai Vĩnh Long',
            lat: 10.2537,
            lon: 105.9722,
            orders: [
              {
                orderId: 'ord-2',
                trackingCode: 'TRK-002',
                itemName: 'Dược phẩm lạnh',
              },
            ],
            lpns: [],
          },
        ],
      };

      const points = buildRoutePoints(mockRoute);
      assert.equal(points.length, 4);

      // Point 0: Origin (no number, type: 'origin')
      assert.equal(points[0].type, 'origin');
      assert.ok(points[0].accessibilityLabel.includes('Điểm xuất phát'));

      // Point 1: Intermediate Stop 1
      assert.equal(points[1].type, 'stop');
      assert.equal(points[1].sequence, 1);
      assert.equal(points[1].accessibilityLabel, 'Điểm giao số 1, Điểm Giao Thứ Nhất Mỹ Tho');

      // Point 2: Intermediate Stop 2
      assert.equal(points[2].type, 'stop');
      assert.equal(points[2].sequence, 2);
      assert.equal(points[2].accessibilityLabel, 'Điểm giao số 2, Điểm Giao Thứ Hai Vĩnh Long');

      // Point 3: Final Destination (#3)
      assert.equal(points[3].type, 'destination');
      assert.equal(points[3].sequence, 3);
      assert.equal(points[3].accessibilityLabel, 'Điểm đến cuối, điểm số 3, Điểm Đến Cuối Cùng Cần Thơ');
    });

    it('should map a 1-destination trip with origin and destination numbered 1', () => {
      const mockSingleTrip: TripRouteResponse = {
        tripId: 'test-trip-1-dest',
        totalDistanceMeters: 25000,
        totalDurationSeconds: 1800,
        origin: {
          address: 'Kho Xuất Phát',
          lat: 10.8,
          lon: 106.6,
        },
        destination: {
          address: 'Điểm Giao Duy Nhất',
          lat: 10.9,
          lon: 106.7,
        },
        waypointOrder: [],
        optimizedStops: [],
      };

      const points = buildRoutePoints(mockSingleTrip);
      assert.equal(points.length, 2);
      assert.equal(points[0].type, 'origin');
      assert.equal(points[1].type, 'destination');
      assert.equal(points[1].sequence, 1);
      assert.equal(points[1].accessibilityLabel, 'Điểm đến cuối, điểm số 1, Điểm Giao Duy Nhất');
    });

    it('should deduplicate when destination has matching coordinates with last stop', () => {
      const mockDuplicateDest: TripRouteResponse = {
        tripId: 'test-dup-dest',
        totalDistanceMeters: 50000,
        totalDurationSeconds: 3600,
        origin: {
          address: 'Kho A',
          lat: 10.8,
          lon: 106.6,
        },
        destination: {
          address: 'Điểm Cuối Trùng Điểm Dừng 2',
          lat: 10.2537,
          lon: 105.9722,
        },
        waypointOrder: [],
        optimizedStops: [
          {
            stopId: 's1',
            optimizedSequence: 1,
            address: 'Điểm 1',
            lat: 10.3622,
            lon: 106.3633,
            orders: [],
            lpns: [],
          },
          {
            stopId: 's2',
            optimizedSequence: 2,
            address: 'Điểm 2',
            lat: 10.2537,
            lon: 105.9722,
            orders: [
              {
                orderId: 'ord-dup',
                trackingCode: 'TRK-DUP',
                itemName: 'Hàng trả cuối',
              },
            ],
            lpns: [],
          },
        ],
      };

      const points = buildRoutePoints(mockDuplicateDest);
      assert.equal(points.length, 3);
      assert.equal(points[0].type, 'origin');
      assert.equal(points[1].type, 'stop');
      assert.equal(points[1].sequence, 1);
      assert.equal(points[2].type, 'destination');
      assert.equal(points[2].sequence, 2);
      assert.equal(points[2].orders?.length, 1);
    });

    it('falls back to unique sequential marker numbers when optimizedSequence is invalid', () => {
      const route: TripRouteResponse = {
        tripId: 'test-invalid-sequence',
        totalDistanceMeters: 0,
        totalDurationSeconds: 0,
        origin: { address: 'Kho A', lat: 10, lon: 106 },
        destination: { address: 'Điểm cuối', lat: 10.3, lon: 106.3 },
        waypointOrder: [],
        optimizedStops: [
          {
            stopId: 's1', optimizedSequence: 1, address: 'Điểm 1', lat: 10.1, lon: 106.1,
            orders: [], lpns: [],
          },
          {
            stopId: 's2', optimizedSequence: 1, address: 'Điểm 2', lat: 10.2, lon: 106.2,
            orders: [], lpns: [],
          },
        ],
      };

      const destinations = buildRoutePoints(route).filter((point) => point.type !== 'origin');
      assert.deepEqual(destinations.map((point) => point.sequence), [1, 2, 3]);
    });

    it('deduplicates matching locationId even when the coordinates differ slightly', () => {
      const route: TripRouteResponse = {
        tripId: 'test-location-id-dedup',
        totalDistanceMeters: 0,
        totalDurationSeconds: 0,
        waypointOrder: [],
        optimizedStops: [
          {
            stopId: 's1', locationId: 'shared-location', optimizedSequence: 1,
            address: 'Điểm giao', lat: 10.1, lon: 106.1, orders: [], lpns: [],
          },
        ],
        destination: {
          locationId: 'shared-location', address: 'Điểm cuối', lat: 10.10001, lon: 106.10001,
        },
      };

      const points = buildRoutePoints(route);
      assert.equal(points.length, 1);
      assert.equal(points[0].type, 'destination');
      assert.equal(points[0].sequence, 1);
    });

    it('should filter out invalid coordinates', () => {
      assert.equal(isValidMapCoordinate(10.8, 106.6), true);
      assert.equal(isValidMapCoordinate(95.0, 106.6), false); // lat > 90
      assert.equal(isValidMapCoordinate(10.8, 200.0), false); // lon > 180
      assert.equal(isValidMapCoordinate(NaN, 106.6), false);
      assert.equal(isValidMapCoordinate(null, 106.6), false);
    });
  });

  describe('5. Polyline Decoding & Caching', () => {
    it('should decode valid polyline correctly', () => {
      // Polyline for coordinates [[-120.2, 38.5], [-120.95, 40.7], [-126.453, 43.252]]
      const encoded = '_p~iF~ps|U_ulLnnqC_mqNvxq`@';
      const coords = decodePolyline(encoded);
      assert.ok(coords.length >= 2);
      assert.equal(coords[0][0], -120.2);
      assert.equal(coords[0][1], 38.5);
    });

    it('should handle null/empty polyline safely without crashing', () => {
      assert.deepEqual(decodePolyline(''), []);
      assert.deepEqual(decodePolyline(null), []);
      assert.deepEqual(decodePolyline(undefined), []);
    });
  });
});
