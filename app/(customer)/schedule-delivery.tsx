import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';

import { colors } from '../../constants/colors';
import { AsnResultCard } from '../../components/asn-result-card';
import { createAsn, getCustomerAsns, type AsnResponse } from '../../services/asnApi';
import { getApiErrorMessage } from '../../services/apiClient';
import { getCustomerIdFromToken } from '../../services/jwt';
import { getOrderById, type OrderResponse } from '../../services/orderApi';
import { searchWarehousesByOrigin, type WarehouseResponse } from '../../services/warehouseApi';
import { useAuthStore } from '../../store/useAuthStore';

type PickerMode = 'date' | 'time';
const DROPOFF_INTERVAL_MINUTES = 15;
const DROPOFF_BUFFER_HOURS = 2;
const DEFAULT_DROPOFF_OFFSET_HOURS = 3;

export default function ScheduleDeliveryScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ orderId?: string; asnId?: string }>();
  const accessToken = useAuthStore((state) => state.token);
  const storedCustomerId = useAuthStore((state) => state.customerId ?? state.user?.customerId ?? null);
  const customerId = storedCustomerId ?? (accessToken ? getCustomerIdFromToken(accessToken) : null);

  const orderId = getSingleParam(params.orderId);
  const asnId = getSingleParam(params.asnId);
  const defaultDropoffDateTime = useMemo(() => getDefaultDropoffDateTime(), []);

  const [order, setOrder] = useState<OrderResponse | null>(null);
  const [existingAsn, setExistingAsn] = useState<AsnResponse | null>(null);
  const [createdAsn, setCreatedAsn] = useState<AsnResponse | null>(null);
  const [warehouses, setWarehouses] = useState<WarehouseResponse[]>([]);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState('');
  const [phone, setPhone] = useState('');
  const [dropoffDateTime, setDropoffDateTime] = useState(defaultDropoffDateTime);
  const [visiblePicker, setVisiblePicker] = useState<PickerMode | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warehouseMessage, setWarehouseMessage] = useState<string | null>(null);

  const displayedAsn = createdAsn ?? existingAsn;
  const routeCutOffTime = order?.route?.cutOffTime ?? null;
  const firstSelectableDropoffDateTime = getFirstSelectableDropoffDateTime(routeCutOffTime);
  const latestSelectableDropoffDateTime = getLatestAllowedDropoffDateTime(dropoffDateTime, routeCutOffTime);
  const isDropoffDateTimeValid = isAllowedDropoffDateTime(dropoffDateTime, routeCutOffTime);
  const dropoffWindowText = getDropoffWindowText(dropoffDateTime, routeCutOffTime);
  const isAndroid = process.env.EXPO_OS === 'android';
  const selectedWarehouse = useMemo(
    () => warehouses.find((warehouse) => warehouse.warehouseId === selectedWarehouseId) ?? null,
    [selectedWarehouseId, warehouses]
  );
  const canSubmit =
    !isSubmitting &&
    !existingAsn &&
    Boolean(selectedWarehouseId) &&
    Boolean(order && isContractSigned(order.status)) &&
    isDropoffDateTimeValid;

  const loadScheduleContext = useCallback(async () => {
    if (!accessToken || !orderId) {
      setError('Không tìm thấy phiên đăng nhập hoặc mã đơn hàng.');
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      setWarehouseMessage(null);

      const orderResponse = await getOrderById(accessToken, orderId);
      if (!orderResponse.success || !orderResponse.data) {
        throw new Error(orderResponse.message || 'Không thể lấy thông tin đơn hàng.');
      }

      const nextOrder = orderResponse.data;
      setOrder(nextOrder);
      setDropoffDateTime((currentDropoff) => clampDropoffDateTime(currentDropoff, nextOrder.route?.cutOffTime));

      if (!isContractSigned(nextOrder.status)) {
        setError('Đơn hàng này chưa ở trạng thái CONTRACT_SIGNED nên chưa thể đặt lịch giao.');
      }

      if (customerId) {
        try {
          const asnResponse = await getCustomerAsns(accessToken, customerId);
          const matchedAsn =
            asnResponse.data?.find((asn) => asn.asnId === asnId) ??
            asnResponse.data?.find((asn) => asn.orderId === orderId) ??
            null;

          setExistingAsn(matchedAsn);
          if (matchedAsn?.phone) setPhone(matchedAsn.phone);
          if (matchedAsn?.warehouseId) setSelectedWarehouseId(matchedAsn.warehouseId);
        } catch (asnError) {
          console.warn('[ScheduleDelivery] Could not load existing ASNs', asnError);
        }
      }

      const originCity = nextOrder.route?.originCity;
      if (!originCity) {
        setWarehouseMessage('Đơn hàng chưa có tuyến xuất phát nên chưa thể tự tìm kho.');
        return;
      }

      const warehouseResponse = await searchWarehousesByOrigin(accessToken, originCity);
      const activeWarehouses = (warehouseResponse.data?.data ?? []).filter(
        (warehouse) => warehouse.status.toUpperCase() === 'ACTIVE'
      );

      setWarehouses(activeWarehouses);

      const suggestedWarehouse = getSuggestedWarehouse(activeWarehouses, originCity);
      if (suggestedWarehouse) {
        setSelectedWarehouseId((currentWarehouseId) => currentWarehouseId || suggestedWarehouse.warehouseId);
      }

      if (activeWarehouses.length === 0) {
        setWarehouseMessage(`Không tìm thấy kho phù hợp với điểm xuất phát "${originCity}". Vui lòng kiểm tra lại cấu hình kho xuất phát trước khi đặt lịch.`);
      } else if (activeWarehouses.length === 1) {
        setWarehouseMessage(`Đã tự chọn kho theo điểm xuất phát ${originCity}.`);
      } else {
        setWarehouseMessage(`Tìm thấy ${activeWarehouses.length} kho theo điểm xuất phát ${originCity}. Vui lòng kiểm tra kho được chọn.`);
      }
    } catch (loadError) {
      setError(getApiErrorMessage(loadError));
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, asnId, customerId, orderId]);

  useEffect(() => {
    loadScheduleContext();
  }, [loadScheduleContext]);

  const handleDropoffPickerChange = useCallback(
    (mode: PickerMode) => (_event: DateTimePickerEvent, selectedDate?: Date) => {
      if (isAndroid) setVisiblePicker(null);
      if (!selectedDate) return;

      setDropoffDateTime((currentDropoff) => {
        const nextDropoff = new Date(currentDropoff);

        if (mode === 'date') {
          nextDropoff.setFullYear(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
        } else {
          nextDropoff.setHours(selectedDate.getHours(), selectedDate.getMinutes(), 0, 0);
        }

        return clampDropoffDateTime(nextDropoff, routeCutOffTime);
      });
    },
    [isAndroid, routeCutOffTime]
  );

  const handleCreateAsn = async () => {
    if (!accessToken || !orderId) {
      setError('Không tìm thấy phiên đăng nhập hoặc mã đơn hàng.');
      return;
    }

    if (!order || !isContractSigned(order.status)) {
      setError('Đơn hàng chưa ký hợp đồng xong nên chưa thể đặt lịch.');
      return;
    }

    if (!selectedWarehouseId.trim()) {
      setError('Vui lòng chọn kho trước khi đặt lịch.');
      return;
    }

    if (!isAllowedDropoffDateTime(dropoffDateTime, routeCutOffTime)) {
      const adjustedDropoff = clampDropoffDateTime(dropoffDateTime, routeCutOffTime);
      setDropoffDateTime(adjustedDropoff);
      setError('Ngày/giờ giao kho vừa được cập nhật về khung hợp lệ gần nhất. Vui lòng kiểm tra lại trước khi xác nhận.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      setCreatedAsn(null);

      const response = await createAsn(accessToken, {
        orderId,
        requestedDropoffTime: formatDateTimeForApi(dropoffDateTime),
        phone: phone.trim() || null,
        warehouseId: selectedWarehouseId.trim(),
      });

      if (!response.success || !response.data) {
        throw new Error(response.message || 'Không thể tạo lịch giao ASN.');
      }

      setCreatedAsn(response.data);
      setExistingAsn(response.data);
    } catch (submitError) {
      setError(getApiErrorMessage(submitError));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <View style={{ backgroundColor: colors.surface.page }} className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" color={colors.brand.primary} />
        <Text style={{ color: colors.brand.primary }} className="mt-4 font-medium">Đang chuẩn bị lịch giao...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={{ backgroundColor: colors.surface.page }} className="flex-1" contentContainerStyle={{ padding: 20, paddingBottom: 100 }}>
      <View className="gap-5">
        <View style={{ backgroundColor: colors.brand.primary }} className="rounded-3xl p-5">
          <View className="flex-row items-start justify-between gap-3">
            <View className="flex-1">
              <Text style={{ color: colors.brand.primaryForeground }} className="text-xs font-bold uppercase tracking-wider">Đặt lịch giao kho</Text>
              <Text className="mt-2 text-2xl font-extrabold text-white">
                {order?.trackingCode || 'Đơn hàng'}
              </Text>
              <Text selectable className="mt-1 text-xs font-medium text-white/80">
                {orderId}
              </Text>
            </View>
            <Pressable onPress={() => router.back()} className="rounded-full bg-white/15 p-2">
              <Ionicons name="close" size={20} color="#FFFFFF" />
            </Pressable>
          </View>
        </View>

        {error ? (
          <View className="rounded-2xl border border-red-200 bg-red-50 p-4">
            <Text selectable className="text-sm font-semibold leading-5 text-red-700">{error}</Text>
          </View>
        ) : null}

        {order ? (
          <View style={{ backgroundColor: colors.surface.card, borderColor: colors.border.default }} className="gap-3 rounded-3xl border p-5">
            <Text style={{ color: colors.text.primary }} className="text-lg font-extrabold">Thông tin tuyến</Text>
            <InfoRow label="Trạng thái" value={translateOrderStatus(order.status)} />
            <InfoRow label="Tuyến" value={order.route ? `${order.route.originCity} → ${order.route.destCity}` : 'Chưa có tuyến'} />
            <InfoRow label="Route code" value={order.route?.routeCode || 'Chưa có'} />
            <InfoRow label="Cut-off" value={order.route?.cutOffTime || 'Chưa có'} />
            <InfoRow label="Hàng hóa" value={`${order.itemName} • ${order.expectedWeightKg} kg`} />
          </View>
        ) : null}

        {displayedAsn ? (
          <AsnResultCard asn={displayedAsn} warehouseName={selectedWarehouse?.warehouseName} />
        ) : (
          <View style={{ backgroundColor: colors.surface.card, borderColor: colors.border.default }} className="gap-4 rounded-3xl border p-5">
            <Text style={{ color: colors.text.primary }} className="text-lg font-extrabold">Thông tin đặt lịch</Text>

            {warehouseMessage ? (
              <View style={{ backgroundColor: colors.surface.muted }} className="rounded-2xl p-4">
                <Text style={{ color: colors.brand.primary }} className="text-sm font-semibold leading-5">{warehouseMessage}</Text>
              </View>
            ) : null}

            <View className="gap-3">
              {warehouses.map((warehouse) => {
                const isSelected = warehouse.warehouseId === selectedWarehouseId;

                return (
                  <Pressable
                    key={warehouse.warehouseId}
                    onPress={() => setSelectedWarehouseId(warehouse.warehouseId)}
                    style={{
                      backgroundColor: isSelected ? colors.surface.selected : colors.surface.card,
                      borderColor: isSelected ? colors.border.selected : colors.border.default,
                    }}
                    className="rounded-2xl border p-4"
                  >
                    <View className="flex-row items-start justify-between gap-3">
                      <View className="flex-1">
                        <Text style={{ color: colors.text.primary }} className="text-base font-bold">{warehouse.warehouseName}</Text>
                        <Text style={{ color: colors.brand.primary }} className="mt-1 text-xs font-semibold">{warehouse.warehouseCode}</Text>
                        <Text style={{ color: colors.text.secondary }} className="mt-2 text-sm leading-5">
                          {warehouse.address || 'Chưa có địa chỉ'}
                        </Text>
                      </View>
                      {isSelected ? <Ionicons name="checkmark-circle" size={24} color={colors.brand.primary} /> : null}
                    </View>
                  </Pressable>
                );
              })}
            </View>

            <View className="gap-3">
              <Text style={{ color: colors.text.secondary }} className="text-xs font-bold uppercase tracking-wider">Ngày/giờ giao kho</Text>
              <View className="flex-row gap-3">
                <Pressable
                  onPress={() => setVisiblePicker((currentMode) => (currentMode === 'date' ? null : 'date'))}
                  style={{ backgroundColor: colors.surface.card, borderColor: colors.border.default }}
                  className="flex-1 rounded-2xl border px-4 py-3"
                >
                  <Text style={{ color: colors.text.muted }} className="text-[11px] font-bold uppercase tracking-wider">Ngày</Text>
                  <Text style={{ color: colors.text.primary }} className="mt-1 text-base font-extrabold">
                    {formatDisplayDate(dropoffDateTime)}
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => setVisiblePicker((currentMode) => (currentMode === 'time' ? null : 'time'))}
                  style={{ backgroundColor: colors.surface.card, borderColor: colors.border.default }}
                  className="w-32 rounded-2xl border px-4 py-3"
                >
                  <Text style={{ color: colors.text.muted }} className="text-[11px] font-bold uppercase tracking-wider">Giờ</Text>
                  <Text style={{ color: colors.text.primary }} className="mt-1 text-base font-extrabold">
                    {formatDisplayTime(dropoffDateTime)}
                  </Text>
                </Pressable>
              </View>

              <View style={{ backgroundColor: colors.surface.muted }} className="rounded-2xl p-4">
                <Text style={{ color: colors.brand.primary }} className="text-sm font-semibold leading-5">{dropoffWindowText}</Text>
              </View>

              {isAndroid ? (
                visiblePicker ? (
                  <DateTimePicker
                    value={dropoffDateTime}
                    mode={visiblePicker}
                    display="default"
                    minimumDate={visiblePicker === 'date' ? firstSelectableDropoffDateTime : firstSelectableDropoffDateTime}
                    maximumDate={visiblePicker === 'time' ? latestSelectableDropoffDateTime ?? undefined : undefined}
                    minuteInterval={15}
                    onChange={handleDropoffPickerChange(visiblePicker)}
                  />
                ) : null
              ) : (
                <View style={{ backgroundColor: colors.surface.card, borderColor: colors.border.default }} className="gap-3 rounded-2xl border p-3">
                  <DateTimePicker
                    value={dropoffDateTime}
                    mode="date"
                    display="compact"
                    minimumDate={firstSelectableDropoffDateTime}
                    onChange={handleDropoffPickerChange('date')}
                  />
                  <DateTimePicker
                    value={dropoffDateTime}
                    mode="time"
                    display="compact"
                    minimumDate={firstSelectableDropoffDateTime}
                    maximumDate={latestSelectableDropoffDateTime ?? undefined}
                    minuteInterval={15}
                    onChange={handleDropoffPickerChange('time')}
                  />
                </View>
              )}
            </View>

            <Field
              label="Số điện thoại"
              value={phone}
              onChangeText={setPhone}
              placeholder="Không bắt buộc"
              keyboardType="phone-pad"
            />

            <Pressable
              onPress={handleCreateAsn}
              disabled={!canSubmit}
              style={({ pressed }) => ({
                backgroundColor: canSubmit
                  ? pressed
                    ? colors.brand.primaryPressed
                    : colors.brand.primary
                  : colors.surface.muted,
                opacity: pressed && canSubmit ? 0.8 : 1,
              })}
              className="flex-row items-center justify-center gap-2 rounded-2xl px-4 py-4"
            >
              {isSubmitting ? <ActivityIndicator color={colors.text.onPrimary} /> : <Ionicons name="calendar-outline" size={20} color={canSubmit ? colors.text.onPrimary : colors.text.muted} />}
              <Text style={{ color: canSubmit ? colors.text.onPrimary : colors.text.muted }} className="text-base font-extrabold">
                {isSubmitting ? 'Đang tạo ASN...' : 'Xác nhận đặt lịch giao'}
              </Text>
            </Pressable>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <View style={{ backgroundColor: colors.surface.muted }} className="rounded-2xl px-4 py-3">
      <Text style={{ color: colors.text.secondary }} className="text-[11px] font-bold uppercase tracking-wider">{label}</Text>
      <Text selectable style={{ color: colors.text.primary }} className="mt-1 text-sm font-semibold leading-5">
        {value || 'Chưa cập nhật'}
      </Text>
    </View>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'phone-pad';
}) {
  return (
    <View className="gap-2">
      <Text style={{ color: colors.text.secondary }} className="text-xs font-bold uppercase tracking-wider">{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        keyboardType={keyboardType ?? 'default'}
        placeholderTextColor={colors.text.muted}
        style={{ backgroundColor: colors.surface.card, borderColor: colors.border.default, color: colors.text.primary }}
        className="rounded-2xl border px-4 py-3 font-semibold"
      />
    </View>
  );
}

function getSuggestedWarehouse(warehouses: WarehouseResponse[], originCity: string) {
  const originKey = normalizeText(originCity);
  const activeWarehouses = warehouses.filter((warehouse) => warehouse.status.toUpperCase() === 'ACTIVE');

  return (
    activeWarehouses.find((warehouse) => {
      const searchable = normalizeText(
        `${warehouse.warehouseCode} ${warehouse.warehouseName} ${warehouse.address ?? ''}`
      );

      return searchable.includes(originKey) || hasSharedCityAlias(searchable, originKey);
    }) ??
    activeWarehouses[0] ??
    null
  );
}

function hasSharedCityAlias(searchable: string, originKey: string) {
  const hcmAliases = ['hochiminh', 'hcm', 'saigon', 'tphcm'];
  const hnAliases = ['hanoi', 'hn'];

  return (
    (hcmAliases.some((alias) => searchable.includes(alias)) && hcmAliases.some((alias) => originKey.includes(alias))) ||
    (hnAliases.some((alias) => searchable.includes(alias)) && hnAliases.some((alias) => originKey.includes(alias)))
  );
}

function normalizeText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s|\./g, '');
}

function formatDateInput(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function formatDisplayDate(value: Date) {
  const day = String(value.getDate()).padStart(2, '0');
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const year = value.getFullYear();

  return `${day}/${month}/${year}`;
}

function formatDisplayTime(value: Date) {
  const hours = String(value.getHours()).padStart(2, '0');
  const minutes = String(value.getMinutes()).padStart(2, '0');

  return `${hours}:${minutes}`;
}

function formatDateTimeForApi(value: Date) {
  return `${formatDateInput(value)}T${formatDisplayTime(value)}:00`;
}

function getDefaultDropoffDateTime(cutOffTime?: string | null) {
  const preferredDropoff = new Date();
  preferredDropoff.setHours(preferredDropoff.getHours() + DEFAULT_DROPOFF_OFFSET_HOURS);

  return clampDropoffDateTime(preferredDropoff, cutOffTime);
}

function clampDropoffDateTime(value: Date, cutOffTime?: string | null) {
  let nextDropoff = roundUpToNextInterval(value, DROPOFF_INTERVAL_MINUTES);
  const earliestDropoff = roundUpToNextInterval(new Date(), DROPOFF_INTERVAL_MINUTES);

  if (nextDropoff < earliestDropoff) {
    nextDropoff = earliestDropoff;
  }

  const latestDropoff = getLatestAllowedDropoffDateTime(nextDropoff, cutOffTime);
  if (!latestDropoff || nextDropoff <= latestDropoff) {
    return nextDropoff;
  }

  if (latestDropoff >= earliestDropoff) {
    return latestDropoff;
  }

  return getNextAvailableDropoffDateTime(cutOffTime, addDays(startOfDay(nextDropoff), 1));
}

function isAllowedDropoffDateTime(value: Date, cutOffTime?: string | null) {
  const earliestDropoff = roundUpToNextInterval(new Date(), DROPOFF_INTERVAL_MINUTES);
  if (value < earliestDropoff) return false;

  const latestDropoff = getLatestAllowedDropoffDateTime(value, cutOffTime);
  return !latestDropoff || value <= latestDropoff;
}

function getFirstSelectableDropoffDateTime(cutOffTime?: string | null) {
  return getNextAvailableDropoffDateTime(cutOffTime, new Date());
}

function getNextAvailableDropoffDateTime(cutOffTime?: string | null, fromDate = new Date()) {
  const earliestNow = roundUpToNextInterval(new Date(), DROPOFF_INTERVAL_MINUTES);
  const normalizedFromDate = roundUpToNextInterval(fromDate, DROPOFF_INTERVAL_MINUTES);
  const searchStart = normalizedFromDate > earliestNow ? normalizedFromDate : earliestNow;

  if (!parseCutOffTime(cutOffTime)) {
    return searchStart;
  }

  const searchStartDay = startOfDay(searchStart);
  for (let dayOffset = 0; dayOffset < 31; dayOffset += 1) {
    const day = addDays(searchStartDay, dayOffset);
    const earliestOnDay = isSameCalendarDate(day, searchStart) ? searchStart : day;
    const latestOnDay = getLatestAllowedDropoffDateTime(day, cutOffTime);

    if (!latestOnDay || latestOnDay < earliestOnDay) continue;
    if (isSameCalendarDate(day, earliestNow)) return earliestOnDay;

    const preferredMorningDropoff = new Date(day);
    preferredMorningDropoff.setHours(8, 0, 0, 0);

    if (preferredMorningDropoff >= earliestOnDay && preferredMorningDropoff <= latestOnDay) {
      return preferredMorningDropoff;
    }

    return earliestOnDay <= latestOnDay ? earliestOnDay : latestOnDay;
  }

  return searchStart;
}

function getLatestAllowedDropoffDateTime(date: Date, cutOffTime?: string | null) {
  const parsedCutOff = parseCutOffTime(cutOffTime);
  if (!parsedCutOff) return null;

  const latestDropoff = new Date(date);
  latestDropoff.setHours(parsedCutOff.hours, parsedCutOff.minutes, parsedCutOff.seconds, 0);
  latestDropoff.setHours(latestDropoff.getHours() - DROPOFF_BUFFER_HOURS);

  return roundDownToPreviousInterval(latestDropoff, DROPOFF_INTERVAL_MINUTES);
}

function getDropoffWindowText(value: Date, cutOffTime?: string | null) {
  const latestDropoff = getLatestAllowedDropoffDateTime(value, cutOffTime);

  if (!latestDropoff) {
    return 'Chọn ngày/giờ bằng picker. Hệ thống không cho chọn thời gian trong quá khứ.';
  }

  const earliestDropoff = roundUpToNextInterval(new Date(), DROPOFF_INTERVAL_MINUTES);
  const isToday = isSameCalendarDate(value, earliestDropoff);
  const earliestText = isToday ? `từ ${formatDisplayTime(earliestDropoff)} ` : '';

  return `Ngày ${formatDisplayDate(value)} có thể chọn ${earliestText}đến ${formatDisplayTime(latestDropoff)} (cut-off trừ ${DROPOFF_BUFFER_HOURS} giờ).`;
}

function parseCutOffTime(value?: string | null) {
  const matched = value?.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!matched) return null;

  const hours = Number(matched[1]);
  const minutes = Number(matched[2]);
  const seconds = Number(matched[3] ?? 0);

  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59 || seconds < 0 || seconds > 59) {
    return null;
  }

  return { hours, minutes, seconds };
}

function roundUpToNextInterval(value: Date, intervalMinutes: number) {
  const rounded = new Date(value);
  rounded.setSeconds(0, 0);

  const remainder = rounded.getMinutes() % intervalMinutes;
  if (remainder > 0) {
    rounded.setMinutes(rounded.getMinutes() + intervalMinutes - remainder);
  }

  return rounded;
}

function roundDownToPreviousInterval(value: Date, intervalMinutes: number) {
  const rounded = new Date(value);
  rounded.setSeconds(0, 0);
  rounded.setMinutes(Math.floor(rounded.getMinutes() / intervalMinutes) * intervalMinutes);

  return rounded;
}

function startOfDay(value: Date) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);

  return date;
}

function addDays(value: Date, days: number) {
  const date = new Date(value);
  date.setDate(date.getDate() + days);

  return date;
}

function isSameCalendarDate(left: Date, right: Date) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

function getSingleParam(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

function isContractSigned(status: string) {
  return status.toUpperCase() === 'CONTRACT_SIGNED';
}

function translateOrderStatus(status: string) {
  return isContractSigned(status) ? 'Đã ký hợp đồng' : status;
}
