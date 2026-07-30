import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';

import { getCustomerAsns } from '../../services/asnApi';
import { customerApi, CustomerOrderSummaryResponse } from '../../services/customerApi';
import { getCustomerIdFromToken } from '../../services/jwt';
import { useAuthStore } from '../../store/useAuthStore';
import { getCustomerOrderStatusPresentation } from '../../constants/customerOrderPresentation';

const RECENT_ORDER_PAGE_SIZE = 2;

export default function CustomerHomeScreen() {
  const router = useRouter();
  const accessToken = useAuthStore((state) => state.token);
  const storedCustomerId = useAuthStore((state) => state.customerId ?? state.user?.customerId ?? null);
  const customerId = storedCustomerId ?? (accessToken ? getCustomerIdFromToken(accessToken) : null);
  const [recentOrders, setRecentOrders] = useState<CustomerOrderSummaryResponse[]>([]);
  const [orderTotal, setOrderTotal] = useState<number | null>(null);
  const [scheduleCount, setScheduleCount] = useState<number | null>(null);
  const [isOrdersLoading, setIsOrdersLoading] = useState(true);
  const [isSchedulesLoading, setIsSchedulesLoading] = useState(true);
  const [ordersError, setOrdersError] = useState(false);
  const [schedulesError, setSchedulesError] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadOrders = useCallback(async () => {
    setIsOrdersLoading(true);
    setOrdersError(false);
    try {
      const page = await customerApi.getMyOrders(1, RECENT_ORDER_PAGE_SIZE);
      setRecentOrders(page.data ?? []);
      setOrderTotal(page.totalRecords);
    } catch {
      setOrderTotal(null);
      setOrdersError(true);
    } finally {
      setIsOrdersLoading(false);
    }
  }, []);

  const loadSchedules = useCallback(async () => {
    setIsSchedulesLoading(true);
    setSchedulesError(false);
    if (!accessToken || !customerId) {
      setScheduleCount(null);
      setSchedulesError(true);
      setIsSchedulesLoading(false);
      return;
    }

    try {
      const response = await getCustomerAsns(accessToken, customerId);
      if (!response.success || !response.data) throw new Error('Unable to load schedules.');
      setScheduleCount(response.data.length);
    } catch {
      setScheduleCount(null);
      setSchedulesError(true);
    } finally {
      setIsSchedulesLoading(false);
    }
  }, [accessToken, customerId]);

  const refreshDashboard = useCallback(async (showRefreshIndicator = false) => {
    if (showRefreshIndicator) setIsRefreshing(true);
    await Promise.all([loadOrders(), loadSchedules()]);
    if (showRefreshIndicator) setIsRefreshing(false);
  }, [loadOrders, loadSchedules]);

  useFocusEffect(useCallback(() => {
    void refreshDashboard();
  }, [refreshDashboard]));

  return (
    <ScrollView
      className="flex-1 bg-[#F5F2F0]"
      contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 24, paddingBottom: 120, gap: 24 }}
      contentInsetAdjustmentBehavior="automatic"
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => void refreshDashboard(true)} tintColor="#8B4513" />}
    >
      <HeroCard onCreateOrder={() => router.push('/(customer)/create-order')} />

      {(isOrdersLoading || isSchedulesLoading || orderTotal !== null || scheduleCount !== null) ? (
        <DashboardSection title="Tổng quan hoạt động">
          <View className="flex-row gap-3">
            <SummaryMetric icon="receipt-outline" label="Đơn hàng" value={orderTotal} loading={isOrdersLoading} onPress={() => router.push('/(customer)/status')} />
            <SummaryMetric icon="calendar-outline" label="Lịch giao kho" value={scheduleCount} loading={isSchedulesLoading} onPress={() => router.push('/(customer)/delivery-schedules' as never)} />
          </View>
        </DashboardSection>
      ) : null}

      <DashboardSection title="Đơn hàng gần đây" actionLabel="Xem tất cả" onActionPress={() => router.push('/(customer)/status')}>
        {isOrdersLoading ? <SectionLoader label="Đang tải đơn hàng..." /> : null}
        {!isOrdersLoading && ordersError ? <SectionError label="Không thể tải đơn hàng lúc này." onRetry={() => void loadOrders()} /> : null}
        {!isOrdersLoading && !ordersError && recentOrders.length === 0 ? <EmptyOrders onCreateOrder={() => router.push('/(customer)/create-order')} /> : null}
        {!isOrdersLoading && !ordersError && recentOrders.length > 0 ? (
          <View className="gap-3">
            {recentOrders.map((order) => <RecentOrderCard key={order.orderId} order={order} onPress={() => router.push(`/(customer)/orders/${order.orderId}` as never)} />)}
          </View>
        ) : null}
      </DashboardSection>

      {schedulesError ? <SectionError label="Không thể tải lịch giao kho lúc này." onRetry={() => void loadSchedules()} /> : null}
    </ScrollView>
  );
}

function DashboardSection({ title, actionLabel, onActionPress, children }: { title: string; actionLabel?: string; onActionPress?: () => void; children: React.ReactNode }) {
  return (
    <View className="gap-3">
      <View className="flex-row items-center justify-between gap-4">
        <Text className="text-lg font-bold text-[#3A1F04]">{title}</Text>
        {actionLabel && onActionPress ? (
          <Pressable onPress={onActionPress} accessibilityRole="button" accessibilityLabel={actionLabel} accessibilityHint="Mở danh sách đơn hàng" className="min-h-11 justify-center">
            <Text className="text-sm font-semibold text-[#8B4513]">{actionLabel}</Text>
          </Pressable>
        ) : null}
      </View>
      {children}
    </View>
  );
}

