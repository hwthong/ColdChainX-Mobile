import { Ionicons } from '@expo/vector-icons';
import { NotificationResponse } from '../services/notificationApi';
import { OrderResponse } from '../services/orderApi';

export interface NotificationCardPresentation {
  title: string;
  description: string | null;
  categoryBadge: string;
  itemName: string | null;
  orderRef: string | null;
  importantValue: string | null;
  iconName: keyof typeof Ionicons.glyphMap;
  formattedTime: string;
}

export function getNotificationPresentation(
  notification: NotificationResponse,
  ordersMap: Map<string, OrderResponse>
): NotificationCardPresentation {
  const payloadRecord = getPayloadRecord(notification);
  const status = typeof payloadRecord?.status === 'string' ? payloadRecord.status : null;

  const orderId =
    notification.orderId ??
    (typeof payloadRecord?.orderId === 'string' ? payloadRecord.orderId : null) ??
    (typeof payloadRecord?.OrderId === 'string' ? payloadRecord.OrderId : null);

  const matchedOrder = orderId ? ordersMap.get(orderId.toLowerCase()) : null;

  const trackingCode = matchedOrder?.trackingCode ?? getTrackingCodeFromPayload(payloadRecord);
  const itemName = matchedOrder?.itemName ?? getItemNameFromPayload(payloadRecord);
  const orderRef = trackingCode ?? (orderId ? `Đơn ${orderId.slice(0, 8).toUpperCase()}` : null);

  const categoryInfo = getCategoryInfo(notification.type ?? notification.category, notification.title, notification.message);
  const content = normalizeContent(
    status,
    notification.type ?? notification.category,
    notification.title,
    notification.message ?? notification.content,
    payloadRecord
  );

  const formattedTime = formatNotificationTime(notification.createdAt);

  return {
    title: content.title,
    description: content.description,
    categoryBadge: categoryInfo.label,
    itemName,
    orderRef,
    importantValue: content.importantValue,
    iconName: categoryInfo.icon,
    formattedTime,
  };
}

