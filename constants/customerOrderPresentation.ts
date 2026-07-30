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
  DISCREPANCY_HOLD: { label: 'Chờ xử lý sai lệch', containerClass: 'bg-amber-100 border-amber-200', textClass: 'text-amber-800' },
  RETURN_PENDING: { label: 'Chờ hoàn trả', containerClass: 'bg-red-100 border-red-200', textClass: 'text-red-800' },
  RETURNED: { label: 'Đã hoàn trả', containerClass: 'bg-red-100 border-red-200', textClass: 'text-red-800' },
  REJECTED: { label: 'Từ chối', containerClass: 'bg-red-100 border-red-200', textClass: 'text-red-800' },
  CANCELLED: { label: 'Đã hủy', containerClass: 'bg-red-100 border-red-200', textClass: 'text-red-800' },
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

export function getCustomerOrderCategoryLabel(category?: string | null): string | null {
  const normalizedCategory = category?.trim().toUpperCase();
  return normalizedCategory ? CATEGORY_LABELS[normalizedCategory] ?? null : null;
}
