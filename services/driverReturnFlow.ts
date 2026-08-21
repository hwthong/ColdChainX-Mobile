export type DeliveryStopProgress = {
  stopId: string;
  stopType?: string | null;
  status?: string | null;
};

const FINISHED_DELIVERY_STOP_STATUSES = new Set([
  'CANCELLED',
  'COMPLETED',
  'DELIVERED',
  'DEPARTED',
  'FAILED_DELIVERY',
  'SKIPPED',
  'SKIPPED_NOSHOW',
]);

export function hasRemainingDeliveryStops(
  stops: DeliveryStopProgress[],
  currentStopId?: string | null
) {
  return stops.some((stop) => {
    if (stop.stopId === currentStopId) return false;
    if ((stop.stopType || '').toUpperCase() !== 'DELIVERY') return false;
    return !FINISHED_DELIVERY_STOP_STATUSES.has((stop.status || '').toUpperCase());
  });
}

export function tripHasNoShowStop(stops: DeliveryStopProgress[]) {
  return stops.some((stop) => (stop.status || '').toUpperCase() === 'SKIPPED_NOSHOW');
}
