import { apiRequest } from './apiClient';

export interface NotificationResponse {
  notificationId?: string;
  id?: string;
  userId?: string | null;
  title?: string | null;
  message?: string | null;
  content?: string | null;
  type?: string | null;
  category?: string | null;
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

export function getNotificationById(accessToken: string, notificationId: string) {
  return apiRequest<ApiResponse<NotificationResponse>>(`/api/notifications/${notificationId}`, {
    method: 'GET',
    headers: getAuthHeaders(accessToken),
  });
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
    return {
      items: data,
      totalRecords: data.length,
    } satisfies NotificationListResult;
  }

  const items = data?.data ?? data?.items ?? [];

  return {
    items,
    totalRecords: data?.totalRecords ?? data?.totalCount ?? items.length,
    totalPages: data?.totalPages,
    currentPage: data?.currentPage,
    pageNumber: data?.pageNumber,
    pageSize: data?.pageSize,
  } satisfies NotificationListResult;
}

function getAuthHeaders(accessToken: string) {
  return {
    Authorization: `Bearer ${accessToken}`,
  };
}