function HeroCard({ onCreateOrder }: { onCreateOrder: () => void }) {
  return (
    <View className="overflow-hidden rounded-[24px] bg-[#3A1F04] px-5 py-6">
      <View className="absolute -right-7 -top-5 h-36 w-36 rounded-full bg-[#8B4513]" />
      <View className="absolute right-6 top-7 h-20 w-20 items-center justify-center rounded-3xl border border-white/20 bg-white/10">
        <Ionicons name="cube-outline" size={40} color="#FFC29F" />
        <Ionicons name="snow-outline" size={17} color="#FFFFFF" style={{ position: 'absolute', right: 9, top: 8 }} />
      </View>
      <View className="max-w-[68%]">
        <Text className="text-[11px] font-bold uppercase tracking-[2px] text-[#FFC29F]">ColdChainX</Text>
        <Text className="mt-3 text-2xl font-bold leading-8 text-white">Vận chuyển lạnh dễ dàng hơn</Text>
        <Text className="mt-2 text-sm leading-5 text-white/75">Tạo yêu cầu, theo dõi lịch giao và giám sát hành trình trong một nơi.</Text>
      </View>
      <Pressable
        onPress={onCreateOrder}
        accessibilityRole="button"
        accessibilityLabel="Tạo yêu cầu vận chuyển"
        accessibilityHint="Mở biểu mẫu tạo yêu cầu vận chuyển mới"
        className="mt-6 min-h-12 self-start justify-center rounded-xl bg-[#FFC29F] px-4"
        style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
      >
        <View className="flex-row items-center gap-2">
          <Ionicons name="add-circle-outline" size={19} color="#3A1F04" />
          <Text className="text-sm font-bold text-[#3A1F04]">Tạo yêu cầu vận chuyển</Text>
        </View>
      </Pressable>
    </View>
  );
}

function SummaryMetric({ icon, label, value, loading, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: number | null; loading: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${label}${value !== null ? `, ${value}` : ''}`} accessibilityHint={`Mở ${label.toLowerCase()}`} className="min-h-[118px] flex-1 rounded-2xl border border-[#DAC2B6]/50 bg-white p-4" style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })}>
      <View className="h-10 w-10 items-center justify-center rounded-full bg-[#F8F3EF]"><Ionicons name={icon} size={20} color="#8B4513" /></View>
      {loading ? <ActivityIndicator className="mt-3 self-start" size="small" color="#8B4513" /> : <Text className="mt-3 text-2xl font-bold text-[#3A1F04]">{value ?? '—'}</Text>}
      <Text className="mt-1 text-xs font-medium text-[#877369]">{label}</Text>
    </Pressable>
  );
}

function RecentOrderCard({ order, onPress }: { order: CustomerOrderSummaryResponse; onPress: () => void }) {
  const status = getCustomerOrderStatusPresentation(order.status);

  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`Đơn ${order.trackingCode}, ${status.label}`} accessibilityHint="Mở chi tiết đơn hàng" className="rounded-2xl border border-[#DAC2B6]/50 bg-white p-4" style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })}>
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1">
          <Text className="text-sm font-bold text-[#8B4513]">{order.trackingCode}</Text>
          <Text className="mt-1 text-base font-semibold text-[#3A1F04]" numberOfLines={1}>{order.itemName}</Text>
          {order.routeCode ? <Text className="mt-1 text-xs text-[#877369]" numberOfLines={1}>Tuyến {order.routeCode}</Text> : null}
          {order.createdAt ? <Text className="mt-1 text-xs text-[#877369]">Tạo {formatCreatedAt(order.createdAt)}</Text> : null}
        </View>
        <View className={`rounded-full border px-2.5 py-1 ${status.containerClass}`}><Text className={`text-[10px] font-bold ${status.textClass}`}>{status.label}</Text></View>
      </View>
    </Pressable>
  );
}

function SectionLoader({ label }: { label: string }) {
  return <View className="items-center rounded-2xl border border-[#DAC2B6]/50 bg-white py-8"><ActivityIndicator size="small" color="#8B4513" /><Text className="mt-3 text-sm text-[#877369]">{label}</Text></View>;
}

function SectionError({ label, onRetry }: { label: string; onRetry: () => void }) {
  return <View className="rounded-2xl border border-red-100 bg-red-50 p-4"><Text className="text-sm font-medium leading-5 text-red-800">{label}</Text><Pressable onPress={onRetry} accessibilityRole="button" accessibilityLabel="Thử tải lại" className="mt-3 min-h-11 self-start justify-center rounded-xl bg-white px-4"><Text className="text-sm font-bold text-[#8B4513]">Thử lại</Text></Pressable></View>;
}

function EmptyOrders({ onCreateOrder }: { onCreateOrder: () => void }) {
  return <View className="items-center rounded-2xl border border-[#DAC2B6]/50 bg-white px-5 py-8"><View className="h-12 w-12 items-center justify-center rounded-full bg-[#F8F3EF]"><Ionicons name="cube-outline" size={24} color="#8B4513" /></View><Text className="mt-3 text-base font-bold text-[#3A1F04]">Chưa có đơn hàng</Text><Text className="mt-1 text-center text-sm leading-5 text-[#877369]">Tạo yêu cầu đầu tiên để bắt đầu theo dõi vận chuyển.</Text><Pressable onPress={onCreateOrder} accessibilityRole="button" accessibilityLabel="Tạo yêu cầu vận chuyển đầu tiên" className="mt-4 min-h-11 justify-center rounded-xl bg-[#8B4513] px-4"><Text className="text-sm font-bold text-white">Tạo yêu cầu</Text></Pressable></View>;
}

function formatCreatedAt(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'gần đây' : date.toLocaleDateString('vi-VN');
}
