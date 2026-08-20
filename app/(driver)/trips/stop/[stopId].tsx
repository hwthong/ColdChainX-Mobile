import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  ScrollView,
  Switch,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppPressable as Pressable } from '../../../../components/AppPressable';
import { colors } from '../../../../constants/colors';
import { AppButton } from '../../../../components/AppButton';
import { AppInput } from '../../../../components/AppInput';
import {
  PartialHandoverPanel,
  type PartialHandoverSubmission,
} from '../../../../components/driver/PartialHandoverPanel';
import { LocalQrCode } from '../../../../components/local-qr-code';
import { TemperatureChart } from '../../../../components/customer/TemperatureChart';
import { ApiClientError } from '../../../../services/apiClient';
import {
  ApplySealResponse,
  CutSealResponse,
  DeliveryUploadFile,
  EpodResponse,
  PaymentQrResponse,
  ProcessDynamicCodResponse,
  ReturnWarehouse,
  VerifyQrPaymentResponse,
  deliveryApi,
} from '../../../../services/deliveryApi';
import {
  driverApi,
  DriverTripStopDto,
} from '../../../../services/driverApi';
import {
  getStopTemperatureChart,
  StopTemperatureChart,
} from '../../../../services/monitoringApi';
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

type ScreenStep = 'ORDERS' | 'ORDER_ACTIONS' | 'SIGNATURE' | 'PAYMENT' | 'REJECT' | 'NO_SHOW' | 'PARTIAL_HANDOVER';

type StopOrder = {
  orderId: string;
  trackingCode: string;
  itemName: string;
  category?: string | null;
  customerId?: string | null;
  originalQuantity: number;
  status: string;
  lpns: TripRouteLpnDto[];
  epod: EpodResponse | null;
};

type ReturnCargoSummary = {
  lpnCode: string;
  quantity: number;
  reason: string;
};

const STOP_STATUS: Record<string, string> = {
  PLANNED: 'Chờ check-in',
  ARRIVED: 'Đã check-in',
  DEPARTED: 'Đã hoàn tất (dữ liệu cũ)',
  FAILED_DELIVERY: 'Giao hàng thất bại',
};

const HANDOVER_STATUSES = new Set([
  'DELIVERED',
  'RETURNED',
  'REJECTED',
  'PARTIALLY_DELIVERED',
  'OSD_REJECT_PENDING',
  'OSD_DOCK_PENDING',
  'PARTIAL_DELIVER_OSD',
  'DELIVERY_FAILED_NOSHOW',
]);

