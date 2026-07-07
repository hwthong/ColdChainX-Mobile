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

// ---------------------------------------------------------------------------
// Inbound (Hub Drop-off) Timeline
// ---------------------------------------------------------------------------

/**
 * Xây dựng timeline giai đoạn nhập kho Hub dựa trên trạng thái order và phụ lục.
 *
 * @param orderStatus  - Trạng thái đơn hàng từ backend (ORDER_STATUS enum)
 * @param appendixStatus - Trạng thái phụ lục nếu có (ContractAppendixResponse.status)
 */
export function buildInboundTimeline(
  orderStatus: string,
  appendixStatus?: string | null
): TimelineStep[] {
  const status = normalizeStatus(orderStatus);
  const appendix = normalizeStatus(appendixStatus ?? '');

  // Các trạng thái sau khi hàng đã xuất kho (inbound hoàn tất)
  const isPostWarehouse = ['ASSIGNED', 'IN_TRANSIT', 'DELIVERED'].includes(status);

  if (isPostWarehouse || status === 'IN_WAREHOUSE' || status === 'IN_STOCK') {
    return buildAllDoneSteps();
  }

  if (status === 'RETURN_PENDING') {
    return buildReturnPendingSteps();
  }

  if (status === 'DISCREPANCY_HOLD') {
    return buildDiscrepancySteps(appendix);
  }

  // RECEIVING + EXECUTED appendix => phụ lục đã giải quyết, tiếp tục nhập kho
  if (status === 'RECEIVING' && appendix === 'EXECUTED') {
    return buildPostExecuteSteps();
  }

  // RECEIVING bình thường (không có discrepancy hoặc appendix đã xong)
  if (status === 'RECEIVING') {
    return buildNormalReceivingSteps();
  }

  // Các trạng thái trước khi hàng đến Hub
  // (PENDING_REVIEW, APPROVED, QUOTING, CONTRACT_PENDING, CONTRACT_SIGNED, ...)
  return buildPreHubSteps();
}

// ---------------------------------------------------------------------------
// Private step builders
// ---------------------------------------------------------------------------

/** Các bước cơ sở (luôn có trong mọi trường hợp) */
function baseSteps(): Omit<TimelineStep, 'state'>[] {
  return [
    {
      key: 'waiting-dropoff',
      title: 'Chờ khách giao hàng',
      description: 'Khách chuẩn bị hàng và mang đến Hub ColdChainX.',
    },
    {
      key: 'arrived-hub',
      title: 'Đã đến Hub',
      description: 'Nhân viên Hub xác nhận nhận hàng tại cổng nhập.',
    },
    {
      key: 'qc-checking',
      title: 'Kiểm tra QC',
      description: 'Nhân viên kho kiểm tra bao bì, hình ảnh và điều kiện bảo quản lạnh.',
    },
    {
      key: 'measuring',
      title: 'Đo khối lượng / thể tích thực tế',
      description: 'Kho đo khối lượng và thể tích thực tế trước khi hoàn tất phiếu nhập.',
    },
  ];
}

/** Case A: flow bình thường, chưa đến Hub */
function buildPreHubSteps(): TimelineStep[] {
  const steps = baseSteps();
  return [
    { ...steps[0], state: 'current' },
    { ...steps[1], state: 'pending' },
    { ...steps[2], state: 'pending' },
    { ...steps[3], state: 'pending' },
    {
      key: 'in-warehouse',
      title: 'Đã nhập kho',
      description: 'Hàng đã được lưu trong kho lạnh và chờ điều phối xuất kho.',
      state: 'pending',
    },
  ];
}

/** Case A: RECEIVING bình thường không có discrepancy */
function buildNormalReceivingSteps(): TimelineStep[] {
  const steps = baseSteps();
  return [
    { ...steps[0], state: 'done' },
    { ...steps[1], state: 'done' },
    { ...steps[2], state: 'done' },
    { ...steps[3], state: 'current' },
    {
      key: 'in-warehouse',
      title: 'Đã nhập kho',
      description: 'Hàng đã được lưu trong kho lạnh và chờ điều phối xuất kho.',
      state: 'pending',
    },
  ];
}

/** Case E: IN_WAREHOUSE hoặc IN_STOCK — toàn bộ inbound done */
function buildAllDoneSteps(): TimelineStep[] {
  const steps = baseSteps();
  return [
    { ...steps[0], state: 'done' },
    { ...steps[1], state: 'done' },
    { ...steps[2], state: 'done' },
    { ...steps[3], state: 'done' },
    {
      key: 'in-warehouse',
      title: 'Đã nhập kho',
      description: 'Hàng đã được lưu trong kho lạnh và chờ điều phối xuất kho.',
      state: 'done',
    },
  ];
}

