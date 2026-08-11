import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
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

  const isDashboardError = ordersError || schedulesError;

  return (
    <ScrollView
      className="flex-1"
      style={{ backgroundColor: colors.surface.page }}
      contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 120, gap: 20 }}
      contentInsetAdjustmentBehavior="automatic"
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => void refreshDashboard(true)} tintColor={colors.brand.primary} />}
    >
      {/* Enterprise Blue Hero Card (Utility-First) */}
      <HeroCard onCreateOrder={() => router.push('/(customer)/create-order')} />

      {/* Operational Overview Section */}
      {(isOrdersLoading || isSchedulesLoading || orderTotal !== null || scheduleCount !== null) ? (
        <DashboardSection title="Tổng quan">
          <View style={styles.metricsRow}>
            <SummaryMetric
              icon="receipt-outline"
              label="Đơn hàng"
              value={orderTotal}
              loading={isOrdersLoading}
              onPress={() => router.push('/(customer)/status')}
            />
            <SummaryMetric
              icon="calendar-outline"
              label="Lịch giao kho"
              value={scheduleCount}
              loading={isSchedulesLoading}
              onPress={() => router.push('/(customer)/delivery-schedules' as never)}
            />
          </View>
        </DashboardSection>
      ) : null}

      {/* Recent Orders List */}
      <DashboardSection title="Đơn hàng gần đây" actionLabel="Xem tất cả" onActionPress={() => router.push('/(customer)/status')}>
        {isOrdersLoading ? <SectionLoader label="Đang tải đơn hàng..." /> : null}
        {!isOrdersLoading && isDashboardError ? <SectionError label="Không thể tải dữ liệu gần đây." onRetry={() => void refreshDashboard()} /> : null}
        {!isOrdersLoading && !isDashboardError && recentOrders.length === 0 ? <EmptyOrders onCreateOrder={() => router.push('/(customer)/create-order')} /> : null}
        {!isOrdersLoading && !isDashboardError && recentOrders.length > 0 ? (
          <View className="gap-3">
            {recentOrders.map((order) => <RecentOrderCard key={order.orderId} order={order} onPress={() => router.push(`/(customer)/orders/${order.orderId}` as never)} />)}
          </View>
        ) : null}
      </DashboardSection>
    </ScrollView>
  );
}

function DashboardSection({ title, actionLabel, onActionPress, children }: { title: string; actionLabel?: string; onActionPress?: () => void; children: React.ReactNode }) {
  return (
    <View className="gap-2.5">
      <View className="flex-row items-center justify-between gap-4">
        <Text style={styles.sectionTitle}>{title}</Text>
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
    <View style={styles.heroCardContainer}>
      <View className="flex-row items-start justify-between">
        <View className="max-w-[68%]">
          <Text style={styles.heroTitle}>Quản lý vận chuyển lạnh</Text>
          <Text style={styles.heroSubtitle}>Tạo đơn hàng và theo dõi hành trình hàng hóa của bạn.</Text>
        </View>

        <View style={styles.heroIconSquare}>
          <Ionicons name="snow-outline" size={26} color="#FFFFFF" />
        </View>
      </View>

      <View style={styles.heroCta}>
        <Ionicons name="add-circle" size={18} color={colors.brand.primary} />
        <Text style={styles.heroCtaText}>Tạo đơn hàng</Text>

        <Pressable
          onPress={onCreateOrder}
          accessibilityRole="button"
          accessibilityLabel="Tạo đơn hàng"
          accessibilityHint="Mở biểu mẫu tạo đơn hàng mới"
          style={styles.touchOverlay}
        />
      </View>
    </View>
  );
}