const RETURN_ORDER_STATUSES = new Set([
  'DELIVERY_FAILED_NOSHOW',
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
  const mutationLock = useRef(false);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [driverStop, setDriverStop] = useState<DriverTripStopDto | null>(null);
  const [tripStops, setTripStops] = useState<DriverTripStopDto[]>([]);
  const [tripStatus, setTripStatus] = useState('UNKNOWN');
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
  const [serverSealNumber, setServerSealNumber] = useState<string | null>(null);
  const [newSealCode, setNewSealCode] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [rejectEvidenceAsset, setRejectEvidenceAsset] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [noShowEvidenceAsset, setNoShowEvidenceAsset] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [isReturnToWarehouse, setIsReturnToWarehouse] = useState(true);
  const [returnFlowActive, setReturnFlowActive] = useState(false);
  const [returnCargoSummary, setReturnCargoSummary] = useState<ReturnCargoSummary | null>(null);
  const [partialResult, setPartialResult] = useState<ProcessDynamicCodResponse | null>(null);
  const [partialCodDue, setPartialCodDue] = useState(0);
  const [warehouses, setWarehouses] = useState<ReturnWarehouse[] | null>(null);
  const [warehouseError, setWarehouseError] = useState<string | null>(null);
  const [isLoadingWarehouses, setIsLoadingWarehouses] = useState(false);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string | null>(null);
  const [temperatureChart, setTemperatureChart] = useState<StopTemperatureChart | null>(null);
  const [temperatureError, setTemperatureError] = useState<string | null>(null);
  const [isLoadingTemperature, setIsLoadingTemperature] = useState(false);

  const selectedOrder = useMemo(
    () => orders.find((order) => order.orderId === selectedOrderId) ?? null,
    [orders, selectedOrderId]
  );
  const allOrdersHandedOver = orders.length > 0 && orders.every(isHandoverConfirmed);
  const hasUnresolvedEpod = orders.some((order) => isHandoverConfirmed(order) && !order.epod);
  const pendingPaymentOrder = orders.find((order) => isPaymentPending(order.epod)) ?? null;
  const allPaymentsReady = allOrdersHandedOver
    && !hasUnresolvedEpod
    && orders.every((order) => !isPaymentPending(order.epod));
  const stopStatus = driverStop?.status?.toUpperCase() || 'UNKNOWN';
  const hasCheckedIn = stopStatus === 'ARRIVED' || stopStatus === 'SKIPPED_NOSHOW';
  const isLegacyCompletedStop = stopStatus === 'DEPARTED';
  const serverSealIsCut = isCutSealNumber(serverSealNumber);
  const hasCutSeal = Boolean(cutSeal) || serverSealIsCut;
  const hasRemainingStops = tripStops.some(
    (stop) => stop.stopSequence > (driverStop?.stopSequence ?? Number.MAX_SAFE_INTEGER)
      && stop.status?.toUpperCase() !== 'DEPARTED'
  );
  const hasAppliedSeal = Boolean(appliedSeal)
    || (allOrdersHandedOver && hasRemainingStops && Boolean(serverSealNumber) && !serverSealIsCut);
  const deliveryActionState = getDriverDeliveryActionState({
    hasCheckedIn,
    hasCutSeal,
    allOrdersHandedOver,
    hasUnresolvedEpod,
    hasPendingPayment: Boolean(pendingPaymentOrder),
    hasRemainingStops,
    hasAppliedSeal,
    tripStatus,
  });
  const isReturnFlow = returnFlowActive
    || stopStatus === 'SKIPPED_NOSHOW'
    || orders.some((order) => RETURN_ORDER_STATUSES.has(order.status.toUpperCase()));
  const showCloseShiftPanel = (isReturnFlow || (allOrdersHandedOver && !hasRemainingStops))
    && tripStatus.toUpperCase() !== 'COMPLETED';
  const canCloseShift = allOrdersHandedOver
    && allPaymentsReady
    && !hasRemainingStops
    && tripStatus.toUpperCase() !== 'COMPLETED';

  const loadData = useCallback(async (showSpinner = true) => {
    if (!token || !tripId || !stopId) {
      setLoadError('Thiếu phiên đăng nhập, TripId hoặc StopId hợp lệ.');
      setLoading(false);
      return false;
    }

    if (showSpinner) setLoading(true);
    setLoadError(null);

    try {
      const [tripDetail, routeResponse, trackingResponse] = await Promise.all([
        driverApi.getMyTripDetail(tripId),
        getPlannedTripRoute(token, tripId),
        getTrackingByTripId(token, tripId),
      ]);
      if (!routeResponse.success || !routeResponse.data) {
        throw new Error('Không thể tải tuyến đường của chuyến.');
      }

      const route = routeResponse.data;
      setServerSealNumber(trackingResponse.data?.sealNumber ?? null);

      const routeStop = route.optimizedStops?.find((stop) => stop.stopId === stopId)
        || route.optimizedStops?.find((_, idx) => `route-stop-${idx}` === stopId)
        || (trackingResponse.data?.orders?.some((o) => o.orderId === stopId)
          ? {
              stopId,
              address: trackingResponse.data.orders.find((o) => o.orderId === stopId)?.itemName || 'Điểm giao hàng',
              orders: trackingResponse.data.orders.filter((o) => o.orderId === stopId).map((o) => ({
                orderId: o.orderId,
                trackingCode: o.trackingCode,
                itemName: o.itemName,
                tempCondition: o.tempCondition,
              })),
              lpns: [],
            }
          : undefined);

      const currentStop: DriverTripStopDto | null =
        tripDetail.stops?.find((stop) => stop.stopId === stopId) ??
        (routeStop
          ? ({
              stopId: routeStop.stopId || stopId,
              stopSequence: (routeStop as { optimizedSequence?: number; originalStopSequence?: number }).optimizedSequence ?? (routeStop as { originalStopSequence?: number }).originalStopSequence ?? 1,
              address: (routeStop as { address?: string }).address || 'Điểm giao hàng',
              status: (routeStop as { status?: string }).status || 'PLANNED',
              stopType: (routeStop as { stopType?: string }).stopType || 'DELIVERY',
            } as DriverTripStopDto)
          : null);

      if (!currentStop && !routeStop) {
        throw new ApiClientError('Stop không thuộc chuyến được giao.', 404);
      }

      let routeOrders: TripRouteOrderDto[];
      let stopLocationId: string | null | undefined;
      let routeLpns: TripRouteLpnDto[];

      if (routeStop) {
        routeOrders = routeStop.orders;
        stopLocationId = (routeStop as { locationId?: string }).locationId;
        routeLpns = routeStop.lpns;
      } else {
        const boundaryPoint = resolveBoundaryPoint(
          currentStop!,
          tripDetail.stops ?? [],
          route.origin,
          route.destination
        );
        if (!boundaryPoint?.locationId) {
          throw new Error('Không xác định được vị trí thật của điểm dừng từ dữ liệu tuyến.');
        }

        stopLocationId = boundaryPoint.locationId;
        routeLpns = [];

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
        const matchingLpns = routeLpns.filter((lpn) => lpn.orderId === order.orderId);
        const firstLpnQuantity = matchingLpns[0]?.quantity;
        return {
          orderId: order.orderId,
          trackingCode: order.trackingCode || routeOrder?.trackingCode || order.orderId.slice(0, 8),
          itemName: order.itemName || routeOrder?.itemName || 'Đơn hàng',
          category: order.category || routeOrder?.category,
          customerId: order.customerId,
          originalQuantity: firstLpnQuantity && firstLpnQuantity > 0
            ? firstLpnQuantity
            : order.quantity,
          status: order.status,
          lpns: matchingLpns,
          epod: null,
        };
      });

      const restoredOrders = await Promise.all(nextOrders.map(async (order) => {
        if (!isHandoverConfirmed(order)) return order;
        try {
          return { ...order, epod: await deliveryApi.getEpodByOrderId(order.orderId) };
        } catch {
          return order;
        }
      }));

      setDriverStop(currentStop);
      setTripStops(tripDetail.stops);
      setTripStatus(tripDetail.status || 'UNKNOWN');
      setOrders(restoredOrders);
      setSelectedOrderId((current) =>
        current && restoredOrders.some((order) => order.orderId === current) ? current : null
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

  const startOrderActions = (order: StopOrder) => {
    setSelectedOrderId(order.orderId);
    setStep('ORDER_ACTIONS');
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

  const startPartialHandover = (order: StopOrder) => {
    setSelectedOrderId(order.orderId);
    setEpodId('');
    setEpod(null);
    setPaymentQr(null);
    setPaymentVerification(null);
    setPaymentProofAsset(null);
    setPartialResult(null);
    setPartialCodDue(0);
    setStep('PARTIAL_HANDOVER');
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
        paymentAmountDue: result.paymentAmountDue,
        paymentStatus: result.paymentAmountDue > 0 ? 'AWAITING_PAYMENT' : null,
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
    setEpodId('');
    setEpod(null);
    setSignatureAsset(null);
    setHandoverPhotoAsset(null);
    setPaymentQr(null);
    setPaymentVerification(null);
    setRejectEvidenceAsset(null);
    setNoShowEvidenceAsset(null);
    setRejectionReason('');
    setPartialResult(null);
    setPartialCodDue(0);
    setStep('ORDERS');
  };

  const resumePayment = (order: StopOrder) => {
    if (!order.epod) return;
    setSelectedOrderId(order.orderId);
    setEpodId(order.epod.epodId);
    setEpod(order.epod);
    setPaymentQr(null);
    setPaymentVerification(null);
    setPaymentProofAsset(null);
    setStep('PAYMENT');
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

  const handleCheckPaymentStatus = async (silent = false) => {
    if (!epodId || !selectedOrder) return;
    try {
      if (!silent) setIsProcessing(true);
      const [verification, updatedEpod] = await Promise.all([
        deliveryApi.verifyQrPayment(epodId, null),
        deliveryApi.getEpodByOrderId(selectedOrder.orderId).catch(() => null),
      ]);
      setPaymentVerification(verification);
      if (updatedEpod) {
        setEpod(updatedEpod);
      }
      await loadData(false);
      if (!silent) {
        if (verification.isConfirmedBySystem || isPaymentSettledStatus(verification.currentPaymentStatus)) {
          Alert.alert('Thanh toán thành công', verification.statusSummary || 'Hệ thống đã xác nhận thanh toán.');
        } else {
          Alert.alert('Chưa nhận được thanh toán', verification.statusSummary || 'Vui lòng chờ khách chuyển khoản hoặc thử lại sau.');
        }
      }
    } catch (error) {
      if (!silent) {
        Alert.alert('Không thể kiểm tra thanh toán', formatActionError(error, 'PAYMENT'));
      }
    } finally {
      if (!silent) setIsProcessing(false);
    }
  };

  // Auto-poll payment status while PaymentPanel is open with an active QR code
  React.useEffect(() => {
    if (step !== 'PAYMENT' || !epodId || !selectedOrder) return;
    const currentStatus = epod?.paymentStatus;
    if (isPaymentSettledStatus(currentStatus)) return;
    if (!paymentQr) return;

    let isCancelled = false;
    const interval = setInterval(async () => {
      if (mutationLock.current || isProcessing) return;
      try {
        const updatedEpod = await deliveryApi.getEpodByOrderId(selectedOrder.orderId);
        if (!isCancelled && updatedEpod) {
          if (isPaymentSettledStatus(updatedEpod.paymentStatus)) {
            setEpod(updatedEpod);
            await loadData(false);
          }
        }
      } catch {
        // Silently ignore transient errors during background polling
      }
    }, 5000);

    return () => {
      isCancelled = true;
      clearInterval(interval);
    };
  }, [step, epodId, selectedOrder, epod?.paymentStatus, paymentQr, isProcessing, loadData]);

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
      await loadData(false);
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
      await loadData(false);
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
      await loadData(false);
    } catch (error) {
      Alert.alert('Không thể kẹp seal mới', formatActionError(error, 'APPLY_SEAL'));
    } finally {
      setIsProcessing(false);
    }
  };

  const startRejectEntireLpn = () => {
    setRejectionReason('');
    setRejectEvidenceAsset(null);
    setIsReturnToWarehouse(true);
    setStep('REJECT');
  };

  const continueWithFullReject = (
    submission: Omit<PartialHandoverSubmission, 'evidenceAsset'> & {
      evidenceAsset: ImagePicker.ImagePickerAsset | null;
    }
  ) => {
    setRejectionReason(submission.rejectionReason);
    setRejectEvidenceAsset(submission.evidenceAsset);
    setIsReturnToWarehouse(submission.isReturnToWarehouse);
    setStep('REJECT');
  };

  const submitPartialHandover = async (submission: PartialHandoverSubmission) => {
    if (mutationLock.current || isProcessing) return;
    if (!stopId) {
      Alert.alert('Thiếu StopId', 'Không xác định được điểm dừng. Vui lòng tải lại màn hình.');
      return;
    }
    if (!tripId) {
      Alert.alert('Thiếu TripId', 'Không xác định được chuyến đi. Vui lòng tải lại màn hình.');
      return;
    }
    if (!selectedOrder?.customerId) {
      Alert.alert('Thiếu CustomerId', 'Không xác định được khách hàng của đơn. Vui lòng tải lại điểm dừng.');
      return;
    }

    try {
      mutationLock.current = true;
      setIsProcessing(true);
      const result = await deliveryApi.processDynamicCod(stopId, {
        tripId,
        customerId: selectedOrder.customerId,
        rejectedQuantity: submission.rejectedQuantity,
        rejectionReason: submission.rejectionReason,
        isReturnToWarehouse: submission.isReturnToWarehouse,
        evidenceImageFile: toDeliveryUploadFile(submission.evidenceAsset, 'partial-handover-evidence.jpg'),
      });

      const responseCodDue = getDynamicCodDue(result);
      let resolvedEpod: EpodResponse = {
        epodId: result.epodId,
        orderId: selectedOrder.orderId,
        status: 'OSD_PARTIAL_DELIVER',
        paymentAmountDue: responseCodDue,
        paymentStatus: responseCodDue > 0 ? 'AWAITING_PAYMENT' : 'PAID',
        handoverConfirmedAt: result.handoverConfirmedAt ?? null,
      };
      try {
        resolvedEpod = await deliveryApi.getEpodByOrderId(selectedOrder.orderId);
      } catch {
        // Dynamic COD succeeded. Keep its typed response so the existing payment flow can retry.
      }

      setEpodId(result.epodId);
      setEpod(resolvedEpod);
      setPartialResult(result);
      setPartialCodDue(resolvedEpod.paymentAmountDue ?? responseCodDue);
      setReturnFlowActive(result.isReturnToWarehouse && result.rejectedQuantity > 0);
      setReturnCargoSummary(result.isReturnToWarehouse ? {
        lpnCode: result.lpnCode,
        quantity: result.rejectedQuantity,
        reason: result.rejectionReason,
      } : null);
      await loadData(false);
      setStep('PAYMENT');
    } catch (error) {
      Alert.alert('Không thể bàn giao một phần', formatActionError(error, 'PARTIAL_HANDOVER'));
      await loadData(false);
    } finally {
      mutationLock.current = false;
      setIsProcessing(false);
    }
  };

  const submitRejectEntireLpn = async () => {
    if (mutationLock.current || isProcessing || !stopId || !tripId || !selectedOrder) return;
    if (!selectedOrder.customerId) {
      Alert.alert('Thiếu dữ liệu đơn hàng', 'Không xác định được khách hàng của đơn. Vui lòng tải lại điểm dừng.');
      return;
    }
    if (!rejectionReason.trim()) {
      Alert.alert('Thiếu lý do', 'Vui lòng nhập lý do từ chối nhận kiện hàng.');
      return;
    }
    if (!rejectEvidenceAsset) {
      Alert.alert('Thiếu ảnh minh chứng', 'Vui lòng thêm ảnh minh chứng.');
      return;
    }

    try {
      mutationLock.current = true;
      setIsProcessing(true);
      const result = await deliveryApi.rejectEntireLpn(stopId, {
        tripId,
        customerId: selectedOrder.customerId,
        rejectionReason: rejectionReason.trim(),
        isReturnToWarehouse,
        evidenceImageFile: toDeliveryUploadFile(rejectEvidenceAsset, 'lpn-rejection-evidence.jpg'),
      });
      setReturnFlowActive(result.isReturnToWarehouse);
      setReturnCargoSummary(result.isReturnToWarehouse ? {
        lpnCode: result.lpnCode,
        quantity: result.rejectedQuantity,
        reason: result.rejectionReason,
      } : null);
      await loadData(false);
      resetOrderForm();
      Alert.alert('Đã ghi nhận từ chối kiện hàng', `Trạng thái đơn do hệ thống trả về: ${formatOrderStatus(result.orderStatus)}.`);
    } catch (error) {
      Alert.alert('Không thể ghi nhận từ chối', formatActionError(error, 'REJECT'));
      await loadData(false);
    } finally {
      mutationLock.current = false;
      setIsProcessing(false);
    }
  };

  const confirmRejectEntireLpn = () => {
    if (!selectedOrder || !rejectionReason.trim() || !rejectEvidenceAsset || isProcessing) {
      void submitRejectEntireLpn();
      return;
    }
    const lpnLabel = selectedOrder.lpns.map((lpn) => lpn.lpnCode).filter(Boolean).join(', ')
      || selectedOrder.trackingCode;
    Alert.alert(
      'Xác nhận từ chối toàn bộ',
      `Xác nhận khách từ chối toàn bộ kiện ${lpnLabel}?`,
      [
        { text: 'Hủy', style: 'cancel' },
        { text: 'Xác nhận', style: 'destructive', onPress: () => void submitRejectEntireLpn() },
      ]
    );
  };

  const startNoShow = () => {
    setSelectedOrderId(null);
    setNoShowEvidenceAsset(null);
    setStep('NO_SHOW');
  };

  const submitNoShow = async () => {
    if (mutationLock.current || isProcessing || !stopId) return;
    if (!noShowEvidenceAsset) {
      Alert.alert('Thiếu ảnh minh chứng', 'Vui lòng thêm ảnh minh chứng.');
      return;
    }

    try {
      const noShowLpns = orders.flatMap((order) => order.lpns);
      const noShowQuantity = noShowLpns.reduce((total, lpn) => total + (lpn.quantity ?? 0), 0)
        || orders.reduce((total, order) => total + order.originalQuantity, 0);
      mutationLock.current = true;
      setIsProcessing(true);
      await deliveryApi.reportNoShow(
        stopId,
        toDeliveryUploadFile(noShowEvidenceAsset, 'customer-no-show-evidence.jpg')
      );
      setReturnFlowActive(true);
      setReturnCargoSummary({
        lpnCode: noShowLpns.map((lpn) => lpn.lpnCode).filter(Boolean).join(', ') || 'Đang cập nhật từ Backend',
        quantity: noShowQuantity,
        reason: 'Khách không có mặt',
      });
      await loadData(false);
      resetOrderForm();
      Alert.alert('Đã báo khách không có mặt', 'Trạng thái điểm dừng và kiện hàng đã được tải lại từ hệ thống.');
    } catch (error) {
      Alert.alert('Không thể báo khách không có mặt', formatActionError(error, 'NO_SHOW'));
      await loadData(false);
    } finally {
      mutationLock.current = false;
      setIsProcessing(false);
    }
  };

  const confirmNoShow = () => {
    if (!noShowEvidenceAsset || isProcessing) {
      void submitNoShow();
      return;
    }
    Alert.alert(
      'Xác nhận khách không có mặt',
      'Bạn xác nhận khách hàng không xuất hiện hoặc từ chối nhận hàng tại điểm giao này?',
      [
        { text: 'Hủy', style: 'cancel' },
        { text: 'Xác nhận', style: 'destructive', onPress: () => void submitNoShow() },
      ]
    );
  };

  const loadReturnWarehouses = async () => {
    if (!tripId || !showCloseShiftPanel || isLoadingWarehouses) return;
    try {
      setIsLoadingWarehouses(true);
      setWarehouseError(null);
      const result = await deliveryApi.getNearestReturnWarehouses(tripId);
      setWarehouses(result.warehouses ?? []);
    } catch (error) {
      setWarehouseError(formatActionError(error, 'WAREHOUSE'));
    } finally {
      setIsLoadingWarehouses(false);
    }
  };

  const loadTemperatureChart = async () => {
    if (!token || !stopId || isLoadingTemperature) return;
    try {
      setIsLoadingTemperature(true);
      setTemperatureError(null);
      const response = await getStopTemperatureChart(token, stopId);
      if (!response.success || !response.data) {
        throw new Error(response.message || 'Không thể tải dữ liệu nhiệt độ.');
      }
      setTemperatureChart(response.data);
    } catch (error) {
      setTemperatureError(formatActionError(error, 'TEMPERATURE'));
    } finally {
      setIsLoadingTemperature(false);
    }
  };

  const submitCloseShift = async () => {
    if (mutationLock.current || isProcessing || !tripId || !selectedWarehouseId || !canCloseShift) return;
    try {
      mutationLock.current = true;
      setIsProcessing(true);
      const result = await deliveryApi.closeShift(tripId, selectedWarehouseId);
      await loadData(false);
      Alert.alert('Đóng ca thành công', result.message || 'Tài xế và xe đã sẵn sàng cho chuyến mới.', [
        { text: 'Về danh sách chuyến', onPress: () => router.replace('/(driver)/trips' as never) },
      ]);
    } catch (error) {
      Alert.alert('Không thể đóng ca', formatActionError(error, 'CLOSE_SHIFT'));
      await loadData(false);
    } finally {
      mutationLock.current = false;
      setIsProcessing(false);
    }
  };

  const confirmCloseShift = () => {
    if (!selectedWarehouseId || !canCloseShift || isProcessing) return;
    const warehouse = warehouses?.find((item) => item.warehouseId === selectedWarehouseId);
    Alert.alert(
      'Xác nhận đóng ca',
      `Đóng ca và cập nhật vị trí xe về ${warehouse?.warehouseName || 'kho đã chọn'}?`,
      [
        { text: 'Hủy', style: 'cancel' },
        { text: 'Đóng ca', onPress: () => void submitCloseShift() },
      ]
    );
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
      <View style={{ backgroundColor: colors.surface.page }} className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" color={colors.brand.primary} />
        <Text style={{ color: colors.brand.primary }} className="mt-3 font-medium">Đang tải điểm dừng...</Text>
      </View>
    );
  }

  if (loadError || !driverStop) {
    return (
      <View style={{ backgroundColor: colors.surface.page }} className="flex-1 items-center justify-center px-6">
        <Ionicons name="alert-circle-outline" size={48} color={colors.status.danger.main} />
        <Text style={{ color: colors.status.danger.main }} className="mt-4 text-center font-semibold">
          {loadError || 'Không tìm thấy dữ liệu điểm dừng.'}
        </Text>
        <View className="mt-5 w-full">
          <AppButton label="Thử tải lại" onPress={() => void loadData()} />
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView style={{ backgroundColor: colors.surface.page }} className="flex-1" edges={['bottom']}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 100 }}>
        <StopHeader stop={driverStop} orderCount={orders.length} />

        <View style={{ backgroundColor: colors.surface.card, borderColor: colors.border.default }} className="mb-6 rounded-2xl border p-4 shadow-sm">
          <View className="flex-row items-center gap-3">
            <Ionicons name="thermometer-outline" size={24} color={colors.brand.primary} />
            <View className="flex-1">
              <Text style={{ color: colors.text.primary }} className="font-bold">Nhiệt độ hành trình đến điểm giao</Text>
              <Text style={{ color: colors.text.secondary }} className="mt-1 text-sm">Dữ liệu được giới hạn đến thời điểm xe đến điểm dừng.</Text>
            </View>
          </View>
          {!temperatureChart && !temperatureError ? (
            <View className="mt-4">
              <AppButton
                label="Xem dữ liệu nhiệt độ"
                variant="secondary"
                loading={isLoadingTemperature}
                onPress={() => void loadTemperatureChart()}
              />
            </View>
          ) : null}
          {temperatureError ? (
            <View className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3">
              <Text className="text-sm text-red-800">{temperatureError}</Text>
              <View className="mt-3">
                <AppButton label="Thử lại" variant="secondary" loading={isLoadingTemperature} onPress={() => void loadTemperatureChart()} />
              </View>
            </View>
          ) : null}
          {temperatureChart ? (
            <View className="mt-4 gap-3">
              <Text style={{ color: colors.text.secondary }} className="text-sm">
                Đến {formatDateTime(temperatureChart.endTime)} · {temperatureChart.sampledPointCount}/{temperatureChart.rawPointCount} điểm
              </Text>
              <TemperatureChart points={temperatureChart.points} />
            </View>
          ) : null}
        </View>

        {isLegacyCompletedStop ? (
          <View className="mt-10 items-center rounded-2xl border border-green-200 bg-green-50 p-6">
            <Ionicons name="checkmark-circle" size={64} color="#15803d" />
            <Text className="mt-3 text-lg font-bold text-green-900">
              Stop đã hoàn tất
            </Text>
            <Text className="mt-2 text-center text-green-800">
              Đây là trạng thái hoàn tất từ dữ liệu cũ. Ứng dụng chỉ hiển thị và không tạo thêm thao tác.
            </Text>
          </View>
        ) : !hasCheckedIn ? (
          <View className="mt-10 items-center">
            <Ionicons name="location" size={64} color={colors.brand.primary} />
            <Text style={{ color: colors.text.primary }} className="mb-6 mt-4 text-center text-base font-medium">
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
        ) : step === 'ORDER_ACTIONS' && selectedOrder ? (
          <View>
            <Text className="text-lg font-bold text-amber-950">Chọn cách xử lý đơn hàng</Text>
            <Text className="mb-4 mt-1 text-sm text-amber-700">Đơn {selectedOrder.trackingCode}</Text>
            <View className="rounded-2xl border border-amber-200 bg-white p-4">
              <Text className="text-sm text-amber-700">Kiện hàng</Text>
              <Text className="mt-1 font-bold text-amber-950">
                {selectedOrder.lpns.map((lpn) => lpn.lpnCode).filter(Boolean).join(', ') || 'Chưa có mã LPN'}
              </Text>
              <View className="mt-5 gap-3">
                <AppButton label="Bàn giao toàn bộ" onPress={() => startHandover(selectedOrder)} disabled={isProcessing} />
                <AppButton label="Bàn giao một phần" variant="secondary" onPress={() => startPartialHandover(selectedOrder)} disabled={isProcessing} />
                <AppButton label="Khách từ chối toàn bộ kiện hàng" variant="secondary" onPress={startRejectEntireLpn} disabled={isProcessing} />
              </View>
            </View>
            <View className="mt-4">
              <AppButton label="Quay lại" variant="secondary" onPress={resetOrderForm} disabled={isProcessing} />
            </View>
          </View>
        ) : step === 'PARTIAL_HANDOVER' && selectedOrder ? (
          <PartialHandoverPanel
            trackingCode={selectedOrder.trackingCode}
            lpnCodes={selectedOrder.lpns.map((lpn) => lpn.lpnCode).filter(Boolean).join(', ')}
            originalQuantity={selectedOrder.originalQuantity}
            processing={isProcessing}
            onSubmit={(submission) => void submitPartialHandover(submission)}
            onUseFullReject={continueWithFullReject}
            onBack={() => setStep('ORDER_ACTIONS')}
          />
        ) : step === 'REJECT' && selectedOrder ? (
          <View>
            <Text className="text-lg font-bold text-amber-950">Từ chối toàn bộ kiện hàng</Text>
            <Text className="mb-4 mt-1 text-sm text-amber-700">
              Đơn {selectedOrder.trackingCode} · {selectedOrder.lpns.map((lpn) => lpn.lpnCode).filter(Boolean).join(', ') || 'LPN của đơn'}
            </Text>
            <View className="rounded-2xl border border-red-200 bg-white p-4">
              <AppInput
                label="Lý do từ chối"
                value={rejectionReason}
                onChangeText={setRejectionReason}
                placeholder="Nhập lý do khách từ chối nhận hàng"
              />
              <View className="mt-4">
                <ProofPicker
                  asset={rejectEvidenceAsset}
                  emptyLabel="Chưa có ảnh minh chứng"
                  chooseLabel={rejectEvidenceAsset ? 'Đổi ảnh minh chứng' : 'Thêm ảnh minh chứng'}
                  disabled={isProcessing}
                  onPick={() => void pickImage(setRejectEvidenceAsset, 'ảnh minh chứng từ chối kiện hàng')}
                  onRemove={() => setRejectEvidenceAsset(null)}
                />
              </View>
              <View className="mt-4 flex-row items-center justify-between rounded-xl bg-amber-50 p-3">
                <View className="mr-4 flex-1">
                  <Text className="font-bold text-amber-950">Đưa hàng về kho</Text>
                  <Text className="mt-1 text-xs text-amber-700">Hệ thống sẽ lập phiếu hàng hoàn khi bật tùy chọn này.</Text>
                </View>
                <Switch value={isReturnToWarehouse} onValueChange={setIsReturnToWarehouse} disabled={isProcessing} />
              </View>
              <View className="mt-5">
                <AppButton
                  label="Xác nhận từ chối"
                  loading={isProcessing}
                  disabled={!rejectionReason.trim() || !rejectEvidenceAsset}
                  onPress={confirmRejectEntireLpn}
                />
              </View>
            </View>
            <View className="mt-4">
              <AppButton label="Quay lại" variant="secondary" onPress={() => setStep('ORDER_ACTIONS')} disabled={isProcessing} />
            </View>
          </View>
        ) : step === 'NO_SHOW' ? (
          <View>
            <Text className="text-lg font-bold text-amber-950">Khách hàng không có mặt</Text>
            <Text className="mb-4 mt-1 text-sm text-amber-700">Ảnh minh chứng là bắt buộc theo Backend.</Text>
            <View className="rounded-2xl border border-red-200 bg-white p-4">
              <ProofPicker
                asset={noShowEvidenceAsset}
                emptyLabel="Chưa có ảnh xác nhận khách không có mặt"
                chooseLabel={noShowEvidenceAsset ? 'Đổi ảnh minh chứng' : 'Thêm ảnh minh chứng'}
                disabled={isProcessing}
                onPick={() => void pickImage(setNoShowEvidenceAsset, 'ảnh minh chứng khách không có mặt')}
                onRemove={() => setNoShowEvidenceAsset(null)}
              />
              <View className="mt-4">
                <AppButton label="Xác nhận khách không có mặt" loading={isProcessing} disabled={!noShowEvidenceAsset} onPress={confirmNoShow} />
              </View>
            </View>
            <View className="mt-4">
              <AppButton label="Quay lại" variant="secondary" onPress={resetOrderForm} disabled={isProcessing} />
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
          <View>
            {partialResult ? (
              <PartialSuccessSummary result={partialResult} actualCodDue={partialCodDue} />
            ) : null}
            <PaymentPanel
              order={selectedOrder}
              epod={epod}
              paymentQr={paymentQr}
              paymentVerification={paymentVerification}
              proofAsset={paymentProofAsset}
              processing={isProcessing}
              onGetQr={() => void handleGetPaymentQr()}
              onCheckStatus={() => void handleCheckPaymentStatus(false)}
              onPickProof={() => void pickImage(setPaymentProofAsset, 'ảnh biên lai thanh toán')}
              onVerify={() => void handleVerifyPayment()}
              onOpenUrl={(url) => void openExternalUrl(url)}
              onDone={resetOrderForm}
            />
          </View>
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
                onSelect={() => startOrderActions(order)}
              />
            ))}

            {pendingPaymentOrder?.epod ? (
              <View className="mt-4 rounded-2xl border border-amber-300 bg-amber-50 p-4">
                <Text className="font-bold text-amber-950">Thanh toán COD đang chờ xử lý</Text>
                <Text className="mt-1 text-sm text-amber-800">
                  Đơn {pendingPaymentOrder.trackingCode} đã có ePOD. Tiếp tục bước thanh toán từ trạng thái Backend.
                </Text>
                <View className="mt-4">
                  <AppButton
                    label={`Tiếp tục thanh toán ${pendingPaymentOrder.trackingCode}`}
                    disabled={isProcessing}
                    onPress={() => resumePayment(pendingPaymentOrder)}
                  />
                </View>
              </View>
            ) : null}

            {!allOrdersHandedOver && stopStatus !== 'SKIPPED_NOSHOW' ? (
              <View className="mt-4">
                <AppButton
                  label="Báo khách hàng không có mặt (No-Show)"
                  variant="secondary"
                  disabled={isProcessing}
                  onPress={startNoShow}
                />
              </View>
            ) : null}

            {hasUnresolvedEpod ? (
              <View className="mt-4">
                <AppButton
                  label="Tải lại trạng thái ePOD"
                  variant="secondary"
                  disabled={isProcessing}
                  onPress={() => void loadData(false)}
                />
              </View>
            ) : null}

            {isReturnFlow && returnCargoSummary ? (
              <View className="mt-4 rounded-2xl border border-orange-200 bg-orange-50 p-4">
                <View className="flex-row items-center gap-2">
                  <Ionicons name="return-down-back-outline" size={22} color="#9A3412" />
                  <Text className="font-bold text-orange-950">Hàng cần mang về kho</Text>
                </View>
                <Text className="mt-3 text-sm text-orange-800">LPN</Text>
                <Text className="mt-1 font-bold text-orange-950">{returnCargoSummary.lpnCode}</Text>
                <Text className="mt-3 text-sm text-orange-800">Số lượng</Text>
                <Text className="mt-1 font-bold text-orange-950">{returnCargoSummary.quantity} kiện</Text>
                <Text className="mt-3 text-sm text-orange-800">Lý do</Text>
                <Text className="mt-1 text-orange-950">{returnCargoSummary.reason}</Text>
              </View>
            ) : null}

            {hasCutSeal && !allOrdersHandedOver && stopStatus !== 'SKIPPED_NOSHOW' ? (
              <View className="mt-4">
                <AppButton
                  label="Báo khách hàng không có mặt"
                  variant="secondary"
                  disabled={isProcessing}
                  onPress={startNoShow}
                />
              </View>
            ) : null}

            {!hasCutSeal ? (
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
                detail={cutSeal?.aiAlertingMuted ? 'Theo dõi AI/IoT đã được tạm dừng theo phản hồi của hệ thống.' : 'Trạng thái seal đã được khôi phục từ Backend. Bạn có thể tiếp tục bàn giao.'}
                tone="success"
              />
            )}

            {showCloseShiftPanel ? (
              <View className="mt-6 rounded-2xl border border-orange-200 bg-orange-50 p-4">
                <View className="flex-row items-start gap-3">
                  <Ionicons name="business-outline" size={24} color="#9A3412" />
                  <View className="flex-1">
                    <Text className="font-bold text-orange-950">
                      {isReturnFlow ? 'Kho quy đầu gần vị trí xe' : 'Kho kết ca gần vị trí xe'}
                    </Text>
                    <Text className="mt-1 text-sm text-orange-800">
                      {isReturnFlow
                        ? 'Khoảng cách do Backend tính từ dữ liệu vị trí xe.'
                        : 'Sau khi hoàn tất điểm cuối và thanh toán COD, chọn kho để đóng ca.'}
                    </Text>
                  </View>
                </View>

                {warehouses === null && !warehouseError ? (
                  <View className="mt-4">
                    <AppButton label="Tìm kho phù hợp" variant="secondary" loading={isLoadingWarehouses} onPress={() => void loadReturnWarehouses()} />
                  </View>
                ) : null}

                {warehouseError ? (
                  <View className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3">
                    <Text className="text-sm text-red-800">{warehouseError}</Text>
                    <View className="mt-3">
                      <AppButton label="Thử lại" variant="secondary" loading={isLoadingWarehouses} onPress={() => void loadReturnWarehouses()} />
                    </View>
                  </View>
                ) : null}

                {warehouses?.length === 0 ? (
                  <Text className="mt-4 text-sm text-orange-800">Chưa tìm thấy kho phù hợp gần vị trí hiện tại.</Text>
                ) : null}

                {warehouses?.map((warehouse) => {
                  const selected = selectedWarehouseId === warehouse.warehouseId;
                  return (
                    <Pressable
                      key={warehouse.warehouseId}
                      disabled={!canCloseShift || isProcessing}
                      onPress={() => setSelectedWarehouseId(warehouse.warehouseId)}
                      className={`mt-3 rounded-xl border p-3 ${selected ? 'border-orange-700 bg-white' : 'border-orange-200 bg-white/80'}`}
                      style={({ pressed }) => ({ opacity: !canCloseShift ? 0.8 : pressed ? 0.7 : 1 })}
                    >
                      <View className="flex-row items-start justify-between gap-3">
                        <View className="flex-1">
                          <Text className="font-bold text-orange-950">{warehouse.warehouseName}</Text>
                          <Text className="mt-1 text-sm text-orange-800">{warehouse.address}</Text>
                        </View>
                        {selected ? <Ionicons name="checkmark-circle" size={22} color="#9A3412" /> : null}
                      </View>
                      <Text className="mt-2 text-xs text-orange-700">
                        {warehouse.distanceKm} · khoảng {warehouse.estimatedTravelTimeMinutes} phút · {formatWarehouseStatus(warehouse.status)}
                      </Text>
                    </Pressable>
                  );
                })}

                {hasRemainingStops ? (
                  <Text className="mt-4 text-sm text-orange-800">Tiếp tục xử lý các điểm dừng còn lại theo trạng thái hệ thống.</Text>
                ) : null}
                {!allPaymentsReady ? (
                  <Text className="mt-4 text-sm text-orange-800">Hoàn tất thanh toán COD của mọi ePOD trước khi đóng ca.</Text>
                ) : null}
                {canCloseShift && warehouses && warehouses.length > 0 ? (
                  <View className="mt-4">
                    <AppButton
                      label="Đóng ca tại kho đã chọn"
                      loading={isProcessing}
                      disabled={!selectedWarehouseId}
                      onPress={confirmCloseShift}
                    />
                  </View>
                ) : null}
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
                {allOrdersHandedOver
                  ? hasRemainingStops
                    ? 'Nếu còn điểm dừng tiếp theo, hãy kẹp seal mới trước khi tiếp tục.'
                    : `Bàn giao tại điểm cuối đã hoàn tất. Trạng thái chuyến hiện tại: ${formatTripStatus(tripStatus)}.`
                  : 'Hoàn tất bàn giao tất cả đơn tại điểm dừng này trước khi thực hiện bước tiếp theo.'}
              </Text>
              {allOrdersHandedOver && allPaymentsReady && hasRemainingStops && !hasAppliedSeal ? (
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
              {hasRemainingStops && hasAppliedSeal ? (
                <DeliveryNotice
                  icon="shield-checkmark"
                  title="Đã kẹp seal mới"
                  detail={appliedSeal?.aiAlertingRestored ? 'Theo dõi AI/IoT đã được khôi phục.' : 'Trạng thái seal mới đã được khôi phục từ Backend.'}
                  tone="success"
                />
              ) : null}
              {allOrdersHandedOver && !hasRemainingStops ? (
                <DeliveryNotice
                  icon={tripStatus.toUpperCase() === 'COMPLETED' ? 'checkmark-circle' : 'information-circle-outline'}
                  title={tripStatus.toUpperCase() === 'COMPLETED' ? 'Chuyến đã hoàn tất' : 'Đã hoàn tất bàn giao tại điểm cuối'}
                  detail={`Trạng thái chuyến do hệ thống trả về: ${formatTripStatus(tripStatus)}.`}
                  tone={tripStatus.toUpperCase() === 'COMPLETED' ? 'success' : 'neutral'}
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
            {getStopStatusLabel(status)}
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
      className={`mb-3 rounded-2xl border bg-white p-4 ${selected ? 'border-amber-700' : 'border-amber-200'
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
  onRemove,
}: {
  asset: ImagePicker.ImagePickerAsset | null;
  emptyLabel: string;
  chooseLabel: string;
  disabled: boolean;
  compact?: boolean;
  onPick: () => void;
  onRemove?: () => void;
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
      {asset && onRemove ? (
        <Pressable disabled={disabled} onPress={onRemove} className="mt-3 items-center py-2">
          <Text className="font-bold text-red-700">Xóa ảnh đã chọn</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function PartialSuccessSummary({
  result,
  actualCodDue,
}: {
  result: ProcessDynamicCodResponse;
  actualCodDue: number;
}) {
  return (
    <View className="mb-5 rounded-2xl border border-green-200 bg-green-50 p-4">
      <View className="flex-row items-center gap-2">
        <Ionicons name="checkmark-circle" size={24} color="#15803d" />
        <Text className="text-lg font-bold text-green-950">Bàn giao một phần thành công</Text>
      </View>
      <View className="mt-4 gap-3">
        <View className="flex-row justify-between gap-4">
          <Text className="text-green-800">Khách nhận</Text>
          <Text className="font-bold text-green-950">{result.acceptedQuantity}/{result.originalQuantity} kiện</Text>
        </View>
        <View className="flex-row justify-between gap-4">
          <Text className="text-green-800">Từ chối</Text>
          <Text className="font-bold text-green-950">{result.rejectedQuantity} kiện</Text>
        </View>
        <View className="flex-row justify-between gap-4">
          <Text className="text-green-800">COD sau điều chỉnh</Text>
          <Text className="font-bold text-green-950">{formatCurrency(actualCodDue)}</Text>
        </View>
        {result.isReturnToWarehouse ? (
          <View className="flex-row justify-between gap-4">
            <Text className="text-green-800">Mang về kho</Text>
            <Text className="font-bold text-green-950">{result.rejectedQuantity} kiện</Text>
          </View>
        ) : null}
        <View className="flex-row justify-between gap-4">
          <Text className="text-green-800">LPN</Text>
          <Text className="flex-1 text-right font-bold text-green-950">{result.lpnCode}</Text>
        </View>
      </View>
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
  onCheckStatus,
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
  onCheckStatus: () => void;
  onPickProof: () => void;
  onVerify: () => void;
  onOpenUrl: (url?: string | null) => void;
  onDone: () => void;
}) {
  const codAmount = epod.paymentAmountDue ?? 0;
  const amount = paymentQr?.paymentAmountDue ?? codAmount;
  const paymentStatus = paymentVerification?.currentPaymentStatus || paymentQr?.paymentStatus || epod.paymentStatus;
  const isSettled = isPaymentSettledStatus(paymentStatus);
  const requiresPayment = (codAmount > 0 || amount > 0) && !isSettled;

  return (
    <View>
      <Text className="mb-1 text-lg font-bold text-amber-950">ePOD đã tạo</Text>
      <Text className="mb-4 text-sm text-amber-700">Đơn {order.trackingCode} đã được Backend xác nhận bàn giao.</Text>
      <View className="rounded-2xl border border-green-200 bg-green-50 p-4">
        <Text className="font-bold text-green-900">{getEpodStatusLabel(epod.status)}</Text>
        <Text className="mt-2 text-sm text-green-800">{getPaymentStatusLabel(paymentStatus)}</Text>
        {epod.handoverPdfUrl ? (
          <Pressable className="mt-3" onPress={() => onOpenUrl(epod.handoverPdfUrl)}>
            <Text className="font-bold text-amber-800">Mở biên bản bàn giao (PDF)</Text>
          </Pressable>
        ) : null}
      </View>

      {!requiresPayment ? (
        <View className="mt-5">
          <View className="mb-4 rounded-2xl border border-green-200 bg-green-50 p-4">
            <View className="flex-row items-center gap-2">
              <Ionicons name="checkmark-circle" size={22} color="#15803d" />
              <Text className="font-bold text-green-900">Thanh toán hoàn tất</Text>
            </View>
            <Text className="mt-2 text-sm text-green-800">
              {paymentStatus === 'PAID_PROOF' || paymentStatus === 'PENDING_VERIFY'
                ? 'Hệ thống đã lưu ảnh biên lai thanh toán. Bạn có thể tiếp tục chuyến, kế toán sẽ đối soát sau.'
                : 'Thanh toán COD đã được ghi nhận thành công trên hệ thống.'}
            </Text>
          </View>
          <AppButton label="Hoàn tất và tiếp tục" onPress={onDone} disabled={processing} />
        </View>
      ) : (
        <View className="mt-5 rounded-2xl border border-amber-200 bg-white p-4">
          <Text className="text-sm text-amber-700">Số tiền COD của đơn</Text>
          <Text className="mt-1 text-2xl font-bold text-amber-950">{formatCurrency(codAmount)}</Text>

          {paymentQr?.paymentAmountDue && paymentQr.paymentAmountDue !== codAmount && paymentQr.paymentAmountDue > 0 ? (
            <View className="mt-2 rounded-lg bg-amber-100/80 px-3 py-2">
              <Text className="text-xs font-semibold text-amber-900">
                Thanh toán thử nghiệm PayOS: {formatCurrency(paymentQr.paymentAmountDue)}
              </Text>
            </View>
          ) : null}

          <Text className="mt-4 font-bold text-amber-950">Chọn phương thức thanh toán</Text>

          <View className="mt-3">
            <AppButton
              label={paymentQr ? "Lấy lại mã QR PayOS" : "Tạo mã QR PayOS"}
              onPress={onGetQr}
              loading={processing}
            />
          </View>

          {processing && !paymentQr ? (
            <View className="mt-3 flex-row items-center justify-center gap-2">
              <ActivityIndicator size="small" color="#d97706" />
              <Text className="text-xs font-medium text-amber-800">Đang tải mã QR...</Text>
            </View>
          ) : null}

          {paymentQr ? (
            <View className="mt-4 rounded-xl border border-amber-100 bg-amber-50 p-4 items-center">
              {paymentQr.qrCodeUrl ? (
                paymentQr.qrCodeUrl.startsWith('http://') ||
                paymentQr.qrCodeUrl.startsWith('https://') ||
                paymentQr.qrCodeUrl.startsWith('data:image/') ? (
                  <Image
                    source={{ uri: paymentQr.qrCodeUrl }}
                    style={{ width: 220, height: 220 }}
                    className="rounded-xl bg-white"
                    resizeMode="contain"
                  />
                ) : (
                  <LocalQrCode value={paymentQr.qrCodeUrl} size={220} />
                )
              ) : (
                <View className="w-full py-4 items-center justify-center rounded-xl bg-amber-100/60">
                  <Text className="text-xs font-semibold text-amber-800">
                    Không thể hiển thị mã QR trực tiếp.
                  </Text>
                </View>
              )}

              {paymentQr.payosOrderCode ? (
                <Text className="mt-2 text-xs text-amber-800 font-mono">
                  Mã đơn PayOS: #{paymentQr.payosOrderCode}
                </Text>
              ) : null}

              <View className="mt-3 w-full gap-2">
                {paymentQr.checkoutUrl ? (
                  <AppButton
                    label="Mở cổng thanh toán PayOS"
                    variant="secondary"
                    onPress={() => onOpenUrl(paymentQr.checkoutUrl)}
                    disabled={processing}
                  />
                ) : null}
                <AppButton
                  label="Kiểm tra trạng thái thanh toán"
                  variant="secondary"
                  onPress={onCheckStatus}
                  loading={processing}
                />
              </View>
            </View>
          ) : null}

          <View className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3">
            <Text className="font-bold text-amber-950">Xác nhận bằng biên lai chuyển khoản (Dự phòng)</Text>
            <Text className="mt-1 text-sm text-amber-700">
              Nếu khách chuyển khoản trực tiếp hoặc quét mã ngân hàng riêng, chụp ảnh biên lai thành công để bảo lãnh tiếp tục chuyến.
            </Text>
            <View className="mt-3">
              <ProofPicker
                asset={proofAsset}
                emptyLabel="Thêm ảnh biên lai thanh toán"
                chooseLabel={proofAsset ? 'Chọn lại ảnh biên lai' : 'Thêm ảnh biên lai'}
                disabled={processing}
                compact
                onPick={onPickProof}
              />
            </View>
            <View className="mt-4">
              <AppButton label="Gửi bằng chứng thanh toán" onPress={onVerify} loading={processing} disabled={!proofAsset} />
            </View>
          </View>

          {paymentVerification?.statusSummary ? (
            <View className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3">
              <Text className="text-sm text-amber-900">{paymentVerification.statusSummary}</Text>
            </View>
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
  if (status === 'DELIVERY_FAILED_NOSHOW') {
    return { label: 'Khách không có mặt', background: 'bg-red-100', text: 'text-red-800' };
  }
  if (status === 'OSD_REJECT_PENDING' || status === 'OSD_DOCK_PENDING') {
    return { label: 'Đang xử lý hàng bị từ chối', background: 'bg-red-100', text: 'text-red-800' };
  }
  if (status === 'PARTIAL_DELIVER_OSD') {
    return { label: 'Đã giao một phần', background: 'bg-orange-100', text: 'text-orange-800' };
  }
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
    | 'REJECT' | 'PARTIAL_HANDOVER' | 'NO_SHOW' | 'WAREHOUSE' | 'TEMPERATURE' | 'CLOSE_SHIFT'
) {
  if (error instanceof ApiClientError) {
    if (error.status === undefined) {
      return 'Không thể kết nối máy chủ. Vui lòng thử lại.';
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
    if (action === 'PAYMENT' && /payos.*not configured|payos_client_id|payos_api_key|payos_checksum_key/.test(message)) {
      return 'Thanh toán QR hiện chưa khả dụng. Vui lòng chọn xác nhận bằng biên lai thanh toán.';
    }
    if (action === 'APPLY_SEAL' && /seal/.test(message)) {
      return 'Mã seal chưa hợp lệ hoặc seal đã được áp dụng.';
    }
    if ((action === 'REJECT' || action === 'PARTIAL_HANDOVER' || action === 'NO_SHOW') && /evidence|image|photo|file/.test(message)) {
      return 'Vui lòng thêm ảnh minh chứng.';
    }
    if ((action === 'REJECT' || action === 'PARTIAL_HANDOVER') && /already|delivered|handover|processed|conflict/.test(message)) {
      return 'Kiện hàng này đã được xử lý trước đó.';
    }
    if (action === 'NO_SHOW' && /already|no.?show|skipped/.test(message)) {
      return 'Điểm giao này đã được báo không nhận hàng.';
    }
    if (action === 'WAREHOUSE' && /telemetry|iot|gps|location/.test(message)) {
      return 'Chưa nhận được vị trí xe từ thiết bị IoT.';
    }
    if (action === 'WAREHOUSE' && /warehouse|kho/.test(message)) {
      return 'Chưa tìm thấy kho phù hợp gần vị trí hiện tại.';
    }
    if (action === 'CLOSE_SHIFT' && /status|state|pending|unconfirmed|handover/.test(message)) {
      return 'Thao tác này chưa thể thực hiện ở trạng thái hiện tại.';
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
    case 'REJECT':
      return 'Không thể ghi nhận từ chối kiện hàng. Vui lòng thử lại.';
    case 'PARTIAL_HANDOVER':
      return 'Không thể xác nhận bàn giao một phần. Vui lòng kiểm tra số lượng và thử lại.';
    case 'NO_SHOW':
      return 'Không thể báo khách không có mặt. Vui lòng thử lại.';
    case 'WAREHOUSE':
      return 'Không thể tải danh sách kho quy đầu. Vui lòng thử lại.';
    case 'TEMPERATURE':
      return 'Không thể tải dữ liệu nhiệt độ. Vui lòng thử lại.';
    case 'CLOSE_SHIFT':
      return 'Không thể đóng ca. Vui lòng kiểm tra trạng thái chuyến rồi thử lại.';
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

function getDynamicCodDue(result: ProcessDynamicCodResponse) {
  return result.actualCodDue
    ?? result.automatedCodCalculation?.actualCodDue
    ?? result.automatedCodCalculation?.actualCodToCollect
    ?? 0;
}

function formatDateTime(value?: string | null) {
  if (!value) return '--';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '--' : date.toLocaleString('vi-VN');
}

function formatOrderStatus(status?: string | null) {
  return status ? getOrderStatus(status).label : 'Đang cập nhật';
}

function getStopStatusLabel(status: string) {
  if (status === 'SKIPPED_NOSHOW') return 'Khách không có mặt';
  return STOP_STATUS[status] || 'Chưa xác định';
}

function formatWarehouseStatus(status?: string | null) {
  switch (status?.trim().toUpperCase()) {
    case 'ACTIVE':
    case 'OK':
      return 'Đang hoạt động';
    case 'INACTIVE':
      return 'Tạm ngưng';
    default:
      return 'Chưa xác định';
  }
}

function getEpodStatusLabel(status?: string | null) {
  switch (status?.toUpperCase()) {
    case 'HANDOVER_CONFIRMED': return 'Bàn giao đã xác nhận';
    case 'OSD_PARTIAL_DELIVER': return 'Bàn giao một phần đã xác nhận';
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
  hasCutSeal,
  allOrdersHandedOver,
  hasUnresolvedEpod,
  hasPendingPayment,
  hasRemainingStops,
  hasAppliedSeal,
  tripStatus,
}: {
  hasCheckedIn: boolean;
  hasCutSeal: boolean;
  allOrdersHandedOver: boolean;
  hasUnresolvedEpod: boolean;
  hasPendingPayment: boolean;
  hasRemainingStops: boolean;
  hasAppliedSeal: boolean;
  tripStatus: string;
}) {
  if (tripStatus.toUpperCase() === 'COMPLETED') {
    return { title: 'Chuyến đã hoàn tất', detail: 'Trạng thái hoàn tất đã được hệ thống xác nhận.' };
  }
  if (!hasCheckedIn) {
    return { title: 'Bước tiếp theo: xác nhận đến điểm giao', detail: 'Thêm ảnh xác nhận và gửi check-in.' };
  }
  if (!hasCutSeal && !allOrdersHandedOver) {
    return { title: 'Bước tiếp theo: cắt seal', detail: 'Cắt seal trước khi bàn giao hoặc xử lý trường hợp không nhận hàng.' };
  }
  if (!allOrdersHandedOver) {
    return { title: 'Bước tiếp theo: bàn giao đơn hàng', detail: 'Chọn từng đơn để thêm chữ ký người nhận.' };
  }
  if (hasUnresolvedEpod) {
    return { title: 'Bước tiếp theo: tải lại ePOD', detail: 'Backend chưa trả được trạng thái ePOD. Tải lại trước khi rời điểm dừng.' };
  }
  if (hasPendingPayment) {
    return { title: 'Bước tiếp theo: thanh toán COD', detail: 'Mở lại ePOD đang chờ thanh toán và lấy mã QR cho khách hàng.' };
  }
  if (hasRemainingStops && !hasAppliedSeal) {
    return { title: 'Bước tiếp theo: kẹp seal mới', detail: 'Nhập mã seal mới trước khi tiếp tục đến điểm dừng kế tiếp.' };
  }
  if (hasRemainingStops) {
    return { title: 'Sẵn sàng tới điểm tiếp theo', detail: 'Seal mới đã được ghi nhận. Tiếp tục theo lộ trình của chuyến.' };
  }
  return {
    title: 'Đã hoàn tất bàn giao tại điểm cuối',
    detail: `Trạng thái chuyến hiện tại: ${formatTripStatus(tripStatus)}.`,
  };
}

function isCutSealNumber(sealNumber?: string | null) {
  const normalized = sealNumber?.toUpperCase() ?? '';
  return normalized.includes('UNSEALED') || normalized.includes('ĐÃ CẮT');
}

function isPaymentSettledStatus(status?: string | null) {
  return new Set([
    'PAID',
    'PAID_PROOF',
    'PAID_ACTUAL_RECEIVED',
    'PENDING_VERIFY',
  ]).has(status?.toUpperCase() ?? '');
}

function isPaymentPending(epod?: EpodResponse | null) {
  const amount = epod?.paymentAmountDue ?? 0;
  return amount > 0 && !isPaymentSettledStatus(epod?.paymentStatus);
}

function formatTripStatus(status?: string | null) {
  switch (status?.toUpperCase()) {
    case 'COMPLETED': return 'Hoàn tất';
    case 'IN_TRANSIT': return 'Đang vận chuyển';
    case 'SEALED': return 'Đã kẹp seal';
    case 'DISPATCHED': return 'Đã điều phối';
    default: return status?.trim() || 'Chưa xác định';
  }
}
