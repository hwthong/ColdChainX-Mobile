import React, { useState, useCallback } from 'react';
import { View, Text, FlatList, ActivityIndicator, Pressable, RefreshControl } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { colors } from '../../../constants/colors';
import { driverApi, TripListDto } from '../../../services/driverApi';
import { formatDateTimeVi } from '../../../constants/warehouseTheme';

export default function DriverTripsScreen() {
  const router = useRouter();
  const [trips, setTrips] = useState<TripListDto[]>([]);
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
    const map: Record<string, { label: string, colorClass: string }> = {
      'PLANNED': { label: 'Đã lên kế hoạch', colorClass: 'text-blue-700 bg-blue-100 border-blue-200' },
      'PICKING': { label: 'Đang lấy hàng', colorClass: 'text-purple-700 bg-purple-100 border-purple-200' },
      'LOADING_COMPLETED': { label: 'Đã xếp hàng', colorClass: 'text-indigo-700 bg-indigo-100 border-indigo-200' },
      'SEALED': { label: 'Đã kẹp chì', colorClass: 'text-orange-700 bg-orange-100 border-orange-200' },
      'IN_TRANSIT': { label: 'Đang vận chuyển', colorClass: 'text-emerald-700 bg-emerald-100 border-emerald-200' },
      'IN-TRANSIT': { label: 'Đang vận chuyển', colorClass: 'text-emerald-700 bg-emerald-100 border-emerald-200' },
      'DISPATCHED': { label: 'Đã điều phối', colorClass: 'text-emerald-700 bg-emerald-100 border-emerald-200' },
      'LOADING': { label: 'Đang lên hàng', colorClass: 'text-emerald-700 bg-emerald-100 border-emerald-200' },
      'DELAYED': { label: 'Bị trễ', colorClass: 'text-red-700 bg-red-100 border-red-200' },
      'COMPLETED': { label: 'Hoàn tất', colorClass: 'text-gray-700 bg-gray-100 border-gray-200' },
      'CANCELLED': { label: 'Đã hủy', colorClass: 'text-gray-500 bg-gray-100 border-gray-200' },
    };
    return map[status] || { label: status, colorClass: 'text-gray-700 bg-gray-100 border-gray-200' };
  };

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
        className="mb-4 rounded-2xl border p-4 shadow-sm"
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
          <Ionicons name="location" size={16} color={colors.brand.primary} className="mr-2" />
          <Text style={{ color: colors.text.primary }} className="ml-2 flex-1 text-sm line-clamp-1" numberOfLines={1}>
            {item.origin || 'Chưa xác định'}
          </Text>
        </View>
        <View className="mb-3 flex-row items-center">
          <Ionicons name="flag" size={16} color={colors.brand.primary} className="mr-2" />
          <Text style={{ color: colors.text.primary }} className="ml-2 flex-1 text-sm line-clamp-1" numberOfLines={1}>
            {item.destination || 'Chưa xác định'}
          </Text>
        </View>

        <View style={{ borderTopColor: colors.border.default }} className="flex-row items-center justify-between border-t pt-3">
          <View>
            <Text style={{ color: colors.text.muted }} className="text-xs">Khởi hành dự kiến</Text>
            <Text style={{ color: colors.text.primary }} className="mt-1 text-sm font-semibold">
              {formatDateTimeVi(item.plannedStartTime)}
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
        <Text style={{ color: colors.brand.primary }} className="mt-4 font-medium">Đang tải danh sách chuyến...</Text>
      </View>
    );
  }

  return (
    <View style={{ backgroundColor: colors.surface.page }} className="flex-1">
      <FlatList
        data={trips}
        keyExtractor={(item) => item.tripId}
        renderItem={renderTrip}
        contentContainerStyle={{ padding: 24, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchTrips(); }} tintColor={colors.brand.primary} />}
        ListHeaderComponent={
          error ? (
            <View className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4">
              <Text className="text-red-800">{error}</Text>
              <Pressable onPress={() => { setLoading(true); fetchTrips(); }} className="mt-2">
                <Text className="font-bold text-red-900">Thử lại</Text>
              </Pressable>
            </View>
          ) : null
        }
        ListEmptyComponent={
          !loading && !error ? (
            <View style={{ backgroundColor: colors.surface.card, borderColor: colors.border.default }} className="mt-10 items-center justify-center rounded-2xl border px-6 py-10">
              <Ionicons name="car-sport-outline" size={64} color={colors.text.muted} />
              <Text style={{ color: colors.text.primary }} className="mt-4 text-base font-semibold">
                Chưa có chuyến được phân công.
              </Text>
              <Text style={{ color: colors.text.secondary }} className="mt-1 text-center text-sm">
                Các chuyến xe được điều phối cho bạn sẽ xuất hiện tại đây.
              </Text>
            </View>
          ) : null
        }
      />
    </View>
  );
}
