import React, { useState, useCallback } from 'react';
import { Text, View, ActivityIndicator, ScrollView, RefreshControl } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { AppPressable as Pressable } from '../../components/AppPressable';
import { colors } from '../../constants/colors';
import { GlassWidget } from '../../components/GlassWidget';
import { useAuthStore } from '../../store/useAuthStore';
import { driverApi, TripListDto } from '../../services/driverApi';
import { getIncidents, IncidentResponse } from '../../services/incidentApi';
import { getVehicleDetail } from '../../services/vehicleApi';
import { StatusBadge } from '../../components/StatusBadge';

export default function DriverHomeScreen() {
  const user = useAuthStore(state => state.user);
  const token = useAuthStore(state => state.token);
  const router = useRouter();

  const [activeTrip, setActiveTrip] = useState<TripListDto | null>(null);
  const [activeIncident, setActiveIncident] = useState<IncidentResponse | null>(null);
  const [replacementPlate, setReplacementPlate] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadActiveTrip = useCallback(async () => {
    try {
      const trips = await driverApi.getMyTrips();
      const active = trips.find(t => 
        ['IN-TRANSIT', 'IN_TRANSIT', 'DELAYED', 'SEALED', 'DISPATCHED', 'LOADING_COMPLETED', 'LOADING', 'PICKING', 'PLANNED'].includes(t.status?.toUpperCase())
      );
      
      if (active) {
        setActiveTrip(active);

        // Kiểm tra xem chuyến này có sự cố và được đổi xe cứu hộ không
        if (token && active.tripId) {
          try {
            const incRes = await getIncidents(token, active.tripId, 1, 20);
            if (incRes.success && incRes.data?.data?.length) {
              const incidents = incRes.data.data;
              const activeInc = incidents.find((i: IncidentResponse) => i.status !== 'RESOLVED') || incidents[0];
              setActiveIncident(activeInc);

              if (activeInc.replacementVehicleId) {
                try {
                  const vRes = await getVehicleDetail(token, activeInc.replacementVehicleId);
                  if (vRes.success && vRes.data?.truckPlate) {
                    setReplacementPlate(vRes.data.truckPlate);
                  } else {
                    setReplacementPlate(null);
                  }
                } catch {
                  setReplacementPlate(null);
                }
              } else {
                setReplacementPlate(null);
              }
            } else {
              setActiveIncident(null);
              setReplacementPlate(null);
            }
          } catch {
            setActiveIncident(null);
            setReplacementPlate(null);
          }
        }
      } else {
        setActiveTrip(null);
        setActiveIncident(null);
        setReplacementPlate(null);
      }
    } catch (error) {
      console.warn('Failed to load active trip', error);
      setActiveTrip(null);
      setActiveIncident(null);
      setReplacementPlate(null);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      loadActiveTrip();
    }, [loadActiveTrip])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadActiveTrip();
  }, [loadActiveTrip]);

  const displayVehiclePlate = replacementPlate || activeTrip?.vehiclePlate || 'Chưa gán xe';
  const hasReplacedVehicle = Boolean(replacementPlate && replacementPlate !== activeTrip?.vehiclePlate);

  return (
    <ScrollView 
      style={{ flex: 1, backgroundColor: colors.surface.page }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand.primary} />}
    >
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
            <View className="flex-row items-center justify-between">
              <Text style={{ color: colors.brand.primary }} className="text-xs font-bold uppercase tracking-wider">
                Chuyến đang thực hiện
              </Text>
              {hasReplacedVehicle && (
                <View style={{ backgroundColor: colors.status.success.bg, borderColor: colors.status.success.border }} className="rounded-full border px-2 py-0.5">
                  <Text style={{ color: colors.status.success.main }} className="text-[10px] font-bold">
                    Đã đổi xe cứu hộ
                  </Text>
                </View>
              )}
            </View>

            {isLoading ? (
              <View className="items-center py-6">
                <ActivityIndicator size="small" color={colors.brand.primary} />
              </View>
            ) : activeTrip ? (
              <View className="mt-3 gap-3">
                <View className="flex-row items-center justify-between">
                  <View className="flex-1 pr-2">
                    <Text style={{ color: colors.text.primary }} className="text-lg font-bold">
                      {displayVehiclePlate}
                    </Text>
                    {hasReplacedVehicle && (
                      <Text style={{ color: colors.text.secondary }} className="text-[11px]">
                        Xe ban đầu: {activeTrip.vehiclePlate || '--'}
                      </Text>
                    )}
                  </View>
                  <View style={{ backgroundColor: colors.surface.selected }} className="rounded px-2.5 py-1">
                    <Text style={{ color: colors.brand.primary }} className="text-xs font-bold uppercase">
                      {activeTrip.status}
                    </Text>
                  </View>
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

                {/* Banner sự cố nếu chuyến có sự cố */}
                {activeIncident && (
                  <Pressable
                    onPress={() => router.push(`/(driver)/trips/${activeTrip.tripId}/incident-detail?incidentId=${activeIncident.incidentId}` as never)}
                    style={{
                      backgroundColor: activeIncident.status === 'RESOLVED' ? colors.status.success.bg : colors.status.warning.bg,
                      borderColor: activeIncident.status === 'RESOLVED' ? colors.status.success.border : colors.status.warning.border,
                    }}
                    className="flex-row items-center justify-between rounded-xl border p-3 mt-1"
                  >
                    <View className="flex-row items-center gap-2 flex-1 pr-2">
                      <Ionicons
                        name={activeIncident.status === 'RESOLVED' ? 'checkmark-circle' : 'warning'}
                        size={18}
                        color={activeIncident.status === 'RESOLVED' ? colors.status.success.main : colors.status.warning.main}
                      />
                      <View className="flex-1">
                        <Text style={{ color: activeIncident.status === 'RESOLVED' ? colors.status.success.main : colors.status.warning.main }} className="text-[11px] font-bold">
                          {activeIncident.status === 'RESOLVED' ? 'Sự cố đã hoàn tất' : 'Chuyến có sự cố đang xử lý'}
                        </Text>
                        <Text style={{ color: colors.text.primary }} className="text-xs font-medium" numberOfLines={1}>
                          {activeIncident.description || 'Xem tiến trình cứu hộ'}
                        </Text>
                      </View>
                    </View>
                    <Ionicons
                      name="chevron-forward"
                      size={16}
                      color={activeIncident.status === 'RESOLVED' ? colors.status.success.main : colors.status.warning.main}
                    />
                  </Pressable>
                )}

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
