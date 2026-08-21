import assert from 'node:assert/strict';
import test from 'node:test';

import {
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
