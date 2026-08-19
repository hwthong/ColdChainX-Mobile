import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  TextInput,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { AppPressable as Pressable } from '../../../components/AppPressable';
import { colors } from '../../../constants/colors';
import { driverApi, TripListDto } from '../../../services/driverApi';
import { getIncidents, IncidentResponse } from '../../../services/incidentApi';
import { getVehicleDetail } from '../../../services/vehicleApi';
import { useAuthStore } from '../../../store/useAuthStore';
import { formatDateTimeVi } from '../../../constants/warehouseTheme';

type FilterType = 'ALL' | 'ACTIVE' | 'COMPLETED';

// Các trạng thái xe đang hoạt động / chuẩn bị / làm hàng
const ACTIVE_STATUSES = new Set([
  'IN_TRANSIT',
  'IN-TRANSIT',
  'SEALED',
  'DISPATCHED',
  'LOADING',
  'LOADING_COMPLETED',
  'PICKING',
  'DELAYED',
  'PLANNED',
]);

// Các trạng thái xe đã kết thúc
const COMPLETED_STATUSES = new Set(['COMPLETED', 'CLOSED', 'CANCELLED']);

const STATUS_WEIGHT: Record<string, number> = {
  IN_TRANSIT: 10,
  'IN-TRANSIT': 10,
  DELAYED: 9,
  SEALED: 8,
  DISPATCHED: 7,
  LOADING_COMPLETED: 6,
  LOADING: 5,
  PICKING: 4,
  PLANNED: 3,
  COMPLETED: 1,
  CLOSED: 1,
  CANCELLED: 0,
};

interface RescueInfo {
  plate: string;
  isRescue: boolean;
  originalPlate?: string;
}

