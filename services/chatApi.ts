import { apiRequest } from './apiClient';
import { sanitizeTripId } from './trackingApi';

export interface ApiResponse<T> {
  success: boolean;
  message?: string | null;
  data?: T | null;
}

export interface ChatMessage {
  id: string;
  orderId: string;
  senderId: string;
  senderName?: string | null;
  senderRole?: string | null;
  receiverId: string;
  receiverName?: string | null;
  receiverRole?: string | null;
  messageContent: string;
  createdAt: string;
  isRead: boolean;
}

interface PagedMessages {
  data?: ChatMessage[];
  items?: ChatMessage[];
  totalRecords?: number;
  totalCount?: number;
}

export interface ChatUnreadCount {
  orderId: string;
  unreadCount: number;
}

export function getChatMessages(token: string, orderId: string, pageNumber = 1, pageSize = 100) {
  const id = requireOrderId(orderId);
  return apiRequest<ApiResponse<PagedMessages>>(
    `/api/chat/${id}/messages?pageNumber=${pageNumber}&pageSize=${pageSize}`,
    { method: 'GET', headers: auth(token) }
  ).then((response): ApiResponse<ChatMessage[]> => ({
    ...response,
    data: dedupeAndSort(response.data?.data ?? response.data?.items ?? []),
  }));
}

export function getChatUnreadCount(token: string, orderId: string) {
  const id = requireOrderId(orderId);
  return apiRequest<ApiResponse<ChatUnreadCount>>(`/api/chat/${id}/unread-count`, {
    method: 'GET', headers: auth(token),
  });
}

export function markChatMessagesRead(token: string, orderId: string) {
  const id = requireOrderId(orderId);
  return apiRequest<ApiResponse<{ updatedCount: number }>>(`/api/chat/${id}/messages/read`, {
    method: 'PATCH', headers: auth(token),
  });
}

export function sendChatMessage(token: string, orderId: string, receiverId: string, messageContent: string) {
  const id = requireOrderId(orderId);
  const receiver = requireOrderId(receiverId);
  const content = messageContent.trim();
  if (!content) return Promise.reject(new Error('Nội dung tin nhắn không được để trống.'));
  return apiRequest<ApiResponse<ChatMessage>>(`/api/chat/${id}/messages`, {
    method: 'POST', headers: auth(token), body: { receiverId: receiver, messageContent: content },
  });
}

export function findChatCounterpart(messages: ChatMessage[], currentUserId: string | null) {
  if (!currentUserId) return null;
  const normalizedUserId = currentUserId.toLowerCase();
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.senderId.toLowerCase() !== normalizedUserId) {
      return { userId: message.senderId, name: message.senderName, role: message.senderRole };
    }
    if (message.receiverId.toLowerCase() !== normalizedUserId) {
      return { userId: message.receiverId, name: message.receiverName, role: message.receiverRole };
    }
  }
  return null;
}

function dedupeAndSort(messages: ChatMessage[]) {
  const byId = new Map(messages.map((message) => [message.id, message]));
  return Array.from(byId.values()).sort((left, right) => Date.parse(left.createdAt) - Date.parse(right.createdAt));
}

function requireOrderId(value: string) {
  const id = sanitizeTripId(value);
  if (!id) throw new Error('OrderId không hợp lệ.');
  return encodeURIComponent(id);
}

function auth(token: string) { return { Authorization: `Bearer ${token}` }; }
