import React, { useCallback, useState } from 'react';
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

import { colors } from '../../constants/colors';
import { getApiErrorMessage } from '../../services/apiClient';
import {
  getUserNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  NotificationResponse,
} from '../../services/notificationApi';
import { useAuthStore } from '../../store/useAuthStore';
import { formatNotificationTime } from '../../utils/notificationPresenter';

export default function DriverNotificationsScreen() {
  const router = useRouter();
  const token = useAuthStore((state) => state.token);

  const [notifications, setNotifications] = useState<NotificationResponse[]>([]);
  const [selectedNotification, setSelectedNotification] = useState<NotificationResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isMarkingAll, setIsMarkingAll] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const unreadCount = notifications.filter((n) => !n.isRead && !n.readAt).length;

  const fetchNotifications = useCallback(async () => {
    if (!token) {
      setError('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
      setNotifications([]);
      setIsLoading(false);
      setIsRefreshing(false);
      return;
    }

    try {
      setError(null);
      const res = await getUserNotifications(token, {
        pageNumber: 1,
        pageSize: 30,
      });

      if (res.success && res.data) {
        setNotifications(res.data.items);
      } else {
        setError(res.message || 'Không thể tải danh sách thông báo.');
      }
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [token]);

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
    if (!token) return;

    const notifId = notification.notificationId ?? notification.notiId ?? notification.id;
    if (notifId) {
      markNotificationRead(token, notifId).catch(() => {});
      setNotifications((current) =>
        current.map((item) =>
          (item.notificationId ?? item.id) === notifId
            ? { ...item, isRead: true, readAt: new Date().toISOString() }
            : item
        )
      );
    }

    const payload = getPayloadObject(notification);
    const incidentId =
      payload?.incidentId ||
      payload?.IncidentId ||
      payload?.referenceId ||
      (notification.type === 'INCIDENT_WORKFLOW' ? payload?.referenceId : null);

    const tripId = payload?.tripId || payload?.TripId;

    if (incidentId) {
      router.push(`/(driver)/trips/${tripId || 'active'}/incident-detail?incidentId=${incidentId}` as never);
      return;
    }

    if (tripId) {
      router.push(`/(driver)/trips/${tripId}` as never);
      return;
    }

    setSelectedNotification({ ...notification, isRead: true });
  };

  const handleMarkAllRead = async () => {
    if (!token) return;
    setIsMarkingAll(true);
    try {
      await markAllNotificationsRead(token);
      setNotifications((current) =>
        current.map((n) => ({
          ...n,
          isRead: true,
          readAt: n.readAt ?? new Date().toISOString(),
        }))
      );
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setIsMarkingAll(false);
    }
  };

  return (
    <View style={{ backgroundColor: colors.surface.page }} className="flex-1">
      {/* Header */}
      <View style={{ backgroundColor: colors.surface.card, borderColor: colors.border.default }} className="border-b px-4 pt-12 pb-4 shadow-sm">
        <View className="flex-row items-center justify-between">
          <Pressable onPress={() => router.back()} style={{ backgroundColor: colors.brand.primarySoft }} className="rounded-full p-2">
            <Ionicons name="arrow-back" size={20} color={colors.brand.primary} />
          </Pressable>
          <Text style={{ color: colors.text.primary }} className="text-lg font-bold">
            Thông báo tài xế
          </Text>
          {unreadCount > 0 ? (
            <Pressable
              onPress={handleMarkAllRead}
              disabled={isMarkingAll}
              className="rounded-xl bg-blue-50 px-3 py-1.5"
            >
              <Text style={{ color: colors.brand.primary }} className="text-xs font-bold">
                {isMarkingAll ? 'Đang xử lý...' : 'Đọc tất cả'}
              </Text>
            </Pressable>
          ) : (
            <View className="w-10" />
          )}
        </View>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.brand.primary} />
          <Text style={{ color: colors.brand.primary }} className="mt-3 font-semibold">
            Đang tải thông báo...
          </Text>
        </View>
      ) : error ? (
        <View className="flex-1 items-center justify-center p-6">
          <Ionicons name="alert-circle-outline" size={48} color={colors.status.danger.main} />
          <Text style={{ color: colors.status.danger.main }} className="mt-4 text-center font-semibold">
            {error}
          </Text>
          <Pressable onPress={fetchNotifications} style={{ backgroundColor: colors.brand.primary }} className="mt-5 rounded-xl px-6 py-3">
            <Text style={{ color: colors.text.onPrimary }} className="font-bold">
              Thử lại
            </Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item, index) => item.notificationId ?? item.id ?? String(index)}
          contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor={colors.brand.primary} />}
          ListEmptyComponent={
            <View className="items-center justify-center py-20">
              <Ionicons name="notifications-outline" size={56} color={colors.text.muted} />
              <Text style={{ color: colors.text.primary }} className="mt-4 text-base font-bold">
                Chưa có thông báo nào
              </Text>
              <Text style={{ color: colors.text.secondary }} className="mt-1 text-xs text-center">
                Bạn sẽ nhận được thông báo khi có chuyến mới hoặc cập nhật sự cố.
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const isRead = Boolean(item.isRead || item.readAt);
            const timeStr = formatNotificationTime(item.createdAt);
            const title = item.title || item.message || 'Thông báo';
            const body = item.body || item.content || item.message || '';

            return (
              <Pressable
                onPress={() => handlePressNotification(item)}
                style={{
                  backgroundColor: isRead ? colors.surface.card : '#F0F9FF',
                  borderColor: isRead ? colors.border.default : colors.brand.primarySoft,
                }}
                className="rounded-2xl border p-4 shadow-sm"
              >
                <View className="flex-row items-start gap-3">
                  <View
                    style={{
                      backgroundColor: isRead ? colors.surface.muted : colors.brand.primarySoft,
                    }}
                    className="h-10 w-10 items-center justify-center rounded-2xl"
                  >
                    <Ionicons
                      name={item.type === 'INCIDENT_WORKFLOW' ? 'warning-outline' : 'notifications-outline'}
                      size={20}
                      color={isRead ? colors.text.secondary : colors.brand.primary}
                    />
                  </View>

                  <View className="flex-1">
                    <View className="flex-row items-center justify-between">
                      <Text
                        numberOfLines={1}
                        style={{ color: colors.text.primary }}
                        className={`text-sm ${isRead ? 'font-semibold' : 'font-bold'}`}
                      >
                        {title}
                      </Text>
                      {!isRead ? (
                        <View className="h-2.5 w-2.5 rounded-full bg-blue-600 ml-2" />
                      ) : null}
                    </View>

                    {body ? (
                      <Text
                        numberOfLines={2}
                        style={{ color: colors.text.secondary }}
                        className="mt-1 text-xs leading-4"
                      >
                        {body}
                      </Text>
                    ) : null}

                    <Text style={{ color: colors.text.muted }} className="mt-2 text-[10px] font-medium">
                      {timeStr}
                    </Text>
                  </View>
                </View>
              </Pressable>
            );
          }}
        />
      )}

      {/* Detail Modal */}
      <Modal visible={Boolean(selectedNotification)} transparent animationType="fade" onRequestClose={() => setSelectedNotification(null)}>
        <View className="flex-1 items-center justify-center bg-black/60 px-6">
          <View style={{ backgroundColor: colors.surface.card }} className="w-full rounded-3xl p-6 shadow-2xl">
            <View className="flex-row items-center justify-between border-b pb-3">
              <Text style={{ color: colors.text.primary }} className="text-base font-bold">
                Chi tiết thông báo
              </Text>
              <Pressable onPress={() => setSelectedNotification(null)} className="rounded-full bg-gray-100 p-1.5">
                <Ionicons name="close" size={18} color={colors.text.secondary} />
              </Pressable>
            </View>

            <ScrollView className="max-h-[300px] my-4">
              <Text style={{ color: colors.text.primary }} className="text-base font-bold mb-2">
                {selectedNotification?.title || 'Thông báo'}
              </Text>
              <Text style={{ color: colors.text.secondary }} className="text-sm leading-5">
                {selectedNotification?.body || selectedNotification?.message || selectedNotification?.content || 'Không có nội dung chi tiết.'}
              </Text>
              <Text style={{ color: colors.text.muted }} className="mt-4 text-xs">
                {formatNotificationTime(selectedNotification?.createdAt)}
              </Text>
            </ScrollView>

            <Pressable
              onPress={() => setSelectedNotification(null)}
              style={{ backgroundColor: colors.brand.primary }}
              className="items-center rounded-xl p-3"
            >
              <Text style={{ color: colors.text.onPrimary }} className="font-bold">
                Đóng
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function getPayloadObject(notification: NotificationResponse): Record<string, any> | null {
  const raw = notification.payload ?? notification.data ?? notification.params;
  if (!raw) return null;
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (typeof raw === 'object') return raw as Record<string, any>;
  return null;
}
