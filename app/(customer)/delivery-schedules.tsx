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
      <View className="flex-1 items-center justify-center bg-[#F5F2F0]">
        <ActivityIndicator size="large" color="#8B4513" />
        <Text className="mt-4 font-medium text-[#8B4513]">Đang tải lịch vận chuyển...</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-[#F5F2F0]">
      <View className="border-b border-[#DAC2B6]/40 bg-white px-5 py-4">
        <Text className="text-lg font-extrabold text-[#3A1F04]">Lịch vận chuyển của bạn</Text>
        <Text className="mt-1 text-xs font-medium text-[#877369]">
          Theo dõi toàn bộ ASN đã đặt lịch giao kho.
        </Text>

        <View className="mt-4 flex-row gap-3">
          <SummaryChip icon="calendar-outline" label="Tổng lịch" value={String(schedules.length)} />
          <SummaryChip icon="time-outline" label="Sắp giao" value={String(upcomingCount)} />
        </View>
      </View>

      {error ? (
        <View className="flex-1 items-center justify-center p-6">
          <Ionicons name="alert-circle-outline" size={48} color="#dc2626" />
          <Text selectable className="mt-4 text-center font-medium leading-6 text-red-600">{error}</Text>
          <Pressable onPress={fetchSchedules} className="mt-4 rounded-xl bg-[#8B4513] px-6 py-3">
            <Text className="font-bold text-white">Thử lại</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={sortedSchedules}
          keyExtractor={(item, index) => item.asnId || item.asnCode || `asn-${index}`}
          renderItem={renderSchedule}
          contentContainerStyle={{ padding: 20, paddingBottom: 110 }}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor="#8B4513" />
          }
          ListEmptyComponent={
            <View className="items-center justify-center py-20">
              <Ionicons name="calendar-outline" size={64} color="#877369" />
              <Text className="mt-4 text-center font-medium text-[#877369]">
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
      className="mb-4 rounded-2xl border border-[#DAC2B6]/50 bg-white p-5 shadow-sm"
    >
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1 gap-2">
          <ScheduleInfoLine icon="document-text-outline" label="Order ID" value={asn.orderId} />
          <ScheduleInfoLine icon="git-branch-outline" label="Route" value={asn.routeCode || asn.routeId || 'Chưa cập nhật'} />
          <ScheduleInfoLine icon="business-outline" label="Kho nhận" value={warehouseName || 'Chưa xác định'} />
          <ScheduleInfoLine icon="time-outline" label="Giờ giao kho" value={formatDateTime(asn.requestedDropoffTime)} />
        </View>
        <Ionicons name="chevron-forward" size={20} color="#8B4513" />
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
      <Ionicons name={icon} size={16} color="#8B4513" />
      <Text className="flex-1 text-sm leading-5 text-[#877369]" numberOfLines={2}>
        <Text className="font-bold text-[#3A1F04]">{label}: </Text>
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
    <View className="flex-1 rounded-2xl bg-[#F8F3EF] p-4">
      <View className="flex-row items-center gap-2">
        <Ionicons name={icon} size={18} color="#8B4513" />
        <Text className="text-[11px] font-bold uppercase tracking-wider text-[#877369]">{label}</Text>
      </View>
      <Text className="mt-2 text-2xl font-extrabold text-[#3A1F04]">{value}</Text>
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
