import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  View,
} from 'react-native';

import { colors } from '../../constants/colors';
import { getApiErrorMessage } from '../../services/apiClient';
import { getCustomerAsns, type AsnResponse } from '../../services/asnApi';
import { getCustomerIdFromToken } from '../../services/jwt';
import { getWarehouses } from '../../services/warehouseApi';
import { useAuthStore } from '../../store/useAuthStore';

export default function DeliverySchedulesScreen() {
  const router = useRouter();
  const accessToken = useAuthStore((state) => state.token);
  const storedCustomerId = useAuthStore((state) => state.customerId ?? state.user?.customerId ?? null);
  const customerId = storedCustomerId ?? (accessToken ? getCustomerIdFromToken(accessToken) : null);

  const [schedules, setSchedules] = useState<AsnResponse[]>([]);
  const [warehouseNamesById, setWarehouseNamesById] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sortedSchedules = useMemo(() => sortSchedulesByDropoff(schedules), [schedules]);
  const upcomingCount = useMemo(() => getUpcomingScheduleCount(schedules), [schedules]);

  const fetchSchedules = useCallback(async () => {
    if (!accessToken || !customerId) {
      setError('Không tìm thấy mã khách hàng. Vui lòng đăng xuất và đăng nhập lại.');
      setSchedules([]);
      setWarehouseNamesById({});
      setIsLoading(false);
      setIsRefreshing(false);
      return;
    }

    try {
      setError(null);

      const [asnResult, warehouseResult] = await Promise.allSettled([
        getCustomerAsns(accessToken, customerId),
        getWarehouses(accessToken, { pageNumber: 1, pageSize: 100 }),
      ]);

      if (asnResult.status === 'rejected') {
        throw asnResult.reason;
      }

      const asnResponse = asnResult.value;
      if (!asnResponse.success) {
        throw new Error(asnResponse.message || 'Không thể tải danh sách lịch giao.');
      }

      setSchedules(asnResponse.data ?? []);

      if (warehouseResult.status === 'fulfilled' && warehouseResult.value.success) {
        setWarehouseNamesById(
          Object.fromEntries(
            (warehouseResult.value.data?.data ?? []).map((warehouse) => [
              warehouse.warehouseId,
              warehouse.warehouseName,
            ])
          )
        );
      }
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [accessToken, customerId]);

  useFocusEffect(
    useCallback(() => {
      setIsLoading(true);
      fetchSchedules();
    }, [fetchSchedules])
  );

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchSchedules();
  };

  const renderSchedule = ({ item }: { item: AsnResponse }) => (
    <DeliveryScheduleCard
      asn={item}
      warehouseName={item.warehouseId ? warehouseNamesById[item.warehouseId] : null}
      onPress={() =>
        router.push({
          pathname: '/(customer)/schedule-delivery',
          params: {
            orderId: item.orderId,
            asnId: item.asnId,
          },
        } as never)
      }
    />
  );

  if (isLoading) {
    return (
      <View style={{ backgroundColor: colors.surface.page }} className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" color={colors.brand.primary} />
        <Text style={{ color: colors.brand.primary }} className="mt-4 font-medium">Đang tải lịch vận chuyển...</Text>
      </View>
    );
  }

  return (
    <View style={{ backgroundColor: colors.surface.page }} className="flex-1">
      <View style={{ backgroundColor: colors.surface.card, borderBottomColor: colors.border.default }} className="border-b px-5 py-4">
        <Text style={{ color: colors.text.primary }} className="text-lg font-extrabold">Lịch vận chuyển của bạn</Text>
        <Text style={{ color: colors.text.secondary }} className="mt-1 text-xs font-medium">
          Theo dõi toàn bộ ASN đã đặt lịch giao kho.
        </Text>

        <View className="mt-4 flex-row gap-3">
          <SummaryChip icon="calendar-outline" label="Tổng lịch" value={String(schedules.length)} />
          <SummaryChip icon="time-outline" label="Sắp giao" value={String(upcomingCount)} />
        </View>
      </View>

      {error ? (
        <View className="flex-1 items-center justify-center p-6">
          <Ionicons name="alert-circle-outline" size={48} color={colors.status.danger.main} />
          <Text style={{ color: colors.status.danger.main }} className="mt-4 text-center font-medium leading-6">{error}</Text>
          <Pressable onPress={fetchSchedules} style={{ backgroundColor: colors.brand.primary }} className="mt-4 rounded-xl px-6 py-3">
            <Text style={{ color: colors.text.onPrimary }} className="font-bold">Thử lại</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={sortedSchedules}
          keyExtractor={(item, index) => item.asnId || item.asnCode || `asn-${index}`}
          renderItem={renderSchedule}
          contentContainerStyle={{ padding: 20, paddingBottom: 110 }}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor={colors.brand.primary} />
          }
          ListEmptyComponent={
            <View className="items-center justify-center py-20">
              <Ionicons name="calendar-outline" size={64} color={colors.text.muted} />
              <Text style={{ color: colors.text.secondary }} className="mt-4 text-center font-medium">
                Bạn chưa có lịch vận chuyển nào.
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

function DeliveryScheduleCard({
  asn,
  warehouseName,
  onPress,
}: {
  asn: AsnResponse;
  warehouseName?: string | null;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{ backgroundColor: colors.surface.card, borderColor: colors.border.default }}
      className="mb-4 rounded-2xl border p-5 shadow-sm"
    >
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1 gap-2">
          <ScheduleInfoLine icon="document-text-outline" label="Order ID" value={asn.orderId} />
          <ScheduleInfoLine icon="git-branch-outline" label="Route" value={asn.routeCode || asn.routeId || 'Chưa cập nhật'} />
          <ScheduleInfoLine icon="business-outline" label="Kho nhận" value={warehouseName || 'Chưa xác định'} />
          <ScheduleInfoLine icon="time-outline" label="Giờ giao kho" value={formatDateTime(asn.requestedDropoffTime)} />
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.brand.primary} />
      </View>
    </Pressable>
  );
}

function ScheduleInfoLine({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value?: string | null;
}) {
  return (
    <View className="flex-row items-start gap-2">
      <Ionicons name={icon} size={16} color={colors.brand.primary} />
      <Text style={{ color: colors.text.secondary }} className="flex-1 text-sm leading-5" numberOfLines={2}>
        <Text style={{ color: colors.text.primary }} className="font-bold">{label}: </Text>
        {value || 'Chưa cập nhật'}
      </Text>
    </View>
  );
}

function SummaryChip({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View style={{ backgroundColor: colors.surface.muted }} className="flex-1 rounded-2xl p-4">
      <View className="flex-row items-center gap-2">
        <Ionicons name={icon} size={18} color={colors.brand.primary} />
        <Text style={{ color: colors.text.secondary }} className="text-[11px] font-bold uppercase tracking-wider">{label}</Text>
      </View>
      <Text style={{ color: colors.text.primary }} className="mt-2 text-2xl font-extrabold">{value}</Text>
    </View>
  );
}

function sortSchedulesByDropoff(schedules: AsnResponse[]) {
  return [...schedules].sort(
    (left, right) => getDateTime(left.requestedDropoffTime) - getDateTime(right.requestedDropoffTime)
  );
}

function getUpcomingScheduleCount(schedules: AsnResponse[]) {
  const now = Date.now();

  return schedules.filter((schedule) => getDateTime(schedule.requestedDropoffTime) >= now).length;
}

function formatDateTime(value?: string | null) {
  return value ? new Date(value).toLocaleString('vi-VN') : 'Chưa cập nhật';
}

function getDateTime(value?: string | null) {
  if (!value) return 0;

  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}
