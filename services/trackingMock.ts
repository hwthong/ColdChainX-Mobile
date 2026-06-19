export type TimelineStepState = 'done' | 'current' | 'pending' | 'issue';

export interface TimelineStep {
  key: string;
  title: string;
  description: string;
  state: TimelineStepState;
}

export interface TemperatureLog {
  time: string;
  temperatureC: number;
  humidityPercent: number;
  note: string;
}

export interface TrackingSnapshot {
  currentTemperatureC: number;
  humidityPercent: number;
  currentLocation: string;
  gpsStatus: string;
  geoFenceStatus: string;
  smartAlert: string;
}

export interface TrackingAlert {
  id: string;
  title: string;
  message: string;
  severity: 'info' | 'warning' | 'success';
  createdAt: string;
}

// TODO: replace inbound timeline with real warehouse receipt status API when available
export function buildInboundTimeline(orderStatus: string): TimelineStep[] {
  const status = normalizeStatus(orderStatus);
  const warehouseDone = ['ASSIGNED', 'IN_TRANSIT', 'DELIVERED'].includes(status);
  const contractDone = ['CONTRACT_PENDING', 'ASSIGNED', 'IN_TRANSIT', 'DELIVERED'].includes(status);

  return [
    {
      key: 'waiting-dropoff',
      title: 'Waiting for drop-off',
      description: 'Customer prepares goods and brings the shipment to the ColdChainX hub.',
      state: warehouseDone || contractDone ? 'done' : 'current',
    },
    {
      key: 'arrived-hub',
      title: 'Arrived at hub',
      description: 'Hub team confirms handoff at the inbound gate.',
      state: warehouseDone ? 'done' : contractDone ? 'current' : 'pending',
    },
    {
      key: 'qc-checking',
      title: 'QC checking',
      description: 'Warehouse staff checks packaging, image, and cold-chain readiness.',
      state: warehouseDone ? 'done' : 'pending',
    },
    {
      key: 'measuring',
      title: 'Measuring actual weight/CBM',
      description: 'Actual weight and CBM are measured before warehouse receipt completion.',
      state: warehouseDone ? 'done' : 'pending',
    },
    {
      key: 'in-warehouse',
      title: 'In warehouse',
      description: 'Shipment is stored in the cold hub while waiting for dispatch.',
      state: warehouseDone ? 'done' : 'pending',
    },
  ];
}

// TODO: connect real dispatch/trip status when customer tracking endpoint is available
export function buildDispatchTimeline(orderStatus: string): TimelineStep[] {
  const status = normalizeStatus(orderStatus);
  const assigned = ['ASSIGNED', 'IN_TRANSIT', 'DELIVERED'].includes(status);
  const transit = ['IN_TRANSIT', 'DELIVERED'].includes(status);

  return [
    {
      key: 'waiting-dispatch',
      title: 'Waiting for dispatch',
      description: 'Order is waiting for route consolidation and vehicle planning.',
      state: assigned || transit ? 'done' : 'current',
    },
    {
      key: 'trip-planned',
      title: 'Trip planned',
      description: 'Dispatcher assigns the shipment to a planned trip.',
      state: assigned || transit ? 'done' : 'pending',
    },
    {
      key: 'loading',
      title: 'Loading',
      description: 'Warehouse loads goods with LIFO sequence for delivery stops.',
      state: transit ? 'done' : assigned ? 'current' : 'pending',
    },
    {
      key: 'sealed',
      title: 'Sealed',
      description: 'Vehicle/container seal is recorded before departure.',
      state: transit ? 'done' : 'pending',
    },
    {
      key: 'documents-issued',
      title: 'Documents issued',
      description: 'Dispatch documents and trip paperwork are issued.',
      state: transit ? 'done' : 'pending',
    },
    {
      key: 'ready-transit',
      title: 'Ready for transit',
      description: 'Shipment is ready to leave the hub.',
      state: transit ? 'current' : 'pending',
    },
  ];
}

// TODO: replace mock tracking data with real IoT/tracking API
export const mockTrackingData: TrackingSnapshot = {
  currentTemperatureC: -6.2,
  humidityPercent: 74,
  currentLocation: 'QL1A, Binh Chanh, TP.HCM',
  gpsStatus: 'GPS signal stable',
  geoFenceStatus: 'Inside planned cold-route corridor',
  smartAlert: 'Temperature is within the configured safe range.',
};

// TODO: replace mock tracking data with real IoT/tracking API
export const mockTemperatureLogs: TemperatureLog[] = [
  { time: '08:00', temperatureC: -6.1, humidityPercent: 73, note: 'Hub pre-cooling completed' },
  { time: '09:00', temperatureC: -6.4, humidityPercent: 74, note: 'Stable during loading' },
  { time: '10:00', temperatureC: -6.2, humidityPercent: 74, note: 'Vehicle in transit' },
  { time: '11:00', temperatureC: -5.9, humidityPercent: 75, note: 'Within accepted range' },
];

// TODO: replace mock tracking data with real IoT/tracking API
export const mockAlertLogs: TrackingAlert[] = [
  {
    id: 'mock-alert-1',
    title: 'Cold-chain stable',
    message: 'No temperature excursion detected in the latest monitoring window.',
    severity: 'success',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'mock-alert-2',
    title: 'Door seal monitored',
    message: 'Container seal remains valid. No unexpected door-open event.',
    severity: 'info',
    createdAt: new Date().toISOString(),
  },
];

function normalizeStatus(status: string) {
  return status.trim().toUpperCase();
}