function SummaryMetric({ icon, label, value, loading, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: number | null; loading: boolean; onPress: () => void }) {
  return (
    <View style={styles.metricCard}>
      <View style={styles.metricIconContainer}>
        <Ionicons name={icon} size={18} color={colors.brand.primary} />
      </View>

      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        {loading ? (
          <ActivityIndicator style={{ alignSelf: 'flex-start' }} size="small" color={colors.brand.primary} />
        ) : (
          <Text style={styles.metricValueText}>{value ?? 0}</Text>
        )}
        <Text style={styles.metricLabelText}>{label}</Text>
      </View>

      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${label}${value !== null ? `, ${value}` : ''}`}
        accessibilityHint={`Mở ${label.toLowerCase()}`}
        style={styles.touchOverlay}
      />
    </View>
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
        borderWidth: 1,
        borderRadius: 14,
        opacity: pressed ? 0.75 : 1,
      })}
      className="p-4"
    >
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1">
          <Text style={{ color: colors.brand.primary }} className="text-sm font-bold">{order.trackingCode}</Text>
          <Text style={{ color: colors.text.primary }} className="mt-1 text-base font-semibold" numberOfLines={1}>{order.itemName}</Text>
          {order.routeCode ? <Text style={{ color: colors.text.secondary }} className="mt-1 text-xs" numberOfLines={1}>Tuyến {order.routeCode}</Text> : null}
          {order.createdAt ? <Text style={{ color: colors.text.muted }} className="mt-1 text-xs">Tạo {formatCreatedAt(order.createdAt)}</Text> : null}
        </View>
        <View className={`rounded-full border px-2.5 py-1 ${status.containerClass}`}>
          <Text className={`text-[10px] font-bold ${status.textClass}`}>{status.label}</Text>
        </View>
      </View>
    </Pressable>
  );
}

function SectionLoader({ label }: { label: string }) {
  return (
    <View style={{ backgroundColor: colors.surface.card, borderColor: colors.border.default, borderWidth: 1 }} className="items-center rounded-xl py-6">
      <ActivityIndicator size="small" color={colors.brand.primary} />
      <Text style={{ color: colors.text.secondary }} className="mt-2 text-xs">{label}</Text>
    </View>
  );
}

function SectionError({ label, onRetry }: { label: string; onRetry: () => void }) {
  return (
    <View
      style={{
        backgroundColor: colors.status.danger.bg,
        borderColor: colors.status.danger.border,
        borderWidth: 1,
      }}
      className="flex-row items-center justify-between rounded-xl p-3"
    >
      <View className="flex-row items-center gap-2 flex-1 pr-2">
        <Ionicons name="alert-circle-outline" size={18} color={colors.status.danger.main} />
        <Text style={{ color: colors.status.danger.main }} className="text-xs font-medium flex-1">{label}</Text>
      </View>
      <Pressable
        onPress={onRetry}
        accessibilityRole="button"
        accessibilityLabel="Thử tải lại"
        style={({ pressed }) => ({
          backgroundColor: pressed ? colors.status.danger.border : '#FFFFFF',
          borderColor: colors.status.danger.border,
          borderWidth: 1,
        })}
        className="h-8 items-center justify-center rounded-lg px-3"
      >
        <Text style={{ color: colors.status.danger.main }} className="text-xs font-bold">Thử lại</Text>
      </Pressable>
    </View>
  );
}

function EmptyOrders({ onCreateOrder }: { onCreateOrder: () => void }) {
  return (
    <View style={{ backgroundColor: colors.surface.card, borderColor: colors.border.default, borderWidth: 1 }} className="items-center rounded-xl px-5 py-6">
      <View style={{ backgroundColor: colors.brand.primarySoft }} className="h-10 w-10 items-center justify-center rounded-lg">
        <Ionicons name="cube-outline" size={22} color={colors.brand.primary} />
      </View>
      <Text style={{ color: colors.text.primary }} className="mt-2 text-sm font-bold">Chưa có đơn hàng</Text>
      <Text style={{ color: colors.text.secondary }} className="mt-1 text-center text-xs leading-5">Tạo đơn hàng đầu tiên để bắt đầu theo dõi.</Text>
      <Pressable
        onPress={onCreateOrder}
        accessibilityRole="button"
        accessibilityLabel="Tạo đơn hàng"
        style={({ pressed }) => ({
          backgroundColor: pressed ? colors.brand.primaryPressed : colors.brand.primary,
        })}
        className="mt-3 h-9 items-center justify-center rounded-lg px-3.5"
      >
        <Text style={{ color: colors.text.onPrimary }} className="text-xs font-bold">Tạo đơn hàng</Text>
      </Pressable>
    </View>
  );
}

function formatCreatedAt(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'gần đây' : date.toLocaleDateString('vi-VN');
}

const styles = StyleSheet.create({
  sectionTitle: {
    color: colors.text.primary,
    fontSize: 18,
    fontWeight: '700',
  },
  heroCardContainer: {
    backgroundColor: colors.brand.primary,
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 18,
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 28,
  },
  heroSubtitle: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 13,
    lineHeight: 18,
    marginTop: 6,
  },
  heroIconSquare: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroCta: {
    alignSelf: 'flex-start',
    height: 42,
    paddingHorizontal: 15,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 18,
    position: 'relative',
  },
  heroCtaText: {
    color: colors.text.primary,
    fontSize: 14,
    fontWeight: '600',
    includeFontPadding: false,
  },
  metricsRow: {
    width: '100%',
    flexDirection: 'row',
    gap: 12,
    alignItems: 'stretch',
  },
  metricCard: {
    flex: 1,
    minWidth: 0,
    minHeight: 98,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    position: 'relative',
  },
  metricIconContainer: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: colors.brand.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricValueText: {
    color: colors.text.primary,
    fontSize: 22,
    fontWeight: '700',
    includeFontPadding: false,
  },
  metricLabelText: {
    color: colors.text.secondary,
    fontSize: 12,
    fontWeight: '500',
    includeFontPadding: false,
    marginTop: 2,
  },
  touchOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
});
