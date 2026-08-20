import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, AppState, Image, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';

import { colors } from '../../../constants/colors';
import { getCustomerDataErrorMessage } from '../../../services/apiClient';
import { ChatMessage, getChatMessages, getChatUnreadCount } from '../../../services/chatApi';
import { chatSignalRService } from '../../../services/chatSignalRService';
import { getUserIdFromToken } from '../../../services/jwt';
import { getMyCustomerOrders, OrderResponse } from '../../../services/orderApi';
import { useAuthStore } from '../../../store/useAuthStore';

type Conversation = { order: OrderResponse; lastMessage: ChatMessage | null; unreadCount: number };

export default function CustomerChatListScreen() {
  const router = useRouter();
  const token = useAuthStore((state) => state.token);
  const storedUserId = useAuthStore((state) => state.userId ?? state.user?.userId ?? null);
  const currentUserId = storedUserId ?? (token ? getUserIdFromToken(token) : null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!token) { setConversations([]); setError('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.'); setLoading(false); return; }
    if (!silent) setError(null);
    try {
      const ordersResponse = await getMyCustomerOrders(token, 1, 30);
      if (!ordersResponse.success) throw new Error(ordersResponse.message || 'Không thể tải đơn hàng cho Chat.');
      const orders = ordersResponse.data ?? [];

      // Batch requests (e.g. 5 at a time) to prevent mobile network resource exhaustion
      const batchSize = 5;
      const rows: Conversation[] = [];
      for (let index = 0; index < orders.length; index += batchSize) {
        const batch = orders.slice(index, index + batchSize);
        const batchRows = await Promise.all(batch.map(async (order): Promise<Conversation> => {
          try {
            const [messagesResult, unreadResult] = await Promise.all([
              getChatMessages(token, order.orderId, 1, 1).catch(() => ({ success: false, data: [] })),
              getChatUnreadCount(token, order.orderId).catch(() => ({ success: false, data: { orderId: order.orderId, unreadCount: 0 } })),
            ]);
            const messages = messagesResult.success ? (messagesResult.data ?? []) : [];
            const unread = unreadResult.success ? (unreadResult.data?.unreadCount ?? 0) : 0;
            return { order, lastMessage: messages[messages.length - 1] ?? null, unreadCount: unread };
          } catch (err) {
            console.warn(`[CustomerChatList] Failed to load chat info for order ${order.orderId}:`, err);
            return { order, lastMessage: null, unreadCount: 0 };
          }
        }));
        rows.push(...batchRows);
      }

      rows.sort((left, right) => Date.parse(right.lastMessage?.createdAt ?? right.order.createdAt ?? '') - Date.parse(left.lastMessage?.createdAt ?? left.order.createdAt ?? ''));
      setConversations(rows); setError(null);
    } catch (loadError) { setConversations([]); setError(getCustomerDataErrorMessage(loadError)); }
    finally { setLoading(false); setRefreshing(false); }
  }, [token]);

  const orderIdsStr = conversations.map((c) => c.order.orderId).sort().join(',');

  // Join SignalR order groups for all order items in list
  React.useEffect(() => {
    if (!token || !orderIdsStr) return;
    let active = true;
    const orderIds = orderIdsStr.split(',').filter(Boolean);

    const initSignalRList = async () => {
      try {
        await chatSignalRService.start();
        if (active) {
          await Promise.all(orderIds.map((id) => chatSignalRService.joinOrder(id)));
        }
      } catch (err) {
        console.error('[CustomerChatList] SignalR list error:', err);
      }
    };

    void initSignalRList();

    return () => {
      active = false;
      orderIds.forEach((id) => {
        void chatSignalRService.leaveOrder(id);
      });
    };
  }, [orderIdsStr, token]);

  // Listen to incoming SignalR messages and update the chat list item
  React.useEffect(() => {
    if (!token) return;
    let active = true;

    const unsubscribe = chatSignalRService.onMessage((message) => {
      if (!active) return;
      setConversations((current) => {
        const idx = current.findIndex((c) => c.order.orderId.toLowerCase() === message.orderId.toLowerCase());
        if (idx === -1) return current;

        const updated = [...current];
        const prev = updated[idx];
        const isMine = message.senderId.toLowerCase() === currentUserId?.toLowerCase();

        updated[idx] = {
          ...prev,
          lastMessage: message,
          unreadCount: isMine ? prev.unreadCount : prev.unreadCount + 1,
        };

        return updated.sort((left, right) =>
          Date.parse(right.lastMessage?.createdAt ?? right.order.createdAt ?? '') -
          Date.parse(left.lastMessage?.createdAt ?? left.order.createdAt ?? '')
        );
      });
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [token, currentUserId]);

  useFocusEffect(useCallback(() => {
    let appState = AppState.currentState;
    void load();
    const timer = setInterval(() => { if (appState === 'active') void load(true); }, 30_000);
    const subscription = AppState.addEventListener('change', (nextState) => { appState = nextState; });
    return () => { clearInterval(timer); subscription.remove(); };
  }, [load]));

  if (loading) return <View style={{ backgroundColor: colors.surface.page }} className="flex-1 items-center justify-center"><ActivityIndicator size="large" color={colors.brand.primary} /><Text style={{ color: colors.brand.primary }} className="mt-4">Đang tải hội thoại...</Text></View>;
  return (
    <ScrollView style={{ backgroundColor: colors.surface.page }} className="flex-1" contentContainerStyle={{ padding: 20, paddingBottom: 100, gap: 12 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} tintColor={colors.brand.primary} />}>
      <View style={{ backgroundColor: colors.text.primary }} className="rounded-3xl p-5"><Text className="text-xl font-bold text-white">Trao đổi theo đơn hàng</Text><Text className="mt-2 text-sm leading-5 text-white/70">Tin nhắn được lưu trên hệ thống và đồng bộ định kỳ.</Text></View>
      {error ? <View className="rounded-2xl border border-red-200 bg-red-50 p-4"><Text className="text-sm text-red-800">{error}</Text><Pressable onPress={() => void load()} style={{ backgroundColor: colors.brand.primary }} className="mt-3 self-start rounded-lg px-4 py-2"><Text style={{ color: colors.text.onPrimary }} className="font-bold">Thử lại</Text></Pressable></View> : null}
      {!error && conversations.length === 0 ? <View style={{ backgroundColor: colors.surface.card }} className="items-center rounded-3xl p-8"><Ionicons name="chatbubbles-outline" size={48} color={colors.text.secondary} /><Text style={{ color: colors.text.primary }} className="mt-4 font-bold">Chưa có đơn hàng để trao đổi</Text></View> : null}
      {conversations.map(({ order, lastMessage, unreadCount }) => {
        const imageUrl = getOrderImageUrl(order);
        return (
          <Pressable key={order.orderId} onPress={() => router.push({ pathname: '/(customer)/chat/[orderId]', params: { orderId: order.orderId, trackingCode: order.trackingCode, imageUrl: imageUrl || '' } } as never)} style={{ backgroundColor: colors.surface.card, borderColor: colors.border.default }} className="rounded-2xl border p-4">
            <View className="flex-row items-center gap-3">
              {imageUrl ? (
                <Image source={{ uri: imageUrl }} style={{ width: 44, height: 44, borderRadius: 10, backgroundColor: colors.surface.muted }} />
              ) : (
                <View style={{ backgroundColor: colors.brand.primarySoft }} className="h-11 w-11 items-center justify-center rounded-2xl">
                  <Ionicons name="cube-outline" size={22} color={colors.brand.primary} />
                </View>
              )}
              <View className="flex-1">
                <View className="flex-row items-center justify-between gap-3">
                  <Text style={{ color: colors.text.primary }} className="flex-1 font-bold">{order.trackingCode}</Text>
                  {unreadCount > 0 ? (
                    <View className="min-w-6 items-center rounded-full bg-red-600 px-2 py-1">
                      <Text className="text-xs font-bold text-white">{unreadCount}</Text>
                    </View>
                  ) : null}
                </View>
                <Text numberOfLines={1} style={{ color: colors.text.secondary }} className="mt-1 text-sm">{lastMessage?.messageContent || 'Chưa có tin nhắn'}</Text>
                <Text style={{ color: colors.text.muted }} className="mt-2 text-xs">{lastMessage ? formatDateTime(lastMessage.createdAt) : order.itemName}</Text>
              </View>
            </View>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function getOrderImageUrl(order: OrderResponse | null) {
  if (!order) return null;
  return (
    order.documents?.find((document) => document.docType === 'CargoImage')?.imageUrl ??
    order.documents?.[0]?.imageUrl ??
    order.documentUrl
  );
}

function formatDateTime(value: string) { const date = new Date(value); return Number.isNaN(date.getTime()) ? '--' : date.toLocaleString('vi-VN'); }
