import { apiRequest } from './apiClient';

export interface NotificationResponse {
  notiId?: string;
  notificationId?: string;
  id?: string;
  userId?: string | null;
  senderId?: string | null;
  templateId?: string | null;
  title?: string | null;
  body?: string | null;
  message?: string | null;
  content?: string | null;
  type?: string | null;
  category?: string | null;
  params?: string | null;
  isRead?: boolean | null;
  readAt?: string | null;
  createdAt?: string | null;
  orderId?: string | null;
  data?: unknown;
  payload?: unknown;
}

export interface NotificationListResult {
  items: NotificationResponse[];
  totalRecords: number;
  totalPages?: number;
  currentPage?: number;
  pageNumber?: number;
  pageSize?: number;
}

export interface NotificationQueryOptions {
  unreadOnly?: boolean;
  pageNumber?: number;
  pageSize?: number;
}

interface PagedNotificationResponse {
  totalRecords?: number;
  totalCount?: number;
  totalPages?: number;
  currentPage?: number;
  pageNumber?: number;
  pageSize?: number;
  data?: NotificationResponse[];
  items?: NotificationResponse[];
}

interface ApiResponse<T> {
  success: boolean;
  message?: string | null;
  data?: T | null;
}

export async function getUserNotifications(
  accessToken: string,
  userId: string,
  options: NotificationQueryOptions = {}
) {
  const unreadOnly = options.unreadOnly ?? false;
  const pageNumber = options.pageNumber ?? 1;
  const pageSize = options.pageSize ?? 10;

  const response = await apiRequest<ApiResponse<PagedNotificationResponse | NotificationResponse[]>>(
    `/api/notifications/users/${userId}?unreadOnly=${unreadOnly}&pageNumber=${pageNumber}&pageSize=${pageSize}`,
    {
      method: 'GET',
      headers: getAuthHeaders(accessToken),
    }
  );

  return {
    ...response,
    data: parseNotificationList(response.data),
  };
}

export async function getNotificationById(accessToken: string, notificationId: string) {
  const response = await apiRequest<ApiResponse<NotificationResponse>>(`/api/notifications/${notificationId}`, {
    method: 'GET',
    headers: getAuthHeaders(accessToken),
  });

  return {
    ...response,
    data: response.data ? normalizeNotification(response.data) : response.data,
  };
}

export function markNotificationRead(accessToken: string, notificationId: string) {
  return apiRequest<ApiResponse<boolean>>(`/api/notifications/${notificationId}/read`, {
    method: 'PUT',
    headers: getAuthHeaders(accessToken),
  });
}

export function markAllNotificationsRead(accessToken: string, userId: string) {
  return apiRequest<ApiResponse<boolean>>(`/api/notifications/users/${userId}/read-all`, {
    method: 'PUT',
    headers: getAuthHeaders(accessToken),
  });
}

function parseNotificationList(data: PagedNotificationResponse | NotificationResponse[] | null | undefined) {
  if (Array.isArray(data)) {
    const items = data.map(normalizeNotification);

    return {
      items,
      totalRecords: items.length,
    } satisfies NotificationListResult;
  }

  const items = data?.data ?? data?.items ?? [];

  return {
    items: items.map(normalizeNotification),
    totalRecords: data?.totalRecords ?? data?.totalCount ?? items.length,
    totalPages: data?.totalPages,
    currentPage: data?.currentPage,
    pageNumber: data?.pageNumber,
    pageSize: data?.pageSize,
  } satisfies NotificationListResult;
}

function normalizeNotification(notification: NotificationResponse): NotificationResponse {
  const payload = parseNotificationPayload(notification.params ?? notification.payload ?? notification.data);
  const orderId = notification.orderId ?? getStringValue(payload, 'orderId') ?? getStringValue(payload, 'OrderId');
  const templateId = notification.templateId ?? notification.type ?? notification.category ?? null;

  return {
    ...notification,
    notificationId: notification.notificationId ?? notification.notiId ?? notification.id,
    id: notification.id ?? notification.notiId ?? notification.notificationId,
    type: notification.type ?? templateId,
    category: notification.category ?? templateId,
    message: notification.message ?? notification.body ?? notification.content,
    content: notification.content ?? notification.body ?? notification.message,
    orderId,
    data: notification.data ?? payload,
    payload: notification.payload ?? payload,
  };
}

function parseNotificationPayload(value: unknown): unknown {
  if (!value) return value;

  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }

  return value;
}

function getStringValue(value: unknown, key: string) {
  if (!value || typeof value !== 'object') return null;

  const record = value as Record<string, unknown>;
  const rawValue = record[key];
  return typeof rawValue === 'string' && rawValue.trim() ? rawValue : null;
}

function getAuthHeaders(accessToken: string) {
  return {
    Authorization: `Bearer ${accessToken}`,
  };
}
