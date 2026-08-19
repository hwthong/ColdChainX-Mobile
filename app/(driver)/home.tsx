import React, { useState, useCallback } from 'react';
import { Text, View, ActivityIndicator, ScrollView } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { AppPressable as Pressable } from '../../components/AppPressable';
import { colors } from '../../constants/colors';
import { GlassWidget } from '../../components/GlassWidget';
import { useAuthStore } from '../../store/useAuthStore';
import { driverApi, TripListDto } from '../../services/driverApi';

export default function DriverHomeScreen() {
  const user = useAuthStore(state => state.user);
  const router = useRouter();

  const [activeTrip, setActiveTrip] = useState<TripListDto | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadActiveTrip = useCallback(async () => {
    try {
      setIsLoading(true);
      const trips = await driverApi.getMyTrips();
      const active = trips.find(t => ['IN-TRANSIT', 'IN_TRANSIT', 'SEALED', 'DISPATCHED', 'LOADING_COMPLETED', 'LOADING', 'PICKING', 'PLANNED'].includes(t.status));
      if (active) {
        setActiveTrip(active);
      } else {
        setActiveTrip(null);
      }
    } catch (error) {
      console.warn('Failed to load active trip', error);
      setActiveTrip(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadActiveTrip();
    }, [loadActiveTrip])
  );

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.surface.page }}>
      <View style={{ backgroundColor: colors.surface.page }} className="flex-1 px-6 py-6">
        <View className="mb-6">
          <Text style={{ color: colors.text.secondary }} className="text-xs font-bold uppercase tracking-wider">Tổng quan tài xế</Text>
          <Text style={{ color: colors.text.primary }} className="mt-1 text-2xl font-bold">
            Xin chào, {user?.fullName || 'Tài xế'}
          </Text>
          <Text style={{ color: colors.text.secondary }} className="mt-2 text-sm leading-5">
            Theo dõi chuyến được phân công và tình trạng vận chuyển.
          </Text>
        </View>

        <View className="gap-4">
          <GlassWidget>
            <Text style={{ color: colors.brand.primary }} className="text-xs font-bold uppercase tracking-wider">Chuyến đang thực hiện</Text>

            {isLoading ? (
              <View className="items-center py-6">
                <ActivityIndicator size="small" color={colors.brand.primary} />
              </View>
            ) : activeTrip ? (
              <View className="mt-3 gap-3">
                <View className="flex-row items-center justify-between">
                  <Text style={{ color: colors.text.primary }} className="text-lg font-bold">{activeTrip.vehiclePlate || 'Chưa gán xe'}</Text>
                  <Text style={{ color: colors.brand.primary, backgroundColor: colors.surface.selected }} className="overflow-hidden rounded px-2.5 py-1 text-xs font-bold uppercase">
                    {activeTrip.status}
                  </Text>
                </View>

                <View className="flex-row items-center gap-2">
                  <Ionicons name="location-outline" size={16} color={colors.brand.primary} />
                  <Text style={{ color: colors.text.primary }} className="flex-1 text-sm leading-5" numberOfLines={1}>{activeTrip.origin || 'N/A'}</Text>
                </View>
                <View className="flex-row items-center gap-2">
                  <Ionicons name="flag-outline" size={16} color={colors.brand.primary} />
                  <Text style={{ color: colors.text.primary }} className="flex-1 text-sm leading-5" numberOfLines={1}>{activeTrip.destination || 'N/A'}</Text>
                </View>

                <View style={{ borderTopColor: colors.border.default }} className="flex-row items-center justify-between border-t pt-3">
                  <Text style={{ color: colors.text.secondary }} className="text-sm font-medium">{activeTrip.totalOrders} đơn hàng</Text>
                  <Text style={{ color: colors.text.secondary }} className="text-sm font-medium">
                    Khoảng cách: {activeTrip.distanceKm || 0} km
                  </Text>
                </View>

                <Pressable
                  style={({ pressed }) => ({
                    backgroundColor: pressed ? colors.brand.primaryPressed : colors.brand.primary,
                  })}
                  className="mt-2 items-center rounded-xl py-3.5"
                  onPress={() => router.push(`/trips/${activeTrip.tripId}`)}
                >
                  <Text style={{ color: colors.text.onPrimary }} className="text-base font-bold">Xem chi tiết chuyến</Text>
                </Pressable>
              </View>
            ) : (
              <View className="mt-4 gap-4">
                <Text style={{ color: colors.text.primary }} className="text-xl font-bold">Chưa có chuyến</Text>
                <Text style={{ color: colors.text.secondary }} className="text-sm leading-6">
                  Các chuyến được điều phối sẽ xuất hiện tại đây.
                </Text>
                <Pressable
                  style={{ borderColor: colors.brand.primary, backgroundColor: colors.surface.card }}
                  className="mt-2 items-center rounded-xl border py-3.5"
                  onPress={() => router.push('/trips')}
                >
                  <Text style={{ color: colors.brand.primary }} className="text-base font-bold">Xem danh sách chuyến</Text>
                </Pressable>
              </View>
            )}
          </GlassWidget>
        </View>
      </View>
    </ScrollView>
  );
}
