import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, FlatList, ActivityIndicator, RefreshControl, TextInput } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { AppPressable as Pressable } from '../../components/AppPressable';
import { colors } from '../../constants/colors';
import { driverApi, TripListDto } from '../../services/driverApi';
import { formatDateTimeVi } from '../../constants/warehouseTheme';

type FilterTab = 'ALL' | 'COMPLETED' | 'IN_TRANSIT' | 'CANCELLED';

export default function DriverTripHistoryScreen() {
  const router = useRouter();
  const [trips, setTrips] = useState<TripListDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<FilterTab>('ALL');

  const fetchTripHistory = async () => {
    try {
      setError('');
      // Fetch both history endpoint and all trips to ensure full coverage
      let historyList: TripListDto[] = [];
      try {
        historyList = await driverApi.getMyTripHistory(1, 50);
      } catch {
        // Fallback to getMyTrips if trip-history endpoint is unavailable
        historyList = await driverApi.getMyTrips();
      }

      // If historyList is empty or only has partial, merge with all driver trips
      if (!historyList || historyList.length === 0) {
        const allTrips = await driverApi.getMyTrips();
        setTrips(allTrips);
      } else {
        setTrips(historyList);
      }
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error
          ? err.message
          : 'Không thể tải lịch sử chuyến đi. Vui lòng thử lại.';
      setError(errorMessage);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchTripHistory();
    }, [])
  );

  const getStatusDisplay = (status: string) => {
    const normalized = (status || '').toUpperCase().replace(/-/g, '_');
    const map: Record<string, { label: string; colorClass: string }> = {
      COMPLETED: { label: 'Hoàn tất', colorClass: 'text-slate-700 bg-slate-100 border-slate-300' },
      CANCELLED: { label: 'Đã hủy', colorClass: 'text-red-700 bg-red-100 border-red-200' },
      IN_TRANSIT: { label: 'Đang vận chuyển', colorClass: 'text-emerald-700 bg-emerald-100 border-emerald-200' },
      DISPATCHED: { label: 'Đã điều phối', colorClass: 'text-emerald-700 bg-emerald-100 border-emerald-200' },
      PLANNED: { label: 'Đã lên kế hoạch', colorClass: 'text-blue-700 bg-blue-100 border-blue-200' },
      RETURNING: { label: 'Đang trả hàng về kho', colorClass: 'text-amber-700 bg-amber-100 border-amber-200' },
      DELAYED: { label: 'Bị trễ', colorClass: 'text-red-700 bg-red-100 border-red-200' },
    };
    return map[normalized] || { label: status || 'Chưa rõ', colorClass: 'text-gray-700 bg-gray-100 border-gray-200' };
  };

  const filteredTrips = useMemo(() => {
    return trips.filter((t) => {
      // Tab filter
      const normalizedStatus = (t.status || '').toUpperCase().replace(/-/g, '_');
      if (activeTab === 'COMPLETED' && normalizedStatus !== 'COMPLETED') return false;
      if (activeTab === 'CANCELLED' && normalizedStatus !== 'CANCELLED') return false;
      if (activeTab === 'IN_TRANSIT' && normalizedStatus !== 'IN_TRANSIT' && normalizedStatus !== 'RETURNING') return false;

      // Search query filter
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      const code = (t.tripCode || t.tripId || '').toLowerCase();
      const plate = (t.vehiclePlate || '').toLowerCase();
      const origin = (t.origin || '').toLowerCase();
      const dest = (t.destination || '').toLowerCase();

      return code.includes(q) || plate.includes(q) || origin.includes(q) || dest.includes(q);
    });
  }, [trips, activeTab, searchQuery]);

  const stats = useMemo(() => {
    const completedCount = trips.filter((t) => (t.status || '').toUpperCase() === 'COMPLETED').length;
    const totalOrders = trips.reduce((sum, t) => sum + (t.totalOrders || 0), 0);
    return { completedCount, totalOrders, totalTrips: trips.length };
  }, [trips]);

  const renderTripItem = ({ item }: { item: TripListDto }) => {
    const statusInfo = getStatusDisplay(item.status);
    const tripTitle = item.tripCode || `Chuyến ${item.tripId.substring(0, 8).toUpperCase()}`;

    return (
      <Pressable
        onPress={() =>
          router.push({
            pathname: '/(driver)/trips/[id]',
            params: { id: item.tripId },
          })
        }
        style={({ pressed }) => ({
          backgroundColor: colors.surface.card,
          borderColor: colors.border.default,
          opacity: pressed ? 0.8 : 1,
        })}
        className="mb-4 rounded-2xl border p-4 shadow-sm"
      >
        <View className="mb-3 flex-row items-start justify-between">
          <View className="flex-1 pr-2">
            <Text style={{ color: colors.text.primary }} className="text-base font-bold">
              {tripTitle}
            </Text>
            {item.vehiclePlate ? (
              <Text style={{ color: colors.text.secondary }} className="mt-1 text-sm font-medium">
                Xe: {item.vehiclePlate}
              </Text>
            ) : null}
          </View>
          <View className={`rounded-lg border px-2.5 py-1.5 ${statusInfo.colorClass}`}>
            <Text className="text-xs font-bold uppercase">{statusInfo.label}</Text>
          </View>
        </View>

        <View className="mb-1.5 flex-row items-center">
          <Ionicons name="location" size={16} color={colors.brand.primary} className="mr-2" />
          <Text style={{ color: colors.text.primary }} className="ml-2 flex-1 text-sm" numberOfLines={1}>
            {item.origin || 'Kho xuất phát'}
          </Text>
        </View>

        <View className="mb-3 flex-row items-center">
          <Ionicons name="flag" size={16} color={colors.brand.primary} className="mr-2" />
          <Text style={{ color: colors.text.primary }} className="ml-2 flex-1 text-sm" numberOfLines={1}>
            {item.destination || 'Điểm đến cuối'}
          </Text>
        </View>

        <View style={{ borderTopColor: colors.border.default }} className="flex-row items-center justify-between border-t pt-3">
          <View>
            <Text style={{ color: colors.text.muted }} className="text-xs">
              {item.completedAt ? 'Hoàn tất lúc' : 'Khởi hành dự kiến'}
            </Text>
            <Text style={{ color: colors.text.primary }} className="mt-1 text-sm font-semibold">
              {formatDateTimeVi(item.completedAt || item.startedAt || item.plannedStartTime)}
            </Text>
          </View>
          <View className="items-end">
            <Text style={{ color: colors.text.muted }} className="text-xs">Đơn hàng</Text>
            <Text style={{ color: colors.text.primary }} className="mt-1 text-sm font-semibold">
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
        <Text style={{ color: colors.brand.primary }} className="mt-4 font-medium">Đang tải lịch sử chuyến...</Text>
      </View>
    );
  }

  return (
    <View style={{ backgroundColor: colors.surface.page }} className="flex-1">
      {/* ── KPI Summary Cards ── */}
      <View className="flex-row gap-3 px-4 pt-4 pb-2">
        <View style={{ backgroundColor: colors.surface.card, borderColor: colors.border.default }} className="flex-1 rounded-xl border p-3 shadow-sm">
          <View className="flex-row items-center justify-between">
            <Text style={{ color: colors.text.secondary }} className="text-xs font-semibold">ĐÃ HOÀN TẤT</Text>
            <Ionicons name="checkmark-done-circle" size={18} color="#16a34a" />
          </View>
          <Text style={{ color: colors.text.primary }} className="mt-1 text-xl font-bold">
            {stats.completedCount} <Text className="text-xs font-normal text-slate-500">chuyến</Text>
          </Text>
        </View>

        <View style={{ backgroundColor: colors.surface.card, borderColor: colors.border.default }} className="flex-1 rounded-xl border p-3 shadow-sm">
          <View className="flex-row items-center justify-between">
            <Text style={{ color: colors.text.secondary }} className="text-xs font-semibold">TỔNG ĐƠN HÀNG</Text>
            <Ionicons name="cube" size={18} color={colors.brand.primary} />
          </View>
          <Text style={{ color: colors.text.primary }} className="mt-1 text-xl font-bold">
            {stats.totalOrders} <Text className="text-xs font-normal text-slate-500">đơn</Text>
          </Text>
        </View>
      </View>

      {/* ── Search Bar ── */}
      <View className="px-4 py-2">
        <View style={{ backgroundColor: colors.surface.card, borderColor: colors.border.default }} className="flex-row items-center rounded-xl border px-3 py-2">
          <Ionicons name="search" size={18} color={colors.text.muted} />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Tìm mã chuyến, biển số xe, địa chỉ..."
            placeholderTextColor={colors.text.muted}
            style={{ color: colors.text.primary }}
            className="ml-2 flex-1 text-sm"
            returnKeyType="search"
          />
          {searchQuery ? (
            <Pressable onPress={() => setSearchQuery('')} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color={colors.text.muted} />
            </Pressable>
          ) : null}
        </View>
      </View>

      {/* ── Filter Tabs ── */}
      <View className="flex-row gap-2 px-4 pb-2">
        {([
          { key: 'ALL' as const, label: 'Tất cả' },
          { key: 'COMPLETED' as const, label: 'Hoàn tất' },
          { key: 'IN_TRANSIT' as const, label: 'Đang chạy' },
          { key: 'CANCELLED' as const, label: 'Đã hủy' },
        ]).map((tab) => {
          const active = activeTab === tab.key;
          return (
            <Pressable
              key={tab.key}
              onPress={() => setActiveTab(tab.key)}
              style={{
                backgroundColor: active ? colors.brand.primary : colors.surface.card,
                borderColor: active ? colors.brand.primary : colors.border.default,
              }}
              className="rounded-lg border px-3 py-1.5"
            >
              <Text style={{ color: active ? colors.text.onPrimary : colors.text.primary }} className="text-xs font-bold">
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* ── List of Trips ── */}
      <FlatList
        data={filteredTrips}
        keyExtractor={(item) => item.tripId}
        renderItem={renderTripItem}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              fetchTripHistory();
            }}
            tintColor={colors.brand.primary}
          />
        }
        ListHeaderComponent={
          error ? (
            <View className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4">
              <Text className="text-red-800">{error}</Text>
              <Pressable onPress={() => { setLoading(true); fetchTripHistory(); }} className="mt-2">
                <Text className="font-bold text-red-900">Thử lại</Text>
              </Pressable>
            </View>
          ) : null
        }
        ListEmptyComponent={
          !loading && !error ? (
            <View style={{ backgroundColor: colors.surface.card, borderColor: colors.border.default }} className="mt-8 items-center justify-center rounded-2xl border px-6 py-12">
              <Ionicons name="time-outline" size={56} color={colors.text.muted} />
              <Text style={{ color: colors.text.primary }} className="mt-4 text-base font-semibold">
                Không tìm thấy chuyến đi nào.
              </Text>
              <Text style={{ color: colors.text.secondary }} className="mt-1 text-center text-sm">
                {searchQuery || activeTab !== 'ALL'
                  ? 'Thử thay đổi từ khóa tìm kiếm hoặc bộ lọc trạng thái.'
                  : 'Lịch sử các chuyến xe bạn đã thực hiện sẽ được hiển thị tại đây.'}
              </Text>
            </View>
          ) : null
        }
      />
    </View>
  );
}
