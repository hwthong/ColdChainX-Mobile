import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, ActivityIndicator, Pressable, RefreshControl } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../../store/useAuthStore';
import { getTrackingByTripId, getPlannedTripRoute, TrackingDataResponse, TripRouteResponse, OptimizedTripStopDto } from '../../../services/trackingApi';
import { formatDateTimeVi } from '../../../constants/warehouseTheme';

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

export default function DriverTripDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const token = useAuthStore((s) => s.token);

  const [trackingData, setTrackingData] = useState<TrackingDataResponse | null>(null);
  const [routeData, setRouteData] = useState<TripRouteResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const fetchData = useCallback(async () => {
    if (!token || !id) return;
    try {
      setError('');
      const [trackRes, routeRes] = await Promise.all([
        getTrackingByTripId(token, id),
        getPlannedTripRoute(token, id),
      ]);

      if (trackRes.success && trackRes.data) setTrackingData(trackRes.data);
      if (routeRes.success && routeRes.data) setRouteData(routeRes.data);
    } catch (err: any) {
      setError(err.message || 'Lỗi tải chi tiết chuyến xe');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id, token]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading && !refreshing) {
    return (
      <View className="flex-1 items-center justify-center bg-[#F6F8F2]">
        <ActivityIndicator size="large" color="#8B4513" />
        <Text className="mt-4 text-amber-800">Đang tải chi tiết chuyến...</Text>
      </View>
    );
  }

  if (error || (!trackingData && !routeData)) {
    return (
      <View className="flex-1 items-center justify-center bg-[#F6F8F2] p-6">
        <Text className="mb-4 text-center text-red-800">{error || 'Không tìm thấy dữ liệu'}</Text>
        <Pressable onPress={() => router.back()} className="rounded-lg bg-amber-900 px-6 py-3">
          <Text className="font-bold text-white">Quay lại</Text>
        </Pressable>
      </View>
    );
  }

  const statusInfo = getStatusDisplay(trackingData?.status || 'UNKNOWN');

  return (
    <ScrollView
      className="flex-1 bg-[#F6F8F2]"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} tintColor="#8B4513" />}
    >
      <View className="px-5 py-6">
        
        {/* 1. Thông tin chuyến */}
        <View className="mb-4 flex-row items-center justify-between">
          <View className="flex-row items-center">
            <Pressable onPress={() => router.back()} className="mr-3 p-1">
              <Ionicons name="arrow-back" size={24} color="#8B4513" />
            </Pressable>
            <Text className="text-2xl font-bold text-amber-900">
              Chuyến {id?.substring(0, 8).toUpperCase()}
            </Text>
          </View>
          <View className={`rounded-lg border px-2.5 py-1.5 ${statusInfo.colorClass}`}>
            <Text className="text-xs font-bold uppercase">{statusInfo.label}</Text>
          </View>
        </View>

        {/* 6. Tài liệu và báo sự cố (Quick Actions) */}
        <View className="mb-6 flex-row gap-3">
          <Pressable
            onPress={() => router.push(`/(driver)/trips/${id}/documents` as any)}
            className="flex-1 flex-row items-center justify-center rounded-xl border border-amber-200 bg-white p-3 shadow-sm"
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
          >
            <Ionicons name="document-text-outline" size={20} color="#8B4513" />
            <Text className="ml-2 text-sm font-bold text-amber-900">Chứng từ</Text>
          </Pressable>
          <Pressable
            onPress={() => router.push(`/(driver)/trips/${id}/incident` as any)}
            className="flex-1 flex-row items-center justify-center rounded-xl border border-red-200 bg-red-50 p-3 shadow-sm"
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
          >
            <Ionicons name="warning-outline" size={20} color="#991B1B" />
            <Text className="ml-2 text-sm font-bold text-red-900">Báo sự cố</Text>
          </Pressable>
        </View>

        {/* 2. Xe và lịch trình & 3. Trạng thái thiết bị IoT */}
        <View className="mb-6 rounded-2xl border border-amber-200 bg-white p-4 shadow-sm">
          <Text className="mb-4 text-base font-bold text-amber-900">Xe và thiết bị</Text>
          
          <View className="mb-3 flex-row items-center justify-between">
            <Text className="text-sm text-amber-700">Biển số xe</Text>
            <Text className="font-bold text-amber-900">{trackingData?.vehicle?.truckPlate || 'Chưa xếp xe'}</Text>
          </View>
          <View className="mb-3 flex-row items-center justify-between">
            <Text className="text-sm text-amber-700">Thiết bị IoT</Text>
            <Text className="font-bold text-amber-900">{trackingData?.device?.deviceCode || 'Chưa gắn thiết bị'}</Text>
          </View>
          <View className="flex-row items-center justify-between border-t border-amber-100 pt-3">
            <Text className="text-sm text-amber-700">Nhiệt độ hiện tại</Text>
            {trackingData?.latestTelemetry ? (
              <Text className={`font-bold ${(trackingData.latestTelemetry.tempC ?? trackingData.latestTelemetry.temperature ?? 0) > 5 ? 'text-red-600' : 'text-emerald-600'}`}>
                {trackingData.latestTelemetry.tempC ?? trackingData.latestTelemetry.temperature ?? '--'}°C
              </Text>
            ) : (
              <Text className="font-bold text-gray-500">N/A</Text>
            )}
          </View>
        </View>

        {/* 4. Tuyến đường và điểm dừng */}
        <View className="mb-8">
          <Text className="mb-4 text-lg font-bold text-amber-900">
            Tuyến đường và điểm dừng ({routeData?.optimizedStops?.length || 0})
          </Text>
          
          {routeData?.optimizedStops?.map((stop: OptimizedTripStopDto, index: number) => {
            const isOrigin = index === 0;
            const isDest = index === routeData.optimizedStops.length - 1;
            
            return (
              <View key={index} className="mb-4 flex-row">
                <View className="w-8 items-center">
                  <View className={`z-10 h-5 w-5 rounded-full border-4 border-white shadow-sm ${isOrigin ? 'bg-blue-600' : isDest ? 'bg-emerald-600' : 'bg-amber-600'}`} />
                  {!isDest && <View className="absolute bottom-[-24] top-4 w-0.5 bg-amber-200" />}
                </View>
                
                <View className="ml-2 flex-1 rounded-xl border border-amber-200 bg-white p-3 shadow-sm">
                  <View className="mb-1 flex-row items-center justify-between">
                    <Text className="text-sm font-bold text-amber-900">
                      {isOrigin ? 'Bốc hàng (Kho đi)' : isDest ? 'Giao hàng (Kho đến)' : 'Điểm dừng'}
                    </Text>
                    <Text className="text-xs text-amber-600">TT: {stop.optimizedSequence}</Text>
                  </View>
                  <Text className="text-sm text-amber-700">{stop.address}</Text>
                  
                  {/* 5. Tiến độ hàng hóa */}
                  {(stop.lpns?.length > 0 || stop.orders?.length > 0) && (
                    <View className="mt-2 rounded-lg bg-amber-50 p-2">
                      {stop.lpns?.length > 0 && <Text className="text-xs font-semibold text-amber-900">• {stop.lpns.length} LPN</Text>}
                      {stop.orders?.length > 0 && <Text className="text-xs font-semibold text-amber-900">• {stop.orders.length} Đơn hàng</Text>}
                    </View>
                  )}
                </View>
              </View>
            );
          })}
        </View>

      </View>
    </ScrollView>
  );
}
