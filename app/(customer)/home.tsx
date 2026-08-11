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

import { colors } from '../../constants/colors';
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
      className="flex-1"
      style={{ backgroundColor: colors.surface.page }}
      contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 120, gap: 20 }}
      contentInsetAdjustmentBehavior="automatic"
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => void refreshDashboard(true)} tintColor={colors.brand.primary} />}
    >
      {/* Light Enterprise Hero Banner */}
      <HeroCard onCreateOrder={() => router.push('/(customer)/create-order')} />

      {/* Quick Actions Grid */}
      <DashboardSection title="Thao tác nhanh">
        <View className="flex-row flex-wrap gap-3">
          <QuickActionCard
            icon="add-circle-outline"
            title="Tạo yêu cầu"
            subtitle="Gửi đơn hàng mới"
            isPrimary
            onPress={() => router.push('/(customer)/create-order')}
          />
          <QuickActionCard
            icon="location-outline"
            title="Giám sát"
            subtitle="Theo dõi lộ trình"
            onPress={() => router.push('/(customer)/tracking')}
          />
          <QuickActionCard
            icon="calendar-outline"
            title="Đặt lịch kho"
            subtitle="Đăng ký lịch giao"
            onPress={() => router.push('/(customer)/schedule-delivery' as never)}
          />
          <QuickActionCard
            icon="chatbubble-ellipses-outline"
            title="Hỗ trợ"
            subtitle="Trao đổi tư vấn"
            onPress={() => router.push('/(customer)/chat' as never)}
          />
        </View>
      </DashboardSection>

      {/* Operational Overview Metrics */}
      {(isOrdersLoading || isSchedulesLoading || orderTotal !== null || scheduleCount !== null) ? (
        <DashboardSection title="Tổng quan hoạt động">
          <View className="flex-row gap-3">
            <SummaryMetric icon="receipt-outline" label="Tổng đơn hàng" value={orderTotal} loading={isOrdersLoading} onPress={() => router.push('/(customer)/status')} />
            <SummaryMetric icon="calendar-outline" label="Lịch giao kho" value={scheduleCount} loading={isSchedulesLoading} onPress={() => router.push('/(customer)/delivery-schedules' as never)} />
          </View>
        </DashboardSection>
      ) : null}

      {/* Recent Orders List */}
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
        <Text style={{ color: colors.text.primary }} className="text-base font-bold">{title}</Text>
        {actionLabel && onActionPress ? (
          <Pressable onPress={onActionPress} accessibilityRole="button" accessibilityLabel={actionLabel} accessibilityHint="Mở danh sách đơn hàng" className="min-h-11 justify-center">
            <Text style={{ color: colors.brand.primary }} className="text-sm font-semibold">{actionLabel}</Text>
          </Pressable>
        ) : null}
      </View>
      {children}
    </View>
  );
}

function HeroCard({ onCreateOrder }: { onCreateOrder: () => void }) {
  return (
    <View
      style={{
        backgroundColor: colors.surface.card,
        borderColor: colors.border.default,
      }}
      className="overflow-hidden rounded-2xl border p-5 shadow-sm"
    >
      <View className="flex-row items-start justify-between">
        <View className="flex-1 pr-3">
          <View style={{ backgroundColor: colors.brand.primarySoft }} className="self-start rounded-full px-2.5 py-1 mb-2">
            <Text style={{ color: colors.brand.primary }} className="text-[11px] font-bold uppercase tracking-wider">ColdChainX Enterprise</Text>
          </View>
          <Text style={{ color: colors.text.primary }} className="text-xl font-bold leading-7">Vận chuyển lạnh thông minh</Text>
          <Text style={{ color: colors.text.secondary }} className="mt-1 text-xs leading-5">Theo dõi thời gian thực, quản lý lịch giao kho và giám sát nhiệt độ nghiêm ngặt.</Text>
        </View>

        <View style={{ backgroundColor: colors.brand.primarySoft }} className="h-12 w-12 items-center justify-center rounded-2xl">
          <Ionicons name="snow-outline" size={24} color={colors.brand.primary} />
        </View>
      </View>

      <Pressable
        onPress={onCreateOrder}
        accessibilityRole="button"
        accessibilityLabel="Tạo yêu cầu vận chuyển"
        accessibilityHint="Mở biểu mẫu tạo yêu cầu vận chuyển mới"
        style={({ pressed }) => ({
          backgroundColor: pressed ? colors.brand.primaryPressed : colors.brand.primary,
          opacity: pressed ? 0.9 : 1,
        })}
        className="mt-4 min-h-11 self-start flex-row items-center justify-center rounded-xl px-4 shadow-sm"
      >
        <Ionicons name="add-circle" size={18} color={colors.text.onPrimary} className="mr-2" />
        <Text style={{ color: colors.text.onPrimary }} className="text-sm font-bold">Tạo yêu cầu vận chuyển</Text>
      </Pressable>
    </View>
  );
}

