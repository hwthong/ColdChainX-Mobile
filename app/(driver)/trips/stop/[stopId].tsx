import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton } from '../../../../components/AppButton';
import { AppInput } from '../../../../components/AppInput';
import { ApiClientError } from '../../../../services/apiClient';
import { deliveryApi } from '../../../../services/deliveryApi';
import {
  driverApi,
  DriverTripStopDto,
} from '../../../../services/driverApi';
import {
  getOrderById,
  OrderResponse,
} from '../../../../services/orderApi';
import {
  getPlannedTripRoute,
  getTrackingByTripId,
  TripRouteLpnDto,
  TripRouteOrderDto,
  TripRoutePointDto,
} from '../../../../services/trackingApi';
import { useAuthStore } from '../../../../store/useAuthStore';

type ScreenStep = 'ORDERS' | 'SIGNATURE' | 'COD';

type StopOrder = {
  orderId: string;
  trackingCode: string;
  itemName: string;
  category?: string | null;
  status: string;
  lpns: TripRouteLpnDto[];
};

const STOP_STATUS: Record<string, string> = {
  PLANNED: 'Chờ check-in',
  ARRIVED: 'Đã check-in',
  DEPARTED: 'Đã rời đi',
  FAILED_DELIVERY: 'Giao hàng thất bại',
};

const HANDOVER_STATUSES = new Set([
  'DELIVERED',
  'RETURNED',
  'REJECTED',
  'PARTIALLY_DELIVERED',
]);

