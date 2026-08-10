type StatusPresentation = {
  label: string;
  containerClass: string;
  textClass: string;
};

const DEFAULT_STATUS_PRESENTATION: StatusPresentation = {
  label: 'Đang cập nhật',
  containerClass: 'bg-gray-100 border-gray-200',
  textClass: 'text-gray-800',
};

const STATUS_PRESENTATIONS: Record<string, StatusPresentation> = {
  PENDING: { label: 'Chờ duyệt', containerClass: 'bg-yellow-100 border-yellow-200', textClass: 'text-yellow-800' },
  PENDING_REVIEW: { label: 'Chờ duyệt', containerClass: 'bg-yellow-100 border-yellow-200', textClass: 'text-yellow-800' },
  QUOTING: { label: 'Đang báo giá', containerClass: 'bg-orange-100 border-orange-200', textClass: 'text-orange-800' },
  SENT: { label: 'Đã gửi', containerClass: 'bg-orange-100 border-orange-200', textClass: 'text-orange-800' },
  CONTRACT_PENDING: { label: 'Chờ hợp đồng', containerClass: 'bg-amber-100 border-amber-200', textClass: 'text-amber-800' },
  PENDING_CUSTOMER_SIGNATURE: { label: 'Chờ ký', containerClass: 'bg-orange-100 border-orange-200', textClass: 'text-orange-800' },
  PENDING_SALES_VERIFICATION: { label: 'Chờ Sales xác nhận', containerClass: 'bg-blue-100 border-blue-200', textClass: 'text-blue-800' },
  CONTRACT_SIGNED: { label: 'Đã ký hợp đồng', containerClass: 'bg-emerald-100 border-emerald-200', textClass: 'text-emerald-800' },
  ACTIVE: { label: 'Đã xác nhận', containerClass: 'bg-green-100 border-green-200', textClass: 'text-green-800' },
  ACCEPTED: { label: 'Đã chấp nhận', containerClass: 'bg-green-100 border-green-200', textClass: 'text-green-800' },
  EXECUTED: { label: 'Đã xử lý', containerClass: 'bg-green-100 border-green-200', textClass: 'text-green-800' },
  ASSIGNED: { label: 'Đã phân xe', containerClass: 'bg-blue-100 border-blue-200', textClass: 'text-blue-800' },
  LOADING: { label: 'Đang chuẩn bị xuất kho', containerClass: 'bg-blue-100 border-blue-200', textClass: 'text-blue-800' },
  SEALED: { label: 'Đã niêm phong', containerClass: 'bg-indigo-100 border-indigo-200', textClass: 'text-indigo-800' },
  DISPATCHED: { label: 'Đã điều phối', containerClass: 'bg-indigo-100 border-indigo-200', textClass: 'text-indigo-800' },
  DISPATCHED_PENDING: { label: 'Chờ điều phối', containerClass: 'bg-indigo-100 border-indigo-200', textClass: 'text-indigo-800' },
  IN_TRANSIT: { label: 'Đang vận chuyển', containerClass: 'bg-purple-100 border-purple-200', textClass: 'text-purple-800' },
  DELAYED: { label: 'Chậm tiến độ', containerClass: 'bg-red-100 border-red-200', textClass: 'text-red-800' },
  RECEIVING: { label: 'Đang nhập kho', containerClass: 'bg-green-100 border-green-200', textClass: 'text-green-800' },
  DELIVERED: { label: 'Đã giao', containerClass: 'bg-green-100 border-green-200', textClass: 'text-green-800' },
  PARTIALLY_DELIVERED: { label: 'Đã giao một phần', containerClass: 'bg-green-100 border-green-200', textClass: 'text-green-800' },
  PARTIAL_DELIVER_OSD: { label: 'Đã giao một phần, đang kiểm tra sai lệch', containerClass: 'bg-orange-100 border-orange-200', textClass: 'text-orange-800' },
  DELIVERY_RETURNED: { label: 'Đang hoàn hàng về kho', containerClass: 'bg-red-100 border-red-200', textClass: 'text-red-800' },
  READY_FOR_ROUTING: { label: 'Đang chờ sắp xếp chuyến mới', containerClass: 'bg-blue-100 border-blue-200', textClass: 'text-blue-800' },
  DISCREPANCY_HOLD: { label: 'Đang chờ kiểm tra hàng hóa', containerClass: 'bg-amber-100 border-amber-200', textClass: 'text-amber-800' },
  OSD_CLAIM_REJECTED_BY_DISPATCHER: { label: 'Yêu cầu bồi thường không được chấp thuận', containerClass: 'bg-red-100 border-red-200', textClass: 'text-red-800' },
  OSD_REJECT_PENDING: { label: 'Đang xử lý hàng bị từ chối', containerClass: 'bg-red-100 border-red-200', textClass: 'text-red-800' },
  OSD_DOCK_PENDING: { label: 'Đang kiểm tra hàng tại điểm giao', containerClass: 'bg-orange-100 border-orange-200', textClass: 'text-orange-800' },
  DELIVERY_FAILED_NOSHOW: { label: 'Giao hàng chưa thành công do không có người nhận', containerClass: 'bg-red-100 border-red-200', textClass: 'text-red-800' },
  RETURN_PENDING: { label: 'Chờ hoàn trả', containerClass: 'bg-red-100 border-red-200', textClass: 'text-red-800' },
  RETURNED: { label: 'Đã hoàn trả', containerClass: 'bg-red-100 border-red-200', textClass: 'text-red-800' },
  REJECTED: { label: 'Từ chối', containerClass: 'bg-red-100 border-red-200', textClass: 'text-red-800' },
  CANCELLED: { label: 'Đã hủy', containerClass: 'bg-red-100 border-red-200', textClass: 'text-red-800' },
};