function QuickActionCard({
  icon,
  title,
  subtitle,
  isPrimary = false,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  isPrimary?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${subtitle}`}
      style={({ pressed }) => ({
        backgroundColor: isPrimary ? colors.brand.primarySoft : colors.surface.card,
        borderColor: isPrimary ? colors.border.selected : colors.border.default,
        opacity: pressed ? 0.8 : 1,
      })}
      className="min-h-[96px] w-[48%] rounded-2xl border p-3.5 shadow-sm justify-between"
    >
      <View style={{ backgroundColor: isPrimary ? colors.surface.card : colors.brand.primarySoft }} className="h-9 w-9 items-center justify-center rounded-xl">
        <Ionicons name={icon} size={20} color={colors.brand.primary} />
      </View>
      <View className="mt-2">
        <Text style={{ color: colors.text.primary }} className="text-sm font-bold">{title}</Text>
        <Text style={{ color: colors.text.secondary }} className="mt-0.5 text-[11px]">{subtitle}</Text>
      </View>
    </Pressable>
  );
}

function SummaryMetric({ icon, label, value, loading, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: number | null; loading: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label}${value !== null ? `, ${value}` : ''}`}
      accessibilityHint={`Mở ${label.toLowerCase()}`}
      style={({ pressed }) => ({
        backgroundColor: colors.surface.card,
        borderColor: colors.border.default,
        opacity: pressed ? 0.75 : 1,
      })}
      className="min-h-[108px] flex-1 rounded-2xl border p-4 shadow-sm"
    >
      <View className="flex-row items-center justify-between">
        <View style={{ backgroundColor: colors.brand.primarySoft }} className="h-9 w-9 items-center justify-center rounded-xl">
          <Ionicons name={icon} size={18} color={colors.brand.primary} />
        </View>
        <Ionicons name="chevron-forward" size={16} color={colors.text.muted} />
      </View>
      {loading ? (
        <ActivityIndicator className="mt-2 self-start" size="small" color={colors.brand.primary} />
      ) : (
        <Text style={{ color: colors.text.primary }} className="mt-2 text-2xl font-bold">{value ?? '—'}</Text>
      )}
      <Text style={{ color: colors.text.secondary }} className="mt-0.5 text-xs font-medium">{label}</Text>
    </Pressable>
  );
}

function RecentOrderCard({ order, onPress }: { order: CustomerOrderSummaryResponse; onPress: () => void }) {
  const status = getCustomerOrderStatusPresentation(order.status);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Đơn ${order.trackingCode}, ${status.label}`}
      accessibilityHint="Mở chi tiết đơn hàng"
      style={({ pressed }) => ({
        backgroundColor: colors.surface.card,
        borderColor: colors.border.default,
        opacity: pressed ? 0.75 : 1,
      })}
      className="rounded-2xl border p-4 shadow-sm"
    >
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1">
          <Text style={{ color: colors.text.primary }} className="text-sm font-bold">{order.trackingCode}</Text>
          <Text style={{ color: colors.text.primary }} className="mt-1 text-base font-semibold" numberOfLines={1}>{order.itemName}</Text>
          {order.routeCode ? <Text style={{ color: colors.text.secondary }} className="mt-1 text-xs" numberOfLines={1}>Tuyến {order.routeCode}</Text> : null}
          {order.createdAt ? <Text style={{ color: colors.text.muted }} className="mt-1 text-xs">Tạo {formatCreatedAt(order.createdAt)}</Text> : null}
        </View>
        <View className={`rounded-full border px-2.5 py-1 ${status.containerClass}`}><Text className={`text-[10px] font-bold ${status.textClass}`}>{status.label}</Text></View>
      </View>
    </Pressable>
  );
}

function SectionLoader({ label }: { label: string }) {
  return (
    <View style={{ backgroundColor: colors.surface.card, borderColor: colors.border.default }} className="items-center rounded-2xl border py-8 shadow-sm">
      <ActivityIndicator size="small" color={colors.brand.primary} />
      <Text style={{ color: colors.text.secondary }} className="mt-3 text-sm">{label}</Text>
    </View>
  );
}

function SectionError({ label, onRetry }: { label: string; onRetry: () => void }) {
  return (
    <View className="rounded-2xl border border-red-100 bg-red-50 p-4">
      <Text className="text-sm font-medium leading-5 text-red-800">{label}</Text>
      <Pressable onPress={onRetry} accessibilityRole="button" accessibilityLabel="Thử tải lại" className="mt-3 min-h-11 self-start justify-center rounded-xl bg-white px-4 border border-red-200">
        <Text style={{ color: colors.status.danger.main }} className="text-sm font-bold">Thử lại</Text>
      </Pressable>
    </View>
  );
}

function EmptyOrders({ onCreateOrder }: { onCreateOrder: () => void }) {
  return (
    <View style={{ backgroundColor: colors.surface.card, borderColor: colors.border.default }} className="items-center rounded-2xl border px-5 py-8 shadow-sm">
      <View style={{ backgroundColor: colors.brand.primarySoft }} className="h-12 w-12 items-center justify-center rounded-full">
        <Ionicons name="cube-outline" size={24} color={colors.brand.primary} />
      </View>
      <Text style={{ color: colors.text.primary }} className="mt-3 text-base font-bold">Chưa có đơn hàng</Text>
      <Text style={{ color: colors.text.secondary }} className="mt-1 text-center text-sm leading-5">Tạo yêu cầu đầu tiên để bắt đầu theo dõi vận chuyển.</Text>
      <Pressable onPress={onCreateOrder} accessibilityRole="button" accessibilityLabel="Tạo yêu cầu vận chuyển đầu tiên" style={{ backgroundColor: colors.brand.primary }} className="mt-4 min-h-11 justify-center rounded-xl px-4">
        <Text style={{ color: colors.text.onPrimary }} className="text-sm font-bold">Tạo yêu cầu</Text>
      </Pressable>
    </View>
  );
}

function formatCreatedAt(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'gần đây' : date.toLocaleDateString('vi-VN');
}