export default function StopDetailScreen() {
  const params = useLocalSearchParams<{
    stopId?: string | string[];
    tripId?: string | string[];
  }>();
  const stopId = firstParam(params.stopId);
  const tripId = firstParam(params.tripId);
  const router = useRouter();
  const token = useAuthStore((state) => state.token);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [driverStop, setDriverStop] = useState<DriverTripStopDto | null>(null);
  const [orders, setOrders] = useState<StopOrder[]>([]);
  const [step, setStep] = useState<ScreenStep>('ORDERS');
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [receiverName, setReceiverName] = useState('');
  const [signatureAsset, setSignatureAsset] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [epodId, setEpodId] = useState('');
  const [codAmountDue, setCodAmountDue] = useState(0);
  const [newSealCode, setNewSealCode] = useState('');

  const selectedOrder = useMemo(
    () => orders.find((order) => order.orderId === selectedOrderId) ?? null,
    [orders, selectedOrderId]
  );
  const allOrdersHandedOver = orders.every(isHandoverConfirmed);
  const stopStatus = driverStop?.status?.toUpperCase() || 'UNKNOWN';
  const hasCheckedIn = stopStatus === 'ARRIVED';
  const hasDeparted = stopStatus === 'DEPARTED';

  const loadData = useCallback(async (showSpinner = true) => {
    if (!token || !tripId || !stopId) {
      setLoadError('Thiếu phiên đăng nhập, TripId hoặc StopId hợp lệ.');
      setLoading(false);
      return false;
    }

    if (showSpinner) setLoading(true);
    setLoadError(null);

    try {
      const [tripDetail, routeResponse] = await Promise.all([
        driverApi.getMyTripDetail(tripId),
        getPlannedTripRoute(token, tripId),
      ]);
      if (!routeResponse.success || !routeResponse.data) {
        throw new Error('Không thể tải tuyến đường của chuyến.');
      }

      const currentStop = tripDetail.stops.find((stop) => stop.stopId === stopId);
      if (!currentStop) {
        throw new ApiClientError('Stop không thuộc chuyến được giao.', 404);
      }

      const route = routeResponse.data;
      const routeStop = route.optimizedStops.find((stop) => stop.stopId === stopId);
      let routeOrders: TripRouteOrderDto[];
      let stopLocationId: string | null | undefined;
      let routeLpns: TripRouteLpnDto[];

      if (routeStop) {
        routeOrders = routeStop.orders;
        stopLocationId = routeStop.locationId;
        routeLpns = routeStop.lpns;
      } else {
        const boundaryPoint = resolveBoundaryPoint(
          currentStop,
          tripDetail.stops,
          route.origin,
          route.destination
        );
        if (!boundaryPoint?.locationId) {
          throw new Error('Không xác định được vị trí thật của điểm dừng từ dữ liệu tuyến.');
        }

        stopLocationId = boundaryPoint.locationId;
        routeLpns = [];

        const trackingResponse = await getTrackingByTripId(token, tripId);
        if (!trackingResponse.success || !trackingResponse.data) {
          throw new Error('Không thể tải danh sách đơn hàng của chuyến.');
        }
        routeOrders = trackingResponse.data.orders;
      }

      const orderDetails = await loadOrderDetails(token, routeOrders);
      const ordersAtStop = routeStop
        ? orderDetails
        : orderDetails.filter((order) => order.destination?.locationId === stopLocationId);
      const routeOrderById = new Map(routeOrders.map((order) => [order.orderId, order]));

      const nextOrders = ordersAtStop.map((order): StopOrder => {
        const routeOrder = routeOrderById.get(order.orderId);
        return {
          orderId: order.orderId,
          trackingCode: order.trackingCode || routeOrder?.trackingCode || order.orderId.slice(0, 8),
          itemName: order.itemName || routeOrder?.itemName || 'Đơn hàng',
          category: order.category || routeOrder?.category,
          status: order.status,
          lpns: routeLpns.filter((lpn) => lpn.orderId === order.orderId),
        };
      });

      setDriverStop(currentStop);
      setOrders(nextOrders);
      setSelectedOrderId((current) =>
        current && nextOrders.some((order) => order.orderId === current) ? current : null
      );
      return true;
    } catch (error) {
      setLoadError(formatActionError(error, 'LOAD'));
      return false;
    } finally {
      if (showSpinner) setLoading(false);
    }
  }, [stopId, token, tripId]);

  useFocusEffect(
    useCallback(() => {
      void loadData();
    }, [loadData])
  );

  const handleCheckIn = async () => {
    if (!stopId) return;

    const permission = await getForegroundLocationPermission();
    if (!permission) return;

    setIsGettingLocation(true);
    let currentLocation: Location.LocationObject;
    try {
      currentLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
    } catch {
      Alert.alert(
        'Không lấy được GPS',
        'Hãy bật dịch vụ vị trí, kiểm tra GPS của thiết bị rồi thử lại. Trên Android Emulator, hãy đặt vị trí trong Extended controls > Location.'
      );
      setIsGettingLocation(false);
      return;
    }
    setIsGettingLocation(false);

    try {
      setIsProcessing(true);
      await deliveryApi.checkInStop(stopId, {
        latitude: currentLocation.coords.latitude,
        longitude: currentLocation.coords.longitude,
      });
      const reloaded = await loadData(false);
      Alert.alert(
        'Check-in thành công',
        reloaded
          ? 'Bạn đã đến điểm giao hàng.'
          : 'Check-in đã được ghi nhận nhưng chưa tải lại được dữ liệu Stop.'
      );
    } catch (error) {
      Alert.alert('Không thể Check-in', formatActionError(error, 'CHECK_IN'));
      if (isAlreadyCheckedInError(error)) {
        await loadData(false);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const startHandover = (order: StopOrder) => {
    setSelectedOrderId(order.orderId);
    setReceiverName('');
    setSignatureAsset(null);
    setStep('ORDERS');
  };

  const continueToSignature = () => {
    if (!selectedOrder) {
      Alert.alert('Chưa chọn Order', 'Hãy chọn một Order cần bàn giao.');
      return;
    }
    if (!receiverName.trim()) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập tên người nhận.');
      return;
    }
    setSignatureAsset(null);
    setStep('SIGNATURE');
  };

  const pickSignatureImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        'Chưa có quyền ảnh',
        'Vui lòng cấp quyền thư viện ảnh để chọn ảnh chữ ký thật của người nhận.'
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.9,
    });
    if (!result.canceled && result.assets[0]) {
      setSignatureAsset(result.assets[0]);
    }
  };

  const handleHandoverConfirm = async () => {
    if (!stopId || !selectedOrder || !signatureAsset) {
      Alert.alert('Thiếu chữ ký', 'Vui lòng chọn ảnh chữ ký thật của người nhận.');
      return;
    }

    try {
      setIsProcessing(true);
      const formData = new FormData();
      formData.append('OrderId', selectedOrder.orderId);
      formData.append('ReceiverName', receiverName.trim());
      formData.append('SignatureFile', {
        uri: signatureAsset.uri,
        name: signatureAsset.fileName || 'receiver-signature.jpg',
        type: signatureAsset.mimeType || 'image/jpeg',
      } as unknown as Blob);

      const result = await deliveryApi.confirmHandover(stopId, formData);
      setEpodId(result.epodId);
      setCodAmountDue(result.codAmountDue);

      const reloaded = await loadData(false);
      if (!reloaded) {
        Alert.alert(
          'Đã ghi nhận bàn giao',
          'Backend đã ghi nhận nhưng Mobile chưa tải lại được trạng thái Order. Vui lòng thử tải lại trước khi rời đi.'
        );
      }

      if (result.codAmountDue > 0) {
        setStep('COD');
      } else {
        resetOrderForm();
        Alert.alert('Bàn giao thành công', 'Order đã được Backend xác nhận bàn giao.');
      }
    } catch (error) {
      Alert.alert('Không thể bàn giao', formatActionError(error, 'HANDOVER'));
      await loadData(false);
      setSignatureAsset(null);
      setStep('ORDERS');
    } finally {
      setIsProcessing(false);
    }
  };

  const resetOrderForm = () => {
    setSelectedOrderId(null);
    setReceiverName('');
    setSignatureAsset(null);
    setStep('ORDERS');
  };

  const handleCodPayment = async (method: 'CASH' | 'QR') => {
    if (!epodId) {
      Alert.alert('Thiếu e-POD', 'Không tìm thấy e-POD để ghi nhận COD.');
      return;
    }

    try {
      setIsProcessing(true);
      const formData = new FormData();
      formData.append('PaymentMethod', method);
      formData.append('CodAmountPaid', codAmountDue.toString());

      await deliveryApi.recordCodPayment(epodId, formData);
      const reloaded = await loadData(false);
      resetOrderForm();
      Alert.alert(
        'Đã ghi nhận COD',
        reloaded
          ? 'Thanh toán COD đã được Backend ghi nhận.'
          : 'COD đã được ghi nhận nhưng chưa tải lại được dữ liệu Order.'
      );
    } catch (error) {
      Alert.alert('Không thể ghi nhận COD', formatActionError(error, 'COD'));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeparture = async () => {
    if (!stopId || !tripId) return;
    if (!allOrdersHandedOver) {
      Alert.alert(
        'Chưa thể rời đi',
        'Vẫn còn Order chưa được Backend xác nhận bàn giao.'
      );
      return;
    }

    try {
      setIsProcessing(true);
      const result = await deliveryApi.departStop(stopId, {
        newSealCode: newSealCode.trim() || undefined,
      });

      if (result.tripCompleted) {
        Alert.alert('Hoàn tất', 'Chuyến đi đã hoàn thành.', [
          {
            text: 'OK',
            onPress: () => router.replace('/(driver)/trips' as never),
          },
        ]);
      } else {
        Alert.alert('Đã rời điểm dừng', 'Hãy tiếp tục đến Stop tiếp theo.', [
          {
            text: 'OK',
            onPress: () => router.replace({
              pathname: '/(driver)/trips/[id]',
              params: { id: tripId },
            } as never),
          },
        ]);
      }
    } catch (error) {
      Alert.alert('Không thể rời đi', formatActionError(error, 'DEPART'));
      await loadData(false);
    } finally {
      setIsProcessing(false);
    }
  };

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-[#F6F8F2]">
        <ActivityIndicator size="large" color="#8B4513" />
        <Text className="mt-3 text-amber-800">Đang tải điểm dừng...</Text>
      </View>
    );
  }

  if (loadError || !driverStop) {
    return (
      <View className="flex-1 items-center justify-center bg-[#F6F8F2] px-6">
        <Ionicons name="alert-circle-outline" size={48} color="#991B1B" />
        <Text className="mt-4 text-center text-red-800">
          {loadError || 'Không tìm thấy dữ liệu điểm dừng.'}
        </Text>
        <View className="mt-5 w-full">
          <AppButton label="Thử tải lại" onPress={() => void loadData()} />
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-[#F6F8F2]" edges={['bottom']}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 100 }}>
        <StopHeader stop={driverStop} orderCount={orders.length} />

        {hasDeparted ? (
          <View className="mt-10 items-center rounded-2xl border border-green-200 bg-green-50 p-6">
            <Ionicons name="checkmark-circle" size={64} color="#15803d" />
            <Text className="mt-3 text-lg font-bold text-green-900">
              Stop đã hoàn tất
            </Text>
            <Text className="mt-2 text-center text-green-800">
              Điểm dừng này đã được xác nhận rời đi và không thể thao tác lại.
            </Text>
          </View>
        ) : !hasCheckedIn ? (
          <View className="mt-10 items-center">
            <Ionicons name="location" size={64} color="#8B4513" />
            <Text className="mb-6 mt-4 text-center text-base text-amber-900">
              Check-in sử dụng vị trí GPS hiện tại và Backend sẽ kiểm tra geofence 200 m.
            </Text>
            {isGettingLocation ? (
              <Text className="mb-3 text-sm font-semibold text-amber-800">
                Đang lấy vị trí GPS hiện tại...
              </Text>
            ) : null}
            <View className="w-full">
              <AppButton
                label="Check-in ngay"
                onPress={() => void handleCheckIn()}
                loading={isGettingLocation || isProcessing}
              />
            </View>
          </View>
        ) : step === 'SIGNATURE' && selectedOrder ? (
          <View>
            <Text className="mb-1 text-lg font-bold text-amber-950">
              Chữ ký người nhận
            </Text>
            <Text className="mb-4 text-sm text-amber-700">
              Order {selectedOrder.trackingCode} · Người nhận: {receiverName}
            </Text>
            <View className="rounded-2xl border border-amber-200 bg-white p-4">
              {signatureAsset ? (
                <Image
                  source={{ uri: signatureAsset.uri }}
                  className="mb-4 h-52 w-full rounded-xl bg-amber-50"
                  resizeMode="contain"
                />
              ) : (
                <View className="mb-4 h-52 items-center justify-center rounded-xl bg-amber-50">
                  <Ionicons name="image-outline" size={48} color="#92400E" />
                  <Text className="mt-3 text-center text-sm text-amber-800">
                    Chưa chọn ảnh chữ ký thật của người nhận.
                  </Text>
                </View>
              )}
              <AppButton
                label={signatureAsset ? 'Chọn lại ảnh chữ ký' : 'Chọn ảnh chữ ký'}
                variant="secondary"
                disabled={isProcessing}
                onPress={() => void pickSignatureImage()}
              />
              <View className="mt-3">
                <AppButton
                  label="Xác nhận bàn giao"
                  disabled={!signatureAsset}
                  loading={isProcessing}
                  onPress={() => void handleHandoverConfirm()}
                />
              </View>
            </View>
            <View className="mt-4">
              <AppButton
                label="Quay lại"
                variant="secondary"
                disabled={isProcessing}
                onPress={() => setStep('ORDERS')}
              />
            </View>
          </View>
        ) : step === 'COD' && selectedOrder ? (
          <View className="mt-8 items-center">
            <Ionicons name="cash-outline" size={64} color="#15803d" />
            <Text className="mt-3 text-lg font-bold text-green-800">
              Thu hộ COD · {selectedOrder.trackingCode}
            </Text>
            <Text className="mb-6 mt-2 text-3xl font-bold text-green-900">
              {codAmountDue.toLocaleString('vi-VN')} ₫
            </Text>
            <View className="w-full gap-3">
              <AppButton
                label="Thu tiền mặt"
                onPress={() => void handleCodPayment('CASH')}
                loading={isProcessing}
              />
              <AppButton
                label="Khách quét QR"
                onPress={() => void handleCodPayment('QR')}
                loading={isProcessing}
                variant="secondary"
              />
            </View>
          </View>
        ) : (
          <View>
            <Text className="mb-4 text-lg font-bold text-amber-950">
              Order tại Stop
            </Text>

            {orders.length === 0 ? (
              <View className="rounded-2xl border border-amber-200 bg-white p-4">
                <Text className="text-center text-sm text-amber-800">
                  Stop này không có Order cần bàn giao.
                </Text>
              </View>
            ) : null}

            {orders.map((order) => (
              <OrderCard
                key={order.orderId}
                order={order}
                selected={selectedOrderId === order.orderId}
                disabled={isProcessing}
                onSelect={() => startHandover(order)}
              />
            ))}

            {selectedOrder && !isHandoverConfirmed(selectedOrder) ? (
              <View className="mt-5 rounded-2xl border border-amber-200 bg-white p-4">
                <Text className="mb-3 font-bold text-amber-950">
                  Bàn giao Order {selectedOrder.trackingCode}
                </Text>
                <AppInput
                  label="Tên người nhận hàng"
                  value={receiverName}
                  onChangeText={setReceiverName}
                  placeholder="Nhập tên người nhận..."
                />
                <View className="mt-4 gap-3">
                  <AppButton
                    label="Tiếp tục ký nhận"
                    onPress={continueToSignature}
                    disabled={isProcessing}
                  />
                  <AppButton
                    label="Hủy chọn"
                    variant="secondary"
                    onPress={() => {
                      setSelectedOrderId(null);
                      setReceiverName('');
                      setSignatureAsset(null);
                    }}
                  />
                </View>
              </View>
            ) : null}

            <View className="mt-8 border-t border-amber-200 pt-6">
              <Ionicons
                name={allOrdersHandedOver ? 'shield-checkmark' : 'hourglass-outline'}
                size={54}
                color={allOrdersHandedOver ? '#15803d' : '#92400E'}
                className="self-center"
              />
              <Text className="mt-3 text-center text-lg font-bold text-amber-950">
                {allOrdersHandedOver
                  ? 'Đã bàn giao toàn bộ Order'
                  : 'Còn Order chưa bàn giao'}
              </Text>
              <Text className="mb-5 mt-2 text-center text-sm text-amber-700">
                Chỉ có thể rời đi khi Backend đã xác nhận bàn giao toàn bộ Order tại Stop.
              </Text>
              <AppInput
                label="Mã chì mới (không bắt buộc)"
                value={newSealCode}
                onChangeText={setNewSealCode}
                placeholder="Nhập mã chì..."
              />
              <View className="mt-5">
                <AppButton
                  label="Xác nhận rời đi"
                  onPress={() => void handleDeparture()}
                  loading={isProcessing}
                  disabled={!allOrdersHandedOver}
                />
              </View>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function StopHeader({
  stop,
  orderCount,
}: {
  stop: DriverTripStopDto;
  orderCount: number;
}) {
  const status = stop.status?.toUpperCase() || 'UNKNOWN';
  return (
    <View className="mb-6 rounded-2xl border border-amber-200 bg-white p-4 shadow-sm">
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1">
          <Text className="mb-1 text-sm font-bold text-amber-700">
            ĐIỂM DỪNG {stop.stopSequence}
          </Text>
          <Text className="text-lg font-bold text-amber-950">
            {stop.address}
          </Text>
        </View>
        <View className="rounded-lg bg-amber-100 px-3 py-2">
          <Text className="text-xs font-bold text-amber-900">
            {STOP_STATUS[status] || 'Chưa xác định'}
          </Text>
        </View>
      </View>
      <Text className="mt-3 text-sm text-amber-700">
        {orderCount} Order
      </Text>
    </View>
  );
}

function OrderCard({
  order,
  selected,
  disabled,
  onSelect,
}: {
  order: StopOrder;
  selected: boolean;
  disabled: boolean;
  onSelect: () => void;
}) {
  const confirmed = isHandoverConfirmed(order);
  const status = getOrderStatus(order.status);

  return (
    <Pressable
      disabled={disabled || confirmed}
      onPress={onSelect}
      className={`mb-3 rounded-2xl border bg-white p-4 ${
        selected ? 'border-amber-700' : 'border-amber-200'
      }`}
      style={({ pressed }) => ({
        opacity: confirmed ? 0.75 : pressed ? 0.7 : 1,
      })}
    >
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1">
          <Text className="font-bold text-amber-950">{order.trackingCode}</Text>
          <Text className="mt-1 text-sm text-amber-800">{order.itemName}</Text>
          <Text className="mt-2 text-xs text-amber-700">
            {order.lpns.length} LPN
          </Text>
        </View>
        <View className={`rounded-lg px-3 py-2 ${status.background}`}>
          <Text className={`text-xs font-bold ${status.text}`}>{status.label}</Text>
        </View>
      </View>
      {!confirmed ? (
        <Text className="mt-3 text-sm font-bold text-amber-800">
          {selected ? 'Đang chọn Order này' : 'Chọn để bàn giao'}
        </Text>
      ) : null}
    </Pressable>
  );
}

async function loadOrderDetails(
  token: string,
  routeOrders: TripRouteOrderDto[]
): Promise<OrderResponse[]> {
  const uniqueOrders = Array.from(
    new Map(
      routeOrders
        .filter((order) => Boolean(order.orderId))
        .map((order) => [order.orderId, order])
    ).values()
  );

  const responses = await Promise.all(
    uniqueOrders.map((order) => getOrderById(token, order.orderId))
  );
  return responses.map((response) => {
    if (!response.success || !response.data) {
      throw new Error('Không thể tải trạng thái thật của một Order.');
    }
    return response.data;
  });
}

async function getForegroundLocationPermission() {
  let permission: Location.LocationPermissionResponse;
  try {
    permission = await Location.getForegroundPermissionsAsync();
    if (permission.status !== Location.PermissionStatus.GRANTED && permission.canAskAgain) {
      permission = await Location.requestForegroundPermissionsAsync();
    }
  } catch {
    Alert.alert(
      'Không kiểm tra được quyền vị trí',
      'Thiết bị không thể kiểm tra quyền GPS. Vui lòng thử lại.'
    );
    return false;
  }

  if (permission.status === Location.PermissionStatus.GRANTED) return true;

  Alert.alert(
    'Chưa có quyền vị trí',
    permission.canAskAgain
      ? 'Vui lòng cấp quyền vị trí khi dùng ứng dụng để Check-in.'
      : 'Quyền vị trí đã bị từ chối. Hãy mở Cài đặt của ứng dụng và bật quyền Vị trí.',
    permission.canAskAgain
      ? [{ text: 'Đã hiểu' }]
      : [
          { text: 'Để sau', style: 'cancel' },
          { text: 'Mở Cài đặt', onPress: () => void Linking.openSettings() },
        ]
  );
  return false;
}

function resolveBoundaryPoint(
  stop: DriverTripStopDto,
  stops: DriverTripStopDto[],
  origin?: TripRoutePointDto | null,
  destination?: TripRoutePointDto | null
) {
  const address = normalizeAddress(stop.address);
  if (destination && address === normalizeAddress(destination.address)) return destination;
  if (origin && address === normalizeAddress(origin.address)) return origin;

  const sequences = stops.map((item) => item.stopSequence);
  if (stop.stopSequence === Math.max(...sequences)) return destination;
  if (stop.stopSequence === Math.min(...sequences) && stop.stopType.toUpperCase() === 'PICKUP') {
    return origin;
  }
  return null;
}

function normalizeAddress(value?: string | null) {
  return (value || '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('vi-VN');
}

function firstParam(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

function isHandoverConfirmed(order: StopOrder) {
  return HANDOVER_STATUSES.has(order.status.toUpperCase());
}

function getOrderStatus(statusValue: string) {
  const status = statusValue.toUpperCase();
  if (status === 'RETURNED' || status === 'REJECTED') {
    return {
      label: 'Bị từ chối',
      background: 'bg-red-100',
      text: 'text-red-800',
    };
  }
  if (status === 'PARTIALLY_DELIVERED') {
    return {
      label: 'Đã bàn giao một phần',
      background: 'bg-orange-100',
      text: 'text-orange-800',
    };
  }
  if (status === 'DELIVERED') {
    return {
      label: 'Đã bàn giao',
      background: 'bg-green-100',
      text: 'text-green-800',
    };
  }
  return {
    label: 'Chưa xử lý',
    background: 'bg-amber-100',
    text: 'text-amber-900',
  };
}

function isAlreadyCheckedInError(error: unknown) {
  return error instanceof ApiClientError
    && error.status === 409
    && /already|check.?in/i.test(error.message);
}

function formatActionError(
  error: unknown,
  action: 'LOAD' | 'CHECK_IN' | 'HANDOVER' | 'COD' | 'DEPART'
) {
  if (error instanceof ApiClientError) {
    if (error.status === undefined) {
      return 'Không thể kết nối Backend. Hãy kiểm tra mạng rồi thử lại.';
    }
    if (error.status === 401) {
      return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.';
    }
    if (error.status === 403) {
      return 'Bạn không có quyền thực hiện thao tác này.';
    }
    if (error.status === 404) {
      return action === 'HANDOVER'
        ? 'Không tìm thấy Stop hoặc Order cần bàn giao.'
        : 'Không tìm thấy Trip hoặc Stop được yêu cầu.';
    }

    const message = error.message.toLowerCase();
    if (action === 'CHECK_IN' && /distance|geofence|200|meter|metre|radius/.test(message)) {
      return 'Bạn đang ngoài phạm vi Check-in 200 m của điểm giao hàng.';
    }
    if (action === 'CHECK_IN' && /already|check.?in/.test(message)) {
      return 'Stop này đã được Check-in trước đó.';
    }
    if (action === 'DEPART' && /handover|confirm|order/.test(message)) {
      return 'Vẫn còn Order chưa được xác nhận bàn giao nên chưa thể rời đi.';
    }
    if (error.status === 409) {
      return 'Thao tác xung đột với trạng thái hiện tại. Dữ liệu sẽ được tải lại.';
    }
    if (error.status === 400 || error.status === 422) {
      return 'Backend từ chối yêu cầu do điều kiện nghiệp vụ chưa hợp lệ.';
    }
  }

  switch (action) {
    case 'LOAD':
      return 'Không thể tải dữ liệu thật của điểm dừng. Vui lòng thử lại.';
    case 'CHECK_IN':
      return 'Không thể Check-in. Vui lòng kiểm tra trạng thái Stop rồi thử lại.';
    case 'HANDOVER':
      return 'Không thể xác nhận bàn giao Order. Vui lòng thử lại.';
    case 'COD':
      return 'Không thể ghi nhận thanh toán COD. Vui lòng thử lại.';
    case 'DEPART':
      return 'Không thể xác nhận rời đi. Vui lòng tải lại trạng thái Stop.';
  }
}
