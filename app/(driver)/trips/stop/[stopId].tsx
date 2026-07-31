import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams } from 'expo-router';
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
import {
  ApplySealResponse,
  CutSealResponse,
  DeliveryUploadFile,
  EpodResponse,
  PaymentQrResponse,
  VerifyQrPaymentResponse,
  deliveryApi,
} from '../../../../services/deliveryApi';
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

type ScreenStep = 'ORDERS' | 'SIGNATURE' | 'PAYMENT';

type StopOrder = {
  orderId: string;
  trackingCode: string;
  itemName: string;
  category?: string | null;
  customerId?: string | null;
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
  const token = useAuthStore((state) => state.token);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [driverStop, setDriverStop] = useState<DriverTripStopDto | null>(null);
  const [tripStops, setTripStops] = useState<DriverTripStopDto[]>([]);
  const [orders, setOrders] = useState<StopOrder[]>([]);
  const [step, setStep] = useState<ScreenStep>('ORDERS');
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [checkinProofAsset, setCheckinProofAsset] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [signatureAsset, setSignatureAsset] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [handoverPhotoAsset, setHandoverPhotoAsset] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [paymentProofAsset, setPaymentProofAsset] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [epodId, setEpodId] = useState('');
  const [epod, setEpod] = useState<EpodResponse | null>(null);
  const [paymentQr, setPaymentQr] = useState<PaymentQrResponse | null>(null);
  const [paymentVerification, setPaymentVerification] = useState<VerifyQrPaymentResponse | null>(null);
  const [cutSeal, setCutSeal] = useState<CutSealResponse | null>(null);
  const [appliedSeal, setAppliedSeal] = useState<ApplySealResponse | null>(null);
  const [newSealCode, setNewSealCode] = useState('');

  const selectedOrder = useMemo(
    () => orders.find((order) => order.orderId === selectedOrderId) ?? null,
    [orders, selectedOrderId]
  );
  const allOrdersHandedOver = orders.every(isHandoverConfirmed);
  const stopStatus = driverStop?.status?.toUpperCase() || 'UNKNOWN';
  const hasCheckedIn = stopStatus === 'ARRIVED';
  const hasDeparted = stopStatus === 'DEPARTED';
  const hasRemainingStops = tripStops.some(
    (stop) => stop.stopSequence > (driverStop?.stopSequence ?? Number.MAX_SAFE_INTEGER)
      && stop.status?.toUpperCase() !== 'DEPARTED'
  );
  const deliveryActionState = getDriverDeliveryActionState({
    hasCheckedIn,
    allOrdersHandedOver,
    hasRemainingStops,
    hasAppliedSeal: Boolean(appliedSeal),
  });

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
          customerId: order.customerId,
          status: order.status,
          lpns: routeLpns.filter((lpn) => lpn.orderId === order.orderId),
        };
      });

      setDriverStop(currentStop);
      setTripStops(tripDetail.stops);
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
    if (!stopId || !checkinProofAsset) {
      Alert.alert('Thiếu ảnh xác nhận', 'Vui lòng thêm ảnh xác nhận trước khi check-in.');
      return;
    }

    try {
      setIsProcessing(true);
      await deliveryApi.checkInStop(stopId, toDeliveryUploadFile(checkinProofAsset, 'checkin-proof.jpg'));
      const reloaded = await loadData(false);
      Alert.alert(
        'Đã xác nhận đến điểm giao',
        reloaded ? 'Stop đã được cập nhật.' : 'Yêu cầu đã được ghi nhận. Vui lòng tải lại để xem trạng thái mới.'
      );
    } catch (error) {
      Alert.alert('Không thể xác nhận đến điểm giao', formatActionError(error, 'CHECK_IN'));
      if (isAlreadyCheckedInError(error)) {
        await loadData(false);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const startHandover = (order: StopOrder) => {
    setSelectedOrderId(order.orderId);
    setSignatureAsset(null);
    setHandoverPhotoAsset(null);
    setEpod(null);
    setPaymentQr(null);
    setPaymentVerification(null);
    setStep('SIGNATURE');
  };

  const pickImage = async (
    onSelected: (asset: ImagePicker.ImagePickerAsset) => void,
    description: string
  ) => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        'Chưa có quyền ảnh',
        `Vui lòng cấp quyền thư viện ảnh để chọn ${description}.`
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.9,
    });
    if (!result.canceled && result.assets[0]) {
      onSelected(result.assets[0]);
    }
  };

  const handleHandoverConfirm = async () => {
    if (!stopId || !tripId || !selectedOrder || !signatureAsset) {
      Alert.alert('Thiếu chữ ký', 'Vui lòng chọn ảnh chữ ký thật của người nhận.');
      return;
    }
    if (!selectedOrder.customerId) {
      Alert.alert('Thiếu dữ liệu đơn hàng', 'Không xác định được khách hàng của đơn để xác nhận bàn giao. Vui lòng tải lại.');
      return;
    }

    try {
      setIsProcessing(true);
      const result = await deliveryApi.confirmHandover(stopId, {
        tripId,
        customerId: selectedOrder.customerId,
        signatureFile: toDeliveryUploadFile(signatureAsset, 'receiver-signature.jpg'),
        handoverPhotoFile: handoverPhotoAsset
          ? toDeliveryUploadFile(handoverPhotoAsset, 'handover-proof.jpg')
          : undefined,
      });
      setEpodId(result.epodId);
      setEpod({
        epodId: result.epodId,
        orderId: selectedOrder.orderId,
        status: 'HANDOVER_CONFIRMED',
        codAmount: result.codAmountDue,
        paymentStatus: result.codAmountDue > 0 ? 'AWAITING_PAYMENT' : null,
        handoverPdfUrl: result.handoverPdfUrl || null,
      });

      try {
        setEpod(await deliveryApi.getEpodByOrderId(selectedOrder.orderId));
      } catch {
        // Handover succeeded; keep its response visible and allow the driver to retry ePOD later.
      }

      const reloaded = await loadData(false);
      if (!reloaded) {
        Alert.alert(
          'Đã ghi nhận bàn giao',
          'Backend đã ghi nhận nhưng Mobile chưa tải lại được trạng thái Order. Vui lòng thử tải lại trước khi rời đi.'
        );
      }

      setStep('PAYMENT');
    } catch (error) {
      Alert.alert('Không thể bàn giao', formatActionError(error, 'HANDOVER'));
      await loadData(false);
    } finally {
      setIsProcessing(false);
    }
  };

  const resetOrderForm = () => {
    setSelectedOrderId(null);
    setSignatureAsset(null);
    setHandoverPhotoAsset(null);
    setPaymentQr(null);
    setPaymentVerification(null);
    setStep('ORDERS');
  };

  const handleGetPaymentQr = async () => {
    if (!epodId) {
      Alert.alert('Thiếu ePOD', 'Không tìm thấy ePOD để lấy thông tin thanh toán.');
      return;
    }

    try {
      setIsProcessing(true);
      setPaymentQr(await deliveryApi.getPaymentQr(epodId));
    } catch (error) {
      Alert.alert('Không thể lấy mã thanh toán', formatActionError(error, 'PAYMENT'));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleVerifyPayment = async () => {
    if (!epodId) {
      Alert.alert('Thiếu ePOD', 'Không tìm thấy ePOD để gửi bằng chứng thanh toán.');
      return;
    }
    if (!paymentProofAsset) {
      Alert.alert('Thiếu ảnh thanh toán', 'Vui lòng thêm ảnh biên lai trước khi gửi xác minh.');
      return;
    }

    try {
      setIsProcessing(true);
      setPaymentVerification(await deliveryApi.verifyQrPayment(
        epodId,
        toDeliveryUploadFile(paymentProofAsset, 'payment-proof.jpg')
      ));
      if (selectedOrder) {
        try {
          setEpod(await deliveryApi.getEpodByOrderId(selectedOrder.orderId));
        } catch {
          // The verification response is still enough to inform the driver of a pending review.
        }
      }
    } catch (error) {
      Alert.alert('Không thể gửi xác minh thanh toán', formatActionError(error, 'PAYMENT'));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCutSeal = async () => {
    if (!stopId || !tripId) return;
    try {
      setIsProcessing(true);
      setCutSeal(await deliveryApi.cutSeal(tripId, stopId));
    } catch (error) {
      Alert.alert('Không thể cắt seal', formatActionError(error, 'CUT_SEAL'));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleApplySeal = async () => {
    const sealCode = newSealCode.trim();
    if (!tripId || !sealCode) {
      Alert.alert('Thiếu mã seal', 'Vui lòng nhập mã seal mới trước khi xác nhận.');
      return;
    }
    try {
      setIsProcessing(true);
      setAppliedSeal(await deliveryApi.applySeal(tripId, sealCode));
      setNewSealCode('');
    } catch (error) {
      Alert.alert('Không thể kẹp seal mới', formatActionError(error, 'APPLY_SEAL'));
    } finally {
      setIsProcessing(false);
    }
  };

  const openExternalUrl = async (url?: string | null) => {
    if (!url) return;
    try {
      const supported = await Linking.canOpenURL(url);
      if (!supported) {
        Alert.alert('Không thể mở liên kết', 'Liên kết này không thể mở trên thiết bị hiện tại.');
        return;
      }
      await Linking.openURL(url);
    } catch {
      Alert.alert('Không thể mở liên kết', 'Vui lòng thử lại sau.');
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
              Thêm ảnh xác nhận. Vị trí check-in được Backend đối chiếu từ thiết bị IoT của xe.
            </Text>
            <ProofPicker
              asset={checkinProofAsset}
              emptyLabel="Chưa có ảnh xác nhận đến điểm giao"
              chooseLabel={checkinProofAsset ? 'Chọn lại ảnh xác nhận' : 'Thêm ảnh xác nhận'}
              disabled={isProcessing}
              onPick={() => void pickImage(setCheckinProofAsset, 'ảnh xác nhận đến điểm giao')}
            />
            <View className="w-full">
              <AppButton
                label="Xác nhận đã đến"
                onPress={() => void handleCheckIn()}
                loading={isProcessing}
                disabled={!checkinProofAsset}
              />
            </View>
          </View>
        ) : step === 'SIGNATURE' && selectedOrder ? (
          <View>
            <Text className="mb-1 text-lg font-bold text-amber-950">
              Chữ ký người nhận
            </Text>
            <Text className="mb-4 text-sm text-amber-700">
              Đơn {selectedOrder.trackingCode}
            </Text>
            <View className="rounded-2xl border border-amber-200 bg-white p-4">
              <ProofPicker
                asset={signatureAsset}
                emptyLabel="Chưa có ảnh chữ ký người nhận"
                chooseLabel={signatureAsset ? 'Chọn lại ảnh chữ ký' : 'Thêm ảnh chữ ký'}
                disabled={isProcessing}
                onPick={() => void pickImage(setSignatureAsset, 'ảnh chữ ký người nhận')}
              />
              <View className="mt-4">
                <ProofPicker
                  asset={handoverPhotoAsset}
                  emptyLabel="Ảnh bàn giao (không bắt buộc)"
                  chooseLabel={handoverPhotoAsset ? 'Chọn lại ảnh bàn giao' : 'Thêm ảnh bàn giao'}
                  disabled={isProcessing}
                  compact
                  onPick={() => void pickImage(setHandoverPhotoAsset, 'ảnh bàn giao')}
                />
              </View>
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
                onPress={resetOrderForm}
              />
            </View>
          </View>
        ) : step === 'PAYMENT' && selectedOrder && epod ? (
          <PaymentPanel
            order={selectedOrder}
            epod={epod}
            paymentQr={paymentQr}
            paymentVerification={paymentVerification}
            proofAsset={paymentProofAsset}
            processing={isProcessing}
            onGetQr={() => void handleGetPaymentQr()}
            onPickProof={() => void pickImage(setPaymentProofAsset, 'ảnh biên lai thanh toán')}
            onVerify={() => void handleVerifyPayment()}
            onOpenUrl={(url) => void openExternalUrl(url)}
            onDone={resetOrderForm}
          />
        ) : (
          <View>
            <DeliveryNotice
              icon="navigate-outline"
              title={deliveryActionState.title}
              detail={deliveryActionState.detail}
              tone="neutral"
            />
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

            {!cutSeal ? (
              <View className="mt-6 rounded-2xl border border-amber-200 bg-white p-4">
                <View className="flex-row items-center gap-3">
                  <Ionicons name="cut-outline" size={24} color="#92400E" />
                  <View className="flex-1">
                    <Text className="font-bold text-amber-950">Cắt seal để dỡ hàng</Text>
                    <Text className="mt-1 text-sm text-amber-700">
                      Chỉ thực hiện khi xe đã tới điểm giao và seal còn đang áp dụng.
                    </Text>
                  </View>
                </View>
                <View className="mt-4">
                  <AppButton
                    label="Cắt seal"
                    onPress={() => void handleCutSeal()}
                    loading={isProcessing}
                  />
                </View>
              </View>
            ) : (
              <DeliveryNotice
                icon="checkmark-circle"
                title="Seal đã được cắt"
                detail={cutSeal.aiAlertingMuted ? 'Theo dõi AI/IoT đã được tạm dừng theo phản hồi của hệ thống.' : 'Bạn có thể tiếp tục bàn giao các đơn tại điểm này.'}
                tone="success"
              />
            )}

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
                {allOrdersHandedOver
                  ? hasRemainingStops
                    ? 'Nếu còn điểm dừng tiếp theo, hãy kẹp seal mới trước khi tiếp tục.'
                    : 'Bàn giao đã hoàn tất. Chức năng xác nhận rời điểm dừng đang chờ Backend cung cấp endpoint.'
                  : 'Hoàn tất bàn giao tất cả đơn tại điểm dừng này trước khi thực hiện bước tiếp theo.'}
              </Text>
              {allOrdersHandedOver && hasRemainingStops && !appliedSeal ? (
                <View className="rounded-2xl border border-amber-200 bg-white p-4">
                  <AppInput
                    label="Mã seal mới"
                    value={newSealCode}
                    onChangeText={setNewSealCode}
                    placeholder="Nhập hoặc quét mã seal..."
                  />
                  <View className="mt-4">
                    <AppButton
                      label="Kẹp seal mới"
                      onPress={() => void handleApplySeal()}
                      loading={isProcessing}
                      disabled={!newSealCode.trim()}
                    />
                  </View>
                </View>
              ) : null}
              {appliedSeal ? (
                <DeliveryNotice
                  icon="shield-checkmark"
                  title="Đã kẹp seal mới"
                  detail={appliedSeal.aiAlertingRestored ? 'Theo dõi AI/IoT đã được khôi phục.' : 'Seal mới đã được hệ thống ghi nhận.'}
                  tone="success"
                />
              ) : null}
              {allOrdersHandedOver ? (
                <DeliveryNotice
                  icon="information-circle-outline"
                  title="Chưa thể xác nhận rời điểm dừng"
                  detail="BLOCKED_BY_BACKEND: Backend chưa có Controller endpoint cho thao tác Depart Stop."
                  tone="neutral"
                />
              ) : null}
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

function ProofPicker({
  asset,
  emptyLabel,
  chooseLabel,
  disabled,
  compact = false,
  onPick,
}: {
  asset: ImagePicker.ImagePickerAsset | null;
  emptyLabel: string;
  chooseLabel: string;
  disabled: boolean;
  compact?: boolean;
  onPick: () => void;
}) {
  return (
    <View>
      {asset ? (
        <Image
          source={{ uri: asset.uri }}
          className={`${compact ? 'h-32' : 'h-52'} mb-3 w-full rounded-xl bg-amber-50`}
          resizeMode="contain"
        />
      ) : (
        <View className={`${compact ? 'h-28' : 'h-52'} mb-3 items-center justify-center rounded-xl bg-amber-50 px-5`}>
          <Ionicons name="image-outline" size={compact ? 32 : 48} color="#92400E" />
          <Text className="mt-3 text-center text-sm text-amber-800">{emptyLabel}</Text>
        </View>
      )}
      <AppButton label={chooseLabel} variant="secondary" disabled={disabled} onPress={onPick} />
    </View>
  );
}

function PaymentPanel({
  order,
  epod,
  paymentQr,
  paymentVerification,
  proofAsset,
  processing,
  onGetQr,
  onPickProof,
  onVerify,
  onOpenUrl,
  onDone,
}: {
  order: StopOrder;
  epod: EpodResponse;
  paymentQr: PaymentQrResponse | null;
  paymentVerification: VerifyQrPaymentResponse | null;
  proofAsset: ImagePicker.ImagePickerAsset | null;
  processing: boolean;
  onGetQr: () => void;
  onPickProof: () => void;
  onVerify: () => void;
  onOpenUrl: (url?: string | null) => void;
  onDone: () => void;
}) {
  const amount = paymentQr?.codAmountDue ?? epod.codAmount ?? 0;
  const paymentStatus = paymentVerification?.currentPaymentStatus || paymentQr?.paymentStatus || epod.paymentStatus;
  const hasCod = amount > 0;

  return (
    <View>
      <Text className="mb-1 text-lg font-bold text-amber-950">ePOD đã tạo</Text>
      <Text className="mb-4 text-sm text-amber-700">Đơn {order.trackingCode} đã được Backend xác nhận bàn giao.</Text>
      <View className="rounded-2xl border border-green-200 bg-green-50 p-4">
        <Text className="font-bold text-green-900">{getEpodStatusLabel(epod.status)}</Text>
        <Text className="mt-2 text-sm text-green-800">{getPaymentStatusLabel(paymentStatus)}</Text>
        {epod.handoverPdfUrl ? (
          <Pressable className="mt-3" onPress={() => onOpenUrl(epod.handoverPdfUrl)}>
            <Text className="font-bold text-amber-800">Mở biên bản bàn giao</Text>
          </Pressable>
        ) : null}
      </View>

      {!hasCod ? (
        <View className="mt-5">
          <AppButton label="Hoàn tất" onPress={onDone} disabled={processing} />
        </View>
      ) : (
        <View className="mt-5 rounded-2xl border border-amber-200 bg-white p-4">
          <Text className="text-sm text-amber-700">Số tiền cần thanh toán</Text>
          <Text className="mt-1 text-2xl font-bold text-amber-950">{formatCurrency(amount)}</Text>
          {!paymentQr ? (
            <View className="mt-4">
              <AppButton label="Lấy mã thanh toán QR" onPress={onGetQr} loading={processing} />
            </View>
          ) : (
            <View className="mt-4">
              {paymentQr.qrCodeUrl ? (
                <Image source={{ uri: paymentQr.qrCodeUrl }} className="h-52 w-full rounded-xl bg-amber-50" resizeMode="contain" />
              ) : null}
              {paymentQr.checkoutUrl ? (
                <View className="mt-3">
                  <AppButton label="Mở trang thanh toán" variant="secondary" onPress={() => onOpenUrl(paymentQr.checkoutUrl)} disabled={processing} />
                </View>
              ) : null}
              <View className="mt-4">
                <ProofPicker
                  asset={proofAsset}
                  emptyLabel="Thêm ảnh biên lai sau khi khách thanh toán"
                  chooseLabel={proofAsset ? 'Chọn lại ảnh biên lai' : 'Thêm ảnh biên lai'}
                  disabled={processing}
                  compact
                  onPick={onPickProof}
                />
              </View>
              <View className="mt-4">
                <AppButton label="Gửi xác minh thanh toán" onPress={onVerify} loading={processing} disabled={!proofAsset} />
              </View>
            </View>
          )}
          {paymentVerification ? (
            <Text className="mt-4 text-sm text-amber-800">
              {paymentVerification.isConfirmedBySystem ? 'Thanh toán đã được hệ thống ghi nhận.' : 'Bằng chứng thanh toán đã được gửi và đang chờ xác minh.'}
            </Text>
          ) : null}
          <View className="mt-4">
            <AppButton label="Quay lại danh sách đơn" variant="secondary" onPress={onDone} disabled={processing} />
          </View>
        </View>
      )}
    </View>
  );
}

function DeliveryNotice({
  icon,
  title,
  detail,
  tone,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  detail: string;
  tone: 'success' | 'neutral';
}) {
  const color = tone === 'success' ? '#15803d' : '#92400E';
  return (
    <View className={`mt-5 rounded-2xl border p-4 ${tone === 'success' ? 'border-green-200 bg-green-50' : 'border-amber-200 bg-amber-50'}`}>
      <View className="flex-row gap-3">
        <Ionicons name={icon} size={24} color={color} />
        <View className="flex-1">
          <Text className={tone === 'success' ? 'font-bold text-green-900' : 'font-bold text-amber-950'}>{title}</Text>
          <Text className={`mt-1 text-sm ${tone === 'success' ? 'text-green-800' : 'text-amber-800'}`}>{detail}</Text>
        </View>
      </View>
    </View>
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
  action: 'LOAD' | 'CHECK_IN' | 'CUT_SEAL' | 'HANDOVER' | 'PAYMENT' | 'APPLY_SEAL'
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
    if (error.status === 404) return action === 'HANDOVER'
      ? 'Không tìm thấy dữ liệu bàn giao. Vui lòng tải lại điểm dừng.'
      : 'Không tìm thấy dữ liệu cần xử lý. Vui lòng tải lại.';

    const message = error.message.toLowerCase();
    if (action === 'CHECK_IN' && /proof|image|photo/.test(message)) {
      return 'Vui lòng thêm ảnh xác nhận trước khi check-in.';
    }
    if (action === 'CHECK_IN' && /distance|geofence|meter|metre|radius/.test(message)) {
      return 'Xe chưa ở trong phạm vi điểm giao hàng.';
    }
    if (action === 'CHECK_IN' && /iot|telemetry|gps|location/.test(message)) {
      return 'Chưa nhận được vị trí xe từ thiết bị IoT. Vui lòng thử lại.';
    }
    if (action === 'CHECK_IN' && /already|check.?in/.test(message)) {
      return 'Điểm giao này đã được xác nhận đến.';
    }
    if (action === 'CUT_SEAL' && /seal.*(cut|removed)|already.*seal/.test(message)) {
      return 'Seal đã được cắt trước đó hoặc không còn seal hợp lệ để cắt.';
    }
    if (action === 'HANDOVER' && /signature|proof|file/.test(message)) {
      return 'Vui lòng thêm ảnh chữ ký hợp lệ trước khi xác nhận bàn giao.';
    }
    if (action === 'HANDOVER' && /already|delivered|handover/.test(message)) {
      return 'Đơn hàng đã được bàn giao hoặc không còn đủ điều kiện bàn giao.';
    }
    if (action === 'PAYMENT' && /pending|verify|paid/.test(message)) {
      return 'Thanh toán đang chờ xác minh hoặc đã được ghi nhận.';
    }
    if (action === 'APPLY_SEAL' && /seal/.test(message)) {
      return 'Mã seal chưa hợp lệ hoặc seal đã được áp dụng.';
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
    case 'CUT_SEAL':
      return 'Không thể cắt seal. Vui lòng kiểm tra trạng thái seal rồi thử lại.';
    case 'PAYMENT':
      return 'Không thể xử lý thanh toán. Vui lòng thử lại.';
    case 'APPLY_SEAL':
      return 'Không thể kẹp seal mới. Vui lòng kiểm tra mã seal rồi thử lại.';
  }
}

function toDeliveryUploadFile(asset: ImagePicker.ImagePickerAsset, fallbackName: string): DeliveryUploadFile {
  return {
    uri: asset.uri,
    name: asset.fileName || fallbackName,
    type: asset.mimeType || 'image/jpeg',
  };
}

function formatCurrency(value: number) {
  return `${value.toLocaleString('vi-VN')} ₫`;
}

function getEpodStatusLabel(status?: string | null) {
  switch (status?.toUpperCase()) {
    case 'HANDOVER_CONFIRMED': return 'Bàn giao đã xác nhận';
    case 'COMPLETED': return 'ePOD đã hoàn tất';
    default: return 'ePOD đã được tạo';
  }
}

function getPaymentStatusLabel(status?: string | null) {
  switch (status?.toUpperCase()) {
    case 'PAID': return 'Thanh toán đã được ghi nhận';
    case 'PAID_PROOF':
    case 'PENDING_VERIFY': return 'Thanh toán đang chờ xác minh';
    case 'AWAITING_PAYMENT': return 'Chờ khách thanh toán';
    default: return 'Chưa có thông tin thanh toán';
  }
}

function getDriverDeliveryActionState({
  hasCheckedIn,
  allOrdersHandedOver,
  hasRemainingStops,
  hasAppliedSeal,
}: {
  hasCheckedIn: boolean;
  allOrdersHandedOver: boolean;
  hasRemainingStops: boolean;
  hasAppliedSeal: boolean;
}) {
  if (!hasCheckedIn) {
    return { title: 'Bước tiếp theo: xác nhận đến điểm giao', detail: 'Thêm ảnh xác nhận và gửi check-in.' };
  }
  if (!allOrdersHandedOver) {
    return { title: 'Bước tiếp theo: bàn giao đơn hàng', detail: 'Chọn từng đơn để thêm chữ ký người nhận.' };
  }
  if (hasRemainingStops && !hasAppliedSeal) {
    return { title: 'Bước tiếp theo: kẹp seal mới', detail: 'Nhập mã seal mới trước khi tiếp tục đến điểm dừng kế tiếp.' };
  }
  return {
    title: 'Đã hoàn tất các bước Mobile hỗ trợ',
    detail: 'Xác nhận rời điểm dừng đang chờ Backend cung cấp endpoint chính thức.',
  };
}
