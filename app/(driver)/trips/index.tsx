import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, FlatList, ActivityIndicator, RefreshControl, TextInput } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { AppPressable as Pressable } from '../../../components/AppPressable';
import { colors } from '../../../constants/colors';
import { driverApi, TripListDto } from '../../../services/driverApi';
import { formatDateTimeVi } from '../../../constants/warehouseTheme';

type TripTab = 'ACTIVE' | 'UPCOMING' | 'COMPLETED';

const ACTIVE_STATUSES = new Set([
  'IN_TRANSIT',
  'IN-TRANSIT',
  'SEALED',
  'DISPATCHED',
  'LOADING',
  'LOADING_COMPLETED',
  'PICKING',
  'DELAYED',
]);

const UPCOMING_STATUSES = new Set(['PLANNED']);

const COMPLETED_STATUSES = new Set(['COMPLETED', 'CANCELLED', 'CLOSED']);

export default function DriverTripsScreen() {
  const router = useRouter();
  const [trips, setTrips] = useState<TripListDto[]>([]);
  const [activeTab, setActiveTab] = useState<TripTab>('ACTIVE');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const fetchTrips = async () => {
    try {
      setError('');
      const result = await driverApi.getMyTrips();
      setTrips(result);
    } catch (err: any) {
      setError(err.message || 'Không thể tải danh sách chuyến đi. Vui lòng thử lại.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchTrips();
    }, [])
  );

  const getStatusDisplay = (status: string) => {
    const map: Record<string, { label: string; colorClass: string }> = {
      PLANNED: { label: 'Đã lên kế hoạch', colorClass: 'text-blue-700 bg-blue-100 border-blue-200' },
      PICKING: { label: 'Đang lấy hàng', colorClass: 'text-purple-700 bg-purple-100 border-purple-200' },
      LOADING_COMPLETED: { label: 'Đã xếp hàng', colorClass: 'text-indigo-700 bg-indigo-100 border-indigo-200' },
      SEALED: { label: 'Đã kẹp chì', colorClass: 'text-orange-700 bg-orange-100 border-orange-200' },
      IN_TRANSIT: { label: 'Đang vận chuyển', colorClass: 'text-emerald-700 bg-emerald-100 border-emerald-200' },
      'IN-TRANSIT': { label: 'Đang vận chuyển', colorClass: 'text-emerald-700 bg-emerald-100 border-emerald-200' },
      DISPATCHED: { label: 'Đã điều phối', colorClass: 'text-emerald-700 bg-emerald-100 border-emerald-200' },
      LOADING: { label: 'Đang lên hàng', colorClass: 'text-emerald-700 bg-emerald-100 border-emerald-200' },
      DELAYED: { label: 'Bị trễ', colorClass: 'text-red-700 bg-red-100 border-red-200' },
      COMPLETED: { label: 'Hoàn tất', colorClass: 'text-gray-700 bg-gray-100 border-gray-200' },
      CANCELLED: { label: 'Đã hủy', colorClass: 'text-gray-500 bg-gray-100 border-gray-200' },
    };
    return map[status] || { label: status, colorClass: 'text-gray-700 bg-gray-100 border-gray-200' };
  };

  // Counts for tabs
  const tabCounts = useMemo(() => {
    let active = 0;
    let upcoming = 0;
    let completed = 0;

    trips.forEach((t) => {
      const s = (t.status || '').toUpperCase();
      if (ACTIVE_STATUSES.has(s)) active++;
      else if (UPCOMING_STATUSES.has(s)) upcoming++;
      else if (COMPLETED_STATUSES.has(s)) completed++;
    });

    return { active, upcoming, completed };
  }, [trips]);

  // Filtered trips by tab & search query
  const filteredTrips = useMemo(() => {
    return trips.filter((t) => {
      const s = (t.status || '').toUpperCase();
      let matchTab = false;

      if (activeTab === 'ACTIVE') matchTab = ACTIVE_STATUSES.has(s);
      else if (activeTab === 'UPCOMING') matchTab = UPCOMING_STATUSES.has(s);
      else if (activeTab === 'COMPLETED') matchTab = COMPLETED_STATUSES.has(s);

      if (!matchTab) return false;

      if (!searchQuery.trim()) return true;

      const q = searchQuery.toLowerCase().trim();
      const code = (t.tripCode || t.tripId || '').toLowerCase();
      const plate = (t.vehiclePlate || '').toLowerCase();
      const origin = (t.origin || '').toLowerCase();
      const dest = (t.destination || '').toLowerCase();

      return code.includes(q) || plate.includes(q) || origin.includes(q) || dest.includes(q);
    });
  }, [trips, activeTab, searchQuery]);

  const renderTrip = ({ item }: { item: TripListDto }) => {
    const statusInfo = getStatusDisplay(item.status);

    return (
      <Pressable
        onPress={() => router.push(`/(driver)/trips/${item.tripId}` as any)}
        style={({ pressed }) => ({
          backgroundColor: colors.surface.card,
          borderColor: colors.border.default,
          opacity: pressed ? 0.7 : 1,
        })}
        className="mb-3.5 rounded-2xl border p-4 shadow-sm"
      >
        <View className="mb-3 flex-row items-start justify-between">
          <View className="flex-1">
            <Text style={{ color: colors.text.primary }} className="text-base font-bold">
              {item.tripCode || `Chuyến ${item.tripId.substring(0, 8).toUpperCase()}`}
            </Text>
            {item.vehiclePlate && (
              <Text style={{ color: colors.text.secondary }} className="mt-1 text-sm font-medium">
                Xe: {item.vehiclePlate}
              </Text>
            )}
          </View>
          <View className={`rounded-lg border px-2.5 py-1.5 ${statusInfo.colorClass}`}>
            <Text className="text-xs font-bold uppercase">
              {statusInfo.label}
            </Text>
          </View>
        </View>

        <View className="mb-1.5 flex-row items-center">
          <Ionicons name="location" size={16} color={colors.brand.primary} />
          <Text style={{ color: colors.text.primary }} className="ml-2 flex-1 text-sm" numberOfLines={1}>
            {item.origin || 'Chưa xác định'}
          </Text>
        </View>
        <View className="mb-3 flex-row items-center">
          <Ionicons name="flag" size={16} color={colors.brand.primary} />
          <Text style={{ color: colors.text.primary }} className="ml-2 flex-1 text-sm" numberOfLines={1}>
            {item.destination || 'Chưa xác định'}
          </Text>
        </View>

        <View style={{ borderTopColor: colors.border.default }} className="flex-row items-center justify-between border-t pt-3">
          <View>
            <Text style={{ color: colors.text.muted }} className="text-xs">Khởi hành dự kiến</Text>
            <Text style={{ color: colors.text.primary }} className="mt-0.5 text-xs font-semibold">
              {formatDateTimeVi(item.plannedStartTime)}
            </Text>
          </View>
          <View className="items-end">
            <Text style={{ color: colors.text.muted }} className="text-xs">Đơn hàng</Text>
            <Text style={{ color: colors.brand.primary }} className="mt-0.5 text-xs font-bold">
              {item.totalOrders} đơn
            </Text>
          </View>
        </View>
      </Pressable>
    );
  };

  if (loading && !refreshing) {
    return (
      <View style={{ backgroundColor: colors.surface.page }} className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" color={colors.brand.primary} />
        <Text style={{ color: colors.brand.primary }} className="mt-4 font-medium">Đang tải danh sách chuyến...</Text>
      </View>
    );
  }

  return (
    <View style={{ backgroundColor: colors.surface.page }} className="flex-1">
      {/* ── TABS BAR (ĐANG CHẠY | SẮP TỚI | LỊCH SỬ) ── */}
      <View style={{ backgroundColor: colors.surface.card, borderColor: colors.border.default }} className="border-b px-4 pt-3 pb-2.5">
        <View className="flex-row items-center gap-2 rounded-2xl bg-gray-100/90 p-1">
          <Pressable
            onPress={() => setActiveTab('ACTIVE')}
            style={{
              backgroundColor: activeTab === 'ACTIVE' ? colors.surface.card : 'transparent',
            }}
            className="flex-1 flex-row items-center justify-center gap-1.5 rounded-xl py-2 shadow-xs"
          >
            <Text
              style={{
                color: activeTab === 'ACTIVE' ? colors.brand.primary : colors.text.secondary,
              }}
              className="text-xs font-bold"
            >
              Đang chạy
            </Text>
            {tabCounts.active > 0 ? (
              <View
                style={{
                  backgroundColor: activeTab === 'ACTIVE' ? colors.brand.primary : colors.surface.muted,
                }}
                className="rounded-full px-1.5 py-0.2"
              >
                <Text
                  style={{
                    color: activeTab === 'ACTIVE' ? '#ffffff' : colors.text.secondary,
                  }}
                  className="text-[10px] font-bold"
                >
                  {tabCounts.active}
                </Text>
              </View>
            ) : null}
          </Pressable>

          <Pressable
            onPress={() => setActiveTab('UPCOMING')}
            style={{
              backgroundColor: activeTab === 'UPCOMING' ? colors.surface.card : 'transparent',
            }}
            className="flex-1 flex-row items-center justify-center gap-1.5 rounded-xl py-2 shadow-xs"
          >
            <Text
              style={{
                color: activeTab === 'UPCOMING' ? colors.brand.primary : colors.text.secondary,
              }}
              className="text-xs font-bold"
            >
              Sắp tới
            </Text>
            {tabCounts.upcoming > 0 ? (
              <View
                style={{
                  backgroundColor: activeTab === 'UPCOMING' ? colors.brand.primary : colors.surface.muted,
                }}
                className="rounded-full px-1.5 py-0.2"
              >
                <Text
                  style={{
                    color: activeTab === 'UPCOMING' ? '#ffffff' : colors.text.secondary,
                  }}
                  className="text-[10px] font-bold"
                >
                  {tabCounts.upcoming}
                </Text>
              </View>
            ) : null}
          </Pressable>

          <Pressable
            onPress={() => setActiveTab('COMPLETED')}
            style={{
              backgroundColor: activeTab === 'COMPLETED' ? colors.surface.card : 'transparent',
            }}
            className="flex-1 flex-row items-center justify-center gap-1.5 rounded-xl py-2 shadow-xs"
          >
            <Text
              style={{
                color: activeTab === 'COMPLETED' ? colors.brand.primary : colors.text.secondary,
              }}
              className="text-xs font-bold"
            >
              Lịch sử
            </Text>
            {tabCounts.completed > 0 ? (
              <View
                style={{
                  backgroundColor: activeTab === 'COMPLETED' ? colors.brand.primary : colors.surface.muted,
                }}
                className="rounded-full px-1.5 py-0.2"
              >
                <Text
                  style={{
                    color: activeTab === 'COMPLETED' ? '#ffffff' : colors.text.secondary,
                  }}
                  className="text-[10px] font-bold"
                >
                  {tabCounts.completed}
                </Text>
              </View>
            ) : null}
          </Pressable>
        </View>

        {/* Quick Search */}
        {trips.length > 3 ? (
          <View className="mt-2.5 flex-row items-center rounded-xl bg-gray-100/80 px-3 py-1.5">
            <Ionicons name="search-outline" size={16} color={colors.text.muted} />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Tìm theo mã chuyến, biển số xe, địa chỉ..."
              placeholderTextColor={colors.text.muted}
              className="ml-2 flex-1 text-xs text-slate-800"
            />
            {searchQuery ? (
              <Pressable onPress={() => setSearchQuery('')} hitSlop={10}>
                <Ionicons name="close-circle" size={16} color={colors.text.muted} />
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </View>

      <FlatList
        data={filteredTrips}
        keyExtractor={(item) => item.tripId}
        renderItem={renderTrip}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              fetchTrips();
            }}
            tintColor={colors.brand.primary}
          />
        }
        ListHeaderComponent={
          error ? (
            <View className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4">
              <Text className="text-red-800">{error}</Text>
              <Pressable
                onPress={() => {
                  setLoading(true);
                  fetchTrips();
                }}
                className="mt-2"
              >
                <Text className="font-bold text-red-900">Thử lại</Text>
              </Pressable>
            </View>
          ) : null
        }
        ListEmptyComponent={
          !loading && !error ? (
            <View
              style={{ backgroundColor: colors.surface.card, borderColor: colors.border.default }}
              className="mt-10 items-center justify-center rounded-3xl border p-8 shadow-sm"
            >
              <Ionicons
                name={
                  activeTab === 'ACTIVE'
                    ? 'trail-sign-outline'
                    : activeTab === 'UPCOMING'
                    ? 'calendar-outline'
                    : 'checkmark-done-circle-outline'
                }
                size={56}
                color={colors.text.muted}
              />
              <Text style={{ color: colors.text.primary }} className="mt-4 text-base font-bold">
                {activeTab === 'ACTIVE'
                  ? 'Không có chuyến nào đang chạy'
                  : activeTab === 'UPCOMING'
                  ? 'Chưa có chuyến sắp tới'
                  : 'Chưa có lịch sử chuyến xe'}
              </Text>
              <Text style={{ color: colors.text.secondary }} className="mt-1.5 text-center text-xs leading-5">
                {activeTab === 'ACTIVE'
                  ? 'Khi bạn bắt đầu nhận chuyến hoặc được điều phối, chuyến xe sẽ xuất hiện tại đây.'
                  : activeTab === 'UPCOMING'
                  ? 'Các chuyến được lên kế hoạch trước sẽ hiển thị tại tab này.'
                  : 'Danh sách các chuyến xe đã hoàn tất sẽ được lưu trữ tại đây.'}
              </Text>
            </View>
          ) : null
        }
      />
    </View>
  );
}
