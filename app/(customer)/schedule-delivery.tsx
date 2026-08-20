import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { colors } from '../../constants/colors';
import { AsnResultCard } from '../../components/asn-result-card';
import { createAsn, getCustomerAsns, type AsnResponse } from '../../services/asnApi';
import { ApiClientError, getApiErrorMessage } from '../../services/apiClient';
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
  const [hasVerifiedAsnState, setHasVerifiedAsnState] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warehouseMessage, setWarehouseMessage] = useState<string | null>(null);
  const submitLockRef = useRef(false);
  const loadRequestIdRef = useRef(0);

  const displayedAsn = getAsnForOrder(createdAsn, orderId) ?? getAsnForOrder(existingAsn, orderId);
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
    hasVerifiedAsnState &&
    !displayedAsn &&
    Boolean(selectedWarehouseId) &&
    Boolean(order && isContractSigned(order.status)) &&
    isDropoffDateTimeValid;

  const resetOrderScopedState = useCallback(() => {
    setOrder(null);
    setExistingAsn(null);
    setCreatedAsn(null);
    setWarehouses([]);
    setSelectedWarehouseId('');
    setPhone('');
    setDropoffDateTime(getDefaultDropoffDateTime());
    setVisiblePicker(null);
    setHasVerifiedAsnState(false);
    setError(null);
    setWarehouseMessage(null);
    submitLockRef.current = false;
  }, []);

  const loadScheduleContext = useCallback(async () => {
    const requestId = loadRequestIdRef.current + 1;
    loadRequestIdRef.current = requestId;

    const isStaleRequest = () => loadRequestIdRef.current !== requestId;

    setIsLoading(true);
    resetOrderScopedState();

    if (!accessToken || !orderId || !customerId) {
      setHasVerifiedAsnState(false);
      setError('Không tìm thấy phiên đăng nhập, mã khách hàng hoặc mã đơn hàng.');
      setIsLoading(false);
      return;
    }

    try {
      const orderResponse = await getOrderById(accessToken, orderId);
      if (isStaleRequest()) return;

      if (!orderResponse.success || !orderResponse.data) {
        throw new Error(orderResponse.message || 'Không thể lấy thông tin đơn hàng.');
      }

      const nextOrder = orderResponse.data;
      setOrder(nextOrder);
      setDropoffDateTime((currentDropoff) => clampDropoffDateTime(currentDropoff, nextOrder.route?.cutOffTime));

      if (!isContractSigned(nextOrder.status)) {
        setError('Đơn hàng này chưa ở trạng thái CONTRACT_SIGNED nên chưa thể đặt lịch giao.');
      }

      const asnResponse = await getCustomerAsns(accessToken, customerId);
      if (isStaleRequest()) return;

      if (!asnResponse.success) {
        throw new Error(asnResponse.message || 'Không thể kiểm tra lịch giao kho hiện có.');
      }

      const orderAsns = (asnResponse.data ?? []).filter((asn) => isSameOrderId(asn.orderId, orderId));
      const matchedAsn =
        (asnId ? orderAsns.find((asn) => asn.asnId === asnId) : null) ?? orderAsns[0] ?? null;

      setExistingAsn(matchedAsn);
      setHasVerifiedAsnState(true);
      if (matchedAsn?.phone) setPhone(matchedAsn.phone);
      if (matchedAsn?.warehouseId) setSelectedWarehouseId(matchedAsn.warehouseId);

      const originCity = nextOrder.route?.originCity;
      if (!originCity) {
        setWarehouseMessage('Đơn hàng chưa có tuyến xuất phát nên chưa thể tự tìm kho.');
        return;
      }

      const warehouseResponse = await searchWarehousesByOrigin(accessToken, originCity);
      if (isStaleRequest()) return;

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
      if (!isStaleRequest()) {
        setIsLoading(false);
      }
    }
  }, [accessToken, asnId, customerId, orderId, resetOrderScopedState]);

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
    if (submitLockRef.current || isSubmitting) {
      return;
    }

    if (!accessToken || !orderId) {
      setError('Không tìm thấy phiên đăng nhập hoặc mã đơn hàng.');
      return;
    }

    if (!customerId || !hasVerifiedAsnState) {
      setError('Chưa thể xác nhận đơn hàng chưa có lịch giao kho. Vui lòng tải lại màn hình.');
      return;
    }

    if (displayedAsn) {
      setError('Đơn hàng này đã có lịch giao kho.');
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

    submitLockRef.current = true;

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

      const refreshedAsnResponse = await getCustomerAsns(accessToken, customerId);
      if (!refreshedAsnResponse.success) {
        throw new Error(refreshedAsnResponse.message || 'ASN đã được tạo nhưng không thể tải lại dữ liệu từ máy chủ.');
      }

      const serverAsn = findAsnForOrder(refreshedAsnResponse.data ?? [], orderId);
      if (!serverAsn) {
        throw new Error('ASN đã được tạo nhưng máy chủ chưa trả về lịch giao kho của đơn hàng.');
      }

      setCreatedAsn(serverAsn);
      setExistingAsn(serverAsn);
    } catch (submitError) {
      if (submitError instanceof ApiClientError && submitError.status === 409) {
        setHasVerifiedAsnState(false);

        try {
          const refreshedAsnResponse = await getCustomerAsns(accessToken, customerId);
          if (!refreshedAsnResponse.success) {
            throw new Error(refreshedAsnResponse.message || 'Không thể tải lại lịch giao kho hiện có.');
          }

          const serverAsn = findAsnForOrder(refreshedAsnResponse.data ?? [], orderId);
          if (serverAsn) {
            setCreatedAsn(null);
            setExistingAsn(serverAsn);
            setHasVerifiedAsnState(true);
          }
        } catch {
          // Keep submission disabled until the screen can verify ASN state again.
        }
      }

      setError(getApiErrorMessage(submitError));
    } finally {
      submitLockRef.current = false;
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
              <Text style={{ color: colors.brand.primaryForeground }} className="text-xs font-bold uppercase tracking-wider">
                Phiếu gửi hàng trước (ASN)
              </Text>
              <Text className="mt-2 text-2xl font-extrabold text-white">
                {order?.trackingCode || 'Đặt lịch giao kho'}
              </Text>
              <Text selectable className="mt-1 text-xs font-medium text-white/80">
                {order?.itemName ? `${order.itemName} • ` : ''}Tạo mã QR tiếp nhận hàng tại kho
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

        {order ? <TripInfoCard order={order} /> : null}

        {displayedAsn ? (
          <View className="gap-4">
            <View style={{ backgroundColor: colors.surface.muted }} className="rounded-2xl p-4">
              <Text style={{ color: colors.brand.primary }} className="text-sm font-semibold leading-5">
                Đơn hàng này đã có phiếu hẹn giao kho & mã QR tiếp nhận.
              </Text>
            </View>
            <AsnResultCard
              asn={displayedAsn}
              warehouseName={selectedWarehouse?.warehouseName}
              trackingCode={order?.trackingCode}
              itemName={order?.itemName}
            />
          </View>
        ) : (
          <View style={{ backgroundColor: colors.surface.card, borderColor: colors.border.default }} className="gap-4 rounded-3xl border p-5">
            {/* ── Business Context Guide ── */}
            <View className="rounded-2xl border border-blue-200 bg-blue-50/80 p-4">
              <View className="flex-row items-start gap-3">
                <Ionicons name="information-circle" size={22} color={colors.brand.primary} />
                <View className="flex-1">
                  <Text className="text-sm font-bold text-blue-950">
                    Quy trình tiếp nhận hàng tại kho (ASN)
                  </Text>
                  <Text className="mt-1 text-xs leading-5 text-blue-900">
                    Quý khách vui lòng chọn kho đến và hẹn giờ mang hàng tới kho (trước tối thiểu 6 tiếng). Sau khi đặt lịch, hệ thống sẽ cấp mã QR để tài xế xuất trình khi bàn giao hàng.
                  </Text>
                </View>
              </View>
            </View>

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

            <View
              style={{
                height: 54,
                borderRadius: 16,
                borderWidth: 1,
                backgroundColor: isSubmitting || canSubmit ? colors.brand.primary : colors.brand.primarySoft,
                borderColor: isSubmitting || canSubmit ? colors.brand.primary : colors.border.default,
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'row',
                gap: 8,
                overflow: 'hidden',
                shadowColor: isSubmitting || canSubmit ? colors.brand.primary : 'transparent',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: isSubmitting || canSubmit ? 0.15 : 0,
                shadowRadius: 4,
                elevation: isSubmitting || canSubmit ? 2 : 0,
              }}
            >
              {isSubmitting ? (
                <>
                  <ActivityIndicator size="small" color="#FFFFFF" />
                  <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '700', includeFontPadding: false }}>
                    Đang tạo phiếu tiếp nhận...
                  </Text>
                </>
              ) : (
                <>
                  <Ionicons
                    name="qr-code-outline"
                    size={20}
                    color={canSubmit ? '#FFFFFF' : colors.text.secondary}
                  />
                  <Text
                    style={{
                      color: canSubmit ? '#FFFFFF' : colors.text.secondary,
                      fontSize: 16,
                      fontWeight: '700',
                      includeFontPadding: false,
                    }}
                  >
                    Xác nhận đặt lịch & Nhận mã QR
                  </Text>
                </>
              )}

              <Pressable
                accessibilityRole="button"
                accessibilityLabel={isSubmitting ? 'Đang tạo phiếu tiếp nhận...' : 'Xác nhận đặt lịch và nhận mã QR'}
                disabled={!canSubmit || isSubmitting}
                onPress={handleCreateAsn}
                style={StyleSheet.absoluteFillObject}
              />
            </View>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

function TripInfoCard({ order }: { order: OrderResponse }) {
  const routeText = order.route ? `${order.route.originCity} → ${order.route.destCity}` : 'Chưa có tuyến';

  return (
    <View style={{ backgroundColor: colors.surface.card, borderColor: colors.border.default }} className="gap-4 rounded-3xl border p-5">
      <View className="gap-1">
        <Text style={{ color: colors.text.secondary }} className="text-xs font-bold uppercase tracking-wider">
          Thông tin chuyến
        </Text>
        <Text selectable style={{ color: colors.text.primary }} className="text-lg font-extrabold leading-6">
          {routeText}
        </Text>
      </View>

      <View style={{ backgroundColor: colors.border.default, height: 1 }} />

      <View className="gap-1">
        <TripInfoLine label="Trạng thái" value={translateOrderStatus(order.status)} />
        <TripInfoLine label="Route code" value={order.route?.routeCode || 'Chưa có'} />
        <TripInfoLine label="Cut-off" value={order.route?.cutOffTime || 'Chưa có'} />
        <TripInfoLine label="Hàng hóa" value={`${order.itemName} • ${order.expectedWeightKg} kg`} />
      </View>
    </View>
  );
}

function TripInfoLine({ label, value }: { label: string; value?: string | null }) {
  return (
    <View className="flex-row items-start justify-between gap-4 py-2">
      <Text style={{ color: colors.text.secondary }} className="text-sm font-semibold">
        {label}
      </Text>
      <Text selectable style={{ color: colors.text.primary }} className="flex-1 text-right text-sm font-bold leading-5">
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

function getAsnForOrder(asn: AsnResponse | null, orderId?: string | null) {
  return isSameOrderId(asn?.orderId, orderId) ? asn : null;
}

function findAsnForOrder(asns: AsnResponse[], orderId?: string | null) {
  return asns.find((asn) => isSameOrderId(asn.orderId, orderId)) ?? null;
}

function isSameOrderId(left?: string | null, right?: string | null) {
  return Boolean(left && right && left.trim().toLowerCase() === right.trim().toLowerCase());
}

function isContractSigned(status: string) {
  return status.toUpperCase() === 'CONTRACT_SIGNED';
}

function translateOrderStatus(status: string) {
  return isContractSigned(status) ? 'Đã ký hợp đồng' : status;
}
