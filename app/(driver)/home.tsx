import React, { useState, useCallback } from 'react';
import { Text, View, ActivityIndicator, ScrollView, RefreshControl, Linking } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { AppPressable as Pressable } from '../../components/AppPressable';
import { colors } from '../../constants/colors';
import { GlassWidget } from '../../components/GlassWidget';
import { useAuthStore } from '../../store/useAuthStore';
import { driverApi, TripListDto } from '../../services/driverApi';
import { getIncidents, IncidentResponse } from '../../services/incidentApi';
import { getVehicleDetail } from '../../services/vehicleApi';
import { getTripRoute, getTripTracking } from '../../services/monitoringApi';

const STATUS_PRIORITY: Record<string, number> = {
  IN_TRANSIT: 1,
  'IN-TRANSIT': 1,
  DELAYED: 2,
  SEALED: 3,
  DISPATCHED: 4,
  LOADING_COMPLETED: 5,
  LOADING: 6,
  PICKING: 7,
  PLANNED: 8,
};

const HOTLINE_PHONE = '19006868';
const HOTLINE_DISPLAY = '1900 6868';

export default function DriverHomeScreen() {
  const user = useAuthStore((state) => state.user);
  const token = useAuthStore((state) => state.token);
  const router = useRouter();

  const [activeTrip, setActiveTrip] = useState<TripListDto | null>(null);
  const [tripDistanceKm, setTripDistanceKm] = useState<number | null>(null);
  const [activeIncident, setActiveIncident] = useState<IncidentResponse | null>(null);
  const [replacementPlate, setReplacementPlate] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadActiveTrip = useCallback(async () => {
    try {
      const trips = await driverApi.getMyTrips();
      
      // Lọc các chuyến đang trong quá trình thực hiện và sắp xếp theo độ ưu tiên trạng thái
      const eligibleTrips = trips.filter((t) =>
        Boolean(STATUS_PRIORITY[t.status?.toUpperCase() || ''])
      );

      eligibleTrips.sort((a, b) => {
        const pA = STATUS_PRIORITY[a.status?.toUpperCase() || ''] || 99;
        const pB = STATUS_PRIORITY[b.status?.toUpperCase() || ''] || 99;
        return pA - pB;
      });

      const active = eligibleTrips[0] || null;

      if (active) {
        setActiveTrip(active);

        // Lấy khoảng cách còn lại tới đơn hàng cuối cùng (hoặc tổng cự ly tuyến đường)
        let dist = active.distanceKm || null;
        if (token && active.tripId) {
          try {
            const [trackingRes, routeRes] = await Promise.allSettled([
              getTripTracking(token, active.tripId),
              getTripRoute(token, active.tripId),
            ]);

            if (
              trackingRes.status === 'fulfilled' &&
              trackingRes.value?.data?.eta?.remainingDistanceKm &&
              trackingRes.value.data.eta.remainingDistanceKm > 0
            ) {
              dist = Math.round(trackingRes.value.data.eta.remainingDistanceKm * 10) / 10;
            } else if (
              routeRes.status === 'fulfilled' &&
              routeRes.value?.data?.totalDistanceMeters &&
              routeRes.value.data.totalDistanceMeters > 0
            ) {
              dist = Math.round((routeRes.value.data.totalDistanceMeters / 1000) * 10) / 10;
            }
          } catch {
            // fallback to active.distanceKm
          }
        }
        setTripDistanceKm(dist);

        // Kiểm tra xem chuyến này có sự cố và được đổi xe cứu hộ không
        if (token && active.tripId) {
          try {
            const incRes = await getIncidents(token, active.tripId, 1, 20);
            if (incRes.success && incRes.data?.data?.length) {
              const incidents = incRes.data.data;
              const activeInc =
                incidents.find((i: IncidentResponse) => i.status !== 'RESOLVED') ||
                incidents[0];
              setActiveIncident(activeInc);

              if (activeInc.externalReeferPlan?.vehiclePlate) {
                setReplacementPlate(activeInc.externalReeferPlan.vehiclePlate);
              } else if (activeInc.replacementVehicleId) {
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
        setTripDistanceKm(null);
        setActiveIncident(null);
        setReplacementPlate(null);
      }
    } catch (error) {
      console.warn('Failed to load active trip', error);
      setActiveTrip(null);
      setTripDistanceKm(null);
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

  const handleCallHotline = () => {
    Linking.openURL(`tel:${HOTLINE_PHONE}`);
  };

  const displayVehiclePlate = replacementPlate || activeTrip?.vehiclePlate || 'Chưa gán xe';
  const hasReplacedVehicle = Boolean(
    replacementPlate && replacementPlate !== activeTrip?.vehiclePlate
  );

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.surface.page }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={colors.brand.primary}
        />
      }
    >
      <View style={{ backgroundColor: colors.surface.page }} className="flex-1 px-5 py-5">
        {/* ── HEADER CHÀO TÀI XẾ ── */}
        <View className="mb-5">
          <Text style={{ color: colors.text.secondary }} className="text-xs font-bold uppercase tracking-wider">
            Bảng điều khiển tài xế
          </Text>
          <Text style={{ color: colors.text.primary }} className="mt-1 text-2xl font-bold">
            Xin chào, {user?.fullName || 'Tài xế'} 👋
          </Text>
          <Text style={{ color: colors.text.secondary }} className="mt-1 text-xs leading-5">
            Theo dõi chuyến được phân công và đảm bảo nhiệt độ chuẩn ColdChain.
          </Text>
        </View>

        {/* ── KHỐI HOTLINE ĐIỀU PHỐI KHẨN CẤP (QUICK ACTION) ── */}
        <Pressable
          onPress={handleCallHotline}
          style={({ pressed }) => ({
            backgroundColor: pressed ? '#EFF6FF' : '#F0FDF4',
            borderColor: '#BBF7D0',
          })}
          className="mb-4 flex-row items-center justify-between rounded-2xl border p-3.5 shadow-xs"
        >
          <View className="flex-row items-center gap-3 flex-1">
            <View style={{ backgroundColor: '#DCFCE7' }} className="h-10 w-10 items-center justify-center rounded-xl">
              <Ionicons name="headset" size={20} color="#16A34A" />
            </View>
            <View className="flex-1">
              <Text style={{ color: '#15803D' }} className="text-[11px] font-bold uppercase tracking-wider">
                Hotline Điều Phối (24/7)
              </Text>
              <Text style={{ color: colors.text.primary }} className="text-sm font-bold">
                {HOTLINE_DISPLAY}
              </Text>
            </View>
          </View>
          <View style={{ backgroundColor: '#16A34A' }} className="flex-row items-center gap-1 rounded-xl px-3 py-2">
            <Ionicons name="call" size={14} color="#ffffff" />
            <Text className="text-xs font-bold text-white">Gọi ngay</Text>
          </View>
        </Pressable>

        {/* ── CHUYẾN ĐANG THỰC HIỆN ── */}
        <View className="gap-4">
          <GlassWidget>
            <View className="flex-row items-center justify-between">
              <Text style={{ color: colors.brand.primary }} className="text-xs font-bold uppercase tracking-wider">
                Chuyến đang thực hiện
              </Text>
              {hasReplacedVehicle && (
                <View
                  style={{
                    backgroundColor: colors.status.success.bg,
                    borderColor: colors.status.success.border,
                  }}
                  className="rounded-full border px-2 py-0.5"
                >
                  <Text style={{ color: colors.status.success.main }} className="text-[10px] font-bold">
                    Đã đổi xe cứu hộ
                  </Text>
                </View>
              )}
            </View>

            {isLoading ? (
              <View className="items-center py-8">
                <ActivityIndicator size="small" color={colors.brand.primary} />
                <Text style={{ color: colors.text.muted }} className="mt-2 text-xs">
                  Đang đồng bộ dữ liệu chuyến...
                </Text>
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
                  <View style={{ backgroundColor: colors.surface.selected }} className="rounded-xl px-3 py-1">
                    <Text style={{ color: colors.brand.primary }} className="text-xs font-bold uppercase">
                      {activeTrip.status}
                    </Text>
                  </View>
                </View>

                <View className="flex-row items-center gap-2">
                  <Ionicons name="location-outline" size={16} color={colors.brand.primary} />
                  <Text
                    style={{ color: colors.text.primary }}
                    className="flex-1 text-sm leading-5"
                    numberOfLines={1}
                  >
                    {activeTrip.origin || 'Chưa xác định'}
                  </Text>
                </View>
                <View className="flex-row items-center gap-2">
                  <Ionicons name="flag-outline" size={16} color={colors.brand.primary} />
                  <Text
                    style={{ color: colors.text.primary }}
                    className="flex-1 text-sm leading-5"
                    numberOfLines={1}
                  >
                    {activeTrip.destination || 'Chưa xác định'}
                  </Text>
                </View>

                <View
                  style={{ borderTopColor: colors.border.default }}
                  className="flex-row items-center justify-between border-t pt-3"
                >
                  <Text style={{ color: colors.text.secondary }} className="text-xs font-medium">
                    {activeTrip.totalOrders} đơn hàng
                  </Text>
                  <Text style={{ color: colors.text.secondary }} className="text-xs font-medium">
                    Khoảng cách: <Text className="font-semibold text-slate-800">{tripDistanceKm ? `${tripDistanceKm} km` : activeTrip.distanceKm ? `${activeTrip.distanceKm} km` : '--'}</Text>
                  </Text>
                </View>

                {/* Banner sự cố nếu chuyến có sự cố */}
                {activeIncident && (
                  <Pressable
                    onPress={() =>
                      router.push(
                        `/(driver)/trips/${activeTrip.tripId}/incident-detail?incidentId=${activeIncident.incidentId}&from=home` as never
                      )
                    }
                    style={{
                      backgroundColor:
                        activeIncident.status === 'RESOLVED'
                          ? colors.status.success.bg
                          : colors.status.warning.bg,
                      borderColor:
                        activeIncident.status === 'RESOLVED'
                          ? colors.status.success.border
                          : colors.status.warning.border,
                    }}
                    className="mt-1 flex-row items-center justify-between rounded-xl border p-3"
                  >
                    <View className="flex-row items-center gap-2 flex-1 pr-2">
                      <Ionicons
                        name={
                          activeIncident.status === 'RESOLVED'
                            ? 'checkmark-circle'
                            : 'warning'
                        }
                        size={18}
                        color={
                          activeIncident.status === 'RESOLVED'
                            ? colors.status.success.main
                            : colors.status.warning.main
                        }
                      />
                      <View className="flex-1">
                        <Text
                          style={{
                            color:
                              activeIncident.status === 'RESOLVED'
                                ? colors.status.success.main
                                : colors.status.warning.main,
                          }}
                          className="text-[11px] font-bold"
                        >
                          {activeIncident.status === 'RESOLVED'
                            ? 'Sự cố đã hoàn tất'
                            : 'Chuyến có sự cố đang xử lý'}
                        </Text>
                        <Text
                          style={{ color: colors.text.primary }}
                          className="text-xs font-medium"
                          numberOfLines={1}
                        >
                          {activeIncident.description || 'Xem tiến trình cứu hộ'}
                        </Text>
                      </View>
                    </View>
                    <Ionicons
                      name="chevron-forward"
                      size={16}
                      color={
                        activeIncident.status === 'RESOLVED'
                          ? colors.status.success.main
                          : colors.status.warning.main
                      }
                    />
                  </Pressable>
                )}

                {/* Nút hành động */}
                <View className="mt-2 flex-row gap-2.5">
                  <Pressable
                    style={({ pressed }) => ({
                      backgroundColor: pressed
                        ? colors.brand.primaryPressed
                        : colors.brand.primary,
                    })}
                    className="flex-1 items-center rounded-xl py-3.5"
                    onPress={() =>
                      router.push({
                        pathname: '/(driver)/trips/[id]',
                        params: { id: activeTrip.tripId, from: 'home' },
                      } as never)
                    }
                  >
                    <Text style={{ color: colors.text.onPrimary }} className="text-sm font-bold">
                      Chi tiết chuyến xe
                    </Text>
                  </Pressable>

                  <Pressable
                    style={{ borderColor: colors.status.danger.border, backgroundColor: colors.status.danger.bg }}
                    className="items-center justify-center rounded-xl border px-3.5 py-3.5"
                    onPress={() =>
                      router.push(
                        `/(driver)/trips/${activeTrip.tripId}/incident?from=home` as never
                      )
                    }
                  >
                    <Ionicons name="warning-outline" size={20} color={colors.status.danger.main} />
                  </Pressable>
                </View>
              </View>
            ) : (
              <View className="mt-4 gap-3">
                <Text style={{ color: colors.text.primary }} className="text-lg font-bold">
                  Hiện chưa có chuyến
                </Text>
                <Text style={{ color: colors.text.secondary }} className="text-xs leading-5">
                  Các chuyến xe được điều phối cho bạn sẽ tự động xuất hiện tại đây.
                </Text>
                <Pressable
                  style={{
                    borderColor: colors.brand.primary,
                    backgroundColor: colors.surface.card,
                  }}
                  className="mt-2 items-center rounded-xl border py-3"
                  onPress={() => router.push('/trips')}
                >
                  <Text style={{ color: colors.brand.primary }} className="text-sm font-bold">
                    Xem danh sách chuyến
                  </Text>
                </Pressable>
              </View>
            )}
          </GlassWidget>
        </View>
      </View>
    </ScrollView>
  );
}
