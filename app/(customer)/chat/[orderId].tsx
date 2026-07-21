import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, AppState, FlatList, KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getApiErrorMessage } from '../../../services/apiClient';
import { ChatMessage, findChatCounterpart, getChatMessages, markChatMessagesRead, sendChatMessage } from '../../../services/chatApi';
import { getUserIdFromToken } from '../../../services/jwt';
import { useAuthStore } from '../../../store/useAuthStore';

export default function CustomerChatThreadScreen() {
  const params = useLocalSearchParams<{ orderId?: string | string[]; trackingCode?: string | string[] }>();
  const orderId = single(params.orderId);
  const trackingCode = single(params.trackingCode);
  const token = useAuthStore((state) => state.token);
  const storedUserId = useAuthStore((state) => state.userId ?? state.user?.userId ?? null);
  const currentUserId = storedUserId ?? (token ? getUserIdFromToken(token) : null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const sendingRef = useRef(false);
  const listRef = useRef<FlatList<ChatMessage>>(null);
  const counterpart = useMemo(() => findChatCounterpart(messages, currentUserId), [currentUserId, messages]);

  const load = useCallback(async (silent = false) => {
    if (!token || !orderId) { setError('Thiếu phiên đăng nhập hoặc OrderId hợp lệ.'); setLoading(false); return; }
    try {
      const response = await getChatMessages(token, orderId, 1, 100);
      if (!response.success) throw new Error(response.message || 'Không thể tải lịch sử tin nhắn.');
      setMessages(response.data ?? []); setError(null);
      await markChatMessagesRead(token, orderId).catch(() => undefined);
    } catch (loadError) { if (!silent) setError(getApiErrorMessage(loadError)); }
    finally { setLoading(false); }
  }, [orderId, token]);

  useFocusEffect(useCallback(() => {
    let appState = AppState.currentState;
    void load();
    const timer = setInterval(() => { if (appState === 'active') void load(true); }, 5_000);
    const subscription = AppState.addEventListener('change', (nextState) => { appState = nextState; });
    return () => { clearInterval(timer); subscription.remove(); };
  }, [load]));

  const send = useCallback(async () => {
    const content = draft.trim();
    if (!token || !orderId || !counterpart || !content || sendingRef.current) return;
    sendingRef.current = true; setSending(true); setSendError(null);
    try {
      const response = await sendChatMessage(token, orderId, counterpart.userId, content);
      if (!response.success || !response.data) throw new Error(response.message || 'Không thể gửi tin nhắn.');
      setDraft('');
      setMessages((current) => mergeMessages(current, [response.data!]));
      void load(true);
    } catch (sendFailure) { setSendError(getApiErrorMessage(sendFailure)); }
    finally { sendingRef.current = false; setSending(false); }
  }, [counterpart, draft, load, orderId, token]);

  return (
    <SafeAreaView edges={['bottom']} className="flex-1 bg-[#F5F2F0]">
      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={88}>
        <View className="border-b border-[#DAC2B6]/60 bg-white px-5 py-3"><Text className="font-bold text-[#3A1F04]">Đơn {trackingCode || orderId?.slice(0, 8).toUpperCase() || '--'}</Text><Text className="mt-1 text-xs text-[#877369]">{counterpart?.name || 'Bộ phận phụ trách đơn hàng'}</Text></View>
        {loading ? <View className="flex-1 items-center justify-center"><ActivityIndicator size="large" color="#8B4513" /></View> : error ? <View className="flex-1 items-center justify-center p-6"><Text className="text-center text-red-800">{error}</Text><Pressable onPress={() => void load()} className="mt-4 rounded-xl bg-[#8B4513] px-5 py-3"><Text className="font-bold text-white">Thử lại</Text></Pressable></View> : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(message) => message.id}
            contentContainerStyle={{ padding: 16, gap: 10, flexGrow: 1, justifyContent: messages.length ? 'flex-start' : 'center' }}
            renderItem={({ item }) => <MessageBubble message={item} mine={item.senderId.toLowerCase() === currentUserId?.toLowerCase()} />}
            ListEmptyComponent={<View className="items-center"><Ionicons name="chatbubble-outline" size={44} color="#877369" /><Text className="mt-3 text-center text-[#877369]">Chưa có tin nhắn cho đơn hàng này.</Text></View>}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          />
        )}
        {!counterpart && !loading && !error ? <View className="border-t border-amber-200 bg-amber-50 px-4 py-3"><Text className="text-xs leading-5 text-amber-900">Backend chưa cung cấp danh sách nhân viên nhận tin cho hội thoại mới. Bạn có thể gửi sau khi bộ phận phụ trách bắt đầu trao đổi.</Text></View> : null}
        {sendError ? <Text className="bg-red-50 px-4 py-2 text-xs text-red-800">{sendError}</Text> : null}
        <View className="flex-row items-end gap-2 border-t border-[#DAC2B6]/60 bg-white p-3">
          <TextInput value={draft} onChangeText={setDraft} editable={!sending && Boolean(counterpart)} multiline maxLength={2000} placeholder={counterpart ? 'Nhập tin nhắn...' : 'Chưa xác định người phụ trách'} className="max-h-28 min-h-11 flex-1 rounded-2xl bg-[#F5F2F0] px-4 py-3 text-[#3A1F04]" />
          <Pressable accessibilityRole="button" accessibilityLabel="Gửi tin nhắn" disabled={!draft.trim() || sending || !counterpart} onPress={() => void send()} className={`h-11 w-11 items-center justify-center rounded-full ${draft.trim() && counterpart && !sending ? 'bg-[#8B4513]' : 'bg-[#DAC2B6]'}`}>{sending ? <ActivityIndicator size="small" color="white" /> : <Ionicons name="send" size={19} color="white" />}</Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function MessageBubble({ message, mine }: { message: ChatMessage; mine: boolean }) {
  return <View className={`max-w-[82%] rounded-2xl px-4 py-3 ${mine ? 'self-end bg-[#8B4513]' : 'self-start border border-[#DAC2B6]/60 bg-white'}`}><Text className={`text-sm leading-5 ${mine ? 'text-white' : 'text-[#3A1F04]'}`}>{message.messageContent}</Text><Text className={`mt-1 text-[10px] ${mine ? 'text-white/70' : 'text-[#877369]'}`}>{formatTime(message.createdAt)}{mine ? message.isRead ? ' · Đã đọc' : ' · Đã gửi' : ''}</Text></View>;
}

function mergeMessages(current: ChatMessage[], incoming: ChatMessage[]) { const map = new Map([...current, ...incoming].map((message) => [message.id, message])); return Array.from(map.values()).sort((left, right) => Date.parse(left.createdAt) - Date.parse(right.createdAt)); }
function formatTime(value: string) { const date = new Date(value); return Number.isNaN(date.getTime()) ? '--' : date.toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }); }
function single(value?: string | string[]) { return Array.isArray(value) ? value[0] : value; }