/** Case B/C/D/F: DISCREPANCY_HOLD, phân nhánh theo appendixStatus */
function buildDiscrepancySteps(appendix: string): TimelineStep[] {
  const steps = baseSteps();

  const discrepancyStep: Omit<TimelineStep, 'state'> = {
    key: 'discrepancy-found',
    title: 'Phát hiện chênh lệch QC',
    description: 'Hàng thực tế có chênh lệch so với khai báo ban đầu. Vui lòng xem và xác nhận phụ lục điều chỉnh cước.',
  };

  // Case B: DRAFT or SENT
  if (appendix === '' || appendix === 'DRAFT') {
    return [
      { ...steps[0], state: 'done' },
      { ...steps[1], state: 'done' },
      { ...steps[2], state: 'done' },
      { ...steps[3], state: 'done' },
      { ...discrepancyStep, state: 'issue' },
      {
        key: 'waiting-appendix-confirm',
        title: 'Chờ khách xác nhận phụ lục',
        description: 'Phụ lục điều chỉnh cước đang được chuẩn bị. Vui lòng chờ Sales gửi phụ lục.',
        state: 'pending',
      },
      {
        key: 'in-warehouse',
        title: 'Đã nhập kho',
        description: 'Hàng đã được lưu trong kho lạnh và chờ điều phối xuất kho.',
        state: 'pending',
      },
    ];
  }

  if (appendix === 'SENT') {
    return [
      { ...steps[0], state: 'done' },
      { ...steps[1], state: 'done' },
      { ...steps[2], state: 'done' },
      { ...steps[3], state: 'done' },
      { ...discrepancyStep, state: 'done' },
      {
        key: 'waiting-appendix-confirm',
        title: 'Chờ khách xác nhận phụ lục',
        description: 'Phụ lục điều chỉnh cước đã được gửi. Vui lòng xem và xác nhận để tiếp tục nhập kho.',
        state: 'current',
      },
      {
        key: 'in-warehouse',
        title: 'Đã nhập kho',
        description: 'Hàng đã được lưu trong kho lạnh và chờ điều phối xuất kho.',
        state: 'pending',
      },
    ];
  }

  // Case C: ACCEPTED — chờ Sales execute
  if (appendix === 'ACCEPTED') {
    return [
      { ...steps[0], state: 'done' },
      { ...steps[1], state: 'done' },
      { ...steps[2], state: 'done' },
      { ...steps[3], state: 'done' },
      { ...discrepancyStep, state: 'done' },
      {
        key: 'appendix-accepted',
        title: 'Đã chấp nhận phụ lục',
        description: 'Bạn đã chấp nhận phụ lục điều chỉnh cước. Đơn hàng đang chờ Sales xác nhận để tiếp tục nhập kho.',
        state: 'done',
      },
      {
        key: 'waiting-sales-execute',
        title: 'Chờ Sales xử lý nhập kho',
        description: 'Bạn đã chấp nhận phụ lục điều chỉnh cước. Đơn hàng đang chờ Sales xác nhận để tiếp tục nhập kho.',
        state: 'current',
      },
      {
        key: 'in-warehouse',
        title: 'Đã nhập kho',
        description: 'Hàng đã được lưu trong kho lạnh và chờ điều phối xuất kho.',
        state: 'pending',
      },
    ];
  }

  // Case F: REJECTED (order=DISCREPANCY_HOLD nhưng appendix đã rejected — trước khi order chuyển RETURN_PENDING)
  if (appendix === 'REJECTED') {
    return [
      { ...steps[0], state: 'done' },
      { ...steps[1], state: 'done' },
      { ...steps[2], state: 'done' },
      { ...steps[3], state: 'done' },
      { ...discrepancyStep, state: 'done' },
      {
        key: 'appendix-rejected',
        title: 'Khách từ chối phụ lục',
        description: 'Bạn đã từ chối phụ lục. Đơn hàng đang chờ xử lý hoàn trả.',
        state: 'issue',
      },
      {
        key: 'return-pending',
        title: 'Chờ hoàn trả hàng',
        description: 'Đơn hàng đang được xử lý hoàn trả.',
        state: 'current',
      },
    ];
  }

  // Fallback: discrepancy, appendix ở trạng thái không xác định
  return [
    { ...steps[0], state: 'done' },
    { ...steps[1], state: 'done' },
    { ...steps[2], state: 'done' },
    { ...steps[3], state: 'done' },
    { ...discrepancyStep, state: 'issue' },
    {
      key: 'in-warehouse',
      title: 'Đã nhập kho',
      description: 'Hàng đã được lưu trong kho lạnh và chờ điều phối xuất kho.',
      state: 'pending',
    },
  ];
}

/** Case D: RECEIVING + appendix EXECUTED — phụ lục đã giải quyết, tiếp tục nhập kho */
function buildPostExecuteSteps(): TimelineStep[] {
  const steps = baseSteps();
  return [
    { ...steps[0], state: 'done' },
    { ...steps[1], state: 'done' },
    { ...steps[2], state: 'done' },
    { ...steps[3], state: 'done' },
    {
      key: 'discrepancy-found',
      title: 'Phát hiện chênh lệch QC',
      description: 'Hàng thực tế có chênh lệch so với khai báo ban đầu.',
      state: 'done',
    },
    {
      key: 'appendix-executed',
      title: 'Phụ lục đã xử lý',
      description: 'Phụ lục đã được xử lý. Kho tiếp tục thực hiện nhập hàng và cất hàng.',
      state: 'done',
    },
    {
      key: 'continuing-receiving',
      title: 'Tiếp tục nhập kho',
      description: 'Phụ lục đã được xử lý. Kho tiếp tục thực hiện nhập hàng và cất hàng.',
      state: 'current',
    },
    {
      key: 'in-warehouse',
      title: 'Đã nhập kho',
      description: 'Hàng đã được lưu trong kho lạnh và chờ điều phối xuất kho.',
      state: 'pending',
    },
  ];
}