const CONTRACT_STATUS_PRESENTATIONS: Record<string, StatusPresentation> = {
  PENDING_CUSTOMER_SIGNATURE: { label: 'Chờ khách hàng ký', containerClass: 'bg-amber-100 border-amber-200', textClass: 'text-amber-800' },
  PENDING_SALES_VERIFICATION: { label: 'Chờ Sales xác nhận', containerClass: 'bg-blue-100 border-blue-200', textClass: 'text-blue-800' },
  ACTIVE: { label: 'Đã xác nhận', containerClass: 'bg-green-100 border-green-200', textClass: 'text-green-800' },
  VERIFIED: { label: 'Đã xác nhận', containerClass: 'bg-green-100 border-green-200', textClass: 'text-green-800' },
  REJECTED: { label: 'Cần ký lại', containerClass: 'bg-red-100 border-red-200', textClass: 'text-red-800' },
  DRAFT: { label: 'Đang soạn', containerClass: 'bg-gray-100 border-gray-200', textClass: 'text-gray-800' },
  PENDING_SIGNATURE: { label: 'Đang soạn', containerClass: 'bg-gray-100 border-gray-200', textClass: 'text-gray-800' },
};

const PACKAGING_LABELS: Record<string, string> = {
  'FOAM BOX': 'Thùng xốp giữ nhiệt',
  'FOAMBOX': 'Thùng xốp giữ nhiệt',
  'FOAM_BOX': 'Thùng xốp giữ nhiệt',
  'CARTON BOX': 'Thùng carton',
  'CARTONBOX': 'Thùng carton',
  'CARTON_BOX': 'Thùng carton',
  'PLASTIC BOX': 'Thùng nhựa',
  'PLASTICBOX': 'Thùng nhựa',
  'PLASTIC_BOX': 'Thùng nhựa',
  'PALLET': 'Pallet',
  'BAG': 'Bao',
};

const CITY_LABELS: Record<string, string> = {
  'HO CHI MINH CITY': 'TP. Hồ Chí Minh',
  'HO CHI MINH': 'TP. Hồ Chí Minh',
  'HOCHIMINH': 'TP. Hồ Chí Minh',
  'TP.HCM': 'TP. Hồ Chí Minh',
  'TP HCM': 'TP. Hồ Chí Minh',
  'DAK LAK': 'Đắk Lắk',
  'DAKLAK': 'Đắk Lắk',
  'HA NOI': 'Hà Nội',
  'HANOI': 'Hà Nội',
  'DA NANG': 'Đà Nẵng',
  'DANANG': 'Đà Nẵng',
  'CAN THO': 'Cần Thơ',
  'CANTHO': 'Cần Thơ',
};

const CATEGORY_LABELS: Record<string, string> = {
  FROZEN_FRUITS_VEGGIES: 'Rau củ, trái cây đông lạnh',
  PHARMACEUTICALS: 'Dược phẩm',
  MEAT_SEAFOOD: 'Thịt, hải sản',
};

export function getCustomerOrderStatusPresentation(status?: string | null): StatusPresentation {
  const normalizedStatus = status?.trim().toUpperCase();
  return normalizedStatus ? STATUS_PRESENTATIONS[normalizedStatus] ?? DEFAULT_STATUS_PRESENTATION : DEFAULT_STATUS_PRESENTATION;
}

export function getContractStatusPresentation(status?: string | null): StatusPresentation {
  const normalizedStatus = status?.trim().toUpperCase();
  return normalizedStatus ? CONTRACT_STATUS_PRESENTATIONS[normalizedStatus] ?? getCustomerOrderStatusPresentation(status) : DEFAULT_STATUS_PRESENTATION;
}

export function getPackagingLabel(packingType?: string | null): string {
  if (!packingType || !packingType.trim()) return 'Chưa cập nhật';
  const key = packingType.trim().toUpperCase();
  return PACKAGING_LABELS[key] ?? packingType.trim();
}

export function formatCityName(city?: string | null): string {
  if (!city || !city.trim()) return 'Chưa cập nhật';
  const key = city.trim().toUpperCase();
  return CITY_LABELS[key] ?? city.trim();
}

export function formatTransitDuration(duration?: string | null): string {
  if (!duration || !duration.trim()) return 'Chưa cập nhật';
  return duration.trim().replace(/\bhours?\b/gi, 'giờ').replace(/\bdays?\b/gi, 'ngày');
}

const CUSTOMER_NOTIFICATION_STATUS_CODES = [
  'OSD_CLAIM_REJECTED_BY_DISPATCHER',
  'DELIVERY_FAILED_NOSHOW',
  'DELIVERY_RETURNED',
  'READY_FOR_ROUTING',
  'DISCREPANCY_HOLD',
  'OSD_REJECT_PENDING',
  'OSD_DOCK_PENDING',
  'REJECTED',
];

export function localizeCustomerOrderStatusesInText(value: string): string {
  return CUSTOMER_NOTIFICATION_STATUS_CODES.reduce((localized, code) => {
    const label = STATUS_PRESENTATIONS[code]?.label;
    return label ? localized.replace(new RegExp(`\\b${code}\\b`, 'g'), label) : localized;
  }, value);
}

export function getCustomerOrderCategoryLabel(category?: string | null): string | null {
  const normalizedCategory = category?.trim().toUpperCase();
  return normalizedCategory ? CATEGORY_LABELS[normalizedCategory] ?? null : null;
}
