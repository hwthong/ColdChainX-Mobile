import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, ActivityIndicator, Pressable, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { driverApi, DriverTripSummaryResponse } from '../../../services/driverApi';
import { formatDateTimeVi } from '../../../constants/warehouseTheme';

export default function DriverTripsScreen() {
  const router = useRouter();
  const [trips, setTrips] = useState<DriverTripSummaryResponse[]>([]);
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
      'DELAYED': { label: 'Bị trễ', colorClass: 'text-red-700 bg-red-100 border-red-200' },
      'COMPLETED': { label: 'Hoàn tất', colorClass: 'text-gray-700 bg-gray-100 border-gray-200' },
      'CANCELLED': { label: 'Đã hủy', colorClass: 'text-gray-500 bg-gray-100 border-gray-200' },
    };
    return map[status] || { label: status, colorClass: 'text-gray-700 bg-gray-100 border-gray-200' };
  };

  const renderTrip = ({ item }: { item: DriverTripSummaryResponse }) => {
    const statusInfo = getStatusDisplay(item.status);

    return (
      <Pressable
        onPress={() => router.push(`/(driver)/trips/${item.tripId}` as any)}
        className="mb-4 rounded-2xl border border-amber-200 bg-white p-4 shadow-sm"
        style={({ pressed }) => ({
          opacity: pressed ? 0.7 : 1,
        })}
      >
        <View className="mb-3 flex-row items-start justify-between">
          <View className="flex-1">
            <Text className="text-base font-bold text-amber-900">
              Chuyến {item.tripId.substring(0, 8).toUpperCase()}
            </Text>
            {item.vehicle?.truckPlate && (
              <Text className="mt-1 text-sm font-medium text-amber-700">
                Xe: {item.vehicle.truckPlate}
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
          <Ionicons name="location" size={16} color="#8B4513" className="mr-2" />
          <Text className="ml-2 flex-1 text-sm text-amber-900 line-clamp-1" numberOfLines={1}>
            {item.stops && item.stops.length > 0 ? item.stops[0].address : 'Chưa xác định'}
          </Text>
        </View>
        <View className="mb-3 flex-row items-center">
          <Ionicons name="flag" size={16} color="#8B4513" className="mr-2" />
          <Text className="ml-2 flex-1 text-sm text-amber-900 line-clamp-1" numberOfLines={1}>
            {item.stops && item.stops.length > 1 ? item.stops[item.stops.length - 1].address : 'Chưa xác định'}
          </Text>
        </View>

        <View className="flex-row items-center justify-between border-t border-amber-100 pt-3">
          <View>
            <Text className="text-xs text-amber-700">Khởi hành dự kiến</Text>
            <Text className="mt-1 text-sm font-semibold text-amber-900">
              {formatDateTimeVi(item.plannedStartTime)}
            </Text>
          </View>
          <View className="items-end">
            <Text className="text-xs text-amber-700">Hành trình</Text>
            <Text className="mt-1 text-sm font-semibold text-amber-900">
              {item.stopCount} điểm dừng
            </Text>
          </View>
        </View>
      </Pressable>
    );
  };

  if (loading && !refreshing) {
    return (
      <View className="flex-1 items-center justify-center bg-[#F6F8F2]">
        <ActivityIndicator size="large" color="#8B4513" />
        <Text className="mt-4 text-amber-800">Đang tải danh sách chuyến...</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-[#F6F8F2]">
      <FlatList
        data={trips}
        keyExtractor={(item) => item.tripId}
        renderItem={renderTrip}
        contentContainerStyle={{ padding: 24, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchTrips(); }} tintColor="#8B4513" />}
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
            <View className="mt-10 items-center justify-center rounded-2xl border border-amber-200 bg-amber-50 py-10">
              <Ionicons name="car-sport-outline" size={64} color="#877369" />
              <Text className="mt-4 text-base font-semibold text-amber-900">
                Chưa có chuyến được phân công.
              </Text>
              <Text className="mt-1 text-sm text-amber-700 text-center px-6">
                Các chuyến xe được điều phối cho bạn sẽ xuất hiện tại đây.
              </Text>
            </View>
          ) : null
        }
      />
    </View>
  );
}