export function formatNotificationTime(dateString?: string | null): string {
  if (!dateString || typeof dateString !== 'string') return 'Chưa cập nhật';

  let iso = dateString.trim();
  if (!iso) return 'Chưa cập nhật';

  if (!iso.endsWith('Z') && !/[+-]\d{2}:?\d{2}$/.test(iso)) {
    iso += 'Z';
  }

  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Chưa cập nhật';

  const now = new Date();
  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear();

  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const timeStr = `${hours}:${minutes}`;

  if (isToday) {
    return `Hôm nay · ${timeStr}`;
  }

  if (isYesterday) {
    return `Hôm qua · ${timeStr}`;
  }

  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year} · ${timeStr}`;
}

export function formatCurrencyVnd(amount?: number | string | null): string | null {
  if (amount === undefined || amount === null || amount === '') return null;
  const num = typeof amount === 'number' ? amount : parseFloat(String(amount).replace(/[^0-9.-]/g, ''));
  if (Number.isNaN(num) || num <= 0) return null;
  return new Intl.NumberFormat('vi-VN').format(num) + ' VNĐ';
}

function getCategoryInfo(
  type?: string | null,
  rawTitle?: string | null,
  rawMessage?: string | null
): { label: string; icon: keyof typeof Ionicons.glyphMap } {
  const text = `${type ?? ''} ${rawTitle ?? ''} ${rawMessage ?? ''}`.toUpperCase();

  if (text.includes('QUOTE') || text.includes('QUOTATION') || text.includes('BAO GIA')) {
    return { label: 'Báo giá', icon: 'receipt-outline' };
  }
  if (text.includes('CONTRACT') || text.includes('HOP DONG')) {
    return { label: 'Hợp đồng', icon: 'document-text-outline' };
  }
  if (text.includes('PAYMENT') || text.includes('INVOICE') || text.includes('THANH TOAN')) {
    return { label: 'Thanh toán', icon: 'card-outline' };
  }
  if (text.includes('INCIDENT_WORKFLOW')) {
    return { label: 'Quy trình cứu hộ', icon: 'warning-outline' };
  }
  if (text.includes('ALERT') || text.includes('INCIDENT') || text.includes('SU CO') || text.includes('CLAIM')) {
    return { label: 'Sự cố', icon: 'alert-circle-outline' };
  }
  if (text.includes('TRANSIT') || text.includes('DELIVERY') || text.includes('SHIPMENT') || text.includes('DISPATCH')) {
    return { label: 'Vận chuyển', icon: 'bus-outline' };
  }
  if (text.includes('ORDER')) {
    return { label: 'Cập nhật đơn hàng', icon: 'cube-outline' };
  }

  return { label: 'Thông báo', icon: 'notifications-outline' };
}

function normalizeContent(
  status: string | null,
  type?: string | null,
  rawTitle?: string | null,
  rawMessage?: string | null,
  payloadRecord?: Record<string, unknown> | null
): { title: string; description: string | null; importantValue: string | null } {
  const text = `${type ?? ''} ${status ?? ''} ${rawTitle ?? ''} ${rawMessage ?? ''}`.toUpperCase();

  const rawAmount: string | number | null =
    (typeof payloadRecord?.finalAmount === 'number' || typeof payloadRecord?.finalAmount === 'string' ? payloadRecord.finalAmount : null) ??
    (typeof payloadRecord?.final_amount === 'number' || typeof payloadRecord?.final_amount === 'string' ? payloadRecord.final_amount : null) ??
    (typeof payloadRecord?.amount === 'number' || typeof payloadRecord?.amount === 'string' ? payloadRecord.amount : null) ??
    extractAmountFromText(rawMessage);

  const importantValue = rawAmount ? formatCurrencyVnd(rawAmount) : null;

  // 0. INCIDENT WORKFLOW CASES
  if (type === 'INCIDENT_WORKFLOW' || text.includes('INCIDENT_WORKFLOW')) {
    return {
      title: rawTitle?.trim() || 'Cập nhật quy trình xử lý sự cố',
      description: rawMessage?.trim() || null,
      importantValue: null,
    };
  }

  // 1. QUOTATION CASES
  if (text.includes('QUOTE') || text.includes('QUOTATION') || text.includes('BAO GIA')) {
    return {
      title: 'Báo giá mới',
      description: null,
      importantValue,
    };
  }

  // 2. CONTRACT CASES
  if (text.includes('CONTRACT')) {
    if (text.includes('SIGNED') || text.includes('VERIFIED') || text.includes('ACTIVE') || text.includes('EXECUTED')) {
      return {
        title: 'Hợp đồng đã được xác nhận',
        description: null,
        importantValue: null,
      };
    }
    return {
      title: 'Hợp đồng cần xác nhận',
      description: 'Vui lòng kiểm tra và xác nhận.',
      importantValue: null,
    };
  }

  // 3. PAYMENT / INVOICE CASES
  if (text.includes('PAYMENT') || text.includes('INVOICE') || text.includes('THANH TOAN')) {
    return {
      title: 'Có cập nhật thanh toán',
      description: null,
      importantValue,
    };
  }

  // 4. INCIDENT / CLAIM CASES
  if (text.includes('ALERT') || text.includes('INCIDENT') || text.includes('SU CO') || text.includes('CLAIM')) {
    const customReason = getCustomIncidentReason(rawMessage);
    return {
      title: rawTitle?.trim() || 'Đơn hàng cần được xử lý',
      description: customReason,
      importantValue: null,
    };
  }

  // 5. STATUS SPECIFIC MATCHING FOR ORDERS
  const upperStatus = status?.toUpperCase();
  switch (upperStatus) {
    case 'PENDING':
    case 'PENDING_REVIEW':
      return {
        title: 'Đơn hàng đang chờ duyệt',
        description: null,
        importantValue: null,
      };
    case 'APPROVED':
      return {
        title: 'Đơn hàng đã được duyệt',
        description: null,
        importantValue: null,
      };
    case 'QUOTING':
    case 'SENT':
      return {
        title: 'Báo giá mới',
        description: null,
        importantValue,
      };
    case 'CONTRACT_PENDING':
    case 'PENDING_CUSTOMER_SIGNATURE':
      return {
        title: 'Hợp đồng cần xác nhận',
        description: 'Vui lòng kiểm tra và xác nhận.',
        importantValue: null,
      };
    case 'SCHEDULED':
    case 'DISPATCHED_PENDING':
    case 'ASSIGNED':
    case 'READY_FOR_ROUTING':
      return {
        title: 'Đã xác nhận lịch vận chuyển',
        description: null,
        importantValue: null,
      };
    case 'LOADING':
      return {
        title: 'Đơn hàng đang được xếp lên xe',
        description: null,
        importantValue: null,
      };
    case 'SEALED':
      return {
        title: 'Đơn hàng đã được niêm phong',
        description: null,
        importantValue: null,
      };
    case 'IN_TRANSIT':
    case 'DISPATCHED':
      return {
        title: 'Đơn hàng đang được vận chuyển',
        description: null,
        importantValue: null,
      };
    case 'DELIVERED':
      return {
        title: 'Đơn hàng đã giao thành công',
        description: null,
        importantValue: null,
      };
    case 'REJECTED':
    case 'CANCELLED':
      return {
        title: 'Đơn hàng bị từ chối',
        description: null,
        importantValue: null,
      };
    default:
      break;
  }

  // Fallback for general unaccented strings from database seed
  if (text.includes('DUOC DUYET') || text.includes('DA DUOC DUYET')) {
    return {
      title: 'Đơn hàng đã được duyệt',
      description: null,
      importantValue: null,
    };
  }

  const cleanTitle = sanitizeTitle(rawTitle);

  return {
    title: cleanTitle,
    description: null,
    importantValue,
  };
}

function getCustomIncidentReason(rawMessage?: string | null): string | null {
  if (!rawMessage || !rawMessage.trim()) return null;
  const msg = rawMessage.trim();
  if (
    msg === 'Trạng thái đơn hàng của bạn vừa thay đổi.' ||
    msg.includes('cua ban da duoc duyet') ||
    msg.toUpperCase().includes('ORDER_UPDATED')
  ) {
    return null;
  }
  return msg;
}

function extractAmountFromText(text?: string | null): string | null {
  if (!text) return null;
  const match = text.match(/(\d+[\d.,]*)\s*VND/i) ?? text.match(/:\s*(\d+[\d.,]*)/);
  return match ? match[1] : null;
}

function sanitizeTitle(rawTitle?: string | null): string {
  if (!rawTitle || !rawTitle.trim()) return 'Cập nhật đơn hàng';
  const clean = rawTitle.trim();
  if (clean === 'Đơn hàng đã được cập nhật' || clean.toUpperCase().includes('ORDER_UPDATED')) {
    return 'Cập nhật đơn hàng';
  }
  if (clean.includes('Co bao gia moi:')) {
    return 'Báo giá mới';
  }
  return clean;
}

function getPayloadRecord(notification: NotificationResponse): Record<string, unknown> | null {
  const raw = notification.payload ?? notification.data ?? notification.params;
  if (!raw) return null;

  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : null;
    } catch {
      return null;
    }
  }

  if (typeof raw === 'object') {
    return raw as Record<string, unknown>;
  }

  return null;
}

function getTrackingCodeFromPayload(payloadRecord: Record<string, unknown> | null): string | null {
  if (!payloadRecord) return null;
  const tc = payloadRecord.trackingCode ?? payloadRecord.TrackingCode;
  return typeof tc === 'string' && tc.trim() ? tc.trim() : null;
}

function getItemNameFromPayload(payloadRecord: Record<string, unknown> | null): string | null {
  if (!payloadRecord) return null;
  const name = payloadRecord.itemName ?? payloadRecord.ItemName;
  return typeof name === 'string' && name.trim() ? name.trim() : null;
}

export function extractImageUrl(
  notificationOrText: NotificationResponse | string | null | undefined
): string | null {
  if (!notificationOrText) return null;

  if (typeof notificationOrText === 'object') {
    const payload = getPayloadRecord(notificationOrText);
    const candidate =
      payload?.receiptUrl ??
      payload?.ReceiptUrl ??
      payload?.receipt_url ??
      payload?.imageUrl ??
      payload?.ImageUrl ??
      payload?.image_url ??
      payload?.url ??
      payload?.Url;

    if (typeof candidate === 'string' && candidate.trim().startsWith('http')) {
      return candidate.trim();
    }

    const body = notificationOrText.body || notificationOrText.message || notificationOrText.content;
    return extractImageUrl(body);
  }

  const urlMatch = notificationOrText.match(
    /(https?:\/\/[^\s"'<>]+\.(?:jpg|jpeg|png|webp|gif|svg)(?:\?[^\s"'<>]*)?|https?:\/\/res\.cloudinary\.com\/[^\s"'<>]+)/i
  );

  if (urlMatch) {
    return urlMatch[0];
  }

  return null;
}

export function cleanNotificationBody(body: string | null | undefined): string {
  if (!body) return '';

  return body
    .replace(/(?:[.,;]?\s*)?Biên lai:\s*https?:\/\/[^\s]+/gi, '')
    .replace(/(?:[.,;]?\s*)?Hình ảnh:\s*https?:\/\/[^\s]+/gi, '')
    .replace(/(?:[.,;]?\s*)?Chứng từ:\s*https?:\/\/[^\s]+/gi, '')
    .replace(/https?:\/\/[^\s"'<>]+\.(?:jpg|jpeg|png|webp|gif|svg)(?:\?[^\s"'<>]*)?/gi, '')
    .replace(/https?:\/\/res\.cloudinary\.com\/[^\s"'<>]+/gi, '')
    .trim();
}