/** Case F (order=RETURN_PENDING): Customer đã từ chối appendix */
function buildReturnPendingSteps(): TimelineStep[] {
  const steps = baseSteps();
  return [
    { ...steps[0], state: 'done' },
    { ...steps[1], state: 'done' },
    { ...steps[2], state: 'done' },
    { ...steps[3], state: 'done' },
    {
      key: 'discrepancy-found',
      title: 'Phát hiện chênh lệch QC',
      description: 'Hàng thực tế có chênh lệch so với khai báo ban đầu.',
      state: 'done',
    },
    {
      key: 'appendix-rejected',
      title: 'Khách từ chối phụ lục',
      description: 'Bạn đã từ chối phụ lục. Đơn hàng đang chờ xử lý hoàn trả.',
      state: 'issue',
    },
    {
      key: 'return-pending',
      title: 'Chờ hoàn trả hàng',
      description: 'Đơn hàng đang được xử lý hoàn trả.',
      state: 'current',
    },
  ];
}

// ---------------------------------------------------------------------------
// Dispatch & Load Planning Timeline
// ---------------------------------------------------------------------------

/** Xây dựng timeline giai đoạn điều phối xuất kho. */
export function buildDispatchTimeline(orderStatus: string): TimelineStep[] {
  const status = normalizeStatus(orderStatus);
  const isAssigned = ['ASSIGNED', 'IN_TRANSIT', 'DELIVERED'].includes(status);
  const isInTransit = ['IN_TRANSIT', 'DELIVERED'].includes(status);

  return [
    {
      key: 'waiting-dispatch',
      title: 'Chờ điều phối',
      description: 'Đơn hàng đang chờ gom tuyến và lập kế hoạch xe.',
      state: isAssigned || isInTransit ? 'done' : 'current',
    },
    {
      key: 'trip-planned',
      title: 'Đã lập chuyến',
      description: 'Dispatcher đã phân công kiện hàng vào chuyến xe.',
      state: isAssigned || isInTransit ? 'done' : 'pending',
    },
    {
      key: 'picking',
      title: 'Đang lấy hàng',
      description: 'Kho lấy hàng theo trình tự LIFO theo điểm giao.',
      state: isInTransit ? 'done' : isAssigned ? 'current' : 'pending',
    },
    {
      key: 'loading-completed',
      title: 'Đã xếp xe',
      description: 'Hàng đã được xếp lên xe và seal niêm phong trước khi xuất bến.',
      state: isInTransit ? 'done' : 'pending',
    },
    {
      key: 'dispatched',
      title: 'Đã xuất bến',
      description: 'Xe đã rời kho Hub và đang vận chuyển đến điểm giao.',
      state: isInTransit ? 'current' : 'pending',
    },
  ];
}

// ---------------------------------------------------------------------------
// Mock data (TODO: thay bằng API thật khi có)
// ---------------------------------------------------------------------------

// TODO: replace mock tracking data with real IoT/tracking API
export const mockTrackingData: TrackingSnapshot = {
  currentTemperatureC: -6.2,
  humidityPercent: 74,
  currentLocation: 'QL1A, Bình Chánh, TP.HCM',
  gpsStatus: 'Tín hiệu GPS ổn định',
  geoFenceStatus: 'Trong hành lang cold-route đã lập',
  smartAlert: 'Nhiệt độ trong ngưỡng an toàn đã cài đặt.',
};

// TODO: replace mock tracking data with real IoT/tracking API
export const mockTemperatureLogs: TemperatureLog[] = [
  { time: '08:00', temperatureC: -6.1, humidityPercent: 73, note: 'Tiền làm lạnh Hub hoàn tất' },
  { time: '09:00', temperatureC: -6.4, humidityPercent: 74, note: 'Ổn định trong quá trình xếp hàng' },
  { time: '10:00', temperatureC: -6.2, humidityPercent: 74, note: 'Xe đang vận chuyển' },
  { time: '11:00', temperatureC: -5.9, humidityPercent: 75, note: 'Trong ngưỡng chấp nhận' },
];

// TODO: replace mock tracking data with real IoT/tracking API
export const mockAlertLogs: TrackingAlert[] = [
  {
    id: 'mock-alert-1',
    title: 'Dây chuyền lạnh ổn định',
    message: 'Không phát hiện vượt ngưỡng nhiệt độ trong chu kỳ giám sát gần nhất.',
    severity: 'success',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'mock-alert-2',
    title: 'Seal xe đang giám sát',
    message: 'Seal container vẫn hợp lệ. Không có sự kiện mở cửa bất thường.',
    severity: 'info',
    createdAt: new Date().toISOString(),
  },
];

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function normalizeStatus(status: string): string {
  return status.trim().toUpperCase();
}
