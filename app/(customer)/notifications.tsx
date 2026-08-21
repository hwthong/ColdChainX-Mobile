import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';

import { colors } from '../../constants/colors';
import { getApiErrorMessage } from '../../services/apiClient';
import {
  getNotificationById,
  getUserNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  NotificationResponse,
} from '../../services/notificationApi';
import { getMyCustomerOrders, OrderResponse } from '../../services/orderApi';
import { useAuthStore } from '../../store/useAuthStore';
import { useNotificationStore } from '../../store/useNotificationStore';
import {
  cleanNotificationBody,
  extractImageUrl,
  getNotificationPresentation,
} from '../../utils/notificationPresenter';

export default function NotificationsScreen() {
  const router = useRouter();
  const accessToken = useAuthStore((state) => state.token);

  const realtimeItems = useNotificationStore((state) => state.realtimeItems);
  const unreadCount = useNotificationStore((state) => state.unreadCount);
  const decrementUnreadCount = useNotificationStore((state) => state.decrementUnreadCount);
  const setUnreadCount = useNotificationStore((state) => state.setUnreadCount);
  const fetchUnreadCount = useNotificationStore((state) => state.fetchUnreadCount);

  const [notifications, setNotifications] = useState<NotificationResponse[]>([]);
  const [ordersMap, setOrdersMap] = useState<Map<string, OrderResponse>>(new Map());
  const [selectedNotification, setSelectedNotification] = useState<NotificationResponse | null>(null);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isMarkingAll, setIsMarkingAll] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchNotifications = useCallback(async () => {
    if (!accessToken) {
      setError('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
      setNotifications([]);
      setIsLoading(false);
      setIsRefreshing(false);
      return;
    }

    try {
      setError(null);
      const [notifResponse, ordersResponse] = await Promise.all([
        getUserNotifications(accessToken, {
          unreadOnly: false,
          pageNumber: 1,
          pageSize: 30,
        }),
        getMyCustomerOrders(accessToken, 1, 50).catch(() => null),
        fetchUnreadCount(accessToken),
      ]);

      if (ordersResponse?.success && ordersResponse.data) {
        const map = new Map(
          ordersResponse.data.map((o) => [o.orderId.toLowerCase(), o])
        );
        setOrdersMap(map);
      }

      if (notifResponse.success && notifResponse.data) {
        setNotifications(notifResponse.data.items);
      } else {
        setError(notifResponse.message || 'Không thể tải danh sách thông báo.');
      }
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [accessToken, fetchUnreadCount]);

  useFocusEffect(
    useCallback(() => {
      setIsLoading(true);
      fetchNotifications();
    }, [fetchNotifications])
  );

  // Prepend real-time SignalR notifications when received
  useEffect(() => {
    if (!realtimeItems || realtimeItems.length === 0) return;

    setNotifications((current) => {
      const existingIds = new Set(
        current.map((item) => getNotificationId(item)).filter(Boolean)
      );

      const newItems = realtimeItems.filter(
        (item) => !existingIds.has(getNotificationId(item))
      );

      if (newItems.length === 0) return current;
      return [...newItems, ...current];
    });
  }, [realtimeItems]);

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
      const wasUnread = !isNotificationRead(notification);
      if (wasUnread) {
        decrementUnreadCount(1);
      }

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
    if (!accessToken) {
      setError('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
      return;
    }

    setIsMarkingAll(true);
    try {
      const response = await markAllNotificationsRead(accessToken);
      if (!response.success) {
        throw new Error(response.message || 'Không thể đánh dấu tất cả thông báo.');
      }

      setUnreadCount(0);
      setNotifications((current) =>
        current.map((notification) => ({
          ...notification,
          isRead: true,
          readAt: notification.readAt ?? new Date().toISOString(),
        }))
      );
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setIsMarkingAll(false);
    }
  };

  const renderNotification = ({ item }: { item: NotificationResponse }) => {
    const unread = !isNotificationRead(item);
    const p = getNotificationPresentation(item, ordersMap);

    return (
      <Pressable
        onPress={() => handlePressNotification(item)}
        style={{
          backgroundColor: unread ? colors.surface.card : colors.surface.page,
          borderColor: unread ? colors.border.selected : colors.border.default,
        }}
        className="mb-2.5 rounded-2xl border p-3.5 shadow-sm"
      >
        <View className="flex-row items-start gap-3">
          <View
            style={{ backgroundColor: unread ? colors.brand.primarySoft : colors.surface.muted }}
            className="h-9 w-9 items-center justify-center rounded-full"
          >
            <Ionicons name={p.iconName} size={18} color={unread ? colors.brand.primary : colors.text.secondary} />
          </View>

          <View className="flex-1">
            <View className="flex-row items-center justify-between gap-2">
              <View style={{ backgroundColor: colors.brand.primarySoft }} className="rounded-full px-2.5 py-0.5">
                <Text style={{ color: colors.brand.primary }} className="text-[10px] font-bold">
                  {p.categoryBadge}
                </Text>
              </View>
              {unread ? <View style={{ backgroundColor: colors.brand.primary }} className="h-2.5 w-2.5 rounded-full" /> : null}
            </View>

            <Text style={{ color: colors.text.primary }} className="mt-1 text-[15px] font-bold">
              {p.title}
            </Text>

            {p.itemName ? (
              <Text style={{ color: colors.brand.primary }} className="mt-0.5 text-xs font-semibold">
                {p.itemName}
              </Text>
            ) : null}

            {p.description ? (
              <Text style={{ color: colors.text.secondary }} className="mt-1 text-xs leading-4" numberOfLines={2}>
                {p.description}
              </Text>
            ) : null}

            {p.importantValue ? (
              <Text style={{ color: colors.brand.primary }} className="mt-1 text-xs font-bold">
                {p.importantValue}
              </Text>
            ) : null}

            {extractImageUrl(item) ? (
              <Pressable
                onPress={(e) => {
                  e.stopPropagation();
                  setPreviewImageUrl(extractImageUrl(item));
                }}
                className="mt-2.5 flex-row items-center gap-2 rounded-xl bg-blue-50/80 p-1.5 border border-blue-200/60 max-w-[210px]"
              >
                <Image
                  source={{ uri: extractImageUrl(item)! }}
                  style={{ width: 40, height: 40, borderRadius: 8 }}
                  contentFit="cover"
                />
                <View className="flex-1 pr-1">
                  <View className="flex-row items-center gap-1">
                    <Ionicons name="receipt-outline" size={12} color={colors.brand.primary} />
                    <Text style={{ color: colors.brand.primary }} className="text-[11px] font-bold">
                      Hình ảnh chứng từ
                    </Text>
                  </View>
                  <Text style={{ color: colors.text.muted }} className="text-[10px] mt-0.5 font-medium">
                    Nhấn để phóng to
                  </Text>
                </View>
              </Pressable>
            ) : null}

            <View className="mt-2 flex-row items-center gap-1.5">
              <Ionicons name="time-outline" size={12} color={colors.text.muted} />
              <Text style={{ color: colors.text.muted }} className="text-[11px] font-medium">
                {p.orderRef ? `${p.orderRef} · ` : ''}{p.formattedTime}
              </Text>
            </View>
          </View>
        </View>
      </Pressable>
    );
  };

  if (isLoading) {
    return (
      <View style={{ backgroundColor: colors.surface.page }} className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" color={colors.brand.primary} />
        <Text style={{ color: colors.brand.primary }} className="mt-4 font-medium">Đang tải thông báo...</Text>
      </View>
    );
  }

  const selectedP = selectedNotification ? getNotificationPresentation(selectedNotification, ordersMap) : null;
  const modalImageUrl = selectedNotification ? extractImageUrl(selectedNotification) : null;

  return (
    <View style={{ backgroundColor: colors.surface.page }} className="flex-1">
      <View style={{ backgroundColor: colors.surface.card, borderBottomColor: colors.border.default }} className="border-b px-5 py-3">
        <View className="flex-row items-center justify-between">
          <Text style={{ color: colors.text.secondary }} className="text-xs font-semibold">
            {unreadCount > 0 ? `${unreadCount} thông báo chưa đọc` : 'Tất cả thông báo đã được đọc'}
          </Text>
          <Pressable
            onPress={handleMarkAllRead}
            disabled={isMarkingAll || unreadCount === 0}
            style={{ backgroundColor: unreadCount === 0 ? colors.surface.muted : colors.brand.primary }}
            className="rounded-xl px-3 py-1.5"
          >
            <Text style={{ color: unreadCount === 0 ? colors.text.muted : colors.text.onPrimary }} className="text-xs font-bold">
              {isMarkingAll ? 'Đang xử lý...' : 'Đánh dấu tất cả đã đọc'}
            </Text>
          </Pressable>
        </View>
      </View>

      {error ? (
        <View className="flex-1 items-center justify-center p-6">
          <Ionicons name="alert-circle-outline" size={48} color={colors.status.danger.main} />
          <Text style={{ color: colors.status.danger.main }} className="mt-4 text-center font-medium leading-6">{error}</Text>
          <Pressable onPress={fetchNotifications} style={{ backgroundColor: colors.brand.primary }} className="mt-4 rounded-xl px-6 py-3">
            <Text style={{ color: colors.text.onPrimary }} className="font-bold">Thử lại</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item, index) => getNotificationId(item) ?? `notification-${index}`}
          renderItem={renderNotification}
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor={colors.brand.primary} />
          }
          ListEmptyComponent={
            <View className="items-center justify-center py-20 px-6">
              <Ionicons name="notifications-outline" size={56} color={colors.text.muted} />
              <Text style={{ color: colors.text.primary }} className="mt-4 text-center text-base font-bold">Chưa có thông báo</Text>
              <Text style={{ color: colors.text.secondary }} className="mt-2 text-center text-xs leading-5">
                Các cập nhật về đơn hàng và vận chuyển sẽ xuất hiện tại đây.
              </Text>
            </View>
          }
        />
      )}

      {/* Detail Modal */}
      {Boolean(selectedNotification) && (
        <Modal visible={true} transparent animationType="fade" onRequestClose={() => setSelectedNotification(null)}>
          <View className="flex-1 items-center justify-center bg-black/60 px-5">
            <View style={{ backgroundColor: colors.surface.card }} className="w-full rounded-3xl p-6">
              <View className="mb-3 flex-row items-start justify-between gap-3">
                <View className="flex-1">
                  <Text style={{ color: colors.text.primary }} className="text-lg font-bold">
                    {selectedP?.title || ''}
                  </Text>
                  {selectedP?.itemName ? (
                    <Text style={{ color: colors.brand.primary }} className="mt-0.5 text-xs font-semibold">
                      {selectedP.itemName}
                    </Text>
                  ) : null}
                </View>
                <Pressable onPress={() => setSelectedNotification(null)} className="h-9 w-9 items-center justify-center rounded-full bg-gray-100 active:opacity-70">
                  <Ionicons name="close" size={20} color={colors.text.secondary} />
                </Pressable>
              </View>

              <ScrollView className="max-h-[400px]" showsVerticalScrollIndicator={false}>
                {selectedP?.description ? (
                  <Text style={{ color: colors.text.secondary }} className="text-sm leading-6">
                    {cleanNotificationBody(selectedP.description)}
                  </Text>
                ) : null}

                {modalImageUrl ? (
                  <View className="mt-3 rounded-2xl border border-gray-200 bg-gray-50 p-2.5">
                    <View className="flex-row items-center justify-between mb-1.5">
                      <View className="flex-row items-center gap-1.5">
                        <Ionicons name="receipt-outline" size={15} color={colors.brand.primary} />
                        <Text style={{ color: colors.text.primary }} className="text-xs font-bold">
                          Chứng từ đính kèm
                        </Text>
                      </View>
                      <Text style={{ color: colors.brand.primary }} className="text-[11px] font-medium">
                        Nhấn để phóng to
                      </Text>
                    </View>

                    <Pressable
                      onPress={() => setPreviewImageUrl(modalImageUrl)}
                      className="relative overflow-hidden rounded-xl bg-gray-200 items-center justify-center active:opacity-75"
                      style={{ height: 160 }}
                    >
                      <Image
                        source={{ uri: modalImageUrl }}
                        style={{ width: '100%', height: '100%' }}
                        contentFit="cover"
                      />
                      <View className="absolute bottom-2 right-2 rounded-lg bg-black/60 px-2 py-0.5 flex-row items-center gap-1">
                        <Ionicons name="scan-outline" size={12} color="#FFFFFF" />
                        <Text className="text-[10px] font-bold text-white">Xem ảnh lớn</Text>
                      </View>
                    </Pressable>
                  </View>
                ) : null}

                {selectedP?.importantValue ? (
                  <Text style={{ color: colors.brand.primary }} className="mt-2 text-sm font-bold">
                    {selectedP.importantValue}
                  </Text>
                ) : null}

                <View style={{ borderTopColor: colors.border.default }} className="mt-4 flex-row items-center justify-between border-t pt-3">
                  <Text style={{ color: colors.text.muted }} className="text-xs font-medium">
                    {selectedP?.orderRef ? `${selectedP.orderRef} · ` : ''}{selectedP?.formattedTime || ''}
                  </Text>
                  <View style={{ backgroundColor: colors.brand.primarySoft }} className="rounded-full px-2.5 py-0.5">
                    <Text style={{ color: colors.brand.primary }} className="text-[10px] font-bold">
                      {selectedP?.categoryBadge || ''}
                    </Text>
                  </View>
                </View>
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}

      {/* Fullscreen Image Lightbox Modal */}
      {Boolean(previewImageUrl) && (
        <Modal visible={true} transparent animationType="fade" onRequestClose={() => setPreviewImageUrl(null)}>
          <View className="flex-1 bg-black/95 items-center justify-center p-4">
            <Pressable
              onPress={() => setPreviewImageUrl(null)}
              className="absolute top-12 right-6 z-50 rounded-full bg-white/20 p-2.5 active:bg-white/40"
              hitSlop={15}
            >
              <Ionicons name="close" size={24} color="#FFFFFF" />
            </Pressable>

            {previewImageUrl ? (
              <Image
                source={{ uri: previewImageUrl }}
                style={{ width: '100%', height: '80%' }}
                contentFit="contain"
              />
            ) : null}

            <Text className="absolute bottom-10 text-center text-xs text-white/70">
              Chạm dấu ✕ hoặc nhấn nút đóng để quay lại
            </Text>
          </View>
        </Modal>
      )}
    </View>
  );
}

function getNotificationId(notification: NotificationResponse) {
  return notification.notificationId ?? notification.notiId ?? notification.id ?? null;
}

function isNotificationRead(notification: NotificationResponse) {
  return Boolean(notification.isRead || notification.readAt);
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
