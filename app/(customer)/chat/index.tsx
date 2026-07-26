import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, AppState, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';

import { getCustomerDataErrorMessage } from '../../../services/apiClient';
import { ChatMessage, getChatMessages, getChatUnreadCount } from '../../../services/chatApi';
import { getMyCustomerOrders, OrderResponse } from '../../../services/orderApi';
import { useAuthStore } from '../../../store/useAuthStore';

type Conversation = { order: OrderResponse; lastMessage: ChatMessage | null; unreadCount: number };

export default function CustomerChatListScreen() {
  const router = useRouter();
  const token = useAuthStore((state) => state.token);
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
      const rows = await Promise.all(orders.map(async (order): Promise<Conversation> => {
        const [messagesResult, unreadResult] = await Promise.all([
          getChatMessages(token, order.orderId, 1, 1), getChatUnreadCount(token, order.orderId),
        ]);
        if (!messagesResult.success || !unreadResult.success) {
          throw new Error(messagesResult.message || unreadResult.message || 'Không thể tải hội thoại.');
        }
        const messages = messagesResult.data ?? [];
        const unread = unreadResult.data?.unreadCount ?? 0;
        return { order, lastMessage: messages[messages.length - 1] ?? null, unreadCount: unread };
      }));
      rows.sort((left, right) => Date.parse(right.lastMessage?.createdAt ?? right.order.createdAt ?? '') - Date.parse(left.lastMessage?.createdAt ?? left.order.createdAt ?? ''));
      setConversations(rows); setError(null);
    } catch (loadError) { setConversations([]); setError(getCustomerDataErrorMessage(loadError)); }
    finally { setLoading(false); setRefreshing(false); }
  }, [token]);

  useFocusEffect(useCallback(() => {
    let appState = AppState.currentState;
    void load();
    const timer = setInterval(() => { if (appState === 'active') void load(true); }, 30_000);
    const subscription = AppState.addEventListener('change', (nextState) => { appState = nextState; });
    return () => { clearInterval(timer); subscription.remove(); };
  }, [load]));

  if (loading) return <View className="flex-1 items-center justify-center bg-[#F5F2F0]"><ActivityIndicator size="large" color="#8B4513" /><Text className="mt-4 text-[#8B4513]">Đang tải hội thoại...</Text></View>;
  return (
    <ScrollView className="flex-1 bg-[#F5F2F0]" contentContainerStyle={{ padding: 20, paddingBottom: 100, gap: 12 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} tintColor="#8B4513" />}>
      <View className="rounded-3xl bg-[#3A1F04] p-5"><Text className="text-xl font-bold text-white">Trao đổi theo đơn hàng</Text><Text className="mt-2 text-sm leading-5 text-white/70">Tin nhắn được lưu trên hệ thống và đồng bộ định kỳ.</Text></View>
      {error ? <View className="rounded-2xl border border-red-200 bg-red-50 p-4"><Text className="text-sm text-red-800">{error}</Text><Pressable onPress={() => void load()} className="mt-3 self-start rounded-lg bg-[#8B4513] px-4 py-2"><Text className="font-bold text-white">Thử lại</Text></Pressable></View> : null}
      {!error && conversations.length === 0 ? <View className="items-center rounded-3xl bg-white p-8"><Ionicons name="chatbubbles-outline" size={48} color="#877369" /><Text className="mt-4 font-bold text-[#3A1F04]">Chưa có đơn hàng để trao đổi</Text></View> : null}
      {conversations.map(({ order, lastMessage, unreadCount }) => (
        <Pressable key={order.orderId} onPress={() => router.push({ pathname: '/(customer)/chat/[orderId]', params: { orderId: order.orderId, trackingCode: order.trackingCode } } as never)} className="rounded-2xl border border-[#DAC2B6]/60 bg-white p-4">
          <View className="flex-row items-start gap-3"><View className="h-11 w-11 items-center justify-center rounded-full bg-[#8B4513]/10"><Ionicons name="chatbubble-ellipses-outline" size={22} color="#8B4513" /></View><View className="flex-1"><View className="flex-row items-center justify-between gap-3"><Text className="flex-1 font-bold text-[#3A1F04]">{order.trackingCode}</Text>{unreadCount > 0 ? <View className="min-w-6 items-center rounded-full bg-red-600 px-2 py-1"><Text className="text-xs font-bold text-white">{unreadCount}</Text></View> : null}</View><Text numberOfLines={1} className="mt-1 text-sm text-[#877369]">{lastMessage?.messageContent || 'Chưa có tin nhắn'}</Text><Text className="mt-2 text-xs text-[#877369]">{lastMessage ? formatDateTime(lastMessage.createdAt) : order.itemName}</Text></View></View>
        </Pressable>
      ))}
    </ScrollView>
  );
}

function formatDateTime(value: string) { const date = new Date(value); return Number.isNaN(date.getTime()) ? '--' : date.toLocaleString('vi-VN'); }
