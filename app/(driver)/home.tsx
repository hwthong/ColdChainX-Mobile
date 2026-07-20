import React, { useEffect, useState, useCallback } from 'react';
import { Text, View, ActivityIndicator, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';

import { GlassWidget } from '../../components/GlassWidget';
import { useAuthStore } from '../../store/useAuthStore';
import { driverApi, DriverTripSummaryResponse } from '../../services/driverApi';
import { Ionicons } from '@expo/vector-icons';

export default function DriverHomeScreen() {
  const user = useAuthStore(state => state.user);
  const router = useRouter();
  
  const [activeTrip, setActiveTrip] = useState<DriverTripSummaryResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadActiveTrip = async () => {
    try {
      setIsLoading(true);
      // Fetch trips that are in progress
      const result = await driverApi.getMyTrips(['IN_TRANSIT', 'SEALED', 'LOADING_COMPLETED', 'PICKING', 'PLANNED'], 1, 1);
      if (result.data && result.data.length > 0) {
        setActiveTrip(result.data[0]);
      } else {
        setActiveTrip(null);
      }
    } catch (error) {
      console.warn('Failed to load active trip', error);
      setActiveTrip(null);
    } finally {
      setIsLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadActiveTrip();
    }, [])
  );

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <View className="flex-1 bg-[#F6F8F2] px-6 py-6">
        <View className="mb-6 flex-row items-center justify-between">
          <View>
            <Text className="text-sm font-semibold uppercase text-amber-800">Tổng quan tài xế</Text>
            <Text className="mt-1 text-3xl font-bold text-amber-900">
              Xin chào, {user?.fullName || 'Tài xế'}
            </Text>
            <Text className="mt-2 text-base text-amber-700">
              Theo dõi chuyến được phân công và tình trạng vận chuyển.
            </Text>
          </View>
        </View>

        <View className="gap-4">
          <GlassWidget>
            <Text className="text-sm font-semibold uppercase text-amber-800">Chuyến đang thực hiện</Text>
            
            {isLoading ? (
              <View className="py-6 items-center">
                <ActivityIndicator size="small" color="#8B4513" />
              </View>
            ) : activeTrip ? (
              <View className="mt-3 gap-3">
                <View className="flex-row items-center justify-between">
                  <Text className="text-lg font-bold text-amber-900">{activeTrip.vehiclePlate || 'Chưa gán xe'}</Text>
                  <Text className="text-xs font-semibold uppercase text-blue-700 bg-blue-100 px-2 py-1 rounded overflow-hidden">
                    {activeTrip.status}
                  </Text>
                </View>

                <View className="flex-row items-center gap-2">
                  <Ionicons name="location-outline" size={16} color="#8B4513" />
                  <Text className="flex-1 text-sm text-amber-900 line-clamp-1" numberOfLines={1}>{activeTrip.originAddress || 'N/A'}</Text>
                </View>
                <View className="flex-row items-center gap-2">
                  <Ionicons name="flag-outline" size={16} color="#8B4513" />
                  <Text className="flex-1 text-sm text-amber-900 line-clamp-1" numberOfLines={1}>{activeTrip.destinationAddress || 'N/A'}</Text>
                </View>

                <View className="flex-row items-center justify-between border-t border-amber-200/50 pt-3">
                  <Text className="text-sm text-amber-800">{activeTrip.stopCount} điểm dừng</Text>
                  <Text className="text-sm text-amber-800">
                    IoT: {activeTrip.iotOnline ? '🟢 Online' : '🔴 Offline'}
                  </Text>
                </View>

                <Pressable
                  className="mt-2 items-center rounded-xl bg-amber-900 py-3"
                  onPress={() => router.push(`/trips/${activeTrip.tripId}`)}
                >
                  <Text className="text-base font-bold text-white">Xem chi tiết chuyến</Text>
                </Pressable>
              </View>
            ) : (
              <View className="mt-4 gap-4">
                <Text className="text-xl font-bold text-amber-900">Chưa có chuyến</Text>
                <Text className="text-base leading-6 text-amber-700">
                  Các chuyến được điều phối sẽ xuất hiện tại đây.
                </Text>
                <Pressable
                  className="mt-2 items-center rounded-xl border border-amber-900 py-3"
                  onPress={() => router.push('/trips')}
                >
                  <Text className="text-base font-bold text-amber-900">Xem danh sách chuyến</Text>
                </Pressable>
              </View>
            )}
          </GlassWidget>
        </View>
      </View>
    </SafeAreaView>
  );
}
