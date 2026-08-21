import assert from 'node:assert/strict';
import test from 'node:test';

import {
  canCloseDriverShift,
  getVisibleReturnWarehouses,
  hasRemainingDeliveryStops,
  tripHasNoShowStop,
} from '../driverReturnFlow';

test('only unfinished delivery stops block closing the shift', () => {
  const stops = [
    { stopId: 'pickup', stopType: 'PICKUP', status: 'PLANNED' },
    { stopId: 'current', stopType: 'DELIVERY', status: 'SKIPPED_NOSHOW' },
    { stopId: 'finished', stopType: 'DELIVERY', status: 'DEPARTED' },
    { stopId: 'next', stopType: 'DELIVERY', status: 'PLANNED' },
  ];

  assert.equal(hasRemainingDeliveryStops(stops, 'current'), true);
  assert.equal(
    hasRemainingDeliveryStops(
      stops.map((stop) => stop.stopId === 'next' ? { ...stop, status: 'DEPARTED' } : stop),
      'current'
    ),
    false
  );
});

test('no-show state is restored from Backend trip stops', () => {
  assert.equal(
    tripHasNoShowStop([
      { stopId: 'first', stopType: 'DELIVERY', status: 'SKIPPED_NOSHOW' },
      { stopId: 'last', stopType: 'DELIVERY', status: 'ARRIVED' },
    ]),
    true
  );
});

test('an unfinished earlier delivery stop also blocks closing the shift', () => {
  assert.equal(
    hasRemainingDeliveryStops([
      { stopId: 'unfinished-earlier-stop', stopType: 'DELIVERY', status: 'ARRIVED' },
      { stopId: 'current-last-stop', stopType: 'DELIVERY', status: 'DEPARTED' },
    ], 'current-last-stop'),
    true
  );
});

test('return warehouse list shows five nearest items before expanding', () => {
  const warehouses = Array.from({ length: 8 }, (_, index) => `warehouse-${index + 1}`);

  assert.deepEqual(
    getVisibleReturnWarehouses(warehouses, false),
    warehouses.slice(0, 5)
  );
  assert.deepEqual(getVisibleReturnWarehouses(warehouses, true), warehouses);
});

test('closing the shift is forbidden until the final order and stop are complete', () => {
  const completedOrderState = {
    allOrdersHandedOver: true,
    allPaymentsReady: true,
    tripStatus: 'IN_TRANSIT',
  };

  assert.equal(canCloseDriverShift({
    ...completedOrderState,
    hasRemainingStops: true,
  }), false);
  assert.equal(canCloseDriverShift({
    ...completedOrderState,
    hasRemainingStops: false,
  }), true);
});
