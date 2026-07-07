import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { getApiErrorMessage } from '../../services/apiClient';
import { getUserIdFromToken } from '../../services/jwt';
import {
  getNotificationById,
  getUserNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  NotificationResponse,
} from '../../services/notificationApi';
import { useAuthStore } from '../../store/useAuthStore';

export default function NotificationsScreen() {
  const router = useRouter();
  const accessToken = useAuthStore((state) => state.token);
  const storedUserId = useAuthStore((state) => state.userId ?? state.user?.userId ?? null);
  const userId = storedUserId ?? (accessToken ? getUserIdFromToken(accessToken) : null);

  const [notifications, setNotifications] = useState<NotificationResponse[]>([]);
  const [selectedNotification, setSelectedNotification] = useState<NotificationResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isMarkingAll, setIsMarkingAll] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const unreadCount = notifications.filter((notification) => !isNotificationRead(notification)).length;

  const fetchNotifications = useCallback(async () => {
    if (!accessToken || !userId) {
      setError('Không tìm thấy mã người dùng. Vui lòng đăng xuất và đăng nhập lại.');
      setNotifications([]);
      setIsLoading(false);
      setIsRefreshing(false);
      return;
    }

    try {
      setError(null);
      const response = await getUserNotifications(accessToken, userId, {
        unreadOnly: false,
        pageNumber: 1,
        pageSize: 20,
      });

      if (response.success && response.data) {
        setNotifications(response.data.items);
      } else {
        setError(response.message || 'Không thể tải danh sách thông báo.');
      }
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [accessToken, userId]);

  useFocusEffect(
    useCallback(() => {
      setIsLoading(true);
      fetchNotifications();
    }, [fetchNotifications])
  );

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchNotifications();
  };

  const handlePressNotification = async (notification: NotificationResponse) => {
    if (!accessToken) {
      setError('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
      return;
    }

    const notificationId = getNotificationId(notification);
    if (!notificationId) {
      setSelectedNotification(notification);
      return;
    }

    try {
      const [detailResponse] = await Promise.all([
        getNotificationById(accessToken, notificationId),
        markNotificationRead(accessToken, notificationId),
      ]);

      const detail = detailResponse.success && detailResponse.data ? detailResponse.data : notification;
      setNotifications((current) =>
        current.map((item) =>
          getNotificationId(item) === notificationId
            ? { ...item, ...detail, isRead: true, readAt: item.readAt ?? new Date().toISOString() }
            : item
        )
      );

      const orderId = getNotificationOrderId(detail);
      if (orderId) {
        router.push(`/(customer)/orders/${orderId}` as never);
        return;
      }

      setSelectedNotification({ ...detail, isRead: true });
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  };

  const handleMarkAllRead = async () => {
    if (!accessToken || !userId) {
      setError('Không tìm thấy mã người dùng. Vui lòng đăng xuất và đăng nhập lại.');
      return;
    }

    setIsMarkingAll(true);
    try {
      const response = await markAllNotificationsRead(accessToken, userId);
      if (!response.success) {
        throw new Error(response.message || 'Không thể đánh dấu tất cả thông báo.');
      }

      setNotifications((current) =>
        current.map((notification) => ({
          ...notification,
          isRead: true,
          readAt: notification.readAt ?? new Date().toISOString(),
        }))
      );
      await fetchNotifications();
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setIsMarkingAll(false);
    }
  };

  const renderNotification = ({ item }: { item: NotificationResponse }) => {
    const unread = !isNotificationRead(item);

    return (
      <Pressable
        onPress={() => handlePressNotification(item)}
        className={[
          'mb-3 rounded-2xl border p-4 shadow-sm',
          unread ? 'border-[#8B4513]/30 bg-white' : 'border-[#DAC2B6]/50 bg-[#F8F9FA]',
        ].join(' ')}
      >
        <View className="flex-row items-start gap-3">
          <View
            className={[
              'h-10 w-10 items-center justify-center rounded-full',
              unread ? 'bg-[#8B4513]/10' : 'bg-[#DAC2B6]/30',
            ].join(' ')}
          >
            <Ionicons name={getNotificationIcon(item)} size={20} color={unread ? '#8B4513' : '#877369'} />
          </View>

          <View className="flex-1">
            <View className="flex-row items-start justify-between gap-2">
              <Text className="flex-1 text-[15px] font-bold text-[#3A1F04]">
                {getNotificationTitle(item)}
              </Text>
              {unread ? <View className="mt-1 h-2.5 w-2.5 rounded-full bg-[#8B4513]" /> : null}
            </View>

            <Text className="mt-1 text-sm leading-5 text-[#877369]" numberOfLines={3}>
              {getNotificationMessage(item)}
            </Text>

            <View className="mt-3 flex-row items-center justify-between gap-3">
              <Text className="text-xs font-medium text-[#877369]">{formatDate(item.createdAt)}</Text>
              {getNotificationType(item) ? (
                <View className="rounded-full bg-[#8B4513]/10 px-2.5 py-1">
                  <Text className="text-[10px] font-bold uppercase text-[#8B4513]">
                    {getNotificationType(item)}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
        </View>
      </Pressable>
    );
  };

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-[#F5F2F0]">
        <ActivityIndicator size="large" color="#8B4513" />
        <Text className="mt-4 font-medium text-[#8B4513]">Đang tải thông báo...</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-[#F5F2F0]">
      <View className="border-b border-[#DAC2B6]/40 bg-white px-5 py-4">
        <View className="flex-row items-center justify-between">
          <View>
            <Text className="text-lg font-bold text-[#3A1F04]">Trung tâm thông báo</Text>
            <Text className="mt-1 text-xs text-[#877369]">{unreadCount} thông báo chưa đọc</Text>
          </View>
          <Pressable
            onPress={handleMarkAllRead}
            disabled={isMarkingAll || unreadCount === 0}
            className={[
              'rounded-xl px-3 py-2',
              unreadCount === 0 ? 'bg-[#DAC2B6]/30' : 'bg-[#8B4513]',
            ].join(' ')}
          >
            <Text className={['text-xs font-bold', unreadCount === 0 ? 'text-[#877369]' : 'text-white'].join(' ')}>
              {isMarkingAll ? 'Đang xử lý...' : 'Đánh dấu tất cả đã đọc'}
            </Text>
          </Pressable>
        </View>
      </View>

      {error ? (
        <View className="flex-1 items-center justify-center p-6">
          <Ionicons name="alert-circle-outline" size={48} color="#dc2626" />
          <Text className="mt-4 text-center font-medium leading-6 text-red-600">{error}</Text>
          <Pressable onPress={fetchNotifications} className="mt-4 rounded-xl bg-[#8B4513] px-6 py-3">
            <Text className="font-bold text-white">Thử lại</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item, index) => getNotificationId(item) ?? `notification-${index}`}
          renderItem={renderNotification}
          contentContainerStyle={{ padding: 20, paddingBottom: 100 }}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor="#8B4513" />
          }
          ListEmptyComponent={
            <View className="items-center justify-center py-20">
              <Ionicons name="notifications-outline" size={64} color="#877369" />
              <Text className="mt-4 text-center font-medium text-[#877369]">Bạn chưa có thông báo nào.</Text>
            </View>
          }
        />
      )}

      <Modal visible={!!selectedNotification} transparent animationType="fade">
        <View className="flex-1 items-center justify-center bg-black/60 px-5">
          <View className="w-full rounded-3xl bg-white p-6">
            <View className="mb-4 flex-row items-start justify-between gap-3">
              <Text className="flex-1 text-xl font-bold text-[#3A1F04]">
                {selectedNotification ? getNotificationTitle(selectedNotification) : ''}
              </Text>
              <Pressable onPress={() => setSelectedNotification(null)} className="h-9 w-9 items-center justify-center">
                <Ionicons name="close" size={22} color="#877369" />
              </Pressable>
            </View>
            <Text className="text-sm leading-6 text-[#877369]">
              {selectedNotification ? getNotificationMessage(selectedNotification) : ''}
            </Text>
            <Text className="mt-4 text-xs font-medium text-[#877369]">
              {selectedNotification ? formatDate(selectedNotification.createdAt) : ''}
            </Text>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function getNotificationId(notification: NotificationResponse) {
  return notification.notificationId ?? notification.notiId ?? notification.id ?? null;
}

function getNotificationTitle(notification: NotificationResponse) {
  return notification.title?.trim() || getNotificationType(notification) || 'Thông báo ColdChainX';
}

function getNotificationMessage(notification: NotificationResponse) {
  return notification.message?.trim() || notification.content?.trim() || 'Bạn có cập nhật mới từ ColdChainX.';
}

function getNotificationType(notification: NotificationResponse) {
  return notification.type?.trim() || notification.category?.trim() || null;
}

function isNotificationRead(notification: NotificationResponse) {
  return Boolean(notification.isRead || notification.readAt);
}

function getNotificationIcon(notification: NotificationResponse): keyof typeof Ionicons.glyphMap {
  const type = (getNotificationType(notification) ?? '').toUpperCase();
  if (type.includes('QUOTE')) return 'receipt-outline';
  if (type.includes('ORDER')) return 'cube-outline';
  if (type.includes('CONTRACT')) return 'document-text-outline';
  return 'notifications-outline';
}

function getNotificationOrderId(notification: NotificationResponse) {
  return (
    notification.orderId ??
    getOrderIdFromUnknown(notification.data) ??
    getOrderIdFromUnknown(notification.payload)
  );
}

function getOrderIdFromUnknown(value: unknown): string | null {
  if (!value) return null;

  if (typeof value === 'string') {
    try {
      return getOrderIdFromUnknown(JSON.parse(value));
    } catch {
      return null;
    }
  }

  if (typeof value !== 'object') return null;

  const record = value as Record<string, unknown>;
  const orderId = record.orderId ?? record.OrderId;
  return typeof orderId === 'string' && orderId.trim() ? orderId : null;
}

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleString('vi-VN') : 'Chưa cập nhật';
}