export default function DriverTripsScreen() {
  const router = useRouter();
  const token = useAuthStore((state) => state.token);

  const [trips, setTrips] = useState<TripListDto[]>([]);
  const [replacementMap, setReplacementMap] = useState<Record<string, RescueInfo>>({});
  const [filter, setFilter] = useState<FilterType>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const fetchTrips = useCallback(async () => {
    try {
      setError('');
      // Đồng thời tải chuyến đang chạy và lịch sử chuyến đã hoàn tất
      const [activeTripsRes, historyRes] = await Promise.allSettled([
        driverApi.getMyTrips(),
        driverApi.getMyTripHistory(1, 50),
      ]);

      const activeList: TripListDto[] =
        activeTripsRes.status === 'fulfilled' ? activeTripsRes.value : [];
      const historyList: TripListDto[] =
        historyRes.status === 'fulfilled' && historyRes.value?.data
          ? historyRes.value.data
          : [];

      // Khử trùng lặp theo tripId
      const tripMap = new Map<string, TripListDto>();
      activeList.forEach((t) => tripMap.set(t.tripId, t));
      historyList.forEach((t) => {
        if (!tripMap.has(t.tripId)) {
          tripMap.set(t.tripId, t);
        }
      });

      const allTrips = Array.from(tripMap.values());

      // Sắp xếp: Chuyến đang chạy / mới nhất luôn lên trên đầu, tiếp theo là thời gian giảm dần
      allTrips.sort((a, b) => {
        const weightA = STATUS_WEIGHT[a.status?.toUpperCase() || ''] ?? 2;
        const weightB = STATUS_WEIGHT[b.status?.toUpperCase() || ''] ?? 2;
        if (weightA !== weightB) {
          return weightB - weightA;
        }
        const timeA = new Date(
          a.startedAt || a.plannedStartTime || a.completedAt || 0
        ).getTime();
        const timeB = new Date(
          b.startedAt || b.plannedStartTime || b.completedAt || 0
        ).getTime();
        return timeB - timeA;
      });

      setTrips(allTrips);

      // Tra cứu xe cứu hộ / xe thay thế cho các chuyến đang hoạt động
      if (token) {
        const repMap: Record<string, RescueInfo> = {};
        await Promise.allSettled(
          allTrips
            .filter((t) => ACTIVE_STATUSES.has((t.status || '').toUpperCase()))
            .map(async (t) => {
              try {
                const incRes = await getIncidents(token, t.tripId, 1, 10);
                if (incRes.success && incRes.data?.data?.length) {
                  const inc =
                    incRes.data.data.find((i: IncidentResponse) => i.status !== 'RESOLVED') ||
                    incRes.data.data[0];
                  if (inc) {
                    if (inc.externalReeferPlan?.vehiclePlate) {
                      repMap[t.tripId] = {
                        plate: inc.externalReeferPlan.vehiclePlate,
                        isRescue: true,
                        originalPlate: t.vehiclePlate || undefined,
                      };
                    } else if (inc.replacementVehicleId) {
                      const vRes = await getVehicleDetail(token, inc.replacementVehicleId);
                      if (vRes.success && vRes.data?.truckPlate) {
                        repMap[t.tripId] = {
                          plate: vRes.data.truckPlate,
                          isRescue: true,
                          originalPlate: t.vehiclePlate || undefined,
                        };
                      }
                    }
                  }
                }
              } catch {
                // Fallback to original vehicle
              }
            })
        );
        setReplacementMap(repMap);
      }
    } catch (err: any) {
      setError(err.message || 'Không thể tải danh sách chuyến đi. Vui lòng thử lại.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      fetchTrips();
    }, [fetchTrips])
  );

  const getStatusDisplay = (status: string) => {
    const map: Record<string, { label: string; bg: string; text: string; border: string }> = {
      PLANNED: { label: 'Đã lên kế hoạch', bg: '#EFF6FF', text: '#1D4ED8', border: '#BFDBFE' },
      PICKING: { label: 'Đang lấy hàng', bg: '#FAF5FF', text: '#7E22CE', border: '#E9D5FF' },
      LOADING_COMPLETED: { label: 'Đã xếp hàng', bg: '#EEF2FF', text: '#4338CA', border: '#C7D2FE' },
      SEALED: { label: 'Đã kẹp chì', bg: '#FFF7ED', text: '#C2410C', border: '#FED7AA' },
      IN_TRANSIT: { label: 'Đang vận chuyển', bg: '#F0FDF4', text: '#15803D', border: '#BBF7D0' },
      'IN-TRANSIT': { label: 'Đang vận chuyển', bg: '#F0FDF4', text: '#15803D', border: '#BBF7D0' },
      DISPATCHED: { label: 'Đã điều phối', bg: '#F0FDF4', text: '#15803D', border: '#BBF7D0' },
      LOADING: { label: 'Đang lên hàng', bg: '#F0FDF4', text: '#15803D', border: '#BBF7D0' },
      DELAYED: { label: 'Bị trễ', bg: '#FEF2F2', text: '#B91C1C', border: '#FECACA' },
      COMPLETED: { label: 'Đã hoàn thành', bg: '#F8FAFC', text: '#475569', border: '#E2E8F0' },
      CLOSED: { label: 'Đã hoàn tất', bg: '#F8FAFC', text: '#475569', border: '#E2E8F0' },
      CANCELLED: { label: 'Đã hủy', bg: '#F8FAFC', text: '#94A3B8', border: '#E2E8F0' },
    };
    return (
      map[status?.toUpperCase()] || {
        label: status || 'Chưa rõ',
        bg: '#F8FAFC',
        text: '#475569',
        border: '#E2E8F0',
      }
    );
  };

  // Đếm số lượng theo đúng 3 nhóm
  const counts = useMemo(() => {
    let active = 0;
    let completed = 0;

    trips.forEach((t) => {
      const s = (t.status || '').toUpperCase();
      if (ACTIVE_STATUSES.has(s)) active++;
      else if (COMPLETED_STATUSES.has(s)) completed++;
    });

    return { all: trips.length, active, completed };
  }, [trips]);

  // Filtered trips
  const filteredTrips = useMemo(() => {
    return trips.filter((t) => {
      const s = (t.status || '').toUpperCase();
      const isActive = ACTIVE_STATUSES.has(s);
      const isCompleted = COMPLETED_STATUSES.has(s);

      if (filter === 'ACTIVE' && !isActive) return false;
      if (filter === 'COMPLETED' && !isCompleted) return false;

      if (!searchQuery.trim()) return true;

      const q = searchQuery.toLowerCase().trim();
      const code = (t.tripCode || t.tripId || '').toLowerCase();
      const rescuePlate = replacementMap[t.tripId]?.plate?.toLowerCase() || '';
      const plate = (t.vehiclePlate || '').toLowerCase();
      const origin = (t.origin || '').toLowerCase();
      const dest = (t.destination || '').toLowerCase();

      return (
        code.includes(q) ||
        plate.includes(q) ||
        rescuePlate.includes(q) ||
        origin.includes(q) ||
        dest.includes(q)
      );
    });
  }, [trips, filter, searchQuery, replacementMap]);

  const renderTripCard = (item: TripListDto, isHero = false) => {
    const statusInfo = getStatusDisplay(item.status);
    const rescueInfo = replacementMap[item.tripId];
    const displayPlate = rescueInfo?.plate || item.vehiclePlate || 'Chưa gán xe';
    const isReplaced = Boolean(rescueInfo?.isRescue && rescueInfo.plate !== item.vehiclePlate);

    const s = (item.status || '').toUpperCase();
    const isRunning = ACTIVE_STATUSES.has(s);

    return (
      <Pressable
        key={item.tripId}
        onPress={() =>
          router.push({
            pathname: '/(driver)/trips/[id]',
            params: { id: item.tripId, from: 'trips' },
          } as never)
        }
        style={({ pressed }) => ({
          backgroundColor: isHero
            ? '#FFFFFF'
            : isRunning
            ? '#FFFFFF'
            : colors.surface.card,
          borderColor: isHero
            ? colors.brand.primary
            : isRunning
            ? '#BFDBFE'
            : colors.border.default,
          borderWidth: isHero ? 2 : 1,
          opacity: pressed ? 0.75 : 1,
        })}
        className={`mb-3.5 rounded-2xl p-4 shadow-xs ${isHero ? 'shadow-md' : ''}`}
      >
        {/* Header thẻ: Badge mới nhất / Mã chuyến / Status */}
        <View className="mb-2.5 flex-row items-start justify-between">
          <View className="flex-1 pr-2">
            {isHero ? (
              <View className="mb-1 flex-row items-center gap-1.5">
                <View className="h-2 w-2 rounded-full bg-blue-600" />
                <Text style={{ color: colors.brand.primary }} className="text-[11px] font-bold uppercase tracking-wider">
                  Chuyến xe mới nhất
                </Text>
              </View>
            ) : null}

            <Text style={{ color: colors.text.primary }} className="text-base font-bold">
              {item.tripCode || `Chuyến #${item.tripId.substring(0, 8).toUpperCase()}`}
            </Text>

            {/* Hiển thị biển số xe đang chạy thực tế */}
            <View className="mt-1 flex-row items-center gap-1.5 flex-wrap">
              <Text style={{ color: colors.text.secondary }} className="text-xs font-medium">
                Xe: <Text className="font-bold text-slate-900">{displayPlate}</Text>
              </Text>
              {isReplaced ? (
                <View
                  style={{
                    backgroundColor: colors.status.success.bg,
                    borderColor: colors.status.success.border,
                  }}
                  className="rounded-full border px-2 py-0.2"
                >
                  <Text style={{ color: colors.status.success.main }} className="text-[10px] font-bold">
                    Đã đổi xe cứu hộ
                  </Text>
                </View>
              ) : null}
            </View>

            {isReplaced && item.vehiclePlate ? (
              <Text style={{ color: colors.text.muted }} className="text-[11px]">
                Xe ban đầu: {item.vehiclePlate}
              </Text>
            ) : null}
          </View>

          <View
            style={{
              backgroundColor: statusInfo.bg,
              borderColor: statusInfo.border,
            }}
            className="rounded-lg border px-2.5 py-1"
          >
            <Text style={{ color: statusInfo.text }} className="text-xs font-bold uppercase">
              {statusInfo.label}
            </Text>
          </View>
        </View>

        {/* Lộ trình ngắn gọn: Điểm xuất phát ➔ Điểm đến */}
        <View className="my-1 gap-1.5 rounded-xl bg-slate-50 p-2.5">
          <View className="flex-row items-center">
            <Ionicons name="radio-button-on" size={14} color={colors.brand.primary} />
            <Text style={{ color: colors.text.primary }} className="ml-2 flex-1 text-xs font-medium" numberOfLines={1}>
              {item.origin || 'Điểm xuất phát'}
            </Text>
          </View>
          <View className="ml-1.5 h-2 w-0.5 bg-slate-300" />
          <View className="flex-row items-center">
            <Ionicons name="location" size={14} color="#EF4444" />
            <Text style={{ color: colors.text.primary }} className="ml-2 flex-1 text-xs font-medium" numberOfLines={1}>
              {item.destination || 'Điểm giao hàng'}
            </Text>
          </View>
        </View>

        {/* Footer tóm tắt: Thời gian + Số đơn + Nút xem chi tiết */}
        <View
          style={{ borderTopColor: colors.border.default }}
          className="mt-2.5 flex-row items-center justify-between border-t pt-2.5"
        >
          <View>
            <Text style={{ color: colors.text.muted }} className="text-[11px]">
              {item.completedAt ? 'Hoàn thành lúc' : 'Khởi hành dự kiến'}
            </Text>
            <Text style={{ color: colors.text.primary }} className="mt-0.5 text-xs font-semibold">
              {formatDateTimeVi(item.completedAt || item.startedAt || item.plannedStartTime)}
            </Text>
          </View>

          <View className="flex-row items-center gap-2">
            <Text style={{ color: colors.text.secondary }} className="text-xs font-medium">
              <Text className="font-bold text-slate-900">{item.totalOrders}</Text> đơn hàng
            </Text>
            <Ionicons name="chevron-forward" size={16} color={colors.brand.primary} />
          </View>
        </View>
      </Pressable>
    );
  };

  if (loading && !refreshing) {
    return (
      <View style={{ backgroundColor: colors.surface.page }} className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" color={colors.brand.primary} />
        <Text style={{ color: colors.brand.primary }} className="mt-4 font-medium">
          Đang tải lịch sử chuyến xe...
        </Text>
      </View>
    );
  }

  return (
    <View style={{ backgroundColor: colors.surface.page }} className="flex-1">
      {/* ── BỘ LỌC 3 TABS (TẤT CẢ | ĐANG CHẠY | ĐÃ HOÀN THÀNH) ── */}
      <View
        style={{ backgroundColor: colors.surface.card, borderColor: colors.border.default }}
        className="border-b px-4 pt-3 pb-2.5 shadow-xs"
      >
        <View className="flex-row items-center gap-2 rounded-2xl bg-gray-100/90 p-1">
          <Pressable
            onPress={() => setFilter('ALL')}
            style={{
              backgroundColor: filter === 'ALL' ? colors.surface.card : 'transparent',
            }}
            className="flex-1 items-center justify-center rounded-xl py-2 shadow-xs"
          >
            <Text
              style={{
                color: filter === 'ALL' ? colors.brand.primary : colors.text.secondary,
              }}
              className="text-xs font-bold"
            >
              Tất cả ({counts.all})
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setFilter('ACTIVE')}
            style={{
              backgroundColor: filter === 'ACTIVE' ? colors.surface.card : 'transparent',
            }}
            className="flex-1 items-center justify-center rounded-xl py-2 shadow-xs"
          >
            <Text
              style={{
                color: filter === 'ACTIVE' ? colors.brand.primary : colors.text.secondary,
              }}
              className="text-xs font-bold"
            >
              Đang chạy ({counts.active})
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setFilter('COMPLETED')}
            style={{
              backgroundColor: filter === 'COMPLETED' ? colors.surface.card : 'transparent',
            }}
            className="flex-1 items-center justify-center rounded-xl py-2 shadow-xs"
          >
            <Text
              style={{
                color: filter === 'COMPLETED' ? colors.brand.primary : colors.text.secondary,
              }}
              className="text-xs font-bold"
            >
              Đã hoàn thành ({counts.completed})
            </Text>
          </Pressable>
        </View>

        {/* Thanh tìm kiếm nhanh */}
        {trips.length > 2 ? (
          <View className="mt-2.5 flex-row items-center rounded-xl bg-gray-100/80 px-3 py-1.5">
            <Ionicons name="search-outline" size={16} color={colors.text.muted} />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Tìm theo mã chuyến, biển số xe, lộ trình..."
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

      {/* ── DANH SÁCH CHUYẾN XE ── */}
      <FlatList
        data={filteredTrips}
        keyExtractor={(item) => item.tripId}
        renderItem={({ item, index }) =>
          renderTripCard(
            item,
            index === 0 &&
              filter === 'ALL' &&
              ACTIVE_STATUSES.has((item.status || '').toUpperCase())
          )
        }
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
                  filter === 'ACTIVE'
                    ? 'trail-sign-outline'
                    : filter === 'COMPLETED'
                    ? 'checkmark-done-circle-outline'
                    : 'car-sport-outline'
                }
                size={56}
                color={colors.text.muted}
              />
              <Text style={{ color: colors.text.primary }} className="mt-4 text-base font-bold">
                {filter === 'ACTIVE'
                  ? 'Không có chuyến nào đang chạy'
                  : filter === 'COMPLETED'
                  ? 'Chưa có lịch sử chuyến đã hoàn thành'
                  : 'Chưa có chuyến xe nào'}
              </Text>
              <Text style={{ color: colors.text.secondary }} className="mt-1.5 text-center text-xs leading-5">
                {filter === 'ACTIVE'
                  ? 'Chỉ các chuyến đang vận chuyển hoặc chuẩn bị lăn bánh mới hiển thị tại đây.'
                  : filter === 'COMPLETED'
                  ? 'Danh sách các chuyến xe đã hoàn thành hoặc kết thúc ca.'
                  : 'Các chuyến xe được điều phối cho bạn sẽ xuất hiện tại đây.'}
              </Text>
            </View>
          ) : null
        }
      />
    </View>
  );
}
